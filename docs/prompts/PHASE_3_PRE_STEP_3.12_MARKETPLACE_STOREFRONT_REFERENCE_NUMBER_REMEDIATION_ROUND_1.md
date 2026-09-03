# PHASE 3 — PRE-STEP 3.12 — MARKETPLACE / STOREFRONT TENANT-SCOPED REFERENCE NUMBER CONTRACT — REMEDIATION ROUND 1

## STATUS

**Task type:** Narrow remediation + evidence closure  
**Starting SHA:** `8a098c7bb72e5f6d18244851ece530fd8ce9ff5b`  
**Current qualification:** `VERDICT B — REMEDIATION REQUIRED`

This is **not** a redesign of the Reference Number architecture. Preserve the accepted architecture and close only the identified residual gaps and contradictory evidence.

Do **not** start Cross-Entity Traceability, GMV drill-down remediation, Finance Center, Cart/Checkout implementation, SaaS billing, Currency Presentation, Booking KPI remediation, Final Re-Qualification, or Step 3.12.

---

## LANGUAGE REQUIREMENT — MANDATORY

All created or updated reports and prose documentation for this task must be written **predominantly in Russian**.

This includes Implementation/Remediation/Strict Review/Evidence reports, findings, root-cause analysis, architecture decisions, security findings, runtime evidence, conclusions, recommendations and verdict explanations.

English is allowed only for technical identifiers: file paths, class/method/DTO/model/table names, API endpoints, HTTP methods/status codes, CLI/Git commands, commit messages, enums, permission identifiers, code snippets and standardized `VERDICT` strings.

**Hard acceptance criterion:** if the final report is predominantly English, the task is incomplete and must be corrected before final verdict.

---

# 1. PURPOSE

Preserve the accepted additive identity architecture:

```text
Internal UUID/PK
    ≠
Legacy business code
    ≠
referenceNumber
```

Accepted namespaces:

```text
Marketplace:
MKT-ORD-{SEQUENCE}
MKT-BKG-{SEQUENCE}
MKT-PAY-{SEQUENCE}
MKT-REF-{SEQUENCE}

Storefront:
SFxxx-ORD-{SEQUENCE}
SFxxx-BKG-{SEQUENCE}
SFxxx-PAY-{SEQUENCE}
SFxxx-REF-{SEQUENCE}
```

`SAAS-*` remains `RESERVED / NOT IMPLEMENTED` because authoritative SaaS billing does not yet exist.

Remediation is required because the previous report disclosed:

1. `94 orphaned Storefront Orders` using fallback `SF000-ORD-*`;
2. no dedicated automated concurrency test;
3. no dedicated `ReferenceNumberService` unit spec;
4. contradictory concurrency claims;
5. canonical roadmap was not updated despite being an acceptance gate;
6. UUID + legacy identifier preservation needs stronger evidence;
7. tenant-chain consistency must be re-qualified after resolving `SF000`.

---

# 2. HARD RULE — `SF000` IS NOT A VALID STOREFRONT TENANT

`SF000` MUST NOT be treated as a normal Storefront namespace.

A Storefront prefix represents a specific immutable Storefront tenant:

```text
SF001 → Storefront tenant A
SF002 → Storefront tenant B
...
```

Therefore generic fallback `SF000-*` cannot satisfy the tenant-scoped reference contract.

Audit all reported 94 orphaned Storefront Orders and determine why they have Storefront provenance but no resolvable authoritative `PartnerStorefront`.

Inspect authoritative relationships where applicable:

- `sellerPartnerId`;
- partner ownership;
- Storefront ownership;
- Booking relations;
- Payment relations;
- Refund relations;
- service/listing ownership;
- tenant/workspace fields;
- seed provenance;
- other authoritative schema relations.

Do **not** infer ownership from sequence proximity, names, labels, timestamps or guessed business meaning.

Do **not** assign arbitrary Storefront tenants merely to eliminate `SF000`.

---

# 3. ORPHAN CLASSIFICATION

Classify the entire orphan population:

| Classification | Count |
|---|---:|
| Tenant recovered from authoritative relation | N |
| Truly unresolved legacy/demo record | N |
| Incorrectly classified as Storefront | N |
| Other — explain | N |
| **Total investigated** | **94** |

The total must reconcile exactly with 94 unless reproducible DB evidence proves that the original count was wrong.

For recovered records, show the authoritative relation establishing ownership. For unresolved records, do not fabricate a Storefront code.

---

# 4. REQUIRED `SF000` REMEDIATION DECISION

Where ownership is authoritative, migrate:

```text
SF000-ORD-* → correct SFxxx-ORD-*
```

and propagate tenant-consistent references through related entities where required.

If some records genuinely cannot be assigned to a Storefront tenant:

1. document their actual legacy/demo state;
2. do not count them as successfully tenant-scoped Storefront commerce;
3. keep them explicitly unresolved/quarantined if necessary rather than inventing ownership;
4. ensure they cannot leak across Platform/Partner authorization boundaries;
5. report the residual gap explicitly.

**Do not delete records solely to make metrics green.**

**Do not reclassify Storefront commerce as Marketplace solely to eliminate `SF000`.** Any reclassification requires authoritative evidence.

---

# 5. DATA PRESERVATION — HARD GATE

Previous population:

```text
Orders:   1516
Bookings:  692
Payments:  816
Refunds:   334

Marketplace Orders: 1085
Storefront Orders:    431

Identified Storefront Orders: 337
Orphaned Storefront Orders:    94
337 + 94 = 431
```

Provide before/after evidence for:

- row counts;
- Marketplace population;
- Storefront population;
- UUID values;
- legacy business identifiers;
- `referenceNumber`;
- ownership / tenant relation;
- deleted rows;
- reassigned rows;
- reclassified rows.

Prove existing UUID/PK values were not regenerated/replaced.

Prove legacy identifiers such as `ORD-*`, `BKG-*`, `PAY-*`, `RFD-*`, `TH-YYYY-*` remain unchanged where additive preservation is required.

---

# 6. TENANT-CHAIN CONSISTENCY

Re-run full consistency checks after orphan remediation:

```text
Order
  ↓
Booking
  ↓
Payment
  ↓
Refund
```

Where relations exist, all Storefront records in one tenant-owned chain must resolve to the same authoritative Storefront tenant.

Expected pattern:

```text
SF003-ORD-000042
SF003-BKG-000019
SF003-PAY-000027
SF003-REF-000004
```

Required evidence:

```text
cross-tenant namespace mismatches = 0
```

Do not count `SF000` as a successful tenant match.

---

# 7. PLATFORM / PARTNER SECURITY RE-QUALIFICATION

Prefixes are observability/business identifiers, **not authorization**. Server-side workspace/tenant scope remains authoritative.

Re-test direct API access, not only UI visibility.

Required negative cases:

```text
Platform user + known SF001 referenceNumber
→ cannot retrieve Storefront operational record through Platform operational API

SF001 Partner + known SF002 referenceNumber
→ cannot retrieve SF002 operational record

SF002 Partner + known SF001 referenceNumber
→ cannot retrieve SF001 operational record
```

Test applicable Order, Booking, Payment and Refund endpoints.

Provide endpoint, request context, HTTP result and expected behavior.

---

# 8. `ReferenceNumberService` UNIT TESTS — REQUIRED

Create dedicated automated tests.

Cover at minimum:

```text
MARKETPLACE + ORDER   → MKT-ORD-*
MARKETPLACE + BOOKING → MKT-BKG-*
MARKETPLACE + PAYMENT → MKT-PAY-*
MARKETPLACE + REFUND  → MKT-REF-*

SF001 + ORDER   → SF001-ORD-*
SF001 + BOOKING → SF001-BKG-*
SF001 + PAYMENT → SF001-PAY-*
SF001 + REFUND  → SF001-REF-*
```

Also cover:

- `SF001` vs `SF002` tenant sequence separation;
- entity-type sequence separation according to the canonical contract;
- Storefront generation without valid authoritative `storefrontCode` must **not** silently emit `SF000`;
- allocator error/collision/retry behavior according to actual implementation.

---

# 9. REAL CONCURRENCY TEST — REQUIRED

Previous report contradicted itself by claiming concurrency validation while also stating there was no dedicated automated concurrency test.

Create a real automated concurrency test against the actual allocator/storage mechanism, reportedly:

```text
events.BusinessSequence
Hi/Lo block allocation
atomic upsert
block size = 100
```

Exercise actual concurrent allocation, not only the DB unique constraint.

At minimum test:

1. Marketplace Orders;
2. one Storefront tenant;
3. two different Storefront tenants in parallel;
4. multiple entity types where applicable.

Evidence must show:

```text
generated count
unique count
duplicate count
namespace correctness
tenant correctness
```

Hard requirement:

```text
duplicate referenceNumber = 0
```

A DB unique constraint is defense-in-depth, not proof of correct concurrent allocation.

---

# 10. CREATION FLOW RE-VERIFICATION

Identify and re-test all implemented creation paths for:

- Order;
- Booking;
- Payment;
- Refund.

For each report:

```text
workspace/business context
tenant resolution source
generated referenceNumber
legacy identifier preservation
UUID behavior
```

Marketplace creation must generate `MKT-*`.

Storefront creation must generate the correct `SFxxx-*`.

No new Storefront creation flow may emit `SF000-*`.

---

