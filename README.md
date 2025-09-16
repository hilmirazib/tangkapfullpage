# 🖼️ TangkapFullPage – Ekstensi Chrome untuk Screenshot Halaman Penuh

**TangkapFullPage** adalah ekstensi ringan yang saya buat untuk ambil screenshot satu halaman penuh dari situs apa pun—langsung dari browser, tanpa server, tanpa ribet.

## Kenapa saya bikin ini?

Beberapa ekstensi full-page screenshot favorit saya tiba-tiba hilang dari Chrome Web Store. Ada yang kena limit, ada yang kirim data ke server, ada yang nggak jalan di halaman panjang. Jadi saya putuskan bikin sendiri—yang ringan, lokal, dan bisa saya kembangkan sesuai kebutuhan.

## Fitur utama

- ✅ Screenshot seluruh halaman, termasuk bagian di luar viewport
- ✅ Preview langsung di popup
- ✅ Download hasil sebagai PNG
- ✅ Proses 100% lokal—nggak ada data yang dikirim ke mana-mana
- ✅ Penanganan rate-limit Chrome dengan slow mode & zoom-out otomatis

> Rencana ke depan:
> - Editor anotasi (blur, panah, teks)
> - Ekspor ke PDF
> - Opsi sembunyikan header sticky
> - Shortcut keyboard & halaman pengaturan

## Cara pakai

1. Clone atau download repo ini
2. Buka `chrome://extensions`
3. Aktifkan **Developer mode**
4. Klik **Load unpacked** dan pilih folder proyek ini
5. Pin ikon ekstensi di toolbar
6. Buka halaman web → klik ikon → tekan tombol **Capture Full Page**

Setelah proses selesai, kamu bisa lihat preview dan download PNG-nya.

## Catatan penting

Chrome tidak mengizinkan capture di halaman seperti:
- `chrome://*`, `edge://*`, `about:*`
- Chrome Web Store
- Tab baru
- PDF viewer bawaan

Coba di halaman biasa seperti artikel, dashboard, atau situs internal.

## Troubleshooting

- **Popup nggak jalan kalau dibuka langsung**  
  Jangan buka `popup.html` langsung dari file. Gunakan ikon ekstensi di toolbar.

- **Stuck di “Mulai capture…”**  
  Pastikan akses situs diaktifkan dan halaman bukan kategori terlarang.

- **Kena rate-limit**  
  Ekstensi otomatis masuk slow mode dan zoom-out. Kalau masih error, coba reload halaman atau tutup tab berat lain.

- **Garis stitching kelihatan**  
  Bisa diatasi dengan menambah `overlap` di `background.js`.

## Struktur proyek

```
.
├─ manifest.json
├─ background.js
├─ content.js
├─ popup.html
├─ popup.js
├─ styles.css
└─ icons/
   ├─ icon16.png
   ├─ icon48.png
   └─ icon128.png
```

## Lisensi

MIT — silakan pakai, ubah, atau kembangkan sesuai kebutuhan.

---