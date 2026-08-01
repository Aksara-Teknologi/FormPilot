import Link from "next/link";

const repository = "https://github.com/Aksara-Teknologi/FormPilot";

export default function ExtensionGuidePage() {
  return <main className="knowledge-shell">
    <header className="topbar"><Link className="brand" href="/"><span className="brand-mark">F</span>FormPilot</Link><div className="top-actions"><Link className="nav-link" href="/">← Kembali</Link></div></header>
    <section className="knowledge-hero"><div><p className="eyebrow"><span /> BROWSER BRIDGE</p><h1>Pasang extension<br />FormPilot</h1><p>Extension ini menghubungkan hanya tab yang Anda pilih ke FormPilot. Login, cookie, dan password tetap berada di browser Anda.</p></div></section>
    <section className="extension-guide">
      <article className="extension-card"><span>1</span><h2>Unduh FormPilot</h2><p>Jika belum memiliki source code, unduh repository FormPilot sebagai ZIP lalu ekstrak di komputer Anda.</p><a className="secondary-button" href={`${repository}/archive/refs/heads/main.zip`}>Unduh ZIP proyek ↗</a></article>
      <article className="extension-card"><span>2</span><h2>Buka halaman extension</h2><p>Di Chrome buka <code>chrome://extensions</code>. Di Microsoft Edge buka <code>edge://extensions</code>.</p></article>
      <article className="extension-card"><span>3</span><h2>Aktifkan mode developer</h2><p>Nyalakan <strong>Developer mode</strong> di pojok kanan atas halaman tersebut.</p></article>
      <article className="extension-card"><span>4</span><h2>Muat folder extension</h2><p>Klik <strong>Load unpacked</strong>, lalu pilih folder <code>extension</code> di dalam folder FormPilot yang sudah diekstrak.</p></article>
      <article className="extension-card"><span>5</span><h2>Pin dan hubungkan tab</h2><p>Pin ikon FormPilot. Buka situs tujuan, login sendiri, lalu klik ikon FormPilot pada tab form. Tanda <strong>ON</strong> berarti tab sudah terhubung.</p></article>
    </section>
    <section className="extension-note"><strong>Untuk instalasi mandiri</strong><p>Sebelum memuat extension, sesuaikan daftar <code>matches</code> pada <code>extension/manifest.json</code> dengan alamat aplikasi FormPilot milik Anda. Setelah mengubahnya, kembali ke halaman extension browser lalu klik Reload.</p></section>
    <footer><span>FormPilot Browser Bridge</span><span>Hanya untuk tab yang Anda setujui.</span><span><a href={`${repository}/tree/main/extension`}>Lihat source extension ↗</a></span></footer>
  </main>;
}
