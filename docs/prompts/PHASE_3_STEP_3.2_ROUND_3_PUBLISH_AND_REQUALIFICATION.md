# PHASE 3 — STEP 3.2 — ROUND 3 PUBLISH AND RE-QUALIFICATION

## ЦЕЛЬ

Без повторной разработки и без изменения production code проверить локальный результат Design Remediation Round 3, безопасно опубликовать корректный commit в `origin/master` и доказать фактическое состояние репозитория.

> **ЯЗЫК:** все пояснения, отчёты и финальный ответ — только на русском языке. Английский допускается для команд, кода, путей, SHA и технических статусов.

---

## 1. REPOSITORY

```text
https://github.com/seldom733-hash/travelhub1
```

Expected branch:

```text
master
```

Remote state, независимо проверенный перед этим заданием:

```text
origin/master = ce77af3c90d65b042fa6834146636b92b66f7507
```

Заявленный локальный candidate commit:

```text
b6e050ea17b120c26f1cd45d506119d00e1c1ad1
```

На момент постановки задания candidate commit отсутствует в GitHub. Нельзя утверждать, что он pushed или что `HEAD == origin/master`, пока это не подтверждено после push.

---

## 2. ОБНАРУЖЕННЫЕ ПРОТИВОРЕЧИЯ

Предыдущий отчёт одновременно заявил:

```text
Commit b6e050e — local commit (not pushed)
HEAD == upstream: Yes
Worktree clean: Yes (only untracked docs)
```

Эти утверждения несовместимы:

- local unpushed commit означает, что `HEAD != origin/master`;
- наличие untracked files означает, что worktree не clean;
- `clean (only untracked docs)` не является допустимым Git status.

Задача этого prompt — получить доказанное, а не декларативное состояние.

---

## 3. SAFETY RULES

Запрещено:

- `git push --force` и `git push --force-with-lease`;
- удалять, перезаписывать или перемещать неизвестные untracked files;
- выполнять `git reset --hard`, `git clean`, `git checkout -- .` или аналогичные destructive commands;
- включать в commit unrelated files;
- создавать новый implementation commit;
- изменять production code, tests, Prisma schema или migrations;
- заявлять clean worktree при непустом `git status --porcelain`;
- заявлять pushed commit без remote verification.

Если обнаружены неизвестные или unrelated изменения — сохранить их нетронутыми и завершить с `VERDICT B`.

---

## 4. PRE-FLIGHT VERIFICATION

Сначала выполнить и сохранить результаты:

```bash
git remote -v
git branch --show-current
git status --short
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline --decorate
git cat-file -e b6e050ea17b120c26f1cd45d506119d00e1c1ad1^{commit}
```

Затем:

```bash
git show --format=fuller --stat b6e050ea17b120c26f1cd45d506119d00e1c1ad1
git show --format= --name-status b6e050ea17b120c26f1cd45d506119d00e1c1ad1
git rev-parse b6e050ea17b120c26f1cd45d506119d00e1c1ad1^
git diff --check ce77af3c90d65b042fa6834146636b92b66f7507..b6e050ea17b120c26f1cd45d506119d00e1c1ad1
```

Expected parent:

```text
ce77af3c90d65b042fa6834146636b92b66f7507
```

Если candidate commit не существует локально или его parent отличается — остановиться с `VERDICT B` и привести фактические SHA.

---

## 5. REQUIRED COMMIT SCOPE

Round 3 commit должен содержать только два файла:

```text
docs/architecture/platform-command-center-rbac-seed-admin-override-persistence-contract-step-3.2.md
docs/prompts/PHASE_3_STEP_3.2_DESIGN_REMEDIATION_ROUND_3_RBAC_SEED_ADMIN_OVERRIDE_PERSISTENCE_REPORT.md
```

Проверить:

```bash
git diff --name-status ce77af3c90d65b042fa6834146636b92b66f7507..b6e050ea17b120c26f1cd45d506119d00e1c1ad1
```

### Если candidate commit уже содержит ровно два требуемых файла

- не amend commit;
- не создавать дополнительный commit;
- перейти к remote re-check и push.

### Если требуемые файлы остались untracked и не вошли в candidate commit

1. Убедиться, что это именно два Round 3 deliverables.
2. Не добавлять никакие другие файлы.
3. Поскольку commit ещё не опубликован, допустимо добавить только эти два файла и выполнить:

```bash
git add -- <exact-required-path-1> <exact-required-path-2>
git commit --amend --no-edit
```

4. После amend зафиксировать новый Final SHA. Старый SHA больше не считать итоговым.

