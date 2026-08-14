# PHASE 2 — STEP 2.12 — PAYMENT FLOW — STRICT REVIEW PROMPT

## 0. ROLE
Perform an independent adversarial STRICT REVIEW of `PHASE 2 — STEP 2.12 — PAYMENT FLOW`.

Entering status:
`PHASE 2 STEP 2.12 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Do not trust the implementation report. Verify actual code, Prisma schema, migration SQL, write paths, events, tests, architecture docs and Roadmap. Do not begin 2.12A+ or 2.13+.

Allowed verdicts:
- `PHASE 2 STEP 2.12 STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`
- `PHASE 2 STEP 2.12 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 2 STEP 2.12 STRICT REVIEW FAILED`
- `PHASE 2 STEP 2.12 STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

## 1. OBJECTIVE
Independently prove:
1. Payment is Finance-owned.
2. Frozen Order snapshot is the payable source.
3. No repricing occurs.
4. State machine is `PENDING → CAPTURED | FAILED | CANCELLED`.
5. AUTHORIZED/REFUNDED are reserved only.
6. `PAID = CAPTURED`.
7. `paidAt/failedAt/cancelledAt` are first-only.
8. `authorizedAt/capturedAt` remain deferred.
9. One active Payment per Order is safely enforced.
10. Second attempt after FAILED/CANCELLED is valid.
11. Partial payment remains deferred.
12. Payment events are transactional.
13. Order projection is Order-owned.
14. Finance never writes Order directly.
15. Booking/Availability untouched.
16. No Ledger/ProviderFee/Settlement/Payout/Refund/Invoice/Commission side effects.
17. No PSP/webhook runtime yet.

## 2. BASELINE
Record branch, HEAD, origin relation, working tree, migrations, latest migration, Roadmap state, exact NEXT.

Reported baseline to verify:
- unit 520/520;
- targeted e2e 172/172;
- serial e2e 1080/1080, 61 suites;
- frontend 135/135;
- migrations 52/52;
- drift 0.

## 3. MANDATORY SOURCES
Inspect Roadmap, Step 2.12 prompt/report, schema.prisma, `20260814120000_add_payment_runtime`, PaymentService/controller/validation/history, Finance wiring, RBAC, Order subscribers, Booking code, LedgerService, ProviderFee/Settlement/Payout, PaymentTerms, sales.money.ts, 2.10–2.11 tests, payment-flow e2e, business-event-envelope, order lifecycle, phase-entry audits, api.md, events.md, payment-flow.md.

Search:
`Payment`, `payment.create`, `payment.update`, `PaymentStatus`, `paymentStatus`, `paidAmount`, `PaymentCaptured`, `PaymentFailed`, `PaymentCancelled`, `AUTHORIZED`, `REFUNDED`, `authorizedAt`, `capturedAt`, `paidAt`, `failedAt`, `cancelledAt`, `isActivePayment`, `providerRef`, `webhook`, `Stripe`, `refund`, `LedgerTransaction`, `CommissionAccrual`.

## 4. CURRENT → TARGET
Build a table for:
- creation;
- lifecycle;
- provider-neutral execution;
- PSP;
- authorization;
- capture;
- milestones;
- partial payments;
- refund;
- commission;
- ledger posting;
- Order projection;
- Booking coupling.

Reserved enum values must not appear as active runtime.

## 5. PAYMENT OWNERSHIP — HARD GATE
Enumerate every Payment writer. Expected: Finance-owned only. No Order/Booking/Sales direct Payment writes, no raw SQL, no hidden PSP writer.

## 6. PAYABLE SOURCE — CRITICAL
Prove amount/currency come from frozen Order snapshot and never current Product/Tax/FX.

## 7. CARDINALITY — CRITICAL
Audit `isActivePayment` + partial unique `Payment_one_active_per_order`.
Verify:
- one active Payment per Order;
- second attempt after FAILED/CANCELLED;
- second attempt after CAPTURED blocked;
- future partial semantics remain evolvable.

## 8. isActivePayment CONSISTENCY
For PENDING/CAPTURED/FAILED/CANCELLED/AUTHORIZED/REFUNDED verify status↔flag invariant and atomic updates.

## 9. STATUS VOCABULARY
Compare Prisma enum, Screen Design, Roadmap, api.md, payment-flow.md. Reserved AUTHORIZED/REFUNDED must not be reachable.

## 10. SINGLE STATE MACHINE AUTHORITY
Enumerate all Payment.status writers. Exactly one canonical transition matrix. CAS/from-guard required.

## 11. PAID = CAPTURED — CRITICAL
Prove current canonical docs define CAPTURED as point where Order projection becomes PAID. If any source defines PAID differently, require architecture decision.

## 12. TEMPORAL CONTRACT — HARD GATE
Verify paidAt on CAPTURED, failedAt on FAILED, cancelledAt on CANCELLED, all nullable/first-only/server-owned/atomic. Verify authorizedAt/capturedAt remain absent/deferred.
Critically assess possible future conflict between paidAt and later capturedAt.

