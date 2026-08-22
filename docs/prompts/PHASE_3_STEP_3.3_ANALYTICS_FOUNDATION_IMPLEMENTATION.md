# TRAVELHUB — PHASE 3 — STEP 3.3 ANALYTICS FOUNDATION — IMPLEMENTATION

## ROLE

You are implementing the already-approved design for:

`PHASE 3 — STEP 3.3 — ANALYTICS FOUNDATION`

This is a production implementation pass.

Canonical design inputs include:

- `docs/architecture/analytics-foundation-3.3.md`
- the completed Step 3.3 Time/Period + Actor Attribution design addendum
- canonical Roadmap v3
- repository code, schema, events, RBAC, and existing architecture

Known design decisions:

- Step 3.3 Design: COMPLETED
- Step 3.3 Design Addendum: COMPLETED — VERDICT A
- implementation: NOT YET COMPLETED
- Step 2.17B remains BLOCKED — EXTERNAL QUALIFICATION ENVIRONMENT
- Phase 2 formal exit remains blocked
- independent Phase 3 work is allowed

Repository/code/design/Roadmap are the source of truth.

Do not reinterpret approved semantics merely for implementation convenience.

---

# 1. PRIMARY OBJECTIVE

Implement a reusable Analytics Foundation that provides canonical backend
semantics for:

1. analytics reporting periods;
2. arbitrary custom date ranges;
3. comparison periods;
4. time granularity/bucketing;
5. metrics and dimensions;
6. canonical fact querying;
7. actor/owner/outcome attribution where supported by repository facts;
8. reusable analytics read models;
9. analytics API endpoints required by the canonical Step 3.3 design;
10. deterministic validation and authorization;
11. regression-safe integration with existing domains.

The implementation must support future consumers including:

- Dashboard / Command Center;
- Sales Analytics;
- Booking Analytics;
- Order Analytics;
- CRM Analytics;
- Finance Analytics;
- Product Analytics;
- Partner Analytics;
- future Employee Analytics.

Do NOT implement those full product surfaces in this pass.

---

# 2. REPOSITORY-FIRST PRECHECK

Before modifying code, independently verify:

- canonical Step 3.3 Roadmap definition;
- `analytics-foundation-3.3.md`;
- Step 3.3 design addendum;
- existing analytics/dashboard modules;
- existing DTO/query conventions;
- current backend module structure;
- Prisma schema;
- canonical domain events;
- lifecycle/milestone timestamps;
- User / RoleCode model;
- RBAC guards/decorators;
- tenant/partner/customer ownership patterns;
- Decimal/money conventions;
- existing API versioning conventions;
- test conventions.

Do not implement duplicate infrastructure if equivalent canonical functionality
already exists.

Produce an implementation mapping before code changes:

| Design capability | Existing code | Reuse/extend/new | Target file/module |
|---|---|---|---|

---

# 3. HARD SEMANTIC INVARIANTS

The implementation must preserve:

`ANALYTICS PERIOD LOGIC = SHARED FOUNDATION, NOT UI-LOCAL LOGIC`

`CUSTOM PERIOD = EXPLICIT START DATE + END DATE`

`BUSINESS REPORTING TIME ≠ SERVER LOCAL TIME`

`ACTION ACTOR ≠ OBJECT OWNER ≠ BUSINESS OUTCOME OWNER`

`PLATFORM ACTIVITY ≠ EMPLOYEE EFFECTIVENESS`

`FOUNDATION ATTRIBUTION ≠ EMPLOYEE PERFORMANCE SCORING`

Also preserve all existing TravelHub invariants for:

- money/Decimal;
- transaction boundaries;
- EventBus at-least-once semantics;
- Inbox idempotency;
- external/business idempotency;
- RBAC/ownership;
- tenant isolation;
- immutable/frozen financial facts;
- canonical event contracts.

---

# 4. IMPLEMENTATION ARCHITECTURE

Implement Step 3.3 as a coherent analytics backend foundation.

Prefer clear separation between:

- period resolution;
- comparison resolution;
- granularity/bucketing;
- metric definitions;
- dimension/filter definitions;
- fact/read-model queries;
- attribution;
- DTO/API boundary;
- authorization.

Do not create a monolithic analytics service if repository architecture supports
smaller focused collaborators.

The exact module/file names must follow repository conventions.

A reasonable conceptual decomposition is:

- AnalyticsModule
- AnalyticsController
- AnalyticsQueryService
- AnalyticsPeriodResolver
- AnalyticsComparisonResolver
- AnalyticsGranularityResolver
- AnalyticsMetricRegistry / catalog
- AnalyticsDimensionRegistry / catalog
- read-model/query collaborators

This is conceptual guidance, not authority to create redundant classes.

Repository-first reuse wins.

---

# 5. TIME/PERIOD CONTRACT — IMPLEMENT

Implement the approved logical presets:

- `TODAY`
- `LAST_3_DAYS`
- `LAST_7_DAYS`
- `MONTH`
- `LAST_6_MONTHS`
- `YEAR`
- `CUSTOM`

Use the exact canonical semantics from the approved design/addendum.

Do not silently change rolling/calendar interpretations.

If the addendum left any preset semantics explicitly TBD due to missing
authority, do not invent them.

Fail closed or expose only the authority-resolved subset as appropriate.

---

# 6. CUSTOM PERIOD

Implement:

- explicit `startDate`;
- explicit `endDate`;
- ISO 8601 date validation;
- arbitrary valid date range.

The user must be able to request a range such as:

`2026-03-15 → 2026-06-27`

Do not restrict custom periods to calendar months/quarters/years unless a
canonical authority explicitly requires it.

CUSTOM without both required boundaries must be rejected.

`startDate > endDate` must be rejected.

---

# 7. INTERNAL BOUNDARY MODEL

Implement the approved half-open interval model:

`[startInstant, endExclusiveInstant)`

Requirements:

- start included;
- end exclusive internally;
- no double counting at adjacent boundaries;
- endDate user semantics converted deterministically to endExclusive;
- database predicates consistent across read models.

Avoid ad hoc combinations of:

- `gte/lte`;
- `gt/lte`;
- manual `23:59:59.999`.

Centralize the period resolution.

---

# 8. TIMEZONE

Implement timezone handling exactly according to the approved addendum.

Current known design state:

- optional IANA timezone parameter;
- repository has no authoritative company/tenant reporting timezone;
- `Product.serviceTimeZone` is NOT company analytics timezone;
- fallback currently defined by design as UTC;
- company/tenant timezone remains an authority/data-model gap.

Requirements:

- validate supplied IANA timezone;
- never use machine/server local timezone implicitly;
- use UTC fallback only where the approved design explicitly permits it;
- clearly expose resolved timezone in analytics responses where useful;
- keep the authority gap documented.

Do NOT create a company timezone schema field in this pass unless the canonical
implementation design explicitly authorizes it.

---

# 9. COMPARISON PERIOD

Implement reusable comparison resolution.

The implementation must return/derive:

- current period start;
- current period endExclusive;
- comparison start;
- comparison endExclusive.

Use approved semantics:

- calendar presets → appropriate preceding calendar period;
- CUSTOM → immediately preceding equivalent-duration interval.

Do not duplicate comparison calculations inside individual metrics.

---

# 10. COMPARISON VALUES

Where a read model returns comparisons, use a reusable representation that can
express:

- current value;
- previous/comparison value;
- absolute delta;
- percentage delta where mathematically defined;
- trend/direction if canonically supported.

Handle:

- previous = 0;
- previous = null;
- unavailable comparison;
- not-applicable comparison.

Do not encode universal business judgment such as:

`positive delta = good`

because this is false for metrics such as cancellations, refunds, errors, or
response time.

---

# 11. GRANULARITY

Implement the approved time granularity model.

Support only canonical granularities from the design.

Likely candidates include:

- hour;
- day;
- week;
- month;
- quarter;
- year.

The implementation must support:

- automatic granularity resolution based on period;
- explicit supported override if approved;
- deterministic bucket boundaries;
- timezone-aware business bucket semantics.

Reject unsupported granularity values.

Avoid frontend-owned bucketing semantics.

---

# 12. BUSINESS TIMESTAMP AUTHORITY

Do NOT query every metric by `createdAt`.

Implement the Step 3.3 timestamp/lifecycle mapping.

Metrics/facts may depend on timestamps such as:

- createdAt;
- issuedAt;
- confirmedAt;
- completedAt;
- cancelledAt;
- paidAt;
- refundedAt;
- accruedAt;
- serviceDate;
- event occurredAt;
- communication timestamp.

For every implemented metric/read model:

- identify authoritative timestamp;
- use that timestamp consistently;
- test it.

Do not substitute another timestamp because it is easier to query.

---

# 13. FACT MODEL

Implement only the Step 3.3 fact/read capabilities supported by current
canonical repository data.

The design covers 11 areas:

1. Catalog
2. Behavioral
3. CRM
4. Sales Pipeline
5. Orders
6. Bookings
7. Payments
8. Refunds
9. Commission
10. Financial Ledger
11. Communications

Do not fabricate missing historical facts.

Do not create fake analytics events merely to satisfy the design.

Where a fact is not yet reconstructable from canonical data, expose/document
the limitation rather than manufacturing it.

---

# 14. METRICS CATALOG

Implement the canonical metric definitions required for the Step 3.3
foundation/read models.

Metric groups include:

- Revenue & Commercial;
- Conversion & Funnel;
- Timing & SLA;
- Platform Activity;
- Partner Performance;
- Product Performance.

Every implemented metric must have an explicit definition:

| Metric | Numerator/source | Denominator if any | Timestamp | Dimensions | Money semantics |
|---|---|---|---|---|---|

Do not let controller/UI code invent metric formulas.

---

# 15. MONEY / DECIMAL

All financial analytics must preserve exact TravelHub money semantics.

Requirements:

- use canonical Decimal values;
- no JS floating-point money arithmetic;
- preserve currency;
- never aggregate incompatible currencies into a fake total;
- preserve frozen financial facts;
- do not regenerate historical values from mutable current policy.

For multi-currency results:

- group by currency; or
- use an already-authorized conversion model if one exists.

Do NOT invent FX conversion.

---

# 16. DIMENSIONS / FILTERS

Implement reusable canonical dimensions supported by repository data.

Existing design includes dimensions such as:

- acquisition source;
- partner;
- product;
- category;
- customer;
- status;
- currency;
- time.

Geographic dimensions remain deferred if the canonical design says so.

Validate dimension/filter inputs.

Preserve tenant/ownership scope.

Do not allow arbitrary raw field selection from clients.

---

# 17. ACTOR ATTRIBUTION

Implement foundation-level actor attribution only where canonical fields exist.

Reuse repository-native identity fields.

Potential concepts include:

- createdBy;
- actorUserId;
- assignedModeratorId;
- assignedToId;
- completedById;
- sellerPartnerId;
- other canonical ownership/actor fields.

Do NOT create a fake universal employee ID by conflating unrelated fields.

---

# 18. THREE ATTRIBUTION TYPES

Preserve the approved distinction:

## Action attribution

Who performed the action?

## Ownership attribution

Who owned/was responsible for the object?

## Outcome attribution

To whom can the result legitimately be attributed?

The implementation must not automatically assign a business outcome to the
last actor.

Where the repository cannot prove attribution, return no attribution rather
than guessing.

---

# 19. USER / EMPLOYEE BOUNDARY

Current identity evidence includes `User` and `RoleCode`.

Known roles include:

- ADMIN
- DIRECTOR
- FINANCE
- MARKETER
- ANALYST
- MODERATOR
- SALES_MANAGER
- OPERATOR
- PARTNER
- BUYER

PARTNER and BUYER are external identities and must not automatically be treated
as employees.

Do not introduce team/department semantics because they are currently an
authority/data-model gap.

Do not invent historical role tracking.

---

