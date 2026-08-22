# PHASE 3 — STEP 3.2 — STAGE A REMEDIATION ROUND 2

## Evidence integrity, real persistence tests and migration qualification

Работай в репозитории:

- Repository: `https://github.com/seldom733-hash/travelhub1`
- Branch: `master`
- Expected base SHA: `a1cad6f41204bff303078643042e54e7705f1d24`
- Upstream: `origin/master`

Все пояснения, отчёты, выводы команд и итоговый ответ предоставляй **на русском языке**. Названия сущностей, API, permission codes и технические термины можно оставлять на английском.

---

## 1. Решение по предыдущей итерации

Текущий результат получает:

```text
VERDICT B — STAGE A REMEDIATION EVIDENCE NOT CLOSED
```

Security fix в `workspace.controller.ts` принят: оба Command Center GET endpoint’а теперь проверяют `analytics.read`. Не отменяй и не переделывай рабочее исправление без обнаруженной технической причины.

Stage A пока не может считаться завершённым, потому что опубликованные доказательства не соответствуют фактическим тестам и обязательным acceptance criteria.

---

## 2. Сначала repository-first проверка

До изменений выполни:

```bash
git remote -v
git branch --show-current
git fetch origin
git rev-parse HEAD
git rev-parse origin/master
git status --short
git log --oneline -8
git show --stat --oneline 2798dc7baaa5d556f6d84f5fdf9a7d59aa91f87a
git show --stat --oneline a1cad6f41204bff303078643042e54e7705f1d24
```

Обязательные preconditions:

- `HEAD == origin/master == a1cad6f41204bff303078643042e54e7705f1d24`;
- branch = `master`;
- repository URL совпадает;
- предсуществующие untracked/modified файлы перечислить и не изменять;
- не использовать destructive commands и force push;
- при несовпадении базы остановиться и сообщить расхождение.

---

## 3. Доказанные проблемы текущего evidence set

### 3.1 Persistence tests №4 и №5 не моделируют persisted state

В `backend/src/security/security.service.spec.ts`:

- тест `revoked default link stays revoked` не создаёт и не удаляет `MARKETER → dashboard.marketplace.read`;
- тест `non-default grant survives` не создаёт `FINANCE → analytics.read`;
- оба теста только повторяют проверку, что mock-методы `rolePermission` не были вызваны;
- test №7 заявляет `try/finally`, но фактически использует только два независимых mock object без `try/finally`.

Такие тесты полезны как unit contract «seed не вызывает RolePermission mutators», но не доказывают сохранение реальных persisted links после restart.

### 3.2 Не все E2E assertions реальны

В `dashboard-command-center.e2e-spec.ts`:

- тест `financial read model not called without Financial permission` не содержит spy/assertion — после HTTP-запроса расположен только комментарий;
- unauthorized trends test проверяет `403`, но не доказывает, что analytics provider не был вызван.

В `workspace-constructor.e2e-spec.ts`:

- `/command-center/widgets` проверен на `403` только для `BUYER`;
- полный contract для обоих GET endpoint’ов и заявленных ролей не доказан симметрично;
- созданный после применения всех migrations grant доказывает runtime authorization, но не preservation во время Stage A migration.

### 3.3 Migration qualification подменена выводами

Текущий report утверждает:

- upgrade DB preservation;
- second deploy;
- bidirectional parity;
- drift = 0.

Но фактически:

- `e2e.global-setup.ts` каждый раз удаляет DB и применяет все 60 migrations на fresh database — это не upgrade scenario;
- extra grant создаётся уже после Stage A migration — это не migration preservation test;
- parity не вычисляется запросом/скриптом в обе стороны;
- `prisma migrate deploy` не доказывает отсутствие schema drift «по определению»;
- повторный deploy не подтверждён отдельным зафиксированным результатом.

### 3.4 Regression/report не закрыты

- frontend `next build` не запускался, но report маркирует его как `✅ NOT BLOCKED`;
- опубликованный report содержит `pending commit`, `pending push` и старые HEAD/upstream значения;
- строка `Commit(s) pushed ✅ (pending)` является внутренним противоречием;
- GitHub Actions runs для final SHA отсутствуют, поэтому локальные результаты должны быть воспроизводимо и честно зафиксированы.

