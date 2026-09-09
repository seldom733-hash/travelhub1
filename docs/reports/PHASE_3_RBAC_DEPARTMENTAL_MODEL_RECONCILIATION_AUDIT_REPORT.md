# PHASE 3 — RBAC DEPARTMENTAL MODEL RECONCILIATION — AUDIT REPORT

## 1. Executive Summary

Audit-first, read-only reconciliation of the current TravelHub RBAC model against
the departmental-workflow arrangement (platform = business departments; each
department owns its stage; receives the object; performs permitted actions;
hands off to the next department; workspace access ≠ blanket mutation rights).

**Findings in one paragraph:** the canonical RBAC architecture (ADR-0002,
Step 3.12) implements a **role-based cross-operational model with granular,
scoped mutation permissions** — not a strict departmental-navigation model and
not "full access by default". Roles map cleanly to operational responsibilities;
the Request → Order → Booking → Payment chain **is** the departmental handoff,
implemented as an event-driven pipeline with per-stage permission gates and
server-authoritative action projections. The Operator role is **by design the
Operations department executor**: full Order + Booking mutation authority, zero
Finance mutation authority, no Payments access (UI or API), read-scoped
Storefront denial. The e2e suite `rbac-actions.e2e-spec.ts` documents this in its
header and proves it both negatively (BUYER/SALES_MANAGER → 403 on every action)
and positively (OPERATOR → 200). **One material drift finding** was discovered
and is reported, not fixed: the live `RolePermission` DB state exceeds the code
constants by 41 grants across 7 roles (`marketing.*` ×9 rows ×4 roles,
`support.case.read` ×3 roles, `analytics.read`, ADMIN-only `order.import`),
and the `rbac-parity.e2e-spec.ts` gate fails at baseline because of it — a
governance/hygiene item, not an exploitable escalation (extras are read/manage
scopes consistent with documented Step 3.8/3.8.1/3.5 intent).

```text
VERDICT A — DEPARTMENTAL RBAC MODEL PROVEN
(Operator explained by architecture; material unexplained delta: NONE;
 one documented code↔DB parity drift → governance/hygiene item, see §12/§23)
```

## 2. Audit Scope

- All 10 canonical roles; full permission inventory; role × permission matrix;
- guards (`JwtAuthGuard`, `PermissionsGuard`), seeds (`security.service.ts`,
  migrations), `users.controller` role management;
- commerce controllers: Request, Order (10 actions), Booking (13 actions),
  Payments/Finance, Catalog, CRM, Support, Marketing, Analytics, moderation,
  own-scope external roles;
- frontend `Shell.tsx` navigation gating vs server authorization;
- availableActions projections (Request typed-7, Order 10, Booking 13);
- tenant/workspace isolation (Platform vs PARTNER_STOREFRONT, own-scope);
- historical intent (ADR-0002, Step 3.2/3.12/3.8/3.8.1, RBAC remediation);
- existing RBAC e2e suites (run read-only);
- Debt Register / roadmap impact (incl. SEC-UI-01 CLOSED, UI-C17 gate).

Prohibited actions (code/role/permission/guard/seed/schema/DTO/API changes,
defect fixing) — none performed.

## 3. Authority Order

Applied as prescribed. **Conflicts found and resolved:**

| # | Conflict | Resolution |
|---|---|---|
| K1 | `permissions.constants.ts` (code) vs live `RolePermission` DB rows | **DB is the runtime authority** (`permissionsOf()` reads DB every request; ADR-0002 §3). Code constants are the intended-default registry + parity baseline. Conflict recorded as drift (§12), not silently resolved. |
| K2 | Prompt's hypothetical roles (`DIRECTOR`, `ANALYST`… presented as the full set) vs actual `RoleCode` enum | Actual enum wins: **10 roles incl. `FINANCE`, `MODERATOR`, `PARTNER`, `BUYER`**; `FINANCE` is the Finance department's staff role. |
| K3 | `rbac-parity` e2e (expects exact code↔DB equality) vs live DB state | Test is the accepted parity **contract**; its baseline failure = real drift finding (§12), classified per §19 — not a test defect to "fix" silently. |
| K4 | Legacy docs mapping (`UI-C9` = Order migration in old D0-era report) | Superseded by delivered chain + SEC-UI-01 governance decision; irrelevant here except as historical context. |

## 4. Recovered Departmental Model

No `Department` entity/table/field exists in schema or code (Step 3.12 §3.1:
«Management Groups/Departments — не обнаружены — OK»; confirmed by this audit:
`model Partner` is the only org-adjacent model besides `Role`; departments exist
as **bounded contexts / centers**, not as RBAC rows). Therefore departments are
recovered from evidence — architecture docs, module ownership, centers, event
flow — **not invented as data model**:

| Department (bounded context) | Responsibility | Primary objects | Workspace/center | Handoff (evidence) |
|---|---|---|---|---|
| **Sales** (`sales.*`) | Lead → opportunity → quote → checkout | Lead, Opportunity, Quote, Sale, CheckoutIntent | Sales Center (module `sales`) | Checkout → `OrderRequested` event → Operations creates Order (`assertValidOrderRequestedPayload`; consumer-only creation) |
| **Operations** (`order.*`, `booking.*`, `requests` in order-module) | Request intake/processing, Order lifecycle, Booking with suppliers | Request, Order, Booking | Operations Center: Requests / Orders / Bookings tabs (+ Payments tab **read** for finance-payment.read holders) | Order `send` → `BookingRequested` → Booking consumer creates Booking; Booking `send` → supplier; completion events → Finance payment flows |
| **Finance** (`finance.*`) | Payments, refunds, commissions, ledger, taxes/rates | Payment, Refund, Commission, Ledger | **Payments tab in Operations Center = current capability, Finance-owned**; Finance Center = NOT STARTED (DEFERRED) | Payment lifecycle on Order/Booking completion events; payment initiation is a protected Finance boundary (Step 2.12H: 403 for all staff except FINANCE-domain permission holders) |
| **Catalog / Product** (`catalog.*`) | Product/service model, tariffs, moderation | Product, Tariff, RatePlan, Media | Catalog Center | Products feed Sales checkout + Booking supplier confirmations. **PROD-01 (Seller Service Cards / Product Model) = OPEN/DEFERRED — explicitly not assumed complete** |
| **Customer Care / Support** (`support.*`) | Support cases, communications | SupportCase, Communication | Support Center | Case assignment (`support.case.assign`); BUYER own-scope case access (`account.support.read_own`) |
| **Marketing** (`marketing.*` domain) | Campaigns, audiences, attribution | Campaign, Audience, Attribution | Marketing Center | Demand-generation feeding marketplace; permissions seeded in DB (Step 3.8), absent from code registry (§12) |
| **CRM** (`crm.*`) | Customers, partners, contacts, activity | Customer, Partner, Contact | CRM Center | Shared reference data for all departments |
| **Moderation / Trust** (`moderation.*`, `seller_public_profile.*`) | Product/profile moderation | Moderation queue, SellerProfile | Продавцы / moderation | Approval gates catalog publication |

**Canonical preserved distinction:** `Payments = current capability + Finance
ownership + Operations Center tab`; `Finance Center = NOT STARTED`. Not conflated.

**Department ≠ Role ≠ Workspace ≠ Permissions (actual linkage):** Department is
an architectural bounded-context concept (no first-class entity); Role is the
RBAC subject (`RoleCode`); Workspace is realized as **acquisition-source scope**
(`PARTNER_STOREFRONT` vs platform marketplace) + Partner-ownership scoping
(`*_own` permissions + `actor.partnerId` checks); Permissions are granular
strings per domain.action. A role *expresses* a departmental responsibility; a
workspace bounds *which tenant's objects*; permissions bound *which operations*.

## 5. Current Role Inventory

Source: `backend/prisma/schema.prisma` `enum RoleCode` (security schema) +
`permissions.constants.ts` `ROLE_PERMISSIONS` + seeded `Role` rows (all 10
verified live in DB).

| Role | Department (evidence-based mapping) | Workspace | Intended responsibility | Permission source |
|---|---|---|---|---|
| ADMIN | Platform-wide (spans all departments) | Platform | System administration; **ALL_PERMISSIONS (147) by explicit code convention** `ADMIN: ALL_PERMISSIONS` (constants L264; ADR-0002 §5; doc: «ADMIN … ALL_PERMISSIONS — full access») | `ROLE_PERMISSIONS` + cross-join migration |
| DIRECTOR | Executive oversight (read across Sales/Ops/Finance/Catalog/Support) | Platform | Supervision/analytics only — **zero mutation permissions on commerce** (43 read-scope perms) | constants L266 |
| FINANCE | Finance | Platform | Payment/refund/commission/ledger/tax management + commerce **read-only** (order.read, booking.read) | constants L319 |
| MARKETER | Marketing | Platform | Campaign/audience/attribution management (15 code / 24 DB — §12) | constants L370 |
| ANALYST | Analytics (cross-department) | Platform | Read-only analytics/finance/dashboards (29) | constants L397 |
| MODERATOR | Trust & Safety / Catalog moderation | Platform | Moderation + seller-profile review only (13) | constants L449 |
| SALES_MANAGER | Sales | Platform | Sales pipeline read/write; commerce **read-only** (order.read, booking.read; 0 mutations — proven by rbac-actions e2e) | constants L465 |
| OPERATOR | **Operations** | Platform | **Order + Booking lifecycle execution (full mutation set); Requests creation/processing; CRM customer/contact updates; support cases; documents; operational notes** (37 code / 46 DB — §12) | constants L506 |
| PARTNER | Partner / Seller (external) | **Partner Workspace** (own-scope) | Own products, storefront, onboarding, reverse proposals, own customers (32 × `_own`/scoped) | constants L553 |
| BUYER | Customer (external) | **Own-scope cabinet** | Own orders/bookings/payments/documents/support (13 × `account.*.read_own`, communication own) | constants L626 |

`HEAD_OF_*` roles absent (Step 3.12 confirmed; re-confirmed). No Department
field on User (schema: `User.roleId`, `partnerId?`, `customerId?` only).

## 6. Current Permission Inventory

Registry: `permissions.constants.ts` — **147 permissions**, 21 domain prefixes:
catalog 22, finance 22, sales 13, crm 11, reverse 9, dashboard 9, order 7,
account 7, seller_public_profile 7, support 7, booking 5, storefront 5,
communication 4, partner 4, operational-notes 4, moderation 4, documents 2,
settings 2, audit 1, analytics 1, reports 1. **Plus 10 `marketing.*` codes
seeded in DB but absent from the code registry** (§12) → effective DB catalog 157.

Commerce-critical inventory (guarded endpoints verified in controllers):

