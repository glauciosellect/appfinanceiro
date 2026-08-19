'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts'
import {
  AlertTriangle, TrendingUp, TrendingDown, Clock, Wallet,
  ArrowRight, CheckCircle, BarChart3, Package,
} from 'lucide-react'
import Link from 'next/link'

// ─── Cores para pizza ────────────────────────────────────────────────
const COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#10b981']

interface Resumo {
  totalReceberAberto: number
  totalReceberAtrasado: number
  totalPagarAberto: number
  totalPagarAtrasado: number
  totalRecebidoMes: number
  totalPagoMes: number
  saldoContas: number
  qtdAlertasReceber: number
  qtdAlertasPagar: number
}
interface FluxoMes { mes: string; entradas: number; saidas: number; saldo: number }
interface ContaSaldo { id: string; nome_apelido: string; saldo_atual: number; tipo_conta: string }
interface CategoriaItem { nome: string; valor: number }
interface ProximoVencimento { descricao: string; cliente_fornecedor: string; valor: number; data: string; tipo: 'receber' | 'pagar' }

const MESES_LABEL = ['jan.','fev.','mar.','abr.','mai.','jun.','jul.','ago.','set.','out.','nov.','dez.']

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-gray-100 dark:bg-gray-700 animate-pulse rounded-xl ${className}`} />
}

// Tooltip customizado para os gráficos
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: {name:string;value:number;fill:string}[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill }} className="font-medium">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState<Resumo>({
    totalReceberAberto: 0, totalReceberAtrasado: 0,
    totalPagarAberto: 0, totalPagarAtrasado: 0,
    totalRecebidoMes: 0, totalPagoMes: 0,
    saldoContas: 0, qtdAlertasReceber: 0, qtdAlertasPagar: 0,
  })
  const [fluxoMeses, setFluxoMeses] = useState<FluxoMes[]>([])
  const [contasSaldo, setContasSaldo] = useState<ContaSaldo[]>([])
  const [categoriasPagar, setCategoriasPagar] = useState<CategoriaItem[]>([])
  const [proximosVencimentos, setProximosVencimentos] = useState<ProximoVencimento[]>([])
  const [grafTipo, setGrafTipo] = useState<'barras' | 'area'>('barras')
  const [estoque, setEstoque] = useState<{ totalProdutos: number; abaixoMinimo: number; valorTotal: number } | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
    fetch('/api/estoque').then(r => r.json()).then(({ produtos }) => {
      if (!produtos) return
      const total = produtos.reduce((s: number, p: { estoque: number; estoque_minimo: number; preco_custo: number }) => s + p.estoque * p.preco_custo, 0)
      const abaixo = produtos.filter((p: { estoque: number; estoque_minimo: number }) => p.estoque <= p.estoque_minimo).length
      setEstoque({ totalProdutos: produtos.length, abaixoMinimo: abaixo, valorTotal: total })
    }).catch(() => {})
  }, [])

  const fetchDados = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const supabase = createClient()

    const hoje = new Date().toISOString().split('T')[0]
    const em7dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    const inicio6m = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString().split('T')[0]

    const [
      rParcelasReceber,
      rParcelasPagar,
      rContas,
      rMovs,
      rProxReceber,
      rProxPagar,
      rContasPagar,
      rTransactions,
    ] = await Promise.all([
      supabase.from('parcelas_receber').select('valor,valor_recebido,status,data_vencimento,data_recebimento').eq('user_id', userId),
      supabase.from('parcelas_pagar').select('valor,valor_pago,status,data_vencimento,data_pagamento').eq('user_id', userId),
      supabase.from('contas_correntes').select('id,nome_apelido,saldo_atual,tipo_conta').eq('user_id', userId).eq('ativo', true),
      supabase.from('movimentacoes_conta').select('data_movimentacao,valor,tipo').eq('user_id', userId).gte('data_movimentacao', inicio6m).order('data_movimentacao'),
      supabase.from('parcelas_receber').select('valor,data_vencimento,conta_receber_id,contas_receber(descricao,clientes(nome))').eq('user_id', userId).in('status',['aberto','atrasado']).lte('data_vencimento', em7dias).order('data_vencimento').limit(5),
      supabase.from('parcelas_pagar').select('valor,data_vencimento,conta_pagar_id,contas_pagar(descricao,fornecedores(nome))').eq('user_id', userId).in('status',['aberto','atrasado']).lte('data_vencimento', em7dias).order('data_vencimento').limit(5),
      supabase.from('contas_pagar').select('descricao,valor_total,categorias(nome)').eq('user_id', userId).neq('status','cancelado'),
      supabase.from('transactions').select('type,amount,date').eq('user_id', userId).gte('date', inicioMes),
    ])

    const precs = rParcelasReceber.data ?? []
    const ppags = rParcelasPagar.data ?? []
    const txs = rTransactions.data ?? []

    // Transações simples (tabela transactions) somadas ao mês
    const txRecebidoMes = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const txPagoMes     = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    const totalReceberAberto  = precs.filter(p => p.status === 'aberto').reduce((s,p) => s + p.valor, 0)
    const totalReceberAtrasado = precs.filter(p => p.status === 'atrasado').reduce((s,p) => s + p.valor, 0)
    const totalRecebidoMes    = precs.filter(p => p.status === 'recebido' && (p.data_recebimento ?? p.data_vencimento) >= inicioMes).reduce((s,p) => s + (p.valor_recebido ?? p.valor), 0) + txRecebidoMes
    const totalPagarAberto    = ppags.filter(p => p.status === 'aberto').reduce((s,p) => s + p.valor, 0)
    const totalPagarAtrasado  = ppags.filter(p => p.status === 'atrasado').reduce((s,p) => s + p.valor, 0)
    const totalPagoMes        = ppags.filter(p => p.status === 'pago' && (p.data_pagamento ?? p.data_vencimento) >= inicioMes).reduce((s,p) => s + (p.valor_pago ?? p.valor), 0) + txPagoMes
    const qtdAlertasReceber   = precs.filter(p => p.status === 'aberto' && p.data_vencimento >= hoje && p.data_vencimento <= em7dias).length
    const qtdAlertasPagar     = ppags.filter(p => p.status === 'aberto' && p.data_vencimento >= hoje && p.data_vencimento <= em7dias).length
    const saldoContas         = (rContas.data ?? []).reduce((s,c) => s + c.saldo_atual, 0)

    setResumo({ totalReceberAberto, totalReceberAtrasado, totalPagarAberto, totalPagarAtrasado, totalRecebidoMes, totalPagoMes, saldoContas, qtdAlertasReceber, qtdAlertasPagar })
    setContasSaldo((rContas.data ?? []) as ContaSaldo[])

    // Fluxo 6 meses
    const mesMap: Record<string, { entradas: number; saidas: number }> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      mesMap[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`] = { entradas: 0, saidas: 0 }
    }
    for (const m of rMovs.data ?? []) {
      const key = m.data_movimentacao.substring(0, 7)
      if (!mesMap[key]) continue
      if (m.tipo === 'credito' || m.tipo === 'transferencia_entrada') mesMap[key].entradas += m.valor
      else mesMap[key].saidas += m.valor
    }
    let saldoAcum = 0
    setFluxoMeses(Object.entries(mesMap).map(([key, v]) => {
      saldoAcum += v.entradas - v.saidas
      const mesNum = parseInt(key.split('-')[1]) - 1
      return { mes: MESES_LABEL[mesNum], entradas: v.entradas, saidas: v.saidas, saldo: saldoAcum }
    }))

    // Categorias de despesas (usa join com tabela categorias via categoria_id)
    const catMap: Record<string, number> = {}
    for (const cp of rContasPagar.data ?? []) {
      const catObj = cp.categorias as unknown as { nome: string } | null
      const cat = catObj?.nome || 'Outros'
      catMap[cat] = (catMap[cat] || 0) + (cp.valor_total as number)
    }
    setCategoriasPagar(
      Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0,6).map(([nome,valor]) => ({ nome, valor }))
    )

    // Próximos vencimentos unificados
    const proxs: ProximoVencimento[] = [
      ...(rProxReceber.data ?? []).map((p: Record<string, unknown>) => {
        const cr = p.contas_receber as Record<string, unknown> | null
        const cl = cr?.clientes as Record<string, unknown> | null
        return { descricao: (cr?.descricao as string) ?? '—', cliente_fornecedor: (cl?.nome as string) ?? '—', valor: p.valor as number, data: p.data_vencimento as string, tipo: 'receber' as const }
      }),
      ...(rProxPagar.data ?? []).map((p: Record<string, unknown>) => {
        const cp = p.contas_pagar as Record<string, unknown> | null
        const fn = cp?.fornecedores as Record<string, unknown> | null
        return { descricao: (cp?.descricao as string) ?? '—', cliente_fornecedor: (fn?.nome as string) ?? '—', valor: p.valor as number, data: p.data_vencimento as string, tipo: 'pagar' as const }
      }),
    ].sort((a,b) => a.data.localeCompare(b.data)).slice(0, 6)
    setProximosVencimentos(proxs)

    setLoading(false)
  }, [userId])

  useEffect(() => { fetchDados() }, [fetchDados])

  const saldoLiquido = resumo.totalReceberAberto - resumo.totalPagarAberto
  const totalAlertas = resumo.qtdAlertasReceber + resumo.qtdAlertasPagar + (resumo.totalReceberAtrasado > 0 ? 1 : 0) + (resumo.totalPagarAtrasado > 0 ? 1 : 0)
  const mesAtual = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Cabeçalho ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-500 capitalize">{mesAtual}</p>
      </div>

      {/* ── KPIs principais — linha 1: A Receber | Recebido ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* A Receber */}
        <Link href="/contas-receber">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500 h-full">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">A Receber</p>
                  {loading ? <Skeleton className="h-6 w-full mt-1" /> : (
                    <p className="text-base sm:text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5 truncate">{formatCurrency(resumo.totalReceberAberto)}</p>
                  )}
                  {resumo.totalReceberAtrasado > 0 && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" /><span className="truncate">{formatCurrency(resumo.totalReceberAtrasado)} atrasado</span>
                    </p>
                  )}
                  {resumo.qtdAlertasReceber > 0 && (
                    <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3 shrink-0" />{resumo.qtdAlertasReceber} vence em 7 dias
                    </p>
                  )}
                </div>
                <div className="p-2 bg-green-50 rounded-xl shrink-0"><TrendingUp className="h-4 w-4 text-green-600" /></div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Recebido no mês */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Recebido</p>
                {loading ? <Skeleton className="h-6 w-full mt-1" /> : (
                  <p className="text-base sm:text-xl font-bold text-emerald-600 mt-0.5 truncate">{formatCurrency(resumo.totalRecebidoMes)}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">Recebido no mês</p>
              </div>
              <div className="p-2 bg-emerald-50 rounded-xl shrink-0"><CheckCircle className="h-4 w-4 text-emerald-600" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── KPIs linha 2: A Pagar | Pago ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* A Pagar */}
        <Link href="/contas-pagar">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-red-500 h-full">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">A Pagar</p>
                  {loading ? <Skeleton className="h-6 w-full mt-1" /> : (
                    <p className="text-base sm:text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5 truncate">{formatCurrency(resumo.totalPagarAberto)}</p>
                  )}
                  {resumo.totalPagarAtrasado > 0 && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" /><span className="truncate">{formatCurrency(resumo.totalPagarAtrasado)} atrasado</span>
                    </p>
                  )}
                  {resumo.qtdAlertasPagar > 0 && (
                    <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3 shrink-0" />{resumo.qtdAlertasPagar} vence em 7 dias
                    </p>
                  )}
                </div>
                <div className="p-2 bg-red-50 rounded-xl shrink-0"><TrendingDown className="h-4 w-4 text-red-600" /></div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Pago no mês */}
        <Card className="border-l-4 border-l-rose-400">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Pago</p>
                {loading ? <Skeleton className="h-6 w-full mt-1" /> : (
                  <p className="text-base sm:text-xl font-bold text-rose-600 mt-0.5 truncate">{formatCurrency(resumo.totalPagoMes)}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">Pago no mês</p>
              </div>
              <div className="p-2 bg-rose-50 rounded-xl shrink-0"><TrendingDown className="h-4 w-4 text-rose-500" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── KPIs linha 3: Saldo em Contas | Alertas ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Saldo em Contas */}
        <Link href="/contas-correntes">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-indigo-500 h-full">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Saldo em Contas</p>
                  {loading ? <Skeleton className="h-6 w-full mt-1" /> : (
                    <p className={`text-base sm:text-xl font-bold mt-0.5 truncate ${resumo.saldoContas >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-red-600'}`}>
                      {formatCurrency(resumo.saldoContas)}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{contasSaldo.length} conta(s) ativa(s)</p>
                </div>
                <div className="p-2 bg-indigo-50 rounded-xl shrink-0"><Wallet className="h-4 w-4 text-indigo-600" /></div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Alertas */}
        <Card className={`border-l-4 ${totalAlertas > 0 ? 'border-l-amber-500' : 'border-l-gray-200'}`}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Alertas</p>
                {loading ? <Skeleton className="h-6 w-16 mt-1" /> : (
                  <p className={`text-base sm:text-xl font-bold mt-0.5 ${totalAlertas > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{totalAlertas}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">pendências</p>
              </div>
              <div className={`p-2 rounded-xl shrink-0 ${totalAlertas > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                <AlertTriangle className={`h-4 w-4 ${totalAlertas > 0 ? 'text-amber-500' : 'text-gray-300'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Estoque ── */}
      {estoque !== null && (
        <Link href="/estoque">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-purple-50 rounded-xl shrink-0"><Package className="h-5 w-5 text-purple-600" /></div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Estoque</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{estoque.totalProdutos} produto(s) — {formatCurrency(estoque.valorTotal)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {estoque.abaixoMinimo > 0 && (
                    <p className="text-xs text-yellow-600 font-medium flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />{estoque.abaixoMinimo} abaixo do mínimo
                    </p>
                  )}
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* ── Fluxo de Caixa + Categorias ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Fluxo — ocupa 2 colunas */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Fluxo de Caixa — Últimos 6 Meses</CardTitle>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                {(['barras','area'] as const).map((t) => (
                  <button key={t} onClick={() => setGrafTipo(t)}
                    className={`px-3 py-1 transition-colors ${grafTipo===t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {t === 'barras' ? 'Barras' : 'Área'}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-52" /> : (
              <ResponsiveContainer width="100%" height={220}>
                {grafTipo === 'barras' ? (
                  <BarChart data={fluxoMeses} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} width={52} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[6,6,0,0]} />
                    <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[6,6,0,0]} />
                  </BarChart>
                ) : (
                  <AreaChart data={fluxoMeses} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="gradEnt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradSai" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} width={52} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="entradas" name="Entradas" stroke="#22c55e" strokeWidth={2} fill="url(#gradEnt)" />
                    <Area type="monotone" dataKey="saidas" name="Saídas" stroke="#ef4444" strokeWidth={2} fill="url(#gradSai)" />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Despesas por Categoria */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-52" /> : categoriasPagar.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center text-gray-400">
                <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">Nenhuma despesa</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoriasPagar} dataKey="valor" nameKey="nome" cx="50%" cy="45%"
                    outerRadius={75} innerRadius={35} paddingAngle={3}>
                    {categoriasPagar.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend formatter={(v) => <span className="text-xs text-gray-600 dark:text-gray-400">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Próximos Vencimentos + Saldo por Conta ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Próximos vencimentos */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Próximos Vencimentos (7 dias)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
            ) : proximosVencimentos.length === 0 ? (
              <div className="py-10 text-center">
                <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Nenhum vencimento nos próximos 7 dias</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {proximosVencimentos.map((v, i) => {
                  const dataFmt = new Date(v.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                  const isHoje = v.data === new Date().toISOString().split('T')[0]
                  const isAtrasado = v.data < new Date().toISOString().split('T')[0]
                  return (
                    <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${v.tipo === 'receber' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{v.descricao}</p>
                          <p className="text-xs text-gray-400 truncate">{v.cliente_fornecedor}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className={`text-sm font-bold ${v.tipo === 'receber' ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(v.valor)}
                        </p>
                        <p className={`text-xs font-medium ${isAtrasado ? 'text-red-500' : isHoje ? 'text-amber-600' : 'text-gray-400'}`}>
                          {isAtrasado ? 'Atrasado' : isHoje ? 'Hoje' : dataFmt}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Saldo por conta + alertas */}
        <div className="space-y-4">
          {/* Saldo por conta */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Saldo por Conta</CardTitle>
                <Link href="/contas-correntes" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  Ver todas <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10" />)}</div>
              ) : contasSaldo.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Nenhuma conta cadastrada</p>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {contasSaldo.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                          <Wallet className="h-4 w-4 text-indigo-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.nome_apelido}</p>
                          <p className="text-xs text-gray-400 capitalize">{c.tipo_conta}</p>
                        </div>
                      </div>
                      <p className={`text-sm font-semibold ${c.saldo_atual >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-red-600'}`}>
                        {formatCurrency(c.saldo_atual)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alertas */}
          {totalAlertas > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Alertas e Pendências
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {resumo.totalReceberAtrasado > 0 && (
                  <Link href="/contas-receber?status=atrasado" className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl hover:opacity-90 transition-opacity">
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">Recebimentos Atrasados</p>
                      <p className="text-xs text-red-500">{formatCurrency(resumo.totalReceberAtrasado)} em atraso</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-red-400 shrink-0" />
                  </Link>
                )}
                {resumo.totalPagarAtrasado > 0 && (
                  <Link href="/contas-pagar?status=atrasado" className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl hover:opacity-90 transition-opacity">
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">Pagamentos Atrasados</p>
                      <p className="text-xs text-red-500">{formatCurrency(resumo.totalPagarAtrasado)} em atraso</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-red-400 shrink-0" />
                  </Link>
                )}
                {resumo.qtdAlertasReceber > 0 && (
                  <Link href="/contas-receber" className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl hover:opacity-90 transition-opacity">
                    <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Recebimentos Próximos</p>
                      <p className="text-xs text-amber-500">{resumo.qtdAlertasReceber} parcela(s) em 7 dias</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-amber-400 shrink-0" />
                  </Link>
                )}
                {resumo.qtdAlertasPagar > 0 && (
                  <Link href="/contas-pagar" className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl hover:opacity-90 transition-opacity">
                    <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Pagamentos Próximos</p>
                      <p className="text-xs text-amber-500">{resumo.qtdAlertasPagar} parcela(s) em 7 dias</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-amber-400 shrink-0" />
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
