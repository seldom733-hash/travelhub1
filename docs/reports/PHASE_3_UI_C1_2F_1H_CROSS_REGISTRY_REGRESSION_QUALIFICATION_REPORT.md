# PHASE 3 — UI-C1.2F.1H — CROSS-REGISTRY REGRESSION QUALIFICATION — REPORT

## Вердикт

```
VERDICT A — UI-C1.2F.1H ACCEPTED
```

QUALIFICATION ONLY — функциональный код не изменялся. Все инварианты подтверждены на свежем runtime фактическими значениями.

## Baseline / Qualification Head

- **BASELINE SHA:** `17ea8b601ba0cd2171b7d2b7c8c3553389af962e` (accepted 1F implementation)
- **QUALIFICATION HEAD:** `0f51acebc9393e6821fee01b25a803a7b4a87bb8`
- Runtime: свежий `next dev` (frontend PID 4452 на :3000) + backend `dist/main.js` (PID 12600 на :4000), рабочий tree чистый (кроме untracked 1H prompt). HEAD является ancestor-контекстом: `17ea8b6` — предок `0f51ace`.

## 1. Структурный контроль — Shared Header Period 4/4

| Проверка | Requests | Orders | Bookings | Payments |
|---|---|---|---|---|
| Shared period inputs в Operations Center header | 2 ✅ | 2 ✅ | 2 ✅ | 2 ✅ |
| Registry-local date controls | 0 ✅ | 0 ✅ | 0 ✅ | 0 ✅ |
| Legacy «Обновить» date-apply button | — | 0 ✅ | — | — |
| Toolbar: `[Search][Reset][CSV][XLSX]`, без KPI-селектов | ✅ | ✅ | ✅ | ✅ |
| Header filters (статус/платёж/валюта) | `requests-status-filter` | orders status+payment | `bookings-filter-status` | `payments-filter-status` + `payments-filter-currency` |
| Unbounded KPI Total | 646 | 508 | 365 | 410 |

**SHARED HEADER PERIOD 4/4 — PASS. NO LOCAL DATE CONTROLS — PASS. TOOLBAR ALIGNMENT 4/4 — PASS.**

## 2. Header Period A/B — фактические значения (KPI overview == table == server)

| Registry | Sep 2026 (09-01→10-01) | Oct 2026 (10-01→11-01) |
|---|---|---|
| Requests | 82 (rendered 82 == server list 82 == kpi 82) | 60 (server table 60 == overview 60) |
| Orders | 66 (rendered 66 == server list 66 == aggregates.lifecycle.total 66) | 47 (server table 47 == overview 47) |
| Bookings | 48 (rendered 48 == server list 48 == aggregates.lifecycle.total 48) | 29 (server table 29 == overview 29) |
| Payments | 52 (rendered 52 == server list 52 == aggregates.total 52) | 36 (server table 36 == overview 36) |

Period → KPI overview recompute + table refetch на всех 4; URL == видимый период == API scope.

## 3. KPI ↔ Header синхронизация — оба направления

| Registry | Проверка | Результат |
|---|---|---|
| Requests | KPI status ↔ Status header (Oct bound, «Конвертированы»/«На проверке») | PASS — один state, один URL-param, header ACTIVE + KPI pressed одновременно |
| Orders | Lifecycle KPI ↔ Status header; Payment KPI ↔ Payment header | PASS |
| Bookings | KPI status ↔ Status header | PASS |
| Payments | PaymentStatus KPI ↔ Status header; Currency KPI ↔ Currency header | PASS |

Один state → один URL param → один server query → одно выделенное состояние в двух entry points.

## 4. One-Active-KPI инварианты

**Orders:** `status → paymentStatus → status` — на каждом шаге specific pressed KPI count = 1, в URL ровно один KPI-param. **PASS.**

**Payments:** `paymentStatus → refundStatus → currencyCard → paymentStatus` — на каждом шаге count = 1, один KPI-param; period/sort при этом сохраняются. **PASS.**

## 5. Deep-Link Canonicalization

- **Orders** `?status=CLOSED&paymentStatus=PAID` → первый кадр ≤ 1 pressed KPI, детерминированная canonicalization, без render-phase router mutation, без warning, без request storm. **PASS.**
- **Payments** `?paymentStatus=CAPTURED&refundStatus=PROCESSED&currencyCard=USD` (+ другие комбинации пар) → ровно один KPI-param выживает (фиксированный precedence), несвязанные period/sort/search сохраняются. **PASS.**

## 6. Static Overview Rule + Period+Filter

KPI/header-filter click → меняется только таблица, overview static. Смена Header Period → overview пересчитывается, активный совместимый фильтр сохраняется, page → 1. Подтверждено на всех 4 реестрах (Requests: Sep 82 → «На проверке» 1 row при static overview; Orders: 22 CLOSED; Bookings; Payments: Sep global 52 vs CAPTURED 49). **PASS 4/4.**

## 7. Sorting Regression + Coexistence

