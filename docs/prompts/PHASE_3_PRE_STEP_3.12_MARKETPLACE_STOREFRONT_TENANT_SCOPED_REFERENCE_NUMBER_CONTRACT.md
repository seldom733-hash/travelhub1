# PHASE 3 — PRE-STEP 3.12 — MARKETPLACE / STOREFRONT TENANT-SCOPED REFERENCE NUMBER CONTRACT

## ТИП ЗАДАЧИ

**ARCHITECTURE CONTRACT + IMPLEMENTATION + DATA MIGRATION + RUNTIME EVIDENCE**

Starting point:

```text
Starting SHA: 8a098c7
```

Цель: ввести однозначную, человекочитаемую и tenant-aware систему кодирования операционных и финансовых объектов TravelHub, которая визуально и технически отличает:

1. TravelHub Marketplace;
2. собственную коммерцию каждого Storefront-партнёра;
3. прямые SaaS/подписочные отношения Storefront → TravelHub.

Это продолжение уже зафиксированной архитектуры:

```text
Storefront Commerce Volume
≠ Marketplace GMV
≠ TravelHub Revenue
```

и:

```text
Platform operational scope
= Marketplace only
```

Storefront test/demo data сохраняются и используются для проверки функциональной готовности Partner / Storefront Workspace.

---

# LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose documentation должны быть преимущественно **на русском языке**:

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

Английский разрешён для technical identifiers: file paths, class/method/DTO/model/table names, endpoints, HTTP methods/status codes, CLI/Git commands, SQL, commit messages, enums, permission identifiers, code snippets и standardized `VERDICT`.

Если итоговый отчёт преимущественно английский — задача не завершена.

---

# 0. PRE-FLIGHT

Перед изменениями:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
```

Ожидаемый starting SHA:

```text
8a098c7
```

Если HEAD отличается — указать фактический SHA и причину.

Сначала провести короткий repository audit существующих идентификаторов/номеров для:

```text
Order
Request / Application
Booking
Payment
Invoice
Refund
Partner / Storefront
```

Не предполагать имена полей или таблиц.

---

# 1. CORE IDENTITY CONTRACT

Нельзя заменять внутренние идентификаторы человекочитаемыми кодами.

Зафиксировать два разных уровня:

```text
INTERNAL ID
→ UUID / existing internal PK
→ globally unique
→ immutable
→ relations
→ API authorization/security
→ persistence identity
```

и:

```text
REFERENCE NUMBER
→ human-readable
→ business/workspace scoped
→ tenant-aware
→ immutable after creation
→ UI
→ search
→ support
→ documents
→ exports where applicable
```

`referenceNumber` не должен становиться заменой internal UUID в authorization или relational integrity.

---

# 2. CANONICAL NAMESPACE CONTRACT

## 2.1 Marketplace

Marketplace-owned operational objects:

```text
MKT-ORD-000001
MKT-REQ-000001
MKT-BKG-000001
MKT-PAY-000001
```

Canonical pattern:

```text
MKT-{TYPE}-{SEQUENCE}
```

## 2.2 Storefront commerce

Каждый Storefront получает постоянный системный код:

```text
SF001
SF002
SF003
...
```

Пример:

```text
SF001-ORD-000001
SF001-REQ-000001
SF001-BKG-000001
SF001-PAY-000001

SF002-ORD-000001
SF002-REQ-000001
SF002-BKG-000001
SF002-PAY-000001
```

Canonical pattern:

```text
{STOREFRONT_CODE}-{TYPE}-{SEQUENCE}
```

## 2.3 Storefront → TravelHub SaaS

Прямые финансовые отношения Storefront с TravelHub должны иметь отдельный namespace и не смешиваться с customer-commerce payments Storefront.

Пример:

```text
SAAS-SF001-INV-000001
SAAS-SF001-PAY-000001
SAAS-SF001-REF-000001
```

Canonical pattern:

```text
SAAS-{STOREFRONT_CODE}-{TYPE}-{SEQUENCE}
```

Реализовывать SaaS document types только если соответствующие authoritative domain objects уже существуют. Не создавать новый billing engine в этой задаче.

---

# 3. TYPE CODES

Canonical abbreviations:

```text
ORD = Order
REQ = Request / Application
BKG = Booking
PAY = Payment
INV = Invoice
REF = Refund
```

Если repository использует другой canonical domain object для `Заявка`, сначала установить его фактическую семантику.

Не создавать `REQ` entity только ради нумерации, если capability отсутствует.

---

# 4. STOREFRONT CODE CONTRACT

`STOREFRONT_CODE`:

```text
→ system-generated
→ unique
→ immutable
→ independent from company name
→ independent from slug
→ independent from domain
→ independent from owner name
```

Например:

```text
SF001
```

не должен меняться при:

```text
company rename
brand rename
domain change
owner/director change
subscription plan change
```

Запрещено использовать название компании как namespace:

```text
GOLDEN-TRAVEL-ORD-...
```

---

# 5. SEQUENCE SCOPE

Предпочтительный contract:

```text
Marketplace:
sequence per object type

