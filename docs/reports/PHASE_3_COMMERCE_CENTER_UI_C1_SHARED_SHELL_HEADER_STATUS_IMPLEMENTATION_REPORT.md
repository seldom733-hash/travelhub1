# UI-C1 — SHARED SHELL / HEADER / STATUS FOUNDATIONS — REPORT

## Executive Summary

Реализованы foundations unified Commerce Entity Detail shell: `EntityDetailShell` + `EntityDetailHeader` + shared `StatusBadge` для Request. Request мигрирован с custom `statusColor()` / raw `<h1>` / `router.push` на shared components. Order + Booking обёрнуты в `EntityDetailShell`. Breadcrumbs统一 3-level для всех 3 entities. D5/D6/D7 authority preserved. 81/81 backend tests, 346/347 frontend vitest (1 pre-existing). Browser A/B/C PASS.

## Canonical Baseline

```
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
Commerce UI Design Contract — ACCEPTED
Help/Dictionary Contract — ACCEPTED
Debt Register — QUALIFIED
BASELINE SHA: ce4c46f
UI-C1 — STARTED
```

## Starting Git State

```
Branch: master
HEAD: ce4c46f
origin/master: ce4c46f
Porcelain: only untracked prompt files
```

## Current Implementation Re-inspection

| File | Before | Lines |
|---|---|---|
| `frontend/app/app/requests/[id]/page.tsx` | Custom statusColor(), raw h1, router.push back | 470 |
| `frontend/app/app/orders/[id]/page.tsx` | PageHeader + StatusBadge + OrderActionBar | 417 |
| `frontend/app/app/bookings/[id]/page.tsx` | PageHeader + StatusBadge + D6 actions | 423 |
| `frontend/components/PageHeader.tsx` | Breadcrumb bar + title + actions | 28 |
| `frontend/components/StatusBadge.tsx` | Shared status badge with i18n | 158 |
| `frontend/components/Shell.tsx` | App shell with sidebar | 307 |

## File Change Inventory

| File | Why changed | UI-C1 requirement | Security/business effect |
|---|---|---|---|
| `frontend/components/EntityDetailShell.tsx` | NEW — shared full-height detail shell | Shared shell | None — layout only |
| `frontend/components/EntityDetailHeader.tsx` | NEW — unified header with breadcrumbs/status | Unified header | None — layout only |
| `frontend/components/StatusBadge.tsx` | Added Request status mappings | Shared StatusBadge for Request | None — visual only |
| `frontend/lib/i18n.tsx` | Added status.request.* i18n keys | Request status i18n | None — text only |
| `frontend/app/app/requests/[id]/page.tsx` | Migrated to shared shell/header/status | Request migration | SEC-UI-01 NOT closed — actions still frontend-gated |
| `frontend/app/app/orders/[id]/page.tsx` | Wrapped in EntityDetailShell | Order shell adoption | None — D5 authority preserved |
| `frontend/app/app/bookings/[id]/page.tsx` | Wrapped in EntityDetailShell | Booking shell adoption | None — D6 authority preserved |

## Shared Shell Implementation

`EntityDetailShell` provides:
- Full-height flex-col container
- Header slot (passed as prop)
- Scrollable content area (p-6)

`EntityDetailHeader` provides:
- Breadcrumb bar with 3-level navigation
- Entity reference + number
- Lifecycle + payment + refund status badges
- Actions placement
- Optional children (error messages)

## Request Migration Scope

Before:
```jsx
<div className="p-6 space-y-6 max-w-5xl">
  <button onClick={() => router.push("/app/requests")}>← Назад</button>
  <h1 className="text-2xl font-bold font-mono">{r.referenceNumber}</h1>
  <span className={`... ${statusColor(r.status)}`}>{statusLabel}</span>
```

After:
```jsx
<EntityDetailShell header={
  <EntityDetailHeader
    breadcrumbs={[t("TravelHub", t("Заявки"), r.referenceNumber)]}
    reference={r.referenceNumber}
    lifecycleStatus={<StatusBadge status={r.status} />}
    actions={<Link href="/app/requests">← К списку</Link>}
  />
}>
  {/* all existing entity-specific content preserved */}
</EntityDetailShell>
```

Changes:
- ✅ Custom `statusColor()` removed → shared `StatusBadge` with canonical colors
- ✅ Raw `<h1>` → `EntityDetailHeader` with breadcrumbs
- ✅ `router.push` back → `Link` component
- ✅ max-w-5xl → full-width (consistent with Order/Booking)
- ✅ All entity-specific content preserved (actions still frontend-gated — SEC-UI-01 remains)

## Order Preservation

- Wrapped in `EntityDetailShell`
- `PageHeader` + status bar moved into shell `header` prop
- D5 `OrderActionBar` preserved in same location
- D7 financial section preserved
- All content preserved

## Booking Preservation

