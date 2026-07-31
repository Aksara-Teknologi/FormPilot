import { createSession, OAUTH_FLOW_COOKIE, readOAuthFlow, serializeCookie, SESSION_COOKIE, verifyGoogleIdToken } from "../../../../../lib/auth";
import { readEnv } from "../../../../../lib/runtime-env";

type TokenResponse = { id_token?: unknown; error?: unknown };

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const flow = await readOAuthFlow(request);
    const code = requestUrl.searchParams.get("code");
    if (!flow || requestUrl.searchParams.get("state") !== flow.state || !code) throw new Error("Sesi login Google tidak valid atau kedaluwarsa");
    const clientId = readEnv("GOOGLE_CLIENT_ID");
    const clientSecret = readEnv("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) throw new Error("Google OAuth belum dikonfigurasi");
    const redirectUri = new URL("/api/auth/google/callback", requestUrl.origin).href;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: flow.verifier }),
    });
    const tokens: TokenResponse = await tokenResponse.json();
    if (!tokenResponse.ok || typeof tokens.id_token !== "string") throw new Error("Google menolak pertukaran kode login");
    const user = await verifyGoogleIdToken(tokens.id_token, flow.nonce);
    const session = await createSession(user);
    const response = new Response(null, {
      status: 302,
      headers: {
        Location: new URL(flow.returnTo, requestUrl.origin).toString(),
        "Cache-Control": "no-store",
      },
    });
    response.headers.append("Set-Cookie", serializeCookie(SESSION_COOKIE, session, request, 7 * 24 * 60 * 60));
    response.headers.append("Set-Cookie", serializeCookie(OAUTH_FLOW_COOKIE, "", request, 0, "/api/auth/google"));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login Google gagal";
    return new Response(message, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
