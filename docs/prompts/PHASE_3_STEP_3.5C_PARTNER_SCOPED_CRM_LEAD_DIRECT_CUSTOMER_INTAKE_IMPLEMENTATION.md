# PHASE 3 — STEP 3.5C — PARTNER-SCOPED CRM
## LEAD & DIRECT CUSTOMER INTAKE / TENANT ISOLATION / CUSTOMER 360 INTEGRATION
## IMPLEMENTATION PROMPT

---

# 1. ЦЕЛЬ

Reconciliation Step 3.5 завершён:

```text
VERDICT A — PHASE 3 STEP 3.5 CRM ARCHITECTURE / CURRENT STATE /
ROADMAP FULLY RECONCILED — READY FOR IMPLEMENTATION
```

Current state уже содержит:

```text
Customer CRUD
search / pagination / status filter
Partner list/detail
Customer 360:
  Overview
  Orders
  Bookings
  Payments
  Relations

PartnerCustomerRelation:
  lifecycle
  leadSource
  tags
  notes
  assignedTo

6 CRM permissions
RU / AZ / EN
```

Но текущий CRM:

```text
PLATFORM-ONLY
```

Главный gap Step 3.5:

```text
Partner-scoped CRM = MISSING
Severity = HIGH
```

Цель Step 3.5C — реализовать безопасный partner-scoped CRM и canonical intake клиентов/лидов партнёром без создания параллельной customer domain model.

---

# 2. PRECONDITION

Перед production implementation подтвердить, что reconciliation report сохранён в repository и canonical roadmap содержит Step 3.5C.

Если reconciliation commit/push ещё не выполнен:

```text
сначала commit/push reconciliation docs only
verify HEAD == origin/master
```

После этого начинать 3.5C.

Не смешивать reconciliation-only commit с implementation commit, если они ещё разделимы.

---

# 3. CORE INVARIANT

```text
PLATFORM CRM
→ platform-wide data within RBAC

PARTNER CRM
→ only customer relationships and commercial data
   belonging to current partner scope
```

Hard security invariant:

```text
Partner A
MUST NOT
read/search/update/enumerate
Partner B CRM relations or partner-private customer data.
```

---

# 4. НЕ СНЯТЬ ПРОСТО PLATFORM-ONLY GUARD

Запрещён implementation вида:

```text
remove PLATFORM-only restriction
→ expose existing platform CRM endpoints to partners
```

Partner access должен иметь server-authoritative scope.

Frontend hiding ≠ authorization.

---

# 5. DOMAIN OWNERSHIP

Сохранить:

```text
Customer identity
≠
PartnerCustomerRelation
```

Global/canonical customer identity не должна бесконтрольно дублироваться на каждого партнёра.

Partner-specific CRM state должен принадлежать relation/scope layer.

---

# 6. EXISTING PartnerCustomerRelation — REUSE FIRST

Reconciliation подтвердил существование:

```text
PartnerCustomerRelation
```

с полями/capabilities:

```text
lifecycle
leadSource
tags
notes
assignedTo
```

Step 3.5C должен сначала использовать эту модель.

Не создавать:

```text
PartnerLead
PartnerCRMCustomer
PartnerContact
```

как новые параллельные сущности без доказанной необходимости.

---

# 7. CUSTOMER vs LEAD

На этом этапе определить runtime semantics на основе existing model.

Preferred invariant, если current schema поддерживает:

```text
Customer
= canonical person/customer identity

PartnerCustomerRelation
= partner-specific CRM relationship
```

`Lead` может быть состоянием relation/lifecycle, а не отдельной duplicate person entity.

Но exact semantics брать из current enum/schema.

Не вводить новый lifecycle enum без evidence.

---

# 8. DIRECT CUSTOMER INTAKE

Partner должен иметь возможность добавить клиента/лида напрямую в свой CRM, если это соответствует reconciled roadmap.

Intake flow должен:

```text
accept minimum identity/contact data
resolve existing customer identity where safe/canonical
create partner relationship
avoid duplicate relation
record leadSource/direct intake source
apply partner scope
audit mutation
```

Exact required fields — из current schema/validation.

