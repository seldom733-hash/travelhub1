# PHASE 3 — PARTNER WORKSPACE
## SHARED SIDEBAR ARCHITECTURE / CURRENT-STATE / ROADMAP RECONCILIATION V2
## PLATFORM SIDEBAR REUSE FOR PARTNER CONTEXT — MARKETPLACE BASIC + STOREFRONT PRO
## DOCUMENTATION / ARCHITECTURE GATE BEFORE IMPLEMENTATION

---

# 1. ЦЕЛЬ

Зафиксировать следующий архитектурный шаг для Partner Workspace.

Canonical intent:

```text
не создавать новую sidebar architecture для партнёра

а переиспользовать уже существующую
Platform Workspace Sidebar Architecture
```

с другим business context:

```text
PLATFORM
vs
PARTNER
```

и разными entitlement sets:

```text
PARTNER
├── MARKETPLACE BASIC
└── STOREFRONT PRO
```

---

# 2. CORE INVARIANT

```text
SHARED WORKSPACE SIDEBAR FRAMEWORK
≠
SHARED BUSINESS CONTENT
```

То есть:

```text
layout
sidebar behavior
section grouping
active state
collapse behavior
responsive behavior
breadcrumbs
permission-aware rendering
workspace context rendering
```

могут быть общими,

но:

```text
routes
modules
KPIs
cards
analytics
finance semantics
CRM scope
actions
```

зависят от workspace context и entitlement.

---

# 3. НЕ СОЗДАВАТЬ ВТОРУЮ SIDEBAR SYSTEM

Forbidden:

```text
PlatformSidebar
PartnerSidebar
```

как две независимые архитектуры с дублированной логикой,

если current code позволяет reuse existing framework.

Preferred:

```text
Shared WorkspaceShell / Sidebar
+
context-specific navigation manifest
+
capability resolver
+
permissions
+
workspace scope
```

---

# 4. CURRENT STATE

Current Partner Cabinet uses horizontal navigation:

```text
Обзор
Мои услуги
Новая услуга
Идентичность
Витрина
Клиенты / CRM
```

This model does not scale to Storefront Pro.

Current Platform Workspace already has a left sidebar architecture.

Goal:

```text
PARTNER Workspace
→ migrate from horizontal nav
→ shared left sidebar architecture
```

without copying Platform business modules blindly.

---

# 5. TARGET WORKSPACE MODEL

```text
SHARED WORKSPACE SHELL
│
├── PLATFORM
│   └── platform navigation manifest
│
└── PARTNER
    ├── MARKETPLACE BASIC
    │   └── limited partner navigation manifest
    │
    └── STOREFRONT PRO
        └── extended partner navigation manifest
```

---

# 6. AUTHORIZATION HIERARCHY

Use canonical hierarchy:

```text
IDENTITY
→ WORKSPACE CONTEXT
→ TENANT / PARTNER SCOPE
→ PLAN / ENTITLEMENTS
→ BUSINESS CAPABILITIES
→ ROLE / PERMISSIONS
→ PAGE / ACTION AVAILABILITY
```

Sidebar is only a consumer of this authority.

---

# 7. FIRST TASK — DISCOVER EXISTING SIDEBAR ARCHITECTURE

Before code changes inventory:

```text
Platform layout component
Sidebar component
Sidebar config/registry
navigation manifest
route registry
workspace context resolver
permission resolver
entitlement resolver
active route logic
breadcrumbs
responsive/collapse logic
mobile navigation
workspace switcher if present
```

Report exact files.

---

# 8. REUSE MATRIX

Required:

| Existing Platform capability | Reuse for Partner? | Reuse as-is? | Partner adaptation | Notes |
|---|---|---|---|---|
| Workspace shell | | | | |
| Sidebar container | | | | |
| Section groups | | | | |
| Nav item component | | | | |
| Permission gating | | | | |
| Active route state | | | | |
| Breadcrumbs | | | | |
| Collapse behavior | | | | |
| Responsive behavior | | | | |
| Workspace label | | | | |

---

# 9. PLATFORM NAVIGATION MUST NOT REGRESS

