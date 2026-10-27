import { chromium, expect } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'

const address = process.env.MYBUDGET_PREVIEW_URL || 'http://127.0.0.1:5173/'
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'],
})
await mkdir('test-results/preview', { recursive: true })

try {
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    // Isolated profiles keep these smoke-test transactions out of user data.
    const context = await browser.newContext({ viewport, timezoneId: 'Asia/Jakarta' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('requestfailed', (request) => {
      errors.push(
        `${request.method()} ${new URL(request.url()).pathname}: ${request.failure()?.errorText}`,
      )
    })

    const response = await page.goto(address)
    expect(response?.status(), 'The preview HTTP server must return 200').toBe(200)
    await expect(
      page.getByRole('heading', { name: 'Rencana kecil. Masa depan besar.' }),
    ).toBeVisible()

    for (const name of ['Transaksi', 'Anggaran', 'Analisis', 'Dashboard']) {
      await page.getByRole('button', { name, exact: true }).click()
      await expect(page.locator('main h1')).toBeVisible()
    }
    await expect(
      page.getByRole('heading', { name: 'Rencana kecil. Masa depan besar.' }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Tambah transaksi', exact: true }).click()
    await page.getByLabel('Nominal transaksi').fill('12000')
    await page.getByLabel('Catatan').fill('Pemeriksaan preview terisolasi')
    await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click()
    await expect(page.getByText('Pemeriksaan preview terisolasi', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText('Pemeriksaan preview terisolasi', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(errors, 'No JavaScript, React, module, or network errors').toEqual([])
    await page.screenshot({
      path: `test-results/preview/dashboard-${viewport.width}.png`,
      fullPage: true,
    })
    console.log(
      `PASS ${viewport.width}px: HTTP 200, Dashboard, navigation, transaction, reload; no console errors`,
    )
    await context.close()
  }
} finally {
  await browser.close()
}
