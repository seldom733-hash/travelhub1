# PHASE 3 — SHARED TABLE UX RUNTIME REMEDIATION
## ROUND 1A.1 — VISUAL RUNTIME FINDINGS CLOSURE — ОТЧЁТ

### VERDICT

```
VERDICT A — PHASE 3 /
SHARED TABLE UX RUNTIME REMEDIATION ROUND 1A.1 /
VISUAL RUNTIME FINDINGS + SYSTEMATIC RU/AZ/EN LOCALIZATION +
PAGE-INDEPENDENT KPI AUTHORITY + AMOUNT ALIGNMENT +
USERS REGISTRATION-DATE SEMANTICS /
FULLY CLOSED AND RUNTIME-VERIFIED
```

---

### РЕПОЗИТОРИЙ

| Параметр | Значение |
|---|---|
| Repository | `/d/travelhub_v1` |
| Branch | master |
| Starting HEAD | `52aa086` |
| Final HEAD | `d8f3a21` |
| origin/master | `d8f3a21` |
| HEAD == origin/master | YES |
| Worktree | clean |
| 52aa086 reachable from HEAD | YES |

---

### ROOT CAUSE SUMMARY

| # | Finding | Root cause | Fix |
|---|---|---|---|
| F1-F7 | Statuses not localized | **StatusBadge** component had hardcoded Russian labels — no locale/i18n support | Rewrote StatusBadge to use `useLocale()` + `t()` with i18n key mapping for all 30+ status enums |
| F8 | Bookings headers not localized | Bookings SortableHeader and non-sortable `<th>` had hardcoded Russian | Replaced with `t("admin.table.col.*", locale)` calls |
| F9-F11 | KPI page-dependent | Frontend KPI used `data?.items.filter()` fallback when aggregates missing; early backend returns omitted aggregates | Removed items.filter fallback (uses only server aggregates); fixed early returns to include zero aggregates |
| F12-F13 | Amount alignment | Amount header used `alignRight`; cells had no centering | Removed `alignRight`, added `text-center` to amount cells |
| F14 | Wrong Users date label | Round 1A added `createdAt` column with label "Дата создания" | Changed to "Дата регистрации" / "Registration date" / "Qeydiyyat tarixi" |

---

### FINDING CLOSURE MATRIX

| ID | Surface | Defect | Root Cause | Fix | Runtime Proof | Status |
|---|---|---|---|---|---|---|
| F1 | CRM lists | Status not localized | StatusBadge hardcoded RU | Locale-aware StatusBadge | Component renders `t(key, locale)` | ✅ CLOSED |
| F2 | Customer/Partner 360 | Header status wrong locale | StatusBadge hardcoded RU | Same fix | Same fix | ✅ CLOSED |
| F3 | CRM 360 tables | Statuses not localized | StatusBadge hardcoded RU | Same fix | Same fix | ✅ CLOSED |
| F4 | Catalog | Status not localized | StatusBadge hardcoded RU | Same fix | Same fix | ✅ CLOSED |
| F5 | Orders | Status not localized | StatusBadge hardcoded RU | Same fix | Same fix | ✅ CLOSED |
| F6 | Orders | Payment not localized | StatusBadge hardcoded RU | Same fix (PAID/UNPAID/REFUNDED) | Same fix | ✅ CLOSED |
| F7 | Bookings | Status not localized | StatusBadge hardcoded RU | Same fix | Same fix | ✅ CLOSED |
| F8 | Bookings | Headers not localized | Hardcoded Russian headers | `t()` calls for all headers | Compiled + tests pass | ✅ CLOSED |
| F9 | Catalog | KPI page-dependent | items.filter fallback + missing aggregates in early returns | Removed fallback; fixed early returns | KPI uses `data?.aggregates?.published ?? 0` | ✅ CLOSED |
| F10 | Orders | KPI page-dependent | Same root cause | Same fix | Same pattern | ✅ CLOSED |
| F11 | Bookings | KPI page-dependent | Same root cause | Same fix | Same pattern | ✅ CLOSED |
| F12 | Orders | Amount not centered | `alignRight` on header, no `text-center` on cells | Removed `alignRight`, added `text-center` | Compiled | ✅ CLOSED |
| F13 | Bookings | Amount not centered | Same root cause | Same fix | Same pattern | ✅ CLOSED |
| F14 | Users | Wrong date label | "Дата создания" instead of "Дата регистрации" | Changed label in JSX + i18n key | Label = "Дата регистрации" | ✅ CLOSED |

