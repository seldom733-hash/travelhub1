# PHASE 3 — UI-C9 — BOOKING UI MIGRATION — IMPLEMENTATION + QUALIFICATION

## 0. ROLE

You are implementing and qualifying the already-audited TravelHub Phase 3 stage:

> **UI-C9 — Booking UI Migration**

The Audit-First stage has been independently accepted:

```text
VERDICT A — AUDIT READY
UI-C9 = Booking UI Migration
Implementation scope = evidence-backed
Prerequisites = satisfied
Blockers = none
Backend prerequisite = NONE
```

Audit report:

```text
docs/reports/PHASE_3_UI_C9_BOOKING_UI_MIGRATION_AUDIT_FIRST_MAPPING_REPORT.md
```

Governance baseline:

```text
ff3d2894b501be1abccfdf48cbbb23006ec93ac5
```

This prompt authorizes **implementation + qualification of UI-C9 only**.

---

# 1. CRITICAL C8 BOUNDARY

UI-C8 has been functionally qualified, but its publication is pending.

The following files contain pre-existing uncommitted UI-C8 changes:

```text
frontend/components/order/OrderActionBar.tsx
frontend/lib/commerce-detail-system.spec.tsx
frontend/lib/i18n.tsx
```

These changes MUST NOT be discarded, reset, or mixed into a UI-C9 implementation commit.

Before implementation, record the working-tree state. Do not run destructive cleanup.

---

# 2. CORE UI-C9 SCOPE

UI-C9 is a **presentation parity migration**, not a Booking domain/security redesign.

The Booking Detail page is already structurally canonical.

### MUST

1. Extract Booking action presentation into:

```text
frontend/components/booking/BookingActionBar.tsx
```

2. Relocate action-execution errors from the full-page centered error state to an inline header error banner, while keeping initial load/not-found errors centered.

3. Replace the literal busy `"…"` with a localized accessible busy state.

### SHOULD

4. Remove the six dead RU fallback literals identified by the audit.

5. Replace page-level `as any` casts for `financialSummary` / `activePayment` with narrow frontend types, with no runtime/business change.

6. Optional localized confirmation for terminal `cancel`, ONLY if it is entirely presentation-layer, fully localized RU/AZ/EN, and clearly justified. If uncertain, SKIP it.

Do not turn SHOULD items into mandatory scope if they introduce risk.

---

# 3. BASELINE CHECK

Before changes:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status --porcelain=v1
git diff --check
```

Expected governance baseline:

```text
HEAD == origin/master == ff3d2894b501be1abccfdf48cbbb23006ec93ac5
```

The working tree may contain the known C8 publication set and historical/untracked artifacts.

Do not use destructive commands such as:

```text
git reset --hard
git clean -fd
git checkout -- <C8 files>
```

Do not silently stash or discard C8 changes.

---

# 4. BOOKING DETAIL IMPLEMENTATION

Target:

```text
frontend/app/app/bookings/[id]/page.tsx
```

MUST:

- remove inline Booking action JSX;
- render `BookingActionBar` through the existing header `actions` slot;
- preserve `(booking.availableActions ?? [])`;
- preserve `executeAction`;
- preserve `PATCH /bookings/:id`;
- preserve `{ action }` payload;
- preserve all action identifiers and ordering;
- preserve busy mutual exclusion;
- preserve success/error behavior except relocation of action errors;
- keep load/not-found errors centered.

MUST NOT:

- introduce status/action matrices;
- inspect permissions for action visibility;
- alter Booking lifecycle;
- alter action endpoints/payloads;
- alter backend contracts.

---

# 5. BOOKING ACTION BAR CONTRACT

Create:

```text
frontend/components/booking/BookingActionBar.tsx
```

Presentation-only component.

Preferred contract:

```ts
type BookingActionBarProps = {
  actions: string[];
  onRun: (action: string) => void;
  busyAction: string | null;
};
```

Use actual existing types if appropriate, but do not create a cross-domain action abstraction.

Visibility MUST come exclusively from:

```text
actions
```

which comes from:

```text
booking.availableActions
```

No:

```text
booking.status
useCan(...)
role checks
permission checks
lifecycle matrix
business gates
```

---

# 6. ALL 13 CANONICAL ACTIONS

Preserve exactly:

```text
prepare
send
requestClarification
resume
confirm
reject
service
requestChange
resolveChange
requestCancellation
complete
cancel
problem
```

Do not add, remove, rename, merge, or change business semantics.

The component only maps identifiers to presentation.

---

# 7. ACTION EXECUTION

Preserve the existing:

```text
PATCH /bookings/:id
body = { action }
```

`BookingActionBar` calls:

```text
onRun(action)
```

The page remains responsible for execution.

Do not move business logic into the component.

---

# 8. BUSY STATE / ACCESSIBILITY

Match the accepted post-C8 OrderActionBar pattern without introducing a new cross-domain abstraction.

Required:

- localized busy label;
- `aria-busy` on the active button;
- meaningful accessible name;
- native `<button>`;
- existing disabled behavior;
- no bare `"…"` as the only busy feedback;
- keyboard accessibility;
- visible focus.

If required, add only:

```text
booking.action.busy
```

for RU/AZ/EN.

Do not alter unrelated dictionaries.

---

# 9. I18N

The audit confirmed all 13:

```text
booking.action_short.*
```

keys already exist in RU/AZ/EN.

Reuse these stable keys.

The six legacy fallback literals SHOULD be removed:

```text
"Услуга"
"Статус оплаты"
"Пассажиры"
"Хронология"
"Детали"
"—"
```

Use authoritative existing keys directly.

Do not create fake fallback translations.

### Future-language rule

Every new Booking string must use a stable i18n key:

```text
stable key
   ↓
