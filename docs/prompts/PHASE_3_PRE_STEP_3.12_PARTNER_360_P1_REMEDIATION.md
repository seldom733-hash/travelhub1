# PHASE 3 — PRE-STEP 3.12 — PARTNER 360 / FULFILLED / TABLE TOTALS / CRM TRACEABILITY — P1 REMEDIATION

## STATUS
**TYPE:** Targeted remediation after Strict Review `VERDICT B`  
**Starting SHA:** `364c42e`  
**Scope:** ровно 5 подтверждённых P1 findings.  
**Out of scope:** FX, Behavioral Telemetry, Step 3.12, общий редизайн.

Подтверждённые PASS не переоткрывать без regression evidence:
```text
Partner 360 Orders/Bookings reconciliation PASS
Shared authoritative queries PASS
Calendar boundaries PASS
FULFILLED lifecycle guard PASS
FULFILLED real records = 212
GMV completed = SUM(amount) WHERE status IN (FULFILLED,CLOSED)
Security baseline PASS
```

Исправить:
```text
SR-P360-05 First navigation fetch без period
SR-FUL-07  FULFILLED отсутствует в Orders filter
SR-TABLE-01 Нет ИТОГО над data tables
SR-CRM-01 Active Customers 129 → CRM 261
SR-CRM-02 Partners 33 → CRM 28
```

## LANGUAGE REQUIREMENT — MANDATORY
Все Implementation/Remediation Reports, evidence, findings, root cause, architecture/security decisions, reconciliation, conclusions и verdict explanations — преимущественно **на русском**. English только для technical identifiers, paths, APIs, commands, SHA, enums, code и standardized VERDICT strings. Преимущественно английский report = task incomplete.

# 1. SR-P360-05 — FIRST NAVIGATION PERIOD HYDRATION
Strict Review доказал: первый client-side request Partner Performance → Partner 360 уходит **без period params**, получает all-time population, затем идут корректирующие requests. Refresh сразу корректен.

Исправить lifecycle:
```text
route/query params
→ validate/hydrate
→ canonical period ready
→ query enabled
→ FIRST authoritative fetch
```
Первый data request обязан уже содержать:
```text
partnerId
from
to
preset
timezone/context where applicable
```
Не маскировать bug loading overlay. Проверить initial state, query `enabled`, effects/dependencies, cache key, router transitions, stale previous partner/period state.

Hard contract:
```text
SOURCE = FIRST RENDER = AFTER F5
```
Отдельно Orders и Bookings. Минимум 10 client-side transitions каждого, несколько partners, TODAY/WEEK/MONTH/6 MONTHS/YEAR. Снять first-request vs after-F5 network evidence. Не должно быть redundant initial all-time data request.

# 2. SR-FUL-07 — FULFILLED В ORDERS FILTER
`FULFILLED` — canonical Order status, label `Выполнен`, real records=212. Добавить его в shared Orders status filter manifest, не Analytics-only.

Проверить:
```text
status=FULFILLED
status=CLOSED
status=FULFILLED,CLOSED
```
UI/API totals должны совпадать. Multi-status URL обязан показывать оба active statuses, включая direct URL, Analytics drill-down, refresh, back/forward, изменение других filters и reset.

# 3. SR-TABLE-01 — SHARED AGGREGATE SUMMARY / ИТОГО
Добавить **над таблицей**, после Filter Bar и до table header:
```text
FILTER BAR
↓
ИТОГО ПО ТЕКУЩЕЙ ВЫБОРКЕ
↓
TABLE
↓
PAGINATION
```
Использовать shared reusable `AggregateSummary`/эквивалент + authoritative aggregate query contract. Не делать отдельную totals implementation на каждой странице.

Hard rule: totals считаются по **всей filtered population**, не по текущей странице 20 rows:
```text
filters/search/period/status/partner/security
→ authoritative query
→ totalCount + aggregates + paginated rows
```

Минимум покрыть 8 таблиц:
1. Orders Center
2. Booking Center
3. CRM Customers
4. CRM Partners
5. Partner 360 Orders
6. Partner 360 Bookings
7. Partner Performance
8. Financial Summary/full financial registry из Strict Review

Для каждой вывести всё корректно агрегируемое.

Counts где применимо:
```text
records, Orders, Bookings, Customers, Partners,
Payments, Refunds, Transactions, Services/items
```

