# PHASE 3 — UI-C8 — ORDER UI MIGRATION — IMPLEMENTATION + QUALIFICATION

## 0. ROLE

You are implementing and qualifying the already-audited TravelHub Phase 3 stage:

> **UI-C8 — Order UI Migration**

The audit has been independently accepted:

```text
VERDICT A — AUDIT READY

UI-C8 = Order UI Migration
PREREQUISITES = SATISFIED
BLOCKERS = NONE
```

Audit report:

```text
docs/reports/PHASE_3_UI_C8_ORDER_UI_MIGRATION_AUDIT_FIRST_MAPPING_REPORT.md
```

Current baseline:

```text
ff3d2894b501be1abccfdf48cbbb23006ec93ac5
```

This prompt authorizes **implementation + qualification of UI-C8 only**.

Do not expand the scope.

---

# 1. CORE UI-C8 SCOPE

The audit established that the factual legacy surface is narrow.

Primary implementation target:

```text
frontend/components/order/OrderActionBar.tsx
```

Required migration:

- localize hard-coded action labels;
- localize destructive confirmation text;
- make busy feedback accessible;
- preserve the existing server-authoritative action contract;
- preserve all action identifiers;
- preserve endpoint wiring;
- preserve native button semantics;
- preserve existing confirmation behavior.

The rest of Order Detail is already canonical and must remain intact.

---

# 2. NON-NEGOTIABLE SERVER AUTHORITY

The existing contract is authoritative:

```text
OrderService
    ↓
computeAvailableOrderActions(order, grantedPermissions)
    ↓
Order DTO
    ↓
availableActions
    ↓
OrderActionBar
```

`OrderActionBar` MUST NOT derive action visibility from:

- `order.status`;
- user permissions;
- local lifecycle matrices;
- client-side business rules.

Do not add any such logic.

The backend independently validates:

- action enum;
- required granular permission;
- valid transition;
- business constraints.

Do not weaken or duplicate this authority.

---

# 3. IMPLEMENTATION BASELINE

