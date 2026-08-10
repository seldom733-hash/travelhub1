# PHASE 2 — STEP 2.5B — ACQUISITION SOURCE PROPAGATION
## STRICT REVIEW PROMPT

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.5B — Acquisition Source Propagation  
**Mode:** STRICT REVIEW / REVIEW FIXES ONLY

# 1. MISSION

Perform an independent, code-first STRICT REVIEW of Phase 2 Step 2.5B.

Do NOT approve from the implementation report alone.

Reconstruct the actual acquisition lineage from schema, migrations, services, event contracts, subscribers, tests, Roadmap and ADRs.

Primary question:

Does TravelHub now preserve one truthful, server-authoritative acquisition fact through the canonical pipeline without fabricating historical attribution, creating a second attribution system, weakening bounded-context ownership, or prematurely implementing Reverse Marketplace / Booking / Finance?

# 2. REVIEW BOUNDARY

Allowed:
- inspect all relevant production code/schema/migrations/docs/tests;
- add missing review tests;
- fix confirmed local Step 2.5B defects;
- make minimal Step 2.5B documentation corrections.

Forbidden:
- Step 2.6;
- Step 2.7;
- Step 2.8 lifecycle work;
- Reverse Marketplace ADR / 2.2A–2.2F;
- Service Templates 1.8A–1.8D;
- Payment/Settlement/Analytics implementation;
- frontend acquisition UI;
- unrelated refactors.

If a necessary fix changes canonical ownership or attribution semantics materially:
`ARCHITECTURE DECISION REQUIRED`.

# 3. BASELINE

Report:
- branch and HEAD;
- dirty/untracked files;
- exact 2.5B diff;
- migration count/status;
- whether 2.5/2.5A are committed;
- user prompt files;
- any manual DB metadata modifications.

Do not overwrite user prompt files.

# 4. SOURCES TO INSPECT

At minimum:
- current canonical Roadmap Step 2.5B;
- ADR-0007;
- Reverse Marketplace amendment + strict review;
- current `SalesAcquisitionSource`;
- CheckoutIntent;
- Sale;
- Order;
- Booking;
- Step 2.4 Sale completion;
- OrderRequested payload and validator;
- Step 2.5 consumer;
- Step 2.5A temporal implementation/review;
- bootstrap path;
- BookingRequested / BookingCreated flows;
- event contracts;
- migration SQL;
- acquisition-source-propagation e2e;
- relevant Security/RBAC/DTO validation.

# 5. CANONICAL SEMANTICS

Prove acquisitionSource means the commercial demand-entry channel.

It must NOT silently mean:
- publication channel;
- seller channel;
- current UI surface;
- destination;
- legal country;
- campaign/referrer;
- payment method;
- booking supplier.

Check terminology in code/docs for semantic drift.

# 6. ENUM REVIEW

Inspect the actual enum and migration.

Verify:
- existing persisted values preserved;
- `BUYER_REQUEST` is explicitly authorized by current Roadmap;
- no duplicate/synonymous source enum was introduced;
- no premature `API` / `PARTNER_CUSTOM_DOMAIN` values;
- unknown values are rejected at trust boundaries.

Important:
If Roadmap still calls BUYER_REQUEST a working name but Step 2.5B simultaneously freezes it into a PostgreSQL enum, determine whether that is internally consistent.

If the Roadmap requires final reconciliation BEFORE persistence and that did not occur:
`ARCHITECTURE DECISION REQUIRED`.

Do not accept “working name” + permanent enum automatically.

# 7. CRITICAL REVIEW — CHECKOUT AUTHORITY

Implementation report says Checkout remains hardcoded/server-derived `DIRECT`.

Verify whether that is truthful for every CURRENT checkout creation path.

Search all callers/routes.

Questions:
- Can Marketplace or Partner Storefront already create CheckoutIntent through the same endpoint?
- If yes, does hardcoded DIRECT misattribute them?
- Is the current endpoint explicitly an internal-assisted/direct flow?
- Is there trusted server context available for channel derivation?
- Is arbitrary client attribution correctly forbidden?

A server-derived value can still be wrong. Server authority alone is not sufficient; derivation must be truthful.

# 8. CRITICAL REVIEW — BOOTSTRAP DIRECT

Implementation changed legacy/bootstrap Order source from NULL to DIRECT.

This requires strict scrutiny.

Determine:
- what `/orders/bootstrap` actually represents;
- who can call it;
- whether it is guaranteed to be an internal-assisted DIRECT acquisition;
- whether it can import/create orders originating from Marketplace, Partner Storefront or other channels;
- whether Step 2.6 deprecation changes the interpretation.

If bootstrap origin is not guaranteed DIRECT, persisting DIRECT fabricates attribution and is a blocker.

Do not justify this merely because bootstrap is temporary.

# 9. CHECKOUT → SALE

Verify:
- Sale copies acquisitionSource from authoritative Checkout;
- no client field can override it;
- Sale lifecycle cannot change it;
- completion does not recompute it;
- revalidation/catalog changes do not change it.

