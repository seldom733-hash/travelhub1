# TRAVELHUB — ORDER → BOOKING TRANSITION
# READ-ONLY AUDIT REPORT

Prompt: `docs/prompts/ORDER_TO_BOOKING_TRANSITION_READ_ONLY_AUDIT.md`
Date: 2026-10-07
Scope: repository trace + read-only live inspection of the real Order. **No code, schema, data, tests or migrations were modified. No Booking was created. No commit/push.**

---

## A. Executive Verdict

**IMPLEMENTED** — the Order → Booking transition exists end-to-end and is server-authoritative; on the real Order it is currently **BLOCKED (data condition, by design)** because traveler data is not final-confirmed.

- The lifecycle `REQUEST → ORDER → ORDER ITEMS → Traveler data → Booking readiness → BOOKING` is fully wired: canonical events, consumer, DB-level idempotency.
- There is **no separate "ЗАБРОНИРОВАТЬ" button**. The transition action is the Order lifecycle command **`send`** ("Передать в Booking"), returned by the server in `availableActions` and rendered by `OrderActionBar`.
- On the real Order the `send`/`confirm` actions are **correctly hidden** because the D3 traveler gate is engaged (traveler data incomplete, no final confirmation). This is not a defect; it is the designed precondition. It makes the transition *appear* missing in the UI.

---

## B. Real Order Result — `TH-2026-000101`

Verified live (read-only API + read-only SQL SELECT; admin auth; **no mutations**).

| Field | Value |
|---|---|
| id | `36e031c0-8a66-498b-9dac-b7ba89122076` |
| code / number | `ORD-00000001` / `TH-2026-000101` |
| referenceNumber | `MKT-ORD-00000402` (commerceSequence `00000402`) |
| Order status | `IN_PROCESSING` (version 6) |
| paymentStatus | `UNPAID` (amount 3232 USD, paid 0) |
| Linked Request | `MKT-REQ-00000402` (REQ-00000402), status **CONVERTED** ✅ |
| termsAcceptedAt | `2026-10-06T19:47:06.780Z` ✅ |
| travelerCount | 2 (two OrderTraveler placeholders, positions 1–2) |
| travelers data | **both `INCOMPLETE`** — firstName/lastName empty, passportNumber null |
| travelerDataCompletedAt | `null` ❌ |
| finalConfirmedAt | `null` ❌ |
| commercialSnapshot | present: supplier `KAZUNION`, supplierPrice 3232 USD, markup 0, `customerFinalPrice` 3232 USD, `customerAcceptedAt` set ✅ |
| OrderItem | 1 item: `productId=""`, `productCode=""`, title "SUGAR MARINA RESORT…", type TOUR, amount 3232 USD (productSnapshot on the Request is also empty → placeholder identity) |
| linkedBooking | **null** — 0 rows in `booking.Booking` for this Order |
| Outbox for Order | 5× `OrderStatusChanged` (PUBLISHED) + 1× `OrderCreated` (PUBLISHED). **No `BookingRequested`, no `OrderReadyForBooking`.** |
| availableActions (admin) | `["markWaitingData","cancel","problem","suspend","returnToRequest"]` |

**Diagnosis for this Order**: it sits in `IN_PROCESSING`. Because D3 scope applies (`travelerCount=2 > 0` and `termsAcceptedAt != null`) and `finalConfirmedAt == null`, the projection filters out `confirm` and `send` (see §C, step 3). The operator path is:

```text
заполнить данные туристов → PATCH travelers (по 1..N)
→ POST /orders/:id/validate-completion  → сейчас: {complete:false, reason:"2 traveler(s) have incomplete data"}
→ POST /orders/:id/final-confirm        → finalConfirmedAt
→ PATCH /orders/:id {action:"confirm"}  → READY_FOR_BOOKING
→ PATCH /orders/:id {action:"send"}     → SENT_TO_BOOKING + BookingRequested
→ Booking consumer создаёт бронь(и) NEW
```

