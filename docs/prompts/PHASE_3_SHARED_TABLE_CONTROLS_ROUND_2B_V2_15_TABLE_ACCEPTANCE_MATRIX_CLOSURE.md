# PHASE 3 — SHARED TABLE CONTROLS
## ROUND 2B — ACCEPTANCE MATRIX CLOSURE — REVISED SCOPE (15 TABLES)
## PROJECT-WIDE FILTER COVERAGE / QUERY COMPOSITION / URL STATE / RUNTIME PROOF

### STATUS
Preserve commits `85c73a4` and `7fdeaf3`. Do not revert accepted fixes.

Current accepted functionality:
- CRM Customers: `Тип клиента` header restored; Customer Type sortable/filterable; Status filter.
- CRM Partners: Status filter.
- Orders: `Дата отмены` sorting uses `cancelledAt`.
- Users: Status + Role (`roleCode`) filters.
- Customer 360: Status filters for Orders, Bookings, Payments, Refunds.
- Partner 360: Status filters for Services, Orders, Bookings.

Current qualification before this round:
`VERDICT B — ACCEPTANCE MATRIX / PROJECT-WIDE FILTER COVERAGE / QUERY COMPOSITION / URL STATE RUNTIME PROOF INCOMPLETE`.

### EXECUTION RULE
Do not begin by adding arbitrary dropdowns. First audit all required tables, fill the complete pre-implementation matrix, classify every capability as `PASS`, `MISSING`, or `N/A`, justify every `N/A`, implement every `MISSING`, then browser-verify the final matrix.

### REQUIRED 15 TABLE CONTEXTS
1. CRM Customers
2. CRM Partners
3. Customer 360 Orders
4. Customer 360 Bookings
5. Customer 360 Payments
6. Customer 360 Partners
7. Customer 360 Refunds
8. Partner 360 Services
9. Partner 360 Orders
10. Partner 360 Bookings
11. Partner 360 Customers
12. Platform Orders
13. Platform Bookings
14. Platform Users
15. Platform Catalog

### SHARED CONTRACT
`Search + Filters + Sorting + Pagination + URL State`

Server order:
`authorization/scope → search/filters → sorting → pagination → render`.

No client-side filtering or sorting of only the current paginated page.

### PRE-IMPLEMENTATION ACCEPTANCE MATRIX — MANDATORY
| # | Table | Search | Filters | Sort | Pagination | URL State | Server-side | Structural Parity | Classification |
|---:|---|---|---|---|---|---|---|---|---|
|1|CRM Customers|||||||||
|2|CRM Partners|||||||||
|3|Customer 360 Orders|||||||||
|4|Customer 360 Bookings|||||||||
|5|Customer 360 Payments|||||||||
|6|Customer 360 Partners|||||||||
|7|Customer 360 Refunds|||||||||
|8|Partner 360 Services|||||||||
|9|Partner 360 Orders|||||||||
|10|Partner 360 Bookings|||||||||
|11|Partner 360 Customers|||||||||
|12|Platform Orders|||||||||
|13|Platform Bookings|||||||||
|14|Platform Users||||||||
|15|Platform Catalog|||||||||
|15|Platform Catalog|||||||||

No blank classifications. `N/A` requires a concrete business/schema reason. “Not implemented” means `MISSING`, not `N/A`.

### FILTER INVENTORY
For every table list all structured fields available, which are filterable, which are not, and why. Do not list only already-implemented filters.

### REQUIRED CANDIDATE AUDIT

**CRM Customers** — preserve Customer Type + Status. Audit Created date, Country, Segment and other actual structured dimensions.

**CRM Partners** — preserve Status. Audit Country, Partner type, Tier/Plan, Created date, Storefront status.

**Customer 360 Orders** — preserve Status. Audit Partner, Created date, Amount, Payment status.

**Customer 360 Bookings** — preserve Status. Audit Partner, Created date, Service date, Amount.

