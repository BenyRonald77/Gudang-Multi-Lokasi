const express = require('express');
const db = require('../db');
const { mulaiOpname, simpanStokFisik, finalisasiOpname } = require('../services/stok');

const router = express.Router();

function ambilDaftarOpname() {
  return db
    .prepare(
      `SELECT o.*, g.nama AS nama_gudang
       FROM opname o
       JOIN gudang g ON g.id = o.gudang_id
       ORDER BY o.id DESC`
    )
    .all();
}

router.get('/', (req, res) => {
  res.render('opname/index', {
    judulHalaman: 'Stock Opname',
    aktif: 'opname',
    daftarGudang: db.prepare('SELECT * FROM gudang ORDER BY nama').all(),
    daftarOpname: ambilDaftarOpname(),
  });
});

router.post('/', (req, res) => {
  const gudangId = Number(req.body.gudang_id);
  const tanggal = (req.body.tanggal || '').trim();
  const catatan = (req.body.catatan || '').trim() || null;

  if (!gudangId || !tanggal) {
    return res.redirect('/opname?error=' + encodeURIComponent('Gudang dan tanggal wajib diisi'));
  }

  const jumlahBarang = db.prepare('SELECT COUNT(*) AS n FROM barang').get().n;
  if (jumlahBarang === 0) {
    return res.redirect('/opname?error=' + encodeURIComponent('Belum ada data barang untuk dihitung'));
  }

  try {
    const opnameId = mulaiOpname({ gudangId, tanggal, catatan });
    res.redirect(`/opname/${opnameId}`);
  } catch (err) {
    res.redirect('/opname?error=' + encodeURIComponent('Gagal memulai opname: ' + err.message));
  }
});

router.get('/:id', (req, res) => {
  const opname = db
    .prepare(
      `SELECT o.*, g.nama AS nama_gudang
       FROM opname o
       JOIN gudang g ON g.id = o.gudang_id
       WHERE o.id = ?`
    )
    .get(req.params.id);

  if (!opname) {
    return res.redirect('/opname?error=' + encodeURIComponent('Sesi opname tidak ditemukan'));
  }

  const baris = db
    .prepare(
      `SELECT ob.*, b.sku, b.nama AS nama_barang, b.satuan
       FROM opname_baris ob
       JOIN barang b ON b.id = ob.barang_id
       WHERE ob.opname_id = ?
       ORDER BY b.nama`
    )
    .all(opname.id);

  res.render('opname/show', {
    judulHalaman: `Opname ${opname.nama_gudang}`,
    aktif: 'opname',
    opname,
    baris,
  });
});

/**
 * Form mengirim satu field per baris opname dengan nama `baris_<id>` (bukan
 * objek bertingkat `stok_fisik[id]`), supaya id baris yang berupa angka
 * tidak salah ditafsirkan sebagai indeks array oleh parser body.
 */
function ambilNilaiPerBarisDariBody(body) {
  const nilaiPerBaris = {};
  for (const [key, value] of Object.entries(body)) {
    const cocok = /^baris_(\d+)$/.exec(key);
    if (cocok) {
      nilaiPerBaris[cocok[1]] = value;
    }
  }
  return nilaiPerBaris;
}

router.post('/:id/simpan', (req, res) => {
  const opnameId = Number(req.params.id);
  const nilaiPerBaris = ambilNilaiPerBarisDariBody(req.body);

  try {
    simpanStokFisik(opnameId, nilaiPerBaris);
    res.redirect(`/opname/${opnameId}?sukses=` + encodeURIComponent('Hasil hitung fisik berhasil disimpan'));
  } catch (err) {
    res.redirect(`/opname/${opnameId}?error=` + encodeURIComponent('Gagal menyimpan: ' + err.message));
  }
});

router.post('/:id/finalisasi', (req, res) => {
  const opnameId = Number(req.params.id);
  const nilaiPerBaris = ambilNilaiPerBarisDariBody(req.body);

  try {
    simpanStokFisik(opnameId, nilaiPerBaris);
    finalisasiOpname(opnameId);
    res.redirect(`/opname/${opnameId}?sukses=` + encodeURIComponent('Opname berhasil difinalisasi, stok telah disesuaikan'));
  } catch (err) {
    res.redirect(`/opname/${opnameId}?error=` + encodeURIComponent('Gagal finalisasi: ' + err.message));
  }
});

module.exports = router;
