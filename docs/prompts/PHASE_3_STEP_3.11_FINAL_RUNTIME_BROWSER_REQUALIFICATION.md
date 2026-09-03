# PHASE 3 — STEP 3.11 — FINAL RUNTIME / BROWSER RE-QUALIFICATION

## TASK TYPE

**FINAL RUNTIME / BROWSER RE-QUALIFICATION ONLY**

This is not a new implementation stage.

Current implementation state:

```text
Starting remediation baseline: 755c3d8
Remediation SHA:              a70273d
Final HEAD expected:          a70273d
origin/master expected:       a70273d
```

Reported implementation status:

```text
R5  CLOSED — Status dropdown
R10 CLOSED — 7 KPI + WAITING aggregate
R11 CLOSED — Priority mutable
R12 CLOSED — Case editing
R13 CLOSED — ADMIN-only controlled soft delete
R14 CLOSED — complete CaseHistory
R4  CANONICALLY DEFERRED — no eligible-assignee API
```

Migration reported:

```text
72/72 applied
schema up to date
```

Automated checks reported:

```text
Frontend tests:  248/248 PASS
Frontend TSC:    PASS
Frontend Build:  PASS
Backend Support: 40/40 PASS
Backend Comm:    44/44 PASS
Backend TSC:     PASS
```

Do not accept these claims as sufficient evidence.

**Runtime/browser evidence is final authority.**

Do not auto-start Step 3.12.

---

# LANGUAGE REQUIREMENT — MANDATORY

Все созданные/обновлённые reports и prose documentation должны быть преимущественно **на русском языке**.

На русском обязательны:

- Runtime Re-qualification Report
- findings
- root cause
- browser evidence
- security findings
- conclusions
- verdict explanations
- recommendations

Английский разрешён только для technical identifiers:

```text
file paths
class/method/model names
API endpoints
HTTP methods/status codes
CLI/Git commands
enum values
permission identifiers
code snippets
commit messages
standardized VERDICT strings
```

Если report преимущественно на английском, задача считается incomplete.

---

# 1. PRE-FLIGHT

