# PHASE 3 --- STEP 3.5C --- PARTNER CRM LEAD & DIRECT CUSTOMER INTAKE

## MANUAL / PHONE / OFFICE / DIRECT LEAD INTAKE + CUSTOMER IDENTITY REUSE + PARTNER RELATIONSHIP CREATION

### PLATFORM CRM --- IMPLEMENTATION PROMPT

**Все ответы разработчика, implementation notes, evidence, отчёты и
roadmap updates --- строго на русском.**

------------------------------------------------------------------------

# 1. CURRENT BASELINE

Предыдущие этапы закрыты:

``` text
PHASE 3 — STEP 3.5.3 — FULLY CLOSED
PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION — FULLY CLOSED
PHASE 3 — STEP 3.5B — CUSTOMER IDENTITY ↔ PARTNER CRM RELATIONSHIP — FULLY CLOSED
```

Latest accepted repository state:

``` text
Step 3.5B Final HEAD: bd6aee3
origin/master: bd6aee3

Backend: 1236/1236 PASS
Frontend: 243/243 PASS
Skipped: 0

Production code changes in 3.5B: 0
Schema: 0
Migration: 0
```

Canonical roadmap reports exact NEXT:

``` text
PHASE 3 — STEP 3.5C —
PARTNER CRM LEAD & DIRECT CUSTOMER INTAKE
```

Это текущий этап.

------------------------------------------------------------------------

# 2. PRIMARY GOAL

Реализовать canonical intake flow, через который Platform CRM может
принять нового или существующего клиента/лида партнёра из **прямого /
ручного / телефонного / офисного** канала без создания дублей Customer
identity и без нарушения Partner-scoped relationship authority.

Целевая логика:

``` text
Incoming direct lead/customer
        ↓
Normalize input
        ↓
Resolve existing Customer identity
        ↓
Create Customer only if canonical identity does not exist
        ↓
Resolve PartnerCustomerRelation
        ↓
Reuse existing relation OR create exactly one canonical relation
        ↓
Apply Partner-scoped intake attributes
        ↓
Audit / Activity
        ↓
Partner CRM / Customer 360 / Partner 360 consistency
```

------------------------------------------------------------------------

# 3. BUSINESS MEANING

Direct intake означает CRM-ввод клиента, который пришёл **не обязательно
через публичный Marketplace checkout**.

Potential canonical channels могут включать, только если
roadmap/repository их поддерживает:

``` text
PHONE
OFFICE
MANUAL
DIRECT
WALK_IN
EMAIL
OTHER
```

Не изобретать enum.

Actual roadmap/schema --- authority.

------------------------------------------------------------------------

# 4. CRITICAL DISTINCTION

Не смешивать:

``` text
Lead intake
Customer identity
PartnerCustomerRelation
Order
Booking
Payment
```

Intake может создать/обеспечить CRM identity/relationship, но **не
обязан автоматически создавать Order/Booking/Payment**, если canonical
architecture этого не требует.

Также:

``` text
CRM intake
≠ manual Order creation
≠ manual Booking creation
```

Эти процессы могут использовать одну customer identity, но остаются
отдельными domain flows.

------------------------------------------------------------------------

# 5. REPO-FIRST --- MANDATORY

До implementation прочитать actual repository и roadmap.

Найти:

``` text
canonical Step 3.5C description
Customer
User
Partner
PartnerCustomerRelation
PartnerCustomerRelationHistory
existing intake endpoints/services
lead source enums/fields
customer create flows
partner customer create flows
manual/direct flows
Orders
Bookings
CrmActivity
Operational Notes
Audit/Event infrastructure
RBAC
Platform CRM frontend
Partner 360 Customers
Customer 360 Partners
existing forms
existing tests
existing DTOs
```

Не создавать новый intake engine, пока не доказано, что существующий
foundation недостаточен.

------------------------------------------------------------------------

# 6. REPOSITORY BASELINE

До изменений выполнить:

``` bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -120
git diff
git diff --check
```

