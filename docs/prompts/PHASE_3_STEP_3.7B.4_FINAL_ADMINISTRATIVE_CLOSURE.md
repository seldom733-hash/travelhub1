# PHASE 3 — STEP 3.7B.4 — FINAL ADMINISTRATIVE CLOSURE

## MODE

**ADMINISTRATIVE CLOSURE ONLY. NO PRODUCTION REMEDIATION.**

Техническая реализация и runtime/security evidence Step 3.7B уже приняты. Этот проход закрывает только:

```text
1. cleanup оставшихся synthetic revbuyer_* users
2. финализацию существующего 3.7B.4 evidence report
3. commit
4. push
5. реальные финальные SHA
```

Не создавать Step 3.7B.5. Не менять production/test code. Не выполнять Strict Review. Не начинать Step 3.7C.

---

## 1. Accepted state — не переоткрывать

Считать уже доказанными:

```text
P1 Marketplace BASIC contact disclosure     PASS
BASIC ORDER/BOOKING sanitization            PASS
business identifier precision               PASS
PRO/Platform original preservation          PASS
Buyer/Partner isolation                     PASS
unauthorized Platform staff → 403           PASS
participant spoof rejection                 PASS
forged participant persisted → NO           PASS
reverse chat normal → 201 + persisted       PASS
reverse chat email → 422 + not persisted    PASS
reverse chat phone → 422 + not persisted    PASS
reverse chat URL → 422 + not persisted      PASS
Communication tests 44/44                   PASS
Backend TSC                                 PASS
3.7B.4 production changes                   NONE
```

Не повторять техническую кампанию без обнаружения нового противоречия.

---

## 2. Production freeze

Запрещено:

```text
production code changes
test code changes
schema changes
migration
backfill
```

Разрешено только:

```text
fixture cleanup
evidence report finalization
Git commit/push
```

Если требуется изменение production/test code — STOP и VERDICT B.

---

## 3. Git preflight

