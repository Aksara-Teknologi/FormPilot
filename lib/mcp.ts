import { readEnv } from "./runtime-env";
import { validateTargetUrl } from "./security";
import type { FormField, FormPlan } from "./types";

const MAX_MCP_RESPONSE_BYTES = 512_000;

async function readBoundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("MCP tidak mengirim respons");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_MCP_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Respons MCP terlalu besar");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(merged));
}

async function callMcp(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const endpointValue = readEnv("MCP_SERVER_URL");
  const token = readEnv("MCP_AUTH_TOKEN");
  if (!endpointValue || !token) throw new Error("Koneksi MCP belum dikonfigurasi");
  const endpoint = new URL(endpointValue);
  if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost") {
    throw new Error("MCP_SERVER_URL wajib memakai HTTPS");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`MCP gagal (${response.status})`);
    return await readBoundedJson(response);
  } finally {
    clearTimeout(timeout);
  }
}

function getStructuredResult(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const root = value as Record<string, unknown>;
  const result = root.result;
  if (!result || typeof result !== "object") return result;
  const resultRecord = result as Record<string, unknown>;
  if (resultRecord.structuredContent) return resultRecord.structuredContent;
  if (Array.isArray(resultRecord.content)) {
    const textItem = resultRecord.content.find((item) =>
      item && typeof item === "object" && (item as Record<string, unknown>).type === "text"
    );
    const text = textItem && (textItem as Record<string, unknown>).text;
    if (typeof text === "string") {
      try { return JSON.parse(text); } catch { return { message: text }; }
    }
  }
  return result;
}

export async function inspectForm(targetUrl: string, actor: string): Promise<FormField[]> {
  validateTargetUrl(targetUrl);
  const result = getStructuredResult(await callMcp(readEnv("MCP_INSPECT_TOOL") ?? "inspect_form", {
    targetUrl,
    actor,
    includeHidden: false,
    redactSensitive: true,
  }));
  if (!result || typeof result !== "object") throw new Error("Format hasil inspeksi MCP tidak valid");
  const fields = (result as Record<string, unknown>).fields;
  if (!Array.isArray(fields)) throw new Error("MCP tidak mengembalikan daftar field");
  return fields.filter((field): field is FormField => {
    if (!field || typeof field !== "object") return false;
    const item = field as Record<string, unknown>;
    return typeof item.id === "string" && typeof item.label === "string" && typeof item.type === "string";
  }).map((field) => ({ ...field, required: Boolean(field.required) }));
}

export async function executePlan(plan: FormPlan, submit: boolean, actor: string): Promise<unknown> {
  validateTargetUrl(plan.targetUrl);
  const safeMappings = plan.mappings
    .filter((mapping) => !mapping.sensitive && mapping.value !== null)
    .map(({ fieldId, fieldLabel, value }) => ({ fieldId, fieldLabel, value }));
  return getStructuredResult(await callMcp(readEnv("MCP_FILL_TOOL") ?? "fill_form", {
    targetUrl: plan.targetUrl,
    actor,
    mappings: safeMappings,
    submit,
    stopOnUnexpectedNavigation: true,
  }));
}
