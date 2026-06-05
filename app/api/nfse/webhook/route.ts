import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consultarNFSe } from '@/lib/fiscal/focusnfe'

// A Focus NFe chama este endpoint via GET quando o status de uma NFS-e muda.
// Parâmetros recebidos: ?ref=nfse_xxx_238&cnpj=37815890000108&status=autorizado
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ref    = searchParams.get('ref')
  const status = searchParams.get('status')

  console.log('[nfse-webhook] recebido ref:', ref, 'status:', status)

  if (!ref) return NextResponse.json({ ok: false, error: 'ref ausente' }, { status: 400 })

  // Consulta o status atualizado na Focus NFe
  let retorno
  try {
    retorno = await consultarNFSe(ref)
  } catch (err) {
    console.error('[nfse-webhook] erro ao consultar Focus NFe:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  const statusMap: Record<string, string> = {
    autorizado:              'autorizada',
    processando_autorizacao: 'processando',
    erro_autorizacao:        'erro',
    cancelado:               'cancelada',
  }
  const novoStatus = statusMap[retorno.status ?? ''] ?? 'processando'
  const erro = retorno.erros?.map(e => `${e.codigo}: ${e.mensagem}`).join('; ')

  const supabase = await createClient()
  const { error: dbError } = await supabase
    .from('nfse')
    .update({
      status:             novoStatus,
      numero:             retorno.numero ?? undefined,
      codigo_verificacao: retorno.codigo_verificacao ?? undefined,
      link_pdf:           retorno.link_nfse_pdf ?? undefined,
      link_xml:           retorno.link_nfse_xml ?? undefined,
      erro_mensagem:      erro ?? null,
      retorno_focusnfe:   retorno,
      updated_at:         new Date().toISOString(),
    })
    .eq('focus_ref', ref)

  if (dbError) console.error('[nfse-webhook] erro ao atualizar banco:', dbError)
  else console.log('[nfse-webhook] nota atualizada para:', novoStatus, 'ref:', ref)

  // Focus NFe espera HTTP 200 para confirmar recebimento
  return NextResponse.json({ ok: true })
}
