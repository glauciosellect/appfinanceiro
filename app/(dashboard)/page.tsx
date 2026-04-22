'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SummaryCards } from '@/components/dashboard/summary-cards'
import { ExpenseChart } from '@/components/dashboard/expense-chart'
import { RecentTransactions } from '@/components/dashboard/recent-transactions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CATEGORIES, getCategoryById } from '@/lib/categories'
import { getCurrentMonthRange, getLastMonthRange, getLast3MonthsRange } from '@/lib/utils'
import type { Transaction, MonthlySummary, CategorySummary } from '@/types'

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

export default function DashboardPage() {
  const [period, setPeriod] = useState('current_month')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ExpenseChart data={categoryData} loading={loading} />
        <RecentTransactions transactions={transactions.slice(0, 8)} loading={loading} />
      </div>
    </div>
  )
}