**Customer 360 Payments** — preserve Status. Audit Payment date and Order. Payment business date authority is `paidAt`, never `createdAt`.

**Customer 360 Partners** — audit Partner, Last activity and genuine aggregate dimensions. Do not invent relationship status.

**Customer 360 Refunds** — preserve Status. Audit Refund date, Order, Payment. Refund business date authority is `processedAt`.

**Partner 360 Services** — preserve Status. Audit Service/Product type, Created date and actual structured service dimensions.

**Partner 360 Orders** — preserve Status. Audit Customer, Created date, Amount, Payment status.

**Partner 360 Bookings** — preserve Status. Audit Customer, Created date, Service date, Amount.

**Partner 360 Customers** — audit Customer type, Last activity, and Status only if canonical. Do not invent relationship status.

**Platform Orders** — resolve every candidate: Order Status, Payment Status, Created Date, Cancellation Date, Partner, Customer, Amount. `Дата отмены` and cancellation filters must use `cancelledAt`; Created Date uses `createdAt`.

**Platform Bookings** — resolve Booking Status, Created Date, Service Date, Partner, Customer, Amount.

**Platform Users** — preserve Status + Role. Audit Created date, Last login/activity, User type. Role authority remains `roleCode`.

**Platform Catalog** — MUST be fully included in Shared Table Controls. Audit and implement where canonical/useful:
- Status
- Service/Product Type
- Partner
- Created Date range
- Price/Amount range
- other actual structured catalog dimensions

Sorting must be wired through the existing shared `SortableHeader` contract, not a separate catalog-only implementation. Audit sortable columns including, where present:
- Code
- Name
- Type
- Partner
- Price
- Status
- Created Date

Catalog queries must remain inside Platform authorization/workspace scope. Do not confuse Platform Catalog scope with `Partner 360 → Services` scope.

Every candidate above must be either `IMPLEMENTED` or `N/A + concrete reason`.

### CONTROL AUTHORITY
- Entity filters use canonical IDs (`customerId`, `partnerId`, `orderId`, etc.), while UI shows readable labels.
- Enum filters use canonical codes, not translated labels.
- Date authority: Order created=`createdAt`; Order cancelled=`cancelledAt`; Booking service=canonical service date; Payment=`paidAt`; Refund=`processedAt`; User last login=`lastLoginAt` if canonical.
- Amount ranges are numeric and validate min <= max.

### QUERY COMPOSITION
Different filter dimensions use AND.

Required state behavior:
- filter change → preserve search/sort/tab, page=1
- search change → preserve filters/sort/tab, page=1
- sort change → preserve search/filters/tab, replace prior user sort, page=1
- page change → preserve search/filters/sort/tab
- clear filters → remove filter params, preserve search/sort/tab, page=1

For 360 pages, `?tab=` must survive filtering, sorting and pagination.

### URL / HISTORY
Applicable state must live in URL: search, filters, sortBy, sortDirection, page, pageSize, tab.

Mandatory browser proof:
- Filter A + Filter B
- Filter + Search
- Filter + Sort
- Filter + Page 2
- Clear Filters
- Refresh
- Back
- Forward
- Direct copied URL
- Tab + Filter + Sort

### CUSTOMER TYPE REPRESENTATIVE DATA
Previous runtime: PERSON=241, COMPANY=0. Determine whether COMPANY is canonical. If yes, prefer deterministic representative COMPANY seed/fixture data. If unsafe, provide browser proof for PERSON plus isolated integration/backend fixture proof for COMPANY. Do not claim a zero-row browser result proves visual behavior with COMPANY rows.

### STRUCTURAL PARITY
For all 15 contexts:
`header count == body cell count`
and
`header semantic order == body semantic order`.

Provide a complete Structural Parity Matrix with no blank rows.

