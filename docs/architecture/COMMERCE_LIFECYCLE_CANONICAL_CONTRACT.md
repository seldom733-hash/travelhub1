# COMMERCE LIFECYCLE CANONICAL CONTRACT — TravelHub

**Статус:** D1 — Commerce Lifecycle Contract Finalization
**Дата:** 2026-09-02
**Scope:** Окончательная заморозка единого canonical lifecycle contract для всех commerce flows TravelHub.

---

# 1. Purpose / Scope

D1 определяет **один canonical lifecycle contract** для:

```
Product / Service
        ↓
[Request where required]
        ↓
Supplier response
        ↓
Customer acceptance
        ↓
[Traveler collection where required]
        ↓
Final customer confirmation
        ↓
[Request conversion]
        ↓
Order
        ↓
Booking
        ↓
Payment / Pay Later
        ↓
[Voucher]
        ↓
Service
        ↓
Completion / Cancellation / Refund
```

D1 — **architecture/contract closure only**. Никакой implementation.

---

# 2. Domain Terms

| Term | Definition |
|---|---|
| **Customer** | Покупатель / заказчик. Субъект, инициирующий коммерческую транзакцию. |
| **Payer** | Фактическое лицо/сторона, осуществляющая платёж. V1: `Order.customerId`. |
| **Traveler** | Лицо, реально получающее/использующее забронированную услугу. Технически = `Passenger`. |
| **Supplier** | Поставщик услуги / Partner. |
| **Request** | Pre-order validation / availability / current commercial terms workflow. |
| **Order** | Customer-committed commercial transaction. Frozen commercial snapshot. |
| **Booking** | Fulfillment entity for Order. 1 Order = 1 Booking (V1). |
| **Payment** | Financial transaction against Order. |
| **Refund** | Reversal of Payment. |
| **Traveler Requirements** | Seller-defined set of traveler fields required by Product/Service. |
| **Snapshot** | Immutable historical copy of requirements/data at a specific lifecycle moment. |
| **Commerce Sequence** | Shared 8-digit root for all entities in one commerce chain. |

---

# 3. Canonical Non-Authoritative Flow (Supplier Confirmation Required)

```
Customer selects Product/Service
  → date / options / traveler count / categories
  → [Забронировать]
  ↓
Request created (REQ-*)
  → displayed price snapshot (price customer saw at submission)
  → service date, quantity
  ↓
Supplier validates availability / current price / terms
  ↓
Supplier responds:
  ├── CONFIRMED → current terms = displayed terms
  ├── PRICE_CHANGED → new price/terms presented to customer
  ├── UNAVAILABLE → terminal, no Order
  ├── REJECTED → terminal, no Order
  └── TIMEOUT → terminal (SLA expired), no Order
  ↓
Customer sees confirmed / changed terms
  ↓
Customer explicitly accepts current terms
  (termsAcceptedAt / customerDecision = ACCEPTED)
  ↓
Traveler Data Collection (where required by Product)
  → seller-defined required fields validated
  → requirements pinned/snapshotted at acceptance moment
  ↓
Final customer confirmation
  (finalConfirmedAt)
  ↓
Request conversion → Order created
  (convertedAt = Order.createdAt)
  ↓
Booking created (via BookingRequested event)
  ↓
Payment or Pay Later (according to PaymentScheme policy)
  ↓
Voucher where applicable
  ↓
Service delivery
  ↓
Completion / Cancellation / Refund
```

### Temporal ordering (successful non-authoritative flow):

```
Request.createdAt
≤ supplierRespondedAt
≤ termsAcceptedAt (customerDecision = ACCEPTED)
≤ finalConfirmedAt (if traveler collection required)
≤ convertedAt ≈ Order.createdAt
≤ Booking.createdAt
≤ Payment.createdAt (if payment follows)
≤ paidAt (if applicable)
≤ serviceDate
≤ completedAt (if applicable)
```

---

# 4. Canonical Authoritative Real-Time Flow

Для services с authoritative current terms (без availability uncertainty):

