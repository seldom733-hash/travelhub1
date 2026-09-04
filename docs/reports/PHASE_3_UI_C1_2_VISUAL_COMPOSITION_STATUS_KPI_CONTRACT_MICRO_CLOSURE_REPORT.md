# UI-C1.2 — VISUAL COMPOSITION & STATUS KPI CONTRACT — MICRO-CLOSURE REPORT

**Stage:** Design / architecture micro-closure only. **No production implementation.**

---

## 1. Executive Summary

This micro-closure closes the two P0 gaps left by the UI-C1.2 Operations Center design reconciliation:

1. **Canonical visual page composition** — the binding vertical grammar for all four Operations Center tabs, replacing the underspecified `ACTIVE DOMAIN KPI AREA` with explicit wireframes (Requests, Orders, Bookings, Payments).
2. **All-statuses-visible rule** — `EVERY ACTUAL CANONICAL STATUS → ONE VISIBLE STATUS KPI CARD` for Requests (12), Orders lifecycle (12), OrderPayment (4), Bookings (13), Payment (6), Refund (4).

Decisions are locked as **ADR-OPS-014** (canonical visual composition) and **ADR-OPS-015** (all canonical statuses require visible KPI cards). The previous UI-C1.2 contract's contradictory language (Booking C1 6-KPI "filter-only" statuses, Payment AUTHORIZED/REFUNDED "filter-only", Order READY_TO_CLOSE/PARTIALLY_FULFILLED folding) is explicitly marked **SUPERSEDED FOR OPERATIONS CENTER VISUAL PRESENTATION**.

Two truthfulness findings surfaced by the status-coverage audit:

- `BookingStatus.AWAITING_CONFIRMATION` has **no producer** in the current state machine (source comment `booking.service.ts` L33: "резервный код без producer-а … как READY_TO_CLOSE в Order") — it gets a visible card but **no incoming arrow** in the flow.
- `OrderStatus.READY_TO_CLOSE` likewise has no entry transition — visible card, no arrow.

Both findings are documented, not hidden, and both statuses remain fully visible per ADR-OPS-015.

---

## 2. Baseline / Checkpoint

```text
UI-C1.2 — Operations Center Architecture & Design Reconciliation
checkpoint SHA:
07f85578b645a77c743d9898597fcf16bfb2a736

ARCHITECTURE / ROUTING / PAYMENTS DOMAIN / SECURITY — QUALIFIED
VISUAL PAGE COMPOSITION — INCOMPLETE        ← closed here
ALL-STATUS KPI CONTRACT — INCOMPLETE        ← closed here
UI-C1.2 OVERALL — ACCEPTED AFTER THIS MICRO-CLOSURE
```

Non-reopened baselines:

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED AFTER R3
```

Preserved UI-C1.2 decisions:

```text
ONE OPERATIONS CENTER ≠ ONE GIANT PAGE
SHARED SHELL ≠ IDENTICAL BUSINESS SEMANTICS
DOMAIN OWNERSHIP ≠ WORKFLOW CONTEXT
PAYMENTS = FINANCE-OWNED OPERATIONAL CAPABILITY + OPERATIONS CENTER TAB

Canonical tabs:  [ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]
Sidebar:         ОПЕРАЦИИ (Заявки/Заказы/Бронирования) + ФИНАНСЫ (Платежи)
Routes:          /app/requests /app/orders /app/bookings /app/payments
UI-C2 — NOT STARTED
D8   — NOT STARTED
```

---

## 3. Reason for Micro-Closure

The UI-C1.2 contract correctly fixed architecture, routing, Payments ownership, semantic grouping, filters, server authority and phasing — but described the page body as `ACTIVE DOMAIN KPI AREA`, leaving implementation freedom. Given the UI-C1.1 R1/R2 regressions (visual-system drift between the three detail pages), visual composition must be as binding as routing or RBAC:

```text
VISUAL COMPOSITION IS PART OF THE ARCHITECTURE CONTRACT,
NOT AN IMPLEMENTATION DETAIL.
```

Additionally, the accepted C1 Booking 6-KPI contract left 7 statuses "filter-only"; under the new rule that is void for Operations Center presentation.

---

## 4. Canonical Global Page Composition

Binding vertical grammar for all four registry tabs (**ADR-OPS-014**):

```text
┌──────────────────────────────────────────────────────────────┐
│ BREADCRUMBS / PAGE CONTEXT                                  │
│ ЦЕНТР ОПЕРАЦИЙ                         PERIOD / ACTIONS      │
│                                                              │
│ [ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]          │
├──────────────────────────────────────────────────────────────┤
│ TOTAL KPI                                                    │
├──────────────────────────────────────────────────────────────┤
│ PRIMARY STATUS / LIFECYCLE KPI GROUP                        │
├──────────────────────────────────────────────────────────────┤
│ SECONDARY / EXCEPTION KPI GROUP — where applicable          │
├──────────────────────────────────────────────────────────────┤
│ PAYMENT / REFUND KPI GROUP — where applicable               │
├──────────────────────────────────────────────────────────────┤
│ ATTENTION — where actionable conditions exist               │
├──────────────────────────────────────────────────────────────┤
│ SEARCH | FILTERS | DATE SCOPE | RESET | EXPORT              │
├──────────────────────────────────────────────────────────────┤
│ RESULT / SELECTION SUMMARY — if applicable                  │
│ REGISTRY TABLE                                               │
├──────────────────────────────────────────────────────────────┤
│ PAGINATION                                                   │
└──────────────────────────────────────────────────────────────┘
```

Canonical rule:

> **Vertical section order is binding. Responsive wrapping is allowed, but implementation may not arbitrarily reorder, merge, flatten or omit semantic zones without a new approved design decision.**

- A zone genuinely not applicable to a domain may be absent.
- **No empty decorative zones** created merely for symmetry.

---

## 5. Total KPI Contract

Total KPI is a **separate aggregate card** (never full-width — no regression to a full-width hero):

```text
Requests → Всего заявок
Orders   → Всего заказов
Bookings → Всего бронирований
Payments → Всего платежей   (follows the actual payment aggregate chosen by the
                             accepted UI-C1.2 Payments domain contract — Payment records)
