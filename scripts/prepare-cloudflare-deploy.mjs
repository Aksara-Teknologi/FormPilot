import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const sourcePath = resolve(root, "dist/server/wrangler.json");
const outputPath = resolve(root, "dist/server/wrangler.production.json");

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Environment ${name} wajib diisi untuk deployment produksi.`);
  return value;
}

function optional(name, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

const config = JSON.parse(await readFile(sourcePath, "utf8"));
const databaseId = required("CLOUDFLARE_D1_DATABASE_ID");
const hostname = optional("FORMPILOT_HOSTNAME", "form-pilot.aksarateknologi.com");
const allowedTargetHosts = optional("ALLOWED_TARGET_HOSTS");
const allowedGoogleDomains = optional("GOOGLE_ALLOWED_DOMAINS");

config.name = optional("CLOUDFLARE_WORKER_NAME", "formpilot");
config.compatibility_date = optional("CLOUDFLARE_COMPATIBILITY_DATE", "2026-07-31");
config.compatibility_flags = [...new Set([...(config.compatibility_flags ?? []), "nodejs_compat"])];
config.workers_dev = false;
config.preview_urls = false;
config.routes = [{ pattern: hostname, custom_domain: true }];
config.observability = {
  enabled: true,
  logs: { enabled: true, head_sampling_rate: 1 },
  traces: { enabled: true, head_sampling_rate: 0.05 },
};
config.vars = {
  GOOGLE_CLIENT_ID: required("GOOGLE_CLIENT_ID"),
  ...(allowedGoogleDomains ? { GOOGLE_ALLOWED_DOMAINS: allowedGoogleDomains } : {}),
  OPENAI_BASE_URL: optional("OPENAI_BASE_URL", "https://api.openai.com/v1"),
  OPENAI_MODEL: required("OPENAI_MODEL"),
  ...(allowedTargetHosts ? { ALLOWED_TARGET_HOSTS: allowedTargetHosts } : {}),
  MCP_SERVER_URL: optional("MCP_SERVER_URL"),
  MCP_INSPECT_TOOL: optional("MCP_INSPECT_TOOL", "inspect_form"),
  MCP_FILL_TOOL: optional("MCP_FILL_TOOL", "fill_form"),
};
config.d1_databases = [{
  binding: "DB",
  database_name: optional("CLOUDFLARE_D1_DATABASE_NAME", "formpilot-production"),
  database_id: databaseId,
  migrations_dir: "../../drizzle",
}];

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
console.log(`Production deployment config generated for ${hostname}.`);
