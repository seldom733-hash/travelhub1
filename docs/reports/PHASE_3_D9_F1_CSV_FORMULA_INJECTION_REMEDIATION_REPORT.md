# PHASE 3 — D9-F1 CSV Formula Injection Remediation Report

> **Prompt:** `docs/prompts/PHASE_3_D9_F1_CSV_FORMULA_INJECTION_TARGETED_REMEDIATION_PROMPT.md`
> **Mode:** TARGETED IMPLEMENTATION ONLY — scope strictly D9-F1.
> **Verdict: A — D9-F1 REMEDIATED** (D9 overall remains PENDING FINAL CLOSURE; F2–F5 unchanged; D9 not marked APPROVED; D10 not started.)

---

## 1. Executive Summary

The single blocking D9 finding — **D9-F1 CSV Formula Injection (P1 Security)** — is remediated at the single serialization choke point of the shared `ExportService` (`backend/src/modules/shared/export/export.service.ts`). Text cells whose first character is a spreadsheet formula trigger (`= + - @`) or which begin with a tab/CR/LF control character are escaped to text with a leading apostrophe (`'`), while runtime machine scalars (`number | boolean | Date`) and strict machine-number strings (Prisma `Decimal` → `String()` contract, e.g. `"-12.50"`, `"+1"`) pass verbatim. Proven by a 10-case unit matrix with RFC-4180 readback parsing (no new dependencies), a live-endpoint runtime proof (`GET /api/v1/products/export` with attacker-controlled product title, raw-byte inspection + parse), and unchanged D8/temporal + auth-gate regression suites. No schema, migration, RBAC, or business-logic changes.

---

## 2. Original Finding

From `docs/reports/PHASE_3_D9_EXPORT_FRAMEWORK_REQUALIFICATION_REPORT.md` (VERDICT B record):

- **D9-F1 — CSV Formula Injection — P1 Security.**
- User-controlled string values beginning with `= + - @` may be serialized verbatim into CSV exports; spreadsheet applications would evaluate them as formulas.
- Affected example sources: product titles, customer/company names, payment method, support titles.

---

## 3. Root Cause

`csvEscape` handled CSV **syntax** escaping (comma/quote/newline) but performed no **semantic** escaping: any string — including attacker-controlled text — was emitted verbatim. All CSV exporters serialize through this single shared serializer, so no per-endpoint duplication existed; the gap was purely in the guard.

---

## 4. Chosen Mitigation

Canonical escape-to-text strategy (D9 requalification report / prompt §6):

- A **TEXT** cell (string-typed value) whose first character (raw, untrimmed) matches `/^[=+\-@]/` or begins with `/^[\t\r\n]/` is prefixed with an apostrophe `'` → the cell becomes a text literal in spreadsheet applications; content after the apostrophe is preserved verbatim.
- Leading **space** is intentionally NOT a trigger (documented canonical choice): Excel does not evaluate `" =1+1"` as a formula, and trimming/normalizing user text would alter cell content (prompt §12 documents this decision; behavior is identical across all export endpoints because there is exactly one serializer).
- `"'=1+1"` (already a text literal) is not double-prefixed beyond the documented single-guard rule; the first char `'` is not a trigger, so it passes unchanged.

---

## 5. Type/Semantic Preservation

Distinguishing TEXT from machine data (prompt §5), enforced by value type first, then by a strict machine-number grammar for strings:

1. **Non-string runtime scalars** (`number | boolean | Date` — e.g. `amount: -12.5`) → verbatim, never transformed. Negative numeric amounts are safe: `typeof val === 'string'` gates the guard.
2. **Strict machine-number strings** (Prisma `Decimal` money serialized via `String(o.amount)`, e.g. `"-12.50"`, `"+1"`, `"0.95"`, `"1e3"`, `"-1.5E-2"`) → verbatim. Grammar: `/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/`. These cannot execute as spreadsheet formulas (no function reference), and prefixing them would corrupt numeric semantics (`amount = -12.50` requirement). Consequently prompt §7's `"-1"`/`"+1"` payloads are asserted UNCHANGED as machine numbers; formula-shaped variants `"==1+1"`, `"++1"`, `"--1"`, `"-@cmd"` remain protected (§12).
3. **Every other string** with a trigger/control first character → apostrophe-prefixed (protected).
4. CSV syntax escaping (comma/quote/newline quoting) is applied **after** the guard and is unchanged.

