import { NextRequest, NextResponse } from 'next/server'
import { consultarNFSe, verificarAssinaturaWebhook } from '@/lib/fiscal/contora'
import { getSupabaseAdmin } from '@/lib/parceiro/auth'

// A Contora chama este endpoint via POST, assinado em X-Fiscal-Signature
// (HMAC-SHA256 do corpo cru com CONTORA_WEBHOOK_SECRET) — diferente da Focus
// NFe, que usava GET com ?ref=. Um único endpoint recebe eventos de todas as
// empresas/documentos da conta; a nota é localizada por document_id.
//
// Formato do payload inferido do schema (WebhookTestPing) — evento em
// `event`, documento em `data`/`document` — mas ainda não confirmado com uma
// entrega real. Use POST /webhooks/{endpoint}/test para validar e ajustar os
// caminhos abaixo se o formato real vier diferente.
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const assinatura = req.headers.get('x-fiscal-signature')
  const secret = process.env.CONTORA_WEBHOOK_SECRET ?? ''

  if (!secret || !verificarAssinaturaWebhook(rawBody, assinatura, secret)) {
    console.error('[nfse-webhook] assinatura inválida ou CONTORA_WEBHOOK_SECRET não configurado')
    return NextResponse.json({ ok: false, error: 'assinatura inválida' }, { status: 401 })
  }

  const body = JSON.parse(rawBody) as Record<string, unknown>
  const evento = body.event as string | undefined
  const eventData = (body.data ?? body.document ?? {}) as Record<string, unknown>
  const companyId = (eventData.company_id ?? body.company_id) as string | undefined
  const documentId = (eventData.id ?? eventData.document_id ?? body.document_id) as string | undefined
  const ambiente = (eventData.environment as 'homologacao' | 'producao' | undefined) ?? 'producao'

  console.log('[nfse-webhook] recebido evento:', evento, 'document_id:', documentId, 'payload:', rawBody)

  if (!documentId) return NextResponse.json({ ok: false, error: 'document_id ausente' }, { status: 400 })

  // Consulta o status atualizado na Contora (fonte da verdade — o evento em
  // si só dispara a consulta, evita confiar cegamente no payload do webhook)
  let retorno
  try {
    // company_id do evento cobre o caso de a nota já não estar mais só no
    // tenant local; se ausente, a consulta abaixo falha e cai no catch.
    retorno = companyId ? await consultarNFSe(companyId, documentId, ambiente) : null
  } catch (err) {
    console.error('[nfse-webhook] erro ao consultar Fiscal Contora:', err)
    retorno = null
  }

  const statusMap: Record<string, string> = {
    authorized: 'autorizada',
    authorize_pending: 'processando',
    queued: 'processando',
    processing: 'processando',
    error: 'erro',
    cancelled: 'cancelada',
  }
  const erro = retorno?.erros?.map(e => `[${e.codigo}] ${e.mensagem}`).join('; ')
  const novoStatus = erro ? 'erro' : (statusMap[retorno?.processing_status ?? retorno?.status ?? ''] ?? 'processando')

  // Chamada externa da Contora — nunca tem sessão de usuário (sem cookies),
  // então o client de sessão seria bloqueado pelo RLS e o update não
  // atualizaria nenhuma linha (silenciosamente). Service role, mesmo padrão
  // do webhook da Asaas.
  const supabase = getSupabaseAdmin()
  const { data: notaAtualizada, error: dbError } = await supabase
    .from('nfse')
    .update({
      status:             novoStatus,
      numero:             retorno?.numero ?? undefined,
      codigo_verificacao: retorno?.codigo_verificacao ?? undefined,
      erro_mensagem:      erro ?? null,
      retorno_focusnfe:   retorno,
      updated_at:         new Date().toISOString(),
    })
    .eq('contora_document_id', documentId)
    .select('id, parceiro_empresa_id, referencia_externa, numero, tomador_razao_social, valor_servicos')
    .single()

  if (dbError) console.error('[nfse-webhook] erro ao atualizar banco:', dbError)
  else console.log('[nfse-webhook] nota atualizada para:', novoStatus, 'document_id:', documentId)

  // Se esta nota pertence a um parceiro externo (ex: GestorBIM), reencaminha
  // o resultado pro webhook_url dele — o parceiro nunca consulta a Contora
  // nem sabe que ela existe, só recebe este retorno.
  //
  // TODO: linkPdf/linkXml ainda não existem — a Contora exige Bearer token
  // pra baixar artefato (não é mais um link público como na Focus NFe).
  // Falta criar a rota proxy (ver baixarArtefato() em lib/fiscal/contora.ts)
  // antes de preencher isso com uma URL real.
  if (notaAtualizada?.parceiro_empresa_id) {
    await encaminharWebhookParceiro(notaAtualizada.parceiro_empresa_id, {
      referenciaExterna: notaAtualizada.referencia_externa,
      notaId: notaAtualizada.id,
      status: novoStatus,
      numeroNota: retorno?.numero ?? null,
      linkPdf: null,
      linkXml: null,
      tomadorNome: notaAtualizada.tomador_razao_social,
      valor: notaAtualizada.valor_servicos,
      mensagemErro: erro ?? null,
    })
  }

  // A Contora espera HTTP 200 para confirmar recebimento
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
