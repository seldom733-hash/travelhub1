#!/usr/bin/env node
/**
 * TravelHub — Roadmap Artifact Integrity Checker.
 *
 * Static, repository-first guard that validates that Roadmap evidence claims
 * point to real artifacts. Documentation/tooling only — no business logic.
 *
 * Detects (hard FAIL unless noted):
 *  1. Roadmap references to missing files (approved steps);
 *  2. APPROVED steps whose referenced implementation report is missing;
 *  3. APPROVED steps whose referenced Strict Review report is missing;
 *  4. prompt used as report (…_STRICT_REVIEW.md ≠ …_STRICT_REVIEW_REPORT.md);
 *  5. referenced architecture docs that do not exist;
 *  6. referenced migrations (explicit names) that do not exist;
 *  7. referenced e2e/unit test files that do not exist (explicit names);
 *  8. malformed/missing REPOSITORY EVIDENCE footer for prospective reports
 *     (reports that opt into the new-format markers);
 *  9. persistence SHA claims that do not resolve in Git;
 * 10. evidence references escaping the repository (traversal) or legacy-only;
 * WARN: historical test counts, non-approved plan references, bare log names.
 *
 * Exit codes: 0 = no hard failures; 1 = integrity failures; 2 = execution/CLI error.
 *
 * Usage:
 *   node scripts/check-roadmap-artifacts.mjs [--roadmap <path>] [--json]
 *
 * Root is not an npm package; invoke directly (CI integration deferred to Step 2.17).
 */
import { readFileSync, statSync, readdirSync } from "node:fs";
import { resolve, relative, isAbsolute, sep, normalize } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_ROADMAP = "docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md";
const PROMTPS_DIR = "docs/prompts";
const ARCH_DIR = "docs/architecture";
const MIGRATIONS_DIR = "backend/prisma/migrations";
const TEST_DIR = "backend/test";

// ── helpers ──────────────────────────────────────────────────────────────────

function toPosix(p) {
  return p.split(sep).join("/");
}

function stripTrailingPunct(s) {
  return s.replace(/[.,;:)\]}>]+$/g, "");
}

/** Resolve a repo-relative path safely. Returns {path, reason} or {escape: reason}. */
function safeResolve(rootDir, ref) {
  const p = toPosix(ref).replace(/^\.\//, "");
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) {
    return { escape: `absolute path is not repository-relative: ${ref}` };
  }
  const parts = p.split("/");
  if (parts.includes("..")) {
    return { escape: `path traversal (..) in reference: ${ref}` };
  }
  const abs = resolve(rootDir, ...parts);
  const rel = toPosix(relative(rootDir, abs));
  if (rel.startsWith("..") || isAbsolute(rel)) {
    return { escape: `reference escapes repository root: ${ref}` };
  }
  return { path: abs, rel };
}

function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function gitCommitExists(sha, cwd = process.cwd()) {
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], {
      stdio: "ignore",
      cwd,
    });
    return true;
  } catch {
    return false;
  }
}

// ── Roadmap parsing ──────────────────────────────────────────────────────────

/**
 * Split Roadmap text into logical entry blocks. A new entry starts at:
 *  - `· **Step …`
 *  - `NN. **STEP …` / `NNA. **PHASE …` (historical log lines)
 *  - `**Step …` (bare header)
 * Continuation lines are joined into the current block.
 */
function splitEntries(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let current = null;
  const entryStart = /^\s*(?:·\s+|\d+[A-Za-z]?\.\s+)?\*\*(?:Step\s|STEP\s|PHASE\s\d)/i;
  const statusStart = /^\s*\*\*Статус:/i;
  for (const line of lines) {
    if (entryStart.test(line) || statusStart.test(line)) {
      if (current) entries.push(current);
      const trimmed = line.trim();
      const kind = statusStart.test(trimmed)
        ? "status"
        : /^·/.test(trimmed) || /^[-*•]/.test(trimmed)
          ? "canonical"
          : /^\d+[A-Za-z]?\./.test(trimmed)
            ? "log"
            : "other";
      current = { header: trimmed, text: line, kind };
    } else if (current) {
      current.text += "\n" + line;
    }
  }
  if (current) entries.push(current);
  return entries;
}

/**
 * Content-based kind of a strict-review file (name alone is ambiguous:
 * historical files use `_STRICT_REVIEW.md` for both prompts and reports).
 * REPORT — standalone verdict line, `## 1. Verdict`, or REPOSITORY EVIDENCE footer.
 * PROMPT — template markers (Hard stop / STOP section / mission) without verdict.
 * UNKNOWN — neither.
 */
