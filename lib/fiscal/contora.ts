// Cliente da Fiscal Contora — substitui lib/fiscal/focusnfe.ts.
//
// Diferença estrutural principal em relação à Focus NFe: aqui cada tenant é
// uma "empresa" identificada por um UUID interno da Contora (não o CNPJ), que
// precisa ser criado uma vez (cadastrarEmpresa) e guardado em
// fiscal_config.contora_company_id. Toda rota de documento é
// /companies/{company}/... com esse UUID no path.
//
// Outra diferença: emissão é sempre draft -> dispatch -> poll (a Contora
// processa em fila e assina/transmite de forma assíncrona), e os artefatos
// (PDF/XML) exigem Bearer token para download — não são links públicos como
// os da Focus NFe. Por isso baixarArtefato() existe: uma rota própria do
// SyncroMoney deve proxyar esse download para o navegador do usuário.

// A Contora escopa a API key por ambiente — uma chave de produção não cria
// nem consulta nada em homologação (erro environment_mismatch), mesmo que a
// empresa tenha allows_homologation. Por isso, igual à Focus NFe antes,
// mantemos os dois tokens e escolhemos por chamada conforme o ambiente.
const TOKEN_PRODUCAO = process.env.CONTORA_API_TOKEN ?? process.env.CONTORA_API_TOKEN_PRODUCAO ?? ''
const TOKEN_HOMOLOGACAO = process.env.CONTORA_API_TOKEN_HOMOLOGACAO ?? ''
const BASE_URL = 'https://fiscal.contora.com.br/api/v1'

export function isTokenConfigured() {
  return !!TOKEN_PRODUCAO || !!TOKEN_HOMOLOGACAO
}

function tokenPara(ambiente?: 'homologacao' | 'producao') {
  if (ambiente === 'homologacao') return TOKEN_HOMOLOGACAO || TOKEN_PRODUCAO
  return TOKEN_PRODUCAO || TOKEN_HOMOLOGACAO
}

function authHeaders(ambiente?: 'homologacao' | 'producao', extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${tokenPara(ambiente)}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  }
}

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { ok: false, erro: { codigo: String(res.status), mensagem: text.slice(0, 200) } }
  }
}

export interface ContoraRetorno {
  ok?: boolean
  uuid?: string
  status?: string
  processing_status?: string
  numero?: string
  serie?: string
  chave_nfe?: string
  numero_rps?: string
  codigo_verificacao?: string
  mensagem_sefaz?: string
  erros?: Array<{ codigo: string; mensagem: string }>
}

/** Extrai mensagem de erro de qualquer resposta da Contora — tanto erro de
 * validação/schema (campo `error`/`errors` no nível raiz) quanto erro de
 * processamento assíncrono (last_error_code/last_error_message no `data`). */
export function erroContora(json: Record<string, unknown>): string | null {
  const data = (json.data ?? json) as Record<string, unknown>
  const lastCode = data.last_error_code as string | undefined
  const lastMsg = data.last_error_message as string | undefined
  if (lastCode || lastMsg) return `[${lastCode ?? '?'}] ${lastMsg ?? ''}`.trim()
  const erro = json.erro as { codigo?: string; mensagem?: string } | undefined
  if (erro?.mensagem) return `[${erro.codigo ?? '?'}] ${erro.mensagem}`
  const errors = json.errors as Array<{ code?: string; message?: string }> | undefined
  if (errors && errors.length > 0) {
    return errors.map((e) => `[${e.code ?? '?'}] ${e.message ?? ''}`).join('; ')
  }
  return null
}

// ============================================================
// EMPRESAS (cadastro multi-tenant + certificado A1)
// ============================================================

export interface CadastrarEmpresaParams {
  cnpj: string
  razao_social: string
  nome_fantasia?: string
  ambiente: 'homologacao' | 'producao'
  inscricao_estadual?: string
  cnae?: string
  uf: string
  codigo_municipio?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  cep?: string
  telefone?: string
  // enum da Contora: 'mei' | 'simples' | 'presumido' | 'real'
  regime_tributario: 'mei' | 'simples' | 'presumido' | 'real'
  inscricao_municipal?: string
  // defaults de NFS-e que evitam repetir campo fiscal em toda nota
  nfse_nbs_default?: string
  nfse_cnae_default?: string
  nfse_iss_rate_default?: number
  nfse_municipal_tax_code_default?: string
}

