# PHASE 3 — D13 — FINAL RE-QUALIFICATION
## Voucher + Partial Payment Document + Refund Document
### Architecture Consistency / Evidence / Implementation Readiness Gate

**Document Type:** Final Re-Qualification Prompt  
**Stage:** Phase 3 — D13  
**Mode:** AUDIT / RE-QUALIFICATION ONLY — NO PRODUCTION IMPLEMENTATION  
**Baseline:** Existing D13 Architecture Decision & Implementation Readiness Report  
**Primary Objective:** Validate that D13 is internally consistent and genuinely ready for implementation.

---

# 1. Mission

Re-qualify the existing D13 Architecture Decision & Implementation Readiness Report against the current repository, schema, domain events, permissions, storage infrastructure, and the agreed business model.

Do NOT implement D13 production functionality in this run.

Do NOT modify production code, Prisma schema, migrations, dependencies, tests, or UI.

The only permitted output is an evidence-based re-qualification report and, if needed, documentation-only corrections.

The re-qualification must determine whether D13 can safely proceed to implementation.

---

# 2. Canonical Business Model — FROZEN

The following business model is already agreed and MUST NOT be reinterpreted.

## 2.1 Partial Payment Document

When the customer has made a payment but the purchase is not yet fully paid, TravelHub may issue a platform document reflecting the current payment state.

The document should be able to show:

- purchased service;
- total service price;
- currency;
- amount paid;
- amount remaining;
- payment status;
- Order / Booking reference;
- payment date / relevant payment information.

This is a TravelHub platform payment-state document.

It is NOT automatically an invoice, fiscal receipt, tax document, or Finance Center artifact.

## 2.2 TravelHub Voucher

After:

1. Booking is confirmed;
2. the Order is fully paid;

TravelHub issues its own Voucher confirming that the service was purchased/booked through TravelHub and is fully paid.

The Voucher is a TravelHub platform document.

It is NOT:

- an airline ticket;
- a hotel voucher;
- a rail ticket;
- a supplier-issued service document;
- a fiscal receipt;
- an invoice;
- a replacement for Seller Partner documentation.

## 2.3 Seller Partner Documents

The Seller Partner remains responsible for service-specific official documents, such as:

- airline tickets;
- hotel vouchers;
- rail tickets;
- tour-operator documents;
- other service-provider documents.

TravelHub Voucher does not replace these documents.

## 2.4 Refund Document

A refund must be represented by a separate TravelHub document.

The Refund Document:

- is linked to the relevant Order / Booking / payment context;
- records refund amount and resulting payment state;
- does not rewrite historical Payment Documents;
- does not rewrite previously issued Voucher versions;
- does not delete historical documents;
- does not automatically become an invoice, fiscal receipt, or Finance Center artifact.

---

# 3. Mandatory Re-Qualification Questions

## RQ-01 — Voucher state machine

The prior report contains a potential semantic drift:

- lifecycle uses `NOT_ISSUED → ISSUED → SUPERSEDED → INVALIDATED`;
- audit metadata later refers to `CURRENT / SUPERSEDED / INVALIDATED`.

Resolve this explicitly.

The final report MUST contain one canonical state model.

Unless repository evidence requires another model, prefer:

`NOT_ISSUED → ISSUED → SUPERSEDED`
and
`ISSUED → INVALIDATED`

Clarify that `ISSUED` means the current active version and that `CURRENT` is not a separate lifecycle state unless technically required.

Provide:

- final enum/state names;
- transition rules;
- terminal states;
- whether historical superseded versions remain downloadable;
- whether invalidated versions remain stored but are not downloadable.

---

# 4. RQ-02 — Partial Payment Document vs actual payment capabilities

Inspect the current Order / Payment schema and constraints.

The previous report states:

- the project currently has a single active payment constraint per Order;
- `PARTIALLY_PAID` exists conceptually;
- real multi-payment/installment behavior is not currently represented.

Re-qualify this carefully.

The final report MUST distinguish:

### A. Current production capability

What the system can actually represent today.

