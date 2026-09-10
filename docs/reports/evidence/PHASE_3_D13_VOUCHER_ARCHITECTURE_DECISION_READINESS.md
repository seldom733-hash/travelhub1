# PHASE 3 — D13 — VOUCHER
## ARCHITECTURE DECISION & IMPLEMENTATION READINESS REPORT

**Document Type:** Architecture Decision Record / Readiness Gate  
**Stage:** Phase 3 — D13  
**Scope:** Voucher + Partial Payment Document  
**Mode:** DECISION / READINESS ONLY — NO PRODUCTION IMPLEMENTATION  
**Date:** 2026-09-10

---

## 1. Executive Decision Summary

D13 (Voucher) is a greenfield implementation. The agreed business model introduces two platform documents: a **Partial Payment Document** (payment state communication) and a **TravelHub Voucher** (full-payment confirmation). The Seller Partner retains responsibility for service-specific documents (airline tickets, hotel vouchers, etc.).

All 20 architecture decisions (AD-D13-02 through AD-D13-21) are resolved below. One conflict from the prior scope audit is explicitly corrected: the PII access table incorrectly granted full PII visibility to DIRECTOR/FINANCE/ANALYST/SALES_MANAGER; the source-of-truth code (`canViewTravelerPii()`) restricts full PII to OPERATOR and ADMIN only.

**Final Verdict: READY WITH EXPLICIT GAPS**

---

## 2. Verified Repository Evidence

### 2.1 Git State

| Item | Value | Evidence |
|------|-------|----------|
| HEAD | `40e2f5b` | `git log --oneline -3` |
| D12 closed | ✅ | Commit `40e2f5b` "docs(D12): CRM KPI drill-down routing requalification" |
| Working tree | Clean (D12 artifacts only) | `git status` |
| D4 dependency | ✅ CLOSED | `D4_STRICT_REVIEW_REMEDIATION_CLOSURE_REPORT.md` exists |
| D13 scope audit prompt | EXISTS | `docs/prompts/PHASE_3_D13_VOUCHER_SCOPE_AUDIT.md` (1307 lines) |

### 2.2 Documents Domain Ownership

**Canonical:** Documents owns Voucher. Confirmed in:
- `TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md:192-195` — "Voucher ← Booking → Passengers (not Customer/Order)"
- `COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md:619-624` — "Voucher travelers = Booking travelers ≠ Customer automatically"
- `TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md:398` — "Voucher source: ❌ CANONICAL + NOT YET IMPLEMENTED"

### 2.3 Canonical Voucher Source

**Source:** `Booking → Passengers` (NOT Customer, NOT Order.customer, NOT Payer)

Evidence:
- `TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md:192-195` — §6.4 Voucher Source
- `TRAVELER_DATA_REQUIREMENTS_BOOKING_PARTICIPANTS_ARCHITECTURE.md:481-520` — §13 Voucher Source
- `COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md:619-624` — §17.3 Voucher source

### 2.4 Canonical Booking/Payment Lifecycle Position

```
Booking → Payment / Pay Later → [Voucher] → Service → Completion
```

Voucher is **optional** between Payment and Service. Source: `COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md:33-38`

### 2.5 Existing Booking Confirmation Event

`BookingConfirmed` emitted at `booking.service.ts:535-547`. Payload: `{ bookingId, code, orderId, productId }`. Trigger: `confirm` action from `SENT_TO_SUPPLIER` or `AWAITING_CONFIRMATION`. **No payment check required for confirmation.**

### 2.6 Existing Payment Status/Events

| Event | Emission Point | Effect on Order |
|-------|---------------|-----------------|
| `PaymentCreated` | `payment.service.ts:177` | None (initiation only) |
| `PaymentCaptured` | `payment.service.ts:244` → `319` | `paymentStatus → PAID`, `paidAmount → amount` |
| `PaymentFailed` | `payment.service.ts:249` → `319` | None (Order stays UNPAID) |
| `PaymentCancelled` | `payment.service.ts:254` → `319` | None (Order stays UNPAID) |

**"Fully paid" means:** `Order.paymentStatus === "PAID"` AND `Order.paidAmount >= Order.amount`

### 2.7 Existing Passenger/Traveler Completeness

`booking.subscribers.ts:97`:
```typescript
const readyTravelers = order.travelers.filter((t) => t.dataCompleteness === "COMPLETE");
```

