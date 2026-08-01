"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { InputHistoryItem } from "../lib/input-history";
import type { FormField, FormPlan } from "../lib/types";
import type { WorkflowScenario } from "../lib/workflows";

type SafeConfig = {
  model: { mode: "included" | "personal"; ready: boolean; model: string; baseUrl: string; hasPersonalKey: boolean };
  browserFallbackReady: boolean;
};

type BridgeStatus = { connected: boolean; target?: { title: string; url: string; origin: string } };
type SubmitPolicy = "always_ask" | "auto_submit";
type ExcelCell = string | number | boolean | Date | null;
type ExcelSheet = { sheet: string; data: ExcelCell[][] };

function bridgeRequest<T>(type: "STATUS" | "INSPECT" | "FILL" | "WORKFLOW", payload: Record<string, unknown> = {}, timeoutMs = 2500): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", receive);
      reject(new Error("Browser Bridge tidak merespons"));
    }, timeoutMs);
    function receive(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.source !== "formpilot-extension" || event.data?.requestId !== requestId) return;
      window.clearTimeout(timeout); window.removeEventListener("message", receive);
      const response = event.data.response;
      if (!response?.ok) reject(new Error(response?.error ?? "Browser Bridge gagal"));
      else resolve(response as T);
    }
    window.addEventListener("message", receive);
    window.postMessage({ source: "formpilot-web", requestId, type, payload }, window.location.origin);
  });
}

function Pill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <span className={`status-pill ${ok ? "ok" : "warn"}`}><span className="status-dot" />{children}</span>;
}

