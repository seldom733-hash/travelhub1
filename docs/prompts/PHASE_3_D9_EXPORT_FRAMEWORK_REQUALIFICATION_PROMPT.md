# PHASE 3 — D9 — EXPORT FRAMEWORK REQUALIFICATION
## Audit-First Prompt
### Canonical NEXT after D8 closure

> **Mode:** REQUALIFICATION / AUDIT FIRST
>
> **Purpose:** determine the real current state of the TravelHub Export Framework against the canonical architecture, roadmap, reference-number, temporal, security, scope, and presentation contracts.
>
> **Important:** This is NOT permission to rewrite the export subsystem. First prove the current state. Production changes are allowed only after a concrete requalification finding establishes that they are required.

---

# 1. CANONICAL ROADMAP GATE

Before any action:

1. Read:
   - `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
   - `docs/prompts/TRAVELHUB_MASTER_ROADMAP.md`
   - `docs/architecture/TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md`
   - relevant export/reference/temporal architecture documents.
2. Verify:
   - D8 = ACCEPTED / CLOSED;
   - D9 = current TRUE NEXT;
   - D10/D11/D12/D13/D14 are downstream;
   - no earlier prerequisite remains open.
3. Do not begin D10 or D11.
4. Do not invent a new export architecture before auditing the current one.

---

# 2. D9 OBJECTIVE

Requalify the existing Export Framework.

Determine whether it already satisfies the current canonical requirements for:

- export architecture;
- CSV/XLSX generation;
- entity/reference presentation;
- canonical `referenceNumber`;
- temporal fields;
- filter/period semantics;
- scope/tenant isolation;
- RBAC;
- pagination / bounded export behavior;
- localization;
- numeric/money/date formatting;
- column semantics;
- backward compatibility;
- runtime correctness;
- large-data behavior;
- filename/content metadata;
- error handling.

D9 is primarily a **requalification debt**, not an invitation to rebuild exports.

---

# 3. AUTHORITY HIERARCHY

Use this order:

1. Current source tree + actual Git
2. Current tests/runtime evidence
3. Canonical schema/API/domain contracts
4. Accepted architecture/governance decisions
5. Canonical roadmap and Debt Register
6. Historical reports/prompts

Where sources conflict:

- record the conflict;
- identify the higher-authority source;
- do not silently rewrite lower-authority evidence.

---

# 4. MANDATORY CURRENT CONTRACTS

## 4.1 Reference Number Contract

Current canonical presentation contract:

- internal UUID = relational/security identity;
- legacy business `code` may remain internally but is not the canonical displayed reference where `referenceNumber` exists;
- `referenceNumber` is the canonical human-readable business identifier for UI/search/support/exports;
- URL identifier semantics remain entity-specific.

For current commerce entities verify:

```text
Order     → MKT-ORD-* or tenant-aware canonical reference
Booking   → MKT-BKG-* or tenant-aware canonical reference
Payment   → MKT-PAY-*-N or tenant-aware canonical reference
Refund    → MKT-REF-* or tenant-aware canonical reference
```

Do not allow exports to reintroduce competing legacy identifiers merely because the backend still exposes `code`.

---

# 5. EXPORT INVENTORY

Discover all current export capabilities.

Search for:

```text
export
CSV
XLSX
xlsx
csv
Content-Disposition
text/csv
application/vnd
ExcelJS
SheetJS
workbook
worksheet
download
toCsv
toXlsx
```

Build:

| Export | Surface | Entity | Format | Endpoint/action | Scope | Status |
|---|---|---|---|---|---|---|

Include exports from:

- Orders;
- Bookings;
- Payments;
- CRM;
- Customer 360;
- Requests;
- Catalog where applicable;
- Analytics/Operations where actual exports exist.

Do not assume the list is complete until repository search confirms it.

---

# 6. EXPORT CONTRACT MATRIX

For each export:

| Export | Columns | Canonical reference | Legacy code leakage | Dates | Money | Scope | i18n | Status |
|---|---|---|---|---|---|---|---|---|

Explicitly compare:

- API DTO;
- mapper;
- export row builder;
- CSV serializer;
- XLSX serializer;
- UI column labels;
- download filename.

---

# 7. CANONICAL IDENTIFIER RULE

Exports must not silently mix:

```text
id
code
number
referenceNumber
```

Determine the intended role of each field.

For each exported identifier answer:

```text
What is it?
Why is it exported?
Is it canonical?
Could it be mistaken for another business identifier?
```

Where the canonical reference contract requires `referenceNumber`, legacy `code` should not be presented as the primary business reference.

Do not delete a technical identifier if it is explicitly required for support/audit/integration; classify it correctly as technical rather than business reference.

---

# 8. TEMPORAL CONTRACT

D9 must consume D8 temporal contracts.

Verify:

- date-only fields preserve date-only semantics;
- UTC instants are not rendered as local business dates accidentally;
- service date/time/timezone remain distinct;
- `from/to` filter semantics match canonical `[from,to)` behavior where applicable;
- export date fields correspond to the documented entity temporal dimension;
- no export creates a second temporal interpretation.

Do not change KPI semantics; D11 owns KPI definitions.

---

# 9. EXPORT SCOPE / TENANT ISOLATION

This is a hard security gate.

For every export endpoint/action verify server-side:

- authentication;
- permission;
- role;
- workspace/tenant scope;
- Partner own-scope;
- Storefront isolation;
- Platform Marketplace scope;
- object visibility.

Critical tests:

```text
Partner A export → no Partner B rows
Storefront A export → no Storefront B rows
Partner export → no Platform-only/private data
Platform export → no forbidden Storefront records
```

Never rely on frontend-selected columns or filters for authorization.

---

# 10. SEARCH / FILTER CONSISTENCY

Verify whether export respects the same authoritative filters as the corresponding registry.

For each export compare:

```text
UI filters
→ query params
→ controller
→ service
→ query
→ export dataset
```

Test:

- search;
- status;
- dateFrom/dateTo;
- pagination or full-dataset export semantics;
- sorting where promised;
- tenant/scope filters;
- entity relationship filters.

An export must not silently ignore a UI filter that users reasonably expect to apply.

If full-export intentionally ignores pagination, document that explicitly.

---

# 11. EXPORT DATASET VS TABLE DATASET

Determine whether each export represents:

1. the exact current table dataset;
2. the current filtered registry dataset;
3. a separate reporting dataset/read model;
4. an independent aggregation.

Do not force all exports to mirror UI tables if a documented business/reporting contract says otherwise.

But any intentional difference must be explicit.

---

# 12. COLUMN SEMANTICS

Audit every column.

Requirements:

- user-visible column labels localized where appropriate;
- no raw enum where user-friendly label is required;
- no raw JSON where structured columns or readable text are expected;
- no duplicate competing business-reference columns;
- no accidental internal IDs;
- no secret/token/password/payment-sensitive fields;
- no hidden backend fields leaking into downloads.

For every suspicious column classify:

```text
CANONICAL
TECHNICAL
LEGACY
DUPLICATE
SENSITIVE
UNINTENTIONAL
```

---

# 13. MONEY FORMATTING

Exported money must follow an explicit contract.

Check:

- decimal precision;
- currency code;
- currency symbol where intended;
- locale formatting;
- zero semantics;
- null semantics;
- no floating-point drift.

Distinguish:

```text
machine/data export
```

from:

```text
human-readable localized export
```

Do not assume the same serialization is required for both.

---

# 14. DATE / TIME FORMATTING

Classify each exported temporal value:

```text
DATE_ONLY
UTC_INSTANT
LOCAL_SERVICE_TIME
LOCAL_SERVICE_DATE
PERIOD_BOUNDARY
EVENT_TIME
```

Verify:

- timezone is not lost where business meaning requires it;
- service-local time is not replaced by browser-local time;
- date-only values do not acquire unwanted time-of-day;
- exported period boundaries remain reproducible;
- DST/cross-midnight semantics are not destroyed.

---

# 15. CSV CONTRACT

Audit:

- delimiter;
- quoting;
- escaping;
- newline handling;
- UTF-8 encoding;
- BOM behavior if required by existing compatibility;
- formula injection risks;
- commas/quotes/newlines inside data;
- deterministic column order;
- deterministic headers;
- empty/null values.

Security:

Any spreadsheet formula injection risk must be addressed by a safe canonical strategy for user-controlled strings such as:

```text
=
+
-
@
```

Do not break legitimate data semantics without documenting the chosen mitigation.

---

# 16. XLSX CONTRACT

Audit:

- workbook creation;
- worksheet names;
- column order;
- data types;
- date cells;
- numeric cells;
- currency values;
- formulas;
- hidden sheets;
- metadata;
- formula injection risk;
- memory behavior for large exports.

Determine whether XLSX contains:

- raw values;
- formulas;
- calculated values;
- styled presentation.

Do not introduce unnecessary styling if not required by the contract.

---

# 17. LARGE EXPORT / PERFORMANCE REQUALIFICATION

Determine current export strategy:

- load-all-rows;
- paged chunks;
- streaming;
- cursor iteration;
- temporary file;
- in-memory buffer.

Measure/inspect behavior for representative large datasets.

Minimum questions:

1. Does export memory scale linearly with dataset size?
2. Can a large export exhaust Node heap?
3. Are DB queries bounded?
4. Is export generation blocking normal API work?
5. Are timeouts plausible?
6. Are huge exports allowed without rate/permission controls?

Do not introduce a queue/job system unless the current architecture requires it and the evidence supports the need.

---

# 18. ERROR CONTRACT

Verify:

- unauthorized export;
- forbidden export;
- invalid filters;
- invalid dates;
- invalid enum;
- empty result;
- backend failure.

Exports must not return raw ORM/database errors to users.

Temporal filter errors must preserve D8 canonical validation semantics.

---

# 19. LOCALIZATION

Current project supports RU/AZ/EN.

Audit:

- export column headers;
- enum/status labels;
- money/date formatting where human-readable;
- filenames where localized;
- fallback behavior.

Do not translate technical IDs/reference numbers.

---

# 20. BACKWARD COMPATIBILITY

Find existing export consumers/tests/docs.

Determine:

- whether column changes break CSV/XLSX consumers;
- whether legacy column names are contractual;
- whether removing legacy duplicate columns is already mandated by accepted reference-number remediation.

Do not preserve a known-bad duplicate simply because an old report mentions it.

---

# 21. SECURITY / PII

Explicitly inspect for leakage of:

- passwords;
- access tokens;
- reset tokens;
- internal auth fields;
- payment credentials;
- private tenant data;
- unauthorized contacts;
- unnecessary PII;
- internal moderation/private notes where not allowed.

Export permission must not be broader than corresponding read permission without explicit canonical authority.

---

# 22. RUNTIME QUALIFICATION

Use actual runtime/browser evidence for representative exports.

Minimum:

- Orders CSV;
- Orders XLSX if supported;
- Bookings CSV/XLSX if supported;
- Payments export;
- Customer 360 export;
- one Partner/tenant-scoped export;
- one negative authorization scenario;
- one invalid-date scenario;
- one representative large dataset.

Verify downloaded content, not merely HTTP 200.

For each:

```text
URL/action
HTTP status
Content-Type
filename
column headers
representative rows
scope
format correctness
```

---

# 23. AUTOMATED TESTS

Run:

- export unit tests;
- export integration/e2e;
- reference-number tests;
- temporal tests;
- security/tenant tests;
- CSV parser/readback tests;
- XLSX readback tests;
- frontend export tests;
- backend typecheck;
- frontend typecheck;
- production build.

Where XLSX is used, actually parse the generated workbook back in tests and inspect cells.

---

# 24. REQUALIFICATION OUTCOMES

## VERDICT A — EXPORT FRAMEWORK QUALIFIED

Use if:

- canonical contracts pass;
- no material reference leakage;
- temporal semantics correct;
- tenant/security isolation proven;
- current exports are consistent with accepted contracts;
- runtime output is correct;
- tests/build/typecheck pass;
- performance is acceptable for the current contract;
- no unresolved P0/P1 export issue remains.

Production code may remain unchanged.

## VERDICT B — VALID SYSTEM FAIL / REMEDIATION REQUIRED

Use if implementation is largely correct but one or more concrete export defects/gaps remain.

Produce an exact remediation matrix:

| Finding | Severity | Contract | Affected exports | Fix |
|---|---|---|---|---|

Only then may targeted remediation be proposed.

Do not execute broad refactors.

## VERDICT C — ARCHITECTURE DECISION REQUIRED

Use if the export contract itself is ambiguous/conflicting, e.g.:

- conflicting canonical column semantics;
- conflicting tenant export authority;
- unresolved machine-vs-human export contract;
- unresolved temporal interpretation;
- unresolved compatibility policy.

Stop at the architecture conflict.

---

# 25. PRODUCTION CHANGE RULE

This prompt is requalification-first.

Therefore:

### First pass

Audit only.

### If A

No code change needed.

### If B

Do NOT immediately fix everything.

First create the requalification report with exact findings.

Then a separate targeted remediation prompt may be created.

### If C

Stop and request architecture decision.

---

# 26. REQUIRED REPORT

Create:

```text
docs/reports/PHASE_3_D9_EXPORT_FRAMEWORK_REQUALIFICATION_REPORT.md
```

Structure:

```text
# PHASE 3 — D9 Export Framework Requalification Report