```

Visual contract (binding):

```text
TOTAL CARD
- not full-width
- approximately 15–20% larger than ordinary status KPI
- slightly larger label typography
- slightly larger value typography
- same border/radius/color family as ordinary cards
- same interaction language (click → clear status dimension filter → page=1 → server query)
```

---

## 6. Status KPI Contract

**P0 canonical rule (ADR-OPS-015):**

```text
EVERY ACTUAL CANONICAL STATUS
→ ONE VISIBLE STATUS KPI CARD
```

Applies to:

```text
Requests               → 12 actual RequestStatus values
Orders (lifecycle)     → 12 actual OrderStatus values
Orders (payment)       → 4 actual OrderPaymentStatus values
Bookings               → 13 actual BookingStatus values
Payments               → 6 actual PaymentStatus values
Refunds                → 4 actual RefundStatus values (separate dimension)
```

- A status must **NOT** become `filter-only` merely because an older KPI contract aggregated it into another metric.
- Status KPI cards may be organized into semantic groups (flow / exception / payment / attention-group placement), but may **not** be hidden solely to preserve an older compact KPI set.
- Localized labels: one canonical label per status, reused across KPI card / filter / table badge / detail badge / Help / export (§32 of the main contract; i18n keys listed in the coverage matrices).
- Counts: server-side, same scope as the table (§22 of this report). No client-side counting.

---

## 7. Aggregate vs Status KPI

```text
STATUS KPI   = count for one actual canonical status
AGGREGATE KPI = count combining multiple statuses or a derived business condition
```

- Both may coexist.
- **Aggregate KPI does NOT replace status cards.**

```text
Example (Bookings):
[ SENT_TO_SUPPLIER ]        ← status card (visible)
[ AWAITING_CONFIRMATION ]   ← status card (visible)
…and optionally…
[ Ожидают подтверждения ]   ← aggregate of both (Help/summary/analytics — NOT a replacement)
```

- If duplicate information would overload the page, aggregate metrics may be moved to Attention, summary, Help or analytics — **the canonical status cards remain visible in the Operations Center** unless a later approved ADR explicitly changes this rule.
- Aggregate-overlap semantics are documented per domain in §16 (matrix).

---

## 8. Requests Canonical Wireframe

```text
ЦЕНТР ОПЕРАЦИЙ
[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]

[ Всего заявок ]

СТАТУСЫ ЗАЯВОК  (all 12 actual RequestStatus values; canonical order = enum
declaration order: NEW, CHECKING, SUPPLIER_TIMEOUT, PRICE_CHANGED,
CUSTOMER_ACCEPTED, CONFIRMED, CONVERTED, REJECTED, UNAVAILABLE, EXPIRED,
CUSTOMER_PAYMENT_TIMEOUT, CANCELLED_BY_CUSTOMER)
[ NEW ] [ CHECKING ] [ SUPPLIER_TIMEOUT ] [ PRICE_CHANGED ]
[ CUSTOMER_ACCEPTED ] [ CONFIRMED ] [ CONVERTED ] [ REJECTED ]
[ UNAVAILABLE ] [ EXPIRED ] [ CUSTOMER_PAYMENT_TIMEOUT ] [ CANCELLED_BY_CUSTOMER ]

ТРЕБУЕТ ВНИМАНИЯ  (actionable queue — server-authoritative conditions only;
may reference a status/subset, but is an action queue, not the status overview)
[ Ожидают решения поставщика: CHECKING beyond SLA ]
[ Ожидают решения клиента: PRICE_CHANGED / CUSTOMER_ACCEPTED beyond TTL ]
[ Таймауты: SUPPLIER_TIMEOUT | CUSTOMER_PAYMENT_TIMEOUT | EXPIRED ]

[ Search ]
[ Status ]
[ Additional filters (customerId / partnerId — backend-supported) ]
[ Date type / From / To — ONLY when KPI/table scope parity exists (UI-C1.2E); hidden until then ]
[ Reset ]
[ CSV ][ XLSX ]

TABLE  (ref / customer / product / supplier / Цена витрины / Подтв. цена / service date / status / created / SLA)

PAGINATION
```

Requirements:

- All 12 actual statuses visible; status order documented (enum declaration order above).
- Attention is separate from the status overview.
- Attention may reference a status/subset, but only as an actionable queue.
- **Period must not be exposed while the KPI endpoint remains globally scoped** (KPI↔table parity prerequisite, §22 of this report; UI-C1.2E).

---

## 9. Requests Status Coverage Matrix

| Canonical status | Visible KPI card | KPI group | Localized label source | Click filter | Help ID |
|---|---|---|---|---|---|
| NEW | **YES** | СТАТУСЫ ЗАЯВОК | `requests.kpi.new` | `status=NEW` | `requests.new` |
| CHECKING | **YES** | СТАТУСЫ ЗАЯВОК | `requests.kpi.checking` | `status=CHECKING` | `requests.checking` |
| SUPPLIER_TIMEOUT | **YES** | СТАТУСЫ ЗАЯВОК (+attention ref) | `requests.kpi.supplier_timeout` | `status=SUPPLIER_TIMEOUT` | `requests.supplierTimeout` |
| PRICE_CHANGED | **YES** | СТАТУСЫ ЗАЯВОК (+attention ref) | `requests.kpi.price_changed` | `status=PRICE_CHANGED` | `requests.priceChanged` |
| CUSTOMER_ACCEPTED | **YES** | СТАТУСЫ ЗАЯВОК (+attention ref) | `requests.kpi.customer_accepted` | `status=CUSTOMER_ACCEPTED` | `requests.customerAccepted` |
| CONFIRMED | **YES** | СТАТУСЫ ЗАЯВОК | `requests.kpi.confirmed` | `status=CONFIRMED` | `requests.confirmed` |
| CONVERTED | **YES** | СТАТУСЫ ЗАЯВОК | `requests.kpi.converted` | `status=CONVERTED` | `requests.converted` |
| REJECTED | **YES** | СТАТУСЫ ЗАЯВОК | `requests.kpi.rejected` | `status=REJECTED` | `requests.rejected` |
| UNAVAILABLE | **YES** | СТАТУСЫ ЗАЯВОК | `requests.kpi.unavailable` | `status=UNAVAILABLE` | `requests.unavailable` |
| EXPIRED | **YES** | СТАТУСЫ ЗАЯВОК (+attention ref) | `requests.kpi.expired` | `status=EXPIRED` | `requests.expired` |
| CUSTOMER_PAYMENT_TIMEOUT | **YES** | СТАТУСЫ ЗАЯВОК (+attention ref) | `requests.kpi.customer_payment_timeout` | `status=CUSTOMER_PAYMENT_TIMEOUT` | `requests.customerPaymentTimeout` |
| CANCELLED_BY_CUSTOMER | **YES** | СТАТУСЫ ЗАЯВОК | `requests.kpi.cancelled_by_customer` | `status=CANCELLED_BY_CUSTOMER` | `requests.cancelledByCustomer` |

Coverage: **12/12 visible** — no Request status is filter-only.

---

## 10. Orders Canonical Wireframe

```text
ЦЕНТР ОПЕРАЦИЙ
[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]

