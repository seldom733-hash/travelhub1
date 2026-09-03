# PHASE 3 — PRE-STEP 3.12 — DEV DATABASE CLEAN RESET + REPRESENTATIVE CANONICAL RESEED

## STATUS

Предыдущая попытка закрыть Request Center через temporal remediation старого representative dataset **не должна продолжаться как основной путь**.

Причина:

```text
старый dev/test dataset содержит:
- legacy 6-digit commerce references;
- chronology anomalies;
- Order ↔ Payment currency anomalies;
- historical seed inconsistencies;
- данные, созданные до текущих canonical contracts.
```

Вместо точечного ремонта старых тестовых записей выполнить:

```text
CONTROLLED DEV DATABASE CLEAN RESET
+
REPRESENTATIVE CANONICAL RESEED
```

Это **не production migration** и не production data repair.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose-документация должны быть преимущественно **на русском языке**:

- Implementation Report;
- Remediation Report;
- Strict Review Report;
- Evidence / Runtime Report;
- Gap Audit;
- findings explanations;
- root cause analysis;
- architecture decisions;
- security findings;
- runtime evidence descriptions;
- conclusions/recommendations;
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
- стандартизированных `VERDICT` strings.

Если итоговый отчёт преимущественно написан на английском — задача считается незавершённой.

Никогда не включать plaintext passwords, tokens, secrets или credentials. Использовать placeholders/redaction.

---

# 1. SCOPE FREEZE

Выполнить только:

```text
1. Audit текущего dev/test seed pipeline.
2. Controlled очистку representative dev/test business data.
3. Canonical reseed.
4. Hard invariant verification.
5. Authenticated browser/runtime verification.
6. Additive roadmap update.
7. Final evidence report.
```

Не выполнять:

- production database reset;
- production migrations ради тестовых данных;
- Finance Center;
- Product Freshness;
- массовый redesign UI;
- новую Partner/Platform architecture;
- новый Step 3.12;
- unrelated refactoring;
- массовую переделку Orders/Bookings UI в рамках этого prompt.

Не удалять migrations или schema history.

---

# 2. ENVIRONMENT SAFETY — P0

Перед любой destructive operation доказать, что target database:

```text
НЕ production
НЕ shared production-like DB
НЕ CI DB другого активного job
НЕ база с реальными пользовательскими данными
```

В отчёте показать redacted evidence:

```text
environment
database name
host category
NODE_ENV / equivalent
```

Без password/secret.

Destructive reset должен иметь explicit guard:

```text
ALLOW_DEV_DATABASE_RESET=true
```

или эквивалентный защитный механизм.

Если environment не может быть однозначно квалифицирован как disposable dev/test:

```text
STOP
VERDICT B
```

---

# 3. RESET STRATEGY

Предпочтительно:

```text
fresh disposable database
→ run full migrations
→ run canonical seed
```

Если используется текущая dev DB:

```text
truncate/delete business data
→ reset sequences where required
→ reseed
```

Но:

- не удалять migration history;
- не повреждать schema;
- не удалять RBAC/system configuration без необходимости;
- не оставлять orphan records;
- reset должен быть воспроизводим одной documented командой/script.

---

# 4. DATA CLASSIFICATION BEFORE RESET

Перед очисткой составить таблицу:

```text
KEEP
RESET
REGENERATE
```

Минимально рассмотреть:

### KEEP / REGENERATE carefully

```text
migrations
roles
permissions
workspace capability config
required system settings
admin/test identities
reference configuration
```

### RESET / RESEED business representative data

```text
partners
partner storefronts
customers
products/services
requests
orders
bookings
travelers/passengers
payments
refunds
payout-related test records where applicable
analytics/events needed for representative dashboards
related snapshots
```

Не предполагать список таблиц по памяти — подтвердить реальную schema/dependencies.

---

# 5. CANONICAL COMMERCE REFERENCE CONTRACT — HARD GATE

Все новые business references должны использовать установленную canonical width:

```text
Request:
MKT-REQ-00000001

Order:
MKT-ORD-00000001

Booking:
MKT-BKG-00000001

Payment:
MKT-PAY-00000001-1
MKT-PAY-00000001-2

Refund:
MKT-REF-00000001-1
```

Если текущий canonical Refund contract отличается — сначала доказать существующий проектный формат и использовать его последовательно.

Запрещено генерировать:

```text
MKT-ORD-000232
MKT-BKG-000232
MKT-REQ-000232
```

Hard invariant:

```text
legacy_6_digit_reference_count = 0
```

Проверить минимум:

```text
Requests
Orders
Bookings
Payments
Refunds
```

