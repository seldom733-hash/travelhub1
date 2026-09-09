# PHASE 3 — UI-C9 — BOOKING UI MIGRATION — AUDIT-FIRST MAPPING REPORT

## 1. Executive Summary

Booking Detail is **already deeply canonical** — the same structural conclusion the
UI-C7 audit reached for Request Detail. The page composes the full accepted Commerce
Detail system: `EntityDetailShell → EntityDetailHeader (actions slot) →
EntityDetailLayout (Main / Aside / Wide ×3)` with `CommerceRelationChain` (UI-C2),
`EntityTimeline` (UI-C5 business milestones), `OperationalNotes` (UI-C5) and
`EntityAuditHistory` (UI-C4) all correctly separated in the Wide slots.

Booking actions are **fully server-authoritative** since D6: a typed 13-action
`BookingAction` enum is computed server-side (`computeAvailableBookingActions` =
state machine ∩ granted permissions), projected into the detail DTO as
`availableActions: string[]`, guarded per-action by `PermissionsGuard` on
`PATCH /bookings/:id`, and consumed by the page **without any local lifecycle or
permission matrix**.

The remaining UI-C9 implementation scope is **presentation parity polish**, not a
migration of structure. `MUST` scope is 3 items (component extraction with a11y/
i18n parity, error-banner relocation, `executing`-renderguard fix); `SHOULD` is 5
items (i18n fallback literals, propose-free a11y gaps). Backend prerequisite: **NONE**.

**Verdict: VERDICT A — AUDIT READY.**

## 2. Baseline / Governance

```bash
git rev-parse HEAD            → ff3d2894b501be1abccfdf48cbbb23006ec93ac5
git rev-parse origin/master   → ff3d2894b501be1abccfdf48cbbb23006ec93ac5
git status --porcelain=v1     → 3 tracked-modified files + untracked docs artifacts
git diff --check              → PASS
```

Governance lineage confirmed from repository evidence:

```text
UI-C6 — Request Server-Authority Remediation   = ACCEPTED / CLOSED  (report + browser evidence, 76c69e9)
UI-C7 — Request UI Migration                   = ACCEPTED / CLOSED  (dfd0558)
UI-C8 — Order UI Migration                     = ACCEPTED / FUNCTIONALLY QUALIFIED (report VERDICT A),
                                                 Git publication pending — see §2.1
UI-C9 — Booking UI Migration                   = TRUE NEXT / NOT STARTED
```

The canonical roadmap (§440–458 of the tracked micro-closure report) contains
`UI-C8 Order UI migration` / `UI-C9 Booking UI migration` … `UI-C17 Final RBAC
full-matrix re-qualification` / `UI-C18 Git hard closure`. UI-C17/UI-C18 remain
late-stage gates — not next.

### 2.1 Pre-existing working-tree state (NOT produced by this audit)

The working tree contains **3 tracked-modified files that pre-date this audit** —
the uncommitted UI-C8 publication set (OrderActionBar localization + busy-a11y
polish, its spec block, and the corresponding i18n keys, +66/−15):

```text
 M frontend/components/order/OrderActionBar.tsx      — hardcoded RU labels → order.action_short.*
                                                       i18n keys + ru/az/en, confirm keys, busy label,
                                                       aria-busy, disabled cursor
 M frontend/lib/commerce-detail-system.spec.tsx      — new OrderActionBar a11y/i18n test block (+34)
 M frontend/lib/i18n.tsx                             — 13 new keys (order.action_short.*,
                                                       order.action_confirm.{close,cancel}, order.action.busy)
```

This audit did **not** touch these files. They are the evidence for the prompt's
"UI-C8 Git publication pending" state and must be committed by the governing
UI-C8 publication step (or by explicit instruction) — not silently discarded and
not mixed into a UI-C9 implementation commit.

## 3. Booking Detail Current Architecture

Source: `frontend/app/app/bookings/[id]/page.tsx` (344 lines, tracked clean).

