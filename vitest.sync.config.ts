import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    include: ['tests/firestore.rules.test.ts'],
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 30000,
    maxWorkers: 1,
  },
})
