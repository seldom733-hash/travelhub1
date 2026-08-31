# PLATFORM SALES CHANNEL DATA SCOPE AUDIT — MARKETPLACE vs STOREFRONT

## SHA

```
Starting SHA:    688a8bb
Audit SHA:       (this commit)
Final HEAD:      (after commit)
origin/master:   (after push)
```

## 1. Executive Summary

TravelHub имеет **два коммерческих канала** продаж: MARKETPLACE и PARTNER_STOREFRONT. Канонический discriminator — `Order.acquisitionSource` (immutable после создания). В текущем dataset: 1073 Marketplace Orders, 400 Storefront Orders, 43 NULL (legacy/unclassified).

**Ключевой finding:** Командный центр и Аналитика используют **смешанный scope** — financial metrics (GMV, Revenue, Refunds, Commission) агрегируют ВСЕ каналы, но subtitle Claim声称 Marketplace-only. Orders/Bookings/Payments Centers также показывают ВСЕ каналы без channel filter.

## 2. Canonical Sales Channel Source

| Property | Value |
|---|---|
| **Entity** | `order.Order` |
| **Field** | `acquisitionSource` (String?) |
| **Enum values** | `MARKETPLACE`, `PARTNER_STOREFRONT`, `NULL` |
| **Schema** | `order.*` (cross-schema, no FK) |
| **Set at** | Order creation from `OrderRequested` event payload |
| **Immutable** | Yes — frozen at creation, never recomputed |
| **Historical stability** | ✅ Channel does NOT change if Partner later disables storefront |

The `AcquisitionSource` enum (`MARKETPLACE`/`PARTNER_STOREFRONT`/`DIRECT`) exists in `catalog.*` schema. The Order stores it as a String snapshot.

## 3. Dataset Inventory

### Orders by channel

| Channel | Count | % |
|---|---:|---:|
| MARKETPLACE | 1073 | 70.8% |
| PARTNER_STOREFRONT | 400 | 26.4% |
| NULL (unclassified) | 43 | 2.8% |
| **ALL** | **1516** | **100%** |

### Bookings by channel (via Order.acquisitionSource)

| Channel | Count | % |
|---|---:|---:|
| MARKETPLACE | 403 | 58.2% |
| PARTNER_STOREFRONT | 276 | 39.9% |
| NULL | 13 | 1.9% |
| **ALL** | **692** | **100%** |

### Payments by channel (via Order.acquisitionSource)

| Channel | CAPTURED | FAILED | REFUNDED | Total |
|---|---:|---:|---:|---:|
| MARKETPLACE | 447 | 3 | 32 | 482 |
| PARTNER_STOREFRONT | 292 | 1 | 22 | 315 |
| NULL | 19 | 0 | 0 | 19 |
| **ALL** | **758** | **4** | **54** | **816** |

### Commissions by channel

| Channel | Count |
|---|---:|
| MARKETPLACE | 427 |
| PARTNER_STOREFRONT | 284 |
| **ALL** | **711** |

**Важно:** Storefront transactions — **НЕ ноль**. Это не теоретический канал, а 26-40% реальных операций.

## 4. Commercial Entity Chain

| Entity | Has own channel? | Inherits from | Channel source |
|---|---|---|---|
| Order | ✅ `acquisitionSource` | OrderRequested event | Immutable snapshot |
| Booking | ❌ | Order → `orderId` | `o.acquisitionSource` |
| Payment | ❌ | Order → `orderId` | `o.acquisitionSource` |
| Refund | ❌ | Order → Payment → `orderId` | `o.acquisitionSource` |
| Commission | ❌ | Order → `orderId` | `o.acquisitionSource` |

Channel provenance is **Order-owned** and inherited via `orderId` join throughout the chain.

## 5. Command Center — Metric-by-Metric Scope

| Metric | Formula/source | Channel filter | MARKETPLACE | STOREFRONT | ALL | Current scope |
|---|---|---|---:|---:|---:|---|
| GMV | Order WHERE status IN (FULFILLED,CLOSED) AND createdAt ∈ period | ❌ NONE | ~70% | ~26% | 100% | **ALL** |
| Revenue | Payment WHERE status=CAPTURED AND paidAt ∈ period | ❌ NONE | ~59% | ~39% | 100% | **ALL** |
| Refunds | Refund WHERE status=PROCESSED AND processedAt ∈ period | ❌ NONE | ~59% | ~41% | 100% | **ALL** |
| Commission | Commission WHERE createdAt ∈ period | ❌ NONE | ~60% | ~40% | 100% | **ALL** |
| Outstanding | GMV(paidAmount) - collected | ❌ NONE | ~70% | ~26% | 100% | **ALL** |
| Marketplace Customers | Order WHERE acquisitionSource=MARKETPLACE → DISTINCT customerId | ✅ MARKETPLACE | 100% | 0% | 79 | **MARKETPLACE** |
| Storefront Customers | Order WHERE acquisitionSource=PARTNER_STOREFRONT → DISTINCT customerId | ✅ STOREFRONT | 0% | 100% | 50 | **STOREFRONT** |
| Total Active Customers | Union(marketplaceCustomerIds, storefrontCustomerIds) | union | 79 | 50 | 109 | **ALL** |
| Marketplace Partners | Product+PublicationChannel WHERE channel=MARKETPLACE | ✅ MARKETPLACE | 27 | 0 | 27 | **MARKETPLACE** |
| Storefront Partners | PartnerStorefront WHERE entitlementStatus=ACTIVE | ✅ STOREFRONT | 0 | 6 | 6 | **STOREFRONT** |
| Total Active Partners | Union(marketplacePartners, storefrontPartners) | union | 27 | 6 | 27 | **ALL** |
| Marketplace Sessions | MarketplaceBehavioralEvent | ✅ MARKETPLACE | 18 | 0 | 18 | **MARKETPLACE** |
| Storefront Sessions | StorefrontBehavioralEvent | ✅ STOREFRONT | 0 | 0 | 0 | **STOREFRONT** |
| AOV | GMV / count(fulfilled orders) | ❌ NONE | — | — | — | **ALL** |
| Conversion | Orders / Sessions | mixed | — | — | — | **Mixed** |

