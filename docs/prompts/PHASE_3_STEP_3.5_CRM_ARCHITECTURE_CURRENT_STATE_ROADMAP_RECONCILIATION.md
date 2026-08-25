# PHASE 3 — STEP 3.5 — CRM
## ARCHITECTURE / CURRENT-STATE / ROADMAP RECONCILIATION
## PRE-IMPLEMENTATION GATE — NO FEATURE IMPLEMENTATION

---

# 1. ЦЕЛЬ

Перейти к следующему canonical этапу:

```text
PHASE 3 — STEP 3.5 — CRM
```

Но НЕ начинать CRM implementation до сверки:

```text
existing architecture
existing roadmap
current production code
DB schema
API contracts
frontend routes/components
RBAC / permissions
workspace / tenant scope
existing CRM Customers runtime
Orders / Bookings / Payments / Refunds relations
future Booking Commercial Terms capabilities
future Supplier Settlement / Balance / Payout capabilities
```

Результат этапа — единый, непротиворечивый **CRM implementation contract**.

---

# 2. MODE

Это:

```text
ARCHITECTURE + CURRENT-STATE + ROADMAP RECONCILIATION
```

Это НЕ:

```text
CRM feature implementation
DB migration
new API implementation
new UI implementation
Supplier Settlement implementation
Booking Commercial Terms implementation
```

Production code на этом этапе не менять.

---

# 3. SOURCE OF TRUTH ORDER

Сверять в таком порядке:

```text
1. Canonical architecture docs
2. Canonical roadmap
3. Existing reconciliation/audit docs
4. Current DB/schema/entities
5. Current backend implementation
6. Current frontend implementation
7. Runtime behavior
8. Tests
```

Если документы и runtime расходятся — зафиксировать conflict, не выбирать молча одну сторону.

---

# 4. CRM CURRENT-STATE INVENTORY

Найти всё, что уже относится к CRM:

```text
CRM routes
CRM Customers page
customer tables
customer details
customer search/filter
customer APIs
customer DTOs
customer entities/models
customer/order relations
customer/booking relations
customer/payment relations
customer/refund relations
notes/tags if present
communications if present
activity/history if present
RBAC permissions
workspace scope
```

---

# 5. НЕ ПРЕДПОЛАГАТЬ GREENFIELD

CRM уже частично существует.

Предыдущий project-wide pagination closure подтвердил минимум:

```text
CRM Customers operational table exists
pagination contract exists
```

Поэтому Step 3.5 должен быть reconciliation/extension existing CRM, а не создание второго параллельного CRM.

---

# 6. BUSINESS PURPOSE

Определить canonical роль CRM в TravelHub.

CRM должен отвечать на вопросы:

```text
Кто клиент?
Что он покупал?
Какие у него заказы?
Какие бронирования?
Каков customer payment state?
Есть ли возвраты?
Какова история взаимодействия?
Какие действия сотрудник может выполнить?
```

Но не превращать CRM в Finance/Settlement system.

---

# 7. CORE DOMAIN BOUNDARY

Зафиксировать:

```text
CRM Customer
≠
Order
≠
Booking
≠
Payment
≠
Refund
≠
Supplier Settlement
≠
Supplier Payout
```

CRM может быть consumer/read-model этих доменов, но не должен становиться authority для их lifecycle.

---

# 8. CUSTOMER 360

Определить целевой Customer 360 contract.

Минимально рассмотреть:

```text
Identity
Contact information
Customer status
Orders
Bookings
Customer payments
Refunds
Commercial activity
Communication/activity history
Notes/tags — if architecture supports
Responsible employee — if architecture supports
Risk/service indicators — only if canonical
```

Не реализовывать сейчас — определить scope.

---

# 9. CUSTOMER IDENTITY

Проверить current canonical customer identity:

```text
User?
Customer?
Order customer snapshot?
Guest customer?
Registered user?
Email/phone identity?
```

Определить primary key / relation authority.

Не создавать duplicate customer entity без необходимости.

---

# 10. REGISTERED vs GUEST CUSTOMER

Проверить, поддерживает ли current marketplace:

```text
registered customer
guest checkout/customer
```

Если guest flow существует или предусмотрен — CRM architecture должна учитывать его.

Если не существует — не придумывать runtime capability; зафиксировать status.

---

# 11. CUSTOMER → ORDERS

Определить relation:

```text
Customer
→ Orders
```

Для CRM нужны минимум:

```text
order number
order status
created date
total
currency
customer payment status
```

Exact fields сверить с current Order model.