| Surface | Implementation | Evidence (page lines) | Classification |
|---|---|---|---|
| Shell | `EntityDetailShell` with `header` slot | L185–186 | CANONICAL |
| Breadcrumbs | `["TravelHub", t("bookings.title"), booking.referenceNumber]` | L189 | CANONICAL (no hardcoded fallback) |
| Entity ID / title | `reference` + `secondary={booking.code}` + `backHref="/app/bookings"` | L190–192 | CANONICAL |
| Status badge | `lifecycleStatus={<StatusBadge status={booking.status} />}` | L193 | CANONICAL (Booking has no payment-status badge — legitimate: D7 finance lives in the Order) |
| Actions | header `actions` slot, inline `availableActions.map(...)` | L195–209 | PARTIALLY CANONICAL (placement canonical; presentation ad-hoc — §5) |
| MAIN | Service card (order link, product link, service date, acquisition source) | L220–236 | CANONICAL |
| Finance | D7 `financialSummary` cells via `EntityFinanceCell` + `activePayment` row | L239–257 | CANONICAL |
| Passengers | `EntityRow` list with masked passport + completeness badge | L259–272 | CANONICAL Booking-specific |
| Supplier confirmations | `EntityRow` list | L274–284 | CANONICAL Booking-specific |
| Aside: Timeline | `buildMilestones` → `EntityTimeline` (created/requested/confirmed/completed/cancelled/rejected) | L91–99, L292 | CANONICAL |
| Aside: Details | code/created/updated/commerceSequence | L296–305 | CANONICAL |
| Wide: Relations | `CommerceRelationChain current="booking"` | L308–317 | CANONICAL (UI-C2) |
| Wide: Notes | `OperationalNotes entityType="Booking"` (user-gated) | L320–330 | CANONICAL (UI-C5) |
| Wide: Audit | `EntityAuditHistory items={history} actionLabel={bookingActionLabel}` | L333–340 | CANONICAL (UI-C4) |
| Loading | centered `crm.loading` | L152–154 | CANONICAL |
| Error / not-found | centered error + back-link | L156–163 | CANONICAL placement; §5 finding E1 on action-error UX |
| i18n | via `t()` + shared label lib | throughout | PARTIALLY CANONICAL (§12: 6 fallback literals) |
| Accessibility | native buttons; **no aria-busy, no accessible busy label** | L198–208 | GAP (§13) |
| Responsive | `flex-wrap` in header actions; Tailwind grids | L197, 240 | CANONICAL |

No local `btn()`, `TONES`, `InfoRow` alias, `canEdit`/`useCan`, or inline action
section remains in the Booking page (`grep` evidence: zero hits).

## 4. Canonical Shell Comparison

Booking already satisfies the accepted canonical structure from §5 of the prompt:

```text
EntityDetailShell
  ├── Breadcrumbs            ✓ (canonical i18n key, no fallback)
  ├── EntityDetailHeader     ✓ (reference/secondary/backHref/lifecycleStatus/actions)
  │     └── actions slot     ✓ (server projection consumed directly)
  ├── EntityDetailLayout
  │     ├── MAIN             ✓ (Service → Finance → Passengers → Supplier confirmations)
  │     └── ASIDE            ✓ (Timeline → Details)
  ├── entity-specific cards  ✓ (passengers, supplier confirmations)
  ├── Finance                ✓ (D7 financialSummary + activePayment)
  ├── CommerceRelationChain  ✓ (current="booking")
  ├── EntityTimeline         ✓ (milestones, explicitly commented "NOT audit history")
  ├── OperationalNotes       ✓ (entityType="Booking", user-gated)
  └── EntityAuditHistory     ✓ (immutable history, actionLabel=bookingActionLabel)
```

`UNIFIED STRUCTURE ≠ IDENTICAL BUSINESS CONTENT` is preserved by design:
Passengers/SupplierConfirmations/acquisition-source are legitimate Booking-specific
content that must not be removed for symmetry (§11 PRESERVE list).

## 5. Booking Action Inventory

All 13 canonical `BookingAction` values
(`backend/src/modules/booking/booking.service.ts` L12–26):

