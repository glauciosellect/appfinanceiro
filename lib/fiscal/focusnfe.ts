const AMBIENTE = process.env.FOCUSNFE_AMBIENTE ?? 'homologacao'
const TOKEN_PRODUCAO = process.env.FOCUSNFE_TOKEN_PRODUCAO ?? ''
const TOKEN_HOMOLOGACAO = process.env.FOCUSNFE_TOKEN_HOMOLOGACAO ?? ''

const BASE_URL =
  AMBIENTE === 'producao'
    ? 'https://api.focusnfe.com.br/v2'
    : 'https://homologacao.focusnfe.com.br/v2'

// Certificados e gestão de empresa sempre na produção
const PROD_BASE_URL = 'https://api.focusnfe.com.br/v2'

function getToken() {
  return AMBIENTE === 'producao' ? TOKEN_PRODUCAO : TOKEN_HOMOLOGACAO
}

function getProdToken() {
  return TOKEN_PRODUCAO || TOKEN_HOMOLOGACAO
}

function prodAuthHeader() {
  const token = getProdToken()
  const encoded = Buffer.from(`${token}:`).toString('base64')
  return { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' }
}

export function isTokenConfigured() {
  return !!getToken()
}

function authHeader() {
  const token = getToken()
  const encoded = Buffer.from(`${token}:`).toString('base64')
  return { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' }
}

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { erros: [{ codigo: String(res.status), mensagem: text.slice(0, 200) }] }
  }
}

export interface EmitirNFSeParams {
  ref: string
  tomador_razao_social: string
  tomador_cnpj?: string
  tomador_cpf?: string
  tomador_email?: string
  tomador_telefone?: string
  tomador_logradouro?: string
  tomador_numero?: string
  tomador_complemento?: string
  tomador_bairro?: string
  tomador_municipio?: string
  tomador_uf?: string
  tomador_cep?: string
  valor_servicos: number
  iss_retido: boolean
  aliquota_iss?: number
  codigo_servico: string
  codigo_lc116: string
  discriminacao: string
  data_emissao: string
  data_competencia: string
  numero_rps: number
  serie_rps?: string
  inscricao_municipal_prestador?: string
  regime_tributario_prestador?: string // '1'=Simples/MEI '3'=Normal
  codigo_municipio_prestador?: string  // código IBGE do município do prestador
  codigo_cnae?: string
  ibs_cbs_situacao_tributaria?: string
  ibs_cbs_classificacao_tributaria?: string
  codigo_indicador_operacao?: string
  finalidade_emissao?: string  // '1'=Normal '2'=Complementar '3'=Substituta → <finNFSe>
  indicador_destinatario?: string // '0'=Dentro município '1'=Fora município → <indDest>
  ibs_cbs_situacao_tributaria?: string // CST obrigatório para JF
}

export interface FocusNFSeRetorno {
  uuid?: string
  ref?: string
  status?: string
  numero?: string
  numero_rps?: string
  codigo_verificacao?: string
  link_nfse_pdf?: string
  link_nfse_xml?: string
  erros?: Array<{ codigo: string; mensagem: string; correcao?: string }>
  mensagem_sefaz?: string
}

