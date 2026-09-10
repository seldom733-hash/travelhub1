# PHASE 3 — D10 Partner Performance Attribution Scope Audit

## 1. Executive Summary

D10 — Partner Performance Attribution — является TRUE NEXT после D9 closure.

**Ключевой вывод:** Partner Performance **уже реализован** как часть Analytics Foundation (Step 3.3). Текущая implementation включает: Orders/GMV, Bookings, Revenue (Payment), Commission, Active Products, Completion Rate — всё привязано к Partner через `Order.sellerPartnerId` (frozen) и `Product.partnerId` (live lookup).

D10 scope audit установил:

1. **Canonical attribution identity** = `Order.sellerPartnerId` (frozen при создании Order из Quote ISSUE snapshot).
2. **Атрибуция Bookings** = `Booking.productId → Product.partnerId` (live lookup) — **расхождение с Orders**, зафиксированное в D10 prompt §5.
3. **Marketplace scope** = `acquisitionSource = MARKETPLACE` — Storefront вне D10 scope.
4. **Financial boundary** = D10 CONSUME canonical Finance facts (Payment, Commission), НЕ создаёт financial authority.
5. **D10 ≠ D11** = D10 = attribution semantics, D11 = project-wide KPI/status reconciliation.
6. **D10 ≠ Finance** = D10 ≠ Settlement/Payout/Commission Engine.
7. **Dependencies satisfied** = D8 closed, RBAC closed (UI-C17), Analytics Foundation implemented.
8. **Gaps identified** = attribution inconsistency (sellerPartnerId vs product.partnerId), Cancelled/Refunded Bookings not tracked, formal documentation missing.

**READINESS: READY WITH EXPLICIT GAPS**

```text
CURRENT TRUE NEXT:
D10 — Partner Performance Attribution

FINANCE:
NOT STARTED / DEFERRED

D10 BLOCKERS:
none

D10 NON-BLOCKING GAPS:
1. Attribution inconsistency: Orders use sellerPartnerId (frozen), Bookings use Product.partnerId (live)
2. Cancelled/Refunded Bookings not tracked in Partner Performance
3. Storefront scope intentionally out of D10
4. Formal attribution documentation missing

D10 IMPLEMENTATION SCOPE:
Formalize existing Partner Performance, fix attribution inconsistency, add missing status dimensions

D10 ↔ D10:
D10 = attribution semantics per Partner
D11 = project-wide KPI/status reconciliation + Total Reconciliation

D10 ↔ FINANCE:
D10 consumes canonical Payment/Commission facts
D10 does NOT create financial authority

RECOMMENDED NEXT ACTION:
Implementation prompt for D10 formalization + attribution consistency fix
```

---

## 2. Current Repository State

```text
HEAD:           aa7e86cc1a1c633922c218d438c8aafe65cf97ec
origin/master:  aa7e86cc1a1c633922c218d438c8aafe65cf97ec
status:         CLEAN (only untracked D10 prompt artifact)
diff --check:   PASS
```

D9 = CLOSED / APPROVED. D10 = TRUE NEXT.

---

## 3. D10 Canonical Definition

### 3.1 Master Plan v3

D10 Partner Performance Attribution — canonical D-track stage, ordered after D9:

```text
D0  ✅ Reconciliation Final Git/Evidence Closure
D1  ✅ Commerce Lifecycle Contract Finalization
D1A ✅ Platform CRM Scope Isolation
D2  ✅ Product Traveler Requirements
D3  ✅ Traveler Collection + Population
D4  ✅ Traveler Security + Representative Data
D4-REM ✅ Strict Review Remediation
D5  ✅ Orders Full-Page Detail
D6  ✅ Bookings Full-Page Detail
D7  ✅ Payment/Refund Semantics + Financial Presentation
D8  ✅ Global Temporal Visibility
D9  ✅ Export Framework Requalification
D10 ⬜ Partner Performance Attribution ← TRUE NEXT
```

### 3.2 Lifecycle Contract

From `COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md` L830:

```
| D10 | Partner Performance attribution |
```

### 3.3 Architecture Debt Register

From `TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md`:

```
D10 Partner Performance Attribution | ARCHITECTURE_DEBT | NOT STARTED
```

---

## 4. Attribution Identity

### 4.1 Primary Attribution Key

**`Order.sellerPartnerId`** — frozen at Order creation from Quote ISSUE snapshot (ADR-0013 D14).