| Action | Server source | Permission | Status/business gate | DTO projection | UI consumption | Endpoint | Notes |
|---|---|---|---|---|---|---|---|
| prepare | `TRANSITIONS` L127 | `booking.send_supplier` | `from: [NEW]` | `availableActions[]` | header map | `PATCH /bookings/:id` | |
| send | L128 | `booking.send_supplier` | `from: [NEW, PREPARING_REQUEST]` | 〃 | 〃 | 〃 | sets `requestedAt` (first-only) |
| requestClarification | L129 | `booking.confirm` | `from: [SENT_TO_SUPPLIER, AWAITING_CONFIRMATION]` | 〃 | 〃 | 〃 | |
| resume | L130 | `booking.confirm` | `from: [NEEDS_CLARIFICATION]` | 〃 | 〃 | 〃 | sets `requestedAt` |
| confirm | L131 | `booking.confirm` | `from: [SENT_TO_SUPPLIER, AWAITING_CONFIRMATION]` | 〃 | 〃 | 〃 | sets `confirmedAt` |
| reject | L132 | `booking.confirm` | `from: [SENT_TO_SUPPLIER, AWAITING_CONFIRMATION]` | 〃 | 〃 | 〃 | sets `rejectedAt` |
| service | L133 | `booking.confirm` | `from: [CONFIRMED]` | 〃 | 〃 | 〃 | |
| requestChange | L134 | `booking.request_change` | `from: [CONFIRMED, IN_SERVICE]` | 〃 | 〃 | 〃 | |
| resolveChange | L135 | `booking.request_change` | `from: [CHANGE_REQUESTED]` | 〃 | 〃 | 〃 | |
| requestCancellation | L136 | `booking.cancel` | `from: [CONFIRMED, IN_SERVICE, CHANGE_REQUESTED, NEEDS_CLARIFICATION]` | 〃 | 〃 | 〃 | |
| complete | L137 | `booking.confirm` | `from: [IN_SERVICE]` | 〃 | 〃 | 〃 | sets `completedAt` |
| cancel | L138 | `booking.cancel` | `from: ACTIVE` | 〃 | 〃 | 〃 | valve under terminal Order |
| problem | L139 | `booking.confirm` | `from: ACTIVE\{PROBLEM}` | 〃 | 〃 | 〃 | self-transition excluded (2.9 §28) |

**Server authority chain (all verified in source):**

1. Projection: `computeAvailableBookingActions(booking, grantedPermissions)`
   (service L122–135) = `TRANSITIONS[action].from.includes(status)` **AND**
   `granted.includes(ACTION_PERMISSIONS[action])` — computed in `getBooking`
   (L427–431), exposed in DTO as `availableActions?: string[]`.
2. Enforcement: `@Patch("bookings/:id")` +
   `@RequirePermissions((req) => [ACTION_PERMISSIONS[req.body?.action] ?? "booking.confirm"])`
   (controller L217–218, `PermissionsGuard`) — per-action dynamic guard.
3. Lifecycle: `bookingAction` (service L439+) re-validates the transition,
   returns 404 for `PARTNER_STOREFRONT` bookings (enumeration protection),
   409 on invalid transition, 409 under terminal Order
   (`ORDER_TERMINAL_GUARD = [CANCELLED, CLOSED]`, non-cancel actions), CAS
   optimistic concurrency on `status+version` (409 on concurrent modify).
4. Forged fields: `assertNoForbiddenKeys(req.body, BOOKING_ACTION_FORBIDDEN_KEYS)`
   → explicit 422 (controller L227).

**Frontend consumption:** `(booking.availableActions ?? []).map(action => …)` —
visibility is determined **only** by the server projection; the page contains
**zero** status→action matrices and **zero** client permission checks for actions.
There is no local lifecycle derivation to remove.

**Presentation contract (current, pre-C9):** `ACTION_CSS` map (page L85–99) —
13 hardcoded Tailwind color pairs; busy state = `executing !== null` disabling all
buttons + literal `"…"` label (L201, L205).

## 6. Booking Status / Lifecycle

13 canonical statuses (Step 2.9 screen codes verbatim, service L33–45):
`NEW, PREPARING_REQUEST, SENT_TO_SUPPLIER, AWAITING_CONFIRMATION, CONFIRMED,
IN_SERVICE, COMPLETED, NEEDS_CLARIFICATION, SUPPLIER_REJECTED,
CHANGE_REQUESTED, CANCELLATION_REQUESTED, CANCELLED, PROBLEM`.

