# PHASE 3 — COMMERCE CENTER — HELP / BUSINESS DICTIONARY FINAL MICRO-CLOSURE + DEBT REGISTER CONTENT QUALIFICATION

## ROLE — MANDATORY

Ты работаешь как **Staff/Principal Product Architect + Enterprise SaaS Information Architect + Staff Full-Stack Engineer + Security/RBAC Reviewer + Data/Analytics Contract Reviewer + QA/Release Engineer**.

Это **узкий FINAL MICRO-CLOSURE** архитектурного Help / Business Dictionary Addendum.

Не выполнять production implementation.
Не начинать D8.
Не переоткрывать D5/D6/D7 или принятый Commerce UI Design Contract.

---

# 1. CANONICAL STARTING STATE

Reconcile фактический Git state с reported baseline:

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED

COMMERCE UI DESIGN CONTRACT — ACCEPTED

HELP / BUSINESS DICTIONARY ADDENDUM
— CONDITIONALLY COMPLETE
— FINAL ACCEPTANCE PENDING

DEBT REGISTER
— REPORTED AS ESTABLISHED
— CONTENT QUALIFICATION PENDING

REPORTED ADDENDUM SHA:
456f2abf5ec7d420d4320eff94fac5169b550832

D8 — NOT STARTED
```

В начале показать:

```bash
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline
```

Если HEAD отличается от reported SHA, объяснить каждый промежуточный commit и доказать, что accepted baseline не потерян.

---

# 2. SCOPE — ONLY FIVE CLOSURE ITEMS

Этот micro-closure разрешает закрыть только:

```text
C1 — Booking KPI final semantics
C2 — Help delivery priority contradiction
C3 — Help source-of-truth architecture decision
C4 — Formula drift mandatory automated gate
C5 — Debt Register full content qualification
```

Не расширять scope.

---

# 3. C1 — BOOKING KPI FINAL SEMANTICS

Предыдущий addendum оставил противоречие:

```text
CONFIRMED / IN_SERVICE / COMPLETED
→ semantically different lifecycle stages

но одновременно:
"split recommended"
и
"ambiguity resolved"
```

Это не final architecture decision.

## 3.1 Inspect actual D6 state machine first

До выбора KPI набора исследовать canonical Booking statuses в production code / accepted D6 contracts.

Не использовать guessed status names.

Сформировать таблицу:

| Booking Status | Exists in canonical state machine? | Meaning | Terminal? | Current registry filter? | Proposed KPI group |
|---|---:|---|---:|---:|---|

Обязательно квалифицировать, если реально существуют:

```text
CREATED
SENT_TO_SUPPLIER
AWAITING_CONFIRMATION
PARTIALLY_CONFIRMED
CONFIRMED
IN_SERVICE
COMPLETED
CANCELLED
SUPPLIER_REJECTED
```

Если фактический enum отличается — использовать фактический enum.

## 3.2 Choose ONE final KPI contract

Не оставлять:

```text
split recommended
maybe
consider
TBD
```

Принять один canonical set.

Предпочтительная operational model, если она соответствует реальной D6 state machine:

```text
Всего бронирований

Ожидают подтверждения
→ supplier/waiting states

Подтверждены
→ CONFIRMED only
  + PARTIALLY_CONFIRMED только если business semantics действительно требуют
    отдельной/явно определённой обработки

В оказании
→ IN_SERVICE

Завершены
→ COMPLETED

Отменены / отклонены
→ CANCELLED + SUPPLIER_REJECTED
```

Но repo/state-machine authority выше этого примера.

## 3.3 For every final KPI define

```text
stable metric ID
display label
business definition
exact status mapping
source
scope
formula
period semantics
inclusions
exclusions
exclusive/overlapping
reconciliation rule
server-side drill-down filter
tooltip short definition
Help topic ID
```

## 3.4 Explicitly classify PARTIALLY_CONFIRMED

Не оставлять его неопределённым.

Выбрать:

```text
own KPI
or
included in a named aggregate with explicit semantics
or
registry/filter-only
```

с rationale.

---

# 4. C2 — HELP DELIVERY PRIORITY

Предыдущий report одновременно утверждал:

```text
Help must be designed alongside Commerce UI
```

и помещал часть critical Help scope в:

```text
LATER
```

Это исправить.

## 4.1 CURRENT COMMERCE IMPLEMENTATION — REQUIRED

Следующие Help capabilities должны входить в текущую Commerce UI implementation там, где реализуются соответствующие KPI/status UI:

```text
Help metadata/topic foundation
KPI contextual ⓘ
canonical KPI definitions
formula descriptions
source/scope
status mappings
inclusions/exclusions
overlap/grouping rules
reconciliation rules
drill-down rules
workspace-aware visibility
entitlement-aware visibility
RU/AZ/EN localization contract/content required by implemented topics
/app/help core
```

## 4.2 MAY REMAIN LATER

Можно отложить только явно non-blocking polish/expansion, например:

```text
advanced fuzzy search
rich related-topic recommendations
extended tutorials
non-critical long-form guides
analytics of Help usage
editorial tooling
```

Сформировать corrected priority table:

```text
NOW
CURRENT IMPLEMENTATION
LATER
DEFERRED
```

без противоречий.

---

# 5. C3 — HELP SOURCE OF TRUTH — FINAL DECISION

Предыдущий report сказал:

```text
Shared typed registry — recommended
```

Это недостаточно.

Принять окончательное architecture decision.

## 5.1 Required ownership split

Preferred canonical model:

```text
BACKEND DOMAIN / QUERY SERVICES
= business calculation authority

