# PHASE 3 — PRE-STEP 3.12 — D5 — ORDER FULL-PAGE DETAIL + NAVIGATION CONSISTENCY + ACTION/STATE-MACHINE CONSISTENCY + EDITING/MUTABILITY CONTRACT + CROSS-CUTTING ENTITY CHANGE AUDIT FRAMEWORK — IMPLEMENTATION

## ROLE — MANDATORY

Ты работаешь как **Senior/Staff Full-Stack Software Engineer + Software Architect + Backend Engineer + Frontend Engineer + Database Engineer + Security Engineer + QA Engineer**.

Это production-grade implementation stage. Existing code, legacy drawer, текущие UI-паттерны и предыдущие reports — evidence, но не canonical business truth.

Обязательные правила: сначала Architecture / State Machine / Mutability Audit, потом implementation; root cause перед remediation; server-side authority обязательна; UI hiding не считается authorization; runtime/browser evidence важнее source claim; не начинать D6; не менять KPI semantics D11; не реализовывать Partner Workspace Order Center; не делать полный reset dev DB; не выдавать VERDICT A до прохождения DB → API → UI → Runtime → Audit History → Git gates.

## LANGUAGE REQUIREMENT — MANDATORY

Все Implementation Report, Evidence / Runtime Report, architecture decisions, findings, root-cause analysis, security findings, mutability matrix, audit framework documentation, conclusions и verdict explanations должны быть преимущественно **на русском языке**. English разрешён только для technical identifiers, code, paths, endpoints, HTTP/status/enum/permission identifiers, CLI/Git commands, commit messages и standardized VERDICT strings. Если итоговый report преимущественно английский — implementation incomplete. Никаких plaintext passwords, tokens, full passport numbers или иных sensitive PII в reports/evidence.

# 1. BASELINE / TRUE NEXT

D4 полностью закрыт:

```text
D4 — ACCEPTED
D4 REMEDIATION — CLOSED
Final D4 closure SHA:
635f9310cfd18201a493fab05c4f1d90fe36bc7c
```

TRUE NEXT:

```text
D5 — ORDER FULL-PAGE DETAIL
     + NAVIGATION CONSISTENCY
     + ACTION/STATE-MACHINE CONSISTENCY
     + EDITING/MUTABILITY CONTRACT
     + CROSS-CUTTING ENTITY CHANGE AUDIT FRAMEWORK INTEGRATION
```

D6 — NOT STARTED.

# 2. KNOWN D5 RUNTIME DEFECT

Один и тот же Order ранее показывал разный action surface в зависимости от entry point.

Known example:

```text
Order: MKT-ORD-00000266
Status: NEW / Новый
```

Legacy Order Center drawer:

```text
[Принять в работу]
[Отменить]
```

Canonical full-page `/app/orders/{id}` не показывал эквивалентные actions.

Hard invariant:

```text
SAME ORDER
+ SAME USER
+ SAME WORKSPACE
+ SAME STATUS
+ SAME PERMISSIONS
=
SAME AVAILABLE ACTIONS
```

Нельзя иметь business-action logic, живущую только в drawer.

# 3. D5 CANONICAL UX CONTRACT

`/app/orders/{id}` — единственная каноническая full-page detail surface для Order.

Любой normal business identifier click `MKT-ORD-*` из Order Center, Request detail, Booking relation, CRM, Analytics, History/Audit, search results и linked entity cards должен открывать `/app/orders/{id}`.

Drawer может существовать только как explicit `Quick Preview` и не должен быть default navigation по business identifier. Drawer не имеет права владеть уникальным business action, которого нет на canonical full-page.

# 4. DO NOT BUILD FULL-PAGE FROM ZERO

Full-page Order detail уже существует. D5 должен:

```text
audit
→ requalify
→ complete
→ normalize
```

существующую страницу. Не создавать параллельный второй Order detail.

# 5. CANONICAL ARCHITECTURE CHECK — BEFORE CODE

Перед implementation проверить actual:

```text
OrderStatus enum
Order lifecycle/state machine
available backend Order actions
permissions
workspace/scope rules
payment dimension
booking relation
traveler lifecycle
finalConfirmedAt gate
accepted/frozen commercial snapshot
legacy/non-D3 Orders
Marketplace vs Storefront scope
```

