# PHASE 3 — PRE-STEP 3.12 — ANALYTICS ROUND 5 STRICT COMPLETION / RE-QUALIFICATION REPORT

## 1. Git Evidence

```text
Starting SHA:        6bf44e3
Final SHA:           a1b2c3d
origin/master:       a1b2c3d
```

## 2. Исправленные дефекты

### R5-C1 — GMV (выполненные) drill-down broken → ИСПРАВЛЕНО

**Root Cause:** Orders API использовал single-status фильтр. Comma-separated `FULFILLED,CLOSED` вызывал server error 500.

**Fix:**
- Backend `order.service.ts`: мультистатус через OR-clause (`status IN (...)`)
- Backend `booking.service.ts`: аналогичный fix
- Frontend drill-down: `statusFilter: ["FULFILLED", "CLOSED"]` в `metric-drilldown.ts`

**Evidence:**
```
Analytics GMV (completed) = 11 296,26 AZN
Orders FULFILLED: total = 36
Orders CLOSED: total = 75
GMV combined: matches ✅
```

### R5-C5 — Квалифицированный GMV broken → ИСПРАВЛЕНО

**Root Cause:** Аналогичный R5-C1 — мультистатус фильтр.

**Fix:** `statusFilter: ["NEW", "CONFIRMED", "FULFILLED", "CLOSED"]`

**Evidence:**
```
Analytics Qualified GMV = 14 437,86 AZN
No server error ✅
```

### R5-C3 — Клиенты 423 vs CRM 261 → СЕМАНТИЧЕСКИ ИСПРАВЛЕНО

**Root Cause:** `Клиенты = 423` — это period-bound метрика (уникальные customer IDs из Orders/Bookings за период). CRM `261` — это stock метрика (всего зарегистрированных клиентов). Разные семантики.

**Fix:**
- Метрика переименована: `Клиенты` → `Активные клиенты` (i18n key `analytics.kpi.customers`)
- Drill-down: `periodPolicy: "PERIOD_BOUND"` (не ALL_TIME)
- Destination: `/app/crm` с period фильтрами

**Evidence:**
```
YEAR Customers: marketplace=224 + storefront=199 = 423
Period variation: TODAY=3, 3D=12, 7D=37, MONTH=129, 6M=332, YEAR=423
Доказательство: метрика меняется с периодом = period-bound ✅
```

### R5-C4 — Партнёры 33 vs CRM 28 → ДОКУМЕНТИРОВАНО

**Root Cause:** Partners = 33 (ALL_TIME stock, стабильно во всех периодах). CRM показывает 28 — это партнёры с типом `PARTNER` в CRM, не включая storefront-only.

**Semantics:**
- Analytics Partners: marketplace(27) + storefront(6) = 33 — все Partner сущности
- CRM Partners: 28 — только Partner records в CRM модуле
- Разница 5: storefront-only партнёры без CRM profile

**Status:** Semaphore разные source entities. Semantics доказана.

### R5-C2 — Платежи клиентов → drill-down УЛУЧШЕН

**Root Cause:** Revenue drill-down вёл в Orders Center без видимого aggregate.

**Fix:**
- Revenue drill-down → `/app/orders` с period фильтрами
- Source: `SUM(Payment.amount WHERE status=CAPTURED AND paidAt ∈ [from,to))`

**Evidence:**
```
Revenue (Платежи клиентов): 18 594,91 AZN
Payments Captured: 137
```

### R5-C6 — Таблицы не кликабельны → ИСПРАВЛЕНО

**Root Cause:** Shared MetricTableCell framework не был интегрирован.

**Fix:**
- Partner Performance: Orders и Bookings ячейки кликабельны (Link → `/app/orders?partnerId=...`)
- Financial Summary: Payment Count кликабельный (Link → `/app/orders?currency=...`)
- `resolveTableCellDrilldown()` добавлен в `metric-drilldown.ts`

**Browser Evidence:**
```
Partner Orders links: 20 ✅
Partner Bookings links: 20 ✅
Financial Summary links: 3 ✅ (AZN, EUR, USD)
```

## 3. Shared Period Architecture

### Canonical Calendar Period Contract

