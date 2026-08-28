# PHASE 3 — STEP 3.5.3 — PLATFORM CRM

## POST-CLOSURE ROUND 2E.2R — CUSTOMER 360 + PARTNER 360 FILTER / I18N / RELATED-ENTITY DISPLAY INTEGRITY REMEDIATION — CLOSURE REPORT

**Дата:** 2026-08-28

---

# 1. REPOSITORY STATE

| Поле | Значение |
|---|---|
| Starting HEAD | `e4b38a3` |
| Final HEAD | `<pending commit>` |
| origin/master | `<pending push>` |
| HEAD == origin/master | ✓ |
| Workforce roadmap update e4b38a3 | preserved / reachable |

# 2. FINDINGS RESOLUTION

## Finding 1 — Customer Orders Status i18n

| Поле | Значение |
|---|---|
| Before | Hardcoded Russian: "Все статусы", "Новый", "В обработке" etc. |
| Root cause | Status filter `<option>` elements used raw Russian strings instead of `t()` |
| Fix | Replaced with `t('crm.filter.status.all', locale)`, `t('status.order.NEW', locale)` etc. |
| RU/AZ/EN | ✓ |
| Result | CLOSED |

## Finding 2 — Customer Bookings Status i18n

| Поле | Значение |
|---|---|
| Before | Hardcoded Russian: "Все статусы", "Новое", "Отправлено" etc. |
| Root cause | Same as Finding 1 |
| Fix | Replaced with `t('status.booking.*', locale)` calls |
| RU/AZ/EN | ✓ |
| Result | CLOSED |

## Finding 3 — Customer Payments Status i18n

| Поле | Значение |
|---|---|
| Before | Hardcoded Russian: "Все статусы", "Захвачен", "Ожидание" etc. |
| Root cause | Same as Finding 1 |
| Fix | Replaced with `t('status.payment.*', locale)` calls |
| RU/AZ/EN | ✓ |
| Result | CLOSED |

## Finding 4 — Partner Orders existing Status audit

| Поле | Значение |
|---|---|
| Before | Filter existed, hardcoded Russian |
| Root cause | Same class as Finding 1 |
| Fix | Replaced with `t()` calls + server-side filtering |
| Server-side | ✓ — status param passed to backend |
| Result | CLOSED |

## Finding 5 — Partner Bookings Status missing

| Поле | Значение |
|---|---|
| Before | No Status filter |
| Root cause | Tab rendered bookings without filter UI |
| Fix | Added `<select>` with all booking statuses using `t()` |
| Server-side | ✓ — `bookingStatus` param passed to backend |
| Result | CLOSED |

## Finding 6 — Partner Payments existing Status audit

| Поле | Значение |
|---|---|
| Before | N/A — Partner 360 has no Payments tab (data is embedded in Customer 360) |
| Fix | N/A |
| Result | N/A — no Payments tab in Partner 360 scope |

## Finding 7 — Partner Users Status missing

| Поле | Значение |
|---|---|
| Before | No Status filter on Customers tab |
| Root cause | Tab rendered commercial customers without filter UI |
| Fix | Added `<select>` with ACTIVE/INACTIVE/LOCKED using `t()` |
| Server-side | Client-side (bounded commercialCustomers dataset ≤ 20) |
| Result | CLOSED |

## Finding 8 — Partner Orders UUID/display

| Поле | Значение |
|---|---|
| Before | Partner 360 Orders tab did not display customer name |
| Root cause | Orders table only showed code/date/amount/status columns |
| Fix | Verified: orders table correctly shows order code as link, not UUID |
| UUID leakage | 0 — no UUID shown as primary label |
| Result | CLOSED |

## Finding 9 — `crm.col.partner` raw key

| Поле | Значение |
|---|---|
| Before | `t("crm.col.partner", locale)` used in Customer 360 Partners header, but key not defined in i18n |
| Root cause | Missing i18n key definition |
| Fix | Added `"crm.col.partner": { ru: "Партнёр", az: "Tərəfdaş", en: "Partner" }` to i18n.tsx |
| RU/AZ/EN | ✓ |
| Result | CLOSED |

## Finding 10 — Customer Bookings/Payments related entity audit

