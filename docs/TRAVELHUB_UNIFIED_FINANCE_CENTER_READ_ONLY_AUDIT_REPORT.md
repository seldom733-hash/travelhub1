# TRAVELHUB — UNIFIED FINANCE CENTER: READ-ONLY AUDIT REPORT

Дата аудита: 2026-10-10. Режим: строго READ-ONLY (код/схема/БД/миграции не изменялись; commit/push не выполнялись).

---

## 1. Executive verdict

**Клиентские платежи — production-ready. Всё остальное финансовой «правой половины» — фундамент или отсутствует.**

| Блок | Вердикт |
|---|---|
| Клиентские платежи (мультитраншевые, due-guard, идемпотентность, CAS-переходы, история, экспорт) | **production-ready** |
| Возвраты/chargeback-споры (approve/process/fail, resolve) | **production-ready** |
| Комиссионная политика (мастер-данные, activate/archive) | **implemented** |
| Начисление комиссии (accrual consumer) | **partial** (сервис работает, e2e `partner-collect` имеет известные падения T4/T8/T12) |
| Валюты/курсы (мастер-данные) | **partial** (CRUD есть, конвертации нет) |
| ProviderFee / Settlement / Payout | **placeholder/foundation**: модели, сервисы и read-API есть; **ни один бизнес-процесс их не создаёт**, write-маршрутов HTTP нет |
| Supplier payable / obligation | **absent** (модели нет; в схеме только doc-комментарии `schema.prisma:4885-4887`) |
| LedgerTransaction | **partial/foundation**: append-only модель + read-API, но **ни один прод-код не пишет ledger-записи** |
| Ожидаемая прибыль | **absent** (данные замораживаются в commercialSnapshot, но агрегата/расчёта/API/UI нет) |
| Фактическая прибыль | **absent** (нет политики признания выручки → OWNER DECISION REQUIRED) |
| Cash flow / сводный баланс | **absent** |
| Единый Finance Center UI | **partial**: только платежи клиентов (`/app/payments`), вкладок «Выплаты/Задолженности/Прибыль/Сверка» нет |

Главное: платформа **фиксит принятые цены и считает клиентские деньги**, но **не знает, кому и сколько должна поставщикам**, и **не измеряет прибыль**. Всё, что касается выплат поставщикам, — это прочный кирпич без дома (называйте это как угодно: фундамент, каркас). Не стоит дублировать Payment/Ledger/Payout — нужно **довести существующие сущности** до бизнес-процесса.

---

## 2. Repository state / uncommitted changes

- Branch: `master` (по умолчанию), HEAD: `90da728` `feat: multi/partial payments, contiguous numbering, accumulated work`.
- `git status --porcelain`: ровно одна строка — untracked `docs/prompts/TRAVELHUB_UNIFIED_FINANCE_CENTER_READ_ONLY_AUDIT_PROMPT.md` (сам промпт аудита). **Dirty-изменений нет; фин-код полностью закоммичен в `90da728`; смешения с посторонними правками нет.**
- Ни один файл не stage/reset/stash в рамках аудита.

---

## 3. Current architecture map

Схема `backend/prisma/schema.prisma`, finance-модели (~22 шт., без `@@map`, без cross-schema FK — bare String ID):

| Модель | Примерная позиция | Роль | Кто пишет (прод) | Статус |
|---|---|---|---|---|
| `Payment` | `schema.prisma:4158` | Клиентский платёж; `amount DECIMAL(12,2)`, unique `code`, `paymentOrdinal`, `idempotencySlotKey` | `payment.service.ts` | production-ready |
| `PaymentHistory` | рядом | Аудит переходов Payment | `payment.service.ts:transition:353` | production-ready |
| `Refund` (+history) | finance-блок | Возврат клиенту | `refund.service.ts` (376L) | production-ready |
| `Dispute` | finance-блок | Chargeback-споры | `dispute.service.ts` (319L) | production-ready |
| `Invoice` | `schema.prisma:4442` | Счёт (поставщику/партнёру?) | commission-flow | partial |
| `Commission` | `schema.prisma:4498` | Комиссия платформы | `commission.service.ts:131` | partial |
| `CommissionAccrual` | `schema.prisma:4543` | Начисление | `commission.service.ts:146` (consumer) | partial |
| `CommissionPolicy` | `schema.prisma:4612` | Политика | `commission-policy.service.ts` (327L) + REST CRUD | implemented |
| `Currency` / `ExchangeRate` | finance-блок | Валюты/курсы | master-data REST | partial (нет FX-движка) |
| `MarkupRule` (+history `:4703`) | `schema.prisma:4674` | Наценки | `markup-rule.service.ts` | implemented |
| `LedgerTransaction` | `schema.prisma:4807` | Append-only факты денег | **только perf-seed** (`src/perf/lib/seed.ts:279`) — прод-бизнеса нет | foundation |
| `ProviderFee` | `schema.prisma:4856` | Комиссия провайдера за приём платежа | `settlement.service.ts:102` — **вызывается только из e2e** | foundation |
| `Settlement` | `schema.prisma:4890` | Расчёт с поставщиком | `settlement.service.ts:154` — **вызывается только из e2e** | foundation |
| `Payout` | `schema.prisma:4921` | Факт выплаты | `settlement.service.ts:204` — **вызывается только из e2e** | foundation |
| `Order.commercialSnapshot` | `schema.prisma:2143-2151` (денорм. `paidAmount/refundedAmount/paymentStatus`) | Замороженная коммерция | `order.service.ts:648-649,727-728` | implemented (write-only, см. §7) |