Only travelers with `dataCompleteness === "COMPLETE"` are promoted to Passenger.

### 2.8 Existing RBAC Permissions

| Permission | Roles | Enforced? |
|-----------|-------|-----------|
| `documents.read` | ADMIN, DIRECTOR, FINANCE, ANALYST, SALES_MANAGER, OPERATOR | ❌ No endpoint |
| `documents.write` | ADMIN, OPERATOR | ❌ No endpoint |
| `account.document.read_own` | BUYER | ✅ `GET /account/documents` |

### 2.9 `canViewTravelerPii()` Semantics

```typescript
// pii.ts:21-22
export function canViewTravelerPii(role: RoleCode): boolean {
  return role === RoleCode.OPERATOR || role === RoleCode.ADMIN;
}
```

**Only OPERATOR and ADMIN see full PII.** All other roles receive redacted projection (`passportNumber: null`, `passportExpiry: null`, `birthDate: null`). Confirmed by `pii.spec.ts:17-36`.

### 2.10 Existing Document/Template/Storage/PDF Infrastructure

| Capability | Status |
|-----------|--------|
| Document module | ❌ Does not exist |
| Template engine | ❌ Not installed |
| PDF library | ❌ None installed |
| Object storage | ✅ S3/MinIO via `ObjectStorageService` interface |
| Export service | ✅ `ExportService` (CSV/XLSX via ExcelJS) |
| Frontend documents page | ✅ Placeholder (`/account/documents`) |
| Backend documents endpoint | ✅ Controlled empty (`GET /account/documents`) |

### 2.11 Event Inbox/Idempotency Pattern

Dual-layer pattern in `booking.subscribers.ts`:
1. `EventBusService.isProcessed()` — fast pre-transaction check
2. `InboxEvent` insert inside `$transaction` — atomic dedup
3. `@@unique([consumerId, eventId])` — final guard against concurrent delivery

### 2.12 Cancellation/Rejection/Completion Events

| Event | Trigger | Effect |
|-------|---------|--------|
| `BookingCancelled` | `cancel` action OR OrderCancelled compensation | All active bookings → CANCELLED |
| `BookingRejected` | `reject` action from supplier | Booking → SUPPLIER_REJECTED, Order → PROBLEM |
| `BookingCompleted` | `complete` action from IN_SERVICE | Booking → COMPLETED |

---

## 3. Business Model Confirmation

### AD-D13-01 — TravelHub Document Model

**DECISION: AGREED as defined in the gate document.**

| Document | Purpose | When Issued |
|----------|---------|-------------|
| Partial Payment Document | Communicates financial state of partial payment | After each payment state change |
| TravelHub Voucher | Confirms full payment + booking through TravelHub | After full payment + Booking confirmed |
| Seller Partner Document | Official service document (airline ticket, hotel voucher, etc.) | Issued by Seller Partner independently |

**Separation preserved:** TravelHub Voucher does NOT replace Seller Partner documents.

---

## 4. Architecture Decisions

### AD-D13-02 — Voucher Issuance Condition

**DECISION: Dual-gate — BookingConfirmed AND Order.paymentStatus === "PAID"**

| Aspect | Evidence |
|--------|----------|
| Authoritative payment state | `Order.paymentStatus` (projected from `PaymentCaptured` event) |
| Authoritative booking state | `Booking.status` (lifecycle state machine) |
| Event ordering | `PaymentCaptured` and `BookingConfirmed` are **independent, orthogonal events** |
| Both conditions required | Yes — Voucher generation subscribes to BOTH events |
| Retry handling | `InboxEvent` idempotency pattern (existing) |
| Booking confirmed before payment | No voucher generated; voucher waits for `PaymentCaptured` |
| Payment completes after confirmation | Voucher generated when both conditions satisfied |

**Critical architectural fact:** `bookingAction("confirm")` has **NO payment check** (`booking.service.ts:455-528`). A Booking can be CONFIRMED while Order is `paymentStatus: "UNPAID"`. The Voucher generation consumer must independently verify both conditions.

**Event flow:**
```
BookingConfirmed → VoucherConsumer checks Order.paymentStatus
PaymentCaptured  → VoucherConsumer checks Booking.status

Both must be true → Generate Voucher
```

