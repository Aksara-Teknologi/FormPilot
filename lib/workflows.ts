import { getD1 } from "../db";
import { readEnv } from "./runtime-env";

export type WorkflowStep =
  | { action: "find_row"; sourceKey: string; buttonText: string; description: string }
  | { action: "click"; text: string; description: string }
  | { action: "wait_for"; text: string; description: string }
  | { action: "fill"; fieldLabel: string; sourceKey: string; description: string }
  | { action: "pause"; message: string; description: string };

export type WorkflowScenario = {
  id: string; name: string; description: string; siteOrigin: string; prompt: string;
  steps: WorkflowStep[]; isActive: boolean; createdAt: number; updatedAt: number;
};

const createTable = `CREATE TABLE IF NOT EXISTS workflow_scenarios (
  id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '', site_origin TEXT NOT NULL, prompt TEXT NOT NULL,
  steps_json TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
)`;

async function ensureTable(database: D1Database) {
  await database.batch([
    database.prepare(createTable),
    database.prepare("CREATE INDEX IF NOT EXISTS workflow_scenarios_owner_site_idx ON workflow_scenarios (owner_id, site_origin)"),
  ]);
}

function parseSteps(value: string): WorkflowStep[] {
  try { const parsed: unknown = JSON.parse(value); return validateWorkflowSteps(parsed); }
  catch { return []; }
}

export function validateWorkflowSteps(value: unknown): WorkflowStep[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) throw new Error("Scenario harus memiliki 1–30 langkah");
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`Langkah ${index + 1} tidak valid`);
    const row = item as Record<string, unknown>;
    const action = row.action;
    const description = typeof row.description === "string" ? row.description.trim().slice(0, 240) : `Langkah ${index + 1}`;
    const required = (key: string) => {
      const result = typeof row[key] === "string" ? row[key].trim() : "";
      if (!result || result.length > 200) throw new Error(`Langkah ${index + 1}: ${key} tidak valid`);
      return result;
    };
    if (action === "find_row") return { action, sourceKey: required("sourceKey"), buttonText: required("buttonText"), description };
    if (action === "click") {
      const text = required("text");
      if (/submit|simpan|kirim|hapus|delete|bayar|payment/i.test(text)) throw new Error(`Langkah ${index + 1}: tombol final harus dijalankan manual`);
      return { action, text, description };
    }
    if (action === "wait_for") return { action, text: required("text"), description };
    if (action === "fill") {
      const fieldLabel = required("fieldLabel");
      const sourceKey = required("sourceKey");
      if (/password|pin|otp|captcha|secret|token|cvv|cvc/i.test(`${fieldLabel} ${sourceKey}`)) throw new Error(`Langkah ${index + 1}: field sensitif tidak diizinkan`);
      return { action, fieldLabel, sourceKey, description };
    }
    if (action === "pause") return { action, message: required("message"), description };
    throw new Error(`Langkah ${index + 1}: aksi tidak dikenal`);
  });
}

function scenario(row: { id: string; name: string; description: string; site_origin: string; prompt: string; steps_json: string; is_active: number; created_at: number; updated_at: number }): WorkflowScenario {
  return { id: row.id, name: row.name, description: row.description, siteOrigin: row.site_origin, prompt: row.prompt, steps: parseSteps(row.steps_json), isActive: row.is_active === 1, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function listWorkflowScenarios(ownerId: string): Promise<WorkflowScenario[]> {
  const database = getD1(); await ensureTable(database);
  const result = await database.prepare("SELECT * FROM workflow_scenarios WHERE owner_id = ?1 ORDER BY updated_at DESC").bind(ownerId).all<Parameters<typeof scenario>[0]>();
  return (result.results ?? []).map(scenario);
}

export async function getWorkflowScenario(ownerId: string, id: string): Promise<WorkflowScenario | null> {
  const database = getD1(); await ensureTable(database);
  const row = await database.prepare("SELECT * FROM workflow_scenarios WHERE id = ?1 AND owner_id = ?2 AND is_active = 1").bind(id, ownerId).first<Parameters<typeof scenario>[0]>();
  return row ? scenario(row) : null;
}

export async function saveWorkflowScenario(ownerId: string, input: Omit<WorkflowScenario, "id" | "isActive" | "createdAt" | "updatedAt">): Promise<void> {
  const database = getD1(); await ensureTable(database); const now = Date.now();
  await database.prepare(`INSERT INTO workflow_scenarios (id, owner_id, name, description, site_origin, prompt, steps_json, is_active, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?8)`)
    .bind(crypto.randomUUID(), ownerId, input.name, input.description, input.siteOrigin, input.prompt, JSON.stringify(input.steps), now).run();
}

export async function deleteWorkflowScenario(ownerId: string, id: string): Promise<void> {
  const database = getD1(); await ensureTable(database);
  await database.prepare("DELETE FROM workflow_scenarios WHERE id = ?1 AND owner_id = ?2").bind(id, ownerId).run();
}

export async function compileWorkflow(prompt: string, siteOrigin: string): Promise<{ name: string; description: string; steps: WorkflowStep[] }> {
  const baseUrl = readEnv("OPENAI_BASE_URL")?.replace(/\/$/, "") ?? "https://api.openai.com/v1";
  const apiKey = readEnv("OPENAI_API_KEY"); const model = readEnv("OPENAI_MODEL");
  if (!apiKey || !model) throw new Error("Model API belum dikonfigurasi untuk membuat scenario");
  const endpoint = new URL(`${baseUrl}/chat/completions`);
  if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost") throw new Error("OPENAI_BASE_URL wajib HTTPS");
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({
      model, temperature: 0, max_tokens: 1200, response_format: { type: "json_object" }, messages: [
        { role: "system", content: `Create a deterministic browser workflow from the user's Indonesian instruction. Origin: ${siteOrigin}. Return JSON {name,description,steps}. Allowed steps only: find_row {sourceKey,buttonText,description}; click {text,description}; wait_for {text,description}; fill {fieldLabel,sourceKey,description}; pause {message,description}. Use visible labels/text, never CSS selectors. Never handle password, OTP, CAPTCHA, PIN, token, payment, delete, submit, save, or send. End with pause before any final action. Values use Excel sourceKey names and are never provided.` },
        { role: "user", content: prompt },
      ],
    }) });
    if (!response.ok) throw new Error(`Model gagal (${response.status})`);
    const body: unknown = await response.json();
    const content = (body as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content;
    if (!content) throw new Error("Model tidak mengembalikan scenario");
    const parsed: unknown = JSON.parse(content); if (!parsed || typeof parsed !== "object") throw new Error("Format scenario tidak valid");
    const result = parsed as Record<string, unknown>;
    const name = typeof result.name === "string" ? result.name.trim().slice(0, 80) : "Scenario baru";
    const description = typeof result.description === "string" ? result.description.trim().slice(0, 400) : "";
    return { name, description, steps: validateWorkflowSteps(result.steps) };
  } finally { clearTimeout(timeout); }
}
