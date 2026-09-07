# PHASE 3 --- UI-C1.2G --- RUNTIME BLOCKER RESOLUTION / CONTINUATION PROMPT

## ROLE

Ты работаешь как senior implementation + QA engineer проекта TravelHub.

Текущий Stage:

**PHASE 3 --- UI-C1.2G --- KPI Semantic Grouping / Lifecycle Flow**

Текущий статус:

**BLOCKED / NOT QUALIFIED**

Baseline:

`a481048966c7ac788f8381069715d1b61032921f`

Главная причина blocker:

> Нет рабочего browser automation runner, позволяющего получить
> authoritative hydrated DOM evidence.

------------------------------------------------------------------------

# 1. ГЛАВНАЯ ЦЕЛЬ

Не объявлять UI-C1.2G завершённым.

Не переходить к UI-C1.2H.

Не подменять browser DOM проверку RSC/SSR/serialized payload.

Твоя задача --- сначала получить реальную browser runtime qualification
для `/app/requests`.

Если в текущем environment это невозможно, **STOP** и зафиксируй
инфраструктурный blocker.

------------------------------------------------------------------------

# 2. ЗАПРЕЩЕНО

Нельзя:

-   считать RSC payload доказательством DOM;
-   использовать SSR HTML как доказательство hydrated UI;
-   reverse-engineer React/RSC payload для имитации DOM;
-   добавлять debug endpoints только для обхода blocker;
-   создавать fake browser evidence;
-   менять backend/domain/schema без отдельной необходимости;
-   менять KPI business semantics;
-   менять canonical statuses;
-   объединять несколько canonical statuses в одну card;
-   удалять canonical status cards;
-   менять KPI formulas;
-   менять server-side source of truth;
-   менять URL/filter semantics;
-   продолжать Orders, Bookings или Payments без закрытия Requests gate;
-   начинать UI-C1.2H;
-   делать Git hard closure до полного PASS G.

------------------------------------------------------------------------

# 3. СНАЧАЛА ПРОВЕРЬ BROWSER CAPABILITY

Проверь наличие рабочего browser automation:

1.  Playwright
2.  Puppeteer
3.  Cypress
4.  работающий Chrome/Chromium CDP с JavaScript execution
5.  другой эквивалентный automation runner

Проверь не только наличие пакета, а возможность реально:

-   запустить browser;
-   открыть `http://localhost:3000`;
-   выполнить JavaScript;
-   получить `document`;
-   получить hydrated DOM;
-   сделать DOM assertions.

Если ни один вариант не работает:

**STOP.**

Не пытайся обходить blocker через RSC/SSR.

Отчёт должен прямо сказать:

``` text
UI-C1.2G remains BLOCKED / NOT QUALIFIED.

Reason:
No working browser automation / hydrated DOM access.

No source changes made for the blocker.
No Orders / Bookings / Payments qualification started.
No UI-C1.2H started.
```

------------------------------------------------------------------------

# 4. ЕСЛИ BROWSER RUNNER РАБОТАЕТ --- ПРОДОЛЖАЙ

## 4.1 Запусти актуальный runtime

Используй актуальный backend/frontend проекта.

Не подменяй runtime mock server.

Убедись, что frontend:

`http://localhost:3000`

backend:

`http://localhost:4000`

API:

`/api/v1`

------------------------------------------------------------------------

# 5. AUTHENTICATION

Используй canonical login:

`POST /api/v1/auth/login`

Не создавай новый auth flow.

Проверь authenticated session.

После login открой:

`/app/requests`

Проверяй именно браузерный hydrated DOM.

------------------------------------------------------------------------

# 6. REQUESTS --- ОСНОВНОЙ GATE

Проверь фактический DOM.

## Expected structure

### Total

`Total` должен быть отдельным overview element.

### Group 1 --- Lifecycle

Должны присутствовать ровно 6 cards:

-   NEW
-   CHECKING
-   PRICE_CHANGED
-   CUSTOMER_ACCEPTED
-   CONFIRMED
-   CONVERTED

### Group 2 --- Exceptions / completion

Должны присутствовать ровно 6 cards:

-   SUPPLIER_TIMEOUT
-   CUSTOMER_PAYMENT_TIMEOUT
-   REJECTED
-   UNAVAILABLE
-   EXPIRED
-   CANCELLED_BY_CUSTOMER

Итого:

**12 canonical status cards + Total**

