# PHASE 3 — D9-F1 CSV FORMULA INJECTION TARGETED REMEDIATION
## Security Remediation Prompt
### Follow-up to D9 Export Framework Requalification — VERDICT B

> **Mode:** TARGETED IMPLEMENTATION ONLY  
> **Scope:** D9-F1 CSV Formula Injection  
> **Do not re-open unrelated D9 findings.**

---

# 1. Canonical Context

The D9 Export Framework Requalification is complete with:

```text
VERDICT B — VALID SYSTEM FAIL / REMEDIATION REQUIRED
```

The framework was found largely conformant. The single blocking finding is:

```text
D9-F1
Severity: P1 — SECURITY
CSV Formula Injection
```

The requalification report records that user-controlled string values beginning with:

```text
=
+
-
@
```

may currently be serialized verbatim into CSV exports. Affected sources include examples such as:

- product titles;
- customer/company names;
- payment method;
- support titles.

The approved remediation direction is:

```text
canonical escape-to-text strategy
→ csvEscape(...)
→ formula-leading TEXT cells protected
→ regression/readback tests
```

The previous D9 audit explicitly stopped before implementation and required a separate targeted remediation pass.

---

# 2. Governing Documents

Read before changing code:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
docs/prompts/TRAVELHUB_MASTER_ROADMAP.md
docs/architecture/TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md
docs/architecture/temporal-readiness.md
docs/reports/PHASE_3_D9_EXPORT_FRAMEWORK_REQUALIFICATION_REPORT.md
```

Also locate the current D9-F1 evidence if the report has a linked remediation/reference document.

Do not create a competing roadmap.

---

# 3. Exact Scope

Implement ONLY:

```text
D9-F1 — CSV Formula Injection Mitigation
```

Primary expected target:

```text
backend/src/modules/shared/export/export.service.ts
```

Specifically the current CSV serialization path:

```text
csvEscape(...)
→ toCsv(...)
```

Use the existing shared serializer rather than adding parallel exporters.

---

# 4. Security Requirement

The CSV output must prevent spreadsheet applications from interpreting attacker-controlled TEXT values as formulas.

At minimum, test text values beginning with:

```text
=
+
-
@
```

including values with:

- leading tab;
- leading carriage return;
- leading newline where relevant to the existing CSV parser;
- whitespace immediately before formula-leading characters if the chosen mitigation treats trimmed/normalized values specially.

The remediation must preserve valid CSV escaping for:

- commas;
- quotes;
- newlines;
- Unicode;
- empty values;
- null/undefined.

---

# 5. Critical Type/Semantics Rule

Do NOT blindly prefix every CSV cell with `'`.

The implementation MUST distinguish:

```text
TEXT / user-controlled string
```

from:

```text
NUMERIC / boolean / intentional machine data
```

The goal is to protect spreadsheet formula execution without corrupting legitimate data semantics.

Especially verify:

```text
amount = -12.50
```

when exported as a numeric machine value is not incorrectly transformed solely because it begins with `-`.

The exact implementation may depend on the current ExportService typing contract.

Inspect the current serializer and row-building code before choosing the mitigation.

---

# 6. Canonical Remediation Strategy

Preferred strategy, consistent with the D9 report:

```text
Text value beginning with a spreadsheet formula-trigger character
→ prefix with apostrophe `'`
→ preserve visible text semantics in spreadsheet applications
→ remain a text cell
```

Example conceptual transformation:

```text
=1+1
→ '=1+1

+cmd
→ '+cmd

-cmd
→ '-cmd