# 20. ACTIVITY FOUNDATION

Where existing facts permit it, expose measurable activity categories such as:

- platform interaction;
- client communication;
- workflow/business action;
- commercial outcome.

But preserve:

`ACTIVITY ≠ EFFECTIVENESS`

Do NOT implement:

- employee efficiency score;
- employee ranking;
- idle-time disciplinary judgment;
- surveillance score;
- hidden monitoring;
- universal KPI weights.

Employee Analytics remains future domain work.

---

# 21. READ MODELS

Implement the canonical Step 3.3 read models as far as repository evidence and
design require.

The design proposes:

1. Company KPI Summary
2. Partner Performance Summary
3. Conversion Funnel
4. Time-Based Analytics
5. Financial Reconciliation Summary

For each read model:

- define request DTO;
- define response DTO;
- use common period resolver;
- use common comparison resolver;
- use common granularity semantics;
- enforce RBAC/ownership;
- use authoritative facts/timestamps;
- preserve Decimal/currency;
- test independently.

If the design marks any read model as later/deferred, preserve that status.

Do not implement a future Employee Performance Summary merely because actor
attribution now exists.

---

# 22. COMPANY KPI SUMMARY

If required by canonical Step 3.3 implementation, provide a reusable company
summary suitable for later Dashboard consumption.

Potential values must come only from approved metric definitions.

Do not implement Dashboard UI.

Do not duplicate Dashboard-specific business logic.

The Dashboard should later consume Analytics Foundation, not become a second
analytics engine.

---

# 23. PARTNER PERFORMANCE

Implement partner-scoped metrics according to canonical design.

Preserve:

- partner ownership;
- tenant isolation;
- role access;
- currency integrity;
- outcome attribution semantics.

Do not expose cross-partner information to unauthorized partner users.

---

# 24. CONVERSION FUNNEL

Implement canonical funnel semantics from the Step 3.3 design.

Do not redefine stages.

Preserve acquisition attribution where available.

Avoid counting one entity multiple times at the same funnel stage unless the
canonical metric definition explicitly permits event-count semantics.

Document whether each stage is:

- unique entity count;
- event count;
- transition count.

---

# 25. TIME-BASED ANALYTICS

Implement a generic time-series/read-model capability using:

- canonical period;
- canonical timezone;
- canonical granularity;
- authoritative metric timestamp;
- comparison where supported.

Return stable bucket identifiers/boundaries so frontend consumers do not need
to reconstruct bucket semantics.

---

# 26. FINANCIAL RECONCILIATION SUMMARY

If included in Step 3.3 implementation scope, this read model must remain
read-only.

It must not:

- repair data;
- regenerate facts;
- mutate ledger;
- mutate Payment;
- mutate Commission;
- mutate Accrual.

Reuse Step 2.18A financial authority/integrity rules.

Analytics is a reader, not a new financial writer.

---

# 27. ACQUISITION SOURCE ATTRIBUTION

Preserve the approved attribution chain:

behavioral source → checkout → order → booking

where repository data supports it.

Do not retroactively invent acquisition source when it is absent.

Define explicit `UNKNOWN`/null semantics according to repository conventions.

Do not silently classify missing source as a real channel.

---

# 28. API CONTRACT

Implement API endpoints according to repository routing/version conventions.

Do not invent a parallel API style.

Analytics query APIs should consistently accept only applicable fields such as:

- period preset;
- startDate;
- endDate;
- timezone;
- comparison;
- granularity;
- metric/filter/dimension inputs.

Centralize DTO validation.

Avoid endpoints where every route implements its own period semantics.

---

# 29. AUTHORIZATION

Repository-first derive access rules.

At minimum verify behavior for relevant roles:

- ADMIN;
- DIRECTOR;
- ANALYST;
- FINANCE;
- SALES_MANAGER;
- OPERATOR;
- PARTNER;
- BUYER.

Do not assume every internal role may access all company financial analytics.

Reuse canonical PermissionsGuard/RBAC patterns.

Partner users must remain partner-scoped.

