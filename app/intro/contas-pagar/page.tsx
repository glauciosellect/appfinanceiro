'use client'

export const dynamic = 'force-dynamic'

import { ContasLista } from '@/components/intro/contas-lista'

export default function ContasPagarPage() {
  return <ContasLista tipo="pagar" />
}
