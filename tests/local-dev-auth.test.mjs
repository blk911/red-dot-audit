import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("local admin identity shim is gated by a build-time-stripped dev flag, never a client header", async () => {
  const source = await readFile(path.join(root, "app/chatgpt-auth.ts"), "utf8");
  assert.match(source, /if \(!import\.meta\.env\.DEV\) return null;/);
  assert.match(source, /LOCAL_ADMIN_EMAIL/);
  const localDevUserBody = source.slice(source.indexOf("function getLocalDevUser"));
  assert.doesNotMatch(localDevUserBody, /requestHeaders|searchParams|cookies\(/);
});
