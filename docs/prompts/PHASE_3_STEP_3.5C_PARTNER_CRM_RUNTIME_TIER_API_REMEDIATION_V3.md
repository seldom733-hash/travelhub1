# PHASE 3 — STEP 3.5C — PARTNER CRM RUNTIME TIER AUTHORITY & API ROUTE REMEDIATION V3
## MARKETPLACE BASIC vs STOREFRONT PRO
## RUNTIME BLOCKER CLOSURE / CUSTOMER API / TIER RESOLUTION / DIFFERENTIATED UX

---

# 1. PURPOSE

Continue Step 3.5C from the actual browser runtime evidence.

Do NOT treat the previous implementation/report as complete merely because TSC/tests/build pass.

Current browser evidence proves that the partner-facing CRM/customer flow is not operationally reconciled.

This is a focused runtime remediation after:

```text
PHASE_3_STEP_3.5C_PARTNER_WORKSPACE_TIER_DIFFERENTIATION_REMEDIATION_V2
```

Do not restart Step 3.5C from scratch.

---

# 2. ACTUAL BROWSER EVIDENCE

Two real partner sessions were checked at:

```text
/partner/customers
```

Accounts/context observed:

```text
Storefront Pro Demo
Step 18 Partner
```

Both pages render effectively the same customer-management UI.

Observed page:

```text
Клиенты
Клиенты из ваших marketplace-заказов

MARKETPLACE BASIC — Клиенты

МОИ КЛИЕНТЫ
0

Поиск по имени или email...
```

Both also show the same runtime API error:

```text
Cannot GET /api/v1/partner/customers?page=1&pageSize=20
```

Therefore the visible `0` customer count is NOT valid business evidence.

The request failed.

---

# 3. CURRENT VERDICT

Until this remediation is completed:

```text
VERDICT B — STEP 3.5C PARTNER CRM RUNTIME INCOMPLETE
```

Known blockers:

```text
1. Storefront Pro UI renders MARKETPLACE BASIC customer context.
2. Basic and Pro customer pages are effectively identical.
3. Pro CRM capabilities are not visibly exposed.
4. /api/v1/partner/customers runtime request fails with Cannot GET.
5. Customer count = 0 is therefore not trustworthy.
6. Basic vs Pro browser differentiation is not proven.
```

Do NOT close with VERDICT A while any of these remain.

---

# 4. IMPORTANT — DO NOT ASSUME "BACKEND NEEDS RESTART"

Do not fix this by blindly restarting services and declaring success.

First determine the exact root cause.

Required investigation:

```text
Does the expected backend controller exist in source?
What is its exact @Controller path?
What is the exact GET route?
Is the route registered in the module?
Is the module imported by the running application?
Does the compiled backend contain the route?
Does Swagger/runtime route inventory contain it?
What SHA is the running backend using?
What SHA is the frontend using?
Does frontend call the correct API contract?
Is localhost:3000 proxying the request correctly?
Is the API expected on another port/base URL?
Is stale Docker/container/process code running?
```

A restart is acceptable only AFTER root cause proves stale runtime deployment.

---

# 5. RUNTIME SHA AUTHORITY

Before changing code, establish:

```text
git HEAD
origin/master
frontend runtime SHA/build
backend runtime SHA/build
running process/container identity
```

Where practical, prove that the running frontend/backend correspond to the intended repository HEAD.

Do not use source-code existence as proof of runtime availability.

---

# 6. CUSTOMER API CONTRACT DISCOVERY

Inventory every relevant partner CRM/customer endpoint.

Required table:

| Purpose | Frontend call | Backend controller | Backend route | Registered | Runtime HTTP | PASS |
|---|---|---|---|---|---|---|
| Resolve partner CRM context | | | | | | |
| Basic customer list | | | | | | |
| Customer detail | | | | | | |
| Pro CRM list | | | | | | |
| Direct intake | | | | | | |
| Relation update | | | | | | |

