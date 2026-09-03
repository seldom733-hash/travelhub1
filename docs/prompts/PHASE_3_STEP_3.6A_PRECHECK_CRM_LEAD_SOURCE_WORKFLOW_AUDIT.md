# PHASE 3 — STEP 3.6A PRECHECK
## CRM LEAD SOURCE WORKFLOW AUDIT

### Цель

Определить фактический end-to-end workflow заполнения и использования:

```text
PartnerCustomerRelation.leadSource
```

и установить, существует ли сейчас полноценная рабочая точка, где источник клиента:

- определяется системой автоматически;
- выбирается пользователем вручную;
- сохраняется в canonical CRM relationship;
- затем корректно используется CRM Analytics.

**До завершения аудита ничего не исправлять и не менять schema/API/UI.**

---

## 1. КОНТЕКСТ

В CRM Analytics уже используется breakdown по источнику (`Source / Источник / Mənbə`).

Canonical значения, которые ранее использовались для `PartnerCustomerRelation.leadSource`:

```text
MARKETPLACE
PHONE
OFFICE
EMAIL
REFERRAL
DIRECT
OTHER
```

При этом в текущей форме:

```text
Platform CRM
→ Создать клиента / Müştəri yaratmaq
```

визуально присутствуют:

```text
Тип
Имя
Фамилия
Компания
E-mail
Телефон
Примечание
```

и отсутствует поле `Источник / Source / Mənbə`.

Это **не считать дефектом автоматически**, потому что Platform CRM может создавать глобальную сущность `Customer`, тогда как `leadSource` относится к `PartnerCustomerRelation`.

Необходимо установить реальную архитектуру и workflow по коду, API, DB и runtime.

---

# GATE 1 — DATA MODEL AUTHORITY

Проверить актуальную Prisma/schema/domain model.

Установить:

1. Где именно определён `leadSource`.
2. Какой entity владеет полем.
3. Тип/enum поля.
4. Допустимые значения.
5. Nullable/default semantics.
6. Есть ли миграции, seed или fixtures, которые заполняют `leadSource`.

Подтвердить или опровергнуть:

```text
Customer
   ↓
PartnerCustomerRelation
   ├── partnerId
   ├── customerId
   ├── lifecycle
   ├── leadSource
   └── assigned manager / owner
```

Не переносить `leadSource` в `Customer`.

---

# GATE 2 — WRITE PATHS

Найти **все production write paths**, которые могут:

- создать `PartnerCustomerRelation`;
- изменить существующий `PartnerCustomerRelation`;
- присвоить `leadSource`;
- изменить `leadSource`.

Для каждого показать:

```text
Route / event
→ Controller
→ DTO
→ Service
→ DB operation
```

Обязательно проверить:

### A. Marketplace flow

Что происходит, когда клиент приходит через витрину TravelHub:

```text
Storefront / Marketplace
→ service/tour/product
→ booking/order/request/lead
→ Customer
→ PartnerCustomerRelation
```

Ответить:

- создаётся ли PCR автоматически;
- устанавливается ли `leadSource = MARKETPLACE`;
- в какой точке;
- что происходит, если PCR уже существует;
- может ли существующий source быть случайно перезаписан.

### B. Partner Customer Intake

Проверить endpoint вида:

```text
POST /partner/customers/intake
```

или актуальный эквивалент.

Показать:

- DTO;
- принимает ли `leadSource`;
- required/optional;
- default;
- validation;
- service logic;
- create/reuse semantics для Customer;
- create/reuse semantics для PCR.

### C. Platform Partner Intake

Проверить endpoint вида:

```text
POST /partners/:partnerId/intake
```

или актуальный эквивалент.

Показать ту же цепочку.

### D. Platform CRM → Create Customer

Отдельно установить, что создаёт текущая форма:

```text
Platform CRM
→ Müştəri yaratmaq / Создать клиента
```

Ответить:

- только `Customer`;
- `Customer + PartnerCustomerRelation`;
- другой workflow.

Если форма создаёт только глобальный `Customer`, отсутствие `leadSource` **не считать дефектом**.

---

# GATE 3 — CURRENT UI AUTHORITY

Проверить фактический runtime UI.

