-- ============================================================
-- SYNCROMONEY INTRO — Fase 3 (PDV + Caixa do dia)
-- ============================================================
-- Arquivo standalone: rode isoladamente no SQL Editor do Supabase, DEPOIS de
-- schema_intro_fase1.sql e schema_intro_fase2.sql. Idempotente.
-- Ver SyncroMoney_SPEC_Intro.md (M5, M6).
--
-- Conteúdo:
--   1) vendas_pagamentos.bandeira/parcelas (se ainda não existirem)
--   2) contas_receber.origem / venda_id (fiado)
--   3) venda_item_lotes — de qual lote (e fornecedor) saiu cada item vendido.
--      É o "ledger" do repasse de consignado: consignado = true e
--      acerto_id IS NULL e cancelado = false  =>  repasse pendente ao fornecedor
--   4) intro_salvar_venda   — venda (ou venda em espera) atômica, com baixa FEFO
--   5) intro_cancelar_venda — reverte estoque, repasse e fiado
--
-- As funções são SECURITY INVOKER (RLS do usuário logado + auth.uid()).
-- ============================================================

-- 1) Detalhes de cartão (idempotente; mesmo conteúdo de schema_pdv_pagamentos.sql)
ALTER TABLE public.vendas_pagamentos ADD COLUMN IF NOT EXISTS bandeira TEXT;
ALTER TABLE public.vendas_pagamentos ADD COLUMN IF NOT EXISTS parcelas SMALLINT;

-- vendas_itens.produto_id precisa apontar para produtos_fiscais (catálogo único).
-- NOT VALID: não revalida linhas antigas, só as novas.
DO $$
DECLARE v_ref regclass;
BEGIN
  SELECT confrelid::regclass INTO v_ref FROM pg_constraint
   WHERE conname = 'vendas_itens_produto_id_fkey' AND conrelid = 'public.vendas_itens'::regclass;
  IF v_ref IS DISTINCT FROM 'public.produtos_fiscais'::regclass THEN
    ALTER TABLE public.vendas_itens DROP CONSTRAINT IF EXISTS vendas_itens_produto_id_fkey;
    ALTER TABLE public.vendas_itens
      ADD CONSTRAINT vendas_itens_produto_id_fkey
      FOREIGN KEY (produto_id) REFERENCES public.produtos_fiscais(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

-- 2) Fiado
ALTER TABLE public.contas_receber ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.contas_receber ADD COLUMN IF NOT EXISTS venda_id UUID REFERENCES public.vendas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contas_receber_venda ON public.contas_receber(venda_id) WHERE venda_id IS NOT NULL;

-- 3) Ledger venda x lote
CREATE TABLE IF NOT EXISTS public.venda_item_lotes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venda_id       UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  venda_item_id  UUID NOT NULL REFERENCES public.vendas_itens(id) ON DELETE CASCADE,
  lote_id        UUID NOT NULL REFERENCES public.lotes_estoque(id) ON DELETE RESTRICT,
  fornecedor_id  UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  quantidade     NUMERIC(12,3) NOT NULL CHECK (quantidade > 0),
  custo_unitario NUMERIC(12,2) NOT NULL,
  consignado     BOOLEAN NOT NULL,
  acerto_id      UUID,            -- preenchido na Fase 4 (acerto com fornecedor)
  cancelado      BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vil_venda ON public.venda_item_lotes(venda_id);
CREATE INDEX IF NOT EXISTS idx_vil_pendente ON public.venda_item_lotes(user_id, fornecedor_id)
  WHERE consignado AND acerto_id IS NULL AND NOT cancelado;