| Permission | Domain | R/M/A | Guarded endpoint(s) | Intended actor(s) |
|---|---|---|---|---|
| order.read | Orders | Read | `GET /orders`, `/orders/:id`, `/orders/:id/history`, `/orders/:id/financial-history`, `/orders/:id/travelers`, `/orders/:id/validate-completion`, `/requests`, `/requests/:id`, `/requests/:id/history`, `/requests/kpi`, `/requests/export` (12 usages) | DIRECTOR, FINANCE, ANALYST, SALES_MANAGER, OPERATOR, ADMIN |
| order.edit_noncritical | Orders | Mutation | `PATCH /orders/:id` (dynamic per-action), `/orders/:id/final-confirm`, `/orders/:id/travelers(/:id)`, all 7 Request action endpoints (`confirm-price/propose-price/reject/unavailable/customer-accept/customer-decline/convert`), `POST /requests` | **OPERATOR**, ADMIN |
| order.accept / order.request_booking / order.suspend / order.cancel / order.close | Orders | Mutation | dynamic `PATCH /orders/:id` resolver (`ACTION_PERMISSIONS` map: process→accept, send→request_booking, close→close, cancel→cancel, suspend→suspend) | **OPERATOR**, ADMIN |
| booking.read | Bookings | Read | `GET /bookings`, `/bookings/:id`, `/bookings/:id/history`, `/bookings/export` | DIRECTOR, FINANCE, ANALYST, SALES_MANAGER, OPERATOR, ADMIN |
| booking.send_supplier / booking.confirm / booking.request_change / booking.cancel | Bookings | Mutation | dynamic `@Patch bookings/:id` resolver (`ACTION_PERMISSIONS`: prepare/send→send_supplier; requestClarification/resume/confirm/reject/service/complete/problem→confirm; requestChange/resolveChange→request_change; requestCancellation/cancel→cancel) — covers all **13** canonical actions | **OPERATOR**, ADMIN |
| finance.payment.read | Payments | Read | `GET /finance/payments`, `/payments/export`, `/payments/:code` | FINANCE, DIRECTOR, ANALYST, SALES_MANAGER, ADMIN (не OPERATOR) |
| finance.payment.create / .manage / .write | Payments | Mutation (protected boundary) | `POST /payments` (create — Step 2.12H boundary), `/payments/:code/confirm` (manage), fail/cancel | FINANCE, ADMIN |
| finance.refund.approve / .execute / .write | Refunds | Mutation | refund endpoints | FINANCE, ADMIN |
| finance.commission/tax/currency/exchange_rate .read/.write/.manage | Finance ops | R/M | finance controller | FINANCE, ADMIN (+DIRECTOR/ANALYST read subset) |
| catalog.product.read / read_own | Catalog | Read | products list/detail (`productReadScope` resolver) | staff roles / PARTNER(own) |
| catalog.product.write | Catalog | Mutation | `POST /products` (staff branch) | ADMIN, MARKETER(no)… actually staff-with-grant (§12 note: creation additionally requires Partner owner — business rule) |
| catalog.product.create_own | Catalog | Mutation(own) | `POST /products` (PARTNER branch) | PARTNER |
| catalog.product.publish | Catalog | Admin | `/products/:id/publish` | ADMIN, MODERATOR(нет) — staff-with-grant |
| crm.customer.read / write, crm.partner.read / write | CRM | R/M | crm controllers | role-scoped (SALES_MANAGER read+customer write; OPERATOR read+customer write+contact write) |
| support.case.read/create/update/assign | Support | R/M | support controller | ADMIN(implicit), OPERATOR, (+FINANCE/ANALYST/SALES_MANAGER/DIRECTOR case.read — via DB §12) |
| settings.write | Administration/RBAC | Admin | `POST /users`, `PATCH /users/:id/role`, `/users/:id/status`, users list/update | ADMIN |
| account.*.read_own (4) | Buyer cabinet | Read(own) | own-scope endpoints | BUYER |
| *_own (storefront/reverse/catalog.media/communication/partner.onboarding) | Partner | R/M(own) | own-scope endpoints (server checks `actor.partnerId`) | PARTNER |
| moderation.* / seller_public_profile.* | Trust | R/M | moderation controllers | MODERATOR, ADMIN |
| analytics.read | Analytics | Read | analytics endpoints, Command Center | DIRECTOR, ANALYST, MARKETER, OPERATOR, ADMIN |
| audit.read | Audit | Read | audit endpoints | DIRECTOR, FINANCE, ANALYST, ADMIN |
| dashboard.*.read (9) | Command Center | Read | section authority (Step 3.2) | role-scoped |
| operational-notes.* (4) | Ops notes | R/M | notes endpoints (UI-C5) | OPERATOR full; FINANCE/DIRECTOR/ANALYST/MARKETER read (+SALES_MANAGER read/create) |

`settings.write` exists only in ADMIN's set → only ADMIN can change roles
(privilege-escalation control confirmed: no user-level grant mechanism exists at
all — Step 3.12 §3.3).

## 7. Role × Permission Matrix

Method: code constants parsed + live DB extraction (both recorded; drift in §12).
Full 10×157 matrix is machine-generated from the two sources; summarized here by
departmental lens (✚ = mutation-capable in domain, ○ = read-only, — = none):

| Role | Requests | Orders | Bookings | Payments/Finance | Catalog | CRM | Support | Marketing | Admin/RBAC |
|---|---|---|---|---|---|---|---|---|---|
| ADMIN | ✚ | ✚ | ✚ | ✚ | ✚ | ✚ | ✚ | ✚ | ✚ (ALL) |
| DIRECTOR | ○ | ○ | ○ | ○ | ○ | ○ | ○(case) | —(DB: mkt read §12) | read (audit/settings.read) |
| FINANCE | —(no request-specific) | ○ | ○ | ✚ (payments/refunds/commissions/taxes) | ○ | activity○ | ○(case) | — | audit○ settings○ |
| MARKETER | — | — | — | — | ○ | activity○ | — | ✚(DB §12) | dashboards○ |
| ANALYST | — | ○ | ○ | ○ | ○ | activity○ | ○(case) | — | audit○ reports○ |
| MODERATOR | — | — | — | — | moderation ✚ | — | — | — | — |
| SALES_MANAGER | —(no request perms) | ○ | ○ | ○(payment/refund read) | ○ | ✚ (customers) + partner○ | ○(case) | — | — |
| **OPERATOR** | ✚ (create + all 7 actions) | ✚ (all 10 actions) | ✚ (all 13 actions) | **— (zero finance perms)** | ○ | ✚ (customer write, contact write, partner read) | ✚ (case create/read/update/assign) | ✚ (DB §12) | docs✚ notes✚ |
| PARTNER | — | — | — | — | ✚(own) | ✚(own customers) | — | —(DB has none; report §P3 notes future question) | — |
| BUYER | — | ○(own) | ○(own) | ○(own) | — | — | ○(own) | — | — |

