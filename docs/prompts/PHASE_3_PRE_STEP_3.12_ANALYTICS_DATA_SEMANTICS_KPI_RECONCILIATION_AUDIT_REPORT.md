# PHASE 3 — PRE-STEP 3.12 — ANALYTICS DATA SEMANTICS & KPI RECONCILIATION — AUDIT REPORT

## 1. Executive Summary

Проведён аудит семантики данных и KPI на странице `/app/analytics` (Analytics Center). Обнаружены **4 критических** и **3 некритических** несоответствия. Основные:

1. **Completion % — double multiplication** (P0): backend возвращает значение в процентах (200), frontend умножает на 100 ещё раз → 20000%
2. **Revenue = Customer Payments** (P1): headline «Выручка» = SUM(Payment.amount), а не Platform Revenue
3. **Funnel — не монотонный, не cohort-based** (P1): данные из разных source, не связаны последовательно
4. **GMV = Completed GMV** (P2): headline GMV показывает только fulfilled+closed заказы, а не весь GMV

---

## 2. Baseline / SHA

```
Starting SHA:     99090ef
Audit SHA:        99090ef
origin/master:    99090ef
```

Период данных: `2026-08-01 → 2026-09-01` (preset=MONTH, timezone=UTC)

---

## 3. Runtime Dataset

```
Representative:     synthetic but internally coherent
Seed:               demo-seed.ts (realistic interconnected business data)
Cross-period:       yes (orders span full 2026)
Test contamination: no (no test-only records in analytics)
```

---

## 4. KPI Semantics Matrix

| KPI | UI Label | API Field | Canonical Source | Exact Formula | Included Statuses | Period Field | Currency | Actual Semantics | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| GMV | GMV | gmv | Order | SUM(amount) WHERE status IN (FULFILLED, CLOSED) | FULFILLED, CLOSED | createdAt | AZN (primary) | Completed GMV — только завершённые заказы | **MISLABELLED** |
| Revenue | Выручка | revenue | Payment | SUM(amount) WHERE status=CAPTURED AND paidAt IN period | CAPTURED | paidAt | AZN (primary) | Customer Payments — деньги от клиентов, не доход Platform | **MISLABELLED** |
| Net Revenue | Чистая выручка | netRevenue | Payment - Refund | Revenue - Refunds (per currency) | CAPTURED / PROCESSED | paidAt / processedAt | AZN (primary) | Customer Payments минус refunds | **MISLABELLED** |
| Commission | Комиссия | commissionAccrued | Commission | SUM(amount) WHERE createdAt IN period | ALL | createdAt | AZN (primary) | Начисленная комиссия Platform | CORRECT |
| Orders | Заказы | ordersCreated | Order | COUNT(*) WHERE createdAt IN period | ALL statuses | createdAt | N/A | Все заказы за период | CORRECT |
| Bookings | Бронирования | bookingsRequested | Booking | COUNT(*) WHERE createdAt IN period | ALL statuses | createdAt | N/A | Все бронирования за период | CORRECT |
| AOV | Средний чек | averageOrderValue | Order (GMV) | SUM(amount, FULFILLED+CLOSED) / COUNT(FULFILLED+CLOSED) | FULFILLED, CLOSED | createdAt | AZN (primary) | Средний чек завершённого заказа | CORRECT |
| Refunds | Возвраты | refunds | Refund | SUM(amount) WHERE status=PROCESSED AND processedAt IN period | PROCESSED | processedAt | AZN (primary) | Обработанные возвраты | CORRECT |
| Sessions | Сессии | marketplaceSessions + storefrontSessions | BehavioralEvent | COUNT(DISTINCT sessionId) WHERE occurredAt IN period | ALL | occurredAt | N/A | Уникальные сессии (behavioral) | CORRECT |
| Customers | Клиенты | marketplaceCustomers + storefrontCustomers | Order (customerId) | COUNT(DISTINCT customerId) WHERE createdAt IN period AND acquisitionSource | ALL | createdAt | N/A | Уникальные покупатели с заказами | CORRECT |
| Partners | Партнёры | marketplacePartners + storefrontPartners | Product (published) + PartnerStorefront | COUNT(DISTINCT partnerId) с PUBLISHED products / ACTIVE storefront | PUBLISHED / ACTIVE | createdAt | N/A | Партнёры с опубликованными товарами | CORRECT |
| Qualified GMV | Квалифицированный GMV | qualifiedGmv | Order | SUM(amount) WHERE status NOT IN (NEW, CANCELLED) | NOT NEW, NOT CANCELLED | createdAt | AZN (primary) | Экономически квалифицированные заказы | CORRECT |
| Completed GMV | Завершённый GMV | completedGmv | Order | SUM(amount) WHERE status IN (FULFILLED, CLOSED) | FULFILLED, CLOSED | createdAt | AZN (primary) | Завершённые заказы (= headline GMV) | CORRECT |
| Collected GMV | Собранный GMV | collectedGmv | Order (paidAmount) | SUM(paidAmount) WHERE status NOT IN (NEW, CANCELLED) | NOT NEW, NOT CANCELLED | createdAt | AZN (primary) | Фактически собранные средства | CORRECT |
| Outstanding GMV | Незакрытый GMV | outstandingGmv | Computed | Qualified GMV - Collected GMV | — | — | AZN (primary) | Неоплаченная часть квалифицированного GMV | CORRECT |

