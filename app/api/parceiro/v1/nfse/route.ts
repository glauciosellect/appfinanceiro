import { NextRequest, NextResponse } from 'next/server'
import { autenticarParceiro, getSupabaseAdmin } from '@/lib/parceiro/auth'
import { emitirNFSe } from '@/lib/fiscal/contora'
import { buscarCodigoMunicipio } from '@/lib/fiscal/ibge'

// Emissão de NFS-e por um parceiro externo (ex: GestorBIM), autenticado por
// API key em vez de sessão Supabase. Espelha app/api/nfse/emitir/route.ts,
// mas resolve os dados fiscais do prestador a partir de `parceiro_empresas`
// (a própria linha já É a config fiscal) em vez de `fiscal_config` por
// user_id, e chama a MESMA função emitirNFSe() da Contora — nenhuma
// duplicação da integração fiscal real.
export async function POST(req: NextRequest) {
  const empresa = await autenticarParceiro(req)
  if (!empresa) return NextResponse.json({ error: 'Chave de API inválida.' }, { status: 401 })
  if (!empresa.habilita_nfse) {
    return NextResponse.json({ error: 'NFS-e não habilitada para esta empresa.' }, { status: 403 })
  }
  if (!empresa.contora_company_id) {
    return NextResponse.json({ error: 'Empresa parceira sem cadastro na Contora (contora_company_id ausente).' }, { status: 400 })
  }

  const body = await req.json()
  const {
    referencia_externa, // id da nota do lado do parceiro (ex: parcelaId do GestorBIM) — só para o webhook de volta
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

  if (!tomador_razao_social || !valor_servicos || !codigo_servico || !codigo_lc116 || !discriminacao) {
    return NextResponse.json(
      { error: 'Campos obrigatórios: tomador_razao_social, valor_servicos, codigo_servico, codigo_lc116, discriminacao.' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseAdmin()

  const { data: ultimaRow } = await supabase
    .from('nfse')
    .select('numero_rps')
    .eq('parceiro_empresa_id', empresa.id)
    .order('numero_rps', { ascending: false })
    .limit(1)
    .single()

  const baseRps = empresa.numero_proximo_nfse ?? 1
  const ultimoRps = (ultimaRow?.numero_rps ?? 0) as number
  const numero_rps = Math.max(baseRps, ultimoRps + 1)
  const data_emissao = new Date().toISOString()
  const ambiente = (empresa.ambiente as 'homologacao' | 'producao' | undefined) ?? 'homologacao'
  const tomadorCodigoMunicipio = tomador_logradouro
    ? await buscarCodigoMunicipio(tomador_municipio, tomador_uf)
    : null

  const payload = {
    companyId: empresa.contora_company_id as string,
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
    municipal_tax_code: codigo_servico ?? undefined,
    national_tax_code: codigo_lc116 ? String(codigo_lc116).replace(/\D/g, '').padEnd(6, '0') : undefined,
    descricao: discriminacao,
  }

  let retorno
  try {
    retorno = await emitirNFSe(payload)
    console.log('[parceiro/nfse] parceiro_empresa_id:', empresa.id, 'payload:', JSON.stringify(payload))
    console.log('[parceiro/nfse] retorno Fiscal Contora:', JSON.stringify(retorno))
  } catch (err) {
    console.error('[parceiro/nfse] erro:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  if (retorno.erros && retorno.erros.length > 0) {
    const erroMsg = retorno.erros.map((e) => `${e.codigo}: ${e.mensagem}`).join('; ')
    console.error('[parceiro/nfse] erros Fiscal Contora:', erroMsg)
    return NextResponse.json({ ok: false, error: erroMsg, retorno }, { status: 422 })
  }

  const statusMap: Record<string, string> = {
    authorized: 'autorizada',
    authorize_pending: 'processando',
    queued: 'processando',
    processing: 'processando',
    error: 'erro',
    cancelled: 'cancelada',
  }
  const status = statusMap[retorno.processing_status ?? retorno.status ?? ''] ?? 'processando'
  const erro = retorno.erros?.map((e) => `${e.codigo}: ${e.mensagem}`).join('; ')

  const enderecoTomador = [tomador_logradouro, tomador_numero, tomador_complemento, tomador_bairro]
    .filter(Boolean)
    .join(', ')
  const cidadeTomador = tomador_municipio
    ? `${tomador_municipio}${tomador_uf ? '/' + tomador_uf : ''}${tomador_cep ? ' - ' + tomador_cep : ''}`
    : null

  const { data: nfseRow, error: dbError } = await supabase
    .from('nfse')
    .insert({
      parceiro_empresa_id: empresa.id,
      referencia_externa: referencia_externa ?? null,
      contora_document_id: retorno.documentId,
      numero: retorno.numero,
      numero_rps,
      serie_rps: empresa.serie_nfse ?? 'RPS',
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
      data_competencia: data_competencia ?? data_emissao.slice(0, 10),
      codigo_verificacao: retorno.codigo_verificacao,
      ambiente,
      erro_mensagem: erro ?? null,
      payload_enviado: payload,
      retorno_provedor: retorno,
      tomador_endereco: enderecoTomador || null,
      tomador_cidade: cidadeTomador ?? null,
    })
    .select()
    .single()

  if (dbError) console.error('[parceiro/nfse] erro ao salvar no banco:', dbError)

  return NextResponse.json({ ok: true, status, retorno, nfse: nfseRow }, { status: 201 })
}

// Lista as notas emitidas por este parceiro (paginação simples).
export async function GET(req: NextRequest) {
  const empresa = await autenticarParceiro(req)
  if (!empresa) return NextResponse.json({ error: 'Chave de API inválida.' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('nfse')
    .select('*')
    .eq('parceiro_empresa_id', empresa.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notas: data })
}
