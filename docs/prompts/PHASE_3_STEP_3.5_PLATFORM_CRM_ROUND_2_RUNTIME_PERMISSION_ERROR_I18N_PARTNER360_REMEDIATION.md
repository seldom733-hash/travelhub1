# PHASE 3 — STEP 3.5 — PLATFORM CRM
## ROUND 2 — RUNTIME PERMISSION / ERROR-EMPTY BOUNDARY / I18N / PARTNER 360 EVIDENCE REMEDIATION

---

# 1. PURPOSE

The previous implementation reported:

```text
VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM /
CLIENTS + CUSTOMER 360 + PARTNERS + PARTNER 360
FULL RUNTIME / UX / DATA AUTHORITY RECONCILED AND IMPLEMENTED
```

Manual browser acceptance disproved final closure.

This is a **short targeted remediation**.

Do NOT redesign Platform CRM.
Do NOT expand scope.
Do NOT start Storefront Pro CRM.
Do NOT start Marketplace Basic CRM.
Do NOT start Partner Shared Sidebar implementation.

---

# 2. RUNTIME EVIDENCE — CURRENT DEFECTS

Manual browser verification under Platform:

```text
User: Administrator
Role: ADMIN
Route: /app/crm
```

## 2.1 Clients

Clients list loads successfully.

Customer 360 opens successfully.

However a raw i18n key is visible:

```text
crm.detail.overview
```

Expected:

```text
localized human-readable label
```

for RU/AZ/EN.

---

## 2.2 Partners

Partners tab is blocked by:

```text
Missing permission(s): crm.partner.read
```

At the same time UI renders:

```text
ВСЕГО ПАРТНЁРОВ
0

Партнёров пока нет
```

This is semantically invalid.

Hard invariant:

```text
AUTHORIZATION ERROR
≠
SUCCESSFUL ZERO RESULT
≠
EMPTY STATE
```

---

# 3. CURRENT VERDICT

The previous `VERDICT A` is not accepted as final runtime closure.

Current status:

```text
Clients list              PASS
Customer 360 opening      PASS
Customer 360 i18n         FAIL
Partners list             FAIL — permission
Partners error boundary   FAIL — fake zero/empty
Partner 360               UNVERIFIED / BLOCKED
Platform CRM final close  NOT CLOSED
```

---

# 4. REMEDIATION SCOPE

Fix only:

```text
A. crm.partner.read authority / role assignment
B. Partners error vs zero/empty boundary
C. crm.detail.overview raw i18n key
D. Partner 360 real browser/runtime evidence
E. regression verification of Customer 360
```

Any additional defect discovered directly blocking these criteria may be fixed, but must be reported separately.

---

# 5. CRM.PARTNER.READ — ROOT CAUSE FIRST

Do NOT simply bypass the permission.

Determine:

```text
where crm.partner.read is declared
which Platform roles should receive it
how default RolePermission rows are seeded/provisioned
whether current ADMIN has the permission
whether existing environments receive newly introduced permissions
```

Inspect actual:

```text
permission constants
role/default permission matrix
seed/bootstrap logic
RolePermission persistence
SecurityService/canAccess authority
CRM controller guards
frontend permission checks
```

Report exact files.

---

# 6. ADMIN AUTHORITY

Verify canonical Platform role policy.

If `ADMIN` is intended to have full Platform CRM access, then:

```text
ADMIN
→ crm.partner.read
```

must be granted through the canonical permission authority.

Do NOT special-case:

```text
if role === ADMIN → bypass
```

unless the existing security architecture explicitly defines ADMIN that way.

Preferred:

```text
canonical role-permission matrix
→ persisted/default permission
→ JWT/session authority
→ backend guard
→ frontend visibility
```

---

# 7. OTHER PLATFORM ROLES

Do not grant `crm.partner.read` indiscriminately.

Reconcile the permission with the existing CRM role matrix.

Required report:

| Platform role | crm.partner.read expected? | Before | After | Authority |
|---|---:|---:|---:|---|
| ADMIN | | | | |
| DIRECTOR | | | | |
| SALES_MANAGER | | | | |
| OPERATOR | | | | |
| ANALYST | | | | |
| MARKETER | | | | |
| FINANCE | | | | |
| MODERATOR | | | | |

Use actual canonical roles/permissions if repository differs.

Do not broaden access just to make browser testing pass.

