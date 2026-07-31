import Link from "next/link";

export default function LoginScreen({ ready }: { ready: boolean }) {
  return <main className="login-shell">
    <section className="login-card">
      <Link className="brand" href="/"><span className="brand-mark">F</span>FormPilot</Link>
      <p className="eyebrow"><span /> AI FORM OPERATOR</p>
      <h1>Masuk untuk mulai mengisi form.</h1>
      <p>Gunakan akun Google. FormPilot hanya meminta identitas dasar—tidak meminta akses Drive, Gmail, atau password Anda.</p>
      {ready ? <a className="google-login" href="/api/auth/google?return_to=/"><b>G</b><span>Lanjutkan dengan Google</span></a> : <div className="notice error">Google OAuth belum dikonfigurasi oleh administrator.</div>}
      <small>File Excel tetap dibaca di perangkat. Sesi login disimpan dalam cookie aman FormPilot.</small>
    </section>
    <footer><span>FormPilot / Google OAuth</span><span>Produk oleh <a href="https://aksarateknologi.com">Aksara Bayu Teknologi ↗</a></span></footer>
  </main>;
}
