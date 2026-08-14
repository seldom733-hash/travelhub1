# PHASE 2 — STEP 2.13A — CHARGEBACK / DISPUTE FOUNDATION — STRICT REVIEW

## 0. ROLE

You are performing an **independent adversarial STRICT REVIEW** of:

**PHASE 2 — STEP 2.13A — CHARGEBACK / DISPUTE FOUNDATION**

Do **not** trust the implementation report, previous assistant conclusions, Roadmap status markers, comments, or claimed test counts as proof.

The repository, migrations, schema, production code, tests, RBAC matrix, event contracts, and runtime behavior are the source of truth.

Your job is to determine whether Step 2.13A is actually correct, complete, internally consistent, race-safe, and strictly limited to its approved provider-neutral foundation scope.

You may fix defects found during review, but only when the correct behavior follows unambiguously from existing architecture/contracts. If a fix requires inventing business semantics, STOP and report:

`ARCHITECTURE DECISION REQUIRED`

Do **not** start Step 2.12A–G, 2.14+, or any other NEXT step.

---

# 1. EXPECTED BASELINE — VERIFY, DO NOT ASSUME

The implementation report claims:

- Step 2.13 is already approved.
- Step 2.13A implementation is complete and waiting for strict review.
- Finance foundations 2.10–2.10C, pricing snapshot 2.11, Payment 2.12, Refund 2.13 are already present.
- 2.12A–G remain intentionally NOT STARTED later extensions.
- Step 2.13A is **provider-neutral**.
- `Dispute` is the only new business entity; “chargeback” is not a second aggregate.
- source authority is a CAPTURED Payment.
- one active Dispute per Payment.
- lifecycle is `OPENED -> RESOLVED | CANCELLED`.
- no PSP/webhook, ledger posting, commission, settlement/payout, invoice, Order projection, Payment mutation, Refund mutation, Booking/Availability mutation.
- migrations claimed: 54/54.
- claimed regression baseline: backend unit 547/547, serial e2e 1105/1105, frontend 135/135.

Verify all of this from the repository before relying on it.

Record:

- current branch;
- HEAD;
- origin relationship;
- working-tree state;
- migration count/status;
- Prisma drift;
- exact Roadmap status;
- whether unrelated uncommitted changes exist.

Do not destroy or overwrite unrelated work.

---

# 2. SOURCES TO INSPECT

At minimum inspect:

- authoritative Roadmap v3:
  - Step 2.13A;
  - Step 2.13;
  - Steps 2.12A–G;
  - Step 2.14+ dependencies;
  - reconciliation notes / dependency analysis;
- `backend/prisma/schema.prisma`;
- Step 2.13A migration SQL;
- all finance Dispute production files;
- `PaymentService`;
- `RefundService`;
- `SettlementService`;
- `LedgerService`;
- Finance controller/module/DTO/validation files;
- RBAC constants / permission seeding;
- event bus / outbox / inbox implementation;
- audit logging implementation;
- ID generation and `ids.md`;
- `api.md`;
- `events.md`;
- Step 2.13A architecture document;
- Step 2.13A implementation report;
- all Dispute e2e/unit tests;
- relevant Payment/Refund/Finance/temporal tests;
- global e2e setup / migration replay harness.

Perform repo-wide searches for:

`Dispute`, `Chargeback`, `DSP-`, `isActiveDispute`, `openedAt`, `resolvedAt`,
`finance.dispute`, `DisputeOpened`, `DisputeResolved`, `DisputeCancelled`,
`payment.update`, `refund.update`, `ledgerTransaction.create`,
`commission`, `settlement`, `payout`, `webhook`, provider-specific names,
and all direct/raw SQL affecting finance entities.

---

# 3. TERMINOLOGY HARD GATE

Independently determine whether the implementation is justified in modeling:

- one aggregate: `Dispute`;
- “chargeback” as vocabulary/context rather than a separate persisted aggregate.

Do not accept this merely because the implementation report says so.

