# PHASE 2 — STEP 2.14E — CHANNEL-BASED COMMISSION RULES FOUNDATION — IMPLEMENTATION PROMPT

## 0. MODE

**IMPLEMENTATION · REPOSITORY-FIRST · ADR-0013 IS CANONICAL · STRICT SCOPE**

Implement only:

`PHASE 2 — STEP 2.14E — CHANNEL-BASED COMMISSION RULES FOUNDATION`

This step exists to materialize the Commission policy authority defined by:

`ADR-0013 — Commission Policy Contract`

Do not infer execution order from numbering.

Current dependency state:

- Step 2.13A — APPROVED;
- ADR-0013 — DECIDED;
- Step 2.14 — BLOCKED;
- Step 2.14E — NEXT;
- Step 2.12E — NOT STARTED;
- Step 2.12A/B/C/D — NOT STARTED unless repository now proves otherwise;
- Step 2.14A–D — do not start in this pass.

---

# 1. PRIMARY OBJECTIVE

Implement the **minimal canonical Finance-owned Commission Policy foundation** required by ADR-0013.

The result must provide:

1. authoritative mutable Commission policy master data;
2. deterministic channel-based policy matching;
3. percentage-only V1 rule semantics;
4. effective-date/version semantics;
5. fail-closed ambiguity handling;
6. RBAC-controlled management/read API;
7. canonical Decimal validation;
8. architecture/API documentation;
9. tests proving the policy foundation in isolation.

This step must **NOT** calculate, freeze, accrue, collect, invoice, post, settle, refund-adjust, or PSP-split any Commission.

---

# 2. HARD CANONICAL INPUT

Before coding, inspect actual repository state and read at minimum:

- current Roadmap v3;
- `ADR-0013-commission-policy-contract.md`;
- Commission Policy Contract decision report;
- Commission Dependency Reconciliation report;
- Step 2.14 BLOCKED report;
- Step 2.14E Roadmap body entry;
- Finance Domain Foundation;
- Pricing & Financial Snapshot;
- Payment Flow;
- Refund Flow;
- Chargeback / Dispute Foundation;
- Ledger / ProviderFee / Settlement / Payout foundations;
- current `schema.prisma`;
- current Finance module/controllers/services/validation;
- canonical money helpers;
- RBAC constants/matrix/seeding;
- IDs service and `ids.md`;
- `api.md`;
- `events.md`;
- e2e harness and current finance test patterns.

Implementation report summaries are evidence pointers, not authority. Verify code/schema/runtime directly.

---

# 3. ADR-0013 DECISIONS THAT MUST NOT BE REOPENED

Unless the repository contains a direct canonical contradiction, implement these decisions exactly:

## 3.1 Owner

Commission policy is owned by Finance.

Canonical model concept:

`finance.CommissionPolicy`

No Settings-owned, Catalog-owned, Sales-owned, PSP-owned, or frontend-owned duplicate policy authority.

## 3.2 V1 matching dimension

V1 policy matching key is **channel only**.

Do not add V1 matching by:

- partner/seller;
- product;
- category;
- geography;
- currency;
- payment method;
- PSP/provider;
- customer segment.

Those are not V1 policy dimensions unless ADR-0013 explicitly says otherwise.

## 3.3 Channel semantics

Use the exact ADR-0013 canonical CommissionChannel vocabulary.

Known architectural meaning from the decision:

- `MARKETPLACE` — commission-capable channel;
- `PARTNER_STOREFRONT` — SaaS/no-commission under ADR-0006;
- `DIRECT` — no commission;
- `BUYER_REQUEST` — no commission;
- `CUSTOM_DOMAIN` / `API` — deferred where ADR-0013 says deferred.

Do not silently equate arbitrary AcquisitionSource values with CommissionChannel.

## 3.4 Rate type

V1 supports:

`PERCENTAGE`

only.

Do not implement fixed, hybrid, tiered, caps, floors, progressive rates.

The actual percentage is master data, never a hardcoded business constant.

## 3.5 Base/freeze

ADR-0013 has already decided the future calculation base and freeze semantics.

This step does **not** implement the calculation or freeze path.

