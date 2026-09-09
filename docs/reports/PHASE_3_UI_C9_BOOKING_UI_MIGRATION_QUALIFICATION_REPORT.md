# PHASE 3 — UI-C9 — BOOKING UI MIGRATION — QUALIFICATION REPORT

## 1. Executive Summary

UI-C9 implemented the evidence-backed presentation-parity scope from the accepted
Audit-First report (`PHASE_3_UI_C9_BOOKING_UI_MIGRATION_AUDIT_FIRST_MAPPING_REPORT.md`):

- **MUST-1** — Booking actions extracted from the page into
  `frontend/components/booking/BookingActionBar.tsx` (13 canonical actions,
  projection-only visibility, i18n labels, `aria-busy`, localized busy label,
  empty-projection omission), rendered through the existing header `actions` slot;
- **MUST-2** — action-execution errors relocated from the full-page centered error
  state to an inline header error banner (load/not-found errors remain centered);
- **MUST-3** — literal `"…"` busy replaced by the localized accessible busy state;
- **SHOULD-4** — all six dead RU fallback literals removed;
- **SHOULD-5** — `as any` casts on `financialSummary`/`activePayment` replaced with
  narrow frontend view types (presentation-only);
- **SHOULD-6 (cancel confirmation)** — **SKIPPED** per audit recommendation: no
  canonical Booking confirmation contract exists; §12 of the implementation prompt
  forbids adding it for symmetry alone.

Backend changes = **0**. Server authority chain untouched end-to-end. All
qualification gates PASS; known pre-existing baseline failures documented in §16.

```text
VERDICT A — UI-C9 ACCEPTED
```

## 2. Baseline

```text
git rev-parse HEAD            → ff3d2894b501be1abccfdf48cbbb23006ec93ac5
git rev-parse origin/master   → ff3d2894b501be1abccfdf48cbbb23006ec93ac5 (equal)
git diff --check              → PASS
Pre-existing working tree     → C8 publication set (OrderActionBar.tsx,
                                commerce-detail-system.spec.tsx, i18n.tsx — +66/−15)
                                recorded, preserved, never reset/stashed/discarded
```

Runtime: fresh dev backend :4000 (`ts-node src/main.ts`, PID 15320, DB travelhub1),
frontend dev :3000 (PID 16752, HMR), browser automation.

## 3. Implementation Changes

