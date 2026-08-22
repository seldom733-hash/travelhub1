# PHASE 3 — STEP 3.2 — STAGE A REMEDIATION AND EVIDENCE CLOSURE

## Workspace GET page gates, restart persistence, migration qualification and E2E coverage

Работай в репозитории:

- Repository: `https://github.com/seldom733-hash/travelhub1`
- Branch: `master`
- Expected base SHA: `8ca7cecb500a624f898461504bdea3462e0f95b5`
- Upstream: `origin/master`

Все пояснения, отчёты, выводы команд и итоговый ответ предоставляй **на русском языке**. Имена файлов, сущностей, API, permission codes и технические термины можно оставлять на английском.

---

## 1. Цель

Не начинать Stage B и не переделывать уже реализованную архитектуру Stage A. Выполнить точечную remediation-итерацию, закрывающую обнаруженный security gap и недостающие доказательства:

1. обеспечить server-side page gate `analytics.read` для всех четырёх workspace endpoint’ов Command Center;
2. доказать тестами, что persisted `RolePermission` не синхронизируется и не перезаписывается при restart;
3. квалифицировать новую Prisma migration на изолированной БД, включая fresh deploy, upgrade, повторный deploy, parity и сохранение extra grants;
4. добавить Stage A E2E-покрытие реальных HTTP endpoint’ов;
5. выполнить полный backend/frontend regression и обновить implementation report честными воспроизводимыми доказательствами.

Stage A может получить `VERDICT A` только после закрытия всех требований этого промпта.

---

## 2. Сначала repository-first проверка

До изменений выполни и зафиксируй:

```bash
git remote -v
git branch --show-current
git rev-parse HEAD
git fetch origin
git rev-parse origin/master
git status --short
git log --oneline -10
git show --stat --oneline 8ca7cecb500a624f898461504bdea3462e0f95b5
```

Обязательные условия:

- repository URL соответствует указанному выше;
- branch = `master`;
- `HEAD == origin/master == 8ca7cecb500a624f898461504bdea3462e0f95b5` до начала работы;
- любые предсуществующие untracked/modified файлы перечислены и не удаляются;
- не использовать destructive commands;
- не смешивать в commit изменения, не относящиеся к этой remediation-итерации.

Если base SHA или upstream отличаются — остановись и сообщи расхождение, не продолжая реализацию на неизвестной базе.

---

## 3. Доказанный дефект, который надо исправить

В commit `8ca7cec` page gate реализован неполно:

- `PUT /api/v1/workspaces/command-center` проверяет `analytics.read` + `dashboard.customize`;
- `DELETE /api/v1/workspaces/command-center` проверяет `analytics.read` + `dashboard.customize`;
- `GET /api/v1/workspaces/command-center` не проверяет `analytics.read`;
- `GET /api/v1/workspaces/command-center/widgets` не проверяет `analytics.read`.

Фильтрация widgets в service не заменяет HTTP authorization. Пользователь без page permission не должен получать `200` с пустым payload: для Command Center требуется server-side `403`.

### Целевой контракт endpoint’ов

| Endpoint | Обязательные permissions | Без permission |
| --- | --- | --- |
| `GET /api/v1/workspaces/command-center` | `analytics.read` | `403` |
| `GET /api/v1/workspaces/command-center/widgets` | `analytics.read` | `403` |
| `PUT /api/v1/workspaces/command-center` | `analytics.read` + `dashboard.customize` | `403` |
| `DELETE /api/v1/workspaces/command-center` | `analytics.read` + `dashboard.customize` | `403` |

Требования:

- authorization выполняется до чтения/изменения workspace state;
- `401` сохраняется для запроса без аутентификации;
- не добавлять dashboard permissions к другим `pageId`, если их контракт этого не требует;
- не полагаться на frontend hiding;
- не возвращать `200` с пустым layout вместо `403` для пользователя без `analytics.read`;
- не ослаблять уже действующие проверки PUT/DELETE;
- использовать единый, переиспользуемый page-authorization механизм или небольшой private helper, а не четыре расходящиеся копии логики;
- если в репозитории уже есть канонический permission guard/decorator/resolver, предпочесть его.

### Ролевая проверка