**Implementation:** New `VoucherConsumer` subscribes to BOTH `BookingConfirmed` and `PaymentCaptured`. On each event:
1. Fetch Order (for paymentStatus)
2. Fetch Booking (for status)
3. If `Booking.status === CONFIRMED` AND `Order.paymentStatus === "PAID"` → generate Voucher
4. If not yet both conditions → no-op (will be triggered by the other event)

---

### AD-D13-03 — Partial Payment Document Issuance

**DECISION: Generated on each payment state change; versioned; replaces previous version**

| Aspect | Decision |
|--------|----------|
| Trigger | `PaymentCaptured` event (NOT PaymentCreated — only successful payments) |
| Distinguish states | `OrderPaymentStatus`: UNPAID → PARTIALLY_PAID → PAID |
| Generation frequency | One per PaymentCaptured event (new payment = new document) |
| Versioning | Yes — each payment event creates a new version |
| Immutability | Published versions are immutable |
| Replacement | Previous version → SUPERSEDED; current version = latest |
| Retention | All versions retained as immutable historical records |
| Partial payment | `PARTIALLY_PAID` state exists in `OrderPaymentStatus` enum but NOT yet produced (single payment per Order constraint). Reserved for future installment support. |

**Current reality:** Single payment per Order (DB constraint `Payment_one_active_per_order`). The Partial Payment Document is effectively identical to the full payment document until installments are supported. Implementation should design for the general case.

---

### AD-D13-04 — Voucher Lifecycle

**DECISION: 4-state lifecycle**

```
NOT_ISSUED → ISSUED → SUPERSEDED → INVALIDATED
```

| State | Entry Condition | Exit Condition | Downloadable | Meaning |
|-------|----------------|----------------|--------------|---------|
| `NOT_ISSUED` | Booking exists, voucher not generated | Both gates satisfied (BookingConfirmed + PAID) | No | Pending |
| `ISSUED` | Both gates satisfied, voucher generated | New version created OR invalidation triggered | Yes | Active, current document |
| `SUPERSEDED` | New version replaces this one | Never (terminal) | Yes (historical) | Replaced by newer version |
| `INVALIDATED` | Booking cancelled/rejected/voided | Never (terminal) | No | No longer valid |

**Source of truth:** `Booking.status` for cancellation/rejection; `Order.paymentStatus` for payment state.

---

### AD-D13-05 — Versioning and Immutability

**DECISION: Sequential versioning with immutable snapshots**

| Aspect | Decision |
|--------|----------|
| Version numbering | Sequential integers: v1, v2, v3... |
| Immutable published | Yes — once ISSUED, document binary + metadata never mutated |
| Current/superseded | Latest version = current; older versions = SUPERSEDED |
| Replacement | New version created → old version status → SUPERSEDED |
| Invalidation | Status → INVALIDATED; binary retained but not downloadable |
| Audit metadata | Version number, issue timestamp, triggering event, template version |

**Schema:** `DocumentVersion` table with `versionNumber Int`, `status DocumentStatus`, `documentId` FK.

---

### AD-D13-06 — Regeneration / Replacement Triggers

**VERIFIED from current Booking domain:**

| Trigger | Source Event | Old Version → New Version |
|---------|-------------|---------------------------|
| Traveler data correction | `Passenger.updated` (future) | SUPERSEDED → new ISSUED |
| Service date/time change | `Booking.serviceDate` update | SUPERSEDED → new ISSUED |
| Supplier confirmation change | `SupplierConfirmation` event | SUPERSEDED → new ISSUED |
| Passenger count change | `Passenger` add/remove | SUPERSEDED → new ISSUED |

**Not triggers (verified non-existent):**
- No `PassengerUpdated` event exists yet — passenger edits are currently direct DB mutations
- No `BookingServiceDateChanged` event exists

**Implementation note:** Initial version may skip regeneration (V1 = simple issuance). Regeneration logic depends on Passenger edit events which do not yet exist. Document as future debt if needed.

---

### AD-D13-07 — Invalidation Triggers

**VERIFIED from current Booking domain:**

| Trigger | Source Event | Behavior |
|---------|-------------|----------|
| Booking cancellation | `BookingCancelled` | Voucher → INVALIDATED; not downloadable |
| Booking rejection | `BookingRejected` | Voucher → INVALIDATED; not downloadable |
| Manual void | `documents.write` + operator action | Voucher → INVALIDATED; not downloadable |

