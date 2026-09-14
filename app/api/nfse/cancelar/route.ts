import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cancelarNFSe } from '@/lib/fiscal/contora'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id, motivo } = await req.json() as { id: string; motivo?: string }
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
  // motivo mínimo 15 caracteres — exigido pela Contora (padrão nacional)
  const reason = motivo && motivo.length >= 15 ? motivo : 'Cancelamento solicitado pelo emissor da nota'

  const [{ data: nota }, { data: fiscalConfig }] = await Promise.all([
    supabase.from('nfse').select('contora_document_id').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('fiscal_config').select('contora_company_id, ambiente').eq('user_id', user.id).single(),
  ])

  if (!nota?.contora_document_id || !fiscalConfig?.contora_company_id) {
    return NextResponse.json({ error: 'Nota ou empresa não encontrada na Contora' }, { status: 400 })
  }

  const ambiente = (fiscalConfig.ambiente as 'homologacao' | 'producao' | undefined) ?? 'homologacao'
  const retorno = await cancelarNFSe(fiscalConfig.contora_company_id, nota.contora_document_id, reason, ambiente)

  await supabase
    .from('nfse')
    .update({ status: 'cancelada', retorno_provedor: retorno, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true, retorno })
}
