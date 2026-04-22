import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { MonthlySummary } from '@/types'

interface SummaryCardsProps {
  summary: MonthlySummary
  loading?: boolean
}

export function SummaryCards({ summary, loading }: SummaryCardsProps) {
  const cards = [
    {
      label: 'Receitas',
      value: summary.totalIncome,
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-100',
    },
    {
      label: 'Despesas',
      value: summary.totalExpenses,
      icon: TrendingDown,
      color: 'text-red-500',
      bg: 'bg-red-50',
      border: 'border-red-100',
    },
    {
      label: 'Saldo',
      value: summary.balance,
      icon: Wallet,
      color: summary.balance >= 0 ? 'text-blue-600' : 'text-red-500',
      bg: summary.balance >= 0 ? 'bg-blue-50' : 'bg-red-50',
      border: summary.balance >= 0 ? 'border-blue-100' : 'border-red-100',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className={`border ${card.border}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">{card.label}</span>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            {loading ? (
              <div className="h-8 w-32 bg-gray-100 animate-pulse rounded" />
            ) : (
              <p className={`text-2xl font-bold ${card.color}`}>
                {formatCurrency(card.value)}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
