# PHASE 2 — STEP 2.10C — FINANCE TEMPORAL CONTRACT — IMPLEMENTATION PROMPT

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.10C  
**Mode:** IMPLEMENTATION  
**Target:** Finance Temporal Contract  
**Predecessor:** `PHASE 2 STEP 2.10B STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`  
**NEXT after successful implementation:** `PHASE 2 — STEP 2.10C — STRICT REVIEW`  
**Hard stop:** Strict Review MUST NOT be performed in this pass.

---

# 1. MISSION

Implement the canonical **Finance Temporal Contract** for the Finance domain without prematurely implementing Payment/Refund/Invoice/Commission/Settlement/Payout business lifecycles that belong to later Roadmap steps.

The purpose of Step 2.10C is to establish a precise, durable, server-owned temporal vocabulary for Finance entities where the current architecture and approved Roadmap already justify such facts.

This step is NOT permission to invent lifecycle semantics.

The implementation must distinguish:

- immutable business facts;
- mutable workflow status;
- technical timestamps;
- provider timestamps;
- accounting/economic timestamps;
- settlement/payout timestamps;
- event occurrence time;
- persistence time.

The contract must prevent future Finance implementations from reconstructing business time from `updatedAt`, current status, AuditLog, provider payloads, or ledger insertion time.

---

# 2. AUTHORITATIVE BASELINE

Before editing code, inspect the actual repository.

At minimum inspect:

- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- Step 2.10 implementation + strict-review artifacts;
- Step 2.10A implementation + strict-review artifacts;
- Step 2.10B implementation + strict-review artifacts;
- Step 2.9A Booking Temporal Contract implementation/review as a structural precedent;
- Prisma Finance schema;
- all migrations creating Finance entities;
- Finance services/controllers/validation;
- `finance.money.ts`;
- `ledger.service.ts`;
- `settlement.service.ts`;
- Finance RBAC permissions;
- EventBus contracts;
- `docs/contracts/api.md`;
- `docs/contracts/events.md`;
- `docs/contracts/ids.md`;
- Finance architecture docs;
- temporal-readiness / phase-entry tests;
- all existing Finance E2E/unit tests.

Do NOT trust previous reports without checking actual code.

---

# 3. REPOSITORY BASELINE

Record:

- branch;
- HEAD;
- relation to origin;
- dirty/clean state;
- existing uncommitted changes;
- migration count;
- Prisma drift status;
- backend/frontend test baseline;
- exact Roadmap status;
- exact canonical NEXT.

Do not discard or rewrite unrelated approved work.

---

# 4. CURRENT → TARGET RECONCILIATION

Create an explicit reconciliation table before implementation.

For every Finance model currently present, classify it as one of:

1. master/reference data;
2. immutable financial fact;
3. future mutable lifecycle aggregate;
4. ledger/history fact;
5. future runtime model with no producer yet.

At minimum inspect:

- Currency;
- ExchangeRate;
- Tax;
- TaxRule;
- Payment;
- PaymentTerms;
- Refund;
- Invoice;
- Commission;
- CommissionAccrual;
- LedgerTransaction;
- ProviderFee;
- Settlement;
- Payout.

For every model state:

- current timestamps;
- current writers;
- current lifecycle/status fields;
- whether a business milestone is already semantically proven;
- whether Step 2.10C may add a temporal field;
- whether the field must remain deferred.

No temporal field may be added merely because it “will probably be useful”.

---

# 5. TEMPORAL VOCABULARY — HARD GATE

Derive the temporal vocabulary from existing approved architecture and Roadmap.

Do not begin with a predetermined list and force the schema to match it.

Candidate future concepts may include, but are not automatically approved:

- `authorizedAt`;
- `capturedAt`;
- `paidAt`;
- `failedAt`;
- `refundedAt`;
- `issuedAt`;
- `dueAt`;
- `accruedAt`;
- `settledAt`;
- `payoutRequestedAt`;
- `payoutProcessedAt`;
- `cancelledAt`.

