# PRD: Gudang Multi-Lokasi

## Latar Belakang dan Tujuan

Bisnis yang memiliki lebih dari satu gudang sering kehilangan jejak stok saat barang dipindahkan antar lokasi. Pencatatan manual (spreadsheet, buku, chat grup) membuat dua masalah berulang: stok di gudang asal dan gudang tujuan tidak pernah sinkron pada waktu yang sama, dan tidak ada riwayat yang bisa dilacak ketika muncul selisih antara stok sistem dan stok fisik.

Tujuan aplikasi ini adalah menyediakan satu sumber kebenaran (single source of truth) untuk stok di seluruh gudang, dengan tiga jaminan inti:

1. Transfer barang antar gudang selalu atomik: stok asal berkurang dan stok tujuan bertambah dalam satu transaksi database, tidak pernah setengah jalan.
2. Setiap perubahan stok, dari sumber manapun (barang masuk, transfer, penyesuaian opname), tercatat permanen di kartu stok sehingga bisa diaudit kapan saja.
3. Stock opname punya alur yang jelas: hitung fisik, bandingkan dengan sistem, catat selisih, dan sesuaikan stok berdasarkan hasil hitung fisik.

## Target Pengguna

- Staf gudang yang mencatat barang masuk dan melakukan transfer antar lokasi sehari-hari.
- Penanggung jawab gudang yang menjalankan stock opname berkala per lokasi.
- Pemilik atau manajer operasional yang perlu melihat ringkasan stok lintas gudang dan menelusuri riwayat pergerakan satu barang.

Karena ini alat operasional internal dengan satu tim kecil yang saling percaya, aplikasi ini tidak membedakan peran akses (lihat Di Luar Ruang Lingkup).

## Ruang Lingkup Fitur

- Manajemen data master gudang (kode, nama, alamat).
- Manajemen data master barang (SKU, nama, satuan, kategori).
- Pencatatan barang masuk ke gudang tertentu (penerimaan barang).
- Tampilan stok berjalan per gudang dan per barang, dengan filter.
- Transfer barang antar gudang dengan jaminan atomik dua sisi.
- Riwayat transfer yang pernah terjadi.
- Stock opname per gudang: snapshot stok sistem, input stok fisik per barang, finalisasi yang menghasilkan penyesuaian otomatis dan mencatat selisih.
- Kartu stok per barang: buku besar (ledger) lengkap dan kronologis dari setiap pergerakan stok barang tersebut, dengan saldo berjalan.
- Dashboard ringkasan stok lintas gudang.

## Di Luar Ruang Lingkup

- Autentikasi dan otorisasi pengguna (login, peran, hak akses). Semua pengguna yang mengakses aplikasi dianggap staf internal tepercaya. Ini keputusan sadar untuk mempercepat rilis awal; penambahan login adalah kandidat rilis berikutnya.
- Manajemen pembelian/pemasok (purchase order ke vendor) dan penjualan ke pelanggan. Barang masuk di sini adalah pencatatan penerimaan fisik ke gudang, bukan modul pembelian penuh.
- Multi-satuan konversi (misalnya dus ke pcs). Satuan dicatat sebagai atribut informatif pada barang, satu barang satu satuan pencatatan stok.
- Multi-tenant atau multi-perusahaan dalam satu instance.
- Notifikasi otomatis (email/WhatsApp) untuk stok minimum atau opname terjadwal.
- Laporan finansial (nilai persediaan, harga pokok). Aplikasi ini mencatat kuantitas, bukan nilai uang barang.

## Model Data dan Entitas

- **gudang**: lokasi penyimpanan fisik. Kolom: `id`, `kode`, `nama`, `alamat`.
- **barang**: master item yang dilacak stoknya. Kolom: `id`, `sku`, `nama`, `satuan`, `kategori`.
- **stok**: saldo stok terkini per kombinasi gudang dan barang (tabel materialized, selalu mencerminkan hasil akumulasi kartu_stok). Primary key gabungan `(gudang_id, barang_id)`.
- **kartu_stok**: buku besar setiap pergerakan stok. Setiap baris punya `tipe` (`masuk`, `keluar`, `transfer_keluar`, `transfer_masuk`, `penyesuaian_opname`), `jumlah_perubahan` (bisa negatif), `saldo_setelah` (saldo tepat setelah baris ini diterapkan), serta `referensi_tipe` dan `referensi_id` yang menunjuk ke transaksi asal (transfer atau opname). Tabel ini tidak pernah diubah atau dihapus setelah ditulis, hanya ditambah (append-only).
- **transfer**: catatan satu transaksi transfer barang dari satu gudang ke gudang lain, dengan jumlah dan waktu.
- **opname**: satu sesi hitung fisik untuk satu gudang pada satu tanggal, berstatus `draft` (sedang dihitung) atau `selesai` (sudah difinalisasi dan tidak bisa diubah lagi).
- **opname_baris**: hasil hitung per barang dalam satu sesi opname, menyimpan `stok_sistem` (snapshot saat sesi dibuat), `stok_fisik` (input pengguna), dan `selisih` (hasil pengurangan, disimpan permanen sebagai bukti hasil hitung).

