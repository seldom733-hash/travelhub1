# PHASE 3 — UI-C6 — REQUEST SERVER-AUTHORITY REMEDIATION
# IMPLEMENTATION PROMPT
## SEC-UI-01 — Canonical Security Blocker

---

## 0. STAGE IDENTITY

```text
PHASE 3
STAGE: UI-C6
NAME: Request Server-Authority Remediation
DEBT: SEC-UI-01
PURPOSE: close Request action authorization gap
TYPE: SECURITY / BACKEND-AUTHORITY REMEDIATION
BASELINE:
d6aebb90182e54f45d1dd8090318542fcc7f26c0
```

This stage starts only from the exact baseline above.

Do not assume that an implementation report, prior SHA, or local state is canonical unless it is verified against Git.

---

# 1. MANDATORY OPERATING MODE

Work in the following order:

```text
AUDIT FIRST
→ IMPLEMENT
→ VERIFY
→ QUALIFY
→ WRITE REPORT
→ GIT HARD CLOSURE
→ FINAL VERDICT
```

Do not begin by editing code.

First inspect the repository and establish the actual BEFORE state.

All developer communication and all generated reports must be in Russian unless a code/API identifier must remain in English.

---

# 2. CANONICAL REASON FOR THIS STAGE

`SEC-UI-01` is the current security blocker.

Canonical roadmap sequencing states:

```text
UI-C6  Request server-authority remediation
UI-C7  Request UI migration
```

and explicitly:

```text
SEC-UI-01 must close before Request UI migration acceptance.
```

The Debt Register identifies:

```text
NOW / BLOCKER
SEC-UI-01 — Request actions server-authoritative
```

Therefore this stage is not optional UI polish.

It is a security-authority remediation.

Do not reinterpret the stage as:

- visual cleanup;
- Request redesign;
- Request lifecycle redesign;
- generic RBAC refactor;
- frontend permission cleanup only.

The objective is to make the backend authoritative for Request actions while preserving all existing business semantics.

---

# 3. ABSOLUTE BASELINE GATE

Before any modification execute and record:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status --porcelain=v1
git diff --check
git branch --show-current
```

Required:

```text
HEAD == d6aebb90182e54f45d1dd8090318542fcc7f26c0
HEAD == origin/master
branch == master
worktree clean
git diff --check == PASS
```

If the baseline differs:

```text
STOP
VERDICT B
```

Do not silently rebase the task onto another SHA.

If documentation-only prompt/report files are uncommitted before implementation, identify them explicitly and distinguish them from functional baseline state. Do not overwrite unrelated work.

---

# 4. AUDIT-FIRST — REQUIRED INSPECTION

Before editing inspect at minimum:

### Backend

- Request entity/model;
- Request controller;
- Request service;
- Request action endpoints;
- Request DTOs;
- Request guards;
- authorization helpers;
- permission constants;
- role/permission matrix;
- workspace/context resolution;
- tenant scoping;
- action transition validation;
- audit event generation;
- relevant tests.

### Frontend

- Request detail page;
- Request action bar/buttons;
- current action visibility logic;
- permission checks;
- status checks;
- action API calls;
- loading/busy handling;
- error handling;
- i18n strings;
- existing shared action components.

### Security infrastructure

Inspect the actual implementation used by:

```text
Order D5
Booking D6
```

Determine how their server-authoritative action contracts work.

Do not copy code blindly.

Identify the reusable authorization pattern already proven by D5/D6.

---

# 5. REQUIRED BEFORE MATRIX

Produce an exact matrix before implementation:

| Action | Current frontend gate | Current backend gate | Status validation | Tenant/workspace validation | Permission validation | Audit event | Server authoritative? |
|---|---|---|---|---|---|---|---|
| Request action 1 | | | | | | | |
| Request action 2 | | | | | | | |
| Request action 3 | | | | | | | |

Use the actual Request actions found in code.

Do not invent action names.

If there are more or fewer actions than expected, use the real set.

For every action identify:

```text
who may execute
under which workspace
under which tenant
under which Request state
with which permission
what transition occurs
what audit event is emitted
what API response is returned
```

---

# 6. SECURITY CONTRACT

The target architecture is:

```text
Frontend
  |
  | request action
  v
Backend Controller
  |
  v
Authentication
  |
  v
Workspace / Tenant Context
  |
  v
Permission / RBAC
  |
  v
Request ownership / scope
  |
  v
Current Request state validation
  |
  v
Allowed transition / action
  |
  v
Mutation
  |
  v
