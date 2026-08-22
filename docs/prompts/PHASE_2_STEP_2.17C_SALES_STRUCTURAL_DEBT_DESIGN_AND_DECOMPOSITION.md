# TRAVELHUB --- PHASE 2 --- STEP 2.17C

## SALES STRUCTURAL DEBT --- REPOSITORY-FIRST DESIGN & DECOMPOSITION

**Project:** TravelHub\
**Phase:** 2\
**Step:** 2.17C --- Sales Structural Debt\
**Pass:** DESIGN / DECOMPOSITION ONLY\
**Mode:** REPOSITORY-FIRST / BEHAVIOR-PRESERVING ARCHITECTURE ANALYSIS\
**Production implementation:** FORBIDDEN IN THIS PASS\
**Release/deploy:** FORBIDDEN

------------------------------------------------------------------------

# 0. MISSION

Perform a repository-first architectural decomposition of the current
Sales domain/service before any production refactor is allowed.

The known structural-debt target is:

`backend/src/modules/sales/sales.service.ts`

Historical reconciliation observed approximately:

-   \~2,522 lines;
-   \~74 async methods;
-   \~52 declared methods;

but these numbers are **not authority**. Recalculate them from the
current repository.

The objective is **not** to make the file smaller.

The objective is to produce a safe, explicit decomposition plan that
preserves all existing TravelHub behavior and authorities while
eliminating structural concentration and making future implementation
reviewable.

This pass must answer:

1.  What responsibilities currently live inside `sales.service.ts`?
2.  Which responsibilities genuinely belong together?
3.  Which responsibilities should move to dedicated collaborators?
4.  Which methods are public orchestration entry points versus internal
    helpers?
5.  Which methods read data and which write authoritative facts?
6.  Where are transaction boundaries?
7.  Where are cross-domain calls?
8.  Where are outbox/domain events emitted?
9.  Where are idempotency, causation, freeze, money and status
    invariants enforced?
10. Which dependencies must remain authoritative after decomposition?
11. What is the safest implementation sequence?
12. What tests prove behavior preservation?
13. Can implementation proceed without touching PSP, RLS, Step 2.17B or
    Phase 2 exit gates?

End with a design verdict only.

Do **not** perform the refactor in this pass.

------------------------------------------------------------------------

# 1. CURRENT ROADMAP CONTEXT

Verify rather than assume:

-   Step 2.17 --- approved;
-   Step 2.17A --- approved;
-   Step 2.17B --- blocked on final qualification environment and NOT
    APPROVED;
-   Step 2.17C --- PLANNED / structural debt / behavior-preserving
    refactor;
-   Step 2.18 --- not started and Phase exit unavailable while 2.17B
    remains unresolved;
-   payment branch remains independently blocked/deferred as previously
    recorded.

Expected latest reconciliation state is around:

`f688f57`

Do not assume this is current HEAD. Inspect branch, HEAD, upstream and
intervening changes.

------------------------------------------------------------------------

# 2. SOURCE OF TRUTH

Code is authority.

Do not design from prior summaries alone.

Inspect at minimum:

-   `backend/src/modules/sales/sales.service.ts`
-   Sales controller(s)
-   Sales DTOs
-   Sales module wiring
-   Sales entities/schema models
-   Sales tests/e2e tests
-   all direct dependencies injected into SalesService
-   all services called by SalesService
-   all consumers/services that call SalesService
-   relevant Prisma schema models and constraints
-   EventBus / Outbox APIs used by Sales
-   Booking / Order / Payment / Commission interactions
-   CRM/customer dependencies
-   product/tour dependencies if present
-   authorization/ownership helpers
-   sequence/identifier allocation
-   idempotency helpers
-   freeze/snapshot logic
-   money/Decimal handling
-   audit/history logic
-   Roadmap and architecture contracts relevant to Sales.

Search repository-wide for every call site and writer before assigning
ownership.

------------------------------------------------------------------------

# 3. HARD INVARIANT --- BEHAVIOR PRESERVATION

Step 2.17C is a **behavior-preserving structural refactor**.

The future implementation MUST preserve:

-   public HTTP/API contracts;
-   controller routes;
-   DTO validation;
-   response semantics;
-   status codes;
-   RBAC;
-   ownership checks;
-   tenant/principal isolation semantics;
-   transaction boundaries unless an explicitly proven equivalent is
    approved;
-   idempotency behavior;
-   external API idempotency boundaries;
-   outbox/event semantics;
-   event causation/correlation;
-   at-least-once delivery assumptions;
-   consumer idempotency assumptions;
-   freeze/snapshot semantics;
-   money/Decimal semantics;
-   Sales status transitions;
-   Booking authority;
-   Order authority;
-   Payment lifecycle authority;
-   Commission authority;
-   refund/dispute boundaries where relevant;
-   error classification;
-   concurrency semantics;
-   uniqueness behavior;
-   audit/history behavior;
-   no duplicate domain authority;
-   no hidden cross-domain writer.

A decomposition that changes behavior is **not Step 2.17C** and requires
a separate architecture/business decision.

------------------------------------------------------------------------

# 4. HARD PROHIBITIONS

In this pass do not:

-   modify `sales.service.ts`;
-   create new production services/classes;
-   move methods;
-   change controller wiring;
-   change dependency injection;
-   change Prisma/schema;
-   create migrations;
-   change transactions;
-   change queries;
-   add indexes;
-   change events;
-   add/remove event publications;
-   change idempotency;
-   change money calculations;
-   change status machines;
-   change RBAC/ownership;
-   change API surface;
-   change tests to fit a proposed architecture;
-   start performance tuning;
-   start PSP work;
-   start RLS;
-   start Step 2.18;
-   release/deploy.

Documentation/Roadmap only.

------------------------------------------------------------------------

# 5. BASELINE INVENTORY

Produce current metrics from code:

-   total lines;
-   executable lines if practical;
-   constructor dependencies;
-   public methods;
-   private/protected methods;
-   async methods;
-   Prisma calls;
-   `$transaction` occurrences;
-   raw SQL occurrences;
-   EventBus/outbox calls;
-   cross-service calls;
-   Decimal/money operations;
-   status transition sites;
-   explicit authorization/ownership checks;
-   sequence/code generation;
-   audit/history writes;
-   external/domain idempotency touchpoints.

Do not use line count as the design criterion. It is only structural
evidence.

------------------------------------------------------------------------

# 6. METHOD-BY-METHOD CLASSIFICATION

Build a complete method inventory.

For every method record:

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Method   Visibility   Caller(s)   Responsibility   Read/Write   Models    Transaction   Cross-domain   Events   Money   Auth/ownership   Idempotency/concurrency   Proposed
                                                                  touched                 dependency                                                                 owner
  -------- ------------ ----------- ---------------- ------------ --------- ------------- -------------- -------- ------- ---------------- ------------------------- ----------

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

No method may disappear from the inventory.

If nested/local functions carry meaningful behavior, classify them too
where relevant.

------------------------------------------------------------------------

# 7. CALL GRAPH

Construct the effective Sales call graph:

`Controller / Consumer / Other service` →
`SalesService public operation` → `internal orchestration/helpers` →
`Prisma / other domain service / EventBus`

Identify:

-   orchestration roots;
-   shared helpers;
-   cycles;
-   fan-in/fan-out;
-   cross-domain calls;
-   methods called only internally;
-   methods called externally;
-   accidental utility responsibilities.

A method's proposed destination must follow its real responsibility and
authority, not merely its name.

------------------------------------------------------------------------

# 8. DATA-WRITER MATRIX

For every Sales-related model/table touched by the service, identify:

-   reads;
-   creates;
-   updates;
-   deletes;
-   upserts;
-   authoritative writer(s) repository-wide;
-   whether SalesService is the sole writer;
-   whether another domain owns the state.

Required matrix:

  -----------------------------------------------------------------------
  Model /     Sales reads Sales       Other       Canonical   Risk
  Fact                    writes      writers     authority   
  ----------- ----------- ----------- ----------- ----------- -----------

  -----------------------------------------------------------------------

Any duplicated or ambiguous writer is a finding.