For EACH candidate answer:

- What exact business fact does it represent?
- Which aggregate owns it?
- What exact transition/event establishes it?
- Is that transition already implemented?
- Is there currently a canonical producer?
- Is it first-only?
- Can it legitimately be NULL forever?
- Is it provider-authoritative or TravelHub-authoritative?
- Is it an instant or a date?
- Is it UTC?
- Can replay change it?
- Can correction/reversal change it?
- Does adding it now falsely imply lifecycle semantics?

If ownership or producer semantics are unresolved, **DEFER**.

---

# 6. NO FABRICATED MILESTONES

This is a critical invariant.

Step 2.10C must NOT fabricate business facts from:

- `createdAt`;
- `updatedAt`;
- AuditLog timestamps;
- Outbox timestamps;
- LedgerTransaction timestamps;
- provider reference creation;
- current status;
- migration execution time;
- historical rows whose actual occurrence time is unknown.

Legacy NULL is preferable to false historical precision.

No blanket backfill unless the repository contains an authoritative source that proves the exact timestamp.

---

# 7. TECHNICAL TIME VS BUSINESS TIME

Document and enforce the distinction:

- `createdAt` = persistence/record creation;
- `updatedAt` = technical mutation time where present;
- Finance milestone = actual business occurrence;
- Outbox `occurredAt` = event occurrence according to event contract;
- Ledger `createdAt` = ledger fact persistence time, not automatically Payment/Refund/Settlement business time;
- provider timestamp = external authority only if explicitly preserved under a defined contract.

Never use `updatedAt` as a substitute for a Finance milestone.

---

# 8. MODEL OWNERSHIP

Every temporal field must be written only by its owning Finance aggregate/service.

Forbidden:

- Order writing Payment milestones;
- Booking writing Payment/Refund milestones;
- Sales writing Finance milestones;
- LedgerService mutating Payment/Settlement/Payout;
- ProviderFee writer mutating Settlement/Payout;
- Settlement/Payout writer mutating Payment;
- frontend/client supplying server-owned milestones.

Cross-domain communication must continue through approved contracts/events.

---

# 9. SCOPE OF EXISTING FOUNDATION MODELS

## 9.1 LedgerTransaction

LedgerTransaction is already an immutable append-only fact.

Do NOT add lifecycle milestone fields to LedgerTransaction unless the current approved contract explicitly requires one.

Its `createdAt` remains the immutable ledger-fact timestamp unless repository evidence proves a distinct required occurrence field.

Do NOT implement:

- double-entry;
- balances;
- chart of accounts;
- reversal engine;
- automatic Finance posting.

## 9.2 ProviderFee / Settlement / Payout

Step 2.10B deliberately created immutable foundation facts with no statuses and no lifecycle producer semantics.

Do NOT silently turn them into mutable lifecycle aggregates.

If the Roadmap explicitly requires a temporal fact at foundation level and its semantics are already unambiguous, implement it.

Otherwise document it as deferred to the producer/lifecycle step.

In particular, do not invent payout request/processing states merely to populate timestamps.

---

# 10. PAYMENT / REFUND / INVOICE / COMMISSION BOUNDARY

Payment, Refund, Invoice, Commission and CommissionAccrual are not to receive fabricated runtime behavior in Step 2.10C.

Schema-level temporal readiness is allowed only where the canonical Roadmap explicitly assigns it to 2.10C and the meaning is already stable.

Do NOT implement:

- PSP integration;
- payment authorization/capture;
- refund processing;
- invoice issuance engine;
- commission calculation/accrual engine;
- settlement lifecycle;
- payout lifecycle.

Those belong to later steps.

---

# 11. SCHEMA DESIGN RULES

Any new Finance temporal field must be:

- additive;
- nullable unless existing rows can be authoritatively populated;
- `DateTime?` for instants;
- stored as UTC instant;
- server-owned;
- independently meaningful;
- not a duplicate alias of `createdAt`/`updatedAt`;
- compatible with future lifecycle implementation.