Trade-off note (prompt §6.4): `-1`/`+1` as *text* (non-numeric-typed context) cannot be distinguished from Decimal-stringified money at the serializer boundary with the current `Record<string, any>` row contract; the narrowest safe change was chosen rather than a schema/type rewrite.

---

## 6. Code Changes

| File | Change |
|---|---|
| `backend/src/modules/shared/export/export.service.ts` | ONLY production change. Added `FORMULA_TRIGGER`, `LEADING_CONTROL`, `MACHINE_NUMBER` regexes; extended `csvEscape` with the type-gated formula-injection guard. `toCsv`, `toXlsx`, headers, column order, BOM, Content-Type, filename behavior unchanged. |
| `backend/src/modules/shared/export/export-formula-guard.spec.ts` | NEW — 10-test matrix (§7 payloads, §8 readback parse, §12 adversarial, machine-data preservation, null/undefined/empty, column order). |
| `backend/test/d9-f1-csv-formula-guard.e2e-spec.ts` | NEW — live-endpoint runtime proof on the real backend (isolated per-suite template DB). |
| `docs/prompts/PHASE_3_D9_F1_CSV_FORMULA_INJECTION_TARGETED_REMEDIATION_PROMPT.md` | Remediation prompt (committed as governing input). |
| `docs/reports/PHASE_3_D9_F1_CSV_FORMULA_INJECTION_REMEDIATION_REPORT.md` | This report. |

XLSX serializer untouched (prompt §9: values are written as strings/shared strings, no practical formula-execution exposure).

---

## 7. Test Matrix

Unit (`export-formula-guard.spec.ts`, 10/10 PASS):

| Class | Cases | Result |
|---|---|---|
| Injection payloads | `=1+1`, `@SUM(A1)`, `=cmd\|' /C calc'!A0`, `=HYPERLINK("http://evil")` → `'`-prefixed, content verbatim after guard (verified through RFC-4180 parse) | PASS |
| Leading control | `\t=1+1`, `\r=1+1`, `\n=1+1` → `'`-prefixed | PASS |
| Adversarial (§12) | `" =1+1"` unchanged (documented choice), `'=1+1` unchanged, `==1+1`, `++1`, `--1`, `@cmd`, `-@cmd` protected | PASS |
| Machine-number strings | `-12.50`, `12.50`, `-1`, `+1`, `0.95`, `-0.5`, `+0.25`, `1e3`, `-1.5E-2` verbatim | PASS |
| Runtime scalars | `-12.5` (number), booleans verbatim; no `'-12.5` artifact | PASS |
| Safe text | `Hotel Antalya`, `Normal text`, `Room 2+1`, `A-123`, `email@example.com`, `100 USD` unchanged | PASS |
| CSV syntax | `Hello, world` / `He said "hello"` / `Line 1\nLine 2` quoted+parsed correctly | PASS |
| Null/undefined/empty | empty cells, no artifacts | PASS |
| Column integrity | order/count unchanged; protected cell stays in its column | PASS |
| Mixed readback | 3-row real-world mix; BOM preserved; no formula-leading text cell | PASS |

E2E runtime (`test/d9-f1-csv-formula-guard.e2e-spec.ts`, 3/3 PASS):

1. Anonymous `GET /api/v1/products/export` → **401** (auth gate unchanged).
2. PARTNER on staff-only `GET /api/v1/orders/export` → **403** (permission parity unchanged).
3. PARTNER creates products titled `=HYPERLINK("http://evil")` and `Hotel Antalya`; admin downloads products export:
   - BOM preserved (`charCodeAt(0) === 0xFEFF`);
   - raw bytes contain the protected representation `"'=HYPERLINK(""http://evil"")"""` (apostrophe guard + RFC-4180 quoting/quote-doubling — never a raw formula);
   - normal title verbatim; column order/count unchanged; `PRD-*` business codes intact; parsed evil row Title = `'=HYPERLINK("http://evil")`, normal row = `Hotel Antalya`.

Raw-byte sample (from the failing-then-fixed assertion run — evidence of actual serialized bytes):

```text
ID,Code,Title,Type,Status,Category,Tariffs,PriceFrom,PublishedAt,CreatedAt
77776891-…,PRD-00000002,Hotel Antalya,TOUR,DRAFT,,,,,2026-09-10T12:59:43.442Z
4a808b82-…,PRD-00000001,"'=HYPERLINK(""http://evil"")"",TOUR,DRAFT,,,,,2026-09-10T12:59:43.390Z
```

