import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Category, Transaction } from '../types'
import {
  categorySpent,
  compact,
  money,
  monthLabel,
  monthTransactions,
  shiftMonth,
  sumType,
} from '../lib/finance'
import { EmptyState } from './UI'
import { ChartNoAxesCombined, Donut } from 'lucide-react'

export function MonthlyChart({
  transactions,
  month,
}: {
  transactions: Transaction[]
  month: string
}) {
  const data = Array.from({ length: 6 }, (_, i) => {
    const key = shiftMonth(month, i - 5)
    const tx = monthTransactions(transactions, key)
    return {
      name: monthLabel(key, true).split(' ')[0],
      full: monthLabel(key),
      Pemasukan: sumType(tx, 'income'),
      Pengeluaran: sumType(tx, 'expense'),
    }
  })
  if (!data.some((d) => d.Pemasukan || d.Pengeluaran))
    return (
      <div className="chart-empty">
        <EmptyState
          icon={ChartNoAxesCombined}
          title="Setiap transaksi punya cerita"
          description="Grafik enam bulan akan muncul saat kamu mulai mencatat pemasukan dan pengeluaran."
        />
      </div>
    )
  return (
    <div
      className="monthly-chart"
      role="img"
      aria-label="Grafik batang pemasukan dan pengeluaran enam bulan terakhir"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={6} margin={{ left: -18, top: 15, right: 5, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'var(--muted)' }}
            dy={9}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={compact}
            tick={{ fontSize: 10, fill: 'var(--muted)' }}
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-soft)' }}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid var(--line)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 12,
            }}
            formatter={(value) => money(Number(value))}
          />
          <Bar dataKey="Pemasukan" fill="#287a65" radius={[5, 5, 0, 0]} maxBarSize={24} />
          <Bar dataKey="Pengeluaran" fill="#b8dacf" radius={[5, 5, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
export function CategoryChart({
  transactions,
  categories,
}: {
  transactions: Transaction[]
  categories: Category[]
}) {
  const data = categories
    .filter((c) => c.type === 'expense')
    .map((c) => ({ name: c.name, value: categorySpent(transactions, c.id), color: c.color }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
  const total = sumType(transactions, 'expense')
  if (!total)
    return (
      <div className="chart-empty">
        <EmptyState
          icon={Donut}
          title="Belum ada pengeluaran"
          description="Distribusi kategori akan tampil di sini. Setiap rupiah tercatat dengan jelas."
        />
      </div>
    )
  return (
    <div className="category-chart">
      <div
        className="donut-wrap"
        role="img"
        aria-label={data.map((c) => `${c.name}: ${money(c.value)}`).join(', ')}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="71%"
              outerRadius="94%"
              paddingAngle={3}
              stroke="none"
              cornerRadius={5}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => money(Number(value))}
              contentStyle={{
                borderRadius: 12,
                background: 'var(--surface)',
                borderColor: 'var(--line)',
                color: 'var(--text)',
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <small>Total pengeluaran</small>
          <strong>{money(total)}</strong>
        </div>
      </div>
      <div className="chart-categories">
        {data.map((d) => (
          <div key={d.name}>
            <span>
              <i style={{ background: d.color }} />
              {d.name}
            </span>
            <strong>{Math.round((d.value / total) * 100)}%</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
