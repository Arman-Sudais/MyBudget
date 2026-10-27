import type { AppData } from '../types'
import { MAX_AMOUNT, sortedTransactions } from './finance'

const object = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)
const text = (x: unknown, max: number): x is string => typeof x === 'string' && x.length <= max
const amount = (x: unknown): x is number =>
  typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= MAX_AMOUNT
export const validDate = (x: unknown): x is string => {
  if (
    typeof x !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(x) ||
    x < '1900-01-01' ||
    x > '2100-12-31'
  )
    return false
  const date = new Date(`${x}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === x
}
const validMonth = (x: string) =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(x) && x >= '1900-01' && x <= '2100-12'
export function parseBackup(raw: string): AppData {
  if (raw.length > 10_000_000) throw new Error('File terlalu besar (maksimal 10 MB).')
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('File JSON tidak valid.')
  }
  const fail = () => {
    throw new Error(
      'Format backup tidak sesuai atau berisi data yang tidak valid. Data saat ini tetap aman.',
    )
  }
  if (
    !object(data) ||
    data.version !== 1 ||
    !text(data.name, 60) ||
    !['light', 'dark'].includes(String(data.theme)) ||
    !Array.isArray(data.categories) ||
    !Array.isArray(data.transactions) ||
    !object(data.budgets)
  )
    return fail()
  if (
    data.categories.length > 200 ||
    data.transactions.length > 5000 ||
    Object.keys(data.budgets).length > 1200
  )
    return fail()
  const ids = new Map<string, string>()
  for (const c of data.categories) {
    if (
      !object(c) ||
      !text(c.id, 100) ||
      !c.id ||
      ids.has(c.id) ||
      !text(c.name, 50) ||
      !c.name.trim() ||
      !['income', 'expense'].includes(String(c.type)) ||
      !text(c.icon, 30) ||
      !text(c.color, 7) ||
      !/^#[0-9a-f]{6}$/i.test(c.color)
    )
      return fail()
    ids.set(c.id, String(c.type))
  }
  const txIds = new Set<string>()
  for (const t of data.transactions) {
    if (
      !object(t) ||
      !text(t.id, 100) ||
      !t.id ||
      txIds.has(t.id) ||
      !['income', 'expense'].includes(String(t.type)) ||
      !amount(t.amount) ||
      t.amount === 0 ||
      !text(t.categoryId, 100) ||
      ids.get(t.categoryId) !== t.type ||
      !validDate(t.date) ||
      !text(t.note, 200)
    )
      return fail()
    txIds.add(t.id)
  }
  for (const [month, b] of Object.entries(data.budgets)) {
    if (!validMonth(month) || !object(b) || !amount(b.total) || !object(b.limits)) return fail()
    let total = 0
    for (const [id, limit] of Object.entries(b.limits)) {
      if (ids.get(id) !== 'expense' || !amount(limit)) return fail()
      total += limit
    }
    if (total > b.total) return fail()
  }
  return data as unknown as AppData
}
export function downloadFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function transactionsCsv(data: AppData) {
  const cell = (value: string | number) =>
    `"${String(value)
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""')}"`
  const rows = [
    ['Tanggal', 'Jenis', 'Kategori', 'Nominal (IDR)', 'Catatan'],
    ...sortedTransactions(data.transactions).map((t) => [
      t.date,
      t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      data.categories.find((c) => c.id === t.categoryId)?.name ?? '',
      t.amount,
      t.note,
    ]),
  ]
  return '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n')
}