```text
Quote ISSUE freeze
    → { sellerPartnerId, channel, policyCode, rate, ... }
    → OrderRequested → Order.sellerPartnerId (immutable)
    → Commission.partnerId (frozen from Order)
```

Source: `backend/prisma/schema.prisma` L2000:

```prisma
/// Step 2.12E (ADR-0013 D14) — frozen seller attribution
/// Единственный selling partner заказа (order-level), server-frozen при
/// Order creation из frozen commissionSnapshot
sellerPartnerId String?
```

### 4.2 Booking Attribution Key

**`Booking.productId → Product.partnerId`** — live lookup at Booking creation.

Source: `analytics.service.ts` L860-870:

```typescript
const products = await this.prisma.product.findMany({
  where: { id: { in: productIds } },
  select: { id: true, partnerId: true },
});
for (const p of products) {
  if (p.partnerId) productPartnerMap.set(p.id, p.partnerId);
}
```

### 4.3 Attribution Inconsistency (D10 Gap)

| Entity | Attribution Key | Nature | Authority |
|---|---|---|---|
| Order | `sellerPartnerId` | Frozen at creation | Quote ISSUE snapshot |
| Booking | `Product.partnerId` | Live lookup | Current Product config |
| Commission | `partnerId` | Frozen from Order | Order.sellerPartnerId |
| Payment | `orderId → sellerPartnerId` | Join via Order | Order.sellerPartnerId |

**Finding:** Orders and Bookings use different attribution paths. This is a known inconsistency (identified in `PHASE_3_PRE_STEP_3.12_ORDERS_BOOKINGS_DIAGNOSTIC_EXPORT_REPORT.md` L110):

> "Это разные пути атрибуции. Registry привязывает через Order.sellerPartnerId, Analytics — через Booking.productId → Product.partnerId."

**D10 scope:** Formalize which attribution key is canonical for Partner Performance. Recommendation: `Order.sellerPartnerId` is the frozen, immutable, server-authoritative key. Bookings should align.

### 4.4 Partner Entity

```prisma
model Partner {
  id        String      @id @default(uuid())
  code      String      @unique // PAR-00000001
  companyId String?
  name      String
  status    EntityStatus @default(ACTIVE)
  countryCode String?
  // ...
}
```

Partner is the canonical attribution target. No `Supplier` entity exists as a separate analytics concept — `Reservation.supplierId` is a cross-schema reference without FK.

---

## 5. Attribution Semantics

### 5.1 What "Belongs to Partner"

| Metric | Currently Tracked | Attribution Source | Notes |
|---|---|---|---|
| Orders | ✅ | `Order.sellerPartnerId` | Marketplace-scoped |
| Bookings | ✅ | `Booking.productId → Product.partnerId` | Marketplace-scoped; **different key** |
| Completed Bookings | ✅ | `Booking.status = COMPLETED` | Via product.partnerId |
| Cancelled Bookings | ❌ NOT TRACKED | — | No `cancelledBookings` field |
| Refunded Bookings | ❌ NOT TRACKED | — | No `refundedBookings` field |
| GMV / Commerce Volume | ✅ | `Order.amount + sellerPartnerId` | Integer cents arithmetic |
| Revenue | ✅ | `Payment.amount → orderId → sellerPartnerId` | Revenue-qualified payments only |
| Payments | ❌ NOT DIRECT | Revenue is derived from payments | No raw payment count |
| Commission | ✅ | `Commission.partnerId` | Frozen from Order |
| Settlement | ❌ DEFERRED | — | Settlement engine not implemented |
| Payout | ❌ DEFERRED | — | Payout engine not implemented |
| Customers | ❌ OUT OF SCOPE | — | CRM analytics scope |
| Conversion | ❌ OUT OF SCOPE | — | Company KPI scope |
| AOV | ❌ OUT OF SCOPE | — | Company KPI scope |
| Active Products | ✅ | `Product.partnerId WHERE status = PUBLISHED` | Count per partner |
| Booking Completion Rate | ✅ | `completedBookings / totalBookings` | Capped at 100% |

### 5.2 D10 Scope Boundaries

**IN SCOPE (D10):**
- Orders count per Partner (Marketplace)
- GMV per Partner (Marketplace)
- Bookings count per Partner (Marketplace)
- Completed Bookings per Partner
- Revenue per Partner (Payment-derived)
- Commission per Partner
- Active Products per Partner
- Booking Completion Rate
- Attribution consistency formalization

