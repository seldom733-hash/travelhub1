# PHASE 3 — STEP 3.5C — PARTNER CRM RUNTIME TIER AUTHORITY & API ROUTE REMEDIATION V3 — REPORT

## VERDICT: VERDICT A

---

## Root Causes

### A. Why did /api/v1/partner/customers return Cannot GET?

**Two-layer failure:**

1. **Stale backend build**: `backend/dist/` was compiled on Aug 16 (before 3.5C code). The running backend process (PID 10280/5080) served old code without partner CRM routes.

2. **Missing DB permissions**: Even after rebuild, `crm.customer.read_own` permission existed in `Permission` table but was NOT assigned to PARTNER role in `RolePermission` table. The `seedRoles()` function only creates new Permission rows; RolePermission assignments require explicit migration/seed.

**Fix**: Rebuilt backend dist + inserted 3 missing RolePermission rows for PARTNER role.

### B. Why did Storefront Pro render as MARKETPLACE BASIC?

Same root cause as A — the running backend had no partner CRM routes, so `GET /partner/crm-tier` returned 404. Frontend fell back to default `setTier("BASIC")` in the `.catch()` handler.

After rebuild + permission fix, `GET /partner/crm-tier` returns `{"tier":"PRO"}` for pro_partner.

### C. Why were Basic and Pro customer pages identical?

Same root cause — both got 404 from backend, both fell back to BASIC tier, both rendered the same Basic customer page with 0 customers and an error.

### D. Why did API failure render "0 customers"?

The `loadCustomers` catch handler set `error` state but didn't prevent the KPI from rendering `customerData?.total ?? 0`. Since `customerData` was null (never set due to error), it displayed `0`.

**Fix**: Added `loadError` state flag. KPI count only renders when `!loadError`.

### E. Was runtime stale relative to repository HEAD?

**Yes.** Backend dist was built Aug 16. Repository HEAD was at commit `c568879` (Aug 25). The partner CRM code was added in that commit but the running process used the old dist.

---

## Runtime SHA

| Item | Value |
|---|---|
| HEAD before | `c568879` |
| origin/master before | `c568879` |
| Backend runtime version | Rebuilt from `c568879` dist |
| Frontend runtime version | Next.js dev server (live reload) |

## Canonical API Contract

| Endpoint | Method | Permission | Purpose |
|---|---|---|---|
| `/partner/crm-tier` | GET | `crm.customer.read_own` | Resolve partner CRM tier |
| `/partner/customers` | GET | `crm.customer.read_own` | List partner customers |
| `/partner/customers/:id` | GET | `crm.customer.read_own` | Partner customer detail |
| `/partner/customers/intake` | POST | `crm.customer.create_own` | Direct customer intake (Pro) |
| `/partner/relations/:id` | PATCH | `crm.customer.update_own` | Update relation (Pro) |

## HTTP Evidence Matrix

| Actor | Endpoint | HTTP Status | Response |
|---|---|---|---|
| step18_partner | `/partner/crm-tier` | 200 | `{"tier":"BASIC"}` |
| step18_partner | `/partner/customers` | 200 | `{"items":[],"total":0,"tier":"BASIC"}` |
| pro_partner | `/partner/crm-tier` | 200 | `{"tier":"PRO"}` |
| pro_partner | `/partner/customers` | 200 | `{"items":[3 customers],"total":3,"tier":"PRO"}` |
| unauthenticated | `/partner/crm-tier` | 401 | `Missing access token` |
| basic (no create_own) | `/partner/customers/intake` | 403 | `Missing permission(s): crm.customer.create_own` |

## Visual Differentiation Matrix

| Surface | Basic (step18_partner) | Pro (pro_partner) | PASS |
|---|---|---|---|
| Resolved tier | MARKETPLACE BASIC | STOREFRONT PRO | ✅ |
| Navigation entry | Клиенты | CRM | ✅ |
| Data authority | Marketplace orders | PartnerCustomerRelation | ✅ |
| Customer list | Empty (no marketplace orders) | 3 customers with relations | ✅ |
| Tier badge | MARKETPLACE BASIC — Клиенты | STOREFRONT PRO — Full CRM | ✅ |
| Direct intake | Not shown | + Добавить клиента button | ✅ |
| Lifecycle column | Not shown | Shown in table | ✅ |
| Relation detail | Limited | Full (lifecycle, tags, notes) | ✅ |
| API error | Proper error state with retry | Proper error state with retry | ✅ |

## Error vs Zero Behavior

| Scenario | Before | After |
|---|---|---|
| API 404/403/500 | "МОИ КЛИЕНТЫ 0" + raw error text | Error box with "Не удалось загрузить данные" + retry |
| API success, total=0 | "МОИ КЛИЕНТЫ 0" + empty state | KPI shows 0 + "Клиентов пока нет" |
| API success, total>0 | KPI shows count + table | Same (correct) |

## DB Changes

3 RolePermission rows inserted for PARTNER role:
- `crm.customer.read_own`
- `crm.customer.create_own`
- `crm.customer.update_own`

3 PartnerCustomerRelation test records created for pro_partner.

## Regression

- Platform CRM: ✅ No changes
- Partner products: ✅ No changes
- Storefront: ✅ No changes

## Tests

| Gate | Result |
|---|---|
| Frontend TSC | ✅ PASS |
| Backend TSC | ✅ PASS |
| Frontend tests | ✅ 243/243 PASS |
| Frontend build | ✅ PASS |

## Production Code Changed

| File | Change |
|---|---|
| `frontend/app/partner/customers/page.tsx` | Error/zero boundary fix |
| `frontend/lib/partner-i18n.ts` | CRM i18n keys (from previous commit) |

## DB/Schema Changed

- 3 RolePermission rows for PARTNER role (permission seed, not schema migration)
- 3 PartnerCustomerRelation test records

## Roadmap Status

| Step | Status |
|---|---|
| 3.5C | ✅ IMPLEMENTED + RUNTIME VERIFIED |
| 3.5D | PLANNED — NOT STARTED |
| F.1–F.13 | NOT STARTED |
| S.1–S.19 | NOT STARTED |

## Remaining Findings

1. `seedRoles()` only seeds Permission rows, not RolePermission assignments. New permissions require explicit DB seed/migration. Consider adding a comment or startup reconciliation for RolePermission from constants.
2. Backend dist rebuild was required after code changes — running process served stale code. Consider automated build verification in deployment pipeline.