No destructive rename/drop.

No `db push`.

No fake default such as `@default(now())` for a business milestone unless the business fact is literally created at row insertion by canonical contract.

---

# 12. MIGRATION — HARD GATE

If schema changes are justified:

- create a normal Prisma migration;
- migration must be additive;
- no destructive ALTER unless explicitly required and separately justified;
- no fabricated backfill;
- no manual production DB mutation;
- prove fresh replay through real migrations;
- prove live schema → Prisma schema drift is zero.

If no schema changes are justified after repository analysis, this is allowed — but the implementation report must explain why Step 2.10C is documentation/contract-only and prove the Roadmap requirement is satisfied.

---

# 13. FIRST-ONLY SEMANTICS

For every milestone whose canonical producer already exists or is legitimately implemented in this step:

**first successful occurrence wins.**

A replay must not replace the original timestamp.

Use semantics equivalent to:

`existingMilestone ?? canonicalOccurrenceTime`

Do not use unconditional `now()` on retries.

Do not silently change a historical business timestamp because the same command/event was replayed.

---

# 14. CANONICAL OCCURRENCE TIME

Determine the authority for each implemented temporal field.

Possible authorities:

- server transaction time;
- canonical domain event `occurredAt`;
- validated provider occurrence time;
- pre-existing immutable source fact.

Document the choice per field.

Do not mix authorities unpredictably.

If provider time is accepted:

- validate it;
- preserve it explicitly;
- distinguish it from ingestion time;
- define replay behavior;
- reject impossible/malformed values according to existing validation conventions.

Do not add provider-time handling unless required by current contracts.

---

# 15. ATOMICITY

Where a milestone is written together with a state/fact transition, both must be committed atomically.

Required invariant:

`business transition + milestone + history/outbox (where applicable)`

must not leave partial truth.

No window where:

- status changed but milestone is NULL;
- milestone exists but transition failed;
- event says fact occurred but owned aggregate does not reflect it.

If current Step 2.10C has no runtime producer, document this invariant for the later producer step and do not invent one.

---

# 16. IDEMPOTENCY

Temporal additions must preserve approved idempotency contracts from:

- Step 2.10A LedgerTransaction;
- Step 2.10B ProviderFee / Settlement / Payout.

Identical replay must remain a no-op.

Divergent replay must remain controlled conflict where defined.

A milestone field must not accidentally become part of replay comparison if doing so would make identical logical replay diverge only because a retry occurred later.

---

# 17. CONCURRENCY

Where temporal fields have an active producer, test concurrent first-write behavior.

Examples only where applicable:

- same canonical transition concurrently;
- success vs failure;
- capture vs cancellation;
- refund vs another terminal transition;
- settlement/payout competing terminal facts.

Do NOT create lifecycle races for entities whose lifecycle is intentionally deferred.

Required property:

- no raw 500;
- no milestone overwrite;
- no impossible timestamp ordering created by race;
- one canonical business outcome according to the owning state machine.

---

# 18. TEMPORAL ORDERING

Do not globally assume all Finance timestamps must form one simple chain.

Ordering must be defined only when business semantics prove it.

Examples of potentially valid constraints in later steps:

`authorizedAt <= capturedAt`

`capturedAt <= paidAt`

`refund occurrence >= payment occurrence`

But Step 2.10C must not encode such constraints unless the current approved lifecycle contract establishes them.

Document known ordering and deferred ordering separately.

---

# 19. MASS ASSIGNMENT — HARD GATE

All server-owned Finance temporal fields must be impossible to forge through public APIs.

Audit:

- DTOs;
- raw request body handling;
- ValidationPipe whitelist behavior;
- `assertNoForbiddenKeys`;
- PATCH/create commands;
- master-data endpoints;
- future/schema-only routes accidentally exposed.

Forged temporal fields must produce the project’s explicit validation error convention — not silent stripping where the existing architecture requires loud rejection.

Do not rely only on DTO omission if raw-body forbidden-key validation is the established convention.

---