Модули: `backend/src/modules/finance/` — `payment.service.ts` (933L), `refund.service.ts`, `dispute.service.ts`, `settlement.service.ts` (413L), `ledger.service.ts` (232L), `commission.service.ts` (297L), `commission-policy.service.ts`, `commission-accrual.consumer.ts`, `finance.controller.ts` (531L), `finance.module.ts:31-35` (провайдеры).

Контроллер `finance.controller.ts` — **полный список маршрутов**:
- master data: `GET/POST/PATCH` currencies (`:79-99`), exchange-rates (`:109-127`), taxes/tax-rules (`:137-184`);
- ledger: **только** `GET ledger-transactions`, `GET ledger-transactions/:code` (`:196-205`);
- provider-fees / settlements / payouts: **только GET list/detail** (`:213-246`);
- payments: `GET` (+export `:261`), `POST payments` (`:319`), `POST /:code/confirm|fail|cancel` (`:336-348`);
- refunds: `POST` + `approve|process|fail` (`:372-395`);
- disputes: `POST` + `resolve|cancel` (`:420-437`);
- commissions: `GET`, commission-policies CRUD + `activate|archive` (`:450-497`), `GET commissions`/`commission-accruals` (`:508-526`).

**Write-маршрутов для Settlement/Payout/Ledger/ProviderFee — нет** (подтверждено e2e `provider-fee-settlement-payout-foundation` тест 1: `POST/PATCH/DELETE → 404`).

---

## 4. Client payment flow

Реализация: `backend/src/modules/finance/payment.service.ts`.

- `createPayment:98` — инициация, привязка к Order по `code`/ID, `paymentOrdinal` для мультитраншейности.
- `confirmPayment:329` → `transition:353` — **CAS-переход статуса** (PENDING→CAPTURED и др.), инкремент `paidAmount` в транзакции, запись `PaymentHistory`.
- Идемпотентность: `idempotencySlotKey` на Payment (unique), повторный create/confirm — no-op/контролируемый ответ; дубли параллельных create — одна запись.
- Due-guard: платёж не может превысить `dueAmount` заказа; `reservedAmount` защищает от гонки «два платежа в долг».
- Мультитраншевость: неограниченное число частичных платежей; полный возврат (`refundedAmount >= paidAmount`) → `paymentStatus REFUNDED`, частичный → `PAID` (схема `:2148-2151`).
- **Source of truth**: таблица `Payment` (статус + amount). Денормализованные `Order.paidAmount / refundedAmount / paymentStatus` (`schema.prisma:2143-2151`) — **проекция** server-owned, обновляется в той же транзакции (исторический факт «деньги получены» не переписывается; возвраты пишутся поверх).
- Связь Payment→Order: `orderId`/`orderCode` (bare String, без FK).
- Refunds: `refund.service.ts` — `POST /refunds` → `approve` → `process|fail`, статусная машина, audit.
- Disputes: `dispute.service.ts` — `POST /disputes` → `resolve|cancel`.
- API/RBAC/UI: см. §12-14. Analytics сумму платежей **не читает** (страница `app/analytics/page.tsx` не упоминает payments/payout/profit — проверено grep).

Задолженность клиентов (AR): `Order.dueAmount` (и `paidAmount`) на живых заказах — считается; **возрастения due dates по платежам нет** (у Payment нет due-date поля — оплата привязана к срокам заказа/терминам; см. e2e `payment-terms`).

---

## 5. Supplier payout / settlement flow — ГЛАВНЫЙ ФОКУС

**Вердикт: бизнес-процесса выплаты поставщику НЕ существует. Есть только фундамент (Step 2.10B).**

Доказательства:

1. `SettlementService.createSettlement:139`, `createPayout` (`payout.create` в `settlement.service.ts:204`), `providerFee.create:102` — **единственные прод-вызовы этих записей находятся в e2e-спеке** `backend/test/provider-fee-settlement-payout-foundation.e2e-spec.ts` (`:174,179,209-211,238-270,309`). Grep по `src/` (без `.spec`) — ноль бизнес-вызовов.
2. В `finance.controller.ts` для settlement/payout/provider-fee — **только GET** (`:213-246`). HTTP-путь создать выплату отсутствует; e2e тест 1 это фиксирует: write-маршруты → 404.
3. В `permissions.constants.ts:154` — явный комментарий: write-права для Settlement **намеренно не определены** (только `finance.settlement.read`, `finance.payout.read`).
4. Модели Settlement/Payout **не имеют** статусов, balance, net-payable, period-колонок (`schema.prisma:4885-4887`: «нет balance/net-payable/periods/status»). Нет связи Settlement↔Payout (e2e тест 10: «без Settlement↔Payout связи»).
5. Нет модели **supplier payable/obligation** вообще (grep `payable|SupplierPayable|Obligation` по `schema.prisma` — только упоминания в комментариях `:4885-4887`).