---

## 4. Scope Round 2

В этой итерации:

1. заменить недоказательные persistence tests реальными DB-backed tests;
2. добавить отсутствующие spies/assertions и полную HTTP endpoint matrix;
3. реально выполнить fresh и upgrade migration qualification;
4. выполнить frontend production build;
5. исправить evidence report, не оставляя ложных PASS/pending.

Не начинать Stage B и не менять визуальный frontend.

---

## 5. Реальные restart-persistence tests

Сохрани unit test, доказывающий отсутствие вызовов:

- `rolePermission.create`;
- `createMany`;
- `upsert`;
- `update`;
- `delete`;
- `deleteMany`.

Но переименуй/удали mock tests, которые заявляют persisted revoke/grant, не создавая persisted state.

Добавь DB-backed integration/E2E suite на изолированной test database:

### Test A — revoked default survives restart

1. убедиться, что default link `MARKETER → dashboard.marketplace.read` существует;
2. удалить этот `RolePermission` link;
3. вызвать реальный `SecurityService.onModuleInit()` либо инициировать эквивалентный normal application restart lifecycle;
4. повторно запросить БД;
5. доказать, что link не восстановлен;
6. восстановить исходное состояние в `finally`.

### Test B — non-default grant survives restart

1. убедиться, что link `FINANCE → analytics.read` отсутствует по default;
2. создать persisted grant;
3. вызвать реальный `SecurityService.onModuleInit()`/restart lifecycle;
4. повторно запросить БД;
5. доказать, что grant существует;
6. удалить созданный grant в `finally`.

### Test C — repeated startup

1. вызвать lifecycle минимум дважды;
2. доказать, что оба состояния A/B не меняются;
3. доказать отсутствие duplicate catalog rows и ошибок idempotency.

Тесты должны проверять записи через реальный `PrismaService`, а не только историю mock calls. Не оставляй тест с названием `try/finally`, если в нём нет фактического persisted mutation и cleanup.

---

## 6. Dashboard E2E: настоящие negative-call assertions

Используй реальные repository dependencies `DashboardService` и его read-model/analytics providers. Не угадывай имя класса — сначала прочитай constructor и существующие unit tests.

Обязательные сценарии:

1. Для `MARKETER` запрос summary возвращает только `executive` и `marketplace`.
2. Установить spy на financial reconciliation/read-model method.
3. Выполнить HTTP summary request от `MARKETER`.
4. Assert: financial provider/reconciliation method `not.toHaveBeenCalled()`.
5. Установить spy на trends analytics method.
6. Запросить известную, но unauthorized financial metric от `MARKETER`.
7. Assert: HTTP `403` и trends analytics method `not.toHaveBeenCalled()`.
8. Для unknown metric: `404`; отдельно доказать отсутствие analytics call.
9. После каждого spy выполнить `mockRestore()` в `finally`/`afterEach`.

Комментарий в тесте не считается assertion.

---

## 7. Полная HTTP matrix для workspace

Проверить **оба** endpoint’а:

- `GET /api/v1/workspaces/command-center`;
- `GET /api/v1/workspaces/command-center/widgets`.

Минимальная matrix:

| Actor | Layout GET | Widgets GET |
| --- | ---: | ---: |
| no token | 401 | 401 |
| ADMIN | 200 | 200 |
| MARKETER | 200 | 200 |
| FINANCE default | 403 | 403 |
| PARTNER default | 403 | 403 |
| BUYER default | 403 | 403 |
| FINANCE + persisted `analytics.read` | 200 | 200 |
| FINANCE after grant removal | 403 | 403 |

Также сохранить проверки:

- FINANCE с `analytics.read`, но без `dashboard.customize` → PUT `403`;
- тот же actor → DELETE `403`;
- actor с обеими permissions → PUT/DELETE success contract;
- все созданные RolePermission fixtures очищаются через `finally`.

Не ограничиваться проверкой одного из двух GET route.

