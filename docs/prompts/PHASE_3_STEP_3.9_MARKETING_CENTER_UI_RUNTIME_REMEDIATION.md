# PHASE 3 — STEP 3.9 — MARKETING CENTER UI — RUNTIME REMEDIATION

## 0. TASK MODE

**TARGETED REMEDIATION ONLY.**

Step 3.9 implementation commit:

```text
c539e51
```

Implementation ранее был заявлен как:

```text
VERDICT A — PHASE 3 — STEP 3.9 MARKETING CENTER UI — IMPLEMENTATION COMPLETE
READY FOR SEPARATE STRICT REVIEW
```

После этого в реальном browser runtime обнаружен frontend defect.

До его устранения:

```text
STEP 3.9 STRICT REVIEW — BLOCKED
```

Не начинать Strict Review в рамках этой задачи.

---

## 1. LANGUAGE REQUIREMENT — MANDATORY

Все отчёты, findings, root cause, runtime evidence, conclusions и verdict explanations должны быть преимущественно **на русском языке**.

Английский допускается только для:

- code;
- file paths;
- component/function names;
- API endpoints;
- technical identifiers;
- CLI/Git commands;
- commit messages;
- standardized VERDICT strings.

Если remediation report преимущественно на английском — задача незавершена.

---

## 2. CONFIRMED RUNTIME DEFECT

Browser console:

```text
Each child in a list should have a unique "key" prop.

Check the render method of `tbody`.
It was passed a child from MarketingContent.
```

Stack:

```text
app/app/marketing/page.tsx:250:21
Array.map
MarketingContent app/app/marketing/page.tsx:249:45
MarketingPage app/app/marketing/page.tsx:430:7
```

Observed code pattern:

```tsx
<tbody>
  {(campaigns?.items ?? []).map((c) => (
    <>
      <tr key={c.id}>
        ...
      </tr>
      ...
    </>
  ))}
</tbody>
```

### Root cause to verify

`.map()` возвращает Fragment как top-level child.

`key={c.id}` установлен на вложенном `<tr>`, поэтому React не видит unique key на элементе списка.

---

## 3. REQUIRED FIX

Исправить минимально, без unrelated refactor.

Ожидаемый semantic pattern:

```tsx
import { Fragment } from 'react';

{(campaigns?.items ?? []).map((c) => (
  <Fragment key={c.id}>
    <tr>
      ...
    </tr>

    {/* expanded detail row, если есть */}
    ...
  </Fragment>
))}
```

Если repository/style требует другой корректный React pattern — можно использовать его, но:

```text
key должен находиться на top-level element,
возвращаемом map()
```

Не использовать array index как key.

Не использовать нестабильный/random key.

Использовать стабильный canonical campaign identifier, ожидаемо:

```text
c.id
```

---

## 4. AUDIT ADJACENT LIST RENDERING

Поскольку defect обнаружен в новом Step 3.9 UI, проверить **только task-owned Marketing Center code** на аналогичные ошибки.

Найти `.map()` в:

```text
app/app/marketing/**
```

или фактических Step 3.9 Marketing UI files.

Проверить:

```text
Campaign rows
expanded detail rows
Audience rows
Attribution rows
status/action lists
tabs/actions if dynamically mapped
```

Не делать глобальный repository-wide refactor.

Если найден такой же defect в Step 3.9-owned code — исправить в этом remediation и перечислить отдельно.

---

## 5. AUTOMATED REGRESSION TEST

Добавить/скорректировать минимальный regression test, если существующая frontend test architecture позволяет это без искусственного brittle test.

Тест должен по возможности рендерить:

```text
минимум 2 Campaign rows
```

и подтверждать отсутствие React key warning/error.

Если console interception уже используется в test suite — переиспользовать существующий pattern.

Не создавать сложный test framework только ради проверки warning.

---

## 6. REQUIRED TESTS

После исправления запустить relevant frontend tests.

Минимум:

```text
Marketing Center tests
related navigation/RBAC tests
frontend TypeScript/build
```

Если полный frontend suite разумно запускается в текущем проекте — запустить его также.

Зафиксировать точные counts.

---

## 7. AUTHENTICATED BROWSER REQUALIFICATION — MANDATORY

Source/tests недостаточно.

Открыть реальный:

```text
/app/marketing
```

под авторизованным Platform actor.

