import { createOAuthFlow, OAUTH_FLOW_COOKIE, safeReturnTo, serializeCookie } from "../../../../lib/auth";
import { readEnv } from "../../../../lib/runtime-env";

function randomValue(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function challenge(verifier: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function GET(request: Request) {
  const clientId = readEnv("GOOGLE_CLIENT_ID");
  if (!clientId || !readEnv("GOOGLE_CLIENT_SECRET") || !readEnv("APP_SIGNING_SECRET")) {
    return new Response("Google OAuth belum dikonfigurasi.", { status: 503 });
  }
  const requestUrl = new URL(request.url);
  const state = randomValue();
  const nonce = randomValue();
  const verifier = randomValue();
  const redirectUri = new URL("/api/auth/google/callback", requestUrl.origin).href;
  const flow = await createOAuthFlow({ state, nonce, verifier, returnTo: safeReturnTo(requestUrl.searchParams.get("return_to")) });
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: await challenge(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  const response = Response.redirect(authorizationUrl, 302);
  response.headers.append("Set-Cookie", serializeCookie(OAUTH_FLOW_COOKIE, flow, request, 600, "/api/auth/google"));
  return response;
}
