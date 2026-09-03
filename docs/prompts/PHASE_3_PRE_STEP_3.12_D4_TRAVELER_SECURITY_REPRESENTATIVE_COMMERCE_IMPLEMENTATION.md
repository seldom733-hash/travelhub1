# PHASE 3 — PRE-STEP 3.12 — D4 — TRAVELER SECURITY + REPRESENTATIVE DATA + REPRESENTATIVE END-TO-END COMMERCE CHAIN COVERAGE — IMPLEMENTATION

## ROLE — MANDATORY

Ты работаешь как **Senior/Staff Software Engineer + Software Architect + Backend Engineer + Database Engineer + Application Security Engineer + QA Engineer** проекта TravelHub.

Твоя задача — реализовать D4 как production-grade этап, а не как набор тестовых строк или поверхностный security cleanup.

Existing code, dev DB, тесты и предыдущие отчёты являются evidence, но не автоматической канонической бизнес-истиной. Перед remediation сначала установить root cause и фактическое состояние.

Обязательный рабочий принцип:

```text
CANONICAL ARCHITECTURE
→ ACTUAL DB MODEL
→ ACTUAL API
→ ACTUAL UI
→ ACTUAL RUNTIME
→ ACTUAL REPRESENTATIVE DATA
→ SECURITY / TENANT ISOLATION
→ RECONCILIATION
→ EVIDENCE
```

Не объявлять `VERDICT A` только потому, что код компилируется или тесты зелёные. D4 считается завершённым только при доказанном:

```text
DB → API → UI → Runtime → Security → Representative lifecycle coverage
```

Не начинать D5 автоматически.

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые Implementation Report, Evidence / Runtime Report, findings, root cause analysis, architecture decisions, security findings, data coverage explanations, conclusions и verdict explanations должны быть преимущественно **на русском языке**.

English допустим только для file paths, class/method/DTO/model/table names, API endpoints, HTTP methods/status codes, CLI/Git commands, commit messages, enum/status identifiers, permission identifiers, code snippets и standardized VERDICT strings.

Если итоговый report преимущественно на английском — задача незавершена. Plaintext secrets/passwords/tokens запрещены в report/evidence.

## 1. STAGE CONTEXT

D3 принят и закрыт.

```text
D0   ACCEPTED
D1   ACCEPTED
D1A  ACCEPTED
D2   ACCEPTED
D3   ACCEPTED

TRUE NEXT:
D4 — TRAVELER SECURITY
     + REPRESENTATIVE DATA
     + REPRESENTATIVE END-TO-END COMMERCE CHAIN COVERAGE
```

D3 уже доказал:

```text
Request → Customer acceptance
→ pin traveler requirements
→ freeze traveler count
→ Order
→ OrderTraveler
→ final confirmation
→ Booking
→ Passenger
```

D4 НЕ должен переписывать D3 без доказанного дефекта.

## 2. PRIMARY D4 GOAL

D4 закрывает три слоя:

```text
A. Traveler Security / PII Protection
B. Representative Data
C. Representative End-to-End Commerce Chain Coverage
```

Ключевой принцип:

```text
REPRESENTATIVE CHAIN COVERAGE
≠ STATUS COVERAGE
```

Недопустимо просто вставить записи с недостающими статусами. Каждый важный статус должен возникать естественно внутри валидной commerce lifecycle chain.

## 3. CANONICAL COMMERCE CHAIN

Базовая модель:

```text
Product
→ Request
→ Supplier response
→ Customer acceptance
→ Traveler data
→ Final confirmation
→ Order
→ Booking
→ Payment
→ Refund / Completion / Cancellation
```

Также обязателен authoritative / real-time flow без Request:

```text
Authoritative Product / current terms
→ Customer acceptance
→ Traveler data
→ Order
→ Final confirmation
→ Booking
→ Payment
→ Completion / Cancellation / Refund
```

