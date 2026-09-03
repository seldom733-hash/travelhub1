# PHASE 3 — STEP 3.10 — SUPPORT DOMAIN — STRICT REVIEW

## 0. REVIEW MODE

**INDEPENDENT STRICT REVIEW / RE-QUALIFICATION TASK.**

Review target:

```text
PHASE 3 — STEP 3.10 — SUPPORT DOMAIN
Implementation SHA: 7d638ef
Expected HEAD/origin: 7d638ef
```

Implementation status `IMPLEMENTATION COMPLETE / READY FOR SEPARATE STRICT REVIEW` не является доказательством закрытия Step 3.10.

Цель — независимо проверить canonical scope, source/schema, lifecycle, RBAC, relation integrity, Communication integration, comment visibility, audit/history и реальный runtime.

**Не исправлять production code в рамках Strict Review.** Найденный material defect фиксируется как finding; remediation выполняется отдельной задачей.

## LANGUAGE REQUIREMENT — MANDATORY

Все reports, findings, architecture/security explanations, runtime evidence, conclusions и verdict explanations — преимущественно **на русском языке**. Английский допустим только для технических идентификаторов, путей, API, enum/permission names, команд, кода, commit messages и standardized VERDICT strings.

Преимущественно английский report = review incomplete.

---

## 1. PREFLIGHT

Выполнить:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git log -25 --oneline
git diff 62828f0..7d638ef --stat
git diff 62828f0..7d638ef --name-only
git diff 62828f0..7d638ef
```

Ожидаемо `HEAD == origin/master == 7d638ef`.

Прочитать actual canonical roadmap и **заново** извлечь exact Step 3.10: scope, objects, lifecycle, actors, permissions, relations, security gates, tests, deferrals и out-of-scope. Roadmap имеет приоритет над Implementation Report.

---

## 2. DOMAIN AUTHORITY / ANTI-DUPLICATION

Независимо проверить reported models:

```text
support.Case
support.CaseComment
support.CaseCommunicationLink
support.CaseHistory
```

Для Customer, Partner, Order, Booking, Payment, Refund, Communication, Message, CRM Activity, Operational Notes, Audit и Dispute классифицировать integration:

```text
REUSED_CANONICAL_AUTHORITY
LEGITIMATE_SUPPORT_EXTENSION
DUPLICATE_AUTHORITY
UNCLEAR
```

Support может владеть Support Case lifecycle, но не должен создавать второй Customer/Partner/Order/Booking/Payment/Communication/Activity/Dispute authority.

Material duplicate authority = blocking finding.

---

## 3. LIFECYCLE — HIGH-PRIORITY ATTACK

Reported transitions:

```text
OPEN → IN_PROGRESS, WAITING_CUSTOMER, WAITING_PARTNER,
       WAITING_INTERNAL, ESCALATED, CLOSED

IN_PROGRESS → RESOLVED, CLOSED, ESCALATED

RESOLVED → CLOSED, OPEN

