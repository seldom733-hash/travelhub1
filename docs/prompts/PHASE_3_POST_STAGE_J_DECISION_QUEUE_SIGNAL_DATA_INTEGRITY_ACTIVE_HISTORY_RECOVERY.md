# PHASE 3 — POST-STAGE-J
# DECISION QUEUE SIGNAL DATA INTEGRITY & ACTIVE/HISTORY RECOVERY
## EMERGENCY FORENSIC REMEDIATION — ROUND 3
## STOP FEATURE WORK / PRESERVE DATA / DETERMINE WHY ACTIVE 6 → 0 AND HISTORY 0
## BLOCKING GATE BEFORE ANY FURTHER STAGE F OR CRM WORK

---

# 1. ЯЗЫК

Все ответы разработчика, forensic findings, SQL/DB evidence, browser/network evidence,
таблицы, тесты, remediation report и финальный VERDICT — **НА РУССКОМ ЯЗЫКЕ**.

Technical identifiers, Prisma model names, enum values, SQL, code, commands,
paths, SHA и commit messages можно оставлять в оригинале.

---

# 2. EMERGENCY STATUS

Предыдущий Round 2 был **ОСТАНОВЛЕН пользователем** после обнаружения нового
критического runtime symptom.

До remediation Decision Queue показывала:

```text
Активные: 6
История: 0
```

Во время/после частично выполненного remediation:

```text
Активные: 0
История: 0
```

То есть 6 ранее видимых Decision Signals больше не отображаются ни в Active,
ни в History.

Это НЕ является допустимым lifecycle outcome без доказательства.

---

# 3. CURRENT BLOCK

До выяснения причины:

```text
Stage F further remediation → BLOCKED
CRM Step 3.5                → BLOCKED
Seed/reset operations       → BLOCKED
Destructive DB operations   → BLOCKED
```

Сначала — forensic diagnosis и восстановление data/query integrity.

---

# 4. PREVIOUS VERDICTS INVALIDATED

Следующие предыдущие claims больше не являются достаточным evidence:

```text
Lifecycle mutations work
Active/History verified
Decision Queue fully reconciled
CRM Step 3.5 ready
```

Реальный browser runtime их опроверг.

---

# 5. PRIMARY QUESTION

Нужно доказательно ответить:

```text
Куда исчезли 6 Decision Signals?
```

Возможные классы причин:

```text
A. Records физически удалены
B. Records существуют, но statuses больше не входят ни в Active, ни в History query
C. Active/History query сломан
D. Workspace/tenant scope изменился
E. API filtering изменился
F. Seed/reset очистил или пересоздал signals
G. Time/status predicate исключил records
H. Frontend filtering скрывает records
I. Migration/schema/data mismatch
J. Другой подтверждённый root cause
```

Не выбирать причину без evidence.

---

# 6. CRITICAL SAFETY RULE — NO MUTATION FIRST

До завершения forensic snapshot запрещено:

```text
seed
reseed
reset
truncate
deleteMany
delete
drop
migration reset
prisma migrate reset
DB recreate
manual status update
bulk lifecycle mutation
```

Также не нажимать lifecycle buttons на оставшихся/восстановленных production-like
signals до сохранения evidence.

---

# 7. GIT SNAPSHOT FIRST

