/**
 * TravelHub — Roadmap Artifact Integrity Checker — tests (node:test).
 *
 * Run: node --test scripts/check-roadmap-artifacts.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCheck } from "./check-roadmap-artifacts.mjs";

const FIXTURES = fileURLToPath(new URL("./test/fixtures", import.meta.url));
const ROOT = resolve(FIXTURES, "root");
const roadmap = (name) => resolve(FIXTURES, name);

const levels = (out) => ({
  pass: out.results.filter((r) => r.level === "PASS"),
  warn: out.results.filter((r) => r.level === "WARN"),
  fail: out.results.filter((r) => r.level === "FAIL"),
});

test("1. existing file → PASS", () => {
  const out = runCheck({ rootDir: ROOT, roadmapPath: roadmap("roadmap-good.md") });
  const { pass, fail } = levels(out);
  assert.equal(out.exitCode, 0);
  assert.ok(pass.some((r) => r.ref.includes("PHASE_2_STEP_1_IMPL_REPORT.md") && r.level === "PASS"));
  assert.ok(pass.some((r) => r.ref === "docs/architecture/step1.md"));
  assert.ok(pass.some((r) => r.ref === "add_demo_migration" && r.classification === "MIGRATION"));
  assert.ok(pass.some((r) => r.ref === "demo.e2e-spec.ts" && r.classification === "TEST_E2E"));
  assert.equal(fail.length, 0);
});

test("2. missing file → FAIL", () => {
  const out = runCheck({ rootDir: ROOT, roadmapPath: roadmap("roadmap-missing.md") });
  const { fail } = levels(out);
  assert.equal(out.exitCode, 1);
  assert.ok(fail.some((r) => r.ref.includes("PHASE_2_STEP_1_MISSING_REPORT.md")));
  assert.ok(fail.some((r) => r.ref === "docs/architecture/missing-arch.md"));
});

test("3. prompt used as report → FAIL", () => {
  const out = runCheck({ rootDir: ROOT, roadmapPath: roadmap("roadmap-prompt-as-report.md") });
  const { fail } = levels(out);
  assert.equal(out.exitCode, 1);
  assert.ok(
    fail.some((r) => r.classification === "STRICT_REVIEW_PROMPT" && /prompt ≠ report/i.test(r.message)),
    `expected prompt≠report FAIL, got: ${JSON.stringify(fail.map((f) => f.message))}`,
  );
});

test("4. path traversal → FAIL", () => {
  const out = runCheck({ rootDir: ROOT, roadmapPath: roadmap("roadmap-traversal.md") });
  const { fail } = levels(out);
  assert.equal(out.exitCode, 1);
  assert.ok(fail.some((r) => /traversal|escape/i.test(r.message)));
});

test("5. valid persisted SHA → PASS", () => {
  const out = runCheck({ rootDir: ROOT, roadmapPath: roadmap("roadmap-sha.md") });
  const { pass, fail } = levels(out);
  const shaRef = pass.find((r) => r.ref.includes("PHASE_2_STEP_1_SHA_REPORT.md"));
  assert.ok(shaRef, "good SHA report should pass");
  // The BADSHA report must fail (case 6).
  assert.ok(fail.some((r) => /does not resolve to a commit/.test(r.message)));
});

test("6. nonexistent persisted SHA → FAIL", () => {
  const out = runCheck({ rootDir: ROOT, roadmapPath: roadmap("roadmap-sha.md") });
  const { fail } = levels(out);
  assert.equal(out.exitCode, 1);
  assert.ok(fail.some((r) => /BADSHA_REPORT|does not resolve to a commit/.test(r.message)));
});

test("7. historical report without prospective footer → allowed", () => {
  const out = runCheck({ rootDir: ROOT, roadmapPath: roadmap("roadmap-good.md") });
  const { fail } = levels(out);
  // PHASE_2_STEP_1_IMPL_REPORT.md is historical (no new-format marker) — no footer required.
  assert.equal(fail.length, 0);
});

test("8. new report requiring footer but missing → FAIL", () => {
  const out = runCheck({ rootDir: ROOT, roadmapPath: roadmap("roadmap-footer-missing.md") });
  const { fail } = levels(out);
  assert.equal(out.exitCode, 1);
  assert.ok(fail.some((r) => /lacks REPOSITORY EVIDENCE footer/.test(r.message)));
});

test("9. NOT_PERSISTED with no SHA → valid", () => {
  const out = runCheck({ rootDir: ROOT, roadmapPath: roadmap("roadmap-notpersisted.md") });
  const { fail } = levels(out);
  assert.equal(out.exitCode, 0);
  assert.equal(fail.length, 0);
});

test("10. legacy-only artifact cannot satisfy canonical reference", () => {
  const out = runCheck({ rootDir: ROOT, roadmapPath: roadmap("roadmap-traversal.md") });
  const { fail } = levels(out);
  assert.ok(fail.some((r) => /legacy-only/.test(r.message)));
});

test("11. malformed Roadmap reference does not crash checker", () => {
  const out = runCheck({ rootDir: ROOT, roadmapPath: roadmap("roadmap-malformed.md") });
  assert.ok(typeof out.exitCode === "number", "checker must not throw");
  assert.notEqual(out.exitCode, 2, "must not be an execution error");
  // Junk tokens (whitespace-containing) are skipped — no fabricated failures.
  assert.ok(!out.results.some((r) => /and a bare/.test(r.ref)), "whitespace token must be skipped");
});

// scripts/check-roadmap-artifacts.test.mjs → parent dir = repo root D:/travelhub_v1
const REAL_ROOT = fileURLToPath(new URL("..", import.meta.url));

test("12. Step 2.10B reconstructed report passes against real Roadmap", () => {
  const out = runCheck({ rootDir: REAL_ROOT });
  const { fail } = levels(out);
  const bRef = fail.find((r) => r.ref.includes("PHASE_2_STEP_2.10B_"));
  assert.ok(!bRef, `2.10B report must pass, got: ${JSON.stringify(fail.map((f) => f.ref))}`);
});

test("smoke: exit code 0 on real Roadmap has no hard FAIL for footer-checked new reports", () => {
  const out = runCheck({ rootDir: REAL_ROOT });
  assert.ok(out.summary.approvedStepsScanned > 10, "should scan many approved steps");
  assert.ok(out.summary.referencesScanned > 50, "should scan many references");
});
