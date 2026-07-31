import { headers } from "next/headers";
import FormPilot from "./FormPilot";

export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("cf-access-authenticated-user-email")
    ?? requestHeaders.get("oai-authenticated-user-email")
    ?? "Mode lokal";
  return <FormPilot email={email} />;
}
