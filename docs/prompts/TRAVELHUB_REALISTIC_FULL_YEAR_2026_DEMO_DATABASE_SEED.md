# TRAVELHUB — REALISTIC FULL-YEAR DEMO DATABASE SEED
## MARKETPLACE + STOREFRONT / 01.01.2026–31.12.2026

# LANGUAGE REQUIREMENT — MANDATORY

Все ответы разработчика, audit findings, планы, результаты seed, проверки, статистика, ошибки и финальный отчёт должны быть **НА РУССКОМ ЯЗЫКЕ**. Технические identifiers, Prisma models, enums, paths, commands и code сохранять в оригинале.

# 1. OBJECTIVE

Создать полноценный realistic demo dataset TravelHub для проверки:

- Command Center;
- Analytics;
- Sales Center;
- Booking Center;
- Orders;
- Payments / Refunds;
- Finance;
- Marketplace;
- Storefront;
- Decision Queue / Decision Signals;
- WHY Attribution;
- KPI, period comparison, charts и filters.

Период данных:

```text
2026-01-01 00:00:00
—
2026-12-31 23:59:59
```

Данные должны покрывать все 12 месяцев.

# 2. AUDIT ACTUAL SCHEMA FIRST

До seed исследовать actual HEAD:

- Prisma schema/migrations;
- existing seed scripts;
- enums/FKs/constraints;
- users/partners/workspaces;
- service/catalog/publication models;
- booking/order/payment/refund/commission relations;
- Marketplace vs Storefront architecture;
- subscription models;
- current 6 DecisionSignal detectors.

Не придумывать отсутствующие models/fields/statuses.

Вернуть:

| Domain | Existing models | Seedable | Constraints |
|---|---|---:|---|
| Users | | | |
| Partners | | | |
| Services/Publications | | | |
| Bookings | | | |
| Orders | | | |
| Payments | | | |
| Refunds | | | |
| Commissions | | | |
| Storefront | | | |
| Subscriptions | | | |

# 3. MARKETPLACE SCALE

Создать:

```text
Marketplace partners: 20–30
Marketplace customers: 120–150
```

Для **каждого реально поддерживаемого типа услуги**:

```text
10–50 publications
```

Это 10–50 на service type/category, а не на всю базу.

Dataset должен быть достаточно насыщенным для UI/analytics, но не превращаться в performance benchmark.

# 4. STOREFRONT SCALE

Создать отдельный Storefront dataset:

```text
Storefront partners: 10
Storefront customers: до 70
```

Не смешивать Marketplace Partner и Storefront Partner, если architecture различает contexts. Dual-capability company допустима только если current model это поддерживает.

# 5. BUSINESS MODEL AUTHORITY

Соблюдать:

```text
Marketplace Business
≠ Storefront SaaS
≠ Storefront Commerce
```

Storefront Commerce GMV НЕ включать в TravelHub Marketplace GMV.

Продажи Storefront-партнёра НЕ являются TravelHub Revenue.

Storefront SaaS revenue относится к subscription/billing, если billing engine реально существует.

# 6. CURRENCY / SUBSCRIPTION

PLATFORM Reporting Currency:

```text
AZN
```

Current Storefront subscription reference price:

```text
199 AZN
```

Но effective price должна быть способна отличаться при существующей модели:

- discount;
- promotion;
- partner-specific price;
- future dynamic pricing.

Если billing engine отсутствует, не создавать fake collected subscription revenue.

# 7. DATE DISTRIBUTION

Все transactional data распределить по Jan–Dec 2026.

Каждый месяц должен иметь meaningful activity.

Не концентрировать большинство данных в одной дате/неделе.

# 8. SEASONALITY

Создать deterministic умеренную туристическую сезонность:

```text
Jan–Feb → lower/moderate
Mar–Apr → growth
May–Aug → high
Sep–Oct → moderate/high
Nov → lower
Dec → seasonal increase
```

Не использовать одинаковые месячные totals.

# 9. PUBLICATIONS

Для каждого service type создать 10–50 realistic publications с полями, которые реально существуют:

- title/description;
- partner;
- category/type;
- price/currency;
- availability/capacity;
- status;
- location;
- publication/creation dates;
- service-specific fields.

Создать смесь canonical states (active/draft/inactive/archived/etc.) только согласно actual enums. Большинство demo catalog должно быть usable.

Цены разнообразить по типу услуги; не использовать одну цену для всего каталога.

