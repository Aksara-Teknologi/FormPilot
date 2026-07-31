import { readEnv } from "./runtime-env";
import { readSessionCookie } from "./auth";

const encoder = new TextEncoder();

function base64Url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
}

function decodeBase64UrlBytes(input: string): Uint8Array<ArrayBuffer> {
  const binary = decodeBase64Url(input);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function hmac(message: string): Promise<string> {
  const secret = readEnv("APP_SIGNING_SECRET");
  if (!secret) throw new Error("APP_SIGNING_SECRET belum dikonfigurasi");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return base64Url(new Uint8Array(signature));
}

async function verifyHmac(message: string, signature: string): Promise<boolean> {
  const secret = readEnv("APP_SIGNING_SECRET");
  if (!secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  try {
    return await crypto.subtle.verify("HMAC", key, decodeBase64UrlBytes(signature), encoder.encode(message));
  } catch {
    return false;
  }
}

async function sha256(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify(value)));
  return base64Url(new Uint8Array(digest));
}

export async function createApprovalToken(user: string, plan: unknown): Promise<string | null> {
  if (!readEnv("APP_SIGNING_SECRET")) return null;
  const payload = base64Url(JSON.stringify({
    sub: user,
    plan: await sha256(plan),
    exp: Date.now() + 10 * 60 * 1000,
    nonce: crypto.randomUUID(),
  }));
  return `${payload}.${await hmac(payload)}`;
}

export async function verifyApprovalToken(token: string, user: string, plan: unknown): Promise<boolean> {
  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature) return false;

  if (!await verifyHmac(payload, suppliedSignature)) return false;

  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(payload));
    if (!parsed || typeof parsed !== "object") return false;
    const record = parsed as Record<string, unknown>;
    return record.sub === user &&
      typeof record.exp === "number" &&
      record.exp > Date.now() &&
      record.plan === await sha256(plan);
  } catch {
    return false;
  }
}

export function validateTargetUrl(value: string): URL {
  const url = new URL(value);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    throw new Error("Target form wajib memakai HTTPS");
  }

  const allowlist = readEnv("ALLOWED_TARGET_HOSTS")
    ?.split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist?.length && !allowlist.includes(url.hostname.toLowerCase())) {
    throw new Error("Domain target tidak ada di ALLOWED_TARGET_HOSTS");
  }
  return url;
}

export async function currentUser(request: Request): Promise<string> {
  const session = await readSessionCookie(request.headers.get("cookie"));
  if (session) return session.email;
  const hostname = new URL(request.url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return "demo@localhost";
  throw new Error("Login Google diperlukan");
}

export function requireJsonMutation(request: Request, maxBytes = 1_000_000): void {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin !== requestUrl.origin || (fetchSite && fetchSite !== "same-origin")) {
    throw new Error("Permintaan lintas-origin ditolak");
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) throw new Error("Content-Type wajib application/json");

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`Payload maksimal ${Math.floor(maxBytes / 1_000)} KB`);
  }
}