**OUT OF SCOPE (D10):**
- Cancelled/Refunded Bookings (deferred to future enhancement)
- Settlement/Payout (Finance Center scope)
- Customers/Conversion/AOV (Company KPI scope)
- Storefront seller performance (DATA-02 scope)
- Project-wide KPI semantics (D11 scope)

---

## 6. Metric Matrix

| Metric | Source | Partner key | Timestamp | Status filter | Currency | Scope | Authority |
|---|---|---|---|---|---|---|---|
| Orders | `order.Order` | `sellerPartnerId` | `createdAt` | `acquisitionSource = MARKETPLACE` | Order.currency | Marketplace | Order.sellerPartnerId (frozen) |
| Bookings | `booking.Booking` | `Product.partnerId` | `createdAt` | `acquisitionSource = MARKETPLACE` | — | Marketplace | Product.partnerId (live) |
| Completed Bookings | `booking.Booking` | `Product.partnerId` | `completedAt` | `status = COMPLETED` | — | Marketplace | Product.partnerId (live) |
| GMV | `order.Order.amount` | `sellerPartnerId` | `createdAt` | `acquisitionSource = MARKETPLACE` | Order.currency | Marketplace | Order.sellerPartnerId (frozen) |
| Revenue | `finance.Payment.amount` | `orderId → sellerPartnerId` | `paidAt` (revenueWhere) | Revenue-qualified | Payment.currency | Marketplace | Order.sellerPartnerId (via join) |
| Commission | `finance.Commission.amount` | `partnerId` | `createdAt` | — | Commission.currency | Marketplace | Commission.partnerId (frozen) |
| Active Products | `catalog.Product` | `partnerId` | — | `status = PUBLISHED` | — | Marketplace | Product.partnerId |
| Completion Rate | derived | `Product.partnerId` | — | `completedBookings / totalBookings` | — | Marketplace | Derived |

---

## 7. Temporal Semantics

D8 is CLOSED. D10 must use existing canonical temporal contracts.

### 7.1 Period Filtering

All Partner Performance queries use `resolveQueryPeriod(dto)`:

```typescript
const { current } = this.resolveQueryPeriod(dto);
// current = { start: Date, endExclusive: Date, timezone: string, preset: string }
```

Filter: `createdAt: { gte: current.start, lt: current.endExclusive }`

This is D8-compliant: UTC instants, exclusive end, server-authoritative period resolution.

### 7.2 Business Timestamps

| Fact | Timestamp Used | Source | D8 Status |
|---|---|---|---|
| Order occurrence | `createdAt` | Persistence time | EXISTING_CANONICAL |
| Booking occurrence | `createdAt` | Persistence time | EXISTING_CANONICAL |
| Booking completion | `completedAt` | Lifecycle milestone | EXISTING_CANONICAL (D8) |
| Payment revenue | `paidAt` (via revenueWhere) | Lifecycle milestone | EXISTING_CANONICAL (D8) |
| Commission creation | `createdAt` | Persistence time | EXISTING_CANONICAL |
| Product snapshot | — | No temporal filter | N/A |

### 7.3 Anti-patterns Checked

- ✅ No `new Date()` for business semantics
- ✅ No browser timezone used
- ✅ No client-side date filtering
- ✅ No implicit server timezone
- ✅ No date-only → midnight assumptions
- ✅ Server-authoritative period resolution

---

## 8. Status Semantics

### 8.1 Order Status Inclusion

Partner Performance does NOT filter by Order status. All Orders with `sellerPartnerId` and `acquisitionSource = MARKETPLACE` in the period are included regardless of status (NEW, CONFIRMED, FULFILLED, CANCELLED, CLOSED).

### 8.2 Booking Status Inclusion

Partner Performance counts ALL Bookings (any status) for `bookingsCount`. Only `COMPLETED` status increments `completedBookings`.

| Status | Orders Count | GMV | Bookings Count | Completed | Revenue | Commission |
|---|---|---|---|---|---|---|
| NEW | ✅ | ✅ | ✅ | ❌ | ❌ | — |
| SENT_TO_SUPPLIER | ✅ | ✅ | ✅ | ❌ | ❌ | — |
| CONFIRMED | ✅ | ✅ | ✅ | ❌ | ❌ | — |
| COMPLETED | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| CANCELLED | ✅ | ✅ | ✅ | ❌ | ❌ | — |
| SUPPLIER_REJECTED | ✅ | ✅ | ✅ | ❌ | ❌ | — |