- Terminal: `SUPPLIER_REJECTED, COMPLETED, CANCELLED` (no reopen).
- `AWAITING_CONFIRMATION` is a reserve code without producer (legacy source).
- Operational marker states (`NEEDS_CLARIFICATION`, `CHANGE_REQUESTED`,
  `CANCELLATION_REQUESTED`) do not touch frozen money/acquisition fields.
- Cross-domain guard: lifecycle commands (except `cancel`) are rejected 409 when
  the parent Order is `CANCELLED`/`CLOSED` (READ-only cross-domain, ADR-0001).
- Events: single state-machine authority (HARD GATE) — controllers/consumers
  implement no independent transitions; compensation consumer reuses same
  guards/CAS.

Client-side lifecycle matrix: **none exists** in the Booking detail page. The only
status-derived presentation is `StatusBadge` rendering and the milestone timeline —
both presentation-only. Nothing to reclassify, nothing to fix.

## 7. Server Authority / RBAC

- Read: `GET /bookings/:id` → `@RequirePermissions("booking.read")` (controller L211–212).
- History: `GET /bookings/:id/history` → `booking.read`; the controller also runs
  `getBooking` first so history is 404-protected for out-of-scope bookings (L200–208).
- Mutations: per-action permission mapping (§5 table), dynamically resolved by
  `PermissionsGuard`.
- UI projection: `server authority → DTO availableActions → header actions slot` —
  preserved end-to-end. No client permission authority (the only `useCurrentUser`
  use is `user.permissions` for `OperationalNotes`, which is its accepted contract).
- No new permissions are required or invented by UI-C9.

## 8. API / DTO / Schema

`GET /bookings/:id` already returns everything the canonical UI consumes:
identity, status, milestones (timestamp fields), `availableActions`,
`financialSummary` (D7), `activePayment`, `passengers`, `supplierConfirmations`,
`linkedOrder`, `linkedRequest`, `orderReference`, `commerceSequence`.

**Backend prerequisite = NONE.** No DTO/schema/endpoint change is expected or
required. A minimal `BookingDetail` TS interface addition (`error` handling state
only) is frontend-internal.

## 9. Finance / D7 Compliance

D7 contract is computed **server-side** in `booking-query.service.ts` L98–101:

```text
due        = max(0, total − paid)          ✓ (dueAmount = max(0, totalAmt − paidAmt))
refundable = max(0, paid − refunded)       ✓ (refundableAmount = max(0, paidAmt − refundedAmt))
```

The frontend renders `financialSummary` cells verbatim via `EntityFinanceCell`
(total / paid / due / refunded / refundable / paymentStatus) + `activePayment`
method/status row. **No client finance calculation exists. No deviation from D7.**
Service date lives in Service, not Finance (correct placement comment in source).
Nothing to change; finance redesign is out of scope.

## 10. Commerce Relation Chain

`CommerceRelationChain current="booking"` receives `request=booking.linkedRequest`,
`order=booking.linkedOrder`, `booking=booking` (page L308–317).

Server-side resolution (`booking-query.service.ts` L75–95):
- `linkedOrder` = the Order by `booking.orderId` (canonical relation);
- `linkedRequest` = Request by `convertedOrderId = order.id`, `createdAt desc`;
- same tenancy/404 semantics as the Booking itself; no new endpoint.

Current-node semantics, NOT_CREATED representation and destination authorization
are the accepted UI-C2 contracts — unchanged. UI-C9 must not alter cardinality,
not add relations, and not merge the chain with Timeline/Audit.

## 11. Timeline / Operational Notes / Audit

All three Wide slots implement the required conceptual separation, in canonical
order Relations → Notes → Audit:

```text
EntityTimeline        = business milestones (created/requested/confirmed/completed/
                        cancelled/rejected) — source-commented "NOT audit history"
OperationalNotes      = operational comments (entityType="Booking", permissions
                        from useCurrentUser — accepted UI-C5 contract)
EntityAuditHistory    = immutable what/who/when (bookingHistory via
                        bookingActionLabel — accepted UI-C4 contract)
```