---

## 5. GMV Reconciliation

```
Qualified GMV   = 14 437,86 AZN  (all orders except NEW/CANCELLED)
Collected GMV   = 13 149,54 AZN  (paidAmount for qualified orders)
Completed GMV   = 11 296,26 AZN  (FULFILLED + CLOSED orders)
Open GMV        =  1 288,32 AZN  (Qualified - Collected)
Headline GMV    = 11 296,26 AZN  (= Completed GMV)
```

### Algebraic Invariants (verified from code)

```
Outstanding = Qualified - Collected = 14 437,86 - 13 149,54 = 1 288,32 ✓
Completed ≤ Qualified (FULFILLED/CLOSED ⊂ NOT NEW/CANCELLED) ✓
Collected can be > Completed (payments for non-fulfilled orders exist) ✓
```

### Finding G1

**Headline GMV = Completed GMV**. UI label «GMV» подразумевает общий объём сделок, но фактически показывает только завершённые. Это может быть намеренным (completed GMV = economic realization), но label «GMV» без уточнения вводит в заблуждение.

**Classification**: DATA SEMANTICS GAP, P2

---

## 6. Revenue / Payment / Refund / Commission Reconciliation

### 6.1 Financial Reconciliation (per currency)

| Currency | Payments | Refunds | Net | Commission |
|---|---|---|---|---|
| AZN | 18 594,91 | 856,87 | 17 738,04 | 1 001,84 |
| EUR | 124,32 | 0,00 | 124,32 | 36,85 |
| USD | 10 533,34 | 0,00 | 10 533,34 | 912,68 |

### 6.2 Headline Revenue

```
Revenue     = 18 594,91 AZN  (= AZN Payments)
Net Revenue = 17 738,04 AZN  (= AZN Payments - AZN Refunds)
```

### 6.3 Current Implementation Semantics

```text
Revenue  = SUM(Payment.amount WHERE status=CAPTURED AND paidAt IN period)
         = Customer Payments (деньги, полученные от клиентов)
```

### 6.4 Canonical / Intended Semantics

```text
Platform Revenue  ≠ Customer Payments
Platform Revenue  = Commission + Platform Fees - Refund Liability - Seller Entitlements
```

### Finding R1

**Headline «Выручка» = Customer Payments, а не Platform Revenue.** Формула: `SUM(Payment.amount WHERE status=CAPTURED)`. Это деньги от клиентов, которые включают:
- Platform commission
- Seller entitlement (основная сумма)
- Marketplace fees

Каноничная «выручка Platform» = Commission accrual (1 001,84 AZN), а не 18 594,91.

**Classification**: FINANCE SEMANTICS GAP, P1

### Finding R2

**EUR/USD не отображаются в headline.** Headline показывает только AZN (PLATFORM_REPORTING_CURRENCY). Multi-currency данные доступны в Financial Summary, но пользователь может не заметить, что 10 533,34 USD Payments не включены в headline Revenue.

**Classification**: UI GAP, P2

---

## 7. Multi-Currency Audit

### Current Contract

