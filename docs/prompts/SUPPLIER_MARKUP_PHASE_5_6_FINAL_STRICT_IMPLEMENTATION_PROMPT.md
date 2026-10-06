# SUPPLIER MARKUP — PHASE 5–6 FINAL STRICT IMPLEMENTATION PROMPT

## FINAL CONTINUATION FROM CONFIRMED PHASE 4 PASS

**Project:** TravelHUB  
**Workstream:** Supplier Markup  
**Current execution point:** Phase 5  
**Phase 0:** PASS  
**Phase 1:** PASS  
**Phase 2:** PASS  
**Phase 3:** PASS  
**Phase 4:** **PASS — re-confirmed 06.10**  
**Phase 5:** PENDING  
**Phase 6:** PENDING  

**Execution mode:** STRICT / sequential / gate-driven.

---

# 1. PURPOSE

This document is the **final continuation prompt** for the Supplier Markup workstream.

The developer must continue from the actual state recorded in the latest interim §37 report.

## CRITICAL

Do NOT reopen Phase 4 as unfinished.

Phase 4 has already been explicitly re-confirmed as:

```text
PHASE 4 = PASS
```

The Phase-4 gate includes Admin Markup Matrix, dynamic registry source, NOT_CONFIGURED, MarkupRule administration, `pricing.markup.read/manage`, `sales.discount.grant`, Live Sales discount, supplier price floor, Request commercial snapshot, frozen accepted pricing, Request → Order propagation, frontend hardcode cleanup, Request Modal, duplicate form removal, registered-user flow, guest flow, phone/email validation, exact offer preservation, unit/integration/E2E tests, typecheck, and no Phase 0–3 regression.

The latest report explicitly records:

```text
PHASE 4 = PASS (re-confirmed, 06.10)
```

Therefore:

```text
START HERE → PHASE 5
```

Do not duplicate already-completed Phase 4 work unless a Phase 5/6 regression investigation proves that a Phase 4 component is affected.

---

# 2. CURRENT VERIFIED BASELINE

The latest report records:

## Backend
```text
152/152 suites
2412/2412 tests
```

## Backend TypeScript
```text
tsc --noEmit = 0 errors
```

## Frontend
```text
61/61 files
989/989 tests
```

## Frontend TypeScript
```text
tsc --noEmit = 0 errors
```

These numbers are the Phase 5 starting baseline. Any regression introduced by Phase 5 or Phase 6 must be identified.

---

# 3. CURRENT E2E STATE

The latest full E2E re-run produced:

```text
53/107 suites green
1060/1416 tests green
```

The 54 red suites were classified as:

```text
29 — pre-existing 403 owner-rule cluster
4  — date-rot
17 — OOM / parallel execution artifacts
2  — waitFor timing
```

This classification must be re-verified in Phase 6.

Do not simply repeat “pre-existing”. If markup work affects a failure, it becomes a markup-related failure and must be investigated.

---

# PHASE 5 — SYNC & RECONCILIATION

## 5.1 Objective

Complete all remaining Supplier Markup integration into synchronization and reconciliation paths.

Mandatory scope:

```text
5.1 Supplier sync pricing
5.2 Public/Tariff price consistency
5.3 amount:0 fallback elimination
5.4 PRICE_UNAVAILABLE behavior
5.5 Reconciliation
5.6 Pricing debug cleanup
5.7 Relevant stale/copyright cleanup
5.8 Phase 5 regression testing
```

---

## 5.2 Supplier sync pricing

Use the approved chain:

```text
Supplier price
    ↓
SupplierPricingService
    ↓
TravelHUB MarkupRule
    ↓
Public price
```

There must not be an independent second markup formula inside a synchronization adapter.

The established pricing architecture remains authoritative.

For tours/hotels:

```text
SupplierAdapterRegistry
    ↓
SupplierOfferService
    ↓
SupplierPricingService.resolveSafe()
    ↓
ONE calculation
    ↓
publicAmount
```

Phase 5 must make synchronization paths conform to this architecture.

---

## 5.3 Affected sync paths

The current report identifies affected fallback paths in:

```text
ANEX
ANEX-HOTEL
KAZUNION
SUMMERTOUR
```

