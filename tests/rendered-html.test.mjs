import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");

test("renders the FormPilot operator and product credit", async () => {
  const [page, operator, layout] = await Promise.all([
    file("app/page.tsx"),
    file("app/FormPilot.tsx"),
    file("app/layout.tsx"),
  ]);
  assert.match(page, /<FormPilot email=\{email\}/);
  assert.match(operator, /AI FORM OPERATOR/);
  assert.match(operator, /Knowledge/);
  assert.match(operator, /Aksara Bayu Teknologi/);
  assert.match(layout, /FormPilot/);
});

test("uses direct Google OIDC with bounded scopes and protected session cookies", async () => {
  const [authorize, callback, auth, worker, releaseConfig] = await Promise.all([
    file("app/api/auth/google/route.ts"),
    file("app/api/auth/google/callback/route.ts"),
    file("lib/auth.ts"),
    file("worker/index.ts"),
    file("scripts/prepare-cloudflare-deploy.mjs"),
  ]);
  assert.match(authorize, /scope: "openid email profile"/);
  assert.match(authorize, /state/);
  assert.match(authorize, /nonce/);
  assert.match(authorize, /code_challenge_method: "S256"/);
  assert.match(callback, /code_verifier: flow\.verifier/);
  assert.match(auth, /email_verified !== true/);
  assert.match(auth, /HttpOnly; SameSite=Lax/);
  assert.doesNotMatch(worker, /cf-access-jwt-assertion/);
  assert.doesNotMatch(releaseConfig, /TEAM_DOMAIN|POLICY_AUD/);
});

test("scopes Knowledge Packs to the authenticated user and applies them before AI", async () => {
  const [route, storage, planner, migration] = await Promise.all([
    file("app/api/knowledge-packs/route.ts"),
    file("lib/knowledge.ts"),
    file("lib/planner.ts"),
    file("drizzle/0001_slippery_blob.sql"),
  ]);
  assert.match(route, /currentUser\(request\)/);
  assert.doesNotMatch(route, /ownerId\s*=\s*input/);
  assert.match(storage, /WHERE p\.owner_id = \?1/);
  assert.match(storage, /p\.site_origin IS NULL OR p\.site_origin = \?2/);
  assert.ok(planner.indexOf("applyKnowledge") < planner.indexOf("callModel(unresolved"));
  assert.match(planner, /isSensitive\(field\)/);
  assert.match(migration, /CREATE TABLE `knowledge_packs`/);
  assert.match(migration, /ON DELETE cascade/);
});

test("records successful Excel rows without storing their values", async () => {
  const [route, storage, operator] = await Promise.all([
    file("app/api/input-history/route.ts"),
    file("lib/input-history.ts"),
    file("app/FormPilot.tsx"),
  ]);
  assert.match(route, /currentUser\(request\)/);
  assert.match(route, /\^\[a-f0-9\]\{64\}\$/);
  assert.doesNotMatch(storage, /source|row_value|excel_value/i);
  assert.match(operator, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(operator, /finishSuccessfulInput/);
  assert.match(operator, /Lanjut otomatis ke baris/);
  assert.match(operator, /chooseSheet/);
  assert.match(operator, /chooseHeaderRow/);
  assert.match(operator, /Sesuaikan nama header/);
});

test("compiles one-time prompts into bounded reusable browser workflows", async () => {
  const [workflows, authorization, bridge, manager] = await Promise.all([
    file("lib/workflows.ts"),
    file("app/api/authorize-workflow/route.ts"),
    file("extension/service-worker.js"),
    file("app/workflows/WorkflowManager.tsx"),
  ]);
  assert.match(workflows, /value\.length > 30/);
  assert.match(workflows, /Never handle password, OTP, CAPTCHA/);
  assert.match(workflows, /tombol final harus dijalankan manual/);
  assert.match(authorization, /referencedKeys/);
  assert.match(bridge, /Origin tab tidak sama/);
  assert.match(bridge, /Tombol final ditolak/);
  assert.match(manager, /Buat scenario dengan AI/);
});
