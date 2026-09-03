# PHASE 3 --- STEP 3.6 --- CRM CENTER UI

## IMPLEMENTATION PROMPT

### PLATFORM CRM CENTER + CUSTOMER 360 + PARTNER 360 + CRM ANALYTICS CONSUMER

### REPO-FIRST / ROADMAP-FIRST / RUNTIME-FIRST / EVIDENCE-FIRST

**Все ответы разработчика, implementation notes, evidence, отчёты и
roadmap updates --- строго на русском.**

------------------------------------------------------------------------

## 1. CURRENT AUTHORITATIVE BASELINE

Accepted before Step 3.6:

``` text
Step 3.5.3 — FULLY RE-CLOSED
Step 3.5A — FULLY CLOSED
Step 3.5B — FULLY CLOSED
Step 3.5C — FULLY CLOSED
Step 3.5D — FULLY CLOSED
Step 3.5E — FULLY CLOSED
Step 3.5E.1 — FULLY CLOSED

Final HEAD: 7e52f68
origin/master: 7e52f68
HEAD == origin/master: YES
Mandatory preserved Refund baseline: 7e4fe8c
```

Recent history:

``` text
7e52f68 docs(analytics): Step 3.5E.1 report
d5f6f89 fix(analytics): remove repeatCustomers
a40b6a8 docs(evidence): Refund fix + Dashboard404
7e4fe8c fix(crm-activity): RefundAdapter customerId
9674ce0 feat(analytics): Step 3.5E — Partner CRM Analytics Read Model
```

Analytics targeted baseline: 65/65 PASS. Step 3.5E reconciliation: 8/8
metrics. `repeatCustomers`: REMOVED / DEFERRED.

------------------------------------------------------------------------

## 2. EXACT STAGE / STOP RULE

Implement only:

``` text
PHASE 3 — STEP 3.6 — CRM CENTER UI
```

Do not auto-start later rounds/stages. Do not start Round 2C/2D/2E,
Supplier/Procurement, Workforce/Performance Management, or the next
roadmap stage.

------------------------------------------------------------------------

## 3. GATE 1 --- CANONICAL ROADMAP FIRST

Before design/code open
`docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`, locate
exact Step 3.6 and report its scope, dependencies, required
pages/surfaces, capabilities, exclusions, acceptance criteria and exact
NEXT. Then audit existing CRM frontend/backend.

Roadmap/repository is authoritative. If it materially conflicts with
this prompt: **STOP**, report the conflict, do not silently expand
scope.

------------------------------------------------------------------------

## 4. BUSINESS CONTEXT INVARIANTS

Mandatory:

``` text
PLATFORM CRM = TravelHub manages Customers and Partners
PARTNER WORKSPACE CRM = Partner manages its own customers/business

Platform CRM Partner 360 ≠ Partner Workspace
Partner ≠ Customer
Partner ≠ Supplier
Customer ≠ User
PartnerCustomerRelation ≠ Customer identity
```

Do not merge these authorities in a generic UI.

------------------------------------------------------------------------

## 5. ARCHITECTURAL GOAL

Use the existing CRM domain/API/read models to deliver the canonical
Step 3.6 UI:

``` text
Existing CRM authority
 → shared CRM read models/APIs
 → Platform CRM Center UI
    ├ Customers
    ├ Partners
    ├ Customer 360
    ├ Partner 360
    └ CRM Analytics consumer, only if canonical Step 3.6 requires it
```

Do not create a parallel CRM backend.

------------------------------------------------------------------------

## 6. REPOSITORY BASELINE

Before implementation run:

``` bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -120
git diff
git diff --check
```

Require Starting HEAD/origin `7e52f68`, clean worktree, and reachability
of `7e52f68`, `7e4fe8c`, `9674ce0`, `c73d2e6`, `43e0e69`, `bd6aee3`,
`737de35`, `27b2653`, `e4b38a3`. Unexpected local changes → STOP.

------------------------------------------------------------------------

## 7. REPO-FIRST UI INVENTORY

