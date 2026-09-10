# PHASE 3 — D11 — PROJECT-WIDE KPI / STATUS SEMANTICS
## FINAL IMPLEMENTATION PROMPT

### 1. Режим выполнения

**Stage:** D11 — Project-Wide KPI / Status Semantics  
**Mode:** Implementation  
**Current TRUE NEXT:** D11

D11 Scope / Requalification Audit завершён с классификацией:

```text
D11 READINESS: READY WITH EXPLICIT GAPS
D11 BLOCKERS: none
```

Зафиксированная цель implementation:

```text
1. KPI dictionary
2. Cross-center KPI/status semantics documentation
3. DATA-01 residual verification
4. Qualification evidence
```

Implementation должна быть evidence-driven и максимально локальной.

---

# 2. CANONICAL D11 DEFINITION

D11 отвечает за:

```text
PROJECT-WIDE KPI / STATUS RECONCILIATION
```

D11 устанавливает единый semantic contract для повторяющихся KPI и status meanings между центрами и API/UI surfaces.

### D10 boundary

```text
D10 = Partner attribution semantics
D11 = Project-wide KPI/status semantics
```

D11 потребляет canonical attribution semantics D10.

D11 не переоткрывает и не изменяет D10 attribution authority.

---

# 3. CANONICAL AUTHORITIES

По результатам D11 Scope Audit:

### KPI authority

```text
AnalyticsService.getCompanyKpi()
```

Использовать его как canonical company KPI authority там, где audit подтвердил соответствующий KPI contract.

### Status authority

```text
Prisma schema enums
```

Не создавать параллельный status enum или frontend status authority.

### Temporal authority

```text
D8
resolveQueryPeriod()
UTC instants
[start, endExclusive)
server-authoritative period resolution
```

Не переопределять D8.

### Important scope distinction

Orders/Bookings Centers могут иметь собственные Overview aggregates с более широким acquisition-source scope, в то время как Analytics использует Marketplace-specific scope.

Это было квалифицировано как intentional scope difference, а не discrepancy.

**Не унифицировать эти scopes искусственно.**

---

# 4. IMPLEMENTATION OBJECTIVES

Реализовать только следующие обязательные objectives:

## O1 — Canonical KPI Dictionary

Создать canonical documentation/artifact, который определяет для каждого supported project-wide KPI:

- название;
- business meaning;
- authoritative source;
- formula/aggregation;
- status inclusion;
- business timestamp;
- currency semantics;
- scope;
- owning domain/service;
- consuming centers;
- known intentional variations.

## O2 — Cross-Center Semantic Contract

Документально зафиксировать:

```text
Command Center
Analytics Center
Sales Center
Booking Center
Orders Center
CRM
Finance-related existing surfaces
```

и определить для повторяющихся KPI:

```text
same meaning?
same source?
same formula?
same status semantics?
same timestamp?
same currency?
same scope?
intentional difference?
```

## O3 — Status Semantic Contract

Зафиксировать canonical meaning существующих core statuses.

Не создавать новые statuses.

Не менять lifecycle transitions без отдельного architecture/business decision.

## O4 — DATA-01 residual verification

Проверить оставшийся DATA-01 residual, выявленный Scope Audit.

Если residual:

```text
non-blocking
```

документировать evidence и follow-up.

Если обнаружен hidden blocker, остановить implementation и изменить verdict на blocked/architecture decision.

## O5 — Evidence

Создать qualification report с фактическими test/build/git evidence.

---

# 5. НЕ МЕНЯТЬ БИЗНЕС-ЛОГИКУ БЕЗ ДОКАЗАННОЙ НЕОБХОДИМОСТИ

Это центральное правило D11.

Scope Audit установил, что текущая система в целом уже использует canonical KPI implementation и что apparent duplications являются intentional scope/presentation differences.

Следовательно:

> Не рефакторить существующие KPI просто ради "единого места".

> Не заменять рабочие queries на AnalyticsService только ради унификации.

> Не менять KPI formulas, если audit не доказал semantic conflict.

> Не менять status transitions, если отсутствует конкретный confirmed inconsistency.

---

# 6. KPI DICTIONARY SCOPE

Минимально исследовать и документировать:

```text
Orders
Bookings
Completed
Cancelled
Fulfilled
GMV
Revenue
Payments
Refunds
Commission
Active Products
Customers
Conversion
AOV
Completion metrics
Operational KPIs
Financial KPIs
```

Для каждого KPI указать:

```text
KPI
Definition
Authority
Source
Formula
Status semantics
Timestamp
Currency
Scope
Consumers
Intentional variation
```

### Critical rule

Если KPI существует только на одном surface и не является project-wide semantic contract — не объявлять его project-wide canonical KPI без evidence.

---

# 7. STATUS DICTIONARY

