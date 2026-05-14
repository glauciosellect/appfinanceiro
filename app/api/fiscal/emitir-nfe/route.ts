import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { emitirNFe, consultarNFe, isTokenConfigured, type ItemNFe } from '@/lib/fiscal/focusnfe'

const REGIME_MAP: Record<string, string> = {
  simples:          '1',
  mei:              '1',
  lucro_presumido:  '3',
  lucro_real:       '3',
}

function taxCodes(regime: string, valorBase: number): Partial<ItemNFe> {
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
    icms_modalidade_base_calculo: '3',
    icms_base_calculo:            valorBase,
    icms_aliquota:                12,
    pis_situacao_tributaria:      '01',
    pis_base_calculo:             valorBase,
    pis_aliquota_porcentual:      1.65,
    cofins_situacao_tributaria:   '01',
    cofins_base_calculo:          valorBase,
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

  // Monta itens com tributação
  const itens: ItemNFe[] = body.itens.map((it) => {
    const desconto = it.desconto ?? 0
    const valorBruto = Math.round(it.quantidade * it.valor_unitario * (1 - desconto / 100) * 100) / 100
    return {
      codigo_produto:           it.codigo_produto || 'PROD',
      descricao:                it.descricao,
      codigo_ncm:               it.ncm?.replace(/\D/g, '') || '00000000',
      cfop:                     it.cfop || '5102',
      unidade_comercial:        it.unidade || 'UN',
      quantidade_comercial:     it.quantidade,
      valor_unitario_comercial: it.valor_unitario,
      valor_bruto:              valorBruto,
      ...taxCodes(regime, valorBruto),
    } as ItemNFe
  })

  const ref = `nfe-${user.id.slice(0, 8)}-${Date.now()}`
  const dataEmissao = new Date().toISOString().slice(0, 19) // YYYY-MM-DDTHH:MM:SS

  // Se token não configurado → salva localmente como "emitida simulada"
  if (!isTokenConfigured()) {
    const valorTotal = itens.reduce((s, it) => s + it.valor_bruto, 0)

    const { data: maxRow } = await supabase
      .from('nfe_emitidas')
      .select('numero')
      .eq('user_id', user.id)
      .order('numero', { ascending: false })
      .limit(1)
      .single()
    const numero = maxRow ? (maxRow.numero as number) + 1 : 1

    await supabase.from('nfe_emitidas').insert({
      user_id: user.id,
      numero,
      serie: '1',
      natureza_operacao: body.natureza_operacao,
      data_emissao: dataEmissao.slice(0, 10),
      destinatario: body.destinatario.nome,
      cnpj_destinatario: body.destinatario.cnpj || body.destinatario.cpf || null,
      email_destinatario: body.destinatario.email || null,
      valor_total: valorTotal,
      status: 'emitida',
      tipo: 'saida',
      itens,
      transportadora: body.frete.transportadora_nome || null,
      focus_ref: ref,
      ambiente: 'local',
    })

    return NextResponse.json({
      ok: true,
      simulada: true,
      numero,
      serie: '1',
      aviso: 'Token Focus NFe não configurado — nota registrada localmente.',
    })
  }

  // Emite via Focus NFe
  const retorno = await emitirNFe({
    ref,
    natureza_operacao:    body.natureza_operacao,
    data_emissao:         dataEmissao,
    tipo_documento:       '1',
    finalidade_emissao:   '1',
    consumidor_final:     body.consumidor_final ? '1' : '0',
    presenca_comprador:   body.presenca_comprador ?? '9',
    cnpj_emitente:        perfil.cnpj_cpf,
    inscricao_estadual_emitente: perfil.inscricao_estadual ?? '',
    regime_tributario_emitente: regime,
    nome_destinatario:    body.destinatario.nome,
    cnpj_destinatario:    body.destinatario.cnpj,
    cpf_destinatario:     body.destinatario.cpf,
    email_destinatario:   body.destinatario.email,
    logradouro_destinatario: body.destinatario.logradouro,
    numero_destinatario:  body.destinatario.numero,
    bairro_destinatario:  body.destinatario.bairro,
    municipio_destinatario: body.destinatario.municipio,
    uf_destinatario:      body.destinatario.uf,
    cep_destinatario:     body.destinatario.cep,
    modalidade_frete:     body.frete.modalidade,
    nome_transportador:   body.frete.transportadora_nome,
    cnpj_transportador:   body.frete.transportadora_cnpj,
    placa_transporte:     body.frete.placa,
    uf_transporte:        body.frete.uf_placa,
    itens,
  })

  const temErro = retorno.erros && retorno.erros.length > 0
  if (temErro) {
    const msg = retorno.erros!.map(e => `[${e.codigo}] ${e.mensagem}`).join('; ')
    return NextResponse.json({ error: msg }, { status: 422 })
  }

  // Aguarda autorização (polling até 20s)
  let resultado = retorno
  if (resultado.status === 'processando_autorizacao') {
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 2500))
      resultado = await consultarNFe(ref)
      if (resultado.status !== 'processando_autorizacao') break
    }
  }

  const autorizado = resultado.status === 'autorizado'
  const valorTotal = itens.reduce((s, it) => s + it.valor_bruto, 0)

  // Salva no Supabase
  const { data: maxRow } = await supabase
    .from('nfe_emitidas')
    .select('numero')
    .eq('user_id', user.id)
    .order('numero', { ascending: false })
    .limit(1)
    .single()
  const numeroLocal = maxRow ? (maxRow.numero as number) + 1 : 1

  await supabase.from('nfe_emitidas').insert({
    user_id: user.id,
    numero: resultado.numero ? Number(resultado.numero) : numeroLocal,
    serie: resultado.serie ?? '1',
    chave_acesso: resultado.chave_nfe ?? null,
    natureza_operacao: body.natureza_operacao,
    data_emissao: dataEmissao.slice(0, 10),
    destinatario: body.destinatario.nome,
    cnpj_destinatario: body.destinatario.cnpj || body.destinatario.cpf || null,
    email_destinatario: body.destinatario.email || null,
    valor_total: valorTotal,
    status: autorizado ? 'emitida' : (resultado.status ?? 'processando'),
    tipo: 'saida',
    danfe_url: resultado.caminho_danfe ?? null,
    xml_url: resultado.caminho_xml_nota_fiscal ?? null,
    itens,
    transportadora: body.frete.transportadora_nome || null,
    focus_ref: ref,
    focus_uuid: resultado.uuid ?? null,
    ambiente: process.env.FOCUSNFE_AMBIENTE ?? 'homologacao',
  })

  return NextResponse.json({
    ok: autorizado,
    status: resultado.status,
    numero: resultado.numero,
    serie: resultado.serie,
    chave_nfe: resultado.chave_nfe,
    danfe_url: resultado.caminho_danfe,
    mensagem_sefaz: resultado.mensagem_sefaz,
  })
}
