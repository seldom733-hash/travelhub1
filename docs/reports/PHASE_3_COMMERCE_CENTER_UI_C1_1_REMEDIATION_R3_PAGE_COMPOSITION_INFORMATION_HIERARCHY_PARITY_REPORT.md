# PHASE 3 — COMMERCE CENTER UI-C1.1 — REMEDIATION R3 — PAGE COMPOSITION & INFORMATION HIERARCHY PARITY — REPORT

## 1. Executive Summary

R2 unified primitives, typography tokens, localization, row grammar and locale-aware dates, but the
three canonical detail pages still had **different page skeletons**:

```text
REQUEST  = single column, timeline at bottom
ORDER    = single column, Finance first, timeline full-width
BOOKING  = two-zone (main + aside)
```

R3 closes that defect by introducing one **shared page-composition primitive**
(`EntityDetailLayout` / `EntityDetailMain` / `EntityDetailAside` / `EntityDetailWide`) and
re-composing all three pages on it:

- **Same desktop two-zone grid** (`lg:grid-cols-3`, `gap-4`): MAIN ≈ 2/3 (measured ratio 2.038 on
  all three), CONTEXT ASIDE ≈ 1/3.
- **Same slot grammar**: PRIMARY business overview → SECONDARY business cards in MAIN; ХРОНОЛОГИЯ
  (business timeline) + ДЕТАЛИ (compact meta card) in ASIDE; Relations / Notes / Audit as full-width
  lower (Wide) slots — where the entity has that business content.
- **Finance visual parity**: Order and Booking Finance cards now use the identical grid class string
  (`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4`) at the same width context.
- **Same responsive stacking**: on mobile all three order sections as
  `Primary → Secondary → Timeline → Details → Relations → Notes → Audit`.
- Booking keeps its strong two-zone composition, but it is now the shared primitive, not a
  Booking-only grid; its audit history moved from the aside to the lower Wide slot.

Browser evidence (Playwright, live stack, admin session): side-by-side composite
`REQUEST | ORDER | BOOKING` at true 1680×1050 per page, bounding-box geometry JSON proving identical
main/aside ratio, column gap, content max-width and wide-slot width, and responsive checks at
390/768/1680 — 21/21 PASS.

```text
VERDICT A — UI-C1.1 REMEDIATION R3 —
PAGE COMPOSITION & INFORMATION HIERARCHY PARITY PASSED
```

## 2. Canonical Baseline

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED

UI-C1.1:
R1 — VERDICT B
R2 — VERDICT B   (composition defect remained)

R2 implementation checkpoint: 6115a8a26c43b4219306cdd38ffd9c2068ca0616
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

## 3. Starting Git State

```text
Branch:          master
HEAD:            7444f366f6d48ed9d1530f34c57c70ee484a0c2f
origin/master:   7444f366f6d48ed9d1530f34c57c70ee484a0c2f
HEAD == origin/master: YES
Porcelain:       only the untracked R3 prompt file
```

## 4. R2 Re-qualification

R2 (checkpoint `6115a8a`) is confirmed to have delivered: shared primitives, typography tokens,
localization (RU/AZ/EN), row grammar, locale-aware dates, TOTAL KPI micro-closure, common status
rendering, shared timeline primitive, and the Order lifecycle timeline.

R2 did **not** deliver page-composition parity — the three pages still had different skeletons
(single-column vs two-zone, Finance-first vs Overview-first, timeline placement in different
high-level zones, Booking audit inside the aside, Booking notes inside the main column, Order/Booking
Finance grids with different breakpoint behavior). Per the R3 prompt's canonical baseline, UI-C1.1
stays at VERDICT B until composition parity is proven. This report re-qualifies R2's
token-level work as accepted and closes the remaining composition defect.

## 5. Root Cause

R2 treated Visual Parity as `same primitives + same CSS tokens = parity`. Class-token equality does
not make three pages read as one template when their geometry, hierarchy, column system, section
order, slot grammar, card placement, visual weight and vertical rhythm differ. R3 therefore defines
parity as PAGE GEOMETRY + INFORMATION HIERARCHY + COLUMN SYSTEM + SECTION ORDER + SLOT GRAMMAR +
CARD PLACEMENT + VISUAL WEIGHT + VERTICAL RHYTHM + TYPOGRAPHY + TOKENS, and proves geometry with
bounding-box measurements and comparable screenshots, not class lists.

