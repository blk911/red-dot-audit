import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

test("official contact verifier requires and retains a .gov source", () => {
  const source = fs.readFileSync(new URL("../lib/admin/official-contact.ts", import.meta.url), "utf8");
  assert.match(source, /host\.endsWith\("\.gov"\)/);
  assert.match(source, /sourceUrl/);
  assert.match(source, /status: "VERIFIED"/);
  assert.match(source, /nearby\.toLowerCase\(\)\.includes\(proposedName\.toLowerCase\(\)\)/);
  assert.match(source, /verifyOfficialContactUrl/);
});

test("campaign UI distinguishes proposed and official-source-verified contacts", () => {
  const source = fs.readFileSync(new URL("../app/admin/admin-console.tsx", import.meta.url), "utf8");
  assert.match(source, /PROPOSED · NOT YET SOURCE-VERIFIED/);
  assert.match(source, /OFFICIAL SOURCE VERIFIED/);
  assert.match(source, /FIND OFFICIAL CONTACT/);
  assert.match(source, /Exact \.gov page showing this contact/);
});
