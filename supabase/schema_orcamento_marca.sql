-- ============================================================
-- ORÇAMENTO PÚBLICO: marca da empresa (nome fantasia + logo) para o link compartilhado
-- ============================================================
-- Arquivo standalone: rode isoladamente no SQL Editor do Supabase. Idempotente.
-- Usada pela pré-visualização do link no WhatsApp (título/descrição/logo da EMPRESA do
-- cliente, sem mostrar o SyncroMoney) e pelo cabeçalho da página pública.
-- Só devolve dados já exibidos no próprio orçamento; exige o token (UUID) do orçamento.
CREATE OR REPLACE FUNCTION public.get_orcamento_marca(p_token UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'nome', COALESCE(NULLIF(btrim(pe.nome_fantasia), ''), 
                     NULLIF(btrim(pe.razao_social), ''), NULLIF(btrim(fc.razao_social), '')),
    'logo_url', COALESCE(NULLIF(btrim(pe.logo_url), ''), NULLIF(btrim(fc.logo_url), '')),
    'numero', p.numero_sequencial,
    'total', p.total
  )
  FROM public.pedidos p
  LEFT JOIN public.perfil_empresa pe ON pe.user_id = p.user_id
  LEFT JOIN public.fiscal_config fc ON fc.user_id = p.user_id
  WHERE p.token_publico = p_token AND p.deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_orcamento_marca(UUID) TO anon, authenticated;