Check Roadmap, existing architecture docs, API vocabulary, event vocabulary, Screen Design if present, and dependency reconciliation.

FAIL if the implementation collapsed two clearly distinct required aggregates.

Also FAIL if it invented a separate Chargeback lifecycle that was not authorized.

If the sources are genuinely ambiguous and choosing one model affects future compatibility:

`ARCHITECTURE DECISION REQUIRED`

---

# 4. OWNERSHIP / WRITE-PATH AUDIT — HARD GATE

Find **every production writer** to:

- `Dispute`;
- `DisputeHistory`;
- Dispute milestone fields;
- `isActiveDispute`.

Expected ownership:

`DisputeService` is the sole business writer.

Search for:

- `.create`;
- `.update`;
- `.updateMany`;
- `.upsert`;
- `.delete`;
- `.deleteMany`;
- `$executeRaw`;
- `$queryRaw`;
- seed scripts;
- cron/jobs;
- consumers/subscribers;
- test-only helpers accidentally imported into production.

Confirm there are no cross-domain writers.

Any undocumented second production authority is a HARD FAIL unless it is clearly infrastructure-only and contractually justified.

---

# 5. SOURCE AUTHORITY — CAPTURED PAYMENT

Prove from code/runtime that a Dispute can only be opened against an eligible Payment.

Expected rule:

`Payment.status === CAPTURED`

Test at least:

- CAPTURED → allowed;
- PENDING → rejected;
- FAILED → rejected;
- CANCELLED → rejected;
- unknown Payment → controlled 404/appropriate hidden-resource behavior;
- inaccessible Payment / tenant-owner boundary if applicable.

Verify that the Dispute path does **not** turn `AUTHORIZED`, `REFUNDED`, or other reserved Payment vocabulary into reachable runtime states.

Do not assume enum presence means runtime reachability.

---

# 6. FROZEN MONEY AUTHORITY

Verify:

- `orderId` is server-derived from Payment;
- `currency` is server-derived verbatim from Payment;
- client cannot forge either;
- Dispute does not re-read mutable Product/Catalog/Tax/FX data;
- no repricing occurs;
- amount uses the canonical Decimal money contract;
- no JS float is financial authority;
- `0 < amount <= payment.amount`;
- overflow/scale rules are controlled.

Inspect exact Prisma Decimal types and validation.

Test forged server-owned fields → explicit controlled validation error, not silent stripping.

---

# 7. REFUND INTERACTION — CRITICAL SCOPE GATE

The implementation claims Dispute amount is bounded by captured Payment amount **without netting Refunds**, because monetary netting/liability semantics are deferred.

Independently verify that this is truly the authorized 2.13A foundation contract.

Search for any hidden calculation such as:

- Payment amount minus Refunds;
- refundedAmount subtraction;
- available dispute balance;
- chargeback net exposure;
- refund cancellation caused by Dispute.

Expected foundation behavior, if supported by authoritative docs:

- Dispute does not mutate Refund;
- Refund does not mutate Dispute;
- no monetary netting is invented;
- overlapping Refund + Dispute is either explicitly allowed as a foundation limitation or explicitly rejected according to documented contract.

There MUST be an e2e test proving the chosen restriction/behavior.

If actual product semantics require netting but the authoritative sources do not define it, do not invent the rule:

`ARCHITECTURE DECISION REQUIRED`

---

# 8. CARDINALITY — ONE ACTIVE DISPUTE PER PAYMENT

Audit the actual DB invariant and application behavior.

Expected:

- at most one active Dispute for a Payment;
- terminal `RESOLVED` / `CANCELLED` frees the active slot;
- a later Dispute attempt is possible after terminal state;
- uniqueness is scoped to Payment, not `(paymentId, amount)`.

Inspect:

- `isActiveDispute`;
- partial unique index SQL;
- transition code that clears active status;
- migration replay behavior.

Test:

1. first active Dispute succeeds;
2. second active Dispute fails/no-ops only if contractually identical semantics justify it;
3. after RESOLVED, a new Dispute can be created;
4. after CANCELLED, a new Dispute can be created;
5. active disputes with different amounts still conflict;
6. DB backstop prevents bypass.

Pay special attention to whether “identical retry” is distinguishable from “new dispute attempt.” If no explicit idempotency key exists, verify that current behavior is documented and does not silently destroy future attempt semantics.

---

# 9. CONCURRENT CREATE — HIGH-RISK GATE

Run real concurrent requests against the same Payment.

Required cases:

### Case A — same payload
Two simultaneous creates for the same Payment.

Expected invariant:

- at most one active row;
- no raw 500;
- result semantics are controlled and documented.

### Case B — divergent amount
Two simultaneous creates with different amounts.

Expected:

- exactly one active fact;
- loser receives controlled conflict/validation response;
- never silent success returning a row with a different payload;
- never raw P2002/500.

### Case C — divergent other accepted business payload
If reason/category/type is persisted and materially part of the fact, race two divergent values.

A divergent replay MUST NOT silently return an incompatible existing fact unless the contract explicitly defines those fields as non-idempotency metadata.

This is the same class of defect previously found in Ledger strict review; audit it explicitly.

---

# 10. IDEMPOTENCY SEMANTICS

Determine the actual idempotency contract from code, not from assumptions.

If create catches P2002 and returns an existing Dispute, compare material business payload.

Verify whether these fields should be compared:

- amount;
- currency;
- paymentId;
- reason/category/type;
- provider-neutral external/business reference if present.

Correlation/causation/actor metadata generally should not redefine business identity unless architecture explicitly says otherwise.

Unknown P2002 must become a controlled conflict, not be swallowed as idempotent success.

Add unit coverage if missing.

---

# 11. LIFECYCLE STATE MACHINE

Expected foundation lifecycle:

`OPENED -> RESOLVED`
`OPENED -> CANCELLED`

Audit exact transition table / command mapping.

Reject:

- OPENED → OPENED rewrite;
- RESOLVED → anything;
- CANCELLED → anything;
- RESOLVED ↔ CANCELLED;
- nonexistent “won/lost” semantics unless authorized;
- provider-specific lifecycle states;
- Payment status mutation as a side effect.

Every invalid transition must produce controlled domain/API behavior, not raw 500.

---

# 12. CAS / OPTIMISTIC CONCURRENCY

Inspect transition implementation.

Expected pattern:

- from-status guard;
- version or equivalent CAS predicate;
- status + milestone + active-slot release in one atomic transaction/update;
- history/outbox created consistently with the winning transition.

Run races:

- resolve/resolve;
- resolve/cancel;
- cancel/cancel.

Prove:

- one transition wins;
- terminal truth is deterministic;
- loser is controlled;
- no duplicate terminal history/event;
- no raw 500.

---

# 13. TEMPORAL CONTRACT

Audit:

- `openedAt`;
- `resolvedAt`;
- `cancelledAt`.

Expected:

- server-owned;
- UTC instants;
- first-only;
- atomically written with corresponding lifecycle transition;
- no client forging;
- no rewrite on retry;
- no fabricated backfill.

For born-OPENED creation, verify `openedAt` corresponds truthfully to creation semantics.

Check temporal ordering:

- `openedAt <= resolvedAt` when resolved;
- `openedAt <= cancelledAt` when cancelled.

Do not require mutually exclusive historical timestamps if a legitimate architecture could preserve history—but for this simple terminal state machine, verify actual reachable combinations.

---

# 14. PAYMENT MUST REMAIN PAYMENT AUTHORITY

Repo-wide prove that Dispute does NOT mutate:

- `Payment.status`;
- Payment milestones;
- Payment amount/currency;
- `isActivePayment`;
- Payment history.

In particular:

- do not invent `DISPUTED` Payment state;
- do not use reserved `REFUNDED` Payment state;
- CAPTURED Payment remains CAPTURED after Dispute operations unless an existing explicit contract says otherwise.

