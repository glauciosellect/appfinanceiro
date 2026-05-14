-- Tabela de NF-e emitidas (saída)
CREATE TABLE IF NOT EXISTS public.nfe_emitidas (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  numero               INTEGER NOT NULL,
  serie                TEXT NOT NULL DEFAULT '1',
  chave_acesso         TEXT,
  natureza_operacao    TEXT NOT NULL DEFAULT 'Venda de Mercadoria',
  data_emissao         DATE NOT NULL DEFAULT CURRENT_DATE,
  destinatario         TEXT NOT NULL,
  cnpj_destinatario    TEXT,
  email_destinatario   TEXT,
  valor_total          DECIMAL(10,2) NOT NULL,
  status               TEXT NOT NULL DEFAULT 'emitida',
  tipo                 TEXT NOT NULL DEFAULT 'saida',
  danfe_url            TEXT,
  xml_url              TEXT,
  itens                JSONB,
  transportadora       TEXT,
  focus_ref            TEXT,
  focus_uuid           TEXT,
  ambiente             TEXT DEFAULT 'homologacao',
  erro_mensagem        TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.nfe_emitidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfe_emitidas_user_all" ON public.nfe_emitidas
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS nfe_emitidas_user_id_idx ON public.nfe_emitidas(user_id);
CREATE INDEX IF NOT EXISTS nfe_emitidas_status_idx   ON public.nfe_emitidas(status);
CREATE INDEX IF NOT EXISTS nfe_emitidas_emissao_idx  ON public.nfe_emitidas(data_emissao DESC);