# 10. SYNTHETIC USERS

Marketplace: 120–150 customers.

Storefront: до 70 customers.

Только synthetic identities. Не использовать реальные персональные данные. Для email предпочтительно безопасный demo/test domain, например `@example.test`.

Создать разнообразные `createdAt`, locale/status и остальные required fields.

# 11. PARTNER DISTRIBUTION

Marketplace: 20–30 partners.

Storefront: 10 partners.

Нужны разные profiles:

```text
top performers
medium performers
low performers
new partners
partners/services with no recent sales
```

Не делать всех одинаковыми.

# 12. BUSINESS CHAINS

Создавать business-consistent chains согласно actual schema, например:

```text
Partner
→ Publication
→ Booking
→ Order
→ Payment
→ Refund
→ Commission
```

или фактический canonical flow проекта.

Не создавать независимые random orders/payments без required relationships.

# 13. BOOKINGS

Создать достаточно bookings для meaningful analytics.

Покрыть canonical statuses, существующие в actual enums, включая по возможности:

- awaiting confirmation;
- confirmed;
- partially paid;
- paid;
- completed;
- cancelled.

Не создавать несуществующие statuses.

Даты должны быть логичными:

```text
createdAt <= later business events
createdAt <= service date
payment >= relevant order/booking creation
refund >= payment
```

где это соответствует модели.

# 14. ORDERS / SALES

Создать продажи во всех 12 месяцах.

Dataset должен позволять увидеть:

- MoM changes;
- seasonality;
- partner differences;
- category differences;
- conversion differences.

# 15. PARTIAL PAYMENTS — MANDATORY

Создать реальные partial-payment scenarios.

Пример semantics:

```text
Order amount = 1000 AZN
paidAmount = 300 AZN
outstanding = 700 AZN
```

Использовать actual payment architecture/statuses.

Также создать:

```text
fully paid
unpaid/waiting
failed
```

transactions, если это разрешено schema.

# 16. FAILED PAYMENTS

Обязательно создать data для `FailedPaymentsDetector`.

Если schema имеет structured failure code/reason/provider/method/retry fields — создать несколько factual patterns, чтобы Stage D мог иметь observed driver.

Не придумывать отсутствующие поля.

# 17. REFUNDS

Создать согласно actual model:

```text
successful refunds
pending refunds
full refunds
partial refunds
```

в разных месяцах.

Canonical policy:

```text
customer refund
→ proportional Marketplace commission reversal
```

Но если Stage 2.14.x reversal implementation ещё отсутствует — не симулировать несуществующую production logic. Отдельно зафиксировать gap.

# 18. MARKETPLACE COMMISSIONS

Создать commissions через current canonical logic.

Не использовать:

```text
TravelHub Revenue = customer Payment Volume
```

Marketplace TravelHub revenue — commission-based согласно architecture.

# 19. EXPECTED / COLLECTED / OUTSTANDING

Dataset должен позволять различать эти concepts там, где schema реально поддерживает их.

Partial payments должны формировать meaningful outstanding amounts.

Не придумывать Profit/cost model.

# 20. CANCELLATIONS

Создать historical и recent cancellations для `RecentCancellationsDetector`.

Если есть structured cancellation reasons — разнообразить их. Если только free text — не создавать fake causal taxonomy.

# 21. PENDING BOOKINGS

Создать bookings, удовлетворяющие actual condition:

```text
AWAITING_CONFIRMATION > 4h
```

чтобы `PendingBookingsDetector` реально мог создать OPEN signal.

Также создать нормальные bookings внутри SLA.

# 22. UPCOMING BOOKINGS

Создать данные для `UpcomingBookingsDetector`.

Если detector зависит от runtime `now()`, документировать какие records trigger его на текущую дату и как это согласуется с dataset period 2026.

# 23. SERVICES WITHOUT SALES

Создать часть active/eligible publications без продаж для `ServicesWithoutSalesDetector`.

Большинство каталога при этом должно иметь нормальную activity.

# 24. DECISION SIGNAL COVERAGE

После seed проверить:

| Detector | Trigger data exists | Expected signal | Actual |
|---|---:|---:|---|
| PendingBookings | | | |
| FailedPayments | | | |
| RecentCancellations | | | |
| PendingRefunds | | | |
| UpcomingBookings | | | |
| ServicesWithoutSales | | | |

По возможности все 6 должны иметь representative trigger data.

