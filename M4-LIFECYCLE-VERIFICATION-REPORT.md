# M4-LIFECYCLE-VERIFICATION-REPORT — BIDIRECTIONAL COMMERCE LIFECYCLE

Date: 2026-10-05
Gate: `docs/prompts/M4_LIFECYCLE_VERIFICATION_PROMPT.md` (post-gate verification of `M4-IMPLEMENTATION-REPORT.md`)
Subject: current working tree (M4 uncommitted state + unrelated M5 WhatsApp work; commerce modules = M4 final).
Baseline for pre-existing failures: `0d7de62` (per M4 report §14, re-verified below).

Compliance: **NO production code changes, NO schema changes, NO migrations, NO UI redesign, NO commit, NO push.**
Only read-only inspection + execution of the five existing baseline test suites. No test fixture was added
(existing tests already prove forward behavior; no dynamic probe can prove a missing endpoint better than
the exhaustive route/service enumeration below).

---

## 1. Executive verdict

### **LIFECYCLE FAIL**

Per the gate's own rule (§20): *LIFECYCLE FAIL if backward transitions are absent where required.*

| Required leg | Status |
|---|---|
| Request → Order | **IMPLEMENTED, PASS** (`POST /api/v1/requests/:id/convert`) |
| Order → Booking | **IMPLEMENTED, PASS** (`PATCH /api/v1/orders/:id {action:"send"}` → `BookingRequested` → consumer) |
| Booking → existing Order | **NOT IMPLEMENTED** (no endpoint, no service method, no event consumer, no UI, no test) |
| Order → existing Request | **NOT IMPLEMENTED** (no endpoint, no service method, no UI, no test; Request is permanently `CONVERTED`) |

Everything else the gate probes is **healthy**: forward transitions preserve all previous entities (no deletes
anywhere), history/audit from→to/actor/timestamp exists per entity, communication history is never copied or
split, Customer ownership flows unchanged (no phone substitution, no User-from-Traveler), numbering is stable
and shared across the chain, and the database relations **cannot** cascade-delete a historical stage.

The single, verdict-defining defect: the round-trip
`R1 → O1 → B1 → O1 → R1` **stops after `B1`** — legs 3 and 4 do not exist in code.

---

## 2. Actual architecture

```text
Request (order.Request)                    Order (order.Order)                  Booking (booking.Booking)
  status: RequestStatus (12)                 status: OrderStatus (12)             status: BookingStatus (13)
  code REQ-########                          code ORD-########                    code BKG-########
  commerceSequence (unique, root)            commerceSequence (copy of root)      commerceSequence (copy of root)
  customerId → CRM (FK-less)                 customerId (copy, FK-less)           ← derived via orderId
  convertedOrderId ──────────────────────►   id                                   orderId ──────────────────► id
  convertedAt                               (no FK to Request)                   (no FK to Order; plain TEXT + index)
       ▲                                          ▲                                    │
       └─ inverse lookup: request.findFirst({convertedOrderId: order.id})              │
                                              └─ booking.orderId lookup                 │
```

- **No single `currentStage` column exists.** Stage = per-entity `status` + conversion marker
  (`Request.convertedOrderId` / `convertedAt`, `request.service.ts:765-766` canonical contract) + relation
  traversal + milestone timestamps (`Order.submittedAt/confirmedAt/...`, `Booking.requestedAt/confirmedAt/...`).
  Server-authoritative action projections decide what may happen next:
  `computeRequestAvailableActions` (`request.service.ts:40-82`), `computeAvailableOrderActions`
  (`order.service.ts:161-184`), `computeAvailableBookingActions` (`booking.service.ts:123-135`).
- Cross-domain links are **FK-less by design** (multi-schema: `order`/`booking`): `Request.convertedOrderId`
  (`schema.prisma:2422`, plain TEXT column — migration `20260901000000:32`, no REFERENCES) and
  `Booking.orderId` (`schema.prisma:2518`, comment “ссылка на Order, без FK”; `init:317` + index only).
