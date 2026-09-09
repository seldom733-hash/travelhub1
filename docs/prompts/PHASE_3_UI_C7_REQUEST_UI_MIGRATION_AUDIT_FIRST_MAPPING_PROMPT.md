# PHASE 3 — UI-C7 — REQUEST UI MIGRATION
## AUDIT-FIRST MAPPING / NO IMPLEMENTATION

### PURPOSE
Perform an audit-first mapping of **UI-C7 — Request UI Migration** after the proven closure of UI-C6 and SEC-UI-01.

Current baseline:
`76c69e94491bc96c3f6366c9178ceca34db435b1`

Current canonical state:
- UI-C6 = ACCEPTED / CLOSED
- SEC-UI-01 = CLOSED
- UI-C7 = TRUE NEXT / NOT STARTED
- D8 = NOT STARTED
- Finance Center = NOT STARTED / DEFERRED
- PROD-01 = OPEN / DEFERRED

**Do not implement UI-C7.**

### GOVERNING QUESTION
Determine exactly what UI-C7 must change to migrate Request Detail into the canonical Commerce UI system, while preserving all existing business, security, API and lifecycle behavior.

Distinguish:
`UI presentation migration ≠ lifecycle redesign ≠ server-authority remediation ≠ new domain model ≠ new permissions`.

### AUTHORITY ORDER
1. Current source tree
2. Current tests/security
3. Current API/DTO/schema
4. Accepted Commerce Center architecture
5. Accepted UI-C2/C3/C4/C5/C6 implementations/reports
6. Debt Register
7. Roadmap/governance
8. Historical prompts/reports
9. Agent assumptions

If sources conflict, identify and resolve using this order.

## 1. GIT BASELINE
Verify:
```bash
git rev-parse HEAD
git rev-parse origin/master
git status --short --untracked-files=all
git diff HEAD origin/master
git diff --check
```
Do not delete or commit historical PHASE_3 prompt artifacts. Do not modify `.gitignore`.

## 2. REQUEST DETAIL CURRENT STATE
Inspect:
`frontend/app/app/requests/[id]/page.tsx`

Map and classify every significant surface:
- shell/header/breadcrumbs
- entity identity/status
- primary/secondary actions
- request/customer/partner/product/service/pricing information
- payment-related content
- relations
- timeline
- operational notes
- audit history
- loading/error/empty states
- responsive/a11y/i18n

Classification:
`CANONICAL / PARTIALLY CANONICAL / LEGACY / MISSING / UNKNOWN`

Cite evidence.

## 3. CANONICAL COMMERCE DETAIL RECONCILIATION
Compare Request Detail with the accepted canonical structure:
```text
Header
Breadcrumbs
Entity ID / Title
Status / Payment badges
Entity type
Primary actions
MAIN ENTITY CONTENT
Entity-specific cards
Finance (where applicable)
COMMERCE RELATION CHAIN
Request → Order → Booking
NOTES / COMMENTS
AUDIT HISTORY
```

Preserve:
`EntityTimeline ≠ OperationalNotes ≠ EntityAuditHistory`.

Identify which shared components are already used and which are missing. Do not replace working canonical components unnecessarily.

## 4. REQUEST ACTION AUDIT
Audit all seven existing server-authoritative actions:
`confirmPrice, proposePrice, reject, unavailable, customerAccept, customerDecline, convert`.

For each determine:
- render location;
- whether `availableActions` is consumed;
- whether local status/action matrices remain;
- action primitives;
- localization;
- destructive confirmation;
- loading/error behavior;
- ordering/semantics;
- whether convert correctly represents transition to Order.

**Do not recreate UI-C6 server rules.**
Existing typed contract:
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
Existing permission:
`order.edit_noncritical`.
Do not invent permissions.

## 5. RELATION CHAIN
Audit Request → Order → Booking integration:
- current-node semantics;
- linked Order/Booking;
- NOT_CREATED/future representation;
- shared relation component;
- navigation;
- authorization of destinations.

Do not create new relation resolution. Having Request access does not automatically grant Order/Booking access.

## 6. TIMELINE / NOTES / AUDIT
Verify canonical integration and placement for:
- EntityTimeline;
- OperationalNotes (`entityType="Request"`);
- EntityAuditHistory.

Preserve their separation and existing permissions.

## 7. HEADER / STATUS / FINANCE
Audit title, ID, status, badges, breadcrumbs, entity type and action placement.
Do not invent Request payment semantics or turn Payments into Finance Center content.

## 8. LEGACY UI INVENTORY
Find actual legacy patterns, including (if present):
`TONES`, `btn`, inline action groups, local lifecycle matrices, ad-hoc cards/headers/layouts, duplicate relation/notes/timeline/audit blocks.

Produce:
| Legacy surface | Location | Canonical replacement | Required? | Risk |
|---|---|---|---|---|

Do not call something legacy without evidence.

## 9. CROSS-DETAIL CONSISTENCY
Compare Request Detail with Order and Booking Detail:
shell, header, breadcrumbs, actions, cards, relations, timeline, notes, audit, loading/error, a11y, responsive, i18n.

Remember:
`UNIFIED STRUCTURE ≠ IDENTICAL BUSINESS CONTENT`.

