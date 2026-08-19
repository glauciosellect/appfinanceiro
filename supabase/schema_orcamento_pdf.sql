-- ============================================================
-- ORÇAMENTO PDF + LINK PÚBLICO DE ACEITE
-- ============================================================
-- Arquivo standalone (assim como schema_novas_tabelas.sql): rode este
-- arquivo isoladamente no SQL Editor do Supabase. Não faz parte do
-- schema.sql principal porque esse arquivo tem uma policy não-idempotente
-- pré-existente para `transactions` que impede reexecução completa.
--
-- Conteúdo:
--   1) Colunas de logo + toggles de visibilidade em fiscal_config
--   2) Token público de compartilhamento/aceite em pedidos
--   3) RPCs SECURITY DEFINER para leitura e aceite públicos (sem policy
--      pública de SELECT em pedidos/pedido_itens — ver nota de segurança
--      abaixo antes da definição das funções)
-- ============================================================

-- fiscal_config: logo + toggles de visibilidade por campo para o cabeçalho do PDF de orçamento
ALTER TABLE public.fiscal_config ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.fiscal_config ADD COLUMN IF NOT EXISTS mostrar_logo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.fiscal_config ADD COLUMN IF NOT EXISTS mostrar_cnpj BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.fiscal_config ADD COLUMN IF NOT EXISTS mostrar_endereco BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.fiscal_config ADD COLUMN IF NOT EXISTS mostrar_telefone BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.fiscal_config ADD COLUMN IF NOT EXISTS mostrar_email BOOLEAN NOT NULL DEFAULT true;

-- pedidos: token público de compartilhamento/aceite do orçamento pelo cliente
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS token_publico UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS aceito_em TIMESTAMPTZ;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS aceito_ip TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uidx_pedidos_token_publico ON public.pedidos(token_publico);

-- --------------------------------------------------------------
-- NOTA DE SEGURANÇA: por que não há policy pública "USING (true)" aqui
-- --------------------------------------------------------------
-- Uma policy de SELECT pública em pedidos/pedido_itens com `USING (true)`
-- permitiria que QUALQUER pessoa com a anon key (que é pública, embutida no
-- JS do cliente) execute `select * from pedidos` e leia os orçamentos de
-- TODOS os usuários — não apenas do dono do token. Isso é um vazamento de
-- dados entre todos os tenants, mesmo que o app só faça queries filtradas
-- por token_publico (a disciplina de query do app não é um limite de
-- segurança quando a policy em si permite tudo).
--
-- Por isso, a única forma de um chamador público/anônimo ler dados de
-- pedidos é através da RPC get_orcamento_publico abaixo — não existe (e não
-- deve existir) policy de SELECT pública nas tabelas base para o role anon.
-- SECURITY DEFINER + parâmetro de token restringe a exposição a exatamente
-- uma linha por chamada, escolhida pelo próprio token (capability pattern,
-- como um link de pagamento do Stripe).
-- --------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_orcamento_publico(p_token UUID)
RETURNS TABLE (
  pedido JSONB,
  itens JSONB,
  fiscal_config JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos WHERE token_publico = p_token AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT
    to_jsonb(v_pedido),
    COALESCE((SELECT jsonb_agg(to_jsonb(pi)) FROM public.pedido_itens pi WHERE pi.pedido_id = v_pedido.id), '[]'::jsonb),
    COALESCE((SELECT to_jsonb(fc) FROM public.fiscal_config fc WHERE fc.user_id = v_pedido.user_id), '{}'::jsonb);
END;
$$;

-- RPC: aceitar um orçamento pelo token, sem precisar de auth.uid() (o visitante público não tem sessão).
-- SECURITY DEFINER para poder atualizar a linha apesar do RLS; valida a transição de status no servidor
-- (só aceita se `aceito_em` ainda estiver NULL — idempotente, evitar sobrescrever um aceite já registrado).
CREATE OR REPLACE FUNCTION public.aceitar_orcamento_por_token(p_token UUID, p_ip TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pedidos
  SET aceito_em = NOW(), aceito_ip = p_ip
  WHERE token_publico = p_token AND aceito_em IS NULL;
END;
$$;

-- Supabase exige GRANT explícito para o role anon poder chamar RPCs via PostgREST.
GRANT EXECUTE ON FUNCTION public.get_orcamento_publico(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aceitar_orcamento_por_token(UUID, TEXT) TO anon, authenticated;