Do not invent routes.

Use actual code/runtime.

---

# 7. FIX `Cannot GET /api/v1/partner/customers`

The following request must no longer produce route-not-found:

```text
GET /api/v1/partner/customers?page=1&pageSize=20
```

BUT:

If this frontend route is itself incorrect, do NOT create a duplicate backend endpoint merely to satisfy the current frontend.

Instead reconcile frontend and backend to ONE canonical API contract.

Hard invariant:

```text
ONE semantic capability
→ ONE canonical API contract
```

Avoid parallel accidental endpoints.

---

# 8. DISTINGUISH ROUTE 404 FROM AUTHORIZATION

Required outcomes must be semantically correct.

Bad:

```text
Basic accesses Pro-only endpoint
→ 404 because route does not exist
```

Correct:

```text
valid endpoint exists
+ authorization/capability enforcement applies
→ allowed or denied intentionally
```

Do not confuse missing route with security.

---

# 9. TIER RESOLUTION — CRITICAL DEFECT

The Storefront Pro session currently renders:

```text
MARKETPLACE BASIC — Клиенты
```

Investigate the full tier-resolution chain:

```text
authenticated user
→ partner identity
→ partnerId
→ PartnerStorefront
→ storefront.status
→ entitlementStatus
→ resolved tier
→ resolved capabilities
→ API response/context
→ frontend state
→ navigation/page variant
```

Find the first point where Pro becomes Basic.

---

# 10. DO NOT USE DISPLAY NAME AS AUTHORITY

`Storefront Pro Demo` is only observed UI/account naming.

Never authorize based on:

```text
name.includes("Pro")
email
display label
hardcoded account
```

Pro must resolve from canonical entitlement authority.

---

# 11. CURRENT TIER RULE TO VERIFY

Previous Step 3.5C reported:

```text
PartnerStorefront.status = 'ACTIVE'
AND PartnerStorefront.entitlementStatus = 'ACTIVE'
→ STOREFRONT PRO

else
→ MARKETPLACE BASIC
```

Verify this against actual schema/runtime data.

Report whether this remains the implemented authority.

If current schema/architecture has since changed, use canonical current authority and document the discrepancy.

Do NOT silently change architecture.

---

# 12. REQUIRED DATABASE/RUNTIME EVIDENCE

For both test partners report, without secrets:

```text
account identifier
userId
partnerId
PartnerStorefront record exists?
storefront.status
entitlementStatus
resolved tier
resolved capabilities
```

Expected test identities:

```text
step18_partner
→ MARKETPLACE BASIC

pro_partner / Storefront Pro Demo
→ STOREFRONT PRO
```

If runtime data does not satisfy this expectation, fix test data only if it is genuinely incorrect and document the change.

Do not fake tier detection in frontend.

---

# 13. SERVER-AUTHORITATIVE TIER

Frontend must consume server-authoritative context/capabilities.

Forbidden pattern:

```ts
const isPro = storefront.status === 'ACTIVE' && ...
```

duplicated independently in frontend when backend owns this decision.

Preferred:

```text
backend:
resolve partner tier/capabilities

frontend:
render allowed navigation/page/actions from resolved authority
```

---

# 14. MARKETPLACE BASIC — REQUIRED RUNTIME UX

After remediation, Basic should clearly render a simple customer-management context.

Example semantics:

```text
Клиенты
Клиенты из ваших marketplace-заказов

MARKETPLACE BASIC
```

Basic may have:

```text
customer list
search
customer detail
own marketplace commercial context
pagination
```

Basic must NOT expose active Pro controls:

```text
Добавить клиента
Lifecycle editing
Tags editing
Notes editing
AssignedTo
other Pro-only CRM mutations
```

---

# 15. STOREFRONT PRO — REQUIRED RUNTIME UX

Pro must NOT render:

```text
MARKETPLACE BASIC — Клиенты
```

