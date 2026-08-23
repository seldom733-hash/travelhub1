# PHASE 3 --- COMMAND CENTER DECISION INTELLIGENCE ARCHITECTURE RECONCILIATION

## STATUS

**Architecture / Audit / Reconciliation only.**

Do **NOT** begin broad implementation before completing the required
audit, architecture decisions, gap matrix, and final verdict.

------------------------------------------------------------------------

# 1. OBJECTIVE

TravelHub Command Center must not be merely a dashboard with KPI cards.

Its purpose is to operate as the platform's **decision and operational
control center**.

The target decision loop is:

``` text
WHAT
↓
WHY
↓
IMPACT
↓
ACTION
```

For every meaningful business signal, the Command Center should
progressively answer:

1.  **WHAT --- What is happening?**
2.  **WHY --- Why is it happening?**
3.  **IMPACT --- How important is it? What is affected?**
4.  **ACTION --- Does somebody need to act? What exactly should be
    done?**

The current Command Center V3 contains useful sections and KPIs, but it
is not yet proven that the full decision loop exists consistently.

This task must audit the **actual current repository implementation**,
identify gaps, reconcile Command Center with Analytics, and define the
architecture required to evolve Command Center into a true Decision
Intelligence / Operational Command Center.

------------------------------------------------------------------------

# 2. NON-NEGOTIABLE PRINCIPLE

Do not treat the following as equivalent:

``` text
Dashboard
Analytics
Command Center
```

They have different responsibilities.

## Dashboard-style reporting

Primarily answers:

``` text
WHAT happened?
```

Examples:

-   GMV
-   Revenue
-   Orders
-   Conversion
-   Pending bookings
-   Failed payments

## Analytics

Supports exploration and deeper investigation:

``` text
How did the metric change?
Which segment caused it?
How does it compare?
What patterns exist?
```

Analytics may provide:

-   segmentation;
-   trends;
-   cohorts;
-   drill-down;
-   period comparison;
-   dimensions;
-   reports;
-   exploratory analysis.

## Command Center

Must convert business state into decision-ready information:

``` text
WHAT
↓
WHY
↓
IMPACT
↓
ACTION
```

Command Center is allowed to have its own **decision-oriented read
models and orchestration logic**.

It must NOT, however, silently redefine canonical business metrics that
already have an authoritative source.

------------------------------------------------------------------------

# 3. IMPORTANT ARCHITECTURAL CLARIFICATION

Do NOT assume that direct Command Center read models automatically mean
that Command Center has become a second Analytics engine.

That conclusion is too simplistic.

Command Center may legitimately own logic such as:

``` text
booking requires attention
revenue is at risk
partner response is outside SLA
service is high-demand but constrained
signal severity is HIGH
recommended action is escalation
```

These are Command Center concerns.

However, Command Center must NOT independently invent conflicting
definitions of canonical metrics such as:

``` text
GMV
Revenue
Orders
Bookings
Customers
Conversion
Commission
Refunds
Currency normalization
Period semantics
```

Where canonical definitions already exist, reuse or compose them.

The target relationship is conceptually:

``` text
                 TRAVELHUB DATA
                       │
          ┌────────────┴────────────┐
          │                         │
     Analytics /                Domain Read
 Canonical Metrics                Models
          │                         │
          └────────────┬────────────┘
                       │
                DECISION LOGIC
                       │
        Signal / Reason / Impact / Action
                       │
                       ▼
                COMMAND CENTER
```

Do not create unnecessary microservices.

At the current stage, Decision Intelligence may remain an
application/read-model layer inside the appropriate backend module if
that is architecturally cleaner.

------------------------------------------------------------------------

# 4. AUDIT THE CURRENT COMMAND CENTER

Audit the actual current `/app/command-center` implementation.

Do not rely only on old documentation or commit messages.

Trace the current data flow from:

``` text
Database
↓
Backend services / read models
↓
DTO / API
↓
RBAC filtering
↓
Frontend loader
↓
Section rendering
↓
User-visible Command Center
```

