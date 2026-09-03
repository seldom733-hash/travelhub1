# PHASE 3 — STEP 3.11 — TARGETED FOLLOW-UP REMEDIATION — R5 / R10–R14

## 0. TASK MODE

**TARGETED FOLLOW-UP REMEDIATION + RUNTIME RE-QUALIFICATION**

Current known chain:

```text
Step 3.11 Implementation SHA:             619a970
Step 3.11 Strict Review SHA:              624cc39
Post-Strict-Review Remediation SHA:        755c3d8
```

Previous remediation reported `VERDICT A`, but subsequent product/UX review established additional mandatory requirements.

This task is intentionally narrow:

```text
R5  — Status control UX
R10 — KPI lifecycle coverage
R11 — mutable Case Priority
R12 — Case editing
R13 — ADMIN controlled soft deletion
R14 — complete CaseHistory
```

Already closed R0–R3 and R6–R9 must not be rewritten unless regression requires a minimal fix.

`R4 — Assignment` remains deferred only if the previously confirmed eligible-assignee API gap still exists.

Do not auto-start Step 3.12.

---

# 1. LANGUAGE REQUIREMENT — MANDATORY

Все reports и prose documentation, созданные или изменённые этой задачей, должны быть преимущественно **на русском языке**.

На русском обязательны:

- Remediation Report;
- Runtime/Re-qualification Report;
- findings;
- root cause;
- architecture decisions;
- security decisions;
- browser evidence;
- conclusions;
- verdict explanations.

Английский разрешён для technical identifiers:

```text
paths
classes/methods/models
API endpoints
HTTP methods/status codes
CLI/Git commands
enum values
permissions
code snippets
commit messages
standardized VERDICT strings
```

Report, написанный преимущественно на английском, считается incomplete.

---

# PART I — PREFLIGHT

## 2. VERIFY BASELINE

Run:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git log -30 --oneline
```

Expected known baseline is:

```text
755c3d8
```

but use actual repository state as authority.

Do not overwrite unrelated changes.

---

## 3. READ CANONICAL SOURCES FIRST

Read:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
Step 3.10 Support Domain implementation/remediation/review reports
Step 3.11 implementation report
Step 3.11 Strict Review report
Step 3.11 post-Strict-Review remediation report
```

Inspect actual Support models, DTOs, permissions, service/controller and current UI.

Before adding schema/API changes perform a **gap audit**.

Hard rule:

```text
reuse existing authority
before creating new authority
```

---

# PART II — R5 — STATUS AS FILTER-STYLE DROPDOWN

## 4. REMOVE LIFECYCLE BUTTON SPRAWL

Current/previous UI exposed lifecycle transitions as multiple buttons.

That UX is no longer accepted.

Remove the row/group of transition buttons.

### Required UI

Status must be presented as one compact dropdown visually consistent with the existing Support filter controls.

Conceptually:

```text
Статус
┌────────────────────────────┐
│ В работе                ▼  │
└────────────────────────────┘
```

When opened:

```text
В работе
────────────────────────────
Ожидает клиента
Ожидает партнёра
Ожидает внутреннего ответа
Эскалировано
Решено
Закрыто
```

Use the project's actual localized strings.

### Hard rules

The dropdown:

```text
shows current status
shows only canonically permitted next transitions
does not expose impossible transitions
uses permission-aware editing
uses backend as final lifecycle authority
handles stale 422 without false success
refreshes canonical state after mutation
```

Do not hardcode role names.

Do not convert lifecycle authority into frontend-only logic.

If current API does not expose allowed transitions, reuse the canonical lifecycle presentation mapping only as UI assistance; backend remains authoritative.

### Mutation consistency

After status change refresh/reconcile:

```text
detail
list
KPI
history
```

---

# PART III — R10 — COMPLETE KPI COVERAGE

## 5. FINAL SUPPORT KPI MODEL

Canonical statuses:

```text
OPEN
IN_PROGRESS
WAITING_CUSTOMER
WAITING_PARTNER
WAITING_INTERNAL
ESCALATED
RESOLVED
CLOSED
```

Required Support Center summary:

