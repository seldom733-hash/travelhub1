# PHASE 3 — STEP 3.10 — SUPPORT DOMAIN — IMPLEMENTATION

## 0. EXECUTION MODE

**IMPLEMENTATION TASK.**

Реализовать только фактический canonical scope:

```text
PHASE 3 — STEP 3.10 — SUPPORT DOMAIN
```

Подтверждённый baseline:

```text
Previous completed boundary: Phase 3.0–3.9 (all VERDICT A)
Post-Step 3.9 architecture / roadmap sync SHA: 62828f0
Expected starting HEAD/origin: 62828f0

CANONICAL NEXT:
PHASE 3 — STEP 3.10 — SUPPORT DOMAIN
```

**Не проектировать Step 3.10 по памяти или только по названию.**

Сначала прочитать актуальный canonical roadmap на baseline `62828f0`, затем провести repository reconciliation, затем реализовать только подтверждённые gaps.

После implementation:

```text
IMPLEMENTATION REPORT
RUNTIME / SECURITY EVIDENCE
GIT CLOSURE
STOP
```

Не выполнять отдельный Strict Review в рамках этой задачи.

---

# 1. LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые reports и prose documentation должны быть преимущественно **на русском языке**.

На русском обязательны:

- Implementation Report;
- reconciliation/gap analysis;
- findings;
- root cause analysis;
- architecture decisions;
- security/RBAC explanations;
- runtime evidence descriptions;
- test evidence;
- conclusions/recommendations;
- verdict explanations.

Английский допускается только для:

- file paths;
- class/method/DTO/model/table names;
- API endpoints;
- HTTP methods/status codes;
- CLI/Git commands;
- enum/permission identifiers;
- code snippets;
- commit messages;
- standardized VERDICT strings.

Если report преимущественно на английском — задача незавершена.

---

# PART I — PREFLIGHT

## 2. GIT BASELINE

Выполнить:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git log -25 --oneline
```

Ожидаемо:

```text
HEAD:          62828f0
origin/master: 62828f0
```

Если baseline отличается — сначала установить причину.

Не изменять/stage pre-existing unrelated dirty files.

---

## 3. READ EXACT CANONICAL STEP 3.10

Открыть actual canonical roadmap.

Historical expected path:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Но использовать фактический source of truth.

Из Step 3.10 дословно/точно извлечь в Implementation Report:

```text
scope
domain objects
actors
states/lifecycle
permissions
relationships
API expectations
security requirements
tests
runtime acceptance gates
explicit deferrals
dependencies
out-of-scope
```

Если roadmap содержит ссылки на другие architecture documents — прочитать их до implementation.

**Roadmap имеет приоритет над предположениями этого prompt.**

---

# PART II — REPOSITORY RECONCILIATION BEFORE CODE

## 4. AUDIT EXISTING DOMAINS

До создания новых entities/services/tables провести repository search минимум по:

```text
Support
Ticket
Case
Request
Issue

Communication
Conversation
Message
ChatRoom
ChatMember

CRM
Customer
Partner
PartnerCustomerRelation
CrmActivity
Operational Notes

Order
Booking
Payment
Refund
Settlement
Payout

Dispute
Complaint
Moderation

User
Employee
Role
Permission

Audit
Activity
Event
StatusHistory
Attachment
```

Также проверить migrations/schema, controllers, DTOs, services, tests, frontend/API clients, permissions registry и seed/default-role matrices.

---

## 5. RECONCILIATION MATRIX

До implementation создать рабочую matrix:

| Concept | Existing authority | Classification | Step 3.10 action |
|---|---|---|---|
| Support case/ticket | | | |
| Customer identity | | | |
| Partner identity | | | |
| Communication | | | |
| Message/history | | | |
| Order relation | | | |
| Booking relation | | | |
| Payment/refund relation | | | |
| Activity/audit | | | |
| Dispute | | | |
| Moderation | | | |
| Attachment | | | |
| RBAC | | | |

Classification только:

```text
REUSE
EXTEND
MISSING
DEFER
DO_NOT_DUPLICATE
```

Не создавать production model до завершения этой reconciliation.

---

# PART III — HARD ANTI-DUPLICATION RULES

## 6. SUPPORT MUST NOT CLONE CANONICAL DOMAINS

Если canonical entities уже существуют, Support должен ссылаться/reuse их.

Запрещено без прямого требования roadmap создавать концептуальные копии:

```text
SupportCustomer
SupportPartner
SupportOrder
SupportBooking
SupportPayment
SupportRefund
SupportMessage
SupportConversation
SupportActivity
SupportAudit
```

если соответствующий canonical authority уже существует.

Предпочтительная topology:

```text
Support Case/Ticket
├── actor/customer/partner reference
├── optional Order reference
├── optional Booking reference
├── optional Payment/Refund reference if canonical scope requires
├── Communication relation/reference
└── canonical Audit/Activity integration
```

Фактические relations определять из roadmap + repository.

---

## 7. COMMUNICATION BOUNDARY

Support Domain не должен создавать второй messaging system, если существующий Communication domain уже является canonical authority.

Проверить возможность:

```text
Support Case
    ↓ relation
