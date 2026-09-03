# PHASE 3 — POST-STEP 3.8 — CANONICAL ROADMAP SYNCHRONIZATION + USER / BUYER / PARTNER SUSPENSION & DEACTIVATION LIFECYCLE ARCHITECTURE AMENDMENT

## 0. EXECUTION MODE

**DOCUMENTATION / ARCHITECTURE / ROADMAP SYNCHRONIZATION ONLY.**

Не изменять production code, Prisma schema, migrations, API, frontend или runtime behavior.

Step 3.8 уже закрыт отдельным Strict Review:

```text
VERDICT A — PHASE 3 — STEP 3.8 MARKETING DOMAIN — STRICT REVIEW APPROVED
STEP 3.8 CLOSED
```

Подтверждённая цепочка:

```text
Step 3.8 implementation SHA:  541fe4b
Step 3.8.1 evidence SHA:      8b32e34
Step 3.8.2 remediation SHA:   38d88fd
Final evidence closure SHA:   b8627b7
Strict Review SHA:            4135025
Final HEAD at review:         4135025
origin/master:                4135025
```

Цели этой задачи:

1. синхронизировать canonical roadmap с фактически закрытым Step 3.8;
2. внести additive architecture amendment для lifecycle блокировки/деактивации User / Buyer / Partner;
3. определить **единственный canonical NEXT** на основании реального roadmap;
4. остановиться до начала следующей implementation-задачи.

---

## 1. LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые документы и пояснения должны быть написаны **на русском языке**.

На русском обязательно:

- roadmap synchronization notes;
- architecture amendment;
- gap analysis;
- lifecycle semantics;
- state transition explanations;
- security/governance rules;
- findings;
- rationale;
- итоговый отчёт.

Английский допускается для:

- имён файлов/путей;
- entity/model/class/DTO names;
- enum values;
- permissions;
- endpoints;
- CLI/Git commands;
- commit messages;
- кода;
- стандартизированных VERDICT/status labels.

Если итоговые документы преимущественно на английском — задача считается незавершённой.

---

## 2. CANONICAL ROADMAP AUTHORITY

Найти и открыть фактический canonical roadmap проекта, ожидаемо:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

или его фактический текущий canonical successor.

Не создавать второй competing roadmap.

Перед редактированием определить:

```text
точный canonical roadmap path
текущий статус Step 3.8
текущий записанный NEXT
следующие существующие Phase 3 steps
существующие amendments
правила numbering / strict-review pairing
```

Roadmap является authority для определения следующего implementation step.

---

## 3. ROADMAP UPDATE POLICY

Изменения только additive.

Запрещено:

```text
удалять историю
перенумеровывать существующие steps
переписывать старые verdicts
заменять реальные SHA placeholders
схлопывать implementation + strict review в один step
автоматически начинать NEXT
```

Сохранить правило:

```text
Implementation
→ Strict Review
→ APPROVED
→ next implementation
```

---

## 4. STEP 3.8 CANONICAL CLOSURE

Roadmap должен однозначно отражать:

```text
PHASE 3 — STEP 3.8 — MARKETING DOMAIN
STATUS: COMPLETE — STRICT REVIEW APPROVED
```

Зафиксировать реальную цепочку:

```text
Implementation:          541fe4b
Evidence:                8b32e34
Remediation:             38d88fd
Final Evidence Closure:  b8627b7
Strict Review:           4135025
```

Кратко отразить подтверждённый scope:

```text
Campaign
Audience
Attribution
Campaign lifecycle
Platform-only Marketing RBAC
Partner-scoped data isolation
Audience criteria validation
Attribution referential/type integrity
```

Не заявлять completed для deferred функций:

```text
Marketing UI
EMAIL/SMS/PUSH transports
consent/preferences
automation/journeys
multi-touch attribution
Partner Marketing entitlement
```

---

# PART II — USER / BUYER / PARTNER SUSPENSION & DEACTIVATION LIFECYCLE

## 5. PURPOSE

