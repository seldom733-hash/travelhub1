# PHASE 3 — STEP 3.2 — STAGE A — ROUND 6 — FINAL EVIDENCE CLOSURE

## LANGUAGE REQUIREMENT

Все сообщения о ходе работы, вопросы, пояснения, выводы, commit summary и итоговый отчёт предоставить **на русском языке**.

Английский язык допускается только для кода, команд, имён файлов, классов, методов, переменных и точных технических терминов.

---

## REPOSITORY AUTHORITY

| Field | Value |
|---|---|
| Repository | `https://github.com/seldom733-hash/travelhub1` |
| Existing local worktree | Работать только в существующей локальной рабочей копии; повторное клонирование запрещено |
| Branch | `master` |
| Required base SHA | `02cc1456ab623bba2ee001ed07c6b85ddc8efb54` |
| Previous base | `df985c382f04600dcc43d290e87f6d9dd79f644c` |
| Target remote | `origin/master` |

До любых изменений выполнить:

```bash
git rev-parse --show-toplevel
git remote -v
git branch --show-current
git rev-parse HEAD
git rev-parse origin/master
git status --short
```

Продолжать только если:

- активна ветка `master`;
- `HEAD == origin/master == 02cc1456ab623bba2ee001ed07c6b85ddc8efb54`;
- нет чужих modified или staged tracked files.

При несовпадении остановиться и сообщить пользователю. Не выполнять `reset`, `checkout`, `clean`, удаление или перезапись пользовательских файлов. Предсуществующие untracked files не трогать и не включать в commits.

---

## CURRENT VERDICT

```text
ROUND 5 — VERDICT B
STAGE A — NOT CLOSED
STAGE B — BLOCKED
```

Round 5 частично исправил Jest VM wiring и `seedAdmin P2002`, однако не выполнил полный Round 5 contract:

1. repository report на final SHA всё ещё содержит `pending` и pre-commit repository state;
2. добавлен только один `current_database()` test вместо двух независимых isolation suites;
3. cross-suite persisted-state isolation не доказана;
4. `TestEnvironment` сохраняет `any`, fallback `unknown`, неверный env restore и silent cleanup failure;
5. perf assertion ослаблен с ±5% до ±15% без доказанной root cause;
6. обоснование `Windows CI timing drift` противоречит `.github/workflows/ci.yml`, где используется `ubuntu-latest`;
7. terminal GitHub Actions SUCCESS для final SHA не представлен.

---

## OBJECTIVE

Закрыть только оставшиеся дефекты Stage A evidence qualification:

- доказать реальную изоляцию состояния между двумя Jest test suites;
- завершить безопасный lifecycle suite database;
- заменить произвольное ослабление perf tolerance честным детерминированным контрактом;
- получить полный локальный regression PASS;
- получить terminal GitHub Actions SUCCESS;
- финализировать repository report без `pending`, устаревших SHA и ложных утверждений.

Не начинать Stage B и не реализовывать Platform Command Center UI в рамках этого prompt.

---

## PRESERVE VERIFIED ROUND 5 FIXES

Не потерять и не откатить без доказанной причины:

- dual-scope `DATABASE_URL`/`TEST_DATABASE_URL` wiring в host и Jest VM;
- использование `context.testPath` при формировании имени suite DB;
- удаление ручного `require.cache` reset;
- `seedAdmin` повторно проверяет наличие admin после `P2002`;
- `P2002 + admin absent` приводит к rethrow;
- non-`P2002` error приводит к rethrow;
- существующие Stage A RBAC, persistence, summary/trends и workspace gates.

---

## SCOPE

### In scope

- `backend/test/e2e-isolated-env.ts`;
- `backend/test/e2e-db-config.ts`, если требуется safe identifier helper;
- `backend/test/e2e.env.ts`, если требуется contract marker;
- два новых минимальных E2E isolation contract spec files;
- удаление или перенос одиночного isolation test из `workspace-constructor.e2e-spec.ts` для устранения дублирования;
- `backend/src/perf/perf-harness.spec.ts`;
- непосредственно связанный scheduler/pacing test helper, только если нужен deterministic test seam;
- `.github/workflows/ci.yml`, только если изменение не ослабляет gates;
- `docs/prompts/PHASE_3_STEP_3.2_STAGE_A_REMEDIATION_EVIDENCE_CLOSURE_REPORT.md`.

### Out of scope

- Stage B Platform Command Center UI;
- Stage C Admin Permission Management;
- Partner Command Center;
- RBAC matrix и dashboard permission changes;
- production database migrations ради test-only sentinel;
- изменение бизнес-логики TravelHub;
- удаление, skip, quarantine или исключение тестов;
- отключение `--runInBand`;
- unrelated refactoring;
- ослабление CI gates.

