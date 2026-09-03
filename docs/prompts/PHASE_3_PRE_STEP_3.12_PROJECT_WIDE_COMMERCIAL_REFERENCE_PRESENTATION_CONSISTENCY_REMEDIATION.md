# PHASE 3 — PRE-STEP 3.12 — PROJECT-WIDE COMMERCIAL REFERENCE PRESENTATION CONSISTENCY — AUDIT + REMEDIATION

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose-документация должны быть преимущественно **на русском языке**.

Обязательно на русском:

- Audit Report;
- Remediation Report;
- Runtime Evidence;
- findings;
- root cause analysis;
- architecture decisions;
- security findings;
- reconciliation explanations;
- conclusions;
- recommendations;
- verdict explanations.

Английский разрешён только для технических identifiers: file paths, class/method/DTO/model/table names, API endpoints, HTTP methods/status codes, Git/CLI commands, commit messages, enums, permission identifiers, code snippets и standardized `VERDICT` strings.

Если итоговый отчёт преимущественно на английском языке — задача незавершена.

Не включать plaintext passwords, tokens, secrets или credentials.

---

# 1. PURPOSE

Устранить project-wide рассогласование canonical commercial reference numbers между:

```text
DB
API
DTO/read models
registries
detail views
CRM 360
Analytics drill-down
Search
CSV
XLSX
```

Известное runtime-наблюдение:

```text
Orders Center:
MKT-ORD-*                              ✅

CRM → Клиенты → Customer 360 → Заказы:
ORD-*                                  ❌

Booking Center:
BKG-*                                  ❌

CRM → Клиенты → Customer 360 → Бронирования:
BKG-*                                  ❌
```

При этом предыдущая remediation заявила:

```text
Booking canonical MKT-BKG-* = 405/405
Marketplace legacy BKG-* = 0

Payment canonical MKT-PAY-*-N = 484/484
Marketplace legacy PAY-* = 0
```

Это создаёт прямое противоречие между заявленным DB state и runtime presentation.

Нельзя предполагать заранее, что проблема снова в БД.

Сначала выполнить точную end-to-end трассировку.

---

# 2. REVIEW BASELINE

Предыдущая основная реализация:

```text
Implementation SHA: f5468d6
```

После неё выполнялась Booking & Payment Reference Remediation.

В начале задачи самостоятельно получить:

```text
git rev-parse HEAD
git rev-parse origin/master
git status
git log --oneline -n ...
```

Зафиксировать фактический remediation SHA.

Не использовать старые SHA как текущие без Git verification.

---

# 3. CANONICAL REFERENCE CONTRACT

Marketplace commercial chain:

```text
MKT-REQ-00000001
MKT-ORD-00000001
MKT-BKG-00000001
MKT-PAY-00000001-1
```

Один commercial root:

```text
commerceSequence = 00000001
```

V1:

```text
1 Order = 1 Booking
1 Order = 1..N logical Payments
```

Одна и та же сущность обязана иметь один и тот же human-readable canonical reference во всех business views.

---

# 4. MASTER-DATA IDENTIFIERS — HARD NON-REGRESSION

Не менять:

```text
Partner  → PRN-*
Customer → CRM-*
```

Запрещено:

```text
MKT-PRN-*
MKT-CRM-*
```

в рамках этой задачи.

`CRM-*` и `PRN-*` — master/entity identity.

`MKT-*` — Marketplace transaction identity.

---

# 5. PHASE A — DATABASE TRUTH FIRST

До любого production code change выполнить DB audit.

Для Orders определить:

```text
total Marketplace Orders
referenceNumber LIKE 'ORD-%'
referenceNumber LIKE 'MKT-ORD-%'
other/null formats
```

Для Bookings:

```text
total Marketplace Bookings
referenceNumber LIKE 'BKG-%'
referenceNumber LIKE 'MKT-BKG-%'
other/null formats
```

Для Payments:

```text
total Marketplace Payments
referenceNumber LIKE 'PAY-%'
referenceNumber LIKE 'MKT-PAY-%'
other/null formats
```

Для Requests:

```text
total Marketplace Requests
referenceNumber LIKE 'MKT-REQ-%'
legacy/other/null formats
```

Важно: SQL/persistence field names взять из фактической schema, а не копировать предположения из prompt.

