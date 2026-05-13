CREATE TABLE IF NOT EXISTS public.fiscal_config (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  cnpj                    TEXT,
  razao_social            TEXT,
  inscricao_estadual      TEXT,
  inscricao_municipal     TEXT,
  regime_tributario       TEXT DEFAULT '1',
  cep                     TEXT,
  logradouro              TEXT,
  numero                  TEXT,
  complemento             TEXT,
  bairro                  TEXT,
  municipio               TEXT,
  uf                      TEXT,
  telefone                TEXT,
  email                   TEXT,
  habilita_nfse           BOOLEAN DEFAULT true,
  habilita_nfe            BOOLEAN DEFAULT false,
  ambiente                TEXT DEFAULT 'homologacao',
  focus_status            TEXT DEFAULT 'nao_cadastrado',
  focus_erro              TEXT,
  certificado_status      TEXT DEFAULT 'nao_enviado',
  certificado_vencimento  DATE,
  ativo                   BOOLEAN DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fiscal_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_config_user_all" ON public.fiscal_config
  FOR ALL USING (auth.uid() = user_id);
