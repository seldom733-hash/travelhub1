# PHASE 3 — COMMAND CENTER
## STAGE B.2 — REMEDIATION
## RUNTIME AZN CURRENCY AUTHORITY CLOSURE

---

# LANGUAGE REQUIREMENT — MANDATORY

Все ответы разработчика, промежуточные выводы, финальный отчёт, объяснения причин дефектов,
описания исправлений, результаты тестирования, runtime/browser evidence, риски,
рекомендации и VERDICT должны быть предоставлены **НА РУССКОМ ЯЗЫКЕ**.

Названия файлов, классов, методов, API endpoints, DTO fields, database fields,
enum values, permissions, commit SHA, команды, код и технические идентификаторы
сохранять в оригинальном виде.

Технические термины допускается оставлять на английском там, где перевод ухудшает точность.

**Финальный отчёт — обязательно на русском языке.**

---

# 1. STATUS

Предыдущий Stage B.2 сообщил:

```text
VERDICT A — STAGE B.2 COMPLETE
```

Однако runtime/UI-проверка после завершения этапа показала, что пользователь по-прежнему видит
доллары (`$`) в PLATFORM Command Center, включая как минимум:

```text
Command Center
├ Сводные показатели → monetary KPIs still render $
└ Финансы            → monetary KPIs still render $
```

Следовательно предыдущий `VERDICT A` **не подтверждён фактическим runtime behavior**.

Текущий статус считать:

```text
STAGE B.2
→ RUNTIME ACCEPTANCE FAILED
→ REMEDIATION REQUIRED
```

Этот этап должен найти реальную причину расхождения между test/report evidence и пользовательским runtime
и довести PLATFORM Command Center до принятой AZN currency authority.

---

# 2. AUTHORITATIVE BUSINESS DECISION — DO NOT REOPEN

Уже принято и является обязательным:

```text
PLATFORM REPORTING CURRENCY = AZN
```

Также:

```text
STOREFRONT BILLING CURRENCY = AZN
Premium Storefront current LIST PRICE = ₼199/month
```

Это не предложение и не предпочтение.

Это canonical architecture authority.

Для агрегированных monetary KPI PLATFORM management surfaces целевая reporting currency:

```text
AZN
```

---

# 3. CRITICAL DISTINCTION

Недопустимо считать задачу решённой только потому, что:

```text
frontend default "USD" removed
```

или:

```text
KpiCard reads value.currency
```

или:

```text
primaryCurrencyTotal() prefers AZN
```

Наш контракт НЕ:

```text
prefer AZN where convenient
```

Наш контракт:

```text
PLATFORM REPORTING CURRENCY = AZN
```

`prefers AZN` и `authoritative AZN reporting currency` — разные вещи.

Нужно установить, почему backend/API/runtime всё ещё приводит UI к `$`.

---

# 4. DO NOT COSMETICALLY REPLACE `$` WITH `₼`

Строго запрещено решать проблему так:

```text
"$" → "₼"
```

без проверки underlying monetary semantics.

Нужно доказать:

```text
value
currency
source
aggregation
normalization
DTO
formatter
rendered symbol
```

Если число реально является USD amount, нельзя просто вывести его как AZN.

Если число уже является AZN, но metadata/formatter ошибочно говорит `USD`, исправить metadata/contract.

Если агрегат содержит смешанные валюты, остановиться и вернуть blocker либо реализовать только уже предусмотренную canonical normalization.

Не строить спекулятивный FX engine без необходимости.

---

# 5. PRIMARY OBJECTIVE

После remediation реальный PLATFORM Command Center должен соответствовать:

```text
PLATFORM Reporting Currency = AZN
```

для всех агрегированных monetary KPI.

Минимально обязательно проверить:

```text
Executive / Сводные показатели
Financial / Финансы
```

Но remediation НЕ ограничивается этими двумя секциями.

Нужно проверить все секции Command Center.

---

# 6. FULL COMMAND CENTER CURRENCY AUDIT

Проверить все 8 granular sections:

```text
1. Executive
2. Operational
3. Financial
4. Marketplace
5. Catalog
6. Channels
7. Attention
8. Insights
```

Для каждой monetary metric определить:

```text
metric name
backend source
underlying currency
aggregation behavior
DTO currency
frontend currency
rendered symbol
target currency
status
```

Вернуть матрицу:

| Section | KPI | Source currency | API currency | Rendered currency | Target | Status |
|---|---|---|---|---|---|---|

Нефинансовые KPI помечать `N/A`.

---

# 7. TRACE REAL RUNTIME PATH

Не ограничиваться чтением кода.

