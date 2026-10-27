import { CircleAlert, Pencil, PiggyBank, Wallet } from 'lucide-react'
import type { AppData } from '../types'
import {
  budgetStatus,
  categorySpent,
  emptyBudget,
  money,
  monthLabel,
  monthTransactions,
  sumType,
} from '../lib/finance'
import { BudgetProgress, CategoryIcon, EmptyState } from '../components/UI'

export default function Budgets({
  data,
  month,
  onEdit,
}: {
  data: AppData
  month: string
  onEdit: () => void
}) {
  const budget = data.budgets[month] ?? emptyBudget(),
    tx = monthTransactions(data.transactions, month),
    spent = sumType(tx, 'expense')
  const status = budgetStatus(spent, budget.total),
    allocated = Object.values(budget.limits).reduce((s, v) => s + v, 0)
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">RENCANAKAN DENGAN TENANG</span>
          <h1>Anggaran bulanan</h1>
          <p>Beri batas pada pengeluaran, bukan pada impianmu.</p>
        </div>
        <button className="button button-primary" onClick={onEdit}>
          <Pencil size={17} />
          Atur anggaran
        </button>
      </div>
      <section className="budget-overview panel">
        <div className="budget-overview-heading">
          <span className="summary-icon">
            <Wallet size={24} />
          </span>
          <div>
            <small>TOTAL ANGGARAN · {monthLabel(month).toUpperCase()}</small>
            <h2>{money(budget.total)}</h2>
          </div>
          <span className={`status-pill ${status.status}`}>
            {!budget.total
              ? 'Belum diatur'
              : status.status === 'over'
                ? 'Melebihi anggaran'
                : status.status === 'near'
                  ? 'Mendekati batas'
                  : 'Masih terkendali'}
          </span>
        </div>
        <BudgetProgress
          name="Penggunaan anggaran total"
          spent={spent}
          limit={budget.total}
          color="#287a65"
        />
        <div className="budget-overview-stats">
          <div>
            <span>Sudah dialokasikan</span>
            <strong>{money(allocated)}</strong>
          </div>
          <div>
            <span>Belum dialokasikan</span>
            <strong>{money(budget.total - allocated)}</strong>
          </div>
          <div>
            <span>Pengeluaran tanpa alokasi kategori</span>
            <strong>
              {money(
                tx
                  .filter((t) => t.type === 'expense' && !(budget.limits[t.categoryId] > 0))
                  .reduce((s, t) => s + t.amount, 0),
              )}
            </strong>
          </div>
        </div>
      </section>
      {!budget.total && (
        <div className="info-callout">
          <PiggyBank size={21} />
          <p>
            Mulai dari kebutuhan utamamu. Tentukan anggaran total, lalu bagi ke kategori. Semua
            pengeluaran dihitung satu kali, termasuk kategori tanpa alokasi.
          </p>
        </div>
      )}
      <div className="section-heading">
        <h2>Alokasi per kategori</h2>
        <span>{data.categories.filter((c) => c.type === 'expense').length} kategori</span>
      </div>
      <div className="budget-cards">
        {data.categories
          .filter((c) => c.type === 'expense')
          .map((c) => {
            const limit = budget.limits[c.id] ?? 0,
              actual = categorySpent(tx, c.id),
              state = budgetStatus(actual, limit)
            return (
              <article key={c.id} className="panel budget-category-card">
                <div className="budget-card-heading">
                  <CategoryIcon category={c} />
                  <h3>{c.name}</h3>
                  <button
                    className="icon-button"
                    aria-label={`Atur anggaran ${c.name}`}
                    onClick={onEdit}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
                <BudgetProgress name="Terpakai" spent={actual} limit={limit} color={c.color} />
                {state.status === 'over' && (
                  <p className="budget-alert">
                    <CircleAlert size={14} />
                    {limit
                      ? 'Pengeluaran melebihi batas kategori.'
                      : 'Ada pengeluaran; kategori belum dialokasikan.'}
                  </p>
                )}
              </article>
            )
          })}
      </div>
      {!data.categories.some((c) => c.type === 'expense') && (
        <EmptyState
          title="Tambahkan kategori pengeluaran"
          description="Kategori dapat ditambahkan melalui Pengaturan."
        />
      )}
    </>
  )
}
