import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'

// Autenticação B2B por API key — inteiramente separada da sessão Supabase
// de usuário (cookies). Usada só pelas rotas app/api/parceiro/**, nunca
// pelas rotas de usuário final. Ver supabase/migrations/20260907_create_parceiros_api.sql.

export interface ParceiroEmpresa {
  id: string
  parceiro_id: string
  referencia_externa: string | null
  webhook_url: string | null
  cnpj: string | null
  razao_social: string | null
  inscricao_estadual: string | null
  inscricao_municipal: string | null
  regime_tributario: string | null
  municipio: string | null
  uf: string | null
  codigo_municipio: string | null
  contora_company_id: string | null
  ambiente: string | null
  numero_proximo_nfse: number | null
  serie_nfse: string | null
  habilita_nfse: boolean
  habilita_nfe: boolean
  ativo: boolean
}

// Service role — mesmo padrão de app/api/asaas/webhook/route.ts. Nunca usar
// a chave anon aqui: estas tabelas têm RLS habilitada sem nenhuma policy,
// só a service role enxerga.
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export function hashApiKey(chave: string): string {
  return createHash('sha256').update(chave).digest('hex')
}

/**
 * Resolve a `parceiro_empresas` a partir do header `Authorization: Bearer <chave>`.
 * Retorna null se o header estiver ausente, malformado, a chave não existir
 * ou a empresa estiver inativa — as rotas devem responder 401 nesses casos.
 */
export async function autenticarParceiro(req: NextRequest): Promise<ParceiroEmpresa | null> {
  const authHeader = req.headers.get('authorization') ?? ''
  const chave = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!chave) return null

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('parceiro_empresas')
    .select('*')
    .eq('api_key_hash', hashApiKey(chave))
    .eq('ativo', true)
    .single()

  return (data as ParceiroEmpresa | null) ?? null
}
