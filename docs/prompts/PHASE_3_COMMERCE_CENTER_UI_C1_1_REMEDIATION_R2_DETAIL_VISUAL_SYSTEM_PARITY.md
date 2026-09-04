# PHASE 3 — COMMERCE CENTER UI-C1.1 — REMEDIATION R2
# DETAIL VISUAL SYSTEM PARITY + REGISTRY MICRO-CLOSURE

## 1. CANONICAL BASELINE

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED

UI-C1.1 REMEDIATION R1:
REGISTRY KPI PARITY — PROVISIONALLY PASS
DETAIL VISUAL PARITY — FAIL

UI-C1.1 OVERALL — VERDICT B
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

R1 reported SHA `4567815f90b3bdef5b64cf214bda98d2a0ba02ea`. Verify actual HEAD/origin before work.

## 2. PURPOSE

Browser review proves that the three canonical detail pages still use materially different visual systems:

```text
/app/requests/[id]
/app/orders/[id]
/app/bookings/[id]
```

Observed:

```text
Request Detail = Design A
Order Detail   = Design B
Booking Detail = Design C
```

R2 must make them visibly one Commerce Detail Design System while preserving entity-specific business content.

Canonical principle:

```text
UNIFIED STRUCTURE
≠
IDENTICAL BUSINESS CONTENT
```

## 3. STRICT SCOPE

### P0
Unify visual system of all three detail pages:
- shell/header grammar;
- section cards;
- typography;
- field label/value hierarchy;
- grids;
- spacing/vertical rhythm;
- links;
- badges;
- empty values;
- timeline presentation;
- relation presentation;
- finance cells where equivalent;
- notes/audit containers.

### P1 registry micro-closure
Close only already-discovered defects:
1. TOTAL naming:
   - Requests → `Всего заявок`
   - Orders → `Всего заказов`
   - Bookings → `Всего бронирований`
2. TOTAL KPI:
   - not full-width;
   - ordinary KPI cards unchanged;
   - TOTAL ~15–20% larger than ordinary status KPI;
   - slightly larger label/value typography;
   - same rule on all three registries.
3. Audit current date-filter/period behavior and prove KPI/table scope consistency where filters exist.

### OUT OF SCOPE
Do NOT start UI-C2, UI-C3+, D8, SEC-UI-01 remediation, commission/pricing redesign, new state machines, unrelated backend refactors.

## 4. ABSOLUTE PRESERVATION GATES

Do not regress:
- D5 Order server-authoritative actions;
- D6 Booking server-authoritative actions;
- D7 backend-authoritative finance;
- server-side RBAC;
- workspace/tenant isolation;
- cross-context 404-like behavior;
- audit immutability;
- lifecycle state machines;
- KPI backend aggregation;
- live server-side search;
- KPI drill-down;
- canonical status naming.

SEC-UI-01 remains OPEN. No privilege expansion.

## 5. PRE-IMPLEMENTATION AUDIT

Before editing, inspect actual code and produce exact BEFORE matrix:

| Property | Request | Order | Booking | Divergence |
|---|---|---|---|---|
| Shell | | | | |
| Header | | | | |
| Main/sidebar layout | | | | |
| Section card | | | | |
| Section title | | | | |
| Field grid | | | | |
| Field label typography | | | | |
| Field value typography | | | | |
| Link typography | | | | |
| Status badge | | | | |
| Card padding | | | | |
| Radius/border | | | | |
| Section/field gaps | | | | |
| Empty value | | | | |
| Finance | | | | |
| Timeline | | | | |
| Relations | | | | |
| Notes | | | | |
| Audit | | | | |

Use exact component/class/token evidence. Component names alone are not proof.

## 6. ONE SHARED DETAIL VISUAL CONTRACT

Establish/reuse one source of visual truth equivalent to:

```text
EntityDetailShell
EntityDetailHeader
EntitySectionCard
EntitySectionTitle
EntityFieldGrid
EntityField
EntityFieldLabel
EntityFieldValue
EntityEmptyValue
EntityLink
EntityStatusBadges
EntityActionBar
EntityTimeline
EntityAuditHistory
```

Exact names may follow codebase conventions. Page files should mainly supply data/business sections/semantic props, not competing typography/card systems.

## 7. TYPOGRAPHY HARD GATE

One exact token/class contract across all three for:
- page title;
- secondary/reference ID;
- section title;
- field label;
- field value;
- secondary/meta value;
- link;
- empty value;
- timeline milestone title/time.

Forbidden: uppercase labels on one entity but not another, different equivalent font sizes/weights, different link/empty-value grammar.

Report exact AFTER classes/tokens.

## 8. SECTION CARD HARD GATE

Equivalent sections use:
```text
same border
same radius
same background
same padding
same section-title spacing
same field-grid spacing
same vertical rhythm
```

Do not leave large Request/Order groups floating directly on page while Booking uses cards.

Every meaningful group must be intentionally classified as HEADER, SECTION CARD, TIMELINE, RELATION PRESENTATION, NOTES, or AUDIT.

## 9. CANONICAL COMPOSITION

Use the same high-level grammar where applicable:

```text
Breadcrumbs
Entity Detail Header
────────────────────────────────────────
MAIN CONTENT                    BUSINESS TIMELINE
Entity-specific cards           Current stage
Finance where applicable        Milestones
Service / Items / Overview      Dates

Relations
Notes
Audit History
```

Do not force irrelevant/empty sections merely for symmetry.

## 10. ENTITY CONTENT REMAINS DIFFERENT

Request may contain client, service, supplier, request pricing, decisions, conversion.
Order may contain client, seller, items, travelers, lifecycle, finance, Request/Booking references.
Booking may contain service, provider, service date/time, travelers, lifecycle, linked Order finance.

Do not copy fields solely for symmetry.

## 11. TIMELINE != AUDIT

```text
EntityTimeline = business milestones / current stage
EntityAuditHistory = immutable who changed what and when
```

Do not merge them. Preserve Booking's useful timeline concept and bring applicable Request/Order lifecycle presentation into the same visual grammar without inventing events.

## 12. RELATIONS — UI-C2 MUST NOT START

In R2 only:
- normalize typography/card treatment of existing relation references;
- localize visible status labels;
- remove raw enum leakage;
- preserve existing navigation.

Do NOT implement final Request → Order → Booking CommerceRelationChain. That is UI-C2.

## 13. RAW ENUM LEAKAGE — HARD FAIL

No visible raw enums where localized labels exist, including:
`CONVERTED`, `CANCELLED`, `READY_FOR_BOOKING`, `CONFIRMED`, `ACCEPTED`.

Use canonical i18n/status resolver on linked Request/Order/Booking and decision statuses where mappings exist. RU/AZ/EN parity required on touched surfaces.

## 14. REQUEST DETAIL

Normalize into shared grammar, e.g.:
```text
OVERVIEW
PRICING
REQUEST LIFECYCLE / DECISIONS
RELATIONS
NOTES
AUDIT
```
Preserve real Request business content. Do not implement SEC-UI-01. Do not redesign pricing/commission model.

## 15. ORDER DETAIL

Current Finance card may remain conceptually, but group remaining information intentionally:
```text
FINANCE
OVERVIEW / CLIENT & PARTNER
ITEMS
ORDER LIFECYCLE
RELATIONS
NOTES
AUDIT
```
Preserve D5 and D7. Never frontend-recalculate `dueAmount` or `refundableAmount`. If wrong/missing, report backend/API evidence.

## 16. BOOKING DETAIL

Normalize its strong card/sidebar composition into the same shared system:
- section titles;
- field typography;
- card geometry;
- spacing;
- links;
- empty values;
- finance;
- notes/audit.

Preserve D6 and D7 linked Order finance authority.

## 17. FINANCE VISUAL CONTRACT

Equivalent finance cells on Order/Booking must share label/value typography, padding, radius, spacing, semantic accent rules.

Business fields may differ. Do not add Order/Booking finance to Request if inapplicable.

If `Дата услуги` is currently inside Booking Finance, classify whether it semantically belongs there or Service/Overview; change only when current business contract supports it and document rationale.

## 18. HEADER PARITY

All three use same grammar:
```text
Breadcrumbs
Primary entity ID/title
Secondary/reference IDs
Lifecycle badge
Payment badge where applicable
Action bar
Back-to-list
```

Avoid unnecessary primary-ID duplication.

Do not show technical empty-action text such as `Для текущего статуса команд нет`; omit empty action area or use shared user-facing treatment.

## 19. TOTAL KPI MICRO-CLOSURE

Apply to `/app/requests`, `/app/orders`, `/app/bookings`.

RU:
```text
Всего заявок
Всего заказов
Всего бронирований
```
plus corresponding AZ/EN equivalents.

TOTAL:
- same visual language;
- ~15–20% larger than ordinary KPI;
- slightly larger typography;
- NOT full-width;
- ordinary lifecycle/payment cards unchanged;
- identical TOTAL rule on all 3.

Prove actual classes/dimensions.

## 20. DATE FILTER / PERIOD AUDIT

Audit:

| Registry | Date filter exists? | Date field | Backend param | KPI same scope? | Table same scope? |
|---|---|---|---|---|---|

Requests has multiple date concepts (service date, created date, SLA deadline). Do NOT add three permanent date ranges.

Target UX direction only if actual backend contract safely supports it:
```text
[ Search ] [ Status ] [ Date type ▼ ] [ From ] [ To ] [ Export ]
```

Date types must come from actual backend/query support. Preferred default may be `createdAt` only if supported/canonical. Never fake client-side filtering.

For every existing/legitimately implemented period filter:
```text
date change → page=1 → server query → KPI refresh + table refresh
KPI period scope == table period scope
```

Report field, from/to semantics, timezone, inclusive/exclusive rule if determinable. No stale KPI and no client-side period counting.

## 21. PRICING/COMMISSION REDESIGN OUT OF SCOPE

Do not create/rename fields based on assumptions around:
```text
Supplier Price + Commission = Selling Price
```
Only report current Request pricing fields/backend meanings if readily determinable. Any commission model change requires separate reconciliation.

## 22. RESPONSIVE + ACCESSIBILITY

