# PHASE 3 — D13 — VOUCHER
## ARCHITECTURE DECISION & IMPLEMENTATION READINESS GATE

**Document Type:** Architecture / Audit / Readiness Gate  
**Stage:** Phase 3 — D13  
**Scope:** Voucher + Partial Payment Document  
**Mode:** DECISION / READINESS ONLY — NO PRODUCTION IMPLEMENTATION

---

## 1. Purpose

This gate establishes the canonical business and architecture decisions required before production implementation of D13.

D13 is a greenfield capability. The existing baseline establishes that the Documents domain owns `Document / Template / Voucher`, that Voucher is sourced from `Booking → Passengers`, and that Voucher is not yet implemented.

This gate must convert the agreed business model into an explicit, auditable implementation contract without reopening already-closed D10, D11, or D12 and without implementing Finance Center.

### Non-goal

This gate does **not** implement production code.

It must not implement:

- Finance Center;
- Invoice / fiscal receipt / tax accounting as a separate Finance capability;
- airline tickets;
- hotel vouchers;
- supplier/operator service documents;
- replacement of Seller Partner documents by a TravelHub Voucher.

---

# 2. Canonical Business Model — AGREED

## AD-D13-01 — TravelHub Document Model

The following business model is explicitly agreed and must be treated as the baseline for D13 implementation:

### 2.1 Partial Payment Document

When a customer has made a partial payment for a purchased/booked service, TravelHub provides a **Partial Payment Document**.

The document must communicate the financial state of the purchase, including at minimum:

- the service;
- the total service price;
- the amount already paid;
- the remaining amount due;
- currency;
- the related Order / Booking identity;
- payment status;
- document date/number where supported by the existing architecture.

This document is **not** the final TravelHub Voucher.

### 2.2 TravelHub Voucher

After the service has been fully paid and the Booking satisfies the canonical confirmation condition, TravelHub issues its own **TravelHub Voucher**.

The TravelHub Voucher is a platform-generated document confirming that the service was purchased/booked through TravelHub and is fully paid.

At minimum it should be able to represent:

- the service;
- the relevant Booking / Order identifiers;
- the travelers/passengers associated with the Booking;
- service date/time and other frozen Booking context supported by the canonical contract;
- total amount;
- paid amount;
- remaining amount (`0` after full payment);
- currency;
- voucher/document identity and issue metadata.

### 2.3 Seller Partner Service Document

The Seller Partner remains responsible for the official service document where applicable, for example:

- airline ticket;
- hotel voucher;
- rail ticket;
- transfer confirmation;
- tour/operator voucher;
- other supplier-specific service document.

The TravelHub Voucher **does not replace** the Seller Partner document and is not itself an airline ticket, hotel voucher, or other supplier-issued service document.

### 2.4 Separation of Responsibilities

The canonical responsibility split is:

`Customer → purchases service → partial payment (optional) → Partial Payment Document`

`Customer → completes payment → Booking confirmed → TravelHub issues TravelHub Voucher`

`Seller Partner → separately issues/provides service-specific document`

The D13 implementation must preserve this separation.

---

# 3. Evidence Baseline to Verify

Before accepting readiness, inspect and cite the current repository/Git state and the canonical project evidence.

At minimum verify:

1. D12 is closed and the working tree is clean.
2. D13 is currently the TRUE NEXT stage.
3. The Documents domain ownership of Voucher.
4. Canonical Voucher source:
   `Voucher ← Booking → Passengers`
   and explicitly **not** `Customer`, `Order.customer`, or `Payer` as traveler source.
5. Canonical Booking/payment lifecycle position.
6. Existing Booking confirmation event(s).
7. Existing payment status/events and the actual repository implementation relevant to payment completion.
8. Existing Passenger/Traveler completeness rules.
9. Existing RBAC permissions:
   `documents.read`,
   `documents.write`,
   `account.document.read_own`.
10. Existing `canViewTravelerPii()` semantics and any conflicting D13 evidence.
11. Existing Document / Template / storage / PDF / rendering infrastructure, if any.
12. Existing event inbox/idempotency patterns that can be reused.
13. Existing cancellation/rejection/completion events.
14. Existing frontend account/document surfaces and API placeholders.

**Evidence rule:** do not infer that infrastructure exists merely because the architecture document mentions it. Verify the repository.

---

# 4. Architecture Decisions Required Before Implementation

The implementation agent must produce an explicit decision record for each item below.

## AD-D13-02 — Voucher Issuance Condition

Resolve and document the exact condition for final TravelHub Voucher issuance.

Baseline business agreement:

> Full payment is required before final TravelHub Voucher issuance.

The agent must additionally prove how this combines with `BookingConfirmed`.

Do not assume that an event named `BookingConfirmed` alone proves payment completion.

Document:

- authoritative payment state;
- authoritative Booking state;
- event ordering;
- whether both conditions must be true;
- how retries/races are handled;
- what happens when Booking is confirmed before full payment;
- what happens when payment completes after Booking confirmation.

---

## AD-D13-03 — Partial Payment Document Issuance

Define the exact trigger for the Partial Payment Document.

The implementation must distinguish:

- unpaid;
- partially paid;
- fully paid.

Document whether the Partial Payment Document is:

- generated once per payment;
- regenerated for each payment state change;
- versioned;
- replaced by a later version;
- retained as an immutable historical document.

Do not invent a financial ledger. Reuse the existing payment source of truth.

---

## AD-D13-04 — Voucher Lifecycle

Define the authoritative lifecycle.

The scope audit contained a proposed lifecycle, but that proposal was explicitly not confirmed. Therefore the agent must validate the repository and then state the final lifecycle contract.

At minimum address:

- issued;
- replaced/reissued, if supported;
- invalidated/void, if supported.

For every state define:

- entry condition;
- exit condition;
- user-visible meaning;
- whether the document remains downloadable;
- whether a newer version supersedes it.

---

## AD-D13-05 — Versioning and Immutability

Define:

- version numbering;
- immutable published versions;
- current/superseded version semantics;
- replacement rules;
- invalidation rules;
- audit metadata.

Baseline architecture principle:

> Published document versions are immutable; a correction creates a new version.

Do not mutate an already issued published document in place.

---

## AD-D13-06 — Regeneration / Replacement Triggers

Identify only triggers that are actually supported by the current Booking domain.

Candidates to verify:

- traveler/passenger data correction;
- service date/time change;
- supplier/service change;
- other material Booking changes.

For every accepted trigger specify:

`source event → old version state → new version action → resulting current version`.

Do not invent mutation events that do not exist.

---

## AD-D13-07 — Invalidation Triggers

Verify how the system represents:

- Booking cancellation;
- Booking rejection;
- other states that make the document no longer valid;
- manual void, if a supported operational action exists.

Define whether invalidation means:

- status change only;
- immutable invalidated version;
- new replacement document;
- download restriction.

---

## AD-D13-08 — Idempotency

Voucher generation must be safe under duplicate event delivery and retries.

Verify and reuse the existing event/inbox/deduplication pattern where possible.

At minimum establish:

- idempotency key;
- uniqueness boundary;
- behavior on duplicate `BookingConfirmed`;
- behavior on duplicate successful-payment processing;
- transaction boundaries;
- concurrent generation behavior.

The agent must not create an unrelated bespoke idempotency system if an established project pattern exists.

---

## AD-D13-09 — Source-of-Truth Data Contract

Freeze the source of each Voucher field.

Canonical traveler source:

`Booking → Passengers`

Do not silently substitute:

- Customer;
- Order.customer;
- Payer.

For each field classify:

- source entity;
- snapshot vs live lookup;
- PII/non-PII;
- required/optional;
- formatting rules.

The Voucher must represent the Booking state for which it was issued, not an accidental later live view.

---

## AD-D13-10 — Passenger / Traveler Completeness

Verify the actual traveler completeness gate and its interaction with Voucher generation.

The agent must determine:

- whether incomplete passengers block issuance;
- what completeness level is sufficient;
- whether requirements differ by product type;
- what happens when traveler data is corrected after issuance.

Do not bypass existing traveler data completeness rules.

---

## AD-D13-11 — Documents Domain Integration

Voucher must remain owned by the Documents domain.

Verify whether an existing `Document` / `Template` abstraction exists in code.

Decision order:

1. reuse existing infrastructure;
2. extend existing infrastructure minimally;
3. only if absent, define the smallest new abstraction required.

Do not create a parallel document subsystem without evidence.

---

## AD-D13-12 — Rendering / PDF Engine

Inspect repository dependencies, runtime, Docker image, build environment, and deployment assumptions before choosing a renderer.

Evaluate only options justified by actual project constraints.

Possible technologies may include browser-based or library-based PDF generation, but the agent must not choose one by preference alone.

Decision must state:

- selected engine;
- why it fits;
- runtime/container requirements;
- operational risks;
- testability;
- whether it works in the existing deployment model.

---

## AD-D13-13 — Template Format

Inspect whether the repository already contains a template mechanism.

If absent, select the smallest maintainable format compatible with the chosen renderer.

Document:

- template ownership;
- versioning;
- placeholders/data binding;
- escaping/sanitization;
- styling strategy;
- localization implications if applicable.

---

## AD-D13-14 — Storage

Inspect existing storage patterns first.

Decision must explicitly state:

- where generated documents are stored;
- whether metadata and binary content are separated;
- retention expectations;
- retrieval path;
- deletion/invalidation behavior;
- local-dev vs production behavior.

Do not introduce a storage technology without checking existing project conventions.

---

## AD-D13-15 — Access Control

Verify and wire the existing permission model conceptually before implementation.

Existing permissions to verify:

- `documents.read`;
- `documents.write`;
- `account.document.read_own`.

Define access at minimum for:

- platform/operator users;
- buyer/customer own documents;
- partner users;
- other roles according to existing RBAC contract.

Preserve least privilege.

### Mandatory conflict resolution

The D13 scope audit identified a potential semantic conflict:

- `canViewTravelerPii()` reportedly allows full traveler PII only for `OPERATOR` and `ADMIN`;
- another D13 evidence table appeared to grant broader full-PII visibility to roles such as `DIRECTOR`, `FINANCE`, `ANALYST`, and `SALES_MANAGER`.

