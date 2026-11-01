import type { InsightReport } from './engine'

export interface AISelection {
  findings: string[]
  recommendations: string[]
}
export function validateSelection(value: unknown, report: InsightReport): AISelection {
  if (!value || typeof value !== 'object') throw new Error('Format penjelasan AI tidak valid.')
  const selection = value as Record<string, unknown>
  if (Object.keys(selection).some((k) => !['findings', 'recommendations'].includes(k)))
    throw new Error('AI mengembalikan konten yang tidak didukung.')
  const check = (key: 'findings' | 'recommendations') => {
    const values = selection[key]
    if (
      !Array.isArray(values) ||
      !values.length ||
      values.length > 5 ||
      values.some((id) => typeof id !== 'string' || !report[key].some((item) => item.id === id))
    )
      throw new Error(
        'Temuan AI tidak cocok dengan hasil perhitungan. Analisis otomatis tetap digunakan.',
      )
    return [...new Set(values)] as string[]
  }
  return { findings: check('findings'), recommendations: check('recommendations') }
}

export const systemInstruction = `Anda membantu mahasiswa memahami MyBudget dalam bahasa Indonesia yang ramah dan tidak menghakimi.
Input hanya agregat keuangan dan temuan serta saran yang dihitung aplikasi. Tidak ada data transaksi mentah.
Jawab pertanyaan dengan memilih dan mengurutkan maksimal lima ID findings dan maksimal lima ID recommendations yang relevan dari input.
Jangan menghitung angka baru, menambahkan fakta, mengarang target tabungan, atau menyimpulkan kategori besar pasti boros.
Utamakan peringatan batas anggaran, keterbatasan data, dan perbandingan bulan berjalan yang belum setara durasi.
Nama kategori disamarkan. Jangan meminta identitas, rekening atau catatan. Jangan membuat atau mengubah transaksi.
Kembalikan hanya JSON {"findings":["ID"],"recommendations":["ID"]}. Penjelasan dan semua angka akan dirender aplikasi dari temuan yang telah diverifikasi.`
