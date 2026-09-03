# PHASE 3 --- STEP 3.5E --- PARTNER CRM ANALYTICS READ MODEL

## GLOBAL ANALYTICS / PLATFORM AUTHORITY AUDIT → SHARED CRM ANALYTICS READ MODEL → PARTNER-SCOPED CONSUMER

### ONE ANALYTICS ENGINE / PLATFORM + PARTNER SCOPE AUTHORITY / ENTITLEMENT-AWARE CRM ANALYTICS / RUNTIME CLOSURE

**Все ответы разработчика, implementation notes, evidence, отчёты и
roadmap updates --- строго на русском.**

------------------------------------------------------------------------

# 1. CURRENT BASELINE

Закрыты:

``` text
PHASE 3 — STEP 3.5.3 — FULLY CLOSED
PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION — FULLY CLOSED
PHASE 3 — STEP 3.5B — CUSTOMER IDENTITY ↔ PARTNER CRM RELATIONSHIP — FULLY CLOSED
PHASE 3 — STEP 3.5C — PARTNER CRM LEAD & DIRECT CUSTOMER INTAKE — FULLY CLOSED
PHASE 3 — STEP 3.5D — PARTNER CRM ENTITLEMENT & CAPABILITY MODEL — FULLY CLOSED
```

Latest accepted baseline:

``` text
Step 3.5D Final HEAD: c73d2e6
origin/master: c73d2e6
worktree: clean

Backend: 1247/1247 PASS
Frontend: 243/243 PASS
Skipped: 0

Schema: 0
Migration: 0
```

Canonical roadmap exact NEXT:

``` text
PHASE 3 — STEP 3.5E —
PARTNER CRM ANALYTICS READ MODEL
```

Название canonical stage сохраняется.

**Но название Step 3.5E НЕ является разрешением создавать отдельный
Partner Analytics Engine.**

------------------------------------------------------------------------

# 2. MANDATORY ARCHITECTURAL ORDER

Step 3.5E выполнять строго в следующем порядке:

``` text
GATE 1
GLOBAL ANALYTICS / PLATFORM AUTHORITY AUDIT
        ↓
GATE 2
SHARED CRM ANALYTICS DOMAIN + METRIC AUTHORITY
        ↓
GATE 3
SHARED CRM ANALYTICS READ MODEL
        ↓
GATE 4
SCOPE AUTHORITY
   ┌────┴────┐
PLATFORM   PARTNER
   │          │
cross-      current
partner     partner only
   └────┬────┘
        ↓
GATE 5
PARTNER-SCOPED CRM ANALYTICS CONSUMER
        ↓
GATE 6
ENTITLEMENT + PERMISSION ENFORCEMENT
        ↓
GATE 7
RUNTIME / SECURITY / RECONCILIATION CLOSURE
```

Forbidden sequence:

``` text
❌ build Partner-specific analytics engine
→ later duplicate it for Platform
```

------------------------------------------------------------------------

# 3. CANONICAL TARGET ARCHITECTURE

Target conceptual architecture:

``` text
                       ANALYTICS ENGINE
                              │
                    CRM ANALYTICS DOMAIN
                              │
                  CRM ANALYTICS READ MODEL
                              │
             ┌────────────────┴────────────────┐
             │                                 │
          PLATFORM                          PARTNER
             │                                 │
authorized cross-partner               current Partner only
CRM analytics scope                    CRM analytics scope
             │                                 │
Platform CRM consumer             Partner CRM consumer
                                            │
                                   entitlement/capability
                                      Basic / Pro
```

The exact implementation must follow repository architecture.

Do not create these classes/modules literally unless justified by
existing patterns.

------------------------------------------------------------------------

# 4. WHY PLATFORM AUTHORITY IS AUDITED FIRST

Platform is the broader business scope.

Partner is a restricted scope.

Therefore the design must prove first:

``` text
what Analytics Engine already exists
what Platform analytics authority already exists
what shared metric infrastructure already exists
how tenant/Partner scope is represented
```

Only then may Partner CRM analytics be implemented.

The Partner consumer must be a scoped consumer of shared
analytics/read-model authority, not the architectural root.

------------------------------------------------------------------------

# 5. PRIMARY GOAL

Create or qualify a canonical CRM Analytics read-model architecture that
supports scope separation:

``` text
same metric semantics
same source authority
same date/time semantics
same aggregation rules
same read-model infrastructure
```

with different authorization scopes:

``` text
PLATFORM
→ authorized cross-partner/global CRM scope

PARTNER
→ authenticated current Partner only
```

and Partner entitlement filtering where required.

------------------------------------------------------------------------

# 6. CRITICAL BOUNDARIES

Preserve:

``` text
Platform Analytics ≠ Partner Analytics scope
but
Platform Analytics Engine ≠ separate engine from Partner Analytics Engine
```

Correct:

``` text
shared analytics infrastructure
+ shared CRM metric definitions
+ scope-aware projections/queries
+ separate authorization/consumer surfaces
```

Also:

``` text
CRM Analytics
≠ General Business Analytics
≠ Workforce / Employee Performance Management
```

------------------------------------------------------------------------

# 7. STEP 3.50 MUST REMAIN SEPARATE

Do not implement:

``` text
employee performance score
department performance score
productivity score
quality score
SLA score
employee ranking
department ranking
performance leaderboard
```

Those belong to:

``` text
Step 3.50 — Workforce / Employee Performance Management
```

Preserve:

``` text
Assignment ≠ Action ≠ Outcome
```

Manager grouping in CRM analytics does not imply employee performance
attribution.

------------------------------------------------------------------------

# 8. REPO-FIRST --- MANDATORY

Before any production change inspect:

``` text
canonical roadmap Step 3.5E
architecture docs
ADRs

Analytics modules
Analytics services
Analytics controllers
Analytics DTOs
Analytics read models
Analytics repositories
Command Center analytics
Platform dashboard
Platform analytics
Partner analytics
existing aggregation helpers
comparison/date-range utilities
timezone utilities

Customer
Partner
PartnerCustomerRelation
PartnerCustomerRelationHistory
CrmActivity
Operational Notes

Orders
Bookings
Payments
Refunds

PartnerStorefront
StorefrontSubscription
entitlementStatus
getCrmTier()

workspace context
tenant/Partner scope
RBAC
PermissionsGuard
frontend analytics/navigation
tests
migrations
```

Do not begin implementation before inventory.

------------------------------------------------------------------------

# 9. REPOSITORY BASELINE

Run:

``` bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -150
git diff
git diff --check
```

Capture:

``` text
Starting HEAD
origin/master
HEAD == origin/master

c73d2e6 reachable
43e0e69 reachable
bd6aee3 reachable
737de35 reachable
27b2653 reachable
e4b38a3 reachable

worktree
```

Unexpected changes → STOP.

------------------------------------------------------------------------

# 10. ROADMAP AUTHORITY

Read exact canonical Step 3.5E.

Report:

``` text
exact scope
dependencies
acceptance criteria
explicit exclusions
exact NEXT
```

If roadmap explicitly limits the UI consumer to Partner CRM, preserve
that.

This does **not** justify duplicating analytics infrastructure.

------------------------------------------------------------------------

# 11. GATE 1 --- GLOBAL ANALYTICS INVENTORY

Before coding produce:

  -------------------------------------------------------------------------------------
  Area         Existing         Scope      Data       API        Read model Reusable?
               module/service              source                           
  ------------ ---------------- ---------- ---------- ---------- ---------- -----------
  Platform                                                                  
  Analytics                                                                 

  Platform                                                                  
  Command                                                                   
  Center                                                                    

  Partner                                                                   
  Analytics                                                                 

  CRM                                                                       
  analytics                                                                 

  Orders                                                                    
  analytics                                                                 

  Bookings                                                                  
  analytics                                                                 

  Payments                                                                  
  analytics                                                                 

  Customer                                                                  
  aggregates                                                                
  -------------------------------------------------------------------------------------

Must explicitly answer:

``` text
Is there already one Analytics Engine?
Where is Platform authority implemented?
How is Partner scope applied?
What can CRM Analytics reuse?
What must not be duplicated?
```

------------------------------------------------------------------------

# 12. DUPLICATION STOP-GATE

If implementation plan proposes a new Partner-only:

``` text
analytics engine
date-range engine
comparison engine
metric registry
aggregation framework
generic KPI framework
```

while an equivalent Platform/shared mechanism already exists:

**STOP.**

Refactor/reuse shared infrastructure instead, unless concrete
incompatibility is documented.

------------------------------------------------------------------------

# 13. SHARED CRM ANALYTICS DOMAIN

Define CRM-specific metric semantics independently of UI consumer.

Conceptually:

``` text
CRM metric definition
        ↓
source authority
        ↓
timestamp authority
        ↓
aggregation semantics
        ↓
scope predicate
        ↓
result
```

Scope is an input to shared metric execution, not duplicated metric
logic.

------------------------------------------------------------------------

# 14. GLOBAL CUSTOMER vs PARTNER RELATIONSHIP

Step 3.5B authority remains:

``` text
Customer
= global canonical CRM identity

PartnerCustomerRelation
= Partner-scoped relationship
```

Therefore:

``` text
global Customer count
≠ Partner CRM customer population
```