Do not modify Quote/Checkout/Sale/Order to carry commission snapshots in 2.14E unless ADR/Roadmap explicitly assigns that schema materialization to this exact step. If that work is assigned to a later prerequisite step, preserve the boundary.

## 3.6 Collection models

`SPLIT_AT_PAYMENT` and `PARTNER_COLLECT` are future collection mechanisms sharing the same business policy.

2.14E does not implement either collection flow.

## 3.7 Adjustments

Refund adjustment and Dispute liability handling remain deferred.

No adjustment runtime here.

---

# 4. PRE-IMPLEMENTATION RECONCILIATION — HARD GATE

Before editing production files, determine from the actual repository:

1. whether `CommissionPolicy` already exists;
2. whether any Commission policy/rate fields already exist elsewhere;
3. whether an ID prefix has already been reserved;
4. whether a CommissionChannel enum already exists;
5. whether any existing permissions can be reused without semantic distortion;
6. whether Finance API has an established master-data controller/service pattern;
7. whether schema-level temporal/version conventions already exist.

If a conflicting canonical policy authority already exists, STOP with:

`PHASE 2 STEP 2.14E BLOCKED — CONFLICTING COMMISSION POLICY AUTHORITY`

Do not create a second authority.

---

# 5. TARGET DOMAIN MODEL

Implement the minimum model required by ADR-0013.

The exact field names should follow repository conventions, but semantics must include the canonical equivalents of:

- server-owned canonical `code`;
- channel;
- rate type;
- percentage rate;
- effective-from;
- effective-to nullable;
- version;
- active/archive state or the repository-equivalent lifecycle mechanism;
- createdAt;
- updatedAt only if appropriate for mutable master data;
- audit/provenance fields if the established master-data convention requires them.

Do not add fields for future dimensions merely “for convenience”.

---

# 6. IDENTIFIER

If ADR-0013 or `ids.md` defines a Commission Policy prefix, use it.

If not defined, inspect current naming conventions and register one canonical prefix through the existing IDs infrastructure.

Requirements:

- generated server-side;
- same transaction as create;
- standard numeric sequence format used by the project;
- documented in `ids.md`;
- no random alternate identifier scheme.

If choosing a new prefix would itself contradict an existing reserved prefix, STOP for architecture reconciliation.

---

# 7. CHANNEL MODEL

Use a typed canonical vocabulary.

Do not accept arbitrary free-form channel strings if the repository convention supports enum/value validation.

The API must reject unsupported/deferred channel values for V1 policy creation when ADR-0013 says they are not active policy channels.

Most importantly:

**No-commission channels must not accidentally acquire a commission policy through generic CRUD.**

If ADR-0013 defines only MARKETPLACE as commission-active in V1, enforce that contract.

---

# 8. RATE CONTRACT

Use the existing canonical Decimal authority.

Requirements:

- never JS float as financial authority;
- percentage stored as Decimal using a precision/scale justified by repository money/rate conventions;
- strict validation;
- rate must be positive if zero means “no commission” is represented by absence of a policy;
- upper bound must be explicit and economically sane according to the ADR/data contract;
- excessive scale → controlled validation error;
- strings at API boundary where existing Finance Decimal contract requires strings.

Do not invent percentage normalization ambiguities.

Explicitly document whether `10` means 10% or `0.10`.

Use one representation only.

---

# 9. RATE TYPE CONTRACT

If the model contains `rateType`, V1 must only allow:

`PERCENTAGE`

Do not expose unsupported enum values merely because they may be useful later.

Future rate types must be additive.

---

# 10. EFFECTIVE-DATE CONTRACT

Implement the ADR-0013 effective-date/version semantics.

At minimum prove:

- `effectiveFrom` is explicit;
- `effectiveTo` nullable if open-ended policies are allowed;
- `effectiveTo > effectiveFrom`;
- timestamps use the repository's strict ISO/UTC validation rules where applicable;
- `createdAt` is not used as business precedence;
- policy lookup uses business-effective time.

Do not fabricate historical effective dates during migration/backfill.

---

# 11. VERSIONING

Implement deterministic policy version semantics from ADR-0013.