## Alur Pengguna Utama

1. **Setup awal**: pengguna membuat data gudang dan data barang lewat menu masing-masing.
2. **Barang masuk**: pengguna memilih gudang tujuan, memilih barang, memasukkan jumlah yang diterima, sistem menambah stok gudang tersebut dan mencatat satu baris kartu stok bertipe `masuk`.
3. **Transfer**: pengguna memilih barang, gudang asal, gudang tujuan, dan jumlah. Sistem memvalidasi stok asal mencukupi, lalu dalam satu transaksi database mengurangi stok asal, menambah stok tujuan, mencatat dua baris kartu stok (`transfer_keluar` di asal, `transfer_masuk` di tujuan) yang berbagi `referensi_id` yang sama, dan mencatat satu baris di tabel `transfer`.
4. **Opname**: pengguna memilih gudang dan membuka sesi opname baru. Sistem menampilkan seluruh barang beserta stok sistem saat itu (disimpan sebagai snapshot). Pengguna mengisi stok fisik hasil hitung untuk tiap barang. Saat difinalisasi, sistem menghitung selisih tiap baris; untuk baris yang selisihnya tidak nol, sistem menulis satu baris kartu stok bertipe `penyesuaian_opname` yang menyesuaikan stok tepat menjadi angka stok fisik, dan status opname berubah menjadi `selesai` sehingga tidak bisa diedit lagi.
5. **Penelusuran**: pengguna membuka kartu stok satu barang untuk melihat seluruh riwayat pergerakannya secara kronologis dengan saldo berjalan, opsional difilter per gudang.

## Aturan Bisnis Penting

### Mekanisme Transaksi Atomik pada Transfer

Seluruh proses transfer dibungkus dalam satu transaksi database (`db.transaction(fn)` pada better-sqlite3), yang berarti seluruh langkah di dalamnya berhasil bersama-sama atau gagal bersama-sama, tanpa kondisi setengah jalan:

1. Baca stok gudang asal untuk barang yang dimaksud.
2. Jika stok asal lebih kecil dari jumlah yang diminta, proses langsung menghentikan diri dengan melempar error di dalam fungsi transaksi. better-sqlite3 secara otomatis membatalkan (rollback) seluruh perubahan yang mungkin sudah terjadi di langkah sebelumnya dalam transaksi yang sama. Pengguna menerima pesan error yang jelas, dan tidak ada satupun baris stok atau kartu stok yang berubah.
3. Jika stok mencukupi: kurangi stok gudang asal, tambah (atau buat baru dengan upsert) stok gudang tujuan, tulis baris kartu stok `transfer_keluar` di gudang asal dan `transfer_masuk` di gudang tujuan yang keduanya menunjuk ke `referensi_id` yang sama (id transfer), lalu tulis baris `transfer` itu sendiri.
4. Karena semuanya berjalan dalam satu fungsi transaksi yang sama, tidak mungkin terjadi hasil dimana stok asal sudah berkurang tapi stok tujuan belum bertambah, atau sebaliknya.

### Logika Opname dan Pencatatan Selisih