Storefront:
sequence per Storefront + object type

SaaS:
sequence per Storefront + SaaS object type
```

То есть:

```text
SF001-ORD-000001
SF001-BKG-000001
SF002-ORD-000001
```

является корректным.

Одинаковый numeric suffix у разных Storefront допустим, потому что полный `referenceNumber` уникален.

---

# 6. UNIQUENESS AND CONCURRENCY — HARD REQUIREMENT

Генерация reference numbers должна быть безопасна при concurrent creation.

Запрещено:

```text
SELECT MAX(...) + 1
```

без concurrency-safe механизма.

Требуется доказать отсутствие duplicate references при параллельном создании.

Использовать подход, совместимый с текущей БД/ORM/архитектурой:

```text
database sequence
counter row + atomic update/locking
transaction-safe allocator
```

или эквивалентный корректный механизм.

На полном `referenceNumber` должен существовать appropriate uniqueness constraint/index.

---

# 7. IMMUTABILITY

После создания объекта:

```text
referenceNumber MUST NOT change
```

при:

```text
status transition
customer change where allowed
partner/company rename
workspace UI changes
subscription plan changes
payment status changes
booking lifecycle transitions
```

Если объект переносится между tenants — сначала определить, допустима ли такая операция вообще. Не перенумеровывать исторический документ молча.

---

# 8. MARKETPLACE vs STOREFRONT VISUAL TRACEABILITY

Нумерация должна позволять сразу определить provenance:

```text
MKT-BKG-000125
→ Marketplace Booking

SF003-BKG-000042
→ Storefront SF003 Booking
```

Это дополнительный observability/debugging layer, но не security boundary.

Нельзя считать:

```text
prefix == authorization
```

Authorization остаётся server-side workspace/tenant/permission based.

---

# 9. PAYMENTS — BUSINESS SEMANTICS MUST REMAIN SEPARATE

Критически различать:

```text
SF001-PAY-000025
```

как:

```text
Storefront customer commerce payment
```

и:

```text
SAAS-SF001-PAY-000008
```

как:

```text
Storefront → TravelHub direct/SaaS payment
```

Первое:

```text
→ Partner / Storefront finance
→ NOT Platform Marketplace revenue
```

Второе:

```text
→ Platform Finance / SaaS economics
```

Если существующая Payment model не позволяет надёжно различить business purpose/economic counterparty — зафиксировать architecture gap. Не маскировать проблему одним prefix.

---

# 10. EXISTING DATA MIGRATION

Текущие test/demo records НЕ удалять.

Сохранить populations, включая известный representative dataset:

```text
Marketplace Orders:    1085
Storefront Orders:      431

Marketplace Bookings:   405
Storefront Bookings:    287

Marketplace Payments:   484
Storefront Payments:    332
```

Это reference counts, а не hardcoded product values. Использовать фактические runtime/DB counts.

Для existing records выполнить deterministic migration/backfill `referenceNumber`.

Требования:

```text
0 deleted
0 unintended reassigned
0 duplicate reference numbers
0 NULL referenceNumber where required
```

---

# 11. DETERMINISTIC STOREFRONT CODE ASSIGNMENT

Для существующих Storefront-партнёров назначить `SFxxx` детерминированно.

Не использовать случайный порядок DB query.

Порядок назначения должен быть воспроизводимым и документированным, например по стабильному existing immutable key/creation order с deterministic tie-breaker.

Повторный seed/migration не должен менять уже присвоенные Storefront codes.

---

# 12. CREATION FLOWS

Проверить все реальные creation paths:

```text
API
service
seed
demo seed
factory
test fixture
admin/internal creation
Partner Workspace creation
payment creation
booking creation
```

Новые записи после migration должны автоматически получать правильный reference number.

Не ограничиваться backfill существующей БД.

---

# 13. CHAIN CONSISTENCY

Для связанных объектов проверить:

```text
Order
→ Request where applicable
→ Booking
→ Payment
→ Refund where applicable
```

Storefront chain должна принадлежать одному tenant.

Пример:

```text
SF003-ORD-000010
SF003-BKG-000006
SF003-PAY-000009
```

Не обязательно иметь одинаковый numeric suffix, но namespace Storefront должен соответствовать authoritative tenant ownership.

Marketplace chain должна оставаться `MKT-*`.

---

# 14. UI PRESENTATION

В соответствующих реестрах и detail views показывать human-readable `referenceNumber` как основной бизнес-номер.

Internal UUID не должен занимать место пользовательского номера без необходимости.

Проверить минимум:

```text
Orders table/detail
Requests table/detail where implemented
Bookings table/detail
Payments table/detail
```

Не делать unrelated redesign.

---

# 15. SEARCH / LOOKUP

Где существует поиск по номеру документа, он должен поддерживать новый `referenceNumber`.

Примеры:

```text
MKT-ORD-000125
SF001-ORD-000125
SF003-BKG-000042
SAAS-SF001-PAY-000008
```

Не ослаблять tenant isolation из-за глобального поиска.

Platform operational search не должен начать раскрывать Storefront commerce records только потому, что известен reference number.

---

# 16. WORKSPACE ISOLATION MUST REMAIN INTACT

Новая нумерация не изменяет уже установленный scope:

```text
Platform Orders
→ Marketplace only