export interface ContoraEmpresaRetorno {
  ok?: boolean
  contora_company_id?: string
  erro?: string
}

/** Cria ou atualiza a empresa na Contora usando o CNPJ como chave de upsert.
 * Retorna o UUID interno que precisa ser salvo em fiscal_config.contora_company_id —
 * todas as rotas de documento (NF-e/NFC-e/NFS-e) dependem desse UUID no path. */
export async function cadastrarEmpresa(params: CadastrarEmpresaParams): Promise<ContoraEmpresaRetorno> {
  const cnpjLimpo = params.cnpj.replace(/\D/g, '')
  const body: Record<string, unknown> = {
    legal_name: params.razao_social,
    trade_name: params.nome_fantasia,
    document: cnpjLimpo,
    state_registration: params.inscricao_estadual,
    cnae: params.cnae,
    state_code: params.uf,
    city_code: params.codigo_municipio,
    street: params.logradouro,
    number: params.numero,
    complement: params.complemento,
    district: params.bairro,
    city_name: params.municipio,
    postal_code: params.cep?.replace(/\D/g, ''),
    phone: params.telefone?.replace(/\D/g, ''),
    tax_regime: params.regime_tributario,
    default_environment: params.ambiente,
    settings: {
      municipal_registration: params.inscricao_municipal,
      nfse_nbs_default: params.nfse_nbs_default,
      nfse_cnae_default: params.nfse_cnae_default,
      nfse_iss_rate_default: params.nfse_iss_rate_default,
      nfse_municipal_tax_code_default: params.nfse_municipal_tax_code_default,
    },
  }

  const res = await fetch(`${BASE_URL}/companies/by-document/${cnpjLimpo}`, {
    method: 'PUT',
    headers: authHeaders(params.ambiente),
    body: JSON.stringify(body),
  })
  const json = await safeJson(res)
  const erro = erroContora(json)
  const data = json.data as { id?: string } | undefined
  return { ok: !erro && !!data?.id, contora_company_id: data?.id, erro: erro ?? undefined }
}

/** Envia o certificado A1 (.pfx) da empresa. Diferente da Focus NFe, a Contora
 * espera multipart/form-data (arquivo binário), não base64 em JSON. */
export async function enviarCertificado(
  companyId: string,
  pfxBase64: string,
  senha: string,
  ambiente?: 'homologacao' | 'producao'
): Promise<ContoraEmpresaRetorno> {
  const buffer = Buffer.from(pfxBase64, 'base64')
  const form = new FormData()
  form.append('certificate', new Blob([buffer]), 'certificado.pfx')
  form.append('password', senha)

  const res = await fetch(`${BASE_URL}/companies/${companyId}/certificate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenPara(ambiente)}` }, // sem Content-Type — o fetch define o boundary do multipart
    body: form,
  })
  const json = await safeJson(res)
  const erro = erroContora(json)
  return { ok: !erro, erro: erro ?? undefined }
}