# 10. SALE → ORDERREQUESTED

Verify:
- payload carries exactly one acquisitionSource;
- it is frozen from Sale/Checkout snapshot;
- validator accepts only canonical enum;
- no fallback such as `?? DIRECT`;
- malformed/unknown value fails before partial Order creation;
- correlation/causation unaffected.

# 11. ORDER CONSUMER

Verify:
- Order persists exactly the trusted payload source;
- no re-derivation from actor/role/current route;
- duplicate/replay cannot change it;
- concurrent duplicate delivery cannot produce source drift;
- source is not mutable through Order actions/DTOs.

# 12. CRITICAL REVIEW — BOOKING PROPAGATION

Implementation added `Booking.acquisitionSource String?`, not the enum type.

Review whether this is intentional and safe.

Questions:
- Why `String?` instead of canonical enum?
- Can invalid strings enter Booking through another code path?
- Are all Booking creation paths covered?
- Does bootstrap/legacy Booking stay null honestly?
- Is Booking snapshot immutable?
- Can later Booking updates overwrite it?
- Does using String weaken the canonical contract?

If Booking must share the same finite acquisition vocabulary, prefer a schema-level canonical type unless cross-schema Prisma/Postgres constraints make that inappropriate and documented.

Do not change it speculatively; classify severity first.

# 13. ALL BOOKING CREATION PATHS

Search every Booking create/upsert/import/seed/bootstrap path.

For each path build matrix:
- source Order?
- acquisitionSource copied?
- null allowed?
- legacy?
- test-only?
- can source be forged?

Do not approve based only on `BookingRequested` subscriber.

# 14. REVERSE MARKETPLACE COMPATIBILITY

Verify `BUYER_REQUEST` can propagate through canonical contracts without implementing reverse.*.

Synthetic contract tests are acceptable only if they do not bypass a production validator that real Reverse Marketplace will later depend on.

Confirm:
- no BuyerRequest entity;
- no Proposal;
- no matching/distribution;
- no reverse schema;
- no parallel checkout/order pipeline.

# 15. PUBLICATION ≠ ACQUISITION

Search for any logic deriving acquisitionSource from:
- Product publication;
- Seller profile;
- destination coverage;
- role;
- product owner.

There must be none.

# 16. IMMUTABILITY

Prove frozen source cannot change through:
- Checkout mutation;
- Sale mutation;
- Sale completion;
- Order lifecycle;
- Step 2.5A temporal actions;
- Booking lifecycle/update;
- duplicate/retry/replay.

Where DB fields are technically mutable, service/API invariants must prevent mutation.

# 17. CLIENT FORGERY

Review DTOs and global ValidationPipe semantics carefully.

If forged fields are merely stripped by whitelist rather than rejected, verify this matches the repository's canonical server-owned-field policy.

Earlier Sales/Checkout code used explicit forbidden-key → 422 for server-owned fields.

Determine whether bootstrap silently ignoring forged `acquisitionSource` is consistent or whether it should return 422.

This is a potential security/contract inconsistency.

Add a test for exact expected HTTP behavior.

# 18. LEGACY / NULL SEMANTICS

Verify:
- no backfill;
- legacy Order/Booking source remains null;
- no default DIRECT at DB level;
- projections tolerate null;
- analytics does not silently count null as DIRECT;
- no migration rewrites historical attribution.

# 19. CRITICAL REVIEW — MANUAL CHECKSUM REPAIR

The report states a checksum drift in dev DB was fixed by manually updating `_prisma_migrations`.

Inspect exactly:
- which migration checksum differed;
- why;
- whether a migration file had been edited after application;
- whether repository migration history is now immutable;
- whether other environments could have the old checksum;
- whether deploy/CI/prod will detect mismatch.

Do NOT normalize this away as harmless without evidence.

Direct mutation of `_prisma_migrations` can conceal migration-history corruption.

Required outcome:
- establish canonical migration file bytes;
- compare fresh replay;
- document whether the affected migration had ever been committed/deployed;
- ensure no production migration requires metadata tampering.

If an already-shared/committed migration was modified after application:
classify as blocker and determine safe repair strategy.

# 20. POSTGRES ENUM MIGRATION

Review `ALTER TYPE ... ADD VALUE 'BUYER_REQUEST'`.

Verify:
- works on existing DB;
- fresh replay works;
- transaction behavior compatible with Prisma migration;
- downgrade is not required by project policy;
- no enum usage in same migration that violates PostgreSQL enum-commit rules.

# 21. EVENT CONTRACTS

Verify acquisition is present only where needed.

Do not require BookingCreated/OrderCreated expansion unless a consumer contract needs it.

Check event versioning and validation.

# 22. RBAC / IDOR / PRIVACY

Verify source:
- is not a permission input;
- does not widen own-scope;
- cannot be used to impersonate channel/tenant;
- adds no PII to payload/history/audit.

# 23. FAILURE ATOMICITY

Required:
- invalid OrderRequested source → no Order graph;
- Booking creation failure → no partial Booking attribution;
- retries preserve source;
- no history/outbox contradiction.