No merge, no duplication, no data movement required.

## 12. i18n Audit

- Action labels: **fully keyed** — all 13 `booking.action_short.*` keys exist in
  DICT (ru/az/en); audit labels via `bookingActionLabel` (`booking.action.*`).
  A future language reuses the same stable keys — traceable.
- **6 hardcoded RU fallback literals** remain in the page (exact evidence):
  `|| "Услуга"` (L218), `|| "Статус оплаты"` (L248), `|| "Пассажиры"` (L261),
  `|| "Хронология"` (L291), `|| "Детали"` (L295), `|| "—"` (L254).
  These are the same dead-fallback pattern removed from Requests in UI-C7 §6.2
  and contradict the H-stage rule that the key is the single authority.
- Busy label is a literal `"…"` (L205) — not localized, not accessible.
- No AZ/EN hardcoding found; no new keys are required beyond a busy label if
  parity with Order (`order.action.busy`) is adopted.

## 13. Accessibility Audit

Current state (evidence: page L198–208):

- Native `<button>` elements — keyboard reachable; visible focus (global styles).
- `disabled={executing !== null}` — correct mutual exclusion, but **no
  `aria-busy`**, and the busy feedback is a literal `"…"` — not announced to
  screen readers (OrderActionBar post-C8 pattern: `aria-busy={busy}` +
  localized `order.action.busy` label).
- Labels: buttons carry real localized names (`bookingActionShort`); headings
  via `EntitySectionCard`; form controls none on this page.
- No hover-only controls; no custom dialogs (confirm dialogs currently absent —
  see §11 of the prompt's decision space: preserve current semantics unless a
  canonical contract exists; none was found).

Gaps are all in the action presentation layer — exactly what MUST-1 fixes.

## 14. Legacy UI Inventory

| # | Legacy surface | Location | Canonical replacement | Required? | Risk |
|---|---|---|---|---|---|
| L1 | Inline actions JSX in page (13 `ACTION_CSS` color pairs, `"…"` busy, no a11y) | `bookings/[id]/page.tsx` L85–99, L195–209 | New `frontend/components/booking/BookingActionBar.tsx` (parity with post-C8 `OrderActionBar`: i18n keys, `aria-busy`, localized busy label, empty-projection omission) | MUST | Low — behavior-preserving extraction; server contract untouched |
| L2 | Action-error swaps the whole page for the centered error screen | page L143–150 (`executeAction` sets `setError`) vs Order header inline error banner (`orders/[id]/page.tsx` L229–231) | Relocate action errors to an inline header banner; keep load errors on the centered screen | MUST | Low — UX-only; no authority change |
| L3 | `"…"` literal busy label (i18n) | page L205 | localized busy key | MUST | Trivial |
| L4 | 6 RU fallback literals `t(...) \|\| "…"` | L218, 248, 254, 261, 291, 295 | use the i18n key directly | SHOULD | Trivial |
| L5 | No confirmation on terminal actions (`cancel`) | `executeAction` | optional parity with Order `order.action_confirm.cancel` — **not required**; Booking contract has no canonical confirm text | SHOULD | Low; note: Order added confirmation only for terminal close/cancel |
| L6 | Page-level `as any` casts on `financialSummary`/`activePayment` | L245–256 | typed narrow interfaces | SHOULD | Trivial; no runtime change |

**Not legacy (PRESERVE — legitimate business content):** passengers, supplier
confirmations, acquisition source, masked passport, milestone timeline shape,
`bookingActionShort` fallback-to-raw-action (deliberate safe fallback in shared
lib), Storefront 404 semantics, relation chain composition, notes gating.

**ALREADY CANONICAL (no work):** shell, header placement, badges, MAIN/ASIDE
composition, relation chain, timeline, notes, audit, loading/not-found screens,
D7 finance, breadcrumbs, responsive wrap.

## 15. Request / Order / Booking Comparison