Снять:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git log -10 --oneline
git diff --stat
git diff
```

Вернуть:

```text
Current HEAD:
origin/master:
Working tree:
Uncommitted Round 2 changes:
Last committed remediation:
```

Особенно определить, что успел изменить остановленный Round 2.

---

# 8. DATABASE SNAPSHOT — BEFORE ANY FIX

Найти canonical Decision Signal persistence model/table.

Вернуть:

```text
Prisma model:
DB table:
Primary key:
Status field:
Workspace/tenant fields:
Created/updated timestamps:
Lifecycle timestamps:
Soft-delete field if any:
```

---

# 9. COUNT ALL SIGNAL RECORDS

Получить DB-level counts БЕЗ UI/API filters:

```text
TOTAL Decision Signals
```

И grouped counts:

```text
GROUP BY status
```

Пример формата:

| Status | DB count |
|---|---:|
| OPEN | |
| ACKNOWLEDGED | |
| RESOLVED | |
| DISMISSED | |
| OTHER | |
| TOTAL | |

Использовать фактические enum values.

---

# 10. LIST RELEVANT RECORDS

Для всех Decision Signals вывести forensic-safe fields:

```text
id
type
status
workspace/tenant
createdAt
updatedAt
acknowledgedAt if exists
resolvedAt if exists
dismissedAt if exists
deletedAt if exists
```

Не выводить secrets/PII.

---

# 11. FIND THE PREVIOUS SIX

Нужно идентифицировать те 6 signals, которые ранее были в Active.

Ранее runtime показывал следующие signal types:

```text
SERVICES_WITHOUT_SALES
UPCOMING_BOOKINGS
PENDING_REFUNDS
FAILED_PAYMENTS
BOOKING_CONFIRMATION_DELAY
RECENT_CANCELLATIONS
```

Для каждого вернуть:

| Signal type | Record exists | ID | Status | Workspace | updatedAt |
|---|---:|---|---|---|---|

---

# 12. HARD DELETE CHECK

Определить:

```text
были ли эти 6 records физически удалены?
```

Проверить:

```text
git/code paths capable of delete
service lifecycle implementation
repository/Prisma calls
seed cleanup
test cleanup
browser remediation scripts
```

Искать:

```text
delete(
deleteMany(
truncate
TRUNCATE
reset
cleanup
purge
```

в Decision Signal paths.

---

# 13. SOFT DELETE CHECK

Если есть:

```text
deletedAt
isDeleted
archivedAt
hidden
```

проверить, не были ли records исключены таким механизмом.

---

# 14. STATUS DRIFT CHECK

Если records существуют, определить их фактические statuses.

Особенно проверить значения, которые UI/API может не учитывать:

```text
RESOLVED
DISMISSED
REJECTED
ACKNOWLEDGED
CLOSED
STALE
EXPIRED
UNKNOWN
```

Использовать только реальные enum values проекта.

---

# 15. ACTIVE QUERY — TRACE END TO END

Проследить:

```text
DecisionQueue Active tab
→ frontend API call
→ query params
→ backend controller
→ DTO
→ service
→ DB predicate
```

Вернуть exact predicate:

```text
Active = ...
```

---

# 16. HISTORY QUERY — TRACE END TO END

Аналогично:

```text
History tab
→ API
→ backend
→ DB predicate
```

Вернуть exact predicate:

```text
History = ...
```

---

# 17. ACTIVE/HISTORY COVERAGE INVARIANT

Определить canonical lifecycle partition.

Если intended semantics:

```text
Active:
OPEN
ACKNOWLEDGED

History:
RESOLVED
DISMISSED
```

то доказать это из code/architecture.

Не принимать этот пример как факт без проверки.

---

# 18. ORPHAN STATUS CHECK

Проверить, существуют ли statuses, которые:

```text
не входят в Active
и
не входят в History
```

Если да — определить, intentional это или defect.

Вернуть:

| Status | Active? | History? | DB count | Intended? |
|---|---:|---:|---:|---:|

---

# 19. WORKSPACE / TENANT SCOPE CHECK

Сравнить:

```text
workspace/tenant of missing six records
```

с:

```text
current browser workspace/tenant
current API context
```

Проверить, не изменился ли scope в результате Round 2.

---

# 20. AUTH / ROLE SCOPE CHECK

Проверить, не изменился ли RBAC/query scope так, что пользователь перестал видеть signals.

Не ослаблять RBAC.

Нужно определить, является ли visibility loss корректным permission behavior или regression.

---

# 21. API DIRECT RECONCILIATION

Сравнить:

```text
DB total
API Active
API History
Browser Active
Browser History
```

Вернуть:

| Layer | Active | History | Total visible |
|---|---:|---:|---:|
| DB canonical partition | | | |
| API | | | |
| Browser | | | |

---

# 22. DETECTOR STATE CHECK

Decision Signals могут быть derived/recomputed.

Проверить:

```text
detector execution
upsert semantics
deduplication
signal identity
auto-resolution
stale handling
observation updates
```

Определить, мог ли detector автоматически закрыть/удалить все 6.

---

# 23. AUTO-RESOLVE CHECK

Если signals автоматически resolve, когда condition исчезает:

доказать:

```text
condition действительно исчезла
```

для каждого signal.

Если condition всё ещё существует, массовый auto-resolve — defect.

---

# 24. CURRENT UNDERLYING CONDITIONS

Для 6 signal types повторно проверить underlying detector conditions БЕЗ мутации.

Вернуть:

| Signal | Condition currently true? | Expected signal status |
|---|---:|---|
| SERVICES_WITHOUT_SALES | | |
| UPCOMING_BOOKINGS | | |
| PENDING_REFUNDS | | |
| FAILED_PAYMENTS | | |
| BOOKING_CONFIRMATION_DELAY | | |
| RECENT_CANCELLATIONS | | |

---

# 25. TEST/SEED CONTAMINATION CHECK

Определить, запускал ли Round 2:

```text
seed script
test suite against development DB
cleanup
reset
detector regeneration
```

Проверить environment variables и database name для:

```text
dev runtime
unit/integration tests
E2E
browser runtime
```

---

# 26. DB ISOLATION HARD GATE

Tests не должны мутировать development/runtime DB.

Доказать:

```text
test DB != development DB
```

Если contamination обнаружен — это отдельный root cause и должен быть исправлен.

---

# 27. GIT DIFF ROUND 2

Проверить незакоммиченные изменения остановленного Round 2.

Особенно:

```text
DecisionQueue.tsx
SectionGrid.tsx
Decision Signal service/controller
detectors
catalog/orders/bookings filters
seed scripts
test setup
```

Не потерять полезные изменения автоматически.

---

# 28. DO NOT RESET WORKTREE BLINDLY

Не выполнять:

```bash
git reset --hard
git clean -fd
```

пока не классифицированы Round 2 changes.

Сначала evidence и selective disposition.

---

# 29. ROOT CAUSE CLASSIFICATION

После forensic evidence выбрать primary root cause:

```text
HARD_DELETE
SOFT_DELETE_FILTER
STATUS_PARTITION_DEFECT
HISTORY_QUERY_DEFECT
ACTIVE_QUERY_DEFECT
WORKSPACE_SCOPE_DEFECT
RBAC_VISIBILITY_DEFECT
TEST_DB_CONTAMINATION
SEED_RESET_CONTAMINATION
AUTO_RESOLUTION_DEFECT
FRONTEND_FILTER_DEFECT
API_FILTER_DEFECT
OTHER
```

Secondary root causes — отдельно.

---

# 30. RECOVERY PRINCIPLE

Восстановление должно зависеть от root cause.

Запрещено просто:

```text
reseed six signals
```

и объявить проблему закрытой.

Сначала исправить authority defect.

---

# 31. IF RECORDS STILL EXIST

Если 6 records есть в DB:

```text
НЕ создавать duplicates
```

Исправить query/status/scope и вернуть корректную visibility.

---

# 32. IF RECORDS WERE HARD-DELETED

Если подтверждён hard delete:

1. определить точный deletion path;
2. закрыть destructive path;
3. определить, можно ли восстановить записи из authoritative detector/evidence;
4. восстановление должно быть deterministic;
5. не фабриковать timestamps/history, если они неизвестны;
6. документировать data loss и recovery.

---

# 33. IF TEST CONTAMINATION

Если tests работали против dev DB:

это blocking defect.

Исправить test DB isolation до повторного запуска lifecycle tests.

---

# 34. IF HISTORY QUERY IS BROKEN

Если records `RESOLVED/DISMISSED` существуют, но History = 0:

исправить History predicate.

После fix:

```text
terminal signals → History
```

без изменения самих records, если statuses корректны.

---

# 35. IF STATUS PARTITION IS BROKEN

Создать один canonical helper/source для:

```text
isActiveDecisionSignalStatus()
isHistoricalDecisionSignalStatus()
allowedLifecycleActions()
```

если это соответствует архитектуре и уменьшает drift.

Не дублировать conflicting mappings frontend/backend.

---

# 36. DATA RECOVERY VALIDATION

После fix/recovery:

```text
DB
API
Browser
```

должны согласовываться.

---

# 37. EXPECTED SIX — NOT BLINDLY REQUIRED ACTIVE

Не требовать искусственно вернуть все 6 именно в Active.

Если canonical condition исчезла или signal корректно terminal — он должен быть в History.

Требование:

```text
каждый signal должен иметь объяснимое canonical состояние
```

---

# 38. REGENERATED SIGNALS

Если architecture предусматривает detector regeneration:

проверить identity/deduplication.

Не создавать duplicate active signal для того же condition/object set без canonical reason.

---

# 39. OBSERVATION HISTORY

Проверить, не потеряны ли:

```text
observations
firstDetectedAt
lastObservedAt
evidence
impact
reason attribution
```

если они persist.

---

# 40. LIFECYCLE ACTIONS — TEMPORARILY FREEZE

До восстановления Active/History integrity не продолжать functional lifecycle remediation.

После восстановления можно выполнить только минимальную verification:

```text
terminal signal → no forbidden buttons
fresh OPEN test signal → allowed actions
```

Использовать isolated/deterministic test signal, не один из восстановленных business signals.

---

# 41. NO REAL BUSINESS SIGNAL MUTATION FOR TESTS

Regression tests не должны использовать текущие 6 runtime signals как disposable fixtures.

Создать/использовать isolated test fixtures.

---

# 42. ACTIVE/HISTORY UI ELIGIBILITY

После integrity fix:

```text
RESOLVED/DISMISSED → History
forbidden lifecycle buttons hidden/disabled
OPEN/ACKNOWLEDGED → Active according to canonical semantics
```

---

# 43. NAVIGATION DEFECTS — DEFER WITH SNAPSHOT

Round 2 также имел:

```text
Open Services → 500
Check Availability → 500
Open Payments → 500
Open Upcoming → wrong dataset
```

В этом emergency prompt сначала закрыть data integrity.

После этого, если безопасно и root cause не связан напрямую, можно продолжить их remediation.

Но **не объявлять их закрытыми без browser evidence**.

---

# 44. CATALOG STATUS NOTE

Из реального UI известно, что Catalog status filter содержит:

```text
Все статусы
Черновик
Заполнен
Проверен
Опубликован
Архивирован
```

Следовательно generic:

```text
status=ACTIVE
```

не должен считаться canonical без доказательства.

При возврате к Catalog remediation найти фактический enum для:

```text
Опубликован
```

и согласовать его с `SERVICES_WITHOUT_SALES`.

Не угадывать enum (`PUBLISHED` и т.п.) — взять из code.

---

# 45. SECURITY

Recovery не должна:

```text
ослаблять RBAC
смешивать tenants
переносить signals между workspaces
```

---

# 46. LOCALIZATION

После восстановления проверить:

```text
Активные
История
statuses if visible
lifecycle controls
```

RU/AZ/EN:

```text
raw keys = 0
CJK = 0
```

---

# 47. AUTOMATED TESTS — DATA PARTITION

Обязательно покрыть:

```text
each canonical status → correct Active/History partition
no orphan lifecycle status unless explicitly intentional
terminal status visible in History
active status visible in Active
workspace scope
RBAC
```

---

# 48. AUTOMATED TESTS — NO HARD DELETE

Если lifecycle должен быть non-destructive:

добавить regression test:

```text
resolve/dismiss
→ record still exists
```

---

# 49. AUTOMATED TESTS — TEST DB ISOLATION

Если contamination хотя бы подозревается, доказать test DB isolation контрактным тестом.

---

# 50. BROWSER VALIDATION

После recovery:

```text
open Command Center
open Decision Queue
check Active count
check History count
switch tabs
inspect representative records
reload page
repeat counts
```

---

# 51. RELOAD HARD GATE

Counts и records не должны исчезать после reload.

---

# 52. SERVER RESTART HARD GATE

Если practical:

```text
restart backend/frontend
reload
```

Persistence/visibility должна сохраняться.

---

# 53. REPORT

Создать:

```text
docs/prompts/PHASE_3_POST_STAGE_J_DECISION_QUEUE_SIGNAL_DATA_INTEGRITY_ACTIVE_HISTORY_RECOVERY_REPORT.md
```

---

# 54. REQUIRED DELIVERABLE A — FORENSIC TIMELINE

```text
Before Round 2:
Active = 6
History = 0

Observed during Round 2:
Active = 0
History = 0

Starting HEAD:
Uncommitted changes:
Relevant commands/tests executed:
DB affected:
```

---

# 55. REQUIRED DELIVERABLE B — DB INVENTORY

| Signal type | Exists | Status | Workspace | Updated | Expected partition |
|---|---:|---|---|---|---|

Все 6 known signal types.

---

# 56. REQUIRED DELIVERABLE C — PARTITION

| Status | DB count | Active query | History query | Orphan? |
|---|---:|---:|---:|---:|

---

# 57. REQUIRED DELIVERABLE D — LAYER RECONCILIATION

| Layer | Active | History | Total |
|---|---:|---:|---:|
| DB | | | |
| API | | | |
| Browser | | | |

---

# 58. REQUIRED DELIVERABLE E — ROOT CAUSE

```text
Primary root cause:
Secondary root cause(s):
Deletion occurred: YES/NO
Test DB contamination: YES/NO
Seed/reset contamination: YES/NO
Workspace mismatch: YES/NO
History query defect: YES/NO
Status partition defect: YES/NO
```

---

# 59. REQUIRED DELIVERABLE F — RECOVERY

```text
Authority fix:
Data recovery required:
Records restored:
Records not restored:
Why:
Duplicate prevention:
Observation/evidence preservation:
```

---

# 60. REQUIRED DELIVERABLE G — TESTS

```text
Data partition:
History visibility:
Active visibility:
No hard delete:
Workspace:
RBAC:
DB isolation:
Backend:
Frontend:
TSC:
Build:
Browser:
Reload:
Server restart:
```

---

# 61. REQUIRED DELIVERABLE H — ROUND 2 DISPOSITION

Для каждого незакоммиченного Round 2 change:

```text
KEEP
FIX
REVERT
```

с причиной.

Не делать blanket reset.

---

# 62. REQUIRED DELIVERABLE I — GIT

```text
Starting HEAD:
Final HEAD:
origin/master:
Files changed:
Migrations:
Commit:
Pushed:
HEAD == origin/master:
Working tree clean:
```

---

# 63. ACCEPTANCE CRITERIA — FORENSICS

VERDICT A запрещён, пока не выполнено:

1. DB-level total Decision Signal count получен.
2. Все 6 previous signal types найдены либо доказано их удаление.
3. Status каждого найденного signal известен.
4. Workspace/tenant каждого проверен.
5. Active predicate документирован.
6. History predicate документирован.
7. Все lifecycle statuses классифицированы по partition.
8. Orphan statuses найдены/исключены.
9. Hard-delete path проверен.
10. Soft-delete path проверен.
11. Seed/reset contamination проверен.
12. Test DB contamination проверен.
13. Detector/auto-resolution behavior проверен.
14. Underlying condition для всех 6 signal types проверена.
15. Primary root cause доказан.

---

# 64. ACCEPTANCE CRITERIA — RECOVERY

16. Authority defect исправлен.
17. Не создано duplicate signals.
18. Existing records не переписаны без необходимости.
19. Hard-deleted data, если было, восстановлено только authoritative способом либо loss документирован.
20. DB/API/Browser counts reconciled.
21. Active records видны в Active.
22. Historical records видны в History.
23. Terminal statuses не исчезают из обеих вкладок.
24. Reload сохраняет counts/visibility.
25. Server restart сохраняет counts/visibility.
26. Lifecycle mutation не hard-deletes record.
27. Tests не мутируют dev runtime DB.
28. Workspace/RBAC preserved.

---

# 65. ACCEPTANCE CRITERIA — GENERAL

29. RU/AZ/EN PASS.
30. Raw keys = 0.
31. Unexpected console errors = 0.
32. Unexpected API 500 = 0 для Active/History loading.
33. Backend regression green.
34. Frontend regression green.
35. TSC clean.
36. Builds clean.
37. Report delivered.
38. Round 2 uncommitted changes classified KEEP/FIX/REVERT.
39. Commit created if code/data-authority changes required.
40. Pushed to origin/master.
41. HEAD == origin/master.
42. Working tree clean except explicitly documented unrelated state.
43. CRM Step 3.5 NOT started.

---

# 66. FINAL VERDICT

Вернуть ровно один:

## VERDICT A — DECISION SIGNAL DATA INTEGRITY RESTORED / ACTIVE-HISTORY PARTITION RECONCILED / MISSING SIX SIGNALS ACCOUNTED FOR / SAFE TO RESUME ROUND 2

или:

## VERDICT B — DECISION SIGNAL DATA INTEGRITY REMEDIATION INCOMPLETE

Обязательно разделить:

```text
DB inventory:
Missing six:
Hard delete:
Soft delete:
Statuses:
Active query:
History query:
Workspace:
RBAC:
Detector:
Auto-resolution:
Test DB isolation:
Seed/reset:
Recovery:
DB/API/Browser reconciliation:
Tests:
Git:
```

или:

## VERDICT C — CONFIRMED DATA LOSS / RECOVERY REQUIRES EXPLICIT DECISION

Обязательно указать:

```text
Deleted/lost records:
Deletion mechanism:
Recoverable evidence:
What cannot be reconstructed safely:
Recovery options:
Risk of each option:
Recommended safe option:
```

При VERDICT C не выполнять fabricated recovery автоматически.

---

# 67. STOP

После VERDICT:

**STOP.**

Не продолжать автоматически:

```text
Round 2 navigation remediation
Stage F closure
CRM Step 3.5
```

Сначала review результата этого forensic gate.