**Invalidation means:**
- Status change only (to INVALIDATED)
- Immutable invalidated version retained in DB
- No replacement document created
- Download restricted (frontend checks status before rendering)

---

### AD-D13-08 — Idempotency

**DECISION: Reuse existing `InboxEvent` pattern**

| Aspect | Decision |
|--------|----------|
| Idempotency key | `consumerId = "voucher-consumer"` + `eventId` from triggering event |
| Uniqueness boundary | Per-Booking (one active voucher per Booking) |
| Duplicate `BookingConfirmed` | Idempotent — `InboxEvent` prevents re-processing |
| Duplicate `PaymentCaptured` | Idempotent — `InboxEvent` prevents re-processing |
| Transaction boundaries | Voucher creation inside `$transaction` with `InboxEvent` insert |
| Concurrent generation | `InboxEvent` unique constraint prevents race conditions |

**Pattern:** Identical to `booking.subscribers.ts` and `order.subscribers.ts`. No bespoke system needed.

---

### AD-D13-09 — Source-of-Truth Data Contract

**Frozen snapshot at issuance time. Live lookups prohibited.**

| Voucher Field | Source Entity | Snapshot/Live | PII | Required |
|--------------|---------------|---------------|-----|----------|
| `bookingCode` | `Booking.code` | Snapshot | No | Yes |
| `bookingReferenceNumber` | `Booking.referenceNumber` | Snapshot | No | Yes |
| `serviceDate` | `Booking.serviceDate` | Snapshot | No | Yes |
| `serviceTime` | `Booking.serviceTime` | Snapshot | No | No |
| `serviceTimeZone` | `Booking.serviceTimeZone` | Snapshot | No | No |
| `totalAmount` | `Booking.amount` | Snapshot | No | Yes |
| `paidAmount` | `Order.paidAmount` | Snapshot | No | Yes |
| `currency` | `Booking.currency` | Snapshot | No | Yes |
| `paymentStatus` | `Order.paymentStatus` | Snapshot | No | Yes |
| `traveler.firstName` | `Passenger.firstName` | Snapshot | Yes | Yes |
| `traveler.lastName` | `Passenger.lastName` | Snapshot | Yes | Yes |
| `traveler.birthDate` | `Passenger.birthDate` | Snapshot | Yes | No |
| `traveler.citizenship` | `Passenger.citizenship` | Snapshot | No | No |
| `traveler.gender` | `Passenger.gender` | Snapshot | No | No |
| `traveler.passportNumber` | `Passenger.passportNumber` | Snapshot | Yes | No |
| `traveler.passportExpiry` | `Passenger.passportExpiry` | Snapshot | Yes | No |

**Snapshot rule:** All fields copied at voucher generation time. Voucher represents Booking state at issuance, not later live view.

---

### AD-D13-10 — Passenger / Traveler Completeness

**VERIFIED from `booking.subscribers.ts:97`:**

| Aspect | Current Behavior |
|--------|-----------------|
| Completeness gate | `dataCompleteness === "COMPLETE"` |
| Incomplete passengers | Excluded from Passenger creation (never reach Booking) |
| Product-type differences | Defined in `traveler-requirements.ts:94-175` (FLIGHT=passport REQUIRED, etc.) |
| Correction after issuance | No existing Passenger edit events; initial version: no regeneration |

**Voucher generation does NOT need to re-check completeness** — Passengers are already filtered at Booking creation time. Only COMPLETE travelers exist as Passenger records.

---

### AD-D13-11 — Documents Domain Integration

**DECISION: New `documents` module required**

| Aspect | Decision |
|--------|----------|
| Existing infrastructure | None (no Document/Template model, no module) |
| Decision order | #3: Define smallest new abstraction required |
| New module | `backend/src/modules/documents/` |
| New Prisma schema | `Document`, `DocumentVersion`, `DocumentTemplate` models |
| New domain events | `VoucherGenerated`, `VoucherInvalidated` (minimal set) |
| Integration point | `VoucherConsumer` subscribes to `BookingConfirmed` + `PaymentCaptured` |

---

### AD-D13-12 — Rendering / PDF Engine

**DECISION: `@react-pdf/renderer` (React-PDF)**

