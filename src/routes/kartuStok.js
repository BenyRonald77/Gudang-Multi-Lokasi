const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/:barang_id', (req, res) => {
  const barang = db.prepare('SELECT * FROM barang WHERE id = ?').get(req.params.barang_id);
  if (!barang) {
    return res.redirect('/barang?error=' + encodeURIComponent('Barang tidak ditemukan'));
  }

  const gudangId = req.query.gudang_id ? Number(req.query.gudang_id) : null;

  let sql = `
    SELECT k.*, g.nama AS nama_gudang
    FROM kartu_stok k
    JOIN gudang g ON g.id = k.gudang_id
    WHERE k.barang_id = ?
  `;
  const params = [barang.id];
  if (gudangId) {
    sql += ' AND k.gudang_id = ?';
    params.push(gudangId);
  }
  sql += ' ORDER BY k.id ASC';

  const pergerakan = db.prepare(sql).all(...params);

  const totalStokBarang = db
    .prepare('SELECT COALESCE(SUM(jumlah), 0) AS n FROM stok WHERE barang_id = ?')
    .get(barang.id).n;

  res.render('kartuStok/show', {
    judulHalaman: `Kartu Stok - ${barang.nama}`,
    aktif: 'barang',
    barang,
    pergerakan,
    totalStokBarang,
    daftarGudang: db.prepare('SELECT * FROM gudang ORDER BY nama').all(),
    filterGudangId: gudangId,
  });
});

module.exports = router;
