import { describe, expect, it } from 'vitest'
import { initialData } from '../lib/finance'
import { aggregatePayload, analyzeFinances, localInsights } from './engine'
import type { AppData, Transaction } from '../types'

const transaction = (
  id: string,
  amount: number,
  date: string,
  type: Transaction['type'] = 'expense',
  categoryId = 'food',
): Transaction => ({ id, amount, date, type, categoryId, note: 'Nomor rekening rahasia 123456789' })
const sample = (): AppData => ({
  ...initialData(),
  name: 'Nama pribadi rahasia',
  transactions: [
    transaction('income-raw-id', 2_000_000, '2026-10-01', 'income', 'allowance'),
    transaction('expense-raw-id', 100_000, '2026-10-01'),
    transaction('other', 50_000, '2026-10-10', 'expense', 'transport'),
    transaction('previous', 100_000, '2026-09-03'),
    transaction('last-year', 90_000, '2025-10-02'),
  ],
  budgets: {
    '2026-10': { total: 300_000, limits: { food: 120_000, transport: 50_000, education: 50_000 } },
  },
})

describe('financial analysis engine', () => {
  it('cache agregat bulan selesai tidak berubah hanya karena hari berganti atau catatan diedit', () => {
    const source = sample()
    const first = analyzeFinances(source, '2026-09', '2026-10-10')
    source.transactions[3].note = 'Catatan baru'
    const second = analyzeFinances(source, '2026-09', '2026-10-11')
    expect(aggregatePayload(first, localInsights(first), 'overview')).toEqual(
      aggregatePayload(second, localInsights(second), 'overview'),
    )
  })
  it('menghitung agregat, alokasi tanpa double counting, dan proyeksi berdasarkan hari berjalan', () => {
    const a = analyzeFinances(sample(), '2026-10', '2026-10-10')
    expect(a).toMatchObject({
      income: 2_000_000,
      expense: 150_000,
      net: 1_850_000,
      budgetPercent: 50,
      remaining: 150_000,
      previousExpense: 100_000,
      changePercent: 50,
      dailyAverage: 4839,
      elapsedDailyAverage: 15000,
      projectedExpense: 465_000,
      elapsedDays: 10,
    })
    expect(a.categories.map((c) => [c.categoryId, c.spent, c.remaining])).toEqual([
      ['food', 100000, 20000],
      ['transport', 50000, 0],
      ['education', 0, 50000],
    ])
    expect(localInsights(a).findings.some((f) => f.id === 'projection-risk')).toBe(true)
  })
  it('tidak memproyeksikan bulan mendatang dan membedakan bulan selesai, tahun kabisat, dan pembanding nol', () => {
    expect(analyzeFinances(sample(), '2026-11', '2026-10-10')).toMatchObject({
      period: 'future',
      projectedExpense: null,
      elapsedDailyAverage: null,
    })
    expect(analyzeFinances(sample(), '2026-09', '2026-10-10')).toMatchObject({
      period: 'past',
      projectedExpense: 100000,
      elapsedDays: 30,
    })
    expect(analyzeFinances(sample(), '2024-02', '2026-10-10')).toMatchObject({
      daysInMonth: 29,
      changePercent: null,
    })
  })
  it('memisahkan transaksi mendatang dari laju harian dan mempertahankannya sebagai batas bawah proyeksi', () => {
    const data = sample()
    data.transactions.push(transaction('scheduled', 1_000_000, '2026-10-25'))
    expect(analyzeFinances(data, '2026-10', '2026-10-10')).toMatchObject({
      expense: 1150000,
      elapsedDailyAverage: 15000,
      projectedExpense: 1150000,
    })
  })
  it('anggaran nol adalah belum diatur, pengeluaran nol tidak membagi nol, dan data sedikit diberi konteks', () => {
    const a = analyzeFinances(initialData(), '2026-10', '2026-10-01')
    expect(a).toMatchObject({
      income: 0,
      expense: 0,
      budget: null,
      budgetPercent: null,
      remaining: null,
      projectedExpense: 0,
      savings: null,
    })
    const report = localInsights(a)
    expect(report.findings.map((f) => f.id)).toContain('limited')
    expect(report.findings.map((f) => f.id)).toContain('no-budget')
    expect(report.summary).toContain('Belum ada transaksi')
  })
  it('mendukung target jika diberikan, tanpa menganggap selisih pendapatan sudah ditabung', () => {
    const a = analyzeFinances(sample(), '2026-10', '2026-10-10', { target: 1000000, saved: 250000 })
    expect(a.savings).toEqual({ target: 1000000, saved: 250000, remaining: 750000, percent: 25 })
    expect(
      analyzeFinances(sample(), '2026-10', '2026-10-10', { target: 0, saved: 0 }).savings,
    ).toBeNull()
  })
  it('tidak mengubah data serta aman dari intermediate floating point dan overflow', () => {
    const data = sample(),
      before = JSON.stringify(data)
    const a = analyzeFinances(data, '2026-10', '2026-10-10')
    localInsights(a)
    aggregatePayload(a, localInsights(a), 'overview')
    expect(JSON.stringify(data)).toBe(before)
    data.transactions = [transaction('big', Number.MAX_SAFE_INTEGER, '2026-10-01')]
    expect(() => analyzeFinances(data, '2026-10', '2026-10-01')).toThrow('terlalu besar')
  })
  it('payload hanya agregat; nama, ID transaksi, kategori kustom, UID, dan catatan tidak dikirim', () => {
    const data = sample()
    data.categories.find((c) => c.id === 'food')!.name = 'Nama dokter pribadi'
    const a = analyzeFinances(data, '2026-10', '2026-10-10')
    const payload = JSON.stringify(aggregatePayload(a, localInsights(a), 'categories'))
    for (const secret of [
      'Nama pribadi',
      'dokter',
      'rahasia',
      '123456789',
      'income-raw-id',
      'expense-raw-id',
      'categoryId',
      'transactions',
      'note',
    ])
      expect(payload).not.toContain(secret)
    expect(payload).toContain('Kategori 1')
    expect(JSON.parse(payload).expense).toBe(150000)
  })
})