---

## NON-NEGOTIABLE CONSTRAINTS

1. Все E2E qualification runs выполнять с `--runInBand`.
2. Не использовать worker-process isolation как замену suite lifecycle.
3. Не применять `test.skip`, `describe.skip`, `.only`, retries или silent catch для получения зелёного результата.
4. Не оставлять arbitrary ±15% assertion только потому, что он проходит локально.
5. Не заявлять Windows CI: repository workflow использует `ubuntu-latest`.
6. Не скрывать cleanup failure за `WARNING` при итоговом PASS.
7. Не добавлять production migration или schema object ради sentinel tests.
8. Не объявлять `VERDICT A`, пока final SHA не имеет terminal successful CI evidence.
9. Не писать в committed report `pending`, `TBD`, placeholder SHA или pre-commit repository values.
10. Не трогать предсуществующие пользовательские untracked files.

---

## REQUIRED IMPLEMENTATION

### A. Strict Jest Environment Context

Использовать официальные типы Jest:

```ts
import type {
  EnvironmentContext,
  JestEnvironmentConfig,
} from "@jest/environment";
```

Constructor contract:

```ts
private readonly testPath: string;

constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
  super(config, context);
  if (!context.testPath) {
    throw new Error("[e2e-env] context.testPath is required");
  }
  this.testPath = context.testPath;
}
```

Запрещено:

```ts
context: any
context.testPath ?? "unknown"
```

### B. Safe Suite Database Name

Suite DB identifier должен:

- быть связан с `context.testPath`;
- учитывать PID для независимых Jest invocations;
- содержать только lowercase ASCII letters, digits и `_`;
- завершаться на `_test`;
- иметь длину не более 63 bytes/characters для PostgreSQL identifier;
- не совпадать с base, dev или production DB;
- проходить отдельную validation непосредственно перед каждым destructive SQL statement.

Не вставлять непроверенный database name в SQL identifier или string literal.

Если имя строится через hash, hash должен быть стабильным и пригодным для имени PostgreSQL. В final report показать два фактических разных suite DB names.

### C. Preserve and Restore Exact Environment State

До любых изменений сохранить отдельно:

- исходный host `process.env.DATABASE_URL`;
- исходный host `process.env.TEST_DATABASE_URL`;
- исходный VM `this.global.process.env.DATABASE_URL`;
- исходный VM `this.global.process.env.TEST_DATABASE_URL`;
- наличие/отсутствие каждого ключа.

В setup установить suite URL одновременно в host и VM.

Также установить test-only marker в обоих scopes:

```text
E2E_SUITE_DB_NAME=<exact generated database name>
E2E_SUITE_TEST_PATH_HASH=<exact test path hash>
```

В teardown восстановить **точные предыдущие значения**. Если переменная изначально отсутствовала, удалить её, а не присваивать base URL.

### D. Cleanup Must Be Authoritative

Teardown обязан выполнить в следующем порядке:

1. попытаться закрыть/завершить suite DB connections;
2. удалить suite DB;
3. восстановить host и VM env;
4. обязательно вызвать `await super.teardown()`;
5. если DB cleanup завершился ошибкой — завершить suite/run с failure после обязательного environment cleanup.

Разрешён pattern с сохранением `cleanupError`, `finally` и последующим `throw cleanupError`.

Запрещено завершать run как PASS после сообщения:

```text
WARNING: Failed to drop suite DB
```

После normal full run не должно оставаться Round 6 suite databases.

---

## TWO-SUITE ISOLATION CONTRACT

Создать два отдельных test files, например:

```text
backend/test/e2e-db-isolation-a.e2e-spec.ts
backend/test/e2e-db-isolation-b.e2e-spec.ts
```

Каждый файл обязан создать собственный реальный Nest application и получить используемый приложением `PrismaService`.

### Shared assertions in both suites

Через реальный Prisma connection выполнить:

```sql
SELECT current_database()
```

Проверить:

```ts
currentDatabase === process.env.E2E_SUITE_DB_NAME
currentDatabase !== "travelhub1_test"
currentDatabase.endsWith("_test")
process.env.E2E_SUITE_TEST_PATH_HASH is not empty
```

Suite A и Suite B должны иметь разные `current_database()` values.

### Sentinel contract

Production migration запрещена. Внутри каждой suite DB разрешено создать test-only table:

```sql
CREATE TABLE IF NOT EXISTS public.e2e_isolation_sentinel (
  key text PRIMARY KEY,
  value text NOT NULL
)
```

