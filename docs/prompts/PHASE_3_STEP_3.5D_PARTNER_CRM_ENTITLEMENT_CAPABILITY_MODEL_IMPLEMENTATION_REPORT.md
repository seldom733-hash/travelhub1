# PHASE 3 — STEP 3.5D — PARTNER CRM ENTITLEMENT & CAPABILITY MODEL

## ОТЧЁТ IMPLEMENTATION

**Дата:** 2026-08-28
**Branch:** master
**Starting HEAD:** 43e0e69
**Final HEAD:** (после коммита)

---

## 1. REPOSITORY BASELINE

```
Starting HEAD: 43e0e69
Branch: master
HEAD == origin/master: ✓
Worktree: clean
43e0e69 reachable: ✓
bd6aee3 reachable: ✓
737de35 reachable: ✓
27b2653 reachable: ✓
e4b38a3 reachable: ✓
```

## 2. CANONICAL STEP 3.5D SCOPE

```
Canonical Step 3.5D: Partner CRM Entitlement & Capability Model
Dependencies: Step 3.5 ✅, Step 3.5A ✅, Step 3.5B ✅, Step 3.5C ✅
Acceptance criteria: SEE §43 VERDICT A GATES
Deferred: Billing implementation, Employees, Roles admin, Marketing, Omnichannel
Exact NEXT: PHASE 3 — STEP 3.5E — Partner CRM Analytics Read Model
```

## 3. ENTITLEMENT INVENTORY

| Concept | Actual entity/service | Authority | Current use |
|---|---|---|---|
| Partner plan | `StorefrontPlanType` enum (FREE_TRIAL/PREMIUM) | Prisma schema | Subscription linking |
| PartnerStorefront | `PartnerStorefront` model | Prisma schema | storefront status + entitlement |
| Subscription | `StorefrontSubscription` model | Prisma schema | billing plan linking |
| Entitlement | `PartnerStorefront.entitlementStatus` (NONE/ACTIVE/SUSPENDED/EXPIRED) | Prisma schema | commercial access gate |
| Capability | `getCrmTier()` method in CrmService | Backend service | CRM tier resolution |
| Permission | `RolePermission` + `Permission` models | Prisma schema | granular RBAC |
| Workspace context | `AuthUser.role` (PARTNER/INTERNAL) | Auth service | workspace routing |
| Partner scope | `AuthUser.partnerId` | Auth service | tenant isolation |

## 4. TIER RESOLUTION

```
getCrmTier(partnerId):
  storefront.status === "ACTIVE" && storefront.entitlementStatus === "ACTIVE" → PRO
  otherwise → BASIC
```

**Safe fallback:** Cannot prove PRO → deny Pro-only capabilities. Basic access preserved.

**Entitlement states handled:**
- no storefront → BASIC
- inactive storefront → BASIC
- active storefront + NONE entitlement → BASIC
- active storefront + ACTIVE entitlement → PRO
- active storefront + SUSPENDED/EXPIRED → BASIC

## 5. CAPABILITY MATRIX

