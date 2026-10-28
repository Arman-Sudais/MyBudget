import { localDate } from '../lib/finance'
import type { InsightReport } from './engine'
import { validateSelection } from './protocol'
import type { AISelection } from './protocol'

const CACHE_PREFIX = 'mybudget:insights:v1:'
const OWNER_KEY = 'mybudget:insights:owner:v1'
const QUOTA_KEY = 'mybudget:insights:quota:v1'
const MAX_DAILY = 5
const COOLDOWN = 60_000

export function clearInsightsCache() {
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(CACHE_PREFIX))
      .forEach((key) => sessionStorage.removeItem(key))
    sessionStorage.removeItem(OWNER_KEY)
  } catch {
    /* No persistent summary cache when storage is unavailable. */
  }
}
export function activateInsightsWorkspace(scope: string) {
  try {
    if (sessionStorage.getItem(OWNER_KEY) !== scope) clearInsightsCache()
    sessionStorage.setItem(OWNER_KEY, scope)
  } catch {
    /* Local analysis does not depend on cache availability. */
  }
}
export async function analysisKey(scope: string, model: string, payload: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify([scope, model, payload])),
  )
  return (
    CACHE_PREFIX +
    Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
  )
}
export function cachedSelection(
  storage: Storage,
  key: string,
  report: InsightReport,
): AISelection | null {
  try {
    const raw = storage.getItem(key)
    return raw ? validateSelection(JSON.parse(raw), report) : null
  } catch {
    return null
  }
}
export function reserveRequest(storage: Storage, now = Date.now()) {
  const day = localDate(new Date(now))
  let quota: { day: string; count: number; last: number } = { day, count: 0, last: 0 }
  try {
    const raw = storage.getItem(QUOTA_KEY)
    if (raw) {
      const previous = JSON.parse(raw)
      if (
        !Number.isSafeInteger(previous.count) ||
        previous.count < 0 ||
        typeof previous.last !== 'number' ||
        !Number.isFinite(previous.last)
      )
        throw new Error()
      // Do not bypass cooldown across midnight or by rolling the clock backwards.
      quota = { day, count: previous.day === day ? previous.count : 0, last: previous.last }
    }
    if (quota.last && now - quota.last < COOLDOWN)
      throw new Error('Tunggu setidaknya satu menit sebelum meminta penjelasan AI lagi.')
    if (quota.count >= MAX_DAILY)
      throw new Error(
        'Batas lima permintaan AI per perangkat hari ini tercapai. Gunakan analisis otomatis.',
      )
    storage.setItem(QUOTA_KEY, JSON.stringify({ day, count: quota.count + 1, last: now }))
  } catch (e) {
    if (e instanceof Error && /^(Tunggu|Batas)/.test(e.message)) throw e
    throw new Error(
      'Penyimpanan pembatas kuota tidak tersedia. Analisis otomatis tetap dapat digunakan.',
    )
  }
}

export async function requestInsights(options: {
  key: string
  payload: string
  report: InsightReport
  cache: Storage
  quota: Storage
  signal: AbortSignal
  generate: (payload: string, signal: AbortSignal) => Promise<unknown>
  online?: boolean
  now?: number
}): Promise<{ selection: AISelection; cached: boolean }> {
  const execute = async () => {
    options.signal.throwIfAborted()
    const saved = cachedSelection(options.cache, options.key, options.report)
    if (saved) return { selection: saved, cached: true }
    if (options.online === false)
      throw new Error(
        'Perangkat offline. Analisis otomatis tetap tersedia; coba Gemini setelah tersambung.',
      )
    if (options.payload.length > 24_000)
      throw new Error('Ringkasan terlalu besar untuk kuota hemat AI. Gunakan analisis otomatis.')
    reserveRequest(options.quota, options.now)
    const transport = new AbortController()
    const cancel = () => transport.abort(options.signal.reason)
    options.signal.addEventListener('abort', cancel, { once: true })
    const timeout = setTimeout(() => transport.abort(new Error('AI request timeout')), 35_000)
    let value: unknown
    try {
      value = await Promise.race([
        options.generate(options.payload, transport.signal),
        new Promise<never>((_, reject) => {
          if (transport.signal.aborted) reject(transport.signal.reason)
          else
            transport.signal.addEventListener('abort', () => reject(transport.signal.reason), {
              once: true,
            })
        }),
      ])
    } finally {
      clearTimeout(timeout)
      options.signal.removeEventListener('abort', cancel)
    }
    options.signal.throwIfAborted()
    const selection = validateSelection(value, options.report)
    try {
      const keys = Object.keys(options.cache).filter((key) => key.startsWith(CACHE_PREFIX))
      while (keys.length >= 20) options.cache.removeItem(keys.shift()!)
      options.cache.setItem(options.key, JSON.stringify(selection))
    } catch {
      throw new Error(
        'Hasil AI tidak dapat disimpan; gunakan analisis otomatis agar kuota tidak dipanggil berulang.',
      )
    }
    return { selection, cached: false }
  }
  // Serializes quota reservations across tabs. No automatic retries or background calls.
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('mybudget-ai-request', { signal: options.signal }, execute)
    : execute()
}

export function aiErrorMessage(error: unknown) {
  const code = String((error as { code?: unknown })?.code ?? '')
  const message = error instanceof Error ? error.message : ''
  if (/429|quota|resource-exhausted|too-many-requests/i.test(code + message))
    return 'Kuota gratis Gemini sedang dibatasi atau habis. Tidak ada percobaan ulang otomatis; analisis otomatis tetap tersedia.'
  if (/403|app-check|appcheck|permission-denied/i.test(code + message))
    return 'Akses AI atau App Check belum diizinkan. Pemilik aplikasi perlu memeriksa konfigurasi Firebase.'
  if (/404|not-found|not supported/i.test(code + message))
    return 'Model Gemini tidak tersedia. Periksa model Free Tier yang masih didukung; aplikasi tidak mengganti ke model berbayar.'
  if (/network|fetch|timeout|deadline/i.test(code + message))
    return 'Koneksi AI gagal atau terlalu lama. Analisis otomatis tetap tersedia; coba lagi nanti.'
  // Never display provider payloads, tokens, or raw response text.
  return /^(Tunggu|Batas|Perangkat|Ringkasan|Penyimpanan|Hasil AI|Format penjelasan|AI mengembalikan|Temuan AI)/.test(
    message,
  )
    ? message
    : 'Penjelasan AI belum tersedia. Analisis otomatis tetap digunakan tanpa mengubah data.'
}
