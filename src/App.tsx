import { lazy, Suspense, useEffect, useState } from 'react'
import {
  BellRing,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Leaf,
  Plus,
  Settings as SettingsIcon,
  ShieldCheck,
  WifiOff,
  X,
} from 'lucide-react'
import type { Page, Transaction } from './types'
import {
  currentMonth,
  cutoffFor,
  dateLabel,
  money,
  shiftMonth,
  upsertTransaction,
} from './lib/finance'
import { useBudgetData } from './hooks/useBudgetData'
import { usePWA } from './hooks/usePWA'
import { Modal, Navigation, navItems } from './components/UI'
import { BudgetForm, TransactionForm } from './components/Forms'
import { SyncBadge } from './components/Cloud'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Budgets = lazy(() => import('./pages/Budgets'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Settings = lazy(() => import('./pages/Settings'))

const validPages: Page[] = ['dashboard', 'transactions', 'budgets', 'analytics', 'settings']
const getPage = (): Page =>
  validPages.includes(location.hash.slice(1) as Page)
    ? (location.hash.slice(1) as Page)
    : 'dashboard'
interface Confirmation {
  title: string
  message: string
  action: () => void
  danger: boolean
}
export default function App() {
  const { data, update, replace, error, blocked, cloud } = useBudgetData(),
    pwa = usePWA()
  const [page, setPage] = useState<Page>(getPage),
    [month, setMonth] = useState(currentMonth),
    [cutoff, setCutoff] = useState(() => cutoffFor(currentMonth()))
  const [transactionModal, setTransactionModal] = useState(false),
    [editing, setEditing] = useState<Transaction | undefined>(),
    [budgetModal, setBudgetModal] = useState(false),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null),
    [toast, setToast] = useState('')
  const notify = (message: string) => setToast(message)
  const navigate = (next: Page) => {
    setPage(next)
    location.hash = next
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const selectMonth = (next: string) => {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(next) && next >= '1900-01' && next <= '2100-12') {
      setMonth(next)
      setCutoff(cutoffFor(next))
    }
  }
  const add = () => {
    setEditing(undefined)
    setTransactionModal(true)
  }
  const edit = (t: Transaction) => {
    setEditing(t)
    setTransactionModal(true)
  }
  const confirm = (title: string, message: string, action: () => void, danger = false) =>
    setConfirmation({ title, message, action, danger })
  const remove = (t: Transaction) =>
    confirm(
      'Hapus transaksi?',
      `${t.note || data.categories.find((c) => c.id === t.categoryId)?.name} — ${money(t.amount)} pada ${dateLabel(t.date)} akan dihapus. Saldo dan penggunaan anggaran akan dihitung ulang.`,
      () => {
        try {
          update({ ...data, transactions: data.transactions.filter((item) => item.id !== t.id) })
          notify('Transaksi berhasil dihapus.')
        } catch (e) {
          notify(e instanceof Error ? e.message : 'Transaksi gagal dihapus.')
        }
      },
      true,
    )
  useEffect(() => {
    document.documentElement.classList.toggle('dark', data.theme === 'dark')
    document.documentElement.style.colorScheme = data.theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', data.theme === 'dark' ? '#122922' : '#154c43')
  }, [data.theme])
  useEffect(() => {
    const fn = () => setPage(getPage())
    window.addEventListener('hashchange', fn)
    return () => window.removeEventListener('hashchange', fn)
  }, [])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 5000)
    return () => clearTimeout(id)
  }, [toast])
  const title = page === 'settings' ? 'Pengaturan' : navItems.find((n) => n.id === page)?.label
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Lewati ke konten
      </a>
      <Navigation
        page={page}
        onPage={navigate}
        name={data.name}
        dark={data.theme === 'dark'}
        onTheme={() => {
          try {
            update({ ...data, theme: data.theme === 'dark' ? 'light' : 'dark' })
          } catch {
            notify('Tema tidak dapat disimpan.')
          }
        }}
      />
      <div className="main-shell">
        <header className="topbar">
          <div className="desktop-breadcrumb">
            My space <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <a
            className="mobile-brand"
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault()
              navigate('dashboard')
            }}
          >
            <img src="/icon.svg" alt="" />
            MyBudget<span>.</span>
          </a>
          <div className="topbar-right">
            <SyncBadge onClick={() => navigate('settings')} />
            <span className="today-label">
              {new Intl.DateTimeFormat('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(new Date())}
            </span>
            <span className="topbar-separator" />
            <button
              className="icon-button settings-top"
              aria-label="Buka pengaturan"
              onClick={() => navigate('settings')}
              aria-current={page === 'settings' ? 'page' : undefined}
            >
              <SettingsIcon size={20} />
            </button>
            <button
              className="avatar top-avatar"
              aria-label="Buka profil dan pengaturan"
              onClick={() => navigate('settings')}
            >
              {(data.name || 'K').slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <main id="main-content" className="main-content">
          <div className="workspace-toolbar">
            <div className="greeting">
              <span className="greeting-icon">
                <Leaf size={17} />
              </span>
              <span>
                {new Date().getHours() < 11
                  ? 'Selamat pagi'
                  : new Date().getHours() < 15
                    ? 'Selamat siang'
                    : new Date().getHours() < 18
                      ? 'Selamat sore'
                      : 'Selamat malam'}
                {data.name ? `, ${data.name}` : ''}
                <span className="greeting-wave"> ✨</span>
              </span>
            </div>
            <div className="toolbar-actions">
              {page !== 'settings' && (
                <div className="month-picker">
                  <button
                    className="icon-button"
                    aria-label="Bulan sebelumnya"
                    disabled={month <= '1900-01'}
                    onClick={() => selectMonth(shiftMonth(month, -1))}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <label>
                    <CalendarDays size={15} />
                    <input
                      aria-label="Bulan terpilih"
                      type="month"
                      min="1900-01"
                      max="2100-12"
                      value={month}
                      onChange={(e) => selectMonth(e.target.value)}
                    />
                  </label>
                  <button
                    className="icon-button"
                    aria-label="Bulan berikutnya"
                    disabled={month >= '2100-12'}
                    onClick={() => selectMonth(shiftMonth(month, 1))}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
              <button className="button button-primary desktop-add" onClick={add}>
                <Plus size={17} />
                Tambah transaksi
              </button>
            </div>
          </div>
          {error && (
            <div role="alert" className="status-banner error-banner">
              {error}
              <button className="text-button" onClick={() => navigate('settings')}>
                Pengaturan
              </button>
            </div>
          )}
          {(!pwa.online || pwa.swError) && (
            <div role="status" className="status-banner">
              <WifiOff size={17} />
              {!pwa.online
                ? 'Kamu sedang offline. Transaksi tetap dapat dicatat di perangkat ini.'
                : pwa.swError}
            </div>
          )}
          {pwa.needRefresh && (
            <div className="status-banner update-banner">
              <BellRing size={18} />
              <span>Versi baru MyBudget tersedia. Data tersimpan tetap aman.</span>
              <button
                className="text-button"
                onClick={() =>
                  confirm(
                    'Perbarui MyBudget?',
                    'Aplikasi akan dimuat ulang. Pastikan transaksi yang sedang kamu isi sudah disimpan.',
                    () => void pwa.updateServiceWorker(true),
                  )
                }
              >
                Perbarui
              </button>
            </div>
          )}
          <Suspense
            fallback={
              <div className="loading-state" role="status">
                Menyiapkan ruang keuanganmu…
              </div>
            }
          >
            {page === 'dashboard' && (
              <Dashboard
                data={data}
                month={month}
                cutoff={cutoff}
                onCutoff={setCutoff}
                onPage={navigate}
                onAdd={add}
                onEdit={edit}
                onDelete={remove}
              />
            )}
            {page === 'transactions' && (
              <Transactions data={data} month={month} onAdd={add} onEdit={edit} onDelete={remove} />
            )}
            {page === 'budgets' && (
              <Budgets data={data} month={month} onEdit={() => setBudgetModal(true)} />
            )}
            {page === 'analytics' && <Analytics data={data} month={month} />}
            {page === 'settings' && (
              <Settings
                key={`${data.version}-${blocked}`}
                data={data}
                update={update}
                replace={replace}
                notify={notify}
                confirm={confirm}
                pwa={pwa}
                blocked={blocked}
              />
            )}
          </Suspense>
          <footer className="app-footer">
            <span>
              MyBudget<span className="brand-dot">.</span> <span>Ruang untuk rencana besarmu.</span>
            </span>
            <span>
              <ShieldCheck size={13} />
              {cloud.user ? 'Cloud pribadi • UID terpisah' : 'Privat di perangkatmu'}
            </span>
          </footer>
        </main>
      </div>
      <button className="fab" aria-label="Tambah transaksi" onClick={add}>
        <Plus size={27} />
      </button>
      {transactionModal && (
        <Modal
          title={editing ? 'Edit transaksi' : 'Catat transaksi'}
          subtitle="Satu catatan kecil, satu langkah lebih terarah."
          onClose={() => setTransactionModal(false)}
        >
          <TransactionForm
            data={data}
            initial={editing}
            onClose={() => setTransactionModal(false)}
            onSave={(item) => {
              if (editing) {
                const current = data.transactions.find((t) => t.id === editing.id)
                if (!current)
                  throw new Error(
                    'Transaksi telah dihapus di perangkat lain. Salin catatan ini sebelum menutup form.',
                  )
                const changes = Object.fromEntries(
                  Object.entries(item).filter(
                    ([key, value]) => value !== editing[key as keyof Transaction],
                  ),
                )
                item = { ...current, ...changes }
              }
              update({ ...data, transactions: upsertTransaction(data.transactions, item) })
              setTransactionModal(false)
              if (item.date.slice(0, 7) !== month) selectMonth(item.date.slice(0, 7))
              notify(
                editing
                  ? 'Perubahan transaksi berhasil disimpan.'
                  : 'Transaksi berhasil disimpan. Selangkah lebih terarah!',
              )
            }}
          />
        </Modal>
      )}
      {budgetModal && (
        <Modal title="Atur anggaran bulanan" onClose={() => setBudgetModal(false)}>
          <BudgetForm
            data={data}
            month={month}
            onClose={() => setBudgetModal(false)}
            onSave={(budget) => {
              update({ ...data, budgets: { ...data.budgets, [month]: budget } })
              setBudgetModal(false)
              notify('Anggaran bulan ini berhasil disimpan.')
            }}
          />
        </Modal>
      )}
      {confirmation && (
        <Modal title={confirmation.title} onClose={() => setConfirmation(null)}>
          <p className="confirm-copy">{confirmation.message}</p>
          <div className="form-footer">
            <button className="button button-secondary" onClick={() => setConfirmation(null)}>
              Batal
            </button>
            <button
              className={`button ${confirmation.danger ? 'button-danger' : 'button-primary'}`}
              onClick={() => {
                confirmation.action()
                setConfirmation(null)
              }}
            >
              {confirmation.danger ? 'Ya, hapus' : 'Lanjutkan'}
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <span className="toast-icon">
            <Check size={16} />
          </span>
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Tutup notifikasi"
            onClick={() => setToast('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
