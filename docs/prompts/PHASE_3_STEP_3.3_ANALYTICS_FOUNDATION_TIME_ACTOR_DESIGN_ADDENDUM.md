# TRAVELHUB — PHASE 3 — STEP 3.3 ANALYTICS FOUNDATION — DESIGN ADDENDUM
## TIME/PERIOD CONTRACT + ACTOR/EMPLOYEE ATTRIBUTION FOUNDATION

## ROLE

You are performing a **bounded design addendum** to the already completed:

`PHASE 3 — STEP 3.3 — ANALYTICS FOUNDATION — DESIGN`

Existing canonical design document:

`docs/architecture/analytics-foundation-3.3.md`

Existing design commit:

`497e951`

This is NOT:

- a restart of Step 3.3;
- a new full design pass;
- Step 3.3 implementation;
- Employee Analytics implementation;
- Dashboard implementation;
- KPI-weight authority;
- employee surveillance design.

The purpose of this pass is to close two foundation-level design gaps **before Step 3.3 implementation begins**:

1. define a reusable Analytics **Time/Period Contract**;
2. ensure the Analytics Foundation can support future **Actor/Employee attribution** without prematurely designing Employee Analytics.

Repository/code/Roadmap remain the source of truth.

---

# 1. BASELINE TO VERIFY

Independently verify the existing Step 3.3 design before editing it.

The completed design currently includes:

## Fact Model

11 domain areas:

- Catalog
- Behavioral
- CRM
- Sales Pipeline
- Orders
- Bookings
- Payments
- Refunds
- Commission
- Financial Ledger
- Communications

## Metrics

30+ metrics across:

- Revenue & Commercial
- Conversion & Funnel
- Timing & SLA
- Platform Activity
- Partner Performance
- Product Performance

## Dimensions

Existing design includes at least:

- Time
- acquisitionSource
- partner
- product
- category
- customer
- status
- currency

Geography is deferred.

## Read Models

Existing proposals include:

1. Company KPI Summary
2. Partner Performance Summary
3. Conversion Funnel
4. Time-Based Analytics
5. Financial Reconciliation Summary

## Known Time capability

The current design mentions:

- hour → year;
- serviceDate;
- custom period.

Do NOT assume this is sufficient.

Verify exact semantics in the design document.

---

# 2. PRIMARY OBJECTIVE

Extend the Step 3.3 design so that future analytics consumers can use a single,
consistent temporal contract and can attribute relevant business facts/actions
to responsible actors/employees where repository evidence allows it.

The design must remain reusable across:

- Dashboard / Command Center;
- Sales Analytics;
- Booking Analytics;
- Order Analytics;
- CRM Analytics;
- Finance Analytics;
- Product Analytics;
- Partner Analytics;
- future Employee Analytics.

Do NOT implement these domains in this pass.

---

# 3. TIME/PERIOD CONTRACT

Define an explicit common Analytics Time/Period Contract.

At minimum the design must support these logical presets:

- `TODAY`
- `LAST_3_DAYS`
- `LAST_7_DAYS`
- `MONTH`
- `LAST_6_MONTHS`
- `YEAR`
- `CUSTOM`

The exact API enum names may differ if repository conventions require it.

Preserve the product semantics even if naming changes.

---

# 4. CUSTOM PERIOD — HARD REQUIREMENT

`CUSTOM` must support an explicitly selected reporting interval:

- `startDate`
- `endDate`

Example:

`2026-03-15 → 2026-06-27`

The user must not be restricted to:

- calendar months;
- quarters;
- whole years;
- predefined presets.

The design must support arbitrary valid start/end dates.

Do NOT implement the UI in this pass.

---

# 5. PERIOD BOUNDARY SEMANTICS

The design must explicitly define date/time boundary semantics.

Resolve and document:

- whether API periods are represented as dates or timestamps;
- inclusive start semantics;
- end-date semantics;
- conversion to an internal half-open interval if appropriate;
- handling of the end of a calendar day;
- DST behavior;
- timezone conversion;
- UTC storage/query expectations;
- invalid ranges (`startDate > endDate`);
- empty periods;
- maximum supported custom period if repository authority already defines one.

