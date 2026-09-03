# PHASE 3 — STEP 3.5.3 — PLATFORM CRM
## CRM COMMUNICATIONS + ACTIVITY TIMELINE IMPLEMENTATION
## ROUND 2B — ACTIVITY API + RBAC + CURSOR PAGINATION + SERVER-SIDE FILTERING + SUBJECT AUTHORITY

---

# 1. PRECONDITION

Canonical roadmap reconciliation is complete.

```text
Repository: travelhub_v1
Branch: master
Round 1 Architecture: 2b0438a — CLOSED
Round 2A functional implementation: 227c9e6 — CLOSED
Synchronized HEAD/origin/master at roadmap closure: 4e36d930bebe75aa81593a6cb93a4cdacf5e70e0
Canonical roadmap: docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Verify actual repository state before coding. A legitimate newer HEAD is allowed, but must be explained.

Canonical NEXT:

```text
ROUND 2B — ACTIVITY API + RBAC + CURSOR PAGINATION
+ SERVER-SIDE FILTERING + SUBJECT AUTHORITY
```

# 2. PURPOSE

Implement the secure server-side read contract over the Round 2A `CrmActivity` read model.

Required:

```text
Customer activity API
Partner activity API
crm.activity.read page gate
source-specific per-item authorization
Customer/Partner subject authority
tenant/workspace/partner scope enforcement
cursor pagination
occurredAt DESC, id DESC
server-side filters
safe DTO projection
exact source/deep-link metadata
zero/404/403/400 boundaries
tests + runtime evidence
```

Do NOT implement Activity UI, Customer 360 Activity tab, Partner 360 Activity tab, composer, new communication channels, new source types, or unrelated refactors.

# 3. READ AUTHORITIES FIRST

Before coding read:

1. Canonical roadmap.
2. Step 3.5.3 Round 1 architecture report.
3. Round 2A implementation report.
4. Current CrmActivity schema/service/adapters/tests.
5. Existing Security/RBAC infrastructure.
6. Existing Customer/Partner CRM authorization.
7. Existing pagination/cursor utilities.

If implementation conflicts with accepted architecture, classify and report it rather than silently redesigning it.

# 4. ROUTES

Implement subject-scoped routes, following repository controller conventions. Preferred:

```http
GET /api/v1/crm/customers/:customerId/activity
GET /api/v1/crm/partners/:partnerId/activity
```

Do not expose an unsafe broad unscoped activity feed unless already required by accepted architecture.

The canonical Customer/Partner entity, not the existence of a CrmActivity row, establishes subject existence.

# 5. SUBJECT AUTHORITY / IDOR

Knowing a UUID is never sufficient.

Enforce canonical:

```text
authentication
workspace/tenant scope
partner scope where applicable
subject access
RBAC
```

Negative tests must cover nonexistent, foreign/out-of-scope, and cross-partner/cross-tenant subjects as applicable.

# 6. TWO-LEVEL RBAC

Mandatory:

```text
LEVEL 1: crm.activity.read
LEVEL 2: source-specific item authorization
```

If `crm.activity.read` does not exist, add it via the existing permission constants/descriptions/role matrix. No controller-local ad-hoc strings.

Audit actual roles and fill:

| Role | crm.activity.read | Reason |
|---|---:|---|
| ADMIN | | |
| DIRECTOR | | |
| ANALYST | | |
| MARKETER | | |
| FINANCE | | |
| MODERATOR | | |
| SALES_MANAGER | | |
| OPERATOR | | |

Use least privilege. Do not grant permissions merely to make tests pass.

# 7. SOURCE-SPECIFIC ITEM GATES

Round 2A canonical sources:

```text
OPERATIONAL_NOTE
ORDER
BOOKING
PAYMENT
REFUND
MESSAGE
AUDIT
CUSTOMER_HISTORY
BUYER_REQUEST
PARTNER_APPLICATION
```

For each, map to the real existing source permission/access authority. Do not invent permission names.

| Source Type | Page Gate | Item Gate | Additional Scope Check | Unauthorized Behavior |
|---|---|---|---|---|
| OPERATIONAL_NOTE | crm.activity.read | | | omit |
| ORDER | crm.activity.read | | | omit |
| BOOKING | crm.activity.read | | | omit |
| PAYMENT | crm.activity.read | | | omit |
| REFUND | crm.activity.read | | | omit |
| MESSAGE | crm.activity.read | | | omit |
| AUDIT | crm.activity.read | | | omit |
| CUSTOMER_HISTORY | crm.activity.read | | | omit |
| BUYER_REQUEST | crm.activity.read | | | omit |
| PARTNER_APPLICATION | crm.activity.read | | | omit |

No blank rows in the final report.

Rules:

```text
no crm.activity.read → whole endpoint forbidden
valid subject + page permission + unauthorized source item → omit item
```

Frontend hiding is not a security boundary.

# 8. NO INFORMATION LEAKAGE

Hidden items must not leak through:

```text
items
total/count
hasMore
nextCursor
filter counts
source counts
```

Pagination operates over the authorized logical stream.

Critical case: a candidate DB batch containing hidden items must not incorrectly produce `hasMore=false` while later authorized rows exist.

# 9. AUTHORIZED PAGINATION

A naïve:

```text
DB LIMIT 20 → authorize → return 7
```

is insufficient.

Implement bounded over-fetch/iterative candidate retrieval or an equivalent secure strategy.

Properties:

```text
bounded DB batches
no infinite loop
stable ordering
all authorized rows eventually reachable
hidden rows never returned
no hidden-row count leakage
```

`nextCursor` must represent the consumed candidate-stream position needed to continue safely.

# 10. CURSOR CONTRACT

Use keyset pagination:

```text
occurredAt DESC
id DESC
```

Cursor tuple:

```text
occurredAt
id
```

Client-facing cursor is opaque and strictly validated.

Recommended:

```text
default limit = 20
max limit = 100
```

unless repository conventions define other bounds.

Malformed cursor → 400, not 500.

Do not substitute offset/page pagination.

Do not add total/totalPages unless the accepted architecture requires them.

Same-timestamp rows must be deterministic with no duplicates or omissions across pages.

# 11. CURSOR SECURITY

A cursor must not widen scope.

Test:

```text
tampered cursor
malformed encoding
missing tuple field
invalid timestamp
invalid id
Customer A cursor used on Customer B
Partner A cursor used on Partner B
cursor reused with changed filters
```

Prefer subject/query fingerprint binding where appropriate. At minimum prove query predicates make reuse incapable of escaping subject/filter authority.

# 12. SERVER-SIDE FILTERS

Audit the architecture and implement supported filters, at minimum evaluating:

```text
sourceType
activityType
dateFrom
dateTo
actorUserId
```

Use strict allowlists/enums.

`dateFrom/dateTo` operate on `occurredAt`, never projection `createdAt`.

Subject ID comes from route and cannot be overridden by query params.

Invalid enum/date/limit/cursor → canonical 400.

If valid `sourceType` + valid but incompatible `activityType` is requested, use a deterministic documented contract (prefer empty result unless project conventions dictate 400).

Changing filters must never let an old cursor reveal out-of-filter rows.

# 13. QUERY PIPELINE

Push safe constraints to DB:

```text
customerId/partnerId
sourceType
activityType
occurredAt range
cursor predicate
```

Then:

```text
candidate rows
→ group/batch by sourceType where useful
→ source-specific authorization
→ preserve occurredAt/id order
→ safe DTO
→ authorized cursor/pageInfo
```

Avoid loading full timelines into memory.

Avoid one expensive source fetch per row where batching is possible. Do not weaken security for performance.

# 14. SAFE RESPONSE DTO

Do not expose raw Prisma CrmActivity records.

Expose only fields needed by Round 2C/2D, based on actual Round 2A schema, e.g.:

```text
id
sourceType
sourceId
activityType
occurredAt
safe actor projection
title
summary
safe amount/currency where accepted
source reference / deepLink
```

Never expose unnecessary:

```text
dedupe key internals
projection version internals
tenant/security internals
raw audit payload
payment provider secrets
full sensitive message body
unauthorized OperationalNote text
```

Fill:

| Field | Customer API | Partner API | Source | Nullable | Security Notes |
|---|---:|---:|---|---:|---|
| id | | | | | |
| sourceType | | | | | |
| sourceId | | | | | |
| activityType | | | | | |
| occurredAt | | | | | |
| actor | | | | | |
| title | | | | | |
| summary | | | | | |
| deepLink | | | | | |

Add all actual exposed fields.

# 15. EXACT NAVIGATION

Provide a source/deep-link only when a real detail surface exists and the user is authorized.

Known project surfaces may include:

```text
/app/orders/:id
/app/bookings/:id
/app/catalog/:id
/app/crm/customers/:id
/app/crm/partners/:id
```

Audit actual routes. Do not invent routes. If no detail surface exists, return null/no link.

A deep link is never an authorization grant.

# 16. SOURCE SAFETY

OperationalNote:
- preserve existing Notes RBAC;
- INTERNAL content must not leak.

Message:
- preserve canonical conversation membership/read authority;
- do not expose conversation existence/content without access.

Payment/Refund:
- enforce finance-specific authority;
- preserve stored canonical occurredAt (`paidAt`/`processedAt` projection semantics).

Audit:
- expose only safe CrmActivity projection;
- never raw audit payload.

CustomerHistory:
- no legacy bypass.

BuyerRequest / PartnerApplication:
- apply real canonical access rules; external origin does not make them public.

# 17. RESPONSE BOUNDARIES

```text
valid subject + no authorized activity → 200, items=[], hasMore=false, nextCursor=null
nonexistent canonical subject → canonical 404
missing page-level permission → 403
out-of-scope subject → existing canonical 403/404 security semantics
malformed filters/cursor → 400
```

Source authorization uncertainty/errors fail closed. Never include an item when authorization cannot be established.

# 18. FILTER CONTRACT MATRIX

Fill actual implementation:

| Query Param | Type | Default | Allowed Values / Format | DB Field | Validation |
|---|---|---|---|---|---|
| limit | | | | | |
| cursor | | | | | |
| sourceType | | | | | |
| activityType | | | | | |
| dateFrom | | | | | |
| dateTo | | | | | |
| actorUserId | | | | | |

Remove unsupported filters rather than claiming them.

# 19. CURSOR CONTRACT MATRIX

| Property | Implemented Value |
|---|---|
| Ordering | occurredAt DESC, id DESC |
| Cursor tuple | |
| Encoding | |
| Validation | |
| Subject binding | |
| Filter binding | |
| Default limit | |
| Max limit | |
| hasMore calculation | |
| Hidden-item handling | |

No blank rows.

# 20. AUTHORIZATION PIPELINE MATRIX

| Stage | Authority | Failure Behavior |
|---|---|---|
| Authentication | | |
| crm.activity.read | | |
| Subject existence | | |
| Subject scope | | |
| Candidate DB query | | |
| Source-specific gate | | |
| Safe DTO projection | | |
| Cursor generation | | |

# 21. TESTS — CUSTOMER

Mandatory:

```text
authorized subject with activity → 200
valid zero state → 200 []
nonexistent → 404
no crm.activity.read → 403
out-of-scope subject denied
sourceType exact subset
activityType exact subset
date range exact subset
valid cursor next page
malformed cursor → 400
same-timestamp stable pagination
hidden source item omitted
hidden items across pages do not leak
```

# 22. TESTS — PARTNER

Mandatory:

```text
authorized subject with activity
zero state
nonexistent
missing page permission
out-of-scope/cross-partner
source/activity/date filters
cursor
same-timestamp stability
hidden source omission
cross-partner item never returned
```

# 23. MIXED-AUTH PAGINATION TEST

Construct a stream such as:

```text
authorized
unauthorized
unauthorized
authorized
authorized
unauthorized
authorized
```

Across multiple pages prove:

```text
every authorized row appears exactly once
no unauthorized row appears
hasMore is correct
cursor is stable
no hidden count is exposed
```

This is a P0 acceptance gate.

# 24. RBAC TESTS

At minimum:

```text
role with crm.activity.read
role without it
role with activity but without finance source access
role with activity but without OperationalNote access
role with activity but without Message access
ADMIN behavior only as existing authority defines
```

All 10 source types must have an explicit authorization classification and relevant tests.

# 25. FILTER TESTS

Test:

```text
sourceType
activityType
dateFrom
dateTo
dateFrom+dateTo
sourceType+activityType
sourceType+date range
activityType+date range
all supported filters
filter+cursor
exact inclusive/exclusive boundary semantics
```

# 26. DUAL-SUBJECT TEST

Pick a real commercial activity (Order/Booking/Payment/Refund).

Prove the same logical activity:

```text
appears in authorized Customer timeline
appears in authorized Partner timeline
does not duplicate within either timeline
does not escape either subject scope
```

# 27. BUSINESS DATE REGRESSION

Prove API exposes Round 2A canonical occurredAt unchanged:

```text
Payment captured → paidAt-derived occurredAt
Refund processed → processedAt-derived occurredAt
Order cancellation → cancelledAt-derived occurredAt
```

No fallback remapping.

# 28. QUERY / INDEX EVIDENCE

Verify Customer and Partner query shapes against Round 2A indexes.

Use representative EXPLAIN evidence where practical.

Report honestly whether planner uses:

```text
index scan
bitmap scan
seq scan because dataset is small
```

No invented performance claim and no arbitrary new SLO.

# 29. REGRESSION

Required:

```text
Backend TSC
Activity API unit tests
Activity API e2e/integration
RBAC tests
cursor tests
filter tests
source-specific authorization tests
Round 2A CrmActivity tests
Operational Notes relevant tests
CRM relevant tests
full backend suite
Backend build
Frontend TSC
Frontend tests
Frontend build
```

Report exact counts.

Historical perf-harness flakiness, if it recurs, must be separately classified. Do not use it to waive a new regression.

# 30. RUNTIME AUTHORITY

Verify against the actual process for the implementation under test:

```text
Git HEAD
origin/master
Backend PID
CWD
port
API base
Database
migration status
```

Do not provide curl/browser evidence against stale processes.

# 31. RUNTIME PROOF

Customer:
- first page;
- next page;
- source filter;
- activity filter;
- date filter;
- zero result.

Partner:
- first page;
- next page if enough data;
- filter;
- representative dual-subject commercial event.

RBAC:
- authorized role;
- unauthorized role;
- partially authorized role.

Cursor:
- page 1 IDs;
- nextCursor;
- page 2 IDs;
- intersection empty;
- ordering valid.

No-leak:
- a known hidden activity exists;
- API omits it;
- later authorized activity remains reachable;
- no count/hasMore/cursor leakage.

Never include credentials/tokens in the report.

# 32. CHANGE BOUNDARY

Allowed:

```text
permission constants/descriptions/role assignments
CRM Activity controller/DTO/service/query/authorization helpers
CRM Activity module
tests
minimal API type definitions if truly required
report
```

Forbidden:

```text
Activity UI
Customer 360 Activity tab
Partner 360 Activity tab
composer
new communication channels
new source taxonomy
Storefront Pro CRM
Marketplace Basic CRM
unrelated production refactors
```

# 33. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2B_API_RBAC_CURSOR_FILTERING_SUBJECT_AUTHORITY_REPORT.md
```