export async function emitirNFSe(params: EmitirNFSeParams): Promise<FocusNFSeRetorno> {
  const emitenteCNPJ = process.env.EMITENTE_CNPJ ?? ''
  // Usa o município do tenant; fallback para variável de ambiente (legado single-tenant)
  const codigoMunicipio = params.codigo_municipio_prestador
    ?? process.env.EMITENTE_CODIGO_MUNICIPIO
    ?? '3136702'
  const isJuizDeFora = codigoMunicipio === '3136702'

  // data_competencia: prefeitura de JF exige data completa YYYY-MM-DD
  const dataCompetencia = params.data_competencia.length === 7
    ? params.data_competencia + '-01'
    : params.data_competencia.slice(0, 10)

  const body: Record<string, unknown> = {
    data_emissao: params.data_emissao,
    data_competencia: dataCompetencia,
    prestador: {
      cnpj: emitenteCNPJ.replace(/\D/g, ''),
      codigo_municipio: codigoMunicipio,
      ...(params.inscricao_municipal_prestador
        ? { inscricao_municipal: params.inscricao_municipal_prestador }
        : {}),
    },
    // campo raiz — Focus NFe usa este nível para gerar <OptanteSimplesNacional> no XML
    optante_simples_nacional: (params.regime_tributario_prestador ?? '1') === '1' ? '1' : '2',
    tomador: {
      razao_social: params.tomador_razao_social,
      ...(params.tomador_cnpj ? { cnpj: params.tomador_cnpj.replace(/\D/g, '') } : {}),
      ...(params.tomador_cpf ? { cpf: params.tomador_cpf.replace(/\D/g, '') } : {}),
      ...(params.tomador_email ? { email: params.tomador_email } : {}),
      ...(params.tomador_telefone ? { telefone: params.tomador_telefone.replace(/\D/g, '') } : {}),
      ...(params.tomador_logradouro ? {
        endereco: {
          logradouro: params.tomador_logradouro,
          numero: params.tomador_numero ?? 'S/N',
          ...(params.tomador_complemento ? { complemento: params.tomador_complemento } : {}),
          bairro: params.tomador_bairro ?? '',
          // codigo_municipio deve ser o código IBGE numérico
          codigo_municipio: codigoMunicipio,
          uf: params.tomador_uf ?? '',
          cep: (params.tomador_cep ?? '').replace(/\D/g, ''),
        },
      } : {}),
    },
    servico: {
      valor_servicos: params.valor_servicos,
      iss_retido: params.iss_retido ? '1' : '2',
      item_lista_servico: params.codigo_lc116 || params.codigo_servico,
      codigo_tributacao_municipio: params.codigo_lc116 || params.codigo_servico.replace('.', ''),
      codigo_municipio: codigoMunicipio,
      discriminacao: params.discriminacao,
      ...(params.aliquota_iss !== undefined ? { aliquota: params.aliquota_iss } : {}),
      // campos específicos de JF (IBS/CBS) — só enviados para municípios que usam o novo padrão
      ...(isJuizDeFora && params.codigo_cnae ? { codigo_cnae: params.codigo_cnae } : {}),
      ...(isJuizDeFora ? { ibs_cbs_situacao_tributaria: params.ibs_cbs_situacao_tributaria ?? '07' } : {}),
      ...(isJuizDeFora && params.ibs_cbs_classificacao_tributaria ? { ibs_cbs_classificacao_tributaria: params.ibs_cbs_classificacao_tributaria } : {}),
    },
    numero_rps: String(params.numero_rps),
    serie_rps: params.serie_rps ?? 'RPS',
    tipo_rps: '1',
    // campos obrigatórios para JF no bloco IBSCBS (schema ABRASF exige ordem: finNFSe → cIndOp)
    ...(isJuizDeFora ? { finalidade_emissao: params.finalidade_emissao ?? '1' } : {}),
    ...(isJuizDeFora ? { indicador_destinatario: params.indicador_destinatario ?? '0' } : {}),
    ...(isJuizDeFora && params.codigo_indicador_operacao ? { codigo_indicador_operacao: params.codigo_indicador_operacao } : {}),
  }

  const url = `${BASE_URL}/nfse?ref=${encodeURIComponent(params.ref)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(body),
  })

  const json = await safeJson(res) as unknown as FocusNFSeRetorno

  // Registra webhook para ser notificado quando a prefeitura autorizar
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  if (appUrl) {
    const webhookUrl = `${appUrl}/api/nfse/webhook`
    fetch(`${BASE_URL}/nfse/${encodeURIComponent(params.ref)}/hook`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ url: webhookUrl }),
    }).catch(() => {}) // silencia erro — polling garante atualização como fallback
  }

  return { ...json, ref: params.ref }
}

// ============================================================
// NF-e (Nota Fiscal Eletrônica de Produtos)
// ============================================================

export interface ItemNFe {
  codigo_produto: string
  descricao: string
  codigo_ncm: string
  cfop: string
  unidade_comercial: string
  quantidade_comercial: number
  valor_unitario_comercial: number
  valor_bruto: number
  // ICMS
  icms_origem: string
  icms_situacao_tributaria: string
  icms_modalidade_base_calculo?: string
  icms_base_calculo?: number
  icms_aliquota?: number
  // PIS
  pis_situacao_tributaria: string
  pis_base_calculo?: number
  pis_aliquota_porcentual?: number
  // COFINS
  cofins_situacao_tributaria: string
  cofins_base_calculo?: number
  cofins_aliquota_porcentual?: number
}

export interface EmitirNFeParams {
  ref: string
  natureza_operacao: string
  data_emissao: string
  tipo_documento: string        // '0'=entrada '1'=saida
  finalidade_emissao: string    // '1'=normal
  consumidor_final: string      // '0'=não '1'=sim
  presenca_comprador: string    // '9'=outros
  // Emitente
  cnpj_emitente: string
  inscricao_estadual_emitente: string
  regime_tributario_emitente: string // '1'=Simples '3'=Normal
  // Destinatário
  nome_destinatario: string
  cnpj_destinatario?: string
  cpf_destinatario?: string
  email_destinatario?: string
  logradouro_destinatario: string
  numero_destinatario: string
  bairro_destinatario: string
  municipio_destinatario: string
  uf_destinatario: string
  cep_destinatario: string
  // Frete
  modalidade_frete: string
  nome_transportador?: string
  cnpj_transportador?: string
  placa_transporte?: string
  uf_transporte?: string
  // Itens
  itens: ItemNFe[]
}

export interface FocusNFeRetorno {
  uuid?: string
  ref?: string
  status?: string
  numero?: string
  serie?: string
  chave_nfe?: string
  caminho_xml_nota_fiscal?: string
  caminho_danfe?: string
  erros?: Array<{ codigo: string; mensagem: string; correcao?: string }>
  mensagem_sefaz?: string
}

export async function emitirNFe(params: EmitirNFeParams): Promise<FocusNFeRetorno> {
  const cnpjDest = params.cnpj_destinatario?.replace(/\D/g, '')
  const cpfDest  = params.cpf_destinatario?.replace(/\D/g, '')

  const body: Record<string, unknown> = {
    natureza_operacao:    params.natureza_operacao,
    data_emissao:         params.data_emissao,
    tipo_documento:       params.tipo_documento,
    finalidade_emissao:   params.finalidade_emissao,
    consumidor_final:     params.consumidor_final,
    presenca_comprador:   params.presenca_comprador,
    cnpj_emitente:        params.cnpj_emitente.replace(/\D/g, ''),
    inscricao_estadual_emitente: params.inscricao_estadual_emitente,
    regime_tributario_emitente:  params.regime_tributario_emitente,
    nome_destinatario:    params.nome_destinatario,
    logradouro_destinatario: params.logradouro_destinatario,
    numero_destinatario:  params.numero_destinatario,
    bairro_destinatario:  params.bairro_destinatario,
    municipio_destinatario: params.municipio_destinatario,
    uf_destinatario:      params.uf_destinatario,
    cep_destinatario:     params.cep_destinatario.replace(/\D/g, ''),
    modalidade_frete:     params.modalidade_frete,
    ...(cnpjDest ? { cnpj_destinatario: cnpjDest } : {}),
    ...(cpfDest  ? { cpf_destinatario:  cpfDest  } : {}),
    ...(params.email_destinatario  ? { email_destinatario:  params.email_destinatario  } : {}),
    ...(params.nome_transportador  ? { nome_transportador:  params.nome_transportador  } : {}),
    ...(params.cnpj_transportador  ? { cnpj_transportador:  params.cnpj_transportador.replace(/\D/g, '') } : {}),
    ...(params.placa_transporte    ? { placa_transporte:    params.placa_transporte    } : {}),
    ...(params.uf_transporte       ? { uf_transporte:       params.uf_transporte       } : {}),
    itens: params.itens.map((it, idx) => ({
      numero_item:               idx + 1,
      codigo_produto:            it.codigo_produto,
      descricao:                 it.descricao,
      codigo_ncm:                it.codigo_ncm,
      cfop:                      it.cfop,
      unidade_comercial:         it.unidade_comercial,
      quantidade_comercial:      it.quantidade_comercial,
      valor_unitario_comercial:  it.valor_unitario_comercial,
      valor_bruto:               it.valor_bruto,
      icms_origem:               it.icms_origem,
      icms_situacao_tributaria:  it.icms_situacao_tributaria,
      ...(it.icms_modalidade_base_calculo !== undefined ? { icms_modalidade_base_calculo: it.icms_modalidade_base_calculo } : {}),
      ...(it.icms_base_calculo   !== undefined ? { icms_base_calculo:  it.icms_base_calculo  } : {}),
      ...(it.icms_aliquota       !== undefined ? { icms_aliquota:       it.icms_aliquota      } : {}),
      pis_situacao_tributaria:   it.pis_situacao_tributaria,
      ...(it.pis_base_calculo    !== undefined ? { pis_base_calculo:    it.pis_base_calculo   } : {}),
      ...(it.pis_aliquota_porcentual !== undefined ? { pis_aliquota_porcentual: it.pis_aliquota_porcentual } : {}),
      cofins_situacao_tributaria: it.cofins_situacao_tributaria,
      ...(it.cofins_base_calculo !== undefined ? { cofins_base_calculo: it.cofins_base_calculo } : {}),
      ...(it.cofins_aliquota_porcentual !== undefined ? { cofins_aliquota_porcentual: it.cofins_aliquota_porcentual } : {}),
    })),
  }

  const url = `${BASE_URL}/nfe?ref=${encodeURIComponent(params.ref)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(body),
  })
  return safeJson(res) as unknown as FocusNFeRetorno
}