### REQUIRED FINAL FILTER COVERAGE MATRIX
| # | Table | Search | Filters Implemented | Sort | Pagination | URL State | Server-side | Browser PASS |
|---:|---|---|---|---|---|---|---|---|
|1|CRM Customers||||||||
|2|CRM Partners||||||||
|3|Customer Orders||||||||
|4|Customer Bookings||||||||
|5|Customer Payments||||||||
|6|Customer Partners||||||||
|7|Customer Refunds||||||||
|8|Partner Services||||||||
|9|Partner Orders||||||||
|10|Partner Bookings||||||||
|11|Partner Customers||||||||
|12|Platform Orders||||||||
|13|Platform Bookings||||||||
|14|Platform Users||||||||
|15|Platform Catalog||||||||

No blank rows.

### FILTER SEMANTICS MATRIX — MANDATORY
For every implemented filter:
| Table | UI Filter | URL/API Param | Canonical Field/Relation | Control Type | Server-side | PASS |
|---|---|---|---|---|---|---|

For every rejected candidate:
| Table | Candidate | Decision | Concrete Reason |
|---|---|---|---|
| | | N/A | |

### COMPOSITION MATRIX — MANDATORY
| Scenario | Table Used | URL Before | URL After | Result | PASS |
|---|---|---|---|---|---|
|Filter A + Filter B||||||
|Filter + Search||||||
|Filter + Sort||||||
|Filter + Page 2||||||
|Clear Filters||||||
|Refresh||||||
|Back||||||
|Forward||||||
|Direct URL||||||
|Tab + Filter + Sort||||||

No blank rows.

### BROWSER PROOF
**Platform Orders:** resolve and prove all applicable candidates (Status, Payment Status, Created Date, Cancellation Date, Partner, Customer, Amount) and prove `Дата отмены → cancelledAt`.

**Platform Bookings:** resolve all candidates and prove at least one enum plus one date/entity/range filter, filter+sort and page-2 persistence.

**Platform Users:** prove Status + Role; resolve Created Date, Last Login, User Type; prove pagination where filtered result >20.

**Customer 360:** for Orders, Bookings, Payments, Partners, Refunds show selected tab, visible filter, changed dataset/total, preserved tab in URL, compatible sorting.

**Partner 360:** same for Services, Orders, Bookings, Customers; Partner context must remain fixed.

### PLATFORM CATALOG — MANDATORY BROWSER PROOF
Audit the actual Catalog table and resolve every applicable candidate:
- Status
- Service/Product Type
- Partner
- Created Date
- Price/Amount
- other canonical structured dimensions found in the model

Mandatory sorting proof for all meaningful displayed sortable columns, including where present:
- Code
- Name
- Type
- Partner
- Price
- Status
- Created Date

Mandatory composition proof:
- Catalog filter + filter
- Catalog filter + search
- Catalog filter + sort
- Catalog filter/sort + page 2 where dataset permits
- Clear filters
- Refresh
- Back / Forward
- Direct URL

The same shared URL-state and single-column sorting rules apply. A new sort replaces the previous user sort.

Explicitly prove scope separation:
- Platform Catalog = platform-authorized catalog dataset
- Partner 360 Services = services scoped to the selected partner

Do not implement client-side filtering/sorting over only the current page.

### EMPTY / ERROR / LOADING
Distinguish:
- global empty
- filtered empty
- API error
- loading

No fake zero state during failures/loading.

### VALIDATION / SECURITY
Test applicable invalid enum, UUID, date, numeric range, min>max, unknown sort/filter key. Filters must never broaden RBAC, tenant, workspace, partner/customer or ownership scope.

### REGRESSION
Prove:
- single-column sorting contract remains
- Payment date sort/filter → `paidAt`
- Refund date sort/filter → `processedAt`
- Order cancellation sort/filter → `cancelledAt`
- Booking service date → canonical service date
- Customer/Partner/Order/Booking/Service detail links remain exact and functional

### TESTS
Frontend integration tests must cover filter URL hydration, page reset, filter+sort, filter+search, pagination, multi-filter AND, clear filters, tab preservation, customer type, user role, filtered-empty and error boundary.

