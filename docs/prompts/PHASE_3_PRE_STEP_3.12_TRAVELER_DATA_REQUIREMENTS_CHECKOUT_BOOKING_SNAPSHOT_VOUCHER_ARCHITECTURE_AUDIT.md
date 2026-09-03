# PHASE 3 — PRE-STEP 3.12 — TRAVELER DATA REQUIREMENTS + CHECKOUT COLLECTION + BOOKING SNAPSHOT + VOUCHER SOURCE — ARCHITECTURE AUDIT

## STATUS

После clean reset + canonical reseed основной commerce dataset приведён к новой canonical базе, однако Traveler domain остаётся незавершённым:

```text
OrderTraveler/Passenger: 0
Traveler Requirements: NOT IMPLEMENTED
Customer ≠ Payer ≠ Traveler: documented, not fully seeded
```

Следующий этап — **не blind implementation**, а строгий architecture/domain audit текущего проекта с фиксацией canonical contract перед реализацией.

Текущий статус:

```text
DATABASE RESET / CORE RESEED      → BASELINE ACCEPTED FOR CONTINUATION
TRAVELER DOMAIN                   → NOT IMPLEMENTED / REQUIRES AUDIT
```

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose-документация должны быть преимущественно **на русском языке**:

- Architecture Audit;
- Gap Audit;
- Implementation Report;
- Remediation Report;
- Strict Review Report;
- Evidence / Runtime Report;
- findings;
- root cause analysis;
- architecture decisions;
- security findings;
- conclusions;
- recommendations;
- verdict explanations.

Английский допускается только для технических идентификаторов:

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

Если итоговый отчёт преимущественно написан на английском — задача считается незавершённой.

Никогда не включать plaintext passwords, tokens, secrets или credentials. Использовать placeholders/redaction.

---

# 1. OBJECTIVE

Провести **архитектурный аудит** текущей реализации и определить безопасный canonical design для полного Traveler lifecycle:

```text
Product / Service
        ↓
Seller defines Traveler Data Requirements
        ↓
Marketplace checkout / Request flow
        ↓
Supplier confirms availability/current price
        ↓
Customer accepts current terms
        ↓
Traveler Data Collection
        ↓
Final customer confirmation
        ↓
Order
        ↓
Booking
        ↓
Booking Traveler Snapshot
        ↓
Payment / Pay later
        ↓
Voucher
        ↓
Service
        ↓
Completion
```

Не начинать полноценную implementation, пока audit не завершён и architecture contract не зафиксирован.

---

# 2. CANONICAL CUSTOMER FLOW TO VALIDATE

Целевой business flow для non-instant service:

```text
Витрина
   ↓
Клиент выбирает услугу
   ↓
Выбирает дату / вариант / количество туристов
   ↓
[Забронировать]
   ↓
Request
   ↓
Supplier availability / price confirmation
   ↓
Customer receives current confirmed terms
   ↓
Customer accepts current terms
   ↓
Traveler Data Form
   ↓
Required traveler fields validated
   ↓
Final confirmation
   ↓
Order
   ↓
Booking
   ↓
Payment / Pay later
   ↓
Voucher
```

До supplier confirmation клиент **не должен быть обязан заполнять полный набор sensitive traveler data** без необходимости.

На Request stage достаточно, где business flow позволяет:

```text
Customer
Product / Service
Date
Variant / options
Traveler count
Traveler categories
Displayed price
Currency
Snapshot terms
```

Traveler full identity data собираются после подтверждения актуальности услуги/цены и до final Order/Booking creation.

Проверить, согласуется ли это с текущей реализацией и где именно сегодня создаются:

```text
Request
Order
Booking
Passenger / Traveler
Payment
```

---

# 3. HARD DOMAIN CONTRACT — CUSTOMER ≠ PAYER ≠ TRAVELER

Зафиксировать как обязательный domain principle:

```text
Customer ≠ Payer ≠ Traveler
```

Определения:

```text
Customer
= покупатель / заказчик / CRM customer

Payer
= фактическое лицо/сторона, осуществившая платёж

Traveler
= лицо, которое реально получает/использует забронированную услугу
```

Один человек может совмещать роли:

```text
Customer = Payer = Traveler
```

но система не должна исходить из этого по умолчанию.

Обязательные supported cases:

```text
Case A
Customer = Payer = Traveler

Case B
Customer = Payer
Traveler = другое лицо

Case C
Customer ≠ Payer
Traveler(s) = другие лица

Case D
Customer является одним из нескольких Travelers

Case E
несколько Travelers, Customer сам не путешествует
```

