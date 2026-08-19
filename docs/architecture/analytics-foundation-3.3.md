# TravelHub — Step 3.3 Analytics Foundation — Design Document

**Date:** 2026-08-19
**Step:** 3.3 — Analytics Foundation
**Parent:** Phase 3 — Complete Platform
**Status:** DESIGN (not implemented)
**Mode:** REPOSITORY-FIRST / DESIGN-ONLY

---

## 1. Purpose

Define the Analytics Foundation for TravelHub: the canonical fact model, metrics catalog, dimensions framework, and read-model contracts that underpin all Phase 3 analytics (Dashboard, Analytics Center, Partner Analytics, Employee Analytics, Reports).

This document does NOT implement anything. It establishes the design authority for analytics queries, aggregations, and read models built on top of existing Phase 1–2 canonical data.

---

## 2. Design Principles

1. **Analytics reads from canonical facts — never from mutable current state alone.** `updatedAt` is never a business milestone.
2. **NULL / UNKNOWN is honest.** Legacy data without timestamps is classified as "unknown", not fabricated.
3. **No separate analytics warehouse in V1.** Analytics queries run against the canonical Prisma/PostgreSQL schema. Materialized views or dedicated read models are introduced only when query performance requires it.
4. **Period-over-period comparison is a first-class requirement.** Every metric must support comparison against the equivalent preceding period.
5. **Attribution is preserved end-to-end.** Acquisition source (Marketplace / Storefront / Direct / Manual / BuyerRequest) flows through Order → Booking → Payment without re-computation.
6. **Behavioral events ≠ business events ≠ AuditLog.** Each has its own schema, retention, and privacy contract.
7. **Employee analytics ≠ platform activity.** Platform activity is one input; it does not determine employee effectiveness.

---

## 3. Fact Model

### 3.1 Fact Classification

Facts are classified into four layers:

| Layer | Source | Privacy | Retention | Examples |
|---|---|---|---|---|
| **Business Lifecycle** | Domain entities + OutboxEvent | Authenticated actor | Indefinite (immutable history) | OrderCreated, BookingConfirmed, PaymentCaptured |
| **Financial** | LedgerTransaction + finance entities | System/financial | Indefinite (regulatory) | Ledger entries, Commission, Settlement |
| **Behavioral** | StorefrontBehavioralEvent + MarketplaceBehavioralEvent | Anonymous (sessionId) | Deferred (Step 2.17 retention) | ProductImpression, StorefrontViewed, CTAClicked |
| **Operational** | AuditLog + History tables | Authenticated actor | Indefinite (audit) | Login, CRUD operations, permission changes |

### 3.2 Canonical Fact Inventory

Each fact maps to a source table, a canonical timestamp, and relevant entity IDs.

#### 3.2.1 Catalog Facts

| Fact | Source Table | Canonical Timestamp | Entity IDs | Acquisition Source |
|---|---|---|---|---|
| Product Created | `catalog.Product` | `createdAt` | productId, createdBy | — |
| Product Published | `catalog.Product` + OutboxEvent `ProductPublished` | `publishedAt` | productId, updatedBy | — |
| Product Archived | `catalog.Product` + OutboxEvent `ProductArchived` | ProductHistory `archive` timestamp | productId, updatedBy | — |
| Moderation Submitted | `catalog.ModerationSubmission` | `submittedAt` | productId, submittedById | — |
| Moderation Decided | `catalog.ModerationSubmission` | `decidedAt` | productId, assignedModeratorId | — |
| Storefront Created | `catalog.PartnerStorefront` | `createdAt` | storefrontId, partnerId, createdById | — |
| Storefront Activated | `catalog.PartnerStorefront` + AuditLog | `activatedAt` | storefrontId, partnerId | — |

#### 3.2.2 Behavioral Facts (Anonymous)