### B. D13 document contract

What the Partial Payment Document is designed to represent.

### C. Multi-payment test evidence

Whether an isolated test scenario with two or more successful payments can be represented without changing production architecture.

Do NOT silently bypass schema constraints.

Do NOT change the production payment model in this re-qualification.

If the existing schema prevents two payments per Order, state this as an explicit gap and explain exactly why.

---

# 5. RQ-03 — Required test fixture / representative purchase

A dedicated representative test purchase SHOULD be prepared for D13 validation, but only in an isolated test database / test fixture.

The intended scenario is:

```text
Order
  ↓
Booking
  ↓
Payment #1 = captured
  ↓
Partial Payment Document
  ↓
Payment #2 = captured
  ↓
Full payment reached
  ↓
Booking confirmed
  ↓
TravelHub Voucher
```

The test case SHOULD have:

- one realistic service;
- one Booking;
- at least two payment events / payment stages;
- a first state where `paidAmount < totalAmount`;
- a final state where `paidAmount >= totalAmount`;
- a corresponding Partial Payment Document;
- a final TravelHub Voucher.

The purpose is to prove the business contract with actual evidence.

### Important constraint

Do NOT alter the production schema merely to manufacture this scenario.

First inspect whether:

- historical Payment records can exist sequentially;
- only one active Payment is prohibited;
- multiple captured Payment records are structurally impossible;
- the existing event model can simulate sequential captured payments.

If a real two-payment fixture is impossible under the current schema, the report MUST say:

> “Representative multi-payment fixture is blocked by current payment model.”

Then provide the smallest non-production test strategy that can validate D13 without changing production scope, for example:

- deterministic event-sequence test;
- test fixture using the existing payment abstraction;
- integration test against a dedicated test-only setup.

The re-qualification MUST NOT invent fake production semantics.

---

# 6. RQ-04 — Voucher issuance dual gate

Re-verify:

```text
BookingConfirmed AND Order.paymentStatus === PAID
```

Confirm that:

- `BookingConfirmed` alone never issues the Voucher;
- `PaymentCaptured` alone never issues the Voucher unless Booking is already confirmed;
- either event can be the second event that satisfies the dual gate;
- duplicate event delivery is idempotent.

Check actual event payloads and current subscriber patterns.

---

# 7. RQ-05 — Full payment definition

Verify the exact authoritative condition.

Current candidate:

```text
Order.paymentStatus === PAID
AND
Order.paidAmount >= Order.amount
```

Confirm:

- source-of-truth fields;
- whether `paidAmount` is cumulative or single-payment amount;
- whether currency consistency is guaranteed;
- whether overpayment is possible;
- whether refunds can make the payment state non-PAID after Voucher issuance.

Do not invent a new payment state machine.

---

# 8. RQ-06 — Refund interaction

Validate the new Refund Document decision.

The final report must explicitly define:

### Partial refund

Example:

```text
Total: 1500
Paid: 1500
Refunded: 500
Net paid: 1000
Remaining due: 500  [ONLY IF BUSINESS MODEL ACTUALLY DEFINES THIS]
```

Do not assume that a refund creates a new debt unless the domain model proves this.

### Full refund

The report must define:

- final payment status;
- Voucher state;
- Refund Document state;
- downloadability of the old Voucher;
- historical retention.

Important:

Do NOT let the re-qualification invent a Finance refund ledger.

Only validate the document/domain boundary.

---

# 9. RQ-07 — Voucher source of truth

Reconfirm:

```text
Booking → Passengers
```

The Voucher MUST NOT source traveler identity from:

- Customer automatically;
- Order.customer;
- Payer.

Confirm that all traveler fields used in the document come from the Booking / Passenger snapshot.

---

# 10. RQ-08 — Snapshot and immutability

Validate:

- versioned documents are immutable;
- document content represents the state at issuance;
- later Booking / Passenger changes do not mutate an already issued binary;
- replacement creates a new version;
- historical versions remain auditable.

Confirm exact fields that are snapshotted.

---