Ответы на вопросы промпта §4:

| Вопрос | Ответ |
|---|---|
| Отдельная запись о выплате? | Модель `Payout` есть; **создаётся только в тестах** |
| Supplier payable/obligation? | **Нет** |
| Когда создаётся обязательство? | Нигде — триггера нет |
| К чему привязано? | `sourceType`/`sourceId` (generic String; в e2e — `SETTLEMENT`/`ORDER`), без FK |
| Частичные выплаты? | Нет (нет статусов/остатка; `amount` — просто Decimal) |
| Авансы поставщикам? | Нет |
| Отмена / supplier rejection / штрафы / изменение supplier price? | Нет; Supplier live price после продажи не влияет на обязательство (его нет) |
| Реальные статусы? | Отсутствуют у Settlement/Payout (см. doc `schema.prisma:4887`) |
| Дата/сумма/валюта/способ/получатель/actor/reference/reason/evidence? | Частично: amount, currency snapshot, providerRef (идемпотентность), sourceType/Id, provenance (correlation/actor из server context, e2e т.8) — **нет** метода выплаты, получателя-beneficiary, reason, evidence |
| Idempotency / защита от повтора? | **Да** — `providerRef` unique; replay → no-op; divergent → 409 (e2e т.6/6b/7/7b) — качество фундамента хорошее |
| Связь с кассой/bank/ledger? | **Нет**; e2e т.9: «ноль ledger-автопостингов» |
| Выплачено/остаток по поставщику? | **Невозможно** — нет ни payable, ни агрегации |
| Несколько услуг/поставщиков в Order? | Нет механизма разнесения |
| Разные валюты? | Snapshot валюты хранится; **конвертации нет** (см. §8) |

**Не путать** (по требованию промпта): commission accrual (комиссия платформы с партнёра, `partner-collect-commission-accrual`) и provider fee (fee PSP за приём платежа) — это **доходы/расходы платформы**, они **не равнозначны** выплате поставщику за услугу (тур/отель/билет). Выплаты поставщику в бизнес-потоке отсутствуют.

e2e `ledger-transaction-foundation` (17 тестов) и `provider-fee-settlement-payout-foundation` (11+ тестов) — **подтверждённый вердикт: это foundation-сьюты**, проверяющие read-only API, RBAC, иммутабельность, идемпотентность, контролируемые ошибки — **они не проверяют бизнес-процесс, потому что его нет**. Качество фундамента высокое (first-write-wins, конкурентные дубли → одна запись/409, audit log).

---

## 6. Supplier payable model

**Отсутствует.** Что есть и чего не хватает:

- Есть generic-строки `Settlement.sourceType/sourceId`, которые *могут* указывать на ORDER/SETTLEMENT, но это не агрегат обязательства.
- Нет: open amount / paid amount / remainder, статуса (OPEN/PARTIALLY_PAID/CLOSED/CANCELLED), привязки Order↔OrderItem↔Booking↔Supplier со смысловой нагрузкой, даты причастности, штрафов/adjustments.
- Следствия: «видеть уже выплаченную сумму и остаток по каждому поставщику» (§4 промпта) — **невозможно по построению**.
- Док-комментарий схемы (`schema.prisma:4885-4887`) честно признаёт это и описывает будущий accounting state — фундамент писался осознанно «без lifecycle».

Рекомендуемый reuse: **не создавать параллельную вселенную** — расширить `Settlement` до обязательства (status, paidAmount, dueAmount, supplierId, orderRef) **или** добавить `SupplierObligation`, а `Payout` оставить чистым «движением денег» (один payout может гасить одну/несколько open-частей — решение владельца, §22).

---

## 7. Cost / pricing snapshots

Цепочка (проверено):

1. Supplier live price → `SupplierPricingService.apply` (`backend/src/modules/pricing/supplier-pricing.service.ts:94-121`): `markupAmount`, `publicPrice`, Gate E-валидация.
2. `MarkupRule.resolve:248-267` — fail-closed (неизвестная категория → отказ, не «наценка 0»).
3. Request: `commercialSnapshot` замораживается при принятии цены (`request.service.ts:988-1025` — индивидуальная скидка хранится **только** в snapshot; `:1124-1158` freeze при конвертации Request→Order).
4. Order: `order.service.ts:648-649, 727-728` — `commercialSnapshot` копируется verbatim, immutable (Gate G).

**Что сохраняется**: supplier price + валюта на момент принятия, markup amount, public price, discount, final customer price, supplier/service identity, timestamps.

**Критическая находка (double-check выполнена)**: `Order.commercialSnapshot` **никогда не читается** после создания — grep по `order.service.ts` показывает только запись (`:727-728`). Ни profit-расчёта, ни себестоимости в booking/fulfillment из него не извлекается. Snapshot есть, потребителя нет. Это **возможность** (§19): ожидаемая прибыль = `publicPrice(final) − supplierPrice` прямо из snapshot без новых таблиц.

