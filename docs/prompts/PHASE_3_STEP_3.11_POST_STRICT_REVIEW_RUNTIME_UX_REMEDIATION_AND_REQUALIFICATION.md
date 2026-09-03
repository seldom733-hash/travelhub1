# PHASE 3 — STEP 3.11 — POST-STRICT-REVIEW RUNTIME / UX REMEDIATION AND RE-QUALIFICATION

## 0. TASK MODE

**TARGETED REMEDIATION + RUNTIME RE-QUALIFICATION.**

Canonical target:

```text
PHASE 3 — STEP 3.11 — SUPPORT CENTER UI
```

Known SHAs:

```text
Implementation SHA: 619a970
Strict Review SHA:   624cc39
```

Strict Review reported:

```text
VERDICT A — PHASE 3 — STEP 3.11 SUPPORT CENTER UI — STRICT REVIEW APPROVED
STEP 3.11 CLOSED
```

However, subsequent **real user runtime/browser verification** exposed defects and UX gaps that were not captured by that review.

Therefore the previous closure must not be treated as sufficient runtime evidence.

This task must:

```text
reproduce observed runtime findings
→ determine root causes
→ remediate only confirmed Step 3.11 issues
→ preserve canonical Support domain authority
→ run automated regressions
→ perform real browser re-qualification
→ produce evidence report
→ issue new VERDICT
```

Do **not** auto-start the next roadmap step.

---

# 1. LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые reports и prose documentation должны быть преимущественно **на русском языке**.

На русском обязательны:

- Remediation Report;
- Runtime Evidence Report;
- findings;
- root cause analysis;
- architecture/UI decisions;
- security findings;
- browser evidence descriptions;
- conclusions;
- recommendations;
- verdict explanations.

Английский разрешён только для:

- file paths;
- class/method/component/model names;
- API endpoints;
- HTTP methods/status codes;
- CLI/Git commands;
- commit messages;
- enums;
- permission identifiers;
- code snippets;
- standardized VERDICT strings.

Если итоговый report преимущественно на английском — task incomplete.

---

# PART I — PREFLIGHT / SOURCE OF TRUTH

## 2. GIT BASELINE

Выполнить:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git log -30 --oneline
```

Не предполагать, что текущий HEAD всё ещё `624cc39`, если после Strict Review были runtime/deployment actions.

Зафиксировать actual starting SHA.

Не изменять unrelated dirty files.

---

## 3. READ CANONICAL SOURCES

До изменения кода перечитать:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
docs/prompts/PHASE_3_STEP_3.11_SUPPORT_CENTER_UI_IMPLEMENTATION_REPORT.md
docs/prompts/PHASE_3_STEP_3.11_SUPPORT_CENTER_UI_STRICT_REVIEW_REPORT.md
```

Также проверить Step 3.10 Support Domain reports/API contracts.

Hard rule:

```text
Do not invent a second Support domain.
Do not duplicate lifecycle authority in frontend.
Do not transfer Customer/Order/Booking ownership into Support.
```

---

# PART II — OBSERVED RUNTIME EVIDENCE

## 4. USER-OBSERVED ENVIRONMENT

Real browser:

```text
http://localhost:3000/app/support
Platform Workspace
actor: ADMIN
locale: AZ
```

---

## 5. FINDING R0 — RBAC MIGRATION WAS NOT DEPLOYED

Observed initially:

```text
Support sidebar item absent
/app/support → redirect to dashboard
```

Root cause already identified:

```text
migration:
20260830000000_remediate_support_rbac

was present in repository
but had not been applied to runtime DB.
```

Consequences:

```text
support.case.* constants existed
but RolePermission rows did not

user.permissions did not contain support.case.read

Shell hid Support
route guard redirected /app/support
```

Runtime action already performed:

```bash
prisma migrate deploy
```

After logout/login:

```text
🎫 Dəstək appeared in sidebar
/app/support opened successfully
ADMIN received support.case.* permissions
```

### Required remediation outcome

Do **not** create duplicate permission seeding.

Instead:

1. Verify migration state explicitly.
2. Verify `support.case.*` RolePermission rows.
3. Verify expected role-specific grants from canonical Step 3.10.
4. Verify fresh login/session receives effective permissions.
5. Add/document deployment/runtime gate so migration presence in Git is not confused with migration applied to DB.
6. If repository has deployment/start scripts or documented migration convention, ensure Step 3.11 evidence follows it.
7. Do not mass-grant Support permissions.

Required evidence:

```bash
npx prisma migrate status
```

plus DB/runtime proof appropriate to repository conventions.

---

# PART III — CONFIRMED RUNTIME FINDINGS

## 6. FINDING R1 — STALE KPI AFTER STATUS MUTATION — P2

Real Case:

```text
SUP-00000004
```

Initial:

```text
status = OPEN / Açıq

KPI:
Total       1
Open        1
In Progress 0
```

User changed:

```text
OPEN → IN_PROGRESS
```

Runtime after successful transition:

```text
Case detail:  İşlənir       ✅
Table row:    İşlənir       ✅
History:      OPEN → IN_PROGRESS ✅

KPI:
Açıq          1             ❌
İşlənir       0             ❌
```

Expected:

```text
Total         1
Open          0
In Progress   1
```

### Requirement

After every mutation that can affect KPI aggregation:

```text
create
status transition
close/reopen
and any other relevant Case mutation
```

the Support Center summary must be refreshed/recomputed from canonical server data.

Do not patch only local numbers with fragile arithmetic if canonical server refresh is available.

Required invariant:

```text
List state
Detail state
History state
KPI state
```

must converge on the same server-authoritative Case state after mutation.

---

# PART IV — UX ROUTING CONTRACT

## 7. FINDING R2 — CREATE CASE USES RIGHT SIDE PANEL

Observed:

```text
/app/support
→ + Müraciəti yarat
→ large create workflow opens in right PanelFrame
→ list workspace is compressed
```

This is inconsistent with the already adopted TravelHub pattern for substantial entity workflows.

### Required target

Use a dedicated route/page:

```text
/app/support/new
```

Expected flow:

```text
/app/support
    ↓ Create Case
/app/support/new
    ↓ successful create
/app/support/{caseId or canonical route key}
```

Prefer canonical business identifier/routing conventions already used in repository.

Do not invent a routing convention inconsistent with existing CRM/entity detail pages.

---

## 8. FINDING R3 — CASE DETAIL USES RIGHT SIDE PANEL

Observed:

```text
click SUP-00000004
→ Case detail opens in right PanelFrame
```

Case detail contains or is expected to contain:

```text
identity
description
type
priority
source
assignee
lifecycle
comments
history
relations
Customer/Order/Booking context
```

This is a substantial entity workspace.

### Required target

Dedicated detail route:

```text
/app/support/{id}
```

or repository-consistent canonical equivalent.

Expected:

```text
Support list
→ Case route
→ full-width entity detail workspace
→ back/breadcrumb to Support list
```

Do not remove useful small dialogs/popovers globally.

This requirement applies specifically to substantial create/detail workflows.

---

# PART V — ASSIGNMENT

## 9. FINDING R4 — ASSIGNEE DISPLAYED BUT CANNOT BE MANAGED

Observed Case detail:

```text
Məsul / Ответственный: —
```

Backend Step 3.10 already has canonical assignment authority:

```text
assignCase
support.case.assign
assignedToId validation
```

But Step 3.11 UI has no assignment selector/action.

### Required remediation

Add assignment UI to Case detail.

Example interaction:

```text
Ответственный
[Не назначен ▼]
```

or equivalent shared TravelHub control.

Hard rules:

```text
UI action visible only with support.case.assign
backend remains final authority
no arbitrary User UUID input
only eligible internal assignees
no PARTNER/customer assignment unless canonical domain explicitly allows it
controlled 403/404/422
refresh Case state after assignment
```

### Eligibility

Do not guess eligible roles.

Audit canonical Support permission model and existing user/employee APIs.

If no safe endpoint exists to retrieve eligible assignees:

```text
STOP that subfeature
document exact API projection gap
do not fabricate a frontend employee list
```

