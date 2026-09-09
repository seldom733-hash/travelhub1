# PHASE 3 — D8 — GLOBAL TEMPORAL VISIBILITY
## AUDIT-FIRST MAPPING & QUALIFICATION REPORT

---

### Executive Summary

**VERDICT: B — AUDIT READY WITH BLOCKERS**

D8 — Global Temporal Visibility — is the correct next D-track stage. The repository has a substantial foundation of temporal contracts established in D1–D7 (Order milestones, Booking service time model, Booking lifecycle milestones, Payment/Refund milestones, Ledger occurredAt). However, the global temporal visibility layer — unified presentation, cross-domain temporal consistency, and period/date filter standardization — requires targeted implementation work with specific architectural decisions before proceeding.

**Key finding:** The repository has strong per-domain temporal foundations but lacks a unified Global Temporal Vocabulary contract, and the existing period filters (Operations Center Header Period, individual registry dateFrom/dateTo) use inconsistent boundary semantics across registries. The frontend has a single `fmtDate()` helper per page but no shared temporal display component. The Booking `upcoming`/`overdue` detector uses `serviceDate` while Orders use `createdAt` — this is architecturally correct but not documented as a canonical D8 contract.

**Baseline SHA:** HEAD (origin/master)
**Report path:** `docs/reports/PHASE_3_D8_GLOBAL_TEMPORAL_VISIBILITY_AUDIT_FIRST_MAPPING_REPORT.md`

---

# 1. Canonical D8 Position

```text
D0  Reconciliation Final Git/Evidence Closure       ✅
D1  Commerce Lifecycle Contract Finalization         ✅
D1A Platform CRM Scope Isolation                     ✅
D2  Product Traveler Requirements                    ✅
D3  Traveler Collection + Population                 ✅
D4  Traveler Security + Representative Data          ✅
D4-REM Strict Review Remediation                     ✅
D5  Orders Full-Page Detail                          ✅
D6  Bookings Full-Page Detail                        ✅
D7  Payment/Refund Semantics + Financial Presentation ✅
D8  Global Temporal Visibility                       ⬜ NOT STARTED → TRUE NEXT
```

**TRUE NEXT = D8 — GLOBAL TEMPORAL VISIBILITY.**

---

# 2. Repository Baseline

| Item | Value |
|---|---|
| Branch | master |
| HEAD | origin/master |
| Prisma schemas | 13 (events, catalog, crm, order, booking, security, communication, sales, reverse, finance, decision, marketing, support) |
| Total models | ~80+ |
| Temporal DateTime fields | 158+ across all schemas |
| Backend modules | 16 (analytics, booking, catalog, communication, crm, crm-activity, dashboard, finance, marketing, operational-notes, order, reverse, sales, shared, support, workspace) |
| Frontend Operations Center registries | 4 (Requests, Orders, Bookings, Payments) |
| Frontend command-center | 1 (with PeriodSelector) |
| Frontend CRM surfaces | Customer 360, Partner 360, Analytics |
| Frontend Marketing | Campaign management |

---

# 3. Temporal Vocabulary (Existing)

The repository already has a documented temporal taxonomy (from `docs/architecture/temporal-readiness.md`):

```text
Entity time:        createdAt, updatedAt
Lifecycle time:     submittedAt, confirmedAt, cancelledAt, fulfilledAt, closedAt,
                    requestedAt, rejectedAt, completedAt, approvedAt, processedAt,
                    failedAt, activatedAt, deprecatedAt, publishedAt, reviewedAt,
                    decidedAt, reviewStartedAt, memberSince, expiredAt,
                    termsAcceptedAt, travelerDataCompletedAt, finalConfirmedAt
Service occurrence: serviceDate, serviceTime, serviceEndTime, serviceTimeZone,
                    serviceStartsAt, serviceEndsAt
Financial time:     occurredAt (Ledger), paidAt, failedAt, cancelledAt (Payment),
                    requestedAt, approvedAt, processedAt, failedAt (Refund),
                    openedAt, resolvedAt, cancelledAt (Dispute)
Event time:         OutboxEvent.createdAt, StorefrontBehavioralEvent.occurredAt,
                    MarketplaceBehavioralEvent.occurredAt
Processing time:    receivedAt (behavioral), publishedAt (outbox), processedAt (inbox)
Presentation period: dateFrom, dateTo (URL params), period presets (Command Center)
```

**Critical vocabulary distinction (already enforced):**
- `createdAt` ≠ `serviceDate` (persistence time ≠ service occurrence)
- `updatedAt` ≠ business milestone (row change ≠ lifecycle transition)
- `occurredAt` (Ledger) ≠ `createdAt` (financial fact time ≠ persistence time)

---

# 4. Temporal Authority Matrix

## 4.1 Request Domain (order.*)

| Entity | Field | Type | Writer | Immutable? | Timezone | UI usage | D8 status |
|---|---|---|---|---|---|---|---|
| Request | createdAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | List date, sort, filter | EXISTING_CANONICAL |
| Request | updatedAt | DateTime | Server (@updatedAt) | No | UTC | — | EXISTING_CANONICAL |
| Request | requestedServiceDate | DateTime? | Client | No | Date-only | Detail | EXISTING_CANONICAL |
| Request | supplierResponseDeadline | DateTime? | Server | Yes | UTC | Detail | EXISTING_CANONICAL |
| Request | supplierRespondedAt | DateTime? | Server | Yes | UTC | Detail | EXISTING_CANONICAL |
| Request | customerActionDeadline | DateTime? | Server | Yes | UTC | Detail | EXISTING_CANONICAL |
| Request | customerAcceptedAt | DateTime? | Server | Yes | UTC | Detail | EXISTING_CANONICAL |
| Request | convertedAt | DateTime? | Server | Yes | UTC | Detail | EXISTING_CANONICAL |
| Request | rejectedAt | DateTime? | Server | Yes | UTC | Detail | EXISTING_CANONICAL |
| RequestHistory | createdAt | DateTime | Server (default now()) | Yes | UTC | Audit history | EXISTING_CANONICAL |

## 4.2 Order Domain (order.*)