---

# 6. PREFIX CHECK MUST BE EXACT

Не использовать неоднозначный pattern, который может ошибочно включить canonical prefix в legacy count.

Например, если SQL dialect/pattern делает:

```text
LIKE '%BKG-%'
```

то `MKT-BKG-*` тоже попадёт в выборку.

Legacy check должен различать именно начало строки:

```text
BKG-...
```

от:

```text
MKT-BKG-...
```

То же для:

```text
ORD- vs MKT-ORD-
PAY- vs MKT-PAY-
```

В отчёте показать exact query/logic, которым получены counts.

---

# 7. DETERMINE WHETHER DB IS MIXED OR NORMALIZED

После DB audit явно классифицировать:

## Scenario A — mixed DB

```text
Order.referenceNumber:
ORD-* + MKT-ORD-*

или

Booking.referenceNumber:
BKG-* + MKT-BKG-*
```

Тогда определить root cause incomplete migration/backfill и исправить authoritative persisted data.

## Scenario B — DB normalized

Например:

```text
Orders:
legacy ORD-* = 0

Bookings:
legacy BKG-* = 0
```

но runtime показывает `ORD-*` / `BKG-*`.

Тогда НЕ делать ещё одну бессмысленную migration.

Искать divergence в:

```text
API
DTO
read model
projection
legacy number field
formatter
frontend
CRM query
```

---

# 8. TRACE ONE EXACT ORDER END-TO-END

Выбрать конкретный Order, который:

```text
Orders Center → MKT-ORD-xxxxxxxx
CRM Customer 360 → ORD-xxxxxxxx
```

Это должен быть **один и тот же Order UUID**, не два похожих номера.

Создать evidence trace:

```text
Order UUID
commerceSequence
DB referenceNumber
DB other legacy/reference fields

Orders Center API response
CRM Customer 360 API response

Orders Center DTO/read model
Customer 360 DTO/read model

Orders Center frontend source field
Customer 360 frontend source field

Orders Center rendered value
Customer 360 rendered value
```

Цель — установить точное место, где:

```text
MKT-ORD-* → ORD-*
```

или где UI начинает читать другое поле.

---

# 9. TRACE ONE EXACT BOOKING END-TO-END

Выбрать конкретную Booking, которая runtime отображается как:

```text
BKG-xxxxxxxx
```

Получить:

```text
Booking UUID
Order UUID
commerceSequence
DB Booking.referenceNumber
DB Order.referenceNumber
DB legacy/alternate Booking number fields
```

Затем:

```text
Booking Center API response
CRM Customer 360 API response

Booking Center DTO/read model
Customer 360 DTO/read model

Booking Center frontend source field
Customer 360 frontend source field

Booking Center rendered value
Customer 360 rendered value
```

Если DB содержит:

```text
MKT-BKG-xxxxxxxx
```

а API/UI возвращает:

```text
BKG-xxxxxxxx
```

показать точную строку/mapper/formatter, вызывающую divergence.

---

# 10. TRACE ONE PAYMENT

Даже если Payment визуально кажется исправленным, выполнить такую же трассировку:

```text
Payment UUID
Order UUID
Booking UUID where applicable
commerceSequence

DB Payment reference
API Payment reference
Payments registry
Payment detail
related Order
related Booking
Analytics → Successful Payments
CSV
XLSX
```

Проверить:

```text
MKT-PAY-xxxxxxxx-n
MKT-ORD-xxxxxxxx
MKT-BKG-xxxxxxxx
```

---

# 11. PROJECT-WIDE REFERENCE SOURCE INVENTORY

Выполнить repository-wide search по всем способам формирования/отображения references.

Искать минимум:

```text
ORD-
BKG-
PAY-
MKT-ORD
MKT-BKG
MKT-PAY
referenceNumber
orderNumber
bookingNumber
paymentNumber
commerceSequence
slice(...)
substring(...)
replace(...)
startsWith(...)
split(...)
```

Также искать helper/formatter/serializer/read-model functions.

Сформировать inventory:

| Surface | Entity | Source field | Formatter | API | Canonical? |
|---|---|---|---|---|---|
| Orders Center | Order | ... | ... | ... | YES/NO |
| Customer 360 Orders | Order | ... | ... | ... | YES/NO |
| Booking Center | Booking | ... | ... | ... | YES/NO |
| Customer 360 Bookings | Booking | ... | ... | ... | YES/NO |
| Payments | Payment | ... | ... | ... | YES/NO |
| Analytics drill-down | Payment | ... | ... | ... | YES/NO |

Не ограничиваться только известными четырьмя экранами.

---

# 12. AUDIT ALL BUSINESS SURFACES

Проверить минимум:

```text
Request Center
Orders Center
Order detail
Booking Center
Booking detail
Payments registry
Payment detail

CRM Customers registry
CRM Customer 360
  → Orders
  → Bookings
  → Payments, если есть

CRM Partners / Partner 360
  → Orders
  → Bookings
  → Payments, если есть

Analytics
  → Partner Performance drill-down
  → Successful Payments
  → другие Order/Booking/Payment detail tables

Command Center drill-down, если применимо

Search
CSV
XLSX
```

Если surface отсутствует — отметить `N/A`, не создавать его только ради review.

---

# 13. AUTHORITATIVE PRESENTATION RULE

Canonical reference должен приходить из authoritative entity/read contract.

Правильно:

```text
Order.referenceNumber
→ MKT-ORD-xxxxxxxx
```

Неправильно:

```text
frontend receives UUID/legacy number
→ reconstructs MKT-ORD manually
```

Frontend не должен быть владельцем transaction numbering semantics.

---

# 14. NO COSMETIC PREFIX PATCH

Запрещено закрывать задачу такими решениями:

```ts
`MKT-${order.referenceNumber}`
`MKT-${booking.referenceNumber}`
reference.replace('ORD-', 'MKT-ORD-')
reference.replace('BKG-', 'MKT-BKG-')
```

если source contract остаётся legacy.

Допустимый display formatter может заниматься только presentation уже canonical value, но не изобретать business identifier.

---

# 15. DUPLICATE LEGACY FIELDS

Если обнаружены одновременно:

```text
referenceNumber
orderNumber
bookingNumber
legacyReference
displayNumber
```

определить:

- какой field canonical;
- какой legacy;
- кто его ещё читает;
- можно ли безопасно перестать использовать legacy;
- нужен ли deprecation path.

Не удалять field вслепую, если его используют integrations/migrations.

Но business UI/read models должны перейти на canonical source.

---

# 16. CRM CUSTOMER 360 — ORDERS

Hard acceptance:

Один и тот же Order:

```text
Orders Center:
MKT-ORD-00000125

Customer 360:
MKT-ORD-00000125
```

Не:

```text
MKT-ORD-00000125
vs
ORD-00000125
```

Проверить link/href identity отдельно от label.

Human reference не заменяет UUID/FK для routing/authorization, если route contract использует UUID.

---

# 17. CRM CUSTOMER 360 — BOOKINGS

Hard acceptance:

```text
Booking Center:
MKT-BKG-00000125

Customer 360:
MKT-BKG-00000125
```

Обе поверхности должны показывать canonical Booking reference.

---

# 18. PARTNER 360 / OTHER CRM VIEWS

Если Partner 360 или другие CRM detail surfaces отображают Orders/Bookings/Payments, применить тот же invariant.

Не исправлять Customer 360 и оставлять Partner 360 legacy.

---

# 19. RELATED ENTITY COLUMNS

Проверить business-facing columns:

```text
Booking → Order
Payment → Order
Payment → Booking
Request → Order after conversion
```

Expected:

```text
MKT-ORD-*
MKT-BKG-*
MKT-REQ-*
```

Не показывать truncated/full UUID вместо human reference там, где колонка обозначает бизнес-номер.

---

# 20. SEARCH CONTRACT

Search должен работать по canonical references.

Проверить:

```text
MKT-REQ-*
MKT-ORD-*
MKT-BKG-*
MKT-PAY-*-n
```

Если legacy search поддерживается для backward compatibility, он не должен заставлять UI снова показывать legacy reference.

Документировать compatibility behavior.

---

# 21. CSV / XLSX

Проверить все уже реализованные export paths для:

```text
Orders
Bookings
Payments
Requests
```

и CRM/Analytics export, если они экспортируют эти entities.

