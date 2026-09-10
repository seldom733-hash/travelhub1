# PHASE 3 — D11 — PROJECT-WIDE KPI / STATUS SEMANTICS
## SCOPE / REQUALIFICATION AUDIT PROMPT

### 1. Режим выполнения

**Stage:** D11 — Project-Wide KPI / Status Semantics  
**Current TRUE NEXT:** D11  
**Mode:** Audit-first / Read-only  
**Goal:** установить точный canonical scope D11, authoritative sources, KPI/status semantics, boundaries, dependencies и implementation readiness.

### КРИТИЧЕСКОЕ ПРАВИЛО

Этот этап **НЕ является implementation**.

До завершения Scope / Requalification Audit запрещено:

- изменять production code;
- менять schema;
- менять API contracts;
- менять frontend;
- менять RBAC;
- создавать новые KPI;
- переопределять status semantics;
- начинать Finance;
- начинать следующий stage.

После audit агент обязан остановиться и выдать report.

---

# 2. Цель D11

D11 должен определить и, только после отдельной реализации, обеспечить:

```text
PROJECT-WIDE KPI / STATUS SEMANTICS
```

D11 — это следующий уровень после D10.

### D10

```text
Partner attribution semantics
```

То есть:

> какому Partner принадлежит конкретный факт/метрика.

### D11

```text
Project-wide KPI/status reconciliation
```

То есть:

> как одна и та же бизнес-сущность, метрика и статус должны интерпретироваться одинаково во всех центрах и поверхностях системы.

D11 не должен повторять D10 и не должен превращаться в общий "Analytics cleanup".

---

# 3. PRIMARY QUESTION

Необходимо установить:

> Что именно является canonical Project-Wide KPI / Status Semantics в текущем TravelHub repository, какие расхождения уже существуют между центрами, где находятся authoritative sources, какие semantics уже frozen, какие ещё являются open/deferred, и какие изменения действительно относятся к D11.

Ответ должен основываться на фактическом repository evidence.

---

# 4. AUTHORITY ORDER

Использовать следующий порядок доверия:

1. Source tree / Git / implemented code.
2. Tests / security contracts / implemented architecture.
3. DB schema / API / DTO / domain contracts.
4. Accepted architecture decisions / ADR.
5. Debt Register / evidence reports.
6. Master Roadmap.
7. Historical prompts/reports.
8. Assumptions.

Если документация расходится с кодом — это discrepancy, а не повод молча переписывать interpretation.

---

# 5. MANDATORY BASELINE

До анализа semantics зафиксировать:

```text
HEAD:
origin/master:
working tree:
diff --check:
current TRUE NEXT:
D10 closure commit:
```

Проверить, что D10 действительно закрыт и repository находится на expected post-D10 state.

Если это невозможно доказать:

```text
D11 = NOT READY
```

и остановиться.

---

# 6. D11 DEFINITION AUDIT

Найти и сопоставить все источники, где D11 определён:

- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
- `TRAVELHUB_MASTER_ROADMAP.md`
- `TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md`
- `COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md`
- relevant ADRs
- Debt Register
- предыдущие D-stage evidence reports
- реализованные KPI/status contracts в code

Нельзя принимать исторический prompt как canonical, если текущий repository его опровергает.

---

# 7. DOMAIN INVENTORY

Провести фактический inventory project-wide domains:

- Orders
- Bookings
- Payments
- Refunds
- Commissions
- Products
- Partners
- Customers / Travelers
- Sales
- CRM
- Analytics
- Operations
- any relevant fulfillment/execution entities
- any finance facts already implemented

Для каждого domain определить:

```text
EXISTS
PARTIAL
NOT STARTED
DEFERRED
```

И отдельно:

```text
canonical model
authoritative source
status field(s)
timestamp(s)
monetary field(s)
current KPI consumers
```

---

# 8. STATUS SEMANTICS AUDIT

Это основной блок D11.

Найти все статусы и transitions для ключевых entities:

### Order

Проверить:

- NEW
- SENT_TO_SUPPLIER
- CONFIRMED
- FULFILLED
- COMPLETED/CLOSED, если существуют
- CANCELLED
- SUPPLIER_REJECTED
- любые другие фактические значения

### Booking

Проверить реальные enum/status values и lifecycle transitions.

### Payment

Проверить реальные financial/payment states.

### Refund

Проверить реальные refund states.

### Commission

Проверить реальные commission states.

### Product

Проверить lifecycle/publication states, если они участвуют в KPI.

Не считать названия из документации доказательством существования enum.

---

# 9. STATUS CANONICALITY MATRIX

Создать matrix:

| Entity | Status | Source enum/model | Used by API | Used by UI | Used by KPI | Canonical? | Evidence |
|---|---|---|---|---|---|---|---|

Определить:

- одинаковые ли статусы имеют одинаковый смысл;
- есть ли synonyms;
- есть ли semantic collisions;
- есть ли status values, которые UI трактует иначе, чем backend;
- есть ли places, где один KPI считает status как "completed", а другой — иначе;
- есть ли lifecycle states, отсутствующие в KPI;
- есть ли derived statuses.

