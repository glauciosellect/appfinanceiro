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
    tomador_telefone,
    tomador_logradouro,
    tomador_numero,
    tomador_complemento,
    tomador_bairro,
    tomador_municipio,
    tomador_uf,
    tomador_cep,
    valor_servicos,
    iss_retido,
    aliquota_iss,
    codigo_servico,
    codigo_lc116,
    discriminacao,
    data_competencia,
  } = body

  // Dados fiscais do prestador (por cliente — multi-tenant)
  const { data: fiscalConfig } = await supabase
    .from('fiscal_config')
    .select('inscricao_municipal, cnpj, numero_proximo_nfse, serie_nfse')
    .eq('user_id', user.id)
    .single()

  // Próximo número RPS
  const { data: ultimaRow } = await supabase
    .from('nfse')
    .select('numero_rps')
    .eq('user_id', user.id)
    .order('numero_rps', { ascending: false })
    .limit(1)
    .single()

  const baseRps = fiscalConfig?.numero_proximo_nfse ?? parseInt(process.env.NFSE_PROXIMO_RPS ?? '1', 10)
  const ultimoRps = (ultimaRow?.numero_rps ?? 0) as number
  const numero_rps = Math.max(baseRps, ultimoRps + 1)
  const ref = `nfse_${user.id.replace(/-/g, '').slice(0, 8)}_${numero_rps}`
  const data_emissao = new Date().toISOString()

  const payload = {
    ref,
    tomador_razao_social,
    tomador_cnpj,
    tomador_cpf,
    tomador_email,
    tomador_telefone,
    tomador_logradouro,
    tomador_numero,
    tomador_complemento,
    tomador_bairro,
    tomador_municipio,
    tomador_uf,
    tomador_cep,
    valor_servicos: Number(valor_servicos),
    iss_retido: Boolean(iss_retido),
    aliquota_iss: aliquota_iss ? Number(aliquota_iss) : undefined,
    codigo_servico,
    codigo_lc116,
    discriminacao,
    data_emissao,
    data_competencia,
    numero_rps,
    serie_rps: fiscalConfig?.serie_nfse ?? 'RPS',
    inscricao_municipal_prestador: fiscalConfig?.inscricao_municipal ?? process.env.EMITENTE_INSCRICAO_MUNICIPAL ?? undefined,
  }

  let retorno
  try {
    retorno = await emitirNFSe(payload)
    console.log('[emitir-nfse] payload:', JSON.stringify(payload))
    console.log('[emitir-nfse] retorno Focus NFe:', JSON.stringify(retorno))
  } catch (err) {
    console.error('[emitir-nfse] erro:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  // Se a Focus NFe retornou erro (nota não criada), retorna erro imediatamente
  if (retorno.erros && retorno.erros.length > 0) {
    const erroMsg = retorno.erros.map(e => `${e.codigo}: ${e.mensagem}`).join('; ')
    console.error('[emitir-nfse] erros Focus NFe:', erroMsg)
    return NextResponse.json({ ok: false, error: erroMsg, retorno }, { status: 422 })
  }

  const statusMap: Record<string, string> = {
    autorizado: 'autorizada',
    processando_autorizacao: 'processando',
    erro_autorizacao: 'erro',
    cancelado: 'cancelada',
  }
  const status = statusMap[retorno.status ?? ''] ?? 'processando'
  const erro = retorno.erros?.map(e => `${e.codigo}: ${e.mensagem}`).join('; ')

  const enderecoTomador = [tomador_logradouro, tomador_numero, tomador_complemento, tomador_bairro]
    .filter(Boolean).join(', ')
  const cidadeTomador = tomador_municipio
    ? `${tomador_municipio}${tomador_uf ? '/' + tomador_uf : ''}${tomador_cep ? ' - ' + tomador_cep : ''}`
    : null

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
      tomador_telefone: tomador_telefone ?? null,
      tomador_endereco: enderecoTomador || null,
      tomador_cidade: cidadeTomador ?? null,
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