| Criterion | Evaluation |
|-----------|-----------|
| Selected engine | `@react-pdf/renderer` |
| Why it fits | React component model matches existing frontend stack; generates PDF directly from JSX; no headless browser required |
| Runtime requirements | Node.js (already v20); no Chromium/Puppeteer needed |
| Container requirements | No additional Docker dependencies |
| Operational risks | Low — pure Node.js library, no external processes |
| Testability | JSX components are unit-testable |
| Deployment model | Works in existing non-Dockerized backend |

**Alternatives rejected:**
- **Puppeteer:** Requires Chromium binary; not compatible with current non-Dockerized backend
- **PDFKit:** Low-level API; complex layout management
- **wkhtmltopdf:** External binary dependency; not portable
- **jsPDF:** Client-side only; not suitable for server generation

---

### AD-D13-13 — Template Format

**DECISION: React components as templates**

| Aspect | Decision |
|--------|----------|
| Template format | React JSX components (`.tsx`) |
| Ownership | `backend/src/modules/documents/templates/` |
| Versioning | Git version control (template changes = code changes) |
| Data binding | React props (type-safe via TypeScript) |
| Escaping/sanitization | React's built-in XSS protection + explicit sanitization for user data |
| Styling | `@react-pdf/renderer` StyleSheet (PDF-native) |
| Localization | Template parameters accept localized strings; locale passed as prop |

---

### AD-D13-14 — Storage

**DECISION: S3/MinIO via existing `ObjectStorageService`**

| Aspect | Decision |
|--------|----------|
| Storage backend | S3/MinIO (existing `ObjectStorageService` interface) |
| Metadata/binary separation | Document metadata in PostgreSQL; binary PDF in S3 |
| S3 key pattern | `documents/{documentId}/v{version}.pdf` |
| Retention | Indefinite (immutable historical records) |
| Retrieval | Short-lived signed URLs via `getSignedReadUrl()` (5-minute TTL) |
| Deletion/invalidation | S3 object NOT deleted (retained); status change in DB prevents access |
| Local-dev vs production | Same MinIO instance (already configured in `docker-compose.yml`) |

**Existing infrastructure:** `S3ObjectStorageService` at `catalog/media/storage/s3-storage.service.ts` with `putObject`, `getSignedReadUrl`, `deleteObject`, `objectExists`.

---

### AD-D13-15 — Access Control

**DECISION: Wire existing RBAC permissions; resolve PII conflict**

#### Permission Matrix

| Role | Can view voucher? | Can see full PII? | Permission |
|------|-------------------|-------------------|------------|
| ADMIN | ✅ | ✅ | `documents.read` (ALL_PERMISSIONS) |
| OPERATOR | ✅ | ✅ | `documents.read` + `canViewTravelerPii()` |
| DIRECTOR | ✅ | ❌ Redacted | `documents.read` only |
| FINANCE | ✅ | ❌ Redacted | `documents.read` only |
| ANALYST | ✅ | ❌ Redacted | `documents.read` only |
| SALES_MANAGER | ✅ | ❌ Redacted | `documents.read` only |
| BUYER | ✅ Own-scope | ❌ Own-scope | `account.document.read_own` |
| PARTNER | ❌ | ❌ | No document permission |
| MODERATOR | ❌ | ❌ | No document permission |
| MARKETER | ❌ | ❌ | No document permission |

#### PII Conflict Resolution

**The D13 scope audit table (lines 251-258) showing "Full PII" for DIRECTOR/FINANCE/ANALYST/SALES_MANAGER is INCORRECT.**

**Source-of-truth evidence:**
1. `pii.ts:21-22`: `canViewTravelerPii()` returns `true` ONLY for `OPERATOR || ADMIN`
2. `pii.spec.ts:25`: Test explicitly asserts DIRECTOR, FINANCE, ANALYST, SALES_MANAGER all receive `passportNumber: null`
3. `pii.ts:13-16` comment: "Полные PII видят ТОЛЬКО операционные роли — OPERATOR и ADMIN"
4. D4 strict review report line 110-113: All non-OPERATOR/ADMIN roles listed as "Redacted = ✅"

**Root cause:** The audit table confused `documents.read` (permission to see the document entity) with `canViewTravelerPii()` (permission to see unredacted passport/DOB fields within the document).