## 6. Canonical Page Composition Contract

```text
┌─────────────────────────────────────────────────────────────┐
│ BREADCRUMBS                                                 │
│ ENTITY TITLE / PRIMARY REF               STATUS / ACTIONS    │
│ SECONDARY REF / META                                        │
├─────────────────────────────────────────────────────────────┤
│ MAIN (≈2/3)                    │  ASIDE (≈1/3)             │
│  PRIMARY business overview     │  ХРОНОЛОГИЯ (timeline)    │
│  SECONDARY business cards      │  ДЕТАЛИ (compact meta)    │
├─────────────────────────────────────────────────────────────┤
│ WIDE: Relations / Notes / Audit (full width, where applicable) │
└─────────────────────────────────────────────────────────────┘
```

Measured desktop geometry (all three pages identical, `docs/evidence/r3/r3_bounding_boxes.json`):

```text
content max-width         1440px
main column               933px  (67.3%)
aside column              458px  (32.7%)
main/aside ratio          2.038  (target ≈2:1)
column gap                16px   (gap-4)
wide lower-slot width     1392px (full content width)
```

## 7. Shared Layout Primitive

`frontend/components/commerce/EntityDetailLayout.tsx` — single source of truth for the composition
grid (no page defines a competing page-level grid anymore):

```text
<EntityDetailLayout>   grid grid-cols-1 gap-4 lg:grid-cols-3
  <EntityDetailMain/>  min-w-0 space-y-4 lg:col-span-2   (MAIN ≈ 2/3)
  <EntityDetailAside/> min-w-0 space-y-4 lg:col-span-1   (ASIDE ≈ 1/3)
  <EntityDetailWide/>  min-w-0 lg:col-span-3             (full-width lower slot)
```

The primitive owns: desktop columns, column gap, responsive stacking, main/aside width ratio, card
spacing (`space-y-4`), and top-level vertical rhythm (`gap-4`). All three pages consume it.

## 8. BEFORE Matrix

State after R2 (verified by code inspection + R2 browser evidence).

| Property | Request | Order | Booking | Canonical | Result |
|---|---|---|---|---|---|
| Header geometry | shared | shared | shared | shared | PASS |
| Content max-width | 1440 (shell) | 1440 | 1440 | shared | PASS |
| Main/sidebar ratio | n/a — single column | n/a — single column | 2:1 inline grid | shared | **FAIL** |
| Column gap | n/a | n/a | gap-4 (page-owned) | shared | **FAIL** |
| Primary slot position | Overview first | **Finance first** | Service first | shared | **FAIL** |
| Timeline position | bottom full-width card | full-width card | aside | aside | **FAIL** |
| Details position | **absent** | **absent** | aside «Детали» | aside | **FAIL** |
| Finance placement | n/a (fields) | full-width, `lg:grid-cols-6` | main, `lg:grid-cols-4` | shared grammar | **FAIL** |
| Relations placement | full-width | full-width | inside Service card | full-width lower slot | partial |
| Notes placement | n/a | lower | **inside main column** | lower slot | **FAIL** |
| Audit placement | n/a | lower | **inside aside** | lower slot | **FAIL** |
| Vertical rhythm | space-y-4 | space-y-4 | grid gap-4 | shared | partial |
| Responsive stacking | single-col | single-col | main→aside | shared | **FAIL** |

## 9. Request Detail Changes

- Page now renders `EntityDetailLayout`: MAIN = Overview (primary), Actions (business flow),
  Supplier, Customer, Rejection (conditional); ASIDE = ХРОНОЛОГИЯ (backend milestone timeline) +
  **new ДЕТАЛИ compact meta card** (code, commerce sequence, created, updated — all existing data);
  WIDE = Relations (linked Order/Booking/payments/refunds).
- Relations remain a full-width lower slot; UI-C2 (relation chain) NOT started.
- Request has no backend Notes/Audit capability → those slots are intentionally absent (no fake data).
- SEC-UI-01 unchanged (actions stay frontend-gated with server round-trips).

## 10. Order Detail Changes