- Изменения supplier price после продажи: не влияют (snapshot frozen) — **правильно** для expected; для actual себестоимости после штрафов/доплат данных нет (нет supplier invoice/adjustment-потока).
- Service types: ценообразование общее для туров/отелей/билетов; отдельных «билетных» snapshot-полей нет.
- **FX**: `Currency`/`ExchangeRate` существуют, master-data API есть (`finance.controller.ts:79-127`), в `finance.validation.ts` есть проверки валют; **но конвертационного сервиса нет** — суммы разных валют объединять нельзя. `request.service.ts` упоминает exchangeRate в контексте snapshot-валидации, не в пересчёте.

---

## 8. Expected profit — current capability and formula

**Сейчас: не рассчитывается нигде** (нет сервиса, endpoint, UI, аналитики; grep profit по backend/frontend — пусто в финансовых зонах).

Данные для расчёта **уже есть** в `commercialSnapshot` (принятая финальная цена клиента − зафиксированная себестоимость поставщика). Предлагаемая формула для обсуждения:

```
Expected gross profit (Order/Item) = acceptedCustomerRevenue − acceptedSupplierCost
  acceptedCustomerRevenue = finalPrice (snapshot, с учётом индивидуальной скидки)
  acceptedSupplierCost    = supplierPrice (snapshot, в валюте поставщика — не конвертировать без FX!)
```

Дополнительные прямые расходы (когда появятся данные): provider processing fees (модель ProviderFee), platform commission (доход, не расход — зависит от модели владельца), refunds/cancellation penalties (статус заказа), прочее.

Поведение при неизвестной/устаревшей себестоимости: **показывать UNKNOWN/INCOMPLETE, не подставлять 0** (fail-closed, как MarkupRule).

Риски: двойной markup (publicPrice уже содержит markup — нельзя вычитать markupRule повторно); скидка уменьшает выручку, но не себестоимость (это корректно снижает profit); прибыль по Order без snapshot → UNKNOWN.

---

## 9. Actual profit — capability and missing accounting policy

**Отсутствует. НЕ вычислять как `captured payments − payouts` (это cash flow, не прибыль)** — тем более payouts не работают.

Разделение по промпту:

1. **Expected gross profit** — данных достаточно (§8), расчёт не реализован.
2. **Actual realized profit** — требует политики признания (см. OWNER DECISION §22): источники подтверждения каждого компонента (выручка — при каком событии? себестоимость — финальная поставщика? возвраты/штрафы — в моменте или инциденте?) — **политики нет**.
3. **Cash flow** — нет: единственный «настоящий» денежный факт — CAPTURED Payment; исходящих фактов (Payout) не создаётся.
4. **Outstanding balances** — клиентская AR есть (dueAmount по живым заказам); обязательства перед поставщиками — нет (§6).

**OWNER DECISION REQUIRED** — политика признания выручки/себестоимости. Варианты (обсуждение, не выбор за владельца):

| Вариант | Признание выручки | Себестоимость | Плюсы | Минусы |
|---|---|---|---|---|
| A. Cash-basis | в момент CAPTURED Payment | в момент Payout | тривиально сверяется с банком | не показывает убыточные оплаченные заказы; зависит от работающих выплат |
| B. Order-event (accrual-lite) | при подтверждении заказа (accepted/confirmed) | зафиксированная snapshot-себестоимость на тот же момент | ожидаемая=фактическая без задержек; честная маржа | не учитывает поздние штрафы/доплаты поставщика |
| C. Fulfillment (accrual) | при завершении/return Booking | invoice-финал поставщика + корректировки | самая точная | требует supplier invoice/adjustment-потока (сейчас нет) |

---

## 10. Cash flow vs profit vs balances

Сейчас **ничего из трёх не строится целиком**:

- Cash in: `SUM(Payment WHERE status=CAPTURED)` — посчитать **можно** (read API есть), по валютам раздельно.
- Cash out: **нет фактов** (Payout не создаётся).
- Net cash flow: невозможен.
- Балансы: AR частично (`Order.dueAmount` по активным заказам), AP — нет.
- Просроченные долги: у Payment/AP due-dates отсутствуют.
- Правила из §8 промпта: Request без принятой цены — не участвует; Order без supplier cost — UNKNOWN; отменённый Order — не считать profit, но CAPTURED-платежи остаются cash до refund; Booking cancelled/returned — политика зависит от §22; PENDING payments — «ожидается», не cash.
- Объединение валют **без FX запрещено** — все сводки должны группировать по currency.

---

## 11. Refund / chargeback / commission / provider-fee treatment

