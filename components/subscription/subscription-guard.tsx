'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { podeUsarPro, diasRestantesTrial, type Assinatura } from '@/lib/supabase/assinatura'
import { Loader2, Lock, LogOut } from 'lucide-react'
import { Logo } from '@/components/logo'

interface Props {
  children: React.ReactNode
}

export function SubscriptionGuard({ children }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'ok' | 'blocked'>('loading')
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null)
  const [diasTrial, setDiasTrial] = useState(0)

  useEffect(() => {
    async function verificar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('assinaturas')
        .select('*')
        .eq('user_id', user.id)
        .single()

      const ass = data as Assinatura | null
      setAssinatura(ass)
      setDiasTrial(diasRestantesTrial(user.created_at))
      // Trial de 14 dias grátis vale para acesso PRO (assinatura ativa OU
      // ainda dentro do prazo desde o cadastro). O Premium (PDV/Caixa/
      // Fiscal) segue gateado à parte por isPremium — nunca tem trial.
      setStatus(podeUsarPro(ass, user.created_at) ? 'ok' : 'blocked')
    }
    verificar()
  }, [router])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (status === 'blocked') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
        <Logo size="lg" className="mb-8" />
        <div className="bg-white/10 backdrop-blur rounded-2xl p-8 max-w-md w-full text-center border border-white/20">
          <Lock className="h-12 w-12 text-blue-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Acesso bloqueado</h2>
          <p className="text-slate-400 mb-6">
            {assinatura?.status === 'past_due'
              ? 'Seu pagamento ficou em atraso. Regularize para continuar.'
              : assinatura?.status === 'pending'
              ? 'Aguardando confirmação do seu pagamento.'
              : diasTrial <= 0 && !assinatura
              ? 'Seus 14 dias grátis terminaram. Assine para continuar usando o SyncroMoney.'
              : 'Assine para continuar usando o SyncroMoney.'}
          </p>
          <button
            onClick={() => router.push('/assinar')}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors mb-3"
          >
            Ver planos e assinar
          </button>
          <button
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="w-full text-slate-500 hover:text-slate-300 text-sm transition-colors py-2 flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sair e usar outra conta
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
