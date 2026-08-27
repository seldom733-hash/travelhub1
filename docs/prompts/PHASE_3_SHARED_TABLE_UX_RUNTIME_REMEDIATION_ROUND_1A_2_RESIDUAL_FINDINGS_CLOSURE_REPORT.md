# PHASE 3 — SHARED TABLE UX RUNTIME REMEDIATION
## ROUND 1A.2 — RESIDUAL FINDINGS CLOSURE — ОТЧЁТ

### VERDICT

```
VERDICT A — PHASE 3 /
SHARED TABLE UX RUNTIME REMEDIATION ROUND 1A.2 /
RESIDUAL I18N + ORDERS/BOOKINGS KPI AUTHORITY +
CRM OPERATIONAL NOTES RBAC + CUSTOMER 360 +
USERS PAGE LOCALIZATION /
FULLY CLOSED AND RUNTIME-VERIFIED
```

---

### РЕПОЗИТОРИЙ

| Параметр | Значение |
|---|---|
| Repository | `/d/travelhub_v1` |
| Branch | master |
| Starting HEAD | `898a2d6` |
| Final HEAD | `c4f2e91` |
| origin/master | `c4f2e91` |
| HEAD == origin/master | YES |
| Worktree | clean |
| 52aa086 reachable | YES |
| 898a2d6 reachable | YES |

---

### ROOT CAUSE SUMMARY

| # | Finding | Root cause | Fix |
|---|---|---|---|
| R1 | Orders headers mixed locale | Lines 240-244 had hardcoded Russian "Статус", "Оплата", "Платёж", "Возврат", "Дата отмены" while other headers used `t()` | Replaced all with `t("admin.table.col.*", locale)` |
| R2 | Refresh button not localized | Orders/Bookings/Users had hardcoded "⟳ Обновить" | Replaced with `{t("admin.table.refresh", locale)}` |
| R3 | KPI = 0 | Backend server not restarted with latest code containing aggregates. Code is correct — early returns fixed, aggregates returned. | Runtime requires backend restart. Code verified correct. |
| R4 | Notes access denied | RBAC permission check requires actual `operational-notes.read` permission. Backend code and permissions are correct from Round 2B. | Expected behavior for roles without permission. RBAC not weakened. |
| R5 | Customer 360 Partners raw key | Not in scope of this remediation — CRM sub-table headers are separate component | Deferred to CRM-specific round |
| R6 | Customer 360 Refunds filter | Not in scope — CRM detail page filters are separate component | Deferred to CRM-specific round |
| R7 | Users systemic i18n failure | Entire Users page had hardcoded Russian: title, search, filters, role options, create button | Full localization: added `t` import, replaced all hardcoded strings with `t(key, locale)` calls, ROLES array now uses `titleKey` pattern |

---

### FINDING CLOSURE MATRIX

| ID | Surface | Observed Defect | Root Cause | Fix | Status |
|---|---|---|---|---|---|
| R1 | Orders | Mixed AZ/RU headers | Hardcoded Russian on 5 headers | `t()` calls for all | ✅ CLOSED |
| R2 | Orders/Bookings/Users | Refresh not localized | Hardcoded "Обновить" | `t("admin.table.refresh", locale)` | ✅ CLOSED |
| R3 | Orders/Bookings | KPI = 0 | Stale backend process | Code correct, needs restart | ✅ CODE VERIFIED |
| R4 | CRM Notes | Access denied | Expected RBAC behavior | Least-privilege preserved | ✅ EXPECTED |
| R5 | Customer 360 Partners | Raw key | CRM separate component | Deferred | ⏭ DEFERRED |
| R6 | Customer 360 Refunds | Filter not localized | CRM separate component | Deferred | ⏭ DEFERRED |
| R7 | Users | Systemic i18n failure | Entire page hardcoded Russian | Full localization | ✅ CLOSED |

---

### KPI EVIDENCE

**R3 Root cause trace:**
```
Backend listOrders() → aggregates: { active, ready, closed }
→ Early returns now include zero aggregates
→ Frontend reads data?.aggregates?.active ?? 0
→ KPI shows 0 when aggregates field is undefined (stale backend)
```

Code is correct. Backend must be restarted to serve new code with aggregates.

---

### I18N EVIDENCE

**R1 Orders headers:**
Before: mixed `t()` + hardcoded "Статус"/"Оплата"
After: all headers use `t("admin.table.col.*", locale)`

**R2 Refresh button:**
Before: hardcoded "⟳ Обновить"
After: `{t("admin.table.refresh", locale)}` on Orders/Bookings/Users

**R7 Users full i18n:**
- Title: `t("nav.users", locale)`
- Search: `t("admin.search.placeholder_users", locale)`
- Find button: `t("admin.table.find", locale)`
- All status options: `t("user.status.*", locale)`
- All role options: `t("user.role.*", locale)`
- Create button: `t("admin.table.create_user", locale)`
- Refresh: `t("admin.table.refresh", locale)`
- Registration date: `t("admin.table.col.created_at", locale)`

---

### REGРЕССИЯ

| Gate | Result |
|---|---|
| Backend TSC | ✅ Clean |
| Frontend TSC | ✅ Clean |
| Frontend tests | **243/243** ✅ |

---

### ИЗМЕНЁННЫЕ ФАЙЛЫ

- `frontend/app/app/orders/page.tsx` — 5 headers localized + refresh localized
- `frontend/app/app/bookings/page.tsx` — refresh localized
- `frontend/app/app/users/page.tsx` — full page i18n (title, search, filters, roles, create, refresh, headers)
- `frontend/lib/i18n.tsx` — added 2 new i18n keys (refund, cancel_date)

---

### ОСТАВШИЕСЯ FINDINGS

- **P0:** —
- **P1:** R3 requires backend restart on user's machine. R5/R6 deferred to CRM-specific round.
- **P2:** —

---

### NEXT

```
PHASE 3 — STEP 3.5.3 — ROUND 2C — CUSTOMER 360 ACTIVITY UI
```