---

# 8. EXISTING DATABASES / SEED DRIFT

A new permission existing in source but missing from an already-seeded DB is a runtime deployment defect.

If this is the root cause, fix the canonical mechanism so the project does not depend on manually inserting a permission row every time.

Evaluate:

```text
idempotent permission seed
bootstrap reconciliation
migration
other existing project mechanism
```

Use the project's established approach.

Do NOT introduce an unrelated permission architecture.

---

# 9. SERVER AUTHORITY

After remediation verify:

```text
GET partner CRM/list endpoint under authorized Platform ADMIN
→ 200
```

and an unauthorized role:

```text
→ 403
```

where canonical policy requires denial.

Frontend visibility alone is insufficient.

---

# 10. PARTNERS ERROR / EMPTY BOUNDARY

Current invalid state:

```text
permission error
+
0 partners
+
"Партнёров пока нет"
```

must be removed.

Required states:

```text
LOADING
SUCCESS + DATA
SUCCESS + ZERO
ERROR
FORBIDDEN
```

must be semantically distinct.

---

# 11. FORBIDDEN STATE

On `403`:

Allowed:

```text
permission/access error state
```

Not allowed simultaneously:

```text
0 partners KPI
empty table business state
"Партнёров пока нет"
```

unless a previously successful cached dataset is intentionally shown and clearly labeled, which is not the current requirement.

---

# 12. API ERROR STATE

On network/5xx/API failure:

```text
do not render fake business zero
```

KPI/count derived from failed request must not become `0`.

---

# 13. SUCCESSFUL ZERO STATE

Only after successful authorized response with:

```text
total = 0
```

may UI show:

```text
0 partners
Партнёров пока нет
```

---

# 14. RAW I18N KEY

Fix:

```text
crm.detail.overview
```

visible in Customer 360.

Verify the actual translation namespace/key usage.

Do not merely hardcode:

```text
Обзор
```

into the component.

Required:

```text
RU → localized
AZ → localized
EN → localized
```

Raw key visible = FAIL.

---

# 15. I18N REGRESSION SWEEP

Because this raw key escaped the previous implementation, inspect the CRM surfaces changed in Round 1 for other raw keys.

At minimum:

```text
Clients
Customer 360 tabs
Partners
Partner 360 tabs
empty/error states
buttons
badges
```

Do not perform a repository-wide unrelated i18n rewrite.

---

# 16. PARTNERS LIST — REAL RUNTIME

After permission remediation, open:

```text
/app/crm
→ Партнёры
```

under Platform ADMIN.

Verify:

```text
HTTP success
real total
real rows if DB contains partners
search
pagination if >20
no permission banner
no fake zero
```

If DB genuinely contains zero partners, prove this from canonical runtime data rather than assuming it.

---

# 17. PARTNER 360 — REQUIRED BROWSER EVIDENCE

The previous report claimed:

```text
Partner 360:
Overview
Services
Orders
Bookings
Customers
Storefront
```

but browser acceptance could not reach Partner 360.

This claim must now be proven.

Open a real partner and verify all six tabs.

---

# 18. PARTNER 360 — OVERVIEW

Verify:

```text
partner identity
status
available canonical summary data
no raw keys
no fake zero caused by failed child requests
```

---

# 19. PARTNER 360 — SERVICES

Verify that Services:

```text
loads successfully
belongs to selected partner
shows honest zero/data
uses canonical service relation
```

If a count is displayed:

```text
count = visible destination semantic total
```

---

# 20. PARTNER 360 — ORDERS

Verify:

```text
selected-partner scope
status/amount/date where implemented
real data or honest zero
no cross-partner leakage
```

---

# 21. PARTNER 360 — BOOKINGS

Verify:

```text
selected-partner scope
correct booking semantics
real data or honest zero
```

---

# 22. PARTNER 360 — CUSTOMERS

Verify:

```text
canonical partner/customer relationship
distinct customer semantics
no cross-partner leakage
```

Do not expose partner-private CRM fields without Platform authority.

---

# 23. PARTNER 360 — STOREFRONT

Verify canonical:

```text
PartnerStorefront existence/state
status
entitlement status/tier where currently implemented
```

No tier inference from partner display name.

---

# 24. PARTNER 360 — CHILD REQUEST ERROR BOUNDARY

For every Partner 360 tab:

```text
request error
≠
zero data
```

Do not reproduce the Partners-list defect inside detail tabs.

---

# 25. CUSTOMER 360 REGRESSION

Re-open a real customer after changes.

Verify:

```text
Overview
Orders
Bookings
Payments
Relations
Refunds
History
```

At minimum ensure:

```text
Customer 360 still opens
raw overview key is gone
existing data still renders
```

---

# 26. REFUNDS CLAIM

Previous report stated:

```text
Customer 360 missing Refunds tab
→ Added tab with documented gap
```

Clarify runtime semantics.

Required report:

```text
Refunds tab UI exists: YES/NO
Refund API/data authority exists: YES/NO
Real customer refund attribution works: YES/NO
If NO: exact blocker
```

Do not call the refund capability fully implemented if the tab is only a placeholder/documented gap.

---

# 27. HISTORY CLAIM

Verify that `CustomerHistory` data actually renders.

Required:

```text
history request/data source
successful data or honest zero
no claim of unified activity timeline
```

---

# 28. PAGINATION

Preserve project-wide standard:

```text
pageSize = 20
```

for operational tables.

Do not regress Clients/Partners pagination.

---

# 29. PLATFORM SIDEBAR

No changes to Platform sidebar are expected from this remediation.

Regression:

```text
PASS required
```

---

# 30. PARTNER WORKSPACE

Do NOT implement Partner Shared Sidebar.

Current status remains:

```text
architecture reconciled
implementation NOT STARTED
```

---

# 31. STOREFRONT PRO / MARKETPLACE BASIC

Do not continue their CRM implementation in this prompt.

Only run regression checks if shared code was touched.

---

# 32. TESTS — PERMISSION

Add/update focused tests for:

```text
authorized Platform role → partner CRM read succeeds
unauthorized role → denied
default/seed authority contains expected permission
```

Use actual project testing conventions.

---

# 33. TESTS — ERROR BOUNDARY

Add/update focused frontend tests where practical:

```text
403 → error/forbidden state, no fake zero
500/network error → error state, no fake zero
200 total=0 → legitimate empty state
200 total>0 → rows/count
```

---

# 34. TESTS — I18N

Verify:

```text
crm.detail.overview does not render raw
```

and all new/changed CRM keys resolve in:

```text
RU
AZ
EN
```

---

# 35. STATIC / BUILD GATES

Required:

```text
Backend TSC
Frontend TSC
Backend build
Frontend build
relevant backend tests
relevant frontend tests
```

Report exact results/counts.

---

# 36. HTTP EVIDENCE

Required matrix:

| Request | Actor/role | Expected | Actual | PASS |
|---|---|---:|---:|---|
| Partners list | ADMIN | 200 | | |
| Partner detail | ADMIN | 200 | | |
| Partner Services | ADMIN | 200 | | |
| Partner Orders | ADMIN | 200 | | |
| Partner Bookings | ADMIN | 200 | | |
| Partner Customers | ADMIN | 200 | | |
| Partner Storefront | ADMIN | 200 | | |
| Partners list | unauthorized role | 403 if canonical | | |

Use actual endpoints.

---

# 37. BROWSER EVIDENCE MATRIX

Required:

| Surface | Result | Evidence |
|---|---|---|
| Clients list | | |
| Customer 360 Overview | | |
| Customer 360 Refunds | | |
| Customer 360 History | | |
| Partners list | | |
| Partner 360 Overview | | |
| Partner 360 Services | | |
| Partner 360 Orders | | |
| Partner 360 Bookings | | |
| Partner 360 Customers | | |
| Partner 360 Storefront | | |

---

# 38. ERROR-STATE EVIDENCE

Explicitly prove:

```text
403 Partners
→ no fake 0
→ no "Партнёров пока нет"
```

and:

```text
200 total=0
→ legitimate 0
→ legitimate empty state
```

Use test/runtime evidence as appropriate.

---

