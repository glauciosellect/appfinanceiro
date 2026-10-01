'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, Building2, Package, Users, Settings } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { carregarContextoSistema } from '@/lib/intro/sistema-client'
import { diasRestantesTrial, assinaturaAtiva } from '@/lib/supabase/assinatura'

// Início provisório do Intro: o dashboard completo chega na Fase 5 do spec.
export default function IntroHomePage() {
  const [diasTrial, setDiasTrial] = useState<number | null>(null)

  useEffect(() => {
    carregarContextoSistema().then((ctx) => {
      if (!ctx) return
      setDiasTrial(assinaturaAtiva(ctx.assinatura) ? null : diasRestantesTrial(ctx.user.created_at))
    })
  }, [])

  const atalhos = [
    { href: '/intro/fornecedores', label: 'Cadastrar fornecedores', icon: Building2 },
    { href: '/intro/produtos', label: 'Cadastrar produtos', icon: Package },
    { href: '/intro/clientes', label: 'Cadastrar clientes', icon: Users },
    { href: '/intro/configuracoes', label: 'Dados da sua loja', icon: Settings },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bem-vindo ao SyncroMoney Intro</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Comece cadastrando fornecedores, produtos e os dados da sua loja.
        </p>
      </div>

      {diasTrial !== null && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 px-4 py-3">
          <Clock className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800 dark:text-emerald-300 flex-1">
            {diasTrial > 0
              ? `Você está no período grátis: restam ${diasTrial} ${diasTrial === 1 ? 'dia' : 'dias'}.`
              : 'Seu período grátis terminou.'}
          </p>
          <Link href="/assinar" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap">
            Assinar — R$ 57,90/mês
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {atalhos.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="py-5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-emerald-600" />
                </div>
                <span className="font-medium text-gray-800 dark:text-gray-200">{label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
