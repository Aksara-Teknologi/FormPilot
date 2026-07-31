import { getD1 } from "../db";

export type InputHistoryItem = {
  id: string;
  rowHash: string;
  fileName: string;
  sheetName: string;
  rowNumber: number;
  targetOrigin: string;
  mode: "draft" | "submit";
  completedAt: number;
};

const setupStatements = [
  `CREATE TABLE IF NOT EXISTS input_history (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL,
    row_hash TEXT NOT NULL,
    file_name TEXT NOT NULL,
    sheet_name TEXT NOT NULL DEFAULT 'Sheet 1',
    row_number INTEGER NOT NULL,
    target_origin TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('draft', 'submit')),
    completed_at INTEGER NOT NULL
  )`,
  "DROP INDEX IF EXISTS input_history_owner_row_target_idx",
  "DROP INDEX IF EXISTS input_history_owner_file_row_target_idx",
  "CREATE UNIQUE INDEX IF NOT EXISTS input_history_owner_file_sheet_row_target_idx ON input_history (owner_id, file_name, sheet_name, row_number, target_origin)",
  "CREATE INDEX IF NOT EXISTS input_history_owner_completed_idx ON input_history (owner_id, completed_at)",
];

async function ensureHistoryTable(database: D1Database): Promise<void> {
  await database.prepare(setupStatements[0]).run();
  const columns = await database.prepare("PRAGMA table_info(input_history)").all<{ name: string }>();
  if (!(columns.results ?? []).some((column) => column.name === "sheet_name")) {
    try {
      await database.prepare("ALTER TABLE input_history ADD COLUMN sheet_name TEXT NOT NULL DEFAULT 'Sheet 1'").run();
    } catch (error) {
      if (!(error instanceof Error) || !/duplicate column/i.test(error.message)) throw error;
    }
  }
  await database.batch(setupStatements.slice(1).map((statement) => database.prepare(statement)));
}

export async function listInputHistory(ownerId: string, limit = 100): Promise<InputHistoryItem[]> {
  const database = getD1();
  await ensureHistoryTable(database);
  const result = await database.prepare(`
    SELECT id, row_hash, file_name, sheet_name, row_number, target_origin, mode, completed_at
    FROM input_history WHERE owner_id = ?1 ORDER BY completed_at DESC LIMIT ?2
  `).bind(ownerId, Math.min(Math.max(limit, 1), 500)).all<{
    id: string; row_hash: string; file_name: string; sheet_name: string; row_number: number;
    target_origin: string; mode: "draft" | "submit"; completed_at: number;
  }>();
  return (result.results ?? []).map((row) => ({
    id: row.id, rowHash: row.row_hash, fileName: row.file_name, sheetName: row.sheet_name, rowNumber: row.row_number,
    targetOrigin: row.target_origin, mode: row.mode, completedAt: row.completed_at,
  }));
}

export async function recordInputSuccess(ownerId: string, input: Omit<InputHistoryItem, "id" | "completedAt">): Promise<void> {
  const database = getD1();
  await ensureHistoryTable(database);
  await database.prepare(`
    INSERT INTO input_history (id, owner_id, row_hash, file_name, sheet_name, row_number, target_origin, mode, completed_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    ON CONFLICT(owner_id, file_name, sheet_name, row_number, target_origin) DO UPDATE SET
      row_hash = excluded.row_hash,
      mode = excluded.mode,
      completed_at = excluded.completed_at
  `).bind(crypto.randomUUID(), ownerId, input.rowHash, input.fileName, input.sheetName, input.rowNumber, input.targetOrigin, input.mode, Date.now()).run();
}
