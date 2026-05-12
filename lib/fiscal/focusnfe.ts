const AMBIENTE = process.env.FOCUSNFE_AMBIENTE ?? 'homologacao'
const TOKEN_PRODUCAO = process.env.FOCUSNFE_TOKEN_PRODUCAO ?? ''
const TOKEN_HOMOLOGACAO = process.env.FOCUSNFE_TOKEN_HOMOLOGACAO ?? ''

const BASE_URL =
  AMBIENTE === 'producao'
    ? 'https://api.focusnfe.com.br/v2'
    : 'https://homologacao.focusnfe.com.br/v2'

function getToken() {
  return AMBIENTE === 'producao' ? TOKEN_PRODUCAO : TOKEN_HOMOLOGACAO
}

function authHeader() {
  const token = getToken()
  const encoded = Buffer.from(`${token}:`).toString('base64')
  return { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' }
}

export interface EmitirNFSeParams {
  ref: string
  tomador_razao_social: string
  tomador_cnpj?: string
  tomador_cpf?: string
  tomador_email?: string
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
  const codigoMunicipio = process.env.EMITENTE_CODIGO_MUNICIPIO ?? '3136702'

  const body: Record<string, unknown> = {
    data_emissao: params.data_emissao,
    data_competencia: params.data_competencia,
    prestador: {
      cnpj: emitenteCNPJ,
      codigo_municipio: codigoMunicipio,
      ...(params.inscricao_municipal_prestador
        ? { inscricao_municipal: params.inscricao_municipal_prestador }
        : {}),
    },
    tomador: {
      razao_social: params.tomador_razao_social,
      ...(params.tomador_cnpj ? { cnpj: params.tomador_cnpj.replace(/\D/g, '') } : {}),
      ...(params.tomador_cpf ? { cpf: params.tomador_cpf.replace(/\D/g, '') } : {}),
      ...(params.tomador_email ? { email: params.tomador_email } : {}),
    },
    servico: {
      valor_servicos: params.valor_servicos,
      iss_retido: params.iss_retido ? '1' : '2',
      codigo_servico: params.codigo_servico,
      codigo_tributacao_municipio: params.codigo_servico,
      discriminacao: params.discriminacao,
      codigo_municipio: codigoMunicipio,
      ...(params.aliquota_iss !== undefined ? { aliquota: params.aliquota_iss / 100 } : {}),
    },
    numero_rps: String(params.numero_rps),
    serie_rps: params.serie_rps ?? 'RPS',
    tipo_rps: '1',
  }

  const url = `${BASE_URL}/nfse?ref=${encodeURIComponent(params.ref)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(body),
  })

  const json = await res.json() as FocusNFSeRetorno

  return { ...json, ref: params.ref }
}

export async function consultarNFSe(ref: string): Promise<FocusNFSeRetorno> {
  const url = `${BASE_URL}/nfse/${encodeURIComponent(ref)}`
  const res = await fetch(url, { headers: authHeader() })
  return res.json() as Promise<FocusNFSeRetorno>
}

export async function cancelarNFSe(ref: string): Promise<FocusNFSeRetorno> {
  const url = `${BASE_URL}/nfse/${encodeURIComponent(ref)}`
  const res = await fetch(url, { method: 'DELETE', headers: authHeader() })
  return res.json() as Promise<FocusNFSeRetorno>
}

export function getAmbiente() {
  return AMBIENTE
}
