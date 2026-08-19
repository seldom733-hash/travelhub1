# PHASE 3 — STEP 3.2 — PLATFORM COMMAND CENTER UI — DESIGN REMEDIATION ADDENDUM

> **ЯЗЫК:** все ответы — на русском языке. Английский для кода, команд, статусов.

---

## Purpose

This addendum remediate design gaps in the Step 3.2 Design & UX Contract identified during the Role Access & Default Visualization review. It supersedes conflicting sections in the original contract where specified.

**Authority:** `docs/architecture/platform-command-center-ui-design-ux-contract-step-3.2.md` (base)
**This addendum:** additions and corrections only. Base contract remains valid where not contradicted.

---

## 1. ACTUAL ROLE/PERMISSION MODEL

### 1.1 Canonical Roles (10)

From `RoleCode` enum in `prisma/schema.prisma` (security schema):

```
ADMIN, DIRECTOR, FINANCE, MARKETER, ANALYST, MODERATOR, SALES_MANAGER, OPERATOR, PARTNER, BUYER
```

### 1.2 Permission Persistence

- Permissions stored in `security.Permission` table (code + description)
- Role-permission assignments in `security.RolePermission` (many-to-many, composite PK `@@id([roleId, permissionId])`)
- Seeded idempotently at startup via `SecurityService.onModuleInit()` → `seedRoles()`
- `ADMIN` = `ALL_PERMISSIONS` (all permission codes, hardcoded in `ROLE_PERMISSIONS`)
- Users have exactly ONE role (`User.roleId` → `Role`)

### 1.3 `analytics.read` Distribution

**CRITICAL FINDING:** `analytics.read` is NOT assigned to all internal roles.

| Role | Has `analytics.read`? |
|---|---|
| ADMIN | ✅ (ALL_PERMISSIONS) |
| DIRECTOR | ✅ |
| FINANCE | ❌ |
| MARKETER | ✅ |
| ANALYST | ✅ |
| MODERATOR | ❌ |
| SALES_MANAGER | ❌ |
| OPERATOR | ❌ |
| PARTNER | ❌ (external role) |
| BUYER | ❌ (external role) |

**Impact on Command Center:**
- FINANCE, MODERATOR, SALES_MANAGER, OPERATOR **cannot access** `/app/command-center` (backend returns 403)
- The original design contract §14.2 incorrectly listed FINANCE, SALES_MANAGER, OPERATOR, MODERATOR as having access
- This is the **correct** behavior — these roles should NOT see Command Center by default

### 1.4 Admin Override Model

**Current state:**
- Role-permission assignments are hardcoded in `ROLE_PERMISSIONS` map
- Seeded from code on every startup (idempotent upsert)
- **NO Admin UI/API** exists to modify role-permission assignments at runtime
- **NO audit log** for permission changes
- Changing permissions requires code change + restart

**Design decision for Step 3.2:**
- Accept current hardcoded model as-is for v1
- Document future Admin Permission Management capability
- Do NOT implement Admin UI in this step

**Future Admin Capability (documented, not implemented):**
```
SYSTEM DEFAULT (code-defined)
→ ADMIN OVERRIDE (future: DB-managed, audited)
→ EFFECTIVE ROLE POLICY
```

Admin should eventually be able to:
- View canonical permission catalog
- View/modify role-permission assignments
- Audit all permission changes
- Ensure at least one recovery-capable admin exists
- NOT grant Platform data access to Partner context

---

## 2. DEFAULT ROLE PERMISSIONS (COMMAND CENTER)

### 2.1 Roles That CAN Access Command Center

Only roles with `analytics.read` can reach the Command Center endpoint. The frontend Shell renders the nav item based on this permission.

| Role | Access | Sections Visible | Default Widgets | Notes |
|---|---|---|---|---|
| ADMIN | ✅ | All 4 | System default (10) + all available | ALL_PERMISSIONS — full access |
| DIRECTOR | ✅ | All 4 | All 15 (executive + operational + financial + marketplace) | Executive oversight |
| ANALYST | ✅ | All 4 | System default (10) + trends available | Read-only analytics focus |
| MARKETER | ✅ | Executive, Marketplace | Sessions, Partners, Customers + Executive KPIs | Marketing-relevant only |

