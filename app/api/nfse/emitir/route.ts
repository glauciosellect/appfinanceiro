import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { emitirNFSe } from '@/lib/fiscal/contora'
import { buscarCodigoMunicipio } from '@/lib/fiscal/ibge'

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
    codigo_cnae,
    ibs_cbs_situacao_tributaria,
    ibs_cbs_classificacao_tributaria,
    codigo_indicador_operacao,
    codigo_nbs,
  } = body

  // Dados fiscais do prestador (por cliente — multi-tenant)
  const { data: fiscalConfig } = await supabase
    .from('fiscal_config')
    .select('numero_proximo_nfse, serie_nfse, contora_company_id, ambiente')
    .eq('user_id', user.id)
    .single()

  if (!fiscalConfig?.contora_company_id) {
    return NextResponse.json({ error: 'Ative o módulo fiscal e cadastre a empresa antes de emitir' }, { status: 400 })
  }

  // Próximo número RPS
  const { data: ultimaRow } = await supabase
    .from('nfse')
    .select('numero_rps')
    .eq('user_id', user.id)
    .order('numero_rps', { ascending: false })
    .limit(1)
    .single()

  const baseRps = fiscalConfig?.numero_proximo_nfse ?? 1
  const ultimoRps = (ultimaRow?.numero_rps ?? 0) as number
  const numero_rps = Math.max(baseRps, ultimoRps + 1)
  const data_emissao = new Date().toISOString()
  const ambiente = (fiscalConfig.ambiente as 'homologacao' | 'producao' | undefined) ?? 'homologacao'

  const tomadorCodigoMunicipio = tomador_logradouro
    ? await buscarCodigoMunicipio(tomador_municipio, tomador_uf)
    : null

  const payload = {
    companyId: fiscalConfig.contora_company_id as string,
    ambiente,
    number: numero_rps,
    tomador_razao_social,
    tomador_cnpj,
    tomador_cpf,
    tomador_email,
    tomador_logradouro,
    tomador_numero,
    tomador_bairro,
    tomador_codigo_municipio: tomadorCodigoMunicipio ?? undefined,
    tomador_uf,
    tomador_cep,
    valor_servicos: Number(valor_servicos),
    iss_withheld: Boolean(iss_retido),
    iss_rate: aliquota_iss ? Number(aliquota_iss) : undefined,
    // codigo_lc116 (ex: "14.06") não é o national_tax_code de 6 dígitos direto —
    // a Contora deriva boa parte disso sozinha quando cnae/nbs são informados;
    // passamos os dois códigos brutos e deixamos a API validar/derivar.
    municipal_tax_code: codigo_servico ?? undefined,
    national_tax_code: codigo_lc116 ? codigo_lc116.replace(/\D/g, '').padEnd(6, '0') : undefined,
    nbs_code: codigo_nbs ?? undefined,
    cnae: codigo_cnae ?? undefined,
    descricao: discriminacao,
  }

  let retorno
  try {
    retorno = await emitirNFSe(payload)
    console.log('[emitir-nfse] payload:', JSON.stringify(payload))
    console.log('[emitir-nfse] retorno Fiscal Contora:', JSON.stringify(retorno))
  } catch (err) {
    console.error('[emitir-nfse] erro:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  if (retorno.erros && retorno.erros.length > 0) {
    const erroMsg = retorno.erros.map(e => `[${e.codigo}] ${e.mensagem}`).join('; ')
    console.error('[emitir-nfse] erro Fiscal Contora:', erroMsg)
    return NextResponse.json({ ok: false, error: erroMsg, retorno }, { status: 422 })
  }

  // A Contora processa em fila (draft -> dispatch -> autorizado/erro de forma
  // assíncrona) — o status inicial normalmente é "processando" e
  // app/api/nfse/sincronizar faz o polling até autorizar.
  const statusMap: Record<string, string> = {
    authorized: 'autorizada',
    authorize_pending: 'processando',
    queued: 'processando',
    processing: 'processando',
    error: 'erro',
    cancelled: 'cancelada',
  }
  const status = statusMap[retorno.processing_status ?? retorno.status ?? ''] ?? 'processando'
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
      contora_document_id: retorno.documentId,
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
      ambiente,
      erro_mensagem: erro ?? null,
      payload_enviado: payload,
      retorno_provedor: retorno,
    })
    .select()
    .single()

  if (dbError) {
    console.error('Erro ao salvar NFS-e no banco:', dbError)
  }

  return NextResponse.json({ ok: true, status, retorno, nfse: nfseRow })
}
