# PHASE 3 — STEP 3.5.3 — PLATFORM CRM
## CRM ACTIVITY — ROUND 2B.1
## ACCEPTANCE + RUNTIME EVIDENCE CLOSURE
### API / RBAC / CURSOR / FILTERING / SUBJECT AUTHORITY / NO-LEAK
### ЯЗЫК ОТЧЁТА: РУССКИЙ

## 1. Цель
Round 2B уже реализован, но из-за выполнения одного и того же промпта на разных компьютерах необходимо провести единое каноническое acceptance/evidence closure по фактическому `origin/master`.

Не переписывать корректную реализацию. Исправлять только доказанные gaps. Round 2C не начинать.

## 2. Language Contract
Все пользовательские результаты и REPORT.md — на русском.

Английский допустим только для:
- путей и имён файлов;
- API routes;
- enum;
- permission codes;
- имён классов/методов;
- команд;
- Git SHA;
- кода/технических идентификаторов.

Преимущественно английский итоговый ответ = FAIL.

## 3. Обязательный Git Sync Gate — ДО любых изменений
Так как Round 2B выполнялся на разных компьютерах, сначала:

```bash
git fetch origin
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse origin/master
git log --oneline --decorate -20
```

Требования:

```text
branch = master
tracked worktree = clean
HEAD == origin/master
```

Если `HEAD != origin/master`:

```text
STOP
не merge/rebase/reset/force автоматически
классифицировать divergence
не продолжать acceptance/remediation на несинхронизированном коде
```

Untracked files не удалять и не добавлять в commit.

Канонической считается только реализация, реально находящаяся в `origin/master`.

Записать:

```text
Computer/runtime:
Branch:
HEAD before fetch:
origin/master after fetch:
HEAD == origin/master:
Tracked worktree clean:
Untracked files:
```

## 4. Предусловия
Проверить:
- Round 1 Architecture: `2b0438a`
- Round 2A functional: `227c9e6`
- Round 2B implementation: определить из Git
- roadmap current NEXT

Прочитать:
- Round 2B prompt
- Round 2B report
- Round 2A report
- текущие `crm-activity` controller/service/tests
- permissions/RBAC implementation

Не полагаться на короткий summary.

## 5. Source-Specific Authorization
Для всех 10 source types заполнить и доказать server-side item gate:

| Source Type | Page Gate | Item Gate | Scope Check | Authorized | Unauthorized | PASS |
|---|---|---|---|---|---|---|
| OPERATIONAL_NOTE | crm.activity.read | | | include | omit | |
| ORDER | crm.activity.read | | | include | omit | |
| BOOKING | crm.activity.read | | | include | omit | |
| PAYMENT | crm.activity.read | | | include | omit | |
| REFUND | crm.activity.read | | | include | omit | |
| MESSAGE | crm.activity.read | | | include | omit | |
| AUDIT | crm.activity.read | | | include | omit | |
| CUSTOMER_HISTORY | crm.activity.read | | | include | omit | |
| BUYER_REQUEST | crm.activity.read | | | include | omit | |
| PARTNER_APPLICATION | crm.activity.read | | | include | omit | |

Никаких пустых строк.

## 6. P0 — Authorized Pagination / No-Leak
Особо проверить `countRemainingAuthorized()` и 3x over-fetch.

Mixed stream:

```text
authorized
unauthorized
unauthorized
authorized
authorized
unauthorized
authorized
```

При limit меньше total доказать:
- все authorized rows появляются ровно один раз;
- unauthorized rows = 0;
- page intersections = 0;
- `hasMore` корректен;
- `nextCursor` корректен;
- hidden count нельзя вывести из response;
- поздние authorized rows не теряются.

Если gap найден — минимальный fix + regression test.

## 7. Cursor Security
Проверить:
- malformed cursor → 400;
- tampered cursor;
- missing tuple field;
- invalid occurredAt;
- invalid id;
- Customer A cursor → Customer B;
- Partner A cursor → Partner B;
- old cursor + changed filters.

Никаких 500, scope escape или filter escape.

## 8. Server-Side Filters
Проверить:
- `sourceType`
- `activityType`
- `dateFrom`
- `dateTo`
- `actorUserId` только если реально реализован.

Комбинации:
- каждый отдельно;
- sourceType + activityType;
- dateFrom + dateTo;
- sourceType + date range;
- activityType + date range;
- все supported filters;
- filter + cursor.

Invalid enum/date/limit → 400.

## 9. Subject Authority
Customer:
- authorized → 200;
- zero → 200 [];
- nonexistent → 404;
- no `crm.activity.read` → 403;
- out-of-scope → canonical deny.

Partner — аналогично.

Dual-subject:
одна logical Order/Booking/Payment/Refund activity должна корректно появляться в Customer и Partner timeline без duplicate/cross-partner leakage.

## 10. Role Matrix
Заполнить по фактической Permission DB/seed authority:

| Role | crm.activity.read | Runtime Result | PASS |
|---|---:|---|---|
| ADMIN | | | |
| DIRECTOR | | | |
| ANALYST | | | |
| MARKETER | | | |
| FINANCE | | | |
| MODERATOR | | | |
| SALES_MANAGER | | | |
| OPERATOR | | | |
| BUYER | | | |
| PARTNER | | | |

Не выводить права по названию роли.

## 11. Data Minimization
Проверить реальный JSON.

Не должны утекать:
- raw audit payload;
- unauthorized OperationalNote text;
- unauthorized message content;
- provider secrets;
- dedupe internals;
- projection-version internals;
- tenant/security internals.

## 12. Business Date Regression
Подтвердить:
- PAYMENT_CAPTURED `occurredAt` == paidAt-derived timestamp;
- REFUND_PROCESSED `occurredAt` == processedAt-derived timestamp;
- ORDER_CANCELLED `occurredAt` == cancelledAt.

## 13. Query / Index Evidence
Для Customer/Partner:
- показать query shape;
- проверить Round 2A index compatibility;
- EXPLAIN where practical;
- честно указать index/bitmap/seq scan.

## 14. Runtime Authority
Использовать именно синхронизированный runtime:

```text
Git HEAD
origin/master
Backend PID
CWD
port
API base
Database
Migration status
```

Не использовать stale process.

## 15. Runtime Proof
Customer:
- first page;
- next page;
- sourceType filter;
- activityType filter;
- date filter;
- zero-result filter.

Partner:
- first page;
- next page;
- filter;
- dual-subject activity.

RBAC:
- authorized role;
- unauthorized role;
- partially authorized role.

No-leak:
- known hidden row существует;
- actor имеет page gate, но не source gate;
- hidden row отсутствует;
- later authorized row достижим;
- hasMore/cursor корректны;
- hidden count не раскрывается.

## 16. Contract Matrices
Заполнить без пустых полей:

### Response Contract
| Field | Customer API | Partner API | Source | Nullable | Security Notes |
|---|---:|---:|---|---:|---|
| id | | | | | |
| sourceType | | | | | |
| sourceId | | | | | |
| activityType | | | | | |
| occurredAt | | | | | |
| actor | | | | | |
| title | | | | | |
| summary | | | | | |
| deepLink | | | | | |

### Filter Contract
| Query Param | Type | Default | Allowed/Format | DB Field | Validation |
|---|---|---|---|---|---|
| limit | | | | | |
| cursor | | | | | |
| sourceType | | | | | |
| activityType | | | | | |
| dateFrom | | | | | |
| dateTo | | | | | |
| actorUserId | | | | | |

### Cursor Contract
| Property | Actual |
|---|---|
| Ordering | occurredAt DESC, id DESC |
| Cursor tuple | |
| Encoding | |
| Validation | |
| Subject binding | |
| Filter binding | |
| Default limit | |
| Max limit | |
| hasMore calculation | |
| Hidden-item handling | |

### Authorization Pipeline
| Stage | Authority | Failure Behavior |
|---|---|---|
| Authentication | | |
| crm.activity.read | | |
| Subject existence | | |
| Subject scope | | |
| Candidate DB query | | |
| Source-specific gate | | |
| DTO projection | | |
| Cursor generation | | |

## 17. Regression
Выполнить и дать exact counts:
- Backend TSC
- Backend build
- CrmActivity unit tests
- Activity API E2E
- RBAC tests
- cursor tests
- filter tests
- source authorization tests
- Round 2A CrmActivity regression
- Operational Notes regression
- CRM relevant tests
- full backend suite
- Frontend TSC
- Frontend tests
- Frontend build

Historical perf-harness flakiness не blanket waiver.

Если Frontend build timeout/fail — не писать PASS.

## 18. Migration / Permission Sanity
Проверить:
- `20260827120000_add_crm_activity_timeline`
- `20260827140000_seed_crm_activity_operational_notes_role_permissions`

Доказать:
- migration status clean;
- Permission duplicates отсутствуют;
- RolePermission assignments корректны;
- migration deterministic/idempotent в рамках migration model.

## 19. Change Policy
Если всё уже корректно:

```text
production code changes = 0
evidence/report-only closure допустим
```

Если defect найден:
- минимальный fix;
- regression test;
- root cause;
- никаких unrelated changes.

Round 2C не начинать.

## 20. Required Report
Создать:

`docs/prompts/PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2B_1_ACCEPTANCE_RUNTIME_EVIDENCE_CLOSURE_REPORT.md`

Весь REPORT.md — на русском.