Не смешивать эти два flow.

## 4. HARD BUSINESS SEPARATION

Сохранить:

```text
Customer ≠ Payer ≠ Traveler
```

Customer = покупатель/заказчик; Traveler = фактический путешественник/пассажир/гость; Payer = плательщик. Booking может иметь 1..N Travelers. Passenger population должен происходить из подтверждённых Traveler данных. Customer profile не должен автоматически подменять traveler record.

Опция `Я являюсь одним из туристов` допустима только как explicit prefill, не implicit identity merge.

## 5. TRAVELER DATA SECURITY AUDIT — MANDATORY

Перед изменением кода провести полный audit:

```text
OrderTraveler
Passenger
CheckoutIntentTraveler
Request pinned snapshot
Order pinnedRequirements
Customer
Booking
Voucher-related traveler projection, если уже существует
Audit/Security logs
API DTO
frontend state/cache
exports, если traveler fields уже экспортируются
```

Для каждого поля определить:

```text
field
business purpose
PII sensitivity
storage location
API exposure
UI exposure
logging exposure
export exposure
retention requirement
masking requirement
permission requirement
```

## 6. TRAVELER FIELD CATALOG

Текущий D2 catalog:

```text
firstName
lastName
birthDate
citizenship
gender
passportNumber
passportExpiry
```

Не добавлять новые поля без архитектурной необходимости.

Классифицировать минимум:

```text
LOWER SENSITIVITY PII
- firstName
- lastName
- citizenship
- gender

HIGHER SENSITIVITY PII
- birthDate
- passportNumber
- passportExpiry
```

## 7. DATA MINIMIZATION — HARD

Правила:

```text
NOT_REQUESTED
→ не собирать
→ не отображать как обязательное
→ не создавать fake placeholder
→ не копировать из Customer автоматически

OPTIONAL
→ собирать только если введено
→ отсутствие допустимо

REQUIRED
→ обязательно до final confirmation
```

Запрещено хранить паспорт/birthDate «на всякий случай», если Product requirements этого не требуют.

## 8. API EXPOSURE AUDIT

Проверить endpoints, способные вернуть traveler/passenger PII, минимум:

```text
GET /orders/:id
GET /orders
GET /bookings/:id
GET /bookings
Request detail
Order detail
Booking detail
customer/CRM projections
analytics/drill-down projections
export-related DTO
```

Для каждого определить who can call, workspace, tenant scope, role permission, fields returned, необходимость high-sensitivity fields и masking.

Hard rule:

```text
LIST/REGISTRY endpoints
should NOT return full sensitive traveler documents
unless explicitly required.
```

## 9. SERVER-SIDE AUTHORITY — HARD

Frontend hiding не считается security.

Для sensitive traveler access required:

```text
workspace check
→ tenant/partner scope
→ business object scope
→ role/permission
→ field-level exposure decision
```

Проверить минимум PLATFORM ADMIN, DIRECTOR, OPERATOR, SALES_MANAGER, FINANCE, ANALYST, MARKETER, MODERATOR и Partner workspace users.

Не предполагать, что ADMIN автоматически имеет право видеть все traveler PII без business justification.

## 10. TENANT ISOLATION — HARD

Проверить:

```text
Partner A
must not read traveler/passenger data
of Partner B
```

включая direct object GET, list filters, nested Order→Booking, Booking→Passenger, Request→Order, search, pagination, manual UUID enumeration и business reference lookup.

## 11. MASKING / REDACTION

Определить, где нужен masking. Принцип:

```text
passportNumber
full value only where operationally required

else:
******1234
```

Не фиксировать формат до аудита существующего UI/API. Masking ≠ authorization.

## 12. LOGGING / AUDIT SAFETY

Проверить application logs, Nest exceptions, request logs, debug logs, security audit events, event payloads, outbox/inbox, test output и browser console.

Не должны писать full passportNumber, лишний birthDate, raw traveler payload, authorization tokens или passwords.

