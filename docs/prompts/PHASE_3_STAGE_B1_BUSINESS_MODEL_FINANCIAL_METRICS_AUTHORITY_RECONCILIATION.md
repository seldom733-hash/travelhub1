# PHASE 3 — COMMAND CENTER / PLATFORM BUSINESS ARCHITECTURE
## STAGE B.1 — TRAVELHUB BUSINESS MODEL, ECONOMIC SCOPE & FINANCIAL METRICS AUTHORITY RECONCILIATION

### STATUS
**Architecture / reconciliation stage. May run in parallel with Stage B — Decision Signal Foundation.**

This stage does **not** depend on the implementation result of Stage B. It must not modify, block, or reinterpret the Decision Signal foundation while Stage B is running.

The purpose is to formalize already accepted product/business decisions so they cannot be lost in later implementation.

**Do not begin broad implementation in this stage. Audit, reconcile, document, update canonical architecture/roadmap where appropriate, and return a verdict.**

---

# 1. MANDATORY ARCHITECTURE DECISION

The following distinction is **ACCEPTED and MANDATORY**:

```text
MARKETPLACE BUSINESS
≠
STOREFRONT SaaS
≠
STOREFRONT COMMERCE
```

These are three different economic perspectives and must not be conflated in metrics, UI, analytics, revenue calculations, Decision Intelligence, documentation, APIs, DTO naming, or future implementation.

## 1.1 Marketplace Business
TravelHub operates a marketplace and participates economically through marketplace monetization.

Typical concepts:
```text
Marketplace GMV
Marketplace Orders
Marketplace Bookings
Marketplace Customers
Marketplace Conversion
Marketplace Commission Revenue
Marketplace Refunds / deductions
Marketplace Net Revenue
```

## 1.2 Storefront SaaS
TravelHub provides Storefront as a SaaS product to partners.

This is TravelHub's SaaS business.

Typical concepts:
```text
Active Storefronts
Paid Subscriptions
MRR
ARR
ARPU
Trial → Paid
Churn
List Price
Contracted Price
Discounts / Promotions
Billed Amount
Collected Amount
Credits / Refunds
Storefront SaaS Revenue
Storefront SaaS Net Revenue
Product Adoption
Platform Health
```

## 1.3 Storefront Commerce
This is commerce performed by partners using their Storefront.

Typical concepts:
```text
Storefront Commerce Volume
Partner Orders
Partner Bookings
Partner Customers
Partner Conversion
Partner Product Sales
```

This is primarily the **partner's business**, not TravelHub Marketplace business.

Therefore:

```text
Storefront Commerce Volume
≠ Marketplace GMV
≠ TravelHub Revenue
```

TravelHub may use aggregated Storefront Commerce metrics for SaaS product health, adoption, capacity, platform reliability and strategic analysis, but must not present partner commerce as TravelHub marketplace sales.

---

# 2. GMV AUTHORITY — MANDATORY

The primary TravelHub Marketplace GMV must represent only transactions belonging to the TravelHub Marketplace business.

Required semantic rule:

```text
Marketplace GMV
=
qualifying Marketplace transaction volume
```

It must NOT automatically include Storefront partner sales.

If TravelHub needs an aggregate measure of commerce facilitated by its infrastructure, define a separate metric, for example:

```text
Platform Commerce Volume
or
Total Commerce Facilitated
```

Conceptually:

```text
Platform Commerce Volume
=
Marketplace GMV
+
Storefront Commerce Volume
```

only if both components have compatible transaction semantics and currency/period normalization.

Do not call this combined metric simply `GMV` without an explicit qualifier.

Audit current HEAD for any place where Marketplace and Storefront transaction volume are summed into generic GMV.

---

# 3. TRAVELHUB REVENUE TREE — MANDATORY

TravelHub Revenue represents TravelHub-owned revenue streams.

Conceptually:

```text
TravelHub Total Revenue
=
Marketplace Revenue
+
Storefront SaaS Revenue
+
future TravelHub-owned revenue streams
```

Current major components:

```text
Marketplace Revenue
→ primarily marketplace commission / other marketplace-owned fees

Storefront SaaS Revenue
→ subscription/billing revenue earned by TravelHub
```

Storefront partner commerce does NOT become TravelHub Revenue.

Required:

```text
Storefront Commerce Volume
≠ Storefront SaaS Revenue
```

