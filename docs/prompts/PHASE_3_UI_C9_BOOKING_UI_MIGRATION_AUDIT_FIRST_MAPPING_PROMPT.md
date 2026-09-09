# PHASE 3 — UI-C9 — BOOKING UI MIGRATION — AUDIT-FIRST MAPPING

## 0. ROLE

You are performing the next explicitly authorized TravelHub Phase 3 stage:

> **UI-C9 — Booking UI Migration**

This is **AUDIT-FIRST ONLY**.

Do not implement anything.

Do not modify production source, tests, API, DTOs, schema, permissions, Debt Register, roadmap, or unrelated documentation.

The purpose of this stage is to establish the exact evidence-backed implementation boundary for Booking Detail before any implementation prompt is issued.

---

# 1. GOVERNANCE BASELINE

Current accepted lineage:

```text
UI-C6 — Request Server-Authority Remediation
        = ACCEPTED / CLOSED

UI-C7 — Request UI Migration
        = ACCEPTED / CLOSED

UI-C8 — Order UI Migration
        = ACCEPTED / FUNCTIONALLY QUALIFIED
        = Git publication pending

UI-C9 — Booking UI Migration
        = TRUE NEXT
        = NOT STARTED
```

Current governance baseline:

```text
ff3d2894b501be1abccfdf48cbbb23006ec93ac5
```

Canonical Phase 3 roadmap already contains:

```text
UI-C7 Request UI migration
UI-C8 Order UI migration
UI-C9 Booking UI migration
...
UI-C17 Final RBAC full-matrix re-qualification
UI-C18 Git hard closure
```

Do not change this roadmap during the audit.

---

# 2. SOURCE AUTHORITY ORDER

Use this authority order:

```text
1. Actual current source tree
2. Current security / frontend / backend tests
3. Current schema / API / DTO contracts
4. Accepted architecture and design contracts
5. Accepted qualification reports
6. Debt Register
7. Current roadmap
8. Historical prompts / reports
9. Agent assumptions
```

Never invent behavior from a previous Request or Order implementation.

The Booking implementation must be based on the actual current Booking code.

---

# 3. ONLY ALLOWED OUTPUT

Create only:

```text
docs/reports/PHASE_3_UI_C9_BOOKING_UI_MIGRATION_AUDIT_FIRST_MAPPING_REPORT.md
```

No other file may be changed.

No implementation.

No test modification.

No i18n modification.

No Git cleanup.

No commit/push is required for this audit stage unless the governing environment explicitly requires publication of the audit report; if committed, record the exact SHA and ensure no unrelated changes are included.

---

# 4. PRIMARY AUDIT TARGET

Inspect the actual canonical Booking Detail page, expected to be under the current frontend route corresponding to:

```text
frontend/app/app/bookings/[id]/page.tsx
```

Also inspect all directly relevant Booking components.

At minimum determine:

- page composition;
- shared Commerce Detail shell;
- header;
- status/payment badges;
- primary actions;
- action authority;
- main content;
- finance;
- traveler/passenger content;
- timeline;
- relation chain;
- operational notes;
- audit history;
- loading;
- error;
- not-found;
- responsive behavior;
- i18n;
- accessibility;
- direct URL behavior.

Do not assume the path if the source tree differs; locate the real implementation.

---

# 5. CANONICAL COMMERCE DETAIL CONTRACT

Compare Booking against the accepted unified structure:

```text
EntityDetailShell
  ├── Breadcrumbs
  ├── EntityDetailHeader
  │     ├── Entity ID / title
  │     ├── Status / payment badges
  │     └── primary actions
  ├── EntityDetailLayout
  │     ├── MAIN ENTITY CONTENT
  │     └── ASIDE
  ├── entity-specific cards
  ├── Finance (where applicable)
  ├── CommerceRelationChain
  ├── EntityTimeline
  ├── OperationalNotes
  └── EntityAuditHistory
```

The canonical principle remains:

```text
UNIFIED STRUCTURE ≠ IDENTICAL BUSINESS CONTENT
```