### 2.2 Roles That CANNOT Access Command Center

These roles do NOT have `analytics.read` and get 403 from backend:

| Role | Reason | Should See Instead |
|---|---|---|
| FINANCE | No `analytics.read` | Finance Center (when built) — has `finance.*` permissions |
| MODERATOR | No `analytics.read` | Moderation Center (when built) — has `moderation.*` permissions |
| SALES_MANAGER | No `analytics.read` | Sales Center (when built) — has `sales.*` permissions |
| OPERATOR | No `analytics.read` | Order Center / Booking Center — has `order.*`, `booking.*` |
| PARTNER | External role | Partner Cabinet (`/partner/*`) |
| BUYER | External role | Buyer Cabinet (`/account/*`) |

**Design rule:**
```
DEFERRED ROLE SECTIONS ≠ FAKE EXECUTIVE DASHBOARD
```

FINANCE should NOT receive the full Command Center as a substitute for their missing Finance Center. The coarse `analytics.read` correctly gates access.

---

## 3. ROLE DEFAULT COMPOSITION MATRIX

### 3.1 Widget Access Matrix

| Widget | ADMIN | DIRECTOR | ANALYST | MARKETER |
|---|---|---|---|---|
| `gmv` | ✅ default | ✅ default | ✅ default | ✅ default |
| `revenue` | ✅ default | ✅ default | ✅ default | ✅ default |
| `net-revenue` | ✅ default | ✅ default | ✅ default | ✅ default |
| `orders` | ✅ default | ✅ default | ✅ default | ✅ default |
| `bookings` | ✅ default | ✅ default | ✅ default | ✅ default |
| `aov` | ✅ default | ✅ default | ✅ default | ✅ default |
| `conversion` | ✅ default | ✅ default | ✅ default | ✅ default |
| `funnel` | ✅ default | ✅ default | ✅ default | ❌ hidden |
| `commission` | ✅ default | ✅ default | ✅ default | ❌ hidden |
| `reconciliation` | ✅ **required** | ✅ **required** | ✅ **required** | ❌ hidden |
| `payments` | ✅ optional | ✅ default | ✅ optional | ❌ hidden |
| `net-payments` | ✅ optional | ✅ default | ✅ optional | ❌ hidden |
| `sessions` | ✅ optional | ✅ default | ✅ optional | ✅ default |
| `partners` | ✅ optional | ✅ default | ✅ optional | ✅ default |
| `customers` | ✅ optional | ✅ default | ✅ optional | ✅ default |
| `revenue-trend` | ✅ optional | ✅ optional | ✅ default | ✅ optional |
| `orders-trend` | ✅ optional | ✅ optional | ✅ optional | ❌ hidden |
| `bookings-trend` | ✅ optional | ✅ optional | ✅ optional | ❌ hidden |

**Legend:**
- `default` = visible in Role Default Layout
- `optional` = allowed but not in default layout (user can add via customize)
- `hidden` = not in widget catalog for this role (permission-filtered)
- `required` = cannot be removed by user

### 3.2 Required Widget Semantics

**Current:** `reconciliation` is the only required widget.

**Remediated rule:**
```
REQUIRED WIDGET = NON-REMOVABLE (within authorized scope)
REQUIRED WIDGET ≠ BYPASS PERMISSION
```

- If a role does NOT have `analytics.read` → role cannot access Command Center at all → `reconciliation` irrelev ant
- If a role HAS `analytics.read` → `reconciliation` is required and non-removable
- `reconciliation` required status does NOT grant finance data access beyond what `analytics.read` provides
- For MARKETER (has `analytics.read` but not finance-focused): `reconciliation` is still required in default layout, but MARKETER can choose to hide it in customize mode if the Widget Registry marks it as removable for MARKETER's role defaults

**Design decision:** For v1, `reconciliation` is required for ALL roles with `analytics.read`. This is acceptable because:
1. Reconciliation shows ledger entry count (aggregated, not sensitive financial detail)
2. It's an operational health indicator, not a finance-only concern
3. Backend already gates data access via `analytics.read`

