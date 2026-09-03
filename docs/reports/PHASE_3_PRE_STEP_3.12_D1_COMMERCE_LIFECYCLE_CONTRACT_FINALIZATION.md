# PHASE 3 — PRE-STEP 3.12 — D1 — COMMERCE LIFECYCLE CONTRACT FINALIZATION

## ROLE — MANDATORY

Ты работаешь как **Principal Software Architect / Senior Domain Architect** проекта TravelHub (Enterprise SaaS / Travel Marketplace).

В рамках D1 ты обязан действовать одновременно как:

- Principal Domain Architect — commercial lifecycle и aggregate boundaries;
- Senior Backend Architect — NestJS / Prisma / event-driven commerce flow;
- Senior Data Architect — lifecycle timestamps, snapshots, references, integrity;
- Multi-tenant SaaS Architect — Platform / Partner / Marketplace / Storefront boundaries;
- Security Architect — tenant isolation и authorization boundaries;
- Independent Architecture Reviewer — проверка фактического кода против canonical architecture.

Твоя задача — **не адаптировать business architecture под удобство существующего кода**, а окончательно заморозить непротиворечивый Commerce Lifecycle Contract перед D2–D4.

Hard rule:

```text
EXISTING CODE
≠ CANONICAL BUSINESS TRUTH
```

Существующий код является evidence текущей реализации, но не может самостоятельно определять canonical architecture.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose-документация должны быть преимущественно **на русском языке**:

- Architecture Contract;
- D1 Final Report;
- findings;
- gap explanations;
- root cause analysis;
- decision log;
- lifecycle/state descriptions;
- conclusions;
- verdict explanations.

Английский допускается только для:

- file paths;
- class/method/DTO/model/table names;
- API endpoints;
- HTTP methods/status codes;
- CLI/Git commands;
- commit messages;
- enums;
- permission identifiers;
- code snippets;
- standardized `VERDICT` strings.

Если итоговый отчёт преимущественно на английском — D1 не завершён.

Plaintext passwords, tokens, secrets и credentials запрещены.

---

# 1. D1 PURPOSE

После D0 canonical architecture reconciliation формально закрыт.

D1 должен окончательно определить **один canonical lifecycle contract** для:

```text
Product / Service
        ↓
Request where required
        ↓
Supplier response
        ↓
Customer acceptance
        ↓
Traveler collection where required
        ↓
Final customer confirmation
        ↓
Request conversion
        ↓
Order
        ↓
Booking
        ↓
Payment / Pay Later
        ↓
Voucher
        ↓
Service
        ↓
Completion / Cancellation / Refund
```

D1 — **architecture/contract closure only**.

Никакой implementation.

---

# 2. STARTING BASELINE