Hard invariant:

```text
UI canonical reference
= CSV canonical reference
= XLSX canonical reference
```

Если export содержит technical UUID, он должен быть отдельным field, не подменять business reference.

---

# 22. API CONTRACT

Проверить relevant endpoints.

Один и тот же Order/Booking/Payment не должен иметь разные human references в разных endpoints.

Например:

```text
GET /orders
→ MKT-ORD-00000125

Customer 360 endpoint
→ ORD-00000125
```

недопустимо.

Нормализовать read contracts на backend, если divergence рождается там.

---

# 23. DB MIGRATION ONLY IF PROVEN NECESSARY

Если Phase A доказывает:

```text
legacy persisted records > 0
```

тогда выполнить migration/backfill.

Если DB уже canonical:

```text
legacy = 0
```

не создавать redundant migration.

Исправлять actual read/presentation source.

---

# 24. HISTORICAL DATA SAFETY

Если нужна migration:

- не менять UUID/FK;
- не менять commercial dates;
- не менять `commerceSequence`;
- не переаллочировать roots;
- не создавать collisions;
- не менять Request/Order/Booking/Payment relationships;
- не менять `CRM-*`;
- не менять `PRN-*`.

---

# 25. UNIQUENESS / COLLISION

После remediation:

```text
duplicate MKT-ORD-* = 0
duplicate MKT-BKG-* = 0
duplicate MKT-PAY-* = 0
```

Проверить unique constraints/DB truth.

---

# 26. FULL REFERENCE MATRIX

Создать final matrix:

| Entity | DB | Primary API | Center UI | CRM 360 | Analytics | CSV | XLSX | Search |
|---|---|---|---|---|---|---|---|---|
| Request | MKT-REQ-* | ... | ... | ... | ... | ... | ... | ... |
| Order | MKT-ORD-* | ... | ... | ... | ... | ... | ... | ... |
| Booking | MKT-BKG-* | ... | ... | ... | ... | ... | ... | ... |
| Payment | MKT-PAY-*-n | ... | ... | ... | ... | ... | ... | ... |

Каждая applicable cell должна быть evidence-backed.

---

# 27. SAME-ENTITY CROSS-VIEW RECONCILIATION

Минимум 5 конкретных entities каждого применимого типа:

```text
5 Orders
5 Bookings
5 Payments
```

Сравнить один UUID между всеми доступными views.

Для каждого:

```text
UUID
commerceSequence
DB reference
API reference
Center reference
CRM reference
Analytics reference
CSV reference
XLSX reference
```

Нельзя сравнивать просто похожие номера.

---

# 28. SECURITY

Reference presentation не меняет authorization.

Canonical `MKT-*` — human traceability, не access token.

Проверить, что remediation:

- не переводит secure lookup на insecure reference-only access;
- не ломает tenant isolation;
- не раскрывает чужие entities;
- сохраняет server-side permissions.

---

# 29. I18N

Reference numbers не переводятся.

Но labels/search placeholders вокруг них должны быть корректны RU/AZ/EN.

Проверить, что старые placeholders вида:

```text
ORD-...
BKG-...
```

не остались там, где пользователь должен искать canonical:

```text
MKT-ORD-...
MKT-BKG-...
```

No raw i18n keys.

---

# 30. AUTOMATED TESTS

Добавить/обновить tests для:

```text
same Order reference across Orders API and CRM 360 API
same Booking reference across Booking API and CRM 360 API
same Payment reference across Payments and Analytics read paths
canonical related Order/Booking references
CSV/XLSX canonical values
search by canonical references
CRM-* unchanged
PRN-* unchanged
tenant isolation
```

Если архитектура позволяет, добавить regression test, который падает при возврате:

```text
ORD-*
BKG-*
PAY-*
```

из canonical Marketplace business read models.

---

# 31. TEST REPORTING — TRUTHFUL

Фактический результат suite сообщать точно.

Например:

```text
282/283
```

означает:

```text
FAIL — 282 passed / 283 total
1 failed
```

если именно таков test runner result.

Не превращать failure в PASS из-за classification `pre-existing`.

Отдельно указать skipped/failed/passed, чтобы не повторять противоречие вида:

```text
1369/1400
but only 6 failures
```

без объяснения skipped tests.

