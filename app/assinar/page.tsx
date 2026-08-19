'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/logo'
import {
  Check, Loader2, Star, Shield, Zap, FileText, Receipt, Package,
  CreditCard, QrCode, Copy, RefreshCw, ShoppingCart, Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type PlanoKey = 'pro' | 'premium'
type MetodoPagamento = 'CREDIT_CARD' | 'PIX'

const PLANOS: Record<PlanoKey, { nome: string; preco: string; valor: number }> = {
  pro: { nome: 'PRO', preco: 'R$ 97,00', valor: 97 },
  premium: { nome: 'PREMIUM', preco: 'R$ 147,00', valor: 147 },
}

const FEATURES_PRO = [
  'Dashboard completo com KPIs',
  'Contas a Pagar e Receber',
  'Cartões de Crédito',
  'Clientes e Fornecedores',
  'Fluxo de Caixa',
  'Relatórios e Gráficos',
  'Alertas',
  'Orçamentos',
  'Produtos e Serviços',
  'Controle de Estoque',
  'Suporte via e-mail',
  'Acesso no celular (PWA)',
]

const FEATURES_PREMIUM = [
  'Tudo do plano PRO',
  'PDV — Ponto de Venda',
  'Controle de Caixa',
  'Emissão de NF-e (Produtos)',
  'Emissão de NFS-e (Serviços)',
  'NF-C — Cupom Fiscal (em breve)',
]

interface QrCodePix {
  qrCodeBase64: string
  payload: string
  expirationDate: string
}

export default function AssinarPage() {
  const router = useRouter()
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoKey>('premium')
  const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>('CREDIT_CARD')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [nome, setNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [pix, setPix] = useState<QrCodePix | null>(null)
  const [verificando, setVerificando] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const plano = sessionStorage.getItem('plano_selecionado')
    if (plano === 'pro' || plano === 'premium') {
      setPlanoSelecionado(plano)
      sessionStorage.removeItem('plano_selecionado')
    }
  }, [])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  function iniciarPolling() {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (!data.user) return
      const { data: assinatura } = await supabase
        .from('assinaturas')
        .select('status')
        .eq('user_id', data.user.id)
        .single()
      if (assinatura?.status === 'active') {
        if (pollRef.current) clearInterval(pollRef.current)
        router.push('/dashboard?assinatura=sucesso')
      }
    }, 5000)
  }

  async function verificarManualmente() {
    setVerificando(true)
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      const { data: assinatura } = await supabase
        .from('assinaturas')
        .select('status')
        .eq('user_id', data.user.id)
        .single()
      if (assinatura?.status === 'active') {
        router.push('/dashboard?assinatura=sucesso')
        return
      }
    }
    setErro('Pagamento ainda não confirmado. Aguarde alguns instantes e tente novamente.')
    setVerificando(false)
  }

  async function copiarPayload() {
    if (!pix) return
    try {
      await navigator.clipboard.writeText(pix.payload)
    } catch {
      // silencioso — usuário pode selecionar o texto manualmente
    }
  }

  async function handleAssinar() {
    setErro('')

    if (!cpfCnpj.trim() || cpfCnpj.replace(/\D/g, '').length < 11) {
      setErro('Informe um CPF ou CNPJ válido para continuar.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/asaas/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plano: planoSelecionado,
          metodoPagamento,
          cpfCnpj: cpfCnpj.replace(/\D/g, ''),
          nome: nome.trim() || undefined,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setErro(json.error || 'Erro ao iniciar pagamento.')
        setLoading(false)
        return
      }

      if (json.link) {
        window.location.href = json.link
        return
      }

      if (json.qrCodeBase64) {
        setPix({
          qrCodeBase64: json.qrCodeBase64,
          payload: json.payload,
          expirationDate: json.expirationDate,
        })
        iniciarPolling()
        setLoading(false)
        return
      }

      setErro('Resposta inesperada do servidor.')
      setLoading(false)
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
          <p className="text-slate-400 text-lg">Cancele quando quiser, sem taxa de cancelamento.</p>
        </div>

        {pix ? (
          /* ------- Tela de pagamento PIX (QR Code inline) ------- */
          <div className="bg-white/5 rounded-2xl border border-white/10 p-8 max-w-md mx-auto text-center">
            <h2 className="text-white font-bold text-lg mb-1">Pague com PIX</h2>
            <p className="text-slate-400 text-sm mb-6">
              Escaneie o QR Code ou copie o código abaixo no app do seu banco.
            </p>
            <div className="bg-white rounded-xl p-4 inline-block mb-4">
              <img
                src={`data:image/png;base64,${pix.qrCodeBase64}`}
                alt="QR Code PIX"
                className="w-56 h-56 object-contain"
              />
            </div>
            <div className="bg-black/30 rounded-lg p-3 mb-4 break-all text-left">
              <p className="text-slate-300 text-xs font-mono leading-relaxed">{pix.payload}</p>
            </div>
            <button
              onClick={copiarPayload}
              className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium py-2.5 rounded-lg transition-colors mb-3"
            >
              <Copy className="h-4 w-4" /> Copiar código PIX
            </button>
            <button
              onClick={verificarManualmente}
              disabled={verificando}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white text-sm font-bold py-2.5 rounded-lg transition-colors"
            >
              {verificando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Já paguei, verificar
            </button>
            {erro && <p className="text-red-400 text-xs mt-3">{erro}</p>}
            <p className="text-slate-500 text-xs mt-4">
              A ativação é automática assim que o pagamento for confirmado — esta página verifica sozinha a cada poucos segundos.
            </p>
          </div>
        ) : (
          <>
            {/* Benefícios */}
            <div className="grid grid-cols-3 gap-4 mb-10">
              {[
                { icon: Shield, label: 'Dados seguros', sub: 'Criptografia total' },
                { icon: Zap, label: 'Ativação rápida', sub: 'Assim que o pagamento é confirmado' },
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
              {/* PRO */}
              <button
                onClick={() => setPlanoSelecionado('pro')}
                className={cn(
                  'relative rounded-2xl p-6 text-left border-2 transition-all',
                  planoSelecionado === 'pro'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/30'
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn(
                    'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0',
                    planoSelecionado === 'pro' ? 'border-blue-500 bg-blue-500' : 'border-slate-500'
                  )}>
                    {planoSelecionado === 'pro' && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <span className="text-white font-semibold">SyncroMoney {PLANOS.pro.nome}</span>
                </div>
                <div className="mb-1">
                  <span className="text-2xl font-bold text-white">{PLANOS.pro.preco}</span>
                  <span className="text-slate-400 text-sm ml-1">/mês</span>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
                  {['Financeiro completo', 'Produtos, Serviços e Estoque', 'Orçamentos e Relatórios'].map(f => (
                    <div key={f} className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-blue-400 shrink-0" />
                      <span className="text-slate-400 text-xs">{f}</span>
                    </div>
                  ))}
                </div>
              </button>

              {/* PREMIUM */}
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
                  <span className="text-amber-300 font-bold">SyncroMoney {PLANOS.premium.nome}</span>
                </div>
                <div className="mb-1">
                  <span className="text-2xl font-bold text-white">{PLANOS.premium.preco}</span>
                  <span className="text-slate-400 text-sm ml-1">/mês</span>
                </div>
                <p className="text-amber-400 text-xs font-medium mb-3">Tudo do PRO + módulo fiscal e PDV</p>
                <div className="pt-3 border-t border-amber-400/20 space-y-1">
                  {[
                    { icon: ShoppingCart, label: 'PDV e Caixa' },
                    { icon: FileText, label: 'NF-e (Produtos)' },
                    { icon: Receipt, label: 'NFS-e (Serviços)' },
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
                {isPremium ? '⚡ Tudo incluído no PREMIUM:' : 'Tudo incluído no PRO:'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(isPremium ? FEATURES_PREMIUM : FEATURES_PRO).map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Check className={cn('h-4 w-4 shrink-0', isPremium ? 'text-amber-400' : 'text-green-400')} />
                    <span className="text-slate-300 text-sm">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Método de pagamento */}
            <div className="mb-6">
              <p className="text-white font-semibold mb-3">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMetodoPagamento('CREDIT_CARD')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl p-4 border-2 transition-all font-medium',
                    metodoPagamento === 'CREDIT_CARD'
                      ? 'border-blue-500 bg-blue-500/10 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/30'
                  )}
                >
                  <CreditCard className="h-4 w-4" /> Cartão de Crédito
                </button>
                <button
                  onClick={() => setMetodoPagamento('PIX')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl p-4 border-2 transition-all font-medium',
                    metodoPagamento === 'PIX'
                      ? 'border-blue-500 bg-blue-500/10 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/30'
                  )}
                >
                  <QrCode className="h-4 w-4" /> PIX
                </button>
              </div>
            </div>

            {/* Dados para cobrança */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Nome completo ou Razão Social</label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Como aparece no seu documento"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">CPF ou CNPJ *</label>
                <input
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(e.target.value)}
                  placeholder="Somente números"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
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
                <>
                  <Wallet className="h-5 w-5" />
                  Assinar {PLANOS[planoSelecionado].nome} — {PLANOS[planoSelecionado].preco}/mês
                </>
              )}
            </button>

            <p className="text-slate-500 text-xs text-center mt-4">
              Pagamento processado com segurança pela Asaas. Cancele a qualquer momento. Sem taxa de cancelamento.
            </p>

            <div className="text-center mt-6">
              <button
                onClick={() => router.push('/login')}
                className="text-slate-500 hover:text-slate-400 text-sm transition-colors"
              >
                Já tenho uma assinatura — Fazer login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