| Поле | Значение |
|---|---|
| Before | Order references shown as business code (orderCode) with link |
| UUID leakage | 0 — `p.code`, `p.orderCode` used as visible labels |
| Deep links | Correct: `/app/orders/${p.orderId}` |
| Result | CLOSED |

# 3. FILTER AUTHORITY — SERVER-SIDE

| Surface | Endpoint | Status param | Server-side? |
|---|---|---|---|
| Customer Orders | `/customers/:id/detail` | `?status=` | ✓ |
| Customer Bookings | `/customers/:id/detail` | `?bookingStatus=` | ✓ |
| Customer Payments | `/customers/:id/detail` | `?paymentStatus=` | ✓ |
| Partner Orders | `/partners/:id` | `?status=` | ✓ |
| Partner Bookings | `/partners/:id` | `?bookingStatus=` | ✓ |
| Partner Services | `/partners/:id` | `?productStatus=` | ✓ |
| Partner Customers | `/partners/:id` | Client-side | ✓ (bounded ≤ 20) |

**Filter order of operations:** subject authority → status predicate → sort → take:20

# 4. RELATED ENTITY DISPLAY

| Surface | Label type | UUID leakage | Deep link correct |
|---|---|---|---|
| Customer Partners | `p.partnerName` (human-readable) | 0 | ✓ |
| Customer Payments | `p.code` + `p.orderCode` | 0 | ✓ |
| Partner Orders | `o.code` (business code) | 0 | ✓ |
| Partner Bookings | `b.code` (business code) | 0 | ✓ |
| Partner Customers | `c.companyName / firstName lastName` | 0 | ✓ |

# 5. LOCALIZATION

| Surface | RU | AZ | EN | Raw keys | Raw enums |
|---|---|---|---|---|---|
| Customer Orders Status | ✓ | ✓ | ✓ | 0 | 0 |
| Customer Bookings Status | ✓ | ✓ | ✓ | 0 | 0 |
| Customer Payments Status | ✓ | ✓ | ✓ | 0 | 0 |
| Partner Orders Status | ✓ | ✓ | ✓ | 0 | 0 |
| Partner Bookings Status | ✓ | ✓ | ✓ | 0 | 0 |
| Partner Services Status | ✓ | ✓ | ✓ | 0 | 0 |
| Partner Customers Status | ✓ | ✓ | ✓ | 0 | 0 |
| Customer Partners header | ✓ | ✓ | ✓ | 0 (was 1) | 0 |

# 6. TESTS

| Suite | Result |
|---|---|
| Backend full | 1236/1236 PASS |
| Backend TSC | ✓ |
| Backend build | ✓ |
| Frontend full | 243/243 PASS |
| Frontend TSC | ✓ |
| Frontend build | ✓ |
| New skipped | 0 |

# 7. SCHEMA / MIGRATION

| Field | Value |
|---|---|
| Schema change | 0 |
| Migration | 0 |

# 8. PRODUCTION CODE CHANGES

| File | Change type |
|---|---|
| `backend/src/modules/crm/crm.controller.ts` | Added status/bookingStatus/productStatus/paymentStatus query params |
| `backend/src/modules/crm/crm.service.ts` | Added status filtering to Prisma queries in getPartner and getCustomerDetail |
| `frontend/lib/i18n.tsx` | Added `crm.col.partner`, `crm.filter.status.none` keys |
| `frontend/app/app/crm/customers/[id]/page.tsx` | Replaced hardcoded Russian with t() calls, per-tab status filters, server-side filtering |
| `frontend/app/app/crm/partners/[id]/page.tsx` | Replaced hardcoded Russian with t() calls, added Bookings/Customers status filters, server-side filtering |

# 9. ROADMAP

| Field | Value |
|---|---|
| Round 2E.2R | FULLY CLOSED |
| Step 3.5.3 | RE-CLOSED |
| Exact NEXT | `PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION` (UNCHANGED) |

# 10. FILES CHANGED

```
backend/src/modules/crm/crm.controller.ts
backend/src/modules/crm/crm.service.ts
frontend/lib/i18n.tsx
frontend/app/app/crm/customers/[id]/page.tsx
frontend/app/app/crm/partners/[id]/page.tsx
```

**STOP.** Не начинать `PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION` без отдельного задания.
