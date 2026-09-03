# PHASE 3 — PRE-STEP 3.12 — PLATFORM CRM CUSTOMER SCOPE + COMMERCIAL REFERENCE CONSISTENCY — REMEDIATION ROUND 2

> **SUPERSEDES:** `PHASE_3_PRE_STEP_3.12_PROJECT_WIDE_COMMERCIAL_REFERENCE_PRESENTATION_CONSISTENCY_REMEDIATION_ROUND_2.md`
>
> Старый Round 2 **НЕ ЗАПУСКАТЬ**. Этот документ полностью заменяет его.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose-документация должны быть преимущественно **на русском языке**.

Обязательно на русском:

- Implementation / Remediation Report;
- Audit / Runtime Evidence;
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

Не включать plaintext passwords, tokens, secrets или credentials. Использовать redaction/placeholders.

---

# 1. PURPOSE

Выполнить системный audit + remediation двух связанных классов runtime-дефектов Platform CRM:

```text
A. COMMERCIAL REFERENCE CONSISTENCY
B. PLATFORM CRM CUSTOMER BUSINESS SCOPE
```

Известные browser/runtime findings уже противоречат предыдущему `VERDICT A`.

Следовательно, предыдущий verdict по project-wide reference presentation consistency считается **reopened / invalidated by runtime evidence**.

Нельзя переходить к Full Strict Review, пока этот Round 2 не закрыт.

---

# 2. KNOWN RUNTIME FINDINGS — AUTHORITATIVE INPUT

Пользователь вручную обнаружил следующие фактические runtime-дефекты.

## Finding A1 — Customer 360 → Orders

```text
Platform
→ CRM
→ Клиенты
→ Customer 360
→ Заказы

actual:
ORD-*

expected:
MKT-ORD-*
```

---

## Finding A2 — Customer 360 → Bookings

```text
Platform
→ CRM
→ Клиенты
→ Customer 360
→ Бронирования

actual:
BKG-*

expected:
MKT-BKG-*
```

---

## Finding A3 — Order Detail → Related Bookings

```text
Platform
→ Заказы
→ открыть Order
→ Связанные бронирования

actual:
BKG-*

expected:
MKT-BKG-*
```

---

## Finding B1 — Customer 360 mixes Marketplace and Storefront commerce

В одном и том же Customer 360 присутствуют transaction records разных business contexts:

```text
MKT-...
SF001-...
```

Один и тот же master Customer может иметь как Marketplace activity, так и Storefront activity.

Это допустимо на уровне общей customer identity / общей БД.

Но Storefront end-customer commerce **не должен отображаться как Platform Marketplace commerce**.

---

## Finding B2 — CRM Activity uses legacy references

В:

```text
Platform
→ CRM
→ Активность
```

runtime отображает references вида:

```text
RFD-*
BKG-*
ORD-*
PAY-*
```

Для уже canonical Marketplace entities:

```text
ORD-* → legacy ❌
BKG-* → legacy ❌
PAY-* → legacy ❌
```

`RFD-*` требует отдельного semantic audit.

Не переименовывать Refund вслепую.

---

# 3. RUNTIME EVIDENCE OVERRIDES PREVIOUS CLAIMS

Предыдущая remediation заявляла:

```text
DB legacy ORD-* = 0
DB legacy BKG-* = 0
DB legacy PAY-* = 0

CRM 360 Order   → MKT-ORD-* ✅
CRM 360 Booking → MKT-BKG-* ✅
```

Но browser runtime показывает обратное.

Правило этой задачи:

```text
actual browser/runtime observation
>
source-code claim
>
test claim
>
report claim
```

Если runtime всё ещё показывает legacy references или Storefront commerce в Platform CRM — `VERDICT A` запрещён.

---

# 4. CANONICAL BUSINESS-CONTEXT CONTRACT

TravelHub имеет разные business contexts.

