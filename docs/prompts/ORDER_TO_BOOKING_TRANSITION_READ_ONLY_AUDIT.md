# TRAVELHUB — ORDER → BOOKING TRANSITION
# STRICT READ-ONLY AUDIT PROMPT

## Purpose
Audit the CURRENT repository to determine why an Order cannot be manually transferred to Booking, and whether the complete Order → OrderItem → Booking lifecycle actually exists.

This is AUDIT ONLY. Do not implement anything.

## Absolute restrictions
DO NOT:
- modify backend/frontend code;
- modify Prisma/schema;
- modify database data;
- create migrations;
- modify tests;
- create Booking records during the audit;
- commit or push;
- fix discovered defects.

Only inspect, trace, reproduce safely through read-only API/runtime inspection, and report.

## Real Order
Where available, inspect the owner's real test Order:

`TH-2026-000101`

Do not mutate it. If unavailable, report `REAL ORDER NOT AVAILABLE`.

Inspect:
- Order status
- OrderItems and their statuses
- productId
- commercialSnapshot
- supplier information
- travelers
- payment status
- Booking state
- availableActions
- frontend action buttons

## Target lifecycle
```text
REQUEST
  ↓
ORDER
  ↓
ORDER ITEMS
  ↓
Booking readiness
  ↓
BOOKING / FULFILLMENT
```

Order = accepted commercial truth.
OrderItem = purchased service.
Booking = operational fulfillment for a specific OrderItem.
Booking is not Customer Payment and not Supplier Settlement.
One Order may have multiple OrderItems and multiple Bookings.

## 1. Trace the complete transition
Trace:
```text
Order page
→ availableActions / action projection
→ UI action
→ frontend request
→ controller/endpoint
→ service command
→ validations
→ Booking creation
→ Order/OrderItem status changes
→ history/audit/event
```
For every step provide file, class/function/component, endpoint, action and status.

Find the exact break if any link is missing.

## 2. Find all Booking creation paths
Repository-wide search for:
- Booking.create
- prisma.booking.create
- createBooking
- book / booking
- orderItemId
- Booking controllers/services/DTOs
- Booking status transitions
- supplier booking calls

Separate:
A. Order/OrderItem business transition
B. supplier integration creation
C. fixtures/seeds/tests
D. model-only existence

A Prisma model is NOT evidence of a working transition.

## 3. Order availableActions
Inspect:
- availableActions
- Order action DTO/projection
- OrderItem action projection
- status guards
- permission guards
- frontend rendering

Determine:
```text
Action exists: YES/NO
Returned for real Order: YES/NO
Rendered in UI: YES/NO
Executable through API: YES/NO
```
Use the repository's actual action name; do not invent one.

## 4. Frontend
Inspect Order detail and related components:
- Is there a Booking / ЗАБРОНИРОВАТЬ / equivalent action?
- Is it at Order or OrderItem level?
- Is it conditional on availableActions?
- Is it hidden by status, permissions or missing data?
- Does it call a real endpoint?
- What happens on failure?

## 5. Backend endpoint
Find actual Booking creation endpoint:
- route/method
- DTO
- auth/RBAC
- service command
- response
- idempotency
- errors

Do not assume routes such as POST /orders/:id/bookings.

## 6. Actual Booking preconditions
Determine from code the real requirements for:
- Order status
- OrderItem status
- supplier/partner
- supplier reference
- Product / productId
- commercialSnapshot / frozen price
- supplier cost
- customer price
- traveler data
- payment status
- supplier availability/confirmation
- any other validation

Do NOT invent requirements.

For each condition state:
```text
Condition
→ required for Booking? YES/NO
→ required for Order? YES/NO
→ required for payment? YES/NO
```

## 7. Traveler dependency
The current Order UI contains a “ДАННЫЕ ТУРИСТОВ” block with “Турист 1 из 2”, “Турист 2 из 2” and “Финальное подтверждение”.

Audit the existing implementation:
- Traveler model and fields
- Customer ↔ Traveler
- Order ↔ Traveler
- OrderItem ↔ Traveler
- Booking ↔ Traveler
- whether complete traveler data is required for Booking
- what “Final confirmation” actually changes
- whether traveler state affects availableActions

Do not redesign the traveler form.