Do not change Platform menu structure unless required for shared abstraction.

Platform workspace must preserve its current:

```text
routes
permissions
section grouping
active states
responsive behavior
```

---

# 10. MARKETPLACE BASIC TARGET

Marketplace Basic uses the same sidebar framework but a limited manifest.

Conceptual target:

```text
Обзор

ПРОДАЖИ
  Заказы
  Бронирования

КЛИЕНТЫ
  Клиенты
  Сообщения — only if already canonical/implemented

БИЗНЕС
  Мои услуги

ФИНАНСЫ
  Базовые финансы — only if already implemented

НАСТРОЙКИ
  Идентичность
  Витрина / подключение Storefront — according to canonical semantics
```

This is conceptual only.

Do NOT expose unavailable modules.

---

# 11. STOREFRONT PRO TARGET

Storefront Pro uses the same sidebar framework with richer capability manifest.

Conceptual target:

```text
Command Center
Аналитика

ПРОДАЖИ
  Заказы
  Бронирования

КЛИЕНТЫ
  CRM
  Сообщения

БИЗНЕС
  Услуги
  Витрина
  Маркетинг — only when implemented/canonical

ФИНАНСЫ
  Финансы
  Выплаты — only after correct finance/settlement capabilities exist

УПРАВЛЕНИЕ
  Сотрудники
  Настройки
```

Do NOT show future modules as fake/empty pages.

---

# 12. CRITICAL — SAME FRAMEWORK, DIFFERENT MANIFEST

Required concept:

```text
Platform Sidebar
Partner Basic Sidebar
Partner Pro Sidebar
```

must not become three copied navigation arrays.

Preferred:

```text
shared nav item definitions
+
contextual capability manifest
+
permission checks
```

---

# 13. MARKETPLACE BASIC ≠ STOREFRONT PRO

Hard UX invariant:

```text
Basic sidebar
≠
Pro sidebar
```

Difference must reflect entitlement.

Basic must not merely receive hidden/disabled Pro items.

If capability is not entitled:

```text
item should generally not appear
```

unless product design intentionally uses upgrade affordance.

---

# 14. UPGRADE AFFORDANCE

If Basic may upgrade to Storefront Pro:

```text
Storefront / Upgrade
```

may appear as an acquisition/onboarding entry.

But distinguish:

```text
upgrade entry
≠
active Pro module
```

No false Pro state.

---

# 15. STORE­FRONT PRO ≠ PLATFORM COPY

Do NOT copy Platform business cards/routes.

Example:

```text
Platform Command Center
→ whole TravelHub

Storefront Pro Command Center
→ own partner business only
```

Same framework, different business scope.

---

# 16. COMMAND CENTER REUSE

If/when Partner Command Center is implemented:

Reuse:

```text
page shell
sections
KPI card component
chart patterns
date range
comparison
decision queue patterns
```

But partner metrics must be:

```text
partner-scoped
channel-aware
entitlement-aware
```

Do NOT copy Platform KPI semantics.

---

# 17. ANALYTICS REUSE

Storefront Pro may reuse Analytics framework.

Potential partner analytics:

```text
Sales
Customers
Products / Services
Channels
Conversion
Finance
Marketing attribution
```

Only where architecture/roadmap already supports it.

Marketplace Basic gets only Basic Analytics if canonical.

---

# 18. CRM REUSE

Already reconciled:

```text
MARKETPLACE BASIC
→ simple customer management

STOREFRONT PRO
→ full CRM
```

Sidebar must expose this difference cleanly.

---

# 19. ORDERS / BOOKINGS

Partner menu items must use partner-scoped routes/data.

Do not route partner to Platform-wide lists.

Server authority:

```text
actor.partnerId
workspace
permissions
entitlements
```

---

# 20. FINANCE BOUNDARY

Do not expose fake advanced finance.

Preserve:

```text
Customer Payment
≠
Supplier Settlement
≠
Supplier Payout
```

Future supplier finance comes from:

```text
S.1–S.19
```

Until then:

```text
no fake "Баланс"
no fake "Выплаты"
no fake settlement cards
```