Зафиксировать реальные:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
```

Expected accepted D0 baseline:

```text
D0 Final SHA: 422145f
HEAD == origin/master
```

Если repository уже ушёл вперёд — использовать реальный текущий SHA и объяснить изменения.

Не откатывать более новые commits.

---

# 3. REQUIRED SOURCES

Обязательно изучить:

```text
docs/architecture/TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
D0 closure report
Traveler Architecture Audit / traveler architecture docs
Request / Shared Commerce architecture docs
Order architecture docs
Booking architecture docs
Payment / Refund architecture docs
actual Prisma schema
actual Request/Checkout/Order/Booking services
actual domain events / consumers / subscribers
relevant frontend checkout/request flows
```

Не ограничиваться документацией: current code нужен для GAP analysis.

---

# 4. HARD SCOPE

Разрешено:

```text
architecture audit
contract reconciliation
documentation updates
roadmap/debt-register updates
decision log
read-only code inspection
read-only DB/runtime inspection if useful
documentation-only Git commit/push
```

Запрещено:

```text
Prisma schema changes
migrations
backend implementation
frontend implementation
seed changes
Traveler Stage A
Traveler UI
Order Detail
Booking Detail
Payment remediation
Voucher implementation
Product Freshness
Finance Center
Step 3.12
```

Найденный implementation gap → debt, а не implementation внутри D1.

---

# 5. DEFINE TWO CANONICAL ENTRY FLOWS

Нельзя описывать один flow для всех Product/Service типов.

Зафиксировать минимум два варианта.

## 5.1 Non-authoritative / supplier-confirmation flow

Candidate:

```text
Customer selects Product/Service
→ date/options
→ traveler count/categories
→ [Забронировать]
→ Request created
→ Supplier validates availability/current price/terms
→ Supplier response
→ Customer sees confirmed/current terms
→ Customer explicitly accepts current terms
→ Traveler Data Collection where required
→ required fields validated
→ Customer final confirmation
→ Request conversion
→ Order creation
→ Booking creation
→ Payment or Pay Later according to policy
→ Voucher where applicable
→ Service
→ Completion
```

D1 должен подтвердить или скорректировать его **на основании canonical business architecture**, а не convenience текущего implementation.

## 5.2 Authoritative / real-time flow

Request может отсутствовать:

```text
Customer selects Product/Service
→ authoritative current availability/price/terms
→ traveler count/categories
→ traveler data where required
→ final confirmation
→ Order
→ Booking
→ Payment / Pay Later
→ Voucher where applicable
→ Service
→ Completion
```

Определить точный contract.

---

# 6. REQUEST SEMANTICS

Окончательно определить:

```text
Что такое Request?
Когда он обязателен?
Когда он может быть пропущен?
Что фиксируется в Request snapshot?
Что означает supplier response?
Что означает customer acceptance?
Что означает conversion?
```

Hard:

```text
Request ≠ Order
Supplier CONFIRMED ≠ Booking
```

Request — pre-order validation/current-terms workflow для non-authoritative commerce.

---

# 7. SUPPLIER RESPONSE CONTRACT

Определить canonical supplier outcomes минимум:

```text
CONFIRMED
PRICE_CHANGED / TERMS_CHANGED
UNAVAILABLE
REJECTED
TIMEOUT
```

Если фактические enums отличаются — показать mapping, не менять код.

Для каждого outcome определить:

```text
customer action allowed?
traveler collection allowed?
Order creation allowed?
terminal/non-terminal?
timestamp?
```

---

# 8. PRICE / TERMS CHANGE

Hard business rule:

```text
Supplier changes price/terms
→ TravelHub presents changed terms
→ explicit Customer acceptance required
```

Запрещено:

```text
changed price
→ automatic Order at higher/new price
```

Определить, какой snapshot становится authoritative commercial snapshot после acceptance.

---

# 9. CUSTOMER ACCEPTANCE — DEFINE EXACTLY

Не смешивать два разных события:

```text
A. Customer accepts supplier-confirmed/current commercial terms

