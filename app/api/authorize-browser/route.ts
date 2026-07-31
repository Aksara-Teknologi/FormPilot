import { currentUser, requireJsonMutation, verifyApprovalToken } from "../../../lib/security";
import type { FormPlan } from "../../../lib/types";

export async function POST(request: Request) {
  try {
    requireJsonMutation(request);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Payload tidak valid");
    const record = body as Record<string, unknown>;
    const plan = record.plan as FormPlan;
    const submit = record.submit === true;
    if (!plan || typeof plan !== "object" || typeof record.approvalToken !== "string") throw new Error("Plan atau persetujuan tidak tersedia");
    if (submit && record.confirmSubmit !== true) throw new Error("Konfirmasi submit wajib diberikan");
    if (!await verifyApprovalToken(record.approvalToken, currentUser(request), plan)) {
      return Response.json({ error: "Token persetujuan tidak valid atau kedaluwarsa" }, { status: 403 });
    }
    const mappings = plan.mappings
      .filter((mapping) => !mapping.sensitive && mapping.value !== null)
      .map(({ fieldId, fieldLabel, value }) => ({ fieldId, fieldLabel, value, sensitive: false }));
    return Response.json({ authorizationId: crypto.randomUUID(), targetUrl: plan.targetUrl, submit, mappings });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Otorisasi browser gagal" }, { status: 400 });
  }
}