| Fact | Source Table | Canonical Timestamp | Entity IDs | Acquisition Source |
|---|---|---|---|---|
| Marketplace Viewed | `catalog.MarketplaceBehavioralEvent` | `occurredAt` | sessionId | MARKETPLACE |
| Marketplace Product Impression | same | `occurredAt` | productId, sessionId | MARKETPLACE |
| Marketplace Product Viewed (PDP) | same | `occurredAt` | productId, sessionId | MARKETPLACE |
| Marketplace Search Performed | same | `occurredAt` | sessionId | MARKETPLACE |
| Marketplace Category Viewed | same | `occurredAt` | categoryId, sessionId | MARKETPLACE |
| Marketplace CTA Clicked | same | `occurredAt` | productId, sessionId | MARKETPLACE |
| Storefront Viewed | `catalog.StorefrontBehavioralEvent` | `occurredAt` | storefrontId, sessionId | PARTNER_STOREFRONT |
| Storefront Product Impression | same | `occurredAt` | storefrontId, productId, sessionId | PARTNER_STOREFRONT |
| Storefront Product Viewed | same | `occurredAt` | storefrontId, productId, sessionId | PARTNER_STOREFRONT |
| Storefront Contact Clicked | same | `occurredAt` | storefrontId, sessionId | PARTNER_STOREFRONT |

#### 3.2.3 CRM Facts

| Fact | Source Table | Canonical Timestamp | Entity IDs |
|---|---|---|---|
| Customer Created | `crm.Customer` + OutboxEvent `CustomerCreated` | `createdAt` | customerId, actor |
| Partner Created | OutboxEvent `PartnerCreated` | event `createdAt` | partnerId, reviewedById |
| Partner Application Submitted | `security.PartnerApplication` | `submittedAt` | partnerId, applicantId |
| Partner Application Reviewed | same | `reviewedAt` | partnerId, reviewedById |

#### 3.2.4 Sales Pipeline Facts

| Fact | Source Table | Canonical Timestamp | Entity IDs | Acquisition Source |
|---|---|---|---|---|
| Opportunity Created | `sales.Opportunity` | `createdAt` | opportunityId, partnerId | — |
| Quote Created | `sales.Quote` | `createdAt` | quoteId, partnerId, customerId | — |
| Quote Issued | `sales.Quote` | `issuedAt` | quoteId | — |
| Checkout Started | `sales.CheckoutIntent` | `createdAt` | checkoutId, quoteId | — |
| Sale Created | `sales.Sale` | `createdAt` | saleId, quoteId | — |
| Sale Completed | `sales.Sale` | `completedAt` | saleId, orderId | acquisitionSource |

#### 3.2.5 Order Facts

| Fact | Source Table | Canonical Timestamp | Entity IDs | Acquisition Source |
|---|---|---|---|---|
| Order Created | `order.Order` + OutboxEvent `OrderCreated` | `createdAt` | orderId, customerId, sellerPartnerId | acquisitionSource |
| Order Ready for Booking | OutboxEvent `OrderReadyForBooking` | event `createdAt` | orderId | — |
| Order Fulfilled | OutboxEvent `OrderFulfilled` | event `createdAt` | orderId | — |
| Order Closed | OutboxEvent `OrderClosed` | event `createdAt` | orderId | — |
| Order Cancelled | OutboxEvent `OrderCancelled` | event `createdAt` | orderId | — |

**Order financial snapshot (frozen at creation):**
- `amount` (total), `paidAmount`, `refundedAmount`, `currency`
- `paymentStatus` (UNPAID / PAID / REFUNDED)
- `sellerPartnerId` (frozen), `commissionSnapshot` (frozen)

#### 3.2.6 Booking Facts

| Fact | Source Table | Canonical Timestamp | Entity IDs | Acquisition Source |
|---|---|---|---|---|
| Booking Requested | `booking.Booking` + OutboxEvent `BookingRequested` | `requestedAt` | bookingId, orderId, productId | acquisitionSource |
| Booking Confirmed | OutboxEvent `BookingConfirmed` | event `createdAt` | bookingId, orderId | — |
| Booking Rejected | OutboxEvent `BookingRejected` | event `createdAt` | bookingId, orderId | — |
| Booking Cancelled | OutboxEvent `BookingCancelled` | event `createdAt` | bookingId, orderId | — |
| Booking Completed | OutboxEvent `BookingCompleted` | event `createdAt` | bookingId, orderId | — |

**Booking temporal milestones (2.9A):**
- `requestedAt`, `confirmedAt`, `rejectedAt`, `cancelledAt`, `completedAt`
- **Service occurrence (2.8A):** `serviceDate`, `serviceTime`, `serviceStartsAt`, `serviceEndsAt`, `serviceTimeZone`

#### 3.2.7 Payment Facts