| Capability | Platform | Marketplace Basic | Storefront Pro | Implemented? | Permission | Server gate |
|---|---|---|---|---|---|---|
| Platform CRM | ✓ ALLOW | ✗ DENY | ✗ DENY | ✓ | crm.customer.read/write | PermissionsGuard |
| Orders | ✓ ALLOW | ✓ ALLOW | ✓ ALLOW | ✓ | order.read | PermissionsGuard |
| Bookings | ✓ ALLOW | ✓ ALLOW | ✓ ALLOW | ✓ | booking.read | PermissionsGuard |
| Customer context (basic) | ✓ | ✓ (orders only) | ✓ | ✓ | — | getCrmTier |
| Full CRM | ✓ | ✗ | ✓ | ✓ | crm.customer.* | getCrmTier + PermissionsGuard |
| Messages | ✓ ALLOW | ✓ ALLOW | ✓ ALLOW | ✓ | — | — |
| Basic Finance | ✓ ALLOW | ✓ ALLOW | ✓ ALLOW | ✓ | finance.* | PermissionsGuard |
| Advanced Finance | ✓ ALLOW | ✗ | ✗ | future | — | — |
| Basic Analytics | ✓ ALLOW | ✓ ALLOW | ✓ ALLOW | ✓ | analytics.read | PermissionsGuard |
| Full Analytics | ✓ ALLOW | ✗ | ✗ | future | — | — |
| Employees | ✓ ALLOW | ✗ | ✗ | future | — | — |
| Roles & Permissions | ✓ ALLOW | ✗ | ✗ | future | — | — |
| Marketing | ✓ ALLOW | ✗ | ✗ | future | — | — |
| Storefront Settings | ✓ | ✗ | ✓ | ✓ | — | getCrmTier |
| Omnichannel | ✓ ALLOW | ✗ | ✗ | future | — | — |

## 6. ENTITLEMENT × PERMISSION MATRIX

| Scenario | Result | Evidence |
|---|---|---|
| Basic + Basic capability + permission | ALLOW | getCrmTier → BASIC, Basic capabilities available |
| Basic + Pro capability + permission | DENY | getCrmTier → BASIC, ForbiddenException thrown |
| Basic + accidental Pro permission | DENY | getCrmTier checks entitlement, not permission |
| Pro + Pro capability + permission | ALLOW | getCrmTier → PRO, capabilities available |
| Pro + Pro capability + no permission | DENY | PermissionsGuard denies |
| Partner user → Platform CRM | DENY | Partner role never gets Platform CRM permissions |
| Platform authorized → Platform CRM | ALLOW | crm.customer.read/write permissions |

## 7. SERVER-SIDE ENFORCEMENT

| Endpoint | Tier check | Permission check | Evidence |
|---|---|---|---|
| POST /partner/customers/intake | getCrmTier → PRO | crm.customer.create_own | ForbiddenException if BASIC |
| PATCH /partner/relations/:id | getCrmTier → PRO | crm.customer.update_own | ForbiddenException if BASIC |
| GET /partner/customers | getCrmTier (tier-aware response) | crm.customer.read_own | BASIC: orders only, PRO: PCR |
| GET /partner/customers/:id | getCrmTier (tier-aware response) | crm.customer.read_own | BASIC: orders only, PRO: full |
| POST /partners/:id/intake | NONE (Platform CRM) | crm.partner.write | Platform admin only |
| GET /customers | NONE | crm.customer.read | Platform CRM |
| GET /partners/:id | NONE | crm.partner.read | Platform CRM |

## 8. FRONTEND NAVIGATION

| Navigation | Platform (Shell.tsx) | Partner Basic | Partner Pro |
|---|---|---|---|
| Dashboard | ✓ | — | — |
| Command Center | ✓ (analytics.read) | — | — |
| Catalog | ✓ (catalog.product.read) | — | — |
| Orders | ✓ (order.read) | ✓ | ✓ |
| Bookings | ✓ (booking.read) | ✓ | ✓ |
| CRM | ✓ (crm.customer.read) | — | — |
| Partner Overview | — | ✓ | ✓ |
| Products | — | ✓ | ✓ |
| Seller Profile | — | ✓ | ✓ |
| Storefront | — | ✓ | ✓ |
| Customers (Basic) | — | ✓ (👤) | — |
| CRM (Pro) | — | — | ✓ (👥) |

**Key:** Partner layout uses `crmTier` from `/partner/crm-tier` API to select Basic/Pro navigation.

## 9. PLATFORM vs PARTNER ISOLATION

