# MyBudget AI Insights — panduan aktivasi gratis

Fitur ada di **Analisis → AI Insights**. Analisis otomatis langsung bekerja di perangkat, termasuk saat offline, tanpa layanan AI. Sinkronisasi Firebase, backup/restore JSON, CSV, anggaran, dan PWA tetap berjalan seperti sebelumnya.

**Status implementasi:** integrasi Firebase AI Logic sudah tersedia, tetapi Gemini secara default **nonaktif**. Belum ada pengujian langsung ke Gemini atau App Check pada project produksi kamu. Tes kode memakai respons AI simulasi; tes sinkronisasi memakai Firebase Emulator. Tidak ada layanan atau paket berbayar yang diaktifkan oleh kode ini.

## 1. Pastikan paket tetap gratis

1. Buka [Firebase Console](https://console.firebase.google.com/) dan pilih project MyBudget yang sama dengan aplikasi.
2. Pastikan paket pada bagian bawah navigasi adalah **Spark**. Tetap gunakan Vercel **Hobby**.
3. Buka **Build → AI Logic** (atau cari “AI Logic” pada menu produk), lalu **Get started**.
4. Pilih **Gemini Developer API**. Jangan pilih Vertex AI/Agent Platform atau menghubungkan akun penagihan.
5. Ikuti wizard aktivasi API. Firebase mengelola akses Gemini melalui proxy AI Logic. Jika Console membuat Gemini API key, **jangan salin key tersebut ke aplikasi atau ke Vercel**. Kode menggunakan `firebase/ai` dan konfigurasi Firebase Web App yang sudah ada.
6. Jika suatu langkah meminta upgrade Blaze, billing, kartu pembayaran, atau layanan yang tidak tersedia tanpa biaya, **berhenti dan biarkan Gemini nonaktif**. Analisis lokal sudah berfungsi.

## 2. Pilih model yang benar-benar tersedia gratis saat aktivasi

Daftar model, tanggal penghentian, wilayah, kuota, dan ketentuan Free Tier dapat berubah. Akses dokumentasi Firebase/Google dari workspace implementasi ini dibatasi jaringan, sehingga **tidak ada nama model default yang diklaim masih gratis pada tanggal implementasi**.

1. Periksa [model Firebase AI Logic](https://firebase.google.com/docs/ai-logic/models), [harga Gemini Developer API](https://ai.google.dev/gemini-api/docs/pricing), dan [harga AI Logic](https://firebase.google.com/docs/ai-logic/pricing).
2. Pilih model teks ringan yang **masih didukung AI Logic**, memiliki kolom **Free Tier** untuk input/output, tersedia pada project/negara kamu, dan mendukung **structured JSON output**. Utamakan varian **Flash-Lite** jika ada yang memenuhi semua syarat; gunakan Flash hanya jika juga memenuhi syarat gratis tersebut.
3. Salin **ID model yang tepat**, bukan nama pemasaran atau nama alias “latest”. Jangan menyalin model dari tutorial lama tanpa memeriksa dukungannya sekarang.
4. Jika tidak ada model yang memenuhi syarat, biarkan AI nonaktif. Aplikasi tidak berpindah model, provider, atau paket secara otomatis.

`VITE_FIREBASE_AI_FREE_TIER_CONFIRMED=true` adalah pernyataan bahwa pemilik deployment sudah melakukan pemeriksaan ini. Variabel tersebut **tidak dapat memeriksa billing secara otomatis**, tidak menjamin model akan selalu gratis, dan tidak mengubah paket Firebase. Pertahankan Spark dan periksa kembali sebelum mengganti model.

## 3. Lindungi akses dengan App Check

1. Siapkan domain HTTPS Vercel yang akan dipakai. Untuk tes awal, gunakan domain deployment tetap, bukan hostname preview yang berubah setiap deploy.
2. Di Firebase Console buka **Build → App Check**, pilih Web App MyBudget, lalu **Register**.
3. Pilih penyedia **reCAPTCHA v3**. Buat pasangan key melalui tautan Console jika belum ada, dengan domain Vercel/domain kustom yang sesuai. Pilih versi v3 berbasis skor, bukan checkbox v2 atau Enterprise.
4. Masukkan key yang diminta **hanya di Console**. Secret key reCAPTCHA tidak masuk frontend. Yang dipasang di Vercel hanya **public site key** untuk `VITE_FIREBASE_APP_CHECK_SITE_KEY`.
5. Kode menggunakan `ReCaptchaV3Provider`. Jika akun Console hanya menawarkan penyedia lain atau meminta billing, jangan mengaktifkannya untuk tutorial ini; pertahankan analisis lokal.
6. Ikuti langkah environment variables dan redeploy di bawah. Lakukan satu pengujian, periksa metrik App Check untuk permintaan valid, kemudian aktifkan **Enforce** untuk **Firebase AI Logic** sebelum membagikan fitur ke pengguna lain. Lokasi tombol bisa berbeda mengikuti versi Console.
7. Jangan menyalakan enforcement untuk Authentication/Firestore tanpa menguji alur kedua produk tersebut secara terpisah. Perubahan ini hanya menambahkan App Check pada penggunaan AI yang disetujui pengguna; tidak mengubah Security Rules Firestore atau cara startup sinkronisasi.
8. Periksa pengaturan rate limit/kuota Firebase AI Logic yang tersedia di Console dan gunakan batas rendah untuk pengujian. **App Check harus benar-benar enforced di server**; site key dan domain saja tidak cukup melindungi API dari penyalahgunaan.

Jangan memasang App Check debug token di Vercel atau source Git. Uji produksi melalui HTTPS dengan site key/domain yang benar. Bila perlu mencoba localhost, daftarkan localhost pada konfigurasi reCAPTCHA untuk pengembangan saja. Emulator sinkronisasi sengaja tidak memanggil AI.

## 4. Isi variabel di Vercel, lalu deploy ulang

Merge branch perubahan ini ke branch yang dideploy. Buka **Vercel → project MyBudget → Settings → Environment Variables**. Pertahankan semua `VITE_FIREBASE_*` yang sudah dipakai login/sinkronisasi, lalu tambahkan:

| Nama                                   | Nilai                                               |
| -------------------------------------- | --------------------------------------------------- |
| `VITE_FIREBASE_AI_ENABLED`             | `true`, setelah langkah Console selesai             |
| `VITE_FIREBASE_AI_FREE_TIER_CONFIRMED` | `true`, setelah memeriksa Spark dan Free Tier model |
| `VITE_FIREBASE_AI_MODEL`               | ID model yang lolos pemeriksaan langkah 2           |
| `VITE_FIREBASE_APP_CHECK_SITE_KEY`     | Public site key reCAPTCHA v3                        |

Pilih scope **Production**. Aktifkan pada **Preview** hanya jika domain preview sudah didaftarkan dengan benar. Klik Save lalu **Deployments → Redeploy**. Vite memasukkan variabel saat build, sehingga Save tanpa redeploy belum mengubah aplikasi. Pada PWA yang sudah terpasang, terima pembaruan aplikasi dan buka ulang setelah antrean transaksi tersinkron.

Untuk lokal, salin `.env.example` ke `.env.local`, isi konfigurasi di komputer sendiri, dan restart `npm run dev`. Jangan commit `.env.local`. Semua variabel `VITE_*` bersifat publik pada bundle; jangan masukkan password, private key, reCAPTCHA secret, Admin SDK credential, atau Gemini API key ke sana.

Untuk menonaktifkan Gemini, ganti `VITE_FIREBASE_AI_ENABLED=false` dan redeploy. Perhitungan dan fitur budgeting tidak berubah.

## 5. Cara memakai dan menguji

1. Buka deployment HTTPS terbaru di laptop, lalu **Analisis**. Pilih bulan yang mempunyai transaksi. Ringkasan otomatis muncul tanpa mengirim permintaan AI.
2. Pilih salah satu pertanyaan yang tersedia dan tekan **Analisis dengan AI**. Baca pemberitahuan privasi. Buka “Lihat ringkasan yang akan dikirim” bila ingin memeriksanya. Pilih **Batal** untuk tetap memakai analisis lokal tanpa pengiriman.
3. Jika setuju, tekan **Setuju dan analisis**. Loading muncul, lalu label berubah menjadi **Dibantu Gemini** bila respons lolos validasi. Periksa metrik App Check/AI Logic untuk memastikan permintaan benar-benar diterima. Jangan menganggap fitur aktif hanya karena build berhasil.
4. Tekan tombol lagi untuk data/bulan/pertanyaan sama: hasil dari cache sesi dipakai, tanpa panggilan tambahan. Refresh pada tab yang sama mempertahankan cache. Mengubah catatan atau nama tidak perlu permintaan baru apabila agregat tidak berubah.
5. Ubah nominal transaksi, pilih pertanyaan/bulan lain, atau ganti akun: hasil lama tidak ditampilkan untuk konteks baru. Permintaan baru tetap memerlukan persetujuan. Tunggu satu menit jika terkena pembatasan lokal.
6. Mode airplane/offline tetap menampilkan analisis lokal dan hasil cache yang cocok. Permintaan baru ditolak tanpa menghilangkan data. Saat online kembali, AI tidak dipanggil otomatis.
7. Uji kuota habis atau konfigurasi model salah pada environment uji. Pesan error harus muncul, analisis otomatis tetap ada, dan transaksi/budget tidak berubah. Perbaiki konfigurasi lalu redeploy, bukan upgrade paket.
8. Pada Android, login Google dengan akun yang sama. Perubahan transaksi dari laptop tetap tersinkron melalui fitur cloud yang ada; ringkasan dihitung ulang dari data perangkat. Hasil AI tidak ditulis ke Firestore atau dibagikan antarperangkat.

## Apa yang dianalisis?

- Total pemasukan, pengeluaran, dan selisih untuk bulan/tahun terpilih. Selisih bulanan tidak dianggap saldo kumulatif atau tabungan yang sudah dipisahkan.
- Penggunaan anggaran total, sisa setiap kategori, kategori pengeluaran terbesar, serta indikator mendekati batas (80%) dan melebihi batas.
- Perubahan terhadap total bulan sebelumnya. Pembanding nol menghasilkan “belum dapat dihitung”, bukan persentase tak terhingga. Perbandingan bulan berjalan diberi keterangan durasi belum setara.
- Rata-rata harian yang sama dengan Analytics lama: total pengeluaran dibagi seluruh hari kalender bulan. Juga ditampilkan laju sampai tanggal acuan untuk proyeksi.
- Untuk bulan berjalan, proyeksi = pengeluaran sampai hari ini ÷ jumlah hari berlalu × jumlah hari bulan tersebut, dibulatkan ke Rupiah terdekat. Total pengeluaran yang sudah tercatat (termasuk tanggal mendatang) menjadi batas bawah. Bulan lalu memakai total aktual, bulan mendatang tidak diproyeksikan. Ini perkiraan dari catatan, bukan kepastian.
- Engine mendukung target tabungan opsional jika target dan jumlah yang benar-benar disisihkan diberikan. Skema MyBudget sekarang belum menyimpan target tersebut, sehingga UI menjelaskan keterbatasannya dan tidak mengarang target atau menganggap selisih bulanan sebagai tabungan.

Perhitungan Rupiah memakai integer dengan `BigInt` pada penjumlahan/intermediate pembagian. Overflow ditolak tanpa mengubah sumber data. AI tidak menghitung angka.

## Privasi, cara kerja AI, dan batas kuota

AI menerima agregat periode terpilih, pembanding bulan sebelumnya, kategori anonim, dan daftar temuan/saran yang sudah diverifikasi. Nama, email, UID, ID transaksi, nama kategori kustom, rekening dan catatan **tidak disertakan dalam payload**. SDK/reCAPTCHA tetap memproses data teknis layanan sesuai kebijakan Google. Data Gemini Developer API Free Tier dapat digunakan Google untuk meningkatkan layanannya; baca [ketentuan penggunaan](https://ai.google.dev/gemini-api/terms) sebelum menyetujui pengiriman ringkasan keuangan.

Untuk menjamin angka tidak berhalusinasi, respons Gemini dibatasi menjadi pilihan/urutan ID temuan dan rekomendasi yang tersedia. MyBudget merender penjelasan bahasa Indonesia beserta angka dari engine. Respons dengan angka baru, ID tidak dikenal, atau konten bebas ditolak. UI selalu mempertahankan peringatan anggaran dan keterbatasan data. Fitur ini menjawab pertanyaan pilihan yang tersedia, bukan chatbot bebas, dan tidak memiliki alat untuk membuat/mengubah transaksi.

Cache menyimpan pilihan ID dalam **sessionStorage**, dipisahkan menggunakan fingerprint agregat + pertanyaan + model + workspace akun. Catatan/nama tidak masuk fingerprint. Cache dibatasi 20 hasil, bertahan pada refresh tab, dan dibersihkan ketika logout/pergantian akun. Menutup sesi browser bisa menghilangkan cache. Cache tidak disinkronkan ke Firestore; perangkat berbeda dapat memakai kuota masing-masing.

Maksimal **5 percobaan per hari lokal per profil browser**, jeda **60 detik**, payload maksimal 24.000 karakter dan output maksimal 1.024 token. Batas waktu keseluruhan 35 detik mencakup App Check; permintaan model sendiri dibatasi 25 detik. Percobaan gagal tetap dihitung. Tidak ada retry AI otomatis atau model berbayar cadangan. Kuota lokal disimpan tanpa data keuangan, dan tidak di-reset karena logout. Web Locks mengoordinasikan permintaan antartab pada browser yang mendukungnya. Pembatas browser dapat dihapus/dilewati pengguna, sehingga bukan batas keamanan global; enforce App Check dan batas kuota provider tetap diperlukan. Kode tidak bisa menjamin biaya Rp0 jika pemilik mengubah paket ke billing di luar aplikasi.

## Pemeriksaan kode

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:sync
```

Tes mencakup perhitungan, penyamaran data, persetujuan/batal, batas pemanggilan, cache, kegagalan AI, pembatalan hasil lama, dan kontrak Firebase AI Logic menggunakan mock. Tes browser memeriksa fallback Analytics, layout desktop/Android, dan offline PWA. Tes emulator mempertahankan pemeriksaan keamanan UID, migrasi, sinkronisasi, antrean offline, dan backup/restore. Tes tersebut tidak mengonsumsi Gemini Free Tier dan tidak membuktikan konfigurasi produksi Console kamu sudah aktif.