Platform Requests
→ Marketplace only

Platform Bookings
→ Marketplace only
```

Storefront data остаются для соответствующего Partner Workspace.

Проверить:

```text
Platform user + SF003-BKG-000042
→ Storefront operational record not exposed

SF003 Partner
→ own SF003 record available where capability exists

SF002 Partner
→ SF003 record denied/not exposed
```

---

# 17. DO NOT LEAK TENANT INFORMATION

Оценить, допустимо ли показывать `SF003` в конкретном public/customer-facing context.

Внутри Partner/Admin operational UI это допустимо.

Если reference number попадает во внешний customer-facing документ/API, убедиться, что код не раскрывает чувствительную информацию. Сам последовательный код Storefront не должен содержать PII или company secrets.

Не использовать:

```text
email
phone
tax ID
director name
```

в reference namespace.

---

# 18. DEMO/SEED READINESS

Обновить seed/factory logic так, чтобы representative test data после rebuild/seed снова создавались с корректными namespaces.

Проверить repeatability:

```text
seed
→ validate

re-seed / rebuild according to supported project workflow
→ validate again
```

Не допускать drift вида:

```text
SF001 today
SF004 after reseed
```

для того же canonical Storefront fixture.

---

# 19. REQUIRED DATA EVIDENCE

В отчёте показать минимум по 3 примера каждого реально реализованного типа:

```text
Marketplace Orders
Storefront Orders from at least 2 different Storefronts

Marketplace Bookings
Storefront Bookings from at least 2 different Storefronts

Marketplace Payments
Storefront commerce Payments from at least 2 Storefronts
```

Если SaaS Invoice/Payment domain уже существует:

```text
Storefront SaaS Invoice
Storefront SaaS Payment
```

Если не существует:

```text
NOT IMPLEMENTED
```

Не фабриковать evidence.

---

# 20. REQUIRED STOREFRONT MATRIX

Предоставить таблицу:

| Storefront | Stable code | Orders sample | Bookings sample | Payments sample |
|---|---|---|---|---|
| Partner A | SF001 | SF001-ORD-... | SF001-BKG-... | SF001-PAY-... |
| Partner B | SF002 | SF002-ORD-... | SF002-BKG-... | SF002-PAY-... |

Использовать реальные runtime records.

---

# 21. NEGATIVE EVIDENCE

Обязательно доказать:

```text
no duplicate references
no cross-tenant namespace mismatch
no Marketplace record with SF prefix
no Storefront commerce record with MKT prefix
no Storefront A record with Storefront B code
```

И:

```text
Platform scope cannot retrieve Storefront commerce by referenceNumber
```

---

# 22. CONCURRENCY TEST

Добавить targeted automated test параллельного создания нескольких объектов одного типа в одном Storefront.

Expected:

```text
all referenceNumbers unique
sequence allocator safe
no race duplicates
```

Также проверить параллельное создание в двух разных Storefront namespaces.

---

# 23. AUTOMATED TESTS

Минимум:

```text
Marketplace Order receives MKT-ORD-*
Marketplace Booking receives MKT-BKG-*
Marketplace Payment receives MKT-PAY-*

Storefront A Order receives SFxxx-ORD-*
Storefront A Booking receives SFxxx-BKG-*
Storefront A Payment receives SFxxx-PAY-*

Storefront B uses different Storefront code

referenceNumber immutable
referenceNumber unique
concurrent allocation safe

