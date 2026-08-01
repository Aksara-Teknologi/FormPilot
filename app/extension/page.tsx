import Link from "next/link";

const repository = "https://github.com/Aksara-Teknologi/FormPilot";

export default function ExtensionGuidePage() {
  return <main className="knowledge-shell">
    <header className="topbar"><Link className="brand" href="/"><span className="brand-mark">F</span>FormPilot</Link><div className="top-actions"><Link className="nav-link" href="/">← Kembali</Link></div></header>
    <section className="extension-hero"><p className="eyebrow"><span /> BROWSER BRIDGE</p><h1>Hubungkan tab form Anda</h1><p>Pasang extension ini sekali saja. Setelah itu, FormPilot hanya dapat membantu pada tab yang Anda pilih sendiri.</p></section>
    <section className="extension-guide">
      <ol><li><span>1</span><div><h2>Unduh dan ekstrak</h2><p>Unduh paket extension, lalu ekstrak ZIP tersebut di komputer Anda.</p><a className="secondary-button" href="/downloads/formpilot-browser-bridge.zip" download>Unduh FormPilot Browser Bridge ↓</a></div></li><li><span>2</span><div><h2>Buka halaman extension browser</h2><p>Di Chrome buka <code>chrome://extensions</code>. Di Microsoft Edge buka <code>edge://extensions</code>, lalu nyalakan <strong>Developer mode</strong>.</p></div></li><li><span>3</span><div><h2>Pilih folder hasil ekstrak</h2><p>Klik <strong>Load unpacked</strong>, lalu pilih folder <code>extension</code> dari hasil ekstrak ZIP.</p></div></li><li><span>4</span><div><h2>Hubungkan tab saat diperlukan</h2><p>Pin ikon FormPilot. Buka situs tujuan, login sendiri, lalu klik ikon FormPilot pada tab form. Tanda <strong>ON</strong> berarti tab sudah terhubung.</p></div></li></ol>
    </section>
    <section className="extension-note"><strong>Untuk instalasi mandiri</strong><p>Sebelum memuat extension, sesuaikan daftar <code>matches</code> pada <code>extension/manifest.json</code> dengan alamat aplikasi FormPilot milik Anda. Setelah mengubahnya, kembali ke halaman extension browser lalu klik Reload.</p></section>
    <footer><span>FormPilot Browser Bridge</span><span>Hanya untuk tab yang Anda setujui.</span><span><a href={`${repository}/tree/main/extension`}>Lihat source extension ↗</a></span></footer>
  </main>;
}