SHARED TYPED METRIC/HELP REGISTRY
= metric/status metadata authority

i18n
= localized presentation text authority

HELP UI / KPI POPOVER
= consumers
```

Не переносить финансовые/аналитические вычисления во frontend registry.

## 5.2 Stable IDs

Определить stable IDs, например:

```text
orders.total
orders.active
orders.readyForBooking
bookings.awaitingConfirmation
bookings.confirmed
bookings.inService
bookings.completed
bookings.cancelled
finance.dueAmount
finance.refundableAmount
```

Имена выше — examples only.
Выбрать final naming convention.

Stable IDs:

```text
non-localized
immutable except explicit migration
used by KPI card
used by Help topic
used by tests
used by drill-down metadata
```

## 5.3 Typed schema

Зафиксировать минимум:

```ts
MetricDefinition {
  id
  domain
  titleKey
  shortDescriptionKey
  fullDescriptionKey
  source
  scope
  formulaDescriptionKey?
  statusMapping?
  periodSemantics?
  comparisonSemantics?
  currencyOrUnit?
  inclusions?
  exclusions?
  overlapRule?
  reconciliationRule
  drillDown
  workspaceAvailability
  entitlementAvailability?
  relatedMetricIds?
}
```

Это design schema, не обязательно production code на этом этапе.

---

# 6. C4 — FORMULA DRIFT — MANDATORY AUTOMATED GATE

Удалить архитектурную неопределённость:

```text
automated contract test OR manual review
```

Для critical metrics manual-only gate запрещён.

## 6.1 Required contract

```text
stable metric ID
        │
        ├── backend calculation/query
        ├── typed metadata
        ├── Help definition
        ├── KPI contextual help
        └── automated contract/reconciliation test
