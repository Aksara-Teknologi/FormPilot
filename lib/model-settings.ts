import { getD1 } from "../db";
import { readEnv } from "./runtime-env";

export type ModelSettings = { mode: "included" | "personal"; baseUrl: string; model: string; apiKey: string };
export type SafeModelSettings = Omit<ModelSettings, "apiKey"> & { hasPersonalKey: boolean; ready: boolean };

const tableSql = `CREATE TABLE IF NOT EXISTS user_model_settings (
  user_id TEXT PRIMARY KEY NOT NULL,
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)`;

async function ensureTable() { await getD1().prepare(tableSql).run(); }

function defaultSettings(): ModelSettings {
  return {
    mode: "included",
    baseUrl: readEnv("OPENAI_BASE_URL")?.replace(/\/$/, "") ?? "https://api.openai.com/v1",
    model: readEnv("OPENAI_MODEL") ?? "AI bawaan",
    apiKey: readEnv("OPENAI_API_KEY") ?? "",
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let value = ""; for (const byte of bytes) value += String.fromCharCode(byte); return btoa(value);
}

function base64ToBytes(value: string): Uint8Array {
  const raw = atob(value); const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function encryptionKey(userId: string): Promise<CryptoKey> {
  const secret = readEnv("APP_SIGNING_SECRET");
  if (!secret) throw new Error("Layanan pengaturan AI belum siap");
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`formpilot-personal-ai:${userId}:${secret}`));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encrypt(userId: string, value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(userId), new TextEncoder().encode(value));
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

async function decrypt(userId: string, value: string): Promise<string> {
  const [encodedIv, encodedCiphertext] = value.split(".");
  if (!encodedIv || !encodedCiphertext) throw new Error("Kunci AI pribadi tidak dapat dibaca");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: asArrayBuffer(base64ToBytes(encodedIv)) }, await encryptionKey(userId), asArrayBuffer(base64ToBytes(encodedCiphertext)));
  return new TextDecoder().decode(plain);
}

function validEndpoint(value: string): string {
  const parsed = new URL(value.trim());
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) throw new Error("Alamat layanan AI harus memakai HTTPS");
  return parsed.href.replace(/\/$/, "");
}

export async function resolveModelSettings(userId: string): Promise<ModelSettings> {
  await ensureTable();
  const row = await getD1().prepare("SELECT base_url, model, encrypted_api_key FROM user_model_settings WHERE user_id = ?1").bind(userId).first<{ base_url: string; model: string; encrypted_api_key: string }>();
  if (!row) return defaultSettings();
  return { mode: "personal", baseUrl: row.base_url, model: row.model, apiKey: await decrypt(userId, row.encrypted_api_key) };
}

export async function getSafeModelSettings(userId: string): Promise<SafeModelSettings> {
  await ensureTable();
  const row = await getD1().prepare("SELECT base_url, model FROM user_model_settings WHERE user_id = ?1").bind(userId).first<{ base_url: string; model: string }>();
  if (row) return { mode: "personal", baseUrl: row.base_url, model: row.model, hasPersonalKey: true, ready: true };
  const defaults = defaultSettings();
  return { mode: "included", baseUrl: defaults.baseUrl, model: defaults.model, hasPersonalKey: false, ready: Boolean(defaults.apiKey && readEnv("OPENAI_MODEL")) };
}

export async function savePersonalModelSettings(userId: string, input: { baseUrl: string; model: string; apiKey?: string }): Promise<SafeModelSettings> {
  await ensureTable();
  const baseUrl = validEndpoint(input.baseUrl);
  const model = input.model.trim();
  if (!model || model.length > 160) throw new Error("Nama model wajib diisi (maksimal 160 karakter)");
  const existing = await getD1().prepare("SELECT encrypted_api_key FROM user_model_settings WHERE user_id = ?1").bind(userId).first<{ encrypted_api_key: string }>();
  const apiKey = input.apiKey?.trim() || (existing ? await decrypt(userId, existing.encrypted_api_key) : "");
  if (!apiKey || apiKey.length > 2_000) throw new Error("Masukkan API key untuk layanan AI pribadi Anda");
  await getD1().prepare(`INSERT INTO user_model_settings (user_id, base_url, model, encrypted_api_key, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5)
    ON CONFLICT(user_id) DO UPDATE SET base_url = excluded.base_url, model = excluded.model, encrypted_api_key = excluded.encrypted_api_key, updated_at = excluded.updated_at`)
    .bind(userId, baseUrl, model, await encrypt(userId, apiKey), Date.now()).run();
  return { mode: "personal", baseUrl, model, hasPersonalKey: true, ready: true };
}

export async function resetToIncludedModel(userId: string): Promise<SafeModelSettings> {
  await ensureTable(); await getD1().prepare("DELETE FROM user_model_settings WHERE user_id = ?1").bind(userId).run();
  return getSafeModelSettings(userId);
}