unless current implementation already has a canonical limited finance capability.

---

# 21. EMPLOYEES / MARKETING / OMNICHANNEL

These are Storefront Pro roadmap capabilities.

Do not expose them in sidebar before runtime capability exists.

Sidebar must be capability-aware, not roadmap-aware only.

---

# 22. CURRENT PARTNER ROUTES

Inventory:

```text
/partner
/partner/products
/partner/products/new
/partner/seller-profile
/partner/storefront
/partner/customers
/app/crm
```

and all other current partner-facing routes.

Determine migration strategy into shared shell without breaking deep links.

---

# 23. ROUTE COMPATIBILITY

Preferred:

```text
existing routes keep working
shared shell wraps them
```

Avoid unnecessary route churn.

If redirect required:

```text
preserve bookmarks/deep links
```

---

# 24. "НОВАЯ УСЛУГА"

Current Partner nav has:

```text
Мои услуги
Новая услуга
```

In left sidebar, consider whether:

```text
Новая услуга
```

should remain a full nav item or become primary action inside `Мои услуги`.

Do NOT change without UX evidence.

Report recommendation separately.

---

# 25. WORKSPACE LABEL

Current:

```text
Кабинет партнёра
```

was fixed to static label.

In shared shell, use a workspace label compatible with Platform pattern.

Potential context display:

```text
TravelHub
Marketplace Basic
```

or:

```text
TravelHub
Storefront Pro
```

Do not derive from display name.

Use canonical resolved tier/context.

---

# 26. SIDEBAR HEADER

Determine whether Partner sidebar header should show:

```text
Partner name
workspace tier
workspace/company identity
```

according to existing Platform shell conventions.

Do not expose unnecessary PII.

---

# 27. ACTIVE STATE

Current route must highlight the correct item.

Examples:

```text
/partner/products → Мои услуги
/partner/customers → Клиенты
/app/crm under Pro partner context → CRM
```

No multiple unrelated active items.

---

# 28. BREADCRUMBS

Reuse Platform breadcrumb architecture where applicable.

Examples:

```text
CRM > Клиенты > Иван Петров
Услуги > Редактирование
Заказы > TH-00123
```

Do not create a second breadcrumb system.

---

# 29. COLLAPSE BEHAVIOR

If Platform sidebar supports collapse:

```text
Partner sidebar should reuse same behavior
```

unless current UX explicitly differs.

Persist user layout according to existing workspace layout rules.

---

# 30. RESPONSIVE BEHAVIOR

Reuse mobile/tablet sidebar/drawer behavior.

Do not keep old horizontal partner nav in parallel on mobile unless required by the shared architecture.

---

# 31. NO DUPLICATE NAVIGATION

After migration:

```text
left sidebar
```

should be the primary navigation.

Do not keep the old horizontal navigation simultaneously unless a temporary migration phase is explicitly documented.

---

# 32. ENTITLEMENT-DRIVEN RENDERING

Examples:

```text
Basic:
canViewCustomers = true
canUseFullCrm = false

Pro:
canViewCustomers = true
canUseFullCrm = true
```

Sidebar items should derive from capabilities.

Do not scatter:

```text
if tier === 'PRO'
```

across many components if a capability layer exists.

---

# 33. PERMISSION-DRIVEN RENDERING

Entitlement alone is not enough.

Final visibility:

```text
capability granted
AND role permission granted
```

where role permissions exist for that surface.

---

# 34. SERVER AUTHORITY

Hidden nav item does not replace backend denial.

Direct URL/API must remain protected.

---

# 35. BASIC → PRO UPGRADE

After upgrade:

```text
shared shell remains
additional modules appear
current valid data remains
no customer/order/service loss
```

No workspace replacement.

---

# 36. PRO → BASIC DOWNGRADE

After downgrade:

```text
shared shell remains
Pro-only modules disappear
server denies Pro-only routes/actions
historical data remains
Basic-safe modules remain
```

---

# 37. CHANNEL-AWARE PARTNER CONTEXT

A Pro partner may operate:

```text
Marketplace
+
Storefront
```

Sidebar should represent one partner business workspace, not split into unrelated apps unless architecture requires channel switch.

Future pages may use channel filters inside:

```text
Marketplace
Storefront
All channels
```

Do not solve this by duplicating navigation.

---


# 37A. STOREFRONT CHANNEL NAVIGATION / TRAFFIC PROTECTION

Storefront Pro provides the partner with a direct branded sales channel for the partner's own customers.

Therefore distinguish strictly between:

```text
PARTNER ADMIN WORKSPACE
vs
PUBLIC PARTNER STOREFRONT
```

Hard commercial invariant:

```text
Partner-admin navigation freedom
≠
Storefront-customer traffic routing
```

## Partner Admin Workspace

An authenticated Storefront Pro partner may have utility links to:

```text
Открыть мою витрину ↗
Открыть TravelHub Marketplace ↗
```

These are partner/operator tools.

They may be placed in an appropriate utility area of the shared sidebar/header rather than mixed with primary business modules.

Purpose:

```text
Own Storefront
→ preview/check own public direct-sales channel

TravelHub Marketplace
→ inspect public marketplace presence / marketplace environment
```

These links do NOT:

```text
change role
change workspace entitlement
change partner scope
change authorization
```

They are navigation only.

## Public Storefront

The partner's public Storefront is a direct branded customer channel.

By default it MUST NOT contain prominent navigation that intentionally sends the partner's customer to the general TravelHub Marketplace where competing suppliers/services are presented.

Avoid patterns such as:

```text
Public Partner Storefront
→ prominent "TravelHub Marketplace" CTA
→ competitor marketplace
```

unless a future explicit commercial/product policy requires it.

Commercial reason:

```text
Partner acquires/directs customer
→ customer enters partner Storefront
→ customer should remain in partner-branded sales funnel
→ partner retains direct-channel relationship
```

Do not create unnecessary traffic leakage from the partner's Storefront to competing marketplace supply.

## Platform Branding

If commercial/product policy requires:

```text
Powered by TravelHub
Trust / platform infrastructure indication
legal attribution
payment/platform disclosure
```

this may exist without becoming a prominent competitive-marketplace navigation CTA.

Brand attribution and marketplace traffic routing are separate concepts.

## Customer Account Navigation

Do not assume that a customer authenticated on a partner Storefront must be redirected to the general Marketplace.

Storefront customer flows should remain Storefront-scoped unless the customer explicitly enters another TravelHub context through a separately designed product flow.

## Channel Semantics

Preserve future analytics distinction:

```text
ALL CHANNELS
├── TRAVELHUB MARKETPLACE
└── PARTNER STOREFRONT
```

The Storefront is not merely a skin over the Marketplace.

It is a distinct partner-controlled/direct sales channel running on TravelHub infrastructure.

## Required Architecture Matrix

Document:

| Actor / Surface | Own Storefront link | TravelHub Marketplace link | Reason |
|---|---|---|---|
| Storefront Pro partner in admin workspace | ALLOW | ALLOW | Partner operational navigation |
| Marketplace Basic partner in admin workspace | According to entitlement/onboarding state | ALLOW if product policy supports it | Operational/upgrade context |
| Customer on public Partner Storefront | Native/current storefront | NO prominent marketplace diversion by default | Protect partner direct channel |
| Customer on TravelHub Marketplace | N/A | Native/current marketplace | Marketplace context |

## Future Policy

If TravelHub later introduces cross-marketplace discovery from Storefront, affiliate economics, upsell, fallback inventory, or explicit partner opt-in, treat that as a separate commercial capability/policy.

Do NOT silently introduce it as generic navigation.


# 38. COMMAND CENTER FUTURE SCOPE

Storefront Pro future Command Center may include partner-specific:

```text
sales
orders
bookings
customers
service performance
channel health
finance
availability
```

But do not implement these metrics in this reconciliation.

---

# 39. PLATFORM vs PARTNER BUSINESS SEMANTICS

Required matrix:

| Surface | PLATFORM meaning | PARTNER meaning |
|---|---|---|
| Command Center | | |
| Analytics | | |
| CRM | | |
| Orders | | |
| Bookings | | |
| Finance | | |
| Services | | |
| Marketing | | |

This prevents later copy/paste semantics.

---

# 40. CURRENT IMPLEMENTATION STATUS MATRIX

For each partner module classify:

```text
IMPLEMENTED
PARTIAL
PLANNED
NOT STARTED
OUT OF SCOPE
```

Required:

| Module | Basic | Pro | Runtime status | Sidebar now? | Future stage |
|---|---|---|---|---|---|
| Overview | | | | | |
| Services | | | | | |
| Customers | | | | | |
| CRM | | | | | |
| Orders | | | | | |
| Bookings | | | | | |
| Analytics | | | | | |
| Finance | | | | | |
| Messages | | | | | |
| Employees | | | | | |
| Marketing | | | | | |
| Storefront | | | | | |
| Settings | | | | | |

---

# 41. ROADMAP RECONCILIATION

Update canonical roadmap so future implementation does not treat Partner Cabinet as a permanently separate UX architecture.

Record:

```text
Partner Workspace
→ Shared Workspace Sidebar Framework
```

and:

```text
Marketplace Basic → limited manifest
Storefront Pro → extended manifest
```

---

# 42. CURRENT PARTNER CABINET STATUS

After this reconciliation, current horizontal Partner Cabinet should be classified as:

```text
LEGACY / CURRENT RUNTIME SHELL
```

and target:

```text
SHARED WORKSPACE SIDEBAR SHELL
```

Do not delete it in documentation before migration is implemented.

---

# 43. IMPLEMENTATION DECOMPOSITION

Propose future substeps, for example:

```text
PW.1 Shared Partner Workspace Shell integration
PW.2 Basic navigation manifest
PW.3 Pro navigation manifest
PW.4 Route migration / compatibility
PW.5 Permission + entitlement integration
PW.6 Browser/runtime closure
```

Exact numbering must reconcile with canonical roadmap.

Do NOT start implementation in this prompt unless explicitly authorized later.

---

# 44. DOCUMENTATION-ONLY MODE

This prompt is:

```text
ARCHITECTURE / CURRENT STATE / ROADMAP RECONCILIATION
```

Therefore:

```text
Production code changed = NO
DB schema changed = NO
Runtime changed = NO
```

Only:

```text
architecture docs
roadmap
reconciliation report
```

---

# 45. REQUIRED ARCHITECTURE DOCUMENT

Create or update canonical Partner Workspace architecture.

Preferred example:

```text
docs/architecture/partner-workspace-shared-sidebar-architecture.md
```

Use existing naming conventions.

Do not create duplicate doc if equivalent canonical doc already exists.

---

# 46. ARCHITECTURE INDEX

Update architecture README/index if project uses one.

---

