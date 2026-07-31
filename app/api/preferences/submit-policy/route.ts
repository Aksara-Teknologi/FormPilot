import { getSubmitPolicy, setSubmitPolicy, type SubmitPolicy } from "../../../../lib/preferences";
import { currentUser, requireJsonMutation } from "../../../../lib/security";

export async function GET(request: Request) {
  try {
    return Response.json({ policy: await getSubmitPolicy(await currentUser(request)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Preferensi tidak tersedia" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    requireJsonMutation(request, 10_000);
    const body: unknown = await request.json();
    const policy = body && typeof body === "object" ? (body as Record<string, unknown>).policy : null;
    if (policy !== "always_ask" && policy !== "auto_submit") {
      return Response.json({ error: "Kebijakan submit tidak valid" }, { status: 400 });
    }
    await setSubmitPolicy(await currentUser(request), policy as SubmitPolicy);
    return Response.json({ policy });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Preferensi gagal disimpan" }, { status: 503 });
  }
}