Partner CRM metrics must derive population from canonical Partner
relationship authority.

------------------------------------------------------------------------

# 15. SCOPE MODEL

Every CRM metric must declare scope behavior.

Required matrix:

  Metric   Platform scope   Partner scope   Scope key/source
  -------- ---------------- --------------- ------------------
                                            

Platform:

``` text
authorized global/cross-partner aggregation
```

Partner:

``` text
current authenticated Partner only
```

No frontend filtering of unrestricted Platform data.

------------------------------------------------------------------------

# 16. PLATFORM AUTHORITY

Determine actual Platform permission(s).

Platform CRM analytics must never depend on:

``` text
PartnerStorefront
Storefront subscription
Marketplace Basic
Storefront Pro
```

Partner entitlement does not control Platform authority.

------------------------------------------------------------------------

# 17. PARTNER AUTHORITY

Partner Workspace analytics must derive Partner scope server-side from
authenticated context.

Do not trust arbitrary:

``` text
partnerId query
partnerId body
partnerId localStorage
```

without canonical validation.

------------------------------------------------------------------------

# 18. STEP 3.5D ENTITLEMENT AUTHORITY

Reuse actual Step 3.5D resolution:

``` text
ACTIVE storefront + ACTIVE entitlement
→ PRO

otherwise
→ BASIC
```

according to `getCrmTier()` or actual canonical resolver.

Do not reimplement plan logic in analytics.

------------------------------------------------------------------------

# 19. BASIC vs PRO ANALYTICS

Roadmap/repository must determine whether CRM analytics is:

``` text
PRO-only
```

or:

``` text
Basic CRM analytics subset
+
Pro full CRM analytics
```

or another canonical model.

Do not assume.

Required matrix:

  ------------------------------------------------------------------------------
  CRM                  Basic           Pro   Implemented Permission   Server
  analytics                                                           gate
  capability                                                          
  ------------ ------------- ------------- ------------- ------------ ----------
                                                                      

  ------------------------------------------------------------------------------

------------------------------------------------------------------------

# 20. ENTITLEMENT ≠ PERMISSION

Mandatory:

``` text
Basic + accidental Pro analytics permission
→ DENY Pro analytics

Pro + permission
→ ALLOW

Pro + missing permission
→ DENY
```

where capability is Pro-only.

------------------------------------------------------------------------

# 21. METRIC CATALOG --- REPO-FIRST

Build exact catalog from roadmap.

Potential metrics only if supported:

``` text
Total CRM Customers
New Customers
Leads
Prospects
Active Customers
Churned Customers
Repeat Customers
New Relationships

Lead → Prospect conversion
Prospect → Active conversion
Lead → Active conversion

Customers by Lifecycle
Customers by Source
Customers by Manager

Commercially Active Customers
Orders per CRM Customer
Bookings per CRM Customer
GMV / Revenue attributed to CRM customers
```

Do not implement all automatically.

------------------------------------------------------------------------

# 22. REQUIRED METRIC DEFINITION MATRIX

For every implemented metric:

  -----------------------------------------------------------------------------------------
  Metric   Business     Numerator   Denominator   Source   Timestamp   Scope    Null/zero
           definition                                                           behavior
  -------- ------------ ----------- ------------- -------- ----------- -------- -----------
                                                                                

  -----------------------------------------------------------------------------------------

No metric without explicit definition.

------------------------------------------------------------------------

# 23. SOURCE AUTHORITY

Examples only where actual schema confirms:

``` text
Customer identity
→ Customer

relationship lifecycle
→ PartnerCustomerRelation.lifecycle

lead source
→ PartnerCustomerRelation.leadSource

lifecycle transition
→ PartnerCustomerRelationHistory

Orders
→ Orders domain

Bookings
→ Bookings domain

Payments
→ Payments domain
```

CRM read model is derived authority, never owner of these states.

------------------------------------------------------------------------

# 24. CURRENT SNAPSHOT vs PERIOD TRANSITION

Must distinguish:

``` text
current ACTIVE relationships
```

from:

``` text
relationships that became ACTIVE during selected period
```

Do not answer both from current PCR.lifecycle.

Use history when transition semantics require it.

------------------------------------------------------------------------

# 25. REPEAT CUSTOMER

If implemented, define exactly.

Possible definitions are not interchangeable:

``` text
2+ Orders lifetime
2+ completed Orders
2+ Bookings
2+ completed Bookings
2+ commercial transactions during period
```

Roadmap/business definition must decide.

------------------------------------------------------------------------

# 26. CONVERSION

For each conversion define:

``` text
numerator
denominator
cohort
time window
transition semantics
zero denominator
```

Do not silently mix:

``` text
created-during-period cohort
```

with:

``` text
all historical relationships that transitioned during period
```

