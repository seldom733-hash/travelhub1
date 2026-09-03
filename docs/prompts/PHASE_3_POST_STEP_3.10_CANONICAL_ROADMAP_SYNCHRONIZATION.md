# PHASE 3 — POST-STEP 3.10 — CANONICAL ROADMAP SYNCHRONIZATION

## 0. TASK MODE

**DOCUMENTATION / CANONICAL ROADMAP SYNCHRONIZATION ONLY.**

Current verified state:

```text
PHASE 3 — STEP 3.10 — SUPPORT DOMAIN

Implementation SHA:          7d638ef
Strict Review SHA:           ff64a83
Remediation/Re-qualification SHA: bb53fb0

Final verdict:
VERDICT A — PHASE 3 — STEP 3.10 SUPPORT DOMAIN — STRICT REVIEW RE-QUALIFICATION APPROVED

F1 CLOSED
F2 CLOSED
F3 CLOSED
F4 CLOSED
F5 CLOSED

STEP 3.10 CLOSED
```

Current expected Git baseline:

```text
HEAD:          bb53fb0
origin/master: bb53fb0
```

Цель задачи:

```text
1. Синхронизировать canonical roadmap с фактическим закрытием Step 3.10.
2. Сохранить полную audit/history цепочку:
   Implementation A
   → Strict Review B
   → Findings Remediation
   → Re-Qualification A
3. Обновить completed boundary до Phase 3.0–3.10.
4. Определить exact CANONICAL NEXT только из roadmap.
5. Не начинать следующий implementation.
```

---

# 1. LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые reports и prose documentation должны быть преимущественно **на русском языке**.

На русском обязательны:

- roadmap status updates;
- closure notes;
- audit/history explanations;
- synchronization report;
- conclusions;
- next-step explanation.

Английский допускается только для:

- file paths;
- SHA;
- class/method/model names;
- API/permission identifiers;
- CLI/Git commands;
- code snippets;
- commit messages;
- standardized VERDICT strings;
- exact canonical step titles, если они уже записаны в roadmap на английском.

Если новый prose/report преимущественно на английском — задача считается незавершённой.

---

# PART I — PREFLIGHT

## 2. GIT BASELINE

Выполнить:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git log -25 --oneline
```

Ожидаемо:

```text
HEAD:          bb53fb0
origin/master: bb53fb0
```

Если baseline отличается — установить причину до изменений.

Не изменять/stage unrelated dirty files.

---

# PART II — READ CANONICAL ROADMAP

## 3. OPEN ACTUAL ROADMAP

Открыть actual canonical file:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Если canonical filename/path фактически отличается — использовать реальный current canonical roadmap, но не создавать второй master roadmap.

---

## 4. LOCATE STEP 3.10

Найти:

```text
PHASE 3 — STEP 3.10 — SUPPORT DOMAIN
```

Извлечь:

```text
current status
existing history entries
acceptance/closure convention
completed boundary
current canonical NEXT
roadmap item numbering
```

Не переписывать существующую историю.

---

# PART III — VERIFY STEP 3.10 CLOSURE EVIDENCE

## 5. VERIFY REAL COMMITS

Проверить существование:

```bash
git show --stat --oneline 7d638ef
git show --stat --oneline ff64a83
git show --stat --oneline bb53fb0
```

Не записывать в roadmap SHA, которые не существуют.

---

## 6. VERIFY REPORTS

Найти actual reports/evidence для:

```text
Step 3.10 implementation
Step 3.10 strict review
Step 3.10 findings remediation / re-qualification
```

Проверить, что final re-qualification действительно содержит:

```text
VERDICT A — PHASE 3 — STEP 3.10 SUPPORT DOMAIN — STRICT REVIEW RE-QUALIFICATION APPROVED

F1 CLOSED
F2 CLOSED
F3 CLOSED
F4 CLOSED
F5 CLOSED

STEP 3.10 CLOSED
```

Если report wording/path отличается, использовать реальный источник, не выдумывать новый.

---

# PART IV — PERMISSION-MATRIX SANITY CHECK

## 7. F1 CLOSURE SANITY CHECK

Перед окончательной roadmap closure коротко проверить effective Support permission matrix после `bb53fb0`.

Причина: remediation summary упоминает RolePermission rows для:

```text
ADMIN
OPERATOR
DIRECTOR
FINANCE
ANALYST
SALES_MANAGER
```

Нужно убедиться, что это означает **role-specific grants**, а не выдачу всех `support.case.*` каждой перечисленной роли.

Проверить actual seeded rows/default matrix.

Минимально подтвердить effective result для:

```text
support.case.create
support.case.read
support.case.update
support.case.assign
```

и ролей:

```text
ADMIN
OPERATOR
DIRECTOR
FINANCE
ANALYST
SALES_MANAGER
PARTNER
```

Не менять production code в этой synchronization task.

Если обнаружено расхождение с approved re-qualification/runtime evidence:

```text
STOP
do not mark Step 3.10 canonically CLOSED
report inconsistency
```

Если matrix корректна — продолжить.

---

# PART V — ROADMAP UPDATE

## 8. PRESERVE HISTORICAL CHAIN

Step 3.10 entry должен сохранять историю минимум в таком логическом порядке:

```text
Implementation
→ SHA 7d638ef
→ IMPLEMENTATION COMPLETE
→ READY FOR SEPARATE STRICT REVIEW

Strict Review
→ SHA ff64a83
→ VERDICT B
→ STEP 3.10 REMAINS OPEN
→ F1 P1
→ F2 P2
→ F3 P2
→ F4 P3
→ F5 P3

