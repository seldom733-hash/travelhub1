# ПРОМПТ РАЗРАБОТЧИКУ

## PHASE 3 — STEP 3.2 — STAGE A — ROUND 5 — E2E SHARED-DATABASE ISOLATION AND CI CLOSURE

Работай в репозитории:

- Repository: `https://github.com/seldom733-hash/travelhub1`
- Branch: `master`
- Ожидаемый опубликованный base SHA: `53de73a5bd6253d08af42df7d6f0b2555d2b919f`
- Baseline CI: `https://github.com/seldom733-hash/travelhub1/actions/runs/32315222293`

Все отчёты, выводы, пояснения и итоговый ответ предоставляй **на русском языке**. Имена файлов, кода, API, тестов и технические термины можно оставлять на английском.

---

## 1. Решение владельца проекта

Выбран вариант **2 — исправить shared-DB state leakage**.

Waiver **не предоставлен**. `VERDICT B` из Round 4 принят как честная фиксация исходного блокера, а не как завершение Stage A. До закрытия этого задания:

- Stage A не считается завершённым;
- Stage B / Platform Command Center UI не начинать;
- failing E2E не пропускать и не ослаблять;
- нельзя заменять full E2E только targeted/individual запусками.

---

## 2. Подтверждённый исходный контекст

На опубликованном SHA `53de73a...`:

- Jest E2E использует один PostgreSQL test database на весь запуск;
- `backend/test/e2e.global-setup.ts` пересоздаёт БД и применяет миграции только один раз перед всем набором;
- `backend/test/jest-e2e.json` запускает все `*.e2e-spec.ts` в одном Jest invocation;
- `--runInBand` устраняет параллельность, но **не изолирует состояние между test suites**;
- CI run `#154` падает на полном E2E gate;
- разработчик сообщил, что проблемные suites проходят отдельно на свежей БД, но падают совместно из-за накопленного состояния и consumer side effects.

Это следует считать рабочей гипотезой. Её необходимо подтвердить воспроизводимыми доказательствами до реализации и повторно проверить после исправления.

В Round 4 также имеется **неопубликованный tracked diff** в:

- `security.service.ts`;
- `security.service.spec.ts`.

Он относится к идемпотентности `seedAdmin()` и P2002 cascade. Не потеряй и не перезапиши этот diff. Сначала точно зафиксируй его содержимое и отличие от `HEAD`; затем квалифицируй его по требованиям раздела 6. Не включай в scope предсуществующие untracked prompts/debug/temp files.

---

## 3. Цель Round 5

Сделать полный E2E-набор детерминированным и изолированным так, чтобы состояние одной suite не влияло на другую, а затем получить зелёный local regression и зелёный GitHub Actions run на итоговом SHA.

Основной предпочтительный контракт:

> **Каждая E2E test suite (`*.e2e-spec.ts`) должна работать в собственной PostgreSQL database, созданной из одной мигрированной pristine template database, и эта database должна безопасно удаляться после suite.**

Выбор иной реализации допустим только если она обеспечивает эквивалентную изоляцию и доказана тестами. Простая «генеральная очистка таблиц» между suites без строгого доказательства полноты не считается достаточной.

---

## 4. Обязательный repository-first preflight

До изменения кода:

1. Выполни и зафиксируй:
   - `git status --short`;
   - `git rev-parse HEAD`;
   - `git rev-parse origin/master` после `git fetch`;
   - `git diff -- security.service.ts security.service.spec.ts`;
   - перечень E2E bootstrap/setup/environment/teardown файлов;
   - фактические команды E2E из `package.json` и `.github/workflows/ci.yml`.
2. Проверь, совпадает ли `HEAD` с ожидаемым `53de73a...`. Если нет — не делай предположений: укажи реальный SHA, изучи intervening commits и оцени применимость задания.
3. Воспроизведи full E2E failure на текущем исходном состоянии либо на безопасно сохранённой копии исходного состояния. Зафиксируй:
   - точную команду;
   - число suites/tests pass/fail;
   - список упавших suites;
   - первые причинные ошибки, отделив их от cascading failures;
   - длительность запуска.
4. Докажи минимум на двух leakage-sensitive suites, что порядок/предыдущее состояние меняет результат, а отдельная свежая БД возвращает PASS.

Не удаляй чужие untracked файлы и не используй destructive Git commands.

---

## 5. Целевая архитектура E2E-изоляции

### 5.1 Pristine template database

Реализуй управляемый lifecycle pristine template database:

1. Global setup создаёт уникальную template DB для конкретного Jest run.
2. На template DB применяются все Prisma migrations в repository order.
3. Если E2E-контракт требует canonical bootstrap/seed, он выполняется **ровно в контролируемом месте**, после миграций и до клонирования suite DB. Не полагайся на случайные side effects первого suite.
4. До использования `CREATE DATABASE ... TEMPLATE ...` все соединения с template DB должны быть закрыты.
5. Имя template DB должно быть уникальным для run и соответствовать жёстким safety guards.

### 5.2 Database per test suite

Для каждого `*.e2e-spec.ts`:

1. Сформируй уникальное безопасное имя DB из run id + стабильного hash test path + worker/process id.
2. Создай DB из pristine template.
3. Установи suite-specific `TEST_DATABASE_URL` и `DATABASE_URL` **до импорта/инициализации `AppModule`, PrismaClient и любых модулей, читающих env**.
4. Все HTTP requests, background consumers, outbox workers и прямые Prisma connections данной suite обязаны использовать только её DB.
5. После suite закрой Nest application, Prisma connections, timers/workers и только затем удали suite DB.

Предпочтительная точка интеграции — custom Jest `TestEnvironment` или другой repository-compatible per-test-file lifecycle. Выбери механизм после проверки фактического порядка Jest setup/import в этом репозитории. Недостаточно просто поменять env после того, как Prisma уже создал connection pool.

### 5.3 Cleanup and crash recovery

1. Global teardown удаляет template DB и orphaned suite DB **только текущего run**.
2. Поддержи cleanup после упавшей suite/оборванного прогона.
3. При необходимости используй PostgreSQL 16-compatible принудительное завершение соединений, но только после точной проверки имени целевой test DB.
4. Cleanup failure должен быть видимым test-infrastructure error, а не silently swallowed.

### 5.4 Safety requirements

Любая операция `DROP DATABASE`, `CREATE DATABASE` или terminate connections должна иметь fail-closed guards:

- разрешён только заранее определённый E2E prefix;
- имя обязано оканчиваться на `_test` или соответствовать ещё более строгому repository contract;
- запрещены пустое имя, production/development database и базовая maintenance database;
- identifiers должны безопасно quote/validate, без SQL injection через test path/env;
- запрещены broad wildcard deletion и действие по непроверенному env;
- CI и local режим должны использовать один контракт безопасности.

### 5.5 Не использовать как основное решение

Не принимай следующие подходы как closure:

- `--runInBand` без database isolation;
- случайный порядок suites;
- retries для маскировки leakage;
- `.skip`, `.only`, ослабление assertions или исключение suites из CI;
- transaction rollback вокруг suite: HTTP/Prisma/workers используют разные connections;
- blanket `TRUNCATE` всех таблиц без доказанного восстановления catalog/RBAC/reference state;
- повторный runtime sync `RolePermission` из `ROLE_PERMISSIONS`.

Последний пункт критичен: после Stage A `RolePermission` — persisted mutable effective state, а startup seed больше не должен выполнять `toAdd/toRevoke`. Test cleanup не должен незаметно возвращать старую continuously-enforced модель.

---

## 6. Квалификация pending `seedAdmin()` fix

Pending Round 4 diff разрешено включить в Round 5 только после аудита.

Требуемый контракт:

- повторный запуск `seedAdmin()` идемпотентен;
- существование любого другого пользователя не должно мешать созданию admin;
- существующий admin по canonical username не создаётся повторно;
- конкурентный duplicate create/P2002 обрабатывается только если после ошибки подтверждено существование именно canonical admin;
- нельзя проглатывать unrelated P2002 или иные Prisma errors;
- admin seed не изменяет `RolePermission` и не восстанавливает отозванные grants;
- не менять без необходимости password/role/identity semantics существующего admin.

Добавь/сохрани точные тесты минимум для:

1. admin отсутствует → создан один раз;
2. admin существует → duplicate create отсутствует;
3. есть non-admin user, admin отсутствует → admin создаётся;
4. simulated concurrent P2002 + последующий lookup находит admin → success;
5. P2002 не подтверждён canonical admin → ошибка не скрывается;
6. repeated initialization не изменяет `RolePermission`.

Если текущий `findUnique + create + catch P2002` не выполняет этот контракт, исправь его. `upsert` допустим только после проверки, что он не перезаписывает существующего admin нежелательными данными.

---

## 7. Обязательные infrastructure tests

Добавь отдельные тесты для E2E DB lifecycle, не полагаясь только на прохождение прикладных suites:

1. safety guard отвергает production/dev/empty/invalid DB names;
2. два разных test paths получают разные DB names;
3. одинаковый test path в разных runs/workers не коллидирует;
4. suite DB клонируется со всеми migrations/schema objects;
5. mutation в suite A отсутствует в suite B;
6. RolePermission mutation в suite A отсутствует в suite B;
7. cleanup удаляет только DB текущего run;
8. cleanup работает после test failure;
9. открытое соединение корректно закрывается/завершается перед drop;
10. template и suite DB не остаются после нормального полного запуска.