---

# 12. CUSTOMER → BOOKINGS

Определить relation:

```text
Customer
→ Bookings
```

Минимально рассмотреть:

```text
booking number
service/product
supplier
service date
booking status
confirmation state
```

Не дублировать Booking lifecycle в CRM.

---

# 13. CUSTOMER PAYMENT STATUS

В CRM должна быть возможность видеть состояние оплаты клиентом.

Canonical distinction:

```text
Customer Payment Status
```

может включать actual existing states вроде:

```text
UNPAID
PARTIALLY_PAID
PAID
REFUNDED
```

Но exact enums брать из current canonical model.

Не вводить новые enum values на reconciliation этапе.

---

# 14. SUPPLIER PAYMENT / SETTLEMENT STATUS

Ранее архитектурно зафиксировано:

```text
Customer Payment Terms
≠
Supplier Settlement Terms
≠
Supplier Payout
```

CRM в будущем может показывать supplier-side finance state в контексте заказа/бронирования, если это необходимо сотруднику.

Но Step 3.5 НЕ должен реализовывать:

```text
Supplier Settlement S.1–S.19
ledger
balance
reserve
payout engine
```

---

# 15. FUTURE CRM FINANCE FIELDS

Определить read-only placeholders/capability boundaries для будущего:

```text
customer payment status
supplier settlement status
supplier payout status
```

Критически:

```text
если Supplier Settlement runtime ещё не существует,
CRM не должен фабриковать этот статус.
```

Report:

```text
AVAILABLE NOW
DERIVABLE NOW
PLANNED — NOT AVAILABLE
```

---

# 16. PAYMENT SCHEDULE / COMMERCIAL TERMS

Booking Commercial Terms architecture уже сохранена как future capability.

CRM architecture должна предусмотреть, что в будущем сотруднику может понадобиться видеть:

```text
full vs partial payment
payment schedule
next payment deadline
overdue installment
commercial terms snapshot
agreement version
```

Но не реализовывать F.1–F.13 в Step 3.5 reconciliation.

---

# 17. AGREEMENT / CONTRACT VISIBILITY

В будущем Customer 360 / Order / Booking context может ссылаться на:

```text
booking agreement
commercial terms snapshot
agreement version
```

Определить правильную ownership boundary.

CRM:

```text
consumer/link/view
```

не:

```text
canonical agreement authority
```

---

# 18. REFUNDS

Проверить current Refund model и relation:

```text
Customer
→ Order
→ Refund(s)
```

CRM должен различать:

```text
order cancelled
≠
refund requested
≠
refund processed
```

Не возвращаться к старой proxy-семантике `CANCELLED = refund`.

---

# 19. CUSTOMER FINANCIAL SUMMARY

Определить, какие customer-centric агрегаты допустимы:

```text
total orders
completed orders
total paid
total refunded
outstanding amount
```

Только если их можно канонически вычислить из existing data.

Не смешивать с:

```text
GMV
platform revenue
supplier balance
supplier payable
```

---

# 20. CRM LIST PAGE

Проверить current CRM Customers list.

Определить целевой contract колонок.

Минимально рассмотреть:

```text
Customer
Contact
Orders count
Bookings count
Customer payment state / outstanding indicator
Last activity
Total customer spend
Status
```

Не добавлять всё автоматически.

Для каждой proposed column:

```text
business value
source
cost
availability now
```

---

# 21. CRM CUSTOMER DETAIL

Определить структуру Customer 360 detail page.

Candidate sections:

```text
Overview
Orders
Bookings
Payments
Refunds
Activity
Notes
```

Это candidate architecture — сверить с existing docs/runtime.

Не создавать UI сейчас.

---

# 22. CUSTOMER STATUS

Проверить, существует ли canonical CRM/customer status.

Например:

```text
active
inactive
blocked
VIP
lead
```

НЕ вводить такие статусы по предположению.

Report actual state.

---

# 23. CRM ≠ SALES PIPELINE

Проверить architecture distinction:

```text
CRM Customers
vs
Sales / Leads / Deals
```

Если Sales Center уже имеет собственную domain model — не смешивать её с Customer 360.

Определить связи, если они существуют.

---

# 24. ACTIVITY TIMELINE

Проверить возможность единой customer activity timeline.

Potential events:

```text
order created
booking created
booking confirmed
payment succeeded
payment failed
refund requested
refund completed
message/interaction
```

Но timeline должна быть consumer событий, а не новой lifecycle authority.

Определить:

```text
AVAILABLE NOW
PARTIAL
PLANNED
```