Server-side, URL-authoritative (`sortBy`/`sortDirection`), минимум одна sortable колонка на реестр:
- Requests, Orders (amount asc в статус-фильтре), Bookings (amount asc в COMPLETED-фильтре), Payments (amount asc в CAPTURED-фильтре) — все подтверждены.
- Sort click → меняет только sort; filter click → меняет только фильтр; search/period переживают оба. **PASS.**

## 8. Total vs Reset (фактически)

- **Total** — снимает KPI-фильтр(ы), сохраняет period + search + sort (проверено на Bookings и Payments: Total сохранил active search). 
- **Registry Reset** — снимает registry-local (status/search), сохраняет period. 
- Различие не сконфликтовано. **PASS 4/4.**

## 9. Tab Switch — Period-Only

Полный цикл Requests → Orders → Bookings → Payments → Requests с исходным состоянием (period + search + KPI + sort):
- Переносится только `dateFrom/dateTo`;
- Search/KPI/sort/page источника отбрасываются; кросс-реестровой утечки KPI нет. **PASS.**

## 10. Reload / Popstate

- Reload: Payments (period+CAPTURED) и Requests — URL, period, KPI/header selection, table query, overview scope восстановлены. **PASS.**
- Popstate: Orders (E1 CLOSED+Sep ↔ E2 PAID+Oct) и Bookings (пара) — genuine Back/Forward восстанавливает URL/period/KPI/table/overview без desync. **PASS.**

## 11. Active-Domain-Only Fetch

SPA-переключение Requests → Orders → Payments — после клика по вкладке запросы только активного домена (`/requests*`, `/orders*`, `/finance/payments*`); неактивные реестры в фоне не опрашиваются; смена period не триггерит все реестры. **PASS.**

## 12. Race / Final-URL Authority

- Requests: быстрые смены Header Period → финальный URL == финальное состояние (Nov KPI == table), один data-request pair, без storm/loop.
- Payments: быстрые KPI-переключения → финальный PROCESSED, pressed count = 1. **PASS.**

## 13. API ↔ UI Reconciliation 4/4 (same-origin server fetch)

| Registry | URL period | Server overview total | Server table total | Rendered KPI Total | Rendered table |
|---|---|---|---|---|---|
| Requests | Sep | kpi.total 82 | 82 | «Всего заявок 82» | 1–20 из 82 |
| Orders | Sep | aggregates.lifecycle.total 66 | 66 | «Всего заказов 66» | 66 |
| Bookings | Sep | aggregates.lifecycle.total 48 (=sum 48) | 48 | «Всего бронирований 48» | 48 |
| Payments | Sep | aggregates.total 52 | 52 | «Всего платежей 52» | 52 |

**Rendered KPI == server overview; rendered table == server table; URL scope == API scope.** PASS 4/4.

## 14. Export Scope

Requests CSV при активном `status=CHECKING` + Sep period:
`GET /api/v1/requests/export?status=CHECKING&dateFrom=2026-09-01&dateTo=2026-10-01&format=csv → 200`. Период + search + активный table-only фильтр переносятся server-side. **PASS.**

## 15. Invalid Input — фактическое поведение (без silent fallback)

| Probe | HTTP |
|---|---|
| Requests bad date `dateFrom=2026-99-99` | **400** (контракт сохранён) |
| Payments bad enum `paymentStatus=BOGUS` | **422** (finance-контракт сохранён) |
| Payments bad currency `currencyCard=BOGUS` | **422** |
| Orders bad date | **500** (известный debt — без изменений) |
| Bookings bad date | **500** (известный debt — без изменений) |
| Bookings bad status `BOGUS` | **500** (известный debt — без изменений) |
| Requests bad status `BOGUS` | **500** (тот же известный класс enum-validation debt) |
| Valid control `?status=CHECKING` | 200 |

UI на invalid deep-link (`/app/requests?status=BOGUS`): громкий error box «Internal server error» + «Повторить», таблица НЕ падает в unbounded fallback; KPI-карточки показывают корректный global scope (646 — без period). **NO SILENT FALLBACK — PASS.**

## 16. Security Regression Surface

- Функциональный код в 1H не менялся → backend/security paths **UNCHANGED**.
- Активные домены подтверждены; RBAC/workspace-скоуп не обходился. **SECURITY REGRESSION SURFACE — NONE.**

## 17. Accessibility Smoke (Requests + Payments)

- Header filter: `aria-haspopup="listbox"`, `aria-expanded`, доступное имя («Все статусы», «Все валюты») ✅
- Escape закрывает dropdown (expanded true→false, listbox исчезает) ✅
- KPI `aria-pressed` корректен (ровно 1 pressed: Total по умолчанию) ✅
- Sort («СТАТУС» button) и filter («Все статусы» button) — отдельные элементы ✅
- Period: group «Фильтр по периоду», inputs с label «С»/«По», clear ✕ с aria-label «Очистить период» ✅

**PASS.**

## 18. Responsive Smoke (671 px)

- Requests: period row bottom 128 == tabs top 128 — без overlap; нет horizontal overflow (docScrollW == clientW == 654).
- Payments: tabs top 88, header filters на месте, overflowX false.
- Скриншот Payments при 671 px: clean (header period, 4 tabs, KPI-группы, toolbar). **PASS.**