---

# 9. DUPLICATE IDENTITY POLICY

Критически определить поведение при совпадении:

```text
email
phone
existing customer identity
```

Не создавать silently второй canonical Customer, если existing architecture предусматривает identity reuse.

Но partner НЕ должен получать чужие private CRM данные только потому, что identity совпала.

---

# 10. SHARED IDENTITY ≠ SHARED CRM DATA

Если один человек является клиентом нескольких партнёров:

```text
Customer identity
        ↓
Partner A relation
Partner B relation
```

Partner A может видеть только разрешённую customer identity + Partner A relationship/commercial context.

Partner A НЕ видит:

```text
Partner B notes
Partner B tags
Partner B assigned employee
Partner B lead source
Partner B orders/bookings
Partner B relationship lifecycle
```

---

# 11. PARTNER CRM LIST

Реализовать partner-scoped Customer/CRM list через existing CRM UI architecture, где возможно.

Минимально сохранить:

```text
search
pagination = project-wide contract
status/lifecycle filters where canonical
```

Dataset:

```text
current partner only
```

---

# 12. PAGINATION

Project-wide pagination уже CLOSED.

Не переделывать.

Partner CRM operational table:

```text
default page size = 20
server-side pagination
filtered total
multi-page navigation when total >20
```

---

# 13. PARTNER CUSTOMER 360

Partner должен иметь Customer 360 только в пределах своего scope.

Reuse existing tabs where semantically valid:

```text
Overview
Orders
Bookings
Payments
Relations
```

Но каждый tab обязан применять partner scope.

---

# 14. OVERVIEW

Partner Overview может показывать:

```text
customer identity/contact fields permitted by RBAC
partner relationship state
lead source
tags
assignedTo
notes summary if canonical
partner-specific aggregates
```

Не показывать platform-private или other-partner data.

---

# 15. ORDERS TAB

Partner Customer 360 → Orders:

```text
ONLY orders belonging to current partner/customer relationship scope
```

Не использовать:

```text
all orders for global customer
```

для partner workspace.

Hard cross-partner isolation test required.

---

# 16. BOOKINGS TAB

Partner Customer 360 → Bookings:

```text
ONLY bookings related to current partner
```

Не показывать бронирования клиента у других поставщиков.

---

# 17. PAYMENTS TAB

Partner payment visibility должна быть ограничена платежами/заказами текущего partner commercial scope.

Не превращать этот tab в Supplier Settlement.

Сохранить:

```text
Customer Payment
≠
Supplier Settlement
≠
Supplier Payout
```

---

# 18. REFUNDS

Reconciliation выявил:

```text
Customer → Refunds not shown
Severity = Medium
Can implement independently
```

Не включать Customer Refunds автоматически в 3.5C, если это увеличивает scope.

Допустимо только минимальное изменение, необходимое для partner-scope security/read model.

Полноценный Refunds tab/section оставить отдельным substep после 3.5C.

---

# 19. RELATIONS TAB

Partner workspace должен видеть:

```text
ONLY current partner relation
```

Platform workspace может сохранять более широкий relation view согласно existing RBAC.

Partner не должен видеть список отношений клиента с другими партнёрами.

---

# 20. NOTES

Если existing `PartnerCustomerRelation.notes` используется:

```text
notes are partner-private
```

Hard invariant:

```text
Partner A notes
not visible to Partner B
```

Platform visibility — только согласно existing canonical permissions.

---

# 21. TAGS

Если tags принадлежат `PartnerCustomerRelation`:

```text
partner-specific
```

Не превращать их автоматически в global Customer tags.

Partner A tags ≠ Partner B tags.

---

# 22. ASSIGNED TO

`assignedTo` должен быть валиден внутри разрешённого workspace/partner employee scope.

Запрещено назначить relation на employee другого partner tenant.

Проверить IDOR.

---

# 23. LEAD SOURCE

Direct intake должен иметь canonical leadSource value, если existing enum поддерживает его.

Не добавлять строковый magic value без schema/enum reconciliation.

Если подходящего source нет:

```text
VERDICT B / documented blocker
```