- **Refund**: полный поток (create→approve→process/fail); увеличивает `refundedAmount`, влияет на AR клиента; в cash outflow (когда движение реально) — но **cash-провайдер/факт возврата на карту отдельной сущностью не моделируется** (это ledger-уровень, будущее).
- **Chargeback/Dispute**: `dispute.service.ts` + `chargeback-dispute-foundation` e2e; статусы resolve/cancel; **не влияет** на Settlement/Payout (тех нет); ожидание: спор → возврат/штраф → влияет на actual profit по политике §22.
- **Commission**: начисление через `commission-accrual.consumer` (создаёт Commission + CommissionAccrual в tx, `commission.service.ts:131-146`); политика — REST CRUD + activate/archive. Это **доход платформы**, не выплата поставщику. Известные падения e2e `partner-collect-commission-accrual` (T4/T8/T12) — pre-existing product-403 (document, не чинить в рамках аудита).
- **Provider fee**: модель + service + read API; создание — только e2e. Будет расходом платформы при приёме платежа; в profit-формуле §8 — отдельной строкой «прямых расходов», когда появится бизнес-поток.
- Двойного учёта Payment/Refund сейчас нет (источники изолированы, CAS-переходы).

---

## 12. Finance UI / navigation

`frontend/components/Shell.tsx:37-104`, группа «ФИНАНСЫ» (`:54-59`):

| Вкладка | Маршрут | Permission | Файлы |
|---|---|---|---|
| Платежи | `/app/payments` | `finance.payment.read` | `frontend/app/app/payments/page.tsx`, `payments/[code]/page.tsx` (деталь) |
| Наценки | `/app/pricing/markup` | (pricing) | `frontend/app/app/pricing/markup/page.tsx` |

Легаси/дубль: `frontend/app/app/finance/payments/page.tsx` + `[id]` (используется в `payments-registry.spec.tsx`, `payment-create-contexts.spec.tsx`; **не в навигации** — кандидат на консолидацию).

**Нет UI**: выплаты поставщикам, settlements, provider fees, задолженности, прибыль, ledger/сверка, сводный обзор. i18n-ключи фин-группы: `lib/i18n.tsx:1101-1110`.

Finance user сейчас: увидит платежи и деталь платежа; **не может** создать/подтвердить payout (нет API/UI), увидеть остаток обязательства (нет модели), сверять ledger (read API есть, UI нет), анализировать profit (нет данных/API).

---

## 13. Analytics / drilldowns

`frontend/app/app/analytics/page.tsx` — **финансовых метрик нет** (grep `profit|payout|settlement` — пусто). Нет drilldown «KPI → исходные операции». Экспорт платежей есть (`GET /payments/export`, `payment.service.ts:631`) — единственный «отчёт».

---

## 14. RBAC

`backend/src/security/permissions.constants.ts`:

- Определены: `finance.payment.read|write|create|manage` (`:123-130`), `finance.refund.read|write|approve|execute` (`:131-139`), `finance.dispute.*` (`:140-141`), `finance.commission.*` (`:144-146`), `finance.ledger.read` (`:152`), `finance.settlement.read` (`:156`), `finance.payout.read` (`:157`).
- **Нет write-прав** для settlement/payout/ledger (намеренно, комментарий `:154`).
- Read-блок для широких ролей: `:339-347` (включая ledger/settlement/payout read); FINANCE-набор: `:405-408` (+create/manage платежей).
- Контроллер везде на `@RequirePermissions` — соответствует таблице.

Вывод: RBAC-каркас **готов к расширению** (добавить `finance.payout.write`, `finance.settlement.write` по образцу payment), но сейчас права на write физически не нужны — маршрутов нет.

---

## 15. Financial invariants and race / idempotency risks

Что **уже защищено** (проверено кодом + e2e):

- Платежи: CAS-переход статуса (`payment.service.ts:353`), unique `idempotencySlotKey`, due-guard/reservedAmount против параллельного переплаты; повторный confirm — no-op; история не удаляется при отмене.
- Settlement/Payout/Ledger (фундамент): identical replay → no-op; divergent → controlled 409 (не молчаливый успех); конкурентный дубль create → одна запись, без 500; Ledger immutable (нет update/delete), first-write-wins по occurredAt; provenance из server context (не из body); audit log без PII.
- Нумерации (из работы §26 предыдущего отчёта): сплошные счётчики, in-tx upsert +1.

Чего **проверить нельзя** (потому что нет процесса): payout ≤ open payable, partial payout обновляет остаток, retry не платит дважды в реальном потоке, балансировка двойной записи (LedgerTransaction — **не двойная запись**, а append-only факты; балансировки нет по конструкции).

Риски на будущее (для §19-21): любой новый write-поток payout обязан наследовать паттерн идемпотентности providerRef + CAS из payment.service; иначе гонка «двойная выплата» станет P0.

---

## 16. Existing test coverage and blockers

