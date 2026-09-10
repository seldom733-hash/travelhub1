# PHASE 3 — D12 — CRM / KPI DRILL-DOWN ROUTING
## SCOPE / REQUALIFICATION AUDIT PROMPT

### 1. Режим выполнения

**Stage:** D12 — CRM / KPI Drill-down Routing  
**Current TRUE NEXT:** D12  
**Mode:** Audit-first / Read-only

Цель этого этапа:

> Установить точный canonical scope D12, текущую фактическую реализацию drill-down routing, source-of-truth, entity identity, KPI context propagation, access/security boundaries, dependency readiness и implementation requirements.

### КРИТИЧЕСКОЕ ПРАВИЛО

Это **только Scope / Requalification Audit**.

До завершения audit запрещено:

- изменять production code;
- изменять schema;
- менять API contracts;
- менять routing;
- менять frontend;
- менять RBAC;
- создавать новые CRM surfaces;
- создавать новые KPI;
- изменять D10 attribution;
- изменять D11 KPI/status semantics;
- начинать D13;
- начинать Finance.

После создания evidence report агент обязан остановиться.

---

# 2. CANONICAL D12 QUESTION

Ответить на вопрос:

> Что именно означает D12 — CRM / KPI Drill-down Routing — в текущей canonical architecture TravelHub, какие KPI должны вести в какие CRM/entity surfaces, какие параметры должны переноситься из исходного KPI context, какие source-of-truth должны использоваться, какие security/scope rules должны сохраняться, и готова ли система к безопасной implementation D12?

Нельзя считать D12 просто "починить ссылки в UI".

Необходимо исследовать:

```text
KPI
→ context
→ entity identity
→ routing target
→ query/route parameters
→ CRM entity
→ server-side authority
→ scope/RBAC
```

---

# 3. AUTHORITY ORDER

Использовать:

1. Source tree / Git.
2. Tests / security contracts / implemented architecture.
3. API / DTO / schema / domain contracts.
4. Accepted ADRs.
5. Canonical architecture.
6. Debt Register.
7. Master Roadmap.
8. Historical reports/prompts.
9. Assumptions.

Если source code и documentation расходятся:

```text
record discrepancy
```

Не исправлять молча.

---

# 4. BASELINE

Перед анализом зафиксировать:

```text
HEAD:
origin/master:
working tree:
git diff --check:
D11 closure commit:
current TRUE NEXT:
```

Проверить, что D11 действительно закрыт и D12 является текущим TRUE NEXT.

Если это не подтверждено:

```text
D12 = NOT READY
STOP
```

---

# 5. D12 CANONICAL DEFINITION AUDIT

Найти D12 во всех canonical sources:

- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
- `TRAVELHUB_MASTER_ROADMAP.md`
- `TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md`
- Commerce lifecycle contract
- ADRs
- Debt Register
- D10 qualification
- D11 semantic contract
- CRM architecture documentation

Установить:

```text
D12 purpose
scope
expected surfaces
expected routing targets
dependencies
explicit exclusions
```

Не invent routing behavior, которого нет в source.

---

# 6. CURRENT ROUTING INVENTORY

Исследовать все существующие KPI-driven navigation / drill-down flows:

### Command Center

Проверить KPI cards и links:

```text
Orders
Bookings
Revenue
GMV
Payments
Refunds
Commission
Customers
Products
Partners
other KPI
```

Для каждого:

```text
source component
route
query params
entity id
period params
scope params
```

### Analytics Center

Проверить:

- Company KPI
- Partner Performance
- other Analytics KPI
- drill-down links

### Sales Center

Проверить KPI → Sales/CRM routing.

### Orders Center

Проверить:

- order count
- revenue
- status metrics
- links to order/entity details

### Bookings Center

Проверить:

- bookings KPI
- completed
- cancelled
- routing to booking/order/customer/partner

### CRM

Проверить:

- customer 360
- partner 360
- order-related CRM surfaces
- booking-related CRM surfaces
- route parameter contracts

---

# 7. ROUTING MATRIX

Создать mandatory matrix:

| KPI / Source | Current Route | Target Entity | Required ID | Period Params | Scope Params | Server Authority | Status |
|---|---|---|---|---|---|---|---|

Для каждого routing flow определить:

```text
EXISTS
PARTIAL
BROKEN
NOT STARTED
DEFERRED
```

Не считать route "working" только потому, что URL существует.

Проверить target page/API фактически.

---

# 8. ENTITY IDENTITY

Определить canonical identifiers:

### Order

```text
orderId
```

### Booking

```text
bookingId
```

### Customer / Traveler

```text
customerId / travelerId
```

### Partner

```text
partnerId
```

### Product

```text
productId
```

Проверить реальные repository names.

Особенно установить:

- где ID immutable;
- где aliases/code используются;
- где route принимает UUID vs public code;
- где ID преобразуется;
- где unsafe client-provided ID используется.

---

# 9. KPI → ENTITY SEMANTICS

Для каждого KPI определить:

> Какой entity является правильным drill-down target?

Примеры для проверки, не для автоматического принятия:

```text
Orders KPI → Orders Center
Bookings KPI → Bookings Center
Revenue KPI → financial/order evidence surface
Partner KPI → Partner 360
Customer KPI → Customer 360
Product KPI → Product surface
```

Но canonical destination должен быть подтверждён repository evidence.

Не проектировать новую destination только потому, что существующая "неидеальна".

---

# 10. KPI CONTEXT PROPAGATION

D12 должен исследовать сохранение исходного context при drill-down:

```text
from
to
preset
timezone
acquisitionSource
partnerId
status
currency
other relevant filters
```

Проверить:

- какие params реально поддерживает target;
- какие params теряются;
- какие params переименованы;
- какие params имеют другой meaning;
- какие params используются frontend-only;
- какие params должны разрешаться сервером.

Не передавать параметры автоматически без доказанного target contract.

---

# 11. TEMPORAL SEMANTICS

D8 и D11 уже определили temporal authority.

D12 должен только **propagate existing canonical period context**.

Проверить:

```text
resolveQueryPeriod
[start, endExclusive)
UTC
server-authoritative timezone
preset
```

Проверить, что drill-down не превращает:

```text
2026-08-01T00:00:00Z → 2026-08-31T23:59:59
```

или другие inclusive-end/client-time interpretations.

Не создавать новый date parser.

---

# 12. D10 / PARTNER DRILL-DOWN

D10 завершён.

Обязательно проверить existing flow:

```text
Partner Performance
→ /app/crm/partners/{partnerId}
```

и определить:

- сохраняется ли period;
- сохраняется ли source context;
- валиден ли partnerId;
- применяется ли Partner scope;
- нет ли IDOR;
- соответствует ли target CRM contract.

Не менять D10.

---

# 13. D11 / KPI DRILL-DOWN

D11 canonical KPI dictionary должен стать authority для:

```text
KPI meaning
KPI identity
status semantics
scope
```

D12 не должен определять KPI formulas.

Проверить:

```text
KPI source
→ drill-down target
```

и зафиксировать discrepancies.

---

# 14. CRM TARGET INVENTORY

Для каждого existing CRM page определить:

```text
route
entity
identifier
API
permissions
scope resolver
supported context params
```

Минимум:

- Partner 360
- Customer 360
- any Order-related CRM page
- any Booking-related CRM page
- any future/partial CRM route relevant to D12

Если target отсутствует:

```text
NOT READY / ARCHITECTURE GAP
```

Не создавать страницу в рамках audit.

---

# 15. API CONTRACT AUDIT

Проверить backend APIs, используемые target pages.

Для каждого target:

```text
endpoint
HTTP method
path params
query params
response
permission
scope
```

Установить, принимает ли target:

```text
period
status
partner
customer
workspace
channel
acquisitionSource
```

Не расширять API на audit.

---

# 16. SECURITY / IDOR AUDIT

Особое внимание route-derived IDs.

Проверить:

```text
requested entity ID
authenticated user scope
server-side ownership/access resolution
```

Минимум:

### Partner

Partner A не должен получить Partner B.

### Customer

Unauthorized actor не должен получить arbitrary customer.

### Order / Booking

Route ID не должен обходить domain scope.

D12 не должен ослаблять existing RBAC.

Если найден IDOR-like risk:

```text
HIGH
```

и это потенциальный blocker.

---

# 17. CROSS-SCOPE RULES

Проверить:

```text
Platform
Partner
Workspace
Marketplace
Storefront
CRM
Analytics
```

Особенно:

```text
Marketplace KPI
→ Marketplace target
```

и

```text
Partner-scoped KPI
→ Partner-scoped target
```

Не допускать silent expansion of scope.

---

# 18. ROUTING FAILURE MODES

Проверить фактические failure modes:

- missing ID;
- stale ID;
- invalid ID;
- route target unavailable;
- unauthorized target;
- query context omitted;
- query context malformed;
- unsupported query param;
- mismatched entity type;
- cross-scope access;
- deleted/inactive entity;
- direct URL bypass.

Каждый case классифицировать:

```text
HANDLED
PARTIAL
UNHANDLED
```

Не исправлять.

---

# 19. UI BEHAVIOR

Проверить:

- clickability;
- disabled states;
- loading;
- navigation;
- back navigation;
- query-param preservation;
- direct-link behavior;
- error state;
- 403;
- 404.

Не требовать нового UX, если canonical D12 scope этого не предусматривает.

---

# 20. FRONTEND / BACKEND AUTHORITY

Определить:

```text
Frontend owns navigation intent
Backend owns entity authorization and data authority
```

Проверить, не пытается ли frontend:

- вычислять entity identity;
- вычислять KPI meaning;
- bypass permission;
- assume access based only on visible link.

---

# 21. DOCUMENTATION / CONTRACT DRIFT

Найти:

- stale route documentation;
- outdated route names;
- obsolete CRM paths;
- duplicate navigation contracts;
- D10/D11 references inconsistent with current implementation.

