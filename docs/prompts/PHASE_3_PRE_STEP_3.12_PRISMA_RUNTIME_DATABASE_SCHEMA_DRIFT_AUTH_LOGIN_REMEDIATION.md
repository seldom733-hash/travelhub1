# PHASE 3 — PRE-STEP 3.12 — PRISMA / RUNTIME DATABASE SCHEMA DRIFT & AUTH LOGIN REMEDIATION

## STATUS
**Type:** P0 runtime infrastructure remediation  
**Known blocker:** Prisma `User` expects `username`, but runtime PostgreSQL does not have the column; normal browser login fails.  
**Previous Currency SHA:** `5409dd3`

This task restores a trustworthy schema/migration/runtime/auth path. Do not start unrelated product work.

## LANGUAGE REQUIREMENT — MANDATORY
Все отчёты, evidence, root-cause analysis, architecture decisions, findings, conclusions и verdict explanations должны быть преимущественно **на русском языке**. English допускается только для технических identifiers, paths, API, SQL/code, commands, enums, commit messages и standardized VERDICT strings.

**Hard gate:** преимущественно англоязычный отчёт = задача не завершена.

## 1. HARD RULE — NO LOCAL-ONLY PATCH
Не считать финальным решением ручной:
```sql
ALTER TABLE users ADD COLUMN username ...
```
только в текущей БД.

Финальная модель:
```text
Authoritative Prisma schema
↕
Versioned migrations
↕
Fresh database
↕
Existing representative runtime database
```
Все уровни должны сходиться.

## 2. FULL DRIFT AUDIT FIRST
Не предполагать, что `username` — единственный drift.

Сравнить:
- Prisma schema;
- repository migration history;
- Prisma migration table в runtime DB;
- фактическую PostgreSQL schema.

Проверить tables, columns, types, nullability, defaults, PK, unique constraints, FK, indexes, enums и relevant schemas.

Составить матрицу:
| Object | Prisma | Migrations | Runtime DB | Classification | Action |
|---|---|---|---|---|---|

Classification:
`EXPECTED / LEGACY / MISSING MIGRATION / UNAPPLIED MIGRATION / MANUAL DB MUTATION / SCHEMA CHANGE WITHOUT MIGRATION / SEED ASSUMPTION / OTHER`.

## 3. PROVE USERNAME/AUTH SEMANTICS
По repository evidence определить:
- когда появился `username`;
- является ли он canonical login identifier;
- поддерживается ли email login;
- nullability/uniqueness;
- case/normalization rules;
- наличие username у существующих пользователей;
- seed/admin/test behavior;
- нужен ли backfill.

Не генерировать usernames из имён без authoritative domain rule. Не пересоздавать пользователей ради login.

## 4. TRACE AUTH END-TO-END
Проверить реальный путь:
```text
Login UI → DTO → auth endpoint → AuthService → Prisma → password verification
→ JWT/session → workspace
```
Проверить valid login, invalid password, unknown user, disabled/inactive behavior и email/username paths, если они реально поддерживаются.

Не ослаблять authentication и не делать bypass ради screenshots.

## 5. ROOT-CAUSE MIGRATION HISTORY
Определить один из случаев:
- migration существует, но не применена;
- Prisma schema изменена без migration;
- migration отмечена applied, но physical schema отличается;
- runtime подключён не к той DB/schema;
- иной доказанный root cause.

Зафиксировать actual host/port/database/schema без secrets.

## 6. DATA PRESERVATION — HARD GATE
До изменений зафиксировать User count, PK/UUID set и relevant role/permission/partner relations.

После:
```text
Deleted users = 0
Unexpected recreated users = 0
Unexpected PK changes = 0
Unexpected role changes = 0
```
Для backfill указать exact affected rows и deterministic collision-safe rule.

Не drop/reseed representative DB.

## 7. AUTHORITATIVE MIGRATION
Если migration отсутствует/неверна — создать versioned repository migration:
- deterministic;
- safe for populated DB;
- valid for fresh DB;
- constraints only after valid backfill;
- no destructive recreation.

Если `username` должен быть `NOT NULL UNIQUE`, не добавлять naïvely в populated table.

## 8. FRESH DB REPRODUCTION — HARD GATE
Создать isolated empty DB и выполнить только repository-authoritative path:
```text
empty DB → migrations → required seed/bootstrap → app startup
```
Проверить Prisma compatibility и normal auth на fresh environment.

Fix, работающий только на текущей DB, = FAIL.

## 9. EXISTING RUNTIME DB — HARD GATE
Тем же authoritative migration path исправить representative runtime DB и доказать:
- migration succeeds;
- schema matches;
- representative data preserved;
- app starts;
- auth works.

Не заменять runtime DB fresh DB.

## 10. PRISMA EVIDENCE
Выполнить applicable project commands, например:
```text
prisma validate
prisma generate
migration status
```
Использовать существующий project workflow.

## 11. DIRECT DB EVIDENCE
Для `User.username` (если подтверждён как canonical field) показать:
- column exists;
- type;
- nullable;
- unique constraint/index;
- row count;
- NULL count;
- duplicate count.

Если audit докажет иной canonical auth contract — документировать его, а не насильно вводить username.

## 12. AUTH API — HARD GATE
Через реальный endpoint и legitimate test/existing account:
```text
valid credentials → success
invalid password → denied
unknown user → denied
```
Не публиковать passwords, hashes, tokens или secrets.

## 13. BROWSER LOGIN — HARD GATE
Через реальную login page:
```text
login → valid credentials → authenticated workspace
```
Без bypass. Нужен current browser/screenshot evidence.

