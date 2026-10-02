-- ============================================================
-- SYNCROMONEY INTRO — Fase 8 (movimentação financeira + ajuste de estoque)
-- ============================================================
-- Arquivo standalone: rode isoladamente no SQL Editor do Supabase, DEPOIS das
-- fases 1 a 7. Idempotente.
--
--   1) intro_relatorio ganha 3 relatórios: contas_pagas, contas_recebidas e
--      movimentacao_financeira (entradas e saídas do período). Só leitura.
--   2) intro_ajustar_estoque_produto: ajusta o estoque de UM produto para a quantidade
--      contada. Se o saldo está negativo (vendas feitas sem estoque), o ajuste
--      regulariza essas vendas; se sobra quantidade, entra como lote de ajuste.
--   3) lotes_estoque.origem passa a aceitar 'ajuste'.
-- SECURITY INVOKER: RLS do usuário logado + auth.uid().
-- ============================================================

-- 3) origem 'ajuste'
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.lotes_estoque'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%origem%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.lotes_estoque DROP CONSTRAINT %I', c); END IF;
  ALTER TABLE public.lotes_estoque ADD CONSTRAINT lotes_estoque_origem_check CHECK (origem IN ('entrada','troca','ajuste'));
END $$;

-- 2) Ajuste de estoque por produto
-- p_nova: quantidade que existe de fato agora (>= 0). Devolve o novo saldo.
-- p_fornecedor: de quem é o estoque que está ENTRANDO (só usado se sobrar quantidade
--   depois de regularizar as vendas sem estoque); se vazio, usa o do último lote.
CREATE OR REPLACE FUNCTION public.intro_ajustar_estoque_produto(
  p_produto uuid, p_nova numeric, p_motivo text, p_fornecedor uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_prod  record;
  v_lotes numeric;
  v_pend  numeric;
  v_atual numeric;
  v_delta numeric;
  v_rest  numeric;
  v_take  numeric;
  v_pe    record;
  v_lote  record;
  v_forn  uuid;
  v_custo numeric;
  v_ult_forn  uuid;
  v_ult_custo numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN RAISE EXCEPTION 'Informe o motivo do ajuste'; END IF;
  IF p_nova IS NULL OR p_nova < 0 THEN RAISE EXCEPTION 'A quantidade não pode ser negativa'; END IF;

  SELECT id, codigo, descricao, preco_custo INTO v_prod FROM public.produtos_fiscais
   WHERE id = p_produto AND user_id = v_uid AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;

  SELECT COALESCE(sum(qtd_saldo), 0) INTO v_lotes FROM public.lotes_estoque
   WHERE user_id = v_uid AND produto_id = p_produto AND status = 'ativo' AND qtd_saldo > 0;
  SELECT COALESCE(sum(pendente), 0) INTO v_pend FROM public.vendas_sem_estoque
   WHERE user_id = v_uid AND produto_id = p_produto AND pendente > 0;
  v_atual := v_lotes - v_pend;
  v_delta := p_nova - v_atual;
  IF v_delta = 0 THEN RETURN v_atual; END IF;

  IF v_delta > 0 THEN
    v_rest := v_delta;
    -- 1) regulariza as vendas feitas sem estoque (as mais antigas primeiro)
    FOR v_pe IN SELECT id, pendente FROM public.vendas_sem_estoque
                 WHERE user_id = v_uid AND produto_id = p_produto AND pendente > 0
                 ORDER BY created_at, id FOR UPDATE
    LOOP
      EXIT WHEN v_rest <= 0;
      v_take := LEAST(v_pe.pendente, v_rest);
      UPDATE public.vendas_sem_estoque SET pendente = pendente - v_take WHERE id = v_pe.id;
      v_rest := v_rest - v_take;
    END LOOP;

    -- 2) o que sobrar entra como estoque (lote de ajuste, próprio)
    IF v_rest > 0 THEN
      -- último lote do produto: fornecedor e custo usados quando nada foi informado
      SELECT l.fornecedor_id, l.custo_unitario INTO v_ult_forn, v_ult_custo
        FROM public.lotes_estoque l WHERE l.user_id = v_uid AND l.produto_id = p_produto
       ORDER BY l.created_at DESC LIMIT 1;
      v_forn := COALESCE(p_fornecedor, v_ult_forn);
      IF v_forn IS NULL THEN RAISE EXCEPTION 'Informe o fornecedor do estoque que está entrando'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.fornecedores WHERE id = v_forn AND user_id = v_uid) THEN
        RAISE EXCEPTION 'Fornecedor inválido';
      END IF;
      v_custo := COALESCE(v_ult_custo, v_prod.preco_custo, 0);
      INSERT INTO public.lotes_estoque
        (user_id, produto_id, fornecedor_id, origem, consignado, custo_unitario, validade, qtd_inicial, qtd_saldo)
      VALUES (v_uid, p_produto, v_forn, 'ajuste', false, v_custo, NULL, v_rest, v_rest);
    END IF;

  ELSE
    -- reduz o estoque real (perda, quebra, contagem): sai pela mesma ordem das vendas
    v_rest := -v_delta;
    IF v_rest > v_lotes THEN
      RAISE EXCEPTION 'Não há saldo suficiente nos lotes para reduzir tanto';
    END IF;
    FOR v_lote IN SELECT id, qtd_saldo FROM public.lotes_estoque
                   WHERE user_id = v_uid AND produto_id = p_produto AND status = 'ativo' AND qtd_saldo > 0
                   ORDER BY validade NULLS LAST, consignado DESC, created_at FOR UPDATE
    LOOP
      EXIT WHEN v_rest <= 0;
      v_take := LEAST(v_lote.qtd_saldo, v_rest);
      UPDATE public.lotes_estoque
         SET qtd_saldo = qtd_saldo - v_take, status = CASE WHEN qtd_saldo - v_take = 0 THEN 'esgotado' ELSE status END
       WHERE id = v_lote.id;
      v_rest := v_rest - v_take;
    END LOOP;
  END IF;

  UPDATE public.produtos_fiscais SET estoque = estoque + v_delta WHERE id = p_produto;
  INSERT INTO public.movimentos_estoque
    (user_id, produto_id, produto_codigo, produto_nome, tipo, quantidade, motivo, data)
  VALUES (v_uid, p_produto, v_prod.codigo, v_prod.descricao,
          CASE WHEN v_delta > 0 THEN 'entrada' ELSE 'saida' END, abs(v_delta),
          'Ajuste de estoque: ' || btrim(p_motivo), now());

  RETURN p_nova;
