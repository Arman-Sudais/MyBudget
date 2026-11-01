import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  initialize: vi.fn().mockReturnValue({}),
  token: vi.fn().mockResolvedValue({ token: 'test-token' }),
  getAI: vi.fn().mockReturnValue({}),
  getModel: vi.fn(),
  generate: vi.fn(),
  configuration: {
    ready: true,
    reason: '',
    model: 'gemini-test-flash',
    siteKey: 'public-test-key',
  },
}))
vi.mock('../cloud/firebase', () => ({ app: { name: 'test-only' } }))
vi.mock('./config', () => ({ aiConfiguration: mocks.configuration }))
vi.mock('firebase/app-check', () => ({
  initializeAppCheck: mocks.initialize,
  getToken: mocks.token,
  ReCaptchaV3Provider: class {},
}))
vi.mock('firebase/ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/ai')>()),
  getAI: mocks.getAI,
  getGenerativeModel: mocks.getModel,
}))
import { generateInsights } from './gemini'

describe('Firebase AI Logic transport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.configuration.ready = true
    mocks.getModel.mockReturnValue({ generateContent: mocks.generate })
    mocks.token.mockResolvedValue({ token: 'test-token' })
    mocks.generate.mockResolvedValue({
      response: { text: () => '{"findings":["totals"],"recommendations":["record"]}' },
    })
  })
  it('tidak melakukan panggilan saat modul diimpor atau AI nonaktif', async () => {
    expect(mocks.getAI).not.toHaveBeenCalled()
    expect(mocks.initialize).not.toHaveBeenCalled()
    mocks.configuration.ready = false
    await expect(generateInsights('{}', new AbortController().signal)).rejects.toThrow()
    expect(mocks.generate).not.toHaveBeenCalled()
    expect(mocks.initialize).not.toHaveBeenCalled()
  })
  it('App Check wajib berhasil sebelum Gemini; tidak beralih provider atau model saat gagal', async () => {
    mocks.token.mockRejectedValueOnce(new Error('app-check failed'))
    await expect(generateInsights('{}', new AbortController().signal)).rejects.toThrow('app-check')
    expect(mocks.getModel).not.toHaveBeenCalled()
    expect(mocks.generate).not.toHaveBeenCalled()
  })
  it('hanya menggunakan GoogleAIBackend, schema terbatas, model eksplisit dan satu request ber-timeout', async () => {
    const signal = new AbortController().signal
    expect(await generateInsights('{"expense":100}', signal)).toEqual({
      findings: ['totals'],
      recommendations: ['record'],
    })
    expect(mocks.getAI.mock.calls[0][1].backend.constructor.name).toBe('GoogleAIBackend')
    expect(mocks.getModel.mock.calls[0][1]).toMatchObject({
      model: 'gemini-test-flash',
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1024 },
    })
    expect(mocks.getModel.mock.calls[0][2]).toEqual({ timeout: 25000 })
    expect(mocks.generate).toHaveBeenCalledExactlyOnceWith('{"expense":100}', { signal })
  })
})
