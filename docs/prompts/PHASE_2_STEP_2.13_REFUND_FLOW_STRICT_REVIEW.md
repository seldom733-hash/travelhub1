# PHASE 2 — STEP 2.13 — REFUND FLOW — STRICT REVIEW PROMPT

## 0. ROLE
Perform an independent adversarial STRICT REVIEW of `PHASE 2 — STEP 2.13 — REFUND FLOW`.

Entering status:
`PHASE 2 STEP 2.13 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Do not trust the implementation report. Verify actual code, Prisma schema, migration SQL, write paths, events, tests, architecture docs and Roadmap. Do not begin 2.14+.

Allowed verdicts:
- `PHASE 2 STEP 2.13 STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`
- `PHASE 2 STEP 2.13 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 2 STEP 2.13 STRICT REVIEW FAILED`
- `PHASE 2 STEP 2.13 STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

## 1. OBJECTIVE
Independently prove:
1. Refund is Finance-owned.
2. CAPTURED Payment is the sole refund source authority.
3. Refund never reprices Order / mutates Booking money / rewrites Payment.amount.
4. State machine is `REQUESTED → APPROVED → PROCESSED | FAILED` (or canonical equivalent).
5. Payment stays CAPTURED; `REFUNDED` is NOT activated unless canonically required.
6. Partial refunds are supported without ambiguity.
7. Over-refund is prevented atomically (advisory lock / CAS), not read-then-write.
8. `requestedAt/approvedAt/processedAt/failedAt` are first-only/server-owned.
9. Idempotency: identical replay = same effect; divergent = 409; one fact per business refund.
10. Multiple Refunds per Payment allowed (partial), with DB-backed uniqueness for retries.
11. Order projection (`refundedAmount`, `paymentStatus`) is Order-owned.
12. Finance never writes Order/Booking directly.
13. Booking/Availability untouched.
14. No Ledger/ProviderFee/Settlement/Payout/Invoice/Commission side effects.
15. No PSP/webhook refund runtime yet.

## 2. BASELINE
Record branch, HEAD, origin relation, working tree, migrations, latest migration, Roadmap state, exact NEXT.

Reported baseline to verify:
- unit 534/534;
- targeted e2e 166/166;
- serial e2e 1093/1093, 62 suites;
- frontend 135/135;
- migrations 53/53;
- drift 0.

## 3. MANDATORY SOURCES
Inspect Roadmap, Step 2.13 prompt/report, schema.prisma, `20260814150000_add_refund_runtime`, RefundService/controller/validation/history, Finance wiring, RBAC, Order subscribers, PaymentService, Booking code, LedgerService, ProviderFee/Settlement/Payout, Invoice/Commission, sales.money.ts, 2.10–2.12 tests, refund-flow e2e, order lifecycle, phase-entry audits, api.md, events.md, refund-flow.md.

Search:
`Refund`, `refund.create`, `refund.update`, `RefundStatus`, `refundedAmount`, `refundedAt`, `isActiveRefund`, `RefundProcessed`, `RefundCreated`, `RefundApproved`, `RefundFailed`, `REFUNDED`, `requestedAt`, `approvedAt`, `processedAt`, `failedAt`, `advisory`, `pg_advisory`, `paymentStatus`, `paidAmount`, `webhook`, `Stripe`, `LedgerTransaction`, `CommissionAccrual`.

## 4. CURRENT → TARGET
Build a table for:
- refund creation;
- lifecycle;
- provider-neutral execution;
- PSP refund;
- partial refunds;
- multiple refund attempts;
- milestones;
- Payment impact;
- Order projection;
- Booking coupling;
- ledger posting;
- commission reversal.

Reserved enum values must not appear as active runtime.

## 5. REFUND OWNERSHIP — HARD GATE
Enumerate every Refund writer. Expected: Finance-owned only. No Order/Booking/Sales direct Refund writes, no raw SQL, no hidden PSP writer.

