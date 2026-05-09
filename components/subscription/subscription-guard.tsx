'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { assinaturaAtiva, diasRestantesTrial, type Assinatura } from '@/lib/supabase/assinatura'
import { Loader2, Lock, AlertTriangle } from 'lucide-react'
import { Logo } from '@/components/logo'

interface Props {
  children: React.ReactNode
}

export function SubscriptionGuard({ children }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'ok' | 'blocked' | 'trial'>('loading')
  const [diasTrial, setDiasTrial] = useState(0)
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null)

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

      if (assinaturaAtiva(ass)) {
        setDiasTrial(diasRestantesTrial(ass))
        setStatus(ass?.status === 'trialing' ? 'trial' : 'ok')
      } else {
        setStatus('blocked')
      }
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
              ? 'Seu pagamento falhou. Atualize seu método de pagamento para continuar.'
              : 'Seu período de teste expirou. Assine para continuar usando o SyncroMoney.'}
          </p>
          <button
            onClick={() => router.push('/assinar')}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors mb-3"
          >
            Ver planos e assinar
          </button>
          <button
            onClick={async () => {
              if (assinatura?.stripe_customer_id) {
                const res = await fetch('/api/stripe/portal', { method: 'POST' })
                const json = await res.json()
                if (json.url) window.location.href = json.url
              }
            }}
            className="w-full text-slate-400 hover:text-white text-sm transition-colors py-2"
          >
            Gerenciar assinatura existente
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {status === 'trial' && diasTrial <= 3 && (
        <div className="bg-amber-500 text-amber-950 text-sm font-medium text-center py-2 px-4 flex items-center justify-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {diasTrial === 0
            ? 'Seu trial expira hoje! '
            : `${diasTrial} dia${diasTrial > 1 ? 's' : ''} restante${diasTrial > 1 ? 's' : ''} no período gratuito. `}
          <button
            onClick={() => router.push('/assinar')}
            className="underline font-bold hover:opacity-80"
          >
            Assine agora
          </button>
        </div>
      )}
      {children}
    </>
  )
}