Do not silently "fix" it in this pass.

------------------------------------------------------------------------

# 9. TRANSACTION BOUNDARY MAP

Inventory every transaction boundary.

For each:

-   initiating method;
-   records touched;
-   nested service calls;
-   events created/published;
-   sequence allocation;
-   external side effects;
-   failure semantics;
-   concurrency assumptions;
-   what must remain atomic;
-   what occurs after commit.

Required output:

  --------------------------------------------------------------------------
  Operation      Current        Atomic         Post-commit    Refactor
                 transaction    invariants     work           constraint
                 boundary                                     
  -------------- -------------- -------------- -------------- --------------

  --------------------------------------------------------------------------

The future decomposition must not accidentally split an atomic operation
across independently committed services.

------------------------------------------------------------------------

# 10. EVENT / OUTBOX MAP

Identify every event/outbox interaction reachable from Sales.

Record:

-   event type;
-   producer;
-   payload/version;
-   causation/correlation;
-   transaction relationship;
-   consumer(s);
-   retry/idempotency assumptions;
-   whether Sales is authoritative producer or merely orchestrator.

Do not create new events as part of the decomposition design unless a
separate explicit architecture decision is required.

Default Step 2.17C design = **same event topology**.

------------------------------------------------------------------------

# 11. MONEY AUTHORITY MAP

Search all monetary behavior reachable from Sales.

Classify:

-   quoted amount;
-   price snapshot/freeze;
-   currency;
-   Decimal conversion;
-   discount;
-   tax if any;
-   commission;
-   provider fee if any;
-   payment amount;
-   refund/dispute references;
-   ledger interactions.

Explicitly distinguish:

-   Sales commercial calculation;
-   Commission authority;
-   Payment authority;
-   Ledger/accounting authority;
-   ProviderFee future boundary.

No proposed Sales collaborator may become a second money authority.

------------------------------------------------------------------------

# 12. STATUS / STATE-MACHINE MAP

Inventory Sales-related statuses and transitions.

For every transition identify:

-   source state;
-   target state;
-   initiating operation;
-   guard/precondition;
-   writer;
-   transaction;
-   event;
-   downstream consequence.

Do not redesign statuses in this pass.

------------------------------------------------------------------------

# 13. AUTHORIZATION / OWNERSHIP MAP

Identify all:

-   guards;
-   RBAC permissions;
-   ownership predicates;
-   actor/principal extraction;
-   tenant/partner restrictions;
-   admin overrides;
-   fail-closed behavior.

The decomposition must not move an authorization check after a write or
otherwise weaken ordering.

If checks occur partly in controllers/guards and partly in SalesService,
document the layered contract.

------------------------------------------------------------------------

# 14. IDEMPOTENCY / CONCURRENCY MAP

Identify:

-   HTTP `Idempotency-Key` interactions relevant to Sales;
-   internal business idempotency;
-   unique constraints;
-   P2002 handling;
-   optimistic/pessimistic concurrency;
-   row locks;
-   sequence allocation;
-   retry behavior;
-   duplicate prevention;
-   race-sensitive operations.

Preserve the exact existing authority.

Do not introduce "cleaner" semantics without evidence.

------------------------------------------------------------------------

# 15. FREEZE / SNAPSHOT / CAUSATION MAP

Inspect all frozen commercial snapshots, immutable historical facts and
causation relationships.

Determine:

-   what gets frozen;
-   when;
-   by whom;
-   which mutable source is no longer consulted after freeze;
-   what IDs/correlation/causation connect downstream facts.

The future decomposition must not re-read mutable policy where current
behavior uses frozen facts.

------------------------------------------------------------------------

# 16. ERROR CONTRACT MAP

Inventory meaningful error paths:

-   400;
-   401;
-   403;
-   404;
-   409;
-   domain conflict;
-   Prisma conflicts;
-   controlled concurrency errors;
-   unexpected 500.

Map where they originate and how they propagate.

A future extraction must not convert controlled domain errors into raw
500s or change public status semantics.

------------------------------------------------------------------------

# 17. DEPENDENCY CLASSIFICATION

Classify every current constructor dependency into:

-   Sales-owned persistence;
-   cross-domain authority;
-   infrastructure;
-   eventing;
-   policy/read dependency;
-   utility;
-   accidental coupling.

For each dependency answer:

1.  Should orchestration layer retain it?
2.  Should a proposed collaborator own it?
3.  Would moving it create a circular dependency?
4.  Would moving it duplicate authority?

------------------------------------------------------------------------

# 18. DECOMPOSITION PRINCIPLES

The proposed architecture must satisfy:

1.  **Thin orchestration, not thin semantics.**
2.  One explicit owner per responsibility.
3.  No circular dependency graph.
4.  No duplicate writers.
5.  Cross-domain authorities remain external.
6.  Transactions remain explicit.
7.  Domain event topology remains stable by default.
8.  Helpers are not extracted merely to reduce line count.
9.  Read/query concerns may be separated from write/orchestration
    concerns where safe.
10. Naming must describe responsibility, not implementation detail.
11. Future unit-test seams should improve without changing e2e behavior.
12. The final Sales facade may remain as compatibility/orchestration
    boundary if that minimizes API/caller churn.

------------------------------------------------------------------------

# 19. REQUIRED CANDIDATE ARCHITECTURE

Derive the architecture from repository evidence.

Do **not** blindly create these classes, but evaluate whether
responsibilities correspond to candidates such as:

-   `SalesQueryService`
-   `SalesQuoteService`
-   `SalesLifecycleService`
-   `SalesCompletionService`
-   `SalesPricingSnapshotService`
-   `SalesOwnershipService`
-   `SalesSequenceService`
-   `SalesEventService`
-   `SalesHistoryService`

Names above are examples only.

The design must explicitly say which candidates are:

-   ACCEPTED;
-   REJECTED;
-   MERGED;
-   DEFERRED;

and why.

Avoid micro-service-class explosion.

------------------------------------------------------------------------

# 20. FACADE DECISION

Decide whether `SalesService` should remain as a stable facade after
decomposition.

Evaluate:

### Option A --- Stable facade

Controllers/consumers continue depending on `SalesService`; internals
delegate to collaborators.

### Option B --- Direct collaborator injection

Controllers/consumers are rewired to specialized services.

Prefer the option that minimizes behavioral/API risk unless repository
evidence strongly favors otherwise.

Document the decision.

------------------------------------------------------------------------

# 21. DEPENDENCY-DIRECTION DIAGRAM

Produce an explicit dependency direction, for example:

``` text
SalesController
      |
      v
  SalesService (facade/orchestrator)
   /    |       \
  v     v        v
Query  Lifecycle  Quote
 |        |        |
 v        v        v
Prisma  Domain authorities / EventBus / Prisma
```

The actual diagram must reflect repository evidence.

No cycle is allowed.

------------------------------------------------------------------------

# 22. PROPOSED OWNERSHIP MATRIX

Required:

  ------------------------------------------------------------------------------
  Responsibility   Current     Proposed    Authority   Transaction   Risk
                   owner       owner       changes?    impact        
  ---------------- ----------- ----------- ----------- ------------- -----------

  ------------------------------------------------------------------------------

Every responsibility identified in the baseline must appear.

`Authority changes?` should normally be `NO`.

Any proposed authority change requires a separate decision and should
block implementation under Step 2.17C.

------------------------------------------------------------------------

# 23. METHOD-MOVE PLAN

Create a deterministic mapping:

  ----------------------------------------------------------------------------
  Current     Proposed      Keep         Caller      Transaction   Test
  method      destination   signature?   changes?    sensitivity   coverage
  ----------- ------------- ------------ ----------- ------------- -----------

  ----------------------------------------------------------------------------

Every current method must have a destination:

-   remain in facade;
-   move to collaborator;
-   merge only if behavior-identical and proven;
-   delete only if demonstrably unreachable/dead and separately
    justified.

Do not mark methods dead merely because no direct controller call
exists; inspect internal and cross-module calls.

------------------------------------------------------------------------

# 24. IMPLEMENTATION WAVES

Design a low-risk staged implementation.

Preferred pattern, if supported:

### Wave 0 --- characterization

Add/strengthen tests only where behavior is not adequately pinned.

### Wave 1 --- pure/read-only extraction

Move low-risk query/helper responsibilities.

### Wave 2 --- non-transactional orchestration extraction

Preserve facade signatures.

### Wave 3 --- transaction-sensitive write paths

One bounded responsibility at a time.

### Wave 4 --- event/idempotency-sensitive paths

Only after characterization evidence.

### Wave 5 --- cleanup

Remove dead delegation/helpers only after full repository search and
regression.

Do not assume these exact waves are correct; adapt from evidence.

Each wave must be independently buildable/testable/revertible.

------------------------------------------------------------------------

# 25. CHARACTERIZATION TEST GAP ANALYSIS

Before implementation, determine whether current tests sufficiently lock
behavior.

For each public Sales operation identify:

-   unit coverage;
-   e2e coverage;
-   RBAC coverage;
-   ownership coverage;
-   transaction rollback coverage;
-   concurrency coverage;
-   event/outbox coverage;
-   idempotency coverage;
-   money/freeze coverage;
-   error coverage.

Required matrix:

  --------------------------------------------------------------------------------------------
  Operation   Unit    E2E     RBAC    Tx         Concurrency   Events   Money/freeze   Gap
                                      rollback                                         
  ----------- ------- ------- ------- ---------- ------------- -------- -------------- -------

  --------------------------------------------------------------------------------------------

If critical behavior is unpinned, implementation should begin with
characterization tests, not extraction.

------------------------------------------------------------------------

# 26. REGRESSION CONTRACT FOR FUTURE IMPLEMENTATION

Define the exact minimum regression suite required after every
implementation wave.

At minimum evaluate:

-   backend tsc;
-   backend build;
-   Sales unit tests;
-   targeted Sales/Booking/Order/Finance e2e;
-   full serial backend e2e;
-   frontend tsc/vitest/build if public contracts can affect frontend;
-   migrations/drift if schema remains unchanged;
-   artifact checker;
-   `git diff --check`.

Use actual repository commands, not invented commands.

------------------------------------------------------------------------

# 27. PERFORMANCE CONTRACT

Step 2.17C is not a performance remediation step.

The future refactor must not intentionally tune performance or change
frozen Step 2.17B targets.

However, because structural changes can cause performance regressions:

-   identify any hot paths affected by decomposition;
-   preserve query counts/transaction semantics where practical;
-   do not claim performance improvement without measurement;
-   final 2.17B remains independently blocked/pending.

Do not reopen 2.17B in this design pass.

------------------------------------------------------------------------

# 28. PAYMENT / PSP BOUNDARY

Verify Sales decomposition does not require:

-   provider selection;
-   PSP adapter;
-   card data handling;
-   webhook implementation;
-   ProviderFee implementation;
-   native split;
-   payout orchestration.

Preserve:

-   PaymentService lifecycle authority;
-   ProviderFee ≠ TravelHub Commission;
-   2.12B blocked;
-   ADR-0015 blocked/proposed;
-   2.12I deferred.

Any hidden PSP dependency discovered is a finding.

------------------------------------------------------------------------

# 29. RLS BOUNDARY

Do not implement RLS.

Preserve ADR-0014 and Step 2.18 verification ownership.

If Sales currently relies on application-level partner/tenant isolation,
document it as current behavior and ensure decomposition does not weaken
it.

------------------------------------------------------------------------

# 30. STEP 2.17B BOUNDARY

Preserve:

`Step 2.17B — BLOCKED — FINAL QUALIFICATION ENVIRONMENT REQUIRED — NOT APPROVED`

Do not modify frozen targets or claim qualification.

Step 2.17C may proceed independently only if repository dependencies
confirm it.

Phase 2 exit remains blocked until 2.17B is ultimately closed.

------------------------------------------------------------------------

# 31. FINDINGS CLASSIFICATION

Classify findings:

-   CRITICAL
-   HIGH
-   MEDIUM
-   LOW
-   OBSERVATION

Also tag each as one or more:

-   duplicated authority;
-   ambiguous ownership;
-   transaction risk;
-   event risk;
-   idempotency/concurrency risk;
-   money risk;
-   auth/ownership risk;
-   circular dependency risk;
-   structural complexity;
-   test gap;
-   dead code candidate;
-   documentation drift.

Do not fix findings in this pass.

------------------------------------------------------------------------

# 32. DESIGN VERDICT

Use exactly one:

## VERDICT A --- DESIGN READY FOR IMPLEMENTATION

Requirements:

-   complete method/responsibility inventory;
-   proposed ownership is explicit;
-   no authority change required;
-   transaction/event/idempotency boundaries can be preserved;
-   dependency graph is acyclic;
-   implementation waves defined;
-   characterization gaps identified;
-   no unresolved CRITICAL/HIGH design blocker.

NEXT: `STEP 2.17C — BEHAVIOR-PRESERVING IMPLEMENTATION`

## VERDICT B --- CHARACTERIZATION REQUIRED BEFORE IMPLEMENTATION

Use when decomposition is viable but critical behavior is insufficiently
pinned.

NEXT: `STEP 2.17C — CHARACTERIZATION TEST HARDENING`

## VERDICT C --- ARCHITECTURE DECISION REQUIRED

Use when safe decomposition requires changing domain authority,
transaction semantics, events, public behavior or another architectural
contract.

NEXT must name the exact decision.

------------------------------------------------------------------------

# 33. ROADMAP UPDATE

Update Step 2.17C minimally.

For A:

`DESIGN / DECOMPOSITION COMPLETED — READY FOR BEHAVIOR-PRESERVING IMPLEMENTATION`

For B:

`DESIGN COMPLETED — CHARACTERIZATION TEST HARDENING REQUIRED BEFORE IMPLEMENTATION`

For C:

`DESIGN BLOCKED — ARCHITECTURE DECISION REQUIRED`

Do not mark Step 2.17C APPROVED or IMPLEMENTATION COMPLETED.

Preserve Step 2.17B blocker and Phase-exit guard.

------------------------------------------------------------------------

# 34. REQUIRED DESIGN DOCUMENT

Create:

`docs/architecture/sales-structural-decomposition-2.17C.md`

It must be the canonical implementation design, not merely a narrative
report.

Include:

-   current-state architecture;
-   metrics;
-   responsibility map;
-   method inventory;
-   writer matrix;
-   transaction map;
-   event map;
-   money map;
-   status map;
-   auth map;
-   idempotency/concurrency map;
-   dependency graph;
-   proposed architecture;
-   ownership matrix;
-   method-move plan;
-   implementation waves;
-   test strategy;
-   rollback strategy;
-   boundaries/non-goals.

------------------------------------------------------------------------

# 35. REQUIRED REPORT

Create:

`docs/prompts/PHASE_2_STEP_2.17C_SALES_STRUCTURAL_DEBT_DESIGN_AND_DECOMPOSITION_REPORT.md`

Minimum sections:

1.  Executive Summary
2.  Verdict
3.  Repository Baseline
4.  Roadmap State
5.  Current Sales Metrics
6.  Controllers / Callers
7.  Constructor Dependencies
8.  Method Inventory
9.  Responsibility Clusters
10. Call Graph
11. Data Writer Matrix
12. Transaction Boundaries
13. Event / Outbox Map
14. Money Authority
15. Status Transitions
16. Auth / Ownership
17. Idempotency / Concurrency
18. Freeze / Snapshot / Causation
19. Error Contracts
20. Cross-Domain Authorities
21. Structural Findings
22. Candidate Decomposition
23. Accepted / Rejected Candidates
24. Facade Decision
25. Dependency Direction
26. Proposed Ownership Matrix
27. Method-Move Plan
28. Characterization Coverage
29. Implementation Waves
30. Regression Contract
31. Performance Boundary
32. Payment/PSP Boundary
33. RLS Boundary
34. Step 2.17B Boundary
35. Risks
36. Negative Checks
37. Roadmap Changes
38. Artifact Integrity
39. Persistence
40. Release
41. Final Verdict
42. NEXT
43. REPOSITORY EVIDENCE footer

