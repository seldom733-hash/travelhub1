# PHASE 3 — PRE-STEP 3.12 — PLATFORM ANALYTICS ROUND 2
## PARTNER PERFORMANCE DRILL-DOWN + FINANCIAL SEMANTICS + STOREFRONT SaaS RESIDUAL QUALIFICATION

## STATUS

**Task type:** Narrow Remediation + Re-Qualification  
**Starting SHA:** `8f5b086`

Do not roll back valid fixes from the previous strict review.

Current accepted fixes from `8f5b086`:

```text
Financial Summary no longer disappears on empty periods
Successful Payments reconciliation fixed
Storefront end-customers removed from Platform SaaS KPI set
Historical Marketplace Visitors false-zero mitigated
```

This Round 2 addresses only remaining / newly observed defects and semantic gaps.

---

## LANGUAGE REQUIREMENT — MANDATORY

All created or updated reports and prose documentation must be predominantly **in Russian**.

This applies to:

- Remediation Report
- Strict Review Report
- Runtime Evidence
- findings explanations
- root cause analysis
- architecture decisions
- semantic decisions
- conclusions
- recommendations
- verdict explanations

English is allowed only for technical identifiers:

- file paths
- classes / methods / DTO / models / tables
- API endpoints
- HTTP methods/status codes
- Git/CLI commands
- enums
- permission identifiers
- metric IDs
- code snippets
- standardized `VERDICT` strings

If the report is predominantly in English, the task is incomplete.

Do not include plaintext passwords, tokens, cookies, secrets, credentials, visitor/session identifiers, or other sensitive values.

---

# 1. CURRENT BLOCKING FINDING — PARTNER PERFORMANCE DRILL-DOWN 404

Observed runtime behavior:

```text
Platform Analytics
→ Производительность партнёров
→ click Orders
→ Страница не найдена

Platform Analytics
→ Производительность партнёров
→ click Bookings
→ Страница не найдена
```

This is a blocking drill-down routing regression.

Expected behavior:

```text
Partner Performance Orders
→ valid Partner 360 / Orders destination

Partner Performance Bookings
→ valid Partner 360 / Bookings destination
```

No 404.

---

# 2. BAKU TOURS PRO — CONTROL CASE

Use this exact runtime case as control evidence.

Partner:

```text
Baku Tours Pro
partnerId = aad76dd9-93ad-4d1c-107a-54b4b5adc8a2
```

Period:

```text
preset = MONTH
from   = 2026-09-01
to     = 2026-10-01
```

Previously observed values:

```text
Partner Performance:
Orders   = 86
Bookings = 10
```

Previous redirect destination values before the route broke:

```text
Orders registry   = 120
Bookings registry = 12
```

Observed mismatch:

```text
Orders:   86 → 120   (+34)
Bookings: 10 → 12    (+2)
```

Do not assume these mismatches are already fixed merely because the route is repaired.

---

# 3. PARTNER PERFORMANCE ROUTING — ROOT CAUSE

Audit:

```text
frontend href / router.push
Partner 360 route structure
dynamic [partnerId] segment
tab query
from
to
preset
fromAnalytics
workspace
route groups
layout guards
not-found behavior
```

Determine exactly why the current click returns 404.

Do not patch by pointing to an unrelated page.

---

# 4. PARTNER PERFORMANCE ROUTING CONTRACT

The following must work:

```text
click partner name
→ Partner 360 overview

click Orders count
→ Partner 360 Orders view

click Bookings count
→ Partner 360 Bookings view
```

Preserve:

```text
partnerId
period
preset
fromAnalytics=true
relevant business scope
```

Required runtime:

```text
direct URL open → PASS
client-side click → PASS
browser refresh/F5 → PASS
no 404
no redirect loop
```

---

# 5. PARTNER PERFORMANCE SOURCE TRACEABILITY

After routing is restored, re-qualify the numeric contract.

Required invariant for Orders:

```text
Authoritative DB Marketplace Orders for Partner X + period
=
Partner Performance Orders
=
Partner 360 Orders filtered total
```

Required invariant for Bookings:

```text
Authoritative DB Marketplace Bookings for Partner X + period
=
Partner Performance Bookings
=
Partner 360 Bookings filtered total
```

Frontend equality alone is insufficient.

---

# 6. EXACT ID / REFERENCE NUMBER SET DIFF — MANDATORY

For `Baku Tours Pro / MONTH / 2026-09-01..2026-10-01`, compare exact populations.

Orders:

```text
DB authoritative set
Analytics Partner Performance set
Partner 360 Orders set
```

Bookings:

```text
DB authoritative set
Analytics Partner Performance set
Partner 360 Bookings set
```

Produce diffs:

```text
only_in_analytics
only_in_partner_360
missing_from_partner_360
extra_in_partner_360
```

Use safe business `referenceNumber` where possible.

Do not expose PII or secrets.

---

# 7. PARTNER PERFORMANCE SCOPE DIMENSIONS

Compare exact predicates on both sides:

```text
partnerId
acquisitionSource
period field
[from,to)
status
workspace
tenant
soft-delete/archive condition if applicable
```

Explicitly verify whether one side uses:

```text
acquisitionSource = MARKETPLACE
```

while the other includes:

```text
MARKETPLACE + STOREFRONT
```

This is a hypothesis to test, not an assumed root cause.

---

# 8. PERIOD CONTRACT — PARTNER PERFORMANCE

For the control case:

```text
MONTH
from = 2026-09-01
to   = 2026-10-01
```

Verify the exact date field used by:

```text
Partner Performance Orders
Partner 360 Orders
Partner Performance Bookings
Partner 360 Bookings
```

The same displayed period must resolve to the same effective business interval.

Canonical interval:

```text
[from,to)
```

Do not silently use `createdAt` on one side and another lifecycle date on the other without explicit business justification.

---

# 9. PARTNER PERFORMANCE REQUIRED RECONCILIATION MATRIX

| Partner | Period | Metric | DB authoritative | Analytics | Partner 360 | Result |
|---|---|---|---:|---:|---:|---|
| Baku Tours Pro | MONTH | Orders | | 86 before | 120 before | |
| Baku Tours Pro | MONTH | Bookings | | 10 before | 12 before | |

Preserve the before values in the report.

---

# 10. FINANCIAL SUMMARY — SEMANTIC QUALIFICATION

Current observed Marketplace row for:

```text
MONTH
2026-09-01 → 2026-10-01
AZN
```

Displayed:

```text
Successful Payments = 6
Amount              = 754.77
Refunds             = 0
Net                 = 754.77
Commission          = 86.21
```

This is not automatically a numeric defect.

The blocking issue is **semantic ambiguity**.

---

# 11. DEFINE EVERY FINANCIAL COLUMN

For every visible financial column, report:

```text
UI label
metric ID
business meaning
formula
source tables
date field
status scope
Marketplace scope
currency scope
```

At minimum qualify:

```text
Successful Payments
Amount
Refunds
Net
Commission
```

Do not retain the generic label `Net` unless its meaning is unambiguous.

---

# 12. FINANCIAL BUSINESS SEMANTICS

Use the following conceptual distinction:

```text
Gross Payment / GMV
− Refunds
= Net GMV

TravelHub Commission
= gross platform monetization from Marketplace commission

Net GMV
− TravelHub Commission
[± other applicable adjustments]
= Partner Payable

TravelHub Commission
− processing costs
− refund costs
− payout costs
− FX costs
− chargeback/direct transaction costs
= Net Platform Revenue
```

Do not conflate these concepts.

---

# 13. IMPORTANT — DO NOT FAKE NET PLATFORM REVENUE

If authoritative transaction-cost data is not implemented, do not fabricate:

```text
Net Platform Revenue
```

Do not simply set:

```text
Net Platform Revenue = Commission
```

unless the product contract explicitly defines that as a temporary simplified metric and the UI labels it honestly.

If the underlying cost model is not implemented:

```text
NOT IMPLEMENTED
NOT QUALIFIABLE
```

is acceptable.

---

# 14. CURRENT AZN ROW — REQUIRED QUALIFICATION

For:

```text
Successful Payments = 6
Amount = 754.77 AZN
Refunds = 0
Net = 754.77 AZN
Commission = 86.21 AZN
```

Prove:

```text
which exact 6 Payment records
SUM payment amount
SUM refunds
Net formula
Commission formula
```

If current `Net = Amount - Refunds`, rename it to an explicit semantic label such as:

```text
Net GMV
```

or localized equivalent.

Do not change `754.77` to `668.56` unless the column is intentionally redefined as `Partner Payable`.

---

# 15. FINANCIAL SEMANTIC DECISION MATRIX

| Current label | Actual formula | Correct business concept | Keep/Rename/Remove | Final label |
|---|---|---|---|---|
| Successful Payments | | | | |
| Amount | | | | |
| Refunds | | | | |
| Net | | | | |
| Commission | | | | |

---

# 16. FINANCIAL ROW RECONCILIATION

For the AZN control row:

| Metric | DB | API | UI | Formula validated? | Result |
|---|---:|---:|---:|---|---|
| Successful Payments | | | 6 | | |
| Amount | | | 754.77 | | |
| Refunds | | | 0 | | |
| Net | | | 754.77 | | |
| Commission | | | 86.21 | | |

