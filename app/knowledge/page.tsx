import { headers } from "next/headers";
import KnowledgeManager from "./KnowledgeManager";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("cf-access-authenticated-user-email")
    ?? requestHeaders.get("oai-authenticated-user-email")
    ?? "Mode lokal";
  return <KnowledgeManager email={email} />;
}
