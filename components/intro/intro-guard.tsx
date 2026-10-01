'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Lock } from 'lucide-react'
import { Logo } from '@/components/logo'
import { carregarContextoSistema } from '@/lib/intro/sistema-client'
import { podeUsarIntro } from '@/lib/supabase/assinatura'

interface Props {
  children: React.ReactNode
  onUser?: (email: string) => void
}

// Garante que só quem está no plano INTRO (assinatura ativa ou trial de 14
// dias) vê /intro/*. Outros planos voltam para o app padrão.
export function IntroGuard({ children, onUser }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'ok' | 'blocked'>('loading')

  useEffect(() => {
    async function verificar() {
      const ctx = await carregarContextoSistema()
      if (!ctx) { router.replace('/login'); return }
      if (ctx.sistema !== 'intro') { router.replace('/dashboard'); return }
      onUser?.(ctx.user.email ?? '')
      setStatus(podeUsarIntro(ctx.assinatura, ctx.user.created_at) ? 'ok' : 'blocked')
    }
    verificar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (status === 'blocked') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 p-4">
        <Logo size="lg" className="mb-8" />
        <div className="bg-white/10 backdrop-blur rounded-2xl p-8 max-w-md w-full text-center border border-white/20">
          <Lock className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Acesso bloqueado</h2>
          <p className="text-slate-400 mb-6">
            Seus 14 dias grátis terminaram ou o pagamento está pendente. Assine o SyncroMoney Intro para continuar.
          </p>
          <Link
            href="/assinar"
            className="inline-block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Assinar o Intro — R$ 57,90/mês
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
