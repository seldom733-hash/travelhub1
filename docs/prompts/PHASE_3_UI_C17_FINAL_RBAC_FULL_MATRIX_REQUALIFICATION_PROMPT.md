# PHASE 3 — UI-C17 — FINAL RBAC FULL-MATRIX RE-QUALIFICATION
## IMPLEMENTATION / QUALIFICATION PROMPT

> Repository: `seldom733-hash/travelhub1`
> Canonical repo: `D:\travelhub_v1`
> Stage: UI-C17
>
> **Final security/authorization gate.**
>
> “Full matrix” means **ALL CURRENT ROLES × ALL CURRENT CANONICAL PERMISSIONS**, not full access for every role.

## 1. Preconditions

R1/R2 was accepted.

Canonical universe:
- 156 permissions
- 10 roles:
  `ADMIN`, `DIRECTOR`, `FINANCE`, `MARKETER`, `ANALYST`, `MODERATOR`,
  `SALES_MANAGER`, `OPERATOR`, `PARTNER`, `BUYER`

R1/R2 final SHA:
`b24a863adf6d001f5606d2417e07ce444aee3694`

R1/R2 established:
- code catalog = 156;
- migration-built DB catalog = 156;
- role grants exact-parity;
- `rbac-parity.e2e` = 11/11 PASS;
- `order.import` remains DB-only STALE governance residue and is outside the canonical 156.

UI-C17 must NOT silently promote `order.import`.

---

## 2. Objective

Qualify:

**10 roles × 156 canonical permissions = 1560 cells**

For every cell record:

`EXPECTED | ACTUAL | DELTA | CLASSIFICATION | EVIDENCE`

Classification:
- MATCH
- MISSING GRANT
- EXCESS GRANT
- UNRESOLVED

No cell may be silently omitted.

---

## 3. Architecture

The established model is:

`Role → Permissions → Work-center responsibility → Object/action scope`

It is NOT:
- one department = one isolated tab;
- full access by default.

Operational handoff:

`Sales → Request → Operations/OPERATOR → Order → Booking → Finance → Payment/settlement`

Therefore:
- OPERATOR access to Requests + Orders + Bookings is expected;
- OPERATOR Payments/Finance mutation is denied;
- ADMIN is the only role expected to have ALL_PERMISSIONS.

Do not redesign RBAC during this stage.

---

## 4. Evidence order

Use:
1. current executable source;
2. current DB Permission/RolePermission state;
3. current tests/security probes;
4. current registry/constants;
5. accepted architecture/ADRs;
6. accepted reports;
7. historical prompts.

Executable behavior outranks old prompts.

---

## 5. Baseline

Before changes record:
- HEAD
- origin/master
- `git status --short`
- `git diff --check`

Do not mix unrelated pending UI-C8 publication work into UI-C17.

---

## 6. Freeze canonical universe

Verify current registry contains exactly 156 canonical permissions.

If count differs, STOP and report precondition failure.

Do not modify permissions just to make the matrix pass.

Exclude `order.import` unless current executable evidence explicitly re-canonicalizes it.

---

## 7. Verify role universe

Verify the current production role universe.

Expected: exactly 10 roles listed above.

If a new current role exists, do not ignore it; report the universe change and re-evaluate the matrix.

If an expected role is absent, STOP.

---

## 8. Build EXPECTED matrix

Expected grants/denials come from canonical `ROLE_PERMISSIONS` plus accepted architecture.

Do not infer expected RBAC from UI visibility.

---

## 9. Build ACTUAL matrix

Actual authorization must be established from:
- DB RolePermission;
- effective permission loading;
- guard behavior.

Do not rely only on static constants.

---

## 10. Complete 1560-cell artifact

Generate a complete machine-readable artifact, preferably:

`docs/reports/evidence/PHASE_3_UI_C17_RBAC_FULL_MATRIX.csv`

Columns:

`Role, Permission, Expected, Actual, Delta, Classification, Evidence`

Validate:
- row count = 1560;
- unique `(Role, Permission)` = 1560.

Do not use “all others match” as a substitute for the final matrix.

---

## 11. Delta gate

Every non-MATCH cell requires investigation.

### MISSING GRANT
Expected grant is absent. Identify whether the cause is migration, seed, provisioning, registry, or guard. Fix only when canonical intent is proven.

