-- ============================================================
-- SYNCROMONEY INTRO — Fase 7 (recibo do fornecedor sem preço de venda)
-- ============================================================
-- Arquivo standalone: rode isoladamente no SQL Editor do Supabase.
-- Idempotente. Pequeno e seguro: só troca UMA função.
--
-- O recibo enviado ao fornecedor mostra apenas o valor de CUSTO (o que a loja
-- deve a ele). O valor de venda da loja continua guardado no acerto, para os
-- relatórios do lojista, mas a página pública do fornecedor deixa de recebê-lo
-- (nem escondido na resposta do servidor).
--
-- O código de integridade (SHA-256) continua calculado sobre o documento
-- completo guardado; intro_recibo_confirmar não muda.
-- ============================================================

CREATE OR REPLACE FUNCTION public.intro_recibo_publico(p_token uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'status', a.status,
    'numero', a.numero,
    'snapshot',
      (a.snapshot - 'total_vendido')
      || jsonb_build_object(
           'itens',
           COALESCE(
             (SELECT jsonb_agg(i - 'total_vendido')
                FROM jsonb_array_elements(COALESCE(a.snapshot->'itens', '[]'::jsonb)) AS i),
             '[]'::jsonb)
         ),
    'hash', a.hash_sha256,
    'enviado_em', a.enviado_em,
    'recebido_em', a.recebido_em,
    'recebido_nome', a.recebido_nome,
    'recebido_documento', a.recebido_documento)
  FROM public.acertos_fornecedor a
  WHERE a.token_publico = p_token;
$$;

REVOKE ALL ON FUNCTION public.intro_recibo_publico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.intro_recibo_publico(uuid) TO anon, authenticated;