---

# 4. NET REVENUE TREE — MANDATORY

Do not maintain a single opaque `Net Revenue` calculation if multiple business models contribute to it.

Target semantic structure:

```text
Marketplace Revenue
− applicable direct revenue deductions
= Marketplace Net Revenue

Storefront SaaS Revenue
− applicable SaaS revenue deductions
= Storefront SaaS Net Revenue

TravelHub Total Net Revenue
=
Marketplace Net Revenue
+
Storefront SaaS Net Revenue
+
future net revenue streams
```

This stage must determine the current repository definition of `Net Revenue`, its deductions and whether it is accounting-grade, operational, or approximate.

Do not invent accounting policy.

If current data cannot prove a component, label it explicitly.

---

# 5. REVENUE RECOGNITION / CASH SEMANTICS

Audit and formally distinguish as applicable:

```text
Expected / Contracted
Accrued / Earned
Invoiced / Billed
Paid / Collected
Refunded / Credited
Recognized Revenue
Net Revenue
MRR
ARR
```

Do not use these terms interchangeably.

For Marketplace, determine exactly when commission becomes:

```text
expected
earned
collected
refunded/reversed
```

For Storefront SaaS, determine what the current data model can actually prove.

If the repository cannot prove actual payment, do NOT label:

```text
ACTIVE subscriptions × plan price
```

as collected or paid revenue.

---

# 6. STOREFRONT PREMIUM PRICE — ACCEPTED DECISION

For current architecture:

```text
Premium Storefront current list price = $199/month
```

This is the **current canonical LIST PRICE**, not a universal actual charge.

The architecture must support future dynamic pricing.

Conceptual pricing chain:

```text
List Price ($199 currently)
↓
Discount / Promotion / Negotiated Pricing / Free Period
↓
Contracted Price
↓
Invoice / Charge
↓
Paid / Collected Amount
↓
Credits / Refunds
↓
Recognized / Net Revenue
```

Never assume:

```text
ACTIVE subscriptions × $199
=
actual Storefront Revenue
```

At most this may represent list-price subscription value / list-price MRR if explicitly named.

---

# 7. FUTURE PRICING FLEXIBILITY — MANDATORY

The future Storefront subscription model must allow partner-specific commercial conditions such as:

```text
percentage discount
fixed discount
custom / negotiated price
promotion
free period
introductory price
time-limited campaign
```

Do not implement the billing engine now.

But architecture must not hardcode the assumption that every Premium partner pays $199.

A future pricing/discount record should be capable of carrying concepts such as:

```text
type
value
reason
validFrom
validUntil
approvedBy
campaign/reference
```

Exact schema is deferred until implementation.

---

# 8. REVENUE MIX — MANDATORY MANAGEMENT VIEW

TravelHub management must be able to understand which business model produces revenue.

Required conceptual metrics:

```text
TravelHub Total Revenue

Marketplace Revenue
Marketplace Revenue Share %

Storefront SaaS Revenue
Storefront SaaS Revenue Share %
```

and analogously:

```text
TravelHub Total Net Revenue

Marketplace Net Revenue
Marketplace Net Revenue Share %

Storefront SaaS Net Revenue
Storefront SaaS Net Revenue Share %
```

These must not depend on Storefront Commerce Volume.

---

# 9. COMMAND CENTER INFORMATION ARCHITECTURE — ACCEPTED DECISION

Do **NOT** create a global top-level pattern:

```text
[ General ] [ Marketplace ] [ Storefront ]
```

for every Platform page.

Command Center must remain a **single TravelHub management overview**.

Target conceptual structure:

```text
TRAVELHUB OVERVIEW
├ Marketplace GMV
├ TravelHub Revenue
├ TravelHub Net Revenue
└ other company-level decision metrics

MARKETPLACE BUSINESS
├ GMV
├ Orders / Bookings
├ Customers
├ Conversion
└ Commission Revenue

STOREFRONT SaaS
├ Active Storefronts
├ Paid Subscriptions
├ MRR / ARR
├ Churn
├ Subscription Revenue
└ Adoption

PLATFORM / CHANNEL HEALTH
├ Marketplace health
└ Storefront platform health

NEEDS ATTENTION
└ unified prioritized TravelHub-owned operational issues

DECISION FEED
└ WHAT → WHY → IMPACT → ACTION
```

