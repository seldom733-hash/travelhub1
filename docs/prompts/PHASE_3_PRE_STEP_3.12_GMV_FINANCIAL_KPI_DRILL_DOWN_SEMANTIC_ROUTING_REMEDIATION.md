# PHASE 3 — PRE-STEP 3.12 — GMV / FINANCIAL KPI DRILL-DOWN SEMANTIC ROUTING REMEDIATION

## STATUS

**Task type:** Architecture-aligned implementation + runtime evidence  
**Starting point:** Reference Number Contract closed with `VERDICT A`.

Current architectural defect:

```text
GMV → Orders
```

Financial metrics must drill down to an authoritative financial source/detail context. Operational metrics must continue to route to their operational centers.

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и текстовая документация должны быть преимущественно **на русском языке**: Implementation/Remediation/Runtime/Evidence Reports, findings, root cause, architecture/security decisions, conclusions, acceptance matrix и verdict explanations.

English допускается только для technical identifiers: paths, classes/methods/DTO/models, endpoints, HTTP methods/status codes, commands, enums, permission identifiers, code snippets, metric IDs, commit messages и standardized `VERDICT`.

**Hard acceptance criterion:** преимущественно англоязычный отчёт = задача незавершена.

---

## 1. PURPOSE

Реализовать единый семантический контракт:

```text
Financial KPI → financial source/detail
Operational KPI → corresponding Operational Center
CRM KPI → CRM
```

Исправление должно быть shared, а не локальным patch только одной GMV card.

## 2. CANONICAL DESTINATION CONTRACT

```text
GMV          → Finance / GMV detail
Revenue      → Finance / Revenue detail
Net Revenue  → Finance / Net Revenue detail
Commission   → Finance / Commission detail
Payments     → Finance / Payments
Refunds      → Finance / Refunds
Orders       → Orders Center
Bookings     → Booking Center
Customers    → CRM Customers
Partners     → CRM Partners
```

Exact route определяется только реально существующими capabilities.

## 3. DO NOT CREATE A FAKE FINANCE CENTER

Не создавать пустой/фиктивный `/app/finance` только ради ссылки.

Сначала audit существующих routes/capabilities. Допустимо:

```text
A. existing authoritative Finance route
B. existing dedicated financial detail route
C. new narrow dedicated metric-detail/source-traceability view
D. temporarily non-clickable KPI when no honest destination exists
```

Запрещено:

```text
financial KPI → Orders Center
```

только потому, что Orders содержат monetary fields.

## 4. AUDIT ALL CLICKABLE FINANCIAL KPI SURFACES

Минимум:

```text
/app/command-center
/app/analytics
```

Audit всех clickable:

```text
GMV
Revenue
Net Revenue
Commission
Payments
Refunds
```

и shared KPI/resolver components.

Для каждого:

```text
surface
metricId
visible label
current href/destination
current resolver
canonical semantic destination
status
```

## 5. SHARED METRIC DRILL-DOWN ARCHITECTURE

```text
Command Center GMV ─┐
Analytics GMV ───────┼→ Shared Metric Drill-down Resolver
Financial KPIs ──────┘
                              ↓
                    canonical metadata
                              ↓
                authoritative financial context
```

Не создавать независимые hardcoded mappings в каждой странице.

Conceptual contract:

```ts
{
  metricId,
  drillDownType,
  destination,
  period,
  workspace,
  tenantScope,
  filters,
  statusScope,
  currencyScope,
  partnerId,
  customerId,
  serviceId
}
```

Reuse existing Shared Metric Drill-down / Source Traceability framework if present.

## 6. GMV — HARD RULE

```text
GMV = commercial value of eligible commerce
GMV ≠ Order registry
```

Следовательно:

```text
GMV card → /app/orders
```

не может оставаться canonical.

Допустимая модель:

```text
GMV
→ financial breakdown/detail
→ related authoritative Order/Booking/Payment
```

## 7. PLATFORM GMV BUSINESS SCOPE

Preserve:

```text
Platform Marketplace GMV = Marketplace commerce only

Storefront Commerce Volume
≠ Marketplace GMV
≠ TravelHub Revenue
```

Пример:

```text
Marketplace customer purchases       100,000 AZN
TravelHub marketplace commission      10,000 AZN
Storefront own customer sales          70,000 AZN
Storefront subscription to TravelHub      200 AZN

Correct:
Marketplace GMV              100,000 AZN
Marketplace Commission        10,000 AZN
Storefront SaaS Revenue          200 AZN

Incorrect:
Platform GMV                 170,000 AZN
```

Не допустить regression Platform vs Storefront scope.

## 8. PARTNER / STOREFRONT

Если Partner/Storefront GMV/Finance capability ещё не реализован:

```text
NOT IMPLEMENTED
```

Не создавать fake Partner routes.

Future semantic rule:

```text
Storefront GMV = that Storefront tenant's own commerce
```

## 9. CONTEXT TRANSFER — HARD GATE

Click KPI must preserve exact effective context:

```text
period
custom from/to
currency
workspace
tenant/business scope
status scope
applicable partner/customer/service filters
```

Named periods remain calendar periods:

```text
Сегодня
Неделя
Месяц
Квартал
6 месяцев
Год
Период
```

Custom API interval remains:

```text
[from, to)
```

Не сбрасывать destination на default month.

Comparison: preserve if supported. If destination does not support comparison, preserve primary period and report limitation truthfully.

## 10. CURRENCY

Storage/API:

```text
AZN
USD
EUR
```

Product UI:

```text
AZN → ₼
USD → $
EUR → €
```

No implicit FX.

```text
100 AZN + 100 USD ≠ 200
```

Multi-currency detail must remain separated by native currency.

Preserve closed zero/null semantics:

```text
0 = real monetary value
null/undefined = absence
```

## 11. GMV DETAIL — MINIMUM ACCEPTABLE

If full Finance Center does not exist, a narrow dedicated GMV detail/source view is acceptable.

It must answer:

```text
What makes up this GMV?
```

Minimum:

```text
selected period
business scope
currency
GMV total
authoritative contributing population
record count
financial amount contribution
source reference
```

Use actual DB relations. Never infer relations from similar reference-number suffixes.

## 12. SOURCE TRACEABILITY — HARD GATE

For identical context:

```text
KPI GMV = aggregate of authoritative GMV detail population
```

For multi-currency:

```text
KPI AZN GMV = detail AZN aggregate
KPI USD GMV = detail USD aggregate
KPI EUR GMV = detail EUR aggregate
```

Audit current authoritative backend GMV formula:

```text
included entities
included statuses
date field
currency behavior
refund/cancellation behavior
Marketplace scope
```

If Command Center and Analytics formulas differ accidentally, reconcile them before PASS.

## 13. COMMAND CENTER VS ANALYTICS

Preserve IA:

```text
/app/command-center → operational/executive summary → what is happening
/app/analytics      → deeper BI → why it is happening
```

Both GMV representations must share the same semantic destination contract.

Do not redirect Analytics to Command Center or vice versa.

## 14. FINANCIAL KPI MATRIX

Audit at least:

| Metric | Domain | Canonical destination |
|---|---|---|
| GMV | Finance | GMV financial detail |
| Revenue | Finance | Revenue financial detail |
| Net Revenue | Finance | Net Revenue financial detail |
| Commission | Finance | Commission financial detail |
| Payments | Finance | Payments |
| Refunds | Finance | Refunds |
| Orders | Operations | Orders Center |
| Bookings | Operations | Booking Center |
| Customers | CRM | CRM Customers |
| Partners | CRM | CRM Partners |

For each destination classify:

```text
IMPLEMENTED
DEDICATED DETAIL REQUIRED
NOT IMPLEMENTED
NON-CLICKABLE UNTIL IMPLEMENTED
```

Wrong-domain redirect is not allowed.

## 15. PAYMENTS / REFUNDS

Audit current implementation.

Previously established successful-payment semantics:

```text
Payment.status = CAPTURED
paidAt ∈ selected period
```

Verify rather than assume.

Payments drill-down must preserve period/status/currency/workspace scope.

Refunds must route to Refund financial source/detail if implemented. If no user-facing source exists, use dedicated detail or non-clickable state — never generic Orders as fake destination.

## 16. REVENUE / NET REVENUE / COMMISSION

These are financial metrics.

For each determine:

```text
authoritative backend source
formula
current detail capability
correct destination
```

Do not conflate:

```text
Customer Payment
Partner Payable
Partner Payout
Platform Fee
Processing/Settlement Cost
```

Do not implement future full finance business model here.

## 17. SECURITY

Destination must enforce access server-side.

```text
frontend visibility ≠ authorization
```

Audit:

```text
permission
workspace scope
tenant scope
record-level access
```

Reference prefixes (`MKT-*`, `SF001-*`) are traceability identifiers, not authorization boundaries.

## 18. UI / ACCESSIBILITY

Clickable KPI:

- visible interactive state;
- keyboard activation;
- accessible destination semantics where practical;
- no dead links;
- no redirect loops.

Non-clickable KPI must not pretend to be clickable.

Do not redesign entire Command Center/Analytics.

## 19. BROWSER RUNTIME — HARD GATE

Real browser evidence required.

Minimum:

```text
RU /app/command-center → click GMV → correct financial destination
RU /app/analytics      → click GMV → same semantic destination
```

