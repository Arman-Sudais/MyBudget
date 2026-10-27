import type { AppData, Budget } from '../types'
import { parseBackup } from '../lib/data'
import { emptyBudget, initialData } from '../lib/finance'

export type Entity = 'transactions' | 'categories' | 'budgets' | 'settings'
export interface Mutation {
  id: string
  entity: Entity
  key: string
  kind: 'patch' | 'delete' | 'budget-total' | 'budget-limit'
  patch: Record<string, unknown>
  revive: boolean
  order: number
}
export type CloudDocument = Record<string, unknown> & { revision?: number; deleted?: boolean }
export type CloudRecords = Record<Entity, Record<string, CloudDocument>>
export const emptyRecords = (): CloudRecords => ({
  transactions: {},
  categories: {},
  budgets: {},
  settings: {},
})
export const safeId = (id: string) =>
  /^[A-Za-z0-9_-]{1,100}$/.test(id) &&
  !/^__.*__$/.test(id) &&
  !['constructor', 'prototype'].includes(id)
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const fields = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(b).filter(([k, v]) => !equal(a[k], v)))
let logicalOrder = 0

export function planChanges(before: AppData, after: AppData, revive = false): Mutation[] {
  parseBackup(JSON.stringify(after))
  const result: Mutation[] = [],
    deletedCategories: Mutation[] = []
  let order = Math.max(Date.now() * 1000, logicalOrder + 1)
  const add = (
    entity: Entity,
    key: string,
    kind: Mutation['kind'],
    patch: Record<string, unknown>,
    canRevive = revive,
  ) => {
    if (!safeId(key))
      throw new Error(
        'ID pada backup tidak kompatibel dengan cloud. Gunakan ID huruf, angka, tanda hubung, atau garis bawah; data lokal tidak diubah.',
      )
    const op: Mutation = {
      id: crypto.randomUUID(),
      entity,
      key,
      kind,
      patch,
      revive: canRevive,
      order: order++,
    }
    if (entity === 'categories' && kind === 'delete') deletedCategories.push(op)
    else result.push(op)
  }
  for (const entity of ['categories', 'transactions'] as const) {
    const previous = new Map(before[entity].map((item) => [item.id, item]))
    const next = new Map(after[entity].map((item) => [item.id, item]))
    for (const item of next.values()) {
      const old = previous.get(item.id)
      if (entity === 'categories' && old && old.type !== item.type)
        throw new Error(
          'Jenis kategori dengan ID yang sama tidak dapat diganti di cloud. Tambahkan kategori dengan ID baru.',
        )
      const allowed =
        entity === 'categories'
          ? ['id', 'name', 'type', 'icon', 'color']
          : ['id', 'type', 'amount', 'categoryId', 'date', 'note']
      const pick = (value: unknown) =>
        Object.fromEntries(
          allowed
            .filter((key) => value && Object.hasOwn(value as object, key))
            .map((key) => [key, (value as Record<string, unknown>)[key]]),
        )
      const patch = fields(pick(old), pick(item))
      if (Object.keys(patch).length) add(entity, item.id, 'patch', patch)
    }
    for (const id of previous.keys()) if (!next.has(id)) add(entity, id, 'delete', {})
  }
  for (const month of new Set([...Object.keys(before.budgets), ...Object.keys(after.budgets)])) {
    const old = before.budgets[month] ?? emptyBudget(),
      next = after.budgets[month] ?? emptyBudget()
    const ids = new Set([...Object.keys(old.limits), ...Object.keys(next.limits)])
    // Decreases first, then a larger total, then increases, then a smaller total.
    // The server maintains the sum invariant at every intermediate write.
    for (const id of ids)
      if ((next.limits[id] ?? 0) < (old.limits[id] ?? 0))
        add('budgets', month, 'budget-limit', { categoryId: id, limit: next.limits[id] ?? 0 })
    if ((!before.budgets[month] && after.budgets[month]) || next.total > old.total)
      add('budgets', month, 'budget-total', { total: next.total }, !before.budgets[month] || revive)
    for (const id of ids)
      if ((next.limits[id] ?? 0) > (old.limits[id] ?? 0))
        add(
          'budgets',
          month,
          'budget-limit',
          { categoryId: id, limit: next.limits[id] ?? 0 },
          !before.budgets[month] || revive,
        )
    if (next.total < old.total) add('budgets', month, 'budget-total', { total: next.total })
    if (before.budgets[month] && !after.budgets[month]) add('budgets', month, 'delete', {})
  }
  const patch = fields(
    { name: before.name, theme: before.theme },
    { name: after.name, theme: after.theme },
  )
  if (Object.keys(patch).length) add('settings', 'preferences', 'patch', patch)
  const start = order - result.length - deletedCategories.length
  const ordered = [...result, ...deletedCategories].map((op, index) => ({
    ...op,
    order: start + index,
  }))
  logicalOrder = order
  return ordered
}