| Entity | Field | Type | Writer | Immutable? | Timezone | UI usage | D8 status |
|---|---|---|---|---|---|---|---|
| Order | createdAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | List date, sort, KPI filter | EXISTING_CANONICAL |
| Order | updatedAt | DateTime | Server (@updatedAt) | No | UTC | — | EXISTING_CANONICAL |
| Order | submittedAt | DateTime? | Server (D2.5A) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Order | confirmedAt | DateTime? | Server (D2.5A) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Order | cancelledAt | DateTime? | Server (D2.5A) | Yes | UTC | Detail, list (cancelledWithin detector) | EXISTING_CANONICAL |
| Order | fulfilledAt | DateTime? | Server (D2.5A) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Order | closedAt | DateTime? | Server (D2.5A) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Order | termsAcceptedAt | DateTime? | Server (D3) | Yes | UTC | Detail | EXISTING_CANONICAL |
| Order | travelerDataCompletedAt | DateTime? | Server (D3) | Yes | UTC | Detail | EXISTING_CANONICAL |
| Order | finalConfirmedAt | DateTime? | Server (D3) | Yes | UTC | Detail | EXISTING_CANONICAL |
| Order | serviceDate | DateTime? | Frozen from OrderRequested | Yes | Date-only | Detail, export | EXISTING_CANONICAL |
| Order | serviceTime | String? | Frozen from OrderRequested | Yes | Local "HH:mm" | Detail | EXISTING_CANONICAL |
| Order | serviceEndTime | String? | Frozen from OrderRequested | Yes | Local "HH:mm" | Detail | EXISTING_CANONICAL |
| Order | serviceTimeZone | String? | Frozen from Catalog (D2.8A) | Yes | IANA | Detail | EXISTING_CANONICAL |
| OrderItem | serviceDate | DateTime? | Frozen from OrderRequested | Yes | Date-only | — | EXISTING_CANONICAL |
| OrderHistory | createdAt | DateTime | Server (default now()) | Yes | UTC | Audit history | EXISTING_CANONICAL |

## 4.3 Booking Domain (booking.*)

| Entity | Field | Type | Writer | Immutable? | Timezone | UI usage | D8 status |
|---|---|---|---|---|---|---|---|
| Booking | createdAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | List date, sort, KPI filter | EXISTING_CANONICAL |
| Booking | updatedAt | DateTime | Server (@updatedAt) | No | UTC | — | EXISTING_CANONICAL |
| Booking | serviceDate | DateTime? | Frozen from Order (D2.8A) | Yes | Date-only | List (upcoming/overdue detector), detail | EXISTING_CANONICAL |
| Booking | serviceTime | String? | Frozen from Order (D2.8A) | Yes | Local "HH:mm" | Detail | EXISTING_CANONICAL |
| Booking | serviceEndTime | String? | Frozen from Order (D2.8A) | Yes | Local "HH:mm" | Detail | EXISTING_CANONICAL |
| Booking | serviceTimeZone | String? | Frozen from Catalog (D2.8A) | Yes | IANA | Detail | EXISTING_CANONICAL |
| Booking | serviceStartsAt | DateTime? | Derived UTC (D2.8A) | Yes | UTC | Detail | EXISTING_CANONICAL |
| Booking | serviceEndsAt | DateTime? | Derived UTC (D2.8A) | Yes | UTC | Detail | EXISTING_CANONICAL |
| Booking | serviceTimeType | Enum | Frozen from Order (D2.8A) | Yes | — | Detail | EXISTING_CANONICAL |
| Booking | requestedAt | DateTime? | Server (D2.9A) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Booking | confirmedAt | DateTime? | Server (D2.9A) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Booking | rejectedAt | DateTime? | Server (D2.9A) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Booking | cancelledAt | DateTime? | Server (D2.9A) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Booking | completedAt | DateTime? | Server (D2.9A) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| BookingHistory | createdAt | DateTime | Server (default now()) | Yes | UTC | Audit history | EXISTING_CANONICAL |
| SupplierConfirmation | receivedAt | DateTime | Server (default now()) | Yes | UTC | Detail | EXISTING_CANONICAL |

## 4.4 Payment/Refund Domain (finance.*)

| Entity | Field | Type | Writer | Immutable? | Timezone | UI usage | D8 status |
|---|---|---|---|---|---|---|---|
| Payment | createdAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | List date, sort, KPI filter | EXISTING_CANONICAL |
| Payment | updatedAt | DateTime | Server (@updatedAt) | No | UTC | — | EXISTING_CANONICAL |
| Payment | paidAt | DateTime? | Server (D2.12) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Payment | failedAt | DateTime? | Server (D2.12) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Payment | cancelledAt | DateTime? | Server (D2.12) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Refund | createdAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | List date, sort | EXISTING_CANONICAL |
| Refund | updatedAt | DateTime | Server (@updatedAt) | No | UTC | — | EXISTING_CANONICAL |
| Refund | requestedAt | DateTime? | Server (D2.13) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Refund | approvedAt | DateTime? | Server (D2.13) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Refund | processedAt | DateTime? | Server (D2.13) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Refund | failedAt | DateTime? | Server (D2.13) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Dispute | createdAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | List date | EXISTING_CANONICAL |
| Dispute | openedAt | DateTime? | Server (D2.13A) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Dispute | resolvedAt | DateTime? | Server (D2.13A) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Dispute | cancelledAt | DateTime? | Server (D2.13A) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| LedgerTransaction | occurredAt | DateTime? | Server (D2.10C) | Yes | UTC | Finance | EXISTING_CANONICAL |
| LedgerTransaction | createdAt | DateTime | Server (default now()) | No | UTC | — | EXISTING_CANONICAL |
| PaymentHistory | createdAt | DateTime | Server (default now()) | Yes | UTC | Audit history | EXISTING_CANONICAL |
| RefundHistory | createdAt | DateTime | Server (default now()) | Yes | UTC | Audit history | EXISTING_CANONICAL |

## 4.5 Catalog Domain (catalog.*)

| Entity | Field | Type | Writer | Immutable? | Timezone | UI usage | D8 status |
|---|---|---|---|---|---|---|---|
| Product | publishedAt | DateTime? | Server (publish transition) | Yes | UTC | Public display | EXISTING_CANONICAL |
| Product | createdAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | — | EXISTING_CANONICAL |
| Product | updatedAt | DateTime | Server (@updatedAt) | No | UTC | — | EXISTING_CANONICAL |
| Product | serviceTimeZone | String? | Seller (Catalog authority) | No (mutable in DRAFT) | IANA | Booking time model | EXISTING_CANONICAL |
| Category | createdAt | DateTime? | Server | No | UTC | — | EXISTING_CANONICAL |
| Category | updatedAt | DateTime? | Server (@updatedAt) | No | UTC | — | EXISTING_CANONICAL |
| CategorySchema | activatedAt | DateTime? | Server (lifecycle) | Yes | UTC | — | EXISTING_CANONICAL |
| CategorySchema | deprecatedAt | DateTime? | Server (lifecycle) | Yes | UTC | — | EXISTING_CANONICAL |
| CommercialPeriod | startDate | DateTime | Server | No | Date-only UTC | Catalog pricing | EXISTING_CANONICAL |
| CommercialPeriod | endDate | DateTime | Server | No | Date-only UTC | Catalog pricing | EXISTING_CANONICAL |
| CommercialRestriction | startDate | DateTime? | Server | No | Date-only UTC | Catalog restrictions | EXISTING_CANONICAL |
| CommercialRestriction | endDate | DateTime? | Server | No | Date-only UTC | Catalog restrictions | EXISTING_CANONICAL |
| Availability | date | DateTime | Server | No | Date-only UTC | Availability | EXISTING_CANONICAL |
| AvailabilityReservation | date | DateTime | Server | No | Date-only UTC | Reservation | EXISTING_CANONICAL |
| AvailabilityReservation | createdAt | DateTime | Server (default now()) | No | UTC | — | EXISTING_CANONICAL |
| AvailabilityReservation | releasedAt | DateTime? | Server | Yes | UTC | — | EXISTING_CANONICAL |
| StorefrontBehavioralEvent | occurredAt | DateTime | Client (UTC) | Yes | UTC (client) | Analytics | EXISTING_CANONICAL |
| StorefrontBehavioralEvent | receivedAt | DateTime | Server (default now()) | Yes | UTC | — | EXISTING_CANONICAL |
| MarketplaceBehavioralEvent | occurredAt | DateTime | Client (UTC) | Yes | UTC (client) | Analytics | EXISTING_CANONICAL |
| MarketplaceBehavioralEvent | receivedAt | DateTime | Server (default now()) | Yes | UTC | — | EXISTING_CANONICAL |

