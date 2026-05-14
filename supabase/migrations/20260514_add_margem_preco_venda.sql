-- Adiciona margem de lucro e preço de venda na tabela de produtos fiscais
ALTER TABLE public.produtos_fiscais
  ADD COLUMN IF NOT EXISTS margem_lucro  NUMERIC(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preco_venda   NUMERIC(12,2) NOT NULL DEFAULT 0;
