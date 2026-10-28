// This entry is emitted ONLY by --mode emulator and only works on loopback.
// No credentials, test login endpoint, or helper is included in production dist.
import {
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signInWithCredential,
} from 'firebase/auth'
import { auth } from '../../src/cloud/firebase'
import { useEmulators } from '../../src/cloud/config'
export async function login(email: string, trusted = false) {
  if (!useEmulators) throw new Error('Only the loopback demo emulator can use test credentials.')
  sessionStorage.setItem('mybudget:login-trust', trusted ? 'yes' : 'no')
  await setPersistence(auth, trusted ? browserLocalPersistence : browserSessionPersistence)
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_')
  const now = Math.floor(Date.now() / 1000)
  const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ iss: 'https://accounts.google.com', aud: 'demo-mybudget', sub: email, email, email_verified: true, name: email.split('@')[0], iat: now, exp: now + 3600 })}.`
  await signInWithCredential(auth, GoogleAuthProvider.credential(token))
}