[ Всего заказов ]

ЖИЗНЕННЫЙ ЦИКЛ ЗАКАЗА  (happy-path flow — arrows only along truthful transitions)
[ NEW ] → [ IN_PROCESSING ] → [ READY_FOR_BOOKING ] → [ SENT_TO_BOOKING ] → [ FULFILLED ] → [ CLOSED ]

АЛЬТЕРНАТИВНЫЕ / РЕВОРК / ТЕРМИНАЛЬНО-СМЕЖНЫЕ  (visible cards, NO arrows)
[ WAITING_FOR_DATA ]  ⇄ rework loop attached to IN_PROCESSING (no arrow chain)
[ PARTIALLY_FULFILLED ]   alternate fulfillment, adjacent to FULFILLED (no arrow)
[ READY_TO_CLOSE ]        terminal-adjacent, adjacent to CLOSED (no arrow)

ПРОБЛЕМНЫЕ / EXCEPTION
[ PROBLEM ] [ SUSPENDED ] [ CANCELLED ]

СТАТУСЫ ОПЛАТЫ  (separate dimension — all 4 actual OrderPaymentStatus values)
[ UNPAID ] [ PARTIALLY_PAID ] [ PAID ] [ REFUNDED ]

СТАТУСЫ ВОЗВРАТОВ  (separate dimension — all 4 actual RefundStatus values;
backend refund aggregates by order staged in UI-C1.2E)
[ REQUESTED ] [ APPROVED ] [ PROCESSED ] [ FAILED ]

ТРЕБУЕТ ВНИМАНИЯ
[ FAILED payments: paymentFailed=true ]
[ Pending refunds: pendingRefund=true ]
[ Recent cancellations: cancelledWithin=N ]

[ Search ]
[ Lifecycle status ]
[ Payment status ]
[ Additional filters (sellerPartnerId / customerId — backend-supported) ]
[ Date scope (createdAt, half-open) ]
[ Reset ]
[ CSV ][ XLSX ]

TABLE  (ref / date / amount / items / lifecycle status / payment status / conditional detector columns)

