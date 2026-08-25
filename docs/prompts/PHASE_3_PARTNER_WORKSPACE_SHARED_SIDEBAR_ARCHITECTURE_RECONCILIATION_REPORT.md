# PHASE 3 — PARTNER WORKSPACE SHARED SIDEBAR ARCHITECTURE RECONCILIATION — REPORT

## VERDICT: VERDICT A — PARTNER WORKSPACE SHARED SIDEBAR ARCHITECTURE / PLATFORM SIDEBAR FRAMEWORK REUSE FOR MARKETPLACE BASIC + STOREFRONT PRO FULLY RECONCILED — READY FOR IMPLEMENTATION

---

## Existing Platform Sidebar

| Aspect | File/Pattern |
|---|---|
| Layout | `frontend/app/app/layout.tsx` — wraps children in `<Shell>` |
| Shell + Sidebar | `frontend/components/Shell.tsx` — left sidebar (w-60, bg-slate-900) |
| Nav items | `NAV: NavItem[]` — `{href, icon, labelKey, permission?}` |
| Active state | `isDashboardPath()` — `pathname.startsWith(href)` |
| Permission gating | `canAccess()` — `user.permissions.includes(permission)` |
| Workspace label | Brand logo + "Internal App" subtitle + role badge |
| Logout | Footer — `api.post("/auth/logout")` |
| Marketplace link | Footer — "На витрину →" |
| Hidden items note | Footer — "{N} раздел(ов) скрыто — нет прав доступа" |
| External role guard | `isExternalRole(user.role)` → redirect to `homeForRole()` |
| Collapse | Not yet implemented |
| Responsive | Not yet implemented |
| Breadcrumbs | Page-level `PageHeader` component, not sidebar-driven |

## Existing Partner Shell

| Aspect | File/Pattern |
|---|---|
| Layout | `frontend/app/partner/layout.tsx` — horizontal top nav |
| Nav items | `CABINET_NAV` + tier-aware `CUSTOMER_NAV_*` — `{href, labelKey, icon}` |
| Active state | `isActive()` — `pathname.startsWith(href)` |
| Tier detection | `GET /partner/crm-tier` → `BASIC` or `PRO` |
| Workspace label | "Кабинет партнёра" — static `<div>` (not clickable) |
| Logout | Header button |
| Marketplace link | "На витрину" header link |
| Onboarding gate | Pending (no partnerId) → only onboarding routes |
| Permission gating | None at sidebar level (backend enforces) |
| Collapse | N/A (horizontal nav) |
| Responsive | N/A (horizontal nav wraps) |
| Breadcrumbs | None |

## Shared Components

| Component/Pattern | Platform File | Partner Reuse | Notes |
|---|---|---|---|
| Shell layout (left sidebar) | `Shell.tsx` | `PartnerShell.tsx` (new) | Same structural pattern |
| NavItem interface | `NavItem` | `PartnerNavItem` | Identical shape: `{href, icon, labelKey, permission?}` |
| canAccess() | `Shell.tsx` | Direct import | Permission gating identical |
| Active route check | `isDashboardPath()` | Same pattern | `pathname.startsWith(href)` |
| Auth guard | Shell + middleware | Partner layout | Same pattern |
| Logout | `api.post("/auth/logout")` | Direct reuse | Identical |
| Marketplace link | Shell footer | PartnerShell footer | Identical |
| Loading state | `div` placeholder | Same pattern | Until user resolved |
| useCurrentUser | `@/lib/use-user` | Direct import | Same hook |

## Workspace Shell

Shared left sidebar framework. Platform uses `Shell.tsx`. Partner will use `PartnerShell.tsx` following the same structural pattern but with partner-specific nav manifests and tier resolution.

## Sidebar

Left sidebar (w-60, bg-slate-900) with:
- Brand header
- Nav sections with grouped items
- Active route highlight (border-r-2, bg-blue-500/15)
- Footer with user info, utility links, logout

