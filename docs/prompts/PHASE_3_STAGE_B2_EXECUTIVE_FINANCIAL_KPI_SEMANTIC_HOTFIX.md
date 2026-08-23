# PHASE 3 — COMMAND CENTER
## STAGE B.2 — EXECUTIVE FINANCIAL KPI SEMANTIC HOTFIX

### STATUS
**Targeted P0/P1 implementation remediation.**

Stage B.1 financial authority is fully closed:

```text
Stage B.1 original       → VERDICT B
Stage B.1 Remediation    → VERDICT A
Stage B.1 Policy Closure → VERDICT A
```

The architecture is now authoritative, but the current PLATFORM Command Center Executive Summary still visibly presents old/incorrect financial semantics.

Observed UI example:

```text
Сводные показатели

GMV
2 274 $
↓ 22.1%

Выручка
11 069 $
↑ 315.6%

Чистая выручка
10 510 $
```

These cards must no longer remain misleading after the financial authority has been established.

This stage is intentionally narrow. Fix the current Executive financial KPI semantics and currency presentation without implementing the full Stage H financial redesign or Stage I Storefront billing engine.

---

# 1. AUTHORITATIVE INPUTS — DO NOT REINTERPRET

The following decisions are already ACCEPTED / MANDATORY.

```text
Marketplace Business
≠ Storefront SaaS
≠ Storefront Commerce
```

```text
Platform Reporting Currency = AZN
Storefront Billing Currency = AZN
Premium Storefront current LIST PRICE = ₼199/month
```

```text
Booked / Contracted GMV
≠ Collected / Paid GMV
≠ Outstanding amount
```

```text
Expected Revenue
≠ Collected Revenue
≠ Outstanding Revenue
```

```text
Revenue ≠ Profit
Net Revenue ≠ automatically Profit
```

```text
Storefront Commerce Volume
≠ Marketplace GMV
≠ TravelHub Revenue
```

Marketplace refund policy:

```text
Customer refund
→ proportional Marketplace Commission reversal

Full qualifying refund
→ full applicable commission reversal

Partial qualifying refund
→ proportional applicable commission reversal
```

Do not reopen these decisions.

---

# 2. CONFIRMED CURRENT EXECUTIVE DEFECTS

Previous B.1 audit established:

```text
Executive "Revenue"
= customer payment volume
≠ TravelHub Revenue
```

and:

```text
Executive "Net Revenue"
= customer payments - refunds
≠ TravelHub Net Revenue
```

Therefore the current labels:

```text
Выручка
Чистая выручка
```

are semantically false for the values currently shown.

Also:

```text
$
```

is no longer valid as the PLATFORM reporting presentation because:

```text
Platform Reporting Currency = AZN
```

This is not a cosmetic-only task. Trace and fix the complete data contract.

---

# 3. OBJECTIVE

After this stage, the Executive Summary must:

```text
1. show only financially defensible metrics;
2. use AZN for PLATFORM aggregated monetary KPIs;
3. stop calling customer payment volume "TravelHub Revenue";
4. stop calling customer payments minus refunds "TravelHub Net Revenue";
5. make GMV semantics explicit and consistent with partial-payment authority;
6. avoid fabricating Storefront collected revenue;
7. preserve Marketplace / Storefront SaaS / Storefront Commerce separation;
8. remain compatible with later Stage H and Stage I implementation.
```

---

# 4. AUDIT BEFORE MODIFYING

Inspect current HEAD and trace every current Executive monetary card:

```text
database
→ repository/query
→ service calculation
→ DTO/API
→ frontend mapping
→ i18n label
→ formatter/currency symbol
→ comparison calculation
```

At minimum trace:

```text
GMV
Revenue
Net Revenue
Orders
comparison %
currency
```

Return exact current formulas and source fields before changing them.

Do not infer from previous reports if current HEAD differs.

---

# 5. TRACE THE OBSERVED ANOMALY

Reproduce or explain the current data path behind values similar to:

```text
GMV          2,274
Revenue     11,069
Net Revenue 10,510
Orders          40
```

The exact seed/current values may differ at execution time.

Determine precisely why:

```text
Revenue > GMV
```

Classify each contributing cause:

```text
formula
period scope
status scope
payment-vs-order basis
currency presentation
Storefront contamination
semantic label
comparison-period mismatch
other
```

Do not accept "different metrics" as sufficient explanation. Show the actual query/calculation path.

---

# 6. GMV — EXECUTIVE AUTHORITY

B.1 established the intended distinction:

```text
Executive
→ Booked / Contracted GMV
→ based on qualifying Order.amount

Channel Health
→ Collected / Paid GMV
→ based on qualifying Order.paidAmount
```

