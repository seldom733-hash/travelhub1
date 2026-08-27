# PHASE 3 — SHARED TABLE CONTROLS
## ROUND 2C — FINAL URL STATE + BOOKINGS SEARCH + 360 FILTER AUTHORITY CLOSURE

### PRECONDITION
Preserve accepted commits: `85c73a4`, `7fdeaf3`, `c93057b`.

Round 2B correctly ended with:
`VERDICT B — URL STATE PERSISTENCE INCOMPLETE`.

Preserve Catalog shared sorting from `c93057b`: backend `sortBy/sortDirection`, shared `buildSortClause`, allowlist, legacy sort fallback, frontend `SortableHeader`, URL sort params and server-side sorting.

### PURPOSE
Close only the remaining Shared Table Controls gaps:
1. URL state persistence.
2. Platform Bookings server-side search.
3. 360 sub-table filter-authority decision.
4. Customer Partners / Partner Customers justified N/A where canonical relation fields do not exist.
5. Final runtime composition proof.

Do not reopen accepted functionality unless a regression is found.

### TARGET CONTRACT
For applicable tables:
`Search + Filters + Single-column Sorting + Pagination + URL State`.

Applicable URL state: `search`, filters, `sortBy`, `sortDirection`, `page`, `pageSize`, `tab`.

### REQUIRED URL-STATE AUDIT
Close and browser-prove:
- CRM Customers
- CRM Partners
- Platform Users
- Platform Bookings
- Platform Orders (regression)
- Platform Catalog
- Customer 360 tabs
- Partner 360 tabs

Initial direct URL must hydrate all controls without an extra click.

State transitions:
- filter change → preserve search/sort/tab, page=1
- search change → preserve filters/sort/tab, page=1
- sort change → preserve search/filters/tab, replace previous sort, page=1
- page change → preserve search/filters/sort/tab
- clear filters → remove filter params, preserve search/sort/tab, page=1

### HISTORY CONTRACT
Mandatory browser proof:
`Search + Filter(s) + Sort + Page 2 → Refresh → Back → Back → Forward → Direct URL`.

At every step URL, controls, rows, active arrow, page and selected 360 tab must agree.

### CRM
CRM Customers and CRM Partners must persist applicable search, filters, sort and page in URL.

Preserve CRM Customer:
- `Тип клиента`
- PERSON / COMPANY canonical values
- Customer Type sorting/filtering
- Status filter

Do not invent production COMPANY records merely for this round.

### USERS
Preserve Status and Role (`roleCode`) filters. URL must preserve applicable search, status, roleCode, sortBy, sortDirection and page.

Runtime proof should combine actual filters, e.g. `status=ACTIVE + roleCode=OPERATOR + sort`.

### PLATFORM BOOKINGS — SERVER-SIDE SEARCH
Add canonical backend Bookings search.

Audit actual schema/relations first. Candidate searchable fields may include booking code, customer name/email, service/product name, partner name/code, but ONLY implement fields actually available through canonical query relations.

Search must be:
- server-side
- authorization/scope preserving
- before pagination
- composable with filters
- composable with sorting

Forbidden: fetching one page and filtering it in frontend.

Add validated query parameter following existing project conventions (normally `search`).

Conceptual query:
`authorized scope AND structured filters AND search predicate → ORDER BY → pagination`.

Bookings URL must preserve search, implemented filters, sort and page.

Mandatory browser proof:
`search → filter → sort → page 2 (if possible) → Refresh → Back → Forward → direct URL`.

### PLATFORM ORDERS — REGRESSION
Do not redesign Orders. Verify URL persistence and preserve:
`Дата отмены → cancelledAt`.
Creation date and cancellation date remain separate business dimensions.

### PLATFORM CATALOG
Round 2B proved Catalog sorting. Round 2C must prove full navigable URL state for all actual Catalog controls.

Preserve shared `SortableHeader`; do not create Catalog-only sorting logic.

Regression-proof currently wired sorting including:
- Code
- Name
- Type
- Status

If Catalog has search/filters/pagination, they must compose with sorting and URL state.

Catalog previously reported total=282, so cross-page proof should normally be possible.

### 360 FILTER AUTHORITY — REQUIRED CLASSIFICATION
For EACH tab classify independently:

Customer 360:
- Orders
- Bookings
- Payments
- Partners
- Refunds

Partner 360:
- Services
- Orders
- Bookings
- Customers

Allowed authority:
- `SERVER`
- `BOUNDED_CLIENT_EXEMPTION`
- `N/A_NO_FILTER`

#### SERVER RULE
If the sub-table can grow materially, is independently paginated, or backend returns only a page/window, filtering/search/sorting must be server-side.

#### BOUNDED CLIENT EXEMPTION
Client-side filtering is acceptable ONLY if ALL are proven:
1. endpoint intentionally returns the complete bounded collection;
2. no independent pagination;
3. no hidden records outside returned payload;
4. expected/max cardinality is operationally bounded;
5. filtering cannot misrepresent totals/results;
6. authorization/scope is already applied server-side;
7. sorting/filtering remains deterministic.

