import { getWorkflowScenario } from "../../../lib/workflows";
import { currentUser, requireJsonMutation, validateTargetUrl } from "../../../lib/security";

const SENSITIVE = /password|passcode|pin|otp|captcha|secret|token|cvv|cvc/i;
const primitive = (value: unknown): value is string | number | boolean | null => value === null || ["string", "number", "boolean"].includes(typeof value);

export async function POST(request: Request) {
  try {
    requireJsonMutation(request);
    const body: unknown = await request.json(); if (!body || typeof body !== "object") throw new Error("Payload tidak valid");
    const input = body as Record<string, unknown>;
    if (typeof input.scenarioId !== "string" || typeof input.targetUrl !== "string") throw new Error("Scenario dan target wajib diisi");
    const target = validateTargetUrl(input.targetUrl);
    const scenario = await getWorkflowScenario(await currentUser(request), input.scenarioId);
    if (!scenario || scenario.siteOrigin !== target.origin) throw new Error("Scenario tidak tersedia untuk situs ini");
    if (!input.source || typeof input.source !== "object" || Array.isArray(input.source)) throw new Error("Data baris tidak valid");
    const source = input.source as Record<string, unknown>;
    const referencedKeys = new Set(scenario.steps.flatMap((step) => step.action === "fill" || step.action === "find_row" ? [step.sourceKey] : []));
    const safeSource = Object.fromEntries([...referencedKeys].filter((key) => !SENSITIVE.test(key) && primitive(source[key])).map((key) => [key, source[key]]));
    return Response.json({ authorizationId: crypto.randomUUID(), targetUrl: target.href, scenario: { id: scenario.id, name: scenario.name, steps: scenario.steps }, source: safeSource });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Workflow tidak dapat diotorisasi" }, { status: 400 }); }
}