Verify period preservation.

Also test:

```text
Payments → Payments financial destination
Orders   → Orders Center
```

to prove financial/operational domain separation.

Smoke-test GMV routing in:

```text
RU
AZ
EN
```

Routing must use stable metric IDs, not translated labels.

## 20. DATA RECONCILIATION

Capture for same context:

```text
Command Center GMV
Analytics GMV
GMV detail aggregate
```

and prove same:

```text
metric definition
period
scope
currency
```

If surfaces intentionally differ by scope, document exact distinction.

## 21. TABLE / PAGINATION CONTRACT

If dedicated detail table is created/reused:

```text
PAGE TITLE
FILTER BAR
AGGREGATE SUMMARY — ИТОГО ПО ТЕКУЩЕЙ ВЫБОРКЕ
TABLE
PAGINATION
```

Totals = entire filtered population, not current page.

Full registries:

```text
default page size = 20
>20 → pagination mandatory
```

Filter/search/sort before pagination.

## 22. OUT OF SCOPE

Do NOT mix:

```text
Cross-Entity Business Reference & Traceability full UI
Booking KPI Semantics Audit
full Finance Center
Partner Payable/Payout
Guarantee Hold
Settlement Policy
FX gain/loss
Transaction Cost Ledger
Treasury
Cart/Checkout
```

Do not modify Booking KPI semantics in this task.

## 23. TESTS

Add/update focused tests:

```text
metricId → destination
GMV never maps to Orders
financial vs operational routing
period transfer
custom from/to
currency transfer
workspace/scope transfer
locale-independent routing
zero handling
```

If dedicated GMV endpoint/view is introduced, test:

```text
authorization
scope
aggregation
pagination
currency isolation
```

## 24. BUILD / TYPECHECK

Run and report actual:

```text
backend typecheck
backend build
backend relevant tests
frontend typecheck
frontend relevant tests
frontend build
```

If known `storefrontSessions` mismatch remains:

```text
Frontend typecheck: FAIL
```

Do not convert to PASS(scope).

## 25. RUNTIME API EVIDENCE

Report supporting API calls without secrets:

```text
endpoint
query params
effective from/to
currency
scope
response aggregate/count
```

## 26. DATA PRESERVATION

Non-destructive task.

Do not:

```text
delete representative commerce
reclassify Storefront as Marketplace
alter SF000 quarantine
reseed travelhub1 to force reconciliation
rewrite referenceNumbers
```

## 27. ROADMAP

Update additively:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Record:

```text
GMV / Financial KPI Drill-down Semantic Routing Remediation
```

with mapping, resolver decision, GMV destination, context transfer, browser evidence, reconciliation, final SHA and truthful verdict.

## 28. GIT EVIDENCE

Report:

```text
Starting SHA:
Implementation SHA:
Final HEAD:
origin/master:
HEAD == origin:
Working tree clean:
```

Do not delete unrelated user work.

## 29. REQUIRED ROUTING AUDIT MATRIX

| Surface | Metric | Current destination | Canonical domain | Final destination | Result |
|---|---|---|---|---|---|
| Command Center | GMV | | Finance | | |
| Analytics | GMV | | Finance | | |
| Command Center | Revenue | | Finance | | |
| Command Center | Net Revenue | | Finance | | |
| Command Center | Payments | | Finance | | |
| Command Center | Refunds | | Finance | | |
| Analytics | Commission | | Finance | | |
| relevant | Orders | | Operations | Orders Center | |
| relevant | Bookings | | Operations | Booking Center | |

Add all other clickable financial metrics found.

## 30. REQUIRED CONTEXT MATRIX

| Context | Source | Destination | Preserved? | Evidence |
|---|---|---|---|---|
| Period preset | | | PASS/FAIL | |
| Custom from/to | | | PASS/FAIL | |
| Currency | | | PASS/FAIL | |
| Workspace | | | PASS/FAIL | |
| Marketplace scope | | | PASS/FAIL | |
| Comparison | | | PASS/FAIL/N/A | |
| Partner/customer/service filters | | | PASS/FAIL/N/A | |

## 31. REQUIRED SOURCE RECONCILIATION

| Metric | Surface value | Detail aggregate | Currency | Period | Scope | Result |
|---|---:|---:|---|---|---|---|
| GMV Command Center | | | | | | |
| GMV Analytics | | | | | | |
| Payments | | | | | | |
| Refunds | | | | | | |

Use N/A only with explicit reason.

## 32. REQUIRED BROWSER MATRIX