B. Customer final-confirms transaction after required traveler data
```

D1 должен решить, нужны ли оба события как отдельные business events.

Если да — дать canonical names и semantics.

Например:

```text
termsAcceptedAt
finalConfirmedAt
```

Но не вводить новые schema fields в D1.

Сначала contract.

---

# 10. TRAVELER COLLECTION POINT — HARD FREEZE

D0 reconciliation зафиксировал target:

```text
Supplier confirms
→ Customer accepts current terms
→ Traveler Data Collection
→ Final confirmation
→ Order
```

D1 должен окончательно проверить и заморозить это решение.

Hard principle:

```text
не заставлять Customer вводить полный паспортный/персональный набор
до подтверждения доступности и актуальных условий поставщиком
```

До Request достаточно, где применимо:

```text
traveler count
adult/child/infant categories
minimal Customer identity/contact
service/date/options
```

Полные requested traveler fields собираются после supplier confirmation/current terms acceptance.

---

# 11. TRAVELER REQUIREMENTS DURING CHECKOUT

Seller-defined Product/Service Traveler Requirements:

```text
NOT_REQUESTED
OPTIONAL
REQUIRED
```

D1 не реализует их.

Но должен определить **какая версия requirements применяется во время traveler-entry checkout**.

Критическая проблема:

```text
Customer начал traveler form
→ Seller изменил Product requirements
→ что происходит?
```

Нельзя динамически менять форму/обязательные поля посреди подтверждённого checkout.

Определить snapshot/pinning point до Booking.

Candidate:

```text
current Product requirements
→ pinned/snapshotted for accepted Request/Checkout
→ used during traveler collection
→ copied/finalized into Order/Booking historical snapshot
```

Определить canonical owner и момент snapshot.

---

# 12. FINAL CONFIRMATION

Определить:

```text
что именно подтверждает Customer после traveler form?
```

Final confirmation должна означать commitment к:

```text
current accepted price
currency
service/date/options
cancellation/terms where applicable
traveler set
required traveler data completeness
```

После final confirmation система может создавать Order.

---

# 13. REQUEST CONVERSION — CRITICAL CONTRACT

Окончательно определить:

```text
Когда Request становится CONVERTED?
```

Не допускать ambiguous semantics.

Проверить варианты:

```text
A. customer accepts supplier terms
B. traveler data completed
C. final customer confirmation
D. Order successfully created
```

Выбрать **один canonical event**.

Рекомендуемый invariant для проверки:

```text
Request CONVERTED
= successful transition into committed commerce
= Order successfully created/linked
```

Но D1 обязан проверить это против architecture и current lifecycle.

---

# 14. convertedAt SEMANTICS

Hard:

```text
convertedAt
≠ updatedAt
```

Определить:

```text
convertedAt = timestamp of what exact business event?
```

Если conversion означает successful Order creation/link:

```text
convertedAt >= finalConfirmedAt
convertedAt ≈ Order.createdAt
```

с допустимой технической последовательностью внутри одной transaction/event flow.

Не fabricate timestamps.

---

# 15. ORDER CREATION POINT

Зафиксировать:

```text
Order = customer-committed commercial transaction
```

Ответить:

1. Может ли final Order существовать до required traveler completion?
2. Может ли final Order существовать до final confirmation?
3. Есть ли отдельный Draft Order concept?
4. Если Draft concept отсутствует — запрещено ли использовать обычный Order как checkout draft?
5. Какой price/terms snapshot принадлежит Order?

Candidate canonical invariant:

```text
required traveler data complete
+ final customer confirmation
→ Order
```

---

# 16. ORDER TRAVELER SNAPSHOT

Определить роль `OrderTraveler`.

Не менять schema.

Ответить:

```text
Нужен ли OrderTraveler как immutable commercial snapshot?
Или это лишнее duplication?
Какие данные переходят в него?
Когда он создаётся?
Как соотносится с CheckoutIntentTraveler?
```

Если модель остаётся:

```text
Checkout traveler values
→ final confirmation
→ OrderTraveler snapshot
→ Booking Passenger
```

Должно быть объяснено, почему это не четыре независимых sources of truth.

---

# 17. BOOKING CREATION POINT

Зафиксировать:

```text
1 Order = 1 Booking (V1)
```

если reconciliation подтверждает.

Определить:

```text
Order created
→ BookingRequested
→ Booking created
```

и ответить:

- Booking создаётся сразу после committed Order?
- Может ли Booking creation fail?
- Как обрабатывается failure?
- Что означает Booking до payment?
- Pay Later поддерживается?
- Booking ≠ Paid?

Не реализовывать failure handling.

---

# 18. BOOKING TRAVELER OWNERSHIP

Canonical fulfillment source:

```text
Booking
→ 1..N Passengers (= Travelers)
```

Определить transfer:

```text
OrderTraveler
→ Passenger
```

и исторический traveler requirements snapshot.

Hard:

```text
Voucher travelers
= Booking travelers
≠ Customer automatically
```

---

# 19. PAYMENT RELATIONSHIP

Не делать Payment prerequisite для существования Booking, если business model допускает Pay Later.

Определить:

```text
Booking created
→ UNPAID / PARTIALLY_PAID / PAID as separate financial dimension
```

Hard:

```text
Booking Status ≠ Payment Status
Order Status ≠ Payment Status
Refund Status ≠ Payment Status
```

D7 остаётся implementation/remediation debt.

---

# 20. CANCELLATION / REFUND BRANCHES

Architecture contract должен показать минимум:

```text
Request cancellation/expiry before Order
Order cancellation
Booking cancellation/rejection
Payment refund
partial refund
full refund
```

Определить, какие events terminal и какие financial consequences возможны.

Не реализовывать D7.

---

# 21. TTL / DEADLINES

Разделить:

```text
Supplier Response SLA
Customer Action TTL
Traveler-entry/final-confirmation window
```

Определить, покрывает ли existing Customer TTL traveler-entry stage.

Hard:

```text
TTL expired before final confirmation
→ no silent Order creation from stale terms
```

Если нужен отдельный traveler TTL только в будущем — зафиксировать deferred.

---

# 22. TEMPORAL INVARIANTS

Для non-authoritative successful flow определить canonical ordering:

```text
Request.createdAt
≤ supplierRespondedAt
≤ termsAcceptedAt
≤ travelerDataCompletedAt (if applicable)
≤ finalConfirmedAt
≤ convertedAt
≤ Order.createdAt / conversion transaction ordering
≤ Booking.createdAt
≤ Payment.createdAt where payment follows
≤ paidAt
≤ serviceDate
≤ completedAt
```

Если `convertedAt` и `Order.createdAt` должны иметь иной exact ordering — зафиксировать его.

Для non-applicable timestamps:

```text
— / null
```

Не использовать `updatedAt` как business timestamp.

---

# 23. CUSTOMER / PAYER / TRAVELER — FINAL D1 SEMANTICS

Зафиксировать:

```text
Customer = buyer/orderer
Payer = actual paying party
Traveler = service recipient
```

Roles могут совпадать, но semantic entities не равны автоматически.

Current V1:

```text
Payer representation may be simplified
```

но architecture должна сохранять future ability:

```text
Payer ≠ Customer
```

Не создавать Payer model в D1.

---

# 24. PLATFORM / STOREFRONT BOUNDARY

Commerce lifecycle должен сохранять:

```text
Marketplace customer commerce
→ Platform Marketplace operational scope