Verify the currently implemented sections.

Expected current V3 sections include at least:

1.  Executive Summary
2.  Operational Activity
3.  Financial
4.  Marketplace
5.  Catalog Health
6.  Channel Health
7.  Needs Attention
8.  AI Decision Feed

If the repository differs, report the actual implementation.

------------------------------------------------------------------------

# 5. WHAT → WHY → IMPACT → ACTION AUDIT

For **every current Command Center section**, determine which parts of
the decision loop are actually implemented.

Create a matrix:

  Section   WHAT   WHY   IMPACT   ACTION   Evidence   Current maturity
  --------- ------ ----- -------- -------- ---------- ------------------

Use only:

``` text
FULL
PARTIAL
MISSING
```

For every PARTIAL or MISSING result, explain exactly why.

Do not count a KPI card as WHY, IMPACT, or ACTION merely because it
contains a comparison value.

------------------------------------------------------------------------

# 6. WHAT CONTRACT

Define what a decision-ready WHAT signal must contain.

A raw KPI such as:

``` text
Pending confirmations: 211
```

is insufficient by itself.

A stronger Command Center signal may be:

``` text
211 bookings await confirmation
+37 vs previous comparable period
18 exceeded SLA
₼24,800 GMV affected
```

Determine which elements should be mandatory vs optional.

Audit whether current sections expose enough context for the user to
understand:

-   current state;
-   direction/change;
-   comparison baseline;
-   affected objects;
-   time context;
-   channel/context;
-   abnormality.

Do not force every KPI to become an alert.

Separate:

``` text
informational KPI
business signal
attention item
critical decision signal
```

------------------------------------------------------------------------

# 7. WHY CONTRACT

Command Center must explain the principal drivers of important signals.

Example:

``` text
WHAT
Marketplace conversion decreased 12%.

WHY
Primary drivers:
- Accommodation conversion: -18%
- Payment failures: +21%
- Partner X: 32 failed booking attempts
```

WHY must be **evidence-based**.

Do NOT allow an LLM to invent plausible explanations.

Preferred flow:

``` text
canonical data
↓
deterministic attribution / analytical calculation
↓
evidence
↓
human-readable explanation
```

AI may summarize or phrase evidence.

AI must not manufacture causality unsupported by data.

Define:

-   driver attribution;
-   reason ranking;
-   confidence;
-   evidence references;
-   fallback behavior when no reliable cause is known.

The system must be able to say:

``` text
Cause not reliably determined
```

rather than fabricate WHY.

------------------------------------------------------------------------

# 8. IMPACT CONTRACT

Define a formal impact model.

Not every anomaly deserves equal priority.

Example:

``` text
30 services without sales
```

may be less important than:

``` text
3 failed high-value payments
```

Impact may include:

``` text
GMV at risk
Revenue at risk
Orders affected
Bookings affected
Customers affected
Partners affected
SLA breaches
Operational urgency
Strategic importance
```

Design an extensible impact structure.

Evaluate whether a severity model is required:

``` text
LOW
MEDIUM
HIGH
CRITICAL
```

If yes, define the conceptual scoring inputs.

Do NOT hardcode arbitrary thresholds without documenting their business
meaning.

A possible conceptual model is:

``` text
Impact Score =
Financial Impact
+ Customer Impact
+ Partner Impact
+ SLA / Time Urgency
+ Operational Risk
+ Strategic Importance
```

This is illustrative only.

Audit existing code before defining the final model.

------------------------------------------------------------------------

# 9. ACTION CONTRACT

ACTION is a core Command Center responsibility.

The system should not stop at:

``` text
There is a problem.
```

It should determine whether action is required and, where possible,
provide a concrete next step.

Examples:

``` text
Review bookings
Contact partner
Retry payment
Assign operator
Escalate booking
Open incident
Review restrictions
Open Analytics
Open Booking Center
Open Finance
```

Actions must route into the authoritative operational center.

Command Center should orchestrate.

It should NOT duplicate full Booking Center, Order Center, CRM, Finance,
Catalog, or Analytics workflows.