export async function consultarNFe(ref: string): Promise<FocusNFeRetorno> {
  const url = `${BASE_URL}/nfe/${encodeURIComponent(ref)}`
  const res = await fetch(url, { headers: authHeader() })
  return safeJson(res) as unknown as FocusNFeRetorno
}

// ============================================================
// NFS-e
// ============================================================

export async function consultarNFSe(ref: string): Promise<FocusNFSeRetorno> {
  const url = `${BASE_URL}/nfse/${encodeURIComponent(ref)}`
  const res = await fetch(url, { headers: authHeader() })
  return safeJson(res) as unknown as FocusNFSeRetorno
}

export async function cancelarNFSe(ref: string): Promise<FocusNFSeRetorno> {
  const url = `${BASE_URL}/nfse/${encodeURIComponent(ref)}`
  const res = await fetch(url, { method: 'DELETE', headers: authHeader() })
  return safeJson(res) as unknown as FocusNFSeRetorno
}

export function getAmbiente() {
  return AMBIENTE
}

// ============================================================
// GESTÃO DE EMPRESAS (cadastro de clientes na Focus NFe)
// ============================================================

export interface CadastrarEmpresaParams {
  cnpj: string
  razao_social: string
  inscricao_estadual?: string
  inscricao_municipal?: string
  regime_tributario?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  telefone?: string
  email?: string
  habilita_nfse?: boolean
  habilita_nfe?: boolean
  numero_proximo_nfe?: number
  serie_nfe?: string
}

