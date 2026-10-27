# MyBudget

Aplikasi personal budgeting untuk mahasiswa, dibangun dengan **React + TypeScript + Vite + Tailwind CSS + Lucide React + Recharts**. MyBudget merupakan PWA yang dapat dipasang di Android dan digunakan offline setelah application shell tersimpan. Tanpa backend, autentikasi, atau database cloud.

## Menjalankan aplikasi

Gunakan Node.js **24 LTS** dan npm. Versi dependency dikunci melalui `package-lock.json`.

```bash
cd /workspace/MyBudget # atau folder checkout lokal kamu
npm ci
npm run dev
```

Vite menampilkan alamat localhost pada terminal. Development server mendukung hot reload; service worker sengaja hanya diaktifkan pada build produksi agar cache tidak mengganggu pengembangan.

### Membuka Web Preview

Jalankan `npm run dev` dari folder proyek dan biarkan prosesnya tetap aktif. Konfigurasi Vite mengikat server ke **`0.0.0.0:5173`** dengan `strictPort`, sehingga port tidak berpindah diam-diam. Pada Web Preview yang mendukung penerusan port HTTP, pilih **port 5173**, path **`/`** (atau `/#dashboard`), kemudian refresh panel. Proses server perlu dijalankan lagi setelah environment dipulihkan atau dimulai ulang; snapshot filesystem tidak menyimpan proses yang sedang berjalan.

Build yang sukses tidak otomatis menjalankan server. Web Preview harus meneruskan HTTP dari development server; membuka source `.tsx` sebagai visualisasi tidak menjalankan proyek Vite. Pada onboarding cloud yang tidak menyediakan penerusan localhost, gunakan deployment HTTPS Vercel/Netlify sesuai panduan di bawah.

Untuk memeriksa server yang sedang berjalan dengan browser debugging:

```bash
npm run check:preview
```

Perintah ini memeriksa HTTP 200, Dashboard desktop/mobile, navigasi, simpan transaksi dan reload, serta console error/import/network. Data uji berada di profil browser terisolasi. Screenshot ditulis ke `test-results/preview/` (diabaikan Git). Chromium perlu tersedia seperti pada bagian pengujian. Alamat dapat diganti melalui `MYBUDGET_PREVIEW_URL` untuk memeriksa rute HTTP preview yang benar-benar tersedia.

Jika HTTP mengembalikan `403 Blocked request. This host is not allowed`, proxy preview meneruskan hostname yang belum diizinkan Vite. Tambahkan **hostname preview yang sebenarnya** menggunakan dukungan Vite, lalu jalankan ulang server:

```bash
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=hostname-preview-kamu npm run dev
```

Jangan gunakan placeholder tersebut sebagai hostname nyata atau menonaktifkan pemeriksaan host untuk seluruh domain. Jika HTTP 200 dan pemeriksaan browser berhasil tetapi panel tetap menampilkan `An error occurred inside the visualization`, rute/panel Web Preview perlu diperiksa; pesan itu bukan pesan error yang dibuat oleh MyBudget. Catat port, hostname, dan respons HTTP untuk membedakan masalah proxy/panel dari error React. Jangan hapus data browser sebagai langkah awal troubleshooting.

Untuk menguji produksi dan PWA:

```bash
npm run build
npm run preview
```

Preview menggunakan port 4173 secara default. HTTP `localhost` merupakan secure context yang didukung untuk pengujian service worker. Alamat IP LAN dengan HTTP biasa **tidak memenuhi** persyaratan instalasi PWA Android; gunakan deployment HTTPS untuk ponsel.

## Fitur

