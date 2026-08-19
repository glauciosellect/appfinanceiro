// Cliente da API Asaas — substitui lib/stripe.ts na Fase 1 da migração
// Stripe → Asaas. Ver AGENTS/relatório da migração para o contexto completo.
//
// Docs: https://docs.asaas.com/reference

const ASAAS_BASE_URL =
  process.env.ASAAS_ENV === 'sandbox'
    ? 'https://api-sandbox.asaas.com/v3'
    : 'https://api.asaas.com/v3'

class AsaasError extends Error {
  constructor(message: string, public status: number, public body: unknown) {
    super(message)
    this.name = 'AsaasError'
  }
}

async function asaasFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY
  if (!apiKey) {
    throw new Error('ASAAS_API_KEY não configurada')
  }

  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
      ...(options?.headers || {}),
    },
  })

  const json = await res.json().catch(() => null)

  if (!res.ok) {
    const message =
      (json?.errors && Array.isArray(json.errors) && json.errors[0]?.description) ||
      json?.message ||
      `Erro Asaas (${res.status})`
    throw new AsaasError(message, res.status, json)
  }

  return json as T
}

function amanha(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

export interface AsaasCustomer {
  id: string
}

export async function criarClienteAsaas(params: {
  name: string
  cpfCnpj: string
  email?: string
  externalReference: string
}): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: params.name,
      cpfCnpj: params.cpfCnpj,
      email: params.email,
      externalReference: params.externalReference,
    }),
  })
}

export interface AsaasCheckout {
  id: string
  link: string
}

export async function criarCheckoutAssinatura(params: {
  customerId: string
  value: number
  description: string
  successUrl: string
  cancelUrl: string
}): Promise<AsaasCheckout> {
  return asaasFetch<AsaasCheckout>('/checkouts', {
    method: 'POST',
    body: JSON.stringify({
      customer: params.customerId,
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      subscription: {
        cycle: 'MONTHLY',
        nextDueDate: amanha(),
      },
      value: params.value,
      description: params.description,
      callback: {
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
      },
    }),
  })
}

export interface AsaasSubscription {
  id: string
}

export async function criarAssinaturaPix(params: {
  customerId: string
  value: number
  description: string
  externalReference: string
}): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer: params.customerId,
      billingType: 'PIX',
      value: params.value,
      nextDueDate: amanha(),
      cycle: 'MONTHLY',
      description: params.description,
      externalReference: params.externalReference,
    }),
  })
}

export interface AsaasPayment {
  id: string
  status: string
}

export async function buscarPagamentosDaAssinatura(subscriptionId: string): Promise<AsaasPayment[]> {
  const data = await asaasFetch<{ data: AsaasPayment[] }>(
    `/payments?subscription=${encodeURIComponent(subscriptionId)}`
  )
  return data.data ?? []
}

export interface AsaasPixQrCode {
  encodedImage: string
  payload: string
  expirationDate: string
}

export async function buscarQrCodePix(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasFetch<AsaasPixQrCode>(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`)
}

export interface AsaasSubscriptionDetails {
  nextDueDate: string
  status: string
}

export async function buscarAssinatura(subscriptionId: string): Promise<AsaasSubscriptionDetails> {
  return asaasFetch<AsaasSubscriptionDetails>(`/subscriptions/${encodeURIComponent(subscriptionId)}`)
}

// Cancela uma assinatura recorrente no Asaas. Usado ao trocar de plano
// (ex: PRO → PREMIUM) para não deixar duas assinaturas cobrando o
// cliente ao mesmo tempo. Cobranças já pagas não são estornadas.
export async function cancelarAssinatura(subscriptionId: string): Promise<void> {
  await asaasFetch(`/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: 'DELETE' })
}

// Utilitário de configuração ÚNICA (one-time setup), NÃO chamado
// automaticamente em nenhum lugar da aplicação. Registrar o mesmo webhook
// duas vezes cria registros duplicados na Asaas (limite de 10 por conta).
// Rode manualmente uma única vez — ver relatório da migração para o
// comando exato.
export async function registrarWebhook(url: string, authToken: string): Promise<void> {
  await asaasFetch('/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      name: 'SyncroMoney - Pagamentos',
      url,
      email: 'glaucio.sellect@gmail.com',
      enabled: true,
      interrupted: false,
      apiVersion: 3,
      authToken,
      sendType: 'SEQUENTIALLY',
      events: [
        'PAYMENT_CREATED',
        'PAYMENT_CONFIRMED',
        'PAYMENT_RECEIVED',
        'PAYMENT_OVERDUE',
        'PAYMENT_DELETED',
        'PAYMENT_REFUNDED',
      ],
    }),
  })
}