Для каждого проблемного KPI пройти:

```text
DB/source rows
→ repository/query
→ service calculation
→ aggregation helper
→ DTO
→ HTTP response
→ frontend API mapping
→ component props
→ formatter
→ rendered DOM
```

Особенно проверить:

```text
primaryCurrencyTotal()
KpiCard
SectionGrid
CommandCenter
dashboard-api
analytics.service
dashboard.service
workspace types
currency formatters
```

Использовать реальные текущие имена/пути из HEAD.

---

# 8. SEARCH FOR USD / DOLLAR FALLBACKS

Выполнить repository-wide audit минимум по:

```text
USD
$
priceUsd
currency: 'USD'
currency: "USD"
currency ?? 'USD'
currency || 'USD'
defaultCurrency
formatCurrency
Intl.NumberFormat
primaryCurrencyTotal
currencySymbol
```

Также искать:

```text
en-US
style: 'currency'
style: "currency"
```

и любые helper/fallback, способные привести к `$`.

Не считать каждое найденное `USD` ошибкой.

Классифицировать каждое релевантное совпадение:

```text
VALID
STALE
RUNTIME BUG
TECHNICAL DEBT
STAGE I
UNRELATED
```

---

# 9. EXECUTIVE — REQUIRED RUNTIME ACCEPTANCE

Проверить реальный PLATFORM Command Center → Executive / Сводные показатели.

После исправления monetary cards должны использовать AZN.

Например:

```text
GMV
₼2 274
```

а не:

```text
GMV
2 274 $
```

или:

```text
$2,274
```

Также проверить текущие B.2 semantic corrections:

```text
Revenue → Payment Volume / approved localized equivalent
Net Revenue → Refunds / approved localized equivalent
```

Не допустить regression обратно к ложным:

```text
Выручка
Чистая выручка
```

для прежних payment-volume formulas.

---

# 10. FINANCIAL — REQUIRED RUNTIME ACCEPTANCE

Проверить реальный PLATFORM Command Center → Financial / Финансы.

Все агрегированные monetary KPI должны использовать AZN reporting currency.

Нужно установить:

```text
почему Financial всё ещё показывает $
```

и исправить root cause.

Не исправлять только Executive.

Если Financial использует отдельный formatter, DTO, helper или legacy analytics path — исправить его отдельно.

---

# 11. OTHER SECTIONS — REQUIRED

Проверить monetary KPI в:

```text
Operational
Marketplace
Catalog
Channels
Attention
Insights
```

Примеры потенциальных денежных значений:

```text
GMV
refund amount
payment amount
commission
revenue
revenue at risk
opportunity value
potential value
affected GMV
subscription value
```

Все PLATFORM aggregated monetary values должны соответствовать AZN authority.

Если конкретная metric является original transaction amount и намеренно показывается в transaction currency,
это должно быть явно доказано как исключение и визуально обозначено.

По умолчанию management aggregate → AZN.

---

# 12. BACKEND DTO AUTHORITY

Frontend не должен угадывать reporting currency.

Для агрегированных PLATFORM KPI backend contract должен быть однозначным.

Проверить:

```text
currency metadata
Money DTO
KPI DTO
section DTO
comparison DTO
```

Если backend возвращает:

```json
{
  "value": 2274,
  "currency": "USD"
}
```

для canonical AZN aggregate, frontend не виноват — исправить backend authority.

Если backend вообще не возвращает currency и frontend fallback выбирает USD — исправить contract/fallback.

Предпочтительно:

```text
backend explicitly returns AZN
```

для PLATFORM aggregated monetary KPI.

---

# 13. `primaryCurrencyTotal()` AUDIT

Предыдущий B.2 report сообщил:

```text
primaryCurrencyTotal() prefers AZN
```

Это требует отдельной проверки.

Ответить:

```text
Что именно делает primaryCurrencyTotal()?
Что происходит, если AZN отсутствует?
Что происходит при mixed currencies?
Почему runtime всё ещё получает USD?
Используется ли helper всеми секциями?
Есть ли альтернативные aggregation paths?
```

Если helper:

```text
prefers AZN, otherwise returns first/other currency
```

это может нарушать canonical reporting authority.

Не менять поведение вслепую.

Сначала установить реальные source-currency guarantees.

---

# 14. MIXED-CURRENCY DATA

Если в текущей DB существуют monetary rows в нескольких валютах, определить:

```text
какие таблицы
какие business domains
какие текущие seed/test/runtime records
```

Нельзя:

```text
100 AZN + 100 USD = 200 AZN
```

или эквивалент.

Если текущая PLATFORM aggregate должна поддерживать mixed transaction currencies, но FX normalization ещё не существует,
вернуть:

```text
VERDICT C — BLOCKED
```

для конкретной aggregate, если truthful AZN result невозможно получить.

Но не использовать этот blocker, если все реальные source values уже AZN и проблема только в stale metadata/formatter.

---

# 15. STOREFRONT `priceUsd`

B.1 уже классифицировал:

```text
priceUsd
→ technical debt
→ Stage I migration
```

Canonical business decision:

```text
Premium Storefront current LIST PRICE = ₼199/month
```

Не выполнять широкую Stage I migration в этом remediation без необходимости.

Однако:

- `priceUsd` не должен заставлять PLATFORM Command Center показывать `$`;
- `priceUsd` не должен использоваться как доказательство collected Storefront Revenue;
- нельзя silently reinterpret `priceUsd` as AZN.

Если текущая Command Center metric зависит от этого поля, показать точный путь и выбрать безопасное временное решение,
совместимое с Stage I.

---

# 16. STOREFRONT REVENUE LIMITATION REMAINS

Не создавать fake Storefront Revenue.

По B.1:

```text
Storefront Collected Revenue = NOT PROVABLE
```

пока нет billing/payment foundation.

Поэтому исправление валюты не должно превратить:

```text
$199 list price
```

в:

```text
₼199 collected revenue
```

только потому, что символ теперь AZN.

List Price remains:

```text
LIST PRICE
```

not:

```text
COLLECTED REVENUE
```

---

# 17. COMPARISON VALUES

Проверить currency contract для:

```text
current value
previous value
delta
comparison %
```

Если current и previous monetary amounts имеют разные currency semantics,
comparison недостоверен.

Для percentage comparison требуется like-for-like:

```text
same metric
same business scope
same reporting currency
same period semantics
```

Исправление symbol не должно оставить скрытый cross-currency comparison.

---

# 18. FORMATTER AUTHORITY

Проверить все currency formatting paths.

В частности:

```text
Intl.NumberFormat
toLocaleString
custom formatCurrency()
KpiCard formatter
chart tooltip formatter
table formatter
section formatter
```

Для AZN допустим project-consistent output, например:

```text
₼2,274
2 274 ₼
AZN 2,274
```

но весь PLATFORM Command Center должен быть последовательным.

Выбрать существующий canonical UI convention, если он уже есть.

Не смешивать:

```text
₼2,274
2 274 AZN
2 274 ₼
```

без причины.

---

# 19. CHARTS / TOOLTIPS / SECONDARY VALUES

Не ограничиваться крупными KPI cards.

Проверить:

```text
chart axes
chart tooltips
secondary values
comparison tooltips
breakdowns
section subtitles
empty-state examples
detail drawers
```

если они присутствуют в текущем Command Center.

Не должно быть ситуации:

```text
card = ₼
tooltip = $
```

---

# 20. I18N

Проверить RU / AZ / EN.

Currency symbol может быть одинаковым:

```text
₼
```

но текстовые labels должны оставаться локализованными.

Сохранить B.2 semantic corrections.

Не допустить raw i18n keys.

---

# 21. CACHE / STALE BUILD / RUNTIME ENVIRONMENT

Так как automated tests сообщили PASS, а реальный UI остался `$`, обязательно проверить не только код, но и runtime delivery.

Проверить:

```text
frontend dev/prod process
Next.js cache
browser cache
service worker if any
stale container/image
Docker compose service
wrong branch/worktree
wrong commit
API endpoint actually used by browser
NEXT_PUBLIC/API base URL
Vercel/deployment if applicable to tested runtime
```

Установить:

```text
какой exact commit реально обслуживает UI
какой exact backend endpoint реально вызывается
```

Не предполагать автоматически, что проблема только в source code.

---

# 22. NETWORK RESPONSE EVIDENCE

В browser/runtime evidence показать фактический API response для Executive и Financial.

Минимально:

```text
request URL
HTTP status
relevant KPI JSON
currency field
```

Секреты/токены не включать в отчёт.

Нужно доказать:

```text
API → AZN
UI  → ₼
```

для исправленных aggregates.

---

# 23. BROWSER RUNTIME ACCEPTANCE — MANDATORY

Это ключевой gate.

Stage нельзя закрыть только unit/integration tests.

Запустить реальный доступный stack и проверить страницу в браузере.

Минимум:

```text
1. открыть PLATFORM Command Center;
2. дождаться загрузки реальных API data;
3. проверить Executive;
4. проверить Financial;
5. проверить остальные sections с monetary KPI;
6. убедиться, что `$` отсутствует там, где должен быть AZN;
7. проверить semantic labels из B.2;
8. сохранить browser/runtime evidence.
```

