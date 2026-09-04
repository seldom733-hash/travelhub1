# PHASE 3 — PRE-STEP 3.12 — D7 — PAYMENT / REFUND SEMANTICS + FINANCIAL PRESENTATION — IMPLEMENTATION

## ROLE — MANDATORY

Ты работаешь как **Staff/Principal Full-Stack Engineer + Payments/FinTech Architect + Enterprise SaaS Architect + Security Engineer + QA/Release Engineer**.

Это первый implementation round **D7** после окончательного acceptance D6.

Canonical baseline:

```text
D5 — ACCEPTED
D6 — ACCEPTED

D6 FINAL SHA:
31cf883c948e5e2c2d3d5e751f0057a079d9d3eb

D7 — NOT STARTED

TRUE NEXT:
D7 — PAYMENT/REFUND SEMANTICS
     + FINANCIAL PRESENTATION
```

D5/D6 нельзя переоткрывать без реально обнаруженной regression.

---

# 1. PRIMARY OBJECTIVE

Реализовать и квалифицировать canonical **Payment / Refund semantics + Financial Presentation** для commerce chain TravelHub.

D7 должен обеспечить единое, непротиворечивое представление финансового состояния на связанных surfaces:

```text
Request
→ Order
→ Booking
→ Payment / Refund
```

и, где применимо:

```text
Orders registry/detail
Bookings registry/detail
financial sections
history/audit
Command Center / Analytics consumers
future Finance surfaces
```

Ключевая цель:

```text
Booking/Order lifecycle status
≠
Payment status
≠
Refund status
```

Эти измерения должны быть явно разделены, но согласованы бизнес-инвариантами.

---

# 2. HARD SCOPE CONTROL

D7 НЕ является:

```text
полной реализацией Finance Center
новым payment provider integration
редизайном D5 Order Full-Page
редизайном D6 Booking Full-Page
новой бухгалтерской системой
payout/subscription implementation
```

D7 — это canonical semantics + authoritative calculation/presentation + security/audit/regression qualification для существующего commerce payment/refund domain.

Не начинать следующий этап.

---

# 3. STAGE A — CURRENT-STATE RECONCILIATION FIRST

До production changes исследовать фактическую реализацию:

```text
Payment schema/entity
Refund schema/entity or refund representation
Booking financial fields
Order financial fields
payment/refund services/controllers
payment provider/webhook/event handling
StripeEvent or equivalent provider event persistence
amount/currency fields
payment status enums
refund status enums
Order status
Booking status
payment ↔ booking/order relations
partial/full payment support
partial/full refund support
idempotency mechanisms
financial audit/history
RBAC
workspace/tenant isolation
existing UI financial sections
registry financial columns/badges
analytics/command-center consumers
existing tests
```

Создать:

| Area | Current implementation | Canonical D7 target | Gap |
|---|---|---|---|

Не придумывать поддержку partial payments/refunds, если модель её фактически не поддерживает.

Не скрывать архитектурные противоречия.

---

# 4. CANONICAL FINANCIAL TERMINOLOGY

Сначала определить и документировать фактические canonical concepts.

Минимум рассмотреть:

```text
gross/booking/order amount
amount due
amount paid
amount refunded
net collected / net paid where applicable
currency
payment status
refund status
payment method/provider where safe
provider transaction/reference
payment timestamps
refund timestamps
```

Если часть терминов не существует в модели — отметить `N/A`, не фабриковать.

Обязательно определить источник истины каждого financial field.

Required matrix:

| Financial concept | Source of truth | Derived? | Mutable by user? | Audit required? |
|---|---|---|---|---|

---

# 5. PAYMENT STATUS SEMANTICS

Извлечь фактический Payment enum/status model.

Создать canonical matrix:

| Payment status | Meaning | Preconditions | Amount invariant | Terminal? | UI label |
|---|---|---|---|---|---|

Проверить, где применимо:

```text
pending / awaiting payment
paid / succeeded
failed
cancelled
partially paid
refunded / partially refunded
```

Использовать только реально существующие состояния.

Hard rule:

```text
Payment status cannot be inferred solely from Booking status.
Booking status cannot be inferred solely from Payment status.
```

---

# 6. REFUND SEMANTICS

Определить фактическую модель refund.

Если Refund — отдельная entity:
- документировать lifecycle;
- relation to Payment/Booking/Order;
- amount/currency;
- provider reference;
- immutable events.

Если refund хранится иначе — документировать реальную модель.

Required invariants where applicable:

```text
refund amount > 0
refund amount <= refundable amount
cumulative refunds <= paid amount
currency matches original payment
refund cannot create negative collected amount
duplicate provider event cannot duplicate refund
```

Если partial refund не поддерживается — доказать и не имитировать его UI.

---

# 7. ORDER / BOOKING / PAYMENT STATE SEPARATION

Создать cross-domain matrix.

Пример структуры:

| Order status | Booking status | Payment status | Refund state | Valid? | UI interpretation |
|---|---|---|---|---|---|

Квалифицировать реальные representative combinations.

Особенно проверить:

```text
confirmed but unpaid
paid but service not completed
completed and paid
cancelled before payment
cancelled after payment
refunded after cancellation
payment failed while booking remains operationally open
```

Только применимые комбинации.

Не вводить artificial coupling типа:

```text
Booking COMPLETED ⇒ Payment PAID
```

если это не гарантируется бизнес-контрактом.

---

# 8. CANONICAL FINANCIAL CALCULATION

Определить authoritative formulas.

Где применимо:

```text
amountPaid
amountRefunded
amountDue
netCollected
refundableAmount
```

Required formula matrix:

| Metric | Formula | Source records | Currency rule |
|---|---|---|---|

Hard rules:

```text
no floating-point money arithmetic
use existing Decimal/minor-unit convention consistently
same financial value across API/UI/analytics
no negative due/refundable values from presentation bug
```

Если multi-currency conversion отсутствует — не выполнять implicit FX conversion.

---

# 9. FINANCIAL PRESENTATION — ORDER FULL-PAGE

Сохранить D5 architecture.

Order financial section должна показывать authoritative values, если они применимы:

```text
total/gross
paid
due
refunded
net collected
currency
payment status
refund status
payment/refund timeline/history
```

Не показывать unsupported metric.

Payment и Refund status должны визуально отличаться от Order lifecycle status.

No raw keys.

No contradictory duplicate calculation in frontend.

---

# 10. FINANCIAL PRESENTATION — BOOKING FULL-PAGE

Сохранить D6 architecture.

Booking financial section должна использовать тот же canonical financial contract.

Required consistency:

```text
same underlying payment/refund facts
same currency
same paid/refunded values
same status semantics
```

Order и Booking могут показывать разный context/aggregation только если relation/model действительно требует; разницу объяснить.

Frontend не должен независимо пересчитывать business-critical financial state.

---

# 11. REGISTRY PRESENTATION

Проверить Orders и Bookings registries.

Если показываются financial badges/amounts:

```text
same canonical source
same status labels
same currency formatting
no raw keys
no lifecycle/payment confusion
```

Если registry не должен показывать refund detail — не расширять scope без необходимости.

---

# 12. API AUTHORITY

Определить canonical API financial representation.

Предпочтительно frontend получает server-authoritative financial summary, например концептуально:

```text
financial:
  currency
  totalAmount
  paidAmount
  refundedAmount
  dueAmount
  refundableAmount
  paymentStatus
  refundStatus
```

Но адаптировать к существующей architecture.

Не вводить breaking contract без необходимости.

DTO/schema validation обязательны.

---

# 13. MONEY SAFETY

Проверить:

```text
Decimal/minor units
rounding
serialization
currency consistency
zero amounts
large amounts
negative amount rejection
precision
```

Required tests для реального money representation.

Никаких JS floating-point calculations для authoritative amounts.

---

# 14. PAYMENT / REFUND MUTABILITY AUTHORITY

Определить, кто и каким способом может менять financial state.

Разделить:

```text
provider-authoritative updates
system-derived updates
authorized internal actions
forbidden direct client field mutation
```

Hard rule:

```text
client PATCH cannot directly forge:
paidAmount
refundedAmount
paymentStatus
refundStatus
providerReference
currency
```

если canonical API специально не предусматривает такую privileged operation.

Mass-assignment tests mandatory.

---

# 15. PROVIDER EVENT / WEBHOOK IDEMPOTENCY

Если payment/refund state меняется provider webhook/event:

проверить:

```text
event identity
duplicate delivery
out-of-order delivery where relevant
atomic processing
already-processed behavior
```

Required invariant:

```text
same provider event delivered twice
→ no duplicate payment/refund
→ no double financial effect
→ no duplicate successful audit semantics
```

Если provider integration не участвует в текущем domain — `N/A` с evidence.

---

# 16. PAYMENT / REFUND ATOMICITY

Для financial mutation, где применимо:

```text
financial state mutation
+
immutable audit/history/event persistence
```

должны соблюдать atomic invariant.

Required:

```text
success → state + audit/event persist
audit/event failure → financial mutation rollback
business failure → no false successful audit
```