```text
PLATFORM_REPORTING_CURRENCY = "AZN" (constant in analytics.service.ts)
primaryCurrencyTotal() — возвращает AZN total, если он существует
Headline KPI — только AZN
Financial Summary — разбивка по валютам
```

### Verification

```
AZN Payments:      18 594,91
EUR Payments:         124,32
USD Payments:      10 533,34
Total (raw sum):   29 252,57 (некорректно — разные валюты)
```

### Finding MC1

**Нет FX conversion.** Multi-currency данные возвращаются как raw amounts без конвертации. Headline KPI использует `primaryCurrencyTotal()` который берёт только AZN. Если AZN отсутствует — берёт первую доступную валюту. Это корректно для native-currency breakdown, но headline не помечен как «AZN only».

**Classification**: UI GAP, P2

---

## 8. AOV Audit

```text
AOV = 118,91 AZN
```

### Formula (from code)

```typescript
// AOV = GMV / count(fulfilled orders) — per currency
const aovByCurrency = {};
for (const [cur, gmvStr] of Object.entries(gmvByCurrency)) {
  const cnt = ordersCountByCurrency.get(cur) || 0;
  aovByCurrency[cur] = cnt === 0 ? "0.00" : (parseFloat(gmvStr) / cnt).toFixed(2);
}
```

### Verification

```
GMV (AZN) = 11 296,26
Fulfilled Orders (AZN) = ?

11 296,26 / 118,91 ≈ 95 orders (AZN-only fulfilled)
```

Total ordersCreated = 214, but fulfilled = 111. AOV uses only fulfilled orders per currency. The AZN-specific fulfilled count is ~95.

### Finding A1

**AOV uses per-currency denominator.** AOV = GMV(CUR) / fulfilledOrders(CUR). Это значит что AOV показанный в headline — это AZN-specific AOV, а не общий. Label «Средний чек» не уточняет currency scope.

**Classification**: UI GAP, P3

---

## 9. Orders / Bookings Reconciliation

```text
Orders Created   = 214
Orders Fulfilled = 111
Bookings         = 122
Bookings Confirmed = 29
Bookings Completed = 73
```

### Relationship

- 1 Order → N Bookings (возможно)
- Bookings создаются через Order → Product → Booking pipeline
- Bookings могут существовать без Order (standalone)
- Period: createdAt для Order и Booking

### Finding OB1

**Bookings > Orders (122 > 111 fulfilled).** Это нормально: bookings включают standalone bookings и могут создаваться из заказов предыдущих периодов. Timestamp — createdAt, не fulfillment timestamp.

**Classification**: CORRECT (not a finding)

### Partner Anomalies

```
Baku Tours Pro: Orders=129, Bookings=17 (Orders >> Bookings)
Old City Walking Tours: Orders=3, Bookings=11 (Bookings > Orders)
```

Это нормально: разные партнёры имеют разные ratio订单到预订. Связь Order→Booking идёт через Product→Partner, не напрямую.

---

## 10. Funnel Audit

### Runtime Data

```
Product Impression:   996   (MarketplaceBehavioralEvent, DISTINCT id)
Product Viewed:         9   (MarketplaceBehavioralEvent, DISTINCT id)
Checkout Started:       0   (CheckoutIntent COUNT)
Order Created:        214   (Order COUNT)
Payment Succeeded:    137   (Payment CAPTURED COUNT)
Booking Confirmed:     29   (Booking CONFIRMED COUNT)
Booking Completed:     73   (Booking COMPLETED COUNT)
```

### Source Analysis

| Stage | Source | Entity | Unique By | Timestamp |
|---|---|---|---|---|
| Product Impression | MarketplaceBehavioralEvent | Event | DISTINCT id | occurredAt |
| Product Viewed | MarketplaceBehavioralEvent | Event | DISTINCT id | occurredAt |
| Checkout Started | CheckoutIntent | Intent | COUNT | createdAt |
| Order Created | Order | Order | COUNT | createdAt |
| Payment Succeeded | Payment | Payment | COUNT | paidAt (CAPTURED) |
| Booking Confirmed | Booking | Booking | COUNT | createdAt (CONFIRMED) |
| Booking Completed | Booking | Booking | COUNT | createdAt (COMPLETED) |