---

## 8. Реальная migration qualification

Используй только task-specific isolated PostgreSQL databases. Не трогай development/staging/production DB. Имена временных БД должны содержать `test` или другой repository safety marker.

### 8.1 Fresh deploy

На пустой БД:

1. `prisma migrate deploy` — применить все 60 migrations;
2. `prisma migrate status` — 0 pending;
3. повторно выполнить `prisma migrate deploy` — получить explicit no-pending/idempotent result;
4. запустить automated parity check.

Parity check должен сравнить фактическую БД с constants в обе стороны:

- `PERMISSIONS - DB Permission = 0`;
- `DB Permission - expected catalog = 0`, если полный catalog является frozen contract;
- для каждой роли `ROLE_PERMISSIONS - DB defaults = 0`;
- `DB defaults - ROLE_PERMISSIONS = 0` на fresh DB;
- отдельно вывести counts и пять dashboard permission codes.

Можно создать воспроизводимый task-specific TypeScript verification script/test. Не доказывать parity только чтением INSERT SQL.

### 8.2 Настоящий upgrade scenario

На отдельной БД:

1. развернуть repository state/migrations непосредственно перед `20260819235237_add_dashboard_section_authority` (59 migrations);
2. до Stage A migration создать non-default grant, не входящий в old defaults;
3. зафиксировать его identity;
4. применить Stage A migration через реальный Prisma migration flow;
5. доказать, что grant сохранился;
6. выполнить normal application startup;
7. доказать, что grant сохранился и после startup;
8. повторный deploy должен сообщить отсутствие pending migrations.

Допустимые способы подготовить pre-Stage-A state:

- отдельный task-created git worktree/checkpoint на commit до migration;
- временная копия Prisma migration tree без migration №60;
- другой безопасный воспроизводимый метод, реально оставляющий БД на 59 migrations.

Любые временно перемещённые файлы должны быть восстановлены. Не удалять пользовательские файлы.

Grant, созданный после всех 60 migrations, **не** считается upgrade preservation proof.

### 8.3 Drift

Не писать, что `migrate deploy` означает drift=0 по определению. Используй repository/Prisma-supported schema diff или shadow-database проверку, которая действительно сравнивает migration history с текущей schema.

Зафиксировать:

- точную команду;
- exit code;
- meaningful output;
- интерпретацию результата.

Если выбранный Prisma version не поддерживает ожидаемый синтаксис, найти корректную команду по установленной версии и package scripts; не выдумывать PASS.

После квалификации удалить только task-created temporary databases/worktrees.

---

## 9. Полный regression gate

Сначала прочитать актуальные scripts в `backend/package.json` и `frontend/package.json`.

Обязательно выполнить:

### Backend

- `npm run typecheck`;
- `npm run build`;
- полный `npm test`;
- полный `npm run test:e2e`;
- отдельно DB-backed restart-persistence suite;
- отдельно migration qualification checks.

### Frontend

- `npx tsc --noEmit` либо фактический repository typecheck command;
- `npm test`;
- `npm run build` (`next build`) — **обязательно**, даже если frontend code не менялся.

### Repository

- `git diff --check`;
- `git status --short`;
- проверить diff каждого изменённого файла;
- unrelated files не включать в commit.

Не маркировать невыполненную команду как `PASS`, `NOT BLOCKED` или эквивалент.

---

## 10. Исправление evidence report

Обновить:

`docs/prompts/PHASE_3_STEP_3.2_STAGE_A_REMEDIATION_EVIDENCE_CLOSURE_REPORT.md`

Обязательные исправления:

- заменить `pending commit` и `pending push` на честные значения/структуру;
- зафиксировать Round 1 implementation SHA `2798dc7baaa5d556f6d84f5fdf9a7d59aa91f87a`;
- зафиксировать Round 1 report SHA `a1cad6f41204bff303078643042e54e7705f1d24`;
- добавить Round 2 implementation/test SHA;
- final report commit SHA можно сообщить в итоговом ответе, чтобы не создавать self-reference;
- не называть pre-commit status финальным состоянием;
- заменить фиктивные persistence descriptions реальными DB-backed evidence;
- указать exact fresh/upgrade DB method;
- привести actual parity counts;
- привести actual second-deploy result;
- заменить ложное утверждение о drift реальной проверкой;
- добавить frontend `next build` result;
- исправить test counts по фактическому output;
- удалить формулировки вида `✅ (pending)`;
- отделить локально выполненные проверки от GitHub Actions; если Actions runs отсутствуют, сказать это прямо;
- дать точные tracked/untracked worktree формулировки после push.

Report не должен утверждать больше, чем проверено командами и assertions.

---

## 11. Scope restrictions

Не выполнять:

- Stage B Platform Command Center UI;
- установку `recharts`/`@dnd-kit/core`;
- Partner Command Center;
- Stage C Admin Permission Management;
- Organization Switcher;
- изменение safe default matrix;
- новый override/provenance model;
- unrelated production refactors;
- удаление pre-existing untracked files.

Production controller fix из `2798dc7` должен остаться действующим.

---

## 12. Commit and publish

Рекомендуемая честная схема:

1. implementation/tests/evidence-script commit;
2. documentation report commit, ссылающийся на SHA первого commit.

После push:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/master
git ls-remote origin refs/heads/master
git status --short
```

Обязательно:

- fast-forward only;
- `HEAD == origin/master == ls-remote master`;
- tracked scope clean;
- untracked files перечислены отдельно;
- не называть весь worktree clean, если untracked files присутствуют.

---

## 13. Acceptance criteria

`VERDICT A — STAGE A REMEDIATION ROUND 2 COMPLETED` разрешён только если одновременно:

- controller fix сохранён;
- DB-backed test реально удаляет MARKETER default link и доказывает, что restart его не восстанавливает;
- DB-backed test реально создаёт FINANCE extra grant и доказывает, что restart его не удаляет;
- misleading mock tests исправлены/переименованы;
- financial summary provider `not called` подтверждён spy assertion;
- unauthorized/unknown trend analytics call suppression подтверждён spy assertions;
- оба workspace GET endpoint’а покрыты полной role matrix;
- fresh deploy применяет 60 migrations;
- bidirectional parity вычислена автоматически;
- настоящий 59→60 upgrade сохраняет grant, созданный до migration №60;
- второй deploy выполнен и зафиксирован;
- drift проверен реальным schema comparison method;
- backend typecheck/build/full unit/full E2E проходят;
- frontend typecheck/Vitest/`next build` проходят;
- report не содержит ложных PASS и pending contradictions;
- commits pushed и remote SHA подтверждён;
- unrelated files не изменены.

При невыполнении хотя бы одного пункта:

```text
VERDICT B — STAGE A REMEDIATION ROUND 2 NOT COMPLETED
```

Stage B не начинать.

---

## 14. Формат итогового ответа

Ответить на русском языке:

```text
PHASE 3 — STEP 3.2 — STAGE A REMEDIATION ROUND 2 — VERDICT A/B

Repository State
- Repository / branch
- Base SHA
- Implementation SHA
- Report/final SHA
- HEAD / origin/master / ls-remote
- tracked/untracked state

Accepted Security Code
- GET layout gate
- GET widgets gate
- PUT/DELETE gates

Real Restart Persistence
- revoked MARKETER default before/after restart
- FINANCE extra grant before/after restart
- repeated startup

HTTP E2E Evidence
- dashboard source-call suppression
- trends source-call suppression
- workspace two-GET matrix
- customize matrix

Migration Qualification
- fresh DB
- automated parity counts
- real 59→60 upgrade
- pre-migration grant preservation
- second deploy
- drift command/result

Regression
- backend typecheck/build/unit/E2E
- frontend typecheck/Vitest/next build
- GitHub Actions availability

Files Changed

Report Corrections

Commit(s)
```

### NEXT

Только после подтверждённого `VERDICT A`:

```text
NEXT: PHASE 3 — STEP 3.2 — STAGE B — PLATFORM COMMAND CENTER UI — IMPLEMENTATION
```