export interface FocusEmpresaRetorno {
  status?: string
  message?: string
  cnpj?: string
  nome?: string
  erros?: Array<{ codigo: string; mensagem: string }>
}

export async function cadastrarEmpresa(params: CadastrarEmpresaParams): Promise<FocusEmpresaRetorno> {
  const body = {
    nome: params.razao_social,
    cnpj: params.cnpj.replace(/\D/g, ''),
    inscricao_estadual: params.inscricao_estadual ?? '',
    inscricao_municipal: params.inscricao_municipal ?? '',
    regime_tributario: params.regime_tributario ?? '1',
    // '1'=Simples/MEI → optante=true; '3'=Normal → optante=false
    optante_simples_nacional: (params.regime_tributario ?? '1') === '1',
    cep: params.cep?.replace(/\D/g, '') ?? '',
    logradouro: params.logradouro ?? '',
    numero: params.numero ?? '',
    complemento: params.complemento ?? '',
    bairro: params.bairro ?? '',
    municipio: params.municipio ?? '',
    uf: params.uf ?? '',
    telefone: params.telefone?.replace(/\D/g, '') ?? '',
    email: params.email ?? '',
    habilita_nfce: false,
    // Envia habilita_nfse/habilita_nfe somente se explicitamente definidos;
    // evita desabilitar serviços que já estão ativos na Focus NFe.
    ...(params.habilita_nfse !== undefined && params.habilita_nfse !== null ? { habilita_nfse: params.habilita_nfse } : {}),
    ...(params.habilita_nfe !== undefined && params.habilita_nfe !== null ? { habilita_nfe: params.habilita_nfe } : {}),
    // Focus NFe espera "proximo_numero_nfe_producao" / "proximo_numero_nfe_homologacao",
    // não "numero_proximo_nfe". Envia para os dois ambientes para garantir.
    ...(params.numero_proximo_nfe !== undefined ? {
      proximo_numero_nfe_producao: params.numero_proximo_nfe,
      proximo_numero_nfe_homologacao: params.numero_proximo_nfe,
    } : {}),
    ...(params.serie_nfe !== undefined ? {
      serie_nfe_producao: params.serie_nfe,
      serie_nfe_homologacao: params.serie_nfe,
    } : {}),
  }

  const cnpjLimpo = params.cnpj.replace(/\D/g, '')
  const res = await fetch(`${PROD_BASE_URL}/empresas/${cnpjLimpo}`, {
    method: 'PUT',
    headers: prodAuthHeader(),
    body: JSON.stringify(body),
  })

  return safeJson(res) as unknown as FocusEmpresaRetorno
}

export async function consultarEmpresa(cnpj: string): Promise<FocusEmpresaRetorno> {
  const cnpjLimpo = cnpj.replace(/\D/g, '')
  const res = await fetch(`${PROD_BASE_URL}/empresas/${cnpjLimpo}`, {
    headers: prodAuthHeader(),
  })
  return safeJson(res) as unknown as FocusEmpresaRetorno
}

export async function enviarCertificado(cnpj: string, pfxBase64: string, senha: string): Promise<FocusEmpresaRetorno> {
  const cnpjLimpo = cnpj.replace(/\D/g, '')
  const res = await fetch(`${PROD_BASE_URL}/empresas/${cnpjLimpo}/certificado`, {
    method: 'PUT',
    headers: prodAuthHeader(),
    body: JSON.stringify({ certificado: pfxBase64, senha }),
  })
  return safeJson(res) as unknown as FocusEmpresaRetorno
}