---

# 25. COMMUNICATIONS

Проверить существующие:

```text
messages
chat rooms
email history
notifications
```

Определить, должен ли CRM Customer 360 ссылаться/показывать коммуникации.

Не создавать новый omnichannel messaging engine.

---

# 26. NOTES

Проверить, есть ли:

```text
customer notes
internal notes
staff comments
```

Если нет — определить, входит ли это в Step 3.5 implementation scope или future substep.

Не предполагать.

---

# 27. TAGS / SEGMENTS

Проверить существование:

```text
tags
segments
customer groups
```

Если Analytics/Marketing имеет segmentation architecture — CRM не должен создавать параллельную taxonomy.

---

# 28. RESPONSIBLE EMPLOYEE / OWNER

Проверить, существует ли concept:

```text
account owner
sales manager
operator
assigned employee
```

Если да — определить relation и permissions.

Если нет — не вводить автоматически.

---

# 29. SEARCH

Определить CRM search contract.

Рассмотреть existing searchable identifiers:

```text
name
email
phone
customer ID
order number
booking number
```

Только поддерживаемые источниками поля.

---

# 30. FILTERS

Определить canonical CRM filters.

Candidate filters:

```text
customer status
order activity
booking activity
payment state
refund state
last activity
date range
responsible employee
```

Каждый filter классифицировать:

```text
IMPLEMENT NOW
FUTURE
NOT SUPPORTED
```

---

# 31. SORTING

Определить useful CRM sorts:

```text
last activity
created date
total spend
orders count
```

Только если source/query contract позволяет.

---

# 32. PAGINATION

Project-wide pagination уже CLOSED.

CRM operational tables должны сохранять:

```text
default page size = 20
server-side pagination
filtered total
multi-page navigation
```

Не делать новый pagination redesign.

---

# 33. WORKSPACE CONTEXT

Сверить CRM с canonical hierarchy:

```text
IDENTITY
→ WORKSPACE CONTEXT
→ TENANT / PARTNER SCOPE
→ PLAN / ENTITLEMENTS
→ BUSINESS CAPABILITIES
→ ROLE / PERMISSIONS
```

---

# 34. PLATFORM vs PARTNER CRM

Критический вопрос Step 3.5:

```text
CRM для PLATFORM
и
CRM для PARTNER
```

не обязательно должны видеть одинаковый dataset.

Определить:

```text
Platform CRM scope
Partner CRM scope
```

---

# 35. PLATFORM CRM

Platform internal staff может иметь platform-wide customer view в пределах permissions.

Определить:

```text
which roles
which customer data
which cross-partner visibility
```

Не расширять доступ без canonical permission.

---

# 36. PARTNER CRM

Partner должен видеть только customers/business interactions, относящиеся к его scope.

Hard invariant:

```text
Partner A
MUST NOT
see Partner B customer commercial data
```

Проверить multi-tenant isolation.

---

# 37. MARKETPLACE BASIC vs STOREFRONT PRO

Ранее entitlement architecture разделяет:

```text
Marketplace Basic
Storefront Pro
```

Сверить, кому доступен CRM.

Existing architecture указывала Storefront Pro как full CRM capability.

Проверить current canonical docs/roadmap и вернуть exact entitlement matrix.

Не менять entitlement silently.

---

# 38. RBAC

Проверить existing roles:

```text
ADMIN
DIRECTOR
ANALYST
MARKETER
FINANCE
MODERATOR
SALES_MANAGER
OPERATOR
```

Определить CRM permissions.

Не копировать analytics permissions.

---

# 39. PERMISSION GRANULARITY

Рассмотреть необходимость:

```text
crm.read
crm.customer.read
crm.customer.update
crm.notes.read
crm.notes.write
crm.export
```

Но сначала inventory existing permission model.

Не создавать permissions на reconciliation этапе.

---

# 40. PII

CRM содержит customer PII.

Проверить handling:

```text
name
email
phone
address
documents if any
```

Определить:

```text
who can view
who can edit
masking requirements if canonical
audit requirements
```

Не придумывать compliance claims.

---

# 41. AUDIT

Определить какие CRM mutations должны быть audited:

```text
customer edits
notes
tags
assignment
status changes
exports
```

Только для capabilities, которые войдут в implementation scope.

---

# 42. EXPORT

Проверить, существует ли customer export.

Если нет — определить:

```text
Step 3.5
or future
```

Export должен учитывать RBAC/PII/scope.

---

# 43. DATA OWNERSHIP MATRIX

