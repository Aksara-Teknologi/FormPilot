import { env } from "cloudflare:workers";

export function readEnv(name: string): string | undefined {
  const value = Reflect.get(env, name);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function hasEnv(name: string): boolean {
  return Boolean(readEnv(name));
}