Run:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git log -20 --oneline
```

Confirm actual HEAD.

Expected:

```text
a70273d
```

If repo has moved forward, record actual SHA and determine whether changes are related.

Do not overwrite unrelated work.

---

# 2. VERIFY MIGRATION STATE

Run against the exact runtime DB used for browser verification:

```bash
npx prisma migrate status
```

If needed:

```bash
npx prisma migrate deploy
```

Hard gate:

```text
migration file exists
≠
migration applied
```

The report must prove runtime DB is current.

---

# 3. REAL BROWSER SESSION

Use a fresh authenticated session.

At minimum verify:

```text
ADMIN
representative non-ADMIN actor
actor without Support access
```

Logout/login when permission/session refresh is relevant.

Do not rely on cached permission claims.

---

# 4. SUPPORT SIDEBAR / ROUTE

For ADMIN:

```text
Support sidebar item visible
/app/support opens
no redirect to dashboard
```

For actor without `support.case.read`:

```text
Support sidebar hidden
direct /app/support access denied safely
no data leak
```

---

# 5. R5 — STATUS DROPDOWN

Open a Case at:

```text
/app/support/[id]
```

Verify:

```text
one compact Status dropdown
filter-style visual language
old lifecycle button row absent
current status displayed correctly
only canonically allowed transitions shown
```

Perform at least two valid transitions if lifecycle allows.

Example:

```text
OPEN → IN_PROGRESS
IN_PROGRESS → WAITING_CUSTOMER
```

Verify after each mutation:

```text
detail updates
list updates
KPI updates
history updates
browser refresh preserves state
```

Negative test:

```text
attempt stale/invalid transition
→ controlled 422 or canonical equivalent
→ no false success
→ UI reconciles with server state
```

---

# 6. R10 — 7 KPI MODEL

Verify exactly 7 cards:

```text
Всего
Открытые
В работе
Ожидают
Эскалированные
Решённые
Закрытые
```

Use current locale strings.

Canonical statuses:

```text
OPEN
IN_PROGRESS
WAITING_CUSTOMER
WAITING_PARTNER
WAITING_INTERNAL
ESCALATED
RESOLVED
CLOSED
```

Required aggregation:

```text
WAITING =
WAITING_CUSTOMER
+ WAITING_PARTNER
+ WAITING_INTERNAL
```

Verify runtime invariant for non-deleted Cases:

```text
TOTAL =
OPEN
+ IN_PROGRESS
+ WAITING_CUSTOMER
+ WAITING_PARTNER
+ WAITING_INTERNAL
+ ESCALATED
+ RESOLVED
+ CLOSED
```

Test at least one Case moved into a WAITING_* state and prove:

```text
individual Case status is preserved
Ожидают increments correctly
Total remains correct
previous KPI decrements correctly
```

If practical, verify more than one WAITING_* subtype.

---

# 7. R11 — PRIORITY MUTATION

On Case detail verify compact Priority dropdown.

Perform:

```text
MEDIUM → HIGH
```

or another valid mutation.

Verify:

```text
detail updates
list updates
history event appears
browser refresh preserves priority
KPI does not incorrectly change
```

For unauthorized actor:

```text
Priority edit control absent/read-only
direct API mutation denied
```

No role-name hardcoding accepted as authorization evidence.

---

# 8. R12 — CASE EDITING

Verify editing of:

```text
title
description
type
priority
```

Status must remain separate lifecycle control.

Edit at least:

```text
title
description
type
```

Save.

Verify:

```text
detail reflects values
list reflects fields where applicable
refresh preserves changes
history records significant edits
immutable fields unchanged
```

Attempt unsafe/immutable update if API can be exercised safely:

```text
SUP-* business code
createdAt
creator
```

Expected:

```text
ignored/rejected safely
no corruption
```

For unauthorized actor:

```text
Edit action absent
direct update denied
```

---

# 9. R13 — ADMIN SOFT DELETE

## 9.1 Create accidental Case

Create a fresh minimal Case intended only for delete verification.

Record:

```text
Case code
initial KPI Total
```

## 9.2 Delete as ADMIN

Verify:

```text
Delete action visible only with effective support.case.delete
confirmation required
deletionReason required
empty reason rejected
valid reason accepted
```

After delete:

```text
Case disappears from ordinary list
Case excluded from KPI
ordinary search/filter cannot surface it
direct ordinary detail access is handled safely
audit/history is not physically destroyed
```

If there is an admin audit path for deleted record, use it only if already implemented.

Do not require a Trash UI if not in scope.

## 9.3 Non-ADMIN negative

With representative actor lacking `support.case.delete`:

```text
Delete UI absent
direct delete API → 403
```

## 9.4 Material-history safeguard

Use or prepare a Case with substantive work such as:

```text
status transitions
comments if available
communication relation if available
other significant history
```

Attempt delete.

Expected:

```text
server blocks deletion
controlled error
UI recommends/indicates closure instead
Case remains available
history preserved
```

Document the exact safeguard rule discovered in implementation.

---

# 10. R14 — COMPLETE CASE HISTORY

For the Case used above, verify History contains localized presentation for all actions actually performed:

```text
Case created
Status changed
Priority changed
Title changed
Description changed
Type changed
Case deleted   — where audit is accessible after soft delete
```

If assignment is still deferred, do not require assignment history.

Hard UI requirements:

```text
localized human-readable event names
localized enum labels
actor displayed
timestamp displayed
old → new where safe/applicable
no raw technical event strings in ordinary UI
no raw enum leakage such as status:IN_PROGRESS
unknown event type does not crash page
```

History remains append-only:

```text
no edit
no delete
no rewrite controls
```

---

# 11. I18N

Test the primary currently used locale and at least one alternate locale if practical.

Audit specifically:

```text
All/Hamısı equivalents
Status labels
Priority labels
CaseType labels
History events
KPI labels
Delete dialog
Edit UI
validation/error messages
```

No mixed raw English technical labels in normal end-user UI unless intentionally product copy.

---

# 12. FRONTEND TEST GAP CHECK

Reported total is still:

```text
248/248
```

Inspect actual test diff / suites.

Determine:

```text
Were meaningful Support UI assertions added or updated?
```

At minimum verify automated coverage exists for key new UI behavior where appropriate:

```text
Status dropdown
7 KPI / WAITING mapping
Priority editing
Case editing permission behavior
Delete permission/confirmation behavior
History presentation mapping
```

Do not fail solely because total test count is unchanged.

But if new behavior has no meaningful frontend assertions at all, record a finding.

---

# 13. BACKEND TEST REVIEW

Reported:

```text
Support 40/40 PASS
```

Confirm new targeted cases actually cover relevant backend risks:

```text
priority mutation
editing
CaseHistory
delete permission
delete reason
material-history safeguard
soft-delete exclusion
```

Report actual suites/tests used as evidence.

---

# 14. CONSOLE

During representative positive workflows:

```text
console errors:   0
console warnings: 0
```

Every non-zero entry must be classified.

Do not dismiss React warnings as harmless without justification.

---

# 15. NETWORK

Verify:

```text
no raw 500
no duplicate mutations
no request storms
no permission redirect loops
no stale success state
```

Controlled negative tests may produce expected:

```text
403
404
409
422
```

if canonical.

---

# 16. DATA CONSISTENCY AFTER REFRESH

Perform full browser refresh after:

```text
status mutation
priority mutation
Case edit
soft delete
```

The reloaded state must match backend authority.

No frontend-only optimistic state may survive incorrectly.

---

# 17. SECURITY / AUTHORITY

Confirm all mutations remain server-authoritative:

```text
status
priority
edit
delete
```

Check that frontend visibility is not treated as authorization.

Explicitly verify:

```text
hidden button ≠ permission enforcement
```

Direct API denial must exist for unauthorized actor.

---

# 18. R4 — ASSIGNMENT STATUS

Re-confirm current state only.

Expected current status:

```text
R4 CANONICALLY DEFERRED
```

Reason:

```text
no eligible-assignee authority/API
```

Do not implement assignment in this task.

Do not load all Users as assignee options.

If repo unexpectedly already contains a safe eligible-assignee API, report it as a discovery; do not expand scope automatically.

---

# 19. SUPPORT FOLLOW-UP ITEMS — RECORD ONLY

Confirm the current roadmap/report still records follow-up architecture work for:

```text
Support Case Comments / Internal Notes
Support Case Creation Flow
Source vs Contact Channel
Customer / Order / Booking / Payment relations
Customer → TravelHub Support
Marketplace Partner → TravelHub Support
Storefront Partner → TravelHub Support
Storefront Customer → Storefront Partner Support
R4 eligible assignee / workforce authority
```

Do not implement these in this re-qualification.

---

# 20. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_STEP_3.11_FINAL_RUNTIME_BROWSER_REQUALIFICATION_REPORT.md
```