This conflict must be explicitly resolved from current source-of-truth code and authorization rules before implementation.

Do not implement based on the conflicting table without resolution.

---

## AD-D13-16 — Buyer Own-Scope

Define and prove how a buyer using `account.document.read_own` is mapped to the Booking/Voucher.

The agent must show the ownership chain in code/data.

Do not grant access based solely on document ID existence.

---

## AD-D13-17 — Partner Access

Current baseline indicates Partner document access is restricted.

Verify whether Seller Partner should:

- have no direct access to TravelHub Voucher;
- have limited read access;
- or have another explicitly authorized scope.

Do not expand partner access without evidence.

---

## AD-D13-18 — Financial Information Boundary

TravelHub Voucher and Partial Payment Document may display commercial payment information:

- total price;
- paid amount;
- balance due;
- currency;
- payment status.

However, D13 must not silently become Finance Center.

Do not introduce:

- general ledger;
- accounting reconciliation;
- tax accounting;
- payout accounting;
- settlement engine;
- fiscal receipt infrastructure;

unless already present and explicitly required by the canonical code contract.

The existing payment source remains authoritative.

---

## AD-D13-19 — Legal / Document Authority Boundary

For this stage, the business requirement is intentionally limited to:

- Partial Payment Document for partial payment state;
- TravelHub Voucher after full payment and Booking confirmation.

Do not declare the document an invoice, fiscal receipt, tax invoice, airline ticket, hotel voucher, or supplier document unless current project/legal requirements explicitly establish that classification.

The decision record must state exactly what the document claims to represent.

---

## AD-D13-20 — Auditability

Define immutable audit metadata sufficient to answer:

- which Booking produced the document;
- which document version was issued;
- when it was issued;
- which event/process caused issuance;
- which template version was used;
- whether it is current, superseded, or invalidated;
- who/what initiated a manual action, if manual actions exist.

---

## AD-D13-21 — Failure and Recovery Model

Define expected behavior for:

- rendering failure;
- storage failure;
- duplicate event;
- missing passenger data;
- missing payment completion;
- Booking cancellation during generation;
- concurrent replacement;
- corrupted/missing binary;
- retry after partial transaction success.

Do not silently mark a document issued unless the persistence and document state are consistent.

---

# 5. Required Repository Investigation

The agent must inspect the actual source tree and provide evidence for:

```text
Booking
Passengers / Travelers
Payment
Payment status/events
BookingConfirmed
BookingCancelled
BookingRejected
Document
Template
Voucher
RBAC permissions
canViewTravelerPii()
account.document.read_own
event inbox / idempotency patterns
storage
PDF / renderer dependencies
frontend account/documents
API routes
tests
```

Use code/commit evidence, not assumptions.

---

# 6. Explicit Non-Regression Boundaries

D13 must not reopen:

- D8 temporal semantics;
- D9 completed baseline;
- D10 Partner Performance;
- D11 Orders & Bookings Overview / KPI semantic contract;
- D12 KPI Drilldowns / cross-page routing;
- existing Finance deferral.

Any required change outside D13 scope must be documented as a dependency/debt item, not silently included.

---

# 7. Required Deliverable

Create:

`docs/reports/evidence/PHASE_3_D13_VOUCHER_ARCHITECTURE_DECISION_READINESS.md`

The report must contain:

1. Executive decision summary.
2. Verified repository evidence.
3. Business model confirmation.
4. A decision table for `AD-D13-01` through `AD-D13-21`.
5. Data/source-of-truth matrix.
6. Lifecycle/state machine.
7. Versioning model.
8. Event/trigger matrix.
9. RBAC matrix.
10. PII/security decision.
11. Rendering/storage decision.
12. Failure/idempotency model.
13. Explicit out-of-scope boundaries.
14. Open gaps, if any.
15. Final readiness verdict.

---

# 8. Final Readiness Verdict

Use exactly one of:

### READY FOR IMPLEMENTATION

All required architecture decisions are resolved, evidenced, internally consistent, and implementable without introducing speculative architecture.

### READY WITH EXPLICIT GAPS

Implementation can begin only with clearly enumerated non-blocking gaps whose behavior is already safely constrained.

### ARCHITECTURE DECISION REQUIRED

One or more material business/security/architecture decisions remain unresolved.

### BLOCKED

A dependency or source-of-truth contradiction prevents safe implementation.

The report must explain the verdict with evidence.

---

# 9. Git / Change Control Gate

For this readiness task:

- do not modify production application code;
- do not modify database schema;
- do not add dependencies;
- do not alter tests except where needed to document existing evidence, and preferably make no test changes;
- documentation changes must be limited to the readiness artifact and any explicitly necessary evidence documentation;
- commit only documentation changes if the project workflow requires a commit;
- report exact commit SHA and clean/dirty status;
- prove that no unrelated files changed.

---

# 10. Stop Condition

After creating the readiness report and recording the final verdict:

**STOP.**

Do not implement D13 in the same run.

Implementation begins only after the readiness gate is accepted.
