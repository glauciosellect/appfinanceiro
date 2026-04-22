export type TransactionType = 'income' | 'expense'

export interface Category {
  id: string
  name: string
  color: string
  icon: string
  type: TransactionType
}

export interface Transaction {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  description: string
  category: string
  date: string
  created_at: string
}

export interface TransactionFilters {
  period: 'current_month' | 'last_month' | 'last_3_months' | 'custom'
  category: string
  type: TransactionType | 'all'
  startDate?: string
  endDate?: string
}

export interface MonthlySummary {
  totalIncome: number
  totalExpenses: number
  balance: number
}

export interface CategorySummary {
  category: string
  amount: number
  color: string
  percentage: number
}
