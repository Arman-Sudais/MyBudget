import type { AppData } from '../types'
import {
  endOfMonth,
  localDate,
  money,
  monthLabel,
  monthTransactions,
  shiftMonth,
} from '../lib/finance'

export type Question = 'overview' | 'budget' | 'categories' | 'comparison' | 'savings'
export const questions: Record<Question, string> = {
  overview: 'Bagaimana kondisi keuangan saya?',
  budget: 'Apakah anggaran saya berisiko terlewati?',
  categories: 'Kategori mana yang perlu diperhatikan?',
  comparison: 'Bagaimana dibandingkan bulan sebelumnya?',
  savings: 'Apakah ada ruang untuk menabung?',
}
export interface SavingsGoal {
  target: number
  saved: number
}
export interface FinancialAnalysis {
  month: string
  asOf: string
  period: 'past' | 'current' | 'future'
  transactionCount: number
  income: number
  expense: number
  net: number
  budget: number | null
  budgetPercent: number | null
  remaining: number | null
  previousExpense: number
  changePercent: number | null
  dailyAverage: number
  elapsedDailyAverage: number | null
  daysInMonth: number
  elapsedDays: number
  projectedExpense: number | null
  categories: {
    categoryId: string
    alias: string
    spent: number
    limit: number | null
    remaining: number | null
    percent: number | null
  }[]
  savings: { target: number; saved: number; remaining: number; percent: number } | null
}

// BigInt intermediates keep aggregate Rupiah and rounding exact. Refuse overflow.
function safe(n: bigint) {
  if (n > BigInt(Number.MAX_SAFE_INTEGER) || n < BigInt(Number.MIN_SAFE_INTEGER))
    throw new Error('Total terlalu besar untuk dianalisis secara aman. Data asli tetap tersimpan.')
  return Number(n)
}
function sum(amounts: number[]) {
  return safe(amounts.reduce((a, b) => a + BigInt(b), 0n))
}
function ratio(n: number, d: number, multiplier = 1) {
  const numerator = BigInt(n) * BigInt(multiplier),
    denominator = BigInt(d)
  const absolute = numerator < 0n ? -numerator : numerator
  return safe(((absolute + denominator / 2n) / denominator) * (numerator < 0n ? -1n : 1n))
}
export function analyzeFinances(
  data: AppData,
  month: string,
  today = localDate(),
  goal?: SavingsGoal,
): FinancialAnalysis {
  const tx = monthTransactions(data.transactions, month)
  const income = sum(tx.filter((t) => t.type === 'income').map((t) => t.amount))
  const expense = sum(tx.filter((t) => t.type === 'expense').map((t) => t.amount))
  const previousExpense = sum(
    monthTransactions(data.transactions, shiftMonth(month, -1))
      .filter((t) => t.type === 'expense')
      .map((t) => t.amount),
  )
  const period =
    month < today.slice(0, 7) ? 'past' : month > today.slice(0, 7) ? 'future' : 'current'
  const daysInMonth = Number(endOfMonth(month).slice(-2))
  const elapsedDays =
    period === 'past' ? daysInMonth : period === 'future' ? 0 : Number(today.slice(-2))
  const elapsedExpense = sum(
    tx.filter((t) => t.type === 'expense' && t.date <= today).map((t) => t.amount),
  )
  const budget = data.budgets[month]?.total || null
  const categories = data.categories
    .filter((c) => c.type === 'expense')
    .map((c) => {
      const spent = sum(
        tx.filter((t) => t.type === 'expense' && t.categoryId === c.id).map((t) => t.amount),
      )
      const limit = data.budgets[month]?.limits[c.id] || null
      return {
        categoryId: c.id,
        spent,
        limit,
        remaining: limit === null ? null : limit - spent,
        percent: limit === null ? null : ratio(spent, limit, 100),
      }
    })
    .filter((c) => c.spent > 0 || c.limit !== null)
    .sort((a, b) => b.spent - a.spent || a.categoryId.localeCompare(b.categoryId))
    .map((c, i) => ({ ...c, alias: `Kategori ${i + 1}` }))
  const validGoal =
    goal &&
    Number.isSafeInteger(goal.target) &&
    goal.target > 0 &&
    Number.isSafeInteger(goal.saved) &&
    goal.saved >= 0
  return {
    month,
    asOf: today,
    period,
    transactionCount: tx.length,
    income,
    expense,
    net: safe(BigInt(income) - BigInt(expense)),
    budget,
    budgetPercent: budget === null ? null : ratio(expense, budget, 100),
    remaining: budget === null ? null : budget - expense,
    previousExpense,
    changePercent: previousExpense ? ratio(expense - previousExpense, previousExpense, 100) : null,
    dailyAverage: ratio(expense, daysInMonth),
    elapsedDailyAverage: elapsedDays ? ratio(elapsedExpense, elapsedDays) : null,
    daysInMonth,
    elapsedDays,
    projectedExpense:
      period === 'future'
        ? null
        : period === 'past'
          ? expense
          : Math.max(expense, ratio(elapsedExpense, elapsedDays, daysInMonth)),
    categories,
    savings: validGoal
      ? {
          target: goal.target,
          saved: goal.saved,
          remaining: Math.max(0, goal.target - goal.saved),
          percent: ratio(goal.saved, goal.target, 100),
        }
      : null,
  }
}