| Fact | Source Table | Canonical Timestamp | Entity IDs |
|---|---|---|---|
| Payment Created | `finance.Payment` + OutboxEvent `PaymentCreated` | `createdAt` | paymentId, orderId, partnerId |
| Payment Captured (Paid) | OutboxEvent `PaymentCaptured` | `paidAt` | paymentId, orderId |
| Payment Failed | OutboxEvent `PaymentFailed` | `failedAt` | paymentId, orderId |
| Payment Cancelled | OutboxEvent `PaymentCancelled` | `cancelledAt` | paymentId, orderId |

**Payment financial snapshot:**
- `amount`, `currency`, `status` (PENDING / CAPTURED / FAILED / CANCELLED)

#### 3.2.8 Refund Facts

| Fact | Source Table | Canonical Timestamp | Entity IDs |
|---|---|---|---|
| Refund Requested | `finance.Refund` + OutboxEvent `RefundCreated` | `requestedAt` | refundId, paymentId, orderId |
| Refund Approved | OutboxEvent `RefundApproved` | `approvedAt` | refundId |
| Refund Processed | OutboxEvent `RefundProcessed` | `processedAt` | refundId, orderId |
| Refund Failed | OutboxEvent `RefundFailed` | `failedAt` | refundId |

#### 3.2.9 Commission Facts

| Fact | Source Table | Canonical Timestamp | Entity IDs |
|---|---|---|---|
| Commission Accrued | `finance.Commission` + OutboxEvent `CommissionAccrued` | `createdAt` | commissionId, orderId, partnerId |
| Commission Accrual Recognized | `finance.CommissionAccrual` | `accruedAt` | accrualId, partnerId, sourceCommissionId |

**Commission financial snapshot:**
- `amount`, `currency`, `collectionModel` (PARTNER_COLLECT), `status`

#### 3.2.10 Financial Ledger Facts

| Fact | Source Table | Canonical Timestamp | Entity IDs |
|---|---|---|---|
| Ledger Entry | `finance.LedgerTransaction` | `occurredAt` (business) or `createdAt` (persistence) | LTX code, sourceType, sourceId, sourceEventId |

**Ledger dimensions:**
- `type` (classification of financial fact)
- `sourceType` (ORDER / BOOKING / PAYMENT / COMMISSION / etc.)
- `currency`, `amount`
- `actorType`, `actorId`

#### 3.2.11 Communication Facts

| Fact | Source Table | Canonical Timestamp | Entity IDs |
|---|---|---|---|
| Communication Sent | `communication.Communication` | `occurredAt` | communicationId, actorUserId |

---

## 4. Metrics Catalog

### 4.1 Revenue & Commercial Metrics

| Metric | Definition | Source Facts | Time Window | Period Comparison |
|---|---|---|---|---|
| **GMV** (Gross Merchandise Value) | Sum of `Order.amount` for FULFILLED/CLOSED orders | OrderCreated + OrderFulfilled/Closed | Order `createdAt` | vs previous period |
| **Revenue** | Sum of `Payment.amount` where status=CAPTURED | PaymentCaptured | Payment `paidAt` | vs previous period |
| **Net Revenue** | Revenue − RefundProcessed amount | PaymentCaptured − RefundProcessed | respective milestones | vs previous period |
| **Commission Accrued** | Sum of `Commission.amount` | CommissionAccrued | Commission `createdAt` | vs previous period |
| **Refund Amount** | Sum of `Refund.amount` where status=PROCESSED | RefundProcessed | Refund `processedAt` | vs previous period |
| **Average Order Value** | GMV / count of FULFILLED/CLOSED orders | same as GMV | same | vs previous period |

### 4.2 Conversion & Funnel Metrics

| Metric | Definition | Source Facts | Time Window |
|---|---|---|---|
| **Product View → Checkout Started** | count(CheckoutStarted) / count(ProductViewed) | Behavioral + CheckoutIntent | session or period |
| **Checkout → Order Created** | count(OrderCreated) / count(CheckoutStarted) | CheckoutIntent + OrderCreated | period |
| **Order → Payment Succeeded** | count(PaymentCaptured) / count(OrderCreated) | Order + Payment | period |
| **Payment → Booking Confirmed** | count(BookingConfirmed) / count(PaymentCaptured) | Payment + Booking | period |
| **Booking → Service Completed** | count(BookingCompleted) / count(BookingConfirmed) | Booking | period |
| **Overall Marketplace Conversion** | ProductImpression → BookingCompleted (end-to-end) | all layers | period |
| **BuyerRequest → Sale** | count(Sale) / count(BuyerRequestCreated) | reverse + sales | period |
| **Seller Response Rate** | count(SellerResponded) / count(BuyerRequestMatched) | reverse | period |
| **Proposal Selection Rate** | count(ProposalSelected) / count(ProposalViewed) | reverse | period |

