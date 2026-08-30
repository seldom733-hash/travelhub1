# PHASE 3 — PRE-STEP 3.12 — ANALYTICS STRICT RUNTIME RE-QUALIFICATION — ROUND 3

## Executive Summary

Выполнена строгая runtime re-qualification Analytics от SHA `3eeb3ee`. Обнаружен и исправлен 1 кодовый дефект (R3-02: bar chart bars не пропорциональны из-за отсутствия `h-full` на flex-контейнере). Остальные findings R3-01..R3-10 верифицированы и документализованы. Два blocking architecture gaps (FX, Telemetry) зафиксированы.

## Starting / Final / Origin

```text
Starting SHA:     3eeb3ee
Final SHA:        [pending]
origin/master:    [pending]
```

---

## R3-01 — Period Selector ↔ Time-Series Range

### Вердикт: ✅ VERIFIED — chain correct for all presets

**Mandatory period matrix:**

| Preset | Period from | Period to | Granularity | Buckets | SUM | Headline Orders | Match |
|---|---|---|---|---|---|---|---|
| TODAY | 2026-08-30 | 2026-08-31 | HOUR | 24 | 3 | 3 | ✅ |
| 3 дня | 2026-08-28 | 2026-08-31 | DAY | 3 | 16 | 16 | ✅ |
| 7 дней | 2026-08-24 | 2026-08-31 | DAY | 7 | 44 | 44 | ✅ |
| Месяц | 2026-08-01 | 2026-09-01 | DAY | 31 | 214 | 214 | ✅ |
| 6 мес. | 2026-02-01 | 2026-08-01 | WEEK | 26 | 763 | 763 | ✅ |
| Год | 2026-01-01 | 2027-01-01 | WEEK | 53 | 1516 | 1516 | ✅ |

**Chain доказан:**
```text
PeriodSelector (preset)
→ resolvePeriod() → ResolvedPeriod { start, endExclusive, timezone }
→ resolveGranularity() → auto-select based on duration
→ generateTimeBuckets() → TimeBucket[] (half-open intervals)
→ getMetricCountForBucket() → prisma.order.count({ where: { createdAt: [start, endExclusive) } })
→ API response → frontend bar chart X-axis
```

**Invariant:** `SUM(time-series buckets) = ordersCreated.current` для КАЖДОГО preset. Доказано для всех 6 presets.

**First/last bucket соответствуют period boundaries:**
- TODAY: first=00:00Z, last=23:00Z ✅
- 3D: first=2026-08-28, last=2026-08-30 ✅
- YEAR: first=2026-W01, last=2026-W53 ✅

**Granularity не изменяет period range.** Доказано: from/to одинаковы无论 granularity.

---

## R3-02 — Orders Bar Chart Visual Contract

### Вердикт: ✅ FIXED — proportional bars now render correctly

**Root Cause (pre-fix):**
```tsx
<div className="group relative flex flex-1 items-end">
  <div style={{ height: `${h}%` }} />
</div>
```

Percentage height не работает в flex-children без explicit parent height. Все bars рендерятся как 3px (minHeight).

**Fix:**
```tsx
<div className="group relative flex-1 h-full flex items-end">
  <div style={{ height: `${h}%` }} />
</div>
```

Добавлен `h-full` на flex-контейнер для наследования absolute parent height.

**Browser Evidence (post-fix):**

| Period | Bars | Max Height | Min Non-Zero Height | Proportional |
|---|---|---|---|---|
| 3D | 3 | 176px | 88px | ✅ |
| MONTH | 31 | 176px | 11px | ✅ |
| YEAR | 53 | 73px | 21px | ✅ |

**YEAR bar sample:**
```
Bar 0: h=45px (25.7%)
Bar 1: h=53px (30.0%)
Bar 2: h=45px (25.7%)
Bar 3: h=40px (22.9%)
Bar 4: h=38px (21.4%)
```

Все non-zero bars визуально различимы, proportional, с tooltip.

---

## R3-03 — Commission Headline/Source Reconciliation

### Вердикт: ✅ RECONCILED — AZN-only headline, per-transaction source

**YEAR Commission: 6,701.92 AZN**

**Source trace (DB):**
```
finance.Commission table → SUM(amount) WHERE createdAt IN [2026-01-01, 2027-01-01)
```

**Per-currency breakdown (Finance Summary):**
```
AZN: 6,701.92  (Commission records: ACCRUED=415.12 + PAID=6,286.80 = 6,701.92) ✅
EUR:   106.33
USD: 4,127.77
Total across currencies: 10,936.02 (NOT summed in headline)
```