```
Customer selects Product/Service
  → authoritative current availability / price / terms
  → date / options / traveler count / categories
  ↓
[Optional: minimal traveler count/categories — NO full traveler data yet]
  ↓
Traveler Data Collection (where required by Product)
  → seller-defined required fields validated
  → requirements pinned/snapshotted
  ↓
Final customer confirmation
  ↓
Order created
  ↓
Booking created (via BookingRequested event)
  ↓
Payment or Pay Later
  ↓
Voucher where applicable
  ↓
Service delivery
  ↓
Completion / Cancellation / Refund
```

**Request отсутствует** — нет supplier confirmation workflow.

### Temporal ordering (successful authoritative flow):

```
Order.createdAt
≤ Booking.createdAt
≤ Payment.createdAt (if payment follows)
≤ paidAt
≤ serviceDate
≤ completedAt
```

---

# 5. Request State Semantics

## 5.1 What is Request?

Request — это workflow **pre-order validation / availability / current commercial terms** для non-authoritative commerce.

**Request ≠ Order.** Request — pre-order entity. Order — committed commercial transaction.

## 5.2 When required / when optional?

| Scenario | Request? |
|---|---|
| Supplier availability/price uncertain | REQUIRED |
| Authoritative real-time terms | OPTIONAL (skipped) |
| Marketplace product with fixed pricing | OPTIONAL (skipped) |
| Custom/tailored service requiring supplier confirmation | REQUIRED |

## 5.3 Request snapshot

Request хранит:
- `displayedPrice` / `displayedCurrency` — price customer saw at submission
- `confirmedPrice` / `confirmedCurrency` — supplier-confirmed price (after response)
- `requestedServiceDate`, `quantity`
- `supplierResponseDeadline` (SLA)
- `customerActionDeadline` (TTL)
- `supplierDecision`, `supplierNote`, `supplierPriceProposal`
- `customerDecision`
- `convertedOrderId`, `convertedAt`

## 5.4 RequestStatus enum (canonical mapping)

```
NEW                     → Request just created
CHECKING                → Awaiting supplier response
SUPPLIER_TIMEOUT        → Supplier SLA expired (terminal)
PRICE_CHANGED           → Supplier changed price/terms (non-terminal)
CUSTOMER_ACCEPTED       → Customer accepted current terms
CONFIRMED               → (reserved / alias)
CONVERTED               → Request linked to Order (terminal for Request)
REJECTED                → Supplier rejected (terminal)
UNAVAILABLE             → Supplier unavailable (terminal)
EXPIRED                 → Customer TTL expired (terminal)
CUSTOMER_PAYMENT_TIMEOUT → Customer didn't pay in time (terminal)
CANCELLED_BY_CUSTOMER   → Customer cancelled (terminal)
```

---

# 6. Supplier Response Contract

## 6.1 Canonical supplier outcomes

| Outcome | Enum | Customer action | Order allowed? | Terminal? | Timestamp |
|---|---|---|---|---|---|
| Confirmed | CONFIRMED | Accept/decline | After acceptance | No | `supplierRespondedAt` |
| Price changed | PRICE_CHANGED | Accept new terms/decline | After acceptance | No | `supplierRespondedAt` |
| Unavailable | UNAVAILABLE | None | No | Yes | `supplierRespondedAt` |
| Rejected | REJECTED | None | No | Yes | `supplierRespondedAt` |
| Timeout | SUPPLIER_TIMEOUT | None | No | Yes | SLA deadline crossed |

## 6.2 Hard business rules

```
Supplier CONFIRMED ≠ automatic final Booking
Price/terms changed → explicit customer acceptance required
```

---

# 7. Price / Terms Change

Hard business rule:

```
Supplier changes price/terms
  → TravelHub presents changed terms to customer
  → explicit Customer acceptance required
```

Запрещено:

```
changed price
  → automatic Order at higher/new price
```

**Authoritative commercial snapshot после acceptance:**

```
confirmedPrice / confirmedCurrency
```

Если price не изменился:

```
confirmedPrice = displayedPrice
```

---

# 8. Customer Acceptance — Two Separate Events

D1 фиксирует два отдельных business events:

### A. Terms Acceptance

