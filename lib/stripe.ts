import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

export const PLANS = {
  monthly: {
    name: 'Mensal',
    price: 'R$ 29,90',
    interval: 'mês',
    priceId: process.env.STRIPE_PRICE_MONTHLY!,
  },
  yearly: {
    name: 'Anual',
    price: 'R$ 299,00',
    interval: 'ano',
    priceId: process.env.STRIPE_PRICE_YEARLY!,
    savings: 'Economize R$ 59,80',
  },
} as const

export const TRIAL_DAYS = 14