Add/verify e2e assertion.

---

# 15. REFUND MUST REMAIN REFUND AUTHORITY

Prove Dispute does NOT:

- create Refund;
- approve/process/fail Refund;
- change Refund milestones;
- change `isActiveRefund`;
- change Refund amount;
- reinterpret Refund lifecycle.

Likewise verify Refund code does not newly write Dispute as a hidden side effect.

---

# 16. ORDER / BOOKING / AVAILABILITY ISOLATION

The implementation claims zero projections.

Verify Dispute operations do not mutate:

- `Order.paymentStatus`;
- `Order.paidAmount`;
- `Order.refundedAmount`;
- other Order fields;
- Booking status/money/milestones;
- availability reservations/counters;
- Product/Catalog state.

Snapshot counts/fields before and after lifecycle.

Any new projection must have an explicit existing contract and domain-owned subscriber; otherwise FAIL.

---

# 17. LEDGER BOUNDARY

Step 2.10A established Ledger as append-only but Step 2.13A must not invent automatic posting.

Prove Dispute create/resolve/cancel causes:

- zero new `LedgerTransaction`;
- zero Ledger writer call;
- zero reversal posting;
- zero balance calculation.

Search both direct writes and event consumers.

---

# 18. PROVIDER FEE / SETTLEMENT / PAYOUT BOUNDARY

Prove Dispute lifecycle causes zero:

- ProviderFee;
- Settlement;
- Payout;
- mutations of existing records in those domains.

No settlement adjustment or payout hold/reversal may be invented here.

Those semantics belong to later explicit steps.

---

# 19. COMMISSION / INVOICE BOUNDARY

Prove zero:

- Commission;
- CommissionAccrual;
- invoice mutation/creation;
- commission reversal;
- fee allocation.

No hidden implementation of 2.12C/E or 2.14+.

---

# 20. PSP / WEBHOOK BOUNDARY — HARD GATE

Repo-wide search for provider-specific or webhook implementation added by 2.13A.

Expected:

- no Stripe/Adyen/etc. chargeback API;
- no webhook route;
- no signature verification;
- no provider event mapping;
- no external dispute ID requirement unless it is merely neutral optional provenance explicitly authorized;
- no PSP credentials/secrets;
- no automatic provider synchronization.

Real PSP chargeback handling is dependent on later prerequisites (2.12A/2.12B per reconciliation).

If provider-specific runtime was added here, FAIL scope containment.

---

# 21. 2.12A–G SCOPE CONTAINMENT

Explicitly prove Step 2.13A did not accidentally implement:

- 2.12A PSP adapter/provider integration;
- 2.12B webhook/provider payment lifecycle;
- 2.12C commission semantics;
- 2.12D ledger posting;
- 2.12E commission accrual/reversal;
- 2.12F partial Payment semantics;
- 2.12G provider fee granularity / `feeType`.

Document each as PASS/FAIL with concrete repo evidence.

---

# 22. EVENTS

Inspect the claimed events:

- `DisputeOpened`;
- `DisputeResolved`;
- `DisputeCancelled`.

Verify:

- names match project conventions;
- envelope follows canonical event contract;
- payload contains only necessary identifiers/business-safe fields;
- no PII;
- no secrets;
- exactly one event per real state change;
- no event on failed transition;
- no duplicate event on idempotent/no-op path;
- event/outbox write is transactionally consistent with aggregate mutation;
- there are truly zero consumers if docs claim zero consumers.

If there are no consumers, ensure docs do not claim side effects that cannot occur.

---

# 23. AUDIT LOG

Verify audit actions use canonical snake_case naming, e.g. project convention such as:

`finance.dispute.created`
`finance.dispute.resolved`
`finance.dispute.cancelled`

Do not blindly assume exact names; compare to actual Finance conventions.

Audit payload must be minimal and PII-free.

