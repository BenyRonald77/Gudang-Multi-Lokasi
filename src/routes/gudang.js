const express = require('express');
const db = require('../db');

const router = express.Router();

function ambilSemuaGudang() {
  return db.prepare('SELECT * FROM gudang ORDER BY nama').all();
}

router.get('/', (req, res) => {
  res.render('gudang/index', {
    judulHalaman: 'Gudang',
    aktif: 'gudang',
    daftarGudang: ambilSemuaGudang(),
  });
});

router.post('/', (req, res) => {
  const kode = (req.body.kode || '').trim();
  const nama = (req.body.nama || '').trim();
  const alamat = (req.body.alamat || '').trim();

  if (!kode || !nama) {
    return res.redirect('/gudang?error=' + encodeURIComponent('Kode dan nama gudang wajib diisi'));
  }

  try {
    db.prepare('INSERT INTO gudang (kode, nama, alamat) VALUES (?, ?, ?)').run(kode, nama, alamat || null);
    res.redirect('/gudang?sukses=' + encodeURIComponent(`Gudang "${nama}" berhasil ditambahkan`));
  } catch (err) {
    const pesan = err.message.includes('UNIQUE')
      ? `Kode gudang "${kode}" sudah dipakai`
      : 'Gagal menambahkan gudang: ' + err.message;
    res.redirect('/gudang?error=' + encodeURIComponent(pesan));
  }
});

router.get('/:id/edit', (req, res) => {
  const gudang = db.prepare('SELECT * FROM gudang WHERE id = ?').get(req.params.id);
  if (!gudang) {
    return res.redirect('/gudang?error=' + encodeURIComponent('Gudang tidak ditemukan'));
  }
  res.render('gudang/edit', {
    judulHalaman: 'Ubah Gudang',
    aktif: 'gudang',
    gudang,
  });
});

router.post('/:id', (req, res) => {
  const kode = (req.body.kode || '').trim();
  const nama = (req.body.nama || '').trim();
  const alamat = (req.body.alamat || '').trim();

  if (!kode || !nama) {
    return res.redirect(`/gudang/${req.params.id}/edit?error=` + encodeURIComponent('Kode dan nama gudang wajib diisi'));
  }

  try {
    db.prepare('UPDATE gudang SET kode = ?, nama = ?, alamat = ? WHERE id = ?').run(
      kode,
      nama,
      alamat || null,
      req.params.id
    );
    res.redirect('/gudang?sukses=' + encodeURIComponent('Gudang berhasil diperbarui'));
  } catch (err) {
    const pesan = err.message.includes('UNIQUE')
      ? `Kode gudang "${kode}" sudah dipakai`
      : 'Gagal memperbarui gudang: ' + err.message;
    res.redirect(`/gudang/${req.params.id}/edit?error=` + encodeURIComponent(pesan));
  }
});

router.post('/:id/hapus', (req, res) => {
  const dipakai = db.prepare('SELECT COUNT(*) AS n FROM stok WHERE gudang_id = ? AND jumlah != 0').get(req.params.id).n;
  if (dipakai > 0) {
    return res.redirect(
      '/gudang?error=' + encodeURIComponent('Gudang tidak bisa dihapus karena masih memiliki stok barang')
    );
  }
  db.prepare('DELETE FROM gudang WHERE id = ?').run(req.params.id);
  res.redirect('/gudang?sukses=' + encodeURIComponent('Gudang berhasil dihapus'));
});

module.exports = router;