For every exemption report:
- endpoint
- payload shape
- independent pagination YES/NO
- returned count
- expected/max cardinality
- complete collection guarantee
- authorization scope
- why client filtering is semantically correct

Vague statements such as “small table” or “architecturally justified” are insufficient.

### 360 URL STATE
Regardless of filter authority, user-navigable state must be URL-backed where controls exist:
`tab + filters + sortBy + sortDirection + page/search where applicable`.

Filtering/sorting must never return the user to Overview accidentally.

### CUSTOMER PARTNERS / PARTNER CUSTOMERS
Verify source/schema.

If relation aggregate has no canonical relationship status/type, formally record:
- Customer 360 Partners Status = N/A
- Customer 360 Partners Relationship Type = N/A
- Partner 360 Customers Relationship Status = N/A
- Partner 360 Customers Relationship Type = N/A

Reason: transaction-derived commercial aggregate has no canonical relationship status/type authority.

Do not fabricate CRM states.

If actual Customer Type exists, distinguish it from Relationship Type; they are different concepts.

### BUSINESS DATE REGRESSION
Preserve:
- Payment Date → `paidAt`
- Refund Date → `processedAt`
- Order Cancellation Date → `cancelledAt`
- Booking Service Date → canonical service date

Never substitute `createdAt` for these events.

### QUERY COMPOSITION
Prove actual runtime composition:
- Filter A + Filter B (AND)
- Search + Filter
- Filter + Sort
- Search + Filter + Sort
- Search + Filter + Sort + Page 2
- Clear Filters
- Refresh
- Back
- Forward
- Direct URL
- 360 Tab + Filter + Sort

Different filter dimensions use AND.

### VALIDATION / SAFETY
Audit applicable invalid URL state:
- unknown sortBy
- invalid sortDirection
- invalid enum
- invalid page/pageSize
- invalid UUID/entity filter
- invalid date/range

No arbitrary field injection.

URL manipulation must never broaden RBAC, workspace, tenant, partner/customer or ownership scope.

### EMPTY / ERROR / LOADING / RACE
Preserve:
- loading != empty
- API error != zero
- filtered empty != global empty

Rapid search/filter/history changes must not allow stale responses to overwrite newer URL state.

### REQUIRED URL STATE MATRIX
| Page/Table | Search URL | Filters URL | Sort URL | Page URL | Tab Preserved | Refresh | Back/Forward | Direct URL | PASS |
|---|---|---|---|---|---|---|---|---|---|
| CRM Customers | | | | | N/A | | | | |
| CRM Partners | | | | | N/A | | | | |
| Platform Users | | | | | N/A | | | | |
| Platform Bookings | | | | | N/A | | | | |
| Platform Orders | | | | | N/A | | | | |
| Platform Catalog | | | | | N/A | | | | |
| Customer 360 Orders | | | | | | | | | |
| Customer 360 Bookings | | | | | | | | | |
| Customer 360 Payments | | | | | | | | | |
| Customer 360 Partners | | | | | | | | | |
| Customer 360 Refunds | | | | | | | | | |
| Partner 360 Services | | | | | | | | | |
| Partner 360 Orders | | | | | | | | | |
| Partner 360 Bookings | | | | | | | | | |
| Partner 360 Customers | | | | | | | | | |

No blank rows. Use explicit `N/A + reason` where appropriate.

### REQUIRED 360 AUTHORITY MATRIX
| Context | Tab | Endpoint | Pagination | Complete Bounded Payload? | Filter Authority | Evidence | PASS |
|---|---|---|---|---|---|---|---|
| Customer | Orders | | | | | | |
| Customer | Bookings | | | | | | |
| Customer | Payments | | | | | | |
| Customer | Partners | | | | | | |
| Customer | Refunds | | | | | | |
| Partner | Services | | | | | | |
| Partner | Orders | | | | | | |
| Partner | Bookings | | | | | | |
| Partner | Customers | | | | | | |

No blank rows.

### REQUIRED BOOKINGS SEARCH MATRIX
| Item | Result |
|---|---|
| Query param | |
| Searchable canonical fields | |
| Backend implementation | |
| Authorization scope preserved | |
| Search before pagination | |
| Search + filter | |
| Search + sort | |
| Search + page | |
| URL hydration | |
| Browser runtime | |
| Tests | |

### REQUIRED COMPOSITION MATRIX
| Scenario | Page/Table | URL Before | URL After | Result | PASS |
|---|---|---|---|---|---|
| Filter A + Filter B | | | | | |
| Search + Filter | | | | | |
| Filter + Sort | | | | | |
| Search + Filter + Sort | | | | | |
| Search + Filter + Sort + Page 2 | | | | | |
| Clear Filters | | | | | |
| Refresh | | | | | |
| Back | | | | | |
| Forward | | | | | |
| Direct URL | | | | | |
| 360 Tab + Filter + Sort | | | | | |