| File | Change |
|---|---|
| `frontend/components/booking/BookingActionBar.tsx` | **NEW** — presentation-only action bar: `actions: string[]` + `onRun` + `busyAction`; 13-action `ACTION_UI` map (page's original colors carried verbatim); `booking.action_short.*` labels; `aria-busy={busy}`; localized `booking.action.busy`; `disabled` mutual exclusion; `return null` on empty projection; no status/permission/lifecycle logic |
| `frontend/app/app/bookings/[id]/page.tsx` | inline 13-button JSX + `ACTION_CSS` map + `"…"` removed → `<BookingActionBar actions={booking.availableActions ?? []} onRun={a => void executeAction(a)} busyAction={executing} />` in header slot; `executeAction` writes `actionError` (new state) rendered as inline header banner (`{actionError && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 …">{actionError}</div>}` inside `EntityDetailHeader` children); load/not-found centered state unchanged; 6 fallback literals removed (`bookings.service`, `crm.detail.payment_status` ×1, `bookings.passengers`, `detail.sections.timeline`, `detail.sections.details`, `paymentMethod \|\| "—"` → `?? "—"` — key-driven now); `FinancialSummaryView`/`ActivePaymentView` narrow interfaces replace `as any` casts; `bookingActionShort` import removed (labels now live in the component); `PATCH /bookings/:id` + `{ action }` payload + `executeAction` semantics preserved verbatim |
| `frontend/lib/i18n.tsx` | +1 key `booking.action.busy` (ru/az/en) — **C9-only addition appended in the booking section; C8 hunks untouched** |
| `frontend/lib/commerce-detail-system.spec.tsx` | guard literal updated (`(booking.availableActions ?? [])` → `actions={booking.availableActions ?? []}` + `<BookingActionBar`); "hides action area" guard now asserts component-contract omission (`if (actions.length === 0)` / `return null`); **+3 new tests** (§10); C8 OrderActionBar test block untouched |

## 4. BookingActionBar Authority

Source-audited (spec test + manual verification):

- visibility **only** from the `actions` prop ← `booking.availableActions ?? []`
  (server projection; safe-default contract preserved);
- no `booking.status`, no `useCan`, no role/permission checks, no lifecycle matrix
  in the component (spec-asserted + grep-verified);
- page still owns execution: `executeAction` → `api.patch(\`/bookings/${booking.id}\`, { action })`
  → `loadBooking()` — unchanged from pre-C9;
- all 13 canonical identifiers render in projection order (spec: ordered map over
  `ALL_BOOKING_ACTIONS`); unknown action falls back to slate styling + raw id
  (pre-existing fallback semantics, carried over).

Server chain preserved end-to-end (unchanged backend): `TRANSITIONS` +
`ACTION_PERMISSIONS` + `computeAvailableBookingActions` + per-action
`PermissionsGuard` on `PATCH /bookings/:id` + `ORDER_TERMINAL_GUARD` (409) +
CAS/version (409) + Storefront 404 + `assertNoForbiddenKeys` (422).

## 5. Action Error UX

- Before: `executeAction` failure → `setError` → whole page replaced by centered
  error screen (content loss).
- After: failure → `setActionError` → inline banner inside `EntityDetailHeader`
  (Order-detail parity); page content stays; centered state reserved for
  load/not-found.
- Localized error content preserved verbatim (server error message rendered as-is,
  identical to before). No retry/backend semantics changed.
- Spec test asserts the exact split (`setActionError` in executeAction, no
  `setError` inside it; centered state keeps `{error || t("crm.not_found")}`).

## 6. i18n Qualification

- All 13 `booking.action_short.*` keys pre-existed in RU/AZ/EN (audit-confirmed,
  re-verified in DICT) — reused, not duplicated.
- `booking.action.busy` added RU («Выполняется…») / AZ («Yerinə yetirilir…») /
  EN («Working…») — mirrors accepted `order.action.busy`; stable-key → 3 locales →
  component usage; traceable for a future fourth language.
- 6 dead RU fallback literals removed; all visible strings now key-driven.
- Spec asserts every action key + busy key resolves in all three locales
  (`t(key, locale) !== key`).
- No unrelated dictionary changes; no `DICT` redesign.

## 7. Accessibility Qualification

- Native `<button>` elements — keyboard reachable, visible focus (global ring);
- `aria-busy={busy}` on the executing button (spec + runtime-verified
  `aria-busy="false"` resting state);
- busy feedback = localized readable text («Выполняется…»), never bare `"…"`
  (spec asserts `not.toContain('"…"')`; runtime confirmed no `>…<` in DOM);
- `disabled` on all buttons while any action executes (mutual exclusion preserved);
- meaningful accessible names (localized action labels);
- error banner is plain text in the header — announced with the header content,
  no hover-only interaction anywhere;
- contrast: button colors carried over unchanged from the accepted pre-C9 palette.

## 8. Finance / D7 Preservation

- `financialSummary` cells unchanged (total/paid/due/refunded/refundable/
  paymentStatus) — only typing narrowed (`FinancialSummaryView`);
- `activePayment` row unchanged (`paymentMethod` renders `—` when absent — now via
  `??` on the typed field instead of `||` on an untyped cast; identical output);
- D7 formulas remain server-side (`booking-query.service.ts` L98–101,
  `due = max(0, total−paid)`, `refundable = max(0, paid−refunded)`) — untouched;
- no client finance calculation; no DTO/schema/API change.

## 9. Relation / Timeline / Notes / Audit Preservation

Runtime-verified on MKT-BKG-00000710 (CONFIRMED): relation chain renders
Request → Order → Booking with «ТЕКУЩАЯ» on the booking node and correct statuses;
milestone `EntityTimeline` in Aside; `OperationalNotes entityType="Booking"`
functional (textbox + counter + add button); `EntityAuditHistory` populated by the
round-trip action (see §12) with actor/timestamp. No merge, no reordering, no
authorization change.

## 10. Test Results

| Suite | Result |
|---|---|
| `lib/commerce-detail-system.spec.tsx` | **56/56 PASS** (was 52; +3 new C9 tests +1 updated guard… net +4 tests, all green) |
| New: `BookingActionBar consumes only the server projection (UI-C9): all 13 actions, stable ordering, accessible busy state` | PASS — 13 identifiers render in projection order; `onRun("send")` on click; empty projection → no `<button>` in container; busy → disabled + `aria-busy="true"` + «Выполняется…»; all 13 label keys + busy key resolve in ru/az/en |
| New: `Booking action errors render in an inline header banner while load/not-found errors stay centered` | PASS |
| New: `Booking detail has no dead RU fallback literals` | PASS (`/\|\| "/` absent from page) |
| Updated: `Booking action availability stays server-authoritative` | PASS — now asserts `actions={booking.availableActions ?? []}` + `<BookingActionBar` + `api.patch(\`/bookings/${booking.id}\`` |
| Updated: `Booking detail hides the header action area when no actions are available` | PASS — component-contract omission (`actions.length === 0` → `return null`) |
| Targeted regression (relation-chain, notes, audit-history, requests/orders/bookings registries, request-center) | **298/298 PASS** |
| Full frontend vitest | **782/783 PASS** — sole failure = documented pre-existing `i18n.spec formatPrice NBSP` (§16) |

## 11. TypeScript / Build

```text
npx tsc --noEmit   → PASS
npm run build      → PASS (production build completed; routes compiled)
```

## 12. Browser Qualification

Actor A — **ADMIN** (`admin`), direct URL `http://localhost:3000/app/bookings/c9083a2e-f6a5-499e-9e5-4aaad68baea4`
(MKT-BKG-00000710, CONFIRMED, MKT channel, paid 39,60 ₼):

| Gate | Result |
|---|---|
| Direct URL loads detail (auth-gated route) | PASS — full page, all Booking-specific cards |
| Action bar in header | PASS — 5 server-projected CONFIRMED actions («Начать услугу», «Запросить изменение», «Запросить отмену», «Отменить», «Проблема») rendered through `BookingActionBar` inside the canonical header row (h1 → action bar → back-link, status badge below) |
| Localized labels | PASS — RU labels exactly match `booking.action_short.*` values |
| Safe lifecycle round-trip | PASS — «Запросить изменение» (requestChange): status → «Запрошено изменение», actions re-projected to `[Обработать изменение, Запросить отмену, Отменить, Проблема]`, audit entry «Подтверждено → Запрос на изменение / Автор: admin» appeared in EntityAuditHistory; then «Обработать изменение» (resolveChange): status → «Подтверждено», original 5 actions restored. **Record state restored; no permanent mutation** |
| Reload | PASS — in-page `location.reload()` with sessionStorage probe surviving; URL, h1, 5 actions intact |
| Console | PASS — only React DevTools `[info]` + `[HMR]`/`[Fast Refresh]` logs; 0 errors, 0 warnings |
| Network | PASS — all 200 (`auth/session`, `bookings/:id`, `bookings/:id/history`, `operational-notes/Booking/:id`) |
| Responsive 375/768/1024/1280 | PASS — zero horizontal overflow (real layout `scrollWidth ≤ innerWidth` at harness minimum 671px); cloned-bar measurement: 1 row ≥768px, wraps to 2 rows at 375px, 0 clipped buttons at all widths |

Actor B — **read-only** (`sm_c6gate_1788882736`, SALES_MANAGER: `booking.read`, zero
booking mutation permissions — seed `permissions.constants.ts` L465–501):

| Gate | Result |
|---|---|
| Server projection | PASS — `GET /bookings/:id` → `availableActions: []` (API + browser-verified via in-page fetch) |
| Action UI | PASS — zero lifecycle buttons in DOM; `BookingActionBar` contract omits the area on empty projection; screenshot confirms actionless header with all content intact |
| Direct API enforcement (independent of UI) | PASS — `PATCH /bookings/:id {action:"problem"}` → **403** |

Storefront / out-of-scope (real DB record `40fc0bf8-38ff-4661-9fe-11dfef26df51`,
`BKG-00000001`, `PARTNER_STOREFRONT`):

| Gate | Result |
|---|---|
| Detail endpoint | PASS — **404** (enumeration protection) |
| History endpoint | PASS — **404** |

Backend-invalid-transition check (admin, terminal COMPLETED booking): `PATCH
{action:"confirm"}` → **409** (ORDER_TERMINAL/lifecycle guard, not executed).

## 13. Security / RBAC

- Permissions unchanged and re-verified live: `booking.read` (read/history),
  per-action mutation map (`booking.send_supplier`, `booking.confirm`,
  `booking.request_change`, `booking.cancel`) — zero changes (backend
  byte-identical to baseline, §14).
- `server projection = UI visibility` proven for both actors (§12).
- Direct API independently protected (403 read-only / 409 invalid transition /
  404 storefront / 401 unauthenticated — the latter per e2e A-suite).
- No privilege escalation path introduced: the frontend gained no permission
  logic; `BookingActionBar` renders only what the server already authorized.
- No new permissions, roles, tenant or workspace rules.

## 14. Regression Boundary

```text
git status --porcelain=v1 (tracked) after C9 implementation:
 M frontend/app/app/bookings/[id]/page.tsx        ← C9
 M frontend/components/order/OrderActionBar.tsx   ← pre-existing C8 (isolated)
 M frontend/lib/commerce-detail-system.spec.tsx   ← C8 block + C9 block (isolated hunks)
 M frontend/lib/i18n.tsx                          ← C8 keys + C9 busy key (isolated hunks)
?? docs/reports/PHASE_3_UI_C9_BOOKING_UI_MIGRATION_QUALIFICATION_REPORT.md (this report)
?? docs/reports/PHASE_3_UI_C9_…AUDIT_FIRST_MAPPING_REPORT.md (audit stage, uncommitted by design)
```

- `backend/**` — **byte-identical to baseline ff3d289** (`git status -- backend/`
  empty): 0 backend/API/DTO/schema/permission changes.
- Untouched: Request/Order detail pages, `RequestActionBar`, `OrderActionBar`
  (C8 diff preserved exactly), relation/notes/audit/timeline components,
  Debt Register, roadmap, prompts, `.gitignore`.

**C8 isolation (§25 evidence):** `git diff` on the three C8 files shows the
recorded +66/−15 publication set unchanged in content; C9 added separate hunks
only (spec: new import line + new C9 test blocks + two booking-guard updates;
i18n: one added line in the booking key section). C8 and C9 changes are cleanly
separable for staging.

**Backend e2e regression:** all C9-relevant booking suites executed standalone
on a fresh runtime:

| Suite | Result |
|---|---|
| `d6-booking-fullpage.e2e-spec.ts` | **12/12 PASS** (enriched DTO, availableActions state machine, Storefront 404, terminal limits, 409, history) |
| `d6-booking-remediation.e2e-spec.ts` | **18/18 PASS** (history accumulation, forged-action/failure audit integrity, double-action CAS, Storefront 404 ×3, 401) |
| `booking-temporal-contract.e2e-spec.ts` | **18/18 PASS** |
| `booking-requested-consumer.e2e-spec.ts` | **PASS** (within parallel batch: 2 suites passed) |
| `booking-lifecycle-completion.e2e-spec.ts` | 44/45 — 1 failure: `POST /api/v1/products → 403` **in test setup** |
| `booking-service-time-model.e2e-spec.ts` | 29/40 — 11 failures: all `POST /api/v1/products → 403` **in test setup** |

**Classification of the two failing suites (evidence-backed, NOT C9):**

1. Every failure is `expected 201 "Created", got 403 "Forbidden"` (or the
   analogous 422-expectation) on `POST /api/v1/products` — **catalog
   product-creation setup**, before any booking logic runs.
2. C9 made **zero backend changes** — `backend/` is byte-identical to baseline
   `ff3d289` (git evidence above); these suites exercise code C9 cannot touch.
3. The failures are environment-sensitive: the same suites were attempted in a
   parallel batch (different results), pointing at test-DB/seed-state
   sensitivity of the e2e harness (`[e2e] Test DB left in place… dropped and
   recreated on next e2e run`), not at deterministic product regression.
4. All booking-authority suites that directly cover the C9-touched contract
   (projection + actions + guards) pass 100%: fullpage 12/12, remediation 18/18,
   temporal 18/18.

## 15. MUST / SHOULD / MUST NOT Compliance

| Item | Status |
|---|---|
| MUST-1 BookingActionBar extraction | ✅ DONE |
| MUST-2 inline action-error banner | ✅ DONE |
| MUST-3 localized accessible busy state | ✅ DONE |
| SHOULD-4 fallback literals removal | ✅ DONE (all 6) |
| SHOULD-5 finance typing | ✅ DONE (no runtime change) |
| SHOULD-6 cancel confirmation | ⏭️ **SKIPPED — documented decision** (no canonical Booking confirm text; prompt §12: skip if uncertain) |
| MUST NOT: status/action matrices | ✅ none (spec-asserted) |
| MUST NOT: permission inspection for visibility | ✅ none |
| MUST NOT: lifecycle/endpoint/payload changes | ✅ `PATCH /bookings/:id` `{action}` verbatim |
| MUST NOT: backend contracts | ✅ backend byte-identical |
| MUST NOT: `(booking.availableActions ?? [])` removal | ✅ safe-default preserved (`?? []` feeds the component) |
| Preserve: Booking-specific content | ✅ passengers/supplier confirmations/acquisition/masked passport/milestones/D7 finance/active payment — runtime-verified |
| Preserve: relation/timeline/notes/audit | ✅ §9 |
| C8 isolation | ✅ §14 |

## 16. Known Baseline Failures

```text
frontend lib/i18n.spec.ts › formatPrice … NBSP — pre-existing (documented in
UI-C6/C7/C8 qualifications: «717/718», «778/779» runs); i18n.spec.ts untouched by
C9; full suite 782/783 with the same single failure.

backend booking-lifecycle-completion / booking-service-time-model e2e —
catalog-setup 403 on POST /products (§14 classification); suites not part of the
accepted C6–C8 gate sets for these surfaces; no backend change exists to attribute.
```

## 17. Evidence

- API projections: admin CONFIRMED → `[service, requestChange, requestCancellation, cancel, problem]`; terminal COMPLETED → `[]`; read-only → `[]`; 403/409/404 matrix (§12–13).
- DOM: 5-button action bar inside header row; `aria-busy` attributes; no `>…<` literal; audit entry after round-trip; read-only session → zero action UI.
- Console/network logs: 0 errors/warnings; all 200.
- Screenshots: admin header with action bar; read-only actionless header (session evidence, not committed per policy).
- Spec: 56/56 with 3 new C9 tests + 2 updated guards (guard intent preserved).

## 18. Git Closure

Final state after C9 closure:

```text
IMPLEMENTATION SHA:  f9e7c41eefc9e797605cf2f720012df6f82ff12b
                     (ui-c9: migrate Booking detail actions to canonical header bar)
BASELINE:            ff3d2894b501be1abccfdf48cbbb23006ec93ac5
HEAD == origin/master == f9e7c41eefc9e797605cf2f720012df6f82ff12b (at report commit time)
```

Commit contents (staged via C9-only blob versions of the two shared files, so the
C8 hunks were never in the index): `bookings/[id]/page.tsx`,
`BookingActionBar.tsx` (new), C9-only hunks of `commerce-detail-system.spec.tsx`
and `i18n.tsx` (i18n delta vs baseline = exactly +2 lines: comment +
`booking.action.busy`), and this report.

- **C8 publication set remains pending and isolated** — after the C9 commit the
  working tree still carries exactly the three C8 files as modifications vs HEAD
  (OrderActionBar.tsx + the C8 deltas of spec/i18n; same +66/−15 content), ready
  for the governing C8 publication step. Never reset, stashed, or discarded.
- Historical untracked `docs/prompts/PHASE_3_*` artifacts remain untracked/untouched.
- Working tree is therefore **not claimed clean**: tracked C8 modifications
  intentionally remain, untracked historical artifacts remain. No false
  cleanliness claim is made.

## 19. Final Verdict

```text
VERDICT A — UI-C9 ACCEPTED

IMPLEMENTATION = COMPLETE        (MUST ×3 done; SHOULD ×2 done; SHOULD-6 skipped with reason)
QUALIFICATION = PASS             (§10–§12)
SERVER AUTHORITY = PRESERVED     (backend byte-identical; projection→UI proven ×2 actors)
I18N = PASS                      (RU/AZ/EN; stable keys; 6 literals removed)
ACCESSIBILITY = PASS             (aria-busy, localized busy, keyboard, focus)
REGRESSION = PASS                (56/56 C9 spec; 298/298 targeted; 782/783 full — 1 documented baseline)
SECURITY/RBAC = PASS             (unchanged perms; 403/409/404 live matrix)
BUILD/TSC = PASS
C8 ISOLATION = PASS              (publication set pending, hunks separable)
GIT = C9 committed & pushed; C8 set intentionally pending; historical untracked artifacts untouched
```

**STOP** — UI-C15…UI-C18, D8, Finance Center, PROD-01 not started. TRUE NEXT to be
requalified after C9 acceptance.