Prefer mathematically unambiguous internal intervals such as:

`[startInstant, endExclusiveInstant)`

if consistent with repository architecture.

Do NOT invent arbitrary product limits if no authority exists.

---

# 6. TENANT / COMPANY TIMEZONE

Analytics must not silently use the server's local timezone.

Repository-first determine whether TravelHub already has an authoritative:

- tenant timezone;
- company timezone;
- organization timezone;
- user timezone;
- locale/timezone preference.

If an authoritative timezone source exists:

- use it;
- document precedence.

If no authoritative company/tenant timezone exists:

- identify this as an explicit authority/data-model gap;
- define the required semantic contract without inventing a production default.

UTC may remain the storage/internal representation, but business reporting
periods such as `TODAY` must be evaluated against the authoritative business
timezone once defined.

---

# 7. PRESET SEMANTICS

Define exactly what each preset means.

At minimum address:

## TODAY

Current business calendar day in the authoritative analytics timezone.

## LAST_3_DAYS

Define whether this means:

- rolling 72 hours; or
- current calendar day + previous 2 calendar days.

Choose only if repository/product evidence supports the choice.

Otherwise mark the exact interpretation as an authority decision required.

## LAST_7_DAYS

Likewise distinguish:

- rolling 168 hours; versus
- 7 business calendar days including today.

## MONTH

Determine whether canonical product intent means:

- current calendar month; or
- trailing one-month interval.

## LAST_6_MONTHS

Determine calendar vs rolling semantics.

## YEAR

Determine:

- current calendar year; or
- trailing 12 months.

The design must eliminate ambiguous period names before implementation.

If authority is missing, record explicit TBDs rather than silently inventing
semantics.

---

# 8. COMPARISON PERIOD CONTRACT

Analytics Foundation must support comparison against a preceding equivalent
period.

For every resolved reporting period define:

- `current.start`
- `current.end`
- `comparison.start`
- `comparison.end`

For a custom interval, support a preceding interval of equivalent duration.

Example concept:

Current:

`2026-04-01 → 2026-04-30`

Comparison:

preceding equivalent-duration interval.

The exact boundary algorithm must be documented and deterministic.

Also define behavior for calendar presets where calendar-aligned comparison is
more appropriate, e.g.:

- current month vs previous month;
- current year vs previous year.

Do not assume one comparison algorithm is correct for every preset.

---

# 9. COMPARISON METRICS

Define reusable comparison semantics for metrics where mathematically valid.

At minimum consider:

- absolute delta;
- percentage delta;
- current value;
- previous value;
- direction/trend.

Define behavior when previous value is:

- zero;
- null;
- unavailable;
- not applicable.

Do NOT invent "good/bad" coloring or KPI judgment semantics at foundation level
unless already authorized.

A positive numeric delta is not universally a positive business outcome
(e.g. cancellations, response time, refunds).

---

# 10. TIME GRANULARITY

Define how the Analytics Foundation selects or accepts aggregation granularity.

Candidate granularities:

- hour;
- day;
- week;
- month;
- quarter;
- year.

Repository evidence should determine exact supported levels.

The design must address short and long reporting periods so consumers do not
need to implement their own incompatible bucketing logic.

Examples:

- Today may use hourly buckets.
- A week may use daily buckets.
- Six months may use daily/weekly/monthly buckets.
- A year may use monthly buckets.

These are examples, not automatic implementation authority.

Specify whether granularity is:

- explicit API input;
- automatically selected;
- or both.

---

# 11. MULTIPLE BUSINESS DATES

Preserve the distinction between different time meanings.

Analytics must not collapse all facts onto `createdAt`.

Repository-first inventory and classify relevant timestamps such as:

- createdAt
- updatedAt
- issuedAt
- confirmedAt
- completedAt
- cancelledAt
- paidAt
- refundedAt
- accruedAt
- serviceDate
- booking date
- order date
- event occurredAt
- event publishedAt
- communication timestamp

The existing Step 3.3 lifecycle/milestone inventory should be reused.