Выполнить:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git log --oneline --decorate -10
```

Зафиксировать фактические:

```text
Starting HEAD:
origin/master:
working tree:
pre-existing unrelated changes:
```

Не stage/restore/delete unrelated pre-existing changes.

---

## 4. Cleanup synthetic buyers

Предыдущий отчёт содержит:

```text
Synthetic buyers (revbuyer_*): left in DB
```

Найти только synthetic users, созданных для Step 3.7B.4 reverse-chat evidence.

Перед удалением зафиксировать безопасные идентификаторы и доказать, что это именно fixtures данного evidence run.

Не удалять нормальных пользователей.

Удалить fixtures через штатный data-access/cleanup mechanism проекта.

Если существуют FK dependencies — сначала проверить их. Не cascade-delete legitimate runtime data.

После cleanup доказать:

```text
remaining Step 3.7B.4 revbuyer_* fixture users = 0
```

---

## 5. Synthetic Communication cleanup verification

Проверить отсутствие persisted evidence по использованным synthetic markers:

```text
contact-check@example.invalid
+994500000001
https://example.invalid/contact
```

Также проверить удаление harmless reverse-chat evidence message.

PASS:

```text
synthetic contact-bearing Communications remaining = 0
harmless evidence Communication remaining = 0
```

Это не общий PII audit базы.

---

## 6. Finalize existing report

Обновить существующий:

```text
docs/prompts/PHASE_3_STEP_3.7B.4_EVIDENCE_ONLY_FINAL_CLOSURE_REPORT.md
```

Не создавать новый implementation/remediation report.

Заменить:

```text
Synthetic buyers (revbuyer_*): left in DB
```

на фактический cleanup evidence.

В финальном Git section запрещены:

```text
(this commit, to be created)
(after commit)
(before push)
(after push)
pending
TBD
TODO
```

---

## 7. Commit discipline

Перед staging:

```bash
git status
git diff --stat
git diff
```

Stage только intended administrative report changes.

Expected:

```text
production diff: NONE
test diff: NONE
```

Не включать unrelated deleted/untracked/tmp files.

Создать реальный commit и получить его SHA.

Если основной 3.7B.4 evidence report уже был закоммичен, честно показать evidence SHA и отдельный administrative-finalization SHA. Не выдумывать отдельные SHAs.

---

## 8. Push + final Git proof

Выполнить:

```bash
git push
git rev-parse HEAD
git rev-parse origin/master
git status
git log --oneline --decorate -10
```

Обязательное условие:

```text
HEAD == origin/master
```

Сравнить реальные full SHA.

Dirty tree из-за pre-existing unrelated files допустим, но должен быть явно указан. Не очищать его ради отчёта.

---

## 9. Required final report

### A. Verdict

Только:

```text
VERDICT A — STEP 3.7B.4 FINAL ADMINISTRATIVE CLOSURE — PASS
STEP 3.7B READY FOR STRICT REVIEW
```

или:

```text
VERDICT B — STEP 3.7B.4 ADMINISTRATIVE CLOSURE INCOMPLETE
STEP 3.7B NOT READY FOR STRICT REVIEW
```

### B. Cleanup

```text
revbuyer_* fixtures identified:
revbuyer_* fixtures deleted:
remaining Step 3.7B.4 revbuyer_* fixtures:
synthetic contact-bearing Communications remaining:
harmless evidence Communication remaining:
```

PASS требует все remaining = 0.

### C. Production freeze

```text
production files changed:
test files changed:
schema:
migration:
backfill:
```

PASS:

```text
production files changed: NONE
test files changed: NONE
schema: unchanged
migration: NONE
backfill: NONE
```

### D. Git chain

Только реальные значения:

```text
3.7B implementation SHA:
3.7B.2 remediation SHA:
3.7B.3 precision SHA:
3.7B.4 evidence/report SHA:
administrative-finalization SHA:   # только если отдельный commit
Final HEAD:
origin/master:
HEAD == origin/master:
```

### E. Working tree

```text
Step 3.7B.4 intended changes committed:
Step 3.7B.4 intended changes pushed:
pre-existing unrelated changes remaining:
git status summary:
```

### F. Strict Review readiness

Только при полном PASS:

```text
READY FOR STEP 3.7B STRICT REVIEW: YES
```

Strict Review здесь не выполнять.

---

## 10. Hard PASS gates

VERDICT A запрещён, если не выполнено хотя бы одно:

```text
[ ] exact Step 3.7B.4 revbuyer_* fixtures identified
[ ] revbuyer_* fixtures deleted
[ ] remaining Step 3.7B.4 revbuyer_* fixtures = 0
[ ] synthetic contact-bearing Communications remaining = 0
[ ] harmless evidence Communication remaining = 0
[ ] production code changes = NONE
[ ] test code changes = NONE
[ ] schema unchanged
[ ] migration = NONE
[ ] backfill = NONE
[ ] existing 3.7B.4 report finalized
[ ] Git placeholders removed
[ ] exact 3.7B.4 evidence/report SHA resolved
[ ] exact administrative-finalization SHA resolved if separate
[ ] exact Final HEAD resolved
[ ] exact origin/master resolved
[ ] HEAD == origin/master
[ ] intended changes committed
[ ] intended changes pushed
[ ] unrelated dirty-tree state reported honestly
[ ] Step 3.7B NOT marked APPROVED/CLOSED
```

При любом fail:

```text
VERDICT B
STEP 3.7B NOT READY FOR STRICT REVIEW
```

---

## 11. Stop condition

После административного closure:

1. вернуть финальный отчёт;
2. не менять production/test code;
3. не создавать Step 3.7B.5;
4. не выполнять Strict Review;
5. не помечать Step 3.7B APPROVED/CLOSED;
6. не начинать Step 3.7C;
7. при полном PASS остановиться на:

```text
STEP 3.7B READY FOR STRICT REVIEW
```

Следующий отдельный этап — **STEP 3.7B STRICT REVIEW**.
