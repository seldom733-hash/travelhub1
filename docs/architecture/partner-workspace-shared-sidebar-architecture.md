# Partner Workspace — Shared Sidebar Architecture

## Overview

The Partner Workspace migrates from a horizontal top-navigation pattern to the shared Workspace Shell + Left Sidebar framework used by the Platform (internal) workspace. The same architectural components are reused with different navigation manifests driven by partner tier (Marketplace Basic vs Storefront Pro).

## Architecture Diagram

```
SHARED WORKSPACE SHELL
├── PLATFORM (/app/*)
│   └── Shell.tsx — NAV manifest (admin roles)
│
├── PARTNER (/partner/*)
│   ├── MARKETPLACE BASIC
│   │   └── PartnerShell — Basic nav manifest
│   │
│   └── STOREFRONT PRO
│       └── PartnerShell — Pro nav manifest
│
└── BUYER (/account/*)
    └── BuyerShell (separate, not in scope)
```

## Core Invariant

```
SHARED WORKSPACE SHELL FRAMEWORK
≠
SHARED BUSINESS CONTENT
```

The shell provides:
- Left sidebar layout
- Section grouping
- Active route state
- Collapse behavior
- Responsive behavior
- Permission-aware rendering
- Workspace context rendering

Business content (routes, modules, KPIs, analytics) depends on workspace context and entitlement.

## Existing Platform Shell (reference)

| Component | File | Pattern |
|---|---|---|
| Layout wrapper | `frontend/app/app/layout.tsx` | `<Shell>{children}</Shell>` |
| Shell + Sidebar | `frontend/components/Shell.tsx` | Left sidebar with NAV array |
| Nav items | `Shell.tsx` — `NAV: NavItem[]` | `{href, icon, labelKey, permission?}` |
| Active state | `Shell.tsx` — `isDashboardPath()` | `pathname.startsWith(href)` |
| Permission gating | `Shell.tsx` — `canAccess()` | `user.permissions.includes(permission)` |
| Workspace label | Sidebar header | Brand + role badge |
| Logout | Sidebar footer | `api.post("/auth/logout")` |
| Marketplace link | Sidebar footer | "На витрину →" |

### Platform NavItem contract

```ts
interface NavItem {
  href: string;
  icon: string;
  labelKey: string;
  permission?: string;
}
```

### Platform routing rules

- Anonymous → `/login` (middleware, server-side)
- External roles (PARTNER/BUYER) → `homeForRole()` redirect
- No permission → redirect to `/app/dashboard`
- Children not rendered until user is resolved (no flash of internal UI)

## Current Partner Shell (horizontal nav)

| Component | File | Pattern |
|---|---|---|
| Layout | `frontend/app/partner/layout.tsx` | Top horizontal nav bar |
| Nav items | `CABINET_NAV` + `CUSTOMER_NAV_*` | `{href, labelKey, icon}` |
| Active state | `isActive()` | `pathname.startsWith(href)` |
| Tier detection | `/partner/crm-tier` API | `BASIC` or `PRO` |
| Workspace label | Header | "Кабинет партнёра" (static) |
| Logout | Header button | `api.post("/auth/logout")` |

### Partner NavItem contract (current)

```ts
const NAV = [
  { href: "/partner", labelKey: "partner.nav.overview", icon: "🏠" },
  { href: "/partner/products", labelKey: "partner.nav.products", icon: "🧳" },
  { href: "/partner/products/new", labelKey: "partner.nav.new_product", icon: "➕" },
  { href: "/partner/seller-profile", labelKey: "partner.nav.seller_identity", icon: "🛡" },
  { href: "/partner/storefront", labelKey: "partner.nav.storefront", icon: "🏪" },
  // Tier-aware: added dynamically
  tier === "PRO"
    ? { href: "/partner/customers", labelKey: "partner.nav.crm", icon: "👥" }
    : { href: "/partner/customers", labelKey: "partner.nav.customers", icon: "👤" },
];
```

## Shared Shell Migration Plan

### Target: `PartnerShell.tsx`

A new component that reuses the Platform Shell pattern (left sidebar, section groups, permission gating) but with partner-specific navigation manifests.

```
frontend/components/PartnerShell.tsx
  └── imports shared sidebar patterns from Shell.tsx
  └── partner-specific NAV manifests (Basic / Pro)
  └── tier resolution via /partner/crm-tier
  └── permission gating via user.permissions
```

### Reuse Matrix

| Capability | Platform Shell | Partner Shell | Reuse |
|---|---|---|---|
| Left sidebar layout | `Shell.tsx` | `PartnerShell.tsx` | Pattern reuse |
| NavItem interface | `NavItem` | `PartnerNavItem` | Extended (no change to core) |
| Permission gating | `canAccess()` | `canAccess()` | Direct reuse |
| Active route state | `isDashboardPath()` | `isActive()` | Same pattern |
| Workspace label | Brand + role badge | Brand + tier badge | Adapted |
| Logout | `api.post("/auth/logout")` | Same | Direct reuse |
| Marketplace link | Footer link | Footer link | Direct reuse |
| Collapse behavior | Current Shell | Future PW.5 | Framework reuse |
| Responsive behavior | Current Shell | Future PW.5 | Framework reuse |
| Breadcrumbs | Current Shell | Future PW.5 | Framework reuse |