Inspect actual routes/components/APIs for CRM navigation, Customers,
Partners, Customer 360, Partner 360, Activity, Notes, Orders, Bookings,
Payments, Refunds, Services/Products, Storefront, relation tabs,
analytics UI/components, shared KPI/chart/date/filter components, i18n,
API client, auth/session, route guards and permissions.

Produce:

  --------------------------------------------------------------------------
  Surface     Route              Exists? Backend API Current     Step 3.6
                                                     quality     action
  ----------- ----------- -------------- ----------- ----------- -----------
  CRM Center                                                     

  Customers                                                      

  Customer                                                       
  360                                                            

  Partners                                                       

  Partner 360                                                    

  CRM                                                            
  Analytics                                                      
  --------------------------------------------------------------------------

List **actual current tabs** for Customer/Partner 360. Do not invent
tabs.

------------------------------------------------------------------------

## 8. 360 AUTHORITY + DISPLAY INTEGRITY

Preserve already validated 360 functionality; avoid unnecessary
rewrites.

Customer is global canonical CRM identity. Partner 360 is TravelHub's
relationship with Partner, not Partner Workspace.

Hard rule:

``` text
visible label → canonical human-readable business value
href/internal identity → canonical UUID/ID
```

Expected labels where applicable: Customer→name, Partner→company name,
User→display/full name, Order→ORD-*, Booking→BKG-*, Payment→PAY-*,
Refund→RFD-*, Product/Service→title. Resolvable UUID visible labels =
**0**.

------------------------------------------------------------------------

## 9. LISTS / TABLE UX

If canonical scope includes lists, use server-side
pagination/filtering/sorting where supported, shared live-search UX,
stable geometry, localized headers/statuses/empty/loading/error states,
business codes and human-readable relations. No fake client-side filter
over current page. No redundant Find button if shared UX uses live
search. Raw enums = 0.

------------------------------------------------------------------------

## 10. ACTIVITY / HISTORY / NOTES

Reuse existing `CrmActivity`; no second timeline. Preserve cursor
pagination, source/date filters, localized event/source labels, deep
links and subject isolation. **History remains removed.**

Operational Notes remain audited append-only notes with RBAC. Preserve
Customer/Partner Notes and live Notes→Activity projection. Do not create
a second notes model.

------------------------------------------------------------------------

## 11. PAYMENT / REFUND OWNERSHIP --- HARD REGRESSION

Preserve:

``` text
Payment customer ownership =
Payment.customerId OR Payment.orderId → Order.customerId

Refund customer attribution =
Refund → Payment → payment.customerId
OR Refund → Payment → Order.customerId
```

`7e4fe8c` must remain preserved.

Runtime gates:

``` text
REFUND Activity customerId null = 0
cross-customer Refund leakage = 0
missing Refund Activity = 0
missing Payment Activity = 0
```

Do not regress to direct `Payment.customerId` only.

------------------------------------------------------------------------

## 12. PARTNER / CRM RELATIONSHIP AUTHORITY

Preserve `Order.sellerPartnerId` for Partner attribution and zero
cross-partner leakage.

Preserve:

``` text
Customer → PartnerCustomerRelation → Partner
```

Global Customer owns identity fields; PCR owns Partner-scoped lifecycle,
leadSource, assignedTo, tags and relationship history. Do not move
scoped state to global Customer.

------------------------------------------------------------------------

## 13. CRM ANALYTICS CONSUMER

Step 3.5E/3.5E.1 established shared backend:

``` text
AnalyticsService → getCrmAnalytics() → GET /analytics/crm
Platform scope → cross-partner
Partner scope → own Partner
```

`repeatCustomers` was removed because no canonical definition exists.
**Do not reintroduce it in UI.**

If Step 3.6 requires Analytics UI, consume `/analytics/crm`; do not
create another engine, frontend KPI formulas, Partner-specific
aggregation engine, or duplicate date/comparison framework. Repo-first
read the exact current 8-metric contract and map each UI metric to API
field/business label/format/period/scope/zero behavior.