**Implementation rule:** Voucher rendering MUST apply `redactTravelerPii()` per viewer role. DIRECTOR/FINANCE/ANALYST/SALES_MANAGER see the voucher but with `passportNumber: null`, `passportExpiry: null`, `birthDate: null`.

---

### AD-D13-16 — Buyer Own-Scope

**Ownership chain:** `BUYER → Customer → Order → Booking → Voucher`

| Aspect | Evidence |
|--------|----------|
| Permission | `account.document.read_own` (permissions.constants.ts:188) |
| Controller | `account.controller.ts:108-113` — `@RequirePermissions("account.document.read_own")` + `assertBuyerActor()` |
| Service | `account.service.ts:276-279` — returns `{items:[], total:0, available:false}` (placeholder) |
| Ownership mapping | `BUYER.userId → Customer.id → Order.customerId → Booking.orderId → Document.bookingId` |
| Access enforcement | Backend queries Documents WHERE `bookingId IN (SELECT id FROM Booking WHERE orderId IN (SELECT id FROM Order WHERE customerId = :customerId))` |

**Do not grant access based solely on document ID existence.** Always resolve ownership chain.

---

### AD-D13-17 — Partner Access

**DECISION: Partner has NO access to TravelHub Voucher**

| Aspect | Evidence |
|--------|----------|
| Permission | PARTNER does NOT receive `documents.read` (permissions.constants.ts:631) |
| Explicit denial | Comment at line 631: "Phase-2 резервные права (sales.sale.read / finance.payment.read / documents.read / support.read) у PARTNER тоже отсутствуют" |
| Buyer Cabinet | PARTNER sees `/partner` layout, not `/account` layout |

**Seller Partner documents (airline tickets, hotel vouchers) are separate from TravelHub Voucher.** Partner access to their own service documents is handled by the Partner-facing flows, not the Documents domain.

---

### AD-D13-18 — Financial Information Boundary

**DECISION: Voucher displays commercial payment information only; no Finance Center**

| Allowed in Voucher | NOT Allowed |
|-------------------|-------------|
| Total service price | General ledger |
| Amount paid | Accounting reconciliation |
| Balance due | Tax accounting |
| Currency | Payout accounting |
| Payment status | Settlement engine |
| Order/Booking identity | Fiscal receipt infrastructure |

**Boundary rule:** Voucher reads `Order.paymentStatus`, `Order.paidAmount`, `Order.amount`, `Order.currency` as frozen snapshot facts. It does NOT create financial records, modify ledger entries, or produce fiscal documents.

---

### AD-D13-19 — Legal / Document Authority Boundary

**DECISION: Voucher is a platform confirmation document, NOT a legal/tax/supplier document**

| Document | Claims to represent |
|----------|-------------------|
| Partial Payment Document | "Payment state of purchase through TravelHub" |
| TravelHub Voucher | "Service purchased/booked through TravelHub, fully paid" |
| NOT an invoice | No tax authority classification |
| NOT a fiscal receipt | No fiscal registrar integration |
| NOT an airline ticket | Seller Partner issues separately |
| NOT a hotel voucher | Seller Partner issues separately |

---

### AD-D13-20 — Auditability

**Immutable audit metadata per document version:**

| Field | Source |
|-------|--------|
| `bookingId` | Which Booking produced the document |
| `versionNumber` | Which document version |
| `issuedAt` | When it was issued (UTC) |
| `triggeringEvent` | Which event/process caused issuance |
| `templateVersion` | Which template version was used |
| `status` | CURRENT / SUPERSEDED / INVALIDATED |
| `actorId` | Who/what initiated (NULL for system, userId for manual) |

---

### AD-D13-21 — Failure and Recovery Model

| Failure | Behavior |
|---------|----------|
| Rendering failure | Voucher NOT marked ISSUED; event NOT consumed; retry on next delivery |
| Storage failure (S3) | Same as rendering failure — transaction rolls back |
| Duplicate event | `InboxEvent` prevents re-processing (idempotent) |
| Missing passenger data | Block generation; no voucher created (data contract violated) |
| Missing payment completion | No voucher generated (dual-gate not satisfied) |
| Booking cancellation during generation | `BookingCancelled` subscriber handles invalidation |
| Concurrent replacement | `InboxEvent` unique constraint prevents race |
| Corrupted/missing binary | Voucher status remains ISSUED but download returns error; manual re-generation operator action |
| Retry after partial transaction | `$transaction` atomicity ensures all-or-nothing |