Buyer users must not gain internal analytics visibility.

Fail closed.

---

# 30. TENANT / OWNERSHIP ISOLATION

Preserve Step 2.18 tenant-isolation findings.

Analytics queries must not create an IDOR/cross-tenant bypass.

Requirements:

- scope queries at source;
- do not fetch globally then filter in application memory when canonical scoped
  queries are available;
- test unauthorized IDs/filters;
- test partner/customer scoping where applicable.

No raw SQL bypass of canonical isolation rules unless explicitly reviewed and
proven safe.

---

# 31. PERFORMANCE DESIGN

This implementation is NOT Step 2.17B qualification and must not modify frozen
performance targets.

However, analytics queries must be implemented responsibly.

Before adding:

- indexes;
- materialized views;
- denormalized tables;
- caches;
- pre-aggregation;
- background analytics pipelines;

prove that they are required by canonical Step 3.3 design or repository
evidence.

Do not perform speculative production tuning.

If expensive query patterns are discovered, document them for later
qualification/tuning.

---

# 32. NO NEW ANALYTICS WRITE AUTHORITY

Analytics Foundation must remain a read/query concern unless the canonical
design explicitly requires an analytics-owned projection.

Do not become a second writer for:

- Payment;
- Ledger;
- Commission;
- Accrual;
- Order;
- Booking;
- Sale;
- CRM objects;
- Product.

If projections are required, define their ownership and update semantics
explicitly and preserve canonical source authority.

---

# 33. VALIDATION

Implement deterministic validation for at least:

- unknown preset;
- invalid date;
- CUSTOM missing startDate;
- CUSTOM missing endDate;
- startDate > endDate;
- invalid IANA timezone;
- unsupported granularity;
- invalid dimension/filter;
- unauthorized actor/partner/customer filters;
- incompatible query combinations.

Use existing TravelHub error-contract conventions.

No raw 500 for controlled invalid inputs.

---

# 34. PERIOD TEST MATRIX

Add focused tests for:

- TODAY;
- LAST_3_DAYS;
- LAST_7_DAYS;
- MONTH;
- LAST_6_MONTHS;
- YEAR;
- CUSTOM;
- start/end boundaries;
- adjacent intervals;
- month boundary;
- year boundary;
- leap year;
- timezone conversion;
- DST transition for a DST-observing IANA timezone;
- UTC fallback;
- comparison period;
- custom comparison;
- granularity auto-selection;
- granularity override.

Tests must be deterministic.

Do not depend on actual wall-clock time without a controlled clock/reference
instant.

---

# 35. METRIC TEST MATRIX

For implemented metrics, test:

- exact numerator;
- exact denominator;
- zero denominator;
- empty dataset;
- comparison;
- filtering;
- dimensions;
- authoritative timestamp;
- no boundary double-counting;
- currency separation;
- Decimal exactness.

Use known seeded values.

Avoid snapshot-only tests for financial arithmetic.

---

# 36. ACTOR ATTRIBUTION TEST MATRIX

Test at minimum:

- action actor;
- object owner;
- outcome attribution;
- actor != owner;
- owner != outcome recipient;
- missing actor;
- external PARTNER identity;
- external BUYER identity;
- internal role identity;
- unauthorized actor filter;
- tenant isolation;
- no accidental "last actor gets outcome" behavior.

---

# 37. READ MODEL TESTS

Each implemented read model must have focused tests covering:

- period;
- comparison;
- filters;
- dimensions;
- empty state;
- authorization;
- tenant/partner scope;
- authoritative timestamp;
- response contract.

Critical financial read models must also prove exact Decimal/currency behavior.

---

# 38. E2E CONTRACT

Add/extend e2e coverage for analytics API behavior.

At minimum cover:

- authorized internal analytics request;
- unauthorized request;
- partner-scoped request where applicable;
- invalid period;
- CUSTOM period;
- comparison;
- time-series granularity;
- no cross-tenant leakage;
- stable response structure.

Do not weaken existing e2e coverage.

---

# 39. REGRESSION CONTRACT

