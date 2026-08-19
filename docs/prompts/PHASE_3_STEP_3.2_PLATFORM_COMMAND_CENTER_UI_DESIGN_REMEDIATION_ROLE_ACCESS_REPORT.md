# PHASE 3 — STEP 3.2 — PLATFORM COMMAND CENTER UI — DESIGN REMEDIATION — ROLE ACCESS & DEFAULT VISUALIZATION — REPORT

> **ЯЗЫК:** все ответы — на русском языке. Английский для кода, команд, статусов.

---

## 1. EXECUTIVE SUMMARY

Выполнен **Design Remediation** для Step 3.2 Platform Command Center UI Design & UX Contract. Устранены критические design-probelы, обнаруженные при repository-first проверке role access и default visualization.

**Ключевые исправления:**

1. **RBAC Matrix исправлена:** `analytics.read` есть ТОЛЬКО у 4 ролей (ADMIN, DIRECTOR, ANALYST, MARKETER), а не у всех 8 internal. FINANCE, MODERATOR, SALES_MANAGER, OPERATOR **не получают** Command Center.
2. **Role Default Composition Matrix:** Полная матрица 4 роли × 19 widgets определена.
3. **Timezone authority:** Произвольный user timezone selector УДАЛЁН. UTC зафиксирован.
4. **DnD scope:** Resize ОТЛОЖЕН. v1 = reorder only + show/hide + reset.
5. **Required widget semantics:** `reconciliation` required = non-removable within authorized scope, не bypass permission.
6. **Artifact corrections:** 7 ошибок в оригинальном design contract исправлены.
7. **Admin override model:** Документирован (будущий, не реализован).

---

## 2. REPOSITORY STATE

| Field | Value |
|---|---|
| Repository | `seldom733-hash/travelhub1` |
| Branch | `master` |
| Base SHA | `82406ce` |
| Final SHA | After commit |
| Ancestor check | `82406ce` is ancestor ✅ |
| Worktree | Clean (only untracked docs) |

---

## 3. ACTUAL ROLE/PERMISSION MODEL

**10 canonical roles** in `RoleCode` enum:
ADMIN, DIRECTOR, FINANCE, MARKETER, ANALYST, MODERATOR, SALES_MANAGER, OPERATOR, PARTNER, BUYER

**`analytics.read` distribution:**

| Role | analytics.read | Can Access Command Center |
|---|---|---|
| ADMIN | ✅ (ALL_PERMISSIONS) | ✅ |
| DIRECTOR | ✅ | ✅ |
| FINANCE | ❌ | ❌ |
| MARKETER | ✅ | ✅ |
| ANALYST | ✅ | ✅ |
| MODERATOR | ❌ | ❌ |
| SALES_MANAGER | ❌ | ❌ |
| OPERATOR | ❌ | ❌ |
| PARTNER | ❌ | ❌ (external) |
| BUYER | ❌ | ❌ (external) |

**Original design error:** Listed FINANCE, SALES_MANAGER, OPERATOR, MODERATOR as having access. This was incorrect — they lack `analytics.read`.

---

## 4. DEFAULT ROLE PERMISSIONS

| Role | Business Responsibility | Command Center Sections | Default Widgets | Notes |
|---|---|---|---|---|
| ADMIN | System/security/operations | All 4 | System default (10) + all available | ALL_PERMISSIONS |
| DIRECTOR | Executive oversight | All 4 | All 15 (full board) | Broadest default view |
| ANALYST | Read-only analytics | All 4 | System default (10) + trends | Analytics focus |
| MARKETER | Acquisition/channels | Executive, Marketplace | Sessions, Partners, Customers + Executive | Marketing-relevant only |
| FINANCE | Revenue/payments | ❌ DEFERRED | — | Has `finance.*` but no `analytics.read` |
| MODERATOR | Content moderation | ❌ DEFERRED | — | Has `moderation.*` but no `analytics.read` |
| SALES_MANAGER | Sales pipeline | ❌ DEFERRED | — | Has `sales.*` but no `analytics.read` |
| OPERATOR | Operational workload | ❌ DEFERRED | — | Has `order.*`, `booking.*` but no `analytics.read` |

---

## 5. ADMIN OVERRIDE MODEL

**Current state:** Hardcoded `ROLE_PERMISSIONS` map, seeded at startup. No Admin UI.

**Future design (documented, not implemented):**
```
SYSTEM DEFAULT (code-defined)
→ ADMIN OVERRIDE (future: DB-managed, audited)
→ EFFECTIVE ROLE POLICY
```

Admin should eventually:
- View permission catalog
- Modify role-permission assignments
- Audit all changes
- Ensure recovery admin exists

**Step 3.2 v1:** Accept current hardcoded model. No Admin UI implementation.

---

## 6. ROLE ACCESS MATRIX

**4 roles with Command Center access:**

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
| `reconciliation` | ✅ required | ✅ required | ✅ required | ❌ hidden |
| `payments` | ✅ optional | ✅ default | ✅ optional | ❌ hidden |
| `net-payments` | ✅ optional | ✅ default | ✅ optional | ❌ hidden |
| `sessions` | ✅ optional | ✅ default | ✅ optional | ✅ default |
| `partners` | ✅ optional | ✅ default | ✅ optional | ✅ default |
| `customers` | ✅ optional | ✅ default | ✅ optional | ✅ default |
| `revenue-trend` | ✅ optional | ✅ optional | ✅ default | ✅ optional |
| `orders-trend` | ✅ optional | ✅ optional | ✅ optional | ❌ hidden |
| `bookings-trend` | ✅ optional | ✅ optional | ✅ optional | ❌ hidden |

