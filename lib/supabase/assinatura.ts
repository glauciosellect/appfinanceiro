import { createClient } from '@/lib/supabase/client'

export type StatusAssinatura = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'

export interface Assinatura {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  status: StatusAssinatura
  trial_end: string | null
  current_period_end: string | null
  created_at: string
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
  if (assinatura.status === 'active') return true
  if (assinatura.status === 'trialing') {
    const trialEnd = assinatura.trial_end ? new Date(assinatura.trial_end) : null
    return trialEnd ? trialEnd > new Date() : false
  }
  return false
}

export function diasRestantesTrial(assinatura: Assinatura | null): number {
  if (!assinatura || assinatura.status !== 'trialing') return 0
  if (!assinatura.trial_end) return 0
  const diff = new Date(assinatura.trial_end).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

// IDs dos planos Premium Fiscal (mensal e anual) — adicione novos price IDs aqui conforme criar no Stripe
const PREMIUM_PRICE_IDS = [
  process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_ANUAL,
].filter(Boolean) as string[]

export function isPremiumFiscal(assinatura: Assinatura | null): boolean {
  if (!assinatura) return false
  if (assinatura.status !== 'active') return false
  if (!assinatura.stripe_price_id) return false
  return PREMIUM_PRICE_IDS.includes(assinatura.stripe_price_id)
}