```
Customer accepts supplier-confirmed / current commercial terms
  → termsAcceptedAt
  → customerDecision = ACCEPTED
```

Это **не** final confirmation. Это acceptance of current price/terms/availability.

### B. Final Confirmation

```
Customer confirms completed booking after traveler data entry (if required)
  → finalConfirmedAt
```

Это **commitment** к:
- current accepted price / currency
- service / date / options
- traveler set
- required traveler data completeness
- cancellation / terms where applicable

После final confirmation система может создавать Order.

**Если traveler collection не требуется:**

```
termsAcceptedAt = finalConfirmedAt (combined event)
```

**Если traveler collection требуется:**

```
termsAcceptedAt < finalConfirmedAt (separate events)
```

---

# 9. Traveler Collection Point — HARD FREEZE

```
Supplier confirms current availability/price
  → Customer accepts current terms
  → Traveler Data Collection (where required)
  → required fields validated
  → Final customer confirmation
  → Order creation
```

### Hard principle:

```
не заставлять Customer вводить полный паспортный/персональный набор
до подтверждения доступности и актуальных условий поставщиком
```

### During Request stage (before supplier confirmation):

Достаточно:
- traveler count
- adult / child / infant categories
- minimal Customer identity / contact
- service / date / options

### After supplier confirmation + customer acceptance:

Полные requested traveler fields собираются.

---

# 10. Traveler Requirements — Pin/Snapshot Point

## 10.1 Problem

```
Customer начал traveler form
  → Seller изменил Product requirements
  → что происходит?
```

Нельзя динамически менять форму / обязательные поля посреди подтверждённого checkout.

## 10.2 Canonical snapshot point

```
Product Traveler Requirements (current at acceptance moment)
  → PINNED / SNAPSHOTTED when customer accepts terms (termsAcceptedAt)
  → used during traveler collection
  → copied into OrderTraveler snapshot (at Order creation)
  → copied into Passenger snapshot (at Booking creation)
```

## 10.3 Snapshot owner

```
CheckoutIntent / Request хранит snapshotted requirements
  → OrderTraveler snapshot
  → Booking Passenger snapshot
```

Snapshot = immutable historical copy. Изменение Product завтра не меняет требования исторической Booking.

---

# 11. Final Confirmation — Exact Semantics

Final confirmation = commitment к:

```
- current accepted price / currency
- service / date / options
- cancellation / terms where applicable
- traveler set
- required traveler data completeness
```

После final confirmation:
- Order может быть создан
- commercial snapshot frozen
- Request может быть converted

---

# 12. Request Conversion — Critical Contract

## 12.1 When does Request become CONVERTED?

**Canonical event:**

```
Request CONVERTED = successful Order creation and linking
= Order successfully created AND convertedOrderId set on Request
```

Not earlier. Not later.

## 12.2 Conversion sequence

```
Final customer confirmation
  → Order creation (OrderRequested → OrderRequestedConsumer → Order)
  → Request.convertToOrder(orderId)
  → convertedAt = Order.createdAt (or conversion transaction timestamp)
```

## 12.3 Hard invariant

```
Request CONVERTED
  ↔ Order EXISTS and linked via convertedOrderId
  ↔ convertedAt IS NOT NULL
```

---

# 13. convertedAt Semantics

Hard:

```
convertedAt ≠ updatedAt
```

**Definition:**

```
convertedAt = timestamp when Request was successfully linked to a created Order
```

**Temporal ordering:**

```
convertedAt ≥ finalConfirmedAt
convertedAt ≈ Order.createdAt (within same transaction/event flow)
```

---

# 14. Order Creation Contract

## 14.1 What is Order?

```
Order = customer-committed commercial transaction
  → frozen commercial snapshot (amount, currency, payment terms)
  → OrderItems (product snapshot)
  → OrderTraveler (traveler snapshot — minimal at creation)
  → Fulfillment status
  → History / audit trail
```

## 14.2 Can Order exist before required traveler completion?

**No.** Order creation requires:
- required traveler data complete (if applicable)
- final customer confirmation

## 14.3 Can Order exist before final confirmation?

**No.** Final confirmation is prerequisite for Order creation.