## 6. REFUND SOURCE AUTHORITY — CRITICAL
Prove:
- Refund references CAPTURED Payment only (PENDING/FAILED/CANCELLED rejected);
- currency/orderId server-derived from Payment, verbatim;
- no Product/Tax/FX re-read;
- refundable amount formula is canonical and money-safe.

## 7. REFUND CARDINALITY — CRITICAL
Audit partial-refund support: multiple Refund rows per Payment allowed; unique `(paymentId, amount)` + `isActiveRefund` as idempotency slot; attempt-2 after FAILED valid; identical retry → no-op; second identical refund conservative-blocked. Verify future semantics not irreversibly blocked.

## 8. isActiveRefund CONSISTENCY
For REQUESTED/APPROVED/PROCESSED/FAILED verify status↔flag invariant and atomic updates.

## 9. STATUS VOCABULARY
Compare Prisma enum, Screen Design, Roadmap, api.md, refund-flow.md. Verify Payment `REFUNDED` stays reserved/unreachable and no stray refund status invented.

## 10. SINGLE STATE MACHINE AUTHORITY
Enumerate all Refund.status writers. Exactly one canonical transition matrix. CAS/from-guard required. Controllers do not write status directly.

## 11. PARTIAL REFUND SEMANTICS — CRITICAL
Prove:
- total already refunded = Σ non-FAILED Refunds;
- remaining refundable = payment.amount − total;
- concurrent refunds serialized (advisory lock / CAS) — race test 70+70 on 100 → one fact, total ≤ amount;
- rounding consistent; no float;
- full-refund vs partial-refund terminal handling explicit.

## 12. TEMPORAL CONTRACT — HARD GATE
Verify requestedAt on REQUESTED, approvedAt on APPROVED, processedAt on PROCESSED, failedAt on FAILED; all nullable/first-only/server-owned/atomic. No fabricated backfill. `refundedAt` must NOT appear (canonical vocabulary uses processedAt) unless canonically justified.

## 13. MIGRATION REVIEW
Inspect SQL: additive, version/CAS, isActiveRefund partial unique, milestones, Order.refundedAmount, no fake backfill, no db push. Run status/replay/drift.

## 14. IDS
Verify Refund code via IdsService, same transaction, DB unique, no collision treated as idempotency.

## 15. MONEY
Verify Decimal, no Number/parseFloat authority, frozen amount/currency from Payment, no alternate rounding or mutation after create.

## 16. REFUNDABLE AMOUNT — HARD GATE
Find every computation of refundable/refund amount. Prove source = Payment.amount and Σ non-FAILED refunds, atomic protection, no read-then-write.

## 17. CREATION IDEMPOTENCY
Test:
- identical create;
- same Payment divergent amount → 409;
- second identical refund (same amount) → conservative conflict;
- second attempt after FAILED;
- after PROCESSED;
- concurrent initial create.

## 18. OVER-REFUND / RACE — CRITICAL
Review advisory-lock usage: exact lock key, transaction scope, lock held across sum+create, loser controlled conflict, raw 500 = 0. Test two concurrent refunds each valid alone, together > captured amount.

## 19. DIVERGENT REPLAY
Same identity + different amount/currency must conflict.

## 20. P2002
Known business unique handled intentionally; code unique not replay; active-refund unique handled correctly; unknown unique not swallowed.

## 21. CONCURRENCY
Test:
- concurrent identical create;
- concurrent partial refunds same Payment;
- PROCESSED vs FAILED;
- duplicate event delivery;
- Payment concurrently changing state.
One winner, one milestone/history/event, no raw 500.

## 22. CREATION AUTHORITY
Verify actual initiating roles/routes. Finance-only; no hidden Buyer/public route (Buyer refund request deferred unless canonical).

## 23. RBAC
Audit FINANCE, ADMIN, DIRECTOR, ANALYST, OPERATOR, SALES_MANAGER, BUYER, PARTNER, MODERATOR, MARKETER for refund.read / refund.create / refund.approve. Verify `finance.refund.write` added to FINANCE only (write) and read set excludes OPERATOR unless ROLE_PERMISSIONS says otherwise.

