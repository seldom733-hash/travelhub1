# PHASE 3 — COMMAND CENTER / PLATFORM BUSINESS ARCHITECTURE
## STAGE B.1 — REMEDIATION
## FINANCIAL SEMANTICS, AZN AUTHORITY, PARTIAL PAYMENTS & REVENUE OWNERSHIP

### STATUS
**Architecture remediation + narrowly scoped semantic implementation/documentation fixes.**

Previous Stage B.1 returned:

```text
VERDICT B — REMEDIATION REQUIRED
```

Confirmed findings included:

```text
1. Executive Revenue = customer payments, NOT TravelHub Revenue
2. Executive Net Revenue = customer payments minus refunds, NOT TravelHub Net Revenue
3. Storefront Revenue = SubscriptionPlan list-price aggregation, NOT proven paid revenue
4. Revenue Mix is absent
5. i18n/financial labels are semantically inconsistent
```

After the original B.1 prompt was launched, additional **mandatory business decisions** were accepted. This remediation must incorporate them into the authoritative architecture, ADR, roadmap and implementation plan.

Do NOT proceed to Stage C until this remediation returns VERDICT A.

---

# 1. NEW AUTHORITATIVE CURRENCY DECISION

The following supersedes all prior `$199` / USD assumptions for the current Storefront Premium subscription:

```text
PLATFORM REPORTING CURRENCY = AZN
STOREFRONT BILLING CURRENCY = AZN

Premium Storefront
Current canonical LIST PRICE = 199 AZN / month
```

Therefore:

```text
OLD: $199/month
NEW: ₼199/month
```

The old `$199` decision is no longer authoritative.

Update durable architecture documentation accordingly.

Do NOT merely replace `$` with `₼` in the frontend.

Audit and reconcile:

```text
database fields
Prisma schema
seed data
migrations
DTOs
backend calculations
frontend formatting
i18n
tests
reports
ADR
roadmap
documentation
```

Any historical field such as:

```text
priceUsd
```

must be classified as:

```text
safe to rename/migrate now
or
technical debt requiring an explicit migration stage
```

Do not silently reinterpret a field named `priceUsd` as AZN without documenting/migrating the semantic contract.

---

# 2. CURRENCY AUTHORITY

Establish a canonical currency model.

At minimum distinguish:

```text
Transaction Currency
Billing / Contract Currency
Platform Reporting Currency
Partner Workspace Reporting Currency
```

For the current PLATFORM management surface:

```text
Platform Reporting Currency = AZN
```

For current Storefront Premium billing:

```text
Billing Currency = AZN
List Price = ₼199/month
```

Marketplace transactions may support other currencies now or in the future, but aggregated PLATFORM monetary KPIs must be normalized to AZN before aggregation.

Required invariant:

> A single PLATFORM management surface must not mix aggregated monetary KPIs in different currencies without an explicit original-currency mode.

Do not sum monetary values across currencies without normalization.

If current data is all AZN, state and prove that explicitly.

If FX infrastructure is not currently required, do not build it speculatively. Document the future requirement.

---

# 3. CRITICAL GMV RECONCILIATION FOR PARTIAL PAYMENTS

The previous B.1 report classified:

```text
GMV Marketplace = SUM(Order.paidAmount)
```

as correct.

That classification is no longer sufficient because TravelHub supports **partial/installment customer payments**.

Example:

```text
Order / service value       ₼1,000
Paid by customer              ₼300
Outstanding                   ₼700
```

Calling only `₼300` simply `GMV` may understate the economic value of the sold/contracted service.

Audit the actual Order/Booking/payment model and determine the authoritative definitions.

At minimum evaluate whether TravelHub needs distinct concepts such as:

```text
Booked / Contracted GMV
Collected / Paid GMV
Outstanding GMV
```

Conceptually:

```text
Booked GMV
= qualifying total value of sold/confirmed orders/services

Collected GMV
= customer payments actually collected against qualifying orders

Outstanding GMV
= unpaid qualifying amount
```

