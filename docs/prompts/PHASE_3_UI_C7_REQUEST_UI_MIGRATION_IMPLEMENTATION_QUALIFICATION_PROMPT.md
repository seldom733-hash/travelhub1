# PHASE 3 — UI-C7 — REQUEST UI MIGRATION
## FINAL IMPLEMENTATION + QUALIFICATION CONTRACT

### ROLE

Implement and qualify:

> **PHASE 3 — UI-C7 — Request UI Migration**

This stage is authorized because the preceding audit proved:

`VERDICT A — AUDIT READY`

Current baseline:

`76c69e94491bc96c3f6366c9178ceca34db435b1`

TRUE NEXT:

`UI-C7 — Request UI Migration`

Do not expand the scope beyond this contract.

---

# 1. CANONICAL OBJECTIVE

Migrate the existing Request Detail presentation to the canonical Commerce Detail UI pattern while preserving all existing business behavior, server authority, API contracts, security, lifecycle semantics and Request-specific content.

Core rule:

```text
UI migration
≠
business logic redesign
≠
server-authority remediation
≠
new domain model
≠
new permissions
≠
API redesign
```

UI-C6 is already closed.

Do not reimplement UI-C6.

---

# 2. GOVERNING SOURCE

The implementation must follow the completed audit:

`docs/reports/PHASE_3_UI_C7_REQUEST_UI_MIGRATION_AUDIT_FIRST_MAPPING_REPORT.md`

Audit baseline:

`76c69e94491bc96c3f6366c9178ceca34db435b1`

Use the audit's evidence-based scope as the governing C7 implementation boundary.

If implementation discovers a contradiction with the audit:

**STOP before expanding scope.**

Report the contradiction and request approval.

---

# 3. CURRENT CANONICAL CONTRACTS

## 3.1 Request actions

The Request Detail receives:

```ts
availableActions: {
  confirmPrice: boolean;
  proposePrice: boolean;
  reject: boolean;
  unavailable: boolean;
  customerAccept: boolean;
  customerDecline: boolean;
  convert: boolean;
}
```

All seven fields are server-authoritative.

Existing permission:

`order.edit_noncritical`

Do not create additional permissions.

Do not derive action availability from `RequestStatus`.

Do not duplicate server lifecycle rules in frontend.

The frontend must continue consuming:

```ts
const actions = r.availableActions ?? {
  confirmPrice: false,
  proposePrice: false,
  reject: false,
  unavailable: false,
  customerAccept: false,
  customerDecline: false,
  convert: false,
};
```

Preserve the existing safe-default contract required by the C6 regression guard.

---

# 4. CANONICAL COMMERCE DETAIL STRUCTURE

Request Detail must remain based on:

```text
EntityDetailShell
  └── EntityDetailHeader
        └── actions slot

EntityDetailLayout
  ├── Main
  ├── Aside
  └── Wide
```

Canonical lower surfaces:

```text
CommerceRelationChain
OperationalNotes
EntityAuditHistory
```

Timeline remains:

```text
EntityTimeline
```

Strict separation:

```text
EntityTimeline
    ≠
OperationalNotes
    ≠
EntityAuditHistory
```

Do not merge, duplicate or replace these components.

---

# 5. MUST CHANGE

## 5.1 Move Request Actions to Header

Current:

```text
EntitySectionCard "ДЕЙСТВИЯ"
inside MAIN
```

Target:

```text
EntityDetailHeader
  actions={...}
```

Create:

`frontend/components/request/RequestActionBar.tsx`

The component is Request-specific because its action contract differs from Order/Booking.

It must support:

- all seven actions;
- `availableActions`;
- existing action callbacks;
- existing `runPost` semantics;
- existing busy/loading behavior;
- existing localized labels;
- existing propose-price inline input/toggle behavior.

Do not introduce a modal or drawer.

---

## 5.2 Remove local button primitive

Remove the Request Detail local:

```text
btn()
TONES
```

Use the established canonical button/tone presentation pattern inside RequestActionBar.

Do not create a new design system.

---

## 5.3 Remove InfoRow alias

Remove the local `InfoRow` wrapper.

Use `EntityField` directly while preserving the existing visual/content semantics.

This is a mechanical presentation cleanup only.

---

