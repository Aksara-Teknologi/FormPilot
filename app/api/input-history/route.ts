import { listInputHistory, recordInputSuccess } from "../../../lib/input-history";
import { currentUser, requireJsonMutation, validateTargetUrl } from "../../../lib/security";

function shortText(value: unknown, name: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} wajib diisi`);
  const result = value.trim();
  if (result.length > max) throw new Error(`${name} maksimal ${max} karakter`);
  return result;
}

export async function GET(request: Request) {
  try {
    return Response.json({ history: await listInputHistory(currentUser(request)) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Riwayat gagal dibaca" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    requireJsonMutation(request);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Payload tidak valid");
    const input = body as Record<string, unknown>;
    const rowHash = shortText(input.rowHash, "Hash baris", 64);
    if (!/^[a-f0-9]{64}$/.test(rowHash)) throw new Error("Hash baris tidak valid");
    const rowNumber = Number(input.rowNumber);
    if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > 1_000_001) throw new Error("Nomor baris tidak valid");
    if (input.mode !== "draft" && input.mode !== "submit") throw new Error("Mode riwayat tidak valid");
    const target = validateTargetUrl(shortText(input.targetUrl, "URL target", 2_000));
    await recordInputSuccess(currentUser(request), {
      rowHash,
      fileName: shortText(input.fileName, "Nama file", 255),
      sheetName: shortText(input.sheetName, "Nama sheet", 255),
      rowNumber,
      targetOrigin: target.origin,
      mode: input.mode,
    });
    return Response.json({ ok: true, history: await listInputHistory(currentUser(request)) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Riwayat gagal disimpan" }, { status: 400 });
  }
}
