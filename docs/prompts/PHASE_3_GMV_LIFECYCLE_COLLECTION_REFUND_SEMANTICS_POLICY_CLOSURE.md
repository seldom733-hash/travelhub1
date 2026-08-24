# PHASE 3 — GMV LIFECYCLE, COLLECTION & REFUND SEMANTICS POLICY CLOSURE
## PRE-STAGE-E FINANCIAL SEMANTICS AUTHORITY GATE

# LANGUAGE REQUIREMENT — MANDATORY

Все ответы разработчика, audit findings, business-policy conclusions, таблицы, расчёты,
runtime evidence, результаты тестов, remediation notes и финальный отчёт должны быть
предоставлены **НА РУССКОМ ЯЗЫКЕ**.

Технические identifiers, Prisma models/fields, enums, endpoints, paths, SHA, commands и code
сохранять в оригинальном виде.

---

# 1. CONTEXT

Полный Command Center KPI & Financial Calculation Authority Audit установил:

```text
Current GMV
= SUM(Order.amount)
WHERE Order.status IN (FULFILLED, CLOSED)
Date authority = Order.createdAt
Period model = COHORT

Payment Volume
= SUM(Payment.amount)
WHERE Payment.status = CAPTURED
Date authority = Payment.paidAt
Period model = EVENT_PERIOD
```

DB/API/UI reconciliation подтвердил математическую корректность текущих вычислений.

Пример:

```text
GMV            = 80,476.69 AZN
Payment Volume = 102,067.07 AZN
```

`Payment Volume > current GMV` оказался возможен, поскольку часть платежей относится
к заказам, которые уже оплачены, но ещё находятся в:

```text
SENT_TO_BOOKING
IN_PROCESSING
PROBLEM
```

и поэтому не входят в текущий `FULFILLED/CLOSED GMV`.

Однако выявлена semantic/product проблема:

```text
"GMV"
```

сейчас фактически означает:

```text
Completed/Fulfilled GMV
```

а не полную стоимость квалифицирующего бизнеса.

Кроме того, TravelHub поддерживает:

```text
partial payments
full payments
refunds
partial refunds
outstanding balances
```

Поэтому перед Stage E необходимо закрыть canonical financial lifecycle.

---

# 2. OBJECTIVE

Определить и зафиксировать authoritative semantics минимум для:

```text
TOTAL / QUALIFIED GMV
COLLECTED GMV
REFUNDED AMOUNT
OUTSTANDING GMV
COMPLETED GMV
PAYMENT VOLUME
NET PAYMENT VOLUME
```

и их отношения.

Цель — чтобы Command Center отвечал отдельно на вопросы:

```text
Сколько бизнеса создано?
Сколько из него оплачено?
Сколько возвращено?
Сколько ещё ожидается к оплате?
Сколько бизнеса исполнено?
Сколько денег фактически поступило за период?
Сколько денег осталось после фактических возвратов?
```

---

# 3. IMPORTANT — THIS IS POLICY CLOSURE FIRST

Не менять production formulas до завершения audit actual domain model.

Сначала:

```text
schema
enums
order lifecycle
payment lifecycle
refund lifecycle
partial-payment semantics
cancellation semantics
commission semantics
```

Затем зафиксировать canonical definitions.

После policy closure разрешены только необходимые минимальные implementation changes,
tests, labels/tooltips и documentation.

Stage E автоматически НЕ запускать.

---

# 4. TARGET CONCEPTUAL MODEL

Предлагаемая модель:

```text
                     QUALIFIED GMV
                          │
              ┌───────────┼────────────┐
              │           │            │
              ↓           ↓            ↓
       NET COLLECTED   REFUNDED    OUTSTANDING
              │
              └──────────────┐
                             ↓
                       COMPLETED GMV
                  (separate fulfillment view)
```

При этом отдельно существует cash/event view:

```text
PAYMENT VOLUME
      │
      ├── PROCESSED REFUNDS
      ↓
NET PAYMENT VOLUME
```