### 4.3 Timing & SLA Metrics

| Metric | Definition | Source Facts | Formula |
|---|---|---|---|
| **Booking Confirmation Time** | Time from request to confirmation | Booking `requestedAt` → `confirmedAt` | confirmedAt − requestedAt |
| **Order Processing Time** | Time from creation to fulfillment | Order `createdAt` → OrderFulfilled event | event occurredAt − Order.createdAt |
| **Payment Processing Time** | Time from creation to capture | Payment `createdAt` → `paidAt` | paidAt − Payment.createdAt |
| **Refund Processing Time** | Time from request to processing | Refund `requestedAt` → `processedAt` | processedAt − requestedAt |
| **Time to First Proposal** | Time from BuyerRequest creation to first seller response | reverse events | first response − request created |
| **Quote Lead Time** | Time from Opportunity to Quote issuance | Opportunity `createdAt` → Quote `issuedAt` | issuedAt − Opportunity.createdAt |
| **Payout Delay** | Time from Settlement to Payout | Settlement `createdAt` → Payout `createdAt` | Payout.createdAt − Settlement.createdAt |

### 4.4 Platform Activity Metrics

| Metric | Definition | Source Facts | Time Window |
|---|---|---|---|
| **Marketplace Sessions** | Distinct sessionId in MarketplaceBehavioralEvent | Behavioral | period |
| **Storefront Sessions** | Distinct sessionId in StorefrontBehavioralEvent | Behavioral | period |
| **Product Views (Marketplace)** | count(MARKETPLACE_PRODUCT_VIEWED) | Behavioral | period |
| **Product Views (Storefront)** | count(STOREFRONT_PRODUCT_VIEWED) | Behavioral | period |
| **Searches Performed** | count(MARKETPLACE_SEARCH_PERFORMED) | Behavioral | period |
| **CTA Clicks** | count(MARKETPLACE_CTA_CLICKED + STOREFRONT_CONTACT_CLICKED) | Behavioral | period |
| **Active Partners** | Partners with ≥1 published Product or active Storefront | Product + PartnerStorefront | period |
| **Active Products** | Products with status=PUBLISHED | Product | point-in-time |

### 4.5 Partner Performance Metrics

| Metric | Definition | Source Facts |
|---|---|---|
| **Partner GMV** | Sum of Order.amount where sellerPartnerId = partner | Order |
| **Partner Revenue** | Sum of Payment.amount (CAPTURED) for partner's orders | Payment + Order |
| **Partner Commission** | Sum of Commission.amount for partner | Commission |
| **Partner Booking Volume** | Count of Bookings for partner's products | Booking + Product |
| **Partner Booking Completion Rate** | BookingCompleted / BookingConfirmed for partner | Booking |
| **Partner Response Time** | Average Booking Confirmation Time for partner | Booking |
| **Partner Cancellation Rate** | BookingCancelled / BookingConfirmed for partner | Booking |

### 4.6 Product Performance Metrics

| Metric | Definition | Source Facts |
|---|---|---|
| **Product Views** | Behavioral impressions + PDP views | Behavioral events |
| **Product Conversion Rate** | CheckoutStarted / ProductViewed | Behavioral + CheckoutIntent |
| **Product Order Volume** | Count of Orders containing product | OrderItem |
| **Product GMV** | Sum of OrderItem.amount for product | OrderItem |
| **Product Moderation Lead Time** | decidedAt − submittedAt | ModerationSubmission |

---

## 5. Dimensions Framework

### 5.1 Time Dimensions

| Dimension | Granularity | Source | Notes |
|---|---|---|---|
| **hour** | UTC hour | any `createdAt`/`occurredAt` | for intra-day patterns |
| **day** | UTC date | same | primary analytics grain |
| **week** | ISO week | same | weekly trends |
| **month** | Calendar month | same | monthly reporting |
| **quarter** | Calendar quarter | same | business reporting |
| **year** | Calendar year | same | annual reporting |
| **serviceDate** | Business date of service | Order/Booking `serviceDate` | for tourism-specific time analysis |
| **period** | Custom range | query parameter | for ad-hoc analysis |

