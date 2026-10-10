# TRAVELHUB — TRAVELER REQUIREMENTS DATA-SHAPE FIX
# STRICT IMPLEMENTATION PROMPT

## 0. Mission

Implement the single P0 fix identified by the read-only audit:

> `TourRequestService.createTourRequest` currently writes a tour-offer/search snapshot into `Request.pinnedRequirements`, while `pinnedRequirements` is the canonical TravelerFullRequirements contract consumed by the Traveler UI, completeness engine and Order→Booking gates.

This causes tour-offer-originated Orders to render zero traveler input fields and makes the D3 lifecycle unreachable.

The objective is to repair the data-shape contract without redesigning the Traveler subsystem or weakening any lifecycle gate.

---

# 1. SOURCE OF TRUTH

Use the following read-only audit as the authoritative basis:

`TRAVELHUB_TRAVELER_FORM_READ_ONLY_AUDIT_REPORT.md`

The audit establishes:

- `TH-2026-000101` is currently affected.
- `MKT-REQ-00000402` is the upstream converted Request.
- `pinnedRequirements` currently contains an offer snapshot.
- `TravelerCollectionPanel` expects the canonical traveler requirements map.
- The frontend panel logic itself is correct.
- Traveler API, completeness, final-confirm and Order→Booking gates are already implemented.
- The defect is upstream data production.
- No schema migration is required.
- The existing D3 lifecycle must not be bypassed or weakened.

Do not reinterpret the audit or introduce unrelated architectural changes.

---

# 2. STRICT EXECUTION CONTRACT

## MUST

- Inspect the current repository and current HEAD before editing.
- Inspect the dirty worktree before editing.
- Preserve all unrelated existing work.
- Make only the minimum changes required by this prompt.
- Keep `pinnedRequirements` semantically dedicated to `TravelerFullRequirements`.
- Preserve the existing offer/search/commercial snapshot data.
- Use the existing canonical traveler-requirements resolver.
- Add regression coverage for the previously untested tour-offer path.
- Execute targeted tests serially where possible.
- Use soft/low-resource E2E execution.
- Produce a complete final implementation report.

## MUST NOT

Do NOT:

- redesign TravelerCollectionPanel;
- create another Traveler model;
- create another traveler requirements JSON field;
- change `OrderTraveler`;
- change the D3 gate semantics;
- remove or weaken `final-confirm`;
- make `confirm` or `send` possible without completed travelers;
- bypass completeness;
- change `availableActions` merely to expose buttons;
- change Booking creation authority;
- change BookingRequested semantics;
- change RBAC;
- change supplier booking logic;
- rename `pinnedRequirements`;
- introduce a schema migration;
- rename `hotelKey`, `hotelExternalId`, or supplier identifiers;
- perform broad supplier refactoring;
- alter Storefront pricing/markup architecture;
- modify unrelated dirty-worktree changes;
- commit or push unless the owner explicitly requests it.

---

# 3. PRE-FLIGHT

Before modifying anything, record:

```text
HEAD:
branch:
git status --short:
relevant dirty files:
```

Identify whether the relevant files already contain uncommitted owner work.

At minimum inspect:

```text
backend/src/modules/supplier/tour-request.service.ts
backend/src/modules/order/request.service.ts
backend/src/modules/order/order.service.ts
backend/src/modules/order/traveler-requirements.ts
frontend/.../TravelerCollectionPanel.tsx
```

Use the actual repository paths if they differ.

Do not overwrite or reset unrelated dirty work.

---

# 4. CANONICAL DATA CONTRACT

The semantic contract is:

```text
Request.pinnedRequirements
        ↓
TravelerFullRequirements
```

For TOUR the default map is:

```json
{
  "firstName": "REQUIRED",
  "lastName": "REQUIRED",
  "birthDate": "OPTIONAL",
  "citizenship": "NOT_REQUESTED",
  "gender": "NOT_REQUESTED",
  "passportNumber": "NOT_REQUESTED",
  "passportExpiry": "NOT_REQUESTED"
}
```

The implementation MUST use the existing resolver:

```ts
getEffectiveTravelerRequirements(
  "TOUR",
  product?.travelerRequirements ?? null
)
```

Do not duplicate the default object manually if the existing resolver is available.

