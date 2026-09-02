# TravelHub — Текущая Canonical Architecture

**Дата актуализации:** 2026-09-02
**Статус:** Reconciliation Report — reconcile архитектурных документов, roadmap, кода и утверждённых business decisions.

---

# 1. What is TravelHub?

Marketplace + Storefront SaaS платформа для путешествий:

```
Marketplace
  → поставщики (partners) публикуют услуги
  → покупатели (customers/buyers) ищут и бронируют
  → TravelHub взимает commission

Storefront SaaS
  → partners создают персональные витрины
  → оплачивают подписку (SaaS)
  → их клиенты бронируют напрямую
  → TravelHub получает SaaS revenue
```

**Hard invariant:** Storefront customer commerce ≠ Marketplace GMV ≠ TravelHub Revenue.

---

# 2. Workspaces

```
IDENTITY → WORKSPACE CONTEXT → TENANT/PARTNER SCOPE → PLAN/ENTITLEMENT → CAPABILITY → ROLE/_PERMISSION → ACCESS
```

- **Platform Workspace** — администрирование, аналитика, управление
- **Partner Workspace** — управление своими продуктами, заказами, клиентами

**Hard invariant:** Entitlement ≠ Permission. PARTNER role ≠ Storefront Pro.

---

# 3. Commercial Lifecycle — Primary Canonical Contract

## 3.1 Forward Flow (Marketplace)

```
Product / Service (Catalog)
  ↓
Public Marketplace → buyer browses / searches
  ↓
Quote (QTE-*) — binding price snapshot
  ↓
Checkout Intent (CKT-*) — commercial intent
  ↓
Sale (SAL-) → OrderRequested (outbox event)
  ↓
Order (ORD-*) — canonical order creation
  ↓
Booking (BKG-) — fulfillment entity
  ↓
Payment (PAY-*) — financial transaction
  ↓
Voucher / fulfillment document
  ↓
Service delivery
  ↓
Completion
```

## 3.2 Reverse Marketplace Flow

```
BuyerRequest (BRQ-*) — buyer demand
  ↓
Matching & Distribution → eligible sellers
  ↓
Seller Proposals → buyer selects one
  ↓
Opportunity (OPP-) → Sales conversion
  ↓
Canonical forward flow (Quote → Checkout → Sale → Order → Booking)
```

## 3.3 Request Flow (Pre-Order Validation)

```
Request (REQ-) — availability / price confirmation workflow
  ↓
Supplier confirms / rejects / changes price
  ↓
Customer accepts current terms
  ↓
[Traveler data collection — FUTURE]
  ↓
Request converted to Order
```

**Request** — это workflow pre-order validation, а НЕ primary Order creation path.

**Hard invariant:** Supplier CONFIRMED ≠ automatic final Booking.
**Hard invariant:** Price/terms changed → explicit customer acceptance required.

## 3.4 Authoritative Real-Time Flow

Для services с authoritative current terms (без availability uncertainty):

```
Product → checkout → Order → Booking → Payment
```

Request может быть пропущен.

---

# 4. Commerce Identity / References

```
Request:   MKT-REQ-00000001
Order:     MKT-ORD-00000001
Booking:   MKT-BKG-00000001
Payment:   MKT-PAY-00000001-1
Refund:    MKT-REF-00000001
```

**Canonical width:** 8 digits after prefix.
**Shared commerce root:** commerceSequence — общий root для цепочки entities.
**Relationships:** по FK/UUID, не parsing strings.
**Legacy 6-digit references:** deprecated, не возвращать.

---

# 5. Customer / Payer / Traveler — Roles

```
Customer = покупатель / заказчик / CRM customer
Payer = фактический плательщик
Traveler = получатель услуги / участник бронирования
```

**Supported cases:**
- A: Customer = Payer = Traveler
- B: Customer = Payer ≠ Traveler
- C: Customer ≠ Payer ≠ Traveler
- D: Customer = one of multiple Travelers
- E: Customer does not travel

**Current implementation:** Payer collapsed into `Order.customerId` (V1 simplification, PROPOSED_NOT_APPROVED).

**Canonical:** Traveler data belong to Booking (Passenger model). Booking → 1..N Passengers.

**Hard invariant:** Traveler ≠ automatically CRM Customer.

---

# 6. Traveler Domain

## 6.1 Existing Models

| Model | Schema | Phase | Fields | Records |
|---|---|---|---|---|
| QuoteTraveler | sales | Quote | firstName, lastName, birthDate | populated via Quote API |
| CheckoutIntentTraveler | sales | Checkout | firstName, lastName, birthDate | populated via Checkout API |
| OrderTraveler | order | Order | + citizenship, gender, passport | **0 records** |
| Passenger | booking | Booking | + citizenship, gender, passport | **0 records** |

