# PHASE 3 — STEP 3.5C — PARTNER WORKSPACE TIER DIFFERENTIATION REMEDIATION — REPORT

## VERDICT: VERDICT A

---

## Root Cause

The CRM page (`/app/crm`) existed with full three-context support (Platform/Basic/Pro) and server-authoritative tier detection, but was **inaccessible from the Partner Workspace** (`/partner/*`). The partner layout had a static `CABINET_NAV` array with no CRM entry point, and the partner workspace routes (`/partner/*`) contained no customer-management page.

**Result:** Basic and Pro partners saw identical navigation with no CRM/customer-management entry, despite the backend correctly differentiating tiers.

Secondary defect: `Кабинет партнёра` in the header was wrapped in `<Link href="/partner">`, making it a clickable navigation element (duplicate of Обзор), creating a false click affordance.

## Files Discovered

| File | Role |
|---|---|
| `frontend/app/partner/layout.tsx` | Partner workspace shell + navigation |
| `frontend/app/app/crm/page.tsx` | Platform CRM page (had partner support but unreachable) |
| `frontend/app/partner/customers/page.tsx` | **NEW** — Partner CRM page |
| `frontend/lib/partner-i18n.ts` | Partner navigation i18n dictionary |
| `frontend/lib/i18n.tsx` | Main i18n dictionary |
| `frontend/lib/api.ts` | API client + CrmTierResponse type |
| `backend/src/modules/crm/crm.controller.ts` | Partner CRM endpoints |
| `backend/src/modules/crm/crm.service.ts` | Partner CRM service + tier resolver |
| `backend/src/security/permissions.constants.ts` | CRM permissions (incl. partner) |

## Tier Authority

```
PartnerStorefront.status = 'ACTIVE'
AND PartnerStorefront.entitlementStatus = 'ACTIVE'
→ STOREFRONT PRO
else
→ MARKETPLACE BASIC
```

Resolved server-side via `GET /partner/crm-tier`. Frontend consumes `CrmTierResponse.tier` and adjusts navigation + capabilities accordingly.

## Capability Authority

```
partner.role = PARTNER (both tiers)
tier = BASIC | PRO (resolved from PartnerStorefront)
permissions = RBAC-based (crm.customer.read_own, crm.customer.create_own, crm.customer.update_own)
```

Frontend does NOT independently become entitlement authority. Navigation renders based on resolved tier from server; mutations are server-denied for Pro-only actions regardless of frontend state.

## BASIC Account

- **Username:** step18_partner
- **partnerId:** aa70b379-5d42-4f33-94b5-067fb6b31281
- **Resolved tier:** MARKETPLACE BASIC
- **Partner:** Step18 Browser Partner
- **Storefront:** None

### Navigation BEFORE

```
Обзор | Мои услуги | Новая услуга | Идентичность | Витрина
```

### Navigation AFTER

```
Обзор | Мои услуги | Новая услуга | Идентичность | Витрина | Клиенты
```

### Customer Route

```
/partner/customers
```

### Customer Authority

Customers derived from own marketplace orders (server-scoped by `actor.partnerId`).

### Visible Actions

- List own marketplace customers (search, pagination, page=20)
- View customer detail (identity + own orders/bookings/payments)
- Refresh list

### Pro-only Denial

- Direct intake button: **NOT RENDERED** (frontend)
- Lifecycle/tags/notes/assignedTo mutation: **NOT RENDERED** (frontend)
- Manual `/partner/customers/intake` API call: **SERVER-DENIED** (cr.customer.create_own required)

## PRO Account

- **Username:** pro_partner
- **partnerId:** aad76dd9-93ad-4d1c-107a-54b4b5adc8a2
- **Resolved tier:** STOREFRONT PRO
- **Partner:** Baku Tours Pro
- **Storefront:** ACTIVE + entitlement ACTIVE

### Navigation BEFORE

```
Обзор | Мои услуги | Новая услуга | Идентичность | Витрина
```

### Navigation AFTER

```
Обзор | Мои услуги | Новая услуга | Идентичность | Витрина | CRM
```

### CRM Route

```
/partner/customers
```

### CRM Features

- Full CRM list from PartnerCustomerRelation + marketplace orders
- Search + pagination (20-row default)
- Customer 360 detail (Overview, Orders, Bookings, Payments, Relations tabs)
- Direct intake (Добавить клиента) — form with firstName, lastName, email, phone, leadSource, notes
- Lifecycle/tag/notes/assignedTo editing in Relations tab
- Tier badge: STOREFRONT PRO — Full CRM

## Workspace Title Behavior

`Кабинет партнёра` is now a **static `<div>`** (not a `<Link>`):

```
<div className="flex shrink-0 items-center gap-2" role="presentation">
  TravelHub [Кабинет партнёра]
</div>
```

- Not clickable
- No pointer cursor
- No role="link" / role="button"
- No keyboard focus as navigation
- Consistent for both Basic and Pro

## Overview Home Navigation

`Обзор` remains the canonical home action:

```
<Link href="/partner">🏠 Обзор</Link>
→ navigates to /partner
```

No duplicate home links.

## Basic Storefront Menu Semantics

`Витрина` item remains for both Basic and Pro:

- **Basic:** Shows Storefront management/configuration (DRAFT or no storefront). Entry for onboarding/setup.
- **Pro:** Shows active Storefront management (ACTIVE + entitlement).