------------------------------------------------------------------------

# 27. DATE / TIME AUTHORITY

Each metric must specify canonical timestamp.

Potential fields:

``` text
Customer.createdAt
PartnerCustomerRelation.createdAt
PCR history timestamp
Order.createdAt
Booking.createdAt
Payment.paidAt
Refund.processedAt
```

No universal `createdAt` assumption.

------------------------------------------------------------------------

# 28. SHARED DATE-RANGE ENGINE

Reuse existing Analytics date/time infrastructure where available.

Required:

``` text
dateFrom
dateTo
timezone
inclusive/exclusive boundaries
comparison period
```

Platform and Partner CRM metrics must not use different period
mathematics.

------------------------------------------------------------------------

# 29. COMPARISON

If in canonical scope:

``` text
current period
previous equivalent period
absolute delta
percentage delta
```

Define:

``` text
previous = 0
current = 0
null data
```

No NaN/Infinity.

------------------------------------------------------------------------

# 30. SERVER-SIDE AGGREGATION

Forbidden:

``` text
download all Customers/PCR/Orders
→ calculate KPIs in browser
```

Required:

``` text
server-side aggregation/read model
```

------------------------------------------------------------------------

# 31. READ-MODEL STRATEGY

Repo-first choose:

``` text
live aggregate query
existing analytics read model
materialized projection
cached aggregate
hybrid
```

The phrase "Read Model" does not automatically require a new DB table.

Initial preference:

``` text
reuse existing analytics infrastructure
```

------------------------------------------------------------------------

# 32. IF PERSISTED READ MODEL IS NEEDED

Before migration document:

``` text
why shared/live aggregate is insufficient
source of truth
read-model keys
scope key
dedupe
idempotency
rebuild
backfill
batching
concurrency
failure recovery
reconciliation
indexes
migration safety
```

No migration until this justification exists.

------------------------------------------------------------------------

# 33. REBUILD AUTHORITY

If persisted:

``` text
operational/CRM source remains truth
read model is disposable/rebuildable
```

Rebuild must not modify:

``` text
Customer
PCR
PCRHistory
Order
Booking
Payment
Refund
```

------------------------------------------------------------------------

# 34. CROSS-DOMAIN LOOKUPS

No invalid Prisma relations.

No N+1.

Use:

``` text
collect IDs
→ dedupe
→ batch lookup
→ map
→ aggregate
```

when relations cross schema/domain boundaries.

------------------------------------------------------------------------

# 35. PARTNER ATTRIBUTION

Preserve:

``` text
Order.sellerPartnerId
```

as canonical seller attribution where applicable.

Partner A CRM analytics must not count Partner B commercial records.

------------------------------------------------------------------------

# 36. PAYMENT CUSTOMER OWNERSHIP

Preserve accepted authority:

``` text
Payment.customerId
OR
Payment.orderId → Order.customerId
```

Do not regress to direct customerId only.

------------------------------------------------------------------------

# 37. REFUNDS

If monetary CRM metrics use Refunds:

use canonical processed/status/timestamp authority.

Do not subtract pending/rejected refunds incorrectly.

------------------------------------------------------------------------

# 38. CURRENCY

Never sum unrelated currencies blindly.

Audit existing Analytics currency semantics.

Use:

``` text
reporting currency
canonical FX normalization
or per-currency breakdown
```

according to actual architecture.

No invented FX.

------------------------------------------------------------------------

# 39. SOURCE BREAKDOWN

If in scope, use canonical `leadSource`.

Verify actual enum.

Previously accepted sources include:

``` text
DIRECT
PHONE
OFFICE
EMAIL
MARKETPLACE
REFERRAL
OTHER
```

Persist enum neutral; localize presentation.

------------------------------------------------------------------------

# 40. MANAGER BREAKDOWN

Allowed CRM metric:

``` text
relationships assigned to manager
```

Not allowed interpretation:

``` text
manager produced these outcomes
```

unless future Performance Management attribution proves it.

------------------------------------------------------------------------

# 41. API DESIGN

Reuse existing analytics API conventions.

Required:

``` text
typed DTO
validated date range
validated timezone
scope authority
entitlement authority
permission authority
stable metric contract
server-side filters
```

No raw Prisma response.

------------------------------------------------------------------------

# 42. SHARED SERVICE vs CONSUMER ENDPOINT

Prefer architecture where shared CRM metric/read-model service can be
consumed by:

``` text
Platform scope
Partner scope
```

with explicit scope input/authority.

Do not duplicate metric formulas in separate controllers/services.

------------------------------------------------------------------------

# 43. FILTERS

Only canonical filters.

Potential:

``` text
dateFrom
dateTo
lifecycle
leadSource
manager
```