Не invent statuses/transitions. Отдельно задокументировать actual current OrderStatus values, allowed transitions, terminal states, booking-eligibility states, payment independence, cancellation behavior, completion/close behavior.

# 6. ORDER STATE MACHINE — SERVER AUTHORITY

Нужно определить единый server-side source of truth для доступных actions. `GET /orders/:id` или dedicated action capability projection должна возвращать/позволять вычислить server-authoritative `availableActions`.

Hard requirement:

```text
Action availability =
Current Status
+ Lifecycle Gates
+ Permissions
+ Workspace Scope
+ Business Invariants
```

Frontend не должен самостоятельно изобретать state-machine mapping.

# 7. ACTION INVENTORY

Audit actual backend actions. Минимально проверить semantics:

```text
process / accept into work
confirm
send to booking
cancel
complete
close
```

и любые другие реальные actions.

Для каждого зафиксировать source status, target status, required permission, lifecycle gates, forbidden conditions, side effects, linked Booking behavior, payment implications, idempotency/concurrency behavior. Не добавлять action только потому, что он визуально кажется логичным.

# 8. FULL-PAGE ACTION BAR

На `/app/orders/{id}` реализовать единый action area. Для текущего Order показывать только server-authorized actions. Для NEW пример `[Принять в работу] [Отменить]` допустим только если это подтверждено actual state machine.

Hard:

```text
disabled button ≠ authorization
hidden button ≠ authorization
```

Direct API forbidden action должен быть отклонён server-side.

# 9. DRAWER / FULL-PAGE ACTION PARITY

Если drawer остаётся:

```text
same API/state-machine source
same permission source
same availableActions
```

Никаких независимых `drawerActionMap` и `fullPageActionMap` business rules.

Добавить automated regression: same Order + same actor → drawer actions == full-page actions.

# 10. NAVIGATION CONSISTENCY

Hard rule:

```text
MKT-ORD-* clicked from anywhere
→ /app/orders/{id}
```

Quick Preview должен быть отдельным explicit control/icon.

# 11. REQUEST → ORDER RELATION

D3 canonical relation:

```text
Request.convertedOrderId
→ Order.id
```

Не парсить business reference. Request detail CTA `Продолжить оформление` / `Открыть заказ` должен вести на `/app/orders/{order.id}`. Проверить direct URL, hard refresh, browser back.

# 12. ORDER → BOOKING RELATION

V1 canonical:

```text
1 Order = 1 Booking
```

Проверить relation по реальному `orderId`. Известный предыдущий дефект foreign seller bookings уже был исправлен в D3.

D5 обязан сохранить:

```text
Связанная бронь
→ exactly linked Booking for this Order
```

Если отдельный seller-level список существует, он должен быть явно отличим как `Другие бронирования продавца`.

# 13. ORDER DETAIL INFORMATION ARCHITECTURE

Минимум requalify:

```text
Header
Order reference
Status
Payment status
Customer
Seller / Partner
Commercial item(s)
Amounts
Travelers
Linked Request
Linked Booking
Notes
Lifecycle timestamps
Actions
Change History
```

Не дублировать contradictory data.

# 14. CUSTOMER ≠ PAYER ≠ TRAVELER

Hard:

```text
Customer ≠ Payer ≠ Traveler
```

Order detail должен использовать правильные labels и источники. Не fallback-ить traveler из Customer. D3 traveler rules сохраняются.

# 15. PAYMENT DIMENSION IS SEPARATE

Order business status и payment status — независимые dimensions. Не смешивать `OrderStatus` и `PaymentStatus` в один enum/UI status. D7 отдельно глубже requalify payment/refund semantics. D5 только корректно показывает существующие authoritative values.

# 16. EDITING / MUTABILITY CONTRACT — CORE D5

Нужен не «Edit whole Order», а canonical field-level mutability.

Hard principle:

```text
CAN EDIT?
   ↓
Entity
+ Field
+ Current Status
+ Lifecycle Gate
+ Permission
+ Workspace/Tenant Scope
   ↓
ALLOW / DENY
```

# 17. ORDER FIELD MUTABILITY MATRIX — REQUIRED

До UI implementation создать фактическую matrix:

| Field / Section | Editable? | Allowed Statuses | Lifecycle Gate | Permission | Reason |
|---|---|---|---|---|---|

Audit минимум:

```text
customer/contact fields
notes
internal notes if any
commercial item/product
price
currency
quantity/travelerCount
sellerPartner
accepted terms snapshot
traveler data
payment-related fields
booking relation
acquisitionSource
referenceNumber
status
timestamps
```

Server-owned fields не editable обычным user edit flow.

# 18. FROZEN COMMERCIAL SNAPSHOT

Для Request-origin Order accepted commercial facts не должны быть casually editable после acceptance. Проверить actual D1/D3 snapshot contract.

Кандидаты на immutable/frozen:

```text
product
accepted price
currency
travelerCount
accepted terms
pinned requirements
supplier/seller identity
acceptance timestamps
commerceSequence
```

Не делай их editable без explicit canonical amendment/repricing/rebooking contract. Если система не поддерживает amendment flow: `LOCK`, а не fake Edit.

# 19. TRAVELER EDITING

D4 canonical invariant:

```text
finalConfirmedAt == NULL
→ traveler edit may be allowed
finalConfirmedAt != NULL
→ traveler data immutable via ordinary edit flow
```

До final confirm `[Редактировать данные туристов]` может быть доступно при permissions. После final confirm — read-only. Direct API denial должен сохраняться.

# 20. NOTES

Определить semantics notes. Если notes — действительно mutable operational field, edit separately и изменение должно попадать в audit framework. Не использовать notes как uncontrolled replacement для structured fields.

# 21. EDIT UX

Preferred section-level editing, а не giant edit form. Например:

```text
Основная информация      [Редактировать]
Коммерческие условия     [Заблокировано]
Туристы                  [Редактировать] / [Заблокировано]
Финансы                  read-only
Примечания                [Редактировать]
```

Exact controls зависят от mutability matrix.

# 22. SERVER-SIDE EDIT CONTRACT

Каждый editable field должен иметь server validation. Hard:

```text
UI editability
==
API editability
```

Если UI скрыт, direct forged PATCH всё равно должен быть denied. Использовать DTO whitelist / anti-mass-assignment. Не создавать generic `PATCH /orders/:id { ...any field... }`, позволяющий обходить lifecycle contract.

# 23. CROSS-CUTTING ENTITY CHANGE AUDIT FRAMEWORK — ARCHITECTURE

D5 — первая интеграция framework, но дизайн должен быть cross-cutting, не Order-only hack.

Framework минимум должен быть пригоден для:

```text
Request
Order
Booking
```

D5 реализует Order integration и reusable core.

# 24. EXISTING AUDIT / HISTORY INVENTORY — REQUIRED FIRST

До создания новой таблицы проверить существующие audit tables, event tables, outbox, status history, Order history, Request history, Booking history, security audit, event bus records.

Для каждого определить purpose, immutability, structure, actor, timestamp, old/new support, tenant/workspace, PII handling, transactionality, retention.

Решить: `REUSE`, `EXTEND` или `CREATE COMMON FRAMEWORK`. Не создавать дублирующую систему без audit существующей архитектуры.

# 25. AUDIT EVENT TYPES

Framework должен различать минимум:

```text
FIELD_CHANGE
LIFECYCLE_ACTION
SYSTEM_ACTION
```

FIELD_CHANGE: `field`, `oldValue`, `newValue`.

LIFECYCLE_ACTION: `action`, `fromStatus`, `toStatus`.

SYSTEM_ACTION — корректный actor/source для автоматических изменений.

# 26. MINIMUM AUDIT RECORD

Logical model минимум:

```text
id
entityType
entityId
eventType
field/action
oldValue
newValue
fromStatus
toStatus
changedAt
changedBy
workspace/context
source
reason/comment
correlationId if available
```

Не обязательно одна flat table — design выбрать после audit. Semantic coverage обязательна.

# 27. IMMUTABILITY OF HISTORY

History ordinary user не может edit/delete/rewrite.

Hard invariant:

```text
business mutation succeeds
↔
corresponding audit event persists
```

Не допускается Order changed but history missing или history says changed but transaction rolled back.

# 28. TRANSACTIONALITY

Business mutation и audit event должны быть transactionally coupled: same DB transaction или guaranteed transactional outbox, если он уже canonical и действительно обеспечивает consistency. Не использовать fire-and-forget event, который может потеряться после successful mutation.

# 29. ACTOR IDENTITY

Audit должен различать human actor, system actor, background worker, integration. Для human actor минимум: `userId`, display identity if projected, role/context where useful. Не сохранять redundant sensitive identity fields без необходимости.