ALTER TABLE public.venda_item_lotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "venda_item_lotes_all_own" ON public.venda_item_lotes;
CREATE POLICY "venda_item_lotes_all_own" ON public.venda_item_lotes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4) Salvar venda -------------------------------------------------------------
-- p = {
--   venda_id (opcional: retomar uma venda em espera), modo: 'concluir' | 'espera',
--   identificador (nome/número da venda em espera), cliente_id, desconto (geral, R$),
--   vencimento_fiado (opcional, padrão hoje + 30 dias),
--   itens: [{ produto_id, quantidade, preco_unitario, desconto_item }],
--   pagamentos: [{ forma, valor, troco, bandeira, parcelas }]
-- }
-- Formas: Dinheiro | Pix | Cartão de Crédito | Cartão de Débito | Fiado
-- valor = parte da venda quitada naquela forma (SEM o troco); a soma deve ser o total.
CREATE OR REPLACE FUNCTION public.intro_salvar_venda(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_modo      text := COALESCE(p->>'modo', 'concluir');
  v_venda     uuid := NULLIF(p->>'venda_id', '')::uuid;
  v_cliente   uuid := NULLIF(p->>'cliente_id', '')::uuid;
  v_ident     text := NULLIF(btrim(COALESCE(p->>'identificador', '')), '');
  v_desc_ger  numeric := COALESCE(NULLIF(p->>'desconto', '')::numeric, 0);
  v_venc_fiado date := COALESCE(NULLIF(p->>'vencimento_fiado', '')::date, CURRENT_DATE + 30);
  v_sessao    uuid;
  v_numero    text;
  v_ano       text := to_char(CURRENT_DATE, 'YYYY');
  v_item      jsonb;
  v_pag       jsonb;
  v_prod      record;
  v_lote      record;
  v_item_id   uuid;
  v_qtd       numeric;
  v_preco     numeric;
  v_desc_it   numeric;
  v_sub_item  numeric;
  v_subtotal  numeric := 0;
  v_total     numeric;
  v_rest      numeric;
  v_take      numeric;
  v_forma     text;
  v_valor     numeric;
  v_troco     numeric;
  v_soma_pag  numeric := 0;
  v_conta     uuid;
  v_cli_ok    uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF v_modo NOT IN ('concluir','espera') THEN RAISE EXCEPTION 'Modo inválido'; END IF;
  IF jsonb_typeof(p->'itens') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'itens') = 0 THEN
    RAISE EXCEPTION 'Adicione ao menos um produto';
  END IF;
  IF v_desc_ger < 0 THEN RAISE EXCEPTION 'Desconto inválido'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('intro_venda:' || v_uid::text));

  SELECT id INTO v_sessao FROM public.caixa_sessoes
   WHERE user_id = v_uid AND status = 'aberto' ORDER BY aberto_em DESC LIMIT 1;
  IF v_sessao IS NULL THEN RAISE EXCEPTION 'Abra o caixa antes de vender'; END IF;

  IF v_cliente IS NOT NULL THEN
    SELECT id INTO v_cli_ok FROM public.clientes WHERE id = v_cliente AND user_id = v_uid;
    IF v_cli_ok IS NULL THEN RAISE EXCEPTION 'Cliente inválido'; END IF;
  END IF;

  IF v_venda IS NOT NULL THEN
    SELECT numero_sequencial INTO v_numero FROM public.vendas
     WHERE id = v_venda AND user_id = v_uid AND status IN ('em_andamento','em_espera') FOR UPDATE;
    IF v_numero IS NULL THEN RAISE EXCEPTION 'Venda não encontrada ou já finalizada'; END IF;
    DELETE FROM public.vendas_pagamentos WHERE venda_id = v_venda;
    DELETE FROM public.vendas_itens WHERE venda_id = v_venda;
    UPDATE public.vendas SET caixa_sessao_id = v_sessao, cliente_id = v_cliente WHERE id = v_venda;
  ELSE
    SELECT lpad((COALESCE(max(split_part(numero_sequencial, '-', 1)::int), 0) + 1)::text, 3, '0') || '-' || v_ano
      INTO v_numero
      FROM public.vendas
     WHERE user_id = v_uid AND numero_sequencial ~ ('^[0-9]+-' || v_ano || '$');
    INSERT INTO public.vendas (user_id, numero_sequencial, caixa_sessao_id, cliente_id, status)
    VALUES (v_uid, v_numero, v_sessao, v_cliente, 'em_andamento')
    RETURNING id INTO v_venda;
  END IF;

  -- Itens (e, na conclusão, a baixa dos lotes)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p->'itens') LOOP
    SELECT id, codigo, descricao INTO v_prod FROM public.produtos_fiscais
     WHERE id = NULLIF(v_item->>'produto_id', '')::uuid AND user_id = v_uid AND deleted_at IS NULL AND ativo;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto inválido ou inativo'; END IF;

    v_qtd     := NULLIF(v_item->>'quantidade', '')::numeric;
    v_preco   := NULLIF(v_item->>'preco_unitario', '')::numeric;
    v_desc_it := COALESCE(NULLIF(v_item->>'desconto_item', '')::numeric, 0);
    IF v_qtd IS NULL OR v_qtd <= 0 THEN RAISE EXCEPTION 'Quantidade inválida: %', v_prod.descricao; END IF;
    IF v_preco IS NULL OR v_preco < 0 THEN RAISE EXCEPTION 'Preço inválido: %', v_prod.descricao; END IF;
    v_sub_item := round(v_qtd * v_preco, 2) - v_desc_it;
    IF v_desc_it < 0 OR v_sub_item < 0 THEN RAISE EXCEPTION 'Desconto inválido: %', v_prod.descricao; END IF;

    INSERT INTO public.vendas_itens (venda_id, user_id, produto_id, nome_produto, quantidade, preco_unitario, desconto_item, subtotal)
    VALUES (v_venda, v_uid, v_prod.id, v_prod.descricao, v_qtd, v_preco, v_desc_it, v_sub_item)
    RETURNING id INTO v_item_id;
    v_subtotal := v_subtotal + v_sub_item;

    IF v_modo = 'concluir' THEN
      v_rest := v_qtd;
      -- FEFO: vence primeiro, sai primeiro; em empate sai o consignado antes do próprio.
      -- Lote vencido não é vendido.
      FOR v_lote IN
        SELECT id, fornecedor_id, consignado, custo_unitario, qtd_saldo
          FROM public.lotes_estoque
         WHERE user_id = v_uid AND produto_id = v_prod.id AND qtd_saldo > 0 AND status = 'ativo'
           AND (validade IS NULL OR validade >= CURRENT_DATE)
         ORDER BY validade NULLS LAST, consignado DESC, created_at
           FOR UPDATE
      LOOP
        EXIT WHEN v_rest <= 0;
        v_take := LEAST(v_lote.qtd_saldo, v_rest);
        UPDATE public.lotes_estoque
           SET qtd_saldo = qtd_saldo - v_take,
               status = CASE WHEN qtd_saldo - v_take = 0 THEN 'esgotado' ELSE status END
         WHERE id = v_lote.id;
        INSERT INTO public.venda_item_lotes
          (user_id, venda_id, venda_item_id, lote_id, fornecedor_id, quantidade, custo_unitario, consignado)
        VALUES (v_uid, v_venda, v_item_id, v_lote.id, v_lote.fornecedor_id, v_take, v_lote.custo_unitario, v_lote.consignado);
        v_rest := v_rest - v_take;
      END LOOP;
      IF v_rest > 0 THEN
        RAISE EXCEPTION 'Estoque insuficiente: % (faltam % un.). Registre a entrada de mercadoria.', v_prod.descricao, v_rest;
      END IF;

      UPDATE public.produtos_fiscais SET estoque = estoque - v_qtd WHERE id = v_prod.id;
      INSERT INTO public.movimentos_estoque
        (user_id, produto_id, produto_codigo, produto_nome, tipo, quantidade, motivo, nf_referencia, data)
      VALUES (v_uid, v_prod.id, v_prod.codigo, v_prod.descricao, 'saida', v_qtd, 'Venda PDV Nº ' || v_numero, v_numero, now());
    END IF;
  END LOOP;

  v_total := v_subtotal - v_desc_ger;
  IF v_total < 0 THEN RAISE EXCEPTION 'O desconto não pode ser maior que a venda'; END IF;

  IF v_modo = 'espera' THEN
    IF v_ident IS NULL THEN RAISE EXCEPTION 'Informe um nome ou número para a venda em espera'; END IF;
    UPDATE public.vendas
       SET status = 'em_espera', identificador_espera = v_ident, subtotal = v_subtotal, desconto = v_desc_ger, total = v_total
     WHERE id = v_venda;
    RETURN jsonb_build_object('venda_id', v_venda, 'numero', v_numero, 'total', v_total);
  END IF;

  -- Pagamentos
  IF v_total = 0 THEN RAISE EXCEPTION 'A venda não pode ter total zero'; END IF;
  IF jsonb_typeof(p->'pagamentos') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'pagamentos') = 0 THEN
    RAISE EXCEPTION 'Informe a forma de pagamento';
  END IF;

  FOR v_pag IN SELECT * FROM jsonb_array_elements(p->'pagamentos') LOOP
    v_forma := v_pag->>'forma';
    v_valor := NULLIF(v_pag->>'valor', '')::numeric;
    v_troco := COALESCE(NULLIF(v_pag->>'troco', '')::numeric, 0);
    IF v_forma NOT IN ('Dinheiro','Pix','Cartão de Crédito','Cartão de Débito','Fiado') THEN
      RAISE EXCEPTION 'Forma de pagamento inválida';
    END IF;
    IF v_valor IS NULL OR v_valor <= 0 THEN RAISE EXCEPTION 'Valor de pagamento inválido'; END IF;
    IF v_troco < 0 OR (v_troco > 0 AND v_forma <> 'Dinheiro') THEN RAISE EXCEPTION 'Troco inválido'; END IF;
    IF v_forma = 'Fiado' AND v_cliente IS NULL THEN RAISE EXCEPTION 'Informe o cliente para vender fiado'; END IF;

    INSERT INTO public.vendas_pagamentos (venda_id, user_id, forma_pagamento_nome, valor, troco, bandeira, parcelas)
    VALUES (v_venda, v_uid, v_forma, v_valor, v_troco,
            NULLIF(btrim(COALESCE(v_pag->>'bandeira', '')), ''), NULLIF(v_pag->>'parcelas', '')::smallint);
    v_soma_pag := v_soma_pag + v_valor;

    IF v_forma = 'Fiado' THEN
      INSERT INTO public.contas_receber
        (user_id, cliente_id, descricao, valor_total, num_parcelas, data_primeira_parcela, status, origem, venda_id)
      VALUES (v_uid, v_cliente, 'Venda PDV Nº ' || v_numero || ' (Fiado)', v_valor, 1, v_venc_fiado, 'aberto', 'fiado', v_venda)
      RETURNING id INTO v_conta;
      INSERT INTO public.parcelas_receber
        (conta_receber_id, user_id, numero_parcela, total_parcelas, valor, data_vencimento, status)
      VALUES (v_conta, v_uid, 1, 1, v_valor, v_venc_fiado, 'aberto');
    END IF;
  END LOOP;

  IF abs(v_soma_pag - v_total) > 0.005 THEN
    RAISE EXCEPTION 'A soma dos pagamentos (%) é diferente do total da venda (%)', v_soma_pag, v_total;
  END IF;

  UPDATE public.vendas
     SET status = 'concluida', identificador_espera = NULL, subtotal = v_subtotal, desconto = v_desc_ger, total = v_total
   WHERE id = v_venda;

  RETURN jsonb_build_object('venda_id', v_venda, 'numero', v_numero, 'total', v_total);