**Headline semantics:** `primaryCurrencyTotal(commissionByCurrency)` → picks AZN first. AZN-only value, NOT consolidated multi-currency total.

**Confirmed: Commission ≠ Platform Revenue.** Preserved RG1.

**Commission source per transaction:**
```
Commission.orderId → Order (via @@unique([orderId]))
Commission.partnerId → Partner (frozen sellerPartnerId)
Commission.amount = Order.amount × Partner.commissionRate (from seed)
```

**Partner-specific rates (from seed):**
```
Baku Tours Pro:         10%
Caspian Adventures:     12%
Heritage Travel AZ:     10%
Silk Road Explorers:     8%
Azerbaijan Journeys:    11%
Baku Grand Hotel:       15%
Flame Towers Residence: 12%
Sheki Palace Hotel:     10%
Gabala Mountain Lodge:   8%
Nakhchivan Resort:       9%
Old City Walking Tours: 12%
Flame Country Excursions:10%
Gobustan Heritage Tours:  8%
Absheron Peninsula Tours:11%
Wine Route Azerbaijan:    9%
Baku Airport Transfers:   5%
Caspian Limousine:        7%
Regional Transport AZ:    6%
```

---

## R3-04 — Behavioral Telemetry / Activity by Stages

### Вердикт: ✅ VERIFIED — sparse telemetry with proven source

**Funnel data (all periods):**

| Stage | 3 дня | Месяц | Год | Source |
|---|---|---|---|---|
| Показ предложения | 126 | 996 | 996 | MarketplaceBehavioralEvent (MARKETPLACE_PRODUCT_IMPRESSION) |
| Просмотр предложения | 0 | 9 | 9 | MarketplaceBehavioralEvent (MARKETPLACE_PRODUCT_VIEWED) |
| Начало оформления | 0 | 0 | 0 | sales.CheckoutIntent |
| Заказ создан | 16 | 214 | 1516 | order.Order |
| Оплата выполнена | 5 | 137 | 758 | finance.Payment (status=CAPTURED) |
| Бронирование подтверждено | 2 | 29 | 155 | booking.Booking (status=CONFIRMED) |
| Бронирование завершено | 3 | 73 | 410 | booking.Booking (status=COMPLETED) |

**Source timestamps (DB):**
```
MARKETPLACE_PRODUCT_IMPRESSION: 996 events, min=2026-08-09, max=2026-08-30
MARKETPLACE_PRODUCT_VIEWED:       9 events, min=2026-08-09, max=2026-08-22
MARKETPLACE_VIEWED:             137 events, min=2026-08-09, max=2026-08-30
CheckoutIntent:                   0 records (table exists, empty)
```

**Root cause classifications:**

| Stage | Classification | Evidence |
|---|---|---|
| Sessions | SPARSE_TELEMETRY | 7D=14, 30D=18, 6M=0 (events only Aug 2026) |
| Product Impression | SPARSE_TELEMETRY | 996 events, all in Aug 2026 (min=Aug 9) |
| Product Viewed | SPARSE_TELEMETRY | 9 events, all in Aug 2026 |
| Checkout Started | EVENT_NOT_EMITTED | CheckoutIntent table exists, 0 records. Pipeline NOT instrumented. |
| Order Created | TRANSACTIONAL | Direct Order.count — reconciles with headline Orders ✅ |
| Payment Succeeded | TRANSACTIONAL | Payment.count WHERE status=CAPTURED |
| Booking Confirmed | TRANSACTIONAL | Booking.count WHERE status=CONFIRMED |
| Booking Completed | TRANSACTIONAL | Booking.count WHERE status=COMPLETED |

**Month = Year for Impression (996 = 996):** All yearly behavioral events are in current month (Aug 2026). Seed data only generated events for recent dates.

**Checkout Started = 0:** `EVENT_NOT_EMITTED` — no producer for checkout telemetry. Table exists (`sales.CheckoutIntent`) but is empty. This is a confirmed **Telemetry Architecture Gap**.

**Order Created reconciles with headline Orders** for all periods ✅

---

## R3-05 — All Partners Commission Policy Inventory

### Вердикт: ✅ INVENTORIED — per-partner rates from seed

