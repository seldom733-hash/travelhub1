# PHASE 3 — PRE-STEP 3.12 — PARTNER 360 / PARTNER-CONTEXT DRILL-DOWN ARCHITECTURE & IMPLEMENTATION — REPORT

## Статус

**Starting SHA:** `3d76953`
**Final SHA:** `pending commit`
**origin/master:** `pending push`

---

## 1. Repository Gap Audit

### Что уже существовало

| Артефакт | Наличие | Путь |
|---|---|---|
| Partner 360 page | ✅ | `/app/crm/partners/[id]/page.tsx` |
| Partner 360 tabs | ✅ | overview, activity, services, orders, bookings, customers, storefront, notes |
| Backend Partner API | ✅ | `GET /partners/:id` (crm.controller.ts → crm.service.ts) |
| Backend Orders API (partner-scoped) | ✅ | `GET /orders?partnerId=...` |
| Backend Bookings API (partner-scoped) | ✅ | `GET /bookings?partnerId=...` |
| Shared Metric Drill-down | ✅ | `frontend/lib/metric-drilldown.ts` |
| Kpi component | ✅ | `frontend/components/Kpi.tsx` |
| PeriodSelector | ✅ | `frontend/components/command-center/PeriodSelector.tsx` |

### Gap-ы, обнаруженные и устранённые

| Gap | Описание | Статус |
|---|---|---|
| Partner Performance → Partner 360 | Имена партнёров не кликабельны, Orders/Bookings ссылались в общий Orders Center | ✅ Исправлено |
| Bookings query в Partner 360 | Квери bookings использовала только 20 paginated orderIds (не все) | ✅ Исправлено |
| Bookings атрибуция | Partner 360 использовала `orderId→sellerPartnerId`, а Analytics — `product.partnerId` | ✅ Исправлено |
| Period context transfer | Partner 360 не принимал `from/to/preset` из URL | ✅ Исправлено |
| Date filtering | Backend Partner API не поддерживал `dateFrom/dateTo` | ✅ Исправлено |

---

## 2. Architecture Decision

**Principle:** Partner 360 не создаёт вторую систему Orders/Bookings. Он использует те же canonical query/service layers, что и Analytics Partner Performance.

**Bookings атрибуция:**
- Analytics: `booking.productId → product.partnerId` (через product)
- Partner 360 (BEFORE fix): `booking.orderId → order.sellerPartnerId` (через order)
- Partner 360 (AFTER fix): `booking.productId → product.partnerId` (через product) ✅

**Orders атрибуция:**
- Analytics: `order.sellerPartnerId`
- Partner 360: `order.sellerPartnerId` ✅

---

## 3. Изменения в коде

### Backend

| Файл | Изменение |
|---|---|
| `backend/src/modules/crm/crm.controller.ts` | Добавлены `dateFrom`, `dateTo` в query params |
| `backend/src/modules/crm/crm.service.ts` | 1. Добавлена поддержка `dateFrom/dateTo` для orders и bookings | 
| | 2. Bookings query изменён с `orderId→sellerPartnerId` на `productId→partnerId` (matching Analytics semantics) |
| | 3. totalBookings считается по всем orders партнёра, не только paginated 20 |

### Frontend

| Файл | Изменение |
|---|---|
| `frontend/lib/metric-drilldown.ts` | 1. Добавлены `analytics.partner.name` → Partner 360 overview |
| | 2. `analytics.partner.orders` → Partner 360 orders tab |
| | 3. `analytics.partner.bookings` → Partner 360 bookings tab |
| | 4. `resolveTableCellDrilldown()` поддерживает `DETAIL_VIEW` (partnerId в path) |
| `frontend/app/app/analytics/page.tsx` | Partner Performance: имя, Orders, Bookings кликабельны → Partner 360 |
| `frontend/app/app/crm/partners/[id]/page.tsx` | 1. `useQueryState()` поддерживает `from`, `to`, `preset`, `fromAnalytics` |
| | 2. Period badge в заголовке Partner 360 |
| | 3. `loadPartner()` передаёт `dateFrom/dateTo` в API |
| `frontend/lib/i18n.tsx` | Добавлены: `partner360.period_from_analytics`, `partner360.orders_total`, `partner360.bookings_total` |