```text
PLATFORM WORKSPACE
├ Marketplace operations
├ Marketplace customers
├ Marketplace Orders
├ Marketplace Bookings
├ Marketplace Payments
├ Marketplace Requests
└ Platform ↔ Storefront SaaS relationship

PARTNER / STOREFRONT WORKSPACE
├ Storefront customers
├ Storefront Orders
├ Storefront Bookings
├ Storefront Payments
└ Storefront customer commerce
```

Hard rule:

```text
Storefront customer commerce
≠ Platform Marketplace commerce
```

Storefront end-customer Orders/Bookings/Payments не должны попадать в Platform CRM Marketplace business view только потому, что они физически существуют в общей БД.

---

# 5. MASTER CUSTOMER IDENTITY VS BUSINESS CONTEXT

Не создавать автоматически отдельного Customer только потому, что один человек использовал несколько channels.

Допустимая модель:

```text
MASTER CUSTOMER
Customer UUID = X
        │
        ├── Marketplace activity
        │     MKT-*
        │
        └── Storefront activity
              SF001-* / SFxxx-*
```

Это может быть одна master identity.

Но presentation/business scope должен различаться:

```text
Platform Customer 360
→ Marketplace activity only

Partner Storefront A Customer 360
→ Storefront A activity only

Partner Storefront B Customer 360
→ Storefront B activity only
```

Не путать:

```text
identity scope
```

и:

```text
business transaction scope
```

---

# 6. PLATFORM CRM CUSTOMER REGISTRY ELIGIBILITY — AUDIT FIRST

До изменения кода определить фактическое правило, по которому Customer попадает в:

```text
Platform → CRM → Клиенты
```

Не предполагать автоматически, что достаточно поля `acquisitionSource`.

Audit должен установить:

- какие tables/entities участвуют;
- существует ли Customer-level source/channel;
- существуют ли transaction-level source/channel;
- может ли один Customer иметь Marketplace + Storefront commerce;
- как сейчас считается Platform CRM customer population;
- какие Storefront-only customers сейчас ошибочно входят;
- какие mixed customers входят корректно благодаря Marketplace activity.

Целевой смысл:

```text
Platform CRM Customer
= Customer, имеющий допустимое Marketplace relationship/activity
```

Storefront-only end-customer не должен становиться Platform Marketplace customer только из-за Storefront commerce.

Но mixed Customer:

```text
MKT activity + SF activity
```

может присутствовать в Platform CRM благодаря Marketplace relationship.

Внутри его Platform Customer 360 показывается только Marketplace business activity.

---

# 7. DO NOT USE PREFIX AS AUTHORIZATION OR PRIMARY SCOPE

Запрещено реализовать scope так:

```ts
referenceNumber.startsWith("MKT-")
```

как основной security/business filter.

Prefix — presentation/traceability signal, не authoritative business relationship.

Scope должен основываться на реальных domain fields/relations, например фактическом channel/source/ownership contract, доказанном repository audit.

Не предполагать конкретное поле заранее.

---

# 8. SERVER-SIDE SCOPE — MANDATORY

Platform CRM filtering должен быть server-authoritative.

Недопустимо:

```text
backend returns Marketplace + Storefront
↓
frontend filter removes SF*
```

Это оставляет:

- data leakage в API;
- неверные totals;
- неверную pagination;
- неверный export;
- неверные KPI;
- потенциальное нарушение tenant/business isolation.

Правильно:

```text
Platform Workspace
        ↓
server-side business scope
        ↓
Marketplace-scoped CRM data
        ↓
frontend
```

---

# 9. CUSTOMER 360 — FULL SCOPE AUDIT

Проверить Customer 360 целиком, а не только Orders/Bookings tabs.

Минимум:

```text
Profile / summary
KPI / totals
Orders
Bookings
Payments
Requests
Refunds
Activity / timeline
financial aggregates
counts
last activity
exports, если есть
links/drill-down
```

Для каждой секции определить:

```text
Marketplace-only?
Storefront-only?
mixed?
not applicable?
```

Platform Customer 360 должен быть Marketplace-scoped для customer commerce.

