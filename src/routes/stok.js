const express = require('express');
const db = require('../db');
const { catatBarangMasuk } = require('../services/stok');

const router = express.Router();

router.get('/', (req, res) => {
  const gudangId = req.query.gudang_id ? Number(req.query.gudang_id) : null;
  const barangId = req.query.barang_id ? Number(req.query.barang_id) : null;

  let sql = `
    SELECT s.gudang_id, s.barang_id, s.jumlah, g.kode AS kode_gudang, g.nama AS nama_gudang,
           b.sku, b.nama AS nama_barang, b.satuan
    FROM stok s
    JOIN gudang g ON g.id = s.gudang_id
    JOIN barang b ON b.id = s.barang_id
    WHERE 1 = 1
  `;
  const params = [];
  if (gudangId) {
    sql += ' AND s.gudang_id = ?';
    params.push(gudangId);
  }
  if (barangId) {
    sql += ' AND s.barang_id = ?';
    params.push(barangId);
  }
  sql += ' ORDER BY g.nama, b.nama';

  const daftarStok = db.prepare(sql).all(...params);

  res.render('stok/index', {
    judulHalaman: 'Stok',
    aktif: 'stok',
    daftarStok,
    daftarGudang: db.prepare('SELECT * FROM gudang ORDER BY nama').all(),
    daftarBarang: db.prepare('SELECT * FROM barang ORDER BY nama').all(),
    filterGudangId: gudangId,
    filterBarangId: barangId,
  });
});

router.get('/masuk', (req, res) => {
  res.render('stok/masuk', {
    judulHalaman: 'Barang Masuk',
    aktif: 'stok-masuk',
    daftarGudang: db.prepare('SELECT * FROM gudang ORDER BY nama').all(),
    daftarBarang: db.prepare('SELECT * FROM barang ORDER BY nama').all(),
  });
});

router.post('/masuk', (req, res) => {
  const gudangId = Number(req.body.gudang_id);
  const barangId = Number(req.body.barang_id);
  const jumlah = Math.trunc(Number(req.body.jumlah));
  const catatan = (req.body.catatan || '').trim() || null;

  if (!gudangId || !barangId || !jumlah || jumlah <= 0) {
    return res.redirect('/stok/masuk?error=' + encodeURIComponent('Gudang, barang, dan jumlah (angka positif) wajib diisi'));
  }

  try {
    catatBarangMasuk({ gudangId, barangId, jumlah, catatan });
    res.redirect('/stok/masuk?sukses=' + encodeURIComponent(`Berhasil mencatat ${jumlah} unit barang masuk`));
  } catch (err) {
    res.redirect('/stok/masuk?error=' + encodeURIComponent('Gagal mencatat barang masuk: ' + err.message));
  }
});

module.exports = router;
