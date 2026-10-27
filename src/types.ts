export type TransactionType = 'income' | 'expense'
export interface Category {
  id: string
  name: string
  type: TransactionType
  icon: string
  color: string
}
export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  categoryId: string
  date: string
  note: string
}
export interface Budget {
  total: number
  limits: Record<string, number>
}
export interface AppData {
  version: 1
  transactions: Transaction[]
  categories: Category[]
  budgets: Record<string, Budget>
  name: string
  theme: 'light' | 'dark'
}
export type Page = 'dashboard' | 'transactions' | 'budgets' | 'analytics' | 'settings'