The Command Center must show the state of TravelHub without forcing a director to switch business tabs to understand the company.

---

# 10. ANALYTICS INFORMATION ARCHITECTURE — ACCEPTED DECISION

Analytics should support explicit business perspectives:

```text
[ TravelHub ] [ Marketplace ] [ Storefront SaaS ]
```

## TravelHub
Corporate/consolidated analytics:
```text
Total Revenue
Total Net Revenue
Revenue Mix
Business contribution
Growth
cross-business management metrics
```

## Marketplace
Deep marketplace analytics:
```text
GMV
Orders
Bookings
Customers
AOV
Conversion
Commission
Refunds
Partners
Categories
Products
Funnels
Cohorts
```

## Storefront SaaS
TravelHub SaaS analytics:
```text
MRR
ARR
Subscriptions
Trial → Paid
Churn
Retention
ARPU
Discounts
Expansion / contraction
Product adoption
Active selling storefronts
aggregated Storefront Commerce Volume where useful
```

Detailed commercial analytics of an individual Storefront partner belong primarily to the PARTNER workspace, not the TravelHub PLATFORM management perspective.

---

# 11. FINANCIAL INFORMATION ARCHITECTURE — ACCEPTED DECISION

Financial should support:

```text
[ Consolidated ] [ Marketplace ] [ Storefront SaaS ]
```

## Consolidated
```text
TravelHub Revenue
TravelHub Net Revenue
Revenue Mix
Marketplace contribution
Storefront SaaS contribution
```

## Marketplace
```text
Marketplace GMV
Commission Revenue
Take Rate
Payments
Refunds
Payouts
Direct deductions
Marketplace Net Revenue
```

## Storefront SaaS
As data capabilities mature:
```text
List-price MRR
Contracted MRR
Billed Revenue
Collected Revenue
Discounts
Credits
Refunds
Storefront SaaS Net Revenue
ARR
ARPU
Past Due
```

Do not fabricate unavailable accounting metrics.

---

# 12. ORDERS AND BOOKINGS — ACCEPTED UX PATTERN

Do not create separate duplicated operational pages solely by business model.

Use channel/business-origin filtering where the domain model supports both:

```text
Channel:
All
Marketplace
Storefront
```

The authoritative Order/Booking remains one operational entity according to existing domain architecture.

Surface origin/channel badges where useful.

---

# 13. PARTNERS — ACCEPTED RELATIONSHIP MODEL

Do not classify a partner as exclusively:

```text
Marketplace OR Storefront
```

A partner may have both relationships:

```text
Marketplace Seller = YES
Storefront Subscriber = YES
```

Partner views should conceptually support independent relationship dimensions:

```text
Marketplace Relationship
→ GMV / orders / commission / products / marketplace performance

Storefront SaaS Relationship
→ plan / subscription / contracted pricing / renewal / SaaS health
```

Do not duplicate the partner entity.

---

# 14. CATALOG — ACCEPTED UX PATTERN

Marketplace vs Storefront is generally a publication/distribution dimension, not necessarily two independent catalogs.

Prefer concepts such as:

```text
Published to Marketplace
Published to Storefront
```

and appropriate filters rather than duplicating the entire Catalog UI.

Audit actual current domain capabilities before future implementation.

---

# 15. SALES — BUSINESS MODEL DISTINCTION

Where Sales Center represents TravelHub's own B2B acquisition, distinguish pipelines where the commercial processes differ.

Conceptually:

```text
Marketplace Partner Acquisition
Lead → Qualification → Onboarding → Catalog → Activation → First Sale
```

versus:

```text
Storefront SaaS Sales
Lead → Demo → Trial → Negotiation → Subscription → Renewal
```

Do not force them into identical funnels if business semantics differ.

---

# 16. NEEDS ATTENTION / DECISION INTELLIGENCE OWNERSHIP RULE

A critical filter for Storefront-originated signals in the PLATFORM Command Center is:

> Is this condition materially within TravelHub's responsibility or ability to act?

Example:

```text
Partner's own sales dropped 20%
→ primarily PARTNER workspace
→ not automatically a TravelHub operational alert
```

But:

```text
Storefront checkout failures across 47 partners
→ TravelHub platform responsibility
→ PLATFORM Command Center signal
```

Similarly:

```text
Storefront downtime
subscription past due
platform payment failure
partner SaaS churn risk
low product adoption
system-wide checkout degradation
```