Audit Event
```

The frontend may improve UX by hiding or disabling unavailable actions.

But:

```text
frontend visibility != authorization
```

The backend MUST independently reject unauthorized or invalid actions.

---

# 7. REQUIRED SECURITY PROPERTIES

For every Request action prove:

## 7.1 Authentication

Unauthenticated access cannot execute the action.

Expected result must follow the repository's canonical authentication contract.

Do not invent a new status code if an existing contract already exists.

---

## 7.2 Permission enforcement

A user without the required permission cannot execute the action by calling the API directly.

Test:

```text
authorized role
unauthorized role
```

Do not rely on UI visibility.

---

## 7.3 Tenant isolation

A valid user from Tenant A cannot mutate a Request belonging to Tenant B.

The server must prevent cross-tenant mutation.

No existence leakage should be introduced.

Preserve the project's established cross-context / not-found behavior.

---

## 7.4 Workspace isolation

Verify PLATFORM/PARTNER workspace boundaries.

A Request action must not become executable merely because the user knows the Request ID.

---

## 7.5 State/transition authority

The backend must validate the current Request state before applying an action.

Frontend status checks are not sufficient.

If the current state does not allow an action:

```text
reject
do not mutate
do not emit a false success audit event
```

Do not create a new Request state machine.

Use the existing canonical Request lifecycle and actual allowed transitions.

---

# 8. ACTION CONTRACT

For every Request action document:

```text
Action
Endpoint
HTTP method
Required permission
Required workspace/context
Tenant scope
Allowed source states
Resulting state
Audit event
Success response
Unauthorized response
Forbidden response
Invalid-state response
Not-found/isolation response
```

If the existing API already defines these semantics, preserve them unless the security remediation necessarily requires a correction.

Do not change business meaning merely to make implementation easier.

---

# 9. DO NOT CREATE A SECOND AUTHORIZATION MODEL

Do not introduce:

```text
frontend-only action permissions
duplicate role tables
parallel Request permission constants
hardcoded role checks
controller-only ad-hoc authorization
status-based security without permission checks
tenant checks only in frontend
workspace checks only in frontend
```

Prefer the existing canonical authorization infrastructure.

If D5/D6 use a reusable authorization service/helper/guard, evaluate whether Request can safely use the same mechanism.

If reuse is unsafe because Request semantics differ, document why before introducing a narrowly scoped extension.

---

# 10. REQUEST PERMISSION CONTRACT

Audit the actual permission names first.

Do not invent permission identifiers.

If the existing permission is something like:

```text
requests.update
```

or another repository-defined identifier, use the actual canonical identifier.

Do not rename permissions during this stage unless required by an already accepted architecture contract.

If the existing permission model is insufficiently granular, STOP and report the architectural gap instead of inventing a new RBAC model.

---

# 11. REQUEST STATE CONTRACT

Inspect the actual Request status enum/state machine.

Required:

```text
actual enum
actual producers
actual transitions
actual terminal states
actual action mapping
```

Do not introduce:

```text
new status
new transition
new lifecycle
PARTIALLY_CONFIRMED
```

unless such a value is already canonical in the repository.

The frontend must not derive business truth that the backend does not expose.

---

# 12. IDEMPOTENCY / REPLAY

For each Request action determine whether the existing action is:

```text
idempotent
non-idempotent
transition-once
repeatable
```

The backend must safely reject invalid repeated transitions according to the existing contract.

Do not add a new distributed idempotency system unless the actual API contract requires it.

Do not silently execute an already-completed transition twice.

---

# 13. CONCURRENCY

Inspect whether two simultaneous requests can race on the same Request.

Where the existing persistence layer supports transactional/state-guarded mutation, preserve or strengthen the invariant:

```text
action authorization
+
current-state validation
+
mutation
```

must not be split in a way that permits an invalid transition under concurrency.

Do not introduce speculative locking architecture.

If concurrency correctness cannot be proven with the existing model, record the limitation and STOP rather than claiming security closure.

---

# 14. AUDITABILITY

Every successful Request action must preserve the existing audit contract.

Verify:

```text
actor
tenant/context
action/event
entity
timestamp
before/after state where existing contract supports it
```

Unauthorized attempts must not produce a false successful mutation event.

If the existing security/audit framework records denied actions, preserve that behavior.

Do not create a parallel audit model.

---

# 15. FRONTEND ROLE AFTER REMEDIATION

After backend authority is established, frontend action visibility remains UX.

It may:

```text
hide
disable
show loading
show errors
```

but the backend remains the final authority.

The frontend must not assume that a visible action is guaranteed to succeed.

Handle server rejection deterministically.

---

# 16. ERROR CONTRACT

Audit existing D5/D6 error conventions.

Request actions must return canonical errors for:

```text
unauthenticated
forbidden
not found / isolated context
invalid state
validation failure
conflict, if applicable
unexpected server error
```

Do not convert security failures into generic success.

Do not leak:

```text
tenant existence
workspace existence
permission details
internal stack traces
sensitive entity data
```

Do not invent a new error envelope if an existing canonical envelope exists.

---

# 17. SECURITY TEST MATRIX

Mandatory runtime/API qualification:

| Scenario | Expected |
|---|---|
| authorized user + valid Request + valid action | success |
| authorized user + invalid current state | rejected |
| unauthorized role + valid action | rejected |
| no authentication + action | rejected |
| Tenant A user + Tenant B Request | rejected / canonical isolated response |
| wrong workspace + Request | rejected / canonical isolated response |
| repeated invalid transition | rejected |
| direct API call bypassing frontend | still authorized only by backend rules |
| valid action | mutation + correct audit |
| rejected action | no false mutation |

Use real repository roles and permissions.

Do not use fabricated roles.

---

# 18. REGRESSION REQUIREMENTS

Mandatory regression:

```text
D5 Order actions
D6 Booking actions
D7 financial authority
RBAC
tenant isolation
workspace isolation
audit immutability
Commerce Relation Chain
Request detail
Operations Center Requests
Help Center
```

No unrelated domain behavior may regress.

Especially preserve:

```text
Order → backend-authoritative actions
Booking → backend-authoritative actions
Request → now backend-authoritative
```

---

# 19. ABSOLUTE PRESERVATION GATES

Do NOT change:

- Order state machine;
- Booking state machine;
- Request lifecycle semantics;
- Payment semantics;
- Refund semantics;
- D7 formulas;
- Finance Center scope;
- Product/Service Model scope;
- Commerce Relation Chain;
- Help architecture;
- Notes architecture;
- Audit model;
- tenant model;
- workspace hierarchy;
- entitlement architecture.

Do not reopen:

```text
UI-C2
UI-C4
UI-C5
```

unless a real regression is discovered.

A discovered regression must be reported, not silently absorbed into scope.

---

# 20. PAY-01 PRESERVATION

`PAY-01 — Payment Operational Notes` remains a future requirement.

Do not:

- add Payment Notes in UI-C6;
- reopen UI-C5;
- use Payment Notes as justification for changing Request architecture.

The fact that the shared OperationalNote backend supports Payment does not mean Payment Detail Notes are closed.

---

# 21. PROD-01 / FINANCE PRESERVATION

Do not start:

```text
PROD-01 Product / Service Model
FIN-01 Finance Center
FIN-02 PSP
FIN-03 Payout
```

during UI-C6.

They remain deferred according to the canonical roadmap/debt model.

---

# 22. D8 PRESERVATION

Do not start D8.

D8 is:

```text
Global Temporal Visibility
```

according to the canonical lifecycle contract.

UI-C6 is a security prerequisite on the active Commerce C-track and must not be displaced by D8.

---

# 23. STOP CONDITIONS

Immediately stop implementation and produce VERDICT B if:

1. baseline SHA is not `d6aebb90182e54f45d1dd8090318542fcc7f26c0`;
2. canonical Request actions cannot be determined;
3. canonical Request permissions cannot be determined;
4. existing authorization infrastructure is contradictory;
5. closing SEC-UI-01 requires a new RBAC architecture;
6. closing SEC-UI-01 requires changing the Request state machine;
7. tenant/workspace authority cannot be proven;
8. audit correctness cannot be proven;
9. the implementation unexpectedly requires unrelated schema/domain redesign;
10. functional changes outside UI-C6 scope become necessary.

In all such cases:

```text
STOP
VERDICT B
```

Do not manufacture a PASS.

---

# 24. TEST REQUIREMENTS

Run the narrowest relevant tests first.

At minimum:

```text
Request authorization unit tests
Request service/action tests
Request controller/e2e tests
RBAC/security tests
tenant/workspace isolation tests
Request detail tests
```

Then run relevant regression suites.

Record exact commands and exact results.

Do not report a suite as PASS merely because the command started successfully.

---

# 25. KNOWN PRE-EXISTING FAILURES

Before implementation establish the baseline test state where practical.

Known historical pre-existing failures include unrelated:

```text
frontend formatPrice / NBSP-related failure
backend baseline failures in some broader suites
```

These must be reproduced against the baseline before being classified as pre-existing.

Do not automatically classify any new failure as pre-existing.

For every failure state:

```text
baseline result
post-implementation result
classification
evidence
```

---

# 26. REQUIRED ACCEPTANCE MATRIX

Do not shorten this matrix.

| Gate | Result | Evidence |
|---|---|---|
| Exact Git baseline verified | | |
| HEAD == origin/master at baseline | | |
| Worktree baseline clean | | |
| Request actions inventoried | | |
| Request permissions inventoried | | |
| Request state machine inventoried | | |
| Existing D5/D6 authority pattern inspected | | |
| Backend authorization implemented | | |
| Permission enforcement server-side | | |
| Tenant isolation server-side | | |
| Workspace isolation server-side | | |
| State validation server-side | | |
| Invalid transition rejected | | |
| Direct API bypass tested | | |
| Successful action audited | | |
| Rejected action cannot mutate | | |
| Frontend remains UX layer only | | |
| Error contract preserved | | |
| D5 regression PASS | | |
| D6 regression PASS | | |
| D7 regression PASS | | |
| RBAC regression PASS | | |
| Tenant/workspace regression PASS | | |
| Request UI regression PASS | | |
| Operations Center regression PASS | | |
| No new Request states | | |
| No new RBAC model | | |
| No unrelated domain changes | | |
| PAY-01 preserved as future requirement | | |
| PROD-01 preserved as OPEN/deferred | | |
| FIN-01 preserved as deferred | | |
| D8 remains NOT STARTED | | |
| TSC PASS | | |
| Build PASS | | |
| Relevant test suites PASS | | |
| Browser/runtime qualification PASS where applicable | | |
| Console errors reviewed | | |
| Security negative-path matrix PASS | | |
| Final report created | | |
| Git hard closure PASS | | |

Any security-critical `NOT PROVEN` means:

```text
VERDICT B
```

---

# 27. REQUIRED REPORT

Create:

```text
docs/reports/PHASE_3_UI_C6_REQUEST_SERVER_AUTHORITY_REMEDIATION_QUALIFICATION_REPORT.md
```

Report language: predominantly Russian.

Required sections:

1. Executive Summary
2. Baseline Git State
3. Canonical SEC-UI-01 Definition
4. Request Action Inventory
5. Request Permission Contract
6. Request State Machine
7. Existing D5/D6 Authorization Pattern
8. Before Security Matrix
9. Implementation Changes
10. Backend Authorization Contract
11. Tenant/Workspace Isolation
12. State/Transition Enforcement
13. Audit Contract
14. Frontend Authority Boundary
15. Error Contract
16. Security Negative-Path Qualification
17. Runtime/API Evidence
18. Regression Evidence
19. Known Pre-existing Failures
20. Scope Preservation
21. Acceptance Matrix
22. Findings
23. Residual Risks
24. Final Verdict
25. TRUE NEXT

Use actual evidence only.

Do not fabricate browser screenshots, API responses, test results, or Git SHAs.

---

# 28. TRUE NEXT AFTER UI-C6

Do not decide the next stage before qualification.

After successful closure of UI-C6, re-evaluate the canonical roadmap.

At minimum consider:

```text
UI-C7 Request UI migration
D8
Finance Center
Payment Detail / PAY-01
PROD-01
```

Use dependency, security, architecture, and accepted roadmap evidence.

Do not automatically assume the next stage merely from its numeric label.

---

# 29. GIT HARD CLOSURE

At the end:

```bash
git status --porcelain=v1
git diff --check
git rev-parse HEAD
git rev-parse origin/master
git branch --show-current
git log -5 --oneline --decorate
```

Required:

```text
working tree clean
HEAD == origin/master
branch == master
```

The final SHA must be the actual repository SHA after all implementation and report commits.

Do not copy a SHA from an earlier report.

If implementation and report require multiple commits, document them all and identify one final canonical SHA.

---

# 30. FINAL VERDICT FORMAT

Use exactly one of:

```text
VERDICT A — UI-C6 ACCEPTED / SEC-UI-01 CLOSED
```

or

```text
VERDICT B — UI-C6 NOT ACCEPTED
```

VERDICT A is permitted only when:

```text
backend authority proven
+
negative-path security proven
+
tenant/workspace isolation proven
+
state validation proven
+
audit correctness proven
+
regression acceptable
+
TSC PASS
+
build PASS
+
Git hard closure PASS
```

Do not issue VERDICT A on implementation intent alone.

---

# 31. FINAL RESPONSE FORMAT

Return:

```text
PHASE 3 — UI-C6
SEC-UI-01 — REQUEST SERVER-AUTHORITY REMEDIATION

BASELINE SHA:
d6aebb90182e54f45d1dd8090318542fcc7f26c0

VERDICT:
...

SEC-UI-01:
...

SECURITY:
...

TESTS:
...

TSC:
...

BUILD:
...

GIT:
...

FINAL SHA:
...

TRUE NEXT:
...
```

If VERDICT B, clearly identify the blocking evidence.

---

# 32. CORE PRINCIPLE

The goal is not to make Request actions look authorized.

The goal is to make authorization true on the server.

```text
UI visibility
    ↓
UX convenience

Backend authorization
    ↓
Security authority
```

The frontend may suggest.

The backend decides.

`SEC-UI-01` is closed only when that distinction is demonstrably true in the running system.
