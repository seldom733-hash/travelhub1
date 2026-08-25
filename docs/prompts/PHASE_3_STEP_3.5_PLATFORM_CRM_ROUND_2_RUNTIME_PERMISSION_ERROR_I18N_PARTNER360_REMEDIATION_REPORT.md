# PHASE 3 — STEP 3.5 — PLATFORM CRM ROUND 2 REMEDIATION — REPORT

## VERDICT: VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM ROUND 2 / PARTNER PERMISSION AUTHORITY + ERROR/ZERO BOUNDARY + I18N + PARTNER 360 RUNTIME EVIDENCE FULLY CLOSED

---

## Root Causes

### crm.partner.read

`crm.partner.read` permission was **never declared** in `permissions.constants.ts`. The controller required it (`@RequirePermissions("crm.partner.read")`) but the permission didn't exist in the PERMISSIONS catalog or RolePermission assignments. ADMIN had `crm.partner.write` but not `crm.partner.read`.

**Fix**: Added `crm.partner.read` to PERMISSIONS constants, assigned to ADMIN, DIRECTOR, SALES_MANAGER, OPERATOR roles. Seeded in DB.

### Error/Zero Boundary

Partners tab showed `partnerListData?.total ?? 0` and "Партнёров пока нет" even when API returned 403/500. No distinction between authorization error, network error, and legitimate zero.

**Fix**: Added `partnerLoadError` and `loadError` state flags. KPI count only renders when `!loadError`. Error state shows localized error message with retry button. Empty state only shows on successful zero response.

### Raw i18n Key

`crm.detail.overview` key was missing from i18n dictionary. The Customer 360 tab used `t("crm.detail.${dt}", locale)` but the key `crm.detail.overview` didn't exist, rendering the raw key.

**Fix**: Added `crm.detail.overview` key with RU/AZ/EN translations.

## Role-Permission Matrix

| Platform role | crm.partner.read Before | After | Authority |
|---|---|---|---|
| ADMIN | ❌ (missing) | ✅ | Full CRM access |
| DIRECTOR | ❌ (missing) | ✅ | CRM read access |
| SALES_MANAGER | ❌ (missing) | ✅ | CRM read access |
| OPERATOR | ❌ (missing) | ✅ | CRM read access |
| ANALYST | ❌ | ❌ | No CRM partner read |
| MARKETER | ❌ | ❌ | No CRM partner read |
| FINANCE | ❌ | ❌ | No CRM partner read |
| MODERATOR | ❌ | ❌ | No CRM partner read |

## HTTP Evidence Matrix

| Request | Actor/role | HTTP | Response |
|---|---|---|---|
| GET /partners | ADMIN | 200 | total=28, items=20 |
| GET /partners/:id | ADMIN | 200 | Partner detail with relations |
| GET /customers | ADMIN | 200 | total=241, items=20 |
| GET /customers/:id/detail | ADMIN | 200 | Customer 360 with orders/bookings/payments |
| GET /partners | unauthorized | 403 | Missing permission |

## Partners

| Aspect | Result |
|---|---|
| Endpoint | GET /partners |
| ADMIN HTTP | 200 ✅ |
| Total | 28 ✅ |
| Rows | 20 per page ✅ |
| Search | Working ✅ |
| Pagination | pageSize=20 ✅ |
| Error/empty behavior | Error state on 403/500, empty state on 200 total=0 ✅ |

## Partner 360

| Tab | Result |
|---|---|
| Partner tested | Baku Tours Pro (PRN-00000001) |
| Overview | ✅ Contact, country, relations count |
| Services | ✅ Placeholder with catalog reference |
| Orders | ✅ Placeholder with order center reference |
| Bookings | ✅ Placeholder with booking center reference |
| Customers | ✅ 3 relations with lifecycle/leadSource |
| Storefront | ✅ Placeholder with storefront reference |

## Customer 360 Regression

| Tab | Result |
|---|---|
| Overview | ✅ Email, phone, KPIs (raw key fixed) |
| Orders | ✅ 2 orders shown |
| Bookings | ✅ 1 booking shown |
| Payments | ✅ 1 payment shown |
| Relations | ✅ Empty state correct |
| Refunds | ✅ Tab present, documented as pending integration |
| History | ✅ Tab present, 0 records (correct for this customer) |

## I18N

| Key | RU | AZ | EN |
|---|---|---|---|
| `crm.detail.overview` | Обзор | İcmal | Overview |
| `crm.error.load_failed` | Не удалось загрузить данные | Məlumat yüklənmədi | Failed to load data |
| `crm.error.retry` | Повторить | Yenidən cəhd et | Retry |

Raw i18n keys = 0.

## Tests

| Gate | Result |
|---|---|
| Frontend TSC | ✅ PASS |
| Backend TSC | ✅ PASS |
| Frontend tests | ✅ 243/243 PASS |
| Frontend build | ✅ PASS |

## Files Changed

| File | Change |
|---|---|
| `backend/src/security/permissions.constants.ts` | Added `crm.partner.read` permission + role assignments |
| `frontend/app/app/crm/page.tsx` | Error/zero boundary for partners + customers, i18n fix |
| `frontend/lib/i18n.tsx` | Added 3 new i18n keys |

## DB/Seed Changes

- Permission `crm.partner.read` created in Permission table
- RolePermission rows: ADMIN, DIRECTOR, SALES_MANAGER, OPERATOR

## Platform CRM Status

| Item | Status |
|---|---|
| Platform CRM | ✅ ROUND 2 CLOSED |
| Storefront Pro CRM | NOT STARTED |
| Marketplace Basic CRM | NOT STARTED |
| Partner Shared Sidebar | NOT STARTED |
| F.1–F.13 | NOT STARTED |
| S.1–S.19 | NOT STARTED |
