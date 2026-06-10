ALTER TABLE public.fiscal_config
  ADD COLUMN IF NOT EXISTS codigo_municipio TEXT DEFAULT '3136702';