| Сьют | Тип | Статус в этом аудите | Что покрывает |
|---|---|---|---|
| unit finance (payment/refund/dispute/settlement/commission/ids и др.) | vitest | **passed** (запускался сегодня: 156 suites / 2552 tests GREEN) | сервисный слой |
| `multi-partial-payments.e2e-spec.ts` | e2e | **passed** (предыдущая сессия, отчёт MULTI_PARTIAL) | мультитранши, due-guard, идемпотентность |
| `storefront-concurrency` (7/7) | e2e | **passed** (предыдущая сессия) | SF-счётчики |
| `payment-flow`, `payment-terms`, `payment-provider-abstraction`, `refund-flow`, `chargeback-dispute-foundation`, `finance-domain-foundation`, `commission-policy-foundation` | e2e | **exists, not run** в этом аудите (read-only; не запускались mutating-сьюты) | базовые фин-потоки |
| `ledger-transaction-foundation` | e2e | **exists, not run** (17 тестов прочитаны) | read-only ledger API, иммутабельность, идемпотентность |
| `provider-fee-settlement-payout-foundation` | e2e | **exists, not run** (11+ тестов прочитаны) | read-only settlement/payout API, идемпотентность, отсутствие write-маршрутов |
| `partner-collect-commission-accrual` | e2e | **blocked by known unrelated failure** (T4/T8/T12, pre-existing product-403) | начисление комиссии |

Статусы по §11 промпта: passed только там, где реально запускалось в этой/предыдущей сессии; остальное — exists but not run / blocked. **Ни один mutating e2e не запускался в рамках аудита.**

---

## 17. Capability matrix

| Capability | Backend | API | UI | RBAC | Tests | Verdict |
|---|---|---|---|---|---|---|
| Клиентские платежи (частичные, мультитранш) | ✅ service+CAS | ✅ full | ✅ `/app/payments` | ✅ | ✅ unit+e2e | **implemented** |
| Возвраты (refund) | ✅ | ✅ | ✅ (через платеж/заказ) | ✅ | ✅ | **implemented** |
| Споры/chargeback | ✅ | ✅ | ⚠️ частично | ✅ | ✅ foundation | **implemented** |
| Комиссионная политика | ✅ | ✅ CRUD | ✅ `/app/pricing/markup` (наценки) | ✅ | ✅ | **implemented** |
| Начисление комиссии | ✅ consumer | ⚠️ read | ❌ | ✅ | ⚠️ known failures | **partial** |
| Валюты/курсы | ✅ master data | ✅ CRUD | ❌ | ✅ | ✅ | **partial** (нет FX-движка) |
| ProviderFee | ✅ foundation | ⚠️ read-only | ❌ | ⚠️ read-only | ✅ foundation e2e | **placeholder** |
| Settlement | ✅ foundation | ⚠️ read-only | ❌ | ⚠️ read-only | ✅ foundation e2e | **placeholder** |
| Payout | ✅ foundation | ⚠️ read-only | ❌ | ⚠️ read-only | ✅ foundation e2e | **placeholder** |
| Supplier payable/obligation | ❌ | ❌ | ❌ | ❌ | ❌ | **absent** |
| Ledger записи из бизнеса | ❌ (только seed) | ⚠️ read-only | ❌ | ⚠️ read-only | ✅ foundation e2e | **partial/foundation** |
| Ожидаемая прибыль | ❌ (данные в snapshot) | ❌ | ❌ | ❌ | ❌ | **absent** |
| Фактическая прибыль | ❌ | ❌ | ❌ | ❌ | ❌ | **absent** (нужна политика §22) |
| Cash flow | ❌ | ❌ | ❌ | ❌ | ❌ | **absent** |
| AR клиента (остаток) | ✅ `Order.dueAmount` | ✅ через order/payment | ⚠️ | ✅ | ✅ | **partial** |
| Finance Center обзор | ❌ | ❌ | ❌ | ❌ | ❌ | **absent** |

---

## 18. Critical gaps ranked

**P0 (без этого «единый финансовый центр» — вывеска):**
1. **Supplier payable/obligation отсутствует** — нет модели, триггера создания (момент подтверждения заказа/booking), остатка, статусов. → блокирует выплаты, AP, profit, баланс.
2. **Выплаты поставщикам не подключены к бизнесу** — write-сервис фундамента не вызывается ни из order/booking lifecycle, ни из API; нет RBAC-write/UI. → блокирует cash out и actual profit.
3. **Политика признания выручки/себестоимости не выбрана** (§9/§22) — без неё actual profit не определён даже архитектурно.
4. **Потребитель commercialSnapshot отсутствует** — expected profit не считается, хотя данные замораживаются с Gate G (простая первая победа).

**P1 (следующий слой ценности):**
5. Ledger-провенанс из бизнес-событий (payment.captured / refund.processed / payout.created → append-only факт) — иначе «Сверка/проводки» в целевом UI не построить.
6. FX-механизм или жёсткое «per-currency only» в KPI (решение §22).
7. Finance UI: вкладки «Выплаты/Задолженности/Прибыль» (§20) + консолидация дублей `/app/finance/payments` vs `/app/payments`.
8. Analytics: KPI + drilldown к исходным операциям.
9. Известные падения `partner-collect-commission-accrual` (T4/T8/T12) и product-403.

**P2 (полировка/точность):**
10. Supplier invoice/adjustment-поток для true-actual себестоимости; штрафы, авансы, multi-supplier order разнесение.
11. Due-aging по AR/AP, просроченные долги.
12. Кэш/перф агрегатов для обзора (страница баланса на живых SUM по Decimal — профилировать).

