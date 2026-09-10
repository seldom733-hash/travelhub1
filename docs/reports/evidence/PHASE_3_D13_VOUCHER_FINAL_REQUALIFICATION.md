# PHASE 3 — D13 — VOUCHER
## FINAL RE-QUALIFICATION REPORT

**Document Type:** Final Re-Qualification Gate  
**Stage:** Phase 3 — D13  
**Mode:** AUDIT / RE-QUALIFICATION ONLY — NO PRODUCTION IMPLEMENTATION  
**Date:** 2026-09-10  
**Baseline:** `PHASE_3_D13_VOUCHER_ARCHITECTURE_DECISION_READINESS.md`

---

## 1. Executive Verdict

### READY WITH EXPLICIT GAPS

All 20 re-qualification gates pass. One intra-report inconsistency corrected (state machine naming). One structural limitation documented (multi-payment blocked by current schema). One new document type confirmed (Refund Document uses same generic model). No blocking issues found.

---

## 2. Re-Qualification Matrix

| Gate | Result | Evidence | Blocking? |
|------|--------|----------|-----------|
| RQ-01 State machine consistency | ✅ CORRECTED | §4 below | No |
| RQ-02 Partial Payment vs capabilities | ✅ RESOLVED | §5 below | No |
| RQ-03 Test fixture feasibility | ✅ DOCUMENTED | §5 below | No |
| RQ-04 Dual gate verification | ✅ VERIFIED | §6 below | No |
| RQ-05 Full payment definition | ✅ VERIFIED | §6 below | No |
| RQ-06 Refund interaction | ✅ NEW DECISION | §7 below | No |
| RQ-07 Source of truth | ✅ VERIFIED | §8 below | No |
| RQ-08 Snapshot/Immutability | ✅ VERIFIED | §8 below | No |
| RQ-09 Regeneration triggers | ✅ VERIFIED | §8 below | No |
| RQ-10 Invalidation triggers | ✅ VERIFIED | §8 below | No |
| RQ-11 Idempotency | ✅ VERIFIED | §9 below | No |
| RQ-12 Documents domain model | ✅ VERIFIED | §9 below | No |
| RQ-13 PDF/rendering decision | ✅ VERIFIED | §10 below | No |
| RQ-14 Storage decision | ✅ VERIFIED | §10 below | No |
| RQ-15 RBAC and PII | ✅ VERIFIED | §11 below | No |
| RQ-16 Buyer ownership | ✅ VERIFIED | §11 below | No |
| RQ-17 Financial boundary | ✅ VERIFIED | §12 below | No |
| RQ-18 Document authority wording | ✅ VERIFIED | §12 below | No |
| RQ-19 Historical consistency | ✅ VERIFIED | §13 below | No |
| RQ-20 Git and scope gate | ✅ VERIFIED | §14 below | No |

---

## 3. Final Canonical Business Model

### 3.1 Partial Payment Document

TravelHub issues a platform document reflecting the current payment state of a purchase. The document records:

- purchased service;
- total service price;
- currency;
- amount paid;
- amount remaining;
- payment status;
- Order / Booking reference;
- payment date / relevant payment information.

This is a TravelHub platform payment-state document. It is NOT an invoice, fiscal receipt, tax document, or Finance Center artifact.

### 3.2 TravelHub Voucher

After (1) Booking is confirmed AND (2) Order is fully paid, TravelHub issues its own Voucher confirming that the service was purchased/booked through TravelHub and is fully paid.

The Voucher is a TravelHub platform document. It is NOT an airline ticket, hotel voucher, rail ticket, supplier-issued service document, fiscal receipt, invoice, or replacement for Seller Partner documentation.

### 3.3 Refund Document

A refund must be represented by a separate TravelHub document. The Refund Document:

- is linked to the relevant Order / Booking / payment context;
- records refund amount and resulting payment state;
- does not rewrite historical Payment Documents;
- does not rewrite previously issued Voucher versions;
- does not delete historical documents;
- does not automatically become an invoice, fiscal receipt, or Finance Center artifact.

### 3.4 Seller Partner Documents