`COHORT metrics` и `EVENT_PERIOD metrics` не смешивать.

---

# 5. GMV — CANONICAL QUESTION

GMV должен отвечать:

> Какова полная стоимость квалифицирующих заказов выбранной когорты?

Conceptual:

```text
GMV = SUM(qualified Order.amount)
```

GMV не должен автоматически означать только:

```text
FULFILLED + CLOSED
```

Exact qualifying statuses определить после lifecycle audit.

---

# 6. GMV AND REFUNDS — PROPOSED AUTHORITY

Базовая policy для проверки и фиксации:

```text
Processed Refund
DOES NOT directly subtract from historical/qualified GMV.
```

Причина:

```text
GMV = value of qualified business/order cohort
Refund = later money/reversal event
```

Нельзя превращать GMV в cash metric формулой:

```text
GMV - Refunds
```

без отдельной business reason.

---

# 7. IMPORTANT EXCEPTION — ORDER INVALIDATION

Если full refund одновременно означает, что заказ:

```text
cancelled
voided
rejected
fully reversed
```

и по canonical lifecycle он перестаёт считаться qualified business,
его исключение из GMV должно происходить через:

```text
Order lifecycle/status qualification policy
```

а НЕ через арифметическое:

```text
GMV = GMV - Refund.amount
```

Проверить actual model и определить policy.

---

# 8. ORDER STATUS AUDIT — MANDATORY

Получить actual `Order.status` enum.

Вернуть:

| Order status | Business meaning | Qualified GMV | Completed GMV | Notes |
|---|---|---:|---:|---|
| actual status | | YES/NO | YES/NO | |

Особенно проверить:

```text
SENT_TO_BOOKING
IN_PROCESSING
PROBLEM
FULFILLED
CLOSED
```

и все остальные actual statuses.

---

# 9. GMV QUALIFICATION MOMENT

Определить, когда Order становится экономически квалифицированным.

Проверить возможные candidates:

```text
created
confirmed
accepted
sent to booking
processing
partially paid
fully paid
fulfilled
closed
```

Не включать row в GMV только потому, что он существует.

---

# 10. GMV EXCLUSIONS

Определить handling всех actual states, соответствующих conceptual:

```text
draft
incomplete
cancelled
rejected
invalid
test/system
fully reversed
```

Не считать несостоявшийся business частью GMV без documented policy.

---

# 11. PROBLEM STATUS

Для `PROBLEM` отдельно определить:

```text
Does Order.amount remain in GMV?
Can collected payment remain in Collected GMV?
What happens after refund?
What happens after resolution?
```

Не принимать решение только ради визуально удобного invariant.

---

# 12. GMV DATE AUTHORITY

Current authority:

```text
Order.createdAt
```

Проверить, действительно ли это дата economic qualification.

Рассмотреть только existing fields:

```text
createdAt
confirmedAt
acceptedAt
other existing qualification timestamp
```

Если `createdAt` остаётся — объяснить почему.

Не добавлять новый field без доказанной необходимости.

---

# 13. COLLECTED GMV

Collected GMV отвечает:

> Какая часть GMV выбранной когорты была фактически оплачена?

Это **COHORT metric**.

Conceptual:

```text
1. select qualified GMV order cohort;
2. find eligible CAPTURED payments attributable to these orders;
3. account for processed refunds according to net/gross presentation policy;
4. aggregate for the same order cohort.
```

Не выбирать payments по `Payment.paidAt within selected period`,
иначе получится `Payment Volume`.

---

# 14. GROSS VS NET COLLECTED — MANDATORY DECISION

Не использовать неоднозначное слово `Collected` без policy.

Проверить необходимость двух concepts:

```text
Gross Collected GMV
= total eligible captured amount attributable to GMV cohort before refunds

Net Collected GMV
= Gross Collected GMV - processed refunds attributable to same cohort
```

Рекомендуемая Executive card semantics:

```text
Оплачено по GMV
→ NET Collected GMV
```

