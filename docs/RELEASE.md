# Release FormPilot

Release produksi berjalan pada Cloudflare Workers melalui GitHub Actions. CI selalu memvalidasi pull request; deployment hanya berjalan melalui tag `v*` atau pemicu manual pada environment `production`.

## 1. GitHub environment

Buat environment bernama `production`. Aktifkan required reviewer bila repository digunakan oleh lebih dari satu pengelola.

Tambahkan environment secrets:

| Nama | Isi |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Token terbatas untuk Workers Scripts, D1, dan route/custom domain pada account produksi |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID Cloudflare |
| `APP_SIGNING_SECRET` | Random secret minimal 32 byte |
| `OPENAI_API_KEY` | Key endpoint model OpenAI-compatible |

Tambahkan environment variables:

| Nama | Wajib | Contoh/keterangan |
| --- | --- | --- |
| `CLOUDFLARE_D1_DATABASE_ID` | Ya | UUID database D1 produksi |
| `CLOUDFLARE_D1_DATABASE_NAME` | Tidak | `formpilot-production` |
| `CLOUDFLARE_WORKER_NAME` | Tidak | `formpilot` |
| `FORMPILOT_HOSTNAME` | Tidak | `form-pilot.aksarateknologi.com` |
| `TEAM_DOMAIN` | Ya | `https://nama-team.cloudflareaccess.com` |
| `POLICY_AUD` | Ya | Audience tag aplikasi Access |
| `OPENAI_BASE_URL` | Tidak | `https://api.openai.com/v1` atau endpoint compatible |
| `OPENAI_MODEL` | Ya | Nama model pada endpoint tersebut |
| `ALLOWED_TARGET_HOSTS` | Tidak | Allowlist hostname dipisahkan koma; kosong berarti semua target HTTPS |
| `MCP_SERVER_URL` | Tidak | Kosongkan bila memakai Browser Bridge |
| `MCP_INSPECT_TOOL` | Tidak | Default `inspect_form` |
| `MCP_FILL_TOOL` | Tidak | Default `fill_form` |

Jika remote MCP digunakan, tambahkan `MCP_AUTH_TOKEN` langsung sebagai Worker secret melalui dashboard atau Wrangler. Browser Bridge tidak memerlukan token ini.

## 2. Cloudflare Access

1. Tambahkan Google/Google Workspace sebagai identity provider.
2. Buat aplikasi Access untuk `form-pilot.aksarateknologi.com`.
3. Batasi policy ke email, domain, atau grup yang diizinkan.
4. Pastikan hostname `workers.dev` tidak menjadi jalur publik alternatif.

## 3. Membuat release

1. Pastikan CI branch `main` hijau.
2. Samakan versi `package.json` dan `extension/manifest.json`.
3. Buat dan push tag, misalnya `v0.2.0`.
4. Workflow akan menjalankan validasi, backup dan migrasi D1, deployment, lalu membuat GitHub Release berisi paket Browser Bridge dan artefak situs.
5. Lakukan smoke test login, inspect, draft, submit, history auto-next, Knowledge Pack, dan Workflow Scenario.

Rollback kode dilakukan dari Cloudflare Workers Deployments. Migrasi D1 selalu membuat backup sebelum diterapkan; perubahan schema yang merusak harus dirilis sebagai migrasi maju, bukan menghapus file migrasi lama.