export function applyDocument(
  current: CloudDocument | undefined,
  op: Mutation,
): CloudDocument | undefined {
  if (op.kind === 'delete') return current ? { ...current, deleted: true } : undefined
  if (current?.deleted && !op.revive)
    throw new Error(
      'Konflik: data ini sudah dihapus di perangkat lain. Perubahan tertunda tetap disimpan. Backup lalu batalkan antrean, atau gabungkan kembali secara sengaja.',
    )
  if (op.entity !== 'budgets') return { ...current, ...op.patch, deleted: false }
  const base = current ?? { total: 0, limits: {}, allocated: 0 }
  const limits = { ...(base.limits as Record<string, number>) }
  let total = Number(base.total)
  let changedCategory = ''
  if (op.kind === 'budget-total') total = Number(op.patch.total)
  else {
    changedCategory = String(op.patch.categoryId)
    if (!safeId(changedCategory)) throw new Error('ID kategori tidak valid.')
    const value = Number(op.patch.limit)
    if (value === 0) delete limits[changedCategory]
    else limits[changedCategory] = value
  }
  const allocated = Object.values(limits).reduce((sum, value) => sum + value, 0)
  if (allocated > total)
    throw new Error(
      'Konflik anggaran: alokasi dari perangkat lain membuat total batas tidak mencukupi. Antrean tetap aman; unduh perubahan tertunda sebelum membatalkannya dan atur ulang anggaran.',
    )
  return { ...base, total, limits, allocated, changedCategory, deleted: false }
}

export function overlay(records: CloudRecords, queue: Mutation[]): CloudRecords {
  const result = Object.fromEntries(
    Object.entries(records).map(([key, value]) => [key, { ...value }]),
  ) as CloudRecords
  for (const op of queue) {
    // Optimistic projection retains the user's proposed values, even if a remote
    // tombstone will require an explicit conflict decision before a server write.
    const doc = applyDocument(result[op.entity][op.key], { ...op, revive: true })
    if (doc) result[op.entity][op.key] = doc
  }
  return result
}
export function recordsToData(records: CloudRecords): AppData {
  const payload = (doc: CloudDocument, keys: string[]) =>
    Object.fromEntries(keys.map((k) => [k, doc[k]]))
  const active = (entity: Entity) => Object.values(records[entity]).filter((d) => !d.deleted)
  const preferences = records.settings.preferences
  return parseBackup(
    JSON.stringify({
      version: 1,
      transactions: active('transactions')
        .sort((a, b) => timestampOrder(a.createdAt) - timestampOrder(b.createdAt))
        .map((d) => payload(d, ['id', 'type', 'amount', 'categoryId', 'date', 'note'])),
      categories: active('categories').map((d) =>
        payload(d, ['id', 'name', 'type', 'icon', 'color']),
      ),
      budgets: Object.fromEntries(
        Object.entries(records.budgets)
          .filter(([, d]) => !d.deleted)
          .map(([key, d]) => [key, { total: d.total, limits: d.limits }]),
      ),
      name: preferences?.deleted ? '' : (preferences?.name ?? ''),
      theme: preferences?.deleted ? 'light' : (preferences?.theme ?? 'light'),
    }),
  )
}
export const hasCloudData = (records: CloudRecords) =>
  Object.values(records).some((group) => Object.values(group).some((d) => !d.deleted))
export function hasLocalData(data: AppData) {
  return !!(
    data.transactions.length ||
    Object.keys(data.budgets).length ||
    data.name ||
    !equal(data.categories, initialData().categories)
  )
}
export function mergeData(local: AppData, cloud: AppData, priority: 'cloud' | 'local') {
  const first = priority === 'cloud' ? local : cloud,
    second = priority === 'cloud' ? cloud : local
  const merge = <T extends { id: string }>(a: T[], b: T[]) => [
    ...new Map([...a, ...b].map((item) => [item.id, item])).values(),
  ]
  return parseBackup(
    JSON.stringify({
      ...first,
      ...second,
      transactions: merge(first.transactions, second.transactions),
      categories: merge(first.categories, second.categories),
      budgets: { ...first.budgets, ...second.budgets },
    }),
  )
}
export function migrationConflicts(local: AppData, cloud: AppData) {
  const conflicts = (a: { id: string }[], b: { id: string }[]) => {
    const index = new Map(a.map((item) => [item.id, item]))
    return b.filter((item) => index.has(item.id) && !equal(index.get(item.id), item)).length
  }
  return {
    transactions: conflicts(local.transactions, cloud.transactions),
    categories: conflicts(local.categories, cloud.categories),
    budgets: Object.keys(local.budgets).filter(
      (key) => cloud.budgets[key] && !equal(local.budgets[key], cloud.budgets[key]),
    ).length,
  }
}
export function mergeBudgetEdit(current: Budget, baseline: Budget, submitted: Budget): Budget {
  const limits = { ...current.limits }
  for (const key of new Set([...Object.keys(baseline.limits), ...Object.keys(submitted.limits)]))
    if ((baseline.limits[key] ?? 0) !== (submitted.limits[key] ?? 0))
      limits[key] = submitted.limits[key] ?? 0
  return { total: baseline.total === submitted.total ? current.total : submitted.total, limits }
}
export async function fingerprint(data: AppData) {
  const bytes = new TextEncoder().encode(JSON.stringify(data))
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
}

function timestampOrder(value: unknown) {
  const t = value as { seconds?: number; nanoseconds?: number } | undefined
  return (t?.seconds ?? 0) * 1000 + (t?.nanoseconds ?? 0) / 1_000_000
}