если это соответствует business interpretation "сколько фактически осталось оплачено".

Если выбран Gross — label должен явно говорить `Получено до возвратов`.

---

# 15. REFUNDED AMOUNT

Refunded Amount отвечает:

> Сколько фактически было возвращено клиентам?

Для factual monetary metric использовать только state,
который означает реально произведённый refund.

Проверить actual enum.

Conceptual:

```text
Refunded Amount
= SUM(processed/successful Refund.amount)
```

Не включать:

```text
REQUESTED
PENDING
FAILED
CANCELLED
```

как будто деньги уже возвращены.

---

# 16. REFUND REQUESTS VS ACTUAL REFUNDS

Разделить:

```text
Pending Refund Requests
→ operational / Decision Queue

Processed Refund Amount
→ financial metric
```

Не использовать pending refund request в:

```text
Net Collected
Net Payment Volume
```

до фактического возврата.

---

# 17. OUTSTANDING GMV — CRITICAL POLICY

Нельзя автоматически определять:

```text
Outstanding = GMV - Net Collected
```

потому что после refund возвращённая сумма не всегда снова становится долгом клиента.

Пример:

```text
GMV          1,000
Captured     1,000
Refunded       300
```

Возможны разные business meanings:

```text
A. 300 refunded and customer still owes 300
B. 300 refunded because obligation was reduced by 300
C. order partially cancelled/repriced
```

Поэтому Outstanding должен отражать **реально существующее обязательство клиента**,
а не математический остаток после refund.

---

# 18. OUTSTANDING AUTHORITY AUDIT

Определить actual source of truth для outstanding obligation.

Проверить:

```text
Order.amount
Order.paidAmount
payment allocations
booking/payment schedule
refund effect
order repricing
partial cancellation
existing balance fields
```

Вернуть exact formula.

Если current schema не позволяет доказать post-refund obligation:

```text
Outstanding after refund = NOT FULLY PROVABLE
```

и не фабриковать metric.

---

# 19. BASE PARTIAL PAYMENT CASE

Для обычной частичной оплаты без refund:

```text
GMV           1,000 AZN
Captured        400 AZN
Refunded          0 AZN
Outstanding     600 AZN
```

Должно выполняться:

```text
GMV = Collected + Outstanding
```

только для matched cohort и если нет release/refund adjustment.

---

# 20. FULL PAYMENT CASE

```text
GMV           1,000 AZN
Captured      1,000 AZN
Refunded          0 AZN
Outstanding       0 AZN
```

---

# 21. FULL PAYMENT + PARTIAL REFUND CASE

```text
GMV             1,000 AZN
Gross Collected 1,000 AZN
Refunded          300 AZN
Net Collected     700 AZN
```

Outstanding НЕ определять как `300` автоматически.

Нужно установить actual remaining customer obligation.

Если refund permanently releases 300:

```text
Outstanding = 0
Released/Refunded = 300
```

---

# 22. PARTIAL PAYMENT + REFUND CASE

Пример:

```text
GMV               1,000 AZN
Gross Collected     600 AZN
Refunded             100 AZN
Net Collected        500 AZN
```

Outstanding зависит от business obligation.

Если refund не меняет Order.amount/obligation:

```text
Outstanding may remain 400 or become 500 depending on canonical model.
```

Не угадывать.

Доказать actual behavior через domain code/schema.

---

# 23. OPTIONAL RELEASED / ADJUSTED AMOUNT

Если actual domain поддерживает reduction of customer obligation,
рассмотреть необходимость concept:

```text
Released / Adjusted Amount
```

Тогда возможна identity:

```text
Qualified GMV
=
Net Collected
+ Outstanding
+ Refunded/Released component
```

Но не создавать новый persisted field/model без необходимости.

Если concept нужен только для derived reporting — доказать formula.

---

# 24. COMPLETED GMV

Current old GMV semantics:

```text
SUM(Order.amount)
WHERE status IN (FULFILLED, CLOSED)
```