```text
Всего
Открытые
В работе
Ожидают
Эскалированные
Решённые
Закрытые
```

For AZ/RU/EN use canonical i18n.

### WAITING aggregation

```text
WAITING =
WAITING_CUSTOMER
+ WAITING_PARTNER
+ WAITING_INTERNAL
```

Do **not** merge the actual lifecycle statuses.

Filters and Case detail must retain:

```text
WAITING_CUSTOMER
WAITING_PARTNER
WAITING_INTERNAL
```

### Integrity invariant

For the ordinary non-deleted Support universe:

```text
TOTAL =
OPEN
+ IN_PROGRESS
+ WAITING_CUSTOMER
+ WAITING_PARTNER
+ WAITING_INTERNAL
+ ESCALATED
+ RESOLVED
+ CLOSED
```

And:

```text
WAITING =
WAITING_CUSTOMER
+ WAITING_PARTNER
+ WAITING_INTERNAL
```

No Case may disappear from the summary.

Do not calculate global KPI from a paginated frontend subset.

### Mutation invalidation

KPI must refresh after:

```text
create
status transition
soft delete
restore if restore is implemented later
```

Priority/title/description edits must not change status KPI unless another canonical rule requires it.

---

# PART IV — R11 — MUTABLE PRIORITY

## 6. BUSINESS RULE

Priority is mutable during Case lifecycle.

Conceptual distinction:

```text
Status   = where the Case is in workflow
Priority = urgency/business importance
```

They are independent.

Examples:

```text
WAITING_PARTNER + CRITICAL
IN_PROGRESS     + LOW
ESCALATED       + HIGH
```

Never implement:

```text
ESCALATED => CRITICAL
CLOSED    => LOW
```

as automatic coupling.

---

## 7. REUSE CANONICAL CASE PRIORITY

Audit current `CasePriority`.

Reuse the existing enum exactly.

Do not create a duplicate enum.

---

## 8. SERVER-AUTHORITATIVE PRIORITY UPDATE

First determine whether existing Case update authority already safely supports Priority.

If yes, reuse it.

If not, add the minimum required server-side mutation.

Requirements:

```text
authentication
explicit effective permission
Case existence validation
CasePriority enum validation
tenant/workspace authority
controlled 403/404/422
CaseHistory event
```

Do not trust a frontend-provided actor.

---

## 9. PRIORITY UI

On `/app/support/[id]` use the same compact field/dropdown design language as Status/filter controls:

```text
Приоритет
[ Средний ▼ ]
```

Authorized actor:

```text
editable
```

Unauthorized actor:

```text
read-only
```

No role hardcoding.

After mutation:

```text
detail refresh
list refresh
history refresh
page refresh preserves value
```

KPI remains unchanged.

---

# PART V — R12 — CASE EDITING

## 10. EDITABLE VS IMMUTABLE FIELDS

A Support Case must support controlled editing.

Expected editable business fields, subject to actual canonical model:

```text
title
description
type
priority
```

Assignment remains separate R4 and must not be faked.

Status remains lifecycle mutation, not generic edit.

### Immutable identity/audit fields

Do not make these ordinary editable fields:

```text
SUP-* business code
createdAt
creator
CaseHistory
deletedAt/deletedBy/deletionReason directly
```

Relations such as Customer/Order/Booking must only be editable if canonical Step 3.10/3.11 authority explicitly permits it.

---

## 11. EDIT UX

Use the dedicated detail route already introduced:

```text
/app/support/[id]
```

Choose a repository-consistent pattern such as:

```text
[Редактировать]
```

leading to controlled edit state/page.

Do not return to the old page-compressing right `PanelFrame` for the full edit workflow.

A short confirmation dialog remains acceptable where appropriate.

---

## 12. EDIT PERMISSION

Audit existing Support permissions.

Reuse an existing semantically correct update permission if available, expected conceptually:

```text
support.case.update
```

Do not invent a new permission unless the current permission model cannot express the authority safely.

Backend is final authority.

---

## 13. VALIDATION

Validate:

```text
title requirements
description limits if canonical
CaseType
CasePriority
immutable fields ignored/rejected
unknown fields
```

