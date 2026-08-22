# PHASE 3 — STEP 3.2 — STAGE A — ROUND 5 — FINAL QUALIFICATION & EVIDENCE CLOSURE

## LANGUAGE REQUIREMENT

Все сообщения о ходе работы, пояснения, вопросы, выводы, commit summary и итоговый отчёт предоставить **на русском языке**.

Английский язык допускается только для:

- имён файлов, классов, методов и переменных;
- команд терминала;
- кода и сообщений инструментов;
- официальных технических терминов, когда перевод снижает точность.

---

## REPOSITORY AUTHORITY

| Field | Value |
|---|---|
| Repository | `https://github.com/seldom733-hash/travelhub1` |
| Existing local worktree | Использовать текущую локальную рабочую копию; не клонировать репозиторий заново |
| Branch | `master` |
| Required base SHA | `df985c382f04600dcc43d290e87f6d9dd79f644c` |
| Round 4 implementation | `f2dddbc9ecc067a5aa7a9e98a7caaa11a59b6780` |
| Round 4 report | `df985c382f04600dcc43d290e87f6d9dd79f644c` |
| Target | `origin/master` |

До любых изменений выполнить и зафиксировать в отчёте:

```bash
git rev-parse --show-toplevel
git remote -v
git branch --show-current
git rev-parse HEAD
git rev-parse origin/master
git status --short
```

Если `HEAD` или `origin/master` не равны required base SHA, если активна другая ветка либо обнаружены чужие tracked changes, **остановиться и сообщить пользователю**. Не делать reset, checkout, clean, удаление или перезапись пользовательских файлов.

Предсуществующие untracked-файлы не трогать и не включать в commit.

---

## CURRENT VERDICT

```text
ROUND 4 VERDICT A — REJECTED
STAGE A — NOT YET CLOSED
```

Round 4 дал важный положительный результат: заявлен полный serial E2E run `74 suites / 1284 tests / 0 failures`. Однако текущая реализация и repository report не доказывают, что тесты действительно использовали созданную для каждого suite базу данных. Кроме того, backend unit gate завершился с одним падением, финальный CI status не подтверждён, а отчёт содержит устаревшие repository values.

Verdict A разрешён только после устранения всех перечисленных ниже дефектов и повторной полной квалификации.

---

## VERIFIED ROUND 4 DEFECTS

### Finding 1 — Suite database URL не прокинут в Jest VM

Текущий `backend/test/e2e-isolated-env.ts` после `super.setup()` изменяет:

```ts
process.env.DATABASE_URL
process.env.TEST_DATABASE_URL
```

Но Jest `NodeEnvironment` создаёт отдельный `this.global.process` и копию `process.env` ещё в конструкторе environment. `setupFiles` и test modules выполняются внутри Jest VM и используют `this.global.process.env`.

Следовательно, изменение только host `process.env` не доказывает, что `backend/test/e2e.env.ts`, Prisma и NestJS получили suite-specific URL. По текущему статическому контракту они могут продолжать работать с базовым `travelhub1_test`, тогда как созданная suite DB мигрируется и удаляется, но не используется приложением.

Primary references:

- Jest TestEnvironment: `context.testPath` должен быть явно сохранён в custom environment;
- Jest 29.7 `NodeEnvironment` вызывает `installCommonGlobals()` в конструкторе;
- Jest 29.7 `createProcessObject()` создаёт отдельный `process.env` через копирование.

### Finding 2 — `context.testPath` не сохранён

Текущий код читает:

```ts
const testPath = (this as any).testPath ?? "unknown";
```

Но constructor не выполняет `this.testPath = context.testPath`. Поэтому hash может вычисляться от постоянной строки `"unknown"`, а имя базы является уникальным по PID/worker, но не доказанно уникальным по suite.

### Finding 3 — Backend unit gate failed

Round 4 report содержит:

```text
64/65 suites PASS
936/937 tests PASS
perf-harness flaky — pre-existing
```

Это означает **failed regression gate**, а не PASS. Текущий CI запускает весь backend unit suite командой `npx jest --runInBand`; `perf-harness` не исключён.

Нельзя одновременно заявлять:

```text
Backend unit — PASS
Waiver — NOT REQUIRED
```