```

## 6.2 Critical metric classes

Минимум automated gate должен покрывать:

```text
financial derived values
Command Center KPI formulas
Orders KPI counts
Bookings KPI counts
Analytics metrics reused in UI
```

## 6.3 What tests must verify

Где применимо:

```text
metric ID exists
metadata exists
Help topic exists
formula metadata is present
status mapping matches backend/query mapping
drill-down filter maps to same scope
representative backend result reconciles with metric query/filter
workspace visibility metadata exists
```

Не пытаться сравнивать математическую формулу только как произвольную human-readable строку.

Лучше привязать test к typed/structured metadata.

## 6.4 Financial authority

Для D7:

```text
dueAmount
refundableAmount
```

backend calculation остаётся authority.

Help metadata документирует calculation, но не вычисляет значение.

---

# 7. C5 — DEBT REGISTER CONTENT QUALIFICATION

Не ограничиваться summary из предыдущего report.

Открыть и полностью проверить:

```text
docs/TRAVELHUB_DEBT_REGISTER.md
```

Если файл находится по другому canonical path — показать exact path.

## 7.1 Verify schema

Каждый item должен иметь:

```text
ID
Title
Category
Severity/Priority
Origin
Description
Why it matters
Canonical authority affected
Dependencies
Planned closure stage
Status
Acceptance condition
Closure SHA
Notes
```

Допускается эквивалентная структурированная схема, если все эти смыслы представлены.

## 7.2 Mandatory debt inventory

Проверить наличие минимум следующих долгов.

### Commerce UI

```text
UI-01 Unified Request/Order/Booking Detail
UI-02 Unified Header
UI-03 Lifecycle/Payment/Refund visual language
UI-04 Business Timeline
UI-05 Audit History
UI-06 Commerce Relation Chain
UI-07 Cards/spacing/typography/responsive
UI-08 Orders KPI reconciliation
UI-09 Bookings KPI restoration/reconciliation
```

### Help

```text
HELP-01 Left-menu Help
HELP-02 /app/help Business Dictionary
HELP-03 KPI contextual ⓘ
HELP-04 Formula/source/scope definitions
HELP-05 Status dictionary
HELP-06 overlap/reconciliation/drill-down
HELP-07 workspace/entitlement-aware Help
HELP-08 RU/AZ/EN
HELP-09 formula drift prevention
```

### Security / Workspace

```text
SEC-UI-01 Request server-authoritative actions
context-aware PLATFORM/PARTNER UI
workspace/plan/entitlement-aware menu/modules
remaining role/access visual reconciliation if applicable
```

### Data / Analytics

```text
canonical KPI/read-model consumer consistency
Marketplace vs Storefront financial metric separation where still open
```

### Finance

```text
Full Finance Center
production PSP/provider integration where deferred
payout implementation
```

### Agreement

```text
Booking Commercial Terms & Agreement Foundation
```

### Storefront subscriptions

```text
subscription implementation
host-count subscription variants
single simultaneous host login per credentials
subscription selection/onboarding page
company physical address
company legal address
director full name
accountant if required
subscription payment
electronic partner contract
```

Explicitly confirm:

```text
director personal home address is NOT required
```

## 7.3 Do not invent debt

Inspect existing docs/reports/repo for explicitly deferred/open items.

Classify only supported items.

If something is a future planned feature rather than debt, category must say:

```text
DEFERRED PRODUCT SCOPE
or
FUTURE MONETIZATION SCOPE
```

not falsely label it technical debt.

## 7.4 Detect omissions

Create table:

| Expected item | Present? | Register ID | Classification | Priority | Planned closure |
|---|---:|---|---|---|---|

Any mandatory previously-agreed item missing → add it to register during this documentation micro-closure.

---

# 8. DEBT PRIORITY RECONCILIATION

Correct sequencing.

At minimum:

## NOW / BLOCKER

```text
SEC-UI-01 Request actions server-authoritative
Booking KPI final semantic decision
```

## CURRENT COMMERCE IMPLEMENTATION

```text
Unified Detail work
Timeline/Audit/Commerce Chain
Orders KPI
Bookings KPI
Help metadata
KPI contextual help
core Business Dictionary
workspace-aware Help for implemented capabilities
formula/status/reconciliation metadata
```

## LATER

Only non-blocking improvements.

## DEFERRED

```text
Finance Center
PSP/provider expansion where intentionally deferred
Payout
Storefront subscription monetization
Agreement work if roadmap places it later
```

Preserve actual roadmap dependencies if they require a different ordering.

---

# 9. UPDATED IMPLEMENTATION PHASING

After micro-closure derive one final implementation sequence.

Expected shape:

```text
UI-C1  Shared shell/header/status foundations

UI-C2  Typed Metric/Help Registry foundation
UI-C3  Automated metric/help contract gate

UI-C4  Commerce Relation Chain
UI-C5  Business Timeline
UI-C6  Audit History

UI-C7  Request server-authority remediation
UI-C8  Request UI migration

UI-C9  Order UI migration
UI-C10 Booking UI migration

UI-C11 Orders KPI implementation + Help + drill-down
UI-C12 Bookings KPI implementation + Help + drill-down

UI-C13 /app/help core + left-menu Help
UI-C14 RU/AZ/EN qualification
UI-C15 Card/spacing/responsive/loading/error polish

