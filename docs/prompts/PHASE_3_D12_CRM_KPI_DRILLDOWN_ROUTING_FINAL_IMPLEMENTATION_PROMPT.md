# PHASE 3 — D12 — CRM / KPI DRILL-DOWN ROUTING
## FINAL IMPLEMENTATION PROMPT

### 1. Режим выполнения

**Stage:** D12 — CRM / KPI Drill-down Routing  
**Mode:** Implementation  
**Current TRUE NEXT:** D12

D12 Scope / Requalification Audit завершён:

```text
D12 READINESS: READY WITH EXPLICIT GAPS
D12 BLOCKERS: none
```

Implementation должна устранить доказанные routing/context gaps и зафиксировать routing contract без расширения scope.

---

# 2. CANONICAL D12 PURPOSE

D12 отвечает за:

```text
KPI
→ drill-down intent
→ canonical route
→ entity identity
→ context propagation
→ target surface
→ server-side authorization
```

D12 не определяет KPI formulas и не меняет KPI/status authority.

### Authorities

```text
D11 = KPI/status semantics
D10 = Partner attribution
D8  = temporal semantics
metric-drilldown.ts = canonical drill-down framework
```

---

# 3. HARD SCOPE

## REQUIRED

### R1 — Booking period propagation

Исправить доказанный defect:

Analytics передаёт:

```text
from
to
preset
fromAnalytics
```

Bookings page сейчас читает только:

```text
dateFrom
dateTo
```

Сделать совместимый fallback по аналогии с Orders:

```text
from → dateFrom
to   → dateTo
```

Предпочтительно:

```typescript
sp.get("from") ?? sp.get("dateFrom") ?? ""
sp.get("to") ?? sp.get("dateTo") ?? ""
```

Не ломать существующие `dateFrom/dateTo` deep-links.

Это mandatory fix.

---

### R2 — Canonical route parameter contract

Установить canonical cross-page analytics drill-down naming:

```text
from
to
preset
fromAnalytics
```

`dateFrom/dateTo` остаются target-page compatibility aliases там, где они уже используются.

Не требуется одномоментно удалить `dateFrom/dateTo`.

Не делать массовый breaking refactor.

---

### R3 — CRM preset preservation

CRM page должна принимать:

```text
preset
```

вместе с `from/to`, когда drill-down приходит из Analytics.

Проверить текущий CRM period state и передать значение без изменения D8 semantics.

Если target UX не отображает preset напрямую, не создавать новый UI только ради его отображения. Главное — не терять canonical context.

---

# 4. ARCHITECTURE DECISIONS — EXPLICIT

Следующие решения относятся к D12 и должны быть реализованы именно так.

## AD-1 — Command Center KPI navigation

### Decision

Command Center KPI cards должны вести на соответствующие **operational / CRM target surfaces**, когда для KPI существует честный canonical destination.

Не отправлять пользователя обратно в Analytics как default drill-down.

### Mapping principle

```text
Orders KPI
→ Orders Center

Bookings KPI
→ Bookings Center

Customer KPI
→ CRM Customers

Partner KPI
→ CRM Partners

Product KPI
→ Product/Catalog surface
```

Конкретный route разрешён только если target существует и его API/security contract подтверждены repository evidence.

### Financial KPIs

Не создавать искусственный destination для:

```text
GMV
Revenue
Refunds
Commission
```

пока Finance detail surface не существует в canonical implementation.

Для них:

```text
destinationType = NONE / DEFERRED
```

если это подтверждено существующим D12/D11 contract.

### Important

Не реализовывать навигацию для KPI, для которых нет честного target.

`NONE` лучше fake drill-down.

---

## AD-2 — Customer 360 period semantics

### Decision

Customer 360 остаётся **entity-level / full-history surface**.

D12 НЕ добавляет period-scoped Customer 360 queries.

Следовательно:

```text
Analytics Customer KPI
→ CRM Customer list
```

может сохранять source period context на list level, но:

```text
Customer list
→ Customer 360
```

не обязан превращать Customer 360 в period-scoped surface.

Не менять Customer 360 backend API только ради передачи периода.

