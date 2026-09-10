# PHASE 3 — D10 PARTNER PERFORMANCE ATTRIBUTION
## Scope & Dependency Mapping — Audit-First Implementation Preparation

> **MODE:** AUDIT-FIRST / REPOSITORY-FIRST  
> **CURRENT TRUE NEXT:** D10 — Partner Performance Attribution  
> **GOAL:** определить точный канонический scope D10, его source-of-truth, метрики, атрибуцию, зависимости и готовность к implementation.  
> **PRODUCTION IMPLEMENTATION:** ЗАПРЕЩЕНА в этом проходе.

---

# 1. BASELINE

Текущий подтверждённый статус:

```text
D9 = CLOSED / APPROVED
D10 = TRUE NEXT
Finance Center = NOT STARTED / DEFERRED
```

D9 final closure зафиксировал:

```text
D9 → D10 Partner Performance Attribution
```

Не переоткрывать D9 и не проводить повторный D9 audit.

---

# 2. PRIMARY QUESTION

Нужно установить, что именно означает:

```text
D10 — Partner Performance Attribution
```

Не принимать название этапа за готовое техническое ТЗ.

До implementation необходимо доказать:

```text
КТО
↓
какие данные
↓
какие показатели
↓
по какому правилу
↓
атрибутируются
↓
какому Partner
↓
в каком scope
↓
с какой temporal semantics
↓
из какого authoritative source
```

---

# 3. REQUIRED SOURCES

Сначала прочитать:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
docs/prompts/TRAVELHUB_MASTER_ROADMAP.md
docs/architecture/TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md
```

Затем найти и изучить ВСЕ релевантные материалы:

```text
D10
Partner Performance Attribution
Partner Performance
Attribution
partner performance
supplier performance
partner metrics
partner analytics
```

И отдельно:

```text
DATA-01
DATA-02
Analytics
KPI
Sales
Orders
Bookings
Payments
Commission
Settlement
Partner
Supplier
Storefront
Marketplace
```

Исторические prompts/reports использовать только как evidence, а не как новую roadmap authority.

---

# 4. CURRENT IMPLEMENTATION INVENTORY

Построить repository-derived inventory:

```text
Partner entity
Supplier entity
sellerPartnerId
tenant/workspace
Marketplace scope
Storefront scope
Orders
Bookings
Payments
Refunds
Commissions
Settlement
Payout
Analytics read models
existing Partner screens
existing Partner routes
existing Partner APIs
existing Partner KPI endpoints
```

Для каждого указать:

```text
EXISTS
PARTIAL
NOT STARTED
DEFERRED
```

Нельзя предполагать наличие функциональности только потому, что она описана в architecture.

---

# 5. CANONICAL ATTRIBUTION IDENTITY

Определить единственный authoritative key для attribution.

Проверить:

```text
partnerId
sellerPartnerId
supplierId
tenantId
workspaceId
```

Установить:

```text
Partner attribution key = ?
```

Отдельно определить:

```text
Marketplace Partner
Storefront seller
Supplier
Platform actor
```

если система различает эти понятия.

Hard rule:

> Нельзя считать эти сущности одинаковыми без repository evidence.

---

# 6. ATTRIBUTION SEMANTICS

Определить, что именно считается принадлежащим Partner.

Минимум проверить:

```text
Orders
Bookings
Completed bookings
Cancelled bookings
Refunded bookings
Revenue
GMV / Commerce Volume
Payments
Commission
Settlement
Payout
Customers
Conversion
AOV
```

Для каждой метрики установить:

```text
Metric
Source records
Attribution key
Timestamp
Filter
Status rules
Currency semantics
Marketplace / Storefront scope
```

Не создавать новые KPI.

Если существующие KPI отсутствуют — записать:

```text
NOT IMPLEMENTED / NOT DEFINED
```

---

# 7. TEMPORAL SEMANTICS

D8 уже закрыт и не должен быть изменён.

D10 обязан использовать существующие canonical temporal semantics.

Для каждой метрики определить:

```text
business timestamp
event timestamp
createdAt
completedAt
paidAt
refundedAt
cancelledAt
serviceDate
```

Главный вопрос:

> По какой дате Partner получает attribution?

Пример:

```text
Order GMV
→ order/business timestamp

