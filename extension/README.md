# FormPilot Browser Bridge

Extension Chrome/Edge Manifest V3 ini hanya memakai `activeTab`: akses ke situs tujuan diberikan sementara setelah pengguna mengklik ikon extension pada tab tersebut. Extension tidak meminta akses permanen ke semua situs.

## Instal lokal

1. Buka `chrome://extensions` atau `edge://extensions`.
2. Aktifkan **Developer mode**.
3. Pilih **Load unpacked**.
4. Pilih folder `extension` pada project ini.
5. Pin **FormPilot Browser Bridge** ke toolbar.

## Cara pakai

1. Buka situs tujuan dan login sendiri.
2. Setelah halaman form terbuka, klik ikon FormPilot. Badge `ON` menandakan tab terhubung.
3. Kembali ke FormPilot, isi URL dengan origin yang sama, lalu tekan **Hubungkan tab & pelajari**.
4. Akses otomatis berakhir bila tab ditutup atau berpindah ke origin lain.

Workflow Scenario dapat mencari baris tabel dari nilai Excel, mengklik tombol Edit/Lengkapi, menunggu modal/wizard, dan mengisi field berdasarkan label. Scenario hanya memakai teks yang terlihat, tidak menerima selector CSS dari AI, tetap pada origin tab yang disetujui, dan berhenti sebelum tombol final seperti Simpan/Kirim/Hapus/Bayar.

Extension tidak membaca cookie, password, OTP, CAPTCHA, field file, input tersembunyi, atau field disabled/read-only. Submit hanya dilakukan setelah server FormPilot memvalidasi token persetujuan.
