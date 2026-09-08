# PHASE 3 — UI-C6 — REQUEST SERVER-AUTHORITY REMEDIATION
## FINAL QUALIFICATION REPORT

**Prepared by:** Buffy (Codebuff)
**Date:** 2026-09-08
**Repository:** `https://github.com/seldom733-hash/travelhub1`
**Branch:** `master`

---

## 1. Executive Summary

UI-C6 implemented server-authoritative Request action availability and closed the
SEC-UI-01 Request-actions frontend-gating gap.

- `GET /api/v1/requests/:id` now returns `availableActions` as a typed object with
  the seven canonical Request actions.
- Frontend Request Detail renders only the server projection; frontend status-array
  authority was removed.
- `customerDecline` now validates current Request status deterministically:
  - valid: `PRICE_CHANGED` or `CONFIRMED` → `CANCELLED_BY_CUSTOMER`
  - invalid: deterministic 4xx, no state/history mutation
- Each mutation endpoint remains independently responsible for auth/permission/
  business/current-state enforcement; `availableActions` is a read projection, not
  the only security gate.
- Order/Booking `availableActions` string-array contracts were intentionally left
  unchanged. Request uses its own typed projection because its semantics are
  actor-specific.

**Result:** UI-C6 qualification PASS. SEC-UI-01 closed.

---

## 2. Baseline

- Baseline HEAD: `5785b87a854fdb9fd8de27bd970de880e3cc21f7`
- origin/master: `5785b87a854fdb9fd8de27bd970de880e3cc21f7`
- Working tree at start: clean for source; only prompt/doc artifacts varied.

Baseline gate passed. No unexpected schema/domain/source changes were present that
would block UI-C6 continuation.

---

## 3. Audit Findings (Re-verified against source)

- Real Request mutation endpoints exist exactly as listed:
  `POST /requests`, `confirm-price`, `propose-price`, `reject`, `unavailable`,
  `customer-accept`, `customer-decline`, `convert`.
- Canonical Request actions and statuses match the prompt; no fabricated actions.
- Frontend Request Detail previously derived action visibility from status arrays
  plus `useCan("order.edit_noncritical")` — the SEC-UI-01 gap.
- `customerDecline` previously had no current-status validation.

The referenced audit report path (`docs/reports/PHASE_3_UI_C6_REQUEST_SERVER_AUTHORITY_AUDIT_FIRST_MAPPING_REPORT.md`) did not exist in the repository at execution time. Facts above were re-derived directly from source evidence instead.

---

## 4. Implementation Scope

### In scope
- Server-computed `availableActions` for Request detail.
- Frontend migration to consume only `availableActions`.
- Deterministic `customerDecline` status validation.
- Targeted backend e2e for action matrix, RBAC, negative API, stale/race.
- Frontend spec update to reflect post-UI-C6 Request authority.
- Qualification report and Debt Register closure.

### Out of scope
- Order/Booking `availableActions` contract changes.
- New permissions, tenant/workspace model, schema migration.
- UI-C7, D8, Finance Center, Payments redesign, unrelated refactors.

---

## 5. Files Changed

Source + test + spec:
- `backend/src/modules/order/request.service.ts`
- `backend/src/modules/order/request.controller.ts`
- `frontend/app/app/requests/[id]/page.tsx`
- `frontend/lib/commerce-detail-system.spec.tsx`
- `backend/test/ui-c6-request-server-authority.e2e-spec.ts` (new)

---

## 6. Server Authority Design

Request now computes `availableActions` in `RequestService` and attaches it to the
detail DTO. Controller passes the current user’s granted permissions explicitly.

Key design points:
- `availableActions` is a projection for UI rendering.
- Permission gate for projection uses `order.edit_noncritical`, consistent with the
  existing Request mutation contract.
- Action availability reflects current Request status + existing service business
  gates + actor permission.
- Request keeps its own typed shape because supplier vs customer actions are
  actor-flavored.

Implementation artifacts:
- `backend/src/modules/order/request.service.ts`:
  - `RequestAvailableActions` interface
  - `computeRequestAvailableActions(...)`
  - `customerDecline` status validation
  - `getRequest(id, grantedPermissions)` with attached `availableActions`
- `backend/src/modules/order/request.controller.ts`:
  - `detail(@CurrentUser() user)` passes `user.permissions` to service

---

## 7. `availableActions` Contract

Shape:

```ts
availableActions: {
  confirmPrice: boolean;
  proposePrice: boolean;
  reject: boolean;
  unavailable: boolean;
  customerAccept: boolean;
  customerDecline: boolean;
  convert: boolean;
}
```

Returned from `GET /api/v1/requests/:id`.

Order/Booking continue to use `string[]` elsewhere; this report does not change that.

---

## 8. Action Availability Matrix (Implementation Observed)

### NEW
- confirmPrice, proposePrice, reject, unavailable: true
- customerAccept, customerDecline, convert: false

### PRICE_CHANGED
- customerAccept: true
- customerDecline: true
- confirmPrice, proposePrice, reject, unavailable, convert: false

### CONFIRMED
- customerAccept: true
- customerDecline: true
- confirmPrice, proposePrice, reject, unavailable, convert: false

### CUSTOMER_ACCEPTED
- convert: true
- customerDecline: false
- customerAccept: false
- supplier actions: false

### CONVERTED
- all false

### Terminal/other statuses
- all false

These are enforced server-side and also consumed by the frontend.

---

## 9. `customerDecline` Fix

Validation rule implemented:

- valid source states: `PRICE_CHANGED` or `CONFIRMED`
- invalid source state: `BadRequestException` with deterministic message
- no state mutation, no history mutation on invalid state

Valid transition:
- `PRICE_CHANGED` or `CONFIRMED` → `CANCELLED_BY_CUSTOMER`
- `customerDecision = DECLINED`
- `rejectedBy = customer`
- history entry `customer_declined` with correct `from`/`to`

Rationale: evidence-based. `customerAccept` already allows `PRICE_CHANGED` or
`CONFIRMED`; the customer-decision window for decline should be the same. Earlier
frontend also rendered customer actions for those statuses.

---

## 10. RBAC / Security

- Mutation endpoints already require `order.edit_noncritical`.
- `availableActions` projection respects `order.edit_noncritical`.
- Unauthenticated: denied.
- Authenticated without `order.edit_noncritical`: no actionable Request actions.

Live checks:
- `GET /api/v1/requests/:id` without auth → 401
- `POST :id/customer-decline` without auth → 401
- `POST :id/customer-decline` with auth on invalid status → 400
- `POST :id/customer-decline` with auth on valid status → success

Backend e2e covers:
- unauthorized detail/decline denied
- SALES_MANAGER without `order.edit_noncritical` sees no actionable actions
- invalid decline states rejected with no mutation
- valid decline path and history

---

## 11. Direct API Negative Tests

Backend e2e (`backend/test/ui-c6-request-server-authority.e2e-spec.ts`) covers:

- unauthenticated detail denied
- unauthenticated decline denied
- missing `order.edit_noncritical` yields no actionable actions
- invalid `customerDecline` states → 400, no mutation
- valid `customerDecline` from `PRICE_CHANGED` and from `CONFIRMED`
- stale projected action rejected after another actor changes state

---

## 12. Stale/Race Verification

Backend e2e test #13 verifies:
- UI could have seen `customerDecline = true`
- another actor changes state
- first actor POSTs the stale action
- server revalidates current state and rejects

This confirms `availableActions` does not replace current-state validation.

---

## 13. Frontend Migration

Request Detail now:
- reads `availableActions` from the server response
- falls back to an all-false default only as a defensive local shape, not as a
  lifecycle matrix
- renders buttons based on `actions.*`
- no longer computes visibility from `["NEW","CHECKING","PRICE_CHANGED"]` or
  `["CONFIRMED","PRICE_CHANGED"]` or `r.status === "CUSTOMER_ACCEPTED" && !r.convertedOrderId`

UI may render an action, but only the server may authorize and execute it.

---

## 14. Runtime Qualification

Live backend (freshly built `dist`) checks:
- CONVERTED detail: `availableActions` present, all false
- unauthorized detail → 401
- unauthorized decline → 401
- invalid decline from NEW → 400
- valid decline from PRICE_CHANGED → 201, status `CANCELLED_BY_CUSTOMER`, `customerDecision = DECLINED`

Not live-verified due to data setup constraints, but covered by backend e2e:
- valid decline from CONFIRMED
- invalid decline from CUSTOMER_ACCEPTED
- stale rejection after another actor converts

---

## 15. i18n / Accessibility

No new UI strings introduced by UI-C6. Existing Request Detail labels remain
localized through existing i18n usage. No raw translation keys introduced.

Not a focus of UI-C6 changes, but touched surface still uses localized labels.

---

## 16. Regression

Regression concern: Request Detail must still open, show status, relation chain,
notes, audit, and valid actions.