Requirements:

- version is server-authoritative;
- no client-forged version ownership;
- version evolution must not rewrite historical policy identity;
- a future frozen snapshot must be able to identify the selected policy/version;
- mutation semantics must be explicit: update-in-place vs new version.

Prefer the ADR decision exactly.

If ADR-0013 requires immutable versions with new rows, do not implement generic PATCH that mutates historical rule meaning.

If it permits mutable future policy before activation, encode the exact boundary.

---

# 12. OVERLAP / AMBIGUITY — HARD GATE

V1 matching must be deterministic.

For the same channel and overlapping effective interval, the system must not silently choose based on:

- insertion order;
- newest `createdAt`;
- database row order;
- arbitrary first match.

Implement ADR-0013 precedence.

If V1 is channel-only with no specificity hierarchy, overlapping simultaneously applicable policies for the same channel should normally fail closed.

Use a DB invariant where practical and service validation where interval exclusion cannot be expressed safely with the current Prisma/migration conventions.

Concurrency must also be considered.

---

# 13. POLICY RESOLUTION SERVICE

Provide one canonical Finance-owned policy resolver/read path suitable for later consumers.

Conceptually:

`resolveCommissionPolicy(channel, businessInstant)`

It must:

- be deterministic;
- return exactly one applicable policy or explicit no-policy result where the channel contract permits no commission;
- fail closed on ambiguity;
- not calculate Commission amount;
- not read mutable Catalog pricing;
- not write Sales/Order/Payment;
- not emit Commission facts.

Avoid duplicating matching logic in controllers.

---

# 14. CRUD / COMMAND SURFACE

Implement only the policy-management surface justified by ADR-0013 and repository conventions.

Likely operations:

- create;
- list;
- detail;
- permitted update/version operation;
- activate/archive/deactivate if canonical;
- resolution/read endpoint only if the existing API architecture benefits from exposing it.

Do not add a public “calculate commission” endpoint.

Do not add Payment/Order mutation endpoints.

---

# 15. MASS ASSIGNMENT

Server-owned fields must not be forgeable.

At minimum protect:

- code;
- version if server-owned;
- createdAt;
- updatedAt;
- internal IDs;
- audit/provenance fields;
- any lifecycle field not explicitly client-commandable.

Follow the established raw `req.body` forbidden-key pattern so ValidationPipe whitelist cannot silently strip forged server-owned fields.

Forged fields → controlled 422.

---

# 16. RBAC

Implement ADR-0013 policy-management authority.

Required management permission:

`finance.commission.manage`

for:

- FINANCE;
- ADMIN.

Do not grant management to:

- OPERATOR;
- PARTNER;
- SALES_MANAGER;
- ANALYST;
- DIRECTOR

unless ADR-0013 explicitly gives a narrower read permission.

For read access, reconcile the actual ADR and existing Finance permission pattern. If a separate read permission is needed, add it explicitly and seed it through the canonical RBAC mechanism.

Do not overload `finance.commission.manage` as a generic fact-read permission if the architecture distinguishes policy management from financial fact visibility.

Anonymous → 401.
Authenticated without permission → 403.

---

# 17. AUDIT LOG

Policy mutations are auditable master-data actions.

Use existing AuditLog conventions.

Audit payload must be minimal and PII-free.

Examples of action semantics:

- commission policy created;
- version activated;
- policy archived.

Use canonical snake_case action naming.

Do not log secrets or arbitrary request bodies.

---

# 18. DOMAIN EVENTS

ADR-0013 explicitly does not require speculative policy events.

Therefore:

- do not emit CommissionAccrued;
- do not emit CommissionPolicySelected/Frozen merely because a policy is read;
- do not create events without a consumer/contract.

If the repository already has a mandatory generic master-data event convention, verify before use.

Default for 2.14E: **0 new domain events** unless canonically required.

---

# 19. COMMISSION FACT BOUNDARY

Existing `Commission` and `CommissionAccrual` foundation models must remain runtime-unproduced in this step.

Prove:

- policy CRUD creates 0 Commission rows;
- policy CRUD creates 0 CommissionAccrual rows;
- policy resolution creates 0 financial facts.

