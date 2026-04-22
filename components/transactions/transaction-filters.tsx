'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { CATEGORIES } from '@/lib/categories'

interface TransactionFiltersState {
  period: string
  type: string
  category: string
  search: string
}

interface TransactionFiltersProps {
  filters: TransactionFiltersState
  onChange: (filters: TransactionFiltersState) => void
}

const PERIOD_OPTIONS = [
  { value: 'current_month', label: 'Mês atual' },
  { value: 'last_month', label: 'Mês anterior' },
  { value: 'last_3_months', label: 'Últimos 3 meses' },
  { value: 'all', label: 'Todo período' },
]

const TYPE_OPTIONS = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'income', label: 'Receitas' },
  { value: 'expense', label: 'Despesas' },
]

export function TransactionFilters({ filters, onChange }: TransactionFiltersProps) {
  function update(key: keyof TransactionFiltersState, value: string) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Input
        placeholder="Buscar descrição..."
        value={filters.search}
        onChange={(e) => update('search', e.target.value)}
        className="w-full sm:w-52"
      />

      <Select value={filters.period} onValueChange={(v) => update('period', v)}>
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.type} onValueChange={(v) => update('type', v)}>
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.category} onValueChange={(v) => update('category', v)}>
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as categorias</SelectItem>
          {CATEGORIES.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.icon} {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