---

# 4. PRIMARY OWNERSHIP OF TRAVELER DATA

Canonical relationship:

```text
Booking
→ 1..N Travelers
```

Traveler data должны принадлежать operational booking context.

Не считать Traveler автоматически CRM Customer.

Допустимо:

```text
Traveler.customerId
```

как optional relation, если тот же человек уже существует как Customer.

Но запрещено:

```text
every Traveler → automatically create CRM Customer
```

без отдельного approved business rule.

---

# 5. AUDIT EXISTING TECHNICAL MODEL FIRST

До проектирования новой schema проверить текущие модели и отношения:

```text
Passenger
Traveler
BookingPassenger
OrderTraveler
Booking
Order
Customer
User
Payment
Payer-related fields
Product
Tour / Accommodation / Transfer / Insurance models
Voucher / confirmation documents
```

Определить:

1. Существует ли уже `Passenger`.
2. Что он семантически означает.
3. К чему он привязан:
   - Order?
   - Booking?
   - BookingItem?
4. Какие поля уже есть.
5. Есть ли adult/child/infant classification.
6. Есть ли document/passport fields.
7. Есть ли nationality/DOB/gender/contact fields.
8. Есть ли voucher source.
9. Есть ли snapshot-like data structures.
10. Есть ли Product-level dynamic field configuration.

Не создавать `Traveler` как новую entity, если существующий `Passenger` уже является тем же business concept.

В таком случае:

```text
Traveler = business terminology
Passenger = current technical model
```

до отдельной approved schema rename/evolution.

---

# 6. SELLER-DEFINED TRAVELER DATA REQUIREMENTS

Canonical principle:

```text
Seller on Product/Service
defines which Traveler fields are needed
```

Не один глобальный обязательный набор на все услуги.

Пример:

```text
Tour:
First name                  REQUIRED
Last name                   REQUIRED
DOB                         OPTIONAL
Passport                    NOT_REQUESTED

Insurance:
First name                  REQUIRED
Last name                   REQUIRED
DOB                         REQUIRED
Nationality                 REQUIRED
Passport number             REQUIRED
Passport expiry             REQUIRED

Transfer:
First name                  REQUIRED
Phone                       OPTIONAL
Passport                    NOT_REQUESTED
```

Field requirement state:

```text
NOT_REQUESTED
OPTIONAL
REQUIRED
```

В UI seller:

```text
Не запрашивать
Опционально
Обязательно
```

---

# 7. UNIVERSAL TRAVELER FIELD CATALOG — AUDIT, NOT BLIND IMPLEMENTATION

Определить целевой catalog возможных traveler fields.

Минимально рассмотреть:

```text
Identity:
firstName
middleName
lastName
fullName
gender
dateOfBirth

Citizenship / nationality:
nationality
citizenship
countryOfResidence

Documents:
documentType
documentNumber
documentIssueCountry
documentIssuedAt
documentExpiresAt

Contacts:
email
phone

Address:
country
city
address

Travel:
travelerType
adult/child/infant
rooming / occupancy relation if applicable
seat/preferences if applicable

Visa:
visaRequired / visaNumber / visaExpiry where applicable

Insurance:
insurancePolicyNumber
insuranceProvider
insuranceValidity

Loyalty:
frequentFlyer / loyalty program where applicable

Special:
specialAssistance
mobilityNeeds
dietaryRequirements
medicalNotes where legally/business justified

Emergency contact:
name
phone
relationship

Freeform:
notes
```

Этот список не означает, что все поля должны быть реализованы.

Audit должен определить:

```text
EXISTING
MISSING BUT REQUIRED FOR NEAR-TERM
FUTURE
NOT APPROPRIATE
```

---

# 8. PRODUCT/SERVICE CONFIGURATION CONTRACT

Проверить, где seller должен конфигурировать Traveler Requirements:

```text
Product edit/create page
Service-specific settings
Booking requirements block
```

Canonical expectation:

```text
Product / Service
  └── Traveler Data Requirements
        ├── First Name        REQUIRED
        ├── Last Name         REQUIRED
        ├── DOB               REQUIRED
        ├── Nationality       OPTIONAL
        └── Passport          NOT_REQUESTED
```

Audit должен ответить:

- один набор на продукт?
- различия по variant/rate?
- различия по traveler type?
- различия по service type?
- требования для lead traveler vs all travelers?
- требования к children/infants?
- зависит ли requirement от destination/country?

Не overdesign. Зафиксировать minimum viable architecture.

---

# 9. SNAPSHOT CONTRACT — HARD REQUIREMENT

Нельзя позволять исторической Booking зависеть от live Product configuration.

Canonical:

```text
Product Traveler Requirements
        ↓
Booking creation
        ↓
SNAPSHOT
        ↓
Booking Traveler Requirements
```

Если seller завтра изменит:

```text
Passport: OPTIONAL → REQUIRED
```

это **не должно ретроактивно менять** уже созданную Booking.

Booking должна хранить immutable/current historical snapshot требований, действовавших при создании.

Audit должен определить лучший способ:

```text
normalized snapshot tables
validated JSON snapshot
hybrid
```

с учётом текущей Prisma/schema architecture.

Нельзя выбирать arbitrary JSON только ради скорости, если это ухудшает validation/security/queryability.

---

# 10. WHEN TRAVELER DATA IS COLLECTED

Проверить и зафиксировать canonical момент.

Для Request flow:

```text
Request created
        ↓
Supplier confirms
        ↓
Customer accepts current offer
        ↓
Traveler Data Collection
        ↓
Final booking confirmation
        ↓
Order / Booking
```

Не собирать full sensitive traveler data до supplier confirmation без business need.

До этого stage достаточно:

```text
travelerCount
adultCount
childCount
infantCount
```

где применимо.

---

# 11. CUSTOMER ACCEPTANCE VS FINAL BOOKING CONFIRMATION

Разделить два действия:

```text
A. Customer accepts supplier-confirmed offer/price
B. Customer confirms completed booking after traveler data entry
```

Audit должен определить, нужно ли хранить оба timestamps/events:

```text
customerAcceptedAt
travelerDataCompletedAt
finalBookingConfirmedAt
```

Не использовать `updatedAt` как surrogate.

Если отдельные timestamps избыточны — дать аргументированную модель, но chronological auditability должна сохраняться.

---

# 12. TTL / OFFER EXPIRY DURING TRAVELER ENTRY

После supplier confirmation и customer acceptance offer не должен жить бесконечно.

Проверить canonical behavior:

```text
Supplier confirms
→ Customer TTL starts / continues
→ Customer accepts
→ Traveler form
→ TTL may still apply until final booking confirmation
```

Если TTL истёк до final confirmation:

```text
do NOT silently create Order
do NOT silently preserve stale price
```

Нужно определить state:

```text
EXPIRED
RECONFIRMATION_REQUIRED
or equivalent existing state
```

Не создавать новый enum, если существующий workflow уже покрывает это.

---

# 13. ORDER CREATION POINT

Audit должен определить точный point of no return.

Предпочтительный canonical target:

```text
Supplier confirmed
→ Customer accepts
→ Traveler required fields completed
→ Final confirmation
→ Order created
→ Booking created
```

Проверить, не создаёт ли текущая architecture Order раньше.

Если Order уже используется как checkout container до final confirmation — зафиксировать tradeoff и предложить migration path, но не менять domain молча.

---

# 14. BOOKING CREATION POINT

Canonical V1 relationship сохраняется:

```text
1 Order = 1 Booking
```

если это текущий утверждённый контракт.

Audit должен определить:

```text
Order created
→ Booking created immediately?
or
Order status transition
→ Booking created?
```

Traveler snapshot должен быть связан именно с final Booking business record.

---

# 15. PAYMENT RELATION

Не предполагать:

```text
Booking = Paid
```

Поддержать:

```text
Unpaid
Partially paid
Paid
Pay later
Refunded
```

где доменная модель позволяет.

Traveler collection не должна зависеть исключительно от payment success, если supplier/business rules требуют traveler data до оплаты.

---

# 16. VOUCHER SOURCE — HARD CONTRACT

Voucher должен использовать:

```text
Booking
→ Booking Travelers
```

а не:

```text
Customer
Order.customer
Payer
```

как источник туристов.

Audit:

- где сейчас генерируется voucher;
- какой DTO/source используется;
- какие traveler fields нужны;
- есть ли voucher template engine;
- поддерживается ли multi-traveler;
- есть ли masking/security.

Canonical:

```text
Voucher Travelers
= Booking Traveler snapshot/current booking traveler data
```

---

# 17. VOUCHER VERSIONING / CHANGE AFTER BOOKING