Do NOT adopt these exact names blindly. Use repository/business terminology where clearer.

The key requirement is:

```text
total sold value
≠ amount collected so far
```

when installment payments exist.

---

# 4. GMV STATUS POLICY

Define exactly which order/booking statuses contribute to each GMV metric.

Audit current statuses and payment lifecycle.

For each candidate metric specify inclusion/exclusion rules:

```text
created
pending confirmation
confirmed
partially paid
fully paid
cancelled
completed
refunded
partially refunded
```

Do not invent status names; use actual repository states.

Explicitly define how:

```text
cancellation
partial refund
full refund
```

affect:

```text
Booked GMV
Collected GMV
Outstanding GMV
```

This definition must be deterministic and testable.

---

# 5. MARKETPLACE REVENUE OWNERSHIP

Marketplace Revenue belongs to TravelHub only to the extent of TravelHub-owned marketplace monetization.

Conceptually:

```text
Marketplace Revenue
→ Commission / marketplace-owned fees
```

It is NOT:

```text
customer payment volume
order value
GMV
partner gross sales
```

Audit the current `Commission` model and exact calculation semantics.

Return:

```text
Commission base:
Commission rate/amount authority:
When commission is created:
When commission is earned:
When commission is collected:
How refunds affect commission:
How partial customer payments affect commission:
```

Do not assume proportional recognition unless the existing business model supports it.

---

# 6. EXPECTED VS COLLECTED REVENUE — MANDATORY

TravelHub must distinguish expected economic entitlement from cash actually collected where partial payments exist.

At minimum reconcile concepts equivalent to:

```text
Expected Revenue
Collected Revenue
Outstanding Revenue
```

For Marketplace conceptually:

```text
Expected Marketplace Revenue
= TravelHub commission/fees expected from qualifying sold business

Collected Marketplace Revenue
= TravelHub revenue actually collected/realized according to the approved recognition policy

Outstanding Marketplace Revenue
= expected amount not yet collected/realized
```

Required invariant:

```text
Expected Revenue
≠ Collected Revenue
```

when payment is incomplete.

Do not label expected amounts as collected revenue.

---

# 7. REVENUE RECOGNITION POLICY

Partial customer payment introduces a policy question.

Example:

```text
Order value                 ₼1,000
Commission entitlement         10%
Expected commission           ₼100
Customer paid                 ₼300
```

Possible policies include:

```text
A. commission collected proportionally → ₼30
B. commission collected first → up to ₼100
C. commission recognized only after full payment
D. commission recognized after service fulfillment
```

Do NOT choose a policy arbitrarily.

Audit actual TravelHub payment/commission/payout behavior and existing documentation/code.

If the repository does not establish the intended policy, mark it as a **business-policy decision requiring explicit approval**, and do not fabricate financial results.

Architecture must be able to support the selected policy later.

---

# 8. REVENUE TERMINOLOGY

Distinguish, where applicable:

```text
Expected
Contracted
Earned / Accrued
Billed
Collected / Paid
Recognized
Outstanding
Refunded / Reversed
Net
```

Not every term must become a UI KPI.

But backend architecture/documentation must not use them interchangeably.

Especially:

```text
customer payment volume ≠ TravelHub Revenue
customer payment volume - refunds ≠ TravelHub Net Revenue
```

unless a formal business definition explicitly proves otherwise.

---

# 9. PROFIT ≠ REVENUE

Do not label Revenue or Net Revenue as `Profit / Прибыль`.

Required conceptual distinction:

```text
GMV / Sales Volume
↓
TravelHub Revenue
↓
Revenue deductions
↓
Net Revenue
↓
Operating / business costs
↓
Profit
```

If TravelHub does not yet model all relevant costs, actual Profit is **NOT PROVABLE**.

If product requirements later need:

```text
Expected Profit
Actual Profit
```

