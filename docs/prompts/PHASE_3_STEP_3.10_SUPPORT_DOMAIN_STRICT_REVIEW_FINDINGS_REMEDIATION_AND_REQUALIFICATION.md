# PHASE 3 — STEP 3.10 — SUPPORT DOMAIN — STRICT REVIEW FINDINGS REMEDIATION + RE-QUALIFICATION

## 0. TASK MODE

**TARGETED REMEDIATION + RE-QUALIFICATION.**

Current status:

```text
VERDICT B — PHASE 3 — STEP 3.10 SUPPORT DOMAIN — STRICT REVIEW FAILED

STEP 3.10 REMAINS OPEN
NEXT ACTION: TARGETED REMEDIATION REQUIRED
```

Baseline:

```text
Implementation SHA:   7d638ef
Strict Review SHA:    ff64a83
Expected HEAD/origin: ff64a83
```

Strict Review findings:

| ID | Severity | Description |
|---|---|---|
| F1 | P1 | `support.case.*` RolePermission rows отсутствуют — Support API полностью недоступен (403 для всех ролей) |
| F2 | P2 | `getCase` возвращает ALL comments включая internal без фильтрации по actor authority |
| F3 | P2 | `createCase` / `assignCase` не валидируют существование related entities (`customer/order/booking/assignee`) |
| F4 | P3 | `escalateCase` обходит `VALID_TRANSITIONS`, дублирует transition endpoint |
| F5 | P3 | `linkCommunication` не валидирует существование `communicationId` |

Verified PASS from Strict Review:

```text
Domain authority: no duplicate authority
Lifecycle: complete graph, no deadlock, CLOSED terminal, reopen supported
Validation: enums validated before Prisma, controlled 4xx
CaseHistory: append-only, actor from auth context
Support: 24/24 PASS
Communication: 44/44 PASS
Backend TSC: PASS
HEAD == origin/master == ff64a83
```

Цель задачи:

```text
ремедировать F1–F5
→ добавить regression tests
→ выполнить real runtime re-qualification
→ повторно проверить security/runtime gates
→ выдать финальный VERDICT A/B
```

**Не начинать Step 3.11.**

---

# 1. LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые reports и prose documentation должны быть преимущественно **на русском языке**.

На русском обязательны:

- Remediation Report;
- findings closure evidence;
- root cause analysis;
- security explanations;
- runtime evidence;
- regression evidence;
- conclusions;
- verdict explanations.

Английский допускается только для:

- file paths;
- class/method/DTO/model/table names;
- API endpoints;
- HTTP methods/status codes;
- CLI/Git commands;
- enum names;
- permission identifiers;
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
git log -20 --oneline
```

Ожидаемо:

```text
HEAD:          ff64a83
origin/master: ff64a83
```

Если baseline отличается — установить причину до remediation.

Не изменять/stage unrelated dirty files.

---

## 3. READ STRICT REVIEW REPORT

Открыть actual:

```text
docs/prompts/PHASE_3_STEP_3.10_SUPPORT_DOMAIN_STRICT_REVIEW_REPORT.md
```

или фактический canonical equivalent.

Для F1–F5 извлечь:

```text
exact evidence
affected files
observed runtime behavior
required remediation
re-qualification gate
```

Не ремедировать по краткому summary, если full report содержит дополнительные детали.

---

# PART II — F1 P1 — SUPPORT PERMISSION ROWS MISSING

## 4. ROOT CAUSE

Проверить actual permission architecture:

```text
permission registry
RolePermission storage
seed/default role matrix
migration/seed bootstrap
authorization guard
runtime lookup
```

Найти причину, почему permission identifiers существуют в code, но runtime `RolePermission` rows отсутствуют.

Не лечить проблему frontend workaround или special-case bypass.

---

## 5. CANONICAL SUPPORT PERMISSIONS

Проверить exact Step 3.10 permission set.

Reported:

```text
support.case.create
support.case.read
support.case.update
support.case.assign
```

Если actual code/roadmap содержит иной набор — использовать canonical set.

Не добавлять speculative permissions.

---

## 6. DEFAULT ROLE MATRIX

Expected reported defaults:

| Permission | ADMIN | OPERATOR | DIRECTOR | PARTNER | FINANCE |
|---|---:|---:|---:|---:|---:|
| support.case.create | ✅ | ✅ | ❌ | ❌ | ❌ |
| support.case.read | ✅ | ✅ | ✅ | ❌ | ❌ |
| support.case.update | ✅ | ✅ | ❌ | ❌ | ❌ |
| support.case.assign | ✅ | ✅ | ❌ | ❌ | ❌ |

Но проверить **все actual internal roles**:

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

Для каждой роли определить exact defaults из canonical roadmap/permission model.

---

## 7. PERSISTED ROLEPERMISSION AUTHORITY

Исправление должно гарантировать, что runtime authorization действительно видит permissions.

Допустимые направления — только согласно существующей architecture:

```text
seed
migration
bootstrap synchronization
idempotent permission seeding
```

Не создавать parallel permission store.

Hard requirements:

```text
idempotent
safe on repeated startup/seed
no duplicate rows
no destructive reset
existing custom grants preserved where architecture requires
```

---

## 8. F1 RUNTIME GATE

После remediation доказать real runtime:

```text
ADMIN:
create/read/update/assign → allowed