Audit and reuse existing Analytics/Command Center KPI cards, date
controls, charts, skeletons, error/empty states and formatters where
semantically correct.

------------------------------------------------------------------------

## 14. PLATFORM VS PARTNER / ENTITLEMENT / SECURITY

Do not assume Step 3.6 requires both Platform and Partner analytics UIs;
roadmap decides. Architecture remains shared, UI consumers only as
canonical scope requires.

Preserve:

``` text
Entitlement ≠ Permission
Frontend hidden ≠ Security
```

Verify current 3.5E.1 endpoint authority from code; do not invent a new
tier rule in frontend. Server-side security is authoritative. Test
authorized Platform, missing permission, Partner→Platform CRM denial,
Partner A→Partner B denial and actual permission names.

------------------------------------------------------------------------

## 15. INFORMATION ARCHITECTURE / STATES / I18N

Audit current sidebar, CRM section, routes, breadcrumbs and page
hierarchy; align with existing design system. Human-readable
breadcrumbs, never UUID labels when resolvable.

Handle loading, success, empty, filtered-empty, error, unauthorized,
not-found and optional/partial data. Preserve deep-linkable 360
routes/tabs; invalid legacy `history` tab must not crash.

Validate RU/AZ/EN. New/changed surfaces require raw i18n keys=0, raw
enums=0, mixed locale=0, hardcoded Russian in EN/AZ=0. Use locale-aware
shared formatters. Activity presentation remains locale-neutral in data
and localized in frontend.

------------------------------------------------------------------------

## 16. API / PERFORMANCE / DATA SAFETY

No huge browser fetch + client aggregation. Use server
pagination/filters/analytics and typed API contracts. Any backend
enrichment must batch IDs→findMany→Map; no N+1 or invalid Prisma
relations.

Initial expectation: Schema=0, Migration=0. If genuine schema blocker
appears: STOP and report before large schema extension. No DB
reset/truncate/global reseed/destructive migration/data deletion to make
evidence pass.

------------------------------------------------------------------------

## 17. CLEAN RUNTIME

Before final browser validation: build current checkout, clear stale
`.next` when needed, stop stale frontend/backend, restart current
checkout, login via actual browser UI, confirm valid HttpOnly
`travelhub.auth`, hard reload.

Known Dashboard 404 was runtime/auth/cache state, not code regression.
curl/localStorage-only login is not proof of valid browser session.

------------------------------------------------------------------------

## 18. BROWSER EVIDENCE

Use actual browser runtime with authorized Platform user, Customer A/B
and Partner A/B. If Partner Workspace UI is canonical scope, use Partner
actors too.

For list pages prove load/search/pagination/filters/sorting where
supported/localization/human labels/navigation.

For each 360 use complete actual-tab matrix:

  ----------------------------------------------------------------------------
  Entity   Tab      Table/list   Detail   Deep     Filters   Locale   Result
                                          links                       
  -------- -------- ------------ -------- -------- --------- -------- --------

  ----------------------------------------------------------------------------

Do not claim 360 PASS from Overview only.

------------------------------------------------------------------------

## 19. ACTIVITY / REFUND / NOTES BROWSER PROOF

For representative Customer validate available Order, Booking, Payment,
Refund, Operational Note events: localized source/event, business code,
date, deep link, cursor/load-more, filters, no mixed locale.

For Refund reconcile exact counts:

``` text
DB/source → CrmActivity → API → Customer 360 Activity UI
```

Use one exact Customer and internally consistent counts; explain any
population difference.

For Notes validate Customer/Partner load, authorized create, visibility
after reload, Notes→Activity projection and unauthorized write denial.

------------------------------------------------------------------------

## 20. ANALYTICS BROWSER PROOF

If canonical Step 3.6 includes analytics UI, reconcile every displayed
metric API→UI with no frontend recomputation. Validate zero/non-zero,
period changes if supported, comparison only if actually exposed,
breakdowns, RU/AZ/EN, loading/error. `repeatCustomers` must be absent.

