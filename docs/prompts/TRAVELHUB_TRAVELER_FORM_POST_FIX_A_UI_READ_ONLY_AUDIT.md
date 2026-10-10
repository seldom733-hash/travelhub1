# TRAVELHUB — TRAVELER FORM POST-FIX-A UI READ-ONLY AUDIT

## Mission
FIX A is implemented and backend/E2E evidence is green, but the real Order screen reportedly still has no usable traveler input fields. Perform a **strict read-only browser/UI audit** to determine why.

## CRITICAL
Do **NOT** execute FIX B.
Do **NOT** repair live data.
Do **NOT** update TH-2026-000101, MKT-REQ-00000402, MKT-REQ-00000301, or MKT-REQ-00000401.
No DB INSERT/UPDATE/DELETE, no Booking creation, no final-confirm/confirm/send on live Orders, no commit/push.

## Sources
Use:
- `TRAVELHUB_TRAVELER_FORM_READ_ONLY_AUDIT_REPORT.md`
- `TRAVELHUB_TRAVELER_REQUIREMENTS_DATA_SHAPE_FIX_IMPLEMENTATION_REPORT.md`
- `TRAVELHUB_TRAVELER_REQUIREMENTS_DATA_SHAPE_FIX_STRICT_IMPLEMENTATION_PROMPT.md`

Do not assume that programmatic E2E proves browser UI usability.

## Primary question
Can an authorized human operator open a real Order and see, edit, save, and persist the traveler fields required by its `pinnedRequirements`?

If YES: document the exact UI path and fields.
If NO: identify the exact first broken boundary and the smallest safe fix. Do not implement it.

## Browser verification
Open the real Order UI using an existing safe Order. Prefer `TH-2026-000101` only for read-only inspection. If its data is unsuitable because FIX B is still on hold, use an existing non-production/test Order with canonical traveler requirements. Do not create or mutate Orders.

Trace:
`Order page → ДАННЫЕ ТУРИСТОВ → TravelerCollectionPanel → GET /orders/:id/travelers → pinnedRequirements → fieldsFor → DOM inputs`

Record actual:
- `pinnedRequirements`
- `fieldsFor`
- `travelers.length`
- `canEdit`
- `locked`
- rendered DOM inputs
- console/runtime errors

## Network/API
Inspect actual `GET /orders/{id}/travelers` in the browser.
Record HTTP status, response shape, `pinnedRequirements`, traveler count and editability information.

Canonical TOUR requirements are:
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

If browser receives a different shape, classify as API/data-path discrepancy. Do not repair it.

## Rendering classification
If fields are absent, classify exactly one primary cause:
A. wrong `pinnedRequirements` shape
B. correct shape but `fieldsFor=[]`
C. `fieldsFor` has fields but React does not render
D. DOM inputs exist but hidden by CSS/layout
E. `locked`
F. `canEdit`/permission
G. wrong Order/tenant/API response
H. stale/cached frontend data
I. runtime/frontend error
J. other, with evidence

Do not guess.

## Required TOUR UI
With default TOUR requirements, verify:
- `firstName` visible
- `lastName` visible
- `birthDate` visible if OPTIONAL fields are rendered by current UI contract
- `citizenship`, `gender`, `passportNumber`, `passportExpiry` absent unless Product override enables them

## Editability
Verify `locked`, `canEdit`, and `order.edit_noncritical`. Do not change permissions. If the issue is permission, report it only.

## Save
Do NOT save into a live Order. Trace the existing source/test path:
`input → state → PATCH /orders/:id/travelers/:travelerId → refetch`.
If no isolated disposable environment exists, report save interaction as NOT EXECUTED.

## E2E coverage
Determine whether the existing `tour-offer-traveler-pin.e2e-spec.ts` actually verifies a real browser DOM and operator interaction. If it only proves backend/API behavior, state:
`E2E proves backend/API lifecycle but does not prove real browser UI usability.`

## No modifications
No frontend/backend/schema/migration/test/data/permission/config changes. Temporary diagnostics must be outside the repo or deleted before final report.

## Final report
Use exactly one verdict:
`UI PASS`
`UI FAIL — DATA/API`
`UI FAIL — FRONTEND`
`UI FAIL — PERMISSION`
`UI FAIL — RUNTIME`
`UI BLOCKED — ENVIRONMENT`

Include:
1. Order and route
2. User role
3. GET endpoint/status
4. actual `pinnedRequirements`
5. travelers
6. `canEdit`
7. `locked`
8. `fieldsFor`
9. DOM inputs
10. exact root cause
11. E2E coverage classification
12. smallest safe fix if UI fails (do not implement)
13. data-safety confirmation:
   - live UPDATE/INSERT/DELETE: NO
   - FIX B: NOT EXECUTED
   - Booking/final-confirm/confirm/send: NO
   - commit/push: NO

## Stop conditions
STOP if live mutation, permission changes, destructive reset, or uncertain production scope would be required. Report the blocker.

## Final principle
We are answering only:
**After FIX A, can a real human operator actually see and use the traveler input form in the Order UI?**

FIX B remains HOLD until this UI question is resolved.