Define which timestamp is authoritative for each metric/fact.

Do NOT rewrite historical business semantics.

---

# 12. ACTOR / EMPLOYEE ATTRIBUTION FOUNDATION

Add a foundation-level design for attributing relevant facts/actions to the
responsible actor.

This is NOT Employee Analytics implementation.

The goal is only to ensure that future Employee Analytics can be built from
canonical facts instead of retrofitting employee identity later.

Repository-first determine existing identity concepts such as:

- User
- employee
- staff
- owner
- assignee
- createdBy
- updatedBy
- actor
- manager
- sales owner
- partner user
- tenant member
- organization member

Do NOT invent a new `Employee` entity if the repository already has an
authoritative identity/member model.

---

# 13. ACTOR DIMENSION

Design a reusable Actor/Employee dimension using repository-native identities.

Determine whether analytics facts can or should expose dimensions such as:

- `actorId`
- `ownerId`
- `assigneeId`
- `createdById`
- `responsibleUserId`
- `teamId`
- `managerId`
- `role`

These names are illustrative only.

Use canonical repository fields.

For each proposed attribution dimension document:

- source table/event;
- authoritative field;
- nullable semantics;
- tenant/company scope;
- historical stability;
- whether attribution represents actor, owner, assignee, or approver.

Do not conflate these concepts.

---

# 14. ACTION ATTRIBUTION VS RESULT ATTRIBUTION

Explicitly distinguish:

## Action attribution

Who performed an action?

Examples:

- created a quote;
- confirmed a booking;
- sent a communication;
- changed a status;
- completed a workflow step.

## Ownership attribution

Who owns/is responsible for the object?

Examples:

- opportunity owner;
- customer manager;
- booking assignee.

## Outcome attribution

To whom may a business result legitimately be attributed?

Examples:

- sale;
- completed booking;
- revenue;
- commission;
- conversion.

These are NOT automatically the same person.

The Analytics Foundation must preserve this distinction so future Employee
Analytics does not incorrectly credit every outcome to the last actor.

---

# 15. ACTIVITY ≠ EFFECTIVENESS

Preserve this semantic invariant explicitly:

`PLATFORM ACTIVITY ≠ EMPLOYEE EFFECTIVENESS`

The foundation may make activity facts measurable.

It must NOT define employee performance solely from:

- login duration;
- page views;
- session duration;
- number of clicks;
- apparent idle time.

Future employee evaluation may combine multiple dimensions such as:

- platform activity;
- communications;
- workload;
- task/follow-up execution;
- funnel activity;
- business results;
- conversion;
- SLA;
- quality;
- errors/cancellations.

But this pass MUST NOT define weights or a universal Efficiency Score.

---

# 16. ACTIVITY CHANNEL CLASSIFICATION

Where supported by existing facts, design a lightweight classification that can
later distinguish categories such as:

- platform interaction;
- client communication;
- workflow/business action;
- commercial outcome.

Do not invent events merely to fill these categories.

Map only repository-supported facts/events.

If communication activity is only partially observable, state that explicitly.

Example principle:

An employee may have low platform interaction but high client communication and
strong commercial results.

The analytics model must not make that employee appear automatically inactive
or ineffective.

---

# 17. HISTORICAL DIMENSION SEMANTICS

Consider whether actor-related dimensions can change over time:

- role;
- team;
- manager;
- department;
- employment status.

Determine whether the existing repository preserves historical assignment.

If it does not, document the limitation.

Do NOT silently claim historical team/manager attribution if only current
membership is available.

Do NOT introduce schema changes in this design addendum unless the canonical
Step 3.3 design explicitly requires a later implementation proposal.

---

# 18. PRIVACY / ACCESS BOUNDARY

Actor/employee attribution introduces access-control implications.

Design-level analysis must identify:

- who may access company-wide analytics;
- who may access team analytics;
- whether ordinary employees can view peers;
- tenant isolation requirements;
- manager/team scoping where already supported by RBAC.

Do not invent HR policy.

Do not introduce covert employee surveillance semantics.

The goal is business analytics and operational management based on legitimate
TravelHub workflow data.

---