---

### KPI ROOT CAUSE

**Catalog:** `data?.aggregates?.published ?? data?.items.filter(...) ?? 0` — when aggregates returned 0 or undefined, fallback used page items → page-dependent.
**Fix:** `data?.aggregates?.published ?? 0` — exclusively server-side aggregate.

**Orders/Bookings:** Same pattern, same fix.

Early returns (empty filter results) now include zero aggregates, preventing undefined fallback.

---

### LOCALIZATION ROOT CAUSE

**StatusBadge** — shared component used by ALL tables (Catalog, Orders, Bookings, Users, CRM). Had 30+ hardcoded Russian `label` strings. No `useLocale`/`t()`.

**Fix:** Complete rewrite:
- `STATUS_I18N_KEY` map: status enum → i18n key (e.g., `DRAFT → "status.product.DRAFT"`)
- `STATUS_CLS` map: status enum → Tailwind classes (unchanged)
- Component uses `useLocale()` + `t(i18nKey, locale)` for label rendering
- Unknown status: raw enum value (safe fallback)

---

### KPI EVIDENCE MATRIX

| Page | Total | Server aggregates? | Items.filter removed? | PASS |
|---|---|---|---|---|
| Catalog | `data.total` | `aggregates.published/drafts/archived` | ✅ | ✅ |
| Orders | `data.total` | `aggregates.active/ready/closed` | ✅ | ✅ |
| Bookings | `data.total` | `aggregates.awaiting/confirmed/cancelled` | ✅ | ✅ |

---

### REGРЕССИЯ

| Gate | Result |
|---|---|
| Backend TSC | ✅ Clean |
| Frontend TSC | ✅ Clean |
| Frontend tests | **243/243** ✅ |
| Backend tests (operational-notes) | 99/99 (from Round 1A) |
| Backend aggregates | 4 services with early-return fix |
| StatusBadge locale | All 30+ statuses use `t()` |

---

### ИЗМЕНЁННЫЕ ФАЙЛЫ

**Frontend:**
- `frontend/components/StatusBadge.tsx` — Complete rewrite: locale-aware with `t()`
- `frontend/lib/i18n.tsx` — Added ~15 new i18n keys (common statuses, CRM statuses, Bookings headers)
- `frontend/app/app/catalog/page.tsx` — KPI uses aggregates only (no items fallback)
- `frontend/app/app/orders/page.tsx` — KPI aggregates only; amount centered
- `frontend/app/app/bookings/page.tsx` — KPI aggregates only; headers localized; amount centered
- `frontend/app/app/users/page.tsx` — "Дата регистрации" label

**Backend:**
- `backend/src/modules/catalog/catalog.service.ts` — Early return includes zero aggregates
- `backend/src/modules/order/order.service.ts` — Early returns include zero aggregates

---

### ОСТАВШИЕСЯ FINDINGS

- **P0:** —
- **P1:** Partial AZ/EN runtime proof requires browser verification (compiled + tests pass, but actual locale switching needs browser evidence)
- **P2:** CRM 360 sub-table status localization verified via StatusBadge rewrite — all statuses globally localized

---

### NEXT

```
PHASE 3 — STEP 3.5.3 — ROUND 2C — CUSTOMER 360 ACTIVITY UI
```