Добавить в canonical architecture отдельный future implementation item/amendment, определяющий lifecycle приостановки и деактивации:

```text
User Account
Buyer/customer-facing account
Partner business
Partner employee/user account
```

Это **не deletion model** и **не GDPR erasure model**.

Главный принцип:

```text
SUSPENSION / DEACTIVATION
≠
DELETION
≠
ANONYMIZATION
≠
GDPR ERASURE
```

Исторические бизнес-данные должны сохраняться.

---

## 6. DOMAIN SEPARATION

Не смешивать:

```text
User account status
Partner business status
Partner employee membership/status
Customer CRM history
```

Один физический User может участвовать в разных business contexts.

### 6.1 User Account

Минимальная модель:

```text
ACTIVE
SUSPENDED
DEACTIVATED
```

Семантика:

```text
ACTIVE
→ нормальный доступ

SUSPENDED
→ временная административная/безопасностная блокировка
→ login/session/action restrictions согласно будущему implementation contract
→ потенциально обратимо

DEACTIVATED
→ долгосрочно отключённый account
→ новые действия запрещены
→ история сохраняется
→ восстановление только через явный controlled process, если policy разрешает
```

### 6.2 Partner Business

Отдельный lifecycle:

```text
ACTIVE
SUSPENDED
DEACTIVATED
```

Partner business status не должен автоматически означать удаление Partner records.

### 6.3 Partner Employee/User

Деактивация сотрудника:

```text
не деактивирует Partner business
не удаляет созданные им records
не ломает audit attribution
не меняет ownership исторических действий
```

---

## 7. STATUS METADATA — MANDATORY

Для каждой server-authoritative status change предусмотреть концептуально:

```text
status
statusReason
statusComment
statusChangedAt
statusChangedBy
```

### statusReason

Structured reason enum должен быть расширяемым.

Минимальные conceptual values:

```text
USER_REQUEST
FRAUD
SECURITY
POLICY_VIOLATION
LEGAL
INACTIVITY
BUSINESS_CLOSED
COMPLIANCE
OTHER
```

Не считать этот список окончательной Prisma enum спецификацией до implementation audit.

### statusComment

`statusComment` — внутренний административный комментарий.

Требования:

```text
free-text
internal only
audited
не возвращается в public/Buyer/Partner-facing API
не попадает в Communication payload
не показывается публично в CRM/customer-facing views
```

Для:

```text
statusReason = OTHER
```

комментарий должен быть обязательным, если repository/domain audit не выявит более подходящий canonical rule.

---

## 8. IMMUTABLE / ADDITIVE STATUS HISTORY

Одного текущего status недостаточно.

Future implementation должен иметь append-only/auditable историю переходов.

Концептуальная модель:

```text
StatusHistory

entityType
entityId
previousStatus
newStatus
reason
comment
changedBy
changedAt
```

Допустимые `entityType` должны быть определены по фактическим bounded contexts, а не скопированы вслепую.

Минимально рассмотреть:

```text
USER
PARTNER
PARTNER_MEMBER / PARTNER_EMPLOYEE
```

Не создавать generic polymorphic table автоматически, если repository architecture предпочитает domain-specific audit/event records.

Главное требование — неизменяемая история должна существовать в архитектуре.

---

## 9. SERVER AUTHORITY

Status нельзя считать frontend-only состоянием.

Authority chain должна быть server-side:

```text
Authenticated Actor
→ Workspace Context
→ Permission
→ Target Entity Scope
→ Allowed Transition
→ Reason/Comment Validation
→ Persist Current Status
→ Persist Audit/History
→ Enforce Runtime Restrictions
```

Нельзя разрешать:

```text
client-controlled statusChangedBy
client-controlled target partner scope
display:none как security enforcement
frontend-only login block
```

---

## 10. TRANSITION RULES

Roadmap amendment должен требовать будущий explicit transition contract.

Минимально:

```text
ACTIVE → SUSPENDED
ACTIVE → DEACTIVATED

SUSPENDED → ACTIVE
SUSPENDED → DEACTIVATED
```

