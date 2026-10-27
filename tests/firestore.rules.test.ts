import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { readFile } from 'node:fs/promises'
import { writeMutation } from '../src/cloud/session'
import type { Mutation } from '../src/cloud/model'
import { initialData } from '../src/lib/finance'

let env: RulesTestEnvironment
const op = (
  entity: Mutation['entity'],
  key: string,
  patch: Mutation['patch'],
  kind: Mutation['kind'] = 'patch',
): Mutation => ({
  id: crypto.randomUUID(),
  entity,
  key,
  patch,
  kind,
  revive: false,
  order: Date.now(),
})
const db = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore
const transaction = {
  id: 'tx-1',
  type: 'expense',
  amount: 25000,
  categoryId: 'food',
  date: '2026-10-27',
  note: 'Kantin',
}
const seed = async (client: Firestore, uid = 'alice') => {
  for (const category of initialData().categories)
    await writeMutation(client, uid, op('categories', category.id, { ...category }), 'device-1')
}
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-mybudget',
    firestore: { host: '127.0.0.1', port: 8080, rules: await readFile('firestore.rules', 'utf-8') },
  })
})
beforeEach(async () => {
  await env.clearFirestore()
})
afterAll(async () => {
  await env?.cleanup()
})
describe('Security Rules dan operasi Firestore nyata', () => {
  it('menolak pembacaan tanpa autentikasi dan akses lintas UID', async () => {
    const alice = db('alice')
    await seed(alice)
    const anonymous = env.unauthenticatedContext().firestore() as unknown as Firestore
    await assertFails(getDoc(doc(anonymous, 'users/alice/categories/food')))
    await assertFails(getDocs(collection(db('bob'), 'users/alice/categories')))
    await assertFails(
      writeMutation(db('bob'), 'alice', op('transactions', 'tx-1', transaction), 'device-bob'),
    )
    await assertSucceeds(getDocs(collection(alice, 'users/alice/categories')))
  })
  it('pemilik bisa mencatat transaksi; tipe kategori dan nominal divalidasi', async () => {
    const alice = db('alice')
    await seed(alice)
    await assertSucceeds(
      writeMutation(alice, 'alice', op('transactions', 'tx-1', transaction), 'device-1'),
    )
    for (const amount of [0, -10, 1.5, 1000000000001]) {
      const id = crypto.randomUUID()
      await assertFails(
        writeMutation(
          alice,
          'alice',
          op('transactions', id, { ...transaction, id, amount }),
          'device-1',
        ),
      )
    }
    await assertFails(
      writeMutation(
        alice,
        'alice',
        op('transactions', 'wrong-type', { ...transaction, id: 'wrong-type', type: 'income' }),
        'device-1',
      ),
    )
    await assertFails(
      writeMutation(
        alice,
        'alice',
        op('transactions', 'bad-date', { ...transaction, id: 'bad-date', date: '2026-02-30' }),
        'device-1',
      ),
    )
  })
  it('dua perangkat menambah data berbeda tanpa lost update dan listener menerima perubahan', async () => {
    const laptop = db('alice'),
      android = db('alice')
    await seed(laptop)
    const observed = new Promise<number>((resolve, reject) => {
      const cancel = onSnapshot(
        collection(android, 'users/alice/transactions'),
        (snapshot) => {
          if (snapshot.docs.filter((d) => !d.data().deleted).length === 2) {
            cancel()
            resolve(2)
          }
        },
        reject,
      )
    })
    await Promise.all([
      writeMutation(
        laptop,
        'alice',
        op('transactions', 'laptop', { ...transaction, id: 'laptop' }),
        'laptop',
      ),
      writeMutation(
        android,
        'alice',
        op('transactions', 'android', { ...transaction, id: 'android', amount: 15000 }),
        'android',
      ),
    ])
    expect(await observed).toBe(2)
    expect((await getDocs(collection(laptop, 'users/alice/transactions'))).size).toBe(2)
  })
  it('perubahan field berbeda pada transaksi sama digabungkan dengan retry transaction', async () => {
    const a = db('alice'),
      b = db('alice')
    await seed(a)
    await writeMutation(a, 'alice', op('transactions', 'tx-1', transaction), 'a')
    await Promise.all([
      writeMutation(a, 'alice', op('transactions', 'tx-1', { amount: 35000 }), 'a'),
      writeMutation(b, 'alice', op('transactions', 'tx-1', { note: 'Diedit dari Android' }), 'b'),
    ])
    expect((await getDoc(doc(a, 'users/alice/transactions/tx-1'))).data()).toMatchObject({
      amount: 35000,
      note: 'Diedit dari Android',
    })
  })
  it('receipt membuat replay operasi idempotent walau perangkat lain sudah mengedit', async () => {
    const a = db('alice')
    await seed(a)
    const create = op('transactions', 'tx-1', transaction)
    await writeMutation(a, 'alice', create, 'a')
    await writeMutation(a, 'alice', op('transactions', 'tx-1', { amount: 45000 }), 'b')
    await writeMutation(a, 'alice', create, 'a')
    expect((await getDoc(doc(a, 'users/alice/transactions/tx-1'))).data()?.amount).toBe(45000)
  })
  it('tombstone menolak edit lama; hanya restore eksplisit boleh menghidupkan kembali', async () => {
    const a = db('alice')
    await seed(a)
    await writeMutation(a, 'alice', op('transactions', 'tx-1', transaction), 'a')
    await writeMutation(a, 'alice', op('transactions', 'tx-1', {}, 'delete'), 'a')
    await expect(
      writeMutation(a, 'alice', op('transactions', 'tx-1', { note: 'Edit lama' }), 'b'),
    ).rejects.toThrow('sudah dihapus')
    await writeMutation(
      a,
      'alice',
      { ...op('transactions', 'tx-1', transaction), revive: true },
      'a',
    )
    expect((await getDoc(doc(a, 'users/alice/transactions/tx-1'))).data()?.deleted).toBe(false)
  })
  it('alokasi budget konsisten dan input negatif/kelebihan ditolak rules', async () => {
    const a = db('alice')
    await seed(a)
    await writeMutation(
      a,
      'alice',
      op('budgets', '2026-10', { total: 100000 }, 'budget-total'),
      'a',
    )
    await writeMutation(
      a,
      'alice',
      op('budgets', '2026-10', { categoryId: 'food', limit: 70000 }, 'budget-limit'),
      'a',
    )
    await assertFails(
      writeMutation(
        a,
        'alice',
        op('budgets', '2026-10', { categoryId: 'transport', limit: -1 }, 'budget-limit'),
        'a',
      ),
    )
    await expect(
      writeMutation(
        a,
        'alice',
        op('budgets', '2026-10', { categoryId: 'transport', limit: 40000 }, 'budget-limit'),
        'a',
      ),
    ).rejects.toThrow('Konflik anggaran')
    const data = (await getDoc(doc(a, 'users/alice/budgets/2026-10'))).data()!
    expect(data.allocated).toBe(70000)
    await writeMutation(
      a,
      'alice',
      op('budgets', '2026-10', { categoryId: 'food', limit: 0 }, 'budget-limit'),
      'a',
    )
    expect((await getDoc(doc(a, 'users/alice/budgets/2026-10'))).data()?.limits).toEqual({})
  })
  it('rules menolak modifikasi map alokasi sekaligus dengan counter palsu', async () => {
    const a = db('alice')
    await seed(a)
    await writeMutation(
      a,
      'alice',
      op('budgets', '2026-10', { total: 100000 }, 'budget-total'),
      'a',
    )
    const target = doc(a, 'users/alice/budgets/2026-10'),
      old = (await getDoc(target)).data()!,
      id = crypto.randomUUID(),
      batch = writeBatch(a)
    batch.set(doc(a, 'users/alice/mutations', id), {
      schemaVersion: 1,
      entity: 'budgets',
      key: '2026-10',
      deviceId: 'a',
      updatedAt: serverTimestamp(),
    })
    batch.set(target, {
      ...old,
      limits: { food: 60000, transport: 60000 },
      allocated: 0,
      changedCategory: 'food',
      revision: old.revision + 1,
      mutationId: id,
      updatedAt: serverTimestamp(),
    })
    await assertFails(batch.commit())
  })
  it('menolak penulisan tanpa receipt, metadata palsu, dan penghapusan receipt', async () => {
    const a = db('alice')
    await assertFails(
      setDoc(doc(a, 'users/alice/categories/food'), {
        ...initialData().categories[4],
        revision: 1,
        schemaVersion: 1,
        deleted: false,
        deviceId: 'a',
        mutationId: 'fake',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }),
    )
    await assertFails(setDoc(doc(a, 'users/alice/settings/other'), { name: 'leak' }))
  })
})
