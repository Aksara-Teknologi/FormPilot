# FormPilot

> Isi form berulang dari Excel—lebih cepat, tetap terkendali.

[Demo](https://form-pilot.aksarateknologi.com/) · [Browser Bridge](./extension/README.md) · [Keamanan](./SECURITY.md)

![Tampilan FormPilot](./public/og.png)

FormPilot adalah aplikasi web untuk membantu operator memindahkan data dari file Excel ke form web yang berulang. Pengguna login sendiri ke situs tujuan, memilih file Excel di perangkatnya, lalu FormPilot membantu mencocokkan dan mengisi field form. Untuk form yang memiliki tabel, tombol Edit, modal, atau wizard, pengguna dapat menyimpan alur khusus untuk form tersebut.

## Untuk siapa?

- Tim operasional yang menginput banyak data ke portal web.
- Admin yang menerima data dalam Excel dan harus mengisi form yang sama berulang kali.
- Tim yang membutuhkan alur pengisian konsisten, tanpa menyerahkan kredensial situs kepada aplikasi.

## Cara kerja

1. Buka situs tujuan di tab lain dan login seperti biasa.
2. Hubungkan tab yang dipilih melalui Browser Bridge.
3. Pilih file Excel, sheet, header, dan baris yang ingin diisi. File dibaca secara lokal di browser.
4. FormPilot mencocokkan kolom Excel dengan field form. Aturan yang tersimpan untuk situs tersebut digunakan lebih dulu; AI hanya membantu bagian yang belum jelas.
5. Tinjau hasilnya, isi sebagai draft atau kirim sesuai kebijakan yang dipilih.
6. Riwayat sukses menandai baris yang selesai dan memilih baris berikutnya secara otomatis.

## Fitur utama

- **Excel tetap lokal** — workbook tidak diunggah ke server FormPilot.
- **Alur per form** — simpan langkah seperti “cari data → klik Edit → isi modal → berhenti sebelum Simpan” untuk satu situs/form tertentu.
- **Knowledge Packs** — simpan jawaban atau aturan yang berulang untuk akun dan situs Anda.
- **AI hemat token** — pencocokan nama dilakukan lokal terlebih dahulu; AI hanya menerima metadata field dan nama kolom yang ambigu, bukan nilai Excel.
- **AI bawaan atau BYOK** — gunakan AI bawaan untuk kebutuhan sederhana atau masukkan endpoint, model, dan API key OpenAI-compatible milik Anda.
- **Riwayat aman** — riwayat sukses menyimpan hash baris, bukan isi data Excel.

## Batas keamanan

- Password, PIN, OTP, CAPTCHA, token, CVV/CVC, dan secret tidak dikirim ke AI dan tidak diisi otomatis.
- Login situs target tetap dilakukan oleh pengguna di browser target; cookie dan password tidak diekspor oleh Browser Bridge.
- Submit dapat diatur per akun: selalu tanyakan atau lanjut tanpa dialog tambahan.
- Tombol akhir seperti Simpan, Kirim, Hapus, atau Bayar tidak dimasukkan dalam workflow AI; skenario berhenti sebelum tindakan tersebut.
- API key BYOK dienkripsi per pengguna dan tidak pernah ditampilkan kembali.

## Menjalankan secara lokal

Prasyarat: Node.js 22+ dan akun Cloudflare bila ingin memakai D1/Workers.

```bash
git clone https://github.com/Aksara-Teknologi/FormPilot.git
cd FormPilot
npm install
cp .env.example .env.local
npm run dev
```

Buka `http://localhost:3000`. Untuk mengisi form sungguhan, instal extension dari folder [`extension`](./extension) melalui mode **Load unpacked** pada Chrome atau Edge.

## Deploy sendiri ke Cloudflare Workers

Bagian ini untuk instalasi mandiri. Ganti semua nilai contoh dengan domain dan akun Anda sendiri.

### 1. Siapkan resource Cloudflare

1. Buat database D1.
2. Buat Worker dan custom domain jika diperlukan.
3. Salin `.env.example` untuk mencatat konfigurasi yang dibutuhkan.
4. Isi GitHub repository secrets/variables atau environment deployment Anda sendiri.

Variabel non-rahasia yang diperlukan:

```text
CLOUDFLARE_D1_DATABASE_ID=
CLOUDFLARE_D1_DATABASE_NAME=
CLOUDFLARE_WORKER_NAME=
FORMPILOT_HOSTNAME=app.example.com
GOOGLE_CLIENT_ID=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=
```

Secrets yang diperlukan:

```text
CLOUDFLARE_API_TOKEN=
APP_SIGNING_SECRET=
GOOGLE_CLIENT_SECRET=
OPENAI_API_KEY=
```

`OPENAI_API_KEY` dipakai sebagai AI bawaan. Pengguna tetap dapat memilih BYOK bila fitur tersebut diaktifkan.

### 2. Konfigurasikan Google Sign-In

1. Buat OAuth Client bertipe **Web application** di Google Cloud Console.
2. Tambahkan origin aplikasi Anda, misalnya `https://app.example.com`.
3. Tambahkan redirect URI: `https://app.example.com/api/auth/google/callback`.
4. Simpan client ID sebagai `GOOGLE_CLIENT_ID` dan client secret sebagai `GOOGLE_CLIENT_SECRET`.
5. Opsional: batasi domain email melalui `GOOGLE_ALLOWED_DOMAINS`, dipisahkan koma.

FormPilot meminta scope `openid email profile` saja; tidak meminta akses Gmail atau Drive.

### 3. Jalankan migrasi dan deploy

Repository ini memiliki workflow GitHub Actions `Release production`. Atau deploy dengan Wrangler sesuai konfigurasi produksi yang dihasilkan proyek:

```bash
npm run check
npm run release:verify
npm run release:config
cd dist/server
npx wrangler d1 migrations apply DB --remote --config wrangler.production.json
npx wrangler deploy --config wrangler.production.json
```

Atur secrets melalui Wrangler sebelum deploy pertama:

```bash
npx wrangler secret put APP_SIGNING_SECRET --config wrangler.production.json
npx wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.production.json
npx wrangler secret put OPENAI_API_KEY --config wrangler.production.json
```

Gunakan secret acak yang kuat untuk `APP_SIGNING_SECRET`, misalnya `openssl rand -base64 32`.

## Konfigurasi Browser Bridge dan MCP

Browser Bridge adalah pilihan paling aman untuk situs yang pengguna login sendiri: extension hanya bekerja pada tab yang disetujui pengguna. Petunjuk instalasi ada di [`extension/README.md`](./extension/README.md).

Instalasi yang memakai MCP server-side dapat mengatur `MCP_SERVER_URL`, `MCP_INSPECT_TOOL`, `MCP_FILL_TOOL`, serta secret `MCP_AUTH_TOKEN`. MCP harus memakai HTTPS, membatasi tab/domain yang disetujui, dan tidak mengembalikan kredensial atau data sensitif.

## Validasi

```bash
npm run check
```

Perintah ini menjalankan lint, typecheck, test, dan audit dependensi produksi.

## Kontribusi

Issue dan pull request dipersilakan. Untuk perubahan yang menyentuh autentikasi, kredensial, Browser Bridge, atau otomatisasi form, baca [`SECURITY.md`](./SECURITY.md) terlebih dahulu.

## Lisensi dan kredit

FormPilot dikembangkan oleh [Aksara Bayu Teknologi](https://aksarateknologi.com/).
