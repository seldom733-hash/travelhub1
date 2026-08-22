# PHASE 3 — STEP 3.2 — STAGE A REGRESSION AND CI CLOSURE — ROUND 4

## Five failing E2E suites, baseline attribution, green full regression, final CI and report correction

Работай в репозитории:

- Repository: `https://github.com/seldom733-hash/travelhub1`
- Branch: `master`
- Expected Round 4 base SHA: `53de73a5bd6253d08af42df7d6f0b2555d2b919f`
- Upstream: `origin/master`

Все пояснения, отчёты, выводы команд и итоговый ответ предоставляй **на русском языке**. Технические имена, команды, API и test identifiers можно оставлять на английском.

---

## 1. Текущий verdict

```text
VERDICT B — STAGE A REGRESSION/CI GATES NOT CLOSED
```

Round 3 implementation принят по своему непосредственному scope:

- persistence tests используют `try/finally`;
- misleading unit tests удалены/переименованы;
- workspace 8×2 GET matrix закрыта;
- RBAC parity проверяет exact sets всех 10 ролей;
- `migrate diff` выполнен;
- targeted Stage A suites проходят.

Но `VERDICT A` недопустим, потому что:

1. полный `npm run test:e2e` завершился с 5 failed suites / 65 failed tests;
2. «pre-existing Phase 2» заявлено без baseline comparison и без waiver;
3. GitHub Actions conclusion для final SHA не проверен;
4. опубликованный report снова содержит `pending` и pre-commit SHA.

Stage B не начинать.

---

## 2. Repository-first preflight

```bash
git remote -v
git branch --show-current
git fetch origin
git rev-parse HEAD
git rev-parse origin/master
git status --short
git log --oneline -10
git show --stat --oneline a7027271f8216195c41795892386b2720fe9e502
git show --stat --oneline 53de73a5bd6253d08af42df7d6f0b2555d2b919f
```

Продолжать только если:

- `HEAD == origin/master == 53de73a5bd6253d08af42df7d6f0b2555d2b919f`;
- branch = `master`;
- remote соответствует `seldom733-hash/travelhub1`;
- unrelated tracked/untracked files перечислены и исключены из scope.

Не использовать force push и destructive commands.

---

## 3. Пять failing suites

Полный E2E run сообщил failures:

1. `backend/test/sale-completion-order-requested.e2e-spec.ts`;
2. `backend/test/partner-collect-commission-accrual.e2e-spec.ts`;
3. `backend/test/change-proposal.e2e-spec.ts`;
4. `backend/test/storefront.e2e-spec.ts`;
5. `backend/test/partner-cabinet-list.e2e-spec.ts`.

Нельзя классифицировать их как unrelated только по названию файла.

Stage A изменил security startup semantics и permission state, поэтому необходимо исключить косвенное влияние:

- отсутствующие permissions;
- test fixture drift;
- role assignment assumptions;
- changed startup seed behavior;
- controller/global prefix behavior;
- shared DB state leakage;
- test order dependency;
- DTO/validation changes;
- stale expectations Phase 2.

---

## 4. Сначала точная диагностика

На current SHA и fresh isolated test DB выполнить каждый failing suite отдельно.

Использовать фактический Jest syntax установленной версии, например через `--runTestsByPath`, не полагаться на deprecated/неподдерживаемые flags.

Для каждого suite зафиксировать:

- exact command;
- suite/test name;
- expected vs actual;
- HTTP status/payload либо DB assertion;
- stack trace до первой repository frame;
- повторяемость минимум в двух clean-DB runs;
- состояние test DB до/после;
- root cause category.

Составить таблицу:

| Suite | Failed tests | First failure | Root cause | Stage A relation | Proposed fix |
| --- | ---: | --- | --- | --- | --- |

Не исправлять assertions только ради зелёного результата до понимания бизнес-контракта.

---

## 5. Baseline attribution

Фраза `pre-existing` должна быть доказана.

Используй отдельный task-created git worktree/checkpoint и отдельную isolated DB. Проверить те же пять suites как минимум на:

- current Round 4 base: `53de73a...`;
- pre-Stage-A implementation SHA: `afaf2e066dd7d3501225f85ed3c8360c38f7441a`.

Условия сравнения:

- одинаковая Node/PostgreSQL environment;
- одинаковый test command;
- отдельная fresh test DB для каждого run;
- migrations соответствуют проверяемому checkout;
- не переиспользовать DB между SHA;
- временный worktree/DB удалить после проверки.

Классификация:

### Если suite проходит на `afaf2e0`, но падает на current

Это Stage A/последующий regression. Найти introducing commit через минимальный `git bisect` или последовательную проверку checkpoint SHA и исправить.

