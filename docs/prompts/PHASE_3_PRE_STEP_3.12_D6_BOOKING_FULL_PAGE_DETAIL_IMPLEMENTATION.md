# PHASE 3 — PRE-STEP 3.12 — D6 — BOOKING FULL-PAGE DETAIL IMPLEMENTATION

## ROLE — MANDATORY
Ты работаешь как **Staff/Principal Full-Stack Engineer + Enterprise SaaS Architect + Security Engineer + QA/Release Engineer**.

Canonical baseline:
```text
D5 — ACCEPTED
D5 FINAL SHA: 43dc1065729875ed60970361abeae4374d442d75
D6 — NOT STARTED
```

## 1. OBJECTIVE
Реализовать canonical **Booking Full-Page Detail**:
```text
/app/bookings/{bookingId}
```
с navigation consistency, server-authoritative actions/state machine, explicit editing/mutability contract, immutable change history и integration с принятым cross-cutting audit framework.

Legacy drawer/Quick Preview может остаться только вторичным preview surface, не альтернативным detail contract.

## 2. ARCHITECTURE PRINCIPLES
Наследовать квалифицированные D5 принципы:
- server-side authority;
- workspace/tenant/direct-ID isolation;
- canonical full-page;
- state-machine-driven actions;
- explicit mutability;
- immutable accountability;
- PII-safe audit;
- DB→API→UI→Audit reconciliation;
- hard-refresh persistence.

Не копировать Order lifecycle механически: Booking имеет собственную семантику.

## 3. CURRENT-STATE RECONCILIATION FIRST
До production changes исследовать Booking schema/entity, controllers/routes/services, registry/drawer UI, statuses/transitions, Payment relation, Order↔Booking и Request↔Order↔Booking chain, travelers/passengers, finance/supplier fields, history/audit, RBAC, tenant/workspace filtering и tests.

Report:
| Area | Current implementation | Canonical D6 target | Gap |

Не придумывать lifecycle, если canonical contract уже существует.

## 4. FULL-PAGE CONTRACT
Если данные существуют в модели, detail включает:
- breadcrumb `TravelHub / Бронирования / {reference}`;
- reference, status, payment status, amount/currency, timestamps;
- server-authoritative `availableActions`;
- related Request → Order → Booking links;
- customer/traveler/passenger data по PII policy;
- product/service/supplier/dates/guests;
- financial section: total/paid/refunded/payment status;
- operational metadata/external reference;
- immutable chronological history.

Order link → accepted D5 route `/app/orders/{orderId}`.

## 5. STATE MACHINE
Извлечь фактический Booking enum/transitions и создать:
| Current Status | Allowed Action | Next Status | Preconditions | Terminal restriction |

Rules:
```text
UI action only if server authorizes
direct API enforces same transition
invalid transition → controlled 4xx
terminal state illegal mutation denied
double-submit safe/idempotent where applicable
```

## 6. MUTABILITY CONTRACT
Для каждого editable domain:
| Field/domain | Editable when | Locked when | Permission | Audit |

Проверить dates, supplier/external reference, passengers, operational metadata, finance/status fields. System/financial-derived fields не делать arbitrary editable. Final/terminal locking — согласно lifecycle.

## 7. IMMUTABLE AUDIT
Интегрировать Booking в существующий cross-cutting framework, не создавать параллельную систему.

Meaningful mutation:
```text
entityType=Booking
entityId
action/event
actor
timestamp
source/context
safe previous/current OR lifecycle from/to
```
Append-only, server-generated, non-spoofable, workspace-safe, PII-safe. Не фабриковать legacy source.

## 8. ATOMICITY
Business mutation + required audit = одна atomic unit:
```text
mutation success → audit exists
audit failure → mutation rollback
business failure → no false success audit
```
Добавить representative failure-injection test с forced audit failure.

## 9. CONCURRENCY / TOCTOU
Проверить applicable races:
- edit ↔ terminal/final transition;
- double transition;
- conflicting lifecycle actions;
- payment/booking interaction, если применимо.

Не использовать process-local mutex как authority. DB transaction/locking/optimistic concurrency — только если invariant реально требует.

## 10. DIRECT-ID / TENANT SECURITY
Аудировать все Booking ID-based surfaces: detail, history, mutations/actions, passenger endpoints, financial/payment subresources, notes/export/documents если есть.

Для каждого:
```text
authorized → allowed
wrong workspace/tenant/partner → canonical 404/denial
```
List filtering не заменяет direct-ID protection. Для isolation использовать существующий cross-context DB row, не random nonexistent UUID. No existence leakage.

## 11. RBAC
Проверить authorized operational role, read-only role, unauthenticated, wrong workspace/tenant. Frontend hiding не заменяет backend denial. Не расширять permissions молча.

