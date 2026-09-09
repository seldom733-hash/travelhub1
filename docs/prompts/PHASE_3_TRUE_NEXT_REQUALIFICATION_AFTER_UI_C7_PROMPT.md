# PHASE 3 — TRUE NEXT REQUALIFICATION AFTER UI-C7 + RBAC ROADMAP GATE
## AUDIT-FIRST — DETERMINE THE ACTUAL NEXT GOVERNANCE STAGE

---

## 0. ROLE

You are performing a **governance / architecture / delivery TRUE-NEXT requalification** for the TravelHub Phase 3 repository.

This is an **AUDIT-FIRST ONLY** task.

Your job is to inspect the current repository and prove which single Phase 3 stage is the actual next stage after:

- UI-C6 — Request Server-Authority Remediation — CLOSED;
- UI-C7 — Request UI Migration — CLOSED;
- Roadmap RBAC Final Full-Matrix Gate update — ACCEPTED.

The expected candidate is **UI-C8 — Order UI Migration**, but this must be **proven from current repository evidence**, not assumed.

---

# 1. CURRENT GOVERNANCE BASELINE

Use the current repository HEAD as the only implementation baseline.

Previously accepted state:

```text
UI-C6  Request Server-Authority Remediation       CLOSED
UI-C7  Request UI Migration                       CLOSED
```

Roadmap governance update:

```text
UI-C15  Card/spacing/responsive/loading/error polish
UI-C16  Security/regression/browser qualification
UI-C17  Final RBAC full-matrix re-qualification
UI-C18  Git hard closure
```

The RBAC final full-matrix qualification has **NOT** been executed.

UI-C18 has **NOT** been executed.

Do not perform either of them during this task.

---

# 2. CURRENT BASELINE SHA

Expected governance-update baseline / current repository lineage:

```text
ff3d2894b501be1abccfdf48cbbb23006ec93ac5
```

First verify the actual current:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status --short
git diff --check
```

If the repository is not at the expected governance-update lineage, STOP and report the discrepancy.

Do not silently select another baseline.

---

# 3. OBJECTIVE

Determine exactly one:

```text
TRUE NEXT = UI-C8 — Order UI Migration
```

or, if evidence disproves that:

```text
TRUE NEXT = <another already-defined canonical stage>
```

Do not invent a new roadmap stage.

Do not implement anything.

Do not modify production code.

Do not modify tests.

Do not modify permissions.

Do not modify the Debt Register.

Do not modify the roadmap.

Do not modify prompts.

Do not perform UI-C8.

Do not perform UI-C9.

Do not perform D8.

Do not perform Finance Center work.

Do not perform PROD-01.

Do not perform the final RBAC matrix.

---

# 4. AUTHORITY ORDER

Resolve contradictions using this authority order:

1. Actual current source tree;
2. Current security / authorization implementation and tests;
3. Current API / DTO / schema;
4. Accepted architectural decisions;
5. Accepted qualification / closure reports;
6. Debt Register;
7. Current canonical roadmap;
8. Historical prompts / superseded planning documents;
9. Agent assumptions.

Never reverse this order.

A historical prompt must not override current source or an accepted governance decision.

---

# 5. CANDIDATES TO REQUALIFY

At minimum evaluate:

### Candidate A

```text
UI-C8 — Order UI Migration
```

### Candidate B

```text
UI-C9 — Booking UI Migration
```

### Candidate C

```text
D8 — Global Temporal Visibility
```

### Candidate D

```text
Finance Center
```

### Candidate E

```text
PROD-01 — Seller Service Cards / Product Model /
Service Category Reporting
```

Also inspect whether another **already-defined canonical stage** has become the actual next stage.

Do not create a new stage.

---

# 6. UI-C8 PREREQUISITE AUDIT

Determine whether UI-C8 is genuinely ready to begin.

Inspect the current Order Detail implementation:

```text
frontend/app/app/orders/[id]/page.tsx
```

and all directly relevant shared components.

Audit:

- current Order Detail architecture;
- current shell;
- header;
- actions;
- status/payment semantics;
- timeline;
- relation chain;
- operational notes;
- audit history;
- finance presentation;
- loading/error/not-found;
- responsive behavior;
- i18n;
- accessibility;
- RBAC;
- server-authoritative action projection;
- API/DTO compatibility.

Determine whether the Order Detail is still materially legacy relative to the accepted canonical Commerce Detail architecture.

Do not assume that because C7 migrated Request, Order automatically requires migration.

Prove it from source.

---

# 7. CROSS-DETAIL CONSISTENCY

Compare:

```text
Request Detail
Order Detail
Booking Detail
```

The comparison must explicitly identify:

- what is already canonical;
- what is shared;
- what remains legacy;
- what differs for legitimate business reasons;
- what differs only because migration has not yet occurred.

Use the accepted UI-C7 state as the reference for canonical Request Detail behavior.

Preserve the principle:

```text
UNIFIED STRUCTURE ≠ IDENTICAL BUSINESS CONTENT
```

Do not require Order to become identical to Request.

---

# 8. ORDER ACTION AUTHORITY

Audit the current Order action model.

Determine:

- source of available actions;
- action type;
- status authority;
- permission authority;
- business-gate authority;
- frontend consumption;
- local lifecycle derivation;
- direct API enforcement;
- tests;
- browser/security evidence if available.

Explicitly verify whether Order already follows the server-authoritative pattern established by UI-C6.

If it does, identify exactly what UI-C8 would migrate at presentation level.

If it does not, determine whether that creates a prerequisite or blocks UI-C8.

Do not invent missing permissions or actions.

---

# 9. ORDER LEGACY INVENTORY

Produce a concrete inventory of remaining Order UI migration work.

Classify each item:

```text
MUST
SHOULD
MUST NOT CHANGE
ALREADY CANONICAL
LEGITIMATE BUSINESS DIFFERENCE
```

At minimum inspect:

- action placement;
- action component architecture;
- helper functions;
- local status/permission matrices;
- loading/error/not-found;
- breadcrumb behavior;
- field-row patterns;
- finance cards;
- relation chain;
- timeline;
- notes;
- audit;
- converted/linked entities;
- i18n;
- accessibility;
- responsive layout.

Every claimed legacy item must be supported by source evidence.

---

# 10. SECURITY / RBAC PREREQUISITES

Verify that UI-C8 can proceed without weakening the accepted security model.

Inspect:

- `order.read`;
- `order.edit_noncritical`;
- other existing Order permissions;
- server guards;
- direct endpoint authorization;
- availableActions projection;
- unauthorized UI behavior;
- tenant/workspace isolation;
- direct URL behavior.

Do not introduce:

- new permissions;
- new roles;
- new tenant rules;
- new workspace rules.

If a security defect is discovered, classify it as a blocker rather than silently fixing it.

Do not close SEC-UI-01 again; it is already CLOSED at UI-C6.

---

# 11. DEBT / GOVERNANCE AUDIT

Inspect the current Debt Register and roadmap.

Determine whether:

- an open debt blocks UI-C8;
- UI-C8 is explicitly or implicitly superseded;
- another accepted governance decision changes sequencing;
- UI-C17 final RBAC gate changes the immediate next step;
- UI-C18 closure remains final.

Important:

The existence of UI-C17 does **not** mean UI-C17 is next.

The final RBAC gate remains a late-stage mandatory gate.

---

# 12. D8 AUDIT

Evaluate D8 independently.

D8 is:

```text
Global Temporal Visibility
```

Determine:

- whether D8 has started;
- whether any accepted dependency makes it next;
- whether UI-C8 is a prerequisite;
- whether D8 supersedes UI-C8.

Do not promote D8 merely because it is an architectural track.

---

# 13. FINANCE CENTER AUDIT

Preserve the canonical distinction:

```text
Payments
= current capability
= Finance ownership
= Operations Center tab

