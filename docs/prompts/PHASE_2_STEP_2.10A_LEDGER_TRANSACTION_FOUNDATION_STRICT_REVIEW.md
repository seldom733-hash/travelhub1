# PHASE 2 — STEP 2.10A — LEDGER TRANSACTION FOUNDATION — STRICT REVIEW PROMPT

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.10A — Ledger Transaction Foundation  
**Mode:** STRICT REVIEW / ADVERSARIAL CERTIFICATION  
**Entering status:** `PHASE 2 STEP 2.10A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`  
**Reported implementation baseline:** backend unit `492/492`, full serial E2E `1041/1041` (58 suites), frontend `135/135`, migrations `48/48`, drift/diff clean.  
**Expected NEXT only if approved:** exact current Roadmap item after 2.10A, expected `PHASE 2 — STEP 2.10B — PROVIDER FEE / SETTLEMENT / PAYOUT FOUNDATION`.  
**Hard stop:** DO NOT implement Step 2.10B, Step 2.10C, Step 2.12+, Settlement, Payout, Payment, Refund, Commission accrual or temporal Finance milestones in this pass.

## 1. Mission

Perform an independent, repository-backed, adversarial STRICT REVIEW of Step 2.10A.

Do not approve from the implementation report or green test counts alone.

The review must prove that LedgerTransaction is Finance-owned, immutable/append-only, Decimal-safe, provenance-complete, idempotent, concurrency-safe, free of hidden cross-domain writers, and does not prematurely implement Payment/Refund/Settlement/Payout/Commission/double-entry/balance semantics.

Final verdict must be exactly one of:

- `PHASE 2 STEP 2.10A STRICT REVIEW COMPLETED — APPROVED`
- `PHASE 2 STEP 2.10A STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 2 STEP 2.10A STRICT REVIEW COMPLETED — CHANGES REQUIRED`
- `PHASE 2 STEP 2.10A STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

## 2. Mandatory sources

Inspect current Roadmap, Step 2.10 implementation/review artifacts, Step 2.10A prompt/report, Finance architecture docs, `api.md`, `events.md`, `ids.md`, relevant ADRs, `schema.prisma`, Step 2.10A migration SQL, `backend/src/modules/finance/**`, IdsService, shared Prisma error helpers, request-context/EventBus/Outbox/Inbox, AuditLog, RBAC permissions/seeding, Ledger unit/E2E, Finance 2.10 tests, Order/Booking/Sales/Availability code, and DB globalSetup.

Repository-wide search at minimum:
`LedgerTransaction`, `ledgerTransaction`, `LTX-`, `sourceEventId`, `sourceType`, `sourceId`, `businessRef`, `debit`, `credit`, `balance`, `posting`, `journal`, `Payment`, `Refund`, `Settlement`, `Payout`, `ProviderFee`, `Commission`, `authorizedAt`, `capturedAt`, `paidAt`, `refundedAt`.

Current Roadmap wins on conflict.

## 3. Repository baseline

Record branch, HEAD, tag/version, origin relation, dirty/untracked files, migration count/status, drift/diff, current Roadmap state, current NEXT, exact files changed by 2.10A, and whether 2.10B/2.10C/2.12+ accidentally started.

## 4. Current → Target reconciliation

Build a table for LedgerTransaction, writer authority, read API, Payment, Refund, Commission, Settlement/Payout, Finance temporal, balances, double-entry, FX conversion and Tax posting. Clearly separate active runtime from deferred functionality.

## 5. Ledger ownership — HARD GATE

Prove Finance is sole owner of LedgerTransaction.

Repository-wide classify every production create/read/update/delete/raw SQL/seed/job/cross-domain access.

Expected:
- exactly one canonical create writer inside Finance;
- zero update writers;
- zero delete writers;
- zero raw SQL writers;
- zero Order/Booking/Sales/Availability/Catalog writers.

Any cross-domain direct ledger writer = FAIL / architecture stop.

## 6. Append-only guarantee — CRITICAL HARD GATE

Implementation report claims append-only because there is no `updatedAt` and no update/delete API. That is insufficient alone.

Verify:
- no `update/updateMany/upsert/delete/deleteMany`;
- no subscriber mutation;
- no raw SQL UPDATE/DELETE;
- no cleanup job;
- no admin maintenance path;
- no cascade-delete from a mutable parent that can erase ledger history;
- no production test helper.

If a parent deletion can destroy ledger rows, append-only semantics are not proven.

## 7. Schema / migration review — HARD GATE

Inspect actual fields: id, code, amount, currency, type, sourceType, sourceId, sourceEventId, businessRef, correlationId, causationId, actorType, actorId, createdAt and any extras.

Document nullability, authority, DB type, unique/index use and immutability.

Migration must be additive, fresh-deploy-safe, upgrade-safe, without fabricated backfill or destructive ALTER, and without `db push`.

## 8. Immutability enforcement level

Determine whether immutability is code-level, schema-level or DB-level. Do not claim DB-enforced immutability unless it truly exists.

## 9. Identifier contract — HARD GATE

Verify `LTX-########`: registered in ids.md, canonical IdsService, same transaction as create, DB unique, no MAX()+1/random, concurrency-safe.

## 10. Money / Decimal contract — HARD GATE

Verify DB precision/scale, Prisma Decimal, string serialization, no native float authority, no unsafe `parseFloat`/`Number()` calculations.

Implementation reports `amount > 0`. Confirm this does not prematurely block future reversal/adjustment semantics. If sign/direction policy is undefined and materially constraining, consider architecture stop.

## 11. Transaction type semantics — CRITICAL

Review actual DB type and validation of `type`. Determine whether arbitrary strings are possible, whether any current producer uses them, and whether future namespace/versioning is safe.

## 12. Direction/sign semantics

Determine whether model uses direction, signed amount or type-only classification. No hidden pseudo-accounting convention.

## 13. Double-entry boundary — HARD GATE

Search for debit/credit/account/balance/posting/journal. No incomplete pseudo-double-entry unless Roadmap explicitly requires it.

## 14. Balance boundary

No mutable/persisted balance authority unless explicitly canonical.

## 15. Currency authority — CRITICAL HARD GATE

Determine whether ledger persists a currency snapshot string, FK, or both.

Review unknown/inactive currency behavior, later deactivation/rename, historical interpretability and cascade-delete risks.

Ledger history must survive master-data changes.

## 16. Provenance model — HARD GATE

Review semantics of sourceType/sourceId/sourceEventId/businessRef. Ensure provenance explains why fact exists without PII dumps or mutable snapshots.

## 17. Idempotency unique — CRITICAL HARD GATE

Implementation uses `@@unique(sourceType, sourceId, type)`.

Adversarially determine if too broad or too narrow:
- can same source entity legitimately emit same type more than once?
- can one source event create multiple facts?
- should sourceEventId participate?
- can partial captures/splits/reversals later require duplicates?
- can multiple currencies exist for same source/type?

Do not certify merely because retry tests pass.

If invariant blocks legitimate future finance semantics, return architecture decision required unless canonical sources clearly determine a safe review fix.

## 18. Duplicate conflicting-payload behavior — HARD GATE

Test same idempotency key with different:
- amount;
- currency;
- provenance metadata.

A conflict must not silently return existing row as successful equivalent unless canonical first-write-wins is explicitly defined.

## 19. P2002 handling — HARD GATE

Verify:
- known idempotency constraint → correct duplicate behavior;
- LTX code collision → controlled error/retry, not false idempotency;
- unknown unique violation → controlled failure, not swallowed;
- no raw Prisma 500.

## 20. Concurrency

Test same canonical source concurrently, conflicting amount/currency, and LTX allocation contention if practical. Exactly one valid business fact, deterministic loser, no raw 500.

## 21. Creation authority — HARD GATE

Implementation reports no public POST, only internal `LedgerService.create`.

Verify no create route/alias/manual journal transport/subscriber/cross-domain caller exists. If unused in production, document it as persistence/service foundation, not active posting workflow.

## 22. Read API

Verify `finance.ledger.read`, exact role grants, 401/403/404, whitelist filters, deterministic pagination, no PII/internal leakage.

## 23. Read filters / pagination

Audit type/currency/sourceType/sourceId/businessRef/date filters if present, page cap and deterministic ordering.

## 24. RBAC — HARD GATE

Verify ADMIN, FINANCE, DIRECTOR, ANALYST, BUYER, PARTNER, OPERATOR, SALES_MANAGER, MODERATOR, MARKETER, anonymous. Read-only must remain read-only. No ledger write permission unless explicitly canonical.

## 25. Mass assignment / write-surface absence

Because no public write endpoint is reported, prove HTTP cannot forge id/code/amount/currency/type/provenance/actor/correlation/causation/createdAt. Do not create a write endpoint for testing.

## 26. Correlation / causation — CRITICAL

Review `LedgerService.create` trust boundary. Are correlation/causation derived from context or caller-supplied? Can arbitrary production callers forge them? Distinguish trusted internal input from untrusted HTTP input.

## 27. Actor provenance

Verify actorType/actorId match ADR conventions. No PII. Do not fabricate USER actor for system/event-driven facts.

## 28. Audit vs Ledger

Security AuditLog and LedgerTransaction remain separate concepts.

## 29. Events boundary

Implementation reports 0 Finance events. Verify registry/outbox/subscribers. No speculative Ledger event.

## 30. Payment boundary — HARD GATE

No Payment create/update/authorize/capture, no PSP/Stripe, no Order paymentStatus/paidAmount mutation, no paidAt. Step 2.12 remains deferred.

## 31. PaymentTerms boundary

Finance PaymentTerms remains schema-only. Frozen Sales/Order payment terms remain authority.

## 32. Refund boundary

No Refund workflow or automatic refund ledger posting. Step 2.13 deferred.

## 33. Commission boundary

No Commission calculation/accrual/recognition or automatic ledger posting.

## 34. Settlement / Payout boundary

No ProviderFee/Settlement/Payout/balances. Step 2.10B deferred.

## 35. Temporal 2.10C boundary

No payment milestones; Ledger.createdAt is transaction record time only.

## 36. FX / Tax boundary

Ledger must not select FX, convert currency, calculate FX gain/loss, apply TaxRule, calculate tax, or create tax postings.

## 37. Order / Booking / Availability isolation

Prove zero mutations to Order payment/lifecycle, Booking, Availability, Catalog/Pricing, acquisition source.

## 38. Legacy compatibility

No fabricated ledger backfill for legacy entities. Old rows remain valid without ledger records.

## 39. Negative coverage matrix

Map tests to:
1. anonymous read 401;
2. forbidden roles 403;
3. FINANCE/DIRECTOR/ANALYST/ADMIN read;
4. unknown detail 404;
5. malformed filters;
6. invalid amount;
7. zero/negative amount per contract;
8. unknown currency;
9. sequential duplicate;
10. concurrent duplicate;
11. duplicate key + different amount;
12. duplicate key + different currency;
13. unknown P2002;
14. PATCH absent;
15. DELETE absent;
16. POST absent;
17. no Order mutation;
18. no Booking mutation;
19. no Availability mutation;
20. no Payment/Refund/Settlement/Payout;
21. no Finance milestones;
22. no raw 500.

Add missing high-risk tests.

## 40. Positive coverage matrix

Map tests to:
1. valid internal create;
2. canonical LTX;
3. exact Decimal;
4. currency;
5. type;
6. provenance;
7. sourceEventId;
8. businessRef;
9. correlation;
10. causation;
11. actor;
12. createdAt;
13. immutable readback;
14. replay identical payload returns same canonical fact;
15. concurrent replay one fact;
16. list;
17. detail;
18. filters;
19. pagination;
20. RBAC reads;
21. migration replay;
22. zero cross-domain side effects.

## 41. Write-path audit — REQUIRED

Enumerate every `.ledgerTransaction.create/update/updateMany/upsert/delete/deleteMany` and raw SQL reference. Approval requires no mutable writer.

## 42. Full regression

After review fixes run actual backend typecheck/build/full unit/targeted 2.10A/2.10/RBAC/IDs/event-envelope/Order/Booking/Sales/acquisition/temporal-readiness/Phase2 audit/full serial E2E; frontend typecheck/vitest/build; DB migrate status/fresh replay/drift-diff. Report actual counts.

## 43. Review-fix policy

Architecture-neutral local defects may be fixed. For each: defect → risk → root cause → patch → regression test → targeted rerun → full rerun.

Do not start 2.10B/2.10C/2.12+.

## 44. Architecture stop conditions

Return `PHASE 2 STEP 2.10A STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED` if unresolved:
1. idempotency unique blocks legitimate future facts;
2. idempotency key cannot be determined;
3. amount sign/direction conflicts with future needs;
4. currency history is not durable;
5. append-only broken by cascade/mutation;
6. LedgerService trust boundary permits unsafe cross-domain use;
7. double-entry required but account semantics undefined;
8. balance required but contract undefined;
9. fix requires Payment 2.12;
10. fix requires Refund 2.13;
11. fix requires Settlement/Payout 2.10B;
12. fix requires temporal 2.10C;
13. FX/tax posting semantics required but undefined;
14. competing authority with mutable Payment;
15. active legacy Stripe/PSP writer;
16. migration/backfill compromises history.

## 45. Approval criteria

Approve only if ownership, append-only semantics, schema/migration, LTX IDs, Decimal, currency durability, future-safe idempotency, conflicting duplicate rejection, concurrency, provenance trust, read RBAC, no write API, no downstream finance workflows, no balances/pseudo-double-entry, no cross-domain writes, legacy compatibility and full regression are proven.

## 46. Roadmap update

Only if approved:
- Step 2.10A → `✅ STRICT REVIEW COMPLETED — APPROVED` or `APPROVED WITH REVIEW FIXES`;
- exact NEXT from current Roadmap, expected Step 2.10B;
- do not start NEXT.

## 47. Required final report

Create/update:
`docs/prompts/PHASE_2_STEP_2.10A_LEDGER_TRANSACTION_FOUNDATION_STRICT_REVIEW.md`

Required structure:

# PHASE 2 — STEP 2.10A — LEDGER TRANSACTION FOUNDATION — STRICT REVIEW REPORT

1. Verdict
2. Repository baseline
3. Sources inspected
4. Current → Target reconciliation
5. Ledger ownership
6. Write-path audit
7. Append-only guarantee
8. Schema inventory
9. Migration review
10. Immutability enforcement level
11. Identifier contract
12. Decimal/money contract
13. Type semantics
14. Direction/sign semantics
15. Double-entry boundary
16. Balance boundary
17. Currency authority
18. Provenance model
19. Idempotency unique review
20. Duplicate conflicting-payload behavior
21. P2002 handling
22. Concurrency
23. Creation authority
24. Read API
25. Read filters/pagination
26. RBAC
27. Mass assignment / write-surface absence
28. Correlation/causation
29. Actor provenance
30. Audit vs ledger
31. Events boundary
32. Payment boundary
33. PaymentTerms boundary
34. Refund boundary
35. Commission boundary
36. Settlement/Payout boundary
37. Temporal 2.10C boundary
38. FX/Tax boundary
39. Order/Booking/Availability isolation
40. Legacy compatibility
41. Negative coverage
42. Positive coverage
43. Backend regression
44. Frontend regression
45. DB regression
46. Issues found
47. Review fixes applied
48. Architecture decision status
49. Documentation status
50. Roadmap update
51. Deferred / extension points
52. Out-of-scope confirmation
53. Exact files changed during review
54. **Exact NEXT item**

Final line must repeat the exact verdict.

## 48. Out of scope

Do not implement 2.10B ProviderFee/Settlement/Payout, 2.10C temporal, 2.12 Payment/PSP, 2.13 Refund, 2.14 Invoice, Commission accrual, balances, double-entry account system, FX conversion, tax engine, Finance Center frontend, or reversal workflow unless canonical 2.10A already defines it.

## 49. STOP

After Strict Review: **STOP**.

Do not implement the next Roadmap step in this pass.