проверить как candidate:

```text
Completed GMV
```

Completed GMV отвечает:

> Какая стоимость квалифицирующих заказов уже исполнена/закрыта?

Проверить exact statuses.

---

# 25. COMPLETED GMV AND REFUNDS

Определить policy:

Если completed order позже частично refunded:

```text
Does historical Completed GMV remain unchanged?
```

Рекомендуемая conceptual separation:

```text
Completed GMV = fulfillment value
Refunded Amount = financial reversal
```

Но если full refund приводит к invalidation/reversal of completed order,
status policy может изменить Completed GMV.

Доказать actual business rule.

---

# 26. PAYMENT VOLUME

Payment Volume остаётся **EVENT_PERIOD** metric:

```text
SUM(Payment.amount)
WHERE status = CAPTURED
AND Payment.paidAt within selected period
```

Отвечает:

> Сколько платежей фактически поступило в выбранном периоде?

Может включать платежи по заказам предыдущих периодов.

Поэтому:

```text
Payment Volume
≠ Collected GMV
```

и:

```text
Payment Volume may exceed same-period GMV
```

---

# 27. NET PAYMENT VOLUME

Если metric нужен/уже существует:

```text
Net Payment Volume
= Payment Volume
- processed refunds occurring in the same EVENT_PERIOD
```

Только при совместимых:

```text
payment event date
refund processed event date
business scope
currency
```

Не вычитать pending refund requests.

---

# 28. COHORT VS EVENT-PERIOD — CANONICAL SEPARATION

Зафиксировать:

| Metric | Model |
|---|---|
| GMV | COHORT |
| Gross/Net Collected GMV | COHORT |
| Outstanding GMV | COHORT |
| Completed GMV | COHORT / fulfillment cohort — prove exact semantics |
| Payment Volume | EVENT_PERIOD |
| Refunded Amount | EVENT_PERIOD when used as cash-flow card; cohort variant may also exist |
| Net Payment Volume | EVENT_PERIOD |

Если Refund card в Executive должна быть cohort-based, это отдельное решение.
Не смешивать два вида Refund metric под одним label.

---

# 29. EXECUTIVE CARD MODEL — TARGET

Проверить feasibility следующей структуры:

```text
GMV
Полная стоимость квалифицирующих заказов

Оплачено по GMV
Net/Gross Collected GMV — выбрать policy

Остаток к оплате
Outstanding GMV

Возвращено
Processed Refunded Amount

Completed GMV
Исполненная стоимость заказов

Объём платежей
Фактически полученные платежи за период

Net Payment Volume
Платежи за период минус фактические возвраты
```

Не обязательно выводить все 7 карточек в одной строке.

UX layout определить минимально, без редизайна всего Command Center.

---

# 30. AVOID DUPLICATE CARDS WITHOUT DISTINCT QUESTIONS

Каждая card должна отвечать на уникальный вопрос.

Запрещено создавать:

```text
GMV
Paid GMV
Payment Volume
```

если пользователь не может понять разницу.

Labels/tooltips/subtitles должны объяснять:

```text
cohort
vs
cash/event period
```

---

# 31. RECOMMENDED USER-FACING LABELS — RU

Предварительно:

```text
GMV
Оплачено по GMV
Остаток к оплате
Возвращено
Исполненный GMV
Объём платежей
Чистый объём платежей
```

Exact labels утвердить после semantics audit.

---

# 32. TOOLTIP REQUIREMENT

Пример conceptual:

```text
GMV:
"Полная стоимость квалифицирующих заказов выбранного периода."

Оплачено по GMV:
"Фактически оплаченная часть заказов, входящих в GMV выбранного периода."

Остаток к оплате:
"Сумма действующих обязательств по заказам, входящим в GMV."

Объём платежей:
"Фактически полученные платежи за период, включая оплаты заказов предыдущих периодов."

Возвращено:
"Фактически возвращённые клиентам средства."
```

Добавить RU/AZ/EN.