Создать:

| Data | Canonical authority | CRM role |
|---|---|---|
| Customer identity | | |
| Order | Orders | consumer |
| Booking | Bookings | consumer |
| Customer payment | Payments/Orders | consumer |
| Refund | Refund domain | consumer |
| Commercial terms | future canonical domain | future consumer |
| Supplier settlement | future Settlement domain | future consumer |
| Supplier payout | future Payout domain | future consumer |
| Notes | TBD | |
| Tags | TBD | |
| Activity | event/read model TBD | |

Заполнить по repository evidence.

---

# 44. CURRENT API INVENTORY

Составить:

| Endpoint | Purpose | Pagination | Search | Filters | Scope | Used by CRM? |
|---|---|---|---|---|---|---|

Не придумывать endpoints.

---

# 45. CURRENT DB / MODEL INVENTORY

Составить relations:

```text
User/Customer
Order
Booking
Payment
Refund
Message/Chat
Partner
Employee
```

Exact names — из repository.

---

# 46. GAP ANALYSIS

Каждый CRM capability классифицировать:

```text
EXISTS AND CORRECT
EXISTS BUT INCOMPLETE
EXISTS BUT SEMANTICALLY WRONG
MISSING — REQUIRED FOR 3.5
PLANNED — FUTURE
OUT OF SCOPE
```

---

# 47. IMPLEMENTATION DECOMPOSITION

После reconciliation предложить Step 3.5 implementation substeps.

Не выполнять их.

Пример структуры, если repository evidence поддерживает:

```text
3.5A — CRM authority / RBAC / scope
3.5B — Customer list/read model
3.5C — Customer 360
3.5D — Orders/Bookings integration
3.5E — Payments/Refunds integration
3.5F — Activity/notes
3.5G — Security/runtime closure
```

Это НЕ предписанная структура.

Разработчик должен вывести оптимальные substeps из фактического current state.

---

# 48. DEPENDENCY MATRIX

Для каждого proposed substep:

```text
depends on existing runtime?
depends on future F.1–F.13?
depends on future S.1–S.19?
can implement now?
```

Не блокировать весь CRM из-за future finance architecture, если capability может быть корректно реализована сейчас.

---

# 49. BOOKING COMMERCIAL TERMS BOUNDARY

Сохранить invariant:

```text
F.1–F.13
PLANNED — NOT STARTED
```

CRM Step 3.5 может только:

```text
reserve integration boundary
```

до их реализации.

---

# 50. SUPPLIER SETTLEMENT BOUNDARY

Сохранить invariant:

```text
S.1–S.19
PLANNED — NOT STARTED
```

CRM Step 3.5 не должен создавать fake settlement/payout values.

---

# 51. NO PRODUCTION CODE

На этом reconciliation этапе:

```text
Production code changed = NO
DB schema changed = NO
Migration = NO
Runtime behavior changed = NO
```

Допустимы:

```text
architecture docs
roadmap clarification
reconciliation report
```

---

# 52. ARCHITECTURE DOCUMENT

Если existing CRM architecture недостаточна — создать/обновить canonical doc, например:

```text
docs/architecture/crm-customer-360-architecture.md
```

Но сначала использовать existing architecture naming/layout conventions.

Не создавать duplicate doc, если canonical CRM doc уже существует.

---

# 53. ROADMAP

Сверить Step 3.5 в canonical roadmap.

Если decomposition отсутствует/устарела — обновить roadmap.

Все implementation substeps:

```text
PLANNED — NOT STARTED
```

на этом этапе.

---

# 54. REQUIRED RECONCILIATION REPORT

Создать:

```text
docs/prompts/PHASE_3_STEP_3.5_CRM_ARCHITECTURE_CURRENT_STATE_ROADMAP_RECONCILIATION_REPORT.md
```

---

# 55. REQUIRED REPORT — CURRENT STATE

| Area | Existing | Correct? | Gap | Source evidence |
|---|---|---|---|---|
| CRM Customers | | | | |
| Customer detail | | | | |
| Orders relation | | | | |
| Bookings relation | | | | |
| Payments | | | | |
| Refunds | | | | |
| Activity | | | | |
| Notes | | | | |
| Search | | | | |
| Filters | | | | |
| RBAC | | | | |
| Partner scope | | | | |

---

# 56. REQUIRED REPORT — FUTURE FINANCE BOUNDARY

