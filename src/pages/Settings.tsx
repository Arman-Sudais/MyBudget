import { useRef, useState } from 'react'
import {
  Download,
  FileJson,
  HardDrive,
  Info,
  MonitorSmartphone,
  Moon,
  Plus,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react'
import type { AppData, TransactionType } from '../types'
import { downloadFile, parseBackup, transactionsCsv } from '../lib/data'
import { initialData, localDate } from '../lib/finance'
import { STORAGE_KEY } from '../hooks/useBudgetData'
import { CategoryIcon, PanelHeader } from '../components/UI'
import type { usePWA } from '../hooks/usePWA'
import { CloudPanel } from '../components/Cloud'
import { useBudgetData } from '../hooks/useBudgetData'

type Confirm = (title: string, message: string, action: () => void, danger?: boolean) => void
export default function Settings({
  data,
  update,
  replace,
  notify,
  confirm,
  pwa,
  blocked,
}: {
  data: AppData
  update: (d: AppData) => void
  replace: (d: AppData) => void
  notify: (s: string) => void
  confirm: Confirm
  pwa: ReturnType<typeof usePWA>
  blocked: boolean
}) {
  const { cloud } = useBudgetData()
  const [name, setName] = useState(data.name),
    [categoryName, setCategoryName] = useState(''),
    [categoryType, setCategoryType] = useState<TransactionType>('expense'),
    [color, setColor] = useState('#5f9c81'),
    [icon, setIcon] = useState('grid'),
    [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const attempt = (action: () => void) => {
    try {
      action()
      setError('')
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Perubahan tidak dapat disimpan. Periksa ruang penyimpanan perangkat.',
      )
      notify('Perubahan gagal disimpan. Lihat pesan di Pengaturan.')
    }
  }
  const backup = () =>
    downloadFile(
      JSON.stringify(data, null, 2),
      `MyBudget-backup-${localDate()}.json`,
      'application/json',
    )
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">RUANG PRIBADIMU</span>
          <h1>Pengaturan</h1>
          <p>Atur kenyamananmu dan jaga data keuanganmu tetap aman.</p>
        </div>
        <span className="date-chip">
          <ShieldCheck size={17} />
          {cloud.user ? 'Akun pribadi. Data terpisah.' : 'Mode lokal. Akun opsional.'}
        </span>
      </div>
      <CloudPanel />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {blocked && (
        <div className="info-callout">
          <Info size={22} />
          <div>
            <strong>Data lama belum ditimpa.</strong>
            <p>
              Unduh salinan mentah untuk pemulihan, lalu pulihkan backup valid atau hapus data untuk
              memulai ulang.
            </p>
            <button
              className="button button-secondary button-small"
              onClick={() =>
                attempt(() => {
                  const raw = localStorage.getItem(STORAGE_KEY)
                  if (raw) downloadFile(raw, `MyBudget-pemulihan-${localDate()}.txt`, 'text/plain')
                })
              }
            >
              Unduh data pemulihan
            </button>
          </div>
        </div>
      )}
      <div className="settings-grid">
        <section className="panel settings-panel">
          <PanelHeader
            title="Buat lebih personal"
            subtitle="Sedikit sentuhan untuk ruang keuanganmu"
          />
          <form
            onSubmit={(e) => {
              e.preventDefault()
              attempt(() => {
                update({ ...data, name: name.trim() })
                notify('Nama berhasil disimpan.')
              })
            }}
          >
            <label className="field">
              Nama panggilan
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="Kamu ingin dipanggil siapa?"
              />
            </label>
            <button type="submit" className="button button-primary button-small">
              Simpan nama
            </button>
          </form>
          <div className="setting-divider" />
          <div className="setting-row">
            <div className="setting-icon">
              <Moon size={20} />
            </div>
            <div>
              <strong>Tampilan aplikasi</strong>
              <small>Pilih suasana yang nyaman untukmu.</small>
            </div>
            <button
              className="theme-switch"
              aria-label="Ganti tema"
              aria-pressed={data.theme === 'dark'}
              onClick={() =>
                attempt(() => {
                  update({ ...data, theme: data.theme === 'dark' ? 'light' : 'dark' })
                  notify('Tema diperbarui.')
                })
              }
            >
              {data.theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
              <span>{data.theme === 'dark' ? 'Gelap' : 'Terang'}</span>
            </button>
          </div>
        </section>
        <section className="panel settings-panel">
          <PanelHeader
            title="MyBudget di genggamanmu"
            subtitle="Pasang di Android, tanpa Play Store"
          />
          <div className="install-intro">
            <img src="/icon.svg" alt="Ikon MyBudget" />
            <div>
              <strong>MyBudget</strong>
              <small>Dompet lebih tertata. Pikiran lebih lega.</small>
              <span className="private-label">
                <span />
                {pwa.offlineReady
                  ? 'Siap digunakan offline'
                  : import.meta.env.DEV
                    ? 'Mode pengembangan · PWA aktif di build'
                    : pwa.swError
                      ? 'Offline belum tersedia'
                      : 'Menyiapkan cache offline'}
              </span>
            </div>
          </div>
          {pwa.installed ? (
            <div className="info-callout">
              <Smartphone size={20} />
              <p>MyBudget sudah dibuka sebagai aplikasi terpasang.</p>
            </div>
          ) : (
            <>
              <button
                className="button button-primary"
                onClick={() => {
                  if (pwa.canInstall)
                    void pwa
                      .install()
                      .catch(() =>
                        notify('Instalasi belum berhasil. Coba menu Chrome → Instal aplikasi.'),
                      )
                  else notify('Di Chrome Android: buka menu ⋮ → Tambahkan ke layar utama → Instal.')
                }}
              >
                <Download size={17} />
                {pwa.canInstall ? 'Install App' : 'Cara instal aplikasi'}
              </button>
              <ol className="install-steps">
                <li>Buka alamat HTTPS MyBudget di Chrome Android.</li>
                <li>
                  Ketuk <strong>Install App</strong> atau menu{' '}
                  <strong>⋮ → Tambahkan ke layar utama → Instal</strong>.
                </li>
                <li>
                  Buka MyBudget dari layar utama. Setelah cache siap, catat transaksi tanpa
                  internet.
                </li>
              </ol>
            </>
          )}
          <p className="footnote">
            Ikon dan layar pembuka disediakan Android dari manifest aplikasi. Instalasi membutuhkan
            HTTPS atau localhost.
          </p>
        </section>
        <section className="panel settings-panel">
          <PanelHeader
            title="Data milikmu, kendali di tanganmu"
            subtitle="Backup rutin untuk menjaga semua catatan"
          />
          <div className="setting-row">
            <span className="setting-icon">
              <FileJson size={20} />
            </span>
            <div>
              <strong>Backup & restore JSON</strong>
              <small>Termasuk transaksi, kategori, anggaran, dan preferensi.</small>
            </div>
          </div>
          <div className="settings-actions">
            <button className="button button-secondary" disabled={blocked} onClick={backup}>
              <Download size={16} />
              Backup JSON
            </button>
            <button className="button button-secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={16} />
              Restore JSON
            </button>
            <button
              className="button button-secondary"
              disabled={blocked}
              onClick={() =>
                downloadFile(
                  transactionsCsv(data),
                  `MyBudget-semua-transaksi-${localDate()}.csv`,
                  'text/csv;charset=utf-8',
                )
              }
            >
              <Download size={16} />
              Ekspor semua CSV
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Pilih file backup JSON"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              try {
                if (file.size > 10_000_000) throw new Error('File terlalu besar (maksimal 10 MB).')
                const imported = parseBackup(await file.text())
                setError('')
                confirm(
                  'Pulihkan backup?',
                  `${imported.transactions.length} transaksi dan seluruh kategori, anggaran, serta preferensi dari backup akan menggantikan data saat ini. Unduh backup saat ini terlebih dahulu jika diperlukan.`,
                  () =>
                    attempt(() => {
                      replace(imported)
                      setName(imported.name)
                      notify('Backup berhasil dipulihkan.')
                    }),
                )
              } catch (e) {
                setError(e instanceof Error ? e.message : 'File tidak dapat dibaca.')
              }
            }}
          />
          <div className="privacy-note">
            <HardDrive size={19} />
            <p>
              {cloud.user
                ? 'Backup ini berisi data akun cloud yang sedang ditampilkan, termasuk perubahan tertunda yang terlihat. Restore akan mengubah akun cloud setelah konfirmasi dan dikirim saat online. Salinan lokal lama tetap terpisah.'
                : 'Data mode lokal disimpan di localStorage browser ini. Menghapus data browser atau memakai mode samaran dapat menghilangkan catatan.'}{' '}
              Backup JSON secara rutin; file ini berisi informasi keuangan pribadi.
            </p>
          </div>
        </section>
        <section className="panel settings-panel">
          <PanelHeader title="Tentang MyBudget" subtitle="Teman kecil untuk rencana besarmu" />
          <div className="about-brand">
            <img src="/icon.svg" alt="" />
            <div>
              <strong>MyBudget</strong>
              <small>Versi 1.0.0 · Personal budgeting</small>
            </div>
          </div>
          <p className="about-copy">
            Dibuat untuk membantu kamu mengelola uang saku, pengeluaran harian, dan anggaran
            bulanan. Tanpa iklan, dengan login Google opsional untuk sinkronisasi.
          </p>
          <div className="about-features">
            <span>
              <MonitorSmartphone size={17} />
              Mobile-first
            </span>
            <span>
              <ShieldCheck size={17} />
              Data lokal
            </span>
            <span>
              <HardDrive size={17} />
              Offline-ready
            </span>
          </div>
        </section>
      </div>
      <section className="panel settings-panel categories-panel">
        <PanelHeader
          title="Kategori transaksi"
          subtitle="Kategori yang sesuai dengan keseharianmu"
        />
        <form
          className="category-form"
          onSubmit={(e) => {
            e.preventDefault()
            const clean = categoryName.trim()
            if (!clean) return setError('Nama kategori tidak boleh kosong.')
            if (
              data.categories.some(
                (c) =>
                  c.name.toLocaleLowerCase('id') === clean.toLocaleLowerCase('id') &&
                  c.type === categoryType,
              )
            )
              return setError('Kategori dengan nama dan jenis ini sudah ada.')
            attempt(() => {
              update({
                ...data,
                categories: [
                  ...data.categories,
                  { id: crypto.randomUUID(), name: clean, type: categoryType, icon, color },
                ],
              })
              setCategoryName('')
              notify('Kategori berhasil ditambahkan.')
            })
          }}
        >
          <label className="field">
            Nama kategori
            <input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              maxLength={50}
              placeholder="Misalnya: Kebutuhan kos"
              required
            />
          </label>
          <label className="field">
            Jenis
            <select
              value={categoryType}
              onChange={(e) => setCategoryType(e.target.value as TransactionType)}
            >
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
            </select>
          </label>
          <label className="field">
            Ikon
            <select value={icon} onChange={(e) => setIcon(e.target.value)}>
              <option value="grid">Kategori</option>
              <option value="wallet">Dompet</option>
              <option value="food">Makanan</option>
              <option value="book">Pendidikan</option>
              <option value="gift">Hadiah</option>
              <option value="heart">Kesehatan</option>
              <option value="car">Transportasi</option>
              <option value="shopping">Belanja</option>
            </select>
          </label>
          <label className="field color-field">
            Warna
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
          <button className="button button-primary" type="submit">
            <Plus size={17} />
            Tambah kategori
          </button>
        </form>
        <div className="category-chips">
          {data.categories.map((c) => (
            <span key={c.id}>
              <CategoryIcon category={c} />
              <span>
                <strong>{c.name}</strong>
                <small>{c.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</small>
              </span>
            </span>
          ))}
        </div>
      </section>
      <section className="panel danger-zone">
        <div>
          <h2>{cloud.user ? 'Hapus data akun cloud' : 'Hapus seluruh data'}</h2>
          <p>
            Hapus semua transaksi dan anggaran. Kategori kembali ke bawaan.
            {cloud.user &&
              ' Perubahan berlaku pada semua perangkat akun ini; salinan lokal lama tetap ada.'}
          </p>
        </div>
        <button
          className="button button-danger"
          onClick={() =>
            confirm(
              'Hapus seluruh data?',
              cloud.user
                ? 'Transaksi, anggaran, dan kategori kustom akun cloud akan dihapus pada semua perangkat setelah sinkronisasi. Salinan lokal lama tidak dihapus. Pastikan kamu sudah memiliki backup.'
                : 'Seluruh transaksi, anggaran, dan kategori kustom akan dihapus dari browser ini. Tindakan ini tidak dapat dibatalkan. Pastikan kamu sudah memiliki backup.',
              () =>
                attempt(() => {
                  replace({ ...initialData(), theme: data.theme })
                  setName('')
                  notify('Seluruh data dihapus. Kamu bisa memulai kembali.')
                }),
              true,
            )
          }
        >
          <Trash2 size={16} />
          Hapus data
        </button>
      </section>
    </>
  )
}
