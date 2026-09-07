# PHASE 3 --- UI-C1.2G --- KPI Semantic Grouping / Lifecycle Flow

## Stage Report

**Project:** TravelHub\
**Repository:** `https://github.com/seldom733-hash/travelhub1`\
**Stage:** `UI-C1.2G`\
**Baseline:** `a481048966c7ac788f8381069715d1b61032921f`\
**Current qualification status:** **BLOCKED / NOT QUALIFIED**\
**Qualification blocker:** отсутствие рабочего доступа к реальному
hydrated browser DOM

------------------------------------------------------------------------

## 1. Назначение Stage

UI-C1.2G предназначен для семантической организации уже существующих
KPI-карточек Operations Center и визуального представления
lifecycle/exception/payment flow.

Stage **не должен изменять бизнес-логику**.

Запрещены: - изменение canonical status enum; - добавление или удаление
бизнес-статусов; - объединение нескольких canonical statuses в одну
KPI-card; - изменение формул и источника данных; - frontend-derived
business truth; - изменение URL/filter semantics; - изменение
server-side RBAC или tenant isolation; - необоснованные изменения
API/domain/schema.

> **semantic grouping ≠ new business logic**

Каждый фактический canonical status должен продолжать иметь собственную
видимую KPI-card.

------------------------------------------------------------------------

## 2. Область Stage

UI-C1.2G охватывает четыре registry Operations Center:

1.  Requests
2.  Orders
3.  Bookings
4.  Payments

Цель --- представить существующие KPI в понятных семантических
группах: - lifecycle; - exceptions / attention; - payment; - refund; -
currency.

Группировка должна соответствовать фактическим state machines и
canonical enums, а не просто порядку значений enum.

------------------------------------------------------------------------

## 3. Canonical KPI Semantics

### 3.1 Requests

**Lifecycle** - NEW - CHECKING - PRICE_CHANGED - CUSTOMER_ACCEPTED -
CONFIRMED - CONVERTED

**Exceptions / completion** - SUPPLIER_TIMEOUT -
CUSTOMER_PAYMENT_TIMEOUT - REJECTED - UNAVAILABLE - EXPIRED -
CANCELLED_BY_CUSTOMER

Всего: **12 statuses**.

`Total` существует отдельно и не является status-card.

### 3.2 Orders

**Lifecycle** - NEW - IN_PROCESSING - WAITING_FOR_DATA -
READY_FOR_BOOKING - SENT_TO_BOOKING - PARTIALLY_FULFILLED - FULFILLED -
READY_TO_CLOSE - CLOSED

**Exceptions** - CANCELLED - PROBLEM - SUSPENDED

**Payment** - UNPAID - PARTIALLY_PAID - PAID - REFUNDED

Сохраняется правило:

> Order status XOR paymentStatus

### 3.3 Bookings

**Lifecycle** - NEW - PREPARING_REQUEST - SENT_TO_SUPPLIER -
AWAITING_CONFIRMATION - CONFIRMED - IN_SERVICE - COMPLETED

**Attention / change** - NEEDS_CLARIFICATION - CHANGE_REQUESTED -
CANCELLATION_REQUESTED

**Negative / exception** - SUPPLIER_REJECTED - CANCELLED - PROBLEM

Всего: **13 canonical Booking statuses**.

`PARTIALLY_CONFIRMED` не существует и не должен появляться в UI.

### 3.4 Payments

**Payment Status** - PENDING - AUTHORIZED - CAPTURED - FAILED -
CANCELLED - REFUNDED

**Refund Status** - REQUESTED - APPROVED - PROCESSED - FAILED

Currency --- динамическая server-authoritative dimension.

Payment Status и Refund Status являются разными измерениями.

------------------------------------------------------------------------

## 4. Inherited Interaction Contract

### KPI

KPI cards являются статическим overview.

Нажатие KPI: - выбирает одну KPI-card; - фильтрует table; - не
пересчитывает остальные KPI относительно выбранной KPI; - не превращает
KPI в каскадный filter.

Допускается только **одна active KPI**.

### Total

`Total`: - очищает active KPI; - очищает registry-level KPI/table-only
dimension; - сохраняет Header Period; - возвращает полную таблицу в
рамках оставшегося global scope.

### Header Period

Header Period является глобальным для registry и влияет одновременно на
KPI и table.

Period state должен сохраняться через URL и быть восстановим после
reload/popstate.

### KPI ↔ Header Filter