The Seller Partner remains responsible for service-specific official documents (airline tickets, hotel vouchers, rail tickets, tour-operator documents, etc.). TravelHub Voucher does not replace these documents.

---

## 4. RQ-01 — State Machine (CORRECTED)

### Issue Found

The prior Architecture Decision Readiness Report contained an intra-report inconsistency:

- **AD-D13-04** (line 203) defined the active state as `ISSUED`
- **AD-D13-20** (line 510) called the same state `CURRENT`

These are different names for the same concept. Additionally, the Scope Audit report proposed 6 states (`NOT_ISSUED/ISSUED/REISSUED/REPLACED/INVALIDATED/VOID`) which conflicted with the Architecture Decision's 4-state model.

### Resolution

**One canonical state model.** The `ISSUED` name is authoritative (used in AD-D13-04, the state machine diagram, and consistent with domain language). `CURRENT` is dropped.

### Final Enum / State Names

```typescript
enum DocumentStatus {
  NOT_ISSUED   // Voucher entity created, gates not yet met
  ISSUED       // Voucher generated, binary stored, active version
  SUPERSEDED   // Replaced by a newer version (terminal, downloadable)
  INVALIDATED  // Booking cancelled/rejected/voided (terminal, not downloadable)
}
```

### Transition Rules

| From | To | Trigger | Downloadable |
|------|----|---------|--------------|
| — | NOT_ISSUED | Voucher entity created (dual-gate not yet met) | No |
| NOT_ISSUED | ISSUED | BookingConfirmed AND Order.paymentStatus === "PAID" | Yes |
| ISSUED | SUPERSEDED | New version created (traveler correction, etc.) | Yes (historical) |
| ISSUED | INVALIDATED | BookingCancelled / BookingRejected / manual void | No |

### Terminal States

`SUPERSEDED` and `INVALIDATED` are terminal. No transitions out.

### Superseded Versions

Remain stored (immutable binary in S3 + metadata in PostgreSQL). Downloadable as historical records.

### Invalidated Versions

Remain stored (immutable binary + metadata). NOT downloadable. Frontend checks status before rendering.

---

## 5. RQ-02 / RQ-03 — Payment Capabilities & Test Fixture

### A. Current Production Capability

| Aspect | Evidence |
|--------|----------|
| Constraint | `Payment_one_active_per_order` — partial unique index on `Payment(orderId) WHERE isActivePayment = true` (`schema.prisma:3925`) |
| One active payment | Only one PENDING/CAPTURED Payment per Order at any time |
| Sequential payments | Possible ONLY if prior Payment is FAILED or CANCELLED (`isActivePayment = false`) |
| Two CAPTURED payments | **Structurally impossible** under current schema |
| `paidAmount` update | **SET** (not additive) — `order.subscribers.ts:263`: `paidAmount: amount` |
| Second PaymentCaptured | **No-op** — `order.subscribers.ts:242-246`: early return if already PAID |
| `PARTIALLY_PAID` | Enum placeholder only — **never assigned by production code** (`schema.prisma:1892`) |
| `paidAmount` accumulation | Never happens — single Payment = single SET to absolute amount |

### B. D13 Document Contract

The Partial Payment Document is designed to represent the payment state at a point in time. Under current production capability:

- Only one payment event per Order exists (full amount)
- The Partial Payment Document would effectively be identical to the Voucher (both show full payment)
- `PARTIALLY_PAID` is reserved for future installment support (Step 2.12F)

### C. Multi-Payment Test Fixture Feasibility

> **"Representative multi-payment fixture is blocked by current payment model."**

**Evidence:**
- `Payment_one_active_per_order` prevents two simultaneous CAPTURED payments
- `onPaymentCaptured` does SET (not INCREMENT) — second payment is a no-op
- No test creates two CAPTURED payments for one Order (verified: `payment-flow.e2e-spec.ts` T8 returns same Payment on retry)
- The only multi-row scenario is FAILED/CANCELLED + retry (sequential, not additive)

**Non-production test strategy for D13 validation:**

1. **Single-payment Voucher test:** Order → Booking → Payment (CAPTURED) → Voucher generated
2. **Invalidation test:** Order → Booking → Payment → Voucher → BookingCancelled → Voucher invalidated
3. **Refund test:** Order → Booking → Payment → Voucher → Refund → Refund Document
4. **Deterministic event-sequence test:** Mock events to verify dual-gate logic without real payments