PAGINATION
```

Truthfulness rules (§9 of this prompt, bound here):

- Arrows exist **only** on the happy path: `NEW → IN_PROCESSING → READY_FOR_BOOKING → SENT_TO_BOOKING → FULFILLED → CLOSED`.
- `WAITING_FOR_DATA`, `PARTIALLY_FULFILLED`, `READY_TO_CLOSE`, `PROBLEM`, `SUSPENDED`, `CANCELLED` are **visible cards** without arrow chains.
- All 12 lifecycle statuses + 4 payment statuses + 4 refund statuses are visible somewhere in the composition.

---

## 11. Order State-Machine Classification

Actual `OrderStatus` (12) and transitions (D5 authority; `order.service.ts TRANSITIONS`):

| Status | Class | Arrow? | Notes |
|---|---|---|---|
| NEW | Happy path (start) | → | |
| IN_PROCESSING | Happy path | → | also rework target |
| WAITING_FOR_DATA | Rework loop (reversible) | no arrow | `IN_PROCESSING ⇄ WAITING_FOR_DATA` |
| READY_FOR_BOOKING | Happy path | → | |
| SENT_TO_BOOKING | Happy path | → | |
| PARTIALLY_FULFILLED | Alternate fulfillment | no arrow | visible card next to FULFILLED |
| FULFILLED | Happy path | → | |
| READY_TO_CLOSE | Terminal-adjacent | no arrow | **no entry transition today** (visible card; truthful 0/legacy handling) |
| CLOSED | Terminal | — | |
| CANCELLED | Terminal exception | no arrow | |
| PROBLEM | Exception | no arrow | from any ACTIVE |
| SUSPENDED | Exception | no arrow | from any ACTIVE |

No arrow implies a transition the machine does not support. All 12 statuses have visible cards (ADR-OPS-015).

---

## 12. Orders Status Coverage Matrix

### 12.1 Lifecycle (OrderStatus — 12/12 visible)

| Canonical status | Visible KPI card | KPI group | Localized label source | Click filter | Help ID |
|---|---|---|---|---|---|
| NEW | **YES** | ЖИЗНЕННЫЙ ЦИКЛ (flow) | `order.status.NEW` | `status=NEW` | `orders.lifecycle.NEW` |
| IN_PROCESSING | **YES** | ЖИЗНЕННЫЙ ЦИКЛ (flow) | `order.status.IN_PROCESSING` | `status=IN_PROCESSING` | `orders.lifecycle.IN_PROCESSING` |
| WAITING_FOR_DATA | **YES** | rework (no arrow) | `order.status.WAITING_FOR_DATA` | `status=WAITING_FOR_DATA` | `orders.lifecycle.WAITING_FOR_DATA` |
| READY_FOR_BOOKING | **YES** | ЖИЗНЕННЫЙ ЦИКЛ (flow) | `order.status.READY_FOR_BOOKING` | `status=READY_FOR_BOOKING` | `orders.lifecycle.READY_FOR_BOOKING` |
| SENT_TO_BOOKING | **YES** | ЖИЗНЕННЫЙ ЦИКЛ (flow) | `order.status.SENT_TO_BOOKING` | `status=SENT_TO_BOOKING` | `orders.lifecycle.SENT_TO_BOOKING` |
| PARTIALLY_FULFILLED | **YES** | alternate fulfillment (no arrow) | `order.status.PARTIALLY_FULFILLED` | `status=PARTIALLY_FULFILLED` | `orders.lifecycle.PARTIALLY_FULFILLED` |
| FULFILLED | **YES** | ЖИЗНЕННЫЙ ЦИКЛ (flow) | `order.status.FULFILLED` | `status=FULFILLED` | `orders.lifecycle.FULFILLED` |
| READY_TO_CLOSE | **YES** | terminal-adjacent (no arrow) | `order.status.READY_TO_CLOSE` | `status=READY_TO_CLOSE` | `orders.lifecycle.READY_TO_CLOSE` |
| CLOSED | **YES** | ЖИЗНЕННЫЙ ЦИКЛ (flow, terminal) | `order.status.CLOSED` | `status=CLOSED` | `orders.lifecycle.CLOSED` |
| CANCELLED | **YES** | ПРОБЛЕМНЫЕ/EXCEPTION (terminal exception) | `order.status.CANCELLED` | `status=CANCELLED` | `orders.lifecycle.CANCELLED` |
| PROBLEM | **YES** | ПРОБЛЕМНЫЕ/EXCEPTION | `order.status.PROBLEM` | `status=PROBLEM` | `orders.lifecycle.PROBLEM` |
| SUSPENDED | **YES** | ПРОБЛЕМНЫЕ/EXCEPTION | `order.status.SUSPENDED` | `status=SUSPENDED` | `orders.lifecycle.SUSPENDED` |

### 12.2 Payment (OrderPaymentStatus — 4/4 visible)

| Canonical status | Visible KPI card | KPI group | Localized label source | Click filter | Help ID |
|---|---|---|---|---|---|
| UNPAID | **YES** | СТАТУСЫ ОПЛАТЫ | `order.payment.UNPAID` | `paymentStatus=UNPAID` | `orders.payment.UNPAID` |
| PARTIALLY_PAID | **YES** | СТАТУСЫ ОПЛАТЫ | `order.payment.PARTIALLY_PAID` | `paymentStatus=PARTIALLY_PAID` | `orders.payment.PARTIALLY_PAID` |
| PAID | **YES** | СТАТУСЫ ОПЛАТЫ | `order.payment.PAID` | `paymentStatus=PAID` | `orders.payment.PAID` |
| REFUNDED | **YES** | СТАТУСЫ ОПЛАТЫ | `order.payment.REFUNDED` | `paymentStatus=REFUNDED` | `orders.payment.REFUNDED` |

### 12.3 Refund (RefundStatus — 4/4 visible on Orders)

| Canonical status | Visible KPI card | KPI group | Localized label source | Click filter | Help ID |
|---|---|---|---|---|---|
| REQUESTED | **YES** | СТАТУСЫ ВОЗВРАТОВ | `status.refund.REQUESTED` (new i18n key) | refund-state filter (UI-C1.2E backend) | `orders.refund.REQUESTED` |
| APPROVED | **YES** | СТАТУСЫ ВОЗВРАТОВ | `status.refund.APPROVED` (new) | refund-state filter (UI-C1.2E) | `orders.refund.APPROVED` |
| PROCESSED | **YES** | СТАТУСЫ ВОЗВРАТОВ | `status.refund.PROCESSED` (new) | refund-state filter (UI-C1.2E) | `orders.refund.PROCESSED` |
| FAILED | **YES** | СТАТУСЫ ВОЗВРАТОВ | `status.refund.FAILED` (new) | refund-state filter (UI-C1.2E) | `orders.refund.FAILED` |

> Refund status is a real separate status dimension (`RefundStatus`, finance.Refund with `orderId`). The Orders-tab refund group requires **backend refund aggregates by order** (staged UI-C1.2E); until then the group renders with the `pendingRefund` attention detector available today. The primary refund surface is the Payments tab.

Coverage: **Orders lifecycle 12/12, OrderPayment 4/4, Refund 4/4 visible.**

---

## 13. Orders Payment/Refund Coverage

Bound dimensions (never collapsed):

```text
ORDER LIFECYCLE ≠ PAYMENT STATUS ≠ REFUND STATUS
```

- Payment status (`OrderPaymentStatus`) and refund status (`RefundStatus`) are separate KPI groups with their own cards (§12.2/§12.3).
- **Not converted into fake statuses:** payment method (free-text), refund amount, due amount, refundable amount — these are metadata/derived money facts (D7 authority), never status KPI cards.

---

## 14. Bookings Canonical Wireframe

```text
ЦЕНТР ОПЕРАЦИЙ
[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]

[ Всего бронирований ]

ОСНОВНОЙ ЖИЗНЕННЫЙ ЦИКЛ  (happy path — arrows only along real transitions)
[ NEW ] → [ PREPARING_REQUEST ] → [ SENT_TO_SUPPLIER ]
[ AWAITING_CONFIRMATION ]   ← visible card, adjacent, NO arrow (no producer —
                              legacy source for confirm/reject; booking.service.ts L33)
[ CONFIRMED ] → [ IN_SERVICE ] → [ COMPLETED ]

ИЗМЕНЕНИЯ / ТРЕБУЮТ РЕШЕНИЯ  (visible cards, NO arrows)
[ NEEDS_CLARIFICATION ]
[ CHANGE_REQUESTED ]
[ CANCELLATION_REQUESTED ]
[ PROBLEM ]

ТЕРМИНАЛЬНЫЕ ИСКЛЮЧЕНИЯ  (visible cards, NO arrows)
[ SUPPLIER_REJECTED ]
[ CANCELLED ]

ТРЕБУЕТ ВНИМАНИЯ  (server-authoritative actionable subsets only)
[ Ожидают поставщика: AWAITING_CONFIRMATION overdue (overdue=true, SLA) ]
[ Предстоящие услуги: CONFIRMED/NEW with serviceDate ≥ now (upcoming=true) ]
[ Требуют решения: NEEDS_CLARIFICATION | CHANGE_REQUESTED | CANCELLATION_REQUESTED | PROBLEM ]

[ Search ]
[ Status ]
[ Additional filters (orderId — backend-supported) ]
[ Date scope (createdAt, half-open) ]
[ Reset ]
[ CSV ][ XLSX ]

TABLE  (ref / date / order / amount / passengers / status / conditional serviceDate & waiting columns)

