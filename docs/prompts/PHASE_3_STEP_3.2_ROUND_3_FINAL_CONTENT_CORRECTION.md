# PHASE 3 — STEP 3.2 — ROUND 3 FINAL CONTENT CORRECTION

## TEST VALIDITY, DEFAULT-MIGRATION SEMANTICS AND REPOSITORY EVIDENCE

> **ЯЗЫК:** все пояснения, отчёты и финальный ответ должны быть на русском языке. Английский допускается только для кода, команд, путей, SHA, permission codes и стандартных технических статусов.

---

## 1. ЦЕЛЬ

Выполнить минимальную docs-only коррекцию двух уже опубликованных Round 3 документов. Не создавать новый архитектурный раунд и не начинать Stage A, пока перечисленные ниже смысловые дефекты не закрыты.

Repository:

```text
https://github.com/seldom733-hash/travelhub1
```

Branch:

```text
master
```

Expected base SHA:

```text
b6e050ea17b120c26f1cd45d506119d00e1c1ad1
```

Base commit независимо подтверждён в GitHub и содержит ровно два Round 3 docs-файла.

---

## 2. SCOPE

Изменить только существующие файлы:

```text
docs/architecture/platform-command-center-rbac-seed-admin-override-persistence-contract-step-3.2.md
docs/prompts/PHASE_3_STEP_3.2_DESIGN_REMEDIATION_ROUND_3_RBAC_SEED_ADMIN_OVERRIDE_PERSISTENCE_REPORT.md
```

Не изменять:

- production code;
- tests;
- Prisma schema;
- migrations;
- остальные документы;
- untracked files, не относящиеся к этому заданию.

---

## 3. DEFECT 1 — INVALID REVOKE TEST

В architecture document тесты №3 и №13 используют:

```text
MARKETER → dashboard.financial.read
```

Но согласованная safe default matrix прямо определяет, что MARKETER **не имеет** `dashboard.financial.read`.

Удаление отсутствующего default link не доказывает, что startup seed сохраняет Admin revoke. Такой тест может пройти даже при неверной реализации.

### Обязательное исправление

В тестах №3 и №13 использовать реально существующее default assignment, например:

```text
MARKETER → dashboard.marketplace.read
```

или другой assignment, который одновременно:

- присутствует в согласованной safe default matrix;
- будет создан one-time migration;
- удаляется тестом перед restart simulation;
- не должен появиться снова после `onModuleInit()`.

Предпочтительный вариант для единообразия:

```text
MARKETER → dashboard.marketplace.read
```

Ожидаемый тест:

```text
Given default RolePermission MARKETER → dashboard.marketplace.read exists
When the link is explicitly deleted
And SecurityService.onModuleInit() runs again
Then the link remains absent
```

Обновить также summary/report, если там повторяется неверный пример.

---

## 4. DEFECT 2 — NON-EXISTENT `adminDidNotModify` AUTHORITY

Architecture document предлагает:

```text
IF permission NOT IN currentRolePermissions
AND adminDidNotModify(role, permission)
THEN grant
```

Однако в Current State и Stage A contract не существует persisted provenance/override marker, позволяющего отличить:

- permission отсутствует, потому что Admin его отозвал;
- permission отсутствует, потому что default раньше не существовал;
- permission отсутствует из-за legacy/data issue.

Следовательно, `adminDidNotModify(...)` нельзя использовать как доступный факт. Это недоказанная и нереализуемая функция.

### Обязательное исправление

Зафиксировать честный контракт:

1. **Новый permission code:** one-time migration может создать новый Permission и назначить его согласованным default roles, потому что до появления code Admin не мог создать override для этого permission.
2. **Изменение default для уже существующего permission:** отсутствие или наличие `RolePermission` само по себе не раскрывает Admin intent.
3. Без persisted override/provenance metadata автоматическое определение `adminDidNotModify` запрещено.
4. Обычное изменение default для existing installations:
   - не должно автоматически изменять effective state;
   - применяется администратором явно в Stage C;
   - либо реализуется отдельным специально утверждённым migration с ясно задокументированным воздействием.
5. Emergency/security revocation может выполняться targeted data migration только с отдельным security approval; такой migration сознательно меняет effective state и не должен маскироваться под «preserve Admin intent».
6. Если в будущем потребуется автоматический three-way merge defaults и overrides, Stage C должен добавить persisted provenance/override model. Нельзя придумывать его наличие сейчас.

Удалить либо заменить все ссылки на доступный `adminDidNotModify` algorithm.

---

## 5. DEFECT 3 — FRESH DATABASE AUTHORITY

Документ одновременно заявляет:

```text
default RolePermission assignments → one-time Prisma migrations
```

и:

```text
new installations → current ROLE_PERMISSIONS in code
```

При выбранной migration-only модели это разные механизмы.

### Обязательное исправление

Зафиксировать:

- fresh database получает defaults через последовательное применение всей migration history;
- `ROLE_PERMISSIONS` является reference/default definition для tests и будущего explicit reset;
- обычный startup не переносит текущее содержимое `ROLE_PERMISSIONS` в `RolePermission`;
- каждое изменение defaults, которое должно попасть в fresh installations, требует соответствующей versioned migration;
- consistency test обязан проверять, что результат применения migrations совпадает с ожидаемой `ROLE_PERMISSIONS` matrix для fresh database;
- изменение только `ROLE_PERMISSIONS` без migration не считается завершённым изменением defaults.

Не оставлять формулировок, из которых следует автоматическая runtime materialization `ROLE_PERMISSIONS` на fresh startup.

