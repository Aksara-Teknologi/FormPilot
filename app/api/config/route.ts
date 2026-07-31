import { hasEnv, readEnv } from "../../../lib/runtime-env";

export async function GET() {
  return Response.json({
    model: {
      ready: hasEnv("OPENAI_API_KEY") && hasEnv("OPENAI_MODEL"),
      model: readEnv("OPENAI_MODEL") ?? null,
      baseUrl: readEnv("OPENAI_BASE_URL") ?? "https://api.openai.com/v1",
    },
    mcp: {
      ready: hasEnv("MCP_SERVER_URL") && hasEnv("MCP_AUTH_TOKEN"),
      endpoint: readEnv("MCP_SERVER_URL") ? "Terkonfigurasi" : null,
    },
    approval: { ready: hasEnv("APP_SIGNING_SECRET") },
    auth: { ready: hasEnv("GOOGLE_CLIENT_ID") && hasEnv("GOOGLE_CLIENT_SECRET") && hasEnv("APP_SIGNING_SECRET") },
    allowedHosts: readEnv("ALLOWED_TARGET_HOSTS")?.split(",").filter(Boolean) ?? [],
  }, { headers: { "Cache-Control": "no-store" } });
}
