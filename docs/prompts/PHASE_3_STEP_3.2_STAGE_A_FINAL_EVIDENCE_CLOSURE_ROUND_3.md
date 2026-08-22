# PHASE 3 — STEP 3.2 — STAGE A FINAL EVIDENCE CLOSURE — ROUND 3

## Test isolation, complete HTTP matrix, full E2E regression, RBAC parity, real drift check and CI

Работай в репозитории:

- Repository: `https://github.com/seldom733-hash/travelhub1`
- Branch: `master`
- Expected base SHA: `c25f128c70c3b6707f0113d8a5ed5e4e9640d800`
- Upstream: `origin/master`

Все пояснения, отчёты, выводы команд и итоговый ответ предоставляй **на русском языке**. Технические имена, permission codes, команды и API routes можно оставлять на английском.

---

## 1. Текущий verdict

```text
VERDICT B — STAGE A FINAL EVIDENCE NOT CLOSED
```

Принято и не требует повторной реализации:

- GET page gate `analytics.read`;
- controller prefix fix `@Controller("workspaces")`;
- DB-backed restart test foundation;
- реальные `not.toHaveBeenCalled()` spies для financial/trends;
- fresh deploy и настоящий 59→60 upgrade experiment;
- backend/frontend targeted regression, включая `next build`.

Round 3 должен закрыть только оставшиеся доказательные и test-integrity gaps. Stage B не начинать.

---

## 2. Repository-first preflight

Перед изменениями:

```bash
git remote -v
git branch --show-current
git fetch origin
git rev-parse HEAD
git rev-parse origin/master
git status --short
git log --oneline -8
git show --stat --oneline 719d7e03c2bc408db779afb31072dfc4eed00c5d
git show --stat --oneline c25f128c70c3b6707f0113d8a5ed5e4e9640d800
```

Продолжать только если:

- branch = `master`;
- `HEAD == origin/master == c25f128c70c3b6707f0113d8a5ed5e4e9640d800`;
- remote соответствует `seldom733-hash/travelhub1`;
- unrelated tracked/untracked files перечислены и не включаются в scope.

Не использовать destructive commands и force push.

---

## 3. Доказанные оставшиеся расхождения

### 3.1 Restart suite всё ещё зависит от порядка тестов

В `backend/test/restart-persistence.e2e-spec.ts`:

- Test A удаляет `MARKETER → dashboard.marketplace.read`, но восстанавливает link только в `afterAll`;
- Test B создаёт `FINANCE → analytics.read`, но удаляет grant только в `afterAll`;
- Test C выполняется до cleanup Test B, поэтому считает FINANCE вместе с временным extra grant;
- Test E сознательно не проверяет `dashboard.marketplace.read`, потому что Test A оставил его удалённым;
- комментарий утверждает «test's own finally», но фактически используется suite-level `afterAll`.

Это не test isolation. Каждый тест должен сам вернуть БД к исходному состоянию независимо от результата и порядка выполнения.

### 3.2 Старые misleading mock tests остались

`backend/src/security/security.service.spec.ts` не изменён в Round 2. В нём по-прежнему есть тесты с названиями:

- `revoked default link stays revoked`;
- `non-default grant survives`;
- `test fixtures are restored (try/finally...)`.

Они не создают persisted RolePermission state и не используют `try/finally`. После появления настоящего DB-backed suite эти тесты надо удалить либо честно переименовать в mock-call contract tests без заявлений о persistence.

### 3.3 HTTP matrix не полная

В committed E2E отсутствуют:

- no-token `GET /api/v1/workspaces/command-center/widgets` → `401`;
- FINANCE + persisted `analytics.read` → Widgets GET `200`;
- FINANCE после удаления grant → Widgets GET `403`.

В published report эти клетки обозначены `—`, хотя section называется `Full HTTP Matrix`.

### 3.4 «Total E2E = 59» — это только три выбранных suite

В `backend/test` находится 73 файла `*.e2e-spec.ts`. Report перечисляет только:

- restart-persistence — 5 tests;
- dashboard-command-center — 23 tests;
- workspace-constructor — 31 tests.