Не добавлять новые period params в Customer 360 detail API.

---

## AD-3 — Parameter naming

### Decision

Canonical cross-page analytics drill-down parameters:

```text
from
to
preset
fromAnalytics
```

Operations targets могут продолжать принимать legacy/current aliases:

```text
dateFrom
dateTo
```

но canonical drill-down producer должен продолжать использовать:

```text
from
to
```

Нельзя создавать третий naming convention.

---

# 5. EXISTING FRAMEWORK

`metric-drilldown.ts` признан canonical shared framework.

Не переписывать его без доказанной необходимости.

Не создавать второй routing framework.

Не дублировать route-generation logic по центрам.

Использовать existing:

```text
MetricDrilldownConfig
resolveDrilldownUrl()
resolveTableCellDrilldown()
```

если текущая implementation покрывает use-case.

---

# 6. ROUTING CONTRACT

Каждый D12-enabled KPI должен иметь:

```text
source KPI
destinationType
target route
entity type
required identifier
period behavior
scope behavior
permission boundary
```

Пример:

```text
Orders
destinationType = DOMAIN_ROUTE
route = /app/orders
period = PERIOD_BOUND
identity = none/list
scope = existing Orders API
```

Для Partner:

```text
destinationType = DETAIL_VIEW
route = /app/crm/partners/{partnerId}
identity = partnerId
period = PERIOD_BOUND
scope = partner server isolation
```

Do not invent destinationType values. Use existing typed contract.

---

# 7. COMMAND CENTER IMPLEMENTATION RULE

Перед изменением Command Center KPI cards:

1. Проверить существующий KPI metadata contract.
2. Найти canonical KPI → destination mapping.
3. Проверить target API.
4. Проверить permissions.
5. Проверить scope.
6. Проверить context propagation.

Для каждой карты сделать explicit mapping.

### Required behavior

Навигация должна быть:

```text
server-safe
typed
deterministic
scope-preserving
```

Не создавать URL вручную в десятках компонентов.

Если возможно, использовать shared routing resolver.

Если target отсутствует или KPI не имеет честного target — оставить `NONE`.

---

# 8. KPI CONTEXT

Для period-bound KPI передавать:

```text
from
to
preset
fromAnalytics=true
```

Для ALL_TIME:

```text
from/to
не передавать
```

Для AS_OF_DATE:

использовать существующий canonical behavior:

```text
to → asOf
```

Не менять semantics `metric-drilldown.ts`.

---

# 9. TARGET PAGE COMPATIBILITY

### Orders

Поддерживать:

```text
from/dateFrom
to/dateTo
```

Existing behavior сохранить.

### Bookings

Добавить:

```text
from/dateFrom
to/dateTo
```

как required compatibility.

### CRM

Поддерживать:

```text
from
to
preset
entitled
tab
```

Не удалять existing params.

### Partner 360

Сохранить:

```text
from
to
preset
fromAnalytics
```

### Payments

Сохранить существующий code-based detail route:

```text
/app/payments/{code}
```

Не переводить Payment на UUID routing.

---

# 10. ENTITY IDENTITY

Сохранить repository-proven patterns:

```text
Order      → UUID
Booking    → UUID
Customer   → UUID
Partner    → UUID
Product    → UUID
Request    → UUID
Payment    → PAY-* business code
```

Не вводить aliases.

Не преобразовывать UUID ↔ business code без explicit contract.

---

# 11. SECURITY

D12 implementation не меняет authorization architecture.

Сохранить:

```text
JwtAuthGuard
PermissionsGuard
domain scope checks
partner actor isolation
```

### Mandatory negative tests

```text
Partner A → Partner B = denied
Unauthorized Customer = denied
Unauthorized Order = denied
Unauthorized Booking = denied
Unauthorized Payment = denied
```

Не использовать frontend-visible entity ID как authorization proof.

Backend remains authority.

---

# 12. CROSS-SCOPE RULE

Не делать automatic scope expansion.

Для каждого drill-down явно определить:

```text
source scope
target scope
```

Допустимый documented shift:

```text
Analytics Marketplace scope
→ operational target's documented Overview scope
```

