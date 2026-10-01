import type { Assinatura } from '@/lib/supabase/assinatura'
import { ehEmailVitalicio } from '@/lib/supabase/assinatura'

export type Sistema = 'intro' | 'padrao'

interface Entrada {
  assinatura: Assinatura | null
  email: string | null | undefined
  // user_metadata.plano_escolhido — preferência gravada no cadastro. Só vale
  // durante o trial: é editável pelo próprio usuário, então NUNCA dá acesso
  // pago; o acesso pago vem sempre da tabela `assinaturas` (só o servidor grava).
  planoEscolhido: unknown
}

// Qual sistema abre para o usuário logado: o plano é a única fonte da verdade.
//  - e-mail vitalício → app padrão (PREMIUM)
//  - assinatura existente (qualquer status) → plano dela
//  - sem assinatura (trial) → plano escolhido no cadastro; padrão se não escolheu
export function resolverSistema({ assinatura, email, planoEscolhido }: Entrada): Sistema {
  if (ehEmailVitalicio(email)) return 'padrao'
  if (assinatura && assinatura.status !== 'canceled') {
    return assinatura.plano === 'intro' ? 'intro' : 'padrao'
  }
  return planoEscolhido === 'intro' ? 'intro' : 'padrao'
}