function fileKind(content) {
  const hasReport = /^\s*\*?\*?`?PHASE 2 STEP [\d.]+ STRICT REVIEW COMPLETED/m.test(content) || /^##\s*1\.\s*VERDICT/im.test(content) || /REPOSITORY EVIDENCE/.test(content);
  if (hasReport) return "REPORT";
  const hasPrompt = /Hard stop|Do not implement|##\s*\d+\.\s*STOP|Final verdict must be exactly one of/.test(content);
  if (hasPrompt) return "PROMPT";
  return "UNKNOWN";
}

// Approval markers: `✅ APPROVED …`, `… STRICT REVIEW COMPLETED — APPROVED …`,
// `APPROVED WITH REVIEW FIXES`, `APPROVED (…`. Case-sensitive word match so
// prose like “not approved yet” is not treated as a marker.
const APPROVED_RE = /✅\s*APPROVED|APPROVED WITH REVIEW FIXES|STRICT REVIEW COMPLETED[\s—–-]+APPROVED|APPROVED\s*\(/;
const BLOCKED_RE = /BLOCKED|ARCHITECTURE DECISION REQUIRED/i;

function isApproved(text) {
  if (BLOCKED_RE.test(text)) return false;
  return APPROVED_RE.test(text);
}

/** Classification of a reference token. */
function classifyRef(token) {
  const t = token.toLowerCase();
  if (t.includes("_strict_review_report") || /strict.?review.?report/.test(t)) return "STRICT_REVIEW_REPORT";
  if (t.includes("_strict_review") || /strict.?review/.test(t)) return "STRICT_REVIEW_PROMPT";
  if (t.includes("_implementation_report") || /implementation.?report/.test(t)) return "IMPLEMENTATION_REPORT";
  if (/report\.md$/.test(t) || t.includes("_report\.md")) return "REPORT";
  if (t.includes("migration") || /^\d{14}_|^add_/.test(t)) return "MIGRATION";
  if (t.endsWith(".e2e-spec.ts")) return "TEST_E2E";
  if (t.endsWith(".spec.ts")) return "TEST_UNIT";
  if (t.startsWith("docs/architecture/")) return "ARCHITECTURE_DOC";
  if (t.startsWith("docs/adr/")) return "ADR";
  if (/\.md$/.test(t)) return "DOC";
  return "OTHER";
}

const REPORT_NAME_RE = /[A-Za-z0-9_.-]+(?:STRICT_REVIEW|IMPLEMENTATION)_?(?:REPORT)?\.md/g;

/**
 * Extract candidate artifact references from an entry:
 *  - backtick tokens;
 *  - bare report filenames mentioned as “отчёт — NAME.md” (no backticks).
 */
function extractReferences(text) {
  const refs = new Map(); // ref -> {count}
  const add = (r) => {
    const clean = stripTrailingPunct(r.trim());
    if (!clean) return;
    const key = clean;
    refs.set(key, (refs.get(key) || 0) + 1);
  };
  for (const m of text.matchAll(/`([^`]+)`/g)) add(m[1]);
  for (const m of text.matchAll(new RegExp(REPORT_NAME_RE.source, "g"))) add(m[0]);
  return [...refs.keys()];
}

// ── Footer validation (prospective reports) ─────────────────────────────────

const FOOTER_HEADER = "REPOSITORY EVIDENCE";
const NEW_FORMAT_MARKERS = ["persistence_status:", "RETROSPECTIVE EVIDENCE RECONSTRUCTION", "reviewed_state:"];
const REQUIRED_FIELDS = [
  "repository",
  "branch",
  "head",
  "origin",
  "worktree_clean",
  "migration_count",
  "reviewed_state",
  "reviewed_diff_base",
  "reviewed_diff_head",
  "persistence_status",
  "persistence_sha",
];

/** Returns array of {field, value} from a REPOSITORY EVIDENCE block, or null if absent. */
function parseFooter(content) {
  const idx = content.indexOf(FOOTER_HEADER);
  if (idx === -1) return null;
  const block = content.slice(idx).split(/\r?\n/).slice(0, 16).join("\n");
  const fields = [];
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) fields.push({ field: m[1], value: m[2].trim() });
  }
  if (fields.length === 0) return [];
  return fields;
}

/**
 * Validate a report file that opts into the new format.
 * Returns array of {code, message}.
 */
