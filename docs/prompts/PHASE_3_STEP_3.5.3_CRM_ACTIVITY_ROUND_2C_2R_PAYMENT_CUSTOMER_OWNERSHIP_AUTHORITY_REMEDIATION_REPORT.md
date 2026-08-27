# PHASE 3 — STEP 3.5.3 — ROUND 2C.2R
# PAYMENT CUSTOMER OWNERSHIP AUTHORITY REMEDIATION — REPORT

## РЕПОЗИТОРИЙ

- Starting HEAD: `a8627f06bcf45c53b6a7e994f042b656d7dcdb5b`
- Branch: `master`
- Worktree: `/d/travelhub_v1`

## ROUND 2C.2

- Previous closure: `a8627f0` — evidence-only closure
- Runtime finding: Payments tab ≠ Activity/Payment (structural inconsistency)
- Reopened: YES
- Re-closed: Pending VERDICT A

## ROOT CAUSE

- Old Payments authority: `Orders (take:20) → Payments WHERE orderId IN` — missed payments from orders beyond first 20
- Old Activity authority: `CrmActivity.customerId = routeCustomerId` — only payments with direct customerId got Activity records
- First-20 defect: Payments from orders beyond first 20 were invisible in both tabs
- Order-derived Activity defect: Payments with customerId=null (order-derived) got no CrmActivity records with customerId
- Files/methods: `backend/src/modules/crm/crm.service.ts:getCustomerDetail()`, `backend/src/modules/crm-activity/crm-activity.adapters.ts:PaymentAdapter.project()`, `PaymentAdapter.backfill()`

## CANONICAL PAYMENT OWNERSHIP

- Direct: `Payment.customerId == Customer.id`
- Order-derived: `Payment.orderId → Order.customerId == Customer.id`
- Dual-link: 29 payments (all SAME — no conflicts)
- Conflict precedence: direct > order-derived (but all 29 are consistent)
- Unresolvable: 0

## OBSERVED CUSTOMER

- Code: CRM-00000089
- ID: `0c534877-7dee-4d33-1078-68e39c8fe785`

## PAYMENT MATRIX (after fix)

```
┌─────────────────┬───────────────┬─────────────────┬──────────────────────┬──────────────┬──────────────┬────────┐
│ Payment         │ Direct        │ Order→Customer  │ Canonical            │ Payments Tab │ Activity     │ Result │
│                 │ customerId    │                 │ Customer             │ API/UI       │ PAYMENT      │        │
├─────────────────┼───────────────┼─────────────────┼──────────────────────┼──────────────┼──────────────┼────────┤
│ PAY-00000557    │ null          │ CRM-00000089    │ CRM-00000089         │ ✓            │ ✓            │ PASS   │
│ PAY-00000616    │ null          │ CRM-00000089    │ CRM-00000089         │ ✓            │ ✓            │ PASS   │
│ PAY-00000856    │ null          │ CRM-00000089    │ CRM-00000089         │ ✓            │ ✓            │ PASS   │
│ PAY-00007001    │ CRM-00000089  │ CRM-00000089    │ CRM-00000089         │ ✓            │ ✓            │ PASS   │
└─────────────────┴───────────────┴─────────────────┴──────────────────────┴──────────────┴──────────────┴────────┘
```

## GLOBAL PAYMENT AUDIT

- Total payments: 816
- Direct customerId: 29
- Order-derived (null cust): 787
- Dual-link: 29
- Conflicts: 0
- Unresolvable: 0
- Expected PAYMENT activities: 816
- Actual matching: 816
- Missing: 0
- Wrong customer: 0
- Orphans: 0
- Duplicates: 0
- Code mismatch: 0
- Activities with customerId (before): 29
- Activities with customerId (after): 816
- Activities with null customerId (after): 0

## CUSTOMER PAYMENTS FIX

- Old query: `Payments WHERE orderId IN (first 20 order IDs)`
- New query: `Direct payments WHERE customerId = id UNION order-derived payments WHERE orderId IN (ALL order IDs)`, deduped by Payment.id
- Limit/pagination: Applied AFTER merge (take:20 on merged set)
- Ordering: Deterministic sort on merged set
- Deduplication: Map-based dedupe, direct payments take precedence

## ACTIVITY FIX

- Historical: Full backfill with fixed adapter (derives customerId from Order when customerId=null)
- Live: Same `PaymentAdapter.project()` — now resolves `source.customerId ?? source.order?.customerId`
- SourceId: Preserved (exact Payment.id)
- CustomerId: Canonical (direct or order-derived)
- Timestamp/event semantics: `paidAt` for CAPTURED, `createdAt` otherwise

## LIVE PROJECTION PROOF

- New Payment with customerId=null → orderId → Customer A
- Activity correctly derives customerId from Order
- Manual rebuild not required for new events

## A→B→A ISOLATION

- A (CRM-00000089): 4 PAYMENT activities
- B (CRM-00000067): 1 PAYMENT activity
- A again: 4 PAYMENT activities (same as step 1)
- A events in B: 0
- B events in A: 0
- Stale items: 0
- Wrong subject requests: 0

## API PROOF

- Payments tab: 4 payments (PAY-00000557, PAY-00000616, PAY-00000856, PAY-00007001)
- Activity PAYMENT: 4 items (matching sourceIds)
- Canonical match: 4/4

## REGRESSION

- ORDER Activity: unchanged (backfill reprojected, 0 errors)
- BOOKING Activity: unchanged (backfill reprojected, 0 errors)
- REFUND Activity: unchanged (backfill reprojected, 0 errors)
- Operational Notes: unchanged
- History remains removed: confirmed
- Backfill lock preserved: confirmed (isRebuilding flag)
- RU/AZ/EN: unchanged

## TESTS / BUILDS

- Backend TSC: PASS (exit 0)
- Backend build: PASS
- CRM Activity tests: 83 passed, 2 failed (pre-existing, not caused by this change)
- CRM Activity controller tests: PASS
- Frontend TSC: PASS (exit 0)
- Frontend tests: 17/17 files, 164/164 tests passed
- Pre-existing failures: 2 (BookingAdapter partnerId, Order metadata — identical on original `a8627f0`)

## FILES CHANGED

1. `backend/src/modules/crm/crm.service.ts` — canonical payment ownership in getCustomerDetail()
2. `backend/src/modules/crm-activity/crm-activity.adapters.ts` — PaymentAdapter.project() and backfill() canonical ownership

## SCHEMA / MIGRATION

- Schema changed: NO
- Migration changed: NO

## ROADMAP

- Round 2C.2: REOPENED → RE-CLOSED (after this VERDICT A)
- Round 2C.2R: VERDICT A
- Round 2D: NEXT (Partner 360 Activity UI)

## VERDICT

```
VERDICT A — PHASE 3 STEP 3.5.3 /
CRM COMMUNICATIONS + ACTIVITY TIMELINE /
ROUND 2C.2R — PAYMENT CUSTOMER OWNERSHIP AUTHORITY REMEDIATION /
CUSTOMER PAYMENTS + HISTORICAL/LIVE PAYMENT ACTIVITY /
CANONICAL OWNERSHIP + RUNTIME CONSISTENCY /
FULLY CLOSED
```