---

## 8. Runtime Verification

- Real backend runtime via `npm run test:e2e` (Nest app + real HTTP + isolated per-suite template database, migrations applied).
- Representative export surface with user-controlled text: **Catalog products export** (`GET /api/v1/products/export`), per prompt §13 preference.
- Raw bytes inspected (BOM, protected representation) and parsed with an RFC-4180 parser; protected cell stays a text cell; normal strings/numbers verbatim.
- 401/403/scope verified unchanged (§13). Shared-serializer coverage: every CSV export surface (Orders, Bookings, Requests, Payments, Products, Customers, Partners, Support, Customer 360) serializes through the single `csvEscape` choke point, so representative-endpoint proof extends to all surfaces (prompt §11).

---

## 9. Security Verification

- Formula-leading payloads cannot escape through the shared serializer: guard runs on every string cell before quoting.
- Quote/quote-doubling and comma/newline escaping remain correct (§7/§8 readback).
- No CSV syntax regression: header + data rows parse to identical cell values, column count/order preserved.
- Numeric/text semantics preserved: `-12.50`, `+1`, negative runtime numbers, booleans all verbatim.

---

## 10. Regression

| Suite | Result |
|---|---|
| `export-formula-guard.spec.ts` (focused) | 10/10 PASS |
| D8 `date-param.spec.ts` | PASS |
| D8 `date-param.registry-matrix.spec.ts` | PASS |
| D8 `temporal.spec.ts` | PASS |
| D9-F1 e2e (runtime proof) | 3/3 PASS |
| `tsc --noEmit` (backend typecheck) | PASS (exit 0) |

Known unrelated historical failure (`az-AZ` NBSP `formatPrice`) untouched and not re-classified.

---

## 11. Remaining D9 Findings

Unchanged classification, not closed, not reassessed (prompt §18):

- **D9-F2** — Payments Code + Reference (informational)
- **D9-F3** — Booking `serviceDate` representation (informational)
- **D9-F4** — XLSX readback test debt (informational)
- **D9-F5** — export throttling (informational/non-blocking)

---

## 12. Verdict

```text
D9-F1 VERDICT: A — D9-F1 REMEDIATED

D9-F1 = CLOSED
D9 overall = PENDING FINAL CLOSURE
```

All §17 VERDICT A gates satisfied: mitigation works (unit + readback), raw CSV inspection performed, representative live-endpoint export proof executed against the real runtime, no CSV syntax regression, numeric/text semantics preserved, no unrelated scope changes, Git closure recorded below. Not D9 final closure; D9 not marked APPROVED; D10 not started (prompt §19).

---

## 13. Git Closure

Commit: scoped to D9-F1 remediation only — `fix(export): guard CSV text cells against formula injection (D9-F1)` (serializer + tests + prompt + this report).

```text
$ git status --short
<NO OUTPUT>            # working tree clean

$ git diff --check
<NO OUTPUT>            # no whitespace/conflict-marker errors

$ git diff --name-only (pre-commit scope)
backend/src/modules/shared/export/export.service.ts
backend/src/modules/shared/export/export-formula-guard.spec.ts  (new)
backend/test/d9-f1-csv-formula-guard.e2e-spec.ts                (new)
docs/prompts/PHASE_3_D9_F1_CSV_FORMULA_INJECTION_TARGETED_REMEDIATION_PROMPT.md (new)
docs/reports/PHASE_3_D9_F1_CSV_FORMULA_INJECTION_REMEDIATION_REPORT.md          (new)

$ git push origin master
0181639..903dd37  master -> master
```

Implementation commit (full SHA):

```text
903dd37891fca98fb8ec90e6246dfd41eb6c8fd4
```

Post-push verification:

```text
HEAD           = 903dd37891fca98fb8ec90e6246dfd41eb6c8fd4
origin/master  = 903dd37891fca98fb8ec90e6246dfd41eb6c8fd4
HEAD == origin/master: YES
Working tree:  CLEAN
```

Note: the only subsequent commit on top of this SHA is the report-only Git Closure evidence amendment (no production code), matching the repo convention for closure reports.

---

*Generated with Codebuff 🤖*
*Co-Authored-By: Codebuff <noreply@codebuff.com>*