export default function FormPilot({ email }: { email: string }) {
  const [config, setConfig] = useState<SafeConfig | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [sourceText, setSourceText] = useState("{}");
  const [fields, setFields] = useState<FormField[]>([]);
  const [plan, setPlan] = useState<FormPlan | null>(null);
  const [approvalToken, setApprovalToken] = useState<string | null>(null);
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Mulai dengan memasukkan alamat form yang ingin Anda isi.");
  const [error, setError] = useState<string | null>(null);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [aiMode, setAiMode] = useState<"included" | "personal">("included");
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiKey, setAiKey] = useState("");
  const [excelName, setExcelName] = useState<string | null>(null);
  const [excelSheets, setExcelSheets] = useState<ExcelSheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelRows, setExcelRows] = useState<Record<string, string | number | boolean | null>[]>([]);
  const [excelRowNumbers, setExcelRowNumbers] = useState<number[]>([]);
  const [selectedRow, setSelectedRow] = useState(0);
  const [fallbackMode, setFallbackMode] = useState<"ask" | "blank" | "random_safe">("ask");
  const [bridge, setBridge] = useState<BridgeStatus>({ connected: false });
  const [submitPolicy, setSubmitPolicyState] = useState<SubmitPolicy>("always_ask");
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [inputHistory, setInputHistory] = useState<InputHistoryItem[]>([]);
  const [workflowScenarios, setWorkflowScenarios] = useState<WorkflowScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState("");

  useEffect(() => {
    fetch("/api/config", { cache: "no-store" })
      .then((response) => response.json() as Promise<SafeConfig>)
      .then((next) => { setConfig(next); setAiMode(next.model.mode); setAiBaseUrl(next.model.baseUrl); setAiModel(next.model.model); })
      .catch(() => setNotice("Konfigurasi server belum dapat dibaca."));
    fetch("/api/preferences/submit-policy", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ policy: SubmitPolicy }> : null)
      .then((data) => data && setSubmitPolicyState(data.policy))
      .catch(() => undefined);
    fetch("/api/input-history", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ history: InputHistoryItem[] }> : null)
      .then((data) => data && setInputHistory(data.history))
      .catch(() => undefined);
    fetch("/api/workflows", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ scenarios: WorkflowScenario[] }> : null)
      .then((data) => { if (data) { setWorkflowScenarios(data.scenarios); setSelectedScenarioId(data.scenarios[0]?.id ?? ""); } })
      .catch(() => undefined);
    const refreshBridge = () => {
      bridgeRequest<{ ok: true; connected: boolean; target?: BridgeStatus["target"] }>("STATUS", {}, 900)
        .then((status) => setBridge({ connected: status.connected, target: status.target }))
        .catch(() => setBridge({ connected: false }));
    };
    const timer = window.setTimeout(refreshBridge, 250);
    window.addEventListener("focus", refreshBridge);
    return () => { window.clearTimeout(timer); window.removeEventListener("focus", refreshBridge); };
  }, []);

  const browserReady = bridge.connected || Boolean(config?.browserFallbackReady);
  const progress = useMemo(() => stage === 1 ? "33%" : stage === 2 ? "66%" : "100%", [stage]);
  const unanswered = plan?.mappings.filter((mapping) => mapping.method === "manual" && !mapping.sensitive && mapping.value === null).length ?? 0;
  const matchingScenarios = useMemo(() => {
    try { const origin = new URL(targetUrl).origin; return workflowScenarios.filter((scenario) => scenario.isActive && scenario.siteOrigin === origin); }
    catch { return []; }
  }, [targetUrl, workflowScenarios]);
  const workflowCreateHref = useMemo(() => {
    try { return `/workflows?origin=${encodeURIComponent(new URL(targetUrl).origin)}`; }
    catch { return "/workflows"; }
  }, [targetUrl]);

  function rowWasSuccessful(history: InputHistoryItem[], fileName: string, rowNumber: number, sheetName = selectedSheet): boolean {
    let origin: string;
    try { origin = new URL(targetUrl).origin; } catch { return false; }
    return history.some((item) => item.fileName === fileName && item.sheetName === sheetName && item.rowNumber === rowNumber && item.targetOrigin === origin);
  }

  function inferHeaderRow(rows: ExcelCell[][]): number {
    const candidates = rows.slice(0, 20);
    const index = candidates.findIndex((row) => row.filter((cell) => cell !== null && String(cell).trim()).length >= 2);
    return index >= 0 ? index : 0;
  }

  function headersFromRow(rows: ExcelCell[][], index: number): string[] {
    const width = Math.max(rows[index]?.length ?? 0, ...rows.slice(index + 1, index + 6).map((row) => row.length));
    return Array.from({ length: width }, (_, column) => String(rows[index]?.[column] ?? `kolom_${column + 1}`).trim() || `kolom_${column + 1}`);
  }

  function applySheet(sheet: ExcelSheet, nextHeaderRow: number, headers: string[], fileName: string) {
    const normalizedHeaders = headers.map((header) => header.trim());
    if (normalizedHeaders.some((header) => !header)) throw new Error("Semua nama header wajib diisi");
    if (new Set(normalizedHeaders.map((header) => header.toLowerCase())).size !== normalizedHeaders.length) throw new Error("Nama header harus unik");
    const prepared = sheet.data.slice(nextHeaderRow + 1).map((row, offset) => ({ row, rowNumber: nextHeaderRow + offset + 2 }))
      .filter(({ row }) => row.some((cell) => cell !== null && String(cell).trim() !== ""))
      .map(({ row, rowNumber }) => ({
        rowNumber,
        record: Object.fromEntries(normalizedHeaders.map((header, column) => {
          const cell = row[column];
          const value = cell instanceof Date ? cell.toISOString() : cell === undefined ? null : cell;
          return [header, typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null ? value : String(value)];
        })),
      }));
    if (!prepared.length) throw new Error("Tidak ada baris data setelah header yang dipilih");
    const firstPending = prepared.findIndex(({ rowNumber }) => !rowWasSuccessful(inputHistory, fileName, rowNumber, sheet.sheet));
    const startIndex = firstPending >= 0 ? firstPending : 0;
    const records = prepared.map((item) => item.record);
    setExcelRows(records); setExcelRowNumbers(prepared.map((item) => item.rowNumber)); setSelectedRow(startIndex);
    setSourceText(JSON.stringify(records[startIndex], null, 2));
    setPlan(null); setApprovalToken(null);
    setNotice(firstPending >= 0 ? `${records.length} baris siap dari sheet “${sheet.sheet}”. Dimulai dari baris ${prepared[startIndex].rowNumber}.` : `${records.length} baris pada sheet ini sudah pernah sukses.`);
  }

  async function readExcel(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const { default: readWorkbook } = await import("read-excel-file/browser");
      const workbook = await readWorkbook(file) as ExcelSheet[];
      if (!workbook.length) throw new Error("Workbook tidak memiliki sheet");
      const firstSheet = workbook[0];
      const inferredHeader = inferHeaderRow(firstSheet.data);
      const headers = headersFromRow(firstSheet.data, inferredHeader);
      setExcelName(file.name); setExcelSheets(workbook); setSelectedSheet(firstSheet.sheet);
      setHeaderRow(inferredHeader); setExcelHeaders(headers);
      applySheet(firstSheet, inferredHeader, headers, file.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "File Excel tidak dapat dibaca");
    } finally { setBusy(false); }
  }

  function chooseSheet(sheetName: string) {
    const sheet = excelSheets.find((item) => item.sheet === sheetName);
    if (!sheet || !excelName) return;
    setError(null);
    try {
      const inferredHeader = inferHeaderRow(sheet.data);
      const headers = headersFromRow(sheet.data, inferredHeader);
      setSelectedSheet(sheetName); setHeaderRow(inferredHeader); setExcelHeaders(headers);
      applySheet(sheet, inferredHeader, headers, excelName);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sheet tidak dapat dibaca"); }
  }

  function chooseHeaderRow(index: number) {
    const sheet = excelSheets.find((item) => item.sheet === selectedSheet);
    if (!sheet || !excelName) return;
    setError(null);
    try {
      const headers = headersFromRow(sheet.data, index);
      setHeaderRow(index); setExcelHeaders(headers);
      applySheet(sheet, index, headers, excelName);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Header tidak valid"); }
  }

  function renameHeader(index: number, value: string) {
    const sheet = excelSheets.find((item) => item.sheet === selectedSheet);
    if (!sheet || !excelName) return;
    const headers = excelHeaders.map((header, column) => column === index ? value : header);
    setExcelHeaders(headers); setError(null);
    try { applySheet(sheet, headerRow, headers, excelName); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Header tidak valid"); }
  }

  function chooseRow(index: number) {
    setSelectedRow(index);
    setSourceText(JSON.stringify(excelRows[index], null, 2));
  }

  async function runWorkflow() {
    const scenarioId = matchingScenarios.some((scenario) => scenario.id === selectedScenarioId) ? selectedScenarioId : matchingScenarios[0]?.id;
    if (!bridge.connected || !scenarioId) return;
    setBusy(true); setError(null);
    try {
      const source: unknown = JSON.parse(sourceText);
      const response = await fetch("/api/authorize-workflow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenarioId, targetUrl, source }) });
      const authorization = await response.json() as { authorizationId?: string; targetUrl?: string; scenario?: { name: string; steps: WorkflowScenario["steps"] }; source?: Record<string, unknown>; error?: string };
      if (!response.ok || !authorization.authorizationId || !authorization.targetUrl || !authorization.scenario || !authorization.source) throw new Error(authorization.error ?? "Workflow tidak dapat dijalankan");
      const workflow = await bridgeRequest<{ ok: true; result: { completedSteps: number; paused: boolean; message?: string } }>("WORKFLOW", authorization as unknown as Record<string, unknown>, 45000);
      const inspected = await bridgeRequest<{ ok: true; fields: FormField[]; target: { title: string; url: string } }>("INSPECT", { targetUrl }, 12000);
      setFields(inspected.fields); setPlan(null); setApprovalToken(null);
      setNotice(`${authorization.scenario.name}: ${workflow.result.completedSteps} langkah selesai.${workflow.result.paused ? ` Berhenti untuk tinjauan: ${workflow.result.message ?? "periksa tab target"}.` : ""} ${inspected.fields.length} field aktif siap dipetakan.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Workflow gagal dijalankan"); }
    finally { setBusy(false); }
  }

  async function inspect() {
    setBusy(true); setError(null); setPlan(null); setApprovalToken(null);
    try {
      if (bridge.connected) {
        const data = await bridgeRequest<{ ok: true; fields: FormField[]; target: { title: string; url: string } }>("INSPECT", { targetUrl }, 12000);
        setFields(data.fields); setStage(2); setNotice(`${data.fields.length} field dibaca dari tab “${data.target.title}”. Cookie dan password tetap di tab tersebut.`);
        return;
      }
      if (!config?.browserFallbackReady) throw new Error("Hubungkan tab form melalui extension FormPilot terlebih dahulu.");
      const response = await fetch("/api/inspect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUrl }) });
      const data = await response.json() as { fields?: FormField[]; error?: string };
      if (!response.ok || !data.fields) throw new Error(data.error ?? "Inspeksi gagal");
      setFields(data.fields); setStage(2); setNotice(`${data.fields.length} field ditemukan. Data sensitif tidak akan dikirim ke AI.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Inspeksi gagal");
    } finally { setBusy(false); }
  }

  async function createPlan() {
    setBusy(true); setError(null);
    try {
      const source: unknown = JSON.parse(sourceText);
      const response = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUrl, fields, source, fallbackMode }) });
      const data = await response.json() as { plan?: FormPlan; approvalToken?: string | null; error?: string };
      if (!response.ok || !data.plan) throw new Error(data.error ?? "Pemetaan gagal");
      setPlan(data.plan); setApprovalToken(data.approvalToken ?? null); setStage(3);
      setNotice(data.plan.summary.aiMapped ? `Selesai. Knowledge menangani ${data.plan.summary.knowledgeMapped} field; AI hanya menangani ${data.plan.summary.aiMapped} field ambigu.` : `Selesai tanpa panggilan AI—${data.plan.summary.knowledgeMapped} field dijawab Knowledge dan sisanya cocok secara lokal.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pastikan data sumber berupa JSON yang valid");
    } finally { setBusy(false); }
  }

  function updateManualAnswer(fieldId: string, value: string) {
    setPlan((current) => current ? {
      ...current,
      mappings: current.mappings.map((mapping) => mapping.fieldId === fieldId ? { ...mapping, value: value || null } : mapping),
      summary: { ...current.summary, ready: current.mappings.filter((mapping) => mapping.fieldId === fieldId ? Boolean(value) : mapping.value !== null).length },
    } : current);
    setApprovalToken(null);
  }

  async function approveAnswers() {
    if (!plan || unanswered) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const data = await response.json() as { approvalToken?: string; error?: string };
      if (!response.ok || !data.approvalToken) throw new Error(data.error ?? "Jawaban gagal divalidasi");
      setApprovalToken(data.approvalToken); setNotice("Jawaban telah dikunci ke plan persetujuan selama 10 menit.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Jawaban gagal divalidasi"); }
    finally { setBusy(false); }
  }

  async function saveSubmitPolicy(policy: SubmitPolicy): Promise<boolean> {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/preferences/submit-policy", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ policy }) });
      const data = await response.json() as { policy?: SubmitPolicy; error?: string };
      if (!response.ok || !data.policy) throw new Error(data.error ?? "Preferensi gagal disimpan");
      setSubmitPolicyState(data.policy);
      setNotice(data.policy === "auto_submit" ? "Konfirmasi tambahan dinonaktifkan untuk akun ini." : "Konfirmasi submit diaktifkan kembali.");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Preferensi gagal disimpan");
      return false;
    } finally { setBusy(false); }
  }

  async function saveAiSettings() {
    setBusy(true); setError(null);
    try {
      const payload = aiMode === "included" ? { mode: "included" } : { mode: "personal", baseUrl: aiBaseUrl, model: aiModel, apiKey: aiKey };
      const response = await fetch("/api/preferences/model", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { model?: SafeConfig["model"]; error?: string };
      if (!response.ok || !data.model) throw new Error(data.error ?? "Pilihan AI belum tersimpan");
      const nextModel = data.model;
      setConfig((current) => current ? { ...current, model: nextModel } : current); setAiKey("");
      setNotice(nextModel.mode === "personal" ? "AI pribadi Anda siap digunakan untuk akun ini." : "Anda menggunakan AI bawaan FormPilot.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Pilihan AI belum tersimpan"); }
    finally { setBusy(false); }
  }

  async function rowHash(row: Record<string, string | number | boolean | null>): Promise<string> {
    const canonical = JSON.stringify(Object.fromEntries(Object.entries(row).sort(([left], [right]) => left.localeCompare(right))));
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function finishSuccessfulInput(submit: boolean, successNotice: string) {
    if (!excelName || !excelRows[selectedRow]) { setNotice(successNotice); return; }
    let latestHistory = inputHistory;
    let historySaved = false;
    try {
      const response = await fetch("/api/input-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowHash: await rowHash(excelRows[selectedRow]), fileName: excelName, sheetName: selectedSheet,
          rowNumber: excelRowNumbers[selectedRow] ?? selectedRow + 2, targetUrl, mode: submit ? "submit" : "draft",
        }),
      });
      const data = await response.json() as { history?: InputHistoryItem[]; error?: string };
      if (!response.ok || !data.history) throw new Error(data.error ?? "Riwayat gagal disimpan");
      latestHistory = data.history; setInputHistory(data.history); historySaved = true;
    } catch {
      // Aksi pada situs tujuan sudah berhasil; kegagalan audit tidak boleh mengulang submit.
    }
    const nextIndex = excelRows.findIndex((_, index) => index > selectedRow && !rowWasSuccessful(latestHistory, excelName, excelRowNumbers[index] ?? index + 2));
    if (nextIndex >= 0) {
      setSelectedRow(nextIndex); setSourceText(JSON.stringify(excelRows[nextIndex], null, 2));
      setPlan(null); setApprovalToken(null); setStage(2);
      setNotice(`${successNotice} ${historySaved ? "Riwayat disimpan." : "Riwayat belum tersimpan."} Lanjut otomatis ke baris ${excelRowNumbers[nextIndex] ?? nextIndex + 2}.`);
    } else {
      setNotice(`${successNotice} ${historySaved ? "Riwayat disimpan; semua baris selesai." : "Semua baris selesai, tetapi riwayat belum tersimpan."}`);
    }
  }

  async function execute(submit: boolean, confirmed = false) {
    if (!plan || !approvalToken) return;
    if (submit && submitPolicy === "always_ask" && !confirmed) {
      setShowSubmitDialog(true);
      return;
    }
    setBusy(true); setError(null);
    try {
      if (bridge.connected) {
        const authorizationResponse = await fetch("/api/authorize-browser", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, approvalToken, submit, confirmSubmit: submit }) });
        const authorization = await authorizationResponse.json() as { authorizationId?: string; targetUrl?: string; mappings?: Array<Record<string, unknown>>; submit?: boolean; error?: string };
        if (!authorizationResponse.ok || !authorization.authorizationId || !authorization.targetUrl || !authorization.mappings) throw new Error(authorization.error ?? "Otorisasi browser gagal");
        const bridgeResult = await bridgeRequest<{ ok: true; result: { changedCount: number; submitted: boolean } }>("FILL", {
          authorizationId: authorization.authorizationId,
          targetUrl: authorization.targetUrl,
          mappings: authorization.mappings,
          submit: authorization.submit === true,
        }, 15000);
        await finishSuccessfulInput(submit, bridgeResult.result.submitted ? "Form dikirim dari tab yang terhubung." : `${bridgeResult.result.changedCount} field diisi sebagai draft pada tab yang terhubung.`);
        return;
      }
      const response = await fetch("/api/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, approvalToken, submit, confirmSubmit: submit }) });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Eksekusi gagal");
      await finishSuccessfulInput(submit, submit ? "Form berhasil dikirim melalui MCP." : "Draft berhasil diisi melalui MCP.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Eksekusi gagal"); }
    finally { setBusy(false); }
  }

  async function confirmForever() {
    const saved = await saveSubmitPolicy("auto_submit");
    if (!saved) return;
    setShowSubmitDialog(false);
    await execute(true, true);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="FormPilot beranda"><span className="brand-mark">F</span>FormPilot</a>
        <div className="top-actions">
          <Link className="nav-link" href="/extension">Pasang extension</Link>
          <Link className="nav-link" href="/workflows">Langkah otomatis</Link>
          <Link className="nav-link" href="/knowledge">Knowledge</Link>
          {email === "Mode lokal" ? (
            <span className="avatar" title={email}>L</span>
          ) : (
            <>
              <span className="avatar" title={email} aria-label={`Akun ${email}`}>{email.slice(0, 1).toUpperCase()}</span>
              <a className="nav-link" href="/api/auth/logout" title={`Keluar dari ${email}`} aria-label={`Keluar dari akun ${email}`}>Keluar</a>
            </>
          )}
        </div>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow"><span /> AI FORM OPERATOR</p>
          <h1>Input data,<br /><em>dengan kendali.</em></h1>
          <p className="hero-copy">AI mempelajari struktur form, mencocokkan data, lalu berhenti untuk persetujuan Anda sebelum melakukan apa pun.</p>
        </div>
        <aside className="trust-card">
          <div className="trust-icon">⌁</div>
          <div><strong>Excel lokal, kredensial terisolasi</strong><span>File dibaca di perangkat; login dan cookie tetap berada di browser pengguna.</span></div>
        </aside>
      </section>

      <section className="workspace">
        <div className="stepper" aria-label="Tahapan pekerjaan">
          {([
            [1, "Pelajari form", "Baca struktur & aturan"],
            [2, "Cocokkan data", "Pemetaan hemat token"],
            [3, "Tinjau & jalankan", "Manusia memutuskan"],
          ] as const).map(([number, title, subtitle]) => (
            <button key={number} className={`step ${stage === number ? "active" : stage > number ? "done" : ""}`} onClick={() => number < stage && setStage(number as 1 | 2 | 3)}>
              <span className="step-number">{stage > number ? "✓" : number}</span><span><strong>{title}</strong><small>{subtitle}</small></span>
            </button>
          ))}
          <div className="progress-track"><span style={{ width: progress }} /></div>
        </div>

        <div className="work-grid">
          <section className="work-card primary-card">
            {stage === 1 && <>
              <div className="section-heading"><span className="section-icon">↗</span><div><p>LANGKAH 01</p><h2>Form mana yang ingin diisi?</h2></div></div>
              <label className="field-label" htmlFor="target-url">URL form target <span>WAJIB</span></label>
              <div className="url-input"><span>https://</span><input id="target-url" value={targetUrl.replace(/^https?:\/\//, "")} onChange={(event) => setTargetUrl(`https://${event.target.value.replace(/^https?:\/\//, "")}`)} placeholder="portal.perusahaan.com/form" /></div>
              <p className="field-help">Buka situs tujuan pada tab lain, login sendiri, lalu klik ikon FormPilot pada tab itu. Extension hanya mendapat akses sementara ke tab yang Anda pilih.</p>
              <div className={`bridge-banner ${bridge.connected ? "connected" : ""}`}><span>{bridge.connected ? "✓" : "○"}</span><div><strong>{bridge.connected ? "Tab browser terhubung" : "Menunggu Browser Bridge"}</strong><small>{bridge.target?.title ?? "Install extension, lalu klik ikonnya pada tab form setelah login"}</small></div></div>
              <div className="scope-row"><span>AI akan membaca</span><b>Label</b><b>Tipe field</b><b>Opsi</b><b>Aturan wajib</b></div>
              <div className="browser-actions"><a className="secondary-button open-target" href={targetUrl} target="_blank" rel="noreferrer">1. Buka situs & login ↗</a><button className="main-button compact" onClick={inspect} disabled={busy}>{busy ? "Menghubungkan…" : "2. Hubungkan tab & pelajari"}<span>→</span></button></div>
            </>}

            {stage === 2 && <>
              <div className="section-heading"><span className="section-icon">⌘</span><div><p>LANGKAH 02</p><h2>Data apa yang akan dipetakan?</h2></div></div>
              <label className="field-label" htmlFor="excel-file">File Excel dari perangkat <span>.XLSX</span></label>
              <label className="excel-drop" htmlFor="excel-file"><span className="excel-icon">X</span><span><strong>{excelName ?? "Pilih file Excel"}</strong><small>{excelName ? `${excelRows.length} baris tersedia · file tetap lokal` : "Klik untuk memilih .xlsx · file tidak diunggah"}</small></span><b>Pilih file</b></label>
              <input id="excel-file" className="visually-hidden" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => readExcel(event.target.files?.[0])} />
              {excelSheets.length > 0 && <>
                <div className="excel-settings">
                  <label>Sheet<select value={selectedSheet} onChange={(event) => chooseSheet(event.target.value)}>{excelSheets.map((sheet) => <option key={sheet.sheet}>{sheet.sheet}</option>)}</select></label>
                  <label>Baris header<select value={headerRow} onChange={(event) => chooseHeaderRow(Number(event.target.value))}>{(excelSheets.find((sheet) => sheet.sheet === selectedSheet)?.data ?? []).slice(0, 20).map((row, index) => <option value={index} key={index}>Baris {index + 1} · {row.filter((cell) => cell !== null).slice(0, 3).map(String).join(" | ") || "kosong"}</option>)}</select></label>
                </div>
                <div className="header-editor"><div><strong>Sesuaikan nama header</strong><span>Nama ini dipakai untuk mencocokkan field form</span></div><div>{excelHeaders.map((header, index) => <label key={index}><span>Kolom {index + 1}</span><input value={header} onChange={(event) => renameHeader(index, event.target.value)} aria-label={`Nama header kolom ${index + 1}`} /></label>)}</div></div>
              </>}
              {excelRows.length > 0 && <label className="row-picker">Baris yang akan diproses<select value={selectedRow} onChange={(event) => chooseRow(Number(event.target.value))}>{excelRows.map((row, index) => { const rowNumber = excelRowNumbers[index] ?? index + 2; return <option value={index} key={rowNumber}>{excelName && rowWasSuccessful(inputHistory, excelName, rowNumber) ? "✓ " : ""}Baris {rowNumber} · {String(Object.values(row)[0] ?? "tanpa nama")}</option>; })}</select></label>}
              <div className="workflow-runner"><div><strong>Langkah tambahan untuk form ini</strong><span>Gunakan bila perlu membuka Edit, modal, atau wizard terlebih dahulu.</span></div>{matchingScenarios.length ? <><select value={matchingScenarios.some((scenario) => scenario.id === selectedScenarioId) ? selectedScenarioId : matchingScenarios[0].id} onChange={(event) => setSelectedScenarioId(event.target.value)}>{matchingScenarios.map((scenario) => <option value={scenario.id} key={scenario.id}>{scenario.name}</option>)}</select><button onClick={runWorkflow} disabled={busy || !bridge.connected || !excelRows.length}>Jalankan langkah</button></> : <Link href={workflowCreateHref}>Simpan langkah untuk form ini →</Link>}</div>
              <label className="field-label source-label" htmlFor="source-data">Pratinjau data terpilih <span>BISA DIEDIT</span></label>
              <textarea id="source-data" className="source-editor" value={sourceText} onChange={(event) => setSourceText(event.target.value)} spellCheck={false} />
              <label className="fallback-policy">Jika jawaban tidak ditemukan di Excel<select value={fallbackMode} onChange={(event) => setFallbackMode(event.target.value as "ask" | "blank" | "random_safe")}><option value="ask">Tanyakan kepada pengguna</option><option value="blank">Biarkan kosong</option><option value="random_safe">Pilih acak dari opsi yang aman</option></select></label>
              <div className="privacy-note"><span>◉</span><p><strong>Hemat token & otomatis lanjut</strong>Nilai Excel tidak dikirim ke model. Setelah input berhasil, baris dicatat tanpa isi datanya lalu FormPilot memilih baris berikutnya yang belum sukses.</p></div>
              <div className="button-row"><button className="secondary-button" onClick={() => setStage(1)}>Kembali</button><button className="main-button compact" onClick={createPlan} disabled={busy}>{busy ? "Memetakan…" : "Cocokkan data"}<span>→</span></button></div>
            </>}

            {stage === 3 && plan && <>
              <div className="section-heading"><span className="section-icon">✓</span><div><p>LANGKAH 03</p><h2>Periksa sebelum dijalankan</h2></div></div>
              <div className="summary-row"><div><strong>{plan.summary.ready}</strong><span>Siap diisi</span></div><div><strong>{plan.summary.knowledgeMapped}</strong><span>Knowledge</span></div><div><strong>{plan.summary.aiMapped}</strong><span>Dipetakan AI</span></div><div><strong>{plan.summary.manual}</strong><span>Isi manual</span></div></div>
              <div className="mapping-list">
                {plan.mappings.map((mapping) => <div className="mapping" key={mapping.fieldId}>
                  <div><strong>{mapping.fieldLabel}</strong><span>{mapping.sensitive ? "Data sensitif—AI dilewati" : mapping.sourceKey ? `Sumber: ${mapping.sourceKey}` : "Belum ditemukan"}</span></div>
                  <div className="mapping-value">{mapping.sensitive ? "Isi di browser tujuan" : mapping.method === "manual" ? (() => { const field = plan.fields.find((item) => item.id === mapping.fieldId); return field?.options?.length ? <select aria-label={`Jawaban untuk ${mapping.fieldLabel}`} value={mapping.value === null ? "" : String(mapping.value)} onChange={(event) => updateManualAnswer(mapping.fieldId, event.target.value)}><option value="">Pilih jawaban…</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select> : <input aria-label={`Jawaban untuk ${mapping.fieldLabel}`} value={mapping.value === null ? "" : String(mapping.value)} onChange={(event) => updateManualAnswer(mapping.fieldId, event.target.value)} placeholder="Jawab di sini…" />; })() : mapping.value === null ? "Dibiarkan kosong" : String(mapping.value)}</div>
                  <span className={`method ${mapping.method}`}>{mapping.method === "exact" ? "Excel" : mapping.method === "knowledge" ? "Knowledge" : mapping.method === "ai" ? "AI" : mapping.method === "random" ? "Acak" : mapping.method === "blank" ? "Kosong" : "Manual"}</span>
                </div>)}
              </div>
              <div className="approval-box"><span>!</span><p><strong>Belum ada tindakan ke sistem tujuan.</strong>{submitPolicy === "auto_submit" ? " Submit langsung aktif: tombol kirim tidak menampilkan dialog tambahan." : " Isi draft tidak menekan submit; tombol kirim akan menawarkan konfirmasi sekali atau untuk seterusnya."}</p></div>
              {!approvalToken && !unanswered && <button className="answer-approval" onClick={approveAnswers} disabled={busy}>Validasi jawaban manual</button>}
              {unanswered > 0 && <p className="answer-warning">Masih ada {unanswered} pertanyaan yang perlu dijawab sebelum submit.</p>}
              <div className="button-row triple"><button className="secondary-button" onClick={() => setStage(2)}>Ubah data</button><button className="secondary-button dark" onClick={() => execute(false)} disabled={busy || !browserReady || !approvalToken}>Isi sebagai draft</button><button className="main-button compact danger" onClick={() => execute(true)} disabled={busy || !browserReady || !approvalToken || unanswered > 0}>{submitPolicy === "auto_submit" ? "Kirim sekarang" : "Setujui & kirim"}</button></div>
            </>}

            {(notice || error) && <div className={`notice ${error ? "error" : ""}`} role="status">{error ?? notice}</div>}
          </section>

          <aside className="side-column">
            <section className="side-card">
              <div className="side-title"><div><p>SIAP DIGUNAKAN</p><h3>Ruang kerja Anda</h3></div><button onClick={() => setShowAiSettings(!showAiSettings)}>{showAiSettings ? "Selesai" : "Pilihan AI"}</button></div>
              <div className="connection"><span className="connection-icon coral">AI</span><div><strong>Asisten pengisian</strong><small>{config?.model.mode === "personal" ? "Menggunakan AI pribadi Anda" : "AI bawaan FormPilot"}</small></div><Pill ok={Boolean(config?.model.ready)}>{config?.model.ready ? "Siap" : "Belum siap"}</Pill></div>
              <div className="connection"><span className="connection-icon mint">B</span><div><strong>Tab form</strong><small>{bridge.target?.title ?? "Hubungkan setelah login ke situs tujuan"}</small></div><Pill ok={bridge.connected}>{bridge.connected ? "Terhubung" : "Belum terhubung"}</Pill></div>
              <label className="submit-setting">Konfirmasi submit<select value={submitPolicy} onChange={(event) => saveSubmitPolicy(event.target.value as SubmitPolicy)} disabled={busy}><option value="always_ask">Tanyakan dulu</option><option value="auto_submit">Tidak perlu konfirmasi</option></select></label>
              {showAiSettings && <div className="setup-panel">
                <strong>Pilih cara menggunakan AI</strong>
                <label className="ai-choice"><input type="radio" name="ai-mode" checked={aiMode === "included"} onChange={() => setAiMode("included")} /><span><b>Gunakan AI bawaan</b><small>Gratis untuk kebutuhan sederhana.</small></span></label>
                <label className="ai-choice"><input type="radio" name="ai-mode" checked={aiMode === "personal"} onChange={() => setAiMode("personal")} /><span><b>Gunakan AI pribadi saya</b><small>Pakai akun AI Anda sendiri untuk pilihan model dan kapasitas yang lebih sesuai.</small></span></label>
                {aiMode === "personal" && <div className="ai-fields">
                  <label>Alamat layanan AI<input value={aiBaseUrl} onChange={(event) => setAiBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" /></label>
                  <label>Nama model<input value={aiModel} onChange={(event) => setAiModel(event.target.value)} placeholder="Contoh: gpt-4.1-mini" /></label>
                  <label>API key {config?.model.hasPersonalKey && <span>Opsional jika tidak diubah</span>}<input value={aiKey} onChange={(event) => setAiKey(event.target.value)} type="password" autoComplete="new-password" placeholder={config?.model.hasPersonalKey ? "Tersimpan aman — isi hanya untuk mengganti" : "Masukkan API key Anda"} /></label>
                </div>}
                <button className="secondary-button" onClick={saveAiSettings} disabled={busy}>Simpan pilihan AI</button>
                <span>API key pribadi dienkripsi dan tidak pernah ditampilkan kembali.</span>
              </div>}
            </section>

            <section className="side-card token-card">
              <div className="token-head"><span>≈</span><div><p>MODE EFISIEN</p><h3>Token dipakai seperlunya</h3></div></div>
              <ul><li><span>01</span><p><strong>DOM diringkas</strong>Hanya metadata field, bukan seluruh halaman.</p></li><li><span>02</span><p><strong>Cocokkan lokal dulu</strong>AI hanya menerima bagian ambigu.</p></li><li><span>03</span><p><strong>State tidak diulang</strong>Satu plan ringkas untuk satu persetujuan.</p></li></ul>
            </section>

            <section className="side-card history-card">
              <div className="side-title"><div><p>RIWAYAT SUKSES</p><h3>Baris terakhir</h3></div><span>{inputHistory.length}</span></div>
              <div className="history-list">{inputHistory.slice(0, 5).map((item) => <div className="history-item" key={item.id}><span>✓</span><div><strong>{item.fileName} · {item.sheetName} · baris {item.rowNumber}</strong><small>{item.mode === "submit" ? "Dikirim" : "Draft diisi"} ke {item.targetOrigin}</small></div></div>)}{!inputHistory.length && <p>Belum ada baris yang berhasil diinput.</p>}</div>
            </section>
          </aside>
        </div>
      </section>

      {showSubmitDialog && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowSubmitDialog(false)}>
        <section className="submit-modal" role="dialog" aria-modal="true" aria-labelledby="submit-dialog-title">
          <span className="modal-mark">→</span>
          <p>SUBMIT FORM</p>
          <h2 id="submit-dialog-title">Kirim data sekarang?</h2>
          <span>Anda dapat menyetujui satu kali atau mematikan dialog ini untuk submit berikutnya pada akun yang sama.</span>
          <div className="modal-actions"><button className="secondary-button" onClick={() => setShowSubmitDialog(false)}>Batal</button><button className="secondary-button dark" onClick={() => { setShowSubmitDialog(false); execute(true, true); }}>Ya, kali ini</button><button className="main-button compact" onClick={confirmForever} disabled={busy}>Ya, untuk seterusnya</button></div>
        </section>
      </div>}

      <footer>
        <span>FormPilot</span>
        <span>Produk oleh <a href="https://aksarateknologi.com" target="_blank" rel="noreferrer">Aksara Bayu Teknologi ↗</a></span>
        <span>AI menyarankan. Anda memutuskan.</span>
      </footer>
    </main>
  );
}