Для текущих safe defaults:

- `ADMIN`, `DIRECTOR`, `ANALYST`, `MARKETER` имеют Command Center page access;
- `FINANCE`, `MODERATOR`, `SALES_MANAGER`, `OPERATOR`, `PARTNER`, `BUYER` не получают page access без persisted grant `analytics.read`;
- persisted grant должен менять effective access без изменения constants и без restart reset.

---

## 4. Restart persistence: обязательные security-тесты

В Stage A изменён контракт startup seed: `RolePermission` теперь persisted effective state, а `ROLE_PERMISSIONS` — defaults/reference, но не continuously enforced runtime synchronization.

Добавь repository-consistent unit/integration tests для `SecurityService.onModuleInit()` / seed lifecycle. Если отдельного `security.service.spec.ts` нет, создай его в принятом репозиторием месте.

Минимальный обязательный набор:

1. startup создаёт/дополняет Role catalog;
2. startup создаёт missing Permission catalog entries;
3. startup **не вызывает** `rolePermission.create`, `createMany`, `upsert`, `update`, `delete` или `deleteMany` для синхронизации role defaults;
4. отозвать реальный default link `MARKETER → dashboard.marketplace.read`, вызвать `onModuleInit()`, доказать, что link не восстановлен;
5. добавить non-default link `FINANCE → analytics.read`, вызвать `onModuleInit()`, доказать, что link не удалён;
6. повторный `onModuleInit()` остаётся идемпотентным для catalog и не меняет effective `RolePermission` state;
7. тесты не зависят от порядка выполнения и восстанавливают внесённые fixture-изменения через `try/finally` либо используют изолированную БД/transaction rollback.

Нельзя подменять эти тесты только статическим поиском отсутствия `toAdd/toRevoke`.

---

## 5. Migration qualification

Новая migration:

`backend/prisma/migrations/20260819235237_add_dashboard_section_authority/migration.sql`

должна быть проверена выполнением, а не только чтением SQL.

### 5.1 Fresh database

На новой изолированной task-specific PostgreSQL database:

1. выполнить полный `prisma migrate deploy` от migration №1 до №60;
2. доказать, что все migrations применились успешно;
3. запустить приложение/seed lifecycle, если это является частью нормального deployment contract;
4. проверить, что Permission catalog полностью соответствует `PERMISSIONS`;
5. проверить, что default `RolePermission` matrix полностью соответствует `ROLE_PERMISSIONS` для fresh deploy;
6. отдельно проверить пять новых permission codes:
   - `dashboard.executive.read`;
   - `dashboard.operational.read`;
   - `dashboard.financial.read`;
   - `dashboard.marketplace.read`;
   - `dashboard.customize`;
7. проверить safe role defaults для `ADMIN`, `DIRECTOR`, `ANALYST`, `MARKETER` и отсутствие dashboard defaults у остальных ролей.

Parity должна вычисляться скриптом/тестом в обе стороны:

- constants missing in DB = 0;
- unexpected catalog entries относительно ожидаемого snapshot = 0, если это соответствует repository contract;
- missing default links = 0;
- unexpected default links на fresh deploy = 0.

Не ограничиваться ручным подсчётом строк SQL.

### 5.2 Upgrade database and preservation of mutable state

На отдельной изолированной upgrade database:

1. применить migrations только до состояния непосредственно перед новой Stage A migration;
2. создать репрезентативный existing non-default grant, который не входит в `ROLE_PERMISSIONS`;
3. при необходимости создать репрезентативный revoked default state;
4. применить Stage A migration;
5. доказать, что existing non-default grant не удалён;
6. честно зафиксировать ожидаемую семантику snapshot migration для revoked default state; не заявлять, что migration автоматически отличает Admin intent без persisted provenance/override metadata;
7. выполнить normal restart и доказать, что runtime seed не удаляет extra grant и не восстанавливает revoke.

### 5.3 SQL runtime compatibility

Проверить реальным deploy, принимает ли PostgreSQL выражение `gen_random_uuid()` для фактического типа колонок ID в текущей schema.