## Nav Manifest

Data-driven: array of `NavItem` objects with `{href, icon, labelKey, permission?}`. Different manifests for Platform vs Partner Basic vs Partner Pro.

## Permissions

`canAccess(user, permission)` — checks `user.permissions.includes(permission)`. Reused directly.

## Entitlements

Partner tier resolved server-side via `GET /partner/crm-tier`. Frontend uses resolved tier to select nav manifest. Not an independent entitlement authority.

## Active State

`pathname.startsWith(href)` pattern. Dashboard exception: exact match for `/app/dashboard` or `/partner`.

## Breadcrumbs

Platform: `PageHeader` component with `breadcrumbs` prop. Partner: can reuse same `PageHeader` component inside content area.

## Collapse

Not yet implemented in Platform Shell. When implemented, Partner should reuse same behavior.

## Responsive

Not yet implemented in Platform Shell. When implemented, Partner should reuse same behavior.

## Marketplace Basic Manifest

Implemented at runtime:

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

All items permission-gated server-side.

## Storefront Pro Manifest

Implemented at runtime:

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

Future modules (NOT SHOWN YET):
- Command Center / Аналитика — PW.F1
- Заказы — PW.F2
- Бронирования — PW.F3
- Финансы — PW.F4
- Сообщения — PW.F5
- Сотрудники — PW.F6

## Current Routes

| Route | Module | Tier | Status |
|---|---|---|---|
| `/partner` | Overview | Both | ✅ |
| `/partner/products` | Products list | Both | ✅ |
| `/partner/products/new` | New product | Both | ✅ |
| `/partner/products/[id]` | Product detail | Both | ✅ |
| `/partner/products/[id]/edit` | Product edit | Both | ✅ |
| `/partner/products/[id]/media` | Product media | Both | ✅ |
| `/partner/products/[id]/moderation` | Product moderation | Both | ✅ |
| `/partner/products/[id]/preview` | Product preview | Both | ✅ |
| `/partner/seller-profile` | Seller identity | Both | ✅ |
| `/partner/storefront` | Storefront mgmt | Both | ✅ |
| `/partner/storefront/preview` | Storefront preview | Both | ✅ |
| `/partner/customers` | Customer list/CRM | Both | ✅ |
| `/partner/onboarding` | Onboarding | Pending | ✅ |

## Route Migration Strategy

Minimal disruption. Existing `/partner/*` routes remain functional. PartnerShell wraps them in left sidebar layout. No route changes required.

## Basic → Pro Upgrade

Shared shell remains. Additional modules appear (CRM → full CRM). Current valid data remains. No customer/order/service loss.

## Pro → Basic Downgrade

Shared shell remains. Pro-only modules disappear. Server denies Pro-only routes/actions. Historical data remains. Basic-safe modules remain.

## Marketplace + Storefront Dual-Channel

Single partner workspace. Pro partner may operate both Marketplace and Storefront channels. Future channel filters may appear inside relevant modules. Do not duplicate navigation for channels.

## Partner Admin → Own Storefront

ALLOW. Utility link in sidebar footer or header for preview/check.

## Partner Admin → TravelHub Marketplace

ALLOW. Utility link in sidebar footer. Does not change authorization context.

## Public Storefront → Marketplace Policy

NO prominent competitor-marketplace diversion by default. Protect partner direct channel.

## Platform Branding / Powered by TravelHub

Brand attribution only. Not a Marketplace traffic routing CTA.

## Storefront Traffic-Protection Invariant

Partner acquires/directs customer → customer enters partner Storefront → customer should remain in partner-branded sales funnel. No unnecessary traffic leakage to competing marketplace supply.

## Platform Command Center Reuse

Reuse framework (page shell, sections, KPI card components, chart patterns, date range). Partner metrics must be partner-scoped, channel-aware, entitlement-aware. Do not copy Platform KPI semantics.

## Partner Command Center Semantics

Future. Partner-scoped metrics for own business. Not a copy of Platform-wide Command Center.