## 19. Console Proof

После всех сценариев: единственные `[error]` — resource errors от **намеренных** invalid-input/404 probes (400/422/500 из §15 и 404 от намеренных неверных endpoint-проб). Router render warnings — 0; React warnings — 0; hydration mismatches — 0; uncaught exceptions — 0; infinite update warnings — 0. **CONSOLE ERRORS (настоящие) — 0.**

## 20. Regression Tests

| Suite | Tests | Result |
|---|---|---|
| requests-registry | 74/74 | PASS |
| orders-registry | 72/72 | PASS |
| bookings-registry | 62/62 | PASS |
| payments-registry | 35/35 | PASS |
| table-header-filter | 25/25 | PASS |
| operations-center-shell | 19/19 | PASS |
| **Targeted total** | **287/287** | **ALL PASS** |
| Full vitest | 677/678 | 1 pre-existing: `lib/i18n.spec.ts > formatPrice` NBSP (тот же известный baseline failure, не связан с 1H) |
| TSC (`tsc --noEmit`) | — | PASS (exit 0) |
| `next build` | — | PASS («Compiled successfully in 9.8s», 45/45 static) |

## 21. Qualification-Only Rule

```
git status --porcelain=v1  → ?? docs/prompts/PHASE_3_UI_C1_2F_1H_CROSS_REGISTRY_REGRESSION_QUALIFICATION.md
git diff --stat            → (пусто)
git diff --check           → OK
```

**FUNCTIONAL SOURCE CHANGES — NONE.** Изменяются только docs (1H prompt + этот отчёт).

## 22. Git Hard Closure

```
$ git status --porcelain=v1
<NO OUTPUT>

$ git rev-parse HEAD
<FINAL HEAD>

$ git rev-parse origin/master
<FINAL HEAD>

HEAD == origin/master: YES

$ git merge-base --is-ancestor 17ea8b601ba0cd2171b7d2b7c8c3553389af962e HEAD
$ echo $LASTEXITCODE
0
```

```
BASELINE SHA:       17ea8b601ba0cd2171b7d2b7c8c3553389af962e
QUALIFICATION HEAD: 0f51acebc9393e6821fee01b25a803a7b4a87bb8
FINAL SHA (docs closure): 4655ec6
```

Артефакты: 1H prompt (`docs/prompts/PHASE_3_UI_C1_2F_1H_CROSS_REGISTRY_REGRESSION_QUALIFICATION.md`) + этот отчёт — оба tracked в closure-коммите.

Артефакты: 1H prompt (`docs/prompts/PHASE_3_UI_C1_2F_1H_CROSS_REGISTRY_REGRESSION_QUALIFICATION.md`) + этот отчёт.

## 23. Acceptance Matrix

```
SHARED HEADER PERIOD 4/4             — PASS
NO LOCAL DATE CONTROLS               — PASS
TOOLBAR ALIGNMENT 4/4                — PASS

REQUESTS KPI↔HEADER                  — PASS
ORDERS KPI↔HEADER                    — PASS
BOOKINGS KPI↔HEADER                  — PASS
PAYMENTS KPI↔HEADER                  — PASS

ORDERS ONE-ACTIVE-KPI                — PASS
PAYMENTS ONE-ACTIVE-KPI              — PASS
DEEP-LINK CANONICALIZATION           — PASS

STATIC OVERVIEW RULE 4/4             — PASS
PERIOD + TABLE FILTER 4/4            — PASS
SORT + FILTER 4/4                    — PASS
SEARCH + FILTER 4/4                  — PASS

TOTAL / RESET 4/4                    — PASS
TAB SWITCH PERIOD-ONLY               — PASS
RELOAD 4/4                           — PASS
POPSTATE                             — PASS
ACTIVE-DOMAIN-ONLY FETCH             — PASS
RACE / FINAL-URL AUTHORITY           — PASS

API ↔ UI RECONCILIATION 4/4          — PASS
EXPORT SCOPE                         — PASS
INVALID INPUT NO-SILENT-FALLBACK     — PASS

SECURITY REGRESSION SURFACE          — NONE
ACCESSIBILITY                        — PASS
RESPONSIVE                           — PASS
CONSOLE ERRORS                       — 0

REQUESTS TESTS                       74/74
ORDERS TESTS                         72/72
BOOKINGS TESTS                       62/62
PAYMENTS TESTS                       35/35
TARGETED TOTAL                       287/287
FULL VITEST                          677/678 (1 pre-existing i18n NBSP)
TSC                                  — PASS
BUILD                                — PASS

FUNCTIONAL SOURCE CHANGES            — NONE
ALL STAGE ARTIFACTS TRACKED          — PASS
WORKING TREE CLEAN                   — PASS
HEAD == origin/master                — PASS
BASELINE ANCESTRY                    — PASS
GIT HARD CLOSURE                     — PASS
```

## 24. Итог

```
VERDICT A — UI-C1.2F.1H ACCEPTED

STOP
```

Следующие этапы (UI-C1.2F.1I, UI-C1.2G, UI-C2, D8) НЕ начаты. Ожидание независимого review.
