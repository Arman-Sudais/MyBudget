import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
async function login(page: Page, email: string, trusted = true) {
  await page.goto('/#settings')
  await expect(page.getByRole('button', { name: 'Login dengan Google', exact: true })).toBeVisible()
  await page.evaluate(
    async ({ email, trusted }) => {
      // Only the emulator build emits this entry. It uses the real Firebase Auth
      // SDK with a simulated Google credential accepted ONLY by the Auth emulator.
      const helper = await import(/* @vite-ignore */ '/test-auth.js')
      await helper.login(email, trusted)
    },
    { email, trusted },
  )
}
async function decide(page: Page, choice = 'Mulai cloud baru') {
  await expect(page.getByRole('heading', { name: 'Pilih awal sinkronisasimu' })).toBeVisible()
  await page.getByRole('button', { name: choice, exact: true }).click()
  await page.getByRole('button', { name: 'Konfirmasi mulai sinkronisasi', exact: true }).click()
  await synced(page)
}
async function synced(page: Page) {
  await expect(
    page.getByRole('button', { name: 'Status sinkronisasi: Synced', exact: true }),
  ).toBeVisible({ timeout: 30000 })
}
async function settings(page: Page) {
  await page.getByRole('button', { name: 'Buka pengaturan', exact: true }).click()
}
async function transaction(page: Page, note: string, amount = '25000') {
  await page.getByRole('button', { name: 'Tambah transaksi', exact: true }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Nominal transaksi').fill(amount)
  await form.getByLabel('Catatan').fill(note)
  await form.getByRole('button', { name: 'Simpan transaksi', exact: true }).click()
}
test('login emulator tidak mengganti data lokal atau membocorkan workspace akun lama', async ({
  page,
}) => {
  await page.goto('/')
  await transaction(page, 'Data lokal tetap aman')
  const original = await page.evaluate(() => localStorage.getItem('mybudget:v1'))
  await login(page, `auth-only-${Date.now()}@example.test`, false)
  await expect(page.getByText('auth-only-', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('Data lokal tetap aman', { exact: true })).toBeHidden()
  expect(await page.evaluate(() => localStorage.getItem('mybudget:v1'))).toBe(original)
  await page.getByRole('button', { name: /^(Logout|Kembali ke mode lokal)$/ }).click()
  await page.goto('/#transactions')
  await expect(page.getByText('Data lokal tetap aman', { exact: true })).toBeVisible()
  await login(page, `different-${Date.now()}@example.test`, false)
  await expect(page.getByText('Data lokal tetap aman', { exact: true })).toBeHidden()
  await page.getByRole('button', { name: /^(Logout|Kembali ke mode lokal)$/ }).click()
  expect(await page.evaluate(() => localStorage.getItem('mybudget:v1'))).toBe(original)
})
test('dua perangkat, migrasi, realtime transaksi/budget, offline reload, backup/restore dan pergantian UID', async ({
  browser,
  page,
}) => {
  const email = `sync-${Date.now()}@example.test`,
    androidContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    }),
    android = await androidContext.newPage()
  try {
    await page.goto('/')
    await transaction(page, 'Uang lokal sebelum login', '35000')
    const original = await page.evaluate(() => localStorage.getItem('mybudget:v1'))
    await login(page, email)
    await decide(page, 'Impor data lokal ke cloud')
    await expect
      .poll(() =>
        page.evaluate(async () =>
          (await indexedDB.databases()).some((db) => db.name?.includes('firestore')),
        ),
      )
      .toBe(true)
    expect(await page.evaluate(() => localStorage.getItem('mybudget:v1'))).toBe(original)
    await login(android, email)
    await decide(android, 'Gunakan data cloud')
    await android.getByRole('button', { name: 'Transaksi', exact: true }).click()
    await expect(android.getByText('Uang lokal sebelum login', { exact: true })).toBeVisible()
    await transaction(page, 'Transaksi dari laptop')
    await expect(android.getByText('Transaksi dari laptop', { exact: true })).toBeVisible({
      timeout: 15000,
    })
    await android.getByRole('button', { name: 'Anggaran', exact: true }).click()
    await android.getByRole('button', { name: 'Atur anggaran', exact: true }).click()
    await android.getByLabel('Total anggaran bulanan (Rp)').fill('200000')
    await android.getByLabel('Anggaran Makanan & Minuman', { exact: true }).fill('100000')
    await android.getByRole('button', { name: 'Simpan anggaran', exact: true }).click()
    await synced(android)
    await page.getByRole('button', { name: 'Anggaran', exact: true }).click()
    await expect(page.locator('.budget-overview-heading h2')).toHaveText(/200\.000/)
    await settings(android)
    await android.getByLabel('Nama kategori', { exact: true }).fill('Kebutuhan cloud')
    await android.getByRole('button', { name: 'Tambah kategori', exact: true }).click()
    await synced(android)
    await settings(page)
    await expect(page.getByText('Kebutuhan cloud', { exact: true })).toBeVisible()
    await Promise.all([
      transaction(page, 'Catatan laptop bersamaan', '10000'),
      transaction(android, 'Catatan Android bersamaan', '15000'),
    ])
    await Promise.all([synced(page), synced(android)])
    await android.getByRole('button', { name: 'Transaksi', exact: true }).click()
    await expect(android.getByText('Catatan laptop bersamaan', { exact: true })).toBeVisible()
    await expect(android.getByText('Catatan Android bersamaan', { exact: true })).toBeVisible()
    await android.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await androidContext.setOffline(true)
    await transaction(android, 'Antrean offline unik', '17000')
    await expect(android.getByText('Tertunda', { exact: true })).toBeVisible()
    await settings(android)
    await android.getByRole('button', { name: 'Logout', exact: true }).click()
    await expect(
      android.getByRole('alert').filter({ hasText: 'perubahan tertunda' }).first(),
    ).toBeVisible()
    await android.reload()
    await android.getByRole('button', { name: 'Transaksi', exact: true }).click()
    await expect(android.getByText('Antrean offline unik', { exact: true })).toBeVisible()
    await androidContext.setOffline(false)
    await synced(android)
    await page.getByRole('button', { name: 'Transaksi', exact: true }).click()
    await expect(page.getByText('Antrean offline unik', { exact: true })).toHaveCount(1)
    await settings(page)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Backup JSON', exact: true }).click()
    const backup = await readFile((await (await download).path())!, 'utf-8')
    expect(JSON.parse(backup).transactions.length).toBe(5)
    await transaction(page, 'Akan diganti restore', '3000')
    await synced(page)
    await expect(android.getByText('Akan diganti restore', { exact: true })).toBeVisible()
    await page.getByLabel('Pilih file backup JSON').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backup),
    })
    await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()
    await synced(page)
    await android.getByRole('button', { name: 'Transaksi', exact: true }).click()
    await expect(android.getByText('Akan diganti restore', { exact: true })).toBeHidden()
    await page.getByRole('button', { name: 'Logout', exact: true }).click()
    expect(await page.evaluate(() => localStorage.getItem('mybudget:v1'))).toBe(original)
    expect(
      await page.evaluate(() => Object.keys(localStorage).some((k) => k.endsWith(':snapshot'))),
    ).toBe(false)
    expect(
      await page.evaluate(async () =>
        (await indexedDB.databases()).some((db) => db.name?.includes('firestore')),
      ),
    ).toBe(false)
    await login(page, `other-${Date.now()}@example.test`)
    await decide(page, 'Mulai cloud baru')
    await page.getByRole('button', { name: 'Transaksi', exact: true }).click()
    await expect(page.getByText('Transaksi dari laptop', { exact: true })).toBeHidden()
    await settings(page)
    await expect(page.getByText('Kebutuhan cloud', { exact: true })).toBeHidden()
  } finally {
    await androidContext.close()
  }
})
test('migrasi saat lokal dan cloud sama-sama terisi tidak menggandakan ID dan mempertahankan lokal asli', async ({
  browser,
  page,
}) => {
  const email = `merge-${Date.now()}@example.test`
  await page.goto('/')
  await transaction(page, 'ID yang sama di dua perangkat', '25000')
  const source = await page.evaluate(() => JSON.parse(localStorage.getItem('mybudget:v1')!))
  await login(page, email)
  await decide(page, 'Impor data lokal ke cloud')
  const androidContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  try {
    const android = await androidContext.newPage()
    const local = {
      ...source,
      transactions: [
        { ...source.transactions[0], amount: 32000 },
        {
          ...source.transactions[0],
          id: crypto.randomUUID(),
          amount: 18000,
          note: 'Hanya ada di Android',
        },
      ],
    }
    await android.addInitScript((data) => {
      if (!localStorage.getItem('mybudget:v1'))
        localStorage.setItem('mybudget:v1', JSON.stringify(data))
    }, local)
    await login(android, email)
    await decide(android, 'Gabungkan · utamakan cloud')
    const download = android.waitForEvent('download')
    await android.getByRole('button', { name: 'Backup JSON', exact: true }).click()
    const merged = JSON.parse(await readFile((await (await download).path())!, 'utf-8'))
    expect(merged.transactions).toHaveLength(2)
    expect(
      merged.transactions.find((t: { id: string }) => t.id === source.transactions[0].id).amount,
    ).toBe(25000)
    expect(
      await android.evaluate(
        () => JSON.parse(localStorage.getItem('mybudget:v1')!).transactions[0].amount,
      ),
    ).toBe(32000)
    await page.getByRole('button', { name: 'Transaksi', exact: true }).click()
    await expect(page.getByText('Hanya ada di Android', { exact: true })).toBeVisible()
  } finally {
    await androidContext.close()
  }
})
