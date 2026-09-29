const db = require('../db');

/**
 * Ambil jumlah stok saat ini untuk satu kombinasi gudang + barang.
 * Mengembalikan 0 jika belum pernah ada baris stok untuk kombinasi ini.
 */
function getJumlahStok(gudangId, barangId) {
  const row = db
    .prepare('SELECT jumlah FROM stok WHERE gudang_id = ? AND barang_id = ?')
    .get(gudangId, barangId);
  return row ? row.jumlah : 0;
}

/**
 * Terapkan satu perubahan stok: upsert saldo di tabel `stok` dan tulis satu
 * baris `kartu_stok` yang menyimpan saldo_setelah persis hasil perubahan ini.
 *
 * PENTING: fungsi ini TIDAK membuka transaksi sendiri. Ia harus selalu
 * dipanggil dari dalam fungsi yang sudah dibungkus db.transaction(...),
 * supaya beberapa pemanggilan berurutan (misalnya transfer keluar + masuk)
 * tetap tergabung dalam satu transaksi atomik yang sama.
 */
function terapkanPergerakan({ barangId, gudangId, tipe, jumlahPerubahan, referensiTipe = null, referensiId = null, catatan = null }) {
  const saldoSekarang = getJumlahStok(gudangId, barangId);
  const saldoSetelah = saldoSekarang + jumlahPerubahan;

  db.prepare(
    `INSERT INTO stok (gudang_id, barang_id, jumlah)
     VALUES (?, ?, ?)
     ON CONFLICT(gudang_id, barang_id) DO UPDATE SET jumlah = excluded.jumlah`
  ).run(gudangId, barangId, saldoSetelah);

  db.prepare(
    `INSERT INTO kartu_stok (barang_id, gudang_id, tipe, jumlah_perubahan, saldo_setelah, referensi_tipe, referensi_id, catatan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(barangId, gudangId, tipe, jumlahPerubahan, saldoSetelah, referensiTipe, referensiId, catatan);

  return saldoSetelah;
}

/**
 * Catat penerimaan barang masuk ke satu gudang. Dibungkus transaksi sendiri
 * karena ini satu aksi tunggal (satu baris kartu stok).
 */
const catatBarangMasuk = db.transaction(({ gudangId, barangId, jumlah, catatan }) => {
  if (!Number.isInteger(jumlah) || jumlah <= 0) {
    throw new Error('Jumlah barang masuk harus bilangan bulat positif');
  }
  return terapkanPergerakan({
    barangId,
    gudangId,
    tipe: 'masuk',
    jumlahPerubahan: jumlah,
    referensiTipe: 'barang_masuk',
    referensiId: null,
    catatan,
  });
});

class StokTidakCukupError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StokTidakCukupError';
  }
}

/**
 * Transfer barang antar gudang, atomik dua sisi.
 *
 * Seluruh langkah di bawah ini berjalan dalam satu db.transaction: jika stok
 * asal tidak mencukupi, fungsi ini melempar StokTidakCukupError SEBELUM
 * menulis perubahan apapun, sehingga better-sqlite3 membatalkan transaksi
 * dan tidak ada satupun baris stok atau kartu stok yang berubah. Jika stok
 * mencukupi, stok asal berkurang, stok tujuan bertambah, dua baris kartu
 * stok ditulis dengan referensi_id yang sama, dan satu baris `transfer`
 * ditulis, seluruhnya sebagai satu unit yang tidak bisa terpotong.
 */
const transferBarang = db.transaction(({ barangId, gudangAsalId, gudangTujuanId, jumlah, catatan }) => {
  if (!Number.isInteger(jumlah) || jumlah <= 0) {
    throw new Error('Jumlah transfer harus bilangan bulat positif');
  }
  if (gudangAsalId === gudangTujuanId) {
    throw new Error('Gudang asal dan gudang tujuan tidak boleh sama');
  }

  const stokAsalSekarang = getJumlahStok(gudangAsalId, barangId);
  if (stokAsalSekarang < jumlah) {
    throw new StokTidakCukupError(
      `Stok tidak cukup di gudang asal (tersedia ${stokAsalSekarang}, diminta ${jumlah})`
    );
  }

  const info = db
    .prepare(
      `INSERT INTO transfer (barang_id, gudang_asal_id, gudang_tujuan_id, jumlah, catatan)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(barangId, gudangAsalId, gudangTujuanId, jumlah, catatan);
  const transferId = info.lastInsertRowid;

  terapkanPergerakan({
    barangId,
    gudangId: gudangAsalId,
    tipe: 'transfer_keluar',
    jumlahPerubahan: -jumlah,
    referensiTipe: 'transfer',
    referensiId: transferId,
    catatan,
  });

  terapkanPergerakan({
    barangId,
    gudangId: gudangTujuanId,
    tipe: 'transfer_masuk',
    jumlahPerubahan: jumlah,
    referensiTipe: 'transfer',
    referensiId: transferId,
    catatan,
  });

  return transferId;
});

