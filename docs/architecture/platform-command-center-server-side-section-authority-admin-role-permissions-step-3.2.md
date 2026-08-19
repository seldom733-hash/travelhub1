# PHASE 3 — STEP 3.2 — SERVER-SIDE SECTION AUTHORITY & ADMIN-MANAGED ROLE PERMISSIONS — ARCHITECTURE ADDENDUM

> **ЯЗЫК:** все ответы — на русском языке. Английский для кода, команд, статусов.

---

## 1. PURPOSE

This addendum resolves the critical security contradiction in Step 3.2 Design:

```
ROLE DEFAULT LAYOUT ≠ DATA AUTHORITY
FRONTEND-HIDDEN WIDGET ≠ SERVER-SIDE ACCESS DENIAL
```

The previous design used frontend-only widget hiding as a substitute for server-side authorization. This is architecturally unacceptable. This addendum defines the server-side section authority model that MUST be implemented before the Command Center UI.

**Supersedes:** conflicting sections in `platform-command-center-ui-design-ux-contract-step-3.2.md` and `platform-command-center-ui-design-remediation-addendum-step-3.2.md` where frontend-only hiding was presented as sufficient.

---

## 2. CRITICAL CONTRADICTION DISPOSITION

### 2.1 The Problem

Current Step 3.1 endpoints:

```
GET /api/v1/dashboard/command-center
GET /api/v1/dashboard/command-center/trends
```

Both require only `analytics.read`. Any user with this permission receives the FULL response including Executive, Operational, Financial, and Marketplace sections — regardless of what the frontend hides.

The previous remediation (commit `7986376`) proposed hiding Financial widgets from MARKETER via Role Default Layout. This is UX differentiation only — the MARKETER's API response still contains full Financial data.

### 2.2 The Rule

```
IF DATA MUST BE RESTRICTED BY ROLE,
THE SERVER MUST ENFORCE THE RESTRICTION.
```

Frontend hiding is presentation optimization, not security. Server-side filtering is mandatory.

### 2.3 Disposition

- **frontend-only hiding:** REJECTED as security mechanism
- **server-side section filtering:** REQUIRED before Command Center UI implementation
- **new section permissions:** Design-proposed, to be implemented in Stage A (security prerequisite)
- **existing `analytics.read`:** Retained as page-level gate, NOT sufficient for section data

---

## 3. PERMISSION GRANULARITY DECISION

### 3.1 Three-Level Permission Model

```
PAGE GATE (analytics.read)
+ SECTION/DATA AUTHORITY (dashboard.*.read)
+ ACTION AUTHORITY (dashboard.customize, etc.)
```

### 3.2 Proposed Permission Catalog

| Permission | Scope | Data Exposed | Default Roles | Admin-Overridable | Protected | Backend Enforcement | Frontend Use |
|---|---|---|---|---|---|---|---|
| `analytics.read` | Page gate | None directly (section auth required) | ADMIN, DIRECTOR, ANALYST, MARKETER | YES | NO | DashboardController guard | Nav item visibility |
| `dashboard.executive.read` | Section | GMV, Revenue, Net Revenue, Orders, Bookings, AOV, Conversion | ADMIN, DIRECTOR, ANALYST, MARKETER | YES | NO | DashboardService section filter | Executive section render |
| `dashboard.operational.read` | Section | Orders Fulfilled, Bookings Confirmed/Completed, Payments, Refunds, Funnel | ADMIN, DIRECTOR, ANALYST | YES | NO | DashboardService section filter | Operational section render |
| `dashboard.financial.read` | Section | Commission, Reconciliation, Total Payments, Net Payments | ADMIN, DIRECTOR, FINANCE, ANALYST | YES | NO | DashboardService section filter | Financial section render |
| `dashboard.marketplace.read` | Section | Sessions, Partners, Customers | ADMIN, DIRECTOR, ANALYST, MARKETER | YES | NO | DashboardService section filter | Marketplace section render |
| `dashboard.customize` | Action | Layout save/reset | ADMIN, DIRECTOR, ANALYST, MARKETER | YES | NO | WorkspaceService guard | Customize button |