Add sections if evidence requires them.

------------------------------------------------------------------------

# 36. NEGATIVE CHECKS

Report explicitly:

-   `sales.service.ts` production changes: 0
-   new production decomposition classes: 0
-   controller/API changes: 0
-   schema changes: 0
-   migrations: 0
-   transaction changes: 0
-   event changes: 0
-   idempotency changes: 0
-   money/status changes: 0
-   RBAC/ownership changes: 0
-   performance tuning: 0
-   Step 2.17B changes beyond preserving status: 0
-   PSP implementation: 0
-   RLS implementation: 0
-   Step 2.18 implementation: 0
-   release/deploy: 0

------------------------------------------------------------------------

# 37. ARTIFACT INTEGRITY

Run canonical artifact integrity checks and checker regression.

Required:

-   WARN = 0
-   FAIL = 0
-   checker regression green
-   `git diff --check` clean

Report actual PASS count.

This is docs/design only; do not run unnecessary multi-hour performance
qualification.

------------------------------------------------------------------------

# 38. PERSISTENCE

Stage only intended documentation/Roadmap files.

Do not use:

-   `git add .`
-   `git add -A`

Inspect staged diff.

Commit intentionally.

Apply repository provenance/footer convention.

Push.

Verify:

`HEAD == upstream`

Report worktree state and leave unrelated untracked files untouched.

------------------------------------------------------------------------

# 39. REQUIRED TERMINAL OUTPUT

``` text
PHASE 2 STEP 2.17C SALES STRUCTURAL DEBT DESIGN & DECOMPOSITION COMPLETED

Decision:
- verdict: <A|B|C> — <meaning>
- implementation: NOT STARTED
- behavior-preserving contract: <PASS/BLOCKED>
- authority changes required: <0 or details>
- transaction-boundary changes required: <0 or details>
- event-contract changes required: <0 or details>

Current Sales:
- service path: <actual>
- lines: <actual>
- methods: <actual>
- async methods: <actual>
- constructor dependencies: <actual>
- transaction roots: <actual>
- event/outbox touchpoints: <actual>

Design:
- responsibility clusters: <actual>
- proposed collaborators: <actual>
- SalesService facade: <KEEP/REMOVE + reason>
- circular dependencies: <0/details>
- duplicate authority introduced: 0
- method inventory coverage: <100%/details>
- implementation waves: <count>

Characterization:
- critical test gaps: <0/details>
- implementation may start immediately: <YES/NO>

Boundaries:
- Step 2.17B: BLOCKED / unchanged
- payment branch: unchanged
- RLS: unchanged
- Step 2.18: NOT STARTED
- Phase 2 exit: still blocked by unresolved gates

Negative checks:
- production Sales code: 0
- schema/migrations: 0
- API/RBAC/events/idempotency/money: 0
- performance tuning: 0
- PSP/RLS/2.18: 0

Artifact integrity:
- PASS=<actual> WARN=0 FAIL=0
- checker regression: <actual>

Persistence:
- branch: <...>
- design/docs commit: <...>
- provenance/footer: <...>
- final HEAD/upstream: <...>
- push_status: <...>
- worktree_clean: <...>

RELEASE: NOT APPLICABLE

NEXT:
<exact next Step 2.17C pass>
```

------------------------------------------------------------------------

# 40. HARD STOP

After repository analysis, design artifacts, Roadmap reconciliation,
artifact checks, commit/push and terminal verdict:

**STOP.**

Do not begin implementation.

------------------------------------------------------------------------

# 41. SUCCESS CRITERION

Success is not reducing `sales.service.ts` from \~2,500 lines to an
arbitrary number.

Success is producing a decomposition in which:

-   every existing responsibility has an explicit owner;
-   every method has a destination;
-   no authority is duplicated;
-   no transaction is accidentally split;
-   no event/idempotency/money/auth semantics change;
-   dependencies remain acyclic;
-   characterization gaps are known before code movement;
-   implementation can proceed in small reversible waves;
-   Step 2.17B and all other independent Phase 2 gates remain truthfully
    represented.

**Design first. Refactor second. Behavior must remain invariant.**
