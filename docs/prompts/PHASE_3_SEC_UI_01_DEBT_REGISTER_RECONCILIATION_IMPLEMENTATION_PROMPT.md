# PHASE 3 --- SEC-UI-01 --- DEBT REGISTER RECONCILIATION IMPLEMENTATION PROMPT

## 0. TASK TYPE

Это **documentation-only governance reconciliation step**.

Не implementation UI-C6.

Не security remediation.

Не qualification.

Не TRUE NEXT audit.

Не закрытие SEC-UI-01.

Цель единственного изменения:

> Синхронизировать `Planned closure stage` для SEC-UI-01 в canonical
> Debt Register с уже принятым governance reconciliation decision.

------------------------------------------------------------------------

# 1. Repository

Repository:

``` text
https://github.com/seldom733-hash/travelhub1
```

Expected baseline:

``` text
d6aebb90182e54f45d1dd8090318542fcc7f26c0
```

Target file:

``` text
docs/TRAVELHUB_DEBT_REGISTER.md
```

------------------------------------------------------------------------

# 2. AUTHORITATIVE DECISION

Уже принято отдельное governance решение:

``` text
SEC-UI-01 planned closure stage = UI-C6
```

Canonical sequencing:

``` text
UI-C6 — Request Server-Authority Remediation
        ↓
SEC-UI-01 CLOSED
        ↓
UI-C7 — Request UI Migration
```

Это решение должно быть отражено в Debt Register.

------------------------------------------------------------------------

# 3. CURRENT STATE TO VERIFY FIRST

Перед изменением обязательно проверить фактический repository state:

``` bash
git rev-parse HEAD
git rev-parse origin/master
git status --porcelain=v1
git diff --check
```

Также прочитать:

``` text
docs/TRAVELHUB_DEBT_REGISTER.md
```

и найти именно:

``` text
### SEC-UI-01 — Request Actions Server-Authority Gap
```

Текущая запись ожидается:

``` text
Planned closure stage | UI-C7 (Request migration)
Status | OPEN
Closure SHA | —
```

Если текущая запись уже содержит `UI-C6`, **не делать никакого
изменения**.

Если текущий repository отличается от ожидаемого baseline или обнаружены
неожиданные source changes:

``` text
STOP
```

------------------------------------------------------------------------

# 4. EXACT ALLOWED CHANGE

Разрешено изменить **только одну строку** в записи SEC-UI-01:

``` diff
- | Planned closure stage | UI-C7 (Request migration) |
+ | Planned closure stage | UI-C6 (Request Server-Authority Remediation) |
```

Не изменять surrounding fields.

------------------------------------------------------------------------

# 5. IMMUTABLE FIELDS

Следующие поля SEC-UI-01 должны остаться без изменений:

``` text
ID
Title
Category
Severity
Origin
Description
Why it matters
Canonical authority affected
Dependencies
Status
Acceptance condition
Closure SHA
Notes
```

Особенно обязательно:

``` text
Status = OPEN
Closure SHA = —
```

------------------------------------------------------------------------

# 6. STRICT NO-TOUCH SCOPE

Запрещено изменять:

-   application source code;
-   frontend;
-   backend;
-   Prisma/schema;
-   migrations;
-   API contracts;
-   tests;
-   CI;
-   configuration;
-   package files;
-   other Debt Register items;
-   roadmap files;
-   architecture documents;
-   historical reports;
-   UI-C6 implementation prompt;
-   UI-C6 implementation status;
-   UI-C7 status;
-   SEC-UI-01 status;
-   any other debt status.

Не добавлять новые debts.

Не удалять debts.

Не переименовывать debts.

Не форматировать весь файл.

Не делать unrelated cleanup.

------------------------------------------------------------------------

# 7. IMPORTANT SEMANTIC RULE

Эта правка означает только:

``` text
planned closure stage = UI-C6
```

Она НЕ означает:

``` text
UI-C6 started
UI-C6 implemented
UI-C6 accepted
SEC-UI-01 closed
```

Следовательно после изменения должно оставаться:

``` text
SEC-UI-01
Status: OPEN
Closure SHA: —
```

------------------------------------------------------------------------

# 8. PRE-EDIT AUDIT

Перед редактированием подтвердить:

``` text
[ ] baseline соответствует expected state
[ ] target file существует
[ ] SEC-UI-01 существует
[ ] Planned closure stage действительно UI-C7
[ ] Status = OPEN
[ ] Closure SHA = —
[ ] working tree не содержит неожиданных изменений
```

Если любой пункт не выполняется:

``` text
STOP
```

------------------------------------------------------------------------

# 9. IMPLEMENTATION

Сделать только одну документационную замену:

``` text
UI-C7 (Request migration)
        ↓
UI-C6 (Request Server-Authority Remediation)
```

Не менять ничего другого.

------------------------------------------------------------------------