или минимальная canonical enum extension только после evidence и tests.

---

# 24. RELATION LIFECYCLE

Использовать existing lifecycle.

Проверить:

```text
allowed transitions
who may mutate
whether lifecycle is partner-specific
audit requirements
```

Не создавать новый CRM lifecycle параллельно существующему.

---

# 25. SEARCH

Partner search должен быть server-scoped.

Даже запрос по точному:

```text
email
phone
customer id
```

не должен раскрывать existence/details unrelated customers сверх разрешённого intake/identity-resolution contract.

---

# 26. ANTI-ENUMERATION

Проверить responses для:

```text
customer exists globally but no partner relation
customer belongs to another partner
invalid customer
```

Не создавать unnecessary cross-tenant enumeration channel.

Exact status/error contract должен соответствовать existing security conventions.

---

# 27. PLATFORM BEHAVIOR MUST NOT REGRESS

Existing PLATFORM CRM:

```text
Customer CRUD
Partner list/detail
Customer 360
RBAC
```

должен продолжить работать.

3.5C — extension, не replacement.

---

# 28. WORKSPACE CONTEXT

Использовать canonical hierarchy:

```text
IDENTITY
→ WORKSPACE CONTEXT
→ TENANT / PARTNER SCOPE
→ PLAN / ENTITLEMENTS
→ BUSINESS CAPABILITIES
→ ROLE / PERMISSIONS
```

Partner scope нельзя получать только из query/body.

---

# 29. PARTNER ID SOURCE

Canonical partner identifier должен происходить из authenticated workspace/session context.

FAIL:

```text
GET /crm/customers?partnerId=<arbitrary>
```

если backend доверяет переданному partnerId.

Если platform admin endpoint поддерживает explicit partner filter — это отдельный authorized platform behavior.

---

# 30. RBAC

Reconciliation подтвердил 6 CRM permissions.

Inventory exact permission names и reuse их.

Не создавать duplicate permissions без необходимости.

Partner access должен пройти:

```text
authentication
workspace
entitlement/capability boundary
permission
partner scope
```

---

# 31. ENTITLEMENT BOUNDARY — 3.5D

Reconciliation определил:

```text
CRM entitlement model
Severity = Medium
Step 3.5D
```

Поэтому 3.5C НЕ должен самостоятельно завершать полноценную plan entitlement architecture.

Но нельзя создать security hole до 3.5D.

Использовать current canonical capability/workspace gating и явно документировать временную boundary.

---

# 32. MARKETPLACE BASIC / STOREFRONT PRO

Не менять silently entitlement matrix.

Если canonical architecture говорит:

```text
Marketplace Basic → no/full? CRM
Storefront Pro → Full CRM
```

реализовать только то, что уже разрешено current authority.

Если runtime entitlement authority ещё не умеет это выразить:

```text
document dependency for 3.5D
```

Не hardcode plan names по frontend.

---

# 33. PII

Partner получает только PII, необходимую для legitimate customer relationship.

Проверить existing fields:

```text
name
email
phone
address
other profile fields
```

Не расширять DTO автоматически всеми Customer fields.

---

# 34. CUSTOMER CREATION / UPDATE AUTHORITY

Определить, какие поля partner может:

```text
create
read
update
```

Разделить:

```text
global identity fields
partner relation fields
```

Partner relation mutations не должны давать произвольное право менять global Customer identity.

---

# 35. CONFLICT POLICY

Если partner пытается изменить shared global identity, используем existing canonical policy.

Если её нет — не изобретать silent last-write-wins.

Report gap/blocker.

---

# 36. AUDIT TRAIL

Partner CRM mutations должны быть auditable:

```text
relation created
lifecycle changed
notes changed
tags changed
assignedTo changed
direct customer intake
```

Reuse existing audit/history infrastructure.

---

# 37. CUSTOMER HISTORY

Reconciliation:

```text
CustomerHistory exists
UI not surfaced
Severity = Low
```

3.5C может использовать CustomerHistory для audit persistence, но НЕ обязан реализовывать History UI.

History UI — отдельный follow-up.

---

# 38. DIRECT INTAKE UI