Payment
→ payment occurrence timestamp

Booking completion
→ completion timestamp
```

Не делать вывод по примеру; определить из repository contracts.

---

# 8. STATUS SEMANTICS

Для каждой Partner metric определить status inclusion.

Например:

```text
Draft
Pending
Confirmed
Completed
Cancelled
Refunded
```

Нужно проверить существующие canonical status contracts.

Не изобретать новую status grammar внутри D10.

Если D11 владеет project-wide KPI/status semantics, явно показать границу:

```text
D10 = attribution
D11 = project-wide semantic reconciliation
```

---

# 9. FINANCIAL BOUNDARY

Особенно важно не превратить D10 в скрытый Finance stage.

Проверить:

```text
Revenue
GMV
Commission
Settlement
Payout
Net revenue
Profit
```

Для каждой определить:

```text
может D10 только READ / ATTRIBUTE?
или
требуется Finance authority?
```

Hard rule:

```text
D10 ≠ Finance Center
D10 ≠ Settlement Engine
D10 ≠ Payout Engine
D10 ≠ Commission Engine
```

D10 может CONSUME canonical Finance facts, если они уже существуют.

Не создавать financial authority внутри Analytics/D10.

---

# 10. MARKETPLACE / STOREFRONT SEPARATION

Проверить DATA-02.

Не смешивать:

```text
Marketplace GMV
Storefront Commerce Volume
TravelHub Revenue
```

Для Partner Performance определить:

```text
Marketplace partner performance
Storefront seller performance
```

если оба режима существуют.

Если семантика пока не достаточно определена:

```text
BLOCKING DEPENDENCY
```

а не догадка.

---

# 11. SOURCE → API → UI CHAIN

Построить evidence chain:

```text
Source records
      ↓
Backend domain/query service
      ↓
Attribution calculation
      ↓
API/read model
      ↓
Frontend
```

Для каждой основной Partner metric показать источник.

Запрет:

```text
Frontend calculation authority
```

Frontend только consumer.

---

# 12. PARTNER SCOPE / SECURITY

Проверить:

```text
Platform admin/operator
Partner
Supplier
Storefront owner
```

Для каждого определить:

```text
what they may see
what they may not see
tenant boundary
partner boundary
cross-partner visibility
```

Особенно проверить:

```text
Partner A
→ cannot see Partner B private performance data
```

Не менять RBAC в этом audit.

---

# 13. EXISTING SCREENS / UI OWNERSHIP

Найти существующие:

```text
Partner Performance
Partner Analytics
Partner Dashboard
Partner Workspace
Analytics pages
Command Center
Sales Center
Finance Center
```

Определить canonical ownership:

```text
где будет отображаться D10?
```

Не создавать новый center автоматически.

Если D10 должен быть аналитической/read surface:

```text
document exact route/section
```

Если ownership не определён:

```text
ARCHITECTURE DECISION REQUIRED
```

---

# 14. DEPENDENCIES

Построить dependency matrix для D10:

| Dependency | State | Blocks D10? | Evidence |
|---|---|---|---|
| Partner identity | | | |
| Order attribution | | | |
| Booking attribution | | | |
| Payment facts | | | |
| Commission facts | | | |
| Analytics read model | | | |
| KPI semantics | | | |
| D8 temporal contract | | | |
| DATA-01 | | | |
| DATA-02 | | | |
| PROD-01 | | | |
| Finance | | | |
| RBAC | | | |

Не считать dependency blocking без evidence.

---

# 15. D10 ↔ D11 BOUNDARY

Отдельно установить границу:

```text
D10 Partner Performance Attribution
        vs
D11 Project-Wide KPI/Status Semantics + Total Reconciliation
```

Нужно исключить дублирование.

Ожидаемый принцип:

```text
D10
= attribution semantics