---

## 19. Proposed target architecture (reuse existing entities)

Принципы: **не дублировать** Payment/Refund/Ledger/Payout/Settlement; довести фундамент до процесса; всё, что можно посчитать из snapshot — считать из snapshot.

1. **SupplierObligation (расширение Settlement или новая модель)** — open amount, supplierId, order/orderItem refs, status OPEN/PARTIALLY_PAID/CLOSED/CANCELLED/ADJUSTED, currency snapshot. Создание: событие подтверждения заказа (гейт по наличию commercialSnapshot — иначе UNKNOWN, не 0).
2. **Payout = движение денег** (уже есть): partial payouts гасят obligation; обязательные поля: amount, currency, method, beneficiary, occurredAt, providerRef (идемпотентность уже в модели), actor/reason/evidence.
3. **Bridge-вызовы**: `booking/order confirm → accrue obligation` (транзакционно с freeze snapshot); `POST /payouts` (новый write-маршрут + `finance.payout.write`); CAS-обновление остатка obligation по образцу `payment.service.ts:353`.
4. **Ledger**: consumer'ы на `payment.captured`, `refund.processed`, `payout.created` → `LedgerService` (сервис уже написан, просто не вызывается) с occurredAt/provenance — факты для «Сверки».
5. **Expected profit service**: чтение commercialSnapshot по живым заказам → агрегаты по Order/Item/supplier/периоду/валюте; UNKNOWN при отсутствии snapshot.
6. **Actual profit**: слой над ledger-events по политике владельца (§9 B или C); **не** `captured − payouts`.
7. **FX**: либо сервис конвертации поверх ExchangeRate (только для display-KPI, не для ledger), либо везде per-currency.
8. Баланс/overview: read-проекция из Payment (AR) + Obligation (AP) + Profit-service + Ledger cash; group-by currency.

---

## 20. Proposed UI and KPI definitions

Единый раздел `Финансы` (Shell, группа уже существует `Shell.tsx:54-59`), вкладки:

| Вкладка | Содержимое | Данные |
|---|---|---|
| **Обзор** | Получено от клиентов; остаток клиентской задолженности; перечислено поставщикам; остаток долга поставщикам; ожидаемая валовая прибыль; фактическая прибыль (после политики); чистый денежный поток — **каждый блок с разбивкой по валютам**, без объединения без FX | Payment aggregation, Obligation aggregation, Profit service, Ledger |
| **Платежи клиентов** | Существующий `/app/payments` + деталь | Payment API |
| **Выплаты поставщикам** | Список payout'ов, создание выплаты, фильтры поставщик/период/валюта | Payout API (расширить) |
| **Задолженности** | AP: по каждому поставщику open/paid/remainder; AR: активные заказы с dueAmount | Obligation + Order |
| **Прибыль** | Expected по заказам/поставщикам/периоду; actual после политики; drilldown к заказу→snapshot | Profit service |
| **Сверка / проводки** | Ledger append-only список (read API уже есть) — вкладку показывать, **только если** ledger-постинги подключены (иначе она бессмысленна) | Ledger API |

KPI-определения: все суммы Decimal, группировка по currency; UNKNOWN ≠ 0; каждый KPI кликабелен до исходных операций (drilldown).

Оценка целевого UI — **только оценка, реализация в phases §23**.

---

## 21. Migration / data compatibility risks