If both scopes are UI scope: Platform=cross-partner, Partner A=A only,
Partner B=B only, mandatory A→B→A. If only Platform UI is canonical, do
not create Partner UI merely for proof; keep API/service regression.

------------------------------------------------------------------------

## 21. UUID / PARITY AUDIT

Audit representative rows/details beyond first record across all Step
3.6 surfaces. Report surfaces, records, related references and
resolvable UUID visible labels; required result = 0.

Validate table↔detail identity parity for applicable Customer, Partner,
Order, Booking, Payment, Refund, Product/Service links.

------------------------------------------------------------------------

## 22. TESTS / REGRESSION

Add targeted tests for changed CRM Center/list/360/analytics/API
types/permissions/i18n/filters/states as applicable.

Run full:

``` text
Backend full tests + TSC + build
Frontend full tests + TSC + build
Analytics targeted tests
```

Require 0 failures, 0 new skipped. Analytics baseline must remain 65/65
or higher, 0 fail, and `repeatCustomers` absent from public API.

Smoke Steps 3.5.3, 3.5A/B/C/D/E/E.1; Activity, Notes, intake,
Customer↔Partner relation, Payment/Refund ownership, Partner
attribution, entitlement/permission.

------------------------------------------------------------------------

## 23. EXCLUSIONS / PRESERVATION

Preserve canonical Step 3.50 Workforce/Employee Performance Management
and reachability of `e4b38a3`; do not implement it.

Do not implement Supplier, Purchase, PurchaseItem, SupplierPayment,
CostAllocation, COGS, Payables or procurement profitability.

Do not infer employee performance from assignedTo/manager breakdown.
`Assignment ≠ Action ≠ Outcome`.

------------------------------------------------------------------------

## 24. FILE / REPORT / ROADMAP DISCIPLINE

Before commit inspect `git status --short`, `git diff --check`,
`git diff --stat`, `git diff`. Stage exact files only. Forbidden:
`git add .`, `git add -A`, force push.

Create:

``` text
docs/prompts/PHASE_3_STEP_3.6_CRM_CENTER_UI_IMPLEMENTATION_REPORT.md
```

Report actual roadmap discovery, UI inventory, actual 360 tabs,
analytics contract if applicable, related-entity audit, Payment/Refund
regression with exact counts, RU/AZ/EN matrix, security matrix, runtime
provenance and exact test counts.

Only after all gates PASS update canonical roadmap additively, preserve
Step 3.50/history, mark 3.6 COMPLETE, reread exact NEXT, and do not
start it.

------------------------------------------------------------------------

## 25. FINAL GIT CLOSURE

After exact commit/push:

``` bash
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
git log -8 --oneline --decorate
```

Require real Final HEAD/origin, HEAD==origin, clean worktree, and
preserved `7e52f68`, `7e4fe8c`, `9674ce0`, `e4b38a3`. No placeholders.

------------------------------------------------------------------------

## 26. VERDICT A HARD GATES

VERDICT A only when all applicable conditions are evidenced: canonical
scope audited; no Platform/Partner conflation; actual lists/360 tabs
work; Activity/Notes preserved; History absent; Payment/Refund ownership
and exact Refund DB→Activity→API→UI reconciliation pass;
`Order.sellerPartnerId` and isolation pass; human labels and UUID
leakage=0; table/detail parity; server-side filters/pagination/sorting;
RU/AZ/EN clean; all states/deep links work; analytics uses
`/analytics/crm` only if canonical; current 8-metric contract consumed;
`repeatCustomers` absent; API→UI values equal;
security/permissions/scopes pass; no N+1/invalid Prisma;
schema/migration remain 0 unless STOP; clean browser runtime/session;
representative A/B records validated; full backend/frontend/analytics
tests pass with 0 failures/new skips; prior CRM stages regressions pass;
Step 3.50 preserved; excluded domains not implemented; report and
roadmap correct; real Git closure; P0=0, P1=0, no unresolved in-scope
P2.