PAGINATION
```

Flow truthfulness (§13 of this prompt, bound here):

- Happy path arrows: `NEW → PREPARING_REQUEST → SENT_TO_SUPPLIER`, `CONFIRMED → IN_SERVICE → COMPLETED` (real transitions: prepare, send, confirm, service, complete).
- **No arrow** into/out of NEEDS_CLARIFICATION / CHANGE_REQUESTED / CANCELLATION_REQUESTED / PROBLEM / SUPPLIER_REJECTED / CANCELLED and **no arrow into AWAITING_CONFIRMATION** (no producer) — the flow communicates business progression, not a decorative sequence.
- **All 13 statuses have visible cards** (ADR-OPS-015).

---

## 15. Booking 13-Status Coverage Matrix

| Canonical status | Visible KPI card | KPI group | Localized label source | Click filter | Help ID |
|---|---|---|---|---|---|
| NEW | **YES** | ОСНОВНОЙ ЖИЗНЕННЫЙ ЦИКЛ (flow) | `booking.status.NEW` | `status=NEW` | `bookings.NEW` |
| PREPARING_REQUEST | **YES** | ОСНОВНОЙ ЖИЗНЕННЫЙ ЦИКЛ (flow) | `booking.status.PREPARING_REQUEST` | `status=PREPARING_REQUEST` | `bookings.PREPARING_REQUEST` |
| SENT_TO_SUPPLIER | **YES** | ОСНОВНОЙ ЖИЗНЕННЫЙ ЦИКЛ (flow) | `booking.status.SENT_TO_SUPPLIER` | `status=SENT_TO_SUPPLIER` | `bookings.SENT_TO_SUPPLIER` |
| AWAITING_CONFIRMATION | **YES** | ОСНОВНОЙ ЖИЗНЕННЫЙ ЦИКЛ (adjacent, NO arrow — no producer) | `booking.status.AWAITING_CONFIRMATION` | `status=AWAITING_CONFIRMATION` | `bookings.AWAITING_CONFIRMATION` |
| CONFIRMED | **YES** | ОСНОВНОЙ ЖИЗНЕННЫЙ ЦИКЛ (flow) | `booking.status.CONFIRMED` | `status=CONFIRMED` | `bookings.CONFIRMED` |
| IN_SERVICE | **YES** | ОСНОВНОЙ ЖИЗНЕННЫЙ ЦИКЛ (flow) | `booking.status.IN_SERVICE` | `status=IN_SERVICE` | `bookings.IN_SERVICE` |
| COMPLETED | **YES** | ОСНОВНОЙ ЖИЗНЕННЫЙ ЦИКЛ (flow, terminal) | `booking.status.COMPLETED` | `status=COMPLETED` | `bookings.COMPLETED` |
| NEEDS_CLARIFICATION | **YES** | ИЗМЕНЕНИЯ/ТРЕБУЮТ РЕШЕНИЯ | `booking.status.NEEDS_CLARIFICATION` | `status=NEEDS_CLARIFICATION` | `bookings.NEEDS_CLARIFICATION` |
| CHANGE_REQUESTED | **YES** | ИЗМЕНЕНИЯ/ТРЕБУЮТ РЕШЕНИЯ | `booking.status.CHANGE_REQUESTED` | `status=CHANGE_REQUESTED` | `bookings.CHANGE_REQUESTED` |
| CANCELLATION_REQUESTED | **YES** | ИЗМЕНЕНИЯ/ТРЕБУЮТ РЕШЕНИЯ | `booking.status.CANCELLATION_REQUESTED` | `status=CANCELLATION_REQUESTED` | `bookings.CANCELLATION_REQUESTED` |
| PROBLEM | **YES** | ИЗМЕНЕНИЯ/ТРЕБУЮТ РЕШЕНИЯ | `booking.status.PROBLEM` | `status=PROBLEM` | `bookings.PROBLEM` |
| SUPPLIER_REJECTED | **YES** | ТЕРМИНАЛЬНЫЕ ИСКЛЮЧЕНИЯ | `booking.status.SUPPLIER_REJECTED` | `status=SUPPLIER_REJECTED` | `bookings.SUPPLIER_REJECTED` |
| CANCELLED | **YES** | ТЕРМИНАЛЬНЫЕ ИСКЛЮЧЕНИЯ (terminal; not "attention") | `booking.status.CANCELLED` | `status=CANCELLED` | `bookings.CANCELLED` |

Coverage: **13/13 visible** — no Booking status is filter-only.

---

## 16. Legacy Booking Aggregate Compatibility

The previously accepted C1 6-KPI contract is **superseded for Operations Center visual presentation** (ADR-OPS-015) but remains valid as metric IDs, Help topics, aggregate calculations, compatibility/read-model metrics and analytics summaries.

```text
OLD 6 KPI CONTRACT ≠ VISIBLE STATUS CARD LIMIT
```

NEW, PREPARING_REQUEST, NEEDS_CLARIFICATION, CHANGE_REQUESTED, CANCELLATION_REQUESTED, PROBLEM **must NOT remain filter-only** — all have visible cards (§15).

### Aggregate Overlap Matrix

| Aggregate | Included statuses/condition | Visible separately? | Double-counting meaning | Purpose |
|---|---|---|---|---|
| `bookings.total` | ALL | n/a (Total card) | Total = sum of all status cards | Total scope |
| `bookings.awaitingConfirmation` (C1) | {SENT_TO_SUPPLIER, AWAITING_CONFIRMATION} | YES — both status cards visible | union of two cards; group NOT mutually exclusive with them | Help/summary/analytics aggregate; attention "awaiting supplier" source |
| `bookings.confirmed` (C1) | {CONFIRMED} | YES — CONFIRMED card visible | aggregate == single status card (1:1) | metric ID / Help compatibility |
| `bookings.inService` (C1) | {IN_SERVICE} | YES | 1:1 | metric ID / Help compatibility |
| `bookings.completed` (C1) | {COMPLETED} | YES | 1:1 | metric ID / Help compatibility |
| `bookings.cancelled` (C1) | {CANCELLED, SUPPLIER_REJECTED} | YES — both cards visible | union of two terminal-exception cards | aggregate for terminal exceptions |
| `orders.total` (metric convention) | ALL | n/a | Total = sum of lifecycle cards | Total scope |
| Orders fulfillment aggregate (optional) | {PARTIALLY_FULFILLED, FULFILLED} | YES — both cards visible | union; not mutually exclusive with cards | summary/analytics only |
| `payments.attention.failed` | {PaymentStatus.FAILED} | YES — FAILED card visible | 1:1 with status card; attention ≠ duplicate (action queue) | attention queue |
| `payments.refund.requested` | {RefundStatus.REQUESTED} | YES — REQUESTED card visible | 1:1; attention = action queue (approval needed) | attention queue |
| `payments.refund.approved` | {RefundStatus.APPROVED} | YES — APPROVED card visible | 1:1; attention = action queue (execution needed) | attention queue |
| Money aggregates (due/refundable/paid) | derived money facts (D7) | NOT statuses | not status cards by design | financial summary (Finance/Analytics), never fake statuses |

Rule: **do not imply semantic groups are mutually exclusive unless they actually are.** Status cards are exclusive per status; aggregates are unions/conditions documented above.

---

## 17. Payments Canonical Wireframe

```text
ЦЕНТР ОПЕРАЦИЙ
[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]

