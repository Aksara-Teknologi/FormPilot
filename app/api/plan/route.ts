import { buildPlan } from "../../../lib/planner";
import { resolveKnowledgeRules } from "../../../lib/knowledge";
import { createApprovalToken, currentUser, requireJsonMutation, validateTargetUrl } from "../../../lib/security";
import type { FormField } from "../../../lib/types";

function validFields(value: unknown): value is FormField[] {
  return Array.isArray(value) && value.length <= 200 && value.every((field) =>
    field && typeof field === "object" &&
    typeof (field as Record<string, unknown>).id === "string" &&
    typeof (field as Record<string, unknown>).label === "string" &&
    typeof (field as Record<string, unknown>).type === "string"
  );
}

export async function POST(request: Request) {
  try {
    requireJsonMutation(request, 150_000);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Payload tidak valid");
    const record = body as Record<string, unknown>;
    if (typeof record.targetUrl !== "string") throw new Error("URL form wajib diisi");
    validateTargetUrl(record.targetUrl);
    if (!validFields(record.fields)) throw new Error("Struktur field tidak valid");
    if (!record.source || typeof record.source !== "object" || Array.isArray(record.source)) throw new Error("Data sumber harus berupa objek JSON");
    if (JSON.stringify(record.source).length > 100_000) throw new Error("Data sumber maksimal 100 KB");
    const fallbackMode = record.fallbackMode === "random_safe" || record.fallbackMode === "blank" ? record.fallbackMode : "ask";
    const user = await currentUser(request);
    const knowledgeRules = await resolveKnowledgeRules(user, record.targetUrl);
    const plan = await buildPlan(user, record.targetUrl, record.fields, record.source as Record<string, unknown>, fallbackMode, knowledgeRules);
    return Response.json({ plan, approvalToken: await createApprovalToken(user, plan) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pemetaan gagal";
    return Response.json({ error: message }, { status: 400 });
  }
}