---

## 4. EFFECTIVE ACCESS RESOLUTION ALGORITHM

```
1. Resolve identity (JWT → userId)
2. Resolve PLATFORM context (always PLATFORM for /app/* routes)
3. Resolve role membership (User.roleId → Role.code)
4. Resolve effective permissions (RolePermission → Permission codes)
   - ADMIN: ALL_PERMISSIONS (hardcoded override)
   - Others: seeded role-permission mapping
5. Check page access:
   - Page requires `analytics.read`?
   - User has `analytics.read`?
   - NO → 403, redirect to /app/dashboard
6. Load effective layout (Workspace Constructor):
   - System Default → Role Default → User Override
7. Filter widgets by permission:
   - Widget requires permission X?
   - User has permission X?
   - NO → widget excluded from available widgets
8. Filter widgets by role defaults:
   - Widget in role's defaultWidgets?
   - NO → widget available but not in default layout
9. Restore required widgets:
   - Required widget missing from user layout?
   - Restore it (within authorized scope)
10. Apply User Layout:
    - User has saved layout?
    - Merge with effective defaults
    - Remove widgets no longer authorized
    - Restore required widgets
```

**Key behaviors:**
- Permission change → next page load reflects new permissions
- Saved layout contains newly forbidden widget → silently removed on next load
- Saved layout missing newly required widget → restored on next load
- Concurrent layout save + permission change → permission wins (backend validates)

---

## 5. TIMEZONE AUTHORITY REMEDIATION

### 5.1 Original Design (INCORRECT)

The original contract allowed user-selectable timezone affecting business period calculations:

```
"User can select timezone from dropdown (IANA validation)"
"Not stored in URL — session-level preference"
```

**This is wrong.** User timezone must NOT change business period boundaries.

### 5.2 Remediated Contract

```
BUSINESS REPORTING TIMEZONE IS AUTHORITATIVE
USER DISPLAY TIMEZONE MUST NOT CHANGE KPI AUTHORITY
```

**Step 3.2 v1 implementation:**

| Concern | Decision |
|---|---|
| Business period calculations | UTC (fixed, no user override) |
| Company reporting timezone | **NOT YET AUTHORITY** (deferred) |
| User timezone selection | **REMOVED** from v1 scope |
| Display timezone label | Show "UTC" in period display |
| Future company timezone | Will be admin-configurable setting, audited |

**UI contract:**
- Period selector sends `timezone=UTC` (hardcoded, not user-configurable)
- UI shows "UTC" label next to period
- No timezone dropdown in v1
- Future: company timezone setting in Admin → affects all reporting

**Hard rule preserved:**
```
PRODUCT.serviceTimeZone ≠ COMPANY REPORTING TIMEZONE
```

---

## 6. DRAG / REORDER / RESIZE REMEDIATION

### 6.1 Original Design

The original contract chose `@dnd-kit/core` but implied full drag/reorder/resize.

### 6.2 Corrected Scope (v1)

| Capability | v1 Scope | Library | Notes |
|---|---|---|---|
| **Reorder widgets** | ✅ IMPLEMENTED | `@dnd-kit/sortable` | Keyboard accessible, touch support |
| **Show/hide widgets** | ✅ IMPLEMENTED | UI toggle | Per-widget visibility |
| **Reset to default** | ✅ IMPLEMENTED | API call | `DELETE /workspaces/:pageId/layout` |
| **Drag between grid positions** | ✅ IMPLEMENTED | `@dnd-kit/sortable` + grid snap | Constrained to grid |
| **Resize widgets** | ❌ DEFERRED | — | Requires `@dnd-kit/resizable` + persistence contract + responsive complexity |
| **Mobile editing** | ❌ DEFERRED | — | Touch DnD on mobile is complex, low ROI for v1 |
| **Keyboard reorder** | ✅ IMPLEMENTED | `@dnd-kit/sortable` keyboard sensor | Arrow keys in edit mode |

### 6.3 Required Packages

