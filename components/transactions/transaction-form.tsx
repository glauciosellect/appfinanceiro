'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { getCategoriesByType } from '@/lib/categories'
import { Loader2 } from 'lucide-react'
import type { Transaction, ContaCorrente } from '@/types'

interface TransactionFormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  transaction?: Transaction | null
}

export function TransactionForm({ open, onClose, onSuccess, transaction }: TransactionFormProps) {
  const { toast } = useToast()
  const isEditing = !!transaction

  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [contaCorrenteId, setContaCorrenteId] = useState<string>('none')
  const [contas, setContas] = useState<ContaCorrente[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    createClient().auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: contasData } = await createClient()
        .from('contas_correntes')
        .select('id,nome_apelido,saldo_atual,tipo_conta')
        .eq('user_id', data.user.id)
        .eq('ativo', true)
        .order('nome_apelido')
      setContas((contasData ?? []) as ContaCorrente[])
    })
  }, [open])

  useEffect(() => {
    if (transaction) {
      setType(transaction.type)
      setAmount(transaction.amount.toString())
      setDescription(transaction.description)
      setCategory(transaction.category)
      setDate(transaction.date)
      setContaCorrenteId(transaction.conta_corrente_id ?? 'none')
    } else {
      setType('expense')
      setAmount('')
      setDescription('')
      setCategory('')
      setDate(new Date().toISOString().split('T')[0])
      setContaCorrenteId('none')
    }
  }, [transaction, open])

  const filteredCategories = getCategoriesByType(type)

  function handleTypeChange(newType: 'income' | 'expense') {
    setType(newType)
    setCategory('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!category) {
      toast('Selecione uma categoria.', 'error')
      return
    }

    const parsedAmount = parseFloat(amount.replace(',', '.'))
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast('Informe um valor válido.', 'error')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const contaId = contaCorrenteId !== 'none' ? contaCorrenteId : null

    const payload = { type, amount: parsedAmount, description, category, date, conta_corrente_id: contaId }

    let error
    if (isEditing) {
      const res = await supabase.from('transactions').update(payload).eq('id', transaction!.id)
      error = res.error
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); toast('Usuário não encontrado.', 'error'); return }
      const res = await supabase.from('transactions').insert({ ...payload, user_id: user.id })
      error = res.error

      // Criar movimentação na conta corrente selecionada
      if (!error && contaId) {
        const conta = contas.find(c => c.id === contaId)
        if (conta) {
          const isCredito = type === 'income'
          const novoSaldo = conta.saldo_atual + (isCredito ? parsedAmount : -parsedAmount)
          await supabase.from('movimentacoes_conta').insert({
            user_id: user.id,
            conta_corrente_id: contaId,
            tipo: isCredito ? 'credito' : 'debito',
            valor: parsedAmount,
            saldo_anterior: conta.saldo_atual,
            saldo_posterior: novoSaldo,
            descricao: description,
            data_movimentacao: date,
          })
          await supabase.from('contas_correntes').update({ saldo_atual: novoSaldo }).eq('id', contaId)
        }
      }
    }

    setLoading(false)

    if (error) {
      toast('Erro ao salvar transação. Tente novamente.', 'error')
    } else {
      toast(isEditing ? 'Transação atualizada!' : 'Transação adicionada!', 'success')
      onSuccess()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar transação' : 'Nova transação'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeChange(t)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  type === t
                    ? t === 'expense'
                      ? 'bg-white text-red-600 shadow-sm'
                      : 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'expense' ? '💸 Despesa' : '💰 Receita'}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex: Supermercado, Salário..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>{type === 'expense' ? 'Despesas' : 'Receitas'}</SelectLabel>
                  {filteredCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Conta Corrente */}
          <div className="space-y-2">
            <Label>Conta Corrente</Label>
            <Select value={contaCorrenteId} onValueChange={setContaCorrenteId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conta (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma conta</SelectItem>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome_apelido}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={type === 'income' ? 'success' : 'default'}
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Salvando...' : isEditing ? 'Atualizar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