Suite A:

1. создаёт table;
2. подтверждает отсутствие `round6-suite-b`;
3. вставляет `round6-suite-a`;
4. подтверждает наличие только собственного sentinel.

Suite B:

1. создаёт table;
2. подтверждает отсутствие `round6-suite-a`;
3. вставляет `round6-suite-b`;
4. подтверждает наличие только собственного sentinel.

Все SQL values передавать параметризованно. Test-only table удаляется вместе с suite DB.

### Required execution order evidence

Выполнить оба порядка:

```bash
npx jest --config test/jest-e2e.json --runInBand --runTestsByPath \
  test/e2e-db-isolation-a.e2e-spec.ts \
  test/e2e-db-isolation-b.e2e-spec.ts
```

```bash
npx jest --config test/jest-e2e.json --runInBand --runTestsByPath \
  test/e2e-db-isolation-b.e2e-spec.ts \
  test/e2e-db-isolation-a.e2e-spec.ts
```

Оба порядка должны PASS. В evidence сохранить:

- фактические имена обеих DB;
- отсутствие чужого sentinel;
- exact suites/tests totals;
- exit code 0;
- cleanup result.

Если Jest самостоятельно меняет фактический execution order, использовать поддерживаемый deterministic sequencer либо выполнить каждый порядок отдельными targeted invocations. Не менять production behavior.

### Existing single contract test

Одиночный `current_database()` test внутри `workspace-constructor.e2e-spec.ts` не считается cross-suite proof.

После добавления двух contract suites:

- либо удалить этот одиночный test как заменённый более строгим contract;
- либо оставить как дополнительный smoke test;
- в отчёте точно объяснить итоговое изменение числа suites/tests.

---

## PERF HARNESS — HONEST DETERMINISTIC FIX

### Current defect

Round 5 заменил:

```text
±5% → ±15%
```

и объяснил это `Windows CI timing drift`, хотя CI использует Ubuntu. Это не является доказанной root-cause remediation.

### Required diagnosis

Сначала вернуть исходный assertion либо временно диагностировать его без commit и выполнить:

```bash
npx jest src/perf/perf-harness.spec.ts --runInBand --verbose
```

Не менее 20 последовательных запусков падающего test case. Зафиксировать:

- `scheduledOperations`;
- `startedOperations`;
- относительное отклонение;
- duration;
- OS/Node/Jest versions;
- количество PASS/FAIL;
- минимальное, максимальное и среднее отклонение;
- точную root cause.

### Required contract redesign

Название test case проверяет, что pacing является wall-clock based, а не completion-rate based. Проверять нужно именно этот инвариант, а не произвольную цифру, подобранную после падения.

Выбрать и обосновать один корректный вариант:

#### Option 1 — Deterministic scheduler/clock seam — preferred

- внедрить test-only или минимальный internal scheduler/monotonic-clock seam;
- использовать controlled/fake time;
- детерминированно доказать количество scheduled starts;
- отдельно доказать, что slow response completion не управляет запуском следующих операций;
- сохранить реальный smoke test без хрупкого строгого wall-clock percentage.

#### Option 2 — Direct invariant assertion

Если fake clock неприменим без непропорционального production refactor:

- вычислить completion-driven theoretical upper bound из latency и duration;
- проверить, что `startedOperations` статистически и математически существенно выше этого bound;
- отдельно проверить отсутствие runaway/overscheduling;
- пороги вывести из test parameters, а не выбрать произвольные 15%;
- подтвердить стабильность минимум 20 последовательными запусками.

### Forbidden perf changes

- оставить ±15% только потому, что тест стал зелёным;
- заменить 15% на другое произвольное значение без вывода из контракта;
- увеличить timeout как единственное исправление;
- добавить retries;
- skip/exclude test;
- заявлять Windows CI для workflow на Ubuntu;
- ослаблять `loadApplicationValid` или completion assertions.

Final unit suite должен проходить без waiver и без исключений.

---

## REQUIRED TEST MATRIX

### 1. Targeted Round 6 tests

```bash
npx jest src/security/security.service.spec.ts --runInBand --verbose
npx jest src/perf/perf-harness.spec.ts --runInBand --verbose
```

Выполнить два isolation suites в обоих порядках.

### 2. Open handles qualification

```bash
npx jest --config test/jest-e2e.json --runInBand --detectOpenHandles --runTestsByPath \
  test/e2e-db-isolation-a.e2e-spec.ts \
  test/e2e-db-isolation-b.e2e-spec.ts
```

Требуется:

- exit code 0;
- no leaked Prisma connections;
- no open Nest applications;
- no leaked timers/workers;
- обе suite DB удалены.

### 3. Stage A targeted regression

Повторно выполнить:

- `restart-persistence.e2e-spec.ts`;
- `rbac-parity.e2e-spec.ts`;
- `dashboard-command-center.e2e-spec.ts`;
- `workspace-constructor.e2e-spec.ts`;
- `sale-completion-order-requested.e2e-spec.ts`;
- `partner-collect-commission-accrual.e2e-spec.ts`;
- `change-proposal.e2e-spec.ts`;
- `storefront.e2e-spec.ts`;
- `partner-cabinet-list.e2e-spec.ts`;
- оба новых Round 6 isolation suites.

### 4. Backend full regression

Targeted tests должны проходить до запуска полного 30+ minute E2E.

После targeted PASS выполнить один полный qualification run:

```bash
npx tsc --noEmit
npm run build
npx jest --runInBand
npm run test:e2e
```

Acceptance:

- typecheck exit 0;
- build exit 0;
- все unit suites/tests PASS;
- все E2E suites/tests PASS;
- zero failed tests;
- точные новые totals отражены в отчёте;
- никакие новые tests не skipped и не excluded.

### 5. Frontend regression

```bash
npx tsc --noEmit
npx vitest run
npm run build
```

Все команды должны завершиться с exit code 0.

### 6. Database qualification

Подтвердить:

- все 60 migrations применяются к fresh suite DB;
- second deploy не имеет pending migrations;
- production schema drift отсутствует;
- Round 6 не добавил production migration;
- после E2E normal teardown не осталось Round 6 suite databases.

---

## CI TERMINAL EVIDENCE

После локального PASS:

1. создать implementation commit;
2. push implementation commit в `origin/master`;
3. дождаться terminal GitHub Actions result;
4. если CI failed — исправить root cause и повторить локальные affected gates;
5. только после успешного implementation CI обновить evidence report;
6. создать documentation commit и push;
7. дождаться terminal CI для final documentation SHA либо явно доказать, что docs-only commit не запускает workflow;
8. финальный ответ разрешён только после terminal result.

Если GitHub CLI настроен, использовать:

```bash
gh run list --commit <sha> --workflow ci.yml --json databaseId,url,status,conclusion,headSha
gh run watch <run-id> --exit-status
gh run view <run-id> --json databaseId,url,status,conclusion,headSha,jobs
```

Если `gh` недоступен, использовать GitHub Actions UI или другой уже авторизованный read-only способ. Не изобретать run ID, URL или conclusion.

Не принимать как terminal success:

- workflow отсутствует;
- `queued`;
- `in_progress`;
- `cancelled`;
- `skipped`;
- пустой status;
- только локальный PASS.

---

## REPORT FINALIZATION WITHOUT SELF-REFERENCE ERROR

Обновить:

```text
docs/prompts/PHASE_3_STEP_3.2_STAGE_A_REMEDIATION_EVIDENCE_CLOSURE_REPORT.md
```

Committed report не должен пытаться заранее угадать SHA commit, который содержит сам этот report.

Использовать честную модель:

| Field | Required value |
|---|---|
| Round 6 base | точный полный SHA `02cc1456...` |
| Round 6 implementation | точный полный implementation SHA |
| Evidence captured against | implementation SHA |
| Implementation CI | exact run ID, URL, terminal conclusion |
| Report publication commit | `self — exact SHA reported in final developer response` |

Фраза `self — exact SHA reported in final developer response` не является `pending`: она честно устраняет невозможную самоссылку. В final developer response после commit указать реальный documentation SHA.

Если после documentation commit workflow запускается снова, terminal CI для documentation SHA привести в final developer response.

### Required report sections

1. Repository State;
2. Round 6 base и implementation SHA;
3. exact changed files;
4. strict TestEnvironment context;
5. exact env save/restore behavior;
6. safe DB naming contract;
7. Suite A/Suite B database names;
8. `current_database()` equality with marker;
9. sentinel isolation в обоих execution orders;
10. cleanup и `detectOpenHandles` evidence;
11. perf failure distribution и root cause;
12. final deterministic perf contract;
13. backend unit exact totals;
14. targeted E2E exact totals;
15. full E2E exact totals и duration;
16. frontend exact totals;
17. migrations/drift;
18. implementation CI run ID/URL/conclusion;
19. commits;
20. tracked/untracked worktree state;
21. waiver status.

### Forbidden report content