- Chain read-models: Request detail loads `convertedOrder/convertedBooking` (`request.service.ts:437-530`),
  Order detail `linkedRequest/linkedBooking` (`order.service.ts:1133-1145`), Booking detail
  `linkedOrder/linkedRequest` (`booking-query.service.ts:77-96`).

State machines (verified directly in source):

- Order `TRANSITIONS` — `order.service.ts:100-111`: 10 actions, all **within the Order stage**; only backward
  move is `resumeProcessing: WAITING_FOR_DATA → IN_PROCESSING`.
- Booking `TRANSITIONS` — `booking.service.ts:53-70`: 13 actions, all **within the Booking stage**; backward
  moves `resume` and `resolveChange` stay inside Booking. Terminal guard:
  `booking.service.ts:34` «Терминальные … не reopen-аются»; `ORDER_TERMINAL_GUARD` (`:80`) blocks reviving a
  Booking of a cancelled/closed Order (`:479-489`).
- Request: no table machine; per-method gates; the only writer of `CONVERTED` is the convert CAS
  (`request.service.ts:825-828`) and **no writer ever moves a Request out of `CONVERTED`** (all six status
  writers enumerated: `:242,:567,:664,:738,:825,:1040` — none touches a converted Request;
  `convertedOrderId` is written once at `:865`, initialized `null` at create `:260`, never cleared).

---

## 3. Forward transitions

### 3.1 Request → Order — IMPLEMENTED (PASS)

| Aspect | Evidence |
|---|---|
| Endpoint | `POST /api/v1/requests/:id/convert` — `request.controller.ts:248-259` (perm `order.edit_noncritical`; 201 new / 200 idempotent replay) |
| Service | `RequestService.convertRequestToOrder` — `request.service.ts:776-944` |
| Gates | status must be `CUSTOMER_ACCEPTED` else 409 (`:802-806`); D3 snapshot `customerAcceptedAt` + `travelerCount` (`:807-811`); CAS `updateMany({status:"CUSTOMER_ACCEPTED"} → "CONVERTED")` (`:825-828`) with loser path (`:829-837`) |
| Created | `Order` (status `NEW`, **reuses `commerceSequence` from Request**, `referenceNumber = MKT-ORD-{seq}`) — `order.service.ts:657-707`; `OrderItem` `:712-725`; `OrderTraveler` placeholders `:730-743`; `Fulfillment` `:745`; `OrderHistory{action:"created"}` `:747-763` |
| Updated | Request: `status → CONVERTED` (`:827`), `convertedOrderId = order.id`, `convertedAt = order.createdAt` (`:863-870`) — **same Request row, same ID** |
| Deleted | **Nothing.** No `.delete`/`.deleteMany` on Request/Order/Booking anywhere in commerce code (grep: only perf seed teardown `src/perf/lib/seed.ts:575`) |
| History/audit | `RequestHistory{action:"converted", from:"CUSTOMER_ACCEPTED", to:"CONVERTED"}` (`:872-882`); `AuditLog "request.converted"` with orderId/referenceNumber/commerceSequence (`:884-899`) |
| Event | `OrderCreated` emitted in-tx (`order.service.ts:767-781`), published after commit (`:906-908`); consumers: `commission-accrual.consumer.ts:40`, `marketplace-pcr-attribution.consumer.ts:35` |
| UI | `RequestActionBar.tsx:75,212-223` “convert” button → `POST /requests/${id}/convert` (`requests/[id]/page.tsx:197-199`); gated by server projection `convert: … convertedOrderId === null` (`request.service.ts:80`) |

### 3.2 Order → Booking — IMPLEMENTED (PASS)

