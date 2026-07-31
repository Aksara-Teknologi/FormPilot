import { createApprovalToken, currentUser, requireJsonMutation, validateTargetUrl } from "../../../lib/security";
import type { FormPlan } from "../../../lib/types";

function validPlan(value: unknown): value is FormPlan {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.targetUrl !== "string" || !Array.isArray(record.fields) || !Array.isArray(record.mappings)) return false;
  if (record.fields.length > 200 || record.mappings.length > 200) return false;
  return record.mappings.every((mapping) => {
    if (!mapping || typeof mapping !== "object") return false;
    const item = mapping as Record<string, unknown>;
    const valueIsPrimitive = item.value === null || ["string", "number", "boolean"].includes(typeof item.value);
    return typeof item.fieldId === "string" && typeof item.fieldLabel === "string" && valueIsPrimitive;
  });
}

export async function POST(request: Request) {
  try {
    requireJsonMutation(request);
    const body: unknown = await request.json();
    const plan = body && typeof body === "object" ? (body as Record<string, unknown>).plan : null;
    if (!validPlan(plan)) throw new Error("Plan tidak valid");
    validateTargetUrl(plan.targetUrl);
    for (const mapping of plan.mappings) {
      if (mapping.sensitive && mapping.value !== null) throw new Error("Data sensitif harus diisi langsung di browser tujuan");
    }
    const approvalToken = await createApprovalToken(await currentUser(request), plan);
    if (!approvalToken) throw new Error("APP_SIGNING_SECRET belum dikonfigurasi");
    return Response.json({ approvalToken });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Validasi jawaban gagal" }, { status: 400 });
  }
}
