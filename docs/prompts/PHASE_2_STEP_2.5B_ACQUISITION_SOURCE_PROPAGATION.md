# PHASE 2 — STEP 2.5B — ACQUISITION SOURCE PROPAGATION
## IMPLEMENTATION PROMPT

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.5B — Acquisition Source Propagation  
**Mode:** IMPLEMENTATION  
**Prerequisite:** Step 2.5A Strict Review APPROVED WITH REVIEW FIXES

# 1. MISSION

Implement exactly canonical Roadmap Step 2.5B: preserve and propagate the canonical acquisition source through the commercial/order pipeline without creating a second attribution system.

Before changing code, inspect the CURRENT canonical Roadmap. The Roadmap is authoritative. If its current Step 2.5B wording differs from this prompt, follow the Roadmap and report the discrepancy.

Target conceptual lineage:

acquisition origin
→ Quote / Checkout
→ Sale
→ OrderRequested
→ Order
→ downstream Booking / Payment / Settlement / Analytics where Step 2.5B explicitly requires foundation-level propagation.

Do not implement downstream Finance/Analytics products prematurely.

# 2. REQUIRED SOURCES

Inspect at minimum:
- canonical Roadmap Step 2.5B;
- ADR-0007 acquisition boundary;
- Reverse Marketplace amendment + strict-review fixes;
- current `SalesAcquisitionSource`;
- Quote;
- CheckoutIntent;
- Sale;
- Step 2.4 Sale completion;
- `OrderRequestedPayload`;
- Step 2.5 Order consumer and Order snapshot;
- Step 2.5 Strict Review fixes;
- Step 2.5A + Strict Review;
- Booking schema/contracts;
- Payment/Finance planning;
- Marketplace / Partner Storefront / Direct acquisition paths;
- analytics/event contracts;
- Deferred Decisions Map.

# 3. CURRENT → TARGET

First document actual current behavior.

Determine which values currently exist and where acquisitionSource is already persisted.

Do not add fields merely because the report from earlier steps says they exist—verify code/schema.

Identify every point where source can currently:
- be created;
- be lost;
- be overwritten;
- be forged by client;
- be defaulted.

# 4. CANONICAL SEMANTICS

Acquisition source means:

**the commercial channel/origin through which the customer demand that led to the transaction entered the canonical sales pipeline.**

It is NOT:
- publication channel;
- current UI surface;
- seller legal country;
- destination;
- marketing campaign;
- referrer URL;
- payment method;
- booking provider.

The source must remain stable after the commercial intent is established unless the canonical Roadmap explicitly defines another rule.

# 5. CURRENT ENUM / BUYER_REQUEST

Inspect the actual `SalesAcquisitionSource` enum.

The Reverse Marketplace amendment planned `BUYER_REQUEST` as the working acquisition value.

Determine from the CURRENT canonical Roadmap whether Step 2.5B requires adding it now.

If yes:
- add it canonically and additively;
- do not implement BuyerRequest entities;
- do not implement Reverse Marketplace;
- do not create fake BuyerRequest transactions merely to exercise the enum.

If the final canonical name is still deferred, STOP rather than freezing an unsupported enum.

# 6. EXISTING CHANNELS

Verify actual semantics of all existing values, expected to include concepts such as:
- MARKETPLACE;
- PARTNER_STOREFRONT;
- DIRECT;
- possibly additional current canonical values.

Do not rename existing persisted enum values without an explicit migration strategy and canonical requirement.

No duplicate synonyms.

# 7. AUTHORITY

Define exactly who may establish acquisitionSource.

Required principles:
- source is server-authoritative;
- buyer/seller cannot arbitrarily forge attribution;
- once frozen into Checkout/Sale/Order it is immutable;
- downstream contexts copy the canonical upstream fact and do not reinterpret it.

If a staff-assisted DIRECT flow legitimately derives DIRECT, derive it server-side.

If Marketplace/Storefront paths are not yet implemented enough to derive their source, do not fabricate runtime behavior.

# 8. QUOTE / CHECKOUT BOUNDARY

Inspect where acquisition becomes authoritative today.

The current Checkout foundation reportedly uses server-derived `DIRECT`.

Review whether Step 2.5B changes this to a channel-aware server-derived value.

Do not accept arbitrary acquisitionSource in request bodies.

Required:
- no mass assignment;
- no client override;
- no re-derivation after frozen commercial intent.

# 9. SALE

