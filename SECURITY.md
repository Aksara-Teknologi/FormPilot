# Security Policy

## Supported versions

Hanya release terbaru FormPilot yang menerima perbaikan keamanan.

## Melaporkan kerentanan

Jangan membuat GitHub issue publik untuk kerentanan, kredensial, atau data pengguna. Gunakan **Security → Report a vulnerability** pada repository GitHub FormPilot. Sertakan dampak, langkah reproduksi minimal, dan versi yang terdampak tanpa menyertakan data pribadi nyata.

Aksara Bayu Teknologi akan mengonfirmasi laporan, melakukan triase, dan mengoordinasikan publikasi setelah perbaikan tersedia.

## Batas keamanan produk

- Jangan pernah menyertakan API key, cookie, password, OTP, CAPTCHA, PIN, atau token dalam issue dan log.
- Browser Bridge hanya boleh dipasang dari paket release resmi atau saluran enterprise yang dikelola.
- Deployment produksi wajib dilindungi Cloudflare Access dan menggunakan allowlist hostname target.