OPERATOR:
create/read/update/assign → allowed

DIRECTOR:
read → allowed
create/update/assign → denied

PARTNER:
support endpoints → denied

FINANCE:
support endpoints → denied

other non-entitled roles:
denied according canonical matrix

anonymous:
401
```

Не считать unit test достаточным.

---

# PART III — F2 P2 — INTERNAL COMMENT DISCLOSURE

## 9. ROOT CAUSE

Проверить:

```text
getCase
list comments
Prisma include/select
DTO serialization
role/actor visibility policy
```

Определить, почему internal comments попадают в response без actor-authority filtering.

---

## 10. SERVER-SIDE VISIBILITY AUTHORITY

Исправление обязательно должно быть server-authoritative.

Запрещено считать исправлением:

```text
frontend filter
hidden UI
CSS
client-side removal
```

Backend должен строить response только из разрешённых comments.

---

## 11. DEFINE COMMENT VISIBILITY RULE

Использовать actual canonical semantics.

Для каждого actor/context определить:

```text
can see internal comments?
can see customer-facing comments?
can create internal comments?
can create customer-facing comments?
```

Если current Step 3.10 API Platform-internal only, всё равно не возвращать internal data через generic DTO, который позже может быть exposed externally.

Если distinction нужен только для future actor paths, зафиксировать это явно и реализовать safest canonical projection.

---

## 12. UNIQUE MARKER TEST

Regression/runtime:

```text
INTERNAL_SECRET_<unique>
CUSTOMER_VISIBLE_<unique>
```

Проверить:

```text
authorized internal actor sees what is allowed
restricted actor/context never receives INTERNAL_SECRET
generic case detail does not blindly include all comments
```

Если PARTNER/BUYER endpoint отсутствует, проверить все existing surfaces и response serializers.

---

## 13. AUTHORSHIP / VISIBILITY SPOOFING

Проверить, что caller не может spoof:

```text
authorId
createdBy
visibility/internal flag
```

в обход permission policy.

---

# PART IV — F3 P2 — RELATED ENTITY VALIDATION

## 14. INVENTORY ACTUAL REFERENCES

Определить fields, которые реально принимает `createCase` / `assignCase`.

Reported candidates:

```text
customerId
orderId
bookingId
assigneeId
```

Проверить также:

```text
partnerId
paymentId
refundId
communicationId
```

если присутствуют.

---

## 15. CUSTOMER VALIDATION

Если `customerId` поддерживается:

```text
existence
correct canonical domain
scope/context compatibility
```

Nonexistent ID → controlled `404/422`, не Prisma 500.

---

## 16. ORDER VALIDATION

Если `orderId` поддерживается:

```text
Order exists
Order relation compatible with Case actor/scope
wrong partner/customer injection rejected
```

Support не должен принимать arbitrary Order UUID.

---

## 17. BOOKING VALIDATION

Если `bookingId` поддерживается:

```text
Booking exists
scope compatible
relation type correct
```

Cross-partner relation → deny.

---

## 18. ASSIGNEE VALIDATION

`assignCase` должен проверять не только существование User.

Проверить:

```text
User exists
internal workspace membership
eligible role
support permission where required
not BUYER
not PARTNER
not foreign workspace
```

Не принимать arbitrary valid UUID.

---

## 19. CONSISTENT RELATION SET

Если Case содержит одновременно несколько references:

```text
customerId
orderId
bookingId
partnerId
```

проверить их взаимную согласованность.

Пример:

```text
Order belongs to Customer A
Case customerId = Customer B
```

должен быть rejected, если canonical model требует consistency.

---

## 20. F3 NEGATIVE MATRIX

Regression/runtime минимум:

```text
nonexistent customer
nonexistent order
nonexistent booking
nonexistent assignee