No “test calculation” should persist facts.

---

# 20. PAYMENT / REFUND / DISPUTE BOUNDARY

2.14E must not mutate or reinterpret:

- Payment;
- Refund;
- Dispute;
- Order payment projection;
- Booking;
- Availability.

No PSP/webhook code.

No AUTHORIZED/CAPTURED lifecycle changes.

No refund/dispute commission adjustment.

---

# 21. LEDGER BOUNDARY

0 LedgerTransaction writes from CommissionPolicy.

Do not implement Step 2.12D.

Policy is commercial master data, not a ledger fact.

---

# 22. PROVIDER FEE / SETTLEMENT / PAYOUT BOUNDARY

Policy management must create/mutate:

- 0 ProviderFee;
- 0 Settlement;
- 0 Payout.

ProviderFee remains distinct from TravelHub Commission.

---

# 23. TAX / FX BOUNDARY

Do not introduce live Tax/FX calculation into policy resolution.

The ADR's V1 base/currency semantics are future calculation concerns.

No FX conversion.

No tax-inclusive/exclusive recomputation here.

---

# 24. SELLER / PARTNER SNAPSHOT BOUNDARY

ADR-0013 requires frozen seller attribution for future Commission facts and fail-closed multi-seller behavior.

Do not solve this via live Catalog lookup.

However, only add `sellerPartnerId` snapshot fields in this step if the Roadmap/ADR explicitly assigns that prerequisite to 2.14E.

Otherwise document it as an explicit next dependency before any Commission producer can run.

No Commission producer may be enabled until this prerequisite is satisfied.

---

# 25. MIGRATION

Migration must be additive.

Requirements:

- new Finance-owned policy model/table and required enum/indexes only;
- no destructive ALTER of approved financial facts;
- no fabricated backfill;
- no `db push`;
- no rewriting Commission/CommissionAccrual history;
- no changes to Payment/Refund/Dispute lifecycle data.

Fresh replay through real migrations is mandatory.

---

# 26. LEGACY COMPATIBILITY

Legacy transactions without a commission snapshot remain valid.

Do not retroactively assign current policy to historical Orders.

Do not backfill historical Commission.

Do not infer seller/channel/rate from mutable current state.

---

# 27. CONCURRENCY

Test concurrent policy creation/version activation for the same matching interval.

The system must not end with two ambiguous active policies.

Allowed outcomes should be controlled and deterministic, e.g.:

- one succeeds;
- competing conflicting write receives controlled conflict.

Raw 500 is forbidden for expected uniqueness/concurrency races.

---

# 28. P2002 / DB ERROR HANDLING

Handle known expected DB conflicts narrowly.

Do not globally convert every P2002 into idempotent success.

If an identifier collision, overlapping policy invariant, or other unique conflict occurs, distinguish known business cases.

Unknown DB constraint errors must not masquerade as replay success.

Follow the approved Ledger/Refund/Dispute defensive patterns.

---

# 29. IDEMPOTENCY

Do not invent idempotency semantics that make divergent policy payloads silently succeed.

If create command has a natural business identity/idempotency key:

- identical retry may no-op;
- divergent retry must conflict.

If there is no canonical idempotency identity for policy creation, use controlled uniqueness/business conflict instead of pretending all duplicates are retries.

Document the choice.

---

# 30. API READ CONTRACT

List/detail responses must:

- expose Decimal percentage as string where canonical;
- expose effective dates consistently;
- not leak internal audit metadata unnecessarily;
- support bounded pagination;
- whitelist filters;
- reject invalid page/pageSize;
- avoid arbitrary sort/filter injection.

Resolution semantics, if exposed, must clearly distinguish:

- policy found;
- valid no-commission channel;
- ambiguous/invalid configuration.

---

# 31. REQUIRED UNIT TESTS

Add focused tests for at least:

1. percentage validation;
2. scale/upper/lower bounds;
3. channel validation;
4. effective interval validation;
5. server-owned fields;
6. policy resolution;
7. no-policy channel behavior;
8. ambiguity fail-closed;
9. version semantics;
10. expected DB conflict mapping;
11. unknown DB conflict behavior;
12. Decimal string semantics.