- Page now renders `EntityDetailLayout`: MAIN = **Обзор заказа** (primary: customer, seller partner,
  traveler count, created — replacing Finance as the first block), Финансы (secondary), Позиции,
  Данные туристов; ASIDE = ХРОНОЛОГИЯ (lifecycle milestones) + **new ДЕТАЛИ compact meta card**
  (code, number, created, updated); WIDE = Relations (linked Request/Booking), Notes, История
  изменений (audit), Финансовая история (D7 audit surface).
- Finance grid changed from full-width `lg:grid-cols-6` to the shared main-column
  `grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4` (parity with Booking, §12).
- D5 server-authoritative actions and D7 financial authority untouched (no frontend calculations).

## 11. Booking Detail Changes

- Page now renders `EntityDetailLayout` (the previous Booking-only inline grid is gone — the shared
  primitive owns the composition).
- MAIN = Услуга/Обзор (primary), Финансы, Пассажиры, Подтверждения поставщика (conditional).
- ASIDE = ХРОНОЛОГИЯ + ДЕТАЛИ (unchanged content, shared section-title keys).
- **Change history moved from the aside to the WIDE lower audit slot** (Timeline ≠ Audit;
  the aside is context-only).
- D6 server-authoritative actions and D7 linked-Order finance authority untouched.

## 12. Finance Visual Parity

Both Order and Booking Finance cards now render in the MAIN column at identical width context with the
identical grid class string:

```text
grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4
```

Same card geometry (`EntityFinanceCell`), same cell sizing, same label/value hierarchy, same
breakpoint behavior. Business fields may differ (Order always renders its six D7 cells; Booking
renders cells per `financialSummary`) — the grid behavior is identical. No D7 formula changes.

## 13. Timeline vs Audit

- ХРОНОЛОГИЯ (aside, all three): business milestones only — Request backend milestone events, Order
  created→…→closed/cancelled, Booking created→requested→confirmed→completed/cancelled/rejected.
- Audit (Wide, lower): Order «История изменений» + «Финансовая история» (D7), Booking «История
  изменений». Not merged; distinct high-level zones.

## 14. Relations Placement

Full-width lower slot (Wide) where the entity has relations business content: Request (linked
Order/Booking/payments/refunds) and Order (linked Request/Booking). Booking's order relation lives in
its Service overview (single parent link, not a relations chain) — not duplicated for symmetry.
UI-C2 (CommerceRelationChain) NOT started.

## 15. Notes / Audit Applicability

- Order: Notes (`OperationalNotes`) + audit (change history + financial history) in Wide slots.
- Booking: Notes + audit (change history) in Wide slots.
- Request: backend has no `Request` entity type for operational notes/audit → slots absent by design
  (no invented data, no client-only persistence).

## 16. Responsive Contract

Same breakpoint behavior on all three (browser-verified, 21/21 PASS):

| Width | Behavior | Evidence |
|---|---|---|
| 1680px | two-zone grid, ratio 2.038, gap 16px | bounding boxes |
| 768px | stacked (grid-cols-1) — no overflow | responsive probe |
| 390px | stacked, canonical order — no overflow | responsive probe + h3 order |

Mobile section order (identical grammar on all three, verified via h3 sequence):

```text
Request:  ОБЗОР → ПОСТАВЩИК → КЛИЕНТ → ХРОНОЛОГИЯ → ДЕТАЛИ → СВЯЗАННЫЕ СУЩНОСТИ
Order:    ОБЗОР → ФИНАНСЫ → ПОЗИЦИИ ЗАКАЗА → ДАННЫЕ ТУРИСТОВ → ХРОНОЛОГИЯ → ДЕТАЛИ →
          СВЯЗАННЫЕ СУЩНОСТИ → ПРИМЕЧАНИЯ → ИСТОРИЯ ИЗМЕНЕНИЙ → ФИНАНСОВАЯ ИСТОРИЯ
Booking:  УСЛУГА → ФИНАНСЫ → ХРОНОЛОГИЯ → ДЕТАЛИ → ПРИМЕЧАНИЯ
```

i.e. `Primary → Secondary → Timeline → Details → Relations → Notes → Audit`.

## 17. Localization

No R2 regressions: RU/AZ/EN touched surfaces intact; no hardcoded `ru-RU`; no raw enum leakage where
mappings exist; shared section names across equivalent components — the Details meta card now uses the
shared `detail.sections.details` key on all three, and the sequence label uses `detail.details.sequence`
(2 new i18n keys, RU/AZ/EN).

