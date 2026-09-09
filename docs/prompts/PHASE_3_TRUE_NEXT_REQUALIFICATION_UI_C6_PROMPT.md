# PHASE 3 --- TRUE NEXT REQUALIFICATION --- UI-C6

## 1. Purpose

Этот prompt предназначен исключительно для **current TRUE NEXT
requalification** после принятого SEC-UI-01 roadmap reconciliation
decision.

Он НЕ выполняет UI-C6.

Он НЕ изменяет код.

Он НЕ закрывает SEC-UI-01.

Он НЕ является UI-C6 qualification report.

Цель:

> Проверить, что после устранения sequencing ambiguity действительно
> существует единственный canonical TRUE NEXT, и что им является UI-C6.

------------------------------------------------------------------------

# 2. Mandatory Baseline

Repository:

``` text
https://github.com/seldom733-hash/travelhub1
```

Reconciliation baseline:

``` text
d6aebb90182e54f45d1dd8090318542fcc7f26c0
```

Перед audit обязательно проверить фактический текущий Git state:

``` bash
git rev-parse HEAD
git rev-parse origin/master
git status --porcelain=v1
git diff --check
```

Ожидается clean repository и отсутствие функциональных изменений, кроме
explicitly authorized roadmap/debt-register reconciliation.

Если baseline/state не совпадает или обнаружены неожиданные source
changes:

``` text
STOP
```

------------------------------------------------------------------------

# 3. Canonical State To Verify

Audit должен независимо подтвердить следующие факты.

``` text
UI-C4 = ACCEPTED
UI-C5 = ACCEPTED

SEC-UI-01 = OPEN
SEC-UI-01 planned closure stage = UI-C6

UI-C6 = NOT STARTED
UI-C7 = NOT STARTED

D8 = NOT STARTED
Finance Center = NOT STARTED / DEFERRED
PROD-01 = OPEN / DEFERRED
PAY-01 = FUTURE
```

Не считать ни один пункт истинным только потому, что он присутствует в
этом prompt.

Каждый существенный пункт должен быть подтверждён repository evidence.

------------------------------------------------------------------------

# 4. Scope

Проверить:

1.  accepted stage history;
2.  current canonical roadmap;
3.  current Debt Register;
4.  SEC-UI-01;
5.  UI-C6 sequencing;
6.  UI-C7 dependency;
7.  D8 status;
8.  Finance Center status;
9.  PROD-01;
10. PAY-01;
11. другие открытые NOW / P0 / P1 blockers;
12. explicit dependencies that could supersede UI-C6.

Не выполнять:

-   implementation;
-   refactoring;
-   schema changes;
-   UI changes;
-   backend changes;
-   debt closure;
-   test fixes unrelated to audit;
-   roadmap redesign beyond verifying the already-approved
    reconciliation decision.

------------------------------------------------------------------------

# 5. Authority Order

При конфликте источников использовать следующую иерархию:

1.  фактический Git state;
2.  latest accepted qualification reports;
3.  canonical architecture / lifecycle contracts;
4.  current Debt Register;
5.  approved roadmap reconciliation decision;
6.  implementation prompts;
7.  historical reports;
8.  working drafts.

Если конфликт нельзя однозначно разрешить:

``` text
VERDICT = BLOCKED
TRUE NEXT = NOT PROVABLE
STOP
```

Не выбирать документ только по принципу "он новее" без проверки его
governance status.

------------------------------------------------------------------------

# 6. Historical vs Current State

Обязательно различить:

### Historical

Старый report, где:

``` text
TRUE NEXT = UI-C4
```

является final report своего baseline.

Его нельзя переписывать или использовать как current TRUE NEXT.

### Current

После принятия reconciliation:

``` text
UI-C4 = ACCEPTED
UI-C5 = ACCEPTED
SEC-UI-01 = OPEN
closure stage = UI-C6
```

Требуется проверить именно current state.

------------------------------------------------------------------------

# 7. SEC-UI-01 Verification

Проверить фактическую запись в:

``` text
docs/TRAVELHUB_DEBT_REGISTER.md
```

Требуется:

``` text
SEC-UI-01
Status: OPEN
Planned closure stage: UI-C6
```

Особенно проверить, что reconciliation не изменил:

``` text
Status = OPEN
```

в:

``` text
CLOSED
```

Если debt оказался CLOSED без принятого UI-C6 qualification:

``` text
STOP
VERDICT = BLOCKED
```

------------------------------------------------------------------------

# 8. UI-C6 Definition

Проверить, что UI-C6 однозначно определён как:

``` text
UI-C6 — Request Server-Authority Remediation
```

Его responsibility:

``` text
server-authoritative Request actions
```

Проверить наличие соответствующего implementation prompt и его alignment
с текущей architecture/security contract.

Prompt existence ≠ stage acceptance.

