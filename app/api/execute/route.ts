import { executePlan } from "../../../lib/mcp";
import { currentUser, requireJsonMutation, verifyApprovalToken } from "../../../lib/security";
import type { FormPlan } from "../../../lib/types";

export async function POST(request: Request) {
  try {
    requireJsonMutation(request);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Payload tidak valid");
    const record = body as Record<string, unknown>;
    const submit = record.submit === true;
    if (!record.plan || typeof record.plan !== "object") throw new Error("Plan wajib tersedia");
    if (typeof record.approvalToken !== "string") throw new Error("Persetujuan sudah tidak berlaku");
    if (submit && record.confirmSubmit !== true) throw new Error("Konfirmasi submit wajib diberikan");
    const plan = record.plan as FormPlan;
    const user = await currentUser(request);
    if (!await verifyApprovalToken(record.approvalToken, user, plan)) {
      return Response.json({ error: "Token persetujuan tidak valid atau kedaluwarsa" }, { status: 403 });
    }
    const result = await executePlan(plan, submit, user);
    return Response.json({ ok: true, mode: submit ? "submitted" : "draft-filled", result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eksekusi gagal";
    return Response.json({ error: message }, { status: 400 });
  }
}