Если time-relative detector невозможно корректно trigger одновременно — объяснить, а не фальсифицировать даты.

# 25. STAGE D / WHY DATA QUALITY

Seed должен быть пригоден для deterministic WHY Attribution.

Где schema позволяет, создать factual evidence для cases:

```text
PROVEN_CAUSE / direct evidence
OBSERVED_DRIVER
CONTRIBUTING_FACTOR
INSUFFICIENT_EVIDENCE
```

Не создавать fake cause только ради покрытия теста.

# 26. STOREFRONT COMMERCE

Для 10 Storefront partners создать partner-owned commerce data, если current architecture это уже поддерживает:

- publications/services;
- customers;
- orders;
- bookings where applicable;
- payments where applicable.

Эти transactions остаются `Storefront Commerce` и не входят в Marketplace GMV.

# 27. STOREFRONT SUBSCRIPTIONS

Создать subscription state только через существующую schema.

Reference:

```text
199 AZN
```

Если model поддерживает effective pricing, создать:

```text
standard price
discounted partner
promotion
partner-specific effective price
```

Но `list price ≠ collected revenue`.

Если billing engine отсутствует:

```text
Storefront Collected Revenue = NOT PROVABLE
```

# 28. STOREFRONT CUSTOMER DISTRIBUTION

До 70 customers распределить между 10 Storefront partners неравномерно. Не делать механически по 7 каждому.

Создать high/medium/low activity where supported.

# 29. DETERMINISTIC / IDEMPOTENT SEED

Seed должен быть reproducible с fixed random seed, например conceptual:

```text
20260101
```

Повторный запуск не должен удваивать данные.

Использовать безопасный deterministic reset/upsert strategy.

# 30. DO NOT DESTROY NON-DEMO DATA

Не выполнять blind `TRUNCATE` production/non-demo DB.

Demo records должны быть идентифицируемы через existing safe mechanisms (synthetic domain, deterministic IDs и т.п.).

Если нужен reset:

```text
--reset-demo
```

или equivalent, удаляющий только demo dataset.

Не добавлять `isDemo` field без необходимости.

# 31. ONE DOCUMENTED SEED COMMAND

Создать простой canonical command по conventions проекта, например:

```text
npm run seed:demo-2026
```

После clone/setup dataset должен воспроизводиться одной documented командой.

# 32. TARGET VOLUME

Ориентир после schema audit:

```text
Marketplace:
20–30 partners
120–150 customers
10–50 publications per supported service type
hundreds of bookings/orders/payments

Storefront:
10 partners
≤70 customers
meaningful publications/orders/payments where supported
```

Exact totals определить по actual schema.

# 33. MONTHLY COVERAGE REPORT

Вернуть:

| Month | Publications | Bookings | Orders | Payments | GMV AZN | Refunds AZN |
|---|---:|---:|---:|---:|---:|---:|
| Jan | | | | | | |
| Feb | | | | | | |
| Mar | | | | | | |
| Apr | | | | | | |
| May | | | | | | |
| Jun | | | | | | |
| Jul | | | | | | |
| Aug | | | | | | |
| Sep | | | | | | |
| Oct | | | | | | |
| Nov | | | | | | |
| Dec | | | | | | |

# 34. PARTNER DISTRIBUTION REPORT

| Partner group | Count | Publications | Orders | GMV AZN |
|---|---:|---:|---:|---:|
| High | | | | |
| Medium | | | | |
| Low | | | | |
| No/low sales | | | | |

Labels не обязаны храниться в DB.

# 35. PAYMENT DISTRIBUTION REPORT

Вернуть:

```text
Fully paid:
Partially paid:
Unpaid/waiting:
Failed:
Fully refunded:
Partially refunded:
Pending refunds:

Expected amount:
Collected amount:
Outstanding amount:
Refunded amount:
```

Все суммы PLATFORM report — AZN.

# 36. BOOKING STATUS REPORT

Вернуть фактические canonical statuses:

| Booking status | Count |
|---|---:|
| actual enum | |

Не включать statuses, отсутствующие в schema.

# 37. MARKETPLACE VS STOREFRONT VALIDATION

Обязательно показать отдельно:

```text
Marketplace GMV:
Storefront Commerce GMV:
TravelHub Marketplace Revenue/Commission:
Storefront subscription list/expected value:
Storefront subscription collected revenue: PROVABLE / NOT PROVABLE
```

Не складывать семантически разные economics.

