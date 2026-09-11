import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consultarNFe } from '@/lib/fiscal/contora'

// Consulta o status atual de uma NF-e na Contora/SEFAZ — usado quando a
// emissão original ficou "processando" (a espera de até 20s em
// app/api/fiscal/emitir-nfe/route.ts não é suficiente pra toda autorização),
// mesmo padrão de app/api/nfse/sincronizar/route.ts.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = (await req.json()) as { id: string }
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  const [{ data: nota }, { data: fiscalConfig }] = await Promise.all([
    supabase.from('nfe_emitidas').select('contora_document_id').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('fiscal_config').select('contora_company_id, ambiente').eq('user_id', user.id).single(),
  ])

  if (!nota?.contora_document_id || !fiscalConfig?.contora_company_id) {
    return NextResponse.json({ error: 'Nota ou empresa não encontrada na Contora' }, { status: 400 })
  }
  const ambiente = (fiscalConfig.ambiente as 'homologacao' | 'producao' | undefined) ?? 'homologacao'

  let retorno
  try {
    retorno = await consultarNFe(fiscalConfig.contora_company_id, nota.contora_document_id, ambiente)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const statusMap: Record<string, string> = {
    authorized: 'emitida',
    authorize_pending: 'processando',
    queued: 'processando',
    processing: 'processando',
    error: 'erro',
    cancelled: 'cancelada',
  }
  const msgErro = retorno.erros?.map(e => `[${e.codigo}] ${e.mensagem}`).join('; ') ?? retorno.mensagem_sefaz ?? null
  const status = msgErro ? 'erro' : (statusMap[retorno.processing_status ?? retorno.status ?? ''] ?? 'processando')

  const { error: dbError } = await supabase
    .from('nfe_emitidas')
    .update({
      status,
      chave_acesso: retorno.chave_nfe ?? undefined,
      numero: retorno.numero ? Number(retorno.numero) : undefined,
      serie: retorno.serie ?? undefined,
      erro_mensagem: msgErro,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (dbError) console.error('[sincronizar-nfe] erro ao atualizar banco:', dbError)
  console.log('[sincronizar-nfe] id:', id, '| retorno:', JSON.stringify(retorno))

  return NextResponse.json({ ok: true, status, retorno })
}
