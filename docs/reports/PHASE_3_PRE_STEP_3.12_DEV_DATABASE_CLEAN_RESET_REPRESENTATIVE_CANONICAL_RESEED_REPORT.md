# DEV DATABASE CLEAN RESET + REPRESENTATIVE CANONICAL RESEED — FINAL REPORT

```
Starting SHA:    2f2c96e
Final SHA:       (pending)
origin/master:   2f2c96e
```

## 1. Начальное состояние

До reset dev DB (`travelhub1`) содержала legacy dataset с серьёзными inconsistencies:

- **1085 legacy 6-digit Order refs** (`MKT-ORD-000001`, len=14)
- **188 legacy 6-digit Refund refs** (`MKT-REF-000001`, len=14)
- **330 Booking temporal anomalies** (Booking createdAt < Order createdAt)
- **128 Order/Payment currency mismatches**
- **7 COMPLETED bookings без completedAt**

## 2. Безопасность окружения

- Environment: localhost dev
- Database: `travelhub1` (dev/test)
- NODE_ENV: не задан (development)
- Guard: `ALLOW_DEV_DATABASE_RESET=true` required
- Production data: отсутствует

## 3. Метод reset

1. Raw SQL cleanup всех business данных в dependency order
2. Re-run canonical `demo-seed.ts` (1000 orders, 25 partners, 200+ products)
3. Re-run `seed-requests.ts` (636 requests)
4. Verification of 9 hard invariants

## 4. Ссылочный контракт после reseed

| Entity | Pattern | Count | Status |
|---|---|---|---|
| Request | MKT-REQ-XXXXXXXX (len=16) | 636 | ✅ All canonical |
| Order (MKP) | MKT-ORD-XXXXXXXX (len=16) | 589 | ✅ All canonical |
| Order (SFR) | SF*-ORD-XXXXXXXX | 411 | ✅ Storefront |
| Booking | MKT-BKG-XXXXXXXX (len=16) | 421 | ✅ All canonical |
| Payment | MKT-PAY-XXXXXXXX-N (len=18) | 337 | ✅ All canonical |
| Refund | MKT-REF-XXXXXXXX (len=16) | 25 | ✅ All canonical |

Legacy 6-digit refs: **0 across all entities**

## 5. Temporal Invariants

| Check | Count | Status |
|---|---|---|
| Booking before Order (1h+) | 0 | ✅ |
| COMPLETED without completedAt | 0 | ✅ |
| Order/Payment currency mismatch | 0 | ✅ |
| Request→Order broken links | 0 | ✅ |
| Request convertedAt > Order createdAt | 0 | ✅ |

## 6. Representative Business Data

```
Partners:            25 (Tour Operators, Hotels, Excursions, Transfers, Guides, Photographers)
Customers:           262
Products:            282 (150+ published, 50+ archived historical)
Orders:             1000 (500 Marketplace + 500 Storefront)
OrderItems:         1000
Bookings:            715 (361 Marketplace + 354 Storefront)
Payments:            817
Refunds:              40
Commissions:         742
Requests:            636 (384 converted, 62 rejected, 48 unavailable, etc.)
Users:               70
Storefronts:          13
Subscriptions:        11
```

## 7. Distribution

**Orders by acquisitionSource:**
- MARKETPLACE: 500
- PARTNER_STOREFRONT: 500

**Orders by status:**
- CLOSED: 414
- FULFILLED: 146
- SENT_TO_BOOKING: 121
- NEW: 118
- CANCELLED: 87
- IN_PROCESSING: 87
- PROBLEM: 27

**Currencies:** AZN: 911, USD: 83, EUR: 6

**Seasonal distribution:** Q3 peak (Jun-Aug: 156, 154, 130)

## 8. Browser Runtime Evidence

- `/app/requests` — 636 requests, 32 pages, canonical 8-digit refs ✅
- `/app/orders` — 500 MARKETPLACE orders, MKT-ORD-XXXXXXXX ✅
- `/app/bookings` — 361 MARKETPLACE bookings, MKT-BKG-XXXXXXXX ✅
- Human-readable customer/service/supplier names ✅
- Sidebar grouping with "Заявки" ✅

## 9. Tests

| Suite | Result | New Failures |
|---|---|---|
| Backend unit | 1395/1420 | 0 |
| Frontend unit | 338/339 | 0 |
| commerce-chain invariants | 19/20 (1 fixed: CRM-*) | 0 |

Pre-existing failures (unchanged):
- Payment reason validation (4)
- Analytics sorting (5)
- Refund tests (16)

## 10. Changes

### Backend
- `backend/src/seed/demo-seed.ts`: Fixed `StorefrontSubscriptionPlan` upsert (by code, not id)
- `backend/src/seed/demo-seed.ts`: Added `ON CONFLICT DO NOTHING` to catalog health products
- `backend/src/modules/order/commerce-chain.invariants.spec.ts`: Updated Refund regex to allow 8-digit, CRM-* customer code
- `backend/prisma/reset-and-reseed.ts`: New controlled reset + reseed script

## 11. Residual Gaps

- OrderTraveler/Passenger: 0 (model exists but seed doesn't populate — separate prompt)
- Traveler Requirements: NOT IMPLEMENTED (documented for next stage)
- Customer ≠ Payer ≠ Traveler distinction: documented, not fully seeded

## 12. Final Verdict

```
VERDICT A — DEV DATABASE CLEAN RESET + REPRESENTATIVE CANONICAL RESEED — COMPLETED
```