Зафиксировать:

``` text
Starting HEAD
origin/master
HEAD == origin/master
bd6aee3 reachable
737de35 reachable
27b2653 reachable
e4b38a3 reachable
worktree
```

Unexpected local changes → STOP.

------------------------------------------------------------------------

# 7. ROADMAP AUTHORITY

Прочитать exact Step 3.5C block.

В отчёте привести:

``` text
exact scope
dependencies
acceptance criteria
deferred scope
exact next stage
```

Если этот prompt шире canonical roadmap --- roadmap имеет приоритет.

------------------------------------------------------------------------

# 8. ACTUAL INTAKE INVENTORY

До реализации составить matrix всех существующих creation/intake paths:

  ----------------------------------------------------------------------------------------------------
  Intake/creation       Exists? Endpoint/service       Creates     Creates Source          Idempotent?
  path                                               Customer?        PCR? attribution   
  ----------------- ----------- ------------------ ----------- ----------- ------------- -------------
  Platform CRM                                                                           
  manual                                                                                 

  Partner intake                                                                         

  Order-derived                                                                          

  Booking-derived                                                                        

  Other actual path                                                                      
  ----------------------------------------------------------------------------------------------------

Не придумывать несуществующие paths.

------------------------------------------------------------------------

# 9. CANONICAL IDENTITY FROM STEP 3.5B

Preserve Step 3.5B invariants:

``` text
User
≠ Customer
≠ Partner
≠ PartnerCustomerRelation
```

Confirmed conceptual authority:

``` text
Customer = global CRM identity

PartnerCustomerRelation
= Partner-scoped relationship

@@unique([partnerId, customerId])
= one canonical relation per Partner + Customer
```

Не ломать это.

------------------------------------------------------------------------

# 10. DIRECT INTAKE MUST REUSE CUSTOMER IDENTITY

При intake:

``` text
if canonical Customer already exists
→ reuse Customer

else
→ create Customer
```

Нельзя создавать нового Customer только потому, что intake пришёл от
другого Partner.

Example:

``` text
Marie Park exists globally

Partner A direct intake
→ Customer Marie Park reused
→ PCR(A, Marie) created/reused

Partner B direct intake
→ same Customer Marie Park reused
→ PCR(B, Marie) created/reused
```

------------------------------------------------------------------------

# 11. DETERMINISTIC IDENTITY RESOLUTION

Repo-first определить canonical matching rules.

Potential identity inputs, only if supported:

``` text
email
phone
existing Customer ID
User ID
external/customer code
```

Не вводить fuzzy matching или probabilistic merge.

Не merge по имени.

Не merge по слабому heuristic.

------------------------------------------------------------------------

# 12. NORMALIZATION AUTHORITY

Если email/phone используются для matching:

reuse existing canonical normalization.

Проверить:

``` text
email trimming/case normalization
phone normalization
country code rules
null/empty handling
```

Не создавать второй normalization algorithm внутри intake service.

------------------------------------------------------------------------

# 13. AMBIGUOUS IDENTITY

Если input совпадает неоднозначно с несколькими Customer records, не
выполнять произвольный merge.

Expected behavior:

``` text
detect ambiguity
→ reject/flag for resolution
→ no duplicate creation
→ no silent merge
```

Точный behavior --- по существующей architecture/roadmap.

------------------------------------------------------------------------

# 14. MINIMUM INPUT CONTRACT

Определить actual required intake fields.

Не предполагать.

Potential fields:

``` text
firstName
lastName
email
phone
partnerId
leadSource/intakeSource
notes
assignedTo
tags
```

Только canonical fields.

Form/API validation должны соответствовать actual domain requirements.

------------------------------------------------------------------------

# 15. PARTNER AUTHORITY

Каждый intake должен иметь explicit canonical Partner context.

Не разрешать ambiguous intake без Partner scope, если Step 3.5C
относится к Partner CRM.

Server-side должен определить/validate:

``` text
partnerId
Platform CRM authority
relationship scope
```