Communication / Conversation
    ↓
CommunicationMessage / canonical history
```

Не переносить/дублировать message content в Support только ради удобства UI/API.

Если roadmap требует support-specific communication semantics — реализовать минимальное extension существующей authority.

---

## 8. CRM BOUNDARY

Support ≠ CRM.

Support может ссылаться на:

```text
Customer
Partner
PartnerCustomerRelation
CRM context/activity
```

но не должен создавать второй customer profile или второй Partner 360.

Не превращать Support Case в источник canonical customer identity.

---

## 9. ORDER / BOOKING BOUNDARY

Support может быть связан с transaction context:

```text
Order
Booking
Payment
Refund
```

но не должен владеть их lifecycle.

Support action не может произвольно:

```text
mark Booking paid
change Order ownership
issue Refund
change Settlement
change Payout
```

без использования canonical domain authority/permissions.

---

## 10. DISPUTE BOUNDARY

Не предполагать:

```text
Support Case == Dispute
```

Проверить actual roadmap/repository.

Если Dispute является отдельным future/current domain:

```text
Support → may reference/escalate to Dispute
```

но не поглощает его financial/legal lifecycle.

Если Step 3.10 прямо включает dispute semantics — следовать roadmap и документировать reconciliation.

---

## 11. MODERATION BOUNDARY

Не смешивать Support с Marketplace communication moderation без canonical requirement.

Support agent visibility/action ≠ moderation authority.

Если moderation существует отдельно, reuse её authority.

---

# PART IV — DOMAIN MODEL

## 12. IMPLEMENT ONLY CANONICAL SUPPORT AGGREGATE

После reconciliation определить минимальный Support aggregate из Step 3.10.

Не добавлять speculative fields/features.

Для каждого нового persisted field указать:

```text
business purpose
authority
mutable/immutable
validation
index/constraint
audit requirement
tenant/workspace scope
```

---

## 13. IDENTIFIERS

Если roadmap/project conventions используют human-readable codes, Support objects должны следовать существующему pattern.

Например conceptually:

```text
SUP-000001
```

Но не вводить этот prefix, если canonical roadmap/repository задаёт другой.

В user-facing UI/API labels не использовать raw UUID вместо canonical human identifier там, где проект уже требует readable code.

---

## 14. LIFECYCLE

Использовать **только actual canonical lifecycle Step 3.10**.

Не изобретать автоматически:

```text
OPEN
IN_PROGRESS
WAITING
RESOLVED
CLOSED
```

Сначала извлечь фактические states/transitions из roadmap.

Для lifecycle обеспечить:

```text
server-authoritative transition validation
invalid transition → controlled 4xx
terminal-state rules
audit/history if canonical
no direct arbitrary status mutation
```

---

## 15. PRIORITY / CATEGORY / TYPE

Если Step 3.10 требует:

```text
priority
category
type
source
reason
```

использовать bounded enum/validated contract.

Не оставлять free text там, где backend ожидает enum.

Урок Step 3.9 обязателен:

```text
invalid enum input
→ validation before ORM
→ controlled 4xx
→ never raw 500
```

---

# PART V — ACTORS / OWNERSHIP / SCOPE

## 16. ACTOR MODEL

Из roadmap определить, кто может:

```text
create
read
assign
update
comment/respond
resolve
close/reopen
escalate
```

Не предполагать, что все internal roles имеют одинаковые права.

---

## 17. PLATFORM / PARTNER / BUYER BOUNDARY

Проверить фактический workspace scope.

Не предоставлять Partner actor Platform Support authority только потому, что case связан с Partner.

Hard invariant:

```text
entity relation ≠ actor authorization
```

Аналогично Customer/Buyer relation не должна давать доступ к чужим cases.

---

## 18. TENANT / PARTNER ISOLATION

Если Support содержит Partner-scoped data, доказать:

```text
Partner A cannot read Partner B data
Partner A cannot mutate Partner B case
cross-partner related entity injection rejected
```

Проверять relation IDs server-side.

---

## 19. ASSIGNMENT

Если roadmap включает assignment:

```text
assignedTo
team
queue
owner
```

проверить:

```text
assignee eligibility
workspace membership
role/permission
cross-tenant assignment denial
reassignment audit
```

Не принимать arbitrary user UUID.

---

# PART VI — RBAC

## 20. PERMISSIONS

Сначала audit существующего permission registry.

Если Step 3.10 задаёт `support.*`, реализовать exact canonical permissions.

Если нет — предложить/использовать минимальный набор только в соответствии с roadmap architecture.

Не использовать broad `admin` shortcut вместо granular server permissions.

---

## 21. DEFAULT ROLE MATRIX

Если новые permissions добавляются, обновить canonical default role matrix.

Для каждой internal role зафиксировать:

```text
granted
denied
reason
```

Не выдавать Support access всем ролям автоматически.

Admin ability to grant permission не означает одинаковые defaults.

---

## 22. SERVER AUTHORITY

Все sensitive operations должны проверяться backend.

Frontend:

```text
hidden button
disabled action
hidden nav
```

не считается security.

Required negative tests:

```text
unauthorized role → 403
anonymous → 401
foreign tenant → 403/404 according canonical policy
invalid related entity → controlled 4xx/404
```

---

# PART VII — RELATED ENTITY INTEGRITY

## 23. CUSTOMER / PARTNER RELATION

При создании/изменении Support object backend должен валидировать existence/type/scope связанных actors.

Не принимать arbitrary UUID без domain verification.

---

## 24. ORDER / BOOKING RELATION

Если case связан с Order/Booking:

```text
entity must exist
entity type must match
actor must be allowed to reference it
tenant/partner/customer scope must match
```

Cross-scope relation injection = blocking security defect.

---

## 25. PAYMENT / REFUND RELATION

Если Step 3.10 допускает relation:

```text
Support can reference
```

но financial mutation должна проходить через canonical Finance authority.

Не создавать Support-owned payment/refund status.

---

# PART VIII — COMMUNICATION / HISTORY

## 26. CASE CONVERSATION

Если Support case использует Communication:

проверить:

```text
one-to-one / one-to-many relation according roadmap
participant authority
message visibility
internal vs customer-visible content
history preservation
```

Не создавать прямой Customer↔Marketplace Partner bypass, если существующая Communication policy запрещает его.

---

## 27. INTERNAL NOTES

Если Support требует internal notes:

сначала проверить существующие Operational Notes / Activity capabilities.

Не дублировать append-only Notes model.

Internal note:

```text
must not leak to Buyer/Partner/public APIs
must be permission-gated
must be auditable
```

---

## 28. ACTIVITY / AUDIT

Support lifecycle/assignment/material changes должны использовать canonical audit/activity mechanism, если он существует.

Проверить минимум:

```text
created
status changed
assigned/reassigned
priority/category changed where material
related entity linked/unlinked
resolved/closed/reopened
```

Не создавать второй generic activity ledger.

---

# PART IX — API CONTRACT

## 29. ENDPOINTS

Реализовать exact Step 3.10 API surface.

Для каждого endpoint документировать:

```text
method
path
actor
permission
scope
request DTO
response
positive status
400/401/403/404/409/422 semantics
```

Не добавлять speculative bulk/export endpoints.

---

## 30. VALIDATION

Все DTO должны reject invalid input до ORM/domain mutation.

Проверить:

```text
unknown enum
empty required field
invalid UUID
nonexistent relation
wrong relation type
cross-scope relation
duplicate where uniqueness applies
invalid lifecycle transition
```

Hard gate:

```text
client validation error → controlled 4xx
never raw ORM 500
```

---

## 31. PAGINATION / FILTERS

Если list/search входит в Step 3.10:

reuse project conventions.

Не вводить новый pagination/filter dialect без необходимости.

Проверить bounded filters и server-side scope.

---

# PART X — DATA / MIGRATIONS

## 32. MIGRATION SAFETY

Если нужна schema migration:

```text
forward-safe
existing data preserved
constraints justified
indexes justified
no destructive reset
```

Не использовать:

```text
prisma migrate reset
drop production-like DB
destructive seed cleanup
```

---

## 33. SEED / FIXTURE

Добавлять seed data только если canonical testing/runtime evidence требует.

Seed должен быть:

```text
idempotent
isolated
non-production
```

---

# PART XI — TESTS

## 34. UNIT / SERVICE TESTS

Покрыть фактическую business logic:

```text
create
read
scope
lifecycle
assignment if applicable
related entity validation
authorization
audit integration
```

---

## 35. API / E2E SECURITY MATRIX

Минимум, адаптировав к actual Step 3.10 actors:

```text
authorized internal actor → success
unauthorized internal actor → 403
anonymous → 401
foreign Partner → denied
invalid related entity → reject
wrong entity type → reject
cross-partner relation → reject
invalid enum → controlled 4xx
invalid lifecycle → controlled 4xx
```

---

## 36. COMMUNICATION REGRESSION

Если Support интегрирован с Communication, обязательно прогнать существующие Communication tests.

Support implementation не должен ломать:

```text
Communication authority
Marketplace mediation rules
participant scope
message history
moderation boundary
```

---

## 37. CRM / TRANSACTION REGRESSION

Если изменены integration points, прогнать relevant:

```text
CRM tests
Order tests
Booking tests
Payment/Refund tests
Activity/Audit tests
```

Не требуется full unrelated suite, если canonical CI уже определяет другую matrix; указать фактическую matrix.

---

# PART XII — RUNTIME EVIDENCE

## 38. REAL RUNTIME REQUIRED

Не закрывать implementation только по unit tests.

Поднять/использовать фактический runtime stack согласно repository instructions.

Проверить API через реальную auth/session/DB path.

---

## 39. POSITIVE RUNTIME FLOW

Выполнить минимум canonical happy path:

```text
create Support object
read/list it
link canonical related entity where required
perform allowed lifecycle action
verify persisted state
verify history/audit
```

Если assignment входит в scope — включить assignment.

---

## 40. NEGATIVE RUNTIME FLOW

Обязательно:

```text
anonymous request
unauthorized role
invalid enum
invalid/nonexistent relation
cross-scope relation
invalid transition
```

Expected:

```text
controlled 4xx
no raw ORM error
no unexpected 500
no partial mutation
```

---

## 41. DATA ISOLATION EVIDENCE

Если Partner scope применим, создать/использовать минимум два distinct Partner contexts.

Доказать:

```text
Partner A data inaccessible to Partner B
```

как read, так и mutation/link injection.

---

# PART XIII — FRONTEND BOUNDARY

## 42. DO NOT BUILD UI UNLESS STEP 3.10 REQUIRES IT

Название `SUPPORT DOMAIN` обычно указывает на domain/backend stage, но roadmap является authority.

Если Step 3.10 не требует Support Center UI:

```text
DO NOT build speculative Support UI
DO NOT add sidebar item early
```

Если UI прямо входит в Step 3.10 — реализовать только exact canonical UI scope и выполнить browser evidence.

---

# PART XIV — DEFERRED FEATURES

## 43. DO NOT SILENTLY IMPLEMENT FUTURE SUPPORT CAPABILITIES

Если roadmap не включает их в 3.10, defer:

```text
AI support agent
chatbot
SLA automation
advanced queues
omnichannel support
email ingestion
telephony
knowledge base
macros/templates
CSAT
support analytics
dispute adjudication
refund authority
bulk actions
external ticket integrations
```

Зафиксировать deferrals в report.

---

# PART XV — IMPLEMENTATION REPORT

## 44. CREATE REPORT

Создать:

```text
docs/prompts/PHASE_3_STEP_3.10_SUPPORT_DOMAIN_IMPLEMENTATION_REPORT.md
```

или canonical naming equivalent.

Структура минимум:

```text
1. Baseline
2. Exact canonical Step 3.10 scope
3. Repository reconciliation
4. Reuse / Extend / Missing / Deferred matrix
5. Domain model
6. Lifecycle
7. Actor / scope model
8. RBAC
9. Related entity integrity
10. Communication integration
11. CRM / Order / Booking / Finance boundaries
12. Activity / Audit
13. API contract
14. Validation
15. Migration/data changes
16. Automated tests
17. Runtime positive evidence
18. Runtime negative/security evidence
19. Tenant/Partner isolation
20. Deferred capabilities
21. Files changed
22. Git evidence
23. Implementation verdict
24. Strict Review readiness
```

---

# PART XVI — GIT CLOSURE

## 45. DIFF REVIEW

Перед commit:

```bash
git status --short
git diff --name-only
git diff
```

Проверить:

```text
only Step 3.10 task-owned files
no accidental Step 3.11+
no unrelated refactor
no hidden formatting sweep
```

---

## 46. COMMIT / PUSH

Использовать реальный commit.

Пример:

```bash
git add <task-owned-files>
git commit -m "feat(support): implement Phase 3 Step 3.10 domain"
git push origin master