Money где применимо:
```text
GMV, order amount, booking amount, Customer Payments,
Paid, Outstanding/Open, Refunds, Net, Commission,
Payout, Fees, Discounts, Taxes
```
Провести inventory и добавить другие business-valid additive metrics, если существуют.

Derived metrics не складывать и не усреднять механически:
```text
AOV = total canonical GMV / qualifying Orders
Completion = total completed / total eligible ×100
Effective Commission Rate = total Commission / canonical commission base ×100
```
Non-additive ID/name/date/status/free text не суммировать.

До FX:
```text
AZN + USD + EUR ≠ один native total
```
Показывать totals раздельно по валютам. Новый FX conversion запрещён.

Summary должен быть компактным shared UI, responsive, с loading/empty/error states; общий редизайн страниц не делать.

# 4. SR-CRM-01 — ACTIVE CUSTOMERS 129 → CRM 261
Не подменять `Всего клиентов=261` числом 129. Сначала зафиксировать canonical Analytics definition Active Customer:
```text
DISTINCT canonical customer identity
WHERE qualifying activity
AND businessTimestamp ∈ period
AND workspace/tenant/security scope
```
Документировать identity key, activity, timestamp, DISTINCT, guest/registered, cancelled/refunded influence, archive/soft-delete и scope.

Click `Analytics → Активные клиенты=X` должен открыть CRM Customers с тем же period и **видимым** Active Customers context/filter:
```text
ИТОГО ПО ТЕКУЩЕЙ ВЫБОРКЕ
Активные клиенты: X
```
Registry/pagination должны представлять именно X distinct customers. Общий stock `Всего клиентов=261` может оставаться отдельной метрикой.

Hard reconciliation:
```text
Analytics X = CRM contextual aggregate X = registry total X = canonical distinct IDs X
```
Проверить минимум MONTH, YEAR и ещё один preset.

# 5. SR-CRM-02 — PARTNERS 33 → CRM 28
Strict Review установил:
```text
Analytics = entitlement-based population
CRM = Partner entity population
```
Сначала выполнить ID-level reconciliation:
```text
AnalyticsPartnerIds
CRMPartnerIds
intersection
analyticsOnly
crmOnly
```
Для каждой difference record показать `partnerId`, entity existence, entitlement, status, Marketplace/Storefront, active/inactive, onboarding, archive/soft-delete, workspace/tenant.

Затем принять **одну явную product semantic** на основании текущей архитектуры:
- если Analytics card означает Partner entities → считать canonical entity population;
- если означает entitlement-bearing partners → явно назвать метрику и открыть именно эту population в CRM.

Недопустимо одинаковое label `Партнёры` для разных populations без объяснения.

Hard destination:
```text
source X
→ CRM Partners contextual scope
→ Aggregate Summary X
→ registry total X
→ exact canonical IDs = source set
```

# 6. SHARED DRILL-DOWN CONTRACT
Не создавать special-case handlers:
```text
Metric
→ Shared DrillDown Contract
→ destination + context
→ authoritative population
→ Aggregate Summary
→ table
```
Сохранять где применимо `metricId`, workspace, partnerId, from/to/preset, status, paymentStatus, currency, metric-specific scope.

# 7. SECURITY
Aggregates и rows должны использовать одну authorized population. Проверить tenant/workspace, RBAC, entitlement, partner/customer visibility. Query params не могут расширять доступ.
```text
aggregates MUST NOT leak inaccessible records
```

# 8. PERFORMANCE
Не использовать fetch-all/client aggregation ради totals. Для paginated registries aggregation server-side. Проверить indexes/query plan для period/status/partner predicates, отсутствие N+1 и aggregate request loops. Зафиксировать request count Partner 360 before/after; initial redundant all-time fetch должен исчезнуть.

# 9. TARGETED TESTS
Обязательно:
```text
First navigation waits for period
First request contains from/to + partnerId
Orders/Bookings source=destination without F5
FULFILLED filter + multi-status hydration
Aggregates over full filtered population > pageSize
Search/status/period/partner applied before aggregation
Multi-currency separated
Derived metrics correctly recomputed
Active Customers source IDs = CRM contextual IDs
Partners source IDs = CRM contextual IDs
```

# 10. BROWSER / NETWORK EVIDENCE
Показать actual runtime.