Не доверять только frontend-provided partnerId без authorization check.

------------------------------------------------------------------------

# 16. PARTNER CUSTOMER RELATIONSHIP

После Customer resolution:

``` text
ensure PartnerCustomerRelation(partnerId, customerId)
```

Behavior:

``` text
existing relation
→ reuse

missing relation
→ create once
```

No duplicates.

No reset of existing relationship state unless canonical business rule
explicitly requires it.

------------------------------------------------------------------------

# 17. EXISTING RELATION MUST NOT BE OVERWRITTEN

Critical scenario:

``` text
Customer C + Partner A already ACTIVE
new phone/manual intake arrives
```

Forbidden default behavior:

``` text
ACTIVE → LEAD
manager overwritten
source overwritten
tags erased
history reset
```

Existing relationship must be preserved unless Step 3.5C defines
explicit field-update semantics.

------------------------------------------------------------------------

# 18. LEAD SOURCE / INTAKE SOURCE AUTHORITY

Determine actual field:

``` text
leadSource
source
intakeSource
channel
```

Do not create duplicate source fields.

If source is Partner-scoped, it belongs to `PartnerCustomerRelation` or
existing canonical relationship entity, not global Customer.

------------------------------------------------------------------------

# 19. FIRST-TOUCH VS LATEST-TOUCH

Repo-first determine source semantics.

Need explicitly classify whether source represents:

``` text
first-touch
latest-touch
current source
creation source
```

Do not overwrite historical first-touch source on repeat intake unless
canonical design says so.

If architecture lacks distinction, document current authority and avoid
silently inventing marketing attribution semantics.

------------------------------------------------------------------------

# 20. LIFECYCLE ON NEW RELATION

For new PartnerCustomerRelation, determine canonical initial lifecycle.

Potential:

``` text
LEAD
```

but actual enum/rule is authority.

Do not hardcode without repository evidence.

Existing relationship lifecycle must not reset.

------------------------------------------------------------------------

# 21. MANAGER / ASSIGNMENT

If intake can assign:

``` text
relationship manager
sales manager
operator
```

use existing authority.

Validate assignee:

``` text
exists
has appropriate scope/role
is allowed for this Partner relationship
```

If Step 3.5C does not include assignment, do not expand scope.

------------------------------------------------------------------------

# 22. TAGS

If tags are already in scope and relationship-scoped:

preserve existing tags.

New intake may add tags only according to canonical semantics.

Do not replace entire tag collection accidentally.

If tags belong to future stage --- defer.

------------------------------------------------------------------------

# 23. NOTES

If intake form supports notes:

reuse Operational Notes where canonical.

Do not add raw free-text `note` column to Customer/PCR merely for
convenience if Operational Notes is the established authority.

If an intake note is created:

``` text
append-only
audited
correct subject
correct Partner scope
Activity projection preserved
```

------------------------------------------------------------------------

# 24. ACTIVITY

Direct intake should produce Activity only if existing activity/event
architecture defines it.

Reuse `CrmActivity`.

Potential event:

``` text
lead/customer intake created
relationship created
relationship reused
```

Do not invent redundant events.

Persist locale-neutral event type; localize UI.

------------------------------------------------------------------------

# 25. AUDIT / HISTORY

For mutable relationship fields changed during intake, preserve
auditability.

Expected where applicable:

``` text
actor
timestamp
Partner
Customer
relationship
field change
source/channel
```

Reuse `PartnerCustomerRelationHistory` / existing audit infrastructure.

------------------------------------------------------------------------

# 26. IDEMPOTENCY

Mandatory retry scenario:

``` text
same intake request submitted twice
```

Expected:

``` text
one Customer
one PartnerCustomerRelation
no duplicate notes/events beyond canonical idempotency semantics
```

If request-level idempotency key architecture exists, reuse it.

If not, ensure entity-level uniqueness and safe retry behavior.

------------------------------------------------------------------------

# 27. CONCURRENCY

Mandatory backend test where applicable:

``` text
two concurrent intake requests
same canonical person
same Partner
```

Expected:

``` text
one canonical Customer identity
one canonical PCR
no uncaught unique conflict
no duplicate rows
```

Handle ORM conflicts deliberately.

Do not swallow unrelated errors.

------------------------------------------------------------------------

# 28. MULTI-PARTNER INTAKE

Mandatory scenario:

``` text
Customer C
→ direct intake for Partner A
→ direct intake for Partner B
```

Expected:

``` text
1 Customer
2 PartnerCustomerRelation rows
Partner-specific lifecycle/source/manager isolated
```

Cross-partner leakage = 0.

------------------------------------------------------------------------

# 29. REPEAT INTAKE --- SAME PARTNER

Mandatory scenario:

``` text
Customer C
→ Partner A intake #1
→ Partner A intake #2
```

Expected:

``` text
1 Customer
1 PCR
no duplicate relation
existing relationship fields preserved according to canonical rules
```

------------------------------------------------------------------------

# 30. CUSTOMER WITHOUT USER

Direct intake may involve a person with no platform login.

Repo-first verify whether Customer can exist without User.

If yes:

``` text
do not auto-create User/auth account
```

unless canonical roadmap explicitly requires invitation/account
provisioning.

CRM identity ≠ authentication account.

------------------------------------------------------------------------

# 31. USER WITH CUSTOMER

If incoming data maps to existing User/Customer link, reuse canonical
Customer.

Do not create parallel CRM Customer simply because intake was
direct/manual.

------------------------------------------------------------------------

# 32. PRIVACY / MINIMUM DATA

Only collect fields required by canonical CRM flow.

Do not add sensitive personal data unrelated to Step 3.5C.

Preserve existing validation/masking/security conventions.

------------------------------------------------------------------------

# 33. PLATFORM CRM UI

Implement or qualify actual Platform CRM direct intake UI according to
roadmap.

Potential entry point:

``` text
CRM → Customers
CRM → Partners → Partner 360 → Customers
```

Actual navigation is authority.

Do not create duplicate entry points if existing intake UI already
exists.

------------------------------------------------------------------------

# 34. CTA NAMING

Use business-accurate terminology.

Examples only:

``` text
Добавить клиента
Добавить лид
Новый клиент
Создать лид
```

Choose according to actual object semantics.

Do not label a relationship operation as "Создать пользователя".

------------------------------------------------------------------------

# 35. INTAKE FORM STATES

Affected form must have:

``` text
initial
validation
submitting
success
duplicate/existing identity resolution
ambiguous identity error if applicable
permission denied
server error
```

No double-submit.

------------------------------------------------------------------------

# 36. EXISTING CUSTOMER UX

If entered email/phone resolves to existing Customer, UI should not
mislead user into thinking a duplicate person will be created.

Use existing project UX patterns.

Expected semantic feedback could be:

``` text
Existing Customer found
Relationship will be created/reused
```

Do not expose technical matching internals unnecessarily.

------------------------------------------------------------------------

# 37. SUCCESS RESULT

After successful intake, user should be able to reach canonical CRM
surfaces.

Potential deep links:

``` text
Customer 360
Partner 360 → Customers
```

Visible labels human-readable.

No UUID primary labels.

------------------------------------------------------------------------

# 38. PARTNER 360 → CUSTOMERS

After intake, relationship must appear correctly in Partner 360
Customers surface.

Validate:

``` text
Customer name
relationship lifecycle
source
manager/tags if applicable
deep link to canonical Customer 360
```

No stale list after successful create if existing UX refresh rules
support update.

------------------------------------------------------------------------

# 39. CUSTOMER 360 → PARTNERS

After intake, Customer 360 Partners should show new/reused Partner
relationship if this surface exists.

Validate:

``` text
Partner name
relationship lifecycle
relationship attributes
deep link to Partner 360
```

------------------------------------------------------------------------

# 40. SEARCH / PAGINATION

Newly created/reused relationship must be discoverable through canonical
server-side search/list APIs.

