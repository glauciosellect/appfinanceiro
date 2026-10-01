-- ============================================================
-- SYNCROMONEY INTRO — Fase 4 (contas + acerto com fornecedor + recibo)
-- ============================================================
-- Arquivo standalone: rode isoladamente no SQL Editor do Supabase, DEPOIS das
-- fases 1, 2 e 3. Idempotente. Ver SyncroMoney_SPEC_Intro.md (M7, M8).
--
-- Conteúdo:
--   1) acertos_fornecedor / acertos_itens / acertos_sobras (+ imutabilidade)
--   2) venda_item_lotes.acerto_id e contas_pagar.acerto_id viram FK
--   3) Contas: intro_resumo_fornecedores, intro_criar_conta,
--      intro_baixar_parcela, intro_cancelar_conta
--   4) Acerto: intro_previa_acerto, intro_fechar_acerto, intro_cancelar_acerto
--   5) Recibo público (fornecedor, sem login): intro_recibo_publico e
--      intro_recibo_confirmar — SECURITY DEFINER, acessam UMA linha pelo token
--
-- As funções de 3 e 4 são SECURITY INVOKER (RLS + auth.uid()).
-- ============================================================

-- 1) Tabelas ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.acertos_fornecedor (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fornecedor_id      UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  numero             INTEGER NOT NULL,
  periodo_ini        DATE NOT NULL,
  periodo_fim        DATE NOT NULL,
  total_vendido      NUMERIC(15,2) NOT NULL DEFAULT 0,   -- valor de venda dos itens do período
  total_repasse      NUMERIC(15,2) NOT NULL DEFAULT 0,   -- o que a loja deve ao fornecedor (custo)
  status             TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','recebido','cancelado')),
  token_publico      UUID NOT NULL DEFAULT gen_random_uuid(),
  snapshot           JSONB NOT NULL DEFAULT '{}'::jsonb,
  hash_sha256        TEXT,
  conta_pagar_id     UUID REFERENCES public.contas_pagar(id) ON DELETE SET NULL,
  enviado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  recebido_em        TIMESTAMPTZ,
  recebido_nome      TEXT,
  recebido_documento TEXT,
  recebido_ip        TEXT,
  recebido_user_agent TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (periodo_fim >= periodo_ini),
  UNIQUE (user_id, numero)
);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_acertos_token ON public.acertos_fornecedor(token_publico);
CREATE INDEX IF NOT EXISTS idx_acertos_user_forn ON public.acertos_fornecedor(user_id, fornecedor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.acertos_itens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acerto_id         UUID NOT NULL REFERENCES public.acertos_fornecedor(id) ON DELETE CASCADE,
  produto_id        UUID NOT NULL REFERENCES public.produtos_fiscais(id) ON DELETE RESTRICT,
  produto_nome      TEXT NOT NULL,
  quantidade        NUMERIC(12,3) NOT NULL,
  custo_unitario    NUMERIC(12,2) NOT NULL,
  total_vendido     NUMERIC(15,2) NOT NULL,
  valor_repasse     NUMERIC(15,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_acertos_itens_acerto ON public.acertos_itens(acerto_id);

CREATE TABLE IF NOT EXISTS public.acertos_sobras (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acerto_id      UUID NOT NULL REFERENCES public.acertos_fornecedor(id) ON DELETE CASCADE,
  lote_id        UUID NOT NULL REFERENCES public.lotes_estoque(id) ON DELETE RESTRICT,
  produto_id     UUID NOT NULL REFERENCES public.produtos_fiscais(id) ON DELETE RESTRICT,
  produto_nome   TEXT NOT NULL,
  quantidade     NUMERIC(12,3) NOT NULL CHECK (quantidade > 0),
  validade       DATE,
  acao           TEXT NOT NULL CHECK (acao IN ('manter','devolver','trocar')),
  nova_validade  DATE,
  novo_lote_id   UUID REFERENCES public.lotes_estoque(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_acertos_sobras_acerto ON public.acertos_sobras(acerto_id);

ALTER TABLE public.acertos_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acertos_itens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acertos_sobras     ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acertos_fornecedor_all_own" ON public.acertos_fornecedor;
CREATE POLICY "acertos_fornecedor_all_own" ON public.acertos_fornecedor FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "acertos_itens_all_own" ON public.acertos_itens;
CREATE POLICY "acertos_itens_all_own" ON public.acertos_itens FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "acertos_sobras_all_own" ON public.acertos_sobras;
CREATE POLICY "acertos_sobras_all_own" ON public.acertos_sobras FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Acerto enviado/recebido não pode mudar de conteúdo; recebido é definitivo.
CREATE OR REPLACE FUNCTION public.trg_acerto_imutavel()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('enviado','recebido') THEN
      RAISE EXCEPTION 'Um acerto enviado ou recebido não pode ser excluído';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'recebido' THEN
    RAISE EXCEPTION 'Este acerto já foi recebido pelo fornecedor e não pode ser alterado';
  END IF;
  IF OLD.status = 'cancelado' THEN
    RAISE EXCEPTION 'Este acerto foi cancelado';
  END IF;
  IF NEW.snapshot IS DISTINCT FROM OLD.snapshot AND OLD.hash_sha256 IS NOT NULL THEN
    RAISE EXCEPTION 'O conteúdo de um acerto enviado não pode ser alterado';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_acerto_imutavel ON public.acertos_fornecedor;
CREATE TRIGGER trg_acerto_imutavel BEFORE UPDATE OR DELETE ON public.acertos_fornecedor
  FOR EACH ROW EXECUTE FUNCTION public.trg_acerto_imutavel();

-- 2) Vínculos ---------------------------------------------------------------

ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS acerto_id UUID REFERENCES public.acertos_fornecedor(id) ON DELETE SET NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'venda_item_lotes_acerto_id_fkey') THEN
    ALTER TABLE public.venda_item_lotes
      ADD CONSTRAINT venda_item_lotes_acerto_id_fkey
      FOREIGN KEY (acerto_id) REFERENCES public.acertos_fornecedor(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Contas -------------------------------------------------------------------

-- Quanto a loja deve a cada fornecedor (uma linha por fornecedor com saldo).
--  vencido / a_vencer: parcelas em aberto (compras a prazo e acertos já fechados)
--  consignado_a_acertar: vendido de consignado e ainda sem acerto
CREATE OR REPLACE FUNCTION public.intro_resumo_fornecedores()
RETURNS TABLE (fornecedor_id uuid, nome text, vencido numeric, a_vencer numeric, consignado_a_acertar numeric, total numeric)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH parc AS (
    SELECT cp.fornecedor_id,
           SUM(CASE WHEN pp.data_vencimento <  CURRENT_DATE THEN pp.valor ELSE 0 END) AS vencido,
           SUM(CASE WHEN pp.data_vencimento >= CURRENT_DATE THEN pp.valor ELSE 0 END) AS a_vencer
      FROM public.parcelas_pagar pp
      JOIN public.contas_pagar cp ON cp.id = pp.conta_pagar_id
     WHERE cp.user_id = auth.uid() AND cp.deleted_at IS NULL AND cp.fornecedor_id IS NOT NULL
       AND cp.status <> 'cancelado' AND pp.status IN ('aberto','atrasado')
     GROUP BY cp.fornecedor_id
  ), cons AS (
    SELECT vil.fornecedor_id, SUM(vil.quantidade * vil.custo_unitario) AS valor
      FROM public.venda_item_lotes vil
     WHERE vil.user_id = auth.uid() AND vil.consignado AND vil.acerto_id IS NULL AND NOT vil.cancelado
     GROUP BY vil.fornecedor_id
  )
  SELECT f.id, f.nome,
         round(COALESCE(parc.vencido, 0), 2),
         round(COALESCE(parc.a_vencer, 0), 2),
         round(COALESCE(cons.valor, 0), 2),
         round(COALESCE(parc.vencido, 0) + COALESCE(parc.a_vencer, 0) + COALESCE(cons.valor, 0), 2)
    FROM public.fornecedores f
    LEFT JOIN parc ON parc.fornecedor_id = f.id
    LEFT JOIN cons ON cons.fornecedor_id = f.id
   WHERE f.user_id = auth.uid() AND f.deleted_at IS NULL
     AND (parc.fornecedor_id IS NOT NULL OR cons.fornecedor_id IS NOT NULL)
   ORDER BY f.nome;
$$;

-- p = { tipo: 'pagar'|'receber', fornecedor_id | cliente_id, descricao, valor, vencimento, parcelas }
CREATE OR REPLACE FUNCTION public.intro_criar_conta(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_tipo  text := p->>'tipo';
  v_desc  text := NULLIF(btrim(COALESCE(p->>'descricao', '')), '');
  v_valor numeric := NULLIF(p->>'valor', '')::numeric;
  v_venc  date := NULLIF(p->>'vencimento', '')::date;
  v_parc  int := COALESCE(NULLIF(p->>'parcelas', '')::int, 1);
  v_forn  uuid := NULLIF(p->>'fornecedor_id', '')::uuid;
  v_cli   uuid := NULLIF(p->>'cliente_id', '')::uuid;
  v_conta uuid;
  v_vparc numeric;
  i       int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF v_tipo NOT IN ('pagar','receber') THEN RAISE EXCEPTION 'Tipo de conta inválido'; END IF;
  IF v_desc IS NULL THEN RAISE EXCEPTION 'Informe a descrição'; END IF;
  IF v_valor IS NULL OR v_valor <= 0 THEN RAISE EXCEPTION 'Informe um valor maior que zero'; END IF;
  IF v_venc IS NULL THEN RAISE EXCEPTION 'Informe o vencimento'; END IF;
  IF v_parc < 1 OR v_parc > 60 THEN RAISE EXCEPTION 'Parcelas: de 1 a 60'; END IF;
  v_vparc := floor(v_valor / v_parc * 100) / 100;

  IF v_tipo = 'pagar' THEN
    IF v_forn IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.fornecedores WHERE id = v_forn AND user_id = v_uid) THEN
      RAISE EXCEPTION 'Fornecedor inválido';
    END IF;
    INSERT INTO public.contas_pagar (user_id, fornecedor_id, descricao, valor_total, num_parcelas, data_primeira_parcela, status, origem)
    VALUES (v_uid, v_forn, v_desc, v_valor, v_parc, v_venc, 'aberto', 'manual') RETURNING id INTO v_conta;
    FOR i IN 1..v_parc LOOP
      INSERT INTO public.parcelas_pagar (conta_pagar_id, user_id, numero_parcela, total_parcelas, valor, data_vencimento, status)
      VALUES (v_conta, v_uid, i, v_parc,
              CASE WHEN i = v_parc THEN v_valor - v_vparc * (v_parc - 1) ELSE v_vparc END,
              (v_venc + make_interval(months => i - 1))::date, 'aberto');
    END LOOP;
  ELSE
    IF v_cli IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = v_cli AND user_id = v_uid) THEN
      RAISE EXCEPTION 'Cliente inválido';
    END IF;
    INSERT INTO public.contas_receber (user_id, cliente_id, descricao, valor_total, num_parcelas, data_primeira_parcela, status, origem)
    VALUES (v_uid, v_cli, v_desc, v_valor, v_parc, v_venc, 'aberto', 'manual') RETURNING id INTO v_conta;
    FOR i IN 1..v_parc LOOP
      INSERT INTO public.parcelas_receber (conta_receber_id, user_id, numero_parcela, total_parcelas, valor, data_vencimento, status)
      VALUES (v_conta, v_uid, i, v_parc,
              CASE WHEN i = v_parc THEN v_valor - v_vparc * (v_parc - 1) ELSE v_vparc END,
              (v_venc + make_interval(months => i - 1))::date, 'aberto');
    END LOOP;
  END IF;
  RETURN v_conta;
END;
$$;

-- Baixa total de uma parcela (pagamento ou recebimento) e atualiza o status da conta.
CREATE OR REPLACE FUNCTION public.intro_baixar_parcela(p_tipo text, p_id uuid, p_data date)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_conta uuid;
  v_n     int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_data IS NULL THEN RAISE EXCEPTION 'Informe a data'; END IF;

  IF p_tipo = 'pagar' THEN
    UPDATE public.parcelas_pagar SET status = 'pago', valor_pago = valor, data_pagamento = p_data
     WHERE id = p_id AND user_id = v_uid AND status IN ('aberto','atrasado')
     RETURNING conta_pagar_id INTO v_conta;
    IF v_conta IS NULL THEN RAISE EXCEPTION 'Parcela não encontrada ou já baixada'; END IF;
    SELECT count(*) INTO v_n FROM public.parcelas_pagar WHERE conta_pagar_id = v_conta AND status IN ('aberto','atrasado');
    UPDATE public.contas_pagar SET status = CASE WHEN v_n = 0 THEN 'quitado' ELSE 'parcial' END WHERE id = v_conta;
  ELSIF p_tipo = 'receber' THEN
    UPDATE public.parcelas_receber SET status = 'recebido', valor_recebido = valor, data_recebimento = p_data
     WHERE id = p_id AND user_id = v_uid AND status IN ('aberto','atrasado')
     RETURNING conta_receber_id INTO v_conta;
    IF v_conta IS NULL THEN RAISE EXCEPTION 'Parcela não encontrada ou já baixada'; END IF;
    SELECT count(*) INTO v_n FROM public.parcelas_receber WHERE conta_receber_id = v_conta AND status IN ('aberto','atrasado');
    UPDATE public.contas_receber SET status = CASE WHEN v_n = 0 THEN 'quitado' ELSE 'parcial' END WHERE id = v_conta;
  ELSE
    RAISE EXCEPTION 'Tipo inválido';
  END IF;
END;
$$;

-- Cancela uma conta lançada manualmente e ainda sem baixa.
CREATE OR REPLACE FUNCTION public.intro_cancelar_conta(p_tipo text, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_origem text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_tipo = 'pagar' THEN
    SELECT origem INTO v_origem FROM public.contas_pagar WHERE id = p_id AND user_id = v_uid;
    IF v_origem IS NULL THEN RAISE EXCEPTION 'Conta não encontrada'; END IF;
    IF v_origem <> 'manual' THEN RAISE EXCEPTION 'Esta conta foi gerada pelo sistema (entrada ou acerto) e não pode ser cancelada aqui'; END IF;
    IF EXISTS (SELECT 1 FROM public.parcelas_pagar WHERE conta_pagar_id = p_id AND status = 'pago') THEN RAISE EXCEPTION 'A conta já tem parcela paga'; END IF;
    UPDATE public.parcelas_pagar SET status = 'cancelado' WHERE conta_pagar_id = p_id;
    UPDATE public.contas_pagar SET status = 'cancelado' WHERE id = p_id;
  ELSIF p_tipo = 'receber' THEN
    SELECT origem INTO v_origem FROM public.contas_receber WHERE id = p_id AND user_id = v_uid;
    IF v_origem IS NULL THEN RAISE EXCEPTION 'Conta não encontrada'; END IF;
    IF v_origem <> 'manual' THEN RAISE EXCEPTION 'Esta conta foi gerada por uma venda e só pode ser desfeita cancelando a venda'; END IF;
    IF EXISTS (SELECT 1 FROM public.parcelas_receber WHERE conta_receber_id = p_id AND status = 'recebido') THEN RAISE EXCEPTION 'A conta já tem parcela recebida'; END IF;
    UPDATE public.parcelas_receber SET status = 'cancelado' WHERE conta_receber_id = p_id;
    UPDATE public.contas_receber SET status = 'cancelado' WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'Tipo inválido';
  END IF;
END;
$$;

-- 4) Acerto -------------------------------------------------------------------

-- Prévia: o que entra no acerto do fornecedor no período + as sobras em estoque.
-- A mesma regra é usada em intro_fechar_acerto (uma fonte só).
CREATE OR REPLACE FUNCTION public.intro_previa_acerto(p_fornecedor uuid, p_ini date, p_fim date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_itens  jsonb;
  v_sobras jsonb;
  v_vend   numeric;
  v_rep    numeric;
  v_prim   date;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_ini IS NULL OR p_fim IS NULL OR p_fim < p_ini THEN RAISE EXCEPTION 'Período inválido'; END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.produto), '[]'::jsonb),
         COALESCE(round(sum(t.total_vendido), 2), 0), COALESCE(round(sum(t.valor_repasse), 2), 0)
    INTO v_itens, v_vend, v_rep
    FROM (
      SELECT vi.produto_id, vi.nome_produto AS produto, vil.custo_unitario,
             sum(vil.quantidade) AS quantidade,
             round(sum(vil.quantidade * (vi.subtotal / vi.quantidade)), 2) AS total_vendido,
             round(sum(vil.quantidade * vil.custo_unitario), 2) AS valor_repasse
        FROM public.venda_item_lotes vil
        JOIN public.vendas v ON v.id = vil.venda_id
        JOIN public.vendas_itens vi ON vi.id = vil.venda_item_id
       WHERE vil.user_id = v_uid AND vil.fornecedor_id = p_fornecedor AND vil.consignado
         AND vil.acerto_id IS NULL AND NOT vil.cancelado AND v.status = 'concluida'
         AND (v.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_ini AND p_fim
       GROUP BY vi.produto_id, vi.nome_produto, vil.custo_unitario
    ) t;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.produto, s.validade), '[]'::jsonb)
    INTO v_sobras
    FROM (
      SELECT l.id AS lote_id, l.produto_id, pf.descricao AS produto, pf.controla_validade,
             l.qtd_saldo AS quantidade, l.validade, l.custo_unitario
        FROM public.lotes_estoque l
        JOIN public.produtos_fiscais pf ON pf.id = l.produto_id
       WHERE l.user_id = v_uid AND l.fornecedor_id = p_fornecedor AND l.consignado
         AND l.qtd_saldo > 0 AND l.status = 'ativo'
    ) s;

  SELECT min((v.created_at AT TIME ZONE 'America/Sao_Paulo')::date) INTO v_prim
    FROM public.venda_item_lotes vil JOIN public.vendas v ON v.id = vil.venda_id
   WHERE vil.user_id = v_uid AND vil.fornecedor_id = p_fornecedor AND vil.consignado
     AND vil.acerto_id IS NULL AND NOT vil.cancelado AND v.status = 'concluida';

  RETURN jsonb_build_object('itens', v_itens, 'sobras', v_sobras,
                            'total_vendido', v_vend, 'total_repasse', v_rep, 'primeira_venda_pendente', v_prim);
