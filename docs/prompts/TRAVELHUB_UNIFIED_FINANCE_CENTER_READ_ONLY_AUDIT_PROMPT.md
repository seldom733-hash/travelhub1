# TRAVELHUB — UNIFIED FINANCE CENTER: STRICT READ-ONLY AUDIT PROMPT

## Цель

Провести полный **read-only аудит текущего локального рабочего дерева TravelHUB** и определить, что уже реализовано для:
1. платежей клиентов;
2. выплат поставщикам;
3. обязательств перед поставщиками;
4. дебиторской задолженности клиентов;
5. ожидаемой прибыли;
6. фактической прибыли;
7. движения денежных средств;
8. единого финансового центра и аналитики.

Цель — подготовить один согласованный план Finance Center без дублирования Payment, Refund, Ledger, Payout или Settlement-моделей.

## Строгий READ-ONLY

Запрещено редактировать код/тесты/конфигурацию/документацию, менять Prisma schema, создавать миграции, выполнять INSERT/UPDATE/DELETE/TRUNCATE, создавать тестовые финансовые операции, менять статусы, выполнять commit/push или запускать E2E, которые могут писать в общую/template БД.

Разрешены чтение файлов, `git status`, `git diff`, поиск по коду, чтение схемы/тестов и гарантированно read-only запросы. Не подключаться к production для экспериментов.

Аудировать именно текущее локальное рабочее дерево, включая незакоммиченные изменения. Не считать GitHub default branch достаточным источником, если локальная версия новее.

## 1. Состояние репозитория

Зафиксировать branch, HEAD, `git status --short`, число modified/untracked файлов и какие финансовые изменения смешаны с посторонними dirty-worktree изменениями. Ничего не stage/reset/stash.

## 2. Найти финансовые модели и проследить реальное использование

Исследовать Prisma schema, миграции, enums, модули, DTO, services, controllers, events/subscribers, repositories, tests и UI.

Обязательно проверить:
- Payment, PaymentHistory;
- Refund и refund history;
- LedgerTransaction и прочие ledger/journal models;
- supplier payout / settlement / provider fee / commission settlement;
- supplier invoices/bills, если существуют;
- Order, OrderItem, Booking;
- commercialSnapshot, supplierPrice, customerFinalPrice, markup/discount;
- Supplier/Partner/registry;
- Analytics/KPI/reporting.

Для каждой сущности указать файлы/символы, поля/связи, кто создаёт и меняет записи, API, UI, RBAC, тесты и статус: production-ready / partial / placeholder / unused. Сам факт наличия модели, enum или теста не доказывает наличие рабочего процесса.

Особенно внимательно изучить `provider-fee-settlement-payout-foundation` и `ledger-transaction-foundation`: определить, являются ли они полноценными бизнес-процессами или только фундаментом.

**Не считать комиссию поставщика или provider-fee settlement равнозначными выплате поставщику за тур/отель/билет.** Отдельно описать:
- стоимость услуги поставщика и payable;
- платформенную комиссию/margin;
- provider processing fees;
- выплаты/settlements;
- фактическое движение денег.

## 3. Клиентские платежи

Проверить:
- unlimited partial payments;
- amount и due guard;
- paidAmount, refundedAmount, dueAmount, paymentStatus;
- PENDING/CAPTURED/FAILED/CANCELLED/REFUNDED;
- idempotency и concurrency;
- payment history/audit;
- refunds/chargebacks;
- связь Payment → Order/OrderItem;
- UI в Payments, Order, Booking;
- суммы, используемые Analytics.

Установить source of truth и места, где значения проецируются или денормализуются.

## 4. Выплаты поставщикам — главный фокус

Установить, существует ли рабочий процесс выплаты поставщику:
- Есть ли отдельная запись о выплате?
- Есть ли supplier payable/obligation?
- Когда создаётся обязательство: подтверждение заказа, booking, подтверждение поставщика или иной момент?
- К чему оно привязано: Order, OrderItem, Booking, supplier, конкретная услуга?
- Поддерживаются ли несколько частичных выплат одного обязательства?
- Есть ли авансы поставщикам?
- Как обрабатываются отмена, supplier rejection/refund, штрафы и изменение supplier price?
- Какие реальные статусы существуют?
- Как сохраняются дата, сумма, валюта, способ выплаты, получатель, actor, reference, reason, evidence?
- Есть ли idempotency и защита от повторной выплаты?
- Связана ли выплата с банковской операцией/кассой/ledger?
- Можно ли увидеть уже выплаченную сумму и остаток по каждому поставщику?
- Как обрабатываются несколько услуг/поставщиков в одном Order?
- Как обрабатываются разные валюты? Если FX нет — отметить это, не придумывать конвертацию.

## 5. Цена продажи и себестоимость

Для туров, отелей, авиабилетов и других услуг проследить:

`Supplier live price → MarkupRule/pricing service → public price → individual discount → accepted customer price → Request → Order/OrderItem → Booking`

Выяснить, где сохраняются:
- supplier price и валюта на момент принятия;
- markup percent/amount;
- public price;
- discount;
- final customer price;
- timestamps принятия/подтверждения;
- supplier/service identity;
- изменения supplier price после продажи;
- фактическая итоговая себестоимость после штрафов/доплат/refunds.

Проверить, что snapshot сохраняется и не пересчитывается задним числом по текущей live цене или markup. Описать разные service types отдельно.

## 6. Ожидаемая прибыль

Установить, существует ли надёжный расчёт expected profit. Если нет, предложить для обсуждения:

`Expected gross profit = accepted customer revenue − accepted supplier cost`

