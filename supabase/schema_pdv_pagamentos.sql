-- ============================================================
-- PDV — Detalhes de pagamento em cartão (bandeira/parcelas) — complemento
-- do módulo PDV/Caixa (schema_caixa.sql)
-- ============================================================
-- Arquivo standalone (assim como schema_caixa.sql, schema_novas_tabelas.sql,
-- schema_orcamento_pdf.sql e schema_unificar_produtos.sql): rode este
-- arquivo isoladamente no SQL Editor do Supabase.
--
-- Conteúdo:
--   Adiciona colunas opcionais em vendas_pagamentos para registrar, apenas
--   para fins informativos/relatório (sem cálculo de taxas/deságio),
--   a bandeira e o número de parcelas quando a forma de pagamento é
--   cartão de crédito/débito. Nulas para Dinheiro/Pix/outras formas.
-- ============================================================

ALTER TABLE public.vendas_pagamentos ADD COLUMN IF NOT EXISTS bandeira TEXT;
ALTER TABLE public.vendas_pagamentos ADD COLUMN IF NOT EXISTS parcelas SMALLINT;