### EXCESS GRANT
Actual effective grant contradicts canonical intent. Verify reachability, guard usage, architecture, and scope before revoking.

### UNRESOLVED
Use only when evidence cannot establish intended behavior. Security-relevant unresolved cells block acceptance.

---

## 12. Role-specific gates

### ADMIN
Expected all 156 grants. Verify no accidental implicit bypass is being used unless explicitly canonical.

### DIRECTOR
Verify oversight/read-oriented authority. Do not equate with ADMIN.

### FINANCE
Verify finance authority, `analytics.read`, `support.case.read`, and no unsupported operational mutation.
Finance ownership ≠ Finance Center implementation.

### MARKETER
Verify canonical `marketing.*` permissions reconciled in R1/R2.

### ANALYST
Verify analytics/read responsibilities and `support.case.read`; no unjustified mutations.

### MODERATOR
Verify moderation responsibilities only.

### SALES_MANAGER
Verify sales mutations and commerce read-only access; no unjustified operational mutations.

### OPERATOR — CRITICAL
Expected:
- Requests = operational access
- Orders = operational access
- Bookings = operational access
- Payments = NO ACCESS
- Finance mutation = NO ACCESS

Requests + Orders + Bookings MUST NOT be classified as excess access.

Direct API denial is stronger evidence than hidden navigation.

### PARTNER
Verify own-scope permissions and partner/workspace isolation; no platform-wide access.

### BUYER
Verify own-scope access; no platform operational mutation or cross-tenant leakage.

---

## 13. Effective permission chain

For representative permissions from every domain prove:

`Role → RolePermission → Effective permissions → Guard → Endpoint → Service/action → Object scope`

A DB grant with no reachable protected action is different from an effective authorization.

An endpoint reachable without its expected permission is a security defect.

---

## 14. Endpoint ↔ permission reverse audit

Enumerate all `@RequirePermissions(...)` references.

Verify:
- every guarded permission exists in the canonical registry;
- every executable permission that should protect an endpoint reaches a guard.

UI/page-gate permissions such as `marketing.read` may legitimately have no direct controller guard when their semantics are explicitly page authorization; document such exceptions.

---

## 15. UI ↔ server authority

Verify that UI does not recreate RBAC locally.

Request:
`availableActions` is authoritative.

Order/Booking:
preserve the established server-authoritative action projection.

Required relationship:

`Server allows → UI may expose`
`Server denies → UI must not expose`

Direct API calls must remain protected.

---

## 16. Tenant/workspace isolation

For scoped roles, especially PARTNER and BUYER, verify:
- same tenant/workspace → expected access;
- wrong workspace → denied;
- wrong tenant → denied;
- no data/object leakage.

Preserve platform vs partner boundaries.

---

## 17. Full-access-by-default

Inspect:
- role creation;
- provisioning;
- security service;
- seed;
- migrations;
- fallback authorization;
- default role assignment;
- test factories.

Re-prove:

`FULL ACCESS BY DEFAULT = DISPROVEN`

Expected pattern:
- 9 scoped roles;
- 1 ADMIN ALL.

---

## 18. Negative authorization probes

At minimum test:

- OPERATOR → payment.*
- OPERATOR → finance mutation
- MARKETER → order mutation
- ANALYST → order mutation
- MODERATOR → finance mutation
- SALES_MANAGER → booking mutation
- PARTNER → platform-wide data
- BUYER → platform operational mutation

Use direct API/endpoint probes where applicable.

Expected response must follow the established security contract (normally 403, or canonical 404 for object-scope concealment).

---

## 19. Positive authorization probes

Prove at least one meaningful positive permission for every role, plus critical domain permissions.

Do not rely exclusively on static DB inspection.

---

## 20. Cross-role consistency

For representative protected operations compare all 10 roles and prove differences are intentional.

No role may gain access merely because:
- a UI tab is visible;
- a frontend route exists;
- a stale DB grant exists;
- a role fallback exists;
- a test fixture provisions it incorrectly.

---

## 21. Mandatory test suites

Run:
- `rbac-parity.e2e`
- `restart-persistence.e2e`
- `auth-rbac.e2e`
- `rbac-actions.e2e`
- `rbac-partner-scope.e2e`
- `dashboard-command-center.e2e`
- `analytics-foundation.e2e`
- established RBAC/security regressions
- backend TSC
- frontend TSC
- established project build
- relevant frontend authorization/action-projection tests