Before modifying anything, verify:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status --short
git diff --check
```

Expected:

```text
HEAD == origin/master == ff3d2894b501be1abccfdf48cbbb23006ec93ac5
```

If this is not true, STOP and report the discrepancy.

Do not silently rebase, reset, stash, clean, or overwrite unrelated work.

---

# 4. FILE-LEVEL SCOPE

## MUST CHANGE

### `frontend/components/order/OrderActionBar.tsx`

Only change presentation/accessibility concerns necessary for UI-C8:

1. Replace hard-coded Russian action labels with existing i18n vocabulary where semantically correct.
2. Replace hard-coded destructive confirmation text with localized strings.
3. Replace the bare busy `…` representation with accessible busy feedback.
4. Preserve existing action ordering unless an actual accessibility/layout defect requires a change.
5. Preserve native `<button>` semantics.
6. Preserve existing disabled/busy behavior.
7. Preserve existing action callback wiring.

## MAY CHANGE

Focused tests directly covering the changed OrderActionBar behavior.

Possible:

```text
frontend/lib/commerce-detail-system.spec.tsx
```

and/or the most directly relevant Order frontend spec.

Do not modify unrelated tests.

## MUST NOT CHANGE

Unless a directly demonstrated test/compile requirement makes a minimal import adjustment unavoidable:

```text
backend/**
schema
API contracts
DTO shape
OrderService authority
OrderController authorization
permission definitions
role definitions
transition tables
Request Detail
Booking Detail
Orders registry
Requests registry
Bookings registry
Payments
Finance Center
D8
PROD-01
Debt Register
roadmap
UI-C17
UI-C18
```

Do not modify dictionaries broadly.

If a new i18n key is genuinely required, add only the minimal key(s) necessary for the OrderActionBar and preserve RU/AZ/EN completeness.

---

# 5. I18N REQUIREMENTS

The accepted C7 standard requires localized UI.

Audit the existing i18n vocabulary before adding keys.

For every visible OrderActionBar string:

```text
RU
AZ
EN
```

must resolve to a meaningful localized value.

No hard-coded Russian action/confirmation text may remain in the component.

Do not use literal fallback text that silently replaces missing translations.

If the project has an established action-label vocabulary, reuse it.

Do not rename unrelated i18n keys.

---

# 6. ACCESSIBILITY REQUIREMENTS

The action bar must remain keyboard accessible and semantically understandable.

Verify:

- native button semantics;
- visible labels;
- disabled/busy semantics;
- accessible name;
- accessible busy feedback;
- no unlabeled ellipsis as the only busy indicator;
- no loss of focusability;
- no inaccessible confirmation interaction.

Use the project's existing accessibility conventions where available.

Do not add unnecessary ARIA.

---

# 7. CONFIRMATION SEMANTICS

The audit explicitly requires preservation of existing terminal/destructive confirmation behavior.

Therefore:

- do not remove confirmation;
- do not introduce a modal/drawer;
- do not change which actions require confirmation;
- do not change confirmation timing;
- only localize the existing confirmation text.

Any proposed change to confirmation semantics is OUT OF SCOPE and must STOP for review.

---

# 8. ACTION CONTRACT PRESERVATION

The exact existing actions must remain unchanged.

Do not:

- rename action identifiers;
- add actions;
- remove actions;
- reorder business semantics;
- change request payloads;
- change endpoint paths;
- change callback signatures;
- alter success/error handling.

The component must continue consuming:

```text
availableActions
```

from the server projection.

---

# 9. TEST REQUIREMENTS

Update/add only focused tests necessary to prove the implementation.

At minimum establish:

### Server-authority regression

- `availableActions` is still passed to `OrderActionBar`;
- no client status matrix is introduced;
- no client permission matrix is introduced.

### I18n

Verify visible action presentation is localized appropriately.

### Accessibility

Verify:

- action buttons have meaningful accessible names;
- busy state is accessible;
- disabled/busy state does not expose an unlabeled `…` as the only feedback.

### Existing D5 contract

Do not weaken existing D5 Order action-projection coverage.

---

# 10. FULL REGRESSION

Run relevant existing tests.

At minimum:

```text
Order-focused tests
commerce-detail-system tests
D5 Order e2e
Request/Booking detail regression
```

Also run:

```text
TypeScript
Next.js production build
```

Do not modify tests merely to hide unrelated failures.

If an existing unrelated baseline failure occurs, document it precisely.

---

# 11. BROWSER QUALIFICATION

After implementation, perform live browser qualification where the environment permits.

Required evidence:

### Authorized actor

Verify:

- Order Detail loads;
- existing server-projected actions appear;
- localized labels render;
- confirmation text is localized;
- busy state is accessible;
- action behavior remains unchanged.

### Read-only actor

Verify:

- server projection remains authoritative;
- actions absent from `availableActions` are not rendered;
- no client-side workaround exposes them.

### Unauthorized / out-of-scope actor

Verify:

- direct URL/API remains protected by server authorization;
- no action is exposed through UI;
- no cross-tenant/workspace leakage occurs.

### Direct URL / reload

Verify:

- direct Order Detail URL;
- in-page reload;
- session remains valid where expected;
- no hydration/render error.

### Console / Network

Verify:

```text
0 unexpected console errors
0 unexpected console warnings
no failed requests caused by UI-C8
```

### Responsive

Verify:

```text
375
768
1024
1280
```

Look specifically for:

- action wrapping;
- overflow;
- clipped labels;
- focus visibility;
- finance/layout regressions.

Do not invent screenshots as evidence.

If screenshots are not durable project artifacts, record DOM/API/console/network evidence instead.

---

# 12. SECURITY QUALIFICATION

Confirm that UI-C8 did not alter:

```text
order.read
Order action permissions
server guards
availableActions projection
service transition validation
tenant/workspace isolation
```

The UI must never become the authorization authority.

For any action absent from the server projection:

```text
UI = hidden/disabled according to existing component behavior
API = still independently protected
```

---

# 13. SCOPE PROTECTION

The following must remain untouched functionally:

```text
Request UI-C7
Booking UI-C9
Payments
Finance Center
D8
PROD-01
UI-C17 Final RBAC
UI-C18 Git Closure
```

Do not “clean up” adjacent code merely because it is visible during implementation.

---

# 14. EXPECTED CHANGE PROFILE

The expected implementation should be small.

Primary production change:

```text
frontend/components/order/OrderActionBar.tsx
```

Potential focused test change:

```text
frontend/lib/commerce-detail-system.spec.tsx
```

Potential minimal i18n additions only if existing vocabulary cannot express the required UI.

If the implementation unexpectedly requires:

- backend changes;
- DTO changes;
- schema changes;
- permissions;
- role changes;
- transition changes;
- financial changes;

STOP and report the blocker rather than expanding UI-C8.

---

# 15. QUALIFICATION REPORT

Create:

```text
docs/reports/PHASE_3_UI_C8_ORDER_UI_MIGRATION_QUALIFICATION_REPORT.md
```

The report must include:

```text
# PHASE 3 — UI-C8 — ORDER UI MIGRATION — QUALIFICATION REPORT

## 1. Executive Summary
## 2. Baseline
## 3. Implementation Changes
## 4. Server Authority Preservation
## 5. i18n Qualification
## 6. Accessibility Qualification
## 7. Test Results
## 8. TypeScript / Build
## 9. Browser Qualification
## 10. Security / RBAC Qualification
## 11. Regression Boundary
## 12. MUST / SHOULD / MUST NOT Compliance
## 13. Known Baseline Failures
## 14. Evidence
## 15. Git Closure
## 16. Final Verdict
```

---

# 16. GIT CLOSURE

Before finalizing:

```bash
git status --short
git diff --check
git diff --stat
git rev-parse HEAD
git rev-parse origin/master
```

The report must clearly distinguish:

### Functional/source closure

Whether all intended UI-C8 changes are committed and pushed.

### Literal working-tree cleanliness

Whether historical/unrelated untracked artifacts remain.

Do not claim `git clean` if unrelated historical artifacts remain.

Expected final state:

```text
HEAD == origin/master
git diff --check PASS
UI-C8 implementation committed
qualification report committed
no unrelated source changes
```

Record exact final SHA.

---

# 17. FINAL VERDICT

Only two verdicts are allowed.

## VERDICT A

```text
VERDICT A — UI-C8 ACCEPTED

IMPLEMENTATION = COMPLETE
QUALIFICATION = PASS
SERVER AUTHORITY = PRESERVED
I18N = PASS
ACCESSIBILITY = PASS
REGRESSION = PASS
SECURITY/RBAC = PASS
BUILD/TSC = PASS
GIT = CLOSED
```

A known unrelated baseline failure may be documented without blocking acceptance only if:

- it predates UI-C8;
- it is outside the changed surface;
- it is not caused or affected by UI-C8;
- evidence proves it is unrelated.

## VERDICT B

```text
VERDICT B — UI-C8 BLOCKED

BLOCKER = <exact evidence-backed blocker>
```

Do not force acceptance.

---

# 18. IMPORTANT STOP RULE

After implementation and qualification report are complete:

**STOP.**

Do not automatically begin:

```text
UI-C9
UI-C15
UI-C16
UI-C17
UI-C18
D8
Finance Center
PROD-01
```

The next TRUE NEXT must be determined separately after UI-C8 acceptance.

---

# 19. CORE PRINCIPLE

UI-C8 is a **presentation migration**, not an authorization rewrite.

The desired outcome is:

```text
existing Order business truth
        +
existing server authority
        +
existing canonical Commerce Detail
        +
localized accessible OrderActionBar
        =
UI-C8 accepted
```

Do not make Order “look like Request” by removing legitimate Order behavior.

Preserve the business model.

Preserve the security model.

Change only what the audit proved is necessary.
