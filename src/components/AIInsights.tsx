import { useEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react'
import type { AppData } from '../types'
import { localDate, money } from '../lib/finance'
import { useBudgetData } from '../hooks/useBudgetData'
import { aggregatePayload, analyzeFinances, localInsights, questions } from '../insights/engine'
import type { Question } from '../insights/engine'
import { aiConfiguration } from '../insights/config'
import {
  activateInsightsWorkspace,
  aiErrorMessage,
  analysisKey,
  cachedSelection,
  requestInsights,
} from '../insights/service'
import type { AISelection } from '../insights/protocol'
import { Modal } from './UI'

export default function AIInsights({ data, month }: { data: AppData; month: string }) {
  const today = localDate()
  const analysis = useMemo(() => {
    try {
      return { value: analyzeFinances(data, month, today), error: '' }
    } catch (e) {
      return { value: null, error: e instanceof Error ? e.message : 'Analisis belum tersedia.' }
    }
  }, [data, month, today])
  if (!analysis.value)
    return (
      <section className="panel insights-panel">
        <h2>AI Insights</h2>
        <p role="alert">{analysis.error}</p>
      </section>
    )
  return <InsightsContent data={data} analysis={analysis.value} />
}

function InsightsContent({
  data,
  analysis,
}: {
  data: AppData
  analysis: ReturnType<typeof analyzeFinances>
}) {
  const { cloud } = useBudgetData()
  const report = useMemo(() => localInsights(analysis), [analysis])
  const [question, setQuestion] = useState<Question>('overview')
  const payload = JSON.stringify(aggregatePayload(analysis, report, question))
  const identity = JSON.stringify([cloud.viewKey, aiConfiguration.model, payload])
  const [result, setResult] = useState<{
    identity: string
    selection: AISelection
    cached: boolean
  } | null>(null)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [consent, setConsent] = useState(false)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => {
    activateInsightsWorkspace(cloud.viewKey)
    const request = new AbortController()
    controller.current = request
    setBusy(false)
    setError('')
    setConsent(false)
    setResult(null)
    void analysisKey(cloud.viewKey, aiConfiguration.model, payload)
      .then((key) => {
        if (request.signal.aborted) return
        const saved = cachedSelection(sessionStorage, key, report)
        if (saved) setResult({ identity, selection: saved, cached: true })
      })
      .catch(() => {
        /* Local insights work without secure-context hashing or storage. */
      })
    return () => request.abort()
  }, [identity, payload, cloud.viewKey, report])
  const current = result?.identity === identity ? result : null
  const label = (text: string) =>
    text.replace(/Kategori [0-9]+/g, (alias) => {
      const category = analysis.categories.find((c) => c.alias === alias)
      return data.categories.find((c) => c.id === category?.categoryId)?.name ?? alias
    })
  const findings = current
    ? report.findings
        .filter(
          (f) =>
            current.selection.findings.includes(f.id) ||
            ['limited', 'projection-risk', 'budget', 'future'].includes(f.id),
        )
        .sort((a, b) => {
          const rank = (id: string) => {
            const i = current.selection.findings.indexOf(id)
            return i < 0 ? -1 : i
          }
          return rank(a.id) - rank(b.id)
        })
    : report.findings
  const recommendations = current
    ? current.selection.recommendations.map((id) =>
        report.recommendations.find((r) => r.id === id)!,
      )
    : report.recommendations
  const run = async () => {
    setConsent(false)
    const signal = controller.current?.signal
    if (!signal || signal.aborted || busy) return
    setBusy(true)
    setError('')
    try {
      if (!aiConfiguration.ready) throw new Error(aiConfiguration.reason)
      const key = await analysisKey(cloud.viewKey, aiConfiguration.model, payload)
      signal.throwIfAborted()
      const response = await requestInsights({
        key,
        payload,
        report,
        cache: sessionStorage,
        quota: localStorage,
        signal,
        online: navigator.onLine,
        generate: async (input, requestSignal) =>
          (await import('../insights/gemini')).generateInsights(input, requestSignal),
      })
      if (!signal.aborted) setResult({ identity, ...response })
    } catch (e) {
      if (!signal.aborted) setError(aiErrorMessage(e))
    } finally {
      if (!signal.aborted) setBusy(false)
    }
  }
  return (
    <section className="panel insights-panel" aria-labelledby="insights-title">
      <div className="insights-header">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} /> MYBUDGET
          </span>
          <h2 id="insights-title">AI Insights</h2>
          <p>Pahami angka, rencanakan langkah berikutnya.</p>
        </div>
        <span className="insights-badge">
          {current ? 'Dibantu Gemini · angka dari aplikasi' : 'Analisis otomatis · di perangkat'}
        </span>
      </div>
      <div className="insights-summary">
        <h3>Ringkasan kondisi keuangan</h3>
        <p>{report.summary}</p>
      </div>
      <div className="insights-columns">
        <div>
          <h3>Temuan utama</h3>
          <ul>
            {findings.map((f) => (
              <li key={f.id}>{label(f.text)}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Rekomendasi</h3>
          <ul>
            {recommendations.map((r) => (
              <li key={r.id}>{r.text}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="insights-categories">
        <h3>Kategori yang perlu diperhatikan</h3>
        {!analysis.categories.length ? (
          <p>Belum ada pengeluaran atau alokasi kategori pada bulan ini.</p>
        ) : (
          <ul>
            {analysis.categories.map((c) => (
              <li key={c.categoryId}>
                <strong>
                  {data.categories.find((category) => category.id === c.categoryId)?.name ??
                    c.alias}
                </strong>
                <span>
                  Terpakai {money(c.spent)} ·{' '}
                  {c.limit === null
                    ? 'Belum ada alokasi'
                    : `${c.remaining! < 0 ? 'Melebihi' : 'Sisa'} ${money(Math.abs(c.remaining!))} dari ${money(c.limit)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="insights-controls">
        <label htmlFor="insights-question">Pertanyaan untuk AI</label>
        <select
          id="insights-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value as Question)}
          disabled={busy}
        >
          {Object.entries(questions).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
        <button
          className="button button-primary"
          disabled={busy || !aiConfiguration.ready || !analysis.transactionCount}
          onClick={() => (current ? void run() : setConsent(true))}
        >
          {busy ? <LoaderCircle size={17} className="insights-spin" /> : <Sparkles size={17} />}
          {busy ? 'Menganalisis…' : 'Analisis dengan AI'}
        </button>
        <p className="insights-help" role="status">
          {!aiConfiguration.ready
            ? aiConfiguration.reason
            : !analysis.transactionCount
              ? 'Catat transaksi terlebih dahulu. Tidak ada data yang dikirim ke AI.'
              : busy
                ? 'Meminta penjelasan Gemini. Data keuangan tetap dapat digunakan.'
                : current
                  ? 'Hasil tersimpan untuk ringkasan dan pertanyaan ini; menekan tombol lagi tidak mengirim permintaan baru.'
                  : 'Opsional. Ringkasan hanya dikirim setelah persetujuan; maksimal lima permintaan per perangkat per hari, jeda satu menit.'}
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <small>
          AI membantu memprioritaskan temuan terverifikasi. Semua angka dan penjelasan berasal dari
          perhitungan aplikasi. Bukan nasihat keuangan profesional.
        </small>
      </div>
      {consent && (
        <Modal
          title="Kirim ringkasan ke Gemini?"
          subtitle="Analisis otomatis tetap tersedia jika kamu memilih batal."
          onClose={() => setConsent(false)}
        >
          <div className="insights-consent">
            <ShieldCheck size={25} />
            <p>
              Google akan menerima ringkasan pemasukan, pengeluaran, anggaran, perbandingan bulan,
              dan kategori anonim untuk {analysis.month}. Nama kategori kustom, nama pengguna,
              rekening, catatan, dan riwayat transaksi mentah tidak dikirim.
            </p>
            <p>
              Data pada Gemini Developer API Free Tier dapat dipakai Google untuk meningkatkan
              layanannya sesuai ketentuan yang berlaku. Kirim hanya jika kamu nyaman. App Check
              memakai reCAPTCHA untuk melindungi akses.
            </p>
            <details>
              <summary>Lihat ringkasan yang akan dikirim</summary>
              <pre>{JSON.stringify(JSON.parse(payload), null, 2)}</pre>
            </details>
            <div className="modal-actions">
              <button className="button button-secondary" onClick={() => setConsent(false)}>
                Batal
              </button>
              <button className="button button-primary" onClick={() => void run()}>
                Setuju dan analisis
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}
