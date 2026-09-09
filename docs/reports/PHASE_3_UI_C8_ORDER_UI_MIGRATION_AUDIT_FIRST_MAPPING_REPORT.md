# PHASE 3 — UI-C8 — ORDER UI MIGRATION — AUDIT-FIRST MAPPING

## 1. Executive Summary

**VERDICT A — AUDIT READY.**

UI-C8 can proceed as a presentation-only Order Detail migration. The current
page already has the shared Commerce-detail shell and preserves server authority,
financial truth, relation/timeline/notes/audit separation, and Order-specific
business content. No missing API, schema, permission, tenant/workspace, or
governance prerequisite was found.

The factual legacy surface is deliberately narrow: `OrderActionBar` contains
hard-coded Russian action and confirmation text, and represents its busy state
with an unlabelled ellipsis. This conflicts with the accepted C7 i18n and
accessible-action presentation standard. It is a UI-C8 migration candidate, not
a security or lifecycle defect. Other differences from Request are legitimate
Order behavior and must be preserved.

## 2. Baseline and Repository State

- Expected baseline / `HEAD`: `ff3d2894b501be1abccfdf48cbbb23006ec93ac5`
- `origin/master`: `ff3d2894b501be1abccfdf48cbbb23006ec93ac5`
- Baseline lineage: matches the required UI-C8 audit lineage.
- `git diff --check`: PASS before adding this report.
- Pre-existing untracked prompt and report artifacts were present, including the
  independently requested TRUE-NEXT report. They were not modified or hidden.

This task performed static source and existing-evidence inspection only. No
production code, tests, API/DTO/schema, i18n dictionary, permissions, Debt
Register, roadmap, UI-C17, or UI-C18 was changed.

## 3. Canonical Governance State

- UI-C6 is accepted; the Debt Register records SEC-UI-01 as CLOSED.
- UI-C7 is accepted; its qualification report records the Request header-action
  migration while preserving UI-C6 server authority.
- The accepted canonical C-track sequence names UI-C8 as **Order UI migration**
  after UI-C7 and UI-C9 as Booking migration after UI-C8.
- UI-C17 remains the late final RBAC full-matrix qualification gate; UI-C18 is
  the final Git closure. Neither is part of this audit or UI-C8 implementation.

## 4. Authority Order

The audit used current source first, then current authorization and test
contracts, API/service/controller behavior, accepted reports, Debt Register,
and canonical roadmap. Historical prompts supplied task context only and did
not override current source.

## 5. Order Detail Architecture Audit

| Area | Classification | Current source evidence |
|---|---|---|
| Shell/layout | ALREADY CANONICAL | `orders/[id]/page.tsx` uses `EntityDetailShell`, `EntityDetailHeader`, `EntityDetailLayout`, and Main/Aside/Wide slots. |
| Header/breadcrumbs/status | ALREADY CANONICAL | Header provides TravelHub / Orders / reference, lifecycle and payment `StatusBadge`s, back link, and header actions. |
| Primary actions | LEGACY / MIGRATION CANDIDATE | `OrderActionBar` is server-fed but embeds Russian labels, destructive confirm text, and busy `…` directly. |
| Main content | LEGITIMATE BUSINESS DIFFERENCE | Overview, financial figures, items, and traveler collection are Order truth, not Request-parity gaps. |
| Aside | ALREADY CANONICAL | Dedicated lifecycle timeline and compact technical details use shared components. |
| Finance | ALREADY CANONICAL | Detail renders server values with shared `EntityFinanceCell` and localized money/status formatting. |
| Relations | ALREADY CANONICAL | `CommerceRelationChain` receives linked Request, current Order, and linked Booking. |
| Notes/audit | ALREADY CANONICAL | Shared `OperationalNotes` and `EntityAuditHistory` occupy their own Wide slots. |
| Loading/error/not-found | ALREADY CANONICAL | Centered localized loading and failure state with back-to-list link matches accepted C7 pattern. |
| Responsive | ALREADY CANONICAL, browser-qualify later | Shared layout and `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`; live breakpoint verification remains future work. |
| i18n/a11y | MIGRATION CANDIDATE | Page is largely localized; `OrderActionBar` has Russian literals and an unlabelled busy glyph. |

