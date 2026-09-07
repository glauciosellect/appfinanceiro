-- Integração B2B de emissão fiscal (NFS-e/NF-e) para parceiros externos
-- (ex: GestorBIM). Um "parceiro" NUNCA é um usuário Money: não tem linha em
-- auth.users, não tem `assinaturas`, não passa pelo SubscriptionGuard nem
-- pelo bypass de acesso vitalício (ver lib/supabase/assinatura.ts) — é um
-- fluxo de autenticação inteiramente separado, só por API key, usado
-- somente pelas rotas em app/api/parceiro/**.
--
-- Isolamento: cada `parceiro_empresas.id` é o equivalente ao `user_id` nas
-- tabelas fiscais, mas nunca cruza com dados de assinantes normais do Money
-- (colunas e políticas são adicionadas lado a lado, nunca substituindo as
-- existentes por `user_id`).

CREATE TABLE IF NOT EXISTS public.parceiros (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,        -- ex: "GestorBIM"
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Uma linha por empresa emissora do lado do parceiro (ex: um escritório
-- cliente do GestorBIM). `referencia_externa` é só para log/rastreio (ex:
-- o escritorioId do GestorBIM) — nunca uma FK de verdade, o parceiro é
-- responsável por gerenciar essa referência do lado dele.
CREATE TABLE IF NOT EXISTS public.parceiro_empresas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id           UUID REFERENCES public.parceiros(id) ON DELETE CASCADE NOT NULL,
  referencia_externa    TEXT,
  nome_exibicao         TEXT,               -- ex: "Escritório Fulano — GestorBIM", só para admin identificar nos logs
  api_key_hash          TEXT NOT NULL UNIQUE,  -- SHA-256 hex da chave; a chave em texto puro só existe no momento da criação (ver scripts/criar-parceiro.mjs)
  webhook_url           TEXT,               -- URL do parceiro que recebe o resultado da emissão
  cnpj                  TEXT,
  razao_social          TEXT,
  inscricao_estadual    TEXT,
  inscricao_municipal   TEXT,
  regime_tributario     TEXT DEFAULT '1',
  cep                   TEXT,
  logradouro            TEXT,
  numero                TEXT,
  complemento           TEXT,
  bairro                TEXT,
  municipio             TEXT,
  uf                    TEXT,
  codigo_municipio      TEXT,
  telefone              TEXT,
  email                 TEXT,
  habilita_nfse         BOOLEAN DEFAULT true,
  habilita_nfe          BOOLEAN DEFAULT false,
  ambiente              TEXT DEFAULT 'homologacao',
  numero_proximo_nfse   INTEGER DEFAULT 1,
  serie_nfse            TEXT DEFAULT 'RPS',
  ativo                 BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS parceiro_empresas_api_key_hash_idx ON public.parceiro_empresas(api_key_hash);
CREATE INDEX IF NOT EXISTS parceiro_empresas_parceiro_id_idx ON public.parceiro_empresas(parceiro_id);

-- RLS habilitada sem nenhuma policy: bloqueia totalmente acesso via chave
-- anon/authenticated. Só a service role (usada pelas rotas app/api/parceiro/**
-- e pelo webhook da Focus NFe) enxerga estas tabelas — mesmo padrão de
-- isolamento do resto do módulo fiscal, na direção oposta.
ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiro_empresas ENABLE ROW LEVEL SECURITY;

-- `nfse` passa a aceitar notas emitidas por um parceiro em vez de um
-- usuário logado: user_id vira opcional, parceiro_empresa_id é o novo dono
-- alternativo. Exatamente um dos dois deve estar preenchido.
ALTER TABLE public.nfse ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.nfse ADD COLUMN IF NOT EXISTS parceiro_empresa_id UUID REFERENCES public.parceiro_empresas(id) ON DELETE CASCADE;
-- Id da nota do lado do parceiro (ex: parcelaId do GestorBIM) — só rastreio/log.
ALTER TABLE public.nfse ADD COLUMN IF NOT EXISTS referencia_externa TEXT;

-- ADD CONSTRAINT não suporta IF NOT EXISTS no Postgres — DO block evita
-- erro se esta migration for reexecutada por engano.
DO $$
BEGIN
  ALTER TABLE public.nfse ADD CONSTRAINT nfse_dono_unico_check
    CHECK ((user_id IS NOT NULL) <> (parceiro_empresa_id IS NOT NULL));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS nfse_parceiro_empresa_id_idx ON public.nfse(parceiro_empresa_id);