function validateFooterFile(rootDir, rel, content) {
  const problems = [];
  const fields = parseFooter(content);
  if (fields === null) {
    problems.push({ code: "FOOTER_MISSING", message: `prospective report lacks REPOSITORY EVIDENCE footer: ${rel}` });
    return problems;
  }
  const map = new Map(fields.map((f) => [f.field, f.value]));
  for (const f of REQUIRED_FIELDS) {
    if (!map.has(f) || map.get(f) === "") {
      problems.push({ code: "FOOTER_FIELD_MISSING", message: `missing footer field '${f}' in ${rel}` });
    }
  }
  const ps = map.get("persistence_status");
  if (ps !== undefined && !["PERSISTED", "NOT_PERSISTED"].includes(ps)) {
    problems.push({ code: "FOOTER_ENUM", message: `invalid persistence_status '${ps}' in ${rel}` });
  }
  const sha = map.get("persistence_sha");
  if (ps === "PERSISTED") {
    if (!sha || sha === "N/A" || !/^[0-9a-f]{7,40}$/i.test(sha)) {
      problems.push({ code: "FOOTER_SHA_REQUIRED", message: `persistence_status PERSISTED requires a non-N/A SHA in ${rel}` });
    } else if (!gitCommitExists(sha, rootDir)) {
      problems.push({ code: "SHA_UNRESOLVED", message: `persistence_sha ${sha} does not resolve to a commit (${rel})` });
    }
  } else if (ps === "NOT_PERSISTED") {
    // valid: no SHA required (may be N/A)
  }
  const head = map.get("head");
  if (head && head !== "WORKTREE" && /^[0-9a-f]{7,40}$/i.test(head) && !gitCommitExists(head, rootDir)) {
    problems.push({ code: "SHA_UNRESOLVED", message: `head ${head} does not resolve to a commit (${rel})` });
  }
  return problems;
}

// ── Main check ───────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {string} opts.rootDir repository root (default cwd)
 * @param {string} [opts.roadmapPath] path to Roadmap (default canonical)
 * @returns {{ exitCode, results, summary }}
 */
