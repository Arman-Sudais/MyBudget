import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  getDocFromServer,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import type { Firestore, Unsubscribe } from 'firebase/firestore'
import type { AppData } from '../types'
import { initialData } from '../lib/finance'
import { parseBackup } from '../lib/data'
import {
  applyDocument,
  emptyRecords,
  fingerprint,
  hasCloudData,
  mergeData,
  overlay,
  planChanges,
  recordsToData,
} from './model'
import type { CloudDocument, CloudRecords, Entity, Mutation } from './model'
import { CloudStorage } from './storage'

export interface SessionState {
  data: AppData
  phase: 'loading' | 'migration' | 'ready'
  status: 'Synced' | 'Syncing' | 'Offline' | 'Sync Error'
  pending: number
  pendingTransactionIds: string[]
  error: string
  lastSynced: number | null
  cloudData: AppData | null
  hasCloudData: boolean
  serverVerified: boolean
}
export type MigrationChoice = 'cloud' | 'local' | 'merge-cloud' | 'merge-local'
export function syncError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? ''
  if (code.includes('permission-denied'))
    return 'Akses Firestore ditolak. Periksa Security Rules, UID, dan konfigurasi project. Perubahan tertunda tetap tersimpan.'
  if (code.includes('unauthenticated'))
    return 'Sesi login perlu diperbarui. Perubahan tertunda tetap tersimpan untuk UID akun ini.'
  if (code.includes('unavailable') || code.includes('deadline'))
    return 'Koneksi cloud belum tersedia. Perubahan tertunda tetap tersimpan dan akan dicoba kembali.'
  return error instanceof Error
    ? error.message
    : 'Sinkronisasi gagal. Perubahan tertunda tetap tersimpan.'
}
export async function writeMutation(db: Firestore, uid: string, op: Mutation, deviceId: string) {
  const target = doc(db, 'users', uid, op.entity, op.key)
  const receipt = doc(db, 'users', uid, 'mutations', op.id)
  for (let attempt = 0; attempt < 5; attempt++) {
    let readRevision: number | null = null
    try {
      return await runTransaction(db, async (tx) => {
        const done = await tx.get(receipt)
        if (done.exists()) return null
        const snapshot = await tx.get(target)
        const previous = snapshot.exists() ? (snapshot.data() as CloudDocument) : undefined
        readRevision = Number(previous?.revision ?? 0)
        let next = applyDocument(previous, op)
        if (next && op.entity === 'settings') next = { name: '', theme: 'light', ...next }
        if (next) {
          const revision = Number(previous?.revision ?? 0) + 1
          next = {
            ...next,
            schemaVersion: 1,
            revision,
            deviceId,
            mutationId: op.id,
            createdAt: previous?.createdAt ?? Timestamp.now(),
          }
          tx.set(target, {
            ...next,
            updatedAt: serverTimestamp(),
            createdAt: previous?.createdAt ?? serverTimestamp(),
          })
        }
        tx.set(receipt, {
          schemaVersion: 1,
          entity: op.entity,
          key: op.key,
          deviceId,
          updatedAt: serverTimestamp(),
        })
        return next ?? null
      })
    } catch (error) {
      if (
        !(error as { code?: string })?.code?.includes('permission-denied') ||
        attempt === 4 ||
        readRevision === null
      )
        throw error
      // Rules may evaluate a stale revision before the SDK receives ABORTED.
      // Retry only when an authorized server read PROVES another writer advanced
      // this document; real authorization/validation failures are never bypassed.
      let latest
      try {
        latest = await getDocFromServer(target)
      } catch {
        throw error
      }
      if (Number(latest.data()?.revision ?? 0) <= readRevision) throw error
    }
  }
  throw new Error(
    'Terlalu banyak perubahan bersamaan. Antrean tetap disimpan; coba sinkronkan kembali.',
  )
}

