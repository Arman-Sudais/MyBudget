import { describe, expect, it } from 'vitest'
import { readFirebaseConfiguration, requiredFirebaseVariables } from './configuration'

describe('konfigurasi Firebase dari environment variables', () => {
  const env = {
    VITE_FIREBASE_API_KEY: 'public-web-config-example',
    VITE_FIREBASE_AUTH_DOMAIN: 'example-project.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'example-project',
    VITE_FIREBASE_APP_ID: '1:123:web:example',
  }
  it('menampilkan tepat variabel yang hilang, bukan nilai konfigurasi', () => {
    expect(
      readFirebaseConfiguration({ VITE_FIREBASE_PROJECT_ID: 'example-project' }).missing,
    ).toEqual(['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_APP_ID'])
    expect(readFirebaseConfiguration({}).missing).toEqual(requiredFirebaseVariables)
  })
  it('tidak mengaktifkan konfigurasi yang kosong atau hanya spasi', () => {
    expect(readFirebaseConfiguration({ ...env, VITE_FIREBASE_API_KEY: '   ' }).missing).toEqual([
      'VITE_FIREBASE_API_KEY',
    ])
  })
  it('empat nilai wajib cukup; variabel opsional tidak memblokir login', () => {
    const result = readFirebaseConfiguration(env)
    expect(result.missing).toEqual([])
    expect(result.config.storageBucket).toBe('')
    expect(result.config.messagingSenderId).toBe('')
  })
  it('memakai nilai environment dan merapikan spasi tanpa hardcode project pengguna', () => {
    expect(
      readFirebaseConfiguration({ ...env, VITE_FIREBASE_PROJECT_ID: '  project-from-deployment  ' })
        .config.projectId,
    ).toBe('project-from-deployment')
  })
})
