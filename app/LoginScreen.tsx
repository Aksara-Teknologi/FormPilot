import Link from "next/link";

export default function LoginScreen({ ready }: { ready: boolean }) {
  return <main className="landing-shell">
    <header className="landing-nav"><Link className="brand" href="/"><span className="brand-mark">F</span>FormPilot</Link><div><Link className="landing-help" href="/extension">Pasang extension</Link>{ready ? <a className="landing-login" href="/api/auth/google?return_to=/">Masuk dengan Google</a> : null}</div></header>
    <section className="landing-hero">
      <p className="eyebrow"><span /> ASISTEN PENGISIAN FORM</p>
      <h1>Isi banyak form dari Excel, <em>tanpa kerja berulang.</em></h1>
      <p>FormPilot membantu Anda membuka alur form, mencocokkan data Excel, dan mengisi field di tab yang sudah Anda login sendiri.</p>
      <div className="landing-actions">{ready ? <a className="landing-primary" href="/api/auth/google?return_to=/">Mulai dengan Google <span>→</span></a> : <span className="notice error">Layanan masuk sedang disiapkan. Silakan coba lagi nanti.</span>}<small>Tidak perlu akses ke Gmail atau Google Drive.</small></div>
    </section>
    <section className="landing-steps" aria-label="Cara kerja FormPilot"><article><b>01</b><h2>Buka & login sendiri</h2><p>Anda memilih situs tujuan dan masuk dengan akun Anda di browser seperti biasa.</p></article><article><b>02</b><h2>Pilih file Excel</h2><p>File dibaca di perangkat Anda. Pilih sheet, header, dan baris yang ingin diproses.</p></article><article><b>03</b><h2>Tinjau lalu jalankan</h2><p>FormPilot menyiapkan isian dan membantu menjalankan langkah berulang pada form tersebut.</p></article></section>
    <section className="landing-assurance"><div><p className="eyebrow"><span /> DIBUAT UNTUK PEKERJAAN BERULANG</p><h2>Satu alur untuk satu form.</h2><p>Untuk form yang memiliki tombol Edit, modal, atau wizard, jelaskan langkahnya sekali. Alur itu disimpan khusus untuk form dan akun Anda.</p></div><ul><li>Data Excel tetap di perangkat Anda</li><li>OTP, CAPTCHA, dan password tetap Anda isi sendiri</li><li>Gunakan AI bawaan atau API key pribadi Anda</li></ul></section>
    <section className="landing-final"><h2>Siap mengurangi pekerjaan input yang berulang?</h2>{ready ? <a className="landing-primary" href="/api/auth/google?return_to=/">Mulai menggunakan FormPilot <span>→</span></a> : null}</section>
    <footer><span>FormPilot · Input data yang lebih rapi</span><span>Produk oleh <a href="https://aksarateknologi.com" target="_blank" rel="noreferrer">Aksara Bayu Teknologi ↗</a></span><span>File Anda tetap di perangkat Anda.</span></footer>
  </main>;
}