### Если untracked files не являются двумя требуемыми deliverables

- не удалять;
- не добавлять;
- не перемещать;
- перечислить точные пути;
- завершить с `VERDICT B — WORKTREE NOT CLEAN`.

---

## 6. CONTENT SANITY CHECK

Перед push подтвердить через поиск в двух документах:

1. Current State прямо признаёт `toAdd` + `toRevoke` как authoritative startup synchronization.
2. Target State определяет `RolePermission` как persisted effective state.
3. Normal restart не изменяет `RolePermission` assignments.
4. Fresh deploy и upgrade используют one-time Prisma migration или доказанный durable versioned bootstrap.
5. `ROLE_PERMISSIONS` не continuously enforced после Stage A.
6. Admin grant и revoke переживают restart.
7. Reset to defaults — explicit Stage C action.
8. Stage A включает исправление startup seed behavior и соответствующие тесты.
9. Production code/schema/migrations в самом Round 3 не изменены.
10. Финальные ответы разработчика обязаны быть на русском языке.

Если любое условие отсутствует или противоречит другому разделу — не push и завершить с `VERDICT B`, указав конкретные секции.

---

## 7. SAFE REMOTE RE-CHECK

Перед push выполнить:

```bash
git fetch origin
git rev-parse origin/master
git merge-base --is-ancestor origin/master HEAD
```

Push разрешён только если:

- `origin/master` всё ещё равен ожидаемому base SHA;
- итоговый local commit является его прямым docs-only продолжением;
- отсутствует необходимость force push;
- commit scope соответствует разделу 5.

Если remote advanced — не выполнять rebase, merge или force push автоматически. Завершить с `VERDICT B — REMOTE ADVANCED` и сообщить оба SHA.

---

## 8. PUSH

При выполнении всех условий:

```bash
git push origin HEAD:master
```

Если push завершился ошибкой — не скрывать ошибку, не объявлять успех и не переходить к Stage A.

---

## 9. POST-PUSH VERIFICATION

После успешного push обязательно выполнить:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/master
git ls-remote origin refs/heads/master
git status --porcelain
git log -3 --oneline --decorate
```

Verdict A допустим только если:

```text
HEAD == origin/master == ls-remote master SHA == Final SHA
git status --porcelain is empty
```

Также открыть опубликованный commit через GitHub/remote API либо `gh` и подтвердить, что он существует удалённо и содержит только два требуемых файла.

---

## 10. ACCEPTANCE CRITERIA

- [ ] remote URL соответствует `seldom733-hash/travelhub1`;
- [ ] branch = `master`;
- [ ] candidate/final commit существует локально;
- [ ] parent = `ce77af3c90d65b042fa6834146636b92b66f7507`;
- [ ] commit содержит только два Round 3 docs-файла;
- [ ] `git diff --check` проходит;
- [ ] content sanity check проходит;
- [ ] remote не advanced;
- [ ] push выполнен без force;
- [ ] commit доступен в GitHub;
- [ ] `HEAD == origin/master == remote master`;
- [ ] `git status --porcelain` пуст;
- [ ] production code changes = 0;
- [ ] schema/migration changes = 0.

Если любой пункт не выполнен:

```text
VERDICT B — PUBLISH/REPOSITORY STATE NOT CLOSED
```

---

## 11. ФОРМАТ ФИНАЛЬНОГО ОТВЕТА

```markdown
## PHASE 3 — STEP 3.2 — ROUND 3 PUBLISH AND RE-QUALIFICATION — <VERDICT>

### Repository State
- Repository:
- Branch:
- Base SHA:
- Candidate SHA:
- Final SHA:
- HEAD:
- origin/master:
- ls-remote master:
- Worktree:

### Commit Scope
- Parent:
- Files:
- Production code changes:
- Schema/migration changes:
- git diff --check:

### Content Sanity Check
- Current authoritative seed documented:
- Target effective state documented:
- Restart persistence documented:
- One-time bootstrap/migration documented:
- Explicit reset documented:
- Stage A test contract documented:

### Push Evidence
- Push result:
- Remote commit verified:
- HEAD == origin/master:
- Worktree clean:

### Commit
`<final-sha>` — pushed to `origin/master`

### NEXT
`PHASE 3 — STEP 3.2 — SERVER-SIDE SECTION AUTHORITY — SECURITY PREREQUISITE IMPLEMENTATION — STAGE A`
```

Финальный ответ — на русском языке. Не использовать формулировки наподобие «clean, кроме…» или «pushed локально».

