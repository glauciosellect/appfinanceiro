'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getCategoryById } from '@/lib/categories'
import { Pencil, Trash2, Loader2 } from 'lucide-react'
import type { Transaction } from '@/types'

interface TransactionListProps {
  transactions: Transaction[]
  loading: boolean
  onEdit: (tx: Transaction) => void
  onDeleted: () => void
}

export function TransactionList({ transactions, loading, onEdit, onDeleted }: TransactionListProps) {
  const { toast } = useToast()
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('transactions').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    if (error) {
      toast('Erro ao excluir transação.', 'error')
    } else {
      toast('Transação excluída.', 'success')
      onDeleted()
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3 animate-pulse">
              <div className="h-10 w-10 rounded-full bg-gray-100 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-40 bg-gray-100 rounded" />
                <div className="h-3 w-24 bg-gray-100 rounded" />
              </div>
              <div className="h-4 w-20 bg-gray-100 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium text-gray-700">Nenhuma transação encontrada</p>
          <p className="text-sm text-gray-400 mt-1">Adicione uma transação ou altere os filtros</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {transactions.map((tx) => {
          const cat = getCategoryById(tx.category)
          return (
            <Card key={tx.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-lg flex-shrink-0">
                  {cat?.icon ?? '💸'}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{tx.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{formatDate(tx.date)}</span>
                    <Badge variant={tx.type === 'income' ? 'income' : 'expense'} className="text-[10px] px-1.5 py-0">
                      {cat?.name ?? tx.category}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span
                    className={`font-bold text-sm ${
                      tx.type === 'income' ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-gray-400 hover:text-blue-600"
                      onClick={() => onEdit(tx)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-gray-400 hover:text-red-500"
                      onClick={() => setDeleteTarget(tx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir transação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir{' '}
              <strong>{deleteTarget?.description}</strong>? Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