existing data migration preserves rows
seed/factory creates correct references
tenant isolation remains intact
Platform cannot access Storefront operational record by reference number
```

Requests/SaaS documents — только если capability реально существует.

---

# 24. DATABASE / INDEX REVIEW

Показать:

```text
schema changes
migration
constraints
indexes
allocator/counter mechanism
```

Не делать destructive migration.

Если добавляется `referenceNumber`:

1. безопасно backfill existing data;
2. validate uniqueness/non-null;
3. только затем enforce required constraint, если архитектурно применимо.

---

# 25. API CONTRACT

Проверить DTO/serialization.

Где business object возвращается UI, `referenceNumber` должен быть доступен как отдельное поле.

Не переименовывать internal `id` в `referenceNumber`.

Expected conceptually:

```json
{
  "id": "<internal-uuid>",
  "referenceNumber": "SF003-BKG-000042"
}
```

---

# 26. CANONICAL DOCUMENTATION UPDATE — REQUIRED

Обновить canonical architecture/roadmap additively.

Canonical roadmap:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Зафиксировать:

```text
Internal ID ≠ Reference Number
```

```text
Marketplace:
MKT-{TYPE}-{SEQUENCE}
```

```text
Storefront commerce:
{STOREFRONT_CODE}-{TYPE}-{SEQUENCE}
```

```text
Storefront → TravelHub SaaS:
SAAS-{STOREFRONT_CODE}-{TYPE}-{SEQUENCE}
```

и:

```text
STOREFRONT_CODE is immutable and independent from company name.
```

Также сохранить правило:

```text
Storefront Commerce Volume
≠ Marketplace GMV
≠ TravelHub Revenue
```

Не переписывать историю предыдущих этапов.

---

# 27. OUT OF SCOPE — HARD STOP

Не выполнять в этой задаче:

```text
new SaaS billing engine
MRR/ARR redesign
FX
Treasury
Partner Settlement
Finance Center
Booking KPI semantics redesign
Currency Presentation Contract
public marketplace redesign
Step 3.12
unrelated UI redesign/refactoring
```

---

# 28. HARD ACCEPTANCE GATES

`VERDICT A` разрешён только если:

```text
A. Internal UUID/PK сохранён как authoritative identity
B. referenceNumber введён отдельно
C. Marketplace namespace = MKT-*
D. каждый Storefront имеет immutable unique code
E. Storefront commerce namespace tenant-specific
F. SaaS namespace отделён, если соответствующий domain существует
G. existing Storefront/Marketplace data не удалены
H. migration/backfill deterministic
I. 0 required NULL reference numbers
J. 0 duplicate reference numbers
K. 0 cross-tenant namespace mismatches
L. new creation flows генерируют корректные references
M. seeds/factories обновлены
N. repeatability доказана
O. concurrency safety доказана
P. UI/API показывает referenceNumber там, где это business identifier
Q. search не нарушает tenant isolation
R. Platform operational scope по-прежнему исключает Storefront commerce
S. ID/reference negative evidence предоставлен
T. tests/typecheck/build relevant suites PASS
U. canonical roadmap/documentation обновлены additively
V. реальные commit SHA указаны
W. следующий этап не начат автоматически
```

Если любой обязательный gate не доказан:

```text
VERDICT B
```

---

# 29. REQUIRED FINAL REPORT FORMAT

```text
# MARKETPLACE / STOREFRONT TENANT-SCOPED REFERENCE NUMBER CONTRACT

Starting SHA:
Implementation SHA:
Final HEAD:
origin/master:
HEAD == origin:

## 1. Repository Audit
Existing IDs:
Existing business numbers:
Affected models:

## 2. Final Reference Contract
Marketplace:
Storefront:
SaaS:

## 3. Storefront Code Contract
Generation:
Uniqueness:
Immutability:
Determinism:

## 4. Database Migration
Rows before:
Rows after:
Deleted:
Reassigned:
NULL references:
Duplicates:

## 5. Marketplace Evidence
Orders:
Bookings:
Payments:
Requests if applicable:

## 6. Storefront Matrix
Partner/code/examples:

## 7. SaaS Evidence
Implemented / NOT IMPLEMENTED:

## 8. Chain Consistency
Orders → Bookings → Payments:

## 9. UI/API
Tables:
Details:
DTO:

## 10. Search
Marketplace:
Storefront:
Tenant isolation:

## 11. Concurrency
Mechanism:
Test:
Result:

## 12. Security / Tenant Isolation
Platform → Storefront:
Storefront A → B:
Negative evidence:

## 13. Seed / Factory Repeatability
...

## 14. Tests
Frontend:
Backend:
E2E:
Build:

## 15. Documentation / Roadmap
Files:
Rules added:
History preserved:

## 16. Residual Gaps
...

## VERDICT
VERDICT A / VERDICT B
```

---

# 30. GIT / COMPLETION

После implementation:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
```

Указать реальные:

```text
Starting SHA
Implementation SHA
Final HEAD
origin/master
HEAD == origin
```

Не начинать следующий этап автоматически.

**STOP после отчёта.**
