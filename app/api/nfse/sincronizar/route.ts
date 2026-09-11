import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consultarNFSe } from '@/lib/fiscal/contora'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await req.json() as { id: string }
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  const [{ data: nota }, { data: fiscalConfig }] = await Promise.all([
    supabase.from('nfse').select('contora_document_id').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('fiscal_config').select('contora_company_id, ambiente').eq('user_id', user.id).single(),
  ])

  if (!nota?.contora_document_id || !fiscalConfig?.contora_company_id) {
    return NextResponse.json({ error: 'Nota ou empresa não encontrada na Contora' }, { status: 400 })
  }

  const ambiente = (fiscalConfig.ambiente as 'homologacao' | 'producao' | undefined) ?? 'homologacao'
  let retorno
  try {
    retorno = await consultarNFSe(fiscalConfig.contora_company_id, nota.contora_document_id, ambiente)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const statusMap: Record<string, string> = {
    authorized: 'autorizada',
    authorize_pending: 'processando',
    queued: 'processando',
    processing: 'processando',
    error: 'erro',
    cancelled: 'cancelada',
  }
  const msgErro = retorno.erros?.map(e => `[${e.codigo}] ${e.mensagem}`).join('; ')
  const status = msgErro ? 'erro' : (statusMap[retorno.processing_status ?? retorno.status ?? ''] ?? 'processando')

  await supabase
    .from('nfse')
    .update({
      status,
      numero: retorno.numero ?? undefined,
      codigo_verificacao: retorno.codigo_verificacao ?? undefined,
      erro_mensagem: msgErro ?? null,
      retorno_focusnfe: retorno,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)

  console.log('[sincronizar-nfse] id:', id, '| retorno:', JSON.stringify(retorno))

  return NextResponse.json({ ok: true, status, retorno })
}