------------------------------------------------------------------------

# 9. UI-C7 Definition

Проверить, что UI-C7 является:

``` text
UI-C7 — Request UI Migration
```

и зависит от закрытия SEC-UI-01.

Canonical dependency:

``` text
UI-C6
  ↓
SEC-UI-01 CLOSED
  ↓
UI-C7
```

Если UI-C7 может быть выполнен до server-authority remediation согласно
canonical repository contracts:

``` text
STOP
VERDICT = BLOCKED
```

------------------------------------------------------------------------

# 10. Candidate Competition Audit

Необходимо проверить, существует ли другой candidate, который по
canonical roadmap/debt priority должен выполняться раньше UI-C6.

Минимально проверить:

### Security

-   P0/P1 security debts;
-   tenant isolation;
-   server authorization;
-   action authority;
-   RBAC;
-   authentication/security blockers.

### Data / correctness

-   open blocker debts;
-   known integrity blockers;
-   financial correctness blockers.

### Commerce

-   unresolved accepted-stage prerequisite;
-   canonical lifecycle blocker;
-   required dependency for current C-track.

### Roadmap

-   D8;
-   Finance Center;
-   PROD-01;
-   PAY-01;
-   UI-C7;
-   other UI-C stages.

------------------------------------------------------------------------

# 11. Explicit Candidate Matrix

Составить таблицу:

  --------------------------------------------------------------------------------------
  Candidate   Status      Priority           Dependency       Can precede Evidence
                                                              UI-C6?      
  ----------- ----------- ------------------ ---------------- ----------- --------------
  UI-C6       NOT STARTED P1 security        SEC-UI-01        ---         repository
                          remediation                                     

  UI-C7       NOT STARTED dependent          SEC-UI-01 CLOSED NO          repository

  D8          NOT STARTED deferred/current   ---              NO unless   repository
                          roadmap                             proven      

  Finance     NOT STARTED deferred           finance roadmap  NO unless   repository
  Center                                                      proven      

  PROD-01     OPEN /      product-model      Product Model    NO          debt register
              DEFERRED    dependency                                      

  PAY-01      FUTURE      future             Payment          NO          roadmap/debt
                                             Detail/Finance               
                                             work                         

  Other       audit       audit result       audit result     audit       evidence
  blockers    result                                          result      
  --------------------------------------------------------------------------------------

Не ограничиваться этой таблицей: добавить обнаруженные актуальные
blockers.

------------------------------------------------------------------------

# 12. TRUE NEXT Decision Rule

TRUE NEXT может быть установлен только если одновременно выполнены
условия:

### A

``` text
UI-C4 ACCEPTED
UI-C5 ACCEPTED
```

### B

``` text
SEC-UI-01 OPEN
```

### C

``` text
SEC-UI-01 closure stage = UI-C6
```

### D

``` text
UI-C6 is NOT STARTED
```

### E

``` text
UI-C7 depends on SEC-UI-01 CLOSED
```

### F

Нет другого higher-priority unresolved blocker/dependency.

### G

Нет unresolved roadmap contradiction.

### H

Current Git state clean and reconciled.

Только при A--H:

``` text
TRUE NEXT = UI-C6
VERDICT = A — TRUE NEXT PROVEN
```

------------------------------------------------------------------------

# 13. Failure Conditions

Если обнаружено хотя бы одно:

-   SEC-UI-01 снова указывает на UI-C7;
-   SEC-UI-01 unexpectedly CLOSED;
-   UI-C6 уже partially implemented;
-   UI-C7 может legitimately precede UI-C6;
-   существует другой higher-priority blocker;
-   D8 имеет mandatory prerequisite priority выше UI-C6;
-   Finance Center имеет mandatory prerequisite priority выше UI-C6;
-   PROD-01 блокирует текущий C-track;
-   PAY-01 является mandatory prerequisite;
-   conflicting canonical roadmap remains;
-   Git state dirty unexpectedly;
-   accepted stage evidence missing;
-   source authority cannot be determined;

то:

``` text
VERDICT = BLOCKED
TRUE NEXT = NOT PROVABLE
```

Не выбирать UI-C6 "по умолчанию".

------------------------------------------------------------------------

# 14. Required Evidence

Для каждого ключевого вывода предоставить:

-   file path;
-   section/heading;
-   relevant text;
-   Git SHA where applicable.

Не использовать:

``` text
“prompt says so”
```

как единственное доказательство.

Не считать implementation prompt доказательством implementation status.

Не считать Debt Register доказательством debt closure.

Не считать roadmap proposal доказательством accepted stage.

------------------------------------------------------------------------

# 15. Required Final Output

Финальный audit report должен содержать:

## 15.1 Executive Verdict

Одно из:

``` text
VERDICT A — TRUE NEXT PROVEN
TRUE NEXT = UI-C6
```

или:

``` text
VERDICT B — VALID SYSTEM FAIL
```

если система/roadmap корректно показывает failure, но это не ambiguity.

или:

``` text
VERDICT BLOCKED
TRUE NEXT = NOT PROVABLE
```

если evidence недостаточно или остался governance conflict.

------------------------------------------------------------------------

## 15.2 Current State Matrix

  Stage / Debt     Status                   Evidence
  ---------------- ------------------------ ----------
  UI-C4            ACCEPTED                 ...
  UI-C5            ACCEPTED                 ...
  SEC-UI-01        OPEN                     ...
  UI-C6            NOT STARTED              ...
  UI-C7            NOT STARTED              ...
  D8               NOT STARTED              ...
  Finance Center   NOT STARTED / DEFERRED   ...
  PROD-01          OPEN / DEFERRED          ...
  PAY-01           FUTURE                   ...

------------------------------------------------------------------------

## 15.3 Roadmap Dependency

Показать:

``` text
UI-C4 ACCEPTED
      ↓
UI-C5 ACCEPTED
      ↓
SEC-UI-01 OPEN
      ↓
UI-C6
      ↓
SEC-UI-01 CLOSED
      ↓
UI-C7
```

------------------------------------------------------------------------

## 15.4 Candidate Competition

Показать всех кандидатов и объяснить, почему каждый:

-   selected;
-   deferred;
-   blocked;
-   dependent;
-   not applicable.

------------------------------------------------------------------------

## 15.5 Reconciliation Verification

Отдельно подтвердить:

``` text
SEC-UI-01 closure stage = UI-C6
Status = OPEN
```

и отсутствие второго canonical mapping.

------------------------------------------------------------------------

## 15.6 Final TRUE NEXT

Если все условия выполнены:

``` text
╔══════════════════════════════════════╗
║ VERDICT A — TRUE NEXT PROVEN        ║
║                                      ║
║ TRUE NEXT = UI-C6                   ║
║                                      ║
║ UI-C6 = Request Server-Authority    ║
║        Remediation                  ║
╚══════════════════════════════════════╝
```

Если нет:

``` text
VERDICT = BLOCKED
TRUE NEXT = NOT PROVABLE
```

с конкретной причиной.

------------------------------------------------------------------------

# 16. No Implementation Rule

Этот audit является read-only.

Запрещено:

-   менять source;
-   менять schema;
-   менять migrations;
-   менять UI;
-   менять tests;
-   менять Debt Register;
-   менять roadmap;
-   менять stage status.

Исключение:

> Если Debt Register reconciliation ещё не выполнен, audit должен
> остановиться и зафиксировать, что prerequisite governance action
> отсутствует.

В таком случае не исправлять его самостоятельно.

------------------------------------------------------------------------

# 17. Report Path

После выполнения audit подготовить:

``` text
docs/reports/PHASE_3_TRUE_NEXT_REQUALIFICATION_UI_C6_REPORT.md
```

Report должен быть committed only after qualification is complete.

------------------------------------------------------------------------

# 18. Git Closure

После создания final report:

``` bash
git status --porcelain=v1
git diff --check
git rev-parse HEAD
git rev-parse origin/master
```

Для final governance report ожидается:

``` text
HEAD == origin/master
worktree clean
diff --check PASS
```

Если report является единственным изменением, выполнить normal
documentation commit и final Git closure.

------------------------------------------------------------------------

# 19. Final Governance Rule

Не смешивать:

``` text
Reconciliation Decision
≠
TRUE NEXT Requalification
≠
UI-C6 Implementation
≠
UI-C6 Qualification
≠
SEC-UI-01 Closure
```

Правильная цепочка:

``` text
ROADMAP RECONCILIATION
        ↓
TRUE NEXT REQUALIFICATION
        ↓
TRUE NEXT = UI-C6
        ↓
UI-C6 IMPLEMENTATION
        ↓
UI-C6 QUALIFICATION
        ↓
SEC-UI-01 CLOSED
        ↓
UI-C7
```

------------------------------------------------------------------------

# 20. STOP Rule

При любом неожиданном domain/security/schema/roadmap contradiction:

``` text
STOP
```

Не компенсировать contradiction предположением.

Не "чинить по пути".

Не считать UI-C6 TRUE NEXT без полного evidence chain.

------------------------------------------------------------------------

# FINAL INSTRUCTION

Выполни только **current TRUE NEXT requalification**.

Не реализуй UI-C6.

Не закрывай SEC-UI-01.

Не меняй roadmap.

Не изменяй historical reports.

Определи единственный canonical TRUE NEXT на актуальном repository state
после reconciliation.

Ожидаемый результат:

``` text
VERDICT A — TRUE NEXT PROVEN
TRUE NEXT = UI-C6
```

но этот результат допустим только при полном подтверждении evidence
chain.
