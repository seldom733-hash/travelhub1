# PHASE 3 — STEP 3.6A — PARTNER CRM SOURCE / ENTITLEMENT ARCHITECTURE AUDIT

## Цель

До любых изменений CRM UI/API/schema определить **canonical business rules для источника клиента (`leadSource`) с учётом двух разных Partner tiers**:

```text
Marketplace Basic
vs
Storefront Pro
```

Текущий audit уже подтвердил:

```text
PartnerCustomerRelation.leadSource
```

принадлежит Partner-scoped CRM relationship, а не глобальному `Customer`.

Также подтверждено:

- Platform `POST /customers` создаёт только глобальный `Customer`;
- отсутствие Source в Platform CRM → Create Customer само по себе корректно;
- Partner Intake backend принимает `leadSource`;
- текущий Partner UI имеет source selector;
- Marketplace auto-attribution сейчас отсутствует;
- CRM Analytics агрегирует `PartnerCustomerRelation.leadSource`.

Однако **НЕ НАЧИНАТЬ remediation по предыдущему audit автоматически**.

Обнаружено более важное business-rule уточнение:

> Marketplace Basic Partner работает с клиентом через TravelHub. Клиент не получает прямые телефон/email/офисные контакты Partner и взаимодействует с Partner через платформу. Прямые каналы собственного бизнеса относятся прежде всего к Storefront Pro.

Поэтому сначала требуется entitlement-aware architecture audit.

---

# HARD STOP

Это **AUDIT / DESIGN AUTHORITY ONLY**.

До финального verdict:

```text
NO schema changes
NO migrations
NO API changes
NO UI changes
NO seed changes
NO source enum changes
NO entitlement changes
NO roadmap renumbering
NO production commits
```

Не добавлять `PHONE/OFFICE/EMAIL/OTHER` всем Partner tiers только потому, что backend уже принимает эти строки.

Не реализовывать Marketplace auto-attribution до определения canonical event authority.

---

# 1. CANONICAL BUSINESS MODEL

Проверить roadmap, architecture docs, ADRs, текущую implementation и entitlement model.

Подтвердить текущую иерархию:

```text
IDENTITY
   ↓
WORKSPACE CONTEXT
   ↓
PARTNER SCOPE
   ↓
PLAN / ENTITLEMENT
   ├── Marketplace Basic
   └── Storefront Pro
   ↓
CAPABILITY
   ↓
PERMISSION
   ↓
ACCESS
```

Не смешивать:

```text
PARTNER role
```

с:

```text
Storefront Pro entitlement
```

Проверить фактический tier resolver:

```text
active PartnerStorefront + active entitlement
→ PRO

otherwise
→ BASIC
```

или актуальную canonical реализацию.

---

# 2. CUSTOMER IDENTITY VS PARTNER CRM CUSTOMER

Зафиксировать фактическую модель:

```text
Customer
= global TravelHub identity/customer record

PartnerCustomerRelation
= relationship между global Customer и конкретным Partner
```

Проверить, что один Customer может иметь:

```text
Customer
├── PCR → Partner A
├── PCR → Partner B
└── PCR → Partner C
```

с независимыми:

```text
leadSource
lifecycle
assignedTo
tags
notes
```

Не добавлять `leadSource` в глобальный `Customer`.

---

# 3. MARKETPLACE BASIC — CUSTOMER INTERACTION MODEL

Проверить фактические business rules Marketplace Basic.

Рабочая гипотеза, которую необходимо подтвердить/опровергнуть:

```text
Customer
   ↓
TravelHub Marketplace
   ↓
TravelHub-controlled interaction
   ↓
Order / Booking / Request / Message / other canonical event
   ↓
Marketplace Partner
```

Для Marketplace Basic клиент:

- взаимодействует с Partner через TravelHub;
- не должен зависеть от прямого phone/email/office acquisition Partner;
- не должен получать прямые контактные данные Partner как основной CRM acquisition flow;
- становится CRM-клиентом Partner через платформенное business interaction.

Проверить, соответствует ли этому:

- Marketplace UI;
- booking/order flow;
- messaging;
- customer visibility;
- Partner permissions;
- CRM entitlement;
- existing docs.

