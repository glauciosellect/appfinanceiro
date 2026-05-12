ALTER TABLE public.contas_correntes
  ADD COLUMN IF NOT EXISTS chave_pix TEXT;
