# Storefront Business Capability Model — Architecture Decision Record

**Date:** 2026-08-29
**Status:** DOCUMENTATION — NOT IMPLEMENTED
**Author:** Architecture Audit (Step 3.7B.4 Administrative Closure sequence)
**Scope:** Architecture / Roadmap amendment only — no production code changes

---

## 1. Architecture Decision

### 1.1 Storefront = Own Public Website + TravelHub Back Office

A Storefront Partner operates its **own public travel website** on top of TravelHub infrastructure, distributed through external acquisition channels (social networks, advertising, QR codes, search engines, messengers).

The Storefront consists of two distinct surfaces:

```
STOREFRONT PARTNER
│
├── PUBLIC STOREFRONT / OWN WEBSITE
│   ├── partner-owned homepage
│   ├── partner brand / theme
│   ├── partner catalog (enabled services only)
│   ├── customer search / filters
│   ├── booking / purchase flows
│   └── partner-owned acquisition channel
│
└── PARTNER WORKSPACE / BACK OFFICE
    ├── Рабочий стол (operational dashboard)
    ├── Аналитика (top-level section)
    ├── Продажи
    ├── Бронирования / Заказы
    ├── CRM
    ├── Финансы
    ├── Маркетинг
    ├── Сотрудники
    ├── Управление витриной
    └── Настройки
```

### 1.2 Semantic Separation

```
Главная        = public Storefront homepage (customer-facing)
Рабочий стол   = internal operational dashboard (Back Office)
Аналитика      = separate top-level Back Office section
```

Do not use "Главная" and "Рабочий стол" as synonyms.

### 1.3 Entitlement ≠ Business Capability ≠ Permission

```
Entitlement    answers: Which TravelHub product/features has the partner subscribed to?
Business Capability answers: Which categories of travel services does this Storefront operate/sell?
Permission     answers: What may this specific user/employee do inside enabled capabilities?
```

Hard invariant: a permission MUST NOT activate a business capability that the Storefront has not enabled.

### 1.4 Business Capability Hierarchy

```
IDENTITY
    ↓
WORKSPACE CONTEXT
    ↓
TENANT / PARTNER SCOPE
    ↓
PLAN / ENTITLEMENT
    ↓
BUSINESS CAPABILITIES          ← NEW CONCEPT
    ↓
ROLE / PERMISSIONS
    ↓
AVAILABLE ACTION / DATA / UI
```

### 1.5 Server Authority

Future implementation MUST NOT rely on:
- `display:none`
- frontend-only feature flags
- hidden menu items
- client-supplied capability claims

The server must be authoritative for whether the Storefront can perform capability-specific operations.

### 1.6 Historical Data Preservation

Disabling a capability MUST NOT delete or corrupt:
- Orders, Bookings, Payments, Refunds, Invoices
- CRM customer history, Communication history, CrmActivity
- Analytics facts, Audit records

Separate "ability to create new business" from "ability to read legitimate historical business records."

### 1.7 Source Attribution Boundary

```
Customer acquired through TravelHub Marketplace
    → MARKETPLACE source/context

Customer acquired through Partner's public Storefront
    → STOREFRONT source/context
    → direct Storefront Partner customer relationship
```

Business Capability selection does not change source attribution semantics.

### 1.8 Public Storefront Projection

Enabled Business Capabilities must determine the customer-facing Storefront composition:

```
Enabled:  HOTEL=ACTIVE, TOUR=ACTIVE, FLIGHT=DISABLED, TRANSFER=DISABLED

Public Storefront:
├── Главная
├── Отели
├── Туры
└── Search / Filters
    ├── Hotel-relevant controls
    └── Tour-relevant controls

NOT present: Flights/Transfers UI (inactive capabilities absent from discovery)
```

### 1.9 Back Office Projection

Business Capabilities affect Partner Back Office composition where domain-specific. A HOTEL-only Storefront should not receive Flight-specific KPI cards, filters, or operational actions.

Capability projection MUST NOT hide historical records the partner is legally/operationally allowed to inspect after disabling a capability.

### 1.10 Analytics Contract

Analytics remains a **separate top-level Partner Workspace section**, not a CRM subsection.

Storefront Analytics is both:
- entitlement-aware (Basic vs Pro depth)
- business-capability-aware (which category dimensions/views)

Historical analytics must remain accessible after capability is disabled.

### 1.11 Navigation Contract

```
available TravelHub capabilities
        ↓
Storefront enabled capabilities
        ↓
public navigation eligibility
        ↓
partner navigation configuration/order
        ↓
rendered Storefront navigation
```

A partner must not add a navigation entry for a disabled capability. This rule must eventually be enforced server-side.

---

## 2. Repository Evidence

### 2.1 Existing Storefront Domain (EXISTS)

