import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { emitirNFSe, getAmbiente } from '@/lib/fiscal/focusnfe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const {
    tomador_razao_social,
    tomador_cnpj,
    tomador_cpf,
    tomador_email,
    valor_servicos,
    iss_retido,
    aliquota_iss,
    codigo_servico,
    codigo_lc116,
    discriminacao,
    data_competencia,
  } = body

  // Próximo número RPS para este usuário
  const { data: ultimaRow } = await supabase
    .from('nfse')
    .select('numero_rps')
    .eq('user_id', user.id)
    .order('numero_rps', { ascending: false })
    .limit(1)
    .single()

  const numero_rps = ((ultimaRow?.numero_rps ?? 0) as number) + 1
  const ref = `nfse-${user.id.slice(0, 8)}-${numero_rps}`
  const data_emissao = new Date().toISOString()

  const payload = {
    ref,
    tomador_razao_social,
    tomador_cnpj,
    tomador_cpf,
    tomador_email,
    valor_servicos: Number(valor_servicos),
    iss_retido: Boolean(iss_retido),
    aliquota_iss: aliquota_iss ? Number(aliquota_iss) : undefined,
    codigo_servico,
    codigo_lc116,
    discriminacao,
    data_emissao,
    data_competencia,
    numero_rps,
    serie_rps: 'RPS',
  }

  let retorno
  try {
    retorno = await emitirNFSe(payload)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  // Determina status com base no retorno
  const statusMap: Record<string, string> = {
    autorizado: 'autorizada',
    processando_autorizacao: 'processando',
    erro_autorizacao: 'erro',
    cancelado: 'cancelada',
  }
  const status = statusMap[retorno.status ?? ''] ?? 'processando'
  const erro = retorno.erros?.map(e => e.mensagem).join('; ')

  const { data: nfseRow, error: dbError } = await supabase
    .from('nfse')
    .insert({
      user_id: user.id,
      focus_uuid: retorno.uuid,
      focus_ref: ref,
      numero: retorno.numero,
      numero_rps,
      serie_rps: 'RPS',
      status,
      tomador_razao_social,
      tomador_cnpj_cpf: tomador_cnpj ?? tomador_cpf,
      tomador_email,
      valor_servicos: Number(valor_servicos),
      valor_iss: aliquota_iss ? (Number(valor_servicos) * Number(aliquota_iss)) / 100 : null,
      valor_liquido: iss_retido
        ? Number(valor_servicos) - (aliquota_iss ? (Number(valor_servicos) * Number(aliquota_iss)) / 100 : 0)
        : Number(valor_servicos),
      aliquota_iss: aliquota_iss ? Number(aliquota_iss) : null,
      iss_retido: Boolean(iss_retido),
      discriminacao,
      codigo_servico,
      codigo_lc116,
      data_emissao,
      data_competencia,
      codigo_verificacao: retorno.codigo_verificacao,
      link_pdf: retorno.link_nfse_pdf,
      link_xml: retorno.link_nfse_xml,
      ambiente: getAmbiente(),
      erro_mensagem: erro ?? null,
      payload_enviado: payload,
      retorno_focusnfe: retorno,
    })
    .select()
    .single()

  if (dbError) {
    console.error('Erro ao salvar NFS-e no banco:', dbError)
  }

  return NextResponse.json({ ok: true, status, retorno, nfse: nfseRow })
}