Do not patch frontend list state in a way that creates temporary data
inconsistent with server authority.

------------------------------------------------------------------------

# 41. RBAC

Server-side permission gates required.

Determine actual permissions.

Potential authority:

``` text
crm.customer.read
crm.customer.write
crm.partner.read
crm.partner.write
```

Use actual existing permission model.

Test:

``` text
authorized Platform role → intake allowed
read-only role → denied
unauthorized role → denied
Partner Workspace context → no Platform CRM intake authority
```

------------------------------------------------------------------------

# 42. PARTNER WORKSPACE BOUNDARY

Step 3.5C is Platform CRM unless roadmap explicitly says otherwise.

Do not implement Partner self-service CRM intake inside Partner
Workspace in this stage.

That capability, if needed for Storefront Pro, belongs to its own
canonical architecture/stage.

------------------------------------------------------------------------

# 43. ORDERS / BOOKINGS BOUNDARY

Do not auto-create Order/Booking merely because a lead/customer is
created.

If intake originates from an Order/Booking, relationship derivation may
occur according to existing rules.

Preserve operational ownership.

------------------------------------------------------------------------

# 44. PAYMENT OWNERSHIP REGRESSION

Preserve:

``` text
Payment.customerId
OR
Payment.orderId → Order.customerId
```

Step 3.5C must not change payment ownership semantics.

------------------------------------------------------------------------

# 45. PARTNER ATTRIBUTION REGRESSION

Preserve canonical seller attribution:

``` text
Order.sellerPartnerId
```

and actual existing Booking/Payment derivation paths.

------------------------------------------------------------------------

# 46. HUMAN-READABLE DISPLAY CONTRACT

Preserve:

``` text
visible label = canonical human-readable business value
href/internal identity = UUID/ID
```

Required:

``` text
Customer/User → name
Partner → company/display name
Order → ORD-...
Booking → BKG-...
Payment → PAY-...
Service/Product → title
```

Resolvable UUID visible labels = 0.

------------------------------------------------------------------------

# 47. I18N

All affected UI:

``` text
RU
AZ
EN
```

Required:

``` text
raw i18n keys = 0
raw enums = 0
mixed locale = 0
```

Source/lifecycle labels must be localized in presentation.

Persist locale-neutral enum values.

------------------------------------------------------------------------

# 48. SCHEMA POLICY

Do not begin with migration.

Because Step 3.5A/3.5B confirmed foundation exists, initial expectation:

``` text
schema = 0
migration = 0
```

If intake cannot be implemented safely with current schema:

STOP before migration and report:

``` text
missing invariant
current model
why existing fields insufficient
minimal additive schema proposal
backfill
uniqueness/concurrency implications
compatibility
```

No destructive migration.

------------------------------------------------------------------------

# 49. NO DB RESET / RESEED

Forbidden:

``` text
DB reset
truncate
volume delete
global reseed
delete relationships
manual cleanup hiding duplicates
```

Testing must work against representative existing dataset or isolated
test DB.

------------------------------------------------------------------------

# 50. BACKEND TESTS

Add/update targeted tests for:

``` text
new person → Customer + PCR
existing Customer → reuse Customer + create PCR
existing Customer + existing PCR → reuse both
same Customer + same Partner repeat intake
same Customer + different Partner intake
lifecycle isolation
source isolation
manager/tags isolation where applicable
Customer without User
User-linked Customer
duplicate email/phone behavior
ambiguous identity behavior
retry/idempotency
concurrency
RBAC allow
RBAC deny
Partner context deny
audit/history
Activity/Notes where applicable
```

No stale fixtures.

------------------------------------------------------------------------

# 51. FRONTEND TESTS

Add/update affected intake UI tests:

``` text
form renders
required validation
existing Customer resolution
new Customer path
existing PCR reuse
submit loading
double-submit prevention
success
permission denied
server error
localized source/lifecycle
correct human-readable labels
correct deep links
RU/AZ/EN
```