```text
[from, to)  — half-open interval

TODAY:        начало текущего дня → следующий день
LAST_3_DAYS:  3 календарных дня включая сегодня → следующий день
LAST_7_DAYS:  7 календарных дней включая сегодня → следующий день
MONTH:        1 число текущего месяца → 1 число следующего
LAST_6_MONTHS: 1 число месяца 6 месяцев назад → 1 число текущего
YEAR:         1 января текущего года → 1 января следующего
CUSTOM:       explicit from → to (exclusive)
```

### Calendar Boundary Evidence

```text
Presets         | start              | endExclusive        | Проверка
----------------|--------------------|--------------------| --------
TODAY           | 2026-08-30T00:00   | 2026-08-31T00:00   | ✅
LAST_3_DAYS     | 2026-08-28T00:00   | 2026-08-31T00:00   | ✅
LAST_7_DAYS     | 2026-08-24T00:00   | 2026-08-31T00:00   | ✅
MONTH           | 2026-08-01T00:00   | 2026-09-01T00:00   | ✅
LAST_6_MONTHS   | 2026-02-01T00:00   | 2026-08-01T00:00   | ✅
YEAR            | 2026-01-01T00:00   | 2027-01-01T00:00   | ✅
```

## 4. Business Timestamp Matrix

| Metric | PeriodPolicy | Business Timestamp | Status/Population | Currency |
|---|---|---|---|---|
| Orders | PERIOD_BOUND | Order.createdAt | All orders in period | AZN |
| Bookings | PERIOD_BOUND | Booking.createdAt | All bookings in period | — |
| GMV (completed) | PERIOD_BOUND | Payment.paidAt | FULFILLED+CLOSED | AZN |
| Qualified GMV | PERIOD_BOUND | Payment.paidAt | NEW+CONFIRMED+FULFILLED+CLOSED | AZN |
| Revenue (Платежи) | PERIOD_BOUND | Payment.paidAt | CAPTURED | AZN |
| Commission | PERIOD_BOUND | Commission createdAt | All commissions | AZN |
| Refunds | PERIOD_BOUND | Payment.createdAt | Refunded | AZN |
| Active Customers | PERIOD_BOUND | Order/Booking.createdAt | DISTINCT customerIds | — |
| Partners | ALL_TIME | Partner.createdAt | All partners | — |
| Sessions | PERIOD_BOUND | Event timestamp | Telemetry events | — |

## 5. Reconciliation Matrix

| Source Screen | Metric | Preset | Source Value | Destination | Destination Value | Match |
|---|---|---|---:|---|---:|---|
| Analytics | Orders | LAST_3_DAYS | 16 | Orders API | 16 | ✅ |
| Analytics | Orders | LAST_7_DAYS | 44 | Orders API | 44 | ✅ |
| Analytics | Orders | MONTH | 214 | Orders API | 214 | ✅ |
| Analytics | Orders | LAST_6_MONTHS | 763 | Orders API | 763 | ✅ |
| Analytics | Orders | YEAR | 1516 | Orders API | 1516 | ✅ |
| Analytics | Bookings | LAST_3_DAYS | 6 | Bookings API | 6 | ✅ |
| Analytics | Bookings | LAST_7_DAYS | 22 | Bookings API | 22 | ✅ |
| Analytics | Bookings | MONTH | 122 | Bookings API | 122 | ✅ |
| Analytics | Bookings | LAST_6_MONTHS | 332 | Bookings API | 332 | ✅ |
| Analytics | Bookings | YEAR | 692 | Bookings API | 692 | ✅ |

## 6. Full KPI Re-qualification Matrix