Проверить сценарий:

```text
Booking created
Traveler name/document corrected
Voucher regenerated
```

Определить:

- разрешены ли traveler edits после Booking?
- до какого статуса?
- нужен ли audit trail?
- надо ли invalidation/reissue voucher?
- кто имеет permission менять?

Не реализовывать без решения.

---

# 18. TRAVELER COUNT CONTRACT

Проверить текущий representation:

```text
quantity
guestCount
passengerCount
adultCount
childCount
infantCount
```

Canonical invariant:

```text
number of Booking Travelers
=
required traveler count
```

если услуга требует per-person traveler records.

Но учесть сервисы, где traveler details могут быть нужны только для lead guest.

Audit должен определить:

```text
ALL_TRAVELERS
LEAD_TRAVELER_ONLY
PER_TRAVELER_TYPE
```

если это действительно необходимо.

---

# 19. CHILD / INFANT REQUIREMENTS

Не считать ребенка уменьшенной копией adult traveler.

Проверить, нужны ли:

```text
travelerType
dateOfBirth
ageAtServiceDate
guardian relation
document rules
```

Age should, where relevant, be evaluated against:

```text
serviceDate
```

а не current date.

Не вводить сложную age engine без необходимости, но архитектура не должна её блокировать.

---

# 20. SERVICE-TYPE DIFFERENCES

Audit минимум для существующих типов:

```text
Tour / Excursion
Accommodation
Transfer
Insurance
```

если они реально есть.

Определить:

| Service | Likely traveler model |
|---|---|
| Tour | participants |
| Accommodation | guests |
| Transfer | passengers |
| Insurance | insured persons |

На UI допустима service-specific терминология, но backend должен иметь coherent traveler participant model.

---

# 21. MARKETPLACE VS STOREFRONT

Traveler data относится к booking fulfillment, а не к Platform Marketplace analytics.

Hard rule:

```text
Storefront Traveler
≠ Platform Marketplace Customer
```

Platform не должен автоматически превращать Storefront end travelers в Platform CRM Customers.

Audit tenant/scope:

```text
Marketplace booking
→ Platform operational access where needed

Storefront booking
→ owning Partner access

Partner A
→ cannot see Partner B travelers
```

---

# 22. ACCESS CONTROL

Traveler data могут быть highly sensitive.

Определить permissions минимум для:

```text
traveler.read
traveler.write
traveler.sensitive.read
traveler.document.read
traveler.export
```

Не обязательно именно такие identifiers — сначала audit current RBAC convention.

Проверить access для:

```text
Platform ADMIN
Platform OPERATOR
Platform MODERATOR
Partner owner/admin
Partner staff
Unauthorized user
Other tenant
```

Frontend hiding недостаточно.

Server-side authorization mandatory.

---

# 23. DATA MINIMIZATION

Seller должен запрашивать только данные, действительно необходимые услуге.

Canonical principle:

```text
NOT_REQUESTED fields
→ не показывать
→ не требовать
→ по возможности не собирать
```

Не строить формы, которые всегда требуют passport/DOB/address.

---

# 24. SENSITIVE DATA HANDLING

Audit должен отдельно классифицировать:

```text
basic personal data
contact data
identity documents
health/special assistance
minor data
```

Для sensitive fields определить:

- storage;
- encryption-at-rest capability if available;
- masking;
- logging;
- export restrictions;
- audit trail;
- retention/deletion;
- API exposure.

Не включать реальные данные документов в seeds/tests.

---

# 25. API CONTRACT AUDIT

Проверить существующие endpoints:

```text
Product create/update
Product detail
Request create/update
Order create/detail
Booking create/detail
Passenger/Traveler CRUD
Voucher generation
```

Определить future API shape без преждевременной реализации.

Минимально:

```text
Product traveler requirements
Booking traveler requirement snapshot
Booking travelers
Traveler validation
```

Не допускать N+1 при Booking detail/list projection.

---

# 26. FRONTEND FLOW AUDIT

Проверить текущие customer-facing pages/components, если существуют:

```text
Marketplace product page
Booking CTA
Request status/confirmation screen
Checkout
Order creation
Booking confirmation
Payment
Voucher
```

Определить exact future UX:

```text
Step 1 — Service
Step 2 — Supplier confirmation
Step 3 — Accept terms
Step 4 — Travelers
Step 5 — Review
Step 6 — Confirm
Step 7 — Payment
```