**Passenger = Traveler** (technical model). Новая entity НЕ создаётся.

## 6.2 Seller-Defined Traveler Requirements

Product/Service defines which traveler fields are needed:

```
NOT_REQUESTED
OPTIONAL
REQUIRED
```

Not one global mandatory set for all services.

## 6.3 Booking Snapshot Contract

```
Product Traveler Requirements
        ↓
Booking creation
        ↓
immutable historical snapshot
```

Product changes tomorrow don't retroactively change existing Booking requirements.

## 6.4 Voucher Source

Voucher ← Booking → Passengers (not Customer/Order).

---

# 7. Order Contract

```
Order
  → customer-committed commercial transaction
  → frozen commercial snapshot (amount, currency, payment terms)
  → OrderItems (product snapshot)
  → OrderTraveler (traveler snapshot)
  → Fulfillment status
  → History/audit trail
```

**Creation:** via `OrderRequestedConsumer` (Step 2.5) from `OrderRequested` event.
**Lifecycle:** NEW → SUBMITTED → CONFIRMED → FULFILLED/CANCELLED/CLOSED.
**Temporal:** createdAt, submittedAt, confirmedAt, fulfilledAt, closedAt, cancelledAt.

---

# 8. Booking Contract

```
Booking
  → fulfillment entity for Order
  → 1 Order = 1 Booking (V1)
  → 1..N Passengers (travelers)
  → Service date/time model (Step 2.8A)
  → Lifecycle: REQUESTED → CONFIRMED/REJECTED/CANCELLED/COMPLETED/PROBLEM
```

**Creation:** ONLY via `BookingRequested` event → Booking-owned consumer.
**Frozen facts:** amount, acquisitionSource, service occurrence.
**Temporal:** createdAt, requestedAt, confirmedAt, rejectedAt, cancelledAt, completedAt.

---

# 9. Payment / Refund Contract

```
Payment
  → financial transaction against Order
  → amount, currency (matches Order.currency for single-currency flow)
  → status: PENDING → CAPTURED / FAILED / REFUNDED
  → paymentOrdinal (≥ 1 within commerceSequence)
```

```
Refund
  → reversal of Payment
  → Refund.currency = Payment.currency
  → refund amount ≤ paid amount
  → Refund.createdAt ≥ Payment.createdAt
```

**Hard invariant:** Order Status ≠ Payment Status ≠ Refund Status.

---

# 10. Platform / Partner / Marketplace / Storefront

```
MARKETPLACE
  → TravelHub operational + commercial business
  → Platform Workspace

STOREFRONT COMMERCE
  → Partner's own customer business
  → Partner Workspace
  → NOT Platform Marketplace commerce

STOREFRONT → TRAVELHUB
  → subscriptions / direct SaaS charges
  → Platform SaaS economics
```

**Hard invariant:** Storefront Commerce Volume ≠ Marketplace GMV.

---

# 11. Platform Revenue Model

```
TravelHub Revenue
├── Marketplace Revenue
│   └── commissions / marketplace fees
└── Storefront SaaS Revenue
    └── subscriptions / direct SaaS charges
```

---

# 12. Workspace / Entitlement / RBAC

```
IDENTITY → WORKSPACE CONTEXT → TENANT/PARTNER SCOPE → PLAN/ENTITLEMENT → CAPABILITY → ROLE/PERMISSION → ACCESS
```

10 canonical roles, granular permissions, RBAC enforced server-side.
Frontend hiding ≠ security control.

---

# 13. Platform Navigation (Current Canonical)

```
Рабочий стол
Центр управления
Аналитика

ОПЕРАЦИИ
  Заявки (Request Center)
  Заказы (Order Center)
  Бронирования (Booking Center)

КОММЕРЧЕСКОЕ УПРАВЛЕНИЕ
  Каталог
  CRM
  Маркетинг

ПАРТНЁРСКАЯ СЕТЬ
  Партнёры
  Продавцы

СЕРВИС
  Поддержка

АДМИНИСТРИРОВАНИЕ
  Пользователи
```

---

# 14. Full-Page Detail Contract

```
MKT-REQ-* → /app/requests/{id}    ✅ IMPLEMENTED
MKT-ORD-* → /app/orders/{id}      ⬜ NOT YET IMPLEMENTED
MKT-BKG-* → /app/bookings/{id}    ⬜ NOT YET IMPLEMENTED
```

Primary detail = full-page (не drawer/modal).

---

# 15. Export Contract

For exportable registries:

```
filtered population = CSV rows = XLSX rows
```

Server-authoritative: authentication, workspace, tenant, role, permission, scope.
Client `partnerId` ≠ authorization.