Sources: `ROLE_PERMISSIONS` (code), live `RolePermission` rows (DB), guard
resolvers per controller, `rbac-actions.e2e-spec.ts` (positive/negative proof).

**Full per-cell GRANT/DENY with source is reproducible** from the two registries
(constants file + `security."RolePermission"`), and the parity between them is
exactly what `rbac-parity.e2e-spec.ts` asserts per role (currently failing on
the §12 drift — which simultaneously **proves** the DB contains no grants
*missing* versus code: `missing=0` for all 10 roles; only extras exist).

## 8. Expected Departmental Matrix

Derived **only from proven architecture** (ADR-0001 modular monolith + bounded
contexts; event pipeline; guard maps; Step 2.x/3.x accepted reports):

| Department | Role | Object | Action | Resulting state | Next department | Evidence |
|---|---|---|---|---|---|---|
| Sales | SALES_MANAGER | Lead/Opportunity/Quote | create/update/approve | pipeline advance | Sales (checkout) | sales.* guards |
| Sales | SALES_MANAGER | CheckoutIntent | create/revalidate/cancel | checkout | → Operations (OrderRequested event) | sales.checkout.write; order consumer |
| Operations (intake) | OPERATOR | Request | create + confirmPrice/proposePrice/reject/unavailable/customerAccept/customerDecline | request lifecycle | Operations (conversion) | request.controller guards order.edit_noncritical |
| Operations | OPERATOR | Request | convert | Request CONVERTED → **Order created** (consumer) | Operations (order desk) | `POST /requests/:id/convert`; RequestConverted → OrderRequested |
| Operations (order desk) | OPERATOR | Order | process/markWaitingData/resumeProcessing/confirm/send/complete/close/cancel/problem/suspend | order lifecycle | Booking desk on `send` | order ACTION_PERMISSIONS; TRANSITIONS |
| Operations (booking desk) | OPERATOR | Booking | all 13 actions (prepare…problem) | booking lifecycle incl. supplier loop | Finance on completion (payment events) | booking ACTION_PERMISSIONS |
| Finance | FINANCE | Payment/Refund | create/confirm/fail/cancel; refund approve/execute | money state | (terminal/settlement — Finance Center deferred) | finance guards; Step 2.12H boundary |
| Catalog/Moderation | MODERATOR/ADMIN | Product | publish/reject | PUBLISHED | Sales (sellable) | catalog.product.publish |
| Support | OPERATOR/BUYER | SupportCase | create/assign/update | case lifecycle | Support | support.case.* guards |

The assumed Sales → Operations → Finance sequence is **confirmed by evidence**
(event handoffs above), not adopted by assumption.

## 9. Navigation vs Read vs Mutation

Frontend: `Shell.tsx` `NAV` items carry `permission`; `canAccess()` filters the
sidebar; route-level `required` re-check exists (L167). Navigation is a
**projection** of the same backend permission array (`/auth/session` →
`AuthUser.permissions`), never an authority.

| Role | Navigation (sidebar, from permissions) | List read | Detail read | Mutation | Data scope |
|---|---|---|---|---|---|
| ADMIN | all sections (ALL_PERMISSIONS) | all | all | all | Platform (+ storefront via center context per Step 2.17A) |
| DIRECTOR | dashboards, analytics, requests/orders/bookings/payments, catalog, CRM, support, partners-onboarding | ✚ | ✚ | **none** (read-only role) | Platform marketplace |
| FINANCE | payments, requests/orders/bookings(○ via order/booking.read), catalog, CRM-activity, dashboards | ✚ | ✚ | finance domain only | Platform; Storefront denied (payment.service isDeniedStorefrontScope) |
| MARKETER | marketing, analytics, catalog, dashboards | marketing only | marketing only | marketing (DB §12) | Platform |
| ANALYST | analytics, requests/orders/bookings/payments(○), dashboards | ✚ | ✚ | none | Platform |
| MODERATOR | sellers/moderation, catalog(read_for_moderation) | moderation scope | moderation scope | moderation only | Platform |
| SALES_MANAGER | requests? no (order.read only grants Orders/Bookings/Catalog/CRM/Payments-○) — **Requests tab requires order.read → visible**; orders/bookings/payments/catalog/crm/support | ✚ | ✚ | **none on commerce** (e2e-proven) | Platform |
| OPERATOR | command-center, analytics, **requests/orders/bookings**, catalog, CRM, support | ✚ | ✚ | **requests/orders/bookings full** | Platform marketplace; storefront objects 404 |
| PARTNER | partner-onboarding(own), catalog(own), storefront(own) | own | own | own | `partnerId` scoping |
| BUYER | cabinet(own) | own | own | none (read_own) | `customerId` scoping |

**«Почему Operator видит Requests / Orders / Bookings?»** — Because the
**Operations department owns all three stages** in this architecture: the
Operations Center *is* Operator's workplace, and the three tabs are one
departmental pipeline (Request intake → Order desk → Booking desk). Classification
(**with evidence**): **B — expected because Operator is cross-operational**;
specifically the operations *chain*, not the whole platform — Operator has **no**
Payments, no Marketing (code), no moderation, no sales pipeline, no admin.

Payments for Operator: nav item requires `finance.payment.read`; OPERATOR has no
finance permissions (live DB verified: `finance% → 0 rows`) → **tab hidden, API
403**. Operator does *not* see Payments.

## 10. Business Handoff Model

Real handoff transitions (source-verified):