### Если suite падает одинаково на `afaf2e0` и current

Это доказанный pre-existing failure. Но он всё равно не превращается автоматически в PASS.

Далее:

- если исправление ограничено test fixture, stale expectation или очевидным контрактным дефектом — исправить в Round 4;
- если требуется существенное изменение Phase 2 architecture/business logic — остановиться с `VERDICT B — EXPLICIT WAIVER/SEPARATE REMEDIATION REQUIRED`, представить root-cause evidence и не начинать Stage B;
- waiver может дать только пользователь/architecture decision, разработчик не выдаёт его себе самостоятельно.

---

## 6. Исправление failures

Предпочтительный результат Round 4: все пять suites исправлены минимальными repository-consistent изменениями.

Правила:

- production code менять только если тест доказывает реальный дефект;
- если проблема в fixture — исправить fixture, сохранив production contract;
- если expectation устарел — сначала подтвердить authority в architecture docs/current domain contract;
- не удалять tests;
- не применять `.skip`, `.only`, `testPathIgnorePatterns` или ослабление assertions;
- не увеличивать timeout вместо устранения deterministic root cause;
- не маскировать `403/404/500` как допустимые статусы;
- не изменять safe RBAC defaults без отдельного architecture approval;
- сохранять Platform/Partner isolation.

Для каждого исправления добавить/сохранить regression assertion, который падал до fix и проходит после.

---

## 7. Обязательный полный E2E gate

После targeted fixes выполнить:

```bash
cd backend
npm run test:e2e
```

Acceptance:

- все обнаруженные E2E suites проходят;
- failed suites = 0;
- failed tests = 0;
- no unexpected skipped tests;
- no unhandled rejections/open handles/cleanup errors;
- test DB создаётся и используется через repository global setup;
- вывод содержит actual suite/test counts и duration.

Ожидается около 74 suites, но использовать фактически обнаруженное число после изменений.

Targeted 71 Stage A tests не заменяют этот gate.

Если хотя бы один suite падает — `VERDICT A` запрещён без заранее одобренного explicit waiver.

---

## 8. Повторная проверка Stage A после fixes

Обязательно повторно выполнить targeted suites:

- `restart-persistence.e2e-spec.ts`;
- `rbac-parity.e2e-spec.ts`;
- `dashboard-command-center.e2e-spec.ts`;
- `workspace-constructor.e2e-spec.ts`.

Проверить, что сохранены:

- revoke/grant restart persistence;
- exact RBAC parity всех 10 ролей;
- 8×2 HTTP matrix;
- dashboard source-call suppression;
- customize authority.

Если production/security/schema code не менялся, повторный 59→60 upgrade experiment можно не выполнять; сослаться на Round 3 evidence. Если менялись migrations, Prisma schema, seed или security service — выполнить migration qualification полностью заново.

---

## 9. Полный regression

### Backend

- `npm run typecheck`;
- `npm run build`;
- `npm test`;
- targeted Stage A E2E;
- полный `npm run test:e2e`;
- `git diff --check`.

### Frontend

- `npx tsc --noEmit`;
- `npm test`;
- `npm run build`.

Frontend повторяется как final release gate перед Stage B.

Не сообщать PASS для невыполненных команд.

---

## 10. GitHub Actions — дождаться conclusion

В репозитории уже существует `.github/workflows/ci.yml`; он запускается на push в `master`.

После implementation push и после final report push:

1. найти CI run, чей `headSha` равен final remote SHA;
2. дождаться terminal status;
3. проверить backend job;
4. проверить frontend job;
5. сохранить:
   - workflow name;
   - run ID;
   - run URL;
   - event;
   - head SHA;
   - status/conclusion;
   - backend conclusion;
   - frontend conclusion.

Допустимые способы:

- `gh run list` / `gh run view` / `gh run watch`, если GitHub CLI доступен;
- GitHub Actions UI/API;
- repository-supported equivalent.

Если CI не появился:

- проверить Actions settings, trigger, permissions, quota/billing;
- привести точную причину;
- не писать `VERDICT A`, пока обязательный CI gate не закрыт либо пользователь явно не одобрил waiver.

Если CI failed — получить logs и исправить failure. Локальный PASS не заменяет failed CI.

---

## 11. Исправить evidence report

Обновить:

`docs/prompts/PHASE_3_STEP_3.2_STAGE_A_REMEDIATION_EVIDENCE_CLOSURE_REPORT.md`

### SHA chronology

Не использовать одно неоднозначное поле `Base SHA`. Указать отдельно:

| Stage | Base/implementation/report |
| --- | --- |
| Stage A original base | `afaf2e066dd7d3501225f85ed3c8360c38f7441a` |
| Stage A implementation | `8ca7cecb500a624f898461504bdea3462e0f95b5` |
| Round 1 implementation | `2798dc7baaa5d556f6d84f5fdf9a7d59aa91f87a` |
| Round 1 report | `a1cad6f41204bff303078643042e54e7705f1d24` |
| Round 2 implementation | `719d7e03c2bc408db779afb31072dfc4eed00c5d` |
| Round 2 report | `c25f128c70c3b6707f0113d8a5ed5e4e9640d800` |
| Round 3 implementation | `a7027271f8216195c41795892386b2720fe9e502` |
| Round 3 report | `53de73a5bd6253d08af42df7d6f0b2555d2b919f` |
| Round 4 base | `53de73a5bd6253d08af42df7d6f0b2555d2b919f` |
| Round 4 implementation | actual implementation SHA |

Final report commit SHA указывать в итоговом ответе, а не оставлять `pending` внутри файла.

### Report content

Обязательно:

- удалить все `pending` rows;
- не показывать pre-commit HEAD как final state;
- заменить предыдущие 5 failures фактическим final result;
- для каждого прежнего failure описать root cause и fix;
- приложить baseline attribution results;
- указать full E2E exact counts;
- отделить targeted subtotal от full E2E;
- добавить final GitHub Actions run URL/conclusions;
- перечислить Round 4 files отдельно от cumulative files;
- указать, выдавался ли explicit waiver; по умолчанию `NO`;
- не объявлять `VERDICT A`, если full E2E или CI не зелёные.

---

## 12. Scope restrictions

Не выполнять:

- Stage B UI;
- Partner Command Center;
- Stage C Admin Permission Management;
- Organization Switcher;
- charts/DnD dependencies;
- изменение dashboard design contract;
- broad Phase 2 redesign без выявленной необходимости и approval;
- удаление pre-existing untracked files.

Round 4 — regression/CI closure, а не новая продуктовая фаза.

---

## 13. Commit and publish

Рекомендуемая схема:

1. regression fixes/tests commit;
2. evidence report commit.

Перед commit проверить каждый diff. Staging выполнять только явными paths.

После push:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/master
git ls-remote origin refs/heads/master
git status --short
```

Обязательно:

- fast-forward push;
- `HEAD == origin/master == ls-remote master`;
- tracked scope clean;
- untracked перечислены отдельно;
- CI terminal conclusion соответствует final SHA.

---

## 14. Acceptance criteria

`VERDICT A — STAGE A COMPLETED` разрешён только если:

- все пять ранее failing suites диагностированы;
- attribution `pre-existing` доказана либо удалена из отчёта;
- failures исправлены или получен явный user-approved waiver;
- полный `npm run test:e2e` имеет failed suites = 0 и failed tests = 0 без waiver;
- targeted Stage A suites проходят;
- backend typecheck/build/unit проходят;
- frontend typecheck/Vitest/next build проходят;
- migrations/RBAC/security contracts не регрессировали;
- GitHub Actions run для final SHA завершён успешно по backend и frontend;
- report не содержит `pending`, старых SHA и false PASS;
- commits pushed и remote SHA подтверждён;
- unrelated files не изменены.

Если full E2E или CI не зелёные и waiver не выдан:

```text
VERDICT B — STAGE A REGRESSION/CI GATES NOT CLOSED
```

Stage B не начинать.

---

## 15. Формат итогового ответа

```text
PHASE 3 — STEP 3.2 — STAGE A REGRESSION AND CI CLOSURE ROUND 4 — VERDICT A/B

Repository State
- repository / branch
- Round 4 base
- implementation SHA
- report/final SHA
- HEAD / origin/master / ls-remote
- tracked/untracked

Five-Suite Diagnosis
- suite
- root cause
- baseline current/pre-Stage-A result
- fix

Full E2E
- exact command
- suites passed/failed
- tests passed/failed/skipped
- duration

Stage A Requalification
- targeted four suites
- RBAC parity
- restart persistence
- HTTP matrix

Regression
- backend typecheck/build/unit/full E2E
- frontend typecheck/Vitest/build

GitHub Actions
- run URL/ID
- final head SHA
- backend conclusion
- frontend conclusion

Report Corrections

Files Changed

Commits

Waiver
- YES/NO
- authority and scope, only if YES
```

### NEXT

Только после independently verified `VERDICT A`:

```text
NEXT: PHASE 3 — STEP 3.2 — STAGE B — PLATFORM COMMAND CENTER UI — IMPLEMENTATION
```

