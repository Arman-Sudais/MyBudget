import { useState } from 'react'
import { Download, Search, SlidersHorizontal, X } from 'lucide-react'
import type { AppData, Transaction } from '../types'
import { money, monthLabel, monthTransactions, sortedTransactions, sumType } from '../lib/finance'
import { TransactionList } from '../components/UI'
import { downloadFile, transactionsCsv } from '../lib/data'

export default function Transactions({
  data,
  month,
  onAdd,
  onEdit,
  onDelete,
}: {
  data: AppData
  month: string
  onAdd: () => void
  onEdit: (t: Transaction) => void
  onDelete: (t: Transaction) => void
}) {
  const [search, setSearch] = useState(''),
    [type, setType] = useState('all'),
    [category, setCategory] = useState('all')
  const tx = sortedTransactions(
    monthTransactions(data.transactions, month).filter(
      (t) =>
        (type === 'all' || t.type === type) &&
        (category === 'all' || t.categoryId === category) &&
        `${t.note} ${data.categories.find((c) => c.id === t.categoryId)?.name ?? ''}`
          .toLocaleLowerCase('id')
          .includes(search.toLocaleLowerCase('id')),
    ),
  )
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">SETIAP RUPIAH, TERCATAT</span>
          <h1>Riwayat transaksi</h1>
          <p>Semua pemasukan dan pengeluaran, dalam satu tempat.</p>
        </div>
        <button
          className="button button-secondary"
          onClick={() =>
            downloadFile(
              transactionsCsv({ ...data, transactions: tx }),
              `MyBudget-transaksi-${month}.csv`,
              'text/csv;charset=utf-8',
            )
          }
        >
          <Download size={17} />
          Ekspor CSV
        </button>
      </div>
      <section className="panel">
        <div className="filter-bar">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Cari transaksi"
              placeholder="Cari catatan atau kategori…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="filter-select">
            <SlidersHorizontal size={16} />
            <select
              aria-label="Filter jenis transaksi"
              value={type}
              onChange={(e) => {
                setType(e.target.value)
                setCategory('all')
              }}
            >
              <option value="all">Semua jenis</option>
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
            </select>
          </label>
          <select
            className="category-filter"
            aria-label="Filter kategori"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">Semua kategori</option>
            {data.categories
              .filter((c) => type === 'all' || c.type === type)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.type === 'income' ? 'Masuk' : 'Keluar'}
                </option>
              ))}
          </select>
          {(search || type !== 'all' || category !== 'all') && (
            <button
              className="icon-button"
              aria-label="Reset filter"
              onClick={() => {
                setSearch('')
                setType('all')
                setCategory('all')
              }}
            >
              <X size={17} />
            </button>
          )}
        </div>
        <div className="transaction-summary">
          <span>
            {tx.length} transaksi · {monthLabel(month)}
          </span>
          <span>
            Masuk <strong className="text-success">{money(sumType(tx, 'income'))}</strong>{' '}
            <span className="summary-divider">/</span> Keluar{' '}
            <strong>{money(sumType(tx, 'expense'))}</strong>
          </span>
        </div>
        <TransactionList
          full
          transactions={tx}
          categories={data.categories}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </section>
      <p className="footnote">
        Ekspor CSV mengikuti hasil pencarian dan filter yang aktif. Backup semua data tersedia di
        Pengaturan.
      </p>
    </>
  )
}
