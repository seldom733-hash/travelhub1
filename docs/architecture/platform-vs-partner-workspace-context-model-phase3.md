# TravelHub — Platform vs Partner Workspace — Architecture Context Model

**Status:** Architecture Addendum — Design Only (NO production changes)  
**Date:** 2026-08-19  
**Reconciled with:** Global Workspace Constructor Foundation (Step 3.3E, commit `26e1d9c`)  
**Authoritative inputs:** Canonical Roadmap v3, approved Step 3.3 Analytics, Step 3.1 Dashboard Backend, Step 3.3E Workspace Constructor Foundation, existing Prisma schema/RBAC

---

## 1. Purpose

This addendum canonically separates two business contexts in TravelHub:

```text
A. TRAVELHUB PLATFORM (Marketplace Operator Workspace)
B. PARTNER STOREFRONT / SELLER WORKSPACE
```

and establishes how they must differ across:
- Command Center content
- Dashboard widgets
- Left navigation
- Analytics dimensions
- Sales / Orders / Bookings / Finance scope
- CRM / Communications
- Employee Analytics
- Permissions / Isolation
- Channel attribution

---

## 2. Hard Architectural Distinction

```text
PLATFORM WORKSPACE ≠ PARTNER WORKSPACE
```

```text
MARKETPLACE CHANNEL ≠ PARTNER STOREFRONT CHANNEL
```

This is NOT two independent systems. It is:

```text
ONE PLATFORM + CONTEXT-AWARE WORKSPACES
```

The existing `Global Workspace Constructor Framework` (Step 3.3E) remains the single constructor. Context awareness is added via configuration, not a new framework.

---

## 3. Business Context A — TravelHub Platform

TravelHub as marketplace operator:

```text
Partners → TravelHub Marketplace → Customers
```

Monetization:
```text
COMMISSION FROM SALES
```

Typical Platform employee duties:
- Partner registration/verification
- Application review / onboarding
- Listing moderation
- Content moderation
- Quality control
- Complaints/disputes
- Support (platform-level)
- Fraud/abuse detection
- Payment/reconciliation oversight
- Commission control
- Marketplace performance monitoring
- Partner performance oversight

---

## 4. Business Context B — Partner Storefront

Partner as independent business using TravelHub SaaS:

```text
Partner Brand → Partner Storefront → Partner Customers
```

Monetization (TravelHub):
```text
SUBSCRIPTION / STORE USE FEE
```

Partner manages independently:
- Sales / Orders / Bookings
- Customers
- Employees / Roles
- Products / Services
- Communications (own customers)
- Internal analytics
- Storefront configuration

---

## 5. Workspace Context Hierarchy

Extended from existing Step 3.3E hierarchy:

```text
PLATFORM / TENANT CONTEXT
        ↓
BUSINESS CAPABILITIES
        ↓
ROLE / PERMISSIONS
        ↓
PAGE / WIDGET / ACTION AVAILABILITY
        ↓
USER LAYOUT (Step 3.3E)
```

The existing `System Default → Role Default → User Layout` remains unchanged. Context is injected ABOVE role in the resolution chain, not as a replacement.

---

## 6. Context Identifier

```text
contextType: "PLATFORM" | "PARTNER"
```

This is a workspace-level classification, not a user role. The same user with role `DIRECTOR` sees completely different content depending on context.

---

## 7. Role ≠ Context (Hard Rule)

```text
ROLE ≠ BUSINESS CONTEXT
```

Examples:
- `DIRECTOR` at TravelHub Platform → marketplace oversight
- `DIRECTOR`/`OWNER` at Partner → partner business management

Same role name, different data, different responsibilities, different dashboards.

---

## 8. Marketplace Basic vs Storefront Pro (Entitlement Tiers)

Within Partner Workspace, two entitlement levels:

### Marketplace Basic
Partner sells through TravelHub marketplace only. KPI:
- Own listings/services
- Orders, Bookings
- Messages
- Basic Finance (own payments, refunds)
- Basic Analytics (sales, orders, revenue, conversion)

### Storefront Pro
Partner has own storefront on TravelHub infrastructure:
- Full Command Center
- Full Analytics
- CRM
- Employees / Roles & Permissions
- Marketing
- Advanced Finance
- Storefront / Company Settings
- Workspace customization (constructor)
- Future Omnichannel

### Key Principle
```text
ENTITLEMENT ≠ PERMISSION ≠ CAPABILITY
```

- Entitlement = what the organization has purchased/received
- Permission = what a specific user is allowed to do
- Business Capability = what the business does (accommodation, tours, transfers)