Validate this against actual repository semantics and statuses.

For Executive Summary, the KPI must represent the qualifying sold/contracted value, not merely the amount paid so far.

Because partial payments exist:

```text
Order value       ₼1,000
Paid                ₼300
Outstanding         ₼700
```

Executive GMV should not silently collapse to ₼300 if the qualifying sold value is ₼1,000.

Use an unambiguous API/internal name.

UI may use:

```text
GMV
```

only if tooltip/help/metric contract clearly defines it as booked/contracted GMV.

If ambiguity remains, use:

```text
Booked GMV
```

or the approved localized equivalent.

Do not call Collected GMV and Booked GMV simply `GMV` in two nearby contexts without semantic clarification.

---

# 7. MARKETPLACE GMV ONLY

The Executive Marketplace GMV must not include Storefront partner commerce.

Required:

```text
Marketplace GMV
= qualifying Marketplace sold/contracted transaction value
```

Not:

```text
Marketplace GMV
+ Storefront Commerce Volume
```

If the current Executive metric combines them, fix it.

If the current metric is generic across channels, explicitly separate or rename it according to the accepted ADR.

---

# 8. CURRENT "REVENUE" CARD — REQUIRED CORRECTION

If the current numeric value remains:

```text
customer payment volume
```

it must NOT be labeled:

```text
Revenue
Выручка
TravelHub Revenue
```

Choose one of two valid approaches based on actual data capability.

## Preferred Approach A — Replace with provable TravelHub revenue metric

If Expected Marketplace Revenue is reliably provable from canonical Commission data under current B.1 authority, replace the false Revenue KPI with a correctly named metric such as:

```text
Expected TravelHub Revenue
```

ONLY if all components included in the displayed total share the same semantic state.

If Storefront expected/contracted revenue cannot be proven, do NOT silently add:

```text
ACTIVE × ₼199
```

as actual revenue.

Possible honest metric:

```text
Expected Marketplace Revenue
```

until Storefront billing authority exists.

## Valid Approach B — Preserve payment-volume value but rename truthfully

If product requirements require retaining the existing customer payment-volume KPI in this hotfix, rename it to something like:

```text
Customer Payments
Collected Customer Payments
Payment Volume
```

using the best repository/product terminology.

It must be clear that this is customer transaction cash flow, not TravelHub-owned Revenue.

Document why Approach A or B was selected.

---

# 9. CURRENT "NET REVENUE" CARD — REQUIRED CORRECTION

Current confirmed behavior:

```text
customer payments - refunds
```

This is NOT TravelHub Net Revenue.

Do not retain the label:

```text
Net Revenue
Чистая выручка
```

unless the underlying calculation is actually replaced with the approved TravelHub Net Revenue semantic contract.

Choose a defensible metric.

If retaining the existing calculation, rename it to an accurate concept such as:

```text
Net Customer Payments
Net Payment Volume
```

or repository/product-approved equivalent.

If this metric adds little management value next to payment volume, it may be replaced by a more useful provable KPI such as:

```text
Refunds
Outstanding Customer Payments
Expected Marketplace Revenue
```

provided the calculation is canonical and tested.

Do not invent Net Revenue.

---

# 10. DO NOT FAKE CONSOLIDATED TRAVELHUB REVENUE

Current Storefront SaaS limitations remain:

```text
Storefront Collected Revenue = NOT PROVABLE
```

because the full billing/payment foundation does not yet exist.

Therefore do not construct:

```text
TravelHub Collected Revenue
=
Marketplace collected amount
+
ACTIVE subscriptions × ₼199
```

This is forbidden.

Likewise do not combine:

```text
Expected Marketplace Revenue
+
Storefront List-price MRR
```

and label the result simply `TravelHub Revenue`.

Consolidated revenue requires like-for-like semantics.

---

# 11. STOREFRONT ₼199 — HOTFIX BOUNDARY

Authoritative:

```text
Premium Storefront current LIST PRICE = ₼199/month
```

But:

```text
List Price ≠ Contracted Price
List-price MRR ≠ Collected Revenue
```

Dynamic future pricing remains required:

```text
discounts
promotions
negotiated pricing
free periods
campaign pricing
```

This hotfix must not build Stage I billing/pricing infrastructure.

If Executive currently consumes `SubscriptionPlan.priceUsd`, remove it from any misleading Revenue total where required.

Do not silently reinterpret `priceUsd` as AZN.

The field remains Stage I technical debt unless a safe dedicated migration is explicitly authorized.

---

# 12. AZN PRESENTATION — REQUIRED

PLATFORM Executive Summary monetary KPIs must render in AZN.