## 6. Request / Order / Booking Comparison

All three pages use the common Detail shell, header, layout slots, status
presentation, timeline, relation chain, notes, and audit primitives.

Request, accepted at UI-C7, uses a typed server action projection and a localized
`RequestActionBar`; its component contains no client status/permission matrix.
Order uses the same header placement and a server string-array projection through
`OrderActionBar`. Booking also uses server actions in the header but currently
maps buttons inline. Those implementation details do not authorize any action.

Order-specific items, traveler collection/final confirmation, payment/refund
history, and the granular Order lifecycle are legitimate business differences.
UI-C8 must not flatten them to imitate Request.

## 7. Order Action Authority Audit

- `OrderController.getOrder()` requires `order.read` and passes the authenticated
  actor and `actor.permissions` to `OrderService.getOrder()`.
- `OrderService.getOrder()` calls `computeAvailableOrderActions(order,
  grantedPermissions)` and returns the resulting `availableActions` array.
- The projection applies the Order transition map, Order domain gates, and
  `ACTION_PERMISSIONS`; `OrderActionBar` receives the ready-made array and does
  not inspect `order.status` or user permissions.
- `PATCH /orders/:id` validates a real `OrderAction` enum, derives its required
  permission from `ACTION_PERMISSIONS`, and invokes service-side transition
  validation. Direct calls therefore remain independently authorized.
- `backend/test/d5-order-fullpage-audit.e2e-spec.ts` proves a permitted actor
  receives actions and a read-only Analyst receives `[]`. The commerce-detail
  frontend spec asserts the page passes `order.availableActions ?? []` to the
  action component.

`OrderActionBar` is therefore already the right server-authoritative presentation
boundary. UI-C8 must retain it; it must not introduce local lifecycle or
permission calculations, new actions, permissions, or transition rules.

## 8. Order Finance Audit

The Order service is the financial authority. In `getOrder()` it uses Decimal
values and computes:

```text
due        = max(0, amount - paidAmount)
refundable = max(0, paidAmount - refundedAmount)
```

It returns string values for `dueAmount` and `refundableAmount`. The page only
formats server-provided `amount`, `paidAmount`, `refundedAmount`, `dueAmount`,
and `refundableAmount` with `formatPrice`; it does not recompute finance.
Payment/refund history is fetched from the existing Order financial-history API
and displayed separately. No finance-semantic defect or missing contract was
found. Formulas, payment truth, currency handling, and history semantics are
outside UI-C8 scope.

## 9. Relation / Timeline / Notes / Audit Audit

The four concepts remain explicitly separate:

- `CommerceRelationChain` represents Request → Order → Booking and marks Order
  as `current`; nullable linked entities preserve not-created/absent states.
- `EntityTimeline` renders Order lifecycle milestones, not audit events.
- `OperationalNotes` receives Order identity and current user context for its
  own Notes contract.
- `EntityAuditHistory` consumes the server history endpoint and Order-specific
  localized action/field renderers.

No conflation, client-synthesized relation state, or required redesign was found.
All are already canonical and must be preserved.

## 10. Loading / Error / Not-Found Audit

`loadOrder()` owns the detail request. While pending, the page renders a centered
localized loading state. API error or an absent Order renders a centered,
localized error/not-found state with `/app/orders` back navigation. Action errors
are surfaced in the header while the existing Order remains visible. This matches
the accepted C7 conceptual pattern. Direct URL and reload behavior need browser
qualification later, but no static legacy inconsistency was found.

## 11. Responsive / Accessibility / i18n Audit