Если provider-event persistence имеет отдельную idempotency transaction architecture — документировать и доказать её.

Не считать теоретическую `$transaction` достаточным evidence без теста representative path.

---

# 17. CONCURRENCY / RACE CONDITIONS

Классифицировать применимые races:

```text
payment success ↔ cancellation
refund ↔ second refund
duplicate refund requests
duplicate provider webhook
payment update ↔ booking/order transition
two internal financial actions
```

Для каждого:

```text
N/A
SAFE
REAL RISK — FIXED
```

Critical financial invariant не должен зависеть от process-local mutex.

Использовать DB-safe locking/CAS/idempotency/unique constraints according to architecture.

---

# 18. IMMUTABLE FINANCIAL AUDIT

Financial events должны интегрироваться с accepted audit framework.

Meaningful events, где применимо:

```text
PAYMENT_CREATED
PAYMENT_SUCCEEDED
PAYMENT_FAILED
REFUND_REQUESTED
REFUND_SUCCEEDED
REFUND_FAILED
financial correction/admin action if canonical
```

Не придумывать события, которых нет в модели; сопоставить реальные.

Audit requirements:

```text
actor/system/provider authority
entity IDs
safe amount/currency
from/to status
source/context
timestamp
provider reference only if safe
no card secrets
no tokens
no full PAN/CVV
```

---

# 19. SECURITY / PCI-SAFE PRESENTATION

Проверить, что API/UI/audit/logs не раскрывают:

```text
full PAN
CVV/CVC
secret keys
webhook secrets
provider access tokens
raw sensitive provider payloads
```

Если отображается payment method:

```text
safe brand
last4 where canonical
non-sensitive provider reference
```

Only minimum necessary data.

---

# 20. WORKSPACE / TENANT / DIRECT-ID ISOLATION

Аудировать Payment/Refund ID-based surfaces, если существуют:

```text
payment detail
refund detail
history
actions
related Order/Booking financial subresources
provider-event views
exports
```

Required:

```text
authorized context → allowed
wrong tenant/workspace/partner → canonical 404/denial
```

Использовать existing cross-context financial object, не random UUID.

List filtering не заменяет direct-ID protection.

---

# 21. RBAC

Reconcile existing permissions for:

```text
financial read
payment action
refund action
financial audit/history
```

Проверить минимум:

```text
authorized finance/admin role
operational role without financial mutation permission
read-only role if applicable
wrong workspace/tenant
unauthenticated
```

Frontend hiding ≠ backend authorization.

---

# 22. I18N / FORMAT

Проверить все D7-visible labels:

```text
payment statuses
refund statuses
financial section labels
amount labels
currency formatting
empty states
errors
```

No raw keys.

Не hardcode русские labels в backend.

---

# 23. REPRESENTATIVE DATASET

Нужны safe/deterministic representatives для применимых states:

```text
unpaid/pending
paid
failed if supported
cancelled before payment
paid + cancelled if valid
refunded
partially refunded if supported
cross-context financial object
```

Destructive financial tests/browser flows — isolated disposable fixtures.

Не проводить реальные внешние денежные операции.

---

# 24. AUTOMATED TESTS — MINIMUM

## Semantics
```text
payment status meanings
refund status meanings
valid cross-domain combinations
invalid financial combinations rejected
```

## Calculations
```text
paid
refunded
due
refundable
net
precision/rounding
zero/edge amounts
```

## Mutation security
```text
mass assignment denied
unauthorized action denied
wrong tenant denied
```

## Refund invariants
```text
refund <= refundable
cumulative refund <= paid
currency consistency
duplicate refund safety
```

## Idempotency
```text
duplicate provider event
duplicate financial action where applicable
```

## Audit/atomicity
```text
success → audit/event
business failure → no false audit
forced audit/event failure → rollback
```

## Regression
```text
D5 Order full-page
D6 Booking full-page/remediation
```

---

# 25. REAL BROWSER EVIDENCE — MANDATORY

API/E2E does not replace browser evidence.

## Browser A — Unpaid/Pending representative

Open real Order/Booking financial section.

Verify:

```text
lifecycle status
payment status
total
paid
due
currency
actions
```

No semantic contradiction.

## Browser B — Paid representative

Verify:

```text
payment status paid
paid amount
due amount
Order/Booking lifecycle independently displayed
hard refresh
```

## Browser C — Refunded representative

If refund supported:

```text
paid
refunded
net/refundable where applicable
refund status
history
```

If partial refund supported, use representative partial refund.

If not supported, document and do not fake it.