may be legitimate TravelHub signals.

Do not turn every partner business problem into a PLATFORM Decision Signal.

---

# 17. STOREFRONT COMMERCE DATA — PLATFORM USAGE RULE

TravelHub may use Storefront Commerce data where it serves a legitimate platform/SaaS management purpose, especially aggregated:

```text
Commerce Volume
orders processed
active selling storefronts
checkout success
adoption
growth
platform capacity
product value
```

But detailed partner business analytics belong primarily to that partner's workspace.

The PLATFORM workspace must not become a mirror of each Storefront customer's private management dashboard without a clear TravelHub operational/product/commercial purpose.

---

# 18. TERMINOLOGY — MANDATORY

Prefer explicit terms:

```text
Marketplace Business
Storefront SaaS
Storefront Commerce
Marketplace GMV
Storefront Commerce Volume
TravelHub Revenue
Marketplace Revenue
Storefront SaaS Revenue
TravelHub Net Revenue
Marketplace Net Revenue
Storefront SaaS Net Revenue
```

Avoid ambiguous generic labels such as:

```text
Storefront GMV
Revenue
Net Revenue
```

when context does not make ownership unmistakable.

---

# 19. AUDIT CURRENT HEAD

Audit the actual repository for semantic violations.

At minimum search:

```text
GMV calculations
Executive Summary
Financial section
Channel Health
Analytics
Revenue
Net Revenue
Storefront GMV
Storefront Revenue
SubscriptionPlan.priceUsd
ACTIVE subscription calculations
Marketplace commission
refund/deduction calculations
DTO/API labels
i18n labels
frontend cards/charts
documentation
```

For each finding classify:

```text
CORRECT
AMBIGUOUS
SEMANTIC CONFLICT
DATA NOT PROVABLE
FUTURE CAPABILITY
```

Do not modify broad implementation in this stage.

---

# 20. REQUIRED METRIC AUTHORITY MATRIX

Produce:

| Metric | Business owner | Definition | Source of truth | Current implementation | Status |
|---|---|---|---|---|---|

At minimum include:

```text
Marketplace GMV
Storefront Commerce Volume
Platform Commerce Volume (if adopted)
Marketplace Revenue
Storefront SaaS Revenue
TravelHub Total Revenue
Marketplace Net Revenue
Storefront SaaS Net Revenue
TravelHub Total Net Revenue
MRR
ARR
List-price MRR
Contracted MRR
Billed Revenue
Collected Revenue
Refunds/Credits
```

Use `NOT CURRENTLY PROVABLE` where appropriate.

---

# 21. REQUIRED UI RESPONSIBILITY MATRIX

Produce:

| Platform area | Required business separation |
|---|---|
| Command Center | single overview + business blocks |
| Analytics | TravelHub / Marketplace / Storefront SaaS |
| Financial | Consolidated / Marketplace / Storefront SaaS |
| Orders | channel filter |
| Bookings | channel filter |
| Partners | relationship dimensions |
| Catalog | publication channel |
| Sales | business-model-specific pipelines where applicable |
| Needs Attention | unified TravelHub-owned decision queue |
| Decision Feed | unified feed + explicit business-domain badge |

Compare this target with current HEAD.

---

# 22. REQUIRED FINANCIAL SEMANTICS REPORT

Return exact current definitions/formulas for:

```text
GMV
Revenue
Net Revenue
Marketplace Revenue
Storefront Revenue
```

Then state the target canonical definitions.

Explicitly answer:

```text
Does current GMV include Storefront Commerce? YES / NO
Should Marketplace GMV include Storefront Commerce? NO
Is current Storefront Revenue actual paid revenue? YES / NO / NOT PROVABLE
Is $199 a list price or universal actual price? LIST PRICE
Can partner-specific pricing exist in target architecture? YES
```

---

# 23. ROADMAP RECONCILIATION REQUIREMENT

This decision must not remain only in this report.

Audit the current canonical implementation roadmap and identify all Phase 3 work already completed or planned but missing from it, including at least:

```text
Platform vs Partner Workspace Architecture Reconciliation
Command Center Design / V3 evolution where absent
Server-side Section Authority work
RBAC remediation / CI closure stages where absent
Command Center Decision Intelligence Architecture Reconciliation
Stage A — Granular RBAC Remediation
Stage B — Decision Signal Foundation (currently running / actual status)
Stage B.1 — this reconciliation
Stage C — Needs Attention → Decision Queue
Stage D — Deterministic WHY Attribution
Stage E — Impact & Severity
Stage F — Action Routing
Stage G — AI Decision Feed Reconciliation
Stage H — section decision enrichment
Stage I — Storefront financial/billing implementation scope, subject to B.1 findings
Stage J — full regression/security/evidence closure
```

Preserve existing canonical numbering/history. Do not destructively renumber completed roadmap steps.

Prepare an **additive roadmap reconciliation proposal** showing:

```text
existing roadmap location
missing stage/decision
proposed insertion
status
dependencies
evidence/report
```

If this task has authority to update the roadmap file safely, make the additive update. Otherwise produce the exact patch/proposed content for the next roadmap update.

Do not erase historical steps or overwrite prior verdicts.

---

# 24. ACCEPTED DECISION / ADR REQUIREMENT

Create or update a durable architecture decision record/document with the decision:

```text
ADR — PLATFORM BUSINESS PERSPECTIVE SEPARATION
Status: ACCEPTED / MANDATORY
```

It must capture:

```text
Marketplace Business ≠ Storefront SaaS ≠ Storefront Commerce
Marketplace GMV excludes Storefront Commerce
Storefront Commerce Volume is not TravelHub Revenue
TravelHub Revenue is composed from TravelHub-owned revenue streams
Revenue/Net Revenue must expose business-model contribution
$199/month is current Premium LIST PRICE only
dynamic discounts/promotions/negotiated pricing must remain possible
Command Center uses one company overview + business blocks
Analytics uses TravelHub / Marketplace / Storefront SaaS perspectives
Financial uses Consolidated / Marketplace / Storefront SaaS perspectives
partner-level Storefront commerce analytics primarily belong to PARTNER workspace
TravelHub PLATFORM signals require TravelHub relevance/actionability
```

This ADR becomes an execution constraint for future Phase 3 stages.

---

# 25. NO BROAD IMPLEMENTATION

Do NOT in this stage:

```text
build a billing engine
implement discounts
create invoices
integrate payment provider
rewrite Command Center UI
rewrite Analytics UI
rewrite Financial UI
migrate Decision Signals
implement WHY/IMPACT/ACTION
change Stage B implementation while it is running
```

Small corrections to documentation/roadmap/ADR are expected.

Code changes should be limited to truly necessary semantic corrections only if they are safe, isolated, and proven. Otherwise report them as later implementation work.

---

# 26. REQUIRED DELIVERABLES

Return:

### A. Current-State Economic Audit
Actual formulas, sources, DTOs and UI semantics.

### B. Metric Authority Matrix
As specified above.

### C. Financial Revenue Tree
Canonical TravelHub / Marketplace / Storefront SaaS structure.

### D. UI Responsibility Matrix
Current vs target.

### E. Semantic Conflicts
Each with:
```text
location
current behavior
why incorrect/ambiguous
target behavior
implementation stage
```

### F. ADR
`PLATFORM BUSINESS PERSPECTIVE SEPARATION — ACCEPTED / MANDATORY`

### G. Roadmap Reconciliation
All missing completed/planned stages, not only B.1.

### H. Implementation Impact
Which later stages/files will need changes.

---

# 27. VERDICT

Return exactly one:

## VERDICT A — BUSINESS & FINANCIAL AUTHORITY RECONCILED
Use only if:
- Marketplace / Storefront SaaS / Storefront Commerce boundaries are explicit;
- GMV ownership is explicit;
- Revenue and Net Revenue trees are explicit;
- $199 is correctly classified as list price;
- dynamic pricing is preserved architecturally;
- UI responsibility patterns are explicit;
- metric authority matrix is complete;
- ADR is durable;
- roadmap reconciliation is produced;
- no blocking semantic ambiguity remains.

## VERDICT B — REMEDIATION REQUIRED
Important semantic/authority questions remain unresolved.

## VERDICT C — BLOCKED
Repository/data model prevents reliable reconciliation; state exact blocker.

---

# 28. STOP

After completing the reconciliation:

**STOP.**

Do not implement billing, financial UI redesign, Decision Intelligence enrichment, or Stage C.

Stage B may continue independently.

Return the full report, ADR/roadmap changes or proposed patches, and wait for review.