No blank rows.

### TESTS
Backend: add/update Bookings search tests for supported fields, search+filter, search+sort, search+pagination, empty search and scope preservation.

Frontend integration tests: URL hydration, filter URL writes, sort preserves filters, search preserves filters, page preserves state, 360 tab preservation, Bookings search URL, Catalog sort URL, clear filters, invalid URL fallback, and history handling where testable.

Do not test only helper primitives.

### I18N
Any new visible labels/messages: RU/AZ/EN. Raw keys = 0.

### BUILD GATES
Required:
- Backend TSC
- Backend tests
- Backend build
- Frontend TSC
- Frontend tests
- Frontend build

Report exact test counts.

### RUNTIME AUTHORITY
Report:
- Repository path
- Branch
- Starting SHA = `c93057b` or actual descendant
- Final SHA
- origin/master
- Frontend PID/CWD/port
- Backend PID/CWD/port
- API target

Browser evidence MUST use the same localhost runtime observed by the user.

### FILE SCOPE
Allowed changes only:
- Shared Table Controls URL state
- Bookings search
- 360 filter authority/exemption support
- necessary tests/i18n
- required report

Do NOT start:
- Operational Notes / Comments
- Storefront Pro CRM
- Marketplace Basic CRM finalization
- Partner Workspace sidebar implementation
- unrelated CRM features

### ACCEPTANCE CRITERIA
VERDICT A requires:
1. `85c73a4`, `7fdeaf3`, `c93057b` preserved.
2. CRM Customers/Partners URL state closed.
3. Users URL state closed.
4. Bookings URL state closed.
5. Orders URL regression PASS.
6. Catalog URL state closed and sorting preserved.
7. Bookings server-side search implemented and scope-safe.
8. Search occurs before pagination and composes with filters/sort/page.
9. Search/filter/sort/page/tab hydrate from URL.
10. Refresh, Back, Forward and Direct URL reproduce state.
11. Page-reset rules pass.
12. Clear Filters contract passes.
13. All nine 360 tabs individually classified.
14. Every bounded-client exemption has concrete evidence.
15. No client filtering of partial paginated datasets.
16. Customer Partners / Partner Customers N/A decisions are source/schema justified.
17. Business-date authority remains `paidAt` / `processedAt` / `cancelledAt` / canonical booking service date.
18. Single-column sorting regression passes across affected pages.
19. Error/loading/filtered-empty boundaries remain correct.
20. Validation and RBAC/workspace/tenant/entity scopes remain safe.
21. URL State Matrix has no blank rows.
22. 360 Authority Matrix has no blank rows.
23. Bookings Search Matrix is complete.
24. Composition Matrix has no blank rows.
25. Required browser evidence is supplied for CRM, Users, Bookings, Catalog, Orders and 360.
26. Backend/Frontend tests and builds pass with exact counts.
27. Raw i18n keys = 0.
28. Unrelated production changes = 0.
29. Commit pushed and HEAD == origin/master.
30. Browser proof is from the same localhost runtime observed by the user.

### VERDICT
Success only:

`VERDICT A — PHASE 3 SHARED TABLE CONTROLS ROUND 2C / FINAL URL STATE + BOOKINGS SEARCH + 360 FILTER AUTHORITY / SEARCH + FILTER + SORT + PAGINATION + URL HISTORY / FULL RUNTIME CLOSURE — SHARED TABLE CONTROLS FINAL CLOSED`

Failure:

`VERDICT B — SHARED TABLE CONTROLS FINAL CLOSURE INCOMPLETE`

No conditional VERDICT A. No unsupported “architecturally justified” exemption.

### REQUIRED REPORT
Create:
`docs/prompts/PHASE_3_SHARED_TABLE_CONTROLS_ROUND_2C_FINAL_URL_STATE_BOOKINGS_SEARCH_360_AUTHORITY_CLOSURE_REPORT.md`

### FINAL RESPONSE FORMAT
Include:
- VERDICT
- PRECONDITION / repository / branch / starting SHA
- preservation of `85c73a4`, `7fdeaf3`, `c93057b`
- Round 2B gaps
- implementation summary
- Bookings Search Matrix
- URL State Matrix
- 360 Authority Matrix
- Customer Partners / Partner Customers N/A decisions
- Composition Matrix
- Refresh / Back / Forward / Direct URL evidence
- CRM browser evidence
- Users browser evidence
- Bookings browser evidence
- Catalog browser evidence
- Orders regression evidence
- Customer 360 evidence
- Partner 360 evidence
- business-date authority
- sorting regression
- security/validation
- tests
- runtime authority
- changed/unrelated files
- commit / HEAD / origin/master parity
- report path
- remaining findings
- Shared Table Controls status
- next canonical stage

### STOP
After the report: STOP.

If VERDICT A:
`Shared Table Controls = FINAL CLOSED`.

Only then may the next canonical stage be proposed:
`Operational Notes / Comments Architecture Reconciliation`.

Do not implement that next stage in this prompt.