при наличии одного failed test.

### Finding 4 — `seedAdmin()` небезопасно обрабатывает любой `P2002`

Текущий catch принимает любую Prisma error с `code === "P2002"` за доказательство того, что concurrent init уже создал администратора. Но unique violation может относиться к другому уникальному полю, например к сгенерированному `User.code`.

Без повторного запроса `ADMIN_USERNAME` существует риск скрыть реальную ошибку и продолжить startup без администратора.

### Finding 5 — Repository report не соответствует final repository state

В отчёте на final SHA всё ещё указаны:

- `Round 4 implementation — pending commit`;
- `HEAD = 53de73a`;
- `origin/master = 53de73a`;
- dirty pre-commit worktree;
- pending Round 4 commits.

Также заявлено шесть unit tests в `security.service.spec.ts`, хотя текущий файл содержит четыре `it(...)` test cases.

### Finding 6 — CI terminal success не доказан

Для final SHA отсутствует подтверждённый terminal successful GitHub Actions result. Локальный лог может использоваться как evidence, но не заменяет требуемую CI qualification, если workflow существует и запускается на push в `master`.

---

## OBJECTIVE

Исправить wiring изолированной E2E database, доказать фактическое подключение Prisma/NestJS к suite DB, закрыть backend unit failure, квалифицировать production change `seedAdmin`, повторно выполнить полный regression matrix и опубликовать честный финальный evidence report.

Не переходить к Stage B и не реализовывать Platform Command Center UI в рамках этого prompt.

---

## SCOPE

### In scope

- `backend/test/e2e-isolated-env.ts`;
- `backend/test/e2e-db-config.ts`, только если необходим безопасный helper;
- `backend/test/e2e.env.ts`;
- `backend/test/jest-e2e.json`;
- новые узкие E2E isolation contract specs;
- `backend/src/security/security.service.ts`;
- `backend/src/security/security.service.spec.ts`;
- `backend/src/perf/perf-harness.spec.ts` и непосредственно связанный perf harness code — только для устранения доказанного unit failure;
- `.github/workflows/ci.yml`, только если корректировка необходима для воспроизводимого запуска и не ослабляет gates;
- финальный Stage A evidence closure report.

### Out of scope

- Stage B Platform Command Center UI;
- Stage C Admin Permission Management;
- Partner Command Center;
- изменение RBAC business matrix;
- изменение dashboard permissions;
- исключение, skip, quarantine или удаление падающего теста;
- отключение `--runInBand` как замена исправлению lifecycle/DB isolation;
- ослабление assertions, thresholds или CI gates без доказанной технической причины и явного approval пользователя;
- unrelated refactoring.

---

## NON-NEGOTIABLE CONSTRAINTS

1. Сохранить `--runInBand` для полного E2E qualification.
2. Не использовать worker-process isolation как замену корректному lifecycle и database wiring.
3. Не применять `test.skip`, `describe.skip`, `.only`, silent catch, retry loop или увеличение timeout как скрытие дефекта.
4. Не исключать `perf-harness.spec.ts` из unit command или Jest config.
5. Не объявлять flaky/pre-existing без точного failure output и повторяемого доказательства.
6. Не менять production behavior вне минимально необходимого fix.
7. Не удалять untracked или пользовательские файлы.
8. Не писать в отчёте `PASS`, если команда завершилась с ненулевым exit code.
9. Не оставлять `pending`, placeholder SHA или pre-commit state в final committed report.

---

## IMPLEMENTATION REQUIREMENTS

### A. Correct Jest Environment Context

Использовать строгий тип `EnvironmentContext` и сохранить test path в constructor:

```ts
private readonly testPath: string;

constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
  super(config, context);
  this.testPath = context.testPath;
}
```

Не использовать `(this as any).testPath` и fallback `"unknown"`.

Имя suite DB должно:

- быть детерминированно связано с `context.testPath`;
- быть безопасным PostgreSQL identifier;
- учитывать PID/worker для одновременных независимых Jest invocations;
- завершаться на `_test`;
- не совпадать с base/dev/prod DB;
- укладываться в PostgreSQL identifier limit;
- проходить явную safety validation до `DROP DATABASE` и `CREATE DATABASE`.