## 14.4 Draft Order concept?

**No separate Draft Order.** The existing Order lifecycle (NEW → SUBMITTED → ...) serves this purpose. Order is created only when committed.

## 14.5 Price/terms snapshot on Order

```
Order.amount = frozen from accepted commercial snapshot
Order.currency = frozen from accepted commercial snapshot
Order paymentTerms = frozen from Checkout/Sale snapshot
```

Immutable after creation. No reprice from Catalog.

---

# 15. OrderTraveler Role

## 15.1 Purpose

```
OrderTraveler = immutable commercial snapshot of traveler data at Order creation
```

## 15.2 Data flow

```
CheckoutIntentTraveler (firstName, lastName, birthDate)
  → final confirmation
  → OrderTraveler snapshot (+ citizenship, gender, passport if collected)
  → Booking Passenger
```

## 15.3 Why not four independent sources?

Single canonical source chain:

```
CheckoutIntentTraveler (minimal, at checkout)
  → OrderTraveler (snapshot at Order creation, frozen)
  → Passenger (snapshot at Booking creation, frozen)
```

Each snapshot is immutable. Downstream reads from snapshot, not from upstream mutable entity.

---

# 16. Booking Creation Contract

## 16.1 Cardinality

```
1 Order = 1 Booking (V1)
```

## 16.2 Creation sequence

```
Order created → OrderReadyForBooking event
  → OrderLifecycleService → BookingRequested event
  → BookingRequestedConsumer → Booking created
```

## 16.3 Can Booking creation fail?

Yes. BookingRequestedConsumer can fail (inbox dedup, DB constraints). Failure → event retry → eventually succeeds or poison.

## 16.4 What does Booking mean before payment?

```
Booking = fulfillment entity
  → supplier processing / confirmation
  → service delivery
  ≠ Paid
```

## 16.5 Pay Later supported?

Yes. `PaymentScheme.PAY_LATER` and `PAY_AT_SERVICE` exist.

---

# 17. Passenger Ownership

## 17.1 Canonical fulfillment source

```
Booking → 1..N Passengers (= Travelers)
```

## 17.2 Transfer

```
OrderTraveler → Passenger (snapshot at Booking creation)
```

## 17.3 Voucher source

```
Voucher travelers = Booking travelers
≠ Customer automatically
```

---

# 18. Payment Relationship

## 18.1 Payment ≠ prerequisite for Booking existence

```
Booking created → UNPAID / PARTIALLY_PAID / PAID as separate financial dimension
```

## 18.2 Payment schemes

```
FULL_PREPAYMENT    → full amount before service
PARTIAL_PREPAYMENT → partial amount before service
DEPOSIT            → deposit before service
PAY_LATER          → full amount after service / at checkout
PAY_AT_SERVICE     → full amount at service delivery
```

## 18.3 Hard invariants

```
Booking Status ≠ Payment Status
Order Status ≠ Payment Status
Refund Status ≠ Payment Status
```

---

# 19. Cancellation / Refund Branches

```
Request cancellation/expiry before Order
  → Request status = CANCELLED / EXPIRED / SUPPLIER_TIMEOUT / UNAVAILABLE / REJECTED
  → No Order created

Order cancellation
  → Order status = CANCELLED
  → Booking cancellation compensation (if Booking exists)

Booking cancellation/rejection
  → Booking status = CANCELLED / SUPPLIER_REJECTED
  → Order feedback (reconcile)

Payment refund
  → Refund ≤ paid amount
  → Refund.currency = Payment.currency
  → Refund.createdAt ≥ Payment.createdAt
```

---

# 20. TTL / Deadlines

## 20.1 Three separate deadlines

| Deadline | Owner | Purpose |
|---|---|---|
| Supplier Response SLA | `supplierResponseDeadline` | Supplier must respond within this window |
| Customer Action TTL | `customerActionDeadline` | Customer must accept/decline within this window |
| Traveler-entry window | (future: `travelerEntryDeadline`) | Customer must complete traveler data within this window |

## 20.2 TTL during traveler entry

Current: `customerActionDeadline` covers terms acceptance only.