git rev-parse HEAD
git rev-parse origin/master
```

Финально:

```text
Starting SHA:       62828f0
Step 3.10 SHA:      <real SHA>
Final HEAD:         <real SHA>
origin/master:      <real SHA>
HEAD == origin:     YES/NO
```

Не оставлять placeholders в execution response.

---

# PART XVII — IMPLEMENTATION ACCEPTANCE GATES

## 47. PASS ONLY IF

```text
actual canonical Step 3.10 read first
repository reconciliation completed

no duplicate Customer/Partner/Order/Booking/Payment/Communication/Activity authority

Support aggregate matches canonical scope
lifecycle server-authoritative
DTO validation before ORM
no invalid enum → raw 500

RBAC server-authoritative
anonymous denied
unauthorized roles denied
cross-tenant/Partner isolation proven

related entity existence/type/scope validated

Communication reused where canonical
CRM boundary preserved
Order/Booking ownership preserved
Finance authority preserved
Dispute boundary preserved unless roadmap says otherwise
Audit/history integrated canonically

relevant automated tests PASS
runtime happy path PASS
runtime negative/security matrix PASS
no unexpected 500
no partial mutation

no speculative UI/features
Implementation Report in Russian
Git closure complete
HEAD == origin/master
```

---

# PART XVIII — IMPLEMENTATION VERDICT

## 48. SUCCESS

Только если все implementation gates выполнены:

```text
VERDICT A — PHASE 3 — STEP 3.10 SUPPORT DOMAIN — IMPLEMENTATION COMPLETE

STEP 3.10 IMPLEMENTATION COMPLETE
READY FOR SEPARATE STRICT REVIEW
```

Это **не означает**:

```text
STEP 3.10 CLOSED
```

Закрытие возможно только после отдельного Strict Review.

---

## 49. FAILURE

Если остаётся material implementation/security/runtime gap:

```text
VERDICT B — PHASE 3 — STEP 3.10 SUPPORT DOMAIN — IMPLEMENTATION INCOMPLETE
```

Указать:

```text
finding
severity
root cause
affected authority
required remediation
```

Не выдавать `READY FOR STRICT REVIEW`.

---

# PART XIX — STOP CONDITION

## 50. STOP

После Implementation Report + Git closure:

```text
STOP
```

Не выполнять автоматически:

```text
Step 3.10 Strict Review
Step 3.10 roadmap closure
Step 3.11 implementation
Support Center UI if deferred
Dispute Center
AI support
Marketing changes
Promotion/Funding implementation
```

Предоставить пользователю:

```text
exact implemented scope
reconciliation result
test/runtime/security evidence
real Step 3.10 SHA
implementation verdict
```

и дождаться отдельного запроса на **PHASE 3 — STEP 3.10 — SUPPORT DOMAIN — STRICT REVIEW**.