# 34. FINAL RESPONSE FORMAT

Return:

```text
VERDICT:

PRECONDITION
Repository:
Branch:
Starting HEAD:
Round 2A SHA:
Canonical roadmap NEXT verified:

ARCHITECTURE AUTHORITY
Round 1 report read:
Round 2A report read:
Conflicts found:

IMPLEMENTATION SUMMARY

ROUTES
Customer:
Partner:

PERMISSION MATRIX
...

SOURCE AUTHORIZATION MATRIX
...

AUTHORIZATION PIPELINE MATRIX
...

RESPONSE CONTRACT MATRIX
...

FILTER CONTRACT MATRIX
...

CURSOR CONTRACT MATRIX
...

SUBJECT AUTHORITY
Customer:
Partner:
Cross-tenant/cross-partner:
IDOR tests:

AUTHORIZED PAGINATION
Candidate strategy:
Over-fetch/batching:
Hidden-item handling:
nextCursor authority:
Count leakage:

SOURCE-SPECIFIC AUTHORITY
OperationalNote:
Order:
Booking:
Payment:
Refund:
Message:
Audit:
CustomerHistory:
BuyerRequest:
PartnerApplication:

DATA MINIMIZATION
...

QUERY / INDEX EVIDENCE
...

RUNTIME CUSTOMER PROOF
...
RUNTIME PARTNER PROOF
...
RUNTIME RBAC PROOF
...
RUNTIME CURSOR PROOF
...
RUNTIME NO-LEAK PROOF
...

BUSINESS DATE REGRESSION
Payment:
Refund:
Order cancellation:

ROUND 2A REGRESSION
...

REGRESSION
Backend TSC:
Activity API unit tests:
Activity API e2e:
RBAC tests:
Cursor tests:
Filter tests:
Source authorization tests:
CrmActivity Round 2A tests:
Operational Notes tests:
CRM tests:
Full backend suite:
Known perf-harness result:
Backend build:
Frontend TSC:
Frontend tests:
Frontend build:

RUNTIME AUTHORITY
Git HEAD:
origin/master:
Backend PID:
Backend CWD:
Backend port:
API:
Database:
Migration status:

FILES CHANGED
UNRELATED PRODUCTION FILES:

Report:
Commit:
HEAD:
origin/master:
HEAD == origin/master:
Worktree:

REMAINING FINDINGS
P0:
P1:
P2:

ROUND 2B STATUS:
NEXT CANONICAL ROUND:
```