## Browser D — Financial history

Open actual financial history/audit UI for a representative event.

Verify safe:

```text
event
amount/currency
status transition
actor/system source
timestamp
no sensitive payment data
```

## Browser E — Order ↔ Booking consistency

For same commerce chain:

```text
Order financial section
Booking financial section
```

must reconcile to same underlying financial facts.

## Browser F — Cross-context isolation

Use existing cross-context Payment/Refund or related Booking/Order with financial data.

Unauthorized browser direct access to applicable financial surface:

```text
not-found/denied
no amount/status/provider data leakage
```

---

# 26. DB → API → UI → AUDIT RECONCILIATION

At least one paid/refund representative must have explicit table:

| Layer | Payment status | Paid | Refunded | Due/Net | Currency | Evidence |
|---|---|---:|---:|---:|---|---|
| DB | | | | | | |
| API | | | | | | |
| Order UI | | | | | | |
| Booking UI | | | | | | |
| Audit/History | | | | | | |

Hard requirement:

```text
same underlying financial truth
```

If a layer intentionally shows aggregation rather than transaction-level values, explain and reconcile mathematically.

---

# 27. SECURITY RE-QUALIFICATION MATRIX

| Area | Result | Evidence |
|---|---|---|
| Financial mass assignment | | |
| Payment action RBAC | | |
| Refund action RBAC | | |
| Cross-tenant/workspace isolation | | |
| Payment direct-ID isolation | | |
| Refund direct-ID isolation | | |
| Provider event spoofing/idempotency | | |
| Duplicate financial effect prevention | | |
| Money precision | | |
| Refund overrun prevention | | |
| Currency consistency | | |
| Audit integrity | | |
| Audit atomic rollback | | |
| PCI/sensitive-data safety | | |
| Existence leakage | | |

Any acceptance-blocking P0/P1/P2 → D7 not accepted.

---

# 28. REGRESSION MATRIX

Run all new D7 suites plus affected existing payment/refund tests.

Mandatory engineering checks:

```text
backend tsc
backend build
frontend tsc
frontend build
frontend vitest
```

Mandatory preserved regressions:

```text
d5-order-fullpage-audit
d6-booking-fullpage
d6-booking-remediation
d6 audit-failure rollback / equivalent accepted suite
```

If shared audit/security/payment infrastructure changes, rerun affected D3/D4/D5/D6 suites.

Report exact commands and counts.

Known unrelated pre-existing failure may be classified honestly, not silently PASS.

---

# 29. GIT DISCIPLINE

Before work:

```bash
git branch --show-current
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline
```

Starting baseline should reconcile with accepted D6:

```text
31cf883c948e5e2c2d3d5e751f0057a079d9d3eb
```

If current HEAD differs, explain commits before changes.

After implementation/tests/browser/report:

```bash
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

Commit/push all meaningful artifacts.

Final literal:

```text
$ git status --porcelain=v1
<NO OUTPUT>

$ git rev-parse HEAD
<40-char SHA>

$ git rev-parse origin/master
<same 40-char SHA>
```

One canonical Final SHA everywhere.

---

# 30. REQUIRED REPORT

Create:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_D7_PAYMENT_REFUND_SEMANTICS_FINANCIAL_PRESENTATION_IMPLEMENTATION_REPORT.md
```

Predominantly Russian.

Required sections:

1. Executive Summary
2. Starting Git State
3. D5/D6 Baseline Preservation
4. Current Payment/Refund Architecture
5. Gap Analysis
6. Canonical Financial Terminology
7. Payment Status Semantics
8. Refund Semantics
9. Order/Booking/Payment State Separation
10. Financial Calculation Contract
11. Money Precision / Currency Rules
12. API Financial Authority
13. Order Financial Presentation
14. Booking Financial Presentation
15. Registry Presentation
16. Financial Mutability Authority
17. Provider Event / Idempotency
18. Atomicity
19. Concurrency / Race Analysis
20. Immutable Financial Audit
21. PCI / Sensitive Data Safety
22. Workspace/Tenant/Direct-ID Isolation
23. RBAC
24. i18n
25. Representative Dataset
26. Automated Test Matrix
27. Browser A
28. Browser B
29. Browser C
30. Browser D
31. Browser E
32. Browser F
33. DB→API→UI→Audit Reconciliation
34. Security Re-qualification
35. Regression Matrix
36. Findings
37. Complete Acceptance Matrix
38. Git Hard Closure
39. Final Verdict
40. TRUE NEXT

---

# 31. COMPLETE D7 ACCEPTANCE MATRIX — DO NOT SHORTEN