Define action categories such as:

``` text
NAVIGATE
REVIEW
ASSIGN
CONTACT
ESCALATE
RETRY
RESOLVE
INVESTIGATE
OPEN_ANALYTICS
```

Determine which actions may be executed directly from Command Center and
which should deep-link to the owning domain.

Security permissions must be enforced server-side for actionable
operations.

------------------------------------------------------------------------

# 10. DECISION SIGNAL MODEL

Evaluate introducing a normalized Decision Signal contract.

Conceptual example:

``` ts
DecisionSignal {
  id
  type
  category
  severity

  what

  reasons[]

  impact {
    gmvAtRisk?
    revenueAtRisk?
    ordersAffected?
    bookingsAffected?
    customersAffected?
    partnersAffected?
    slaBreaches?
  }

  actions[]

  evidence[]

  confidence?
  detectedAt
  updatedAt
}
```

Do NOT copy this blindly.

Inspect existing DTOs/types first.

Reuse existing concepts where possible.

Report whether a new normalized contract is justified.

If yes, provide the recommended final shape and ownership.

------------------------------------------------------------------------

# 11. NEEDS ATTENTION --- ARCHITECTURAL REVIEW

Audit the current Needs Attention section.

Determine whether it is merely a KPI group or already behaves as an
operational queue.

The target concept should be evaluated as:

``` text
Needs Attention
=
prioritized operational decision queue
```

Potential representation:

``` text
CRITICAL
HIGH
MEDIUM
LOW
```

Example:

``` text
HIGH

18 bookings exceeded confirmation SLA
₼24,800 GMV at risk
16 customers affected
3 partners responsible

ACTION
Review bookings
Contact partners
Escalate critical cases
```

Determine whether Needs Attention should become the primary destination
for actionable signals.

Define its relationship with:

-   Operational Activity;
-   Financial;
-   Catalog Health;
-   Channel Health;
-   AI Decision Feed.

Avoid duplicate alerts appearing independently without shared identity.

------------------------------------------------------------------------

# 12. AI DECISION FEED --- ARCHITECTURAL REVIEW

Audit the current AI Decision Feed.

Determine whether it is actually:

``` text
Decision Feed
```

or currently closer to:

``` text
Insight Feed
```

Evaluate a taxonomy such as:

### ALERT

Requires or may require intervention.

### OPPORTUNITY

Potential business improvement.

### INSIGHT

Important observation; immediate action may not be required.

Every decision-grade item should be capable of exposing:

``` text
WHAT
WHY
IMPACT
ACTION
```

where applicable.

AI must not be the authority for financial calculations, severity facts,
or causal attribution.

AI may:

-   summarize;
-   explain;
-   prioritize within deterministic constraints;
-   produce readable descriptions;
-   help formulate recommended actions from approved action templates.

Document the trust boundary explicitly.

------------------------------------------------------------------------

# 13. CATALOG HEALTH REVIEW

Audit whether Catalog Health currently only reports:

``` text
Published
Archived
Without Sales
High Demand
Low Conversion
Categories
```

or provides decision intelligence.

Evaluate target scenarios such as:

``` text
WHAT
12 high-demand services have constrained availability.

WHY
8 have inventory below threshold.
4 are blocked by commercial restrictions.

IMPACT
Estimated GMV opportunity at risk: ₼X.

ACTION
Review availability.
Contact affected partners.
Review restrictions.
```

Do not invent unavailable metrics.

Identify what current data can support today and what requires future
capabilities.

------------------------------------------------------------------------

# 14. CHANNEL HEALTH REVIEW

Audit Channel Health after the recent Marketplace / Storefront changes.

It must preserve the distinction:

``` text
Marketplace GMV
Storefront GMV

Marketplace Revenue
Storefront Revenue
```

Command Center should eventually interpret channel movement rather than
only display numbers.

Example target:

``` text
WHAT
Storefront GMV increased 22%.

WHY
Growth was concentrated in Accommodation and Tours.

IMPACT
Storefront share increased from 19% to 24%.

ACTION
Evaluate Premium upsell for high-volume eligible partners.
```