KPI и соответствующий header filter должны представлять одно и то же
URL-authoritative state.

Например:

`paymentStatus=PAID`

имеет одинаковую семантику независимо от способа установки.

------------------------------------------------------------------------

## 5. Обнаруженный дефект Requests и исправление

Во время runtime-подготовки backend возвращал корректные KPI counts и
canonical status keys, но UI отображал все 12 Requests statuses плоской
сеткой под одним заголовком `Статусы заявок`.

То есть backend/kernel был корректен, но semantic grouping не была
подтверждена в UI.

### Исправление

В `frontend/lib/i18n.tsx` добавлены: - `requests.group.lifecycle` -
`requests.group.exceptions`

с локализациями RU/AZ/EN.

В `frontend/app/app/requests/page.tsx` добавлены явные: -
`REQUEST_LIFECYCLE_STATUSES` - `REQUEST_EXCEPTION_STATUSES`

Lifecycle group рендерит 6 statuses.

Exception group рендерит 6 statuses.

`Total` остаётся отдельным элементом.

Table status filter продолжает покрывать все 12 canonical Requests
statuses.

------------------------------------------------------------------------

## 6. Backend / Kernel Verification

### Authentication

Проверен canonical endpoint:

`POST /api/v1/auth/login`

Успешный login возвращает accessToken, user и HttpOnly `travelhub.auth`
cookie.

`GET /api/v1/auth/session` успешно возвращает authenticated ADMIN user.

### Requests KPI

Проверен:

`GET /api/v1/requests/kpi`

Результат: - HTTP 200; - `total = 646`; - присутствуют все 12 canonical
Requests status keys.

  Group        Status                         Count
  ------------ -------------------------- ---------
  Lifecycle    NEW                               26
  Lifecycle    CHECKING                          22
  Lifecycle    PRICE_CHANGED                     29
  Lifecycle    CUSTOMER_ACCEPTED                  0
  Lifecycle    CONFIRMED                          1
  Lifecycle    CONVERTED                        391
  Exceptions   SUPPLIER_TIMEOUT                  38
  Exceptions   CUSTOMER_PAYMENT_TIMEOUT          28
  Exceptions   REJECTED                          62
  Exceptions   UNAVAILABLE                       49
  Exceptions   EXPIRED                            0
  Exceptions   CANCELLED_BY_CUSTOMER              0
  **Total**    **TOTAL**                    **646**

Lifecycle subtotal: **469**

Exception subtotal: **177**

469 + 177 = **646**

Backend/kernel полностью согласуется с canonical Requests status
registry.

------------------------------------------------------------------------

## 7. Runtime UI Verification

Для PASS требовалась проверка непосредственно в реальном браузере после
hydration:

1.  открыть `/app/requests`;
2.  пройти authentication;
3.  проверить фактический DOM;
4.  подтвердить две semantic groups;
5.  подтвердить 6 + 6 status cards;
6.  подтвердить Total;
7.  проверить значения cards;
8.  проверить KPI click → table filter;
9.  проверить Header Period;
10. проверить URL state;
11. проверить reload/popstate;
12. проверить responsive/accessibility/i18n;
13. затем продолжить Orders → Bookings → Payments.

### Фактический результат

Authentication и backend API доступны.

Однако квалификация **реального hydrated DOM не выполнена**.

RSC payload, SSR output и serialized server data не являются DOM
evidence и не заменяют browser qualification.

Попытки получить browser execution через Chrome/CDP не дали рабочего
target, выполняющего JavaScript с доступным hydrated DOM.

В доступной среде не было рабочего: - Playwright; - Puppeteer; -
Cypress; - эквивалентного browser automation runner.

------------------------------------------------------------------------

## 8. Evidence Matrix

  -----------------------------------------------------------------------
  Gate                    Result                  Evidence
  ----------------------- ----------------------- -----------------------
  Repository baseline     PASS                    baseline SHA установлен

  Auth                    PASS                    login/session runtime
                                                  verified

  Requests KPI API        PASS                    HTTP 200, 646 total, 12
                                                  canonical statuses

  Requests grouping       PASS structurally       explicit 6+6 grouping
  source implementation                           arrays

  Requests i18n grouping  PASS structurally       RU/AZ/EN keys added
  keys                                            

  Requests hydrated DOM   **BLOCKED**             no working browser
                                                  automation

  Requests visual         **NOT QUALIFIED**       DOM not observed
  grouping                                        

  KPI click behavior      NOT QUALIFIED           requires live DOM
                                                  interaction

  Header Period UI        NOT QUALIFIED           requires live DOM
  behavior                                        interaction

  URL/reload/popstate UI  NOT QUALIFIED           requires live browser
  behavior                                        

  Orders                  NOT STARTED             intentionally blocked
                                                  by Requests gate

  Bookings                NOT STARTED             intentionally blocked
                                                  by Requests gate

  Payments                NOT STARTED             intentionally blocked
                                                  by Requests gate

  Full G regression       NOT STARTED             stage not qualified

  Git hard closure        NOT DONE                no stage qualification
                                                  commit
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 9. Qualification Decision