**Period comparison:** Every metric supports `period` vs `previousPeriod` (same duration, immediately preceding). Implementation: `WHERE createdAt >= :start AND createdAt < :end` vs `WHERE createdAt >= :prevStart AND createdAt < :start`.

### 5.2 Entity Dimensions

| Dimension | Values | Source |
|---|---|---|
| **acquisitionSource** | MARKETPLACE, PARTNER_STOREFRONT, DIRECT, BUYER_REQUEST | Order.acquisitionSource, Booking.acquisitionSource, BehavioralEvent.acquisitionSource |
| **partner** | partnerId | Order.sellerPartnerId, Commission.partnerId, Booking → Product → Partner |
| **product** | productId | OrderItem, Booking, BehavioralEvent |
| **category** | categoryId | Product → Category, BehavioralEvent.categoryId |
| **customer** | customerId | Order.customerId, Customer |
| **orderStatus** | NEW, CONFIRMED, FULFILLED, CLOSED, CANCELLED | Order.status |
| **bookingStatus** | NEW, SENT_TO_SUPPLIER, CONFIRMED, SUPPLIER_REJECTED, CANCELLED, COMPLETED | Booking.status |
| **paymentStatus** | UNPAID, PAID, REFUNDED | Order.paymentStatus |
| **paymentMethod** | (future: card, wallet, bank) | Payment.paymentMethod |
| **currency** | ISO 4217 | Order.currency, Payment.currency |
| **commissionCollectionModel** | PARTNER_COLLECT | Commission.collectionModel |

### 5.3 Geographic Dimensions

| Dimension | Source | Notes |
|---|---|---|
| **country** | Partner registration country, Product destination | for geographic analytics |
| **city** | Product destination | for local analytics |

*Note: Geographic dimensions are deferred until Partner Storefront / Product destination coverage is fully implemented (Step 3.29).*

---

## 6. Read Models

### 6.1 Design Strategy

In V1, analytics queries run directly against the canonical Prisma schema. No separate analytics database or ETL pipeline.

When query performance requires it, the following read models can be introduced as PostgreSQL materialized views or dedicated query services:

### 6.2 Proposed Read Models

#### 6.2.1 Company KPI Summary (Dashboard)

**Purpose:** Single-screen overview for management.
**Refresh:** On-demand or periodic (materialized view).
**Grain:** One row per day.

| Field | Source |
|---|---|
| date | day bucket |
| gmv | SUM(Order.amount) WHERE status IN (FULFILLED, CLOSED) |
| revenue | SUM(Payment.amount) WHERE status = CAPTURED |
| netRevenue | revenue − SUM(Refund.amount) WHERE status = PROCESSED |
| commissionAccrued | SUM(Commission.amount) |
| ordersCreated | COUNT(Order) |
| ordersFulfilled | COUNT(OrderFulfilled events) |
| bookingsRequested | COUNT(Booking WHERE requestedAt NOT NULL) |
| bookingsConfirmed | COUNT(BookingConfirmed events) |
| bookingsCompleted | COUNT(BookingCompleted events) |
| paymentsCaptured | COUNT(PaymentCaptured events) |
| refundsProcessed | COUNT(RefundProcessed events) |
| marketplaceSessions | COUNT(DISTINCT sessionId) FROM MarketplaceBehavioralEvent |
| storefrontSessions | COUNT(DISTINCT sessionId) FROM StorefrontBehavioralEvent |
| activePartners | COUNT(DISTINCT partnerId) FROM Product WHERE status = PUBLISHED |
| newCustomers | COUNT(CustomerCreated events) |
| newPartners | COUNT(PartnerCreated events) |

#### 6.2.2 Partner Performance Summary

**Purpose:** Per-partner analytics for management and Partner Dashboard.
**Grain:** One row per (partner, day).

