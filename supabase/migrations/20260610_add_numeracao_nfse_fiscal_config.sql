ALTER TABLE public.fiscal_config
  ADD COLUMN IF NOT EXISTS numero_proximo_nfse INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS serie_nfse          TEXT    DEFAULT 'RPS';