Не использовать tooltip как замену неправильной formula.

---

# 33. REFUND EFFECT ON MARKETPLACE COMMISSION

Сохранять принятую policy:

```text
Customer refund
→ proportional Marketplace Commission reversal

Full refund
→ full applicable commission reversal

Partial refund
→ proportional applicable commission reversal

Non-refundable TravelHub fees
→ separate future revenue stream

Storefront SaaS
→ not governed by Marketplace refund commission policy
```

---

# 34. COMMISSION REVERSAL IMPLEMENTATION CHECK

Проверить actual HEAD:

```text
Commission reversal implemented: YES/NO
```

Если NO:

- не реализовывать Stage 2.14.x автоматически;
- не заявлять post-refund Net Marketplace Revenue как fully authoritative;
- зафиксировать limitation.

---

# 35. STOREFRONT SEPARATION

Новая GMV lifecycle model не должна смешивать:

```text
Marketplace GMV
Storefront Commerce GMV
Storefront SaaS subscription economics
```

Для PLATFORM Executive определить, какой GMV показывается.

По умолчанию current architecture authority должна быть сохранена:

```text
TravelHub Marketplace business
≠ partner-owned Storefront Commerce
```

Если aggregate view существует — только через явное channel separation.

---

# 36. CURRENCY

Все PLATFORM monetary cards:

```text
AZN
₼
```

Не возвращать USD/$.

Не делать cosmetic relabel multi-currency amounts.

Если FX conversion отсутствует, cross-currency aggregation должна быть отдельно квалифицирована.

---

# 37. REFUND CURRENCY

Проверить, что refund и original payment/order currency совместимы.

Не вычитать refund другой валюты из AZN aggregate без authoritative FX conversion.

---

# 38. PARTIAL PAYMENT SOURCE OF TRUTH

Определить, что authoritative:

```text
SUM(CAPTURED Payment.amount)
Order.paidAmount
payment schedule
other field
```

Если `Order.paidAmount` является cached/derived field,
проверить consistency с Payment rows.

Не использовать два conflicting sources.

---

# 39. REFUND SOURCE OF TRUTH

Определить authoritative factual refunded amount:

```text
Refund.amount
Payment status REFUNDED
Order refunded field
other
```

Не double count refund одновременно из Payment и Refund tables.

---

# 40. DOUBLE-COUNT / FAN-OUT AUDIT

Особенно проверить queries:

```text
Order
JOIN Payment
JOIN Refund
```

Несколько payments + несколько refunds не должны умножать `Order.amount`.

Использовать independent reconciliation.

---

# 41. STATUS MATRIX — REQUIRED

Вернуть actual:

| Domain | Status | GMV | Collected GMV | Outstanding | Completed GMV | Payment Volume | Refunds |
|---|---|---:|---:|---:|---:|---:|---:|

Использовать только actual enums.

---

# 42. DATE AUTHORITY MATRIX — REQUIRED

| Metric | Date authority | Period model | Reason |
|---|---|---|---|
| GMV | | COHORT | |
| Collected GMV | GMV cohort date | COHORT | |
| Outstanding | GMV cohort date / snapshot | | |
| Completed GMV | | | |
| Payment Volume | Payment.paidAt | EVENT_PERIOD | |
| Refunded Amount | | EVENT_PERIOD / COHORT variant | |
| Net Payment Volume | event dates | EVENT_PERIOD | |

---

# 43. REFUND TIMING CASE

Обязательно проверить:

```text
Order created in January
Payment captured in January
Refund processed in March
```

Показать, как этот transaction влияет на:

```text
January GMV
January Collected GMV
March Payment Volume
March Refunds
March Net Payment Volume
Outstanding
Completed GMV
```

---

# 44. PRIOR-PERIOD PAYMENT CASE

Проверить:

```text
Order created in January
Payment captured in February
```

Доказать:

```text
January GMV includes order
January Collected GMV behavior according to cohort/as-of policy
February Payment Volume includes payment
```

Критически важно решить:

Collected GMV является:

```text
A. lifetime/as-of-now collection against selected cohort
B. collection only up to selected period end
```

Выбрать canonical semantics.

---

# 45. COLLECTED GMV AS-OF POLICY — MANDATORY

Рекомендуется рассмотреть:

```text
Collected GMV for Jan cohort as of Jan 31
```

vs:

```text
Collected GMV for Jan cohort as of today
```

Это принципиально разные metrics.

Для historical period comparisons предпочтительно deterministic historical snapshot semantics:

```text
payments/refunds up to selected period end
```

если current data model позволяет.

Не допустить, чтобы January historical card менялась в August из-за поздней оплаты без явного design.

---

# 46. OUTSTANDING AS-OF POLICY

Аналогично определить:

```text
Outstanding at period end
```

или:

```text
Current outstanding for historical cohort
```

Для period comparison предпочтительно явно зафиксировать один вариант.

---

# 47. COMPLETED GMV DATE POLICY

Если order создан в January, а fulfilled в March:

при `Order.createdAt` cohort semantics он может попасть в January Completed GMV только
если metric рассматривает current status of Jan cohort.

Это может переписывать history.

Проверить необходимость:

```text
completion event date
```

для Completed GMV.

Не использовать `createdAt` автоматически.

---

# 48. HISTORICAL STABILITY

Для каждой metric ответить:

```text
Can historical value change later?
YES/NO
WHY
```

Особенно:

```text
Collected GMV
Outstanding
Completed GMV
Refund-adjusted metrics
```

Stage E должен получать predictable inputs.

---

# 49. COMPARISON SEMANTICS

Для:

```text
↑ X%
↓ X%
```

current и previous period должны использовать одну и ту же metric definition,
date authority и as-of policy.

Не сравнивать:

```text
current lifetime-collected cohort
vs
previous period-end snapshot
```

---

# 50. REQUIRED SAMPLE RECONCILIATIONS

Выбрать минимум 7 real demo transactions:

```text
1. fully paid
2. partially paid
3. unpaid
4. fully paid + partial refund
5. partial payment + refund
6. full refund
7. prior-period order paid later
```

Для каждого вернуть:

```text
Order ID
Order amount
Order status
Order dates
Payments
Payment statuses/dates
Refunds
Refund statuses/dates
Commission
GMV contribution
Collected GMV contribution
Outstanding contribution
Completed GMV contribution
Payment Volume contribution
Refund contribution
Net Payment Volume contribution
```

---

# 51. DB → API → UI RECONCILIATION

После implementation для новых/renamed cards:

| Metric | DB expected | API actual | UI actual | Result |
|---|---:|---:|---:|---|
| GMV | | | | |
| Collected GMV | | | | |
| Outstanding GMV | | | | |
| Refunded Amount | | | | |
| Completed GMV | | | | |
| Payment Volume | | | | |
| Net Payment Volume | | | | |

Допустимо `NOT IMPLEMENTED/NOT PROVABLE` только если policy closure обосновывает это.

---

# 52. UI STRUCTURE

Не делать большой redesign.

Если Executive section уже перегружена, допускается:

```text
Primary row:
GMV
Оплачено по GMV
Остаток к оплате
Completed GMV

Cash row / Financial section:
Payment Volume
Refunds
Net Payment Volume
```

Выбрать placement по current architecture.

Не дублировать одинаковые numbers в нескольких sections без purpose.

---

# 53. FINANCIAL SECTION RELATIONSHIP

Executive должен давать executive snapshot.

Financial section может давать deeper breakdown:

```text
Gross Collected
Refunds
Net Collected
Outstanding
Commission
Commission Reversal
Net Commission
```

только где data provable.

Не превращать Executive в полный ledger.

---

# 54. AOV CONSEQUENCE

Если canonical GMV formula изменяется,
перепроверить:

```text
AOV = GMV / qualifying Orders
```

Numerator и denominator должны использовать один и тот же cohort/status scope.