The goal is semantic and source correctness, not forcing values to change.

---

# 17. FINANCIAL DRILL-DOWN NON-REGRESSION

Previous strict review fixed:

```text
Successful Payments
→ status=CAPTURED
→ currency preserved
→ dateField=paidAt
→ Marketplace scope
```

Re-run a focused non-regression check.

Required:

```text
DB count
=
Financial Summary KPI
=
Payments registry filtered total
```

At least:

```text
MONTH / AZN
6 months / AZN
6 months / USD
6 months / EUR
```

Do not reopen already-correct logic without evidence.

---

# 18. STOREFRONT SaaS — RESIDUAL QUALIFICATION

Previous strict review correctly removed:

```text
Customers = 46
```

because they were Storefront end-customers.

Remaining Platform Storefront SaaS cards still require qualification:

```text
Sessions
Partners
```

Do not assume they are valid SaaS KPIs merely because they remain visible.

---

# 19. STOREFRONT SaaS `Sessions`

Determine exact:

```text
metric ID
source table
formula
distinct key
date field
population
business purpose
```

Classify whether it represents:

```text
Storefront end-customer browsing sessions
```

or:

```text
Platform-level Storefront product adoption / usage
```

If it is detailed Storefront customer traffic, default owner is:

```text
Partner / Storefront Analytics
```

not Platform SaaS business analytics.

If retained on Platform, justify it explicitly as a product-health/adoption KPI and label it accordingly.

---

# 20. `storefrontSessions` AUDIT

Verify:

```text
backend field exists?
API type?
frontend type?
current TSC status?
formula?
same metric as UI Sessions?
```

Previous project history had a `storefrontSessions` type mismatch.

If now resolved, report exactly how.

Classify:

```text
KEEP
RENAME
MOVE
DEPRECATE
REMOVE_FROM_PLATFORM_UI
```

---

# 21. STOREFRONT SaaS `Partners`

Determine exactly what population this counts.

Possible meanings:

```text
all partners with Storefront
active Storefronts
active entitled Storefront partners
active subscriptions
paid Storefront accounts
partners with activity in selected period
```

Do not conflate them.

Required:

```text
exact source
formula
period dependency
entitlement/subscription dependency
final UI label
```

If it is simply `Storefront-enabled partners`, label it as such.

---

# 22. NO FAKE SaaS KPI

Do not invent:

```text
MRR
ARR
Churn
Retention
Subscription Revenue
Active Subscriptions
```

unless authoritative implementation/data exists.

Classify each relevant candidate:

```text
IMPLEMENTED + AUTHORITATIVE
PARTIAL
NOT IMPLEMENTED
NOT QUALIFIABLE
```

---

# 23. STOREFRONT SaaS QUALIFICATION MATRIX

| Metric | Exact meaning | Source/formula | Platform SaaS valid? | Action |
|---|---|---|---|---|
| Sessions | | | YES/NO | |
| Partners | | | YES/NO | |
| Customers | Storefront end-customers | previously removed | NO | REMOVED |
| Active Subscriptions | | | | |
| Subscription Revenue | | | | |
| MRR | | | | |
| ARR | | | | |
| Churn | | | | |
| Retention | | | | |

---

# 24. ROUTE AVAILABILITY NON-REGRESSION

A broader Workspace 404 regression was observed and later reportedly fixed.

Do not reopen it as a separate remediation unless reproducible.

However, after fixing Partner Performance drill-down, perform a narrow route smoke test:

```text
/app/dashboard
/app/command-center
/app/analytics
/app/orders
/app/bookings
/app/crm
/app/finance/payments
```

Required:

```text
page renders
no Next.js not-found
refresh works
```

---

# 25. BROWSER RUNTIME — REQUIRED

Browser evidence must include:

```text
Partner Performance
Baku Tours Pro
Orders click
Bookings click
Partner 360 destination
period preservation
numeric reconciliation
Financial Summary AZN row
Storefront SaaS Sessions
Storefront SaaS Partners
```

At least RU must be fully verified.

For any changed labels/semantic descriptions also verify:

```text
RU
AZ
EN
```

No raw i18n keys.

---

# 26. FRONTEND TEST RESULT — TRUTHFULNESS

Previous reported result:

```text
Frontend Tests: 282/283
```

This must be reported as:

```text
FAIL — 282/283
```

if one test still fails.

It is acceptable to separately state:

```text
Known pre-existing failure: formatPrice locale
Scope impact: ...
```

but do not call the full suite PASS.

If the failure is easy and safe to fix without scope pollution, fix it and rerun.

Do not hide it.

---

# 27. QUALITY CHECKS

Run and report actual results:

```text
Frontend TSC
Frontend tests
Frontend build if applicable
Backend TSC
Backend build
Relevant backend tests
Relevant frontend tests
```

Do not convert failures into `PASS(scope)`.

---

# 28. SECURITY / AUTHORITY

Drill-down access remains server-authoritative.

Do not use frontend query parameters as authorization.

Verify Partner 360 data access still respects:

```text
workspace
role/permissions
partner context
business scope
```

`fromAnalytics=true` is navigation context only, not an auth bypass.

---

# 29. ROADMAP

Update additively:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Record:

```text
Partner Performance drill-down routing remediation
Partner Performance source-traceability reconciliation
Financial Summary semantic qualification
Storefront SaaS residual qualification
remaining known gaps
```

Preserve history and numbering.

Do not start next stage.

---

# 30. GIT EVIDENCE

Report:

```text
Starting SHA: 8f5b086
Implementation/Remediation SHA
Final HEAD
origin/master
HEAD == origin/master
working tree status
```

Use real SHAs.

---

# 31. REQUIRED REPORT STRUCTURE

Report predominantly in Russian:

```text
1. Executive Summary
2. Starting Git State
3. Partner Performance Routing Root Cause
4. Partner Performance Routing Fix
5. Baku Tours Pro Orders Reconciliation
6. Baku Tours Pro Bookings Reconciliation
7. Exact ReferenceNumber / ID Set Diff
8. Period / Scope / Status Contract
9. Financial Summary Semantic Audit
10. AZN MONTH Financial Row Reconciliation
11. Final Financial Metric Naming
12. Successful Payments Non-Regression
13. Storefront SaaS Sessions Qualification
14. storefrontSessions Qualification
15. Storefront SaaS Partners Qualification
16. SaaS Capability Inventory
17. Route Smoke Test
18. RU/AZ/EN Runtime Evidence
19. Tests / Typecheck / Build
20. Security Review
21. Roadmap Update
22. Git Evidence
23. Residual Risks
24. Final Verdict
```

---

# 32. HARD ACCEPTANCE GATES

```text
[ ] Partner Performance Orders click no longer 404
[ ] Partner Performance Bookings click no longer 404
[ ] direct URL works
[ ] client-side click works
[ ] refresh works
[ ] partnerId preserved
[ ] period preserved
[ ] Baku Tours Pro Orders reconciled
[ ] Baku Tours Pro Bookings reconciled
[ ] exact ID/referenceNumber set diff completed
[ ] Marketplace/Storefront scope mismatch ruled in/out with evidence
[ ] financial column semantics fully defined
[ ] generic Net ambiguity resolved
[ ] AZN MONTH row reconciled
[ ] Commission formula qualified
[ ] Partner Payable not conflated with Platform Revenue
[ ] Net Platform Revenue not fabricated
[ ] Successful Payments non-regression PASS
[ ] Storefront SaaS Sessions qualified
[ ] storefrontSessions qualified
[ ] Storefront SaaS Partners qualified
[ ] no Storefront end-customers reintroduced into Platform SaaS KPI
[ ] no fake SaaS metrics
[ ] workspace route smoke test PASS
[ ] changed labels verified RU/AZ/EN
[ ] frontend tests reported truthfully
[ ] backend/frontend checks reported truthfully
[ ] roadmap updated additively
[ ] Git evidence complete
```

---

# 33. VERDICT RULES

## VERDICT A — ROUND 2 QUALIFIED

Only if all applicable hard gates are proven.

## VERDICT B — NARROW REMEDIATION STILL REQUIRED

Use if any of these remain:

```text
Partner Performance drill-down 404
Orders/Bookings mismatch
financial semantic ambiguity
Storefront Sessions meaning unresolved
Storefront Partners meaning unresolved
runtime evidence incomplete
```

## VERDICT C — BUSINESS SEMANTICS INVALID

Use if:

```text
Storefront customer commerce is again mixed into Platform SaaS/Marketplace
```

or financial metrics are named in a way that materially misrepresents:

```text
GMV
Partner Payable
Platform Revenue
Net Revenue
Commission
```

---

# 34. NO PREMATURE VERDICT

Do not issue `VERDICT A` based only on:

```text
source code
unit tests
developer assertions
```

Runtime browser behavior and exact source reconciliation are mandatory.

---

# 35. NON-GOALS

Do not implement in this task:

```text
full Finance Center
FX engine
Partner Settlement engine
subscription billing engine
Cart/Checkout
Booking KPI redesign
Cross-Entity Business Reference stage
Step 3.12
```

---

# 36. STOP CONDITION

STOP after Round 2 Remediation / Re-Qualification Report.

Do not automatically start the next implementation stage.