| Capability | Request (post-C7) | Order (post-C8) | Booking (current) | C9 requirement |
|---|---|---|---|---|
| Shared shell | ✓ | ✓ | ✓ | preserve |
| Header + actions slot | ✓ | ✓ | ✓ | preserve |
| Action component | `RequestActionBar` | `OrderActionBar` | **inline in page** | MUST extract |
| Server authority | typed object | `string[]` | `string[]` | preserve as-is (§6: do not refactor for symmetry) |
| Local lifecycle matrix | none | none | none | preserve absence |
| Error surface for actions | — | header banner | **full-page swap** | MUST fix |
| Busy a11y (`aria-busy` + localized label) | ✓ | ✓ (post-C8 polish) | **missing** | MUST add |
| i18n fallback literals | removed | removed (C8 polish) | 6 remain | SHOULD remove |
| Loading/not-found | centered | centered | centered | preserve |
| Relation chain | ✓ | ✓ | ✓ | preserve |
| Timeline | ✓ | ✓ | ✓ | preserve |
| Notes | ✓ | ✓ | ✓ | preserve |
| Audit | ✓ | ✓ | ✓ | preserve |
| Finance | n/a (Request) | D7 direct | D7 via financialSummary | preserve |
| i18n ru/az/en | ✓ | ✓ | ✓ (literals aside) | verify |
| Responsive | ✓ | ✓ | ✓ | verify |
| RBAC | server projection | server projection | server projection | preserve |

## 16. Test Coverage / Gaps

Existing coverage (must remain untouched unless C9 regression requires):
- `frontend/lib/commerce-detail-system.spec.tsx` — Booking shell/audit/relation/
  action-authority guards, including "Booking action availability stays
  server-authoritative (availableActions from API)" asserting the literal
  `(booking.availableActions ?? [])` — **this literal will change with MUST-1 and
  the guard test must be updated to assert `BookingActionBar` consumption instead**
  (same treatment the C6 guard literal received in UI-C7).
- `commerce-relation-chain`, `commerce-notes`, `commerce-audit-history` specs —
  shared-component regression.
- Backend e2e: `d6-booking-fullpage.e2e-spec.ts` (9 tests: enriched DTO,
  availableActions state machine, Storefront 404, terminal-limit, 409, history),
  `d6-booking-remediation`, lifecycle/service-time/temporal/consumer specs.

C9 qualification must add: `BookingActionBar` render/authority tests (no status
inspection, no permission inspection, busy a11y, empty omission), error-banner
test, i18n key resolution, and targeted re-run of the above.

## 17. File-Level Migration Map

```text
frontend/app/app/bookings/[id]/page.tsx
    MUST:     replace inline actions JSX with <BookingActionBar> in the header
              actions slot; relocate action errors to inline header banner
              (load errors stay centered); remove literal "…" busy label
    SHOULD:   remove 6 RU fallback literals; type financialSummary/activePayment
    PRESERVE: everything else — shell, cards, milestones, D7 finance, relation
              chain, notes, audit, (availableActions ?? []) safe-default contract

frontend/components/booking/BookingActionBar.tsx        (new)
    MUST:     accept actions: string[] + onRun + busyAction; visibility only from
              the projection; i18n labels (booking.action_short.*); aria-busy +
              localized busy label; empty-projection omission; keyboard native

frontend/lib/commerce-detail-system.spec.tsx
    MUST:     update Booking action-authority guard literal to BookingActionBar;
              add BookingActionBar render/authority/a11y tests

frontend/lib/i18n.tsx
    SHOULD:   add booking.action.busy (ru/az/en) only if parity label adopted
              (mirror of order.action.busy); no other dictionary changes

backend/**          — NO CHANGES (verified §8)
```

No speculative files. If implementation needs anything beyond this map: STOP and
report before expanding scope.

## 18. Minimal Implementation Scope