# 11. SEED / FACTORY REPEATABILITY

Re-run representative seed/factory behavior.

Required properties:

- Storefront codes remain deterministic for existing persisted tenants;
- re-seed does not arbitrarily renumber existing Storefront tenants;
- no duplicate references;
- Storefront records retain tenant ownership;
- Marketplace records remain Marketplace;
- no Storefront records silently convert to Marketplace;
- no representative data is deleted.

Audit whether `ROW_NUMBER() OVER (ORDER BY code)` is only deterministic during initial seed but unsafe for persistent identity after insertion/deletion/reordering.

`storefrontCode` is immutable after assignment.

---

# 12. STOREFRONT CODE IMMUTABILITY — VERIFY

Reconcile these previous claims:

```text
Generation: ROW_NUMBER() OVER (ORDER BY code)
Immutability: assigned at creation, never changes
Re-seed: same SF001..SF013
```

Prove adding/removing/renaming/reordering a Storefront does not change an existing persisted Storefront's `SFxxx` code.

At minimum demonstrate/test:

```text
existing Storefront A = SF001
insert another Storefront
re-run applicable seed/upsert
existing Storefront A remains SF001
```

A Storefront code must not depend on mutable company display name, slug, owner name or later sort position.

---

# 13. INVOICE / SAAS — DO NOT IMPLEMENT

Keep:

```text
SAAS namespace = RESERVED / NOT IMPLEMENTED
```

Do not create fake Invoice/SaaS billing functionality. If Invoice exists only as a schema artifact with zero authoritative rows, leave future reference-number behavior deferred unless current architecture genuinely requires it.

---

# 14. CANONICAL ROADMAP UPDATE — REQUIRED

Update additively:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Record:

1. Reference Number Contract architecture;
2. remediation outcome;
3. real implementation/remediation SHA(s);
4. residual gaps, if any;
5. exact next stage, without starting it.

Preserve history and prior failure/remediation evidence. Do not rewrite the first attempt as fully successful.

---

# 15. CART / CHECKOUT TARGET ARCHITECTURE — DOCUMENT ONLY

Add to canonical architecture/roadmap:

```text
Cart / Checkout
Implementation Status: NOT IMPLEMENTED
Roadmap Status: PLANNED
```

### Current commerce model — CURRENT / V1

```text
1 Order = 1 Booking
1 Order = 1..N Payments
```

This is the current business/application contract, **not** a permanent irreversible domain restriction.

### Target future commerce model

```text
Cart
  ↓
Checkout
  ↓
1 Order
  ├── Booking 1
  ├── Booking 2
  └── Booking N
  ↓
Consolidated Invoice
  ↓
1..N Payments
```

Business intent:

- customer may eventually add multiple services to one cart;
- checkout creates one consolidated Order;
- one Order may contain multiple Bookings;
- customer receives one consolidated commercial invoice/bill;
- one or multiple payments may settle the total;
- internal supplier/settlement complexity should not unnecessarily leak into customer-facing payment UX.

Current work must not introduce an irreversible DB/API invariant preventing future `Order 1 → N Bookings`.

**DOCUMENT ONLY. DO NOT IMPLEMENT CART, CHECKOUT OR CONSOLIDATED INVOICE.**

---

# 16. DO NOT MIX NEXT STAGES

Explicitly outside this remediation:

- Cross-Entity Business Reference & Traceability;
- GMV drill-down remediation for Command Center + Analytics;
- Finance Center;
- Currency Presentation Contract;
- Booking KPI Semantics;
- Cart / Checkout implementation;
- Final Re-Qualification;
- Step 3.12.

Future Cross-Entity Traceability will use the current V1 assumption:

```text
1 Order ↔ 1 Booking
1 Order ↔ 1..N Payments
```

Future GMV remediation will separately enforce consistent financial KPI drill-down semantics across Command Center and Analytics.

---

# 17. REQUIRED EVIDENCE MATRIX

Final report must include:

| Gate | Evidence | Result |
|---|---|---|
| UUID preserved | before/after identity evidence | PASS/FAIL |
| Legacy codes preserved | before/after evidence | PASS/FAIL |
| Marketplace namespace | runtime/query evidence | PASS/FAIL |
| Storefront namespace | runtime/query evidence | PASS/FAIL |
| `SF000` eliminated or explicitly unresolved | classification + query | PASS/FAIL |
| Storefront code immutable | regression evidence | PASS/FAIL |
| 0 duplicate references | DB query/test | PASS/FAIL |
| Tenant-chain consistency | full-chain query | PASS/FAIL |
| Platform negative access | API evidence | PASS/FAIL |
| Cross-tenant Partner denial | API evidence | PASS/FAIL |
| Unit tests | test output | PASS/FAIL |
| Concurrency test | actual concurrent run | PASS/FAIL |
| Seed repeatability | repeated run evidence | PASS/FAIL |
| Creation flows | runtime/test evidence | PASS/FAIL |
| Backend typecheck | command output | PASS/FAIL |
| Backend build | command output | PASS/FAIL |
| Relevant backend tests | command output | PASS/FAIL |
| Frontend typecheck | command output | PASS/FAIL |
| Relevant frontend tests | command output | PASS/FAIL |
| Canonical roadmap updated | diff/path/SHA | PASS/FAIL |
| Cart/Checkout documented as NOT IMPLEMENTED | roadmap evidence | PASS/FAIL |