No raw Prisma errors.

---

# PART VI — R13 — ADMIN CONTROLLED SOFT DELETE

## 14. DELETION BUSINESS POLICY

Support Cases must not have ordinary unrestricted physical deletion.

However, ADMIN must be able to remove an accidentally created Case through a controlled administrative operation.

Required default authority:

```text
support.case.delete
→ ADMIN only
```

Do not mass-grant this permission.

Other roles may receive it only through explicit future canonical RBAC administration, not by this task's default seed.

---

## 15. SOFT DELETE, NOT HARD DELETE

Preferred required model:

```text
deletedAt
deletedBy
deletionReason
```

Use naming/types consistent with repository conventions after gap audit.

Deletion means:

```text
Case removed from ordinary operational views
Case preserved for audit/governance
```

Do not destroy CaseHistory.

Do not cascade-delete operational/audit history merely because the Case is hidden.

---

## 16. DELETE REASON

Deletion requires a non-empty administrative reason.

Conceptual dialog:

```text
Удалить обращение SUP-00000004?

Удаление предназначено для ошибочно созданных обращений.

Причина удаления *
[ Создано по ошибке                         ]

[Отмена] [Удалить]
```

The reason is internal administrative data.

Do not expose it to customer/partner/public contexts.

---

## 17. DELETE CONFIRMATION

Deletion must require an explicit confirmation step.

No one-click destructive icon with immediate mutation.

---

## 18. MATERIAL-HISTORY SAFEGUARD

Audit what constitutes a materially worked Case.

At minimum consider:

```text
customer-facing/internal comments
Communication links
multiple lifecycle transitions
assignment activity
linked transaction/business context
other substantive Support actions
```

Implement a conservative server-authoritative safeguard.

Preferred behavior:

```text
accidentally created / minimally touched Case
→ ADMIN soft delete allowed

materially worked Case
→ delete blocked
→ user instructed to Close the Case instead
```

Do not rely only on frontend checks.

Document the exact rule.

Do not invent a broad destructive override unless canonical governance explicitly requires it.

---

## 19. DELETE API / PERMISSION

If no canonical delete mutation exists, implement a minimal Support-domain endpoint/service method.

Requirements:

```text
support.case.delete
ADMIN default grant
server authority
reason required
Case existence validation
already-deleted handling
material-history safeguard
audit
controlled 403/404/409/422 as appropriate
```

Use an idempotent RBAC migration following existing project conventions.

Remember:

```text
migration file exists ≠ migration applied
```

Runtime evidence must prove application.

---

## 20. DELETE UI

Only actor with effective `support.case.delete` sees the administrative delete action.

Use a secondary/destructive action location, not the primary workflow control.

After successful deletion:

```text
navigate to /app/support
Case absent from ordinary list
Case excluded from KPI
Case absent from ordinary search/filter results
```

Do not show delete control to unauthorized roles.

---

# PART VII — R14 — COMPLETE CASE HISTORY

## 21. HISTORY IS APPEND-ONLY

`CaseHistory` remains immutable/additive.

No UI:

```text
edit history
delete history
rewrite history
```

---

## 22. EVENTS THAT MUST BE AUDITED

After gap audit, ensure significant Support changes create history.

At minimum:

```text
CASE_CREATED
STATUS_CHANGED
PRIORITY_CHANGED
TITLE_CHANGED
DESCRIPTION_CHANGED
TYPE_CHANGED
ASSIGNEE_CHANGED       — when assignment capability becomes available
RELATION_CHANGED       — if canonical relation mutation exists
COMMUNICATION_LINKED   — when canonical UI/API action is used
CASE_DELETED           — administrative soft deletion
```

Do not force fake events for features still canonically deferred.

Use repository-consistent event representation.

---

## 23. OLD → NEW VALUES

For structured changes, history should preserve enough information for presentation:

```text
oldValue
newValue
```

Examples:

```text
Status:
OPEN → IN_PROGRESS

Priority:
MEDIUM → HIGH

Type:
ORDER_ISSUE → PAYMENT_ISSUE
```