`DEACTIVATED → ACTIVE` не считать автоматически допустимым.

Нужно определить отдельную policy:

```text
reactivation allowed?
who can reactivate?
which reason required?
does user-requested deactivation differ from fraud/legal deactivation?
```

До этого не фиксировать опасный automatic restore.

---

## 11. BUSINESS DATA PRESERVATION

Suspension/deactivation не должны автоматически удалять:

```text
Orders
Bookings
Payments
Refunds
Settlements
Payouts
Products/Listings
Customers
PartnerCustomerRelation
CRM Activity
Operational Notes
Communications
Reviews
Marketing attribution
Audit/history
```

Особенно:

```text
DEACTIVATED Partner
≠
delete Partner
```

---

## 12. ACTIVE TRANSACTION SAFETY

Future implementation должен отдельно определить поведение существующих обязательств.

Нельзя автоматически:

```text
cancel paid bookings
delete orders
void payments
erase refund obligations
erase payout rights
erase dispute evidence
```

Для Partner suspension/deactivation нужен policy matrix по состоянию:

```text
new sales
existing unpaid orders
confirmed bookings
paid bookings
refunds
settlements
payouts
disputes
customer communication
```

Если policy ещё не определена — roadmap должен пометить это как mandatory implementation-design gate.

---

## 13. LOGIN / SESSION EFFECTS

Future implementation audit должен определить:

### User SUSPENDED

Ожидаемо:

```text
new login denied
existing sessions revoked/invalidated
refresh tokens invalidated
protected actions denied
```

### User DEACTIVATED

Ожидаемо как минимум те же ограничения.

Не реализовывать сейчас.

Зафиксировать необходимость server-authoritative session/token enforcement.

---

## 14. PARTNER BUSINESS EFFECTS

Для `Partner.status = SUSPENDED/DEACTIVATED` future implementation должен определить projection на:

```text
Marketplace listings
Storefront public site
new bookings/orders
Partner Workspace
employees
payments/refunds
payouts
communications
```

Не смешивать:

```text
business disabled
```

с:

```text
all employee User accounts deleted/deactivated
```

---

## 15. STOREFRONT / MARKETPLACE PROJECTION

Lifecycle должен учитывать разные business contexts.

### Marketplace

При Partner suspension/deactivation необходимо определить:

```text
visibility of listings
new purchase/book restrictions
existing booking servicing
moderated communication
financial settlement
```

### Storefront

Необходимо определить:

```text
public storefront availability
catalog visibility
new direct bookings/orders
back-office access
existing customer obligations
```

Storefront public site и Storefront Back Office остаются разными surfaces.

---

## 16. CRM EFFECT

Customer/Buyer account deactivation не должна уничтожать CRM history.

Сохраняются:

```text
Customer identity/history as legally/business-required
PartnerCustomerRelation
Activity
Orders
Bookings
Payments
Communication history
Marketing attribution
```

Но будущий implementation должен определить, какие персональные данные могут быть subject to отдельной privacy/anonymization policy.

Не смешивать это с deactivation.

---

## 17. SECURITY / GOVERNANCE

Future implementation должен предусмотреть permissions, например концептуально:

```text
user.status.read
user.status.manage
partner.status.read
partner.status.manage
partner.member.status.manage
```

Фактические permission names определить repository audit'ом.

Критические действия:

```text
SUSPEND
DEACTIVATE
REACTIVATE
```

должны быть audited.

Для чувствительных причин:

```text
FRAUD
SECURITY
LEGAL
COMPLIANCE
```

рассмотреть более строгий permission/policy gate.

---

## 18. INTERNAL COMMENT PRIVACY

`statusComment` может содержать чувствительную служебную информацию.

Hard boundary:

```text
INTERNAL ADMIN DATA
```

Не должен попадать:

```text
Buyer API
Partner API
public profile
public storefront
Marketplace listing
Communication messages
general CRM response without explicit internal permission
analytics dimensions
logs with uncontrolled exposure
```