After implementation run the repository's full required regression.

At minimum, based on current known project practice:

## Backend

- TypeScript compile/typecheck;
- build;
- full unit suite;
- full serial e2e suite.

## Frontend

Even if frontend files are unchanged:

- TypeScript check;
- Vitest;
- production build.

## Database

- migrations up to date;
- migration count verified;
- drift check;
- no unintended schema changes.

## Artifacts

- artifact integrity checker;
- checker regression suite;
- `git diff --check`.

Use actual repository commands.

Report exact counts/results.

---

# 40. NEGATIVE CHECKS

Explicitly prove/report:

- Step 2.17B targets changed: 0
- production performance qualification executed: 0
- fake Phase 2 exit claim: 0
- PSP implementation: 0
- RLS redesign: 0
- employee efficiency scoring: 0
- employee surveillance semantics: 0
- invented team/department model: 0
- invented historical role tracking: 0
- invented FX conversion: 0
- JS float money arithmetic: 0
- duplicate financial writer: 0
- duplicate business authority: 0
- weakened/skipped tests: 0
- hidden failures: 0

---

# 41. SCHEMA / MIGRATION RULE

Do not assume schema changes are required.

Prefer implementing the foundation from existing canonical facts where
possible.

If a schema/migration change is genuinely required by the approved Step 3.3
design:

1. prove why existing schema cannot satisfy the contract;
2. document the authority/ownership implications;
3. keep the change minimal;
4. add migration;
5. verify migrate + drift;
6. add tests.

Do NOT add schema merely for convenience.

Hard stop if the required change would introduce an unresolved business
authority decision.

---

# 42. COMPANY TIMEZONE AUTHORITY GAP

Do NOT accidentally close the documented authority gap.

Current design state:

- no canonical company/tenant reporting timezone;
- optional IANA query timezone;
- UTC fallback;
- `Product.serviceTimeZone` is service-specific and not reporting authority.

Implementation may use the approved fallback contract.

It must NOT claim:

`company timezone implemented`

unless an authoritative repository source actually exists.

Record this gap in the implementation report for future resolution.

---

# 43. TEAM / DEPARTMENT GAP

Do not invent:

- Department;
- Team;
- Manager hierarchy;
- historical organization assignment.

Future Employee Analytics may require these.

For Step 3.3:

- preserve actor attribution using existing identities;
- document organizational dimensions as unavailable/TBD where appropriate.

---

# 44. HISTORICAL ROLE LIMITATION

If the repository stores only the user's current role, do not claim that
historical analytics can reconstruct the employee's role at event time.

Document this limitation.

Do not silently join historical facts to current role and label that result as
historical role truth.

---

# 45. IMPLEMENTATION REPORT

Create a comprehensive implementation report following repository conventions.

Suggested filename:

`docs/prompts/PHASE_3_STEP_3.3_ANALYTICS_FOUNDATION_IMPLEMENTATION_REPORT.md`

Use canonical repository naming if different.

Include at minimum:

1. Executive Summary
2. Baseline
3. Canonical Design Inputs
4. Repository-First Implementation Mapping
5. Architecture Implemented
6. Period Resolver
7. Custom Period
8. Timezone Handling
9. Comparison Resolver
10. Granularity
11. Fact Sources
12. Metric Catalog Implementation
13. Dimension Implementation
14. Business Timestamp Mapping
15. Actor Attribution
16. Action vs Ownership vs Outcome
17. Read Models
18. API Endpoints
19. Authorization
20. Tenant Isolation
21. Money/Decimal Integrity
22. Acquisition Attribution
23. Validation
24. Unit Tests
25. E2E Tests
26. Full Regression
27. DB Migration/Drift
28. Artifact Integrity
29. Authority Gaps
30. Known Limitations
31. Negative Checks
32. Files Changed
33. Persistence
34. Final Verdict
35. NEXT
36. REPOSITORY EVIDENCE

---

# 46. ROADMAP UPDATE

Update Step 3.3 only after implementation and regression evidence exists.

