-- Tabela de NFS-e emitidas via Focus NFe
CREATE TABLE IF NOT EXISTS public.nfse (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  focus_uuid            TEXT,
  focus_ref             TEXT,
  numero                TEXT,
  numero_rps            INTEGER NOT NULL,
  serie_rps             TEXT NOT NULL DEFAULT 'RPS',
  status                TEXT NOT NULL DEFAULT 'processando',
  tomador_razao_social  TEXT NOT NULL,
  tomador_cnpj_cpf      TEXT,
  tomador_email         TEXT,
  valor_servicos        DECIMAL(10,2) NOT NULL,
  valor_iss             DECIMAL(10,2),
  valor_liquido         DECIMAL(10,2),
  aliquota_iss          DECIMAL(5,2),
  iss_retido            BOOLEAN DEFAULT false,
  discriminacao         TEXT,
  codigo_servico        TEXT,
  codigo_lc116          TEXT,
  data_emissao          TIMESTAMPTZ DEFAULT NOW(),
  data_competencia      DATE,
  codigo_verificacao    TEXT,
  link_pdf              TEXT,
  link_xml              TEXT,
  ambiente              TEXT NOT NULL DEFAULT 'homologacao',
  erro_mensagem         TEXT,
  payload_enviado       JSONB,
  retorno_focusnfe      JSONB,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.nfse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfse_user_all" ON public.nfse
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS nfse_user_id_idx ON public.nfse(user_id);
CREATE INDEX IF NOT EXISTS nfse_status_idx ON public.nfse(status);