**Key rule:** Never mark a document ISSUED unless both persistence (S3 + PostgreSQL) and document state are consistent.

---

## 5. Data / Source-of-Truth Matrix

| Data Point | Source of Truth | Live/Snapshot | Location |
|-----------|----------------|---------------|----------|
| Booking status | `booking.Booking.status` | Snapshot at issuance | `booking` schema |
| Payment status | `order.Order.paymentStatus` | Snapshot at issuance | `order` schema |
| Traveler data | `booking.Passenger.*` | Snapshot at issuance | `booking` schema |
| Service date/time | `booking.Booking.serviceDate/Time` | Snapshot at issuance | `booking` schema |
| Amount/currency | `booking.Booking.amount/currency` | Snapshot at issuance | `booking` schema |
| Paid amount | `order.Order.paidAmount` | Snapshot at issuance | `order` schema |
| Document metadata | `document.Document/DocumentVersion` | Mutable (status only) | `documents` schema |
| Document binary | S3/MinIO | Immutable | Object storage |

---

## 6. Lifecycle / State Machine

### 6.1 Document Lifecycle

```
                    ┌──────────────┐
                    │  NOT_ISSUED  │ ← Voucher entity created (gates not met)
                    └──────┬───────┘
                           │
               BookingConfirmed + PAID
                           │
                           ▼
                    ┌──────────────┐
                    │    ISSUED    │ ← Voucher generated, binary stored
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │                         │
     New version needed          Invalidation triggered
              │                         │
              ▼                         ▼
    ┌──────────────┐          ┌──────────────┐
    │  SUPERSEDED  │          │ INVALIDATED  │
    └──────────────┘          └──────────────┘
    (terminal, downloadable)   (terminal, not downloadable)
```

### 6.2 Payment State Machine (existing)

```
PENDING ──→ CAPTURED (paidAt)
PENDING ──→ FAILED (failedAt, isActive=false)
PENDING ──→ CANCELLED (cancelledAt, isActive=false)
```

### 6.3 Order Payment Projection (existing)

```
paymentStatus: UNPAID ──[PaymentCaptured]──→ PAID ──[RefundProcessed full]──→ REFUNDED
paidAmount:       0    ──[PaymentCaptured]──→ amount (frozen, immutable)
```

---

## 7. Versioning Model

```
Document (1:N)
├── DocumentVersion v1 (ISSUED → SUPERSEDED)
├── DocumentVersion v2 (ISSUED → SUPERSEDED)
└── DocumentVersion v3 (ISSUED ← current)
```

- Each version is an immutable PDF binary in S3
- Version metadata in PostgreSQL `DocumentVersion` table
- Only one version per Document has status `ISSUED` at a time
- Previous versions transition to `SUPERSEDED`
- Invalidated versions transition to `INVALIDATED`

---

## 8. Event / Trigger Matrix

| Event | Consumer | Action |
|-------|----------|--------|
| `BookingConfirmed` | `VoucherConsumer` | Check dual-gate; generate if both conditions met |
| `PaymentCaptured` | `VoucherConsumer` | Check dual-gate; generate if both conditions met |
| `BookingCancelled` | `VoucherConsumer` | Invalidate all active vouchers for Booking |
| `BookingRejected` | `VoucherConsumer` | Invalidate all active vouchers for Booking |
| (Passenger edit — future) | `VoucherConsumer` | Regenerate voucher (new version) |

---

## 9. RBAC Matrix

| Role | documents.read | documents.write | account.document.read_own | PII Access |
|------|---------------|-----------------|--------------------------|------------|
| ADMIN | ✅ | ✅ | ❌ | Full |
| OPERATOR | ✅ | ✅ | ❌ | Full |
| DIRECTOR | ✅ | ❌ | ❌ | Redacted |
| FINANCE | ✅ | ❌ | ❌ | Redacted |
| ANALYST | ✅ | ❌ | ❌ | Redacted |
| SALES_MANAGER | ✅ | ❌ | ❌ | Redacted |
| BUYER | ❌ | ❌ | ✅ | Own-scope |
| PARTNER | ❌ | ❌ | ❌ | Denied |
| MODERATOR | ❌ | ❌ | ❌ | Denied |
| MARKETER | ❌ | ❌ | ❌ | Denied |

