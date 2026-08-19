-- ============================================================
-- ASSINATURAS (Asaas) — Fase 1 da migração Stripe → Asaas
-- ============================================================
-- Arquivo standalone (assim como schema_caixa.sql, schema_novas_tabelas.sql,
-- schema_orcamento_pdf.sql e schema_unificar_produtos.sql): rode este
-- arquivo isoladamente no SQL Editor do Supabase.
--
-- Contexto: a tabela `assinaturas` nunca esteve em um arquivo SQL rastreado
-- neste repositório — ela existia apenas ao vivo no Supabase, com colunas
-- orientadas ao Stripe (stripe_customer_id, stripe_subscription_id, etc.),
-- inferidas do código do webhook antigo (app/api/stripe/webhook/route.ts).
--
-- Este script:
--   1) Cria a tabela do zero (CREATE TABLE IF NOT EXISTS) com o novo shape
--      orientado ao Asaas e a dois planos reais: 'pro' e 'premium'.
--   2) Como não há clientes Stripe hoje (confirmado com o usuário — troca
--      limpa, sem migração de dados), NÃO fazemos rename/migração de
--      colunas antigas. Não sabemos com certeza se a tabela já existe ao
--      vivo com o shape antigo, então os ALTER TABLE ... ADD COLUMN IF NOT
--      EXISTS abaixo garantem que este script funcione tanto se a tabela
--      for criada agora quanto se já existir no formato Stripe antigo.
--      Colunas antigas (stripe_customer_id, stripe_subscription_id,
--      stripe_price_id, trial_end, current_period_end) NÃO são removidas —
--      ficam como leftover inofensivo, seguindo a filosofia aditiva deste
--      repositório.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.assinaturas (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plano                  TEXT NOT NULL DEFAULT 'pro' CHECK (plano IN ('pro','premium')),
  asaas_customer_id      TEXT,
  asaas_subscription_id  TEXT,
  billing_type           TEXT CHECK (billing_type IN ('PIX','CREDIT_CARD')),
  status                 TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','past_due','canceled')),
  valor                  NUMERIC(10,2) NOT NULL DEFAULT 0,
  proximo_vencimento     DATE,
  ultimo_pagamento_em    TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fallback: garante as colunas novas mesmo se a tabela já existir no
-- shape antigo (Stripe). `plano` e `valor` recebem DEFAULT para não
-- quebrar em cima de linhas existentes; removemos o DEFAULT temporário
-- em seguida para manter o schema "canônico" igual ao CREATE TABLE acima
-- em instalações novas.
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS plano                  TEXT NOT NULL DEFAULT 'pro';
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS asaas_customer_id      TEXT;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS billing_type          TEXT;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS status                TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS valor                 NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS proximo_vencimento    DATE;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS ultimo_pagamento_em   TIMESTAMPTZ;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- CHECK constraints: adicionadas separadamente com nomes explícitos para
-- que o "ADD COLUMN" acima (sem CHECK, por simplicidade de sintaxe) não
-- deixe o banco sem validação em instalações que já tinham a tabela.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assinaturas_plano_check'
  ) THEN
    ALTER TABLE public.assinaturas
      ADD CONSTRAINT assinaturas_plano_check CHECK (plano IN ('pro','premium'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assinaturas_billing_type_check'
  ) THEN
    ALTER TABLE public.assinaturas
      ADD CONSTRAINT assinaturas_billing_type_check CHECK (billing_type IS NULL OR billing_type IN ('PIX','CREDIT_CARD'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assinaturas_status_check'
  ) THEN
    ALTER TABLE public.assinaturas
      ADD CONSTRAINT assinaturas_status_check CHECK (status IN ('pending','active','past_due','canceled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assinaturas_user_id               ON public.assinaturas(user_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_asaas_subscription_id ON public.assinaturas(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_asaas_customer_id     ON public.assinaturas(asaas_customer_id);

ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

-- Leitura: o próprio usuário pode ver sua assinatura.
DROP POLICY IF EXISTS "assinaturas_select" ON public.assinaturas;
CREATE POLICY "assinaturas_select" ON public.assinaturas FOR SELECT USING (auth.uid() = user_id);

-- Escrita: apenas via service-role (rotas de checkout/webhook usam a
-- service-role key, que ignora RLS). Não há policy de INSERT/UPDATE/DELETE
-- para o usuário autenticado comum — mesma postura restritiva usada em
-- outras tabelas sensíveis deste projeto.

-- updated_at automático, reaproveitando a função já definida em schema.sql
DROP TRIGGER IF EXISTS set_updated_at_assinaturas ON public.assinaturas;
CREATE TRIGGER set_updated_at_assinaturas
  BEFORE UPDATE ON public.assinaturas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
