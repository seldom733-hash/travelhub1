# PHASE 2 — STEP 2.2B — BUYER REQUEST FOUNDATION — STRICT REVIEW

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.2B  
**Mode:** STRICT REVIEW ONLY  
**Canonical owner:** Reverse Marketplace (`reverse.*`)  
**Prerequisite:** Step 2.2B implementation completed; Step 2.2A approved  
**Next if APPROVED:** Step 2.2C — Matching & Distribution  
**Hard rule:** Step 2.2C MUST NOT START in this pass.

---

## 1. MISSION

Perform an independent, adversarial STRICT REVIEW of the completed implementation:

**PHASE 2 — STEP 2.2B — Buyer Request Foundation**

Do not approve from the implementation report alone. Inspect repository truth, migrations, runtime behavior, tests, security boundaries, ADR/DD compliance and the canonical Roadmap.

Final verdict must be one of:

- `PHASE 2 STEP 2.2B STRICT REVIEW COMPLETED — APPROVED`
- `PHASE 2 STEP 2.2B STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 2 STEP 2.2B STRICT REVIEW COMPLETED — CHANGES REQUIRED`
- `ARCHITECTURE DECISION REQUIRED`

---

## 2. CANONICAL EXECUTION GATE

Current sequence:

`2.2B implementation → 2.2B STRICT REVIEW → APPROVED → 2.2C`

This pass MUST NOT implement Step 2.2C, Seller request inbox, matching/distribution, Seller Proposal, BuyerRequest/Proposal Communication, Proposal → Sales conversion, Service Templates 1.8A–1.8D, or Universal Pricing implementation.

If review passes, update Roadmap status only and set **2.2C as NEXT**.

---

## 3. BASELINE AND SOURCES

Inspect actual repository state first:

- `git status`, `git diff`, branch, HEAD and recent log;
- current migration status and Prisma schema;
- Step 2.2B implementation files and tests;
- pre-existing dirty work separately from review changes.

Inspect latest canonical sources:

- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- `CURRENT CANONICAL EXECUTION SEQUENCE`;
- ADR-0012, ADR-0001, ADR-0007, ADR-0011;
- Deferred Decisions Map including DD-028 and DD-030;
- Step 2.2A implementation and STRICT REVIEW;
- `reverse-buyer-requests.md`;
- `docs/contracts/ids.md`;
- Reverse module/controller/service/validation;
- permission and forbidden-field conventions;
- IdsService;
- Catalog Category;
- CRM Customer;
- Sales acquisition enum;
- AuditLog/EventBus conventions;
- Step 2.2B targeted tests.

Roadmap and approved ADRs are authoritative if they conflict with this prompt.

---

## 4. OWNERSHIP — HARD GATE

Verify:

`BuyerRequest → reverse.*`

BuyerRequest persistence must not be owned by CRM, Catalog, Sales, Communication, Order or Booking.

Reverse may READ trusted CRM Customer and Catalog Category references, but must not write those contexts.

Any cross-context write or ownership contradiction is a HARD FAILURE unless an ADR is genuinely required.

---

## 5. DOMAIN SEMANTICS

BuyerRequest must remain a demand entity: a Buyer describes a desired service before selecting a canonical commercial offer.

It must NOT become Product, Lead, Opportunity, Quote, Checkout, Sale, Order, Booking, Proposal, Match or Communication thread.

Creating/updating/submitting/cancelling a BuyerRequest must create zero Lead, Opportunity, Quote, CheckoutIntent, Sale, OrderRequested, Order, Booking or Payment.

DD-030 must remain unresolved until 2.2F.

---

## 6. NO MATCHING / DISTRIBUTION

Step 2.2B must not:

- query eligible Sellers as a side effect;
- use SellerCapability to distribute;
- create match/distribution records;
- populate Seller inbox;
- rank or notify Sellers;
- create Lead per Seller;
- expose requests to Sellers.

`SUBMITTED` may mean ready for future matching only.

---

## 7. SELLER ACCESS — CRITICAL SECURITY GATE

A Seller must not read a BuyerRequest merely because category/coverage matches, capability is ACTIVE, or `acceptsBuyerRequests=true`.

Test PARTNER against list, get, history and guessed UUID/BRQ identifiers.

Expected: no BuyerRequest access before server-authoritative Step 2.2C distribution.

---

## 8. BUYER OWN-SCOPE / IDOR

All Buyer-facing operations must derive ownership from authenticated server context.

Verify list/get/history/update/submit/cancel.