только если это уже зафиксировано D11 and current API semantics.

Не менять operational Center scope в рамках D12.

---

# 13. DATA / FINANCE BOUNDARY

D12 не реализует:

- Finance Center;
- financial detail surfaces;
- Settlement;
- Payout;
- Refund engine;
- Commission engine.

Для Finance metrics, у которых нет honest target:

```text
destinationType = NONE
deferred
```

Не добавлять fake route to Payments just because it is available.

---

# 14. CUSTOMER 360

Согласно AD-2:

Customer 360 остаётся full-history entity surface.

Не добавлять:

```text
?from=
?to=
?preset=
```

в Customer 360 API semantics.

Если source context присутствует в URL по технической причине, target может его игнорировать; не создавать hidden period semantics.

---

# 15. DOCUMENTATION

Создать/обновить canonical D12 routing contract:

```text
docs/architecture/TRAVELHUB_CRM_KPI_DRILLDOWN_ROUTING.md
```

Содержимое:

## 1. Purpose

## 2. Routing Authority

## 3. Canonical Parameter Contract

## 4. KPI → Target Mapping

## 5. Entity Identity

## 6. Period Context Rules

## 7. Command Center Routing

## 8. Analytics Routing

## 9. CRM Routing

## 10. D10 Integration

## 11. D11 Integration

## 12. Security / Scope

## 13. Finance Boundary

## 14. Deferred Destinations

## 15. Compatibility Aliases

## 16. Change Governance

Документация должна отражать реальную code implementation.

---

# 16. D10 INTEGRATION

D10 remains:

```text
Partner attribution = Order.sellerPartnerId
```

D12 must preserve it.

Partner Performance routes must continue carrying:

```text
partnerId
```

from canonical D10 context.

Do not infer Partner identity from Product in D12.

---

# 17. D11 INTEGRATION

D11 remains authoritative for:

```text
KPI definitions
status semantics
scope semantics
```

D12 consumes these definitions.

D12 must not redefine:

```text
GMV
Revenue
Completed
Cancelled
Refunded
Commission
AOV
Conversion
```

---

# 18. TESTS

## Required unit tests

### Routing

1. Orders KPI resolves canonical Orders route.
2. Bookings KPI resolves canonical Bookings route.
3. Customer KPI resolves CRM Customers route.
4. Partner KPI resolves Partner route.
5. Payment KPI resolves Payments route.
6. Financial deferred KPI resolves NONE.

### Parameters

7. PERIOD_BOUND preserves `from/to/preset`.
8. ALL_TIME does not create false period.
9. AS_OF_DATE preserves existing `asOf`.
10. `fromAnalytics=true` preserved where configured.

### Bookings regression

11. `/app/bookings?from=X&to=Y` initializes `dateFrom/dateTo`.
12. Legacy `/app/bookings?dateFrom=X&dateTo=Y` remains supported.
13. `from` takes precedence over legacy aliases when both exist.

### CRM

14. CRM receives `from/to`.
15. CRM receives `preset`.

### Security

16. Partner A cannot route/access Partner B through manipulated URL.
17. Customer/order/booking/payment target remains server-authorized.

### Command Center

18. Navigable KPI has correct typed destination.
19. Deferred financial KPI remains non-navigable.
20. No KPI produces invalid target route.

---

# 19. INTEGRATION / E2E

Where existing E2E infrastructure permits, test:

```text
Analytics KPI
→ target page
→ expected filters/context
→ backend query
```

At minimum verify:

```text
Analytics → Orders
Analytics → Bookings
Analytics → CRM Customers
Analytics → CRM Partners
Analytics → Payments
Command Center → mapped operational targets
```

And negative access:

```text
Partner A → Partner B
```

---

# 20. BUILD / REGRESSION

Required:

```text
Backend TSC
Frontend build
Relevant unit suites
Relevant E2E suites
D10 regression
D11 regression
D8 regression
```

Existing unrelated failures must be compared with pre-D12 baseline.

Do not label a failure "pre-existing" without evidence.

---

# 21. FAILURE / ERROR HANDLING

Preserve existing behavior for:

```text
404
403
invalid ID
stale ID
missing route target
API failure
```

Do not swallow authorization errors into generic client errors.

Do not redirect unauthorized users to unrelated surfaces.

---

# 22. NO MASS REFACTOR

Implementation should be minimal.

Do NOT:

- rewrite entire Analytics page;
- rewrite entire CRM;
- replace Next.js routing architecture;
- introduce new routing framework;
- rewrite API DTOs unnecessarily;
- rename all query params at once;
- change unrelated KPI formulas;
- change status enums;
- change D10 attribution;
- change D11 semantics.

---

# 23. QUALIFICATION REPORT

Create:

```text
docs/reports/evidence/PHASE_3_D12_CRM_KPI_DRILLDOWN_ROUTING_QUALIFICATION_REPORT.md
```

Required structure:

## 1. Executive Summary

## 2. Baseline

```text
HEAD
ORIGIN
STATUS
```

## 3. Architecture Decisions

Document:

```text
AD-1 Command Center routing
AD-2 Customer 360 full-history
AD-3 Parameter naming
```

## 4. Implementation

List changed files and exact purpose.

## 5. Routing Matrix

## 6. Parameter Propagation Evidence

## 7. Bookings Fix Evidence

## 8. Command Center Evidence

## 9. CRM Evidence

## 10. D10 Regression

## 11. D11 Regression

## 12. D8 Regression

## 13. Security / IDOR Evidence

## 14. Tests

## 15. Build

## 16. Remaining Gaps

## 17. Git Evidence

## 18. Final Verdict

---

# 24. ACCEPTANCE GATES

### Gate A — Routing Contract

```text
canonical routing mapping documented
```

### Gate B — Booking Context

```text
from/to preserved into Bookings Center
legacy dateFrom/dateTo preserved
```

### Gate C — Command Center

```text
every eligible KPI has an explicit target
financial deferred KPIs remain NONE
```

### Gate D — CRM

```text
CRM period/preset context preserved where relevant
Customer 360 remains full-history
```

### Gate E — D10

```text
Partner attribution unchanged
Partner 360 scope preserved
```

### Gate F — D11

```text
KPI/status semantics unchanged
```

### Gate G — D8

```text
temporal semantics unchanged
```

### Gate H — Security

```text
no IDOR
server-side scope preserved
```

### Gate I — Regression

```text
relevant tests/build PASS
```

### Gate J — Git

```text
HEAD == origin/master
working tree clean
```

---

# 25. GAPS POLICY

Non-blocking gaps must be explicitly classified.

Current known non-blocking/deferred items:

```text
Finance drill-downs
Customer 360 period support (not implemented by decision)
Sessions target
other KPI without honest target
```

Do not convert these into hidden implementation scope.

---

# 26. VERDICT

### A — D12 CLOSED

Only when all mandatory gates pass.

### B — VALID SYSTEM FAIL

Implementation is correct but an acceptance gate fails objectively.

### C — ARCHITECTURE DECISION REQUIRED

Only if an implementation-discovered conflict invalidates AD-1/AD-2/AD-3 or reveals a new unresolved canonical decision.

### D — BLOCKED

Required target/dependency unavailable.

---

# 27. FINAL OUTPUT

Agent must finish with:

```text
D12 VERDICT:
CURRENT TRUE NEXT:
FINANCE:
ARCHITECTURE DECISIONS:
CHANGES:
ROUTING CONTRACT:
BOOKINGS CONTEXT:
COMMAND CENTER:
CRM:
D10 REGRESSION:
D11 REGRESSION:
D8 REGRESSION:
SECURITY:
TESTS:
BUILD:
REMAINING GAPS:
NEXT AUTHORIZED ACTION:
```

For Verdict A:

```text
CURRENT TRUE NEXT = D13 — Voucher
FINANCE = NOT STARTED / DEFERRED
```

---

# 28. STOP CONDITION

After qualification report and final verdict:

**STOP.**

Do not begin:

- D13;
- D14;
- STEP 3.12;
- Finance.

Do not change roadmap.

Do not change TRUE NEXT beyond the verified stage transition.
