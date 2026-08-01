import { compileWorkflow, deleteWorkflowScenario, listWorkflowScenarios, saveWorkflowScenario } from "../../../lib/workflows";
import { currentUser, requireJsonMutation } from "../../../lib/security";

function text(value: unknown, name: string, max: number) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} wajib diisi`);
  const result = value.trim(); if (result.length > max) throw new Error(`${name} maksimal ${max} karakter`); return result;
}

export async function GET(request: Request) {
  try { return Response.json({ scenarios: await listWorkflowScenarios(await currentUser(request)) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Scenario gagal dibaca" }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    requireJsonMutation(request, 10_000);
    const body: unknown = await request.json(); if (!body || typeof body !== "object") throw new Error("Payload tidak valid");
    const input = body as Record<string, unknown>; const owner = await currentUser(request);
    if (input.action === "compile") {
      const prompt = text(input.prompt, "Prompt", 4_000); const rawUrl = new URL(text(input.siteOrigin, "Origin situs", 500));
      if (rawUrl.protocol !== "https:" && !(rawUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(rawUrl.hostname))) throw new Error("Origin situs wajib HTTPS");
      const compiled = await compileWorkflow(owner, prompt, rawUrl.origin);
      await saveWorkflowScenario(owner, { ...compiled, prompt, siteOrigin: rawUrl.origin });
    } else if (input.action === "delete") {
      await deleteWorkflowScenario(owner, text(input.id, "Scenario", 100));
    } else throw new Error("Aksi tidak dikenal");
    return Response.json({ ok: true, scenarios: await listWorkflowScenarios(owner) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Scenario gagal disimpan" }, { status: 400 }); }
}