CLOSED → terminal
```

Построить **полную actual transition matrix** из production code:

| From | To | Allowed | Canonical? | Runtime evidence |
|---|---|---:|---:|---|

Особенно проверить:

```text
WAITING_CUSTOMER → ?
WAITING_PARTNER → ?
WAITING_INTERNAL → ?
ESCALATED → ?
```

Каждый non-terminal state должен иметь canonical выход. Если case можно перевести в состояние, из которого невозможно продолжить lifecycle, это минимум **P2**.

Отдельно проверить:
- соответствует ли canonical rule запрет/разрешение `OPEN → RESOLVED`;
- `CLOSED` действительно terminal;
- `RESOLVED → OPEN` reopen корректен;
- invalid transitions дают controlled `4xx/422`;
- rejected transition не меняет Case и не создаёт ложный CaseHistory.

---

## 4. RBAC — FULL MATRIX

Reported defaults:

| Permission | ADMIN | OPERATOR | DIRECTOR | PARTNER | FINANCE |
|---|---:|---:|---:|---:|---:|
| support.case.create | ✅ | ✅ | ❌ | ❌ | ❌ |
| support.case.read | ✅ | ✅ | ✅ | ❌ | ❌ |
| support.case.update | ✅ | ✅ | ❌ | ❌ | ❌ |
| support.case.assign | ✅ | ✅ | ❌ | ❌ | ❌ |

Проверить actual permission registry, seed/default role matrix, controller guards и service authority.

Проверить **все internal roles**, включая где применимо:

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

Runtime минимум:

```text
ADMIN/OPERATOR expected actions → allowed
DIRECTOR read → allowed
DIRECTOR create/update/assign → denied if canonical
PARTNER all support.* → denied if canonical
other non-entitled roles → denied
anonymous → 401
```

`PARTNER` deny отдельно сверить с roadmap: если Step 3.10 — Platform Support Domain, это корректная boundary; если roadmap требует Partner-facing support — finding.

---

## 5. RELATED ENTITY / SCOPE ATTACK

Определить реальные Case relations: Customer, Partner, Order, Booking, Payment, Refund, Communication, assignee и т.д.

Для каждого accepted relation проверить:

```text
malformed UUID
nonexistent UUID
wrong-domain UUID
cross-partner/cross-scope UUID
```

Если Partner scope применим, создать два distinct contexts и атаковать, где relations существуют:

```text
Case Partner A + Order Partner B
Case Partner A + Booking Partner B
Case Partner A + Communication Partner B
```

Expected: deny, no persisted invalid relation, no partial mutation.

Если assignment реализован, попытаться назначить nonexistent user, PARTNER/BUYER user, unauthorized internal role и wrong-workspace user. Arbitrary valid User UUID не должен автоматически быть eligible assignee.

---

## 6. COMMENT VISIBILITY — SECURITY ATTACK

`CaseComment` reportedly supports internal + customer-facing comments.

Найти actual representation (`isInternal`, visibility enum, audience и т.п.).

Создать два уникальных marker:

```text
INTERNAL_SECRET_<unique>
CUSTOMER_VISIBLE_<unique>
```

Проверить все applicable read surfaces: Case detail, comments list, generic includes, Communication projection, Activity projection и response DTO serialization.

Internal marker не должен утекать actor/context, которому он не разрешён.

Если external Support API пока отсутствует, доказать, что unrestricted DTO/serialization не создаёт автоматический disclosure path.

Проверить также:
- caller не может spoof `authorId/createdBy`;
- caller без authority не может пометить комментарий как internal/customer-facing произвольно;
- internal note/comment boundary соответствует roadmap.

Material internal-comment disclosure = P1/P2 в зависимости от reachable actor path.

---

## 7. COMMUNICATION INTEGRATION

Проверить `CaseCommunicationLink` как relation к **canonical Communication domain**, а не второй messaging system.

Attack matrix:

```text
nonexistent Communication
wrong/out-of-scope Communication
cross-partner Communication
duplicate link
```

Support relation не должна обходить canonical participant/visibility/moderation rules и не должна создавать запрещённый direct Customer↔Marketplace Partner bypass.

Обязательно прогнать relevant **Communication regression suite** и зафиксировать exact counts. Marketing `45/45` не заменяет Communication regression.

---

## 8. CASEHISTORY — APPEND-ONLY / COMPLETENESS

Не принимать `CaseHistory` как append-only только из-за названия.

Проверить API/service/ORM paths на update/delete exposure и cascade semantics.

Проверить history минимум для actual canonical events:

```text
case creation
status change
assignment/reassignment
material update
comment creation — если canonical
close
reopen
```

Rejected actions (`invalid transition`, unauthorized update, invalid assignment) не должны создавать successful history event.

History actor должен определяться authenticated context; request body не должен позволять spoof actor.

---

## 9. VALIDATION / ERROR CONTRACT

Fuzz всех actual Support enums (`CaseType`, `Priority`, `Status`, etc.):

```text
INVALID
admin
""
null
wrong case
```

Проверить malformed UUID, valid-but-nonexistent UUID и wrong-domain UUID.

Expected:

```text
controlled 400/404/409/422 according contract
never raw 500
```

Ответы не должны раскрывать Prisma stack, SQL, constraints или database internals.

---

## 10. API / MASS ASSIGNMENT

Составить inventory:

| Method | Endpoint | Permission | Scope | Positive | Negative |
|---|---|---|---|---:|---:|

Проверить update DTO на mass assignment. Нельзя произвольно менять server-owned fields, например:

```text
id
case code
createdBy
createdAt
history
ownership/scope
audit fields
```

Если есть list/search/filter — проверить pagination bounds, unknown filters, server scope и отсутствие leakage через count/metadata.

---

## 11. SCHEMA / MIGRATION

Проверить:
- unique human-readable Case identifier;
- foreign keys;
- indexes;
- nullability;
- `onDelete`;
- timestamps;
- CaseCommunicationLink uniqueness;
- CaseHistory ownership;
- comment cascade;
- migration safety;
- отсутствие unrelated/destructive schema changes.

---

## 12. REGRESSION MATRIX

Независимо прогнать:

```text
Support suite                    (reported 24/24)
Communication relevant suite
CRM relevant suite               if integration touched
Order/Booking relevant suite     if relations touched
RBAC/security relevant suite
Marketing 45/45                  optional broad regression, not substitute
Backend TSC
Project-standard backend build   if canonical acceptance requires
```

Зафиксировать **actual** counts/results.

---

## 13. REAL RUNTIME — AUTHORITATIVE

Tests/source недостаточно. Использовать real backend + real DB + real auth по repository procedure.

Happy path согласно actual lifecycle:

```text
create Case
→ fetch/list
→ allowed update
→ assign (if supported)
→ comment (if supported)
→ Communication link (if supported)
→ lifecycle transitions
→ RESOLVED
→ CLOSED
→ inspect CaseHistory
```

### Mandatory waiting-state runtime

Для каждого actual waiting state:

```text
enter WAITING_*
→ execute canonical exit
→ prove Case remains operable
```

### ESCALATED runtime

```text
enter ESCALATED
→ execute canonical next action
```

либо доказать roadmap-defined terminal semantics.

### Negative runtime

Минимум:

```text
anonymous
unauthorized role
DIRECTOR prohibited mutation
PARTNER prohibited access
invalid enum
invalid lifecycle
nonexistent relation
cross-scope relation where applicable
invalid assignee where applicable
duplicate Communication link where applicable
```

После каждого rejected request проверить:

```text
Case unchanged
relations unchanged
no false history
no orphan record
```

---

## 14. SEVERITY

```text
P0 — catastrophic / broad security or data corruption
P1 — serious security/data integrity/business authority failure
P2 — material functional/lifecycle/RBAC/runtime defect blocking closure
P3 — non-blocking quality/maintainability defect
P4 — observation/future improvement
```

Любой unresolved `P0/P1/P2` ⇒ **VERDICT B**.

---

## 15. STRICT REVIEW REPORT

Создать:

```text
docs/prompts/PHASE_3_STEP_3.10_SUPPORT_DOMAIN_STRICT_REVIEW_REPORT.md
```

Минимальная структура:

```text
1. Review baseline
2. Canonical Step 3.10 requirements
3. Implementation diff review
4. Domain authority / anti-duplication
5. Schema review
6. Lifecycle reachability matrix
7. RBAC matrix
8. Actor/scope isolation
9. Related entity integrity
10. Comment visibility/security
11. Communication integration
12. CaseHistory integrity
13. API contract
14. Validation/error contract
15. Automated regression evidence
16. Runtime happy-path evidence
17. Runtime negative/security evidence
18. Findings
19. Severity
20. Git evidence
21. Final verdict
22. Required next action
```

---

## 16. REVIEW-ONLY GIT POLICY

Strict Review **не исправляет production defects**.

Проверить:

```bash
git status --short
git diff --name-only
git diff
```

Stage только review-owned report/evidence/tests, если такие изменения допустимы repository policy.

Пример:

```bash
git add docs/prompts/PHASE_3_STEP_3.10_SUPPORT_DOMAIN_STRICT_REVIEW_REPORT.md
git commit -m "docs(support): strict review Phase 3 Step 3.10"
git push origin master
```

Зафиксировать real review SHA, final HEAD и origin/master.

---

## 17. VERDICT A GATE

`VERDICT A` разрешён только если одновременно:

```text
canonical scope satisfied
no P0/P1/P2