Do not remove legitimate Booking-specific business content merely to achieve visual symmetry.

---

# 6. ACTION AUTHORITY — CRITICAL

Audit the Booking action system in detail.

Determine:

- where actions are computed;
- exact action type;
- DTO representation;
- controller authorization;
- service transition validation;
- action-specific business gates;
- permission mapping;
- actor context;
- tenant/workspace scope;
- frontend consumption;
- whether frontend derives anything locally from status or permissions.

For every real Booking action, produce a table:

| Action | Server source | Permission | Status/business gate | DTO projection | UI consumption | Endpoint | Notes |
|---|---|---|---|---|---|---|---|

Do not invent actions.

If Booking uses:

```text
availableActions
```

preserve its actual type and contract.

If Booking differs from Order:

```text
DO NOT refactor them merely for symmetry.
```

---

# 7. STATUS / LIFECYCLE AUDIT

Enumerate the actual Booking status enum/state machine from source/schema.

Determine:

- all canonical statuses;
- transitions;
- terminal states;
- action gates;
- cancellation/refund/payment interactions;
- frontend status-derived behavior.

Explicitly identify any client-side lifecycle matrix.

If one exists, classify whether it is:

```text
presentation-only
business-decision logic
authorization logic
duplicate server authority
```

Do not fix it during this audit.

---

# 8. FINANCE AUDIT

Booking must preserve existing financial truth.

Audit:

- amount;
- paid amount;
- refunded amount;
- due;
- refundable;
- currency;
- payment status;
- refund status;
- formatting;
- server/client calculation boundary.

Use D7 as the accepted finance contract:

```text
due        = max(0, total - paid)
refundable = max(0, paid - refunded)
```

Only report deviations if the current Booking implementation actually violates the accepted contract.

Do not redesign finance.

Do not touch Payments or Finance Center.

---

# 9. COMMERCE RELATION CHAIN

Audit the existing:

```text
Request → Order → Booking
```

relation chain.

Verify:

- Booking is the current node;
- linked Order is server-derived;
- linked Request is server-derived through the canonical relation;
- NOT_CREATED / absent relation behavior;
- navigation;
- direct URL destination;
- authorization on linked entities.

Do not change relation cardinality.

Do not invent additional relations.

Do not merge relation chain with Timeline or Audit.

---

# 10. TIMELINE / NOTES / AUDIT

These remain separate concepts.

Audit whether Booking uses:

```text
EntityTimeline
OperationalNotes
EntityAuditHistory
```

and document their actual order and placement.

Required conceptual separation:

```text
Timeline
= business milestones / current stage

Operational Notes
= operational comments

Audit History
= immutable what / who / when
```

Do not merge them.

Do not move data between them unless the audit proves the current Booking UI violates the accepted canonical composition.

---

# 11. LEGACY UI INVENTORY

Compare Booking Detail against already accepted Request and Order migrations.

Identify factual legacy/presentation differences.

Classify each as:

```text
MUST
SHOULD
PRESERVE
OUT OF SCOPE
```

Look specifically for:

- hard-coded strings;
- missing i18n;
- action labels;
- confirmation text;
- busy state;
- accessibility;
- contrast;
- action placement;
- loading/error/not-found patterns;
- breadcrumbs;
- local helpers;
- duplicate components;
- local permission derivation;
- local lifecycle derivation;
- inconsistent shell/layout;
- responsive issues.

Do not call legitimate Booking-specific business UI "legacy" merely because it differs from Order.

---

# 12. I18N AUDIT

Inspect the actual Booking UI for localization quality.

Determine:

- whether all visible strings use i18n;
- existing RU/AZ/EN keys;
- hard-coded Russian/Azerbaijani/English text;
- whether new keys would be required;
- whether keys follow existing registry/dictionary conventions;
- whether the locations of translations are traceable for future language addition.

Important:

A future language must be able to reuse the same stable keys.

Do not redesign the i18n system.

Do not add translations during this audit.