Partner 360, например если dataset неизменён:
```text
Baku Tours Pro MONTH Orders 129
→ FIRST render 129 → F5 129

Bookings 17
→ FIRST render 17 → F5 17
```
Если dataset изменился, использовать актуальные source values, но exact reconciliation обязательно.

FULFILLED:
```text
Orders → filter → Выполнен
```
и API/UI totals single + combined.

Aggregate Summary: evidence для всех 8 tables. Минимум одна таблица с `>20` records должна доказать:
```text
visible rows=20
filtered total>20
summary=full filtered population
```

CRM:
```text
Analytics Active Customers X → CRM X → registry X
Analytics Partners P → CRM P → registry P
```

# 11. MANDATORY RECONCILIATION MATRIX
| Source | Source | Destination | Aggregate | Registry | IDs/amount reconciled | PASS |
|---|---:|---|---:|---:|---|---|
| Partner Orders | X | Partner 360 Orders | X | X | yes | |
| Partner Bookings | Y | Partner 360 Bookings | Y | Y | yes | |
| Active Customers | A | CRM Customers | A | A | exact IDs | |
| Partners | P | CRM Partners | P | P | exact IDs | |

Для monetary totals добавить native-currency reconciliation.

# 12. MANDATORY TABLE TOTALS INVENTORY
| Table | Count | Money totals | Other totals | Derived | Full filtered population | Above table | PASS |
|---|---|---|---|---|---|---|---|
| Orders Center | | | | | | | |
| Booking Center | | | | | | | |
| CRM Customers | | | | | | | |
| CRM Partners | | | | | | | |
| Partner 360 Orders | | | | | | | |
| Partner 360 Bookings | | | | | | | |
| Partner Performance | | | | | | | |
| Financial table | | | | | | | |

# 13. REGRESSION
Не сломать Calendar boundaries, CUSTOM lifecycle, pagination, shared drill-down, FULFILLED lifecycle, GMV formula, Partner Performance, Financial Summary, security/i18n. Запустить frontend/backend targeted suites, typecheck/build.

# 14. REQUIRED REMEDIATION REPORT
Создать преимущественно русский:
```text
docs/reports/PHASE_3_PRE_STEP_3.12_PARTNER_360_P1_REMEDIATION_REPORT.md
```
Включить Starting/Final SHA; 5 root causes/fixes; first-navigation network before/after; FULFILLED evidence; shared totals architecture; 8-table inventory; monetary/count/derived semantics; multi-currency behavior; Active Customers definition + ID reconciliation; Partners semantic decision + ID reconciliation; security/performance; browser/tests; residual gaps; verdict; exact NEXT.

# 15. GIT / ROADMAP
Baseline:
```text
Starting SHA = 364c42e
```
Перед работой проверить `git status`, HEAD и origin/master. Roadmap обновлять additive только после evidence; сохранить историю Strict Review. Не закрывать PRE-STEP при любом remaining P1.

# 16. ACCEPTANCE GATES
**A First navigation:** first request period-scoped; source=first render=F5; Orders+Bookings PASS.  
**B FULFILLED:** visible/selectable; single/multi hydration + reconciliation PASS.  
**C Table totals:** shared summary над всеми 8 tables; full filtered population; meaningful count/money totals; derived correct; currencies separated.  
**D Active Customers:** exact definition; Analytics X = CRM aggregate X = registry X = exact IDs.  
**E Partners:** 33/28 root cause proven by IDs; explicit semantic; source=destination population and unambiguous label/context.  
**F Security/regression:** no leaks, tests/browser/network green, previous PASS contracts intact.

# 17. VERDICT
Только если Gates A–F PASS:
```text
VERDICT A — PARTNER 360 / FULFILLED / TABLE / CRM P1 REMEDIATION APPROVED
NEXT = separate STRICT RE-QUALIFICATION
```
Не переходить напрямую к FX.

Если любой P1 остаётся:
```text
VERDICT B — P1 REMEDIATION INCOMPLETE
```
Перечислить exact remaining findings/evidence.

# 18. HARD STOP
После remediation — STOP. Не запускать автоматически Strict Re-Qualification, FX Amendment, Behavioral Telemetry, Step 3.12 или общий UI redesign. Сначала предоставить русский report, реальные SHA, browser/network evidence, tests и verdict.