| Field/Capability | Available now | Future source | CRM behavior now |
|---|---|---|---|
| Customer payment status | | | |
| Partial payment schedule | | F.* | |
| Agreement version | | F.* | |
| Supplier settlement status | | S.* | |
| Supplier payable balance | | S.* | |
| Supplier payout status | | S.* | |

---

# 57. REQUIRED REPORT — ENTITLEMENT

| Workspace / Tier | CRM list | Customer 360 | Finance visibility | Notes/actions |
|---|---|---|---|---|
| PLATFORM | | | | |
| Marketplace Basic | | | | |
| Storefront Pro | | | | |

Use canonical evidence.

---

# 58. REQUIRED REPORT — RBAC

| Role | CRM access | Customer PII | Finance fields | Mutations | Evidence |
|---|---|---|---|---|---|
| ADMIN | | | | | |
| DIRECTOR | | | | | |
| ANALYST | | | | | |
| MARKETER | | | | | |
| FINANCE | | | | | |
| MODERATOR | | | | | |
| SALES_MANAGER | | | | | |
| OPERATOR | | | | | |

Do not invent defaults.

---

# 59. REQUIRED REPORT — IMPLEMENTATION PLAN

| Substep | Scope | Dependencies | Production changes expected | Status |
|---|---|---|---|---|

Все:

```text
PLANNED — NOT STARTED
```

---

# 60. HARD ACCEPTANCE CRITERIA

VERDICT A только если:

1. Existing CRM implementation fully inventoried.
2. Existing CRM docs inventoried.
3. Canonical roadmap Step 3.5 reconciled.
4. Customer identity authority identified.
5. Customer → Orders relation identified.
6. Customer → Bookings relation identified.
7. Customer payment authority identified.
8. Refund authority identified.
9. Customer 360 target contract defined.
10. CRM list target contract defined.
11. Platform CRM scope defined.
12. Partner CRM scope defined.
13. Cross-partner isolation defined.
14. Marketplace Basic entitlement resolved from canonical evidence.
15. Storefront Pro entitlement resolved from canonical evidence.
16. Existing RBAC/permissions inventoried.
17. PII boundary defined.
18. Search/filter/sort scope classified.
19. Activity capability classified.
20. Notes capability classified.
21. Tags/segments capability classified.
22. Communications integration classified.
23. Customer financial summary semantics defined.
24. Customer Payment ≠ Supplier Settlement preserved.
25. Supplier Settlement ≠ Supplier Payout preserved.
26. F.1–F.13 remain PLANNED — NOT STARTED.
27. S.1–S.19 remain PLANNED — NOT STARTED.
28. CRM does not fabricate future settlement fields.
29. Data ownership matrix complete.
30. API inventory complete.
31. DB/model inventory complete.
32. Gap analysis complete.
33. Step 3.5 decomposed into implementable substeps.
34. Dependencies identified.
35. Architecture updated only where necessary.
36. Roadmap updated only where necessary.
37. Production code changed = NO.
38. DB schema changed = NO.
39. Runtime behavior changed = NO.
40. Unrelated files committed = 0.
41. Push complete.
42. HEAD == origin/master.

---

# 61. VERDICT

Только при полном reconciliation:

```text
VERDICT A — PHASE 3 STEP 3.5 CRM ARCHITECTURE / CURRENT STATE / ROADMAP FULLY RECONCILED — READY FOR IMPLEMENTATION
```

Иначе:

```text
VERDICT B — PHASE 3 STEP 3.5 CRM RECONCILIATION INCOMPLETE — IMPLEMENTATION NOT AUTHORIZED
```

---

# 62. FINAL RESPONSE FORMAT

```text
VERDICT:

Current CRM state:
Customer authority:
CRM Customers:
Customer 360:
Orders:
Bookings:
Payments:
Refunds:
Activity:
Notes:
Tags/segments:
Communications:

Platform scope:
Partner scope:
Entitlements:

RBAC:
PII:
Audit:

Customer payment:
Booking Commercial Terms boundary:
Supplier Settlement boundary:
Supplier Payout boundary:

Architecture changes:
Roadmap changes:

Step 3.5 implementation decomposition:
3.5A:
3.5B:
3.5C:
...

Production code changed:
DB changed:
Runtime changed:

Files changed:
Commit:
HEAD:
origin/master:
HEAD == origin/master:
Unrelated files:

Remaining gaps:
First authorized implementation substep:
```

---

# 63. STOP

После reconciliation report:

```text
STOP
```

Не начинать автоматически:

```text
3.5A
3.5B
3.5C
...
F.1–F.13
S.1–S.19
```

Сначала получить review/approval reconciliation result.