Добавить минимальный partner CRM action, например existing design equivalent:

```text
Добавить клиента
```

или canonical wording из current CRM UX.

Не делать отдельный redesign.

---

# 39. INTAKE FORM

Поля формы — только existing/canonical required data.

Candidate fields НЕ являются автоматическим requirement:

```text
name
email
phone
lead source
notes
tags
assignedTo
```

Сначала сверить DTO/model.

---

# 40. VALIDATION

Использовать server-side validation.

Проверить:

```text
invalid email
invalid phone if normalized
missing required identity
duplicate relation
invalid assignedTo
invalid lifecycle
invalid leadSource
```

No HTTP 500 for validation errors.

---

# 41. DUPLICATE RELATION

Hard gate:

```text
same Partner + same Customer
```

не должен создавать duplicate `PartnerCustomerRelation`.

Проверить DB constraint или transactional service authority.

---

# 42. CONCURRENCY

Проверить concurrent duplicate intake:

```text
two requests
same partner
same customer
```

Canonical result:

```text
one relation
controlled duplicate/idempotent response
```

Не требовать complex distributed locking, если DB unique constraint достаточно.

---

# 43. DIRECT LEAD WITHOUT EXISTING CUSTOMER

Если existing schema требует Customer для relation:

```text
create canonical Customer
+
create PartnerCustomerRelation
```

только в одной корректной transaction boundary.

Если architecture предусматривает другой mechanism — использовать его.

---

# 44. CUSTOMER DISCOVERED THROUGH MARKETPLACE ORDER

Проверить существующий automatic relation creation.

Если customer уже взаимодействовал с partner через marketplace:

```text
не создавать duplicate relation при direct intake
```

Reuse/update existing relation according to canonical lifecycle rules.

---

# 45. CUSTOMER 360 ROUTING

Partner deep link должен быть scoped.

Пример conceptually:

```text
/app/crm/customers/:id
```

может оставаться общим route, если backend authoritative scope гарантирован.

Не обязательно создавать `/partner/...` duplicate route.

---

# 46. 404 vs 403

Следовать existing security convention.

Для чужого customer/relation не раскрывать больше информации, чем позволяет current IDOR policy.

Report actual chosen behavior.

---

# 47. API DESIGN

Prefer extension/reuse existing CRM endpoints.

Не создавать второй parallel API:

```text
/platform-crm/*
/partner-crm/*
```

без необходимости.

Если один endpoint поддерживает workspace-aware scope безопасно — предпочтительно reuse.

---

# 48. QUERY CONTRACT

Partner filters/search/pagination должны применяться server-side:

```text
workspace scope
→ partner scope
→ filters
→ search
→ total
→ pagination
```

Не:

```text
load platform-wide data
→ filter frontend
```

---

# 49. CUSTOMER COUNTS

Любые counts в partner CRM:

```text
orders
bookings
payments
relations
```

должны быть partner-scoped.

Global customer totals нельзя показывать как partner totals.

---

# 50. PLATFORM COUNTS

Platform Customer 360 может сохранять global/platform-authorized aggregates.

Не заменять их partner-scoped counts globally.

---

# 51. FINANCE BOUNDARY

3.5C может показывать existing customer payment facts, доступные current partner scope.

Не реализовывать:

```text
customer payment schedule F.*
supplier settlement S.*
supplier balance
supplier payout
```

---

# 52. COMMUNICATIONS

Reconciliation классифицировал communications integration как Future.

Не включать chat/email omnichannel integration в 3.5C.

---

# 53. UNIFIED ACTIVITY TIMELINE

Future.

Не реализовывать в 3.5C.

---

# 54. CUSTOMER PAYMENT AGGREGATE

Reconciliation классифицировал как Future.

Не добавлять новый aggregate engine.

---

# 55. REFUNDS FOLLOW-UP

После 3.5C отдельным этапом можно реализовать:

```text
Customer → Refunds visibility
```

Не смешивать сейчас, если нет dependency.

---

# 56. I18N

Все новые UI strings:

```text
RU
AZ
EN
```

Raw keys = 0.

---

# 57. PAGINATION REGRESSION