Another Buyer must not gain access through UUID or BRQ guessing, query manipulation, or forged buyer/customer/owner identifiers.

Use neutral 404 where established by repository convention.

Verify `actor.customerId` is server-derived and BUYER without valid Customer context is rejected.

---

## 9. RBAC

Verify reported permissions and actual conventions.

BUYER gets own-scope request access only. PARTNER must not gain request read/write rights. Anonymous access is denied. Staff/admin behavior must follow canonical capability conventions and must not accidentally create global BuyerRequest access.

---

## 10. BRQ ID CONTRACT

Verify `BRQ-*` is registered exactly once, generated through atomic canonical IdsService sequencing, protected by uniqueness, and not client-authoritative.

Do not add Proposal IDs prematurely.

---

## 11. CATEGORY AUTHORITY

Verify category authority remains `catalog.Category`.

Category must be server-validated and no second Reverse category taxonomy may exist.

Product existence must NOT be required.

If category can change while DRAFT, verify category snapshot fields such as `categorySlug` update atomically and correctly.

Prove:

`active Category + zero Products → BuyerRequest can still be created/submitted`.

---

## 12. DESTINATION MODEL / DD-028

Destination describes requested service location, never Buyer home/legal country.

Review country normalization, city-country validation, worldwide semantics, duplicates, malformed objects, unknown keys, empty destination behavior and deterministic normalization.

DD-028 must remain deferred.

Because destinations are reportedly JSONB, verify validation guarantees a stable enough shape for Step 2.2C and document query/index implications. Do not silently approve a representation that is already known to block safe matching.

---

## 13. DATE SEMANTICS

Verify date-only `YYYY-MM-DD` semantics, from/to validation, exact-date behavior, no-past-date policy, `from <= to`, and open/flexible date behavior.

Critically verify that both dates being null has a documented domain meaning rather than an accidental unbounded request.

Do not introduce timezone/time-slot semantics before Step 2.8A.

---

## 14. PAX — CRITICAL MODEL REVIEW

Review whether mandatory `adults >= 1` is genuinely valid for all current BuyerRequest categories.

Consider categories such as transfer, car rental and other services where traveler composition may not be the primary demand dimension.

If current canonical categories justify the rule, prove it from repository truth. If not, this is an overfit and requires a local review fix or an honest category-neutral representation.

Do NOT implement the future Service Templates system here.

---

## 15. BUDGET

Budget must remain a non-binding demand hint.

Verify currency validation, non-negative values, min/max consistency, no currency conversion, no binding Quote/Sale semantics and no use as authoritative commercial money.

If JSON numeric values use JS floating point, explicitly determine whether that is acceptable only because budget is non-binding. Do not describe it as authoritative money.

---

## 16. PREFERENCES / PII — CRITICAL SECURITY REVIEW

Aggressively review any free-form preferences JSON.

Test nested objects/arrays, casing, Unicode and alternative contact keys such as `mobile`, `tel`, `mail`, `e-mail`, `wa`, social handles and generic keys whose values contain phone/email data.

Also inspect nesting depth, size bounds and dangerous object keys.

The system need not become a full DLP engine, but documentation/tests must not claim PII safety if only top-level key substrings are checked.

If free-form preferences cannot be bounded safely, prefer a narrower validated representation or document the limitation honestly.

---

## 17. PII MINIMIZATION

BuyerRequest/history/audit/API must not expose unnecessary email, phone, messenger handles, passport/document data, raw CRM profile, addresses or other contact PII.

Seller must receive zero contact data in this step.

---

## 18. ACQUISITION SOURCE

Verify `BUYER_REQUEST` is server-authoritative, cannot be forged or mutated, and does not require creating Sales entities.

Future 2.2F must preserve it into canonical Sales, but that conversion is out of scope now.

---

## 19. LIFECYCLE

Verify the implemented lifecycle exactly against Roadmap.

If reported as `DRAFT → SUBMITTED → CANCELLED` plus `DRAFT → CANCELLED`, check valid/invalid transitions, submittedAt/cancelledAt, update-only-in-DRAFT behavior, terminal immutability and repeat-transition semantics.

No MATCHED, DISTRIBUTED, PROPOSAL_RECEIVED, SELECTED or CONVERTED state may be introduced prematurely.

---

## 20. CAS / CONCURRENCY

Inspect actual implementation, not just tests.

Require atomic `expectedVersion` conditional mutation, stale → 409, one version increment, and no loser history/audit.

Review final state and history for:

- update vs update;
- update vs submit;
- submit vs cancel;
- cancel vs update;
- duplicate submit/cancel.

