import { inspectForm } from "../../../lib/mcp";
import { currentUser, requireJsonMutation } from "../../../lib/security";

export async function POST(request: Request) {
  try {
    requireJsonMutation(request);
    const body: unknown = await request.json();
    const targetUrl = body && typeof body === "object" ? (body as Record<string, unknown>).targetUrl : null;
    if (typeof targetUrl !== "string") return Response.json({ error: "targetUrl wajib diisi" }, { status: 400 });
    return Response.json({ fields: await inspectForm(targetUrl, await currentUser(request)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inspeksi form gagal";
    return Response.json({ error: message }, { status: 400 });
  }
}
