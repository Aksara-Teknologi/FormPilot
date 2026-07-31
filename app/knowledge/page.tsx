import { headers } from "next/headers";
import { redirect } from "next/navigation";
import KnowledgeManager from "./KnowledgeManager";
import { readSessionCookie } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const requestHeaders = await headers();
  const session = await readSessionCookie(requestHeaders.get("cookie"));
  const hostname = requestHeaders.get("host")?.split(":")[0];
  const email = session?.email ?? (hostname === "localhost" || hostname === "127.0.0.1" ? "Mode lokal" : null);
  if (!email) redirect("/api/auth/google?return_to=/knowledge");
  return <KnowledgeManager email={email} />;
}