# 35. ACCEPTANCE GATES

VERDICT A requires all of the following:

1. Repository/branch/start HEAD verified.
2. Round 2A SHA `227c9e6` verified in history.
3. Canonical roadmap confirms Round 2B as NEXT.
4. Round 1 and Round 2A reports read.
5. Customer and Partner Activity routes implemented.
6. No unsafe unscoped feed introduced.
7. Canonical subject existence and scope enforced.
8. IDOR prevented.
9. `crm.activity.read` integrated through canonical RBAC.
10. Least-privilege role matrix documented.
11. Two-level RBAC implemented.
12. All 10 source types explicitly classified.
13. Unauthorized items omitted server-side.
14. Page-level unauthorized caller denied.
15. Hidden item counts/existence not leaked.
16. Cursor/keyset pagination implemented.
17. Ordering exactly `occurredAt DESC, id DESC`.
18. Cursor opaque and strictly validated.
19. Cursor subject/filter reuse cannot widen access.
20. Same-timestamp pagination stable.
21. No duplicates/missing authorized rows.
22. Bounded limit implemented.
23. No offset fallback.
24. No unnecessary total-count dependency.
25. Accepted server-side filters implemented and validated.
26. Date filters use occurredAt.
27. Route subject cannot be query-overridden.
28. Mixed hidden/visible pagination works correctly.
29. Safe response DTO used; no raw Prisma exposure.
30. Sensitive source payloads not leaked.
31. Exact deep links only for existing authorized surfaces.
32. OperationalNote authority preserved.
33. Message membership/read authority preserved.
34. Finance authority preserved.
35. Audit payload remains protected.
36. Valid zero state returns 200 [].
37. Nonexistent subject uses canonical 404.
38. Invalid query uses 400.
39. Authorization uncertainty fails closed.
40. Query pushes subject/filter/cursor to DB.
41. Authorization avoids unjustified N+1.
42. Customer/Partner query/index evidence supplied.
43. Customer tests pass.
44. Partner tests pass.
45. RBAC tests pass.
46. All source authorization tests pass.
47. Filter tests pass.
48. Cursor security tests pass.
49. Dual-subject test passes.
50. Business-date regressions pass.
51. Data-minimization inspection passes.
52. Round 2A CrmActivity regression passes.
53. Operational Notes regression passes.
54. CRM regression passes.
55. Backend TSC/build pass.
56. Full backend suite executed/reported.
57. No new failure hidden by old perf waiver.
58. Frontend TSC/tests/build pass.
59. Runtime process matches verified Git state.
60. Runtime Customer/Partner/RBAC/cursor/no-leak evidence supplied.
61. No Activity UI implemented.
62. No Customer/Partner Activity tab implemented.
63. No composer/new communication channel implemented.
64. No unrelated production refactor.
65. Report created.
66. Implementation commit created and pushed.
67. Final HEAD/origin recorded and equal.
68. No unresolved P0/P1 security/data-integrity defect remains.