[ Всего платежей ]   (Total payment aggregate — Payment records)

СТАТУСЫ ПЛАТЕЖЕЙ  (all 6 actual PaymentStatus values)
[ PENDING ] [ AUTHORIZED ] [ CAPTURED ] [ FAILED ] [ CANCELLED ] [ REFUNDED ]
(AUTHORIZED / REFUNDED — reserved vocabulary; visible cards truthfully show 0
with Help explaining reserved semantics; never hidden, never invented)

СТАТУСЫ ВОЗВРАТОВ  (all 4 actual RefundStatus values — separate dimension)
[ REQUESTED ] [ APPROVED ] [ PROCESSED ] [ FAILED ]

ТРЕБУЕТ ВНИМАНИЯ  (server-authoritative conditions only)
[ Неуспешные платежи: FAILED ]
[ Возвраты на согласование: REQUESTED ]
[ Возвраты на исполнение: APPROVED ]

[ Search ]
[ Payment status ]
[ Refund status ]
[ Date type (createdAt / paidAt — backend-supported via dateField) ]
[ From ][ To ]
[ Reset ]
[ CSV ][ XLSX ]

TABLE  (reference / date / order / client / amount / paid-refunded summary /
payment method / payment status / refund status / action)

PAGINATION
```

Payments remains:

```text
DOMAIN OWNERSHIP = FINANCE
WORKFLOW CONTEXT = OPERATIONS CENTER
```

Payments ≠ Finance Analytics (§15 of this prompt): GMV, Revenue, Commission, Take Rate, Provider Payables, Payouts, Provider Fees, financial trends are **not** placed as operational status KPI cards — they belong to Finance/Analytics surfaces. The Payments tab is an operational journal/work center.

---

## 18. Payments/Refund Status Coverage Matrix

### 18.1 Payment (PaymentStatus — 6/6 visible)

| Canonical status | Visible KPI card | KPI group | Localized label source | Click filter | Help ID |
|---|---|---|---|---|---|
| PENDING | **YES** | СТАТУСЫ ПЛАТЕЖЕЙ | `status.entity.PENDING` | `status=PENDING` | `payments.payment.PENDING` |
| AUTHORIZED | **YES** (reserved vocabulary; truthful 0) | СТАТУСЫ ПЛАТЕЖЕЙ | `status.entity.AUTHORIZED` | `status=AUTHORIZED` | `payments.payment.AUTHORIZED` |
| CAPTURED | **YES** | СТАТУСЫ ПЛАТЕЖЕЙ | `status.entity.CAPTURED` | `status=CAPTURED` | `payments.payment.CAPTURED` |
| FAILED | **YES** (+attention ref) | СТАТУСЫ ПЛАТЕЖЕЙ | `status.entity.FAILED` | `status=FAILED` | `payments.payment.FAILED` |
| CANCELLED | **YES** | СТАТУСЫ ПЛАТЕЖЕЙ | `status.entity.CANCELLED` | `status=CANCELLED` | `payments.payment.CANCELLED` |
| REFUNDED | **YES** (reserved vocabulary; truthful 0) | СТАТУСЫ ПЛАТЕЖЕЙ | `status.entity.REFUNDED` | `status=REFUNDED` | `payments.payment.REFUNDED` |

### 18.2 Refund (RefundStatus — 4/4 visible)

| Canonical status | Visible KPI card | KPI group | Localized label source | Click filter | Help ID |
|---|---|---|---|---|---|
| REQUESTED | **YES** (+attention ref) | СТАТУСЫ ВОЗВРАТОВ | `status.refund.REQUESTED` (new i18n key) | refund status filter (UI-C1.2E backend) | `payments.refund.REQUESTED` |
| APPROVED | **YES** (+attention ref) | СТАТУСЫ ВОЗВРАТОВ | `status.refund.APPROVED` (new) | refund status filter (UI-C1.2E) | `payments.refund.APPROVED` |
| PROCESSED | **YES** | СТАТУСЫ ВОЗВРАТОВ | `status.refund.PROCESSED` (new) | refund status filter (UI-C1.2E) | `payments.refund.PROCESSED` |
| FAILED | **YES** | СТАТУСЫ ВОЗВРАТОВ | `status.refund.FAILED` (new) | refund status filter (UI-C1.2E) | `payments.refund.FAILED` |

Coverage: **Payment 6/6, Refund 4/4 visible.** `UNPAID/PARTIALLY_PAID/PAID/REFUNDED` remain `OrderPaymentStatus` (Orders tab), not Payments cards (§13 of the main contract).

---

## 19. Attention Contract

Binding placement:

```text
STATUS / LIFECYCLE GROUPS
↓
ATTENTION
↓
TOOLBAR
```

- Attention is optional per domain; when present its placement is canonical (after semantic KPI groups, before toolbar).
- **Attention card = actionable server-authoritative condition ≠ ordinary status card ≠ decorative duplicate.**
- Attention may reference a status/subset, but only as an action queue (purpose changes from overview to action).
- Click contract: apply the corresponding server-side detector/filter, reset `page=1`, refresh the registry, preserve scope authority (§21).

Per-domain attention sets (server-authoritative, from the main-contract audit):

| Domain | Attention cards (actual supported conditions) | Detector/query |
|---|---|---|
| Requests | supplier SLA pending (`CHECKING` beyond deadline); customer decision pending (`PRICE_CHANGED`/`CUSTOMER_ACCEPTED` beyond TTL); timeouts (`SUPPLIER_TIMEOUT`, `CUSTOMER_PAYMENT_TIMEOUT`, `EXPIRED`) | deadline-field queries (UI-C1.2H backend) |
| Orders | failed payments; pending refunds; recent cancellations; SUSPENDED/PROBLEM counts | `paymentFailed=true`, `pendingRefund=true`, `cancelledWithin=N` (exist) |
| Bookings | awaiting supplier (overdue SLA); upcoming service; clarification/change/cancellation/problem | `overdue=true`, `upcoming=true` (exist); status groups |
| Payments | failed payments; refunds awaiting approval; refunds awaiting execution | PaymentStatus/RefundStatus aggregates (UI-C1.2E) |

Rejected as attention: Bookings CANCELLED (terminal, no action); Requests "review" (no such concept).

---

## 20. Toolbar Contract

Binding interaction order:

```text
[ Search ]
[ Primary status filter ]
[ Secondary/business filters ]
[ Date type ]
[ From ]
[ To ]
[ Reset ]
[ Export ]
```

- Controls that do not apply may be absent.
- **No** arbitrary placement of Export before Search; **no** splitting primary filters into unrelated page zones without an approved responsive reason.
- Search: first in toolbar, server-side, ~350 ms debounce, Enter immediate, typing never blocked by loading, clearing/changing resets `page=1`, no explicit Search button.
- Export: CSV + XLSX (`TableExportButton` pattern), respects active filters + tenant/workspace scope; backend behavior remains domain-specific.
- Reset: clears all tab filters + date + search → `page=1` → URL params cleared (Requests/Bookings currently lack Reset; added in UI-C1.2A).

Per-tab toolbar composition (from the wireframes): Requests `[Search][Status][customer/partner][Date*][Reset][CSV][XLSX]`; Orders `[Search][Lifecycle][Payment][seller/partner][Date][Reset][CSV][XLSX]`; Bookings `[Search][Status][orderId][Date][Reset][CSV][XLSX]`; Payments `[Search][Payment status][Refund status][Date type][From][To][Reset][CSV][XLSX]`. (*Requests date only after KPI parity, §22.)

---

## 21. KPI Click / Drill Contract

```text
STATUS KPI:
  click → status filter → page = 1 → server query → table refresh