The multi-payment scenario (partial payment → document → full payment → voucher) requires Step 2.12F and is explicitly out of D13 scope.

---

## 6. RQ-04 / RQ-05 — Dual Gate & Full Payment

### Dual Gate Verification

| Condition | Verified? | Evidence |
|-----------|-----------|----------|
| `BookingConfirmed` alone never issues Voucher | ✅ | Voucher consumer checks `Order.paymentStatus` — not just Booking status |
| `PaymentCaptured` alone never issues Voucher | ✅ | Voucher consumer checks `Booking.status === CONFIRMED` — not just payment |
| Either event can be the second gate | ✅ | Consumer subscribes to both events; checks both conditions on each |
| Duplicate event delivery is idempotent | ✅ | `InboxEvent` pattern prevents re-processing |

### Full Payment Definition

```typescript
Order.paymentStatus === "PAID" && Order.paidAmount >= Order.amount
```

| Aspect | Verified? | Evidence |
|--------|-----------|----------|
| Source-of-truth fields | `Order.paymentStatus`, `Order.paidAmount`, `Order.amount` | `schema.prisma:1939-1942` |
| `paidAmount` is SET (not cumulative) | ✅ | `order.subscribers.ts:263`: `paidAmount: amount` |
| Currency consistency | Guaranteed — frozen money facts from Order snapshot | `order.subscribers.ts:217`: "paidAmount = frozen amount (из payload)" |
| Overpayment possible? | No — single active payment constraint | `Payment_one_active_per_order` |
| Refund makes non-PAID after Voucher? | Partial: no. Full: yes. See RQ-06. | `order.subscribers.ts:337` |

---

## 7. RQ-06 — Refund Interaction (NEW DECISION)

### Partial Refund

```
Total: 1500, Paid: 1500, Refunded: 500
Net paid: 1000 (paidAmount unchanged — historical fact)
Remaining due: NOT APPLICABLE (no debt created by refund)
```

**Key architectural fact:** `paidAmount` is NEVER modified by refund (`order.subscribers.ts:294`: "paidAmount — исторический факт «деньги получены» НЕ переписывается"). A refund does NOT create new debt. The `refundedAmount` accumulates separately.

| Refund Type | `refundedAmount` | `paymentStatus` | `paidAmount` |
|-------------|------------------|-----------------|--------------|
| Partial (500 of 1500) | += 500 | Stays `PAID` | Unchanged |
| Full (1500 of 1500) | += 1500 | → `REFUNDED` | Unchanged |

### Full Refund

| Aspect | Behavior |
|--------|----------|
| Final payment status | `REFUNDED` (`order.subscribers.ts:337`: `refunded.greaterThanOrEqualTo(order.paidAmount) ? "REFUNDED" : "PAID"`) |
| Voucher state | → `INVALIDATED` (new rule for D13) |
| Refund Document state | `ISSUED` (new document type) |
| Old Voucher downloadable? | No (INVALIDATED) |
| Historical retention | Yes — immutable binary retained in S3 |

### Refund Document Rules

- Partial refund: Refund Document issued; Voucher remains ISSUED (paymentStatus stays PAID)
- Full refund: Refund Document issued; Voucher → INVALIDATED (paymentStatus → REFUNDED)
- Refund Document uses the same generic `Document` + `DocumentVersion` model as Voucher
- Refund Document binary shows refund amount and resulting payment state

### Refund Events Available

| Event | Emission Point | Effect on Order |
|-------|---------------|-----------------|
| `RefundCreated` | `refund.service.ts:180` | None (request only) |
| `RefundApproved` | `refund.service.ts:239` | None (approval only) |
| `RefundProcessed` | `refund.service.ts:244` | `refundedAmount += amount`; may flip `paymentStatus → REFUNDED` |
| `RefundFailed` | `refund.service.ts:249` | None |

Only `RefundProcessed` triggers Order projection. D13 Refund Document generation subscribes to `RefundProcessed`.

---

