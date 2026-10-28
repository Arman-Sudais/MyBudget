import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import type { AppData } from '../types'
import {
  categorySpent,
  endOfMonth,
  money,
  monthLabel,
  monthTransactions,
  shiftMonth,
  sumType,
} from '../lib/finance'
import { CategoryChart, MonthlyChart } from '../components/Charts'
import { CategoryIcon, EmptyState, PanelHeader, SummaryCard } from '../components/UI'
import AIInsights from '../components/AIInsights'

export default function Analytics({ data, month }: { data: AppData; month: string }) {
  const tx = monthTransactions(data.transactions, month),
    expense = sumType(tx, 'expense'),
    income = sumType(tx, 'income'),
    prev = sumType(monthTransactions(data.transactions, shiftMonth(month, -1)), 'expense'),
    change = prev ? Math.round(((expense - prev) / prev) * 100) : null
  const days = Number(endOfMonth(month).slice(-2)),
    ranking = data.categories
      .filter((c) => c.type === 'expense')
      .map((c) => ({ ...c, spent: categorySpent(tx, c.id) }))
      .filter((c) => c.spent > 0)
      .sort((a, b) => b.spent - a.spent)
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">KENALI POLA KEUANGANMU</span>
          <h1>Lebih paham, lebih bijak.</h1>
          <p>Evaluasi kebiasaan kecil untuk keputusan yang lebih baik.</p>
        </div>
        <span className="date-chip">
          <ChartNoAxesCombined size={17} />
          {monthLabel(month)}
        </span>
      </div>
      <div className="analytics-summary">
        <SummaryCard
          label="Total pemasukan"
          amount={income}
          icon={<ArrowDownLeft size={18} />}
          detail="Pada bulan terpilih"
        />
        <SummaryCard
          label="Total pengeluaran"
          amount={expense}
          icon={<ArrowUpRight size={18} />}
          detail="Pada bulan terpilih"
        />
        <SummaryCard
          label="Rata-rata harian"
          amount={Math.round(expense / days)}
          icon={<CalendarDays size={18} />}
          detail={`Dibagi ${days} hari kalender bulan ini`}
        />
      </div>
      <AIInsights data={data} month={month} />
      <div className="dashboard-charts">
        <section className="panel">
          <PanelHeader
            title="Pemasukan vs pengeluaran"
            subtitle="Enam bulan sampai bulan terpilih"
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
          <PanelHeader title="Distribusi pengeluaran" subtitle="Kenali prioritas pengeluaranmu" />
          <CategoryChart transactions={tx} categories={data.categories} />
        </section>
      </div>
      <div className="dashboard-lower">
        <section className="panel">
          <PanelHeader
            title="Pengeluaran terbesar"
            subtitle="Diurutkan berdasarkan total per kategori"
          />
          {ranking.length ? (
            <div className="ranking-list">
              {ranking.map((c, i) => (
                <div key={c.id}>
                  <small className="rank-number">{String(i + 1).padStart(2, '0')}</small>
                  <CategoryIcon category={c} />
                  <span>
                    <strong>{c.name}</strong>
                    <small>{Math.round((c.spent / expense) * 100)}% dari pengeluaran</small>
                  </span>
                  <strong>{money(c.spent)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Belum ada pola pengeluaran"
              description="Catat transaksi untuk melihat kategori dengan pengeluaran terbesar."
            />
          )}
        </section>
        <section className="panel comparison-card">
          <PanelHeader
            title="Bulan ini vs sebelumnya"
            subtitle={`Dibandingkan ${monthLabel(shiftMonth(month, -1))}`}
          />
          <span className={`comparison-icon ${expense > prev ? 'up' : ''}`}>
            {expense > prev ? <TrendingUp size={30} /> : <TrendingDown size={30} />}
          </span>
          <h3>
            {change === null
              ? prev === expense
                ? 'Belum ada perubahan'
                : 'Pengeluaran baru tercatat'
              : `${Math.abs(change)}% ${change > 0 ? 'lebih tinggi' : change < 0 ? 'lebih rendah' : 'perubahan'}`}
          </h3>
          <p>
            {prev === 0
              ? 'Bulan sebelumnya belum memiliki pengeluaran, sehingga persentase perbandingan belum tersedia.'
              : `Selisih ${money(Math.abs(expense - prev))} dari pengeluaran bulan sebelumnya.`}
          </p>
          <div className="comparison-values">
            <span>
              Bulan terpilih<strong>{money(expense)}</strong>
            </span>
            <span>
              Bulan sebelumnya<strong>{money(prev)}</strong>
            </span>
          </div>
        </section>
      </div>
    </>
  )
}