## 10. API / DTO COMPATIBILITY
Verify existing Request Detail API/DTO provides everything required:
- availableActions;
- status;
- relation data;
- timeline;
- notes;
- audit;
- permissions/security behavior.

If backend enrichment is genuinely necessary, prove it and define the minimum additive change. Do not implement it or invent endpoints.

## 11. SECURITY / RBAC
Verify read permission, action permission, server authority, direct URL, relation navigation, and applicable tenant/workspace scope.

No client-only security assumptions.
Do not invent a new permission or tenant model.

## 12. TEST INVENTORY
Find Request-related unit/integration/e2e/frontend/security/browser tests.
Identify existing coverage and missing C7 acceptance coverage. Do not write tests.

At minimum assess:
canonical shell, availableActions consumption, absence of local lifecycle derivation, relation chain, timeline, notes, audit, RBAC, direct URL, i18n, a11y, responsive behavior, regression.

## 13. DEBT / ROADMAP COMPATIBILITY
Check whether any OPEN debt explicitly blocks UI-C7.
Preserve:
- SEC-UI-01 = CLOSED
- PROD-01 = OPEN/DEFERRED
- Finance Center = NOT STARTED/DEFERRED
- D8 = NOT STARTED
Do not modify Debt Register or roadmap. Record documentation drift separately if found.

## 14. MINIMAL IMPLEMENTATION SCOPE
Separate:
### MUST CHANGE
Required for complete UI-C7.
### SHOULD CHANGE
Clearly in-scope canonical consistency improvements.
### MUST NOT CHANGE
Business rules, lifecycle/status enum, server action rules, permissions, schema/API unless proven unavoidable, Order/Booking contracts, Finance Center, PROD-01, D8, unrelated debts.

For each proposed change:
`Current state / Target state / Reason / Evidence / Risk`.

## 15. RISK ANALYSIS
Assess accidental lifecycle/permission changes, duplicated authority, relation leakage, visual/regression risks, loss of Request-specific content, timeline/notes/audit issues, i18n/a11y/responsive regressions.

## 16. REQUIRED IMPLEMENTATION MATRIX
Produce:
| Surface | Current state | Canonical target | Change required | Shared component | Backend change | Test required |
|---|---|---|---|---|---|---|

## 17. FILE-LEVEL CHANGE MAP
Produce only evidence-based expected files:
`File / Current responsibility / Expected C7 change / Why / Risk`.
Separate frontend, possible backend, tests, report. No speculative files.

## 18. FUTURE ACCEPTANCE CONTRACT
Define objective future acceptance criteria:
- canonical shell;
- Request-specific information preserved;
- canonical relation chain/timeline/notes/audit;
- all seven actions consume availableActions;
- no local lifecycle action matrix;
- server-side read/action authorization;
- direct URL and relation links cannot bypass authorization;
- no new permissions;
- responsive/a11y/RU-AZ-EN;
- Order/Booking unaffected;
- API and UI-C6 contract unchanged;
- targeted/full regression, TSC/build, browser console;
- final Git synchronization.

## 19. STRICT PROHIBITIONS
Do NOT:
- implement UI-C7;
- modify production code/tests/schema/API/RBAC;
- modify Debt Register/roadmap/prompts;
- create an implementation prompt;
- start D8/Finance/PROD-01;
- reopen C6/SEC-UI-01;
- redesign Request lifecycle;
- invent statuses/permissions;
- alter Order/Booking contracts without proof.

Allowed change only:
`docs/reports/PHASE_3_UI_C7_REQUEST_UI_MIGRATION_AUDIT_FIRST_MAPPING_REPORT.md`

## 20. REQUIRED REPORT
Create exactly:
`docs/reports/PHASE_3_UI_C7_REQUEST_UI_MIGRATION_AUDIT_FIRST_MAPPING_REPORT.md`

Sections:
1. Executive Summary
2. Current Canonical State
3. Request Detail Current-State Mapping
4. Canonical Commerce Shell Reconciliation
5. Request Action Surface Audit
6. Commerce Relation Chain Audit
7. Timeline / Notes / Audit Audit
8. Header / Status / Finance Audit
9. Legacy UI Inventory
10. Cross-Detail Consistency
11. API / DTO Compatibility
12. Security / RBAC Audit
13. Test Inventory
14. Debt / Roadmap Compatibility
15. Minimal Implementation Scope
16. Implementation Risk Analysis
17. UI-C7 Implementation Matrix
18. File-Level Change Map
19. Future Acceptance Contract
20. Git State
21. Scope Compliance
22. Final Verdict

Every material conclusion must cite repository evidence.

## 21. FINAL VERDICT
### VERDICT A — AUDIT READY
Only if the current Request UI, canonical target, exact implementation boundary and dependencies are sufficiently understood, with no blocking ambiguity.

State:
```text
UI-C7 = AUDIT READY
Implementation scope = DEFINED
Blocking ambiguity = NONE
```

### VERDICT B — AUDIT BLOCKED
If architecture/API/security/dependency ambiguity prevents safe implementation planning. State the exact blocker.

## 22. STOP
After the audit report:
**STOP.**
Do not implement UI-C7 and do not create its implementation prompt.
