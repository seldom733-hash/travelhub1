# PHASE 2 — STEP 2.3A — CHECKOUT / COMMERCIAL INTENT FOUNDATION — STRICT REVIEW PROMPT

## 0. Роль и режим

Проведи независимый STRICT REVIEW PHASE 2 — STEP 2.3A — Checkout / Commercial Intent Foundation.

Implementation report — НЕ доказательство. Проверяй schema/migration, CheckoutIntent code, Quote integration, availability, acquisition/publication context, service date/time, travelers, options, RBAC/capabilities, history/audit, CAS/concurrency, tests/runtime/docs.

НЕ переходить к Step 2.3B / 2.4.

Local defect → REVIEW FIX + targeted regression + full regression.
Fundamental owner/price/availability/source/options/time identity decision → `ARCHITECTURE DECISION REQUIRED`.

## 1. Roadmap scope

Canonical 2.3A:
Authoritative checkout context: Product/Tariff, travelers, options, service date/time, payment terms, publication/acquisition context. Frontend не источник цены.

Проверить отсутствие premature:
- Payment Terms 2.3B;
- Sale completion/OrderRequested 2.4;
- Order/Booking;
- Payment/Finance;
- availability reservation unless explicitly justified;
- full Checkout UI.

## 2. Repository baseline

Зафиксировать branch/HEAD/git status/actual diff/migration count/untracked files. Не менять unrelated user files.

## 3. Step 2.3 baseline

Подтвердить: issued Quote immutable; Decimal; strict FIXED; validUntil; traveler date-only; no Sale completion; no OrderRequested; no reservation; capability auth.

## 4. Checkout ownership

Проверить owner=Sales (`sales.*`) against ADR. No new bounded context; no cross-context writes. Если owner спорный → architecture decision.

## 5. Data model

Инвентаризировать CheckoutIntent / Traveler / History / enums / Quote relation. Для полей: source, mutable, server-owned, snapshot, exposed, indexed.

## 6. CKT identity

Проверить `CKT-*`: ids contract, BusinessSequence, concurrency-safe, no count()+1. Добавить 20+ parallel creates test if absent.

## 7. Lifecycle

Заявлено DRAFT→READY→EXPIRED/CANCELLED. Проверить graph, timestamps, actor, CAS, terminal semantics.

## 8. READY semantics — CRITICAL

Что означает READY при `checked-not-reserved` availability?
Если READY выглядит как guarantee/reservation — HIGH finding.
READY должен точно означать только то, что реально гарантируется.

## 9. Binding price

Проверить:
- only ISSUED Quote?;
- quote validUntil;
- totals/currency copied server-side;
- no client override;
- no Catalog reprice;
- Catalog mutation after issue does not alter Checkout.

## 10. Monetary reconciliation

Quote→Checkout exact Decimal/rounding/discount/currency. No float/re-rounding drift. Step 2.3A does not yet close Order/Finance monetary propagation.

## 11. Availability — CRITICAL

Implementation says read-only `checked-not-reserved`, while Phase 2 prerequisite said reservation/locking before 2.3A/2.4.

Strict Review must classify:
A) CLOSED in 2.3A;
B) SAFELY DEFERRED TO 2.4 with mandatory atomic revalidate/reserve gate before OrderRequested;
C) BLOCKED;
D) ARCHITECTURE DECISION REQUIRED.

Нельзя оставить просто "open".

## 12. Availability source

Inspect actual Availability/capacity/slots/date/tariff/product model and owner. No invented inventory semantics.

## 13. TOCTOU proof

Simulate two intents against last slot/capacity. If both can become READY, document exact future atomic gate. If none exists before OrderRequested → blocker.

## 14. Service date/time scope

Roadmap requires date/time, implementation says date-only. Determine whether time is legitimately deferred to 2.8A or Step 2.3A incomplete. No fake server timezone.

## 15. Travelers

Check Quote→Checkout traveler semantics, minimization, date-only birthDate, max count, history, post-READY mutability. Traveler changes must not silently invalidate binding price.

## 16. Options — CRITICAL

Roadmap explicitly requires options, report says deferred because no canonical model.
Determine:
- canonical option model truly absent?;
- can Step 2.3A be approved without options?;
- is this roadmap violation or accepted limitation?;
- architecture decision required?

No arbitrary JSON options.

## 17. Payment Terms boundary

Roadmap 2.3A mentions payment terms context; 2.3B defines schemes.
Check whether 2.3A has neutral not-selected/null extension point without prematurely implementing 2.3B. Can READY occur with no terms? What must 2.3B later add?

## 18. Acquisition context — CRITICAL