Known failures may be called non-blocking only if reproduced and proven unrelated to the qualification.

---

## 22. Fix policy

UI-C17 is primarily a qualification gate.

A minimal implementation fix is allowed only when:
- canonical expected behavior is already proven;
- defect is clear;
- change is minimal;
- no architecture change is required;
- regression evidence can prove the fix.

If architecture is ambiguous, STOP.

If a security defect is found, STOP and classify:

`VERDICT C — SECURITY DEFECT`

---

## 23. order.import rule

Do not promote `order.import` into the 156-permission universe.

Do not silently delete it from dev DB.

Verify it has no executable authorization path.

If current source references it, STOP and reopen governance reconciliation.

---

## 24. Required report

Create:

`docs/reports/PHASE_3_UI_C17_FINAL_RBAC_FULL_MATRIX_REQUALIFICATION_REPORT.md`

Sections:
1. Executive Summary
2. Baseline / HEAD / origin
3. Canonical Permission Universe
4. Current Role Universe
5. 10 × 156 Full Matrix Method
6. Complete Matrix Evidence
7. Delta Analysis
8. ADMIN Qualification
9. DIRECTOR Qualification
10. FINANCE Qualification
11. MARKETER Qualification
12. ANALYST Qualification
13. MODERATOR Qualification
14. SALES_MANAGER Qualification
15. OPERATOR Qualification
16. PARTNER Qualification
17. BUYER Qualification
18. Effective Permission Chain
19. Endpoint ↔ Permission Reverse Audit
20. UI ↔ Server Authority
21. Tenant / Workspace Isolation
22. Full-Access-by-Default
23. Negative Authorization Probes
24. Positive Authorization Probes
25. Cross-Role Consistency
26. Test Evidence
27. Failures / Known Non-Blockers
28. Changes Made
29. Changes Explicitly NOT Made
30. Remaining Governance Items
31. UI-C17 Verdict
32. Git State

---

## 25. Final verdict

### VERDICT A — UI-C17 ACCEPTED

Only if:
- canonical universe = 156;
- current roles = 10;
- all 1560 cells classified;
- no MISSING GRANT;
- no unexplained EXCESS GRANT;
- no security-relevant UNRESOLVED;
- endpoint authorization correct;
- positive and negative probes pass;
- Operator model correct;
- Partner/Buyer scope correct;
- full-access-by-default disproven;
- UI/server authority consistent;
- required tests/TSC/build pass;
- no unintended changes.

### VERDICT B — VALID SYSTEM / GOVERNANCE BLOCKER

Use when runtime security is valid but unresolved governance ambiguity prevents deterministic certification.

### VERDICT C — SECURITY DEFECT

Use for:
- effective unintended permission;
- protected endpoint bypass;
- UI/server security divergence;
- tenant/workspace isolation failure;
- material authorization defect.

Document exact role, permission, endpoint, expected, actual, impact, and reproduction.

---

## 26. UI-C18 dependency

Do not execute UI-C18 as part of this stage except where a minimal fix requires it.

At the end state:

`UI-C18 = NOT EXECUTED`

unless explicitly performed.

---

## 27. Git

Record:
- HEAD
- origin/master
- `git status --short`
- `git diff --check`

If UI-C17 production changes are made:
1. commit only UI-C17 changes;
2. push;
3. verify `HEAD == origin/master`;
4. report final SHA.

Do not commit unrelated UI-C8 work.

Do not claim repository-wide cleanliness if historical untracked artifacts remain.

---

## 28. Success condition

`R1/R2 accepted`
→ `156 canonical permissions`
→ `10 current roles`
→ `1560 complete cells`
→ `EXPECTED vs ACTUAL`
→ `every cell classified`
→ `guard/endpoint verification`
→ `positive + negative probes`
→ `tenant/workspace isolation`
→ `UI/server authority`
→ `Operator departmental model`
→ `full-access-by-default disproven`
→ `regression suite`
→ `TSC`
→ `build`
→ `VERDICT A`

### Final principle

This is NOT a test to prove every role has access.

It proves that **every role has exactly the access it is supposed to have — no more and no less — across the complete current permission universe.**

**UI-C17 is the final RBAC security gate before UI-C18 Git Hard Closure.**
