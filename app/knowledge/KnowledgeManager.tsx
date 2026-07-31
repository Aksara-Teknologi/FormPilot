"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { KnowledgeBehavior, KnowledgePack } from "../../lib/knowledge";

type ApiResult = { packs?: KnowledgePack[]; error?: string };
const labels: Record<KnowledgeBehavior, string> = { answer: "Jawaban tetap", ask: "Tanyakan pengguna", blank: "Biarkan kosong", random_safe: "Acak opsi aman" };

export default function KnowledgeManager({ email }: { email: string }) {
  const [packs, setPacks] = useState<KnowledgePack[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [siteOrigin, setSiteOrigin] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { matchText: string; behavior: KnowledgeBehavior; answerValue: string }>>({});

  useEffect(() => {
    let active = true;
    fetch("/api/knowledge-packs", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() as ApiResult }))
      .then(({ response, data }) => {
        if (!response.ok || !data.packs) throw new Error(data.error ?? "Data gagal dibaca");
        if (active) setPacks(data.packs);
      })
      .catch((cause: unknown) => active && setError(cause instanceof Error ? cause.message : "Data gagal dibaca"))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, []);

  async function mutate(payload: Record<string, unknown>) {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/knowledge-packs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as ApiResult;
      if (!response.ok || !data.packs) throw new Error(data.error ?? "Perubahan gagal disimpan");
      setPacks(data.packs); return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Perubahan gagal disimpan"); return false; }
    finally { setBusy(false); }
  }

  async function createPack(event: React.FormEvent) {
    event.preventDefault();
    if (await mutate({ action: "create_pack", name, description, siteOrigin })) { setName(""); setDescription(""); setSiteOrigin(""); }
  }
  function draft(packId: string) { return drafts[packId] ?? { matchText: "", behavior: "answer" as const, answerValue: "" }; }
  function setDraft(packId: string, value: Partial<ReturnType<typeof draft>>) { setDrafts((current) => ({ ...current, [packId]: { ...draft(packId), ...value } })); }
  async function addRule(event: React.FormEvent, packId: string) {
    event.preventDefault(); const value = draft(packId);
    if (await mutate({ action: "add_rule", packId, ...value, priority: 100 })) setDrafts((current) => ({ ...current, [packId]: { matchText: "", behavior: "answer", answerValue: "" } }));
  }

  return <main className="knowledge-shell">
    <header className="topbar"><Link className="brand" href="/"><span className="brand-mark">F</span>FormPilot</Link><div className="top-actions"><Link className="nav-link" href="/">← Operator</Link><button className="avatar" title={email}>{email === "Mode lokal" ? "L" : email.slice(0, 1).toUpperCase()}</button></div></header>
    <section className="knowledge-hero"><div><p className="eyebrow"><span /> PENGETAHUAN PER PENGGUNA</p><h1>Knowledge Packs</h1><p>Ajarkan aturan yang berulang sekali, lalu gunakan secara lokal sebelum model AI. Pack hanya terlihat oleh akun Anda.</p></div><div className="knowledge-metric"><strong>{packs.filter((pack) => pack.isActive).length}</strong><span>pack aktif</span><small>{packs.reduce((total, pack) => total + pack.rules.length, 0)} aturan tersimpan</small></div></section>
    <section className="knowledge-layout">
      <form className="knowledge-create" onSubmit={createPack}><p>PACK BARU</p><h2>Untuk situs atau kasus apa?</h2><label>Nama pack<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Contoh: Registrasi vendor" required /></label><label>Origin situs <span>OPSIONAL</span><input value={siteOrigin} onChange={(event) => setSiteOrigin(event.target.value)} placeholder="https://portal.example.com" /></label><small>Kosongkan origin agar aturan berlaku pada semua situs. Path tidak disimpan.</small><label>Deskripsi<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={400} placeholder="Kapan pack ini digunakan?" /></label><button className="main-button" disabled={busy}>Buat Knowledge Pack <span>→</span></button></form>
      <div className="knowledge-list">
        {error && <div className="notice error">{error}</div>}
        {busy && !packs.length && <div className="knowledge-empty">Memuat knowledge Anda…</div>}
        {!busy && !packs.length && <div className="knowledge-empty"><strong>Belum ada Knowledge Pack.</strong><span>Buat pack pertama untuk menyimpan jawaban dan kebijakan field yang sering muncul.</span></div>}
        {packs.map((pack) => <article className={`knowledge-pack ${pack.isActive ? "" : "inactive"}`} key={pack.id}>
          <header><div><p>{pack.siteOrigin ?? "SEMUA SITUS"}</p><h2>{pack.name}</h2><span>{pack.description || "Tanpa deskripsi"}</span></div><div className="pack-actions"><label><input type="checkbox" checked={pack.isActive} onChange={(event) => mutate({ action: "toggle_pack", packId: pack.id, isActive: event.target.checked })} disabled={busy} /> Aktif</label><button onClick={() => mutate({ action: "delete_pack", packId: pack.id })} disabled={busy}>Hapus</button></div></header>
          <div className="rule-list">{pack.rules.map((rule) => <div className="knowledge-rule" key={rule.id}><div><strong>{rule.matchText}</strong><span>{labels[rule.behavior]}{rule.answerValue ? ` · ${rule.answerValue}` : ""}</span></div><button aria-label={`Hapus aturan ${rule.matchText}`} onClick={() => mutate({ action: "delete_rule", ruleId: rule.id })} disabled={busy}>×</button></div>)}{!pack.rules.length && <p className="no-rules">Belum ada aturan pada pack ini.</p>}</div>
          <form className="rule-form" onSubmit={(event) => addRule(event, pack.id)}><input aria-label="Nama field yang dicocokkan" value={draft(pack.id).matchText} onChange={(event) => setDraft(pack.id, { matchText: event.target.value })} placeholder="Label/nama field, mis. Jenis usaha" required /><select aria-label="Perilaku aturan" value={draft(pack.id).behavior} onChange={(event) => setDraft(pack.id, { behavior: event.target.value as KnowledgeBehavior })}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{draft(pack.id).behavior === "answer" && <input aria-label="Jawaban tetap" value={draft(pack.id).answerValue} onChange={(event) => setDraft(pack.id, { answerValue: event.target.value })} placeholder="Jawaban tetap" required />}<button disabled={busy}>Tambah aturan</button></form>
        </article>)}
      </div>
    </section>
    <footer><span>FormPilot / Knowledge</span><span>Produk oleh <a href="https://aksarateknologi.com" target="_blank" rel="noreferrer">Aksara Bayu Teknologi ↗</a></span><span>Aturan lokal sebelum AI.</span></footer>
  </main>;
}
