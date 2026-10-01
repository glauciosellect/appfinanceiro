import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Assinatura } from '@/lib/supabase/assinatura'
import { resolverSistema, type Sistema } from '@/lib/intro/sistema'

export interface ContextoSistema {
  user: User
  assinatura: Assinatura | null
  sistema: Sistema
}

// Carrega usuário + assinatura e resolve qual sistema (intro/padrão) abre.
// Retorna null se não houver usuário logado.
export async function carregarContextoSistema(): Promise<ContextoSistema | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('assinaturas')
    .select('*')
    .eq('user_id', user.id)
    .single()
  const assinatura = (data as Assinatura | null) ?? null

  const sistema = resolverSistema({
    assinatura,
    email: user.email,
    planoEscolhido: user.user_metadata?.plano_escolhido,
  })
  return { user, assinatura, sistema }
}

export function rotaInicial(sistema: Sistema): string {
  return sistema === 'intro' ? '/intro' : '/dashboard'
}
