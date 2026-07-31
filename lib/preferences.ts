import { getD1 } from "../db";

export type SubmitPolicy = "always_ask" | "auto_submit";

const createPreferencesTableSql = `
  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY NOT NULL,
    submit_policy TEXT NOT NULL DEFAULT 'always_ask' CHECK (submit_policy IN ('always_ask', 'auto_submit')),
    updated_at INTEGER NOT NULL
  )
`;

async function ensurePreferencesTable(database: D1Database): Promise<void> {
  await database.prepare(createPreferencesTableSql).run();
}

export async function getSubmitPolicy(userId: string): Promise<SubmitPolicy> {
  const database = getD1();
  await ensurePreferencesTable(database);
  const row = await database.prepare("SELECT submit_policy FROM user_preferences WHERE user_id = ?1")
    .bind(userId)
    .first<{ submit_policy: string }>();
  return row?.submit_policy === "auto_submit" ? "auto_submit" : "always_ask";
}

export async function setSubmitPolicy(userId: string, policy: SubmitPolicy): Promise<void> {
  const database = getD1();
  await ensurePreferencesTable(database);
  await database.prepare(`
    INSERT INTO user_preferences (user_id, submit_policy, updated_at)
    VALUES (?1, ?2, ?3)
    ON CONFLICT(user_id) DO UPDATE SET submit_policy = excluded.submit_policy, updated_at = excluded.updated_at
  `).bind(userId, policy, Date.now()).run();
}