Check previous 2.10B defect class: accidental `toLowerCase()` producing non-snake-case action names.

---

# 24. HISTORY

Inspect `DisputeHistory`.

Verify:

- created for real lifecycle facts only;
- no duplicate history on replay;
- status/action values are coherent;
- actor/correlation metadata follows project conventions;
- no PII;
- history cannot become an independent lifecycle authority;
- no public mutation surface.

---

# 25. RBAC — VERIFY ACTUAL MATRIX

Do not trust docs.

Determine actual grants from `ROLE_PERMISSIONS`.

Expected implementation claim:

Read:
- FINANCE
- DIRECTOR
- ANALYST
- SALES_MANAGER
- ADMIN

Write:
- FINANCE
- ADMIN

Verify actual permission names:

- `finance.dispute.read`
- `finance.dispute.write`

Check auto-seeding/update behavior.

Test:

- anonymous → 401;
- unauthorized authenticated roles → 403;
- allowed read roles → success;
- write only FINANCE/ADMIN;
- non-owner/resource-hiding semantics if applicable → correct 404/403 according to established architecture.

Cross-check `api.md`, architecture doc, Roadmap, implementation report against actual matrix. Fix docs if stale.

---

# 26. MASS ASSIGNMENT

Attempt to forge all server-owned fields, including at minimum:

- code/id;
- paymentId if source is route/server-derived;
- orderId;
- currency;
- status;
- isActiveDispute;
- version;
- openedAt;
- resolvedAt;
- cancelledAt;
- createdAt;
- actor/correlation/causation fields.

Ensure validation occurs against raw request body where necessary so ValidationPipe whitelist does not silently strip forged keys before the forbidden-key check.

Expected explicit controlled 422 per existing project convention.

---

# 27. READ API

Audit list/detail endpoints:

- pagination;
- page/pageSize bounds;
- invalid numeric strings;
- filter whitelist;
- status filter;
- payment/order filters if exposed;
- stable ordering;
- resource visibility;
- unknown code/id → controlled 404;
- no PII leakage;
- Decimal serialization as string.

Test at least:

- `page=0`;
- `page=abc`;
- `pageSize=0`;
- `pageSize=101` or project max+1;
- unknown filter values;
- unknown Dispute.

Avoid accepting arbitrary Prisma filter/sort objects from the client.

---

# 28. IDENTIFIERS

Verify:

- `DSP-########`;
- generated by canonical `IdsService`;
- sequence allocation occurs in same transaction as create;
- docs/contracts/ids.md registration exists;
- no alternative/manual code generator;
- collision becomes controlled behavior.

Do not require gapless sequences.

---

# 29. MIGRATION REVIEW

Inspect actual Step 2.13A SQL.

Expected additive migration:

- Dispute enum(s) if required;
- `Dispute`;
- `DisputeHistory`;
- indexes/uniques;
- partial unique for active Payment slot;
- no destructive ALTER of existing Finance/Payment/Refund tables unless strictly required and already contractually approved;
- no fabricated backfill.

Verify:

- migration deploy on clean DB;
- migration status;
- schema/live diff = no difference.

Do not use `prisma db push`.

---

# 30. FRESH REPLAY

Confirm e2e global setup actually:

- drops/recreates test DB or otherwise starts clean;
- executes real migration files via `migrate deploy`;
- does not bypass migration history with `db push`.

Full serial e2e from fresh DB is required evidence.

---

# 31. SCHEMA EVOLUTION / TEMPORAL READINESS TESTS

Inspect older tests that assert absence/presence of finance models or milestone fields.

Any updates made for 2.13A must be legitimate contract evolution, not weakening.

Specifically ensure:

- Dispute milestones are now expected only where authorized;
- Payment/Refund temporal contracts are not accidentally loosened;
- deferred lifecycle fields remain absent elsewhere.

Document every modified old assertion and why it is legitimate.

---

# 32. ERROR NORMALIZATION

Audit all expected DB/domain errors:

- duplicate active Dispute;
- unknown P2002;
- CAS loss;
- invalid transition;
- invalid Payment state;
- amount overflow/invalid Decimal;
- unknown resource.

Expected: controlled 4xx/domain errors.

Raw Prisma errors / raw 500 for expected business races are FAIL.

Unit-test unknown P2002 path if not already covered.

---

# 33. CONCURRENCY MATRIX

At minimum execute and document:

1. create/create identical;
2. create/create divergent amount;
3. create/create divergent reason/category if applicable;
4. resolve/resolve;
5. cancel/cancel;
6. resolve/cancel;
7. terminal transition racing with second create where timing permits.

For #7, determine valid outcomes from DB invariants:

- never two active Disputes;
- terminal first may free slot allowing a legitimate next attempt;
- create first may conflict while old dispute remains active;
- no impossible lifecycle/history combination;
- no raw 500.

Do not write brittle tests that assume a scheduler order.

---

# 34. ACTIVE-SLOT RELEASE ATOMICITY

High-risk check:

When resolving/cancelling, `status`, terminal milestone, and `isActiveDispute=false` must become true atomically.

There must be no externally observable committed state such as:

- RESOLVED + active=true;
- CANCELLED + active=true;
- OPENED + active=false due to partial transition.

Inspect exact Prisma transaction/update.

---

# 35. EVENT / HISTORY ATOMICITY

Determine the project’s established atomicity guarantee.

Verify winning transition cannot commit aggregate state while silently omitting required history/outbox due to transaction separation.

If event bus uses transaction-scoped outbox, prove it.

If AuditLog is intentionally outside domain transaction by architecture, distinguish it from canonical domain history/event facts rather than inventing stronger guarantees.

---

# 36. PROVENANCE

Inspect correlation/causation/actor behavior.

Expected project convention:

- server-authoritative;
- HTTP cannot forge;
- ALS/context derived;
- absent context may be NULL if established by ADR;
- no provider metadata masquerading as actor identity.

Ensure provenance differences do not accidentally turn a true retry into divergent business payload unless explicitly intended.

---

# 37. SECURITY / PII

Dispute reason/category may become sensitive depending on design.

Inspect what is actually persisted and returned.

Verify:

- no passport/payment credentials/bank details;
- no PSP secrets;
- no arbitrary evidence blob if evidence handling is deferred;
- no raw request body in AuditLog/Event payload;
- no unsafe free-form PII echo into event bus.

If free-text reason is accepted, determine whether existing contract authorizes it and whether output/audit/event treatment is safe.

---

# 38. API CONTRACT CONSISTENCY

Cross-check actual runtime against:

- `docs/contracts/api.md`;
- architecture doc;
- Roadmap;
- implementation report.

Verify:

- routes;
- request fields;
- response fields;
- status vocabulary;
- Decimal string behavior;
- permissions;
- error codes;
- deferred boundaries.

Fix documentation-only mismatches when semantics are unambiguous.

---

# 39. EVENT CONTRACT CONSISTENCY

Cross-check `events.md` against actual emitted events.

Verify:

- exact event names;
- producer;
- payload;
- consumers = none if truly none;
- no false claim that Payment/Order/Ledger changes because of Dispute.

---

# 40. ROADMAP CONSISTENCY

Do not mark 2.12A–G complete.

Do not remove reconciliation prerequisites.

If Strict Review passes:

set Step 2.13A to one of:

- `STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`
- `STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

Only after all hard gates and regression are green.

Determine NEXT from the **actual reconciled Roadmap**, not numerical guessing.

Do not start NEXT.

---

# 41. STOP-CONDITIONS — ARCHITECTURE DECISION REQUIRED

STOP rather than invent semantics if review discovers that correctness requires deciding any unresolved issue such as:

- Dispute vs Chargeback must actually be separate aggregates;
- provider-specific dispute/chargeback lifecycle;
- won/lost liability semantics;
- evidence/document lifecycle;
- Refund-vs-Dispute monetary netting;
- multiple simultaneous disputes per Payment;
- partial chargeback exposure accounting;
- automatic Payment status mutation;
- automatic Order projection;
- Ledger posting/reversal;
- Commission reversal;
- Settlement/Payout adjustment;
- provider fee allocation;
- real PSP webhook semantics;
- bank/payment credentials;
- double-entry/balance behavior.

Report exactly:

`ARCHITECTURE DECISION REQUIRED`

with the conflicting evidence and the smallest decision needed.

Do not implement speculative behavior.

---

# 42. REQUIRED NEGATIVE E2E MATRIX

Ensure real e2e coverage includes at minimum:

- anonymous create/read;
- forbidden roles;
- invalid Payment state;
- unknown Payment;
- amount = 0;
- negative amount;
- amount > Payment.amount;
- invalid Decimal/scale/overflow;
- forged server-owned fields;
- second active Dispute;
- invalid terminal transitions;
- terminal re-transition;
- public PATCH/DELETE surfaces if not intended;
- Refund interaction boundary;
- Ledger/ProviderFee/Settlement/Payout/Invoice/Commission boundary;
- Payment remains CAPTURED;
- Order/Booking/Availability unchanged;
- PSP/webhook absent.

No raw 500.

---

# 43. REQUIRED POSITIVE E2E MATRIX

Ensure coverage includes:

- FINANCE create;
- ADMIN create;
- allowed read roles;
- DSP code format;
- amount/currency/orderId frozen correctly;
- openedAt set;
- resolve sets resolvedAt first-only;
- cancel sets cancelledAt first-only;
- active slot released after terminal;
- second legitimate attempt after RESOLVED;
- second legitimate attempt after CANCELLED;
- list/detail;
- Decimal response is string;
- history;
- AuditLog;
- events exactly once;
- no side effects outside Dispute domain.

---

# 44. REQUIRED RACE E2E MATRIX

At minimum:

- concurrent identical create;
- concurrent divergent amount create;
- concurrent divergent category/reason if relevant;
- resolve/resolve;
- cancel/cancel;
- resolve/cancel;
- terminal/create interleaving.

Assertions must be invariant-based, not scheduler-order-based.

For every race prove:

- valid final state;
- correct row count;
- at most one active Dispute;
- correct milestones;
- no duplicate terminal event/history;
- controlled loser;
- raw 500 = 0.

---

# 45. UNIT TEST REVIEW

Do not rely only on e2e.

Inspect/add focused unit tests for:

- Decimal validation;
- Payment state eligibility;
- transition matrix;
- P2002 known active-index handling;
- unknown P2002 normalization;
- divergent duplicate payload handling if applicable;
- permission/DTO validation helpers where appropriate.

Avoid testing Prisma implementation details instead of business invariants.

---

# 46. FULL REGRESSION

After any review fixes run, at minimum:

Backend:

```bash
cd backend
npx tsc --noEmit
npm run build
npm test -- --runInBand
```

Run targeted affected e2e suites, including at least:

- chargeback/dispute;
- refund;
- payment;
- finance foundation;
- ledger;
- provider-fee/settlement/payout;
- temporal readiness;
- RBAC;
- event envelope;
- Order/Booking lifecycle suites affected by global events.

Then run **full serial e2e** from the project’s real harness.

Frontend:

```bash
cd frontend
npx tsc --noEmit
npm test -- --runInBand
npm run build
```

Use actual project scripts if names differ.

Database:

- `prisma migrate status`;
- live schema → Prisma schema diff;
- clean migration replay evidence.

Report exact counts from actual runs.

Never fabricate counts.

---

# 47. REVIEW FIX POLICY

Allowed without architecture escalation:

- clear bug fixes required by already-authoritative contracts;
- race/error normalization fixes;
- missing negative/concurrency tests;
- documentation corrections;
- snake_case AuditLog naming corrections;
- missing forbidden-key checks;
- missing pagination validation;
- exact idempotency payload verification where business identity is already unambiguous.

Not allowed without explicit architecture decision:

- new liability semantics;
- new provider semantics;
- new accounting behavior;
- new cross-domain projections;
- new financial netting rules;
- new dispute evidence workflow;
- changing cardinality because it “seems better.”

For each fix record:

- severity;
- defect;
- evidence;
- files changed;
- test proving fix.

---

# 48. REQUIRED REVIEW REPORT

Create:

`docs/prompts/PHASE_2_STEP_2.13A_CHARGEBACK_DISPUTE_FOUNDATION_STRICT_REVIEW_REPORT.md`

The report must include:

1. Verdict
2. Repository baseline
3. Sources inspected
4. Terminology decision
5. Ownership/write-path audit
6. Source authority
7. Frozen money contract
8. Refund interaction
9. Cardinality
10. Idempotency
11. Concurrency create
12. Lifecycle/CAS
13. Temporal contract
14. Payment isolation
15. Refund isolation
16. Order/Booking/Availability isolation
17. Ledger boundary
18. ProviderFee/Settlement/Payout boundary
19. Commission/Invoice boundary
20. PSP/webhook boundary
21. 2.12A–G containment
22. Events
23. AuditLog
24. History
25. RBAC
26. Mass assignment
27. Read API
28. IDs
29. Migration review
30. Fresh replay
31. Schema-evolution tests
32. Error normalization
33. Race matrix
34. Security/PII
35. API/docs consistency
36. Roadmap consistency
37. Review fixes
38. Regression
39. Files changed during review
40. Deferred boundaries
41. Exact NEXT item

Add more sections if findings require them.

---

# 49. VERDICT RULES

Use exactly one final implementation verdict:

### Clean approval

`PHASE 2 STEP 2.13A STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`

Use only if no production/test/docs correction was needed.

### Approval after fixes

`PHASE 2 STEP 2.13A STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

