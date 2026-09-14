import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { emitirNFe, consultarNFe, isTokenConfigured, type ItemNFe } from '@/lib/fiscal/contora'
import { buscarCodigoMunicipio } from '@/lib/fiscal/ibge'

const REGIME_MAP: Record<string, string> = {
  simples:          '1',
  mei:              '1',
  lucro_presumido:  '3',
  lucro_real:       '3',
}

// A Contora calcula a base do ICMS/PIS/COFINS sozinha (quantidade × preço −
// desconto) — não há base_calculo manual.
function taxCodes(regime: string): Partial<ItemNFe> {
  const isSimples = regime === '1'
  if (isSimples) {
    return {
      icms_origem:               '0',
      icms_situacao_tributaria:  '400',
      pis_situacao_tributaria:   '07',
      cofins_situacao_tributaria:'07',
    }
  }
  // Lucro Presumido / Real — alíquotas padrão
  return {
    icms_origem:                  '0',
    icms_situacao_tributaria:     '00',
    icms_aliquota:                12,
    pis_situacao_tributaria:      '01',
    pis_aliquota_porcentual:      1.65,
    cofins_situacao_tributaria:   '01',
    cofins_aliquota_porcentual:   7.6,
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json() as {
    natureza_operacao: string
    consumidor_final: boolean
    presenca_comprador: string
    destinatario: {
      nome: string
      cnpj?: string
      cpf?: string
      email?: string
      logradouro: string
      numero: string
      bairro: string
      municipio: string
      uf: string
      cep: string
    }
    itens: Array<{
      codigo_produto: string
      descricao: string
      ncm: string
      cfop: string
      unidade: string
      quantidade: number
      valor_unitario: number
      desconto: number
    }>
    frete: {
      modalidade: string
      transportadora_nome?: string
      transportadora_cnpj?: string
      placa?: string
      uf_placa?: string
    }
  }

  // Dados do emitente
  const { data: perfil } = await supabase
    .from('perfil_empresa')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!perfil?.cnpj_cpf || !perfil?.razao_social) {
    return NextResponse.json({ error: 'Preencha o CNPJ e Razão Social no Perfil da Empresa.' }, { status: 400 })
  }

  const regime = REGIME_MAP[perfil.regime_tributario as string] ?? '1'

  // Monta itens com tributação. valorBruto aqui é só pra exibição/total local
  // — quem calcula a base fiscal de verdade agora é a Contora (quantidade ×
  // preço − desconto), então mandamos o desconto como valor, não embutido no preço.
  const itens: ItemNFe[] = body.itens.map((it) => {
    const desconto = it.desconto ?? 0
    const valorDesconto = Math.round(it.quantidade * it.valor_unitario * (desconto / 100) * 100) / 100
    return {
      codigo_produto:           it.codigo_produto || 'PROD',
      descricao:                it.descricao,
      codigo_ncm:               it.ncm?.replace(/\D/g, '') || '00000000',
      cfop:                     it.cfop || '5102',
      unidade_comercial:        it.unidade || 'UN',
      quantidade_comercial:     it.quantidade,
      valor_unitario_comercial: it.valor_unitario,
      valor_desconto:           valorDesconto || undefined,
      ...taxCodes(regime),
    } as ItemNFe
  })
  const valorBrutoItem = (it: ItemNFe) => it.quantidade_comercial * it.valor_unitario_comercial - (it.valor_desconto ?? 0)

  const ref = `nfe-${user.id.slice(0, 8)}-${Date.now()}`
  // SEFAZ exige data_emissao em horário local brasileiro (UTC-3) com offset;
  // sem isso, rejeição 703 "Data-Hora de Emissao posterior ao horario de recebimento".
  const agoraUtc = new Date()
  const agoraBR = new Date(agoraUtc.getTime() - 3 * 60 * 60 * 1000)
  const dataEmissao = agoraBR.toISOString().slice(0, 19) + '-03:00'

  // Busca numeração e empresa/ambiente configurados na Contora
  const { data: fiscalCfg } = await supabase
    .from('fiscal_config')
    .select('numero_proximo_nfe, serie_nfe, contora_company_id, ambiente')
    .eq('user_id', user.id)
    .single()

  // Se token não configurado → salva localmente como "emitida simulada"
  if (!isTokenConfigured()) {
    const valorTotal = itens.reduce((s, it) => s + valorBrutoItem(it), 0)

    const { data: maxRow } = await supabase
      .from('nfe_emitidas')
      .select('numero')
      .eq('user_id', user.id)
      .order('numero', { ascending: false })
      .limit(1)
      .single()

    const numeroConfigurado = fiscalCfg?.numero_proximo_nfe ?? 1
    const maxEmitido = maxRow ? (maxRow.numero as number) + 1 : null
    const numero = maxEmitido !== null ? Math.max(maxEmitido, numeroConfigurado) : numeroConfigurado
    const serie = fiscalCfg?.serie_nfe ?? '1'

    await supabase.from('nfe_emitidas').insert({
      user_id: user.id,
      numero,
      serie,
      natureza_operacao: body.natureza_operacao,
      data_emissao: dataEmissao.slice(0, 10),
      destinatario: body.destinatario.nome,
      cnpj_destinatario: body.destinatario.cnpj || body.destinatario.cpf || null,
      email_destinatario: body.destinatario.email || null,
      logradouro_destinatario: body.destinatario.logradouro || null,
      numero_destinatario: body.destinatario.numero || null,
      bairro_destinatario: body.destinatario.bairro || null,
      municipio_destinatario: body.destinatario.municipio || null,
      uf_destinatario: body.destinatario.uf || null,
      cep_destinatario: body.destinatario.cep || null,
      valor_total: valorTotal,
      status: 'emitida',
      tipo: 'saida',
      itens,
      transportadora: body.frete.transportadora_nome || null,
      focus_ref: ref,
      ambiente: 'local',
    })

    // Incrementa o próximo número para a nota seguinte
    await supabase.from('fiscal_config').update({
      numero_proximo_nfe: numero + 1,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id)

    return NextResponse.json({
      ok: true,
      simulada: true,
      numero,
      serie,
      aviso: 'Token Fiscal Contora não configurado — nota registrada localmente.',
    })
  }

  if (!fiscalCfg?.contora_company_id) {
    return NextResponse.json({ error: 'Ative o módulo fiscal e cadastre a empresa antes de emitir' }, { status: 400 })
  }
  const ambiente = (fiscalCfg.ambiente as 'homologacao' | 'producao' | undefined) ?? 'homologacao'
  const numeroConfiguradoInicial = fiscalCfg?.numero_proximo_nfe ?? 1
  const serieConfiguradaInicial = fiscalCfg?.serie_nfe ?? '1'

  // A Contora exige código IBGE (7 dígitos) no endereço, não o nome da
  // cidade — o formulário só coleta o nome, então resolvemos aqui.
  const codigoMunicipioDestinatario = await buscarCodigoMunicipio(body.destinatario.municipio, body.destinatario.uf)
  if (body.destinatario.logradouro && !codigoMunicipioDestinatario) {
    return NextResponse.json(
      { error: `Não foi possível identificar o código IBGE do município "${body.destinatario.municipio}/${body.destinatario.uf}". Confira o nome da cidade.` },
      { status: 400 }
    )
  }

  const retorno = await emitirNFe({
    companyId: fiscalCfg.contora_company_id,
    ambiente,
    documentType: 'nfe',
    series: Number(serieConfiguradaInicial) || undefined,
    number: numeroConfiguradoInicial,
    natureza_operacao:    body.natureza_operacao,
    operation_type:       'saida',
    consumidor_final:     body.consumidor_final,
    presence_indicator:   body.presenca_comprador ? Number(body.presenca_comprador) : 9,
    nome_destinatario:    body.destinatario.nome,
    cnpj_destinatario:    body.destinatario.cnpj,
    cpf_destinatario:     body.destinatario.cpf,
    logradouro_destinatario: body.destinatario.logradouro,
    numero_destinatario:  body.destinatario.numero,
    bairro_destinatario:  body.destinatario.bairro,
    codigo_municipio_destinatario: codigoMunicipioDestinatario ?? undefined,
    municipio_destinatario: body.destinatario.municipio,
    uf_destinatario:      body.destinatario.uf,
    cep_destinatario:     body.destinatario.cep,
    itens,
  })

  if (retorno.erros && retorno.erros.length > 0) {
    return NextResponse.json({ error: retorno.erros.map(e => `[${e.codigo}] ${e.mensagem}`).join('; ') }, { status: 422 })
  }
  const documentId = retorno.documentId
  if (!documentId) {
    return NextResponse.json({ error: 'Contora não retornou o id do documento' }, { status: 502 })
  }

  // Aguarda autorização (polling até 20s) — a Contora processa em fila.
  // Inclui 'draft' porque é o estado logo após o dispatch, antes da fila
  // pegar o job; se continuar 'draft' com attempts_count 0 no fim do loop,
  // a fila da Contora nunca pegou o documento (ver statusFinal abaixo).
  let resultado = retorno
  const emProcessamento = (r: typeof retorno) =>
    r.processing_status === 'queued' || r.processing_status === 'processing' || r.processing_status === 'draft'
  if (emProcessamento(resultado)) {
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 2500))
      resultado = await consultarNFe(fiscalCfg.contora_company_id, documentId, ambiente)
      if (!emProcessamento(resultado)) break
    }
  }

  const autorizado = resultado.status === 'authorized'
  const valorTotal = itens.reduce((s, it) => s + valorBrutoItem(it), 0)

  // Normaliza o status bruto da Contora pro mesmo vocabulário usado em toda a
  // UI (rascunho/emitida/processando/erro/cancelada) — mesmo mapa usado em
  // app/api/nfse/webhook e app/api/nfse/sincronizar.
  const statusMap: Record<string, string> = {
    authorized: 'emitida',
    authorize_pending: 'processando',
    queued: 'processando',
    processing: 'processando',
    error: 'erro',
    cancelled: 'cancelada',
  }
  const statusFinal = autorizado ? 'emitida' : (statusMap[resultado.processing_status ?? resultado.status ?? ''] ?? 'processando')

  // Documento nunca saiu de "draft" mesmo após o polling e a fila nunca
  // tentou processá-lo — não é lentidão normal, é a fila da Contora não
  // tendo pego o job. Guarda uma mensagem clara em vez de deixar
  // "processando" silencioso sem explicação.
  const presoSemFila = resultado.processing_status === 'draft' && (resultado.attempts_count ?? 0) === 0
  const mensagemPresoSemFila = presoSemFila
    ? 'A Contora ainda não iniciou o processamento desta nota (não entrou na fila). Clique em "Sincronizar status" em alguns minutos; se persistir, contate o suporte da Contora.'
    : null

  // Em produção, usa o número retornado pela SEFAZ via Contora. Em
  // homologação, a numeração de teste pode divergir da sequência local, então
  // mantemos o número configurado pelo usuário pra não perder a continuidade.
  const emProducao = ambiente === 'producao'
  const numeroFinal = emProducao && resultado.numero
    ? Number(resultado.numero)
    : numeroConfiguradoInicial
  const serieFinal = resultado.serie ?? serieConfiguradaInicial

  await supabase.from('nfe_emitidas').insert({
    user_id: user.id,
    contora_document_id: documentId,
    numero: numeroFinal,
    serie: serieFinal,
    chave_acesso: resultado.chave_nfe ?? null,
    natureza_operacao: body.natureza_operacao,
    data_emissao: dataEmissao.slice(0, 10),
    destinatario: body.destinatario.nome,
    cnpj_destinatario: body.destinatario.cnpj || body.destinatario.cpf || null,
    email_destinatario: body.destinatario.email || null,
    logradouro_destinatario: body.destinatario.logradouro || null,
    numero_destinatario: body.destinatario.numero || null,
    bairro_destinatario: body.destinatario.bairro || null,
    municipio_destinatario: body.destinatario.municipio || null,
    uf_destinatario: body.destinatario.uf || null,
    cep_destinatario: body.destinatario.cep || null,
    valor_total: valorTotal,
    status: statusFinal,
    erro_mensagem: resultado.erros?.map(e => e.mensagem).join('; ') ?? mensagemPresoSemFila,
    tipo: 'saida',
    itens,
    transportadora: body.frete.transportadora_nome || null,
    ambiente,
  })

  // Incrementa o próximo número para a nota seguinte
  await supabase.from('fiscal_config').update({
    numero_proximo_nfe: numeroFinal + 1,
    updated_at: new Date().toISOString(),
  }).eq('user_id', user.id)

  return NextResponse.json({
    ok: autorizado,
    status: statusFinal,
    numero: String(numeroFinal),
    serie: serieFinal,
    chave_nfe: resultado.chave_nfe,
    mensagem_sefaz: resultado.mensagem_sefaz,
  })
}