Product-level traveler requirements must continue to override the TOUR defaults through the existing mechanism.

---

# 5. FIX A — TOUR REQUEST PRODUCER

## Target

`TourRequestService.createTourRequest`

The current implementation writes the offer/search snapshot into:

```text
Request.pinnedRequirements
```

This is the root defect.

Change the producer so that:

```text
pinnedRequirements
    =
getEffectiveTravelerRequirements(
    "TOUR",
    product?.travelerRequirements ?? null
)
```

where the existing product resolution path is reused.

If the product lookup already selects the Product, extend only the necessary select/projection to obtain:

```text
travelerRequirements
```

Do not redesign product resolution.

---

# 6. OFFER SNAPSHOT MUST NOT BE LOST

The following facts currently carried in the offer snapshot must remain auditable and available in the existing appropriate snapshot field(s):

```text
supplierCode
externalOfferId
hotel
hotelExternalId
departureDate
nights
adults
children
childAges
room
meal
destination
departureCity
country
```

Preserve any additional existing offer facts already being stored.

Use an existing JSON snapshot location such as the appropriate existing:

```text
productSnapshot
commercialSnapshot
```

according to the repository's current model/semantics.

Do NOT invent a new database column merely to solve this problem.

Do NOT delete offer data.

Do NOT silently change the commercial meaning of existing snapshots.

---

# 7. IMPORTANT PRODUCT-LESS PATH

The affected production path is specifically:

```text
public tour offer
    ↓
TourRequestService.createTourRequest
    ↓
productId may be null
    ↓
Request
    ↓
customerAccept
    ↓
convert
    ↓
Order
```

The fix MUST work even when:

```text
productId === null
```

For such a Request, `pinnedRequirements` must still contain the canonical TOUR traveler requirements.

Do not make Product existence a prerequisite for traveler requirements.

If a Product exists, its existing travelerRequirements override must be honored.

---

# 8. DO NOT REINTRODUCE THE BUG AT ACCEPTANCE

Inspect `RequestService.customerAccept`.

The audit found that product-less Requests deliberately preserve their creation-time pin.

After FIX A this behavior is acceptable because the creation-time pin will now have the correct shape.

Do not blindly add a second rewrite merely to mask the producer bug.

The desired invariant is:

```text
createTourRequest
    → correct traveler pin

customerAccept
    → preserves valid traveler pin

convert
    → copies valid traveler pin to Order

Order
    → exposes valid traveler pin to TravelerCollectionPanel
```

If an existing acceptance rewrite is necessary for product-backed Requests, preserve its existing semantics.

---

# 9. FIX B — EXISTING ORDER DATA REPAIR

The audit identified:

```text
Request: MKT-REQ-00000402
Order:   TH-2026-000101
```

as a real affected case.

## CRITICAL

Do NOT modify production/live data automatically as part of ordinary implementation.

First implement and test FIX A.

Then obtain explicit owner approval before performing the data repair.

No implicit approval may be inferred from this prompt.

---

# 10. DATA REPAIR PROCEDURE

After owner approval, repair only the affected Request/Order records identified by the audit unless additional affected records are explicitly discovered and separately approved.

Before overwriting:

1. Read the current JSON.
2. Preserve the old value in the existing appropriate audit/history mechanism.
3. Write the canonical TOUR traveler requirements map.
4. Verify the resulting value.
5. Verify the original offer facts remain available from their proper snapshot/history location.
6. Do not alter traveler PII.
7. Do not change Order status.
8. Do not execute `final-confirm`, `confirm`, `send`, or create Booking as part of the repair.

For the known Order the intended resulting pin is:

```json
{
  "firstName": "REQUIRED",
  "lastName": "REQUIRED",
  "birthDate": "OPTIONAL",
  "citizenship": "NOT_REQUESTED",
  "gender": "NOT_REQUESTED",
  "passportNumber": "NOT_REQUESTED",
  "passportExpiry": "NOT_REQUESTED"
}
```

Do not invent additional traveler fields.

---

# 11. OPTIONAL HARDENING

Only if it is genuinely small and does not alter existing semantics, consider server-side detection of an invalid pin shape.

A malformed object resembling:

```json
{
  "hotel": "...",
  "room": "...",
  "meal": "...",
  "externalOfferId": "..."
}
```