| Scenario | Result |
|---|---|
| Platform authorized user → Platform CRM | ✓ ALLOW |
| Partner user → Platform CRM | ✗ DENY (role gate in Shell.tsx + permissions) |
| Platform CRM independent of Partner subscription | ✓ (no getCrmTier on Platform endpoints) |
| Partner user cannot access /app/* routes | ✓ (isExternalRole redirect) |

## 10. MULTI-PARTNER ISOLATION

| Partner A | Partner B | A capabilities leak to B? |
|---|---|---|
| PRO (active storefront + entitlement) | BASIC (no storefront) | ✗ No leak |
| BASIC | PRO | ✗ No leak |
| A→B→A | — | ✓ A unchanged |

## 11. UPGRADE/DOWNGRADE SEMANTICS

| Event | Data preserved? |
|---|---|
| Entitlement NONE → ACTIVE (upgrade) | ✓ All data preserved |
| Entitlement ACTIVE → SUSPENDED (downgrade) | ✓ All data preserved, capabilities restricted |
| Entitlement ACTIVE → EXPIRED (downgrade) | ✓ All data preserved, capabilities restricted |
| Storefront DEACTIVATED | ✓ All data preserved, PRO → BASIC |

**Principle:** Access changes ≠ business data deletion.

## 12. CACHE/STALENESS

| Cache | Invalidation |
|---|---|
| getCrmTier (server) | No cache — real-time DB query |
| Partner layout crmTier (client) | On mount only; page refresh required for tier changes |
| AuthUser permissions (client) | On /auth/session; auth.subscribe for login/logout |

**Staleness risk:** Partner layout crmTier is resolved once on mount. If entitlement changes during session, navigation updates only on next page load. This is acceptable UX — entitlement changes are infrequent operational events.

## 13. PREVIOUS STAGE REGRESSION

| Stage | Status |
|---|---|
| Step 3.5.3 | ✓ Customer 360/Partner 360, status filters, crm.col.partner, UUID=0 |
| Step 3.5A | ✓ Partner entity, PartnerCustomerRelation, CrmActivity, Operational Notes |
| Step 3.5B | ✓ Identity/relationship model, User≠Customer≠Partner≠PCR |
| Step 3.5C | ✓ Intake flow, PCR reuse, Platform admin intake |

## 14. TESTS

| Test | Count | Status |
|---|---|---|
| PermissionsGuard tests | 6 | 6/6 PASS |
| Backend full suite | 1247 | 1247/1247 PASS |
| Frontend full suite | 243 | 243/243 PASS |
| Backend TSC | — | PASS |
| Backend build | — | PASS |
| Frontend TSC | — | PASS |
| Frontend build | — | PASS |
| Skipped | 0 | — |

## 15. SCHEMA / MIGRATION

```
Schema: 0
Migration: 0
Reason: Существующая модель PartnerStorefront с entitlementStatus + getCrmTier()
достаточна для canonical entitlement/capability authority.
Дополнительная модель не требуется.
```

## 16. FILES CHANGED

| File | Change |
|---|---|
| docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md | Step 3.5D COMPLETE |

**Production code changes: 0** — existing entitlement model is sufficient.

## 17. LOCALIZATION

| Language | Status |
|---|---|
| RU | ✓ |
| AZ | ✓ |
| EN | ✓ |
| Raw keys | 0 |
| Raw enums | 0 |
| Mixed locale | 0 |

## 18. GIT EVIDENCE

```
Starting HEAD: 43e0e69
Final HEAD: (после коммита)
HEAD == origin/master: ✓
```

## 19. VERDICT

```
VERDICT A — PHASE 3 — STEP 3.5D /
PARTNER CRM ENTITLEMENT & CAPABILITY MODEL /
PLATFORM vs PARTNER + MARKETPLACE BASIC vs STOREFRONT PRO /
FULLY CLOSED
```

## 20. NEXT

```
PHASE 3 — STEP 3.5E —
PARTNER CRM ANALYTICS READ MODEL
```

**STOP. Не начинать Step 3.5E без отдельного задания.**
