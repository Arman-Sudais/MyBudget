// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialData } from '../lib/finance'
import type { AppData } from '../types'

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  config: { ready: true, reason: '', model: 'gemini-test-flash', siteKey: 'public-test-key' },
  cloud: { viewKey: 'local' },
}))
vi.mock('../hooks/useBudgetData', () => ({ useBudgetData: () => ({ cloud: mocks.cloud }) }))
vi.mock('./config', () => ({ aiConfiguration: mocks.config }))
vi.mock('./gemini', () => ({ generateInsights: mocks.generate }))
import AIInsights from '../components/AIInsights'
import { clearInsightsCache } from './service'

let root: Root, container: HTMLDivElement
const data = (): AppData => ({
  ...initialData(),
  transactions: [
    {
      id: 'private-id',
      type: 'expense',
      amount: 25000,
      date: '2026-01-03',
      categoryId: 'food',
      note: 'Rahasia pengguna',
    },
  ],
  budgets: { '2026-01': { total: 100000, limits: { food: 50000 } } },
})
const flush = () => new Promise((resolve) => setTimeout(resolve, 10))
function button(label: string) {
  const element = [...container.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === label,
  )
  if (!element) throw new Error(`Button unavailable: ${label}`)
  return element
}
async function click(label: string) {
  await act(async () => {
    button(label).click()
    await flush()
  })
}
async function render(value = data(), month = '2026-01') {
  await act(async () => {
    root.render(<AIInsights data={value} month={month} />)
    await flush()
  })
}

describe('AI Insights consent and fallback UI', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value() {
        this.setAttribute('open', '')
      },
    })
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
    mocks.config.ready = true
    mocks.config.reason = ''
    mocks.cloud.viewKey = 'local'
    mocks.generate.mockResolvedValue({ findings: ['totals'], recommendations: ['savings-plan'] })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('tidak memanggil AI sebelum persetujuan, batal tidak mengirim, hasil tersimpan mencegah pengulangan', async () => {
    await render()
    expect(container.textContent).toContain('25.000')
    expect(mocks.generate).not.toHaveBeenCalled()
    await click('Analisis dengan AI')
    expect(container.querySelector('dialog')).not.toBeNull()
    expect(container.querySelector('pre')?.textContent).not.toContain('Rahasia pengguna')
    expect(mocks.generate).not.toHaveBeenCalled()
    await click('Batal')
    expect(mocks.generate).not.toHaveBeenCalled()
    await click('Analisis dengan AI')
    await click('Setuju dan analisis')
    expect(mocks.generate).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Dibantu Gemini')
    expect(container.textContent).toContain('25.000')
    await click('Analisis dengan AI')
    expect(mocks.generate).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Hasil tersimpan')
  })
  it('rate limit menampilkan fallback tanpa mengubah transaksi atau memanggil ulang otomatis', async () => {
    mocks.generate.mockRejectedValue({ code: 'ai/429' })
    const source = data(),
      before = JSON.stringify(source)
    await render(source)
    await click('Analisis dengan AI')
    await click('Setuju dan analisis')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Kuota gratis')
    expect(container.textContent).toContain('Analisis otomatis')
    expect(container.textContent).toContain('25.000')
    expect(JSON.stringify(source)).toBe(before)
    await render(source)
    expect(mocks.generate).toHaveBeenCalledTimes(1)
  })
  it('mengganti periode membatalkan hasil lambat dan tidak mencampur hasil lama', async () => {
    let finish!: (value: unknown) => void
    mocks.generate.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    await render()
    await click('Analisis dengan AI')
    await click('Setuju dan analisis')
    expect(container.textContent).toContain('Menganalisis')
    await render(data(), '2025-12')
    await act(async () => {
      finish({ findings: ['totals'], recommendations: ['record'] })
      await flush()
    })
    expect(container.textContent).not.toContain('Dibantu Gemini')
    expect(container.textContent).toContain('Belum ada transaksi')
  })
  it('hasil cache hilang saat akun berganti dan cache dapat dihapus pada logout', async () => {
    await render()
    await click('Analisis dengan AI')
    await click('Setuju dan analisis')
    expect(container.textContent).toContain('Dibantu Gemini')
    mocks.cloud.viewKey = 'account-b'
    clearInsightsCache()
    await render()
    expect(container.textContent).not.toContain('Dibantu Gemini')
    expect(
      Object.keys(sessionStorage).filter((k) => k.startsWith('mybudget:insights:v1:')),
    ).toHaveLength(0)
  })

  it('memulihkan cache sesi akun yang sama setelah remount tanpa permintaan baru', async () => {
    mocks.cloud.viewKey = 'account-a'
    await render()
    await click('Analisis dengan AI')
    await click('Setuju dan analisis')
    expect(container.textContent).toContain('Dibantu Gemini')
    await act(async () => root.unmount())
    root = createRoot(container)
    await render()
    await act(async () => {
      await flush()
    })
    expect(container.textContent).toContain('Dibantu Gemini')
    expect(mocks.generate).toHaveBeenCalledTimes(1)
  })
  it('AI dinonaktifkan dan data kosong tetap memiliki analisis lokal tanpa panggilan', async () => {
    mocks.config.ready = false
    mocks.config.reason = 'Gemini belum diaktifkan'
    await render()
    expect(button('Analisis dengan AI').disabled).toBe(true)
    expect(container.textContent).toContain('25.000')
    mocks.config.ready = true
    await render(initialData())
    expect(button('Analisis dengan AI').disabled).toBe(true)
    expect(container.textContent).toContain('Belum ada transaksi')
    expect(mocks.generate).not.toHaveBeenCalled()
  })
})