### Critical Issue: NOT a Conversion Funnel

**Это НЕ monotonically decreasing conversion funnel.** Причины:

1. **Different data sources**: behavioral events (impressions/views) vs transactional (orders/payments/bookings)
2. **Different uniqueness**: impressions = DISTINCT event IDs, orders = all orders (not unique visitors)
3. **Different timestamps**: impressions use `occurredAt`, orders use `createdAt`, payments use `paidAt`
4. **0 Checkout Started, 214 Order Created**: checkout intent tracking is incomplete/absent
5. **73 Booking Completed > 29 Booking Confirmed**: completed bookings may include those confirmed in prior periods but completed in this period (createdAt-based)
6. **No cohort semantics**: not tracking same entities through stages

### Finding F1

**UI label «Воронка конверсии» семантически неверен.** Это набор независимых activity counters из разных data sources, не связанная conversion funnel. Нельзя вычислить conversion rate между stages.

**Classification**: DATA SEMANTICS GAP, P1

### Finding F2

**0 Checkout Started при 214 Order Created.** CheckoutIntent tracking либо отсутствует, либо Orders создаются без checkout (API, seed, admin). Это делает stage «Checkout Started» бесполезным.

**Classification**: DATA QUALITY GAP, P2

### Finding F3

**73 Booking Completed > 29 Booking Confirmed.** Bookings use createdAt, так что booking created as COMPLETED в этом периоде считается completed, но не confirmed. Это корректно для independent counters, но неверно для funnel semantics.

**Classification**: DATA SEMANTICS GAP, P2

---

## 11. Behavioral Telemetry Audit

```text
Sessions:            18  (COUNT(DISTINCT sessionId) FROM BehavioralEvent)
Product Viewed:       9  (COUNT(DISTINCT id) WHERE eventType=VIEWED)
Orders:             214  (Order COUNT)
```

### Analysis

- **Sessions = 18**: BehavioralEvent tracking is sparse (only marketplace events captured)
- **Product Viewed = 9**: Very low compared to 214 orders — most orders placed without product view tracking
- **Orders = 214**: Includes seed/API/admin-created orders that bypass behavioral tracking

### Finding T1

**Telemetry неполная.** Behavioral events (sessions, views) покрывают только marketplace storefront interactions. Orders создаются через API/seed без behavioral trail. Нельзя рассчитывать conversion rates на этих данных.

**Classification**: DATA QUALITY GAP, P2

---

## 12. Customers / Partners Semantics

### Customers = 129

```text
marketplaceCustomers: 79  (COUNT(DISTINCT customerId) WHERE acquisitionSource=MARKETPLACE)
storefrontCustomers:  50  (COUNT(DISTINCT customerId) WHERE acquisitionSource=PARTNER_STOREFRONT)
```

**Semantics**: уникальные покупатели, разместившие заказы в периоде. НЕ registered users, НЕ active customers.

### Partners = 33

```text
marketplacePartners: 27  ( partners с ≥1 PUBLISHED product в MARKETPLACE channel)
storefrontPartners:   6  ( partners с ACTIVE storefront)
```

**Semantics**: партнёры с опубликованными товарами / активным storefront. НЕ все partner records.

### Finding CP1

**Label «Клиенты» = уникальные покупатели с заказами.** Не включает зарегистрированных без заказов. Label корректен для текущей семантики.

**Classification**: CORRECT (not a finding)

---

## 13. Partner Performance Audit

### Completion Percentage — CRITICAL

```
Baku Tours Pro:        Completion=200  (200%)
Silk Road Explorers:   Completion=100  (100%)
Old City Walking Tours: Completion=400 (400%)
Gabala Mountain Lodge:  Completion=200 (200%)
```

### Root Cause (from code)

```typescript
// Backend formula:
const completionRate =
  data.confirmedBookings === 0
    ? null
    : Math.round(
        (data.completedBookings / data.confirmedBookings) * 10000,
      ) / 100;
```

Backend returns `200` meaning 200%. Then frontend:

```typescript
{p.bookingCompletionRate != null ? `${(p.bookingCompletionRate * 100).toFixed(0)}%` : "—"}
```

