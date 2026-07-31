import {
  addKnowledgeRule, createKnowledgePack, deleteKnowledgePack, deleteKnowledgeRule,
  listKnowledgePacks, toggleKnowledgePack, type KnowledgeBehavior,
} from "../../../lib/knowledge";
import { currentUser, requireJsonMutation } from "../../../lib/security";

const behaviors = new Set<KnowledgeBehavior>(["answer", "ask", "blank", "random_safe"]);

function text(value: unknown, name: string, max: number, required = true): string {
  if (typeof value !== "string") throw new Error(`${name} tidak valid`);
  const result = value.trim();
  if (required && !result) throw new Error(`${name} wajib diisi`);
  if (result.length > max) throw new Error(`${name} maksimal ${max} karakter`);
  return result;
}

export async function GET(request: Request) {
  try {
    return Response.json({ packs: await listKnowledgePacks(currentUser(request)) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Knowledge Pack gagal dibaca" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    requireJsonMutation(request);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Payload tidak valid");
    const input = body as Record<string, unknown>;
    const action = input.action;
    const ownerId = currentUser(request);
    if (action === "create_pack") {
      const rawOrigin = text(input.siteOrigin ?? "", "Origin situs", 300, false);
      let siteOrigin: string | null = null;
      if (rawOrigin) {
        const url = new URL(rawOrigin);
        if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("Origin situs wajib HTTPS");
        siteOrigin = url.origin;
      }
      await createKnowledgePack(ownerId, { name: text(input.name, "Nama", 80), description: text(input.description ?? "", "Deskripsi", 400, false), siteOrigin });
    } else if (action === "add_rule") {
      const behavior = input.behavior;
      if (typeof behavior !== "string" || !behaviors.has(behavior as KnowledgeBehavior)) throw new Error("Perilaku aturan tidak valid");
      const answerValue = text(input.answerValue ?? "", "Jawaban", 500, false);
      if (behavior === "answer" && !answerValue) throw new Error("Jawaban tetap wajib diisi");
      const priority = Number(input.priority ?? 100);
      if (!Number.isInteger(priority) || priority < 0 || priority > 9999) throw new Error("Prioritas harus 0–9999");
      await addKnowledgeRule(ownerId, { packId: text(input.packId, "Pack", 100), matchText: text(input.matchText, "Nama field", 160), behavior: behavior as KnowledgeBehavior, answerValue: behavior === "answer" ? answerValue : null, priority });
    } else if (action === "toggle_pack") {
      if (typeof input.isActive !== "boolean") throw new Error("Status pack tidak valid");
      await toggleKnowledgePack(ownerId, text(input.packId, "Pack", 100), input.isActive);
    } else if (action === "delete_pack") {
      await deleteKnowledgePack(ownerId, text(input.packId, "Pack", 100));
    } else if (action === "delete_rule") {
      await deleteKnowledgeRule(ownerId, text(input.ruleId, "Aturan", 100));
    } else throw new Error("Aksi tidak dikenal");
    return Response.json({ ok: true, packs: await listKnowledgePacks(ownerId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Knowledge Pack gagal disimpan" }, { status: 400 });
  }
}