export function runCheck(opts = {}) {
  const rootDir = resolve(opts.rootDir || process.cwd());
  const roadmapPath = resolve(rootDir, opts.roadmapPath || DEFAULT_ROADMAP);
  if (!isFile(roadmapPath)) {
    return {
      exitCode: 2,
      summary: { error: `roadmap not found: ${roadmapPath}` },
      results: [],
    };
  }
  const text = readFileSync(roadmapPath, "utf8");
  const entries = splitEntries(text);
  const results = [];

  const fail = (step, cls, ref, message, extra = {}) =>
    results.push({ level: "FAIL", step, classification: cls, ref, message, ...extra });
  const warn = (step, cls, ref, message, extra = {}) =>
    results.push({ level: "WARN", step, classification: cls, ref, message, ...extra });
  const pass = (step, cls, ref, message = "referenced artifact exists") =>
    results.push({ level: "PASS", step, classification: cls, ref, message });

  let approvedScanned = 0;
  let refsScanned = 0;

  for (const entry of entries) {
    let stepLabel = entry.header.replace(/^\s*[·•\-]?\s*\d+[A-Za-z]?\.?\s*\*\*/, "").replace(/\*\*.*$/, "").trim();
    if (!stepLabel) {
      const m = entry.text.match(/STEP\s*([\d.]+[A-Z]?)/i) || entry.text.match(/Step\s*([\d.]+[A-Z]?)/);
      stepLabel = m ? `Step ${m[1]}` : entry.kind === "status" ? "Статус" : "(entry)";
    }
    const approved = isApproved(entry.text);
    if (approved) approvedScanned++;

    // For strict-review refs, content classification overrides name-based guess.
    const contentKindOf = new Map();
    for (const r of extractReferences(entry.text)) {
      if (!/STRICT_REVIEW/i.test(r)) continue;
      const rp = toPosix(r);
      let found = null;
      if (/^(docs|backend|frontend|\\.github|scripts|prisma)\//.test(rp)) {
        const s = safeResolve(rootDir, rp);
        if (!s.escape && isFile(s.path)) found = s.path;
      } else if (!rp.includes("/")) {
        found = [resolve(rootDir, PROMTPS_DIR, rp), resolve(rootDir, ARCH_DIR, rp)].find((c) => isFile(c));
      }
      if (found) contentKindOf.set(r, fileKind(readFileSync(found, "utf8")));
    }

    const refs = extractReferences(entry.text);
    for (const rawRef of refs) {
      refsScanned++;
      const ref = toPosix(rawRef);
      // Tokens containing whitespace cannot be repository paths — skip (no crash, no FP).
      if (/\s/.test(ref)) continue;
      const cls = classifyRef(ref);

      // Legacy boundary.
      if (ref.startsWith("legacy/")) {
        if (approved) {
          fail(stepLabel, cls, ref, "legacy-only artifact cannot satisfy canonical evidence reference");
        } else {
          warn(stepLabel, cls, ref, "legacy path referenced (non-approved step)");
        }
        continue;
      }

      // Path-looking reference.
      if (/^(docs|backend|frontend|\.github|scripts|prisma)\//.test(ref)) {
        const safety = safeResolve(rootDir, ref);
        if (safety.escape) {
          fail(stepLabel, cls, ref, safety.escape);
          continue;
        }
        const rel = safety.rel;
        const exists = isFile(safety.path) || isDir(safety.path);
        if (exists) {
          const kind = contentKindOf.get(rawRef);
          const effectiveCls = kind === "REPORT" && cls === "STRICT_REVIEW_PROMPT" ? "STRICT_REVIEW_REPORT" : cls;
          if (kind === "PROMPT") pass(stepLabel, effectiveCls, ref, "referenced artifact exists (content-classified PROMPT)");
          else pass(stepLabel, effectiveCls, ref, "referenced artifact exists");
          // Footer validation for prospective reports (path-prefixed refs).
          if (["STRICT_REVIEW_REPORT", "IMPLEMENTATION_REPORT", "REPORT"].includes(effectiveCls) && isFile(safety.path)) {
            const content = readFileSync(safety.path, "utf8");
            if (NEW_FORMAT_MARKERS.some((m) => content.includes(m))) {
              for (const p of validateFooterFile(rootDir, rel, content)) {
                fail(stepLabel, effectiveCls, ref, p.message);
              }
            }
          }
        } else if (approved) {
          fail(stepLabel, cls, ref, `referenced file does not exist: ${rel}`);
        } else {
          warn(stepLabel, cls, ref, `referenced file does not exist (non-approved step): ${rel}`);
        }
        continue;
      }

      // Migration name (backtick `add_…` or full timestamp dir), no path prefix.
      if (/^(add_|20\d{12}_)/.test(ref)) {
        const dirs = [];
        try {
          for (const d of readdirSync(resolve(rootDir, MIGRATIONS_DIR))) dirs.push(d);
        } catch {
          /* no migrations dir */
        }
        const hit = dirs.find((d) => d === ref || d.endsWith(`_${ref}`));
        if (hit) {
          const sql = resolve(rootDir, MIGRATIONS_DIR, hit, "migration.sql");
          pass(stepLabel, "MIGRATION", ref, `migration exists (${hit}${isFile(sql) ? " + migration.sql" : ", migration.sql MISSING"})`);
          if (!isFile(sql)) warn(stepLabel, "MIGRATION", ref, `migration.sql missing in ${hit}`);
        } else if (approved) {
          fail(stepLabel, "MIGRATION", ref, `referenced migration does not exist: ${ref}`);
        } else {
          warn(stepLabel, "MIGRATION", ref, `referenced migration does not exist (non-approved step): ${ref}`);
        }
        continue;
      }

      // Test artifact name (backtick `foo.e2e-spec.ts`), no path prefix.
      if (/\.(e2e-)?spec\.ts$/.test(ref)) {
        const candidate = resolve(rootDir, TEST_DIR, ref);
        if (isFile(candidate)) {
          pass(stepLabel, cls, ref, "test artifact exists");
        } else if (approved) {
          fail(stepLabel, cls, ref, `referenced test file does not exist: ${ref}`);
        } else {
          warn(stepLabel, cls, ref, `referenced test file does not exist (non-approved step): ${ref}`);
        }
        continue;
      }

      // Bare report/doc name: resolve against docs/prompts and docs/architecture.
      if (/\.md$/.test(ref) && !ref.includes("/")) {
        const candidates = [resolve(rootDir, PROMTPS_DIR, ref), resolve(rootDir, ARCH_DIR, ref)];
        const found = candidates.find((c) => isFile(c));
        if (found) {
          const kind = contentKindOf.get(ref) || "UNKNOWN";
          const effectiveCls = kind === "REPORT" && cls === "STRICT_REVIEW_PROMPT" ? "STRICT_REVIEW_REPORT" : cls;
          if (kind === "PROMPT") {
            pass(stepLabel, effectiveCls, ref, "referenced doc exists (content-classified PROMPT)");
          } else {
            pass(stepLabel, effectiveCls, ref, "referenced doc exists");
          }
          // Footer validation for prospective reports.
          if (["STRICT_REVIEW_REPORT", "IMPLEMENTATION_REPORT", "REPORT"].includes(effectiveCls)) {
            const content = readFileSync(found, "utf8");
            if (NEW_FORMAT_MARKERS.some((m) => content.includes(m))) {
              for (const p of validateFooterFile(rootDir, toPosix(relative(rootDir, found)), content)) {
                fail(stepLabel, effectiveCls, ref, p.message);
              }
            }
          }
        } else if (approved) {
          fail(stepLabel, cls, ref, `referenced report name does not exist under docs/prompts or docs/architecture: ${ref}`);
        } else {
          warn(stepLabel, cls, ref, `referenced report name does not exist (non-approved step): ${ref}`);
        }
        continue;
      }

      // Historical test-count claims (e.g. `1055/1055`).
      if (/^\d{2,4}\/\d{2,4}$/.test(ref)) {
        warn(stepLabel, "HISTORICAL_TEST_COUNT", ref, "historical runtime claim; not independently verified by static checker");
        continue;
      }

      // Unresolved other token — leave alone (no crash, no false positive).
    }

    // Prompt ≠ report rule: within an APPROVED entry claiming a report (отчёт),
    // a content-classified PROMPT with no sibling REPORT → hard fail for canonical
    // entries; WARN for historical numbered-log lines (pre-convention naming).
    if (approved) {
      const promptRefs = refs.filter((r) => {
        if (classifyRef(toPosix(r)) !== "STRICT_REVIEW_PROMPT") return false;
        const k = contentKindOf.get(r);
        return k === undefined ? true : k === "PROMPT" || k === "UNKNOWN";
      });
      const reportRefs = refs.filter((r) => {
        const cls = classifyRef(toPosix(r));
        if (cls === "STRICT_REVIEW_REPORT") return true;
        return contentKindOf.get(r) === "REPORT";
      });
      if (promptRefs.length > 0 && reportRefs.length === 0 && /отчёт|report/i.test(entry.text)) {
        for (const r of promptRefs) {
          const msg = "Strict Review PROMPT referenced where a Strict Review REPORT is claimed (prompt ≠ report)";
          if (entry.kind === "canonical" || entry.kind === "status") fail(stepLabel, "STRICT_REVIEW_PROMPT", r, msg);
          else warn(stepLabel, "STRICT_REVIEW_PROMPT", r, `${msg} (pre-convention historical log entry; genuine gap candidate)`);
        }
      }
    }
  }

  const summary = {
    roadmap: roadmapPath,
    approvedStepsScanned: approvedScanned,
    referencesScanned: refsScanned,
    pass: results.filter((r) => r.level === "PASS").length,
    warn: results.filter((r) => r.level === "WARN").length,
    fail: results.filter((r) => r.level === "FAIL").length,
  };
  const exitCode = summary.fail > 0 ? 1 : 0;
  return { exitCode, results, summary };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function printReport({ results, summary }, json) {
  if (json) {
    console.log(JSON.stringify({ summary, results }, null, 2));
    return;
  }
  console.log("TravelHub Roadmap Artifact Integrity Check");
  console.log("");
  console.log(`Roadmap: ${summary.roadmap}`);
  console.log(`Approved steps scanned: ${summary.approvedStepsScanned}`);
  console.log(`Explicit artifact references: ${summary.referencesScanned}`);
  console.log("");
  console.log(`PASS: ${summary.pass}`);
  console.log(`WARN: ${summary.warn}`);
  console.log(`FAIL: ${summary.fail}`);
  console.log("");
  for (const r of results) {
    console.log(`[${r.level}] ${r.step} ${r.classification}`);
    console.log(`       ${r.ref}`);
    console.log(`       reason: ${r.message}`);
  }
}

function main(argv) {
  const args = argv.slice(2);
  const json = args.includes("--json");
  const roadmapIdx = args.indexOf("--roadmap");
  const roadmapPath = roadmapIdx !== -1 ? args[roadmapIdx + 1] : undefined;
  try {
    const out = runCheck({ roadmapPath });
    if (out.summary.error) {
      console.error(`ERROR: ${out.summary.error}`);
      process.exit(2);
    }
    printReport(out, json);
    process.exit(out.exitCode);
  } catch (err) {
    console.error(`CHECKER ERROR: ${err && err.stack ? err.stack : err}`);
    process.exit(2);
  }
}

// ESM entry detection.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv);
}
