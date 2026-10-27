import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  CircleCheck,
  Leaf,
  Plus,
  Sparkles,
  Wallet,
} from 'lucide-react'
import type { AppData, Page, Transaction } from '../types'
import {
  balanceAt,
  categorySpent,
  dateLabel,
  emptyBudget,
  money,
  monthTransactions,
  sortedTransactions,
  sumType,
} from '../lib/finance'
import {
  BudgetProgress,
  EmptyState,
  PanelHeader,
  SummaryCard,
  TransactionList,
} from '../components/UI'
import { CategoryChart, MonthlyChart } from '../components/Charts'

export default function Dashboard({
  data,
  month,
  cutoff,
  onCutoff,
  onPage,
  onAdd,
  onEdit,
  onDelete,
}: {
  data: AppData
  month: string
  cutoff: string
  onCutoff: (s: string) => void
  onPage: (p: Page) => void
  onAdd: () => void
  onEdit: (t: Transaction) => void
  onDelete: (t: Transaction) => void
}) {
  const tx = monthTransactions(data.transactions, month)
  const income = sumType(tx, 'income'),
    expense = sumType(tx, 'expense'),
    budget = data.budgets[month] ?? emptyBudget()
  const categories = data.categories.filter(
    (c) => c.type === 'expense' && (budget.limits[c.id] ?? 0) > 0,
  )
  return (
    <>
      <section className="welcome-banner">
        <div>
          <span className="eyebrow">
            <span /> YOUR MONEY, YOUR WAY
          </span>
          <h1>
            Rencana kecil. <span>Masa depan besar.</span>
          </h1>
          <p>Kenali keuanganmu, dan buat ruang untuk hal yang berarti.</p>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <span className="art-ring" />
          <span className="art-leaf">
            <Leaf size={40} strokeWidth={1.3} />
          </span>
          <span className="art-spark">
            <Sparkles size={20} />
          </span>
          <span className="art-coin">Rp</span>
        </div>
      </section>
      <section className="summary-grid" aria-label="Ringkasan keuangan">
        <SummaryCard
          dark
          label="Total saldo"
          amount={balanceAt(data.transactions, cutoff)}
          icon={<Wallet size={19} />}
          detail={
            <label className="cutoff-label">
              Per{' '}
              <input
                aria-label="Saldo per tanggal"
                type="date"
                value={cutoff}
                min="1900-01-01"
                max="2100-12-31"
                onChange={(e) => {
                  if (e.target.value) onCutoff(e.target.value)
                }}
              />
            </label>
          }
        />
        <SummaryCard
          label="Pemasukan"
          amount={income}
          icon={<ArrowDownLeft size={19} />}
          detail={
            <>
              <span className="stat-dot green" />
              Pemasukan bulan terpilih
            </>
          }
        />
        <SummaryCard
          label="Pengeluaran"
          amount={expense}
          icon={<ArrowUpRight size={19} />}
          detail={
            <>
              <span className="stat-dot orange" />
              Pengeluaran bulan terpilih
            </>
          }
        />
        <SummaryCard
          label="Sisa anggaran"
          amount={budget.total - expense}
          icon={<CalendarDays size={19} />}
          detail={
            budget.total ? (
              <span className={expense > budget.total ? 'text-danger' : ''}>
                Dari {money(budget.total)} anggaran
              </span>
            ) : (
              <button className="text-button" onClick={() => onPage('budgets')}>
                Atur anggaran <ArrowRight size={13} />
              </button>
            )
          }
        />
      </section>
      <div className="dashboard-charts">
        <section className="panel">
          <PanelHeader
            title="Arus keuangan"
            subtitle="Pemasukan dan pengeluaran 6 bulan terakhir"
          />
          <div className="chart-legend">
            <span>
              <i style={{ background: '#287a65' }} />
              Pemasukan
            </span>
            <span>
              <i style={{ background: '#b8dacf' }} />
              Pengeluaran
            </span>
          </div>
          <MonthlyChart transactions={data.transactions} month={month} />
        </section>
        <section className="panel">
          <PanelHeader title="Ke mana uangmu pergi?" subtitle="Pengeluaran berdasarkan kategori" />
          <CategoryChart transactions={tx} categories={data.categories} />
        </section>
      </div>
      <div className="dashboard-lower">
        <section className="panel transactions-panel">
          <PanelHeader
            title="Transaksi terbaru"
            subtitle="Lima catatan terakhir bulan ini"
            action="Lihat semua"
            onAction={() => onPage('transactions')}
          />
          <TransactionList
            transactions={sortedTransactions(tx).slice(0, 5)}
            categories={data.categories}
            onEdit={onEdit}
            onDelete={onDelete}
            onAdd={onAdd}
          />
        </section>
        <section className="panel">
          <PanelHeader
            title="Pantau anggaran"
            subtitle="Tetap di jalur rencanamu"
            action="Atur"
            onAction={() => onPage('budgets')}
          />
          {categories.length ? (
            <div className="budget-list">
              {categories.slice(0, 4).map((c) => (
                <BudgetProgress
                  key={c.id}
                  compact
                  name={c.name}
                  spent={categorySpent(tx, c.id)}
                  limit={budget.limits[c.id]}
                  color={c.color}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Wallet}
              title="Beri setiap rupiah tujuan"
              description="Atur batas pengeluaran agar rencanamu tetap terjaga."
              action="Buat anggaran"
              onAction={() => onPage('budgets')}
            />
          )}
        </section>
      </div>
      <div className="gentle-note">
        <span>
          <CircleCheck size={18} />
          <strong>Lebih sadar, lebih terarah.</strong> Kebiasaan mencatat adalah investasi untuk
          dirimu.
        </span>
        <button className="text-button" onClick={onAdd}>
          Catat hari ini
          <Plus size={15} />
        </button>
      </div>
      <p className="dashboard-date">
        Saldo menghitung seluruh transaksi sampai {dateLabel(cutoff)}. Ringkasan lain mengikuti
        bulan terpilih.
      </p>
    </>
  )
}