- Реальных финансовых данных процесса нет (payout'ов не создавалось) — миграция obligations «историческим» способом не нужна; тестовые/seed-строки perf-seed ledger читааемы (e2e т.17: legacy compatibility).
- Расширение Settlement до obligation: additive-миграции (nullable поля status/paidAmount с defaults) — низкий риск; **не менять** существующие unique-ключи (code, providerRef) — на них построена идемпотентность.
- Новые FK/индексы: bare String IDs — аккуратно с существующими дублями (cross-schema FK исторически не используются; сохранять конвенцию или отдельным hardening-фазом).
- Денормализованные Order.paidAmount/paymentStatus: не пересчитывать задним числом (server-owned исторический факт, схема `:2148-2150`).
- `/app/finance/payments` (легаси) vs `/app/payments`: при консолидации сохранить маршруты (бить ссылки внешних пользователей) или redirect.
- Commission-политики/master data живут в finance — их переносов не требуется.

---

## 22. Owner decisions required

1. **Политика признания выручки и себестоимости** (§9): вариант A (cash), B (order-event/accrual-lite — рекомендуемый старт), C (fulfillment). Влияет на всё в «Прибыли» и на cash-vs-profit сводки.
2. **Семантика обязательства**: расширять Settlement до payable (меньше сущностей) vs новая SupplierObligation + Settlement=расчёт (чище domain, +1 модель). И: один Payout ↔ много обязательств?
3. **FX**: внедрять конвертацию (какой курс, какая дата) или жёстко per-currency во всех KPI?
4. **Комиссия платформы в profit-формуле**: вычитать из маржи или показывать отдельной строкой дохода?
5. **Момент создания обязательства**: подтверждение заказа vs подтверждение поставщиком vs booking (для билетов/отелей может различаться).
6. **Provider fee**: включать в actual profit как расход с первого дня или только после появления реальных физических списаний PSP?

---

## 23. Recommended implementation phases and acceptance gates

| Phase | Содержание | Acceptance gate |
|---|---|---|
| **0. Решения** | §22 пп.1-2,5 зафиксированы письменно | утверждённая формула и семантика obligation |
| **1. Obligation + payout write** | модель/расширение, триггер accrual, `POST /payouts` + RBAC write, CAS-остаток, идемпотентность | e2e: создание obligation при confirm; частичные выплаты не превышают open; конкурентный payout — одна запись; unit+tsc GREEN |
| **2. Ledger-постинги** | consumers: payment.captured / refund.processed / payout.created | ledger-записи появляются; replay идемпотентен; append-only не нарушен (существующие foundation e2e не ломаются) |
| **3. Expected profit** | сервис чтения snapshot + агрегаты + API | profit по Order/поставщику/периоду/валюте; UNKNOWN при отсутствии snapshot; сверка publicPrice−supplierPrice на выборке |
| **4. Finance UI** | вкладки Обзор/Выплаты/Задолженности/Прибыль (+Сверка после phase 2) | finance-роль видит все блоки; drilldown работает; валюты не смешиваются |
| **5. Actual profit + cash flow** | после политики (§22.1): слой над ledger | cash in/out/net ≠ profit в демо-сценарии с refund; документированная сверка |
| **6. Analytics + точность** | KPI, drilldown, supplier adjustments, due-aging | analytics-сьюты; известные product-403 задокументированы/исправлены отдельно |

Каждый phase — отдельный коммит/PR с e2e; **не начинать phase 2, пока phase 1 не даст реальные payout-факты**.

---

## 24. Explicit non-actions

В рамках этого аудита **не выполнено и не должно выполняться без отдельного разрешения владельца**:
- никаких изменений кода, тестов, конфигурации, документации (кроме создания этого отчёта);
- никаких изменений Prisma schema, миграций;
- никаких INSERT/UPDATE/DELETE/TRUNCATE в БД;
- никаких тестовых финансовых операций, смены статусов;
- никаких commit/push;
- никаких E2E-запусков, потенциально пишущих в общую/template БД (запускались только read-only grep/rg/git/read; unit-сьюты finance запускались в предыдущих сессиях и уже задокументированы);
- не подключался к production;
- подтверждённые ранее «ожидающие владельца» записи (PAY-00000005 и др.) **не тронуты**.

---

## Приложение A — ключевые file:line (быстрая навигка)

| Тема | Где |
|---|---|
| Payment create/confirm/transition | `backend/src/modules/finance/payment.service.ts:98, :329, :353` |
| Payment export / detail | `payment.service.ts:631, :721` |
| Order денормализация paid/refunded/status | `backend/prisma/schema.prisma:2143-2151` |
| Settlement/ProviderFee/Payout create (только e2e) | `backend/src/modules/finance/settlement.service.ts:102, :154, :204` |
| GET-only settlement/payout/ledger API | `backend/src/modules/finance/finance.controller.ts:196-246` |
| Ledger в perf-seed | `backend/src/perf/lib/seed.ts:279` |
| Commission create | `backend/src/modules/finance/commission.service.ts:131, :146` |
| Snapshot freeze Request→Order | `backend/src/modules/order/request.service.ts:1124-1158`, `order.service.ts:648-649, :727-728` |
| Supplier pricing apply | `backend/src/modules/pricing/supplier-pricing.service.ts:94-121` |
| MarkupRule resolve (fail-closed) | `backend/src/modules/pricing/markup-rule.service.ts:248-267` |
| Finance RBAC | `backend/src/security/permissions.constants.ts:123-157, :339-347, :405-408` |
| Nav «ФИНАНСЫ» | `frontend/components/Shell.tsx:54-59` |
| Payments UI | `frontend/app/app/payments/page.tsx`, `payments/[code]/page.tsx` |
| Фундамент-e2e | `backend/test/ledger-transaction-foundation.e2e-spec.ts`, `backend/test/provider-fee-settlement-payout-foundation.e2e-spec.ts` |

## Приложение B — acceptance criteria (аудит закрыт?)

- [x] различены supplier payable / supplier payout / provider fee / commission / ledger entry (§5, §6, §11, §17);
- [x] доказано, что реально работает (§4 vs §5: только клиентские платежи production-ready; payout-фундамент вызывается лишь e2e);
- [x] установлены source of truth: client paid = `Payment` (проекция Order), supplier cost = frozen `commercialSnapshot`, customer revenue = snapshot finalPrice, supplier paid = **факта нет** (§4, §7, §10);
- [x] expected profit не смешан с actual/cash (§8-§10);
- [x} указаны gaps и reuse-возможности (§17-§19);
- [x] предложены phases (§23);
- [x] приложение, схема и данные не изменены; NO COMMIT / NO PUSH (§24).