---

# 16. Temporal Visibility — Global Contract

Every business object exposes applicable lifecycle timestamps from creation through terminal state.

```
updatedAt ≠ business-event timestamp
missing / non-applicable event → "—"
```

DB timestamp = API timestamp = Detail timestamp = Registry timestamp = CSV/XLSX timestamp.

---

# 17. Analytics Boundaries

```
MARKETPLACE ANALYTICS
  → traffic, commerce, GMV, commission, Orders/Bookings, conversion

STOREFRONT SaaS ANALYTICS
  → adoption, subscriptions, MRR/ARR, churn/retention, SaaS revenue
```

Storefront end-customer commerce ≠ Platform Marketplace analytics.

---

# 18. Implemented vs Canonical vs Planned

| Area | Canonical | Implemented | Status |
|---|---|---|---|
| Forward commercial flow | Quote→Sale→Order→Booking | ✅ | CANONICAL + IMPLEMENTED |
| Reverse Marketplace | BuyerRequest→Proposal→Opportunity | ✅ | CANONICAL + IMPLEMENTED |
| Request flow | Request→Order conversion | ✅ | CANONICAL + IMPLEMENTED |
| Request Center UI | Full-page with search, detail, temporal | ✅ | CANONICAL + IMPLEMENTED |
| Order Center UI | Full-page table with export | ✅ | CANONICAL + IMPLEMENTED |
| Booking Center UI | Full-page table with export | ✅ | CANONICAL + IMPLEMENTED |
| Request Detail | /app/requests/{id} with full timeline | ✅ | CANONICAL + IMPLEMENTED |
| Order Detail | /app/orders/{id} dedicated page | ❌ | CANONICAL + NOT YET IMPLEMENTED |
| Booking Detail | /app/bookings/{id} dedicated page | ❌ | CANONICAL + NOT YET IMPLEMENTED |
| Traveler data requirements | Seller-defined per Product | ❌ | CANONICAL + NOT YET IMPLEMENTED |
| Booking traveler population | Booking → 1..N Passengers | ❌ | CANONICAL + NOT YET IMPLEMENTED |
| Checkout traveler collection | Traveler form in checkout | ❌ | CANONICAL + NOT YET IMPLEMENTED |
| Payer model | Separate Payer entity | ❌ | PROPOSED (V1 = Order.customerId) |
| Voucher source | Booking → Passengers | ❌ | CANONICAL + NOT YET IMPLEMENTED |
| Finance Center | Full financial management | ❌ | FUTURE / DEFERRED |
| Product Freshness | Product data freshness | ❌ | FUTURE / DEFERRED |

---

# 19. Architecture Drift Matrix

| Area | Canonical Architecture | Actual Implementation | Drift | Severity |
|---|---|---|---|---|
| Order Detail page | Full-page dedicated | Not implemented | Missing | MEDIUM |
| Booking Detail page | Full-page dedicated | Not implemented | Missing | MEDIUM |
| Traveler requirements | Seller-defined per Product | Not implemented | Missing | HIGH (architecture blocker for traveler flow) |
| Booking travelers | Booking → 1..N Passengers | Schema exists, 0 records | Missing | HIGH |
| Payer entity | Separate Payer model | Collapsed to Order.customerId | V1 simplification | LOW (deferred) |
| Voucher source | Booking → Passengers | Not implemented | Missing | MEDIUM (future) |
| Request→Order flow | Canonical conversion pipeline | Manual link via seed | Partial | LOW (seed-only) |

---

# 20. Current Completed Boundary

```
Phase 1: Steps 1.0-1.18 (ALL APPROVED)
Phase 2: Steps 2.0-2.10 (ALL APPROVED/COMPLETED)
Phase 3: Steps 3.0-3.11 (ALL VERDICT A)
PRE-STEP 3.12: Multiple sub-tasks completed
  - Shared Commerce Sequence ✅
  - Request Center UI/UX ✅
  - Request Center Final Evidence Closure ✅
  - Dev Database Clean Reset + Reseed ✅
  - Export Framework ✅
  - Traveler Architecture Audit ✅
  - Architecture Reconciliation ← THIS
```

---

# 21. Canonical NEXT Stage

After Architecture Reconciliation, the TRUE NEXT implementation stage is:

**Stage A: Product Traveler Requirements Model**

Блокер для traveler flow — без seller-defined requirements на Product невозможно:
- checkout traveler collection
- booking traveler population
- voucher generation

**Dependencies:** None (schema addition only).
**What it unblocks:** Stages B-H (traveler lifecycle implementation).
**What remains deferred:** Finance Center, Product Freshness, Orders/Bookings Detail, Step 3.12.
