# PHASE 3 — PRE-STEP 3.12 — RUNTIME RE-QUALIFICATION + TARGETED SOURCE-TRACEABILITY REMEDIATION

## STATUS
**TYPE:** Runtime Re-Qualification + Targeted Remediation  
**Starting SHA:** `82a83cb`  
Предыдущий implementation `VERDICT A` **не принимается**, потому что runtime подтверждает незакрытые source-traceability defects.  
**НЕ НАЧИНАТЬ:** FX, Behavioral Telemetry, Step 3.12, общий UI redesign.

## LANGUAGE REQUIREMENT — MANDATORY
Все reports, evidence descriptions, findings, root cause, architecture/security decisions, population reconciliation, conclusions и verdict explanations — преимущественно **на русском**. English только для technical identifiers, paths, APIs, commands, SHA, enums, code и standardized VERDICT strings. Преимущественно английский report = task incomplete.

# 1. AUTHORITATIVE RUNTIME FINDINGS
### SR-CRM-01 — FAIL
```text
Analytics: Активные клиенты = 129
→ CRM Клиенты: Всего клиентов = 261
```
Source population не воспроизводится.

### SR-CRM-02 — FAIL
```text
Analytics: Партнёры = 33
→ CRM Партнёры: Всего партнёров = 28
```
Source/destination populations различаются.

### SR-FIN-01 — NEW P1
```text
Financial Summary
AZN: Платежей = 118
→ /app/orders?from=2026-08-01&to=2026-09-01&preset=MONTH&currency=AZN&fromAnalytics=true
→ Orders = 214
→ payments разных валют / population source metric не воспроизводится
```
Аналогично проверить USD/EUR.

# 2. FUNDAMENTAL RULE
Не заставлять unrelated metrics искусственно совпадать. Если `Active Customers` и `Total Customers`, либо две Partner populations, легитимно различаются:
1. доказать exact semantics;
2. дать недвусмысленные labels;
3. click source metric открывает **именно source population**;
4. destination показывает contextual aggregate = source;
5. table/pagination воспроизводят exact records.

# 3. RR-CRM-01 — ACTIVE CUSTOMERS
Найти authoritative Analytics definition:
```text
ActiveCustomerIds =
DISTINCT <canonical customer key>
WHERE <exact qualifying activity>
AND <businessTimestamp> ∈ [from,to)
AND <workspace/security scope>
```
Документировать entity, identity key, DISTINCT, activity, timestamp, statuses, cancelled/refunded, guest/registered, workspace/tenant, archive/soft-delete.

Отдельно доказать definition CRM `Всего клиентов=261`.

Для MONTH выполнить set reconciliation:
```text
AnalyticsActiveIds=A
CRMIds=B
|A|, |B|, intersection, A-only, B-only
```
Показать representative differences и причины.

Required destination:
```text
Analytics Active Customers=X
→ CRM Клиенты
→ same period
→ visible context/filter "Активные клиенты"
→ ИТОГО: Активные клиенты X
→ registry/pagination X
→ exact distinct IDs = source set
```
`Всего клиентов=261` может остаться отдельным stock metric. Refresh/back-forward сохраняют context. Проверить MONTH, YEAR и ещё один preset.

# 4. RR-CRM-02 — PARTNERS 33 VS 28
Найти exact Analytics query и CRM query. Выполнить ID-level reconciliation:
```text
AnalyticsPartnerIds
CRMPartnerIds
intersection
analyticsOnly
crmOnly
```
Для каждой difference record показать:
```text
partnerId
Partner entity exists
sellerPartnerId
entitlement/plan/tier
Marketplace/Storefront
status
active/inactive
onboarding
archive/soft-delete
workspace/tenant
createdAt/activatedAt where relevant
```
Объяснить все записи разницы.

После evidence выбрать canonical UX:
- если card означает Partner entities → считать canonical entity population;
- если entitlement-bearing/active partners → label должен это явно отражать, а CRM destination открывает именно эту population.