Inspect all relevant synchronization code in these adapters.

Do not assume this list is exhaustive if code inspection proves another affected fallback.

Do not expand into unrelated supplier work without evidence.

---

## 5.4 Tariff / public price

Where synchronized `Tariff` represents public selling price:

```text
Tariff = supplier price + TravelHUB markup
```

Do not store raw supplier price where public price is required.

Do not apply markup again to an already marked-up Tariff.

Mandatory invariant:

```text
No double markup.
```

Example:

```text
Supplier = 1000
Markup = 5%

First:
1000 → 1050

Second:
1050 → MUST remain 1050
```

---

## 5.5 Eliminate `amount:0` fallbacks

The interim report explicitly identifies:

```text
amount:0
```

fallbacks as a remaining Phase 5 item.

Audit and remove these fallbacks.

Do NOT use zero as a substitute for:

```text
price unavailable
price parsing failure
missing supplier price
invalid supplier price
```

A missing/invalid supplier price must not become a valid commercial zero price.

---

## 5.6 Invalid-price handling

Distinguish:

```text
valid supplier price
```

from:

```text
PRICE_UNAVAILABLE
```

Cases requiring unavailable/invalid handling include:

```text
missing amount
invalid amount
supplier parsing failure
supplier response without usable price
fake zero fallback
negative price
```

Do not reinterpret a legitimate domain-specific zero price unless the supplier contract proves zero is invalid.

---

## 5.7 PRICE_UNAVAILABLE

When no valid supplier price exists, use the project's established unavailable-price behavior:

```text
PRICE_UNAVAILABLE
```

Do not invent a competing error model.

An invalid supplier response must not create a commercially valid Request with:

```text
supplierPrice = 0
```

---

## 5.8 Reconciliation

Complete the approved reconciliation between:

```text
stored/public price
        ↕
supplier price
```

Respect:

- supplier price authority;
- freshness;
- existing confirmation flow;
- frozen accepted commercial snapshots.

### Historical rule

After customer acceptance:

```text
commercialSnapshot = frozen historical fact
```

Later synchronization must NOT rewrite the accepted Request/Order commercial fact.

Later supplier changes may produce the existing:

```text
PRICE_CHANGED
reconfirmation
availability issue
new offer
```

behavior.

They must not silently rewrite historical acceptance.

---

## 5.9 Debug cleanup

Remove scoped pricing debug artifacts identified by the audit/report, including:

```text
D:	ravelhub_v1ackend_price_chain.log
```

and relevant pricing `console.log` debugging.

Preserve legitimate structured operational logging.

---

## 5.10 Stale/copyright pricing text

Review relevant stale pricing text identified by the audit.

In particular, inspect copy that claims or implies:

```text
no hidden markup
```

where the new supplier markup architecture makes that inaccurate.

Only modify relevant stale pricing/copyright text.

---

## 5.11 Phase 5 tests

Add/update tests for:

```text
supplier price → markup → public price
no double markup
missing supplier price → PRICE_UNAVAILABLE
fake amount:0 → unavailable/error
negative price → rejected
reconciliation
accepted snapshot remains immutable
Phase 0–4 regression
```

---

## 5.12 Phase 5 Gate

All must pass:

```text
[ ] all affected sync services inspected
[ ] markup uses approved pricing boundary
[ ] Tariff/public price consistency
[ ] no double markup
[ ] amount:0 fallback removed
[ ] PRICE_UNAVAILABLE behavior
[ ] invalid supplier money rejected
[ ] reconciliation completed
[ ] accepted snapshot immutable
[ ] debug file artifact removed
[ ] relevant pricing debug logs removed
[ ] stale pricing/copyright reviewed
[ ] backend tests pass
[ ] affected frontend tests pass
[ ] typecheck passes
[ ] targeted E2E passes
[ ] no Phase 0–4 regression
```

If any mandatory item fails:

```text
PHASE 5 = FAIL
STOP.
DO NOT START PHASE 6.
```

---

# PHASE 6 — HARDENING + FINAL §37

Phase 6 is the final hardening and verification phase.

It must NOT be reduced to `npm test`.

---

## 6.1 Full E2E hardening

Run the complete applicable E2E matrix.