---

## 6. DEFECT 4 — WORKTREE EVIDENCE

Round 3 report содержит:

```text
Worktree clean (only untracked docs)
```

и checked acceptance criterion:

```text
Worktree clean
```

Это фактически неверно: непустой `git status --porcelain` означает dirty worktree.

### Обязательное исправление

Использовать точную терминологию:

```text
Tracked Round 3 scope: clean
Repository worktree: not clean — pre-existing untracked files present
```

В acceptance/evidence:

- не отмечать repository worktree как clean;
- отдельно подтвердить `0 modified tracked`, `0 staged`;
- указать, что untracked files не вошли в commit и не были изменены/удалены;
- не публиковать чувствительное содержимое файлов;
- не удалять и не перемещать их.

Для Stage A рекомендовать clean isolated checkout/worktree, созданный от актуального `origin/master`, чтобы pre-existing untracked files не смешивались с implementation scope.

Наличие pre-existing untracked files не отменяет integrity уже опубликованного docs-only commit, но запрещает формулировку «repository worktree clean».

---

## 7. EDITORIAL CORRECTIONS

Исправить обнаруженные артефакты языка и форматирования без изменения архитектурного смысла:

```text
Auto-assigned для矩阵内の permissions
nueva tabla
-.persistence foundation
```

Требуемые замены:

- полностью русский или согласованный English technical terminology;
- корректный Markdown list marker;
- отсутствие случайных китайских/японских/испанских фрагментов.

Проверить оба документа на аналогичные артефакты.

---

## 8. НЕИЗМЕННЫЕ РЕШЕНИЯ

Не менять:

- `RolePermission` после Stage A = persisted effective state;
- startup seed после Stage A не выполняет `toAdd`/`toRevoke` для RolePermission;
- пять `dashboard.*` permission codes;
- safe default role matrix;
- server-side section filtering;
- `availableSections` contract;
- trends metric authorization;
- conditional reconciliation rule;
- Platform/Partner workspace isolation;
- Stage A → Stage B → Stage C order;
- Admin Permission Management UI остаётся Stage C;
- ответы разработчика на русском языке.

---

## 9. REQUIRED VALIDATION

Перед commit выполнить:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/master
git status --short
git diff --check
git diff --name-only
```

До начала изменений ожидается:

```text
HEAD == origin/master == b6e050ea17b120c26f1cd45d506119d00e1c1ad1
```

После изменений проверить через `rg`, что:

1. неверный пример `MARKETER → dashboard.financial.read` отсутствует в revoke tests;
2. revoke tests используют реально default assignment;
3. `adminDidNotModify` не представлен как существующий доступный механизм;
4. migration history названа authority для materialized fresh defaults;
5. report не заявляет repository worktree clean при наличии untracked files;
6. отсутствуют `矩阵`, `nueva tabla`, `-.persistence`;
7. изменены только два существующих Round 3 docs-файла.

Production tests/build можно не запускать, поскольку изменение docs-only. Обязательно выполнить `git diff --check`.

---

## 10. GIT CONTRACT

1. Не удалять unrelated/untracked files.
2. Закоммитить только два изменённых документа.
3. Не использовать force push.
4. Перед push убедиться, что remote не advanced.
5. Push в `origin/master` допустим только как fast-forward.
6. После push подтвердить remote commit через GitHub или `git ls-remote`.
7. Не заявлять полный clean worktree, если untracked files сохранились.

Рекомендуемый commit message:

```text
docs(step-3.2): correct Round 3 persistence edge cases
```

---

## 11. ACCEPTANCE CRITERIA

- [ ] base SHA подтверждён;
- [ ] изменены только два существующих Round 3 docs-файла;
- [ ] revoke persistence test использует фактический default link;
- [ ] `adminDidNotModify` assumption удалён;
- [ ] changed-existing-default policy не обещает невозможное сохранение Admin intent;
- [ ] fresh database defaults определены migration history;
- [ ] `ROLE_PERMISSIONS` не materialized startup seed'ом;
- [ ] worktree evidence сформулирована фактически точно;
- [ ] editorial artifacts исправлены;
- [ ] неизменные security/role/workspace решения сохранены;
- [ ] production code changes = 0;
- [ ] test changes = 0;
- [ ] schema/migration changes = 0;
- [ ] `git diff --check` проходит;
- [ ] commit pushed fast-forward;
- [ ] remote SHA подтверждён.

Только после выполнения всех критериев допустим:

```text
VERDICT A — READY FOR SECURITY PREREQUISITE IMPLEMENTATION — STAGE A
```

---

## 12. ФОРМАТ ФИНАЛЬНОГО ОТВЕТА

```markdown
## PHASE 3 — STEP 3.2 — ROUND 3 FINAL CONTENT CORRECTION — <VERDICT>

### Repository State
- Repository:
- Branch:
- Base SHA:
- Final SHA:
- HEAD:
- origin/master:
- Tracked scope:
- Repository worktree:

### Corrections
- Revoke test:
- Existing-default migration policy:
- Fresh database authority:
- Worktree evidence:
- Editorial fixes:

### Preserved Decisions
- ...

### Evidence
- Files changed:
- Production code changes:
- Test changes:
- Schema/migration changes:
- git diff --check:
- Push:
- Remote verification:

### Commit
`<sha>` — pushed to `origin/master`

### NEXT
`PHASE 3 — STEP 3.2 — SERVER-SIDE SECTION AUTHORITY — SECURITY PREREQUISITE IMPLEMENTATION — STAGE A`
```

Финальный ответ — только на русском языке.