UI-C16 Security/regression/browser qualification
UI-C17 Git hard closure
```

Refine only when actual dependencies justify it.

Important:

```text
SEC-UI-01 must close before Request UI migration acceptance.
```

---

# 10. REQUIRED REPORT

Create:

```text
docs/reports/PHASE_3_COMMERCE_CENTER_HELP_BUSINESS_DICTIONARY_FINAL_MICRO_CLOSURE_REPORT.md
```

Predominantly Russian.

Required sections:

1. Executive Summary
2. Starting Git State
3. Baseline Reconciliation
4. C1 Booking KPI Canonical State Machine
5. C1 Final Booking KPI Contract
6. PARTIALLY_CONFIRMED Decision
7. C2 Corrected Help Delivery Priority
8. C3 Help Source-of-Truth ADR
9. Stable Metric ID Convention
10. Typed Metric/Help Schema
11. C4 Mandatory Formula Drift Gate
12. Critical Metric Coverage
13. C5 Debt Register Content Qualification
14. Mandatory Debt Inventory Matrix
15. Missing Debt Items Added
16. Corrected Debt Priority
17. Updated Commerce Implementation Phasing
18. Security Preservation
19. Findings
20. Acceptance Matrix
21. Git Hard Closure
22. Final Verdict
23. TRUE NEXT

---

# 11. MICRO-CLOSURE ACCEPTANCE MATRIX

Do not shorten:

| Gate | Result | Exact Evidence |
|---|---|---|
| Reported starting SHA reconciled | | |
| D5 preserved | | |
| D6 preserved | | |
| D7 preserved | | |
| Commerce UI Design Contract preserved | | |
| Actual Booking state machine inspected | | |
| Every canonical Booking status classified | | |
| Final Booking KPI set chosen | | |
| No `split recommended` ambiguity remains | | |
| PARTIALLY_CONFIRMED explicitly classified | | |
| Every Booking KPI has exact status mapping | | |
| Every Booking KPI has server-side drill-down mapping | | |
| Every Booking KPI has reconciliation rule | | |
| Help priority contradiction removed | | |
| Critical contextual Help moved into current implementation | | |
| Workspace-aware Help correctly scheduled | | |
| Source-of-truth architecture DECIDED, not recommended | | |
| Backend remains calculation authority | | |
| Typed registry becomes metadata authority | | |
| Stable metric ID convention accepted | | |
| Formula drift automated gate mandatory | | |
| Manual-only critical metric gate prohibited | | |
| D7 formula authority preserved | | |
| Orders KPI automated reconciliation required | | |
| Bookings KPI automated reconciliation required | | |
| Debt Register actual file inspected | | |
| Debt Register schema qualified | | |
| UI debts present | | |
| Help debts present | | |
| SEC-UI-01 present | | |
| Workspace debts present | | |
| Data/Analytics debts present | | |
| Finance Center present/deferred | | |
| PSP/provider debt/scope present if applicable | | |
| Payout scope present | | |
| Agreement Foundation present | | |
| Storefront subscription scope present | | |
| Host-count plans preserved | | |
| Single simultaneous host login preserved | | |
| Partner onboarding/data requirements preserved | | |
| Electronic contract preserved | | |
| Director personal address correctly excluded | | |
| Future scope not mislabeled as technical debt | | |
| Missing agreed items added | | |
| Debt priority corrected | | |
| Final implementation phasing derived | | |
| SEC-UI-01 precedes Request migration acceptance | | |
| No production implementation started | | |
| D8 not started | | |
| Final porcelain empty | | |
| HEAD == origin/master | | |
| One canonical 40-char Final SHA | | |

Any:

```text
FAIL
NOT PROVEN
NOT RUN where evidence is required
unresolved architecture contradiction
```

→ VERDICT B.

---

# 12. SECURITY PRESERVATION

No changes may weaken:

```text
server-side RBAC
workspace/tenant isolation
cross-context 404-like behavior
D5 Order action authority
D6 Booking action authority
D7 backend financial authority
audit immutability
PCI/PII safety
```

Explicitly preserve:

```text
wrong workspace / tenant / business context
→ NOT FOUND semantics
→ no existence leakage
```

---

# 13. DOCUMENTATION CHANGES ALLOWED

Allowed:

```text
Help architecture report correction
Debt Register corrections/additions
ADR/architecture documentation
implementation phasing documentation
```

Not allowed:

```text
production UI code
production API behavior changes
Request action implementation
KPI implementation
/app/help implementation
D8
```

SEC-UI-01 is only scheduled/qualified here; implementation happens in Commerce implementation.

---

# 14. GIT HARD CLOSURE

At end:

```bash
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline
```

Commit and push all documentation artifacts.

Then repeat:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

Required literal evidence:

```text
$ git status --porcelain=v1
<NO OUTPUT>

$ git rev-parse HEAD
<ONE 40-CHAR SHA>

$ git rev-parse origin/master
<SAME SHA>
```

---

# 15. VERDICT A

Only if all micro-gates pass:

```text
VERDICT A — PHASE 3 COMMERCE CENTER HELP / BUSINESS DICTIONARY FINAL MICRO-CLOSURE PASSED

COMMERCE UI DESIGN CONTRACT — ACCEPTED
HELP / BUSINESS DICTIONARY CONTRACT — ACCEPTED
DEBT REGISTER — QUALIFIED AND ACCEPTED

FINAL SHA:
<one canonical 40-char SHA>

TRUE NEXT:
PHASE 3 — COMMERCE CENTER UI CONSISTENCY — IMPLEMENTATION

D8 — NOT STARTED
```

Then STOP.

---

# 16. VERDICT B

If any blocker remains:

```text
VERDICT B — PHASE 3 COMMERCE CENTER HELP / BUSINESS DICTIONARY FINAL MICRO-CLOSURE FAILED

HELP / BUSINESS DICTIONARY CONTRACT — NOT YET ACCEPTED
DEBT REGISTER — NOT YET QUALIFIED

TRUE NEXT:
FINAL MICRO-CLOSURE CONTINUATION

D8 — NOT STARTED
```

List exact blockers and STOP.

---

# 17. HARD STOP

This stage ends after documentation + debt qualification + Git closure.

Do not start Commerce production implementation in the same run.
Do not start D8.