## 5.4 Remove dead client permission code

Remove:

```text
canEdit
useCan
```

from Request Detail if they are only the unused pre-C6 client permission artifact identified by the audit.

Do not replace them with another client-side permission calculation.

---

# 6. SHOULD CHANGE

## 6.1 Loading / Error / Not-found

Align Request Detail loading/error/not-found presentation with the established Order/Booking centered pattern.

Preserve all existing behavior and localization.

Where appropriate use:

```text
crm.loading
crm.back_to_list
crm.not_found
```

Do not introduce new strings unnecessarily.

---

## 6.2 Breadcrumb fallback

Remove the dead hardcoded fallback:

```text
|| "Заявки"
```

Use the canonical i18n key directly.

Do not change breadcrumb semantics.

---

## 6.3 Propose-price accessibility

Give the propose-price input an accessible name through a proper label association or equivalent accessible naming mechanism.

Do not change its business behavior.

---

# 7. MUST NOT CHANGE

Do not modify:

### Server authority

- `computeRequestAvailableActions`;
- Request action availability rules;
- Request lifecycle rules;
- status gates;
- deadline gates;
- D3 requirements;
- conversion rules;
- CAS/idempotency behavior.

### API / DTO

- Request Detail endpoint;
- `availableActions` shape;
- existing DTO fields;
- Request History endpoint.

No backend enrichment is expected.

### Permissions

Preserve:

```text
order.read
order.edit_noncritical
```

No new permissions.

### Request lifecycle

Do not change:

- `RequestStatus`;
- action endpoints;
- endpoint paths;
- action request bodies;
- hard-coded reject/unavailable reason behavior;
- transition semantics.

### Commerce relations

Do not modify:

```text
Request → Order → Booking
```

Do not implement new relation resolution.

### Existing canonical surfaces

Do not redesign or replace:

- `CommerceRelationChain`;
- `EntityTimeline`;
- `OperationalNotes`;
- `EntityAuditHistory`;
- Request-specific ProgressBadge;
- Supplier/Customer/Rejection cards;
- converted payments/refunds relation content;
- D5 conversion context.

### Other domains

Do not modify:

- Order Detail;
- Booking Detail;
- Finance Center;
- Payments backend;
- PROD-01;
- D8;
- unrelated debt items.

### Governance

Do not modify:

- Debt Register;
- roadmap;
- existing prompts;
- `.gitignore`.

---

# 8. DESTRUCTIVE ACTION CONFIRMATION DECISION

Do **not** add confirmation dialogs for:

```text
reject
unavailable
customerDecline
```

unless implementation discovers an existing canonical Request-specific confirmation contract that was missed by the audit.

The audit recommendation is to preserve current Request-flow semantics.

Adding confirmation is an independent UX change, not required for C7 migration.

---

# 9. PROPOSE-PRICE UX DECISION

Preserve the existing inline toggle/input UX.

Do not convert it to:

- modal;
- drawer;
- separate page;
- new interaction pattern.

Move the existing interaction into `RequestActionBar` without changing its business behavior.

---

# 10. REQUIRED FILE SCOPE

Expected production files:

```text
frontend/app/app/requests/[id]/page.tsx
frontend/components/request/RequestActionBar.tsx
```

Expected test file:

```text
frontend/lib/commerce-detail-system.spec.tsx
```

Possible regression-only updates:

```text
frontend/lib/request-center.spec.ts
frontend/lib/requests-registry.spec.tsx
```

Only modify them if actual regression requires it.

Backend:

```text
NO CHANGES EXPECTED
```

Qualification report:

```text
docs/reports/PHASE_3_UI_C7_REQUEST_UI_MIGRATION_QUALIFICATION_REPORT.md
```

Do not modify unrelated files.

If an unexpected file becomes necessary:

**STOP and report why before proceeding.**

---

# 11. IMPLEMENTATION REQUIREMENTS

## 11.1 RequestActionBar

The new component must:

- accept the typed `availableActions`;
- never inspect RequestStatus to decide visibility;
- never inspect permissions to decide visibility;
- expose the seven existing actions only;
- preserve existing API paths and bodies;
- preserve `busy`/execution state;
- preserve localization;
- preserve propose-price interaction;
- remain keyboard accessible;
- work responsively in the header actions slot.