## 13. MIGRATION REVIEW
Inspect SQL: additive, version/CAS, isActivePayment, partial unique, milestones, no fake backfill, no db push. Run status/replay/drift.

## 14. IDS
Verify Payment code via IdsService, same transaction, DB unique, no collision treated as idempotency.

## 15. MONEY
Verify Decimal, no Number/parseFloat authority, frozen amount/currency, no alternate rounding or mutation after create.

## 16. PAYMENT TERMS
No mutable Finance PaymentTerms re-resolution if frozen Sales/Order terms are authority.

## 17. CREATION IDEMPOTENCY
Test:
- identical create;
- same Order divergent business input if possible;
- second request after FAILED;
- after CANCELLED;
- after CAPTURED;
- concurrent initial create.

## 18. OVERPAYMENT / SECOND ATTEMPT — CRITICAL
Review any “idempotent no-op” handling. Ensure a second successful full payment after CAPTURED is not silently treated as harmless retry unless identity proves same attempt.

## 19. DIVERGENT REPLAY
Same identity + different amount/currency/provider/attempt must conflict.

## 20. P2002
Known business unique handled intentionally; code unique not replay; active-order unique handled correctly; unknown unique not swallowed.

## 21. CONCURRENCY
Test:
- concurrent identical create;
- concurrent attempts same Order;
- CAPTURED vs FAILED;
- CAPTURED vs CANCELLED;
- FAILED vs CANCELLED;
- terminal retry.
One winner, one milestone/history/event, no raw 500.

## 22. CREATION AUTHORITY
Verify actual initiating roles/routes. If Finance-only, confirm canonical. No hidden Buyer/public route.

## 23. RBAC
Audit FINANCE, ADMIN, DIRECTOR, ANALYST, OPERATOR, SALES_MANAGER, BUYER, PARTNER, MODERATOR, MARKETER for read/write.

## 24. MASS ASSIGNMENT
Forge id/code/status/amount/currency/isActivePayment/milestones/provider/source/actor/correlation/version/timestamps. Loud reject per project convention.

## 25. IDOR
Unknown/foreign Payment follows established 404/403 behavior.

## 26. EVENTS — HARD GATE
Audit PaymentCreated/Captured/Failed/Cancelled:
- exact producer;
- exact payload;
- version;
- PII-free;
- correlation/causation/actor;
- one event per real transition;
- none on retry.
If PaymentCreated has no consumer, confirm it is canonical, not speculative.

## 27. ORDER PAYMENT PROJECTION — CRITICAL
Prove:
- Finance never writes Order;
- Order-owned subscriber handles PaymentCaptured;
- Inbox dedup;
- own-domain CAS;
- paymentStatus=PAID;
- paidAmount=frozen amount;
- no lifecycle mutation;
- duplicate event does not double-apply.
Assess future partial-payment compatibility.

## 28. ORDER PROJECTION RACES
Test duplicate/stale PaymentCaptured, concurrent Order lifecycle transitions/cancel, and ensure unrelated fields are not overwritten.

## 29. BOOKING ISOLATION
Zero Booking writes/status/money/milestones and zero Availability effects.

## 30. LEDGER BOUNDARY
Payment 2.12 must not create LedgerTransaction; posting is deferred to 2.12D.

## 31. PROVIDER FEE BOUNDARY
No ProviderFee creation/calculation.

## 32. COMMISSION BOUNDARY
No Commission/CommissionAccrual/netting.

## 33. REFUND BOUNDARY
REFUNDED reserved and unreachable. No refund route/event/refundedAt/Refund writer/reversal.

## 34. PSP / WEBHOOK BOUNDARY
Repo-wide prove no active Stripe/provider webhook/callback/signature path in production.

## 35. PII / PCI
No PAN/CVV/card data/secrets/raw auth/traveler PII in Payment/events/history/audit.

## 36. PAYMENT HISTORY
One row per real transition, no row on stale/failed request, accurate from/to/action, no sensitive payload.

## 37. AUDITLOG
Minimal metadata, correct naming, correct actor, no duplicate audit on no-op unless explicitly intended.

## 38. CORRELATION / CAUSATION / ACTOR
HTTP command: server UUID correlation, causation null, USER actor.
Order projection consumer: causation = PaymentCaptured event id, correlation inherited.

## 39. LEGACY
Legacy/schema-only Payment rows readable; no fabricated milestones/history/active state on read.

## 40. WRITE-PATH AUDIT
Enumerate all production:
- Payment create/update/updateMany/upsert/delete/deleteMany/raw SQL;
- status writers;
- isActivePayment writers;
- milestone writers;
- Order.paymentStatus writers;
- Order.paidAmount writers.
Unsafe writers = 0.

## 41. REPRICE AUDIT
Find every Product/Tariff/Tax/FX read in Payment path. No current data may alter frozen payable amount.