| Locale | Source | Metric | Action | Destination | Context preserved | Result |
|---|---|---|---|---|---|---|
| RU | Command Center | GMV | click | | | |
| RU | Analytics | GMV | click | | | |
| AZ | Command Center/Analytics | GMV | click | | | |
| EN | Command Center/Analytics | GMV | click | | | |
| RU | relevant | Payments | click | | | |
| RU | relevant | Orders | click | Orders Center | | |

## 33. REQUIRED ACCEPTANCE MATRIX

| Gate | Result |
|---|---|
| All clickable financial KPIs audited | PASS/FAIL |
| Shared metric resolver used/reconciled | PASS/FAIL |
| GMV no longer routes to Orders | PASS/FAIL |
| Command Center GMV destination correct | PASS/FAIL |
| Analytics GMV destination correct | PASS/FAIL |
| Revenue destination correct | PASS/FAIL/N/A |
| Net Revenue destination correct | PASS/FAIL/N/A |
| Commission destination correct | PASS/FAIL/N/A |
| Payments destination correct | PASS/FAIL/N/A |
| Refund destination correct | PASS/FAIL/N/A |
| Orders still route to Orders Center | PASS/FAIL |
| Bookings still route to Booking Center | PASS/FAIL |
| Period preserved | PASS/FAIL |
| Custom period preserved | PASS/FAIL |
| Currency preserved | PASS/FAIL |
| Workspace/business scope preserved | PASS/FAIL |
| Comparison preserved or limitation truthful | PASS/FAIL/N/A |
| Resolver independent of locale | PASS/FAIL |
| RU browser evidence | PASS/FAIL |
| AZ browser evidence | PASS/FAIL |
| EN browser evidence | PASS/FAIL |
| GMV source reconciliation | PASS/FAIL |
| No cross-currency summation | PASS/FAIL |
| Platform Marketplace scope preserved | PASS/FAIL |
| Storefront commerce excluded from Platform GMV | PASS/FAIL |
| Server-side authorization preserved | PASS/FAIL |
| Prefix not used as authorization | PASS/FAIL |
| Currency presentation contract preserved | PASS/FAIL |
| Representative data preserved | PASS/FAIL |
| Backend tests/build/typecheck actual | PASS/FAIL |
| Frontend tests/build/typecheck actual | PASS/FAIL |
| Roadmap updated | PASS/FAIL |
| Git synchronized | PASS/FAIL |

## 34. REQUIRED REPORT STRUCTURE

Отчёт преимущественно на русском:

```text
1. Executive Summary
2. Starting SHA / Repository State
3. Current Financial KPI Routing Audit
4. Root Cause
5. Canonical Metric Destination Contract
6. Shared Metric Drill-down Resolver
7. GMV Remediation
8. Revenue / Net Revenue / Commission
9. Payments / Refunds
10. Operational KPI Regression
11. Period / Custom Period Transfer
12. Currency Transfer
13. Workspace / Business Scope Transfer
14. Comparison Context
15. GMV Backend Formula
16. Source Reconciliation
17. Platform vs Storefront Scope
18. Security / Authorization
19. UI / Accessibility
20. RU / AZ / EN Browser Evidence
21. API Runtime Evidence
22. Tests / Build / Typecheck
23. Representative Data Preservation
24. Canonical Roadmap Update
25. Git / SHA Evidence
26. Residual Gaps
27. Acceptance Matrix
28. Final Verdict
```

## 35. VERDICT RULES

### VERDICT A — GMV / FINANCIAL KPI DRILL-DOWN QUALIFIED

Allowed only when:

```text
GMV no longer routes to Orders
+
Command Center and Analytics have consistent semantic routing
+
honest authoritative financial destination exists
+
period/currency/workspace scope preserved
+
GMV detail reconciles with source KPI
+
Platform Marketplace scope excludes Storefront commerce
+
browser runtime evidence exists
+
server-side authorization remains authoritative
+
Git synchronized
```

If a true financial destination is not implemented, making that KPI non-clickable and marking `NOT IMPLEMENTED` is preferable to a false redirect.

### VERDICT B — REMEDIATION / EVIDENCE INCOMPLETE

Mandatory if:

- GMV still routes to Orders;
- Command Center/Analytics disagree semantically;
- fake Finance Center introduced;
- context lost;
- detail does not reconcile;
- Storefront commerce contaminates Marketplace GMV;
- browser runtime evidence missing;
- code/tests substitute for required runtime evidence.

## 36. STOP CONDITION

After implementation/evidence:

**STOP.**

Do not automatically start:

- Cross-Entity Business Reference & Traceability;
- Booking KPI Semantics Audit;
- full Finance Center;
- Financial Business Model;
- FX/Multi-Currency business model;
- Partner Settlement;
- Final PRE-STEP 3.12 Re-Qualification;
- Step 3.12.

Return the report for independent review.