------------------------------------------------------------------------

## 27. VERDICT RULE

Success only:

``` text
VERDICT A — PHASE 3 — STEP 3.6 /
CRM CENTER UI /
[EXACT CANONICAL UI TOPOLOGY] /
RUNTIME + SECURITY + I18N + REGRESSION VERIFIED /
FULLY CLOSED
```

Otherwise:

``` text
VERDICT B — PHASE 3 — STEP 3.6 /
CRM CENTER UI /
INCOMPLETE

STEP 3.6 — OPEN
NEXT — BLOCKED
```

No conditional VERDICT A.

------------------------------------------------------------------------

## 28. REQUIRED FINAL RESPONSE FORMAT

``` text
VERDICT:

REPOSITORY
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
7e52f68 preserved:
7e4fe8c preserved:
9674ce0 preserved:
e4b38a3 preserved:
Worktree:

CANONICAL STEP 3.6
Exact scope:
Dependencies:
Required surfaces:
Exclusions:
Acceptance criteria:

UI INVENTORY
[complete matrix]

CRM CENTER
Route:
Navigation:
Search:
Filters:
Pagination:
States:
Result:

CUSTOMERS
Route:
API:
Search:
Filters:
Pagination:
Sorting:
Deep links:
Result:

CUSTOMER 360
Route:
Actual tabs:
[every actual tab + result]
UUID leakage:
Result:

PARTNERS
Route:
API:
Search:
Filters:
Pagination:
Sorting:
Deep links:
Result:

PARTNER 360
Route:
Actual tabs:
[every actual tab + result]
UUID leakage:
Result:

CRM ANALYTICS
Canonical UI scope:
API:
Exact metrics:
repeatCustomers:
Platform consumer:
Partner consumer:
API→UI reconciliation:
Period:
Comparison:
Breakdowns:
Result:

PAYMENT / REFUND REGRESSION
Payment ownership:
Refund ownership:
REFUND null customerId:
Cross-customer Payment leakage:
Cross-customer Refund leakage:
Missing Payment Activity:
Missing Refund Activity:
Representative Customer:
DB Refund count:
Activity Refund count:
API Refund count:
UI Refund count:

RELATED ENTITY DISPLAY
Surfaces audited:
Records audited:
References audited:
Resolvable UUID labels:
Table/detail parity:
Deep links:

SECURITY
Platform CRM:
Missing permission:
Partner → Platform CRM:
Partner A → Partner B:
Cross-partner leakage:
Entitlement:
Permission:

I18N
RU:
AZ:
EN:
Raw keys:
Raw enums:
Mixed locale:

RUNTIME
Backend build provenance:
Frontend build provenance:
Backend restart:
Frontend restart:
.next cache:
Browser UI login:
HttpOnly session:
Stale processes excluded:
Validation HEAD:

TESTS
Backend targeted:
Backend full:
Backend skipped:
Backend TSC:
Backend build:
Analytics:
Frontend targeted:
Frontend full:
Frontend skipped:
Frontend TSC:
Frontend build:

SCHEMA:
MIGRATION:
PRODUCTION CODE CHANGES:

PREVIOUS STAGE REGRESSION
Step 3.5.3:
Step 3.5A:
Step 3.5B:
Step 3.5C:
Step 3.5D:
Step 3.5E:
Step 3.5E.1:
Activity:
Notes:
Intake:
Payment ownership:
Refund ownership:
Partner attribution:
Entitlement:
History:

STEP 3.50 PRESERVED:
PERFORMANCE MANAGEMENT:
SUPPLIER / PROCUREMENT:

FILES CHANGED:
P0:
P1:
P2:

REPORT:
ROADMAP:
COMMIT:
PUSH:
HEAD == origin/master:
Worktree:

STEP 3.6 STATUS:
NEXT:
```

------------------------------------------------------------------------

## 29. STOP

After successful closure, reread the canonical roadmap and report exact
NEXT.

**STOP. Do not begin the next stage without a separate prompt.**