Note (data quality, not a transition blocker): `OrderItem.productId` is empty for this Order because the source Request's `productSnapshot` was empty (supplier-priced tour request). Booking creation copies `item.productId` verbatim → the future Booking would also carry `productId=""`. Booking is still created (productId is a plain string, no FK); fulfillment-by-supplier lookups would however have nothing to resolve.

---

## C. Complete Transition Trace

Every step verified with file/line:

| # | Step | Evidence |
|---|---|---|
| 1 | Order detail page renders **only** the server list | `frontend/app/app/orders/[id]/page.tsx` — `OrderActionBar actions={order.availableActions ?? []}`; `runAction()` → `api.patch(\`/orders/${order.id}\`, { action })` |
| 2 | Server-authoritative action projection | `backend/src/modules/order/order.service.ts:173–196` `computeAvailableOrderActions()` — TRANSITIONS from-list + `ACTION_PERMISSIONS` + D3 gate (`d3Scope && !finalConfirmedAt && (confirm|send) → skip`) + completeness gate for `confirm`. Called in `getOrder()` (line ~1153) |
| 3 | UI render mapping | `frontend/components/order/OrderActionBar.tsx` — pure render map; `send` → label `order.action_short.send` = **"Передать в Booking"** (`frontend/lib/i18n.tsx:2486`); no client-side business rules |
| 4 | HTTP endpoint | `PATCH /api/v1/orders/:id` — `backend/src/modules/order/order.controller.ts` `orderAction()`; `@RequirePermissions((req) => ACTION_PERMISSIONS[req.body?.action] ?? "order.edit_noncritical")`; `assertNoForbiddenKeys` → 422 on forged fields; `OrderActionDto` accepts only `action` (+ optional `reason`) |
| 5 | Service command | `order.service.ts:1408` `orderAction()` |
| 6 | Validations | `order.service.ts:1437` from-list → 409 `ConflictError`; :1483–1490 **D3 hard gate** (`confirm`/`send` require `finalConfirmedAt` when `travelerCount>0 && termsAcceptedAt`); :1493–1502 `confirm` requires all travelers `COMPLETE` → 422; :1507–1526 `send` free-item gate → 409 if no free OrderItem or legacy active booking; CAS `updateMany` :1536 (version+status) → 409 on race |
| 7 | Canonical event | `order.service.ts` case `"send"` → emits `DomainEvents.BookingRequested` (payload: `{orderId, orderCode, customerId}` — PII-minimal), status → `SENT_TO_BOOKING`, OrderHistory row `send` ("Передан в Booking Center") |
| 8 | Consumer creates Booking | `backend/src/modules/booking/booking.subscribers.ts` `onBookingRequested()` — **the only `tx.booking.create` in `src/`** (verified by repo-wide search): per **free** OrderItem → Booking `BKG-*` status `NEW`, frozen `amount/currency` from OrderItem (validated by `validateFrozenMoneyFact`), frozen service occurrence (serviceTimeType/StartsAt/EndsAt derived once), frozen `acquisitionSource`, `commerceSequence` → `MKT-BKG-{SEQ}` reference; Passenger rows from **COMPLETE** OrderTravelers; `BookingCreated` result event (causation = BookingRequested eventId); InboxEvent idempotency |
| 9 | Status changes back-propagate | `backend/src/modules/order/order.subscribers.ts` — BookingConfirmed/BookingStatusChanged(→CONFIRMED/COMPLETED) → `reconcileOrder`: `SENT_TO_BOOKING → PARTIALLY_FULFILLED → FULFILLED` (CAS + history + events); BookingRejected → Order `PROBLEM` |
| 10 | History/audit | OrderHistory (`order.service.ts` each transition), BookingHistory (`booking.subscribers.ts` `created` / `booking.service.ts` each action), `SecurityService.audit` for round-trips |

**There is no break in the chain.** The only "stop" points are the designed gates (§E). If the UI shows no booking action, the server deliberately did not project `send`.

---

## D. Current Architecture