If a minimal read projection is required, implement only if consistent with current canonical architecture and clearly document it.

---

# PART VI — LIFECYCLE CONTROL

## 10. FINDING R5 — STATUS TRANSITIONS PRESENTED AS BUTTON SPRAWL

Observed for OPEN:

```text
→ İşlənir
→ Müştəri gözlənilir
→ Tərəfdaş gözlənilir
→ Gözlənilir (daxili)
→ Miqrasiya edilib
→ Bağlanıb
```

After `IN_PROGRESS`, the visible action set changed, which confirms lifecycle awareness.

The domain behavior is good; presentation is poor and becomes difficult to scale/localize.

### Required UX

Replace button sprawl with one coherent action, e.g.:

```text
Statusu dəyiş
[ allowed transitions ▼ ]
```

or repository-consistent equivalent.

Hard rule:

```text
Frontend does not become lifecycle authority.
```

Allowed transition options must come from/reconcile with canonical server state/contract.

If backend does not expose allowed transitions, frontend may use presentation mapping only where already canonically defined, but server rejection remains authoritative and stale-state 422 must be handled.

After mutation:

```text
detail refresh
list refresh
KPI refresh
history refresh
```

must all converge.

---

# PART VII — I18N / LOCALIZATION

## 11. FINDING R6 — AZ UI CONTAINS ENGLISH STRINGS

Observed AZ interface:

```text
Status — All
Prioritet — All
Növ — All
```

Also visible table/header terminology includes:

```text
STATUS
```

Audit whether this is intentionally canonical Azerbaijani terminology. If not, localize.

`All` is clearly inconsistent with the selected AZ locale.

Expected AZ equivalent should use the project's canonical translations, e.g. conceptually:

```text
Hamısı
```

Do not hardcode translation directly in component.

Use i18n keys.

---

## 12. FINDING R7 — HISTORY EXPOSES RAW TECHNICAL EVENTS

Observed:

```text
created

status:IN_PROGRESS: OPEN → IN_PROGRESS
```

This is raw audit/domain representation leaking into user-facing UI.

Backend audit data must remain immutable/raw as needed.

Frontend needs a **History Event Presentation Layer**.

### Required presentation

Conceptually:

```text
Müraciət yaradıldı
admin · localized datetime

Status dəyişdirildi
Açıq → İşlənir
admin · localized datetime
```

Exact AZ wording must follow existing i18n conventions.

### Required mapping

Audit all actual Support history event types generated by backend.

For each supported event:

```text
event type → localized human-readable title
previous enum → localized label
new enum → localized label
actor → human-readable actor label
timestamp → locale-aware presentation
```

Never mutate historical database records merely to localize UI.

No visible:

```text
created
status:IN_PROGRESS
OPEN
IN_PROGRESS
```

in normal localized presentation.

Fallback for unknown future event type must be safe and readable, not crash rendering.

---

# PART VIII — CREATE PERMISSION

## 13. FINDING R8 — CREATE BUTTON PERMISSION GATING — P3

Previous Strict Review itself found:

```text
F1 (P3) — Create button not permission-gated in UI
backend rejects 403
```

Remediate now.

Expected:

```text
support.case.create present
→ Create button visible

support.case.create absent
→ Create button absent/disabled according to canonical UI convention
```

Backend 403 remains mandatory final protection.

Do not hardcode roles.

---

# PART IX — COMMUNICATION LINKS

## 14. FINDING R9 — RELATIONS READABLE BUT LINK CREATION ABSENT

Observed:

```text
Əlaqələr
Hələ əlaqə yoxdur
```

Step 3.10 backend has:

```text
CaseCommunicationLink
linkCommunication
communication existence validation
```

Implementation/Strict Review classified `communication link form` as deferred.

### Required action

First reconcile with canonical roadmap.

If still canonically deferred:

```text
DO NOT implement it in this remediation.
```

Document:

```text
read projection exists
creation remains canonical deferred scope
```

If canonical source now requires it, implement only that exact scope.

Do not expand into new chat/Communication domain.

---

# PART X — COMMENTS

## 15. COMMENTS REMAIN SECURITY-SENSITIVE