Не переписывать unrelated docs.

Фиксировать only D12-relevant drift.

---

# 22. DEPENDENCY MATRIX

Проверить:

| Dependency | State | Blocks D12? | Evidence |
|---|---|---|---|
| D10 | CLOSED | ? | |
| D11 | CLOSED | ? | |
| D8 | CLOSED | ? | |
| CRM Partner 360 | ? | ? | |
| CRM Customer 360 | ? | ? | |
| Orders detail | ? | ? | |
| Bookings detail | ? | ? | |
| KPI dictionary | CLOSED | ? | |
| RBAC | ? | ? | |
| DATA-01 | ? | ? | |
| DATA-02 | ? | ? | |
| PROD-01 | ? | ? | |
| Finance | DEFERRED | ? | |

Open dependency ≠ blocker automatically.

---

# 23. D12 IMPLEMENTATION SCOPE CANDIDATE

Определить, что именно потребуется после audit.

Кандидаты исследовать:

```text
route normalization
query context propagation
CRM target mapping
central routing helper
typed drill-down contract
permission-aware route generation
deep-link validation
```

Нельзя выбирать заранее.

Вывести implementation scope только из evidence.

---

# 24. EXPECTED ARCHITECTURE QUESTION

Обязательно проверить:

> Нужен ли D12 отдельный canonical routing contract, или существующие route/API contracts уже достаточны и нужен только limited normalization?

Не создавать abstraction только ради abstraction.

---

# 25. READINESS CLASSIFICATION

После полного audit использовать только:

### READY FOR IMPLEMENTATION

Canonical routing semantics установлены, targets существуют, security boundaries доказаны, gaps non-blocking.

### READY WITH EXPLICIT GAPS

Есть небольшие gaps, но implementation безопасна.

### ARCHITECTURE DECISION REQUIRED

Неоднозначный target/identity/scope contract.

### BLOCKED

Необходимый target/dependency отсутствует.

---

# 26. REQUIRED EVIDENCE REPORT

Создать:

```text
docs/reports/evidence/PHASE_3_D12_CRM_KPI_DRILLDOWN_ROUTING_SCOPE_AUDIT.md
```

Структура:

## 1. Executive Summary

## 2. Repository Baseline

## 3. D12 Canonical Definition

## 4. Current Routing Inventory

## 5. Routing Matrix

## 6. Entity Identity Matrix

## 7. KPI → Entity Semantics

## 8. KPI Context Propagation

## 9. CRM Target Inventory

## 10. API Contract Audit

## 11. Temporal Semantics

## 12. D10 Integration

## 13. D11 Integration

## 14. Security / IDOR

## 15. Cross-Scope Analysis

## 16. Failure Modes

## 17. UI Behaviour

## 18. Documentation / Contract Drift

## 19. Dependency Matrix

## 20. Implementation Scope Candidate

## 21. Blocking Decisions

## 22. Readiness Verdict

## 23. Recommended Next Action

---

# 27. REQUIRED FINAL OUTPUT

В конце report:

```text
D12 READINESS:
CURRENT TRUE NEXT:
FINANCE:
D12 BLOCKERS:
D12 NON-BLOCKING GAPS:
CANONICAL ROUTING AUTHORITY:
CANONICAL KPI AUTHORITY:
CANONICAL ENTITY IDENTIFIERS:
TEMPORAL AUTHORITY:
SECURITY AUTHORITY:
D10 ↔ D12:
D11 ↔ D12:
IMPLEMENTATION SCOPE:
NEXT AUTHORIZED ACTION:
```

---

# 28. GIT / REPOSITORY REQUIREMENTS

Перед verdict:

```text
git status
git diff --check
git log -1
git rev-parse HEAD
git rev-parse origin/master
```

Audit-only requirement:

```text
production code changes = 0
```

Допускается только создание audit report.

Не коммитить unrelated fixes.

---

# 29. STOP CONDITION

После создания report:

**STOP.**

Не делать:

- D12 implementation;
- D13;
- Finance;
- roadmap changes;
- KPI changes;
- status changes;
- RBAC changes.

Агент возвращает только:

```text
D12 readiness
+
evidence report
+
blocking decisions
+
recommended next action
```

---

# 30. SUCCESS CRITERIA

```text
[ ] D11 closure verified
[ ] D12 canonical definition identified
[ ] current routing inventory completed
[ ] routing matrix completed
[ ] entity identity verified
[ ] KPI → entity semantics verified
[ ] context propagation audited
[ ] CRM targets audited
[ ] APIs audited
[ ] D8 temporal semantics preserved
[ ] D10 integration verified
[ ] D11 integration verified
[ ] IDOR/security checked
[ ] cross-scope checked
[ ] failure modes checked
[ ] UI behavior checked
[ ] documentation drift checked
[ ] dependencies checked
[ ] implementation scope derived
[ ] readiness classified
[ ] evidence report created
[ ] production code unchanged
[ ] STOP
```