| Aspect | Evidence |
|---|---|
| Endpoint | `PATCH /api/v1/orders/:id` `{action:"send"}` — `order.controller.ts:272-287` |
| Transition | `send: READY_FOR_BOOKING → SENT_TO_BOOKING` (`order.service.ts:105`); D3 gate `finalConfirmedAt` else 422 (`:1418-1424`); CAS (`:1453-1459`); `OrderHistory` (`:1465-1476`) |
| Command event | `BookingRequested {orderId, orderCode, customerId}` (`order.service.ts:1510-1526`) |
| Created | `BookingSubscribers.onBookingRequested` — `booking.subscribers.ts:65-248`: one `Booking` per `OrderItem` (status `NEW`, `:148`), `Passenger` rows from COMPLETE `OrderTraveler` (`:199-212`), `BookingHistory{action:"created"}` (`:182-193`), `BookingCreated` result event (`:233-240`) |
| Updated | **Nothing** on Order (consumer read-only on `order.*`, `booking.subscribers.ts:41`); Order advances later via forward reconcile only (`order.subscribers.ts:142-210`) |
| Deleted | Nothing; idempotency via `InboxEvent` (`:72`) + unique `Booking_orderItemId_key` (`:355-367`) |
| Booking creation endpoint | **Does not exist** (`booking.controller.ts:130-134`; e2e asserts 404 — `booking-requested-consumer.e2e-spec.ts:377`) |
| UI | `OrderActionBar.tsx:20` “send” → `PATCH /orders/:id` (`orders/[id]/page.tsx:174`) |

### 3.3 Forward “feedback” Booking → Order is projection, not a stage move

`OrderSubscribers` (`order.subscribers.ts:36-45`) maps `BookingConfirmed/StatusChanged → PARTIALLY_FULFILLED/
FULFILLED` (`:156-161`, forward only, skips terminal Orders `:150`) and `BookingRejected → PROBLEM` (`:102-118`).
`BookingCancelled` has exactly one subscriber — voucher invalidation (`documents/invalidation.consumer.ts:31-48`)
— Order is deliberately not subscribed (`booking.subscribers.ts` comment near `:308`). This must not be
mistaken for `Booking → Order` as a backward stage transition: the Order was already in `SENT_TO_BOOKING`.

---

## 4. Backward transitions

Exhaustive search executed over `backend/src`, `frontend/`, `backend/test` — terms: `revert|rollback|reopen|
reactivat|deactivat|restore|undo|unconvert|backTo|returnTo|возврат|расконвер`, plus every `Request/Order` status
writer, `$executeRaw`/`updateMany` sites, action projections, i18n keys, and route inventories. All hits were
outside the commerce chain (storefront activate/deactivate, catalog ARCHIVED→ACTIVE, dashboard signal reopen,
money-refund comments, `jest.restoreAllMocks`).

### 4.1 Booking → existing Order — **NOT IMPLEMENTED**

- No route: booking controller exposes only `PATCH /bookings/:id` + reads (`booking.controller.ts:140-230`).
- `BookingAction` union (`booking.service.ts:13-26`) and `TRANSITIONS` (`:53-70`) contain no action that writes
  any Order field; `bookingAction` writes only `booking.*` (`:510-529`).
- Cancelling a Booking does not move the Order (`BookingCancelled` → documents consumer only).
- No writer takes an Order “backwards”: the only `order.updateMany` status sites are `order.subscribers.ts:102`
  (→PROBLEM), `:173` (→PARTIALLY_FULFILLED/FULFILLED, forward), and `order.service.ts:1453` (forward table).
- Anti-revival guard: `ORDER_TERMINAL_GUARD` (`booking.service.ts:80,479-489`) — «нельзя «ожить» бронь
  отменённого/закрытого заказа».
- No history action, no audit action, no UI control, no i18n label, no test exists for this leg.
- e2e proof of the wall: `booking-lifecycle-completion.e2e-spec.ts:342-344` — “reopen terminal → 409”.

### 4.2 Order → existing Request — **NOT IMPLEMENTED**

- No route: `request.controller.ts` ends at `:248-259` (`convert`); no revert/restore/undo handler.
- No status writer ever moves a Request out of `CONVERTED` (six writers enumerated in §2);
  `convertedOrderId` never cleared (writes: `null` at create `:260` / `supplier/tour-request.service.ts:114`,
  set once `:865`; other occurrences are read filters, e.g. `conversations.service.ts:676`).