Если browser tooling доступен — использовать его.

Если screenshot tooling доступен — приложить screenshot evidence.

Если автоматический browser unavailable, использовать максимально близкий реальный runtime validation и явно указать limitation.

Но без доказательства реального rendered output `VERDICT A` запрещён.

---

# 24. REQUIRED SCREENSHOT / RENDER EVIDENCE

Для `VERDICT A` предоставить evidence минимум для:

```text
Executive / Сводные показатели
Financial / Финансы
```

На evidence должны быть видны:

```text
monetary values
₼ / AZN presentation
correct semantic labels
```

Если одна screenshot охватывает обе секции — достаточно.

Если нет — предоставить две.

Не считать source-code screenshot runtime evidence.

---

# 25. DOM / TEXT ASSERTION

Добавить runtime/E2E assertion, где возможно:

```text
PLATFORM Command Center rendered monetary KPI
contains AZN/₼
does not contain unexpected "$"
```

Не делать глобальное:

```text
page must contain zero "$"
```

если `$` может легитимно появляться в unrelated literal/debug content.

Assertion должен быть scoped к monetary KPI elements/sections.

---

# 26. BACKEND TESTS

Добавить/обновить tests минимум для:

```text
Executive aggregate currency = AZN
Financial aggregate currency = AZN
Marketplace monetary aggregate currency = AZN where applicable
partial payment semantics preserved
Storefront Commerce excluded from Marketplace GMV
false Revenue semantics do not return
```

Если отдельные sections используют общий helper, проверить helper и representative consumers.

---

# 27. FRONTEND TESTS

Добавить/обновить tests минимум для:

```text
KpiCard renders ₼ for AZN
KpiCard does not default to USD
Executive renders AZN
Financial renders AZN
backend currency metadata is honored correctly
no stale false Revenue/Net Revenue labels
RU labels
AZ labels
EN labels
```

Но frontend unit tests не заменяют browser/runtime gate.

---

# 28. E2E TEST — REQUIRED IF INFRASTRUCTURE SUPPORTS IT

Добавить Command Center E2E/browser regression, проверяющий реальные section responses/rendering.

Минимум:

```text
Executive → AZN
Financial → AZN
```

Если текущий E2E слой backend-only, добавить соответствующие API assertions и отдельно runtime UI evidence.

---

# 29. RBAC REGRESSION

Stage A remains authoritative.

Не ослаблять granular permissions:

```text
dashboard.executive.read
dashboard.operational.read
dashboard.financial.read
dashboard.marketplace.read
dashboard.catalog.read
dashboard.channels.read
dashboard.attention.read
dashboard.insights.read
```

Currency remediation не должна возвращать generic section access.

---

# 30. DECISION SIGNAL REGRESSION

Stage B remains complete.

Не менять без необходимости:

```text
DecisionSignal
fingerprint
lifecycle
RBAC category filtering
PendingBookingsDetector
```

Если monetary evidence отображается в Attention/Insights, привести presentation currency к AZN без изменения Decision Signal foundation semantics.

---

# 31. NO BROAD STAGE H IMPLEMENTATION

Не использовать этот remediation для полного redesign Executive/Financial.

Не реализовывать:

```text
full Revenue Mix
full Expected/Collected/Outstanding Revenue UI
full Financial tabs
WHY
IMPACT
ACTION
Decision Queue
```

если это не требуется непосредственно для устранения currency defect.

Stage H остаётся отдельным downstream stage.

---

# 32. NO STAGE I BILLING IMPLEMENTATION

Не строить:

```text
billing engine
invoice ledger
discount engine
Storefront payment collection
subscription refund engine
```

Stage I остаётся отдельным downstream stage.

---

# 33. REQUIRED DELIVERABLE A — ROOT CAUSE

Отчёт должен на русском языке дать точный ответ:

```text
Почему после Stage B.2 пользователь всё ещё видел `$`?
```

Не общими словами.

Указать:

```text
exact file(s)
exact function(s)
exact API field(s)
exact runtime/deployment cause
```

если применимо.

---

# 34. REQUIRED DELIVERABLE B — BEFORE / AFTER

Вернуть:

| Section | KPI | Before API currency | Before UI | After API currency | After UI |
|---|---|---|---|---|---|

Минимум:

```text
Executive GMV
Executive Payment Volume
Executive Refunds
Financial monetary KPIs
Marketplace monetary KPIs
other affected monetary KPIs
```

---

# 35. REQUIRED DELIVERABLE C — FULL CURRENCY MATRIX

Вернуть матрицу всех 8 sections:

| Section | Monetary KPI | Source | Underlying currency | Reporting currency | Rendered | Status |
|---|---|---|---|---|---|---|

Это обязательный deliverable даже если часть секций не содержит monetary KPI.

---

# 36. REQUIRED DELIVERABLE D — USD SEARCH AUDIT

Вернуть список релевантных найденных:

```text
USD
$
priceUsd
USD fallbacks
currency formatters
```

с классификацией:

```text
VALID
FIXED
STAGE I DEBT
UNRELATED
```

---

# 37. REQUIRED DELIVERABLE E — RUNTIME EVIDENCE

Вернуть:

```text
Runtime commit SHA:
Backend commit SHA:
Frontend commit SHA:
Browser URL/environment:
Executive API currency:
Financial API currency:
Executive rendered currency:
Financial rendered currency:
Unexpected `$` in PLATFORM monetary KPI: YES/NO
```

Приложить screenshot/browser evidence references.

---

# 38. REQUIRED DELIVERABLE F — FILES CHANGED

Перечислить все изменённые файлы.

Не писать неверное количество.

Формат:

```text
Total changed files: N

Backend: N
Frontend: N
Tests: N
Docs: N
Migrations: N
```

Если файл относится к двум категориям, не дублировать его в total count.

---

# 39. REQUIRED DELIVERABLE G — TEST RESULTS

На русском языке вернуть фактические результаты:

```text
Backend dashboard unit:
Backend analytics unit:
Command Center E2E:
RBAC E2E:
Decision Signal tests:
Backend full unit:
Backend TSC:
Backend build:
Frontend Vitest:
Frontend TSC:
Frontend build:
Browser/runtime acceptance:
DB migrations:
```

Указывать реальные counts.

---

# 40. ROADMAP UPDATE

Обновить canonical roadmap additive history:

```text
Stage B.2
→ previous implementation reported VERDICT A
→ runtime acceptance failed
→ Stage B.2 Remediation required
```

После успешного remediation:

```text
Stage B.2 Remediation
→ VERDICT A
→ runtime AZN authority proven
```

Не стирать предыдущую историю и не переписывать её так, будто первого B.2 не было.

---

# 41. REPORT

Создать:

```text
docs/prompts/PHASE_3_STAGE_B2_REMEDIATION_RUNTIME_AZN_CURRENCY_AUTHORITY_CLOSURE_REPORT.md
```

Отчёт — **на русском языке**.

Technical identifiers/code may remain English.

---

# 42. ACCEPTANCE INVARIANTS

Для закрытия должны выполняться:

```text
1. PLATFORM Reporting Currency = AZN.

2. Executive aggregated monetary KPI render AZN/₼.

3. Financial aggregated monetary KPI render AZN/₼.

4. Other PLATFORM Command Center monetary aggregates render AZN/₼
   unless a documented legitimate original-currency exception exists.

5. Backend DTO currency agrees with rendered currency.

6. No cosmetic relabeling of real USD amounts as AZN.

7. No mixed-currency arithmetic without normalization.

8. B.2 semantic corrections remain intact.

9. Storefront list price is not misrepresented as collected revenue.

10. Browser/runtime evidence confirms actual rendered output.

11. Automated tests pass.

12. RBAC remains intact.

13. Decision Signal foundation remains intact.
```

---

# 43. VERDICT

Вернуть ровно один verdict.

## VERDICT A — STAGE B.2 REMEDIATION COMPLETE

Только если:

- реальный runtime PLATFORM Command Center показывает AZN/₼ для Executive monetary KPI;
- реальный runtime Financial показывает AZN/₼;
- остальные monetary sections audited;
- backend/API currency authority соответствует AZN;
- нет косметического relabeling USD→AZN;
- mixed-currency arithmetic отсутствует либо корректно обработана;
- semantic corrections B.2 сохранены;
- browser/runtime evidence предоставлен;
- tests/builds green;
- roadmap обновлён;
- отчёт предоставлен на русском языке.

## VERDICT B — REMEDIATION STILL REQUIRED

Если код частично исправлен, но runtime/UI, sections, tests, semantics или evidence ещё не соответствуют требованиям.

## VERDICT C — BLOCKED

Если реальные source data mixed-currency и truthful AZN aggregation требует отсутствующей prerequisite capability.

Указать точный blocker и минимальный prerequisite.

---

# 44. STOP

После завершения:

**STOP.**

Не переходить автоматически к:

```text
Stage C
Stage H
Stage I
full Financial redesign
billing implementation
WHY
IMPACT
ACTION
```

Вернуть remediation report на русском языке и ждать review.