Changed detail system must not break desktop/tablet/mobile. Browser-qualify representative widths for all three.

Preserve/improve semantic headings, keyboard interaction, visible focus, textual status meaning, labels, and existing aria semantics.

## 23. TESTS

Add/update focused tests where appropriate proving:
- all 3 details consume canonical section/field primitives;
- raw enum leakage removed on touched surfaces;
- TOTAL labels canonical;
- TOTAL special size variant vs normal status cards;
- action authority not moved client-side.

Run:
- frontend typecheck;
- frontend build;
- relevant frontend tests;
- D5 targeted regression;
- D6 targeted regression;
- D7 finance regression;
- relevant backend tests only if backend touched.

Any baseline failure claimed pre-existing must be demonstrated.

## 24. BROWSER QUALIFICATION — MANDATORY

Real browser evidence:
```text
/app/requests/[id]
/app/orders/[id]
/app/bookings/[id]
/app/requests
/app/orders
/app/bookings
```

Comparable screenshots required.

AFTER matrix:

| Property | Request | Order | Booking | Canonical | Result |
|---|---|---|---|---|---|
| Header grammar | | | | shared | |
| Section title | | | | shared | |
| Field label | | | | shared | |
| Field value | | | | shared | |
| Card radius/border | | | | shared | |
| Card padding | | | | shared | |
| Section/grid gaps | | | | shared | |
| Link style | | | | shared | |
| Empty value | | | | shared | |
| Timeline | | | | shared where applicable | |
| Relations | | | | shared grammar | |
| Finance cells | | | | shared where equivalent | |

Source-code claims without browser proof are insufficient.

Visual acceptance:
```text
same product
same design system
same typography hierarchy
same card grammar
same spacing grammar
same field grammar
same header grammar
+
different entity-specific business content
```

If they still look independently designed → FAIL.

## 25. REQUIRED REPORT

Create:
`docs/reports/PHASE_3_COMMERCE_CENTER_UI_C1_1_REMEDIATION_R2_DETAIL_VISUAL_SYSTEM_PARITY_REPORT.md`

Sections:
1. Executive Summary
2. Canonical Baseline
3. Starting Git State
4. R1 Claims Re-qualified
5. BEFORE Detail Visual Matrix
6. Shared Detail Visual Contract
7. Shared Typography Contract
8. Shared Section Card Contract
9. Header Parity
10. Request Detail Remediation
11. Order Detail Remediation
12. Booking Detail Remediation
13. Finance Visual Parity
14. Timeline vs Audit Preservation
15. Relation Presentation (UI-C2 not started)
16. Raw Enum Leakage Reconciliation
17. TOTAL KPI Micro-Closure
18. Date Filter Audit
19. Period Consistency Evidence
20. File Change Inventory
21. Tests
22. Regression Results
23. Browser Qualification
24. AFTER Detail Visual Matrix
25. Screenshot Evidence
26. Security Preservation
27. Remaining Debt / Non-Scope
28. Acceptance Matrix
29. Git Hard Closure
30. Final Verdict
31. TRUE NEXT

## 26. ACCEPTANCE GATES

Mandatory:
- D5/D6/D7 preserved;
- shared detail shell/header/card/typography/field/link/empty-value grammar on all 3;
- no accidental free-floating detail groups;
- finance authority preserved;
- Timeline != Audit;
- UI-C2 not started;
- raw enum leakage removed on touched detail surfaces;
- RU/AZ/EN touched-surface parity;
- TOTAL labels exactly canonical;
- TOTAL not full-width;
- TOTAL ~15–20% larger;
- ordinary KPI sizes unchanged;
- date-filter audit complete;
- existing period KPI/table scope reconciled;
- no client-side period counting;
- frontend typecheck/build/tests;
- D5/D6/D7 regressions;
- real browser detail parity;
- no introduced desktop/tablet/mobile breakage;
- SEC-UI-01 still OPEN;
- D8 NOT started;
- final porcelain empty;
- HEAD == origin/master;
- one canonical 40-char SHA.

Any unproven P0 detail parity gate → `VERDICT B`.

## 27. GIT HARD CLOSURE

Before verdict:
```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

Required:
```text
porcelain empty
HEAD == origin/master
one canonical 40-char SHA
```

Prompt/report files must not remain accidental untracked repo files.

## 28. FINAL VERDICT RULE

Only if all P0 gates pass:

```text
VERDICT A — UI-C1.1 REMEDIATION R2 — DETAIL VISUAL SYSTEM PARITY PASSED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED AFTER R2

FINAL SHA:
<40-char SHA>

TRUE NEXT:
UI-C2 — COMMERCE RELATION CHAIN

D8 — NOT STARTED
```

Otherwise:
```text
VERDICT B — UI-C1.1 REMEDIATION R2 INCOMPLETE
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

Do not self-waive failed visual gates.

## 29. FINAL PRINCIPLE

```text
REQUEST DETAIL
ORDER DETAIL
BOOKING DETAIL

DIFFERENT BUSINESS CONTENT
        +
ONE VISUAL SYSTEM
        =
TRAVELHUB COMMERCE CENTER
```