END;
$$;

-- p = { fornecedor_id, ini, fim, sobras: [{ lote_id, acao: manter|devolver|trocar, quantidade, nova_validade }] }
CREATE OR REPLACE FUNCTION public.intro_fechar_acerto(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_forn    uuid := NULLIF(p->>'fornecedor_id', '')::uuid;
  v_ini     date := NULLIF(p->>'ini', '')::date;
  v_fim     date := NULLIF(p->>'fim', '')::date;
  v_fn      record;
  v_cfg     record;
  v_numero  int;
  v_acerto  uuid;
  v_token   uuid;
  v_sob     jsonb;
  v_lote    record;
  v_acao    text;
  v_qtd     numeric;
  v_nval    date;
  v_novo    uuid;
  v_vend    numeric;
  v_rep     numeric;
  v_mov     int := 0;
  v_conta   uuid;
  v_snap    jsonb;
  v_hash    text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF v_ini IS NULL OR v_fim IS NULL OR v_fim < v_ini THEN RAISE EXCEPTION 'Período inválido'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('intro_acerto:' || v_uid::text));

  SELECT id, nome, cpf_cnpj, telefone INTO v_fn FROM public.fornecedores
   WHERE id = v_forn AND user_id = v_uid AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fornecedor inválido'; END IF;

  SELECT COALESCE(max(numero), 0) + 1 INTO v_numero FROM public.acertos_fornecedor WHERE user_id = v_uid;

  INSERT INTO public.acertos_fornecedor (user_id, fornecedor_id, numero, periodo_ini, periodo_fim)
  VALUES (v_uid, v_forn, v_numero, v_ini, v_fim)
  RETURNING id, token_publico INTO v_acerto, v_token;

  -- Itens vendidos no período (congela o ledger)
  INSERT INTO public.acertos_itens (user_id, acerto_id, produto_id, produto_nome, quantidade, custo_unitario, total_vendido, valor_repasse)
  SELECT v_uid, v_acerto, vi.produto_id, vi.nome_produto, sum(vil.quantidade), vil.custo_unitario,
         round(sum(vil.quantidade * (vi.subtotal / vi.quantidade)), 2),
         round(sum(vil.quantidade * vil.custo_unitario), 2)
    FROM public.venda_item_lotes vil
    JOIN public.vendas v ON v.id = vil.venda_id
    JOIN public.vendas_itens vi ON vi.id = vil.venda_item_id
   WHERE vil.user_id = v_uid AND vil.fornecedor_id = v_forn AND vil.consignado
     AND vil.acerto_id IS NULL AND NOT vil.cancelado AND v.status = 'concluida'
     AND (v.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_ini AND v_fim
   GROUP BY vi.produto_id, vi.nome_produto, vil.custo_unitario;

  UPDATE public.venda_item_lotes vil SET acerto_id = v_acerto
    FROM public.vendas v
   WHERE v.id = vil.venda_id AND vil.user_id = v_uid AND vil.fornecedor_id = v_forn AND vil.consignado
     AND vil.acerto_id IS NULL AND NOT vil.cancelado AND v.status = 'concluida'
     AND (v.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_ini AND v_fim;

  SELECT COALESCE(sum(total_vendido), 0), COALESCE(sum(valor_repasse), 0) INTO v_vend, v_rep
    FROM public.acertos_itens WHERE acerto_id = v_acerto;

  -- Sobras: manter / devolver / trocar
  IF jsonb_typeof(p->'sobras') = 'array' THEN
    FOR v_sob IN SELECT * FROM jsonb_array_elements(p->'sobras') LOOP
      v_acao := v_sob->>'acao';
      v_qtd  := NULLIF(v_sob->>'quantidade', '')::numeric;
      v_nval := NULLIF(v_sob->>'nova_validade', '')::date;
      IF v_acao NOT IN ('manter','devolver','trocar') THEN RAISE EXCEPTION 'Ação inválida para uma sobra'; END IF;

      SELECT l.*, pf.codigo AS p_codigo, pf.descricao AS p_desc, pf.controla_validade AS p_ctrl
        INTO v_lote
        FROM public.lotes_estoque l JOIN public.produtos_fiscais pf ON pf.id = l.produto_id
       WHERE l.id = NULLIF(v_sob->>'lote_id', '')::uuid AND l.user_id = v_uid AND l.fornecedor_id = v_forn
         AND l.consignado AND l.status = 'ativo'
         FOR UPDATE OF l;
      IF NOT FOUND THEN RAISE EXCEPTION 'Lote inválido no acerto'; END IF;
      IF v_qtd IS NULL OR v_qtd <= 0 OR v_qtd > v_lote.qtd_saldo THEN
        RAISE EXCEPTION 'Quantidade inválida para %', v_lote.p_desc;
      END IF;

      v_novo := NULL;
      IF v_acao IN ('devolver','trocar') THEN
        IF v_acao = 'trocar' AND v_lote.p_ctrl AND v_nval IS NULL THEN
          RAISE EXCEPTION 'Informe a nova validade da troca: %', v_lote.p_desc;
        END IF;
        IF v_acao = 'trocar' AND v_nval IS NOT NULL AND v_nval < CURRENT_DATE THEN
          RAISE EXCEPTION 'A nova validade já venceu: %', v_lote.p_desc;
        END IF;

        UPDATE public.lotes_estoque
           SET qtd_saldo = qtd_saldo - v_qtd,
               status = CASE WHEN qtd_saldo - v_qtd = 0 THEN 'devolvido' ELSE status END
         WHERE id = v_lote.id;
        UPDATE public.produtos_fiscais SET estoque = estoque - v_qtd WHERE id = v_lote.produto_id;
        INSERT INTO public.movimentos_estoque (user_id, produto_id, produto_codigo, produto_nome, tipo, quantidade, motivo, data)
        VALUES (v_uid, v_lote.produto_id, v_lote.p_codigo, v_lote.p_desc, 'saida', v_qtd,
                CASE WHEN v_acao = 'trocar' THEN 'Troca de mercadoria com fornecedor (saída) - acerto ' ELSE 'Devolução ao fornecedor - acerto ' END || v_numero, now());
        v_mov := v_mov + 1;

        IF v_acao = 'trocar' THEN
          INSERT INTO public.lotes_estoque
            (user_id, produto_id, fornecedor_id, entrada_id, origem, consignado, custo_unitario, validade, qtd_inicial, qtd_saldo)
          VALUES (v_uid, v_lote.produto_id, v_forn, NULL, 'troca', true, v_lote.custo_unitario, v_nval, v_qtd, v_qtd)
          RETURNING id INTO v_novo;
          UPDATE public.produtos_fiscais SET estoque = estoque + v_qtd WHERE id = v_lote.produto_id;
          INSERT INTO public.movimentos_estoque (user_id, produto_id, produto_codigo, produto_nome, tipo, quantidade, motivo, data)
          VALUES (v_uid, v_lote.produto_id, v_lote.p_codigo, v_lote.p_desc, 'entrada', v_qtd,
                  'Troca de mercadoria com fornecedor (entrada) - acerto ' || v_numero, now());
        END IF;
      END IF;

      INSERT INTO public.acertos_sobras (user_id, acerto_id, lote_id, produto_id, produto_nome, quantidade, validade, acao, nova_validade, novo_lote_id)
      VALUES (v_uid, v_acerto, v_lote.id, v_lote.produto_id, v_lote.p_desc, v_qtd, v_lote.validade, v_acao,
              CASE WHEN v_acao = 'trocar' THEN v_nval END, v_novo);
    END LOOP;
  END IF;

  IF v_rep = 0 AND v_mov = 0 THEN
    RAISE EXCEPTION 'Não há vendas consignadas no período nem devolução/troca para acertar';
  END IF;

  -- Conta a pagar do repasse (baixada quando o fornecedor confirmar RECEBIDO)
  IF v_rep > 0 THEN
    INSERT INTO public.contas_pagar
      (user_id, fornecedor_id, descricao, valor_total, num_parcelas, data_primeira_parcela, status, origem, acerto_id)
    VALUES (v_uid, v_forn, 'Acerto de consignação nº ' || v_numero || ' - ' || v_fn.nome, v_rep, 1, CURRENT_DATE, 'aberto', 'consignado', v_acerto)
    RETURNING id INTO v_conta;
    INSERT INTO public.parcelas_pagar (conta_pagar_id, user_id, numero_parcela, total_parcelas, valor, data_vencimento, status)
    VALUES (v_conta, v_uid, 1, 1, v_rep, CURRENT_DATE, 'aberto');
  END IF;

  SELECT nome_loja, cnpj_cpf, telefone, endereco, logo_url, texto_recibo INTO v_cfg
    FROM public.intro_config WHERE user_id = v_uid;

  v_snap := jsonb_build_object(
    'numero', v_numero,
    'emitido_em', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'periodo', jsonb_build_object('ini', v_ini, 'fim', v_fim),
    'loja', jsonb_build_object('nome', COALESCE(v_cfg.nome_loja, ''), 'cnpj_cpf', COALESCE(v_cfg.cnpj_cpf, ''),
                               'telefone', COALESCE(v_cfg.telefone, ''), 'endereco', COALESCE(v_cfg.endereco, ''),
                               'logo_url', COALESCE(v_cfg.logo_url, '')),
    'fornecedor', jsonb_build_object('nome', v_fn.nome, 'cpf_cnpj', COALESCE(v_fn.cpf_cnpj, ''), 'telefone', COALESCE(v_fn.telefone, '')),
    'itens', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'produto', produto_nome, 'quantidade', quantidade, 'custo_unitario', custo_unitario,
                'total_vendido', total_vendido, 'valor_repasse', valor_repasse) ORDER BY produto_nome)
              FROM public.acertos_itens WHERE acerto_id = v_acerto), '[]'::jsonb),
    'sobras', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'produto', produto_nome, 'quantidade', quantidade, 'validade', validade,
                'acao', acao, 'nova_validade', nova_validade) ORDER BY produto_nome)
              FROM public.acertos_sobras WHERE acerto_id = v_acerto), '[]'::jsonb),
    'total_vendido', v_vend,
    'total_repasse', v_rep,
    'texto_recibo', COALESCE(NULLIF(v_cfg.texto_recibo, ''),
        'Declaro ter recebido o valor e/ou as mercadorias acima discriminados, dando plena quitação.')
  );
  v_hash := encode(sha256(convert_to(v_snap::text, 'UTF8')), 'hex');

  UPDATE public.acertos_fornecedor
     SET snapshot = v_snap, hash_sha256 = v_hash, total_vendido = v_vend, total_repasse = v_rep, conta_pagar_id = v_conta
   WHERE id = v_acerto;

  RETURN jsonb_build_object('id', v_acerto, 'numero', v_numero, 'token', v_token);