# 30. SOURCE / CONTEXT

Для изменения хранить structured source, например:

```text
ORDER_FULL_PAGE
ORDER_QUICK_PREVIEW
API
SYSTEM
INTEGRATION
```

или эквивалентную semantics.

# 31. REASON / COMMENT

Для критичных actions reason/comment может быть mandatory. Audit actual requirements для cancel, manual correction, exceptional operational changes. Не придумывать обязательный reason для каждого trivial edit.

# 32. PII-SAFE AUDIT — HARD SECURITY RULE

Нельзя бездумно сохранять full old/new PII. Особенно:

```text
passportNumber
birthDate
passportExpiry
phone
email
```

где sensitivity требует masking/redaction.

Hard:

```text
Audit history
must not become a second uncontrolled PII database.
```

# 33. NO SECRETS IN AUDIT

Never audit password, passwordHash, token, refreshToken, Authorization header, API key, secret, raw payment credential. Нужен deny-list / safe serialization contract.

# 34. AUDIT VIEW PERMISSIONS

Audit history itself может содержать sensitive operational context. Нужен server-side permission. Не предполагать `order.read → automatically all audit internals`. Определить existing/reusable permission или добавить appropriate permission только после audit каталога.

# 35. ORDER HISTORY API

Создать/requalify API для history:

```text
Order-scoped
tenant/workspace-aware
server-authorized
paginated
stable ordering
```

Preferred ordering `changedAt DESC` + deterministic tie-breaker. Не возвращать unlimited history.

# 36. ORDER HISTORY UI

Full-page Order должен иметь `История изменений`, read-only, с actor/date/human-readable field labels. Можно `[Показать все изменения]` для pagination/load more. Не использовать raw JSON dump как основной UX.

# 37. HISTORY INITIAL BASELINE

Для legacy Orders не backfill fake field-level history, если old values неизвестны. Допустимо `history available from framework activation forward` с честным UI. Не генерировать fictional historical edits.

# 38. EDIT → AUDIT INTEGRATION

Для каждого D5-enabled Order edit:

```text
validate
→ authorize
→ lifecycle mutability check
→ transaction
→ update
→ structured audit event
→ commit
```

После save UI должен показать новое audit событие.

# 39. ACTION → AUDIT INTEGRATION

Business actions также должны попасть в lifecycle history. Минимум для реальных full-page actions: process, cancel, confirm, send-to-booking, complete, close. Не создавать отдельную несовместимую action-history систему.

# 40. DENIED MUTATION → NO BUSINESS CHANGE AUDIT

Negative test:

```text
denied edit/action
→ entity unchanged
→ NO successful FIELD_CHANGE/LIFECYCLE_ACTION event
```

Security audit denial, если существует, может быть отдельным событием, но не successful business mutation.

# 41. CONCURRENCY / VERSIONING

Audit existing optimistic locking/version behavior. Concurrent edits не должны silently overwrite each other. Не использовать audit history как замену concurrency control.

# 42. MARKETPLACE / STOREFRONT SCOPE

D4 closure закрепил: Platform Marketplace contract does not expose Storefront customer commerce. D5 не должен регрессировать это.

Full-page:

```text
Platform → Storefront Order UUID
→ 404
```

Entity Change Audit API также должен соблюдать same scope. Нельзя через `/orders/:sfId/history` обойти D4 isolation.

# 43. PARTNER WORKSPACE — DEFER

Не реализовывать Partner Order Center, Partner own-commerce Order detail, PARTNER order.read, new Storefront operational routes. Это PD-1 debt / future Partner Workspace stage. D5 — Platform Order full-page contract.

# 44. LEGACY / NON-D3 ORDER

Поддержать legacy Orders, где `pinnedRequirements == NULL` или historical semantics отличаются. Но не использовать legacy behavior для ослабления canonical D3 Orders.

# 45. REPRESENTATIVE ORDER CASES FOR D5

Использовать существующие permanent cases, не reset DB:

```text
CASE A
MKT-ORD-09000547
NEW
finalConfirmedAt = NULL
2 OrderTraveler
editable traveler flow
```

```text
C1
MKT-ORD-09000847
READY_FOR_BOOKING
finalConfirmedAt != NULL
2 COMPLETE travelers
immutable traveler data
```

```text
C6
MKT-ORD-09000949
CANCELLED
payment/refund chain exists
```

