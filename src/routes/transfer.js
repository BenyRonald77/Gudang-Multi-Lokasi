const express = require('express');
const db = require('../db');
const { transferBarang, StokTidakCukupError } = require('../services/stok');

const router = express.Router();

function ambilRiwayatTransfer() {
  return db
    .prepare(
      `SELECT t.*, b.nama AS nama_barang, ga.nama AS nama_asal, gt.nama AS nama_tujuan
       FROM transfer t
       JOIN barang b ON b.id = t.barang_id
       JOIN gudang ga ON ga.id = t.gudang_asal_id
       JOIN gudang gt ON gt.id = t.gudang_tujuan_id
       ORDER BY t.id DESC`
    )
    .all();
}

router.get('/', (req, res) => {
  res.render('transfer/index', {
    judulHalaman: 'Transfer Barang',
    aktif: 'transfer',
    daftarGudang: db.prepare('SELECT * FROM gudang ORDER BY nama').all(),
    daftarBarang: db.prepare('SELECT * FROM barang ORDER BY nama').all(),
    daftarTransfer: ambilRiwayatTransfer(),
  });
});

router.post('/', (req, res) => {
  const barangId = Number(req.body.barang_id);
  const gudangAsalId = Number(req.body.gudang_asal_id);
  const gudangTujuanId = Number(req.body.gudang_tujuan_id);
  const jumlah = Math.trunc(Number(req.body.jumlah));
  const catatan = (req.body.catatan || '').trim() || null;

  if (!barangId || !gudangAsalId || !gudangTujuanId || !jumlah || jumlah <= 0) {
    return res.redirect('/transfer?error=' + encodeURIComponent('Barang, gudang asal, gudang tujuan, dan jumlah wajib diisi dengan benar'));
  }
  if (gudangAsalId === gudangTujuanId) {
    return res.redirect('/transfer?error=' + encodeURIComponent('Gudang asal dan gudang tujuan tidak boleh sama'));
  }

  try {
    transferBarang({ barangId, gudangAsalId, gudangTujuanId, jumlah, catatan });
    res.redirect('/transfer?sukses=' + encodeURIComponent(`Berhasil transfer ${jumlah} unit`));
  } catch (err) {
    if (err instanceof StokTidakCukupError) {
      return res.redirect('/transfer?error=' + encodeURIComponent(err.message));
    }
    res.redirect('/transfer?error=' + encodeURIComponent('Gagal melakukan transfer: ' + err.message));
  }
});

module.exports = router;
