import Stripe from 'stripe'

export function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-04-22.dahlia',
  })
}

export const PLANS = {
  monthly: {
    name: 'Mensal',
    price: 'R$ 39,90',
    interval: 'mês',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY!,
  },
  yearly: {
    name: 'Anual',
    price: 'R$ 358,80',
    interval: 'ano',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY!,
    savings: 'Economize R$ 120,00/ano — R$ 29,90/mês',
  },
} as const

export const TRIAL_DAYS = 14