Плюс suitable legacy Order для backward compatibility.

# 46. ACTION STATE REPRESENTATIVE COVERAGE

Подобрать реальные Orders по каждому supported action state. Не менять статусы direct SQL ради UI screenshots. Если нужного state нет — isolated e2e fixture через domain commands или additive permanent case только если действительно полезно.

# 47. EDITABLE FIELD REPRESENTATIVE COVERAGE

Нужен минимум один Order, где разрешён edit. Проверить edit field → save → hard refresh → persists → audit event exists → actor/date/old/new correct or safely redacted.

# 48. IMMUTABLE FIELD NEGATIVE COVERAGE

Попытаться изменить frozen field. Expected: UI no edit control + direct API denied + DB unchanged + no successful audit mutation event.

# 49. POST-FINAL TRAVELER LOCK COVERAGE

Для C1: traveler edit UI absent/disabled, direct PATCH → 409, history no successful traveler FIELD_CHANGE. Сохранить D4 concurrency fix.

# 50. BUSINESS ACTION COVERAGE

Для минимум одного Order с available action: full-page shows action → execute → server accepts → status updates → audit lifecycle event created → hard refresh persists. Для destructive/terminal action использовать isolated e2e или dedicated safe fixture.

# 51. CANCEL ACTION

Audit actual cancel semantics. Если cancellation требует reason/refund handling/booking compensation — respect current domain behavior. D7 глубже рассмотрит Payment/Refund semantics, но D5 не должен создавать contradictory cancel shortcut.

# 52. LINKED BOOKING CTA

Если Order уже имеет Booking:

```text
Открыть бронирование
→ /app/bookings/{id}
```

D6 будет requalify Booking page позже. D5 только обеспечивает correct relation/navigation.

# 53. TEMPORAL VISIBILITY — LIMITED D5

D8 будет project-wide temporal visibility. Но D5 detail не должен скрывать critical existing Order lifecycle timestamps, если они authoritative и доступны. Минимум audit: createdAt, termsAcceptedAt, finalConfirmedAt, fulfilledAt, closedAt, cancelledAt if modeled. Missing → `—`, не substitute `updatedAt`.

# 54. ORDER FINANCIAL PRESENTATION — LIMITED D5

D7 later canonicalizes Total/Paid/Refunded/Outstanding. В D5 не переписывать finance semantics; не рассчитывать новые formulas на frontend; использовать existing authoritative backend projections; не смешивать Order status с payment status. Если текущая full-page показывает противоречивые суммы — Finding, не silent invention.

# 55. BUSINESS REFERENCE

Order canonical business reference `MKT-ORD-*` display в header. Internal UUID может использоваться route-wise, но не заменяет business reference в UX.

# 56. ACCESSIBILITY / UX BASICS

Actions: clear labels, loading state, prevent double submit, success/error feedback. Editing: cancel/save/validation/dirty-state handling. Audit history: readable timestamps, actor, human-readable field labels. Destructive actions — confirmation согласно existing UX standard.

# 57. I18N

Никаких raw keys. Проверить RU минимум. Если проект поддерживает AZ/EN — добавить ключи по existing pattern. Не создавать hardcoded Russian в shared components, если система использует i18n.

# 58. API ERROR SEMANTICS

Использовать consistent 403 forbidden, 404 scope hiding, 409 lifecycle conflict, 422 validation/forbidden keys. Не превращать ошибки в generic 500.

# 59. AUDIT FRAMEWORK DATA MODEL MIGRATION

Если нужна новая DB schema: migration additive, production-safe, indexes для entity lookup + changedAt, tenant/workspace support, no destructive rewrite, fresh DB migration pass, dev DB migration pass. Не хранить unbounded arbitrary JSON без documented schema/security policy. Если JSON diff выбран — allowlisted structure.

# 60. AUDIT INDEXING

Минимум обеспечить performant history query по `entityType + entityId + changedAt` и нужный tenant/workspace constraint.

# 61. AUDIT PAGINATION

History API: default page size, max page size, stable sort, total или next cursor — по project conventions.

# 62. AUDIT FIELD LABEL MAPPING

Backend хранит stable technical field names. Frontend map-ит их на локализованные labels. Не хранить localized human label как canonical DB field identifier.

# 63. AUDIT OLD/NEW VALUE SERIALIZATION