# 20. RBAC

Temporal fields do not create new permissions by themselves.

Use the owning action’s existing permission when a producer already exists.

Do not introduce generic:

- `finance.temporal.write`;
- `finance.milestone.manage`;

unless the repository already has a canonical requirement.

Read visibility must follow existing Finance read contracts.

---

# 21. API CONTRACT

Update `docs/contracts/api.md` where temporal fields become part of Finance read models.

For every exposed field specify:

- name;
- type;
- nullable;
- UTC semantics;
- server-owned;
- exact business meaning;
- whether legacy rows may return NULL.

Do not expose future fields as if their producer already exists.

---

# 22. EVENT CONTRACT

Step 2.10C must not invent domain events merely because timestamps exist.

If no new canonical business fact is introduced, add **zero events**.

If an existing event is the canonical producer authority for a milestone, document that relation without changing payload unless required.

Do not break ADR-0010 correlation/causation semantics.

---

# 23. LEDGER BOUNDARY

Finance temporal milestones must not cause automatic LedgerTransaction writes unless a later approved step explicitly owns that integration.

Prove Step 2.10A remains unchanged:

- one LedgerService writer;
- append-only;
- no hidden auto-posting;
- no balance/double-entry logic.

---

# 24. PROVIDER FEE / SETTLEMENT / PAYOUT BOUNDARY

Prove Step 2.10B invariants remain intact:

- ProviderFee ≠ Commission;
- Settlement ≠ Payout;
- Payment ≠ Payout;
- immutable foundation records remain immutable;
- no status vocabulary is invented;
- idempotency behavior remains identical;
- no cross-model mutation is introduced.

Remember the strict-review note:

future idempotency evolution belongs to:

- 2.12G fee-type discriminator;
- 2.14A settlement version;
- 2.14B payout attempt.

Do not pre-implement those here.

---

# 25. LEGACY COMPATIBILITY

Existing Finance rows must remain readable after migration.

Unknown historical milestone time must remain NULL.

Do not infer historical facts from record creation time unless authoritative equivalence is proven.

Old API consumers must not break because nullable fields were added.

---

# 26. PII / SECRETS

Temporal work must not introduce:

- bank account details;
- card data;
- PSP credentials;
- tokens;
- passport/customer PII;
- provider secret payloads

into events, AuditLog, error messages or temporal metadata.

AuditLog should continue to use minimal identifiers/codes.

---

# 27. WRITE-PATH AUDIT — HARD GATE

After implementation perform repository-wide audit for every Finance temporal field.

Classify every writer:

1. canonical owning service;
2. canonical consumer;
3. migration/backfill;
4. test fixture;
5. obsolete/unsafe writer.

Production category 5 must be **zero**.

For active milestones, there must be exactly the expected canonical writer set.

For deferred milestones, production writer count may correctly be zero.

Report exact files and methods.

---

# 28. TEMPORAL READINESS TEST EVOLUTION

Inspect existing temporal-readiness tests.

If they currently assert that Finance milestone columns are absent because Step 2.10C had not yet run, evolve those assertions explicitly.

Do not weaken the test broadly.

The evolved test should distinguish:

- fields legitimately introduced by 2.10C;
- fields still forbidden/deferred;
- business domains that must remain unchanged.

Add comments explaining the Roadmap evolution.

---

# 29. REQUIRED NEGATIVE TESTS

Implement applicable tests proving at minimum:

1. anonymous access → 401 where endpoint is protected;
2. unauthorized role → 403;
3. unknown entity → neutral 404;
4. forged Finance temporal field → explicit 422/established validation response;
5. client cannot overwrite an existing milestone;
6. replay cannot overwrite first occurrence;
7. legacy NULL is not fabricated;
8. malformed timestamp input cannot become authority;
9. `updatedAt` is not used as business milestone;
10. AuditLog timestamp is not used as business milestone;
11. LedgerTransaction `createdAt` is not automatically copied into unrelated Finance milestones;
12. no hidden LedgerTransaction auto-posting;
13. no Order/Booking/Sales/Reverse mutation;
14. ProviderFee/Settlement/Payout immutability remains;
15. no premature status/lifecycle routes appear;
16. no new Finance event without an approved consumer/contract;
17. no raw 500 from replay/concurrency cases;
18. migration does not backfill unknown historical facts.

