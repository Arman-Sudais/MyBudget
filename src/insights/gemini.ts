import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai'
import { getToken, initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { app } from '../cloud/firebase'
import { aiConfiguration } from './config'
import { systemInstruction } from './protocol'

let appCheck: ReturnType<typeof initializeAppCheck> | undefined
export async function generateInsights(payload: string, signal: AbortSignal) {
  signal.throwIfAborted()
  if (!aiConfiguration.ready) throw new Error(aiConfiguration.reason)
  // No debug token or Gemini key in frontend. No AI/App Check network until consent.
  appCheck ??= initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(aiConfiguration.siteKey),
    isTokenAutoRefreshEnabled: true,
  })
  await getToken(appCheck)
  signal.throwIfAborted()
  const ai = getAI(app, { backend: new GoogleAIBackend() })
  const model = getGenerativeModel(
    ai,
    {
      model: aiConfiguration.model,
      systemInstruction,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema: Schema.object({
          properties: {
            findings: Schema.array({ items: Schema.string(), minItems: 1, maxItems: 5 }),
            recommendations: Schema.array({ items: Schema.string(), minItems: 1, maxItems: 5 }),
          },
        }),
      },
    },
    { timeout: 25_000 },
  )
  const result = await model.generateContent(payload, { signal })
  signal.throwIfAborted()
  return JSON.parse(result.response.text()) as unknown
}
