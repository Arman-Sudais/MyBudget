const emulator = import.meta.env.MODE === 'emulator'
const env = import.meta.env
export const firebaseConfig = {
  apiKey: emulator ? 'demo-api-key' : env.VITE_FIREBASE_API_KEY,
  authDomain: emulator ? 'demo-mybudget.firebaseapp.com' : env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: emulator ? 'demo-mybudget' : env.VITE_FIREBASE_PROJECT_ID,
  appId: emulator ? '1:123456789:web:mybudget' : env.VITE_FIREBASE_APP_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
}
export const firebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
)
export const useEmulators = emulator && ['localhost', '127.0.0.1'].includes(location.hostname)
