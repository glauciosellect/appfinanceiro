-- ============================================================
-- ORÇAMENTO: campos extras (título, condições de pagamento, garantia, informações)
-- ============================================================
-- Arquivo standalone (mesma convenção de schema_orcamento_pdf.sql):
-- rode isoladamente no SQL Editor do Supabase.
--
-- Campos livres usados no PDF do orçamento, inspirados no modelo de
-- referência do app antigo do usuário (número + título/assunto livre,
-- ex.: "Orçamento 012-2026 / CFTV"; seção de Pagamento com condições;
-- seção de garantia; observações adicionais no rodapé do documento).
-- ============================================================

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS titulo TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS condicoes_pagamento TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS garantia TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS informacoes_adicionais TEXT;