Again, do not fabricate reasons or opportunities.

Use only evidence supported by current data.

------------------------------------------------------------------------

# 15. EXECUTIVE / OPERATIONAL / FINANCIAL / MARKETPLACE REVIEW

Audit the original four sections as well.

Do not assume they are complete because they existed earlier.

For each section determine:

-   what is informational;
-   what is decision-relevant;
-   what needs WHY;
-   what needs IMPACT;
-   what needs ACTION;
-   what should remain a simple KPI;
-   what should generate a Decision Signal.

Avoid turning every metric into noise.

Command Center must prioritize.

------------------------------------------------------------------------

# 16. COMMAND CENTER ↔ ANALYTICS BOUNDARY

Produce an explicit responsibility matrix.

At minimum classify:

  Capability   Command Center   Analytics   Shared/Canonical
  ------------ ---------------- ----------- ------------------

Include:

-   GMV definition
-   Revenue definition
-   Orders
-   Bookings
-   Customers
-   Conversion
-   Period resolver
-   Currency normalization
-   Commission
-   Refunds
-   trend analysis
-   segmentation
-   driver attribution
-   anomaly detection
-   severity
-   impact scoring
-   recommended action
-   operational queue
-   drill-down
-   exploratory reporting

The architecture must prevent metric drift while allowing Command
Center-specific decision logic.

------------------------------------------------------------------------

# 17. RBAC REGRESSION AUDIT --- MANDATORY

Audit current section-level authorization.

A previous architecture established:

``` text
analytics.read
```

as page access, with granular permissions such as:

``` text
dashboard.executive.read
dashboard.operational.read
dashboard.financial.read
dashboard.marketplace.read
```

Recent V3 work may have mapped multiple/all sections back to:

``` text
analytics.read
```

Verify the current HEAD.

Do not assume.

If granular server-side section authority was weakened, classify it as
an architectural/security regression.

Design the correct permission model for all current 8 sections.

Likely conceptual expansion:

``` text
dashboard.executive.read
dashboard.operational.read
dashboard.financial.read
dashboard.marketplace.read
dashboard.catalog.read
dashboard.channels.read
dashboard.attention.read
dashboard.insights.read
```

Names must follow existing repository conventions.

Do not implement until the audit is complete.

Preserve the principle:

``` text
frontend hidden ≠ authorization
```

Server-side filtering/denial remains authoritative.

------------------------------------------------------------------------

# 18. STOREFRONT REVENUE / SUBSCRIPTION AUDIT --- MANDATORY

Audit the current Storefront subscription foundation.

A possible inconsistency has been observed around Premium pricing:

``` text
$99
vs
$199
```

There may also be arithmetic/documentation evidence corresponding to one
value while comments/schema correspond to another.

Find the actual sources.

Report:

``` text
Plan authority:
Seed value:
Schema/comment value:
Dashboard assumption:
Documentation value:
Actual calculation:
```

There must ultimately be one authoritative price source.

Do not hardcode plan price into Dashboard logic.

Also audit whether:

``` text
ACTIVE subscription × plan price
```

is being treated as actual Storefront Revenue.

Distinguish carefully between concepts such as:

``` text
MRR
contracted subscription value
invoiced revenue
paid revenue
recognized revenue
```

If the current model lacks an authoritative payment/charge ledger for
Storefront subscriptions, say so explicitly.

Do not claim actual paid revenue if the data model cannot prove payment.

Do not create a major billing subsystem during this architecture task.

Provide the required future architecture instead.

------------------------------------------------------------------------

# 19. EVIDENCE MODEL

Decision-grade claims should be traceable.

Evaluate an evidence contract that can identify:

``` text
metric
period
comparison period
source/read model
affected entity IDs
driver calculation
timestamp
confidence
```

The user should not necessarily see raw SQL or internal implementation
details.

But the system should be able to explain why a signal exists.

This is especially important for:

``` text
WHY
IMPACT
AI-generated wording
severity
recommended actions
```

------------------------------------------------------------------------

# 20. NOISE CONTROL

A Command Center that surfaces everything becomes unusable.

Define principles for:

-   deduplication;
-   suppression;
-   cooldown;
-   signal expiry;
-   acknowledgement;
-   resolved state;
-   severity escalation;
-   recurring incidents;
-   grouping related signals.

Example:

50 bookings from the same partner suffering the same SLA incident may be
better represented as:

``` text
1 parent signal
+
50 affected bookings
```

rather than 50 unrelated alerts.

Do not overengineer implementation now, but establish the architecture.

------------------------------------------------------------------------

# 21. SIGNAL LIFECYCLE

Evaluate whether decision signals need lifecycle states such as:

``` text
OPEN
ACKNOWLEDGED
IN_PROGRESS
RESOLVED
DISMISSED
EXPIRED
```

Determine whether signals should be:

-   calculated dynamically;
-   persisted;
-   hybrid.

Discuss tradeoffs.

For operational actions and acknowledgement history, persistence may be
necessary.

For purely informational insights, dynamic calculation may be
sufficient.

Recommend the appropriate model for TravelHub.

------------------------------------------------------------------------

# 22. ACTION OWNERSHIP

Determine how actions should connect to business domains.

Examples:

``` text
Booking issue
→ Booking Center

Order issue
→ Order Center

Payment/refund issue
→ Finance

Partner issue
→ CRM / Partner management

Catalog issue
→ Catalog Center

Deep investigation
→ Analytics
```

Command Center must remain the orchestration surface.

It must not become a duplicate CRUD/workflow implementation for every
domain.

------------------------------------------------------------------------

# 23. ROLE-SPECIFIC DECISION EXPERIENCE

Audit how the decision model interacts with existing role architecture.

Roles may include:

``` text
ADMIN
DIRECTOR
ANALYST
MARKETER
FINANCE
MODERATOR
SALES_MANAGER
OPERATOR
```

Different roles should not necessarily see the same signals, impact, or
actions.

Examples:

-   Director may see strategic revenue impact.
-   Finance may see payment/refund risks.
-   Operator may see booking SLA actions.
-   Marketer may see conversion/opportunity signals.
-   Analyst may investigate but not execute operational actions.

Do not redesign the full role system.

Define how Decision Signals should respect existing permissions and role
defaults.

Admin-granted permissions remain authoritative.

------------------------------------------------------------------------

# 24. DO NOT DO DURING THIS TASK

Do NOT:

-   redesign the visual Command Center;
-   replace the existing 8-section structure without strong evidence;
-   create a second Command Center;
-   create a second Analytics engine;
-   create a new microservice without necessity;
-   rewrite unrelated modules;
-   change Booking/Order/Finance workflows;
-   add speculative AI causality;
-   hardcode revenue/commission/subscription values;
-   weaken RBAC;
-   seed fake values merely to make UI look correct;
-   implement large-scale changes before architecture approval.

Small diagnostic tests or temporary local probes are allowed if required
to establish facts.

Do not commit disposable debug artifacts.

------------------------------------------------------------------------

# 25. REQUIRED DELIVERABLE A --- CURRENT STATE AUDIT

Provide:

``` text
Current route:
Current sections:
Current backend authority:
Current API:
Current RBAC:
Current decision logic:
Current AI logic:
Current action routing:
```

Then provide the full:

  Section   WHAT   WHY   IMPACT   ACTION   Evidence   Maturity
  --------- ------ ----- -------- -------- ---------- ----------

------------------------------------------------------------------------

# 26. REQUIRED DELIVERABLE B --- GAP ANALYSIS

For each section report:

``` text
Existing:
Missing:
Business consequence:
Required architecture:
Can current data support it? YES / PARTIAL / NO
```

Do not confuse missing UI with missing backend/data capability.

------------------------------------------------------------------------

# 27. REQUIRED DELIVERABLE C --- TARGET DECISION ARCHITECTURE

Provide the recommended architecture for:

``` text
Decision Signal
WHAT
WHY
IMPACT
ACTION
Evidence
Severity
Lifecycle
Action routing
RBAC
AI trust boundary
```

Include ownership boundaries.

------------------------------------------------------------------------

# 28. REQUIRED DELIVERABLE D --- COMMAND CENTER VS ANALYTICS MATRIX

Produce the explicit responsibility matrix required in Section 16.

Identify any current duplicated metric authority.

For each duplication classify:

``` text
SAFE
RISK
CONFLICT
```

------------------------------------------------------------------------

# 29. REQUIRED DELIVERABLE E --- RBAC FINDINGS

Report exact current section permission mappings.

Compare them with the previous granular model found in repository
history/current architecture.

Return:

``` text
Regression: YES / NO
Security impact:
Required remediation:
```

Do not hide this finding inside general notes.

------------------------------------------------------------------------

# 30. REQUIRED DELIVERABLE F --- STOREFRONT REVENUE FINDINGS

Return:

``` text
Canonical Premium price:
Source of truth:
Conflicting values:
Current Storefront Revenue formula:
Does it represent actual paid revenue? YES / NO / NOT PROVABLE
Required correction:
Future billing/payment requirement:
```

------------------------------------------------------------------------

# 31. REQUIRED DELIVERABLE G --- IMPLEMENTATION ROADMAP

After architecture is established, propose staged implementation.

Example only:

``` text
Stage A — Architecture contracts
Stage B — RBAC remediation
Stage C — Decision Signal foundation
Stage D — Needs Attention operational queue
Stage E — WHY attribution
Stage F — Impact/severity
Stage G — Action routing
Stage H — AI Decision Feed reconciliation
Stage I — section-by-section rollout
Stage J — regression / security / evidence closure
```

Choose stages based on actual repository findings.

Each stage must define:

``` text
Scope
Dependencies
Files/modules likely affected
Acceptance criteria
Regression risks
STOP condition
```

Do NOT execute the roadmap during this task.

------------------------------------------------------------------------

# 32. REQUIRED DELIVERABLE H --- FINAL VERDICT

Return one verdict:

## VERDICT A --- READY FOR IMPLEMENTATION

Use only if:

-   current architecture is understood;
-   WHAT/WHY/IMPACT/ACTION contracts are defined;
-   Analytics boundary is clear;
-   RBAC remediation path is clear;
-   Storefront revenue semantics are resolved architecturally;
-   no blocking ambiguity remains.

## VERDICT B --- ARCHITECTURE REMEDIATION REQUIRED

Use if important architectural questions remain unresolved.

## VERDICT C --- BLOCKED

Use if the current repository/data model cannot support the required
design without a prior foundational change.

Explain the exact blockers.

------------------------------------------------------------------------

# 33. SUCCESS CRITERIA

This task succeeds only if we can answer:

``` text
What exactly is TravelHub Command Center?

What makes it different from Analytics?

What is the canonical structure of a decision signal?

How does it answer WHAT?

How does it establish WHY without hallucination?

How does it calculate IMPACT?

How does it decide ACTION?

How are actions routed to operational centers?

How are signals prioritized?

How does RBAC control sections, signals and actions?

What belongs to Needs Attention?

What belongs to AI Decision Feed?

Which current sections are only KPI dashboards?

Which existing data can support Decision Intelligence today?

Which capabilities require future data foundations?
```

The final architecture must allow TravelHub Command Center to evolve
from:

``` text
KPI Dashboard
```

into:

``` text
Business State
↓
Signal Detection
↓
WHAT
↓
WHY
↓
IMPACT
↓
ACTION
↓
Operational Execution
```

without turning Command Center into a duplicate Analytics, Booking,
Finance, CRM, or Catalog system.

------------------------------------------------------------------------

# STOP

After completing the audit, architecture reconciliation, gap analysis,
responsibility matrix, and implementation roadmap:

**STOP.**

Do not begin broad implementation.

Wait for architecture approval before proceeding to the first
implementation stage.