### 8.3 D11 Boundary

D10 = attribution semantics (which Partner gets which metric).

D11 = project-wide KPI/status reconciliation (what statuses mean, consistent vocabulary).

D10 does NOT redefine status semantics. D10 uses existing canonical statuses.

---

## 9. Marketplace / Storefront Separation

### 9.1 Current Scope

Partner Performance is **Marketplace-scoped only**:

```typescript
where: {
  acquisitionSource: "MARKETPLACE",
  createdAt: { gte: current.start, lt: current.endExclusive },
  ...partnerOrderFilter,
}
```

### 9.2 Storefront

Storefront seller performance is OUT OF SCOPE for D10. Storefront analytics are owned by Partner/Storefront Analytics (per `PHASE_3_PRE_STEP_3.12_PLATFORM_ANALYTICS_ROUND_2_PARTNER_PERFORMANCE_REPORT.md`).

### 9.3 DATA-02

DATA-02 (Marketplace/Storefront data separation) is OPEN but NOT blocking D10. D10 operates within Marketplace scope only.

---

## 10. Financial Boundary

### 10.1 D10 ≠ Finance Center

D10 CONSUMES canonical Finance facts:

| Finance Fact | D10 Usage | Authority |
|---|---|---|
| Payment.amount | Revenue metric | Payment table (server-authoritative) |
| Payment.currency | Multi-currency aggregation | Payment table |
| Commission.amount | Commission metric | Commission table (frozen from Order) |
| Commission.currency | Multi-currency aggregation | Commission table |

D10 does NOT:
- Create Payment/Commission/Refund/Settlement/Payout
- Define financial rules
- Override Finance authority
- Implement settlement/payout logic

### 10.2 Financial Metrics in D10

| Metric | D10 Role | Finance Role |
|---|---|---|
| Revenue | READ (aggregate) | WRITE (authoritative) |
| Commission | READ (aggregate) | WRITE (authoritative) |
| GMV | READ (Order.amount) | N/A (Order is Commerce) |
| Settlement | OUT OF SCOPE | WRITE (future) |
| Payout | OUT OF SCOPE | WRITE (future) |

---

## 11. Source → API → UI Chain

### 11.1 Backend Chain

```text
DB Tables (Order/Booking/Payment/Commission/Product)
    ↓
AnalyticsService.getPartnerPerformance()
    ↓ (attribution: sellerPartnerId / Product.partnerId)
    ↓ (period: resolveQueryPeriod → D8 temporal contracts)
    ↓ (scope: resolvePartnerScope → RBAC isolation)
PartnerPerformanceResponse
    ↓
AnalyticsController GET /analytics/partner-performance
    ↓ (@RequirePermissions("analytics.read"))
Frontend API client
    ↓
Analytics page → Partner Performance table
```

### 11.2 Frontend Chain

```text
/frontend/app/app/analytics/page.tsx
    ↓
analyticsApi.getPartnerPerformance(opts)
    ↓
GET /api/v1/analytics/partner-performance?preset=MONTH&acquisitionSource=MARKETPLACE
    ↓
Partner Performance table (paginated, 20/page)
    ↓
Drill-down → /app/crm/partners/{partnerId}?from=&to=&fromAnalytics=true
```

### 11.3 Export Chain

```text
GET /analytics/partner-performance/export?format=csv
    ↓
AnalyticsService.getPartnerPerformance() (same query)
    ↓
ExportService.toCsv/toXlsx (shared serializer)
    ↓
CSV/XLSX response
```

### 11.4 Frontend Authority

Frontend is consumer only. No client-side calculation authority. All metrics computed server-side.

---

## 12. Security / Scope

### 12.1 Permission

```typescript
@RequirePermissions("analytics.read")
```

### 12.2 Role Matrix