Нужен safe deterministic serializer для string/number/decimal/boolean/date/enum/nullable. Sensitive fields — redaction. Complex object diff — explicit field-level projection, а не giant raw before/after snapshot.

# 64. NO AUDIT OF DERIVED DISPLAY VALUES

Не создавать field-change audit на localized label, formatted money, computed UI field. Audit business source data/action.

# 65. ACTION HISTORY VS FIELD HISTORY

Если action меняет status, `LIFECYCLE_ACTION` может содержать fromStatus/toStatus/action. Не обязательно создавать redundant `FIELD_CHANGE status`, если canonical design решает избежать дубля. Document decision.

# 66. REQUEST / BOOKING FUTURE REUSE

Reusable core не должен зависеть от Order-specific implementation настолько, что D6 придётся писать вторую систему. Нужен generic audit core + Order integration, пригодный для последующего Booking/Request reuse.

# 67. EXISTING OUTBOX / EVENT BUS

Если используется Outbox/EventBus: не смешивать integration events и immutable user-visible audit без analysis; audit должен сохраняться гарантированно; internal event payload не должен содержать unnecessary PII; если reuse невозможен — документировать почему.

# 68. SECURITY AUDIT VS BUSINESS CHANGE AUDIT

Различать Security audit и Business entity change audit. Если обе системы нужны — определить boundaries.

# 69. PERMISSION MODEL FOR EDITING

Audit existing permissions. Не добавлять generic `order.edit`, если already exists granular permission/action mapping. Если нужен новый permission, синхронизировать constants, DB, migration, role grants, fresh DB, runtime. Не повторить D4 finance permission drift.

# 70. ROLE COVERAGE

Минимум определить Order detail/actions/edit/history behavior для relevant Platform roles:

```text
ADMIN
DIRECTOR
OPERATOR
SALES_MANAGER
FINANCE
ANALYST
MARKETER
MODERATOR
```

Matrix:

| Role | Read | Actions | Edit | History | Notes |
|---|---|---|---|---|---|

Server-side evidence.

# 71. DIRECT URL ACCESS

Проверить authorized `/app/orders/{id}` → detail; unauthorized → correct denial; Storefront UUID in Platform → 404; invalid UUID → 404; valid but nonexistent → 404. Не leaking existence.

# 72. HARD REFRESH

Full-page must survive direct URL, reload, browser back/forward без зависимости от registry transient state.

# 73. LOADING / EMPTY / ERROR STATES

Нужны loading, not found, forbidden if applicable, API error, no booking yet, no history yet, legacy no pinned requirements. Не показывать raw exception.

# 74. TESTING — BACKEND

Добавить/обновить automated tests минимум:

```text
available actions by state
action permission denial
action lifecycle transition
edit allowed field
edit forbidden field
frozen snapshot denial
post-final traveler denial
history creation
history actor/time
history field diff
PII-redacted audit
denied edit → no successful audit event
history tenant/scope isolation
history pagination
Storefront history isolation
```

# 75. TESTING — FRONTEND

Минимум:

```text
business identifier routes to full-page
actions rendered from server contract
same action source reused by drawer/full-page
edit control visible only when allowed
save updates value
read-only sections stay locked
history renders structured events
loading/error/empty states
```

# 76. BROWSER E2E — MANDATORY

Live browser run минимум:

1. Login Platform authorized actor.
2. Open Orders registry.
3. Click business reference.
4. Confirm route `/app/orders/{id}`.
5. Confirm full-page actions for selected state.
6. Execute one safe supported action on dedicated test case.
7. Hard refresh and verify status.
8. Verify lifecycle history entry.
9. Edit one allowed field on editable test case.
10. Hard refresh.
11. Verify new value.
12. Verify field-change history old/new/actor/date.
13. Try frozen field / post-final traveler negative path.
14. Confirm no successful audit event.
15. Open linked Booking CTA if present.
16. Direct Storefront Order UUID → 404.
17. Quick Preview if retained does not own unique actions.

Сохранить screenshots/evidence.

# 77. DB → API → UI → AUDIT RECONCILIATION

Для минимум одного field edit:

```text
DB value = API value = UI value
Audit.oldValue/newValue = actual before/after
```

Для lifecycle action:

```text
DB status = API status = UI status = Audit fromStatus/toStatus
```

# 78. AUDIT PII NEGATIVE PROOF