------------------------------------------------------------------------

# 7. REQUESTS --- COUNTS

Backend canonical KPI:

`GET /api/v1/requests/kpi`

Expected:

  Status                       Count
  -------------------------- -------
  NEW                             26
  CHECKING                        22
  PRICE_CHANGED                   29
  CUSTOMER_ACCEPTED                0
  CONFIRMED                        1
  CONVERTED                      391
  SUPPLIER_TIMEOUT                38
  CUSTOMER_PAYMENT_TIMEOUT        28
  REJECTED                        62
  UNAVAILABLE                     49
  EXPIRED                          0
  CANCELLED_BY_CUSTOMER            0

Expected:

``` text
Lifecycle = 469
Exceptions = 177
Total = 646
```

Проверь, что UI показывает именно соответствующие значения.

------------------------------------------------------------------------

# 8. REQUESTS --- KPI INTERACTION

Для каждой KPI card проверь:

1.  card selectable;
2.  становится единственной active KPI;
3.  table фильтруется по соответствующему canonical status;
4.  остальные KPI counts остаются overview counts;
5.  нет каскадного пересчёта KPI;
6.  URL state соответствует выбранному filter;
7.  reload сохраняет state.

Проверить как минимум:

-   NEW
-   CONVERTED
-   SUPPLIER_TIMEOUT

------------------------------------------------------------------------

# 9. TOTAL

Нажми Total.

Проверить:

-   active KPI очищен;
-   registry KPI/table-only filter очищен;
-   Header Period сохраняется;
-   table возвращается к полному registry scope.

------------------------------------------------------------------------

# 10. HEADER PERIOD

Проверь Header Period.

Установи:

-   September 2026;
-   October 2026;
-   partial date range.

Проверить:

-   KPI меняются;
-   table меняется;
-   period является global;
-   нет отдельного local table date control;
-   period сохраняется в URL;
-   reload сохраняет period.

------------------------------------------------------------------------

# 11. URL / HISTORY

Проверить:

1.  KPI click;
2.  header filter;
3.  browser reload;
4.  browser back;
5.  browser forward;
6.  direct deep link.

KPI и header filter должны иметь одну canonical URL semantics.

Не должно существовать двух независимых representations одного filter
state.

------------------------------------------------------------------------

# 12. I18N / ACCESSIBILITY

Проверить Requests grouping headings в:

-   RU
-   AZ
-   EN

Ожидаемые semantic groups:

RU: - Жизненный цикл - Проблемы и завершения

AZ: - Sorğu addımı - Problemlər və nəticələr

EN: - Request lifecycle - Issues and completions

Проверить также:

-   keyboard focus;
-   keyboard activation;
-   visible focus;
-   semantic buttons/interactive elements;
-   accessible names;
-   отсутствие console errors.

------------------------------------------------------------------------

# 13. ЕСЛИ REQUESTS PASS

Только после полного Requests PASS продолжай:

``` text
Orders
↓
Bookings
↓
Payments
↓
Full G regression
↓
Git hard closure
```

Не перескакивай сразу к H.

------------------------------------------------------------------------

# 14. ORDERS

Сохраняй canonical semantics:

Lifecycle: - NEW - IN_PROCESSING - WAITING_FOR_DATA -
READY_FOR_BOOKING - SENT_TO_BOOKING - PARTIALLY_FULFILLED - FULFILLED -
READY_TO_CLOSE - CLOSED

Exceptions: - CANCELLED - PROBLEM - SUSPENDED

Payment: - UNPAID - PARTIALLY_PAID - PAID - REFUNDED

Не объединять status cards.

Сохранять:

> Order status XOR paymentStatus

Проверить semantic grouping, counts, KPI click, Header Period,
URL/reload/popstate, header filters, accessibility/i18n.

------------------------------------------------------------------------

# 15. BOOKINGS

Canonical statuses:

Lifecycle: - NEW - PREPARING_REQUEST - SENT_TO_SUPPLIER -
AWAITING_CONFIRMATION - CONFIRMED - IN_SERVICE - COMPLETED

Attention/change: - NEEDS_CLARIFICATION - CHANGE_REQUESTED -
CANCELLATION_REQUESTED

Negative/exception: - SUPPLIER_REJECTED - CANCELLED - PROBLEM

Всего:

**13 statuses**

Критически:

`PARTIALLY_CONFIRMED` НЕ существует.