Report says `acquisitionSource=DIRECT` server-derived.
Verify:
- why DIRECT?;
- from which trusted entry context?;
- Marketplace path preserved?;
- Storefront path preserved?;
- internal Sales-assisted path perhaps MANUAL/DIRECT?;
- future Step 2.5B immutable propagation not destroyed.

If all intents default DIRECT and Marketplace/Storefront origin becomes unrecoverable → HIGH/blocker/architecture finding.

## 19. Publication ≠ acquisition

Verify ProductPublicationChannel != AcquisitionSource != transaction source. Client cannot forge source.

## 20. Customer/Buyer scope

BUYER if supported: actor.customerId server-derived. Internal assisted flow validates customer ref. Anonymous session must not become Customer identity.

## 21. RBAC/capabilities

Check sales.checkout.read/write matrix. Authorization via permissions, not roles. Review why OPERATOR has write and whether DIRECTOR should write/read. ANALYST/MARKETER/FINANCE/PARTNER/MODERATOR/BUYER exact matrix.

## 22. API inventory

List create/get/list/history/travelers/service-date/revalidate/cancel/ready. For each: route, permission, state guard, expectedVersion, response.

## 23. Revalidate semantics

What exactly revalidates: quote validity, availability, price, service date? Must not silently reprice if binding price is Quote-frozen.

## 24. Cancel / expire

Check allowed states, idempotency, timestamps, history, audit. EXPIRED must not use updatedAt as milestone.

## 25. CAS/concurrency

Concurrent traveler/service-date/revalidate/cancel/READY mutations: one winner, coherent history, no lost update.

## 26. History/audit

History should capture created, travelers, service date, revalidate, READY, cancel, expire as applicable. No traveler PII/raw body in history/audit.

## 27. Privacy

No CRM notes/tags/email/phone, Product internals, User auth, raw AuditLog, behavioral identity merge. Travelers minimal.

## 28. Mass assignment

Reject server-owned id/code/status/version/totals/currency/acquisitionSource/availability/timestamps/actor/history/trace/future order/payment IDs.

## 29. ValidationPipe

Shared whitelist+transform, no implicitConversion. Nested travelers validated explicitly.

## 30. Order/Booking/Sale isolation

No Order/Booking/Payment, no OrderRequested, Sale not completed/closed.

## 31. Outbox

No new critical async chain. Retry prerequisite still before/in 2.4/2.5.

## 32. Migration review

Inspect `20260810075633_add_checkout_commercial_intent`: additive, no fake backfill, correct indexes, no forbidden cross-schema FK, prior migrations untouched.

## 33. Quote FK SetNull traceability

Why quoteId SetNull? If Quote deletion can happen, does Checkout lose traceability? Determine production delete policy and risk.

## 34. Acquisition default DIRECT schema audit

If DB default=DIRECT, determine whether missing explicit source silently misattributes analytics. This is a strict-review point.

## 35. Test hygiene

Inspect edits to communication/business-event-envelope/request-context/phase1/quote specs. Ensure only isolation fixes, no hidden product bug, no suite-order dependence.

## 36. Required targeted tests if absent

Add:
1. CKT parallel code generation;
2. source spoof rejection;
3. Marketplace-like trusted source;
4. Storefront-like trusted source;
5. DIRECT default/misattribution;
6. READY with no reservation TOCTOU;
7. READY without options/payment terms;
8. traveler change vs price consistency;
9. quote expiry race;
10. quote SetNull traceability;
11. BUYER foreign customer;
12. service date exact semantics.

If a scenario is unsupported, document absence rather than fabricate.

## 37. Runtime

Independent isolated runtime: create; binding price; forged totals rejected; service date; travelers; revalidate; cancel; acquisition source; checked-not-reserved response; READY meaning; no Order/Booking/Payment/OrderRequested; requestId.

## 38. Replay/regression

migrate status, clean replay, diff no drift.
Backend tsc, unit, Step2.1/2.2/2.3/2.3A e2e, full serial.
Frontend tsc, vitest, next build.
No skipped/timeouts treated as pass.

## 39. Docs

checkout-commercial-intent.md must document owner, CKT, lifecycle/READY, binding price, quote relation, acquisition, publication separation, checked-not-reserved/TOCTOU, exact future atomic reservation gate, service date/time limitation, options omission/owner, payment terms boundary, capabilities, history/audit, concurrency, non-goals.

## 40. DD-022/DD-023 review

Inspect exact deferred decisions. Mandatory 2.3A scope must not be pushed to Deferred Map merely to claim completion.

## 41. Roadmap reconciliation

For options, service time, reservation separately classify:
- implemented;
- acceptable limitation;
- step-local prerequisite before 2.4;
- roadmap violation;
- architecture decision.