# 19. READ MODEL IMPACT

Review the five existing proposed read models.

Determine whether the Time/Period Contract can be consumed consistently by all
of them.

Also determine whether Actor attribution requires:

- extending existing read models;
- adding dimensions to queries;
- or reserving a future Employee Performance read model.

Do NOT automatically create an Employee Analytics read model in Step 3.3 unless
it is necessary at foundation level.

Preferred principle:

foundation first, domain-specific employee analytics later.

---

# 20. API DESIGN IMPACT

Without implementing endpoints, define how analytics queries should express:

- period preset;
- custom start date;
- custom end date;
- timezone context if required;
- comparison enabled/disabled;
- granularity;
- dimensions;
- filters.

Avoid endpoint-specific duplicate date logic.

The Analytics query layer should own/consume a canonical period resolver.

Do not implement frontend period calculation separately from backend semantics.

---

# 21. VALIDATION CONTRACT

Design validation requirements for future implementation.

At minimum:

- unknown preset → reject;
- CUSTOM without start/end → reject;
- start > end → reject;
- invalid date → reject;
- unsupported granularity → reject;
- tenant/actor filters outside authorization → reject;
- ambiguous timezone must not silently use machine local time.

Document expected error-contract style based on repository conventions.

---

# 22. TESTABILITY CONTRACT

Add future implementation test requirements.

At minimum include tests for:

- every preset;
- custom start/end;
- month/year boundaries;
- leap year;
- DST transition where applicable;
- timezone conversion;
- previous-equivalent comparison;
- zero previous value;
- custom-period comparison;
- multiple business timestamp types;
- actor attribution;
- owner vs actor distinction;
- tenant isolation;
- missing actor;
- historical attribution limitations.

No implementation is required in this pass.

---

# 23. KPI DICTIONARY IMPACT

Review the existing Step 3.3 / Step 3.3B KPI dictionary.

For each KPI category determine whether it has:

- authoritative fact;
- authoritative timestamp;
- supported dimensions;
- period compatibility;
- comparison compatibility.

Do NOT add arbitrary employee KPI formulas.

Employee-specific KPI definitions remain future domain work unless already
canonically defined elsewhere in the Roadmap.

---

# 24. REQUIRED DESIGN ADDENDUM MATRIX

Add a matrix to the design document containing at minimum:

| Capability | Existing support | Addendum decision | Authority | Implementation impact |
|---|---|---|---|---|
| Preset periods | | | | |
| Custom start/end | | | | |
| Timezone | | | | |
| Boundary semantics | | | | |
| Comparison period | | | | |
| Granularity | | | | |
| Business timestamp selection | | | | |
| Actor attribution | | | | |
| Ownership attribution | | | | |
| Outcome attribution | | | | |
| Activity channel | | | | |
| Historical role/team | | | | |
| RBAC/privacy | | | | |

Populate from repository evidence.

---

# 25. HARD STOPS

This pass must NOT:

- implement analytics backend services;
- create production API endpoints;
- create frontend analytics UI;
- implement Dashboard;
- implement Employee Analytics;
- create employee monitoring software;
- define universal employee efficiency weights;
- change monetary semantics;
- change canonical business events;
- change Sales/Booking/Order authority;
- change Step 2.17B;
- change frozen performance targets;
- claim Phase 2 exit;
- implement PSP;
- redesign RLS;
- add schema/migrations solely for this addendum.

If implementation gaps are found, record them for the Step 3.3 implementation
prompt.

---

# 26. EXISTING DESIGN PRESERVATION

Do not rewrite the valid Step 3.3 design unnecessarily.

Preserve:

- existing 11-domain fact model;
- existing metrics catalog;
- acquisition attribution design;
- existing read-model design;
- existing KPI dictionary references;
- existing repository evidence.

This pass should be a targeted extension/reconciliation.

---

# 27. ROADMAP

Update the Roadmap only if required by repository convention.

Do NOT mark Step 3.3 implementation completed.

Valid state after this pass should remain semantically equivalent to:

`STEP 3.3 — ANALYTICS FOUNDATION — DESIGN COMPLETED / IMPLEMENTATION READY`