Report must be predominantly in Russian.

Required sections:

```text
1. Starting SHA / Final SHA
2. Runtime DB migration state
3. Browser actors used
4. Sidebar/direct-route evidence
5. R5 evidence
6. R10 evidence
7. R11 evidence
8. R12 evidence
9. R13 evidence
10. R14 evidence
11. R4 deferred confirmation
12. i18n evidence
13. frontend test-gap review
14. backend test review
15. console
16. network
17. security/direct API evidence
18. findings
19. exact closure matrix
20. final verdict
21. exact next action
```

---

# 21. FINDINGS SEVERITY

Classify findings:

```text
P0 — system unusable / critical security
P1 — material authorization/data integrity failure
P2 — material functional/runtime defect
P3 — UX/consistency/reliability defect
P4 — minor/non-blocking quality gap
```

Do not grant final closure with unresolved P0/P1/P2.

P3/P4 require explicit judgment and must not be silently ignored.

---

# 22. CLOSURE MATRIX

Required final matrix:

```text
R5  — CLOSED / OPEN
R10 — CLOSED / OPEN
R11 — CLOSED / OPEN
R12 — CLOSED / OPEN
R13 — CLOSED / OPEN
R14 — CLOSED / OPEN
R4  — CANONICALLY DEFERRED / unexpected change
```

---

# 23. VERDICT A

Only if runtime/browser evidence proves the implemented behavior and there are no unresolved blocking findings:

```text
VERDICT A — PHASE 3 — STEP 3.11 SUPPORT CENTER UI — FINAL RUNTIME/BROWSER RE-QUALIFICATION APPROVED

R5 CLOSED
R10 CLOSED
R11 CLOSED
R12 CLOSED
R13 CLOSED
R14 CLOSED
R4 CANONICALLY DEFERRED

STEP 3.11 CLOSED
```

Canonical next may then remain:

```text
PHASE 3 — STEP 3.12 — USERS & ACCESS COMPLETION
```

But:

```text
DO NOT AUTO-START
```

---

# 24. VERDICT B

If runtime contradicts implementation claims or blocking findings remain:

```text
VERDICT B — PHASE 3 — STEP 3.11 SUPPORT CENTER UI — FINAL RUNTIME/BROWSER RE-QUALIFICATION FAILED

STEP 3.11 REMAINS OPEN
```

List exact findings and required minimal remediation.

---

# 25. ROADMAP RULE

Do not erase prior history:

```text
619a970
624cc39
755c3d8
a70273d
```

If roadmap synchronization is required after successful final re-qualification:

```text
append exact closure evidence
preserve existing numbering/history
record real SHA
record exact NEXT
```

Do not start Step 3.12.

---

# 26. FINAL RESPONSE FORMAT

Return in Russian:

```text
Starting SHA:
Final HEAD:
origin/master:

Migration:
Browser actors:

R5:
R10:
R11:
R12:
R13:
R14:
R4:

Frontend tests:
Backend Support:
Backend Communication:
TSC/Build:

Console:
Network:

Findings:
Final VERDICT:

Canonical NEXT:
DO NOT AUTO-START
```

---

# 27. STOP

After report + verdict:

```text
STOP
```

Do not implement Step 3.12.
Do not implement R4.
Do not implement Comments/Storefront Support in this task.
