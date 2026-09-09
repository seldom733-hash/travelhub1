# PHASE 3 — UI-C8 — ORDER UI MIGRATION — AUDIT-FIRST MAPPING

## 0. ROLE

Perform the **AUDIT-FIRST mapping** for TravelHub Phase 3:

> **UI-C8 — Order UI Migration**

UI-C8 has already been independently proven as the TRUE NEXT stage.

This task is **audit-only**. Do not implement UI-C8.

The purpose is to inspect the current repository and produce an evidence-backed implementation/qualification boundary.

---

## 1. GOVERNANCE BASELINE

Current accepted state:

```text
UI-C6  Request Server-Authority Remediation       CLOSED
UI-C7  Request UI Migration                       CLOSED
UI-C8  Order UI Migration                         TRUE NEXT / NOT STARTED
```

Final governance gates:

```text
UI-C15  Card/spacing/responsive/loading/error polish
UI-C16  Security/regression/browser qualification
UI-C17  Final RBAC full-matrix re-qualification
UI-C18  Git hard closure
```

UI-C17 and UI-C18 MUST NOT be executed here.

Current baseline:

```text
ff3d2894b501be1abccfdf48cbbb23006ec93ac5
```

First verify:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status --short
git diff --check
```

If the actual repository is not on the expected lineage, STOP and report the discrepancy.

---

## 2. OBJECTIVE

Determine exactly:

1. What is already canonical in Order Detail?
2. What remains legacy/inconsistent?
3. Which differences are legitimate Order-specific business content?
4. What is the minimum evidence-backed UI-C8 scope?
5. What must explicitly NOT change?
6. What tests and browser/security evidence will later be required?

Preserve:

```text
UNIFIED STRUCTURE ≠ IDENTICAL BUSINESS CONTENT
```

Do not assume Order must become visually or structurally identical to Request.

---

## 3. AUTHORITY ORDER

Resolve contradictions using:

1. Current source tree;
2. Current security / authorization implementation and tests;
3. Current API / DTO / schema;
4. Accepted architecture;
5. Accepted qualification / closure reports;
6. Debt Register;
7. Current roadmap;
8. Historical prompts;
9. Agent assumptions.

Current source outranks historical reports. Do not invent missing contracts.

---

## 4. PRIMARY FILES

Start with:

```text
frontend/app/app/orders/[id]/page.tsx
frontend/components/order/OrderActionBar.tsx
backend/src/modules/order/order.controller.ts
backend/src/modules/order/order.service.ts
```

Then inspect directly relevant shared components and tests.

Comparison files:

```text
frontend/app/app/requests/[id]/page.tsx
frontend/app/app/bookings/[id]/page.tsx
frontend/lib/commerce-detail-system.spec.tsx
backend/test/d5-order-fullpage-audit.e2e-spec.ts
```

Also inspect relevant DTOs, schemas, transition definitions, permissions, i18n, timeline, relation chain, operational notes, audit history, and shared detail components.

Only inspect files materially relevant to Order Detail migration.

---

## 5. ORDER DETAIL ARCHITECTURE AUDIT

Map the current Order Detail top-to-bottom:

```text
Shell
Header
Breadcrumbs
Entity identity
Status
Payment status
Primary actions
Main content
Aside content
Finance
Timeline
Commerce Relation Chain
Operational Notes
Audit History
Loading
Error
Not Found
Responsive behavior
i18n
Accessibility
```

For each classify:

```text
ALREADY CANONICAL
LEGACY / MIGRATION CANDIDATE
LEGITIMATE BUSINESS DIFFERENCE
BLOCKER
```

Every classification must have source evidence.

---

## 6. CANONICAL COMMERCE DETAIL COMPARISON

Compare Order against accepted Request UI-C7 and current Booking Detail.

Audit:

- `EntityDetailShell`
- `EntityDetailHeader`
- `EntityDetailLayout`
- Main / Aside / Wide composition
- breadcrumbs
- status/payment badges
- header action slot
- timeline
- relation chain
- notes
- audit history
- finance presentation

Do NOT remove or flatten legitimate Order content:

- Order items;
- traveler data;
- payment/refund history;
- final confirmation state;
- legitimate Order lifecycle information;
- D7 financial truth.

Distinguish structural inconsistency from legitimate business difference.

---

## 7. ORDER ACTION AUDIT

Critical gate.

Determine:

- where `availableActions` is computed;
- exact type;
- permission participation;
- business-gate participation;
- status-transition participation;
- frontend consumption;
- local lifecycle/status matrices;
- local permission derivation;
- endpoint paths and payloads;
- backend independent authorization;
- existing positive/negative tests.

Verify whether `OrderActionBar` is already the correct canonical action presentation.

If already canonical, do not invent a replacement merely for symmetry.

MUST NOT:

- weaken server authority;
- move authorization into client code;
- alter action semantics;
- invent actions;
- invent permissions;
- alter transition rules.

---

## 8. ORDER FINANCE AUDIT

D7 semantics are binding:

```text
due        = max(0, total - paid)
refundable = max(0, paid - refunded)
```

Do not modify formulas in UI-C8.

Audit:

- total;
- paid;
- due;
- refunded;
- refundable;
- currency;
- payment history;
- refund history;
- formatting;
- backend source of truth;
- frontend calculations.

If a semantic defect is found, classify it as a blocker rather than fixing it inside UI-C8.

---

## 9. RELATION / TIMELINE / NOTES / AUDIT

Verify:

```text
CommerceRelationChain
≠
EntityTimeline
≠
OperationalNotes
≠
EntityAuditHistory
```

Audit:

- Request → Order → Booking;
- current-node highlighting;
- NOT_CREATED handling;
- navigation;
- timeline milestones/current stage;
- Notes CRUD/visibility;
- immutable Audit History.

Do not merge or redesign these concepts.

---

## 10. LOADING / ERROR / NOT-FOUND

Compare Order against accepted UI-C7 conventions:

- loading state;
- API error state;
- not-found state;
- back navigation;
- centered layout;
- localization;
- direct URL;
- reload behavior.

Classify only actual inconsistencies.

---

## 11. RESPONSIVE / ACCESSIBILITY / I18N

Audit:

```text
375
768
1024
1280
```

If runtime browser testing is inappropriate for audit-only, perform static inspection and mark browser verification as a future qualification requirement.

Inspect:

- overflow;
- action wrapping;
- finance grid;
- tables;
- long IDs;
- button labels;
- focus/keyboard behavior;
- semantic labels;
- `aria-*`;
- RU/AZ/EN;
- missing translation keys;
- literal text.

Do not modify dictionaries.

---

## 12. SECURITY / RBAC AUDIT

Verify:

### Read
```text
order.read
```

### Mutations
Each actual Order action against its existing granular permission.

Audit:

- guards;
- service authorization;
- availableActions projection;
- direct API access;
- unauthorized/read-only actors;
- cross-tenant/workspace behavior;
- direct UUID enumeration protection.

Preserve the existing server-authoritative model.

Do not introduce roles, permissions, tenant rules, or workspace rules.

If a security defect blocks migration, report it as a blocker.

---

## 13. API / DTO / SCHEMA AUDIT

Inspect:

```text
GET /orders/:id
Order DTO
Order service
Order controller
schema
availableActions
linked Request
linked Booking
financial data
history
traveler data
```

Expected default:

```text
NO API / DTO / SCHEMA CHANGE
```

Prove this.

If a backend change is genuinely required, identify the exact missing contract and whether it should be a separate prerequisite. Do not implement it.

---

## 14. LEGACY INVENTORY

Create:

| Item | Current state | Classification | Evidence | UI-C8 action |
|---|---|---|---|---|
| Actions | | | | |
| Shell | | | | |
| Header | | | | |
| Breadcrumbs | | | | |
| Loading | | | | |
| Error | | | | |
| Not Found | | | | |
| Field rows | | | | |
| Finance | | | | |
| Timeline | | | | |
| Relation chain | | | | |
| Notes | | | | |
| Audit | | | | |
| i18n | | | | |
| Accessibility | | | | |
| Responsive | | | | |

Use:

```text
MUST
SHOULD
MUST NOT CHANGE
ALREADY CANONICAL
LEGITIMATE BUSINESS DIFFERENCE
BLOCKER
```

Do not label legitimate business differences as legacy.

---

## 15. CROSS-REGISTRY REGRESSION BOUNDARY

UI-C8 concerns Order Detail only.

Explicitly verify that migration does not change:

```text
Request Detail
Booking Detail
Requests registry
Orders registry
Bookings registry
Payments
Finance Center
D8
PROD-01
```

unless an actual regression requires investigation.

Do not expand scope.

---

## 16. DEBT REGISTER / ROADMAP

Inspect:

```text
docs/TRAVELHUB_DEBT_REGISTER.md
```

and the canonical roadmap/report.

Determine:

- whether any open debt blocks UI-C8;
- hidden dependencies;
- UI-C17 remains late-stage;
- UI-C18 remains final closure;
- any accepted governance decision supersedes C8.

Do not modify these documents.

---

## 17. UI-C8 IMPLEMENTATION BOUNDARY

Produce the exact future implementation boundary.

### MUST

Only evidence-backed migration items. For each include:

- file;
- current problem;
- target behavior;
- acceptance evidence.

### SHOULD

Only low-risk consistency improvements.

### MUST NOT

Protect:

- Order API contract;
- DTO unless separately approved;
- schema;
- permissions/roles;
- server authority;
- lifecycle/status enums;
- transition rules;
- financial formulas/payment truth;
- relation/timeline/notes/audit truth;
- Request implementation;
- Booking implementation;
- Payments;
- Finance Center;
- D8;
- PROD-01;
- Debt Register;
- roadmap;
- UI-C17;
- UI-C18.

---

## 18. FUTURE QUALIFICATION CONTRACT

Define what later UI-C8 implementation/qualification must prove.

### Static

- canonical shell;
- header/action composition;
- no local authorization matrix;
- all actions consume server projection;
- business-specific Order content preserved;
- finance semantics preserved;
- relation/timeline/notes/audit separation;
- i18n;
- accessibility.

### Tests

- focused Order UI tests;
- action projection tests;
- Request/Booking regression;
- existing D5 security tests;
- TSC;
- build.

### Browser

Where applicable verify:

```text
ADMIN / authorized actor
read-only actor
unauthorized actor
direct URL
reload
action visibility
action execution
console errors
network failures
375 / 768 / 1024 / 1280
```

---

## 19. NO IMPLEMENTATION

Strictly forbidden:

```text
production code changes
test changes
schema changes
API changes
DTO changes
permission/RBAC changes
roadmap changes
Debt Register changes
i18n changes
UI implementation
refactoring
cleanup
formatting-only changes
```

Only create:

```text
docs/reports/PHASE_3_UI_C8_ORDER_UI_MIGRATION_AUDIT_FIRST_MAPPING_REPORT.md
```

No implementation prompt yet.

---

## 20. GIT CLOSURE

Record:

```text
BASELINE SHA
HEAD
origin/master
git status --short
git diff --check
```

Expected:

- no source/test/schema/API/RBAC changes;
- no roadmap/Debt Register changes;
- only the audit report may be new.

Do not hide pre-existing untracked artifacts.

Do not claim a completely clean working tree if historical untracked artifacts already exist.

---

## 21. REQUIRED REPORT

Create:

```text
docs/reports/PHASE_3_UI_C8_ORDER_UI_MIGRATION_AUDIT_FIRST_MAPPING_REPORT.md
```

Required structure:

```text
# PHASE 3 — UI-C8 — ORDER UI MIGRATION — AUDIT-FIRST MAPPING