- Если deploy проходит — изменений ради стиля не делать.
- Если возникает type mismatch — исправить SQL минимально и единообразно, например явным cast, соответствующим реальному типу колонок.
- Не утверждать совместимость без выполненного deploy.

### 5.4 Idempotency and status

После успешного deploy:

- повторно выполнить `prisma migrate deploy` и получить отсутствие pending migrations;
- выполнить `prisma migrate status`;
- подтвердить migration count = `60`;
- подтвердить drift = `0` используемым в репозитории способом;
- удалить только созданные этой задачей временные БД/контейнеры после завершения проверок.

Не использовать существующую production/staging database для destructive test setup.

---

## 6. Обязательное HTTP E2E-покрытие Stage A

Unit tests service-слоя недостаточны. Расширь существующие E2E suites, сохраняя старые тесты.

Минимальные сценарии:

### Command Center summary/trends

1. `ADMIN` получает четыре authorized sections в каноническом порядке;
2. `MARKETER` получает только `executive` и `marketplace`;
3. `availableSections` точно соответствует реально возвращённым sections;
4. `availableMetrics` содержит только supported + authorized metrics;
5. unauthorized sections отсутствуют в JSON целиком, а не mask/null;
6. optional data source для unauthorized section не вызывается — доказать подходящим integration spy или эквивалентным тестом;
7. неизвестная trend metric возвращает `404`;
8. известная, но неразрешённая metric возвращает `403` и analytics provider не вызывается;
9. reconciliation появляется только при `dashboard.financial.read`.

### Workspace routes

10. без token каждый из релевантных routes возвращает `401`;
11. роль с `analytics.read` получает `200` на оба GET;
12. `FINANCE`, `PARTNER` и `BUYER` без persisted grant получают `403` на оба GET;
13. пользователь с `analytics.read`, но без `dashboard.customize`, получает `403` на PUT/DELETE;
14. пользователь с обеими permissions проходит PUT/DELETE contract;
15. persisted runtime grant `FINANCE → analytics.read` разрешает GET без изменения constants;
16. после удаления этого grant GET снова возвращает `403`;
17. fixtures/grants обязательно очищаются в `finally`.

Проверяй фактические HTTP status и payload. Не мокай controller так, чтобы guard/permission resolver не участвовал в запросе.

---

## 7. Полный regression gate

После реализации выполни команды, реально соответствующие package scripts репозитория. Сначала прочитай root/backend/frontend `package.json`; не выдумывай script names.

Обязательные категории доказательств:

### Backend

- typecheck;
- production build;
- все unit tests, не только два изменённых spec-файла;
- все E2E/integration tests;
- отдельно показать количество test suites/tests и результат новых security/workspace/dashboard сценариев.

### Frontend

Даже если production frontend code не менялся:

- TypeScript/typecheck;
- полный Vitest suite;
- production build.

Это regression gate перед началом визуального Stage B.

### Repository and database

- `git diff --check`;
- `git status --short` до и после commit;
- Prisma migration deploy на fresh DB;
- Prisma migration deploy на upgrade DB;
- повторный deploy;
- migration status;
- parity checks;
- drift = 0;
- tracked scope не содержит посторонних изменений.

Не сообщать `PASS`, если команда не запускалась. При environment blocker привести точную команду, полный существенный текст ошибки и отделить `BLOCKED` от `PASS`.

---

## 8. Implementation report

Обнови существующий Stage A implementation report либо создай remediation addendum рядом с ним. Отчёт должен содержать:

- repository URL;
- branch;
- base SHA `8ca7cecb500a624f898461504bdea3462e0f95b5`;
- implementation commit SHA;
- final remote SHA, если report публикуется отдельным последующим docs commit;
- точный перечень изменённых файлов;
- описание исправленного GET page gate;
- таблицу всех четырёх workspace endpoint’ов и permission requirements;
- restart-persistence test evidence;
- fresh/upgrade/redeploy migration evidence;
- catalog/default matrix parity evidence;
- extra grant preservation evidence;
- migration count и drift;
- backend unit/E2E/typecheck/build evidence;
- frontend typecheck/tests/build evidence;
- все blockers/deviations без сокрытия;
- `HEAD == origin/master` после push;
- точное состояние tracked и untracked worktree.

