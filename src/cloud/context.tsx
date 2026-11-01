import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from 'firebase/auth'
import type { AppData } from '../types'
import { useLocalBudgetData } from '../hooks/useLocalBudgetData'
import { firebaseConfigured } from './config'
import type { CloudSession, MigrationChoice, SessionState } from './session'
import type * as FirebaseClient from './firebase'
import { initialData } from '../lib/finance'
import { activateInsightsWorkspace, clearInsightsCache } from '../insights/service'

export interface CloudControls {
  configured: boolean
  user: { uid: string; name: string; email: string } | null
  trusted: boolean
  busy: boolean
  loading: boolean
  error: string
  state: SessionState | null
  localData: AppData
  localBlocked: boolean
  viewKey: string
  login: (trusted: boolean, redirect?: boolean) => Promise<void>
  logout: () => Promise<void>
  reauthenticate: () => Promise<void>
  choose: (choice: MigrationChoice) => void
  retry: () => void
  discard: () => void
  recovery: () => string
}
interface BudgetContextValue {
  data: AppData
  update: (next: AppData) => void
  replace: (next: AppData) => void
  error: string
  blocked: boolean
  cloud: CloudControls
}
const Context = createContext<BudgetContextValue | null>(null)
export function useBudgetContext() {
  const context = useContext(Context)
  if (!context) throw new Error('BudgetProvider tidak tersedia.')
  return context
}

