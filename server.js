const path = require('path');
const express = require('express');

const db = require('./src/db');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Pesan flash dikirim lewat query string setelah redirect (tanpa sesi/login,
// aplikasi ini cukup memakai pendekatan sederhana ini untuk umpan balik aksi).
app.use((req, res, next) => {
  res.locals.pesanSukses = req.query.sukses || null;
  res.locals.pesanError = req.query.error || null;
  next();
});

app.get('/', (req, res) => {
  const jumlahGudang = db.prepare('SELECT COUNT(*) AS n FROM gudang').get().n;
  const jumlahBarang = db.prepare('SELECT COUNT(*) AS n FROM barang').get().n;
  const totalUnitStok = db.prepare('SELECT COALESCE(SUM(jumlah), 0) AS n FROM stok').get().n;

  const ringkasanPerGudang = db
    .prepare(
      `SELECT g.id, g.kode, g.nama, COALESCE(SUM(s.jumlah), 0) AS total_unit,
              COUNT(DISTINCT CASE WHEN s.jumlah > 0 THEN s.barang_id END) AS jumlah_jenis_barang
       FROM gudang g
       LEFT JOIN stok s ON s.gudang_id = g.id
       GROUP BY g.id
       ORDER BY g.nama`
    )
    .all();

  res.render('dashboard', {
    judulHalaman: 'Dashboard',
    aktif: 'dashboard',
    jumlahGudang,
    jumlahBarang,
    totalUnitStok,
    ringkasanPerGudang,
  });
});

app.use((req, res) => {
  res.status(404).render('404', { judulHalaman: 'Halaman tidak ditemukan', aktif: '' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    judulHalaman: 'Terjadi kesalahan',
    aktif: '',
    pesan: err.message || 'Terjadi kesalahan tak terduga',
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Gudang Multi-Lokasi berjalan di http://localhost:${PORT}`);
});