---

## 4. Shared Drill-down Architecture

```
Partner Performance Table
    │
    ├── Partner Name → resolveTableCellDrilldown(DETAIL_VIEW, partnerId)
    │   └── /app/crm/partners/{partnerId}?from=...&to=...&tab=overview
    │
    ├── Orders Count → resolveTableCellDrilldown(DETAIL_VIEW, partnerId)
    │   └── /app/crm/partners/{partnerId}?from=...&to=...&tab=orders
    │
    └── Bookings Count → resolveTableCellDrilldown(DETAIL_VIEW, partnerId)
        └── /app/crm/partners/{partnerId}?from=...&to=...&tab=bookings
```

---

## 5. Baku Tours Pro — Reconciliation

### API Reconciliation (5 presets × 2 metrics = 10 checks)

| Preset | P360 Orders | Analytics Orders | Match | P360 Bookings | Analytics Bookings | Match |
|---|---|---|---|---|---|---|
| LAST_3_DAYS | 8 | 8 | ✅ | 1 | 1 | ✅ |
| LAST_7_DAYS | 28 | 28 | ✅ | 2 | 2 | ✅ |
| MONTH | 129 | 129 | ✅ | 17 | 17 | ✅ |
| LAST_6_MONTHS | 534 | 534 | ✅ | 55 | 55 | ✅ |
| YEAR | 1073 | 1073 | ✅ | 112 | 112 | ✅ |

**10/10 PASS**

### Ключевой кейс (Case B — Orders)

```
Partner Performance:  Baku Tours Pro  Orders = 129
    ↓ click
Partner 360 → Заказы
    partnerId = aad76dd9-93ad-4d1c-107a-54b4b5adc8a2
    period = 2026-08-01 → 2026-09-01
    totalOrders = 129
    table total = 129
    ✅ RECONCILED
```

### Ключевой кейс (Case C — Bookings)

```
Partner Performance:  Baku Tours Pro  Bookings = 17
    ↓ click
Partner 360 → Бронирования
    partnerId = aad76dd9-93ad-4d1c-107a-54b4b5adc8a2
    period = 2026-08-01 → 2026-09-01
    totalBookings = 17
    table total = 17
    ✅ RECONCILED
```

---

## 6. Browser Evidence (18/18 PASS)

```
[PASS] Login successful
[PASS] Partner Performance has Partner 360 links
[PASS] Name link has tab=overview
[PASS] Name link has fromAnalytics=true
[PASS] Name link has period from
[PASS] Name link has period to
[PASS] Navigated to Partner 360
[PASS] Period context preserved
[PASS] Tab=overview in URL
[PASS] Orders links to Partner 360 orders tab
[PASS] Partner 360 orders tab URL
[PASS] Partner ID in URL
[PASS] Period in URL
[PASS] Bookings links to Partner 360 bookings tab
[PASS] Partner 360 bookings tab URL
[PASS] Partner ID in URL
[PASS] URL preserved after reload
[PASS] Period badge visible
```

---

## 7. Tests

```
Frontend:     248/248 PASS + TSC PASS
Backend:      171/171 PASS (analytics + crm) + TSC PASS
```

---

## 8. Security

- `partnerId` из route/query не является authority
- Backend enforce через `RequirePermissions("crm.partner.read")`
- JWT auth required
- Partner 360 data загружается через существующий CRM service с RBAC

---

## 9. Оставшиеся gaps

| Gap | Статус | Next Step |
|---|---|---|
| Partner 360 KPI карточки (GMV, Commission, etc.) | Нет — Overview показывает totalOrders/totalBookings, не period-bound GMV | Требует расширения Partner API |
| FULFILLED статус audit | Отложено | Отдельная remediation |
| Multi-currency FX architecture | BLOCKING | MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT |

---

## 10. VERDICT

```
VERDICT A — PARTNER 360 / PARTNER-CONTEXT DRILL-DOWN IMPLEMENTATION APPROVED
```

Canonical NEXT: **MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT**

**DO NOT AUTO-START Step 3.12**
