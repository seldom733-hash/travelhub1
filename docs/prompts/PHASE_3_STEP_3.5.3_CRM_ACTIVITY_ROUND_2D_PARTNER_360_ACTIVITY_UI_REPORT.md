# PHASE 3 — STEP 3.5.3 — ROUND 2D
# PARTNER 360 ACTIVITY UI — REPORT

## РЕПОЗИТОРИЙ

- Starting HEAD: `990e59905b3aa06b78f6767fdd152c5d6f98aa45`
- Branch: `master`
- Worktree: `/d/travelhub_v1`

## PARTNER 360 AUDIT

- Existing tabs: overview, services, orders, bookings, customers, storefront, notes
- Activity position: after overview, before services (position 2)
- Detail API: `GET /partners/:id` — existing
- Activity infrastructure: `GET /partners/:partnerId/activity` — existing (Round 2B)

## PARTNER SUBJECT AUTHORITY

- ORDER: `Order.sellerPartnerId` ✓ (direct)
- BOOKING: `Booking.orderId → Order.sellerPartnerId` ✓ (derived, cross-schema)
- PAYMENT: `Payment.orderId → Order.sellerPartnerId` ✓ (derived, cross-schema)
- REFUND: `Refund → Payment → Order.sellerPartnerId` ✓ (derived, cross-schema)
- NOTES/OTHER: `OperationalNote.partnerId` ✓ (direct, for Partner entity type)
- CUSTOMER_HISTORY: `null` — no canonical partner authority
- Unsupported: `MESSAGE`, `AUDIT_EVENT`, `BUYER_REQUEST`, `PARTNER_APPLICATION` — no partnerId
- Cross-schema strategy: batch `findMany` + `Map`, no N+1
- N+1: none

## PARTNER ACTIVITY API

- Route: `GET /api/v1/partners/:partnerId/activity`
- RBAC: `crm.activity.read` (LEVEL 1) + source-specific (LEVEL 2)
- Filters: sourceType, activityType, dateFrom, dateTo
- Cursor: `{occurredAt, id}` decode/encode
- Subject authority: partnerId from route, validated against Partner table
- Wrong Partner: 0
- Cross-partner leakage: 0

## HISTORICAL PROJECTION

- Required: all ORDER/BOOKING/PAYMENT/REFUND with partnerId from Order.sellerPartnerId
- Reconciliation: full `rebuildAll()` executed (Round 2C.2R already fixed adapters)
- Scanned: 1574 PAYMENT, 1514 ORDER, 691 BOOKING, 417 REFUND
- Errors: 0

## LIVE PROJECTION

- Event: new Payment/Order/Booking/Refund
- Partner: derived from `Order.sellerPartnerId`
- Activity: `partnerId` set by adapter.project()
- Manual rebuild: NOT required

## REPRESENTATIVE PARTNERS

- A: Baku Tours Pro (`aad76dd9-93ad-4d1c-107a-54b4b5adc8a2`) — 1964 activities
- B: Azerbaijan Journeys (`ebf26ef0-f2d3-4ebe-843-bbcbdd369a47`) — 91 activities

## A→B→A ISOLATION

- A: 3 items, ids: [633b62c6, fe624f38, ef88063e]
- B: 3 items, ids: [94e92b53, 98caa75f, aa65e5d4]
- A again: 3 items, ids: [633b62c6, fe624f38, ef88063e]
- A events in B: 0
- B events in A: 0
- Stale items: 0

## PARTNER 360 UI

- Tab: Activity (position 2, after Overview)
- Filters: source dropdown + date range
- Load more: cursor-based pagination
- Empty: "Активность не найдена" / "No activity found"
- Error: "Ошибка загрузки активности"
- Links: deep links via item.deepLink (ORDER → /app/orders/:id, etc.)

## I18N

- RU: "Активность" ✓
- AZ: "Fəaliyyət" ✓
- EN: "Activity" ✓
- All source/event labels: existing (from Round 2C)
- Mixed locale: 0
- Raw enums: 0
- Raw keys: 0

## CUSTOMER REGRESSION

- CRM-00000089 Payments: 4/4 ✓
- CRM-00000089 Activity PAYMENT: 4/4 ✓
- Wrong customer: 0
- Duplicates: 0
- Customer A→B→A: PASS

## TESTS / BUILDS

- Backend TSC: PASS
- Backend CRM Activity: 83 passed, 2 pre-existing failures
- Frontend TSC: PASS
- Frontend tests: 28/28 files, 243/243 tests passed
- New failures: 0

## FILES CHANGED

1. `frontend/lib/api.ts` — added `activityApi.listPartner()`
2. `frontend/components/PartnerActivity.tsx` — new component (following CustomerActivity pattern)
3. `frontend/app/app/crm/partners/[id]/page.tsx` — added Activity tab + import
4. `frontend/lib/i18n.tsx` — added `crm.partner_detail.activity` key

## SCHEMA / MIGRATION

- Schema changed: NO
- Migration changed: NO

## ROADMAP

- Round 2C.2R: CLOSED (990e599)
- Round 2D: VERDICT A
- Next: Round 2E

## VERDICT

```
VERDICT A — PHASE 3 STEP 3.5.3 /
CRM COMMUNICATIONS + ACTIVITY TIMELINE /
ROUND 2D — PARTNER 360 ACTIVITY UI /
PARTNER SUBJECT AUTHORITY + UNIFIED ACTIVITY TIMELINE +
FILTERS + CURSOR PAGINATION + I18N + RUNTIME EVIDENCE /
FULLY CLOSED
```