### 3.3 Existing Domain Permission Reuse Check

| Candidate | Existing Permission | Semantics Match? | Decision |
|---|---|---|---|
| Financial section | `finance.payment.read` | Close but not identical — finance.* covers raw payment entities, not aggregated KPI | **NEW** `dashboard.financial.read` |
| Operational section | `order.read`, `booking.read` | Close but covers raw entities, not operational KPI aggregates | **NEW** `dashboard.operational.read` |
| Marketplace section | None existing | No match | **NEW** `dashboard.marketplace.read` |
| Executive section | None existing | No match | **NEW** `dashboard.executive.read` |

**Decision:** Create new `dashboard.*.read` permissions rather than misusing domain permissions. Domain permissions cover raw entity access; dashboard permissions cover aggregated KPI sections.

---

## 4. SAFE DEFAULT ROLE PERMISSIONS

### 4.1 Server Authority Matrix

| Role | `analytics.read` | `dashboard.executive.read` | `dashboard.operational.read` | `dashboard.financial.read` | `dashboard.marketplace.read` | `dashboard.customize` |
|---|---|---|---|---|---|---|
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DIRECTOR | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| FINANCE | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| MARKETER | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| ANALYST | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MODERATOR | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SALES_MANAGER | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| OPERATOR | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| PARTNER | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| BUYER | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 4.2 Default Role Descriptions

| Role | Business Responsibility | Command Center Access | Sections | Default Landing |
|---|---|---|---|---|
| ADMIN | System/security/operations | ✅ Full | All 4 | Command Center |
| DIRECTOR | Executive oversight | ✅ Full | All 4 | Command Center |
| ANALYST | Read-only analytics | ✅ Full | All 4 | Command Center |
| MARKETER | Acquisition/channels | ✅ Partial | Executive + Marketplace | Command Center |
| FINANCE | Revenue/payments | ❌ None | — | Finance Center (future) |
| MODERATOR | Content moderation | ❌ None | — | Moderation Center (future) |
| SALES_MANAGER | Sales pipeline | ❌ None | — | Sales Center (future) |
| OPERATOR | Operational workload | ❌ None | — | Order/Booking Center |

### 4.3 Key Design Decisions

**FINANCE lacks `analytics.read`:**
- FINANCE has rich `finance.*` permissions for the Finance Center
- The Command Center is a Platform Marketplace overview, not a Finance deep-dive
- FINANCE should see financial data through the Finance Center (future), not through Command Center
- Admin CAN override to grant FINANCE access if business need is proven

**MODERATOR/SALES_MANAGER/OPERATOR lack `analytics.read`:**
- These roles have their own domain work centers
- Command Center is not their primary workspace
- Admin CAN override to grant access if needed

**MARKETER has partial access:**
- Executive + Marketplace sections cover marketing-relevant KPIs
- Operational and Financial sections are not marketing-relevant
- Admin CAN override to grant additional sections

---

## 5. ADMIN OVERRIDE TARGET MODEL

### 5.1 Hierarchy

```
SYSTEM DEFAULT (code-defined in ROLE_PERMISSIONS)
→ AUDITED ADMIN OVERRIDE (future: DB-managed)
→ EFFECTIVE ROLE PERMISSIONS
```

### 5.2 Current State Analysis

| Concern | Current Code | Behavior |
|---|---|---|
| Permission storage | `security.Permission` table | Persisted, seeded |
| Role-permission assignment | `security.RolePermission` table | Persisted, seeded |
| Seed logic | `SecurityService.seedRoles()` on `onModuleInit` | Idempotent upsert of missing permissions |
| Seed overwrite? | Checks `existingCodes` before creating Permission rows | Does NOT delete/overwrite existing RolePermission rows |
| Admin UI | None | — |
| Audit log | `security.AuditLog` table exists | Not used for permission changes |
| Protected roles | None explicitly | ADMIN = ALL_PERMISSIONS (code convention) |
| Session refresh | Permissions loaded from DB per request via JwtAuthGuard | Real-time |