Не нормализовать автоматически на этом этапе.

---

# 10. KPI INVENTORY

Найти все фактически существующие project-wide KPI.

Минимально исследовать:

- Orders
- Bookings
- Completed
- Cancelled
- Fulfilled
- Revenue
- GMV
- Payments
- Refunds
- Commission
- Active Products
- Conversion
- AOV
- Customers
- completion metrics
- operational metrics
- financial metrics
- any Command Center KPIs
- Analytics KPIs
- Sales KPIs
- Booking Center KPIs
- Orders Center KPIs

Для каждого:

```text
KPI name
business definition
source table/entity
source field(s)
aggregation
status inclusion
timestamp
currency
scope
API consumer(s)
UI consumer(s)
authority
```

---

# 11. KPI CONSISTENCY MATRIX

Создать обязательную matrix:

| KPI | Center/Surface | Source | Formula | Status filter | Timestamp | Currency | Authority | Consistent? |
|---|---|---|---|---|---|---|---|---|

Особенно проверить KPI, которые повторяются в нескольких центрах.

Например:

```text
GMV
Revenue
Orders
Bookings
Completed
Cancelled
Refunds
Payments
Commission
Customers
Conversion
AOV
```

Не предполагать, что одинаковое название означает одинаковую semantics.

---

# 12. CROSS-CENTER RECONCILIATION

Проверить как минимум:

### Command Center
↓
### Analytics Center
↓
### Sales Center
↓
### Booking Center
↓
### Orders Center
↓
### CRM
↓
### Finance-related surfaces already implemented

Для каждого повторяющегося KPI проверить:

```text
same source?
same formula?
same status semantics?
same timestamp?
same scope?
same currency treatment?
same period resolver?
same authority?
```

Если нет — зафиксировать discrepancy.

---

# 13. TEMPORAL BOUNDARY

D8 уже закрыт.

D11 должен **использовать**, а не переопределять D8 temporal contract.

Проверить:

- `resolveQueryPeriod()`
- UTC instants
- `[start, endExclusive)`
- server-authoritative period resolution
- business timestamps by metric

Для каждого KPI указать:

```text
timestamp source
semantic reason
D8 compatibility
```

Если два центра используют разные timestamps для одного KPI — это D11 candidate discrepancy.

Но не исправлять.

---

# 14. FINANCIAL BOUNDARY

D11 не является Finance implementation.

Проверить только semantics/reconciliation boundary:

```text
Revenue
Payments
Refunds
Commission
GMV
```

Установить:

- какие факты уже authoritative;
- какие только read/aggregate;
- где Finance authority ещё отсутствует;
- какие financial semantics нельзя "додумать" в D11.

Не создавать:

- Settlement;
- Payout;
- Payment engine;
- Refund engine;
- financial authority.

Finance по завершении audit должен остаться:

```text
NOT STARTED / DEFERRED
```

если repository evidence не доказывает иное.

---

# 15. D10 → D11 BOUNDARY

Обязательно доказать границу:

### D10

```text
Partner-attributed metrics
```

### D11

```text
Project-wide KPI and status reconciliation
```

Проверить:

- что D11 потребляет canonical attribution от D10;
- что D11 не переписывает Partner attribution;
- что D11 не создаёт новую Partner semantics;
- что D11 может сравнивать same KPI across centers.

---

# 16. D11 OUTPUT CANDIDATE

Определить, какой canonical artifact должен появиться после implementation.

Возможные outputs нельзя выбирать заранее.

Исследовать необходимость:

```text
KPI dictionary
status dictionary
canonical semantic contract
shared KPI service
read model
normalization layer
cross-center reconciliation contract
```

Не выбирать архитектуру без repository evidence.

---

# 17. IMPLEMENTATION READINESS

После audit классифицировать D11 только одним из:

### READY FOR IMPLEMENTATION

Есть полный authoritative contract, source authority и implementation path.

### READY WITH EXPLICIT GAPS

Можно реализовать, но есть явно ограниченные non-blocking gaps.

### ARCHITECTURE DECISION REQUIRED

Есть конфликтующие authorities или отсутствует canonical business rule.

### BLOCKED

Есть prerequisite stage/authority, без которого D11 нельзя безопасно реализовать.

---

# 18. BLOCKER ANALYSIS

Проверить зависимости:

- D10 closure
- D8 temporal contract
- Orders lifecycle
- Booking lifecycle
- Payment/Refund semantics
- Analytics Foundation
- Command Center KPIs
- Sales KPIs
- CRM semantics
- Finance boundary
- Product/service model
- DATA-01
- DATA-02
- PROD-01
- any remaining Debt Register entries

Для каждой:

| Dependency | State | Blocks D11? | Why | Evidence |
|---|---|---|---|---|

Не считать dependency blocking только потому, что она open.

---

# 19. CRITICAL QUESTIONS

Audit обязан дать фактические ответы:

1. Есть ли один canonical definition для "Completed"?
2. Одинаково ли трактуется "Cancelled"?
3. Что является canonical source of truth для Order KPI?
4. Что является canonical source of truth для Booking KPI?
5. Revenue во всех центрах строится из одной authority?
6. GMV одинаково рассчитывается во всех центрах?
7. Payment count и Revenue различаются и явно разделены?
8. Refund semantics согласованы?
9. Commission semantics согласованы?
10. одинаков ли business timestamp одного KPI в разных центрах?
11. Есть ли duplicated formulas?
12. Есть ли frontend-owned KPI calculations?
13. Есть ли API endpoints с отличающимися semantics при одинаковых названиях?
14. Есть ли KPI, которые нельзя reconciliate без Finance?
15. Есть ли KPI, которые нельзя reconciliate без PROD-01?
16. Есть ли status conflicts, требующие architecture/business decision?

---

# 20. FRONTEND AUTHORITY AUDIT

Проверить, не рассчитываются ли KPI/status semantics в frontend.

Для каждого major center:

```text
server calculated?
client derived?
hybrid?
```

Если frontend считает KPI самостоятельно:

```text
severity:
HIGH / MEDIUM / LOW
```

Но исправление не выполнять.

---

# 21. API SEMANTICS AUDIT

Сопоставить backend API responses с UI semantics.

Проверить:

- одинаковое поле;
- одинаковое значение;
- одинаковая formula;
- одинаковый status inclusion;
- одинаковый period;
- одинаковый scope.

Особое внимание:

```text
Command Center
Analytics
Sales
Bookings
Orders
CRM
```

---

# 22. DUPLICATION / DRIFT AUDIT

Найти duplicated logic:

```text
same KPI calculated separately
same status interpreted separately
same total calculated in multiple services
same revenue logic repeated
same GMV logic repeated
same completion logic repeated
```

Для каждого:

```text
Location A
Location B
Semantic difference
Risk
Canonical candidate
```

Не рефакторить на этом этапе.

---

# 23. SECURITY / SCOPE

Проверить, что project-wide KPI semantics не нарушают существующие scope boundaries:

- Platform
- Partner
- Workspace
- Marketplace
- Storefront
- Finance
- CRM

Не менять RBAC.

Просто выявить:

```text
scope mismatch
information leakage
incorrect cross-tenant aggregation
```

---

# 24. EVIDENCE REQUIREMENT

Каждое существенное утверждение в report должно иметь evidence:

```text
file
line/range
code symbol
test
schema field
API endpoint
```

Не писать:

> "в системе всё едино"

без конкретного evidence.

Не писать:

> "этот KPI canonical"

если это только предположение.

---

# 25. REQUIRED REPORT

Создать:

```text
evidence/PHASE_3_D11_PROJECT_WIDE_KPI_STATUS_SEMANTICS_SCOPE_AUDIT.md
```

Структура report:

## 1. Executive Summary

## 2. Repository Baseline

## 3. D11 Canonical Definition

## 4. Domain Inventory

## 5. Status Inventory

## 6. Status Canonicality Matrix

## 7. KPI Inventory

## 8. KPI Consistency Matrix

## 9. Cross-Center Reconciliation

## 10. Temporal Semantics

## 11. Financial Boundary

## 12. D10 ↔ D11 Boundary

## 13. Frontend Authority

## 14. API Semantics

## 15. Duplication / Semantic Drift

## 16. Security / Scope

## 17. Dependency Matrix

## 18. Blocking Decisions

## 19. Readiness Verdict

## 20. Recommended Next Action

---

# 26. FINAL VERDICT FORMAT

В конце report обязательно:

```text
D11 READINESS:
CURRENT TRUE NEXT:
FINANCE:
D11 BLOCKERS:
D11 NON-BLOCKING GAPS:
CANONICAL KPI AUTHORITY:
CANONICAL STATUS AUTHORITY:
TEMPORAL AUTHORITY:
D10 ↔ D11:
IMPLEMENTATION SCOPE:
NEXT AUTHORIZED ACTION:
```

---

# 27. STOP CONDITION

После создания Scope / Requalification Audit:

**STOP.**

Запрещено автоматически:

- implementation;
- D12;
- Finance;
- roadmap changes.

Агент должен только вернуть:

```text
D11 READINESS
+
evidence report
+
blocking decisions
+
recommended next action
```

---

# 28. SUCCESS CRITERIA FOR THIS AUDIT

Audit считается выполненным только если:

```text
[ ] D10 closure verified
[ ] D11 canonical definition identified
[ ] domain inventory completed
[ ] status inventory completed
[ ] status canonicality matrix completed
[ ] KPI inventory completed
[ ] KPI consistency matrix completed
[ ] cross-center reconciliation completed
[ ] D8 boundary verified
[ ] Finance boundary verified
[ ] D10/D11 boundary verified
[ ] frontend authority checked
[ ] API semantics checked
[ ] semantic drift/duplication checked
[ ] dependencies checked
[ ] blockers explicitly identified
[ ] implementation readiness classified
[ ] evidence report created
[ ] STOP
```