D11
= cross-project KPI/status reconciliation
```

Но это должно быть подтверждено repository/roadmap evidence.

---

# 16. D10 ↔ FINANCE BOUNDARY

Отдельно установить:

```text
D10
      ↓ consumes
canonical financial facts
      ↓
Finance
```

а не:

```text
D10
      ↓ creates
financial authority
```

Показать какие D10 metrics можно реализовать из уже существующих facts без запуска Finance Center.

---

# 17. READINESS CLASSIFICATION

После audit классифицировать D10:

```text
READY FOR IMPLEMENTATION
```

только если:

```text
scope defined
+
attribution identity defined
+
metrics defined
+
source authority defined
+
temporal semantics defined
+
security scope defined
+
UI ownership defined
+
dependencies satisfied
```

Иначе:

```text
READY WITH EXPLICIT GAPS
```

или:

```text
ARCHITECTURE DECISION REQUIRED
```

---

# 18. NO IMPLEMENTATION

В этом проходе запрещено:

```text
production code
frontend code
backend code
schema
migration
RBAC changes
new API
new KPI logic
new database tables
new Finance capabilities
```

Также запрещено:

```text
D10 implementation
```

до утверждения точного scope.

---

# 19. REQUIRED REPORT

Создать:

```text
docs/reports/PHASE_3_D10_PARTNER_PERFORMANCE_ATTRIBUTION_SCOPE_AUDIT.md
```

Структура:

```text
# PHASE 3 — D10 Partner Performance Attribution Scope Audit

## 1. Executive Summary
## 2. Current Repository State
## 3. D10 Canonical Definition
## 4. Attribution Identity
## 5. Attribution Semantics
## 6. Metric Matrix
## 7. Temporal Semantics
## 8. Status Semantics
## 9. Marketplace / Storefront Separation
## 10. Financial Boundary
## 11. Source → API → UI Chain
## 12. Security / Scope
## 13. UI Ownership
## 14. Dependency Matrix
## 15. D10 vs D11 Boundary
## 16. D10 vs Finance Boundary
## 17. Readiness
## 18. Gaps / Decisions Required
## 19. Recommendation
```

---

# 20. REQUIRED METRIC MATRIX

Report at least:

| Metric | Source | Partner key | Timestamp | Status filter | Currency | Scope | Authority |
|---|---|---|---|---|---|---|---|
| Orders | | | | | | | |
| Bookings | | | | | | | |
| Completed Bookings | | | | | | | |
| GMV / Commerce Volume | | | | | | | |
| Revenue | | | | | | | |
| Payments | | | | | | | |
| Refunds | | | | | | | |
| Commission | | | | | | | |
| Customers | | | | | | | |
| AOV | | | | | | | |
| Conversion | | | | | | | |

If a metric is not canonical for D10, mark:

```text
OUT OF SCOPE
```

Do not invent it.

---

# 21. FINAL DECISION

Return exactly one:

```text
D10 READINESS: READY FOR IMPLEMENTATION
```

or

```text
D10 READINESS: READY WITH EXPLICIT GAPS
```

or

```text
D10 READINESS: ARCHITECTURE DECISION REQUIRED
```

Then:

```text
CURRENT TRUE NEXT:
D10 — Partner Performance Attribution

FINANCE:
NOT STARTED / DEFERRED

D10 BLOCKERS:
...

D10 NON-BLOCKING GAPS:
...

D10 IMPLEMENTATION SCOPE:
...

D10 ↔ D11:
...

D10 ↔ FINANCE:
...

RECOMMENDED NEXT ACTION:
...
```

---

# 22. STOP RULE

After the scope audit report:

```text
STOP.
```

Do NOT automatically start implementation.

Do NOT start Finance.

Do NOT start D11.

Do NOT alter TRUE NEXT.

The only purpose of this stage is to turn:

```text
"D10 — Partner Performance Attribution"
```

from a roadmap label into a precise, repository-backed implementation contract.
