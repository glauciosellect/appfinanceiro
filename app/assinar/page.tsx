'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Check, Loader2, Star, Shield, Zap } from 'lucide-react'
import { PLANS } from '@/lib/stripe'
import { cn } from '@/lib/utils'

const FEATURES = [
  'Dashboard completo com KPIs',
  'Contas a Pagar e Receber',
  'Controle de Clientes e Fornecedores',
  'Cartões de Crédito',
  'Fluxo de Caixa',
  'Relatórios e Gráficos',
  'Suporte via e-mail',
  'Acesso no celular (PWA)',
]

export default function AssinarPage() {
  const router = useRouter()
  const [planoSelecionado, setPlanoSelecionado] = useState<'monthly' | 'yearly'>('yearly')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleAssinar() {
    setLoading(true)
    setErro('')

    const priceId = PLANS[planoSelecionado].priceId

    if (!priceId || priceId.startsWith('price_COLOQUE')) {
      setErro('Plano ainda não configurado. Entre em contato com o suporte.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const json = await res.json()
      if (json.url) {
        window.location.href = json.url
      } else {
        setErro(json.error || 'Erro ao iniciar pagamento.')
        setLoading(false)
      }
    } catch {
      setErro('Erro de conexão. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Escolha seu plano</h1>
          <p className="text-slate-400 text-lg">7 dias grátis para testar. Cancele quando quiser.</p>
        </div>

        {/* Benefícios */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { icon: Shield, label: 'Dados seguros', sub: 'Criptografia total' },
            { icon: Zap, label: '7 dias grátis', sub: 'Sem cobrança agora' },
            { icon: Star, label: 'Suporte incluso', sub: 'Respondemos em 24h' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="bg-white/5 rounded-2xl p-4 text-center border border-white/10">
              <Icon className="h-6 w-6 text-blue-400 mx-auto mb-2" />
              <p className="text-white font-semibold text-sm">{label}</p>
              <p className="text-slate-400 text-xs">{sub}</p>
            </div>
          ))}
        </div>

        {/* Planos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {(['monthly', 'yearly'] as const).map((plano) => {
            const p = PLANS[plano]
            const ativo = planoSelecionado === plano
            return (
              <button
                key={plano}
                onClick={() => setPlanoSelecionado(plano)}
                className={cn(
                  'relative rounded-2xl p-6 text-left border-2 transition-all',
                  ativo
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/30'
                )}
              >
                {plano === 'yearly' && (
                  <span className="absolute top-4 right-4 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    MAIS POPULAR
                  </span>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn(
                    'h-5 w-5 rounded-full border-2 flex items-center justify-center',
                    ativo ? 'border-blue-500 bg-blue-500' : 'border-slate-500'
                  )}>
                    {ativo && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <span className="text-white font-semibold text-lg">{p.name}</span>
                </div>
                <div className="mb-1">
                  <span className="text-3xl font-bold text-white">{p.price}</span>
                  <span className="text-slate-400 text-sm ml-1">/{p.interval}</span>
                </div>
                {'savings' in p && (
                  <p className="text-green-400 text-sm font-medium">{p.savings}</p>
                )}
              </button>
            )
          })}
        </div>

        {/* Features */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-8">
          <p className="text-white font-semibold mb-4">Tudo incluído no plano:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-400 shrink-0" />
                <span className="text-slate-300 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        {erro && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-3 text-red-300 text-sm text-center">
            {erro}
          </div>
        )}

        <button
          onClick={handleAssinar}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold py-4 rounded-2xl text-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Aguarde...</>
          ) : (
            `Começar 7 dias grátis — ${PLANS[planoSelecionado].price}/${PLANS[planoSelecionado].interval}`
          )}
        </button>

        <p className="text-slate-500 text-xs text-center mt-4">
          Pagamento seguro via Stripe. Cancele a qualquer momento. Sem taxa de cancelamento.
        </p>

        <div className="text-center mt-6">
          <button
            onClick={() => router.push('/login')}
            className="text-slate-500 hover:text-slate-400 text-sm transition-colors"
          >
            Já tenho uma assinatura — Fazer login
          </button>
        </div>
      </div>
    </div>
  )
}