- Pre-conversion actions are gated on status **and** on `convertedOrderId === null`
  (`request.service.ts:557,623,729,76-80,1019`), so even a hypothetical re-convert of the same Request is blocked.
- No code path creates a Request from an Order (all `createRequest` callers: `POST /requests`, guest checkout,
  supplier tour-request, Azal tooling — none takes an Order).
- `Order cancel` only sets Order `CANCELLED` + emits `OrderCancelled` (`order.service.ts:1528-1536`);
  the Request stays `CONVERTED`.
- No history/audit action, no UI control, no schema field (`revertedAt|returnedTo|originRequestId` — 0 hits).

### 4.3 Adjacent backward moves that DO exist (not stage reversals)

`resumeProcessing` (Order `WAITING_FOR_DATA → IN_PROCESSING`, `order.service.ts:103`), `resume`
(Booking `NEEDS_CLARIFICATION → SENT_TO_SUPPLIER`, `booking.service.ts:57`), `resolveChange`
(Booking `CHANGE_REQUESTED → CONFIRMED`, `:62`). All intra-stage. Note also the Order
`PROBLEM ⇄ SUSPENDED` pair has **no return path** to the main line (`order.service.ts:109-110`; only `cancel`
targets them) — a one-way exit within the stage, unrelated to cross-stage reversal.

Classification summary: **Booking → Order = NOT IMPLEMENTED; Order → Request = NOT IMPLEMENTED** (per §6,
reported, not invented).

---

## 5. Entity preservation matrix

| Transition | Previous entity preserved | Same entity on return | New entity created | Result |
|---|---:|---:|---:|---|
| Request → Order | YES | N/A | YES | **PASS** |
| Order → Booking | YES | N/A | YES | **PASS** |
| Booking → Order | YES (Order untouched; Booking rows persist) | NO — no return exists | NO | **FAIL** (transition absent) |
| Order → Request | YES (Request persists as `CONVERTED`) | NO — no return exists | NO | **FAIL** (transition absent) |

Notes:
- Forward rows: Request keeps its exact row/ID (in-place status change + link); Order is untouched by the
  Booking consumer. New entities are created exactly as designed (1 Order per conversion, 1 Booking per OrderItem).
- Backward rows: because no backward code runs at all, **no replacement entities can be created** — but the
  required “return of the same entity” also cannot happen. FAIL is due to absence, not to entity loss.

---

## 6. Round-trip result

Executed forward legs (existing e2e, this run — see §11):

```text
R1 --convert--> O1 --send + BookingRequested--> B1      ✅ EXECUTED (d3 test 1 passes:
                                                         accept → convert → Order facts → 1 Booking / 2 Passengers)
B1 --> O1  (return Booking to active Order)              ❌ IMPOSSIBLE — no endpoint/service/consumer (§4.1)
O1 --> R1  (return Order to active Request)              ❌ IMPOSSIBLE — no endpoint/service (§4.2)
```

- Same-entity guarantees on the forward legs (verified by green tests): duplicate `convert` replay → **200 with
  the same single Order, no O2** (`d3-request-flow` test 2; fast-path idempotency `request.service.ts:781-799`);
  Booking consumer idempotency (Inbox + unique `Booking_orderItemId_key`) → no B2 on redelivery
  (`booking-requested-consumer` tests 3/4/5 pass).
- `customerId`, `commerceSequence`, `REQ/ORD/BKG` codes are stable across the forward legs (§16).
- **Partial round-trip** `R1 → O1 → (B1) → O1` and `O1 → R1` alone are equally impossible.
- Verdict for §8: round-trip **NOT COMPLETABLE** — exactly two transitions missing: `Booking → Order`,
  `Order → Request`.

---

## 7. History / audit behavior

Per-entity append-only history with full transition facts (all FK-cascade to their parent):

| Model | Schema | Fields |
|---|---|---|
| `RequestHistory` | `schema.prisma:2444-2458` | `action, from, to, actorId, actorName, comment, createdAt` |
| `OrderHistory` | `:2320-2341` | + `source (API\|SYSTEM\|INTEGRATION\|…)` + `fields Json` |
| `BookingHistory` | `:2629-2644` | + `fields Json` |