И доказать одинаковое представление в:

```text
DB
API
Registry
Detail
Search
CSV
XLSX
```

---

# 6. COMMERCE SEQUENCE CONTRACT

Одна коммерческая цепочка должна иметь общий root:

```text
commerceSequence = 232

MKT-REQ-00000232
MKT-ORD-00000232
MKT-BKG-00000232
MKT-PAY-00000232-1
MKT-REF-00000232-1
```

где применимо.

Request может отсутствовать для authoritative real-time flow:

```text
Order
→ Booking
→ Payment
```

но shared root остаётся canonical.

Relationships строятся по FK/UUID, а не путём parsing reference string.

Запрещено:

```text
MAX(reference) + 1
string-derived relationship
duplicate commerceSequence inside conflicting chains
```

Sequence allocation должен оставаться concurrency-safe.

---

# 7. REPRESENTATIVE BUSINESS CHAINS

Seed должен создавать **не случайные независимые записи**, а валидные бизнес-сценарии.

Минимальный набор сценариев:

```text
S1  Request pending supplier
S2  Supplier confirmed, customer pending
S3  Customer accepted → Order
S4  Order → Booking
S5  Unpaid Order
S6  Partially paid Order
S7  Fully paid Order
S8  Completed booking/order
S9  Cancelled before payment
S10 Cancelled after payment
S11 Partial refund
S12 Full refund
S13 Supplier rejected
S14 Supplier unavailable
S15 Supplier timeout
S16 Customer timeout
S17 Price changed → customer accepts new terms
S18 Price changed → customer rejects
S19 Authoritative real-time flow without Request
```

Не обязательно делать одинаковое количество каждого scenario, но каждый должен присутствовать хотя бы в representative fixtures/runtime dataset.

---

# 8. TEMPORAL INTEGRITY — HARD GATE

Новый seed обязан соблюдать business chronology.

Для обычного non-instant Request flow:

```text
Request.createdAt
<= supplierRespondedAt
<= customerAcceptedAt
<= Request.convertedAt
<= Order.createdAt
```

Если `Request.convertedAt` canonical совпадает с моментом создания Order:

```text
Request.convertedAt == Order.createdAt
```

или допустимая разница должна быть явно задокументирована.

Для downstream событий:

```text
Order.createdAt
<= Booking.createdAt
```

Для payment chronology:

```text
Payment.createdAt <= paidAt
```

Для completed flows:

```text
serviceDate <= completedAt
```

где это соответствует domain semantics.

Для cancellation/refund:

- cancellation timestamp не должен предшествовать созданию сущности;
- refund не должен предшествовать успешному payment;
- refund amount не должен превышать refundable/paid amount.

Нельзя использовать `updatedAt` как business-event timestamp.

---

# 9. PAYMENT / REFUND FINANCIAL INTEGRITY

Для seeded Orders проверить:

```text
Order total
Paid amount
Refunded amount
Outstanding amount
```

Hard financial invariants:

```text
paidAmount >= 0
refundedAmount >= 0
refundedAmount <= paidAmount
outstandingAmount >= 0
```

Если canonical formula:

```text
outstanding = orderTotal - successfullyPaidAmount
```

использовать её.

Refund не должен превращать факт исторической оплаты в `NOT_PAID`.

Не смешивать:

```text
Order Status
Payment Status
Refund Status
```

как одну state axis.

В рамках этого prompt не требуется redesign UI, но seed должен позволять дальнейшую проверку этих состояний.

---

# 10. CURRENCY INTEGRITY

Устранить старые seed anomalies, при которых связанные Order/Payment/Refund конфликтуют по currency без валидной FX/business причины.

Для обычной single-currency цепочки:

```text
Order.currency
=
Payment.currency
=
Refund.currency
```

Если существуют legitimate multi-currency/FX flows — seed должен явно маркировать и документировать их, а не создавать случайный mismatch.

Hard invariant для canonical non-FX representative chains:

```text
currency_mismatch_count = 0
```

---

# 11. CUSTOMER / PAYER / TRAVELER — CANONICAL IDENTITY CONTRACT

Новый seed должен отражать уже согласованную business semantics:

```text
Customer ≠ Payer ≠ Traveler
```

Роли:

```text
Customer
= покупатель / заказчик

Payer
= фактический плательщик

Traveler
= получатель услуги / участник бронирования
```

Один человек может выполнять несколько ролей, но система не должна предполагать их равенство.

Seed обязан содержать минимум:

```text
Case A:
Customer = Payer = Traveler

Case B:
Customer = Payer
Traveler = другое лицо

Case C:
Customer ≠ Payer
Travelers = 1..N других лиц

Case D:
Customer также является одним из нескольких Travelers
```

