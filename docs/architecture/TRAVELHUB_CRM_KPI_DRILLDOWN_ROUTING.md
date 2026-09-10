# TravelHub CRM / KPI Drill-down Routing — Canonical Contract

## 1. Purpose

This document defines the canonical drill-down routing from KPI dashboards to operational/CRM entity surfaces. It establishes the single source of truth for how KPI clicks navigate users, what context is propagated, and what security boundaries are preserved.

**D12 scope:** Route normalization, context propagation, entity identity, security preservation.

---

## 2. Routing Authority

| Authority | Scope |
|---|---|
| `metric-drilldown.ts` | Canonical shared drill-down framework (Analytics Center) |
| `WIDGET_ROUTES` in `SectionGrid.tsx` | Command Center KPI → destination mapping |
| D11 KPI dictionary | KPI definitions, formulas, status semantics |
| D10 attribution | Partner identity resolution (`Order.sellerPartnerId`) |
| D8 temporal semantics | Period filtering (`[start, endExclusive)`, UTC) |

---

## 3. Canonical Parameter Contract

Cross-page analytics drill-down parameters:

```
from        — period start date (YYYY-MM-DD)
to          — period end date (YYYY-MM-DD, exclusive)
preset      — human-readable period label (e.g., "MONTH", "YEAR")
fromAnalytics=true — marker indicating drill-down origin
```

### Compatibility Aliases

Operations Centers also accept legacy `dateFrom`/`dateTo` for backward compatibility:

| Target | Reads `from`/`to`? | Reads `dateFrom`/`dateTo`? | Priority |
|---|---|---|---|
| Orders Center | ✅ | ✅ | `from` wins |
| Bookings Center | ✅ (D12 fix) | ✅ | `from` wins |
| CRM Page | ✅ | ❌ | `from` only |
| Partner 360 | ✅ | ❌ (uses `dateFrom` in API) | `from` for URL, `dateFrom` for API |
| Customer 360 | ❌ | ❌ | Full-history surface |

---

## 4. KPI → Target Mapping

### 4.1 Analytics Center (metric-drilldown.ts)

| KPI | Destination Type | Route | Period Policy |
|---|---|---|---|
| Orders | DOMAIN_ROUTE | `/app/orders` | PERIOD_BOUND |
| Bookings | DOMAIN_ROUTE | `/app/bookings` | PERIOD_BOUND |
| Customers | DOMAIN_ROUTE | `/app/crm?tab=customers` | PERIOD_BOUND |
| Partners | DOMAIN_ROUTE | `/app/crm?tab=partners&entitled=true` | ALL_TIME |
| Partner Name | DETAIL_VIEW | `/app/crm/partners/{id}?tab=overview` | PERIOD_BOUND |
| Partner Orders | DETAIL_VIEW | `/app/crm/partners/{id}?tab=orders` | PERIOD_BOUND |
| Partner Bookings | DETAIL_VIEW | `/app/crm/partners/{id}?tab=bookings` | PERIOD_BOUND |
| Payment Count | DOMAIN_ROUTE | `/app/payments?status=CAPTURED&currency={c}` | PERIOD_BOUND |

### 4.2 Command Center (SectionGrid.tsx WIDGET_ROUTES)

| KPI Widget | Route | Filter |
|---|---|---|
| orders | `/app/orders` | — |
| bookings | `/app/bookings` | — |
| orders-fulfilled | `/app/orders` | `?status=FULFILLED` |
| bookings-confirmed | `/app/bookings` | `?status=CONFIRMED` |
| bookings-completed | `/app/bookings` | `?status=COMPLETED` |
| payments-captured | `/app/payments` | `?paymentStatus=CAPTURED` |
| refunds-processed | `/app/payments` | `?refundStatus=PROCESSED` |
| marketplace-partners | `/app/crm` | `?tab=partners&entitled=true` |
| marketplace-customers | `/app/crm` | `?tab=customers` |
| partners | `/app/crm` | `?tab=partners&entitled=true` |
| customers | `/app/crm` | `?tab=customers` |
| marketplace-orders | `/app/orders` | — |
| storefront-orders | `/app/orders` | — |

### 4.3 Deferred (Financial / No Honest Target)

| KPI | Status | Reason |
|---|---|---|
| GMV | DEFERRED | No Finance detail surface |
| Revenue | DEFERRED | No Finance detail surface |
| Commission | DEFERRED | No Finance detail surface |
| Refunds (amount) | DEFERRED | No Finance detail surface |
| AOV | DEFERRED | Derived metric |
| Sessions | NOT STARTED | No target page |
| Net Payments | DEFERRED | No Finance detail surface |

---

## 5. Entity Identity

