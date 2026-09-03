# PHASE 3 — PRE-STEP 3.12 — MARKETPLACE / STOREFRONT TENANT-SCOPED REFERENCE NUMBER CONTRACT — FINAL STRICT REVIEW & RE-QUALIFICATION

## STATUS

**Task type:** Strict Review / evidence-first final re-qualification  
**Current stable SHA:** `8e0d42f`  
**Previous Reference Number remediation SHA:** `95b6172`  
**Fresh-DB evidence:** 74 migrations apply cleanly from empty PostgreSQL; `reference_number_contract` migration was subsequently corrected during Fresh-DB closure.

This task must determine whether the **Reference Number Contract is actually safe and complete after all subsequent migration changes**.

Do not assume previous `VERDICT A/B` remains valid.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и текстовая документация должны быть преимущественно **на русском языке**.

Это относится к:

- Strict Review Report;
- Evidence Report;
- findings explanations;
- root cause analysis;
- architecture/security decisions;
- concurrency findings;
- tenant-isolation findings;
- conclusions/recommendations;
- acceptance matrix;
- verdict explanations.

English допускается только для technical identifiers: paths, models, fields, methods, API endpoints, HTTP methods/status codes, SQL/code snippets, commands, enums, permission identifiers, commit messages, reference-number examples и standardized `VERDICT`.

**Hard acceptance criterion:** преимущественно англоязычный отчёт считается незавершённым.

---

# 1. CANONICAL REFERENCE ARCHITECTURE

Internal database identity remains:

```text
UUID / global / immutable
```

Human-readable business identity:

```text
referenceNumber
```

must be:

```text
human-readable
immutable
searchable
support-friendly
workspace/tenant-aware
globally unambiguous as a complete string
NOT an authorization mechanism
```

Canonical namespaces:

```text
Marketplace:
MKT-ORD-000001
MKT-REQ-000001
MKT-BKG-000001
MKT-PAY-000001

Storefront:
SF001-ORD-000001
SF001-REQ-000001
SF001-BKG-000001
SF001-PAY-000001

Future Storefront → TravelHub SaaS:
SAAS-SF001-INV-000001
SAAS-SF001-PAY-000001
SAAS-SF001-REF-000001
```

Exact numeric width may follow the already accepted implementation if semantically equivalent and immutable.

Do not silently redefine the namespace during review.

---

# 2. IMPORTANT — CURRENT MIGRATION OUTPUT MUST BE RECONCILED

Fresh-DB closure reported examples resembling:

```text
ORD-20260831-00000001
SF-0001
```

These may differ from the previously accepted canonical examples:

```text
MKT-ORD-000001
SF001-ORD-000001
```

This Strict Review must determine:

1. what the **current production/runtime allocator actually generates**;
2. what the migration backfill generates;
3. what API/UI expose;
4. whether all of them conform to one canonical contract;
5. whether legacy/backfilled formats are intentionally preserved or represent drift.

Do not accept multiple undocumented competing formats.

If format divergence is legitimate legacy compatibility, document:

```text
legacy format
new canonical format
creation cutoff
immutability rule
search/support behavior
```

If it is accidental drift, classify and remediate.

---

# 3. STOREFRONT CODE CONTRACT

Each valid Storefront tenant must have a stable immutable system code such as:

```text
SF001
SF002
SF003
```

Requirements:

- DB-stored;
- immutable;
- independent of storefront name;
- independent of slug/domain;
- independent of owner;
- unique;
- concurrency-safe allocation;
- deletion of another Storefront must not allow reuse;
- parallel creation must not create duplicates.

The previous implementation reportedly used a `count()+1` style strategy at one stage.

**That is not acceptable** as a final allocator.

Audit the current code at SHA `8e0d42f`.

---

# 4. SF000 QUARANTINE — PRESERVE SEMANTICS

Known Storefront-provenance records previously included unresolved ownership:

```text
29 Orders with NULL sellerPartnerId
65 Orders linked to Partner without PartnerStorefront
= 94 unresolved Storefront-provenance Orders
```

These were quarantined using:

```text
SF000
```

Canonical interpretation:

```text
SF000 = unresolved/quarantine provenance
SF000 ≠ valid Storefront tenant
```

Do not fabricate ownership.

Do not create fake Storefront tenants merely to eliminate `SF000`.

Review current counts and report whether these records still exist and whether ownership has since been authoritatively resolved.

---

# 5. REFERENCE NUMBER ALLOCATOR — HARD GATE

Identify the exact production allocator path used when creating:

- Order;
- Request/Application;
- Booking;
- Payment;
- Refund if reference contract applies;
- Storefront code.

For each, document:

```text
entry point
service/function
transaction boundary
locking/allocation mechanism
sequence scope
unique DB constraint
retry behavior
```