Storefront customer commerce
→ Partner/Storefront Workspace
→ NOT Platform Marketplace commerce

Storefront subscription/direct SaaS payment to TravelHub
→ Platform SaaS economics
```

Hard:

```text
Storefront Commerce Volume
≠ Marketplace GMV
≠ TravelHub Revenue
```

---

# 25. NEWLY DISCOVERED CRM SCOPE REGRESSION — REGISTER, DO NOT FIX

После clean reseed/runtime обнаружено:

```text
Platform → CRM → Клиенты
contains SFC-* Storefront customers
```

Это нарушает canonical business boundary.

D1 не должен исправлять CRM code.

Но D1 обязан добавить отдельный high-priority debt **сразу после D1 и до D2**.

Использовать ID:

```text
D1A — PLATFORM CRM MARKETPLACE / STOREFRONT SCOPE ISOLATION
      AUDIT + REMEDIATION
```

Scope будущего D1A:

```text
CRM → Клиенты
CRM → Партнёры
CRM totals/KPIs
search
filters
pagination
CSV/XLSX
Customer Detail
Partner Detail
CRM Analytics sources
API scope
```

Hard customer invariant:

```text
Platform Marketplace CRM Customers
→ Marketplace customers only

Storefront-only end-customers
→ remain in DB
→ remain available in correct Storefront/Partner scope
→ MUST NOT appear as Platform Marketplace customers
```

Не использовать `SFC-*` prefix как authorization boundary; проверять real business provenance/relations.

---

# 26. CRM PARTNER SEMANTICS — D1A MUST AUDIT

Не предполагать автоматически:

```text
Storefront Partner → forbidden in all Platform CRM
```

D1A должен сначала определить semantics вкладки `CRM → Партнёры`.

Проверить минимум:

```text
Marketplace-only Partner
Storefront-only Partner
Hybrid Marketplace + Storefront Partner
```

Если вкладка означает Marketplace commercial partners:

```text
Marketplace-only → YES
Hybrid → YES
Storefront-only → NO
```

Если вкладка является broader Platform Partner CRM:

Storefront company может быть видна как SaaS client/partner TravelHub, но **не из-за Storefront end-customer commerce**.

Это должен решить D1A на основании canonical Partner/CRM architecture.

---

# 27. UPDATE MASTER DEBT SEQUENCE

Roadmap должен быть обновлён additively.

Новая последовательность:

```text
D0  Reconciliation Final Git/Evidence Closure — ACCEPTED
 ↓