## 24. MASS ASSIGNMENT
Forge id/code/status/paymentId/orderId/amount/currency/providerRef/milestones/actor/correlation/version/timestamps. Loud reject per project convention.

## 25. IDOR
Unknown/foreign Refund follows established 404/403 behavior.

## 26. EVENTS — HARD GATE
Audit RefundCreated/Approved/Processed/Failed:
- exact producer;
- exact payload;
- version;
- PII-free;
- correlation/causation/actor;
- one event per real transition;
- none on retry.

## 27. ORDER REFUND PROJECTION — CRITICAL
Prove:
- Finance never writes Order;
- Order-owned subscriber handles RefundProcessed;
- Inbox dedup;
- own-domain CAS;
- refundedAmount += amount (idempotent, no double-apply);
- full refund → paymentStatus REFUNDED; partial → PAID;
- paidAmount historical, not rewritten;
- duplicate event does not double-apply.

## 28. ORDER PROJECTION RACES
Test duplicate/stale RefundProcessed, concurrent Order lifecycle transitions/cancel, unrelated fields not overwritten.

## 29. BOOKING ISOLATION
Zero Booking writes/status/money/milestones and zero Availability effects. Refund ≠ Booking cancellation.

## 30. LEDGER BOUNDARY
Refund 2.13 must not create LedgerTransaction; posting deferred.

## 31. PROVIDER FEE BOUNDARY
No ProviderFee creation/calculation, no refund-fee fabrication.

## 32. COMMISSION BOUNDARY
No Commission/CommissionAccrual reversal/netting.

## 33. SETTLEMENT / PAYOUT BOUNDARY
No Settlement/Payout creation/update/netting.

## 34. INVOICE BOUNDARY
No credit note/invoice adjustment.

## 35. PSP / WEBHOOK BOUNDARY
Repo-wide prove no active Stripe/provider refund webhook/callback/signature path in production.

## 36. PII / PCI / SECRETS
No PAN/CVV/bank details/provider secrets/raw payloads/traveler PII in Refund/events/history/audit. Opaque provider refs only.

## 37. REFUND HISTORY
One row per real transition, no row on stale/failed request, accurate from/to/action, no sensitive payload.

## 38. AUDITLOG
Minimal metadata, correct naming, correct actor, no duplicate audit on no-op.

## 39. CORRELATION / CAUSATION / ACTOR
HTTP command: server UUID correlation, causation null, USER actor.
Consumer: causation = RefundProcessed event id, correlation inherited.

## 40. LEGACY
Legacy/schema-only Refund rows readable; no fabricated milestones/history/active state on read.

## 41. WRITE-PATH AUDIT
Enumerate all production:
- Refund create/update/updateMany/upsert/delete/deleteMany/raw SQL;
- status writers;
- isActiveRefund writers;
- milestone writers;
- Order.paymentStatus writers;
- Order.paidAmount / refundedAmount writers;
- Payment.status writers.
Unsafe writers = 0.

## 42. REPRICE / REFUNDABLE AUDIT
Find every Product/Tariff/Tax/FX read in Refund path. No current data may alter refund base.

## 43. NEGATIVE COVERAGE
Ensure tests for:
401, 403, 404, refund vs non-CAPTURED Payment, forged amount/currency/status/milestone, zero/negative refund, refund > refundable, duplicate identical, divergent replay, concurrent duplicate, concurrent over-refund race, invalid transition, terminal retry, unknown P2002, price change no effect, no direct Order write, no Booking, no Availability, no ProviderFee, no Commission, no Settlement/Payout, no Invoice, no Ledger, no webhook, no PII/PCI, no raw 500.

## 44. POSITIVE COVERAGE
Ensure:
Refund create/code/source Payment/amount-currency/REQUESTED/APPROVED/PROCESSED/FAILED/first-only milestones/events/replay/concurrency/partial refund/second partial/full refund/Order projection/fresh replay.