those metrics require a cost model and must not be inferred from Revenue alone.

Document this explicitly.

---

# 10. EXECUTIVE SUMMARY SEMANTIC CORRECTION

Current confirmed problem:

```text
Executive Revenue
= customer payments
```

and:

```text
Executive Net Revenue
= customer payments - refunds
```

These labels are incorrect.

Define the target Executive Summary financial contract.

It should eventually distinguish company-level metrics such as:

```text
Marketplace GMV / Booked GMV
Collected GMV where useful

Expected TravelHub Revenue
Collected TravelHub Revenue
Outstanding TravelHub Revenue
TravelHub Net Revenue
```

Do not overload Executive Summary with every accounting state.

Recommend the minimum management-level set.

A strong conceptual candidate is:

```text
Marketplace GMV
Expected Revenue
Collected Revenue
Net Revenue
```

with drill-down/detail showing:

```text
Marketplace contribution
Storefront SaaS contribution
Outstanding amounts
```

But audit the actual product semantics before finalizing labels.

---

# 11. TRAVELHUB TOTAL REVENUE TREE

Canonical structure must remain:

```text
TravelHub Revenue
=
Marketplace Revenue
+
Storefront SaaS Revenue
+
future TravelHub-owned revenue streams
```

But every component must have compatible semantic state.

Do NOT sum:

```text
Collected Marketplace Revenue
+
List-price Storefront MRR
```

and call it `TravelHub Revenue`.

A consolidated metric must combine like-for-like semantics.

For example, if supported:

```text
Expected TravelHub Revenue
=
Expected Marketplace Revenue
+
Contracted/Expected Storefront SaaS Revenue
```

and:

```text
Collected TravelHub Revenue
=
Collected Marketplace Revenue
+
Collected Storefront SaaS Revenue
```

If Storefront collected revenue is currently not provable, then consolidated collected revenue is also not fully provable.

Say so explicitly.

---

# 12. STOREFRONT SaaS PRICING — UPDATED AUTHORITY

Current authoritative list price:

```text
Premium Storefront = ₼199/month
```

This remains only a LIST PRICE.

Future pricing must support:

```text
discount
promotion
custom/negotiated price
free period
introductory price
campaign pricing
```

Pricing chain:

```text
List Price
↓
Commercial Adjustment
↓
Contracted Price
↓
Billed
↓
Collected
↓
Credits / Refunds
↓
Net Collected Revenue
```

Therefore:

```text
ACTIVE subscriptions × ₼199
```

must NOT be labeled actual paid Storefront Revenue.

It may only be labeled something like:

```text
List-price MRR
```

if that metric is intentionally retained.

---

# 13. STOREFRONT SaaS CURRENT DATA LIMITATION

Audit whether current Storefront subscription data can prove:

```text
contracted price
invoice
payment
partial payment
payment status
refund
credit
renewal charge
```

Return YES/NO for each.

If no billing/payment ledger exists, explicitly state:

```text
Storefront SaaS Collected Revenue = NOT PROVABLE
```

Do not implement a major billing subsystem in this remediation.

Assign the implementation to the appropriate later stage (currently Stage I unless roadmap reconciliation changes it).

---

# 14. REVENUE MIX

TravelHub management requires channel/business-model contribution.

Target concepts:

```text
Expected Revenue Mix
Marketplace %
Storefront SaaS %

Collected Revenue Mix
Marketplace %
Storefront SaaS %

Net Revenue Mix
Marketplace %
Storefront SaaS %
```

Only show a mix when all compared components use compatible financial semantics.

If Storefront paid revenue is not provable, do not display a misleading collected mix.

---

# 15. NET REVENUE RECONCILIATION

Audit exactly what current `Net Revenue` subtracts.

Return:

```text
Current formula:
Included deductions:
Excluded deductions:
Refund handling:
Marketplace semantics:
Storefront semantics:
Accounting-grade? YES / NO
```

Define target:

```text
Marketplace Net Revenue
Storefront SaaS Net Revenue
TravelHub Total Net Revenue
```

Do not invent deductions.

If direct costs/fees are not modeled, state what `Net Revenue` can and cannot mean.

---

# 16. COMMAND CENTER CURRENCY PRESENTATION

Audit every current Command Center monetary KPI and return:

| Section | KPI | Backend currency | API currency | Frontend symbol | Correct? |
|---|---|---|---|---|---|

At minimum inspect:

```text
Executive
Operational monetary values
Financial
Marketplace
Catalog opportunity values
Channel Health
Needs Attention
AI Decision Feed
```

Current PLATFORM target:

```text
all aggregated monetary management KPIs → AZN
```

No cosmetic-only symbol replacement.

---

# 17. HARDCODED AI / INSIGHT MONETARY VALUES

Previous architecture found hardcoded logic such as:

```text
potential = n × 15 AZN/week
```

Do not fix Stage G behavior here unless necessary.

But verify that any current monetary labels are at least semantically/currency documented.

Keep full AI Decision Feed reconciliation assigned to Stage G.

---

# 18. BUSINESS PERSPECTIVE SEPARATION REMAINS MANDATORY

Preserve the accepted ADR:

```text
Marketplace Business
≠ Storefront SaaS
≠ Storefront Commerce
```

Required:

```text
Marketplace GMV excludes Storefront Commerce
Storefront Commerce Volume is partner commerce
Storefront SaaS Revenue is TravelHub subscription business
```

Do not undo this separation while fixing consolidated financial metrics.

---

# 19. UI ARCHITECTURE REMAINS MANDATORY

Preserve:

```text
Command Center
→ one TravelHub overview + distinct business blocks

Analytics
→ TravelHub | Marketplace | Storefront SaaS

Financial
→ Consolidated | Marketplace | Storefront SaaS

Orders / Bookings
→ channel filters

Partners
→ Marketplace relationship + Storefront SaaS relationship

Catalog
→ publication/distribution channel

Needs Attention / Decision Feed
→ unified TravelHub-owned queue/feed with business-domain identity
```

Do not implement broad UI redesign in this remediation unless explicitly required for a semantic P0/P1 correction.

---

# 20. UPDATE THE ADR — MANDATORY

Update:

```text
docs/architecture/ADR-PLATFORM-BUSINESS-PERSPECTIVE-SEPARATION.md
```

It must now include the accepted decisions:

```text
Platform Reporting Currency = AZN
Storefront Billing Currency = AZN
Premium current List Price = ₼199/month
old $199 assumption superseded
dynamic partner pricing remains required
partial/installment customer payments exist
sold value ≠ collected amount
GMV semantics must distinguish sold/contracted vs paid where necessary
Expected Revenue ≠ Collected Revenue ≠ Outstanding Revenue
Revenue ≠ Profit
Storefront Commerce ≠ Marketplace GMV
```

Mark superseded statements clearly rather than leaving contradictory authority.

---

# 21. UPDATE ROADMAP RECONCILIATION — MANDATORY

The canonical roadmap must record this remediation and its implications.

Preserve history and existing numbering.

At minimum ensure roadmap contains/statuses:

```text
Decision Intelligence Architecture Reconciliation
Stage A — Granular RBAC Remediation — COMPLETE
Stage B — Decision Signal Foundation — COMPLETE
Stage B.1 — Business Model & Financial Metrics Authority Reconciliation — VERDICT B / REMEDIATION
Stage B.1 Remediation — current stage
Stage C — Needs Attention → Decision Queue
Stage D — Deterministic WHY
Stage E — Impact & Severity
Stage F — Action Routing
Stage G — AI Decision Feed Reconciliation
Stage H — Executive/Operational/Financial Decision Enrichment + semantic UI correction
Stage I — Storefront SaaS billing/revenue implementation
Stage J — Full Regression/Security/Evidence Closure
```

