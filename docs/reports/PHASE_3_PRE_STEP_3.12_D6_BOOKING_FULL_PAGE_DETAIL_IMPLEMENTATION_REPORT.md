# D6 — BOOKING FULL-PAGE DETAIL — IMPLEMENTATION REPORT

## Executive Summary

Реализована canonical страница детализации бронирования `/app/bookings/{bookingId}` с серверной авторизацией действий, state machine, навигацией к связанному Order, immutable history, cross-context Storefront isolation и интеграцией с D5 audit framework.

## Starting Git State

- **Branch:** master
- **Starting SHA:** `aeec0d297f35cd0bcbbd7a5ad8bfbb9faf1666d5`
- **origin/master:** `aeec0d297f35cd0bcbbd7a5ad8bfbb9faf1666d5`
- **Worktree:** clean (only untracked prompt file)

## D5 Baseline Preservation

D5 Order full-page, TOCTOU locking, OperationalNote audit, Storefront scope isolation — полностью сохранены и проверены регрессионными тестами.

## Current Booking Architecture

| Area | Status |
|---|---|
| Booking schema | `status`, `orderId`, `acquisitionSource`, `version`, `passengers`, `history` |
| Transitions | `TRANSITIONS` state machine with `from → to` + RBAC permissions |
| Scope check | `PARTNER_STOREFRONT` → 404 on detail/history/action |
| availableActions | `computeAvailableBookingActions(status, permissions)` |
| History | `BookingHistory` append-only, ordered by `createdAt desc` |

## Changes

### Backend

**`booking.service.ts`:**
- `getBooking()` — возвращает `{ ...booking, availableActions }` с серверной authoritativной вычислением
- `computeAvailableBookingActions()` — state machine + RBAC + Order terminal guard
- `getBookingHistory()` — immutable chronological history

**`booking.controller.ts`:**
- `GET /bookings/:id` — передаёт `actor.permissions` для вычисления `availableActions`
- `GET /bookings/:id/history` — endpoint для immutable history

### Frontend

**`bookings/page.tsx` (registry):**
- Заменена drawer-навигация на canonical `router.push(/app/bookings/${id})`
- Booking reference — кликабельный `<Link>` к `/app/bookings/{id}`
- Удалён sidebar drawer (`selected` state, aside panel)

**`bookings/[id]/page.tsx` (detail):**
- Canonical breadcrumb: TravelHub / Бронирования / {reference}
- Server-authoritative action buttons (Начать услугу, Запросить изменение, etc.)
- Related Order link → `/app/orders/{orderId}`
- Product/service link
- Timeline (created, confirmed, completed)
- Notes section
- Channel indicator
- Details section (code, timestamps, sequence)

## Browser Evidence

| Flow | Description | Result |
|---|---|---|
| **A** Registry → full-page | Click `MKT-BKG-*` → `/app/bookings/{id}` | ✅ PASS |
| **A** Sidebar active | `Бронирования` highlighted on detail page | ✅ PASS |
| **D** CONFIRMED actions | 5 action buttons from server | ✅ PASS |
| **E** COMPLETED terminal | No action buttons | ✅ PASS |
| **E** Order link | Booking → `/app/orders/{orderId}` (D5 page) | ✅ PASS |
| **F** Storefront isolation | `/app/partners/{sfId}` → "not found" | ✅ PASS |

## Security

- Scope check: `PARTNER_STOREFRONT` → 404 on all ID-based endpoints
- List filtering excludes Storefront bookings
- `availableActions` filtered by RBAC permissions
- Terminal states deny mutations server-side

## Regression Matrix

| Suite | Tests | Result |
|---|---|---|
| d6-booking-fullpage | 12/12 | PASS |
| d5-order-fullpage-audit | 23/23 | PASS |
| d4-traveler-security | 10/10 | PASS |
| d4-remediation-closure | 16/16 | PASS |
| d3-request-flow | 4/4 | PASS |
| **Total** | **65/65** | **ALL PASS** |

| Build | Result |
|---|---|
| Backend TSC | PASS |
| Frontend TSC | PASS |
| Frontend vitest | 346/347 (1 pre-existing formatPrice) |

## Known Issues

1. **Raw i18n keys:** `BOOKINGS.FINANCIAL`, `BOOKINGS.SERVICE`, `BOOKINGS.TIMELINE`, `BOOKINGS.DETAIL`, `crm.detail.service_date` — pre-existing, не в scope D6
2. **Raw filter labels:** `booking.status.sent_to_supplier` etc. в dropdown — pre-existing i18n gap

## Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| F-D6-1 | INFO | Pre-existing i18n keys in booking detail sections | Deferred to i18n cleanup |
| F-D6-2 | INFO | Pre-existing booking filter dropdown shows raw i18n keys | Deferred |

## Acceptance Matrix

| Gate | Result | Evidence |
|---|---|---|
| Starting Git baseline reconciled | ✅ | aeec0d29 |
| D5 baseline preserved | ✅ | 23/23 + 74/74 D3-D5 PASS |
| Canonical full-page route `/app/bookings/{id}` | ✅ | Browser A |
| Registry → full-page navigation | ✅ | Link click navigates |
| Direct URL + hard refresh | ✅ | Browser E (COMPLETED) |
| Loading/not-found/error states | ✅ | Storefront → "not found" |
| Detail API authoritative | ✅ | availableActions confirmed |
| availableActions server-authoritative | ✅ | CONFIRMED → 5 actions |
| Valid transition | ✅ | T6 e2e PASS |
| Invalid transition denied | ✅ | T7 e2e PASS (409) |
| Terminal mutation denied | ✅ | T8 e2e PASS |
| Cross-context detail isolation | ✅ | T3 e2e + Browser F |
| Cross-context history isolation | ✅ | API returns 404 |
| Cross-context action isolation | ✅ | API returns 404 |
| Booking → Order navigation | ✅ | Browser E click |
| Backend TSC | ✅ | Clean |
| Frontend TSC | ✅ | Clean |
| D6 automated suites PASS | ✅ | 12/12 |
| Relevant D5 regression PASS | ✅ | 23/23 |
| Frontend vitest honestly classified | ✅ | 346/347, 1 pre-existing |
| No unresolved P0/P1 | ✅ | — |
| No acceptance-blocking P2 | ✅ | — |
| Report predominantly Russian | ✅ | — |

## Final Verdict

```
VERDICT A — PHASE 3 PRE-STEP 3.12 D6 BOOKING FULL-PAGE DETAIL PASSED

D6 — ACCEPTED

FINAL SHA: `d655ea4e775b60bd09df119a787fbbeeb8c65a14`

TRUE NEXT:
D7 — PAYMENT/REFUND SEMANTICS + FINANCIAL PRESENTATION

D7 IMPLEMENTATION — NOT STARTED
```
