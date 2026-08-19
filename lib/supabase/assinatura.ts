import { createClient } from '@/lib/supabase/client'

export type StatusAssinatura = 'pending' | 'active' | 'past_due' | 'canceled'
export type PlanoAssinatura = 'pro' | 'premium'
export type BillingType = 'PIX' | 'CREDIT_CARD'

export interface Assinatura {
  id: string
  user_id: string
  plano: PlanoAssinatura
  asaas_customer_id: string | null
  asaas_subscription_id: string | null
  billing_type: BillingType | null
  status: StatusAssinatura
  valor: number
  proximo_vencimento: string | null
  ultimo_pagamento_em: string | null
  created_at: string
  updated_at: string
}

export async function getAssinatura(userId: string): Promise<Assinatura | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('assinaturas')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data as Assinatura | null
}

export function assinaturaAtiva(assinatura: Assinatura | null): boolean {
  if (!assinatura) return false
  return assinatura.status === 'active'
}

export const TRIAL_DIAS = 14

// Trial gratuito de 14 dias a partir do cadastro — vale SOMENTE para o
// plano PRO. O Premium (PDV/Caixa/Fiscal) nunca tem trial: é pago desde o
// primeiro dia. `criadoEm` é auth.users.created_at do usuário logado.
export function emTrialPro(criadoEm: string | null | undefined): boolean {
  if (!criadoEm) return false
  const inicio = new Date(criadoEm).getTime()
  const fimTrial = inicio + TRIAL_DIAS * 24 * 60 * 60 * 1000
  return Date.now() < fimTrial
}

export function diasRestantesTrial(criadoEm: string | null | undefined): number {
  if (!criadoEm) return 0
  const inicio = new Date(criadoEm).getTime()
  const fimTrial = inicio + TRIAL_DIAS * 24 * 60 * 60 * 1000
  const restante = Math.ceil((fimTrial - Date.now()) / (24 * 60 * 60 * 1000))
  return Math.max(0, restante)
}

// Tem qualquer plano pago ATIVO (PRO ou PREMIUM) — libera tudo que não é
// exclusivo do módulo fiscal/PDV. Note: isto NÃO considera o trial — use
// `podeUsarPro()` para a checagem completa (assinatura ativa OU em trial).
export function isPro(assinatura: Assinatura | null): boolean {
  return assinaturaAtiva(assinatura)
}

// Tem especificamente o plano PREMIUM ativo — libera o que é exclusivo
// dele (NF-e, NFS-e, NF-C, PDV, Caixa). Premium NUNCA tem trial.
export function isPremium(assinatura: Assinatura | null): boolean {
  return assinaturaAtiva(assinatura) && assinatura?.plano === 'premium'
}

// Checagem completa de acesso ao nível PRO: assinatura PRO/PREMIUM ativa,
// OU ainda dentro dos 14 dias de trial gratuito (mesmo sem nunca ter
// assinado nada — `assinatura` pode ser null neste caso).
export function podeUsarPro(assinatura: Assinatura | null, criadoEm: string | null | undefined): boolean {
  return isPro(assinatura) || emTrialPro(criadoEm)
}