Also record the accepted AZN / partial-payment / revenue-state decisions so future stages cannot regress them.

Do not destructively renumber historical steps.

---

# 22. STAGE OWNERSHIP AFTER REMEDIATION

Produce a concrete implementation ownership matrix.

For each required correction assign:

```text
NOW — B.1 Remediation
Stage H
Stage I
other explicit stage
```

At minimum classify:

```text
Executive Revenue label/formula
Executive Net Revenue
Revenue Mix
GMV sold-vs-paid semantics
AZN normalization/presentation
priceUsd migration
₼199 seed/list price
dynamic pricing model
Storefront billing ledger
partial payment commission recognition
Expected/Collected/Outstanding Revenue
Financial tabs/perspectives
```

Do not defer everything vaguely.

---

# 23. REQUIRED CURRENT-NUMBERS TRACE

Use the actual current Command Center data path to explain the observed anomaly.

A recently observed example was approximately:

```text
GMV          2,274
Revenue     11,069
Net Revenue 10,510
Orders          40
```

The exact current dataset may differ by the time this stage runs.

Trace the current values from:

```text
DB rows
→ backend aggregation
→ DTO
→ frontend card
```

Explain why Revenue can currently exceed GMV.

Determine whether this is:

```text
formula bug
semantic-label bug
scope mismatch
currency mismatch
Storefront list-price contamination
period mismatch
combination of the above
```

Do not rely only on arithmetic guesses.

---

# 24. REQUIRED PARTIAL-PAYMENT EXAMPLE

Using actual repository entities/statuses, demonstrate one realistic scenario:

```text
Order total
Amount paid
Amount outstanding
Marketplace commission entitlement
Expected TravelHub Revenue
Collected TravelHub Revenue
Outstanding TravelHub Revenue
refund behavior
```

If the recognition policy is unresolved, show the ambiguity rather than inventing a number.

This example becomes an acceptance case for later implementation.

---

# 25. TESTABLE FINANCIAL INVARIANTS

Define invariants that later implementation/tests must enforce.

Candidates include:

```text
Collected GMV <= qualifying sold/contracted GMV
for non-overpayment cases

Outstanding amount >= 0

Collected Revenue <= Expected Revenue
where policy defines expected as total entitlement

Storefront Commerce Volume does not increase Marketplace GMV

Storefront partner sales do not directly increase TravelHub Revenue

List-price MRR is not Collected Revenue

Consolidated Revenue only sums semantically compatible revenue states

All PLATFORM aggregated monetary KPIs use AZN reporting currency
```

Adapt them to actual business rules.

Do not encode invalid assumptions merely for mathematical neatness.

---

# 26. NO BROAD BILLING IMPLEMENTATION

Do NOT:

```text
build full Storefront invoicing
integrate payment provider
implement discount engine
implement full accounting ledger
redesign entire Command Center
implement Stage C Decision Queue
implement WHY
implement severity
implement business actions
```

This is reconciliation/remediation.

Small code/schema/seed corrections are allowed only where required to establish the new canonical AZN/list-price authority safely and without creating half-built billing infrastructure.

---

# 27. REQUIRED DELIVERABLE A — FINAL METRIC DICTIONARY

Return canonical definitions for:

```text
Marketplace Booked/Contracted GMV
Marketplace Collected/Paid GMV
Marketplace Outstanding GMV

Storefront Commerce Volume

Expected Marketplace Revenue
Collected Marketplace Revenue
Outstanding Marketplace Revenue
Marketplace Net Revenue

Storefront List-price MRR
Storefront Contracted MRR
Storefront Billed Revenue
Storefront Collected Revenue
Storefront Net Revenue

TravelHub Expected Revenue
TravelHub Collected Revenue
TravelHub Net Revenue

Profit — current status/provability
```

If a metric is not currently implementable/provable, say so.

---

# 28. REQUIRED DELIVERABLE B — CURRENCY MATRIX