with the addendum incorporated.

If the Roadmap already has a more precise canonical status vocabulary, use it.

---

# 28. REPORT

Create a bounded report using repository naming conventions.

Suggested filename:

`docs/prompts/PHASE_3_STEP_3.3_ANALYTICS_FOUNDATION_TIME_ACTOR_DESIGN_ADDENDUM_REPORT.md`

Use the actual repository convention if different.

Report at minimum:

1. Executive Summary
2. Baseline
3. Existing Step 3.3 Design Verification
4. Gap Analysis
5. Time/Period Contract
6. Custom Period Contract
7. Timezone Semantics
8. Boundary Semantics
9. Preset Semantics
10. Comparison Period
11. Granularity
12. Business Timestamp Mapping
13. Actor Identity Inventory
14. Actor Dimension
15. Action vs Ownership vs Outcome Attribution
16. Activity Channel Classification
17. Historical Attribution
18. Privacy/RBAC
19. Read Model Impact
20. API Design Impact
21. KPI Dictionary Impact
22. Testability Contract
23. Authority Gaps
24. Negative Checks
25. Files Changed
26. Artifact Integrity
27. Persistence
28. Final Verdict
29. NEXT
30. REPOSITORY EVIDENCE

---

# 29. REGRESSION / ARTIFACT SAFETY

This should be a documentation/design-only pass.

Run at minimum:

- artifact integrity checker;
- checker regression suite;
- `git diff --check`.

If repository convention requires additional documentation validation, run it.

Production regression should not be necessary if production code remains
unchanged.

Report exact results.

---

# 30. GIT / PERSISTENCE

Before completion:

- inspect `git status`;
- preserve unrelated untracked files;
- commit only intentional addendum/docs changes;
- push;
- verify HEAD == upstream;
- report real commit SHA(s);
- verify tracked worktree clean.

Never invent SHA values.

---

# 31. FINAL VERDICT

Return one of:

## VERDICT A

`STEP 3.3 ANALYTICS FOUNDATION DESIGN ADDENDUM COMPLETED — TIME/PERIOD AND ACTOR ATTRIBUTION CONTRACTS READY — IMPLEMENTATION MAY PROCEED`

Use when all required foundation semantics are sufficiently defined.

## VERDICT B

`STEP 3.3 ANALYTICS FOUNDATION DESIGN ADDENDUM PARTIAL — AUTHORITY DECISIONS REQUIRED BEFORE IMPLEMENTATION`

Use only when unresolved authority gaps make implementation unsafe.

## VERDICT C

`STEP 3.3 ANALYTICS FOUNDATION DESIGN ADDENDUM BLOCKED — CANONICAL DESIGN CONFLICT`

Use only for a genuine repository/design conflict.

---

# 32. NEXT

For VERDICT A:

`NEXT: PHASE 3 — STEP 3.3 — ANALYTICS FOUNDATION IMPLEMENTATION`

unless the canonical Roadmap establishes a required prerequisite that must be
executed first.

If Step 3.1 Dashboard Backend may consume Step 3.3 but Step 3.3 implementation
is a prerequisite, state that dependency explicitly.

Do not jump into implementation during this pass.

---

# 33. CORE PRINCIPLES

Preserve these invariants:

`ANALYTICS PERIOD LOGIC = SHARED FOUNDATION, NOT UI-LOCAL LOGIC`

`CUSTOM PERIOD = EXPLICIT START DATE + END DATE`

`BUSINESS REPORTING TIME ≠ SERVER LOCAL TIME`

`ACTION ACTOR ≠ OBJECT OWNER ≠ BUSINESS OUTCOME OWNER`

`PLATFORM ACTIVITY ≠ EMPLOYEE EFFECTIVENESS`

`FOUNDATION ATTRIBUTION ≠ EMPLOYEE PERFORMANCE SCORING`

The purpose of this addendum is to make Step 3.3 sufficiently durable that
Dashboard, domain analytics, and future Employee Analytics can share the same
time, attribution, comparison, and dimensional semantics without later
retrofitting incompatible foundations.