**Frontend multiplies by 100 again!** Backend already returns percentage (200), frontend treats it as fraction (0-1) and displays 200 × 100 = 20000%.

### Semantic Issue

Even without double multiplication, `completedBookings / confirmedBookings` can exceed 100% because:
- Bookings created as COMPLETED in period (createdAt-based)
- Confirmed bookings from prior period may complete in this period
- Independent counting, not cohort-based

### Finding C1

**Completion % — double multiplication.** Backend возвращает проценты (200), frontend умножает на 100 ещё раз → 20000%. Root cause: `bookingCompletionRate * 100` в frontend при уже процентном значении от backend.

**Classification**: UI GAP, P0

### Finding C2

**Completion semantics — completedBookings / confirmedBookings.** Ratio может превышать 100% из-за period mismatch (completed в этом периоде, confirmed в предыдущем). Это не cohort-based completion rate.

**Classification**: DATA SEMANTICS GAP, P2

---

## 14. Time Series / Period / Timezone Audit

### Time Series

```text
Metric: orders (default)
Granularity: DAY
Period: 2026-08-01 → 2026-09-01 (MONTH, UTC)
```

### Reconciliation

```
SUM(daily series) should = Orders KPI = 214
```

Подтверждено в prompt: daily series sum = 214 = headline Orders. ✓

### Finding TS1

**UI не указывает metric явно.** Заголовок «Динамика — DAY» не говорит, что отображается (orders, bookings, payments?). Default metric = "orders", но пользователю это не сообщается.

**Classification**: UI GAP, P3

---

## 15. Source-of-Truth Trace

### Revenue

```
UI: analytics/page.tsx → Kpi items → fmt(m.revenue.current)
  ↓
Frontend API: analyticsApi.getCompanyKpi()
  ↓
HTTP: GET /api/v1/analytics/company-kpi?preset=MONTH
  ↓
Controller: AnalyticsController.getCompanyKpi()
  ↓
Service: getCompanyKpi() → revenueByCurrency = sumDecimalString(payments)
  ↓
Query: prisma.payment.findMany({ where: revenueWhere(start, end) })
  ↓
SQL: SELECT FROM finance."Payment" WHERE status='CAPTURED' AND paidAt >= start AND paidAt < end
  ↓
Formula: SUM(Payment.amount) grouped by currency, primaryCurrencyTotal() → AZN
```

### Completion Rate

```
UI: analytics/page.tsx → `${(p.bookingCompletionRate * 100).toFixed(0)}%`
  ↓
Frontend API: analyticsApi.getPartnerPerformance()
  ↓
HTTP: GET /api/v1/analytics/partner-performance?preset=MONTH
  ↓
Controller: AnalyticsController.getPartnerPerformance()
  ↓
Service: completionRate = Math.round((completedBookings / confirmedBookings) * 10000) / 100
  ↓
Query: prisma.booking.findMany({ where: { createdAt IN period } })
  ↓
Formula: completedBookings / confirmedBookings * 100 (percentage)
  ↓
BUG: Frontend multiplies by 100 again → 20000%
```

---

## 16. Findings Register