Hard:
```text
source P
→ CRM contextual aggregate P
→ registry/pagination P
→ exact IDs = source set
```

# 5. RR-FIN-01 — FINANCIAL SUMMARY PAYMENT DRILL-DOWN
Source `Платежей=118 AZN` — **Payment population**, не Orders count.

Сначала inventory существующего authoritative UI:
```text
Finance Center
Payments registry
Payment transactions
financial detail/journal
existing drawer/detail
Orders payment subview
```
Если Payments registry существует — использовать его. Если нет — создать минимальный dedicated Payment drill-down/detail на canonical Payment query/service, без дублирования business logic.

Доказать formula:
```text
PaymentCount(C, period)
= COUNT(canonical Payment records)
WHERE currency=C
AND <exact payment status predicate>
AND <businessTimestamp> ∈ [from,to)
AND workspace/security scope
```
Документировать entity, status, amount, currency, timestamp, refund/order relation, workspace/tenant.

Required AZN flow:
```text
Financial Summary
AZN / Платежей=118
→ Payments destination
→ same period
→ Валюта=AZN
→ ИТОГО:
   Платежей=118
   Сумма платежей=X AZN
→ table exact Payment records
```
Hard:
```text
source count = aggregate count = registry total = canonical IDs count
source amount = destination amount = SUM(Payment.amount over same IDs)
```
Независимо проверить AZN, USD, EUR. Orders statuses не использовать вместо Payment statuses. `currency=AZN` обязан реально ограничивать records; network/API доказательство: все returned Payment.currency=AZN.

# 6. RR-TABLE-01 — RE-QUALIFY AGGREGATE SUMMARY
Проверить не наличие компонента, а semantics минимум на:
```text
Orders Center
Booking Center
CRM Customers
CRM Partners
Partner 360 Orders
Partner 360 Bookings
Partner Performance
Financial Summary / financial registry
```
Layout:
```text
Filter Bar
→ ИТОГО ПО ТЕКУЩЕЙ ВЫБОРКЕ
→ Table
→ Pagination
```
Для total>20/pageSize=20 доказать: summary = **вся filtered population**, не 20 visible rows.

Проверить применимые counts/money: records, Orders, Bookings, Customers, Partners, Payments, Refunds, GMV, amounts, Net, Commission, Payout, Fees и другие additive metrics. Derived metrics пересчитывать из canonical totals. До FX AZN/USD/EUR totals раздельно.

# 7. RR-P360-05 — FIRST NAVIGATION HYDRATION
Re-qualify `isHydrated` fix:
```text
10 Orders transitions
10 Bookings transitions
```
без F5, несколько periods/partners.

Для каждого:
```text
source
FIRST request from/to/partnerId
FIRST total
after-F5 total
```
Hard:
```text
SOURCE = FIRST TOTAL = AFTER F5
```
Первый authoritative request не должен быть all-time/default.

# 8. RR-FUL-07 — FULFILLED FILTER
Browser evidence:
```text
Orders dropdown contains Выполнен
```
Проверить:
```text
FULFILLED
CLOSED
FULFILLED,CLOSED
```
API/UI totals, URL hydration, refresh/back-forward.

# 9. SHARED SOURCE TRACEABILITY
Все metric drill-down:
```text
Source metric
→ semantic context
→ authoritative destination population
→ visible Aggregate Summary
→ exact records
→ reconciliation
```
Не использовать просто тематически похожую страницу. Context где применимо: metricId, workspace, from/to/preset, partnerId, customer scope, currency, Payment/Order status, semantic population key.

# 10. SECURITY / PERFORMANCE
Server-authoritative workspace/tenant/RBAC/entitlement; query params не расширяют scope; aggregates и rows используют одну authorized population; financial totals не leak inaccessible data.

Не использовать fetch-all/client aggregation. Paginated registries: server filters + totalCount + aggregates + paginated rows. Проверить N+1/request loops.

