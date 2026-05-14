-- ============================================================
-- Módulo Fiscal Premium — Tabelas de Estoque
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Produtos cadastrados no sistema fiscal
CREATE TABLE IF NOT EXISTS public.produtos_fiscais (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo          TEXT NOT NULL,
  descricao       TEXT NOT NULL,
  ncm             TEXT NOT NULL DEFAULT '',
  cfop            TEXT NOT NULL DEFAULT '',
  unidade         TEXT NOT NULL DEFAULT 'UN',
  preco_unitario  NUMERIC(12,2) NOT NULL DEFAULT 0,
  estoque         NUMERIC(12,3) NOT NULL DEFAULT 0,
  estoque_minimo  NUMERIC(12,3) NOT NULL DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_produtos_fiscais_user_id ON public.produtos_fiscais(user_id);

ALTER TABLE public.produtos_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtos_fiscais_all_own"
  ON public.produtos_fiscais FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Movimentações de estoque (entradas e saídas por NF-e)
CREATE TABLE IF NOT EXISTS public.movimentos_estoque (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produto_id      UUID NOT NULL REFERENCES public.produtos_fiscais(id) ON DELETE CASCADE,
  produto_codigo  TEXT NOT NULL,
  produto_nome    TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  quantidade      NUMERIC(12,3) NOT NULL,
  motivo          TEXT NOT NULL,
  nf_referencia   TEXT,
  data            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimentos_estoque_user_id ON public.movimentos_estoque(user_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_estoque_produto_id ON public.movimentos_estoque(produto_id);

ALTER TABLE public.movimentos_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movimentos_estoque_all_own"
  ON public.movimentos_estoque FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