## 1. Executive Summary
## 2. Baseline SHA
## 3. Canonical Sources
## 4. Export Inventory
## 5. Export Contract Matrix
## 6. Identifier / Reference Number Audit
## 7. Temporal Audit
## 8. Scope / Tenant / RBAC Audit
## 9. Filter Consistency
## 10. Column Semantics
## 11. CSV Audit
## 12. XLSX Audit
## 13. Performance / Large Export Audit
## 14. Localization
## 15. Security / PII
## 16. Runtime Evidence
## 17. Automated Test Evidence
## 18. Findings / Remediation Matrix
## 19. Final Verdict
## 20. Roadmap / TRUE NEXT
## 21. Git Closure
```

---

# 27. FINAL ACCEPTANCE MATRIX

| Gate | Result | Evidence |
|---|---|---|
| Export inventory complete | PASS/FAIL | ... |
| ReferenceNumber canonical | PASS/FAIL | ... |
| Legacy identifier leakage | PASS/FAIL | ... |
| Temporal semantics | PASS/FAIL | ... |
| Filter consistency | PASS/FAIL | ... |
| Tenant isolation | PASS/FAIL | ... |
| RBAC | PASS/FAIL | ... |
| PII/security | PASS/FAIL | ... |
| CSV | PASS/FAIL | ... |
| XLSX | PASS/FAIL/N/A | ... |
| Localization | PASS/FAIL | ... |
| Large export behavior | PASS/FAIL | ... |
| Browser/runtime | PASS/FAIL | ... |
| Automated tests | PASS/FAIL | ... |
| Typecheck/build | PASS/FAIL | ... |
| Architecture consistency | PASS/FAIL | ... |
| Git closure | PASS/FAIL | ... |

---

# 28. ROADMAP CLOSURE

D9 cannot be marked `APPROVED / CLOSED` unless the requalification report demonstrates it.

If D9 = A:

- update canonical roadmap status;
- identify the exact next TRUE NEXT;
- do NOT start the next step in the same pass.

If D9 = B:

- leave D9 open;
- create targeted remediation task only after report;
- next roadmap item remains blocked.

If D9 = C:

- stop at architecture decision.

---

# 29. GIT CLOSURE

Before completion:

```bash
git status --short
git diff --check
git diff --stat
git diff --name-only
git rev-parse HEAD
git rev-parse origin/master
```

After any permitted changes:

```bash
git push origin master
git status --short
git rev-parse HEAD
git rev-parse origin/master
```

Require:

```text
HEAD == origin/master
working tree clean
```

Record exact SHA.

Do not mix unrelated D10/D11/Finance/Product work into D9.

---

# 30. FINAL RESPONSE FORMAT

```text
D9 REQUALIFICATION VERDICT: A / B / C

