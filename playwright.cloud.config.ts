import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'
export default defineConfig({
  testDir: './tests/cloud',
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    timezoneId: 'Asia/Jakarta',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
        (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: ['--no-sandbox'],
    },
  },
  projects: [{ name: 'cloud-desktop-android', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      'npm run build -- --mode emulator --outDir dist-emulator && npm run preview -- --outDir dist-emulator --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    timeout: 60000,
  },
})