## 8. Multi-item / multi-booking
Determine whether current implementation supports:
```text
Order
 ├─ Flight → Booking
 ├─ Hotel → Booking
 ├─ Transfer → Booking
 └─ Insurance → Booking
```
Check:
- one Booking per OrderItem
- multiple Bookings per Order
- partial fulfillment
- booking one item while another remains unbooked
- repeat booking attempts

Do not assume all items must book together.

## 9. Idempotency
Determine what happens if Booking creation is requested twice:
- unique constraints
- existing Booking lookup
- idempotency key
- duplicate prevention
- response to repeat request

## 10. Status matrix
Produce:
| Entity | Current Status | Booking Allowed? | Block Reason | Next Status |
|---|---|---|---|---|
| Order | | | | |
| OrderItem | | | | |
| Booking | | | | |

Use actual repository statuses only.

## 11. RBAC
Find exact permission/role required to create Booking.
Separate:
- business condition
- RBAC condition
- UI visibility condition

## 12. Supplier fulfillment
Determine whether Booking is:
- internal record only;
- internal + supplier API;
- supplier API first + internal record;
- other.

Trace supplier adapter and supplier-native identifiers without universalizing fields such as hotelKey/hotelExternalId/hotelInc.

## 13. Failure handling
Audit actual handling for:
- missing traveler
- missing supplier
- missing Product
- missing commercial snapshot
- payment issue
- permission denied
- duplicate Booking
- invalid Order/OrderItem status
- supplier failure

Report HTTP/domain errors, UI behavior, state rollback/partial state.

## 14. Safe live verification
If safe and read-only, inspect the real Order's current API response and availableActions.
Do NOT execute an action that creates a Booking or mutates data.

## 15. Tests
Find existing tests for:
- Order → Booking
- OrderItem → Booking
- Booking RBAC
- traveler completeness
- payment preconditions
- duplicate booking
- partial booking
- multi-item Order

Classify each:
PASS / FAIL / NOT RUN / NOT AVAILABLE / NOT RELEVANT.

A fixture-only Booking test does not prove Order → Booking.

## 16. Target reconciliation
Compare actual implementation against:
```text
REQUEST
  ↓
ORDER
  ↓
ORDER ITEMS
  ↓
Traveler data
  ↓
Booking readiness
  ↓
BOOKING
```
Do not automatically require full customer payment or all OrderItems to be booked unless existing business rules require it.

## 17. Required report

### A. Executive Verdict
One:
`IMPLEMENTED / PARTIALLY IMPLEMENTED / MISSING / BROKEN / BLOCKED`

### B. Real Order Result
For `TH-2026-000101`:
- Order status
- OrderItem status
- availableActions
- Booking action
- Traveler status
- Payment status
- Supplier data

### C. Complete Transition Trace
```text
UI → availableActions → endpoint → controller → service → validations → Booking → status
```
Mark the exact break.

### D. Current Architecture

### E. Booking Preconditions

### F. Traveler Dependency

### G. Multi-item / Multi-booking

### H. RBAC

### I. Supplier Fulfillment

### J. Test Evidence

### K. Gap Matrix
| Gap | Severity | Current | Target | Evidence |
|---|---|---|---|---|
| Booking action | | | | |
| UI action | | | | |
| API | | | | |
| Preconditions | | | | |
| Traveler dependency | | | | |
| Multi-item | | | | |
| Idempotency | | | | |
| RBAC | | | | |
| Supplier fulfillment | | | | |

Severity:
P0 = core lifecycle blocked
P1 = major functional gap
P2 = non-blocking gap
P3 = enhancement

### L. Minimal Safe Fix Scope
Describe only. Do not implement. Do not invent duplicate entities.

### M. Regression Plan

### N. Final Verdict
State:
`WHAT WORKS / WHAT DOES NOT WORK / WHERE TRANSITION BREAKS / WHAT MUST CHANGE / WHAT MUST NOT CHANGE`

## Evidence standard
Every important claim must have repository evidence: file path, class/function/component, endpoint and line where available, plus test evidence. Do not infer functionality from a Prisma model alone. If unverifiable, say `NOT VERIFIED`.

## Final safety check
```text
Production code changed: NO
Frontend changed: NO
Schema changed: NO
Database data changed: NO
Tests changed: NO
Migration created: NO
Booking created during audit: NO
Commit created: NO
Push performed: NO
```
If any mutation occurs: STOP and report it.