---

# 12. BOOKING → TRAVELERS

Canonical relationship:

```text
Booking
→ 1..N Travelers
```

Не создавать Traveler как обязательный CRM Customer.

Опциональная связь с Customer допустима, если конкретный человек уже является CRM entity.

Seed должен иметь bookings:

```text
1 traveler
2 travelers
family/group case
adult + child
```

Если schema пока использует `Passenger`, сначала определить, является ли это текущей реализацией Traveler concept.

Не создавать параллельную дублирующую сущность только ради терминологии.

Если `Passenger` уже семантически соответствует Traveler:

```text
document the mapping
Traveler business concept = Passenger technical model
```

и использовать существующую модель до отдельной approved schema evolution.

---

# 13. SELLER-DEFINED TRAVELER DATA REQUIREMENTS

Новый representative seed должен подготовить данные под следующий canonical contract:

```text
Seller defines traveler data requirements on Product/Service
→ Booking snapshots requirements
→ Booking Travelers provide requested values
→ Voucher consumes Booking Traveler data
```

Для поля requirement использовать семантику:

```text
NOT_REQUESTED
OPTIONAL
REQUIRED
```

Если такая модель ещё не реализована, **не строить большую новую подсистему в этом reset prompt**.

Вместо этого:

1. провести schema audit;
2. определить текущую поддержку;
3. создать representative traveler data в пределах существующей модели;
4. зафиксировать gap для следующего implementation prompt.

Не блокировать reset всей DB из-за отсутствия будущего requirements engine.

---

# 14. PRODUCT / SERVICE REPRESENTATIVENESS

Seed должен содержать несколько типов услуг, чтобы будущая логика Travelers могла реально проверяться.

Минимум representative categories, если они уже существуют в текущей domain model:

```text
Tour / Excursion
Accommodation / Hotel
Transfer
Insurance
другие реально поддерживаемые service types
```

Не создавать fake enum/service type, которого нет в schema.

Для разных услуг seeded Traveler data должны отличаться по полноте:

```text
simple excursion
→ basic identity/contact

hotel
→ guest details

insurance
→ DOB/document data where supported
```

Но не вводить обязательность полей, которой пока нет в canonical implementation.

---

# 15. PLATFORM / PARTNER SCOPE INTEGRITY

Seed должен сохранять разделение:

```text
PLATFORM
PARTNER — Marketplace Basic
PARTNER — Storefront Pro
```

Создать representative:

```text
Marketplace partners
Storefront partners
Marketplace commerce
Storefront own commerce
Storefront → TravelHub subscription/direct SaaS relation
```

Hard invariant:

```text
Storefront customer commerce
≠ Platform Marketplace commerce
```

Platform Marketplace metrics не должны поглощать Storefront customer Orders/Bookings/Payments.

---

# 16. TENANT ISOLATION

Seed минимум для:

```text
Partner A
Partner B
```

Hard invariant:

```text
Partner A sees only A-scoped operational data
Partner B sees only B-scoped operational data
```

`acquisitionSource` и аналогичные provenance fields не являются authorization boundary.

Проверить API scope enforcement, не только UI hiding.

---

# 17. REPRESENTATIVE VOLUME

Dataset должен быть достаточно большим для проверки:

```text
pagination
filters
search
aggregates
exports
analytics
```

Но не создавать огромный dataset без необходимости.

Минимальная рекомендация:

```text
Orders        > 100
Bookings      > 100
Payments      > 100
Requests      > 100
Customers     > 50
Products      > 20
Travelers     > 100
```

Если существующие tests/dashboard требуют большего объёма — выбрать обоснованный volume и указать его в отчёте.

Важно не число само по себе, а покрытие business states.

---

# 18. DATE DISTRIBUTION

Representative data должна покрывать calendar presets:

```text
Сегодня
Неделя
Месяц
Квартал
6 месяцев
Год
```

Создавать события относительно deterministic seed anchor/current test clock так, чтобы runtime analytics не зависела от случайных будущих дат.

Не генерировать нелепые chronology только ради заполнения нескольких месяцев.

---

# 19. DETERMINISTIC SEED

Seed должен быть воспроизводим.

Требования:

```text
fixed deterministic random seed
or deterministic fixture generation
```

Один и тот же seed run должен давать:

```text
same business distribution
same invariant results
predictable representative references
```

Не обязательно сохранять одинаковые UUID, если implementation этого не гарантирует, но business distribution должна быть стабильной.

---

# 20. IDEMPOTENCY / CLEAN RE-RUN