---

# 10. CUSTOMER 360 — ORDERS

Для mixed Customer, у которого есть:

```text
MKT Order
SF001 Order
```

Platform Customer 360 должен вернуть:

```text
MKT Order     ✅
SF001 Order   ❌
```

И canonical Marketplace reference:

```text
MKT-ORD-xxxxxxxx
```

Не:

```text
ORD-xxxxxxxx
```

---

# 11. CUSTOMER 360 — BOOKINGS

Для mixed Customer:

```text
Marketplace Booking   → visible
Storefront Booking    → hidden from Platform Marketplace CRM
```

Marketplace reference:

```text
MKT-BKG-xxxxxxxx
```

Не:

```text
BKG-xxxxxxxx
```

---

# 12. CUSTOMER 360 — PAYMENTS

Проверить, что Platform Customer 360 не смешивает:

```text
Marketplace customer payments
Storefront customer commerce payments
```

Marketplace payment reference:

```text
MKT-PAY-xxxxxxxx-n
```

Storefront customer payment не должен становиться Platform Marketplace payment.

Отдельно не смешивать с:

```text
Storefront subscription/direct SaaS payment → TravelHub
```

Это Platform SaaS economics, но не Marketplace Customer 360 customer commerce.

---

# 13. CUSTOMER 360 — REQUESTS

Если Requests присутствуют:

```text
Platform Customer 360
→ Marketplace Requests only
→ MKT-REQ-*
```

Storefront transaction workflow не должен автоматически смешиваться с Marketplace Request history.

---

# 14. CUSTOMER 360 — REFUNDS

Audit actual Refund model.

Определить:

- entity/table;
- current `code`;
- `referenceNumber`, если существует;
- relationship to Payment/Order/Booking;
- Marketplace vs Storefront attribution;
- current generation contract;
- whether `RFD-*` is legacy or currently canonical;
- whether shared commerce root applies;
- whether refund numbering contract уже существует в repository.

IMPORTANT:

```text
НЕ переименовывать RFD-* → MKT-RFD-*
```

без доказанного canonical Refund Reference Contract.

Если contract отсутствует — зафиксировать отдельный architecture gap.

Но Platform Customer 360 scope всё равно должен исключать Storefront customer-commerce refunds.

---

# 15. CRM → ACTIVITY — SEMANTIC AUDIT

Проверить фактическую страницу/section:

```text
Platform → CRM → Активность
```

Определить, что является activity event:

```text
Order created?
Booking created/updated?
Payment?
Refund?
Request?
Customer event?
```

Для каждого event type определить authoritative entity reference.

---

# 16. CRM ACTIVITY — CANONICAL REFERENCES

Для Marketplace entities:

```text
Order:
ORD-* ❌
MKT-ORD-* ✅

Booking:
BKG-* ❌
MKT-BKG-* ✅

Payment:
PAY-* ❌
MKT-PAY-*-n ✅

Request:
MKT-REQ-* ✅
```

Refund:

```text
RFD-* → AUDIT REQUIRED
```

Не fabricate новый prefix.

---

# 17. CRM ACTIVITY — BUSINESS SCOPE

Platform CRM Activity также должна соблюдать Platform Marketplace scope.

Проверить, нет ли там:

```text
SF001-*
SFxxx-*
Storefront end-customer commerce
```

Если Activity является именно Platform Marketplace CRM Activity — Storefront end-customer commerce исключить server-side.

Если страница имеет другой документированный cross-business purpose — доказать это архитектурой/roadmap и не предполагать.

---

# 18. ORDER DETAIL → RELATED BOOKINGS

Известный runtime defect:

```text
Orders Center
→ Order detail
→ Связанные бронирования
→ BKG-*
```

Выполнить exact trace:

```text
Order UUID
Booking UUID
Booking.commerceSequence
Booking.referenceNumber
Booking.code
Order Detail API nested payload
DTO/read model
frontend field
rendered value
```

Expected:

```text
MKT-BKG-xxxxxxxx
```

---

# 19. LEGACY `.code` FALLBACK — HARDENED CONTRACT

Предыдущая remediation использовала конструкции вида:

```ts
booking.referenceNumber ?? booking.code
```

Для нормализованных Marketplace transaction business views это больше не считается достаточным final fix.

Если DB contract гарантирует canonical `referenceNumber`, то отсутствие `referenceNumber`:

```text
= API/DTO/read-model defect
```

а не повод молча показать legacy `.code`.

Для Marketplace business presentation:

```text
referenceNumber = authoritative
```

---

# 20. FALLBACK EXCEPTION

Fallback на `.code` может оставаться только там, где доказано:

- entity не относится к normalized Marketplace transaction population;
- compatibility действительно нужна;
- canonical reference legitimately отсутствует;
- surface не выдаёт legacy identifier за canonical Marketplace reference.

Все исключения перечислить в report.

---

# 21. REPOSITORY-WIDE SECOND-PASS INVENTORY

Выполнить полный search минимум по:

```text
ORD-
BKG-
PAY-
RFD-
SF001-
SF
MKT-ORD
MKT-BKG
MKT-PAY
MKT-REQ
referenceNumber
.code
order.code
booking.code
payment.code
refund.code
orderCode
bookingCode
paymentCode
refundCode
referenceNumber ??
?? code
|| code
acquisitionSource
salesChannel
source
channel
storefront
marketplace
CustomerDetail
Activity
timeline
relatedBookings
```

Не ограничиваться frontend.

Проверить:

```text
Prisma queries
service
query service
DTO
mapper
serializer
projection
read model
controller
frontend API types
components
export
search
analytics/drill-down
```

---

# 22. SAME CUSTOMER — CROSS-CONTEXT EVIDENCE

Найти минимум одного реального mixed Customer, у которого есть:

```text
MKT transaction(s)
+
SF001/SFxxx transaction(s)
```

Зафиксировать:

```text
Customer UUID
Marketplace Orders count
Storefront Orders count
Marketplace Bookings count
Storefront Bookings count
Marketplace Payments count
Storefront Payments count
```

Затем доказать:

```text
DB:
both contexts remain present

Platform Customer 360:
Marketplace only

Partner Storefront Workspace:
its own Storefront context remains available
```

Не удалять Storefront data ради прохождения Platform test.

---

# 23. STOREFRONT-ONLY CUSTOMER TEST

Найти Customer, у которого есть только Storefront end-customer activity и нет Marketplace relationship/activity.

Проверить, должен ли он присутствовать в:

```text
Platform → CRM → Клиенты
```

По целевой архитектуре:

```text
Storefront-only end-customer
→ Platform Marketplace CRM Customers ❌
```

Если repository model требует nuanced rule — описать и доказать.

---

# 24. MARKETPLACE-ONLY CUSTOMER TEST

Найти Marketplace-only Customer.

Проверить:

```text
registry presence
Customer 360
Orders
Bookings
Payments
Activity
totals
```

После remediation ничего не должно исчезнуть ошибочно.

---

# 25. MIXED CUSTOMER TEST

Mixed Customer:

```text
MKT + SF
```

Expected:

```text
Platform CRM registry:
visible because Marketplace relationship exists

Platform Customer 360:
only MKT-scoped customer commerce

Storefront commerce:
remains in DB
remains available only in correct Partner/Storefront context
```

---

# 26. TOTALS / KPI / COUNTS

Очень важно: scope применяется не только к rows.

Проверить:

```text
Orders total
Bookings total
Payments total
GMV/customer spend if shown
Refunds
Activity count
last transaction
other aggregates
```

Hard invariant:

```text
Platform Customer 360 aggregate
=
aggregate over Platform Marketplace-scoped population
```

Не:

```text
visible rows filtered
but totals calculated over Marketplace + Storefront
```

---

# 27. PAGINATION

Если Customer 360 nested tables или CRM Activity paginated:

```text
filter/scope
BEFORE
pagination
```

Не frontend post-filter.

---

# 28. EXPORT

Проверить существующие export paths:

```text
CRM Customers
Customer 360 data if exportable
Orders
Bookings
Payments
Activity if exportable
```

Platform export не должен включать Storefront end-customer commerce.

Canonical references в export:

```text
MKT-ORD-*
MKT-BKG-*
MKT-PAY-*-n
MKT-REQ-*
```

Refund — по доказанному current contract, без выдуманного rename.

---

# 29. SEARCH

Проверить Platform CRM search.

Canonical Marketplace references должны находиться:

```text
MKT-ORD-*
MKT-BKG-*
MKT-PAY-*-n
MKT-REQ-*
```

Если legacy search сохраняется для compatibility, result presentation всё равно canonical.

Storefront transaction search не должен протекать в Platform Marketplace CRM, если этот search scoped к Platform CRM.

---

# 30. ANALYTICS / DRILL-DOWN RECHECK

Проверить CRM-related Analytics/drill-down paths, которые открывают:

```text
Customer 360
Orders
Bookings
Payments
```

Они должны:

- передавать правильный Customer;
- сохранять Marketplace scope;
- показывать canonical references;
- не раскрывать Storefront end-customer commerce в Platform context.

---

# 31. PARTNER / STOREFRONT NON-REGRESSION

Storefront data **не удалять** и не превращать в Marketplace.

Проверить минимум один Storefront partner context:

```text
Partner/Storefront Workspace
→ own Customer
→ own Orders/Bookings/Payments
```

Данные должны остаться доступны соответствующему tenant.

Hard tenant rule:

```text
Storefront A → A only
Storefront B → B only
```

---

# 32. REFERENCE PRESENTATION MATRIX

Создать final matrix:

| Surface | Entity | Context | Expected reference | Actual after | PASS/FAIL |
|---|---|---|---|---|---|
| Customer 360 Orders | Order | Marketplace | MKT-ORD-* | ... | ... |
| Customer 360 Bookings | Booking | Marketplace | MKT-BKG-* | ... | ... |
| Order Detail Related Bookings | Booking | Marketplace | MKT-BKG-* | ... | ... |
| CRM Activity | Order | Marketplace | MKT-ORD-* | ... | ... |
| CRM Activity | Booking | Marketplace | MKT-BKG-* | ... | ... |
| CRM Activity | Payment | Marketplace | MKT-PAY-*-n | ... | ... |
| CRM Activity | Refund | Marketplace | evidence-based | ... | ... |

---

# 33. CUSTOMER SCOPE MATRIX

Создать:

| Surface | Marketplace-only customer | Mixed customer | Storefront-only customer | Storefront commerce visible? |
|---|---:|---:|---:|---:|
| Platform CRM registry | ... | ... | ... | ... |
| Platform Customer 360 | ... | ... | ... | NO |
| Customer 360 Orders | ... | ... | ... | NO |
| Customer 360 Bookings | ... | ... | ... | NO |
| Customer 360 Payments | ... | ... | ... | NO |
| Customer 360 Activity | ... | ... | ... | NO |
| Platform CRM Activity | ... | ... | ... | NO |

Каждая applicable cell — evidence-backed.

---

# 34. SAME-ENTITY REFERENCE TRACE

Для минимум:

```text
5 Marketplace Orders
5 Marketplace Bookings
5 Marketplace Payments
```

сравнить один и тот же UUID:

```text
DB
API
Center UI
Customer 360
CRM Activity
Order Detail related view
Search
CSV
XLSX
Analytics/drill-down
```

где applicable.

Никаких сравнений только по похожему suffix.

---

# 35. REFUND CONTRACT — DO NOT SILENTLY EXPAND SCOPE

Если audit доказывает, что Refund numbering contract отсутствует/не определён:

1. не придумывать `MKT-RFD-*`;
2. не блокировать исправление ORD/BKG/PAY;
3. документировать Refund reference как отдельный architecture gap;
4. сохранить фактическую authoritative relation;
5. предложить отдельный future Refund Reference Contract task.

Если же canonical Refund contract уже существует в repository/roadmap — применить его и привести evidence.

---

# 36. DATABASE TRUTH RECHECK

Повторно доказать exact counts:

```text
Orders:
legacy ORD-* = ?
canonical MKT-ORD-* = ?

Bookings:
legacy BKG-* = ?
canonical MKT-BKG-* = ?

Payments:
legacy PAY-* = ?
canonical MKT-PAY-* = ?
```

Pattern должен отличать начало строки.

Не использовать `%ORD-%`, который захватит `MKT-ORD-*`.

Если DB по-прежнему normalized — новая migration не нужна.

---

# 37. NO COSMETIC PREFIX PATCH

Запрещено:

```ts
`MKT-${code}`
code.replace("ORD-", "MKT-ORD-")
code.replace("BKG-", "MKT-BKG-")
```

как business fix.

Canonical identifier должен идти из authoritative persisted/read contract.

---

# 38. API CONTRACT

Для одного и того же entity UUID:

```text
primary endpoint
CRM endpoint
nested Order detail endpoint
Activity endpoint
Analytics endpoint
```

не должны возвращать разные human-readable Marketplace references.

Пример запрещён:

```text
/orders → MKT-ORD-00000125
/crm/customer/:id → ORD-00000125
```

---

# 39. DTO / READ MODEL CONTRACT

Marketplace business DTO/read model должен использовать canonical `referenceNumber`.

Если canonical field обязателен по persistence contract — не делать optional только ради legacy fallback.

Но перед type hardening проверить все legitimate populations.

---

# 40. SECURITY / ISOLATION

Проверить:

```text
workspace isolation
tenant isolation
role/permission checks
server-side scope
```

Customer UUID/reference/prefix не является authorization token.

Особое внимание:

```text
Platform user
→ не получает Storefront end-customer commerce через CRM API

Storefront Partner A
→ не получает Storefront Partner B data
```

---

# 41. AUTOMATED TESTS — REQUIRED

Добавить/обновить tests минимум:

### Reference regression

```text
Customer 360 Order uses canonical referenceNumber
Customer 360 Booking uses canonical referenceNumber
Order Detail related Booking uses canonical referenceNumber
CRM Activity Order uses canonical referenceNumber
CRM Activity Booking uses canonical referenceNumber
CRM Activity Payment uses canonical referenceNumber
```

### Scope regression

```text
Platform CRM excludes Storefront-only customer
Mixed customer remains eligible due Marketplace relationship
Mixed Customer 360 excludes Storefront Orders
Mixed Customer 360 excludes Storefront Bookings
Mixed Customer 360 excludes Storefront Payments
Mixed Customer 360 aggregates exclude Storefront commerce
Platform CRM Activity excludes Storefront customer-commerce events
```

### Isolation

```text
Storefront A cannot read B
Platform CRM API does not leak SF commerce
```

---

# 42. TEST REPORTING — TRUTHFUL

Фактический suite result писать точно.

Если:

```text
282/283
```

и один test failed:

```text
FAIL — 282 passed / 283 total
1 failed
```

`pre-existing` — classification, а не PASS.

Если есть skipped:

```text
passed = X
failed = Y
skipped = Z
total = X + Y + Z
```

Арифметика обязана сходиться.

---

# 43. BROWSER RUNTIME — MANDATORY

После remediation browser runtime должен проверить минимум:

```text
Platform CRM → Customers registry
Platform CRM → mixed Customer 360
Customer 360 → Orders
Customer 360 → Bookings
Customer 360 → Payments
Customer 360 → Activity/timeline
Platform CRM → Activity
Orders Center → Order detail → Related Bookings
Booking Center
Payments
```

Если Request/Refund surfaces применимы — проверить их.

---

# 44. KNOWN FINDINGS — BEFORE / AFTER