| Model | Schema | Status |
|---|---|---|
| `PartnerStorefront` | `catalog` | EXISTS — id, code, partnerId, slug, status, entitlementStatus, themePreset, businessName, countryCode, heroHeading, etc. |
| `StorefrontSubscription` | `catalog` | EXISTS — subscription lifecycle tied to plan |
| `StorefrontSubscriptionPlan` | `catalog` | EXISTS — 2 plans (FREE_TRIAL, PREMIUM) |
| `StorefrontMedia` | `catalog` | EXISTS |
| `PublicSellerProfile` | `catalog` | EXISTS — APPROVED status, publicId SELL-* |
| `StorefrontBehavioralEvent` | `catalog` | EXISTS — behavioral instrumentation |
| `MarketplaceBehavioralEvent` | `catalog` | EXISTS |

### 2.2 Entitlement / Tier Resolution (EXISTS)

| Component | File | Status |
|---|---|---|
| `getCrmTier()` | `backend/src/modules/crm/crm.service.ts` | EXISTS — ACTIVE storefront + ACTIVE entitlement → PRO, otherwise BASIC |
| Partner CRM Tier API | `GET /partner/crm-tier` | EXISTS |
| Frontend tier detection | `frontend/app/partner/layout.tsx` | EXISTS — CABINET_NAV vs CUSTOMER_NAV_* |

### 2.3 Category / Service Registry (EXISTS)

18 root categories in `catalog.Category`:

| Code | Slug | Canonical ID |
|---|---|---|
| CAT-00000004 | tours | ✓ |
| CAT-00000005 | accommodation | ✓ |
| CAT-00000006 | excursions | ✓ |
| CAT-00000007 | activities-entertainment | ✓ |
| CAT-00000008 | flights | ✓ |
| CAT-00000009 | rail | ✓ |
| CAT-00000010 | bus-ground-transport | ✓ |
| CAT-00000011 | transfers | ✓ |
| CAT-00000012 | car-rental | ✓ |
| CAT-00000013 | other-vehicle-rental | ✓ |
| CAT-00000014 | guides | ✓ |
| CAT-00000015 | cruises | ✓ |
| CAT-00000016 | tickets-events | ✓ |
| CAT-00000017 | food-gastronomy | ✓ |
| CAT-00000018 | wellness-spa | ✓ |
| CAT-00000019 | travel-insurance | ✓ |
| CAT-00000020 | visa-services | ✓ |
| CAT-00000021 | travel-ancillary-services | ✓ |

These canonical category IDs should be reused as the Business Capability registry, NOT a separate taxonomy.

### 2.4 Partner Workspace Architecture (EXISTS — PARTIAL)

| Component | File | Status |
|---|---|---|
| Platform Shell + Sidebar | `frontend/components/Shell.tsx` | EXISTS — NAV items, permission gating |
| Partner Shell architecture | `docs/architecture/partner-workspace-shared-sidebar-architecture.md` | EXISTS — documented migration plan |
| Partner NavItem contract | Partner layout | EXISTS — tier-aware nav items |
| Workspace Shell reuse pattern | Architecture doc | EXISTS — shared Shell with partner-specific manifests |

### 2.5 Public Storefront (EXISTS — PARTIAL)

| Component | File | Status |
|---|---|---|
| StorefrontController | `backend/src/modules/catalog/storefront/storefront.controller.ts` | EXISTS |
| StorefrontAdminController | Same module | EXISTS |
| `/store/:slug` routes | Frontend | EXISTS |
| PublicCatalogController | Same module | EXISTS |

### 2.6 Storefront Settings (MISSING)

No dedicated Storefront Settings UI or backend exists. The partner can manage storefront properties through existing CRUD endpoints, but there is no:
- Business capability management interface
- Capability enable/disable flow
- Capability-aware settings pages

### 2.7 Business Capability Model (MISSING)

No `BusinessCapability`, `StorefrontCapability`, or equivalent table exists. The concept of "which service categories this Storefront sells" is not persisted as a first-class domain entity. Currently, capabilities are implicitly derived from the partner's Product listings (if they have products in a category, they sell that category).

### 2.8 Capability Lifecycle (MISSING)

No ACTIVE/DISABLED lifecycle for per-category Storefront capabilities exists.

### 2.9 Dashboard Capability Projection (MISSING)

The Partner Dashboard does not currently project capability-specific sections. It shows generic KPIs without filtering by enabled service categories.

### 2.10 Analytics Capability Projection (MISSING)

Analytics does not currently filter dimensions by enabled Storefront capabilities.

---

## 3. Gap Matrix