Do not pad test counts with trivial assertions.

---

# 32. REQUIRED E2E TESTS

Create a dedicated Step 2.14E e2e suite.

At minimum prove:

### T1 — Authentication
Anonymous management/read according to contract → 401.

### T2 — RBAC
FINANCE/ADMIN management succeeds.
Forbidden roles → 403.
Read roles exactly match actual RBAC contract.

### T3 — Create canonical policy
Valid MARKETPLACE percentage policy → canonical code + Decimal string + effective/version fields.

### T4 — Mass assignment
Forged code/version/timestamps/internal fields → 422.

### T5 — Validation
Invalid channel, rate, scale, interval → controlled 4xx.

### T6 — No-commission channels
DIRECT / BUYER_REQUEST / PARTNER_STOREFRONT behavior matches ADR-0013 and cannot silently become commission-bearing through generic policy CRUD.

### T7 — Deterministic resolution
Correct policy selected for business instant.

### T8 — Boundary instant
Before/at/after effective boundaries behaves exactly as documented.

### T9 — Overlap
Conflicting applicable policy → prevented or fail-closed; never arbitrary first-row selection.

### T10 — Concurrency
Concurrent conflicting creation/activation leaves no ambiguous state; raw 500 = 0.

### T11 — Historical safety
Changing/adding a future policy does not mutate existing Order/Payment/Refund/Dispute/Commission/CommissionAccrual rows.

### T12 — Zero financial side effects
Counts unchanged for:
- Commission;
- CommissionAccrual;
- LedgerTransaction;
- ProviderFee;
- Settlement;
- Payout;
- Invoice;
- Payment;
- Refund;
- Dispute.

### T13 — No cross-domain writes
Catalog/Sales/Order/Booking/Availability unaffected.

### T14 — Pagination/filter validation
Invalid pagination/filter input rejected.

### T15 — Migration/foundation
Policy table/indexes exist on fresh replay; legacy financial rows are not backfilled.

Add further tests where actual implementation risks require them.

---

# 33. REPO-WIDE WRITE-PATH AUDIT

Before verdict, search the entire production source for:

- CommissionPolicy create/update/upsert/delete;
- Commission create/update;
- CommissionAccrual create/update;
- commission rate fields;
- hardcoded percentage constants;
- commission calculations;
- Order/Quote/Sale commission writes;
- PSP split commission code.

The report must enumerate actual writers.

Expected 2.14E result:

- CommissionPolicy writers: only Finance-owned policy service;
- Commission fact writers: 0;
- CommissionAccrual writers: 0.

If not, investigate before completion.

---

# 34. HARDCODED RATE AUDIT — HARD GATE

Search production code for newly introduced commission percentages/constants.

There must be no business commission rate such as:

- 5%;
- 10%;
- 15%;
- `0.1`;
- `0.15`;

used as platform policy.

Test fixtures may contain explicit example values, but production defaults must not create a commercial rate.

---

# 35. DOCUMENTATION

Update:

- ADR-0013 only if implementation reveals a non-semantic clarification; do not rewrite its decisions;
- Finance/Commission architecture doc;
- `api.md`;
- `ids.md`;
- RBAC docs if permissions added;
- Roadmap Step 2.14E status;
- temporal/readiness docs only if schema expectations legitimately evolve.

Do not mark dependent steps completed.

---

# 36. ROADMAP STATUS

After successful implementation only:

`PHASE 2 STEP 2.14E IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Do not mark 2.14E APPROVED.

Do not unblock/complete 2.14 automatically.

Do not mark 2.12E/2.12C implemented.

Set NEXT to:

`PHASE 2 — STEP 2.14E — STRICT REVIEW`

and STOP.

---

# 37. REGRESSION

Run actual project commands according to repository tooling.

Minimum:

- backend TypeScript check;
- backend build;
- unit tests;
- targeted Finance/Commission/RBAC tests;
- full serial e2e;
- frontend TypeScript;
- frontend tests;
- frontend production build;
- migration status;
- schema/live DB drift check;
- fresh migration replay through existing e2e harness.

Report exact counts, not “all green”.

---

# 38. MIGRATION HARD GATES

Prove:

- all migrations up-to-date;
- fresh DB replay succeeds;
- live DB → schema diff = no unintended drift;
- no `db push`;
- no manual production/dev DB mutation used as implementation.

---

# 39. STOP CONDITIONS

Stop with `ARCHITECTURE DECISION REQUIRED` instead of inventing behavior if any of these occur:

1. ADR-0013 conflicts with a newer canonical repository decision;
2. CommissionChannel cannot be mapped without redefining existing channel semantics;
3. percentage representation is ambiguous in canonical sources;
4. effective-date overlap semantics are not actually resolved by ADR-0013;
5. implementation would require partner/product dimensions contrary to V1 channel-only policy;
6. seller snapshot must be introduced now to make even policy foundation semantically valid, but ownership is unresolved;
7. policy implementation requires changing approved Payment/Refund/Dispute semantics;
8. policy requires hardcoded rates;
9. policy requires live mutable Catalog lookup for historical truth;
10. Step 2.14E scope in current Roadmap materially differs from ADR-0013.

If a stop condition fires, make docs-only evidence changes if appropriate and STOP.

---

# 40. FORBIDDEN IN THIS PASS

Do not implement:

- commission amount calculation on Quote/Order/Payment;
- commission snapshot propagation;
- Commission fact producer;
- CommissionAccrual producer;
- Step 2.12E;
- Step 2.12A;
- Step 2.12B;
- Step 2.12C;
- Step 2.12D;
- PSP adapters;
- webhooks;
- native split;
- refund commission adjustment;
- dispute liability adjustment;
- invoice runtime;
- settlement/payout integration;
- ledger posting;
- frontend Finance Center UI;
- Step 2.14A–D.

---

# 41. IMPLEMENTATION REPORT

Create:

`docs/prompts/PHASE_2_STEP_2.14E_CHANNEL_BASED_COMMISSION_RULES_FOUNDATION_IMPLEMENTATION_REPORT.md`

Required sections:

1. Verdict
2. Repository baseline
3. Sources inspected
4. ADR-0013 reconciliation
5. Existing-state audit
6. Ownership
7. CommissionChannel contract
8. CommissionPolicy schema
9. Identifier
10. Percentage Decimal contract
11. Rate type
12. Effective dates
13. Version semantics
14. Overlap/ambiguity invariant
15. Policy resolution
16. CRUD/commands
17. Mass-assignment
18. RBAC
19. AuditLog
20. Events
21. Commission fact boundary
22. CommissionAccrual boundary
23. Payment/Refund/Dispute boundary
24. Ledger boundary
25. ProviderFee/Settlement/Payout boundary
26. Tax/FX boundary
27. Seller/partner snapshot dependency
28. Migration
29. Legacy compatibility
30. Concurrency
31. P2002/error handling
32. Idempotency semantics
33. Unit coverage
34. E2E coverage
35. Repo-wide write-path audit
36. Hardcoded-rate audit
37. Issues found during implementation
38. Backend regression
39. Frontend regression
40. DB regression
41. Files changed
42. Deferred scope
43. Roadmap update
44. Architecture decision status
45. Exact NEXT
46. Final canonical statement

---

# 42. ALLOWED FINAL VERDICTS

Successful implementation:

`PHASE 2 STEP 2.14E IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Architecture blocker:

`PHASE 2 STEP 2.14E BLOCKED — ARCHITECTURE DECISION REQUIRED`

Conflicting policy authority:

`PHASE 2 STEP 2.14E BLOCKED — CONFLICTING COMMISSION POLICY AUTHORITY`

Do not use APPROVED in an implementation pass.

---

# 43. FINAL HARD STOP

After implementation, tests, documentation, Roadmap status and implementation report:

**STOP.**

Do not perform Strict Review in the same pass.

Do not start 2.12E.

Do not start 2.12A/B/C/D.

Do not resume 2.14 or 2.14A–D.

The only NEXT item after successful implementation is:

`PHASE 2 — STEP 2.14E — STRICT REVIEW`