В report обязательна таблица:

| Finding | Before | After | Result |
|---|---|---|---|
| Customer 360 Orders | ORD-* | MKT-ORD-* | PASS/FAIL |
| Customer 360 Bookings | BKG-* | MKT-BKG-* | PASS/FAIL |
| Order Detail related Bookings | BKG-* | MKT-BKG-* | PASS/FAIL |
| Customer 360 Storefront commerce | SF001-* visible | not visible in Platform scope | PASS/FAIL |
| CRM Activity Orders | ORD-* | MKT-ORD-* | PASS/FAIL |
| CRM Activity Bookings | BKG-* | MKT-BKG-* | PASS/FAIL |
| CRM Activity Payments | PAY-* | MKT-PAY-*-n | PASS/FAIL |
| CRM Activity Refund | RFD-* | audited contract | PASS/FAIL/GAP |

Без фактического browser evidence по первым семи строкам `VERDICT A` запрещён.

Для Refund допустим `GAP`, если canonical contract действительно ещё не определён и это честно доказано; это не должно маскировать другие defects.

---

# 45. DIRECT URL / CLICK / REFRESH

Для:

```text
Customer 360
Order detail
Booking detail
```

проверить:

```text
direct URL
client navigation
browser refresh
```

Scope/reference не должны меняться от способа открытия.

---

# 46. RU / AZ / EN

Проверить relevant UI в:

```text
RU
AZ
EN
```

Reference numbers не переводятся.

No raw i18n keys.

---

# 47. REQUIRED REPORT

Создать:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_PLATFORM_CRM_CUSTOMER_SCOPE_REFERENCE_CONSISTENCY_REMEDIATION_ROUND_2_REPORT.md
```

Обязательные разделы:

1. Starting SHA
2. Git state
3. Previous verdict invalidation
4. Reproduced known runtime findings
5. DB truth recheck
6. Customer identity vs business-context findings
7. Platform CRM customer eligibility contract
8. Mixed Customer evidence
9. Storefront-only Customer evidence
10. Marketplace-only Customer evidence
11. Customer 360 full scope audit
12. Customer 360 Orders remediation
13. Customer 360 Bookings remediation
14. Customer 360 Payments remediation
15. Customer 360 Requests/Refunds remediation/audit
16. Customer 360 Activity remediation
17. Platform CRM Activity audit/remediation
18. Order Detail related Bookings remediation
19. Legacy `.code` fallback audit
20. Repository-wide second-pass inventory
21. API/DTO/read-model remediation
22. Totals/KPI reconciliation
23. Pagination
24. Search
25. CSV/XLSX
26. Analytics/drill-down
27. Partner/Storefront non-regression
28. Reference Presentation Matrix
29. Customer Scope Matrix
30. Same-entity trace matrix
31. Refund Reference Contract finding
32. Security/tenant isolation
33. Automated tests
34. Browser runtime evidence
35. RU/AZ/EN evidence
36. Known Findings Before/After table
37. Remaining gaps
38. Implementation SHA
39. Final HEAD
40. origin/master
41. `HEAD == origin/master`
42. Verdict

---

# 48. ACCEPTANCE CRITERIA

`VERDICT A` разрешён только если:

```text
[ ] known runtime defects reproduced before fix
[ ] DB truth rechecked
[ ] no unnecessary DB migration if DB normalized

[ ] Platform CRM customer eligibility contract proven
[ ] Storefront-only end-customers excluded from Platform Marketplace CRM
[ ] mixed Customer remains visible if Marketplace relationship exists
[ ] mixed Customer Platform 360 shows Marketplace commerce only

[ ] Customer 360 Orders exclude Storefront commerce
[ ] Customer 360 Bookings exclude Storefront commerce
[ ] Customer 360 Payments exclude Storefront commerce
[ ] Customer 360 Activity excludes Storefront customer commerce
[ ] Customer 360 totals/KPI use same Marketplace scope