------------------------------------------------------------------------

# 52. RUNTIME SCENARIOS --- MANDATORY

Use representative data.

At minimum:

``` text
Scenario A:
new identity + Partner A

Scenario B:
existing Customer + new Partner relationship

Scenario C:
existing Customer + existing Partner relationship

Scenario D:
same Customer + Partner A + Partner B

Scenario E:
repeat same intake / retry
```

For each capture:

``` text
Customer count impact
PCR count impact
lifecycle
source
visible UI
deep links
Activity/Audit where applicable
```

------------------------------------------------------------------------

# 53. A → B → A ISOLATION

Mandatory:

``` text
Partner A intake for Customer C
→ inspect relation A

Partner B intake for same Customer C
→ inspect relation B

return Partner A
→ relation A unchanged
```

Cross-partner leakage = 0.

------------------------------------------------------------------------

# 54. CLEAN RUNTIME

After implementation:

``` text
build
stop stale backend/frontend
restart current checkout
hard reload
```

Stale backend issue has previously caused false closure, so runtime
provenance is mandatory.

------------------------------------------------------------------------

# 55. FULL REGRESSION

Run canonical repository commands:

``` text
Backend TSC
Backend build
Backend full tests
Frontend TSC
Frontend build
Frontend full tests
```

Previous baseline:

``` text
Backend 1236/1236 PASS
Frontend 243/243 PASS
Skipped 0
```

Required:

``` text
0 failed
0 new skipped
```

Counts may increase.

------------------------------------------------------------------------

# 56. REGRESSION --- PREVIOUS CRM STAGES

Smoke-check:

``` text
Step 3.5.3
Step 3.5A
Step 3.5B

Customer 360
Partner 360
Partner 360 Customers
Customer 360 Partners
Customer Activity
Partner Activity
Customer Notes
Partner Notes
Customer Payment ownership
Partner attribution
status filters
crm.col.partner
UUID leakage = 0
History remains removed
```

------------------------------------------------------------------------

# 57. PERFORMANCE MANAGEMENT PRESERVATION

Canonical roadmap includes:

``` text
Step 3.50 — Workforce / Employee Performance Management
```

Preserve unchanged.

Do not implement Performance Management here.

If intake records actor/manager assignment, preserve clean semantics:

``` text
Assignment ≠ Action ≠ Outcome
```

for future performance analytics.

------------------------------------------------------------------------

# 58. SUPPLIER / PROCUREMENT EXCLUSION

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

Partner ≠ Supplier.

------------------------------------------------------------------------

# 59. FUTURE STAGES

Do not pull in:

``` text
Tasks
Documents
Segmentation
Advanced analytics
Communication automation
Storefront Pro CRM
Workforce
Supplier Procurement
manual Order/Booking implementation unless roadmap explicitly assigns it
```

Step 3.5C is intake foundation only.

------------------------------------------------------------------------

# 60. REQUIRED MATRICES

## Intake Path Matrix

  ----------------------------------------------------------------------------
  Path     Customer        Customer  PCR ensure Source     Idempotent Result
           resolution        create                                   
  -------- ------------ ----------- ----------- -------- ------------ --------
                                                                      

  ----------------------------------------------------------------------------

## Identity Resolution Matrix

  ----------------------------------------------------------------------------
  Scenario          Existing Existing PCR? Customer   PCR result    Duplicate?
                   Customer?               result                
  ------------ ------------- ------------- ---------- ---------- -------------
  New                                                            
  identity +                                                     
  Partner A                                                      

  Existing                                                       
  identity +                                                     
  new Partner                                                    

  Existing                                                       
  identity +                                                     
  same Partner                                                   

  Same                                                           
  identity +                                                     
  Partner B                                                      
  ----------------------------------------------------------------------------

## Relationship Isolation Matrix

  Customer   Partner   Lifecycle   Source   Manager   Tags   Leakage
  ---------- --------- ----------- -------- --------- ------ ---------
  C1         A                                               
  C1         B                                               