export interface Insight {
  id: string
  text: string
  categoryId?: string
}
export interface InsightReport {
  summary: string
  findings: Insight[]
  recommendations: Insight[]
}
export function localInsights(a: FinancialAnalysis): InsightReport {
  const findings: Insight[] = [],
    recommendations: Insight[] = []
  const add = (id: string, text: string, categoryId?: string) =>
    findings.push({ id, text, categoryId })
  const advise = (id: string, text: string) => recommendations.push({ id, text })
  add(
    'totals',
    `Pemasukan ${money(a.income)} dan pengeluaran ${money(a.expense)}. Selisih bulan ini ${money(a.net)}; ini bukan saldo kumulatif atau tabungan yang sudah disisihkan.`,
  )
  if (a.transactionCount < 5) {
    add(
      'limited',
      'Data masih sedikit. Pola dan perkiraan belum cukup kuat untuk menilai kebiasaan keuangan.',
    )
    advise(
      'record',
      'Lanjutkan mencatat pengeluaran harian agar evaluasi berikutnya lebih lengkap.',
    )
  }
  if (a.budget === null) {
    add(
      'no-budget',
      'Anggaran bulanan belum diatur. Persentase penggunaan dan risiko melewati batas belum dapat dinilai.',
    )
    advise(
      'set-budget',
      'Tentukan batas bulanan dan alokasi kategori sesuai kebutuhan pokok terlebih dahulu.',
    )
  } else {
    add(
      'budget',
      `Anggaran terpakai ${a.budgetPercent}%. ${a.remaining! < 0 ? 'Melebihi batas' : 'Sisa anggaran'} ${money(Math.abs(a.remaining!))}.`,
    )
    if (a.expense >= a.budget * 0.8)
      advise(
        'review-budget',
        'Tinjau pengeluaran yang masih bisa ditunda, sambil tetap mendahulukan makan, transportasi, dan kebutuhan kuliah.',
      )
    if (a.period === 'current' && a.projectedExpense! > a.budget) {
      add(
        'projection-risk',
        `Jika laju pengeluaran yang tercatat berlanjut, perkiraan akhir bulan ${money(a.projectedExpense!)} dapat melewati anggaran ${money(a.budget)}. Ini perkiraan, bukan kepastian.`,
      )
      advise(
        'pace',
        'Periksa sisa anggaran sebelum belanja berikutnya dan sesuaikan rencana untuk hari yang tersisa.',
      )
    }
  }
  add(
    'daily',
    `Rata-rata ${money(a.dailyAverage)} per hari kalender, dibagi ${a.daysInMonth} hari. ${a.elapsedDailyAverage === null ? 'Bulan belum berjalan.' : `Rata-rata hingga tanggal acuan: ${money(a.elapsedDailyAverage)} per hari (${a.elapsedDays} hari).`}`,
  )
  if (
    a.period === 'current' &&
    a.projectedExpense !== null &&
    !findings.some((f) => f.id === 'projection-risk')
  )
    add(
      'projection',
      `Perkiraan pengeluaran akhir bulan ${money(a.projectedExpense)} berdasarkan laju hingga tanggal acuan; tidak menjamin pengeluaran berikutnya.`,
    )
  if (a.period === 'future')
    add(
      'future',
      'Bulan ini belum dimulai; hanya transaksi yang sudah tercatat yang ditampilkan. Belum ada proyeksi.',
    )
  add(
    'comparison',
    a.changePercent === null
      ? 'Bulan sebelumnya tidak memiliki pengeluaran tercatat; persentase perubahan belum dapat dihitung.'
      : `Pengeluaran ${Math.abs(a.changePercent)}% ${a.changePercent < 0 ? 'lebih rendah' : a.changePercent > 0 ? 'lebih tinggi' : 'berubah'} dibanding total bulan sebelumnya (${money(a.previousExpense)}). ${a.period === 'current' ? 'Bulan berjalan belum selesai, jadi perbandingan ini belum setara durasi.' : ''}`,
  )
  if (a.categories[0]?.spent)
    add(
      'largest',
      `Pengeluaran terbesar ${a.categories[0].alias}: ${money(a.categories[0].spent)}. Besar pengeluaran saja tidak berarti kebutuhan ini berlebihan.`,
      a.categories[0].categoryId,
    )
  a.categories
    .filter((c) => c.limit !== null && c.spent >= c.limit * 0.8)
    .forEach((c, i) =>
      add(
        `category-${i}`,
        `${c.alias} memakai ${c.percent}% alokasi; ${c.remaining! < 0 ? 'melebihi batas' : 'tersisa'} ${money(Math.abs(c.remaining!))}.`,
        c.categoryId,
      ),
    )
  if (a.categories.some((c) => c.spent > 0 && c.limit === null))
    advise(
      'allocate',
      'Beri alokasi pada kategori yang sudah memiliki pengeluaran agar batasnya dapat dipantau.',
    )
  if (a.savings)
    add(
      'savings',
      `Target tabungan ${money(a.savings.target)}, sudah disisihkan ${money(a.savings.saved)} (${a.savings.percent}%). Sisa target ${money(a.savings.remaining)}.`,
    )
  else
    add(
      'savings',
      `Target dan dana tabungan belum tersedia. ${a.net > 0 ? `Selisih positif ${money(a.net)} dapat menjadi bahan rencana menabung setelah kebutuhan mendatang diperhitungkan.` : 'Belum ada selisih positif bulan ini untuk dipertimbangkan sebagai ruang menabung.'}`,
    )
  advise(
    'savings-plan',
    'Tentukan target tabungan yang realistis setelah kebutuhan pokok dan tagihan mendatang terpenuhi. Selisih pemasukan dan pengeluaran belum tentu dana bebas.',
  )
  const summary =
    a.transactionCount === 0
      ? `Belum ada transaksi pada ${monthLabel(a.month)}. Mulai mencatat untuk mendapatkan ringkasan yang bermakna.`
      : `Pada ${monthLabel(a.month)}, ${a.net < 0 ? 'pengeluaran tercatat melebihi pemasukan bulan ini' : 'pemasukan tercatat mencukupi pengeluaran bulan ini'}. ${a.budget === null ? 'Atur anggaran untuk mengevaluasi batas pengeluaran.' : a.expense > a.budget ? 'Pengeluaran telah melampaui batas anggaran.' : 'Pengeluaran tercatat masih di dalam batas anggaran.'}`
  return { summary, findings, recommendations }
}

// Explicit allowlist. Never serialize AppData, names, custom labels, notes, UID or raw rows.
export function aggregatePayload(a: FinancialAnalysis, report: InsightReport, question: Question) {
  return {
    version: 1,
    question,
    questionText: questions[question],
    month: a.month,
    asOf: a.period === 'current' ? a.asOf : null,
    period: a.period,
    income: a.income,
    expense: a.expense,
    net: a.net,
    budget: a.budget,
    budgetPercent: a.budgetPercent,
    remaining: a.remaining,
    previousExpense: a.previousExpense,
    changePercent: a.changePercent,
    dailyAverage: a.dailyAverage,
    elapsedDailyAverage: a.elapsedDailyAverage,
    daysInMonth: a.daysInMonth,
    elapsedDays: a.elapsedDays,
    projectedExpense: a.projectedExpense,
    limitedData: a.transactionCount < 5,
    categories: a.categories.map(({ alias, spent, limit, remaining, percent }) => ({
      alias,
      spent,
      limit,
      remaining,
      percent,
    })),
    savings: a.savings,
    findings: report.findings.map(({ id, text }) => ({ id, text })),
    recommendations: report.recommendations.map(({ id, text }) => ({ id, text })),
  }
}
