-- Adiciona campos de endereço do tomador na tabela nfse
ALTER TABLE public.nfse
  ADD COLUMN IF NOT EXISTS tomador_telefone TEXT,
  ADD COLUMN IF NOT EXISTS tomador_endereco TEXT,
  ADD COLUMN IF NOT EXISTS tomador_cidade   TEXT;