Static inspection shows responsive-safe primitives: header actions use
`flex-wrap`, the finance section uses a 2/3/4-column responsive grid, the shared
layout owns page composition, and native buttons retain keyboard semantics.
Browser evidence at 375, 768, 1024, and 1280 pixels is not fabricated and is a
future qualification requirement.

The page uses locale-aware dates, prices, status badges, and existing i18n keys.
The concrete exception is `OrderActionBar`: its ten action labels and two
destructive confirmation messages are Russian literals, while an active action
renders only `…`. UI-C8 should localize these presentation strings using the
project's existing action-label vocabulary where semantically suitable, add any
necessary UI-label keys only as a direct C8 consequence, and make busy feedback
readable to assistive technology. It must preserve native confirmation behavior
unless a separately accepted design decision changes it.

## 12. Security / RBAC Audit

`order.read` protects detail, history, financial history, and traveler reads.
Each lifecycle mutation uses the existing granular action permission; trusted
server code applies state-transition validation. The Order service rejects
partner-storefront records through platform Marketplace read and command paths
with not-found behavior, including direct-UUID access, which protects scope
enumeration. The UI's action list is a server projection and cannot replace
these guards.

No security or tenant/workspace prerequisite blocks UI-C8. Later qualification
must prove the existing behavior for authorized, read-only, unauthorized, and
out-of-scope contexts without altering it.

## 13. API / DTO / Schema Audit

The existing `GET /orders/:id` response already supplies the required Order
detail contract: entity fields, financial values, `availableActions`, linked
Request/Booking, and traveler context. Existing history and financial-history
endpoints provide the remaining presentation data. No DTO, controller, service,
schema, permission, or migration change is required by the factual UI-C8 scope.

## 14. Legacy Inventory

| Item | Current state | Classification | Evidence | UI-C8 action |
|---|---|---|---|---|
| Actions | Server-fed header bar | MUST | `OrderActionBar` has literals/busy glyph; no client authority | Localize action/confirm/busy presentation and preserve server input/paths. |
| Shell/header/breadcrumbs | Shared canonical primitives | ALREADY CANONICAL | Order, Request, Booking share composition | Preserve. |
| Loading/error/not-found | Centered localized pattern | ALREADY CANONICAL | Order page branches | Preserve; browser-qualify. |
| Field rows | Shared entity primitives | ALREADY CANONICAL | `EntityField`, `EntityRow`, grid | Preserve. |
| Finance | Server truth and shared cells | ALREADY CANONICAL | Decimal service calculation; no client formula | Preserve; regression-test truth. |
| Timeline | Separate shared lifecycle view | ALREADY CANONICAL | `EntityTimeline` milestones | Preserve. |
| Relation chain | Shared authoritative DTO-driven chain | ALREADY CANONICAL | `CommerceRelationChain` | Preserve. |
| Notes | Shared Order-scoped component | ALREADY CANONICAL | `OperationalNotes` props | Preserve. |
| Audit | Shared server history component | ALREADY CANONICAL | `EntityAuditHistory` | Preserve. |
| i18n / busy a11y | Russian literals and `…` in action bar | MUST | `OrderActionBar` source | Localize and provide accessible busy feedback. |
| Responsive | Shared responsive classes | SHOULD | Static only | Verify four target widths; change only on observed defect. |

## 15. Cross-Registry Regression Boundary

UI-C8 applies only to Order Detail and directly necessary Order action
presentation. It must not change Request Detail, Booking Detail, Requests/
Orders/Bookings registries, Payments, Finance Center, D8, or PROD-01. Any
regression discovered there is evidence to investigate, not authorization to
expand the implementation scope.

## 16. Debt Register / Roadmap Audit

No accepted decision supersedes UI-C8. SEC-UI-01 remains closed, Finance Center
is deferred, and PROD-01 remains deferred/open pending its product-model
resolution. The canonical C-track phasing explicitly names UI-C8 after UI-C7;
UI-C17 and UI-C18 remain late-stage gates. No open debt blocks this presentation
migration.

## 17. UI-C8 Implementation Boundary