Backend tests for changed endpoints must cover single/multi filter, filter+search/sort/pagination, validation, business dates and scope preservation.

### I18N
All new visible controls/options/messages: RU/AZ/EN. Raw i18n keys = 0.

### BUILD GATES
Required:
- Backend TSC
- Backend tests
- Backend build
- Frontend TSC
- Frontend tests
- Frontend build

Report exact counts.

### RUNTIME AUTHORITY
Report repository, branch, Starting SHA (`7fdeaf3` or descendant), Final SHA, origin/master, frontend PID/CWD/port, backend PID/CWD/port, API target. Browser evidence must come from the same localhost runtime observed by the user.


### CATALOG CLOSURE RULE
Platform Catalog is a first-class operational table in this Round. It may not be omitted from any required audit/matrix because it was absent from the earlier Round 2B scope.

Catalog must appear in:
- Pre-Implementation Acceptance Matrix
- Filter Inventory
- Final Filter Coverage Matrix
- Filter Semantics Matrix
- Rejected Candidate Matrix
- Structural Parity Matrix
- Composition evidence
- Sorting regression
- Browser runtime evidence

If Catalog is omitted from any of these applicable sections, VERDICT A is forbidden.

### NO PARTIAL VERDICT A
Adding several more filters plus green builds is NOT sufficient. Every one of the 14 rows must be explicit; every candidate must be IMPLEMENTED or justified N/A; every composition scenario must be proven.

### ACCEPTANCE
VERDICT A requires complete 15-table coverage, all mandatory matrices, project-wide query composition, URL/history persistence, structural parity, server-side authority, validation/security, business-date authority, browser evidence, regression, tests/builds, no unrelated changes, commit pushed, and `HEAD == origin/master`.

### VERDICT
Success only:

`VERDICT A — PHASE 3 SHARED TABLE CONTROLS ROUND 2B / ACCEPTANCE MATRIX CLOSURE / PROJECT-WIDE FILTER COVERAGE / SEARCH + FILTER + SORT + PAGINATION + URL STATE COMPOSITION / FULL RUNTIME CLOSURE`

Failure:

`VERDICT B — SHARED TABLE CONTROLS ACCEPTANCE MATRIX STILL INCOMPLETE`

No conditional or “mostly complete” VERDICT A.

### REQUIRED REPORT
Create:
`docs/prompts/PHASE_3_SHARED_TABLE_CONTROLS_ROUND_2B_ACCEPTANCE_MATRIX_CLOSURE_V2_REPORT.md`

### FINAL RESPONSE FORMAT
Include, in order:
- VERDICT
- PRECONDITION / starting SHA / preservation of `85c73a4` and `7fdeaf3`
- WHY ROUND 2A WAS NOT CLOSED
- PRE-IMPLEMENTATION ACCEPTANCE MATRIX
- FILTER INVENTORY for all 15 contexts
- IMPLEMENTED MISSING CAPABILITIES
- N/A DECISIONS
- FINAL FILTER COVERAGE MATRIX
- FILTER SEMANTICS MATRIX
- REJECTED CANDIDATE MATRIX
- STRUCTURAL PARITY MATRIX
- COMPOSITION MATRIX
- CRM Customers / CRM Partners evidence
- Customer 360 evidence
- Partner 360 evidence
- Platform Orders / Bookings / Users / Catalog evidence
- Query composition evidence
- URL/history evidence
- Business-date authority
- Security/validation
- Sorting/detail-link regression
- Runtime authority
- Backend/Frontend gates with exact counts
- Production files changed / unrelated files
- Commit / HEAD / origin/master / parity
- Report path
- Remaining findings
- Next canonical stage

### STOP
After the report: STOP.

Do NOT start Operational Notes / Comments.
Do NOT start Storefront Pro CRM.
Do NOT start Marketplace Basic CRM finalization.
Do NOT start Partner Workspace sidebar implementation.

Shared Table Controls may be declared CLOSED only when the complete 15-table acceptance matrix and runtime composition evidence are actually present.