Verify Sale freezes acquisitionSource from the canonical Checkout/commercial intent.

Sale completion must not recompute it.

Any later catalog/product/channel changes must not alter it.

# 10. ORDERREQUESTED

Verify `OrderRequested` carries the frozen acquisitionSource.

If contract already contains it:
- preserve it;
- validate it;
- do not create duplicate fields.

If enum expands:
- contract validator must accept canonical new values and reject unknown values.

# 11. ORDER

Order must persist the frozen acquisitionSource from OrderRequested.

Required:
- immutable snapshot;
- duplicate delivery does not alter it;
- consumer never derives source from current UI/user role;
- bootstrap semantics remain explicit and honest.

Review bootstrap:
- if bootstrap is server-assisted DIRECT, prove it;
- otherwise do not fabricate attribution.

# 12. BOOKING PROPAGATION

This is a critical scope boundary.

Inspect CURRENT Step 2.5B Roadmap text.

If Step 2.5B explicitly requires acquisition propagation into Booking foundation:
- add only the minimal immutable snapshot/reference required;
- derive it from Order;
- no Booking lifecycle implementation.

If Booking propagation belongs to a later Step:
- document the downstream requirement;
- do NOT modify Booking now.

Roadmap wins.

# 13. PAYMENT / SETTLEMENT / ANALYTICS

The Reverse Marketplace amendment requires eventual immutable propagation through:
Request/Proposal → Quote/Sale → Order → Booking → Payment → Settlement → Analytics.

Step 2.5B is a foundation step, not permission to implement missing Finance domains.

Do not create:
- Payment entities;
- Settlement fields;
- financial events;
- analytics dashboards;
- attribution warehouse.

Instead, make the canonical upstream contract sufficient for downstream propagation at the owner steps.

# 14. REVERSE MARKETPLACE COMPATIBILITY

Preserve planned acquisition:

`BUYER_REQUEST`

without implementing:
- reverse.* bounded context;
- BuyerRequest;
- matching;
- distribution;
- Seller Proposal;
- request chat;
- Proposal→Quote conversion.

Required invariant:

Publication channel ≠ acquisition source.

A proposal originating from Buyer Request must eventually retain BUYER_REQUEST even after conversion into canonical Quote/Sale/Order.

# 15. MARKETPLACE / PARTNER STOREFRONT

Inspect existing channel foundations.

Do not infer acquisition from:
- Seller role;
- Product owner;
- URL alone;
- destination.

Acquisition must come from trusted server context / canonical commercial intent.

If actual Marketplace/Storefront purchase entry points do not yet exist, document how they will supply the source later rather than implementing UI.

# 16. IMMUTABILITY

After acquisitionSource is frozen:
- ordinary mutations cannot change it;
- lifecycle transitions cannot change it;
- retry cannot change it;
- revalidation/reprice must not change it;
- duplicate OrderRequested delivery cannot change it.

Add negative tests where mutation paths exist.

# 17. NULL / LEGACY SEMANTICS

Inspect current nullability.

Do not backfill legacy rows with guessed channels.

If existing schema uses a non-null default such as DIRECT, determine whether that is truthful for historical data.

Do not silently rewrite history.

If changing legacy semantics requires an architectural/data-migration decision:
`ARCHITECTURE DECISION REQUIRED`.

# 18. EVENT CONTRACTS

Do not add acquisitionSource to every event.

Only include it where:
- already canonical;
- Step 2.5B requires it;
- downstream consumer needs it.

Preserve event versioning/correlation/causation.

Do not put PII into attribution events.

# 19. RBAC / SECURITY

AcquisitionSource must not become a privilege input.

Changing/forging it must not:
- grant access;
- widen tenant scope;
- affect buyer own-scope;
- bypass Seller isolation.

No role hardcoding where capability permissions already exist.

# 20. MIGRATION

If enum/schema changes are required:
- additive migration;
- no destructive rewrite;
- no guessed backfill;
- clean replay;
- drift zero;
- no `db push`.

If only enum expansion is needed, verify PostgreSQL/Prisma migration behavior on fresh and existing DB.

# 21. REQUIRED TESTS

At minimum prove applicable cases:

1. canonical DIRECT flow retains DIRECT through Checkout → Sale → OrderRequested → Order;
2. client cannot forge acquisitionSource;
3. Sale completion does not recompute source;
4. Order consumer persists payload source exactly;
5. duplicate delivery preserves source;
6. lifecycle actions preserve source;
7. Step 2.5A temporal actions do not alter source;
8. bootstrap source semantics are truthful;
9. unknown acquisition value is rejected at event/contract boundary;
10. legacy/null semantics remain honest;
11. no Booking/Payment/Settlement side effect unless explicitly in 2.5B scope;
12. no new Reverse Marketplace entity is created;
13. no PII is added to events/history/audit.

If `BUYER_REQUEST` is added now, test its schema/contract propagation without implementing Reverse Marketplace—for example at pure validator/authorized internal contract level where safe.

# 22. FAILURE / CONCURRENCY

Verify:
- failed OrderRequested processing does not persist partial attribution;
- retry persists same canonical source;
- concurrent duplicate delivery creates one Order with one source;
- no source drift between duplicate/replayed events.

# 23. FULL REGRESSION

Run:

Backend:
- `tsc --noEmit`;
- full unit suite;
- targeted Step 2.5B tests;
- Step 2.5 Order consumer;
- Step 2.5A temporal contract;
- Step 2.4 Sale completion;
- Sales/Checkout regression;
- event/inbox/outbox relevant suites;
- full serial e2e.

Frontend:
- `tsc --noEmit`;
- full vitest;
- production build.

Database:
- migrate status;
- clean replay;
- drift check.

Report exact counts.

# 24. RUNTIME VERIFICATION

Use isolated test DB/runtime.

Demonstrate a real supported acquisition path through:
Checkout
→ Sale
→ OrderRequested
→ Order

and inspect persisted source at every available layer.

Also demonstrate:
- forged source rejection;
- duplicate delivery stability;
- no unrelated Booking/Payment side effects.

Do not hardcode localhost ports as architecture assumptions; use configured/free ports.

# 25. DOCUMENTATION

Update only what implementation requires:
- acquisition contract/architecture documentation;
- events/contracts if changed;
- Deferred Decisions if a decision is resolved;
- canonical Roadmap Step 2.5B → DONE only after all validation passes.

Preserve the approved Service Templates and Reverse Marketplace amendments.

# 26. ARCHITECTURE STOP CONDITIONS

STOP with `ARCHITECTURE DECISION REQUIRED` if:
- canonical meaning of acquisitionSource is ambiguous;
- `BUYER_REQUEST` final canonical name is not approved but implementation requires freezing it;
- existing DIRECT default would require fabricating historical attribution;
- source authority would need to move between bounded contexts;
- Step 2.5B requires implementing Reverse Marketplace to be correct;
- Booking/Payment propagation cannot be separated from later owner steps;
- a cross-context write is required.

# 27. OUT OF SCOPE

Do NOT implement:
- Reverse Marketplace ADR;
- 2.2A–2.2F;
- BuyerRequest/Proposal;
- Service Templates 1.8A–1.8D;
- Step 2.6;
- Step 2.7;
- Step 2.8 beyond an explicit minimal 2.5B requirement;
- Payment/PSP/Settlement;
- analytics dashboards;
- frontend acquisition UI.

# 28. REQUIRED FINAL REPORT

Return:

# PHASE 2 — STEP 2.5B — ACQUISITION SOURCE PROPAGATION — ОТЧЁТ

## 1. Verdict
`PHASE 2 STEP 2.5B IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
or
`ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline
## 3. Sources inspected
## 4. Current → Target mapping
## 5. Canonical acquisition semantics
## 6. Enum / BUYER_REQUEST decision
## 7. Authority / derivation
## 8. Quote / Checkout
## 9. Sale
## 10. OrderRequested
## 11. Order
## 12. Booking/downstream boundary
## 13. Reverse Marketplace compatibility
## 14. Immutability
## 15. Legacy/null semantics
## 16. Events/contracts
## 17. RBAC/security/privacy
## 18. Migration
## 19. Concurrency/failure atomicity
## 20. Targeted tests
## 21. Full regression
## 22. Runtime verification
## 23. Issues found/fixed
## 24. Documentation changes
## 25. Remaining/deferred work
## 26. Architecture decision status
## 27. Out-of-scope confirmation
## 28. Exact files changed

# 29. STOP CONDITION

After implementation and validation: STOP.

Do NOT perform Strict Review in the same pass.
Do NOT start Reverse Marketplace ADR, 2.2A–2.2F, 2.6 or later steps.
Wait for a separate Strict Review prompt.