Do not mark a gate `PASS` if the report itself contradicts it.

---

# 18. FRONTEND `storefrontSessions` ERROR

Previous report identified a pre-existing frontend typecheck error involving `storefrontSessions`.

This task must not broaden into unrelated Command Center remediation.

However:

1. reproduce and record the exact error;
2. prove it is unrelated to Reference Number changes;
3. do not report global frontend typecheck as PASS while it fails;
4. do not silently fix unrelated Command Center semantics here.

Report separately:

```text
Reference Number scope: PASS/FAIL
Global frontend typecheck: PASS/FAIL
Known unrelated blocker: ...
```

---

# 19. GIT / COMMIT DISCIPLINE

Previous report stated the implementation remained in-place with no commit. That is insufficient for closure.

Before final qualification:

1. inspect working tree;
2. include only intended changes;
3. commit implementation/remediation;
4. push intended branch;
5. report real SHAs.

Required:

```text
Starting SHA:
Previous in-place implementation base:
Remediation/Implementation SHA:
Final HEAD:
origin/master:
HEAD == origin:
Working tree clean:
```

Do not invent SHAs.

---

# 20. TESTING REQUIREMENTS

Run at minimum:

```text
Backend typecheck
Backend build
ReferenceNumberService unit tests
Reference-number integration tests
Concurrency test
Tenant-isolation/API tests
Relevant Orders tests
Relevant Bookings tests
Relevant Payments tests
Relevant Refunds tests
Seed/repeatability checks
Frontend typecheck
Relevant frontend tests
```

Run the full suite if feasible/project-standard.

If any test cannot be run, state exactly which test, why, and qualification impact.

Runtime/integration acceptance criteria cannot be replaced by source inspection alone.

---

# 21. REQUIRED FINAL REPORT STRUCTURE

Produce a predominantly Russian report:

```text
1. Executive Summary
2. Starting Repository State
3. Root Cause — SF000 / Orphan Population
4. Orphan Classification
5. Remediation Implemented
6. Storefront Code Immutability
7. Reference Number Contract
8. Data Preservation Evidence
9. Tenant-Chain Consistency
10. Security / Tenant Isolation Evidence
11. ReferenceNumberService Unit Tests
12. Concurrency Test Evidence
13. Creation Flow Evidence
14. Seed / Factory Repeatability
15. Marketplace Runtime Evidence
16. Storefront Runtime Evidence
17. SaaS / Invoice Deferred Scope
18. Frontend Known Unrelated Error
19. Canonical Roadmap Update
20. Cart / Checkout Architecture — NOT IMPLEMENTED
21. Test Results
22. Git / SHA Evidence
23. Residual Gaps
24. Acceptance Matrix
25. Final Verdict
```

---

# 22. VERDICT RULES

## `VERDICT A`

Allowed only if all hard gates are satisfied, especially:

- generic `SF000` is not counted as valid tenant-scoped commerce;
- recoverable orphan ownership is resolved from authoritative data;
- genuinely unresolved legacy data is explicitly unresolved and does not falsely satisfy tenant-scope gates;
- duplicate `referenceNumber = 0`;
- cross-tenant namespace mismatch among resolved tenant-owned records = 0;
- Storefront code immutability proven;
- dedicated unit tests pass;
- real concurrency test passes;
- server-side tenant isolation proven with negative API evidence;
- UUID/legacy identifiers preserved;
- canonical roadmap updated;
- Cart/Checkout documented as `NOT IMPLEMENTED`;
- implementation/remediation committed with real SHA evidence.

## `VERDICT B`

Required if any hard gate remains unresolved.

Do not issue:

```text
VERDICT A — с оговорками
```

when a hard acceptance criterion is failing.

---

# 23. STOP CONDITION

After completing this remediation:

**STOP.**

Do not automatically start:

- Cross-Entity Business Reference & Traceability;
- GMV drill-down remediation;
- Finance Center;
- Cart / Checkout;
- Currency Presentation Contract;
- Booking KPI Semantics;
- Final Re-Qualification;
- Step 3.12.

The next stage will be selected separately after review of this remediation report.
