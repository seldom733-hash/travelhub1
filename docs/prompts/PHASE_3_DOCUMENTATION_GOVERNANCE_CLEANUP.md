# PHASE 3 — DOCUMENTATION GOVERNANCE CLEANUP
## CANONICAL ROADMAP & ARCHITECTURE RECONCILIATION / CLEANUP PROMPT

### 0. EXECUTION MODE

Это специальная **documentation governance** стадия.

Цель:
привести документацию TravelHub в единое, непротиворечивое и поддерживаемое состояние непосредственно в локальной repository-папке разработчика, затем выполнить commit + push в GitHub.

Это НЕ D8 implementation.

Текущая D8-ветка должна быть приостановлена до завершения этой стадии.

---

# 1. ОСНОВНАЯ ПРОБЛЕМА

В repository/рабочей папке исторически накопились:

- несколько roadmap/master-plan документов;
- несколько архитектурных документов;
- старые prompts;
- audit reports;
- reconciliation reports;
- временные документы;
- superseded versions;
- документы, которые могут противоречить друг другу;
- untracked consolidation documents;
- stale status/debt references.

Это создаёт риск governance drift:

```text
один проект
    ↓
несколько "current" документов
    ↓
разные TRUE NEXT
    ↓
разные architecture statements
    ↓
неправильное направление следующего development stage
```

Нужно устранить эту ситуацию.

---

# 2. КЛЮЧЕВОЙ ПРИНЦИП

После этой стадии должен существовать:

```text
ОДИН canonical roadmap
ОДНА canonical current architecture hierarchy
ОДИН источник истины для каждого frozen contract
ЯСНО ОТДЕЛЁННАЯ history/evidence
НЕТ ДУБЛИКАТОВ СТАТУСА "CURRENT"
НЕТ НЕЯВНО КОНКУРИРУЮЩИХ ROADMAP
```

История проекта не уничтожается только ради чистоты.

---

# 3. ПРАВИЛО: СНАЧАЛА INVENTORY, ПОТОМ ИЗМЕНЕНИЯ

Перед любым удалением/перемещением:

1. сделать полный inventory документации;
2. определить владельца/authority каждого документа;
3. выявить дубли;
4. выявить конфликты;
5. построить proposed canonical set;
6. построить deletion/archive plan;
7. только после этого выполнять изменения.

**Нельзя начинать с массового удаления.**

---

# 4. SCOPE

Исследовать repository целиком:

```text
docs/
docs/architecture/
docs/prompts/
docs/reports/
README*
*.md
```

Также проверить:
- ссылки из source code на документацию;
- ссылки между markdown-файлами;
- references в CI/automation;
- пути, указанные в prompts/reports;
- docs referenced from package scripts;
- docs referenced by comments where material.

Не изменять production code только потому, что документ содержит устаревший текст.

---

# 5. DOCUMENT CLASSIFICATION

Каждый документ должен получить одну classification:

```text
CANONICAL
CANONICAL SUPPORTING
ACTIVE
HISTORICAL / EVIDENCE
SUPERSEDED
DUPLICATE
TEMPORARY
ORPHANED
UNKNOWN → требует решения
```

Не использовать расплывчатое:

```text
maybe current
probably old
looks obsolete
```

Каждая классификация должна иметь evidence.

---

# 6. CANONICAL ROADMAP AUDIT

Найти ВСЕ документы, которые могут претендовать на roadmap:

Искать по ключам:

```text
roadmap
master roadmap
master plan
implementation plan
development plan
phase
D0
D1
D8
TRUE NEXT
current next
```

Для каждого:

```text
Path
Git tracked?
Commit introduced
Last modified
Authority claim
Latest relevant decision
TRUE NEXT stated
Current completed stage
Conflicts
Classification
```

---

# 7. CANONICAL ROADMAP SELECTION

Определить **один** canonical roadmap.

Selection rules:

### Приоритет 1
Явно утверждённый governance/canonical source.

