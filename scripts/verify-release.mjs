import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "dist/server/index.js",
  "dist/server/wrangler.json",
  "dist/client/og.png",
  "dist/.openai/hosting.json",
  "extension/manifest.json",
  "extension/service-worker.js",
  "extension/formpilot-bridge.js",
];

for (const file of requiredFiles) {
  await access(resolve(root, file), constants.R_OK);
}

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(resolve(root, "extension/manifest.json"), "utf8"));
if (packageJson.version !== manifest.version) {
  throw new Error(`Versi aplikasi (${packageJson.version}) dan extension (${manifest.version}) harus sama.`);
}

const hosting = JSON.parse(await readFile(resolve(root, ".openai/hosting.json"), "utf8"));
if (hosting.d1 !== "DB") throw new Error("Logical D1 binding harus bernama DB.");

for (let index = 0; index <= 5; index += 1) {
  const prefix = String(index).padStart(4, "0");
  const migrations = await import("node:fs/promises").then(({ readdir }) => readdir(resolve(root, "dist/.openai/drizzle")));
  if (!migrations.some((name) => name.startsWith(`${prefix}_`) && name.endsWith(".sql"))) {
    throw new Error(`Migrasi ${prefix} tidak ditemukan pada artefak build.`);
  }
}

console.log(`Release ${packageJson.version} siap dipaketkan.`);