# **UI-C1.2G --- BLOCKED / NOT QUALIFIED**

Это **не VERDICT B / FAIL**.

Причина --- не доказанный функциональный дефект текущей реализации, а
отсутствие необходимой инфраструктуры для получения authoritative
runtime DOM evidence.

Поэтому нельзя утверждать: - `PASS`; - `VERDICT A`; - что весь G
реализован и проверен; - что Orders/Bookings/Payments прошли runtime; -
что весь lifecycle visualization работает end-to-end.

Одновременно нельзя утверждать, что Requests definitively failed: source
correction и backend/kernel evidence положительные, но browser gate не
закрыт.

------------------------------------------------------------------------

## 10. Git State

На момент блокировки: - функциональный stage commit не выполнен; -
текущие Requests source changes не должны коммититься для создания
ложного qualification evidence; - Orders / Bookings / Payments не должны
начинаться; - UI-C1.2H не должен начинаться.

Предполагаемый controlled commit после допустимого runtime PASS:

``` bash
git add frontend/lib/i18n.tsx frontend/app/app/requests/page.tsx
git commit -m "fix: group request KPI statuses by lifecycle"
```

------------------------------------------------------------------------

## 11. Что запрещено делать сейчас

До получения рабочего browser automation runner запрещено:

1.  считать UI-C1.2G завершённым;
2.  объявлять VERDICT A;
3.  использовать RSC/SSR как замену DOM evidence;
4.  добавлять debug endpoints только для обхода blocker;
5.  менять backend/domain/schema без необходимости;
6.  продолжать Orders;
7.  продолжать Bookings;
8.  продолжать Payments;
9.  начинать UI-C1.2H;
10. делать Git hard closure с ложным PASS.

------------------------------------------------------------------------

## 12. Required Next Action

Необходим environment, в котором возможно выполнить реальный browser
runtime test.

Минимально подходит рабочий: - Playwright; - Puppeteer; - Cypress; -
либо другой runner, способный открыть authenticated `/app/requests`,
выполнить JavaScript и предоставить DOM evidence.

После появления runner необходимо повторить qualification с Requests:

1.  authenticate;
2.  open `/app/requests`;
3.  inspect hydrated DOM;
4.  verify semantic groups;
5.  verify all 12 cards;
6.  verify counts;
7.  verify Total;
8.  verify KPI/filter synchronization;
9.  verify Header Period;
10. verify URL/reload/popstate;
11. verify responsive/accessibility/i18n;
12. only then proceed to Orders;
13. then Bookings;
14. then Payments;
15. run full G regression;
16. only after all gates PASS perform Git hard closure.

------------------------------------------------------------------------

## 13. Final Stage Verdict

``` text
PHASE 3 — UI-C1.2G
KPI SEMANTIC GROUPING / LIFECYCLE FLOW

STATUS: BLOCKED / NOT QUALIFIED

Backend/kernel: PASS
Authentication: PASS
Requests source correction: PASS structurally
Requests hydrated DOM: BLOCKED
Orders: NOT STARTED
Bookings: NOT STARTED
Payments: NOT STARTED
Full G regression: NOT STARTED
Git hard closure: NOT DONE

REASON:
No working browser automation / hydrated DOM access.

NEXT:
Resume UI-C1.2G runtime qualification on a runner
with real browser DOM access.

DO NOT START UI-C1.2H.
```

------------------------------------------------------------------------

## 14. Closure Principle

The stage remains intentionally open.

The blocker is an infrastructure/runtime qualification limitation, not
evidence that the canonical TravelHub architecture or KPI semantics are
incorrect.

Authoritative completion requires:

> **Source correctness + backend/kernel correctness + real hydrated DOM
> runtime verification + regression + Git hard closure.**

Until all required gates are satisfied, UI-C1.2G must remain **NOT
QUALIFIED**.