# 36. VERDICT

Success only:

```text
VERDICT A — PHASE 3 STEP 3.5.3 PLATFORM CRM /
CRM COMMUNICATIONS + ACTIVITY TIMELINE ROUND 2B /
ACTIVITY API + TWO-LEVEL RBAC + SUBJECT AUTHORITY +
CURSOR PAGINATION + SERVER-SIDE FILTERING +
SOURCE-SPECIFIC ITEM AUTHORIZATION /
FULLY IMPLEMENTED AND RUNTIME-VERIFIED
```

Failure:

```text
VERDICT B — PHASE 3 STEP 3.5.3 PLATFORM CRM /
CRM ACTIVITY ROUND 2B /
API / RBAC / CURSOR / FILTERING / SUBJECT AUTHORITY INCOMPLETE
```

No conditional VERDICT A.

# 37. NEXT

Only after VERDICT A:

```text
PHASE 3 — STEP 3.5.3
CRM COMMUNICATIONS + ACTIVITY TIMELINE

ROUND 2C — CUSTOMER 360 ACTIVITY UI
+ EXISTING CUSTOMER HISTORY MIGRATION / REPLACEMENT
+ FILTER / CURSOR UX + EXACT ENTITY NAVIGATION
```

Do NOT implement Round 2C now.

# 38. STOP

After implementation, tests, runtime verification, report, commit, push and `HEAD == origin/master`:

```text
STOP
```