For text changes, preserve auditability without creating an unsafe/unbounded duplicate data model.

At minimum history must indicate that Title/Description changed and preserve the canonical audit detail supported by the project's audit conventions.

Do not expose sensitive historical content to actors who should not see it.

---

## 24. ACTOR / TIMESTAMP

Every history event:

```text
actor
timestamp
```

Actor comes from authenticated server context.

Never trust `changedBy` from request body.

---

## 25. LOCALIZED HISTORY PRESENTATION

Raw audit values must not appear as ordinary UI.

Forbidden normal presentation:

```text
created
status:IN_PROGRESS
priority:HIGH
OPEN → IN_PROGRESS
```

Expected localized presentation conceptually:

```text
Статус изменён
Открыто → В работе
Administrator · 30.08.2026 03:10

Приоритет изменён
Средний → Высокий
Administrator · 30.08.2026 03:15

Заголовок изменён
Administrator · 30.08.2026 03:20
```

AZ/RU/EN must use i18n.

Reuse/extend `HISTORY_EVENT_MAP`; do not scatter event translations across JSX.

Unknown future event type must degrade safely and must not crash the page.

---

# PART VIII — R4 ASSIGNMENT REMAINS EXPLICIT

## 26. DO NOT FAKE ASSIGNEE SUPPORT

Previous remediation reported:

```text
R4 CANONICALLY DEFERRED — no eligible assignee API
```

Re-check that statement.

If still true:

```text
keep R4 deferred
document exact gap
```

Do not fetch all Users and treat them as Support employees.

Do not create a broad employee API inside this task merely to close R4.

If an eligible canonical API now exists, report it before expanding scope.

---

# PART IX — PERMISSION MODEL

## 27. REQUIRED PERMISSION MATRIX

Audit and document actual permissions for:

```text
read Case
create Case
update Case
change lifecycle status
change Priority
delete Case
assign Case
```

No role hardcoding in frontend.

For new deletion permission default:

```text
ADMIN = granted
all other roles = not granted by default
```

unless an existing canonical matrix explicitly dictates otherwise.

---

# PART X — SECURITY / NEGATIVE TESTS

## 28. REQUIRED ATTACKS

### Delete

```text
ADMIN + permission + valid accidental Case + reason
→ success

ADMIN + no reason
→ controlled rejection

non-ADMIN without permission
→ 403

direct API without permission
→ 403

materially worked Case
→ deletion blocked according to safeguard

already deleted Case
→ controlled behavior
```

### Edit

```text
read-only actor
→ no Edit UI
→ direct update 403

invalid enum
→ controlled 400/422

attempt to edit immutable field
→ ignored/rejected safely
```

### Priority

```text
unauthorized actor → 403
invalid priority → controlled rejection
```

### Status

```text
invalid/stale transition → 422
no false success
```

---

# PART XI — KPI / DELETION CONSISTENCY

## 29. SOFT-DELETED CASES

Ordinary Support KPI universe excludes soft-deleted Cases.

Invariant applies to non-deleted Cases:

```text
TOTAL =
OPEN
+ IN_PROGRESS
+ WAITING_CUSTOMER
+ WAITING_PARTNER
+ WAITING_INTERNAL
+ ESCALATED
+ RESOLVED
+ CLOSED
```

Admin audit access to deleted records, if any, must not accidentally reintroduce them into ordinary KPI.

Do not implement a full Trash/Restore Center unless canonical roadmap requires it.

---

# PART XII — UI CONSISTENCY

## 30. USE ONE CONTROL LANGUAGE

Status, Priority and filters should use a coherent compact dropdown/select design language.

Conceptually:

```text
Статус
[ В работе ▼ ]

Приоритет
[ Высокий ▼ ]
```

This does not mean they share business logic.

```text
Status dropdown
→ lifecycle transitions

Priority dropdown
→ priority values

Filter dropdown
→ query/filter state
```

Reuse shared primitives where practical.

---

# PART XIII — AUTOMATED TESTS

## 31. ADD TARGETED TESTS

Add meaningful tests for:

```text
Status dropdown only exposes expected transitions
Priority permission + mutation
Priority history event
Case editing permission
Case editing validation
CaseHistory events
history localization mapping
7 KPI including WAITING aggregation
KPI refresh after status mutation
ADMIN delete success
delete reason required
non-ADMIN delete denied
material-history delete safeguard
soft-deleted Case excluded from list/KPI
```

If backend and frontend tests belong in different suites, place them appropriately.

Do not rely only on snapshots.

---

## 32. FULL REGRESSION

Run and report actual counts:

```text
Frontend full tests
Frontend TSC
Frontend Build

Backend Support tests
Backend Communication tests
Backend TSC
```

Previous counts are baseline only, not expected final counts.

---

# PART XIV — MIGRATION EVIDENCE

## 33. IF SCHEMA/RBAC MIGRATIONS ARE ADDED

Run:

```bash
npx prisma migrate deploy
npx prisma migrate status
```

Prove new migration is applied to the tested runtime DB.

Do not repeat the previous mistake where migration existed but runtime DB lacked it.

---

# PART XV — REAL BROWSER RE-QUALIFICATION

## 34. ADMIN WORKFLOW

Real browser, not source-only:

```text
login fresh
Support sidebar visible
open /app/support

verify 7 KPI
verify WAITING card

open Case detail
verify Status filter-style dropdown
verify no lifecycle button row

change Status
verify detail/list/KPI/history converge

change Priority
verify detail/list/history
refresh and verify persistence

edit title/description/type
verify persistence
verify localized history events

create accidental Case
delete as ADMIN
enter required reason
confirm
verify Case disappears from list/KPI
```

---

## 35. READ/UPDATE ROLE

Use a representative actor without delete permission.

Verify:

```text
Case readable according to permissions
Edit only if update permission exists
Delete action absent
direct delete API denied
```

---

## 36. DENIED ACTOR

Verify:

```text
Support sidebar hidden where read denied
direct route safe
no data leak
```

---

# PART XVI — CONSOLE / NETWORK

## 37. HARD GATE

After representative browser workflows:

```text
console errors:   0
console warnings: 0
```

Classify every non-zero result.

Network:

```text
no request storm
no duplicate mutations
no raw 500
no repeated permission loop
```

Controlled negative 403/409/422 is acceptable during deliberate negative tests.

---

# PART XVII — REPORT

## 38. CREATE REPORT

Create:

```text
docs/prompts/PHASE_3_STEP_3.11_TARGETED_FOLLOW_UP_REMEDIATION_R5_R10_R14_REPORT.md
```

Report predominantly in Russian.

Required sections:

```text
1. Starting SHA
2. Gap audit
3. R5 Status dropdown
4. R10 KPI model
5. R11 Priority management
6. R12 Case editing
7. R13 ADMIN soft deletion
8. R14 complete CaseHistory
9. R4 assignment re-check
10. Permission matrix
11. Schema/migration changes
12. Security/negative evidence
13. Automated tests
14. Browser evidence
15. Console/network
16. Findings closure
17. Files changed
18. Git evidence
19. Final verdict
20. Exact next action
```

---

# PART XVIII — CLOSURE MATRIX

## 39. REQUIRED RESULT

```text
R5  CLOSED — filter-style Status dropdown, no lifecycle button sprawl
R10 CLOSED — 7 KPI, WAITING aggregate, lifecycle coverage invariant
R11 CLOSED — Priority mutable, permission-safe, audited
R12 CLOSED — controlled Case editing, audited
R13 CLOSED — ADMIN-only controlled soft deletion
R14 CLOSED — complete append-only localized CaseHistory
```

R4 may remain:

```text
CANONICALLY DEFERRED
```

only with explicit evidence that eligible-assignee authority/API remains unavailable.

---

# PART XIX — VERDICT

## 40. VERDICT A

Only when R5 and R10–R14 are proven closed:

```text
VERDICT A — PHASE 3 — STEP 3.11 SUPPORT CENTER UI — TARGETED FOLLOW-UP RE-QUALIFICATION APPROVED

R5 CLOSED
R10 CLOSED
R11 CLOSED
R12 CLOSED
R13 CLOSED
R14 CLOSED

STEP 3.11 CLOSED
```

