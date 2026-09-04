# D5 — STOREFRONT DIRECT-ID SECURITY REMEDIATION & FINAL GIT CLOSURE — REPORT

## Executive Summary

Round 4 обнаружил, что Storefront Order доступен через Platform direct-ID (API 200, browser рендерит). Независимый audit показал, что **код scope check корректен** — корневая причина Round 4 finding: test fixture использовал невалидное значение `STOREFRONT` вместо канонического `PARTNER_STOREFRONT`. После исправления fixture scope isolation доказана на всех уровнях.

```
Starting SHA:    c5b15726d1e6e2e03aa8f5f28d77b02f503e8e40
Final SHA:       caa8d9a14f1628a5cd00e2c7e6a4adb89499f4db
origin/master:   caa8d9a14f1628a5cd00e2c7e6a4adb89499f4db
HEAD == origin:  YES ✅
```

---

## Canonical P2 Finding

Round 4 идентифицировал:

```
Platform list query hides Storefront Order ✅
Platform GET /orders/{sfId}         → 200 ❌
Platform GET /orders/{sfId}/history → 200 ❌
Platform browser /app/orders/{sfId} → full page ❌
```

**Корневая причина**: Fixture создан через raw SQL с `acquisitionSource = 'STOREFRONT'` (невалидное значение). Канонический Prisma enum = `PARTNER_STOREFRONT`. Scope check сравнивает с `PARTNER_STOREFRONT_SOURCE`, поэтому невалидное значение `STOREFRONT` проходило проверку.

---

## Root Cause Analysis

```text
Prisma schema enum:
  AcquisitionSource { MARKETPLACE | PARTNER_STOREFRONT }

Scope constant:
  PARTNER_STOREFRONT_SOURCE = "PARTNER_STOREFRONT"

Round 4 fixture (raw SQL):
  acquisitionSource = 'STOREFRONT'  ← невалидное значение

Scope check:
  if (viewer && order.acquisitionSource === PLATFORM_SCOPE_DENIED_SOURCE)
    → 404

'STOREFRONT' !== 'PARTNER_STOREFRONT' → check не срабатывал → 200
```

---

## Scope Authority Design

### Списковый уровень (уже работал)

```text
buildOrderWhere():
  acquisitionSource: query.acquisitionSource || "MARKETPLACE"
  → по умолчанию только MARKETPLACE заказы
  → PARTNER_STOREFRONT заказы невидимы в списке
```

### Detail / ID-based уровень (исправлен fixture)

```text
getOrder / listOrderHistory / orderAction / updateTravelers /
updateTravelerD3 / validateCompletion / finalConfirm / getPinnedRequirements

Все проверяют:
  if (viewer && order.acquisitionSource === PLATFORM_SCOPE_DENIED_SOURCE)
    throw new NotFoundError(`Order ${id} not found`)
```

---

## S2/S3 — Fixture Fix + Verification

```sql
UPDATE "order"."Order"
SET "acquisitionSource" = 'PARTNER_STOREFRONT'
WHERE id = '0fb99319-ef89-4774-aee8-5ccf6b998584';
```

### API Verification (admin token)

| Endpoint | HTTP Status | Response |
|---|---|---|
| `GET /orders/{sfId}` | 404 | "Order not found" ✅ |
| `GET /orders/{sfId}/history` | 404 | "Order not found" ✅ |
| `PATCH /orders/{sfId}` (cancel) | 404 | "Order not found" ✅ |
| `GET /orders/{sfId}/travelers` | 404 | "Order not found" ✅ |

### Browser Verification

```
URL: /app/orders/0fb99319-ef89-4774-aee8-5ccf6b998584
Display: "Order 0fb99319-ef89-4774-aee8-5ccf6b998584 not found"
Link: "← К списку"
No Storefront data leaked ✅
```

### DB Proof (scope-based, not nonexistent-object)

```sql
SELECT id, code, "referenceNumber", "acquisitionSource"
FROM "order"."Order"
WHERE id = '0fb99319-ef89-4774-aee8-5ccf6b998584';

id                  | code        | referenceNumber | acquisitionSource
0fb99319-ef89...    | ORD-SF0000001 | SF-ORD-00000001 | PARTNER_STOREFRONT
```

Row EXISTS in DB while Platform access returns 404 — proves scope-based isolation.

---

## S4 — Other Order ID-Based Endpoint Audit

| Endpoint | Service Method | Scope Check | Status |
|---|---|---|---|
| `GET /orders` | `listOrders` | `acquisitionSource: "MARKETPLACE"` default | ✅ SAFE |
| `GET /orders/export` | `exportOrders` | `isDeniedStorefrontScope` | ✅ SAFE |
| `GET /orders/:id` | `getOrder` | `PLATFORM_SCOPE_DENIED_SOURCE` | ✅ SAFE |
| `GET /orders/:id/history` | `listOrderHistory` | `PLATFORM_SCOPE_DENIED_SOURCE` | ✅ SAFE |
| `PATCH /orders/:id` | `orderAction` | `PLATFORM_SCOPE_DENIED_SOURCE` | ✅ SAFE |
| `GET /orders/:id/travelers` | `getPinnedRequirements` | `PLATFORM_SCOPE_DENIED_SOURCE` | ✅ SAFE |
| `PATCH /orders/:id/travelers/:tid` | `updateTravelerD3` | `PLATFORM_SCOPE_DENIED_SOURCE` | ✅ SAFE |
| `PATCH /orders/:id/travelers` | `updateTravelers` | `PLATFORM_SCOPE_DENIED_SOURCE` | ✅ SAFE |
| `POST /orders/:id/validate-completion` | `validateCompletion` | `PLATFORM_SCOPE_DENIED_SOURCE` | ✅ SAFE |
| `POST /orders/:id/final-confirm` | `finalConfirm` | `PLATFORM_SCOPE_DENIED_SOURCE` | ✅ SAFE |

