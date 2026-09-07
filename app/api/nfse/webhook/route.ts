import { NextRequest, NextResponse } from 'next/server'
import { consultarNFSe } from '@/lib/fiscal/focusnfe'
import { getSupabaseAdmin } from '@/lib/parceiro/auth'

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

  // Chamada externa da Focus NFe — nunca tem sessão de usuário (sem cookies),
  // então o client de sessão seria bloqueado pelo RLS e o update não
  // atualizaria nenhuma linha (silenciosamente). Service role, mesmo padrão
  // do webhook da Asaas.
  const supabase = getSupabaseAdmin()
  const { data: notaAtualizada, error: dbError } = await supabase
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
    .select('id, parceiro_empresa_id, referencia_externa, numero, tomador_razao_social, valor_servicos')
    .single()

  if (dbError) console.error('[nfse-webhook] erro ao atualizar banco:', dbError)
  else console.log('[nfse-webhook] nota atualizada para:', novoStatus, 'ref:', ref)

  // Se esta nota pertence a um parceiro externo (ex: GestorBIM), reencaminha
  // o resultado pro webhook_url dele — o parceiro nunca consulta a Focus NFe
  // nem sabe que ela existe, só recebe este retorno.
  if (notaAtualizada?.parceiro_empresa_id) {
    await encaminharWebhookParceiro(notaAtualizada.parceiro_empresa_id, {
      referenciaExterna: notaAtualizada.referencia_externa,
      notaId: notaAtualizada.id,
      status: novoStatus,
      numeroNota: retorno.numero ?? null,
      linkPdf: retorno.link_nfse_pdf ?? null,
      linkXml: retorno.link_nfse_xml ?? null,
      tomadorNome: notaAtualizada.tomador_razao_social,
      valor: notaAtualizada.valor_servicos,
      mensagemErro: erro ?? null,
    })
  }

  // Focus NFe espera HTTP 200 para confirmar recebimento
  return NextResponse.json({ ok: true })
}

async function encaminharWebhookParceiro(parceiroEmpresaId: string, payload: Record<string, unknown>) {
  const supabase = getSupabaseAdmin()
  const { data: empresa } = await supabase
    .from('parceiro_empresas')
    .select('webhook_url')
    .eq('id', parceiroEmpresaId)
    .single()

  if (!empresa?.webhook_url) return

  try {
    await fetch(empresa.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evento: 'nfse.atualizada', ...payload }),
    })
    console.log('[nfse-webhook] encaminhado para parceiro', parceiroEmpresaId, '->', empresa.webhook_url)
  } catch (err) {
    // Não derruba o webhook da Focus NFe por causa de uma falha no lado do
    // parceiro — a nota já foi salva corretamente no passo anterior. O
    // parceiro pode consultar GET /api/parceiro/v1/nfse/:id como fallback.
    console.error('[nfse-webhook] falha ao encaminhar para parceiro:', err)
  }
}