---

## 10. PII / Security Decision

| Rule | Implementation |
|------|---------------|
| PII fields | `passportNumber`, `passportExpiry`, `birthDate` |
| Full PII access | OPERATOR, ADMIN only (`canViewTravelerPii()`) |
| Redacted access | All other roles: fields → `null` |
| Voucher rendering | Apply `redactTravelerPii()` per viewer role |
| Buyer access | Own-scope only via ownership chain |
| Partner access | Denied |

---

## 11. Rendering / Storage Decision

| Aspect | Decision |
|--------|----------|
| PDF engine | `@react-pdf/renderer` |
| Template format | React JSX components |
| Storage | S3/MinIO via `ObjectStorageService` |
| S3 key | `documents/{documentId}/v{version}.pdf` |
| Retrieval | Short-lived signed URLs (5-min TTL) |
| Metadata | PostgreSQL `Document` + `DocumentVersion` tables |
| Binary retention | Indefinite (immutable) |

---

## 12. Failure / Idempotency Model

| Concern | Solution |
|---------|----------|
| Idempotency | `InboxEvent` pattern (existing) |
| Uniqueness | One active voucher per Booking |
| Atomicity | `$transaction` for DB + S3 operations |
| Retry safety | Idempotent consumer + transactional rollback |
| Race conditions | `InboxEvent` unique constraint |
| Rendering failure | No voucher marked ISSUED; retry on next event delivery |
| Storage failure | Transaction rollback; no partial state |

---

## 13. Explicit Out-of-Scope Boundaries

D13 must NOT introduce:

| Boundary | Evidence |
|----------|----------|
| Finance Center | Existing deferral; D10/D11 closed |
| Invoice / fiscal receipt | Not in business model (AD-D13-01) |
| Airline tickets | Seller Partner responsibility |
| Hotel vouchers | Seller Partner responsibility |
| General ledger | Finance Center scope |
| Accounting reconciliation | Finance Center scope |
| Tax accounting | Finance Center scope |
| Settlement engine | Finance Center scope |
| Installment payments | `PARTIALLY_PAID` exists but not produced (single payment constraint) |
| Reopening D8-D12 | Explicit non-regression boundary |

---

## 14. Open Gaps

| # | Gap | Risk | Mitigation |
|---|-----|------|------------|
| 1 | No `PassengerUpdated` event for regeneration | Regeneration on traveler edit not possible | Initial V1: skip regeneration; document as future debt |
| 2 | No existing template engine | Must install `@react-pdf/renderer` | New dependency; evaluate bundle size |
| 3 | Single payment per Order (no partial payment yet) | Partial Payment Document effectively identical to full voucher | Design for general case; current behavior is correct subset |
| 4 | `documents.read`/`documents.write` not wired to any endpoint | Permissions exist but unenforced | D13 implementation must wire them |
| 5 | Frontend documents page is placeholder | No list/download/view UI | D13 implementation replaces placeholder |

---

## 15. Final Readiness Verdict

### READY WITH EXPLICIT GAPS

**Rationale:**

All required architecture decisions are resolved and internally consistent. The business model is agreed, the source contract is verified, the payment/booking interaction is understood, the PII conflict is corrected, the RBAC matrix is complete, and the rendering/storage infrastructure decision is made.

**Non-blocking gaps:**
1. Passenger edit events for regeneration (V1 can defer; documented debt)
2. Partial payment semantics (current single-payment is correct subset)
3. New dependency (`@react-pdf/renderer`) — low risk
4. Frontend UI replacement (part of D13 implementation scope)

**Implementation can begin safely.** The gaps are clearly enumerated, their behavior is constrained, and they do not block core Voucher functionality.

---

## 16. Git / Change Control Gate

| Item | Status |
|------|--------|
| Production code modified | ❌ No |
| Database schema modified | ❌ No |
| Dependencies added | ❌ No |
| Tests modified | ❌ No |
| Documentation changes | ✅ This report only |
| Commit SHA | HEAD = `40e2f5b` (unchanged) |
| Working tree | Clean (this report is new untracked file) |

---

*Report generated: 2026-09-10*  
*Mode: DECISION / READINESS ONLY — NO PRODUCTION IMPLEMENTATION*  
*Git state: HEAD = `40e2f5b` — unchanged*