1. Sesi opname dibuat untuk satu gudang. Saat dibuat, sistem mengambil snapshot stok sistem (`stok_sistem`) untuk setiap barang yang ada di gudang tersebut dan menyimpannya di `opname_baris`. Snapshot ini tidak berubah lagi meskipun stok sistem berubah karena transaksi lain setelah sesi dibuat, karena snapshot mencerminkan kondisi pada saat opname dimulai.
2. Selama status opname masih `draft`, pengguna bisa mengisi dan mengubah `stok_fisik` untuk tiap barang berapa kali pun.
3. Saat pengguna menekan finalisasi, sistem menghitung `selisih = stok_fisik - stok_sistem` untuk setiap baris.
4. Untuk baris dengan `selisih = 0`, tidak ada perubahan apapun ditulis ke kartu stok, karena stok sistem sudah sesuai dengan kenyataan.
5. Untuk baris dengan `selisih != 0`, sistem menulis tepat satu baris kartu stok bertipe `penyesuaian_opname` dengan `jumlah_perubahan` sama dengan `selisih` tersebut, sehingga saldo stok setelah baris ini persis sama dengan `stok_fisik` yang diinput pengguna. Baris ini menunjuk ke `referensi_id` berupa id sesi opname.
6. Nilai `selisih` pada setiap `opname_baris` tetap disimpan permanen, terlepas dari nol atau tidak, sebagai bukti riwayat hasil hitung fisik pada tanggal tersebut.
7. Setelah difinalisasi, status opname menjadi `selesai` dan seluruh isi sesi tersebut (termasuk `stok_sistem` dan `stok_fisik` yang sudah terkunci) tidak bisa diubah lagi lewat aplikasi.
8. Seluruh langkah finalisasi (menulis banyak baris kartu stok dan mengubah status opname) berjalan dalam satu transaksi database, sehingga finalisasi juga bersifat semua-atau-tidak-sama-sekali.

### Konsistensi Saldo

Tabel `stok` adalah nilai materialized yang harus selalu bisa direkonstruksi ulang dari penjumlahan seluruh baris `kartu_stok` milik kombinasi gudang dan barang yang sama. Setiap baris kartu stok menyimpan `saldo_setelah` sebagai nilai saldo tepat setelah baris tersebut diterapkan, sehingga kartu stok bisa berfungsi sebagai ledger yang lengkap dan bisa diaudit tanpa harus mempercayai tabel `stok` begitu saja.

## Kebutuhan Non-Fungsional

- **Keandalan data**: transfer dan finalisasi opname wajib atomik menggunakan transaksi database asli (bukan simulasi di level aplikasi).
- **Kesederhanaan operasional**: `npm install && npm start` harus langsung berjalan tanpa langkah build tambahan, karena aplikasi ini dijalankan di lingkungan internal yang sederhana.
- **Keterbacaan tabel**: karena penggunanya membaca banyak tabel angka setiap hari, tampilan harus mengutamakan kontras tinggi dan kepadatan informasi yang wajar dibanding dekorasi visual.
- **Aksesibilitas dasar**: kontras warna teks memenuhi standar WCAG AA, seluruh aksi bisa dijalankan lewat keyboard.
- **Responsif**: halaman tetap bisa dipakai di layar sempit (tablet gudang) tanpa scroll horizontal yang merusak tabel.
- **Tanpa ketergantungan jaringan saat runtime**: tidak memuat font atau framework dari CDN eksternal, semua aset visual disajikan dari server sendiri.

## Tumpukan Teknologi dan Alasan

- **Node.js + Express**: server ringan, cukup untuk aplikasi CRUD dan render halaman tanpa kebutuhan framework besar.
- **better-sqlite3**: API sinkron dan dukungan transaksi (`db.transaction`) yang benar-benar atomik dan mudah dinalar, cocok untuk aturan bisnis inti aplikasi ini yaitu transfer dan opname yang harus semua-atau-tidak-sama-sekali. SQLite juga berarti tidak ada server database terpisah yang perlu dikelola untuk alat internal skala kecil ini.
- **EJS**: render halaman di server dengan layout dan partial yang dipakai bersama, cukup untuk aplikasi form dan tabel tanpa perlu build step frontend terpisah.
- **CSS murni tanpa framework**: kontrol penuh atas kontras dan kepadatan tabel yang dibutuhkan pengguna gudang, tanpa berat tambahan dari framework CSS yang sebagian besar tidak terpakai untuk aplikasi form-dan-tabel seperti ini.
- **Font sistem (system-ui)**: tidak bergantung pada koneksi ke CDN font eksternal saat halaman dibuka, sehingga aplikasi tetap tampil benar meski jaringan internal gudang lambat atau terputus dari internet luar.

## Rencana Rilis

1. Commit 3: arah desain (`DESIGN.md`).
2. Commit 4: scaffold proyek (struktur folder, koneksi database, skema tabel, layout dasar, CSS dasar).
3. Commit 5: manajemen gudang dan barang master.
4. Commit 6: pencatatan barang masuk dan tampilan stok per gudang.
5. Commit 7: transfer barang antar gudang dengan transaksi atomik.
6. Commit 8: stock opname dan pencatatan selisih.
7. Commit 9: kartu stok per barang.
8. Commit 10: dokumentasi cara menjalankan proyek (`README.md`).