Use if defects were found, fixed, and all regression gates pass.

### Architecture stop

`PHASE 2 STEP 2.13A STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

Use if unresolved semantics prevent a safe review completion.

### Failed review

`PHASE 2 STEP 2.13A STRICT REVIEW FAILED`

Use if material defects remain unresolved or regression is red.

Do not call a review approved merely because existing tests pass.

---

# 50. FINAL RESPONSE FORMAT

Return a concise summary containing:

- exact verdict;
- hard-gate results;
- every defect found and whether fixed;
- actual final regression counts;
- migration/drift result;
- Roadmap update;
- exact NEXT item;
- report path.

If fixes were made, explicitly say how many files changed during review.

Do not begin NEXT.

---

# 51. SPECIAL ADVERSARIAL CHECKS FROM PRIOR FINANCE REVIEWS

Explicitly re-test defect classes already found in earlier Finance strict reviews:

1. **Silent divergent idempotency success**  
   Existing fact must not be returned as success for materially different business payload.

2. **Audit action naming drift**  
   Verify snake_case action names rather than mechanical `toLowerCase()`.

3. **Lenient temporal parsing**  
   If any temporal input exists, reject locale/date-only/invalid-calendar normalization; only canonical authorized format.

4. **Stale RBAC documentation**  
   Trust `ROLE_PERMISSIONS`, then reconcile docs.

5. **Weak concurrency coverage**  
   Existing sequential tests are not proof of race safety.

6. **ValidationPipe silent stripping**  
   Forged server-owned keys must be rejected from raw body according to established project convention.

These checks are mandatory even if the implementation report claims they are already solved.

---

# 52. FINAL HARD RULE

This is a **STRICT REVIEW**, not an implementation continuation.

The objective is not to make Step 2.13A look complete.

The objective is to determine whether the actual repository proves that its provider-neutral Chargeback / Dispute Foundation is correct under invalid input, replay, concurrency, lifecycle races, migration replay, RBAC, and future dependency boundaries.

**STOP after the Step 2.13A verdict and Roadmap update.**
