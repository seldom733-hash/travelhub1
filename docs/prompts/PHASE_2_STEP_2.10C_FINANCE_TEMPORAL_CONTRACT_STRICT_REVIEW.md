# PHASE 2 --- STEP 2.10C --- FINANCE TEMPORAL CONTRACT --- STRICT REVIEW

## 0. ROLE

You are performing an **independent adversarial STRICT REVIEW** of:

**PHASE 2 --- STEP 2.10C --- FINANCE TEMPORAL CONTRACT**

This is **not** an implementation pass and **not** a documentation-only
review.

You must verify the implementation against the **actual repository
state, Prisma schema, migration SQL, production code, tests, runtime
behavior, architecture/contracts, and roadmap**.

Do **not** trust the implementation report as evidence. Treat it only as
a list of claims that must be independently proven or disproven.

The expected current implementation claim is:

> `PHASE 2 STEP 2.10C IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Your task is to determine whether the correct final verdict is one of:

-   `PHASE 2 STEP 2.10C STRICT REVIEW COMPLETED — APPROVED`
-   `PHASE 2 STEP 2.10C STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
-   `PHASE 2 STEP 2.10C STRICT REVIEW FAILED`
-   `ARCHITECTURE DECISION REQUIRED`

Do not begin Step 2.11, Step 2.12, or any later step.

------------------------------------------------------------------------

# 1. REVIEW OBJECTIVE

Independently prove that Step 2.10C introduces only the temporal
semantics that are currently justified by canonical producers and does
not fabricate Finance lifecycle history.

The implementation claims that:

1.  `finance.LedgerTransaction.occurredAt` is the **only** newly
    justified Finance temporal business fact.
2.  `occurredAt` represents **business occurrence time**, while
    `createdAt` represents **persistence time**.
3.  `occurredAt` is nullable and legacy rows are not backfilled with
    fabricated timestamps.
4.  `occurredAt` is written only by the canonical Ledger writer.
5.  It is server-validated and cannot be forged through public Finance
    APIs.
6.  Replay semantics remain first-write-wins.
7.  Finance lifecycle milestones belonging to future Payment / Refund /
    Settlement / Payout semantics remain deferred.
8.  No new Finance events, permissions, balance logic, double-entry
    logic, PSP behavior, or cross-domain writes were introduced.
9.  Existing 2.10 / 2.10A / 2.10B contracts remain intact.

Every claim above is a hypothesis until independently verified.

------------------------------------------------------------------------

# 2. REQUIRED BASELINE CAPTURE

Before reviewing implementation details, record:

-   current branch;
-   current HEAD;
-   origin relationship;
-   working-tree status;
-   relevant uncommitted changes;
-   Prisma migration count;
-   latest migration name;
-   current Roadmap status for 2.10C;
-   whether Step 2.11 / 2.12+ has accidentally started.

Do not rewrite unrelated existing work.

If the repository is not in the expected state, document the discrepancy
before proceeding.

------------------------------------------------------------------------

# 3. SOURCES THAT MUST BE INSPECTED

At minimum inspect the actual current versions of:

-   `backend/prisma/schema.prisma`
-   Step 2.10C migration SQL
-   `backend/src/modules/finance/ledger.service.ts`
-   Finance controllers / DTOs / validation used by ledger read/write
    surfaces
-   Finance module wiring
-   shared validation utilities involved in ISO timestamp validation
-   event bus / domain event definitions if relevant
-   RBAC permissions/constants if touched
-   `backend/test/booking-temporal-contract.e2e-spec.ts` as prior
    temporal-contract convention where useful