Final report must include:

```text
total suites
passed suites
failed suites
skipped suites
total tests
passed tests
failed tests
```

Do not report only the green subset.

---

## 6.2 Failure classification

Every failed suite must be classified as:

```text
A. Supplier Markup regression
B. Supplier Markup-related pre-existing issue
C. unrelated pre-existing issue
D. test-environment / OOM / parallel artifact
E. stale fixture / stale test contract
```

Every classification requires evidence.

---

## 6.3 Known 403 owner-rule cluster

Known behavior:

```text
POST /api/v1/products
without partnerId
→ ForbiddenError
```

The current report attributes this to:

```text
catalog.service.ts:244
commit 1ced16b
28.08.2026
```

and identifies it as a foreign catalog workstream issue.

Do not weaken this rule merely to improve E2E results.

Verify that markup permissions do not cause or alter this behavior.

---

## 6.4 Known date-rot cluster

Four reverse-workstream fixtures use:

```text
serviceDateFrom: "2026-09-01"
```

and therefore fail current date validation.

Affected:

```text
buyer-requests
reverse-conversation
reverse-conversion
reverse-proposal
```

Do not modify unrelated fixtures as part of Supplier Markup unless evidence proves a direct dependency.

---

## 6.5 Known OOM / parallel cluster

17 suites have OOM/SIGTERM/parallel execution artifacts.

Verify whether failures disappear when run individually.

Do not weaken application behavior to hide an OOM.

---

## 6.6 Known waitFor timing cluster

Known:

```text
d13-voucher-lifecycle
d4-representative-chain
```

Verify Supplier Markup did not change the relevant eventbus/outbox chain.

If unrelated, document and isolate.

If affected, investigate before final PASS.

---

## 6.7 Phase-4 relevant regression

The latest report identifies the following relevant suites as green:

```text
request-discount-grant
d3-request-flow
order-to-request
pricing-markup-admin
period-pricing
request-center-search
ui-c6-request-server-authority
validation-pipe
storefront
rbac-parity
commercial-restriction
commission-policy-foundation
buyer-identity
phase2-entry-audit
```

After Phase 5, re-run relevant suites.

If one becomes red because of Phase 5:

```text
STOP
```

and investigate.

---

## 6.8 RBAC hardening

Final verification:

```text
pricing.markup.read
pricing.markup.manage
sales.discount.grant
```

Test:

```text
authorized → allowed
unauthorized → rejected
unrelated permission → not sufficient
```

Do not weaken authorization.

---

## 6.9 Concurrent MarkupRule activation

Test concurrent activation for the same supplier/service/time interval.

Existing protections include:

```text
version
CAS
overlap checks
advisory-lock protection
```

Expected:

```text
at most one conflicting ACTIVE rule
```

No race-created duplicate ACTIVE rules.

---

## 6.10 Idempotency

Verify repeated operations.

### Markup

```text
1000 → 1050 → 1050
```

not:

```text
1000 → 1050 → 1102.50
```

### Request

Repeated commands must follow existing idempotency/conflict semantics.

### Discount

Repeated operations must not create contradictory commercial state.

### Snapshot

Repeated acceptance must not mutate frozen history.

---

## 6.11 Pricing resolver concurrency / load

Test concurrent resolution.

Verify:

```text
same supplier/service
same active rule
concurrent resolve
→ consistent result
```

Check relevant cache/registry/locking behavior.

No race may produce:

```text
different markup
double calculation
missing rule
conflicting rule
```

Do not introduce an unnecessary global lock.

---

## 6.12 Flight hardening

Preserve:

```text
FlightSupplierRegistry
→ search fan-out
→ FlightSearchResult.collectedAt
→ one markup per fare
→ authoritative displayedPrice
```

`body.price` is not authoritative.

Do not introduce:

```text
FlightSupplier.refreshPrice
```

---

## 6.13 Flight freshness

Preserve:

```text
collectedAt
→ supplierPriceFetchedAt
→ supplierPriceExpiresAt
```

with the established:

```text
5 minute TTL
```

Expected:

```text
fresh → reuse
stale → full re-search
```

---

## 6.14 Tour/hotel freshness

Preserve:

```text
supplierPriceFetchedAt
supplierPriceExpiresAt
```

from the established supplier refresh mechanism.

Do not create a competing freshness architecture.

---

## 6.15 Storefront isolation

Prove:

```text
Supplier Markup
≠
CommissionPolicy
```

Existing Storefront commission tests must remain green.

No Storefront commission regression.

---

## 6.16 Request / Order commercial integrity

Verify the full chain:

```text
Supplier price
→ markup
→ public price
→ optional Live Sales discount
→ customer final
→ Request snapshot
→ customer acceptance
→ Order
```

Mandatory:

```text
customerFinalPrice >= supplierPrice
```

and:

```text
accepted commercialSnapshot = frozen
```

---

## 6.17 Architecture documentation

Update relevant documentation under:

```text
docs/architecture/
```

Document:

### Pricing

```text
supplier price
→ TravelHUB markup
→ public price
```

### Live Sales

```text
public price
→ individual discount
→ customer final
```

### Supplier floor

```text
final >= supplier
```

### MarkupRule

```text
DRAFT
ACTIVE
ARCHIVED
version
effectiveFrom
effectiveTo
audit
NOT_CONFIGURED
```

### Registry SSOT

```text
SupplierAdapterRegistry
FlightSupplierRegistry
```

### Commercial snapshot

Document supplier price, currency, markup, public price, discount, final price, source, acceptance/freshness context.

### Flights

```text
collectedAt
5-minute TTL
re-search
body.price not authoritative
no FlightSupplier.refreshPrice
```

### Storefront

```text
CommissionPolicy remains separate
```

### Sync

```text
Tariff/public price
amount:0 removal
PRICE_UNAVAILABLE
reconciliation
```

---

# 6.18 FINAL GATES A–L

## Gate A — Dynamic Registry

Prove:

```text
new supplier/service
→ pricing matrix expands without hardcoded supplier UI
```

## Gate B — Rule Isolation

Prove:

```text
MarkupRule separate from CommissionPolicy
```

and Storefront commission tests remain green.

## Gate C — Single Calculation

Prove:

```text
1000 + 5% = 1050
```

and second application remains 1050.

## Gate D — Supplier Floor

Prove:

```text
supplier 1000 / final 1020 → PASS
supplier 1000 / final 990  → REJECT
```

## Gate E — Invalid Money

Reject:

```text
missing supplier price
fake zero fallback
negative price
missing currency
invalid public price
invalid final price
final < supplier
```

## Gate F — Snapshot

Prove:

```text
customer acceptance
→ frozen snapshot
```

and later rule changes do not mutate it.

## Gate G — Request / Order

Prove:

```text
invalid money
→ customerAccept blocked
→ conversion blocked
```

and:

```text
valid snapshot
→ Request
→ Order
→ commercial facts preserved
```

## Gate H — Flights

Prove:

```text
FlightSupplierRegistry
→ fan-out
→ one markup
→ authoritative displayedPrice
```

and client `body.price` cannot override it.

## Gate I — Freshness

Prove:

```text
fresh < 5 min → reuse
stale >= 5 min → re-search
```

## Gate J — RBAC

Prove:

```text
pricing.markup.read
pricing.markup.manage
sales.discount.grant
```

positive and negative authorization.

## Gate K — Storefront

Prove:

```text
CommissionPolicy untouched
```

and commission tests green.

## Gate L — Hardening

Gate L requires evidence for:

```text
full E2E
RBAC
idempotency
concurrency
pricing resolution/load
sync/reconciliation
debug cleanup
documentation
final regression
```

Gate L cannot be marked PASS merely because A–K pass.

---

# 6.19 Full regression

Run at minimum:

```text
npm test
npm run typecheck
```

for backend and the equivalent frontend commands used by the repository.

Run all applicable E2E suites.

Record exact numbers.

Do not report merely:

```text
tests look good
```

---

# 6.20 Migration safety

The report documents unrelated migration drift:

```text
20260926125000_roomtype_aliases
20260926130000_room_view
```

without corresponding committed folders.

Do NOT reconstruct unrelated migration folders.

Established procedure:

```text
migration SQL folder
→ npx prisma migrate deploy
→ npx prisma generate
```

Do not use:

```text
prisma migrate dev
```

for this workstream.

---

# 6.21 Git safety

The repository contains unrelated workstreams.

Before final commit:

```text
git status
git diff
```

Review them.

Do not accidentally commit:

```text
Stage 1/2
M4.x WhatsApp
Booking
catalog
reverse
other unrelated work
```

Only Supplier Markup changes belonging to this workstream may be committed.

---

# 6.22 Commit / push rule

Do NOT commit or push before:

```text
Phase 5 PASS
Phase 6 PASS
Gates A–L PASS
final regression reviewed
git diff reviewed
unrelated changes excluded
```

If any final gate is unresolved:

```text
NO COMMIT
NO PUSH
```

---

# 7. REQUIRED PHASE 5 REPORT

After Phase 5 provide:

```text
PHASE 5 — FINAL REPORT

A. Sync services changed
B. Adapters inspected
C. Tariff/public price behavior
D. amount:0 findings
E. PRICE_UNAVAILABLE implementation
F. Reconciliation
G. Debug cleanup
H. Stale/copyright cleanup
I. Files changed
J. Tests added/changed
K. Backend tests
L. Frontend tests
M. Typecheck
N. Targeted E2E
O. Regressions
P. Git status
Q. PHASE 5 GATE
```

End with exactly one:

```text
PHASE 5 = PASS
```

or:

```text
PHASE 5 = FAIL
```

If FAIL:

```text
STOP.
DO NOT START PHASE 6.
```

---

# 8. REQUIRED PHASE 6 / FINAL §37 REPORT

After Phase 6 provide:

```text
FINAL SUPPLIER MARKUP §37 REPORT

1. Executive summary
2. Phase 5 result
3. Phase 6 result
4. All changed files
5. All migrations
6. Sync/reconciliation result
7. Full E2E statistics
8. Failure classification
9. RBAC evidence
10. Idempotency evidence
11. Concurrency evidence
12. Load/resolution evidence
13. Flight freshness evidence
14. Request/Order commercial integrity
15. Storefront isolation
16. Gates A–L
17. Documentation
18. Typecheck
19. Full regression
20. Migration state
21. Git diff review
22. Git status
23. Commit
24. Push
25. Final verdict
```

---

# 9. FINAL VERDICT RULE

The workstream may be declared complete ONLY if:

```text
Phase 5 = PASS
AND
Phase 6 = PASS
AND
Gate A = PASS
AND
Gate B = PASS
AND
Gate C = PASS
AND
Gate D = PASS
AND
Gate E = PASS
AND
Gate F = PASS
AND
Gate G = PASS
AND
Gate H = PASS
AND
Gate I = PASS
AND
Gate J = PASS
AND
Gate K = PASS
AND
Gate L = PASS
```

Only after this condition may the developer state:

```text
SUPPLIER MARKUP = COMPLETE
```

---

# 10. NON-NEGOTIABLE RULES

1. **Do not reopen Phase 4 as unfinished.**
2. **Do not skip Phase 5.**
3. **Do not reduce Phase 6 to `npm test`.**
4. **Do not weaken existing tests to obtain green results.**
5. **Do not classify a failure as pre-existing without evidence.**
6. **Do not fix unrelated workstreams merely to improve the E2E percentage.**
7. **Do not introduce a second pricing calculation boundary.**
8. **Do not permit double markup.**
9. **Do not use fake `amount:0` as a valid supplier price.**
10. **Do not mutate accepted commercial snapshots during reconciliation.**
11. **Do not introduce `FlightSupplier.refreshPrice`.**
12. **Do not allow client `body.price` to become commercial authority.**
13. **Do not modify `CommissionPolicy` to implement supplier markup.**
14. **Do not reconstruct unrelated Prisma migration drift.**
15. **Do not commit unrelated workstreams.**
16. **Do not commit or push before the final Gates A–L pass.**

---

# 11. START COMMAND

The developer should begin by stating:

```text
PHASE 4 is accepted as PASS based on the latest interim §37 report.

I am starting PHASE 5.

I will not reopen completed Phase 4 work unless a Phase 5/6 regression investigation demonstrates a direct dependency.
```

Then execute Phase 5 strictly in the order defined above.
