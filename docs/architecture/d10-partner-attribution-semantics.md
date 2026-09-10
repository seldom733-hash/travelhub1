# D10 — Partner Performance Attribution Semantics

## 1. Purpose

Canonical documentation of Partner Performance attribution identity, paths, and boundaries.

Established by: D10 — Partner Performance Attribution (implementation 2026-09-10).

---

## 2. Canonical Attribution Identity

**Partner Performance attribution resolves to the historical seller attribution associated with the Marketplace Order.**

```text
Partner = Order.sellerPartnerId (frozen at Order creation)
```

This is the **single authoritative attribution key** for all Partner Performance metrics.

### 2.1 Frozen at Creation

`Order.sellerPartnerId` is frozen when the Order is created from the Quote ISSUE snapshot (ADR-0013 D14):

```text
Quote ISSUE freeze
    → { sellerPartnerId, channel, policyCode, rate, ... }
    → OrderRequested → Order.sellerPartnerId (immutable)
    → Commission.partnerId (frozen from Order)
```

### 2.2 Immutable

`Order.sellerPartnerId` does not change after Order creation. If Product ownership transfers to another Partner, historical Orders remain attributed to the original seller.

---

## 3. Attribution Paths

### 3.1 Orders / GMV

```text
Order.sellerPartnerId
    ↓
Partner Performance: Orders count, GMV
```

### 3.2 Bookings

```text
Booking.orderId → Order.sellerPartnerId
    ↓
Partner Performance: Bookings count, Completed Bookings, Completion Rate
```

**D10 fix:** Previously used `Booking.productId → Product.partnerId` (live lookup). Now aligned to `Order.sellerPartnerId` (frozen historical attribution).

### 3.3 Revenue

```text
Payment.orderId → Order.sellerPartnerId
    ↓
Partner Performance: Revenue
```

### 3.4 Commission

```text
Commission.partnerId (frozen from Order.sellerPartnerId)
    ↓
Partner Performance: Commission
```

### 3.5 Active Products

```text
Product.partnerId WHERE status = PUBLISHED
    ↓
Partner Performance: Active Products count
```

This is **current product ownership**, not historical order attribution. Acceptable because Active Products represents current catalog state.

---

## 4. Historical Seller Attribution vs Current Product Ownership

| Concept | Key | Nature | Use |
|---|---|---|---|
| Historical seller attribution | `Order.sellerPartnerId` | Frozen, immutable | Orders, GMV, Bookings, Revenue, Commission |
| Current product ownership | `Product.partnerId` | Mutable | Active Products count only |

**Rule:** `Product.partnerId` must NOT be used as historical seller attribution for Order/Booking Performance metrics.

---

## 5. Marketplace Scope

Partner Performance is **Marketplace-scoped only**:

```text
acquisitionSource = MARKETPLACE
```

Storefront seller performance is out of D10 scope (DATA-02).

---

## 6. Temporal Semantics

D8 temporal contracts are preserved:

```text
Period: [start, endExclusive)
Resolution: server-authoritative (resolveQueryPeriod)
Timezone: UTC instants
```

For each metric, the canonical business timestamp:

| Metric | Timestamp | Source |
|---|---|---|
| Orders | `createdAt` | Persistence time |
| GMV | `createdAt` | Persistence time |
| Bookings | `createdAt` | Persistence time |
| Completed Bookings | `completedAt` | Lifecycle milestone |
| Revenue | `paidAt` | Lifecycle milestone (via revenueWhere) |
| Commission | `createdAt` | Persistence time |

---

## 7. Finance Boundary

D10 **consumes** canonical Finance facts:

| Finance Fact | D10 Usage | Authority |
|---|---|---|
| Payment.amount | Revenue metric | Payment table |
| Commission.amount | Commission metric | Commission table |

D10 does **NOT**:
- Create Payment/Commission/Refund/Settlement/Payout
- Define financial rules
- Override Finance authority

---

## 8. D10 vs D11 Boundary

| Dimension | D10 | D11 |
|---|---|---|
| Purpose | Attribution semantics per Partner | Project-wide KPI/status reconciliation |
| Scope | Partner Performance metrics | All KPIs across all centers |
| Status | Uses existing statuses | Reconciles status vocabulary |

---

## 9. Security

```text
Permission: analytics.read
Partner scope: resolvePartnerScope() — PARTNER → own partnerId only
Negative: PARTNER A cannot see Partner B data
```

---

## 10. Evidence Sources

| Source | Location |
|---|---|
| Implementation | `backend/src/modules/analytics/analytics.service.ts` L793-1040 |
| Controller | `backend/src/modules/analytics/analytics.controller.ts` L88-100 |
| Tests | `backend/src/modules/analytics/analytics.service.spec.ts` |
| Schema | `backend/prisma/schema.prisma` — Order.sellerPartnerId, Booking.orderId |
| ADR | ADR-0013 D14 — frozen seller attribution |
