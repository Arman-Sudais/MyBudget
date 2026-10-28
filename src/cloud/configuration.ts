export const requiredFirebaseVariables = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const

export function readFirebaseConfiguration(env: Record<string, unknown>) {
  const value = (name: string) => (typeof env[name] === 'string' ? env[name].trim() : '')
  return {
    config: {
      apiKey: value('VITE_FIREBASE_API_KEY'),
      authDomain: value('VITE_FIREBASE_AUTH_DOMAIN'),
      projectId: value('VITE_FIREBASE_PROJECT_ID'),
      appId: value('VITE_FIREBASE_APP_ID'),
      storageBucket: value('VITE_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: value('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    },
    missing: requiredFirebaseVariables.filter((name) => !value(name)),
  }
}
