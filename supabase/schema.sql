-- ============================================================
-- MINHAS FINANÇAS — Supabase Schema
-- Execute este SQL no SQL Editor do seu projeto Supabase
-- ============================================================

-- Tabela de transações
CREATE TABLE IF NOT EXISTS public.transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  category    TEXT NOT NULL,
  date        DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Usuário só vê suas próprias transações
CREATE POLICY "transactions_select_own"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Usuário só insere transações para si mesmo
CREATE POLICY "transactions_insert_own"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Usuário só atualiza suas próprias transações
CREATE POLICY "transactions_update_own"
  ON public.transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Usuário só deleta suas próprias transações
CREATE POLICY "transactions_delete_own"
  ON public.transactions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- Dados de exemplo (opcional — remova em produção)
-- ============================================================
-- INSERT INTO public.transactions (user_id, type, amount, description, category, date)
-- VALUES
--   (auth.uid(), 'income',  5000.00, 'Salário',         'salary',    CURRENT_DATE - INTERVAL '5 days'),
--   (auth.uid(), 'expense', 1200.00, 'Aluguel',          'housing',   CURRENT_DATE - INTERVAL '4 days'),
--   (auth.uid(), 'expense',  350.00, 'Supermercado',     'food',      CURRENT_DATE - INTERVAL '3 days'),
--   (auth.uid(), 'expense',  180.00, 'Conta de luz/água','bills',     CURRENT_DATE - INTERVAL '2 days'),
--   (auth.uid(), 'expense',   90.00, 'Uber',             'transport', CURRENT_DATE - INTERVAL '1 day'),
--   (auth.uid(), 'income',   800.00, 'Freelance',        'freelance', CURRENT_DATE);