# 47. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_PARTNER_WORKSPACE_SHARED_SIDEBAR_ARCHITECTURE_RECONCILIATION_REPORT.md
```

---

# 48. REQUIRED REPORT — CURRENT vs TARGET

| Area | Current | Target | Reuse |
|---|---|---|---|
| Partner shell | Horizontal nav | Shared left sidebar | |
| Basic menu | | | |
| Pro menu | | | |
| Active state | | | |
| Breadcrumbs | | | |
| Collapse | | | |
| Responsive | | | |

---

# 49. REQUIRED REPORT — SIDEBAR MANIFESTS

Provide actual recommended manifests based on current implemented capability only.

## Marketplace Basic

```text
...
```

## Storefront Pro

```text
...
```

Clearly mark future/non-runtime items as:

```text
NOT SHOWN YET
```

---

# 50. REQUIRED REPORT — SHARED COMPONENTS

| Component/Pattern | Existing Platform file | Reused? | Partner adaptation |
|---|---|---|---|

---

# 51. HARD ACCEPTANCE CRITERIA

VERDICT A only if:

1. Existing Platform sidebar architecture fully inventoried.
2. Existing Partner shell fully inventoried.
3. Shared-shell reuse path identified.
4. No second independent sidebar architecture proposed.
5. Platform navigation semantics preserved.
6. Marketplace Basic manifest defined.
7. Storefront Pro manifest defined.
8. Basic and Pro manifests differ by entitlement.
9. Future unavailable modules are not proposed as visible now.
10. Current Partner routes inventoried.
11. Route compatibility strategy defined.
12. Active-state reuse defined.
13. Breadcrumb reuse defined.
14. Collapse reuse defined.
15. Responsive reuse defined.
16. Workspace label/tier display authority defined.
17. Entitlement-driven nav rendering defined.
18. Permission-driven nav rendering defined.
19. Server-side authorization remains required.
20. Basic → Pro upgrade behavior defined.
21. Pro → Basic downgrade behavior defined.
22. Marketplace + Storefront dual-channel behavior defined conceptually.
23. Command Center framework reuse distinguished from KPI semantics.
24. Analytics framework reuse distinguished from metric semantics.
25. CRM Basic vs Pro distinction preserved.
26. Finance boundary preserved.
27. Partner-admin vs public-Storefront navigation is explicitly separated.
28. Storefront Pro admin may navigate to own Storefront.
29. Storefront Pro admin may navigate to TravelHub Marketplace without changing authorization context.
30. Public Storefront does not receive a prominent competitor-marketplace diversion by default.
31. Platform branding/Powered by TravelHub is separated from Marketplace traffic routing.
32. Storefront is documented as a distinct direct sales channel, not merely a Marketplace skin.
33. Marketplace vs Storefront channel semantics are preserved for future analytics.
34. Any future cross-marketplace discovery from Storefront requires explicit product/commercial policy.
35. S.1–S.19 remain NOT STARTED.
36. F.1–F.13 remain NOT STARTED.
37. Employees/Marketing/Omnichannel not falsely exposed.
38. Current vs target Partner shell documented.
39. Roadmap updated.
40. Architecture index updated if applicable.
41. Implementation decomposition proposed.
42. Production code changed = NO.
43. DB schema changed = NO.
44. Runtime changed = NO.
45. Unrelated files committed = 0.
46. Push complete.
47. HEAD == origin/master.

---

# 52. VERDICT

Success:

```text
VERDICT A — PARTNER WORKSPACE SHARED SIDEBAR ARCHITECTURE /
PLATFORM SIDEBAR FRAMEWORK REUSE FOR MARKETPLACE BASIC + STOREFRONT PRO
FULLY RECONCILED — READY FOR IMPLEMENTATION
```

Failure:

```text
VERDICT B — PARTNER WORKSPACE SIDEBAR ARCHITECTURE RECONCILIATION INCOMPLETE
```

---

# 53. FINAL RESPONSE FORMAT

```text
VERDICT:

Existing Platform sidebar:
Existing Partner shell:

Shared components:
Workspace shell:
Sidebar:
Nav manifest:
Permissions:
Entitlements:
Active state:
Breadcrumbs:
Collapse:
Responsive:

Marketplace Basic manifest:
Storefront Pro manifest:

Current routes:
Route migration strategy:

Basic → Pro upgrade:
Pro → Basic downgrade:
Marketplace + Storefront dual-channel:
Partner admin → Own Storefront:
Partner admin → TravelHub Marketplace:
Public Storefront → Marketplace policy:
Platform branding / Powered by TravelHub policy:
Storefront traffic-protection invariant:

Platform Command Center reuse:
Partner Command Center semantics:
Platform Analytics reuse:
Partner Analytics semantics:
CRM:
Finance boundary:

Current runtime modules:
Future modules not shown:

Architecture files:
Roadmap:
Implementation decomposition:

Production code changed:
DB schema changed:
Runtime changed:

Commit:
HEAD:
origin/master:
HEAD == origin/master:
Unrelated files:

Remaining findings:
First authorized implementation substep:
```

---

# 54. STOP

After report:

```text
STOP
```

Do NOT automatically start implementation.

Do NOT start:

```text
PW.*
Step 3.5D
Platform CRM Partner 360
F.1–F.13
S.1–S.19
```

Wait for review.