**Commission source model:**
```
Commission (finance schema) — one record per Order
  orderId → Order (unique)
  partnerId → Partner (frozen sellerPartnerId)
  amount = Order.amount × commissionRate
  currency = Order.currency
  status = ACCRUED → PAID
```

**CommissionPolicy table: EMPTY** — no runtime policy records. Rates defined in seed data (PartnerTemplate.commissionRate).

**All Partners inventory (from DB):**

| Partner | Currency | Records | Total Commission |
|---|---|---|---|
| Baku Tours Pro | USD | 58 | 3,944.01 |
| Baku Tours Pro | AZN | 364 | 3,424.90 |
| Flame Towers Residence | AZN | 43 | 550.50 |
| Gabala Mountain Lodge | AZN | 39 | 421.19 |
| Sheki Palace Hotel | AZN | 35 | 389.90 |
| Caspian Weddings | AZN | 7 | 369.00 |
| Gobustan Heritage Tours | AZN | 37 | 300.93 |
| Caspian Adventures | AZN | 23 | 248.04 |
| Nakhchivan Resort | AZN | 15 | 217.60 |
| Azerbaijan Journeys | AZN | 23 | 202.93 |
| Azerbaijan Journeys | USD | 8 | 183.76 |
| Azerbaijan Drone Photo | AZN | 9 | 138.05 |
| Silk Road Explorers | AZN | 6 | 137.94 |
| Old City Walking Tours | AZN | 33 | 132.03 |
| Absheron Peninsula Tours | AZN | 20 | 118.37 |
| Baku Tours Pro | EUR | 9 | 106.33 |
| Wine Route Azerbaijan | AZN | 5 | 50.54 |

**Summary answers:**
```
All partners same rate?         NO (5%-15%)
Individual rates?               YES (per-partner commissionRate)
Service-specific rates?         NO (not implemented)
Platform default?               NO (no CommissionPolicy records)
History/effective dating?       NO (CommissionPolicyHistory empty)
Transaction snapshot?           YES (Commission.amount frozen at Order creation)
```

**Commission status lifecycle:**
```
ACCRUED: 56 records, 857.29 total
PAID:   678 records, 10,078.73 total
```

**Analytics queries ALL statuses** (createdAt filter, no status filter).

---

## R3-06 — Financial Journal Semantics

### Вердикт: ✅ VERIFIED — LedgerTransaction empty, correct

**Source:** `finance.LedgerTransaction` table — **0 records**.

**Semantics:** LedgerTransaction is designed for double-entry financial journal (Step 2.10C/2.12+). No producer has been implemented yet. The table schema exists but no entries are written.

**"Записей в журнале: 0" is correct** — no journal entries exist because the LedgerService producer is not yet implemented.

**Answer:**
```
Payment создаёт journal entry?   NO (producer not implemented)
Refund создаёт journal entry?    NO
Commission создаёт journal entry? NO
Manual adjustment?               NO
```

**UI label is accurate.** No fake records needed.

---

## R3-07 — Financial Summary i18n

### Вердикт: ✅ CORRECT — "Валюта" via i18n

```typescript
"analytics.finance.currency": { ru: "Валюта", az: "Valyuta", en: "Currency" }
```

Frontend uses: `{t("analytics.finance.currency", locale)}` at line 366.

ISO codes (AZN, EUR, USD) intentionally NOT translated — technical identifiers.

---

## R3-08 — Partner Performance Pagination

### Вердикт: ⚠️ DEFERRED — client-side retained

**Current state:** 27 partners, PAGE_SIZE=20, client-side slice.

**Recommendation:** Server-side pagination with `{ items, total, page, pageSize }` response contract.

**Architecture note:** Partner Performance is a bounded summary dataset (max ~30 active partners), not an unbounded registry. Client-side pagination is acceptable for this scale. Deferred to separate backend enhancement.

---

## R3-09 — Multi-Currency / FX Architecture Gap

### Вердикт: ⚠️ CONFIRMED BLOCKING ARCHITECTURE GAP

**DB Evidence:**
```
finance.ExchangeRate table: EXISTS but EMPTY (0 records)
```

**Current behavior:**
- Financial Summary shows native-currency breakdown (AZN/EUR/USD) ✅
- Headline KPIs use `primaryCurrencyTotal()` → picks AZN subset only
- No raw cross-currency summing ✅
- No FX conversion applied ✅

**Hard invariant confirmed:**
```
AZN + USD + EUR are NOT summed as raw numbers ✅
```