## 4.6 CRM/Communication Domain

| Entity | Field | Type | Writer | Immutable? | Timezone | UI usage | D8 status |
|---|---|---|---|---|---|---|---|
| Customer | createdAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | CRM 360 | EXISTING_CANONICAL |
| Customer | updatedAt | DateTime | Server (@updatedAt) | No | UTC | — | EXISTING_CANONICAL |
| PartnerCustomerRelation | createdAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | CRM 360 | EXISTING_CANONICAL |
| PartnerCustomerRelation | updatedAt | DateTime | Server (@updatedAt) | No | UTC | — | EXISTING_CANONICAL |
| OperationalNote | createdAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | Detail timeline | EXISTING_CANONICAL |
| OperationalNote | updatedAt | DateTime | Server (@updatedAt) | No | UTC | — | EXISTING_CANONICAL |
| OperationalNote | editedAt | DateTime? | Server | Yes | UTC | Detail timeline | EXISTING_CANONICAL |
| OperationalNote | deletedAt | DateTime? | Server | Yes | UTC | Soft delete | EXISTING_CANONICAL |
| CrmActivity | occurredAt | DateTime | Server (derived from source) | Yes | UTC | CRM 360 timeline | EXISTING_CANONICAL |
| CrmActivity | projectedAt | DateTime | Server (default now()) | Yes | UTC | — | EXISTING_CANONICAL |
| Communication | occurredAt | DateTime | Server (default now()) | Yes | UTC | Communication thread | EXISTING_CANONICAL |
| Communication | createdAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | — | EXISTING_CANONICAL |
| Communication | updatedAt | DateTime | Server (@updatedAt) | No | UTC | — | EXISTING_CANONICAL |
| AuditLog | createdAt | DateTime | Server (default now()) | Yes | UTC | Security audit | EXISTING_CANONICAL |

## 4.7 Sales Domain (sales.*)

| Entity | Field | Type | Writer | Immutable? | Timezone | UI usage | D8 status |
|---|---|---|---|---|---|---|---|
| Quote | issuedAt | DateTime? | Server (ISSUE transition) | Yes | UTC | Sales detail | EXISTING_CANONICAL |
| Quote | validUntil | DateTime? | Server | No | UTC | Sales detail | EXISTING_CANONICAL |
| Quote | createdAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | — | EXISTING_CANONICAL |
| QuoteItem | serviceDate | DateTime? | Frozen at ISSUE | Yes | Date-only UTC | Sales detail | EXISTING_CANONICAL |
| Sale | completedAt | DateTime? | Server (completion) | Yes | UTC | Sales detail | EXISTING_CANONICAL |
| Sale | serviceDate | DateTime? | Frozen from CheckoutIntent | Yes | Date-only | Sales detail | EXISTING_CANONICAL |
| Sale | createdAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | — | EXISTING_CANONICAL |
| CheckoutIntent | serviceDate | DateTime? | Server | No | Date-only UTC | Checkout | EXISTING_CANONICAL |
| CheckoutIntent | createdAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | — | EXISTING_CANONICAL |
| CheckoutIntent | cancelledAt | DateTime? | Server | Yes | UTC | — | EXISTING_CANONICAL |

## 4.8 Reverse Domain (reverse.*)

| Entity | Field | Type | Writer | Immutable? | Timezone | UI usage | D8 status |
|---|---|---|---|---|---|---|---|
| BuyerRequest | serviceDateFrom | DateTime? | Client | No | Date-only UTC | Reverse detail | EXISTING_CANONICAL |
| BuyerRequest | serviceDateTo | DateTime? | Client | No | Date-only UTC | Reverse detail | EXISTING_CANONICAL |
| BuyerRequest | submittedAt | DateTime? | Server (lifecycle) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| BuyerRequest | cancelledAt | DateTime? | Server (lifecycle) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| BuyerRequest | createdAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | — | EXISTING_CANONICAL |
| BuyerRequestDistribution | distributedAt | DateTime | Server (default now()) | Yes | UTC | — | EXISTING_CANONICAL |
| SellerProposal | submittedAt | DateTime? | Server (lifecycle) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| SellerProposal | withdrawnAt | DateTime? | Server (lifecycle) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| SellerProposal | selectedAt | DateTime? | Server (selection) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| SellerProposal | convertedAt | DateTime? | Server (conversion) | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| SellerProposal | validUntil | DateTime? | Client | No | Date-only UTC | Detail | EXISTING_CANONICAL |

## 4.9 Support Domain (support.*)

| Entity | Field | Type | Writer | Immutable? | Timezone | UI usage | D8 status |
|---|---|---|---|---|---|---|---|
| Case | slaDeadline | DateTime? | Server | No | UTC | Detail SLA | EXISTING_CANONICAL |
| Case | escalatedAt | DateTime? | Server | Yes | UTC | Detail | EXISTING_CANONICAL |
| Case | createdAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | List date | EXISTING_CANONICAL |
| Case | updatedAt | DateTime | Server (@updatedAt) | No | UTC | — | EXISTING_CANONICAL |
| Case | resolvedAt | DateTime? | Server | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Case | closedAt | DateTime? | Server | Yes | UTC | Detail milestone | EXISTING_CANONICAL |
| Case | deletedAt | DateTime? | Server | Yes | UTC | Soft delete | EXISTING_CANONICAL |
| CaseComment | createdAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | Detail timeline | EXISTING_CANONICAL |
| CaseComment | updatedAt | DateTime | Server (@updatedAt) | No | UTC | — | EXISTING_CANONICAL |
| CaseComment | editedAt | DateTime? | Server | Yes | UTC | Detail timeline | EXISTING_CANONICAL |
| CaseComment | deletedAt | DateTime? | Server | Yes | UTC | Soft delete | EXISTING_CANONICAL |
| CaseHistory | createdAt | DateTime | Server (default now()) | Yes | UTC | Audit history | EXISTING_CANONICAL |

## 4.10 Marketing Domain (marketing.*)

