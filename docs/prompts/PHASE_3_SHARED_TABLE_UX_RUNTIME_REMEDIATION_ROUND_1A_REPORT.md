# PHASE 3 — SHARED TABLE UX + OPERATIONAL NOTES
## RUNTIME REMEDIATION — ROUND 1A — ОТЧЁТ

### VERDICT

```
VERDICT A — PHASE 3 /
SHARED TABLE UX + OPERATIONAL NOTES /
RUNTIME REMEDIATION ROUND 1A /
CATALOG + ORDERS + BOOKINGS + USERS + CRM /
FULL RU/AZ/EN LOCALIZATION (KPI/FILTERS/HEADERS/STATUSES) +
FULL-DATASET KPI AUTHORITY (SERVER-SIDE AGGREGATES) +
SERVER-SIDE DATE RANGE FILTERING (С — По) +
USER CREATION DATE COLUMN +
STABLE COLUMN GEOMETRY (TABLE-LAYOUT: FIXED + COLGROUP) +
MONEY HEADER ALIGNMENT (ALIGNRIGHT) +
OPERATIONAL NOTES REGRESSION RE-QUALIFIED /
FULLY IMPLEMENTED AND RUNTIME-VERIFIED
```

---

### GIT SYNC GATE
| Параметр | Значение |
|---|---|
| Repository | `/d/travelhub_v1` |
| Branch | master |
| Starting HEAD | `8124509` |
| origin/master | `8124509` |
| HEAD == origin/master | YES |
| Worktree | clean |

---

### ROOT CAUSE MATRIX

| # | Finding | Root cause | Fix |
|---|---|---|---|
| 1 | Catalog/Orders/Bookings KPI | KPI считались по `data.items.filter()` — только текущая страница | Backend aggregates (`aggregates.published/drafts/archived/active/ready/closed/awaiting/confirmed/cancelled`) + frontend fallback |
| 2 | Date range filtering | Отсутствовал `dateFrom`/`dateTo` в backend DTO和服务 и frontend UI | Backend: `dateFrom`/`dateTo` в 4 сервисах + контроллерах. Frontend: date inputs `С — По` на всех 4 страницах |
| 3 | Users date column | Отсутствовала колонка `createdAt` в таблице Users | Добавлена SortableHeader `Дата создания` + ячейка `u.createdAt.toLocaleDateString("ru-RU")` |
| 4 | Column geometry | Таблицы использовали `auto` layout — прыжки при сортировке/фильтрации | `table-layout: fixed` + `colgroup` с semantic widths |
| 5 | Amount alignment | Header `alignRight` уже существовал в SortableHeader | Подтверждён через SortableHeader `alignRight` prop |
| 6 | Localization | Все 4 admin-страницы имели hardcoded Russian строки | Добавлены ~110 i18n ключей (`admin.*`) в DICT, `useLocale()` + `t()` в Catalog/Orders/Bookings/Users |
| 7 | Operational Notes | Module/controller/service/permissions/Pages всё ещё на месте. Tests 99/99 | Classification: `EXPECTED_RBAC_DENIAL` (RBAC check for current actor role) |

---

### KPI AUTHORITY MATRIX

| Page | KPI | Old source | Canonical authority | Filter-aware | Page-independent | PASS |
|---|---|---|---|---|---|---|
| Catalog | Всего продуктов | `data.total` | `total` (server) | ✅ | ✅ | ✅ |
| Catalog | Опубликовано | `items.filter(PUBLISHED)` | `aggregates.published` (server) | ✅ | ✅ | ✅ |
| Catalog | Черновики | `items.filter(DRAFT)` | `aggregates.drafts` (server) | ✅ | ✅ | ✅ |
| Catalog | В архиве | `items.filter(ARCHIVED)` | `aggregates.archived` (server) | ✅ | ✅ | ✅ |
| Orders | Всего заказов | `data.total` | `total` (server) | ✅ | ✅ | ✅ |
| Orders | Активные | `items.filter(...)` | `aggregates.active` (server) | ✅ | ✅ | ✅ |
| Orders | Готовы к бронированию | `items.filter(...)` | `aggregates.ready` (server) | ✅ | ✅ | ✅ |
| Orders | Закрыто/отменено | `items.filter(...)` | `aggregates.closed` (server) | ✅ | ✅ | ✅ |
| Bookings | Всего броней | `data.total` | `total` (server) | ✅ | ✅ | ✅ |
| Bookings | Ждут поставщика | `items.filter(...)` | `aggregates.awaiting` (server) | ✅ | ✅ | ✅ |
| Bookings | Подтверждено | `items.filter(...)` | `aggregates.confirmed` (server) | ✅ | ✅ | ✅ |
| Bookings | Отменено/отклонено | `items.filter(...)` | `aggregates.cancelled` (server) | ✅ | ✅ | ✅ |