Writers: Request conversion history `from: CUSTOMER_ACCEPTED → to: CONVERTED` with actor
(`request.service.ts:872-882`); every Order/Booking transition writes `from/to/actor/comment(reason)`
(`order.service.ts:1465-1476`, `booking.service.ts:519-529`); system projections recorded
(`order.subscribers.ts:110,182,271,352`; `booking.subscribers.ts:182-193,294-304`).

`AuditLog` (`schema.prisma:3059-3075`, sole writer `security.service.ts:330-361`): for this chain only
`request.created`, `request.customer_accepted`, `request.converted`, `checkout.guest_created` exist.
**No `order.*` / `booking.*` AuditLog actions exist** — Order/Booking transitions are audited exclusively via
their `*History` tables (actor/timestamp/reason present there). Reported as a gap (§13.3), not invented.

Backward-transition history: **none exists** (nothing to inspect — §4). Forward history is never erased:
history tables are append-only and cascade only when their own parent row is deleted (which never happens —
§12/§15).

---

## 8. Communication continuity

- Single canonical model `Communication` (`schema.prisma:2730-2785`) with typed, FK-less context reference
  `contextType + contextId` (`:2746-2747`; enum `CUSTOMER|PARTNER|ORDER|BOOKING|BUYER_REQUEST`, `:2704-2712`).
  (`Communication.requestId` at `:2777` is the Step 1.15 correlation id — **not** `order.Request.id`.)
- **No lifecycle method copies/duplicates/migrates communication rows.** All writes are single `create` sites
  (communication/whatsapp services); zero `createMany/delete/upsert` on `communication`; grep inside
  `modules/order|booking|sales|checkout` → 0 `communication.create`.
- Continuity is resolved **at read time**, not by copying: `conversations.service.ts:644-686` walks
  Booking → Order → Request → Customer live («НИЧЕГО не переписывает — читает на лету»), and the only update
  found re-points `contextType: null → CUSTOMER` on previously uncontexted rows (`:369-372`) without touching
  message rows.
- Therefore forward **and (future) backward** transitions cannot split the chain into separate histories —
  §10 requirement satisfied by design. Caveat (§13.7): a Communication created under `CUSTOMER` context is not
  re-anchored to `ORDER/BOOKING` afterwards; read-time resolution compensates.

---

## 9. Commerce ownership

- `Request.customerId String? // ref crm.Customer (no FK)` (`schema.prisma` in the Request block, indexed).
- Conversion copies it verbatim: `createOrderFromRequest` sets `customerId: r.customerId`
  (`order.service.ts:672`); checkout path validated (`:207-208`). **No phone is ever substituted for
  customerId** anywhere in the transition code.
- `Booking` has **no `customerId` column** — ownership is derived through `booking.orderId → Order.customerId`
  (and `linkedRequest`, `booking-query.service.ts:77-96`). Consistent across the chain.
- **Customer ≠ Traveler**: Traveler data lives in `OrderTraveler` (`schema.prisma:2285-2306`, passport PII,
  optional FK-less `customerId` at `:2289`) and `Passenger` (`:2612-2626`, explicitly documented as “НЕ
  заменяет OrderTraveler”, `:2610-2611`); `Customer` (`crm`, `CUS-*`, no passport/credentials) is a different
  schema/entity.
- **User ≠ Traveler**: `User` (`security`, `USR-*`, `passwordHash:2891`, `roleId FK Restrict:2894-2895`) links
  to Customer only via scope field `User.customerId` (`:2898-2899`).
- **Lifecycle code creates no Users from Travelers**: `user.create` exists only in security/auth modules
  (`security.service.ts:102,527`, `auth.service.ts:137,232`); zero hits under `modules/order|booking|checkout|sales`.
  Traveler data flows only traveler→traveler: Request placeholders → `OrderTraveler` (`order.service.ts:730-743`)
  → `Passenger` (`booking.subscribers.ts:199-212`, «НЕ из Customer»).

