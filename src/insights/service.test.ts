import { describe, expect, it, vi } from 'vitest'
import { initialData } from '../lib/finance'
import { analyzeFinances, localInsights } from './engine'
import {
  analysisKey,
  cachedSelection,
  reserveRequest,
  requestInsights,
  aiErrorMessage,
} from './service'
import { validateSelection } from './protocol'
import { readAIConfiguration } from './config'

function storage(): Storage {
  const data: Record<string, string> = {}
  return {
    get length() {
      return Object.keys(data).length
    },
    key: (i) => Object.keys(data)[i] ?? null,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v
    },
    removeItem: (k) => {
      delete data[k]
    },
    clear: () => {
      Object.keys(data).forEach((k) => delete data[k])
    },
  }
}
const report = localInsights(analyzeFinances(initialData(), '2026-10', '2026-10-10'))
const valid = { findings: ['totals', 'limited'], recommendations: ['record'] }
const base = () => ({
  key: 'test',
  payload: '{}',
  report,
  cache: storage(),
  quota: storage(),
  signal: new AbortController().signal,
  now: new Date(2026, 9, 10, 12).getTime(),
  generate: vi.fn().mockResolvedValue(valid),
})

describe('AI data contract and quota', () => {
  it('batas waktu meliputi App Check dan AI; hasil terlambat tidak masuk cache', async () => {
    vi.useFakeTimers()
    try {
      const options = base()
      options.generate.mockImplementation(() => new Promise(() => {}))
      const task = requestInsights(options)
      const assertion = expect(task).rejects.toThrow('timeout')
      await vi.advanceTimersByTimeAsync(35000)
      await assertion
      expect(options.generate).toHaveBeenCalledTimes(1)
      expect(options.generate.mock.calls[0][1].aborted).toBe(true)
      expect(options.cache.getItem('test')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
  it('menerima hanya ID yang bersumber dari engine dan menolak angka/klaim buatan AI', () => {
    expect(validateSelection(valid, report)).toEqual(valid)
    for (const value of [
      null,
      { ...valid, expense: 90000 },
      { ...valid, findings: ['Saldo Rp9999999'] },
      { ...valid, recommendations: [] },
      { ...valid, findings: ['projection-risk'] },
    ])
      expect(() => validateSelection(value, report)).toThrow()
  })
  it('cache menghindari permintaan ulang, termasuk saat offline dan kuota tidak disentuh', async () => {
    const options = base()
    const first = await requestInsights(options)
    expect(first.cached).toBe(false)
    expect((await requestInsights({ ...options, online: false })).cached).toBe(true)
    expect(options.generate).toHaveBeenCalledTimes(1)
    expect(cachedSelection(options.cache, 'test', report)).toEqual(valid)
  })
  it('fingerprint berubah karena periode, pertanyaan, angka, model atau akun; stabil untuk input sama', async () => {
    const key = await analysisKey('uidA', 'modelA', '{"expense":10}')
    expect(await analysisKey('uidA', 'modelA', '{"expense":10}')).toBe(key)
    for (const [scope, model, payload] of [
      ['uidB', 'modelA', '{"expense":10}'],
      ['uidA', 'modelB', '{"expense":10}'],
      ['uidA', 'modelA', '{"expense":11}'],
      ['uidA', 'modelA', '{"expense":10,"question":"budget"}'],
    ])
      expect(await analysisKey(scope, model, payload)).not.toBe(key)
  })
  it('gagal jaringan hanya dipanggil sekali; kegagalan tetap dihitung untuk cooldown', async () => {
    const options = base()
    options.generate.mockRejectedValue(new Error('network'))
    await expect(requestInsights(options)).rejects.toThrow('network')
    await expect(requestInsights(options)).rejects.toThrow('Tunggu')
    expect(options.generate).toHaveBeenCalledTimes(1)
  })
  it('batas harian lima permintaan dan reset hari berikutnya, jam mundur tidak melewati cooldown', () => {
    const quota = storage(),
      now = base().now
    reserveRequest(quota, now)
    expect(() => reserveRequest(quota, now - 1000)).toThrow('Tunggu')
    for (let i = 1; i < 5; i++) reserveRequest(quota, now + i * 60000)
    expect(() => reserveRequest(quota, now + 5 * 60000)).toThrow('Batas')
    expect(() => reserveRequest(quota, now + 86400000)).not.toThrow()
  })
  it('offline, payload berlebih, dan abort tidak mengirim data', async () => {
    const options = base()
    await expect(requestInsights({ ...options, online: false })).rejects.toThrow('offline')
    await expect(requestInsights({ ...options, payload: 'a'.repeat(24001) })).rejects.toThrow(
      'terlalu besar',
    )
    const controller = new AbortController()
    controller.abort()
    await expect(requestInsights({ ...options, signal: controller.signal })).rejects.toThrow()
    expect(options.generate).not.toHaveBeenCalled()
  })
  it('respons yang selesai setelah ganti akun/periode tidak disimpan', async () => {
    const controller = new AbortController(),
      options = base()
    options.generate.mockImplementation(async () => {
      controller.abort()
      return valid
    })
    await expect(requestInsights({ ...options, signal: controller.signal })).rejects.toThrow()
    expect(options.cache.getItem('test')).toBeNull()
  })
  it('storage gagal menolak request baru dan error provider tidak mengekspos payload', async () => {
    const options = base()
    options.quota.setItem = () => {
      throw new Error('storage failed')
    }
    await expect(requestInsights(options)).rejects.toThrow('Penyimpanan')
    expect(options.generate).not.toHaveBeenCalled()
    expect(aiErrorMessage({ code: 'ai/429', message: 'secret' })).toContain('Kuota gratis')
    expect(aiErrorMessage(new Error('API key: SECRET'))).not.toContain('SECRET')
    expect(aiErrorMessage({ code: 'ai/404' })).toContain('tidak tersedia')
  })
  it('AI opt-in membutuhkan konfigurasi, konfirmasi gratis, model eksplisit dan App Check', () => {
    const env = {
      VITE_FIREBASE_AI_ENABLED: 'true',
      VITE_FIREBASE_AI_FREE_TIER_CONFIRMED: 'true',
      VITE_FIREBASE_AI_MODEL: 'gemini-test-flash',
      VITE_FIREBASE_APP_CHECK_SITE_KEY: 'public-test-site-key',
    }
    expect(readAIConfiguration({}, true).ready).toBe(false)
    expect(readAIConfiguration(env, true).ready).toBe(true)
    for (const name of Object.keys(env))
      expect(readAIConfiguration({ ...env, [name]: '' }, true).ready).toBe(false)
    expect(readAIConfiguration(env, false).ready).toBe(false)
    expect(readAIConfiguration(env, true, true).ready).toBe(false)
  })
})