Reject unsafe patterns such as:

```text
MAX(referenceNumber) + 1
COUNT(*) + 1
count()+1
read-last-then-increment without lock
process-local counter
```

Concurrency safety must be enforced by database/transaction architecture, not merely by low probability of collision.

---

# 6. CONCURRENCY TEST — PRODUCTION PATH ONLY

Previous evidence used concurrent workers but there was ambiguity about whether the test exercised the actual production allocator.

This time the test must call the **same production creation/allocation path** used by the application.

Do not test a simplified duplicate implementation.

Minimum:

```text
20 concurrent creations
```

Prefer additional stress if inexpensive.

For each applicable namespace prove:

```text
duplicate referenceNumber = 0
allocation failures = 0 unexpected
unique constraint violations escaping to client = 0
```

At minimum test:

```text
Marketplace Order
Storefront Order for one valid tenant
parallel Storefront creation / storefrontCode allocation
```

If Request/Booking/Payment use the exact same shared allocator, prove shared-path reuse rather than duplicating identical stress tests unnecessarily.

---

# 7. DELETION / GAP SAFETY

Prove allocation does not reuse a business reference after deletion/archive.

Test conceptually:

```text
allocate N
allocate N+1
remove/archive N+1 where allowed
allocate next
→ must NOT reuse N+1
```

Likewise for `storefrontCode`.

Human-readable references are immutable business identifiers and must not be recycled.

---

# 8. IMMUTABILITY — HARD GATE

Prove application/API cannot mutate existing:

```text
referenceNumber
storefrontCode
```

through normal update DTO/API paths.

Check:

- DTO exposure;
- Prisma update paths;
- admin endpoints;
- generic patch endpoints;
- import/update flows if applicable.

DB-level protection is preferred where architecture supports it, but at minimum server-side mutation paths must not expose these fields.

---

# 9. UNIQUENESS CONSTRAINTS

Inspect actual PostgreSQL constraints/indexes.

Prove appropriate uniqueness for:

```text
full referenceNumber
storefrontCode
```

If uniqueness is composite rather than global, explain why complete rendered reference remains globally unambiguous.

Do not rely solely on TypeScript validation.

---

# 10. TENANT ISOLATION — HARD SECURITY GATE

Reference prefixes are **not authorization**.

Authorization must use authoritative tenant/workspace relations.

Prove negative access matrix for real records.

Required conceptual matrix:

| Actor | Marketplace record | Storefront A record | Storefront B record |
|---|---|---|---|
| PLATFORM authorized internal role | according to Platform scope | denied for Storefront commerce unless explicitly authorized SaaS context | denied |
| Storefront A partner | according to contract | allowed A | denied B |
| Storefront B partner | according to contract | denied A | allowed B |

At minimum test authoritative APIs for:

```text
Order
Booking
Payment
Refund
```

where implemented.

Use actual IDs/referenceNumbers.

Required evidence includes HTTP status and endpoint.

Do not claim isolation from repository inspection alone.

---

# 11. PLATFORM VS STOREFRONT BUSINESS SCOPE

Preserve canonical rule:

```text
Platform operational commerce
= Marketplace commerce

Storefront own customer commerce
= Partner/Storefront workspace
≠ Platform Marketplace commerce
```

Reference number prefixes may improve observability but must not be used to infer authorization or business scope.

Audit that Platform APIs do not simply filter:

```text
referenceNumber startsWith "MKT"
```

as their security boundary.

Use authoritative provenance/tenant relations.

---

# 12. CROSS-ENTITY RELATION INTEGRITY

For representative records verify actual DB relations:

```text
Order ↔ Booking
Order ↔ Payment(s)
Booking ↔ Payment(s) where applicable
```

and ensure their references belong to the correct workspace/tenant.

Do not infer relations from similar numeric suffixes.

Example forbidden assumption:

```text
MKT-ORD-000123
must correspond to
MKT-BKG-000123
```

unless the DB relation explicitly says so.

This task audits integrity only.

Do **not** implement the future Cross-Entity UI Traceability stage here.

---

# 13. CURRENT V1 CARDINALITY — PRESERVE

Current contract:

```text
1 Order = 1 Booking
1 Order = 1..N Payments
```

Do not redesign this into Cart/Checkout.

Future target remains:

```text
Cart
→ Checkout
→ 1 Order
→ N Bookings
→ consolidated invoice
→ 1..N Payments
```

but:

```text
Cart/Checkout Implementation Status: NOT IMPLEMENTED
```

No Cart/Checkout implementation in this review.

---

# 14. BACKFILL / MIGRATION INTEGRITY

Because `20260831210000_reference_number_contract` was modified during Fresh-DB closure, audit both:

```text
fresh empty DB behavior
existing populated DB behavior
```

For populated representative data verify:

- no UUID changes;
- no deleted records;
- no reclassified Marketplace/Storefront provenance;
- existing valid referenceNumbers not unexpectedly rewritten;
- backfilled values deterministic;
- quarantine records remain quarantine unless ownership was authoritatively resolved.

Report before/after counts by relevant entity.

---

# 15. REPRESENTATIVE DATA COUNTS

Capture current counts at least for:

```text
Orders
Bookings
Payments
Refunds
Storefronts
Partners
SF000/quarantine records
```

Compare with known historical populations where useful, but use current DB as source of truth.

Any change must be explained.

Do not mutate representative data merely to make the matrix look cleaner.

---

# 16. SEARCH / LOOKUP CONTRACT

Verify referenceNumber is usable through intended lookup/search paths where already implemented.

At minimum determine:

```text
Can support/user locate a record by referenceNumber?
Is lookup tenant-safe?
Does exact reference lookup return the authoritative record?
```

If search UI/API is not yet implemented for an entity, report:

```text
NOT IMPLEMENTED
```

Do not build an unrelated global search system in this task.

---

# 17. API / UI PRESENTATION

Inspect representative UI surfaces for:

```text
Orders
Bookings
Payments
```

Verify business reference is shown where already designed/implemented.

Do not implement future clickable cross-entity references here.

If current UI still shows UUID where business reference should already be canonical, classify it.

---

# 18. LEGACY IDENTIFIER PRESERVATION

Do not delete legacy identifiers merely because `referenceNumber` now exists.

If old records have legacy business codes, document coexistence:

```text
UUID
legacy identifier
referenceNumber
```

Reference Number rollout must be additive unless an explicit migration contract says otherwise.

---

# 19. STOREFRONT TENANT CHAIN

For Storefront records prove authoritative ownership chain, e.g. actual model equivalent of:

```text
Commerce record
→ sellerPartnerId / tenant relation
→ Partner
→ PartnerStorefront
→ storefrontCode
```

Report unresolved breaks.

Do not infer tenant solely from:

```text
acquisitionSource=STOREFRONT
```

That field is provenance, not sufficient tenant authorization.

---

# 20. SECURITY TESTS

At minimum include:

```text
Platform cannot access Storefront commerce through reference guessing
Storefront A cannot access Storefront B
Storefront B cannot access Storefront A
unknown reference → safe not-found/denial behavior
malformed reference → safe validation
reference prefix manipulation → no privilege escalation
```

Do not expose secrets/tokens in report evidence.

---

# 21. FRESH-DB REGRESSION

Fresh-DB evidence has already shown 74 migrations apply.

After any fix in this Strict Review, rerun:

```text
empty isolated DB
→ prisma migrate deploy
```

to ensure Reference remediation does not break clean provisioning.

If review is evidence-only with no migration/code changes, cite the existing `8e0d42f` fresh-DB evidence and perform targeted allocator tests.

---

# 22. TEST / BUILD / TYPECHECK

Run relevant:

```text
backend typecheck
backend build
reference-number tests
allocator concurrency tests
tenant isolation tests
migration/fresh-DB regression if code changed
frontend typecheck
```

Report actual global statuses.

Known unrelated issue may still be:

```text
storefrontSessions type mismatch
```

If frontend typecheck is FAIL, say FAIL.

Do not convert it to global PASS.

---

# 23. NO FAKE FIXES

Forbidden:

- deleting `SF000` records to make counts pass;
- assigning fake Storefront ownership;
- resetting representative DB;
- reclassifying Storefront commerce as Marketplace;
- weakening tenant checks;
- generating references from array index;
- using prefixes as authorization;
- changing UUID identity;
- implementing Cart/Checkout;
- implementing future Finance Center;
- mixing GMV drill-down work into this review.

---

# 24. ROADMAP

Update:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

additively after review/remediation.

Record:

```text
Marketplace / Storefront Tenant-Scoped Reference Number Contract
— Final Strict Review & Re-Qualification
```

Include:

- canonical format decision;
- allocator mechanism;
- concurrency evidence;
- storefrontCode evidence;
- SF000 status;
- tenant isolation evidence;
- final SHA;
- truthful verdict.

Do not erase earlier remediation history.

---

# 25. GIT / SHA EVIDENCE

Report:

```text
Starting SHA: 8e0d42f
Previous Reference remediation SHA: 95b6172
Review/remediation SHA:
Final HEAD:
origin/master:
HEAD == origin:
Working tree clean:
```

If defects require fixes, commit and push them.

If evidence-only, clearly state no source changes.

---

# 26. REQUIRED CANONICAL FORMAT MATRIX

Final report must include:

| Entity | Workspace | Current creation format | Backfill/legacy format | Canonical? | Allocator |
|---|---|---|---|---|---|
| Order | Marketplace | | | | |
| Request | Marketplace | | | | |
| Booking | Marketplace | | | | |
| Payment | Marketplace | | | | |
| Order | Storefront | | | | |
| Request | Storefront | | | | |
| Booking | Storefront | | | | |
| Payment | Storefront | | | | |
| Storefront code | Storefront | | | | |

No undocumented format divergence.

---

# 27. REQUIRED TENANT SECURITY MATRIX

| Resource | Platform→Storefront | SF-A→SF-A | SF-A→SF-B | SF-B→SF-A | Result |
|---|---|---|---|---|---|
| Order | | | | | |
| Booking | | | | | |
| Payment | | | | | |
| Refund | | | | | |

Use real API runtime evidence.

---

# 28. REQUIRED ACCEPTANCE MATRIX

| Gate | Result |
|---|---|
| Canonical reference format reconciled | PASS/FAIL |
| Creation vs backfill format consistent/documented | PASS/FAIL |
| Full reference uniqueness DB-enforced | PASS/FAIL |
| storefrontCode uniqueness DB-enforced | PASS/FAIL |
| storefrontCode allocation concurrency-safe | PASS/FAIL |
| Reference allocation concurrency-safe | PASS/FAIL |
| Production allocator path stress-tested | PASS/FAIL |
| Deletion does not cause reference reuse | PASS/FAIL |
| referenceNumber immutable | PASS/FAIL |
| storefrontCode immutable | PASS/FAIL |
| SF000 remains quarantine, not tenant | PASS/FAIL |
| No fake ownership introduced | PASS/FAIL |
| Tenant chain verified | PASS/FAIL |
| Platform→Storefront negative API evidence | PASS/FAIL |
| SF-A→SF-B negative API evidence | PASS/FAIL |
| SF-B→SF-A negative API evidence | PASS/FAIL |
| Order isolation | PASS/FAIL |
| Booking isolation | PASS/FAIL |
| Payment isolation | PASS/FAIL |
| Refund isolation | PASS/FAIL |
| Prefix not used as authorization | PASS/FAIL |
| Cross-entity DB relations authoritative | PASS/FAIL |
| UUIDs preserved | PASS/FAIL |
| Legacy identifiers preserved | PASS/FAIL |
| Representative data preserved | PASS/FAIL |
| Fresh-DB regression preserved | PASS/FAIL |
| Backend typecheck/build/tests | PASS/FAIL |
| Frontend typecheck actual status reported | PASS/FAIL |
| Roadmap updated | PASS/FAIL |
| Git synchronized | PASS/FAIL |

---

# 29. REQUIRED FINAL REPORT STRUCTURE

Отчёт преимущественно на русском:

```text
1. Executive Summary
2. Starting SHA / Repository State
3. Canonical Reference Contract Reconciliation
4. Current Format Matrix
5. Storefront Code Contract
6. SF000 Quarantine Audit
7. Production Allocator Architecture
8. DB Constraints / Uniqueness
9. Concurrency Evidence
10. Deletion / Non-Reuse Evidence
11. Immutability Evidence
12. Tenant Ownership Chain
13. Platform vs Storefront Scope
14. Tenant Isolation Runtime API Matrix
15. Cross-Entity Relation Integrity
16. Backfill / Migration Integrity
17. Representative Data Preservation
18. Search / Lookup Evidence
19. API / UI Presentation
20. Legacy Identifier Preservation
21. Security Regression
22. Fresh-DB Regression
23. Tests / Build / Typecheck
24. Canonical Roadmap Update
25. Git / SHA Evidence
26. Residual Gaps
27. Acceptance Matrix
28. Final Verdict
```

---

# 30. VERDICT RULES

## VERDICT A — REFERENCE NUMBER CONTRACT QUALIFIED

Allowed only if:

```text
canonical formats reconciled
+
production allocators concurrency-safe
+
storefrontCode concurrency-safe
+
no identifier reuse
+
immutability proven
+
SF000 semantics preserved
+
tenant isolation runtime-proven
+
Order/Booking/Payment/Refund security matrix closed
+
representative data preserved
+
fresh-DB path remains valid
+
Git synchronized
```

## VERDICT B — REMEDIATION REQUIRED

Mandatory if any hard security/allocator/tenant gate remains unresolved.

Do not accept:

```text
PASS (code inspection)
```

instead of required runtime/concurrency evidence.

Do not issue:

```text
VERDICT A — with residual hard gates
```

---

# 31. STOP CONDITION

After this Strict Review:

**STOP.**

Do not automatically start:

- GMV / Financial KPI Drill-down;
- Cross-Entity Business Reference & Traceability UI;
- Booking KPI Semantics Audit;
- Finance Center;
- Final PRE-STEP 3.12 Re-Qualification;
- Step 3.12.

Return the report for independent review.
