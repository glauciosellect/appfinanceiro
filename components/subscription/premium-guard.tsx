'use client'

import { useRouter } from 'next/navigation'
import { Crown, Zap, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePlan } from '@/lib/hooks/use-plan'

interface Props {
  children: React.ReactNode
}

export function PremiumGuard({ children }: Props) {
  const { loading, isPremium } = usePlan()
  const router = useRouter()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
      </div>
    )
  }

  if (!isPremium) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full text-center space-y-6 p-8 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto">
            <Crown className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Módulo Fiscal — Plano Premium</h2>
            <p className="text-gray-500 text-sm mt-2">
              A emissão de NF-e e NFS-e está disponível exclusivamente no plano <strong>Premium Fiscal</strong>.
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left space-y-2">
            {[
              'Emissão de NFS-e integrada à Prefeitura',
              'Emissão de NF-e (SEFAZ)',
              'NF-e de entrada',
              'PDV — Ponto de Venda',
              'Caixa (abertura, sangria, fechamento)',
            ].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-amber-800">
                <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
              onClick={() => router.push('/assinar')}
            >
              <Crown className="h-4 w-4 mr-2" />
              Fazer upgrade para Premium Fiscal
            </Button>
            <Button variant="outline" className="w-full" onClick={() => router.back()}>
              Voltar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