Do NOT mark Step 3.3 APPROVED merely because implementation is complete.

Use repository status conventions.

Expected semantic state after a successful pass:

`STEP 3.3 — IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

unless the canonical Roadmap explicitly defines another required intermediate
state.

Do not modify Step 2.17B status.

Do not claim formal Phase 2 exit.

---

# 47. GIT / PERSISTENCE

Before completion:

- inspect git status;
- preserve unrelated untracked user files;
- review diff;
- run `git diff --check`;
- commit intentional implementation changes;
- commit report/Roadmap/provenance according to repository convention;
- push;
- verify HEAD == upstream;
- verify tracked worktree clean;
- report actual commit SHA(s).

Never invent SHAs.

---

# 48. FAILURE POLICY

If implementation reveals a genuine design contradiction or authority blocker:

STOP and return an explicit blocked verdict.

Do not:

- weaken the design;
- silently redefine metrics;
- invent business semantics;
- skip required read models;
- mark unsupported functionality PASS;
- hide failing tests.

Classify findings by severity and distinguish:

- harness/test defect;
- implementation defect;
- design defect;
- authority gap;
- repository limitation.

---

# 49. FINAL VERDICT OPTIONS

## VERDICT A

`PHASE 3 STEP 3.3 ANALYTICS FOUNDATION IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Requirements:

- required implementation complete;
- required tests PASS;
- full regression PASS;
- no unresolved CRITICAL/HIGH implementation defects;
- authority gaps preserved honestly;
- Step 3.3 not falsely marked APPROVED.

## VERDICT B

`PHASE 3 STEP 3.3 ANALYTICS FOUNDATION IMPLEMENTATION PARTIAL — REMEDIATION REQUIRED`

Use when implementation has valid unresolved defects but repository/design
authority remains sufficient.

## VERDICT C

`PHASE 3 STEP 3.3 ANALYTICS FOUNDATION IMPLEMENTATION BLOCKED — AUTHORITY/DESIGN DECISION REQUIRED`

Use when safe implementation cannot proceed without new authority or design
reconciliation.

---

# 50. NEXT

For VERDICT A:

`NEXT: PHASE 3 — STEP 3.3 — STRICT REVIEW`

Strict Review must be a separate pass.

Do NOT automatically mark Step 3.3 APPROVED.

Do NOT automatically start Step 3.1 Dashboard Backend in this implementation
pass.

After Strict Review approval, repository-first sequencing may determine whether
the next executable consumer is:

- Step 3.1 Dashboard Backend;
- another canonical Phase 3 prerequisite;
- or another Roadmap-defined analytics step.

---

# 51. STRICT REVIEW HANDOFF REQUIREMENTS

The implementation report must leave enough evidence for a later independent
Strict Review to verify:

- every preset;
- CUSTOM start/end;
- half-open boundaries;
- timezone behavior;
- comparison semantics;
- granularity;
- authoritative timestamps;
- metric formulas;
- dimensions;
- actor attribution;
- action/ownership/outcome distinction;
- RBAC;
- tenant isolation;
- Decimal/currency;
- acquisition attribution;
- read-model correctness;
- API validation;
- schema/migration integrity;
- full regression.

Strict Review must be able to verify code rather than trust this report.

---

# 52. CORE SUCCESS CONDITION

Step 3.3 succeeds only if TravelHub has **one canonical Analytics Foundation**
that future consumers can reuse.

The implementation must prevent future domains from independently redefining:

- what "Today" means;
- how custom start/end dates work;
- timezone boundaries;
- comparison periods;
- time buckets;
- metric formulas;
- actor attribution;
- currency aggregation.

The target architecture is:

`CANONICAL FACTS`
→ `ANALYTICS FOUNDATION`
→ `METRICS / DIMENSIONS / PERIODS / ATTRIBUTION`
→ `READ MODELS / API`
→ future consumers:
`Dashboard | Sales | Booking | Orders | CRM | Finance | Products | Partners | Employee Analytics`

not:

`each page invents its own analytics logic`.

Implement the foundation accordingly.
