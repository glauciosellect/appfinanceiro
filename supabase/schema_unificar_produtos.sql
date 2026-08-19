-- ============================================================
-- UNIFICAÇÃO DE CATÁLOGO DE PRODUTOS: produtos_fiscais <- produtos
-- ============================================================
-- Arquivo standalone (assim como schema_novas_tabelas.sql e
-- schema_orcamento_pdf.sql): rode este arquivo isoladamente no SQL
-- Editor do Supabase.
--
-- Contexto: existiam dois conceitos de "produto" no banco:
--   1) produtos_fiscais — catálogo fiscal usado pela emissão de NF-e e
--      pela importação de XML (colunas fiscais: ncm, cfop, codigo, etc.)
--   2) produtos — tabela standalone criada para alimentar Orçamento/PDV
--      (colunas: nome, barcode, plu, preco_custo, preco_unitario, etc.)
--
-- Decisão: unificar em produtos_fiscais, que passa a ser a ÚNICA fonte
-- de verdade de produtos no sistema. Para isso:
--   - renomeia produtos_fiscais.preco_unitario -> preco_custo (alinha o
--     nome ao seu significado real: era o CUSTO, não o preço de venda —
--     produtos_fiscais já tinha uma coluna separada preco_venda)
--   - adiciona barcode, plu, deleted_at (paridade com a tabela produtos)
--   - adiciona trigger de updated_at (já existia gerenciado manualmente
--     no código da aplicação; agora é automático via trigger, como em
--     todas as outras tabelas do schema)
--   - repointa a FK de vendas_itens.produto_id para produtos_fiscais
--
-- A tabela standalone `produtos` é DEPRECADA (mantida por segurança,
-- não é dropada) e a partir de agora não é mais escrita pela aplicação.
-- ============================================================

-- ----------------------------------------------------------------
-- 1) Renomeia produtos_fiscais.preco_unitario -> preco_custo
-- ----------------------------------------------------------------
-- Guard idempotente: um RENAME COLUMN direto quebraria em uma segunda
-- execução deste arquivo (a coluna preco_unitario já não existiria mais).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'produtos_fiscais'
      AND column_name = 'preco_unitario'
  ) THEN
    ALTER TABLE public.produtos_fiscais RENAME COLUMN preco_unitario TO preco_custo;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 2) Novas colunas: paridade com a tabela produtos (barcode, plu, soft delete)
-- ----------------------------------------------------------------
ALTER TABLE public.produtos_fiscais ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.produtos_fiscais ADD COLUMN IF NOT EXISTS plu TEXT;
ALTER TABLE public.produtos_fiscais ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_produtos_fiscais_barcode ON public.produtos_fiscais(user_id, barcode) WHERE barcode IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uidx_produtos_fiscais_plu     ON public.produtos_fiscais(user_id, plu)     WHERE plu IS NOT NULL;

-- ----------------------------------------------------------------
-- 3) Trigger de updated_at (função update_updated_at_column() já existe,
--    definida em schema.sql — não redefinida aqui)
-- ----------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_produtos_fiscais_updated_at ON public.produtos_fiscais;
CREATE TRIGGER trg_produtos_fiscais_updated_at
  BEFORE UPDATE ON public.produtos_fiscais
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------
-- 4) Repointa vendas_itens.produto_id para produtos_fiscais
-- ----------------------------------------------------------------
-- A FK original apontava para public.produtos(id). Como o PDV passa a
-- buscar produtos em produtos_fiscais, novas vendas inserem
-- produtos_fiscais.id em vendas_itens.produto_id — a FK precisa apontar
-- para a nova tabela de origem.
ALTER TABLE public.vendas_itens DROP CONSTRAINT IF EXISTS vendas_itens_produto_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'vendas_itens' AND constraint_name = 'vendas_itens_produto_id_fkey'
  ) THEN
    ALTER TABLE public.vendas_itens
      ADD CONSTRAINT vendas_itens_produto_id_fkey
      FOREIGN KEY (produto_id) REFERENCES public.produtos_fiscais(id) ON DELETE RESTRICT;
  END IF;
END $$;