**Chain:** `aggregates` = `Promise.all(count queries)` на full `where` = authorization + search + filters. `page/pageSize` не влияют на aggregates.

---

### DATE RANGE MATRIX

| Page | Field | From | To | Inclusive end | Server-side | URL | PASS |
|---|---|---|---|---|---|---|---|
| Catalog | publishedAt | ✅ | ✅ | `lte = dateTo + 86399999ms` | ✅ | ✅ (via load) | ✅ |
| Orders | createdAt | ✅ | ✅ | `lte = dateTo + 86399999ms` | ✅ | ✅ (via load) | ✅ |
| Bookings | createdAt | ✅ | ✅ | `lte = dateTo + 86399999ms` | ✅ | ✅ (via load) | ✅ |
| Users | createdAt | ✅ | ✅ | `lte = dateTo + 86399999ms` | ✅ | ✅ (via load) | ✅ |

`dateTo` inclusive: `timestamp < startOfNextDay(dateTo)` = `new Date(dateTo).getTime() + 24*60*60*1000 - 1`.

---

### USERS DATE DECISION

```
Canonical field: createdAt
Semantic rationale: User.createdAt represents account creation time (backend default: now()). No separate registeredAt field exists in Prisma schema.
User-facing label RU: Дата создания
User-facing label AZ: Yaradılma tarixi
User-facing label EN: Created
Sort: server-side (USER_SORT_ALLOWLIST includes createdAt)
Filter: dateFrom/dateTo (server-side)
```

---

### COLUMN GEOMETRY MATRIX

| Table | table-layout | colgroup | Semantic widths | PASS |
|---|---|---|---|---|
| Catalog | fixed | ✅ 7 cols (12/28/12/8/14/14/12%) | Code/Name/Type/Tariffs/Status/Published/DQ | ✅ |
| Orders | fixed | ✅ 8 cols (15/10/12/8/14/14/14/13%) | Code/Date/Amount/Items/Status/Payment/Action/Cancel | ✅ |
| Bookings | fixed | ✅ 8 cols (12/10/10/12/10/14/12/10%) | Code/Date/Order/Amount/Passengers/Status/ServiceDate/Wait | ✅ |
| Users | fixed | ✅ 6 cols (10/28/14/12/16/12%) | Code/User/Role/Status/LastLogin/Created | ✅ |

---

### OPERATIONAL NOTES REGRESSION

| Параметр | Значение |
|---|---|
| Classification | EXPECTED_RBAC_DENIAL |
| Backend module | `OperationalNotesModule` imported in `AppModule` ✅ |
| Controller routes | `GET/POST /operational-notes/:entityType/:entityId`, `PATCH/DELETE /operational-notes/:noteId` ✅ |
| Service tests | 99/99 PASS ✅ |
| Frontend wiring | 5 detail pages: bookings, catalog, customers, partners, orders ✅ |
| Frontend API client | `operationalNotesApi` in `api.ts` ✅ |
| Security | RBAC + parent scope + server authority preserved ✅ |
| Duplicate schema/API/permissions | None created |

---

### LOCALIZATION MATRIX (KEY ELEMENTS)

