-- ============================================================
-- 16. PRODUTOS (catálogo — compartilhado entre Orçamento e PDV)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.produtos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  detalhes        TEXT,
  barcode         TEXT,
  plu             TEXT,
  unidade_medida  TEXT NOT NULL DEFAULT 'UN',
  preco_custo     NUMERIC(15,2) NOT NULL DEFAULT 0,
  preco_unitario  NUMERIC(15,2) NOT NULL DEFAULT 0,
  margem_lucro    NUMERIC(6,2)  NOT NULL DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_produtos_barcode ON public.produtos(user_id, barcode) WHERE barcode IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uidx_produtos_plu     ON public.produtos(user_id, plu)     WHERE plu IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_produtos_user_id  ON public.produtos(user_id);
CREATE INDEX IF NOT EXISTS idx_produtos_nome      ON public.produtos(user_id, nome);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo     ON public.produtos(user_id, ativo);

CREATE TRIGGER trg_produtos_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "produtos_select" ON public.produtos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "produtos_insert" ON public.produtos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "produtos_update" ON public.produtos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "produtos_delete" ON public.produtos FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 17. SERVIÇOS (catálogo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.servicos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  detalhes        TEXT,
  unidade_medida  TEXT NOT NULL DEFAULT 'UN',
  preco_custo     NUMERIC(15,2) NOT NULL DEFAULT 0,
  preco_unitario  NUMERIC(15,2) NOT NULL DEFAULT 0,
  margem_lucro    NUMERIC(6,2)  NOT NULL DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_servicos_user_id ON public.servicos(user_id);
CREATE INDEX IF NOT EXISTS idx_servicos_nome    ON public.servicos(user_id, nome);
CREATE INDEX IF NOT EXISTS idx_servicos_ativo   ON public.servicos(user_id, ativo);

CREATE TRIGGER trg_servicos_updated_at
  BEFORE UPDATE ON public.servicos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "servicos_select" ON public.servicos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "servicos_insert" ON public.servicos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "servicos_update" ON public.servicos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "servicos_delete" ON public.servicos FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 18. PEDIDOS (Orçamento/Pedido — núcleo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pedidos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero_sequencial TEXT NOT NULL,
  cliente_id        UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  data_pedido       DATE NOT NULL DEFAULT CURRENT_DATE,
  referencia        TEXT,
  observacoes       TEXT,
  status            TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','aguardando_pagamento','concluido','cancelado')),
  desconto_tipo     TEXT NOT NULL DEFAULT 'percentual' CHECK (desconto_tipo IN ('percentual','valor')),
  desconto_valor    NUMERIC(15,2) NOT NULL DEFAULT 0,
  subtotal          NUMERIC(15,2) NOT NULL DEFAULT 0,
  total             NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (user_id, numero_sequencial)
);

CREATE INDEX IF NOT EXISTS idx_pedidos_user_id    ON public.pedidos(user_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id ON public.pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status     ON public.pedidos(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pedidos_data       ON public.pedidos(user_id, data_pedido DESC);

CREATE TRIGGER trg_pedidos_updated_at
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pedidos_select" ON public.pedidos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pedidos_insert" ON public.pedidos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pedidos_update" ON public.pedidos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "pedidos_delete" ON public.pedidos FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 19. PEDIDO ITENS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pedido_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('produto','servico')),
  item_id         UUID NOT NULL,
  nome_item       TEXT NOT NULL,
  quantidade      NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  preco_unitario  NUMERIC(15,2) NOT NULL CHECK (preco_unitario >= 0),
  desconto_tipo   TEXT NOT NULL DEFAULT 'valor' CHECK (desconto_tipo IN ('percentual','valor')),
  desconto_valor  NUMERIC(15,2) NOT NULL DEFAULT 0,
  subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido_id ON public.pedido_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_user_id   ON public.pedido_itens(user_id);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_item_id   ON public.pedido_itens(item_id);

ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pedido_itens_select" ON public.pedido_itens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pedido_itens_insert" ON public.pedido_itens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pedido_itens_update" ON public.pedido_itens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "pedido_itens_delete" ON public.pedido_itens FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 20. PDV — VENDAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero_sequencial TEXT NOT NULL,
  caixa_sessao_id   UUID,
  cliente_id        UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'em_andamento'
                    CHECK (status IN ('em_andamento','em_espera','concluida','cancelada')),
  identificador_espera TEXT,
  subtotal          NUMERIC(15,2) NOT NULL DEFAULT 0,
  desconto          NUMERIC(15,2) NOT NULL DEFAULT 0,
  total             NUMERIC(15,2) NOT NULL DEFAULT 0,
  cancelada_motivo  TEXT,
  cancelada_por     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelada_em      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, numero_sequencial)
);

CREATE INDEX IF NOT EXISTS idx_vendas_user_id ON public.vendas(user_id);
CREATE INDEX IF NOT EXISTS idx_vendas_status  ON public.vendas(user_id, status);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente_id ON public.vendas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_created_at ON public.vendas(user_id, created_at DESC);

CREATE TRIGGER trg_vendas_updated_at
  BEFORE UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendas_select" ON public.vendas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "vendas_insert" ON public.vendas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vendas_update" ON public.vendas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "vendas_delete" ON public.vendas FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 21. PDV — VENDAS ITENS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendas_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id        UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produto_id      UUID NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  nome_produto    TEXT NOT NULL,
  quantidade      NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  preco_unitario  NUMERIC(15,2) NOT NULL CHECK (preco_unitario >= 0),
  desconto_item   NUMERIC(15,2) NOT NULL DEFAULT 0,
  subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0,
  cancelado       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendas_itens_venda_id   ON public.vendas_itens(venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_user_id    ON public.vendas_itens(user_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_produto_id ON public.vendas_itens(produto_id);

ALTER TABLE public.vendas_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendas_itens_select" ON public.vendas_itens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "vendas_itens_insert" ON public.vendas_itens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vendas_itens_update" ON public.vendas_itens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "vendas_itens_delete" ON public.vendas_itens FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 22. PDV — VENDAS PAGAMENTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendas_pagamentos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id            UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  forma_pagamento_id  UUID REFERENCES public.formas_pagamento(id) ON DELETE SET NULL,
  forma_pagamento_nome TEXT NOT NULL,
  valor               NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  troco               NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendas_pagamentos_venda_id ON public.vendas_pagamentos(venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_pagamentos_user_id  ON public.vendas_pagamentos(user_id);

ALTER TABLE public.vendas_pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendas_pagamentos_select" ON public.vendas_pagamentos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "vendas_pagamentos_insert" ON public.vendas_pagamentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vendas_pagamentos_update" ON public.vendas_pagamentos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "vendas_pagamentos_delete" ON public.vendas_pagamentos FOR DELETE USING (auth.uid() = user_id);