| Entity | URL Identifier | Route Pattern | Notes |
|---|---|---|---|
| Order | UUID | `/app/orders/[id]` | Immutable PK |
| Booking | UUID | `/app/bookings/[id]` | Immutable PK |
| Payment | PAY-* code | `/app/payments/[code]` | Business code, immutable |
| Customer | UUID | `/app/crm/customers/[id]` | Immutable PK |
| Partner | UUID | `/app/crm/partners/[id]` | Immutable PK |
| Product | UUID | `/app/catalog/[id]` | Immutable PK |
| Request | UUID | `/app/requests/[id]` | Immutable PK |

**No aliases, no code-to-ID conversion in routing.** Payment is the sole exception (business code is the canonical route identifier).

---

## 6. Period Context Rules

| Period Policy | Behavior |
|---|---|
| PERIOD_BOUND | Transfer `from`, `to`, `preset` |
| ALL_TIME | No period transfer |
| AS_OF_DATE | Transfer `to` as `asOf` |

### Temporal Semantics (D8)

- Period format: `YYYY-MM-DD`
- Semantics: `[start, endExclusive)`
- UTC server-authoritative
- No custom date parser created

---

## 7. Command Center Routing

Command Center KPI cards use `WIDGET_ROUTES` mapping (defined in `SectionGrid.tsx`).

- Each navigable KPI has an explicit route entry
- `KpiCard` accepts optional `href` prop → renders as `<Link>`
- Financial KPIs without honest target have no entry → remain non-clickable `<div>`
- Navigation uses Next.js `<Link>` for SPA behavior

---

## 8. Analytics Routing

Analytics Center uses `metric-drilldown.ts` shared framework.

- `MetricDrilldownConfig` defines per-metric routing behavior
- `resolveDrilldownUrl()` builds URL with filter context
- `resolveTableCellDrilldown()` handles table cell drill-down with partner scope
- `Kpi` component resolves destination from config or legacy `href`

---

## 9. CRM Routing

CRM page is a **drill-down receiver** from Analytics Center.

| Param | Read by CRM |
|---|---|
| `tab` | ✅ |
| `from` | ✅ |
| `to` | ✅ |
| `preset` | ✅ (D12 addition) |
| `entitled` | ✅ |
| `fromAnalytics` | ❌ (not displayed) |

CRM page displays period indicator badge: `📊 {preset} ({from} → {to})`.

---

## 10. D10 Integration

Partner attribution via `Order.sellerPartnerId` is preserved.

- Partner Performance → Partner 360 drill-down carries `partnerId` in route path
- `resolveTableCellDrilldown()` appends partnerId to DETAIL_VIEW routes
- Partner 360 server-side enforces partner scope via `assertPartnerActor()`

---

## 11. D11 Integration

D11 KPI dictionary is the authority for:

- KPI definitions and formulas
- Status semantics
- Cross-center scope differences (Marketplace vs Overview)
- Completion rate, effective rate

D12 does NOT redefine any KPI formulas or status semantics.

---

## 12. Security / Scope

| Rule | Implementation |
|---|---|
| Partner A → Partner B | DENIED (server-side `assertPartnerActor`) |
| Unauthorized Customer | DENIED (server-side scope check) |
| Unauthorized Order/Booking | DENIED (Storefront isolation) |
| Frontend ID as auth proof | FORBIDDEN (backend remains authority) |
| Cross-scope expansion | NOT PERMITTED (explicit per-drill-down) |

---

## 13. Finance Boundary

D12 does NOT implement:

- Finance Center
- Financial detail surfaces
- Settlement, Payout, Refund, Commission engines

Financial KPIs remain `destinationType: NONE` until Finance stage exists.

---

## 14. Deferred Destinations

| KPI | Target | Status |
|---|---|---|
| GMV | Finance detail | DEFERRED |
| Revenue | Finance detail | DEFERRED |
| Commission | Finance detail | DEFERRED |
| Refunds (amount) | Finance detail | DEFERRED |
| AOV | Derived metric | DEFERRED |
| Sessions | No target | NOT STARTED |
| Customer 360 period | Full-history surface | BY DESIGN (AD-2) |

---

## 15. Compatibility Aliases

| Canonical | Legacy Alias | Status |
|---|---|---|
| `from` | `dateFrom` | Both accepted |
| `to` | `dateTo` | Both accepted |
| `/app/payments/[code]` | `/app/finance/payments/[id]` | Redirect preserved |

---

## 16. Change Governance

Changes to this routing contract require:

1. Evidence-based justification (repository audit)
2. Architecture decision documentation (AD-N)
3. Regression testing
4. Qualification report

Do not modify routes without verifying:

- Target API exists and accepts required params
- RBAC permissions are enforced
- Scope boundaries are preserved
- Temporal semantics are D8-compliant
