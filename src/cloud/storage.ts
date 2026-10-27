import type { CloudRecords, Mutation } from './model'
import { emptyRecords, safeId } from './model'

// One key per operation avoids a read/modify/write race between tabs. Receipts
// in Firestore make processing the same key from two tabs idempotent.
export class CloudStorage {
  readonly prefix: string
  constructor(
    readonly uid: string,
    readonly storage: Storage,
  ) {
    this.prefix = `mybudget:cloud:${uid}:`
  }
  queue(): Mutation[] {
    const result: Mutation[] = []
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i)
      if (!key?.startsWith(`${this.prefix}op:`)) continue
      const raw = this.storage.getItem(key)
      if (!raw) continue
      const op = JSON.parse(raw) as Mutation
      if (
        !safeId(op.id) ||
        !safeId(op.key) ||
        !['transactions', 'categories', 'budgets', 'settings'].includes(op.entity) ||
        !['patch', 'delete', 'budget-total', 'budget-limit'].includes(op.kind) ||
        !Number.isFinite(op.order) ||
        typeof op.patch !== 'object' ||
        op.patch === null
      )
        throw new Error('Antrean lokal tidak valid. Unduh salinan pemulihan; data belum dihapus.')
      result.push(op)
    }
    return result.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  }
  enqueue(ops: Mutation[]) {
    const added: string[] = []
    try {
      for (const op of ops) {
        const key = `${this.prefix}op:${op.id}`
        this.storage.setItem(key, JSON.stringify(op))
        added.push(key)
      }
    } catch {
      for (const key of added) this.storage.removeItem(key)
      throw new Error(
        'Penyimpanan antrean penuh/tidak tersedia. Perubahan belum disimpan; buat backup dan kosongkan ruang perangkat.',
      )
    }
  }
  acknowledge(id: string) {
    this.storage.removeItem(`${this.prefix}op:${id}`)
  }
  records(): CloudRecords {
    const raw = this.storage.getItem(`${this.prefix}snapshot`)
    if (!raw) return emptyRecords()
    const data = JSON.parse(raw)
    for (const key of ['transactions', 'categories', 'budgets', 'settings'])
      if (!data[key] || typeof data[key] !== 'object')
        throw new Error('Cache cloud lokal tidak valid; muat ulang online. Antrean tetap aman.')
    return data as CloudRecords
  }
  hasSnapshot() {
    return this.storage.getItem(`${this.prefix}snapshot`) !== null
  }
  save(records: CloudRecords) {
    this.storage.setItem(`${this.prefix}snapshot`, JSON.stringify(records))
  }
  decision(): string | null {
    return this.storage.getItem(`${this.prefix}decision`)
  }
  decide(hash: string) {
    this.storage.setItem(`${this.prefix}decision`, hash)
  }
  clearSnapshot() {
    this.storage.removeItem(`${this.prefix}snapshot`)
  }
  discard() {
    for (const op of this.queue()) this.acknowledge(op.id)
  }
}