---

## 41. VERDICT B

If any material requirement remains:

```text
VERDICT B — PHASE 3 — STEP 3.11 SUPPORT CENTER UI — TARGETED FOLLOW-UP RE-QUALIFICATION FAILED

STEP 3.11 REMAINS OPEN
```

List exact unresolved findings.

---

# PART XX — ROADMAP / HISTORY

## 42. PRESERVE HISTORY

Do not erase or rewrite:

```text
619a970
624cc39
755c3d8
```

Append remediation evidence according to canonical roadmap convention.

Do not silently renumber roadmap stages.

Do not start Step 3.12 automatically.

---

# PART XXI — STOREFRONT SUPPORT ARCHITECTURE FOLLOW-UP — RECORD, DO NOT IMPLEMENT

## 43. IMPORTANT FUTURE ARCHITECTURE QUESTION

During this Support Center review a separate product requirement has been identified:

```text
Storefront Pro also needs a Support model.
```

This task must **not** simply expose Platform Support Center to Storefront Partner.

Record this as an architecture/gap-audit follow-up in the roadmap/report.

### Required conceptual separation

At minimum distinguish:

```text
A. PLATFORM SUPPORT
   TravelHub internal support operations

B. PARTNER ↔ TRAVELHUB SUPPORT
   Storefront/Marketplace Partner contacts TravelHub about:
   account
   subscription
   billing
   platform incidents
   integration
   payouts/settlement questions
   policy/compliance
   technical issues

C. STOREFRONT CUSTOMER SUPPORT
   Storefront Partner supports its own direct customers
   for its own Orders/Bookings/services
```

These are not automatically the same queue, permissions or ownership model.

### Critical Storefront boundary

Storefront Pro is a partner's own business/site on TravelHub infrastructure.

Therefore:

```text
Storefront customer
→ Storefront Partner support operation

is not the same as:

Storefront Partner
→ TravelHub Platform Support
```

Do not collapse both into one generic Case ownership model without an architecture audit.

### Marketplace boundary

Also preserve the existing communication rule:

```text
Marketplace Customer ↔ Marketplace Partner
```

is TravelHub-mediated and must not accidentally gain unrestricted direct support/contact capability through Storefront Support work.

### Future audit must answer

Record a future architecture task to determine:

```text
Who can create each Case type?
Who owns each Case?
Who can see it?
Which workspace hosts it?
Platform Support vs Partner Support permissions
Marketplace Basic entitlement
Storefront Pro entitlement
direct Storefront customer relationship
Communication integration
Customer/Order/Booking scope
SLA ownership
internal vs customer-visible comments
moderation boundary
audit
tenant isolation
analytics
escalation from Partner Support → Platform Support
whether one support.Case domain can safely serve multiple contexts
or context-specific projections/relations are required
```

### Entitlement rule

Do not assume:

```text
PARTNER role = Support access
```

and do not assume:

```text
Storefront Pro = Platform support.case.* permissions
```

Any future Partner/Storefront Support must follow:

```text
Workspace Context
→ Entitlement
→ Business Capability
→ Permission
→ scoped data/action
```

### Current task behavior

For this remediation:

```text
DO NOT implement Storefront Support
DO NOT grant PARTNER support.case.*
DO NOT add Partner sidebar Support item
DO NOT create speculative APIs
```

Only record the architecture follow-up so it cannot be forgotten after Step 3.11.

---

# PART XXII — FINAL RESPONSE

## 44. RETURN

Return in Russian:

```text
Starting SHA
Remediation SHA
Final HEAD/origin

R5 status
R10 status
R11 status
R12 status
R13 status
R14 status
R4 status

KPI model
Status UX
Priority result
Editing result
Deletion result
History result

migration status
test counts
browser evidence
console/network

Storefront Support architecture follow-up recorded: YES/NO

Final VERDICT
Exact next action
```

---

# PART XXIII — STOP

## 45. STOP

After completion:

```text
STOP
```

Do not auto-start Step 3.12.

Do not implement Storefront Support in this task.