Finance Center
= separate future capability
= NOT STARTED
```

Do not treat the existence of Payments as evidence that Finance Center is next.

Determine whether any accepted governance decision now makes Finance Center the next stage.

---

# 14. PROD-01 AUDIT

Preserve:

```text
PROD-01 =
Seller Service Cards /
Product Model /
Service Category Reporting
```

Determine whether its prerequisites are now satisfied.

Inspect whether the canonical service/product model is sufficiently defined and implemented to make PROD-01 the next stage.

Do not invent a Product Model.

Do not reopen PROD-01 unless current evidence shows a real state change.

---

# 15. ACCEPTED C6 / C7 DEPENDENCY CHAIN

Explicitly verify:

```text
SEC-UI-01 OPEN
        ↓
UI-C6 Request Server-Authority Remediation
        ↓
SEC-UI-01 CLOSED
        ↓
UI-C7 Request UI Migration
        ↓
UI-C8 Order UI Migration
```

The first four nodes are historical accepted facts.

The final arrow must be independently proven.

Do not assume sequential numbering is sufficient evidence.

---

# 16. REQUIRED TRUE-NEXT DECISION MATRIX

Create a matrix:

| Candidate | Status | Prerequisites | Blockers | Evidence | Can be TRUE NEXT? |
|---|---|---|---|---|---|
| UI-C8 | | | | | |
| UI-C9 | | | | | |
| D8 | | | | | |
| Finance Center | | | | | |
| PROD-01 | | | | | |
| Other canonical stage | | | | | |

Use:

```text
READY
NOT READY
BLOCKED
DEFERRED
ALREADY CLOSED
NOT STARTED
```

Do not use subjective labels without evidence.

---

# 17. UI-C8 READINESS CONTRACT

If UI-C8 is proven as TRUE NEXT, define the exact future audit/implementation boundary.

Include:

### MUST

Only evidence-backed Order migration work.

### SHOULD

Non-blocking canonical parity improvements.

### MUST NOT

Explicitly preserve:

- Order API contract unless separately approved;
- DTO shape unless separately approved;
- permissions;
- role model;
- lifecycle/status semantics;
- financial formulas;
- payment truth;
- relation truth;
- timeline semantics;
- audit semantics;
- Notes semantics;
- Booking implementation;
- Request implementation already accepted;
- D8;
- Finance Center;
- PROD-01;
- Debt Register;
- roadmap;
- UI-C17 final RBAC gate.

Do not write an implementation prompt yet.

This is only the future acceptance boundary.

---

# 18. NO IMPLEMENTATION

This task is strictly audit-first.

Allowed:

```text
read
inspect
search
compare
test existing behavior where necessary
produce report
```

Forbidden:

```text
source modifications
test modifications
schema modifications
API modifications
DTO modifications
permission modifications
RBAC modifications
roadmap modifications
Debt Register modifications
prompt modifications
UI implementation
refactoring
cleanup
formatting changes
```

Only this report may be newly created:

```text
docs/reports/PHASE_3_TRUE_NEXT_REQUALIFICATION_AFTER_UI_C7_REPORT.md
```

If the environment requires another generated artifact to perform the audit, do not create it in the repository.

---

# 19. TEST / VERIFICATION EXPECTATIONS

Run only tests and checks necessary to establish TRUE NEXT evidence.

At minimum inspect:

```text
Order Detail source
Request Detail source
Booking Detail source
Order backend controller/service
Order DTO
Order tests
Request accepted implementation evidence
Booking accepted implementation evidence
RBAC/security tests
Debt Register
canonical roadmap
```

Do not modify tests.

Do not interpret an unrelated pre-existing test failure as a blocker unless it materially affects the TRUE NEXT decision.

---

# 20. GIT CLOSURE

Because this is audit-only, the expected repository result is:

```text
production source unchanged
tests unchanged
schema unchanged
permissions unchanged
roadmap unchanged
Debt Register unchanged
```

Only the audit report may be added.

The final report must record:

```text
BASELINE SHA
REPORT COMMIT SHA
FINAL HEAD
origin/master
git status
git diff --check
```

If repository state differs unexpectedly, STOP and classify it.

Do not hide unrelated modifications.

---

# 21. REQUIRED REPORT

Create:

```text
docs/reports/PHASE_3_TRUE_NEXT_REQUALIFICATION_AFTER_UI_C7_REPORT.md
```

Required structure:

```text
# PHASE 3 — TRUE NEXT REQUALIFICATION AFTER UI-C7

