import { headers } from "next/headers";
import WorkflowManager from "./WorkflowManager";

export const dynamic = "force-dynamic";
export default async function WorkflowsPage() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("cf-access-authenticated-user-email") ?? requestHeaders.get("oai-authenticated-user-email") ?? "Mode lokal";
  return <WorkflowManager email={email} />;
}