END;
$$;

-- Cancela um acerto ainda não recebido e sem devolução/troca já executada.
CREATE OR REPLACE FUNCTION public.intro_cancelar_acerto(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_ac record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO v_ac FROM public.acertos_fornecedor WHERE id = p_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Acerto não encontrado'; END IF;
  IF v_ac.status <> 'enviado' THEN RAISE EXCEPTION 'Só é possível cancelar um acerto que ainda não foi recebido'; END IF;
  IF EXISTS (SELECT 1 FROM public.acertos_sobras WHERE acerto_id = p_id AND acao IN ('devolver','trocar')) THEN
    RAISE EXCEPTION 'Este acerto inclui devolução ou troca de mercadoria já efetuada e não pode ser cancelado';
  END IF;

  UPDATE public.venda_item_lotes SET acerto_id = NULL WHERE acerto_id = p_id;
  UPDATE public.parcelas_pagar SET status = 'cancelado'
   WHERE conta_pagar_id IN (SELECT id FROM public.contas_pagar WHERE acerto_id = p_id AND user_id = v_uid);
  UPDATE public.contas_pagar SET status = 'cancelado' WHERE acerto_id = p_id AND user_id = v_uid;
  UPDATE public.acertos_fornecedor SET status = 'cancelado' WHERE id = p_id;
END;
$$;

-- 5) Recibo público (fornecedor, sem login) -------------------------------------
-- SECURITY DEFINER: leem/gravam EXATAMENTE a linha do token informado, nada mais.