Traveler-entry TTL: **DEFERRED** to D2-D4 implementation. Architecture allows separate deadline.

## 20.3 Hard rule

```
TTL expired before final confirmation
  → no silent Order creation from stale terms
  → Request status = EXPIRED or CUSTOMER_PAYMENT_TIMEOUT
```

---

# 21. Temporal Invariants

## 21.1 Non-authoritative successful flow

```
Request.createdAt
≤ supplierRespondedAt
≤ termsAcceptedAt (if customerDecision = ACCEPTED)
≤ finalConfirmedAt (if traveler collection required)
≤ convertedAt ≈ Order.createdAt
≤ Booking.createdAt
≤ Payment.createdAt (if payment follows)
≤ paidAt (if applicable)
≤ serviceDate
≤ completedAt (if applicable)
```

## 21.2 Non-applicable timestamps

```
— / null
```

## 21.3 Hard rule

```
updatedAt ≠ business-event timestamp
```

---

# 22. Customer / Payer / Traveler — Final Semantics

```
Customer = buyer / orderer / CRM customer
Payer = actual paying party
Traveler = service recipient / participant
```

Roles may coincide, but semantic entities are NOT equal by default.

**V1:** Payer representation simplified to `Order.customerId`.

**Architecture must preserve future ability:**

```
Payer ≠ Customer
```

**Hard invariant:**

```
Traveler ≠ automatically CRM Customer
```

---

# 23. Marketplace / Storefront Boundary

```
Marketplace customer commerce
  → Platform Marketplace operational scope

Storefront customer commerce
  → Partner / Storefront Workspace
  → NOT Platform Marketplace commerce

Storefront subscription / direct SaaS payment to TravelHub
  → Platform SaaS economics
```

**Hard invariant:**

```
Storefront Commerce Volume ≠ Marketplace GMV ≠ TravelHub Revenue
```

---

# 24. Current Implementation Gaps

| Area | Status | Debt ID |
|---|---|---|
| Request → Order automated pipeline | Manual/seed linking only | D1 (contract only) |
| Traveler requirements on Product | Not implemented | D2 |
| Traveler collection in checkout | Minimal (firstName/lastName/birthDate only) | D3 |
| OrderTraveler population | 0 records | D3 |
| Passenger population | 0 records | D3-D4 |
| Requirements snapshot/pinning | Not implemented | D2 |
| Final confirmation (separate from terms acceptance) | Not implemented | D3 |
| Order Detail page | Not implemented | D5 |
| Booking Detail page | Not implemented | D6 |
| Payment/Refund UI semantics | Partial | D7 |
| Global temporal visibility | Partial | D8 |
| Export full requalification | Pending | D9 |
| CRM SFC scope regression | Discovered | D1A |

---

# 25. Deferred Decisions

| Decision | Rationale | Stage |
|---|---|---|
| Automated Request → Order pipeline | Manual linking acceptable for V1 | D1 (deferred) |
| Separate Payer entity | V1 simplification, no immediate business need | Deferred |
| Traveler-entry TTL separate from customer TTL | Architecture allows; implementation deferred | D2-D4 |
| Voucher generation / versioning | Depends on Booking Passenger population | D13 |
| Finance Center | Separate track | Future |
| Product Freshness | Separate track | Future |

---

# 26. Downstream D2-D14 Implications

| D-stage | Depends on D1 decisions |
|---|---|
| D1A | CRM scope isolation (no lifecycle dependency) |
| D2 | Traveler requirements pin/snapshot point (§10) |
| D3 | Traveler collection point (§9), final confirmation (§11), OrderTraveler role (§15) |
| D4 | Passenger ownership (§17), security |
| D5 | Order creation contract (§14) |
| D6 | Booking creation contract (§16), Passenger (§17) |
| D7 | Payment relationship (§18), refund branches (§19) |
| D8 | Temporal invariants (§21) |
| D9 | Export with all lifecycle fields |
| D10 | Partner Performance attribution |
| D11 | Booking KPI semantics |
| D12 | CRM/KPI routing |
| D13 | Voucher source (§17.3) |
| D14 | Final requalification against this contract |