Не оставить AOV на старой FULFILLED/CLOSED denominator.

---

# 55. ORDERS COUNT CONSEQUENCE

Если Executive GMV становится qualified-order GMV,
проверить Executive `Orders` card.

Она должна либо:

```text
count same qualifying cohort
```

либо иметь явно отличную semantics.

---

# 56. REFUND KPI CONSEQUENCE

Если Executive `Refunds` остаётся event-period,
tooltip должен отличать его от cohort GMV.

Не пытаться заставить:

```text
GMV - Refunds
```

совпадать с Collected/Outstanding.

---

# 57. TEST REQUIREMENTS

Backend tests минимум:

```text
GMV qualifying statuses
GMV excluded statuses
full payment
partial payment
unpaid
partial refund
full refund
pending refund excluded from factual refunded amount
prior-period payment
later-period refund
Collected GMV cohort semantics
Outstanding semantics
Completed GMV semantics
Payment Volume event semantics
Net Payment Volume
AOV compatibility
Marketplace/Storefront separation
no fan-out
comparison/as-of behavior
```

---

# 58. FRONTEND TESTS

Проверить:

```text
new labels
RU/AZ/EN
tooltips
AZN
comparison
zero/null
no USD fallback
no raw i18n keys
no confusing duplicate card names
```

---

# 59. RUNTIME VALIDATION

В реальном browser проверить минимум:

```text
Executive
Financial
Marketplace/Channels if affected
```

Показать actual values.

Проверить period changes и representative partial/refund cases.

---

# 60. NO FAKE PROFIT

Не добавлять:

```text
Profit
Expected Profit
Net Profit
```

пока cost model отсутствует.

Использовать только:

```text
GMV
collection
outstanding
refund
commission/revenue
```

с доказуемой semantics.

---

# 61. NO STAGE E IMPLEMENTATION

Не добавлять:

```text
IMPACT
severity
HIGH/MEDIUM/LOW
impact score
potential loss
```

Stage E остаётся следующим этапом только после closure.

---

# 62. REQUIRED DELIVERABLE A — POLICY DECISIONS

Вернуть authoritative decisions:

```text
GMV definition:
GMV qualifying statuses:
GMV exclusions:
GMV date authority:

Gross Collected GMV definition:
Net Collected GMV definition:
Chosen Executive "Оплачено по GMV" semantics:

Outstanding definition:
Outstanding after refund policy:

Refunded Amount definition:
Pending refund handling:

Completed GMV definition:
Completed GMV date authority:

Payment Volume definition:
Net Payment Volume definition:

Historical as-of policy:
```

---

# 63. REQUIRED DELIVERABLE B — REFUND POLICY MATRIX

| Scenario | GMV | Gross Collected | Net Collected | Refunded | Outstanding | Completed GMV |
|---|---:|---:|---:|---:|---:|---:|
| Full paid | | | | | | |
| Partial paid | | | | | | |
| Partial refund | | | | | | |
| Full refund | | | | | | |
| Cancel after payment | | | | | | |
| Problem + refund | | | | | | |

Заполнить actual semantics, не conceptual guesses.

---

# 64. REQUIRED DELIVERABLE C — CARD SET

Вернуть финальный recommended Executive/Financial card set:

| Section | Card | Business question | Formula | Period model |
|---|---|---|---|---|

---

# 65. REQUIRED DELIVERABLE D — BEFORE / AFTER

Показать:

```text
BEFORE
GMV = FULFILLED/CLOSED
Payment Volume = CAPTURED event-period
Refunds = ...

AFTER
GMV = ...
Collected GMV = ...
Outstanding = ...
Completed GMV = ...
Payment Volume = ...
Refunds = ...
Net Payment Volume = ...
```

---

# 66. REQUIRED DELIVERABLE E — FINANCIAL INVARIANTS

Перечислить только реально валидные invariants.

Например:

```text
Gross Collected >= Net Collected
Processed Refunds >= 0
Outstanding >= 0
```

