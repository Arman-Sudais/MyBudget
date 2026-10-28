import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Check, Info } from 'lucide-react'
import type { AppData, Budget, Transaction, TransactionType } from '../types'
import { emptyBudget, localDate, MAX_AMOUNT, money, monthLabel } from '../lib/finance'
import { validDate } from '../lib/data'
import { mergeBudgetEdit } from '../cloud/model'

export function TransactionForm({
  data,
  initial,
  onSave,
  onClose,
}: {
  data: AppData
  initial?: Transaction
  onSave: (t: Transaction) => void
  onClose: () => void
}) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense')
  const [category, setCategory] = useState(
    initial?.categoryId ?? data.categories.find((c) => c.type === 'expense')?.id ?? '',
  )
  const [value, setValue] = useState(initial ? String(initial.amount) : '')
  const [date, setDate] = useState(initial?.date ?? localDate())
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState('')
  const changeType = (next: TransactionType) => {
    setType(next)
    setCategory(data.categories.find((c) => c.type === next)?.id ?? '')
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setError('')
        const amount = Number(value)
        if (
          !/^\d+$/.test(value) ||
          !Number.isSafeInteger(amount) ||
          amount <= 0 ||
          amount > MAX_AMOUNT
        )
          return setError(
            'Nominal harus berupa Rupiah bulat, lebih dari 0 dan maksimal Rp1 triliun.',
          )
        if (!validDate(date)) return setError('Pilih tanggal yang valid antara 1900–2100.')
        if (!data.categories.some((c) => c.id === category && c.type === type))
          return setError('Pilih kategori yang sesuai.')
        try {
          onSave({
            id: initial?.id ?? crypto.randomUUID(),
            type,
            amount,
            categoryId: category,
            date,
            note: note.trim(),
          })
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Transaksi gagal disimpan.')
        }
      }}
    >
      <div className="type-toggle">
        <button
          type="button"
          className={type === 'expense' ? 'selected expense' : ''}
          onClick={() => changeType('expense')}
        >
          <ArrowUpRight size={18} />
          Pengeluaran
        </button>
        <button
          type="button"
          className={type === 'income' ? 'selected' : ''}
          onClick={() => changeType('income')}
        >
          <ArrowDownLeft size={18} />
          Pemasukan
        </button>
      </div>
      <label className="field amount-field">
        Nominal transaksi
        <span className="amount-input">
          <span>Rp</span>
          <input
            autoFocus
            aria-label="Nominal transaksi"
            inputMode="numeric"
            pattern="[0-9]+"
            placeholder="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            maxLength={13}
          />
        </span>
        <small>{money(Number(value) || 0)}</small>
      </label>
      <div className="form-grid">
        <label className="field">
          Kategori
          <select value={category} onChange={(e) => setCategory(e.target.value)} required>
            {data.categories
              .filter((c) => c.type === type)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          Tanggal
          <input
            type="date"
            value={date}
            min="1900-01-01"
            max="2100-12-31"
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
      </div>
      <label className="field">
        Catatan <span className="optional">(opsional)</span>
        <textarea
          placeholder="Misalnya: makan siang di kantin kampus"
          value={note}
          maxLength={200}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-note">
        <Info size={15} />
        <span>Tersimpan hanya di perangkat ini, termasuk saat offline.</span>
      </div>
      <footer className="form-footer">
        <button type="button" className="button button-secondary" onClick={onClose}>
          Batal
        </button>
        <button className="button button-primary" type="submit">
          <Check size={17} />
          {initial ? 'Simpan perubahan' : 'Simpan transaksi'}
        </button>
      </footer>
    </form>
  )
}
export function BudgetForm({
  data,
  month,
  onSave,
  onClose,
}: {
  data: AppData
  month: string
  onSave: (budget: Budget) => void
  onClose: () => void
}) {
  const current = data.budgets[month] ?? emptyBudget()
  const [baseline] = useState(current)
  const [total, setTotal] = useState(String(current.total || ''))
  const [limits, setLimits] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(current.limits).map(([key, value]) => [key, String(value)])),
  )
  const [error, setError] = useState('')
  const allocated = Object.values(limits).reduce((s, v) => s + (Number(v) || 0), 0)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const values = [total || '0', ...Object.values(limits).map((v) => v || '0')]
        if (values.some((v) => !/^\d+$/.test(v) || Number(v) > MAX_AMOUNT))
          return setError('Gunakan nominal Rupiah bulat antara 0–Rp1 triliun.')
        if (allocated > Number(total))
          return setError('Total alokasi kategori tidak boleh melebihi anggaran bulanan.')
        try {
          onSave(
            mergeBudgetEdit(current, baseline, {
              total: Number(total),
              limits: Object.fromEntries(Object.entries(limits).map(([id, v]) => [id, Number(v)])),
            }),
          )
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Gagal menyimpan anggaran.')
        }
      }}
    >
      <p className="form-description">
        Rencanakan pengeluaran {monthLabel(month)}. Anggaran adalah batas, sehingga tidak mengurangi
        saldo.
      </p>
      <label className="field">
        Total anggaran bulanan (Rp)
        <input
          inputMode="numeric"
          pattern="[0-9]+"
          placeholder="Contoh: 2000000"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          maxLength={13}
        />
      </label>
      <div className="allocation-summary">
        <span>
          Dialokasikan <strong>{money(allocated)}</strong>
        </span>
        <span className={allocated > Number(total) ? 'text-danger' : 'text-success'}>
          Belum dialokasikan {money((Number(total) || 0) - allocated)}
        </span>
      </div>
      <div className="budget-form-categories">
        {data.categories
          .filter((c) => c.type === 'expense')
          .map((c) => (
            <label className="allocation-row" key={c.id}>
              <span>
                <i style={{ background: c.color }} />
                {c.name}
              </span>
              <input
                aria-label={`Anggaran ${c.name}`}
                inputMode="numeric"
                pattern="[0-9]*"
                value={limits[c.id] ?? ''}
                onChange={(e) => setLimits({ ...limits, [c.id]: e.target.value })}
                placeholder="0"
                maxLength={13}
              />
            </label>
          ))}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <footer className="form-footer">
        <button type="button" className="button button-secondary" onClick={onClose}>
          Batal
        </button>
        <button className="button button-primary" type="submit">
          <Check size={17} />
          Simpan anggaran
        </button>
      </footer>
    </form>
  )
}