Не добавлять его.

Проверить весь runtime contract.

------------------------------------------------------------------------

# 16. PAYMENTS

Payment Status:

-   PENDING
-   AUTHORIZED
-   CAPTURED
-   FAILED
-   CANCELLED
-   REFUNDED

Refund Status:

-   REQUESTED
-   APPROVED
-   PROCESSED
-   FAILED

Currency:

dynamic server-authoritative.

Сохранять разделение:

> Payment Status ≠ Refund Status

Проверить:

-   semantic grouping;
-   KPI;
-   currency cards;
-   refund KPI;
-   header filters;
-   URL;
-   reload/popstate;
-   server-side pagination/search;
-   accessibility;
-   i18n.

------------------------------------------------------------------------

# 17. FULL G REGRESSION

После Requests + Orders + Bookings + Payments выполнить cross-registry
regression.

Минимальная matrix:

  -------------------------------------------------------------------------------------------------------------
  Registry   Grouping   KPI        Header     Header     URL        Reload     Popstate   i18n       A11y
                                   Period     Filters                                                
  ---------- ---------- ---------- ---------- ---------- ---------- ---------- ---------- ---------- ----------
  Requests   required   required   required   required   required   required   required   required   required

  Orders     required   required   required   required   required   required   required   required   required

  Bookings   required   required   required   required   required   required   required   required   required

  Payments   required   required   required   required   required   required   required   required   required
  -------------------------------------------------------------------------------------------------------------

Дополнительно:

-   no console errors;
-   no hydration errors;
-   no unexpected API errors;
-   no frontend-derived business truth;
-   no cross-registry leakage;
-   no cross-tenant leakage;
-   no RBAC regression.

------------------------------------------------------------------------

# 18. GIT RULES

Не использовать:

``` bash
git add .
```

Для Requests source fix, если он квалифицирован:

``` bash
git add frontend/lib/i18n.tsx frontend/app/app/requests/page.tsx
git commit -m "fix: group request KPI statuses by lifecycle"
```

Но commit выполнять только согласно установленной процедуре
qualification.

После всех registry gates:

1.  inspect `git status`;
2.  inspect diff;
3.  verify only intended files;
4.  run tests;
5.  run TSC;
6.  run build;
7.  verify final HEAD;
8.  perform Git hard closure.

Не объявлять Git closure до полного G PASS.

------------------------------------------------------------------------

# 19. STOP CONDITIONS

Немедленно STOP при:

-   отсутствии browser automation;
-   невозможности получить hydrated DOM;
-   неожиданном backend/domain/schema change;
-   изменении canonical statuses;
-   появлении invented status;
-   нарушении KPI/filter semantics;
-   cross-tenant isolation issue;
-   RBAC issue;
-   hydration error;
-   console error, влияющем на функциональность;
-   расхождении API и UI counts.

При STOP не продолжать следующий registry.

------------------------------------------------------------------------

# 20. REQUIRED FINAL REPORT

После выполнения верни структурированный отчёт:

``` text
PHASE 3 — UI-C1.2G
KPI SEMANTIC GROUPING / LIFECYCLE FLOW

ENVIRONMENT
Browser runner:
Browser:
Frontend:
Backend:

REQUESTS
Source:
DOM:
Grouping:
Counts:
KPI interaction:
Total:
Header Period:
URL:
Reload:
Popstate:
i18n:
A11y:
Result:

ORDERS
Result:
Evidence:

BOOKINGS
Result:
Evidence:

PAYMENTS
Result:
Evidence:

FULL REGRESSION
Result:
Evidence:

GIT
Baseline:
Implementation commits:
Final HEAD:
Working tree:
Git hard closure:

FINAL VERDICT
PASS / BLOCKED / VERDICT B

NEXT STAGE
UI-C1.2H — only if G is fully PASS
```

------------------------------------------------------------------------

# 21. CRITICAL FINAL RULE

Не превращай отсутствие browser automation в функциональный FAIL.

Правильная классификация:

``` text
BLOCKED / NOT QUALIFIED
```

если отсутствует необходимый runtime evidence.

И только при реально наблюдаемом функциональном дефекте:

``` text
VERDICT B — VALID SYSTEM FAIL
```

Если все G gates реально проходят:

``` text
VERDICT A — READY / ACCEPTED
```

**До полного PASS UI-C1.2G UI-C1.2H НЕ НАЧИНАТЬ.**