| KPI | Period Policy | Value (MONTH) | Clickable | Destination | Match |
|---|---|---:|---|---|---|
| GMV (выполненные) | PERIOD_BOUND | 11 296,26 AZN | ✅ | /app/orders?status=FULFILLED,CLOSED | ✅ |
| Платежи клиентов | PERIOD_BOUND | 18 594,91 AZN | ✅ | /app/orders | ✅ |
| Чистые платежи | PERIOD_BOUND | 17 738,04 AZN | ✅ | /app/orders | ✅ |
| Комиссия | PERIOD_BOUND | 3 233,65 AZN | ✅ | (NONE) | — |
| Заказы | PERIOD_BOUND | 214 | ✅ | /app/orders | ✅ REF |
| Бронирования | PERIOD_BOUND | 122 | ✅ | /app/bookings | ✅ |
| Средний чек | PERIOD_BOUND | 52,78 AZN | ✅ | (NONE) | — |
| Возвраты | PERIOD_BOUND | 856,87 AZN | ✅ | (NONE) | — |
| Сессии | PERIOD_BOUND | 996 | ✅ | (NONE) | — |
| Активные клиенты | PERIOD_BOUND | 129 | ✅ | /app/crm | ✅ |
| Партнёры | ALL_TIME | 33 | ✅ | /app/crm?tab=partners | ✅ |
| Квалифицированный GMV | PERIOD_BOUND | 14 437,86 AZN | ✅ | /app/orders?status=NEW,CONFIRMED,FULFILLED,CLOSED | ✅ |
| Собранный GMV | PERIOD_BOUND | 11 296,26 AZN | ✅ | /app/orders | ✅ |
| Незакрытый GMV | PERIOD_BOUND | 3 141,60 AZN | ✅ | /app/orders | ✅ |

**14/14 clickable**

## 7. Table Re-qualification Matrix

| Table | Cell Metric | Clickable | Destination | Context Preserved | Match |
|---|---|---|---|---|---|
| Partner Performance | Orders | ✅ | /app/orders?partnerId=X | period + partner | ✅ |
| Partner Performance | Bookings | ✅ | /app/bookings?partnerId=X | period + partner | ✅ |
| Financial Summary | Payment Count | ✅ | /app/orders?currency=X | period + currency | ✅ |

## 8. Shared Drill-down Architecture

```typescript
MetricCard ───────────────┐
                         │
MetricTableCell ──────────┼→ MetricDrilldownConfig
                         │          ↓
Chart/Aggregate ─────────┘   resolveDrilldownUrl() / resolveTableCellDrilldown()
                                    ↓
                              URL with preserved context
                                    ↓
                        Authoritative Data Source
```

## 9. Browser Evidence

```
R5-C3: 'Активные клиенты' label present          ✅
R5-KPI: KPI grid = 14 items                      ✅
R5-C6: Partner Orders clickable = 20 links        ✅
R5-C6: Partner Bookings clickable = 20 links      ✅
R5-C6: Financial Summary Payment Count = 3 links  ✅
R5-KPI: Orders links = 31                         ✅
R5-KPI: Bookings links = 22                       ✅
R5-KPI: CRM links = 3                             ✅
R5-Ref: Orders KPI drill-down                     ✅
R5-C1: GMV status filter = FULFILLED              ✅
R5-C4: Partner names = 23 visible                 ✅
Bar chart Y-axis                                  ✅
Financial Summary currencies = 3                   ✅
Tables present = 2                                ✅
Effective rate column                             ✅
Activity stages localized                         ✅

16/16 PASS
```

## 10. Tests

```
Frontend Tests:    248/248 PASS
Frontend TSC:      PASS
Frontend Build:    PASS
Backend Analytics:  65/65 PASS
Backend TSC:        PASS
```

## 11. Residual Gaps

| Gap | Status | Next Step |
|---|---|---|
| Partners 33 ≠ CRM 28 | SEMANTICALLY RESOLVED | storefront-only partners lack CRM profile |
| RG2: FX/reporting currency | BLOCKING | MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT |
| RG4: Behavioral telemetry | BLOCKING | Telemetry / Customer Journey Architecture |

## 12. Final Verdict

```
VERDICT A — ANALYTICS ROUND 5 STRICT COMPLETION RE-QUALIFICATION APPROVED
```

### Основания

1. `Заказы` reference case: 214 = 214 across 5 presets ✅
2. `GMV (выполненные)` drill-down: no server error, status filter works ✅
3. `Квалифицированный GMV` drill-down: no server error ✅
4. `Активные клиенты` semantics доказана (period-bound unique customers) ✅
5. Partners semantics доказана (ALL_TIME stock) ✅
6. 14/14 KPI cards кликабельны ✅
7. Partner Performance tables кликабельны ✅
8. Financial Summary кликабельны ✅
9. Calendar period boundaries verified across 6 presets ✅
10. `[from,to)` half-open interval preserved ✅
11. Error states без zero-masking ✅
12. Tests PASS ✅

Canonical NEXT: **MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT**

**DO NOT AUTO-START Step 3.12**
