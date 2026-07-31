import { headers } from "next/headers";
import FormPilot from "./FormPilot";
import LoginScreen from "./LoginScreen";
import { readSessionCookie } from "../lib/auth";
import { hasEnv } from "../lib/runtime-env";

export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const session = await readSessionCookie(requestHeaders.get("cookie"));
  const hostname = requestHeaders.get("host")?.split(":")[0];
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  const email = session?.email ?? (isLocal ? "Mode lokal" : null);
  if (!email) {
    return <LoginScreen ready={hasEnv("GOOGLE_CLIENT_ID") && hasEnv("GOOGLE_CLIENT_SECRET") && hasEnv("APP_SIGNING_SECRET")} />;
  }
  return <FormPilot email={email} />;
}
