import { resolveModelSettings } from "./model-settings";
import type { KnowledgeRule } from "./knowledge";
import type { FieldMapping, FormField, FormPlan } from "./types";

const SENSITIVE_PATTERN = /password|passcode|pin|otp|captcha|secret|token|cvv|cvc/i;
const HIGH_STAKES_PATTERN = /agree|consent|declaration|legal|terms|privacy|accurate|truth|benar|jujur|persetujuan|pernyataan|syarat|kebijakan|identitas|identity|keuangan|financial|kesehatan|medical/i;

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
}

function isSensitive(field: FormField): boolean {
  return Boolean(field.sensitive) || field.type === "password" || SENSITIVE_PATTERN.test(`${field.label} ${field.name ?? ""}`);
}

function primitive(value: unknown): value is string | number | boolean | null {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function exactMappings(fields: FormField[], source: Record<string, unknown>): {
  mappings: FieldMapping[];
  unresolved: FormField[];
} {
  const sourceEntries = Object.entries(source).filter((entry): entry is [string, string | number | boolean | null] => primitive(entry[1]));
  const mappings: FieldMapping[] = [];
  const unresolved: FormField[] = [];

  for (const field of fields) {
    if (isSensitive(field)) {
      mappings.push({ fieldId: field.id, fieldLabel: field.label, sourceKey: null, value: null, confidence: 1, method: "manual", sensitive: true });
      continue;
    }
    const aliases = [field.id, field.name, field.label].filter((value): value is string => Boolean(value)).map(normalize);
    const match = sourceEntries.find(([key]) => aliases.includes(normalize(key)));
    if (match) {
      mappings.push({ fieldId: field.id, fieldLabel: field.label, sourceKey: match[0], value: match[1], confidence: 1, method: "exact", sensitive: false });
    } else {
      unresolved.push(field);
    }
  }
  return { mappings, unresolved };
}

type AiMapping = { fieldId: string; sourceKey: string | null; confidence: number };

function parseAiMappings(value: unknown): AiMapping[] {
  if (!value || typeof value !== "object") return [];
  const mappings = (value as Record<string, unknown>).mappings;
  if (!Array.isArray(mappings)) return [];
  return mappings.filter((item): item is AiMapping => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    return typeof record.fieldId === "string" &&
      (typeof record.sourceKey === "string" || record.sourceKey === null) &&
      typeof record.confidence === "number";
  });
}

async function callModel(ownerId: string, fields: FormField[], sourceKeys: string[]): Promise<AiMapping[]> {
  const settings = await resolveModelSettings(ownerId);
  const baseUrl = settings.baseUrl;
  const apiKey = settings.apiKey;
  const model = settings.model;
  if (!apiKey || !model) return [];
  const endpoint = new URL(`${baseUrl}/chat/completions`);
  if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost") {
    throw new Error("OPENAI_BASE_URL wajib memakai HTTPS");
  }

  const compactFields = fields.map(({ id, label, name, type, required, options }) => ({ id, label, name, type, required, options }));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Map each form field to one source key. Never invent keys. Return JSON: {mappings:[{fieldId,sourceKey,confidence}]}. Use null when uncertain. Values are intentionally omitted for privacy.",
          },
          { role: "user", content: JSON.stringify({ fields: compactFields, sourceKeys }) },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Model gagal (${response.status})`);
    const body: unknown = await response.json();
    if (!body || typeof body !== "object") return [];
    const choices = (body as Record<string, unknown>).choices;
    if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return [];
    const message = (choices[0] as Record<string, unknown>).message;
    if (!message || typeof message !== "object") return [];
    const content = (message as Record<string, unknown>).content;
    if (typeof content !== "string") return [];
    return parseAiMappings(JSON.parse(content));
  } finally {
    clearTimeout(timeout);
  }
}

function secureRandomOption(options: string[]): string {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return options[random[0] % options.length];
}

function applyKnowledge(fields: FormField[], rules: KnowledgeRule[]): { mappings: FieldMapping[]; unresolved: FormField[] } {
  const mappings: FieldMapping[] = [];
  const unresolved: FormField[] = [];
  for (const field of fields) {
    const aliases = [field.id, field.name, field.label].filter((value): value is string => Boolean(value)).map(normalize);
    const rule = rules.find((candidate) => {
      const needle = normalize(candidate.matchText);
      return needle.length > 0 && aliases.some((alias) => alias === needle || alias.includes(needle) || needle.includes(alias));
    });
    if (!rule) { unresolved.push(field); continue; }

    const canRandomize = rule.behavior === "random_safe" &&
      Array.isArray(field.options) && field.options.length > 1 &&
      !HIGH_STAKES_PATTERN.test(`${field.label} ${field.name ?? ""}`);
    const value = rule.behavior === "answer" ? rule.answerValue : canRandomize ? secureRandomOption(field.options ?? []) : null;
    mappings.push({
      fieldId: field.id,
      fieldLabel: field.label,
      sourceKey: `Knowledge: ${rule.packName}`,
      value,
      confidence: 1,
      method: rule.behavior === "answer" ? "knowledge" : canRandomize ? "random" : rule.behavior === "blank" ? "blank" : "manual",
      sensitive: false,
    });
  }
  return { mappings, unresolved };
}

export async function buildPlan(
  ownerId: string,
  targetUrl: string,
  fields: FormField[],
  source: Record<string, unknown>,
  fallbackMode: "ask" | "blank" | "random_safe" = "ask",
  knowledgeRules: KnowledgeRule[] = [],
): Promise<FormPlan> {
  const exact = exactMappings(fields, source);
  const knowledge = applyKnowledge(exact.unresolved, knowledgeRules);
  const mappings = [...exact.mappings, ...knowledge.mappings];
  const unresolved = knowledge.unresolved;
  const sourceKeys = Object.keys(source);
  const aiResults = unresolved.length ? await callModel(ownerId, unresolved, sourceKeys) : [];
  const aiByField = new Map(aiResults.map((item) => [item.fieldId, item]));

  for (const field of unresolved) {
    const result = aiByField.get(field.id);
    const key = result?.sourceKey && Object.prototype.hasOwnProperty.call(source, result.sourceKey) ? result.sourceKey : null;
    const canRandomize = fallbackMode === "random_safe" &&
      Array.isArray(field.options) &&
      field.options.length > 1 &&
      !HIGH_STAKES_PATTERN.test(`${field.label} ${field.name ?? ""}`);
    const randomValue = canRandomize ? secureRandomOption(field.options ?? []) : null;
    const value = key && primitive(source[key]) ? source[key] : randomValue;
    mappings.push({
      fieldId: field.id,
      fieldLabel: field.label,
      sourceKey: key,
      value,
      confidence: key ? Math.max(0, Math.min(1, result?.confidence ?? 0)) : randomValue ? 1 : 0,
      method: key ? "ai" : randomValue ? "random" : fallbackMode === "blank" ? "blank" : "manual",
      sensitive: false,
    });
  }

  const ordered = fields.map((field) => mappings.find((mapping) => mapping.fieldId === field.id)).filter((mapping): mapping is FieldMapping => Boolean(mapping));
  return {
    targetUrl,
    fields,
    mappings: ordered,
    summary: {
      total: ordered.length,
      ready: ordered.filter((item) => item.value !== null).length,
      manual: ordered.filter((item) => item.method === "manual").length,
      aiMapped: ordered.filter((item) => item.method === "ai").length,
      knowledgeMapped: ordered.filter((item) => item.method === "knowledge").length,
    },
  };
}
