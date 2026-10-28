# Panduan Firebase MyBudget untuk pemula

Upgrade ini memakai Firebase Authentication (Google) dan Cloud Firestore. Kamu tidak perlu membuat server, memberikan password Google, atau mengunduh private key. Aplikasi tetap bisa digunakan dalam mode lokal jika Firebase belum dikonfigurasi.

Sebelum mulai, buka **Pengaturan → Backup JSON** pada laptop dan Android yang sudah memiliki data. Simpan file itu secara pribadi. Data lokal tidak otomatis dihapus atau diunggah oleh upgrade ini.

## Jika project, Google Sign-In, Firestore, dan rules sudah selesai

Kamu dapat langsung melanjutkan konfigurasi deployment; tidak perlu membuat project atau database baru.

1. Pastikan branch `feat/firebase-sync` sudah digabungkan ke `main`, atau Vercel memang men-deploy branch yang memuat upgrade. Versi `main` sebelum merge tidak menampilkan fitur cloud.
2. Buka project yang sudah dibuat di **Firebase Console → roda gigi → Project settings → General → Your apps → aplikasi Web → SDK setup and configuration → Config**.
3. Ambil `apiKey`, `authDomain`, `projectId`, dan `appId` dari objek `firebaseConfig`. Jangan mengambil konfigurasi dari Service accounts. Nilai Project ID saja belum cukup untuk mengaktifkan SDK.
4. Masukkan ke **Vercel → project MyBudget → Settings → Environment Variables** menggunakan tabel pada langkah 5 di bawah. Pilih **Production**, dan **Preview** jika dipakai. Nilai cukup dimasukkan di panel Vercel; jangan membuat commit berisi objek `firebaseConfig` atau `.env.local`.
5. Tambahkan hostname aplikasi yang sebenarnya ke **Firebase Authentication → Settings → Authorized domains**. Gunakan nama domain saja, tanpa `https://` dan tanpa path.
6. Jalankan **Vercel → Deployments → Redeploy**. Vite membaca variabel ketika build, sehingga deployment lama tidak otomatis memakai nilai baru. Buka Pengaturan MyBudget untuk melihat nama variabel yang masih kurang pada build tersebut.
7. Pastikan rules yang sudah dipublikasikan sama dengan file `firestore.rules` terbaru dari branch upgrade; rules aplikasi ini juga memvalidasi receipt operasi dan alokasi anggaran. Login pada laptop dan Android memakai akun Google yang sama, pilih migrasi dengan konfirmasi, lalu tunggu **Synced**.

Untuk pengembangan lokal, isi nilai pada `.env.local` yang diabaikan Git, lalu mulai ulang development server. File lokal ini tidak ikut dikirim ke Vercel; tetap isi variabel Vercel secara terpisah. Jangan memasukkan password Google atau private key. Pengujian emulator memakai project demo dan tidak mengubah database project pribadi.

## 1. Buat project Firebase dan daftarkan aplikasi web