---

# 32. BROWSER RUNTIME — MANDATORY

После fix проверить реальный browser.

Минимум:

```text
Orders Center
CRM → Customer 360 → Orders

Booking Center
CRM → Customer 360 → Bookings

Payments
Analytics → Successful Payments
```

Если Partner 360 содержит эти entities — проверить и его.

Для одного Order и Booking показать cross-view evidence.

---

# 33. DIRECT URL / CLIENT NAVIGATION / REFRESH

Для relevant detail/360 pages проверить:

```text
direct URL
client click
browser refresh
```

Reference должен оставаться canonical во всех трёх случаях.

---

# 34. REQUIRED REPORT

Создать:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_PROJECT_WIDE_COMMERCIAL_REFERENCE_PRESENTATION_CONSISTENCY_REMEDIATION_REPORT.md
```

Обязательные разделы:

1. Starting SHA
2. Git state
3. Known runtime findings
4. DB truth — exact prefix counts
5. Exact SQL/query logic
6. Scenario classification: mixed DB vs normalized DB
7. One Order end-to-end trace
8. One Booking end-to-end trace
9. One Payment end-to-end trace
10. Repository-wide reference source inventory
11. Root cause(s)
12. Authoritative reference source decision
13. DB migration, если реально нужна
14. Backend/API remediation
15. CRM read-model remediation
16. Frontend remediation
17. Related entity remediation
18. Search
19. CSV/XLSX
20. Analytics/drill-down
21. Full reference matrix
22. Same-entity cross-view reconciliation
23. CRM/Partner code non-regression
24. Security
25. RU/AZ/EN
26. Automated tests
27. Browser runtime evidence
28. Remaining gaps
29. Implementation SHA
30. Final HEAD
31. origin/master
32. `HEAD == origin/master`
33. Verdict

---

# 35. ACCEPTANCE CRITERIA

`VERDICT A` только если:

```text
[ ] exact DB prefix counts proven
[ ] known Orders Center vs Customer 360 mismatch resolved
[ ] known Booking Center legacy BKG display resolved
[ ] known Customer 360 Booking legacy BKG display resolved
[ ] Payments audited across all relevant views
[ ] one authoritative reference source established
[ ] no frontend cosmetic prefix reconstruction
[ ] Order = MKT-ORD-* everywhere
[ ] Booking = MKT-BKG-* everywhere
[ ] Payment = MKT-PAY-*-n everywhere
[ ] Request = MKT-REQ-* everywhere applicable
[ ] same UUID shows same reference across views
[ ] related entity columns canonical
[ ] Search canonical
[ ] CSV canonical
[ ] XLSX canonical
[ ] Analytics/drill-down canonical
[ ] duplicate canonical refs = 0
[ ] CRM-* unchanged
[ ] PRN-* unchanged
[ ] tenant/RBAC isolation preserved
[ ] RU/AZ/EN checked
[ ] automated tests truthfully reported
[ ] browser runtime evidence complete
[ ] report predominantly Russian
[ ] real Implementation SHA
[ ] HEAD == origin/master
```

---

# 36. HARD VERDICT B CONDITIONS

`VERDICT B` если:

```text
DB remains mixed without justified exception
same UUID has different human reference in different views
Orders Center is MKT-ORD but Customer 360 remains ORD
Booking Center or CRM remains BKG
Payment surface remains PAY
canonical prefix is fabricated only by frontend
CSV/XLSX differs from UI/API
Analytics uses legacy reference
CRM-* or PRN-* changed
known P1 reference inconsistency remains
runtime evidence absent
```

---

# 37. ROADMAP

Additively обновить:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Не переписывать историю.

Зафиксировать эту remediation как closure requirement перед Full Strict Review:

```text
Shared Commerce Sequence
+ Request Center
+ SLA/TTL
+ Historical Request Data
```

---

# 38. STOP CONDITION

После implementation + runtime verification + report + commit:

```text
STOP.
```

Не запускать автоматически:

```text
Full Strict Review
Product Freshness
Step 3.12
```

Следующий этап после успешного `VERDICT A`:

```text
PHASE 3 — PRE-STEP 3.12
SHARED COMMERCE SEQUENCE + REQUEST CENTER
FULL STRICT REVIEW
```
