const emulator = import.meta.env.MODE === 'emulator'
import { readFirebaseConfiguration } from './configuration'

const { config, missing } = readFirebaseConfiguration(import.meta.env)
export const firebaseConfig = {
  ...config,
  ...(emulator
    ? {
        apiKey: 'demo-api-key',
        authDomain: 'demo-mybudget.firebaseapp.com',
        projectId: 'demo-mybudget',
        appId: '1:123456789:web:mybudget',
      }
    : {}),
}
export const missingFirebaseVariables = emulator ? [] : missing
export const firebaseConfigured = missingFirebaseVariables.length === 0
export const useEmulators = emulator && ['localhost', '127.0.0.1'].includes(location.hostname)