### Приоритет 2
Committed в repository и реально используемый как implementation ordering authority.

### Приоритет 3
Документ с последними accepted decisions и verdicts.

### Приоритет 4
Документ должен быть согласован с canonical architecture и lifecycle contracts.

Название файла само по себе НЕ является доказательством authority.

---

# 8. ROADMAP RECONCILIATION

В canonical roadmap проверить:

```text
Phase 1
Phase 2
Phase 3
D-track
C-track
D0-D14
Finance
Product/Service
Security/RBAC
Deferred work
Debt
TRUE NEXT
```

Выявить:

```text
stale TRUE NEXT
duplicate stages
absorbed stages
superseded stages
closed stages still marked open
future stages accidentally marked current
```

Особенно проверить исторически конфликтующие statements:

```text
D1
D1A
D2
D3
D4
D5
D6
D7
D8
UI-C...
Finance
PROD-01
```

Не решать порядок по номеру. Использовать accepted evidence.

---

# 9. TRUE NEXT RULE

После reconciliation должен быть ровно один:

```text
TRUE NEXT
```

если governance state действительно позволяет его определить.

Если sequence невозможно безопасно определить:

```text
TRUE NEXT = UNRESOLVED
```

и это должно быть объяснено.

Нельзя просто выбрать D8 потому, что предыдущий audit его выбрал.

Нельзя выбрать следующую стадию на основании numeric ordering alone.

---

# 10. ARCHITECTURE DOCUMENT AUDIT

Найти все потенциально canonical architecture documents:

```text
architecture
canonical architecture
current architecture
system architecture
application architecture
domain architecture
commerce lifecycle
RBAC
security
temporal
finance
product/service
UX/UI
```

Для каждого:

```text
Path
Authority
Scope
Frozen?
Dependencies
Referenced by other docs?
Conflicts?
Current implementation alignment
Classification
```

---

# 11. ARCHITECTURE HIERARCHY

Сформировать явную hierarchy.

Ожидаемая модель:

```text
CANONICAL ARCHITECTURE
├── Current System Architecture
├── Commerce Lifecycle Canonical Contract
├── Domain-specific canonical contracts
├── Security / RBAC contracts
├── Temporal contracts
└── Other explicitly frozen contracts

SUPPORTING
├── design decisions
├── ADRs
├── specifications
└── implementation references

HISTORY / EVIDENCE
├── audit reports
├── qualification reports
├── reconciliation reports
└── historical prompts
```

Это пример структуры, не приказ переименовывать всё именно так.

Использовать существующую repository structure, если она already coherent.

---

# 12. FROZEN CONTRACT AUDIT

Отдельно определить:

```text
FROZEN
ACTIVE
DEFERRED
SUPERSEDED
HISTORICAL
```

для ключевых contracts:

- Commerce Lifecycle;
- Request;
- Order;
- Booking;
- Payment/Refund;
- Traveler;
- RBAC;
- Workspace;
- Departmental model;
- Temporal model;
- Help/Business Dictionary;
- Finance;
- Product/Service.

Один frozen contract не должен одновременно иметь конкурирующую "final" версию.

---

# 13. DOCUMENT CONFLICT MATRIX

Создать matrix:

| Document A | Document B | Conflict | Which is authoritative | Resolution |
|---|---|---|---|---|

Категории:

```text
CONTENT CONFLICT
STATUS CONFLICT
TRUE NEXT CONFLICT
AUTHORITY CONFLICT
TERMINOLOGY DRIFT
STALE REFERENCE
DUPLICATE
NO REAL CONFLICT
```

Особенно искать:

```text
D8 vs another TRUE NEXT
Finance current vs Finance deferred
Payments vs Finance Center
Operator permissions
Department model
RBAC full-access claims
UI-C19
PROD-01
```

---

# 14. DOCUMENTATION ↔ CODE RECONCILIATION

Для каждого canonical document проверить наиболее важные implementation claims.

Минимум:

```text
RBAC
Commerce lifecycle
Request/Order/Booking
Payment/Refund
Operations Center
Help
Finance distinction
Temporal contracts
Tenant/workspace
```

Классификация:

```text
MATCH
DOCUMENTATION DRIFT
CODE DRIFT
OPEN GOVERNANCE DECISION
HISTORICAL STATEMENT
```

Не исправлять production code в рамках documentation cleanup, если это не отдельная approved development task.

---

# 15. DEBT REGISTER AUDIT

Проверить документационные статусы:

```text
UI-*
HELP-*
SEC-*
DATA-*
FIN-*
PROD-01
PERF-*
D0-D14
```

Проверить:

```text
OPEN
CLOSED
DEFERRED
ABSORBED
```

и сравнить с accepted evidence.

Если stale запись обнаружена:

### Не менять автоматически.

Сначала классифицировать:

```text
DOCUMENTATION DRIFT
REAL OPEN DEBT
ABSORBED
CLOSED
SUPERSEDED
```

Если изменение реестра нужно для canonicalization, выполнить только после documented evidence.

---

# 16. PROMPTS

Prompts не считать автоматически canonical.

Классифицировать:

```text
ACTIVE NEXT-STAGE PROMPT
EXECUTED PROMPT / HISTORY
SUPERSEDED PROMPT
DUPLICATE
TEMPORARY
```

Особенно проверить:

```text
D8 audit prompts
D8 reconciliation prompts
old C-track prompts
old roadmap consolidation prompts
```

Исполненный prompt не должен выглядеть как ещё не начатый active task.

---

# 17. REPORTS

Reports сохранить как evidence/history, если они подтверждают принятые решения.

Не удалять accepted reports только потому, что они устарели как "current plan".

При необходимости добавить ясную пометку:

```text
HISTORICAL / EVIDENCE
```

только если repository convention это допускает.

Не менять содержательный результат historical report задним числом.

---

# 18. DUPLICATE / SUPERSEDED DOCUMENTS

Для каждого duplicate выбрать:

```text
KEEP CANONICAL
ARCHIVE
DELETE
```

### DELETE допустим только если:

- это точно duplicate;
- нет уникального evidence;
- нет inbound references;
- его содержание полностью покрыто canonical source;
- удаление не уничтожает исторический decision trail.

### ARCHIVE предпочтительнее DELETE,

если документ содержит исторически значимое решение.

---

# 19. ORPHANED DOCUMENTS

Найти документы, на которые:

- нет ссылок;
- они не являются canonical;
- не являются accepted evidence;
- не являются active prompt.

Классифицировать.

Не считать "нет ссылок" достаточным доказательством, что документ можно удалять.

---

# 20. LINKS / REFERENCES

После proposed cleanup обязательно проверить:

```text
Markdown links
relative paths
document references
report references
prompt references
README links
```

Запрещены broken references к удалённым docs.

Особенно проверить ссылки на:

```text
roadmap
architecture
reports
prompts
canonical contracts
```

---

# 21. FILENAME POLICY

Не создавать десятки "final", "final2", "latest", "new-final".

Новая canonical версия должна иметь стабильное имя.

Запрещённые patterns для новых canonical docs:

```text
final2
latest
new
new2
copy
backup
old-final
final-final
```

Исторические filenames не нужно переименовывать массово без необходимости.

---

# 22. MASTER ROADMAP CLEANUP

После выбора canonical roadmap:

1. сделать его единственным active roadmap;
2. убрать conflicting active roadmap documents;
3. исторические versions перевести в history/archive, если нужно;
4. устранить conflicting TRUE NEXT;
5. зафиксировать authority;
6. добавить дату/статус revision при существующем convention;
7. не создавать новый roadmap, если существующий можно canonize.

---

# 23. ARCHITECTURE CLEANUP

Для архитектурных документов:

- сохранить accepted canonical contracts;
- устранить competing "current" versions;
- stale architecture не оставлять рядом без статуса;
- historical ADRs не переписывать;
- superseded docs явно отделить.

---

# 24. НЕ СОЗДАВАТЬ НОВЫЕ АРХИТЕКТУРНЫЕ РЕШЕНИЯ

Эта стадия не предназначена для:

- нового RBAC;
- нового Department model;
- нового temporal model;
- нового Finance model;
- нового Product model;
- нового lifecycle;
- нового workspace model.

Если документальная inconsistency показывает, что архитектурное решение отсутствует:

```text
OPEN GOVERNANCE DECISION
```

Не придумывать решение ради закрытия документа.

---

# 25. ОБЯЗАТЕЛЬНАЯ PROPOSED DOCUMENT MAP

До изменений сформировать в рабочем отчёте:

```text
CANONICAL
  <path> — reason

CANONICAL SUPPORTING
  <path> — reason

ACTIVE
  <path> — reason

HISTORICAL / EVIDENCE
  <path> — reason

SUPERSEDED
  <path> — reason

DELETE
  <path> — reason
```

И показать:

```text
before count
after count
deleted count
archived/moved count
canonical count
active count
```

---

# 26. EXECUTION

После inventory + proposed map:

### Разрешено

- переместить docs;
- удалить безопасные duplicates;
- добавить/исправить статусные headers;
- обновить canonical roadmap;
- обновить canonical architecture documents;
- исправить broken links;
- устранить явный documentation drift;
- обновить references на moved files;
- создать один governance report.

### Запрещено

- production code;
- schema;
- migrations;
- APIs;
- permissions;
- tests;
- business logic;
- новая roadmap stage;
- новый architecture contract;
- D8 implementation.

---

# 27. REVIEW GATE ПЕРЕД COMMIT

Перед commit выполнить:

```text
1. No duplicate active roadmap
2. No conflicting canonical architecture
3. Exactly one current TRUE NEXT (or explicitly unresolved)
4. Historical evidence preserved
5. No broken markdown links
6. No broken canonical references
7. No production source changes
8. No schema changes
9. No RBAC changes
10. No accidental loss of accepted reports
```

Если любой из этих пунктов FAIL:

```text
STOP — do not commit/push
```

---

# 28. GIT SAFETY

Перед изменениями:

```text
BASELINE SHA
git status
tracked changes
untracked files
```

Особенно осторожно обработать:

```text
docs/prompts/TRAVELHUB_MASTER_ROADMAP.md
```

если он существует локально как untracked.

Не автоматически добавлять его в Git.

Сначала определить, является ли он действительно canonical.

---

# 29. COMMIT / PUSH

После успешного review gate:

1. create focused documentation cleanup commit;
2. commit only intended documentation changes;
3. push to `origin/master`;
4. verify remote HEAD;
5. verify clean tracked working tree;
6. classify remaining untracked artifacts.

Не использовать force push.

Не смешивать documentation cleanup с unrelated production changes.

---

# 30. REQUIRED GOVERNANCE REPORT

Создать:

```text
docs/reports/PHASE_3_DOCUMENTATION_GOVERNANCE_CLEANUP_REPORT.md
```

Report должен содержать:

## 30.1 Executive Summary

## 30.2 Baseline Git State

## 30.3 Full Documentation Inventory

## 30.4 Canonical Roadmap Determination

## 30.5 Roadmap Reconciliation

## 30.6 Canonical Architecture Determination

## 30.7 Architecture Reconciliation

## 30.8 Frozen Contract Inventory

## 30.9 Document Conflict Matrix

## 30.10 Documentation ↔ Code Reconciliation

## 30.11 Debt Register Reconciliation

## 30.12 Prompt Classification

## 30.13 Report Classification

## 30.14 Duplicate/Superseded Cleanup

## 30.15 Deletion/Archive Evidence

## 30.16 Link/Reference Validation

## 30.17 Final Canonical Document Map

## 30.18 Final TRUE NEXT