## 45. TEST QUALITY
Inspect tests, not counts. Reject race tests that do not assert loser, event/history counts, business identity, cleanup leakage, and partial-refund semantics.

## 46. BACKEND REGRESSION
Run tsc, build, full unit, targeted Refund, Payment 2.12, Pricing 2.11, Order, Booking, Reverse, Finance 2.10–2.10C, Ledger 2.10A, 2.10B foundations, RBAC, event envelope, PII, full serial e2e.
Verify reported baseline 534/534 and 1093/1093 (62 suites), or report new totals after fixes.

## 47. FRONTEND
Run tsc, Vitest, production build. Verify 135/135 baseline.

## 48. DB
Run migrate status, fresh replay, schema diff/drift. Verify 53/53, drift 0 and migrate deploy rather than db push.

## 49. DOCS
Compare refund-flow.md, api.md, events.md, Roadmap.
Docs must clearly separate:
- current provider-neutral 2.13;
- PSP refund later;
- Payment REFUNDED reserved;
- ledger posting 2.12D deferred;
- commission reversal deferred.

## 50. ARCHITECTURE STOP CONDITIONS
Return:
`PHASE 2 STEP 2.13 STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`
if unresolved:
1. refund source ambiguous;
2. cardinality blocks partial refunds;
3. Payment REFUNDED semantics conflict;
4. Order projection cannot represent refund truth;
5. over-refund not atomically prevented;
6. refundable amount authority unclear;
7. refund milestone authority ambiguous;
8. PSP refund required but deferred;
9. provider refund identity undefined;
10. direct Order/Booking writes required;
11. Refund requires repricing / Tax/FX;
12. Commission/Settlement/Payout/Invoice logic required;
13. ledger posting required now;
14. double-entry/balance architecture required;
15. multiple active Refund writers;
16. migration needs fabricated history.

## 51. REVIEW FIX POLICY
For architecture-neutral defects:
`defect → severity → evidence → violated invariant → patch → regression test → targeted rerun → full rerun`

Do not implement future refund substeps.

## 52. ROADMAP UPDATE
Only after all hard gates pass:
- Step 2.13 → `✅ STRICT REVIEW COMPLETED — APPROVED` or `APPROVED WITH REVIEW FIXES`;
- set exact NEXT from actual Roadmap;
- do not begin NEXT.

## 53. REQUIRED REPORT
Create:
`docs/prompts/PHASE_2_STEP_2.13_REFUND_FLOW_STRICT_REVIEW_REPORT.md`

Sections:
1. Verdict
2. Repository baseline
3. Sources inspected
4. Current→Target
5. Refund ownership
6. Source Payment authority
7. Cardinality
8. isActiveRefund
9. Status vocabulary
10. State-machine authority
11. Partial refund semantics
12. Temporal contract
13. Migration
14. IDs
15. Money
16. Refundable amount
17. Creation idempotency
18. Over-refund / race
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
33. Settlement/Payout boundary
34. Invoice boundary
35. PSP/webhook boundary
36. PII/PCI/secrets
37. RefundHistory
38. AuditLog
39. Correlation/causation/actor
40. Legacy
41. Write-path audit
42. Reprice/refundable audit
43. Negative coverage
44. Positive coverage
45. Backend regression
46. Frontend regression
47. DB regression
48. Issues found
49. Review fixes
50. Architecture decision status
51. Documentation status
52. Roadmap update
53. Deferred/out-of-scope
54. Exact files changed
55. Exact NEXT item
56. Final certification

## 54. FINAL CERTIFICATION
No fixes:
`PHASE 2 STEP 2.13 STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`

With fixes:
`PHASE 2 STEP 2.13 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

Unresolved defects:
`PHASE 2 STEP 2.13 STRICT REVIEW FAILED`

Architecture ambiguity:
`PHASE 2 STEP 2.13 STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

## 55. HARD STOP
After report and Roadmap update: STOP.
Do not implement 2.14 or any later step.