Observed:

```text
Şərhlər
Hələ şərh yoxdur
```

Comment creation was reportedly deferred.

Do not add it unless canonical reconciliation says required.

But re-test Step 3.10 security invariant:

```text
internal comments are server-filtered
frontend does not expose hidden comments
```

---

# PART XI — HISTORY / ACTOR PRESENTATION

## 16. ACTOR LABEL

Observed history actor:

```text
admin
```

Determine whether this is canonical human-readable display name or a technical login.

Prefer existing canonical user display-name projection.

Do not expose raw UUID.

Do not invent names client-side.

---

# PART XII — CASE DETAIL INFORMATION ARCHITECTURE

## 17. FULL PAGE DETAIL

When migrating detail from PanelFrame to route, preserve/reorganize:

```text
SUP-* code
status
title
description
type
priority
source
assignee
created timestamp
Customer context
Order context
Booking context
lifecycle control
comments
history
relations
```

Do not drop currently working information during route refactor.

Use existing TravelHub detail-page patterns where available.

---

# PART XIII — CREATE PAGE INFORMATION ARCHITECTURE

## 18. FULL PAGE CREATE

Current fields observed:

```text
Başlıq *
Təsvir
Növ
Prioritet
Mənbə
```

Preserve DTO correctness.

Audit canonical Support create DTO for:

```text
required fields
enum values
source semantics
Customer/Order/Booking relation fields if canonical Step 3.11 expects them
```

Do not introduce arbitrary UUID text fields for business relations.

If related entity selection is in scope, use canonical search/select projection.

---

# PART XIV — KPI SEMANTICS

## 19. KPI DEFINITIONS

Current cards:

```text
Total
Open
In Progress
Escalated
Resolved
Closed
```

Verify definitions against all Support statuses, including:

```text
WAITING_CUSTOMER
WAITING_PARTNER
WAITING_INTERNAL
```

Do not silently classify waiting states as OPEN or IN_PROGRESS unless canonical KPI definition explicitly says so.

Document exact formula for each KPI.

If cards are exact-status counts, state that.

If cards are grouped operational states, define grouping centrally/server-authoritatively.

No frontend-only ambiguous aggregation.

---

# PART XV — FILTERS

## 20. FILTER LOCALIZATION AND SEMANTICS

Current:

```text
Status — All
Prioritet — All
Növ — All
```

Fix AZ `All`.

Verify every option for:

```text
status
priority
type
```

is localized.

Ensure filtering remains consistent after route refactor and mutations.

---

# PART XVI — ROUTE / BACK NAVIGATION

## 21. ROUTING ACCEPTANCE

Required browser flows:

```text
/app/support
→ /app/support/new
→ create
→ /app/support/{case}
→ back to /app/support
```

And:

```text
/app/support
→ click SUP-*
→ /app/support/{case}
```

Refresh directly on detail route must work.

Direct URL permission attack must work.

Browser Back must not produce stale/incorrect state.

---

# PART XVII — PERMISSION MATRIX

## 22. REQUIRED UI PERMISSIONS

At minimum verify:

```text
support.case.read
support.case.create
support.case.update
support.case.assign
```

Map every UI action to actual permission.

No role hardcoding.

Create/status/assignment controls must disappear or become unavailable according to canonical UI convention when permission absent.

Backend remains authority.

---

# PART XVIII — NEGATIVE RUNTIME TESTS

## 23. REQUIRED ATTACKS

### A. No read permission

```text
sidebar hidden
direct /app/support denied/redirected safely
no data leak
```

### B. Read but no create

```text
Support opens
Create button absent
direct POST denied 403
```

### C. Read but no update

```text
Case detail readable
status mutation control unavailable
backend mutation denied
```

### D. Read but no assign

```text
assignee visible
assignment control unavailable
backend assign denied
```

### E. stale transition

Expected:

```text
422 controlled
no false success
UI refreshes canonical server state
```

---

# PART XIX — DATA CONSISTENCY

## 24. MUTATION INVALIDATION MATRIX

Explicitly test:

| Mutation | List | Detail | KPI | History |
|---|---:|---:|---:|---:|
| Create Case | refresh | correct | refresh | created |
| Status transition | refresh | refresh | refresh | transition |
| Assignment | refresh | refresh | unaffected/correct | assignment if backend records it |
| Close | refresh | refresh | refresh | transition |
| Reopen if canonical | refresh | refresh | refresh | transition |

No split-brain UI state.

---

# PART XX — DEPLOYMENT / MIGRATION GATE

## 25. MIGRATION MUST BE PART OF RUNTIME EVIDENCE

Because the original Strict Review missed an unapplied migration, re-qualification must explicitly prove runtime DB state.

Required:

```bash
npx prisma migrate status
```

Verify:

```text
20260830000000_remediate_support_rbac applied
```

Then verify actual RolePermission rows/effective permission projection using repository-safe methods.

Hard rule:

```text
migration file exists ≠ migration applied
```

Future evidence must distinguish them.

---

# PART XXI — BROWSER RE-QUALIFICATION

## 26. REAL BROWSER IS MANDATORY

Do not approve from source/tests alone.

Use the actual running TravelHub environment.

At minimum verify:

### ADMIN / mutating actor

```text
Support sidebar visible
/app/support opens
list renders
/app/support/new opens full page
Case creation succeeds
redirect/detail succeeds
Case detail is full page
assignment works if eligible API exists
status transition works
KPI updates immediately/after canonical refresh
history localized
AZ filters fully localized
```

### read-only actor

```text
Support visible
detail visible
no Create
no unauthorized status action
no assignment action
```

### denied actor

```text
Support hidden
direct route safe
```

---

# PART XXII — CONSOLE / NETWORK HARD GATE

## 27. CONSOLE

After representative workflows record:

```text
console errors:   0
console warnings: 0
```

Any non-zero must be listed and classified.

Blocking examples:

```text
React key warnings
uncaught exceptions
hydration mismatch
render loop
state update error
```

---

## 28. NETWORK

Verify:

```text
no request storm
no duplicate create
no duplicate status mutation
no repeated 403 loop
no raw 500
```

Expected negative-test 403/422 is acceptable only when controlled.

---

# PART XXIII — RESPONSIVE / VISUAL

## 29. FULL PAGE ROUTES

Verify dedicated create/detail pages at:

```text
desktop
narrow viewport
```

No right-panel compression.

No horizontal unusability.

No lost actions.

---

# PART XXIV — AUTOMATED TESTS

## 30. ADD TARGETED SUPPORT UI TESTS

Previous Strict Review finding:

```text
F2 (P4) — No Support-specific UI tests added
```

This remediation materially changes Support UI.

Add meaningful targeted tests for at least:

```text
permission-gated Create
history event localization
status label localization
KPI refresh/invalidation after mutation
route/page behavior where test architecture supports it
assignment control permission where implemented
```

Do not add superficial snapshot-only tests merely to increase count.

---

## 31. REGRESSION

Run:

```text
Frontend full suite
Frontend TSC
Frontend Build

Backend Support suite
Backend Communication suite
Backend TSC
```

Baseline previously:

```text
Frontend 248/248 PASS
Support 30/30 PASS
Communication 44/44 PASS
```

Report actual new counts.

---

# PART XXV — NO SCOPE EXPANSION

## 32. DO NOT IMPLEMENT UNRELATED FUTURE SUPPORT FEATURES

Unless canonical roadmap explicitly requires them now, do not add:

```text
buyer-facing Support Center
Knowledge Base
AI support
SLA dashboard
Support Analytics
Dispute Center
email ingestion
telephony
external ticket integrations
automation/macros
CSAT
```

Also do not expose Platform Support to PARTNER merely because Support UI now exists.

---

# PART XXVI — REMEDIATION REPORT

## 33. CREATE REPORT

Create:

```text
docs/prompts/PHASE_3_STEP_3.11_POST_STRICT_REVIEW_RUNTIME_UX_REMEDIATION_AND_REQUALIFICATION_REPORT.md
```

Report must include:

```text
1. Starting SHA
2. Canonical scope reconciliation
3. Runtime environment
4. R0 migration root cause and evidence
5. R1 stale KPI root cause/fix
6. R2 create route migration
7. R3 detail route migration
8. R4 assignment result
9. R5 lifecycle control redesign
10. R6/R7 localization/history presentation
11. R8 permission gating
12. R9 communication-link scope decision
13. KPI definitions
14. Permission matrix
15. Mutation invalidation matrix
16. Automated test evidence
17. Browser role matrix
18. Console/network evidence
19. Migration/runtime DB evidence
20. Findings closure table
21. Files changed
22. Git evidence
23. Final verdict
24. Exact next action
```

---

# PART XXVII — FINDING CLOSURE TABLE

## 34. REQUIRED TABLE

At minimum:

| ID | Severity | Finding | Required closure |
|---|---|---|---|
| R0 | Runtime deployment gap | RBAC migration unapplied | migration/runtime evidence |
| R1 | P2 | stale KPI after transition | all views converge |
| R2 | UX | create in side panel | `/app/support/new` |
| R3 | UX | detail in side panel | `/app/support/{id}` |
| R4 | Functional/UX | no assignment UI | permission-safe assignment or documented canonical API blocker |
| R5 | UX | lifecycle button sprawl | coherent status control |
| R6 | i18n | `All` / mixed AZ-EN | complete localization |
| R7 | i18n/UX | raw history events/enums | presentation layer |
| R8 | P3 | Create not permission-gated | exact permission gating |
| R9 | Scope | communication link create absent | canonical defer/implement decision |

Do not mark CLOSED without evidence.

---

# PART XXVIII — GIT

## 35. COMMIT / PUSH

Before commit:

```bash
git status --short
git diff --name-only
git diff
```

Stage only remediation-owned files.

Commit with repository-consistent message.

Push:

```bash
git push origin master
```

Then:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status --short
```

Report exact SHA.

---

# PART XXIX — FINAL VERDICT

## 36. VERDICT A GATE

Only if all material findings are closed and browser evidence confirms them:

```text
VERDICT A — PHASE 3 — STEP 3.11 SUPPORT CENTER UI — POST-STRICT-REVIEW RUNTIME/UX RE-QUALIFICATION APPROVED

R0 CLOSED
R1 CLOSED
R2 CLOSED
R3 CLOSED
R4 CLOSED or canonically documented blocker accepted only if not required for closure
R5 CLOSED
R6 CLOSED
R7 CLOSED
R8 CLOSED
R9 CANONICALLY DEFERRED or CLOSED

STEP 3.11 CLOSED
```

`R4` cannot be silently deferred merely because initial implementation deferred it. This task explicitly requires canonical/API reconciliation and a clear decision.

---

## 37. VERDICT B GATE

If any material runtime/canonical/security defect remains:

```text
VERDICT B — PHASE 3 — STEP 3.11 SUPPORT CENTER UI — POST-STRICT-REVIEW RUNTIME/UX RE-QUALIFICATION FAILED

STEP 3.11 REMAINS OPEN
```

List exact unresolved findings and next targeted action.

---

# PART XXX — ROADMAP

## 38. ROADMAP POLICY

Do not erase previous history:

```text
619a970 — implementation
624cc39 — Strict Review
```

The fact that later runtime evidence exposed issues must remain auditable.

Do not rewrite history as if the original Strict Review never happened.

If re-qualification passes, append the new remediation/re-qualification evidence according to canonical roadmap conventions.

Do not silently renumber steps.

Do not start the next step.

---

# PART XXXI — FINAL RESPONSE

## 39. RETURN TO USER

Return concise Russian summary:

```text
Starting SHA
Remediation SHA
Final HEAD/origin

R0–R9 closure status

Routes implemented
Assignment result
Lifecycle UX result
KPI consistency result
i18n/history result
permission result

Migration status
Frontend test count
Backend Support count
Backend Communication count
TSC/build

Browser role matrix
Console errors/warnings
Network result

Final VERDICT
Exact next action
```

---

# PART XXXII — STOP

## 40. STOP CONDITION

After remediation/re-qualification:

```text
STOP
```

Do not auto-start the next canonical stage.