# 10. POST-EDIT DIFF AUDIT

После изменения обязательно выполнить:

``` bash
git diff --check
git diff -- docs/TRAVELHUB_DEBT_REGISTER.md
git status --short
```

Diff должен содержать только:

``` diff
- | Planned closure stage | UI-C7 (Request migration) |
+ | Planned closure stage | UI-C6 (Request Server-Authority Remediation) |
```

Если diff содержит что-либо ещё:

``` text
STOP
```

и вернуть unintended changes до commit.

------------------------------------------------------------------------

# 11. SEMANTIC VERIFICATION

После изменения проверить:

``` text
SEC-UI-01
Planned closure stage = UI-C6
Status = OPEN
Closure SHA = —
```

Также проверить отсутствие изменений в других debt items.

------------------------------------------------------------------------

# 12. COMMIT

Если все проверки PASS:

``` bash
git add docs/TRAVELHUB_DEBT_REGISTER.md
git commit -m "docs: reconcile SEC-UI-01 closure stage to UI-C6"
git push origin master
```

Не делать squash/rebase/reset.

Не переписывать history.

------------------------------------------------------------------------

# 13. GIT HARD CLOSURE

После push обязательно:

``` bash
git rev-parse HEAD
git rev-parse origin/master
git status --porcelain=v1
git diff --check
```

Expected:

``` text
HEAD == origin/master
worktree clean
diff --check PASS
```

Записать новый final SHA.

------------------------------------------------------------------------

# 14. REQUIRED REPORT

Создать:

``` text
docs/reports/PHASE_3_SEC_UI_01_DEBT_REGISTER_RECONCILIATION_REPORT.md
```

Report должен содержать:

## 14.1 Baseline

``` text
BASELINE:
d6aebb90182e54f45d1dd8090318542fcc7f26c0
```

## 14.2 Change

``` text
SEC-UI-01
Planned closure stage:
UI-C7 → UI-C6
```

## 14.3 Immutable Status

``` text
Status:
OPEN

Closure SHA:
—
```

## 14.4 Scope

``` text
Documentation-only governance reconciliation.
No application code changed.
No security debt was closed.
```

## 14.5 Git Evidence

Указать:

``` text
Implementation commit:
<sha>

Final HEAD:
<sha>

origin/master:
<sha>

Worktree:
CLEAN

diff --check:
PASS
```

## 14.6 Verdict

``` text
VERDICT A — RECONCILIATION IMPLEMENTED
```

с обязательным уточнением:

``` text
SEC-UI-01 remains OPEN.
UI-C6 has NOT been implemented or qualified by this step.
```

------------------------------------------------------------------------

# 15. REPORT IS NOT QUALIFICATION

Не писать:

``` text
SEC-UI-01 CLOSED
UI-C6 ACCEPTED
TRUE NEXT PROVEN
```

Этот report подтверждает только документационную reconciliation.

Следующий отдельный шаг:

``` text
TRUE NEXT REQUALIFICATION
```

------------------------------------------------------------------------

# 16. STOP CONDITIONS

Немедленно STOP при:

-   dirty/unexpected worktree;
-   baseline mismatch;
-   missing SEC-UI-01;
-   current stage already UI-C6;
-   Status ≠ OPEN;
-   Closure SHA ≠ ---;
-   more than one intended line changed;
-   changes outside Debt Register;
-   unexpected roadmap contradiction;
-   unexpected source changes;
-   failed diff check;
-   failed push;
-   `HEAD != origin/master`.

Не исправлять дополнительные проблемы в рамках этого шага.

------------------------------------------------------------------------

# 17. FINAL STATE

После успешного выполнения canonical state должен быть:

``` text
SEC-UI-01
├── Status: OPEN
├── Planned closure stage: UI-C6
└── Closure SHA: —
```

Roadmap dependency:

``` text
UI-C6
  ↓
SEC-UI-01 CLOSED
  ↓
UI-C7
```

------------------------------------------------------------------------

# 18. NEXT STEP

После final Git closure **не запускать UI-C6** автоматически.

Передать новый final SHA в:

``` text
PHASE_3_TRUE_NEXT_REQUALIFICATION_UI_C6_PROMPT.md
```

и выполнить отдельный read-only TRUE NEXT audit.

Только после:

``` text
VERDICT A — TRUE NEXT PROVEN
TRUE NEXT = UI-C6
```

разрешается запускать UI-C6 implementation.

------------------------------------------------------------------------

# FINAL INSTRUCTION

Выполнить **только** reconciliation:

``` text
SEC-UI-01:
Planned closure stage
UI-C7 → UI-C6
```

Сохранить:

``` text
Status = OPEN
Closure SHA = —
```

Никакого application implementation.

Никакого security remediation.

Никакого TRUE NEXT verdict.

Никакого UI-C6 execution.

После Git hard closure подготовить reconciliation report и остановиться.
