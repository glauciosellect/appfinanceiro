-- ============================================================
-- ORÇAMENTO: nome do vendedor (aparece abaixo da data no documento)
-- ============================================================
-- Arquivo standalone (mesma convenção dos outros schema_orcamento_*.sql):
-- rode isoladamente no SQL Editor do Supabase. Idempotente.
-- get_orcamento_publico devolve to_jsonb(pedido), então o vendedor também
-- chega ao link público sem alterar a função.
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS vendedor TEXT;
