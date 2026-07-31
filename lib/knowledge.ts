import { getD1 } from "../db";

export type KnowledgeBehavior = "answer" | "ask" | "blank" | "random_safe";

export type KnowledgeRule = {
  id: string;
  packId: string;
  packName: string;
  matchText: string;
  behavior: KnowledgeBehavior;
  answerValue: string | null;
  priority: number;
};

export type KnowledgePack = {
  id: string;
  name: string;
  description: string;
  siteOrigin: string | null;
  isActive: boolean;
  createdAt: number;
  rules: KnowledgeRule[];
};

const setupStatements = [
  `CREATE TABLE IF NOT EXISTS knowledge_packs (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    site_origin TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS knowledge_packs_owner_site_idx ON knowledge_packs (owner_id, site_origin)",
  `CREATE TABLE IF NOT EXISTS knowledge_rules (
    id TEXT PRIMARY KEY NOT NULL,
    pack_id TEXT NOT NULL REFERENCES knowledge_packs(id) ON DELETE CASCADE,
    match_text TEXT NOT NULL,
    behavior TEXT NOT NULL CHECK (behavior IN ('answer', 'ask', 'blank', 'random_safe')),
    answer_value TEXT,
    priority INTEGER NOT NULL DEFAULT 100,
    created_at INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS knowledge_rules_pack_priority_idx ON knowledge_rules (pack_id, priority)",
];

async function ensureKnowledgeTables(database: D1Database): Promise<void> {
  await database.batch(setupStatements.map((statement) => database.prepare(statement)));
}

export async function listKnowledgePacks(ownerId: string): Promise<KnowledgePack[]> {
  const database = getD1();
  await ensureKnowledgeTables(database);
  const packs = await database.prepare(`
    SELECT id, name, description, site_origin, is_active, created_at
    FROM knowledge_packs WHERE owner_id = ?1 ORDER BY updated_at DESC
  `).bind(ownerId).all<{ id: string; name: string; description: string; site_origin: string | null; is_active: number; created_at: number }>();
  const rules = await database.prepare(`
    SELECT r.id, r.pack_id, p.name AS pack_name, r.match_text, r.behavior, r.answer_value, r.priority
    FROM knowledge_rules r JOIN knowledge_packs p ON p.id = r.pack_id
    WHERE p.owner_id = ?1 ORDER BY r.priority ASC, r.created_at ASC
  `).bind(ownerId).all<{ id: string; pack_id: string; pack_name: string; match_text: string; behavior: KnowledgeBehavior; answer_value: string | null; priority: number }>();
  return (packs.results ?? []).map((pack) => ({
    id: pack.id,
    name: pack.name,
    description: pack.description,
    siteOrigin: pack.site_origin,
    isActive: pack.is_active === 1,
    createdAt: pack.created_at,
    rules: (rules.results ?? []).filter((rule) => rule.pack_id === pack.id).map((rule) => ({
      id: rule.id, packId: rule.pack_id, packName: rule.pack_name, matchText: rule.match_text,
      behavior: rule.behavior, answerValue: rule.answer_value, priority: rule.priority,
    })),
  }));
}

export async function createKnowledgePack(ownerId: string, input: { name: string; description: string; siteOrigin: string | null }): Promise<void> {
  const database = getD1();
  await ensureKnowledgeTables(database);
  const now = Date.now();
  await database.prepare(`
    INSERT INTO knowledge_packs (id, owner_id, name, description, site_origin, is_active, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6)
  `).bind(crypto.randomUUID(), ownerId, input.name, input.description, input.siteOrigin, now).run();
}

export async function addKnowledgeRule(ownerId: string, input: { packId: string; matchText: string; behavior: KnowledgeBehavior; answerValue: string | null; priority: number }): Promise<void> {
  const database = getD1();
  await ensureKnowledgeTables(database);
  const pack = await database.prepare("SELECT id FROM knowledge_packs WHERE id = ?1 AND owner_id = ?2").bind(input.packId, ownerId).first();
  if (!pack) throw new Error("Knowledge Pack tidak ditemukan");
  await database.batch([
    database.prepare(`INSERT INTO knowledge_rules (id, pack_id, match_text, behavior, answer_value, priority, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
      .bind(crypto.randomUUID(), input.packId, input.matchText, input.behavior, input.answerValue, input.priority, Date.now()),
    database.prepare("UPDATE knowledge_packs SET updated_at = ?1 WHERE id = ?2 AND owner_id = ?3").bind(Date.now(), input.packId, ownerId),
  ]);
}

export async function toggleKnowledgePack(ownerId: string, packId: string, isActive: boolean): Promise<void> {
  const database = getD1();
  await ensureKnowledgeTables(database);
  await database.prepare("UPDATE knowledge_packs SET is_active = ?1, updated_at = ?2 WHERE id = ?3 AND owner_id = ?4")
    .bind(isActive ? 1 : 0, Date.now(), packId, ownerId).run();
}

export async function deleteKnowledgePack(ownerId: string, packId: string): Promise<void> {
  const database = getD1();
  await ensureKnowledgeTables(database);
  await database.prepare("DELETE FROM knowledge_packs WHERE id = ?1 AND owner_id = ?2").bind(packId, ownerId).run();
}

export async function deleteKnowledgeRule(ownerId: string, ruleId: string): Promise<void> {
  const database = getD1();
  await ensureKnowledgeTables(database);
  await database.prepare(`DELETE FROM knowledge_rules WHERE id = ?1 AND pack_id IN (SELECT id FROM knowledge_packs WHERE owner_id = ?2)`)
    .bind(ruleId, ownerId).run();
}

export async function resolveKnowledgeRules(ownerId: string, targetUrl: string): Promise<KnowledgeRule[]> {
  const database = getD1();
  await ensureKnowledgeTables(database);
  const origin = new URL(targetUrl).origin;
  const result = await database.prepare(`
    SELECT r.id, r.pack_id, p.name AS pack_name, r.match_text, r.behavior, r.answer_value, r.priority
    FROM knowledge_rules r JOIN knowledge_packs p ON p.id = r.pack_id
    WHERE p.owner_id = ?1 AND p.is_active = 1 AND (p.site_origin IS NULL OR p.site_origin = ?2)
    ORDER BY r.priority ASC, r.created_at ASC
  `).bind(ownerId, origin).all<{ id: string; pack_id: string; pack_name: string; match_text: string; behavior: KnowledgeBehavior; answer_value: string | null; priority: number }>();
  return (result.results ?? []).map((rule) => ({
    id: rule.id, packId: rule.pack_id, packName: rule.pack_name, matchText: rule.match_text,
    behavior: rule.behavior, answerValue: rule.answer_value, priority: rule.priority,
  }));
}