D1  Commerce Lifecycle Contract Finalization
 ↓
D1A Platform CRM Marketplace / Storefront Scope Isolation
    Audit + Remediation
 ↓
D2  Product Traveler Requirements
 ↓
D3  Traveler Collection + Order/Booking Population
 ↓
D4  Traveler Security + Representative Data
 ↓
D5  Orders Full-Page Detail
 ↓
D6  Bookings Full-Page Detail
 ↓
D7  Payment/Refund Semantics + Financial Presentation
 ↓
D8  Global Temporal Visibility
 ↓
D9  Export Framework Requalification
 ↓
D10 Partner Performance Attribution
 ↓
D11 Booking KPI Semantics
 ↓
D12 CRM / KPI Drill-down Routing Requalification
 ↓
D13 Voucher
 ↓
D14 PRE-STEP 3.12 Final Requalification
 ↓
STEP 3.12
```

Не renumber historical D0-D14. `D1A` — additive insertion.

---

# 28. REQUIRED D1 ARCHITECTURE CONTRACT

Создать или обновить подходящий canonical document.

Предпочтительно отдельный contract, например:

```text
docs/architecture/COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md
```

но сначала проверить repository naming conventions и существующие документы.

Не создавать duplicate source-of-truth, если подходящий canonical commerce contract уже существует.

Документ должен содержать:

1. Purpose / scope
2. Domain terms
3. Non-authoritative flow
4. Authoritative real-time flow
5. Request state semantics
6. Supplier response
7. Customer terms acceptance
8. Traveler collection
9. Traveler requirements pin/snapshot
10. Final confirmation
11. Request conversion
12. `convertedAt`
13. Order creation
14. OrderTraveler
15. Booking creation
16. Passenger ownership
17. Payment relationship
18. Cancellation/refund branches
19. TTL/deadlines
20. Temporal invariants
21. Customer/Payer/Traveler
22. Marketplace/Storefront scope
23. Current implementation gaps
24. Deferred decisions
25. downstream D2-D14 implications

---

# 29. REQUIRED GAP MATRIX

| Contract Area | Canonical Decision | Current Code | Gap | Debt |
|---|---|---|---|---|

Минимум:

```text
Request automation
supplier response
terms acceptance
traveler collection
requirements snapshot/pinning
final confirmation
conversion
convertedAt
Order creation
OrderTraveler
Booking creation
Passenger population
Payment relationship
TTL
temporal fields
Payer representation
CRM Storefront scope regression
```

---

# 30. REQUIRED DECISION LOG

Каждое окончательное D1 решение:

| ID | Area | Previous Ambiguity | Canonical Decision | Rationale | Implementation Impact |
|---|---|---|---|---|---|

Особенно:

```text
D1-DEC-01 Customer terms acceptance
D1-DEC-02 Traveler collection point
D1-DEC-03 Traveler requirements pin/snapshot
D1-DEC-04 Final confirmation
D1-DEC-05 Request conversion
D1-DEC-06 convertedAt
D1-DEC-07 Order creation
D1-DEC-08 Booking creation
D1-DEC-09 Payment/Pay Later
D1-DEC-10 TTL during traveler entry
```

---

# 31. CURRENT IMPLEMENTATION MUST NOT BE MISREPRESENTED

Для каждого contract item явно:

```text
CANONICAL + IMPLEMENTED
CANONICAL + PARTIAL
CANONICAL + NOT IMPLEMENTED
DEFERRED
```

Нельзя объявлять automated Request conversion implemented, если он manual/seed-linked.

Нельзя объявлять traveler lifecycle implemented из-за существования Prisma models.

---

# 32. ROADMAP UPDATE

Обновить canonical roadmap additively:

```text
D1 status
D1 decisions
D1A newly discovered CRM scope regression
dependencies
TRUE NEXT after D1
```

При успешном D1:

```text
TRUE NEXT = D1A
```

Не `D2`.

---

# 33. NO TEST-GREEN THEATER

D1 documentation-only, поэтому full regression suite не является обязательным acceptance gate, если код не менялся.

Но выполнить:

```text
git diff --check
documentation consistency checks
relevant read-only code/schema verification
```

Не запускать тяжёлые tests только ради количества.

Если test/runtime evidence используется — описать зачем.

---

# 34. GIT CLOSURE

После documentation-only изменений:

```bash
git diff --check
git status
git diff
git commit
git push
git rev-parse HEAD
git rev-parse origin/master
```

Hard:

```text
HEAD == origin/master
```

Final report должен содержать реальные:

```text
Starting SHA
D1 Documentation SHA
Final SHA
origin/master SHA
HEAD == origin: YES
Working tree state
```

Никаких pending/TBD.

---

# 35. REQUIRED FINAL REPORT

Создать преимущественно на русском:

```text
PHASE 3 — PRE-STEP 3.12 — D1
COMMERCE LIFECYCLE CONTRACT FINALIZATION — FINAL REPORT
```

Структура минимум:

1. Executive Summary
2. Sources Audited
3. Current Implementation Summary
4. Canonical Non-Authoritative Flow
5. Canonical Authoritative Flow
6. Request Contract
7. Supplier Response Contract
8. Customer Acceptance
9. Traveler Collection
10. Traveler Requirements Snapshot/Pinning
11. Final Confirmation
12. Request Conversion / convertedAt
13. Order Creation Contract
14. Booking Creation Contract
15. Payment / Pay Later Relationship
16. Cancellation / Refund Branches
17. TTL / Deadline Contract
18. Temporal Invariants
19. Customer / Payer / Traveler
20. Marketplace / Storefront Boundary
21. CRM Scope Regression Registration (D1A)
22. Gap Matrix
23. Decision Log
24. Roadmap Update
25. Files Changed
26. Git Closure
27. Residual Risks
28. Final Verdict
29. TRUE NEXT

---

# 36. ACCEPTANCE GATES

`VERDICT A` только если:

```text
[ ] One non-contradictory non-authoritative lifecycle fixed
[ ] Authoritative real-time flow fixed
[ ] Request semantics fixed
[ ] Supplier outcomes fixed/mapped
[ ] Changed price requires explicit acceptance
[ ] Terms acceptance event fixed
[ ] Traveler collection point fixed
[ ] Traveler requirements pin/snapshot point fixed
[ ] Final confirmation semantics fixed
[ ] Request CONVERTED semantics fixed
[ ] convertedAt semantics fixed
[ ] Order creation point fixed
[ ] OrderTraveler role fixed
[ ] Booking creation point fixed
[ ] Passenger ownership fixed
[ ] Payment/Pay Later relationship fixed
[ ] Cancellation/refund branches documented
[ ] TTL behavior fixed
[ ] Temporal ordering fixed
[ ] Customer/Payer/Traveler semantics preserved
[ ] Marketplace/Storefront boundary preserved
[ ] CRM SFC customer regression registered as D1A
[ ] CRM Partner semantics explicitly assigned to D1A audit
[ ] Gap Matrix complete
[ ] Decision Log complete
[ ] Implemented vs Planned status explicit
[ ] Roadmap updated additively
[ ] TRUE NEXT = D1A
[ ] No implementation performed
[ ] Real Final SHA present
[ ] Push succeeded
[ ] HEAD == origin
```

Любой unresolved lifecycle contradiction:

```text
VERDICT B
```

---

# 37. FINAL VERDICT

Success:

```text
VERDICT A — D1 COMMERCE LIFECYCLE CONTRACT FINALIZATION — COMPLETED
```

Только после всех hard gates.

---

# 38. STOP RULE

После D1:

```text
STOP.
```

Не начинать D1A автоматически.

Финал должен явно содержать:

```text
TRUE NEXT:
D1A — PLATFORM CRM MARKETPLACE / STOREFRONT
      SCOPE ISOLATION AUDIT + REMEDIATION

NOT STARTED.
```
