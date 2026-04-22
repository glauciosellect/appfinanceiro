import { Category } from '@/types'

export const CATEGORIES: Category[] = [
  { id: 'salary', name: 'Salário', color: '#22c55e', icon: '💼', type: 'income' },
  { id: 'freelance', name: 'Freelance', color: '#16a34a', icon: '💻', type: 'income' },
  { id: 'investment', name: 'Investimentos', color: '#15803d', icon: '📈', type: 'income' },
  { id: 'other_income', name: 'Outras Receitas', color: '#4ade80', icon: '💰', type: 'income' },
  { id: 'food', name: 'Alimentação', color: '#f97316', icon: '🍔', type: 'expense' },
  { id: 'transport', name: 'Transporte', color: '#3b82f6', icon: '🚗', type: 'expense' },
  { id: 'health', name: 'Saúde', color: '#ec4899', icon: '🏥', type: 'expense' },
  { id: 'education', name: 'Educação', color: '#8b5cf6', icon: '📚', type: 'expense' },
  { id: 'entertainment', name: 'Lazer', color: '#f59e0b', icon: '🎬', type: 'expense' },
  { id: 'housing', name: 'Moradia', color: '#6366f1', icon: '🏠', type: 'expense' },
  { id: 'clothing', name: 'Vestuário', color: '#d946ef', icon: '👕', type: 'expense' },
  { id: 'shopping', name: 'Compras', color: '#0ea5e9', icon: '🛍️', type: 'expense' },
  { id: 'bills', name: 'Contas', color: '#64748b', icon: '📄', type: 'expense' },
  { id: 'other_expense', name: 'Outras Despesas', color: '#94a3b8', icon: '💸', type: 'expense' },
]

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id)
}

export function getCategoriesByType(type: 'income' | 'expense'): Category[] {
  return CATEGORIES.filter((c) => c.type === type)
}