Найти все формы/страницы, где пользователь сейчас может создать клиента/лида или CRM relationship.

Обязательно проверить:

```text
Platform Workspace
→ CRM
→ Customers
→ Create Customer

Partner Workspace
→ CRM
→ Customers

Partner Workspace
→ Add/Create Customer/Lead

Partner Customer Intake
```

Для каждой формы составить таблицу:

| Surface | Creates Customer | Creates PCR | Source field | Manager | Lifecycle |
|---|---:|---:|---:|---:|---:|
| Platform Create Customer | ? | ? | ? | ? | ? |
| Partner Customer Intake | ? | ? | ? | ? | ? |
| Other | ? | ? | ? | ? | ? |

Если Partner CRM UI ещё не реализован — зафиксировать это явно.

---

# GATE 4 — SOURCE SEMANTICS

Проверить фактическую семантику текущего `leadSource`.

Рабочая гипотеза:

```text
PartnerCustomerRelation.leadSource
=
источник первоначального появления Customer
в CRM конкретного Partner
```

То есть:

```text
MARKETPLACE
= клиент пришёл к Partner через витрину TravelHub

PHONE
= первичный контакт по телефону

OFFICE
= первичный контакт в офисе

EMAIL
= первичный контакт по email

REFERRAL
= клиент пришёл по рекомендации

DIRECT
= прямое внесение/обращение

OTHER
= другой источник
```

Проверить, соответствует ли этому текущий backend.

**Не переопределять `leadSource` как источник каждого последующего обращения.**

Один Customer может иметь несколько обращений, но текущий PCR source должен рассматриваться в соответствии с фактической canonical моделью.

---

# GATE 5 — MARKETPLACE AUTO-ATTRIBUTION

Это критический пункт.

Если система сама знает, что Customer пришёл через витрину TravelHub, пользователь **не должен вручную выбирать MARKETPLACE**.

Проверить наличие автоматической цепочки:

```text
TravelHub Marketplace / Storefront
        ↓
Customer action
        ↓
Partner identified
        ↓
Customer identified/created
        ↓
PartnerCustomerRelation created
        ↓
leadSource = MARKETPLACE
```

Проверить также повторный сценарий:

```text
PCR already exists
→ new marketplace interaction
```

Не должно происходить неконтролируемого изменения первоначального source без утверждённого business rule.

Если auto-attribution отсутствует — только зафиксировать GAP. На этапе audit не исправлять.

---

# GATE 6 — MANUAL SOURCE ENTRY

Если Partner сам создаёт клиента/лида, определить, существует ли UI для выбора:

```text
Источник *

Marketplace
Phone
Office
Email
Referral
Direct
Other
```

Проверить:

- RU;
- AZ;
- EN;
- DTO mapping;
- enum mapping;
- API request;
- persisted DB value.

Важно:

`MARKETPLACE` при нормальном Marketplace flow должен приходить автоматически.

Ручное использование `MARKETPLACE` допустимо только если это предусмотрено canonical business rule.

---

# GATE 7 — DATABASE EVIDENCE

Показать реальные DB-примеры минимум для 3–5 `PartnerCustomerRelation`.

Для каждой записи:

```text
customerId
customer display name
partnerId
partner display name
leadSource
lifecycle
assigned manager / assignedTo
createdAt
updatedAt
```

Желательно подобрать разные source:

```text
MARKETPLACE
PHONE
DIRECT
```

или другие реально существующие значения.

Отдельно показать aggregate:

```text
GROUP BY leadSource
COUNT(*)
```

для scope, который сейчас отображается в CRM Analytics.

---

# GATE 8 — ANALYTICS PROVENANCE

Подтвердить полную цепочку:

```text
PartnerCustomerRelation.leadSource
        ↓
AnalyticsService.getCrmAnalytics()
        ↓
sourceBreakdown
        ↓
GET /analytics/crm
        ↓
CRM Analytics UI
        ↓
Source / Источник / Mənbə
```

Для текущего runtime-примера показать:

```text
DB GROUP BY leadSource
        =
AnalyticsService result
        =
GET /analytics/crm JSON
        =
UI breakdown
```