Отдельно описать возможные дополнительные прямые расходы: supplier fees, processing fees, commissions, refunds, cancellation penalties, прочие расходы.

Проверить прибыль по Order, OrderItem/услуге, supplier, периоду и статусам заказа. Описать поведение при неизвестной/устаревшей себестоимости, индивидуальной скидке и риска двойного markup.

Если данные недостаточны, показывать концептуальный `UNKNOWN/INCOMPLETE`, а не подставлять ноль или придуманную сумму.

## 7. Фактическая прибыль

Установить, существует ли actual-profit расчёт и какими источниками подтверждается каждый компонент.

Разделять:
1. Expected gross profit — по принятой цене клиента и зафиксированной себестоимости.
2. Actual realized profit — по признанной выручке, окончательной себестоимости, возвратам/штрафам и учитываемым расходам согласно принятой модели признания.
3. Cash flow — фактические поступления/выбытия за период.
4. Outstanding balances — клиентская дебиторка и обязательства перед поставщиками.

**Не вычислять actual profit как `captured client payments − supplier payouts`: это движение денег, а не обязательно прибыль.**

Если отсутствует политика признания выручки/себестоимости, отметить OWNER DECISION REQUIRED и предложить 2–3 ясных варианта с последствиями. Не выбирать скрытно за владельца.

## 8. Единый финансовый баланс

Проверить, можно ли получить:
- клиентские платежи: pending/captured/refunded;
- клиентскую задолженность по активным заказам;
- обязательства перед поставщиками;
- выплаченное и оставшееся к выплате по каждому поставщику;
- ожидаемую валовую прибыль;
- фактическую прибыль;
- входящий/исходящий/net cash flow;
- суммы по валютам;
- просроченные долги, если due dates существуют.

Описать правила для Request без принятой цены, Order без supplier cost, отменённых Orders, Booking cancelled/returned, partial fulfillment/multiple bookings, refunds/chargebacks, неоплаченных supplier payable и PENDING payments. Не объединять валюты без существующего FX-механизма.

## 9. UI, аналитика и RBAC

Найти реальную навигацию и страницы Finance/Payments, supplier payouts/settlements, supplier detail, Order/OrderItem/Booking finance summary, Analytics/drilldowns и ledger.

Составить таблицу:

| Capability | Backend | API | UI | RBAC | Tests | Verdict |
|---|---|---|---|---|---|---|

Проверить, может ли Finance user увидеть сводку, клиентские платежи, создать/подтвердить supplier payout, видеть остаток обязательства, сверять ledger и анализировать expected/actual profit с переходом к исходным операциям.

## 10. Финансовые инварианты и риски

Проверить:
- payout не превышает открытое supplier payable;
- retry не создаёт повторную выплату;
- остаток защищён от concurrency;
- ledger entries сбалансированы, если используется двойная запись;
- нет двойного учёта Payment/Refund/Payout;
- partial payout корректно обновляет остаток;
- отмена не удаляет историю;
- повторная обработка событий идемпотентна;
- lifecycle не меняет деньги без соответствующей финансовой операции;
- audit trail хранит actor/timestamp/reason/previous-new state.

## 11. Тесты

Читать существующие тесты и отчёты. Не запускать потенциально mutating E2E против общей/template DB. Для каждого сценария указать: passed (только если реально запущен), exists but not run, no test, или blocked by known unrelated failure.

## 12. Итоговый отчёт

Создать новый Markdown-файл:

`docs/TRAVELHUB_UNIFIED_FINANCE_CENTER_READ_ONLY_AUDIT_REPORT.md`

Отчёт на русском, с точными путями файлов, символами и line references, где возможно.

Обязательные разделы:
1. Executive verdict.
2. Repository state/uncommitted changes.
3. Current architecture map.
4. Client payment flow.
5. Supplier payout/settlement flow.
6. Supplier payable model.
7. Cost/pricing snapshots.
8. Expected profit — current capability and formula.
9. Actual profit — current capability and missing accounting policy.
10. Cash flow vs profit vs balances.
11. Refund/chargeback/commission/provider-fee treatment.
12. Finance UI/navigation.
13. Analytics/drilldowns.
14. RBAC.
15. Financial invariants and race/idempotency risks.
16. Existing test coverage and blockers.
17. Capability matrix: implemented/partial/placeholder/absent.
18. Critical gaps ranked P0/P1/P2.
19. Proposed target architecture reusing existing entities.
20. Proposed UI and KPI definitions.
21. Migration/data compatibility risks.
22. Owner decisions required.
23. Recommended implementation phases and acceptance gates.
24. Explicit non-actions: no code/schema/DB writes, no commit/push.

## Целевой UI — оценить, не реализовывать

Предложить единый раздел `Финансы` с вкладками:
- Обзор
- Платежи клиентов
- Выплаты поставщикам
- Задолженности
- Прибыль
- Сверка / проводки (только если ledger реально поддерживает функцию)

Главный обзор должен отдельно показывать:
- получено от клиентов;
- остаток клиентской задолженности;
- перечислено поставщикам;
- остаток долга поставщикам;
- ожидаемую валовую прибыль;
- фактическую прибыль;
- чистый денежный поток.

Не строить сводку из несопоставимых валют или непроверенных чисел.

## Acceptance criteria

Аудит завершён, если:
- различены supplier payable, supplier payout, provider fee/commission и ledger entry;
- доказано, что реально работает;
- установлены source of truth для client paid, supplier paid, supplier cost и customer revenue;
- expected profit не смешан с actual profit/cash flow;
- указаны реальные gaps и reuse opportunities;
- предложены этапы реализации;
- приложение, схема и данные не изменены;
- NO COMMIT / NO PUSH.
