import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getCategoryById } from '@/lib/categories'
import type { Transaction } from '@/types'

interface RecentTransactionsProps {
  transactions: Transaction[]
  loading?: boolean
}

export function RecentTransactions({ transactions, loading }: RecentTransactionsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Transações Recentes</CardTitle>
        <Link
          href="/transactions"
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          Ver todas <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-9 w-9 rounded-full bg-gray-100" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 bg-gray-100 rounded" />
                  <div className="h-3 w-20 bg-gray-100 rounded" />
                </div>
                <div className="h-4 w-16 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm text-gray-500">Nenhuma transação ainda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => {
              const cat = getCategoryById(tx.category)
              return (
                <div key={tx.id} className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-base flex-shrink-0">
                    {cat?.icon ?? '💸'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{tx.description}</p>
                    <p className="text-xs text-gray-400">
                      {cat?.name ?? tx.category} · {formatDate(tx.date)}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold flex-shrink-0 ${
                      tx.type === 'income' ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