| Concern | Existing authority | Current state | Gap | Future implementation stage |
|---|---|---|---|---|
| Storefront public site boundary | PartnerStorefront + slug routing | EXISTS — public Storefront renders | No explicit capability boundary in public rendering | Stage C |
| Storefront homepage semantics | Route `/store/:slug` | EXISTS — renders public Storefront | No capability-based content filtering on homepage | Stage C |
| Business Capability registry | `catalog.Category` (18 root categories) | EXISTS — canonical IDs | No `StorefrontCapability` join table linking Storefront ↔ Category | Stage A |
| Capability persistence | PartnerStorefront (no capability FK) | MISSING | No DB entity for "this Storefront sells HOTEL+TOUR" | Stage A |
| Capability lifecycle | No lifecycle enum | MISSING | No ACTIVE/DISABLED per-category state | Stage A |
| Storefront Settings | No settings UI | MISSING | No `/partner/storefront/settings` or capability management | Stage B |
| Public nav projection | Static nav in frontend | PARTIAL — no capability filtering | Nav shows all categories regardless of Storefront capabilities | Stage C |
| Search/filter projection | PublicCatalogController | PARTIAL — no capability scoping | Search returns all categories, not filtered by enabled capabilities | Stage C |
| Dashboard projection | Partner Dashboard | PARTIAL — generic KPIs | No capability-specific dashboard sections | Stage D |
| Analytics projection | Analytics Foundation (3.3) | PARTIAL — no capability filtering | Analytics shows all data, not filtered by enabled capabilities | Stage D |
| API enforcement | getCrmTier() | PARTIAL — tier-only | No capability-level server-side authorization | Stage A |
| Historical data behavior | Soft-delete pattern | EXISTS — existing convention | No explicit capability-disable preservation contract | Stage A (document) |
| Capability onboarding | Subscription flow (3.29D) | PARTIAL — subscription exists | No capability selection during onboarding | Stage F |
| Public URL/domain | `/store/:slug` | EXISTS — basic routing | No custom domain support | Deferred (3.29B/3.29C) |

---

## 4. Future Implementation Stage Sequence

These stages are placed AFTER the current Step 3.7B Communication Integration closure sequence. They do NOT disturb the current canonical NEXT (3.7B Strict Review → 3.7C etc.).

### Stage A — Business Capability Domain / Server Authority
- Create `StorefrontCapability` join table (storefrontId, categoryId, status, lifecycle)
- Capability lifecycle enum: `ACTIVE | DISABLED`
- Server-side capability resolver: "which categories does this Storefront sell?"
- API enforcement: capability-gated operations
- Reuse `catalog.Category` as canonical registry (no duplicate taxonomy)
- Historical data preservation contract on disable

### Stage B — Storefront Settings Capability Management
- `/partner/storefront/settings` UI
- "Business Services" / "Услуги бизнеса" section
- Enable/disable capabilities with warnings
- Capability prerequisites per category (document only, not all enforced)

### Stage C — Public Storefront Navigation / Search / Filter Projection
- Capability-derived public navigation
- Capability-scoped search and filters
- Homepage service blocks filtered by enabled capabilities
- Server-side enforcement (not just frontend hiding)

### Stage D — Partner Back Office Capability Projection
- Dashboard capability-aware sections/KPIs
- Analytics capability-aware dimensions/views
- Sales/Orders/Bookings filtered by enabled capabilities
- Historical records preserved when capability disabled

### Stage E — Storefront Pro Back Office Visual Alignment
- Shared Workspace Shell + sidebar with partner-specific manifests
- Visual consistency with Platform design system (shell, sidebar, header, KPI, grid, charts)
- Public Storefront retains partner brand (NOT forced to copy TravelHub)

### Stage F — Onboarding / Enable-New-Capability Integration
- Capability selection during Storefront onboarding
- Enable-new-capability flow from Settings
- Subscription plan ↔ capability mapping

---

## 5. Canonical Category ↔ Business Capability Mapping

Reuse `catalog.Category` canonical IDs. No new taxonomy.

```typescript
// Conceptual capability model (NOT implemented yet)
interface StorefrontCapability {
  id: string;
  storefrontId: string;     // FK → PartnerStorefront
  categoryId: string;       // FK → Category (canonical ID)
  status: 'ACTIVE' | 'DISABLED';
  enabledAt: Date;
  disabledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

The partner's effective capabilities = `SELECT categoryId FROM StorefrontCapability WHERE storefrontId = ? AND status = 'ACTIVE'`.

---

## 6. Non-Goals (This Step)

This architecture documentation step does NOT implement:
- New database schema
- New capability tables
- New API endpoints
- New Storefront Settings UI
- New public Storefront UI
- Dashboard redesign
- Analytics redesign
- Sidebar redesign
- Search/filter changes
- Custom domain
- New subscription logic
- New CRM behavior
- New authorization middleware