Проверить:

```text
20 default
page >1
search
filters
filtered total
```

для partner CRM list.

Не переделывать shared pagination.

---

# 58. TEST MATRIX — SECURITY

Обязательные tests:

```text
Platform authorized CRM access → PASS
Partner own relation → PASS
Partner own customer detail → PASS
Partner own orders → PASS
Partner own bookings → PASS
Partner own payment facts → PASS

Partner A → Partner B relation → DENY
Partner A → Partner B notes → DENY
Partner A → Partner B tags → DENY
Partner A → Partner B orders → DENY
Partner A → Partner B bookings → DENY
Partner A → Partner B payment facts → DENY

arbitrary partnerId override → DENY/IGNORED
assignedTo foreign partner employee → DENY
```

---

# 59. TEST MATRIX — INTAKE

Обязательные tests:

```text
new customer + new relation
existing customer + new partner relation
existing relation → no duplicate
invalid input
invalid leadSource
invalid lifecycle
concurrent duplicate intake
transaction rollback on relation failure
```

Exact cases adapt to actual model.

---

# 60. TEST MATRIX — SEARCH / ENUMERATION

Проверить:

```text
own customer search
unrelated global customer exact email
other partner customer exact phone
unknown identity
```

No unauthorized data leakage.

---

# 61. TEST MATRIX — PLATFORM REGRESSION

Existing platform CRM tests must continue passing.

Проверить:

```text
Customer CRUD
list/search/pagination
Customer 360
Partner list/detail
existing relations
existing permissions
```

---

# 62. BROWSER VERIFICATION

Проверить реальный flow:

```text
login/switch to permitted partner workspace
open CRM
list partner customers
search
pagination
open Customer 360
Orders
Bookings
Payments
Relations
add direct customer/lead
refresh
verify persistence
```

И cross-partner negative flow.

---

# 63. NO FAKE DATA

Не создавать production/demo fake fields для:

```text
settlement
payout
payment schedule
agreement
activity timeline
```

Seed/test fixture допустим только в isolated test context.

---

# 64. PRODUCTION CODE

Production code changes ожидаются.

Но commit должен содержать только Step 3.5C related changes.

---

# 65. DOCUMENTATION

Обновить canonical CRM architecture/roadmap только в части фактически реализованного 3.5C.

Не отмечать 3.5D/Future gaps как completed.

---

# 66. STATUS AFTER SUCCESS

После успешного 3.5C:

```text
Step 3.5 base  → IMPLEMENTED
3.5A           → IMPLEMENTED
3.5B           → IMPLEMENTED
3.5C           → IMPLEMENTED
3.5D           → PLANNED — NOT STARTED
Refund UI      → remaining independent gap
History UI     → remaining independent gap
Future finance/activity/comms → PLANNED
```

Exact naming reconcile with roadmap.

---

# 67. REPORT FILE

Создать:

```text
docs/prompts/PHASE_3_STEP_3.5C_PARTNER_SCOPED_CRM_LEAD_DIRECT_CUSTOMER_INTAKE_IMPLEMENTATION_REPORT.md
```

---

# 68. REQUIRED REPORT — DATA SCOPE

| Surface | PLATFORM | PARTNER | Cross-partner protected? | Evidence |
|---|---|---|---|---|
| CRM list | | | | |
| Customer detail | | | | |
| Orders | | | | |
| Bookings | | | | |
| Payments | | | | |
| Relations | | | | |
| Notes | | | | |
| Tags | | | | |

---

# 69. REQUIRED REPORT — INTAKE

| Scenario | Expected | Actual | PASS |
|---|---|---|---|
| New identity | | | |
| Existing identity | | | |
| Existing relation | | | |
| Duplicate concurrent intake | | | |
| Invalid input | | | |
| Foreign assignedTo | | | |

---

# 70. REQUIRED REPORT — REMAINING GAPS

Report explicitly:

```text
3.5D entitlement
Customer Refunds UI
Customer History UI
Customer payment aggregate
Unified activity timeline
Communications
F.1–F.13
S.1–S.19
```

with statuses.

---

# 71. HARD ACCEPTANCE CRITERIA