Для sensitive field change fixture, если возможно безопасно: DB business entity may contain synthetic full value; Audit/API/UI history must NOT contain full plaintext sensitive value. Use synthetic data only.

# 79. TRANSACTION FAILURE TEST

Доказать: business update fails/rolls back → audit event does not persist as successful change; successful change → audit event exists.

# 80. SCOPE FAILURE TEST

```text
Platform actor requests history for Storefront Order
→ 404 / no exposure
```

History API не должен стать обходом D4.

# 81. ACTION CONCURRENCY / DOUBLE CLICK

Проверить existing idempotency/CAS behavior для action button. Frontend disable during request. Backend защищает invalid duplicate transition.

# 82. LEGACY DRAWER MIGRATION DECISION

После audit выбрать:

```text
A. Drawer retained as Quick Preview
```

или

```text
B. Drawer removed/deprecated
```

Если A — same read/action providers. Если B — remove dead routes/state safely. Document architecture decision.

# 83. NO D11 KPI REMEDIATION

Не исправлять в D5 Order KPI partition/status semantics. D5 не должен hardcode новый status mapping, конфликтующий с D11.

# 84. NO D12 CRM/ANALYTICS REMEDIATION

Не исправлять Active Customers/CRM routing mismatch и related D12 issues.

# 85. NO D7 FINANCE REWRITE

Не переписывать payment/refund semantics кроме consistency существующего display.

# 86. ROADMAP / ARCHITECTURE SYNC

D5 вводит cross-cutting framework implementation. Обязательно обновить canonical architecture/roadmap additive, если появились new Audit entity/table/service, new permissions, new edit contract, new action capability contract, new lifecycle interpretation.

Roadmap должен показать:

```text
D5 implementation status
Entity Change Audit Framework foundation
D6 reuses same framework
Request requalification still pending if not included
```

# 87. DOCUMENTATION — ENTITY CHANGE AUDIT FRAMEWORK

Создать canonical architecture doc, если такого ещё нет, например:

```text
docs/architecture/ENTITY_CHANGE_AUDIT_FRAMEWORK.md
```

Минимум: Purpose, Scope, Entities, Event types, Data model, Transactionality, Actor model, Source/context, Field diff, Lifecycle event, PII handling, Permission/scope, Pagination, Immutability, Legacy behavior, Order integration, Booking future integration, Request future/requalification, Testing invariants, Non-goals.

# 88. REQUIRED D5 IMPLEMENTATION REPORT