---

# 13. ACCESSIBILITY AUDIT

Inspect:

- native controls;
- labels;
- accessible names;
- keyboard navigation;
- focus behavior;
- disabled/busy semantics;
- aria usage;
- headings;
- form controls;
- confirmation dialogs;
- contrast;
- responsive action layout.

Record concrete source evidence.

Do not fix anything.

---

# 14. SECURITY / RBAC AUDIT

Audit Booking Detail security independently.

Determine:

### Read

```text
Which permission protects GET /bookings/:id?
```

### Actions

For every mutation:

```text
Which permission?
Which server guard?
Which service gate?
```

### Scope

Determine evidence for:

- tenant isolation;
- workspace isolation;
- Partner Storefront isolation;
- direct URL access;
- linked entity access.

### UI projection

Determine whether:

```text
server authority
        ↓
DTO
        ↓
Booking UI
```

is preserved.

Do not invent tenant/workspace rules.

If scope is not proven, document it as UNKNOWN rather than turning it into a new defect without evidence.

---

# 15. API / DTO / SCHEMA COMPATIBILITY

Audit:

- Booking detail endpoint;
- DTO;
- controller;
- service;
- schema;
- frontend data consumption.

Determine whether UI-C9 requires any backend prerequisite.

The preferred result is:

```text
Backend prerequisite = NONE
```

but this must be evidence-backed.

If a minimal backend enrichment is actually required, STOP and document it precisely.

Do not implement it during AUDIT-FIRST.

---

# 16. CROSS-DETAIL COMPARISON

Create a factual matrix:

| Capability | Request | Order | Booking | C9 requirement |
|---|---|---|---|---|
| Shared shell | | | | |
| Header | | | | |
| Actions | | | | |
| Server authority | | | | |
| Loading/error | | | | |
| Timeline | | | | |
| Relation chain | | | | |
| Operational Notes | | | | |
| Audit History | | | | |
| Finance | | | | |
| i18n | | | | |
| Accessibility | | | | |
| Responsive | | | | |
| RBAC | | | | |

Use actual source evidence.

Do not force identical business content.

---

# 17. TEST AUDIT

Find existing Booking tests.

At minimum inspect:

- Booking frontend tests;
- commerce-detail-system tests;
- Booking backend e2e;
- D5/D7/UI-C2/UI-C5 regression coverage where relevant;
- security/RBAC tests;
- relation tests.

Determine:

- current coverage;
- gaps that UI-C9 qualification must add;
- tests that must remain untouched.

Do not modify tests.

---

# 18. LEGACY / MIGRATION MAP

Produce a precise file-level map.

Example:

```text
frontend/app/app/bookings/[id]/page.tsx
    MUST: ...
    SHOULD: ...
    PRESERVE: ...

frontend/components/booking/...
    MUST: ...
    SHOULD: ...
    PRESERVE: ...

frontend/lib/i18n.tsx
    MUST: ...
    SHOULD: ...
```

Do not list files speculatively.

Only include files proven relevant by source inspection.

---

# 19. MINIMAL IMPLEMENTATION SCOPE

Based on evidence, define the smallest possible UI-C9 scope.

Use this format:

```text
MUST
1. ...
2. ...

SHOULD
1. ...
2. ...

MUST NOT
1. ...
2. ...
```

The implementation boundary must preserve:

- server authority;
- Booking lifecycle;
- existing action endpoints;
- existing action payloads;
- finance truth;
- relation chain;
- timeline;
- notes;
- audit;
- RBAC;
- tenant/workspace scope;
- existing Booking-specific business content.

---

# 20. FUTURE UI-C9 QUALIFICATION CONTRACT

Define what the later implementation qualification must prove.

At minimum:

### Static

- no unauthorized local lifecycle matrix;
- no client permission authority;
- existing server projection preserved;
- no API/DTO/schema changes unless explicitly approved.

### Tests

- focused Booking tests;
- shared Commerce Detail regression;
- backend Booking e2e;
- RBAC/security regression;
- TSC;
- production build.