Должно быть возможно выполнить:

```text
reset
seed
verify
```

повторно без:

```text
duplicate unique violations
duplicate references
duplicate commerce roots
orphan records
manual cleanup
```

Добавить documented command/script.

---

# 21. POST-SEED HARD INVARIANT AUDIT

После seed запустить machine-checkable audit.

Минимум вывести:

```text
legacy 6-digit commerce refs                    = 0
duplicate canonical references                  = 0
duplicate payment ordinal per commerce root     = 0
broken Request → Order links                     = 0
broken Order → Booking links                     = 0
broken Payment links                             = 0
orphan Travelers/Passengers                      = 0
invalid Request chronology                       = 0
invalid Order/Booking chronology                 = 0
Payment.createdAt > paidAt                       = 0
refund > paid                                    = 0
invalid completedAt                              = 0
invalid cancellation timestamps                  = 0
non-FX currency mismatch                         = 0
cross-tenant leakage test failures               = 0
```

Если schema/domain semantics требуют другой invariant — объяснить это в отчёте.

---

# 22. REPRESENTATIVE CHAIN EVIDENCE

Показать минимум 5 полных цепочек из DB/API.

### Chain A — normal paid completed

```text
Request
Order
Booking
Traveler(s)
Payment
Completion
```

### Chain B — partial payment

```text
Order total
Paid
Outstanding
```

### Chain C — refund

```text
Paid
Refunded
Net retained
```

### Chain D — Customer != Traveler

```text
Customer
Payer
Traveler(s)
```

### Chain E — non-converted/timeout/rejected Request

Без fabricated downstream objects.

Для каждой показать canonical 8-digit references.

---

# 23. AUTHENTICATED BROWSER RUNTIME

После clean reseed обязательно проверить живой UI.

Минимум:

```text
/app/requests
/app/orders
/app/bookings
```

Проверить:

- таблицы не пустые;
- human-readable customer/service/supplier;
- 8-digit references;
- pagination;
- search;
- filters;
- Request dedicated detail;
- dates выглядят хронологически корректно;
- representative paid/unpaid/refund states присутствуют;
- Customer/Traveler representative data существуют в backend/schema даже если Booking Detail UI ещё не реализован полностью.

Не заявлять реализацию Orders/Bookings full-page detail, если она ещё отсутствует.

---

# 24. EXPORT VERIFICATION

Для существующих exportable registries выполнить реальные downloads.

Минимум:

```text
CSV
XLSX
```

Проверить:

```text
filtered total == CSV rows == XLSX rows
```

для одного representative filter.

References должны быть canonical 8-digit.

Human-readable entity fields должны сохраняться.

Если Travelers содержат sensitive document fields, они **не должны автоматически попадать в generic export**, если это не предусмотрено отдельным permission/business contract.

---

# 25. SEARCH VERIFICATION

Проверить, что reset не ломает search.

Минимум:

```text
Request reference
Order reference
Booking reference
Customer name/code
Partner name/code
Service title/code
```

Где соответствующий search уже существует.

Не добавлять новый search framework только ради prompt.

---

# 26. SECURITY / PRIVACY

Traveler data могут включать:

```text
DOB
document number
nationality
contact info
medical/special requirements
```

Поэтому:

- не логировать чувствительные значения в plaintext без необходимости;
- не помещать реальные паспортные данные в seed;
- использовать явно synthetic values;
- избегать realistic government document identifiers;
- не раскрывать sensitive fields через Platform/Partner scopes без authorization.

Seed data должны быть очевидно synthetic.

---

# 27. TEST GATES

Запустить применимые:

```text
backend unit tests
backend integration/e2e
frontend unit tests
typecheck
build
lint where canonical CI requires
seed-specific invariant tests
```

Отчёт должен показывать:

```text
Starting baseline
After reseed/change
New failures
Pre-existing failures
```

`VERDICT A` нельзя обосновывать фразой “no new failures”, если сам reset/seed pipeline или его hard invariant tests падают.

---

# 28. LEGACY FAILURES

Существующие unrelated failures не исправлять автоматически в этом scope.

Но:

- перечислить их;
- доказать, что reset не добавил новых;
- hard tests текущего scope должны быть зелёными.

Если failure относится непосредственно к:

```text
seed
references
chronology
currency integrity
tenant isolation
Request/Order/Booking relationships
```

он является blocker и не может быть назван unrelated.

---

# 29. REQUEST CENTER PREVIOUS REPORT

Предыдущий `VERDICT A` по Request Center V2 считать **нефинальным** до clean reseed + revalidation.

После reseed повторно проверить минимум:

```text
Request search S1-S6
Request detail click
direct URL
refresh
temporal timeline
conversion date
CSV/XLSX
security
```

Не нужно заново переписывать Request UI, если поведение уже корректно.

---

# 30. ORDERS / BOOKINGS — OBSERVED GAPS TO PRESERVE FOR NEXT PROMPT

Во время runtime после reseed зафиксировать, но **не реализовывать здесь**, если не требуется для корректности seed:

```text
Orders:
- table record/reference click пока не открывает dedicated full-page detail;
- legacy 6-digit refs должны исчезнуть после reseed;
- payment/refund semantics требуют отдельного audit.

Bookings:
- table record/reference click пока не открывает dedicated full-page detail;
- dedicated full-page detail требуется;
- Traveler block должен стать major section.
```

Это будет отдельный следующий remediation/implementation prompt.

---

# 31. TRAVELER REQUIREMENTS — NEXT-STAGE CONTRACT

Зафиксировать в roadmap без преждевременной полной реализации:

```text
Seller/Product defines Traveler Data Requirements
        ↓
Booking snapshots requirements
        ↓
Booking stores 1..N Travelers
        ↓
Booking Detail displays required/requested fields
        ↓
Voucher consumes Booking Traveler data
```

Field requirement states:

```text
NOT_REQUESTED
OPTIONAL
REQUIRED
```

Идентичность:

```text
Customer ≠ Payer ≠ Traveler
```

---

# 32. ROADMAP UPDATE

Обновить:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

только additive.

Зафиксировать:

- старый dev dataset признан legacy/inconsistent;
- выполнен controlled clean reset;
- canonical representative reseed;
- 8-digit commerce reference hard invariant;
- temporal integrity;
- Customer/Payer/Traveler distinction;
- Traveler Requirements future contract;
- точный NEXT stage.

Не переписывать историю старых этапов.

---

# 33. GIT CLOSURE

Final report обязан содержать реальные:

```text
Starting SHA
Implementation SHA
Final SHA
origin/master SHA
HEAD == origin
```

Никаких:

```text
<pending>
TBD
later
```

при `VERDICT A`.

---

# 34. FINAL ACCEPTANCE MATRIX

`VERDICT A` разрешён только если:

```text
[ ] Target DB доказана как disposable dev/test
[ ] Destructive reset guard существует
[ ] Schema/migrations сохранены
[ ] Reset reproducible
[ ] Seed reproducible
[ ] Canonical 8-digit references only
[ ] legacy 6-digit refs = 0
[ ] duplicate references = 0
[ ] shared commerce sequence integrity PASS
[ ] Request chronology invalid count = 0
[ ] Order/Booking chronology PASS
[ ] Payment chronology PASS
[ ] refund <= paid PASS
[ ] completed/cancelled timestamps PASS
[ ] non-FX currency mismatch = 0
[ ] Customer/Payer/Traveler representative cases exist
[ ] Booking 1..N Travelers representative data exist
[ ] Tenant A/B isolation PASS
[ ] Marketplace vs Storefront scope PASS
[ ] Representative business states covered
[ ] Calendar/date distribution representative
[ ] Request Center revalidation PASS
[ ] CSV/XLSX representative reconciliation PASS
[ ] Browser runtime PASS
[ ] Scope-specific tests PASS
[ ] No new regressions
[ ] Roadmap updated additively
[ ] Real Final SHA present
[ ] HEAD == origin
```

Любой недоказанный hard gate:

```text
VERDICT B
```

---

# 35. REQUIRED FINAL REPORT STRUCTURE

Создать преимущественно на русском:

```text
DEV DATABASE CLEAN RESET + REPRESENTATIVE CANONICAL RESEED — FINAL REPORT

1. Starting State
2. Environment Safety Evidence
3. Tables/Data Classification
4. Reset Method
5. Seed Architecture
6. Reference Contract
7. Representative Business Scenarios
8. Temporal Integrity
9. Financial/Currency Integrity
10. Customer/Payer/Traveler Evidence
11. Tenant/Workspace Isolation
12. Invariant Audit
13. Browser Runtime Evidence
14. Export/Search Evidence
15. Test Matrix
16. Residual Gaps
17. Roadmap Update
18. Git Closure
19. Final Verdict
```

---

# 36. STOP RULE

После завершения этого prompt:

```text
STOP.
```

Не начинать автоматически:

- Orders/Bookings Detail implementation;
- Traveler Requirements implementation;
- Product Freshness;
- Step 3.12;
- Finance;
- другие PRE-STEP remediation.

Сначала предоставить пользователю final report для отдельной квалификации.