END;
$$;

-- 5) Cancelar venda concluída ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.intro_cancelar_venda(p_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_venda record;
  v_vil   record;
  v_lote  record;
  v_prod  record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN RAISE EXCEPTION 'Informe o motivo do cancelamento'; END IF;

  SELECT * INTO v_venda FROM public.vendas WHERE id = p_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;
  IF v_venda.status <> 'concluida' THEN RAISE EXCEPTION 'Só é possível cancelar vendas concluídas'; END IF;

  IF EXISTS (SELECT 1 FROM public.venda_item_lotes WHERE venda_id = p_id AND acerto_id IS NOT NULL AND NOT cancelado) THEN
    RAISE EXCEPTION 'Esta venda já entrou em um acerto com o fornecedor e não pode ser cancelada';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.parcelas_receber pr
      JOIN public.contas_receber cr ON cr.id = pr.conta_receber_id
     WHERE cr.venda_id = p_id AND cr.user_id = v_uid AND pr.status = 'recebido'
  ) THEN
    RAISE EXCEPTION 'O fiado desta venda já foi recebido. Estorne o recebimento antes de cancelar';
  END IF;

  FOR v_vil IN SELECT * FROM public.venda_item_lotes WHERE venda_id = p_id AND NOT cancelado LOOP
    SELECT status INTO v_lote FROM public.lotes_estoque WHERE id = v_vil.lote_id FOR UPDATE;
    IF v_lote.status IN ('estornado','devolvido') THEN
      RAISE EXCEPTION 'Um lote desta venda já foi estornado ou devolvido; ajuste manualmente';
    END IF;
    UPDATE public.lotes_estoque
       SET qtd_saldo = qtd_saldo + v_vil.quantidade, status = 'ativo'
     WHERE id = v_vil.lote_id;
    SELECT p2.id, p2.codigo, p2.descricao INTO v_prod
      FROM public.vendas_itens vi JOIN public.produtos_fiscais p2 ON p2.id = vi.produto_id
     WHERE vi.id = v_vil.venda_item_id;
    UPDATE public.produtos_fiscais SET estoque = estoque + v_vil.quantidade WHERE id = v_prod.id;
    INSERT INTO public.movimentos_estoque
      (user_id, produto_id, produto_codigo, produto_nome, tipo, quantidade, motivo, nf_referencia, data)
    VALUES (v_uid, v_prod.id, v_prod.codigo, v_prod.descricao, 'entrada', v_vil.quantidade,
            'Cancelamento da venda Nº ' || v_venda.numero_sequencial, v_venda.numero_sequencial, now());
  END LOOP;
  UPDATE public.venda_item_lotes SET cancelado = true WHERE venda_id = p_id;

  UPDATE public.parcelas_receber SET status = 'cancelado'
   WHERE conta_receber_id IN (SELECT id FROM public.contas_receber WHERE venda_id = p_id AND user_id = v_uid);
  UPDATE public.contas_receber SET status = 'cancelado' WHERE venda_id = p_id AND user_id = v_uid;

  UPDATE public.vendas
     SET status = 'cancelada', cancelada_motivo = btrim(p_motivo), cancelada_por = v_uid, cancelada_em = now()
   WHERE id = p_id;
END;
$$;
