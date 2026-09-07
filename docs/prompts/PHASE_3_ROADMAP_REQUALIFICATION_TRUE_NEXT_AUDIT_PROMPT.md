# PHASE 3 — ROADMAP RE-QUALIFICATION / TRUE NEXT AUDIT

**Purpose:** определить канонический следующий stage после `UI-C2 — ACCEPTED`  
**Mode:** `AUDIT FIRST` — только read-only audit до approval  
**Language:** Russian  
**Current accepted baseline:** `586ffe739855b4e29514126abfe5e95e74b398a3`

---

# 1. CURRENT CANONICAL STATE

На момент запуска audit зафиксировано:

```text
D5                         ACCEPTED
D6                         ACCEPTED
D7                         ACCEPTED

UI-C1                     ACCEPTED
UI-C1.1                   ACCEPTED
UI-C1.2                   ACCEPTED
UI-C1.2G                  ACCEPTED
UI-C1.2H                  ACCEPTED
UI-C1.2H.1                ACCEPTED
UI-C1.2H.2                ACCEPTED
UI-C2                     ACCEPTED

Finance Center             NOT STARTED
D8                         NOT STARTED
```

Current Git baseline:

```text
586ffe739855b4e29514126abfe5e95e74b398a3
```

---

# 2. OBJECTIVE

Определить **TRUE NEXT** после `UI-C2`.

Не предполагать, что следующим автоматически является:

```text
D8
Finance
UI-C3
```

Не выбирать stage по удобству.

TRUE NEXT должен быть установлен на основании:

1. approved roadmap;
2. architecture documents;
3. accepted stage reports;
4. current repository state;
5. dependencies;
6. explicit sequencing decisions;
7. open/deferred architecture items.

---

# 3. AUDIT FIRST

До любых изменений выполнить read-only inspection.

Проверить Git:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status --porcelain=v1
git diff --check
git log --oneline --decorate -30
```

Ожидается:

```text
HEAD == 586ffe739855b4e29514126abfe5e95e74b398a3
HEAD == origin/master
WORKTREE CLEAN
```

Если baseline mismatch:

**STOP.**

Не выполнять reset/restore/checkout/delete.

---

# 4. ROADMAP SOURCES

Найти и проверить все canonical roadmap sources в repository.

Искать:

```text
roadmap
TRUE NEXT
NEXT
PHASE 3
D8
UI-C2
UI-C3
Finance
Finance Center
```

Особенно проверить:

```text
docs/
docs/architecture/
docs/reports/
```

Не считать автоматически каноническим любой старый prompt или obsolete report.

Определить для каждого roadmap artifact:

```text
path
status
date/commit
authority level
whether superseded
```

---

# 5. ACCEPTED-STAGE CHAIN

Восстановить фактическую последовательность:

```text
D5
↓
D6
↓
D7
↓
UI-C1
↓
UI-C1.1
↓
UI-C1.2
↓
...
↓
UI-C2
```

Для каждого stage определить:

```text
Stage
Verdict
Final SHA
Next stated stage
Dependencies
Open items
```

Не использовать предположительные промежуточные stages.

---

# 6. TRUE NEXT CRITERIA

Candidate stage может быть TRUE NEXT только если:

### A. Roadmap authority

Он присутствует в актуальной approved roadmap.

### B. Dependency satisfied

Все обязательные predecessors accepted.

### C. Scope is not already implemented

Не выбирать уже закрытый stage.

### D. Not superseded

Не выбирать stage, отменённый или заменённый поздней архитектурой.

### E. No unresolved blocker

Если dependency/blocker существует — candidate не может быть READY.

### F. Business/architecture coherence

Stage должен соответствовать текущей canonical architecture.

---

# 7. CANDIDATE MATRIX

Создать таблицу:

| Candidate | Source | Status | Dependencies | Dependency state | Ready? | Reason |
|---|---|---|---|---|---|---|
| D8 | ? | ? | ? | ? | ? | ? |
| UI-C3 | ? | ? | ? | ? | ? | ? |
| Finance | ? | NOT STARTED | ? | ? | ? | ? |
| Other | ? | ? | ? | ? | ? | ? |

Добавить все реально обнаруженные candidates.

Не ограничиваться только D8/UI-C3/Finance.

---

# 8. D8

Отдельно проверить D8.

Определить:

```text
D8 title
D8 purpose
D8 dependencies
D8 predecessor
D8 relationship to UI-C2
D8 status
D8 readiness
```

Не считать D8 TRUE NEXT только потому, что он ранее был обозначен `NOT STARTED`.

---

# 9. FINANCE

Отдельно проверить Finance.

Canonical state:

```text
Finance Center = NOT STARTED
Payments = CURRENT capability
Payments ≠ Finance Center
```

Определить:

```text
Finance roadmap position
Finance dependencies
Finance canonical prerequisites
Finance data model readiness
Finance authority
```

Не начинать Finance implementation.

Не считать Payments реализацией Finance Center.

---

# 10. UI-C3 / FUTURE UI

Найти все references на:

```text
UI-C3
UI-C3+
Commerce UI
Sales UI
Analytics UI
CRM UI
Marketplace UI
```

Проверить, являются ли они:

```text
approved roadmap
proposal
future architecture
obsolete plan
```

Не выбирать proposal как TRUE NEXT без evidence.

---

# 11. DEBT REGISTER

Проверить актуальный Debt Register.

Не автоматически превращать любой debt item в next stage.

Классифицировать:

```text
blocking
non-blocking
deferred
future-stage-owned
known baseline
```

Особенно проверить:

```text
PROD-01
FIN-01/02/03
SEC-*
DATA-*
AGR-*
SUB-*
UI-*
HELP-*
```

Определить, блокирует ли какой-либо debt candidate stage.

---

# 12. ARCHITECTURE DEPENDENCIES

Проверить dependency chain между:

```text
Commerce
Finance
Sales
Analytics
CRM
Marketing
Marketplace
Product/Service Model
```

Не предполагать независимость.

Если stage зависит от:

```text
canonical domain model
API
RBAC
tenant model
financial semantics
product/service model
```

dependency должна быть явно показана.

---

# 13. CURRENT IMPLEMENTED SURFACE

Составить inventory того, что уже существует:

```text
Command Center
Commerce Center
Operations Center
Requests
Orders
Bookings
Payments
Help
Commerce Relation Chain
```

и отдельно:

```text
NOT STARTED
Finance Center
D8
Sales
Analytics
CRM
Marketing
Marketplace
...
```

Но статус каждого item должен быть подтверждён repository/docs.

---

# 14. DO NOT CHANGE PROJECT

На этом stage:

```text
NO production code
NO tests
NO schema
NO migrations
NO API changes
NO UI changes
NO commits
```

Это исключительно roadmap/architecture audit.

---

# 15. REQUIRED OUTPUT

После read-only audit предоставить:

## A. Canonical Roadmap

Фактическую roadmap после UI-C2.

## B. Accepted Chain

```text
Stage → Verdict → Final SHA
```

## C. Candidate Matrix

Все обнаруженные candidates.

## D. Dependency Graph

```text
accepted stages
       ↓