---

## 10. UI behavior

- **Lists are not “active-only”.** Requests/Orders/Bookings lists carry **no default status filter**
  (`requests/page.tsx:160,530`; `orders/page.tsx:110,643`; `bookings/page.tsx:158,517`; server side applies
  status only when `?status=` present — `request.service.ts:348-349`, `order.service.ts:823-828`,
  `booking.service.ts:209-215`). `CONVERTED` requests remain listed and filterable (badge + KPI,
  `i18n.tsx:648`). No archive flag exists for these three entities.
- **Detail pages are status-independent**: fetch by ID with `findUnique` and no status predicate
  (`requests/[id]/page.tsx:166`, `orders/[id]/page.tsx:123`, `bookings/[id]/page.tsx:142`;
  `request.service.ts:399`, `order.service.ts:1081-1090`, `booking-query.service.ts:33-43`). A converted
  Request, a sent-to-booking Order, and a Booking all remain directly reachable — “not in active list” is
  nowhere equivalent to “deleted”, and in fact nothing leaves any list by default.
- **Relation chain navigation exists**: `CommerceRelationChain.tsx:57-135` renders Request/Order/Booking links
  from server DTOs (`convertedOrder` on request page `:399-421`, `linkedRequest/linkedBooking` on order page
  `:310-316`, `linkedOrder/linkedRequest` on booking page `:315-321`); explicit disclaimer
  `CommerceRelationChain.tsx:16-20`: arrows are relation indicators, never a claim of a lifecycle transition.
- **Actions are forward-only and server-authoritative**: `RequestActionBar` 7 forward booleans
  (`:21-29`, `:69-75`), `OrderActionBar` 10 (`:15-26`), `BookingActionBar` 13 (`:14-32`) — all rendered from
  server `availableActions`. **No UI exists for Booking→Order or Order→Request** (no labels, no i18n keys,
  no path segments; guarded by `commerce-detail-system.spec.tsx:436-461`).

---

## 11. Existing test analysis (the five baseline-failing suites)

Current run (this gate), exact command and result:

```text
npx jest --config test/jest-e2e.json --runInBand
  "d3-request-flow|order-lifecycle-completion|booking-lifecycle-completion|order-creation-consumer|booking-requested-consumer"
→ Test Suites: 5 failed / Tests: 19 failed, 90 passed, 109 total (102.6 s)
```

**Identical to baseline**: M4 report §14 documents 34 failing tests across 7 suites at `0d7de62`; these five
suites account for exactly 19 of them (the other 15 = `checkout-commercial-intent` 14 + `auth-rbac` 1, out of
scope for this gate). Failing line numbers match the baseline exactly.

| Suite (tests) | Failed | Failing test (exact title from run) | Root cause |
|---|---:|---|---|
| `d3-request-flow` (4) | 1 | “3. NEW / legacy accepted (без D3 snapshot) → conversion denied; **accept без Product → 400**” — got **201** (`:448`) | **Stale contract**: product-less `customerAccept` became legal by design in `f68a1a5` (`request.service.ts:630-651`, product-less = no-op pin). Not a lifecycle defect — convert still requires the D3 snapshot (`request.service.ts:80`). |
| `order-lifecycle-completion` (32) | 2 | “1. канонический Order стартует в NEW…” (`:221`), “29. availability isolation…” (`:637`) — both fail in `createProduct` helper `.expect(201)` (`:115`) → **403** | Fixture: platform ADMIN creates ownerless Product → Step 3.6B rule `catalog.service.ts:241-248` forbids it. Environmental. |
| `booking-lifecycle-completion` (45+) | 1 | “32. availability isolation…” (`:760`) → `createProduct` `.expect(201)` (`:102`) → **403** | Same fixture 403. |
| `order-creation-consumer` (14) | 14 | tests 1, 1b, 2, 3, 4, 5, 6, 7, 7b, 7c, 8, 9, 10, 11 — every test opens with `createProduct` (`:89-101` style helper) → **403** | Same fixture 403; zero lifecycle assertions reached. |
| `booking-requested-consumer` (14) | 1 | “1. canonical Order → send → ровно…” (`:158`) → `createProduct` `.expect(201)` (`:89`) → **403** | Same fixture 403; tests 2–14 use direct fixtures and pass. |
| **Total** | **19** | 18 × fixture-403 + 1 × stale-contract | |