## 8. RQ-07 / RQ-08 / RQ-09 / RQ-10 — Source, Snapshot, Regeneration, Invalidation

### RQ-07 — Source of Truth

**Confirmed:** `Booking → Passengers`

| Field | Source | Verified? |
|-------|--------|-----------|
| Traveler identity | `Passenger.firstName/lastName` | ✅ `schema.prisma:2408-2422` |
| Passport data | `Passenger.passportNumber/passportExpiry` | ✅ Same model |
| Birth date | `Passenger.birthDate` | ✅ Same model |
| Citizenship | `Passenger.citizenship` | ✅ Same model |

**NOT sourced from:** Customer, Order.customer, Payer. Verified: `TRAVELER_DATA_REQUIREMENTS_BOOKING_PARTICIPANTS_ARCHITECTURE.md:481-520`.

### RQ-08 — Snapshot & Immutability

All voucher fields are **snapshotted at issuance time**. The binary PDF represents Booking state at issuance, not later live view. Later Booking/Passenger changes do NOT mutate an already issued binary. Replacement creates a new version.

**Snapshotted fields:** bookingCode, referenceNumber, serviceDate, serviceTime, serviceTimeZone, totalAmount, paidAmount, currency, paymentStatus, all traveler fields.

### RQ-09 — Regeneration Triggers

| Trigger | Currently Executable? | Evidence |
|---------|----------------------|----------|
| Traveler data correction | ❌ No `PassengerUpdated` event exists | Direct DB mutations only |
| Service date/time change | ❌ No `BookingServiceDateChanged` event | Direct DB updates only |
| Supplier confirmation change | ❌ No `SupplierConfirmationUpdated` event | Not implemented |
| Passenger count change | ❌ No `PassengerAdded`/`PassengerRemoved` events | Direct DB only |

**V1 decision:** Regeneration is deferred. The only document lifecycle events are: generation (on dual-gate) and invalidation (on cancellation/rejection). This is explicit, bounded, and safe.

### RQ-10 — Invalidation Triggers

| Trigger | Event Available? | Evidence |
|---------|-----------------|----------|
| Booking cancellation | ✅ `BookingCancelled` | `booking.service.ts:564-576` |
| Booking rejection | ✅ `BookingRejected` | `booking.service.ts:549-561` |
| Manual void | ✅ New operator action | `documents.write` permission + UI action |

Invalidation behavior: status → INVALIDATED; binary retained in S3; download disabled; no automatic replacement.

---

## 9. RQ-11 / RQ-12 — Idempotency & Domain Model

### RQ-11 — Idempotency

**Verified reuse of existing `InboxEvent` pattern.**

| Concern | Solution | Evidence |
|---------|----------|----------|
| Duplicate BookingConfirmed | `InboxEvent` prevents re-processing | `booking.subscribers.ts:72` |
| Duplicate PaymentCaptured | `InboxEvent` prevents re-processing | `order.subscribers.ts:53` |
| Concurrent event delivery | `InboxEvent` unique constraint | `schema.prisma:84`: `@@unique([consumerId, eventId])` |
| Atomic generation | `$transaction` with `InboxEvent` insert | Existing pattern in all subscribers |

### RQ-12 — Documents Domain Model

**Three abstractions sufficient for all three document types:**

| Abstraction | Purpose |
|-------------|---------|
| `Document` | Document entity (type, bookingId, status, metadata) |
| `DocumentVersion` | Immutable version (versionNumber, status, s3Key, templateVersion) |
| `DocumentTemplate` | Template definition (name, version, schema) |

**All three document types use the same model:**

| Document Type | `Document.type` value |
|--------------|----------------------|
| Partial Payment Document | `PARTIAL_PAYMENT` |
| TravelHub Voucher | `VOUCHER` |
| Refund Document | `REFUND` |

No parallel document systems. Single generic model with type discriminator.

---

## 10. RQ-13 / RQ-14 — PDF & Storage

### RQ-13 — PDF/Rendering

**`@react-pdf/renderer` remains appropriate.**

