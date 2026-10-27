import { useEffect, useState } from 'react'
import type { AppData } from '../types'
import { initialData } from '../lib/finance'
import { parseBackup } from '../lib/data'

export const STORAGE_KEY = 'mybudget:v1'
export function useBudgetData() {
  const [loaded] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return { data: raw ? parseBackup(raw) : initialData(), error: '' }
    } catch {
      return {
        data: initialData(),
        error:
          'Data tersimpan tidak dapat dibaca. Data asli belum ditimpa. Unduh salinan pemulihan di Pengaturan sebelum mengganti data.',
      }
    }
  })
  const [data, setData] = useState<AppData>(loaded.data)
  const [error, setError] = useState(loaded.error)
  const [blocked, setBlocked] = useState(!!loaded.error)
  const update = (next: AppData) => {
    if (blocked)
      throw new Error(
        'Pulihkan atau hapus data rusak melalui Pengaturan sebelum menyimpan perubahan.',
      )
    try {
      const safe = parseBackup(JSON.stringify(next))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safe))
      setData(safe)
      setError('')
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Penyimpanan penuh atau tidak tersedia. Ekspor data Anda.'
      setError(message)
      throw new Error(message)
    }
  }
  const replace = (next: AppData) => {
    const safe = parseBackup(JSON.stringify(next))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe))
    setData(safe)
    setBlocked(false)
    setError('')
  }
  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      try {
        setData(event.newValue ? parseBackup(event.newValue) : initialData())
        setError('')
        setBlocked(false)
      } catch {
        setError('Perubahan data di tab lain tidak valid. Salin data pemulihan melalui Pengaturan.')
        setBlocked(true)
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])
  return { data, update, replace, error, blocked }
}