Не оставлять в опубликованном отчёте ложные `pending`-значения. Если точный SHA commit, содержащего сам отчёт, невозможно записать внутрь того же commit без self-reference, используй честную двухкоммитную схему:

1. implementation/tests commit;
2. report commit, ссылающийся на SHA первого commit;

а final remote SHA укажи в итоговом ответе и проверь через fetch/ls-remote.

---

## 9. Ограничения scope

Не выполнять в этой итерации:

- Stage B Platform Command Center UI;
- установку `recharts` или `@dnd-kit/core`;
- Partner Command Center;
- Organization Switcher;
- Stage C Admin Permission Management UI;
- новый override/provenance model без отдельного architecture approval;
- переработку уже принятой Platform/Partner isolation;
- широкие unrelated refactors;
- удаление предсуществующих untracked файлов.

Сохраняются принятые решения:

- `RolePermission` = persisted effective state;
- startup seed создаёт catalog, но не синхронизирует role assignments;
- safe defaults задаются migration history;
- frontend visibility не является security boundary;
- unauthorized dashboard sections omitted server-side;
- unknown metric = `404`, unauthorized known metric = `403`;
- Stage B блокируется до полного закрытия Stage A.

---

## 10. Commit and push

После всех успешных проверок:

1. проверить diff по каждому файлу;
2. убедиться, что в staging нет unrelated/user files;
3. создать осмысленный commit или честную двухкоммитную последовательность implementation + report;
4. выполнить fast-forward push в `origin/master`;
5. выполнить `git fetch origin`;
6. подтвердить:
   - `HEAD == origin/master`;
   - `git ls-remote origin refs/heads/master` показывает тот же SHA;
   - tracked scope clean;
   - untracked files перечислены отдельно и не названы clean worktree.

Не использовать force push.

---

## 11. Acceptance criteria

`VERDICT A — STAGE A REMEDIATION COMPLETED` разрешён только если одновременно выполнено всё:

- оба workspace GET endpoint’а требуют `analytics.read` и возвращают `403` без него;
- PUT/DELETE требуют `analytics.read` + `dashboard.customize`;
- все четыре endpoint contract подтверждены HTTP E2E;
- restart-persistence tests доказывают сохранение revoke и extra grant;
- runtime seed не мутирует `RolePermission`;
- fresh database применяет все 60 migrations;
- upgrade database сохраняет existing non-default grant;
- повторный deploy идемпотентен;
- catalog/default matrix parity подтверждена автоматически;
- drift = 0;
- backend full unit + E2E + typecheck + build проходят;
- frontend typecheck + Vitest + production build проходят;
- implementation report обновлён честными доказательствами;
- commit(s) pushed;
- `HEAD == origin/master == ls-remote master`;
- unrelated files не изменены.

Если хотя бы один обязательный пункт не выполнен:

```text
VERDICT B — STAGE A REMEDIATION NOT COMPLETED
```

и Stage B не начинать.

---

## 12. Формат итогового ответа

Ответ предоставить на русском языке в следующей структуре:

```text
PHASE 3 — STEP 3.2 — STAGE A REMEDIATION — VERDICT A/B

Repository State
- Repository
- Branch
- Base SHA
- Implementation SHA
- Final SHA
- HEAD / origin/master / ls-remote
- Tracked and untracked worktree state

Security Fix
- GET layout gate
- GET widgets gate
- PUT/DELETE gates
- effective role behavior

Restart Persistence
- revoked default test
- extra grant test
- repeated startup test

Migration Qualification
- fresh deploy
- upgrade deploy
- extra grant preservation
- second deploy
- parity
- migration count
- drift

HTTP E2E Evidence
- summary/trends cases
- workspace GET cases
- customize cases

Regression Evidence
- backend typecheck/build/unit/E2E
- frontend typecheck/Vitest/build
- git diff --check

Files Changed
- production
- tests
- migration, only if runtime correction was required
- documentation

Deferred / Unchanged Scope

Commit(s)
```

### NEXT

Только после подтверждённого `VERDICT A`:

```text
NEXT: PHASE 3 — STEP 3.2 — STAGE B — PLATFORM COMMAND CENTER UI — IMPLEMENTATION
```