# 38. DATA INTEGRITY VALIDATION

Проверить минимум:

```text
orphan bookings = 0
orphan orders = 0
orphan payments = 0
orphan refunds = 0
invalid monetary relationships = 0
invalid dates = 0
duplicate demo entities = 0
Marketplace/Storefront contamination = 0
```

Для canonical partial payment model проверить:

```text
0 <= paidAmount <= order amount
```

если именно так устроена schema.

# 39. KPI / UI SANITY

После seed запустить application и проверить реальные:

```text
Command Center
Analytics
Booking/Orders
Decision Queue
Storefront workspace (если UI реализован)
```

Command Center минимум:

```text
GMV
Payment Volume
Refunds
Orders
Bookings
AOV
Commission
```

Не должно быть `NaN`, `undefined`, необъяснимых нулей или `$` для PLATFORM aggregate money.

# 40. ANALYTICS SANITY

Charts/period comparisons должны показывать:

```text
monthly changes
seasonality
category differences
partner differences
```

# 41. DECISION QUEUE SANITY

Запустить detectors и проверить representative signals:

```text
WHAT
structured evidence
lifecycle
WHY — только если Stage D уже реально присутствует в HEAD
```

Не создавать fake WHY.

# 42. PERFORMANCE

Использовать batching/transactions разумно; не делать тысячи последовательных inserts без необходимости.

Вернуть:

```text
Seed runtime:
Total generated records:
DB size: measured / NOT MEASURED
```

# 43. NO FUTURE MODEL FABRICATION

Если requested capability отсутствует (например полноценный Storefront billing engine), не создавать parallel fake architecture.

Отметить:

```text
NOT CURRENTLY PROVABLE
```

и заполнить максимально корректно existing schema.

# 44. REQUIRED FINAL STATISTICS

```text
MARKETPLACE
Partners:
Customers:
Service types:
Publications:
Bookings:
Orders:
Payments:
Refunds:
Commissions:

STOREFRONT
Partners:
Customers:
Service types:
Publications:
Bookings:
Orders:
Payments:
Subscriptions:

PERIOD
Earliest relevant record:
Latest relevant record:

PLATFORM REPORTING CURRENCY:
AZN
```

# 45. REQUIRED DATA QUALITY REPORT

```text
Duplicate demo entities:
Orphan relations:
Invalid dates:
Invalid payment amounts:
Invalid refunds:
Missing required relations:
Marketplace/Storefront contamination:
```

Все должны быть 0 либо каждое исключение объяснить.

# 46. FILES / REPORT

Не создавать набор одноразовых хаотичных scripts. Использовать canonical seed infrastructure.

Создать отчёт:

```text
docs/prompts/TRAVELHUB_REALISTIC_FULL_YEAR_2026_DEMO_DATABASE_SEED_REPORT.md
```

Отчёт полностью на русском.

Вернуть точный список changed files.

# 47. GIT EVIDENCE

Вернуть:

```text
Starting HEAD:
Final HEAD:
Changed files:
Commit:
Pushed to origin: YES/NO
Working tree clean: YES/NO
```

Не заявлять push без проверки.

# 48. VERDICT

Вернуть ровно один.

## VERDICT A — 2026 DEMO DATASET COMPLETE

Только если:

- Marketplace partners = 20–30;
- Marketplace customers = 120–150;
- каждый supported service type имеет 10–50 publications;
- Storefront partners = 10;
- Storefront customers ≤ 70;
- Jan–Dec 2026 покрыты meaningful activity;
- bookings/orders/payments/sales связаны;
- full/partial/unpaid/failed payment scenarios представлены;
- refunds представлены;
- DecisionSignal detector scenarios представлены;
- Marketplace/Storefront semantics разделены;
- AZN authority соблюдена;
- integrity validation пройдена;
- runtime UI проверен;
- seed deterministic/idempotent;
- отчёт на русском.

## VERDICT B — DATASET REMEDIATION REQUIRED

Если dataset создан, но есть gaps в coverage, relationships, semantics, integrity, detector scenarios или runtime.

## VERDICT C — BLOCKED

Если часть dataset невозможно корректно создать из-за отсутствующей domain model. Не создавать fake architecture ради VERDICT A.

# 49. STOP

После seed и validation **STOP**.

Не менять unrelated business architecture и не запускать новые Phase 3 stages.

Вернуть полный отчёт на русском языке и ждать review.
