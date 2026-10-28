import { describe, expect, it } from 'vitest'
import { initialData } from '../lib/finance'
import {
  applyDocument,
  emptyRecords,
  mergeBudgetEdit,
  mergeData,
  migrationConflicts,
  overlay,
  planChanges,
  recordsToData,
} from './model'
import type { Mutation } from './model'
import { CloudStorage } from './storage'

const item = {
  id: 'tx-1',
  type: 'expense' as const,
  amount: 25000,
  categoryId: 'food',
  date: '2026-10-27',
  note: 'Kantin',
}
const local = {
  ...initialData(),
  transactions: [item],
  budgets: { '2026-10': { total: 100000, limits: { food: 75000 } } },
}
describe('migrasi, merge, dan konflik', () => {
  it('deduplikasi berdasarkan ID dengan prioritas yang dipilih secara eksplisit', () => {
    const cloud = {
      ...local,
      transactions: [
        { ...item, amount: 30000 },
        { ...item, id: 'tx-2' },
      ],
    }
    expect(mergeData(local, cloud, 'cloud').transactions).toHaveLength(2)
    expect(
      mergeData(local, cloud, 'cloud').transactions.find((t) => t.id === item.id)?.amount,
    ).toBe(30000)
    expect(
      mergeData(local, cloud, 'local').transactions.find((t) => t.id === item.id)?.amount,
    ).toBe(25000)
    expect(migrationConflicts(local, cloud).transactions).toBe(1)
    expect(local.transactions[0].amount).toBe(25000)
  })
  it('mengirim hanya field yang diubah, bukan seluruh data aplikasi', () => {
    const after = { ...local, transactions: [{ ...item, amount: 40000 }] }
    const ops = planChanges(local, after)
    expect(ops).toHaveLength(1)
    expect(ops[0].patch).toEqual({ amount: 40000 })
  })
  it('perubahan field berbeda di dokumen yang sama dapat digabungkan', () => {
    const remote = { ...item, note: 'Catatan dari Android' }
    const op = planChanges(local, { ...local, transactions: [{ ...item, amount: 40000 }] })[0]
    expect(applyDocument(remote, op)).toMatchObject({ note: 'Catatan dari Android', amount: 40000 })
  })
  it('penghapusan mengalahkan edit lama; restore perlu persetujuan', () => {
    const op = planChanges(local, { ...local, transactions: [{ ...item, amount: 40000 }] })[0]
    expect(() => applyDocument({ ...item, deleted: true }, op)).toThrow('sudah dihapus')
    expect(applyDocument({ ...item, deleted: true }, { ...op, revive: true })).toMatchObject({
      deleted: false,
      amount: 40000,
    })
  })
  it('alokasi anggaran tetap konsisten saat dipindah dan total diturunkan', () => {
    const before = {
      ...local,
      budgets: { '2026-10': { total: 100000, limits: { food: 75000, transport: 25000 } } },
    }
    const after = {
      ...before,
      budgets: { '2026-10': { total: 80000, limits: { food: 30000, transport: 50000 } } },
    }
    const ops = planChanges(before, after)
    let doc = { ...before.budgets['2026-10'], allocated: 100000 }
    for (const op of ops) doc = applyDocument(doc, op) as typeof doc
    expect(doc).toMatchObject({
      total: 80000,
      allocated: 80000,
      limits: { food: 30000, transport: 50000 },
    })
  })
  it('mendeteksi konflik total anggaran akibat perubahan perangkat lain', () => {
    const op = planChanges(local, {
      ...local,
      budgets: { '2026-10': { total: 80000, limits: { food: 75000 } } },
    })[0]
    expect(() =>
      applyDocument(
        { total: 100000, limits: { food: 75000, transport: 20000 }, allocated: 95000 },
        op,
      ),
    ).toThrow('Konflik anggaran')
  })
  it('form anggaran mempertahankan field yang diubah perangkat lain', () => {
    expect(
      mergeBudgetEdit(
        { total: 200000, limits: { food: 50000, transport: 60000 } },
        { total: 150000, limits: { food: 50000, transport: 20000 } },
        { total: 150000, limits: { food: 70000, transport: 20000 } },
      ),
    ).toEqual({ total: 200000, limits: { food: 70000, transport: 60000 } })
  })
  it('reset/restore mengirim tombstone dan tidak menghapus kategori sebelum transaksi', () => {
    const ops = planChanges(local, { ...initialData(), categories: [] }, true)
    expect(
      ops.findIndex((op) => op.entity === 'transactions' && op.kind === 'delete'),
    ).toBeLessThan(ops.findIndex((op) => op.entity === 'categories' && op.kind === 'delete'))
    expect(ops.some((op) => op.entity === 'budgets' && op.kind === 'delete')).toBe(true)
  })
  it('proyeksi antrean tidak menimpa data sumber atau metadata backup', () => {
    const records = emptyRecords()
    const source = {
      version: 1 as const,
      transactions: [],
      categories: [],
      budgets: {},
      name: '',
      theme: 'light' as const,
    }
    const ops = planChanges(source, local, true)
    const projected = recordsToData(overlay(records, ops))
    expect(projected.transactions).toEqual([item])
    expect(records.transactions).toEqual({})
    expect(projected.budgets['2026-10'].total).toBe(100000)
  })
  it('menolak ID yang tidak bisa menjadi path Firestore', () =>
    expect(() =>
      planChanges(initialData(), { ...local, transactions: [{ ...item, id: 'unsafe/id' }] }),
    ).toThrow('ID pada backup'))
  it('tidak mengirim field tambahan dari backup ke metadata Firestore', () => {
    const extended = { ...local, transactions: [{ ...item, revision: 999, updatedAt: 'forged' }] }
    const create = planChanges(initialData(), extended).find((op) => op.entity === 'transactions')!
    expect(create.patch).not.toHaveProperty('revision')
    expect(create.patch).not.toHaveProperty('updatedAt')
  })
})
class MemoryStorage implements Storage {
  map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null
  }
}
describe('antrean durable per UID', () => {
  const op = (): Mutation => ({
    id: crypto.randomUUID(),
    entity: 'transactions',
    key: 'tx-1',
    kind: 'patch',
    patch: item,
    revive: false,
    order: Date.now(),
  })
  it('dua tab menambahkan operasi berbeda tanpa menimpa antrean', () => {
    const storage = new MemoryStorage(),
      a = new CloudStorage('uid-A', storage),
      b = new CloudStorage('uid-A', storage),
      one = op(),
      two = op()
    a.enqueue([one])
    b.enqueue([two])
    expect(a.queue()).toHaveLength(2)
    a.acknowledge(one.id)
    expect(b.queue().map((o) => o.id)).toEqual([two.id])
  })
  it('akun berbeda tidak dapat membaca cache atau antrean akun sebelumnya', () => {
    const storage = new MemoryStorage(),
      a = new CloudStorage('uid-A', storage),
      b = new CloudStorage('uid-B', storage)
    a.enqueue([op()])
    a.save(emptyRecords())
    expect(b.queue()).toEqual([])
    expect(b.decision()).toBeNull()
    a.clearSnapshot()
    expect(a.queue()).toHaveLength(1)
  })
  it('reload membaca antrean yang sama, tanpa membuat ID operasi baru', () => {
    const storage = new MemoryStorage(),
      a = new CloudStorage('uid-A', storage),
      item = op()
    a.enqueue([item])
    expect(new CloudStorage('uid-A', storage).queue()).toEqual([item])
  })
})
