import { firebaseConfigured, useEmulators } from '../cloud/config'

export function readAIConfiguration(
  env: Record<string, unknown>,
  configured: boolean,
  emulator = false,
) {
  const model =
    typeof env.VITE_FIREBASE_AI_MODEL === 'string' ? env.VITE_FIREBASE_AI_MODEL.trim() : ''
  const siteKey =
    typeof env.VITE_FIREBASE_APP_CHECK_SITE_KEY === 'string'
      ? env.VITE_FIREBASE_APP_CHECK_SITE_KEY.trim()
      : ''
  const enabled = env.VITE_FIREBASE_AI_ENABLED === 'true'
  const confirmed = env.VITE_FIREBASE_AI_FREE_TIER_CONFIRMED === 'true'
  const reason = !enabled
    ? 'Penjelasan Gemini belum diaktifkan. Analisis otomatis tetap tersedia gratis dan offline.'
    : !configured
      ? 'Konfigurasi Firebase belum lengkap.'
      : emulator
        ? 'Gemini tidak dipanggil dari lingkungan emulator.'
        : !confirmed
          ? 'Pemilik aplikasi perlu memastikan Spark dan model Gemini Developer API masih mendukung Free Tier.'
          : !/^gemini-[a-z0-9.-]+$/.test(model)
            ? 'Model gratis yang masih didukung belum dipilih dalam konfigurasi aplikasi.'
            : !siteKey
              ? 'Perlindungan Firebase App Check belum dikonfigurasi.'
              : ''
  return { model, siteKey, ready: !reason, reason }
}
export const aiConfiguration = readAIConfiguration(
  import.meta.env,
  firebaseConfigured,
  useEmulators,
)
