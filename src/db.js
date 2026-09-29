const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'app.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS gudang (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kode TEXT NOT NULL UNIQUE,
    nama TEXT NOT NULL,
    alamat TEXT
  );

  CREATE TABLE IF NOT EXISTS barang (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT NOT NULL UNIQUE,
    nama TEXT NOT NULL,
    satuan TEXT NOT NULL,
    kategori TEXT
  );

  CREATE TABLE IF NOT EXISTS stok (
    gudang_id INTEGER NOT NULL,
    barang_id INTEGER NOT NULL,
    jumlah INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (gudang_id, barang_id),
    FOREIGN KEY (gudang_id) REFERENCES gudang(id),
    FOREIGN KEY (barang_id) REFERENCES barang(id)
  );

  CREATE TABLE IF NOT EXISTS kartu_stok (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barang_id INTEGER NOT NULL,
    gudang_id INTEGER NOT NULL,
    tipe TEXT NOT NULL CHECK (tipe IN ('masuk', 'keluar', 'transfer_keluar', 'transfer_masuk', 'penyesuaian_opname')),
    jumlah_perubahan INTEGER NOT NULL,
    saldo_setelah INTEGER NOT NULL,
    referensi_tipe TEXT,
    referensi_id INTEGER,
    catatan TEXT,
    dibuat_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (barang_id) REFERENCES barang(id),
    FOREIGN KEY (gudang_id) REFERENCES gudang(id)
  );

  CREATE TABLE IF NOT EXISTS transfer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barang_id INTEGER NOT NULL,
    gudang_asal_id INTEGER NOT NULL,
    gudang_tujuan_id INTEGER NOT NULL,
    jumlah INTEGER NOT NULL,
    dibuat_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    catatan TEXT,
    FOREIGN KEY (barang_id) REFERENCES barang(id),
    FOREIGN KEY (gudang_asal_id) REFERENCES gudang(id),
    FOREIGN KEY (gudang_tujuan_id) REFERENCES gudang(id)
  );

  CREATE TABLE IF NOT EXISTS opname (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gudang_id INTEGER NOT NULL,
    tanggal TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'selesai')) DEFAULT 'draft',
    catatan TEXT,
    FOREIGN KEY (gudang_id) REFERENCES gudang(id)
  );

  CREATE TABLE IF NOT EXISTS opname_baris (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opname_id INTEGER NOT NULL,
    barang_id INTEGER NOT NULL,
    stok_sistem INTEGER NOT NULL,
    stok_fisik INTEGER,
    selisih INTEGER,
    FOREIGN KEY (opname_id) REFERENCES opname(id),
    FOREIGN KEY (barang_id) REFERENCES barang(id)
  );

  CREATE INDEX IF NOT EXISTS idx_kartu_stok_barang ON kartu_stok(barang_id, id);
  CREATE INDEX IF NOT EXISTS idx_kartu_stok_gudang ON kartu_stok(gudang_id);
  CREATE INDEX IF NOT EXISTS idx_opname_baris_opname ON opname_baris(opname_id);
`);

module.exports = db;
