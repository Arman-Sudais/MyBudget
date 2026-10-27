import { test, expect } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

// Installation is unavailable in Playwright's default incognito contexts.
// A real persistent profile checks all Chromium installability requirements.
const pwaTest = test.extend<{ persistentContext: BrowserContext }>({
  persistentContext: async ({ playwright }, use, info) => {
    const profile = await mkdtemp(join(tmpdir(), 'mybudget-pwa-'))
    const device = info.project.use
    const context = await playwright.chromium.launchPersistentContext(profile, {
      headless: true,
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
        (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: ['--no-sandbox'],
      baseURL: 'http://localhost:4173',
      viewport: device.viewport,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
      userAgent: device.userAgent,
      deviceScaleFactor: device.deviceScaleFactor,
      timezoneId: 'Asia/Jakarta',
    })
    try {
      await use(context)
    } finally {
      await context.close()
      await rm(profile, { recursive: true, force: true })
    }
  },
})

async function today(page: Page) {
  return page.evaluate(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
}
async function addTransaction(
  page: Page,
  type: 'income' | 'expense',
  amount: string,
  note: string,
  date?: string,
) {
  await page.getByRole('button', { name: 'Tambah transaksi', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('button', { name: type === 'income' ? 'Pemasukan' : 'Pengeluaran', exact: true })
    .click()
  await dialog.getByLabel('Nominal transaksi').fill(amount)
  if (date) await dialog.getByLabel('Tanggal', { exact: true }).fill(date)
  await dialog.getByLabel('Catatan').fill(note)
  await dialog.getByRole('button', { name: 'Simpan transaksi', exact: true }).click()
  await expect(dialog).toBeHidden()
}
async function navigate(page: Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).click()
}
async function settings(page: Page) {
  await page.getByRole('button', { name: 'Buka pengaturan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Pengaturan', exact: true })).toBeVisible()
}
async function stored(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('mybudget:v1') || '{}'))
}

test('transaksi: tambah, edit, pencarian, filter, CSV, persistensi, dan konfirmasi hapus', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Cerita keuanganmu dimulai di sini' }),
  ).toBeVisible()
  await addTransaction(page, 'income', '1000000', 'Uang saku kampus')
  await addTransaction(page, 'expense', '25000', 'Makan siang kantin')
  await navigate(page, 'Transaksi')
  await page.getByRole('button', { name: 'Edit Makan siang kantin', exact: true }).click()
  await page.getByLabel('Nominal transaksi').fill('30000')
  await page.getByRole('button', { name: 'Simpan perubahan', exact: true }).click()
  expect((await stored(page)).transactions).toHaveLength(2)
  await page.reload()
  await expect(page.getByText('Makan siang kantin', { exact: true })).toBeVisible()
  await page.getByLabel('Cari transaksi').fill('kantin')
  await expect(page.getByText('Uang saku kampus', { exact: true })).toBeHidden()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Ekspor CSV', exact: true }).click()
  const download = await downloadPromise,
    csv = await readFile((await download.path())!, 'utf-8')
  expect(csv).toContain('"30000"')
  expect(csv).toContain('Makan siang kantin')
  expect(csv).not.toContain('Uang saku kampus')
  await page.getByLabel('Cari transaksi').fill('')
  await page.getByLabel('Filter jenis transaksi').selectOption('income')
  await expect(page.getByText('Makan siang kantin', { exact: true })).toBeHidden()
  await page.getByLabel('Filter kategori').selectOption('allowance')
  await expect(page.getByText('Uang saku kampus', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reset filter', exact: true }).click()
  await page.getByRole('button', { name: 'Hapus Makan siang kantin', exact: true }).click()
  await page.getByRole('button', { name: 'Batal', exact: true }).click()
  expect((await stored(page)).transactions).toHaveLength(2)
  await page.getByRole('button', { name: 'Hapus Makan siang kantin', exact: true }).click()
  await page.getByRole('button', { name: 'Ya, hapus', exact: true }).click()
  expect((await stored(page)).transactions).toHaveLength(1)
  await navigate(page, 'Dashboard')
  await expect(page.locator('.balance-card .summary-amount')).toHaveText(/1\.000\.000/)
  expect(errors).toEqual([])
})

