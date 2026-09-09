# PHASE 3 — UI-C6 — REQUEST SERVER-AUTHORITY REMEDIATION
## FINAL IMPLEMENTATION + QUALIFICATION PROMPT

**Project:** TravelHub  
**Repository:** `seldom733-hash/travelhub1`  
**Baseline:** `5785b87a854fdb9fd8de27bd970de880e3cc21f7`  
**Stage:** `UI-C6`  
**Debt:** `SEC-UI-01 — Request Actions Server-Authority Gap`

---

# 1. OBJECTIVE

Implement and qualify **UI-C6 — Request Server-Authority Remediation**.

The sole purpose of this stage is to close the security debt:

> Request actions are currently frontend-gated rather than server-authoritative.

Canonical target:

```text
Request API
    ↓
server-authoritative availableActions
    ↓
Request UI consumes availableActions
    ↓
user sees only actions authorized for the current request/context
```

The frontend must no longer be the authority that determines whether a Request action is available.

This stage is a **security remediation**, not a visual refactor.

---

# 2. CANONICAL BASELINE

Start from exactly:

```text
5785b87a854fdb9fd8de27bd970de880e3cc21f7
```

Before any implementation:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status --porcelain=v1
git diff --check
```

Expected:

```text
HEAD == 5785b87a854fdb9fd8de27bd970de880e3cc21f7
```

The existing unrelated `docs/prompts/*` working-tree changes are pre-existing and must NOT be deleted, rewritten, or included in the UI-C6 implementation commit unless explicitly proven necessary by the stage.

---

# 3. GOVERNANCE STATE — DO NOT CHANGE

The current canonical governance state is:

```text
SEC-UI-01:
OPEN

Planned closure stage:
UI-C6 — Request Server-Authority Remediation

Closure SHA:
—

UI-C6:
NOT STARTED before this implementation

UI-C7:
dependent on SEC-UI-01 CLOSED

Finance Center:
DEFERRED / NOT STARTED

PROD-01:
OPEN / DEFERRED

D8:
NOT STARTED
```

Do NOT modify the Debt Register merely to make the stage appear closed.

SEC-UI-01 may be marked CLOSED only after the implementation and qualification acceptance criteria below are actually proven.

---

# 4. AUDIT FIRST — MANDATORY

Before changing code, perform a repository audit.

Inspect the actual implementation at the baseline and identify:

1. Request controller(s);
2. Request service/domain service(s);
3. Request DTO(s);
4. Request detail API response;
5. Request detail frontend page;
6. current frontend action derivation;
7. existing server-authoritative action patterns from D5/D6 or other canonical entities;
8. existing RBAC permission definitions and guards;
9. workspace/tenant resolution;
10. existing status/state-machine definitions;
11. existing action execution endpoints;
12. existing tests covering Request actions.

Do NOT infer architecture from old reports if current source contradicts them.

Use current source and accepted D5/D6 patterns as authority.

Create an audit matrix before implementation:

| Area | Current implementation | Canonical target | Required change |
|---|---|---|---|
| Request API | actual | exposes authoritative `availableActions` | determine |
| Request action execution | actual | server validates authorization/state | determine |
| RBAC | actual | server-side | determine |
| Tenant/workspace | actual | server-side isolation | determine |
| Request frontend | actual | consumes API actions only | determine |
| Tests | actual | security + contract coverage | determine |

If the audit reveals that the canonical target is already fully implemented, STOP and produce a qualification report instead of making redundant changes.

If an unexpected architectural/schema migration is required, STOP and report the blocker before implementing it.

---

# 5. SECURITY DEBT DEFINITION

Current SEC-UI-01 canonical definition:

```text
ID:
SEC-UI-01

Title:
Request actions are frontend-gated, not server-authoritative

Category:
SECURITY

Severity:
P1

Why it matters:
Frontend hiding ≠ authorization.
A malicious user could invoke forbidden Request actions via direct API calls.

Dependency:
Request controller must expose availableActions.

Acceptance condition:
Request API returns availableActions;
frontend consumes only this list.

Notes:
Do not simply wrap frontend-derived actions in <EntityActionBar />.
```

The remediation must address the actual authorization boundary, not merely the presentation.

---

# 6. SERVER-AUTHORITY CONTRACT

Implement a canonical server-authoritative `availableActions` contract for Request detail.

The exact DTO/type shape must follow existing TravelHub conventions where possible.

At minimum, the Request detail API must expose:

```text
availableActions
```

as the server-calculated set of actions available to the current authenticated user in the current:

```text
identity
→ workspace context
→ tenant/partner scope
→ role/permissions
→ request state
```

The server is authoritative.

The frontend must not recreate the business/security decision.

---

# 7. ACTION SEMANTICS

Do NOT invent new Request business actions.

First enumerate the actions that already exist in the current Request implementation.

For each existing action, determine:

- action identifier;
- current status/state prerequisites;
- permission prerequisite;
- workspace/tenant prerequisite;
- whether the action has a real execution endpoint;
- whether the endpoint already performs server-side validation.

Produce an implementation matrix:

| Action | Existing endpoint | Existing state rule | Existing permission | Server-authoritative after UI-C6 |
|---|---|---|---|---|
| actual action | actual | actual | actual | YES/NO |

Only remediate existing Request action semantics.

Do not create a new Request state machine.

Do not rename canonical Request statuses.

Do not invent `PARTIALLY_CONFIRMED` or any other non-canonical status.

---

# 8. SERVER-SIDE AUTHORIZATION

`availableActions` must be calculated on the server.

The calculation must respect:

1. authenticated identity;
2. workspace context;
3. tenant/partner scope;
4. RBAC permissions;
5. Request status/state;
6. any existing domain invariants;
7. existing ownership/scope rules.

A frontend-only condition such as:

```ts
request.status === ...
```

is NOT sufficient.

A server-side response that simply mirrors frontend-derived action names without evaluating authorization is NOT sufficient.

Do not trust:

- action names supplied by the client;
- client-selected status;
- client-selected tenant;
- client-selected workspace;
- hidden UI controls;
- disabled buttons.

---

# 9. ACTION EXECUTION ENDPOINTS

Audit every Request action execution endpoint.

For every action that can mutate Request state:

```text
client request
    ↓
authentication
    ↓
workspace/tenant resolution
    ↓
permission authorization
    ↓
domain/state validation
    ↓
mutation
```

must remain server-authoritative.

If an endpoint currently allows a forbidden action merely because the frontend normally hides the button, remediate that endpoint as part of SEC-UI-01.

Do NOT assume that `availableActions` alone closes the debt if direct action execution remains unauthorized.

Conversely, do not rewrite already-correct authorization logic unnecessarily.

---

# 10. FRONTEND CONTRACT

The Request detail frontend must consume:

```text
availableActions
```

from the server response.

The frontend may:

- render;
- hide;
- disable;
- group;
- localize;
- order;
- present confirmation dialogs;

but it must NOT independently determine authorization/business availability.

Forbidden pattern:

```ts
const availableActions =
  request.status === "X"
    ? [...]
    : [...]
```

or equivalent frontend status/role matrix.

Required conceptual pattern:

```text
API response.availableActions
        ↓
Request UI
        ↓
Action rendering
```

The frontend may retain purely presentational logic, but the authoritative action set must originate from the server.

---

# 11. ENTITY ACTION BAR

If an existing shared:

```text
<EntityActionBar />
```

exists, it may be reused.

However:

> Do NOT simply wrap the old frontend-derived actions in `<EntityActionBar />`.

The source of truth must change first.

`EntityActionBar` is a presentation component, not an authorization authority.

---

# 12. TYPE SAFETY

Use the existing typed contracts where possible.

Prefer a shared/typed action identifier if the project already has a canonical pattern.

Avoid:

```ts
string[]
```

when an existing domain union/enum/type can safely represent the action identifiers.

Do not create duplicate incompatible action registries.

If a shared type is introduced, document the ownership and authority.

---

# 13. API RESPONSE COMPATIBILITY

Preserve existing Request detail data.

The remediation should be additive where possible:

```text
existing Request detail DTO
+
availableActions
```

Do not silently remove existing fields.

Do not change unrelated response semantics.

Do not change pagination/filter behavior of Operations Center.

Do not change Request lifecycle semantics.

Do not change unrelated Orders, Bookings, Payments, Finance, Help, or Commerce Relation Chain behavior.

---

# 14. SECURITY TEST MATRIX

Mandatory tests must prove both positive and negative authorization.

At minimum test:

### A. Authorized user

```text
authorized role
+ correct workspace
+ correct tenant
+ valid Request state
→ action present
→ action execution succeeds
```

### B. Missing permission

```text
same tenant/workspace
+ role without required permission
→ action absent from availableActions
→ direct action execution rejected
```

### C. Wrong tenant

```text
authenticated user
+ different tenant Request
→ Request access denied/not found according to canonical isolation contract
→ no availableActions leakage
```

### D. Wrong workspace

```text
authenticated user
+ Request outside current workspace context
→ denied/not found according to canonical isolation contract
→ no action leakage
```

### E. Invalid Request state

```text
authorized user
+ action not valid for current state
→ action absent
→ direct endpoint rejects attempted action
```

### F. Client spoofing

Attempt to invoke an action that is:

```text
not present in availableActions
```

directly through the API.

Expected:

```text
server rejects the operation
```

The server must not trust the client merely because the client submitted a syntactically valid action.

---

# 15. AVAILABLE-ACTIONS CONTRACT TEST

Add a focused contract test proving:

```text
Request detail response
    contains availableActions
```

and that the returned actions correspond to the server-side authorization/state calculation.

At least one negative case must prove that changing only the frontend would not bypass authorization.

If the project already has a canonical contract-test pattern, reuse it.

---

# 16. RBAC MATRIX

Explicitly document the actual Request action authorization matrix found during audit.

Example structure:

| Role | Permission | Request state | Action | availableActions | Direct API |
|---|---|---|---|---|---|
| actual role | actual permission | actual state | actual action | allowed | allowed |
| actual role | missing permission | same state | same action | absent | denied |
| wrong scope | any | any | any | inaccessible | denied |

Do not invent permissions.

Use the project's existing permission identifiers.

---

# 17. TENANT / WORKSPACE ISOLATION

Prove that `availableActions` cannot leak information across:

```text
PLATFORM
PARTNER
tenant/partner scope
```

The action calculation must operate only after the canonical scope/access gate.

A request from another tenant must not produce a meaningful action list.

A request outside the current workspace must not expose actions.

Do not rely on frontend route guards for this.

---

# 18. STATUS / STATE MACHINE PRESERVATION

The implementation must preserve the existing canonical Request status model.

Before and after implementation compare:

- status enum;
- transitions;
- action-to-status relationships;
- action execution semantics.

No unrelated status changes are allowed.

If a mismatch between frontend and backend state semantics is discovered, use the backend/domain state machine as canonical and document the discrepancy.

Do not silently redefine business meaning.

---

# 19. UI QUALIFICATION

After backend implementation, qualify the Request detail UI.

Verify:

1. actions displayed from `availableActions`;
2. no frontend action matrix remains;
3. unauthorized actions are absent;
4. authorized actions appear;
5. action execution works;
6. stale/invalid action is rejected by server;
7. Request detail remains usable after refresh;
8. direct URL works;
9. loading state does not accidentally authorize actions;
10. empty `availableActions` is handled safely.

No optimistic assumption that an action is allowed before the API response is authoritative.

---

# 20. RUNTIME SECURITY MATRIX

Perform real runtime verification.

Minimum:

| Scenario | Expected |
|---|---|
| same tenant + authorized role | allowed actions visible |
| same tenant + unauthorized role | restricted actions absent / API denied |
| wrong tenant | 404-like/no leakage according to canonical contract |
| wrong workspace | 404-like/no leakage according to canonical contract |
| direct unauthorized action API call | denied |
| invalid action for state | denied |
| page refresh | same authoritative action set |
| direct Request URL | same authorization behavior |

Capture actual evidence.

Do not fabricate screenshots, logs, or API responses.

---

# 21. REGRESSION SCOPE

Run targeted Request tests first.

Then run the relevant regression suites covering:

- Request detail;
- RBAC;
- tenant/workspace isolation;
- Commerce detail pages;
- Operations Center;
- existing shared action components;
- API contracts.

Do not require unrelated historical failures to become green unless they are caused by UI-C6.

If a pre-existing failure exists:

1. run baseline evidence where feasible;
2. identify it explicitly;
3. prove it is unrelated;
4. do not hide it;
5. do not change unrelated code just to improve the verdict.

---

# 22. STATIC QUALITY GATES

Mandatory:

```bash
git diff --check
```

and project-standard:

```text
TypeScript check
frontend tests
backend tests
build
```

Use the repository's actual scripts.

Do not invent commands.

Record exact results.

---

# 23. STOP CONDITIONS

STOP and report a blocker before continuing if any of the following occurs:

- schema migration appears necessary;
- Request action semantics are undocumented/ambiguous and cannot be resolved from current source;
- a new permission is required but no approved permission contract exists;
- existing endpoint authorization contradicts canonical RBAC and requires broader architecture changes;
- workspace/tenant authority cannot be determined;
- implementation would require changing unrelated domain models;
- UI-C6 would require changing Orders/Bookings/Payments/Finance architecture;
- a hidden historical document conflicts with actual Git/source in a way that cannot be resolved;
- tests reveal an unrelated but security-critical systemic defect;
- current HEAD differs from the required baseline before implementation;
- unexpected changes are found in files outside the justified UI-C6 scope.

Do not guess.

---

# 24. SCOPE BOUNDARY

## IN SCOPE

- Request `availableActions`;
- server-side action calculation;
- Request action authorization;
- Request action endpoint enforcement where required;
- Request DTO/API contract;
- Request detail frontend consumption;
- focused security/contract/unit/e2e tests;
- necessary i18n/type adjustments directly caused by the remediation;
- qualification report.

## OUT OF SCOPE

Do NOT implement:

- UI-C7 Request UI migration;
- Finance Center;
- Payments redesign;
- Refunds;
- Finance Analytics;
- PROD-01 Product Model;
- Seller Service Cards;
- D8;
- new Request business workflow;
- new Request statuses;
- unrelated UI cleanup;
- unrelated refactors;
- Debt Register restructuring;
- roadmap restructuring.

---

# 25. SEC-UI-01 CLOSURE CRITERIA

SEC-UI-01 may be considered CLOSED only if ALL are true:

### C1 — API authority

Request API returns server-authoritative:

```text
availableActions
```

### C2 — Server authorization

Available actions are calculated from:

```text
identity
workspace
tenant/scope
permissions
Request state
domain invariants
```

### C3 — Execution authority

Direct invocation of unauthorized Request actions is rejected by the server.

### C4 — Frontend consumption

Request frontend consumes `availableActions` and does not recreate authorization/business action availability.

### C5 — Negative security proof

Missing permission / wrong scope / invalid state cannot obtain or execute forbidden actions.

### C6 — Regression

Relevant Request/RBAC/isolation tests pass or pre-existing failures are explicitly isolated.

### C7 — Static/build

TypeScript/build/diff-check pass according to project gates.

### C8 — Runtime

Real Request UI and API runtime qualification passes.

### C9 — Evidence

Qualification report contains actual evidence, not claims.

### C10 — Git closure

Implementation + tests + report are committed and pushed.

Final:

```text
HEAD == origin/master
git status --porcelain=v1
git diff --check
```

The implementation commit SHA becomes the evidence for SEC-UI-01 closure.

---

# 26. REQUIRED QUALIFICATION REPORT

Create:

```text
docs/reports/PHASE_3_UI_C6_REQUEST_SERVER_AUTHORITY_REMEDIATION_QUALIFICATION_REPORT.md
```

The report must contain:

1. Executive Summary;
2. Baseline SHA;
3. Audit-First findings;
4. Current Request action architecture;
5. Before/After authority model;
6. `availableActions` contract;
7. Action matrix;
8. RBAC matrix;
9. Tenant/workspace isolation evidence;
10. Endpoint enforcement evidence;
11. Frontend consumption evidence;
12. Security test matrix;
13. Runtime evidence;
14. Regression results;
15. TSC/build results;
16. known pre-existing failures;
17. changed files;
18. scope verification;
19. SEC-UI-01 acceptance matrix C1–C10;
20. Git evidence;
21. final verdict.

---

# 27. FINAL VERDICT RULE

Use:

```text
VERDICT A — SEC-UI-01 CLOSED / UI-C6 ACCEPTED
```

ONLY when every mandatory closure criterion is proven.

Otherwise:

```text
VERDICT B — UI-C6 NOT ACCEPTED
```

and identify the exact blocker.

Never convert a valid-system-fail or incomplete security proof into Verdict A.

---

# 28. DEBT REGISTER CLOSURE

If and ONLY IF UI-C6 passes all qualification gates, update:

```text
docs/TRAVELHUB_DEBT_REGISTER.md
```

for SEC-UI-01:

```text
Status:
CLOSED

Closure SHA:
<actual final accepted commit SHA>
```

Do not close it before qualification.

Preserve:

```text
ID
Title
Severity
Description
Acceptance condition
```

Do not rewrite unrelated debts.

---

# 29. GIT HARD CLOSURE

After implementation and qualification:

```bash
git status --porcelain=v1
git diff --check
git rev-parse HEAD
git rev-parse origin/master
git show --stat --oneline HEAD
```

Expected:

```text
HEAD == origin/master
```

The UI-C6 commit must contain only justified implementation/test/report/Debt Register changes.

Do not include the pre-existing unrelated `docs/prompts/*` working-tree changes.

Do not use:

```text
git reset --hard
git clean -fd
git rebase
git push --force
```

to manufacture a clean state.

---

# 30. REQUIRED FINAL RESPONSE FROM AGENT

Return:

```text
PHASE 3 — UI-C6

Baseline:
5785b87a854fdb9fd8de27bd970de880e3cc21f7

Audit:
PASS / BLOCKED

Implementation:
PASS / BLOCKED

Security:
PASS / BLOCKED

availableActions:
PASS / BLOCKED

Server-side authorization:
PASS / BLOCKED

Direct API enforcement:
PASS / BLOCKED

Frontend consumption:
PASS / BLOCKED

Tenant/workspace isolation:
PASS / BLOCKED

Tests:
...

TSC:
...

Build:
...

Runtime:
...

SEC-UI-01:
OPEN / CLOSED

Final SHA:
...

HEAD:
...

origin/master:
...

git diff --check:
PASS / FAIL

Qualification report:
docs/reports/PHASE_3_UI_C6_REQUEST_SERVER_AUTHORITY_REMEDIATION_QUALIFICATION_REPORT.md

FINAL VERDICT:
VERDICT A — SEC-UI-01 CLOSED / UI-C6 ACCEPTED
```

If Verdict B:

```text
VERDICT B — UI-C6 NOT ACCEPTED

BLOCKER:
<exact blocker>

SEC-UI-01 remains OPEN.
```

---

# 31. STOP AFTER VERDICT

After final Git closure and verdict:

**STOP.**

Do not start UI-C7.

Do not start another roadmap stage.

Do not modify unrelated debts.

Do not perform cleanup outside the accepted UI-C6 scope.

UI-C7 may be considered only in a separate subsequent TRUE NEXT / sequencing decision after SEC-UI-01 is actually closed.
