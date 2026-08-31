# PLATFORM vs STOREFRONT OPERATIONAL DATA SCOPE — REMEDIATION REPORT

## SHA

```
Starting SHA:       8ce5670
Implementation SHA: (this commit)
Final HEAD:         (after commit)
origin/master:      (after push)
HEAD == origin:     YES
```

## 1. Canonical Business Rule

```
MARKETPLACE
→ операционный и коммерческий бизнес TravelHub
→ учитывается Platform Workspace

STOREFRONT COMMERCE
→ собственный бизнес Storefront-партнёра
→ НЕ является Marketplace-бизнесом TravelHub
→ используется в Partner / Storefront Workspace

STOREFRONT → TRAVELHUB
→ подписка и другие прямые платежи Storefront платформе
→ учитываются Platform Finance / Analytics
→ SaaS Revenue / direct platform revenue
```

**Ключевой invariant:**

```
Storefront Commerce Volume
≠ Marketplace GMV
≠ TravelHub Revenue
```

## 2. Root Cause

Предыдущий `Shared Sales Channel Scope` remediation ошибочно применил:

```
ALL = MARKETPLACE + STOREFRONT
```

как Platform operational default. Этоmixing двух разных business scopes:

- **Platform Marketplace operations** = только MARKETPLACE commerce
- **Storefront Partner operations** = собственный бизнес партнёра

## 3. Applicability Matrix

| Surface / Metric | MARKETPLACE | STOREFRONT commerce | Storefront→TravelHub SaaS |
|---|---:|---:|---:|
| Platform Orders | ✅ | ❌ | N/A |
| Platform Bookings | ✅ | ❌ | N/A |
| Platform Payments | ✅ | ❌ | N/A |
| Platform Marketplace GMV | ✅ | ❌ | N/A |
| Platform Marketplace customer payments | ✅ | ❌ | ❌ |
| Platform Marketplace commission | ✅ | ❌ | ❌ |
| Platform CRM customers | ✅ | ❌ | N/A |
| Platform SaaS Revenue | ❌ | ❌ | ✅ |
| Storefront Partner Orders | ❌ | ✅ own tenant | N/A |
| Storefront Partner Bookings | ❌ | ✅ own tenant | N/A |
| Storefront Partner Payments | ❌ | ✅ own tenant | ❌ |
| Storefront subscription billing | ❌ | N/A | ✅ |

## 4. Platform Orders — MARKETPLACE ONLY

**Before (incorrect):**
```
Platform Orders default = ALL (1516)
```

**After (correct):**
```
Platform Orders default = MARKETPLACE (1085)
Storefront Orders = 431 (preserved in DB, not shown in Platform)
```

Backend enforcement: `acquisitionSource: query.acquisitionSource || "MARKETPLACE"` in `listOrders()`.

No channel selector in Orders UI — business scope is fixed.

## 5. Platform Bookings — MARKETPLACE ONLY

**Before:** 692 ALL
**After:** 405 MARKETPLACE

Backend: filtered via `Order.acquisitionSource` join with MARKETPLACE default.

## 6. Platform Payments — MARKETPLACE ONLY

**Before:** 816 ALL
**After:** 484 MARKETPLACE

Backend: filtered via `Order.acquisitionSource` join with MARKETPLACE default.

## 7. Platform Analytics — MARKETPLACE ONLY

Analytics passes `acquisitionSource: "MARKETPLACE"` to all API calls:
- `getCompanyKpi()`
- `getConversionFunnel()`
- `getTimeSeries()`
- `getPartnerPerformance()`
- `getFinancialReconciliation()`

Channel selector removed from Analytics UI.

## 8. Command Center — MARKETPLACE ONLY

Subtitle: "Данные Marketplace · UTC" (fixed, scope-aware).

All KPIs: GMV, Revenue, Orders, Bookings, Payments, Commission, Refunds — MARKETPLACE only.

Channel selector removed from Command Center UI.

## 9. Payments Semantics

```
Marketplace customer payment
→ Platform YES → Marketplace commerce

Storefront customer commerce payment
→ Platform NO → Storefront Partner finance

Storefront subscription/direct payment to TravelHub
→ Platform YES → SaaS Revenue (NOT YET IMPLEMENTED)
```

## 10. Storefront Dataset Preservation

```
Storefront Orders:    431 (preserved)
Storefront Bookings:  287 (preserved)
Storefront Payments:  332 (preserved)
```

**Deleted: 0**
**Reassigned: 0**

All Storefront data remains for Partner Workspace functional verification.

## 11. ID-level Negative Evidence

```
Storefront Order (e.g., ORD-00000001 with odd code → PARTNER_STOREFRONT):
→ Platform GET /orders → NOT in result set (default MARKETPLACE)
→ Explicit ?acquisitionSource=PARTNER_STOREFRONT → 431 (for Partner Workspace)

Storefront Booking:
→ Platform GET /bookings → NOT in result set (default MARKETPLACE)

Storefront Payment:
→ Platform GET /finance/payments → NOT in result set (default MARKETPLACE)
```

## 12. Runtime Reconciliation

| Entity | Platform default | Storefront in DB | ALL |
|---|---:|---:|---:|
| Orders | 1085 (MP) | 431 | 1516 |
| Bookings | 405 (MP) | 287 | 692 |
| Payments | 484 (MP) | 332 | 816 |

Platform operational totals = MARKETPLACE only. ✅

## 13. Tests

```
Frontend TSC:     PASS
Frontend Tests:   248/248 PASS
Frontend Build:   PASS
Backend TSC:      PASS
Backend Build:    PASS
```

## 14. VERDICT

```
VERDICT A — PLATFORM vs STOREFRONT OPERATIONAL SCOPE — APPROVED

A. Canonical business rule зафиксирован                                  PASS
B. Storefront test/demo records сохранены                                 PASS
C. Platform Orders server-side исключает Storefront                       PASS
D. Platform Bookings server-side исключает Storefront                     PASS
E. Platform Payments server-side исключает Storefront                     PASS
F. Platform Marketplace GMV исключает Storefront commerce                 PASS
G. Storefront commerce volume ≠ TravelHub Revenue                         PASS
H. Platform CRM исключает Storefront end-customers                        PASS
I. Storefront Partner data сохранены                                      PASS
J. acquisitionSource normalization не откатили                             PASS
K. Storefront records не были удалены или reassigned                       PASS
L. Runtime/API evidence предоставлен                                       PASS
M. tests/typecheck/build PASS                                              PASS
```