## 12. API CONTRACT
Detail API должен позволять UI не угадывать бизнес-логику. При необходимости: booking, relations, availableActions, capabilities, history metadata. DTO validation, mass-assignment protection, compatibility/tests обязательны.

## 13. FRONTEND
Canonical `/app/bookings/{id}`:
- loading/success/not-found/error;
- hard refresh/deep-link;
- responsive full-page;
- registry reference/row → full-page;
- Quick Preview только explicit secondary control;
- legacy drawer не canonical detail.

## 14. NAVIGATION
Проверить:
```text
Bookings registry → Booking
Order → related Booking
Booking → related Order
breadcrumbs
Back
hard refresh
direct URL
```

## 15. DRAWER PARITY
Если preview остаётся: same server status/action authority/permissions/isolation/core financial values. Preview может показывать меньше, но не противоречить full-page.

## 16. I18N
No raw translation keys. Использовать canonical translation layer существующих локалей. Backend не hardcode language-specific semantics.

## 17. REPRESENTATIVE DATA
Нужны safe representatives/isolated fixtures:
- active/non-terminal;
- confirmed/paid where applicable;
- terminal/cancelled/completed;
- related Order;
- cross-context isolation.
Destructive browser flows — только disposable fixture.

## 18. AUTOMATED TESTS
Минимум:

Detail:
```text
authorized detail
not-found
wrong-context direct-ID
related Order
availableActions
```
Lifecycle:
```text
valid/invalid transition
terminal denial
double-submit/concurrency where applicable
```
Mutability:
```text
allowed edit
locked edit
validation
mass assignment
```
Audit:
```text
success → event
safe diff/from-to
actor/source
PII masking
failed mutation → no false audit
forced audit failure → rollback
```
Security:
```text
unauthenticated
unauthorized role
wrong tenant/workspace
cross-context detail/history/action
```

## 19. REAL BROWSER EVIDENCE — MANDATORY
E2E/API не заменяют browser.

### A Registry → full-page
Open `/app/bookings`, click real reference → `/app/bookings/{id}`, full-page, hard refresh.

### B Lifecycle
Disposable non-terminal Booking → actual UI action → status/actions update → refresh → `DB==API==UI==Audit`.

### C Edit/mutability
Actual legitimate UI edit → save → refresh → reconciliation. Если canonical field не editable, доказать lock, не изобретать editability.

### D Terminal/final lock
Terminal Booking → forbidden mutations absent/disabled; direct server attempt denied; DB unchanged; no success audit.

### E Related Order
Booking → Order link → `/app/orders/{orderId}` accepted D5 page.

### F Cross-context direct-ID
Existing cross-context Booking DB row → unauthorized browser direct URL → canonical not-found/no data. Same history/action denied.

### G History
Browser history показывает фактическую lifecycle/edit mutation, safe actor/source/diff.

Для каждого: URL, actor/workspace, initial state, UI control, browser action, visible result, API/DB/audit reconciliation, refresh result, PASS/FAIL.

## 20. DB→API→UI→AUDIT
Mandatory:
```text
lifecycle: DB status == API == UI == Audit from/to
editable data: DB == API == UI == safe audit diff
relations: DB == API == UI navigation
security: cross-context DB row EXISTS while unauthorized API/UI denied
```

## 21. REGRESSION
Run all D6 suites + affected Booking tests + relevant D5 Order full-page regression.

Engineering:
```text
backend tsc
backend build
frontend tsc
frontend build
frontend vitest
```
Known/pre-existing failures classify honestly.

## 22. SECURITY MATRIX
Report:
| Area | Result | Evidence |
|---|---|---|
| Direct-ID isolation | | |
| History isolation | | |
| Action isolation | | |
| Cross-tenant/workspace | | |
| RBAC | | |
| Mass assignment | | |
| PII safety | | |
| Audit spoofing | | |
| False-audit prevention | | |
| Audit rollback | | |
| Terminal immutability | | |
| TOCTOU/concurrency | | |
| Existence leakage | | |

Any acceptance-blocking P0/P1/P2 → D6 not accepted.

## 23. GIT DISCIPLINE
Before work:
```bash
git branch --show-current
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline
```
Reconcile with D5 SHA `43dc1065729875ed60970361abeae4374d442d75`; explain deviation.

After all code/tests/browser/report, commit+push, then literal:
```text
$ git status --porcelain=v1
<NO OUTPUT>

$ git rev-parse HEAD
<40-char SHA>

$ git rev-parse origin/master
<same 40-char SHA>
```
One canonical Final SHA.