If a test is structurally impossible because the producer is intentionally deferred, prove the boundary via schema/API/write-path tests and explain it.

---

# 30. REQUIRED POSITIVE TESTS

Where applicable prove:

1. legitimate Finance read returns temporal fields with stable response shape;
2. milestone is UTC instant;
3. first canonical occurrence sets it exactly once;
4. identical replay preserves it;
5. later unrelated update preserves it;
6. legacy row returns NULL;
7. canonical event occurrence time is preserved if that is the chosen authority;
8. active concurrency leaves one truthful first occurrence;
9. Finance master-data CRUD still works;
10. Ledger 2.10A regressions remain green;
11. ProviderFee/Settlement/Payout 2.10B regressions remain green;
12. all approved Order/Booking temporal contracts remain unaffected.

---

# 31. UNIT TESTS

Add focused unit tests for new pure validation/temporal helpers.

Test:

- valid UTC/date-time handling;
- invalid values;
- first-only helper behavior if introduced;
- authority selection;
- no float/money regression if shared Finance DTOs change.

Do not create meaningless unit tests solely to increase counts.

---

# 32. BACKEND REGRESSION

Run actual:

- `tsc --noEmit`;
- backend build;
- full unit suite;
- targeted Finance foundation;
- Ledger 2.10A;
- ProviderFee/Settlement/Payout 2.10B;
- temporal-readiness;
- RBAC;
- EventBus/business envelope if touched;
- Order/Booking temporal/lifecycle regressions;
- full serial E2E.

Report exact suite/test counts.

No estimated numbers.

---

# 33. FRONTEND REGRESSION

Even if frontend is unchanged run:

- TypeScript check;
- Vitest;
- production Next build.

Report exact counts.

Do not claim frontend unchanged without checking git diff.

---

# 34. DATABASE REGRESSION

Run:

- Prisma migration status;
- fresh replay of all migrations into disposable/test PostgreSQL;
- supported schema diff/drift check.

Report:

- exact migration count;
- replay result;
- drift result.

No `db push`.

---

# 35. ARCHITECTURE DOCUMENT

Create:

`docs/architecture/finance-temporal-contract.md`

It must contain at least:

1. purpose;
2. scope;
3. entity classification;
4. temporal vocabulary;
5. implemented milestones;
6. deferred milestones;
7. business vs technical time;
8. ownership;
9. canonical occurrence authority;
10. first-only semantics;
11. atomicity;
12. idempotency;
13. concurrency;
14. ordering rules;
15. legacy NULL policy;
16. mass-assignment protection;
17. RBAC;
18. API exposure;
19. event boundary;
20. ledger boundary;
21. ProviderFee/Settlement/Payout boundary;
22. migration strategy;
23. write-path audit;
24. future producer obligations;
25. out-of-scope items.

---

# 36. CONTRACT DOCUMENTATION

Update only as justified:

- `docs/contracts/api.md`;
- `docs/contracts/events.md`;
- `docs/contracts/ids.md` only if identifier behavior actually changes;
- relevant Finance architecture docs.

Do not create fictional event contracts.

---

# 37. ROADMAP UPDATE

After successful implementation update canonical Roadmap:

Step 2.10C →