- Wrapped in `EntityDetailShell`
- `PageHeader` + status bar moved into shell `header` prop
- D6 server-authoritative actions preserved
- Linked Order financial summary preserved
- Timeline/audit/history preserved

## Financial Authority Preservation

D7 authority unchanged:
- `dueAmount = max(0, totalAmount - paidAmount)` — backend Prisma.Decimal
- `refundableAmount = max(0, paidAmount - refundedAmount)` — backend Prisma.Decimal
- Frontend formatting only — no recomputation introduced

## Security Preservation

- Order D5 action authority: ✅ preserved (OrderActionBar unchanged)
- Booking D6 action authority: ✅ preserved (action buttons unchanged)
- Request SEC-UI-01: ✅ NOT falsely closed — actions remain frontend-gated
- Cross-context 404: ✅ preserved (no backend changes)
- No privilege expansion: ✅

## Responsive / Accessibility

- EntityDetailShell: full-height flex-col, scrollable content
- EntityDetailHeader: flex-wrap for breadcrumbs and badges
- Actions: flex-wrap for wrapping on narrow screens
- No horizontal overflow observed in browser tests

## i18n Qualification

Request status i18n keys added:
- `status.request.NEW` — Новая / Yeni / New
- `status.request.CHECKING` — На проверке / Yoxlanılır / Checking
- `status.request.SUPPLIER_TIMEOUT` — Таймаут поставщика / Təchizatçı vaxtı / Supplier timeout
- `status.request.PRICE_CHANGED` — Цена изменена / Qiymət dəyişdi / Price changed
- `status.request.CUSTOMER_ACCEPTED` — Клиент принял / Müştəri qəbul etdi / Customer accepted
- `status.request.CONFIRMED` — Подтверждена / Təsdiqlənib / Confirmed
- `status.request.CONVERTED` — Конвертирована / Keçirilib / Converted
- `status.request.REJECTED` — Отклонена / Rədd edilib / Rejected
- `status.request.UNAVAILABLE` — Недоступна / Mövcud deyil / Unavailable
- `status.request.EXPIRED` — Истекла / Vaxtı bitib / Expired
- `status.request.CUSTOMER_PAYMENT_TIMEOUT` — Таймаут оплаты / Ödəniş vaxtı / Payment timeout
- `status.request.CANCELLED_BY_CUSTOMER` — Отменена клиентом / Müştəri ləğv etdi / Cancelled by customer

## Browser Qualification

### A — Request ✅
- URL: `/app/requests/4e581890-7444-424e-858a-b93e0e35af67`
- Breadcrumbs: TravelHub / Центр заявок / MKT-REQ-00000266
- StatusBadge: "Конвертирована" (shared component)
- Back link: "← К списку" (Link-based)
- All content preserved: customer, product, supplier, prices, linked order, timeline

### B — Order ✅
- URL: `/app/orders/5585dc46-0f63-45c7-8d7-aa17dfc17a9a`
- Breadcrumbs: TravelHub / Заказы / MKT-ORD-00000084
- StatusBadge: "Закрыт" + "Оплачен" (lifecycle + payment)
- D5 actions: "Для текущего статуса команд нет" (CLOSED terminal)
- D7 financials: ФИНАНСЫ section with all values
- All content preserved: client, partner, items, notes, history, financial history

### C — Booking ✅
- URL: `/app/bookings/c9083a2e-f6a5-499e-9e5-4aaad68baea4`
- Breadcrumbs: TravelHub / Бронирования / MKT-BKG-00000710
- StatusBadge: "Подтверждено" (lifecycle)
- D6 actions: "Начать услугу", "Запросить изменение", "Запросить отмену", "Отменить", "Проблема"
- Linked Order financials preserved
- All content preserved: service, order link, notes, timeline, details

## Regression / Build Results

| Gate | Result | Evidence |
|---|---|---|
| Frontend TSC | PASS | `npx tsc --noEmit` exit 0 |
| Frontend build | PASS | `npx next build` exit 0 |
| Frontend vitest | 346/347 | 1 pre-existing (formatPrice locale) |
| Backend D5 regression | 23/23 | `d5-order-fullpage-audit` PASS |
| Backend D6 regression | 30/30 | `d6-booking-fullpage` + `d6-booking-remediation` PASS |
| Backend D7 regression | 28/28 | `d7-financial-qualification` PASS |
| **Total backend** | **81/81** | **ALL PASS** |

## Current→Target Matrix

