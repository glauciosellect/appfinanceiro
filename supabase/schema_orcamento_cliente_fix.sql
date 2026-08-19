-- ============================================================
-- FIX: get_orcamento_publico não trazia o cliente vinculado
-- ============================================================
-- Arquivo standalone (mesma convenção de schema_orcamento_pdf.sql):
-- rode isoladamente no SQL Editor do Supabase.
--
-- Bug: a função original fazia `SELECT * INTO v_pedido FROM pedidos`
-- e devolvia `to_jsonb(v_pedido)` — isso serializa APENAS as colunas
-- da própria linha de `pedidos` (incluindo o `cliente_id` cru, sem
-- resolver o relacionamento). Nunca havia join com `clientes`, então
-- a página pública de aceite (`pedido.clientes`) sempre recebia
-- `undefined`, mesmo quando o orçamento tinha um cliente vinculado —
-- por isso ela exibia "Cliente: —" incondicionalmente.
--
-- Fix: adiciona uma 4ª coluna de retorno `cliente JSONB`, populada via
-- LEFT JOIN em `clientes` (LEFT, não INNER — um pedido sem cliente_id
-- continua funcionando normalmente, retornando `cliente: null`).
-- CREATE OR REPLACE FUNCTION é idempotente por natureza, sem
-- necessidade de guarda especial para reexecução.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_orcamento_publico(p_token UUID)
RETURNS TABLE (
  pedido JSONB,
  itens JSONB,
  fiscal_config JSONB,
  cliente JSONB
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
    COALESCE((SELECT to_jsonb(fc) FROM public.fiscal_config fc WHERE fc.user_id = v_pedido.user_id), '{}'::jsonb),
    (SELECT to_jsonb(c) FROM public.clientes c WHERE c.id = v_pedido.cliente_id);
END;
$$;

-- Reafirma o GRANT (idempotente) para garantir que o role anon continue
-- podendo chamar a RPC via PostgREST após o CREATE OR REPLACE acima.
GRANT EXECUTE ON FUNCTION public.get_orcamento_publico(UUID) TO anon, authenticated;