TOTAL KPI:
  click → clear status dimension filter → page = 1 → server query

ATTENTION:
  click → actionable server-side detector/filter → page = 1 → table refresh
```

- Selected KPI state visible (`active` card styling + URL param).
- «Total» clears the corresponding status/group filter.
- KPI scope refreshes with the same query scope as the table (server-side; no client-only filtering/counting).
- URL state per §27 of the main contract (search/status/dateType/from/to/page/sort).

---

## 22. KPI ↔ Table Scope Contract

```text
ACTIVE SEARCH / FILTER / PERIOD SCOPE
              ↓
        BACKEND QUERY SCOPE
          ↙           ↘
        KPI           TABLE
```

- **No state where TABLE = filtered and KPI = global while the UI implies the same scope.**
- Orders ✅ / Bookings ✅ — server aggregates already share the list `where`.
- Payments — server aggregates staged in UI-C1.2E; the current client-side page-sum is removed (existing violation).
- Requests — **period remains hidden** until `GET /requests/kpi` accepts the list scope (UI-C1.2E prerequisite; interim behavior bound, not silently divergent).
- No stale KPI; no client-side counting; KPI and table always share exactly the same active scope.

---

## 23. Card / Group Geometry

### Card geometry (one design family across all domains)

```text
same base height logic
same border/radius family
same internal padding
same label hierarchy
same value hierarchy
same Help affordance (ⓘ)
same selected state
same hover/focus language
```

Semantic variants (each explicitly defined, never page-specific improvisation):

| Variant | Definition | Used for |
|---|---|---|
| Lifecycle flow card | connected/arrow geometry along a truthful happy path | Orders/Bookings flow |
| Ordinary status card | standard KPI card (`CommerceKpiCard`) | all status grids |
| Attention card | actionable queue card (reason + count, distinct accent) | attention groups |
| Total card | ~15–20% larger, not full-width, same family | Total |

### Group geometry (reusable semantic group grammar)

```text
GROUP TITLE
optional description/help
KPI GRID / FLOW
```

Shared: title typography; title-to-grid spacing; group-to-group spacing; responsive wrapping; card gaps. Orders/Bookings lifecycle flow may use the special flow layout; **group outer geometry remains shared**.

---

## 24. Responsive Composition

```text
Desktop:  Header → Tabs → Total → Semantic groups → Attention → Toolbar → Table → Pagination
Tablet:   same semantic order; grids/flow wrap
Mobile:   same semantic order; no reordering that changes business hierarchy
```

- Tabs may horizontally scroll.
- KPI flow may wrap/scroll per approved design, but canonical lifecycle order must remain understandable (arrows become vertical chevrons on stacked cards).
- No horizontal page overflow (registry table: horizontal scroll + sticky ref column — ADR-OPS-013).
- Vertical section order is preserved at every breakpoint (ADR-OPS-014 allows wrapping, not reordering).

---

## 25. ADR Addendum

Two new traceable decisions appended to the UI-C1.2 ADR set (repository next numbers: 014, 015):

### ADR-OPS-014 — Canonical Operations Center Visual Composition

```text
STATUS: ACCEPTED (this micro-closure)
Vertical section order is canonical and binding:
  TOTAL → STATUS/LIFECYCLE GROUPS → EXCEPTIONS/PAYMENT/REFUND GROUPS
  → ATTENTION → TOOLBAR → TABLE → PAGINATION
Responsive wrapping is allowed; arbitrary reorder/merge/flatten/omit of
semantic zones requires a new approved design decision.
A zone genuinely not applicable to a domain may be absent; no empty
decorative zones.
Four canonical wireframes (Requests/Orders/Bookings/Payments) are part of
the architecture contract, not implementation detail.
```

### ADR-OPS-015 — All Canonical Statuses Require Visible KPI Cards

```text
STATUS: ACCEPTED (this micro-closure)
EVERY ACTUAL CANONICAL STATUS → ONE VISIBLE STATUS KPI CARD:
  Requests 12/12, Orders lifecycle 12/12, OrderPayment 4/4,
  Bookings 13/13, Payment 6/6, Refund 4/4.
Aggregate KPIs never replace status cards (aggregate metrics may live in
Attention/summary/Help/analytics).
Supersedes, for Operations Center visual presentation:
  - C1 Booking 6-KPI "filter-only" classification (NEW, PREPARING_REQUEST,
    NEEDS_CLARIFICATION, CHANGE_REQUESTED, CANCELLATION_REQUESTED, PROBLEM);
  - Payment AUTHORIZED/REFUNDED "filter-only" treatment;
  - Order READY_TO_CLOSE "filter-only" and PARTIALLY_FULFILLED sub-count folding.