## Runtime Result Matrix

  -------------------------------------------------------------------------------
  Scenario       Customer    PCR count      UI PASS    Deep link   Audit/Activity
              count delta        delta                      PASS             PASS
  ---------- ------------ ------------ ------------ ------------ ----------------
  A                                                              

  B                                                              

  C                                                              

  D                                                              

  E                                                              
  -------------------------------------------------------------------------------

------------------------------------------------------------------------

# 61. REQUIRED REPORT

Create:

``` text
docs/prompts/PHASE_3_STEP_3.5C_PARTNER_CRM_LEAD_DIRECT_CUSTOMER_INTAKE_IMPLEMENTATION_REPORT.md
```

Report strictly in Russian.

Include:

``` text
repository baseline
canonical roadmap scope
actual intake inventory
identity resolution authority
normalization authority
intake DTO/API
Partner scope
PCR ensure semantics
lifecycle/source semantics
idempotency
concurrency
RBAC/security
frontend UX
Activity/Notes/Audit
runtime scenarios
cross-partner isolation
i18n
tests
regressions
schema/migration decision
files changed
roadmap update
git evidence
verdict
exact next
```

------------------------------------------------------------------------

# 62. ROADMAP UPDATE

After all gates pass:

``` text
Step 3.5C — COMPLETE
```

Update canonical roadmap additively.

Preserve:

``` text
Step 3.5.3 closure history
Step 3.5A closure
Step 3.5B closure
Step 3.50 Workforce / Employee Performance Management
e4b38a3 history
```

Do not silently renumber.

Then reread canonical roadmap and output exact NEXT.

Do not start NEXT.

------------------------------------------------------------------------

# 63. GIT DISCIPLINE

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

# 64. VERDICT A GATES

VERDICT A only if all applicable gates pass:

1.  repository baseline captured;
2.  `bd6aee3` preserved/reachable;
3.  `737de35` preserved/reachable;
4.  `27b2653` preserved/reachable;
5.  `e4b38a3` preserved/reachable;
6.  canonical Step 3.5C read;
7.  exact scope documented;
8.  actual intake paths inventoried;
9.  Customer identity authority preserved;
10. User ≠ Customer preserved;
11. Customer ≠ PCR preserved;
12. Partner ≠ Supplier preserved;
13. deterministic identity matching documented;
14. normalization authority documented;
15. ambiguous identity behavior defined;
16. new Customer intake PASS;
17. existing Customer reuse PASS;
18. existing PCR reuse PASS;
19. same Partner repeat intake PASS;
20. different Partner intake PASS;
21. Customer duplicate count = 0;
22. PCR duplicate count = 0;
23. relationship unique semantics preserved;
24. existing lifecycle not unintentionally reset;
25. existing source not unintentionally overwritten;
26. manager/tags not unintentionally overwritten where applicable;
27. source authority documented;
28. first/latest-touch semantics documented;
29. initial lifecycle documented;
30. retry/idempotency PASS;
31. concurrency PASS;
32. Customer without User behavior PASS where supported;
33. Partner scope validated server-side;
34. authorized Platform role PASS;
35. read-only/unauthorized role denied;
36. Partner Workspace unauthorized intake denied;
37. cross-partner leakage = 0;
38. Partner A relationship isolation PASS;
39. Partner B relationship isolation PASS;
40. A→B→A PASS;
41. Partner 360 Customers updated correctly;
42. Customer 360 Partners updated correctly where exists;
43. Customer deep links PASS;
44. Partner deep links PASS;
45. Operational Notes reused where applicable;
46. CrmActivity reused where applicable;
47. audit/history preserved;
48. Orders not duplicated into CRM;
49. Bookings not duplicated into CRM;
50. Payment ownership preserved;
51. Partner attribution preserved;
52. human-readable display contract preserved;
53. resolvable UUID visible labels = 0;
54. RU PASS;
55. AZ PASS;
56. EN PASS;
57. raw i18n keys = 0;
58. raw enums = 0;
59. mixed locale = 0;
60. form validation PASS;
61. no double submit;
62. loading/success/error states PASS;
63. schema decision justified;
64. migration decision justified;
65. no destructive DB operation;
66. backend targeted tests PASS;
67. backend full tests = 0 FAIL;
68. backend TSC PASS;
69. backend build PASS;
70. frontend targeted tests PASS;
71. frontend full tests = 0 FAIL;
72. frontend TSC PASS;
73. frontend build PASS;
74. new skipped = 0;
75. clean runtime from current checkout;
76. stale processes excluded;
77. runtime scenarios A-E complete;
78. previous Step 3.5.3 regression PASS;
79. Step 3.5A regression PASS;
80. Step 3.5B regression PASS;
81. Step 3.50 preserved;
82. Supplier/Procurement not implemented;
83. Performance Management not implemented;
84. future stages not auto-started;
85. report created;
86. roadmap updated additively;
87. exact staging used;
88. HEAD == origin/master;
89. worktree clean;
90. P0 = 0;
91. P1 = 0;
92. no unresolved in-scope P2.