### 5.3 Critical Seed Behavior

```typescript
// From SecurityService.seedRoles():
const existing = await this.prisma.permission.findMany({ select: { code: true } });
const existingCodes = new Set(existing.map((p) => p.code));
const missing = ALL_PERMISSIONS.filter((c) => !existingCodes.has(c));
// Creates only missing Permission rows — does NOT touch RolePermission
```

**Key insight:** The seed only creates `Permission` catalog rows. It does NOT recreate `RolePermission` assignments. This means:
- Admin CAN modify `RolePermission` rows at runtime
- Seed will NOT overwrite Admin changes on restart
- **This is already safe for Admin override persistence**

### 5.4 Target Admin Capabilities

| Capability | Priority | Stage |
|---|---|---|
| View permission catalog | HIGH | C |
| View System Default vs Effective Policy | HIGH | C |
| Assign/revoke permissions to roles | HIGH | C |
| View affected users count | HIGH | C |
| Reset role to system defaults | HIGH | C |
| Audit trail for all changes | HIGH | C |
| Reason field for changes | MEDIUM | C |
| Confirmation for sensitive grants | MEDIUM | C |
| Recovery admin protection | HIGH | C |
| Concurrency conflict detection | MEDIUM | C |
| Platform context label | LOW | C |

### 5.5 Protected Boundaries

| Boundary | Rule |
|---|---|
| `admin.*` permissions | Non-delegable by Admin (self-escalation prevention) |
| Last recovery admin | Cannot revoke permissions from last ADMIN |
| Platform scope | Admin cannot grant Platform permissions to Partner context |
| System roles | ADMIN role cannot be deleted or have ALL_PERMISSIONS removed |
| Self-escalation | Admin cannot grant themselves permissions beyond their current scope |

### 5.6 Audit Fields

```typescript
interface PermissionAuditEntry {
  id: string;
  actorId: string;        // Admin who made the change
  targetRole: RoleCode;   // Role affected
  permission: string;     // Permission granted/revoked
  action: 'GRANT' | 'REVOKE' | 'RESET_TO_DEFAULT';
  before: boolean;        // Was permission present before
  after: boolean;         // Is permission present after
  reason?: string;        // Business justification
  createdAt: DateTime;
  correlationId?: string; // Case/ticket reference
}
```

---

## 6. PERSISTENCE AND SEEDING CONTRACT

### 6.1 Selected Approach: Option A (RolePermission as Effective State)

**Chosen:** RolePermission rows ARE the effective state. Seed creates missing Permission catalog rows only. Admin modifies RolePermission rows directly.

**Rationale:**
- Simplest model — no separate default/override tables
- Seed already does NOT overwrite RolePermission rows
- Admin changes persist across restarts naturally
- Audit via separate AuditLog entries

### 6.2 Bootstrap Contract

| Event | Behavior |
|---|---|
| Fresh deploy | Seed creates Permission rows + RolePermission defaults |
| Restart | Seed creates only missing Permission rows; existing RolePermission preserved |
| New permission added in code | Seed creates Permission row; no RolePermission auto-assigned |
| Admin override exists | Preserved across restart; seed does not touch |
| Reset to default | Admin deletes custom RolePermission rows; defaults re-seeded on next startup if missing |

### 6.3 Deploy/New Version Contract

When a new application version introduces new permissions:
1. `Permission` row created by seed (idempotent)
2. NO automatic `RolePermission` assignment for new permission
3. Admin must explicitly grant new permission to roles
4. If new permission has safe default: seed logic can be extended to create default RolePermission rows for specified roles (but only if no override exists)

**Future enhancement:** `ROLE_DEFAULT_PERMISSIONS` map separate from `ROLE_PERMISSIONS` (system defaults) + override tracking. Not needed for Stage A.