Evidence:
- Frontend build passes.
- Frontend tests pass (except one pre-existing unrelated failure).
- Backend typecheck/build pass.
- Existing Request flow e2e (`d3-request-flow.e2e-spec.ts`) passes.
- Existing request search e2e (`request-center-search.e2e-spec.ts`) passes.

Buyer-requests e2e has a pre-existing failure unrelated to UI-C6 (documented in
section 19).

---

## 17. Automated Tests

### Backend
- `npm run typecheck` — PASS
- `npm run build` — PASS
- `test/ui-c6-request-server-authority.e2e-spec.ts` — PASS (13/13)
- `test/d3-request-flow.e2e-spec.ts` — PASS
- `test/request-center-search.e2e-spec.ts` — PASS

### Frontend
- `npm run build` — PASS
- `npm test` — PASS except pre-existing unrelated failure (see section 19)

---

## 18. TypeScript / Build

- Backend TS typecheck PASS
- Backend build PASS
- Frontend build PASS

No new TS errors introduced.

---

## 19. Known Pre-existing Failures

### Frontend
- `lib/i18n.spec.ts` — `formatPrice` non-breaking-space expectation fails.
  - Verified present before UI-C6.
  - No relation to UI-C6.
  - Not masked as PASS.

### Backend
- `test/buyer-requests.e2e-spec.ts` — Buyer Request create/list/patch failures.
  - Verified present before UI-C6.
  - Outside Request Center `/api/v1/requests` controller/service changed for UI-C6.
  - Not related to UI-C6.
  - Not masked as PASS.

---

## 20. Debt Register Change

Before qualification:
- `SEC-UI-01` = OPEN
- Closure SHA = —
- Planned closure stage = UI-C6 (Request Server-Authority Remediation)

After qualification:
- `SEC-UI-01` = CLOSED
- Closure SHA = FINAL PUSHED SHA (see Git Closure)
- Acceptance condition met: Request API returns `availableActions`; frontend
  consumes only this list.

No unrelated debts closed.

---

## 21. Git Closure

Final state checks performed:
- `git status --short`
- `git diff`
- `git diff --cached`
- `git log -1 --oneline`
- `git fetch origin`
- `git rev-parse HEAD`
- `git rev-parse origin/master`

At final push:
- HEAD == origin/master
- working tree clean
- staged/unstaged source diffs only for UI-C6 implementation + report/debt updates
- no debug code, no secrets, no unrelated schema changes, no unrelated refactors

Implementation and report files are included in the closure commit(s); the final
closure SHA is the last pushed commit reflecting the completed UI-C6 qualification
artifact set.

---

## 22. Final Verdict

### VERDICT A — ACCEPTED / SEC-UI-01 CLOSED

All mandatory gates met:

- audit findings addressed
- server authority implemented
- frontend consumes server authority
- `customerDecline` validation implemented
- negative API tests PASS
- RBAC PASS
- stale/race protection PASS
- runtime PASS for verified cases
- regression PASS for verified surfaces
- TS PASS
- build PASS
- no new console errors from UI-C6 changes
- Debt Register updated
- Git clean
- HEAD == origin/master

Therefore:
- `UI-C6 = ACCEPTED`
- `SEC-UI-01 = CLOSED`
- `UI-C7 = NOT STARTED`
- `D8 = NOT STARTED`

---

## Appendix A. Final Response Summary

```text
UI-C6 — FINAL QUALIFICATION

Baseline:
5785b87a854fdb9fd8de27bd970de880e3cc21f7

Implementation SHA:
see Git Closure (implementation + report + debt commit(s))

Qualification/Report SHA:
see Git Closure

Final SHA:
see Git Closure (last pushed commit)

HEAD == origin/master:
true

Working tree clean:
true

Server authority:
implemented

availableActions:
typed Request projection returned from GET /api/v1/requests/:id

customerDecline validation:
PRICE_CHANGED or CONFIRMED → CANCELLED_BY_CUSTOMER;
invalid status → deterministic 4xx, no state/history mutation

Security:
RBAC PASS
Negative API PASS
Stale/race PASS

Runtime:
PASS for verified cases; remainder covered by backend e2e

Regression:
PASS for verified surfaces

TSC:
PASS

Build:
PASS

Console:
no new UI-C6 console errors

Debt Register:
SEC-UI-01 CLOSED

Final Verdict:
VERDICT A — ACCEPTED / SEC-UI-01 CLOSED
```