- Dashboard saldo kumulatif, pemasukan/pengeluaran bulan terpilih, sisa anggaran, arus keuangan enam bulan, distribusi kategori, dan lima transaksi terakhir.
- Tambah, edit, hapus dengan konfirmasi; pencarian catatan/kategori; filter jenis, kategori, serta bulan dan tahun.
- Empat kategori pemasukan dan delapan kategori pengeluaran bawaan, masing-masing dengan warna/ikon. Kategori kustom dapat ditambahkan di Pengaturan.
- Anggaran total dan alokasi kategori yang terpisah untuk setiap bulan; indikator aman, mendekati batas (≥80%), atau berlebih. Total alokasi tidak dapat melebihi anggaran total.
- Donut chart kategori, bar chart enam bulan, peringkat pengeluaran, rata-rata harian, dan perbandingan bulan sebelumnya. Seluruh angka berasal dari transaksi; **tidak ada data dummy**.
- Penyimpanan localStorage, sinkronisasi perubahan antartab pada origin yang sama, dark mode persisten, empty states, dan notifikasi hasil penyimpanan.
- Ekspor CSV hasil filter atau seluruh transaksi; backup/restore JSON dengan validasi skema dan konfirmasi penggantian; konfirmasi sebelum reset data.
- Sidebar desktop, bottom navigation mobile, tombol (+) cepat, input nominal dengan numeric keypad, serta dialog yang mendukung keyboard dan Escape.
- Manifest lengkap, ikon 192/512 px dan maskable, cache seluruh application shell termasuk halaman lazy-loaded, indikator offline, dan prompt pembaruan service worker.

## Aturan perhitungan

- Nominal berupa **integer Rupiah**, lebih dari nol, maksimal Rp1 triliun per transaksi. Maksimum 5.000 transaksi dan 200 kategori pada versi ini menjaga agregasi tetap dalam rentang integer aman JavaScript.
- Pemasukan menambah saldo; pengeluaran menguranginya. Anggaran merupakan batas dan **tidak mengurangi saldo**.
- Saldo mengakumulasi seluruh transaksi sampai **tanggal acuan yang dapat dipilih** pada kartu saldo. Default-nya hari ini untuk bulan berjalan, atau hari terakhir bulan lain. Transaksi setelah tanggal acuan tidak masuk saldo tersebut.
- Ringkasan bulanan, anggaran, grafik distribusi, dan laporan mengikuti **bulan dan tahun terpilih**, termasuk transaksi bertanggal mendatang di bulan itu.
- Anggaran total menghitung setiap transaksi pengeluaran satu kali, termasuk kategori tanpa alokasi. Anggaran kategori hanya menghitung kategori tersebut. Sisa alokasi berbeda dari sisa anggaran: alokasi adalah rencana, sisa anggaran adalah total batas dikurangi pengeluaran aktual.
- Rata-rata harian adalah total pengeluaran bulan dibagi seluruh hari kalender dalam bulan itu, dibulatkan ke Rupiah. Perbandingan persentase ditandai belum tersedia jika pengeluaran bulan sebelumnya nol.
- Tanggal disimpan sebagai `YYYY-MM-DD` dari kalender lokal; tidak menggunakan konversi UTC untuk transaksi. Urutan berdasarkan tanggal terbaru, kemudian urutan penambahan terbaru jika tanggal sama.

## Instalasi Android

1. Deploy ke Vercel atau Netlify melalui HTTPS (panduan di bawah).
2. Buka alamat aplikasi di **Chrome Android**, lalu tunggu aplikasi selesai memuat.
3. Buka **Pengaturan → Install App** saat tombol tersedia. Alternatif: menu Chrome **⋮ → Tambahkan ke layar utama → Instal**. Nama menu dapat berbeda menurut versi Chrome.
4. Buka MyBudget dari ikon di layar utama. Manifest menyediakan nama, ikon, warna, mode standalone, dan splash screen yang dibuat Android.
5. Tunggu indikator **Siap digunakan offline** di Pengaturan. Setelah itu aplikasi dapat dibuka, berpindah halaman, serta mencatat transaksi tanpa internet.

