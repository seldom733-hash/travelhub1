# PHASE 3 — D9 FINAL CLOSURE & REQUALIFICATION
## Export Framework Final Qualification Prompt
### Follow-up after D9-F1 Remediation — VERDICT A

> **Mode:** FINAL CLOSURE / REQUALIFICATION ONLY  
> **Objective:** establish whether D9 can be formally CLOSED and the roadmap advanced to the canonical TRUE NEXT.  
> **Do not introduce new product scope.**

## 1. Current State

D9-F1 has been remediated:

```text
D9-F1 = CLOSED
VERDICT A — D9-F1 REMEDIATED
```

Reported implementation commit:

```text
903dd37891fca98fb8ec90e6246dfd41eb6c8fd4
```

Reported final HEAD/origin:

```text
fea240cd20e6edeee537e86a2568167e0eac0ead
```

The remediation report states that the later SHA is a report-only closure-evidence amendment.

D9 as a whole remains:

```text
PENDING FINAL CLOSURE
```

This pass must independently requalify the complete D9 contract and, only if all gates pass, close D9.

## 2. Governing Sources

Read first:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
docs/prompts/TRAVELHUB_MASTER_ROADMAP.md
docs/architecture/TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md
docs/reports/PHASE_3_D9_EXPORT_FRAMEWORK_REQUALIFICATION_REPORT.md
docs/reports/PHASE_3_D9_F1_CSV_FORMULA_INJECTION_REMEDIATION_REPORT.md
```

The canonical roadmap is authoritative for D9 closure and the next TRUE NEXT.

## 3. Scope

This is a final closure/requalification pass.

Do NOT redesign ExportService, change API contracts, schema/migrations, RBAC, D8 temporal logic, identifiers, XLSX architecture, or add unrelated scope.

Only change production code if a genuine D9 blocker/regression is discovered.

## 4. D9-F1 Security Closure

Re-verify the previous remediation:

- shared `ExportService.csvEscape` remains the single CSV choke point;
- text beginning with `= + - @` is protected;
- leading tab/CR/LF behavior remains protected;
- RFC-4180 escaping remains correct;
- runtime numeric values remain unmodified;
- strict machine-number strings retain intended semantics;
- all CSV exporters use the shared serializer.

Run focused D9-F1 tests and one representative live runtime export.

Do not simply trust the previous report.

## 5. D9-F2 — Payments Code + Reference

Current classification:

```text
Informational / non-blocking
```

Verify:

```text
referenceNumber = canonical business-facing reference
Code = technical/legacy field where explicitly retained
```

Confirm URLs, exports and UI do not improperly promote legacy Code over referenceNumber.

Do not remove Code merely for cosmetic uniformity.

## 6. D9-F3 — Booking serviceDate Representation

Current classification:

```text
Informational / non-blocking
```

Verify:

- D8 date parsing remains authoritative;
- serviceDate remains semantically correct;
- UTC/timezone behavior remains contract-compliant;
- prior non-midnight values do not represent data loss or functional failure.

Do not normalize historical/service data only for cosmetic consistency.

## 7. D9-F4 — XLSX Readback Test Debt

Current classification:

```text
Informational / test debt
```

Verify:

- XLSX is structurally valid/readable;
- values remain values/strings, not attacker-controlled formulas;
- no formula-execution exposure exists;
- representative headers/cells remain correct.

A lightweight automated readback test may be added only if trivial under current project conventions. Do not start an XLSX redesign.

## 8. D9-F5 — Export Throttling

Current classification:

```text
Informational / non-blocking
```

Verify that current scale/query behavior does not demonstrate uncontrolled resource exhaustion and that no roadmap requirement presently mandates queued/asynchronous export processing.

Do not invent load infrastructure or add rate limiting without evidence.

## 9. Complete Export Inventory

Reconfirm the actual current route inventory from the repository rather than copying the previous count mechanically.

The prior D9 audit covered:

- Orders
- Bookings
- Requests
- Payments
- Products / Catalog
- Customers
- Partners
- Customer 360 surfaces
- Support cases
- Users
- Partner performance

There is a counting discrepancy in the previous wording (13 endpoints versus the expanded list including multiple Customer 360 surfaces). Resolve the actual current endpoint count from source.

For every export route verify:

- authentication;
- permission parity;
- tenant/storefront/partner scope;
- date parsing;
- filters;
- reference semantics;
- shared CSV serializer;
- XLSX path where applicable;
- status/content type.

## 10. Security / Scope

Re-run representative checks:

```text
anonymous → 401
unauthorized role → 403
authorized partner own data → allowed
partner foreign data → denied/scoped away
admin/operator → allowed according to existing policy
```

No RBAC changes during this pass.

## 11. Temporal Regression

Reconfirm:

```text
malformed date → 400
valid date → accepted
consistent export temporal semantics
```

Do not redesign D8 utilities.

## 12. Reference Contract

Verify:

```text
UUID → technical/internal identifier
referenceNumber → canonical business-facing identifier
legacy code → retained only where explicitly defined
```

Payments may retain technical Code where already contractually required.

## 13. Output Integrity

CSV representative checks:

- UTF-8/BOM where required;
- RFC-4180 quoting;
- quote doubling;
- comma/newline handling;
- formula-injection protection;
- stable column count/order;
- null/empty semantics.

XLSX representative checks:

- readable workbook;
- correct worksheet;
- correct headers;
- correct values;
- no unexpected formulas.

## 14. Regression Suite

Run the smallest sufficient complete set:

- D9 export/shared serializer tests;
- D9-F1 formula guard tests;
- D9 export e2e/security tests;
- permission/scope tests;
- relevant filter/date tests;
- D8 `date-param.spec.ts`;
- D8 `date-param.registry-matrix.spec.ts`;
- D8 `temporal.spec.ts`;
- backend `tsc --noEmit`;
- relevant project build/check commands.

Known unrelated historical issue:

```text
az-AZ / NBSP formatPrice
```

remains unrelated unless evidence shows this D9 work affects it.

## 15. Runtime Evidence

Use the real runtime. At minimum verify:

1. ordinary CSV export;
2. CSV export with formula-like text;
3. XLSX export;
4. authorized scoped export;
5. unauthorized export;
6. malformed-date request.

Record endpoint, status, content type, filename, row/cell evidence, and security result.

## 16. No False Closure

Do not declare D9=A merely because F1 is fixed.

D9 may be closed only when all findings are confirmed non-blocking and the complete D9 contract is reverified.

Do not reopen F2-F5 as blockers without concrete evidence.

## 17. Final Findings Matrix

Use:

| Finding | Result | Severity | Status |
|---|---|---:|---|
| D9-F1 CSV Formula Injection | verified | P1 | CLOSED |
| D9-F2 Payments Code + Reference | verified | P3/info | ACCEPTED |
| D9-F3 serviceDate representation | verified | P3/info | ACCEPTED |
| D9-F4 XLSX readback debt | verified | P3/info | ACCEPTED |
| D9-F5 throttling | verified | P3/info | ACCEPTED |

Then, only if every gate passes:

```text
D9 VERDICT: A — CLOSED
```

## 18. Final Closure Report

Create:

```text
docs/reports/PHASE_3_D9_EXPORT_FRAMEWORK_FINAL_CLOSURE_REPORT.md
```

Required sections:

```text
# PHASE 3 — D9 Export Framework Final Closure Report