---

## 9. Resolution Order (Target)

```text
IDENTITY
→ WORKSPACE CONTEXT (PLATFORM | PARTNER)
→ TENANT / PARTNER SCOPE
→ PLAN / ENTITLEMENTS (Basic | Pro)
→ BUSINESS CAPABILITIES (Accommodation, Tours, etc.)
→ ROLE / PERMISSIONS
→ PAGE / WIDGET / ACTION AVAILABILITY
→ USER LAYOUT
```

---

## 10. Platform Command Center (Conceptual Content)

| Section | KPIs / Widgets |
|---|---|
| Marketplace Overview | GMV, Orders, Bookings, Conversion, AOV |
| Partner Management | Applications, Verification, Active/Inactive Partners |
| Moderation | Listings awaiting review, Backlog, SLA (if authority exists) |
| Financial | Commission, Payments, Refunds, Reconciliation |
| Support / Risk | Complaints, Disputes, Unresolved, Fraud indicators |
| Employees / Operations | Workload, SLA, Task completion |

---

## 11. Partner Command Center (Conceptual Content)

| Section | KPIs / Widgets |
|---|---|
| Sales | Revenue, Orders, AOV, Conversion |
| Bookings / Fulfillment | New, Confirmed, Upcoming, Completed, Cancelled |
| Customers | New, Returning, Communication, Conversion |
| Employees | Workload, Permissions, Performance (later) |
| Finance | Payments, Refunds, Reconciliation |
| Communications | Unread, Unanswered, Response time |
| Business-specific | Occupancy, Seats, Drivers (capability-driven) |

---

## 12. Widget Registry Impact

The existing Widget Registry (Step 3.3E) currently supports:

```text
pageIds: ["command-center"]
```

Future extension (NOT implementing now):

```text
contexts: ["PLATFORM"] | ["PARTNER"] | ["PLATFORM", "PARTNER"]
requiredCapabilities: ["accommodation"] | ["tours"] | ["transfers"]
entitlement: "basic" | "pro"
```

---

## 13. Left Navigation — Context-Aware (Target)

### Platform Left Menu
```text
Command Center
Marketplace
Partners
Moderation
Sales
Orders
Bookings
Customers
Finance
Support
Analytics
Employees
Marketing
Documents
Settings
```

### Partner Left Menu
```text
Command Center
Sales
Orders
Bookings
Customers
Messages
Employees
Analytics
Finance
Products / Services
Marketing
Storefront Settings
Company Settings
```

### Capability-Driven Navigation (Future)
- Accommodation: Properties, Rooms, Rates, Availability
- Tours: Tours, Departures, Schedules, Seats
- Transfers: Transfers, Vehicles, Drivers, Assignments

---

## 14. Monetization Separation (Hard Rule)

| Channel | TravelHub Revenue | Not Mixed With |
|---|---|---|
| Marketplace | Commission per transaction | Subscription |
| Storefront | Subscription / SaaS fee | Commission |

Do NOT apply marketplace commission logic to storefront sales.

---

## 15. Channel Dimension in Analytics

Analytics must distinguish at minimum:

```text
TRAVELHUB_MARKETPLACE
PARTNER_STOREFRONT
```

Check Step 3.3 `acquisitionSource` readiness. If insufficient — report as gap.

Partner Analytics target:
```text
ALL SALES | TRAVELHUB MARKETPLACE | MY STOREFRONT
```

---

## 16. Communication Isolation

| Channel | Ownership |
|---|---|
| Customer ↔ Partner | Partner workspace |
| Customer ↔ TravelHub | Platform support workspace |
| Partner ↔ TravelHub | Platform-partner support/compliance |

Partner message privacy: TravelHub admins do NOT have unrestricted access to Partner↔Customer conversations. Access only via privileged reason + audit trail (complaint, fraud, safety, legal, technical support).

---

## 17. Workspace Constructor Impact

The `Global Workspace Constructor Framework` (Step 3.3E) stays as ONE constructor.

Context awareness is added through:
- Page Registry: `constructorEnabled` per page per context
- Widget Registry: `contexts[]`, `entitlement`, `requiredCapabilities[]`
- Effective Layout Resolver: filters widgets by context + entitlement + capabilities + RBAC

No `BasicConstructor` / `ProConstructor` needed.

---

## 18. Persistence Key Analysis

Current persistence: `(userId, pageId)` — one active layout per user per page.

If multi-context supported:
- Same user may have Platform workspace AND Partner workspace
- Same `(userId, pageId)` would need context dimension

