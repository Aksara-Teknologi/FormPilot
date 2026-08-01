import { getSafeModelSettings } from "../../../lib/model-settings";
import { hasEnv } from "../../../lib/runtime-env";
import { currentUser } from "../../../lib/security";

export async function GET(request: Request) {
  try {
    return Response.json({ model: await getSafeModelSettings(await currentUser(request)), browserFallbackReady: hasEnv("MCP_SERVER_URL") && hasEnv("MCP_AUTH_TOKEN") }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Layanan belum siap" }, { status: 503 });
  }
}
