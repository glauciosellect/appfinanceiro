import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consultarNFSe } from '@/lib/fiscal/focusnfe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { ref, id } = await req.json() as { ref: string; id: string }
  if (!ref || !id) return NextResponse.json({ error: 'ref e id são obrigatórios' }, { status: 400 })

  let retorno
  try {
    retorno = await consultarNFSe(ref)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const statusMap: Record<string, string> = {
    autorizado: 'autorizada',
    processando_autorizacao: 'processando',
    erro_autorizacao: 'erro',
    cancelado: 'cancelada',
  }
  const status = statusMap[retorno.status ?? ''] ?? 'processando'
  const erro = retorno.erros?.map(e => e.mensagem).join('; ')

  await supabase
    .from('nfse')
    .update({
      status,
      numero: retorno.numero ?? undefined,
      codigo_verificacao: retorno.codigo_verificacao ?? undefined,
      link_pdf: retorno.link_nfse_pdf ?? undefined,
      link_xml: retorno.link_nfse_xml ?? undefined,
      erro_mensagem: erro ?? null,
      retorno_focusnfe: retorno,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true, status, retorno })
}