no duplicate domain authority

lifecycle graph complete
WAITING states have valid exits
ESCALATED semantics valid
CLOSED terminality valid

RBAC matches canonical authority
all internal roles checked
anonymous denied

relation integrity proven
cross-scope injection denied
assignee eligibility proven where applicable

internal comments do not leak
authorship cannot be spoofed

Communication authority preserved
Communication regression PASS

CaseHistory materially append-only
history completeness proven
rejected actions create no false history

validation controlled
no raw ORM 500/leakage
mass assignment blocked

Support + relevant regressions PASS
real runtime happy path PASS
real runtime security matrix PASS
no partial mutation

report predominantly Russian
Git evidence complete
```

Тогда:

```text
VERDICT A — PHASE 3 — STEP 3.10 SUPPORT DOMAIN — STRICT REVIEW APPROVED

STEP 3.10 CLOSED
```

---

## 18. VERDICT B GATE

При любом unresolved P0/P1/P2:

```text
VERDICT B — PHASE 3 — STEP 3.10 SUPPORT DOMAIN — STRICT REVIEW FAILED

STEP 3.10 REMAINS OPEN
```

Для каждого finding:

```text
Finding ID
Severity
Requirement
Observed behavior
Expected behavior
Evidence
Root cause
Affected files/domain
Required remediation
Re-qualification gate
```

Не исправлять finding в этом же task.

---

## 19. ROADMAP POLICY

При `VERDICT B`:

```text
DO NOT mark Step 3.10 CLOSED
DO NOT advance completed boundary
DO NOT change CANONICAL NEXT to Step 3.11
```

При `VERDICT A` можно записать Strict Review evidence/status по canonical roadmap convention, но:

```text
DO NOT AUTO-START STEP 3.11
```

---

## 20. FINAL RESPONSE / STOP

Вернуть пользователю:

```text
reviewed implementation SHA
Strict Review SHA
canonical scope result
lifecycle result
RBAC result
comment visibility result
Communication result
CaseHistory result
runtime/security result
regression counts
findings table
final VERDICT
exact required next action
```

После этого:

```text
STOP
```

При `VERDICT A` не начинать Step 3.11.

При `VERDICT B` не выполнять remediation автоматически.