**Gap:** Current foundation assumes single context per user.

**Recommendation:** Until organization/context switching is implemented, current key is sufficient (user is in one context at a time). Future extension:

```text
(userId, contextId, pageId)
```

This is NOT a blocker for Platform Step 3.2.

---

## 19. Partner Employee RBAC (Gap)

Current RBAC supports platform-level roles (DIRECTOR, FINANCE, MODERATOR, etc.).

Partner employees need:
- Partner-scoped permissions (NOT platform-wide)
- Partner membership model
- Partner role/permission model

**This is a future prerequisite for Partner Workspace, NOT for Platform Step 3.2.**

---

## 20. Repository Gaps

| Gap | Exists? | Blocking Platform Step 3.2? | Blocking Partner Workspace? | Future Step |
|---|---|---|---|---|
| Workspace context model | Partial (contextType not in DB) | NO | YES (before partner UI) | 3.12E extension |
| Partner employee memberships | NO | NO | YES | 3.12A |
| Partner role/permission model | NO | NO | YES | 3.12A |
| Capability registry | NO | NO | YES (for capability widgets) | 3.29D |
| Sales channel dimension | Partial (acquisitionSource exists) | NO | NO (future enhancement) | 3.3D |
| Entitlement model | Partial (Storefront behavior exists) | NO | YES | 3.29D |
| Organization switcher | NO | NO | YES | Future |
| Context-aware Page/Widget Registry | Design only | NO | YES | Step 3.3E extension |
| Context-aware Role Defaults | NO | NO | YES | 3.12E |

---

## 21. Step 3.2 Decision

**Step 3.2 = Platform Command Center UI** — may proceed now.

Rationale:
- Step 3.1 backend (APPROVED) serves Platform Command Center data
- Step 3.3E workspace constructor (APPROVED) provides framework
- Step 3.3 analytics (APPROVED) provides foundation
- No gap blocks Platform Command Center UI
- Partner Command Center is deferred to later scope

---

## 22. Multi-Capability Partner

Partner can sell multiple product types simultaneously:
- Accommodation + Tours + Transfers

Therefore:
```text
BUSINESS TYPE = SINGLE ENUM
```
is too restrictive. Prefer:
```text
PARTNER CAPABILITIES = SET
```

Capability-specific widgets:
- Accommodation: Occupancy, ADR, Check-in/out
- Tours: Departures, Seats, Capacity
- Transfers: Vehicles, Drivers, Assignments

---

## 23. Marketplace + Storefront Simultaneously

One partner can simultaneously:
1. Sell through TravelHub Marketplace
2. Have own Storefront

These are two sales/acquisition channels, NOT two different customer identities.

Analytics must compare across channels.

---

## 24. Security Non-Negotiables

```text
PLATFORM DATA ≠ PARTNER DATA
```
```text
PARTNER A ≠ PARTNER B
```
```text
PARTNER CUSTOMER CONVERSATIONS ≠ PLATFORM INTERNAL INBOX
```
```text
USER LAYOUT CANNOT EXPAND AUTHORITY
```

---

## 25. Non-Goals (This Pass)

- Production backend changes: 0
- Production frontend changes: 0
- Schema changes: 0
- Migrations: 0
- New permissions: 0
- New roles: 0
- New capabilities: 0
- New widgets: 0
- Step 3.2 implementation: 0
- Partner Dashboard implementation: 0
- Employee Analytics implementation: 0
- Omnichannel implementation: 0
- Subscription billing implementation: 0
- Step 2.17B changes: 0

---

## 26. Acceptance Criteria

After this reconciliation, the architecture must clearly understand:

1. WHO uses the system → Platform Operator OR Partner Business
2. What BUSINESS CAPABILITIES are available
3. What ROLE / PERMISSION applies
4. How the USER configured their WORKSPACE (layout)

This sequence determines Dashboard, navigation, analytics, and available widgets. Not the reverse.

---

## 27. Repository Evidence

- `docs/architecture/global-workspace-constructor-phase3.md` — approved Step 3.3E foundation
- `backend/src/modules/workspace/workspace.types.ts` — Page Registry + Widget Registry
- `backend/src/modules/dashboard/dashboard.service.ts` — Step 3.1 Command Center orchestration
- `backend/src/modules/analytics/analytics.service.ts` — Step 3.3 Analytics Foundation
- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` — canonical Roadmap
- Prisma schema — `UserWorkspaceLayout`, `Partner`, `PartnerStorefront` entities