wrong-scope order
wrong-scope booking
ineligible assignee
mixed inconsistent relations
```

Expected:

```text
controlled 4xx
no Case partial mutation
no false CaseHistory
no orphan relation
```

---

# PART V — F4 P3 — ESCALATECASE DUPLICATES TRANSITION AUTHORITY

## 21. SINGLE LIFECYCLE AUTHORITY

Сейчас finding:

```text
escalateCase
обходит VALID_TRANSITIONS
и дублирует transition endpoint
```

Исправить так, чтобы lifecycle имел **одну canonical transition authority**.

Предпочтительно:

```text
escalateCase
→ delegates to common transition method
→ same VALID_TRANSITIONS
→ same validation
→ same history/audit
→ same authorization
```

или удалить duplicate endpoint/path, если roadmap не требует отдельный escalation action.

Не копировать transition logic второй раз.

---

## 22. F4 GATES

Проверить:

```text
allowed escalation → success
invalid escalation source state → controlled 422
CLOSED → ESCALATED denied
history identical to canonical transition behavior
no double history entry
```

---

# PART VI — F5 P3 — COMMUNICATION LINK EXISTENCE VALIDATION

## 23. COMMUNICATION AUTHORITY

`linkCommunication` должен ссылаться на существующий canonical Communication domain.

Перед insert проверить:

```text
communication exists
correct scope
actor allowed to link it
case/communication context compatible
```

---

## 24. DUPLICATE LINK

Проверить uniqueness/duplicate behavior.

Expected:

```text
duplicate link → controlled 409 or canonical idempotent behavior
```

Не raw unique-constraint 500.

---

## 25. F5 NEGATIVE MATRIX

Runtime:

```text
nonexistent communicationId
cross-scope communicationId
duplicate communicationId
```

Expected:

```text
controlled 4xx
no partial mutation
no invalid CaseCommunicationLink
```

---

# PART VII — TESTS

## 26. FINDING-SPECIFIC REGRESSION TESTS

Добавить tests минимум:

### F1

```text
permissions persisted
ADMIN allowed
OPERATOR allowed
DIRECTOR read-only
PARTNER denied
FINANCE denied
```

### F2

```text
internal comment filtered for restricted projection
customer-facing comment preserved
authorship/visibility spoof blocked
```

### F3

```text
nonexistent customer reject
nonexistent order reject
nonexistent booking reject
nonexistent/ineligible assignee reject
cross-scope relation reject
```

### F4

```text
escalation uses canonical transition authority
invalid source rejected
no double history
```

### F5

```text
nonexistent communication reject
cross-scope communication reject
duplicate handled controlled
```

---

## 27. EXISTING REGRESSIONS

Обязательно прогнать:

```text
Support suite
Communication suite
RBAC/security relevant tests
CRM tests if relation validation touches CRM
Order/Booking tests if related services/repos touched
Backend TSC
```

Marketing regression optional unless shared permission/seeding changes impact global permission infrastructure.

Если permission seed/bootstrap изменён глобально — прогнать broader RBAC regression.

---

# PART VIII — REAL RUNTIME RE-QUALIFICATION

## 28. RUNTIME IS REQUIRED

Не закрывать findings по source/tests alone.

Использовать real backend + real DB + real auth.

---

## 29. F1 REAL RUNTIME

Доказать exact role matrix через actual API.

Зафиксировать HTTP status и endpoint/action для каждого representative role.

---

## 30. F2 REAL RUNTIME

Создать unique internal/customer-facing comments и доказать allowed/denied projection.

Показать response evidence без раскрытия sensitive credentials.

---

## 31. F3 REAL RUNTIME

Провести nonexistent + cross-scope relation attacks и доказать:

```text
controlled 4xx
no persisted Case/relation
no false history
```

---

## 32. F4 REAL RUNTIME

Проверить allowed + invalid escalation path.

---

## 33. F5 REAL RUNTIME

Проверить nonexistent/cross-scope/duplicate Communication link.

---

# PART IX — SECURITY / DATA INTEGRITY RECHECK

## 34. NO PARTIAL MUTATION

После каждого rejected action проверить persisted state.

Hard gate:

```text
no partial Case update
no invalid FK relation
no false history
no orphan link
```

---

## 35. NO ERROR LEAKAGE

Все новые negative paths должны возвращать controlled domain/API errors.

Запрещено:

```text
Prisma stack
SQL text
constraint internals
raw database errors
unexpected 500
```

---

# PART X — STRICT REVIEW FINDING CLOSURE MATRIX

## 36. REQUIRED TABLE

В Remediation Report:

| Finding | Severity | Root cause | Fix | Automated evidence | Runtime evidence | Status |
|---|---:|---|---|---|---|---|
| F1 | P1 | | | | | CLOSED/OPEN |
| F2 | P2 | | | | | CLOSED/OPEN |
| F3 | P2 | | | | | CLOSED/OPEN |
| F4 | P3 | | | | | CLOSED/OPEN |
| F5 | P3 | | | | | CLOSED/OPEN |

Нельзя ставить CLOSED без runtime evidence для F1–F5.

---

# PART XI — REPORT

## 37. CREATE REMEDIATION REPORT

Создать:

```text
docs/prompts/PHASE_3_STEP_3.10_SUPPORT_DOMAIN_STRICT_REVIEW_FINDINGS_REMEDIATION_REPORT.md
```

Минимальная структура:

```text
1. Baseline
2. Strict Review findings
3. F1 root cause / fix / evidence
4. F2 root cause / fix / evidence
5. F3 root cause / fix / evidence
6. F4 root cause / fix / evidence
7. F5 root cause / fix / evidence
8. Permission matrix
9. Comment visibility matrix
10. Related entity validation matrix
11. Communication validation
12. Lifecycle authority
13. Automated tests
14. Runtime re-qualification
15. Security/data-integrity evidence
16. Files changed
17. Git evidence
18. Finding closure matrix
19. Final verdict
20. Required next action
```

---

# PART XII — GIT POLICY

## 38. DIFF REVIEW

Перед commit:

```bash
git status --short
git diff --name-only
git diff
```

Проверить:

```text
only F1–F5 remediation
no Step 3.11
no unrelated refactor
no unrelated Marketing work
no speculative Support UI
```

---

## 39. COMMIT / PUSH

Пример:

```bash
git add <task-owned-files>
git commit -m "fix(support): remediate Step 3.10 strict review findings"
git push origin master

