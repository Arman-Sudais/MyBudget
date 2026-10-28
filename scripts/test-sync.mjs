import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
const child = spawn(
  resolve('node_modules/.bin/firebase'),
  [
    'emulators:exec',
    '--only',
    'firestore,auth',
    '--project',
    'demo-mybudget',
    'npm run test:rules && npm run test:cloud:e2e',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      FIREBASE_EMULATORS_PATH:
        process.env.FIREBASE_EMULATORS_PATH || resolve('.cache/firebase/emulators'),
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || resolve('.cache/config'),
      CI: process.env.CI || 'true',
    },
  },
)
child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
child.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