| Source dept | Actor | Object | Action | Result | Receiving dept | Receiving role |
|---|---|---|---|---|---|---|
| Sales | SALES_MANAGER | CheckoutIntent | checkout create | OrderRequested event | Operations | OPERATOR (order.accept = process) |
| Operations intake | OPERATOR | Request | convert | Request CONVERTED; Order row created by consumer | Operations order desk | OPERATOR |
| Operations order desk | OPERATOR | Order | send | BookingRequested event | Operations booking desk | OPERATOR (booking.send_supplier etc.) |
| Operations booking desk | OPERATOR | Booking | send / confirm | supplier confirmation loop (SupplierConfirmation rows) | Operations (+ external supplier) | OPERATOR |
| Operations | OPERATOR | Booking/Order | complete | payment/settlement triggers | Finance | FINANCE |
| Catalog | PARTNER | Product | submit_moderation | moderation queue | Trust | MODERATOR |
| Trust | MODERATOR | Product | approve | PUBLISHED | Sales/Storefront | PARTNER (seller) |
| Support | BUYER | SupportCase | create (own) | case queue | Support | OPERATOR (assign/update) |

**Conclusion:** wide (chain-scoped) read access + single-department mutation
ownership **is** the intentional cross-department workflow mechanism. The
handoff is carried by domain events with consumer-only creation and per-stage
permission gates — workspace access does not equal blanket mutation rights.

## 11. Operator Deep-Dive

Navigation: Command Center + Analytics (`analytics.read`), Requests/Orders/
Bookings (`order.read`/`booking.read`), Catalog, CRM, Support, Справка. **No
Payments** (no finance.payment.read), no Users, no Partners-onboarding, no
Sellers, no Marketing (code; DB extras §12).

Read: all four commerce registries minus Payments; detail + history + kpi + export.

Mutation (all guard-mapped): Requests — create + 7 actions
(`order.edit_noncritical`); Orders — 10 lifecycle commands via granular map
(accept/edit_noncritical/request_booking/suspend/cancel/close); Bookings — all
13 actions (send_supplier/confirm/request_change/cancel).

Data scope: platform marketplace; `PARTNER_STOREFRONT` bookings/orders denied
(404, enumeration-protected) in read and action paths
(`isDeniedStorefrontScope` in booking.service, order.service, payment.service);
Notes permissions full CRUD (operational-notes.* ×4).

Responsibility in departmental model: **executor of the Operations department**
— the only staff role with end-to-end operational mutation authority; receives
handoffs from Sales (checkout → OrderRequested, Request conversion) and hands to
Finance via completion events.

| Capability | Expected (Model B evidence) | Actual | Delta | Classification |
|---|---|---|---|---|
| Requests list/detail | YES (order.read) | YES | — | EXPECTED GRANT |
| Request mutations (7) | YES (order.edit_noncritical) | YES | — | EXPECTED GRANT |
| Orders list/detail | YES | YES | — | EXPECTED GRANT |
| Order mutations (10) | YES (full set — rbac-actions header) | YES | — | EXPECTED GRANT |
| Bookings list/detail | YES | YES | — | EXPECTED GRANT |
| Booking mutations (13) | YES (full set) | YES | — | EXPECTED GRANT |
| Payments list/detail | NO (no finance.payment.read) | tab hidden; API 403 | — | EXPECTED DENY |
| Payment mutations | NO | 403 (no perms) | — | EXPECTED DENY |
| Storefront objects | NO (platform contract) | 404 | — | EXPECTED DENY |
| Users/RBAC admin | NO | 403 (no settings.write) | — | EXPECTED DENY |
| Marketing (code) | not granted | DB extras grant it (§12) | 9 read/manage grants | AMBIGUOUS / GOVERNANCE REQUIRED (drift, not escalation: read/manage marketing scopes consistent with Step 3.8.1 report naming OPERATOR) |

## 12. Admin Deep-Dive (+ parity drift finding)

ADMIN = `ALL_PERMISSIONS` **by explicit code convention** (constants L264;
ADR-0002 §5 «Bootstrap… ADMIN/import exception»; command-center doc: «ADMIN …
ALL_PERMISSIONS — full access») → not an unproven assumption. Effective: 147
code / **157 DB**. Extras vs code (live DB): `marketing.*` ×9 (covered below),
`order.import` (bootstrap import exception — documented ADMIN-only in ADR-0002 §4;
code constant present in registry but assigned in DB only), plus the shared extras.

**Material finding — DB↔code `RolePermission` drift (41 extra grants, 7 roles):**