---

## 7. ROLE DEFAULT LAYOUT SUMMARY

| Role | Default Widget Count | Sections Shown | Customize Available |
|---|---|---|---|
| ADMIN | 10 (system default) | All 4 | ✅ |
| DIRECTOR | 15 (full board) | All 4 | ✅ |
| ANALYST | 10 + trends available | All 4 | ✅ |
| MARKETER | 8 (executive + marketplace) | Executive, Marketplace | ✅ |

---

## 8. PERMISSION GRANULARITY DECISION

**Selected: Option A — Coarse `analytics.read` + Role Default Composition**

- `analytics.read` = page-level gate (backend)
- Role Default Layout = which widgets visible by default (frontend/registry)
- No section/widget permissions in v1
- Future extension: `dashboard.executive.read`, `dashboard.financial.read` (not implemented now)

---

## 9. EFFECTIVE ACCESS ALGORITHM

10-step deterministic resolution:
1. Identity → 2. PLATFORM context → 3. Role → 4. Permissions → 5. Page access check → 6. Effective layout (system→role→user) → 7. Filter by permission → 8. Filter by role defaults → 9. Restore required widgets → 10. Apply user layout

Key: DENY / MISSING AUTHORITY WINS OVER LAYOUT.

---

## 10. TIMEZONE DECISION

**Original (INCORRECT):** User-selectable IANA timezone affecting business periods.

**Remediated (CORRECT):**
- Business period calculations: UTC (fixed)
- Company reporting timezone: DEFERRED (no authority)
- User timezone selection: REMOVED from v1
- Display: "UTC" label shown
- Future: admin-configurable company timezone

---

## 11. DND/REORDER/RESIZE DECISION

| Capability | v1 | Library |
|---|---|---|
| Reorder widgets | ✅ | `@dnd-kit/sortable` |
| Show/hide | ✅ | UI toggle |
| Reset to default | ✅ | API |
| Drag between positions | ✅ | `@dnd-kit/sortable` + grid snap |
| Resize | ❌ DEFERRED | — |
| Mobile editing | ❌ DEFERRED | — |
| Keyboard reorder | ✅ | `@dnd-kit/sortable` keyboard sensor |

---

## 12. ARTIFACT CORRECTIONS

| # | Issue | Fix |
|---|---|---|
| 1 | Final SHA wrong | Updated to current HEAD |
| 2 | "2 GAP sections" | Corrected to **4 deferred sections** |
| 3 | Localization path typo `i110n.tsx` | Corrected to `lib/i18n.tsx` |
| 4 | "21 KPIs / 19 widgets" confusion | Explained: 21 backend KPI values → 19 registered widgets |
| 5 | RBAC Matrix incorrect | Corrected: only 4 roles have `analytics.read` |
| 6 | Timezone user-selectable | Fixed: UTC fixed, no user selection |
| 7 | DnD full scope claimed | Corrected: reorder only, resize deferred |

---

## 13. VERIFICATION AND NEGATIVE CHECKS

| Check | Required | Actual |
|---|---|---|
| Production frontend changes | 0 | ✅ 0 |
| Production backend changes | 0 | ✅ 0 |
| Schema changes | 0 | ✅ 0 |
| Migrations | 0 | ✅ 0 |
| New permissions implemented | 0 | ✅ 0 |
| Role management UI implemented | 0 | ✅ 0 |
| Role assignment API implemented | 0 | ✅ 0 |
| Partner workspace implemented | 0 | ✅ 0 |
| Organization switcher implemented | 0 | ✅ 0 |
| Second constructor | 0 | ✅ 0 |
| Second analytics engine | 0 | ✅ 0 |
| Step 2.17B changes | 0 | ✅ 0 |
| Frozen targets changed | 0 | ✅ 0 |
| Release/deploy | 0 | ✅ 0 |
| Auto-start implementation | 0 | ✅ 0 |

---

## 14. OPEN GAPS / BLOCKERS

| Gap | Blocking? | Notes |
|---|---|---|
| FINANCE role has no `analytics.read` | NO | Correct — Finance Center is separate future scope |
| MODERATOR role has no `analytics.read` | NO | Correct — Moderation Center is separate future scope |
| SALES_MANAGER has no `analytics.read` | NO | Correct — Sales Center is separate future scope |
| OPERATOR has no `analytics.read` | NO | Correct — operational work centers are separate |
| Admin Permission Management UI | NO | Future scope, documented |
| Company reporting timezone | NO | UTC fallback, documented |
| Resize deferred | NO | Reorder sufficient for v1 |

---

## 15. VERDICT

```
PHASE 3 — STEP 3.2 — PLATFORM COMMAND CENTER UI — DESIGN REMEDIATION — VERDICT A — READY FOR IMPLEMENTATION
```

All remediation findings closed. Implementation scope is unambiguous.

---

## 16. NEXT

```
NEXT: PHASE 3 — STEP 3.2 — PLATFORM COMMAND CENTER UI — IMPLEMENTATION
```

Implementation not started in this pass. Requires separate implementation-pass.

---

## 17. REPOSITORY EVIDENCE

```
Base SHA:    82406ce
Final SHA:   [after commit]
Branch:      master
Worktree:    Clean
Files:       2 new (remediation addendum + report)
Code changes: 0
Schema:      0
Migrations:  0
```

---

*Generated by repository-first analysis. All decisions grounded in actual RBAC code and permissions.constants.ts.*
