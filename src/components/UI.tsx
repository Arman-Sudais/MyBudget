import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  Car,
  Check,
  ChevronRight,
  CirclePlus,
  Gift,
  Grid2X2,
  HeartPulse,
  LayoutDashboard,
  Moon,
  MoreHorizontal,
  PieChart,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Utensils,
  Wallet,
  X,
  Gamepad2,
  ArrowLeftRight,
  Pencil,
  Trash2,
  Search,
  Target,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Category, Page, Transaction } from '../types'
import { budgetStatus, dateLabel, money } from '../lib/finance'

const icons: Record<string, typeof Wallet> = {
  wallet: Wallet,
  briefcase: BriefcaseBusiness,
  gift: Gift,
  plus: CirclePlus,
  food: Utensils,
  car: Car,
  shopping: ShoppingBag,
  book: BookOpen,
  game: Gamepad2,
  receipt: ReceiptText,
  heart: HeartPulse,
  grid: Grid2X2,
}
export function CategoryIcon({ category }: { category?: Category }) {
  const Icon = icons[category?.icon ?? 'grid'] ?? Grid2X2
  return (
    <span
      className="category-icon"
      style={{
        background: `${category?.color ?? '#7b9690'}18`,
        color: category?.color ?? '#7b9690',
      }}
    >
      <Icon size={19} strokeWidth={1.8} />
    </span>
  )
}
export const navItems: { id: Page; label: string; icon: typeof Wallet }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transaksi', icon: ArrowLeftRight },
  { id: 'budgets', label: 'Anggaran', icon: Wallet },
  { id: 'analytics', label: 'Analisis', icon: PieChart },
]
export function Navigation({
  page,
  onPage,
  name,
  dark,
  onTheme,
}: {
  page: Page
  onPage: (p: Page) => void
  name: string
  dark: boolean
  onTheme: () => void
}) {
  return (
    <>
      <aside className="sidebar">
        <a
          href="#dashboard"
          className="brand"
          onClick={(e) => {
            e.preventDefault()
            onPage('dashboard')
          }}
        >
          <img src="/icon.svg" alt="" />
          <span>
            MyBudget<span className="brand-dot">.</span>
          </span>
        </a>
        <span className="nav-caption">RUANG KEUANGANMU</span>
        <nav aria-label="Navigasi utama">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={page === id ? 'page' : undefined}
              className={`nav-item ${page === id ? 'active' : ''}`}
              onClick={() => onPage(id)}
            >
              <Icon size={20} />
              {label}
              {page === id && <span className="active-dot" />}
            </button>
          ))}
          <button
            className={`nav-item settings-nav ${page === 'settings' ? 'active' : ''}`}
            onClick={() => onPage('settings')}
            aria-current={page === 'settings' ? 'page' : undefined}
          >
            <Settings size={20} />
            Pengaturan
          </button>
        </nav>
        <div className="sidebar-tip">
          <span className="tip-icon">
            <ShieldCheck size={22} />
          </span>
          <strong>Uangmu, kendalimu.</strong>
          <p>Langkah kecil hari ini, kebebasan finansial esok hari.</p>
          <span className="private-label">
            <span /> Tersimpan di perangkatmu
          </span>
        </div>
        <div className="sidebar-bottom">
          <div className="avatar">{(name || 'K').slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{name || 'Keuangan pribadi'}</strong>
            <small>My personal space</small>
          </div>
          <button
            className="icon-button"
            onClick={onTheme}
            aria-label={dark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
          >
            {dark ? <Sun size={19} /> : <Moon size={19} />}
          </button>
        </div>
      </aside>
      <nav className="bottom-nav" aria-label="Navigasi mobile">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={page === id ? 'active' : ''}
            aria-current={page === id ? 'page' : undefined}
            onClick={() => onPage(id)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = old
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" aria-label="Tutup dialog" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  )
}
export function SummaryCard({
  label,
  amount,
  icon,
  detail,
  dark = false,
}: {
  label: string
  amount: number
  icon: ReactNode
  detail: ReactNode
  dark?: boolean
}) {
  return (
    <article className={`summary-card ${dark ? 'balance-card' : ''}`}>
      <div className="summary-top">
        <span>{label}</span>
        <span className="summary-icon">{icon}</span>
      </div>
      <strong className="summary-amount">{money(amount)}</strong>
      <div className="summary-detail">{detail}</div>
      {dark && <span className="balance-decoration" aria-hidden="true" />}
    </article>
  )
}
export function BudgetProgress({
  name,
  spent,
  limit,
  color,
  compact = false,
}: {
  name: string
  spent: number
  limit: number
  color: string
  compact?: boolean
}) {
  const state = budgetStatus(spent, limit)
  return (
    <div className={`budget-progress ${compact ? 'compact' : ''}`}>
      <div className="budget-progress-title">
        <span>
          <i style={{ background: color }} />
          {name}
        </span>
        <small className={state.status === 'over' ? 'text-danger' : ''}>
          {limit ? `${Math.round(state.percent)}%` : 'Belum diatur'}
        </small>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={`Penggunaan anggaran ${name}`}
        aria-valuenow={Math.min(100, Math.round(state.percent))}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          style={{
            width: `${Math.min(100, state.percent)}%`,
            background:
              state.status === 'over' ? '#d9706b' : state.status === 'near' ? '#dca147' : color,
          }}
        />
      </div>
      <div className="budget-progress-foot">
        <span>
          {money(spent)} <small>/ {money(limit)}</small>
        </span>
        {!compact && (
          <small className={state.remaining < 0 ? 'text-danger' : ''}>
            {state.remaining < 0 ? 'Lebih ' : 'Sisa '}
            {money(Math.abs(state.remaining))}
          </small>
        )}
      </div>
    </div>
  )
}
export function EmptyState({
  icon: Icon = ReceiptText,
  title = 'Belum ada transaksi',
  description = 'Catat pemasukan atau pengeluaran pertamamu. Langkah kecil untuk keuangan yang lebih terarah.',
  action,
  onAction,
}: {
  icon?: typeof Wallet
  title?: string
  description?: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={28} strokeWidth={1.5} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button className="button button-primary button-small" onClick={onAction}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  )
}
export function TransactionList({
  transactions,
  categories,
  onEdit,
  onDelete,
  onAdd,
  full = false,
}: {
  transactions: Transaction[]
  categories: Category[]
  onEdit: (t: Transaction) => void
  onDelete: (t: Transaction) => void
  onAdd: () => void
  full?: boolean
}) {
  if (!transactions.length)
    return (
      <EmptyState
        title={full ? 'Tidak ada transaksi ditemukan' : 'Cerita keuanganmu dimulai di sini'}
        description={full ? 'Coba ubah filter, atau tambahkan transaksi baru.' : undefined}
        action="Catat transaksi"
        onAction={onAdd}
      />
    )
  return (
    <div className="transaction-list">
      <div className="transaction-table-head">
        <span>TRANSAKSI</span>
        <span>TANGGAL</span>
        <span>NOMINAL</span>
        <span className="sr-only">Aksi</span>
      </div>
      {transactions.map((t) => {
        const c = categories.find((c) => c.id === t.categoryId)
        return (
          <article key={t.id} className="transaction-row">
            <div className="transaction-name">
              <CategoryIcon category={c} />
              <div>
                <strong>{t.note || c?.name || 'Transaksi'}</strong>
                <small>
                  {c?.name}
                  <span className="mobile-date"> · {dateLabel(t.date)}</span>
                </small>
              </div>
            </div>
            <time dateTime={t.date}>{dateLabel(t.date)}</time>
            <strong className={`transaction-amount ${t.type === 'income' ? 'text-success' : ''}`}>
              {t.type === 'income' ? '+' : '−'}
              {money(t.amount)}
            </strong>
            <div className="transaction-actions">
              <button
                className="icon-button"
                aria-label={`Edit ${t.note || c?.name}`}
                onClick={() => onEdit(t)}
              >
                <Pencil size={15} />
              </button>
              <button
                className="icon-button delete-button"
                aria-label={`Hapus ${t.note || c?.name}`}
                onClick={() => onDelete(t)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
export function PanelHeader({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string
  subtitle?: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="panel-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && (
        <button className="text-button" onClick={onAction}>
          {action}
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  )
}
export { ArrowDownLeft, ArrowUpRight, MoreHorizontal, Search, Target, Check }