## 42. NEGATIVE COVERAGE
Ensure tests for:
401, 403, 404, forged fields, malformed money, unsupported currency, no repricing, duplicate create, concurrent duplicate, divergent replay, unknown P2002, invalid transition, terminal retry, transition races, second attempt rules, no direct Order write, no Booking, no Ledger, no ProviderFee, no Settlement/Payout, no Refund, no Commission, no webhook, no PCI/PII, no raw 500.

## 43. POSITIVE COVERAGE
Ensure:
Payment create/code/frozen money/PENDING/CAPTURED/FAILED/CANCELLED/first-only milestones/4 events/replay/concurrency/second attempt after FAILED/CANCELLED/Order projection/Direct/BUYER_REQUEST where applicable/legacy/fresh replay.

## 44. TEST QUALITY
Inspect tests, not counts. Reject race tests that do not assert loser, event/history counts, business identity, cleanup leakage, and second-attempt semantics.

## 45. BACKEND REGRESSION
Run tsc, build, full unit, targeted Payment, Pricing 2.11, Order, Booking, Reverse, Finance 2.10–2.10C, Ledger 2.10A, 2.10B foundations, RBAC, event envelope, PII, full serial e2e.
Verify reported baseline 520/520 and 1080/1080 (61 suites), or report new totals after fixes.

## 46. FRONTEND
Run tsc, Vitest, production build. Verify 135/135 baseline.

## 47. DB
Run migrate status, fresh replay, schema diff/drift. Verify 52/52, drift 0 and migrate deploy rather than db push.

## 48. DOCS
Compare payment-flow.md, api.md, events.md, Roadmap.
Docs must clearly separate:
- current provider-neutral 2.12;
- PSP 2.12A/B;
- partial 2.12F;
- commission 2.12C/E;
- ledger posting 2.12D;
- fee granularity 2.12G where applicable.

## 49. ARCHITECTURE STOP CONDITIONS
Return:
`PHASE 2 STEP 2.12 STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`
if unresolved:
1. payable source ambiguous;
2. active-payment uniqueness blocks current required semantics;
3. CAPTURED vs PAID conflict;
4. paidAt vs future capturedAt conflict;
5. Order projection authority conflict;
6. second-attempt identity/cardinality undefined;
7. partial payment required now;
8. provider/Buyer flow required but deferred;
9. ledger posting required now;
10. ProviderFee/Commission/Refund/Settlement/Payout required;
11. cross-domain write required;
12. active legacy PSP writer conflicts;
13. event semantics speculative/conflicting;
14. migration needs fabricated history.

## 50. REVIEW FIX POLICY
For architecture-neutral defects:
`defect → severity → evidence → violated invariant → patch → regression test → targeted rerun → full rerun`

Do not implement future payment substeps.

## 51. ROADMAP UPDATE
Only after all hard gates pass:
- Step 2.12 → `✅ STRICT REVIEW COMPLETED — APPROVED` or `APPROVED WITH REVIEW FIXES`;
- set exact NEXT from actual Roadmap;
- do not begin NEXT.

## 52. REQUIRED REPORT
Create:
`docs/prompts/PHASE_2_STEP_2.12_PAYMENT_FLOW_STRICT_REVIEW_REPORT.md`

Sections:
1. Verdict
2. Repository baseline
3. Sources inspected
4. Current→Target
5. Ownership
6. Frozen obligation source
7. Cardinality
8. isActivePayment
9. Status vocabulary
10. State-machine authority
11. PAID=CAPTURED
12. Temporal contract
13. Migration
14. IDs
15. Money
16. PaymentTerms
17. Creation idempotency
18. Overpayment / second attempt
19. Divergent replay
20. P2002
21. Concurrency
22. Creation authority
23. RBAC
24. Mass assignment
25. IDOR
26. Events
27. Order projection
28. Order races
29. Booking isolation
30. Ledger boundary
31. ProviderFee boundary
32. Commission boundary
33. Refund boundary
34. PSP/webhook boundary
35. PII/PCI
36. PaymentHistory
37. AuditLog
38. Correlation/causation/actor
39. Legacy
40. Write-path audit
41. Reprice audit
42. Negative coverage
43. Positive coverage
44. Backend regression
45. Frontend regression
46. DB regression
47. Issues found
48. Review fixes
49. Architecture decision status
50. Documentation status
51. Roadmap update
52. Deferred/out-of-scope
53. Exact files changed
54. Exact NEXT item
55. Final certification

## 53. FINAL CERTIFICATION
No fixes:
`PHASE 2 STEP 2.12 STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`

With fixes:
`PHASE 2 STEP 2.12 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

Unresolved defects:
`PHASE 2 STEP 2.12 STRICT REVIEW FAILED`

Architecture ambiguity:
`PHASE 2 STEP 2.12 STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

## 54. HARD STOP
After report and Roadmap update: STOP.
Do not implement 2.12A or any later step.