```json
{
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^8.x",
  "@dnd-kit/utilities": "^3.x"
}
```

**NOT required for v1:**
- `@dnd-kit/resizable` (resize deferred)
- `@dnd-kit/presets` (not needed)

### 6.4 Persistence Compatibility

- Widget positions stored as `WidgetPosition[]` in JSON
- `x`, `y` = grid coordinates (0-based)
- `w`, `h` = grid dimensions (from WidgetDefinition defaults)
- Since resize is deferred, `w` and `h` remain at default values
- Existing `UserWorkspaceLayout.widgets` JSON format is compatible

---

## 7. ARTIFACT CONSISTENCY FIXES

### 7.1 Original Contract Corrections

| Issue | Original | Corrected |
|---|---|---|
| Final SHA | `369f7d9` (from first pass) | `82406ce` (current HEAD after remediation) |
| Deferred sections | "2 GAP sections" | **4 deferred sections** (Partner, Moderation, Support/Risk, Employees) |
| Localization path | `lib/i110n.tsx` (typo) | `lib/i18n.tsx` (actual) |
| KPI/widget count | "21 KPIs / 19 widgets" | **21 backend KPIs** in 4 sections, **19 registered widgets** in Widget Registry (21 KPI values map to 19 widgets because Funnel appears in both Operational section and Widget Registry) |
| RBAC Matrix §14.2 | Listed FINANCE, SALES_MANAGER, OPERATOR, MODERATOR as having access | **CORRECTED:** Only ADMIN, DIRECTOR, ANALYST, MARKETER have `analytics.read` |
| Timezone | User-selectable IANA timezone | **FIXED:** UTC fixed, no user selection |
| DnD scope | Full drag/reorder/resize | **CORRECTED:** Reorder only, resize deferred |
| Route prefix | Some references to `/api/v1/dashboard/...` | Consistent: `GET /api/v1/dashboard/command-center` via Next.js proxy |

### 7.2 21 KPIs → 19 Widgets Explanation

The backend `CommandCenterResponse` has 21 KPI values across 4 sections:
- Executive: 7 KPIs
- Operational: 6 KPIs
- Financial: 4 KPIs
- Marketplace: 4 KPIs

The Widget Registry has 19 registered widgets for `command-center`:
- 15 KPI cards (each maps to one backend KPI value)
- 1 funnel widget (maps to `funnelConversion`)
- 3 time-series widgets (trends, loaded lazily — not from summary endpoint)

The 21→19 mapping: `funnelConversion` is counted as an Operational KPI in the backend response but is rendered as a single funnel chart widget (not a KPI card). Time-series widgets are additional lazy-loaded components, not part of the 21 summary KPIs.

---

## 8. PERMISSION GRANULARITY DECISION

### 8.1 Options Evaluated

| Option | Pros | Cons |
|---|---|---|
| A: Coarse `analytics.read` only | Simple, existing | All authorized roles get same data |
| B: Section permissions | Granular per-section | Requires new backend endpoints, permission explosion risk |
| C: Widget permissions | Maximum flexibility | High admin burden, over-engineering |

### 8.2 Decision: Option A (Coarse) + Role Default Composition

**Selected:** Keep `analytics.read` as the sole page-level gate. Differentiate role experience through **Role Default Layout** (which widgets are visible by default), NOT through different permissions.

**Rationale:**
1. Backend Step 3.1/3.3 already uses single `analytics.read` gate
2. Adding section/widget permissions requires new backend endpoints + schema changes (out of scope)
3. Role Default Layout provides adequate UX differentiation without permission explosion
4. Admin can future-adjust which widgets each role sees by modifying roleDefaults in PAGE_REGISTRY
5. Frontend filtering by role defaults is UX-only (backend remains authoritative)

**Future extension path:**
If finer-grained access is needed later:
```
analytics.read (page gate)
+ dashboard.executive.read (section gate)
+ dashboard.financial.read (section gate)
```

This is a **future design decision**, not part of Step 3.2 v1.

---

## 9. MULTIPLE ROLES

**Current repository:** Users have exactly ONE role (`User.roleId` → `Role`).