## Marketplace Basic Nav Manifest

Implemented modules (runtime-available):

```
ОБЗОР
  🏠 Обзор                    /partner

ПРОДАЖИ
  🧾 Мои услуги               /partner/products
  ➕ Новая услуга             /partner/products/new

КЛИЕНТЫ
  👤 Клиенты                  /partner/customers

НАСТРОЙКИ
  🛡 Идентичность             /partner/seller-profile
  🏪 Витрина                  /partner/storefront
```

All items are permission-gated server-side. Basic cannot access Pro-only mutations.

## Storefront Pro Nav Manifest

Extended modules (runtime-available):

```
ОБЗОР
  🏠 Обзор                    /partner

ПРОДАЖИ
  🧾 Мои услуги               /partner/products
  ➕ Новая услуга             /partner/products/new

КЛИЕНТЫ
  👥 CRM                      /partner/customers

НАСТРОЙКИ
  🛡 Идентичность             /partner/seller-profile
  🏪 Витрина                  /partner/storefront
```

Future Pro modules (NOT SHOWN YET):
- Command Center / Аналитика — PW.F1
- Заказы — PW.F2
- Бронирования — PW.F3
- Финансы — PW.F4
- Сообщения — PW.F5
- Сотрудники — PW.F6

## Current Partner Routes

| Route | Module | Tier | Status |
|---|---|---|---|
| `/partner` | Overview | Both | ✅ Implemented |
| `/partner/products` | Products list | Both | ✅ Implemented |
| `/partner/products/new` | New product | Both | ✅ Implemented |
| `/partner/products/[id]` | Product detail | Both | ✅ Implemented |
| `/partner/products/[id]/edit` | Product edit | Both | ✅ Implemented |
| `/partner/products/[id]/media` | Product media | Both | ✅ Implemented |
| `/partner/products/[id]/moderation` | Product moderation | Both | ✅ Implemented |
| `/partner/products/[id]/preview` | Product preview | Both | ✅ Implemented |
| `/partner/seller-profile` | Seller identity | Both | ✅ Implemented |
| `/partner/storefront` | Storefront mgmt | Both | ✅ Implemented |
| `/partner/storefront/preview` | Storefront preview | Both | ✅ Implemented |
| `/partner/customers` | Customer list/CRM | Both | ✅ Implemented |
| `/partner/onboarding` | Onboarding | Pending | ✅ Implemented |

## Route Migration Strategy

**Minimal disruption**: Existing `/partner/*` routes remain functional. The PartnerShell wraps them in a left sidebar layout. No route changes required for migration.

```
Phase 1: Create PartnerShell.tsx with left sidebar
Phase 2: Wrap partner layout in PartnerShell
Phase 3: Remove horizontal nav from layout
Phase 4: Verify all deep links work
```

## Tier Resolution

Server-authoritative via `GET /partner/crm-tier`:

```
PartnerStorefront.status = 'ACTIVE'
AND PartnerStorefront.entitlementStatus = 'ACTIVE'
→ PRO
else
→ BASIC
```

Frontend consumes `{tier: "BASIC" | "PRO"}` and selects appropriate nav manifest.

## Authorization Hierarchy

```
IDENTITY
→ WORKSPACE CONTEXT (PARTNER)
→ TENANT / PARTNER SCOPE (actor.partnerId)
→ PLAN / ENTITLEMENTS (Storefront status)
→ BUSINESS CAPABILITIES (Basic / Pro)
→ ROLE / PERMISSIONS (crm.customer.read_own, etc.)
→ PAGE / ACTION AVAILABILITY
```

Sidebar is a consumer of this authority. Hidden nav items do not replace backend denial.

## Upgrade / Downgrade

**BASIC → PRO**:
- Shared shell remains
- Additional modules appear (CRM → full CRM)
- Current valid data remains
- No customer/order/service loss

**PRO → BASIC**:
- Shared shell remains
- Pro-only modules disappear
- Server denies Pro-only routes/actions
- Historical data remains
- Basic-safe modules remain

## Storefront Channel Navigation (§37A)

| Actor | Own Storefront link | TravelHub Marketplace link | Policy |
|---|---|---|---|
| Pro admin workspace | ALLOW (utility link) | ALLOW (utility link) | Operational navigation |
| Basic admin workspace | According to entitlement | ALLOW | Operational/upgrade |
| Customer on public Storefront | Native storefront | NO prominent diversion | Protect partner direct channel |
| Customer on Marketplace | N/A | Native marketplace | Marketplace context |

## Implementation Decomposition

| Step | Description | Scope |
|---|---|---|
| PW.1 | Create PartnerShell.tsx with sidebar layout | Frontend component |
| PW.2 | Integrate PartnerShell into partner layout | Frontend layout |
| PW.3 | Define Basic nav manifest | Frontend config |
| PW.4 | Define Pro nav manifest | Frontend config |
| PW.5 | Permission + entitlement integration | Frontend + backend |
| PW.6 | Route migration / compatibility | Frontend routing |
| PW.7 | Active state + breadcrumbs | Frontend UI |
| PW.8 | Collapse + responsive behavior | Frontend UI |
| PW.9 | Browser/runtime closure | Verification |