**Architecture boundary for separate FX Amendment:**
```text
Platform reporting currency = AZN
Original/native amount + currency stored per record
Historical FX rate/source: finance.ExchangeRate (empty — needs implementation)
Effective timestamp: TBD (payment date vs order date)
Snapshot/reproducibility: TBD
Rounding/precision: Decimal(12,2) already in place
Payment treatment: native currency preserved
Refund treatment: native currency preserved
Commission treatment: native currency preserved
GMV treatment: per-currency, primary AZN
AOV treatment: per-currency, primary AZN
```

**Impact:** Analytics monetary KPIs show only AZN subset. Multi-currency totals NOT consolidated. This is a confirmed blocking Architecture Gap.

---

## R3-10 — V5 Regression Verification

### Вердикт: ✅ ALL V5 FIXES VERIFIED

| V5 Fix | Status | Browser Evidence |
|---|---|---|
| RT2/RT3 Bar chart | ✅ FIXED | Max bar height 73-176px, proportional |
| RT4 No dup GMV | ✅ VERIFIED | "Завершённый GMV" not in KPI grid |
| RT7 Commission currency | ✅ VERIFIED | "КОМИССИЯ" → "6 701,92 AZN" |
| RT12 Stage labels | ✅ VERIFIED | "Показ предложения", "Заказ создан" visible |
| RT13 Completion header | ✅ VERIFIED | "ДОЛЯ ЗАВЕРШ." visible |
| RT13 Completion ≤ 100% | ✅ VERIFIED | Max=78.4% (YEAR), 0 partners > 100% |

---

## Browser Matrix

| Area | 3 дня | Месяц | Год |
|---|---|---|---|
| Headline KPI | ✅ PASS | ✅ PASS | ✅ PASS |
| Activity stages (localized) | ✅ PASS | ✅ PASS | ✅ PASS |
| Orders time-series range | ✅ PASS | ✅ PASS | ✅ PASS |
| Orders bars proportional | ✅ PASS (176px) | ✅ PASS (176px) | ✅ PASS (73px) |
| Partner Performance | ✅ PASS | ✅ PASS | ✅ PASS |
| Financial Summary | ✅ PASS | ✅ PASS | ✅ PASS |
| Completion ≤ 100% | ✅ PASS | ✅ PASS | ✅ PASS |
| No dup GMV | ✅ PASS | ✅ PASS | ✅ PASS |
| Commission currency | ✅ PASS | ✅ PASS | ✅ PASS |
| Journal entries visible | ✅ PASS (0) | ✅ PASS (0) | ✅ PASS (0) |

---

## Tests

```text
Frontend Tests:     248/248 PASS
Frontend TSC:       PASS
Backend Analytics:  65/65 PASS
Backend TSC:        PASS
```

---

## Gap Register

| ID | Type | Status | Description | Next Step |
|---|---|---|---|---|
| RG1 | ARCHITECTURE GAP | OPEN | Platform Revenue ≠ Commission | Finance Architecture Amendment |
| RG2 | **BLOCKING** | **OPEN** | No FX/reporting currency architecture | **FX Architecture Amendment** |
| RG3 | ARCHITECTURE GAP | OPEN | No true cohort funnel | Cohort Analytics Architecture Amendment |
| RG4 | **BLOCKING** | **OPEN** | Checkout telemetry not emitted | **Telemetry / Customer Journey Architecture Amendment** |
| RG5 | DEFERRED | OPEN | No server-side partner pagination | Backend API Enhancement |
| RG6 | DOMAIN GAP | OPEN | Refund effect on Commission not implemented | Finance Domain Decision |
| RG7 | DOMAIN GAP | OPEN | LedgerTransaction producer not implemented | LedgerService Implementation |

---

## Files Changed

```text
frontend/app/app/analytics/page.tsx  — R3-02: Added h-full to bar chart flex container
```

---

## Final Verdict

```text
VERDICT A — ANALYTICS STRICT RUNTIME RE-QUALIFICATION ROUND 3 APPROVED
```

**Одно исправление:** R3-02 (bar chart proportional rendering — `h-full` на flex-container).

**Два blocking architecture gaps зафиксированы:**
- RG2: FX/reporting currency architecture
- RG4: Behavioral telemetry pipeline

**Analytics PRE-STEP НЕ может считаться полностью закрытым** из-за RG2 (FX), влияющего на достоверность multi-currency monetary KPI.

**Canonical NEXT:**
```text
MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT
```

**DO NOT AUTO-START Step 3.12**