Не создавать новые screens в audit phase.

---

# 27. CUSTOMER CONVENIENCE — "Я ТОЖЕ ТУРИСТ"

В future UX предусмотреть:

```text
☑ Я являюсь одним из туристов
```

Тогда известные Customer data могут prefill Traveler.

Но:

```text
Customer is NOT automatically Traveler
```

Нужен explicit user choice или reliable business rule.

Audit должен определить безопасный mapping/prefill behavior.

---

# 28. SAVED TRAVELERS / COMPANIONS — FUTURE READINESS

Рассмотреть, но не обязательно реализовывать сейчас:

```text
Saved travelers
Family members
Frequent companions
```

Если добавить позднее, Booking всё равно должен хранить snapshot traveler data, чтобы изменение профиля saved traveler не переписывало historical booking.

---

# 29. TRAVELER EDITABILITY

Определить allowed lifecycle:

```text
Before Order
Before Booking
After Booking / before supplier confirmation
After payment
After voucher
After service
```

Для каждого периода:

```text
editable?
requires approval?
requires voucher regeneration?
audited?
```

---

# 30. AUDIT TRAIL

Для изменения sensitive traveler data определить:

```text
who
when
what field category
old/new value handling
reason
```

Не обязательно хранить plaintext old passport values в audit log.

Audit trail должен быть privacy-aware.

---

# 31. EXPORTS

Traveler data не должны автоматически попасть в generic:

```text
Orders CSV
Bookings CSV
Analytics export
CRM export
```

без explicit business/permission contract.

Определить отдельный export policy.

Potential:

```text
Booking operational export
Voucher
Supplier manifest
```

с минимальным необходимым набором полей.

---

# 32. SEARCH

Не индексировать sensitive traveler document values в global search без отдельного approved security contract.

Допустимо рассмотреть:

```text
name
booking ref
voucher ref
```

Документы — только если действительно необходимы operationally и access-controlled.

---

# 33. REPRESENTATIVE SEED CONTRACT

После будущей implementation dataset должен содержать:

```text
Customer = Traveler
Customer != Traveler
Customer = one of multiple Travelers
1 traveler
2 travelers
family/group
adult + child
different payer
different service requirements
```

Current clean dataset не нужно снова полностью reset, если можно безопасно расширить существующий canonical seed.

---

# 34. REQUIRED ARCHITECTURE OUTPUT

Создать:

```text
docs/architecture/TRAVELER_DATA_REQUIREMENTS_BOOKING_PARTICIPANTS_ARCHITECTURE.md
```

или другой canonical docs path, согласованный со структурой repo.

Документ должен содержать минимум:

```text
1. Current State Audit
2. Existing Models
3. Existing UI/API Flow
4. Gap Matrix
5. Customer/Payer/Traveler Contract
6. Traveler Ownership
7. Product Requirement Model
8. Snapshot Strategy
9. Checkout Collection Point
10. Request/Order/Booking lifecycle
11. Payment relationship
12. Voucher source
13. Service-type differences
14. Security/Privacy/RBAC
15. Audit Trail
16. Export/Search policy
17. Seed/Test requirements
18. Recommended implementation phases
19. Risks
20. Final Architecture Verdict
```

---

# 35. GAP MATRIX — MANDATORY

Формат:

| Capability | Current State | Target | Gap | Severity | Proposed Stage |
|---|---|---|---|---|---|

Минимально покрыть:

```text
Passenger/Traveler model
Booking relation
Product traveler requirements
Requirement states
Snapshot
Customer/Payer/Traveler distinction
Traveler collection UI
Traveler validation
TTL behavior
Order creation point
Booking creation point
Voucher source
Traveler edit lifecycle
Sensitive data access
Tenant isolation
Exports
Audit trail
Representative seed
Tests
```

---

# 36. IMPLEMENTATION PHASING — PROPOSE ONLY

Audit должен предложить staged implementation, например:

```text
Stage A
Domain/schema contract + traveler requirements model

Stage B
Product seller configuration

Stage C
Checkout traveler collection

Stage D
Booking snapshot + Booking Travelers

Stage E
Booking Detail traveler section

Stage F
Voucher integration

Stage G
Security/audit/export hardening

Stage H
Representative seed + strict runtime review
```

Но **не начинать Stage A автоматически**.

---

# 37. HARD QUESTIONS AUDIT MUST ANSWER

Финальный audit обязан дать однозначные ответы:

```text
Q1. Passenger уже является Traveler или нужна новая entity?
Q2. К чему Traveler должен быть привязан canonical: Order или Booking?
Q3. Где seller задаёт Traveler Requirements?
Q4. Как хранить NOT_REQUESTED / OPTIONAL / REQUIRED?
Q5. Как snapshot requirements создаётся и где хранится?
Q6. В какой момент checkout запрашивает traveler data?
Q7. Когда создаётся Order?
Q8. Когда создаётся Booking?
Q9. Может ли TTL истечь во время traveler form?
Q10. Что происходит при expiry?
Q11. Как Customer связывается с Traveler?
Q12. Как моделируется Payer?
Q13. Как Voucher получает travelers?
Q14. Как меняются traveler data после booking?
Q15. Какой audit trail нужен?
Q16. Какие поля считаются sensitive?
Q17. Кто имеет к ним доступ?
Q18. Какие поля могут экспортироваться?
Q19. Как обеспечивается tenant isolation?
Q20. Какие schema/API/UI изменения обязательны для первой implementation?
```

---

# 38. ROADMAP UPDATE

Обновить additive:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Зафиксировать:

```text
Traveler Architecture Audit
Customer ≠ Payer ≠ Traveler
Booking → 1..N Travelers
Seller-defined Traveler Requirements
Booking snapshot contract
Voucher ← Booking Travelers
future implementation stages
```

Не переписывать историю.

Не объявлять implementation completed.

---

# 39. TEST / RUNTIME SCOPE FOR THIS AUDIT

Так как это architecture audit:

Не требуется внедрять новую traveler functionality.

Но требуется подтвердить current state через:

```text
schema inspection
API inspection
frontend route/component inspection
seed inspection
existing tests
representative runtime where available
```

Не выдавать предположения за существующую реализацию.

---

# 40. VERDICT RULES

Допустимые финальные verdict:

```text
VERDICT A — ARCHITECTURE AUDIT COMPLETED — READY FOR IMPLEMENTATION
```

только если:

```text
[ ] Current models audited
[ ] Current API audited
[ ] Current customer flow audited
[ ] Passenger vs Traveler resolved
[ ] Customer/Payer/Traveler contract fixed
[ ] Booking ownership fixed
[ ] Requirement model fixed
[ ] Snapshot strategy fixed
[ ] Checkout collection point fixed
[ ] Order/Booking creation points fixed
[ ] TTL behavior fixed
[ ] Voucher source fixed
[ ] Security/privacy model fixed
[ ] Tenant isolation model fixed
[ ] Gap Matrix complete
[ ] Implementation stages proposed
[ ] Roadmap updated
[ ] No contradictions remain
[ ] Real Final SHA present
[ ] HEAD == origin
```

Иначе:

```text
VERDICT B — ARCHITECTURE AUDIT INCOMPLETE
```

---

# 41. GIT CLOSURE

Final report обязан содержать реальные:

```text
Starting SHA
Implementation/Documentation SHA
Final SHA
origin/master
HEAD == origin
```

Никаких:

```text
<pending>
TBD
```

при `VERDICT A`.

---

# 42. REQUIRED FINAL REPORT

Создать преимущественно на русском:

```text
TRAVELER DATA REQUIREMENTS + CHECKOUT COLLECTION + BOOKING SNAPSHOT + VOUCHER SOURCE — ARCHITECTURE AUDIT REPORT

1. Starting State
2. Current Schema
3. Current Commerce Flow
4. Passenger vs Traveler
5. Customer/Payer/Traveler Contract
6. Traveler Ownership
7. Product Requirement Architecture
8. Snapshot Architecture
9. Checkout Collection Point
10. Request → Order → Booking Contract
11. TTL / Offer Expiry
12. Payment Relationship
13. Voucher Source
14. Service-Type Differences
15. Security / Privacy / RBAC
16. Tenant Isolation
17. Export/Search Policy
18. Gap Matrix
19. Recommended Implementation Stages
20. Roadmap Update
21. Git Closure
22. Residual Risks
23. Final Verdict
```

---

# 43. STOP RULE

После завершения audit:

```text
STOP.
```

Не начинать автоматически:

```text
schema migration
Product traveler requirements implementation
Traveler checkout UI
Booking Detail redesign
Voucher implementation
seed expansion
Orders/Bookings remediation
Product Freshness
Step 3.12
Finance
```

Сначала предоставить audit report пользователю для отдельной квалификации.