---

# 4. MARKETPLACE BASIC — SOURCE SEMANTICS

Определить canonical `leadSource` для Marketplace Basic.

Проверить гипотезу:

```text
Marketplace-originated PartnerCustomerRelation
→ leadSource = MARKETPLACE
```

и что значение устанавливается **системой**, а не Partner manager.

Ответить:

1. Может ли Marketplace Basic Partner вручную создавать CRM Customer?
2. Если да — какой утверждённый business use case?
3. Может ли Marketplace Basic выбирать:
   - PHONE
   - OFFICE
   - EMAIL
   - REFERRAL
   - DIRECT
   - OTHER?
4. Если да — почему это не противоречит marketplace interaction model?
5. Если нет — должен ли source selector быть скрыт/ограничен для BASIC?
6. Должен ли BASIC вообще иметь manual Customer Intake или только platform-generated relationships?

Не делать вывод только по тому, что текущий backend endpoint существует.

**Existing implementation ≠ canonical business requirement.**

---

# 5. STOREFRONT PRO — CUSTOMER INTERACTION MODEL

Storefront Pro является расширенным business-management контуром Partner.

Проверить canonical support для:

```text
TravelHub Marketplace customer
Own Storefront customer
Phone lead
Office lead
Email lead
Referral
Direct/manual lead
Other
```

Определить, должен ли Storefront Pro поддерживать manual Customer Intake с source selector.

Рабочая гипотеза:

```text
Storefront Pro
→ полноценный CRM собственного бизнеса
→ manual customer/lead intake допустим
```

Проверить это по roadmap/repo.

---

# 6. STOREFRONT SOURCE

Отдельно проверить, существует ли уже canonical источник для клиента, пришедшего через **собственную витрину Storefront Partner**.

Не придумывать новый enum/value.

Искать в:

- schema;
- DTO;
- constants;
- frontend options;
- analytics mappings;
- i18n;
- seeds;
- roadmap;
- architecture docs.

Проверить наличие вариантов вроде:

```text
STOREFRONT
WEBSITE
DIRECT
ONLINE
```

или другого существующего canonical значения.

Если отдельного значения нет, ответить:

> Можно ли корректно отличить TravelHub Marketplace acquisition от собственного Storefront acquisition с текущей моделью?

Если нельзя — зафиксировать **DESIGN GAP**, но ничего не добавлять.

---

# 7. MARKETPLACE AUTO-ATTRIBUTION EVENT AUTHORITY

Предыдущий audit установил:

```text
MARKETPLACE auto-attribution = missing
```

Теперь определить **на каком именно business event PCR должен создаваться**.

Не использовать:

```text
page view
browse
open product card
anonymous visit
```

как CRM relationship event без canonical основания.

Исследовать реальные production flows:

```text
request/application
booking
order
message/contact request
checkout
payment
other identified interaction
```

Для каждого показать:

```text
Customer identity available?
Partner identity available?
Business intent established?
PCR currently created?
Suitable as canonical first-contact event?
```

Составить таблицу.

Цель — выбрать уже существующий event authority, при котором система однозначно знает:

```text
customerId
partnerId
```

и существует реальное business interaction.

---

# 8. REQUIRED IDEMPOTENCY RULE

Проверить и предложить canonical rule без реализации:

```text
identified Marketplace interaction
        ↓
resolve Customer
        ↓
resolve Partner
        ↓
find PartnerCustomerRelation(partnerId, customerId)
        │
        ├── NOT EXISTS
        │      → create PCR
        │      → leadSource = MARKETPLACE
        │
        └── EXISTS
               → preserve PCR
               → preserve original leadSource
```

Критически проверить:

```text
existing leadSource MUST NOT be overwritten
```

только потому, что Customer позже воспользовался Marketplace.

Пример:

```text
Customer впервые пришёл к Storefront Pro Partner по PHONE
→ leadSource = PHONE

позже сделал заказ через TravelHub Marketplace
→ PCR уже существует
→ PHONE должен сохраниться
```

если canonical semantics действительно означает **first acquisition source**.

---

# 9. FIRST-SOURCE SEMANTICS

Подтвердить или опровергнуть:

```text
PartnerCustomerRelation.leadSource
=
первоначальный источник появления Customer
в CRM конкретного Partner
```

Не трактовать его как:

```text
source of every interaction
```

Если клиент:

```text
первый контакт = PHONE
второй = EMAIL
третий = MARKETPLACE
```

PCR должен иметь один canonical acquisition source, если именно это является утверждённой семантикой.

Если системе нужна аналитика каналов каждого обращения, это отдельная сущность/event model и **не входит в Step 3.6A без отдельного design decision**.

---

# 10. CURRENT PARTNER UI AUDIT

Проверить runtime отдельно для:

```text
Marketplace Basic Partner
```

и:

```text
Storefront Pro Partner
```

Открыть:

```text
Partner Workspace
→ CRM
→ Customers
→ Create/Add Customer
```

Зафиксировать фактические поля и controls.

Для каждого tier заполнить:

| Capability | Marketplace Basic | Storefront Pro |
|---|---:|---:|
| CRM Customers visible | ? | ? |
| Create Customer button | ? | ? |
| Manual Intake | ? | ? |
| Source selector | ? | ? |
| DIRECT | ? | ? |
| MARKETPLACE | ? | ? |
| PHONE | ? | ? |
| OFFICE | ? | ? |
| EMAIL | ? | ? |
| REFERRAL | ? | ? |
| OTHER | ? | ? |
| Lifecycle | ? | ? |
| Manager assignment | ? | ? |

Не ограничиваться чтением React-кода — нужен runtime/browser evidence.

---

# 11. ENTITLEMENT AUTHORITY

Проверить server-side authority.

Если full/manual CRM является Storefront Pro capability, установить:

```text
BASIC
→ server denial?

PRO + permission
→ allow?

PRO without permission
→ deny?
```

Проверить существующие capability/permission gates.

Frontend-hidden control не считать security boundary.

Нужно отдельно определить:

```text
Marketplace-generated PCR
```

и:

```text
manual CRM intake
```

Это могут быть разные capabilities.

Marketplace Basic может нуждаться в platform-generated customer relationship для Orders/Bookings, даже если manual full CRM intake ему недоступен.

---

# 12. PLATFORM CRM

Подтвердить ещё раз:

```text
Platform Workspace
→ CRM
→ Customers
→ Create Customer
```

создаёт глобальный `Customer`.

Проверить бизнес-назначение этой функции по docs/implementation.

Но в рамках этого задания:

```text
DO NOT add Source
DO NOT remove Create Customer
DO NOT redesign Platform CRM
```

Если business purpose формы недостаточно документирован — отметить отдельным non-blocking architecture question.

---

# 13. SOURCE OPTIONS AUTHORITY

Текущий backend использует convention-based `String?`, а не Prisma enum.

Найти **все фактически используемые значения**:

```text
DIRECT
MARKETPLACE
PHONE
OFFICE
EMAIL
REFERRAL
OTHER
...
```

И источники этих значений:

```text
backend DTO
service defaults
frontend selectors
seed
tests
analytics
i18n
```

Составить matrix:

| Source | Backend recognizes | UI Basic | UI Pro | Automatic | Manual | Canonical meaning |
|---|---:|---:|---:|---:|---:|---|
| MARKETPLACE | ? | ? | ? | ? | ? | ? |
| DIRECT | ? | ? | ? | ? | ? | ? |
| PHONE | ? | ? | ? | ? | ? | ? |
| OFFICE | ? | ? | ? | ? | ? | ? |
| EMAIL | ? | ? | ? | ? | ? | ? |
| REFERRAL | ? | ? | ? | ? | ? | ? |
| OTHER | ? | ? | ? | ? | ? | ? |
| STOREFRONT/other | ? | ? | ? | ? | ? | ? |

---

# 14. CRM ANALYTICS IMPACT

Текущий analytics provenance уже подтверждён:

```text
PartnerCustomerRelation.leadSource
        ↓
AnalyticsService
        ↓
GET /analytics/crm
        ↓
CRM Analytics Source breakdown
```

Проверить, как entitlement-aware source semantics должны интерпретироваться в аналитике.

Например:

### Marketplace Basic

Если все реальные acquisition relationships приходят через TravelHub:

```text
MARKETPLACE ≈ dominant/only platform-generated source
```

Это может быть ожидаемо.

### Storefront Pro

Source breakdown может иметь реальный business смысл:

```text
Marketplace
Storefront
Phone
Office
Email
Referral
Direct
Other
```

Не менять analytics implementation в рамках audit.

---

# 15. REQUIRED BUSINESS SCENARIOS

Проверить минимум следующие сценарии.

### Scenario A — New Marketplace Customer

```text
Customer впервые взаимодействует с Partner через TravelHub
→ PCR отсутствует
→ expected source?
```

### Scenario B — Existing global Customer, new Partner

```text
Customer уже существует в TravelHub
→ впервые взаимодействует с Partner B
→ PCR отсутствует
→ expected source?
```

### Scenario C — Existing PCR

```text
PCR уже существует with source PHONE
→ Customer позже бронирует через Marketplace
→ expected source?
```

### Scenario D — Storefront Pro phone lead

```text
клиент звонит Storefront Pro Partner
→ manager manually creates/adds customer
→ expected source?
```

### Scenario E — Storefront Pro office lead

```text
walk-in customer
→ manual intake
→ expected source?
```

### Scenario F — Own Storefront

```text
Customer приходит через собственную Storefront витрину Partner
→ expected source?
```

Если Scenario F невозможно выразить текущей моделью — зафиксировать design gap.

---

# 16. FINAL VERDICT

После аудита выбрать один verdict.

## VERDICT A

```text
CURRENT SOURCE + ENTITLEMENT MODEL IS CANONICALLY CORRECT
```

Только если текущая реализация уже правильно разделяет Basic/Pro и auto-attribution.

## VERDICT B

```text
MODEL IS SOUND, IMPLEMENTATION GAPS IDENTIFIED
```

Если data model подходит, но нужны конкретные изменения:

- Marketplace auto-attribution;
- entitlement-aware manual intake;
- source selector correction;
- и т.д.

## VERDICT C

```text
SOURCE MODEL REQUIRES DESIGN REMEDIATION
```

Если `leadSource` semantics недостаточна или конфликтует с Marketplace/Storefront model.

## VERDICT D

```text
CANONICAL DOCUMENTATION IS INSUFFICIENT
```

Если repo/roadmap не позволяют безопасно определить Basic vs Pro rules.

---

# 17. REQUIRED OUTPUT

Финальный отчёт должен дать прямые ответы:

1. Что означает `leadSource`?
2. Кто является владельцем поля?
3. Как Source появляется у Marketplace Basic?
4. Может ли Marketplace Basic вручную создавать CRM Customer?
5. Какие source доступны Marketplace Basic?
6. Как Source появляется у Storefront Pro?
7. Какие source доступны Storefront Pro?
8. Нужен ли отдельный `STOREFRONT` source?
9. Какой существующий Marketplace event должен быть authority для auto-attribution?
10. Что происходит при existing Customer + missing PCR?
11. Что происходит при existing PCR?
12. Нужно ли менять Platform Create Customer?  
    Expected unless evidence disproves: **NO**.
13. Какие конкретные implementation GAPs остаются?
14. Что именно должно войти в Step 3.6A implementation?

---

# 18. EVIDENCE

Обязательно приложить:

- roadmap/docs citations by path/section;
- schema/model paths;
- entitlement/capability paths;
- relevant controller/DTO/service paths;
- Marketplace booking/order/request flow paths;
- Partner Intake paths;
- runtime screenshots/evidence for BASIC and PRO;
- relevant API responses/status codes;
- DB evidence;
- source value matrix;
- git status.

---

# 19. GIT SAFETY

Это audit-only задание.

```text
Starting HEAD: <sha>
Final HEAD: <same sha expected>
origin/master: <sha>
Production changes: NONE
```

Не создавать production commit.

Если создаётся только audit report, указать его отдельно.

---

# STOP CONDITION

После финального отчёта остановиться.

**Не начинать implementation автоматически.**

Следующий implementation prompt будет сформирован только после утверждения:

```text
Marketplace Basic source rules
Storefront Pro source rules
Marketplace auto-attribution authority
Storefront source semantics
```