Security audit должен фиксировать who/when/object/action/result, но не sensitive payload целиком.

## 13. MUTABILITY / IMMUTABILITY

Сохранить D3 semantics:

```text
finalConfirmedAt == null
→ traveler data editable по разрешённому lifecycle

finalConfirmedAt != null
→ confirmed traveler data immutable через обычный edit flow
```

Проверить PATCH after final confirmation, direct API manipulation, partial overwrite, travelerCount mutation, pinnedRequirements mutation. Ожидается server-side denial.

## 14. REPRESENTATIVE DATA — CORE PRINCIPLE

Нельзя создавать финальные статусы прямыми INSERT ради coverage. Нужны canonical transitions или deterministic lifecycle seed builder, создающий тот же валидный domain graph и temporal invariants.

## 15. REPRESENTATIVE SCENARIOS — MANDATORY

Обеспечить meaningful coverage минимум:

### S1 — Request waiting supplier
`Product → Request NEW / waiting supplier`, без Order/Booking.

### S2 — Supplier confirmed, customer pending
Supplier price/availability confirmed, customer ещё не принял, без Order.

### S3 — Price changed, customer accepted
Changed price → customer accepted → pinned requirements → Order; traveler data incomplete.

### S4 — Supplier rejection / unavailable
Natural terminal Request state, без Order/Booking.

### S5 — Customer declined / expired if supported
Только если actual state machine реально поддерживает. Если TTL/EXPIRED отсутствует — не выдумывать enum, зафиксировать gap.

### S6 — Order with traveler data incomplete
Accepted → Order → 2 travelers expected → partial data → `finalConfirmedAt NULL` → Booking NONE.

### S7 — Ready for Booking
Если actual state machine имеет canonical `READY_FOR_BOOKING`: all required traveler data complete → finalConfirmedAt → READY_FOR_BOOKING до BookingRequested.

### S8 — Sent to Booking / Booking waiting supplier
Order → BookingRequested → Booking created → supplier pending.

### S9 — Booking confirmed, unpaid
Booking confirmed, payment pending/none.

### S10 — Booking partially paid
Только если actual finance model поддерживает partial payment.

### S11 — Booking fully paid
Successful payment(s), fully paid.

### S12 — Booking completed
Natural completion lifecycle.

### S13 — Cancellation before payment
Valid cancellation transition.

### S14 — Cancellation after payment
С корректной refund semantics.

### S15 — Partial refund
Только через actual Payment/Refund model.

### S16 — Full refund
Только через actual Payment/Refund model.

### S17 — Authoritative flow without Request
Product → accepted authoritative terms → traveler collection → Order → final confirmation → Booking → Payment.

### S18 — Marketplace flow
Marketplace provenance/acquisitionSource.

### S19 — Storefront Partner flow
Storefront customer commerce остаётся Partner Workspace commerce и НЕ становится Platform Marketplace commerce.

## 16. DO NOT FORCE UNSUPPORTED STATES

Перед каждым scenario audit actual enums/state machines. Если requirement отсутствует:

```text
DO NOT invent enum silently
DO NOT patch KPI just to show a non-zero value
```

В report использовать `SUPPORTED`, `PARTIALLY SUPPORTED`, `NOT SUPPORTED — ARCHITECTURE GAP`.

## 17. REPRESENTATIVE END-TO-END CHAIN INTEGRITY

Каждая цепь должна сохранять valid FKs, workspace/tenant ownership, acquisitionSource, currency, amounts, chronology, commerceSequence, business references, traveler count, traveler rows, Passenger rows, Payment totals, Refund totals и status transitions. Orphans запрещены.

## 18. COMMERCIAL REFERENCES

Сохранить:

```text
MKT-REQ-########
MKT-ORD-########
MKT-BKG-########
MKT-PAY-########-N
```

Связи только через реальные UUID/FK, не string parsing reference number.