-   Finance foundation e2e tests
-   Ledger foundation e2e tests
-   Step 2.10B e2e tests
-   Step 2.10C temporal e2e coverage
-   `temporal-readiness` tests
-   `phase2-entry-audit` where applicable
-   e2e global setup / migration replay harness
-   `docs/contracts/api.md`
-   `docs/contracts/events.md`
-   `docs/contracts/ids.md` if affected
-   `docs/architecture/ledger-transaction-foundation.md`
-   `docs/architecture/finance-temporal-contract.md`
-   `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
-   the Step 2.10C implementation report

Search the full production source tree for temporal field writers; do
not rely on known filenames.

------------------------------------------------------------------------

# 4. CANONICAL TEMPORAL VOCABULARY --- HARD GATE

Build an independent inventory of every Finance temporal-looking field
currently present in Prisma and production code.

At minimum search for names and semantic equivalents of:

-   `occurredAt`
-   `authorizedAt`
-   `capturedAt`
-   `paidAt`
-   `failedAt`
-   `refundedAt`
-   `cancelledAt`
-   `settledAt`
-   `payoutAt`
-   `paidOutAt`
-   `processedAt`
-   `completedAt`
-   `reversedAt`
-   `voidedAt`

Classify each as:

1.  canonical business milestone;
2.  persistence/audit timestamp;
3.  legacy field;
4.  deferred / forbidden for this step;
5.  unrelated domain field.

**Hard fail** if Step 2.10C silently introduces lifecycle milestones
whose producer semantics do not yet exist.

------------------------------------------------------------------------

# 5. `occurredAt` SEMANTICS --- HARD GATE

Independently prove the exact meaning of:

-   `LedgerTransaction.occurredAt`
-   `LedgerTransaction.createdAt`

Required semantic distinction:

-   `occurredAt` = when the represented business/financial fact
    occurred;
-   `createdAt` = when TravelHub persisted the ledger record.

Verify that code, tests, API contract, architecture docs, and migration
all agree.

Reject ambiguous wording such as "transaction date" if it allows the two
concepts to collapse.

No code may derive business occurrence time from `updatedAt`.

------------------------------------------------------------------------

# 6. NULLABILITY AND UNKNOWN TIME

Verify:

-   `occurredAt` is nullable;
-   absence of an authoritative occurrence timestamp is represented by
    `NULL`;
-   the system does not substitute `createdAt`, current time, midnight,
    epoch, or another fabricated timestamp merely to fill the field;
-   legacy records remain valid with `occurredAt = NULL`.

A nullable field is intentional business truth, not incomplete migration
work.

**Hard fail** if unknown occurrence time is fabricated.

------------------------------------------------------------------------

# 7. MIGRATION REVIEW --- HARD GATE

Inspect the actual SQL migration.

Prove that it is additive and safe.

Expected shape:

-   add nullable `occurredAt` to `finance.LedgerTransaction`;
-   no destructive table rewrite;
-   no unrelated schema changes;
-   no fabricated backfill;
-   no `db push`;
-   no manual DB-only state.

Run and report:

-   migration status;
-   clean/fresh migration replay through the real e2e harness;
-   Prisma schema ↔ database diff.

Expected current baseline claim: **50/50 migrations, drift 0**.

Do not copy this number from the implementation report---verify it.

------------------------------------------------------------------------

# 8. WRITE-PATH AUDIT --- HARD GATE

Search the entire production codebase for all writes to:

-   `LedgerTransaction`;
-   specifically `occurredAt`.

Classify every writer.

Expected invariant:

> Exactly one canonical production Ledger writer remains:
> `LedgerService.create`.

Check for:

-   `.create`
-   `.update`
-   `.updateMany`
-   `.upsert`
-   `.delete`
-   `.deleteMany`
-   raw SQL
-   seeds
-   jobs
-   consumers
-   scripts
-   tests accidentally imported into runtime
-   cross-domain writes

There must be **zero** alternative `occurredAt` writers.

If multiple production authorities exist, stop with:

`ARCHITECTURE DECISION REQUIRED`

unless the conflict is clearly an implementation defect with an
unambiguous canonical authority already established.

------------------------------------------------------------------------

# 9. APPEND-ONLY LEDGER REGRESSION

Step 2.10C must not weaken Step 2.10A.

Re-prove:

-   no Ledger `updatedAt`;
-   no public mutation endpoint;
-   no production update/delete path;
-   no cascade behavior that can silently erase Ledger history;
-   no mutation of an existing Ledger fact to "correct" occurrence time.

`occurredAt` must be immutable after first creation.

A later correction must not be implemented by editing the historical row
unless a later canonical architecture step explicitly defines such
semantics.

------------------------------------------------------------------------

# 10. INPUT AUTHORITY

Determine where `occurredAt` originates.

Verify that:

-   the source is server-authoritative or server-validated;
-   arbitrary public Finance write APIs cannot create Ledger records;
-   HTTP clients cannot mass-assign Ledger server-owned fields;
-   an ISO 8601 timestamp is validated before persistence;
-   invalid temporal input results in a controlled domain/API error,
    never a raw 500.

Document the accepted ISO form from actual code/tests. Do not invent a
stricter or looser contract.

------------------------------------------------------------------------

# 11. UTC / OFFSET NORMALIZATION

Verify actual runtime behavior for timestamps with offsets.

Required invariant:

> Stored business occurrence is an absolute instant.

Check whether Prisma/PostgreSQL normalizes the instant as expected.

Test at least:

-   `Z`;
-   a positive offset;
-   a negative offset.

Equivalent instants supplied with different offsets must represent the
same instant after persistence.

Do not require preservation of the original textual offset unless the
schema explicitly promises it.

------------------------------------------------------------------------

# 12. FUTURE-TIME POLICY

Inspect the implementation for any invariant such as:

`occurredAt <= createdAt`

If such an invariant exists, independently determine whether it is
intentional, consistently enforced, and documented.

Test the boundary rather than only a hard-coded date.

At minimum verify:

-   historical occurrence accepted;
-   obviously future occurrence rejected if the contract forbids future
    occurrence;
-   no flaky test depends on wall-clock timing within a few
    milliseconds.

If implementation, tests, and docs disagree on future-time semantics,
treat it as a real contract defect.

------------------------------------------------------------------------

# 13. FIRST-WRITE-WINS --- HARD GATE

Re-prove the Step 2.10A idempotency contract after addition of
`occurredAt`.

The implementation report claims:

> `occurredAt` is outside divergent-replay payload comparison.

Do not automatically approve this.

Independently inspect the idempotency contract and determine the
resulting behavior for:

### Case A --- identical replay

Same idempotency key and same canonical financial payload.

Expected: no duplicate Ledger fact.

### Case B --- replay with different amount/currency

Expected from 2.10A strict review: controlled conflict, not silent
no-op.

### Case C --- replay with same canonical financial payload but different `occurredAt`

Verify actual intended contract.

If the canonical design is truly first-write-wins for occurrence time:

-   existing row must remain unchanged;
-   no second row;
-   no update;
-   no raw 500;
-   docs must explicitly explain why temporal metadata is not part of
    divergent-payload rejection.

If this behavior creates a semantic contradiction with the stated
authority of `occurredAt`, do **not** paper over it---raise
`ARCHITECTURE DECISION REQUIRED`.

------------------------------------------------------------------------

# 14. CONCURRENT REPLAY

Add or verify adversarial concurrency coverage.

At minimum test concurrent attempts sharing the same idempotency
invariant with:

1.  identical financial payload + identical `occurredAt`;
2.  identical financial payload + different `occurredAt`;
3.  divergent amount;
4.  divergent currency.

Required:

-   one durable Ledger fact;
-   no duplicate;
-   no mutation after first write;
-   divergent canonical payload remains controlled conflict;
-   no raw 500.

For temporal disagreement, behavior must match the explicitly documented
first-write-wins contract.

------------------------------------------------------------------------

# 15. P2002 SAFETY REGRESSION

Re-audit unique-constraint handling.

Verify:

-   known idempotency invariant → intended replay handling;
-   Ledger code collision → controlled conflict/retry according to
    established ID convention;
-   unknown P2002 → controlled conflict or rethrow into controlled error
    path, but never silently treated as idempotent replay;
-   non-P2002 defects are not swallowed.

No global "all P2002 means duplicate replay" catch is allowed.

------------------------------------------------------------------------

# 16. IMMUTABILITY OF `occurredAt`

Prove that once a Ledger row exists:

-   public API cannot patch it;
-   internal replay cannot overwrite it;
-   concurrent duplicate cannot overwrite it;
-   no maintenance path silently rewrites it.

Search production source, not just controller routes.

------------------------------------------------------------------------

# 17. LEGACY COMPATIBILITY

Prove that pre-2.10C Ledger rows with `occurredAt = NULL`:

-   can still be listed;
-   can still be fetched by detail API;
-   do not crash serialization;
-   are not "repaired" on read;
-   remain semantically unknown.

No fake backfill during application startup is allowed.

------------------------------------------------------------------------

# 18. READ API CONTRACT

Verify how `occurredAt` appears in Ledger list/detail responses.

Check:

-   nullable representation;
-   ISO serialization;
-   stable response shape;
-   no accidental exposure of unrelated internals;
-   pagination/filter behavior remains unchanged unless intentionally
    extended.

If filtering/sorting by `occurredAt` was not part of Step 2.10C, ensure
it was not invented without contract.

------------------------------------------------------------------------

# 19. MASS ASSIGNMENT

Search all Finance mutation endpoints and DTO/raw-body validation.

Attempt forged fields including:

-   `occurredAt`
-   future lifecycle milestone names such as `paidAt`, `settledAt`,
    `refundedAt`
-   `createdAt`
-   `code`
-   provenance fields where server-owned

Expected behavior must follow the established project convention: loud
rejection where forbidden-key validation applies, not silent stripping
that makes a forged request appear successful.

Do not weaken existing 2.10/2.10A/2.10B protections.

------------------------------------------------------------------------

# 20. PAYMENT TEMPORAL BOUNDARY --- HARD GATE

Step 2.10C must **not** invent Payment lifecycle timestamps before
Payment semantics/producers exist.

Search Prisma, production code, migrations, events, tests, docs, and API
for premature fields such as:

-   `authorizedAt`
-   `capturedAt`
-   `paidAt`
-   `failedAt`
-   `voidedAt`

If any were introduced by 2.10C without canonical producers, fail the
review or require an architecture decision.

Schema-only future models are not justification for fabricated
milestones.

------------------------------------------------------------------------

# 21. REFUND TEMPORAL BOUNDARY --- HARD GATE

Similarly verify no premature Refund lifecycle timestamps such as:

-   `requestedAt`
-   `approvedAt`
-   `refundedAt`
-   `failedAt`
-   `completedAt`

unless already canonically owned by an approved prior step.

Step 2.13 remains deferred.

------------------------------------------------------------------------

# 22. SETTLEMENT TEMPORAL BOUNDARY --- HARD GATE

Step 2.10B created immutable Settlement foundation facts without
lifecycle semantics.

Verify Step 2.10C did not add invented:

-   `settledAt`
-   `processedAt`
-   `completedAt`
-   mutable settlement status timestamps.

Settlement lifecycle/version semantics remain for their designated
future step.

------------------------------------------------------------------------

# 23. PAYOUT TEMPORAL BOUNDARY --- HARD GATE

Verify Step 2.10C did not invent payout operational milestones such as:

-   `requestedAt`
-   `approvedAt`
-   `sentAt`
-   `paidOutAt`
-   `failedAt`
-   `cancelledAt`

without a canonical payout lifecycle/rail producer.

Payout remains distinct from buyer Payment.

------------------------------------------------------------------------

# 24. PROVIDER FEE BOUNDARY

Verify ProviderFee remains an immutable financial fact and Step 2.10C
did not add a fake lifecycle or temporal workflow to it.

Its existing `createdAt` is persistence/audit time unless another
canonical occurrence fact is explicitly defined.

Do not generalize Ledger `occurredAt` to all Finance models without
proof.

------------------------------------------------------------------------

# 25. LEDGER VS PAYMENT / SETTLEMENT / PAYOUT

Re-prove domain separation.

`LedgerTransaction.occurredAt` must not be treated as a substitute for:

-   Payment authorization time;
-   Payment capture time;
-   refund completion;
-   settlement completion;
-   payout execution.

A generic ledger occurrence instant cannot silently become the lifecycle
authority for other Finance entities.

------------------------------------------------------------------------

# 26. EVENTS BOUNDARY

Search actual domain-event definitions and Finance producers.

Expected Step 2.10C result:

-   **0 new Finance domain events** solely for temporal fields;
-   no event emitted merely because `occurredAt` exists;
-   no undocumented consumers;
-   no event payload suddenly made authoritative for future
    Payment/Refund/Settlement/Payout milestones.

If events were added, require a concrete consumer contract and roadmap
authority.

------------------------------------------------------------------------

# 27. LEDGER AUTO-POSTING BOUNDARY

Re-prove that Step 2.10C did not introduce automatic ledger posting
from:

-   Payment;
-   Refund;
-   Commission;
-   ProviderFee;
-   Settlement;
-   Payout;
-   Order;
-   Booking.

Ledger producer integration belongs to later canonical steps.

Existing Ledger writer count must remain exactly as intended.

------------------------------------------------------------------------

# 28. DOUBLE-ENTRY / BALANCE BOUNDARY

Verify there is still no accidental implementation of:

-   chart of accounts;
-   debit/credit legs;
-   account balances;
-   derived wallet balances;
-   reconciliation engine;
-   reversal engine masquerading as row mutation.

Step 2.10C is temporal semantics only.

------------------------------------------------------------------------

# 29. FX / TAX BOUNDARY

Verify `occurredAt` does not trigger or silently alter:

-   FX conversion;
-   exchange-rate selection;
-   tax calculation;
-   tax effective-date logic.

Those semantics require their own canonical contract.

------------------------------------------------------------------------

# 30. CROSS-DOMAIN WRITE AUDIT

Search for Step 2.10C changes that write to:

-   Order;
-   Booking;
-   Sales;
-   Reverse;
-   Catalog;
-   Availability;
-   CRM;
-   Communication.

Expected: **0 cross-domain writes**.

Finance temporal metadata must not mutate operational domains.

------------------------------------------------------------------------

# 31. RBAC REGRESSION

Step 2.10C claims no RBAC change.

Verify:

-   no new permission was unnecessarily introduced;
-   existing `finance.ledger.read` behavior remains intact;
-   anonymous → 401 where protected;
-   unauthorized roles → 403;
-   authorized read roles remain correct;
-   temporal field does not create a new public write surface.

------------------------------------------------------------------------

# 32. PII / SECURITY REVIEW

Verify `occurredAt` work did not introduce:

-   PII into AuditLog;
-   PII into events;
-   raw request-body dumps;
-   bank details;
-   PSP credentials;
-   provider secrets.

Audit metadata should remain minimal.

------------------------------------------------------------------------

# 33. AUDIT LOG REGRESSION

If Ledger creation produces AuditLog entries, verify temporal changes do
not cause:

-   duplicate audit entries on replay;
-   divergent audit semantics;
-   PII leakage;
-   client-forged actor/correlation fields.

Do not invent new audit actions merely for temporal metadata unless
contractually required.

------------------------------------------------------------------------

# 34. CORRELATION / CAUSATION / ACTOR

Re-prove Step 2.10A provenance behavior.

Verify `occurredAt` addition does not allow HTTP payloads to override:

-   `correlationId`
-   `causationId`
-   `actorType`
-   `actorId`

These remain server-authoritative.

------------------------------------------------------------------------

# 35. TEST QUALITY REVIEW

Do not only count tests.

Inspect whether Step 2.10C tests actually prove the contract.

Reject tests that:

-   merely inspect schema text;
-   assert a hard-coded future date that becomes flaky;
-   do not inspect persisted values;
-   silently depend on test execution order;
-   pass because forged fields are stripped before validation;
-   use mocks where a DB concurrency invariant must be proven;
-   fail to distinguish occurrence time from persistence time.

------------------------------------------------------------------------

# 36. REQUIRED NEGATIVE TEST MATRIX

Ensure equivalent runtime coverage exists for at least:

1.  invalid `occurredAt` format → controlled validation failure;
2.  impossible/non-ISO timestamp rejected according to actual validator;
3.  forbidden public mutation of Ledger → 404/appropriate route absence;
4.  forged server-owned temporal field on relevant public surface → loud
    rejection where applicable;
5.  future `occurredAt` rejected if future times are contractually
    forbidden;
6.  divergent amount replay → 409;
7.  divergent currency replay → 409;
8.  unknown P2002 is not treated as replay;
9.  legacy `occurredAt = NULL` remains readable;
10. future Payment milestone forging is impossible;
11. future Refund milestone forging is impossible;
12. future Settlement milestone forging is impossible;
13. future Payout milestone forging is impossible;
14. no Ledger update/delete path;
15. no cross-domain mutation;
16. no new event side effect.

If a requirement is not HTTP-testable, provide code-audit evidence and
explain why.

------------------------------------------------------------------------

# 37. REQUIRED POSITIVE TEST MATRIX

Ensure equivalent runtime coverage exists for:

1.  Ledger creation without occurrence time → `occurredAt = NULL`;
2.  Ledger creation with valid historical `occurredAt`;
3.  persisted `occurredAt` represents the same absolute instant;
4.  `createdAt` remains persistence timestamp and is not replaced;
5.  `occurredAt <= createdAt` if that invariant is part of the actual
    contract;
6.  identical replay → one Ledger fact;
7.  replay does not overwrite first `occurredAt`;
8.  concurrent identical replay → one fact;
9.  concurrent temporal disagreement follows documented first-write-wins
    semantics;
10. list API returns nullable `occurredAt`;
11. detail API returns nullable `occurredAt`;
12. pre-existing Ledger foundation behavior remains green;
13. ProviderFee/Settlement/Payout foundation remains green;
14. Finance master-data foundation remains green.

------------------------------------------------------------------------

# 38. REQUIRED CONCURRENCY TESTS

At minimum independently validate:

### 38.1 identical concurrent replay

Same canonical payload, same temporal input.

Expected: one fact.

### 38.2 temporal disagreement

Same canonical financial payload, same idempotency invariant, different
`occurredAt`.

Expected behavior must match the approved first-write-wins contract and
must never mutate the first fact.

### 38.3 financial disagreement

Same idempotency invariant, different amount/currency.

Expected: one fact + controlled conflict for divergent attempt.

### 38.4 raw failure safety

No race may produce an unhandled/raw 500 for an expected unique
collision.

------------------------------------------------------------------------

# 39. FRESH DATABASE PROOF

The full e2e result only counts as migration replay proof if the harness
truly:

1.  drops/recreates or creates a clean isolated test DB;
2.  executes real Prisma migrations via `migrate deploy`;
3.  does not use `db push`;
4.  then runs the suites.

Inspect the harness and state this explicitly in the report.

------------------------------------------------------------------------

# 40. BACKEND REGRESSION

Run actual current commands required by the repository.

At minimum:

-   TypeScript typecheck;
-   backend build if separately configured;
-   full unit suite;
-   targeted Step 2.10 / 2.10A / 2.10B / 2.10C tests;
-   full serial e2e.

Implementation-report baseline to verify, not trust:

-   unit: **497/497**
-   serial e2e: **1057/1057**
-   suites: **59**

If counts legitimately change due to review fixes, report both
before/after and why.

No skipped/focused tests may hide failures.

------------------------------------------------------------------------

# 41. FRONTEND REGRESSION

Even if frontend is untouched, run:

-   frontend TypeScript check;
-   Vitest;
-   production build.

Implementation-report baseline:

-   Vitest **135/135**
-   production build successful.

Report actual results.

------------------------------------------------------------------------

# 42. DATABASE REGRESSION

Run and report:

-   `prisma migrate status`;
-   schema/database diff;
-   fresh replay evidence.

Expected implementation baseline:

-   **50/50 migrations**
-   **No difference / drift 0**

Any unexplained drift is a review failure.

------------------------------------------------------------------------

# 43. DOCUMENTATION CONSISTENCY

Compare actual implementation with:

-   `docs/architecture/finance-temporal-contract.md`
-   `docs/architecture/ledger-transaction-foundation.md`
-   `docs/contracts/api.md`
-   `docs/contracts/events.md`
-   Roadmap v3

Verify docs do not claim:

-   Payment milestones already exist;
-   Settlement/Payout lifecycle exists;
-   `occurredAt` is mandatory if schema allows NULL;
-   `createdAt` is business occurrence time;
-   retry/correction behavior that code does not implement;
-   events or producers that do not exist.

Documentation defects that misrepresent runtime must be fixed during
review.

------------------------------------------------------------------------

# 44. ARCHITECTURE STOP CONDITIONS

Stop and return:

`ARCHITECTURE DECISION REQUIRED`

if any of the following is discovered and cannot be resolved from
already approved canonical contracts:

1.  more than one authoritative Ledger temporal writer;
2.  disagreement over whether `occurredAt` is event occurrence vs
    persistence time;
3.  disagreement over whether replay with a different `occurredAt` must
    conflict or first-write-wins;
4.  need to introduce Payment/Refund/Settlement/Payout milestones before
    their producer contracts exist;
5.  need to mutate historical Ledger rows to correct occurrence time;
6.  need for a generic Finance "business date" that collapses multiple
    domain semantics;
7.  need for cross-domain writes;
8.  need for double-entry/balance/reversal architecture;
9.  need for new Finance events without an approved consumer;
10. destructive migration/backfill needed to satisfy the contract.

Do not invent architecture merely to make tests pass.

------------------------------------------------------------------------

# 45. REVIEW FIX POLICY

If a concrete implementation defect is found and the approved
architecture makes the correct behavior unambiguous:

1.  fix it;
2.  add a regression test that would have failed before the fix;
3.  run targeted tests;
4.  run full regression;
5.  document the defect and exact fix.

Do not expand scope.

Review fixes must be minimal.

------------------------------------------------------------------------

# 46. FORBIDDEN DURING THIS REVIEW

Do **not**:

-   begin Step 2.11;
-   begin Step 2.12 Payment;
-   begin Step 2.13 Refund;
-   begin Step 2.14 Invoice/Settlement/Payout lifecycle work;
-   implement PSP integration;
-   implement double-entry accounting;
-   implement balances;
-   implement automatic Ledger posting;
-   add speculative lifecycle statuses;
-   add speculative Finance milestones;
-   add speculative domain events;
-   redesign Finance Center frontend;
-   refactor unrelated services;
-   "clean up" legacy code unrelated to the review.

------------------------------------------------------------------------

# 47. ROADMAP UPDATE RULE

Only after all hard gates and regressions pass, update Roadmap v3.

Use one of:

-   `✅ STRICT REVIEW COMPLETED — APPROVED`
-   `✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