| ID | Severity | Category | Observed | Expected/Canonical | Root Cause | Evidence | Recommended Next Action |
|---|---|---|---|---|---|---|---|
| C1 | P0 | UI GAP | Completion=20000% | Completion=200% | Frontend `* 100` on already-percentage backend value | code: `p.bookingCompletionRate * 100` | Remove `* 100` from frontend |
| R1 | P1 | FINANCE SEMANTICS GAP | Revenue=Payments=18594.91 | Revenue=Commission=1001.84 | Revenue formula = SUM(Payment.amount), not Platform Revenue | code: `revenueByCurrency = sumDecimalString(payments)` | Rename to «Платежи клиентов» или implement true Platform Revenue |
| F1 | P1 | DATA SEMANTICS GAP | Non-monotonic funnel | Monotonic conversion funnel | Independent counters from different sources, not cohort-based | runtime: 0 Checkout, 214 Orders, 73>29 Bookings | Rename to «Активность по этапам» или implement real funnel |
| G2 | P2 | DATA SEMANTICS GAP | GMV=Completed GMV=11296.26 | GMV=Qualified GMV=14437.86 | Headline GMV uses FULFILLED+CLOSED filter | code: `orders.filter(o => o.status === "FULFILLED" \|\| o.status === "CLOSED")` | Clarify label or change filter |
| F2 | P2 | DATA QUALITY GAP | 0 Checkout Started | >0 | CheckoutIntent tracking incomplete | runtime: checkoutIntent.count=0 | Seed checkout intents or remove stage |
| F3 | P2 | DATA SEMANTICS GAP | 73 Completed > 29 Confirmed | Completed ≤ Confirmed | createdAt-based independent counting | code: separate queries for CONFIRMED and COMPLETED | Document as independent counters, not funnel |
| C2 | P2 | DATA SEMANTICS GAP | Completion >100% possible | ≤100% | Period mismatch: confirmed in prior, completed in this | code: `completedBookings / confirmedBookings` | Use cohort-based or document semantics |
| R2 | P2 | UI GAP | EUR/USD not in headline | Currency label on headline | primaryCurrencyTotal() returns AZN only | code: `PLATFORM_REPORTING_CURRENCY = "AZN"` | Add currency label to headline KPI |
| MC1 | P2 | UI GAP | No FX conversion | FX conversion or explicit native | No reporting currency FX policy | code: no FX logic | Add currency label or implement FX |
| T1 | P2 | DATA QUALITY GAP | Sessions=18, Views=9, Orders=214 | Consistent telemetry | Behavioral events sparse, orders bypass tracking | runtime data | Accept as demo data limitation |
| A1 | P3 | UI GAP | AOV=118.91 (AZN-only) | Currency scope labeled | Per-currency AOV, headline shows AZN | code: per-currency calculation | Add currency label |
| TS1 | P3 | UI GAP | Time series metric unlabeled | Metric label | Default metric=orders, not shown in UI | frontend: no metric label | Add metric label to time series title |

---

## 17. Architecture Conflicts

### Platform Revenue vs Customer Payments

```text
CURRENT:   Revenue = SUM(Payment.amount) = Customer funds received
CANONICAL: Platform Revenue = Commission + Fees - Platform Refund Liability
GAP TYPE:  FINANCE SEMANTICS GAP
IMPACT:    Headline «Выручка» завышена на ~17x (18594 vs 1001 commission)
```

Это уже известный gap из Step 3.12 Scope Reconciliation (G-gap вFinance architecture). Текущая реализация намеренно упрощена для MVP.

---

## 18. Recommended Remediation Scope

### Must-Fix (before production)

| ID | Action | Scope |
|---|---|---|
| C1 | Remove `* 100` from frontend Completion formatter | frontend only |
| R1 | Rename «Выручка» → «Платежи клиентов» или добавить subtitle | frontend i18n |
| F1 | Rename «Воронка конверсии» → «Активность по этапам» | frontend i18n |

### Should-Fix (before Step 3.12)

| ID | Action | Scope |
|---|---|---|
| G2 | Clarify GMV label or change to qualified GMV | frontend label |
| R2 | Add currency label to headline KPIs | frontend |
| MC1 | Add currency label to Financial Summary | frontend |

### Deferred (Finance Architecture scope)

| ID | Action | Scope |
|---|---|---|
| R1-full | Implement true Platform Revenue calculation | backend + Finance |
| F1-full | Implement real cohort-based conversion funnel | backend + telemetry |
| T1 | Complete behavioral telemetry coverage | backend + seed |

---

## 19. Final Verdict

```
VERDICT B — ANALYTICS DATA / KPI REMEDIATION REQUIRED
```

Найдены 3 blocking findings (C0, R1, F1), требующие remediation до использования Analytics page в production. Остальные findings are non-blocking but should be addressed.

### Blocking Findings Summary

1. **C1 (P0)**: Completion % = 20000% вместо 200% — double multiplication bug
2. **R1 (P1)**: «Выручка» = Customer Payments, не Platform Revenue — semantic mislabel
3. **F1 (P1)**: «Воронка конверсии» = independent activity counters, не funnel — semantic mislabel

---

## 20. Canonical NEXT

```
PHASE 3 — STEP 3.12 — USERS & ACCESS COMPLETION
DO NOT AUTO-START
```

Awaiting separate remediation prompt for findings C1, R1, F1.