```text
Request Center (Request CONVERTED)
   └─ convertRequestToOrder → OrderService.createOrderFromRequest
        Order NEW (termsAcceptedAt, pinnedRequirements, travelerCount, commercialSnapshot frozen)
        OrderItem(s) + OrderTraveler placeholders 1..N + Fulfillment
        OrderCreated
Order Center (owner of order.*; BookingRequested → OUT, BookingConfirmed/Rejected/StatusChanged → IN)
   └─ PATCH /orders/:id {action} — single command endpoint; TRANSITIONS matrix;
      D3 traveler gate; send free-item gate; CAS version+status; OrderHistory; outbox
Booking Center (owner of booking.*; created ONLY by consumer)
   └─ BookingRequested consumer → Booking + Passenger + BookingCreated
   └─ PATCH /bookings/:id {action} — NEW→…→CONFIRMED→IN_SERVICE→COMPLETED / reject / cancel
Order-owned reconcile ← Booking events (PARTIALLY_FULFILLED / FULFILLED / PROBLEM)
Stage 2 round-trip: Booking `returnToOrder` → booking CANCELLED/агрегат → Order READY_FOR_BOOKING/PARTIALLY_FULFILLED → повторный `send` (free items)
```

- Event bus: transactional outbox (`events."OutboxEvent"`) + per-consumer InboxEvent idempotency; result events carry correlation/causation lineage.
- Cross-domain rule (ADR-0001): consumers READ other domains' tables, write only their own.

---

## E. Booking Preconditions (actual, from code)