VERDICT A только если:

1. Partner CRM is accessible only through authorized workspace context.
2. Partner dataset is server-scoped.
3. Partner A cannot enumerate/read Partner B CRM data.
4. Partner A cannot read Partner B notes.
5. Partner A cannot read Partner B tags.
6. Partner A cannot read Partner B orders.
7. Partner A cannot read Partner B bookings.
8. Partner A cannot read Partner B payment facts.
9. PartnerCustomerRelation reused unless evidence required schema change.
10. No parallel duplicate CRM domain created.
11. Direct customer intake works.
12. Existing customer identity reuse works according to canonical policy.
13. Shared identity does not expose shared partner-private CRM state.
14. Duplicate PartnerCustomerRelation prevented.
15. Concurrent duplicate intake controlled.
16. Intake transaction integrity proven.
17. leadSource uses canonical model.
18. lifecycle uses canonical model.
19. assignedTo is partner-scoped.
20. Partner CRM list search works.
21. Pagination remains default 20.
22. Filtered total correct.
23. Partner Customer 360 works.
24. Orders tab is partner-scoped.
25. Bookings tab is partner-scoped.
26. Payments tab is partner-scoped.
27. Relations tab does not reveal other partner relations.
28. Platform CRM does not regress.
29. Existing 6 CRM permissions reconciled/reused.
30. PII exposure minimized to authorized fields.
31. Anti-enumeration behavior verified.
32. CustomerHistory/audit records relevant mutations.
33. RU/AZ/EN PASS.
34. Raw i18n keys = 0.
35. F.1–F.13 remain NOT STARTED.
36. S.1–S.19 remain NOT STARTED.
37. No Supplier Settlement implementation.
38. No Supplier Payout implementation.
39. No unified activity timeline implementation.
40. No communications scope creep.
41. No customer payment aggregate scope creep.
42. Relevant backend tests PASS.
43. Relevant frontend tests PASS.
44. Backend TSC PASS.
45. Frontend TSC PASS.
46. Backend build PASS.
47. Frontend build PASS.
48. Browser positive flow PASS.
49. Browser cross-partner negative flow PASS.
50. Documentation/roadmap updated accurately.
51. Unrelated files committed = 0.
52. Push complete.
53. HEAD == origin/master.

---

# 72. VERDICT

Только если все hard gates закрыты:

```text
VERDICT A — PHASE 3 STEP 3.5C PARTNER-SCOPED CRM / LEAD & DIRECT CUSTOMER INTAKE IMPLEMENTED AND SECURITY-RECONCILED
```

Иначе:

```text
VERDICT B — PHASE 3 STEP 3.5C INCOMPLETE / PARTNER CRM NOT SAFE FOR RELEASE
```

---

# 73. FINAL RESPONSE FORMAT

```text
VERDICT:

Precondition / reconciliation commit:

Architecture:
Customer identity authority:
PartnerCustomerRelation:
Lead semantics:
Direct intake:

Workspace scope:
Platform CRM:
Partner CRM:
Cross-partner isolation:

CRM list:
Customer 360:
Overview:
Orders:
Bookings:
Payments:
Relations:

Notes:
Tags:
AssignedTo:
LeadSource:
Lifecycle:

RBAC:
Entitlement boundary:
PII:
Anti-enumeration:
Audit/history:

Pagination:
Search:
Filters:
i18n:

Security tests:
Intake tests:
Platform regression:
Frontend tests:
Backend tests:
Backend TSC:
Frontend TSC:
Backend build:
Frontend build:
Browser:

Production code changed:
DB/schema changed:
Migration:
Files changed:

Roadmap status:
3.5C:
3.5D:
Refund UI:
History UI:
Future capabilities:

Commit:
HEAD:
origin/master:
HEAD == origin/master:
Unrelated files:

Remaining findings:
Next canonical stage:
```

---

# 74. STOP

После Step 3.5C report:

```text
STOP
```

Не запускать автоматически:

```text
Step 3.5D
Customer Refunds UI
Customer History UI
F.1–F.13
S.1–S.19
```

Сначала review результата 3.5C.