with no traveler requirement keys should be detectable as an invalid snapshot shape.

Preferred behavior is a visible diagnostic rather than silently rendering an empty traveler form.

Possible implementation:

```text
pinnedShape = "traveler_requirements"
pinnedShape = "offer_snapshot"
```

or an equivalent internal validation/error mechanism.

This is OPTIONAL and P2.

Do not make this hardening a reason to redesign the API or UI.

---

# 12. FRONTEND — DO NOT CHANGE THE FORM LOGIC

The audit established that:

```text
TravelerCollectionPanel
```

is correct.

Its logic:

```ts
FIELD_ORDER.filter(
  (field) => (pinned[field] ?? "NOT_REQUESTED") !== "NOT_REQUESTED"
)
```

is correct for a valid `TravelerFullRequirements` object.

Do not replace this with hardcoded fields.

Do not force-render fields when the pin is malformed.

Do not weaken `locked` or `canEdit`.

Do not remove `NOT_REQUESTED`.

The correct fix is upstream data shape.

---

# 13. D3 / COMPLETENESS INVARIANTS

Preserve exactly:

```text
REQUIRED
    → must be non-empty for COMPLETE

OPTIONAL
    → may be empty

NOT_REQUESTED
    → must not be rendered
```

Preserve:

- partial saves;
- server-side completeness;
- empty REQUIRED clear rejection;
- date validation;
- anti-tamper forbidden-key protection;
- versioning;
- OrderHistory;
- PII-safe audit;
- final-confirm CAS/row-lock;
- post-final-confirm immutability.

Do not make `dataCompleteness` client-controlled.

---

# 14. ORDER → BOOKING INVARIANTS

The implementation MUST preserve:

```text
Traveler data
→ COMPLETE
→ validate-completion
→ final-confirm
→ confirm
→ READY_FOR_BOOKING
→ send
→ BookingRequested
→ Booking consumer
→ Booking
→ Passenger
```

No shortcut is allowed.

Do not make Booking creation possible merely because the traveler form now displays fields.

---

# 15. REGRESSION TEST — REQUIRED

Add a regression test covering the exact previously blind path:

```text
createTourRequest
→ Request.pinnedRequirements
→ customerAccept
→ convert
→ Order.pinnedRequirements
→ GET /orders/:id/travelers
→ traveler fields available
```

At minimum assert:

```text
pinnedRequirements.firstName === "REQUIRED"
pinnedRequirements.lastName === "REQUIRED"
pinnedRequirements.birthDate === "OPTIONAL"
```

and:

```text
hotel / room / meal / externalOfferId
```

are NOT being stored as traveler requirement keys.

If a product exists, also test Product-level travelerRequirements override.

If productId is null, test that the canonical TOUR defaults still exist.

---

# 16. END-TO-END REGRESSION

The ideal E2E path is:

```text
public tour offer
→ create Request
→ customerAccept
→ convert
→ Order
→ GET travelers
→ traveler inputs visible
→ PATCH traveler 1
→ PATCH traveler 2
→ validate-completion
→ final-confirm
→ confirm
→ send
→ BookingRequested
→ Booking
→ Passengers
```

The E2E must verify that the D3 gates remain intact.

---

# 17. SOFT E2E EXECUTION — LAPTOP SAFETY

Do NOT run the entire repository E2E matrix in parallel.

Use:

```text
serial execution
maxWorkers = 1
runInBand where supported
```

Run only the relevant suites, one at a time.

Recommended order:

1. TravelerCollectionPanel unit
2. tour-request/request flow regression
3. d3-traveler-collection
4. d3-request-flow
5. order-lifecycle-completion
6. BookingRequested consumer

Do not use:

```text
watch mode
coverage
parallel browser workers
full repository E2E
```

unless explicitly requested.

If the environment becomes unstable:

```text
STOP
```

Do not repeatedly restart infrastructure.

Classify the result:

```text
PASS
FAIL — actual regression
BLOCKED — infrastructure/resource limitation
```

Do not convert BLOCKED into PASS.

---

# 18. TEST MATRIX

Required evidence:

| Area | Required result |
|---|---|
| TravelerCollectionPanel unit | PASS |
| TOUR requirements resolver | PASS |
| tour-request producer | PASS |
| product-backed TOUR requirements | PASS |
| product-less TOUR requirements | PASS |
| Request → Order pin propagation | PASS |
| affected Order repair verification | PASS after owner approval |
| D3 completeness | PASS |
| final-confirm | PASS |
| Order confirm/send | PASS |
| Booking consumer | PASS |
| unrelated existing tests | no new regressions |
| TypeScript | PASS |

For E2E, report exact suites and exact counts.

---

# 19. DATA SAFETY

Before any approved data repair:

```text
SELECT/read current values
→ preserve audit/history
→ update exactly approved records
→ re-read
→ verify
```

Never:

```text
TRUNCATE
DELETE
reset database
reseed unrelated data
rewrite all Orders
rewrite all Requests
```

Do not perform broad data migration.

---

# 20. ACCEPTANCE CRITERIA

The implementation is accepted only if all are true:

### A. Data contract

```text
Request.pinnedRequirements
= TravelerFullRequirements
```

for newly created TOUR Requests.

### B. Product-less path

A product-less TOUR Request still receives valid traveler requirements.

### C. Product override

Existing Product-level traveler requirements continue to override defaults.

### D. Offer data

Offer/search facts remain preserved outside `pinnedRequirements`.

### E. UI

Tour-offer-originated Orders display the correct traveler inputs.

### F. Save

Traveler PATCH works normally.

### G. Completeness

Required firstName/lastName can transition each traveler to COMPLETE.

### H. Final confirmation

Final confirmation remains blocked until all required traveler data is complete.

### I. Booking

Order cannot reach Booking without the existing D3 lifecycle.

### J. Existing behavior

Catalog/product checkout paths continue to work.

### K. No schema redesign

No new Traveler/requirements model or migration.

### L. No unrelated changes

Dirty-worktree work outside this task remains untouched.

---

# 21. STOP CONDITIONS

Immediately stop implementation if any of these occurs:

- the fix requires changing D3 semantics;
- the fix requires weakening completeness;
- the fix requires changing Booking creation authority;
- the fix requires a schema migration;
- the fix requires rewriting the Traveler UI;
- the fix requires broad supplier refactoring;
- the correct existing snapshot destination cannot be determined safely;
- unrelated dirty work would be overwritten;
- live data repair is requested without explicit owner approval;
- E2E infrastructure becomes unstable;
- a test failure cannot be classified safely.

Report the blocker instead of improvising.

---

# 22. FINAL REPORT — REQUIRED FORMAT

Produce:

## 22.1 Executive Verdict

One of:

```text
PASS
PASS WITH E2E BLOCKED
FAIL
BLOCKED
```

## 22.2 Root Cause

State the exact producer/data-shape defect.

## 22.3 Files Changed

List every changed file and why.

## 22.4 Data Flow Before

Show:

```text
offer snapshot → pinnedRequirements → empty traveler form
```

## 22.5 Data Flow After

Show:

```text
offer snapshot → proper snapshot
traveler requirements → pinnedRequirements
```

## 22.6 Tests

Report exact:

```text
suite
passed
failed
skipped
duration
```

## 22.7 E2E Resource Safety

State:

```text
workers
serial/parallel
watch
coverage
infra status
```

## 22.8 Data Repair

State:

```text
owner approval: YES/NO
records repaired:
old values preserved: YES/NO
verification: PASS/FAIL
```

If not approved, explicitly state:

```text
NOT EXECUTED — owner approval required
```

## 22.9 Invariants

Explicitly confirm that D3, completeness, final-confirm, confirm/send, Booking consumer, RBAC and schema were not weakened/changed.

## 22.10 Git Safety

Report:

```text
commit: NO
push: NO
remaining dirty work: ...
```

unless the owner explicitly requests otherwise.

---

# 23. FINAL PRINCIPLE

The correct solution is NOT:

```text
"make the Traveler form show fields anyway"
```

The correct solution is:

```text
make the data contract correct
```

Therefore:

```text
Offer Snapshot
        ↓
existing appropriate snapshot storage

Traveler Requirements
        ↓
Request.pinnedRequirements
        ↓
Order.pinnedRequirements
        ↓
TravelerCollectionPanel
        ↓
existing D3 lifecycle
```

Fix the producer. Preserve the lifecycle. Do not bypass the gates.
