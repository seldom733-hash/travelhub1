# PHASE 3 — D13 — VOUCHER
## FINAL IMPLEMENTATION PROMPT

**Stage:** Phase 3 — D13  
**Mode:** IMPLEMENTATION  
**Prerequisite:** D13 Final Re-Qualification = `READY WITH EXPLICIT GAPS`  
**Implementation baseline:** HEAD `40e2f5b`  
**Primary objective:** Implement the approved TravelHub document architecture for Partial Payment Document, TravelHub Voucher, and Refund Document without expanding payment/finance scope.

---

# 1. AUTHORITATIVE BUSINESS MODEL

Implement exactly this model.

## 1.1 Partial Payment Document

TravelHub platform document reflecting the current payment state of a purchase.

It may contain:

- service;
- total service price;
- currency;
- amount paid;
- amount remaining;
- payment status;
- Order / Booking reference;
- relevant payment date/information.

It is NOT automatically an invoice, fiscal receipt, tax document, or Finance Center artifact.

### Current payment-model limitation

The current production schema supports only one active Payment per Order and does not currently accumulate multiple captured payments.

Therefore:

**DO NOT modify the production Payment model to add installment/multi-payment support in D13.**

Do not add:

- installment ledger;
- cumulative multi-payment engine;
- new payment aggregation semantics;
- schema relaxation solely for D13.

`PARTIALLY_PAID` remains future debt / Step 2.12F unless the existing implementation already supports the required state without modification.

Implement the document model so it is compatible with future partial-payment support, but do not implement that payment capability now.

---

# 2. TRAVELHUB VOUCHER

The Voucher is a TravelHub platform document.

It is issued only when BOTH are true:

```text
Booking.status === CONFIRMED
AND
Order.paymentStatus === PAID
AND
Order.paidAmount >= Order.amount
```

The two events are independent:

- `BookingConfirmed`
- `PaymentCaptured`

The Voucher consumer must subscribe to both and evaluate the dual gate on either event.

Examples:

```text
BookingConfirmed → not paid → no Voucher
PaymentCaptured → not confirmed → no Voucher
BookingConfirmed + already PAID → Voucher
PaymentCaptured + already CONFIRMED → Voucher
```

The Voucher confirms that the service was purchased/booked through TravelHub and fully paid.

It is NOT:

- airline ticket;
- hotel voucher;
- rail ticket;
- supplier document;
- invoice;
- fiscal receipt;
- Finance Center artifact.

Seller Partner remains responsible for service-specific documentation.

---

# 3. REFUND DOCUMENT

Implement Refund Document using the same generic Documents domain model.

`Document.type = REFUND`

Generate it from:

`RefundProcessed`

The Refund Document must:

- identify the relevant Order / Booking / payment context;
- record refund amount;
- record resulting payment state;
- preserve historical payment facts;
- preserve historical Voucher versions;
- never rewrite or delete previously issued documents.

## Refund behavior

### Partial refund

Current verified domain behavior:

- `refundedAmount` increases;
- `paidAmount` remains historical and unchanged;
- `paymentStatus` remains `PAID`;
- existing Voucher remains `ISSUED`.

Generate a Refund Document.

Do NOT invent a new amount-due/debt state unless repository semantics explicitly require it.

### Full refund

Current verified behavior:

- `paymentStatus → REFUNDED`;
- Refund Document is issued;
- current Voucher becomes `INVALIDATED`;
- historical Voucher binary remains retained;
- invalidated Voucher is not downloadable.

---

# 4. CANONICAL DOCUMENT MODEL

Create one generic Documents domain, not three independent systems.

Required abstractions:

```text
Document
DocumentVersion
DocumentTemplate
```

Required type discriminator:

```text
PARTIAL_PAYMENT
VOUCHER
REFUND
```

All three document types must use the same persistence/versioning/storage infrastructure.

---

# 5. VOUCHER / DOCUMENT STATE MODEL

Use exactly one canonical lifecycle state vocabulary:

```text
NOT_ISSUED
ISSUED
SUPERSEDED
INVALIDATED
```

Semantics:

- `NOT_ISSUED` — document entity exists but issuance gate has not been satisfied.
- `ISSUED` — current active issued version.
- `SUPERSEDED` — replaced by a newer version; terminal; historical document remains downloadable.
- `INVALIDATED` — terminal; no longer valid; binary retained but not downloadable.

Do NOT introduce `CURRENT` as a separate lifecycle state.

Only one version may be `ISSUED` for a Document at a time.

---

# 6. VERSIONING / IMMUTABILITY

Use sequential versions:

```text
v1
v2
v3
...
```