test('anggaran dan analisis berdasarkan transaksi serta bulan dan tahun terpilih', async ({
  page,
}) => {
  await page.goto('/')
  await addTransaction(page, 'income', '500000', 'Saldo awal', '2025-12-30')
  await addTransaction(page, 'expense', '85000', 'Makan Januari', '2026-01-03')
  await navigate(page, 'Anggaran')
  await page.getByRole('button', { name: 'Atur anggaran', exact: true }).click()
  await page.getByLabel('Total anggaran bulanan (Rp)').fill('100000')
  await page.getByLabel('Anggaran Makanan & Minuman', { exact: true }).fill('110000')
  await page.getByRole('button', { name: 'Simpan anggaran', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('tidak boleh melebihi')
  await page.getByLabel('Anggaran Makanan & Minuman', { exact: true }).fill('80000')
  await page.getByRole('button', { name: 'Simpan anggaran', exact: true }).click()
  await expect(page.getByText('Mendekati batas', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Pengeluaran melebihi batas kategori.', { exact: true }),
  ).toBeVisible()
  await navigate(page, 'Dashboard')
  await expect(page.locator('.balance-card .summary-amount')).toHaveText(/415\.000/)
  await expect(
    page.locator('.summary-grid .summary-card').nth(3).locator('.summary-amount'),
  ).toHaveText(/15\.000/)
  await navigate(page, 'Analisis')
  await expect(
    page.getByRole('img', { name: 'Grafik batang pemasukan dan pengeluaran enam bulan terakhir' }),
  ).toBeVisible()
  await expect(page.getByText('Makanan & Minuman', { exact: true }).first()).toBeVisible()
  await page.getByLabel('Bulan terpilih').fill('2025-01')
  await expect(
    page.getByRole('heading', { name: 'Belum ada pengeluaran', exact: true }),
  ).toBeVisible()
  await navigate(page, 'Dashboard')
  await expect(page.locator('.balance-card .summary-amount')).toHaveText(/Rp\s*0/)
  await page.screenshot({ path: `/tmp/mybudget-${test.info().project.name}.png`, fullPage: true })
})

test('kategori kustom, dark mode, backup/restore valid, validasi backup, dan reset', async ({
  page,
}) => {
  await page.goto('/#settings')
  await page.getByLabel('Nama panggilan').fill('Mahasiswa')
  await page.getByRole('button', { name: 'Simpan nama', exact: true }).click()
  await page.getByRole('button', { name: 'Ganti tema', exact: true }).click()
  await expect(page.locator('html')).toHaveClass('dark')
  await page.getByLabel('Nama kategori', { exact: true }).fill('Kebutuhan kos')
  await page.getByRole('button', { name: 'Tambah kategori', exact: true }).click()
  await expect(page.getByText('Kebutuhan kos', { exact: true })).toBeVisible()
  await addTransaction(page, 'expense', '12000', 'Belanja untuk kos')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Backup JSON', exact: true }).click()
  const download = await downloadPromise,
    backup = await readFile((await download.path())!, 'utf-8')
  expect(JSON.parse(backup).transactions).toHaveLength(1)
  await page.getByLabel('Pilih file backup JSON').setInputFiles({
    name: 'rusak.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":999}'),
  })
  await expect(page.getByRole('alert')).toContainText('Format backup tidak sesuai')
  expect((await stored(page)).transactions).toHaveLength(1)
  await page.getByRole('button', { name: 'Hapus data', exact: true }).click()
  await page.getByRole('button', { name: 'Batal', exact: true }).click()
  expect((await stored(page)).transactions).toHaveLength(1)
  await page.getByRole('button', { name: 'Hapus data', exact: true }).click()
  await page.getByRole('button', { name: 'Ya, hapus', exact: true }).click()
  expect((await stored(page)).transactions).toHaveLength(0)
  await page.getByLabel('Pilih file backup JSON').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  })
  await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()
  expect((await stored(page)).transactions).toHaveLength(1)
  await page.reload()
  await expect(page.getByLabel('Nama panggilan')).toHaveValue('Mahasiswa')
  await expect(page.locator('html')).toHaveClass('dark')
  await expect(page.getByText('Kebutuhan kos', { exact: true })).toBeVisible()
  await page.screenshot({
    path: `/tmp/mybudget-settings-${test.info().project.name}.png`,
    fullPage: true,
  })
})