| Role | analytics.read | Partner Performance Access | Scope |
|---|---|---|---|
| ADMIN | ✅ GRANT | ✅ | All partners (cross-partner) |
| DIRECTOR | ✅ GRANT | ✅ | All partners (cross-partner) |
| ANALYST | ✅ GRANT | ✅ | All partners (cross-partner) |
| MARKETER | ✅ GRANT | ✅ | All partners (cross-partner) |
| OPERATOR | ✅ GRANT | ✅ | All partners (cross-partner) |
| FINANCE | ✅ GRANT | ✅ | All partners (cross-partner) |
| MODERATOR | ❌ DENY | ❌ 403 | — |
| SALES_MANAGER | ❌ DENY | ❌ 403 | — |
| PARTNER | ❌ DENY | ❌ 403 | — (via analytics.read gate) |
| BUYER | ❌ DENY | ❌ 403 | — |

### 12.3 Partner Scope Isolation

```typescript
function resolvePartnerScope(user, requestedPartnerId) {
  if (user.role === "BUYER") throw new ForbiddenException("BUYER role cannot access analytics");
  if (user.role === "PARTNER") return user.partnerId ?? undefined;
  return requestedPartnerId;
}
```

PARTNER role: automatically scoped to own `partnerId` regardless of requested `partnerId`. This is IDOR protection (HIGH-4 fix).

### 12.4 Negative Authorization

- PARTNER cannot see Partner B's data (resolved to own partnerId)
- BUYER cannot access analytics at all (ForbiddenException)
- MODERATOR/SALES_MANAGER get 403 at page gate (no analytics.read)

---

## 13. UI Ownership

### 13.1 Current Surface

Partner Performance is displayed within the **Analytics Center** (`/app/analytics`):

- Section: "Производительность партнёров" / "Partner Performance"
- Table columns: Partner, GMV, Revenue, Commission, Orders, Bookings, Active Products, Completion Rate
- Pagination: 20 partners per page
- Drill-down: click Partner → CRM Partner 360 (`/app/crm/partners/{id}`)
- Export: CSV/XLSX via shared TableExportButton

### 13.2 Future Ownership

D10 does NOT create a new Center. Partner Performance remains within Analytics Center.

If future stages (D12 CRM/KPI Drill-down Routing) add Partner-specific surfaces, D10 provides the attribution foundation.

---

## 14. Dependency Matrix

| Dependency | State | Blocks D10? | Evidence |
|---|---|---|---|
| Partner identity | ✅ EXISTS | no | Partner model, PAR-* codes |
| Order attribution | ✅ EXISTS | no | Order.sellerPartnerId (frozen) |
| Booking attribution | ✅ EXISTS (inconsistent) | no | Product.partnerId (live) |
| Payment facts | ✅ EXISTS | no | Payment model, orderId |
| Commission facts | ✅ EXISTS | no | Commission model, partnerId |
| Analytics read model | ✅ EXISTS | no | AnalyticsService.getPartnerPerformance() |
| KPI semantics | ⬜ D11 scope | no | D10 uses existing statuses |
| D8 temporal contract | ✅ CLOSED | no | Period filtering implemented |
| DATA-01 | ⬜ OPEN | no | Not blocking D10 |
| DATA-02 | ⬜ OPEN | no | Storefront out of D10 scope |
| PROD-01 | ⬜ DEFERRED | no | Product model not needed for D10 |
| Finance | ⬜ NOT STARTED | no | D10 consumes existing facts |
| RBAC | ✅ CLOSED (UI-C17) | no | analytics.read verified |

**No blocking dependencies.**

---

## 15. D10 vs D11 Boundary

| Dimension | D10 | D11 |
|---|---|---|
| Purpose | Attribution semantics per Partner | Project-wide KPI/status reconciliation |
| Scope | Partner Performance metrics | All KPIs across all centers |
| Status | Uses existing statuses | Reconciles status vocabulary |
| Temporal | Uses D8 contracts | May reconcile temporal semantics |
| Finance | Consumes facts | May reconcile financial KPIs |
| Output | Partner-attributed metrics | Unified KPI/status dictionary |

D10 does NOT:
- Redefine status semantics (D11 scope)
- Reconcile cross-project KPIs (D11 scope)
- Create new KPIs beyond Partner Performance

---

## 16. D10 vs Finance Boundary

| Dimension | D10 | Finance |
|---|---|---|
| Revenue | READ (aggregate from Payment) | WRITE (authoritative) |
| Commission | READ (aggregate from Commission) | WRITE (authoritative) |
| Settlement | OUT OF SCOPE | WRITE (future) |
| Payout | OUT OF SCOPE | WRITE (future) |
| Refund | OUT OF SCOPE | WRITE (authoritative) |
| Financial rules | None | Finance authority |

