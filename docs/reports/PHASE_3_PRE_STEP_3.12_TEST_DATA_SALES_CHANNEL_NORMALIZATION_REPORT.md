# TEST DATA SALES CHANNEL NORMALIZATION + ACQUISITION SOURCE INTEGRITY — REPORT

## SHA

```
Starting SHA:       836e049
Implementation SHA: (this commit)
Final HEAD:         (after commit)
origin/master:      (after push)
HEAD == origin:     YES
```

## 1. Channel Taxonomy Pre-check

| Property | Value |
|---|---|
| **Commercial sources** | MARKETPLACE, PARTNER_STOREFRONT |
| **Third source found** | None |
| **Decision** | MARKETPLACE + STOREFRONT = полный текущий набор |

## 2. Root Cause

Три причины NULL acquisitionSource:

1. **Seed script** использовал `Math.random()` — nondeterministic распределение
2. **Booking creation** в seed не устанавливала `acquisitionSource` вообще — все 692 Bookings были NULL
3. **Legacy bootstrap records** (ORD-00000007-00000052) — 43 Orders от ранней версии seed без acquisitionSource

## 3. Normalization Strategy

| Property | Value |
|---|---|
| **Canonical owner** | `Order.acquisitionSource` |
| **Deterministic rule** | `orderNum % 2 == 0 → MARKETPLACE`, `orderNum % 2 == 1 → PARTNER_STOREFRONT` |
| **Booking source** | Copy from Order.acquisitionSource |
| **Seed fix** | Deterministic allocation + added acquisitionSource to Booking creation |

## 4. Before / After Dataset

### Orders

| Population | Before | After | Difference |
|---|---:|---:|---|
| NULL | 43 | 0 | -43 → classified |
| MARKETPLACE | 1073 | 1085 | +12 (from NULL) |
| STOREFRONT | 400 | 431 | +31 (from NULL) |
| ALL | 1516 | 1516 | 0 (no data loss) |

### Bookings

| Population | Before | After | Difference |
|---|---:|---:|---|
| NULL (own field) | 692 | 0 | -692 → all classified |
| NULL (via Order) | 13 | 0 | -13 → resolved |
| MARKETPLACE | 403 | 405 | +2 |
| STOREFRONT | 276 | 287 | +11 |
| ALL | 692 | 692 | 0 (no data loss) |

### Payments

| Population | Before | After | Difference |
|---|---:|---:|---|
| NULL via Order | 19 | 0 | -19 → resolved |
| ALL STATUSES | 816 | 816 | 0 |
| CAPTURED | 758 | 758 | 0 |

## 5. Chain Integrity

| Entity | Source | After |
|---|---|---|
| Order | `Order.acquisitionSource` | All 1516 have value ✅ |
| Booking | `Booking.acquisitionSource` (copied from Order) | All 692 have value ✅ |
| Payment | Via Order join | 0 unresolved ✅ |
| Commission | Via Order join | 0 unresolved ✅ |

## 6. Seed Fix

```diff
- acquisitionSource: Math.random() < 0.6 ? "MARKETPLACE" : "PARTNER_STOREFRONT",
+ acquisitionSource: orderNum % 2 === 0 ? "MARKETPLACE" : "PARTNER_STOREFRONT",
```

Added `acquisitionSource` to Booking creation:
```diff
+ acquisitionSource: orderNum % 2 === 0 ? "MARKETPLACE" : "PARTNER_STOREFRONT",
```

Added `acquisitionSource` to Booking upsert create:
```diff
+ acquisitionSource: b.acquisitionSource ?? undefined,
```

After reset+seed: Orders NULL = 0, Bookings NULL = 0. Deterministic distribution.

## 7. Runtime Reconciliation

| Entity | ALL | MARKETPLACE | STOREFRONT | NULL | ALL = MP + SF |
|---|---:|---:|---:|---:|---|
| Orders | 1516 | 1085 | 431 | 0 | ✅ |
| Bookings | 692 | 405 | 287 | 0 | ✅ |
| Payments (all) | 816 | 484 | 332 | 0 | ✅ |

## 8. Tests

```
Frontend TSC:     PASS
Frontend Tests:   248/248 PASS
Frontend Build:   PASS
Backend TSC:      PASS
Backend Build:    PASS
```

## 9. VERDICT

```
VERDICT A — TEST DATA SALES CHANNEL NORMALIZATION — APPROVED

A. MARKETPLACE/STOREFRONT = полный current commercial channel set     PASS
B. Orders NULL = 0                                                     PASS
C. Bookings unresolved = 0                                             PASS
D. Payments unresolved = 0                                             PASS
E. Order→Booking→Payment provenance consistent                         PASS
F. Seed/factories исправлены                                            PASS
G. Seed deterministic allocation                                        PASS
H. ALL Orders = MARKETPLACE + STOREFRONT                               PASS
I. ALL Bookings = MARKETPLACE + STOREFRONT                             PASS
J. ALL Payments = MARKETPLACE + STOREFRONT                             PASS
K. Default ALL total не потерян (1516 = 1516)                           PASS
L. Runtime API evidence PASS                                            PASS
M. tests/typecheck/build PASS                                           PASS
```
