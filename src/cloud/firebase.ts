import { getApps, initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  getAuth,
  initializeAuth,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  reauthenticateWithPopup,
} from 'firebase/auth'
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentSingleTabManager,
  terminate,
} from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { firebaseConfig, useEmulators } from './config'

export const app = getApps().find((a) => a.name === '[DEFAULT]') ?? initializeApp(firebaseConfig)
export const auth = useEmulators
  ? initializeAuth(app, { persistence: [browserLocalPersistence, browserSessionPersistence] })
  : getAuth(app)
if (useEmulators) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
export const redirectResult = useEmulators ? Promise.resolve(null) : getRedirectResult(auth)
export async function googleLogin(trusted: boolean, redirect = false) {
  sessionStorage.setItem('mybudget:login-trust', trusted ? 'yes' : 'no')
  await setPersistence(auth, trusted ? browserLocalPersistence : browserSessionPersistence)
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  if (redirect) await signInWithRedirect(auth, provider, browserPopupRedirectResolver)
  else await signInWithPopup(auth, provider, browserPopupRedirectResolver)
}
export function createDatabase(trusted: boolean): Firestore {
  const db = initializeFirestore(app, {
    localCache: trusted
      ? persistentLocalCache({ tabManager: persistentSingleTabManager({}) })
      : memoryLocalCache(),
  })
  if (useEmulators) connectFirestoreEmulator(db, '127.0.0.1', 8080)
  return db
}
export async function releaseDatabase(db: Firestore, trusted: boolean, purge: boolean) {
  await terminate(db)
  if (trusted && purge) await clearIndexedDbPersistence(db)
}
export const googleLogout = () => signOut(auth)
export async function refreshGoogleSession() {
  if (!auth.currentUser)
    throw new Error('Login kembali menggunakan akun asal untuk melanjutkan antrean.')
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  await reauthenticateWithPopup(auth.currentUser, provider, browserPopupRedirectResolver)
}