Document canonical statuses for at least:

### Order

Использовать реальные values repository.

### Booking

Использовать реальные values repository.

### Payment

Использовать реальные values repository.

### Refund

Использовать реальные values repository.

### Commission

Использовать реальные values repository.

### Request

Использовать реальные values repository.

Не придумывать enum values.

Не переименовывать existing enum values.

Не заменять technical enum names на новые canonical names без отдельного decision.

---

# 8. STATUS SEMANTICS

Для каждого core status определить:

```text
technical value
business meaning
lifecycle position
terminal/non-terminal
KPI inclusion/exclusion
API exposure
UI label
```

Особенно проверить:

```text
COMPLETED
CANCELLED
FULFILLED
CONFIRMED
REJECTED
REFUNDED
PAID
FAILED
```

если такие фактические statuses существуют.

### Important

D11 reconciles meaning.

D11 не invents a new lifecycle.

---

# 9. KPI FORMULA RULES

При документировании formula различать:

```text
raw fact
aggregate
derived KPI
presentation value
```

Например:

```text
Order count
Booking count
GMV
Revenue
Completion Rate
```

Не считать display formatting частью business formula.

Не переносить business formula в frontend.

---

# 10. COMMAND CENTER ↔ ANALYTICS CENTER

Проверить и документировать:

```text
Command Center + Analytics Center
→ AnalyticsService.getCompanyKpi()
```

Зафиксировать common authority.

Для каждого KPI отметить, где есть intentional presentation differences.

Нельзя устранять presentation differences через business logic changes.

---

# 11. ORDERS / BOOKINGS CENTER BOUNDARY

Обязательно сохранить evidence-backed distinction:

```text
Orders / Bookings Overview:
DB groupBy aggregates
Overview scope
all acquisition sources
```

против:

```text
Analytics:
company KPI / analytics semantics
Marketplace-specific scope where defined
```

Это не считать discrepancy автоматически.

Документация должна ясно объяснять:

```text
same KPI name ≠ same business scope
```

если это подтверждено repository evidence.

---

# 12. SALES / CRM

Проверить Sales и CRM surfaces на повторяющиеся KPI.

Для каждого обнаруженного повторения определить:

```text
same metric?
same authority?
different scope?
different purpose?
presentation-only variation?
actual semantic conflict?
```

Если conflict отсутствует — только документировать.

Если conflict доказан — зафиксировать как D11 gap.

---

# 13. D10 CONSUMPTION

D11 должен ссылаться на уже закрытую D10 attribution contract:

```text
Partner Performance
→ canonical Partner attribution
→ Order.sellerPartnerId
```

Не менять Partner Performance implementation.

Не возвращаться к:

```text
Booking → Product.partnerId
```

как historical seller attribution.

---

# 14. FINANCE BOUNDARY

D11 не реализует Finance.

Запрещено:

- Settlement;
- Payout;
- new financial authority;
- payment engine;
- refund engine;
- financial rule engine;
- commission rule redesign.

Разрешено:

```text
document/reconcile existing financial KPI semantics
```

Finance остаётся:

```text
NOT STARTED / DEFERRED
```

если repository evidence не доказывает обратное.

---

# 15. FRONTEND AUTHORITY

Frontend должен оставаться consumer.

Допустимы только:

```text
display transformation
formatting
sorting/pagination
```

Business KPI calculations должны оставаться server-side.

Если обнаружена frontend business calculation:

```text
document it
```

Но не переносить её автоматически, если это не подтверждённый D11 blocker.

---

# 16. API SEMANTICS

Для major KPI endpoints проверить:

```text
source
formula
status filter
timestamp
scope
authority
```

Обеспечить отсутствие semantic contradiction между:

```text
API response
backend calculation
UI interpretation
```

Не менять API contract, если existing contract уже соответствует canonical semantics.

---

# 17. DOCUMENTATION ARTIFACT

Создать canonical D11 semantic contract, предпочтительно:

```text
docs/architecture/TRAVELHUB_PROJECT_WIDE_KPI_STATUS_SEMANTICS.md
```

Документ должен содержать:

## 1. Purpose

## 2. KPI Authority Model

## 3. Status Authority Model

## 4. Temporal Authority

## 5. Currency Semantics

## 6. KPI Dictionary

## 7. Status Dictionary

## 8. Cross-Center Matrix

## 9. Intentional Scope Differences

## 10. D10 Boundary

## 11. Finance Boundary

## 12. DATA-01 Residual

## 13. Ownership / Change Governance

## 14. Known Gaps

---

# 18. GOVERNANCE RULE

Добавить в документ правило:

> Existing canonical KPI/status semantics MUST NOT be changed by an individual center without updating the project-wide semantic contract and providing evidence for the change.

Любая future change должна указывать:

```text
authority
affected centers
affected APIs
affected KPIs
migration impact
```

Не вводить новую governance system.

---

# 19. TESTS

D11 implementation не должен снижать existing test coverage.

Минимальные проверки:

### KPI consistency

1. Company KPI canonical source still works.
2. KPI dictionary matches implementation.
3. Repeated KPI definitions match documented authority.
4. Intentional scope differences remain intact.

### Status consistency

5. Existing enums remain unchanged.
6. Core status meanings match lifecycle contract.
7. No API/UI semantic contradiction.

### Temporal

8. D8 tests/regression remain PASS.

### D10

9. Partner attribution regression remains PASS.

### Security

10. Existing RBAC tests remain PASS.

### Build

11. Backend TSC PASS.
12. Frontend build PASS.

### Regression

13. Relevant existing suites PASS.
14. Pre-existing unrelated failures remain unchanged and are explicitly listed.

---

# 20. STATIC / TEXTUAL CONSISTENCY CHECK

Проверить:

- no duplicated competing KPI dictionary;
- no duplicated project-wide status dictionary;
- no stale D10 semantics;
- no documentation claiming `Product.partnerId` is historical Partner attribution;
- no documentation claiming D11 owns Finance implementation;
- no documentation claiming Orders/Bookings Overview and Analytics must have identical scope.

---

# 21. DATA-01 RESIDUAL

Обязательно найти exact DATA-01 residual from Scope Audit.

Determine:

```text
current state
exact affected artifact(s)
why non-blocking
whether documentation closes it
whether future implementation required
```

Не объявлять DATA-01 CLOSED, если evidence этого не поддерживает.

---

# 22. QUALIFICATION REPORT

Создать:

```text
docs/reports/evidence/PHASE_3_D11_PROJECT_WIDE_KPI_STATUS_SEMANTICS_QUALIFICATION_REPORT.md
```

Структура:

## 1. Executive Summary

## 2. Repository Baseline

```text
HEAD
ORIGIN
STATUS
```

## 3. Implemented Scope

## 4. KPI Dictionary Evidence

## 5. Status Dictionary Evidence

## 6. Cross-Center Consistency Evidence

## 7. Intentional Scope Differences

## 8. D8 Verification

## 9. D10 Regression

## 10. DATA-01 Residual

## 11. Finance Boundary

## 12. Tests

## 13. Build

## 14. Remaining Gaps

## 15. Git Evidence

## 16. Final Verdict

---

# 23. VERDICT

Допустимые verdict:

### A — D11 CLOSED

Только если:

- canonical semantic contract exists;
- KPI dictionary matches implementation;
- status semantics are documented from authoritative sources;
- cross-center semantics are reconciled;
- DATA-01 residual is explicitly handled/documented;
- tests/build pass;
- no blocking semantic contradiction remains;
- git is clean/synchronized.

### B — VALID SYSTEM FAIL

Если implementation корректна, но mandatory acceptance gate objectively fails.

### C — ARCHITECTURE DECISION REQUIRED

Если conflict between authoritative sources requires business/architecture decision.

### D — BLOCKED

Если prerequisite отсутствует.

---

# 24. GIT REQUIREMENTS

Перед final verdict:

```text
git status
git diff --check
git log -1
git rev-parse HEAD
git rev-parse origin/master
```

Обязательное состояние для Verdict A:

```text
HEAD == origin/master
working tree clean
```

Разрешены untracked prompt artifacts только если они не являются частью repository implementation scope; report должен явно указать их.

---

# 25. STOP CONDITION

После qualification report:

**STOP.**

Не начинать:

- D12;
- Finance;
- Step 3.12;
- следующий implementation stage.

Не менять roadmap.

Не менять TRUE NEXT.

Финальный response агента должен содержать:

```text
D11 VERDICT:
CURRENT TRUE NEXT:
FINANCE:
CHANGES:
KPI AUTHORITY:
STATUS AUTHORITY:
TEMPORAL AUTHORITY:
DATA-01:
TESTS:
BUILD:
REMAINING GAPS:
NEXT AUTHORIZED ACTION:
```

---

# 26. DEFINITION OF DONE

```text
[ ] D10 closure verified
[ ] KPI authority documented
[ ] status authority documented
[ ] temporal authority preserved
[ ] KPI dictionary created
[ ] status dictionary created
[ ] cross-center consistency documented
[ ] intentional scope differences documented
[ ] D10 boundary preserved
[ ] Finance boundary preserved
[ ] DATA-01 residual verified
[ ] frontend authority checked
[ ] API semantics checked
[ ] regression tests pass
[ ] backend TSC pass
[ ] frontend build pass
[ ] qualification report created
[ ] HEAD == origin/master
[ ] working tree clean
[ ] STOP
```