```

---

## 26. Superseded Language

The following statements in the main UI-C1.2 contract report are marked **SUPERSEDED FOR OPERATIONS CENTER VISUAL PRESENTATION** (kept for historical context only):

| # | Superseded statement (main report) | Replacement (binding) |
|---|---|---|
| 1 | Booking C1: "the remaining statuses … remain filter-only statuses in C1 terms … while their metric semantics stay filter-only" | All 13 Booking statuses have visible KPI cards (ADR-OPS-015); C1 6-KPI metrics remain metric IDs/Help/aggregates/analytics only |
| 2 | Payments: "AUTHORIZED/REFUNDED — reserved vocabulary … shown in the status filter … but NOT as KPI cards" | All 6 PaymentStatus values get visible cards; AUTHORIZED/REFUNDED cards truthfully display 0 with reserved-semantics Help |
| 3 | Orders flow: "READY_TO_CLOSE … excluded from the flow, listed in filter only" | READY_TO_CLOSE gets a visible card (terminal-adjacent, no arrow) |
| 4 | Orders flow: "PARTIALLY_FULFILLED count is shown inside the FULFILLED stage card as a sub-count" | PARTIALLY_FULFILLED gets its own visible card (alternate fulfillment, no arrow) |
| 5 | Booking flow: "SENT_TO_SUPPLIER/AWAITING_CONFIRMATION render as one stage pair" | Separate visible cards, no arrow between them (AWAITING_CONFIRMATION has no producer) |

The main report now carries these markers inline and this micro-closure report is referenced as the binding addendum (§1 of the main report).

---

## 27. Non-Scope (hard block)

Not implemented in this stage:

```text
OperationsCenterShell production code
registry migrations
Payments backend changes
Requests KPI backend changes
new status enums
new state transitions
UI-C2 Commerce Relation Chain
D8
pricing / commission redesign
SEC-UI-01 remediation
```

D5 / D6 / D7 are **not altered** (no code changes at all — documentation only).

---

## 28. Acceptance Matrix

| Gate | Result |
|---|---|
| P0-1 Global vertical composition fixed | **PASS** (§4, ADR-OPS-014) |
| P0-2 Requests wireframe fixed | **PASS** (§8) |
| P0-3 Orders wireframe fixed | **PASS** (§10) |
| P0-4 Bookings wireframe fixed | **PASS** (§14) |
| P0-5 Payments wireframe fixed | **PASS** (§17) |
| P0-6 All Request statuses visible | **PASS** — 12/12 (§9) |
| P0-7 All Order statuses visible | **PASS** — 12/12 (§12.1) |
| P0-8 All Order payment statuses visible | **PASS** — 4/4 (§12.2) |
| P0-9 All 13 Booking statuses visible | **PASS** — 13/13 (§15) |
| P0-10 All actual Payment statuses visible | **PASS** — 6/6 (§18.1) |
| P0-11 Refund statuses handled truthfully | **PASS** — 4/4 visible, separate dimension, no fake statuses (§12.3/§18.2) |
| P0-12 Aggregate/status distinction fixed | **PASS** (§7, §16 matrix) |
| P0-13 Attention placement fixed | **PASS** (§19) |
| P0-14 Toolbar placement fixed | **PASS** (§20) |
| P0-15 KPI/table scope authority preserved | **PASS** (§22; Requests period hidden until parity) |
| P0-16 D5/D6/D7 preserved | **PASS** (no code changes) |
| P0-17 No production implementation | **PASS** (documentation only) |
| P0-18 UI-C2 not started | **PASS** |
| P0-19 D8 not started | **PASS** |
| P0-20 Git hard closure | **PASS** (§29) |

**VERDICT B guard-rails self-check:** `ACTIVE DOMAIN KPI AREA` fully replaced by explicit wireframes ✅; no canonical status intentionally filter-only ✅ (6/6 matrices all-YES); old Booking 6-KPI contract does not hide statuses (superseded for presentation) ✅; Total not full-width ✅; Orders statuses not flattened into one undifferentiated grid (flow + rework + alternate + exception + payment + refund groups) ✅; Order lifecycle arrows only on truthful happy path ✅; Booking branch states not presented as a false linear chain (AWAITING_CONFIRMATION no-arrow truthfulness finding) ✅; Payment/refund statuses not invented (all from actual enums) ✅; Attention not mixed into ordinary status cards (separate group, distinct card variant) ✅; KPI/table scopes cannot diverge (contract §22) ✅; no production implementation ✅; UI-C2/D8 not started ✅.

---

## 29. Git Hard Closure

```text
$ git status --porcelain=v1
<NO OUTPUT>

$ git rev-parse HEAD
c9ef2b496a53b56cc03992705a89616fe567185e

$ git rev-parse origin/master
c9ef2b496a53b56cc03992705a89616fe567185e

HEAD == origin/master: YES
```

Scope of committed changes: the micro-closure prompt, this report, and the amended main UI-C1.2 contract report. **No production code changed** (backend and frontend trees untouched; D5/D6/D7, UI-C1/UI-C1.1 preserved; UI-C2/D8 not started).

---

## 30. Final Verdict

```text
VERDICT A — UI-C1.2
VISUAL COMPOSITION & STATUS KPI CONTRACT
MICRO-CLOSURE ACCEPTED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED

UI-C1.2
OPERATIONS CENTER
ARCHITECTURE & DESIGN CONTRACT — ACCEPTED

FINAL SHA:
c9ef2b496a53b56cc03992705a89616fe567185e

PRODUCTION IMPLEMENTATION — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2A — OPERATIONS CENTER SHARED SHELL IMPLEMENTATION
```

---

## 31. TRUE NEXT

**UI-C1.2A — OPERATIONS CENTER SHARED SHELL IMPLEMENTATION** — build `OperationsCenterShell` per ADR-OPS-014's binding vertical grammar, then migrate Requests (UI-C1.2B) as the first tab with all 12 status cards visible (ADR-OPS-015). Backend prerequisites (Requests KPI scope extension, Payments/Refund aggregates, Refund search/names) remain staged in UI-C1.2E ahead of the surfaces that depend on them.