'use client'

export const dynamic = 'force-dynamic'

import { PdvTela } from '@/components/pdv/pdv-tela'

export default function IntroPdvPage() {
  return <PdvTela rotas={{ menu: '/intro', caixa: '/intro/caixa', configuracoes: '/intro/configuracoes' }} />
}