## 21. Acceptance Criteria
VERDICT A только если:
1. Git Sync Gate выполнен ДО работы.
2. `branch=master`.
3. `HEAD == origin/master`.
4. Каноническая Round 2B implementation определена из Git.
5. Все 10 source gates классифицированы и server-side.
6. Mixed-auth pagination проходит.
7. `countRemainingAuthorized()` не создаёт leakage/skip.
8. `hasMore`/`nextCursor` корректны.
9. Cursor security/subject/filter binding доказаны.
10. Filters работают server-side.
11. Customer/Partner subject authority и IDOR доказаны.
12. Cross-partner isolation проходит.
13. Dual-subject behavior проходит.
14. Role matrix заполнена.
15. Data minimization доказана.
16. Business-date regression проходит.
17. Response/Filter/Cursor/Auth matrices заполнены.
18. Query/index evidence дан.
19. Runtime Customer/Partner/RBAC/cursor/no-leak evidence дан.
20. Migration/permission sanity проходит.
21. Backend TSC/build/tests проходят.
22. Full backend suite выполнен и честно отражён.
23. Frontend TSC/tests/build выполнены и честно отражены.
24. No Activity UI / Round 2C.
25. Report на русском.
26. Итоговый ответ на русском.
27. Commit/push выполнен.
28. Final HEAD == origin/master.
29. Нет unresolved P0/P1 security/data-integrity defects.

## 22. Final Response — только на русском
Вернуть:

```text
VERDICT:

GIT SYNC GATE
Computer/runtime:
Branch:
HEAD before fetch:
origin/master after fetch:
HEAD == origin/master before work:
Tracked worktree clean:
Untracked files:

ПРЕДУСЛОВИЯ
Round 2B implementation SHA:
Round 2A SHA:
Roadmap NEXT:

ПРОВЕРЕННЫЕ ИСТОЧНИКИ
...

КРАТКОЕ РЕЗЮМЕ
...

SOURCE AUTHORIZATION MATRIX
...
ROLE MATRIX
...
AUTHORIZATION PIPELINE MATRIX
...
RESPONSE CONTRACT MATRIX
...
FILTER CONTRACT MATRIX
...
CURSOR CONTRACT MATRIX
...

SUBJECT AUTHORITY
Customer:
Partner:
IDOR:
Cross-partner:
Dual-subject:

AUTHORIZED PAGINATION
Candidate strategy:
countRemainingAuthorized:
Hidden-item handling:
hasMore:
nextCursor:
Leakage:

CURSOR SECURITY
...
FILTERS
...
DATA MINIMIZATION
...
BUSINESS DATE REGRESSION
...
QUERY / INDEX EVIDENCE
...

RUNTIME CUSTOMER
...
RUNTIME PARTNER
...
RUNTIME RBAC
...
RUNTIME CURSOR
...
RUNTIME NO-LEAK
...

MIGRATION / PERMISSION SANITY
...

РЕГРЕССИЯ
Backend TSC:
Backend build:
CrmActivity unit:
Activity E2E:
RBAC:
Cursor:
Filters:
Source authorization:
Round 2A:
Operational Notes:
CRM:
Full backend suite:
Known perf result:
Frontend TSC:
Frontend tests:
Frontend build:

RUNTIME AUTHORITY
Git HEAD:
origin/master:
Backend PID/CWD/port:
API:
Database:
Migration status:

ИЗМЕНЁННЫЕ ФАЙЛЫ
...
UNRELATED PRODUCTION FILES:
...

Report:
Commit:
Final HEAD:
origin/master:
HEAD == origin/master:

ОСТАВШИЕСЯ ПРОБЛЕМЫ
P0:
P1:
P2:

ROUND 2B STATUS:
NEXT:
```

## 23. Verdict
Успех только:

`VERDICT A — PHASE 3 STEP 3.5.3 PLATFORM CRM / CRM ACTIVITY ROUND 2B.1 / API + TWO-LEVEL RBAC + SUBJECT AUTHORITY + CURSOR PAGINATION + SERVER-SIDE FILTERING + SOURCE-SPECIFIC AUTHORIZATION + NO-LEAK / ACCEPTANCE + RUNTIME EVIDENCE FULLY CLOSED`

Иначе:

`VERDICT B — PHASE 3 STEP 3.5.3 PLATFORM CRM / CRM ACTIVITY ROUND 2B.1 / ACCEPTANCE / RUNTIME / SECURITY EVIDENCE INCOMPLETE`

No conditional VERDICT A.

## 24. Next
После VERDICT A НЕ начинать Round 2C.

Сначала отдельный согласованный:

```text
SHARED TABLE UX CONSISTENCY CLOSURE

Catalog
Orders
Bookings
Users
CRM Customer/Partner list semantics

Business Dates
Missing Filters
RU/AZ/EN localization
header typography/alignment
fixed/stable column widths
row navigation/detail contract
CRM History → Last Activity
```

После его закрытия вернуться к:

`STEP 3.5.3 ROUND 2C — CUSTOMER 360 ACTIVITY UI`

## 25. STOP
После report + commit/push + verdict:

`STOP`

Round 2C не начинать.