| Gate | Result | Exact Evidence |
|---|---|---|
| Starting Git baseline reconciled | | |
| D5 baseline preserved | | |
| D6 baseline preserved | | |
| Current Payment architecture documented | | |
| Current Refund architecture documented | | |
| Financial source-of-truth matrix documented | | |
| Payment status semantics documented | | |
| Refund semantics documented or canonical N/A proven | | |
| Order/Booking/Payment state separation proven | | |
| Canonical calculation formulas documented | | |
| Money precision safe | | |
| Currency rules safe | | |
| No authoritative frontend floating-point calculation | | |
| API financial representation authoritative | | |
| Order financial presentation canonical | | |
| Booking financial presentation canonical | | |
| Order↔Booking financial consistency | | |
| Registry financial semantics consistent | | |
| Payment status visually distinct from lifecycle status | | |
| Refund status visually distinct where applicable | | |
| Financial mass assignment denied | | |
| Payment action authorization server-side | | |
| Refund action authorization server-side or N/A proven | | |
| Provider event idempotency proven or N/A | | |
| Duplicate financial effect prevented | | |
| Refund amount invariant | | |
| Cumulative refund invariant | | |
| Refund currency invariant | | |
| Financial success → immutable audit/event | | |
| Business failure → no false audit | | |
| Forced audit/event failure → financial rollback | | |
| Applicable concurrency invariant proven | | |
| Financial audit actor/source safe | | |
| Financial audit contains no sensitive payment secrets | | |
| PCI-sensitive fields not exposed | | |
| Workspace/tenant list isolation | | |
| Existing cross-context financial object proven | | |
| Payment direct-ID isolation or N/A | | |
| Refund direct-ID isolation or N/A | | |
| Related financial subresource isolation | | |
| RBAC server-side | | |
| i18n no raw keys | | |
| Browser A pending/unpaid | | |
| Browser B paid | | |
| Browser C refund or canonical N/A | | |
| Browser D financial history | | |
| Browser E Order↔Booking consistency | | |
| Browser F cross-context isolation | | |
| DB/API/Order UI/Booking UI/Audit reconciliation | | |
| D7 automated suites PASS | | |
| D5 regression PASS | | |
| D6 regression PASS | | |
| Backend TSC PASS | | |
| Backend build PASS | | |
| Frontend TSC PASS | | |
| Frontend build PASS | | |
| Frontend vitest honestly classified | | |
| No unresolved P0/P1 | | |
| No unresolved acceptance-blocking P2 | | |
| Next stage NOT STARTED | | |
| Report predominantly Russian | | |
| Final porcelain literally EMPTY | | |
| Final HEAD == origin/master | | |
| One canonical 40-char Final SHA | | |

Any:

```text
FAIL
NOT RUN
NOT PROVEN
acceptance-blocking PARTIAL
```

→ `VERDICT B`.

For `N/A` gates provide architectural evidence; unsupported feature is not automatically a failure.

---

# 32. PROHIBITIONS

Do NOT:

```text
start next stage
redesign D5/D6
invent payment/refund statuses
invent partial refund support
perform real external financial transactions
store or display PAN/CVV/secrets
allow frontend to forge financial state
use random nonexistent UUID as isolation proof
substitute API/E2E for mandatory browser evidence
declare theoretical transaction atomicity without representative proof
declare Git clean with untracked prompt/report
omit acceptance rows
```

---

# 33. FINAL VERDICT — A

Only if every applicable hard gate passes:

```text
VERDICT A — PHASE 3 PRE-STEP 3.12 D7 PAYMENT/REFUND SEMANTICS + FINANCIAL PRESENTATION PASSED

D7 — ACCEPTED

FINAL SHA:
<one canonical 40-char SHA>

TRUE NEXT:
<derive next canonical PRE-STEP 3.12 stage from roadmap/architecture; do not implement it>

NEXT STAGE IMPLEMENTATION — NOT STARTED
```

Then **STOP**.

---

# 34. FINAL VERDICT — B

If any hard gate remains:

```text
VERDICT B — PHASE 3 PRE-STEP 3.12 D7 PAYMENT/REFUND SEMANTICS + FINANCIAL PRESENTATION FAILED

D7 — NOT ACCEPTED

TRUE NEXT:
D7 REMEDIATION / EVIDENCE CLOSURE

NEXT STAGE — NOT STARTED
```

List exact blockers and stop.

---

# 35. HARD STOP

This prompt authorizes **D7 only**.

At completion:

```text
report
verdict
one canonical Final SHA
TRUE NEXT
STOP
```
