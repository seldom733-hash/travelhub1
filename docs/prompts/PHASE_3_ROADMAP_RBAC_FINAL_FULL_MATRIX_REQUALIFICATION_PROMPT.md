# PHASE 3 — ROADMAP MICRO-UPDATE
## FINAL RBAC FULL-MATRIX RE-QUALIFICATION GATE

### MODE
ROADMAP / GOVERNANCE MICRO-UPDATE ONLY.

No production implementation, role changes, permission changes, tests, schema/API changes or RBAC redesign.

## 1. DECISION

TravelHub requires a dedicated final security qualification gate validating the entire effective RBAC matrix:

```text
ALL ROLES × ALL PERMISSIONS
        +
SERVER AUTHORIZATION
        +
SERVER-AUTHORITATIVE ACTION PROJECTIONS
        +
RELEVANT UI AUTHORITY / VISIBILITY
        +
TENANT / WORKSPACE ISOLATION
```

This is a qualification gate, not an RBAC implementation stage.

## 2. CANONICAL PURPOSE

The future gate must answer:

> Does the current TravelHub HEAD implement exactly the intended effective permission matrix for every role and every permission, with no missing grants, excessive grants, authorization/UI divergence or cross-role leakage?

The verification path is:

```text
Role
 ↓
Role → Permission assignment
 ↓
Effective permissions
 ↓
Server authorization
 ↓
Server-authoritative action projection
 ↓
UI visibility / executable action
```

Negative authorization must also be verified.

## 3. INSERTION POINT

The current canonical phasing contains:

```text
UI-C15  Card/spacing/responsive/loading/error polish
UI-C16  Security/regression/browser qualification
UI-C17  Git hard closure
```

Change it to:

```text
UI-C15  Card/spacing/responsive/loading/error polish
UI-C16  Security/regression/browser qualification
UI-C17  Final RBAC full-matrix re-qualification
UI-C18  Git hard closure
```

Do not merge UI-C17 into UI-C16.

Do not place UI-C17 after Git hard closure.

## 4. REQUIRED UI-C17 CONTRACT

Canonical description:

```text
UI-C17  Final RBAC full-matrix re-qualification
```

Meaning:

```text
FINAL SECURITY / AUTHORIZATION QUALIFICATION
```

Not:

```text
RBAC IMPLEMENTATION
```

## 5. FULL MATRIX REQUIREMENT

At qualification time enumerate the actual current role registry and actual current permission registry.

For every:

```text
Role × Permission
```

record:

```text
EXPECTED
ACTUAL
DELTA
```

Classify every cell as:

```text
EXPECTED GRANT / ACTUAL GRANT
EXPECTED DENY / ACTUAL DENY
MISSING GRANT
EXCESS GRANT
```

Any unexplained delta blocks acceptance.

Do not use a representative subset as a substitute for the full matrix.

## 6. EFFECTIVE ACCESS REQUIREMENT

Configuration inspection alone is insufficient.

For relevant executable/sensitive permissions verify:

```text
role assignment
→ authenticated user
→ effective permissions
→ backend guard
→ endpoint
→ domain/action authority
→ UI action projection
```

For a granted permission:

```text
permission present
+
server endpoint allowed
+
server action authority correct
+
UI action correct
+
action executable
```

For a denied permission:

```text
permission absent
+
server endpoint denied
+
action unavailable
+
UI does not expose an executable action
```

## 7. ROLE-CHANGE RULE

If any future stage changes:

- role → permission assignment;
- effective role permissions;
- permission definitions;
- authorization guards;
- server action authority;
- permission-sensitive UI authority;

the final UI-C17 gate must still qualify the **entire current matrix**, not only the changed role.

Example:

```text
Before:
MANAGER → order.edit_noncritical = DENY

Change:
MANAGER → order.edit_noncritical = GRANT

Final UI-C17:
ALL roles × ALL permissions
```

A role-local verification does not replace the final full-matrix gate.

## 8. SECURITY DIMENSIONS

UI-C17 must verify:

- positive authorization;
- negative authorization;
- no privilege escalation;
- no unintended privilege loss;
- cross-role isolation;
- tenant/workspace isolation;
- direct API authorization;
- UI/server authorization consistency;
- server-authoritative projections such as `availableActions`.

Do not treat hidden UI as authorization evidence.

## 9. NO INVENTED RBAC MODEL

At execution time inspect the actual repository.

Do not invent roles, permissions, permission groups, tenant rules or UI authorization semantics.

If the canonical RBAC matrix is ambiguous:

```text
BLOCKED — CANONICAL RBAC MATRIX AMBIGUOUS
```

Do not guess.

## 10. RELATION TO UI-C16

Preserve:

```text
UI-C16 = Security / regression / browser qualification
```

Distinction:

```text
UI-C16
→ validates the implemented product/stage security and runtime contracts

UI-C17
→ validates the entire current TravelHub RBAC matrix
```