# 11. RQ-09 — Regeneration / replacement

Re-check all proposed regeneration triggers against actual repository capabilities.

Separate:

### Currently executable triggers

from:

### Future triggers requiring events that do not yet exist.

Do not claim that regeneration works if there is no corresponding event or mutation hook.

A V1 implementation may defer regeneration only if the gap is explicit, bounded, and safe.

---

# 12. RQ-10 — Invalidation

Verify actual support for:

- `BookingCancelled`;
- `BookingRejected`;
- manual void.

Define whether:

- the current Voucher becomes INVALIDATED;
- historical binary remains stored;
- download is disabled;
- no automatic replacement is created.

---

# 13. RQ-11 — Idempotency

Verify reuse of the existing InboxEvent pattern.

Prove:

- duplicate BookingConfirmed cannot create duplicate active vouchers;
- duplicate PaymentCaptured cannot create duplicate active vouchers;
- concurrent event delivery is protected;
- generation is atomic enough that no document can be marked ISSUED without the required persisted state.

Do not invent a second deduplication framework.

---

# 14. RQ-12 — Documents domain

Verify the proposed minimal domain:

- `Document`;
- `DocumentVersion`;
- `DocumentTemplate`.

Check whether these abstractions are sufficient for:

- Partial Payment Document;
- TravelHub Voucher;
- Refund Document.

The report MUST explicitly state whether Refund Document uses the same generic document model.

Avoid creating three independent document systems.

---

# 15. RQ-13 — PDF / rendering decision

Re-verify the previous choice:

`@react-pdf/renderer`

Check against actual repository/runtime evidence:

- Node version;
- package management;
- backend build;
- deployment model;
- existing React/TypeScript compatibility;
- Docker/non-Docker runtime;
- dependency and bundle implications.

If the chosen engine remains appropriate, state why.

If not, state the evidence requiring a change.

Do not change dependencies in this gate.

---

# 16. RQ-14 — Storage

Re-verify:

`S3/MinIO via existing ObjectStorageService`

Confirm:

- existing interface;
- upload capability;
- signed read URL;
- current local development storage;
- production assumptions;
- immutable object naming/versioning.

Do not invent a second storage abstraction.

---

# 17. RQ-15 — RBAC and PII

Reconfirm the corrected interpretation:

- ADMIN → full PII;
- OPERATOR → full PII;
- DIRECTOR → redacted;
- FINANCE → redacted;
- ANALYST → redacted;
- SALES_MANAGER → redacted;
- BUYER → own-scope only;
- PARTNER → denied unless an existing explicit contract says otherwise.

The repository function `canViewTravelerPii()` and its tests remain the primary evidence unless stronger canonical authority exists.

Explicitly verify:

- `documents.read`;
- `documents.write`;
- `account.document.read_own`.

Confirm that permission definitions alone are not mistaken for endpoint enforcement.

---

# 18. RQ-16 — Buyer ownership

Prove:

```text
BUYER
 → Customer
 → Order
 → Booking
 → Document
```

Confirm there is no IDOR path where a Buyer can retrieve another customer's document by document ID.

---

# 19. RQ-17 — Financial boundary

Reconfirm that D13 may DISPLAY commercial purchase/payment facts:

- total price;
- amount paid;
- balance;
- currency;
- payment status;
- Order / Booking identifiers.

But D13 MUST NOT introduce:

- general ledger;
- settlement;
- payout accounting;
- tax accounting;
- reconciliation engine;
- Finance Center;
- fiscal registrar;
- invoice engine.

---

# 20. RQ-18 — Document authority wording

The final report must use precise language.

Preferred wording:

> TravelHub Partial Payment Document records the payment state of a purchase through TravelHub.

> TravelHub Voucher confirms that the service was purchased/booked through TravelHub and fully paid, subject to the defined Booking and payment gates.

Neither document is automatically:

- an invoice;
- a fiscal receipt;
- a tax document;
- an airline ticket;
- a hotel voucher;
- a supplier-issued service document.

Do not make unsupported legal claims.

---