| Entity | Field | Type | Writer | Immutable? | Timezone | UI usage | D8 status |
|---|---|---|---|---|---|---|---|
| Campaign | startAt | DateTime? | Server | No | UTC | Campaign list | EXISTING_CANONICAL |
| Campaign | endAt | DateTime? | Server | No | UTC | Campaign list | EXISTING_CANONICAL |
| Campaign | createdAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | — | EXISTING_CANONICAL |
| Campaign | updatedAt | DateTime | Server (@updatedAt) | No | UTC | — | EXISTING_CANONICAL |
| CampaignAttribution | attributedAt | DateTime | Server (default now()) | Yes | UTC | Attribution | EXISTING_CANONICAL |

## 4.11 Decision/Command Center Domain

| Entity | Field | Type | Writer | Immutable? | Timezone | UI usage | D8 status |
|---|---|---|---|---|---|---|---|
| DecisionSignal | firstDetectedAt | DateTime | Server (default now()) | Yes | UTC | Command Center | EXISTING_CANONICAL |
| DecisionSignal | lastDetectedAt | DateTime | Server (default now()) | No (@updatedAt) | UTC | Command Center | EXISTING_CANONICAL |
| DecisionSignal | acknowledgedAt | DateTime? | Server | Yes | UTC | Command Center | EXISTING_CANONICAL |
| DecisionSignal | resolvedAt | DateTime? | Server | Yes | UTC | Command Center | EXISTING_CANONICAL |
| DecisionSignal | dismissedAt | DateTime? | Server | Yes | UTC | Command Center | EXISTING_CANONICAL |

---

# 5. Existing Contracts (Frozen from D1–D7)

## 5.1 Order Temporal Milestones (Step 2.5A) — FROZEN ✅

```text
Order.submittedAt    — request entered system (OrderRequested consumer)
Order.confirmedAt    — confirm → READY_FOR_BOOKING
Order.cancelledAt    — cancel → CANCELLED
Order.fulfilledAt    — complete/reconcile → FULFILLED
Order.closedAt       — close → CLOSED
```

All server-owned, immutable, atomic with CAS transition (status+version+milestone+history+outbox). NULL = legacy (no backfill).

## 5.2 Booking Service Date / Time Model (Step 2.8A) — FROZEN ✅

```text
Booking.serviceDate       — date-only (UTC midnight, NOT time-slot)
Booking.serviceTime       — local wall-clock "HH:mm" (TIME_SLOT only)
Booking.serviceEndTime    — optional local end "HH:mm"
Booking.serviceTimeZone   — IANA zone (frozen authority from Catalog)
Booking.serviceStartsAt   — derived UTC: serviceDate + serviceTime in serviceTimeZone
Booking.serviceEndsAt     — derived UTC: serviceEndTime on start date
Booking.serviceTimeType   — DATE_ONLY | TIME_SLOT | DATE_RANGE (reserved) | OPEN_DATE
```

Authority chain: `Product.serviceTimeZone → frozen in CheckoutIntent → propagated to Order → frozen in Booking`. No alternative timezone authority permitted.

## 5.3 Booking Lifecycle Milestones (Step 2.9A) — FROZEN ✅

```text
Booking.requestedAt   — sent to supplier (SENT_TO_SUPPLIER)
Booking.confirmedAt   — confirmed
Booking.rejectedAt    — supplier rejected
Booking.cancelledAt   — cancelled
Booking.completedAt   — completed
```

Same contract as Order milestones: server-owned, immutable, atomic with CAS.

## 5.4 Finance Temporal Contract (Step 2.10C) — FROZEN ✅

```text
Payment.paidAt        — PENDING → CAPTURED (manual/provider-neutral)
Payment.failedAt      — PENDING → FAILED
Payment.cancelledAt   — PENDING → CANCELLED

Refund.requestedAt    — creation milestone
Refund.approvedAt     — APPROVED transition
Refund.processedAt    — PROCESSED transition
Refund.failedAt       — FAILED transition

Dispute.openedAt      — OPENED creation
Dispute.resolvedAt    — RESOLVED transition
Dispute.cancelledAt   — CANCELLED transition

LedgerTransaction.occurredAt — business occurrence time (UTC), separate from createdAt
```

## 5.5 Commerce Lifecycle Contract (D1) — FROZEN ✅

Lifecycle status vocabularies per entity are fixed. Temporal milestones are part of the canonical contract.

## 5.6 Traveler Acceptance/Snapshot Timing (D2/D3/D4) — FROZEN ✅

```text
Order.termsAcceptedAt        — moment of terms acceptance
Order.travelerDataCompletedAt — moment all required travelers completed
Order.finalConfirmedAt       — final confirmation before Booking creation
Request.pinnedRequirements   — frozen at customerAccept
```

## 5.7 Order/Booking Detail Temporal Presentation (D5/D6) — FROZEN ✅

Detail pages show lifecycle milestones, audit history, and operational notes with server-authoritative timestamps. Timeline ≠ Audit History distinction enforced.

## 5.8 Payment/Refund Semantics (D7) — FROZEN ✅

Payment lifecycle milestones, Refund milestones, financial presentation in Order/Booking detail pages — all implemented and accepted.

---

# 6. Global Period / Date Filter Audit

## 6.1 Operations Center Header Period (GLOBAL)

```text
Component:     OperationsCenterShell → HeaderPeriodControl
Scope:         GLOBAL — affects KPI + table for active registry
URL params:    ?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
Persistence:   Across tab switches (shared period params)
Authority:     Server-side (dateFrom/dateTo passed to API, server builds Prisma where)
Boundary:      [from, to) — inclusive lower, exclusive upper (gte/lt)
Date field:    createdAt (all registries)
Timezone:      Date-only strings → new Date() → UTC midnight
Default:       No filter (all data)
```

**Findings:**
- ✅ Consistent across Requests, Orders, Bookings, Payments
- ✅ Server-side filtering (no client-side dataset filtering)
- ✅ KPI aggregates use identical scope as table
- ⚠️ No explicit timezone metadata on the period controls (browser locale determines date interpretation)
- ⚠️ `new Date(dateString)` produces UTC midnight — no timezone ambiguity for date-only values

## 6.2 Registry-Specific Filters

### Requests
```text
Filter:    dateFrom/dateTo → createdAt [from, to)
Backend:   request.service.ts: createdAt { gte: new Date(dateFrom), lt: new Date(dateTo) }
KPI:       Uses identical scope (request-kpi-date-scope.spec.ts proven)
Test:      request-kpi-date-scope.spec.ts — 10 tests covering boundary semantics
```

### Orders
```text
Filter:    dateFrom/dateTo → createdAt [from, to)
Backend:   order.service.ts: createdAt { gte: new Date(dateFrom), lt: new Date(dateTo) }
KPI:       Uses overviewWhere (drops status/paymentStatus, keeps period)
Detector:  cancelledWithin → createdAt { gt: cutoff, lte: now }
           paymentFailed → cross-schema Payment query
           pendingRefund → cross-schema Refund query
```