## 19. TEMPORAL INTEGRITY

Проверить реальные инварианты:

```text
Request.createdAt <= customerAcceptedAt
Order.createdAt <= finalConfirmedAt
Booking created/requested after relevant Order gate
Payment.createdAt >= commercial object creation
Refund.createdAt >= corresponding successful Payment
completion/cancellation timestamps >= object creation
```

Не подменять отсутствующий timestamp `updatedAt`.

## 20. FINANCIAL INTEGRITY FOR REPRESENTATIVE DATA

Для Payment/Refund scenarios:

```text
amount > 0
currency consistent
payment belongs correct Order
refund belongs correct Payment
sum(refunds) <= successful paid amount
outstanding not negative
```

Не выполнять D7 presentation work сейчас.

## 21. MARKETPLACE VS STOREFRONT ISOLATION

Hard invariant:

```text
Storefront customer commerce
≠ Platform Marketplace commerce
```

D4 representative data должна включать Marketplace chain и Storefront chain. Platform Marketplace scope не должен смешивать Storefront customer Orders/Bookings/Payments.

## 22. ZERO KPI PRINCIPLE

```text
ZERO KPI
is acceptable only if intentionally tested,
not merely absence of representative test data.
```

D4 создаёт lifecycle coverage, а не «красивые ненулевые KPI». Полный KPI reconciliation остаётся D11.

## 23. NO FULL DB RESET

Запрещён очередной полный reset dev DB. D4 additive/deterministic. Существующие данные сохранить.

## 24. PERMANENT D3 CASES — PRESERVE

Сохранить:

```text
CASE A
MKT-REQ-09000547
MKT-ORD-09000547
2 travelers
editable

CASE B
MKT-REQ-09000548
MKT-ORD-09000548
2 travelers
completed/locked
Booking exists
```

## 25. D4 REPRESENTATIVE CASE MANIFEST

Создать:

```text
docs/evidence/d4/D4_REPRESENTATIVE_COMMERCE_CASES.md
```

Для каждого permanent representative scenario указать Scenario ID, Business meaning, Workspace, Acquisition source, Product code/UUID, Request/Order/Booking/Payment/Refund codes+UUIDs or NONE, Customer, Traveler count/state, expected lifecycle/payment/refund state, Direct URLs, expected UI/API/DB relations.

Не включать secrets или full sensitive traveler data.

## 26. PII-SAFE EVIDENCE

Representative travelers — только synthetic personas. Скриншоты/evidence должны показывать masked/redacted passport data либо безопасные synthetic values.

## 27. AUTOMATED SECURITY TESTS — MANDATORY

Добавить/расширить e2e минимум на:

```text
cross-tenant OrderTraveler read denied
cross-tenant Passenger read denied
unauthorized role cannot fetch sensitive fields
list endpoints do not overexpose sensitive traveler payload
post-final-confirm mutation denied
travelerCount mutation denied after pin/final gate where applicable
pinnedRequirements mutation denied
direct UUID enumeration denied
Storefront traveler data excluded from Platform Marketplace scope
```

## 28. AUTOMATED REPRESENTATIVE CHAIN TESTS

Создать deterministic test builder/fixtures. Доказать transitions для:

```text
Request → accepted → incomplete travelers
Request → final confirm → Booking
Booking → successful Payment
Booking → cancellation before payment
Booking → payment → refund
Authoritative no-Request flow
Marketplace vs Storefront isolation
```

## 29. RUNTIME / BROWSER VERIFICATION — MANDATORY

На live dev stack проверить минимум:

```text
1. D3 CASE A still works
2. representative Request pending visible
3. incomplete traveler Order visible
4. Booking pending/confirmed visible
5. paid/completed chain visible
6. cancellation/refund chain visible where supported
7. Marketplace chain visible in Platform scope
8. Storefront chain NOT visible in Platform Marketplace scope
9. Storefront chain visible in correct Partner workspace if UI exists
10. sensitive traveler data not overexposed
```

