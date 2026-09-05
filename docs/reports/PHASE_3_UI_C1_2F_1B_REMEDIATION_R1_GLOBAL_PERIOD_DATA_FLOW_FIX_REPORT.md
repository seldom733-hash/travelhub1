# PHASE 3 — UI-C1.2F.1B — REMEDIATION R1 — GLOBAL PERIOD DATA-FLOW FIX — REPORT

## Executive Summary

P0 functional defect fixed: Header Period was visually present but `dateFrom/dateTo` never reached KPI or table requests because all four registries used `useState(initialDateFrom)` which only reads the initial value on mount. Added `useEffect` sync in all four registries. Period A/B proof: all four registries produce demonstrably different scoped data. Removed legacy "Обновить" button from Orders header.

## Root Cause (All 4 Registries)

```ts
// ANTI-PATTERN — reads ONCE at mount, never updates when URL changes
const [dateFrom] = useState(initialDateFrom);
```

`useState` ignores subsequent `initialDateFrom` prop values after first render. When Header Period changed the URL → parent re-rendered → new prop arrived → but local state stayed stale → API calls used old period.

## Fix

Added `useEffect` sync in all four registries:

```ts
const [dateFrom, setDateFrom] = useState(initialDateFrom || "");
const [dateTo, setDateTo] = useState(initialDateTo || "");
useEffect(() => {
  setDateFrom(initialDateFrom || "");
  setDateTo(initialDateTo || "");
}, [initialDateFrom, initialDateTo]);
```

Also removed legacy "Обновить" `headerActions` button from Orders.

## Period A/B Runtime Proof

| Registry | Period A (Sep 2026) | Period B (Oct 2026) | Difference |
|---|---:|---:|---|
| Requests | 82 | 60 | ✅ PASS |
| Orders | 66 | 47 | ✅ PASS |
| Bookings | 48 | 29 | ✅ PASS |
| Payments | 52 | 36 | ✅ PASS |

## Header Clear Proof

Orders with no period: **508** (all-time) — different from both A and B.

## Tests

| Suite | Result |
|---|---|
| Frontend TSC | PASS |
| Frontend build | PASS |
| operations-center-shell | 19/19 PASS |
| bookings-registry | 48/48 PASS |
| orders-registry | 58/58 PASS |
| requests-registry | 51/51 PASS |
| **Total targeted** | **176/176** |
| Full vitest | 566/567 (1 pre-existing) |

## Files Changed

| File | Change |
|---|---|
| `frontend/app/app/requests/page.tsx` | Add dateFrom/dateTo sync useEffect |
| `frontend/app/app/orders/page.tsx` | Add dateFrom/dateTo sync useEffect + remove legacy Обновить |
| `frontend/app/app/bookings/page.tsx` | Add dateFrom/dateTo sync useEffect |
| `frontend/app/app/payments/page.tsx` | Add dateFrom/dateTo sync useEffect |

## Git Hard Closure

```
git status — CLEAN
HEAD == origin/master — YES
```

## Final Verdict

```
VERDICT A — UI-C1.2F.1B
SHARED OPERATIONS CENTER HEADER PERIOD
— ACCEPTED AFTER REMEDIATION R1

BASELINE ACCEPTED SHA: 4f71acc60631e0a90825185a01d4574853412d83
ORIGINAL UI-C1.2F.1B SHA: 41ffc23138180c8006084b9a87a6681cf89be0d5
FINAL SHA: ea5f6dc533dea49238a33627baf0586ace481758

REQUESTS PERIOD → KPI/TABLE       — PASS
ORDERS PERIOD → KPI/TABLE         — PASS
BOOKINGS PERIOD → KPI/TABLE       — PASS
PAYMENTS PERIOD → KPI/TABLE       — PASS
PERIOD A/B RUNTIME PROOF          — PASS
NO LOCAL DATE CONTROLS            — PASS
ORDERS LEGACY UPDATE BUTTON       — ABSENT
REGRESSION                        — PASS
WORKING TREE CLEAN                — PASS
HEAD == origin/master             — PASS

KNOWN DEFERRED GAP:
Requests table sorting — deferred to table-header/sorting work

TRUE NEXT: UI-C1.2F.1C — Shared TableHeaderFilter Component
```