Future implementation должен иметь negative disclosure tests.

---

## 19. DEACTIVATION VS ERASURE

Roadmap amendment должен явно выделить отдельный future privacy/compliance concern:

```text
Account Deactivation
≠
Personal Data Erasure / Anonymization
```

Если в будущем появится GDPR/privacy workflow, он должен отдельно решать:

```text
legal retention
financial retention
fraud/security retention
audit retention
anonymization
deletion eligibility
```

Не использовать deactivation endpoint как data deletion endpoint.

---

## 20. REQUIRED REPOSITORY GAP AUDIT — FUTURE IMPLEMENTATION PREREQUISITE

В amendment записать, что перед кодированием lifecycle необходимо проверить существующие:

```text
User.status / isActive / deletedAt
Partner.status
PartnerStorefront.status
membership/employee status
Auth guards
JWT/refresh/session revocation
soft-delete patterns
AuditLog/EventBus
CRM Customer status
Booking/Order financial obligations
Product/listing publication state
```

Нельзя создавать новые enums/tables до такого gap audit.

---

## 21. ROADMAP PLACEMENT

Не придумывать номер шага до анализа фактического roadmap.

Найти наиболее корректное место в существующей последовательности.

Правила:

1. не renumber существующие steps;
2. добавить новый substep/amendment;
3. явно обозначить `PLANNED`, не `DONE`;
4. не сделать его canonical NEXT автоматически, если roadmap sequencing требует другого шага;
5. если lifecycle является prerequisite для уже существующего future step — записать dependency;
6. сохранить Strict Review pairing.

Рекомендуемое название:

```text
USER / BUYER / PARTNER SUSPENSION & DEACTIVATION LIFECYCLE
```

---

## 22. SEPARATE ARCHITECTURE AMENDMENT FILE

Создать:

```text
docs/prompts/USER_BUYER_PARTNER_SUSPENSION_DEACTIVATION_LIFECYCLE_ARCHITECTURE_ROADMAP_AMENDMENT.md
```

Документ должен содержать:

```text
1. Назначение
2. Domain boundaries
3. User lifecycle
4. Partner business lifecycle
5. Partner employee lifecycle
6. Status metadata
7. Structured reasons
8. Internal comments
9. Status history / audit
10. Transition policy
11. Authentication/session effects
12. Transaction preservation
13. Marketplace projection
14. Storefront projection
15. CRM/history preservation
16. Security/permissions
17. Privacy boundary
18. Repository gap audit
19. Implementation prerequisites
20. Runtime acceptance gates
21. Roadmap placement
```

---

## 23. RUNTIME ACCEPTANCE GATES FOR FUTURE STEP

Amendment должен заранее определить, что будущая implementation не может быть закрыта без runtime evidence минимум для:

```text
ACTIVE user login allowed
SUSPENDED user login denied
existing suspended-user session denied/revoked
DEACTIVATED user login denied

unauthorized actor cannot suspend user
authorized actor can suspend with reason
OTHER without comment rejected
OTHER with comment accepted

statusChangedBy server-derived
status history appended
history cannot be overwritten by ordinary API

Partner A admin cannot deactivate Partner B
Partner suspension blocks new prohibited operations
existing historical orders/bookings remain
paid booking not silently cancelled
financial records preserved

Partner employee deactivation does not deactivate Partner business

statusComment absent from Buyer/Partner/public payloads
statusComment accessible only to authorized internal context

reactivation follows explicit transition policy
```

---

# PART III — DETERMINE CANONICAL NEXT

## 24. DETERMINE THE REAL NEXT STEP

После Step 3.8 closure и amendment insertion:

1. перечитать roadmap sequence;
2. найти первый незакрытый implementation item, который по roadmap должен идти следующим;
3. проверить dependencies;
4. проверить, не существует ли уже remediation/review requirement;
5. определить ровно один canonical NEXT.

Не предполагать номер по памяти.

В отчёте привести:

```text
Current completed boundary:
New architecture amendment:
Canonical NEXT:
Why:
Dependencies satisfied:
Strict Review required after implementation: YES
```

---

## 25. ROADMAP STATUS INVARIANTS

После sync должно быть невозможно одновременно увидеть два разных `NEXT`.

Проверить по всему canonical roadmap:

```text
NEXT
CURRENT
READY
IN PROGRESS
```

и убедиться, что status semantics не создают конфликт.

Исторические упоминания `NEXT` внутри старых completion notes допустимы только если ясно обозначены как historical snapshot.

---

## 26. REQUIRED REPORT

Создать:

```text
docs/prompts/PHASE_3_POST_STEP_3.8_CANONICAL_ROADMAP_SYNC_AND_LIFECYCLE_AMENDMENT_REPORT.md
```

На русском языке.

Структура:

```text
1. Baseline
2. Canonical roadmap authority
3. Step 3.8 closure synchronization
4. Architecture amendment added
5. Lifecycle domain decisions
6. Preservation/security/privacy invariants
7. Roadmap placement
8. Canonical NEXT determination
9. Files changed
10. Git closure
11. Verdict
```

---

## 27. GIT POLICY

Ожидаются только docs/roadmap changes.

Перед commit:

```bash
git status --short
git diff --name-only
git diff
```

Не stage pre-existing unrelated dirty files.

Commit message, например:

```bash
git commit -m "docs(roadmap): close Step 3.8 and add deactivation lifecycle architecture"
```

После:

```bash
git push origin master
git rev-parse HEAD
git rev-parse origin/master
git status --short
```

В отчёте записать реальные:

```text
Starting HEAD:
Roadmap/lifecycle amendment SHA:
Final HEAD:
origin/master:
HEAD == origin/master:
```

Не оставлять placeholders в финальном evidence, если SHA фиксируется в отдельном final response.

Если SHA самого текущего report commit невозможно записать внутрь него без рекурсивного нового commit, указать его в финальном execution response и не создавать бесконечную цепочку docs-only commits.

---

## 28. SUCCESS CONDITIONS

PASS только если:

```text
Step 3.8 marked COMPLETE / STRICT REVIEW APPROVED
real Step 3.8 SHA chain preserved
no deferred Marketing feature falsely marked complete
lifecycle amendment created
User vs Partner business vs Partner employee separated
SUSPENDED vs DEACTIVATED separated
reason/comment requirement documented
append-only history requirement documented
transaction/history preservation documented
deactivation != deletion/erasure documented
statusComment privacy boundary documented
future runtime gates documented
existing roadmap numbering preserved
exactly one canonical NEXT determined
no production code/schema changes
report written in Russian
Git closure complete
```

---

## 29. SUCCESS VERDICT

При выполнении всех условий:

```text
VERDICT A — POST-STEP 3.8 CANONICAL ROADMAP SYNCHRONIZATION + SUSPENSION/DEACTIVATION LIFECYCLE ARCHITECTURE AMENDMENT — COMPLETE

STEP 3.8 CANONICALLY CLOSED
LIFECYCLE AMENDMENT RECORDED
CANONICAL NEXT DETERMINED
```

В конце обязательно вывести:

```text
CANONICAL NEXT:
<exact roadmap step>

DO NOT AUTO-START
```

---

## 30. FAILURE VERDICT

Если roadmap противоречив, amendment placement неясен или невозможно определить единственный NEXT:

```text
VERDICT B — POST-STEP 3.8 ROADMAP SYNCHRONIZATION INCOMPLETE

DO NOT START NEXT IMPLEMENTATION
```

Указать точную причину.

Не исправлять production code.

---

## 31. STOP CONDITION

После завершения:

```text
STOP
```

Не запускать canonical NEXT автоматически.

Сначала предоставить:

- обновлённый roadmap status;
- lifecycle amendment summary;
- реальный Git closure;
- точный `CANONICAL NEXT`.

Следующий implementation prompt создаётся отдельно.
