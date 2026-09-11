-- Migração para Fiscal Contora, substituindo a Focus NFe.
-- Colunas antigas (focus_status, focus_erro) ficam por enquanto para permitir
-- rollback; remover em migração futura depois que a Contora estiver validada
-- em produção para todos os tenants.
ALTER TABLE public.fiscal_config
  ADD COLUMN IF NOT EXISTS contora_company_id UUID,
  ADD COLUMN IF NOT EXISTS contora_status      TEXT DEFAULT 'nao_cadastrado',
  ADD COLUMN IF NOT EXISTS contora_erro        TEXT,
  ADD COLUMN IF NOT EXISTS numero_proximo_nfce INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS serie_nfce          TEXT    DEFAULT '1';

-- document id (UUID interno da Contora) por nota — substitui o par
-- focus_uuid/focus_ref usado para consultar status na Focus NFe.
ALTER TABLE public.nfse
  ADD COLUMN IF NOT EXISTS contora_document_id UUID;

ALTER TABLE public.nfe_emitidas
  ADD COLUMN IF NOT EXISTS contora_document_id UUID;

-- Empresas de parceiros B2B (app/api/parceiro/**) também precisam do próprio
-- company_id na Contora — é um cadastro totalmente separado do fiscal_config.
-- Guardado com IF EXISTS porque este projeto ainda não tem a migração
-- 20260907_create_parceiros_api.sql aplicada (tabela não existe em produção).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'parceiro_empresas') THEN
    ALTER TABLE public.parceiro_empresas ADD COLUMN IF NOT EXISTS contora_company_id UUID;
  END IF;
END $$;

-- Cupom fiscal (NFC-e) — feature nova, nunca existiu na Focus NFe.
CREATE TABLE IF NOT EXISTS public.nfce (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  contora_document_id  UUID,
  numero               INTEGER NOT NULL,
  serie                TEXT NOT NULL DEFAULT '1',
  chave_acesso         TEXT,
  data_emissao         DATE NOT NULL DEFAULT CURRENT_DATE,
  cliente_nome         TEXT,
  cliente_cpf_cnpj     TEXT,
  valor_total          DECIMAL(10,2) NOT NULL,
  status               TEXT NOT NULL DEFAULT 'processando',
  danfce_url           TEXT,
  xml_url              TEXT,
  itens                JSONB,
  ambiente             TEXT DEFAULT 'homologacao',
  erro_mensagem        TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.nfce ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "nfce_user_all" ON public.nfce
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS nfce_user_id_idx ON public.nfce(user_id);
CREATE INDEX IF NOT EXISTS nfce_status_idx  ON public.nfce(status);
