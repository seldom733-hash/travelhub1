# PHASE 2 — STEP 2.11 — PRICING & FINANCIAL SNAPSHOT — STRICT REVIEW PROMPT

## 0. ROLE
Perform an independent adversarial STRICT REVIEW of `PHASE 2 — STEP 2.11 — PRICING & FINANCIAL SNAPSHOT`.

Entering status: `PHASE 2 STEP 2.11 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`.

Do not trust the implementation report. Verify repository code, Prisma schema, migration SQL, runtime write paths, tests, contracts and Roadmap. Do not begin Step 2.12+.

Allowed final verdicts:
- `PHASE 2 STEP 2.11 STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`
- `PHASE 2 STEP 2.11 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 2 STEP 2.11 STRICT REVIEW FAILED`
- `PHASE 2 STEP 2.11 STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

## 1. OBJECTIVE
Independently prove:
1. the frozen money chain already existed through Quote(ISSUE) → CheckoutIntent → Sale → Order → Booking;
2. Booking.currency was the only historical-money gap;
3. Booking.currency is frozen verbatim from OrderItem.currency;
4. legacy Booking rows remain currency=NULL;
5. sales.money.ts is the single money authority;
6. finance.money.ts reuses that authority;
7. validateFrozenSnapshot/validateFrozenMoneyFact correctly enforce frozen-money consistency;
8. checkout binding rejects invalid snapshots with controlled 422;
9. Product/Tax/FX/Currency master-data changes do not mutate frozen history;
10. no Tax/FX/Commission/Ledger/Payment/Settlement/Payout engine was started;
11. no new events/permissions/cross-domain writes.

## 2. BASELINE
Record branch, HEAD, origin relation, working tree, migration count, latest migration, Roadmap status and exact NEXT.

Reported baseline to verify:
- unit 508/508;
- targeted E2E 155/155;
- serial E2E 1067/1067, 60 suites;
- frontend 135/135;
- migrations 51/51;
- drift 0.

## 3. MANDATORY SOURCES
Inspect:
- Roadmap v3;
- Step 2.11 implementation prompt/report;
- schema.prisma;
- migration `20260814100000_add_booking_currency`;
- sales.money.ts;
- finance.money.ts;
- sales.service.ts;
- Quote/CheckoutIntent/Sale/Order/Booking creation paths;
- OrderRequested/BookingRequested payloads and consumers;
- Booking read projections;
- Reverse marketplace commercial flow;
- Product/Tariff price sources;
- Finance Currency/ExchangeRate/Tax/TaxRule;
- Step 2.11 E2E;
- prior Sales/Order/Booking/Reverse/Finance regressions;
- api.md, events.md, pricing-financial-snapshot.md.

Repo-wide search for amount, currency, unitPrice, subtotal, total, discountAmount, taxAmount, exchangeRate, TaxRule, price, reprice, ROUND_HALF_UP, Decimal, Number(, parseFloat, OrderItem.currency, Booking.currency.

## 4. CURRENT → TARGET RECONCILIATION
Build a table for Quote, CheckoutIntent, Sale, Order, OrderItem, Booking and Reverse objects:
- monetary fields;
- currency;
- freeze point;
- mutability after freeze;
- source authority.

Independently determine whether Booking.currency was truly the only historical gap.

## 5. SNAPSHOT OWNER — HARD GATE
Determine:
- when money becomes frozen;
- whether Quote ISSUE is freeze boundary;
- whether Checkout binding changes authority;
- whether Sale/Order/Booking copy or recalculate.

There must be no competing money authority. If ambiguous: `ARCHITECTURE DECISION REQUIRED`.

## 6. NO MONEY GOD-OBJECT
Verify Step 2.11 did not create a universal aggregate combining pricing, payment, tax, ledger, provider fee, settlement or payout authority.

## 7. BOOKING.CURRENCY — CRITICAL
Verify:
- nullable schema;
- new rows copy OrderItem.currency;
- legacy rows remain NULL;
- no backfill;
- no Product/Tariff or live Finance Currency lookup to reconstruct history;
- amount and currency come from the same frozen source;
- read projections expose it consistently where intended.

## 8. MIGRATION REVIEW
Inspect SQL. Must be additive nullable column only, no unrelated ALTER/backfill/db push.
Run migrate status, fresh replay and drift/diff.

## 9. MONEY AUTHORITY — HARD GATE
Verify:
- sales.money.ts is canonical;
- finance.money.ts reuses rather than duplicates;
- no alternate helpers with conflicting rounding;
- no JS float authority in money calculations.

Search Number(), parseFloat and direct arithmetic on money.

## 10. DECIMAL / PRECISION
Verify DB precision/scale, Decimal use, overflow guard, excessive-scale handling, string serialization and no hidden coercion.

## 11. ROUNDING — HARD GATE
Prove exact rule, reportedly ROUND_HALF_UP, is consistent across Quote, Checkout, Sale, Order, Booking validation and Finance reuse.
Test boundary values.

## 12. validateFrozenSnapshot — CRITICAL
Audit exact invariants. Adversarially test:
- zero/negative/huge quantity;
- zero/negative unit price where applicable;
- fractional values;
- percentage/fixed discount boundaries;
- discount > subtotal;
- subtotal/total overflow;
- mixed currencies;
- empty snapshot;
- invalid Decimal;
- scientific notation if unsupported;
- trailing zeros;
- line-rounding vs aggregate-rounding.

Do not assume the formula is correct merely because deterministic.

## 13. DISCOUNT SEMANTICS
Verify discount type/value semantics pre-existed canonically. Step 2.11 must not invent discount policy.

## 14. TAX BOUNDARY
Verify no Tax engine was introduced. No live TaxRule lookup/recalculation unless already canonical. If tax producer absent, no fabricated taxAmount.

## 15. FX BOUNDARY
Verify no FX engine/conversion/rate selection was introduced. Historical money must not depend on current ExchangeRate.

## 16. CURRENCY MASTER-DATA MUTATION
Freeze money, mutate/deactivate Currency master-data if possible, verify frozen currency stays unchanged.

## 17. PRODUCT PRICE MUTATION — CRITICAL
Create flow at price X, freeze, change Product/Tariff to Y, continue to Sale/Order/Booking, verify downstream stays X. Inspect code for hidden repricing.

## 18. QUOTE FREEZE
Verify issued Quote cannot be repriced through alternate mutation path. If mutable post-issue, determine real freeze boundary.

## 19. CHECKOUT BINDING — CRITICAL
Invalid frozen snapshot must return controlled 422 with zero partial CheckoutIntent/Sale/outbox effects. Check alternate bypass routes.

## 20. SALE PROPAGATION
Verify Sale copies frozen facts without Product/Tax/FX re-read or alternate rounding.

## 21. ORDER PROPAGATION
Verify OrderRequested payload + consumer preserve amount/currency/item facts verbatim, with no Catalog re-read.

## 22. BOOKING PROPAGATION — HARD GATE
Verify Booking consumer copies the correct OrderItem amount+currency, and multi-item orders do not bleed values between items.

## 23. MULTI-CURRENCY EDGE CASE
Determine whether one Order may contain multiple currencies. If forbidden, prove enforcement. If allowed, prove aggregate semantics. If undefined and required: architecture decision.

## 24. REVERSE MARKETPLACE — HARD GATE
Verify BUYER_REQUEST flow uses identical frozen money semantics and acquisitionSource does not change pricing behavior.

## 25. IDEMPOTENCY
Identical replay = no duplicate; divergent money under same canonical identity = controlled conflict; unknown P2002 not swallowed; no raw 500.

## 26. CONCURRENCY
Test applicable races:
- duplicate identical snapshot binding;
- divergent binding;
- Product price update vs freeze;
- duplicate OrderRequested;
- duplicate BookingRequested.
No mixed old/new price components.

## 27. ATOMICITY — HARD GATE
Verify snapshot binding + aggregate transition + history/outbox commit atomically. Failed validation leaves no partial row/event.

## 28. MASS ASSIGNMENT — HARD GATE
Attempt forged Booking.amount/currency, Sale/Order totals, Checkout frozen fields, nested line totals and other server-owned money fields. Must loud-reject per project convention.

## 29. RBAC / IDOR
No FINANCE pricing write unless canonical; no unauthorized money exposure; neutral 404 where established.

## 30. PII
Snapshot must not contain traveler/customer PII, bank/card data or PSP secrets.

## 31. EVENTS
If event payloads changed, changes must be additive, validated, PII-free, correlation/causation preserved. No speculative new events.

## 32. LEDGER BOUNDARY
Step 2.11 must create zero automatic LedgerTransaction facts; no double-entry/balance behavior.

## 33. PROVIDERFEE / SETTLEMENT / PAYOUT BOUNDARY
No automatic creation or coupling; 2.10B foundations remain unchanged.

## 34. PAYMENT / REFUND / INVOICE / COMMISSION BOUNDARY
No runtime side effects, milestones or accruals.

## 35. LEGACY COMPATIBILITY
Legacy Booking.currency NULL readable; no read/startup repair using current Product price or Currency.

## 36. WRITE-PATH AUDIT
Enumerate all production writers of Booking.currency/amount, Order money, Sale money, Checkout frozen snapshot, Quote issued snapshot. Classify canonical owner / approved propagation / migration / test-only / unsafe. Unsafe category must be zero.

## 37. REPRICE AUDIT
Find all Product/Tariff/price lookups after freeze. Classify allowed pre-freeze vs forbidden repricing. Any downstream lookup affecting frozen money is a blocker.

## 38. TEST QUALITY
Inspect tests, not counts. Reject tests that only assert final values without master-data mutation, do not prove rollback/event counts, omit multi-item/Reverse/legacy coverage, or mock DB invariants.

## 39. REQUIRED NEGATIVE COVERAGE
Ensure runtime coverage for:
- forged money fields;
- invalid Decimal;
- scale/precision overflow;
- unsupported currency;
- inconsistent line/subtotal/discount/total where canonical;
- Product/Tax/FX/Currency mutations do not rewrite history;
- divergent replay conflict;
- unknown P2002 not swallowed;
- failed checkout binding leaves no partial writes;
- no Ledger/ProviderFee/Settlement/Payout/Payment/Refund/Invoice/Commission side effects;
- legacy NULL valid;
- no raw 500.

## 40. REQUIRED POSITIVE COVERAGE
Ensure coverage for:
- direct frozen flow;
- Booking amount+currency;
- Product X→Y mutation while Sale/Order/Booking remain X;
- multi-item;
- Reverse/BUYER_REQUEST;
- Decimal string serialization;
- deterministic rounding;
- replay;
- legacy read;
- fresh migration replay.

## 41. BACKEND REGRESSION
Run actual TypeScript, backend build, full unit, targeted Step 2.11, Sales, Order, Booking, Reverse, Finance 2.10–2.10C, RBAC/event-envelope/temporal, then full serial E2E.

Verify reported baseline 508/508 unit, 1067/1067 serial E2E, 60 suites; report post-fix totals if changed.

## 42. FRONTEND REGRESSION
Run frontend TypeScript, Vitest, production build. Verify reported 135/135.

## 43. DB REGRESSION
Run migrate status, fresh migration replay and drift/diff. Verify reported 51/51 and drift 0. Confirm harness uses migrations, not db push.

## 44. DOCUMENTATION CONSISTENCY
Compare runtime with pricing-financial-snapshot.md, api.md, events.md and Roadmap. Fix misleading claims.

## 45. ARCHITECTURE STOP CONDITIONS
Return `PHASE 2 STEP 2.11 STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED` if unresolved:
1. snapshot owner/freeze boundary ambiguous;
2. Booking amount/currency have different authorities;
3. multi-currency Order semantics required but undefined;
4. discount semantics lack canonical source;
5. tax inclusive/exclusive semantics required but undefined;
6. FX source/rate selection required but undefined;
7. historical correction requires repricing;
8. snapshot requires auto-ledger posting;
9. Payment runtime required;
10. Commission/Settlement/Payout calculations required;
11. legacy data needs fabricated backfill;
12. cross-domain write authority required;
13. breaking event change required;
14. approved Order/Booking money contracts conflict.

## 46. REVIEW FIX POLICY
For architecture-neutral defects:
defect → severity/risk → root cause → minimal patch → regression test → targeted rerun → full rerun.
Do not expand into 2.12+.

## 47. ROADMAP UPDATE
Only after all hard gates pass:
- Step 2.11 → `✅ STRICT REVIEW COMPLETED — APPROVED` or `APPROVED WITH REVIEW FIXES`;
- set NEXT from actual current Roadmap;
- do not begin NEXT.

## 48. REQUIRED REPORT
Create:
`docs/prompts/PHASE_2_STEP_2.11_PRICING_FINANCIAL_SNAPSHOT_STRICT_REVIEW_REPORT.md`

Structure:
1. Verdict
2. Repository baseline
3. Sources inspected
4. Current → Target
5. Snapshot owner / freeze boundary
6. Booking.currency
7. Migration
8. Money authority
9. Decimal precision/scale
10. Rounding
11. validateFrozenSnapshot audit
12. Discount semantics
13. Tax boundary
14. FX boundary
15. Currency master-data mutation
16. Product price mutation
17. Quote freeze
18. Checkout binding
19. Sale propagation
20. Order propagation
21. Booking propagation
22. Multi-currency assessment
23. Reverse marketplace
24. Idempotency
25. Concurrency
26. Atomicity
27. Mass assignment
28. RBAC / IDOR
29. PII
30. Events
31. Ledger boundary
32. ProviderFee/Settlement/Payout boundary
33. Payment/Refund/Invoice/Commission boundary
34. Legacy compatibility
35. Write-path audit
36. Reprice audit
37. Negative coverage
38. Positive coverage
39. Backend regression
40. Frontend regression
41. DB regression
42. Issues found
43. Review fixes
44. Architecture decision status
45. Documentation status
46. Roadmap update
47. Deferred/out-of-scope
48. Exact files changed
49. Exact NEXT item
50. Final certification

## 49. FINAL CERTIFICATION
No fixes:
`PHASE 2 STEP 2.11 STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`

With fixes:
`PHASE 2 STEP 2.11 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

Unresolved defects:
`PHASE 2 STEP 2.11 STRICT REVIEW FAILED`

Architecture ambiguity:
`PHASE 2 STEP 2.11 STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

## 50. HARD STOP
After report + permitted Roadmap update: STOP.
Do not implement Step 2.12 or any later step.
