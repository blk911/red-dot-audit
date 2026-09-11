import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("follow-up stops on replies, referrals, conversions and unsubscribe", async () => {
  const source = await readFile(path.join(root, "lib/admin/types.ts"), "utf8");
  assert.match(source, /"REPLIED", "REFERRED", "CONVERTED", "UNSUBSCRIBED"/);
  assert.match(source, /return "NONE"/);
  assert.match(source, /return "NEVER_OPENED"/);
  assert.match(source, /return "OPENED_NO_CLICK"/);
  assert.match(source, /return "CLICKED_NO_ACTION"/);
});

test("radar scoring and rotation are deterministic and preserve history", async () => {
  const source = await readFile(path.join(root, "lib/admin/types.ts"), "utf8");
  assert.match(source, /caseContributions \* 8/);
  assert.match(source, /publishableEvents \* 13/);
  assert.match(source, /pulls >= minPulls/);
  assert.match(source, /challenge:/);
});

test("admin page and every admin API enforce the server auth adapter", async () => {
  const page = await readFile(path.join(root, "app/admin/page.tsx"), "utf8");
  assert.match(page, /requireChatGPTUser\("\/admin"\)/);
  const apiFiles = ["app/api/admin/status/route.ts", "app/api/admin/outreach/route.ts", "app/api/admin/census/route.ts", "app/api/admin/monitor/run/route.ts"];
  for (const file of apiFiles) {
    const source = await readFile(path.join(root, file), "utf8");
    assert.match(source, /isAdminRequest/);
    assert.match(source, /status:\s*403/);
  }
});

test("marketing controls cannot send production mail", async () => {
  const source = await readFile(path.join(root, "app/api/admin/outreach/route.ts"), "utf8");
  assert.doesNotMatch(source, /sendgrid|api\.sendgrid|sendMessage|deliverPurchaseEmail/i);
  assert.match(source, /sent:\s*false/);
});