### 6.4 Migration Strategy

For Stage A (adding `dashboard.*.read` permissions):
1. Add new Permission codes to `PERMISSIONS` constant
2. Add new RolePermission default assignments to `ROLE_PERMISSIONS`
3. Seed creates Permission rows + RolePermission rows on next restart
4. Existing Admin overrides (none in v1) are preserved
5. No Prisma schema change needed (existing Permission/RolePermission models sufficient)
6. No migration needed — seed-based

---

## 7. SERVER-SIDE RESPONSE AUTHORITY

### 7.1 Selected Approach: Option A (Server-Filtered Response)

Single endpoint returns only authorized sections. Unauthorized sections are omitted entirely.

### 7.2 Response DTO Shape

```typescript
interface CommandCenterResponse {
  period: { start: string; endExclusive: string; timezone: string; preset: string };
  comparison?: { start: string; endExclusive: string };
  sections: {
    executive?: ExecutiveSection;    // Present only if dashboard.executive.read
    operational?: OperationalSection; // Present only if dashboard.operational.read
    financial?: FinancialSection;     // Present only if dashboard.financial.read
    marketplace?: MarketplaceSection; // Present only if dashboard.marketplace.read
  };
  availableSections: string[];       // Which sections the user can access
  attribution?: { actionFields: string[]; ownershipFields: string[]; outcomeFields: string[] };
}
```

### 7.3 Enforcement Layer

```
DashboardController
  → @RequirePermissions("analytics.read")  // page gate
  → DashboardService.getCommandCenter(dto, user)
    → Check user.permissions for each section:
      - dashboard.executive.read → include executive section
      - dashboard.operational.read → include operational section
      - dashboard.financial.read → include financial section
      - dashboard.marketplace.read → include marketplace section
    → Only call Step 3.3 read models for authorized sections
    → Return filtered response
```

### 7.4 Omission vs Forbidden

| Scenario | Response | HTTP Status |
|---|---|---|
| No `analytics.read` | — | 403 |
| `analytics.read` but no section permissions | `{ sections: {}, availableSections: [] }` | 200 |
| `analytics.read` + executive only | `{ sections: { executive: {...} }, availableSections: ["executive"] }` | 200 |
| Full access | All sections present | 200 |

**Decision:** Use omission (section absent from response) rather than explicit `forbidden` status. This avoids leaking section existence to unauthorized users.

### 7.5 Backward Compatibility

- Frontend must handle missing sections gracefully (not crash)
- `availableSections` array tells frontend what to render
- Old clients without section awareness: will see empty sections object (graceful degradation)
- New clients: use `availableSections` to determine layout

---

## 8. TRENDS ENDPOINT AUTHORITY

### 8.1 Metric → Section Mapping

| Metric | Section | Required Permission |
|---|---|---|
| `revenue` | executive | `dashboard.executive.read` |
| `gmv` | executive | `dashboard.executive.read` |
| `orders` | executive | `dashboard.executive.read` |
| `bookings` | executive | `dashboard.executive.read` |
| `ordersFulfilled` | operational | `dashboard.operational.read` |
| `bookingsConfirmed` | operational | `dashboard.operational.read` |
| `paymentsCaptured` | operational | `dashboard.operational.read` |
| `refundsProcessed` | operational | `dashboard.operational.read` |
| `commission` | financial | `dashboard.financial.read` |
| `payments` | financial | `dashboard.financial.read` |
| `sessions` | marketplace | `dashboard.marketplace.read` |
| `partners` | marketplace | `dashboard.marketplace.read` |
| `customers` | marketplace | `dashboard.marketplace.read` |

### 8.2 Enforcement

```
DashboardService.getTrends(dto, user, metric)
  → Resolve metric → section mapping
  → Check user.permissions for section permission
  → If unauthorized: return 403 (not 404 — metric exists but user lacks access)
  → If authorized: query Step 3.3 Time Series, return buckets
```