Return:

| Domain/Metric | Source Currency | Reporting Currency | Current | Target |
|---|---|---|---|---|

Explicitly include:

```text
Marketplace orders
Marketplace GMV
Marketplace commission
Storefront list price
Storefront MRR
Storefront Revenue
TravelHub consolidated Revenue
Net Revenue
Decision Signal monetary evidence
```

---

# 29. REQUIRED DELIVERABLE C — REVENUE STATE MACHINE / FLOW

Provide the approved conceptual flow for Marketplace and Storefront SaaS separately.

Marketplace example:

```text
Sold/Confirmed Value
↓
Customer Payment Schedule
↓
Partial / Full Collections
↓
Commission Entitlement
↓
Expected / Collected / Outstanding TravelHub Revenue
↓
Refund/Reversal
↓
Net Revenue
```

Storefront SaaS:

```text
₼199 List Price
↓
Discount / Promo / Negotiated Price
↓
Contracted Price
↓
Billed
↓
Collected
↓
Credits / Refunds
↓
Net Revenue
```

Mark unsupported current stages.

---

# 30. REQUIRED DELIVERABLE D — SEMANTIC CONFLICT CLOSURE

For every original B.1 conflict plus new findings return:

```text
Finding
Root cause
Canonical decision
Implementation owner/stage
Current status
Evidence
```

Original conflicts:

```text
Storefront Revenue list-price problem
Executive Revenue mislabeled
Revenue Mix absent
i18n inconsistency
```

New mandatory topics:

```text
AZN authority
₼199 list price
partial payments
GMV sold-vs-paid semantics
Expected vs Collected vs Outstanding Revenue
Revenue vs Profit
```

---

# 31. REQUIRED DELIVERABLE E — ADR / ROADMAP EVIDENCE

Return exact files updated and summarize additions.

Confirm:

```text
ADR contains new authority: YES/NO
Roadmap contains B.1 remediation: YES/NO
Stage B marked COMPLETE: YES/NO
Future H/I responsibilities updated: YES/NO
Old $199 authority superseded: YES/NO
```

---

# 32. REQUIRED DELIVERABLE F — IMPLEMENTATION PLAN

Provide the exact next implementation work after this remediation.

Do not automatically execute it.

For each item:

```text
Stage
Scope
Dependencies
Likely files/modules
Acceptance criteria
Financial invariants
Regression risks
```

The plan must account for Stage C–J sequencing.

If financial implementation must occur before Stage C/D/E for correctness, state and justify the dependency explicitly rather than preserving the old order blindly.

---

# 33. VERDICT

Return exactly one:

## VERDICT A — B.1 REMEDIATION COMPLETE

Only if:

- AZN is authoritative for PLATFORM reporting;
- Premium Storefront list price is canonically ₼199/month;
- old `$199` authority is superseded;
- dynamic pricing remains architecturally supported;
- GMV semantics under partial payments are explicitly defined;
- Marketplace revenue ownership is explicit;
- Expected / Collected / Outstanding Revenue are distinguished;
- revenue recognition ambiguity is resolved or explicitly elevated as a blocking business-policy decision;
- Revenue ≠ Profit is documented;
- Storefront collected revenue limitations are explicit;
- Executive semantic defects have clear implementation ownership;
- currency inconsistencies are fully audited;
- ADR is updated;
- roadmap is updated;
- no contradictory financial authority remains.

## VERDICT B — REMEDIATION STILL REQUIRED

Use if any important semantic contradiction remains.

## VERDICT C — BLOCKED ON BUSINESS POLICY

Use if the repository cannot determine a required financial policy, especially partial-payment commission/revenue recognition, and an explicit business decision is required before implementation.

State the exact decision required.

---

# 34. STOP

After this remediation:

**STOP.**

Do not proceed automatically to Stage C, H or I.

Return the complete remediation report, updated ADR/roadmap evidence, and any explicit business-policy question requiring approval.