D10 is a READ-ONLY consumer of Finance facts. D10 does NOT create financial authority.

---

## 17. Readiness

### 17.1 Classification

```text
D10 READINESS: READY WITH EXPLICIT GAPS
```

### 17.2 What's Ready

- ✅ Partner Performance implementation exists (AnalyticsService)
- ✅ Attribution identity defined (Order.sellerPartnerId)
- ✅ Core metrics defined (Orders, GMV, Bookings, Revenue, Commission, Active Products)
- ✅ Source authority defined (DB tables)
- ✅ Temporal semantics defined (D8 contracts)
- ✅ Security scope defined (analytics.read, resolvePartnerScope)
- ✅ UI ownership defined (Analytics Center)
- ✅ Export implemented (CSV/XLSX)
- ✅ Dependencies satisfied

### 17.3 Gaps

1. **Attribution inconsistency** (MEDIUM): Orders use `sellerPartnerId` (frozen), Bookings use `Product.partnerId` (live). D10 should formalize canonical attribution key.
2. **Cancelled/Refunded Bookings** (LOW): Not tracked in Partner Performance. Could be added as enhancement.
3. **Formal documentation** (LOW): Attribution semantics not formally documented in architecture.
4. **Storefront scope** (DEFERRED): Storefront seller performance out of D10 scope.

---

## 18. Gaps / Decisions Required

### 18.1 Attribution Consistency Decision

**Question:** Should D10 align Booking attribution to `Order.sellerPartnerId` (frozen) or keep `Product.partnerId` (live)?

**Recommendation:** Align to `Order.sellerPartnerId` for consistency. The frozen key is the canonical seller attribution (ADR-0013 D14). Live Product.partnerId can change if Product ownership transfers.

### 18.2 Cancelled/Refunded Bookings Decision

**Question:** Should D10 add Cancelled/Refunded Booking counts to Partner Performance?

**Recommendation:** Defer to future enhancement. Current scope is sufficient for V1.

### 18.3 Storefront Decision

**Question:** Should D10 include Storefront seller performance?

**Recommendation:** No. Storefront analytics is a separate scope (DATA-02).

---

## 19. Recommendation

```text
D10 READINESS: READY WITH EXPLICIT GAPS

CURRENT TRUE NEXT:
D10 — Partner Performance Attribution

FINANCE:
NOT STARTED / DEFERRED

D10 BLOCKERS:
none

D10 NON-BLOCKING GAPS:
1. Attribution inconsistency: Orders use sellerPartnerId (frozen), Bookings use Product.partnerId (live)
2. Cancelled/Refunded Bookings not tracked
3. Formal attribution documentation missing

D10 IMPLEMENTATION SCOPE:
1. Formalize attribution semantics documentation
2. Fix Booking attribution consistency (align to sellerPartnerId)
3. Add Cancelled/Refunded Booking tracking (optional enhancement)
4. Create D10 qualification report

D10 ↔ D11:
D10 = attribution semantics per Partner
D11 = project-wide KPI/status reconciliation

D10 ↔ FINANCE:
D10 consumes canonical Payment/Commission facts
D10 does NOT create financial authority

RECOMMENDED NEXT ACTION:
Implementation prompt for D10 formalization + attribution consistency fix
```

---

## Appendix A: Key Evidence Sources

| Source | Location | Evidence |
|---|---|---|
| AnalyticsService.getPartnerPerformance() | `backend/src/modules/analytics/analytics.service.ts` L793-1040 | Full implementation |
| PartnerPerformanceResponse | `analytics.service.ts` L226-248 | Response contract |
| resolvePartnerScope() | `analytics.service.ts` L345-355 | IDOR protection |
| AnalyticsController | `analytics.controller.ts` L88-100 | API endpoint |
| Frontend analytics page | `frontend/app/app/analytics/page.tsx` L1-120 | UI surface |
| Order.sellerPartnerId | `schema.prisma` L2000 | Frozen attribution |
| Commission.partnerId | `schema.prisma` L4203 | Frozen from Order |
| RBAC matrix | `evidence/PHASE_3_UI_C17_RBAC_FULL_MATRIX.csv` | analytics.read grants |
| D10 canonical | `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` | D-chain ordering |
| Lifecycle contract | `COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md` L830 | D10 definition |