**LIFECYCLE GAP failures: 0.** No failing assertion reveals a missing forward or backward lifecycle capability
— 18 failures occur before any lifecycle assertion executes, and the 19th is a deliberately-changed product-less
rule. Root causes (2) are both environmental/staleness, matching M4 §14 and the RBAC audit’s “test-fixture
staleness” classification.

**Coverage that proves the forward chain (90 passing tests include):** d3 tests 1/2/4 (convert + idempotent
single-Order + RBAC), 30/32 order-lifecycle (full forward machine + terminal guards), 44/45 booking-lifecycle
(forward machine + M1–M8 forward event reconcile `:990-1172`), 13/14 booking-requested (creation, cardinality,
redelivery). **Zero tests anywhere exercise a backward cross-entity transition** — consistent with §4.

---

## 12. Database relation analysis

Critical question: *could deleting/replacing a current-stage entity cascade-delete a historical stage?*

**NO — cascade-deletion of a historical stage is impossible with the current schema:**

| Direction | Mechanism | Consequence |
|---|---|---|
| Delete Request | Only cascade child is `RequestHistory` (`schema:2447`, `ON DELETE CASCADE` in `20260901000000:73-74`). Request has **zero outbound FKs**. | Order/Booking untouched. |
| Delete Order | Cascade children: `OrderItem:2270`, `OrderTraveler:2288`, `Fulfillment:2311`, `OrderHistory:2323` (`init:513-522`). `Request.convertedOrderId` is plain TEXT (no REFERENCES). `Booking.orderId` is plain TEXT + index only (`init:317,471`). | Request survives (would merely dangle); Bookings survive (orphaned, not deleted). |
| Delete Booking | Cascade children: `Reservation:2588`, `SupplierConfirmation:2600`, `Passenger:2615`, `BookingHistory:2632` (`init:525-534`). | Order untouched (no FK anywhere on the pair). |
| Triggers / rules / ON DELETE rules on the chain | Repo-wide grep over 99 migrations: **0** `CREATE TRIGGER/FUNCTION`; no `DROP TABLE` on commerce tables (1 hit, unrelated geo domain). | Nothing else can fire. |
| Application delete paths | `@Delete` grep over `modules/order|booking|finance` → **0**. Only perf teardown `src/perf/lib/seed.ts:575`. Compensation (cancel) is used instead of deletion by design. | Entities are never deleted in production flows at all. |

Residual (non-cascade) risks reported honestly:
- **Orphaning, not cascade-deletion**: FK-less links mean a hypothetical manual `DELETE` of an Order would
  strand Bookings/Payments/Commissions and leave `Request.convertedOrderId` dangling. The repo already knows
  this: integrity check “Request convertedOrderId points to missing Order”
  (`prisma/reset-and-reseed.ts:221-223`) exists precisely because the DB cannot enforce it.
- **No uniqueness on `Request.convertedOrderId`** (`schema:2422` + migration `20260901000000:45-47` create only
  `code/commerceSequence/referenceNumber` unique indexes): two Requests could legally point at one Order.
- Pre-existing schema/DB drift (not lifecycle-scoped): `Order.referenceNumber`/`Booking.referenceNumber` are
  `@unique` non-null in schema (`:2137`, `:2515`) but were created nullable (`20260831210000:17,21`) with no
  later `SET NOT NULL`.

---

## 13. Gaps

**Verdict-defining (block LIFECYCLE PASS):**

1. **`Booking → Order` NOT IMPLEMENTED** (§4.1) — no endpoint, service transition, event, history action,
   audit action, UI control, or test.