@cmd
→ '@cmd
```

Do not apply this blindly to legitimate numeric cells.

If the current serializer has insufficient type information to safely distinguish text from numeric values:

1. inspect the actual row construction contract;
2. prefer the narrowest safe change;
3. do not invent a broad schema/type rewrite;
4. document any unavoidable trade-off in the qualification report.

---

# 7. Injection Test Matrix

Add focused automated tests.

## Text payloads

Must cover at minimum:

```text
=1+1
+1
-1
@SUM(A1)
=cmd|' /C calc'!A0
=HYPERLINK("http://evil")
```

Also:

```text
\t=1+1
\r=1+1
\n=1+1
```

where compatible with the current serializer.

## Safe text

Verify unchanged semantics for:

```text
Hotel Antalya
Normal text
Room 2+1
A-123
email@example.com
100 USD
```

Do not classify safe ordinary hyphenated words as injection merely because they contain `-`.

## CSV syntax

Verify:

```text
Hello, world
He said "hello"
Line 1
Line 2
```

still serializes and parses correctly.

---

# 8. Regression / Readback Tests

The D9 report explicitly required readback tests for the remediation.

Implement a focused test proving:

1. the generated CSV remains valid;
2. protected cells are still text;
3. formula payloads are not emitted as executable formulas;
4. comma/quote/newline escaping remains correct;
5. column count/order remains unchanged.

Use the project's existing CSV parser/test strategy if one exists.

Do not introduce a second CSV parsing library solely for this task unless necessary.

---

# 9. XLSX Boundary

D9 requalification found no practical formula-injection exposure in current XLSX because values are written as strings/shared strings rather than formulas.

Therefore:

- do NOT rewrite the XLSX serializer;
- do NOT change XLSX architecture;
- optionally add a regression assertion only if it is trivial and already supported by the current test framework;
- do not broaden this task from CSV remediation to XLSX redesign.

---

# 10. Export Contract Preservation

The remediation MUST preserve:

- canonical `referenceNumber`;
- D8 temporal validation;
- tenant/partner scope;
- RBAC;
- existing CSV headers;
- column ordering;
- existing export endpoints;
- existing `Content-Type`;
- BOM behavior;
- filename behavior;
- localization;
- null/undefined semantics.

Do not alter business-reference semantics.

Do not touch Payments `Code` classification.

Do not alter D8 date semantics.

---

# 11. Security Scenarios

Run tests proving formula-leading payloads cannot escape through representative user-controlled export fields.

At minimum cover representative export surfaces containing text:

- Orders;
- Bookings;
- Requests;
- Payments;
- Products;
- Customers;
- Partners;
- Support;
- Customer 360 where applicable.

You do NOT need a separate implementation in every exporter if they all use the shared `ExportService`; prove shared coverage plus representative endpoint tests.

---

# 12. Adversarial Cases

Test:

```text
=1+1
 =1+1
\t=1+1
\r=1+1
'=1+1
==1+1
++1
--1
@cmd
-@cmd
```

The exact expected behavior for leading whitespace must be based on the chosen canonical mitigation and documented.

Do not create contradictory behavior across export endpoints.

---

# 13. Runtime Verification

After implementation:

1. Start the real backend/frontend runtime.
2. Generate at least one representative CSV containing attacker-controlled text.
3. Download the CSV.
4. Inspect raw bytes/text.
5. Parse the CSV.
6. Verify the protected representation.
7. Verify normal strings/numbers remain correct.

Use at least one real export endpoint, preferably Orders or Products because they contain clear user-controlled text.

Also verify:

```text
401 / 403 / scope
```

remain unchanged.

---

# 14. Automated Regression

Run:

- focused CSV/export tests;
- D9 export tests;
- D8 date validation suites;
- relevant security/tenant tests;
- backend typecheck;
- frontend typecheck if touched;
- production build if required by project governance.

Do not mark unrelated historical failures as D9 failures unless this change affects them.

The previously known `az-AZ` NBSP `formatPrice` test discrepancy remains unrelated unless evidence proves otherwise.

---

# 15. Diff Scope

Before committing:

```bash
git status --short
git diff --check
git diff --stat
git diff --name-only
```

Expected production scope should be minimal:

```text
shared ExportService / CSV serializer
focused tests
possibly D9 report
```

Reject accidental changes to:

- schema;
- Prisma;
- RBAC;
- Payments business logic;
- Orders/Bookings lifecycle;
- D8 temporal logic;
- frontend UI unrelated to exports.

---

# 16. Required Remediation Report

Create:

```text
docs/reports/PHASE_3_D9_F1_CSV_FORMULA_INJECTION_REMEDIATION_REPORT.md
```

Structure:

```text
# PHASE 3 — D9-F1 CSV Formula Injection Remediation Report