/**
 * Mulai sesi opname baru untuk satu gudang: snapshot stok sistem seluruh
 * barang yang ada di master barang untuk gudang tersebut. Snapshot ini
 * disimpan permanen di opname_baris dan tidak berubah lagi meskipun stok
 * sistem berubah karena transaksi lain setelah sesi dibuat.
 */
const mulaiOpname = db.transaction(({ gudangId, tanggal, catatan }) => {
  const info = db
    .prepare("INSERT INTO opname (gudang_id, tanggal, status, catatan) VALUES (?, ?, 'draft', ?)")
    .run(gudangId, tanggal, catatan);
  const opnameId = info.lastInsertRowid;

  const semuaBarang = db.prepare('SELECT id FROM barang ORDER BY nama').all();
  const insertBaris = db.prepare('INSERT INTO opname_baris (opname_id, barang_id, stok_sistem) VALUES (?, ?, ?)');
  for (const b of semuaBarang) {
    const stokSistem = getJumlahStok(gudangId, b.id);
    insertBaris.run(opnameId, b.id, stokSistem);
  }

  return opnameId;
});

/**
 * Simpan input stok fisik untuk baris-baris satu sesi opname yang masih draft.
 * nilaiPerBaris: objek { [opname_baris.id]: stokFisik }.
 */
const simpanStokFisik = db.transaction((opnameId, nilaiPerBaris) => {
  const opname = db.prepare('SELECT * FROM opname WHERE id = ?').get(opnameId);
  if (!opname) throw new Error('Sesi opname tidak ditemukan');
  if (opname.status !== 'draft') throw new Error('Sesi opname sudah selesai, tidak bisa diubah');

  const update = db.prepare('UPDATE opname_baris SET stok_fisik = ? WHERE id = ? AND opname_id = ?');
  for (const [barisId, stokFisik] of Object.entries(nilaiPerBaris)) {
    if (stokFisik === null || stokFisik === undefined || stokFisik === '') continue;
    update.run(Math.trunc(Number(stokFisik)), barisId, opnameId);
  }
});

/**
 * Finalisasi sesi opname: untuk setiap baris dengan selisih != 0, tulis
 * tepat satu baris kartu_stok bertipe penyesuaian_opname yang membuat
 * saldo persis sama dengan stok_fisik, lalu tandai sesi selesai. Semua
 * dalam satu transaksi sehingga finalisasi juga semua-atau-tidak-sama-sekali.
 */
const finalisasiOpname = db.transaction((opnameId) => {
  const opname = db.prepare('SELECT * FROM opname WHERE id = ?').get(opnameId);
  if (!opname) throw new Error('Sesi opname tidak ditemukan');
  if (opname.status !== 'draft') throw new Error('Sesi opname sudah selesai');

  const baris = db.prepare('SELECT * FROM opname_baris WHERE opname_id = ?').all(opnameId);

  const belumDiisi = baris.filter((b) => b.stok_fisik === null || b.stok_fisik === undefined);
  if (belumDiisi.length > 0) {
    throw new Error('Masih ada barang yang belum diisi stok fisiknya');
  }

  const updateSelisih = db.prepare('UPDATE opname_baris SET selisih = ? WHERE id = ?');

  for (const b of baris) {
    const selisih = b.stok_fisik - b.stok_sistem;
    updateSelisih.run(selisih, b.id);

    if (selisih !== 0) {
      terapkanPergerakan({
        barangId: b.barang_id,
        gudangId: opname.gudang_id,
        tipe: 'penyesuaian_opname',
        jumlahPerubahan: selisih,
        referensiTipe: 'opname',
        referensiId: opnameId,
        catatan: `Penyesuaian hasil opname #${opnameId}`,
      });
    }
  }

  db.prepare("UPDATE opname SET status = 'selesai' WHERE id = ?").run(opnameId);
});

module.exports = {
  getJumlahStok,
  terapkanPergerakan,
  catatBarangMasuk,
  transferBarang,
  StokTidakCukupError,
  mulaiOpname,
  simpanStokFisik,
  finalisasiOpname,
};