Обязательно проверить страницу с **несколькими Campaign records**.

### Verify

```text
Campaign table renders
all Campaign rows visible
campaign Code click works
expanded Campaign detail works
collapse works
lifecycle actions still work
no duplicated/missing rows
no unstable row behavior
```

---

## 8. CONSOLE HARD GATE

Очистить browser console перед requalification.

После:

```text
page load
Campaign table render
expand campaign
collapse campaign
expand another campaign
lifecycle interaction
```

проверить console.

Должно быть:

```text
0 occurrences:
Each child in a list should have a unique "key" prop.
```

Также проверить отсутствие новых Step 3.9-owned:

```text
React warnings
React errors
hydration errors
uncaught exceptions
```

Если остаётся runtime warning/error, remediation не PASS.

---

## 9. NETWORK / FUNCTIONAL REGRESSION

Во время browser requalification проверить, что исправление не сломало:

```text
Campaign API requests
Campaign detail requests
Audience loading
Attribution loading
lifecycle transition request
```

Не должно появиться новых unexpected `4xx/5xx`.

Expected permission/validation responses не считать дефектом, если они вызваны соответствующим negative test.

---

## 10. NO SCOPE EXPANSION

В этой задаче запрещено:

```text
перестраивать Marketing Center
редизайнить таблицу
менять Marketing backend architecture
добавлять новые KPI
добавлять Partner Marketing
реализовывать Marketing transports
реализовывать consent
реализовывать новый analytics
начинать Strict Review
начинать следующий roadmap step
```

Только defect remediation + adjacent Step 3.9 key audit + requalification.

---

## 11. REMEDIATION REPORT

Создать:

```text
docs/prompts/PHASE_3_STEP_3.9_MARKETING_CENTER_UI_RUNTIME_REMEDIATION_REPORT.md
```

Структура:

```text
1. Baseline
2. Runtime defect
3. Root cause
4. Code fix
5. Adjacent Marketing list audit
6. Automated tests
7. Browser requalification
8. Console evidence
9. Network/functional evidence
10. Files changed
11. Git closure
12. Verdict
```

Отчёт — преимущественно на русском языке.

---

## 12. GIT CLOSURE

Перед commit:

```bash
git status --short
git diff --name-only
git diff
```

Не stage pre-existing unrelated dirty files.

После remediation:

```bash
git add <task-owned-files-only>
git commit -m "fix(marketing): add stable key to campaign row fragment"
git push origin master
git rev-parse HEAD
git rev-parse origin/master
git status --short
```

Финально вывести реальные:

```text
Step 3.9 implementation SHA: c539e51
Remediation SHA:             <real SHA>
Final HEAD:                  <real SHA>
origin/master:               <real SHA>
HEAD == origin/master:       YES/NO
```

Не оставлять `(this commit)` / `(after push)` placeholders в final execution response.

---

## 13. SUCCESS GATE

PASS только если:

```text
Fragment/top-level map key fixed correctly
stable canonical key used
adjacent Step 3.9 list rendering audited
relevant tests PASS
frontend build/typecheck PASS
authenticated /app/marketing browser runtime PASS
multiple Campaign rows render correctly
expand/collapse PASS
lifecycle behavior remains functional
React key warning = 0
new Step 3.9 console warnings/errors = 0
no functional/network regression
Git closure complete
report in Russian
```

Тогда:

```text
VERDICT A — PHASE 3 — STEP 3.9 MARKETING CENTER UI — RUNTIME REMEDIATION COMPLETE

RUNTIME DEFECT CLOSED
STEP 3.9 READY FOR SEPARATE STRICT REVIEW
```

---

## 14. FAILURE GATE

Если warning остаётся, появляется другой Step 3.9 runtime defect или browser verification не выполнен:

```text
VERDICT B — PHASE 3 — STEP 3.9 MARKETING CENTER UI — RUNTIME REMEDIATION INCOMPLETE

STEP 3.9 STRICT REVIEW REMAINS BLOCKED
```

Указать точный remaining defect.

---

## 15. STOP CONDITION

После remediation:

```text
STOP
```

Не выполнять Strict Review автоматически.

После подтверждённого `VERDICT A` следующей отдельной задачей будет:

```text
PHASE 3 — STEP 3.9 — MARKETING CENTER UI — STRICT REVIEW
```
