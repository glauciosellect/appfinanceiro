'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/logo'
import { Check, Loader2, Star, Shield, Zap, FileText, Receipt, Package } from 'lucide-react'
import { PLANS, type PlanKey } from '@/lib/stripe'
import { cn } from '@/lib/utils'

const FEATURES_ESSENCIAL = [
  'Dashboard completo com KPIs',
  'Contas a Pagar e Receber',
  'Clientes e Fornecedores',
  'Cartões de Crédito',
  'Fluxo de Caixa',
  'Relatórios e Gráficos',
  'Suporte via e-mail',
  'Acesso no celular (PWA)',
]

const FEATURES_PREMIUM = [
  'Tudo do plano Essencial',
  'Emissão de NF-e (Produtos)',
  'Emissão de NFS-e (Serviços)',
  'NF-e de Entrada (Compras)',
  'DANFE completo — Impressão/PDF',
  'Controle de Estoque integrado',
  'Produtos com NCM/CFOP/CST',
  'Transportadoras com RNTRC',
  'Cálculo automático ICMS/IPI/ISS',
  'ISS retido na fonte',
]

export default function AssinarPage() {
  const router = useRouter()
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanKey>('premium')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleAssinar() {
    setLoading(true)
    setErro('')

    const priceId = PLANS[planoSelecionado].priceId

    if (!priceId || priceId === 'price_placeholder' || priceId.startsWith('price_COLOQUE')) {
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

  const isPremium = planoSelecionado === 'premium'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Escolha seu plano</h1>
          <p className="text-slate-400 text-lg">14 dias grátis para testar. Cancele quando quiser.</p>
        </div>

        {/* Benefícios */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { icon: Shield, label: 'Dados seguros', sub: 'Criptografia total' },
            { icon: Zap, label: '14 dias grátis', sub: 'Sem cobrança agora' },
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Essencial Mensal */}
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
                  <span className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    ECONÔMICO
                  </span>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn(
                    'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0',
                    ativo ? 'border-blue-500 bg-blue-500' : 'border-slate-500'
                  )}>
                    {ativo && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <span className="text-white font-semibold">{p.name}</span>
                </div>
                <div className="mb-1">
                  <span className="text-2xl font-bold text-white">{p.price}</span>
                  <span className="text-slate-400 text-sm ml-1">/{p.interval}</span>
                </div>
                {'savings' in p && (
                  <p className="text-green-400 text-xs font-medium">{p.savings}</p>
                )}
                <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
                  {['Financeiro completo', 'Clientes e fornecedores', 'Relatórios'].map(f => (
                    <div key={f} className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-blue-400 shrink-0" />
                      <span className="text-slate-400 text-xs">{f}</span>
                    </div>
                  ))}
                </div>
              </button>
            )
          })}

          {/* Premium Fiscal */}
          <button
            onClick={() => setPlanoSelecionado('premium')}
            className={cn(
              'relative rounded-2xl p-6 text-left border-2 transition-all',
              planoSelecionado === 'premium'
                ? 'border-amber-400 bg-amber-400/10'
                : 'border-amber-400/30 bg-amber-400/5 hover:border-amber-400/60'
            )}
          >
            <span className="absolute top-3 right-3 bg-amber-400 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full">
              PREMIUM
            </span>
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0',
                planoSelecionado === 'premium' ? 'border-amber-400 bg-amber-400' : 'border-amber-400/50'
              )}>
                {planoSelecionado === 'premium' && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
              <span className="text-amber-300 font-bold">{PLANS.premium.name}</span>
            </div>
            <div className="mb-1">
              <span className="text-2xl font-bold text-white">{PLANS.premium.price}</span>
              <span className="text-slate-400 text-sm ml-1">/{PLANS.premium.interval}</span>
            </div>
            <p className="text-amber-400 text-xs font-medium mb-3">Inclui módulo fiscal completo</p>
            <div className="pt-3 border-t border-amber-400/20 space-y-1">
              {[
                { icon: FileText, label: 'NF-e de Produtos (DANFE)' },
                { icon: Receipt, label: 'NFS-e de Serviços' },
                { icon: Package, label: 'Estoque integrado' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <Icon className="h-3 w-3 text-amber-400 shrink-0" />
                  <span className="text-amber-200/80 text-xs">{label}</span>
                </div>
              ))}
            </div>
          </button>
        </div>

        {/* Features do plano selecionado */}
        <div className={cn(
          'rounded-2xl p-6 border mb-8 transition-colors',
          isPremium
            ? 'bg-amber-400/5 border-amber-400/20'
            : 'bg-white/5 border-white/10'
        )}>
          <p className={cn('font-semibold mb-4', isPremium ? 'text-amber-300' : 'text-white')}>
            {isPremium ? '⚡ Tudo incluído no Premium Fiscal:' : 'Tudo incluído no plano:'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(isPremium ? FEATURES_PREMIUM : FEATURES_ESSENCIAL).map((f) => (
              <div key={f} className="flex items-center gap-2">
                <Check className={cn('h-4 w-4 shrink-0', isPremium ? 'text-amber-400' : 'text-green-400')} />
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
          className={cn(
            'w-full disabled:opacity-60 font-bold py-4 rounded-2xl text-lg transition-colors flex items-center justify-center gap-2',
            isPremium
              ? 'bg-amber-400 hover:bg-amber-300 text-slate-900'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          )}
        >
          {loading ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Aguarde...</>
          ) : (
            `Assinar ${PLANS[planoSelecionado].name} — ${PLANS[planoSelecionado].price}/${PLANS[planoSelecionado].interval}`
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