All server-side.

Filter semantics must be identical across Platform/Partner for same
metric, except scope.

------------------------------------------------------------------------

# 44. FILTER COMPOSITION

Test applicable combinations:

``` text
date + lifecycle
date + source
date + manager
source + lifecycle
```

No ignored filter.

------------------------------------------------------------------------

# 45. DOUBLE-COUNTING AUDIT

Mandatory:

``` text
Customer with 3 Orders
→ customer count remains 1

PCR with multiple history rows
→ current relationship count remains 1

Order with multiple Payments
→ Order count remains 1
```

Document distinct key per metric.

------------------------------------------------------------------------

# 46. FRONTEND CONSUMER

Canonical Step is named Partner CRM Analytics Read Model.

If roadmap includes Partner UI, implement/qualify Partner consumer using
shared read model.

Do not redesign entire Analytics product.

Reuse:

``` text
KPI cards
date controls
comparison
breakdowns
loading
empty
error
```

where existing.

------------------------------------------------------------------------

# 47. PLATFORM CONSUMER POLICY

Important:

**Audit and architecture for Platform authority are mandatory.**

But do not automatically create a new Platform CRM Analytics page if
canonical Step 3.5E does not require one.

Correct outcome may be:

``` text
shared read model supports PLATFORM scope
Partner consumer implemented now
Platform consumer deferred to its canonical UI stage
```

This prevents both duplication and roadmap scope creep.

------------------------------------------------------------------------

# 48. BASIC / PRO FRONTEND

Use Step 3.5D capability authority.

No frontend plan-name checks.

Direct URL must remain protected server/page side.

------------------------------------------------------------------------

# 49. EMPTY / ZERO STATES

Handle:

``` text
no CRM relationships
no matching filters
zero denominator
no previous-period data
```

No NaN/Infinity/misleading percentage.

------------------------------------------------------------------------

# 50. I18N / FORMATTING

Required:

``` text
RU
AZ
EN
raw keys = 0
raw enums = 0
mixed locale = 0
```

Use locale-aware:

``` text
numbers
percentages
money
dates
```

Do not persist formatted presentation values.

------------------------------------------------------------------------

# 51. SECURITY MATRIX

Required:

  -------------------------------------------------------------------------------------------
  Actor        Workspace   Tier       Permission   Requested   Expected            Actual
                                                   scope                           
  ------------ ----------- ---------- ------------ ----------- ------------------- ----------
  Platform     PLATFORM    N/A        allow        Platform    ALLOW               
  authorized                                                                       

  Partner A    PARTNER     Basic      allow        A           roadmap-dependent   

  Partner A    PARTNER     Pro        allow        A           ALLOW               

  Partner A    PARTNER     Pro        deny         A           DENY                

  Partner A    PARTNER     Pro        allow        B           DENY                
  -------------------------------------------------------------------------------------------

Use actual permissions/capabilities.

------------------------------------------------------------------------

# 52. PLATFORM vs PARTNER SAME-METRIC PROOF

For at least one shared metric, where Platform consumer/API scope is
available:

prove:

``` text
same metric definition
same source authority
same timestamp semantics
different scope predicate
```

Example conceptual:

``` text
Platform total relationships
= all authorized Partner relationships

Partner A total relationships
= Partner A relationships only
```

If no Platform CRM endpoint exists in current scope, prove at
service/read-model test level instead of inventing UI/API.

------------------------------------------------------------------------

# 53. REPRESENTATIVE RUNTIME ACTORS

Use:

``` text
Platform authorized actor
Partner A — Storefront Pro
Partner B — distinct Partner
Marketplace Basic Partner if entitlement boundary applies
```

No insecure credentials in report.

------------------------------------------------------------------------

# 54. SOURCE → READ MODEL → API → UI RECONCILIATION

Mandatory chain:

``` text
source truth
→ shared read-model result
→ scoped API
→ UI
```

Do not validate only UI rendering.

------------------------------------------------------------------------

# 55. REQUIRED RECONCILIATION MATRIX

  Scope       Metric     Source truth   Read model   API   UI Result
  ----------- -------- -------------- ------------ ----- ---- --------
  PLATFORM                                                    
  Partner A                                                   
  Partner B                                                   

Platform UI may be N/A if not in canonical Step; service/API evidence
still required where available.

------------------------------------------------------------------------

# 56. A → B → A ISOLATION

Mandatory Partner runtime:

``` text
Partner A
→ Partner B
→ Partner A
```

A result unchanged.

Cross-partner leakage = 0.

------------------------------------------------------------------------

# 57. PLATFORM → PARTNER → PLATFORM ISOLATION

Where test infrastructure supports it:

``` text
Platform scope
→ Partner scope
→ Platform scope
```

No cached scope contamination.

------------------------------------------------------------------------

# 58. CACHE SAFETY

If analytics/read-model/cache uses scoped keys:

must include relevant:

``` text
workspace
Partner
date range
filters
capability/version where necessary
```

No cache entry from Platform reused as Partner result.

No Partner A result reused for B.

------------------------------------------------------------------------

# 59. QUERY / PERFORMANCE AUDIT

Inspect:

``` text
query count
N+1
unbounded loops
full scans
indexes
high-cardinality breakdown
duplicate cross-domain lookups
```

Do not optimize blindly, but no obvious O(customers × queries)
implementation.

------------------------------------------------------------------------

# 60. BACKEND TARGETED TESTS

Mandatory applicable coverage:

``` text
shared metric definition
Platform scope
Partner scope
Platform/Partner same metric semantics

Basic entitlement denial/subset
Pro entitlement allow
Pro no-permission denial

Partner A/B isolation
Platform/Partner isolation

total CRM population
lifecycle breakdown
source breakdown
new relationships
repeat customer if implemented
conversion if implemented

dateFrom/dateTo
timezone
comparison
combined filters
zero denominator
empty dataset

Order partner attribution
Payment customer ownership
no duplicate counting
cross-domain batching
cache scope safety if cache exists
```

------------------------------------------------------------------------

# 61. FRONTEND TARGETED TESTS

Where Partner UI exists:

``` text
loading
success
empty
error
date filter
breakdown filters
comparison
zero values
formatting
Basic denied/subset
Pro allowed
permission denied
RU/AZ/EN
```

No snapshot-only evidence.

------------------------------------------------------------------------

# 62. CLEAN RUNTIME

Mandatory:

``` text
backend build
frontend build
stop stale processes
restart from current checkout
hard reload
```

Stale `dist` history makes this a hard gate.

Capture runtime provenance.

------------------------------------------------------------------------

# 63. FULL REGRESSION

Run canonical:

``` text
Backend TSC
Backend build
Backend full tests
Frontend TSC
Frontend build
Frontend full tests
```

Accepted baseline:

``` text
Backend 1247/1247 PASS
Frontend 243/243 PASS
Skipped 0
```

Required:

``` text
0 FAIL
0 new skipped
```

Counts may increase.

------------------------------------------------------------------------

# 64. PREVIOUS CRM REGRESSION

Smoke:

``` text
Step 3.5.3
Step 3.5A
Step 3.5B
Step 3.5C
Step 3.5D

Customer 360
Partner 360
Partner 360 Customers
Customer 360 Partners
Partner CRM intake
Customer Activity
Partner Activity
Customer Notes
Partner Notes
Customer Payment ownership
Partner attribution
Basic/Pro entitlement
status filters
crm.col.partner
UUID leakage = 0
History remains removed
```

------------------------------------------------------------------------

# 65. SUPPLIER / PROCUREMENT EXCLUSION

Do not implement:

``` text
Supplier
Purchase
PurchaseItem
SupplierPayment
CostAllocation
COGS
Payables
```

Step 3.5E must remain extensible for future Storefront Pro procurement
analytics without implementing procurement now.

------------------------------------------------------------------------

# 66. SCHEMA POLICY

Initial preference:

``` text
schema = 0
migration = 0
```

if shared analytics infrastructure is sufficient.

If not, STOP before migration and justify minimal additive read-model
persistence.

No destructive DB operation.

No reset/reseed/truncate to manufacture evidence.

------------------------------------------------------------------------

# 67. REQUIRED FINAL ARCHITECTURE MATRIX

Final report must include:

  Layer                   Shared   Platform-specific   Partner-specific Reason
  --------------------- -------- ------------------- ------------------ --------
  Metric definitions                                                    
  Date/time semantics                                                   
  Comparison logic                                                      
  Read model                                                            
  Scope resolver                                                        
  Entitlement                                                           
  Permission                                                            
  API consumer                                                          
  UI consumer                                                           

Expected principle:

``` text
metrics/read-model infrastructure → shared
scope/authorization/consumer → context-specific
```

unless repository evidence requires otherwise.

------------------------------------------------------------------------

# 68. REQUIRED REPORT

Create:

``` text
docs/prompts/PHASE_3_STEP_3.5E_PARTNER_CRM_ANALYTICS_READ_MODEL_IMPLEMENTATION_REPORT.md
```

Strictly Russian.

Include:

``` text
repository baseline
roadmap scope

GLOBAL ANALYTICS / PLATFORM AUTHORITY AUDIT
existing Analytics Engine
Platform authority
Partner authority
reuse decisions
duplication analysis

shared CRM analytics architecture
metric catalog
metric definitions
source authority
timestamp authority
scope authority

read-model strategy
Platform scope
Partner scope
entitlement
permission

filters
comparison
timezone
currency
double-counting
query/performance
cache isolation

API
frontend consumer
Platform consumer status

security matrices
runtime reconciliation
A→B→A
Platform→Partner→Platform

i18n
tests
regressions
schema/migration
files changed
roadmap update
git evidence
verdict
exact NEXT
```

------------------------------------------------------------------------

# 69. ROADMAP UPDATE

Only after gates pass:

``` text
Step 3.5E — COMPLETE
```

Update additively.

Preserve:

``` text
Step 3.5.3
Step 3.5A
Step 3.5B
Step 3.5C
Step 3.5D
Step 3.50 Workforce / Employee Performance Management
e4b38a3 history
```

Do not rename canonical Step 3.5E merely because implementation uses
shared analytics architecture.

No silent renumbering.

Reread exact NEXT.

Do not start it.

------------------------------------------------------------------------

# 70. GIT DISCIPLINE

Before staging:

``` bash
git diff --check
git status --short
git diff
```

Stage exact files only.

Forbidden:

``` bash
git add .
git add -A
git push --force
```

After commit/push:

``` bash
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

Required:

``` text
HEAD == origin/master
worktree clean
```

------------------------------------------------------------------------

# 71. VERDICT A GATES

VERDICT A only if all applicable gates pass:

1.  repository baseline captured;
2.  c73d2e6 preserved;
3.  43e0e69 preserved;
4.  bd6aee3 preserved;
5.  737de35 preserved;
6.  27b2653 preserved;
7.  e4b38a3 preserved;
8.  exact canonical Step 3.5E read;
9.  Global Analytics inventory complete;
10. Platform Analytics authority audited first;
11. existing Analytics Engine identified;
12. duplication stop-gate passed;
13. no Partner-specific duplicate Analytics Engine;
14. shared CRM metric domain defined;
15. shared read-model strategy defined;
16. Platform is broader scope, Partner is restricted scope;
17. Partner consumer is not architectural root;
18. Customer vs PCR authority preserved;
19. Partner CRM population correct;
20. Platform vs Partner scope matrix complete;
21. Step 3.5D entitlement resolver reused;
22. no duplicated plan logic;
23. Basic/Pro analytics boundary proven from roadmap;
24. entitlement ≠ permission preserved;
25. Basic + accidental Pro permission denied where applicable;
26. Pro + permission allowed;
27. Pro without permission denied;
28. Platform authority independent of Partner subscription;
29. metric catalog complete;
30. each metric has business definition;
31. each metric has canonical source;
32. each metric has canonical timestamp;
33. lifecycle snapshot vs transition correct;
34. repeat definition explicit if implemented;
35. conversion cohort/denominator explicit if implemented;
36. shared date-range semantics reused;
37. timezone correct;
38. comparison correct if implemented;
39. server-side aggregation;
40. read-model strategy justified;
41. persisted model rebuildable/idempotent if introduced;
42. no invalid Prisma relations;
43. no N+1;
44. Order.sellerPartnerId authority preserved;
45. Payment ownership preserved;
46. Refund semantics correct if used;
47. currency semantics correct;
48. source breakdown uses canonical source;
49. manager grouping not mislabeled performance;
50. Assignment ≠ Action ≠ Outcome preserved;
51. API typed/validated;
52. Partner scope server-derived;
53. filters server-side;
54. combined filters PASS;
55. empty/zero states safe;
56. double-counting audit PASS;
57. Platform/Partner same-metric semantics proven;
58. Platform scope isolation PASS;
59. Partner A/B isolation PASS;
60. A→B→A PASS;
61. Platform→Partner→Platform PASS where applicable;
62. cache scope isolation PASS where applicable;
63. frontend uses shared API/read-model;
64. no raw frontend KPI computation;
65. no new Platform CRM page unless roadmap requires it;
66. Partner UI implemented only if canonical scope requires it;
67. RU PASS;
68. AZ PASS;
69. EN PASS;
70. raw i18n keys = 0;
71. raw enums = 0;
72. mixed locale = 0;
73. formatting correct;
74. source→read-model→API→UI reconciliation PASS;
75. query/performance audit complete;
76. schema decision justified;
77. migration decision justified;
78. no destructive DB operation;
79. backend targeted tests PASS;
80. backend full tests = 0 FAIL;
81. backend TSC PASS;
82. backend build PASS;
83. frontend targeted tests PASS;
84. frontend full tests = 0 FAIL;
85. frontend TSC PASS;
86. frontend build PASS;
87. new skipped = 0;
88. clean runtime;
89. stale processes excluded;
90. Steps 3.5.3/A/B/C/D regression PASS;
91. Activity PASS;
92. Notes PASS;
93. Intake PASS;
94. Entitlement PASS;
95. History remains removed;
96. UUID leakage = 0;
97. Step 3.50 preserved;
98. Performance Management not implemented;
99. Supplier/Procurement not implemented;
100. report created;
101. roadmap updated additively;
102. exact NEXT reread;
103. next stage not started;
104. exact staging;
105. HEAD == origin/master;
106. worktree clean;
107. P0 = 0;
108. P1 = 0;
109. no unresolved in-scope P2.

------------------------------------------------------------------------

# 72. VERDICT RULE

Success only:

``` text
VERDICT A — PHASE 3 — STEP 3.5E /
PARTNER CRM ANALYTICS READ MODEL /
GLOBAL ANALYTICS + PLATFORM AUTHORITY AUDITED /
SHARED CRM ANALYTICS READ MODEL /
PARTNER-SCOPED CONSUMER /
FULLY CLOSED
```

Otherwise:

``` text
VERDICT B — PHASE 3 — STEP 3.5E /
PARTNER CRM ANALYTICS READ MODEL /
INCOMPLETE
```

No conditional VERDICT A.

------------------------------------------------------------------------

# 73. REQUIRED FINAL RESPONSE FORMAT

``` text
VERDICT:

REPOSITORY
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
c73d2e6 preserved:
43e0e69 preserved:
bd6aee3 preserved:
737de35 preserved:
27b2653 preserved:
e4b38a3 preserved:
Worktree:

ROADMAP
Canonical Step 3.5E scope:
Dependencies:
Deferred:
Exact NEXT:

GLOBAL ANALYTICS / PLATFORM AUTHORITY AUDIT
Existing Analytics Engine:
Platform Analytics:
Platform Command Center:
Existing read models:
Shared date/comparison infrastructure:
Partner Analytics:
Duplication risk:
Reuse decision:

TARGET ARCHITECTURE
Shared CRM metric domain:
Shared CRM read model:
Platform scope:
Partner scope:
Partner consumer:
Platform consumer status:

ARCHITECTURE MATRIX
[shared/platform/partner matrix]

PARTNER CRM POPULATION
Customer authority:
PCR authority:
Partner scope:

ENTITLEMENT / PERMISSION
Basic:
Pro:
Permission:
Basic + Pro permission:
Pro + no permission:

METRIC CATALOG
[complete metric matrix]

DATE / TIME
dateFrom:
dateTo:
timezone:
comparison:
timestamp authority:

COMMERCIAL ATTRIBUTION
Orders:
Bookings:
Payments:
Refunds:
Partner attribution:
Payment customer ownership:
Currency:

API
Endpoint(s):
Shared service:
Scope input:
DTO:
Server scope:
Entitlement:
Permission:

SECURITY MATRIX
[complete matrix]

DOUBLE-COUNTING
Customer:
PCR:
Orders:
Bookings:
Payments:
History:

CACHE / PERFORMANCE
Cache:
Scope keys:
N+1:
Batching:
Indexes/query audit:

FRONTEND
Partner consumer:
Platform consumer:
Basic:
Pro:
Filters:
Comparison:
Loading:
Empty:
Error:

RUNTIME RECONCILIATION
[source → read model → API → UI matrix]

A→B→A:
Platform→Partner→Platform:
Cross-partner leakage:

LOCALIZATION
RU:
AZ:
EN:
Raw keys:
Raw enums:
Mixed locale:
UUID leakage:

TESTS
Backend targeted:
Backend full:
Backend TSC:
Backend build:
Frontend targeted:
Frontend full:
Frontend TSC:
Frontend build:
Skipped:

SCHEMA:
MIGRATION:
Reason:

PREVIOUS STAGE REGRESSION
Step 3.5.3:
Step 3.5A:
Step 3.5B:
Step 3.5C:
Step 3.5D:
Activity:
Notes:
Intake:
Entitlement:
History:

STEP 3.50 PRESERVED:
PERFORMANCE MANAGEMENT IMPLEMENTED:
SUPPLIER / PROCUREMENT:

FILES CHANGED:

P0:
P1:
P2:

REPORT:
ROADMAP UPDATE:
COMMIT:
PUSH:
HEAD == origin/master:
Worktree:

NEXT:
```

------------------------------------------------------------------------

# 74. STOP

После успешного закрытия:

``` text
PHASE 3 — STEP 3.5E —
PARTNER CRM ANALYTICS READ MODEL —
FULLY CLOSED
```

Перечитать canonical roadmap и вывести exact NEXT.

**STOP. Не начинать следующий этап без отдельного задания.**
