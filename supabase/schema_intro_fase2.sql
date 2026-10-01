-- ============================================================
-- SYNCROMONEY INTRO — Fase 2 (entrada de mercadoria + estoque por lote)
-- ============================================================
-- Arquivo standalone: rode isoladamente no SQL Editor do Supabase, DEPOIS de
-- schema_intro_fase1.sql. Idempotente. Ver SyncroMoney_SPEC_Intro.md (M3, M4).
--
-- Conteúdo:
--   1) entradas_mercadoria / entradas_itens / lotes_estoque
--   2) contas_pagar.origem e contas_pagar.entrada_id (de onde veio a conta)
--   3) intro_registrar_entrada  — entrada + lotes + estoque + conta a pagar, atômico
--   4) intro_estornar_entrada   — desfaz uma entrada que ainda não teve saída
--   5) intro_ajustar_lote       — ajuste manual de saldo, com motivo
--
-- As funções são SECURITY INVOKER: rodam com as permissões (RLS) do usuário
-- logado e usam auth.uid(); nenhuma delas enxerga dado de outra loja.
-- ============================================================

-- 1) Tabelas ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.entradas_mercadoria (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fornecedor_id      UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  data               DATE NOT NULL DEFAULT CURRENT_DATE,
  numero_documento   TEXT,
  condicao_pagamento TEXT NOT NULL CHECK (condicao_pagamento IN ('avista','prazo','consignado')),
  vencimento         DATE,
  parcelas           SMALLINT NOT NULL DEFAULT 1 CHECK (parcelas BETWEEN 1 AND 60),
  total_custo        NUMERIC(15,2) NOT NULL DEFAULT 0,
  observacao         TEXT,
  status             TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','estornada')),
  estornada_em       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entradas_user_data ON public.entradas_mercadoria(user_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_entradas_fornecedor ON public.entradas_mercadoria(fornecedor_id);

CREATE TABLE IF NOT EXISTS public.entradas_itens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entrada_id     UUID NOT NULL REFERENCES public.entradas_mercadoria(id) ON DELETE CASCADE,
  produto_id     UUID NOT NULL REFERENCES public.produtos_fiscais(id) ON DELETE RESTRICT,
  quantidade     NUMERIC(12,3) NOT NULL CHECK (quantidade > 0),
  custo_unitario NUMERIC(12,2) NOT NULL CHECK (custo_unitario > 0),
  preco_venda    NUMERIC(12,2),
  validade       DATE
);
CREATE INDEX IF NOT EXISTS idx_entradas_itens_entrada ON public.entradas_itens(entrada_id);

CREATE TABLE IF NOT EXISTS public.lotes_estoque (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produto_id     UUID NOT NULL REFERENCES public.produtos_fiscais(id) ON DELETE RESTRICT,
  fornecedor_id  UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  entrada_id     UUID REFERENCES public.entradas_mercadoria(id) ON DELETE SET NULL,
  entrada_item_id UUID REFERENCES public.entradas_itens(id) ON DELETE SET NULL,
  origem         TEXT NOT NULL DEFAULT 'entrada' CHECK (origem IN ('entrada','troca')),
  consignado     BOOLEAN NOT NULL DEFAULT false,
  custo_unitario NUMERIC(12,2) NOT NULL CHECK (custo_unitario >= 0),
  validade       DATE,
  qtd_inicial    NUMERIC(12,3) NOT NULL CHECK (qtd_inicial > 0),
  qtd_saldo      NUMERIC(12,3) NOT NULL CHECK (qtd_saldo >= 0),
  status         TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','esgotado','devolvido','vencido','estornado')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lotes_user_produto ON public.lotes_estoque(user_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_lotes_fornecedor ON public.lotes_estoque(user_id, fornecedor_id);
-- Índice da baixa FEFO (vence primeiro, sai primeiro) usada no PDV
CREATE INDEX IF NOT EXISTS idx_lotes_fefo ON public.lotes_estoque(user_id, produto_id, validade NULLS LAST, created_at) WHERE qtd_saldo > 0;

ALTER TABLE public.entradas_mercadoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entradas_itens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes_estoque       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entradas_mercadoria_all_own" ON public.entradas_mercadoria;
CREATE POLICY "entradas_mercadoria_all_own" ON public.entradas_mercadoria
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "entradas_itens_all_own" ON public.entradas_itens;
CREATE POLICY "entradas_itens_all_own" ON public.entradas_itens
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "lotes_estoque_all_own" ON public.lotes_estoque;
CREATE POLICY "lotes_estoque_all_own" ON public.lotes_estoque
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2) contas_pagar: origem da conta -----------------------------------------

ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS entrada_id UUID REFERENCES public.entradas_mercadoria(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contas_pagar_entrada ON public.contas_pagar(entrada_id) WHERE entrada_id IS NOT NULL;

-- 3) Registrar entrada ------------------------------------------------------
-- p = {
--   fornecedor_id, data, numero_documento, condicao_pagamento (avista|prazo|consignado),
--   vencimento (1ª parcela, só prazo), parcelas, observacao,
--   itens: [{ produto_id, quantidade, custo_unitario, preco_venda, validade }]
-- }
CREATE OR REPLACE FUNCTION public.intro_registrar_entrada(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_forn      uuid := NULLIF(p->>'fornecedor_id', '')::uuid;
  v_cond      text := p->>'condicao_pagamento';
  v_data      date := COALESCE(NULLIF(p->>'data', '')::date, CURRENT_DATE);
  v_venc      date := NULLIF(p->>'vencimento', '')::date;
  v_parc      int  := COALESCE(NULLIF(p->>'parcelas', '')::int, 1);
  v_doc       text := NULLIF(btrim(COALESCE(p->>'numero_documento', '')), '');
  v_forn_nome text;
  v_entrada   uuid;
  v_item      jsonb;
  v_prod      record;
  v_qtd       numeric;
  v_custo     numeric;
  v_preco     numeric;
  v_val       date;
  v_item_id   uuid;
  v_total     numeric := 0;
  v_conta     uuid;
  v_vparc     numeric;
  i           int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF v_cond IS NULL OR v_cond NOT IN ('avista','prazo','consignado') THEN
    RAISE EXCEPTION 'Condição de pagamento inválida';
  END IF;

  SELECT nome INTO v_forn_nome FROM public.fornecedores
   WHERE id = v_forn AND user_id = v_uid AND deleted_at IS NULL;
  IF v_forn_nome IS NULL THEN RAISE EXCEPTION 'Fornecedor inválido'; END IF;

  IF jsonb_typeof(p->'itens') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'itens') = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um item';
  END IF;
  IF v_cond = 'prazo' AND (v_venc IS NULL OR v_parc < 1 OR v_parc > 60) THEN
    RAISE EXCEPTION 'Para pagamento a prazo informe o vencimento e de 1 a 60 parcelas';
  END IF;
  IF v_cond <> 'prazo' THEN v_parc := 1; v_venc := NULL; END IF;

  INSERT INTO public.entradas_mercadoria
    (user_id, fornecedor_id, data, numero_documento, condicao_pagamento, vencimento, parcelas, observacao)
  VALUES
    (v_uid, v_forn, v_data, v_doc, v_cond, v_venc, v_parc, NULLIF(btrim(COALESCE(p->>'observacao', '')), ''))
  RETURNING id INTO v_entrada;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p->'itens') LOOP
    SELECT id, codigo, descricao, controla_validade INTO v_prod
      FROM public.produtos_fiscais
     WHERE id = NULLIF(v_item->>'produto_id', '')::uuid AND user_id = v_uid AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto inválido na entrada'; END IF;

    v_qtd   := NULLIF(v_item->>'quantidade', '')::numeric;
    v_custo := NULLIF(v_item->>'custo_unitario', '')::numeric;
    v_preco := NULLIF(v_item->>'preco_venda', '')::numeric;
    v_val   := NULLIF(v_item->>'validade', '')::date;

    IF v_qtd IS NULL OR v_qtd <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida: %', v_prod.descricao;
    END IF;
    IF v_custo IS NULL OR v_custo <= 0 THEN
      RAISE EXCEPTION 'Custo inválido: %', v_prod.descricao;
    END IF;
    IF v_prod.controla_validade AND v_val IS NULL THEN
      RAISE EXCEPTION 'Informe a validade: %', v_prod.descricao;
    END IF;
    IF v_val IS NOT NULL AND v_val < v_data THEN
      RAISE EXCEPTION 'Validade anterior à data da entrada: %', v_prod.descricao;
    END IF;

    INSERT INTO public.entradas_itens (user_id, entrada_id, produto_id, quantidade, custo_unitario, preco_venda, validade)
    VALUES (v_uid, v_entrada, v_prod.id, v_qtd, v_custo, v_preco, v_val)
    RETURNING id INTO v_item_id;

    INSERT INTO public.lotes_estoque
      (user_id, produto_id, fornecedor_id, entrada_id, entrada_item_id, origem, consignado, custo_unitario, validade, qtd_inicial, qtd_saldo)
    VALUES
      (v_uid, v_prod.id, v_forn, v_entrada, v_item_id, 'entrada', v_cond = 'consignado', v_custo, v_val, v_qtd, v_qtd);

    -- Cache do estoque total + último custo; preço de venda só muda se informado
    UPDATE public.produtos_fiscais SET
      estoque     = estoque + v_qtd,
      preco_custo = v_custo,
      preco_venda = CASE WHEN COALESCE(v_preco, 0) > 0 THEN v_preco ELSE preco_venda END,
      margem_lucro = CASE WHEN COALESCE(v_preco, 0) > 0
                          THEN LEAST(GREATEST(round(((v_preco / v_custo) - 1) * 100, 2), 0), 999.99)
                          ELSE margem_lucro END
    WHERE id = v_prod.id;

    INSERT INTO public.movimentos_estoque
      (user_id, produto_id, produto_codigo, produto_nome, tipo, quantidade, motivo, nf_referencia, data)
    VALUES
      (v_uid, v_prod.id, v_prod.codigo, v_prod.descricao, 'entrada', v_qtd,
       'Entrada de mercadoria - ' || v_forn_nome, v_doc, v_data::timestamptz);

    v_total := v_total + round(v_qtd * v_custo, 2);
  END LOOP;

  UPDATE public.entradas_mercadoria SET total_custo = v_total WHERE id = v_entrada;

  -- Conta a pagar conforme a condição (consignado não gera nada na entrada)
  IF v_cond = 'avista' THEN
    INSERT INTO public.contas_pagar
      (user_id, fornecedor_id, descricao, valor_total, num_parcelas, data_primeira_parcela, status, origem, entrada_id)
    VALUES
      (v_uid, v_forn, 'Entrada de mercadoria - ' || v_forn_nome, v_total, 1, v_data, 'quitado', 'entrada', v_entrada)
    RETURNING id INTO v_conta;
    INSERT INTO public.parcelas_pagar
      (conta_pagar_id, user_id, numero_parcela, total_parcelas, valor, valor_pago, data_vencimento, data_pagamento, status)
    VALUES (v_conta, v_uid, 1, 1, v_total, v_total, v_data, v_data, 'pago');

  ELSIF v_cond = 'prazo' THEN
    INSERT INTO public.contas_pagar
      (user_id, fornecedor_id, descricao, valor_total, num_parcelas, data_primeira_parcela, status, origem, entrada_id)
    VALUES
      (v_uid, v_forn, 'Entrada de mercadoria - ' || v_forn_nome, v_total, v_parc, v_venc, 'aberto', 'entrada', v_entrada)
    RETURNING id INTO v_conta;
    v_vparc := floor(v_total / v_parc * 100) / 100;
    FOR i IN 1..v_parc LOOP
      INSERT INTO public.parcelas_pagar
        (conta_pagar_id, user_id, numero_parcela, total_parcelas, valor, data_vencimento, status)
      VALUES (
        v_conta, v_uid, i, v_parc,
        CASE WHEN i = v_parc THEN v_total - v_vparc * (v_parc - 1) ELSE v_vparc END,
        (v_venc + make_interval(months => i - 1))::date,
        'aberto'
      );
    END LOOP;
  END IF;

  RETURN v_entrada;
