import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id").primaryKey(),
  submitPolicy: text("submit_policy", { enum: ["always_ask", "auto_submit"] }).notNull().default("always_ask"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const knowledgePacks = sqliteTable("knowledge_packs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  siteOrigin: text("site_origin"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("knowledge_packs_owner_site_idx").on(table.ownerId, table.siteOrigin),
]);

export const knowledgeRules = sqliteTable("knowledge_rules", {
  id: text("id").primaryKey(),
  packId: text("pack_id").notNull().references(() => knowledgePacks.id, { onDelete: "cascade" }),
  matchText: text("match_text").notNull(),
  behavior: text("behavior", { enum: ["answer", "ask", "blank", "random_safe"] }).notNull(),
  answerValue: text("answer_value"),
  priority: integer("priority").notNull().default(100),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("knowledge_rules_pack_priority_idx").on(table.packId, table.priority),
]);

export const inputHistory = sqliteTable("input_history", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  rowHash: text("row_hash").notNull(),
  fileName: text("file_name").notNull(),
  sheetName: text("sheet_name").notNull(),
  rowNumber: integer("row_number").notNull(),
  targetOrigin: text("target_origin").notNull(),
  mode: text("mode", { enum: ["draft", "submit"] }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("input_history_owner_file_sheet_row_target_idx").on(table.ownerId, table.fileName, table.sheetName, table.rowNumber, table.targetOrigin),
  index("input_history_owner_completed_idx").on(table.ownerId, table.completedAt),
]);

export const workflowScenarios = sqliteTable("workflow_scenarios", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  siteOrigin: text("site_origin").notNull(),
  prompt: text("prompt").notNull(),
  stepsJson: text("steps_json").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("workflow_scenarios_owner_site_idx").on(table.ownerId, table.siteOrigin),
]);