Rules:

- issued binary is immutable;
- issued metadata is immutable except controlled lifecycle status transition;
- replacement creates new version;
- old active version becomes `SUPERSEDED`;
- invalidation changes status to `INVALIDATED`;
- historical binary remains stored;
- invalidated binary is not downloadable.

Store audit metadata:

- documentId;
- bookingId where applicable;
- versionNumber;
- issuedAt;
- triggeringEvent;
- templateVersion;
- actorId where applicable.

---

# 7. SOURCE OF TRUTH

Voucher traveler source is:

```text
Booking → Passengers
```

NEVER source traveler identity automatically from:

- Customer;
- Order.customer;
- Payer.

Snapshot all document data at issuance.

At minimum verify and support:

- bookingCode;
- bookingReferenceNumber;
- serviceDate;
- serviceTime;
- serviceTimeZone;
- totalAmount;
- paidAmount;
- currency;
- paymentStatus;
- traveler.firstName;
- traveler.lastName;
- traveler.birthDate;
- traveler.citizenship;
- traveler.gender;
- traveler.passportNumber;
- traveler.passportExpiry.

Do not perform live lookups when rendering an already-issued historical version.

---

# 8. PII / SECURITY

Use existing canonical PII semantics.

Full traveler PII:

- ADMIN;
- OPERATOR.

Redacted:

- DIRECTOR;
- FINANCE;
- ANALYST;
- SALES_MANAGER;
- all other roles without explicit full-PII authority.

Apply the existing `canViewTravelerPii()` / `redactTravelerPii()` semantics rather than inventing a second PII policy.

Required sensitive fields include:

- passportNumber;
- passportExpiry;
- birthDate.

Never expose documents merely because a caller knows a document ID.

---

# 9. RBAC

Wire existing permissions:

```text
documents.read
documents.write
account.document.read_own
```

Required rules:

### ADMIN

- read;
- write;
- full PII.

### OPERATOR

- read;
- write;
- full PII.

### DIRECTOR / FINANCE / ANALYST / SALES_MANAGER

- read;
- no write;
- redacted PII.

### BUYER

- own documents only through ownership chain:
  `User → Customer → Order → Booking → Document`
- `account.document.read_own`.

### PARTNER

- no access to TravelHub Voucher under current contract.

Do not create an alternate permission system.

---

# 10. IDOR PROTECTION

Buyer document retrieval MUST derive ownership from authenticated server-side identity.

Do NOT trust client-supplied:

- customerId;
- orderId;
- bookingId;
- document owner;
- tenant/workspace identifiers for ownership enforcement.

The server must resolve:

```text
authenticated User
→ User.customerId
→ Order.customerId
→ Booking.orderId
→ Document.bookingId
```

A known document ID must never be sufficient for Buyer access.

Add negative tests proving cross-customer access fails.

---

# 11. EVENT / IDEMPOTENCY

Reuse the existing InboxEvent pattern.

Voucher consumer:

- subscribes to `BookingConfirmed`;
- subscribes to `PaymentCaptured`;
- checks the dual gate;
- creates document/version atomically.

Refund consumer:

- subscribes to `RefundProcessed`;
- creates Refund Document atomically;
- applies full-refund Voucher invalidation according to the approved rule.

Use:

```text
InboxEvent
@@unique([consumerId, eventId])
```

Do not introduce another event-deduplication framework.

---

# 12. CANCELLATION / REJECTION

On:

- `BookingCancelled`;
- `BookingRejected`;

invalidate the active Voucher:

```text
ISSUED → INVALIDATED
```

Rules:

- retain binary;
- retain metadata;
- prevent download;
- do not automatically create replacement.

---

# 13. REGENERATION

Do NOT invent non-existing events.

Current repository lacks verified events for:

- PassengerUpdated;
- BookingServiceDateChanged;
- SupplierConfirmationUpdated;
- PassengerAdded/Removed.

Therefore D13 V1 does NOT need automatic regeneration on those changes.

Document this clearly as bounded debt.

Do not create broad event infrastructure outside D13 solely to enable regeneration.

---

# 14. PDF / RENDERING

Use the approved decision:

```text
@react-pdf/renderer
```

Before implementation:

- add dependency using the project package manager;
- verify backend build;
- verify production-compatible Node runtime;
- verify no Chromium/headless-browser dependency is introduced.

Templates:

```text
backend/src/modules/documents/templates/
```

Use typed React/TSX document components.

Do not introduce a second template engine.

---

# 15. STORAGE

Use the existing:

```text
ObjectStorageService
S3ObjectStorageService
```

Store:

- metadata in PostgreSQL;
- PDF binary in S3/MinIO.

Approved key convention:

```text
documents/{documentId}/v{version}.pdf
```

Use short-lived signed read URLs.

Do not create a parallel storage abstraction.

Do not delete historical binaries on invalidation.

---

# 16. DOCUMENT CONTENT

## 16.1 Partial Payment Document

At minimum:

- TravelHub document title/type;
- document number/identifier;
- Order reference;
- Booking reference;
- service name/details available from current domain;
- service date where available;
- total price;
- paid amount;
- remaining amount;
- currency;
- payment status;
- payment date/relevant payment information;
- issue timestamp.

When the current payment model cannot produce a true partial state, do not fake one.

## 16.2 TravelHub Voucher

At minimum:

- TravelHub Voucher title;
- voucher number;
- Order reference;
- Booking reference/code;
- service name/details available from current domain;
- service date/time/timezone;
- total price;
- paid amount;
- balance = 0 for full payment;
- payment status;
- traveler details according to viewer PII policy;
- issue timestamp;
- clear wording that this is a TravelHub platform confirmation and not a supplier ticket/voucher.

## 16.3 Refund Document

At minimum:

- document number;
- Order reference;
- Booking reference;
- original paid amount;
- refund amount;
- cumulative refunded amount if available;
- resulting payment status;
- refund timestamp;
- relevant refund/payment identifier;
- issue timestamp.

Do not fabricate tax/fiscal fields.

---

# 17. DOCUMENT NUMBERING

Use a deterministic, collision-safe document identifier consistent with project conventions.

If no existing convention exists, introduce the smallest scoped convention and document it.

Do not use database auto-increment values directly as publicly exposed document numbers without assessing enumeration risk.

Recommended business prefixes:

```text
PPD-*   Partial Payment Document
VCH-*   TravelHub Voucher
RFD-*   Refund Document
```

The implementation must verify whether these prefixes conflict with existing canonical business IDs before use.

---

# 18. API

Implement minimal backend endpoints required by the existing frontend and D13 business flow.

At minimum support:

- list/get buyer's own documents;
- authorized administrative/operator document access;
- authorized document download;
- operator manual invalidation where approved.

Do not expose raw S3 keys.

Use signed URLs generated server-side.

Enforce:

- permission;
- ownership scope;
- document status;
- PII projection.

Do not add broad generic CRUD endpoints that bypass document policy.

---

# 19. FRONTEND

Replace the existing `/account/documents` placeholder with a functional document surface.

At minimum:

- document list;
- type;
- status;
- date;
- Order/Booking reference;
- relevant amount/payment state;
- download action;
- invalidated documents shown according to UX decision but not downloadable.

Buyer must see only own documents.

Admin/operator document views must honor PII policy.

Do not introduce unrelated UI redesign.

---

# 20. TEST FIXTURES / ACCEPTANCE DATA

Do NOT modify production Payment schema to create multi-payment behavior.

Because the current schema prevents two captured Payments on one Order, the implementation must NOT create fake production data representing two captured payments.

Use isolated integration/unit scenarios.

Minimum tests:

### T1 — Voucher after BookingConfirmed + PAID

Both gates satisfied → exactly one Voucher.

### T2 — BookingConfirmed while unpaid

No Voucher.

### T3 — PaymentCaptured while Booking unconfirmed

No Voucher.

### T4 — Second gate later

When the missing condition arrives → Voucher generated exactly once.

### T5 — Duplicate event

Duplicate BookingConfirmed/PaymentCaptured → no duplicate active Voucher.

### T6 — Cancellation

Issued Voucher → INVALIDATED → no download.

### T7 — Rejection

Issued Voucher → INVALIDATED → no download.

### T8 — Partial refund

Refund Document created; Voucher remains ISSUED under current verified payment projection.

### T9 — Full refund

Refund Document created; Voucher → INVALIDATED; download blocked.

### T10 — Buyer isolation

Buyer A cannot access Buyer B's document.

### T11 — PII redaction

Non-ADMIN/OPERATOR viewer receives redacted passport/DOB fields.

### T12 — Historical immutability

Issued v1 remains unchanged after a replacement/version event.

### T13 — Storage failure

Document must not be marked ISSUED if PDF persistence is incomplete.

### T14 — Multi-payment limitation

Explicit test/documentation demonstrates that D13 does not pretend to support multi-payment when production schema does not.

---

# 21. ERROR / RECOVERY

Required behavior:

- rendering failure → no ISSUED state;
- storage failure → no inconsistent ISSUED state;
- duplicate event → idempotent;
- missing payment gate → no Voucher;
- missing required Passenger data → block generation safely;
- invalidated document → no download;
- missing/corrupt binary → surface controlled error and preserve metadata.