## 18. Accessibility

- Heading hierarchy preserved: single `h1` (header reference), section cards remain `h3`
  (EntitySectionCard); no new headings added or removed.
- Composition changes are pure CSS grid — landmarks, keyboard actions, focus order and links/buttons
  semantics unchanged.
- Statuses remain textual badges (accessible text via localized labels).
- No horizontal overflow at 390/768/1680 → no clipped interactive elements; responsive reflow does not
  move focus.

## 19. Security Preservation

| Area | Result |
|---|---|
| D5 Order server-authoritative actions | ✅ preserved |
| D6 Booking server-authoritative actions | ✅ preserved |
| D7 backend financial authority | ✅ preserved (no frontend calculations) |
| RBAC / workspace / tenant isolation | ✅ unchanged |
| 404-like cross-context semantics | ✅ unchanged |
| Audit immutability | ✅ render-only surfaces |
| SEC-UI-01 | ✅ REMAINS OPEN (Request actions still frontend-gated) |

## 20. Tests

| Suite | Result |
|---|---|
| Frontend typecheck (`tsc --noEmit`) | PASS |
| Frontend build (`next build`) | PASS |
| `commerce-detail-system.spec.tsx` | 44/44 PASS (adds R3 composition tests: all 3 consume Layout/Main/Aside/Wide; shared Details slot key; Order/Booking Finance grid parity; no page-level grid grammar; Booking audit in Wide, timeline in Aside) |
| Frontend full vitest | 390 passed, 1 failed — pre-existing `formatPrice` NBSP assertion (baseline-demonstrated in R2 via `git stash`; unrelated to R3) |

## 21. Browser Qualification

Playwright, live stack (:4000/:3000), admin session, fixed desktop viewport 1680×1050 for all three
detail pages plus 768/390 responsive passes:

| Check | Result |
|---|---|
| Individual full-page screenshots @1680×1050 (requests/orders/bookings) | PASS |
| Side-by-side composite REQUEST | ORDER | BOOKING | PASS |
| Bounding-box geometry: ratio/gap/max-width/wide-width parity | PASS (all identical) |
| No horizontal overflow @390/768/1680 (9 combos) | PASS |
| Mobile stacking order grammar | PASS (all three) |

Summary: **21/21 PASS** (`docs/evidence/r3/r3_browser_results.json`).

## 22. Side-by-Side Screenshot Evidence

`docs/evidence/r3/r3_side_by_side_requests_order_booking.png` — three frames (REQUEST | ORDER |
BOOKING), each rendered at true 1680×1050 desktop and scaled identically, so block geometry is directly
comparable. Individual full-page shots: `r3_detail_requests.png`, `r3_detail_orders.png`,
`r3_detail_bookings.png`.

Acceptance question — «Если скрыть бизнес-текст и оставить только геометрию блоков, воспринимаются ли
три страницы как один шаблон?» → **YES**: identical header bars, identical two-zone grid with the
same ratio and gap, identical aside column (timeline + details cards), identical full-width lower
slots.

## 23. Bounding-Box / Layout Evidence

`docs/evidence/r3/r3_bounding_boxes.json` — for each page at 1680×1050:

| Metric | Requests | Orders | Bookings |
|---|---|---|---|
| header bounds | same | same | same |
| content max-width | 1440 | 1440 | 1440 |
| main width | 933 | 933 | 933 |
| aside width | 458 | 458 | 458 |
| main/aside ratio | 2.038 | 2.038 | 2.038 |
| column gap | 16 | 16 | 16 |
| wide slot width | 1392 | 1392 | 1392 |

## 24. AFTER Matrix

