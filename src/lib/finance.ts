import type { AppData, Budget, Transaction } from '../types'

export const MAX_AMOUNT = 1_000_000_000_000
export const money = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)
export const compact = (n: number) =>
  new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const currentMonth = () => localDate().slice(0, 7)
export const monthLabel = (month: string, short = false) =>
  new Intl.DateTimeFormat('id-ID', { month: short ? 'short' : 'long', year: 'numeric' }).format(
    new Date(`${month}-01T12:00:00`),
  )
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${date}T12:00:00`),
  )
export const shiftMonth = (month: string, offset: number) => {
  const d = new Date(`${month}-01T12:00:00`)
  d.setMonth(d.getMonth() + offset)
  return localDate(d).slice(0, 7)
}
export const endOfMonth = (month: string) => {
  const d = new Date(`${month}-01T12:00:00`)
  d.setMonth(d.getMonth() + 1, 0)
  return localDate(d)
}
export const cutoffFor = (month: string) =>
  month === currentMonth() ? localDate() : endOfMonth(month)
export const monthTransactions = (tx: Transaction[], month: string) =>
  tx.filter((t) => t.date.slice(0, 7) === month)
export const sumType = (tx: Transaction[], type: Transaction['type']) =>
  tx.filter((t) => t.type === type).reduce((sum, t) => sum + t.amount, 0)
export const balanceAt = (tx: Transaction[], date: string) =>
  tx
    .filter((t) => t.date <= date)
    .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0)
export const categorySpent = (tx: Transaction[], categoryId: string) =>
  tx
    .filter((t) => t.type === 'expense' && t.categoryId === categoryId)
    .reduce((sum, t) => sum + t.amount, 0)
export const budgetStatus = (spent: number, limit: number) => ({
  remaining: limit - spent,
  percent: limit > 0 ? (spent / limit) * 100 : 0,
  status: spent > limit ? 'over' : limit > 0 && spent / limit >= 0.8 ? 'near' : 'safe',
})
export const sortedTransactions = (tx: Transaction[]) =>
  tx
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.date.localeCompare(a.item.date) || b.index - a.index)
    .map(({ item }) => item)
export const upsertTransaction = (tx: Transaction[], item: Transaction) =>
  tx.some((t) => t.id === item.id) ? tx.map((t) => (t.id === item.id ? item : t)) : [...tx, item]
export const emptyBudget = (): Budget => ({ total: 0, limits: {} })
export const initialData = (): AppData => ({
  version: 1,
  transactions: [],
  budgets: {},
  name: '',
  theme: 'light',
  categories: [
    { id: 'allowance', name: 'Uang Saku', type: 'income', icon: 'wallet', color: '#25876b' },
    { id: 'salary', name: 'Gaji / Freelance', type: 'income', icon: 'briefcase', color: '#4a85b0' },
    { id: 'gift', name: 'Hadiah', type: 'income', icon: 'gift', color: '#bd7999' },
    { id: 'other-income', name: 'Lainnya', type: 'income', icon: 'plus', color: '#8b82be' },
    { id: 'food', name: 'Makanan & Minuman', type: 'expense', icon: 'food', color: '#e2a24e' },
    { id: 'transport', name: 'Transportasi', type: 'expense', icon: 'car', color: '#5b9dc4' },
    { id: 'shopping', name: 'Belanja', type: 'expense', icon: 'shopping', color: '#ad87c4' },
    { id: 'education', name: 'Pendidikan', type: 'expense', icon: 'book', color: '#5f9c81' },
    { id: 'entertainment', name: 'Hiburan', type: 'expense', icon: 'game', color: '#df8d9b' },
    { id: 'bills', name: 'Tagihan', type: 'expense', icon: 'receipt', color: '#768bbd' },
    { id: 'health', name: 'Kesehatan', type: 'expense', icon: 'heart', color: '#db7f6a' },
    { id: 'other-expense', name: 'Lainnya', type: 'expense', icon: 'grid', color: '#929c9b' },
  ],
})