Set NEXT to the **exact next canonical Roadmap item** after Step 2.10C.

Do not infer the next step from memory if the current Roadmap names it
differently. Read the actual Roadmap and copy its exact canonical title.

If review fails, do not mark Step 2.10C approved.

------------------------------------------------------------------------

# 48. REQUIRED STRICT REVIEW REPORT

Create:

`docs/prompts/PHASE_2_STEP_2.10C_FINANCE_TEMPORAL_CONTRACT_STRICT_REVIEW.md`

The report must contain at least:

1.  Verdict
2.  Repository baseline
3.  Sources inspected
4.  Temporal vocabulary audit
5.  `occurredAt` semantic review
6.  Migration review
7.  Write-path audit
8.  Append-only regression
9.  Input authority / validation
10. UTC / offset behavior
11. Future-time policy
12. First-write-wins review
13. Replay / concurrency review
14. P2002 review
15. Legacy compatibility
16. Read API contract
17. Mass-assignment review
18. Payment temporal boundary
19. Refund temporal boundary
20. Settlement temporal boundary
21. Payout temporal boundary
22. ProviderFee boundary
23. Ledger/domain separation
24. Events boundary
25. Auto-posting boundary
26. Double-entry/balance boundary
27. FX/tax boundary
28. Cross-domain write audit
29. RBAC / PII / AuditLog / provenance
30. Test coverage audit
31. Backend regression
32. Frontend regression
33. DB regression
34. Issues found
35. Review fixes applied
36. Architecture decision status
37. Exact files changed during review
38. Roadmap update
39. Exact NEXT item
40. Final certification

For every issue found, include:

-   severity;
-   evidence;
-   violated invariant;
-   exact fix;
-   regression test;
-   post-fix result.

------------------------------------------------------------------------

# 49. FINAL CERTIFICATION

If no fixes are required and every gate passes, end with exactly:

`PHASE 2 STEP 2.10C STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`

If fixes were required and all regressions pass, end with exactly:

`PHASE 2 STEP 2.10C STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

If unresolved defects remain, end with:

`PHASE 2 STEP 2.10C STRICT REVIEW FAILED`

If canonical semantics cannot be determined without a new architecture
decision, end with:

`ARCHITECTURE DECISION REQUIRED`

------------------------------------------------------------------------

# 50. HARD STOP

After producing the Strict Review report and updating the Roadmap as
permitted:

**STOP.**

Do not implement the next phase/step in the same pass.