Target presentation:

```text
₼2,274
₼11,069
```

or repository-standard AZN formatting.

But:

> Do not solve this by changing only `$` to `₼`.

Audit:

```text
backend currency assumptions
DTO currency metadata
frontend formatter
locale formatter
hardcoded currency strings
i18n
tests
seed semantics
```

If underlying values are already AZN and only presentation is wrong, prove it.

If values are USD-derived, do not relabel them as AZN.

---

# 13. NO SPECULATIVE FX ENGINE

If all relevant current Executive values are canonically AZN, do not build foreign-exchange infrastructure in this stage.

Document:

```text
Current PLATFORM reporting currency: AZN
Current Executive data normalized/proven as AZN: YES/NO
Future multi-currency transaction support: separate capability
```

If mixed-currency source data currently exists, report the blocker rather than adding values incorrectly.

---

# 14. COMPARISON PERCENTAGES

Current UI also displays comparisons such as:

```text
GMV ↓22.1%
Revenue ↑315.6%
```

When changing a KPI's semantic basis, its comparison must use the **same metric definition** for current and previous periods.

Forbidden:

```text
current = Expected Marketplace Revenue
previous = old customer payment volume
```

or any equivalent mixed comparison.

For every changed KPI verify:

```text
same formula
same status scope
same business scope
same currency
same period boundary
```

for current and comparison periods.

If comparison cannot be calculated correctly, omit it rather than show a misleading percentage.

---

# 15. PERIOD / STATUS SCOPE

The B.1 report identified a period/status scope mismatch as part of the Revenue > GMV anomaly.

Audit and document for each Executive KPI:

```text
period field used
timezone
included statuses
excluded statuses
refund treatment
cancellation treatment
payment timing
order timing
```

Executive cards that appear side by side must have clearly documented temporal semantics.

Do not force all metrics to use the same event date if business meaning requires different dates, but do not hide the distinction.

---

# 16. PARTIAL PAYMENT SEMANTICS

Preserve the accepted distinction.

Example:

```text
Order amount       ₼1,000
Paid                 ₼300
Outstanding          ₼700
```

Required conceptual outputs:

```text
Booked GMV          ₼1,000
Collected GMV         ₼300
Outstanding           ₼700
```

Do not call all three GMV.

If the Executive Summary shows only one, use Booked/Contracted GMV according to B.1 authority.

Detailed payment collection may remain in Financial/Operational surfaces.

---

# 17. REFUND SEMANTICS

Preserve approved Marketplace policy:

```text
full qualifying refund
→ full applicable Marketplace Commission reversal

partial qualifying refund
→ proportional applicable Marketplace Commission reversal
```

The actual reversal mechanism is currently a known implementation gap assigned to the canonical downstream stage.

This hotfix must not pretend the reversal mechanism exists if it does not.

If Expected Marketplace Revenue currently cannot account for refunds correctly because reversal persistence is absent, explicitly determine whether:

```text
A. it can be calculated read-time from authoritative refunds;
B. it must be withheld from Executive until reversal implementation;
C. a narrow safe calculation can be implemented now.
```

Do not show knowingly overstated revenue.

---

# 18. REVENUE ≠ PROFIT

Do not introduce:

```text
Profit
Expected Profit
Actual Profit
```

as replacement KPIs.

B.1 established:

```text
Profit = NOT PROVABLE
```

because no complete cost model exists.

Likewise do not translate `Net Revenue` as `Profit`.

---

# 19. RECOMMENDED EXECUTIVE TARGET FOR THIS HOTFIX

Prefer a small set of truthful management KPIs.

Candidate:

```text
Marketplace GMV
Expected Marketplace Revenue
Customer Payments
Refunds
Orders
```

or another equally defensible set based on actual data.

If a truthful consolidated TravelHub Revenue cannot yet be calculated, explicitly prefer:

```text
Expected Marketplace Revenue
```

over a fabricated company-wide Revenue.

The final set must be justified in the report.

Do not overload Executive Summary with:

```text
Booked GMV
Collected GMV
Outstanding GMV
Expected Revenue
Collected Revenue
Outstanding Revenue
Billed Revenue
MRR
ARR
...
```

Those belong in deeper Financial/Analytics surfaces.

---

# 20. TOOLTIP / METRIC DEFINITIONS

Every financial Executive KPI must have an explicit metric definition in code/documentation.

At minimum define:

```text
name
business owner/scope
formula
source of truth
period field
status inclusion
refund behavior
currency
comparison formula
```

Where the existing UI supports tooltip/help text, use it.

If not, establish the contract in the relevant types/docs/tests without broad UI redesign.