unless it is explicitly displaying a separate Basic sub-context, which is NOT the current intended design.

Pro must visibly expose the richer CRM capability.

Expected semantics based on Step 3.5C contract:

```text
CRM / Клиенты
STOREFRONT PRO
```

with usable entitled functions:

```text
Customer list
Customer 360
Direct intake
Lifecycle
Tags
Notes
AssignedTo
```

Use actual implemented product terminology.

---

# 16. BASIC AND PRO MAY BOTH HAVE "КЛИЕНТЫ"

The presence of `Клиенты` for both tiers is NOT itself a defect.

The defect is:

```text
same tier identity
+ same data authority
+ same capabilities
+ same page/action UX
```

when architecture requires different capability levels.

Acceptable:

```text
BASIC
Клиенты
→ simple customer management

PRO
Клиенты / CRM
→ extended CRM
```

---

# 17. CUSTOMER LIST DATA AUTHORITY

Verify actual data source.

Previous contract:

```text
BASIC
→ customers derived from own marketplace orders

PRO
→ PartnerCustomerRelation
```

Do not merely implement two frontend presentations over the same accidental query.

Document exact backend query/data authority for both.

---

# 18. CRITICAL — PRO MUST NOT LOSE MARKETPLACE CUSTOMERS

A Pro partner may also have marketplace customers.

Hard invariant:

```text
Storefront Pro entitlement extends capability.
It must not make legitimate marketplace customers disappear.
```

If Pro list is based on `PartnerCustomerRelation`, determine how pre-existing marketplace customers become visible.

Valid architecture may involve:

```text
relation creation/synchronization
canonical union
derived relationship
another existing canonical mechanism
```

Do not guess.

Prove the current intended model.

---

# 19. CUSTOMER COUNT

The KPI/card:

```text
МОИ КЛИЕНТЫ
0
```

must only show `0` when a successful canonical query proves zero.

On API failure:

```text
DO NOT render 0 as if it were business truth.
```

Instead use existing error/loading conventions.

Hard invariant:

```text
API ERROR ≠ ZERO CUSTOMERS
```

---

# 20. ERROR STATE

Replace misleading combination:

```text
МОИ КЛИЕНТЫ 0
+
Cannot GET ...
+
Клиентов пока нет
```

with semantically correct behavior.

On request failure:

```text
show error state
do not claim empty dataset
allow retry where appropriate
```

On successful zero result:

```text
show 0
show legitimate empty state
```

---

# 21. RAW BACKEND ERROR LEAKAGE

Current UI displays:

```text
Cannot GET /api/v1/partner/customers?page=1&pageSize=20
```

Do not expose raw infrastructure/backend error text as primary customer-facing UX.

Preserve useful diagnostics in logs/dev tooling.

User-facing UI should use localized application error copy.

No sensitive stack traces/internal details.

---

# 22. PAGINATION

Project-wide standard remains:

```text
pageSize = 20
```

For both Basic and Pro operational customer tables:

```text
server-side pagination
filtered total
page count from filtered total
pager when total > 20
filters preserved across pages
```

---

# 23. SEARCH

Search must:

```text
operate on server-authorized partner scope
preserve tier data authority
reset/validate page when query changes
not leak other partners' customers
```

---

# 24. CUSTOMER DETAIL ROUTING

Verify clicking a row opens the correct detail for each tier.

Basic:

```text
limited partner-authorized detail
```

Pro:

```text
Customer 360 / richer relation context
```

No cross-partner enumeration through guessed IDs.

---

# 25. PRO DIRECT INTAKE

For Pro, verify visible and functional:

```text
+ Добавить клиента
```

Required runtime flow:

```text
open
validate
save
successful response
new/linked customer appears
refresh persists
```

Basic must not have this active action.

---

# 26. PRO RELATION MANAGEMENT

Verify actual UI + API for:

```text
Lifecycle
Tags
Notes
AssignedTo
```