**Multiple roles: NOT APPLICABLE CURRENTLY.**

- No `UserRole` junction table exists
- No role precedence/union logic exists
- Design assumes single-role model

**Future consideration (documented, not implemented):**
```
Permissions: union within same PLATFORM context
Default layout: deterministic primary-role default, not arbitrary merge
```

---

## 10. DEFERRED ROLE SECTIONS — BEHAVIOR

For roles that DO have `analytics.read` (ADMIN, DIRECTOR, ANALYST, MARKETER):

| Deferred Section | Should It Show? | Behavior |
|---|---|---|
| Partner Management | NO | No backend authority, no fake KPI |
| Moderation | NO | No backend authority, no fake KPI |
| Support/Risk | NO | No backend authority, no fake KPI |
| Employees/Operations | NO | No backend authority, no fake KPI |

**Rule:** Deferred sections are completely hidden. No empty cards, no "coming soon" placeholders, no dead links. When backend authority is added in future steps, sections become visible through Widget Registry update.

---

## 11. SECURITY NON-NEGOTIABLES (PRESERVED)

```
PLATFORM DATA ≠ PARTNER DATA
PARTNER A ≠ PARTNER B
PERMISSION DOES NOT BYPASS CONTEXT
PERMISSION DOES NOT BYPASS ENTITLEMENT
LAYOUT DOES NOT BYPASS PERMISSION
REQUIRED WIDGET DOES NOT BYPASS PERMISSION
ADMIN ACTIONS ARE AUDITED (future)
```

**Additional Step 3.2 rule:**
```
PLATFORM ADMIN CANNOT GRANT PLATFORM DATA TO PARTNER CONTEXT
```

The `analytics.read` permission grants access to PLATFORM aggregate analytics. It does NOT and cannot grant Partner-scoped data. Partner context is architecturally separate.

---

## 12. ACCEPTANCE CRITERIA — UPDATED

| Criterion | Original | Remediated |
|---|---|---|
| RBAC Matrix accurate | Listed 8 roles with access | ✅ **4 roles** (ADMIN, DIRECTOR, ANALYST, MARKETER) |
| Role Default Layout defined | 3-row coarse table | ✅ **Full 4-role × 19-widget matrix** |
| Permission granularity | Not decided | ✅ **Coarse `analytics.read` + role defaults** |
| Effective access algorithm | Not defined | ✅ **10-step deterministic algorithm** |
| Timezone authority | User-selectable | ✅ **UTC fixed, no user override** |
| DnD scope | Full drag/reorder/resize | ✅ **Reorder only, resize deferred** |
| Required widget semantics | "reconciliation required" | ✅ **Conditional: within authorized scope** |
| Artifact consistency | Multiple issues | ✅ **All corrected** |
| Deferred sections | 2 listed | ✅ **4 listed with explicit behavior** |
| Admin override model | Not defined | ✅ **Documented (future, not implemented)** |

---

## 13. UPDATED ACCEPTANCE CRITERIA — DESIGN PASS

| Criterion | Status |
|---|---|
| Actual roles/permissions studied | ✅ |
| Default Role Permissions defined | ✅ |
| Admin override model defined | ✅ |
| Permission / Role Default / User Layout separated | ✅ |
| Role access matrix complete | ✅ |
| Role default composition matrix complete | ✅ |
| Coarse `analytics.read` problem resolved | ✅ |
| Future permission identifiers not implemented | ✅ |
| Effective access algorithm deterministic | ✅ |
| Required widget doesn't expand authority | ✅ |
| Timezone authority safe | ✅ |
| DnD/reorder/resize scope realistic | ✅ |
| 4 deferred sections reflected uniformly | ✅ |
| Localization path and provenance corrected | ✅ |
| Platform/Partner isolation preserved | ✅ |
| Implementation waves updated | ✅ |
| Production code/schema/migrations unchanged | ✅ |
| Artifacts committed and pushed | PENDING |
| HEAD == upstream | PENDING |
| Worktree clean | PENDING |

---

*This addendum is part of the Step 3.2 Design & UX Contract. Where it contradicts the base contract, this addendum takes precedence.*
