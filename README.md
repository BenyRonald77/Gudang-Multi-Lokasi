# Gudang Multi-Lokasi

Aplikasi pencatatan stok untuk bisnis dengan lebih dari satu gudang: transfer barang antar gudang yang atomik di dua sisi, stock opname dengan pencatatan selisih, dan kartu stok (ledger) per barang.

Dokumen pendukung:
- `PRD.md` untuk latar belakang, ruang lingkup, dan aturan bisnis lengkap.
- `DESIGN.md` untuk arah desain dan alasan tiap keputusan visual.

## Fitur

- Manajemen data master gudang dan barang.
- Pencatatan barang masuk ke gudang.
- Tampilan stok terkini per gudang, bisa difilter per gudang dan/atau per barang.
- Transfer barang antar gudang, atomik: stok asal berkurang dan stok tujuan bertambah dalam satu transaksi database, tidak pernah setengah jalan.
- Stock opname per gudang: snapshot stok sistem, input stok fisik, finalisasi dengan pencatatan selisih otomatis ke kartu stok.
- Kartu stok per barang: riwayat lengkap dan kronologis seluruh pergerakan stok dengan saldo berjalan.
- Dashboard ringkasan stok lintas gudang.

## Kebutuhan Sistem

- Node.js 18 ke atas (dikembangkan dan diuji dengan Node.js 22).
- Tidak perlu database server terpisah, karena memakai SQLite (file lokal).

## Cara Menjalankan

```bash
npm install
npm start
```

Aplikasi berjalan di `http://localhost:3000` (port bisa diganti lewat variabel lingkungan `PORT`).

Saat pertama kali dijalankan, aplikasi otomatis membuat folder `data/` beserta file database `data/app.db` dan seluruh tabel yang dibutuhkan. Tidak ada langkah build atau migrasi manual.

## Alur Pemakaian Singkat

1. Buka menu **Gudang**, tambahkan minimal satu gudang.
2. Buka menu **Barang**, tambahkan data barang yang akan dilacak stoknya.
3. Buka menu **Barang Masuk**, catat penerimaan barang ke gudang tertentu.
4. Buka menu **Transfer** untuk memindahkan barang antar gudang.
5. Buka menu **Opname** untuk menjalankan sesi hitung fisik per gudang dan menutupnya (finalisasi) setelah semua barang diisi.
6. Dari halaman **Barang** atau **Stok**, klik nama barang untuk membuka **Kartu Stok** dan melihat seluruh riwayat pergerakannya.

## Struktur Proyek

```
server.js                 Entry point aplikasi (Express)
src/db.js                 Koneksi SQLite dan definisi skema tabel
src/services/stok.js      Logika bisnis inti: barang masuk, transfer atomik, opname
src/routes/               Route handler per modul (gudang, barang, stok, transfer, opname, kartu stok)
views/                    Template EJS (layout, partial navigasi, halaman per modul)
public/css/style.css      Stylesheet, ditulis manual tanpa framework
data/                     Lokasi file database SQLite (dibuat otomatis, tidak ikut git)
```

## Catatan Ruang Lingkup

Aplikasi ini belum memiliki sistem login/otentikasi. Ini keputusan sadar untuk mempercepat rilis awal alat internal; lihat bagian "Di Luar Ruang Lingkup" di `PRD.md` untuk daftar lengkap.