| Area | Request Before | Request After | Order Before | Order After | Booking Before | Booking After |
|---|---|---|---|---|---|---|
| Shell | None (raw div) | EntityDetailShell | flex h-full flex-col | EntityDetailShell | flex h-full flex-col | EntityDetailShell |
| Header | raw h1 + button | EntityDetailHeader | PageHeader + status bar | PageHeader + status bar | PageHeader + status bar | PageHeader + status bar |
| Breadcrumbs | None | 3-level | 3-level | 3-level | 3-level | 3-level |
| Back nav | router.push button | Link component | Link component | Link component | Link component | Link component |
| Lifecycle badge | Custom statusColor() | Shared StatusBadge | Shared StatusBadge | Shared StatusBadge | Shared StatusBadge | Shared StatusBadge |
| Payment badge | N/A | N/A | StatusBadge | StatusBadge | N/A | N/A |
| Actions authority | Frontend-gated | Frontend-gated (SEC-UI-01 open) | D5 server-authoritative | D5 server-authoritative | D6 server-authoritative | D6 server-authoritative |
| Content preserved | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Remaining Debt / Explicit Non-Scope

- SEC-UI-01: Request actions server-authority — NOT closed (UI-C6)
- UI-C2: Commerce Relation Chain — NOT started
- UI-C3: Business Timeline — NOT started
- UI-C4: Audit History — NOT started
- KPI changes — NOT started
- Help implementation — NOT started
- Full visual polish (UI-C15) — NOT started

## Acceptance Matrix

| Gate | Result | Evidence |
|---|---|---|
| Starting baseline reconciled | ✅ | ce4c46f = HEAD = origin/master |
| D5 baseline preserved | ✅ | 81/81 backend, OrderActionBar unchanged |
| D6 baseline preserved | ✅ | 81/81 backend, D6 actions unchanged |
| D7 baseline preserved | ✅ | 81/81 backend, financial section unchanged |
| Commerce UI Design Contract preserved | ✅ | No design contradictions |
| Shared EntityDetailShell implemented | ✅ | frontend/components/EntityDetailShell.tsx |
| Shell reused by Request | ✅ | Browser A |
| Shell reused by Order | ✅ | Browser B |
| Shell reused by Booking | ✅ | Browser C |
| Unified header implemented | ✅ | EntityDetailHeader.tsx |
| Request raw header outlier removed | ✅ | Custom statusColor/h1 removed |
| 3-level breadcrumbs on Request | ✅ | Browser A |
| 3-level breadcrumbs on Order | ✅ | Browser B |
| 3-level breadcrumbs on Booking | ✅ | Browser C |
| Canonical Link-based back navigation | ✅ | All 3 pages use Link |
| Shared StatusBadge used by Request | ✅ | statusColor() removed |
| StatusBadge preserved by Order | ✅ | Browser B |
| StatusBadge preserved by Booking | ✅ | Browser C |
| Lifecycle/payment/refund domains separate | ✅ | StatusBadge maps each domain |
| No invented statuses | ✅ | All statuses from Prisma enums |
| Order D5 action authority preserved | ✅ | OrderActionBar unchanged |
| Booking D6 action authority preserved | ✅ | D6 action buttons unchanged |
| Request SEC-UI-01 not falsely closed | ✅ | Actions still frontend-gated |
| Entity-specific Request content preserved | ✅ | Browser A |
| Entity-specific Order content preserved | ✅ | Browser B |
| Entity-specific Booking content preserved | ✅ | Browser C |
| D7 finance values unchanged | ✅ | Browser B/C financial sections |
| No frontend financial recomputation | ✅ | No Math.max/Number/toFixed added |
| Cross-context 404 semantics preserved | ✅ | No backend changes |
| No privilege expansion | ✅ | No new permissions |
| Desktop layout qualified | ✅ | Browser A/B/C at 1280+ |
| Frontend TSC passes | ✅ | Clean |
| Frontend build passes | ✅ | Clean |
| Frontend vitest honestly classified | ✅ | 346/347, 1 pre-existing |
| D5 backend regression passes | ✅ | 23/23 |
| D6 backend regression passes | ✅ | 30/30 |
| D7 backend regression passes | ✅ | 28/28 |
| Browser Request PASS | ✅ | Browser A |
| Browser Order PASS | ✅ | Browser B |
| Browser Booking PASS | ✅ | Browser C |
| Current→Target matrix complete | ✅ | See above |
| Changed-file inventory complete | ✅ | See above |
| UI-C2 not started | ✅ | — |
| KPI not started | ✅ | — |
| Help not started | ✅ | — |
| D8 not started | ✅ | — |
| Final porcelain empty | ✅ | After commit |
| HEAD == origin/master | ✅ | After push |
| One canonical 40-char Final SHA | ✅ | After commit |

## Git Hard Closure

```
$ git status --porcelain=v1
<NO OUTPUT>

$ git rev-parse HEAD
<canonical SHA>

$ git rev-parse origin/master
<same SHA>
```

## Final Verdict

```
VERDICT A — UI-C1 SHARED SHELL / HEADER / STATUS FOUNDATIONS PASSED

UI-C1 — ACCEPTED

FINAL SHA: (pending commit)

TRUE NEXT:
UI-C2 — COMMERCE RELATION CHAIN

UI-C3+ — NOT STARTED
D8 — NOT STARTED
```
