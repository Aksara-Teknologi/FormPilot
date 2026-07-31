import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

function isD1Database(value: unknown): value is D1Database {
  if (value === null || typeof value !== "object") return false;
  return typeof Reflect.get(value, "prepare") === "function";
}

export function getDb() {
  const database = getD1();
  return drizzle(database, { schema });
}

export function getD1(): D1Database {
  const database = Reflect.get(env, "DB");
  if (!isD1Database(database)) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }
  return database;
}