Prompt instalasi ditentukan browser dan mungkin tidak muncul jika aplikasi sudah terpasang atau belum memenuhi kebijakan browser. Instalasi tidak memerlukan Play Store. Tombol pembaruan hanya memuat ulang setelah konfirmasi; simpan form terlebih dahulu. Versi data `1` divalidasi terpisah dari cache service worker sehingga pembaruan aset tidak menghapus transaksi. Backup versi yang belum dikenali ditolak, bukan dipaksa dimigrasikan.

## Deploy HTTPS

Konfigurasi untuk kedua penyedia sudah tersedia. Tidak ada deployment yang dijalankan otomatis oleh aplikasi.

**Vercel:** impor repository, gunakan preset Vite, Node 24, build `npm run build`, output `dist`. `vercel.json` menyediakan fallback SPA dan header cache untuk service worker/manifest.

**Netlify:** impor repository; `netlify.toml` menentukan Node 24, perintah build, dan folder publish. `public/_redirects` dan `_headers` disalin ke output build untuk fallback SPA serta cache.

Keduanya menyediakan HTTPS pada domain deployment. Aplikasi dikonfigurasi untuk root domain (`/`), bukan subfolder. Gunakan domain tetap: data localStorage terpisah untuk setiap origin, termasuk preview URL yang berbeda.

## Pengujian

```bash
npm test                 # perhitungan keuangan dan validasi data
npm run typecheck        # pemeriksaan TypeScript
npm run build            # pemeriksaan TypeScript + produksi + service worker
npx playwright install chromium  # sekali jika Chromium belum tersedia
npm run test:e2e         # desktop Chromium + emulasi Pixel 7
```

Playwright otomatis memakai `/usr/bin/chromium` bila tersedia, atau browser bawaan Playwright. Override dengan `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` jika perlu. E2E menjalankan production preview pada port 4173 dan mencakup CRUD, pencarian/filter, perubahan anggaran, CSV, JSON backup/restore, pemulihan data rusak, persistensi, dark mode, tampilan 320–1280 px, manifest, pemeriksaan installability Chromium, serta pencatatan dan reload offline. Emulasi Android tidak menggantikan uji pemasangan manual pada perangkat fisik.

CI GitHub Actions menjalankan unit tests, build, dan browser tests. Untuk meregenerasi ikon dari `public/icon.svg`, gunakan `npm run icons`.

## Struktur source

```text
src/
  components/     # Navigation, SummaryCard, TransactionList, BudgetProgress,
                  # TransactionForm, BudgetForm, CategoryChart, MonthlyChart, Modal
  hooks/          # penyimpanan persisten dan lifecycle PWA
  lib/            # perhitungan uang/tanggal, validasi backup, ekspor, unit tests
  pages/          # Dashboard, Transactions, Budgets, Analytics, Settings
  App.tsx         # navigasi dan orkestrasi state/dialog
  types.ts        # kontrak data versi 1
  index.css       # Tailwind, tema, komponen dan layout responsif
public/           # ikon, aturan deployment, aset statis
tests/            # skenario E2E Playwright
scripts/          # regenerasi ikon
```

## Batasan data lokal

Data hanya tersimpan pada browser dan origin yang digunakan, tanpa sinkronisasi antarperangkat atau enkripsi aplikasi. Penghapusan data browser, kehilangan perangkat, dan mode samaran dapat menghilangkan catatan. **Backup JSON secara rutin**, simpan file secara pribadi, dan unduh backup sebelum restore/reset. CSV hanya berisi transaksi dan tidak menggantikan backup JSON.

Kegagalan baca/validasi tidak menimpa data asli. Pengaturan menyediakan unduhan data mentah untuk pemulihan. Kegagalan tulis menampilkan error dan tidak dianggap berhasil. Untuk versi lanjutan, penyimpanan dapat dipindahkan ke IndexedDB, ditambah migrasi skema, transaksi berulang, dan sinkronisasi opsional dengan kontrol pengguna.