## 30.19 Validation Results

## 30.20 Git Commit/Push Evidence

---

# 31. FINAL CANONICAL STATE

В report должно быть явно:

```text
CANONICAL ROADMAP:
<exact path>

CANONICAL ARCHITECTURE:
<exact path(s)>

CANONICAL CONTRACTS:
<exact path(s)>

ACTIVE DOCUMENTATION:
<count + paths>

HISTORICAL/EVIDENCE:
<count + paths>

SUPERSEDED:
<count + paths>

DELETED:
<count + paths>

FINAL TRUE NEXT:
<exact stage OR UNRESOLVED>
```

---

# 32. TRUE NEXT AFTER CLEANUP

**Не определять следующий implementation stage по предположению.**

После cleanup вычислить TRUE NEXT заново по очищенному canonical documentation set.

Возможные результаты:

```text
TRUE NEXT = D8
TRUE NEXT = another canonical stage
TRUE NEXT = UNRESOLVED
```

Главное — evidence.

Предыдущие D8 reports не имеют права автоматически назначать следующий stage после cleanup.

---

# 33. FINAL VERDICT

Допустимы:

### VERDICT A — DOCUMENTATION GOVERNANCE CLOSED

- canonical roadmap determined;
- architecture hierarchy determined;
- conflicts reconciled;
- duplicates safely removed/archived;
- links valid;
- no production changes;
- cleanup committed;
- pushed;
- GitHub verified;
- TRUE NEXT explicitly determined from final canonical state.

### VERDICT B — CLEANUP COMPLETE WITH OPEN GOVERNANCE DECISION

Документация приведена в порядок, но один или несколько архитектурных/roadmap decisions всё ещё не разрешены.

### VERDICT C — CLEANUP BLOCKED

Нельзя безопасно выбрать canonical document или удалить/архивировать материалы без нового governance decision.

---

# 34. FINAL OUTPUT

Вернуть:

```text
PHASE 3 DOCUMENTATION GOVERNANCE CLEANUP

VERDICT: A / B / C

Canonical Roadmap:
Canonical Architecture:
Canonical Contracts:

Before document count:
After document count:

Canonical:
Active:
Historical/Evidence:
Superseded:
Deleted:

Roadmap conflicts resolved:
Architecture conflicts resolved:
Documentation/code conflicts:
Debt drift reconciled:
Broken links:
Missing references:

FINAL TRUE NEXT:
<stage / UNRESOLVED>

Production code changes:
Schema changes:
RBAC changes:
Business logic changes:

Commit SHA:
Push: PASS/FAIL
HEAD == origin/master:
Tracked clean:
Remaining untracked artifacts:

Report:
docs/reports/PHASE_3_DOCUMENTATION_GOVERNANCE_CLEANUP_REPORT.md
```

---

# 35. STOP CONDITIONS

Немедленно остановиться, если:

- не удаётся определить authority;
- два документа содержат conflicting frozen architecture;
- roadmap ordering зависит от нерешённого architecture decision;
- удаление может уничтожить unique accepted evidence;
- обнаружены неожиданные production changes;
- требуется изменить production code;
- требуется изменить schema;
- требуется изменить RBAC;
- требуется придумать новый business contract.

В таком случае:

```text
STOP
REPORT THE CONFLICT
DO NOT GUESS
DO NOT DELETE
DO NOT PUSH
```

---

# 36. IMPORTANT

Эта стадия имеет приоритет над продолжением текущей D8 ветки.

До её завершения:

```text
D8 implementation = NOT STARTED
D8 implementation prompt = NOT APPROVED
D9 = NOT STARTED
```

После cleanup TRUE NEXT определяется заново исключительно по **финальному canonical repository documentation state**.

Не создавать новый roadmap поверх существующего.
Не создавать новую "master roadmap v2/v3/final".
Не создавать конкурирующую архитектуру.

**Цель — один понятный, проверенный и реально поддерживаемый source of truth.**