## 1. Executive Summary
## 2. Baseline and Repository State
## 3. Canonical Governance State
## 4. Authority Order
## 5. Order Detail Architecture Audit
## 6. Request / Order / Booking Comparison
## 7. Order Action Authority Audit
## 8. Order Finance Audit
## 9. Relation / Timeline / Notes / Audit Audit
## 10. Loading / Error / Not-Found Audit
## 11. Responsive / Accessibility / i18n Audit
## 12. Security / RBAC Audit
## 13. API / DTO / Schema Audit
## 14. Legacy Inventory
## 15. Cross-Registry Regression Boundary
## 16. Debt Register / Roadmap Audit
## 17. UI-C8 Implementation Boundary
### 17.1 MUST
### 17.2 SHOULD
### 17.3 MUST NOT
## 18. Future Qualification Contract
## 19. Evidence
## 20. Git Closure
## 21. Final Verdict
```

---

## 22. FINAL VERDICT

Only two verdicts are permitted.

### VERDICT A

Use only if UI-C8 is implementable without an unresolved prerequisite:

```text
VERDICT A — AUDIT READY

UI-C8 = Order UI Migration
PREREQUISITES = SATISFIED
BLOCKERS = NONE
IMPLEMENTATION SCOPE = <exact evidence-backed scope>
```

### VERDICT B

Use if:

- prerequisite missing;
- security/API/governance blocker;
- scope cannot be determined safely;
- unexpected repository state prevents reliable mapping.

```text
VERDICT B — AUDIT BLOCKED

BLOCKER = <exact evidence-backed blocker>
```

Do not force AUDIT READY.

---

## 23. STOP

After creating the report and final verdict:

**STOP.**

Do not:

- implement UI-C8;
- create the UI-C8 implementation prompt;
- modify roadmap;
- modify Debt Register;
- execute UI-C17;
- execute UI-C18.

Implementation begins only after independent review and acceptance.

---

## 24. CORE PRINCIPLE

Do not optimize for “making Order look like Request.”

Optimize for:

> **bringing Order Detail to the accepted canonical Commerce Detail presentation standard while preserving all legitimate Order business behavior and server-authoritative contracts.**

Sequence:

```text
AUDIT
→ EVIDENCE
→ EXACT SCOPE
→ INDEPENDENT REVIEW
→ IMPLEMENTATION
→ QUALIFICATION
→ STOP
```