CREATE OR REPLACE FUNCTION public.intro_recibo_publico(p_token uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'status', a.status, 'numero', a.numero, 'snapshot', a.snapshot, 'hash', a.hash_sha256,
    'enviado_em', a.enviado_em, 'recebido_em', a.recebido_em,
    'recebido_nome', a.recebido_nome, 'recebido_documento', a.recebido_documento)
  FROM public.acertos_fornecedor a
  WHERE a.token_publico = p_token;
$$;

CREATE OR REPLACE FUNCTION public.intro_recibo_confirmar(p_token uuid, p_nome text, p_documento text, p_ip text, p_ua text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ac   record;
  v_doc  text := regexp_replace(COALESCE(p_documento, ''), '\D', '', 'g');
  v_forn text;
  v_hash text;
BEGIN
  IF p_nome IS NULL OR length(btrim(p_nome)) < 3 THEN RAISE EXCEPTION 'Informe seu nome completo'; END IF;
  IF length(v_doc) NOT IN (11, 14) THEN RAISE EXCEPTION 'Informe um CPF ou CNPJ válido'; END IF;

  SELECT * INTO v_ac FROM public.acertos_fornecedor WHERE token_publico = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento não encontrado'; END IF;
  IF v_ac.status = 'recebido' THEN RAISE EXCEPTION 'Este acerto já foi confirmado'; END IF;
  IF v_ac.status <> 'enviado' THEN RAISE EXCEPTION 'Este acerto foi cancelado'; END IF;

  -- Integridade: o documento exibido ao fornecedor é o que foi fechado
  v_hash := encode(sha256(convert_to(v_ac.snapshot::text, 'UTF8')), 'hex');
  IF v_hash IS DISTINCT FROM v_ac.hash_sha256 THEN RAISE EXCEPTION 'Documento inconsistente; peça um novo acerto ao lojista'; END IF;

  -- Se o fornecedor tem CPF/CNPJ cadastrado, o documento digitado precisa conferir
  v_forn := regexp_replace(COALESCE(v_ac.snapshot->'fornecedor'->>'cpf_cnpj', ''), '\D', '', 'g');
  IF v_forn <> '' AND v_forn <> v_doc THEN RAISE EXCEPTION 'O CPF/CNPJ informado não confere com o cadastro do fornecedor'; END IF;

  UPDATE public.acertos_fornecedor
     SET status = 'recebido', recebido_em = now(), recebido_nome = btrim(p_nome), recebido_documento = v_doc,
         recebido_ip = left(COALESCE(p_ip, ''), 64), recebido_user_agent = left(COALESCE(p_ua, ''), 300)
   WHERE id = v_ac.id;

  -- Baixa o pagamento do acerto
  IF v_ac.conta_pagar_id IS NOT NULL THEN
    UPDATE public.parcelas_pagar SET status = 'pago', valor_pago = valor, data_pagamento = CURRENT_DATE
     WHERE conta_pagar_id = v_ac.conta_pagar_id AND status IN ('aberto','atrasado');
    UPDATE public.contas_pagar SET status = 'quitado' WHERE id = v_ac.conta_pagar_id;
  END IF;

  RETURN public.intro_recibo_publico(p_token);
END;
$$;

REVOKE ALL ON FUNCTION public.intro_recibo_publico(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.intro_recibo_confirmar(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.intro_recibo_publico(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intro_recibo_confirmar(uuid, text, text, text, text) TO anon, authenticated;
