"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { WorkflowScenario } from "../../lib/workflows";

type ApiResult = { scenarios?: WorkflowScenario[]; error?: string };
const actionNames = { find_row: "Cari baris", click: "Klik", wait_for: "Tunggu", fill: "Isi field", pause: "Berhenti & tinjau" } as const;

export default function WorkflowManager({ email }: { email: string }) {
  const searchParams = useSearchParams();
  const [scenarios, setScenarios] = useState<WorkflowScenario[]>([]);
  const [prompt, setPrompt] = useState("");
  const [siteOrigin, setSiteOrigin] = useState(() => searchParams.get("origin") ?? "");
  const [busy, setBusy] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; fetch("/api/workflows", { cache: "no-store" }).then(async (response) => ({ response, data: await response.json() as ApiResult })).then(({ response, data }) => { if (!response.ok || !data.scenarios) throw new Error(data.error ?? "Scenario gagal dibaca"); if (active) setScenarios(data.scenarios); }).catch((cause: unknown) => active && setError(cause instanceof Error ? cause.message : "Scenario gagal dibaca")).finally(() => active && setBusy(false)); return () => { active = false; }; }, []);
  async function mutate(payload: Record<string, unknown>) { setBusy(true); setError(null); try { const response = await fetch("/api/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json() as ApiResult; if (!response.ok || !data.scenarios) throw new Error(data.error ?? "Scenario gagal disimpan"); setScenarios(data.scenarios); } catch (cause) { setError(cause instanceof Error ? cause.message : "Scenario gagal disimpan"); } finally { setBusy(false); } }
  return <main className="knowledge-shell">
    <header className="topbar"><Link className="brand" href="/"><span className="brand-mark">F</span>FormPilot</Link><div className="top-actions"><Link className="nav-link" href="/">← Operator</Link>{email === "Mode lokal" ? <span className="avatar" title={email}>L</span> : <><span className="avatar" title={email} aria-label={`Akun ${email}`}>{email.slice(0, 1).toUpperCase()}</span><a className="nav-link" href="/api/auth/logout" title={`Keluar dari ${email}`} aria-label={`Keluar dari akun ${email}`}>Keluar</a></>}</div></header>
    <section className="knowledge-hero"><div><p className="eyebrow"><span /> LANGKAH PER FORM</p><h1>Langkah otomatis</h1><p>Ceritakan alur dengan bahasa biasa. FormPilot menyimpannya hanya untuk situs form ini dan dapat menjalankannya kembali tanpa membuat ulang dengan AI.</p></div><div className="knowledge-metric"><strong>{scenarios.length}</strong><span>langkah tersimpan</span><small>khusus untuk akun Anda</small></div></section>
    <section className="knowledge-layout workflow-layout">
      <form className="knowledge-create workflow-create" onSubmit={(event) => { event.preventDefault(); void mutate({ action: "compile", prompt, siteOrigin }); }}><p>LANGKAH BARU</p><h2>Apa yang perlu dilakukan sebelum mengisi?</h2><label>Alamat situs form<input value={siteOrigin} onChange={(event) => setSiteOrigin(event.target.value)} placeholder="Masukkan alamat form terlebih dahulu" required /></label><label>Ceritakan langkahnya<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={4000} placeholder="Contoh: cari data berdasarkan NIK, pilih Lengkapi Data, isi langkah wizard sampai sebelum Simpan." required /></label><small>Sebutkan nama tombol dan nama kolom Excel. Kode OTP, CAPTCHA, dan tombol kirim akhir tetap Anda lakukan sendiri.</small><button className="main-button" disabled={busy}>{busy ? "Menyusun…" : "Simpan langkah untuk form ini"}<span>→</span></button>{error && <div className="notice error">{error}</div>}</form>
      <div className="knowledge-list">{!busy && !scenarios.length && <div className="knowledge-empty"><strong>Belum ada langkah otomatis.</strong><span>Simpan alur pertama untuk sebuah form agar dapat dipakai lagi pada pengisian berikutnya.</span></div>}{scenarios.map((scenario) => <article className="knowledge-pack workflow-pack" key={scenario.id}><header><div><p>{scenario.siteOrigin}</p><h2>{scenario.name}</h2><span>{scenario.description}</span></div><div className="pack-actions"><button onClick={() => mutate({ action: "delete", id: scenario.id })} disabled={busy}>Hapus</button></div></header><ol className="workflow-steps">{scenario.steps.map((step, index) => <li key={index}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{actionNames[step.action]}</strong><small>{step.description}</small></div></li>)}</ol></article>)}</div>
    </section>
    <footer><span>FormPilot / Workflows</span><span>Produk oleh <a href="https://aksarateknologi.com" target="_blank" rel="noreferrer">Aksara Bayu Teknologi ↗</a></span><span>Prompt sekali. Jalankan berulang.</span></footer>
  </main>;
}