Targeted Remediation + Re-Qualification
→ SHA bb53fb0
→ F1 CLOSED
→ F2 CLOSED
→ F3 CLOSED
→ F4 CLOSED
→ F5 CLOSED
→ VERDICT A
→ STEP 3.10 CLOSED
```

Не удалять `VERDICT B`.

Не переписывать историю так, будто Step 3.10 прошёл Strict Review с первого раза.

---

## 9. FINAL STEP STATUS

Установить final current status:

```text
✅ STRICT REVIEW RE-QUALIFICATION APPROVED — CLOSED
```

или exact existing roadmap style-equivalent.

---

## 10. COMPLETED BOUNDARY

Если предыдущая completed boundary была:

```text
Phase 3.0–3.9
```

обновить на:

```text
Phase 3.0–3.10
```

только если это соответствует текущей roadmap convention.

Не изменять unrelated phase boundaries.

---

## 11. ROADMAP AUDIT ITEMS

Если roadmap имеет numbered audit/history items, добавить additive entries для:

```text
Step 3.10 Implementation
Step 3.10 Strict Review failure
Step 3.10 Findings Remediation / Re-Qualification closure
```

или объединить согласно существующей canonical convention.

Не renumber существующие historical items без необходимости.

---

# PART VI — DETERMINE EXACT CANONICAL NEXT

## 12. DO NOT GUESS

После Step 3.10 найти **следующий фактически записанный canonical stage**.

Не предполагать автоматически, что это:

```text
Step 3.11
```

Проверить реальную roadmap sequence.

---

## 13. EXACT NEXT OUTPUT

Зафиксировать дословно:

```text
CANONICAL NEXT:
<exact title from roadmap>
```

Если roadmap содержит дополнительные prerequisite/docs-only synchronization stage — именно он является NEXT.

Если roadmap неоднозначен:

```text
STOP
report ambiguity
do not invent next step
```

---

## 14. DO NOT AUTO-START

Даже после определения NEXT:

```text
DO NOT IMPLEMENT
DO NOT CREATE DOMAIN CODE
DO NOT ADD UI
DO NOT START NEXT STEP
```

Эта задача — только synchronization.

---

# PART VII — SYNCHRONIZATION REPORT

## 15. CREATE REPORT

Создать:

```text
docs/prompts/PHASE_3_POST_STEP_3.10_CANONICAL_ROADMAP_SYNCHRONIZATION_REPORT.md
```

Минимальная структура:

```text
1. Baseline
2. Canonical roadmap file
3. Step 3.10 closure evidence
4. Commit verification
5. F1–F5 historical chain
6. Permission-matrix sanity check
7. Roadmap changes
8. Completed boundary
9. Exact canonical NEXT
10. Files changed
11. Git evidence
12. Final synchronization verdict
```

---

# PART VIII — GIT POLICY

## 16. DIFF REVIEW

Перед commit:

```bash
git status --short
git diff --name-only
git diff
```

Допустимы только:

```text
canonical roadmap
synchronization report
```

и только необходимые supporting docs, если repository convention требует.

Не изменять:

```text
backend
frontend
Prisma schema
tests
runtime code
Step 3.11 implementation
```

---

## 17. COMMIT / PUSH

Пример commit message:

```bash
git add docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
git add docs/prompts/PHASE_3_POST_STEP_3.10_CANONICAL_ROADMAP_SYNCHRONIZATION_REPORT.md

git commit -m "docs(roadmap): close Phase 3 Step 3.10"
git push origin master
```

После push:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status --short
```

Зафиксировать:

```text
Starting SHA:     bb53fb0
Roadmap Sync SHA: <real SHA>
Final HEAD:       <real SHA>
origin/master:    <real SHA>
HEAD == origin:   YES/NO
```

---

# PART IX — ACCEPTANCE GATES

## 18. VERDICT A

Разрешён только если:

```text
Step 3.10 implementation SHA verified
Strict Review SHA verified
Remediation/Re-qualification SHA verified

VERDICT B history preserved
F1–F5 closure preserved
final Step 3.10 status = CLOSED

effective Support permission matrix sanity check passes

completed boundary updated correctly
exact canonical NEXT derived from roadmap
no next implementation started

roadmap changes additive
no silent historical rewrite
no unrelated files changed

report predominantly Russian
HEAD == origin/master
```

Final:

```text
VERDICT A — PHASE 3 — POST-STEP 3.10 CANONICAL ROADMAP SYNCHRONIZATION COMPLETE
```

---

## 19. VERDICT B

Если:

```text
commit evidence inconsistent
permission matrix contradicts approved closure
roadmap history missing/corrupted
NEXT ambiguous
unrelated implementation mixed in
HEAD/origin mismatch unresolved
```

то:

```text
VERDICT B — PHASE 3 — POST-STEP 3.10 CANONICAL ROADMAP SYNCHRONIZATION FAILED
```

Не исправлять unrelated production issue автоматически.

---

# PART X — FINAL RESPONSE

## 20. RETURN

Вернуть пользователю:

```text
Starting SHA
Roadmap Sync SHA
Final HEAD/origin
Step 3.10 final roadmap status
Completed boundary
F1–F5 closure preserved: YES/NO
Permission matrix sanity result
Exact CANONICAL NEXT
Files changed
Final VERDICT
```

---

# PART XI — STOP

## 21. STOP CONDITION

После synchronization:

```text
STOP
```

Не начинать canonical NEXT без отдельного запроса пользователя.
