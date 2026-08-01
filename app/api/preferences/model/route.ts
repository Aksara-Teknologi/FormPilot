import { getSafeModelSettings, resetToIncludedModel, savePersonalModelSettings } from "../../../../lib/model-settings";
import { currentUser, requireJsonMutation } from "../../../../lib/security";

export async function GET(request: Request) {
  try { return Response.json({ model: await getSafeModelSettings(await currentUser(request)) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Pengaturan AI belum tersedia" }, { status: 503 }); }
}

export async function PUT(request: Request) {
  try {
    requireJsonMutation(request, 10_000);
    const body: unknown = await request.json(); if (!body || typeof body !== "object") throw new Error("Pengaturan AI tidak valid");
    const input = body as Record<string, unknown>; const user = await currentUser(request);
    if (input.mode === "included") return Response.json({ model: await resetToIncludedModel(user) });
    if (input.mode !== "personal" || typeof input.baseUrl !== "string" || typeof input.model !== "string" || (input.apiKey !== undefined && typeof input.apiKey !== "string")) throw new Error("Pengaturan AI pribadi tidak lengkap");
    return Response.json({ model: await savePersonalModelSettings(user, { baseUrl: input.baseUrl, model: input.model, apiKey: input.apiKey }) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Pengaturan AI gagal disimpan" }, { status: 400 }); }
}
