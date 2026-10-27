import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { initialData } from '../lib/finance'
import { CloudSession, writeMutation } from './session'
import type { Firestore } from 'firebase/firestore'

const fake = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  listeners: new Set<() => void>(),
  chain: Promise.resolve() as Promise<unknown>,
  online: true,
  failOnce: false,
}))
vi.mock('firebase/firestore', () => {
  const document = (path: string) => ({
    id: path.split('/').at(-1)!,
    data: () => structuredClone(fake.docs.get(path)),
    exists: () => fake.docs.has(path),
    metadata: { fromCache: !fake.online },
  })
  return {
    doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/'), kind: 'doc' }),
    collection: (_db: unknown, ...parts: string[]) => ({
      path: parts.join('/'),
      kind: 'collection',
    }),
    serverTimestamp: () => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }),
    Timestamp: { now: () => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }) },
    getDocFromServer: async (ref: { path: string }) => document(ref.path),
    onSnapshot: (
      ref: { path: string; kind: string },
      _options: unknown,
      next: (snap: unknown) => void,
    ) => {
      const notify = () => {
        if (ref.kind === 'doc') next(document(ref.path))
        else
          next({
            docs: [...fake.docs.keys()]
              .filter(
                (path) =>
                  path.startsWith(ref.path + '/') &&
                  path.split('/').length === ref.path.split('/').length + 1,
              )
              .map(document),
            metadata: { fromCache: !fake.online },
          })
      }
      fake.listeners.add(notify)
      queueMicrotask(notify)
      return () => fake.listeners.delete(notify)
    },
    runTransaction: (_db: unknown, run: (tx: unknown) => Promise<unknown>) => {
      const execute = async () => {
        if (!fake.online) throw Object.assign(new Error('offline'), { code: 'unavailable' })
        if (fake.failOnce) {
          fake.failOnce = false
          throw Object.assign(new Error('temporary network error'), { code: 'unavailable' })
        }
        const writes = new Map<string, Record<string, unknown>>()
        const result = await run({
          get: async (ref: { path: string }) => document(ref.path),
          set: (ref: { path: string }, data: Record<string, unknown>) =>
            writes.set(ref.path, structuredClone(data)),
        })
        for (const [key, value] of writes) fake.docs.set(key, value)
        for (const listener of fake.listeners) queueMicrotask(listener)
        return result
      }
      const task = fake.chain.then(execute)
      fake.chain = task.catch(() => {})
      return task
    },
  }
})
class MemoryStorage implements Storage {
  map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(k: string) {
    return this.map.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.map.set(k, v)
  }
  removeItem(k: string) {
    this.map.delete(k)
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null
  }
}
const sessions: CloudSession[] = []
const originalLocal = {
  ...initialData(),
  transactions: [
    {
      id: 'local-tx',
      type: 'income' as const,
      amount: 500000,
      categoryId: 'allowance',
      date: '2026-10-01',
      note: 'Uang saku lokal',
    },
  ],
}
function session(uid = 'alice', storage: Storage = new MemoryStorage(), getUid = () => uid) {
  const s = new CloudSession({} as Firestore, uid, storage, getUid)
  sessions.push(s)
  return s
}
const settled = async (s: CloudSession) => {
  await expect.poll(() => s.state.status, { timeout: 10000 }).toBe('Synced')
  expect(s.state.error).toBe('')
}
async function connected(s: CloudSession, local = initialData()) {
  await s.start(local)
  await expect.poll(() => s.state.phase).toBe('migration')
  s.choose('cloud')
  await settled(s)
}
beforeEach(() => {
  fake.docs.clear()
  fake.listeners.clear()
  fake.chain = Promise.resolve()
  fake.online = true
  fake.failOnce = false
  vi.stubGlobal('navigator', {
    get onLine() {
      return fake.online
    },
  })
  vi.stubGlobal('window', new EventTarget())
})
afterEach(() => {
  for (const s of sessions) s.stop()
  sessions.length = 0
  vi.unstubAllGlobals()
})
describe('controller sinkronisasi dengan kontrak SDK Firestore yang disimulasikan', () => {
  it('snapshot baru tidak membatalkan retry jaringan otomatis', async () => {
    const a = session()
    await connected(a)
    fake.failOnce = true
    a.update({ ...a.state.data, name: 'Pulih otomatis' })
    await expect.poll(() => a.state.status).toBe('Sync Error')
    for (const notify of fake.listeners) notify()
    await expect.poll(() => a.state.status, { timeout: 9000 }).toBe('Synced')
    expect(a.state.data.name).toBe('Pulih otomatis')
    expect(a.state.pending).toBe(0)
  }, 12000)
  it('login pertama tidak mengunggah data sampai pengguna mengonfirmasi migrasi', async () => {
    const s = session()
    await s.start(originalLocal)
    await expect.poll(() => s.state.phase).toBe('migration')
    expect(fake.docs.size).toBe(0)
    expect(s.state.data.transactions).toHaveLength(0)
    s.choose('local')
    await settled(s)
    expect(s.state.data.transactions).toEqual(originalLocal.transactions)
    expect(originalLocal.transactions[0].amount).toBe(500000)
  })
  it('dua perangkat mendapat transaksi realtime dan budget yang diedit perangkat lain', async () => {
    const laptop = session(),
      android = session()
    await connected(laptop)
    await connected(android)
    laptop.update({
      ...laptop.state.data,
      transactions: [
        ...laptop.state.data.transactions,
        {
          id: 'laptop-tx',
          type: 'expense',
          amount: 25000,
          categoryId: 'food',
          date: '2026-10-02',
          note: 'Dari laptop',
        },
      ],
    })
    await settled(laptop)
    await expect.poll(() => android.state.data.transactions.length).toBe(1)
    android.update({
      ...android.state.data,
      budgets: { '2026-10': { total: 100000, limits: { food: 60000 } } },
    })
    await settled(android)
    await expect.poll(() => laptop.state.data.budgets['2026-10']?.limits.food).toBe(60000)
  })
  it('dua perangkat mengedit data berbeda bersamaan tanpa kehilangan perubahan', async () => {
    const a = session(),
      b = session()
    await connected(a)
    await connected(b)
    a.update({ ...a.state.data, name: 'Nama dari laptop' })
    b.update({ ...b.state.data, theme: 'dark' })
    await Promise.all([settled(a), settled(b)])
    await expect.poll(() => a.state.data.theme).toBe('dark')
    await expect.poll(() => b.state.data.name).toBe('Nama dari laptop')
  })
  it('antrean offline bertahan saat reload lalu dikirim tepat sekali saat online', async () => {
    const storage = new MemoryStorage(),
      a = session('alice', storage)
    await connected(a)
    fake.online = false
    window.dispatchEvent(new Event('offline'))
    a.update({
      ...a.state.data,
      transactions: [
        {
          id: 'offline-tx',
          type: 'expense',
          amount: 12000,
          categoryId: 'food',
          date: '2026-10-03',
          note: 'Offline',
        },
      ],
    })
    expect(a.state.status).toBe('Offline')
    expect(a.state.pendingTransactionIds).toEqual(['offline-tx'])
    a.stop()
    const reloaded = session('alice', storage)
    await reloaded.start(initialData())
    expect(reloaded.state.data.transactions).toHaveLength(1)
    expect(reloaded.pendingCount()).toBeGreaterThan(0)
    fake.online = true
    window.dispatchEvent(new Event('online'))
    for (const notify of fake.listeners) notify()
    await settled(reloaded)
    expect(
      [...fake.docs.keys()].filter((key) => key.startsWith('users/alice/transactions/')),
    ).toHaveLength(1)
  })
  it('UID berbeda tidak melihat data akun sebelumnya; callback terlambat tidak mengganti UI', async () => {
    let uid = 'alice'
    const alice = session('alice', new MemoryStorage(), () => uid)
    await connected(alice)
    alice.update({ ...alice.state.data, name: 'Rahasia Alice' })
    await settled(alice)
    uid = 'bob'
    expect(() => alice.update(initialData())).toThrow('Akun telah berubah')
    alice.stop()
    const bob = session('bob')
    await connected(bob)
    expect(bob.state.data.name).toBe('')
    expect(bob.state.data.transactions).toHaveLength(0)
  })
  it('restore setelah cloud aktif memulihkan data yang dipilih dan tetap mengirim per dokumen', async () => {
    const a = session()
    await connected(a)
    a.update(originalLocal, true)
    await settled(a)
    expect(a.state.data.transactions).toEqual(originalLocal.transactions)
    expect([...fake.docs.keys()].some((path) => path.includes('/transactions/local-tx'))).toBe(true)
    expect(fake.docs.has('users/alice/settings/preferences')).toBe(true)
  })
  it('receipt mencegah replay operasi lama menimpa edit yang lebih baru', async () => {
    const a = session()
    await connected(a)
    const op = {
      id: 'receipt-1',
      entity: 'settings' as const,
      key: 'preferences',
      kind: 'patch' as const,
      patch: { name: 'Lama' },
      revive: false,
      order: 1,
    }
    await writeMutation(a.db, 'alice', op, 'device')
    await writeMutation(a.db, 'alice', { ...op, id: 'receipt-2', patch: { name: 'Baru' } }, 'other')
    await writeMutation(a.db, 'alice', op, 'device')
    expect(fake.docs.get('users/alice/settings/preferences')?.name).toBe('Baru')
  })
})