Их сумма 59 не является полным backend E2E regression. Обязательная команда `npm run test:e2e` по всему `jest-e2e.json` не доказана.

### 3.5 Parity проверена counts только для трёх ролей

Counts `ADMIN=126`, `MARKETER=10`, `FINANCE=29` не доказывают точный состав permissions и ничего не проверяют для остальных ролей. Две разные матрицы могут иметь одинаковые counts.

Нужна set equality в обе стороны для Permission catalog и каждой роли из `ROLE_PERMISSIONS`.

### 3.6 Drift снова не доказан

`prisma migrate status` сравнивает migration files с таблицей `_prisma_migrations`, показывает pending/failed/diverged migration history, но не является полной schema drift comparison.

Для schema comparison использовать поддерживаемый установленной версией Prisma `prisma migrate diff` между migration history и фактической datasource schema. Сначала выполнить `npx prisma migrate diff --help` и применить синтаксис именно установленной версии.

### 3.7 Report и CI содержат неверные сведения

- report всё ещё содержит `Round 2 implementation = pending`, `Final SHA = pending`, старые HEAD/origin и два pending commit rows;
- в репозитории существуют `.github/workflows/ci.yml` и `release.yml`;
- `ci.yml` запускается на push в `master` и выполняет backend typecheck/build/unit/full E2E и frontend typecheck/tests/build;
- утверждение `GitHub Actions not configured` неверно.

---

## 4. Исправить test isolation

Переработать `restart-persistence.e2e-spec.ts` так, чтобы каждый mutating test был самодостаточным.

### Test A — revoke

```text
resolve role + permission
ensure baseline link exists
try:
  delete link
  assert missing
  call onModuleInit()
  assert still missing
finally:
  restore link if missing
assert baseline restored after finally
```

### Test B — extra grant

```text
resolve role + permission
ensure baseline link absent
try:
  create grant
  assert present
  call onModuleInit()
  assert still present
finally:
  delete grant if present
assert baseline restored after finally
```

### Test C — repeated startup

- запускаться на clean baseline, не зависеть от A/B;
- записать exact baseline sets/counts;
- вызвать `onModuleInit()` минимум трижды;
- подтвердить exact equality до/после;
- не использовать count, загрязнённый fixture другого теста.

### Test D/E

- Test E должен проверять полный ожидаемый dashboard default set MARKETER, включая `dashboard.marketplace.read`;
- тесты должны проходить независимо через `--runTestsByPath` и при random/reversed order, насколько позволяет Jest setup;
- `afterAll` можно оставить только как аварийный fallback cleanup, но primary cleanup обязан находиться в `finally` каждого mutating test.

---

## 5. Исправить misleading unit tests

В `backend/src/security/security.service.spec.ts`:

- сохранить unit-тест, проверяющий отсутствие вызовов всех RolePermission mutators;
- удалить либо переименовать fake persistence tests №4/№5;
- удалить fake `try/finally` test №7 либо заменить честным unit isolation test;
- названия тестов должны точно описывать проверяемое поведение;
- не дублировать DB-backed assertions mock-реализацией.

Рекомендуемое разделение:

- unit spec: `seed does not call RolePermission mutation methods`;
- DB-backed E2E: persisted revoke/grant реально переживают `onModuleInit()`.

---

## 6. Закрыть полную workspace HTTP matrix

Для обоих GET endpoint’ов:

- `/api/v1/workspaces/command-center`;
- `/api/v1/workspaces/command-center/widgets`.

Обязательные assertions:

| Actor/state | Layout GET | Widgets GET |
| --- | ---: | ---: |
| no token | 401 | 401 |
| ADMIN | 200 | 200 |
| MARKETER | 200 | 200 |
| FINANCE default | 403 | 403 |
| PARTNER default | 403 | 403 |
| BUYER default | 403 | 403 |
| FINANCE + persisted `analytics.read` | 200 | 200 |
| FINANCE after grant removal | 403 | 403 |

Grant/revoke tests должны проверять оба GET route внутри одного `try/finally` lifecycle. После cleanup выполнить повторный login и оба `403` assertions.

Сохранить PUT/DELETE customize coverage.

---

## 7. Полная RBAC parity

Создать воспроизводимый TypeScript script или DB-backed test, который импортирует реальные:

- `ALL_PERMISSIONS`/`PERMISSIONS`;
- `ROLE_PERMISSIONS`;
- `RoleCode`.

После fresh deploy проверить:

### Permission catalog

- expected set minus DB set = `[]`;
- DB set minus expected set = `[]`;
- exact set equality, не только count;
- count вывести дополнительно.

### RolePermission matrix

Для **каждой** роли:

- `ADMIN`;
- `DIRECTOR`;
- `FINANCE`;
- `MARKETER`;
- `ANALYST`;
- `MODERATOR`;
- `SALES_MANAGER`;
- `OPERATOR`;
- `PARTNER`;
- `BUYER`;

вычислить:

- expected permission codes minus actual DB codes;
- actual DB codes minus expected permission codes;
- обе разницы должны быть `[]`;
- вывести expected/actual counts как вспомогательные данные.

Для ADMIN expected set — полный catalog, если именно это закреплено constants.

Parity script/test должен завершаться non-zero/fail при любом missing/extra code.

---

## 8. Настоящая schema drift проверка

На task-specific fresh DB после 60 migrations:

1. выполнить `npx prisma migrate status` и использовать его только как migration-history/pending check;
2. выполнить `npx prisma migrate diff --help`;
3. корректной для установленной Prisma версии командой сравнить:
   - schema, получаемую из migration history;
   - фактическую datasource schema;
4. использовать `--exit-code` или эквивалентный machine-verifiable result;
5. сохранить exact command, exit code и meaningful output;
6. только отсутствие diff позволяет написать `schema drift = 0`.

Если `migrate diff` требует shadow database URL — использовать отдельную task-specific DB. После проверки удалить только созданные задачей временные БД.

Не заменять `migrate diff` повторным `migrate status`.

---

## 9. Выполнить полный E2E regression

Из `backend` выполнить именно полный script:

```bash
npm run test:e2e
```

Он должен использовать `test/jest-e2e.json` и обнаружить весь набор `test/.*\.e2e-spec\.ts$`, а не только три suite через `--testPathPattern`.

В отчёте указать:

- сколько всего E2E suites обнаружено;
- сколько suites passed/failed;
- сколько tests passed/failed/skipped;
- длительность;
- exact command;
- отсутствие незакрытых handles/cleanup failures, если Jest их сообщает.

Targeted runs трёх Stage A suites выполнить дополнительно, но не называть их full regression.

Если полный legacy E2E содержит failure:

- привести failing suite/test и существенный error;
- определить, связан ли failure с текущим изменением;
- не выдавать `VERDICT A`, пока обязательный gate не закрыт либо отдельно не изменён architecture contract.

---

## 10. Проверить GitHub Actions

В репозитории CI настроен:

`.github/workflows/ci.yml`

После push:

- найти workflow run для final commit SHA;
- проверить backend job;
- проверить frontend job;
- привести run URL, conclusion и job conclusions;
- если workflow не стартовал, определить точную причину: Actions disabled, permissions, skipped trigger, billing/quota или другое;
- не писать `GitHub Actions not configured`.

Если CI run доступен и failed — `VERDICT A` запрещён до исправления или честного external-blocker решения.

---

## 11. Полный regression gate

### Backend

- `npm run typecheck`;
- `npm run build`;
- `npm test` — полный unit suite;
- `npm run test:e2e` — все E2E suites;
- targeted restart/dashboard/workspace runs;
- fresh migration deploy;
- second deploy;
- 59→60 upgrade preservation;
- full RBAC parity;
- real migrate diff.

### Frontend

- `npx tsc --noEmit`;
- `npm test`;
- `npm run build`.

### Repository

- `git diff --check`;
- inspect diff каждого изменённого файла;
- no unrelated staged files;
- точное tracked/untracked состояние.

Не считать ранее выполненную команду доказательством после изменения тестов, если изменение могло повлиять на её результат.

---

## 12. Исправить published evidence report

Обновить:

`docs/prompts/PHASE_3_STEP_3.2_STAGE_A_REMEDIATION_EVIDENCE_CLOSURE_REPORT.md`

Исправить обязательно:

- Round 2 implementation = `719d7e03c2bc408db779afb31072dfc4eed00c5d`;
- Round 2 report = `c25f128c70c3b6707f0113d8a5ed5e4e9640d800`;
- добавить Round 3 implementation/test commit SHA;
- не оставлять `pending` rows;
- final report commit SHA сообщить в итоговом ответе, чтобы избежать self-reference;
- указать final HEAD/origin/ls-remote в итоговом ответе;
- заменить неполную HTTP table полной;
- привести real isolated persistence evidence;
- привести parity для всех 10 ролей, не только counts трёх;
- разграничить `migrate status` и `migrate diff`;
- заменить `Total E2E 59` на targeted subtotal и отдельно полный E2E result;
- исправить GitHub Actions section по фактическому CI workflow/run;
- не писать PASS без команды/assertion;
- точно указать файлы Round 3 и cumulative files отдельно.

---

## 13. Scope restrictions

Не выполнять:

- Stage B UI;
- изменение Command Center visual design;
- установку charts/DnD libraries;
- Partner Command Center;
- Stage C Admin Permission Management;
- Organization Switcher;
- изменение safe defaults;
- новый override/provenance model;
- unrelated production refactor.

Production code менять не должно требоваться. Если обнаружена новая production-проблема — сначала доказать её тестом и описать отдельно.

---

## 14. Commit and push

Рекомендуемая схема:

1. tests/verification commit;
2. evidence report commit.

После push:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/master
git ls-remote origin refs/heads/master
git status --short
```

Требования:

- fast-forward push;
- `HEAD == origin/master == ls-remote master`;
- tracked scope clean;
- pre-existing untracked files перечислены отдельно;
- дождаться финального CI conclusion для final SHA.

---

## 15. Acceptance criteria

`VERDICT A — STAGE A COMPLETED` разрешён только если:

- каждый DB-mutating persistence test использует собственный `try/finally` cleanup;
- tests не зависят от порядка;
- старые misleading mock tests удалены/переименованы;
- полная 8-row × 2-GET HTTP matrix подтверждена assertions;
- grant/revoke проверены на Layout GET и Widgets GET;
- Permission catalog имеет exact set parity;
- все 10 ролей имеют exact bidirectional RolePermission parity на fresh DB;
- настоящий 59→60 upgrade сохраняет pre-migration grant;
- second deploy = no pending;
- `migrate status` подтверждает migration history;
- `migrate diff` подтверждает schema drift = 0;
- полный `npm run test:e2e` проходит по всему набору suites;
- backend unit/typecheck/build проходят;
- frontend typecheck/Vitest/next build проходят;
- GitHub Actions workflow проверен и его состояние указано честно;
- published report не содержит pending/false claims;
- commits pushed, remote SHA подтверждён;
- unrelated files не изменены.

Иначе:

```text
VERDICT B — STAGE A FINAL EVIDENCE NOT CLOSED
```

Stage B не начинать.

---

## 16. Формат итогового ответа

```text
PHASE 3 — STEP 3.2 — STAGE A FINAL EVIDENCE CLOSURE ROUND 3 — VERDICT A/B

Repository State
- repository / branch
- base SHA
- Round 3 implementation SHA
- report/final SHA
- HEAD / origin/master / ls-remote
- tracked/untracked

Test Isolation
- revoke test cleanup
- grant test cleanup
- order independence
- corrected unit test names

Full Workspace HTTP Matrix
- all 8 actors/states × both GET routes
- PUT/DELETE customize

RBAC Parity
- permission missing/extra
- each of 10 roles missing/extra

Migration Qualification
- fresh deploy
- 59→60 upgrade
- second deploy
- migrate status
- migrate diff command/exit/output

Regression
- backend typecheck/build/unit
- targeted Stage A E2E
- full E2E suites/tests
- frontend typecheck/Vitest/build

GitHub Actions
- workflow run URL
- backend conclusion
- frontend conclusion

Report Corrections

Files Changed

Commits
```

### NEXT

Только после independently verified `VERDICT A`:

```text
NEXT: PHASE 3 — STEP 3.2 — STAGE B — PLATFORM COMMAND CENTER UI — IMPLEMENTATION
```

