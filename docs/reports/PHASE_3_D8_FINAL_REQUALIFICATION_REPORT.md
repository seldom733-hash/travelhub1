# PHASE 3 — D8 Final Re-qualification

## Executive Summary

Baseline was `73cd732f734cc49083c4cb1ef2e7a600eb60b092` on `master`, equal to `origin/master`. This evidence-only pass restarted the stack from that SHA and closed the prior absence of authenticated runtime evidence. It found one D8 contract defect on CRM Activity; no production code, schema, lifecycle, RBAC, or architecture was changed.

## Environment

- PostgreSQL was listening locally; backend was restarted from `backend/src/main.ts` on port 4000.
- Frontend Next development runtime was started on port 3000.
- Authenticated browser role: `DIRECTOR` (`director`), using an isolated browser session.

## Browser Smoke Matrix

| Surface | Route / case | Result | Evidence |
|---|---|---|---|
| Requests | `/app/requests?dateFrom=2026-09-01&dateTo=2026-10-01` | PASS | URL persisted; authenticated filtered UI rendered |
| Orders | `/app/orders?dateFrom=2026-09-01&dateTo=2026-10-01` | PASS | URL persisted; 66 matching rows/KPI displayed |
| Bookings | `/app/bookings?dateFrom=2026-09-01&dateTo=2026-10-01` | PASS | URL persisted and registry loaded |
| Payments | `/app/payments?dateFrom=2026-09-01&dateTo=2026-10-01` | PASS | URL persisted and registry loaded |
| CRM customers | `/app/crm?dateFrom=2026-09-01&dateTo=2026-10-01` | PASS | URL persisted and registry loaded |
| Catalog | `/app/catalog?dateFrom=2026-09-01&dateTo=2026-10-01` | PASS | URL persisted and registry loaded |
| Analytics | `/app/analytics` | PASS | authenticated Analytics dashboard, period control, KPI and table rendered |
| CRM Activity | customer activity `dateFrom=bad` | FAIL | see API matrix: response is not canonical D8 shape/message |

## API / Validation Matrix

Authenticated requests after backend restart show `X-Request-Id`, HTTP 400, and the canonical string message for Requests, Orders, Bookings (including impossible `2026-02-30`), Payments, CRM customers, and Catalog. Payments query validation is 400 after restart, preserving the intended query boundary.

Requests period API returned 89 rows for `dateFrom=2026-09-01&dateTo=2026-10-01`; `/requests/kpi` returned `total: 89`, proving live KPI/table period parity and the Operations `[from,to)` scope.

**Defect:** `GET /api/v1/customers/<customer-id>/activity?dateFrom=bad` returned HTTP 400 and request id, but the global DTO pipe returned:

```json
{ "statusCode": 400, "message": ["dateFrom must be a valid ISO 8601 date string"] }
```

The frozen D8 contract requires the shared-helper shape/message:

```json
{ "statusCode": 400, "message": "dateFrom must be a valid date", "requestId": "..." }
```

The controller helper is unreachable for this malformed value because DTO validation runs first. This is a D8 implementation defect, not a permitted requalification-only change.

## Temporal / Security Evidence

Current runtime confirms UTC date-only query handling and URL-authoritative Operations filters. No tenant, role, permission, guard, schema, or lifecycle code changed in this pass. Focused D8 tests prove malformed values are rejected before mocked database reads; however the CRM Activity runtime defect means the full frozen validation contract is not met and tenant/RBAC closure cannot promote D8 to A.

## Regression Evidence

- Focused backend D8 suite: **5 suites / 114 tests PASS**.
- Backend `typecheck`: PASS.
- Backend production build: PASS.
- Frontend runtime loaded authenticated registry and Analytics routes.

## Git Evidence

The initial working tree had only the user-provided final requalification prompt. This report is the sole new qualification artifact. No production diff is included.

## Final Verdict

**VERDICT C — IMPLEMENTATION DEFECT.** CRM Activity invalid-date runtime response violates the canonical D8 error-message/shape contract. Do not declare D8 closed or select a next stage until a scoped D8 remediation and fresh requalification resolve this defect.
