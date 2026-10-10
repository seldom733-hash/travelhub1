# TRAVELHUB — TRAVELER DATA FORM
# STRICT READ-ONLY AUDIT PROMPT

## Purpose
Audit the CURRENT implementation of the Order → Traveler data workflow.

Real problem: the Order shows “ДАННЫЕ ТУРИСТОВ”, “Турист 1 из N”, “Турист 2 из N”, but the user has no usable form/fields to enter or edit traveler data.

The existing lifecycle must NOT be bypassed:
```text
Traveler data
→ COMPLETE
→ Final confirmation
→ Confirm
→ READY_FOR_BOOKING
→ Send
→ Booking
```

Determine exactly why the form is unavailable and what minimal later fix is needed.

## Absolute read-only rules
DO NOT modify code, frontend, backend, schema, database data, tests, migrations, commits or pushes. Do not create Traveler records or alter the real Order. Do not fix defects. Audit only.

## Real Order
Inspect read-only where available:
`TH-2026-000101`

Report:
- Order status
- traveler count
- traveler records/statuses
- completeness
- finalConfirmedAt
- availableActions
- visible traveler controls

If unavailable, say `REAL ORDER NOT AVAILABLE`.

## 1. Frontend trace
Trace:
```text
Order page
→ traveler section
→ TravelerCollectionPanel (or actual equivalent)
→ traveler row/card
→ input/form component
→ state
→ save handler
→ API call
```

Determine whether:
A. form component does not render fields;
B. fields are hidden by condition;
C. fields are disabled/read-only;
D. fields render only for another Order state;
E. required configuration/data is absent;
F. API exists but frontend wiring is missing;
G. another component is intended to render the form;
H. other cause.

Do not guess. Provide code evidence.

## 2. TravelerCollectionPanel
Inspect actual implementation:
- props/data source
- traveler count
- traveler loading
- edit mode
- input controls
- child components
- conditional rendering
- validation
- Save handler
- error/loading states
- use of pinnedRequirements
- use of productSnapshot
- service type/booking requirements

Explain exactly why the user cannot enter/edit data.

## 3. Backend models
Find actual Traveler/OrderTraveler/equivalent models and relations:
- Customer
- Order
- OrderItem
- Booking

For relevant fields report:
`Field / Type / Nullable / Meaning / Used by completeness / Used by Booking / Used by supplier`.

Do not invent fields.

## 4. Traveler API
Find actual create/update/complete/validation/final-confirm endpoints.

A previous audit suggested a route similar to:
`PATCH /orders/:id/travelers/:tid`
Verify the real route and DTO; do not assume it.

Report auth, RBAC, validation, response and errors.

## 5. Frontend → API wiring
Trace:
```text
Save
→ handler
→ API client
→ endpoint
→ backend
```

Classify:
- backend implemented + UI missing;
- API implemented + form missing;
- form partial + save missing;
- conditional rendering defect;
- other.

## 6. Completeness
Inspect actual `computeTravelerCompleteness` or equivalent.

Determine exact required fields and distinguish:
- UI-required
- DTO-required
- completeness-required
- supplier-required

Do not infer requirements from generic travel practice.

## 7. pinnedRequirements
Determine whether/how `pinnedRequirements` controls traveler requirements and whether the UI reads it.

## 8. Service-specific requirements
Determine from actual code whether requirements differ for flight, hotel, insurance, visa, tour, transfer, etc. Do not design new requirements.

## 9. Order editability
Determine actual Order statuses/permissions allowing traveler edits.

Produce:
| Order Status | Traveler UI Editable | API Update Allowed | Completeness Can Change |
|---|---|---|---|

## 10. Final confirmation
Trace:
```text
Traveler completeness
→ final confirmation
→ Confirm
```
Report endpoints, guards, state changes, reversibility, and what happens if traveler data changes afterward.

## 11. Booking dependency
Connect the actual traveler gate to:
```text
Traveler COMPLETE
→ Final Confirmation
→ Confirm
→ READY_FOR_BOOKING
→ Send
→ BookingRequested
→ Booking
```
Do NOT remove/bypass the gate.

## 12. Booking data dependency
Separate:
- required to save Traveler;
- required to mark COMPLETE;
- required for Final Confirmation;
- required for Order Confirm;
- required to Send to Booking;
- required by supplier.

## 13. Tests
Search for TravelerCollectionPanel/form/update/completeness/final confirmation/Order confirm/Order→Booking tests. Classify PASS/FAIL/NOT RUN/NOT AVAILABLE.

A backend fixture/API test does not prove a human can fill the UI.

## 14. Current UI state
Document exactly what the user sees:
- traveler rows
- statuses
- buttons
- missing fields
- disabled controls
- edit controls
- save controls
- validation messages

Do not redesign here.

## 15. Minimal safe later fix
Describe only the minimal implementation needed to connect the existing UI/model/API:
```text
Order
→ Traveler 1 → Edit/Fill → Save → COMPLETE
→ Traveler 2 → Edit/Fill → Save → COMPLETE
→ all complete
→ Final Confirmation
→ Confirm
→ READY_FOR_BOOKING
→ Send
→ Booking
```
Do not create a parallel Traveler system or redesign the entire Order.

## 16. Required report

### A. Executive Verdict
`IMPLEMENTED / PARTIALLY IMPLEMENTED / MISSING / BROKEN / BLOCKED`

### B. Real Order
For `TH-2026-000101`:
- status
- traveler count
- traveler records
- completeness
- finalConfirmedAt
- availableActions
- visible traveler controls

### C. Frontend Trace
`Order → TravelerCollectionPanel → form/input → save → API`
Mark exact break.

### D. Backend Trace
`Traveler model → DTO → endpoint → service → completeness → final confirmation`

### E. Exact Required Fields

### F. State/Permission Matrix

### G. Order → Booking dependency

### H. Test Evidence

### I. Gap Matrix
| Gap | Severity | Current | Target | Evidence |
|---|---|---|---|---|
| Traveler form | | | | |
| Traveler fields | | | | |
| Edit mode | | | | |
| Save wiring | | | | |
| API | | | | |
| Completeness | | | | |
| Final confirmation | | | | |
| Order → Booking | | | | |

Severity: P0 lifecycle blocked; P1 major gap; P2 non-blocking; P3 enhancement.

### J. Minimal Safe Implementation Scope
Describe only. Do not implement.

### K. Regression Plan

### L. Final Verdict
State:
`WHAT EXISTS / WHAT DOES NOT WORK / WHY USER CANNOT ENTER TRAVELER DATA / WHAT MUST CHANGE / WHAT MUST NOT CHANGE`

## Evidence standard
Every important conclusion must include actual repository evidence: path, component/class/function, API route, DTO, line where possible, and test evidence. If unverifiable: `NOT VERIFIED`.

## Final safety check
```text
Production code changed: NO
Frontend changed: NO
Backend changed: NO
Schema changed: NO
Database data changed: NO
Tests changed: NO
Migration created: NO
Traveler data changed: NO
Commit created: NO
Push performed: NO
```
If any mutation occurs: STOP and report it.
