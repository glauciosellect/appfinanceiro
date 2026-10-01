-- ============================================================
-- SYNCROMONEY INTRO — Fase 5 (dashboard e relatórios)
-- ============================================================
-- Arquivo standalone: rode isoladamente no SQL Editor do Supabase, DEPOIS das
-- fases 1 a 4. Idempotente. Ver SyncroMoney_SPEC_Intro.md (M9, M10).
--
-- Só leitura: não cria tabelas nem altera dados. Datas no fuso de São Paulo.
--   intro_dashboard()                       números do painel inicial
--   intro_relatorio(tipo, inicio, fim)      linhas de cada relatório
-- SECURITY INVOKER: RLS do usuário logado + auth.uid().
-- ============================================================

CREATE OR REPLACE FUNCTION public.intro_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_hoje    date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_ini_mes date := date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
  v_dias    int;
  v_r       jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT COALESCE(dias_alerta_validade, 15) INTO v_dias FROM public.intro_config WHERE user_id = v_uid;
  v_dias := COALESCE(v_dias, 15);

  WITH vd AS (
    SELECT v.id, v.total, (v.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS d
      FROM public.vendas v
     WHERE v.user_id = v_uid AND v.status = 'concluida'
       AND v.created_at >= (v_ini_mes - 7)::timestamp AT TIME ZONE 'America/Sao_Paulo'
  )
  SELECT jsonb_build_object(
    'hoje_total',  COALESCE((SELECT sum(total) FROM vd WHERE d = v_hoje), 0),
    'hoje_qtd',    (SELECT count(*) FROM vd WHERE d = v_hoje),
    'semana_total', COALESCE((SELECT sum(total) FROM vd WHERE d > v_hoje - 7), 0),
    'mes_total',   COALESCE((SELECT sum(total) FROM vd WHERE d >= v_ini_mes), 0),
    'mes_qtd',     (SELECT count(*) FROM vd WHERE d >= v_ini_mes),
    'vendas_7d',   (SELECT jsonb_agg(jsonb_build_object('data', g.d, 'total', COALESCE((SELECT sum(total) FROM vd WHERE vd.d = g.d), 0)) ORDER BY g.d)
                      FROM (SELECT (v_hoje - n)::date AS d FROM generate_series(0, 6) n) g)
  ) INTO v_r;

  v_r := v_r || jsonb_build_object(
    'por_forma_hoje', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('forma', t.forma, 'total', t.total) ORDER BY t.total DESC)
        FROM (SELECT vp.forma_pagamento_nome AS forma, sum(vp.valor) AS total
                FROM public.vendas_pagamentos vp JOIN public.vendas v ON v.id = vp.venda_id
               WHERE v.user_id = v_uid AND v.status = 'concluida'
                 AND (v.created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_hoje
               GROUP BY vp.forma_pagamento_nome) t), '[]'::jsonb),
    'caixa_aberto', EXISTS (SELECT 1 FROM public.caixa_sessoes WHERE user_id = v_uid AND status = 'aberto'),
    'a_pagar_vencido', COALESCE((SELECT sum(pp.valor) FROM public.parcelas_pagar pp JOIN public.contas_pagar cp ON cp.id = pp.conta_pagar_id
                                  WHERE cp.user_id = v_uid AND cp.status <> 'cancelado' AND cp.deleted_at IS NULL
                                    AND pp.status IN ('aberto','atrasado') AND pp.data_vencimento < v_hoje), 0),
    'a_pagar_7d', COALESCE((SELECT sum(pp.valor) FROM public.parcelas_pagar pp JOIN public.contas_pagar cp ON cp.id = pp.conta_pagar_id
                             WHERE cp.user_id = v_uid AND cp.status <> 'cancelado' AND cp.deleted_at IS NULL
                               AND pp.status IN ('aberto','atrasado') AND pp.data_vencimento BETWEEN v_hoje AND v_hoje + 7), 0),
    'a_receber_vencido', COALESCE((SELECT sum(pr.valor) FROM public.parcelas_receber pr JOIN public.contas_receber cr ON cr.id = pr.conta_receber_id
                                    WHERE cr.user_id = v_uid AND cr.status <> 'cancelado' AND cr.deleted_at IS NULL
                                      AND pr.status IN ('aberto','atrasado') AND pr.data_vencimento < v_hoje), 0),
    'a_receber_7d', COALESCE((SELECT sum(pr.valor) FROM public.parcelas_receber pr JOIN public.contas_receber cr ON cr.id = pr.conta_receber_id
                               WHERE cr.user_id = v_uid AND cr.status <> 'cancelado' AND cr.deleted_at IS NULL
                                 AND pr.status IN ('aberto','atrasado') AND pr.data_vencimento BETWEEN v_hoje AND v_hoje + 7), 0),
    'consignado_a_acertar', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('fornecedor_id', t.fornecedor_id, 'nome', t.nome, 'valor', t.valor) ORDER BY t.valor DESC)
        FROM (SELECT vil.fornecedor_id, f.nome, round(sum(vil.quantidade * vil.custo_unitario), 2) AS valor
                FROM public.venda_item_lotes vil JOIN public.fornecedores f ON f.id = vil.fornecedor_id
               WHERE vil.user_id = v_uid AND vil.consignado AND vil.acerto_id IS NULL AND NOT vil.cancelado
               GROUP BY vil.fornecedor_id, f.nome) t), '[]'::jsonb),
    'lotes_vencidos', (SELECT count(*) FROM public.lotes_estoque WHERE user_id = v_uid AND status = 'ativo' AND qtd_saldo > 0 AND validade < v_hoje),
    'lotes_vencendo', (SELECT count(*) FROM public.lotes_estoque WHERE user_id = v_uid AND status = 'ativo' AND qtd_saldo > 0
                          AND validade >= v_hoje AND validade <= v_hoje + v_dias),
    'dias_alerta', v_dias,
    'estoque_baixo', (SELECT count(*) FROM public.produtos_fiscais WHERE user_id = v_uid AND ativo AND deleted_at IS NULL
                          AND estoque_minimo > 0 AND estoque <= estoque_minimo),
    'mais_vendidos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('produto', t.produto, 'quantidade', t.quantidade, 'total', t.total) ORDER BY t.quantidade DESC)
        FROM (SELECT vi.nome_produto AS produto, sum(vi.quantidade) AS quantidade, sum(vi.subtotal) AS total
                FROM public.vendas_itens vi JOIN public.vendas v ON v.id = vi.venda_id
               WHERE v.user_id = v_uid AND v.status = 'concluida'
                 AND (v.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= v_ini_mes
               GROUP BY vi.produto_id, vi.nome_produto
               ORDER BY sum(vi.quantidade) DESC LIMIT 5) t), '[]'::jsonb)
  );

  RETURN v_r;
END;
$$;

-- Tipos: vendas_periodo | vendas_forma | vendas_produto | vendas_fornecedor |
--        estoque_fornecedor | validade | caixa_fechamentos | acertos
-- (estoque_fornecedor ignora o período; validade usa só a data final)
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

  ELSE
    RAISE EXCEPTION 'Relatório inválido';
  END IF;

  RETURN v_res;
END;
$$;