# 24. CONCURRENCY

Review/test:
- concurrent duplicate OrderRequested delivery;
- duplicate BookingRequested delivery;
- lifecycle race while source remains stable.

Expected one canonical source per entity.

# 25. TARGETED REVIEW TESTS REQUIRED IF ABSENT

Add tests for applicable gaps:

1. exact bootstrap forged-field behavior (422 vs strip-and-DIRECT according to canonical policy);
2. bootstrap origin semantics;
3. Checkout route cannot misattribute a non-DIRECT current entry path;
4. BUYER_REQUEST accepted by real OrderRequested validator;
5. unknown source rejected with zero partial graph;
6. concurrent duplicate OrderRequested retains one source;
7. duplicate BookingRequested retains one Booking/source;
8. every production Booking create path has truthful source/null semantics;
9. Booking source cannot be mutated later;
10. legacy Order/Booking null remains readable;
11. no analytics/default conversion NULL→DIRECT;
12. no reverse.* artifacts;
13. no PII in attribution-bearing event/history;
14. migration checksum integrity can be reproduced without editing `_prisma_migrations`.

# 26. ROADMAP CONSISTENCY

Verify 2.5B was marked DONE only after implementation.

Check amendment invariants remain intact:
- BUYER_REQUEST acquisition preservation;
- publication ≠ acquisition;
- no parallel pipeline;
- Reverse Marketplace still NOT IMPLEMENTED.

Do not rewrite unrelated Roadmap sections.

# 27. FULL REGRESSION

Run after review fixes:

Backend:
- tsc;
- unit;
- acquisition 2.5B targeted suite;
- Step 2.5;
- Step 2.5A;
- Step 2.4;
- Checkout/Sales relevant suites;
- Booking relevant suites;
- event/inbox/outbox suites;
- full serial e2e.

Frontend:
- tsc;
- vitest;
- next build.

DB:
- migrate status;
- clean replay from empty DB;
- drift;
- checksum verification against repository migrations.

Report exact counts.

# 28. RUNTIME VERIFICATION

Use isolated runtime/test DB.

Demonstrate:
- canonical DIRECT chain Checkout → Sale → OrderRequested → Order;
- Booking receives same source if this is canonical;
- forged source exact behavior;
- unknown event source rejection;
- duplicate/retry stability;
- BUYER_REQUEST contract acceptance without reverse implementation;
- no Payment/Settlement/Analytics side effects.

Do not treat a dev DB whose migration metadata was manually edited as the only runtime proof.

# 29. APPROVAL GATES

Approve only if:

1. source semantics are unambiguous;
2. derivation is truthful, not merely server-owned;
3. Checkout DIRECT is valid for every current path;
4. bootstrap DIRECT is truthful or corrected;
5. BUYER_REQUEST enum decision is canonical;
6. Order propagation is immutable;
7. Booking propagation is type-safe/contract-safe;
8. legacy null attribution is preserved;
9. no client forgery ambiguity;
10. no hidden Reverse Marketplace implementation;
11. migration history is trustworthy;
12. full regression is green.

# 30. FINAL REPORT FORMAT

Return:

# PHASE 2 — STEP 2.5B — ACQUISITION SOURCE PROPAGATION — STRICT REVIEW — ОТЧЁТ

## 1. Verdict
One of:
`PHASE 2 STEP 2.5B STRICT REVIEW COMPLETED — APPROVED`
`PHASE 2 STEP 2.5B STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
`PHASE 2 STEP 2.5B STRICT REVIEW COMPLETED — CHANGES REQUIRED`
`ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline
## 3. Sources inspected
## 4. Actual acquisition lineage
## 5. Canonical semantics
## 6. Enum / BUYER_REQUEST review
## 7. Checkout authority review
## 8. Bootstrap DIRECT review
## 9. Checkout → Sale
## 10. Sale → OrderRequested
## 11. Order consumer
## 12. Booking propagation
## 13. All Booking creation paths
## 14. Reverse Marketplace compatibility
## 15. Publication vs acquisition
## 16. Immutability
## 17. Client forgery / DTO policy
## 18. Legacy/null semantics
## 19. Migration checksum integrity
## 20. PostgreSQL enum migration
## 21. Events/contracts
## 22. RBAC/IDOR/privacy
## 23. Failure atomicity
## 24. Concurrency
## 25. Targeted review tests
## 26. Roadmap consistency
## 27. Full regression
## 28. Runtime verification
## 29. Findings
## 30. Review fixes
## 31. Remaining debt
## 32. Architecture decision status
## 33. Out-of-scope confirmation
## 34. Exact files changed during review

Final line repeats verdict.

# 31. STOP CONDITION

After Strict Review and permitted review fixes: STOP.

Do NOT start:
- Step 2.6;
- Step 2.7;
- Step 2.8;
- Reverse Marketplace ADR;
- 2.2A–2.2F;
- 1.8A–1.8D;
- Payment/Settlement/Analytics.

Wait for explicit next instruction.