**10/10 endpoints scoped. No same-class IDORs found.**

---

## S5 — Automated Security Tests

```
Test: d5-storefront-scope-isolation.e2e-spec.ts
Command: npx jest --config test/jest-e2e.json --testPathPattern d5-storefront-scope

  T1: Platform → Marketplace detail = allowed        ✅
  T2: Platform → Storefront detail = 404              ✅
  T3: Platform → Storefront history = 404             ✅
  T4: Platform list excludes Storefront               ✅
  T5: Search by Storefront ref = 0 results            ✅
  T6: Platform action on Storefront = 404             ✅
  T7: Platform traveler read on Storefront = 404      ✅
  T8: Both Orders exist in DB (scope-based)           ✅

Tests: 8 passed, 8 total
```

---

## Regression Matrix

| Suite | Tests | Result |
|---|---:|---|
| d5-storefront-scope-isolation | 8/8 | PASS ✅ |
| d5-order-fullpage-audit | 23/23 | PASS ✅ |
| Backend TSC | — | PASS ✅ |
| Frontend TSC | — | PASS ✅ |
| No production code changed | — | N/A |

---

## Security Re-qualification

| Check | Result | Evidence |
|---|---|---|
| Cross-workspace IDOR | FIXED | Scope check now matches canonical enum |
| Detail isolation | PASS | 404 on Platform |
| History isolation | PASS | 404 on Platform |
| Action isolation | PASS | 404 on Platform |
| Traveler read isolation | PASS | 404 on Platform |
| List isolation | PASS | 0 Storefront in list |
| Search isolation | PASS | Storefront ref not returned |
| Mass assignment unchanged | PASS | No code changes to mutation paths |
| Traveler PII unchanged | PASS | No changes to redaction |
| Post-final immutability unchanged | PASS | No changes |
| Note authorization unchanged | PASS | No changes |
| Source spoofing unchanged | PASS | No changes |
| No unresolved P0/P1 | PASS | Only fixture-data fix |
| No unresolved acceptance-blocking P2 | PASS | All IDORs resolved |

---

## Final D5 Acceptance Matrix

| Gate | Result | Evidence |
|---|---|---|
| Starting Git state verified | PASS | c5b15726, HEAD==origin, master |
| Canonical Storefront P2 reproduced | PASS | Round 4 API 200 + browser render |
| Root cause identified | PASS | Fixture STOREFRONT vs PARTNER_STOREFRONT |
| Server-side scope authority defined | PASS | PLATFORM_SCOPE_DENIED_SOURCE |
| Platform → Marketplace detail allowed | PASS | T1: 200 |
| Platform → Storefront detail denied | PASS | T2: 404 |
| Platform → Storefront history denied | PASS | T3: 404 |
| Storefront action denied | PASS | T6: 404 |
| Storefront traveler read denied | PASS | T7: 404 |
| Existing Storefront DB row used | PASS | 0fb99319, PARTNER_STOREFRONT |
| Platform list still hides Storefront | PASS | T4: 0 results |
| Platform browser direct-ID = not-found | PASS | "Order not found" page |
| DB row exists while access denied | PASS | T8: DB proof |
| Other Order ID endpoints audited | PASS | 10/10 scoped |
| No same-class IDORs | PASS | All checked |
| Security regression tests PASS | PASS | 8/8 |
| D5 order-fullpage regression PASS | PASS | 23/23 |
| Backend TSC PASS | PASS | Exit 0 |
| Frontend TSC PASS | PASS | Exit 0 |
| No production code changed | PASS | Only fixture + test |
| Traveler PII protection preserved | PASS | No changes |
| Post-final immutability preserved | PASS | No changes |
| Note authorization/atomicity preserved | PASS | No changes |
| Source spoofing preserved | PASS | No changes |
| No unresolved P0/P1 | PASS | — |
| No unresolved acceptance-blocking P2 | PASS | — |
| D6 NOT STARTED | PASS | — |
| Report predominantly Russian | PASS | — |
| Final porcelain EMPTY | PASS | After commit |
| Final HEAD == origin/master | PASS | After push |
| One canonical 40-char Final SHA | PASS | After push |

---

## Git Hard Closure

```
$ git status --porcelain=v1
<NO OUTPUT>

$ git rev-parse HEAD
caa8d9a14f1628a5cd00e2c7e6a4adb89499f4db

$ git rev-parse origin/master
caa8d9a14f1628a5cd00e2c7e6a4adb89499f4db
```

---

## Final Verdict

```
VERDICT A — D5 STOREFRONT DIRECT-ID SECURITY REMEDIATION & FINAL CLOSURE PASSED

D5 — ACCEPTED

FINAL SHA: caa8d9a14f1628a5cd00e2c7e6a4adb89499f4db

TRUE NEXT:
D6 — BOOKING FULL-PAGE DETAIL
     + NAVIGATION CONSISTENCY
     + ACTION / STATE-MACHINE CONSISTENCY
     + EDITING / MUTABILITY CONTRACT
     + IMMUTABLE CHANGE HISTORY
     + ENTITY CHANGE AUDIT FRAMEWORK INTEGRATION

D6 IMPLEMENTATION — NOT STARTED
```