END;
$$;

-- 1) Relatórios (substitui a função da fase 5, mantendo os relatórios existentes)
CREATE OR REPLACE FUNCTION public.intro_relatorio(p_tipo text, p_ini date, p_fim date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_res jsonb;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_ini IS NULL OR p_fim IS NULL OR p_fim < p_ini THEN RAISE EXCEPTION 'Período inválido'; END IF;

  IF p_tipo = 'vendas_periodo' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.data DESC), '[]'::jsonb) INTO v_res FROM (
      SELECT v.numero_sequencial AS numero,
             to_char(v.created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI') AS data,
             COALESCE(c.nome, '') AS cliente,
             COALESCE((SELECT string_agg(vp.forma_pagamento_nome, ' + ' ORDER BY vp.forma_pagamento_nome)
                         FROM public.vendas_pagamentos vp WHERE vp.venda_id = v.id), '') AS formas,
             v.total
        FROM public.vendas v LEFT JOIN public.clientes c ON c.id = v.cliente_id
       WHERE v.user_id = v_uid AND v.status = 'concluida'
         AND (v.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_ini AND p_fim
    ) t;

  ELSIF p_tipo = 'vendas_forma' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.total DESC), '[]'::jsonb) INTO v_res FROM (
      SELECT vp.forma_pagamento_nome AS forma, count(*) AS lancamentos, sum(vp.valor) AS total
        FROM public.vendas_pagamentos vp JOIN public.vendas v ON v.id = vp.venda_id
       WHERE v.user_id = v_uid AND v.status = 'concluida'
         AND (v.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_ini AND p_fim
       GROUP BY vp.forma_pagamento_nome
    ) t;

  ELSIF p_tipo = 'vendas_produto' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.vendido DESC), '[]'::jsonb) INTO v_res FROM (
      SELECT vi.nome_produto AS produto, sum(vi.quantidade) AS quantidade, sum(vi.subtotal) AS vendido,
             round(COALESCE(sum(c.custo), 0), 2) AS custo,
             round(sum(vi.subtotal) - COALESCE(sum(c.custo), 0), 2) AS lucro
        FROM public.vendas_itens vi
        JOIN public.vendas v ON v.id = vi.venda_id
        LEFT JOIN LATERAL (SELECT sum(vil.quantidade * vil.custo_unitario) AS custo
                             FROM public.venda_item_lotes vil WHERE vil.venda_item_id = vi.id AND NOT vil.cancelado) c ON true
       WHERE v.user_id = v_uid AND v.status = 'concluida'
         AND (v.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_ini AND p_fim
       GROUP BY vi.produto_id, vi.nome_produto
    ) t;

  ELSIF p_tipo = 'vendas_fornecedor' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.vendido DESC), '[]'::jsonb) INTO v_res FROM (
      SELECT f.nome AS fornecedor, sum(vil.quantidade) AS quantidade,
             round(sum(vil.quantidade * (vi.subtotal / vi.quantidade)), 2) AS vendido,
             round(sum(vil.quantidade * vil.custo_unitario), 2) AS custo,
             round(sum(vil.quantidade * (vi.subtotal / vi.quantidade)) - sum(vil.quantidade * vil.custo_unitario), 2) AS lucro
        FROM public.venda_item_lotes vil
        JOIN public.vendas v ON v.id = vil.venda_id
        JOIN public.vendas_itens vi ON vi.id = vil.venda_item_id
        JOIN public.fornecedores f ON f.id = vil.fornecedor_id
       WHERE vil.user_id = v_uid AND NOT vil.cancelado AND v.status = 'concluida'
         AND (v.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_ini AND p_fim
       GROUP BY f.id, f.nome
    ) t;

  ELSIF p_tipo = 'estoque_fornecedor' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.fornecedor), '[]'::jsonb) INTO v_res FROM (
      SELECT f.nome AS fornecedor, sum(l.qtd_saldo) AS unidades,
             sum(l.qtd_saldo) FILTER (WHERE l.consignado) AS consignado,
             round(sum(l.qtd_saldo * l.custo_unitario), 2) AS valor_custo,
             round(sum(l.qtd_saldo * pf.preco_venda), 2) AS valor_venda
        FROM public.lotes_estoque l
        JOIN public.fornecedores f ON f.id = l.fornecedor_id
        JOIN public.produtos_fiscais pf ON pf.id = l.produto_id
       WHERE l.user_id = v_uid AND l.qtd_saldo > 0 AND l.status = 'ativo'
       GROUP BY f.id, f.nome
    ) t;

  ELSIF p_tipo = 'validade' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.validade), '[]'::jsonb) INTO v_res FROM (
      SELECT pf.descricao AS produto, f.nome AS fornecedor, to_char(l.validade, 'YYYY-MM-DD') AS validade,
             l.qtd_saldo AS saldo, CASE WHEN l.consignado THEN 'Consignado' ELSE 'Próprio' END AS tipo,
             (l.validade - v_hoje) AS dias
        FROM public.lotes_estoque l
        JOIN public.produtos_fiscais pf ON pf.id = l.produto_id
        JOIN public.fornecedores f ON f.id = l.fornecedor_id
       WHERE l.user_id = v_uid AND l.qtd_saldo > 0 AND l.status = 'ativo'
         AND l.validade IS NOT NULL AND l.validade <= p_fim
    ) t;

  ELSIF p_tipo = 'caixa_fechamentos' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.fechamento DESC), '[]'::jsonb) INTO v_res FROM (
      SELECT to_char(s.aberto_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI') AS abertura,
             to_char(s.fechado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI') AS fechamento,
             s.operador, s.fundo_troco_inicial AS troco_inicial,
             s.saldo_esperado AS esperado, s.saldo_contado AS contado, s.diferenca
        FROM public.caixa_sessoes s
       WHERE s.user_id = v_uid AND s.status = 'fechado'
         AND (s.fechado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_ini AND p_fim
    ) t;

  ELSIF p_tipo = 'acertos' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.numero DESC), '[]'::jsonb) INTO v_res FROM (
      SELECT a.numero, f.nome AS fornecedor,
             to_char(a.periodo_ini, 'DD/MM/YYYY') || ' a ' || to_char(a.periodo_fim, 'DD/MM/YYYY') AS periodo,
             a.total_vendido AS vendido, a.total_repasse AS a_receber,
             CASE a.status WHEN 'recebido' THEN 'Recebido' WHEN 'enviado' THEN 'Aguardando fornecedor' ELSE 'Cancelado' END AS situacao
        FROM public.acertos_fornecedor a JOIN public.fornecedores f ON f.id = a.fornecedor_id
       WHERE a.user_id = v_uid
         AND (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_ini AND p_fim
    ) t;

  ELSIF p_tipo = 'contas_pagas' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.pago_em DESC, t.fornecedor), '[]'::jsonb) INTO v_res FROM (
      SELECT to_char(pp.data_pagamento, 'YYYY-MM-DD') AS pago_em,
             to_char(pp.data_vencimento, 'YYYY-MM-DD') AS vencimento,
             COALESCE(f.nome, '') AS fornecedor,
             cp.descricao || CASE WHEN pp.total_parcelas > 1 THEN ' (' || pp.numero_parcela || '/' || pp.total_parcelas || ')' ELSE '' END AS descricao,
             CASE cp.origem WHEN 'entrada' THEN 'Entrada de mercadoria' WHEN 'consignado' THEN 'Acerto de consignação' ELSE 'Lançamento manual' END AS origem,
             COALESCE(pp.valor_pago, pp.valor) AS valor
        FROM public.parcelas_pagar pp
        JOIN public.contas_pagar cp ON cp.id = pp.conta_pagar_id
        LEFT JOIN public.fornecedores f ON f.id = cp.fornecedor_id
       WHERE pp.user_id = v_uid AND pp.status = 'pago' AND cp.deleted_at IS NULL
         AND pp.data_pagamento BETWEEN p_ini AND p_fim
    ) t;

  ELSIF p_tipo = 'contas_recebidas' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.recebido_em DESC, t.cliente), '[]'::jsonb) INTO v_res FROM (
      SELECT to_char(pr.data_recebimento, 'YYYY-MM-DD') AS recebido_em,
             to_char(pr.data_vencimento, 'YYYY-MM-DD') AS vencimento,
             COALESCE(c.nome, '') AS cliente,
             cr.descricao || CASE WHEN pr.total_parcelas > 1 THEN ' (' || pr.numero_parcela || '/' || pr.total_parcelas || ')' ELSE '' END AS descricao,
             CASE cr.origem WHEN 'fiado' THEN 'Fiado (venda)' ELSE 'Lançamento manual' END AS origem,
             COALESCE(pr.valor_recebido, pr.valor) AS valor
        FROM public.parcelas_receber pr
        JOIN public.contas_receber cr ON cr.id = pr.conta_receber_id
        LEFT JOIN public.clientes c ON c.id = cr.cliente_id
       WHERE pr.user_id = v_uid AND pr.status = 'recebido' AND cr.deleted_at IS NULL
         AND pr.data_recebimento BETWEEN p_ini AND p_fim
    ) t;

  ELSIF p_tipo = 'movimentacao_financeira' THEN
    -- Entradas: vendas recebidas na hora (fiado só entra quando for recebido) e recebimentos de contas.
    -- Saídas: contas pagas (compras à vista ou a prazo, acertos de consignação, despesas).
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.data DESC, t.tipo, t.historico), '[]'::jsonb) INTO v_res FROM (
      SELECT to_char((v.created_at AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD') AS data,
             'Entrada' AS tipo,
             'Venda Nº ' || v.numero_sequencial || ' - ' || vp.forma_pagamento_nome AS historico,
             COALESCE(c.nome, '') AS pessoa,
             vp.valor AS entrada, 0::numeric AS saida
        FROM public.vendas_pagamentos vp
        JOIN public.vendas v ON v.id = vp.venda_id
        LEFT JOIN public.clientes c ON c.id = v.cliente_id
       WHERE v.user_id = v_uid AND v.status = 'concluida' AND vp.forma_pagamento_nome <> 'Fiado'
         AND (v.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_ini AND p_fim
      UNION ALL
      SELECT to_char(pr.data_recebimento, 'YYYY-MM-DD'), 'Entrada',
             'Recebimento - ' || cr.descricao || CASE WHEN pr.total_parcelas > 1 THEN ' (' || pr.numero_parcela || '/' || pr.total_parcelas || ')' ELSE '' END,
             COALESCE(c.nome, ''), COALESCE(pr.valor_recebido, pr.valor), 0::numeric
        FROM public.parcelas_receber pr
        JOIN public.contas_receber cr ON cr.id = pr.conta_receber_id
        LEFT JOIN public.clientes c ON c.id = cr.cliente_id
       WHERE pr.user_id = v_uid AND pr.status = 'recebido' AND cr.deleted_at IS NULL
         AND pr.data_recebimento BETWEEN p_ini AND p_fim
      UNION ALL
      SELECT to_char(pp.data_pagamento, 'YYYY-MM-DD'), 'Saída',
             'Pagamento - ' || cp.descricao || CASE WHEN pp.total_parcelas > 1 THEN ' (' || pp.numero_parcela || '/' || pp.total_parcelas || ')' ELSE '' END,
             COALESCE(f.nome, ''), 0::numeric, COALESCE(pp.valor_pago, pp.valor)
        FROM public.parcelas_pagar pp
        JOIN public.contas_pagar cp ON cp.id = pp.conta_pagar_id
        LEFT JOIN public.fornecedores f ON f.id = cp.fornecedor_id
       WHERE pp.user_id = v_uid AND pp.status = 'pago' AND cp.deleted_at IS NULL
         AND pp.data_pagamento BETWEEN p_ini AND p_fim
    ) t;

  ELSE
    RAISE EXCEPTION 'Relatório inválido';
  END IF;

  RETURN v_res;
END;
$$;