and `Lead Source` if it is part of the implemented contract.

Each claimed capability requires browser evidence.

---

# 27. NAVIGATION

Both may contain customer entry.

Expected meaningful difference can be:

```text
BASIC:
Клиенты

PRO:
CRM
```

or another canonical label.

But do not force label difference if product architecture uses `Клиенты` for both.

Capability/page difference is mandatory.

---

# 28. PARTNER WORKSPACE TITLE

Preserve V2 requirement:

```text
Кабинет партнёра
→ static workspace label
→ not a false clickable control

Обзор
→ canonical /partner home navigation
```

Verify for both tiers.

---

# 29. BASIC "ВИТРИНА"

Preserve V2 requirement to reconcile its meaning.

Do not use this runtime remediation to redesign Storefront onboarding unless directly required.

---

# 30. SECURITY

Required server-side tests:

```text
Basic own customer list → ALLOW
Basic own customer detail → ALLOW

Basic direct intake → DENY
Basic lifecycle mutation → DENY
Basic tags mutation → DENY
Basic notes mutation → DENY
Basic assignedTo mutation → DENY

Pro entitled CRM list → ALLOW
Pro direct intake → ALLOW
Pro relation management → ALLOW as permitted

Partner A → Partner B customer → DENY
Partner A search → no Partner B leakage
arbitrary partnerId override → ignored/denied
```

---

# 31. DO NOT SOLVE SECURITY WITH FRONTEND HIDING

Required:

```text
frontend hidden
+
backend denied
```

for unauthorized Pro capabilities.

---

# 32. HTTP EVIDENCE

For every relevant runtime endpoint report:

```text
method
URL
actor tier
HTTP status
response shape/count
```

No passwords/tokens in report.

At minimum prove:

```text
Basic list
Pro list
Basic prohibited mutation
Pro allowed mutation
cross-partner attempt
```

---

# 33. BROWSER EVIDENCE — BASIC

Using actual Basic account:

```text
resolved tier = BASIC
page does not error
customer query returns success
count reflects response
list/empty state is truthful
Basic label/context correct
no Pro actions
pagination/search functional where data exists
```

---

# 34. BROWSER EVIDENCE — PRO

Using actual Pro account:

```text
resolved tier = PRO
page does not show MARKETPLACE BASIC as its active tier
CRM/customer query returns success
Pro customer context rendered
Customer 360 reachable
direct intake reachable
relation actions visible/functional according to entitlement
```

---

# 35. REQUIRED VISUAL DIFFERENTIATION MATRIX

| Surface | Basic | Pro | PASS |
|---|---|---|---|
| Resolved tier | MARKETPLACE BASIC | STOREFRONT PRO | |
| Page heading/context | | | |
| Data authority | marketplace scope | Pro CRM authority + continuity | |
| Customer list | | | |
| Customer detail | limited | Customer 360 | |
| Direct intake | absent/denied | available | |
| Lifecycle | absent/denied | available | |
| Tags | absent/denied | available | |
| Notes | absent/denied | available | |
| AssignedTo | absent/denied | available | |
| API error | none | none | |

---

# 36. ZERO/ERROR BOUNDARY TESTS

Required:

```text
successful total=0
→ 0 + legitimate empty state

successful total=1
→ 1 customer

successful total=20
→ one page

successful total=21
→ two pages

API 4xx/5xx/network failure
→ error state, NOT "0 customers"
```

Use focused tests/fixtures where practical.

---

# 37. RUNTIME ROUTE TEST

Add a regression test that would fail if frontend expects a partner customer route that backend does not expose.

The exact mechanism should fit repository architecture.

Goal:

```text
frontend/backend partner CRM contract drift
→ caught before browser runtime
```

Do not create brittle string-only tests if a stronger integration/contract test is feasible.

---

# 38. TIER REGRESSION TEST

Add focused coverage proving:

```text
Basic account → BASIC
Pro active storefront + active entitlement → PRO
```

and frontend consumes the resolved result correctly.

---

# 39. UPGRADE CONTINUITY

Preserve V2 hard gate:

```text
BASIC → PRO
legitimate marketplace customers do not disappear
```

If not fully implementable within current architecture, return VERDICT B and document the exact missing prerequisite.

Do not silently waive it.

---

# 40. DOWNGRADE SAFETY

Preserve:

```text
PRO → BASIC
Pro mutations denied
CRM historical data not destroyed
Basic legitimate marketplace context remains
```

---

# 41. I18N

All new/changed user-facing strings:

```text
RU
AZ
EN
```

Raw keys = 0.

Raw `Cannot GET ...` must not remain as normal UI copy.

---

# 42. OUT OF SCOPE

Do NOT start:

```text
Platform CRM Partners / Partner 360 remediation
Step 3.5D full entitlement redesign
Supplier Settlement / Balance / Payout
F.1–F.13 implementation
S.1–S.19 implementation
Employees
Marketing
Omnichannel
Advanced Finance
```

---

# 43. DO NOT CHANGE DB SCHEMA UNLESS PROVEN NECESSARY

This defect currently appears to involve:

```text
runtime route contract
tier resolution
frontend capability rendering
```

Do not add migrations/schema changes without proving they are required.

If required, STOP and explain before introducing a broad schema redesign.

---

# 44. TEST / BUILD GATES

Required:

```text
Backend TSC
Frontend TSC
Backend build
Frontend build
Relevant backend tests
Relevant frontend tests
New route-contract regression test
New tier regression tests
```

Report exact counts.

---

# 45. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_STEP_3.5C_PARTNER_CRM_RUNTIME_TIER_API_REMEDIATION_V3_REPORT.md
```

---

# 46. REQUIRED ROOT-CAUSE SECTION

Report separately:

```text
A. Why did /api/v1/partner/customers return Cannot GET?
B. Why did Storefront Pro resolve/render as MARKETPLACE BASIC?
C. Why were Basic and Pro customer pages identical?
D. Why did API failure render "0 customers"?
E. Was runtime stale relative to repository HEAD?
```

No combined vague answer.

---

# 47. REQUIRED BEFORE/AFTER EVIDENCE

## BEFORE

```text
BASIC:
route: /partner/customers
tier shown: MARKETPLACE BASIC
API: Cannot GET
count shown: 0
page: Basic customer page