A mere “one 2xx and one 409” assertion is insufficient without validating the final aggregate state.

---

## 21. DUPLICATE CREATE

Confirm separate legitimate identical BuyerRequests may coexist and there is no hidden business dedupe or uniqueness rule.

If HTTP create idempotency is not implemented, document that honestly rather than inventing heuristic deduplication.

---

## 22. MASS ASSIGNMENT

Attempt forged server-owned fields including:

`id`, `code`, `buyerId`, `customerId`, `ownerId`, `status`, `version`, `acquisitionSource`, `source`, `createdBy`, lifecycle timestamps, created/updated timestamps, category snapshots, seller/matching/distribution fields, entitlement fields, correlation/causation.

No server-owned field may become client-authoritative.

---

## 23. HISTORY / AUDIT

Verify history for meaningful created/updated/submitted/cancelled facts, actor/timestamps/from-to/changed fields as appropriate, no failed-operation history and no PII.

Verify Security AuditLog follows project conventions and does not record successful mutation for stale CAS/IDOR failures.

---

## 24. FAILURE ATOMICITY

Prove failed create/update/submit/cancel leaves no partial:

- BuyerRequest mutation;
- version increment;
- history;
- success audit;
- outbox;
- Sales/Catalog/Communication side effects.

Cover invalid payload, stale CAS, invalid lifecycle and foreign-object attempts.

---

## 25. EVENTS / OUTBOX

Implementation reportedly emits no BuyerRequest event.

Determine from Roadmap whether this is correct.

Do not demand speculative events. However, ensure Step 2.2C can safely initiate distribution without requiring an architecture-breaking polling/coupling workaround.

If durable submission event is canonically required, identify whether it belongs to 2.2B or 2.2C before approval.

---

## 26. REVERSE SCHEMA SCOPE

After 2.2B, `reverse.*` should contain only approved 2.2A/2.2B persistence such as SellerCapability/history and BuyerRequest/history plus required enums/indexes.

It must NOT contain Match, Distribution, SellerRequestInbox, SellerProposal, ProposalPrice, reverse-owned chat, reverse Quote or reverse Order.

---

## 27. CROSS-DOMAIN ISOLATION

Prove no writes to Catalog Product/Tariff/Availability/Reservation/PublicSellerProfile.

Prove no writes to Sales/Order/Booking/Payment.

Prove no reverse-owned Communication system and no automatic CML creation.

---

## 28. INDEXES / PAGINATION

Review actual own-list and future submitted-category query paths.

Verify bounded pagination, deterministic ordering with tie-breaker, correct total, no cross-Buyer leakage, and stable behavior for equal timestamps.

If JSONB destination matching will need indexes later, document that without implementing speculative ranking infrastructure.

---

## 29. MIGRATION

Inspect migration SQL directly.

Verify additive reverse-owned tables/enums/indexes, no destructive backfill, no prohibited cross-schema FK, clean replay, migrate status up to date, drift 0 and no `db push`.

---

## 30. TEST QUALITY / SHARED DB

Inspect targeted tests rather than trusting counts.

Look for weak race assertions, wrong response objects, global-zero assumptions, order dependence, incomplete cleanup, mock-only behavior and shallow PII tests.

Review cleanup of BuyerRequest/history/AuditLog and related test-created identity/event rows. Do not delete unrelated suites' data.

---

## 31. REGRESSION GATES

Re-run Step 2.2A and verify BuyerRequest work did not weaken SellerCapability invariants. In particular, `acceptsBuyerRequests=true` must NOT expose requests.

Re-run Step 2.5B acquisition propagation and verify `BUYER_REQUEST` remains canonical without falsely implying Reverse → Sales conversion already exists.

Frontend should remain unchanged; do not implement BuyerRequest UI during this review.

---

## 32. REQUIRED TARGETED REVIEW PROOF

At minimum confirm or add meaningful proof for:

1. anonymous denied;
2. PARTNER denied;
3. BUYER without Customer context denied;
4. Buyer creates own request;
5. zero Product dependency;
6. invalid/inactive Category rejected;
7. category change snapshot consistency;
8. destination normalization;
9. destination not derived from Buyer country;
10. cross-Buyer isolation for list/get/history/update/submit/cancel;
11. forged ownership/source/status rejected;
12. PAX boundaries and category-neutrality;
13. date exact/range/open semantics;
14. budget non-binding validation;
15. nested/free-form preferences PII bypass review;
16. submit;
17. cancel DRAFT;
18. cancel SUBMITTED;
19. repeat lifecycle semantics;
20. stale CAS;
21. update/update race final state;
22. update/submit race final state;
23. submit/cancel race final state;
24. history correctness;
25. audit correctness;
26. failure atomicity;
27. Seller with matching capability still denied;
28. no matching/distribution;
29. no Proposal;
30. no Sales/Order/Booking;
31. no Catalog writes/reservation;
32. no Communication/contact disclosure;
33. acquisition source server-owned;
34. legitimate duplicate creates allowed;
35. pagination/deterministic ordering;
36. migration replay/drift.

