'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { TransactionList } from '@/components/transactions/transaction-list'
import { TransactionFilters } from '@/components/transactions/transaction-filters'
import { getCurrentMonthRange, getLastMonthRange, getLast3MonthsRange } from '@/lib/utils'
import { Plus } from 'lucide-react'
import type { Transaction } from '@/types'

interface Filters {
  period: string
  type: string
  category: string
  search: string
}

function getDateRange(period: string) {
  if (period === 'last_month') return getLastMonthRange()
  if (period === 'last_3_months') return getLast3MonthsRange()
  if (period === 'all') return null
  return getCurrentMonthRange()
}

export default function TransactionsPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Transaction | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>({
    period: 'current_month',
    type: 'all',
    category: 'all',
    search: '',
  })

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('transactions').select('*').order('date', { ascending: false })

    const range = getDateRange(filters.period)
    if (range) {
      query = query.gte('date', range.start).lte('date', range.end)
    }
    if (filters.type !== 'all') {
      query = query.eq('type', filters.type)
    }
    if (filters.category !== 'all') {
      query = query.eq('category', filters.category)
    }

    const { data } = await query
    setTransactions((data as Transaction[]) ?? [])
    setLoading(false)
  }, [filters.period, filters.type, filters.category])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const displayed = filters.search
    ? transactions.filter((tx) =>
        tx.description.toLowerCase().includes(filters.search.toLowerCase())
      )
    : transactions

  function handleEdit(tx: Transaction) {
    setEditTarget(tx)
    setFormOpen(true)
  }

  function handleCloseForm() {
    setFormOpen(false)
    setEditTarget(null)
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transações</h1>
          <p className="text-sm text-gray-500">
            {loading ? '...' : `${displayed.length} transação${displayed.length !== 1 ? 'ões' : ''} encontrada${displayed.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={() => { setEditTarget(null); setFormOpen(true) }} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nova transação</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      <TransactionFilters filters={filters} onChange={setFilters} />

      <TransactionList
        transactions={displayed}
        loading={loading}
        onEdit={handleEdit}
        onDeleted={fetchTransactions}
      />

      <TransactionForm
        open={formOpen}
        onClose={handleCloseForm}
        onSuccess={fetchTransactions}
        transaction={editTarget}
      />
    </div>
  )
}