PRO:
route: /partner/customers
tier shown: MARKETPLACE BASIC
API: Cannot GET
count shown: 0
page: same Basic customer page
```

## AFTER

Provide actual runtime values, not expected prose.

---

# 48. HARD ACCEPTANCE CRITERIA

VERDICT A only if ALL pass:

1. Exact root cause of `Cannot GET /api/v1/partner/customers` identified.
2. Canonical frontend/backend customer API contract reconciled.
3. Basic customer list runtime HTTP succeeds.
4. Pro CRM/customer list runtime HTTP succeeds.
5. Runtime frontend/backend are proven to use intended code/version.
6. Storefront Pro resolves as PRO from canonical authority.
7. Basic resolves as BASIC.
8. Frontend consumes server-authoritative tier/capabilities.
9. No display-name/hardcoded-account tier logic.
10. Basic page renders Basic context.
11. Pro page does not falsely render MARKETPLACE BASIC context.
12. Basic and Pro page capabilities differ meaningfully.
13. Basic customer list authority is correct.
14. Pro CRM data authority is correct.
15. Pro does not lose legitimate marketplace customer context.
16. Basic customer detail works.
17. Pro Customer 360 works according to implemented contract.
18. Pro direct intake works in browser.
19. Pro lifecycle works if claimed.
20. Pro tags work if claimed.
21. Pro notes work if claimed.
22. Pro assignedTo works if claimed.
23. Basic direct intake remains server-denied.
24. Basic lifecycle/tags/notes/assignedTo remain server-denied.
25. Cross-partner isolation PASS.
26. Anti-enumeration/search scope PASS.
27. API failure no longer renders fake business zero.
28. Successful zero still renders legitimate empty state.
29. Raw `Cannot GET` is not exposed as normal user-facing copy.
30. pageSize=20 preserved.
31. >20 pagination works.
32. Search works.
33. Customer detail routing works.
34. V2 workspace-title semantics preserved.
35. Basic Storefront menu semantics preserved/reported.
36. Upgrade continuity PASS.
37. Downgrade safety PASS.
38. RU/AZ/EN PASS.
39. Raw i18n keys = 0.
40. Platform CRM regression PASS.
41. Partner products regression PASS.
42. Storefront regression PASS.
43. Backend TSC PASS.
44. Frontend TSC PASS.
45. Backend build PASS.
46. Frontend build PASS.
47. Relevant backend tests PASS.
48. Relevant frontend tests PASS.
49. Route-contract regression test PASS.
50. Tier regression tests PASS.
51. Basic browser flow PASS.
52. Pro browser flow PASS.
53. HTTP evidence matrix supplied.
54. Visual differentiation matrix supplied.
55. No unrelated production scope pulled in.
56. Unrelated files committed = 0.
57. Push complete.
58. HEAD == origin/master.

---

# 49. VERDICT

Success:

```text
VERDICT A — PHASE 3 STEP 3.5C PARTNER CRM RUNTIME TIER AUTHORITY /
CUSTOMER API CONTRACT / BASIC vs STOREFRONT PRO UX FULLY RECONCILED
```

Failure:

```text
VERDICT B — STEP 3.5C PARTNER CRM RUNTIME REMAINS INCOMPLETE
```

No conditional/partial VERDICT A.

---

# 50. FINAL RESPONSE FORMAT

```text
VERDICT:

ROOT CAUSE A — customer API Cannot GET:
ROOT CAUSE B — Pro rendered as Basic:
ROOT CAUSE C — identical pages:
ROOT CAUSE D — false zero on API error:
ROOT CAUSE E — runtime SHA/staleness:

HEAD before:
origin/master before:
Backend runtime version:
Frontend runtime version:

CANONICAL API CONTRACT:
Basic list:
Basic detail:
Pro list:
Pro detail/360:
Direct intake:
Relation mutation:

BASIC:
Account:
partnerId:
Storefront status:
Entitlement status:
Resolved tier:
Resolved capabilities:
Navigation:
Customer route:
HTTP:
Customer total:
Data authority:
Detail:
Pro controls:
Pro API denial:

PRO:
Account:
partnerId:
Storefront status:
Entitlement status:
Resolved tier:
Resolved capabilities:
Navigation:
CRM route:
HTTP:
Customer total:
Data authority:
Customer 360:
Direct intake:
Lifecycle:
Tags:
Notes:
AssignedTo:

Marketplace-customer continuity:
Upgrade test:
Downgrade test:

Error vs zero behavior:
Pagination:
Search:
i18n:

Cross-partner isolation:
Anti-enumeration:

HTTP evidence matrix:
Visual differentiation matrix:

Platform CRM regression:
Partner products regression:
Storefront regression:

Backend TSC:
Frontend TSC:
Backend build:
Frontend build:
Backend tests:
Frontend tests:
Route-contract regression:
Tier regression:

Production code changed:
DB schema changed:
Migration:
Files changed:

3.5C status:
3.5D status:
F.1–F.13:
S.1–S.19:

Commit:
HEAD:
origin/master:
HEAD == origin/master:
Unrelated files:

Remaining findings:
Next canonical stage:
```

---

# 51. STOP

After report:

```text
STOP
```

Do not automatically begin another CRM/finance/roadmap stage.

We will visually re-check both partner accounts before accepting Step 3.5C.