## Platform Analytics Reuse

Reuse analytics framework. Partner analytics scoped to own business data.

## Partner Analytics Semantics

Future. Sales, customers, products, channels, conversion for own partner scope.

## CRM

Already implemented:
- Basic: simple customer management (marketplace orders)
- Pro: full CRM (CustomerRelation, intake, lifecycle, tags, notes, assignedTo)

## Finance Boundary

Customer Payment ≠ Supplier Settlement ≠ Supplier Payout. Future supplier finance from S.1–S.19. No fake "Баланс" / "Выплаты" until implemented.

## Current Runtime Modules

| Module | Basic | Pro | Runtime | Sidebar |
|---|---|---|---|---|
| Overview | ✅ | ✅ | Implemented | ✅ |
| Services | ✅ | ✅ | Implemented | ✅ |
| Customers | ✅ | ✅ | Implemented | ✅ |
| CRM | ❌ | ✅ | Implemented | ✅ |
| Orders | ❌ | ❌ | NOT STARTED | NOT SHOWN |
| Bookings | ❌ | ❌ | NOT STARTED | NOT SHOWN |
| Analytics | ❌ | ❌ | NOT STARTED | NOT SHOWN |
| Finance | ❌ | ❌ | NOT STARTED | NOT SHOWN |
| Messages | ❌ | ❌ | NOT STARTED | NOT SHOWN |
| Employees | ❌ | ❌ | NOT STARTED | NOT SHOWN |
| Marketing | ❌ | ❌ | NOT STARTED | NOT SHOWN |
| Storefront | ✅ | ✅ | Implemented | ✅ |
| Settings | ✅ | ✅ | Implemented | ✅ |

## Future Modules NOT SHOWN

- Command Center / Аналитика
- Заказы
- Бронирования
- Финансы
- Сообщения
- Сотрудники
- Маркетинг
- Omnichannel

## Architecture Files

- `docs/architecture/partner-workspace-shared-sidebar-architecture.md` — NEW

## Roadmap

- 3.5C: ✅ IMPLEMENTED (partner CRM + tier differentiation)
- 3.5D: PLANNED — NOT STARTED
- PW.1-PW.9: PROPOSED — NOT STARTED (shared sidebar migration)
- F.1–F.13: NOT STARTED
- S.1–S.19: NOT STARTED

## Implementation Decomposition

| Step | Description | Scope |
|---|---|---|
| PW.1 | Create PartnerShell.tsx with sidebar layout | Frontend |
| PW.2 | Integrate PartnerShell into partner layout | Frontend |
| PW.3 | Define Basic nav manifest | Frontend |
| PW.4 | Define Pro nav manifest | Frontend |
| PW.5 | Permission + entitlement integration | Frontend + backend |
| PW.6 | Route migration / compatibility | Frontend |
| PW.7 | Active state + breadcrumbs | Frontend |
| PW.8 | Collapse + responsive behavior | Frontend |
| PW.9 | Browser/runtime closure | Verification |

## Production Code Changed

NO. This is documentation-only reconciliation.

## DB Schema Changed

NO.

## Runtime Changed

NO.

## Commit

Pending.

## HEAD

`3392583`

## origin/master

`3392583`

## HEAD == origin/master

✅

## Unrelated Files

0.

## Remaining Findings

1. Platform Shell does not yet have collapse/responsive behavior. Partner should implement these simultaneously when Platform adds them.
2. Breadcrumbs are currently `PageHeader` component, not sidebar-driven. Can be reused as-is.
3. Partner nav currently has "Новая услуга" as a separate item. Consider merging into "Мои услуги" as a primary action button in sidebar migration.
4. Workspace label for Partner should show resolved tier ("Marketplace Basic" / "Storefront Pro") rather than role ("PARTNER").

## First Authorized Implementation Substep

PW.1 — Create `PartnerShell.tsx` with left sidebar layout, reusing Platform Shell patterns.