### B. Propagate URL into Host and Jest VM

После создания и миграции suite DB установить URL одновременно в:

```ts
process.env.DATABASE_URL
process.env.TEST_DATABASE_URL
this.global.process.env.DATABASE_URL
this.global.process.env.TEST_DATABASE_URL
```

Если используется вспомогательный env marker, например `E2E_SUITE_DB_NAME`, его также синхронно установить в host и VM env.

Порядок должен гарантировать, что `setupFiles`, импорт `AppModule`, Prisma client initialization и NestJS providers получают suite URL до первого обращения к datasource.

В teardown восстановить предыдущие host env values, а не предполагать, что они всегда равны base test URL.

### C. Prove Actual Database Connection

Добавить реальный E2E contract test через используемый приложением `PrismaService`:

```sql
SELECT current_database()
```

Обязательные assertions:

1. фактическая DB совпадает с suite DB, созданной TestEnvironment;
2. фактическая DB не равна base `travelhub1_test`;
3. фактическая DB name соответствует safety suffix/pattern;
4. test path marker не равен `unknown`;
5. два разных spec files не разделяют persisted sentinel state.

Для доказательства cross-suite isolation создать два минимальных contract spec files:

- Suite A создаёт уникальный sentinel в своей DB и подтверждает его наличие;
- Suite B подтверждает отсутствие sentinel Suite A в своей DB и создаёт собственный sentinel;
- оба suites подтверждают собственный `current_database()`.

Использовать существующие безопасные test entities/tables либо отдельную минимальную test-only SQL table. Не менять production schema только ради этого теста.

### D. Remove or Prove `require.cache` Manipulation

Jest документирует отдельный `TestEnvironment` для каждого test suite. Текущий ручной сброс `require.cache` для `src`, generated code и части `@nestjs` не является доказанным способом очистки Jest runtime module registry и потенциально создаёт несколько несовместимых копий framework modules.

Выбрать один вариант:

1. удалить ручной `require.cache` loop как ненужный после правильной DB isolation и нормального `app.close()`; **recommended**;
2. либо предоставить минимальный воспроизводимый test, который падает без этого loop и проходит с ним, а также объяснить, почему стандартная per-suite Jest environment isolation недостаточна.

Не сохранять неподтверждённое утверждение `NestJS @Global modules leak between suites` только на основании предположения.

### E. Qualify EventBus Cleanup

`EventBusService.onModuleDestroy()` допустим только если:

- каждый E2E app instance гарантированно закрывается через `await app.close()`;
- unit test подтверждает очистку typed handlers и `anyHandlers`;
- cleanup не влияет на runtime до module destroy;
- production lifecycle behavior не ломается.

Если EventBus change не нужен после корректного DB wiring и не связан с доказанным failure, обосновать сохранение либо откатить только собственное изменение безопасным non-destructive patch/commit.

### F. Fix `seedAdmin()` P2002 Contract

После `P2002` выполнить повторный authoritative query:

```ts
const concurrentAdmin = await prisma.user.findUnique({
  where: { username: ADMIN_USERNAME },
  select: { id: true },
});
```

Contract:

- если admin существует — log and return;
- если admin отсутствует — rethrow original error;
- не скрывать unrelated unique violations.

Добавить unit tests минимум для сценариев:

| Scenario | Expected result |
|---|---|
| Admin уже существует до seed | `user.create` не вызывается |
| Concurrent create вернул P2002, повторный query нашёл admin | startup продолжается |
| P2002, повторный query не нашёл admin | original error rethrown |
| Non-P2002 create error | original error rethrown |

### G. Resolve `perf-harness` Unit Failure

Сначала получить точное доказательство:

```bash
npx jest src/perf/perf-harness.spec.ts --runInBand --verbose
```

В отчёте указать:

- полное имя падающего test case;
- expected и received;
- relevant stack trace;
- воспроизводимость при нескольких последовательных запусках;
- подтверждённую root cause.

Исправить первопричину минимально. Допустимые примеры:

- deterministic fake clock;
- controlled scheduler;
- ожидание завершения реальных async operations;
- устранение race condition;
- корректный cleanup timers/handles.

Недопустимые действия:

- удалить или skip test;
- расширить tolerance/timeout без доказанного product contract;
- исключить suite из CI;
- назвать его pre-existing/flaky и продолжить без explicit user-approved waiver.

Финальный backend unit result должен быть:

```text
65/65 suites PASS
0 failed tests
exit code 0
```

Если число suites/tests закономерно изменилось из-за добавленных тестов, привести точные новые значения и объяснить разницу.

---

## REQUIRED TEST MATRIX

### 1. Targeted infrastructure tests

```bash
npx jest src/security/security.service.spec.ts --runInBand --verbose
npx jest src/perf/perf-harness.spec.ts --runInBand --verbose
npx jest --config test/jest-e2e.json --runInBand --runTestsByPath <isolation-suite-a> <isolation-suite-b>
```

Повторить isolation Suite A/B в обратном порядке и доказать одинаковый результат.

### 2. Stage A targeted E2E

Обязательно повторно выполнить:

- `restart-persistence.e2e-spec.ts`;
- `rbac-parity.e2e-spec.ts`;
- `dashboard-command-center.e2e-spec.ts`;
- `workspace-constructor.e2e-spec.ts`;
- пять ранее падавших suites:
  - `sale-completion-order-requested.e2e-spec.ts`;
  - `partner-collect-commission-accrual.e2e-spec.ts`;
  - `change-proposal.e2e-spec.ts`;
  - `storefront.e2e-spec.ts`;
  - `partner-cabinet-list.e2e-spec.ts`.

### 3. Backend full regression

```bash
npx tsc --noEmit
npm run build
npx jest --runInBand
npm run test:e2e
```

Acceptance:

- typecheck exit code 0;
- build exit code 0;
- unit: all suites/tests pass;
- full serial E2E: all suites/tests pass;
- `current_database()` evidence подтверждает suite DB, а не base DB;
- zero skipped/disabled tests unless они существовали до Round 5 и явно перечислены.

### 4. Frontend regression

```bash
npx tsc --noEmit
npx vitest run
npm run build
```

Все команды должны завершиться с exit code 0.

### 5. Migration and drift qualification

Подтвердить:

- 60 migrations применяются на fresh suite DB;
- second `prisma migrate deploy` не имеет pending migrations;
- schema drift отсутствует;
- Round 5 не добавляет production migration без реальной необходимости;
- DB isolation specs не требуют production schema changes.

### 6. Open handles and cleanup

Выполнить targeted run с диагностикой открытых ресурсов:

```bash
npx jest --config test/jest-e2e.json --runInBand --detectOpenHandles --runTestsByPath <isolation-suite-a> <isolation-suite-b>
```

Не должно оставаться:

- активных Prisma connections;
- незакрытых Nest applications;
- EventBus handlers между app lifecycles;
- suite databases после нормального teardown;
- зависших timers/workers.

Если cleanup suite DB не удался, test run должен завершиться как failure либо вывести отдельное явно квалифицированное cleanup failure. Нельзя молча объявлять полный PASS при оставленной suite DB.

---

## CI REQUIREMENTS

После локального PASS:

1. создать implementation commit;
2. обновить evidence report реальными SHA;
3. создать documentation commit;
4. push в `origin/master`;
5. дождаться terminal GitHub Actions result для final SHA;
6. получить workflow run URL, run ID, conclusion и job results;
7. при CI failure исправить root cause и повторить qualification;
8. не объявлять Verdict A при `queued`, `in_progress`, `cancelled`, `skipped` или отсутствии run evidence.

CI workflow не должен ослабляться. `--runInBand` сохранить.

---

## GIT REQUIREMENTS

До commit:

```bash
git diff --check
git status --short
git diff --stat
git diff --name-status
```

Implementation commit должен содержать только Round 5 production/test/infrastructure changes.

Evidence report рекомендуется оформить отдельным documentation commit после получения всех локальных результатов. После push и terminal CI success разрешён финальный documentation correction commit, если необходимо внести final SHA и CI run evidence.

В конце доказать:

```bash
git rev-parse HEAD
git rev-parse origin/master
git ls-remote origin refs/heads/master
git status --short
```

Не заявлять `worktree clean`, если присутствуют untracked files. Использовать точные формулировки:

```text
Tracked scope clean: 0 modified, 0 staged
Repository worktree not clean: pre-existing untracked files present
```

если это соответствует фактическому состоянию.

---

## EVIDENCE REPORT REQUIREMENTS

Обновить:

```text
docs/prompts/PHASE_3_STEP_3.2_STAGE_A_REMEDIATION_EVIDENCE_CLOSURE_REPORT.md
```

Отчёт должен содержать:

1. Repository State с полными SHA;
2. Round 5 implementation и documentation commits;
3. точное описание Jest host env vs VM env defect;
4. финальный URL propagation contract;
5. `context.testPath` contract;
6. isolation test evidence с фактическими `current_database()` values;
7. cross-suite sentinel evidence;
8. `seedAdmin` P2002 tests;
9. точный `perf-harness` failure и fix;
10. backend unit final totals;
11. targeted E2E totals;
12. full serial E2E totals и duration;
13. frontend totals;
14. migration/drift evidence;
15. CI run URL, ID, final SHA и terminal conclusions;
16. полный список changed files;
17. точный tracked/untracked worktree state;
18. explicit statement о наличии или отсутствии waiver.

В final report запрещены:

- `_pending_`, `TBD`, placeholder SHA;
- pre-commit HEAD/origin values;
- приблизительные test counts без маркировки;
- `PASS` при ненулевом exit code;
- утверждение `unique DB per suite` без `current_database()` evidence;
- утверждение `CI PASS` без terminal run evidence;
- утверждение `Waiver NOT REQUIRED`, если хотя бы один обязательный gate failed или исключён.

---

## ACCEPTANCE CRITERIA — VERDICT A

Verdict A разрешён только при одновременном выполнении всех условий:

| Criterion | Required result |
|---|---|
| Required base verified | ✅ |
| `context.testPath` stored and used | ✅ |
| Host + Jest VM env synchronized | ✅ |
| Prisma `current_database()` = suite DB | ✅ |
| Base `travelhub1_test` not used by E2E app | ✅ |
| Cross-suite sentinel isolation | ✅ |
| Safe suite DB naming and cleanup | ✅ |
| `seedAdmin` P2002 contract fixed and tested | ✅ |
| `perf-harness` root cause fixed | ✅ |
| Backend unit | All PASS, exit 0 |
| Stage A targeted E2E | All PASS |
| Five previously failing suites | All PASS |
| Full serial E2E | All PASS, exit 0 |
| Backend typecheck/build | PASS |
| Frontend typecheck/Vitest/build | PASS |
| Migrations/drift | PASS |
| GitHub Actions final SHA | Terminal SUCCESS |
| Final report | Accurate, no pending/stale claims |
| HEAD/origin/remote master | Equal |
| Tracked scope | Clean |
| User files | Preserved |
| Waiver | None required, либо заранее явно одобрен пользователем |

Если хотя бы один критерий не выполнен:

```text
VERDICT B — STAGE A NOT CLOSED
```

и предоставить точный blocker без маскировки.

---

## FINAL RESPONSE FORMAT

Итоговый ответ разработчика предоставить строго на русском языке в следующей структуре:

```text
PHASE 3 — STEP 3.2 — STAGE A — ROUND 5 — VERDICT A|B

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
- tracked/untracked state

Root Cause Closure
- Jest host/VM env defect
- context.testPath defect
- actual current_database evidence
- cross-suite isolation evidence

Security Fix
- seedAdmin P2002 contract
- unit test scenarios

Perf Harness Fix
- exact failing test
- root cause
- remediation
- repeated result

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
- detectOpenHandles result

CI Evidence
- workflow name
- run ID and URL
- final SHA
- job conclusions
- terminal conclusion

Files Changed
- production
- tests
- infrastructure
- documentation

Commits
- SHA and message for every Round 5 commit

Waiver
- NONE, либо exact user-approved waiver

NEXT
- Stage B allowed only for Verdict A
```

---

## NEXT STEP AFTER SUCCESS

Только после подтверждённого Verdict A:

```text
NEXT: PHASE 3 — STEP 3.2 — STAGE B — PLATFORM COMMAND CENTER UI — IMPLEMENTATION
```