## 14. AUTHENTICATED ROUTE SMOKE TEST
После login проверить реально доступные выбранной роли routes:
```text
/app/dashboard
/app/command-center
/app/analytics
/app/orders
/app/bookings
/app/finance/payments
```
Если route недоступен по permission — зафиксировать это, не менять permissions.

Это smoke test, НЕ Currency final qualification.

## 15. SECURITY REGRESSION
Проверить отсутствие:
- password/auth bypass;
- unknown-user acceptance;
- duplicate usernames;
- disabled-user bypass;
- role/workspace escalation;
- token leakage;
- secrets in logs/reports.

## 16. TESTS
Добавить/обновить appropriate tests:
- migration on populated representative shape;
- fresh DB migration path;
- username constraints/backfill if applicable;
- valid login;
- invalid password;
- unknown user;
- email/username paths if supported;
- seed/bootstrap regression/idempotency where applicable.

Не ослаблять существующие tests.

## 17. BUILD / TYPECHECK
Запустить relevant backend typecheck/build/tests и frontend typecheck/auth tests.

Если команда реально FAIL:
```text
Global command: FAIL
Current remediation scope: PASS/FAIL
Known unrelated blocker: ...
```
Не писать `PASS (scope)` вместо фактического FAIL.

## 18. PRESERVE CURRENCY CONTRACT
Не менять без прямой необходимости:
```text
AZN → ₼
USD → $
EUR → €
0 → visible monetary zero
null/undefined → absence
DB/API → ISO
```
Currency browser re-qualification — отдельная следующая задача.

## 19. PRESERVE REFERENCE/STOREFRONT DATA
Не менять:
```text
MKT-*
SFxxx-*
SF000 quarantine
UUIDs
legacy identifiers
Marketplace/Storefront scope
```
Не удалять/reseed Storefront representative data.

## 20. ROADMAP
Additively обновить:
`docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`

Зафиксировать:
- Schema Drift & Auth Login remediation;
- root cause;
- migration resolution;
- fresh/runtime DB verification;
- real final SHA;
- Currency implementation completed, но final browser/runtime qualification всё ещё pending до отдельной задачи.

## 21. GIT — HARD GATE
Report:
```text
Starting SHA:
Remediation SHA:
Final HEAD:
origin/master:
HEAD == origin:
Working tree clean:
```
Различать pre-existing unrelated dirty files. Intended remediation commit должен быть pushed.

## 22. ACCEPTANCE MATRIX
| Gate | Result |
|---|---|
| Full Prisma ↔ migrations ↔ runtime drift audited | PASS/FAIL |
| Root cause identified | PASS/FAIL |
| Authoritative auth semantics proven | PASS/FAIL |
| Versioned migration correct | PASS/FAIL/N/A |
| Existing User data preserved | PASS/FAIL |
| Fresh DB migrations succeed | PASS/FAIL |
| Fresh DB startup succeeds | PASS/FAIL |
| Existing runtime migration succeeds | PASS/FAIL |
| Prisma validation/generation succeeds | PASS/FAIL |
| Username DB contract verified | PASS/FAIL/N/A |
| Valid auth API succeeds | PASS/FAIL |
| Invalid password denied | PASS/FAIL |
| Unknown user denied | PASS/FAIL |
| Browser login succeeds normally | PASS/FAIL |
| Authenticated workspace loads | PASS/FAIL |
| Route smoke test | PASS/FAIL |
| Security regression | PASS/FAIL |
| Backend typecheck/build/tests | PASS/FAIL |
| Frontend typecheck actual status | PASS/FAIL |
| Representative data preserved | PASS/FAIL |
| Currency contract preserved | PASS/FAIL |
| Reference/Storefront data preserved | PASS/FAIL |
| Roadmap updated | PASS/FAIL |
| Git synchronized | PASS/FAIL |

## 23. FINAL REPORT — MANDATORY STRUCTURE
```text
1. Executive Summary
2. Starting Repository / Runtime State
3. Prisma ↔ Migration ↔ Runtime Drift Audit
4. Root Cause
5. User.username Domain/Auth Contract
6. Authentication Flow Audit
7. Migration History Audit
8. Existing Data Preservation — Before
9. Migration Remediation
10. Fresh Database Reproduction
11. Existing Runtime Database Remediation
12. Prisma Validation / Generation
13. Direct Database Evidence
14. Auth API Evidence
15. Browser Login Evidence
16. Authenticated Route Smoke Test
17. Security Regression
18. Existing Data Preservation — After
19. Tests / Build / Typecheck
20. Currency Contract Preservation
21. Reference Number / Storefront Preservation
22. Canonical Roadmap Update
23. Git / SHA Evidence
24. Residual Gaps
25. Acceptance Matrix
26. Final Verdict
```

## 24. VERDICT
`VERDICT A` только если schema ↔ migrations ↔ fresh DB ↔ runtime DB reconciled, normal API/browser login работает, authenticated workspace загружается, data preservation доказан, auth bypass отсутствует, migration repository-authoritative и Git synchronized.

При любом незакрытом hard gate:
```text
VERDICT B — REMEDIATION REQUIRED
```
Не использовать `VERDICT A — с оговорками`.

## 25. STOP
После этой remediation **STOP**.

Не начинать:
- Currency Final Browser/Runtime Re-Qualification;
- Reference Number Strict Review;
- GMV/Financial KPI Drill-down;
- Cross-Entity Traceability;
- Booking KPI Semantics;
- Finance Center;
- Final PRE-STEP 3.12 Re-Qualification;
- Step 3.12.

После успешного review следующая отдельная задача:
```text
GLOBAL CURRENCY PRESENTATION CONTRACT
— FINAL BROWSER / RUNTIME RE-QUALIFICATION
```