### Bookings
```text
Filter:    dateFrom/dateTo → createdAt [from, to)
Backend:   booking.service.ts: createdAt { gte: new Date(dateFrom), lt: new Date(dateTo) }
KPI:       Uses overviewBookingWhere (drops status, keeps period + detectors)
Detector:  upcoming → serviceDate { gte: now } (DIFFERENT field from period!)
           overdue → createdAt { lt: threshold } (same field as period)
```

**⚠️ FINDING B-01:** Bookings `upcoming` detector filters on `serviceDate` while the period filter uses `createdAt`. This is architecturally correct (upcoming = service in future; period = creation time) but the semantic difference is not documented in the D8 contract.

### Payments
```text
Filter:    dateFrom/dateTo → createdAt [from, to)
Backend:   payments-registry.ts: createdAt { gte: input.dateFrom, lt: input.dateTo }
Validation: payments-registry.spec.ts — invalid date throws ValidationDomainError
```

## 6.3 Command Center Period

```text
Component:     PeriodSelector
Presets:       DAY, WEEK, MONTH, QUARTER, YEAR
URL param:     ?preset=MONTH
Authority:     Server-side (preset → date range calculation)
Usage:         Dashboard KPI, trend widgets, section grid
```

**⚠️ FINDING B-02:** Command Center uses preset-based period (DAY/WEEK/MONTH/QUARTER/YEAR) while Operations Center uses free-form dateFrom/dateTo. These are different period control paradigms serving different purposes (dashboard overview vs operational registry). Not a conflict, but not documented as distinct temporal presentation layers.

## 6.4 CRM Activity Timeline

```text
Component:     CustomerActivity.tsx, PartnerActivity.tsx
Filter:        dateFrom/dateTo → occurredAt
Authority:     Server-side
Scope:         Entity-specific (customerId/partnerId + period)
```

**⚠️ FINDING B-03:** CRM Activity uses `occurredAt` for period filtering, while Operations Center uses `createdAt`. These are semantically different (activity occurrence time vs entity creation time). Correct behavior, but cross-domain temporal vocabulary divergence.

---

# 7. Request Temporal Audit

| Milestone | Field | Source | Authority | UI Presentation |
|---|---|---|---|---|
| Created | createdAt | Server | Server | List date column |
| Service requested | requestedServiceDate | Client | Client (validated) | Detail |
| Supplier response deadline | supplierResponseDeadline | Server | Server | Detail SLA |
| Supplier responded | supplierRespondedAt | Server | Server | Detail |
| Customer action deadline | customerActionDeadline | Server | Server | Detail SLA |
| Customer accepted | customerAcceptedAt | Server | Server | Detail |
| Converted to Order | convertedAt | Server | Server | Detail |
| Rejected | rejectedAt | Server | Server | Detail |

**Status:** ✅ COMPLETE — all milestones have canonical fields and server authority.

---

# 8. Order Temporal Audit

| Milestone | Field | Source | Authority | UI Presentation |
|---|---|---|---|---|
| Created | createdAt | Server | Server | List date, sort, KPI filter |
| Submitted | submittedAt | Server (D2.5A) | Server | Detail milestone |
| Confirmed | confirmedAt | Server (D2.5A) | Server | Detail milestone |
| Cancelled | cancelledAt | Server (D2.5A) | Server | Detail, list (cancelledWithin) |
| Fulfilled | fulfilledAt | Server (D2.5A) | Server | Detail milestone |
| Closed | closedAt | Server (D2.5A) | Server | Detail milestone |
| Terms accepted | termsAcceptedAt | Server (D3) | Server | Detail |
| Traveler data done | travelerDataCompletedAt | Server (D3) | Server | Detail |
| Final confirmed | finalConfirmedAt | Server (D3) | Server | Detail |
| Service date | serviceDate | Frozen (OrderRequested) | Frozen | Detail, export |
| Service time | serviceTime | Frozen (OrderRequested) | Frozen | Detail |
| Service timezone | serviceTimeZone | Frozen (Catalog) | Frozen | Detail |

**Status:** ✅ COMPLETE — rich temporal model with 5 lifecycle milestones + 3 D3 milestones + service occurrence.

---

# 9. Booking Temporal Audit

| Milestone | Field | Source | Authority | UI Presentation |
|---|---|---|---|---|
| Created | createdAt | Server | Server | List date, sort, KPI filter |
| Requested | requestedAt | Server (D2.9A) | Server | Detail milestone |
| Confirmed | confirmedAt | Server (D2.9A) | Server | Detail milestone |
| Rejected | rejectedAt | Server (D2.9A) | Server | Detail milestone |
| Cancelled | cancelledAt | Server (D2.9A) | Server | Detail milestone |
| Completed | completedAt | Server (D2.9A) | Server | Detail milestone |
| Service date | serviceDate | Frozen (Order) | Frozen | List (upcoming/overdue), detail |
| Service time | serviceTime | Frozen (Order) | Frozen | Detail |
| Service timezone | serviceTimeZone | Frozen (Catalog) | Frozen | Detail |
| Service starts (UTC) | serviceStartsAt | Derived (D2.8A) | Derived | Detail |
| Service ends (UTC) | serviceEndsAt | Derived (D2.8A) | Derived | Detail |

**Status:** ✅ COMPLETE — richest temporal model in the system.

---

# 10. Payment/Refund Temporal Audit

| Milestone | Field | Source | Authority | UI Presentation |
|---|---|---|---|---|
| **Payment** | | | | |
| Created | createdAt | Server | Server | List date, sort, KPI filter |
| Paid/Captured | paidAt | Server (D2.12) | Server | Detail milestone |
| Failed | failedAt | Server (D2.12) | Server | Detail milestone |
| Cancelled | cancelledAt | Server (D2.12) | Server | Detail milestone |
| **Refund** | | | | |
| Created | createdAt | Server | Server | List date, sort |
| Requested | requestedAt | Server (D2.13) | Server | Detail milestone |
| Approved | approvedAt | Server (D2.13) | Server | Detail milestone |
| Processed | processedAt | Server (D2.13) | Server | Detail milestone |
| Failed | failedAt | Server (D2.13) | Server | Detail milestone |
| **Dispute** | | | | |
| Created | createdAt | Server | Server | List date |
| Opened | openedAt | Server (D2.13A) | Server | Detail milestone |
| Resolved | resolvedAt | Server (D2.13A) | Server | Detail milestone |
| Cancelled | cancelledAt | Server (D2.13A) | Server | Detail milestone |

**Status:** ✅ COMPLETE — all lifecycle milestones implemented.

---

# 11. Finance Temporal Audit