1. Buka [Firebase Console](https://console.firebase.google.com/) dan masuk menggunakan akun Google milikmu.
2. Pilih **Create a project / Tambahkan project**, beri nama misalnya **MyBudget**, lalu ikuti langkah pembuatan. Google Analytics boleh dinonaktifkan; sinkronisasi tidak memerlukannya.
3. Buka **Project settings** melalui ikon roda gigi di samping Project Overview.
4. Pada **Your apps**, klik ikon web **`</>`**, beri nama aplikasi **MyBudget Web**, lalu klik **Register app**. Firebase Hosting tidak wajib karena kamu menggunakan Vercel.
5. Pada bagian konfigurasi SDK, pilih **Config**. Biarkan halaman berisi objek `firebaseConfig` terbuka. Catat `apiKey`, `authDomain`, `projectId`, dan `appId`; dua field lain di bagian berikut opsional.

Objek konfigurasi aplikasi **web** bersifat publik dan akan masuk bundle frontend. Keamanan data ditentukan Firebase Auth dan Security Rules. **Jangan gunakan** menu **Service accounts → Generate new private key** untuk aplikasi ini. Jangan menaruh Admin SDK, file service-account, client secret, atau password Google di frontend.

## 2. Aktifkan login Google

1. Di Firebase Console, buka **Build → Authentication → Get started**.
2. Buka **Sign-in method / Sign-in providers**.
3. Pilih **Google**, aktifkan **Enable**.
4. Pilih email dukungan project bila diminta, lalu klik **Save**.

Pengguna nantinya login melalui halaman Google resmi. Aplikasi hanya menerima identitas Firebase Auth dan UID; aplikasi tidak meminta password Google secara langsung.

## 3. Buat database Firestore

1. Buka **Build → Firestore Database → Create database**.
2. Pilih database **`(default)`** dalam mode native bila ada pilihan.
3. Pilih lokasi yang dekat dengan pengguna, misalnya wilayah Indonesia atau Singapura yang tersedia. Lokasi database tidak dapat diubah begitu saja setelah dibuat.
4. Pilih **Production mode**, lalu selesaikan pembuatan.

Paket Spark bisa digunakan selama kebutuhanmu masih dalam kuota yang tersedia. Periksa tab Usage dan informasi paket Firebase untuk batas dan biaya. Jangan menggunakan rules test-mode yang mengizinkan semua orang membaca data.

## 4. Pasang Security Rules

1. Buka file **`firestore.rules`** dari source MyBudget terbaru di GitHub. Gunakan tombol **Raw / Copy raw file** agar seluruh isi tersalin.
2. Di Firebase Console buka **Firestore Database → Rules**.
3. Ganti isi editor dengan **seluruh isi file `firestore.rules`**, lalu klik **Publish**.
4. Pastikan Console tidak melaporkan error kompilasi. Bila ada, jangan menggantinya dengan `allow read, write: if true`; simpan pesan error untuk diperiksa.

Rules membatasi akses ke UID pemilik, memvalidasi nominal Rupiah bulat, kategori, tanggal, preferensi, revisi, timestamp server, dan operasi anggaran. Setiap penulisan aplikasi harus memiliki receipt operasi dalam transaksi Firestore yang sama. Penghapusan memakai tombstone agar edit offline lama tidak diam-diam menghidupkan kembali transaksi.

Tidak ada composite index tambahan yang dibutuhkan saat ini. Jika memakai CLI di komputer, alternatif pemasangan rules adalah:

```bash
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project ID_PROJECT_MILIKMU
```

Ganti `ID_PROJECT_MILIKmu` dengan `projectId` dari langkah 1, bukan nama tampilan. Jalankan hanya setelah memastikan project tujuan benar. File `firebase.json` dan `firestore.indexes.json` sudah disediakan. Tidak perlu memasukkan private key.

## 5. Masukkan konfigurasi Firebase ke Vercel

Pastikan source upgrade dari branch **`feat/firebase-sync`** sudah masuk ke branch yang dideploy Vercel. Cara umum: buat pull request ke `main`, periksa perubahan, lalu merge.

1. Buka [Vercel](https://vercel.com/), pilih project MyBudget.
2. Buka **Settings → Environment Variables**.
3. Tambahkan variabel berikut dari objek konfigurasi aplikasi **web** di Firebase. Pilih environment **Production**; pilih juga **Preview** bila ingin menguji branch preview.

| Nama di Vercel                      | Nilai dari Firebase Config                          |
| ----------------------------------- | --------------------------------------------------- |
| `VITE_FIREBASE_API_KEY`             | `apiKey`                                            |
| `VITE_FIREBASE_AUTH_DOMAIN`         | `authDomain`, biasanya `PROJECT_ID.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID`          | `projectId`                                         |
| `VITE_FIREBASE_APP_ID`              | `appId`                                             |
| `VITE_FIREBASE_STORAGE_BUCKET`      | `storageBucket` — opsional                          |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` — opsional                      |

Jangan menambahkan tanda kutip atau koma JavaScript pada nilai yang dimasukkan. **Empat field pertama wajib** untuk mengaktifkan fitur cloud. Storage bucket tidak berarti aplikasi mengunggah lampiran; fitur itu belum ditambahkan.

Vite membaca variabel ini **ketika build**. Menambahkan variabel tanpa build/deploy ulang tidak mengubah aplikasi yang sudah terpasang.

Untuk menjalankan dari komputer sendiri, salin `.env.example` menjadi `.env.local`, isi field yang sama, lalu mulai ulang `npm run dev`. File `.env.local` diabaikan Git. Untuk cloud development environment, isi variabel pada Environment Settings dan jalankan build ulang; ini terpisah dari pengaturan Vercel.

## 6. Tambahkan authorized domains

1. Di Firebase Console, buka **Authentication → Settings → Authorized domains**.
2. Klik **Add domain**, masukkan **hostname Vercel yang benar-benar kamu gunakan**, misalnya `mybudget-namamu.vercel.app`.
3. Gunakan domain dari projectmu sendiri, tanpa `https://`, tanpa path, dan tanpa tanda `/` di akhir. Jangan menyalin contoh sebagai domain nyata.
4. Jika memakai domain pribadi, tambahkan hostname itu juga. Domain deployment preview yang berbeda perlu ditambahkan sendiri jika dipakai untuk login.
5. Jika menguji project Firebase sungguhan di komputer lokal, tambahkan `localhost` secara manual jika belum ada. Project Firebase baru tidak selalu menambahkannya otomatis.

Biarkan `authDomain` memakai nilai dari Firebase Config. Login utama memakai popup Google. Jika popup diblokir, izinkan popup untuk domain aplikasi atau coba **Login lewat pengalihan**. Browser yang membatasi penyimpanan lintas situs dapat memerlukan konfigurasi tambahan untuk redirect; gunakan popup atau ikuti [panduan redirect resmi Firebase](https://firebase.google.com/docs/auth/web/redirect-best-practices). Untuk produksi di Vercel dengan redirect pada domain sendiri, ikuti konfigurasi proxy/authDomain pada panduan tersebut; jangan mengganti authDomain dengan domain Vercel tanpa menyediakan endpoint `/__/auth` yang sesuai.

## 7. Deploy ulang aplikasi

1. Di Vercel pastikan build command **`npm run build`**, output directory **`dist`**, dan Node.js **24**.
2. Buka **Deployments → deployment terbaru → Redeploy** setelah environment variables disimpan. Jika perubahan belum masuk branch production, deploy branch yang memuat upgrade dahulu atau merge pull request ke `main`.
3. Tunggu status **Ready**, lalu buka alamat **HTTPS** deployment itu.
4. Buka **Pengaturan** MyBudget. Jika masih terlihat “Sinkronisasi belum dikonfigurasi”, periksa empat nama variabel wajib dan deploy ulang.
5. Jika PWA lama masih terbuka di Android, simpan semua transaksi, tutup dan buka kembali aplikasi; bila muncul pembaruan, pilih **Perbarui**. Jangan menghapus data browser untuk memaksa pembaruan.

Build produksi biasa tidak memuat helper login emulator. **Jangan gunakan `--mode emulator` untuk deployment pengguna.** Mode itu hanya memakai project demo lokal, bukan Firebase milikmu.

## 8. Hubungkan laptop dan Android

Lakukan pertama kali saat kedua perangkat terhubung internet.

**Pada laptop yang memiliki data paling lengkap:**

1. Buka alamat HTTPS MyBudget yang sudah dideploy, lalu **Pengaturan**.
2. Centang **Ini perangkat pribadi saya** jika perangkat hanya digunakan orang yang dipercaya. Ini mengizinkan login tetap aktif, cache Firestore persisten, dan antrean perubahan yang bertahan saat browser dibuka kembali.
3. Klik **Login dengan Google**, pilih akun Google yang ingin digunakan untuk MyBudget.
4. Tunggu pemeriksaan data server. Aplikasi tidak menganggap akun kosong hanya berdasarkan cache offline.
5. Jika cloud kosong, pilih **Impor data lokal ke cloud**, baca ringkasannya, lalu konfirmasi. Salinan lokal lama tetap ada.
6. Tunggu indikator **Synced**.

**Pada Android:**

1. Buka **alamat HTTPS yang sama** di Chrome. Bila ingin, instal lagi melalui menu Chrome → Tambahkan ke layar utama → Instal.
2. Buka Pengaturan, pilih perangkat pribadi jika sesuai, lalu login menggunakan **akun Google yang sama** dengan laptop.
3. Pada pilihan migrasi, pilih **Gunakan data cloud**. Data lokal Android tetap disimpan terpisah dan tidak diunggah otomatis.
4. Buka Transaksi dan Anggaran. Data laptop akan tampil setelah listener menerima data akun tersebut.

**Jika lokal dan cloud sama-sama berisi data:**

- Pilih **Gabungkan · utamakan cloud** atau **Gabungkan · utamakan lokal**, lalu konfirmasi.
- ID transaksi yang sama tidak digandakan. Untuk ID dengan isi berbeda, versi yang dipilih menang. Anggaran pada bulan yang sama mengikuti satu versi lengkap saat migrasi; alokasi dua versi tidak dijumlahkan otomatis.
- Transaksi dengan ID berbeda dianggap transaksi berbeda walaupun tanggal dan nominalnya sama. Jika riwayat yang sama pernah dicatat ulang secara manual, pilih **Gunakan data cloud** untuk menghindari mengimpor kedua versi.
- Tombol **Gabungkan data lokal** di Pengaturan dapat dipakai kemudian, setelah antrean selesai.
- Salinan lokal asli tidak dihapus atau ditimpa. Backup sebelum migrasi tetap disarankan.

## 9. Uji hasilnya langkah demi langkah

| Pengujian        | Langkah                                                                          | Hasil yang diharapkan                                                                 |
| ---------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Laptop → Android | Tambahkan pengeluaran di laptop                                                  | Muncul di Android tanpa import JSON                                                   |
| Android → laptop | Ubah anggaran kategori di Android                                                | Anggaran laptop diperbarui otomatis                                                   |
| Offline          | Setelah Synced dan PWA siap offline, matikan jaringan Android, catat transaksi   | Status Offline dan label Tertunda muncul; saldo lokal ikut berubah                    |
| Kembali online   | Hidupkan jaringan Android                                                        | Antrean berkurang, status Synced, transaksi muncul satu kali di laptop                |
| Dua perubahan    | Tambah transaksi berbeda di laptop dan Android hampir bersamaan                  | Kedua transaksi tetap ada                                                             |
| Field berbeda    | Edit nominal di satu perangkat dan catatan transaksi yang sama di perangkat lain | Field berbeda digabungkan jika masing-masing benar-benar diubah                       |
| Akun berbeda     | Tunggu Synced, logout, login dengan akun Google lain                             | Workspace cloud sebelumnya disembunyikan; akun baru menjalani pilihan datanya sendiri |
| Backup/restore   | Backup JSON akun aktif, lalu restore dengan konfirmasi                           | Transaksi/kategori/budget dipulihkan dan perubahan disinkronkan ke akun aktif         |

**Jangan logout atau menutup browser ketika masih ada perubahan tertunda.** Tombol logout menolak operasi itu agar antrean tidak hilang. Pada perangkat bersama, cache hanya sementara per tab; tetap online sampai Synced dan buat backup sebelum menutup tab.

## 10. Arti status dan penanganan error

- **Lokal:** aplikasi memakai data perangkat, tidak mengirimnya ke cloud.
- **Syncing:** sedang membaca server atau mengirim antrean. Jumlah perubahan tertunda ditampilkan di status/Pengaturan.
- **Synced:** antrean kosong dan listener sudah memperoleh snapshot server.
- **Offline:** jaringan tidak tersedia; catatan ditahan di antrean perangkat.
- **Sync Error:** ada penolakan rules, sesi autentikasi bermasalah, cache penuh, atau konflik yang perlu diperiksa. Antrean tetap disimpan.

Untuk Sync Error, buka Pengaturan dan baca pesan yang ditampilkan. Periksa konfigurasi project dan Security Rules, pastikan akun yang benar aktif, lalu coba sinkronkan kembali. Jika sesi login bermasalah, pilih **Perbarui sesi Google** dan gunakan akun yang sama; ini memperbarui autentikasi tanpa membuang antrean. Jika ada konflik anggaran, jangan mengubah total secara sembarang; simpan **Backup JSON** tampilan saat ini dan **Unduh perubahan tertunda** terlebih dahulu. Pembatalan antrean memerlukan konfirmasi dan hanya membatalkan perubahan yang belum dikonfirmasi server; penulisan yang sudah diterima server tetap ada. File pemulihan antrean berisi operasi teknis dan bukan format Restore JSON biasa; simpan untuk bantuan pemulihan, jangan unggah ke situs publik.

Logout normal menghapus snapshot cloud aplikasi dan mengakhiri/membersihkan cache Firestore persisten. Jika cache masih dikunci tab MyBudget lain, layar akun ditahan dan aplikasi meminta tab itu ditutup sebelum melanjutkan. Antrean milik UID lama yang ditinggalkan akibat sesi kedaluwarsa tidak ditampilkan atau dikirim ke UID lain; masuk kembali dengan akun asal untuk memulihkannya. Data mode lokal lama tetap dipertahankan sesuai permintaan pengguna.

Perubahan field yang sama memakai **penulisan terakhir yang diterima server**, bukan jam perangkat. Tiap operasi memiliki ID, receipt idempotent, revision, `createdAt`, dan `updatedAt` server. Penghapusan mengalahkan edit lama; menghidupkan kembali data memerlukan restore/migrasi yang dikonfirmasi. Budget disimpan per bulan dan alokasi diubah satu kategori per transaksi server agar counter total tetap konsisten. Restore/migrasi besar dikirim bertahap, sehingga perangkat lain bisa melihat progres sebelum seluruh antrean selesai.

## Untuk pengembang: struktur dan pengujian

```text
users/{uid}/transactions/{id}
users/{uid}/categories/{id}
users/{uid}/budgets/{YYYY-MM}
users/{uid}/settings/preferences
users/{uid}/mutations/{operationId}  # receipt deduplikasi; bukan seluruh data aplikasi
```

Budget memiliki `total`, `limits`, `allocated`, dan `changedCategory`. Rules menjaga `allocated` secara induktif: dokumen baru memiliki alokasi kosong, lalu setiap update hanya boleh mengubah satu kategori dengan selisih counter yang benar. Penurunan total tidak boleh membuat alokasi melebihi total. Tidak ada dokumen tunggal yang berisi seluruh transaksi aplikasi.

```bash
npm ci
npm run typecheck
npm test                 # perhitungan + migrasi + antrean + controller dengan simulasi SDK
npm run build
npm run test:e2e         # regresi UI desktop/Android dan PWA tanpa konfigurasi Firebase
npm run test:sync        # Firebase Auth + Firestore Emulator, Rules dan E2E cloud
```

Untuk `test:sync`, pasang **Java 21+** dan Chromium (atau `npx playwright install chromium`). CLI mengunduh emulator resmi dan memverifikasi checksum. Akses `storage.googleapis.com` diperlukan untuk unduhan awal. Project pengujian selalu **`demo-mybudget`**, bukan project production; tidak memerlukan login Google sungguhan atau Admin key. Tes cloud memakai kredensial Google simulasi dari Auth Emulator dan helper yang hanya dihasilkan pada build emulator loopback. Pengujian OAuth Google sungguhan dan dua perangkat fisik dilakukan setelah konfigurasi project/deployment milikmu tersedia.

Jangan menghapus receipt/tombstone manual selama ada perangkat yang mungkin memiliki antrean lama: receipt mencegah replay menimpa edit lebih baru. Antrean dan cache tersimpan terpisah berdasarkan UID; localStorage asli memakai key `mybudget:v1` dan tidak ditimpa ketika cloud aktif.
