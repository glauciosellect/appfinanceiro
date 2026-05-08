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

-- ============================================================
-- FUNÇÃO UTILITÁRIA: atualiza updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. CLIENTES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clientes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  cpf_cnpj      TEXT,
  telefone      TEXT,
  email         TEXT,
  cep           TEXT,
  endereco      TEXT,
  numero        TEXT,
  complemento   TEXT,
  bairro        TEXT,
  cidade        TEXT,
  estado        CHAR(2),
  tipo          TEXT NOT NULL DEFAULT 'pessoa_fisica' CHECK (tipo IN ('pessoa_fisica', 'pessoa_juridica')),
  observacoes   TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clientes_user_id   ON public.clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_clientes_nome      ON public.clientes(user_id, nome);
CREATE INDEX IF NOT EXISTS idx_clientes_cpf_cnpj  ON public.clientes(user_id, cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_clientes_ativo     ON public.clientes(user_id, ativo);

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clientes_select" ON public.clientes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "clientes_insert" ON public.clientes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clientes_update" ON public.clientes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "clientes_delete" ON public.clientes FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 2. FORNECEDORES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  cpf_cnpj      TEXT,
  telefone      TEXT,
  email         TEXT,
  cep           TEXT,
  endereco      TEXT,
  numero        TEXT,
  complemento   TEXT,
  bairro        TEXT,
  cidade        TEXT,
  estado        CHAR(2),
  tipo          TEXT NOT NULL DEFAULT 'pessoa_juridica' CHECK (tipo IN ('pessoa_fisica', 'pessoa_juridica')),
  categoria     TEXT,
  observacoes   TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_user_id  ON public.fornecedores(user_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_nome     ON public.fornecedores(user_id, nome);
CREATE INDEX IF NOT EXISTS idx_fornecedores_ativo    ON public.fornecedores(user_id, ativo);

CREATE TRIGGER trg_fornecedores_updated_at
  BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fornecedores_select" ON public.fornecedores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fornecedores_insert" ON public.fornecedores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fornecedores_update" ON public.fornecedores FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "fornecedores_delete" ON public.fornecedores FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 3. CATEGORIAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categorias (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  tipo       TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa', 'ambos')),
  cor        TEXT NOT NULL DEFAULT '#6366f1',
  icone      TEXT NOT NULL DEFAULT '💰',
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categorias_user_id ON public.categorias(user_id);
CREATE INDEX IF NOT EXISTS idx_categorias_tipo    ON public.categorias(tipo);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categorias_select" ON public.categorias FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "categorias_insert" ON public.categorias FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categorias_update" ON public.categorias FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "categorias_delete" ON public.categorias FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 4. CENTROS DE CUSTO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.centros_custo (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  descricao  TEXT,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_centros_custo_user_id ON public.centros_custo(user_id);

ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "centros_custo_select" ON public.centros_custo FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "centros_custo_insert" ON public.centros_custo FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "centros_custo_update" ON public.centros_custo FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "centros_custo_delete" ON public.centros_custo FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 5. FORMAS DE PAGAMENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.formas_pagamento (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  tipo       TEXT NOT NULL CHECK (tipo IN (
               'dinheiro','pix','ted','doc','boleto',
               'cartao_credito','cartao_debito','cheque','outro')),
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_formas_pagamento_user_id ON public.formas_pagamento(user_id);

ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "formas_pagamento_select" ON public.formas_pagamento FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "formas_pagamento_insert" ON public.formas_pagamento FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "formas_pagamento_update" ON public.formas_pagamento FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "formas_pagamento_delete" ON public.formas_pagamento FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 6. CONTAS CORRENTES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contas_correntes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_apelido  TEXT NOT NULL,
  banco         TEXT NOT NULL,
  agencia       TEXT,
  conta         TEXT,
  digito        TEXT,
  tipo_conta    TEXT NOT NULL DEFAULT 'corrente'
                CHECK (tipo_conta IN ('corrente','poupanca','investimento','caixa')),
  saldo_inicial NUMERIC(15,2) NOT NULL DEFAULT 0,
  saldo_atual   NUMERIC(15,2) NOT NULL DEFAULT 0,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contas_correntes_user_id ON public.contas_correntes(user_id);
CREATE INDEX IF NOT EXISTS idx_contas_correntes_ativo   ON public.contas_correntes(user_id, ativo);

CREATE TRIGGER trg_contas_correntes_updated_at
  BEFORE UPDATE ON public.contas_correntes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.contas_correntes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contas_correntes_select" ON public.contas_correntes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "contas_correntes_insert" ON public.contas_correntes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contas_correntes_update" ON public.contas_correntes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "contas_correntes_delete" ON public.contas_correntes FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 7. CARTÕES DE CRÉDITO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cartoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conta_corrente_id   UUID REFERENCES public.contas_correntes(id) ON DELETE SET NULL,
  banco               TEXT NOT NULL,
  bandeira            TEXT NOT NULL CHECK (bandeira IN ('visa','mastercard','elo','amex','hipercard','outro')),
  nome_titular        TEXT NOT NULL,
  final_cartao        CHAR(4),
  limite_total        NUMERIC(15,2) NOT NULL DEFAULT 0,
  limite_disponivel   NUMERIC(15,2) NOT NULL DEFAULT 0,
  dia_vencimento      SMALLINT NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  melhor_dia_compra   SMALLINT NOT NULL CHECK (melhor_dia_compra BETWEEN 1 AND 31),
  ativo               BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cartoes_user_id ON public.cartoes(user_id);
CREATE INDEX IF NOT EXISTS idx_cartoes_ativo   ON public.cartoes(user_id, ativo);

CREATE TRIGGER trg_cartoes_updated_at
  BEFORE UPDATE ON public.cartoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.cartoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cartoes_select" ON public.cartoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cartoes_insert" ON public.cartoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cartoes_update" ON public.cartoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cartoes_delete" ON public.cartoes FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 8. CONTAS A RECEBER (master)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contas_receber (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id          UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  categoria_id        UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  forma_pagamento_id  UUID REFERENCES public.formas_pagamento(id) ON DELETE SET NULL,
  conta_corrente_id   UUID REFERENCES public.contas_correntes(id) ON DELETE SET NULL,
  descricao           TEXT NOT NULL,
  valor_total         NUMERIC(15,2) NOT NULL CHECK (valor_total > 0),
  valor_entrada       NUMERIC(15,2) NOT NULL DEFAULT 0,
  num_parcelas        SMALLINT NOT NULL DEFAULT 1 CHECK (num_parcelas BETWEEN 1 AND 60),
  juros_percentual    NUMERIC(5,2) NOT NULL DEFAULT 0,
  multa_percentual    NUMERIC(5,2) NOT NULL DEFAULT 0,
  desconto_valor      NUMERIC(15,2) NOT NULL DEFAULT 0,
  data_primeira_parcela DATE NOT NULL,
  observacoes         TEXT,
  status              TEXT NOT NULL DEFAULT 'aberto'
                      CHECK (status IN ('aberto','parcial','quitado','cancelado')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contas_receber_user_id    ON public.contas_receber(user_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente_id ON public.contas_receber(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_status     ON public.contas_receber(user_id, status);
CREATE INDEX IF NOT EXISTS idx_contas_receber_data       ON public.contas_receber(user_id, data_primeira_parcela);

CREATE TRIGGER trg_contas_receber_updated_at
  BEFORE UPDATE ON public.contas_receber
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contas_receber_select" ON public.contas_receber FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "contas_receber_insert" ON public.contas_receber FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contas_receber_update" ON public.contas_receber FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "contas_receber_delete" ON public.contas_receber FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 9. PARCELAS A RECEBER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parcelas_receber (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_receber_id    UUID NOT NULL REFERENCES public.contas_receber(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero_parcela      SMALLINT NOT NULL,
  total_parcelas      SMALLINT NOT NULL,
  valor               NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  valor_recebido      NUMERIC(15,2),
  data_vencimento     DATE NOT NULL,
  data_recebimento    DATE,
  juros               NUMERIC(15,2) NOT NULL DEFAULT 0,
  multa               NUMERIC(15,2) NOT NULL DEFAULT 0,
  desconto            NUMERIC(15,2) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'aberto'
                      CHECK (status IN ('aberto','recebido','atrasado','cancelado','entrada')),
  forma_pagamento_id  UUID REFERENCES public.formas_pagamento(id) ON DELETE SET NULL,
  conta_corrente_id   UUID REFERENCES public.contas_correntes(id) ON DELETE SET NULL,
  observacoes         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcelas_receber_user_id          ON public.parcelas_receber(user_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_receber_conta_receber_id ON public.parcelas_receber(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_receber_status           ON public.parcelas_receber(user_id, status);
CREATE INDEX IF NOT EXISTS idx_parcelas_receber_vencimento       ON public.parcelas_receber(user_id, data_vencimento);

CREATE TRIGGER trg_parcelas_receber_updated_at
  BEFORE UPDATE ON public.parcelas_receber
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.parcelas_receber ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parcelas_receber_select" ON public.parcelas_receber FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "parcelas_receber_insert" ON public.parcelas_receber FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "parcelas_receber_update" ON public.parcelas_receber FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "parcelas_receber_delete" ON public.parcelas_receber FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 10. CONTAS A PAGAR (master)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fornecedor_id       UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  categoria_id        UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  forma_pagamento_id  UUID REFERENCES public.formas_pagamento(id) ON DELETE SET NULL,
  conta_corrente_id   UUID REFERENCES public.contas_correntes(id) ON DELETE SET NULL,
  cartao_id           UUID REFERENCES public.cartoes(id) ON DELETE SET NULL,
  centro_custo_id     UUID REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  descricao           TEXT NOT NULL,
  valor_total         NUMERIC(15,2) NOT NULL CHECK (valor_total > 0),
  num_parcelas        SMALLINT NOT NULL DEFAULT 1 CHECK (num_parcelas BETWEEN 1 AND 60),
  juros_percentual    NUMERIC(5,2) NOT NULL DEFAULT 0,
  multa_percentual    NUMERIC(5,2) NOT NULL DEFAULT 0,
  desconto_valor      NUMERIC(15,2) NOT NULL DEFAULT 0,
  data_primeira_parcela DATE NOT NULL,
  observacoes         TEXT,
  status              TEXT NOT NULL DEFAULT 'aberto'
                      CHECK (status IN ('aberto','parcial','quitado','cancelado')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_user_id       ON public.contas_pagar(user_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_fornecedor_id ON public.contas_pagar(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status        ON public.contas_pagar(user_id, status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data          ON public.contas_pagar(user_id, data_primeira_parcela);

CREATE TRIGGER trg_contas_pagar_updated_at
  BEFORE UPDATE ON public.contas_pagar
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contas_pagar_select" ON public.contas_pagar FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "contas_pagar_insert" ON public.contas_pagar FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contas_pagar_update" ON public.contas_pagar FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "contas_pagar_delete" ON public.contas_pagar FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 11. PARCELAS A PAGAR
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parcelas_pagar (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_pagar_id      UUID NOT NULL REFERENCES public.contas_pagar(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero_parcela      SMALLINT NOT NULL,
  total_parcelas      SMALLINT NOT NULL,
  valor               NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  valor_pago          NUMERIC(15,2),
  data_vencimento     DATE NOT NULL,
  data_pagamento      DATE,
  juros               NUMERIC(15,2) NOT NULL DEFAULT 0,
  multa               NUMERIC(15,2) NOT NULL DEFAULT 0,
  desconto            NUMERIC(15,2) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'aberto'
                      CHECK (status IN ('aberto','pago','atrasado','cancelado')),
  forma_pagamento_id  UUID REFERENCES public.formas_pagamento(id) ON DELETE SET NULL,
  conta_corrente_id   UUID REFERENCES public.contas_correntes(id) ON DELETE SET NULL,
  cartao_id           UUID REFERENCES public.cartoes(id) ON DELETE SET NULL,
  observacoes         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcelas_pagar_user_id        ON public.parcelas_pagar(user_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_pagar_conta_pagar_id ON public.parcelas_pagar(conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_pagar_status         ON public.parcelas_pagar(user_id, status);
CREATE INDEX IF NOT EXISTS idx_parcelas_pagar_vencimento     ON public.parcelas_pagar(user_id, data_vencimento);

CREATE TRIGGER trg_parcelas_pagar_updated_at
  BEFORE UPDATE ON public.parcelas_pagar
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.parcelas_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parcelas_pagar_select" ON public.parcelas_pagar FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "parcelas_pagar_insert" ON public.parcelas_pagar FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "parcelas_pagar_update" ON public.parcelas_pagar FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "parcelas_pagar_delete" ON public.parcelas_pagar FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 12. FATURAS DE CARTÃO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.faturas_cartao (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cartao_id        UUID NOT NULL REFERENCES public.cartoes(id) ON DELETE CASCADE,
  mes_referencia   DATE NOT NULL,
  valor_total      NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_pago       NUMERIC(15,2) NOT NULL DEFAULT 0,
  data_vencimento  DATE NOT NULL,
  data_fechamento  DATE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'aberta'
                   CHECK (status IN ('aberta','fechada','paga','parcial')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faturas_cartao_user_id   ON public.faturas_cartao(user_id);
CREATE INDEX IF NOT EXISTS idx_faturas_cartao_cartao_id ON public.faturas_cartao(cartao_id);
CREATE INDEX IF NOT EXISTS idx_faturas_cartao_mes       ON public.faturas_cartao(cartao_id, mes_referencia);

CREATE TRIGGER trg_faturas_cartao_updated_at
  BEFORE UPDATE ON public.faturas_cartao
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.faturas_cartao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faturas_cartao_select" ON public.faturas_cartao FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "faturas_cartao_insert" ON public.faturas_cartao FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "faturas_cartao_update" ON public.faturas_cartao FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "faturas_cartao_delete" ON public.faturas_cartao FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 13. MOVIMENTAÇÕES DE CONTA CORRENTE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.movimentacoes_conta (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conta_corrente_id   UUID NOT NULL REFERENCES public.contas_correntes(id) ON DELETE CASCADE,
  tipo                TEXT NOT NULL CHECK (tipo IN (
                        'credito','debito','transferencia_entrada','transferencia_saida')),
  valor               NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  saldo_anterior      NUMERIC(15,2) NOT NULL,
  saldo_posterior     NUMERIC(15,2) NOT NULL,
  descricao           TEXT NOT NULL,
  data_movimentacao   DATE NOT NULL,
  parcela_receber_id  UUID REFERENCES public.parcelas_receber(id) ON DELETE SET NULL,
  parcela_pagar_id    UUID REFERENCES public.parcelas_pagar(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_user_id         ON public.movimentacoes_conta(user_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_conta_id        ON public.movimentacoes_conta(conta_corrente_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data            ON public.movimentacoes_conta(conta_corrente_id, data_movimentacao DESC);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_parcela_receber ON public.movimentacoes_conta(parcela_receber_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_parcela_pagar   ON public.movimentacoes_conta(parcela_pagar_id);

ALTER TABLE public.movimentacoes_conta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movimentacoes_conta_select" ON public.movimentacoes_conta FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "movimentacoes_conta_insert" ON public.movimentacoes_conta FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "movimentacoes_conta_update" ON public.movimentacoes_conta FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "movimentacoes_conta_delete" ON public.movimentacoes_conta FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 14. ANEXOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.anexos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tabela_referencia  TEXT NOT NULL,
  registro_id        UUID NOT NULL,
  nome_arquivo       TEXT NOT NULL,
  url_arquivo        TEXT NOT NULL,
  tamanho_bytes      BIGINT,
  tipo_mime          TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anexos_user_id    ON public.anexos(user_id);
CREATE INDEX IF NOT EXISTS idx_anexos_registro   ON public.anexos(tabela_referencia, registro_id);

ALTER TABLE public.anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anexos_select" ON public.anexos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "anexos_insert" ON public.anexos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "anexos_update" ON public.anexos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "anexos_delete" ON public.anexos FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 15. LOGS DE AUDITORIA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acao             TEXT NOT NULL CHECK (acao IN ('insert','update','delete','login','logout','outro')),
  tabela           TEXT NOT NULL,
  registro_id      UUID,
  dados_anteriores JSONB,
  dados_novos      JSONB,
  ip               TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_user_id    ON public.logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_tabela     ON public.logs(tabela);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.logs(created_at DESC);

ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_select" ON public.logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "logs_insert" ON public.logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- VIEW: FLUXO DE CAIXA CONSOLIDADO
-- ============================================================
CREATE OR REPLACE VIEW public.vw_fluxo_caixa AS
SELECT
  mc.user_id,
  mc.data_movimentacao AS data,
  mc.descricao,
  mc.conta_corrente_id,
  cc.nome_apelido AS conta_nome,
  CASE mc.tipo
    WHEN 'credito'               THEN mc.valor
    WHEN 'transferencia_entrada' THEN mc.valor
    ELSE 0
  END AS entrada,
  CASE mc.tipo
    WHEN 'debito'              THEN mc.valor
    WHEN 'transferencia_saida' THEN mc.valor
    ELSE 0
  END AS saida,
  mc.saldo_posterior AS saldo,
  true AS realizado,
  mc.created_at
FROM public.movimentacoes_conta mc
JOIN public.contas_correntes cc ON cc.id = mc.conta_corrente_id

UNION ALL

SELECT
  pr.user_id,
  pr.data_vencimento AS data,
  COALESCE(c.nome, 'Cliente') || ' — ' || cr.descricao AS descricao,
  cr.conta_corrente_id,
  COALESCE(cnt.nome_apelido, 'Conta') AS conta_nome,
  pr.valor AS entrada,
  0 AS saida,
  0 AS saldo,
  false AS realizado,
  pr.created_at
FROM public.parcelas_receber pr
JOIN public.contas_receber cr ON cr.id = pr.conta_receber_id
LEFT JOIN public.clientes c ON c.id = cr.cliente_id
LEFT JOIN public.contas_correntes cnt ON cnt.id = cr.conta_corrente_id
WHERE pr.status IN ('aberto','atrasado')

UNION ALL

SELECT
  pp.user_id,
  pp.data_vencimento AS data,
  COALESCE(f.nome, 'Fornecedor') || ' — ' || cp.descricao AS descricao,
  cp.conta_corrente_id,
  COALESCE(cnt.nome_apelido, 'Conta') AS conta_nome,
  0 AS entrada,
  pp.valor AS saida,
  0 AS saldo,
  false AS realizado,
  pp.created_at
FROM public.parcelas_pagar pp
JOIN public.contas_pagar cp ON cp.id = pp.conta_pagar_id
LEFT JOIN public.fornecedores f ON f.id = cp.fornecedor_id
LEFT JOIN public.contas_correntes cnt ON cnt.id = cp.conta_corrente_id
WHERE pp.status IN ('aberto','atrasado');

-- ============================================================
-- SEEDS: CATEGORIAS PADRÃO DO SISTEMA (user_id = NULL)
-- ============================================================
INSERT INTO public.categorias (user_id, nome, tipo, cor, icone) VALUES
  (NULL, 'Salário',             'receita', '#22c55e', '💼'),
  (NULL, 'Freelance',           'receita', '#16a34a', '💻'),
  (NULL, 'Investimentos',       'receita', '#15803d', '📈'),
  (NULL, 'Aluguel Recebido',    'receita', '#4ade80', '🏠'),
  (NULL, 'Vendas',              'receita', '#86efac', '🛒'),
  (NULL, 'Comissões',           'receita', '#bbf7d0', '🤝'),
  (NULL, 'Outras Receitas',     'receita', '#f0fdf4', '💰'),
  (NULL, 'Alimentação',         'despesa', '#f97316', '🍔'),
  (NULL, 'Transporte',          'despesa', '#3b82f6', '🚗'),
  (NULL, 'Saúde',               'despesa', '#ec4899', '🏥'),
  (NULL, 'Educação',            'despesa', '#8b5cf6', '📚'),
  (NULL, 'Lazer',               'despesa', '#f59e0b', '🎬'),
  (NULL, 'Moradia / Aluguel',   'despesa', '#6366f1', '🏠'),
  (NULL, 'Vestuário',           'despesa', '#d946ef', '👕'),
  (NULL, 'Compras',             'despesa', '#0ea5e9', '🛍️'),
  (NULL, 'Contas / Utilidades', 'despesa', '#64748b', '📄'),
  (NULL, 'Fornecedores',        'despesa', '#78716c', '🏢'),
  (NULL, 'Impostos',            'despesa', '#dc2626', '🏛️'),
  (NULL, 'Folha de Pagamento',  'despesa', '#b45309', '👥'),
  (NULL, 'Outras Despesas',     'despesa', '#94a3b8', '💸')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEEDS: FORMAS DE PAGAMENTO PADRÃO (user_id = NULL)
-- ============================================================
INSERT INTO public.formas_pagamento (user_id, nome, tipo) VALUES
  (NULL, 'Dinheiro',          'dinheiro'),
  (NULL, 'PIX',               'pix'),
  (NULL, 'TED',               'ted'),
  (NULL, 'DOC',               'doc'),
  (NULL, 'Boleto',            'boleto'),
  (NULL, 'Cartão de Crédito', 'cartao_credito'),
  (NULL, 'Cartão de Débito',  'cartao_debito'),
  (NULL, 'Cheque',            'cheque')
ON CONFLICT DO NOTHING;
