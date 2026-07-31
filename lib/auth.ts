import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { readEnv } from "./runtime-env";

export const SESSION_COOKIE = "formpilot_session";
export const OAUTH_FLOW_COOKIE = "formpilot_oauth_flow";
const SESSION_ISSUER = "formpilot";
const SESSION_AUDIENCE = "formpilot-web";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export type FormPilotUser = { email: string; name: string | null };
type OAuthFlow = { state: string; nonce: string; verifier: string; returnTo: string };

async function signingKey(): Promise<Uint8Array> {
  const secret = readEnv("APP_SIGNING_SECRET");
  if (!secret) throw new Error("APP_SIGNING_SECRET belum dikonfigurasi");
  const material = new TextEncoder().encode(`formpilot-session:${secret}`);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", material));
}

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const item of header.split(";")) {
    const [key, ...parts] = item.trim().split("=");
    if (key === name) return parts.join("=");
  }
  return null;
}

export function safeReturnTo(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const parsed = new URL(value, "https://formpilot.local");
    return parsed.origin === "https://formpilot.local" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : "/";
  } catch {
    return "/";
  }
}

export function serializeCookie(name: string, value: string, request: Request, maxAge: number, path = "/"): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function createSession(user: FormPilotUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.email)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(await signingKey());
}

export async function readSessionCookie(cookieHeader: string | null): Promise<FormPilotUser | null> {
  const token = cookieValue(cookieHeader, SESSION_COOKIE);
  if (!token || !readEnv("APP_SIGNING_SECRET")) return null;
  try {
    const { payload } = await jwtVerify(token, await signingKey(), {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
      algorithms: ["HS256"],
    });
    if (typeof payload.email !== "string" || payload.sub !== payload.email) return null;
    return { email: payload.email.toLowerCase(), name: typeof payload.name === "string" ? payload.name : null };
  } catch {
    return null;
  }
}

export async function createOAuthFlow(flow: OAuthFlow): Promise<string> {
  return new SignJWT(flow)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(SESSION_ISSUER)
    .setAudience("google-oauth-flow")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(await signingKey());
}

export async function readOAuthFlow(request: Request): Promise<OAuthFlow | null> {
  const token = cookieValue(request.headers.get("cookie"), OAUTH_FLOW_COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await signingKey(), {
      issuer: SESSION_ISSUER,
      audience: "google-oauth-flow",
      algorithms: ["HS256"],
    });
    if ([payload.state, payload.nonce, payload.verifier, payload.returnTo].some((value) => typeof value !== "string")) return null;
    return payload as unknown as OAuthFlow;
  } catch {
    return null;
  }
}

export async function verifyGoogleIdToken(idToken: string, nonce: string): Promise<FormPilotUser> {
  const clientId = readEnv("GOOGLE_CLIENT_ID");
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID belum dikonfigurasi");
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: GOOGLE_ISSUERS,
    audience: clientId,
    algorithms: ["RS256"],
  });
  if (payload.nonce !== nonce) throw new Error("Nonce Google tidak valid");
  if (payload.email_verified !== true || typeof payload.email !== "string") throw new Error("Email Google belum terverifikasi");
  const email = payload.email.toLowerCase();
  const allowedDomains = readEnv("GOOGLE_ALLOWED_DOMAINS")?.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (allowedDomains?.length && !allowedDomains.includes(email.split("@").at(-1) ?? "")) throw new Error("Domain email tidak diizinkan");
  return { email, name: typeof payload.name === "string" ? payload.name : null };
}
