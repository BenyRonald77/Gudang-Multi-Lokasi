# DESIGN.md: Arah Desain Gudang Multi-Lokasi

Catatan jujur: arah desain di dokumen ini disusun sendiri oleh pembuat aplikasi (bukan hasil arahan dari pemilik bisnis), untuk kebutuhan alat operasional internal, sehingga tekanannya ada pada kejelasan dan kecepatan baca tabel, bukan pada gaya visual yang mencolok.

## Identitas dan Kepribadian

Ini adalah alat kerja harian staf gudang, dibuka berulang kali sepanjang shift untuk mengisi angka dan membaca tabel dengan cepat, bukan halaman yang dilihat sekali lalu ditinggal. Kepribadiannya: tenang, faktual, tidak banyak basa-basi, dan memprioritaskan angka di atas dekorasi.

## Palet Warna

- **Netral inti 1**: `#1F2937` (abu gelap kebiruan) untuk teks utama dan header tabel.
- **Netral inti 2**: `#F5F6F8` (abu sangat terang) untuk latar halaman, memberi kontras lembut terhadap kartu putih.
- **Aksen**: `#B45309` (oranye tembaga/safety-orange gelap) untuk aksi utama (tombol simpan, transfer, finalisasi) dan status peringatan (selisih opname, stok tidak cukup).

Alasan (satu baris): staf gudang harus bisa memindai puluhan baris angka dalam hitungan detik, jadi palet dibuat minim dan kontras tinggi alih-alih dekoratif, dengan satu aksen oranye tembaga yang cukup gelap untuk lolos kontras AA di atas putih, dipakai khusus untuk aksi dan peringatan supaya mata langsung menemukan titik penting di tabel yang padat.

Warna status tambahan (bukan bagian dari palet inti, hanya penanda semantik pada badge kecil):
- Hijau `#166534` untuk status "selesai" / stok mencukupi.
- Merah `#B91C1C` untuk status error / stok tidak mencukupi.

## Tipografi

Stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` (system-ui).

Alasan: aplikasi ini dipakai di jaringan gudang yang tidak selalu stabil ke internet luar, sehingga memuat font dari CDN eksternal berisiko membuat halaman tampil rusak atau lambat pada saat yang justru paling sibuk. Font sistem juga sudah dioptimalkan untuk keterbacaan angka pada ukuran kecil di tiap platform, cocok untuk tabel padat.

Angka pada kolom kuantitas dan saldo memakai `font-variant-numeric: tabular-nums` agar digit sejajar secara vertikal antar baris, penting untuk memindai kolom angka dengan cepat.

## Dial ENERGY / RHYTHM / MOTION

Dial: ENERGY 1 / RHYTHM 1 / MOTION 1

Alasan: ini alat operasional (ops tool) sejenis GOV.UK atau dasbor internal, bukan halaman pemasaran. Yang dinilai pengguna adalah seberapa cepat mereka bisa mengisi form dan membaca tabel, bukan seberapa "hidup" tampilannya. Setiap bagian memakai komposisi yang sama (judul, filter, tabel/form) secara sengaja supaya pengguna tidak perlu belajar ulang pola halaman baru tiap kali membuka menu berbeda. Animasi dibatasi pada transisi hover dan fokus saja, tanpa animasi masuk halaman, karena staf gudang berpindah antar halaman berkali-kali sehari dan animasi akan menghambat, bukan membantu.

## Komponen dan Tata Letak

- **Radius**: satu nilai radius kecil (6px) dipakai konsisten pada tombol, input, dan kartu, sebagai penanda "elemen interaktif" tanpa jadi dekorasi pil di mana-mana.
- **Bayangan**: hanya dipakai pada elemen yang benar-benar mengambang di atas konten lain (dropdown, modal konfirmasi), bukan pada kartu biasa, supaya bayangan tetap berarti sebagai penanda elevasi.
- **Tabel**: baris bergaris pemisah tipis, header tabel dengan latar sedikit lebih gelap dan teks tebal, baris dengan selisih opname negatif/positif ditandai warna status pada teks kolom selisih saja (bukan seluruh baris), supaya penanda tetap jelas tanpa membuat tabel ramai.
- **Navigasi**: satu bar navigasi horizontal tetap di atas berisi tautan ke seluruh halaman yang benar-benar ada (Dashboard, Gudang, Barang, Stok, Barang Masuk, Transfer, Opname), tanpa tautan ke fitur yang belum dibangun.
- **Fokus keyboard**: outline fokus 2px warna aksen pada seluruh elemen interaktif, tidak pernah dihilangkan tanpa pengganti.

## Motif Identitas

Satu motif yang berulang: badge status kecil berbentuk persegi dengan sudut membulat 4px (bukan pil), dipakai konsisten untuk status opname (`draft`/`selesai`) dan indikator selisih, sehingga pengguna mengenali "ini adalah penanda status" di manapun ia muncul di aplikasi.