Если часть проверок является integration/E2E, чётко отдели её от unit tests и приведи команды запуска.

---

## 8. Regression and acceptance gates

Round 5 может получить `VERDICT A` только при выполнении **всех** условий.

### 8.1 Targeted evidence

- Stage A targeted suites: `restart-persistence`, `rbac-parity`, `dashboard-command-center`, `workspace-constructor` — все PASS;
- leakage-sensitive pair/group — PASS независимо от порядка;
- infrastructure lifecycle tests — все PASS;
- `seedAdmin()` tests — все PASS.

### 8.2 Full local gates

На одной и той же итоговой реализации:

- backend typecheck — PASS;
- backend build — PASS;
- backend unit tests — PASS;
- **полный E2E: все 74 suites PASS, 0 failed, без новых skip**;
- полный E2E повторно: все suites PASS второй раз подряд;
- frontend typecheck — PASS;
- frontend Vitest — PASS;
- frontend production build — PASS;
- `git diff --check` — clean.

Если количество suites/tests изменилось, объясни каждое отличие через diff; не копируй старые числа в отчёт.

### 8.3 Database evidence

- все migrations применяются к template DB;
- schema drift = 0;
- каждая suite действительно использует отличную DB (приведи безопасные диагностические доказательства без credentials);
- после обоих прогонов отсутствуют orphaned DB текущих run ids;
- existing Stage A restart-persistence contract остаётся истинным.

### 8.4 CI gate

1. После локального PASS сделай scoped commits и push в `origin/master`.
2. Дождись GitHub Actions именно для итогового SHA.
3. Backend и frontend jobs должны завершиться `success`.
4. Приведи run URL, run id, head SHA и conclusions.

Локальный PASS без зелёного CI не даёт `VERDICT A`. Если CI не стартовал/ещё выполняется — `VERDICT B: CI pending`, а не ложный closure.

---

## 9. Scope control

Разрешено:

- E2E test infrastructure и её tests;
- минимально необходимые CI/package-script изменения;
- квалифицированный `seedAdmin()` fix из Round 4;
- evidence report.

Запрещено:

- Platform Command Center UI / Stage B;
- Admin Permission Management / Stage C;
- Partner Command Center;
- production schema/business changes, не нужные для test isolation;
- массовый рефакторинг прикладных E2E tests, если инфраструктурная изоляция решает причину;
- удаление предсуществующих untracked файлов;
- force-push и переписывание опубликованной истории.

Если найдёшь отдельный реальный production race (например, outbox `PUBLISHED → FAILED` overwrite), сначала докажи, что он воспроизводится вне shared-DB leakage. Не расширяй Round 5 молча: опиши finding, минимальный fix и его тесты отдельно в отчёте.

---

## 10. Commit and report contract

Предпочтительно разделить:

1. implementation commit: E2E isolation + tests + квалифицированный `seedAdmin()` fix;
2. documentation commit: честный final evidence report.

В итоговом отчёте укажи:

- repository, branch, base SHA, implementation SHA, final SHA;
- `HEAD`, `origin/master`, `ls-remote master`;
- первоначальное воспроизведение leakage;
- доказанный root cause;
- выбранную архитектуру и почему она безопасна;
- полный список изменённых файлов по категориям;
- результаты targeted, full E2E ×2, backend/frontend regression;
- migration/drift/orphan DB evidence;
- CI URL и conclusions на final SHA;
- tracked/untracked status без утверждения «worktree clean», если untracked files существуют;
- deferred scope.

Не называй pre-existing failure исправленным без зелёного full run и CI. Не выдавай `VERDICT A` по individual suites.

---

## 11. Требуемый итоговый формат ответа

```text
PHASE 3 — STEP 3.2 — STAGE A — ROUND 5 — E2E SHARED-DATABASE ISOLATION AND CI CLOSURE

VERDICT A | VERDICT B | VERDICT C

Repository State
Root Cause Evidence
Isolation Architecture
seedAdmin Qualification
Infrastructure Tests
Targeted Stage A Evidence
Full E2E Evidence (Run 1 + Run 2)
Backend/Frontend Regression
Database Safety and Cleanup Evidence
GitHub Actions Evidence
Files Changed
Commits
Deferred Scope
NEXT
```

Значение `NEXT`:

- только при полном `VERDICT A`:
  `NEXT: PHASE 3 — STEP 3.2 — STAGE B — PLATFORM COMMAND CENTER UI — IMPLEMENTATION`;
- при любом незакрытом gate:
  `NEXT: REMAIN IN STAGE A — CLOSE THE SPECIFIC FAILED GATE`.