This is consistent with existing canonical behavior — Basic sees the item as setup/onboarding, not as an active storefront.

## Customer Source

| Context | Authority | Behavior |
|---|---|---|
| Basic customer list | Marketplace orders for own partner | Customers who placed orders with this partner |
| Pro customer list | PartnerCustomerRelation + marketplace orders | Full CRM relations + marketplace customers |
| Pro + marketplace | Union of relation-based and order-based | Existing marketplace customers remain visible |
| Upgrade (BASIC → PRO) | Customer source expands, does not shrink | Existing marketplace customers preserved |
| Downgrade (PRO → BASIC) | Pro-only actions removed, data preserved | CRM data NOT destroyed; marketplace context remains |

## Cross-Partner Isolation

Server-scoped by `actor.partnerId` from JWT. All CRM endpoints filter by authenticated partner identity. Arbitrary `partnerId` override in query/body is ignored.

## Cross-Tier Isolation

Server-scoped by tier resolution from `PartnerStorefront` status. Basic cannot access Pro-only mutations (`crm.customer.create_own`, `crm.customer.update_own`) even via direct API call.

## Anti-Enumeration

Search scoped before results. Exact email/phone queries return only own-partner data.

## Pagination

Default 20 rows, server-side pagination, filtered total, multi-page navigation.

## i18n

| Key | RU | AZ | EN |
|---|---|---|---|
| `partner.nav.customers` | Клиенты | Müştərilər | Customers |
| `partner.nav.crm` | CRM | CRM | CRM |
| `partner.crm.add_customer` | Добавить клиента | Müştəri əlavə et | Add customer |
| `partner.crm.total_customers` | Всего клиентов | Cəmi müştəri | Total customers |
| `partner.crm.my_customers` | Мои клиенты | Müştərilərim | My customers |
| `partner.crm.search_placeholder` | Поиск по имени или email… | Ad və ya email ilə axtar… | Search by name or email… |

Raw i18n keys = 0.

## Platform CRM Regression

Platform CRM (`/app/crm`) unchanged. Platform staff (ADMIN, SALES_MANAGER, OPERATOR) continue to use full platform CRM with Partner tab.

## Partner Products Regression

Partner products navigation (`/partner/products`, `/partner/products/new`) unchanged.

## Storefront Regression

Storefront page (`/partner/storefront`) unchanged. Both Basic (DRAFT/no storefront) and Pro (ACTIVE storefront) continue to function.

## Tests

| Gate | Result |
|---|---|
| Frontend TSC | ✅ PASS |
| Backend TSC | ✅ PASS |
| Frontend tests | ✅ 243/243 PASS |
| Frontend build | ✅ PASS (includes /partner/customers) |
| Backend tests | ✅ N/A (CRM has no dedicated unit tests; partner CRM tested via e2e) |

## Production Code Changed

| File | Change |
|---|---|
| `frontend/app/partner/layout.tsx` | Tier-aware navigation, workspace title static, CRM entry |
| `frontend/app/partner/customers/page.tsx` | **NEW** — Partner CRM page (Basic + Pro) |
| `frontend/lib/partner-i18n.ts` | Added CRM navigation keys |
| `backend/src/modules/crm/crm.controller.ts` | Partner CRM endpoints (from 3.5C) |
| `backend/src/modules/crm/crm.service.ts` | Partner CRM service + tier resolver (from 3.5C) |
| `backend/src/security/permissions.constants.ts` | Partner CRM permissions (from 3.5C) |
| `backend/src/security/security.service.ts` | Permission catalog (from 3.5C) |
| `frontend/app/app/crm/page.tsx` | Three-context CRM page (from 3.5C) |
| `frontend/lib/api.ts` | CrmTierResponse + partner CRM types (from 3.5C) |
| `frontend/lib/i18n.tsx` | CRM i18n keys (from 3.5C) |

## DB/Schema Changed

None. No migration required.

## Roadmap Status

| Step | Status |
|---|---|
| 3.5C | ✅ IMPLEMENTED (partner workspace UX + tier differentiation) |
| 3.5D | PLANNED — NOT STARTED |
| Refund UI | remaining independent gap |
| History UI | remaining independent gap |
| F.1–F.13 | NOT STARTED |
| S.1–S.19 | NOT STARTED |

## Remaining Findings

1. Backend CRM has no dedicated unit tests — recommend adding in 3.5D or as independent follow-up.
2. Partner Customer History tab not surfaced (CustomerHistory exists but UI not rendered).
3. Marketplace Basic customer source depends on order-based resolution; if partner has no orders, customer list will be empty (correct behavior, not a defect).

## Files Changed

```
frontend/app/partner/layout.tsx          — tier-aware nav + static title
frontend/app/partner/customers/page.tsx  — NEW partner CRM page
frontend/lib/partner-i18n.ts            — CRM i18n keys
backend/src/modules/crm/crm.controller.ts  — partner endpoints
backend/src/modules/crm/crm.service.ts     — tier resolver + partner CRM
backend/src/security/permissions.constants.ts — partner permissions
backend/src/security/security.service.ts     — permission catalog
frontend/app/app/crm/page.tsx              — three-context CRM
frontend/lib/api.ts                         — CRM types
frontend/lib/i18n.tsx                       — CRM i18n
```