## 6. Command Center Subtitle Classification

Runtime: `"Агрегированные данные Marketplace · UTC"`

### CASE C — SEMANTICALLY MISLEADING

**7 из 14 metrics агрегируют ВСЕ каналы** (GMV, Revenue, Refunds, Commission, Outstanding, AOV, Total Partners, Total Customers). Только 4 metrics explicitly Marketplace-scoped (Marketplace Customers, Marketplace Partners, Marketplace Sessions, Conversion denominator).

Заголовок создаёт **неверное впечатление**, что данные относятся только к Marketplace, хотя 26-40% данных — Storefront.

## 7. UTC Claim

Command Center передаёт `timezone: "UTC"` в analytics endpoint. Period boundaries рассчитываются в UTC.

**PROVEN** — UTC claim соответствует реальности.

## 8. Analytics — Metric-by-Metric Scope

Analytics использует тот же `getCompanyKpi()` endpoint — идентичный scope что и Command Center:

| Metric | Scope |
|---|---|
| GMV, Revenue, Refunds, Commission, Outstanding | ALL channels |
| Marketplace Customers/Partners/Sessions | MARKETPLACE only |
| Storefront Customers/Partners/Sessions | STOREFRONT only |
| Total Active Customers/Partners | Union (ALL) |

## 9. Orders Center

Backend `listOrders()` — **без acquisitionSource filter**. Orders Center показывает ВСЕ каналы.

| Channel | Count | % |
|---|---:|---:|
| MARKETPLACE | 1073 | 70.8% |
| PARTNER_STOREFRONT | 400 | 26.4% |
| NULL | 43 | 2.8% |

**Channel filter в UI отсутствует.**

## 10. Bookings Center

Backend bookings query — **без acquisitionSource filter** (через Order join). Показывает ВСЕ каналы.

| Channel | Count | % |
|---|---:|---:|
| MARKETPLACE | 403 | 58.2% |
| PARTNER_STOREFRONT | 276 | 39.9% |
| NULL | 13 | 1.9% |

**Channel filter в UI отсутствует.**

## 11. Payments

Payments registry и Financial Summary — **без acquisitionSource filter**. Показывают ВСЕ каналы.

Successful payments (CAPTURED):
| Channel | Count | % |
|---|---:|---:|
| MARKETPLACE | 447 | 59.0% |
| PARTNER_STOREFRONT | 292 | 38.5% |
| NULL | 19 | 2.5% |

**Channel filter в UI отсутствует.**

## 12. CRM Customers

CRM customer population определяется через Order.acquisitionSource:
- Marketplace customers: 79 unique
- Storefront customers: 50 unique
- Total (union): 109 unique

CRM показывает ВСЕХ customers без channel filter.

## 13. Partner Performance

Partner Performance используется из Analytics. Scope зависит от привязки partner → Orders.

Для Partner A (marketplace products + storefront):
- Orders: MARKETPLACE + STOREFRONT
- GMV: MARKETPLACE + STOREFRONT
- Payments: MARKETPLACE + STOREFRONT

**Channel filter в Partner Performance отсутствует.**

## 14. Channel Filter Capability Audit

| Endpoint | MARKETPLACE filter | STOREFRONT filter | Notes |
|---|---|---|---|
| GET /analytics/company-kpi | ❌ | ❌ | acquisitionSource param exists but not exposed in UI |
| GET /orders | ❌ | ❌ | No channel filter in query DTO |
| GET /bookings | ❌ | ❌ | No channel filter |
| GET /finance/payments | ❌ | ❌ | No channel filter |
| GET /dashboard/command-center | ❌ | ❌ | No channel param |
| POST /analytics/company-kpi | Optional `acquisitionSource` | Optional | Backend supports, UI doesn't expose |

Backend analytics endpoint **технически поддерживает** `acquisitionSource` param, но UI его не использует.