### 17.1 MUST

1. In `frontend/components/order/OrderActionBar.tsx`, replace hard-coded action,
   confirmation, and busy text with localized, accessible presentation while
   preserving the existing action identifiers, server-fed `actions` input,
   endpoint wiring, native button semantics, and terminal-action confirmation.
   Acceptance: RU/AZ/EN labels; busy state is understandable to assistive tech;
   no local status/permission logic.
2. Update only focused Order-detail frontend tests needed to prove the action bar
   remains server-authoritative and that the new presentation is localized and
   accessible. Acceptance: existing D5 contract remains covered and no Request/
   Booking regression is introduced.

### 17.2 SHOULD

- Browser-qualify the existing Detail layout at 375/768/1024/1280 and address
  only demonstrated wrapping, overflow, focus, or long-reference defects.
- Compare visible header/action treatment with accepted C7 and make only
  evidence-backed low-risk parity adjustments.

### 17.3 MUST NOT

Do not change Order API/DTO/schema, role/permission model, server authority,
status enum or transitions, financial formulas/payment truth, relation/timeline/
notes/audit truth, Request or Booking implementation, Payments, Finance Center,
D8, PROD-01, Debt Register, roadmap, UI-C17, or UI-C18.

## 18. Future Qualification Contract

Later UI-C8 work must prove:

- static source: shared shell/header remains canonical; `OrderActionBar` derives
  visibility only from server `availableActions`; no local RBAC/status matrix;
  Order items/travelers/finance/relations/timeline/notes/audit remain intact;
  action labels, confirmation, and busy feedback are localized and accessible;
- tests: focused Order action presentation tests, current D5 action-projection
  e2e, Request/Booking detail regressions, TypeScript, and production build;
- browser/runtime: authorized actor, read-only actor, unauthorized actor,
  direct URL, reload, projection-to-UI consistency, direct action execution,
  console/network errors, and the 375/768/1024/1280 viewports;
- security: no UI change can allow an action absent from the server projection,
  and direct API guards continue to reject unauthorized or invalid transitions.

## 19. Evidence

- `frontend/app/app/orders/[id]/page.tsx`
- `frontend/components/order/OrderActionBar.tsx`
- `frontend/components/order/TravelerCollectionPanel.tsx`
- `frontend/app/app/requests/[id]/page.tsx`
- `frontend/app/app/bookings/[id]/page.tsx`
- `backend/src/modules/order/order.controller.ts`
- `backend/src/modules/order/order.service.ts`
- `backend/test/d5-order-fullpage-audit.e2e-spec.ts`
- `frontend/lib/commerce-detail-system.spec.tsx`
- `frontend/lib/i18n.tsx`
- `docs/reports/PHASE_3_UI_C7_REQUEST_UI_MIGRATION_QUALIFICATION_REPORT.md`
- `docs/reports/PHASE_3_COMMERCE_CENTER_HELP_BUSINESS_DICTIONARY_FINAL_MICRO_CLOSURE_REPORT.md`
- `docs/TRAVELHUB_DEBT_REGISTER.md`

## 20. Git Closure

- Baseline / HEAD: `ff3d2894b501be1abccfdf48cbbb23006ec93ac5`
- `origin/master`: `ff3d2894b501be1abccfdf48cbbb23006ec93ac5`
- `git diff --check`: PASS.
- Historical untracked artifacts remain visible and untouched.
- This report is the only new artifact from this audit; no commit or push was
  performed because independent review was requested before implementation.

## 21. Final Verdict

```text
VERDICT A — AUDIT READY

UI-C8 = Order UI Migration
PREREQUISITES = SATISFIED
BLOCKERS = NONE
IMPLEMENTATION SCOPE = Localize and make accessible the existing
server-authoritative OrderActionBar presentation; qualify the existing Order
Detail layout and preserve all Order contracts and business-specific content.
```

Stop: UI-C8 implementation, UI-C17, and UI-C18 were not started.