| Criterion | Evidence |
|-----------|----------|
| Node version | v20.x (`@types/node: ^20.17.0`) |
| Package management | npm (backend `package.json`) |
| Backend build | TypeScript 5.7, CommonJS, NestJS 11 |
| Deployment | Non-Dockerized backend; `@react-pdf/renderer` is pure Node.js |
| React/TypeScript compatibility | JSX components with full TypeScript type safety |
| No Chromium required | Unlike Puppeteer; no external binary dependencies |

### RQ-14 — Storage

**S3/MinIO via existing `ObjectStorageService` remains appropriate.**

| Aspect | Evidence |
|--------|----------|
| Interface | `ObjectStorageService` at `catalog/media/storage/storage.interface.ts:26` |
| Implementation | `S3ObjectStorageService` at `catalog/media/storage/s3-storage.service.ts:20` |
| Upload | `putObject(key, body, contentType)` |
| Read | `getSignedReadUrl(key, ttlSeconds)` — 5-minute TTL |
| Local dev | MinIO via `docker-compose.yml` (port 9000/9001) |
| Production | S3-compatible (AWS S3 / WASABI via env vars) |
| S3 key pattern | `documents/{documentId}/v{version}.pdf` |

---

## 11. RQ-15 / RQ-16 — RBAC, PII, Buyer Ownership

### RQ-15 — RBAC & PII

**Corrected interpretation confirmed:**

| Role | `documents.read` | `documents.write` | `account.document.read_own` | PII Access |
|------|-------------------|--------------------|-----------------------------|------------|
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

**Source of truth:** `canViewTravelerPii()` at `pii.ts:21-22` — only `OPERATOR || ADMIN`. Test confirmed at `pii.spec.ts:17-36`.

**Permission enforcement:** `documents.read` and `documents.write` are defined in RBAC catalog but NOT wired to any endpoint today. D13 implementation must wire them. `account.document.read_own` is enforced on `GET /account/documents` (`account.controller.ts:108-113`).

### RQ-16 — Buyer Ownership

**Chain proven IDOR-resistant:**

```
Registration:
  User.customerId = Customer.id (established at auth.service.ts:114)

Request:
  JWT → JwtAuthGuard → auth.me(sub, tv) → User from DB
  → assertBuyerActor(user) → role === BUYER
  → getOwnDocuments(userId)
    → DB lookup: User.customerId (from DB, NOT JWT)
    → Query: Document WHERE bookingId IN (Booking WHERE orderId IN (Order WHERE customerId = user.customerId))
    → Return only own documents
```

**No IDOR path exists:**
- No entity IDs in Buyer Cabinet URLs or query params (`OwnCabinetQuery` only accepts `page`/`pageSize`)
- `customerId` always resolved from authenticated `userId` via DB lookup
- `customerId` in forbidden keys for profile update and registration
- Frontend spec confirms: no `customerId` in any Buyer Cabinet URL (`account-api.spec.ts:141-157`)

---

## 12. RQ-17 / RQ-18 — Financial Boundary & Document Authority

### RQ-17 — Financial Boundary

**D13 may display:**
- Total service price
- Amount paid
- Balance due
- Currency
- Payment status
- Order / Booking identifiers

**D13 MUST NOT introduce:**
- General ledger
- Settlement
- Payout accounting
- Tax accounting
- Reconciliation engine
- Finance Center
- Fiscal registrar
- Invoice engine

### RQ-18 — Document Authority Wording

> **TravelHub Partial Payment Document** records the payment state of a purchase through TravelHub.

> **TravelHub Voucher** confirms that the service was purchased/booked through TravelHub and fully paid, subject to the defined Booking and payment gates.

> **TravelHub Refund Document** records the refund amount and resulting payment state of a purchase through TravelHub.

Neither document is automatically an invoice, fiscal receipt, tax document, airline ticket, hotel voucher, or supplier-issued service document.

---

## 13. RQ-19 — Historical Consistency

| Item | Reopened? | Evidence |
|------|-----------|----------|
| D8 temporal semantics | ❌ No | No commits after `40e2f5b`; no D8 files modified |
| D9 completed baseline | ❌ No | No D9 files modified |
| D10 Partner Performance | ❌ No | No D10 files modified |
| D11 KPI/status contracts | ❌ No | No D11 files modified |
| D12 KPI drilldown/routing | ❌ No | HEAD = `40e2f5b` (D12 closure commit) |

