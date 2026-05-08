'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SummaryCards } from '@/components/dashboard/summary-cards'
import { ExpenseChart } from '@/components/dashboard/expense-chart'
import { RecentTransactions } from '@/components/dashboard/recent-transactions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CATEGORIES, getCategoryById } from '@/lib/categories'
import { getCurrentMonthRange, getLastMonthRange, getLast3MonthsRange, formatCurrency } from '@/lib/utils'
import type { Transaction, MonthlySummary, CategorySummary } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { AlertTriangle, TrendingUp, TrendingDown, Clock, Wallet, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const PERIOD_OPTIONS = [
  { value: 'current_month', label: 'Mês atual' },
  { value: 'last_month', label: 'Mês anterior' },
  { value: 'last_3_months', label: 'Últimos 3 meses' },
]

function getDateRange(period: string) {
  if (period === 'last_month') return getLastMonthRange()
  if (period === 'last_3_months') return getLast3MonthsRange()
  return getCurrentMonthRange()
}

function getPeriodLabel(period: string): string {
  const now = new Date()
  if (period === 'last_month') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
  }
  if (period === 'last_3_months') return 'Últimos 3 meses'
  return now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

interface FinanceiroResumo {
  totalReceberAberto: number
  totalReceberAtrasado: number
  totalPagarAberto: number
  totalPagarAtrasado: number
  saldoContas: number
  qtdAlertasReceber: number
  qtdAlertasPagar: number
}

interface FluxoMes {
  mes: string
  entradas: number
  saidas: number
}

interface ContaSaldo {
  id: string
  nome_apelido: string
  saldo_atual: number
  tipo_conta: string
}

export default function DashboardPage() {
  const [period, setPeriod] = useState('current_month')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [resumo, setResumo] = useState<FinanceiroResumo>({
    totalReceberAberto: 0,
    totalReceberAtrasado: 0,
    totalPagarAberto: 0,
    totalPagarAtrasado: 0,
    saldoContas: 0,
    qtdAlertasReceber: 0,
    qtdAlertasPagar: 0,
  })
  const [fluxoMeses, setFluxoMeses] = useState<FluxoMes[]>([])
  const [contasSaldo, setContasSaldo] = useState<ContaSaldo[]>([])
  const [loadingFinanceiro, setLoadingFinanceiro] = useState(true)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { start, end } = getDateRange(period)
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })
    setTransactions((data as Transaction[]) ?? [])
    setLoading(false)
  }, [period])

  const fetchFinanceiro = useCallback(async () => {
    if (!userId) return
    setLoadingFinanceiro(true)
    const supabase = createClient()
    const hoje = new Date().toISOString().split('T')[0]
    const em7dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const [
      parcelasReceber,
      parcelasPagar,
      contas,
      movs6meses,
    ] = await Promise.all([
      supabase
        .from('parcelas_receber')
        .select('valor, status, data_vencimento')
        .eq('user_id', userId)
        .in('status', ['aberto', 'atrasado']),
      supabase
        .from('parcelas_pagar')
        .select('valor, status, data_vencimento')
        .eq('user_id', userId)
        .in('status', ['aberto', 'atrasado']),
      supabase
        .from('contas_correntes')
        .select('id, nome_apelido, saldo_atual, tipo_conta')
        .eq('user_id', userId)
        .eq('ativo', true),
      supabase
        .from('movimentacoes_conta')
        .select('data_movimentacao, valor, tipo')
        .eq('user_id', userId)
        .gte('data_movimentacao', new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString().split('T')[0])
        .order('data_movimentacao'),
    ])

    const prAb = parcelasReceber.data?.filter(p => p.status === 'aberto') ?? []
    const prAt = parcelasReceber.data?.filter(p => p.status === 'atrasado') ?? []
    const ppAb = parcelasPagar.data?.filter(p => p.status === 'aberto') ?? []
    const ppAt = parcelasPagar.data?.filter(p => p.status === 'atrasado') ?? []

    const totalReceberAberto = prAb.reduce((s, p) => s + p.valor, 0)
    const totalReceberAtrasado = prAt.reduce((s, p) => s + p.valor, 0)
    const totalPagarAberto = ppAb.reduce((s, p) => s + p.valor, 0)
    const totalPagarAtrasado = ppAt.reduce((s, p) => s + p.valor, 0)

    const saldoContas = (contas.data ?? []).reduce((s, c) => s + c.saldo_atual, 0)

    // Alerts: vence em 7 dias
    const qtdAlertasReceber = prAb.filter(p => p.data_vencimento <= em7dias && p.data_vencimento >= hoje).length
    const qtdAlertasPagar = ppAb.filter(p => p.data_vencimento <= em7dias && p.data_vencimento >= hoje).length

    setResumo({
      totalReceberAberto, totalReceberAtrasado,
      totalPagarAberto, totalPagarAtrasado,
      saldoContas,
      qtdAlertasReceber, qtdAlertasPagar,
    })
    setContasSaldo((contas.data ?? []) as ContaSaldo[])

    // Fluxo dos últimos 6 meses
    const mesMap: Record<string, { entradas: number; saidas: number }> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      mesMap[key] = { entradas: 0, saidas: 0 }
    }
    for (const m of movs6meses.data ?? []) {
      const key = m.data_movimentacao.substring(0, 7)
      if (!mesMap[key]) continue
      if (m.tipo === 'credito' || m.tipo === 'transferencia_entrada') {
        mesMap[key].entradas += m.valor
      } else {
        mesMap[key].saidas += m.valor
      }
    }
    setFluxoMeses(
      Object.entries(mesMap).map(([key, v]) => ({
        mes: new Date(key + '-15').toLocaleString('pt-BR', { month: 'short' }),
        entradas: v.entradas,
        saidas: v.saidas,
      }))
    )

    setLoadingFinanceiro(false)
  }, [userId])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])
  useEffect(() => { fetchFinanceiro() }, [fetchFinanceiro])

  const summary: MonthlySummary = transactions.reduce(
    (acc, tx) => {
      if (tx.type === 'income') acc.totalIncome += tx.amount
      else acc.totalExpenses += tx.amount
      acc.balance = acc.totalIncome - acc.totalExpenses
      return acc
    },
    { totalIncome: 0, totalExpenses: 0, balance: 0 }
  )

  const categoryData: CategorySummary[] = Object.values(
    transactions
      .filter((tx) => tx.type === 'expense')
      .reduce<Record<string, CategorySummary>>((acc, tx) => {
        const cat = getCategoryById(tx.category)
        const name = cat?.name ?? tx.category
        const color = cat?.color ?? '#94a3b8'
        if (!acc[name]) acc[name] = { category: name, amount: 0, color, percentage: 0 }
        acc[name].amount += tx.amount
        return acc
      }, {})
  ).map((item) => ({
    ...item,
    percentage: summary.totalExpenses > 0 ? (item.amount / summary.totalExpenses) * 100 : 0,
  }))

  const periodLabel = getPeriodLabel(period)
  const totalAlertas = resumo.qtdAlertasReceber + resumo.qtdAlertasPagar + (resumo.totalReceberAtrasado > 0 ? 1 : 0) + (resumo.totalPagarAtrasado > 0 ? 1 : 0)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 capitalize">{periodLabel}</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SummaryCards summary={summary} loading={loading} />

      {/* KPIs Financeiros */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/contas-receber">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">A Receber</p>
                  {loadingFinanceiro ? (
                    <div className="h-6 w-24 bg-gray-100 rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-gray-900 mt-0.5">{formatCurrency(resumo.totalReceberAberto)}</p>
                  )}
                  {resumo.totalReceberAtrasado > 0 && (
                    <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {formatCurrency(resumo.totalReceberAtrasado)} atrasado
                    </p>
                  )}
                </div>
                <div className="p-2 bg-green-50 rounded-xl">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </div>
              {resumo.qtdAlertasReceber > 0 && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {resumo.qtdAlertasReceber} vence em 7 dias
                </p>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/contas-pagar">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-red-500">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">A Pagar</p>
                  {loadingFinanceiro ? (
                    <div className="h-6 w-24 bg-gray-100 rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-gray-900 mt-0.5">{formatCurrency(resumo.totalPagarAberto)}</p>
                  )}
                  {resumo.totalPagarAtrasado > 0 && (
                    <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {formatCurrency(resumo.totalPagarAtrasado)} atrasado
                    </p>
                  )}
                </div>
                <div className="p-2 bg-red-50 rounded-xl">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
              </div>
              {resumo.qtdAlertasPagar > 0 && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {resumo.qtdAlertasPagar} vence em 7 dias
                </p>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/contas-correntes">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Saldo em Contas</p>
                  {loadingFinanceiro ? (
                    <div className="h-6 w-24 bg-gray-100 rounded animate-pulse mt-1" />
                  ) : (
                    <p className={`text-xl font-bold mt-0.5 ${resumo.saldoContas >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                      {formatCurrency(resumo.saldoContas)}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{contasSaldo.length} conta(s) ativa(s)</p>
                </div>
                <div className="p-2 bg-blue-50 rounded-xl">
                  <Wallet className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className={`border-l-4 ${totalAlertas > 0 ? 'border-l-amber-500' : 'border-l-gray-200'}`}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Alertas</p>
                {loadingFinanceiro ? (
                  <div className="h-6 w-16 bg-gray-100 rounded animate-pulse mt-1" />
                ) : (
                  <p className={`text-xl font-bold mt-0.5 ${totalAlertas > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {totalAlertas}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">pendências</p>
              </div>
              <div className={`p-2 rounded-xl ${totalAlertas > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                <AlertTriangle className={`h-5 w-5 ${totalAlertas > 0 ? 'text-amber-500' : 'text-gray-300'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ExpenseChart data={categoryData} loading={loading} />
        <RecentTransactions transactions={transactions.slice(0, 8)} loading={loading} />
      </div>

      {/* Fluxo dos últimos 6 meses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fluxo de Caixa — Últimos 6 Meses</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingFinanceiro ? (
            <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={fluxoMeses} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} width={52} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
                <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Saldo por conta + alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Contas correntes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Saldo por Conta</CardTitle>
              <Link href="/contas-correntes" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Ver todas <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingFinanceiro ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : contasSaldo.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Nenhuma conta cadastrada</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {contasSaldo.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Wallet className="h-4 w-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{c.nome_apelido}</p>
                        <p className="text-xs text-gray-400 capitalize">{c.tipo_conta}</p>
                      </div>
                    </div>
                    <p className={`text-sm font-semibold ${c.saldo_atual >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                      {formatCurrency(c.saldo_atual)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alertas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alertas e Pendências
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingFinanceiro ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : totalAlertas === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400">Nenhum alerta no momento</p>
                <p className="text-xs text-gray-300 mt-1">Tudo em dia!</p>
              </div>
            ) : (
              <>
                {resumo.totalReceberAtrasado > 0 && (
                  <Link href="/contas-receber" className="flex items-start gap-3 p-3 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-700">Recebimentos Atrasados</p>
                      <p className="text-xs text-red-500">{formatCurrency(resumo.totalReceberAtrasado)} em atraso</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-red-400 flex-shrink-0" />
                  </Link>
                )}
                {resumo.totalPagarAtrasado > 0 && (
                  <Link href="/contas-pagar" className="flex items-start gap-3 p-3 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-700">Pagamentos Atrasados</p>
                      <p className="text-xs text-red-500">{formatCurrency(resumo.totalPagarAtrasado)} em atraso</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-red-400 flex-shrink-0" />
                  </Link>
                )}
                {resumo.qtdAlertasReceber > 0 && (
                  <Link href="/contas-receber" className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors">
                    <Clock className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-700">Recebimentos Próximos</p>
                      <p className="text-xs text-amber-500">{resumo.qtdAlertasReceber} parcela(s) vencem em 7 dias</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-amber-400 flex-shrink-0" />
                  </Link>
                )}
                {resumo.qtdAlertasPagar > 0 && (
                  <Link href="/contas-pagar" className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors">
                    <Clock className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-700">Pagamentos Próximos</p>
                      <p className="text-xs text-amber-500">{resumo.qtdAlertasPagar} parcela(s) vencem em 7 dias</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-amber-400 flex-shrink-0" />
                  </Link>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