# 39. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_STEP_3.5_PLATFORM_CRM_ROUND_2_RUNTIME_PERMISSION_ERROR_I18N_PARTNER360_REMEDIATION_REPORT.md
```

---

# 40. HARD ACCEPTANCE CRITERIA

VERDICT A only if:

1. `crm.partner.read` root cause identified.
2. Canonical role-permission authority reconciled.
3. ADMIN receives the permission if canonical policy requires it.
4. No role is granted permission without policy justification.
5. Existing DB/seed drift is addressed through canonical project mechanism where applicable.
6. Backend Partners endpoint returns 200 for authorized ADMIN.
7. Unauthorized access remains server-denied.
8. Partners tab no longer shows permission error for authorized ADMIN.
9. Error/forbidden state does not render fake partner zero.
10. Error/forbidden state does not render business empty-state copy.
11. Successful zero still renders legitimate empty state.
12. `crm.detail.overview` raw key is fixed.
13. RU CRM labels PASS.
14. AZ CRM labels PASS.
15. EN CRM labels PASS.
16. Changed CRM surfaces contain no raw i18n keys.
17. Partners list loads in real browser.
18. Partners total is authoritative.
19. Partners rows are shown if runtime DB contains them.
20. Partners search works.
21. Partners pagination remains pageSize=20.
22. A real Partner 360 can be opened.
23. Partner 360 Overview PASS.
24. Partner 360 Services PASS.
25. Partner 360 Orders PASS.
26. Partner 360 Bookings PASS.
27. Partner 360 Customers PASS.
28. Partner 360 Storefront PASS.
29. Partner 360 child errors are not rendered as zero.
30. No cross-partner data leakage.
31. Customer 360 still opens.
32. Customer 360 Overview label is localized.
33. Customer Refunds capability is truthfully classified.
34. Customer History capability is truthfully classified.
35. No false unified-timeline claim.
36. Clients pagination does not regress.
37. Platform sidebar does not regress.
38. Storefront Pro CRM does not regress from shared changes.
39. Marketplace Basic CRM does not regress from shared changes.
40. Partner Shared Sidebar implementation NOT started.
41. F.1–F.13 remain NOT STARTED.
42. S.1–S.19 remain NOT STARTED.
43. Backend TSC PASS.
44. Frontend TSC PASS.
45. Backend build PASS.
46. Frontend build PASS.
47. Relevant backend tests PASS.
48. Relevant frontend tests PASS.
49. HTTP evidence matrix supplied.
50. Browser evidence matrix supplied.
51. Role-permission matrix supplied.
52. Production changes limited to remediation scope.
53. Unrelated files committed = 0.
54. Push complete.
55. HEAD == origin/master.

---

# 41. VERDICT

Success only:

```text
VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM ROUND 2 /
PARTNER PERMISSION AUTHORITY + ERROR/ZERO BOUNDARY + I18N +
PARTNER 360 RUNTIME EVIDENCE FULLY CLOSED
```

Otherwise:

```text
VERDICT B — PLATFORM CRM ROUND 2 REMEDIATION INCOMPLETE
```

No conditional VERDICT A.

---

# 42. FINAL RESPONSE FORMAT

```text
VERDICT:

ROOT CAUSES:
crm.partner.read:
existing DB/seed drift:
error/zero boundary:
raw i18n key:

ROLE-PERMISSION MATRIX:
...

PARTNERS:
Endpoint:
ADMIN HTTP:
Unauthorized HTTP:
Total:
Rows:
Search:
Pagination:
Error/empty behavior:

PARTNER 360:
Partner tested:
Overview:
Services:
Orders:
Bookings:
Customers:
Storefront:
Cross-partner isolation:
Child error boundaries:

CUSTOMER 360 REGRESSION:
Overview:
Orders:
Bookings:
Payments:
Relations:
Refunds:
Refunds classification:
History:
History classification:
Raw keys:

I18N:
RU:
AZ:
EN:

HTTP EVIDENCE MATRIX:
...

BROWSER EVIDENCE MATRIX:
...

Backend TSC:
Frontend TSC:
Backend build:
Frontend build:
Backend tests:
Frontend tests:

Platform sidebar regression:
Storefront Pro CRM regression:
Marketplace Basic CRM regression:

Production code changed:
DB schema changed:
Migration/seed changes:
Files changed:

Platform CRM status:
Partner Shared Sidebar implementation:
F.1–F.13:
S.1–S.19:

Report:
Commit:
HEAD:
origin/master:
HEAD == origin/master:
Unrelated files:

Remaining findings:
Next canonical stage:
```

---

# 43. STOP

After the report:

```text
STOP
```

Do NOT automatically begin Storefront Pro CRM.

We will manually inspect the repaired Platform CRM and Partner 360 first.