### 8.3 Allowed Metrics Response

The summary endpoint should also return `availableMetrics: string[]` so the frontend knows which trend buttons to show.

### 8.4 Metric Name Probing

- Unknown metric → 404 (metric doesn't exist)
- Known metric, unauthorized → 403 (metric exists, access denied)
- This avoids leaking metric existence through different error codes

---

## 9. WIDGET REGISTRY AUTHORITY

### 9.1 Updated WidgetDefinition Metadata

```typescript
interface WidgetDefinition {
  widgetId: string;
  pageIds: string[];
  type: WidgetType;
  category: string;
  title: string;
  // NEW: server-side section authority
  sectionPermission: string | null;  // e.g. "dashboard.executive.read"
  // Existing fields...
  permission: string;                // page-level permission (analytics.read)
  required: boolean;
  removable: boolean;
  // ... other fields unchanged
}
```

### 9.2 Widget → Section Permission Mapping

| Widget | sectionPermission |
|---|---|
| `gmv`, `revenue`, `net-revenue`, `orders`, `bookings`, `aov`, `conversion` | `dashboard.executive.read` |
| `funnel`, `orders-fulfilled`, `bookings-confirmed`, etc. | `dashboard.operational.read` |
| `commission`, `reconciliation`, `payments`, `net-payments` | `dashboard.financial.read` |
| `sessions`, `partners`, `customers` | `dashboard.marketplace.read` |
| `revenue-trend`, `orders-trend`, `bookings-trend` | (same as their source section) |

### 9.3 Resolution Rules

1. Widget catalog filtered by `analytics.read` (page gate) + `sectionPermission` (section gate)
2. Saved layout containing unauthorized widget → silently removed on next effective layout computation
3. Role Default Layout cannot include widgets from unauthorized sections
4. User Layout cannot include widgets from unauthorized sections
5. Required widget `reconciliation` applies ONLY within Financial section authority

---

## 10. RECONCILIATION REQUIRED RULE FIX

### 10.1 Previous Contradiction

```
MARKETER → reconciliation hidden (no financial section access)
reconciliation required for ALL roles with analytics.read
```

These two statements contradict. If reconciliation is required for all, MARKETER must see it. If MARKETER doesn't have financial authority, reconciliation is meaningless.

### 10.2 Corrected Rule

```
RECONCILIATION IS REQUIRED
ONLY WHEN FINANCIAL SECTION AUTHORITY IS PRESENT.
```

| Role | Financial Section Access | Reconciliation Status |
|---|---|---|
| ADMIN | ✅ | Required, non-removable |
| DIRECTOR | ✅ | Required, non-removable |
| FINANCE | ❌ (no analytics.read) | N/A — no Command Center access |
| MARKETER | ❌ | Not in widget catalog |
| ANALYST | ✅ | Required, non-removable |

---

## 11. EFFECTIVE ACCESS ALGORITHM

```
1.  Resolve authenticated identity (JWT → userId)
2.  Resolve PLATFORM context (always PLATFORM for /app/* routes)
3.  Resolve current role (User.roleId → Role.code)
4.  Load System Defaults (ROLE_PERMISSIONS seed map)
5.  Apply persisted Admin Overrides (RolePermission table)
6.  Produce Effective Role Permissions (set of permission codes)
7.  Authorize page (analytics.read → 403 if missing)
8.  Authorize sections (dashboard.*.read → omitted if missing)
9.  Filter summary response server-side (only authorized sections)
10. Build authorized widget catalog (sectionPermission + user permissions)
11. Resolve Role Default Layout (system → role defaults → user override)
12. Apply User Layout (saved positions, filtered by authorized catalog)
13. Remove unauthorized/retired widgets (permission or registry changed)
14. Restore required-authorized widgets (reconciliation if financial access)
```

### 11.1 Behavior Matrix

| Event | Behavior |
|---|---|
| Admin grants permission | Next request sees new section (permissions loaded from DB per request) |
| Admin revokes permission | Next request loses section (no stale cache) |
| Role changed | Next request uses new role's permissions |
| Active session open during revoke | Current request may complete; next request enforced |
| Layout contains revoked widget | Widget removed from effective layout on next load |
| Concurrent permission + layout change | Permission wins (backend validates) |
| Permission service failure | Fail-closed: section omitted |
| Seed/restart | Permission catalog recreated; RolePermission preserved |
| New permission introduced by deploy | Seed creates Permission row; no auto-assignment; Admin must grant |
| Override reset | Admin deletes custom RolePermission; defaults re-seeded if missing |

---

## 12. SESSION AND CACHE INVALIDATION

### 12.1 Backend Permission Loading

From `JwtAuthGuard` + `PermissionsGuard`:

```typescript
// Permissions loaded from DB on EVERY request
const user = await this.prisma.user.findUnique({
  where: { id: jwtPayload.sub },
  include: { role: { include: { permissions: { include: { permission: true } } } } },
});
```

**Confirmed:** Permissions are NOT cached across requests. Each request loads fresh from DB. Admin revocation takes effect on next request.

### 12.2 Frontend Permission Refresh

- `useCurrentUser()` calls `GET /auth/session` on mount
- Session endpoint returns current user + permissions
- Permissions are in-memory state (not localStorage)
- On logout/login: permissions refreshed
- On navigation: Shell checks permissions for nav items

### 12.3 Invalidation Scenarios

| Scenario | Backend | Frontend |
|---|---|---|
| Admin revokes permission | Next request: 403 for section | Next session load: updated permissions |
| Admin grants permission | Next request: section included | Next session load: updated permissions |
| User role changed | Next request: new role's permissions | Next session load: updated permissions |
| Logout | Session destroyed | auth.clear() → redirect |
| In-flight request after revoke | Current request completes with old permissions | — |
| Stale frontend nav item | — | Next useCurrentUser refresh corrects |

### 12.4 Query/Cache Key Dimensions

- Summary response: `(userId, preset, startDate, endDate, timezone, comparison, effectivePermissions)`
- Trends response: `(userId, metric, preset, startDate, endDate, granularity, effectivePermissions)`
- Layout: `(userId, pageId)`

---

## 13. IMPLEMENTATION STAGING

### Stage A — Security Prerequisite (MUST complete before UI)

| Change | Files | Description |
|---|---|---|
| New permission codes | `backend/src/security/permissions.constants.ts` | Add `dashboard.executive.read`, `dashboard.operational.read`, `dashboard.financial.read`, `dashboard.marketplace.read`, `dashboard.customize` |
| Default role assignments | `backend/src/security/permissions.constants.ts` | Add to `ROLE_PERMISSIONS` map |
| Section authority in DashboardService | `backend/src/modules/dashboard/dashboard.service.ts` | Filter sections by user permissions |
| Section authority in trends | `backend/src/modules/dashboard/dashboard.service.ts` | Filter metrics by section permission |
| Widget Registry metadata | `backend/src/modules/workspace/workspace.types.ts` | Add `sectionPermission` to WidgetDefinition |
| Effective layout section filtering | `backend/src/modules/workspace/workspace.service.ts` | Filter widgets by section permission |
| Tests | `backend/test/dashboard-command-center.e2e-spec.ts` | Section authority tests |
| Tests | `backend/src/modules/dashboard/dashboard.service.spec.ts` | Unit tests for section filtering |

**No Prisma migration needed** — Permission/RolePermission models already exist.

### Stage B — Platform Command Center UI

| Change | Files | Description |
|---|---|---|
| Route + Shell | `frontend/app/app/command-center/page.tsx`, `Shell.tsx` | Navigation + route |
| API client | `frontend/lib/command-center-api.ts` | Typed client |
| Period controls | `frontend/components/command-center/PeriodSelector.tsx` | Period + comparison |
| KPI cards | `frontend/components/command-center/KpiCard.tsx` | Render with section awareness |
| Section containers | `frontend/components/command-center/SectionCard.tsx` | Only render authorized sections |
| Charts | `frontend/components/command-center/TrendChart.tsx` | recharts integration |
| Layout integration | `frontend/components/command-center/WidgetGrid.tsx` | Workspace Constructor |
| DnD reorder | `frontend/components/command-center/CustomizeBar.tsx` | @dnd-kit/sortable |
| Responsive/a11y/i18n | All components | Tailwind, ARIA, i18n |
| Tests | Various spec files | Component + integration |

### Stage C — Admin Permission Management (Future, Separate Step)

| Change | Files | Description |
|---|---|---|
| Permission catalog API | New controller/service | GET /admin/permissions |
| Role permission management | New controller/service | PUT /admin/roles/:code/permissions |
| Audit log for permissions | New audit entries | Security.AuditLog |
| Admin UI | New frontend pages | Permission management interface |
| Concurrency/versioning | Optimistic locking | Role version field |
| Recovery admin protection | Business rule | Cannot remove last admin |

**Stage C can be deferred** without breaking Stage A/B. The hardcoded `ROLE_PERMISSIONS` provides safe defaults. Admin override is a future enhancement, not a security prerequisite.

---

## 14. REQUIRED IMPLEMENTATION IMPACT MAP

| Future Change | Backend | Frontend | Prisma/Migration | Seed | Tests | Stage |
|---|---|---|---|---|---|---|
| New permission codes | `permissions.constants.ts` | — | — | Auto (seed) | Unit + e2e | A |
| Default role assignments | `permissions.constants.ts` | — | — | Auto (seed) | Unit + e2e | A |
| Section authority filtering | `dashboard.service.ts` | — | — | — | e2e | A |
| Trends metric authority | `dashboard.service.ts` | — | — | — | e2e | A |
| Widget Registry metadata | `workspace.types.ts` | — | — | — | Unit | A |
| Effective layout filtering | `workspace.service.ts` | — | — | — | Unit + e2e | A |
| Command Center route | — | `app/app/command-center/page.tsx` | — | — | — | B |
| Shell navigation | — | `Shell.tsx` | — | — | — | B |
| API client | — | `lib/command-center-api.ts` | — | — | — | B |
| Period controls | — | `components/command-center/PeriodSelector.tsx` | — | — | — | B |
| KPI cards | — | `components/command-center/KpiCard.tsx` | — | — | — | B |
| Section containers | — | `components/command-center/SectionCard.tsx` | — | — | — | B |
| Charts | — | `components/command-center/TrendChart.tsx` | — | — | — | B |
| Layout integration | — | `components/command-center/WidgetGrid.tsx` | — | — | — | B |
| DnD reorder | — | `components/command-center/CustomizeBar.tsx` | — | — | — | B |
| Admin Permission API | New module | — | — | — | e2e | C |
| Admin Permission UI | — | New pages | — | — | — | C |
| Permission audit log | New audit entries | — | — | — | — | C |

---

## 15. SUPERSESSION TABLE

| Original Artifact | Conflicting Section | Superseded By |
|---|---|---|
| `platform-command-center-ui-design-ux-contract-step-3.2.md` §14.2 | RBAC Matrix listed 8 roles with access | Remediation Addendum §3: only 4 roles |
| `platform-command-center-ui-design-remediation-addendum-step-3.2.md` §3 | "reconciliation required for ALL roles with analytics.read" | This addendum §10: required only within financial authority |
| `platform-command-center-ui-design-remediation-addendum-step-3.2.md` §6 | "Coarse analytics.read + Role Default Composition" as sufficient | This addendum §3: server-side section authority required |
| `platform-command-center-ui-design-remediation-addendum-step-3.2.md` §8.2 | "Accept current hardcoded model for v1" | This addendum §5: safe defaults confirmed, Admin override future |

---

*This addendum is part of the Step 3.2 Design & UX Contract. Where it contradicts previous artifacts, this addendum takes precedence.*
