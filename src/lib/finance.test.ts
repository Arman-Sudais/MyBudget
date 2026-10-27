import { describe, expect, it } from 'vitest'
import {
  balanceAt,
  budgetStatus,
  categorySpent,
  endOfMonth,
  initialData,
  localDate,
  monthTransactions,
  shiftMonth,
  sortedTransactions,
  sumType,
  upsertTransaction,
} from './finance'
import { parseBackup, transactionsCsv, validDate } from './data'
import type { Transaction } from '../types'

const tx: Transaction[] = [
  {
    id: '1',
    type: 'income',
    amount: 2_000_000,
    categoryId: 'allowance',
    date: '2025-12-30',
    note: 'Uang saku',
  },
  {
    id: '2',
    type: 'expense',
    amount: 100_000,
    categoryId: 'food',
    date: '2026-01-01',
    note: 'Makan',
  },
  {
    id: '3',
    type: 'expense',
    amount: 50_000,
    categoryId: 'transport',
    date: '2026-01-03',
    note: 'Bus',
  },
  {
    id: '4',
    type: 'income',
    amount: 500_000,
    categoryId: 'gift',
    date: '2026-01-05',
    note: 'Hadiah',
  },
  {
    id: '5',
    type: 'expense',
    amount: 75_000,
    categoryId: 'food',
    date: '2026-02-01',
    note: 'Makan Februari',
  },
  {
    id: '6',
    type: 'expense',
    amount: 25_000,
    categoryId: 'food',
    date: '2025-01-01',
    note: 'Makan tahun lalu',
  },
]
describe('keuangan dalam Rupiah bulat', () => {
  it('mengakumulasi saldo lintas bulan/tahun sampai tanggal terpilih, termasuk hari itu', () => {
    expect(balanceAt(tx, '2026-01-03')).toBe(1_825_000)
    expect(balanceAt(tx, '2026-01-05')).toBe(2_325_000)
  })
  it('memfilter bulan beserta tahunnya tanpa timezone UTC', () => {
    const jan = monthTransactions(tx, '2026-01')
    expect(jan.map((t) => t.id)).toEqual(['2', '3', '4'])
    expect(sumType(jan, 'expense')).toBe(150_000)
  })
  it('mengedit transaksi tanpa duplikasi dan menghitung ulang jenis, tanggal, serta kategori', () => {
    const edited = upsertTransaction(tx, {
      ...tx[1],
      type: 'income',
      categoryId: 'gift',
      amount: 200_000,
      date: '2026-02-02',
    })
    expect(edited).toHaveLength(tx.length)
    expect(sumType(monthTransactions(edited, '2026-01'), 'expense')).toBe(50_000)
    expect(categorySpent(monthTransactions(edited, '2026-02'), 'food')).toBe(75_000)
    expect(balanceAt(edited, '2026-02-02')).toBe(2_550_000)
  })
  it('menambah dan menghapus transaksi memperbarui saldo dan pengeluaran', () => {
    const added = upsertTransaction(tx, { ...tx[1], id: '7', amount: 10_000 })
    expect(added).toHaveLength(7)
    expect(balanceAt(added, '2026-01-03')).toBe(1_815_000)
    expect(
      categorySpent(
        monthTransactions(
          added.filter((t) => t.id !== '2'),
          '2026-01',
        ),
        'food',
      ),
    ).toBe(10_000)
  })
  it('anggaran adalah batas, tidak mengurangi saldo atau menghitung ganda', () => {
    const jan = monthTransactions(tx, '2026-01'),
      budget = { total: 200_000, limits: { food: 120_000 } }
    expect(categorySpent(jan, 'food')).toBe(100_000)
    expect(budgetStatus(sumType(jan, 'expense'), budget.total).remaining).toBe(50_000)
    expect(balanceAt(tx, '2026-01-05')).toBe(2_325_000)
  })
  it('membedakan kondisi aman, mendekati, melebihi, dan belum dialokasikan', () => {
    expect(budgetStatus(80, 100).status).toBe('near')
    expect(budgetStatus(101, 100)).toMatchObject({ remaining: -1, status: 'over' })
    expect(budgetStatus(0, 0)).toMatchObject({ percent: 0, status: 'safe' })
    expect(budgetStatus(1, 0).status).toBe('over')
  })
  it('mengurutkan transaksi terbaru lebih dahulu tanpa mengubah sumber', () => {
    expect(sortedTransactions(tx)[0].id).toBe('5')
    expect(tx[0].id).toBe('1')
  })
  it('urutan transaksi di tanggal yang sama mengikuti waktu penambahan, bukan UUID', () => {
    const sameDay = [
      { ...tx[0], id: 'zzz' },
      { ...tx[0], id: 'aaa' },
    ]
    expect(sortedTransactions(sameDay).map((t) => t.id)).toEqual(['aaa', 'zzz'])
  })
  it('menangani perpindahan tahun, tahun kabisat, dan tanggal lokal', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(endOfMonth('2024-02')).toBe('2024-02-29')
    expect(localDate(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01')
  })
})
describe('backup dan ekspor data', () => {
  it('data awal kosong tanpa transaksi dummy', () => expect(initialData().transactions).toEqual([]))
  it('backup valid dapat dipulihkan utuh', () => {
    const data = {
      ...initialData(),
      transactions: tx,
      budgets: { '2026-01': { total: 200_000, limits: { food: 120_000 } } },
    }
    expect(parseBackup(JSON.stringify(data))).toEqual(data)
  })
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER])('menolak nominal tidak valid: %s', (amount) => {
    expect(() =>
      parseBackup(JSON.stringify({ ...initialData(), transactions: [{ ...tx[0], amount }] })),
    ).toThrow()
  })
  it('menolak tanggal bergeser, kategori salah jenis, ID ganda, dan alokasi berlebih', () => {
    for (const transactions of [
      [{ ...tx[0], date: '2026-02-30' }],
      [{ ...tx[0], categoryId: 'food' }],
      [tx[0], tx[0]],
    ])
      expect(() => parseBackup(JSON.stringify({ ...initialData(), transactions }))).toThrow()
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...initialData(),
          budgets: { '2026-01': { total: 100, limits: { food: 101 } } },
        }),
      ),
    ).toThrow()
  })
  it('memvalidasi tanggal kalender tanpa melempar error pada tanggal rusak', () => {
    expect(validDate('2026-99-99')).toBe(false)
    expect(validDate('2026-02-29')).toBe(false)
    expect(validDate('2024-02-29')).toBe(true)
  })
  it('menolak versi backup yang belum didukung', () =>
    expect(() => parseBackup(JSON.stringify({ ...initialData(), version: 2 }))).toThrow())
  it('CSV mengutip baris baru, tanda kutip, koma, dan menetralkan formula spreadsheet', () => {
    const csv = transactionsCsv({
      ...initialData(),
      transactions: [{ ...tx[0], note: '=SUM(1,2)\n"uji"' }],
    })
    expect(csv).toContain('"\'=SUM(1,2)\n""uji"""')
    expect(csv).toContain('"2000000"')
  })
})
