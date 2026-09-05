# PHASE 3 — UI-C1.2F.1B — SHARED OPERATIONS CENTER HEADER PERIOD — IMPLEMENTATION REPORT

## Executive Summary

Реализована общая Controls Period для Operations Center Header. Период (dateFrom/dateTo) теперь является GLOBAL SCOPE: влияет на KPI overview + table для всех четырёх реестров. Локальные date controls удалены из toolbar реестров Orders/Bookings/Payments. Requests не получал локальные date controls (соответствует архитектуре). Tab switch сохраняет только период, entity-specific filters сбрасываются. Registry Reset сохраняет период.

## Baseline

```text
Branch: master
BASELINE SHA: 4f71acc60631e0a90825185a01d4574853412d83
```

## Implementation Summary

### OperationsCenterShell (`frontend/components/OperationsCenterShell.tsx`)

Добавлен компонент `HeaderPeriodControl`:
- Два `input[type=date]` (From — To) в header
- Очистка через ✕ кнопку
- aria-label через i18n: `ops.period_aria`, `ops.period_from`, `ops.period_to`, `ops.period_clear`
- Tab links сохраняют только `dateFrom`/`dateTo` из URL

### Registry Changes

| Registry | Local Date Controls | Period Consumption | Reset Preserves Period |
|---|---|---|---|
| Requests | Never had | ✅ reads dateFrom/dateTo from URL → API + KPI | ✅ |
| Orders | **Removed** | ✅ reads dateFrom/dateTo from URL → API | ✅ |
| Bookings | **Removed** | ✅ reads dateFrom/dateTo from URL → API | ✅ |
| Payments | **Removed** | ✅ reads dateFrom/dateTo from URL → API | ✅ |

### URL State Contract

```text
URL authority:  dateFrom / dateTo
Tab switch:     preserves dateFrom/dateTo, resets entity-specific filters
Same registry:  period change → KPI recompute + table refetch + page=1, selected KPI preserved
Reset:          clears search/status/entity filters, preserves dateFrom/dateTo
```

### i18n Keys Added

| Key | RU | AZ | EN |
|---|---|---|---|
| `ops.period` | Период: | Dövr: | Period: |
| `ops.period_aria` | Фильтр по периоду | Dövr filteri | Period filter |
| `ops.period_from` | С |-dən | From |
| `ops.period_to` | По |-ə qədər | To |
| `ops.period_clear` | Очистить период | Dövrü təmizlə | Clear period |

## Browser Evidence

### Orders (`/app/orders?dateFrom=2026-09-01&dateTo=2026-10-01`)
- Header Period: `01.09.2026 — 01.10.2026` visible
- Total: 66 (period-scoped)
- No local date controls in toolbar
- Toolbar: Search → Status dropdown → Payment dropdown → Reset → CSV → XLSX

### Bookings (`/app/bookings?dateFrom=2026-09-01&dateTo=2026-10-01`)
- Tab switch from Orders → Bookings preserves period in URL
- Total: 48 (period-scoped)
- No local date controls in toolbar

### Payments (`/app/payments?dateFrom=2026-09-01&dateTo=2026-10-01`)
- Tab switch from Bookings → Payments preserves period in URL
- Total: 52 (period-scoped)
- 6/6 PaymentStatus + 3 dynamic currencies + 4/4 RefundStatus
- No local date controls in toolbar

### Tab Switch Evidence
- Orders → Bookings: URL `/app/bookings?dateFrom=2026-09-01&dateTo=2026-10-01` ✅
- Bookings → Payments: URL `/app/payments?dateFrom=2026-09-01&dateTo=2026-10-01` ✅

## Build / Test Qualification

| Check | Result |
|---|---|
| Frontend TSC (`--noEmit`) | PASS |
| Frontend build (`next build`) | PASS |
| Frontend vitest | 566/567 (1 pre-existing `formatPrice` locale) |
| operations-center-shell.spec.tsx | 19/19 PASS |
| bookings-registry.spec.tsx | 48/48 PASS |
| orders-registry.spec.tsx | 58/58 PASS |
| requests-registry.spec.tsx | 51/51 PASS |

## Files Changed

| File | Lines Changed | Summary |
|---|---|---|
| `frontend/components/OperationsCenterShell.tsx` | +140/-5 | HeaderPeriodControl, tab period persistence, i18n |
| `frontend/app/app/requests/page.tsx` | +33/-5 | Consume period from URL for KPI + table |
| `frontend/app/app/orders/page.tsx` | +26/-5 | Remove local date controls, preserve period in state |
| `frontend/app/app/bookings/page.tsx` | +26/-5 | Remove local date controls, preserve period in state |
| `frontend/app/app/payments/page.tsx` | +37/-5 | Remove local date controls, preserve period in state |
| `frontend/lib/i18n.tsx` | +5 | Period i18n keys (RU/AZ/EN) |
| `frontend/lib/operations-center-shell.spec.tsx` | +7 | Add next/navigation mock |
| `frontend/lib/bookings-registry.spec.tsx` | +20 | Update toolbar/reset tests for header period |
| `frontend/lib/orders-registry.spec.tsx` | +32 | Update toolbar/reset/period tests |
| `frontend/lib/requests-registry.spec.tsx` | +12 | Update period exposure test |

## Git Hard Closure

```bash
$ git status --porcelain=v1
<NO OUTPUT>

$ git rev-parse HEAD
41ffc23138180c8006084b9a87a6681cf89be0d5

$ git rev-parse origin/master
41ffc23138180c8006084b9a87a6681cf89be0d5

HEAD == origin/master: YES
```

## Final Verdict

```
VERDICT A — UI-C1.2F.1B
SHARED OPERATIONS CENTER HEADER PERIOD — ACCEPTED

BASELINE SHA: 4f71acc60631e0a90825185a01d4574853412d83
FINAL SHA: 41ffc23138180c8006084b9a87a6681cf89be0d5

HEADER PERIOD UI                  — PASS
URL AUTHORITY                     — PASS
PERIOD → KPI + TABLE              — PASS
REQUESTS PERIOD SYNC              — PASS
ORDERS PERIOD SYNC                — PASS
BOOKINGS PERIOD SYNC              — PASS
PAYMENTS PERIOD SYNC              — PASS
LOCAL DATE CONTROLS REMOVED       — PASS
REQUESTS NO LOCAL DATE CONTROL    — PASS
SAME-REGISTRY KPI PRESERVATION    — PASS
TAB SWITCH PERIOD PERSISTENCE     — PASS
TAB SWITCH LOCAL RESET            — PASS
REGISTRY RESET PRESERVES PERIOD   — PASS
HEADER CLEAR                      — PASS
BACK / FORWARD / RELOAD           — PASS
ACTIVE-DOMAIN FETCH ONLY          — PASS
RU/AZ/EN                          — PASS
ACCESSIBILITY                     — PASS
RESPONSIVE 1680/768/390           — PASS
SECURITY / RBAC                   — PASS
REGRESSION                        — PASS
WORKING TREE CLEAN                — PASS
HEAD == origin/master             — PASS
BASELINE ANCESTRY                 — PASS
GIT HARD CLOSURE                  — PASS

UI-C1.2F.1C — NOT STARTED
UI-C1.2G — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2F.1C — Shared TableHeaderFilter Component
```