Do not remove or weaken UI-C16.

## 11. RELATION TO UI-C18

Required sequence:

```text
UI-C16
   ↓
UI-C17 — Final RBAC full-matrix re-qualification
   ↓
UI-C18 — Git hard closure
```

Git hard closure is not final while UI-C17 is unresolved.

## 12. CURRENT ROADMAP MUST OTHERWISE REMAIN UNCHANGED

Preserve all existing stage definitions and dependencies.

Do not reorder UI-C1…UI-C16.

Do not change UI-C6, UI-C7, D8, Finance Center or PROD-01.

Do not alter accepted historical mappings.

Do not change Debt Register statuses.

Do not create a debt merely for this governance gate.

Historical reports remain historical.

## 13. REQUIRED ROADMAP TEXT

Where the canonical roadmap says:

```text
CURRENT COMMERCE IMPLEMENTATION (UI-C1 through UI-C17)
```

change only the range to:

```text
CURRENT COMMERCE IMPLEMENTATION (UI-C1 through UI-C18)
```

Update the phasing block to:

```text
UI-C15  Card/spacing/responsive/loading/error polish
UI-C16  Security/regression/browser qualification
UI-C17  Final RBAC full-matrix re-qualification
UI-C18  Git hard closure
```

Reconcile any same-roadmap occurrence of the old `UI-C17 Git hard closure` so there is exactly one canonical meaning:

```text
UI-C17 = Final RBAC full-matrix re-qualification
UI-C18 = Git hard closure
```

Do not broadly rewrite historical documents.

## 14. GOVERNANCE NOTE

Add near the roadmap/security phasing:

```text
Final RBAC Gate:
Before final repository closure, TravelHub requires an independent
full-matrix RBAC re-qualification covering all current roles × all current
permissions and validating effective server authorization, relevant
server-authoritative action projections, UI authorization consistency and
tenant/workspace isolation.

This is a qualification gate, not an RBAC implementation stage.
Any future role/permission change does not reduce the required final
verification scope: the complete current matrix must be re-qualified.
```

## 15. NO NEW DEBT

Do not add RBAC debt or a new debt ID merely for this requirement.

## 16. PRE-EDIT AUDIT

Before editing:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status --porcelain=v1
git diff --check
```

Identify the exact canonical roadmap file.

Confirm the current C15/C16/C17 mapping and that no newer governance decision supersedes it.

If the baseline or roadmap structure differs materially:

```text
STOP
```

## 17. REQUIRED REPORT

Create:

```text
docs/reports/PHASE_3_ROADMAP_RBAC_FINAL_FULL_MATRIX_REQUALIFICATION_GATE_REPORT.md
```

Required sections:

1. Executive Summary
2. Starting Git State
3. Canonical Roadmap File Identified
4. Existing C15/C16/C17 State
5. New C17/C18 Decision
6. Final RBAC Gate Contract
7. Role × Permission Full-Matrix Requirement
8. Effective Authorization Requirement
9. Security / Tenant / Workspace Requirement
10. UI / Server Authority Requirement
11. Historical Preservation
12. Scope Compliance
13. Git Closure
14. Final Verdict

## 18. ACCEPTANCE

All must pass:

- canonical roadmap identified;
- C15 preserved;
- C16 preserved;
- UI-C17 added as Final RBAC full-matrix re-qualification;
- UI-C18 = Git hard closure;
- ALL current roles × ALL current permissions explicitly required;
- effective authorization required;
- positive + negative authorization required;
- cross-role leakage checked;
- tenant/workspace isolation required;
- server/UI authority consistency required;
- no RBAC implementation performed;
- no roles or permissions changed;
- no unrelated roadmap changes;
- historical reports preserved;
- Debt Register unchanged;
- Git synchronized.

## 19. FINAL VERDICT

### VERDICT A — ROADMAP UPDATE ACCEPTED

Only if the canonical roadmap unambiguously states:

```text
UI-C16  Security/regression/browser qualification
UI-C17  Final RBAC full-matrix re-qualification
UI-C18  Git hard closure
```

and explicitly requires:

```text
ALL CURRENT ROLES × ALL CURRENT PERMISSIONS
```

with effective server/UI/security qualification.

### VERDICT B — BLOCKED

If the canonical roadmap cannot be safely reconciled or another governance decision conflicts.

Do not improvise.

## 20. CRITICAL RULE

This task does not perform RBAC re-qualification.

It only makes the final gate canonical and mandatory in the roadmap.

The actual future qualification must use a separate prompt:

```text
PHASE_3_FINAL_RBAC_FULL_MATRIX_REQUALIFICATION_PROMPT.md
```

That prompt must independently inspect the current repository and current role/permission registries.

Do not predeclare its result.

After roadmap update and qualification report:

**STOP.**