git rev-parse HEAD
git rev-parse origin/master
```

Зафиксировать:

```text
Starting SHA:          ff64a83
Remediation SHA:       <real SHA>
Final HEAD:            <real SHA>
origin/master:         <real SHA>
HEAD == origin/master: YES/NO
```

---

# PART XIII — RE-QUALIFICATION VERDICT

## 40. VERDICT A GATE

Только если:

```text
F1 CLOSED
F2 CLOSED
F3 CLOSED
F4 CLOSED
F5 CLOSED

support permission rows actually persisted
runtime role matrix correct

internal comments filtered server-side
no visibility/authorship spoof

customer/order/booking/assignee validations complete
cross-scope relation injection denied
no partial mutations

escalation uses single canonical transition authority
no duplicate lifecycle logic

Communication existence/scope/duplicate validation complete

Support regressions PASS
Communication regressions PASS
relevant RBAC/CRM/Order/Booking regressions PASS
Backend TSC PASS

real runtime re-qualification PASS
no raw 500/error leakage

report predominantly Russian
Git closure complete
HEAD == origin/master
```

Тогда:

```text
VERDICT A — PHASE 3 — STEP 3.10 SUPPORT DOMAIN — STRICT REVIEW RE-QUALIFICATION APPROVED

F1 CLOSED
F2 CLOSED
F3 CLOSED
F4 CLOSED
F5 CLOSED

STEP 3.10 CLOSED
```

---

## 41. VERDICT B GATE

Если любой material finding остаётся:

```text
VERDICT B — PHASE 3 — STEP 3.10 SUPPORT DOMAIN — STRICT REVIEW RE-QUALIFICATION FAILED

STEP 3.10 REMAINS OPEN
```

Указать exact remaining finding и blocker.

Не маскировать P1/P2 как deferred.

---

# PART XIV — ROADMAP

## 42. ROADMAP CLOSURE

Если и только если final re-qualification = `VERDICT A`, обновить canonical roadmap согласно существующей additive convention:

```text
Step 3.10 implementation SHA
Strict Review SHA
Remediation/Re-Qualification SHA
final CLOSED status
```

Сохранить историческую цепочку:

```text
Implementation A
→ Strict Review B
→ Findings remediation
→ Re-Qualification A
```

Не переписывать Strict Review B как будто его не было.

Если VERDICT B — roadmap completed boundary не двигать.

---

# PART XV — STOP CONDITION

## 43. STOP

После remediation + re-qualification:

```text
STOP
```

Даже при:

```text
STEP 3.10 CLOSED
```

не начинать автоматически:

```text
Step 3.11
Support UI
Support Analytics
AI Support
Dispute implementation
Marketing/Promotion work
```

Вернуть пользователю:

```text
F1–F5 closure status
test counts
runtime/security evidence
real remediation SHA
final HEAD/origin
final VERDICT
canonical roadmap state
exact CANONICAL NEXT if roadmap is updated
```

и дождаться отдельного запроса.
