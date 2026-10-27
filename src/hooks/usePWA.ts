import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
export function usePWA() {
  const [online, setOnline] = useState(navigator.onLine)
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
  const [installed, setInstalled] = useState(
    window.matchMedia('(display-mode: standalone)').matches,
  )
  const [swError, setSwError] = useState('')
  const [cacheReady, setCacheReady] = useState(false)
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () =>
      setSwError(
        'Dukungan offline belum aktif. Buka aplikasi secara online, lalu coba muat ulang.',
      ),
    onRegisteredSW: (_url, registration) => {
      if (registration?.active && navigator.serviceWorker.controller) setCacheReady(true)
    },
  })
  useEffect(() => {
    const onOnline = () => setOnline(true),
      onOffline = () => setOnline(false)
    const prompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as InstallPrompt)
    }
    const done = () => {
      setInstalled(true)
      setInstallPrompt(null)
    }
    const controlled = () => setCacheReady(!!navigator.serviceWorker.controller)
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.addEventListener('controllerchange', controlled)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('beforeinstallprompt', prompt)
    window.addEventListener('appinstalled', done)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('beforeinstallprompt', prompt)
      window.removeEventListener('appinstalled', done)
      if ('serviceWorker' in navigator)
        navigator.serviceWorker.removeEventListener('controllerchange', controlled)
    }
  }, [])
  const install = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }
  return {
    online,
    installed,
    canInstall: !!installPrompt,
    install,
    needRefresh,
    offlineReady: offlineReady || cacheReady,
    updateServiceWorker,
    swError,
  }
}