export class CloudSession {
  private records: CloudRecords = emptyRecords()
  private unsubscribers: Unsubscribe[] = []
  private listeners = new Set<(state: SessionState) => void>()
  private seen = new Set<Entity>()
  private server = new Set<Entity>()
  private queue: Mutation[] = []
  private alive = true
  private running = false
  private linked = false
  private hash = ''
  private validationError = ''
  private readFailed = false
  private cached = false
  private transientError = false
  private local: AppData = initialData()
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  private refreshTimer: ReturnType<typeof setTimeout> | undefined
  readonly deviceId = crypto.randomUUID()
  readonly store: CloudStorage
  state: SessionState = {
    data: initialData(),
    phase: 'loading',
    status: 'Syncing',
    pending: 0,
    pendingTransactionIds: [],
    error: '',
    lastSynced: null,
    cloudData: null,
    hasCloudData: false,
    serverVerified: false,
  }
  constructor(
    readonly db: Firestore,
    readonly uid: string,
    storage: Storage,
    private currentUid: () => string | null,
  ) {
    this.store = new CloudStorage(uid, storage)
  }
  subscribe(fn: (state: SessionState) => void) {
    this.listeners.add(fn)
    fn(this.state)
    return () => {
      this.listeners.delete(fn)
    }
  }
  private publish(patch: Partial<SessionState> = {}) {
    if (!this.alive) return
    this.state = {
      ...this.state,
      ...patch,
      pending: this.queue.length,
      pendingTransactionIds: [
        ...new Set(this.queue.filter((op) => op.entity === 'transactions').map((op) => op.key)),
      ],
    }
    this.state.status = !navigator.onLine
      ? 'Offline'
      : this.state.error
        ? 'Sync Error'
        : this.running ||
            this.queue.length ||
            this.state.phase !== 'ready' ||
            this.server.size !== 4
          ? 'Syncing'
          : 'Synced'
    for (const listener of this.listeners) listener(this.state)
  }
  private assertUser() {
    if (!this.alive || this.currentUid() !== this.uid)
      throw new Error(
        'Akun telah berubah. Tutup form ini dan coba kembali; perubahan belum dikirim ke akun lain.',
      )
  }
  async start(local: AppData) {
    this.local = local
    try {
      this.hash = await fingerprint(local)
      if (!this.alive) return
      this.linked = this.store.decision() === this.hash
      this.cached = this.store.hasSnapshot()
      this.records = this.store.records()
      this.queue = this.store.queue()
      if (this.linked && this.cached) {
        this.refresh()
        this.publish({ phase: 'ready' })
      }
      for (const entity of ['categories', 'transactions', 'budgets', 'settings'] as Entity[]) {
        const receive = (items: { id: string; data: () => unknown }[], fromCache: boolean) => {
          if (!this.alive || this.currentUid() !== this.uid) return
          const incoming: Record<string, CloudDocument> = {}
          for (const item of items) {
            const value = item.data() as CloudDocument,
              old = this.records[entity][item.id]
            incoming[item.id] = old && Number(old.revision) > Number(value.revision) ? old : value
          }
          this.records = { ...this.records, [entity]: incoming }
          this.seen.add(entity)
          if (!fromCache) this.server.add(entity)
          else this.server.delete(entity)
          if (this.seen.size === 4) {
            // Collection listeners arrive independently. Coalesce cross-collection
            // writes before validating references, without projecting invalid data.
            clearTimeout(this.refreshTimer)
            this.refreshTimer = setTimeout(() => this.refresh(), 30)
          }
        }
        const failure = (error: unknown) => {
          this.transientError = false
          clearTimeout(this.retryTimer)
          this.readFailed = true
          this.publish({ error: syncError(error) })
        }
        const unsubscribe =
          entity === 'settings'
            ? onSnapshot(
                doc(this.db, 'users', this.uid, 'settings', 'preferences'),
                { includeMetadataChanges: true },
                (snapshot) =>
                  receive(snapshot.exists() ? [snapshot] : [], snapshot.metadata.fromCache),
                failure,
              )
            : onSnapshot(
                collection(this.db, 'users', this.uid, entity),
                { includeMetadataChanges: true },
                (snapshot) => receive(snapshot.docs, snapshot.metadata.fromCache),
                failure,
              )
        this.unsubscribers.push(unsubscribe)
      }
      window.addEventListener('online', this.onOnline)
      window.addEventListener('offline', this.onOffline)
      window.addEventListener('storage', this.onStorage)
      void this.flush()
    } catch (error) {
      this.publish({ error: syncError(error) })
    }
  }
  private refresh() {
    if (!this.alive) return
    try {
      this.queue = this.store.queue()
      if (this.linked && !this.cached && this.server.size !== 4) {
        this.publish()
        return
      }
      const projected = this.linked ? recordsToData(overlay(this.records, this.queue)) : null
      let cloud: AppData | null = null
      try {
        cloud = recordsToData(this.records)
      } catch (error) {
        if (!this.linked || !this.queue.length) throw error
      }
      if (this.server.size === 4 && cloud) {
        this.state = {
          ...this.state,
          cloudData: cloud,
          hasCloudData: hasCloudData(this.records),
          serverVerified: true,
        }
        if (!this.linked) this.state = { ...this.state, phase: 'migration' }
      }
      if (this.linked) {
        const data = projected!
        this.store.save(this.records)
        this.cached = true
        if (this.validationError && this.state.error === this.validationError) {
          this.state = { ...this.state, error: '' }
          this.validationError = ''
        }
        this.publish({
          data,
          phase: 'ready',
          ...(this.queue.length === 0 && this.server.size === 4 && !this.state.error
            ? { lastSynced: Date.now() }
            : {}),
        })
        void this.flush()
      } else this.publish()
    } catch (error) {
      this.validationError = syncError(error)
      this.publish({ error: this.validationError })
    }
  }
  choose(choice: MigrationChoice, local: AppData = this.local) {
    this.assertUser()
    this.local = local
    if (
      this.server.size !== 4 ||
      !navigator.onLine ||
      !this.state.serverVerified ||
      !this.state.cloudData
    )
      throw new Error(
        'Tunggu pemeriksaan server cloud. Cache offline saja tidak membuktikan akun kosong.',
      )
    if (choice === 'local' && this.state.hasCloudData)
      throw new Error(
        'Akun cloud sekarang sudah memiliki data. Pilih Gabungkan untuk menghindari penggantian data yang baru masuk.',
      )
    const cloud = this.state.cloudData
    let desired =
      choice === 'cloud'
        ? this.state.hasCloudData
          ? cloud
          : initialData()
        : choice === 'local'
          ? this.local
          : mergeData(this.local, cloud, choice === 'merge-cloud' ? 'cloud' : 'local')
    desired = parseBackup(JSON.stringify(desired))
    const ops = planChanges(cloud, desired, true)
    if (!this.records.settings.preferences)
      ops.push({
        id: crypto.randomUUID(),
        entity: 'settings',
        key: 'preferences',
        kind: 'patch',
        patch: { name: desired.name, theme: desired.theme },
        revive: true,
        order: Date.now() * 1000 + ops.length,
      })
    this.store.enqueue(ops)
    try {
      this.store.decide(this.hash)
    } catch (error) {
      for (const op of ops) this.store.acknowledge(op.id)
      throw error
    }
    this.linked = true
    this.publish({ error: '', data: desired, phase: 'ready' })
    this.refresh()
  }
  update(next: AppData, replace = false) {
    this.assertUser()
    if (this.state.phase !== 'ready')
      throw new Error('Selesaikan pilihan migrasi sebelum mengubah data cloud.')
    if (this.state.error)
      throw new Error(
        'Selesaikan Sync Error melalui Pengaturan. Antrean lama tetap aman; unduh backup/perubahan tertunda sebelum membatalkan.',
      )
    const safe = parseBackup(JSON.stringify(next)),
      ops = planChanges(this.state.data, safe, replace)
    this.store.enqueue(ops)
    this.queue = this.store.queue()
    this.publish({ data: safe })
    void this.flush()
  }
  private onOnline = () => {
    clearTimeout(this.retryTimer)
    if (this.transientError) {
      this.transientError = false
      this.state = { ...this.state, error: '' }
    }
    this.publish()
    void this.flush()
  }
  private onOffline = () => this.publish()
  private onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith(this.store.prefix)) {
      this.refresh()
    }
  }
  async flush() {
    if (this.running || !this.alive || !this.linked || !navigator.onLine || this.state.error) return
    this.running = true
    this.publish()
    try {
      this.queue = this.store.queue()
      while (this.alive && navigator.onLine && this.queue.length) {
        this.assertUser()
        const op = this.queue[0]
        const next = await writeMutation(this.db, this.uid, op, this.deviceId)
        if (!this.alive || this.currentUid() !== this.uid) return
        if (next && Number(next.revision) >= Number(this.records[op.entity][op.key]?.revision ?? 0))
          this.records[op.entity][op.key] = next
        this.store.acknowledge(op.id)
        this.queue = this.store.queue()
        this.refresh()
      }
    } catch (error) {
      if (this.alive) {
        const code = (error as { code?: string })?.code ?? ''
        this.transientError =
          code.includes('unavailable') || code.includes('deadline') || code.includes('aborted')
        if (this.transientError) {
          this.retryTimer = setTimeout(() => {
            if (!this.alive || !this.transientError) return
            this.transientError = false
            this.publish({ error: '' })
            void this.flush()
          }, 5000)
        }
        this.publish({ error: syncError(error) })
      }
    } finally {
      this.running = false
      this.publish()
    }
  }
  retry() {
    this.assertUser()
    clearTimeout(this.retryTimer)
    this.transientError = false
    this.publish({ error: '' })
    if (this.readFailed) {
      for (const unsubscribe of this.unsubscribers) unsubscribe()
      this.unsubscribers = []
      this.server.clear()
      this.seen.clear()
      this.readFailed = false
      void this.start(this.local)
      return
    }
    this.refresh()
    void this.flush()
  }
  pendingCount() {
    return this.store.queue().length + (this.running ? 1 : 0)
  }
  discardPending() {
    this.assertUser()
    if (this.running)
      throw new Error('Tunggu pengiriman aktif selesai sebelum membatalkan antrean.')
    this.store.discard()
    this.queue = []
    this.publish({ error: '' })
    this.refresh()
  }
  recovery() {
    const items: Record<string, string> = {}
    for (let i = 0; i < this.store.storage.length; i++) {
      const key = this.store.storage.key(i)
      if (key?.startsWith(this.store.prefix)) items[key] = this.store.storage.getItem(key) ?? ''
    }
    return JSON.stringify(
      { format: 'mybudget-sync-recovery-v1', uid: this.uid, records: items },
      null,
      2,
    )
  }
  stop() {
    this.alive = false
    clearTimeout(this.retryTimer)
    clearTimeout(this.refreshTimer)
    for (const unsubscribe of this.unsubscribers) unsubscribe()
    this.listeners.clear()
    window.removeEventListener('online', this.onOnline)
    window.removeEventListener('offline', this.onOffline)
    window.removeEventListener('storage', this.onStorage)
  }
}