Canonical D9:
Export Framework Requalification

Export inventory:
...

Reference-number contract:
...

Temporal contract:
...

Filter consistency:
...

Tenant/security:
...

CSV:
...

XLSX:
...

Performance:
...

Runtime:
...

Tests:
...

Production changes:
NONE / DETAILS

Findings:
NONE / DETAILS

Final SHA:
...

origin/master:
...

Working tree:
CLEAN / DIRTY

Roadmap D9:
APPROVED / NOT APPROVED

TRUE NEXT:
...

Report:
docs/reports/PHASE_3_D9_EXPORT_FRAMEWORK_REQUALIFICATION_REPORT.md
```

---

# 31. HARD STOP CONDITIONS

Do not claim `VERDICT A` when:

- export inventory is incomplete;
- a canonical reference is replaced by legacy `code` without authority;
- temporal semantics are ambiguous;
- tenant isolation is not proven;
- export permission is broader than the read authority without justification;
- browser/runtime output has not been inspected where runtime qualification is required;
- generated XLSX has not been read back where XLSX exists;
- large export behavior is unknown when a representative large dataset exists;
- final Git SHA is missing;
- roadmap status is inconsistent.

The purpose of D9 is to qualify the existing export framework against the now-canonical TravelHub contracts, not to create a new export system by assumption.