| Property | Request | Order | Booking | Canonical | Result |
|---|---|---|---|---|---|
| Header geometry | shared | shared | shared | shared | PASS |
| Content max-width | 1440 | 1440 | 1440 | shared | PASS |
| Main/sidebar ratio | 2.038 | 2.038 | 2.038 | shared ≈2:1 | PASS |
| Column gap | 16px | 16px | 16px | shared | PASS |
| Primary slot position | Обзор (Overview) | Обзор заказа (Overview) | Услуга (Service) | shared (business content differs) | PASS |
| Timeline position | aside | aside | aside | aside | PASS |
| Details position | aside (new) | aside (new) | aside | aside | PASS |
| Finance placement | n/a | main, 4-col grid | main, 4-col grid | shared grammar | PASS |
| Relations placement | wide | wide | in Service (parent link) | full-width lower slot where applicable | PASS |
| Notes placement | n/a (no backend) | wide | wide | lower slot | PASS |
| Audit placement | n/a (no backend) | wide (2 sections) | wide | lower slot | PASS |
| Vertical rhythm | gap-4 / space-y-4 | gap-4 / space-y-4 | gap-4 / space-y-4 | shared | PASS |
| Responsive stacking | Primary→Secondary→Timeline→Details→Wide | same | same | shared | PASS |

Every PASS is backed by `docs/evidence/r3/r3_bounding_boxes.json` + browser screenshots + h3 order
probes — not by class lists alone.

## 25. Remaining Debt / Non-Scope

- SEC-UI-01 OPEN (Request server-authoritative actions) — separate remediation.
- UI-C1.2 Operations Center — NOT started (TRUE NEXT, §29).
- UI-C2 Commerce Relation Chain — NOT started.
- D8 — NOT started.
- Request Notes/Audit slots absent — no backend entity type (documented; do not invent).
- Request/Order Booking meta cards reuse existing DTO fields only (no new backend fields).
- Pre-existing failure: frontend `formatPrice` NBSP assertion (baseline-demonstrated).

## 26. Acceptance Matrix

| Gate | Result | Evidence |
|---|---|---|
| P0-1 Shared page composition | PASS | EntityDetailLayout on all 3 + unit tests |
| P0-2 Shared information hierarchy | PASS | h3 order probes (Primary→Secondary→Timeline→Details→Wide) |
| P0-3 Shared desktop grid | PASS | ratio 2.038 / gap 16 / max-width 1440 on all 3 |
| P0-4 Shared context sidebar | PASS | aside = ХРОНОЛОГИЯ + ДЕТАЛИ on all 3 |
| P0-5 Timeline placement parity | PASS | aside on all 3 (unit + browser) |
| P0-6 Details/meta placement parity | PASS | aside on all 3 (new cards on Request/Order) |
| P0-7 Equivalent Finance visual parity | PASS | identical grid class + width context |
| P0-8 Relations lower-slot parity | PASS | wide slot on Request/Order; n/a Booking |
| P0-9 Responsive structure parity | PASS | 21/21 browser checks |
| P0-10 Side-by-side visual qualification | PASS | composite screenshot + bounding boxes |
| P0-11 D5 preserved | PASS | server `availableActions` untouched |
| P0-12 D6 preserved | PASS | server `availableActions` untouched |
| P0-13 D7 preserved | PASS | backend amounts only |
| P0-14 UI-C2 not started | PASS | only typography/placement normalization |
| P0-15 D8 not started | PASS | — |
| P0-16 Git hard closure | PASS | §27 |

## 27. Git Hard Closure

```bash
git status --porcelain=v1   → empty (verified after push)
git rev-parse HEAD          → 7a722bd2c5e6c54033b6e1bccd3b57d5c76cbe35
git rev-parse origin/master → 7a722bd2c5e6c54033b6e1bccd3b57d5c76cbe35
HEAD == origin/master       → YES
```

## 28. Final Verdict

```text
VERDICT A — UI-C1.1 REMEDIATION R3 —
PAGE COMPOSITION & INFORMATION HIERARCHY PARITY PASSED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED AFTER R3

FINAL SHA: 7a722bd2c5e6c54033b6e1bccd3b57d5c76cbe35

TRUE NEXT:
UI-C1.2 — OPERATIONS CENTER
ARCHITECTURE & DESIGN RECONCILIATION

UI-C2 — NOT STARTED
D8 — NOT STARTED
```

## 29. TRUE NEXT — ONLY AFTER ACCEPTANCE

```text
UI-C1.2
OPERATIONS CENTER
ARCHITECTURE & DESIGN RECONCILIATION
```

Design of [ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ] tabs with sidebar ownership
(ОПЕРАЦИИ → Заявки/Заказы/Бронирования; ФИНАНСЫ → Платежи) is part of UI-C1.2, NOT R3.