| Field | Source |
|---|---|
| partnerId | — |
| date | day bucket |
| partnerGmv | SUM(Order.amount) WHERE sellerPartnerId = partner |
| partnerRevenue | SUM(Payment.amount) WHERE Order.sellerPartnerId = partner AND status = CAPTURED |
| partnerCommission | SUM(Commission.amount) WHERE partnerId = partner |
| ordersCount | COUNT(Orders for partner) |
| bookingsCount | COUNT(Bookings for partner's products) |
| bookingCompletionRate | bookingsCompleted / bookingsConfirmed |
| avgConfirmationTime | AVG(Booking.confirmedAt − Booking.requestedAt) |
| cancellationRate | bookingsCancelled / bookingsConfirmed |
| activeProducts | COUNT(Products WHERE partnerId = partner AND status = PUBLISHED) |

#### 6.2.3 Conversion Funnel

**Purpose:** Marketplace and Storefront conversion analysis.
**Grain:** One row per (period, acquisitionSource).

| Stage | Count Source |
|---|---|
| Product Impression | BehavioralEvent WHERE type = *_PRODUCT_IMPRESSION |
| Product Viewed | BehavioralEvent WHERE type = *_PRODUCT_VIEWED |
| Checkout Started | COUNT(CheckoutIntent) |
| Order Created | COUNT(Order) |
| Payment Succeeded | COUNT(Payment WHERE status = CAPTURED) |
| Booking Confirmed | COUNT(BookingConfirmed events) |
| Service Completed | COUNT(BookingCompleted events) |

#### 6.2.4 Time-Based Analytics

**Purpose:** Hourly/daily/weekly/monthly trends.
**Grain:** One row per (metric, timeBucket).

Supports the period selector contract:
- Today, Last 3 days, Last 7 days / Week, Month, 6 months, Year, Custom
- Period-over-period comparison (7d vs prev 7d, month vs prev month, etc.)

#### 6.2.5 Financial Reconciliation Summary

**Purpose:** Financial health overview.
**Grain:** One row per (day, currency).

| Field | Source |
|---|---|
| date | day bucket |
| currency | ISO 4217 |
| totalPayments | SUM(Payment.amount WHERE status = CAPTURED) |
| totalRefunds | SUM(Refund.amount WHERE status = PROCESSED) |
| netPayments | totalPayments − totalRefunds |
| totalCommission | SUM(Commission.amount) |
| totalSettlements | SUM(Settlement.amount) |
| totalPayouts | SUM(Payout.amount) |
| ledgerEntries | COUNT(LedgerTransaction) |

---

## 7. Acquisition Source Attribution

### 7.1 Source Propagation Chain

```
BehavioralEvent.acquisitionSource (server-authoritative)
    ↓ (implied by event context)
CheckoutIntent → Sale.acquisitionSource (frozen at completion)
    ↓ (verbatim copy)
Order.acquisitionSource (frozen at Order creation)
    ↓ (verbatim copy)
Booking.acquisitionSource (frozen at Booking creation)
```

### 7.2 Attribution Rules

1. **Publication channel ≠ acquisition source.** A Product published on Marketplace can be purchased via Storefront (acquisition = PARTNER_STOREFRONT).
2. **Source is frozen at commercial entry.** Once an Order is created, `acquisitionSource` never changes.
3. **Cannot recompute source post-factum** from current Product status, Storefront status, or URL.
4. **BuyerRequest attribution** (Step 3.3D): `BUYER_REQUEST` source preserved end-to-end through request → proposal → sale → order → booking.

### 7.3 Comparable Channels

All channels are comparable by the same `acquisitionSource` dimension:
- `MARKETPLACE` — public marketplace
- `PARTNER_STOREFRONT` — partner's storefront
- `DIRECT` — direct/manual (future: custom domain, API)
- `BUYER_REQUEST` — reverse marketplace request

---

## 8. KPI Dictionary (Step 3.3B Scope)

### 8.1 Revenue KPIs

| KPI | Formula | Unit | Period |
|---|---|---|---|
| GMV | SUM(Order.amount WHERE status ∈ {FULFILLED, CLOSED}) | currency | day/week/month |
| Revenue | SUM(Payment.amount WHERE status = CAPTURED) | currency | day/week/month |
| Net Revenue | Revenue − SUM(Refund.amount WHERE status = PROCESSED) | currency | day/week/month |
| Average Order Value | GMV / count(orders) | currency | day/week/month |
| Revenue per Partner | Revenue WHERE sellerPartnerId = X | currency | day/week/month |
| Revenue per Product | Revenue WHERE product = X | currency | day/week/month |

### 8.2 Commission KPIs

| KPI | Formula | Unit | Period |
|---|---|---|---|
| Commission Accrued | SUM(Commission.amount) | currency | day/week/month |
| Commission Rate | Commission Accrued / GMV | percentage | day/week/month |
| Partner Commission | SUM(Commission.amount WHERE partnerId = X) | currency | day/week/month |

### 8.3 Conversion KPIs

| KPI | Formula | Unit | Period |
|---|---|---|---|
| Checkout Conversion | count(CheckoutStarted) / count(ProductViewed) | percentage | day/week/month |
| Payment Conversion | count(PaymentCaptured) / count(OrderCreated) | percentage | day/week/month |
| Booking Confirmation Rate | count(BookingConfirmed) / count(BookingRequested) | percentage | day/week/month |
| Service Completion Rate | count(BookingCompleted) / count(BookingConfirmed) | percentage | day/week/month |
| Overall Funnel Conversion | BookingCompleted / ProductImpression | percentage | day/week/month |
| Request-to-Sale Conversion | count(Sale) / count(BuyerRequestCreated) | percentage | day/week/month |

### 8.4 Timing KPIs

| KPI | Formula | Unit | Period |
|---|---|---|---|
| Booking Confirmation Time | AVG(confirmedAt − requestedAt) | hours/days | day/week/month |
| Order Processing Time | AVG(OrderFulfilled.event.occurredAt − Order.createdAt) | hours/days | day/week/month |
| Payment Processing Time | AVG(paidAt − Payment.createdAt) | minutes/hours | day/week/month |
| Refund Processing Time | AVG(processedAt − requestedAt) | hours/days | day/week/month |
| Time to First Proposal | AVG(firstProposal.createdAt − BuyerRequest.createdAt) | hours | day/week/month |

### 8.5 Quality KPIs

| KPI | Formula | Unit | Period |
|---|---|---|---|
| Cancellation Rate | count(BookingCancelled) / count(BookingConfirmed) | percentage | day/week/month |
| Refund Rate | SUM(Refund.amount WHERE PROCESSED) / Revenue | percentage | day/week/month |
| Order Cancellation Rate | count(OrderCancelled events) / count(OrderCreated) | percentage | day/week/month |
| Payment Failure Rate | count(PaymentFailed) / count(PaymentCreated) | percentage | day/week/month |

### 8.6 Activity KPIs

| KPI | Formula | Unit | Period |
|---|---|---|---|
| Marketplace Sessions | COUNT(DISTINCT sessionId) FROM MarketplaceBehavioralEvent | count | day/week/month |
| Storefront Sessions | COUNT(DISTINCT sessionId) FROM StorefrontBehavioralEvent | count | day/week/month |
| Active Partners | COUNT(DISTINCT partnerId) FROM Product WHERE PUBLISHED | count | point-in-time |
| Active Products | COUNT(Product WHERE status = PUBLISHED) | count | point-in-time |
| New Customers | COUNT(CustomerCreated events) | count | day/week/month |
| New Partners | COUNT(PartnerCreated events) | count | day/week/month |

---

## 9. Employee Analytics Contract (Preserved for Step 3.4+)

### 9.1 Semantic Rule

```
PLATFORM ACTIVITY ≠ EMPLOYEE EFFECTIVENESS
```

### 9.2 Data Inputs (NOT scores)

Employee analytics may combine:
- Platform activity (login frequency, actions performed)
- Sales results (Orders closed, GMV generated)
- Booking results (Bookings confirmed, completion rate)
- CRM activity (customers managed, follow-ups completed)
- Communication (messages sent, response time)
- Financial results (revenue collected, refunds issued)

### 9.3 Authority Requirements

Before implementing employee scoring:
- Employee roles must be defined (sales manager, booking operator, finance, team lead, support, admin)
- Measurable responsibilities per role must be identified
- KPI ownership and weighting authority must be established
- Formula authority must be assigned

**None of these are implemented yet.** Employee analytics in Step 3.4+ must NOT invent weights or scores without explicit authority.

---

## 10. Analytics Period Selector Contract

### 10.1 Standard Periods

| Period | Definition |
|---|---|
| Today | current UTC day |
| Last 3 days | 3 complete UTC days before today |
| Last 7 days / Week | 7 complete UTC days before today |
| Month | current calendar month (UTC) |
| 6 months | 6 complete calendar months before current |
| Year | current calendar year (UTC) |
| Custom | user-defined start/end |

### 10.2 Comparison

Every period supports comparison against the equivalent preceding period:
- 7 days → previous 7 days
- Month → previous month
- 6 months → previous 6 months
- Year → previous year
- Custom → same duration immediately preceding

### 10.3 Reusable Across Domains

The period selector contract is shared by:
- Company-level analytics
- Partner analytics
- Product analytics
- Employee analytics (when implemented)
- Sales analytics
- Booking analytics
- Finance analytics
- CRM analytics

---

## 11. Information Architecture

### 11.1 Top-Level Workspace Areas

| Area | Exists Now | Backend Module | Frontend Route | Phase 3 Step |
|---|---|---|---|---|
| Command Center | Dashboard (empty?) | — | `/app/dashboard` | 3.1, 3.2 |
| Analytics | — | — | — | 3.3, 3.4 |
| Sales | Sales domain | `sales` | `/app/crm` (partial) | 3.4 (UI) |
| Bookings | Booking domain | `booking` | `/app/bookings` | 3.4 (UI) |
| Orders | Order domain | `order` | `/app/orders` | 3.4 (UI) |
| CRM / Customers | CRM domain | `crm` | `/app/crm` | 3.5, 3.6 |
| Products | Catalog domain | `catalog` | `/app/catalog` | existing |
| Finance | Finance domain | `finance` | — | 3.4 (UI) |
| Team / Employees | — | — | `/app/users` (basic) | 3.12 |
| Tasks | — | — | — | future |
| Communications | Communication domain | `communication` | — | 3.7 |
| Support | — | — | `/account/support` (empty) | 3.10, 3.11 |
| Settings | — | — | — | 3.28 |

### 11.2 No Duplicate Centers

Analytics reuses existing backend modules for data access. No separate analytics microservice or warehouse is created in V1. The analytics read layer queries the canonical schema directly.

---

## 12. Deferred Items

| Item | Deferred To | Reason |
|---|---|---|
| Geographic dimensions (country/city) | Step 3.29 (Partner Storefront) | Destination coverage not yet implemented |
| Employee scoring/efficiency | Step 3.4+ with authority | No KPI weights authorized yet |
| Real-time analytics | Future | V1 uses periodic aggregation |
| A/B testing framework | Future | Not in Phase 3 scope |
| Predictive analytics / ML | Step 3.24 (AI Center) | Separate step |
| Data export / scheduled reports | Step 3.19 (Reports Domain) | Separate step |
| Multi-currency conversion analytics | Step 2.12B+ (PSP) | Real FX rates not yet available |

---

## 13. Implementation Boundary

### 13.1 What Step 3.3 Implements

1. **Fact model documentation** (this document)
2. **Metrics catalog** (this document)
3. **Dimensions framework** (this document)
4. **Read model contracts** (this document)
5. **Analytics query service** (backend module `analytics/`)
6. **Database indexes** (if needed for query performance)
7. **API endpoints** for analytics data

### 13.2 What Step 3.3 Does NOT Implement

1. Frontend UI (Step 3.4 — Analytics Center UI)
2. Dashboard UI (Step 3.2)
3. Employee analytics scoring (requires authority)
4. Separate analytics database / ETL
5. Real-time streaming analytics
6. Data retention policies (Step 3.45A)

---

## 14. Dependencies

| Dependency | Status | Impact |
|---|---|---|
| Phase 2 completion (all domain events) | APPROVED (except 2.17B) | All canonical events available |
| Analytics Readiness (Step 1.18A) | APPROVED | Fact model validated |
| ADR-0014 (tenant isolation) | ACCEPTED | Application-level isolation sufficient |
| Step 2.17B (performance) | BLOCKED | Does NOT block analytics design/implementation |
| Step 3.3A (Fact Model) | PART OF THIS STEP | Included in this design |
| Step 3.3B (KPI Dictionary) | PART OF THIS STEP | Included in this design |
| Step 3.3C (Conversion Funnel) | PART OF THIS STEP | Included in this design |
| Step 3.3D (Attribution) | PART OF THIS STEP | Included in this design |

---

## 15. Open Questions

1. **Materialized views vs query-time aggregation?** — Defer to implementation; start with query-time, introduce materialized views if performance requires.
2. **Analytics schema (separate `analytics` schema in PostgreSQL)?** — Recommended for isolation, but not required in V1.
3. **Event sourcing for analytics?** — No; analytics reads from canonical entities + OutboxEvent, not from a separate event store.
4. **Multi-tenancy for analytics?** — Follow ADR-0014: application-level isolation. Partner analytics are partner-scoped. Company analytics are company-scoped.