Do not silently swallow failures.

Log enough metadata for operational diagnosis without leaking sensitive PII.

---

# 22. OBSERVABILITY

Add structured logging for:

- document creation;
- version creation;
- issuance;
- invalidation;
- refund-document creation;
- storage failure;
- rendering failure;
- authorization denial;
- IDOR prevention events;
- duplicate event suppression.

Do not log passport numbers or other sensitive PII.

---

# 23. ARCHITECTURAL BOUNDARIES

D13 MUST NOT implement:

- Finance Center;
- general ledger;
- settlement;
- payout accounting;
- tax accounting;
- reconciliation engine;
- fiscal registrar;
- invoice engine;
- installment payment engine;
- airline ticket generation;
- hotel voucher generation;
- supplier service-document generation.

Do not reopen D8-D12 contracts.

Do not alter:

- D10 partner attribution;
- D11 KPI/status semantics;
- D12 routing/drilldown semantics.

---

# 24. MIGRATIONS

If new Prisma models are required:

- create the smallest schema addition;
- include constraints for version uniqueness and active-version semantics;
- include indexes required for ownership and retrieval;
- do not change existing Payment constraints for D13;
- do not alter historical domain semantics.

Migration must be reproducible from a clean database.

---

# 25. ACCEPTANCE GATES

D13 implementation is not complete until all are true:

### G1 — Build

Backend TypeScript passes.

Frontend build passes.

### G2 — Database

Migration applies cleanly to a clean database.

### G3 — Voucher dual gate

All gate tests pass.

### G4 — Idempotency

Duplicate events cannot create duplicate active Vouchers.

### G5 — Security

RBAC + Buyer ownership + PII redaction tests pass.

### G6 — Storage

PDF storage and signed retrieval work.

### G7 — Invalidation

Cancellation/rejection/full-refund invalidation works.

### G8 — Refund Document

Refund Document is generated and linked correctly.

### G9 — Historical integrity

Previously issued documents remain immutable and retained.

### G10 — Scope

No Finance/payment-engine expansion.

### G11 — Regression

D8-D12 regression suite passes.

### G12 — Git hygiene

Working tree is clean at final closure.

---

# 26. REQUIRED IMPLEMENTATION REPORT

Create:

```text
docs/reports/evidence/PHASE_3_D13_VOUCHER_IMPLEMENTATION_REPORT.md
```

The report MUST contain:

## 1. Executive Summary

- implemented scope;
- explicit gaps;
- final verdict.

## 2. Architecture Mapping

Map every approved AD decision to implementation evidence.

## 3. Data Model

- Prisma models;
- constraints;
- indexes;
- migration.

## 4. Event Flow

- BookingConfirmed;
- PaymentCaptured;
- RefundProcessed;
- BookingCancelled;
- BookingRejected.

## 5. Document Lifecycle

State transitions and versioning.

## 6. Security

RBAC, Buyer own-scope, IDOR, PII redaction.

## 7. PDF / Storage

Rendering, storage, signed retrieval.

## 8. Test Evidence

Exact test names and results.

## 9. Multi-Payment Limitation

Explicitly state that D13 did NOT modify the payment model and does NOT support real multi-installment payment.

## 10. Regression Evidence

D8-D12.

## 11. Git Evidence

- commit SHA;
- branch;
- clean working tree;
- changed files;
- migration status.

## 12. Final Verdict

Choose exactly:

- `PASS / D13 CLOSED`
- `PASS WITH EXPLICIT NON-BLOCKING DEBT`
- `FAIL / REMEDIATION REQUIRED`

---

# 27. IMPLEMENTATION CHANGE CONTROL

Before changing code:

1. Verify HEAD is still the approved D13 baseline.
2. Verify working tree state.
3. Do not overwrite unrelated uncommitted user work.
4. Keep changes limited to D13 scope.
5. Commit all D13 implementation changes in a dedicated commit.
6. Push to the canonical branch only according to project workflow.

At finalization provide:

- exact commit SHA;
- `git status`;
- test summary;
- build summary;
- migration summary;
- changed-file summary.

---

# 28. FINAL HARD RULE

The most important rule is:

> **D13 implements TravelHub's document layer, not a new payment engine and not Finance Center.**

The current system does not support two captured payments on one Order. Do not fake that capability and do not alter the Payment model just to produce a test purchase.

The document architecture must nevertheless be designed so future installment/payment-state support can produce a genuine Partial Payment Document without replacing the D13 document model.

Begin implementation only within these boundaries.
