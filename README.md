# Amatu Cut

Editor video lengkap di browser, bagian dari Portal AMATU (`amatu-id.github.io/capcut`). Semua proses berjalan di perangkat pengguna, tanpa server.

- **Template & edit otomatis**: 46 template (lagu, ritme potong, transisi, warna, judul). Video dipilih bagian terbaiknya lewat analisis gerak dan ketajaman, lalu dipotong mengikuti ketukan.
- **Linimasa**: multi-trek, potong, trim, salin, bekukan bingkai, balik arah, kecepatan tetap dan kurva, penanda, tempel otomatis, urungkan.
- **Gambar**: 54 transisi, 57 efek, 51 filter, penyesuaian warna, keyframe, animasi masuk/keluar/berulang, masker, green screen, blend mode, picture-in-picture, logo, tanda air.
- **Teks**: 42 gaya, 35 font, 26 animasi, subtitel otomatis (Whisper di perangkat), impor/ekspor SRT.
- **Suara**: 52 lagu dan 28 efek suara yang dibuat dari kode (bebas royalti, tanpa berkas audio), ekstrak suara, ubah nada, gema, gaung, 25 pengubah suara, EQ, kurangi bising, hapus jeda, rekam suara, deteksi ketukan.
- **Kualitas**: penajam GPU, peningkat AI untuk foto dan video, hapus latar foto.
- **Ekspor**: H.264, H.265, VP9, AV1 sampai 4K 60 fps; MP3, WAV, PNG, SRT.

Tanpa build: `index.html`, `css/app.css`, `js/*.js` (ES modules).

| Berkas | Isi |
| --- | --- |
| `js/model.js` | dokumen proyek dan semua aturan waktu |
| `js/render.js` | compositor WebGL2, dipakai pratinjau dan ekspor |
| `js/audio.js`, `js/dsp.worker.js` | grafik suara dan pengolahan (phase vocoder, denoise, ketukan) |
| `js/music.js` | komposer lagu dan efek suara |
| `js/templates.js`, `js/autoedit.js` | template dan edit otomatis |
| `js/export.js` | ekspor dengan WebCodecs lewat mediabunny |
| `js/ai.js`, `js/ai.worker.js`, `js/captions.js` | AI di perangkat |

Media tersimpan di OPFS (cadangan: Cache API), bukan IndexedDB, supaya video tidak ikut tersinkron portal. Proyek (JSON) ada di IndexedDB `amatu-cut` dan tersinkron.

Pihak ketiga: [mediabunny](https://github.com/Vanilagy/mediabunny) (MPL-2.0, `js/vendor`), model Whisper OpenAI (MIT, cermin di `models/`), Real-ESRGAN dan IS-Net dari repo `enhance` dan `background`.