2. **`Order → Request` NOT IMPLEMENTED** (§4.2) — Request is permanently `CONVERTED`; `convertedOrderId` is
   never cleared; no route exists; no UI control; no test.

**Non-critical gaps (would belong to “PASS WITH GAPS” if the two above existed):**

3. `AuditLog` has **no `order.*` / `booking.*` lifecycle actions** — Order/Booking transitions are audited only
   in `OrderHistory`/`BookingHistory` (actor/timestamp/reason present; centralized audit absent).
4. No uniqueness on `Request.convertedOrderId` (§12); no cross-stage referential integrity (FK-less by design —
   enforced only by app code + reset-and-reseed integrity check).
5. Order `PROBLEM ⇄ SUSPENDED` dead-end: no transition returns these to `IN_PROCESSING`/`SENT_TO_BOOKING`
   (`order.service.ts:108-110`) — one-way exit inside the stage.
6. No test coverage for backward transitions anywhere (consistent with implementation; becomes relevant only
   if gap 1/2 are implemented).
7. Communication context is not re-anchored on stage change (`contextType` stays as created; read-time
   resolver compensates — §8).
8. Baseline test staleness: d3 “product-less accept → 400” contract (now 201 by design) + 18 fixture-403
   failures (Step 3.6B) — pre-existing, environmental, **not** lifecycle gaps (§11).
9. Pre-existing schema/DB nullability drift on `referenceNumber` (§12) — not lifecycle-scoped.

No `LIFECYCLE GAP` was classified among the five baseline failures (§14 of the prompt): none of them reveals the
bidirectional lifecycle “actually missing in a test-detected way” — the missing legs were found by code
inspection (§4), which is stronger evidence than any failing test could give.

---

## 14. Minimum required next action

**Owner decision required — one of:**

- **(A) Implement the two backward transitions** (smallest honest increment, no schema change required):
  1. `Order → Request`: an explicit, permissioned action that (i) moves the same Order out of the main line or
     marks it returned, (ii) returns the **same** Request row to an active status and re-opens its action
     projection (today hard-blocked by `convertedOrderId === null` gates), (iii) writes `RequestHistory` +
     `OrderHistory` (`from/to/actor/comment`) and an `AuditLog` action, (iv) never creates a second Request/Order,
     never renumbers, never touches `customerId`, (v) has UI action buttons driven by the server projection,
     (vi) is covered by a round-trip e2e asserting IDs `R1/O1/B1` stay identical.
  2. `Booking → Order`: reactivate the same Order from the Booking stage without violating the forward event
     reconcile (`order.subscribers.ts:142-210`) or the `ORDER_TERMINAL_GUARD` semantics — this one needs an
     explicit design pass (which Booking statuses allow return; how `BookingCancelled`/`fulfilled` projections
     are compensated) before coding.
- **(B) Formally redefine the lifecycle as forward-only** and amend the gate/§1–§3 requirement accordingly
  (the current implementation is internally consistent, well-guarded, and history-preserving as a one-way
  chain).

Recommended order: decide (B) vs (A) first; if (A), start with `Order → Request` (smaller blast radius),
then design `Booking → Order`.

---

## Evidence appendix (commands run this gate)

```text
# code inspection (read-only): backend/src modules order/booking, schema.prisma,
# migrations, frontend components/pages, M4-IMPLEMENTATION-REPORT.md — file:line cited throughout

npx jest --config test/jest-e2e.json --runInBand "d3-request-flow|order-lifecycle-completion|
  booking-lifecycle-completion|order-creation-consumer|booking-requested-consumer"
→ exit 1; 5/5 suites failed; Tests: 19 failed, 90 passed, 109 total; 102.6 s
→ failure lines: d3:448 | order-lifecycle:221,637 | booking-lifecycle:760 |
  order-creation-consumer:275,372,406,429,448,481,511,527,… (all) | booking-requested:158
→ matches M4 report baseline (34 across 7 suites incl. out-of-scope checkout 14 + auth-rbac 1 = 19 + 15)
```

No files were modified; nothing committed; nothing pushed.

**Stopping here per §21 — the project owner decides the next stage.**
