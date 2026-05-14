ALTER TABLE public.fiscal_config
  ADD COLUMN IF NOT EXISTS numero_proximo_nfe INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS serie_nfe          TEXT    DEFAULT '1';