RU / AZ / EN
   ↓
component usage
```

This must remain traceable for a future fourth language.

Do not redesign the i18n system.

---

# 10. ACTION ERROR UX

Current:

```text
executeAction()
    ↓
setError(...)
    ↓
whole page centered error
```

Required:

```text
load error / not-found
    → centered page state

action execution error
    → inline header error banner
```

Preserve the existing localized error content.

Do not change backend error semantics, swallow errors, invent categories, or alter retry behavior.

---

# 11. FINANCE TYPING — SHOULD

If safe, replace page-level `as any` around:

```text
financialSummary
activePayment
```

with narrow frontend types.

Requirements:

- no runtime change;
- no finance calculation;
- no DTO/API/schema change;
- no D7 formula change.

If this requires broad refactoring, SKIP and document why.

---

# 12. CANCEL CONFIRMATION — OPTIONAL

Do not introduce confirmation merely for visual symmetry with Order.

Only implement if clearly presentation-only, localized RU/AZ/EN, and behavior-preserving.

Otherwise:

```text
SKIP — current Booking semantics intentionally preserved.
```

---

# 13. SERVER AUTHORITY — NON-NEGOTIABLE

Preserve:

```text
computeAvailableBookingActions(...)
        ↓
Booking DTO
        ↓
availableActions[]
        ↓