```text
MUST
1. Extract header actions into frontend/components/booking/BookingActionBar.tsx
   (all 13 actions, projection-only visibility, i18n labels, aria-busy +
   localized busy label, empty omission, existing PATCH /bookings/:id {action}).
2. Relocate action-execution errors to an inline header banner; load/not-found
   errors remain on the centered screen (parity with Order detail).
3. Remove the literal "…" busy label (replaced by the localized busy label).

SHOULD
1. Remove the 6 dead RU fallback literals (L218/248/254/261/291/295).
2. Type financialSummary/activePayment (remove `as any`).
3. Optional localized confirm text for terminal `cancel` — only if implemented
   without touching backend; otherwise skip (no canonical Booking confirm text).

MUST NOT
1. No backend/API/DTO/schema change (§8: prerequisite NONE).
2. No change to TRANSITIONS, ACTION_PERMISSIONS, computeAvailableBookingActions,
   guards, CAS, ORDER_TERMINAL_GUARD, Storefront 404 semantics.
3. No new statuses, actions, or permissions.
4. No relation-chain, timeline, notes, or audit changes.
5. No finance/D7 redesign; no Payments/Finance Center content.
6. No Order/Request contract changes (incl. the uncommitted C8 publication set).
7. No Debt Register / roadmap / prompt modifications.
```

## 19. Future Qualification Contract

### Static
- No client lifecycle matrix; no client permission authority; projection-only
  visibility; no API/DTO/schema changes.
### Tests
- BookingActionBar unit/authority tests; commerce-detail-system regression
  (incl. updated guard); relation/notes/audit specs; backend d6 booking e2e;
  RBAC/security regression; TSC; production build; known baseline failure
  (`i18n.spec formatPrice NBSP`) documented separately if still present.
### Browser
- Authorized actor (e.g. ADMIN): actions render from server projection; one safe
  lifecycle action execution where state permits (or read-only verification).
- Read-only actor (booking.read without booking.confirm/send_supplier/
  request_change/cancel): `availableActions` server-projected empty/false-set →
  no action UI.
- Storefront booking: 404 (already e2e-covered; browser spot-check direct URL).
- Direct URL, reload, relation navigation, console (0 new C9 errors/warnings),
  network all-2xx; responsive 375/768/1024/1280 (header wrap, no overflow).
### i18n — RU/AZ/EN verified on all visible strings.
### Accessibility — keyboard, accessible names, busy semantics, visible focus.

## 20. Debt / Roadmap Boundary

Debt Register and roadmap inspected for blockers only; not modified.

- Debt Register (micro-closure report §352–375): UI-01…UI-09, SEC-UI-01 all
  closed-accepted; FIN-01..03, DATA-02, PROD-01, SEC-TENANT-01 — DEFERRED/
  LATER with no C9 blocking predicate. **No OPEN debt blocks UI-C9.**
- `PROD-01 = OPEN/DEFERRED` (dedicated register) — untouched, not a C9 blocker.
- Roadmap preserved: `UI-C9 Booking UI migration` is canonical next C-track
  implementation stage; `UI-C17 Final RBAC full-matrix re-qualification` and
  `UI-C18 Git hard closure` remain late-stage mandatory gates — not next.
- Payments remain: current capability + Finance ownership + Operations Center
  tab. Finance Center = NOT STARTED.

## 21. Risks

| Risk | Mitigation in scope |
|---|---|
| Guard-spec literal break (`(booking.availableActions ?? [])`) | Update the C7-style guard to assert BookingActionBar consumption — semantics preserved |
| Mixing C8 publication set into C9 commits | C8's 3 uncommitted files are documented here (§2.1) and must be published separately by its governing step |
| Action-error UX change confusing users | Banner text = existing localized error message; identical content, new placement |
| Accidental lifecycle/permission drift | All action logic stays in backend (untouched); frontend renders projection only |
| i18n key regression | Only additive busy key; fallback-literal removal verified by existing key-resolution tests |

## 22. Final Verdict

```text
VERDICT A — AUDIT READY

UI-C9 = Booking UI Migration
Implementation scope = evidence-backed (MUST 3 / SHOULD 3)
Prerequisites = satisfied (C6/C7 closed; C8 functionally qualified, publication pending)
Blockers = none (backend prerequisite NONE; no blocking debt)
```

Audit performed read-only: production source, tests, schema, API, DTO, RBAC,
Debt Register, roadmap and prompts untouched. The only created file is this
report. Baseline `ff3d2894b501be1abccfdf48cbbb23006ec93ac5` (HEAD == origin/master);
pre-existing uncommitted UI-C8 publication set documented in §2.1, not modified.