------------------------------------------------------------------------

# 65. VERDICT RULE

Success only:

``` text
VERDICT A — PHASE 3 — STEP 3.5C /
PARTNER CRM LEAD & DIRECT CUSTOMER INTAKE /
CUSTOMER IDENTITY REUSE + PARTNER RELATIONSHIP ENSURE /
FULLY CLOSED
```

Otherwise:

``` text
VERDICT B — PHASE 3 — STEP 3.5C /
PARTNER CRM LEAD & DIRECT CUSTOMER INTAKE /
INCOMPLETE
```

No conditional VERDICT A.

------------------------------------------------------------------------

# 66. REQUIRED FINAL RESPONSE FORMAT

``` text
VERDICT:

REPOSITORY
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
bd6aee3 preserved:
737de35 preserved:
27b2653 preserved:
e4b38a3 preserved:
Worktree:

ROADMAP
Canonical Step 3.5C scope:
Dependencies:
Deferred:
Exact NEXT:

ACTUAL INTAKE INVENTORY
Platform manual:
Partner intake:
Order-derived:
Booking-derived:
Other:

IDENTITY RESOLUTION
Customer authority:
User mapping:
Matching fields:
Normalization:
Ambiguous match behavior:
Customer without User:

INTAKE CONTRACT
Endpoint:
DTO:
Required fields:
Optional fields:
Partner scope:
Source:
Initial lifecycle:
Manager:
Tags:
Notes:

PCR ENSURE
Existing Customer + new PCR:
Existing Customer + existing PCR:
New Customer + new PCR:
Uniqueness:
Existing lifecycle preservation:
Existing source preservation:

IDEMPOTENCY / CONCURRENCY
Retry:
Concurrent:
Customer duplicates:
PCR duplicates:

MULTI-PARTNER ISOLATION
C1/A:
C1/B:
A→B→A:
Cross-partner leakage:

RUNTIME MATRIX
[complete matrix]

PARTNER 360 → CUSTOMERS
Result:
Display:
Relationship fields:
Deep link:

CUSTOMER 360 → PARTNERS
Result:
Display:
Relationship fields:
Deep link:

RBAC / SECURITY
Authorized:
Read-only:
Unauthorized:
Platform context:
Partner Workspace:
Partner scope validation:

ACTIVITY / NOTES / AUDIT
CrmActivity:
Operational Notes:
Relation History:
Audit:

COMMERCIAL DOMAIN REGRESSION
Orders:
Bookings:
Payments:
Partner attribution:
Customer Payment ownership:

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
Step 3.50 preserved:

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

# 67. STOP

После успешного закрытия:

``` text
PHASE 3 — STEP 3.5C —
PARTNER CRM LEAD & DIRECT CUSTOMER INTAKE —
FULLY CLOSED
```

Перечитать canonical roadmap и вывести exact NEXT.

**STOP. Не начинать следующий этап без отдельного задания.**