Создать:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_D5_ORDER_FULL_PAGE_ACTIONS_EDITING_AUDIT_IMPLEMENTATION_REPORT.md
```

Минимальная структура:

1. Executive Summary
2. Starting Git State
3. Canonical Architecture Check
4. Existing Order State Machine Audit
5. Existing Navigation Audit
6. Existing Drawer vs Full-Page Root Cause
7. Canonical Full-Page Contract
8. Action Inventory
9. Action Authority Implementation
10. Navigation Remediation
11. Order Detail Information Architecture
12. Mutability Matrix
13. Editing API Contract
14. Frozen Snapshot Enforcement
15. Traveler Edit Enforcement
16. Existing Audit Infrastructure Inventory
17. Entity Change Audit Framework Architecture
18. DB Schema / Migration
19. Transactionality
20. PII-safe Audit
21. Order Field Change Integration
22. Order Lifecycle Action Integration
23. Audit API
24. Audit UI
25. Role/Permission Matrix
26. Marketplace/Storefront Isolation
27. Legacy Order Compatibility
28. Automated Backend Tests
29. Frontend Tests
30. Browser Runtime Evidence
31. DB→API→UI→Audit Reconciliation
32. Regression
33. Roadmap/Architecture Sync
34. Findings Matrix
35. Acceptance Matrix
36. Git Closure
37. Final Verdict
38. TRUE NEXT

# 89. FINDINGS MATRIX — REQUIRED

| ID | Severity | Surface | Finding | Root Cause | Remediation | Evidence | Status |
|---|---|---|---|---|---|---|---|

Не скрывать pre-existing issues.

# 90. ACCEPTANCE MATRIX — HARD

| Gate | Result | Evidence |
|---|---|---|
| Starting worktree clean | | |
| HEAD == origin/master | | |
| Actual OrderStatus/state machine audited | | |
| Action inventory complete | | |
| Server-authoritative action availability implemented | | |
| Full-page actions match state/permissions | | |
| Drawer/full-page action parity | | |
| Business identifier opens `/app/orders/{id}` | | |
| Quick Preview explicitly separated if retained | | |
| Request→Order navigation correct | | |
| Order→Booking relation exact | | |
| 1 Order=1 Booking V1 preserved | | |
| Mutability matrix complete | | |
| Allowed edit succeeds | | |
| Forbidden edit denied server-side | | |
| Frozen commercial snapshot protected | | |
| Post-final traveler edit denied | | |
| Anti-mass-assignment preserved | | |
| Existing audit/history systems inventoried | | |
| Cross-cutting audit framework designed | | |
| Framework reusable for Request/Order/Booking | | |
| Audit events immutable | | |
| Business change + audit transactional | | |
| Field old/new captured | | |
| Lifecycle action captured | | |
| Actor captured | | |
| changedAt captured | | |
| source/context captured | | |
| Sensitive PII not stored plaintext in audit | | |
| Secrets never audited | | |
| Denied edit creates no successful audit mutation event | | |
| Failed transaction creates no orphan audit event | | |
| Audit history server-authorized | | |
| Audit history paginated | | |
| Platform→Storefront history denied | | |
| Legacy Orders supported honestly | | |
| Relevant roles requalified | | |
| Direct URL/hard refresh pass | | |
| Browser action flow pass | | |
| Browser edit flow pass | | |
| Browser history flow pass | | |
| DB==API==UI==Audit for edit | | |
| DB==API==UI==Audit for lifecycle action | | |
| D4 isolation preserved | | |
| D4 traveler security preserved | | |
| D3 CASE A/B preserved | | |
| D5 does not change KPI semantics | | |
| D5 does not start D6 | | |
| Architecture doc created/updated | | |
| Roadmap additive sync completed | | |
| Report predominantly Russian | | |
| No unresolved P0/P1 | | |
| Final worktree EXACTLY EMPTY | | |
| Final HEAD == origin/master | | |
| Push successful | | |

# 91. REGRESSION MINIMUM

Run at least:

```text
D3 request-flow
D3 traveler-collection
D4 traveler-security
D4 representative-chain
D4 remediation closure suite
relevant Order lifecycle suites
relevant Booking relation suites
relevant RBAC suites for changed permissions
frontend tests for Order detail/navigation/actions/edit/history
TypeScript compile
```

Если pre-existing failure — reproduce on clean baseline и document exact root cause. Никакого waiver без reproduction.

# 92. DATA SAFETY

Не делать full DB reset. Использовать existing permanent representative cases, isolated e2e DB, additive dedicated test fixtures. Не удалять D3/D4 representative chains.

# 93. GIT DISCIPLINE

Перед implementation:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
```

После implementation:

```bash
git diff --check
git status --short
git add <intended files only>
git commit
git push
git fetch origin
git rev-parse HEAD
git rev-parse origin/master
git status --short
```

Hard final:

```text
git status --short = EXACTLY EMPTY
HEAD == origin/master
```

Указать real SHA.

# 94. FINAL VERDICT RULE

## Success

Только если все hard acceptance gates доказаны:

```text
VERDICT A — D5 ORDER FULL-PAGE DETAIL
+ NAVIGATION CONSISTENCY
+ ACTION/STATE-MACHINE CONSISTENCY
+ EDITING/MUTABILITY CONTRACT
+ ENTITY CHANGE AUDIT FRAMEWORK INTEGRATION
IMPLEMENTATION COMPLETED

D5 IMPLEMENTATION — DONE
STRICT REVIEW — NOT STARTED

TRUE NEXT:
D5 — STRICT REVIEW

D6 NOT STARTED.
```

Implementation НЕ означает D5 accepted.

## Failure

Если hard blocker:

```text
VERDICT B — D5 IMPLEMENTATION INCOMPLETE

D5 — NOT ACCEPTED
REMEDIATION REQUIRED
```

# 95. STOP RULE

После:

```text
architecture audit
→ implementation
→ automated tests
→ browser/runtime evidence
→ DB/API/UI/Audit reconciliation
→ documentation/roadmap sync
→ report
→ commit
→ push
→ final Git verification
```

остановиться.

```text
STOP.
WAIT FOR INDEPENDENT D5 STRICT REVIEW.
D6 NOT STARTED.
```