# 11. REQUIRED MATRICES
### CRM
| Metric | Source | Destination aggregate | Registry | Exact IDs | Result |
|---|---:|---:|---:|---|---|
| Active Customers | 129/current | | | | |
| Partners | 33/current | | | | |

### Payments
| Currency | Source count | Destination count | Source amount | Destination amount | Currency purity | Result |
|---|---:|---:|---:|---:|---|---|
| AZN | 118/current | | | | | |
| USD | current | | | | | |
| EUR | current | | | | | |

### Partner 360
| Metric | Source | First render | After F5 | First request period correct | Result |
|---|---:|---:|---:|---|---|
| Orders | | | | | |
| Bookings | | | | | |

Use actual runtime values if dataset changed.

# 12. BROWSER / NETWORK EVIDENCE
Обязательно:
1. Active Customers source + CRM destination/context/aggregate/table total;
2. Partners source + CRM destination/context/aggregate/table total;
3. Financial Summary AZN/USD/EUR + Payment destination;
4. first API params + returned currencies/statuses;
5. Aggregate Summary examples, включая table >20;
6. FULFILLED dropdown;
7. Partner 360 first-navigation request до F5.

# 13. TARGETED TESTS
Добавить tests, падающие на старом поведении:
```text
Active Customers source IDs = CRM contextual IDs
Partners source IDs = CRM contextual IDs
AZN/USD/EUR Payment source = destination counts
Payment currency purity
Payment amount reconciliation
Aggregate totals > pageSize
First-navigation period hydration
FULFILLED filter hydration
```
Общий green suite не заменяет semantic tests.

# 14. REQUIRED REPORT
Создать преимущественно русский:
```text
docs/reports/PHASE_3_PRE_STEP_3.12_RUNTIME_REQUALIFICATION_TARGETED_REMEDIATION_REPORT.md
```
Включить Starting SHA; reproduction before fix; Active Customers definitions/set reconciliation; Partners definitions/ID reconciliation; Payment semantics + AZN/USD/EUR reconciliation; Payments destination architecture; Aggregate Summary re-qualification; Partner 360 hydration; FULFILLED; security/performance; browser/network evidence; tests; residual gaps; real SHAs; verdict; exact NEXT.

# 15. GIT / ROADMAP
Expected:
```text
Starting SHA = 82a83cb
```
Перед работой `git status`, HEAD, origin/master. После:
```text
Starting SHA:       82a83cb
Implementation SHA: <real SHA>
Final HEAD:         <real SHA>
origin/master:      <real SHA>
```
Roadmap additive; preserve history.

# 16. ACCEPTANCE GATES
**A Active Customers:** source semantics proven; visible context; source X=aggregate X=registry X=exact IDs.  
**B Partners:** root cause at ID level; explicit semantic; source P=destination P=exact IDs.  
**C Payments:** AZN/USD/EUR source count=destination count; amounts reconcile; selected currency purity; same period/status/workspace.  
**D Table totals:** shared summary above tables; full filtered population; correct additive/derived/currency semantics.  
**E Partner 360:** first request period-scoped; source=first render=F5.  
**F FULFILLED:** visible/selectable; single/multi hydration/reconciliation.  
**G Security/regression:** no leaks; targeted tests + browser/network evidence green.

# 17. VERDICT
Только Gates A–G PASS:
```text
VERDICT A — RUNTIME SOURCE-TRACEABILITY REMEDIATION APPROVED
READY FOR SEPARATE FINAL STRICT RE-QUALIFICATION
```
Не начинать FX автоматически.

Если любой defect остаётся:
```text
VERDICT B — RUNTIME SOURCE-TRACEABILITY REMEDIATION INCOMPLETE
```
Указать exact remaining findings/evidence.

# 18. HARD STOP
После remediation — STOP. Не запускать Final Strict Re-Qualification, FX, Behavioral Telemetry, Step 3.12 или dark-gold UI implementation автоматически. Сначала предоставить русский report, реальные SHA, browser/network evidence, reconciliation matrices, tests и verdict.