BookingActionBar
```

Backend authority includes:

```text
TRANSITIONS
ACTION_PERMISSIONS
PermissionsGuard
bookingAction transition validation
ORDER_TERMINAL_GUARD
CAS/version protection
Storefront 404 enumeration protection
forbidden-key validation
```

Do not modify any of these.

---

# 14. RELATION / TIMELINE / NOTES / AUDIT

Preserve:

```text
CommerceRelationChain
EntityTimeline
OperationalNotes
EntityAuditHistory
```

Do not merge, redesign, change relation cardinality, change linked entity resolution, or change notes/audit authorization.

---

# 15. BOOKING-SPECIFIC BUSINESS CONTENT

MUST remain:

```text
Passengers
Supplier confirmations
Acquisition source
Masked passport information
Booking milestone timeline
Service information
D7 financial summary
Active payment information
```

Do not remove legitimate Booking content for visual symmetry.

---

# 16. RESPONSIVE

Qualify:

```text
375
768
1024
1280
```

Verify:

- no horizontal overflow;
- labels not clipped;
- action wrapping usable;
- focus visible;
- header readable;
- no overlap with title/status.

Do not redesign the entire header.

---

# 17. TESTS

Add/update focused tests only.

## BookingActionBar

Prove:

1. all 13 supported identifiers can render;
2. visibility comes only from `actions`;
3. no status inspection;
4. no permission inspection;
5. empty actions omit the action area;
6. busy action has localized readable text;
7. busy action has `aria-busy`;
8. busy button preserves existing disabled behavior;
9. action invokes `onRun(action)`;
10. action ordering remains stable.

## Error banner

Prove:

- action execution error renders in header/banner;
- load error remains centered;
- existing error content is preserved.

## i18n

Verify RU/AZ/EN for:

- action labels;
- busy label;
- confirmation text if added.

Update the existing authority guard in `commerce-detail-system.spec.tsx` if the inline projection literal changes. The replacement must still prove server-projection-only consumption; do not weaken the guard.

---

# 18. REGRESSION SUITE

Run at minimum:

```text
frontend/lib/commerce-detail-system.spec.tsx
Booking-specific frontend tests
backend/test/d6-booking-fullpage.e2e-spec.ts
d6-booking-remediation
lifecycle/service-time/temporal/consumer specs
relevant RBAC/security tests
```

Also run shared relation/notes/audit regression where relevant.

Do not alter backend tests to hide failures.

---

# 19. TYPESCRIPT / BUILD

Run:

```bash
npx tsc --noEmit
npm run build
```

Both must pass.

If the known unrelated:

```text
i18n.spec formatPrice NBSP
```

failure remains, document it separately and do not misclassify it as C9.

---

# 20. BROWSER QUALIFICATION

## Authorized actor

Verify:

- Booking Detail loads;
- action bar appears in header;
- only server-projected actions render;
- localized labels;
- busy state;
- existing action execution behavior;
- action errors appear in inline header banner;
- load/not-found errors remain centered.

Execute one safe lifecycle action if a suitable controlled record exists; otherwise document projection-only verification.

## Read-only actor

Use an actor with `booking.read` but without mutation permissions.

Verify server projection is empty/effectively empty and:

```text
BookingActionBar = absent
```

or empty according to the component contract.

Do not rely on frontend permission checks.

## Storefront / out-of-scope

Verify protected Storefront Booking remains:

```text
404
```

using existing backend evidence and browser spot-check if possible.

## Direct URL / reload

Verify direct Booking URL, in-page reload, no hydration/runtime errors, and relation navigation.

## Console / Network

Expected:

```text
0 unexpected C9 console errors
0 unexpected C9 console warnings
no failed C9 requests
```

Expected React DevTools/HMR informational entries are not failures.

## Responsive

Verify 375/768/1024/1280.

---

# 21. ACCESSIBILITY

Verify:

- native buttons;
- accessible names;
- keyboard navigation;
- visible focus;
- busy state;
- `aria-busy`;
- disabled state;
- contrast;
- no unlabeled busy ellipsis;
- no clipped labels.

Use axe or existing project tooling where available.

Separate C9 findings from pre-existing page-wide findings.

---

# 22. SECURITY / RBAC

Confirm all existing Booking permissions remain unchanged:

```text
booking.read
booking.send_supplier
booking.confirm
booking.request_change
booking.cancel
```

and the full existing action mapping.

Confirm:

```text
server projection = UI visibility
```

for tested actors.

Confirm direct API remains independently protected.

Confirm no privilege escalation.

Confirm Storefront 404 semantics remain unchanged.

---

# 23. API / DTO / SCHEMA PROTECTION

Expected:

```text
Backend changes = 0
API changes = 0
DTO changes = 0
Schema changes = 0
Permissions changes = 0
```

If a backend change becomes necessary:

**STOP.**

Report the exact blocker instead of expanding C9.

---

# 24. EXPECTED CHANGE PROFILE

Expected:

```text
frontend/app/app/bookings/[id]/page.tsx
frontend/components/booking/BookingActionBar.tsx
frontend/lib/commerce-detail-system.spec.tsx
```

Possibly:

```text
frontend/lib/i18n.tsx
```

only for `booking.action.busy`.

Do not touch:

```text
backend/**
OrderActionBar
RequestActionBar
Request Detail
Order Detail
Booking backend
schema
Debt Register
roadmap
UI-C17
UI-C18
Finance Center
Payments
D8
PROD-01
```

---

# 25. C8 ISOLATION DURING GIT WORK

Before committing C9:

```bash
git diff -- frontend/components/order/OrderActionBar.tsx
git diff -- frontend/lib/commerce-detail-system.spec.tsx
git diff -- frontend/lib/i18n.tsx
```

Confirm these remain exactly the known C8 publication changes.

Do not include them in the C9 commit.

Do not revert them.

If a shared test file contains both C8 and C9 changes, preserve the C8 diff and isolate the C9 changes as cleanly as practical.

---

# 26. QUALIFICATION REPORT

Create:

```text
docs/reports/PHASE_3_UI_C9_BOOKING_UI_MIGRATION_QUALIFICATION_REPORT.md
```

Structure:

```text
# PHASE 3 — UI-C9 — BOOKING UI MIGRATION — QUALIFICATION REPORT

## 1. Executive Summary
## 2. Baseline
## 3. Implementation Changes
## 4. BookingActionBar Authority
## 5. Action Error UX
## 6. i18n Qualification
## 7. Accessibility Qualification
## 8. Finance / D7 Preservation
## 9. Relation / Timeline / Notes / Audit Preservation
## 10. Test Results
## 11. TypeScript / Build
## 12. Browser Qualification
## 13. Security / RBAC
## 14. Regression Boundary
## 15. MUST / SHOULD / MUST NOT Compliance
## 16. Known Baseline Failures
## 17. Evidence
## 18. Git Closure
## 19. Final Verdict
```

Explicitly record:

- exact changed files;
- tests;
- browser evidence;
- RU/AZ/EN;
- accessibility;
- security/RBAC;
- C8 isolation;
- cancel-confirmation decision;
- exact final SHA if committed;
- working-tree state.

---

# 27. GIT CLOSURE

At the end:

```bash
git status --porcelain=v1
git diff --check
git diff --stat
git diff -- frontend/components/order/OrderActionBar.tsx
git diff -- frontend/lib/commerce-detail-system.spec.tsx
git diff -- frontend/lib/i18n.tsx
git rev-parse HEAD
git rev-parse origin/master
```

The report MUST distinguish:

### C9 functional completion
Implementation and qualification pass.

### C9 publication
Whether C9 was committed/pushed.

### C8 publication set
Whether it remains pending and isolated.

### Historical untracked artifacts
Do not falsely claim the tree is clean if they remain.

Do not claim Git closure unless the actual repository state proves it.

---

# 28. FINAL VERDICT

Only:

## VERDICT A

```text
VERDICT A — UI-C9 ACCEPTED

IMPLEMENTATION = COMPLETE
QUALIFICATION = PASS
SERVER AUTHORITY = PRESERVED
I18N = PASS
ACCESSIBILITY = PASS
REGRESSION = PASS
SECURITY/RBAC = PASS
BUILD/TSC = PASS
C8 ISOLATION = PASS
GIT = <exact state>
```

or:

## VERDICT B

```text
VERDICT B — UI-C9 BLOCKED

BLOCKER = <exact evidence-backed blocker>
```

Do not force acceptance.

Known unrelated baseline failures may be documented without blocking acceptance only when evidence proves they predate and are unaffected by C9.

---

# 29. STOP RULE

After the qualification report is complete:

**STOP.**

Do not automatically start:

```text
UI-C15
UI-C16
UI-C17
UI-C18
D8
Finance Center
PROD-01
```

The next stage must be selected through a separate TRUE NEXT requalification after UI-C9 acceptance.

---

# 30. GOVERNING PRINCIPLE

UI-C9 is not a Booking redesign.

It is:

```text
existing canonical Booking Detail
        +
existing Booking-specific business content
        +
existing server-authoritative 13-action projection
        +
evidence-backed presentation parity
        +
stable i18n
        +
accessible action presentation
        =
UI-C9
```

Do not duplicate server authority.

Do not redesign Booking lifecycle.

Do not redesign finance.

Do not change API contracts.

Do not merge business concepts.

Do not sacrifice legitimate Booking-specific content for visual symmetry.

Implement only what the accepted Audit-First report proved is necessary.