А такие выражения как:

```text
GMV >= Payment Volume
GMV = Net Collected + Outstanding
```

разрешены только при доказанной matched semantics.

Для каждого invariant указать scope.

---

# 67. REQUIRED DELIVERABLE F — LIMITATIONS

Отдельно:

```text
Commission reversal implementation: YES/NO
Storefront collected subscription revenue: PROVABLE/NOT PROVABLE
Outstanding after refund: PROVABLE/NOT PROVABLE
Historical snapshot reconstruction: PROVABLE/NOT PROVABLE
```

---

# 68. DOCUMENTATION / ADR

Обновить authoritative architecture/ADR additive.

Зафиксировать:

```text
GMV lifecycle
refund treatment
cohort vs event-period
partial-payment semantics
historical/as-of policy
```

Не удалять historical decisions; superseded semantics пометить явно.

---

# 69. ROADMAP

Добавить closure evidence как pre-Stage-E gate.

Не создавать лишний top-level product stage.

После PASS:

```text
Command Center KPI Audit
→ VERIFIED

GMV Lifecycle / Collection / Refund Semantics
→ CLOSED

Stage E
→ READY
```

Но Stage E автоматически НЕ запускать.

---

# 70. REPORT

Создать:

```text
docs/prompts/PHASE_3_GMV_LIFECYCLE_COLLECTION_REFUND_SEMANTICS_POLICY_CLOSURE_REPORT.md
```

Полностью на русском языке.

---

# 71. GIT EVIDENCE

Вернуть:

```text
Starting HEAD:
Final HEAD:
Changed files:
Migrations:
Tests:
Commit(s):
Pushed to origin: YES/NO
Working tree clean: YES/NO
```

---

# 72. ACCEPTANCE CRITERIA

VERDICT A только если:

1. Actual order/payment/refund lifecycle audited.
2. GMV no longer ambiguously means only FULFILLED/CLOSED without explicit policy.
3. Qualifying GMV statuses documented.
4. Refund does not silently reduce GMV through arbitrary arithmetic.
5. Full-refund/order-invalidation policy explicit.
6. Gross vs Net Collected semantics explicit.
7. Outstanding after refund semantics proven or honestly marked NOT PROVABLE.
8. Completed GMV semantics explicit.
9. Payment Volume remains clearly separate EVENT_PERIOD metric.
10. Net Payment Volume uses processed refunds only.
11. Partial payments reconciled.
12. Refund requests separated from actual refunds.
13. Historical/as-of behavior explicit.
14. AOV/order count consequences reconciled.
15. Marketplace/Storefront separation preserved.
16. AZN authority preserved.
17. DB/API/UI values reconciled for implemented cards.
18. Tests green.
19. Runtime verified.
20. Architecture/roadmap updated.
21. Report in Russian.
22. Stage E not automatically started.

---

# 73. VERDICT

Вернуть ровно один.

## VERDICT A — GMV / COLLECTION / REFUND SEMANTICS CLOSED / STAGE E READY

Только если policy полностью определена, required implementation/remediation выполнена,
critical metrics reconciled и acceptance criteria пройдены.

Stage E автоматически НЕ запускать.

## VERDICT B — FINANCIAL SEMANTICS REMEDIATION REQUIRED

Если policy определена, но implementation/data model содержит исправимые gaps.

Указать:

```text
Policy status:
Implementation gaps:
Affected metrics:
Minimal remediation:
```

## VERDICT C — BLOCKED / DOMAIN GAP

Если часть semantics невозможно достоверно реализовать из-за отсутствующей domain capability.

Не фабриковать:

```text
Outstanding
Net Collected
refund obligation effect
historical snapshots
```

если schema не позволяет их доказать.

---

# 74. STOP

После policy closure/remediation:

**STOP.**

Не запускать автоматически:

```text
Stage E
Stage F
Stage G
Stage H
Stage I
Stage J
Stage 2.14.x
```

Вернуть полный отчёт на русском языке и ждать review.