## 1. Executive Summary

## 2. Baseline and Repository State

## 3. Canonical Governance State

## 4. Authority Order Used

## 5. UI-C8 Prerequisite Audit

## 6. Request / Order / Booking Cross-Detail Comparison

## 7. Order Server Authority / RBAC Audit

## 8. Order Legacy Inventory

## 9. Security / Tenant / Workspace Audit

## 10. Debt Register Audit

## 11. D8 Audit

## 12. Finance Center Audit

## 13. PROD-01 Audit

## 14. Candidate Decision Matrix

## 15. TRUE NEXT Decision

## 16. UI-C8 Future Acceptance Boundary
   ### 16.1 MUST
   ### 16.2 SHOULD
   ### 16.3 MUST NOT

## 17. Evidence

## 18. Git Closure

## 19. Final Verdict
```

---

# 22. FINAL VERDICT RULE

There are only two acceptable verdicts.

### VERDICT A

```text
VERDICT A — TRUE NEXT PROVEN

TRUE NEXT = UI-C8 — Order UI Migration
STATUS = NOT STARTED
PREREQUISITES = SATISFIED
BLOCKERS = NONE
```

Only use this if the evidence proves it.

### VERDICT B

```text
VERDICT B — TRUE NEXT NOT PROVEN / BLOCKED

TRUE NEXT = <evidence-backed result>
```

Use this if:

- UI-C8 is blocked;
- another canonical stage is actually next;
- governance is ambiguous;
- repository evidence is insufficient;
- unexpected changes prevent reliable determination.

Do not force VERDICT A.

---

# 23. STOP CONDITION

After creating the report and recording the verdict:

**STOP.**

Do not:

- implement UI-C8;
- generate the UI-C8 implementation prompt;
- modify the roadmap;
- modify the Debt Register;
- execute UI-C17;
- execute UI-C18.

The next implementation prompt may be created only after this TRUE-NEXT result is independently reviewed and accepted.

---

# 24. CORE PRINCIPLE

The objective is not:

> “continue to the next numbered stage.”

The objective is:

> **prove the next stage from the current canonical repository and governance state.**

No assumption.
No roadmap-by-number.
No speculative refactor.
No hidden implementation.

**AUDIT FIRST → EVIDENCE → TRUE NEXT → STOP.**
