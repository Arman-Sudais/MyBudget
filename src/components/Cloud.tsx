import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Cloud,
  CloudCheck,
  CloudOff,
  Download,
  Info,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { useBudgetContext } from '../cloud/context'
import type { CloudControls } from '../cloud/context'
import type { MigrationChoice } from '../cloud/session'
import { hasLocalData, migrationConflicts } from '../cloud/model'
import { downloadFile } from '../lib/data'
import { localDate } from '../lib/finance'
import { Modal, PanelHeader } from './UI'

export function SyncBadge({ onClick }: { onClick: () => void }) {
  const { cloud } = useBudgetContext(),
    state = cloud.state
  const status = cloud.user ? (state?.status ?? 'Syncing') : 'Lokal'
  const Icon =
    status === 'Synced'
      ? CloudCheck
      : status === 'Offline'
        ? CloudOff
        : status === 'Sync Error'
          ? TriangleAlert
          : Cloud
  return (
    <button
      className={`sync-badge ${status === 'Sync Error' ? 'sync-error' : ''}`}
      onClick={onClick}
      aria-label={`Status sinkronisasi: ${status}${state?.pending ? `, ${state.pending} perubahan tertunda` : ''}`}
    >
      <Icon size={15} />
      <span>{status}</span>
      {!!state?.pending && <small>{state.pending}</small>}
    </button>
  )
}
export function CloudPanel() {
  const { cloud } = useBudgetContext(),
    [trusted, setTrusted] = useState(false),
    [message, setMessage] = useState(''),
    [confirm, setConfirm] = useState<'discard' | 'local' | null>(null)
  const run = async (fn: () => void | Promise<void>) => {
    setMessage('')
    try {
      await fn()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Operasi gagal.')
    }
  }
  const state = cloud.state
  return (
    <section className="panel settings-panel cloud-panel">
      <PanelHeader
        title="Satu akun, semua perangkat"
        subtitle="Sinkronisasi otomatis dengan Google & Firebase"
      />
      {!cloud.configured ? (
        <>
          <div className="info-callout">
            <Info size={20} />
            <p>
              Mode lokal tetap aktif. Sinkronisasi belum dikonfigurasi untuk deployment ini. Ikuti
              panduan Firebase pada dokumentasi proyek, lalu isi konfigurasi publik Firebase di
              Vercel dan deploy ulang.
            </p>
          </div>
          <p className="footnote">
            Login tidak memerlukan password Google atau private key di aplikasi. Data lokal tidak
            diunggah sampai kamu memilih migrasi.
          </p>
        </>
      ) : cloud.user ? (
        <>
          <div className="cloud-account">
            <span className="setting-icon">
              <ShieldCheck size={23} />
            </span>
            <div>
              <strong>{cloud.user.name || 'Akun Google'}</strong>
              <small>{cloud.user.email}</small>
              <small>
                {cloud.trusted
                  ? 'Perangkat pribadi · cache offline persisten'
                  : 'Perangkat bersama · cache sementara per tab'}
              </small>
            </div>
          </div>
          <div className="cloud-status-line">
            <strong>{state?.status ?? 'Syncing'}</strong>
            <span>{state?.pending ?? 0} perubahan tertunda</span>
            {state?.lastSynced && (
              <small>
                Terakhir:{' '}
                {new Date(state.lastSynced).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </small>
            )}
          </div>
          <p className="footnote">
            Setiap perubahan disinkronkan otomatis ke UID akun ini. Data lokal lama tetap terpisah.{' '}
            {cloud.trusted
              ? 'Cache dibersihkan saat logout berhasil.'
              : 'Antrean sementara bertahan saat refresh, tetapi tab jangan ditutup ketika masih ada perubahan tertunda.'}
          </p>
          <div className="settings-actions">
            <button
              className="button button-secondary"
              disabled={cloud.busy}
              onClick={() => void run(() => cloud.retry())}
            >
              <RefreshCw size={16} />
              Coba sinkronkan
            </button>
            <button
              className="button button-secondary"
              disabled={cloud.busy}
              onClick={() => void run(() => cloud.logout())}
            >
              <LogOut size={16} />
              Logout
            </button>
            {!!state?.error && (
              <button
                className="button button-secondary"
                disabled={cloud.busy}
                onClick={() => void run(() => cloud.reauthenticate())}
              >
                Perbarui sesi Google
              </button>
            )}
            {state?.phase === 'ready' && (
              <button
                className="button button-secondary"
                disabled={!!state.pending}
                onClick={() => setConfirm('local')}
              >
                Gabungkan data lokal
              </button>
            )}
          </div>
          {(!!state?.pending || !!state?.error) && (
            <div className="pending-actions">
              <p>
                Perubahan belum dikonfirmasi server. Antrean tidak dihapus saat koneksi gagal. Untuk
                konflik, simpan file pemulihan sebelum membatalkan perubahan.
              </p>
              <button
                className="button button-secondary button-small"
                onClick={() =>
                  void run(() =>
                    downloadFile(
                      cloud.recovery(),
                      `MyBudget-antrean-${localDate()}.json`,
                      'application/json',
                    ),
                  )
                }
              >
                <Download size={15} />
                Unduh perubahan tertunda
              </button>
              <button className="text-button text-danger" onClick={() => setConfirm('discard')}>
                Batalkan antrean dengan konfirmasi
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="cloud-intro">
            <span className="setting-icon">
              <Cloud size={25} />
            </span>
            <p>
              Catat di laptop, lihat di Android. Transaksi, kategori, dan anggaran mengikuti akun
              Google yang sama.
            </p>
          </div>
          <label className="trusted-device">
            <input
              type="checkbox"
              checked={trusted}
              onChange={(e) => setTrusted(e.target.checked)}
            />
            <span>
              Ini perangkat pribadi saya.
              <small>
                Izinkan login tetap aktif dan penyimpanan offline persisten. Jangan centang pada
                komputer umum.
              </small>
            </span>
          </label>
          <div className="settings-actions">
            <button
              className="button button-primary"
              disabled={cloud.busy}
              onClick={() => void run(() => cloud.login(trusted))}
            >
              <LogIn size={17} />
              {cloud.busy ? 'Menghubungkan…' : 'Login dengan Google'}
            </button>
            <button
              className="button button-secondary"
              disabled={cloud.busy}
              onClick={() => void run(() => cloud.login(trusted, true))}
            >
              Login lewat pengalihan
            </button>
          </div>
          <p className="footnote">
            Setelah login, kamu akan memilih data cloud atau migrasi data lokal. Tidak ada unggahan
            otomatis sebelum pilihanmu.
          </p>
        </>
      )}
      {(message || cloud.error || state?.error) && (
        <p className="form-error" role="alert">
          {message || cloud.error || state?.error}
        </p>
      )}
      {confirm === 'discard' && (
        <Modal title="Batalkan perubahan tertunda?" onClose={() => setConfirm(null)}>
          <p className="confirm-copy">
            Perubahan yang belum diterima server akan dibatalkan di semua tab untuk akun ini pada
            perangkat ini. Data yang sudah tersimpan di cloud tetap ada. Unduh perubahan tertunda
            terlebih dahulu; file ini berbeda dari backup JSON biasa.
          </p>
          <footer className="form-footer">
            <button className="button button-secondary" onClick={() => setConfirm(null)}>
              Batal
            </button>
            <button
              className="button button-danger"
              onClick={() => {
                void run(() => cloud.discard())
                setConfirm(null)
              }}
            >
              Ya, batalkan antrean
            </button>
          </footer>
        </Modal>
      )}
      {confirm === 'local' && <LocalMerge cloud={cloud} onClose={() => setConfirm(null)} />}
    </section>
  )
}
function LocalMerge({ cloud, onClose }: { cloud: CloudControls; onClose: () => void }) {
  const [priority, setPriority] = useState<'cloud' | 'local'>('cloud'),
    [error, setError] = useState('')
  return (
    <Modal title="Gabungkan data lokal perangkat ini?" onClose={onClose}>
      <p className="confirm-copy">
        Data lokal lama tetap disimpan. ID transaksi yang sama tidak digandakan. Untuk ID atau bulan
        anggaran yang bertabrakan, pilih versi yang diutamakan. Anggaran bulan yang sama mengikuti
        satu versi lengkap.
      </p>
      <label className="field">
        Jika ada konflik
        <select value={priority} onChange={(e) => setPriority(e.target.value as 'cloud' | 'local')}>
          <option value="cloud">Utamakan data cloud</option>
          <option value="local">Utamakan data lokal</option>
        </select>
      </label>
      <p className="footnote">
        {cloud.localData.transactions.length} transaksi lokal akan diperiksa. Gunakan Backup JSON
        sebelum penggabungan jika diperlukan.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <footer className="form-footer">
        <button className="button button-secondary" onClick={onClose}>
          Batal
        </button>
        <button
          className="button button-primary"
          onClick={() => {
            try {
              cloud.choose(priority === 'cloud' ? 'merge-cloud' : 'merge-local')
              onClose()
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Penggabungan gagal.')
            }
          }}
        >
          Konfirmasi gabungkan
        </button>
      </footer>
    </Modal>
  )
}
export function CloudWorkspace({ children }: { children: ReactNode }) {
  const { cloud } = useBudgetContext()
  if (cloud.loading || (cloud.user && (!cloud.state || cloud.state.phase === 'loading')))
    return (
      <div className="cloud-gate">
        <a className="brand" href="#dashboard">
          <img src="/icon.svg" alt="" />
          MyBudget.
        </a>
        <p className="cloud-loading" role="status">
          {cloud.error || cloud.state?.error
            ? 'Sesi cloud memerlukan perhatian.'
            : 'Memeriksa akun dan data cloud…'}
        </p>
        {cloud.user || cloud.error ? (
          <CloudPanel />
        ) : (
          <p className="footnote">
            Data akun sebelumnya disembunyikan saat pemeriksaan berlangsung.
          </p>
        )}
      </div>
    )
  if (cloud.user && cloud.state?.phase === 'migration') return <Migration cloud={cloud} />
  return children
}
function Migration({ cloud }: { cloud: CloudControls }) {
  const state = cloud.state!,
    remote = state.cloudData!,
    local = cloud.localData
  const [choice, setChoice] = useState<MigrationChoice | null>(null),
    [error, setError] = useState('')
  const conflicts = migrationConflicts(local, remote)
  const select = (next: MigrationChoice) => {
    setError('')
    setChoice(next)
  }
  return (
    <div className="cloud-gate migration-page">
      <a className="brand" href="#dashboard">
        <img src="/icon.svg" alt="" />
        MyBudget.
      </a>
      <section className="panel settings-panel">
        <span className="eyebrow">SELAMAT DATANG, {cloud.user?.name || 'TEMAN'}</span>
        <h1>Pilih awal sinkronisasimu</h1>
        <p className="form-description">
          Akun: {cloud.user?.email}. Data lokal lama tetap disimpan di perangkat ini. Tidak ada
          penggabungan otomatis.
        </p>
        <div className="migration-counts">
          <div>
            <small>LOKAL PERANGKAT INI</small>
            <strong>{local.transactions.length} transaksi</strong>
            <span>{Object.keys(local.budgets).length} anggaran</span>
          </div>
          <div>
            <small>AKUN CLOUD</small>
            <strong>{remote.transactions.length} transaksi</strong>
            <span>{Object.keys(remote.budgets).length} anggaran</span>
          </div>
        </div>
        {cloud.localBlocked && (
          <p className="form-error">
            Data lokal tidak dapat dibaca. Impor dinonaktifkan; salinan lama tidak dihapus. Gunakan
            mode lokal untuk mengunduh data pemulihan.
          </p>
        )}
        {state.hasCloudData && hasLocalData(local) && (
          <p className="footnote">
            ID sama dengan isi berbeda: {conflicts.transactions} transaksi, {conflicts.categories}{' '}
            kategori, {conflicts.budgets} bulan anggaran. Penggabungan tidak menggandakan ID; pilih
            versi yang diutamakan saat bentrok.
          </p>
        )}
        <div className="migration-options">
          <button className="button button-primary" onClick={() => select('cloud')}>
            {state.hasCloudData ? 'Gunakan data cloud' : 'Mulai cloud baru'}
          </button>
          {!cloud.localBlocked && (
            <button
              className="button button-secondary"
              onClick={() => select(state.hasCloudData ? 'merge-cloud' : 'local')}
            >
              {state.hasCloudData ? 'Gabungkan · utamakan cloud' : 'Impor data lokal ke cloud'}
            </button>
          )}
          {state.hasCloudData && !cloud.localBlocked && (
            <button className="button button-secondary" onClick={() => select('merge-local')}>
              Gabungkan · utamakan lokal
            </button>
          )}
        </div>
        <div className="settings-actions">
          <button
            className="text-button"
            onClick={() =>
              downloadFile(
                JSON.stringify(local, null, 2),
                `MyBudget-lokal-sebelum-migrasi-${localDate()}.json`,
                'application/json',
              )
            }
            disabled={cloud.localBlocked}
          >
            <Download size={16} />
            Backup lokal sebelum migrasi
          </button>
          <button
            className="text-button"
            onClick={() => void cloud.logout().catch((e) => setError(e.message))}
          >
            Kembali ke mode lokal
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>
      {choice && (
        <Modal title="Konfirmasi pilihan data" onClose={() => setChoice(null)}>
          <p className="confirm-copy">
            {choice === 'cloud'
              ? 'Gunakan akun cloud untuk tampilan dan perubahan berikutnya. Data lokal lama tidak dihapus.'
              : choice === 'local'
                ? 'Unggah transaksi, kategori, dan anggaran lokal ke akun cloud yang sudah diperiksa kosong. Salinan lokal tetap ada.'
                : `Gabungkan lokal dan cloud. Jika ID sama atau bulan anggaran sama memiliki isi berbeda, versi ${choice === 'merge-cloud' ? 'cloud' : 'lokal'} diutamakan. Pilihan ini dapat mengubah data cloud pada perangkat lain; salinan lokal lama tetap ada.`}
          </p>
          <footer className="form-footer">
            <button className="button button-secondary" onClick={() => setChoice(null)}>
              Batal
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                try {
                  cloud.choose(choice)
                  setChoice(null)
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Migrasi gagal.')
                  setChoice(null)
                }
              }}
            >
              Konfirmasi mulai sinkronisasi
            </button>
          </footer>
        </Modal>
      )}
    </div>
  )
}