[ ] Customer 360 Orders show MKT-ORD-*
[ ] Customer 360 Bookings show MKT-BKG-*
[ ] Order Detail related Bookings show MKT-BKG-*
[ ] CRM Activity Orders show MKT-ORD-*
[ ] CRM Activity Bookings show MKT-BKG-*
[ ] CRM Activity Payments show MKT-PAY-*-n

[ ] Refund RFD-* semantics audited without invented rename

[ ] no frontend prefix fabrication
[ ] no silent legacy .code fallback for normalized Marketplace business presentation
[ ] same UUID = same canonical reference across applicable read paths

[ ] Search consistent
[ ] CSV/XLSX consistent
[ ] Analytics/drill-down consistent
[ ] pagination after server-side scope
[ ] totals after server-side scope

[ ] CRM-* unchanged
[ ] PRN-* unchanged
[ ] Storefront data preserved
[ ] Storefront A/B tenant isolation preserved
[ ] Platform API does not leak Storefront end-customer commerce

[ ] automated regression tests added
[ ] browser runtime covers all known findings
[ ] direct URL/click/refresh verified
[ ] RU/AZ/EN checked
[ ] test results truthfully reported
[ ] report predominantly Russian
[ ] real Implementation SHA recorded
[ ] HEAD == origin/master
```

---

# 49. HARD VERDICT B CONDITIONS

`VERDICT B` обязателен, если остаётся хотя бы одно:

```text
Customer 360 Orders → ORD-*
Customer 360 Bookings → BKG-*
Order Detail related Bookings → BKG-*
CRM Activity → ORD-*
CRM Activity → BKG-*
CRM Activity → PAY-*
```

Также `VERDICT B`, если:

```text
Storefront end-customer commerce остаётся в Platform Customer 360
Storefront-only end-customer остаётся Platform Marketplace customer без доказанного Marketplace relationship
frontend скрывает SF rows, но API продолжает их отдавать
totals включают SF commerce после скрытия rows
pagination выполняется до scope filtering
fix основан на MKT/SF prefix как authorization/scope source
canonical refs fabricating in frontend
browser runtime evidence отсутствует
Storefront data удалены ради прохождения тестов
tenant isolation сломана
```

Refund `RFD-*` сам по себе не должен быть автоматически классифицирован как failure, пока canonical Refund Reference Contract не доказан. Но отсутствие audit по нему — `VERDICT B`.

---

# 50. ROADMAP

Additively обновить:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Не переписывать историю.

Зафиксировать:

```text
Project-Wide Reference Presentation Consistency
→ reopened by runtime evidence

Round 2:
Platform CRM Customer Scope
+ Commercial Reference Consistency
→ required before Full Strict Review
```

Не подменять старые historical verdicts — добавить corrective record.

---

# 51. STOP CONDITION

После:

```text
audit
→ implementation
→ tests
→ browser runtime
→ report
→ commit/push
```

остановиться.

Не запускать автоматически:

```text
Shared Commerce Sequence + Request Center Full Strict Review
Product Freshness
Step 3.12
```

Следующий этап только после подтверждённого `VERDICT A` этого Round 2:

```text
PHASE 3 — PRE-STEP 3.12
SHARED COMMERCE SEQUENCE + REQUEST CENTER
FULL STRICT REVIEW
```

---

# FINAL PRINCIPLE

Цель не в том, чтобы визуально заменить:

```text
ORD → MKT-ORD
BKG → MKT-BKG
PAY → MKT-PAY
```

Цель — восстановить единый domain contract:

```text
MASTER CUSTOMER IDENTITY
        │
        ├── PLATFORM / MARKETPLACE CONTEXT
        │       ↓
        │   server-side scoped commerce
        │       ↓
        │   canonical MKT references
        │
        └── PARTNER / STOREFRONT CONTEXT
                ↓
            tenant-scoped Storefront commerce
```

Один Customer может участвовать в нескольких business contexts.

Но каждый Workspace обязан видеть только тот commerce context, на который он имеет business authority.