One test may prove multiple invariants; do not inflate counts artificially.

---

## 33. REVIEW-FIX POLICY

Local confirmed Step 2.2B defects MAY be fixed during this pass, including validation/PII/CAS/own-scope/lifecycle/migration/index/test-hygiene/documentation defects.

For each fix:
- identify root cause;
- make the minimum change;
- add regression proof;
- run full regression.

STOP with `ARCHITECTURE DECISION REQUIRED` if a fix requires deciding final destination taxonomy, Seller entitlement, matching architecture, contact disclosure policy, DD-030 conversion point, a new bounded context, or Service Templates/Pricing architecture.

---

## 34. FULL REGRESSION

Run actual current counts, not copied implementation counts.

Backend:
- TypeScript compile;
- unit;
- Step 2.2B targeted E2E;
- Step 2.2A targeted E2E;
- Step 2.5B acquisition regression;
- relevant auth/RBAC;
- full serial E2E.

Frontend:
- TypeScript;
- Vitest;
- production build.

Database:
- migrate status;
- clean replay;
- drift check.

---

## 35. ROADMAP UPDATE

Before approval:
- 2.2B = implementation completed / waiting review;
- active = 2.2B Strict Review;
- 2.2C blocked.

If approved:
- mark 2.2B `STRICT REVIEW COMPLETED — APPROVED` or `APPROVED WITH REVIEW FIXES`;
- set exact NEXT to `PHASE 2 — STEP 2.2C — MATCHING & DISTRIBUTION`;
- do NOT start 2.2C.

---

## 36. APPROVAL CRITERIA

Approve only if ownership, Buyer own-scope, Seller denial, zero matching, zero Proposal, zero Sales conversion, Category authority, zero Product dependency, destination/date semantics, category-safe PAX, non-binding budget, honest/safe preferences handling, server-owned acquisition source, lifecycle, CAS, history/audit, failure atomicity, cross-domain isolation, migration and tests all pass.

---

## 37. REQUIRED FINAL REPORT

Return:

# PHASE 2 — STEP 2.2B — BUYER REQUEST FOUNDATION — STRICT REVIEW — ОТЧЁТ

## 1. Verdict
## 2. Repository baseline
## 3. Sources inspected
## 4. ADR-0012 ownership
## 5. BuyerRequest domain semantics
## 6. Schema / persistence
## 7. BRQ ID strategy
## 8. Buyer identity / own-scope
## 9. RBAC / IDOR
## 10. Category authority
## 11. Zero-Product invariant
## 12. Destination model / DD-028
## 13. Date semantics
## 14. PAX assessment
## 15. Budget assessment
## 16. Preferences / PII assessment
## 17. Acquisition source
## 18. Lifecycle / cancel semantics
## 19. CAS / concurrency
## 20. Mass assignment
## 21. History / audit
## 22. Failure atomicity
## 23. Events / outbox
## 24. No Seller access
## 25. No matching/distribution
## 26. No Proposal
## 27. No Sales conversion
## 28. Catalog isolation
## 29. Communication isolation
## 30. Reverse schema scope
## 31. Indexes / pagination
## 32. Migration / drift / replay
## 33. Test quality / shared-DB hygiene
## 34. Step 2.2A regression
## 35. Step 2.5B acquisition regression
## 36. Frontend scope
## 37. Roadmap / execution sequence
## 38. Deferred decisions
## 39. Review fixes
## 40. Regression results
## 41. Architecture decision status
## 42. Exact files changed during review
## 43. Out-of-scope confirmation
## 44. Exact NEXT item

If approved, Exact NEXT:

`PHASE 2 — STEP 2.2C — MATCHING & DISTRIBUTION`

Final line repeats verdict.

---

## 38. STOP CONDITION

After STRICT REVIEW: STOP.

If approved, update 2.2B status and set 2.2C as NEXT, but do NOT implement it.

If changes are required or an architecture decision is required, the sequence does not advance.

No matching, Seller inbox, Proposal, chat, Sales conversion, Service Templates, Universal Pricing or frontend work may begin in this pass.