## 24. REQUIRED REPORT
Create:
```text
docs/reports/PHASE_3_PRE_STEP_3.12_D6_BOOKING_FULL_PAGE_DETAIL_IMPLEMENTATION_REPORT.md
```
Predominantly Russian.

Sections:
1 Executive Summary
2 Starting Git State
3 D5 Baseline Preservation
4 Current Booking Architecture
5 Gap Analysis
6 Canonical Detail Contract
7 State Machine
8 Mutability Contract
9 Backend/API Changes
10 Frontend Changes
11 Navigation
12 Related Order Integration
13 Audit Integration
14 Atomicity
15 Concurrency/TOCTOU
16 Workspace/Tenant/Direct-ID Isolation
17 RBAC
18 ID-Based Endpoint Audit
19 Representative Dataset
20 Automated Tests
21 Browser A
22 Browser B
23 Browser C
24 Browser D
25 Browser E
26 Browser F
27 Browser G
28 DB→API→UI→Audit
29 Security Re-qualification
30 Regression Matrix
31 Findings
32 Complete Acceptance Matrix
33 Git Hard Closure
34 Final Verdict
35 TRUE NEXT

## 25. COMPLETE ACCEPTANCE MATRIX
| Gate | Result | Exact Evidence |
|---|---|---|
| Starting Git baseline reconciled | | |
| D5 baseline preserved | | |
| Current Booking architecture documented | | |
| Canonical full-page route | | |
| Registry → full-page | | |
| Direct URL + hard refresh | | |
| Loading/not-found/error states | | |
| Detail API authoritative | | |
| State-machine documented | | |
| availableActions server-authoritative | | |
| Valid transition | | |
| Invalid transition denied | | |
| Terminal mutation denied | | |
| Mutability matrix | | |
| Allowed edit enforced | | |
| Locked edit enforced | | |
| Mass assignment denied | | |
| Immutable history | | |
| Audit actor/source safe | | |
| Audit PII safe | | |
| Successful mutation → audit | | |
| Failed mutation → no false audit | | |
| Forced audit failure → rollback | | |
| Applicable concurrency invariant | | |
| Booking → Order navigation | | |
| Related Order authorization safe | | |
| Workspace/tenant list isolation | | |
| Cross-context detail isolation | | |
| Cross-context history isolation | | |
| Cross-context action isolation | | |
| Other Booking ID endpoints audited | | |
| RBAC server-side | | |
| Drawer/full-page parity if retained | | |
| i18n no raw keys | | |
| Browser A | | |
| Browser B | | |
| Browser C | | |
| Browser D | | |
| Browser E | | |
| Browser F existing cross-context object | | |
| Browser G history | | |
| Lifecycle DB==API==UI==Audit | | |
| Editable data DB==API==UI==Audit | | |
| D6 automated suites PASS | | |
| Relevant D5 regression PASS | | |
| Backend TSC | | |
| Backend build | | |
| Frontend TSC | | |
| Frontend build | | |
| Frontend vitest honestly classified | | |
| No unresolved P0/P1 | | |
| No acceptance-blocking P2 | | |
| Next stage NOT STARTED | | |
| Report predominantly Russian | | |
| Final porcelain literally EMPTY | | |
| HEAD==origin/master | | |
| One canonical 40-char SHA | | |

`NOT RUN`, `NOT PROVEN`, `FAIL`, acceptance-blocking `PARTIAL` → VERDICT B.

## 26. PROHIBITIONS
Do NOT:
- start next stage;
- redesign D5;
- invent unsupported Booking statuses;
- make financial/system fields arbitrary editable;
- rely on frontend-only security;
- expose cross-context Booking by UUID;
- fabricate legacy audit source;
- log plaintext sensitive PII;
- substitute E2E for mandatory browser evidence;
- use nonexistent random UUID for isolation;
- claim Git clean before report/prompt are committed.

## 27. FINAL VERDICT
Only if every gate passes:
```text
VERDICT A — PHASE 3 PRE-STEP 3.12 D6 BOOKING FULL-PAGE DETAIL PASSED

D6 — ACCEPTED

FINAL SHA:
<one canonical 40-char SHA>

TRUE NEXT:
<derive next canonical PRE-STEP 3.12 stage from roadmap/architecture; do not implement>

NEXT STAGE IMPLEMENTATION — NOT STARTED
```
Then STOP.

Otherwise:
```text
VERDICT B — PHASE 3 PRE-STEP 3.12 D6 BOOKING FULL-PAGE DETAIL FAILED

D6 — NOT ACCEPTED

TRUE NEXT:
D6 REMEDIATION / EVIDENCE CLOSURE

NEXT STAGE — NOT STARTED
```

## 28. HARD STOP
This prompt authorizes D6 only. At completion: report + verdict + final SHA + TRUE NEXT + STOP.