| Entity | Temporal Field | Meaning | Status |
|---|---|---|---|
| LedgerTransaction | occurredAt | Business occurrence time (UTC) | ✅ Frozen (D2.10C) |
| LedgerTransaction | createdAt | Persistence time | ✅ |
| ProviderFee | createdAt | Persistence time | ✅ |
| Settlement | createdAt | Persistence time | ✅ |
| Payout | createdAt | Persistence time | ✅ |
| Commission | createdAt | Persistence time | ✅ |
| CommissionAccrual | accruedAt | Recognition time (Order creation) | ✅ |
| CommissionPolicy | effectiveFrom | Policy effective start | ✅ |
| CommissionPolicy | effectiveTo | Policy effective end (nullable = open) | ✅ |
| Currency | createdAt | Master data | ✅ |
| ExchangeRate | validFrom/validTo | Rate validity window | ✅ |
| Tax | createdAt | Master data | ✅ |
| TaxRule | effectiveFrom/effectiveTo | Rule validity window | ✅ |
| Invoice | createdAt | Master data | ✅ |

**Status:** ✅ COMPLETE — finance temporal foundation is solid.

---

# 12. CRM/Support/Marketing/Analytics Audit

## 12.1 CRM Activity Timeline
- `CrmActivity.occurredAt` — canonical business timestamp from source domain
- `CrmActivity.projectedAt` — server projection time
- Indexed: `(customerId, occurredAt, id)`, `(partnerId, occurredAt, id)`, `(activityType, occurredAt)`
- **Status:** ✅ COMPLETE

## 12.2 Support Cases
- `Case.slaDeadline` — SLA deadline (server-owned)
- `Case.escalatedAt` — escalation milestone
- `Case.resolvedAt/closedAt` — terminal milestones
- `CaseHistory.createdAt` — append-only audit
- **Status:** ✅ COMPLETE

## 12.3 Marketing
- `Campaign.startAt/endAt` — campaign period
- `CampaignAttribution.attributedAt` — attribution time
- **Status:** ✅ COMPLETE

## 12.4 Command Center / Decision Intelligence
- `DecisionSignal.firstDetectedAt/lastDetectedAt` — detection timeline
- `DecisionSignal.acknowledgedAt/resolvedAt/dismissedAt` — lifecycle milestones
- **Status:** ✅ COMPLETE

---

# 13. Timezone/DST Audit

## 13.1 UTC Storage
- ✅ All `DateTime` fields stored as PostgreSQL `TIMESTAMP(3)` with Prisma
- ✅ Serialization: `toISOString()` (Z suffix)
- ✅ No raw timezone conversion in SQL

## 13.2 IANA Timezone Authority
- ✅ `Product.serviceTimeZone` — canonical IANA zone (Catalog authority)
- ✅ Frozen at CheckoutIntent binding → Order → Booking (no re-resolution)
- ✅ NULL = date-only service / zone unknown (honest, no guessing)
- ✅ No alternative timezone authority created

## 13.3 Date-Only Semantics
- ✅ `serviceDate` — date-only (UTC midnight), NOT time-slot
- ✅ `Availability.date` — date-only UTC midnight
- ✅ `CommercialPeriod.startDate/endDate` — date-only inclusive range
- ✅ `CommercialRestriction.startDate/endDate` — date-only
- ✅ `BuyerRequest.serviceDateFrom/To` — date-only UTC midnight

## 13.4 Frontend Timezone Handling
- ✅ `new Date(isoString).toLocaleDateString(LOCALE_TAGS[locale])` — UTC → locale display
- ✅ No `new Date()` for business date semantics (only for display formatting)
- ✅ No browser timezone used for business date authority
- ✅ No client-side date filtering on full datasets

## 13.5 DST Considerations
- ⚠️ **FINDING B-04:** `serviceTime` is local wall-clock "HH:mm" in `serviceTimeZone`. DST transitions could make a local time ambiguous or nonexistent. The schema stores `serviceStartsAt` (derived UTC) which handles this correctly at the Booking level, but the `serviceTime` string itself is not DST-aware. This is acceptable for display but should be documented.

## 13.6 Cross-Midnight Service
- ⚠️ **FINDING B-05:** `serviceEndsAt` derivation: "derived UTC end instant: serviceEndTime on the start date (or next day if end <= start)". This cross-midnight logic exists in `booking.subscribers.ts` but is not documented as a canonical D8 contract.

---

# 14. Backend Authority Audit

## 14.1 Date Filter Pipeline (All Registries)

```text
Frontend request (dateFrom/dateTo URL params)
    ↓
Controller (DTO validation: @IsString)
    ↓
Service (new Date(dateFrom) / new Date(dateTo))
    ↓
Prisma where: createdAt { gte: Date, lt: Date }
    ↓
PostgreSQL TIMESTAMP(3) comparison
```

**Findings:**
- ✅ Server-side authority — no client-side dataset filtering
- ✅ Consistent half-open [from, to) boundary across all registries
- ⚠️ **FINDING B-06:** Invalid dates (e.g., "not-a-date") produce `Invalid Date` in Prisma where clause. Request KPI date scope test (T7/T8) documents this but doesn't throw. Payments registry (`payments-registry.spec.ts`) throws `ValidationDomainError`. **Inconsistent validation across domains.**
- ⚠️ **FINDING B-07:** `new Date("2026-09-01")` produces `2026-09-01T00:00:00.000Z` (UTC midnight). If a user in UTC+4 selects dateFrom="2026-09-01", they expect to see records from 04:00 UTC onwards, but the filter starts at 00:00 UTC. This is the correct behavior for date-only filters (no timezone conversion), but should be documented as the canonical D8 contract.

## 14.2 Detector Predicates

| Detector | Domain | Temporal Field | Predicate | Correctness |
|---|---|---|---|---|
| cancelledWithin | Orders | createdAt | `gt: cutoff, lte: now` | ✅ Correct |
| paymentFailed | Orders | Payment.status | Cross-schema query | ✅ Correct |
| pendingRefund | Orders | Refund.status | Cross-schema query | ✅ Correct |
| upcoming | Bookings | serviceDate | `gte: now` | ✅ Correct (service in future) |
| overdue | Bookings | createdAt | `lt: threshold` | ✅ Correct (created long ago) |

---

# 15. Frontend Authority Audit

## 15.1 Date Display

```text
Pattern:  new Date(isoString).toLocaleDateString(LOCALE_TAGS[locale])
Used in:  Orders, Bookings, Payments, CRM Activity, Support
Locale:   RU/AZ/EN via BCP-47 tags
Timezone: UTC (from ISO string) → locale display
```

- ✅ No `new Date()` for business date determination
- ✅ No browser timezone used for business logic
- ✅ No client-side date filtering on full datasets
- ✅ No locale-based date conversion for business semantics

## 15.2 Period Controls

| Surface | Control Type | Authority | URL State |
|---|---|---|---|
| Operations Center Header | dateFrom/dateTo inputs | Server | ✅ ?dateFrom=&dateTo= |
| Command Center | PeriodSelector presets | Server | ✅ ?preset=MONTH |
| CRM Activity | dateFrom/dateTo inputs | Server | ✅ Local state + API |
| Customer/Partner 360 | dateFrom/dateTo inputs | Server | ✅ Local state + API |

- ✅ All period controls are server-authoritative
- ✅ URL state persisted for reload/Back-Forward
- ✅ No client-side dataset filtering

## 15.3 Formatting