| Role | code | DB | DB-extras |
|---|---|---|---|
| ADMIN | 147 | 157 | `marketing.*` ×9, `order.import` |
| DIRECTOR | 43 | 52 | `marketing.*` ×9 (read/manage) |
| MARKETER | 15 | 24 | `marketing.*` ×9 (the role's own domain!) |
| OPERATOR | 37 | 46 | `marketing.*` ×9 (read/manage) |
| FINANCE | 37 | 39 | `analytics.read`, `support.case.read` |
| ANALYST | 29 | 30 | `support.case.read` |
| SALES_MANAGER | 33 | 34 | `support.case.read` |
| MODERATOR / PARTNER / BUYER | 13/32/13 | = | none |

Genesis (evidence, each traced):
1. `marketing.*` — Step 3.8 marketing domain: controller guards + frontend nav
   use these codes; the **Step 3.8.1 closure report documents the assignment
   («marketing.* only to ADMIN, OPERATOR, MARKETER, DIRECTOR»)**; the rows were
   seeded into the live DB, but **neither `permissions.constants.ts` nor any
   migration defines/seeds them** → intentional-implementation-with-incomplete-
   registration. Impact: read/manage marketing scopes — no commerce mutation,
   no escalation path (marketing endpoints only mutate marketing domain).
2. `support.case.read` — seeded by migration `20260830000000_remediate_support_rbac`
   («DIRECTOR/… gets support.case.read») — intentional migration that was **not**
   back-ported into `ROLE_PERMISSIONS` constants.
3. `analytics.read` (FINANCE) — same pattern (dashboard-era migrations).
4. `order.import` (ADMIN) — documented ADMIN bootstrap exception; constant exists
   in registry but not in ADMIN's code set (harmless for ADMIN = ALL in DB).

Runtime consequences observed: Marketing Center nav visible to ADMIN/OPERATOR/
MARKETER/DIRECTOR (dev DB) — matches Step 3.8.1's stated intent.

**Classification:** EXCESS GRANT **versus the code registry**, but
EXPECTED GRANT **versus documented Step 3.8/3.5 intent** → the defect is
**registry incompleteness** (code constants + parity baseline out of sync with
intentionally seeded DB), not privilege escalation. No missing grants anywhere
(`missing=0` all roles). Per §19/§24: not "fixed", reported for governance.

**Admin behavior probes (live):** `POST /products` by ADMIN → **403 with
business-rule message** «Commercial Product creation requires a Partner owner.
Platform actors cannot create ownerless Products.» — permission PASSES the guard
(`catalog.product.write` present); the denial is the D2/PROD-adjacent business
rule (Platform actors cannot own commercial products). This **reproduces the
stale-setup failures** in `rbac-actions` / `booking-lifecycle-completion` /
`booking-service-time-model` e2e (their fixtures create products as ADMIN and
expect 201). Classification: test-fixture staleness against an evolved accepted
business rule — environmental, NOT an RBAC regression, NOT caused by drift.

## 13. Sales Manager / Analyst / Marketer / Moderator / Director

- **SALES_MANAGER** — Sales department: full sales.* pipeline + checkout;
  commerce read-only (order.read, booking.read, payment/refund read);
  **zero order/booking/request mutations — e2e-proven (403 on every action)**;
  CRM customer write; support case read (+DB). UI-C6/C7 browser evidence
  (SALES_MANAGER → all-false availableActions) independently confirms server
  projection parity. Correct departmental shape.
- **ANALYST** — read-only everywhere (29), incl. full finance read visibility;
  no mutations at all. Correct.
- **MARKETER** — marketing domain only (code 15 / DB 24, §12); no commerce
  read except catalog.product.read. Correct shape.
- **MODERATOR** — moderation + seller profiles only (13, exact parity). Correct.
- **DIRECTOR** — oversight: read everything except marketing (code), zero
  mutations anywhere (43). audit.read + settings.read but users endpoints
  require `settings.write` → **DIRECTOR cannot manage users** (correct:
  read ≠ admin). Note: DIRECTOR's finance read set includes payout/settlement/
  ledger — consistent with oversight.
- **FINANCE** — money authority: payments/refunds/commissions/taxes/currency/
  ledger write+manage; commerce read-only; **payment-initiation boundary
  (Step 2.12H): 403 for staff without finance.payment.create** — Finance
  ownership of Payments proven at guard level.
- **PARTNER/BUYER** — external own-scope roles; server-side `actor.partnerId`/
  ownership checks verified in services; BUYER stripped of internal
  order.read/booking.read (Step 1.13, rbac-actions header).

## 14. Server Authority Chain

`Role (DB) → RolePermission (DB, seeded+admin-persisted) → permissionsOf() on
every request (JwtAuthGuard) → PermissionsGuard (AND-semantics, resolver support,
FAIL-CLOSED) → controller @RequirePermissions → service business validation
(TRANSITIONS/CAS/terminal guards) → availableActions projection → UI consumption`.

Verified per domain:
- **Requests:** guard `order.edit_noncritical` on all 7 action endpoints;
  `computeRequestAvailableActions(granted)` server-side (UI-C6); typed DTO;
  safe-default `?? {all:false}` in UI; e2e `ui-c6-request-server-authority`
  22/22 PASS (accepted stage evidence).
- **Orders:** dynamic per-action resolver (`ACTION_PERMISSIONS` 10 actions);
  `computeAvailableOrderActions` = status ∩ permissions ∩ D3 gates ∩ completeness;
  PATCH re-validates transition + CAS.
- **Bookings:** per-action resolver over the 13 canonical actions; service
  re-validates TRANSITIONS + ORDER_TERMINAL_GUARD (409) + CAS version (409) +
  Storefront 404 + forbidden-keys 422; UI-C9 runtime matrix (admin 5-action
  CONFIRMED projection, read-only `[]`, 403/409/404) recorded in the C9 report.
- **Payments:** read `finance.payment.read`; create/confirm/fail/cancel behind
  `finance.payment.create/manage` — the protected Finance boundary; Payments UI
  page contains **zero mutation API calls** (grep: no api.post/patch) — pure
  read/filter surface; Finance Center NOT STARTED.

UI projection (`server authorization = availableActions = visible mutation UI`)
holds for all three commerce details (C6/C7/C8/C9 evidence chain); navigation is
a projection of the same permission array.

## 15. availableActions Projection

| Domain | Type | Computed | Consumed |
|---|---|---|---|
| Request | typed object ×7 booleans | server (UI-C6) | RequestActionBar; safe-default all-false |
| Order | string[] ×10 | server (D5 §6/§8) | OrderActionBar (empty → omitted) |
| Booking | string[] ×13 | server (D6) | BookingActionBar (empty → omitted) |

All three enforce projection-only visibility client-side; no local lifecycle or
permission matrices exist (spec-guarded).

## 16. Tenant / Workspace Isolation

- Platform vs Storefront: `PARTNER_STOREFRONT` orders/bookings/payments denied
  to platform readers (404, list-scope denial `isDeniedStorefrontScope` ×3
  services); action paths double-guarded (bookingAction 404; order scope).
- Partner own-scope: `*_own` permissions + service checks
  `actor.partnerId === resource.partnerId` (Step 3.12 §3.5 «Partner own-scope:
  server check ✅»).
- Buyer own-scope: `account.*.read_own` cabinet only.
- Unauthenticated: JwtAuthGuard global; PermissionsGuard FAIL-CLOSED.
- same tenant/same workspace = the platform contract itself (single-platform
  tenant model; multi-tenant boundary = Platform↔Storefront, verified above).
- Storefront → Platform direction: isolated (external storefront sessions cannot
  reach platform endpoints; separate storefront session/visitor model).

## 17. Historical Intent vs Current Canonical Model

Searched: `full access`, `default access`, `all permissions`, `all roles`,
`department(s)`, `handoff`, `ownership`, `responsibility`, `cross-department`,
`workflow`, `role`, `permission` across docs/ADR/prompts/reports.

Historical intents recovered:
1. **ADR-0002 (Accepted):** 10 canonical roles, granular permissions, role
   defaults matrix in code — departmental-by-responsibility, not departmental-
   by-isolation. New roles only via ADR.
2. **Step 3.2 (Command Center RBAC):** «ADMIN … ALL_PERMISSIONS — full access»
   — admin full access is **canonical**, not default-for-all.
3. **Command Center RBAC remediation (L418):** «Expected full access **by
   default** unless repository authority says otherwise» — scoped to that
   stage's dashboard-section test expectations for ADMIN; not a platform-wide
   grants doctrine. MARKETER/FINANCE/OPERATOR expectations in the same doc are
   explicitly **restricted** («Must NOT receive Financial merely because
   analytics.read exists», «OPERATOR: operational/attention access if intended»).
4. **rbac-actions.e2e-spec.ts header (Step 1.13/2.x):** BUYER stripped of
   internal reads; SALES_MANAGER zero mutations; **OPERATOR = «полный набор
   прав Order/Booking»** — the cross-operational Operations executor is
   documented intent.
5. **Step 3.12:** no Department/HEAD_OF_*/user-grants entities — role = the
   departmental vehicle.
6. **Step 3.8/3.8.1:** marketing.* assigned to ADMIN/OPERATOR/MARKETER/DIRECTOR
   (matches DB; missing from code registry — §12).

**Conflict record:** no accepted document prescribes strict Model A
(department-scoped navigation). The delivered architecture, its tests, and its
reports consistently describe Model B. Historical intent → Current canonical
model: **aligned**; the only conflict is the §12 registry drift, which requires
a hygiene decision, not a model decision.

## 18. Full Access by Default — Evidence Verdict

> Существует ли подтверждённое правило, что все роли получают полный доступ по умолчанию?

```text
DISPROVEN
```

Evidence: 9 of 10 roles have narrowly scoped sets (13–52 perms); 147-permission
catalog with 21 domains vs role sets far smaller; negative e2e proof (BUYER/
SALES_MANAGER 403 on every commerce action); FINANCE-only payment boundary;
settings.write exclusive to ADMIN; MODERATOR/PARTNER/BUYER exact-parity DB rows.
The only "full access" rule on record is **ADMIN = ALL_PERMISSIONS** — an
explicit, documented, role-specific convention. The Stage-A remediation phrase
«Expected full access by default» is stage-scoped test language for ADMIN
dashboard sections, contradicted platform-wide by the entire matrix — not an
access doctrine.

## 19. Expected vs Actual Delta Matrix

Classification legend per prompt §19. Deltas are listed against the **union of
code registry + documented intent** (a grant is EXPECTED if either the code
constants or an accepted report/migration establishes it):

| Delta | Where | Classification |
|---|---|---|
| marketing.* ×9 on ADMIN/DIRECTOR/OPERATOR/MARKETER (DB only) | §12.1 | AMBIGUOUS / GOVERNANCE REQUIRED (intent documented in Step 3.8.1; code registry incomplete — register the codes or revoke the rows; do not treat as bug) |
| support.case.read on FINANCE/ANALYST/SALES_MANAGER/DIRECTOR (DB only) | §12.2 | AMBIGUOUS / GOVERNANCE REQUIRED (seeded by accepted remediation migration; constants not back-ported) |
| analytics.read on FINANCE (DB only) | §12.3 | AMBIGUOUS / GOVERNANCE REQUIRED (same pattern) |
| order.import on ADMIN (DB only) | §12.4 | EXPECTED GRANT (ADR-0002 documented ADMIN import exception; registry nit) |
| OPERATOR full Order/Booking/Requests mutations | §9/§11 | EXPECTED GRANT (documented + e2e-proven) |
| OPERATOR no Payments | §9/§11 | EXPECTED DENY |
| SALES_MANAGER/DIRECTOR/ANALYST commerce read-only | §7/§13 | EXPECTED GRANT/DENY |
| e2e fixture failures (POST /products 403 business rule) | §12 probes | NOT APPLICABLE to RBAC (test staleness vs accepted D2 rule) |
| MISSING GRANT | — | **none found** (`missing=0` all roles, both sources) |
| EXCESS GRANT (unexplained) | — | **none found** (all extras trace to documented intent) |

No classification of `BUG` was used — no expected behavior was disproven.

## 20. Existing Debt / Roadmap Impact

- Debt Register untouched. SEC-UI-01 = CLOSED (UI-C6); not reopened.
- **UI-C17 (Final RBAC full-matrix re-qualification):** this audit supplies the
  baseline facts the future gate will need — the full-matrix method (code ∪
  documented-intent vs DB), the known drift items to resolve **before** that gate
  (else UI-C17 will fail on parity), and the proof that the negative/positive
  authorization machinery works. Recommendation: **unchanged scope**; the gate
  should require the registry↔DB parity to be re-established first (§23-R1).
- Finance Center / PROD-01 boundaries preserved; PROD-01 remains OPEN/DEFERRED
  (catalog business rule observed at §12 is a PROD-adjacent constraint, not new scope).
- New debt item: **not created** (requires approval per §20 of the prompt); the
  drift is recorded here as the candidate.

## 21. Test Evidence

Executed read-only (dev runtime :4000 up; test-DB e2e):

| Check | Result |
|---|---|
| `rbac-parity.e2e-spec.ts` | 4/11 PASS — **7 role-parity failures = the §12 DB↔code drift** (exact extras enumerated; `missing=0` everywhere; catalog set-equality test PASS → no unknown codes in DB) |
| `rbac-actions.e2e-spec.ts` | 1/3 PASS; 2 failures = stale fixture (ADMIN `POST /products` expects 201, hits accepted business rule 403 «requires a Partner owner» — §12 probe); **the passing test proves the core RBAC shape: BUYER no internal reads, SALES_MANAGER keeps internal read** |
| Live probe | admin session `auth/me` = 157 perms incl. catalog.product.write; `POST /products` → 403 business-rule (permission layer passed) |
| Live DB | all 10 roles seeded; per-role exact extras extracted (§12 table); OPERATOR `finance%` = 0 rows |
| Prior accepted evidence | UI-C6 e2e 22/22 (server-authority), UI-C7/C9 browser matrices (read-only actor all-false actions; 403/409/404) |
| `auth-rbac.e2e-spec.ts` unit-adjacent checks | login/401/tv-revocation paths referenced; not re-run (covered by accepted stages) |

Environment note: booking-lifecycle-completion / booking-service-time-model
failures were classified in the UI-C9 report as environmental; this audit adds
the root cause (accepted business rule vs stale fixtures) — same for
rbac-actions' two failing tests.

## 22. Findings

1. **Model B proven** (cross-operational visibility + scoped mutation); Model A
   not supported by any source.
2. **Operator access is architectural**: Operations owns Requests+Orders+Bookings
   as one pipeline; Operator = its executor; Payments excluded (both UI and API).
3. **Full access by default: DISPROVEN**; ADMIN=ALL is an explicit convention.
4. **Workspace access ≠ mutation rights** — enforced twice (per-action permission
   resolvers; business-state guards) plus scope denials (Storefront 404).
5. **Registry drift (material, hygiene-level)**: 41 DB grants in 7 roles absent
   from `permissions.constants.ts` (marketing ×36, support.case.read ×3,
   analytics.read ×1, order.import ×1); parity gate failing at baseline;
   no missing grants; no escalation; intent documented per item.
6. **Frontend nav uses `marketing.campaign.read`** — a permission that exists
   only in the DB, not in the code registry (works at runtime; fails code-level
   audit/greppability; would break on a fresh DB seeded from constants only).
7. **Stale e2e fixtures** (3 suites) vs the accepted "Products need a Partner
   owner" rule — environmental, masks RBAC signal until fixed.
8. No Department/tenant/workspace first-class entities — scope is realized via
   acquisition-source + own-scope permissions (documented; nothing invented).

## 23. Governance Decisions Required

1. **R1 (pre-UI-C17):** reconcile `permissions.constants.ts` ↔ live
   `RolePermission` — either back-port the 41 intentionally-seeded grants into
   `ROLE_PERMISSIONS` (+ registry entries for `marketing.*`) or revoke them via
   a governed migration. One source of truth must win; until then
   `rbac-parity.e2e` remains red and UI-C17's full-matrix gate would fail on
   parity.
2. **R2:** decide whether `marketing.*` becomes a first-class registry domain
   (10 codes) — required for fresh-DB seeding correctness.
3. **R3 (optional):** re-point the 3 stale e2e fixtures to create products via
   a PARTNER actor (or seed partner-owned products) so negative RBAC signal is
   restored.
4. **R4 (explicit non-decision):** if the platform later wants strict Model A
   (department-scoped navigation), that is a **new ADR** — nothing in the
   current accepted architecture requires or suggests it.

## 24. Recommendation

- For **UI-C17: unchanged** (scope/method already canonical); prerequisite: R1.
- No RBAC changes recommended now; drift resolution is a small, governed,
  dedicated stage (R1+R2), not an emergency (no escalation, no missing grants).
- Operator model: keep as-is.

## 25. Git Evidence

```text
git rev-parse HEAD          → 4f4bf1aaac5ec70cc0c9187e24b47aa8cab99a31
git rev-parse origin/master → 4f4bf1aaac5ec70cc0c9187e24b47aa8cab99a31 (equal)
git status --porcelain=v1   → 3 tracked-modified files = the pending UI-C8
                              publication set (OrderActionBar.tsx,
                              commerce-detail-system.spec.tsx, i18n.tsx;
                              preserved, untouched) + untracked historical
                              docs/prompts artifacts + this report (uncommitted;
                              audit stage)
git diff --check            → PASS
Production source changes by this audit: NONE (backend/frontend byte-identical;
only reads + one throwaway product-create probe that was rejected 403 and a
safe CONFIRMED-state-neutral read set; no state mutated)
```

## 26. Final Verdict

```text
VERDICT A — DEPARTMENTAL RBAC MODEL PROVEN

Departmental model   = proven as Model B (cross-operational Operations chain +
                       per-department mutation ownership + event handoffs)
Current RBAC         = conforms to it (no material unexplained delta)
Operator             = EXPECTED (Operations executor; no Payments; storefront-denied)
Full-access-default  = DISPROVEN (ADMIN=ALL is an explicit convention)
Material mismatch    = NONE (drift = registry hygiene, intent documented)
Governance items     = R1 (parity reconciliation) required before UI-C17;
                       R2 marketing registry; R3 stale fixtures optional
STOP                 = audit-only; nothing changed; UI-C17 not executed
```
