-- ============================================================
-- SYNCROMONEY INTRO — Fase 1 (plano, produtos, configurações)
-- ============================================================
-- Arquivo standalone (como schema_caixa.sql etc.): rode isoladamente no
-- SQL Editor do Supabase. Idempotente. Ver SyncroMoney_SPEC_Intro.md.
--
-- Conteúdo:
--   1) assinaturas.plano passa a aceitar 'intro'
--   2) produtos_fiscais.controla_validade
--   3) intro_config — dados e preferências da loja (tabela própria, para
--      não depender de fiscal_config/perfil_empresa, que o Intro não usa)
-- ============================================================

-- 1) Plano INTRO
ALTER TABLE public.assinaturas DROP CONSTRAINT IF EXISTS assinaturas_plano_check;
ALTER TABLE public.assinaturas
  ADD CONSTRAINT assinaturas_plano_check CHECK (plano IN ('intro','pro','premium'));

-- 2) Produtos: controle de validade (barcode, plu, margem_lucro e
--    deleted_at já existem em produtos_fiscais)
ALTER TABLE public.produtos_fiscais ADD COLUMN IF NOT EXISTS controla_validade BOOLEAN NOT NULL DEFAULT false;

-- 3) Configurações da loja
CREATE TABLE IF NOT EXISTS public.intro_config (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_loja            TEXT NOT NULL DEFAULT '',
  cnpj_cpf             TEXT NOT NULL DEFAULT '',
  telefone             TEXT NOT NULL DEFAULT '',
  endereco             TEXT NOT NULL DEFAULT '',
  logo_url             TEXT NOT NULL DEFAULT '',
  texto_recibo         TEXT NOT NULL DEFAULT '',
  margem_padrao        NUMERIC(7,2) NOT NULL DEFAULT 30 CHECK (margem_padrao >= 0),
  dias_alerta_validade INTEGER NOT NULL DEFAULT 15 CHECK (dias_alerta_validade >= 0),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.intro_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "intro_config_all_own" ON public.intro_config;
CREATE POLICY "intro_config_all_own" ON public.intro_config
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