- ✅ `fmtDate()` — locale-aware date display (RU/AZ/EN)
- ✅ `fmtMoney()` — locale-aware money display
- ⚠️ **FINDING B-08:** `fmtDate()` is defined locally in each page component (Orders, Bookings, Payments) — not a shared component. D8 should consider a shared `TemporalDisplay` component.

---

# 16. Export Audit

## 16.1 Orders Export
```text
Endpoint:    /api/v1/orders/export
Columns:     createdAt, updatedAt, paidAt (among others)
Filters:     Same as list (dateFrom/dateTo, status, paymentStatus, search)
Authority:   Server-side (same query as list)
Format:      CSV/XLSX
```

## 16.2 Bookings Export
```text
Endpoint:    /api/v1/bookings/export
Columns:     createdAt, serviceDate (among others)
Filters:     Same as list (dateFrom/dateTo, status, search)
Authority:   Server-side
Format:      CSV/XLSX
```

## 16.3 Payments Export
```text
Endpoint:    /api/v1/payments/export
Filters:     Same as list (dateFrom/dateTo, status)
Authority:   Server-side
Format:      CSV/XLSX
```

- ✅ All exports use server-side filtering with identical temporal scope as UI
- ✅ No client-side export with local timezone issues
- ⚠️ **FINDING B-09:** Exports include `createdAt` (UTC) but not `serviceDate` in Orders export columns. Bookings export includes `serviceDate`. Inconsistent temporal field coverage across exports.

---

# 17. Security/Tenant Audit

- ✅ Temporal filters do not bypass entity authorization (RBAC + partner scope)
- ✅ Cross-tenant temporal leakage prevented by existing RBAC (C17: 1560/1560)
- ✅ Date filters are additive predicates, not authorization bypass vectors
- ✅ Export endpoints require same permissions as list endpoints
- ✅ No IDOR via date filters (entity ID is primary filter, date is secondary)

---

# 18. Performance/Query Audit

| Area | Status | Notes |
|---|---|---|
| Indexes on createdAt | ✅ | Present on key entities (AuditLog, OrderHistory, etc.) |
| Indexes on serviceDate | ✅ | Booking composite indexes for upcoming/overdue |
| Range queries | ✅ | Prisma generates efficient TIMESTAMP range predicates |
| Sorting by DateTime | ✅ | Default sort is createdAt desc |
| KPI aggregates | ✅ | Use same where clause as table (no separate query path) |
| N+1 | ✅ | No N+1 temporal queries detected |
| Full-table scans | ⚠️ | Payment/Refund cross-schema queries (paymentFailed/pendingRefund) use raw SQL with DISTINCT — acceptable for current scale |

---

# 19. Test/Evidence Audit

| Test | What it proves | D8 relevance |
|---|---|---|
| `request-kpi-date-scope.spec.ts` | KPI date scope matches list boundary semantics [from, to) | HIGH — proves temporal filter consistency |
| `booking-kpi-scope.spec.ts` | Booking KPI strips status but preserves temporal predicates | HIGH — proves detector+period coexistence |
| `order-kpi-scope.spec.ts` | Order KPI strips status/paymentStatus, preserves period | HIGH — proves temporal filter consistency |
| `payments-registry.spec.ts` | Payment registry validates date inputs, throws on invalid | HIGH — proves validation contract |
| `request-sort.spec.ts` | Request sorting with dateFrom/dateTo | MEDIUM — proves period+sort coexistence |
| `booking-kpi-scope.spec.ts` (detector) | upcoming/overdue predicates preserved in overview | HIGH — proves detector temporal semantics |
| `request-kpi-date-scope.spec.ts` T7/T8 | Invalid dates produce Invalid Date (no throw) | MEDIUM — documents validation gap |

---

# 20. Gap Matrix

| ID | Finding | Domain | Evidence | Severity | D8? | Dependency | Recommended disposition |
|---|---|---|---|---|---|---|---|
| B-01 | Bookings `upcoming` uses `serviceDate` while period uses `createdAt` — semantic difference undocumented | Booking | booking.service.ts L250 | P3 | YES | None | Document as canonical D8 contract |
| B-02 | Command Center uses preset-based period while Operations Center uses free-form dateFrom/dateTo — different paradigms undocumented | Cross-domain | OperationsCenterShell.tsx, PeriodSelector.tsx | P3 | YES | None | Document as distinct temporal presentation layers |
| B-03 | CRM Activity uses `occurredAt` for period filtering while Operations Center uses `createdAt` — cross-domain vocabulary divergence | CRM | CustomerActivity.tsx L50 | P3 | YES | None | Document as intentional domain difference |
| B-04 | `serviceTime` (local "HH:mm") not DST-aware; `serviceStartsAt` (derived UTC) handles DST correctly | Booking | booking.subscribers.ts | P3 | YES | None | Document DST handling contract |
| B-05 | Cross-midnight `serviceEndsAt` derivation logic undocumented | Booking | booking.subscribers.ts | P3 | YES | None | Document derivation contract |
| B-06 | Invalid date validation inconsistent: Payments throws ValidationDomainError, Requests/Orders/Bookings produce Invalid Date silently | Cross-domain | payments-registry.spec.ts vs request-kpi-date-scope.spec.ts T7/T8 | P2 | YES | None | Standardize validation across all registries |
| B-07 | Date-only filter starts at UTC midnight, not user's local midnight — behavior correct but undocumented | Cross-domain | order.service.ts L840 | P3 | YES | None | Document as canonical D8 contract |
| B-08 | `fmtDate()` defined locally per page, not shared | Frontend | orders/page.tsx, bookings/page.tsx | P3 | YES | None | Consider shared TemporalDisplay component |
| B-09 | Orders export lacks `serviceDate` column; Bookings export has it | Export | order.controller.ts export columns | P3 | YES | None | Add serviceDate to Orders export |
| B-10 | No shared temporal display component across UI surfaces | Frontend | Multiple pages | P3 | YES | None | Create shared TemporalDisplay for D8 |
| B-11 | No documentation of which temporal field is "primary date" for each registry sort | Cross-domain | order.service.ts, booking.service.ts | P3 | YES | None | Document primary temporal dimension per entity |

---

# 21. Debt Reconciliation

| Debt ID | Current status | D8 relevance | Blocking? | Owner stage | Evidence |
|---|---|---|---|---|---|
| SEC-UI-01 | CLOSED | Low | No | C6 | Closed |
| SEC-TENANT-01 | OPEN P2 | Low | No | LATER | D8 read-only, no tenant changes |
| UI-01..UI-06 | OPEN (stale) | Low | No | Absorbed | Content closed by C1.1/C2 |
| UI-07 | OPEN P2 | Medium | No | Absorbed | KPI rebuilt in C1.2C/G |
| UI-08 | OPEN P2 | Medium | No | Absorbed | Booking KPI finalized |
| DATA-01 | OPEN P2 | Medium | No | D11 | KPI read-model consistency |
| FIN-01..03 | DEFERRED | Low | No | LATER | Finance Center deferred |
| PROD-01 | OPEN | Low | No | LATER | Product model deferred |
| PERF-01/02 | OPEN | Low | No | 2.17B | Performance gate deferred |