Frontend не должен самостоятельно придумывать или пересчитывать source population из таблицы Customers.

---

# GATE 9 — WORKSPACE / SCOPE

Проверить отдельно:

```text
PLATFORM
```

и:

```text
PARTNER
```

Установить, какой scope применяется к source breakdown.

Показать:

- active workspace;
- actor/role;
- partnerId, если применимо;
- period/dateFrom/dateTo;
- scope resolver;
- DB population;
- API population.

Не смешивать:

```text
глобальный Customer
```

с:

```text
PartnerCustomerRelation
```

---

# GATE 10 — GAP CLASSIFICATION

После аудита дать **ровно один основной verdict**.

## VERDICT A

```text
SOURCE WORKFLOW EXISTS AND IS COMPLETE
```

Использовать только если:

- Marketplace source устанавливается автоматически;
- manual Partner Intake имеет рабочий source input;
- DB persistence корректна;
- analytics использует те же данные;
- runtime подтверждён.

## VERDICT B

```text
BACKEND SOURCE MODEL EXISTS,
BUT PARTNER UI ENTRY POINT IS MISSING
```

Например:

- backend/DTO поддерживает `leadSource`;
- Analytics работает;
- но Partner CRM UI не позволяет выбрать source.

В таком случае зафиксировать GAP для:

```text
PHASE 3 — STEP 3.6A — Partner CRM UI
```

## VERDICT C

```text
SOURCE WORKFLOW IS PARTIAL OR INCORRECT
```

Например:

- Marketplace не устанавливает MARKETPLACE автоматически;
- source теряется;
- source перезаписывается;
- DTO/API/UI расходятся;
- analytics агрегирует не canonical поле.

## VERDICT D

```text
SOURCE SEMANTICS REQUIRE ARCHITECTURAL DECISION
```

Использовать только если текущая реализация противоречива и невозможно однозначно определить canonical meaning из roadmap/repo.

---

# HARD CONSTRAINTS

Во время этого задания:

```text
NO schema changes
NO migrations
NO API changes
NO UI implementation
NO refactoring
NO seed modification
NO synthetic production data
NO roadmap renumbering
NO premature VERDICT A
```

Это **evidence-only audit**.

Не добавлять `leadSource` в глобальный `Customer`.

Не добавлять поле Source в Platform Create Customer только потому, что оно визуально отсутствует.

Не создавать новый Lead/Inquiry entity в рамках этого задания.

Не менять CRM Analytics.

---

# REQUIRED EVIDENCE

Финальный отчёт должен содержать:

1. Relevant schema/model snippets.
2. Все write paths для PCR/source.
3. DTO contracts.
4. Marketplace auto-attribution evidence.
5. Platform Create Customer semantics.
6. Partner Intake semantics.
7. Current UI evidence.
8. DB examples.
9. `GROUP BY leadSource`.
10. `/analytics/crm` JSON.
11. DB → Service → API → UI reconciliation.
12. Workspace/scope explanation.
13. Exact GAP classification.
14. Git status.

---

# GIT SAFETY

Так как это audit-only stage:

```text
git status
git diff
```

В нормальном случае production code не должен измениться.

Если для evidence создаётся только отчёт, отдельно показать это.

Не коммитить production changes в рамках PRECHECK.

---

# FINAL REPORT FORMAT

```text
PHASE 3 — STEP 3.6A PRECHECK
CRM LEAD SOURCE WORKFLOW AUDIT

VERDICT: A | B | C | D

1. Canonical owner:
   ...

2. Source enum:
   ...

3. Platform Create Customer:
   ...

4. Partner Intake:
   ...

5. Marketplace auto-attribution:
   ...

6. Existing Partner UI:
   ...

7. DB evidence:
   ...

8. Analytics provenance:
   DB → Service → API → UI = PASS/FAIL

9. Identified GAP:
   ...

10. Required action for Step 3.6A:
    ...

Git:
Starting HEAD:
Final HEAD:
origin/master:
Production changes: NONE / ...
```

---

# STOP CONDITION

После выдачи отчёта **остановиться**.

Не начинать исправление автоматически.

Если обнаружен GAP, сначала требуется отдельное подтверждение/implementation prompt для Step 3.6A.