---

# 21. I18N — REQUIRED

Audit all RU/AZ/EN labels affected by this hotfix.

Do not fix only Russian.

At minimum ensure semantic consistency for changed concepts such as:

```text
Marketplace GMV
Booked GMV
Expected Marketplace Revenue
Customer Payments
Net Customer Payments
Refunds
Orders
```

Use existing project i18n conventions.

Do not leave raw translation keys.

---

# 22. API CONTRACT

Prefer explicit semantic field names.

Avoid returning:

```ts
revenue
netRevenue
```

when they actually mean:

```ts
customerPayments
netCustomerPayments
```

If changing an existing DTO is backward-sensitive, use a safe migration strategy:

```text
new explicit field
deprecated old field
frontend migration
tests
later removal
```

or repository-consistent alternative.

Do not preserve a false API contract merely to avoid changing frontend mapping.

---

# 23. SERVER-SIDE AUTHORITY

Stage A granular RBAC remains authoritative.

Do not weaken:

```text
dashboard.executive.read
dashboard.operational.read
dashboard.financial.read
dashboard.marketplace.read
dashboard.catalog.read
dashboard.channels.read
dashboard.attention.read
dashboard.insights.read
```

This hotfix must not regress server-side section filtering.

No return to generic `analytics.read` for all Command Center sections.

---

# 24. STAGE B DECISION SIGNAL REGRESSION

Stage B Decision Signal Foundation is complete.

Do not modify its lifecycle/fingerprint/evidence semantics unless strictly required.

The representative PendingBookingsDetector must remain functional.

If monetary evidence is touched, preserve AZN authority and structured evidence.

No WHY / IMPACT / ACTION implementation here.

---

# 25. UI SCOPE

Do NOT redesign the whole Command Center.

Allowed:

```text
Executive card labels
Executive card values/formulas
currency formatting
comparison values
tooltips/help text
minimal layout adjustments required by renamed KPIs
```

Not allowed:

```text
new global tabs
full Financial redesign
full Analytics redesign
Decision Queue implementation
AI Decision Feed redesign
Storefront billing UI
```

Preserve the accepted future architecture:

```text
Command Center
→ one TravelHub overview + business blocks

Analytics
→ TravelHub | Marketplace | Storefront SaaS

Financial
→ Consolidated | Marketplace | Storefront SaaS
```

---

# 26. REQUIRED TESTS — BACKEND

Add/update tests proving the actual selected Executive contract.

At minimum:

```text
Booked GMV uses qualifying sold/contracted value, not only paid amount
Storefront Commerce does not contaminate Marketplace GMV
customer payment volume is not returned/labeled as TravelHub Revenue
false Net Revenue semantic is removed
AZN currency contract
current-period calculation
comparison-period calculation uses same metric semantics
partial-payment scenario
refund scenario where currently provable
zero-data scenario
```

Use actual repository status enums and models.

---

# 27. REQUIRED TESTS — FRONTEND

Prove:

```text
no `$` for PLATFORM Executive monetary KPIs
AZN formatting renders correctly
old false "Revenue" label is absent for payment volume
old false "Net Revenue" label is absent for payments-minus-refunds
new labels render in RU
new labels render in AZ
new labels render in EN
comparison indicators remain correct
cards render with zero/null data
no raw i18n keys
```

---

# 28. REQUIRED REGRESSION GATES

Run repository-appropriate:

```text
Dashboard unit tests
Command Center E2E
RBAC E2E
Decision Signal tests
Backend unit suite
Backend TSC
Backend build
Frontend Vitest
Frontend TSC
Frontend build
DB migration status
```

If no migration is needed, explicitly state so.

Do not claim PASS without actual evidence.

---

# 29. REQUIRED DELIVERABLE A — BEFORE / AFTER MATRIX

Return:

| KPI | Before label | Before formula | After label | After formula | Currency |
|---|---|---|---|---|---|

Include all Executive cards.

---

# 30. REQUIRED DELIVERABLE B — DATA TRACE

For each monetary Executive KPI show:

```text
DB source
→ query
→ service
→ DTO
→ frontend field
→ i18n label
→ formatter
```

Also explain the observed `Revenue > GMV` anomaly using actual implementation evidence.

---

# 31. REQUIRED DELIVERABLE C — FINANCIAL PROVABILITY

Return exactly:

```text
Marketplace Booked GMV: PROVABLE / NOT PROVABLE
Marketplace Collected GMV: PROVABLE / NOT PROVABLE
Marketplace Expected Revenue: PROVABLE / NOT PROVABLE
Marketplace Collected Revenue: PROVABLE / NOT PROVABLE
Storefront List-price MRR: PROVABLE / NOT PROVABLE
Storefront Contracted Revenue: PROVABLE / NOT PROVABLE
Storefront Collected Revenue: PROVABLE / NOT PROVABLE
TravelHub Consolidated Expected Revenue: PROVABLE / NOT PROVABLE
TravelHub Consolidated Collected Revenue: PROVABLE / NOT PROVABLE
TravelHub Net Revenue: PROVABLE / NOT PROVABLE
Profit: PROVABLE / NOT PROVABLE
```

For every NOT PROVABLE item give the missing authority/data source and owning future stage.

---

# 32. REQUIRED DELIVERABLE D — CURRENCY EVIDENCE

Confirm:

```text
Platform Reporting Currency: AZN
Executive GMV underlying currency: ...
Executive payment-volume underlying currency: ...
Executive expected-revenue underlying currency: ...
Frontend formatter: ...
Hardcoded `$` remaining in PLATFORM Command Center: YES/NO
Mixed aggregated currencies remaining: YES/NO
```

If YES, list exact locations.

---

# 33. REQUIRED DELIVERABLE E — FILES CHANGED

List exact:

```text
backend files
frontend files
i18n files
tests
documentation
migration if any
```

For each state why it changed.

---

# 34. REQUIRED DELIVERABLE F — TEST EVIDENCE

Return actual results/counts:

```text
Dashboard unit:
Command Center E2E:
RBAC E2E:
Decision Signal:
Backend unit:
Backend TSC:
Backend build:
Frontend Vitest:
Frontend TSC:
Frontend build:
DB migrations:
```

---

# 35. ROADMAP UPDATE — REQUIRED

This hotfix must be recorded in the canonical roadmap as an additive stage:

```text
Stage B.2 — Executive Financial KPI Semantic Hotfix
```

Do not destructively renumber existing stages.

Record:

```text
reason
dependency on B.1 closure
scope
status
evidence/report
downstream Stage H responsibilities
downstream Stage I responsibilities
```

Stage H must remain responsible for the broader Executive/Operational/Financial decision enrichment and full management presentation.

Stage I must remain responsible for Storefront billing/revenue capability including `priceUsd` technical debt and dynamic pricing/billing where currently assigned.

---

# 36. ADR COMPLIANCE CHECK

Do not create a new competing financial ADR unless necessary.

Confirm implementation complies with:

```text
docs/architecture/ADR-PLATFORM-BUSINESS-PERSPECTIVE-SEPARATION.md
```

especially:

```text
AZN authority
₼199 Storefront list price
Marketplace ≠ Storefront SaaS ≠ Storefront Commerce
Expected ≠ Collected ≠ Outstanding
Revenue ≠ Profit
refund commission reversal policy
```

If code cannot yet implement an ADR rule because a downstream capability is missing, do not fake compliance; expose the limitation truthfully.

---

# 37. STRICT STOP CONDITIONS

Stop and return VERDICT B/C rather than shipping misleading financial cards if:

```text
underlying currency cannot be proven;
Marketplace GMV scope cannot be separated from Storefront Commerce;
the selected replacement Revenue metric cannot be proven;
current/previous comparison uses incompatible semantics;
a backend field would need to be silently reinterpreted from USD to AZN;
the hotfix would require building the full Stage I billing system.
```

Truthful temporary metrics are preferred over fabricated completeness.

---

# 38. VERDICT

Return exactly one:

## VERDICT A — STAGE B.2 COMPLETE

Only if:

- Executive no longer presents customer payment volume as TravelHub Revenue;
- Executive no longer presents payments-minus-refunds as TravelHub Net Revenue;
- PLATFORM monetary presentation is correctly AZN;
- Executive GMV semantics are explicit and compatible with partial payments;
- Marketplace GMV excludes Storefront Commerce;
- no fake Storefront collected revenue is introduced;
- comparisons use like-for-like metric semantics;
- RU/AZ/EN labels are consistent;
- Stage A RBAC remains intact;
- Stage B Decision Signal regression remains green;
- tests/builds pass;
- roadmap records B.2.

## VERDICT B — STAGE B.2 REMEDIATION REQUIRED

Use if implementation exists but one or more semantic, currency, security or regression requirements remain incomplete.

## VERDICT C — BLOCKED

Use if current data cannot support any truthful replacement without a prerequisite financial capability.

State the exact blocker and the smallest required prerequisite.

---

# 39. STOP

After Stage B.2:

**STOP.**

Do not proceed automatically to Stage C, H, I, full Financial redesign, billing implementation, WHY, IMPACT or ACTION.

Return the complete Stage B.2 report and wait for review.
