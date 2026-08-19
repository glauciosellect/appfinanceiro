-- ============================================================
-- CAIXA <-> CONTA CORRENTE (link opcional de sessão de caixa a uma
-- conta corrente para recebimento de vendas em dinheiro/pix/débito)
-- ============================================================
-- Arquivo standalone (assim como schema_caixa.sql, schema_novas_tabelas.sql,
-- schema_orcamento_pdf.sql e schema_unificar_produtos.sql): rode este
-- arquivo isoladamente no SQL Editor do Supabase.
--
-- Conteúdo:
--   1) caixa_sessoes.conta_corrente_id — FK opcional (nullable) para
--      contas_correntes, indicando qual conta recebe o crédito de vendas
--      PDV pagas em dinheiro/pix/cartão de débito (pagamento "à vista") ao
--      concluir a venda. Uma sessão de caixa sem conta vinculada continua
--      funcionando normalmente: os lançamentos de contas_receber/
--      parcelas_receber ainda são criados, apenas sem conta_corrente_id e
--      sem crédito automático em movimentacoes_conta.
-- ============================================================

ALTER TABLE public.caixa_sessoes
  ADD COLUMN IF NOT EXISTS conta_corrente_id UUID REFERENCES public.contas_correntes(id) ON DELETE SET NULL;