### Browser

- authorized actor;
- read-only actor;
- unauthorized/out-of-scope actor;
- direct URL;
- reload;
- action projection;
- action execution where safe;
- console;
- network;
- responsive:

```text
375
768
1024
1280
```

### i18n

```text
RU
AZ
EN
```

### Accessibility

- keyboard;
- accessible names;
- busy state;
- confirmation;
- contrast;
- responsive controls.

---

# 21. DEBT / ROADMAP BOUNDARY

Audit current Debt Register and roadmap only for blockers.

Do not modify them.

Preserve:

```text
UI-C17 = Final RBAC full-matrix re-qualification
UI-C18 = Git hard closure
```

Do not promote:

```text
D8
Finance Center
PROD-01
```

because UI-C9 is a C-track migration stage.

Payments remains:

```text
current capability
+
Finance ownership
+
Operations Center tab
```

and does NOT mean Finance Center has started.

---

# 22. STOP CONDITIONS

Immediately STOP the audit and report `AUDIT BLOCKED` if:

- current Booking architecture is internally contradictory;
- action authority cannot be established;
- a required API/DTO/schema contract is missing and cannot be safely inferred;
- implementation scope would require an unapproved domain/security change;
- tenant/workspace authorization is ambiguous in a way that prevents safe UI qualification;
- accepted architecture conflicts with actual source in a way requiring governance decision.

Do not solve such a blocker during this stage.

---

# 23. FINAL VERDICT

Only two verdicts are allowed.

## VERDICT A

```text
VERDICT A — AUDIT READY

UI-C9 = Booking UI Migration
Implementation scope = evidence-backed
Prerequisites = satisfied
Blockers = none
```

## VERDICT B

```text
VERDICT B — AUDIT BLOCKED

BLOCKER = <exact evidence-backed blocker>
```

Do not use "A" merely because the next roadmap item is C9.

---

# 24. FINAL REPORT STRUCTURE

The report must contain:

```text
# PHASE 3 — UI-C9 — BOOKING UI MIGRATION — AUDIT-FIRST MAPPING REPORT

## 1. Executive Summary
## 2. Baseline / Governance
## 3. Booking Detail Current Architecture
## 4. Canonical Shell Comparison
## 5. Booking Action Inventory
## 6. Booking Status / Lifecycle
## 7. Server Authority / RBAC
## 8. API / DTO / Schema
## 9. Finance / D7 Compliance
## 10. Commerce Relation Chain
## 11. Timeline / Operational Notes / Audit
## 12. i18n Audit
## 13. Accessibility Audit
## 14. Legacy UI Inventory
## 15. Request / Order / Booking Comparison
## 16. Test Coverage / Gaps
## 17. File-Level Migration Map
## 18. Minimal Implementation Scope
## 19. Future Qualification Contract
## 20. Debt / Roadmap Boundary
## 21. Risks
## 22. Final Verdict
```

Every important conclusion must be backed by actual source/test evidence.

---

# 25. STOP AFTER REPORT

After the audit report is complete:

**STOP.**

Do not create the UI-C9 implementation prompt.

Do not modify Booking.

Do not start UI-C15.

Do not start UI-C16.

Do not start UI-C17.

Do not start UI-C18.

The implementation prompt will be created only after the audit report is independently reviewed and accepted.

---

# 26. PRINCIPLE

UI-C9 must follow the same discipline as UI-C6, C7, and C8:

```text
AUDIT
  ↓
independent review
  ↓
minimal implementation scope
  ↓
implementation
  ↓
qualification
  ↓
independent acceptance
  ↓
TRUE NEXT
```

The goal is not to make Booking cosmetically identical to Request or Order.

The goal is:

```text
canonical Commerce Detail structure
+
existing Booking business content
+
server-authoritative Booking actions
+
consistent i18n/a11y presentation
=
UI-C9-ready implementation boundary
```

No speculative refactoring.
No business-model changes.
No security redesign.
No stage jumping.