dependencies
       ↓
candidate stages
```

## E. TRUE NEXT

Однозначно:

```text
TRUE NEXT:
<stage>
```

или:

```text
NO TRUE NEXT CAN BE PROVEN
```

если sources противоречат друг другу.

## F. Why Not Others

Для каждого сильного candidate:

```text
Candidate
Why not TRUE NEXT
Evidence
```

## G. Open Blockers

Только реальные blockers.

## H. Recommended Next Prompt

После определения TRUE NEXT предложить структуру следующего stage prompt.

**Не создавать этот prompt автоматически до approval пользователя.**

---

# 16. IMPORTANT — DO NOT JUMP TO IMPLEMENTATION

После audit:

```text
AUDIT COMPLETE
↓
TRUE NEXT IDENTIFIED
↓
STOP
```

Не:

```text
audit → implementation
```

и не:

```text
audit → commit
```

Пользователь должен отдельно утвердить TRUE NEXT.

---

# 17. ROADMAP RECONCILIATION RULES

Если обнаружены разные источники:

```text
old roadmap
new roadmap
stage report
architecture doc
prompt
```

не выбирать молча.

Показать:

```text
Conflict
Sources
Authority
Resolution
```

При невозможности доказать precedence:

```text
BLOCKED / DECISION REQUIRED
```

---

# 18. GIT EVIDENCE

В отчёте обязательно указать:

```text
BASELINE:
586ffe739855b4e29514126abfe5e95e74b398a3

HEAD:
<actual>

origin/master:
<actual>

WORKTREE:
CLEAN / NOT CLEAN
```

Не подменять actual SHA.

---

# 19. REQUIRED AUDIT REPORT

Создать только после audit:

```text
docs/reports/PHASE_3_ROADMAP_REQUALIFICATION_TRUE_NEXT_AUDIT_REPORT.md
```

Report должен быть на русском.

Структура:

```text
1. Executive Summary
2. Audit Baseline
3. Canonical Roadmap Sources
4. Accepted Stage Chain
5. Current Project State
6. Candidate Matrix
7. Dependency Graph
8. D8 Analysis
9. Finance Analysis
10. UI-C3/Future UI Analysis
11. Debt Register Impact
12. Architecture Dependencies
13. Roadmap Conflicts
14. TRUE NEXT Determination
15. Why Other Candidates Are Not TRUE NEXT
16. Blockers
17. Recommended Next Stage Prompt Scope
18. Git Evidence
19. Final Audit Verdict
```

---

# 20. AUDIT VERDICT

### VERDICT A — TRUE NEXT PROVEN

Если один candidate однозначно подтверждён актуальными approved sources и dependencies satisfied.

### VERDICT B — ROADMAP CONFLICT

Если sources противоречат друг другу и precedence не доказан.

### VERDICT C — BLOCKED

Если required dependency/authority отсутствует.

---

# 21. FINAL RESPONSE

Формат:

```text
PHASE 3 — ROADMAP RE-QUALIFICATION

BASELINE:
586ffe739855b4e29514126abfe5e95e74b398a3

WORKTREE:
CLEAN

ACCEPTED CHAIN:
<summary>

CANDIDATES:
<summary>

TRUE NEXT:
<stage>

WHY:
<evidence>

NOT TRUE NEXT:
<key candidates + reasons>

BLOCKERS:
<none / list>

REPORT:
docs/reports/PHASE_3_ROADMAP_REQUALIFICATION_TRUE_NEXT_AUDIT_REPORT.md

VERDICT:
A / B / C

STOP
```

---

# 22. CURRENT COMMAND

**НАЧАТЬ `PHASE 3 — ROADMAP RE-QUALIFICATION — TRUE NEXT AUDIT`.**

Работать исключительно read-only.

Не менять код.

Не начинать D8.

Не начинать Finance.

Не начинать UI-C3.

Не создавать implementation prompt следующего stage.

Сначала доказать **TRUE NEXT**, затем STOP на approval.