For **Order → BookingRequested** (`send`):
| Condition | Required for Booking? | Required for Order? | Required for payment? |
|---|---|---|---|
| Status ∈ {READY_FOR_BOOKING, PARTIALLY_FULFILLED} | **YES** (TRANSITIONS `send`) | — | NO |
| `order.edit_noncritical`... no — permission **`order.request_booking`** | **YES** (RBAC) | — | NO |
| D3 scope: `finalConfirmedAt != null` | **YES** if `travelerCount>0 && termsAcceptedAt` | same | NO |
| ≥1 free OrderItem (no occupying non-cancelled/non-rejected booking) | **YES** (free-item gate, mirrors partial unique index) | — | NO |
| `confirm` first (all travelers COMPLETE → READY_FOR_BOOKING) | **YES** (indirect: send's from-list) | — | NO |
| Payment paid / any payment at all | **NO** | NO | — |
| Supplier chosen / supplier reference | **NO** | NO | NO |
| `commercialSnapshot` / frozen price | NO (not checked in `orderAction`) | NO | NO |
| Traveler data complete | **YES** (final-confirm chain, D3) | NO (only for confirm/send) | NO |
| Product / productId non-empty | **NO** (not validated; `""` passes) | NO | NO |

For **BookingRequested → Booking** (consumer): order must exist with ≥1 item; order not CANCELLED-with-existing-bookings; no legacy active booking; money fact valid (`validateFrozenMoneyFact`). Travelers not COMPLETE → Booking is still created, just **without Passenger rows** (`readyTravelers` filter).

For **Booking lifecycle** (`prepare/send/confirm/…`): Booking status from-lists; Order not CANCELLED/CLOSED (except `cancel`); RBAC `booking.send_supplier` / `booking.confirm` / etc.

---

## F. Traveler Dependency

- Models: `OrderTraveler` (order-scoped, `position`, `dataCompleteness INCOMPLETE|COMPLETE`, pinned-validated fields) → `Passenger` (booking-scoped copy). Customer ↔ OrderTraveler via optional `customerId`. No Booking ↔ Traveler direct link; linkage is OrderTraveler → Passenger at creation time.
- `TravelerCollectionPanel` (`frontend/components/order/TravelerCollectionPanel.tsx`): renders "Турист 1 из 2 / Турист 2 из 2" per pinned requirements (REQUIRED/OPTIONAL/NOT_REQUESTED), per-traveler PATCH, then **"Финальное подтверждение"** = `POST /validate-completion` → `POST /final-confirm`.
- What **Final confirmation actually changes**: sets `Order.finalConfirmedAt` (server-owned, immutable; CAS + row-lock, duplicate → 409) and sets `travelerDataCompletedAt` via validation. It changes **no Order status**.
- Traveler state affects availableActions: **YES** — `computeAvailableOrderActions` suppresses `confirm` and `send` until `finalConfirmedAt` (and `confirm` additionally until all `dataCompleteness === COMPLETE`). This is exactly why the real Order shows no booking action.
- Completeness definition: `computeTravelerCompleteness` — with pinned snapshot, all REQUIRED fields non-empty; legacy (no pinned) = passportNumber non-empty.

---

## G. Multi-item / Multi-booking

Supported by design and by tests:
- 1 Booking **per free OrderItem** (consumer iterates `freeItems`); canonical cardinality enforced by partial unique index `Booking_orderItemId_key` (`status <> 'CANCELLED' AND rejectedAt IS NULL`).
- Multiple Bookings per Order — yes (test: booking-requested-consumer #2 "multi-item Order → по одной Booking на каждый OrderItem").
- Partial fulfillment — yes: Order reconcile → `PARTIALLY_FULFILLED` when some bookings confirmed, others not (order.subscribers + booking-lifecycle tests M1–M7).
- Booking one item while another stays unbooked — yes; repeat `send` after `returnToOrder` creates B2 only for free items (Q9; consumer occupancy skip).
- Booking requests are aggregate-level (per Order `send`), **not per-OrderItem** — there is no per-item action in the UI/API today (a per-item booking UX would be a new capability, not a fix).

---

## H. RBAC

- Business condition: `send` transition + free item + D3 final-confirmed (above).
- RBAC condition: permission **`order.request_booking`** (`ACTION_PERMISSIONS.send`, `order.controller` `@RequirePermissions` dynamic). Verified in DB: granted to roles **ADMIN** (ALL_PERMISSIONS) and **OPERATOR** only. SALES_MANAGER/DIRECTOR/MODERATOR/BUYER/PARTNER do not have it → neither the button (projection filters by permission) nor the API (403).
- UI visibility condition: `availableActions` array only (server-projected); OrderActionBar renders nothing for an empty list; also requires an authenticated `user`.
- Round-trip (`returnToOrder`) uses a separate `booking.return_to_order` (ADMIN + OPERATOR).

---

## I. Supplier Fulfillment

**Booking is an internal record only at creation time.**
- No supplier API call happens on Order→Booking. `booking.subscribers.ts` only writes local tables. `Reservation` (booking.*) has **no producers** (confirmed by search; `booking.service.ts:880` comment: "продьюсеров Reservation сегодня нет"; defensive HELD→RELEASED on returnToOrder). `SupplierConfirmation` has no producers either (read-only include in `booking-query.service.ts`).
- Supplier integrations (`modules/supplier/*`: SAMO-family adapters Summertour/Kompas/Kazunion/Anex, Aviasales, Azal) implement **search/price/availability only** — `SupplierAdapter` interface has no booking/create method; e.g. `summertour.adapter.ts`: "Booking requires B2B login (out of scope)".
- Supplier-side progression is **manual staff actions** on the Booking lifecycle: `prepare` → `send` (status `SENT_TO_SUPPLIER`, `requestedAt`) → `confirm`/`reject` (SupplierConfirmation/Reservation remain unfilled — manual workflow), `requestClarification`, change/cancel markers.
- Supplier-native identifiers: search-time only (`hotelKey`/`externalOfferId` in offers/Product attributes). Not universalized into Booking; Booking carries only `productId` (copied from OrderItem).

---

## J. Test Evidence

| Test file | Covers | Verdict (classified from code; **NOT RUN** in this audit) |
|---|---|---|
| `test/order-lifecycle-completion.e2e-spec.ts` (#5–#11, #30) | confirm readiness guard; send only from READY_FOR_BOOKING; send → 1 BookingRequested → Booking; duplicate/concurrent send; Booking ownership isolation | NOT RUN (spec exists, targeted; covers Order→Booking via API) |
| `test/booking-requested-consumer.e2e-spec.ts` (#1–#14) | consumer creates Booking per item; P2002 idempotency; re-delivery; logically-duplicate; cancel-before-send; POST /bookings → 404 | NOT RUN |
| `test/d3-traveler-collection.e2e-spec.ts` (#4, #9, #8) | multi-traveler final-confirm gates Booking; confirm/send rejected pre-final-confirm; duplicate final-confirm 409; then process→confirm→send → Booking+Passenger | NOT RUN |
| `test/booking-lifecycle-completion.e2e-spec.ts` (#1–#50) | full Booking status machine; RBAC 403s; order-terminal guard; compensation races; multi-item reconciliation | NOT RUN |
| `test/booking-to-order.e2e-spec.ts` (#1–#7) | Stage-2 round-trip, partial return, repeat send (B2) | NOT RUN |
| `test/rbac-actions.e2e-spec.ts` | `send` in action list; BUYER/PARTNER/SALES_MANAGER/MODERATOR 403; OPERATOR/ADMIN 200 | NOT RUN |
| `test/phase1.e2e-spec.ts` (#6) | lifecycle process→confirm→send → BookingRequested | NOT RUN |

No test in the suite was executed during this audit (would require DB writes in the test database; out of read-only scope). Coverage of the transition itself is judged **adequate** from spec content; the fixture-only caveat does not apply — `order-lifecycle-completion` #9 and `d3-traveler-collection` #4 exercise the real HTTP chain incl. consumer.

---

## K. Gap Matrix

| Gap | Severity | Current | Target | Evidence |
|---|---|---|---|---|
| Booking action | — **P3** (none functional) | `send` action fully implemented | same | order.service `TRANSITIONS.send`; outbox on real Order shows no BookingRequested only because gates engaged |
| UI action | **P2** | Action exists but is invisible until confirm+final-confirm; operators may perceive "no booking button"; no in-UI hint *why* | Same behavior + optional explanatory hint (out of audit scope) | `computeAvailableOrderActions` filters silently; OrderActionBar renders nothing when empty |
| API | — none | `PATCH /orders/:id {action:"send"}`; no POST /bookings (by design, 404) | same | booking.controller header comment; consumer test #9 |
| Preconditions | — none | As documented in §E | same | order.service guards |
| Traveler dependency | **P2 (data, per real Order)** | TH-2026-000101: 2 travelers INCOMPLETE, finalConfirmedAt null → send/confirm hidden & rejected | Fill travelers → final-confirm → confirm → send | validate-completion live: `{complete:false, "2 traveler(s) have incomplete data"}` |
| Multi-item | — none | per-item Bookings, partial unique index, partial fulfillment | same | booking.subscribers; schema `@@unique([orderItemId], where:…)` |
| Idempotency | — none | InboxEvent + P2002 + CAS + free-item occupancy | same | booking.subscribers `isUniqueViolation` |
| RBAC | — none | `order.request_booking` → ADMIN+OPERATOR (DB-verified) | same | permissions.constants.ts:634; live SQL |
| Supplier fulfillment | **P1 (roadmap, not regression)** | Booking = internal record; Booking `send` is a **manual** status flip; no supplier API booking; Reservation/SupplierConfirmation have no producers; real Order also has empty productId (snapshot placeholder) | Supplier call or declared manual protocol | supplier.types `SupplierAdapter` (no book method); summertour.adapter "Booking requires B2B login (out of scope)"; booking.service.ts:880 |

---

## L. Minimal Safe Fix Scope (describe only — NOT implemented)

1. **Nothing is broken in the transition itself — do not add entities, do not add a second booking path, do not add POST /bookings.**
2. Optional UX clarity (P2): when D3 gate suppresses `send`/`confirm`, surface a server-provided reason (e.g. include a `blockedReason` next to `availableActions`) so the Order page can explain "требуется финальное подтверждение данных туристов" instead of silently hiding buttons. Touch points: `computeAvailableOrderActions`/`getOrder` (backend projection) + `OrderActionBar`/detail page (frontend render). Backward compatible.
3. Optional data hygiene for the real Order (P2, operator actions through existing API, no code change): fill the two OrderTravelers via `PATCH /orders/:id/travelers/:tid`, `final-confirm`, `confirm`, `send`. Separately consider backfilling `OrderItem.productId`/`productCode` for requests converted with empty `productSnapshot` (currently `""`) — schema change NOT required (columns are plain strings); policy decision needed on whether product-less Bookings are acceptable for supplier fulfillment.
4. P1 roadmap item (separate design pass, explicitly out of this audit): supplier booking integration (adapter `book()` capability + Reservation/SupplierConfirmation producers) — must NOT be conflated with the Order→Booking business transition, which is complete.

---

## M. Regression Plan

If/when changes are made:
- Re-run (order): `order-lifecycle-completion.e2e-spec.ts` → `d3-traveler-collection.e2e-spec.ts` → `booking-requested-consumer.e2e-spec.ts` → `booking-lifecycle-completion.e2e-spec.ts` → `booking-to-order.e2e-spec.ts` → `rbac-actions.e2e-spec.ts` → `acquisition-source-propagation.e2e-spec.ts` → `payment-terms.e2e-spec.ts`.
- Invariants to assert after any change: no second Booking-create authority; BookingRequested payload stays PII-minimal; partial unique index name `Booking_orderItemId_key` unchanged (P2002 contract); `availableActions` remains server-authoritative (frontend invents nothing); D3 gate ordering (final-confirm before confirm/send) preserved; CAS + inbox idempotency on both consumers.

---

## N. Final Verdict

**WHAT WORKS**
- Full canonical chain Request→Order→OrderItems→travelers→BookingRequested→Booking→Passenger, with idempotency, CAS, history, audit, partial-unique cardinality, round-trip (returnToOrder + repeat send), and Order reconciliation (PARTIALLY_FULFILLED/FULFILLED/PROBLEM).
- Server-authoritative `availableActions` driving the Order UI; correct RBAC (`order.request_booking`: ADMIN, OPERATOR).
- Live read-only inspection of `TH-2026-000101`: chain intact; no Booking yet; no BookingRequested ever emitted for it.

**WHAT DOES NOT WORK**
- On the real Order: transition blocked **by design** — traveler data (both travelers) is INCOMPLETE and final confirmation was never given; `validate-completion` returns `complete:false`. The Order UI therefore shows no "Передать в Booking"/"Готов к бронированию" buttons.
- Supplier fulfillment is a manual protocol inside Booking lifecycle (no supplier booking API; Reservation/SupplierConfirmation unfilled); real Order's OrderItem has empty productId (Request productSnapshot was empty).

**WHERE TRANSITION BREAKS**
- Nowhere in code. On `TH-2026-000101` the "break" is the D3 traveler gate: `finalConfirmedAt = null` ⇒ `send`/`confirm` removed from `availableActions` and rejected server-side (422). It unblocks purely through existing operator actions (fill travelers → final-confirm → confirm → send).

**WHAT MUST CHANGE**
- Only (optionally, P2): UX transparency for gated actions (server-provided blocked reason); and a policy decision + backfill for empty `OrderItem.productId` on product-less conversions.
- P1 (roadmap): supplier booking execution if/when required.

**WHAT MUST NOT CHANGE**
- The single BookingRequested→consumer creation authority (no POST /bookings, no direct Order-side booking writes).
- PII-minimal BookingRequested payload; frozen money/service-occurrence/acquisition facts; partial unique `Booking_orderItemId_key` and its name; D3 gate semantics (termsAccepted → collect → final-confirm → confirm → send); server-authoritative `availableActions` as the only UI action source.

---

## Final safety check

```text
Production code changed: NO
Frontend changed: NO
Schema changed: NO
Database data changed: NO   (SELECT-only SQL; GET/list API calls; validate-completion POST is explicitly read-only by design — it mutates nothing when incomplete, and it returned complete:false)
Tests changed: NO
Migration created: NO
Booking created during audit: NO  (0 bookings for the Order before and after)
Commit created: NO
Push performed: NO
```