Do not silently omit any of the seven actions from the component contract.

Visibility is determined only by the corresponding `availableActions` boolean.

---

# 12. TEST REQUIREMENTS

Update/add tests necessary to prove:

### Actions

- Request actions render in the header actions slot;
- all seven actions remain wired;
- action visibility follows `availableActions`;
- no local RequestStatus action matrix exists;
- `runPost`/API paths and bodies remain unchanged;
- safe-default `availableActions ?? {all:false}` contract remains.

### Canonical structure

- canonical shell remains;
- relations remain;
- timeline remains;
- notes remain;
- audit remains;
- Request-specific cards remain.

### Loading / error

- loading is centered;
- error is centered;
- back-to-list behavior remains correct;
- not-found behavior remains correct.

### Accessibility

- propose-price input has accessible name;
- action buttons are keyboard accessible;
- no hover-only interaction.

### Regression

Run relevant existing Request/Commerce tests.

Do not weaken or delete tests merely to obtain PASS.

---

# 13. SECURITY QUALIFICATION

The implementation must prove:

1. `order.read` remains server-authoritative.
2. `order.edit_noncritical` remains server-authoritative.
3. No frontend permission calculation replaces server `availableActions`.
4. Direct Request URL remains protected.
5. Unauthorized actor does not receive executable actions.
6. Request access does not automatically grant Order/Booking access.
7. Relation links cannot bypass destination authorization.
8. No new permission is introduced.

At minimum perform a runtime/browser check with:

### Authorized actor

Actor with:

`order.read + order.edit_noncritical`

Verify a suitable Request state and exact action rendering from server projection.

### Read-only actor

Actor with:

`order.read` but without `order.edit_noncritical`

Verify:

```text
availableActions = all false
```

and no action UI is rendered.

Do not mutate business state merely to test presentation.

---

# 14. BROWSER / RUNTIME QUALIFICATION

Run the actual current application.

Verify Request Detail at:

```text
/app/requests/:id
```

Test:

- direct navigation;
- refresh;
- header actions;
- Request-specific content;
- relation chain;
- timeline;
- notes;
- audit;
- responsive action wrapping;
- console.

Minimum viewport checks:

```text
375
768
1024
1280
```

Browser console:

```text
0 new C7 errors
0 new C7 warnings
```

Do not count normal React DevTools/HMR informational messages as errors.

Capture durable evidence in the qualification report.

Screenshots are optional; API/DOM/network/console records are the durable evidence.

---

# 15. I18N

Verify RU/AZ/EN.

No new hardcoded user-visible strings.

Existing:

```text
reqflow.*
requests.*
crm.*
```

keys should be reused where applicable.

Do not modify translation dictionaries unless a genuinely missing C7-visible key is proven.

If a translation change becomes necessary, stop and document the reason before expanding file scope.

---

# 16. RESPONSIVE / ACCESSIBILITY

Verify:

- no horizontal overflow at 375px;
- header action wrapping;
- readable labels;
- keyboard operation;
- accessible propose-price input;
- visible focus;
- no hover-only controls.

Do not redesign the global accessibility system.

---

# 17. REGRESSION

Run:

- targeted C7 tests;
- Request-related frontend tests;
- UI-C6 server-authority e2e;
- relevant Commerce Detail regression;
- full frontend test suite;
- backend tests as appropriate to prove no API regression;
- TypeScript;
- production build.

Existing baseline failures must be identified separately.

Do not attribute a pre-existing failure to C7 without evidence.

Known baseline failure from previous qualification:

```text
frontend i18n.spec formatPrice NBSP
```

Do not silently ignore it.

---

# 18. REQUIRED QUALIFICATION MATRIX

Produce:

| Gate | Expected | Result | Evidence |
|---|---|---|---|
| Canonical shell | preserved | PASS/FAIL | ... |
| Header actions | RequestActionBar | PASS/FAIL | ... |
| 7 actions | all contract fields preserved | PASS/FAIL | ... |
| Server authority | availableActions only | PASS/FAIL | ... |
| No local status matrix | absent | PASS/FAIL | ... |
| API paths/bodies | unchanged | PASS/FAIL | ... |
| Relation chain | unchanged | PASS/FAIL | ... |
| Timeline | unchanged | PASS/FAIL | ... |
| Notes | unchanged | PASS/FAIL | ... |
| Audit | unchanged | PASS/FAIL | ... |
| Request-specific cards | preserved | PASS/FAIL | ... |
| Loading/error | canonical | PASS/FAIL | ... |
| Accessibility | input/action checks | PASS/FAIL | ... |
| RU/AZ/EN | PASS | PASS/FAIL | ... |
| Responsive | 375/768/1024/1280 | PASS/FAIL | ... |
| RBAC | read-only actor | PASS/FAIL | ... |
| Direct URL | protected | PASS/FAIL | ... |
| Browser console | no new C7 errors | PASS/FAIL | ... |
| UI-C6 regression | PASS | PASS/FAIL | ... |
| TSC | PASS | PASS/FAIL | ... |
| Build | PASS | PASS/FAIL | ... |
| Full regression | PASS / documented baseline | PASS/FAIL | ... |
| Git | synchronized | PASS/FAIL | ... |

---

# 19. QUALIFICATION REPORT

Create:

`docs/reports/PHASE_3_UI_C7_REQUEST_UI_MIGRATION_QUALIFICATION_REPORT.md`

It must contain:

1. Executive Summary
2. Baseline
3. Implementation Scope
4. Files Changed
5. Canonical UI Migration
6. Request Action Bar
7. API / Server Authority Preservation
8. Security / RBAC
9. Relation Chain
10. Timeline / Notes / Audit
11. Loading / Error / Not-found
12. i18n
13. Accessibility
14. Responsive
15. Tests
16. Browser Runtime Verification
17. Regression
18. Qualification Matrix
19. Known Pre-existing Failures
20. Git State
21. Scope Compliance
22. Final Verdict

Every material claim must be backed by source/test/runtime evidence.

---

# 20. GIT CLOSURE

Before final verdict verify:

```bash
git status --short --untracked-files=all
git rev-parse HEAD
git rev-parse origin/master
git diff HEAD origin/master
git diff --check
```

Required:

```text
tracked modifications = NONE
HEAD == origin/master
git diff HEAD origin/master = EMPTY
git diff --check = PASS
```

Historical PHASE_3 prompt artifacts may remain untracked.

Do not delete or silently commit them.

The final report must distinguish tracked cleanliness from untracked process artifacts.

---

# 21. SCOPE STOP RULE

STOP immediately if any of the following becomes necessary:

- backend code change;
- schema change;
- API/DTO change;
- new permission;
- tenant/workspace model change;
- Request lifecycle change;
- Order/Booking contract change;
- Debt Register modification;
- roadmap modification;
- `.gitignore` modification;
- Finance/D8/PROD-01 work;
- new unrelated architectural dependency.

Document the blocker and do not improvise.

---

# 22. FINAL VERDICT

### VERDICT A — ACCEPTED

Only if:

- all MUST changes are implemented;
- SHOULD changes are either completed or explicitly justified;
- no MUST NOT constraint was violated;
- server authority remains intact;
- seven-action contract remains intact;
- canonical shell is preserved;
- Request-specific content remains intact;
- security passes;
- browser runtime passes;
- tests/TSC/build are acceptable;
- no unexplained regression exists;
- Git closure is satisfied.

State:

```text
UI-C7 = ACCEPTED
Request UI Migration = COMPLETE
Backend changes = NONE
Security regression = NONE
UI-C6 contract = PRESERVED
```

### VERDICT B — VALID SYSTEM FAIL / REMEDIATION REQUIRED

Use if implementation is substantially correct but one or more acceptance gates fail.

List exact failures.

Do not declare ACCEPTED.

### VERDICT C — BLOCKED

Use if an unexpected dependency or architectural ambiguity prevents safe completion.

Do not improvise.

---

# 23. CRITICAL FINAL RULE

Do not declare PASS merely because the code compiles.

UI-C7 requires:

```text
SOURCE
+
TESTS
+
SECURITY
+
BROWSER RUNTIME
+
REGRESSION
+
GIT
```

all reconciled.

After final qualification:

**STOP.**

Do not begin UI-C8, D8, Finance Center, PROD-01, or any other stage.

Do not create a new roadmap stage.

Do not modify Debt Register unless explicitly authorized in a separate task.