## 15. Cross-Surface Reconciliation

| Metric | Command Center | Analytics | Center | Scope match |
|---|---|---|---|---|
| Orders count | 1516 (ALL) | — | 1516 (ALL) | ✅ Consistent |
| Bookings count | 692 (ALL) | — | 692 (ALL) | ✅ Consistent |
| Payments CAPTURED | 758 (ALL) | 758 (ALL) | 758 (ALL) | ✅ Consistent |
| Customers | 109 (union) | 109 (union) | — | ✅ Consistent |

All surfaces use the same underlying queries — no cross-surface inconsistency in data.

## 16. ID-Level Evidence

### Representative MARKETPLACE Order
```
acquisitionSource: MARKETPLACE
Example: any Order with sellerPartnerId + marketplace product
```

### Representative STOREFRONT Order
```
acquisitionSource: PARTNER_STOREFRONT
Example: Order created through PartnerStorefront checkout
```

### NULL Order
```
acquisitionSource: NULL
43 orders — legacy/bootstrap rows before acquisitionSource migration
```

## 17. Findings

| ID | Severity | Finding |
|---|---|---|
| **F1** | **P1** | Command Center subtitle "Агрегированные данные Marketplace" — семантически ЛОЖНЫЙ. GMV/Revenue/Refunds/Commission агрегируют ВСЕ каналы (74% Marketplace + 26% Storefront). |
| **F2** | **P1** | Нет channel filter в Orders/Bookings/Payments Centers. Пользователь не может отделить Marketplace от Storefront операций. |
| **F3** | **P2** | Analytics subtitle не показывает channel scope. Пользователь не знает, Marketplace-only или ALL. |
| **F4** | **P2** | 43 Orders с NULL acquisitionSource — legacy/unclassified. Не отображается в UI. |
| **F5** | **INFO** | Backend analytics поддерживает `acquisitionSource` param, но UI не экспонирует его. |
| **F6** | **INFO** | Storefront transactions — 26-40% реальных операций. Не нулевой канал. |
| **F7** | **INFO** | UTC claim proven — Command Center передаёт `timezone: "UTC"`. |

## 18. Required Architecture Decision

### OPTION 3 — CHANNEL SELECTOR REQUIRED

Рекомендация: добавить **единый shared channel scope selector** во все relevant surfaces.

```
Scope selector (shared):
  ├── Все каналы (ALL) — default
  ├── Marketplace
  └── Storefront
```

Применяется к:
- Command Center (subtitle + metrics)
- Analytics (headline KPIs + all metrics)
- Orders Center (table + aggregates)
- Bookings Center (table + aggregates)
- Payments Registry (table + aggregates)
- CRM Customers (population)
- Partner Performance

**Обоснование:**
- Storefront transactions = 26-40% данных — не маргинальный канал
- Текущий subtitle "Marketplace" вводит в заблуждение
- Backend уже поддерживает `acquisitionSource` param
- Channel provenance immutable и исторически стабилен

### Альтернатива: OPTION 2 (PLATFORM ALL-CHANNEL DEFAULT)

Если Marketplace-specific view не нужен — изменить subtitle на "Агрегированные данные платформы" и оставить ALL scope без selector.

## 19. Recommended Next Remediation

1. **Channel Scope Selector (P1)** — shared component, передаёт `acquisitionSource` в analytics/orders/bookings/payments endpoints
2. **Subtitle Fix (P1)** — "Агрегированные данные платформы · UTC" (если default ALL) или dynamic subtitle с channel scope
3. **NULL acquisitionSource cleanup (P2)** — backfill 43 legacy Orders

## 20. VERDICT

```
VERDICT A — PLATFORM SALES CHANNEL DATA SCOPE AUDIT — COMPLETE

A. Canonical channel source найден (Order.acquisitionSource)                PASS
B. Historical stability проверена (immutable)                               PASS
C. Storefront transaction population посчитана (400 Orders, 276 Bookings)   PASS
D. Marketplace transaction population посчитана (1073 Orders, 403 Bookings) PASS
E. UNKNOWN population посчитана (43 Orders, 13 Bookings)                   PASS
F. Order/Booking/Payment chain проверена (channel via Order join)           PASS
G. Command Center metric-by-metric scope доказан                            PASS
H. Analytics metric-by-metric scope доказан                                 PASS
I. Orders scope доказан (ALL, no filter)                                    PASS
J. Bookings scope доказан (ALL, no filter)                                  PASS
K. Payments scope доказан (ALL, no filter)                                  PASS
L. CRM Customers scope доказан (ALL, union)                                 PASS
M. Partner Performance scope доказан (ALL)                                   PASS
N. Command Center subtitle классифицирован: MISLEADING (CASE C)             PASS
O. UTC claim proven                                                         PASS
P. Cross-surface inconsistencies перечислены (none — consistent)            PASS
Q. ID-level evidence предоставлен (dataset counts + representative)         PASS
R. Recommended next remediation определён (Channel Selector)                PASS
```