export function BudgetProvider({ children }: { children: ReactNode }) {
  const local = useLocalBudgetData(),
    localRef = useRef(local)
  localRef.current = local
  const clientRef = useRef<typeof FirebaseClient | null>(null),
    sessionRef = useRef<CloudSession | null>(null)
  const [user, setUser] = useState<User | null>(null),
    userRef = useRef<User | null>(null)
  const [state, setState] = useState<SessionState | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(firebaseConfigured),
    [busy, setBusy] = useState(false),
    [trusted, setTrusted] = useState(false)
  const generation = useRef(0),
    cleanup = useRef<Promise<void>>(Promise.resolve())
  const trustRef = useRef(false)
  const blockedCleanup = useRef<(() => Promise<void>) | null>(null)
  const stop = async (purge: boolean) => {
    const session = sessionRef.current
    sessionRef.current = null
    if (!session) return
    session.stop()
    const release = async () => {
      session.store.clearSnapshot()
      await clientRef.current?.releaseDatabase(session.db, trustRef.current, purge)
    }
    blockedCleanup.current = release
    await release()
    blockedCleanup.current = null
  }
  useEffect(() => {
    if (!firebaseConfigured) return
    let alive = true,
      unsubscribe: (() => void) | undefined
    void (async () => {
      try {
        const client = await import('./firebase'),
          { onAuthStateChanged } = await import('firebase/auth'),
          { CloudSession } = await import('./session')
        if (!alive) return
        clientRef.current = client
        void client.redirectResult.catch((e) => {
          if (alive) setError(authError(e))
        })
        unsubscribe = onAuthStateChanged(client.auth, (next) => {
          activateInsightsWorkspace(next?.uid ?? 'local')
          const token = ++generation.current
          // Hide the old workspace immediately, before async cache cleanup.
          userRef.current = next
          setUser(next)
          setState(null)
          setLoading(true)
          setError('')
          cleanup.current = cleanup.current
            .catch(() => {})
            .then(async () => {
              if (!alive || token !== generation.current) return
              try {
                await stop(true)
                if (blockedCleanup.current) {
                  await blockedCleanup.current()
                  blockedCleanup.current = null
                }
                if (!alive || token !== generation.current) return
                if (!next) {
                  setLoading(false)
                  return
                }
                const pendingTrust = sessionStorage.getItem('mybudget:login-trust')
                if (pendingTrust !== null) {
                  if (pendingTrust === 'yes')
                    localStorage.setItem(`mybudget:trusted:${next.uid}`, 'yes')
                  else localStorage.removeItem(`mybudget:trusted:${next.uid}`)
                  sessionStorage.removeItem('mybudget:login-trust')
                }
                const usePersistence =
                  localStorage.getItem(`mybudget:trusted:${next.uid}`) === 'yes'
                trustRef.current = usePersistence
                setTrusted(usePersistence)
                const storage = usePersistence ? localStorage : sessionStorage
                const session = new CloudSession(
                  client.createDatabase(usePersistence),
                  next.uid,
                  storage,
                  () => userRef.current?.uid ?? null,
                )
                sessionRef.current = session
                session.subscribe((snapshot) => {
                  if (alive && token === generation.current) {
                    setState(snapshot)
                    setLoading(false)
                  }
                })
                await session.start(localRef.current.data)
              } catch (e) {
                if (alive && token === generation.current) {
                  setError(
                    `Sesi cloud belum dapat dibuka: ${authError(e)} Tutup tab MyBudget lain jika cache sedang dipakai, lalu coba kembali.`,
                  )
                  setLoading(true)
                }
              }
            })
        })
      } catch (e) {
        if (alive) {
          setError(authError(e))
          setLoading(false)
        }
      }
    })()
    return () => {
      alive = false
      generation.current++
      unsubscribe?.()
      const session = sessionRef.current
      sessionRef.current = null
      if (session) {
        session.stop()
        void clientRef.current?.releaseDatabase(session.db, trustRef.current, false).catch(() => {})
      }
    }
  }, [])
  const requireSession = () => {
    const session = sessionRef.current
    if (!session || session.uid !== userRef.current?.uid) throw new Error('Sesi cloud belum siap.')
    return session
  }
  const login = async (usePersistence: boolean, redirect = false) => {
    setBusy(true)
    setError('')
    try {
      const client = clientRef.current ?? (await import('./firebase'))
      clientRef.current = client
      await client.googleLogin(usePersistence, redirect)
    } catch (e) {
      setError(authError(e))
      throw new Error(authError(e))
    } finally {
      setBusy(false)
    }
  }
  const logout = async () => {
    setBusy(true)
    setError('')
    try {
      if (sessionRef.current?.pendingCount())
        throw new Error(
          'Masih ada perubahan tertunda. Hubungkan internet dan tunggu Synced sebelum logout, atau unduh perubahan tertunda lalu batalkan antrean dengan konfirmasi.',
        )
      setLoading(true)
      clearInsightsCache()
      await stop(true)
      if (blockedCleanup.current) {
        await blockedCleanup.current()
        blockedCleanup.current = null
      }
      await clientRef.current?.googleLogout()
      // Cloud snapshots have been removed; the original device-local data is untouched.
    } catch (e) {
      setError(authError(e))
      setLoading(!!blockedCleanup.current)
      throw new Error(authError(e))
    } finally {
      setBusy(false)
    }
  }
  const cloud: CloudControls = {
    configured: firebaseConfigured,
    user: user ? { uid: user.uid, name: user.displayName ?? '', email: user.email ?? '' } : null,
    trusted,
    busy,
    loading,
    error,
    state,
    localData: local.data,
    localBlocked: local.blocked,
    viewKey: user?.uid ?? 'local',
    login,
    logout,
    reauthenticate: async () => {
      setBusy(true)
      setError('')
      try {
        await clientRef.current?.refreshGoogleSession()
        requireSession().retry()
      } catch (e) {
        setError(authError(e))
        throw new Error(authError(e))
      } finally {
        setBusy(false)
      }
    },
    choose: (choice) => {
      if (localRef.current.blocked && choice !== 'cloud')
        throw new Error('Data lokal rusak: unduh salinan pemulihan dari Pengaturan sebelum impor.')
      requireSession().choose(choice, localRef.current.data)
    },
    retry: () => {
      if (blockedCleanup.current) {
        void logout().catch(() => {})
      } else if (sessionRef.current) {
        sessionRef.current.retry()
      } else location.reload()
    },
    discard: () => requireSession().discardPending(),
    recovery: () => requireSession().recovery(),
  }
  const value: BudgetContextValue = {
    data: user ? (state?.data ?? initialData()) : local.data,
    update: (next) => {
      if (userRef.current) requireSession().update(next)
      else localRef.current.update(next)
    },
    replace: (next) => {
      if (userRef.current) requireSession().update(next, true)
      else localRef.current.replace(next)
    },
    error: user ? (state?.error ?? error) : local.error || error,
    blocked: user ? state?.phase !== 'ready' : local.blocked,
    cloud,
  }
  return <Context.Provider value={value}>{children}</Context.Provider>
}
function authError(error: unknown) {
  const code = (error as { code?: string })?.code ?? ''
  if (code.includes('popup-blocked'))
    return 'Popup Google diblokir. Izinkan popup, atau gunakan tombol login melalui pengalihan.'
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request'))
    return 'Login dibatalkan. Data lokal tetap aman.'
  if (code.includes('unauthorized-domain'))
    return 'Domain aplikasi belum terdaftar pada Firebase Authentication → Settings → Authorized domains.'
  if (code.includes('operation-not-allowed'))
    return 'Aktifkan penyedia Google pada Firebase Authentication.'
  if (code.includes('invalid-api-key') || code.includes('configuration-not-found'))
    return 'Konfigurasi aplikasi web Firebase belum benar. Periksa environment variables VITE_FIREBASE_* dan deploy/build ulang.'
  if (code.includes('network-request-failed'))
    return 'Login membutuhkan koneksi internet. Data lokal tetap dapat digunakan.'
  if (code.includes('failed-precondition'))
    return 'Cache offline masih digunakan tab lain. Tutup tab MyBudget lain lalu coba lagi; data tidak dihapus paksa.'
  return error instanceof Error
    ? error.message
    : 'Operasi cloud gagal. Periksa konfigurasi Firebase.'
}