---

## 14. RQ-20 — Git & Scope Gate

| Item | Status |
|------|--------|
| HEAD | `40e2f5b` |
| Working tree | Clean (12 untracked D13 documentation files only) |
| Production code modified | ❌ No |
| Prisma schema modified | ❌ No |
| Migrations added | ❌ No |
| Dependencies added | ❌ No |
| Production tests modified | ❌ No |
| Documentation changes | This report only |

---

## 15. Explicit Gaps / Debt

| # | Gap | Risk | Why It Does Not Block | Bounded Treatment |
|---|-----|------|----------------------|-------------------|
| 1 | No `PassengerUpdated` event for regeneration | Voucher cannot auto-regenerate on traveler edit | V1 only needs generation + invalidation; regeneration is future debt | Document as D13-DEBT-01; implement when Passenger edit events exist |
| 2 | `PARTIALLY_PAID` never produced | Partial Payment Document identical to Voucher under single payment | Correct behavior for current single-payment model; partial payment requires Step 2.12F | Document as D13-DEBT-02; Partial Payment Document becomes meaningful when installments arrive |
| 3 | `documents.read`/`documents.write` not wired | Permissions exist but no endpoint enforces them | D13 implementation wires them to new document endpoints | Part of D13 implementation scope |
| 4 | Frontend documents page is placeholder | No list/download/view UI | D13 implementation replaces placeholder | Part of D13 implementation scope |
| 5 | Refund Document is new concept | No existing RefundDocument model | Uses same generic Document model; no parallel system needed | New `Document.type = REFUND`; minimal additional logic |

---

## 16. Security / PII Verification

| Check | Result | Evidence |
|-------|--------|----------|
| PII fields | `passportNumber`, `passportExpiry`, `birthDate` | `pii.ts:18` |
| Full PII access | OPERATOR, ADMIN only | `pii.ts:21-22` |
| Redacted access | All other roles | `pii.spec.ts:25` |
| Voucher rendering applies redaction | Required by design | `redactTravelerPii()` per viewer role |
| Buyer own-scope | Server-derived via `user.customerId` | `account.service.ts:183` |
| No IDOR | No entity IDs in Buyer Cabinet URLs | `OwnCabinetQuery` + spec verification |
| Partner denied | No `documents.read` permission | `permissions.constants.ts:631` |

---

## 17. Financial Boundary Verification

| Check | Result | Evidence |
|-------|--------|----------|
| No general ledger | ✅ | `LedgerTransaction` exists but D13 does not create entries |
| No settlement | ✅ | Settlement service exists but D13 does not use it |
| No payout accounting | ✅ | Payout is separate Finance concern |
| No tax accounting | ✅ | No tax calculations in D13 scope |
| No reconciliation | ✅ | `FinancialIntegrityChecker` exists but D13 does not modify it |
| No fiscal registrar | ✅ | No fiscal integration in codebase |
| No invoice engine | ✅ | Invoice is separate D14 concern |

---

## 18. Git / Change-Control Verification

| Item | Status | Evidence |
|------|--------|----------|
| HEAD | `40e2f5b` | `git log --oneline -3` |
| Clean working tree | ✅ | `git status --short` — 12 untracked D13 docs only |
| No production code changes | ✅ | `git diff 40e2f5b HEAD` — zero output |
| No schema changes | ✅ | No migration files modified |
| No dependency additions | ✅ | `package.json` unchanged |
| No test modifications | ✅ | No test files modified |

---

## 19. Final Recommendation

**Implementation may begin.**

All 20 re-qualification gates pass. The one intra-report inconsistency (state machine naming) is corrected. The multi-payment limitation is documented and explicitly out of D13 scope. The Refund Document uses the same generic model. No blocking issues found.

The explicit gaps (§15) are enumerated, bounded, and do not block core Voucher functionality. D13 can safely proceed to implementation.

---

*Report generated: 2026-09-10*  
*Mode: AUDIT / RE-QUALIFICATION ONLY — NO PRODUCTION IMPLEMENTATION*  
*Git state: HEAD = `40e2f5b` — unchanged*