Использовать реальные URLs и business references.

## 30. DB → API → UI RECONCILIATION

Для representative cases создать matrix:

| Layer | Evidence |
|---|---|
| DB | status, FK, counts, timestamps, amounts |
| API | DTO/status/reference/scope |
| UI | visible status/reference/traveler state |
| Security | allowed/denied roles/scopes |
| Lifecycle | valid transition history |
| Finance | paid/refunded/outstanding integrity |

Hard rule: `DB == API == UI` для фактов, которые заявляет UI.

## 31. NO SILENT ARCHITECTURE CHANGES

Если lifecycle не способен естественно представить важный scenario: зафиксировать gap → root cause → сверить canonical architecture → при необходимости обновить contract/roadmap → только потом implementation.

## 32. PRESERVE D5 / D6 NAVIGATION FINDINGS

Не исправлять в D4:

```text
D5:
ANY MKT-ORD-* click
→ /app/orders/{id}
→ canonical Order Detail

D6:
ANY MKT-BKG-* click
→ /app/bookings/{id}
→ canonical Booking Detail
```

Right drawer остаётся known UX inconsistency.

## 33. PRESERVE D11 / D12 DEBTS

D4 не чинит Order/Booking KPI reconciliation, Active Customers 51→CRM92 mismatch, CRM global 183 и `crm.filter.clear_dates` raw i18n. Они остаются в D11/D12.

## 34. HELP / BUSINESS DICTIONARY

Не реализовывать полный Help semantic content в D4. Сохранить правило:

```text
Canonical KPI definition
→ backend calculation
→ KPI card
→ drill-down
→ Help documentation
```

Полная синхронизация в D11.

## 35. DATA SAFETY

Перед data creation capture baseline counts. После — final counts. Report должен показать, какие permanent representative rows добавлены. Не удалять существующие dev representative data без причины.

## 36. REQUIRED SECURITY FINDINGS MATRIX

| ID | Severity | Surface | Finding | Root Cause | Remediation | Evidence | Status |
|---|---|---|---|---|---|---|---|

Любой unresolved P0/P1 traveler PII leak блокирует VERDICT A.

## 37. REQUIRED REPRESENTATIVE COVERAGE MATRIX

| Scenario | Supported | Permanent Case | DB | API | UI | Security | Temporal | Finance | Result |
|---|---|---|---|---|---|---|---|---|---|

Для unsupported scenario нельзя ставить fake PASS.

## 38. REGRESSION

Минимум:

```text
D3 Request flow tests
D3 traveler tests
Order/Booking relevant e2e
Request Center relevant e2e
new D4 security tests
new representative-chain tests
```

Сравнить known pre-existing failures с baseline. Новый failure = D4 gate fail до root cause. Не исправлять unrelated stale suites автоматически.

## 39. GIT / EVIDENCE DISCIPLINE

Перед работой:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
```

Ожидается clean worktree и HEAD == origin/master.

После implementation:

```bash
git status --short
git diff --stat
git diff
```

Commit meaningful implementation/evidence, push, затем:

```bash
git fetch origin
git status --short
git rev-parse HEAD
git rev-parse origin/master
```

Hard acceptance:

```text
git status --short = empty
HEAD == origin/master
push success
```

## 40. REQUIRED D4 REPORT

Создать:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_D4_TRAVELER_SECURITY_REPRESENTATIVE_COMMERCE_IMPLEMENTATION_REPORT.md
```

Структура минимум:

1. Executive Summary
2. Starting State
3. Canonical Architecture Check
4. Traveler Data Inventory
5. PII Classification
6. API Exposure Audit
7. Permission / Scope Model
8. Tenant Isolation
9. Masking / Redaction
10. Logging / Audit Safety
11. Mutability / Immutability
12. Representative Data Design
13. Representative Scenarios
14. Marketplace vs Storefront Isolation
15. Temporal Integrity
16. Financial Integrity
17. Automated Security Tests
18. Representative Chain Tests
19. Runtime / Browser Evidence
20. DB → API → UI Reconciliation
21. Data Safety / Counts
22. Findings Matrix
23. Coverage Matrix
24. Regression
25. Files Changed
26. Architecture / Roadmap Sync
27. Git Closure
28. Residual Risks
29. Acceptance Matrix
30. Final Verdict
31. TRUE NEXT

## 41. HARD ACCEPTANCE MATRIX

| Gate | Result | Evidence |
|---|---|---|
| D3 baseline preserved | | |
| Traveler data inventory complete | | |
| PII classification complete | | |
| No plaintext secrets/PII in logs/evidence | | |
| API exposure audited | | |
| Sensitive fields minimized | | |
| Server-side permission gates proven | | |
| Cross-tenant traveler access denied | | |
| Cross-tenant passenger access denied | | |
| Direct UUID enumeration denied | | |
| Post-final-confirm mutation denied | | |
| Pinned requirements protected | | |
| Traveler count protected | | |
| Marketplace/Storefront isolation proven | | |
| No full DB reset | | |
| D3 CASE A preserved | | |
| D3 CASE B preserved | | |
| Representative manifest created | | |
| Request pending scenario represented | | |
| Supplier-confirmed/customer-pending represented | | |
| Accepted/incomplete traveler scenario represented | | |
| Rejection/unavailable scenario represented | | |
| Ready-for-booking represented if supported | | |
| Booking pending supplier represented | | |
| Booking confirmed unpaid represented | | |
| Partial payment represented if supported | | |
| Fully paid represented | | |
| Completed represented | | |
| Cancellation before payment represented | | |
| Cancellation after payment represented | | |
| Partial refund represented if supported | | |
| Full refund represented | | |
| Authoritative no-Request chain represented | | |
| Marketplace chain represented | | |
| Storefront chain represented | | |
| Temporal invariants proven | | |
| Financial integrity proven | | |
| DB→API→UI reconciliation proven | | |
| Browser runtime evidence captured | | |
| New D4 security tests pass | | |
| Representative chain tests pass | | |
| No new regressions | | |
| D5/D6 findings preserved | | |
| D11/D12 debts preserved | | |
| Roadmap synced if architecture changed | | |
| Final report predominantly Russian | | |
| `git status --short` empty | | |
| HEAD == origin/master | | |
| Push successful | | |

## 42. VERDICT RULE

`VERDICT A` разрешён только если:

```text
no unresolved P0/P1 traveler security finding
AND representative chain coverage is meaningful
AND Marketplace/Storefront isolation proven
AND DB/API/UI/runtime reconciled
AND no new regression
AND Git closure clean
```

Нельзя считать PASS сценарий, который был просто вставлен напрямую в финальный status.

## 43. FINAL VERDICT FORMAT

Успех:

```text
VERDICT A — D4 TRAVELER SECURITY + REPRESENTATIVE DATA
+ REPRESENTATIVE END-TO-END COMMERCE CHAIN COVERAGE
IMPLEMENTATION COMPLETED

D4 IMPLEMENTATION — DONE
STRICT REVIEW — NOT STARTED
```

Неуспех:

```text
VERDICT B — D4 IMPLEMENTATION INCOMPLETE
REMEDIATION REQUIRED
```

## 44. TRUE NEXT — HARD

Даже при `VERDICT A` implementation НЕ означает D4 ACCEPTED.

```text
TRUE NEXT:
D4 — STRICT REVIEW

D5 NOT STARTED.
```

## 45. STOP RULE

После implementation → automated tests → runtime/browser evidence → report → commit → push → final Git verification:

```text
STOP.
WAIT FOR INDEPENDENT D4 STRICT REVIEW.
```