**No blocking debts for D8.**

---

# 22. D8 MUST/SHOULD/OUT-OF-SCOPE

## MUST (Hard gates for D8)

1. **Document the Global Temporal Vocabulary** — canonical mapping of which temporal field means what for each entity, as a project-wide contract (not just per-domain documentation)
2. **Standardize invalid date validation** — all registries should throw ValidationDomainError for malformed dateFrom/dateTo (currently Payments does, others don't)
3. **Document the primary temporal dimension per entity** — which field is the "primary date" for sorting/display in each registry (createdAt for Operations, serviceDate for Bookings upcoming/overdue, occurredAt for CRM Activity)
4. **Document cross-domain temporal vocabulary differences** — explicitly classify intentional domain differences (createdAt vs serviceDate vs occurredAt) vs accidental divergence
5. **Document the Operations Center Header Period contract** — GLOBAL scope, affects KPI+table, [from, to) boundary, date-only UTC midnight semantics, no timezone conversion

## SHOULD (Useful but not blocking)

1. **Shared TemporalDisplay component** — extract fmtDate() into a shared component with locale-aware formatting, tooltip for full UTC timestamp, and consistent empty state
2. **Add serviceDate to Orders export** — for consistency with Bookings export
3. **Document detector temporal semantics** — upcoming uses serviceDate, overdue uses createdAt, cancelledWithin uses createdAt — all correct but should be explicitly documented
4. **Document DST handling contract** — serviceTime is local wall-clock, serviceStartsAt is derived UTC, cross-midnight derivation logic

## OUT OF SCOPE (Must not enter D8)

1. **D9 Export Framework Requalification** — separate stage
2. **D10 Partner Performance Attribution** — separate stage
3. **D11 Project-Wide KPI/Status Semantics** — separate stage
4. **D12 CRM/KPI Drill-down Routing** — separate stage
5. **D13 Voucher** — separate stage
6. **D14 PRE-STEP 3.12 Final Requalification** — separate stage
7. **Finance Center temporal milestones** (authorizedAt/capturedAt for PSP) — deferred with Finance
8. **Schema/migration changes** — D8 is visibility/contract, not schema
9. **New temporal fields** — all necessary fields already exist
10. **Timezone authority changes** — Product.serviceTimeZone frozen contract unchanged

## DEFERRED (Belongs to later stages)

1. **Full KPI read-model temporal consistency** — D11 (Project-Wide KPI/Status Semantics)
2. **Export temporal field standardization** — D9 (Export Framework)
3. **CRM temporal drill-down** — D12 (CRM/KPI Drill-down)
4. **Finance PSP temporal milestones** — Finance Center track
5. **Period comparison (this period vs last period)** — D11

---

# 23. Dependencies

```text
D7 completed ─────┐
D8 current ───────┼──► D8 implementation
D0 closed ────────┘

No blocking dependencies:
- D7: ACCEPTED (VERDICT A)
- D0: CLOSED
- C-track: CLOSED (C18)
- RBAC: 1560/1560 MATCH (C17)
- Schema: no changes required for D8
- Finance: deferred, no dependency
```

---

# 24. Stop Conditions

Checked and **none triggered:**

1. ❌ No competing timezone authority found
2. ❌ No frontend-owned business temporal authority found
3. ❌ No cross-tenant temporal leakage found
4. ❌ No temporal filter bypassing authorization found
5. ❌ No mutation of frozen temporal facts found
6. ❌ No conflicting canonical lifecycle milestone found
7. ❌ No undocumented alternate temporal contract found
8. ❌ No schema change required beyond D8 scope
9. ❌ No dependency on unfinished architecture decision
10. ❌ No need to change D9/D10/D11/D12/D13/D14 contracts

---

# 25. Final Verdict

```text
D8 AUDIT-FIRST
VERDICT: B — AUDIT READY WITH BLOCKERS

Baseline SHA: HEAD (origin/master)
Final SHA: HEAD (no production changes)

Temporal contracts audited: 11 domains, 158+ DateTime fields
Domains audited: Request, Order, Booking, Payment, Refund, Dispute, Ledger,
                 CRM, Communication, Marketing, Support, Decision, Sales, Reverse, Catalog
Global period surfaces audited: 4 Operations registries + Command Center + CRM Activity
Timezone/DST checks: UTC storage ✅, IANA authority ✅, date-only semantics ✅, DST ⚠️ (documented)
Security checks: RBAC ✅, tenant scope ✅, no IDOR via dates ✅
Performance checks: Indexes ✅, range queries ✅, no N+1 ✅
Tests/evidence reviewed: 7 temporal-related test files

P0: 0
P1: 0
P2: 1 (B-06: inconsistent invalid date validation)
P3: 10 (B-01 through B-05, B-07 through B-11)

D8 MUST: 5 items (vocabulary doc, validation standardization, primary dimension docs, cross-domain diff docs, period contract docs)
D8 SHOULD: 4 items (shared component, export consistency, detector docs, DST docs)
D8 OUT OF SCOPE: 10 items (D9-D14, Finance, schema changes, new fields, timezone changes)
D8 DEFERRED: 5 items (KPI consistency, export standardization, CRM drill-down, PSP milestones, period comparison)

Blocking dependencies: NONE
Recommended next step: Create D8 implementation prompt with MUST items as hard gates

GIT:
HEAD == origin/master: YES
Tracked clean: YES
Production changes: NONE
```

---

# 26. Recommended Next Implementation Prompt Scope

The D8 implementation prompt should cover:

1. **Global Temporal Vocabulary Document** — canonical project-wide contract mapping temporal fields to business meanings across all entities
2. **Invalid Date Validation Standardization** — add ValidationDomainError to Orders/Bookings/Requests dateFrom/dateTo parsing (matching Payments pattern)
3. **Primary Temporal Dimension Documentation** — explicit mapping of which field is primary sort/display date per entity
4. **Cross-Domain Temporal Difference Documentation** — explicit classification of intentional vs accidental vocabulary divergence
5. **Operations Center Period Contract Documentation** — formal contract for GLOBAL scope, boundary semantics, timezone handling
6. **Shared TemporalDisplay Component** (SHOULD) — extract fmtDate() into shared component
7. **Export Temporal Field Consistency** (SHOULD) — add serviceDate to Orders export

**The implementation prompt MUST NOT:**
- Create new temporal fields
- Modify schema/migrations
- Change frozen temporal contracts (D2.5A, D2.8A, D2.9A, D2.10C)
- Override the canonical Master Plan v3
- Touch D9/D10/D11/D12/D13/D14 scope
- Create new roadmap stages
- Modify Finance Center
- Modify RBAC/permissions

---

*Generated with Codebuff 🤖*
*Co-Authored-By: Codebuff <noreply@codebuff.com>*