END;
$$;

-- 4) Estornar entrada ---------------------------------------------------------
-- Só é possível enquanto nenhum lote da entrada teve saída (venda, ajuste, etc.).
CREATE OR REPLACE FUNCTION public.intro_estornar_entrada(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ent record;
  v_lote record;
  v_prod record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_ent FROM public.entradas_mercadoria WHERE id = p_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrada não encontrada'; END IF;
  IF v_ent.status <> 'ativa' THEN RAISE EXCEPTION 'Esta entrada já foi estornada'; END IF;

  IF EXISTS (SELECT 1 FROM public.lotes_estoque WHERE entrada_id = p_id AND qtd_saldo <> qtd_inicial) THEN
    RAISE EXCEPTION 'Esta entrada já teve vendas ou baixas e não pode ser estornada';
  END IF;

  FOR v_lote IN SELECT * FROM public.lotes_estoque WHERE entrada_id = p_id LOOP
    SELECT id, codigo, descricao INTO v_prod FROM public.produtos_fiscais WHERE id = v_lote.produto_id;
    UPDATE public.produtos_fiscais SET estoque = estoque - v_lote.qtd_inicial WHERE id = v_lote.produto_id;
    INSERT INTO public.movimentos_estoque
      (user_id, produto_id, produto_codigo, produto_nome, tipo, quantidade, motivo, nf_referencia, data)
    VALUES
      (v_uid, v_lote.produto_id, v_prod.codigo, v_prod.descricao, 'saida', v_lote.qtd_inicial,
       'Estorno de entrada de mercadoria', v_ent.numero_documento, now());
    UPDATE public.lotes_estoque SET qtd_saldo = 0, status = 'estornado' WHERE id = v_lote.id;
  END LOOP;

  UPDATE public.parcelas_pagar SET status = 'cancelado'
   WHERE conta_pagar_id IN (SELECT id FROM public.contas_pagar WHERE entrada_id = p_id AND user_id = v_uid);
  UPDATE public.contas_pagar SET status = 'cancelado' WHERE entrada_id = p_id AND user_id = v_uid;

  UPDATE public.entradas_mercadoria SET status = 'estornada', estornada_em = now() WHERE id = p_id;
END;
$$;

-- 5) Ajuste manual de lote ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.intro_ajustar_lote(p_lote uuid, p_delta numeric, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_lote record;
  v_prod record;
  v_novo numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN RAISE EXCEPTION 'Informe o motivo do ajuste'; END IF;
  IF p_delta IS NULL OR p_delta = 0 THEN RAISE EXCEPTION 'Informe a quantidade do ajuste'; END IF;

  SELECT * INTO v_lote FROM public.lotes_estoque WHERE id = p_lote AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
  IF v_lote.status IN ('estornado','devolvido') THEN RAISE EXCEPTION 'Este lote não aceita ajuste'; END IF;

  v_novo := v_lote.qtd_saldo + p_delta;
  IF v_novo < 0 THEN RAISE EXCEPTION 'O saldo do lote não pode ficar negativo'; END IF;

  SELECT id, codigo, descricao INTO v_prod FROM public.produtos_fiscais WHERE id = v_lote.produto_id;

  UPDATE public.lotes_estoque
     SET qtd_saldo = v_novo, status = CASE WHEN v_novo = 0 THEN 'esgotado' ELSE 'ativo' END
   WHERE id = p_lote;
  UPDATE public.produtos_fiscais SET estoque = estoque + p_delta WHERE id = v_lote.produto_id;

  INSERT INTO public.movimentos_estoque
    (user_id, produto_id, produto_codigo, produto_nome, tipo, quantidade, motivo, data)
  VALUES
    (v_uid, v_lote.produto_id, v_prod.codigo, v_prod.descricao,
     CASE WHEN p_delta > 0 THEN 'entrada' ELSE 'saida' END, abs(p_delta),
     'Ajuste de estoque: ' || btrim(p_motivo), now());
END;
$$;
