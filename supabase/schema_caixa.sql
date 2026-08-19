-- ============================================================
-- CAIXA (sessão de caixa do PDV) — Módulo 2 do spec do PDV
-- ============================================================
-- Arquivo standalone (assim como schema_novas_tabelas.sql,
-- schema_orcamento_pdf.sql e schema_unificar_produtos.sql): rode este
-- arquivo isoladamente no SQL Editor do Supabase.
--
-- Conteúdo:
--   1) caixa_sessoes — abertura/fechamento de sessão de caixa (operador,
--      fundo de troco, saldo esperado x contado x diferença)
--   2) caixa_movimentacoes — sangria (retirada) e suprimento (entrada) de
--      dinheiro fora de venda; append-only, sem policy de update/delete —
--      correções são um novo lançamento reverso via estorno_de_id
--   3) FK real em vendas.caixa_sessao_id, que foi deixada "solta" (sem FK)
--      quando a tabela vendas foi criada, antecipando este módulo
-- ============================================================

CREATE TABLE IF NOT EXISTS public.caixa_sessoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operador            TEXT NOT NULL,
  fundo_troco_inicial NUMERIC(15,2) NOT NULL DEFAULT 0,
  aberto_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fechado_em          TIMESTAMPTZ,
  saldo_esperado      NUMERIC(15,2),
  saldo_contado       NUMERIC(15,2),
  diferenca           NUMERIC(15,2),
  status              TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','fechado')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_user_id ON public.caixa_sessoes(user_id);
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_status   ON public.caixa_sessoes(user_id, status);

ALTER TABLE public.caixa_sessoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "caixa_sessoes_select" ON public.caixa_sessoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "caixa_sessoes_insert" ON public.caixa_sessoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "caixa_sessoes_update" ON public.caixa_sessoes FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.caixa_movimentacoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caixa_sessao_id UUID NOT NULL REFERENCES public.caixa_sessoes(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('sangria','suprimento')),
  valor           NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  motivo          TEXT NOT NULL,
  criado_por      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estorno_de_id   UUID REFERENCES public.caixa_movimentacoes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_caixa_movimentacoes_sessao ON public.caixa_movimentacoes(caixa_sessao_id);
CREATE INDEX IF NOT EXISTS idx_caixa_movimentacoes_user_id ON public.caixa_movimentacoes(user_id);

ALTER TABLE public.caixa_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "caixa_movimentacoes_select" ON public.caixa_movimentacoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "caixa_movimentacoes_insert" ON public.caixa_movimentacoes FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Deliberadamente SEM policy de update/delete — sangria/suprimento são
-- append-only (RF04); correções são um novo lançamento reverso referenciando
-- estorno_de_id, nunca um update/delete do lançamento original.

-- Repoint de vendas.caixa_sessao_id para uma FK real agora que caixa_sessoes
-- existe (coluna deixada solta quando a tabela vendas foi criada, ver
-- schema_novas_tabelas.sql seção 20, antecipando este módulo).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'vendas' AND constraint_name = 'vendas_caixa_sessao_id_fkey'
  ) THEN
    ALTER TABLE public.vendas
      ADD CONSTRAINT vendas_caixa_sessao_id_fkey
      FOREIGN KEY (caixa_sessao_id) REFERENCES public.caixa_sessoes(id) ON DELETE SET NULL;
  END IF;
END $$;
