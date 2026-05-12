import Stripe from 'stripe'

export function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-04-22.dahlia',
  })
}

export const PLANS = {
  monthly: {
    name: 'Essencial Mensal',
    price: 'R$ 39,90',
    interval: 'mês',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY!,
    premium: false,
  },
  yearly: {
    name: 'Essencial Anual',
    price: 'R$ 358,80',
    interval: 'ano',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY!,
    savings: 'Economize R$ 120,00/ano — R$ 29,90/mês',
    premium: false,
  },
  premium: {
    name: 'Premium Fiscal',
    price: 'R$ 99,90',
    interval: 'mês',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM!,
    premium: true,
    badge: 'Módulo Fiscal Completo',
  },
} as const

export type PlanKey = keyof typeof PLANS

export const TRIAL_DAYS = 14