# 21. RQ-19 — Historical consistency

Check that the re-qualification does NOT reopen or alter:

- D8 temporal semantics;
- D9;
- D10 partner attribution;
- D11 KPI/status contracts;
- D12 KPI drilldown/routing closure.

D13 must integrate with those contracts, not redefine them.

---

# 22. RQ-20 — Git and scope gate

Verify:

- current HEAD;
- clean working tree;
- no production code changes caused by this re-qualification;
- no Prisma schema changes;
- no migrations;
- no dependency additions;
- no production tests modified.

Documentation-only changes are permitted for the report.

Record exact commit SHA.

---

# 23. Required Re-Qualification Evidence

The final report MUST include evidence for each of the following:

1. Git baseline;
2. current Payment schema and constraints;
3. Booking status/event flow;
4. Payment event flow;
5. Passenger source;
6. RBAC permissions;
7. PII helper/tests;
8. ObjectStorageService;
9. runtime/package environment;
10. InboxEvent idempotency;
11. cancellation/rejection events;
12. current document/account placeholder;
13. the test-fixture feasibility analysis for a purchase with two or more payments.

Use exact file paths, relevant line ranges, code symbols, and/or test names.

---

# 24. Mandatory Output Structure

Create:

`docs/reports/evidence/PHASE_3_D13_VOUCHER_FINAL_REQUALIFICATION.md`

The report MUST contain:

## 1. Executive Verdict

Choose exactly one:

- `READY FOR IMPLEMENTATION`
- `READY WITH EXPLICIT GAPS`
- `ARCHITECTURE DECISION REQUIRED`
- `BLOCKED`

## 2. Re-Qualification Matrix

| Gate | Result | Evidence | Blocking? |
|---|---|---|---|

## 3. Final Canonical Business Model

Document:

- Partial Payment Document;
- TravelHub Voucher;
- Refund Document;
- Seller Partner documents.

## 4. Final State Machine

One canonical lifecycle model only.

## 5. Payment / Multi-Payment Evidence

Explicitly state whether a true two-payment representative fixture is currently possible.

## 6. Final Architecture Decisions

Only decisions that survive re-qualification.

## 7. Explicit Gaps / Debt

Every remaining gap must have:

- description;
- risk;
- why it does not block implementation;
- bounded implementation treatment.

## 8. Security / PII Verification

## 9. Financial Boundary Verification

## 10. Git / Change-Control Verification

## 11. Final Recommendation

State exactly whether implementation may begin.

---

# 25. Hard Stop Conditions

The verdict MUST NOT be `READY FOR IMPLEMENTATION` if any of the following remains unresolved:

- contradictory Voucher states;
- unclear issuance gate;
- undefined Refund Document behavior;
- unsupported PII access model;
- IDOR risk;
- inability to explain the current payment/multi-payment limitation;
- unsupported PDF/storage architecture;
- unclear document ownership/source-of-truth;
- production schema would need to be silently changed to create test evidence;
- the business model would be expanded into Finance.

---

# 26. Test Scenario Recommendation

A representative D13 acceptance dataset SHOULD exist before implementation testing.

Minimum desired scenario:

```text
Customer
  ↓
Order
  ↓
Booking
  ↓
Payment #1
  ↓
Partial Payment Document
  ↓
Payment #2
  ↓
PAID
  ↓
BookingConfirmed
  ↓
TravelHub Voucher
```

Additionally, validate:

```text
PAID
  ↓
Refund
  ↓
Refund Document
  ↓
Voucher remains historical / becomes INVALIDATED only according to the verified refund rule
```

Do not manufacture impossible states in production data.

Prefer an isolated test database / integration fixture.

---

# 27. Final Rule

This run is a **re-qualification gate only**.

Do NOT:

- implement Documents;
- add Voucher models;
- add migrations;
- add PDF dependencies;
- add endpoints;
- modify frontend;
- modify production payment architecture;
- modify Finance.

Stop after producing the final re-qualification report.

The next stage is D13 implementation ONLY if the final verdict authorizes it.
