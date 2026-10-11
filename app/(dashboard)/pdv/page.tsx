'use client'

export const dynamic = 'force-dynamic'

import { PdvTela } from '@/components/pdv/pdv-tela'

// Mesmo PDV do plano Intro (venda com baixa automática de estoque, pagamento misto, venda em
// espera, comprovante). Quando a NFC-e (cupom fiscal) for liberada, é aqui que ela entra.
export default function PdvPage() {
  return <PdvTela rotas={{ menu: '/dashboard', caixa: '/caixa', configuracoes: '/configuracoes', usarPerfilEmpresa: true }} />
}