## 42. Remaining prerequisites

Keep explicit:
1 Outbox retry before/in 2.4/2.5.
2 Booking currency before 2.8.
3 Monetary propagation into Order/Finance open.
4 Reservation/locking must have owner/gate before 2.4 if not closed.
5 Order snapshot before 2.5.
6 bootstrap removal 2.6.
7 Payment/PSP/ledger 2.10C/2.12.
8 Supplier lifecycle 2.8.
9 Checkout/payment idempotency 2.10.

## 43. Architecture decision triggers

Return `ARCHITECTURE DECISION REQUIRED` if acquisition DIRECT cannot represent real entry paths; mandatory options have no model/owner; reservation owner undefined; READY implies guarantee without reservation; service time required now but absent; Checkout owner conflicts with ADR; binding price ambiguous; anonymous identity must be invented; Payment Terms must be selected before 2.3B.

## 44. Required explicit answers

Answer explicitly:
1 scope respected?
2 owner correct?
3 CKT codes concurrency-safe?
4 lifecycle honest?
5 READY exact meaning?
6 binding price correct?
7 no reprice drift?
8 quote expiry safe?
9 money exact?
10 client cannot forge?
11 availability honest?
12 reserved or not?
13 exact atomic gate before OrderRequested?
14 can two READY intents compete for last slot?
15 acceptable?
16 service date correct?
17 service time satisfied/deferred legitimately?
18 timezone honest?
19 travelers minimized?
20 traveler changes affect price safely?
21 options requirement satisfied?
22 if omitted, can 2.3A still pass?
23 payment terms boundary correct?
24 DIRECT correct?
25 Marketplace source preserved?
26 Storefront source preserved?
27 source spoof impossible?
28 publication != acquisition?
29 BUYER scope safe?
30 internal assisted flow safe?
31 anonymous identity not fabricated?
32 permission-driven?
33 OPERATOR access justified?
34 history complete?
35 audit no PII?
36 CAS safe?
37 no Order/Booking/Payment?
38 no OrderRequested?
39 Sale uncompleted?
40 migration clean?
41 test hygiene safe?
42 full regression green?
43 DD-022/DD-023 legitimate?
44 blockers?
45 architecture decision?
46 approve 2.3A?
47 ready for separate 2.3B prompt after approval?

## 45. Final report format

# PHASE 2 — STEP 2.3A — CHECKOUT / COMMERCIAL INTENT FOUNDATION — STRICT REVIEW — ОТЧЁТ

1 Verdict
2 Repository baseline
3 Files/modules inspected
4 Roadmap scope
5 Step 2.3 baseline
6 Checkout ownership
7 Data model
8 Canonical ID
9 Lifecycle
10 READY semantics
11 Quote relation
12 Binding price
13 Monetary reconciliation
14 Price authority
15 Availability model
16 Checked-not-reserved
17 TOCTOU/last-slot
18 Reservation prerequisite status
19 Service date
20 Service time
21 Timezone
22 Travelers
23 Traveler/price consistency
24 Options
25 Payment terms boundary
26 Acquisition context
27 DIRECT semantics
28 Publication/acquisition separation
29 Step2.5B compatibility
30 Customer/Buyer scope
31 Anonymous boundary
32 RBAC/capabilities
33 API inventory
34 Revalidate
35 Cancel/Expire
36 CAS/concurrency
37 Failure atomicity
38 History
39 Audit
40 Privacy
41 DTO/mass-assignment
42 ValidationPipe
43 Error model
44 Order/Booking/Sale isolation
45 Outbox/reliability
46 Migration review
47 Quote SetNull traceability
48 Legacy/null semantics
49 Unit quality
50 E2E quality
51 Test hygiene
52 Runtime
53 Replay/drift
54 Full regression
55 Documentation
56 Deferred Decisions
57 Roadmap reconciliation
58 Remaining prerequisites
59 Findings
60 Review fixes
61 Remaining debt
62 Architecture decision
63 Approval recommendation
64 Out-of-scope
65 Files changed during review

## 46. Allowed verdicts

`PHASE 2 STEP 2.3A STRICT REVIEW COMPLETED — APPROVED`
or
`PHASE 2 STEP 2.3A REVIEW FIXES COMPLETED — WAITING FOR APPROVAL`
or
`ARCHITECTURE DECISION REQUIRED`
or
`PHASE 2 STEP 2.3A STRICT REVIEW FAILED — BLOCKER FOUND`

## 47. Stop condition

После Strict Review НЕ начинать 2.3B/2.4. Вернуть полный report и ждать explicit approval.