- `_pending_`, `pending commit`, `TBD`;
- `HEAD = 02cc145` после новых commits;
- pre-commit worktree state как final state;
- `Windows CI` при `ubuntu-latest`;
- `per-suite isolation proved` без двух-suite sentinel evidence;
- `CI PASS` без run ID и terminal result;
- approximate test counts без маркировки;
- PASS при ненулевом exit code.

---

## GIT REQUIREMENTS

Перед каждым commit:

```bash
git diff --check
git status --short
git diff --stat
git diff --name-status
```

Implementation commit должен содержать только Round 6 code/tests/infrastructure changes.

Documentation commit должен содержать только финальный evidence report.

Не использовать:

```bash
git add .
git add -A
git add --all
```

Добавлять только явные confirmed paths:

```bash
git add -- <exact-path-1> <exact-path-2>
```

После push проверить:

```bash
git rev-parse HEAD
git rev-parse origin/master
git ls-remote origin refs/heads/master
git status --short
```

Не заявлять `worktree clean`, если присутствуют untracked files. Использовать точное разделение:

```text
Tracked scope clean: 0 modified, 0 staged
Repository worktree: pre-existing untracked files present
```

если это фактическое состояние.

---

## ACCEPTANCE CRITERIA — VERDICT A

Verdict A разрешён только при одновременном выполнении всех условий:

| Criterion | Required result |
|---|---|
| Required base verified | ✅ |
| `EnvironmentContext` used, no `any` | ✅ |
| No `unknown` testPath fallback | ✅ |
| Safe DB identifier ≤63 chars | ✅ |
| Exact host/VM env restoration | ✅ |
| Cleanup failure fails run | ✅ |
| Suite A and Suite B are separate files | ✅ |
| Two different `current_database()` values | ✅ |
| DB equals exact environment marker | ✅ |
| Sentinel isolation A→B | ✅ |
| Sentinel isolation B→A | ✅ |
| DetectOpenHandles | PASS |
| No leftover suite DBs | ✅ |
| Arbitrary ±15% perf tolerance removed | ✅ |
| Perf root cause documented | ✅ |
| Perf contract deterministic/direct | ✅ |
| Perf test repeated ≥20 times | 0 failures |
| Backend typecheck/build | PASS |
| Backend unit | All PASS |
| Stage A targeted E2E | All PASS |
| Full serial E2E | All PASS |
| Frontend typecheck/Vitest/build | PASS |
| Migrations/drift | PASS |
| Implementation CI | Terminal SUCCESS |
| Final documentation SHA CI | Terminal SUCCESS, если workflow triggered |
| Repository report | Accurate, no pending/stale claims |
| HEAD/origin/remote master | Equal |
| Tracked scope | Clean |
| User untracked files | Preserved |
| Waiver | NONE |

Если хотя бы один критерий отсутствует:

```text
VERDICT B — STAGE A NOT CLOSED
```

Указать точный blocker. Не переходить к Stage B.

---

## FINAL RESPONSE FORMAT

Итоговый ответ разработчика предоставить строго на русском языке:

```text
PHASE 3 — STEP 3.2 — STAGE A — ROUND 6 — VERDICT A|B

Repository State
- Repository
- Branch
- Base SHA
- Implementation SHA
- Documentation SHA
- Final SHA
- HEAD
- origin/master
- ls-remote master
- tracked scope
- untracked state

Jest Environment Closure
- EnvironmentContext contract
- safe suite DB naming
- host/VM env wiring
- exact env restoration
- cleanup failure behavior

Two-Suite Isolation Evidence
- Suite A file and DB name
- Suite B file and DB name
- A→B result
- B→A result
- current_database equality
- sentinel absence/presence assertions
- detectOpenHandles result
- leftover DB check

Perf Harness Closure
- original failing test
- 20-run diagnostic distribution
- proven root cause
- final deterministic/direct invariant
- 20-run final result

Regression Evidence
- backend typecheck
- backend build
- backend unit exact totals
- targeted E2E exact totals
- full serial E2E exact totals and duration
- frontend typecheck
- frontend Vitest exact totals
- frontend build
- migrations and drift

CI Evidence
- implementation SHA, run ID, URL, terminal conclusion
- documentation SHA, run ID, URL, terminal conclusion if triggered
- backend job result
- frontend job result

Files Changed
- production
- tests
- infrastructure
- documentation

Commits
- exact SHA and message for each Round 6 commit

Waiver
- NONE

NEXT
- Stage B allowed only for Verdict A
```

---

## NEXT STEP AFTER CONFIRMED SUCCESS

Только при полном Verdict A:

```text
NEXT: PHASE 3 — STEP 3.2 — STAGE B — PLATFORM COMMAND CENTER UI — IMPLEMENTATION
```

