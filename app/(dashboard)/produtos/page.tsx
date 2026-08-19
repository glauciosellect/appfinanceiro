'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// /produtos e /fiscal-produtos são a mesma tela (mesmo catálogo unificado em
// produtos_fiscais). Esta rota existe só para dar acesso a usuários sem plano
// premium, já que a seção FISCAL fica oculta no menu para eles — o cadastro
// de produtos alimenta PDV/Orçamento, que não são recursos premium.
export default function ProdutosRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/fiscal-produtos')
  }, [router])
  return null
}