export async function consultarEmpresa(companyId: string, ambiente?: 'homologacao' | 'producao'): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/companies/${companyId}`, { headers: authHeaders(ambiente) })
  return safeJson(res)
}

// ============================================================
// NF-e / NFC-e (mesmo fluxo — document_type muda entre 'nfe' e 'nfce')
// ============================================================

export interface ItemNFe {
  codigo_produto: string
  descricao: string
  codigo_ncm: string
  cfop: string
  unidade_comercial: string
  quantidade_comercial: number
  valor_unitario_comercial: number
  // valor do desconto (em R$, não percentual) — a Contora calcula a base do
  // ICMS sozinha como quantidade × preço − desconto, não existe mais um
  // "icms_base_calculo" manual como na Focus NFe.
  valor_desconto?: number
  icms_origem: string
  icms_situacao_tributaria: string
  icms_aliquota?: number
  pis_situacao_tributaria: string
  pis_aliquota_porcentual?: number
  cofins_situacao_tributaria: string
  cofins_aliquota_porcentual?: number
}

export interface EmitirNFeParams {
  companyId: string
  ambiente: 'homologacao' | 'producao'
  documentType?: 'nfe' | 'nfce'
  series?: number
  number?: number
  natureza_operacao: string
  operation_type?: 'entrada' | 'saida'
  consumidor_final?: boolean
  presence_indicator?: number
  nome_destinatario?: string
  cnpj_destinatario?: string
  cpf_destinatario?: string
  logradouro_destinatario?: string
  numero_destinatario?: string
  bairro_destinatario?: string
  codigo_municipio_destinatario?: string
  uf_destinatario?: string
  cep_destinatario?: string
  itens: ItemNFe[]
  payments?: Array<{ method: string; amount: number }>
}

function montarPayloadNFe(params: EmitirNFeParams) {
  const cnpjDest = params.cnpj_destinatario?.replace(/\D/g, '')
  const cpfDest = params.cpf_destinatario?.replace(/\D/g, '')
  return {
    nature_operation: params.natureza_operacao,
    operation_type: params.operation_type ?? 'saida',
    consumer_final: params.consumidor_final ?? false,
    presence_indicator: params.presence_indicator,
    ...(params.nome_destinatario
      ? {
          recipient: {
            name: params.nome_destinatario,
            document: cnpjDest || cpfDest,
            ...(params.logradouro_destinatario
              ? {
                  address: {
                    street: params.logradouro_destinatario,
                    number: params.numero_destinatario ?? 'S/N',
                    district: params.bairro_destinatario ?? '',
                    city_code: params.codigo_municipio_destinatario ?? '',
                    state_code: params.uf_destinatario ?? '',
                    postal_code: (params.cep_destinatario ?? '').replace(/\D/g, ''),
                  },
                }
              : {}),
          },
        }
      : {}),
    items: params.itens.map((it) => ({
      code: it.codigo_produto,
      name: it.descricao,
      ncm: it.codigo_ncm,
      cfop: it.cfop,
      unit: it.unidade_comercial,
      quantity: it.quantidade_comercial,
      unit_price: it.valor_unitario_comercial,
      ...(it.valor_desconto ? { discount: it.valor_desconto } : {}),
      taxes: {
        icms: { origin: Number(it.icms_origem), code: it.icms_situacao_tributaria, aliquot: it.icms_aliquota ?? 0 },
        pis: { code: it.pis_situacao_tributaria, aliquot: it.pis_aliquota_porcentual ?? 0 },
        cofins: { code: it.cofins_situacao_tributaria, aliquot: it.cofins_aliquota_porcentual ?? 0 },
      },
    })),
    ...(params.payments ? { payments: params.payments } : {}),
  }
}

/** Cria o draft e despacha para autorização num só fluxo. O dispatch com
 * action=authorize monta, assina e transmite — não é preciso chamar /build
 * antes. Retorna o estado logo após o dispatch (normalmente "queued" ou
 * "processing"); use consultarNFe() para saber quando autorizou. */
export async function emitirNFe(params: EmitirNFeParams): Promise<ContoraRetorno & { documentId?: string }> {
  const draftRes = await fetch(`${BASE_URL}/companies/${params.companyId}/nfe/drafts`, {
    method: 'POST',
    headers: authHeaders(params.ambiente),
    body: JSON.stringify({
      document_type: params.documentType ?? 'nfe',
      environment: params.ambiente,
      series: params.series,
      number: params.number,
      payload: montarPayloadNFe(params),
    }),
  })
  const draftJson = await safeJson(draftRes)
  const erroDraft = erroContora(draftJson)
  const documentId = (draftJson.data as { id?: string } | undefined)?.id
  if (erroDraft || !documentId) {
    return { ok: false, erros: [{ codigo: 'draft', mensagem: erroDraft ?? 'draft sem id' }] }
  }

  const dispatchRes = await fetch(
    `${BASE_URL}/companies/${params.companyId}/nfe/drafts/${documentId}/dispatch`,
    { method: 'POST', headers: authHeaders(params.ambiente), body: JSON.stringify({ action: 'authorize' }) }
  )
  const dispatchJson = await safeJson(dispatchRes)
  return normalizarNFe(dispatchJson, documentId)
}

function normalizarNFe(json: Record<string, unknown>, documentId: string): ContoraRetorno & { documentId: string } {
  const data = (json.data ?? {}) as Record<string, unknown>
  const erro = erroContora(json)
  return {
    documentId,
    uuid: documentId,
    status: data.status as string | undefined,
    processing_status: data.processing_status as string | undefined,
    numero: data.number !== undefined ? String(data.number) : undefined,
    serie: data.series !== undefined ? String(data.series) : undefined,
    chave_nfe: data.access_key as string | undefined,
    mensagem_sefaz: data.sefaz_status_message as string | undefined,
    erros: erro ? [{ codigo: (data.last_error_code as string) ?? '?', mensagem: erro }] : undefined,
  }
}

export async function consultarNFe(companyId: string, documentId: string, ambiente?: 'homologacao' | 'producao'): Promise<ContoraRetorno> {
  const res = await fetch(`${BASE_URL}/companies/${companyId}/nfe/drafts/${documentId}`, {
    headers: authHeaders(ambiente),
  })
  return normalizarNFe(await safeJson(res), documentId)
}

export async function cancelarNFe(companyId: string, documentId: string, reason: string, ambiente?: 'homologacao' | 'producao'): Promise<ContoraRetorno> {
  const res = await fetch(`${BASE_URL}/companies/${companyId}/nfe/drafts/${documentId}/dispatch`, {
    method: 'POST',
    headers: authHeaders(ambiente),
    body: JSON.stringify({ action: 'cancel', reason }),
  })
  return normalizarNFe(await safeJson(res), documentId)
}

// ============================================================
// NFS-e (padrão nacional — a Contora monta, assina e transmite o DPS)
// ============================================================

export interface EmitirNFSeParams {
  companyId: string
  ambiente: 'homologacao' | 'producao'
  series?: number
  number?: number
  descricao: string
  national_tax_code?: string // 6 dígitos — obrigatório no padrão nacional
  municipal_tax_code?: string
  nbs_code?: string
  cnae?: string
  iss_rate?: number
  iss_withheld?: boolean
  tomador_razao_social: string
  tomador_cnpj?: string
  tomador_cpf?: string
  tomador_email?: string
  tomador_logradouro?: string
  tomador_numero?: string
  tomador_bairro?: string
  tomador_codigo_municipio?: string
  tomador_uf?: string
  tomador_cep?: string
  valor_servicos: number
}

function montarPayloadNFSe(params: EmitirNFSeParams) {
  const cnpjTomador = params.tomador_cnpj?.replace(/\D/g, '')
  const cpfTomador = params.tomador_cpf?.replace(/\D/g, '')
  return {
    service: {
      description: params.descricao,
      national_tax_code: params.national_tax_code,
      municipal_tax_code: params.municipal_tax_code,
      nbs_code: params.nbs_code,
      cnae: params.cnae,
      iss_rate: params.iss_rate,
      iss_withheld: params.iss_withheld ?? false,
    },
    taker: {
      name: params.tomador_razao_social,
      document: cnpjTomador || cpfTomador,
      email: params.tomador_email,
      ...(params.tomador_logradouro
        ? {
            address: {
              street: params.tomador_logradouro,
              number: params.tomador_numero ?? 'S/N',
              district: params.tomador_bairro ?? '',
              city_code: params.tomador_codigo_municipio ?? '',
              state_code: params.tomador_uf ?? '',
              postal_code: (params.tomador_cep ?? '').replace(/\D/g, ''),
            },
          }
        : {}),
    },
    amounts: { service_amount: params.valor_servicos },
  }
}

export async function emitirNFSe(params: EmitirNFSeParams): Promise<ContoraRetorno & { documentId?: string }> {
  const draftRes = await fetch(`${BASE_URL}/companies/${params.companyId}/nfse/drafts`, {
    method: 'POST',
    headers: authHeaders(params.ambiente),
    body: JSON.stringify({
      environment: params.ambiente,
      series: params.series,
      number: params.number,
      payload: montarPayloadNFSe(params),
    }),
  })
  const draftJson = await safeJson(draftRes)
  const erroDraft = erroContora(draftJson)
  const documentId = (draftJson.data as { id?: string } | undefined)?.id
  if (erroDraft || !documentId) {
    return { ok: false, erros: [{ codigo: 'draft', mensagem: erroDraft ?? 'draft sem id' }] }
  }

  const dispatchRes = await fetch(
    `${BASE_URL}/companies/${params.companyId}/nfse/drafts/${documentId}/dispatch`,
    { method: 'POST', headers: authHeaders(params.ambiente), body: JSON.stringify({ action: 'submit' }) }
  )
  return normalizarNFSe(await safeJson(dispatchRes), documentId)
}

function normalizarNFSe(json: Record<string, unknown>, documentId: string): ContoraRetorno & { documentId: string } {
  const data = (json.data ?? {}) as Record<string, unknown>
  const provider = (data.provider ?? {}) as Record<string, unknown>
  const erro = erroContora(json)
  return {
    documentId,
    uuid: documentId,
    status: data.status as string | undefined,
    processing_status: data.processing_status as string | undefined,
    numero: (data.display_number as string | undefined) ?? (data.nfse_number as string | undefined),
    numero_rps: data.rps_number !== undefined ? String(data.rps_number) : undefined,
    chave_nfe: data.access_key as string | undefined,
    codigo_verificacao: provider.verification_code as string | undefined,
    erros: erro ? [{ codigo: (data.last_error_code as string) ?? '?', mensagem: erro }] : undefined,
  }
}

export async function consultarNFSe(companyId: string, documentId: string, ambiente?: 'homologacao' | 'producao'): Promise<ContoraRetorno> {
  const res = await fetch(`${BASE_URL}/companies/${companyId}/nfse/drafts/${documentId}`, {
    headers: authHeaders(ambiente),
  })
  return normalizarNFSe(await safeJson(res), documentId)
}

export async function cancelarNFSe(companyId: string, documentId: string, reason: string, ambiente?: 'homologacao' | 'producao'): Promise<ContoraRetorno> {
  const res = await fetch(`${BASE_URL}/companies/${companyId}/nfse/drafts/${documentId}/cancel`, {
    method: 'POST',
    headers: authHeaders(ambiente),
    body: JSON.stringify({ reason }),
  })
  return normalizarNFSe(await safeJson(res), documentId)
}

// ============================================================
// Artefatos (PDF/XML) — exigem Bearer, não são links públicos.
// Uma rota própria (ex: app/api/fiscal/artefato/route.ts) deve chamar isto
// no servidor e devolver o binário ao navegador do usuário autenticado.
// ============================================================

export type TipoDocumentoArtefato = 'nfe' | 'nfce' | 'nfse'
export type TipoArtefato = 'xml_unsigned' | 'xml_signed' | 'xml_authorized' | 'xml_cancelled' | 'pdf_danfe'

// ============================================================
// Webhooks — a Contora usa 1 endpoint por conta (não por nota, como a Focus
// NFe fazia). Cadastre uma vez via criarWebhookEndpoint(); os eventos chegam
// assinados em X-Fiscal-Signature (HMAC-SHA256 do corpo cru, hex).
// ============================================================

import { createHmac, timingSafeEqual } from 'crypto'

export function verificarAssinaturaWebhook(rawBody: string, assinaturaRecebida: string | null, secret: string): boolean {
  if (!assinaturaRecebida) return false
  const esperada = createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(assinaturaRecebida)
  const b = Buffer.from(esperada)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function criarWebhookEndpoint(url: string, secret: string, ambiente?: 'homologacao' | 'producao'): Promise<Record<string, unknown>> {
  // Cada token (ambiente) provavelmente só recebe eventos do próprio ambiente —
  // registre uma vez por token/ambiente que for usar de verdade.
  const res = await fetch(`${BASE_URL}/webhooks`, {
    method: 'POST',
    headers: authHeaders(ambiente),
    body: JSON.stringify({
      url,
      secret,
      events: [
        'document.authorized',
        'document.rejected',
        'document.failed',
        'document.cancelled',
        'document.cancellation_rejected',
      ],
      is_active: true,
    }),
  })
  return safeJson(res)
}

export async function baixarArtefato(
  companyId: string,
  tipoDocumento: TipoDocumentoArtefato,
  documentId: string,
  artefato: TipoArtefato,
  ambiente?: 'homologacao' | 'producao'
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const familia = tipoDocumento === 'nfse' ? 'nfse' : 'nfe' // nfce usa as mesmas rotas de nfe
  const res = await fetch(
    `${BASE_URL}/companies/${companyId}/${familia}/drafts/${documentId}/artifacts/${artefato}`,
    { headers: { Authorization: `Bearer ${tokenPara(ambiente)}` } }
  )
  if (!res.ok) return null
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
  const buffer = Buffer.from(await res.arrayBuffer())
  return { buffer, contentType }
}