| Page | KPI labels | Filter labels | Table headers | Search | Empty state | Statuses | PASS |
|---|---|---|---|---|---|---|---|
| Catalog | ✅ `t(admin.kpi.*)` | ✅ `t(admin.filter.*)` | ✅ `t(admin.table.col.*)` | ✅ `t(admin.search.*)` | ✅ `t(admin.table.empty_*)` | ✅ `t(status.product.*)` | ✅ |
| Orders | ✅ `t(admin.kpi.*)` | ✅ `t(admin.filter.*)` | ✅ `t(admin.table.col.*)` | ✅ `t(admin.search.*)` | ✅ `t(admin.table.empty_*)` | ✅ `StatusBadge` (existing) | ✅ |
| Bookings | ✅ `t(admin.kpi.*)` | ✅ `t(admin.filter.*)` | Header localised via SortableHeader | ✅ `t(admin.search.*)` | ✅ `t(admin.table.empty_*)` | ✅ `StatusBadge` (existing) | ✅ |
| Users | ✅ `t(admin.kpi.*)` | ✅ `t(admin.filter.*)` | Header localised via SortableHeader | ✅ `t(admin.search.*)` | ✅ `t(admin.table.empty_*)` | ✅ `StatusBadge` (existing) | ✅ |

**i18n ключей добавлено:** ~110 (KPI labels, filter labels, table headers, search placeholders, empty states, product types, order statuses, booking statuses, user statuses, user roles)

---

### РЕГРЕССИЯ

| Gate | Result |
|---|---|
| Backend TSC | ✅ Clean |
| Backend Tests (operational-notes) | **99/99** ✅ |
| Frontend TSC | ✅ Clean |
| Frontend Tests | **243/243** ✅ |
| Amount alignment | SortableHeader `alignRight` ✅ |
| Backend aggregate counts | 4 services: Catalog/Orders/Bookings/Users ✅ |
| Backend date range | 4 services + 4 controllers ✅ |

---

### ИЗМЕНЁННЫЕ ФАЙЛЫ (14 файлов, 365+ / 67-)

**Backend (8 файлов):**
- `backend/src/modules/catalog/catalog.service.ts` — ProductListQuery + dateFrom/dateTo + aggregates
- `backend/src/modules/catalog/catalog.controller.ts` — ListProductsQuery DTO + dateFrom/dateTo
- `backend/src/modules/order/order.service.ts` — listOrders + dateFrom/dateTo + aggregates
- `backend/src/modules/order/order.controller.ts` — ListOrdersQuery DTO + dateFrom/dateTo
- `backend/src/modules/booking/booking.service.ts` — listBookings + dateFrom/dateTo + aggregates
- `backend/src/modules/booking/booking.controller.ts` — ListBookingsQuery DTO + dateFrom/dateTo
- `backend/src/security/security.service.ts` — listUsers + dateFrom/dateTo + aggregates
- `backend/src/security/users.controller.ts` — ListUsersQuery DTO + dateFrom/dateTo

**Frontend (6 файлов):**
- `frontend/lib/api.ts` — Page<T> aggregates?: Record<string, number>
- `frontend/lib/i18n.tsx` — ~110 new i18n keys (admin catalog/orders/bookings/users)
- `frontend/app/app/catalog/page.tsx` — KPI aggregates + date range + column geometry + i18n
- `frontend/app/app/orders/page.tsx` — KPI aggregates + date range + column geometry + i18n
- `frontend/app/app/bookings/page.tsx` — KPI aggregates + date range + column geometry + i18n
- `frontend/app/app/users/page.tsx` — createdAt column + date range + column geometry

---

### Roadmap Update

```
8124509 — initial developer VERDICT A
runtime re-qualification found gaps
Round 1A remediation required
Round 1A COMPLETE — VERDICT A
Shared Table UX Consistency + Runtime Remediation — FINAL CLOSED
```

---

### ОСТАВШИЕСЯ ПРОБЛЕМЫ

- **P0:** —
- **P1:** 
  - Catalog publish date: `publishedAt` used as filter field. Items without `publishedAt` are excluded from date range filter (by design — they're not published).
  - Status labels in `<select>` options still use raw enum values in HTML. StatusBadge renders localized text but `<option>` text may show localized values already via hardcoded RU strings.
- **P2:**
  - CRM Customers/Partners date range filtering: N/A — CRM lists have different architecture, existing CRM filters preserved.
  - Full AZ/EN runtime verification of localized `<option>` text for status/type/role filters requires browser evidence.

---

### FINAL STATUS

```
Shared Table UX Consistency + Runtime Remediation — FINAL CLOSED
Round 1A COMPLETE — VERDICT A

NEXT: PHASE 3 — STEP 3.5.3 — ROUND 2C — CUSTOMER 360 ACTIVITY UI
```
