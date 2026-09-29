const express = require('express');
const db = require('../db');

const router = express.Router();

function ambilSemuaBarang() {
  return db.prepare('SELECT * FROM barang ORDER BY nama').all();
}

router.get('/', (req, res) => {
  res.render('barang/index', {
    judulHalaman: 'Barang',
    aktif: 'barang',
    daftarBarang: ambilSemuaBarang(),
  });
});

router.post('/', (req, res) => {
  const sku = (req.body.sku || '').trim();
  const nama = (req.body.nama || '').trim();
  const satuan = (req.body.satuan || '').trim();
  const kategori = (req.body.kategori || '').trim();

  if (!sku || !nama || !satuan) {
    return res.redirect('/barang?error=' + encodeURIComponent('SKU, nama, dan satuan wajib diisi'));
  }

  try {
    db.prepare('INSERT INTO barang (sku, nama, satuan, kategori) VALUES (?, ?, ?, ?)').run(
      sku,
      nama,
      satuan,
      kategori || null
    );
    res.redirect('/barang?sukses=' + encodeURIComponent(`Barang "${nama}" berhasil ditambahkan`));
  } catch (err) {
    const pesan = err.message.includes('UNIQUE') ? `SKU "${sku}" sudah dipakai` : 'Gagal menambahkan barang: ' + err.message;
    res.redirect('/barang?error=' + encodeURIComponent(pesan));
  }
});

router.get('/:id/edit', (req, res) => {
  const barang = db.prepare('SELECT * FROM barang WHERE id = ?').get(req.params.id);
  if (!barang) {
    return res.redirect('/barang?error=' + encodeURIComponent('Barang tidak ditemukan'));
  }
  res.render('barang/edit', {
    judulHalaman: 'Ubah Barang',
    aktif: 'barang',
    barang,
  });
});

router.post('/:id', (req, res) => {
  const sku = (req.body.sku || '').trim();
  const nama = (req.body.nama || '').trim();
  const satuan = (req.body.satuan || '').trim();
  const kategori = (req.body.kategori || '').trim();

  if (!sku || !nama || !satuan) {
    return res.redirect(`/barang/${req.params.id}/edit?error=` + encodeURIComponent('SKU, nama, dan satuan wajib diisi'));
  }

  try {
    db.prepare('UPDATE barang SET sku = ?, nama = ?, satuan = ?, kategori = ? WHERE id = ?').run(
      sku,
      nama,
      satuan,
      kategori || null,
      req.params.id
    );
    res.redirect('/barang?sukses=' + encodeURIComponent('Barang berhasil diperbarui'));
  } catch (err) {
    const pesan = err.message.includes('UNIQUE') ? `SKU "${sku}" sudah dipakai` : 'Gagal memperbarui barang: ' + err.message;
    res.redirect(`/barang/${req.params.id}/edit?error=` + encodeURIComponent(pesan));
  }
});

router.post('/:id/hapus', (req, res) => {
  const dipakai = db.prepare('SELECT COUNT(*) AS n FROM kartu_stok WHERE barang_id = ?').get(req.params.id).n;
  if (dipakai > 0) {
    return res.redirect(
      '/barang?error=' + encodeURIComponent('Barang tidak bisa dihapus karena sudah memiliki riwayat pergerakan stok')
    );
  }
  db.prepare('DELETE FROM barang WHERE id = ?').run(req.params.id);
  res.redirect('/barang?sukses=' + encodeURIComponent('Barang berhasil dihapus'));
});

module.exports = router;