## 1. Executive Summary
## 2. Baseline and Git SHA
## 3. Scope of Final Requalification
## 4. Export Inventory
## 5. D9-F1 Security Closure
## 6. D9-F2 Identifier Contract
## 7. D9-F3 Temporal Representation
## 8. D9-F4 XLSX Readback
## 9. D9-F5 Throttling
## 10. RBAC and Tenant/Partner Scope
## 11. Temporal Regression
## 12. Output Integrity
## 13. Automated Test Results
## 14. Runtime Evidence
## 15. Findings Matrix
## 16. Final Verdict
## 17. Roadmap Reconciliation
## 18. Git Closure
```

## 19. Roadmap Reconciliation

Only if:

```text
D9 VERDICT = A — CLOSED
```

update the canonical roadmap/status documentation:

```text
D9 = CLOSED
D9-F1 = CLOSED
D9-F2 = ACCEPTED
D9-F3 = ACCEPTED
D9-F4 = ACCEPTED
D9-F5 = ACCEPTED
```

Resolve the next stage strictly from:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Do not assume D10 is the next stage merely because it is numerically next.

Record:

```text
TRUE NEXT = <canonical roadmap stage>
```

## 20. Git Closure

Before commit:

```bash
git status --short
git diff --check
git diff --stat
git diff --name-only
```

Expected changes should be limited to the final D9 closure report, roadmap/status reconciliation, and tests only if genuinely needed.

Then:

```bash
git commit -m "docs(d9): close export framework after final requalification"
git push origin master
```

Verify:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status --short
```

Require:

```text
HEAD == origin/master
working tree clean
```

Record the full SHA.

## 21. HARD STOP CONDITIONS

Return VERDICT B instead of A if:

- F1 regressed;
- any genuine P1/P2 D9 defect remains;
- permission/scope regression exists;
- temporal validation regressed;
- export output is structurally broken;
- a previously non-blocking finding became a real blocker;
- current route inventory reveals an unqualified export surface;
- Git closure cannot be proven.

Return VERDICT C only for a genuine architectural decision requirement.

Do not use C for ordinary implementation defects.

## 22. Required Final Response

Return:

```text
D9 FINAL VERDICT: A / B / C

D9-F1:
CLOSED / OPEN

D9-F2:
ACCEPTED / OPEN

D9-F3:
ACCEPTED / OPEN

D9-F4:
ACCEPTED / OPEN

D9-F5:
ACCEPTED / OPEN

Export inventory:
...

RBAC / scope:
PASS / FAIL

Temporal regression:
PASS / FAIL

CSV integrity:
PASS / FAIL

XLSX integrity:
PASS / FAIL

Automated tests:
...

Runtime evidence:
...

Production files changed:
...

Schema/migration/RBAC changes:
NONE / DETAILS

D9:
CLOSED / OPEN

TRUE NEXT:
...

Final SHA:
...

origin/master:
...

HEAD == origin/master:
YES / NO

Working tree:
CLEAN / DIRTY

Report:
docs/reports/PHASE_3_D9_EXPORT_FRAMEWORK_FINAL_CLOSURE_REPORT.md
```

## 23. Governance Principle

This pass exists to prove closure, not to manufacture work.

Successful outcome:

```text
D9-F1 remediation proven
+
D9-F2/F3/F4/F5 confirmed non-blocking
+
complete D9 runtime/security regression passed
+
canonical roadmap reconciled
+
Git clean and synchronized
=
D9 VERDICT A — CLOSED
```

Only then advance to the canonical TRUE NEXT.
