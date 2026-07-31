# FormPilot

FormPilot adalah aplikasi Cloudflare Worker untuk mempelajari form melalui MCP, memetakan data dengan Knowledge Packs dan model OpenAI-compatible, lalu mengisi atau mengirim form sesuai kebijakan pengguna.

Produk oleh [Aksara Bayu Teknologi](https://aksarateknologi.com). Domain produksi yang disiapkan: `https://form-pilot.aksarateknologi.com/`.

## Desain keamanan

- File `.xlsx` dibaca langsung di browser pengguna. File tidak diunggah atau disimpan oleh Worker; hanya baris yang dipilih masuk ke plan sementara.
- Google SSO ditangani Cloudflare Access. Worker tetap memvalidasi signature, issuer, dan audience JWT Access.
- API key model, token MCP, dan signing secret hanya berada pada Worker secrets. UI hanya melihat status siap/tidak siap.
- Target URL wajib HTTPS. `ALLOWED_TARGET_HOSTS` bersifat opsional untuk instalasi yang ingin membatasi otomatisasi ke daftar domain tertentu.
- Password, OTP, CAPTCHA, PIN, token, dan secret tidak dikirim ke AI atau MCP autofill.
- Plan berlaku 10 menit dan ditandatangani HMAC. Perubahan terhadap plan membuat token persetujuan tidak valid.
- Isi draft dan submit adalah aksi berbeda. Submit membutuhkan konfirmasi eksplisit kedua.
- Login ke situs target dilakukan sendiri oleh pengguna di tab lain. MCP harus memakai extension/local browser bridge dan hanya boleh mengakses tab yang disetujui pengguna.
- Jawaban acak hanya diizinkan untuk field pilihan biasa. Field legal, deklarasi, identitas, keuangan, kesehatan, password, OTP, dan CAPTCHA tidak boleh diacak.
- Kebijakan konfirmasi submit disimpan per pengguna: `Tanyakan dulu` atau `Tidak perlu konfirmasi`. Dialog pertama menyediakan pilihan **Ya, untuk seterusnya**, dan preferensi dapat diubah kembali dari panel status.
- Knowledge Packs dan setiap aturannya selalu dibatasi oleh identitas Google pengguna. Pack dapat berlaku global atau hanya pada satu origin HTTPS.

## Alur pengguna

1. Pengguna login ke FormPilot dengan Google SSO.
2. Pengguna membuka situs tujuan pada tab lain dan login sendiri.
3. Pengguna menghubungkan tab tersebut melalui browser bridge; bridge tidak mengekspor cookie atau password.
4. Pengguna memilih file `.xlsx`, worksheet, dan baris header. Nama header dapat disesuaikan sebelum memilih baris yang diproses; seluruh pembacaan tetap lokal.
5. MCP merangkum form menjadi label, tipe field, opsi, dan aturan wajib.
6. FormPilot mencocokkan kolom Excel, lalu menerapkan Knowledge Pack akun tersebut. Hanya field yang masih ambigu yang dikirim ke model.
7. Semua jawaban—termasuk pilihan acak—ditampilkan pada layar review sebelum draft diisi atau form dikirim.
8. Setelah aksi berhasil, FormPilot menyimpan riwayat baris per akun dan otomatis memilih baris Excel berikutnya yang belum sukses.

## Knowledge Packs per pengguna

Buka `/knowledge` atau klik **Knowledge** pada header. Setiap pack berisi:

- origin situs opsional, misalnya `https://portal.example.com`;
- pencocok label/nama field, misalnya `Jenis usaha`;
- perilaku: jawaban tetap, tanyakan pengguna, biarkan kosong, atau acak opsi aman.

Urutan planner adalah **Excel exact match → Knowledge Pack → model AI → fallback**. OTP, CAPTCHA, password, dan field sensitif tetap manual dan tidak dapat dioverride oleh Knowledge Pack. Implementasi awal ini memakai aturan terstruktur di D1 agar deterministik dan hemat token; dokumen bebas/semantic RAG dapat ditambahkan dengan Vectorize ketika volume pengetahuan membutuhkannya.

Riwayat input tidak menyimpan nilai kolom Excel. Worker hanya menerima hash SHA-256 baris, nama file, nama sheet, nomor baris asli, origin target, jenis aksi (`draft`/`submit`), dan waktu sukses. Baris bertanda `✓` pada pemilih Excel sudah pernah berhasil untuk file, sheet, dan target tersebut.

## Workflow Scenarios

Buka `/workflows` untuk menjelaskan flow satu kali dengan bahasa biasa. Model mengompilasinya menjadi langkah terbatas (`find_row`, `click`, `wait_for`, `fill`, `pause`) dan menyimpannya per akun serta origin situs. Saat dijalankan ulang, scenario bersifat deterministik dan tidak memanggil model lagi. Browser Bridge mencocokkan teks/label yang terlihat, tidak menjalankan selector buatan model, menolak field sensitif, menjaga origin tab, serta berhenti sebelum tombol final seperti Simpan, Kirim, Hapus, atau Bayar.

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local
npm run dev
```

Tanpa secret, UI tetap dapat mendemonstrasikan inspeksi dan pemetaan lokal dengan data contoh. Jangan commit `.env.local`.

## Browser Bridge lokal

Extension siap pakai berada di folder [`extension`](./extension). Instal sebagai **Load unpacked** melalui `chrome://extensions` atau `edge://extensions`, kemudian pin ke toolbar. Instruksi lengkap tersedia di [`extension/README.md`](./extension/README.md).

Extension memakai izin `activeTab`, bukan akses permanen ke semua situs. Pengguna harus mengklik ikon FormPilot pada tab target setelah login. Izin berakhir ketika tab ditutup atau berpindah ke origin lain.

## Konfigurasi Cloudflare Worker

### 1. Google SSO

1. Tambahkan Google atau Google Workspace di **Cloudflare Zero Trust → Integrations → Identity providers**.
2. Buat **Access → Applications → Self-hosted application** untuk hostname aplikasi.
3. Buat policy `Allow` hanya untuk email, domain, atau grup yang diperlukan.
4. Salin team domain ke `TEAM_DOMAIN` dan Application Audience tag ke `POLICY_AUD`.
5. Nonaktifkan route publik lain yang tidak dilindungi Access, misalnya route `workers.dev` bila memakai custom domain.
6. Tambahkan `form-pilot.aksarateknologi.com` sebagai hostname aplikasi Access dan custom domain deployment.

### 2. Model OpenAI-compatible

Set konfigurasi non-rahasia `OPENAI_BASE_URL` dan `OPENAI_MODEL`. Simpan key sebagai secret:

```bash
npx wrangler secret put OPENAI_API_KEY
```

Endpoint harus menyediakan `POST /chat/completions` dan mendukung respons JSON object. FormPilot mengirim nama field dan nama key saja—bukan nilai data—ketika memerlukan bantuan model.

### 3. MCP browser runner

Simpan endpoint dan nama tool sebagai konfigurasi, kemudian simpan token sebagai secret:

```bash
npx wrangler secret put MCP_AUTH_TOKEN
npx wrangler secret put APP_SIGNING_SECRET
```

`APP_SIGNING_SECRET` sebaiknya berupa random 32 byte atau lebih. Contoh pembuatan lokal:

```bash
openssl rand -base64 32
```

## Kontrak MCP minimal

Server MCP menggunakan Streamable HTTP dan menerima JSON-RPC `tools/call`.

`inspect_form` menerima:

```json
{
  "targetUrl": "https://portal.example.com/form",
  "includeHidden": false,
  "redactSensitive": true
}
```

Hasil terstruktur:

```json
{
  "fields": [
    { "id": "email", "name": "work_email", "label": "Email kantor", "type": "email", "required": true }
  ]
}
```

`fill_form` menerima `targetUrl`, `actor`, `mappings`, `submit`, dan `stopOnUnexpectedNavigation`. `inspect_form` juga menerima `actor`; gunakan nilai identitas ini hanya sebagai namespace sesi browser. Runner harus:

- memakai profil browser terisolasi per pengguna/run;
- hanya mengendalikan tab yang telah disetujui melalui extension/local bridge;
- menyimpan cookie/login hanya di vault atau session browser runner, tidak dalam hasil MCP;
- menolak domain di luar allowlist;
- tidak mengisi field sensitif;
- menghentikan eksekusi saat DOM berubah secara tidak terduga;
- mengembalikan ringkasan aksi yang sudah dilakukan tanpa kredensial atau isi field sensitif.

## Mengapa hemat token

1. MCP merangkum DOM menjadi metadata field yang kecil.
2. Pencocokan nama dilakukan deterministik di Worker terlebih dahulu.
3. Model hanya menerima field yang belum cocok dan daftar nama key.
4. Nilai data tetap di Worker dan digabungkan setelah model mengembalikan nama key.
5. Knowledge Pack menangani kasus berulang tanpa prompt atau embedding.
6. Jika semua label cocok dari Excel/Knowledge, tidak ada panggilan model sama sekali.

## Validasi

```bash
npm run build
npm run lint
```