## 1. Executive Summary
## 2. Original Finding
## 3. Root Cause
## 4. Chosen Mitigation
## 5. Type/Semantic Preservation
## 6. Code Changes
## 7. Test Matrix
## 8. Runtime Evidence
## 9. Security Verification
## 10. Regression
## 11. Remaining D9 Findings
## 12. Verdict
## 13. Git Closure
```

---

# 17. Verdict Rules

This remediation pass is NOT D9 final closure.

Use:

## VERDICT A — D9-F1 REMEDIATED

Only if:

- formula injection mitigation works;
- tests prove it;
- raw CSV inspection proves it;
- representative runtime export proves it;
- no CSV syntax regression;
- numeric/text semantics are preserved;
- no unrelated scope changes occurred;
- Git is clean/synced.

This means:

```text
D9-F1 = CLOSED
D9 overall = still pending final closure
```

## VERDICT B — REMEDIATION INCOMPLETE

Use if any D9-F1 gate remains unresolved.

Name exact gap.

## VERDICT C — ARCHITECTURE DECISION REQUIRED

Use only if the existing ExportService typing/serialization contract cannot support a safe mitigation without an architectural decision.

Do not invent an architecture change.

---

# 18. D9 Remaining Findings

Do not silently close or change classification of:

```text
D9-F2 — Payments Code + Reference
D9-F3 — Booking serviceDate representation
D9-F4 — XLSX readback test debt
D9-F5 — export throttling
```

They were previously classified as non-blocking/informational.

The final D9 closure pass will reassess them only if the canonical report requires it.

---

# 19. Roadmap Rule

Do NOT mark D9 `APPROVED` in this remediation pass.

Do NOT start D10.

After successful remediation:

```text
D9-F1 = CLOSED
D9 overall = PENDING FINAL CLOSURE
```

Then a separate short D9 Final Closure / Requalification pass must establish:

```text
D9 = VERDICT A
```

before selecting the next TRUE NEXT.

---

# 20. Git Closure

After implementation and tests:

```bash
git status --short
git diff --check
git diff --name-only
git rev-parse HEAD
git rev-parse origin/master
```

Commit only scoped D9-F1 remediation.

Push:

```bash
git push origin master
```

Then verify:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
```

Require:

```text
HEAD == origin/master
working tree clean
```

Record the exact full SHA in the report.

---

# 21. Final Response

Return exactly:

```text
D9-F1 VERDICT: A / B / C

Original finding:
D9-F1 — CSV Formula Injection — P1 Security

Root cause:
...

Mitigation:
...

Text formula tests:
...

CSV readback:
...

Runtime export:
...

Numeric/text semantics:
PASS / FAIL

CSV regression:
PASS / FAIL

Representative exports:
...

Production files changed:
...

Schema/migration/RBAC:
NONE / DETAILS

Remaining D9 findings:
F2/F3/F4/F5 unchanged

Final SHA:
...

origin/master:
...

Working tree:
CLEAN / DIRTY

D9-F1:
CLOSED / OPEN

D9 overall:
PENDING FINAL CLOSURE

Report:
docs/reports/PHASE_3_D9_F1_CSV_FORMULA_INJECTION_REMEDIATION_REPORT.md
```

---

# 22. HARD STOP CONDITIONS

Do NOT claim D9-F1 closed if:

- formula-leading text remains raw in CSV;
- only unit tests pass but real CSV output was not inspected;
- CSV quoting/escaping regressed;
- numeric values were incorrectly converted to text;
- only one exporter was fixed while others bypass the shared serializer;
- RBAC/scope changed unintentionally;
- unrelated production files were modified;
- final Git SHA is missing;
- working tree is dirty.

The objective is a minimal, shared, auditable security remediation of D9-F1 — not an export framework redesign.