`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

NEXT →

`PHASE 2 — STEP 2.10C — STRICT REVIEW`

Do not mark APPROVED.

Do not start the next business step.

---

# 38. REQUIRED IMPLEMENTATION REPORT

Create:

`docs/prompts/PHASE_2_STEP_2.10C_FINANCE_TEMPORAL_CONTRACT_IMPLEMENTATION_REPORT.md`

Required sections:

1. Verdict
2. Repository baseline
3. Sources inspected
4. Current → Target reconciliation
5. Finance entity classification
6. Temporal vocabulary audit
7. Implemented milestones
8. Deferred milestones
9. Technical time vs business time
10. Ownership
11. Canonical occurrence authority
12. Schema changes
13. Migration
14. Backfill policy
15. First-only semantics
16. Atomicity
17. Idempotency
18. Concurrency
19. Temporal ordering
20. Mass assignment
21. RBAC
22. API contract
23. Event contract
24. Ledger boundary
25. ProviderFee boundary
26. Settlement boundary
27. Payout boundary
28. Payment/Refund/Invoice/Commission boundary
29. Legacy compatibility
30. PII/secrets
31. Write-path audit
32. Negative coverage
33. Positive coverage
34. Unit tests
35. Backend regression
36. Frontend regression
37. DB regression
38. Issues found
39. Fixes applied
40. Architecture decision status
41. Deferred work
42. Out-of-scope confirmation
43. Exact files changed
44. Roadmap update
45. Exact NEXT item

---

# 39. ARCHITECTURE STOP CONDITIONS

STOP and report:

`ARCHITECTURE DECISION REQUIRED`

if any of the following occurs:

- Payment milestone meaning cannot be determined without choosing a PSP lifecycle;
- `paidAt` conflicts between authorization/capture/settlement semantics;
- Refund timestamp ownership is ambiguous;
- Invoice issue/due semantics conflict with future invoice model;
- Commission accrual time requires unresolved accounting recognition policy;
- Settlement timestamp requires unresolved settlement version semantics;
- Payout timestamp requires unresolved payout-attempt semantics;
- provider time vs TravelHub time authority cannot be reconciled;
- temporal field would require fabricated backfill;
- current schema forces destructive migration;
- temporal implementation requires starting Payment/Refund/Invoice/Commission runtime early;
- milestone ownership crosses domain boundaries;
- multiple conflicting writers exist;
- temporal ordering requires a business decision not present in approved architecture;
- a required timestamp would incorrectly imply double-entry/accounting recognition.

Do not guess through these conditions.

---

# 40. OUT OF SCOPE

Do NOT implement:

- Payment PSP runtime;
- payment authorization/capture engine;
- Refund workflow;
- Invoice workflow;
- Commission calculation;
- CommissionAccrual producer;
- double-entry accounting;
- chart of accounts;
- balances;
- automatic ledger posting;
- provider reconciliation;
- Settlement lifecycle/versioning;
- Payout attempts;
- bank rails;
- Finance frontend;
- Step 2.12+ functionality;
- Step 2.17 hardening;
- unrelated refactoring.

---

# 41. STRICT REVIEW SEPARATION

This pass is implementation only.

Do NOT perform adversarial Strict Review in the same pass.

Do NOT write:

`STRICT REVIEW COMPLETED`

Do NOT mark Step 2.10C approved.

The only successful implementation verdict is:

**`PHASE 2 STEP 2.10C IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`**

If blocked:

**`PHASE 2 STEP 2.10C IMPLEMENTATION BLOCKED — ARCHITECTURE DECISION REQUIRED`**

---

# 42. FINAL EXECUTION ORDER

Execute strictly:

1. repository baseline;
2. source inspection;
3. entity classification;
4. temporal vocabulary audit;
5. stop-condition evaluation;
6. Current→Target reconciliation;
7. schema/contract implementation only where justified;
8. migration;
9. validation/mass-assignment protection;
10. active producer integration only if already canonical;
11. tests;
12. architecture docs;
13. contracts;
14. targeted regression;
15. full backend regression;
16. frontend regression;
17. DB replay/drift;
18. write-path audit;
19. implementation report;
20. Roadmap update;
21. STOP.

Do not start Strict Review.

---

# 43. FINAL HARD STOP

After the implementation report and Roadmap update:

**STOP.**

Expected terminal state:

`PHASE 2 STEP 2.10C IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

NEXT:

`PHASE 2 — STEP 2.10C — STRICT REVIEW`
