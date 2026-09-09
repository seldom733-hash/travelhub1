# PHASE 3 — RBAC R1/R2 — PERMISSION REGISTRY ↔ DB RECONCILIATION
## AUDIT-FIRST / GOVERNANCE RECONCILIATION PROMPT

> **Repository:** `seldom733-hash/travelhub1`  
> **Canonical repo:** `D:\travelhub_v1`  
> **Phase:** Phase 3  
> **Purpose:** reconcile the canonical permission registry/code constants with the effective database `RolePermission` grants before UI-C17 Final RBAC Full-Matrix Re-Qualification.
>
> **IMPORTANT:** This is a **reconciliation/governance task**, not permission redesign. Do not broaden or reduce role access merely to make code and DB identical. First prove the intended authority and classify every delta.

---

# 1. CONTEXT

The preceding RBAC Departmental Model Reconciliation Audit established:

- canonical model = **department-by-responsibility / cross-operational role model**;
- not strict departmental navigation isolation;
- not full access by default;
- only `ADMIN` is expected to have the complete permission set;
- `OPERATOR` is an Operations executor across:
  - Requests,
  - Orders,
  - Bookings;
- `OPERATOR` must **not** gain Payments/Finance mutation merely because Payments is Finance-owned;
- Request → Order → Booking → Payment is an operational handoff chain;
- current system contains 10 roles:
  `ADMIN`, `DIRECTOR`, `FINANCE`, `MARKETER`, `ANALYST`, `MODERATOR`,
  `SALES_MANAGER`, `OPERATOR`, `PARTNER`, `BUYER`.

The audit also found a governance delta:

- code contains **147 permission definitions**;
- effective DB contains **157 permission codes/grants**;
- there are **41 extra DB grants** versus the current code/registry representation;
- notable extras include:
  - `marketing.*` grants;
  - `support.case.read` grants;
  - `analytics.read` for `FINANCE`;
  - `order.import` for `ADMIN`;
- no missing DB grants were reported by the audit;
- the audit classified these as **governance/hygiene**, not as an automatic security escalation.

This task exists to make that conclusion evidence-based and establish the canonical registry state before UI-C17.

---

# 2. HARD RULES

## 2.1 Audit first

Do not begin by editing source or database permissions.

First inspect:

1. current permission constants/registry;
2. role definitions;
3. DB permission records;
4. DB `RolePermission` records;
5. permission guards;
6. effective-permission construction;
7. endpoint/action authorization;
8. tests/fixtures;
9. existing RBAC documentation and ADRs;
10. prior accepted reports.

Only after the complete inventory is produced may a minimal reconciliation be proposed.

---

## 2.2 Do NOT redesign RBAC

Do not:

- create new roles;
- remove roles;
- rename roles;
- invent department entities;
- introduce department-based hard isolation;
- grant every role all permissions;
- remove Operator's operational access to Requests/Orders/Bookings;
- grant Operator Payments access;
- change tenant/workspace architecture;
- change endpoint business rules;
- change action state machines;
- change UI visibility rules unless a proven registry inconsistency requires it;
- introduce new permissions merely to make counts match;
- delete DB grants merely because they are absent from code.

---

## 2.3 Authority order

Use this evidence hierarchy:

```text
1. Current source tree / executable authorization logic
2. Current DB permission + RolePermission state
3. Current tests / fixtures / security probes
4. Current RBAC registry/constants
5. Accepted architecture / ADRs
6. Accepted qualification reports
7. Historical prompts / plans
```

Do not treat an old prompt as authoritative if current executable behavior and accepted architecture contradict it.

---

# 3. R1 — COMPLETE PERMISSION INVENTORY

Build the complete current inventory.

## 3.1 Code/registry side

Identify:

- every permission constant;
- every permission registry entry;
- permission name/code;
- domain/category;
- description;
- source location;
- whether it is referenced by guards;
- whether it is referenced by UI;
- whether it is referenced by tests;
- whether it is seeded into DB.

Produce:

```text
Permission
Code
Domain
Registry
Guard usage
Endpoint/action usage
UI usage
Test usage
DB seed usage
```

---

## 3.2 Database side

Inspect the actual current database schema/data used by the project.

Identify:

- all permission records;
- all `RolePermission` records;
- all roles;
- all grants;
- whether duplicate/stale grants exist;
- whether disabled/deprecated fields exist;
- whether permissions exist in DB without a corresponding code constant;
- whether code permissions exist without DB records.

Do not assume the report's previous counts are still current. Recalculate them.

---

# 4. R1 — EXACT RECONCILIATION MATRIX

Create a matrix for **every permission code appearing in either source or DB**.

Required columns:

| Permission | Code Registry | DB Permission | DB Role Grants | Guard/Usage | Tests | Classification | Action |
|---|---|---|---|---|---|---|---|

Classification MUST use one of:

```text
MATCH
CODE_ONLY
DB_ONLY
REGISTRY_ONLY
DUPLICATE
STALE
INTENTIONAL_EXTRA
UNRESOLVED
```

For role grants additionally classify:

```text
EXPECTED GRANT
EXPECTED DENY
MISSING GRANT
EXCESS GRANT
GOVERNANCE / UNRESOLVED
```

Do not classify a DB-only grant as `EXCESS GRANT` solely because code does not list it.

---

# 5. R1 — ROLE × PERMISSION DELTA

Build the complete current matrix:

```text
ALL CURRENT ROLES
×
ALL CURRENT PERMISSIONS
```

At minimum:

```text
ADMIN
DIRECTOR
FINANCE
MARKETER
ANALYST
MODERATOR
SALES_MANAGER
OPERATOR
PARTNER
BUYER
```

For each cell record:

```text
EXPECTED
ACTUAL
DELTA
EVIDENCE
```

Where:

```text
EXPECTED = GRANT
EXPECTED = DENY
ACTUAL = GRANT
ACTUAL = DENY
```

Then classify:

```text
MATCH
MISSING GRANT
EXCESS GRANT
UNRESOLVED
```

This matrix is a **preparation artifact for UI-C17**, not the final UI-C17 qualification itself.

Do not claim UI-C17 is completed.

---

# 6. R1 — SPECIAL RECONCILIATION TARGETS

Explicitly inspect and resolve the following.

## 6.1 `marketing.*`

Previous audit found approximately 10 marketing permission codes represented in DB but not in the current registry.

Determine:

1. Are these real current permissions?
2. Are they referenced by executable guards?
3. Are they used by endpoints?
4. Are they used by current UI?
5. Are they documented as valid permissions?
6. Are the DB grants active and intentional?
7. Are they historical leftovers?

Do NOT delete them automatically.

---

## 6.2 `support.case.read`

Determine why this permission exists in DB grants and whether it is:

- canonical;
- legacy;
- intentionally granted;
- represented under another current permission;
- unused/stale.

---

## 6.3 `analytics.read` for FINANCE

Determine whether this is intentional.

The architecture distinguishes:

```text
Finance ownership
```

from:

```text
Finance Center
```

and the current state is:

```text
Payments = current Finance-owned capability
Finance Center = NOT STARTED
```

Do not infer that FINANCE must or must not have analytics access solely from the Finance Center status.

Use actual architecture and current authorization evidence.

---

## 6.4 `order.import` for ADMIN

Determine whether this is an intentional ADMIN capability.

Do not remove it solely because it was absent from an earlier registry snapshot.

---

# 7. R2 — CANONICAL REGISTRY DECISION

After the evidence is collected, produce a decision for every DB-only permission.

For each one choose exactly one:

### OPTION A — CANONICAL

The permission is valid and current.

Then:

- add it to the canonical permission registry/constants if appropriate;
- preserve current grants;
- document its domain and purpose;
- add/update tests if necessary.

### OPTION B — LEGACY / STALE

The permission is proven obsolete.

Then:

- do NOT delete it immediately unless safe removal is proven;
- document affected roles;
- document endpoint/guard usage;
- document migration/removal requirements;
- if deletion is safe and explicitly within this task's approved minimal scope, remove it with tests.

### OPTION C — GOVERNANCE UNRESOLVED

Evidence is insufficient.

Then:

- preserve current runtime grants;
- do not silently remove access;
- register a governance debt;
- do not block unrelated RBAC unless the delta is demonstrably security-critical.

---

# 8. IMPORTANT SECURITY RULE

The following are NOT equivalent:

```text
DB grant exists
```

and:

```text
user can successfully perform protected action
```

For every suspicious grant, verify the complete chain:

```text
Role
 ↓
RolePermission
 ↓
Effective permissions
 ↓
Guard
 ↓
Controller endpoint
 ↓
Service/action authority
 ↓
Object/workspace scope
```

A permission that exists but has no reachable protected action must not automatically be treated as an effective security escalation.

Conversely, an endpoint reachable without the expected permission is a security defect even if the registry looks correct.

---

# 9. OPERATOR MUST BE EXPLICITLY PROTECTED

The reconciliation MUST verify that these are expected:

```text
OPERATOR
Requests      = operational access
Orders        = operational access
Bookings      = operational access
Payments      = no access
Finance mut.  = no access
```

Do not classify the three operational domains as excess grants.

This is the established departmental handoff model.

---

# 10. FULL-ACCESS-BY-DEFAULT CHECK

Explicitly verify whether any mechanism exists that effectively grants:

```text
all permissions
```

to every role.

Inspect:

- default role creation;
- seed scripts;
- permission assignment code;
- guards;
- fallback behavior;
- role provisioning;
- test fixtures;
- bootstrap logic.

Expected conclusion based on prior audit:

```text
FULL ACCESS BY DEFAULT = DISPROVEN
```

But this MUST be re-proven from current source/DB state, not copied from the previous report.

---

# 11. TEST REQUIREMENTS

Before finalizing any change:

## Required tests

1. Permission registry tests.
2. Role-permission assignment tests.
3. Guard tests.
4. Representative positive authorization tests.
5. Representative negative authorization tests.
6. Operator negative Payments/Finance probes.
7. Cross-role authorization probes.
8. Cross-tenant/workspace probes where applicable.
9. Existing RBAC regression suite.

If permissions are added to the registry:

- test that they are recognized;
- test their intended role assignments;
- test at least one guarded usage if one exists.

If permissions are removed:

- prove no valid endpoint/action depends on them;
- test that intended access remains intact.

---

# 12. UI CONSISTENCY CHECK

This task does not redesign UI.

However, verify that permission reconciliation does not break the established chain:

```text
server permission
→ availableActions
→ UI action visibility
```

For Request:

```text
availableActions
```

remains the authoritative action projection.

For Order/Booking:

preserve the existing server-authoritative model.

Do not introduce local role/status logic.

---

# 13. TENANT / WORKSPACE ISOLATION

Do not weaken isolation.

Verify that reconciliation preserves:

- tenant isolation;
- workspace isolation;
- object scope;
- partner/buyer own-scope rules;
- platform versus partner boundaries.

A permission grant is not sufficient to authorize access to another tenant/workspace.

---

# 14. CHANGE POLICY

## If no code change is required

Preferred outcome.

Produce a reconciliation report only.

## If registry update is required

Keep it minimal:

- update only the canonical permission registry/constants;
- add required metadata/tests;
- no unrelated production refactor.

## If DB migration is required

STOP before destructive DB changes.

First produce:

```text
WHY
WHAT
WHICH ROLES
WHICH PERMISSIONS
WHY SAFE
ROLLBACK
TEST EVIDENCE
```

and explicitly classify the change as requiring approval.

Do not silently delete grants.

---

# 15. REQUIRED REPORT

Create:

```text
docs/reports/PHASE_3_RBAC_R1_R2_PERMISSION_REGISTRY_DB_RECONCILIATION_REPORT.md
```

The report MUST contain:

```text
1. Executive Summary
2. Baseline / HEAD / origin
3. Source-of-Truth Analysis
4. Code Permission Inventory
5. DB Permission Inventory
6. Complete Permission Reconciliation Matrix
7. Complete Role × Permission Delta Matrix
8. marketing.* Analysis
9. support.case.read Analysis
10. analytics.read / FINANCE Analysis
11. order.import / ADMIN Analysis
12. Operator Verification
13. Full-Access-by-Default Verification
14. Guard / Endpoint Verification
15. Tenant / Workspace Verification
16. Test Evidence
17. Changes Made
18. Changes Explicitly NOT Made
19. Remaining Governance Items
20. Readiness for UI-C17
21. Final Verdict
22. Git State
```

---

# 16. FINAL VERDICT RULES

Use exactly one:

### VERDICT A — RECONCILIATION ACCEPTED

Use only if:

- all code/DB permission differences are classified;
- all current role grants are classified;
- suspicious grants have evidence-based decisions;
- no unexplained effective authorization escalation remains;
- Operator model is preserved;
- full-access-by-default remains disproven;
- tests pass;
- no unintended source changes exist.

### VERDICT B — VALID SYSTEM / GOVERNANCE BLOCKER

Use if:

- runtime security behavior is valid;
- but one or more permission-registry/DB decisions remain unresolved;
- and UI-C17 should wait for governance resolution.

### VERDICT C — SECURITY DEFECT

Use if:

- a role has an unintended effective permission;
- an endpoint is reachable without the expected permission;
- a forbidden role can mutate protected data;
- tenant/workspace isolation is bypassed;
- or UI/server authority diverges in a security-relevant way.

Do not downgrade a proven security defect to governance.

---

# 17. UI-C17 GATE

At the end explicitly state:

```text
UI-C17 STATUS = NOT EXECUTED
```

Then state one of:

```text
UI-C17 READY
```

or

```text
UI-C17 BLOCKED
```

UI-C17 is READY only when the complete current permission universe and role grants are sufficiently reconciled to support a deterministic full-matrix qualification.

The purpose of R1/R2 is to prevent UI-C17 from comparing against an ambiguous permission universe.

---

# 18. GIT REQUIREMENTS

At the end report:

```text
HEAD
origin/master
git status --short
tracked diff
untracked files
```

Historical untracked process artifacts may remain if they are known and harmless, but do not call the repository globally clean if they are present.

If production/registry changes were made:

- commit them;
- push them;
- verify `HEAD == origin/master`;
- report the final SHA.

If this is audit-only with no source changes, do not create an artificial functional commit solely for the sake of a SHA.

---

# 19. STOP CONDITIONS

STOP and report instead of improvising if:

- the DB schema is materially different from the expected RBAC model;
- permission ownership is ambiguous;
- a DB-only permission is actively used by an unknown endpoint;
- removing a grant may break a production workflow;
- a new permission/role would be required;
- tenant/workspace scope cannot be proven;
- a security-relevant mismatch is discovered;
- current code and accepted architecture materially conflict.

Do not solve an architectural conflict by inventing a new model inside R1/R2.

---

# 20. SUCCESS CRITERIA

R1/R2 is successful when we have:

```text
Code Permission Universe
        +
DB Permission Universe
        ↓
Exact Reconciliation
        ↓
Role × Permission Delta
        ↓
Every Delta Classified
        ↓
Suspicious Grants Explained
        ↓
No Unintended Effective Escalation
        ↓
Operator Model Preserved
        ↓
Full Access by Default Disproven
        ↓
Tests PASS
        ↓
UI-C17 READY
```

## FINAL PRINCIPLE

**Reconcile the permission model before qualifying it.**

Do not make permissions look consistent by changing behavior blindly.

The objective is to establish the **actual canonical permission universe and intended role matrix**, with evidence strong enough that UI-C17 can subsequently perform the final:

```text
ALL CURRENT ROLES × ALL CURRENT PERMISSIONS
EXPECTED vs ACTUAL
```

without ambiguity.