pwaTest(
  'PWA: manifest, ikon, service worker, cache shell, navigasi dan transaksi offline',
  async ({ persistentContext: context }) => {
    const page = context.pages()[0]
    await page.goto('/')
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state), {
        timeout: 15000,
      })
      .toBe('activated')
    expect(await page.evaluate(() => window.isSecureContext)).toBe(true)
    const manifest = await (await page.request.get('/manifest.webmanifest')).json()
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/')
    expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === 'maskable')).toBe(
      true,
    )
    for (const icon of manifest.icons) {
      const res = await page.request.get(icon.src)
      expect(res.ok()).toBe(true)
      expect(res.headers()['content-type']).toContain('image/png')
    }
    const cdp = await context.newCDPSession(page)
    const result = await cdp.send('Page.getInstallabilityErrors')
    expect(result.installabilityErrors).toEqual([])
    // Detach the inspection session before network emulation; an extra CDP
    // session otherwise resets navigator.onLine during offline navigation.
    await cdp.detach()
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByText('Kamu sedang offline.', { exact: false })).toBeVisible()
    await addTransaction(page, 'expense', '17000', 'Transaksi tanpa internet', await today(page))
    await navigate(page, 'Transaksi')
    await expect(page.getByText('Transaksi tanpa internet', { exact: true })).toBeVisible()
    await settings(page)
    await expect(page.getByText('Siap digunakan offline', { exact: true })).toBeVisible()
    await page.reload()
    expect((await stored(page)).transactions[0].amount).toBe(17000)
  },
)

test('data rusak tidak ditimpa dan bisa dipulihkan secara eksplisit', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mybudget:v1', 'BROKEN DATA KEEP ME'))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Data asli belum ditimpa')
  await addTransactionBlocked()
  async function addTransactionBlocked() {
    await page.getByRole('button', { name: 'Tambah transaksi', exact: true }).click()
    await page.getByLabel('Nominal transaksi').fill('1000')
    await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Pulihkan atau hapus')
    expect(await page.evaluate(() => localStorage.getItem('mybudget:v1'))).toBe(
      'BROKEN DATA KEEP ME',
    )
    await page.getByRole('button', { name: 'Tutup dialog', exact: true }).click()
  }
  await settings(page)
  const promise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Unduh data pemulihan', exact: true }).click()
  expect(await readFile((await (await promise).path())!, 'utf-8')).toBe('BROKEN DATA KEEP ME')
  await page.getByRole('button', { name: 'Hapus data', exact: true }).click()
  await page.getByRole('button', { name: 'Ya, hapus', exact: true }).click()
  expect((await stored(page)).transactions).toEqual([])
})

test('responsif tanpa overflow pada semua halaman dan formulir', async ({ page }) => {
  await page.goto('/')
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 850 })
    for (const hash of ['dashboard', 'transactions', 'budgets', 'analytics', 'settings']) {
      await page.goto(`/#${hash}`)
      await expect(page.locator('.loading-state')).toHaveCount(0)
      await expect(page.locator('main h1')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
    }
    await page.getByRole('button', { name: 'Tambah transaksi', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    )
    await page.getByRole('button', { name: 'Tutup dialog', exact: true }).click()
  }
})
