-- ============================================================
-- SYNCROMONEY INTRO — Fase 6 (venda sem estoque)
-- ============================================================
-- Arquivo standalone: rode isoladamente no SQL Editor do Supabase, DEPOIS das
-- fases 1 a 5. Idempotente.
--
-- O que muda:
--   1) Vender sem estoque passa a ser permitido. O saldo do produto fica negativo
--      e a quantidade vendida fica "pendente de lote" em vendas_sem_estoque.
--   2) Quando a mercadoria chega (entrada), ela COBRE as vendas pendentes, das mais
--      antigas para as mais novas: o lote novo vira a origem dessas vendas, com o
--      fornecedor e o custo da entrada. Assim o repasse do consignado fica correto.
--   3) Cancelar uma venda devolve ao saldo a parte que ainda estava sem lote.
--
-- Substitui (CREATE OR REPLACE) intro_salvar_venda, intro_cancelar_venda e
-- intro_registrar_entrada, mantendo o resto do comportamento. A venda passa a
-- devolver também a lista "sem_estoque" (produto e quantidade vendidos sem saldo).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vendas_sem_estoque (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venda_id       UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  venda_item_id  UUID NOT NULL REFERENCES public.vendas_itens(id) ON DELETE CASCADE,
  produto_id     UUID NOT NULL REFERENCES public.produtos_fiscais(id) ON DELETE RESTRICT,
  quantidade     NUMERIC(12,3) NOT NULL CHECK (quantidade > 0),   -- vendida sem lote
  pendente       NUMERIC(12,3) NOT NULL CHECK (pendente >= 0),    -- ainda sem lote
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vse_pendente ON public.vendas_sem_estoque(user_id, produto_id, created_at) WHERE pendente > 0;
CREATE INDEX IF NOT EXISTS idx_vse_venda ON public.vendas_sem_estoque(venda_id);

ALTER TABLE public.vendas_sem_estoque ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendas_sem_estoque_all_own" ON public.vendas_sem_estoque;
CREATE POLICY "vendas_sem_estoque_all_own" ON public.vendas_sem_estoque
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

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
  v_sem       jsonb := '[]'::jsonb;
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
        -- Venda sem estoque é permitida: o saldo do produto fica negativo e a quantidade
        -- fica pendente de lote. Quando a mercadoria chegar (entrada), ela cobre a pendência.
        INSERT INTO public.vendas_sem_estoque (user_id, venda_id, venda_item_id, produto_id, quantidade, pendente)
        VALUES (v_uid, v_venda, v_item_id, v_prod.id, v_rest, v_rest);
        v_sem := v_sem || jsonb_build_array(jsonb_build_object('produto', v_prod.descricao, 'quantidade', v_rest));
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

  RETURN jsonb_build_object('venda_id', v_venda, 'numero', v_numero, 'total', v_total, 'sem_estoque', v_sem);
END;
$$;

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
  v_pend  record;
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

  -- Parte vendida sem estoque que ainda não foi coberta por uma entrada: devolve ao saldo
  FOR v_pend IN SELECT * FROM public.vendas_sem_estoque WHERE venda_id = p_id AND user_id = v_uid AND pendente > 0 LOOP
    SELECT id, codigo, descricao INTO v_prod FROM public.produtos_fiscais WHERE id = v_pend.produto_id;
    UPDATE public.produtos_fiscais SET estoque = estoque + v_pend.pendente WHERE id = v_pend.produto_id;
    INSERT INTO public.movimentos_estoque
      (user_id, produto_id, produto_codigo, produto_nome, tipo, quantidade, motivo, nf_referencia, data)
    VALUES (v_uid, v_prod.id, v_prod.codigo, v_prod.descricao, 'entrada', v_pend.pendente,
            'Cancelamento da venda Nº ' || v_venda.numero_sequencial, v_venda.numero_sequencial, now());
  END LOOP;
  UPDATE public.vendas_sem_estoque SET pendente = 0 WHERE venda_id = p_id AND user_id = v_uid;

  UPDATE public.parcelas_receber SET status = 'cancelado'
   WHERE conta_receber_id IN (SELECT id FROM public.contas_receber WHERE venda_id = p_id AND user_id = v_uid);
  UPDATE public.contas_receber SET status = 'cancelado' WHERE venda_id = p_id AND user_id = v_uid;

  UPDATE public.vendas
     SET status = 'cancelada', cancelada_motivo = btrim(p_motivo), cancelada_por = v_uid, cancelada_em = now()
   WHERE id = p_id;
END;
$$;

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
  v_lote_novo uuid;
  v_saldo     numeric;
  v_take      numeric;
  v_pend      record;
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
      (v_uid, v_prod.id, v_forn, v_entrada, v_item_id, 'entrada', v_cond = 'consignado', v_custo, v_val, v_qtd, v_qtd)
    RETURNING id INTO v_lote_novo;

    -- Cobre vendas feitas sem estoque (as mais antigas primeiro): o lote novo passa a ser
    -- o de origem dessas vendas (com o fornecedor e o custo desta entrada).
    v_saldo := v_qtd;
    FOR v_pend IN
      SELECT id, venda_id, venda_item_id, pendente FROM public.vendas_sem_estoque
       WHERE user_id = v_uid AND produto_id = v_prod.id AND pendente > 0
       ORDER BY created_at, id
         FOR UPDATE
    LOOP
      EXIT WHEN v_saldo <= 0;
      v_take := LEAST(v_pend.pendente, v_saldo);
      INSERT INTO public.venda_item_lotes
        (user_id, venda_id, venda_item_id, lote_id, fornecedor_id, quantidade, custo_unitario, consignado)
      VALUES (v_uid, v_pend.venda_id, v_pend.venda_item_id, v_lote_novo, v_forn, v_take, v_custo, v_cond = 'consignado');
      UPDATE public.vendas_sem_estoque SET pendente = pendente - v_take WHERE id = v_pend.id;
      v_saldo := v_saldo - v_take;
    END LOOP;
    IF v_saldo <> v_qtd THEN
      UPDATE public.lotes_estoque
         SET qtd_saldo = v_saldo, status = CASE WHEN v_saldo = 0 THEN 'esgotado' ELSE 'ativo' END
       WHERE id = v_lote_novo;
    END IF;

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
