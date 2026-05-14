ALTER TABLE public.nfe_emitidas
  ADD COLUMN IF NOT EXISTS logradouro_destinatario TEXT,
  ADD COLUMN IF NOT EXISTS numero_destinatario     TEXT,
  ADD COLUMN IF NOT EXISTS bairro_destinatario     TEXT,
  ADD COLUMN IF NOT EXISTS municipio_destinatario  TEXT,
  ADD COLUMN IF NOT EXISTS uf_destinatario         TEXT,
  ADD COLUMN IF NOT EXISTS cep_destinatario        TEXT;
