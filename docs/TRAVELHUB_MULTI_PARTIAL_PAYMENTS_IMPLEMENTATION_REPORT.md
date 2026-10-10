# TRAVELHUB — MULTI / PARTIAL PAYMENTS — IMPLEMENTATION REPORT

Prompt: `docs/prompts/TRAVELHUB_MULTI_PARTIAL_PAYMENTS_IMPLEMENTATION_PROMPT.md`
Date: 2026-10-09 · Branch: working tree (NO COMMIT / NO PUSH)

---

## 1. Verdict

**PASS** (с задокументированными pre-existing ограничениями §24).

- Неограниченные partial-платежи на Order работают end-to-end: UI create → due-guard → CAPTURED → Order `paymentStatus` → `PAID`.
- Каноническая таблица 7 колонок реализована одним shared-компонентом во всех трёх точках входа (Payments / Order / Booking).
- Backend остался financial authority: `0 < amount ≤ due`, advisory-lock, внешний `Idempotency-Key` (per-slot), 422/409 контракты.
- Browser smoke **нашёл и починил 1 реальный UI-баг**: форма не отправляла обязательный `Idempotency-Key` → каждый UI-create падал 400. Исправлено + покрыто тестами (см. §13, §20).
- Тесты: backend unit 156 suites / 2552 tests GREEN; frontend 66 files / **1066 tests** GREEN; e2e: 12 affected-сьютов PASS, 9 сьютов упали ТОЛЬКО на pre-existing product-403 (§24), partner-collect — только известные T4/T8/T12; storefront-concurrency 7/7 PASS (§26).
- `tsc --noEmit`: frontend EXIT=0, backend EXIT=0.
- Git: **NO COMMIT / NO PUSH** (§18), 209 изменённых файлов в working tree.

## 2. Business model

- **Unlimited payments** на один Order: снят один-активный-платёж (§3), любой числовой последовательности partial-платежей до полного погашения `due`.
- **Partial payment**: редактируемое поле «Сумма платежа» `amount`, ограничение `0 < amount ≤ due`, ≤2 знаков; пустое поле = платёж на весь текущий остаток (server derives due).
- `due = amount(order) − paid − reserved`, где paid считается по CAPTURED/REFUNDED-истории; PENDING/FAILED/CANCELLED **не** уменьшают due (§5).
- Order `paymentStatus`: `UNPAID → PARTIALLY_PAID → PAID`; нижние/верхние границы определяет backend.
- Payment methods: allowlist `cash / card / bank_transfer / other` (AC-7), enum отображается в UI как «Наличные/Карта/Банковский/Прочее».

## 3. Payment model changes

- Удалён DB-уникал `finance."Payment_one_active_per_order"` — миграция `20261009100000_multi_partial_payments` (§22).
- Вместо него защита от дублей/гонок перенесена в: (a) `pg_advisory_xact_lock` по Order в `PaymentService` (due-guard в транзакции), (b) per-slot `Idempotency-Key`.
- Новое поле `finance."Payment".idempotencySlotKey TEXT` + unique `Payment_idempotencySlotKey_key` (миграция `20261009110000_payment_idempotency_slot`) — crash-window-3: один слот ↔ не более одного Payment, NULL у легаси-строк.
- Остальная модель (status machine, history/audit, refunds) не менялась.

## 4. Order financial logic

- `GET /orders/:id` возвращает финансовый контекст `{amount, paidAmount, refundedAmount, dueAmount, paymentStatus, currency}`; фронт использует его как default «Осталось» и для валидации.
- Статусная логика: PARTIALLY_PAID при `0 < paid < amount`, PAID при `paid ≥ amount` — считает backend после каждого CAPTURED/REFUNDED.
- Live-подтверждение smoke: Order `MKT-ORD-00000501` (3659 USD): paid 1000→2000→3000→3659, due 2659→1659→659→0, `paymentStatus` `UNPAID→PAID` (проверено API-пробой после 4-го confirm).

## 5. Partial payment logic

- `amount` в DTO опционален; без него сервер берёт весь текущий due («amount без значения → берётся весь остаток», `payment.service.spec.ts:193`).
- Серверная валидация ДО транзакции: формат `0 / отрицательный / >2dp → 422` (`payment.service.spec.ts:229`); `amount > due → 422` (`:206`); `due=0 → 422` (`:216`).
- Клиентская валидация (`isValidPaymentAmount`) — convenience only: блокирует 0/негатив/>due/>2dp inline-ошибкой, сервер остаётся authority (422 маппится в `payments.create.error.amount`).
- Живо в smoke: 4 платежа 1000/1000/1000/659 при due 3659 — последний ровно 659 прошёл due-guard (никакой переплаты).

## 6. Unlimited payment logic

- Нет счётчика платежей, нет UI-лимита, нет DB-ограничения cardinality (§3).
- «активный Payment НЕ блокирует новый create» — прямой юнит-тест (`payment.service.spec.ts:180`).
- E2E: `multi-partial-payments.e2e-spec.ts` — цепочка 1300→300/500/400/100→PAID + отдельный unlimited-count кейс; smoke добавил фактически 4 подряд на один Order.
- Каждый новый create заново берёт текущий due через advisory lock — порядок/количество не важны.

## 7. Overpayment protection

Три уровня:

| Уровень | Механизм |
|---|---|
| UI | inline error + submit disabled при `0 / >due / >2dp`; пустое поле валидно (= due) |
| API | `amount > due → 422`, `due=0 → 422` («no remaining amount due»), формат-ошибки → 422 |
| DB/транзакция | `pg_advisory_xact_lock(Order)` — конкурентные create резолвятся ровно один-в-приём |

- E2E: «два параллельных create 300+300 на due=500 → ровно один 201, второй 422» (`multi-partial-payments.e2e-spec.ts:345`); «overpayment create после CAPTURED → 422 (due=0)» (`payment-flow.e2e-spec.ts:363`).
- Live в smoke: на оплаченном заказе форма открылась с default `0` → inline error + submit disabled.

## 8. Concurrency

- Каждый create выполняется в транзакции с `pg_advisory_xact_lock` по Order id → due-guard атомарен.
- Гонка платеж/confirm: CAS-переходы status machine (409 на invalid transitions), без перезаписи.
- Crash-window-3 (§13 prompt): внешний `Idempotency-Key` → `request.idempotencySlotKey = deriveSlotKey(scope, operation, key)` → unique по `Payment.idempotencySlotKey`; повторный/усечённый create того же слота отвечает replay-ом, а не дублем.
- Регрессия не выявлена: e2e external-idempotency PASS, payment-flow PASS.

## 9. Refund interaction

- Refund-логика НЕ менялась (§18): REFUNDED-строки участвуют в `paid`-раскладке как раньше, таблица показывает их статусом «Возврат».
- Наблюдаемая осторожность: сьют `refund-flow.e2e-spec.ts` сейчас падает **до** payments-кода — на pre-existing product-403 харнесса (§24), не регрессия multi/partial.
- Unit-покрытие refund-границ: `payment.service.spec.ts` (REFUNDED входит в paid), `financial-integrity-checker.spec.ts`, `chargeback-dispute-foundation` context — GREEN в допустимых частях.

## 10. Payment table

- Канонические колонки (prompt §7): **№ | Дата | Сумма | Остаток | Форма оплаты | Статус | Кто принял**.
- Один shared-компонент `frontend/components/finance/PaymentsTable.tsx` + `buildPaymentsTableRows()` во всех трёх точках; legacy-разметки/`payments.col.*` ключей больше нет.
- Код/валюта — внутри ячеек («MKT-PAY-… / MKT-ORD-…», «1 000,00 USD»), не отдельными колонками.
- `<colgroup>` на 7 столбцов, сортировка `createdAt/amount/status` (столбцы `code`/`paidAt` не сорт.), пустое состояние `colSpan=7`, «Кто принял»: CAPTURED/REFUNDED → кто, иначе кто принял; клавиатура/ссылка на карточку платежа.
- Спецы: `PaymentsTable.spec.tsx` (10), `payments-registry.spec.tsx` (column model, sortBy, i18n ru/az/en).

## 11. Remaining calculation

- `remainingAfter` в строке = остаток **после** учёта до-неё payments: для CAPTURED-строк — `due-накопленный`; PENDING-строка показывает текущий due (не влияет на paid).
- Live-последовательность в smoke (4 строки, все «Зачислен» после confirm):
  `№1: 1 000 → остаток 2 659` · `№2: 1 000 → 1 659` · `№3: 1 000 → 659` · `№4: 659 → 0,00`.
- Между create №2 и confirm №1 обе строки показывали `2 659` (PENDING не двигает paid) — корректно.

## 12. Payment date decision

- Колонка «Дата» = `createdAt` момента приёма платежа (точка входа оператора), НЕ `paidAt`.
- Обоснование: в многочастичном режиме 1 платёж = 1 момент приёма; `paidAt` — атрибут захвата, хранится отдельно и используется detail-видом/аналитикой. Сортировка — по `createdAt`.

## 13. Payments UI

- `app/app/payments/page.tsx` (Центр управления → Платежи): KPI, вкладки статусов, фильтры, CSV/XLSX, кнопка «+ Создать платеж» (`payments-create-button`) → shared `CreatePaymentForm`.
- Форма (§9): селект заказа (только payable), readonly Стоимость/Оплачено/Осталось, **редактируемая** «Сумма платежа» (default = Осталось), method/reason/note, RU/AZ/EN, 403/404/409/422 маппинг ошибок.
- **Найдено на smoke и исправлено**: `createPayment` не передавал обязательный `Idempotency-Key` → 400 «Idempotency-Key header is required» на каждом UI-create. Фикс:
  - `lib/api.ts` — `api.post(path, body?, headers?)` (opt, обратно-совместимо);
  - `lib/payments.ts` — `newPaymentIdempotencyKey()` (`payment.create-…`, формат `[A-Za-z0-9._~-]`, ≤128) + `createPayment(input, opts?)` всегда шлёт заголовок;
  - `CreatePaymentForm.tsx` — ключ стабилен для одинакового payload внутри сессии диалога (retry = replay, не дубль), меняется при изменении payload (нет 409 divergent) и при переоткрытии (намеренный повтор не replay-ится).
- Тесты фикса: 4 новых в `CreatePaymentForm.spec.tsx` + 4 в `payments-create.spec.ts` (всего 8).
- **Найдено по баг-репорту и исправлено — reserved-ловушка (§5/§16 prompt #17)**: на заказе с PENDING-платежом на всю сумму (MKT-ORD-00000901: due 4585, PAY-00000005 PENDING 4585) форма показывала «Осталось 4585» и default 4585, а серверный due-guard (`due − reserved`) возвращал 422 «exceeds remaining due 0 (order is fully paid)» — misleading при paid=0. Фикс (canonical due НЕ менялся):
  - backend `order.service.ts` — `GET /orders/:id` отдаёт `reservedAmount` (сумма PENDING/AUTHORIZED);
  - backend `payment.service.ts` — 422 различает `(order is fully paid)` (paid ≥ due) и `(remaining due reserved by active payments)` (иначе), подстроки для frontend-regex сохранены;
  - frontend `availableToCreate(f)` = due − reserved (кламп ≥0, fallback на due) → default amount/placeholder/валидация кап = доступно; readonly «Осталось» остался canonical; amber-хинт `create-payment-reserved-hint` («Активные платежи резервируют … Доступно к созданию: …»), ru/az/en `payments.create.reserved_hint`;
  - тесты: +3 в `payment.service.spec.ts` (27), +4 в `CreatePaymentForm.spec.tsx`, +6 в `payments-create.spec.ts` (`availableToCreate` + KEYS).
- Smoke: реестр стартует пустым (empty-state), после сценария — 4 строки, 7/7 заголовков точь-в-точь.
- **Кнопки статуса (инкремент по запросу владельца)**: в `PaymentsTable` (колонка «Статус») добавлены `payment-confirm-button`/`payment-cancel-button` для строк `PENDING` при праве `finance.payment.manage` (ADMIN/FINANCE — обе роли подтверждены в БД, 179/179 и 22 finance.*); вызов `confirmPayment/cancelPayment` (`lib/payments.ts`, POST …/confirm|cancel без Idempotency-Key) + `onActionCompleted` → перезагрузка на всех трёх контекстах (реестр `load()`, Order `handlePaymentCreated`, Booking `loadBooking`). Ошибка перехода (409 CAS) → inline `payment-action-error`. fail — остался API-only. Тесты: +5 в `PaymentsTable.spec.tsx` (15 всего), live: реестр 3 кнопки на 3 PENDING, Order 1001 — 2/2, RU/AZ/EN, 7/7 headers нетронуты.

## 14. Order UI

- `app/app/orders/[id]/page.tsx`: finance-секция содержит `PaymentsTable` (rows из карточки платежей заказа) + кнопка `order-create-payment-button`.
- Smoke: Order `9caa9ebc-…` → таблица 7 заголовков, 4 строки ✓; диалог открывается с **fixed** заказом `MKT-ORD-00000501` (preset, селекта нет), financials заказа подгружаются; при due=0 amount `0` → inline error + submit disabled (переплата закрыта) ✓.
- Спеца: `payments-registry.spec.tsx`/`payment-create-contexts.spec.tsx` покрывают preset-контекст и «no bookingId в payload».

## 15. Booking UI

- `app/app/bookings/[id]/page.tsx`: finance-секция рендерит `PaymentsTable` внутри wrapper `data-testid="booking-payments-table"` (row-сурс = платежи **linkedOrder**).
- Кнопка `booking-create-payment-button` → диалог с **fixed** `linkedOrder.id` (§20: «Booking использует linkedOrder.id») — подтверждено smoke: fixed = `MKT-ORD-00000501`.
- Smoke: Booking `c75046ae-…` → wrapper+table present, 7/7 заголовков, 4 строки ✓.

## 16. Analytics

- Ничего не менялось: `git status -- frontend/app/app/analytics frontend/lib/metric-drilldown.ts` → пусто (§15 prompt: вторая payment analytics system не создавалась, KPI не трогались).
- Live-проверка: `/app/analytics` рисует payment-карточки поверх новых данных — «платежей 4», «захвачено 3 659,00 $», «возвраты 0,00», GMV 3 659,00 $, навигация в Orders/Payments работает.
- Тесты: e2e `analytics-foundation` PASS; `metric-drilldown` / KPI-спеки входят в 1061 GREEN.

## 17. API

- `POST /api/v1/finance/payments` — `@Idempotent("payment.create")`:
  - body: `{orderId, amount?, reason(1..255), paymentMethod?, initialNote?}` (whitelist; server-owned поля фронтом не шлются);
  - **заголовок `Idempotency-Key` обязателен** (regex `[A-Za-z0-9._~-]`, ≤128, fail-closed 400);
  - retry/replay/divergent → 409; due-guard → 422; RBAC → 403 (до чтения ключа).
- `POST /finance/payments/:code/confirm|fail|cancel` — CAS state machine, 409 на invalid transitions, **без** Idempotency-Key (только create в V1-protected set).
- `GET /finance/payments[/:code]` — реестр/detail без изменений контракта.
- Ключ берётся из заголовка (`idempotency-key`), fingerprint — от validated body через общий ValidationPipe (не raw transport); slot scope = principal + operation + key.

## 18. RBAC

- Create: `finance.payment.create` (smoke — admin); реестр/detail: `finance.payment.read`; подтверждение — соответствующее finance-permission; 403 возвращается **до** идемпотентности (T12).
- Frontend: create-кнопки рендерятся по permission (`canCreatePayment`), ошибка 403 → i18n `payments.create.error.forbidden`.
- `permissions.constants.ts`/`jwt-auth.guard.ts` — изменения только по многоплатёжной идемпотентности и `booking.return_to_order` (pre-existing другой сессии), RBAC-матрица не переписывалась.
- Покрыто: e2e payment-flow/external-idempotency + frontend-спеки permission-рендера.

## 19. Tests

**Backend unit**: 156 suites / 2552 tests GREEN (+4 — аудит нумераций §26), `tsc --noEmit` EXIT=0 (включая payment.service.spec: формат/`>due`/`due=0`/unlimited/empty-amount-на-всё + 3 теста reserved-сообщений 422; переписанные `ids.service.spec` / `reference-number.service.spec` под сплошную аллокацию).

**E2E (пачки ≤5 suites, явные пути, heap 4096)** — логи `C:\Users\Seldo\AppData\Local\Temp\opencode\e2e-b{1..4}.log`:
- PASS (12): payment-flow, multi-partial-payments, external-idempotency, payment-provider-abstraction, finance-domain-foundation, d7-financial-qualification, ledger-transaction-foundation, booking-to-order, provider-fee-settlement-payout-foundation, commission-policy-foundation, analytics-foundation, booking-temporal-contract.
- Упали ТОЛЬКО на pre-existing product-403 харнесса (9): refund-flow, chargeback-dispute-foundation, booking-lifecycle-completion, order-temporal-contract, order-canonical-events, payment-terms, business-event-envelope, checkout-commercial-intent, order-lifecycle-completion — единственный сигнал `expected 201, got 403` на `POST /api/v1/products` (§24).
- partner-collect-commission-accrual: ровно известные T4/T8 (403) + T12 (referenceNumber), без регрессий.
- E2E-цепочка §16: `Order 1300 → 300 → PARTIALLY_PAID/due 1000 → 500 → due 500 → 400 → due 100 → 100 → PAID/due 0` — PASS (`multi-partial-payments.e2e-spec.ts:179`), «PENDING не влияет» включён.
- **storefront-concurrency 7/7 PASS** (§26, изолированная suite-БД, включая live-доказательства «ровно +1 на создание» и «storefrontCode зеркалит SFPUB»).

**Frontend**: `tsc --noEmit` EXIT=0; `vitest run` → **66 files / 1066 tests GREEN** (1043 → +8 Idempotency-Key → +10 reserved-фикс → +5 кнопки Confirm/Cancel). Обновлено/создано: `payments-registry.spec.tsx`, `CreatePaymentForm.spec.tsx` (22, вкл. 4 reserved), `payments-create.spec.ts` (19, вкл. 6 `availableToCreate`), `payments/page.spec.tsx`, `PaymentsTable.spec.tsx` (10 → 15, вкл. 5 на статусные действия). Покрытие §16-чеклиста: create button/permission/amount editable+payload/validation/method/reason/Order context/Booking context/no bookingId/table/remaining/refresh/Analytics navigation/RU-AZ-EN/reserved-hint/status-actions.

## 20. Browser smoke

Среда: backend :4000 (ts-node), frontend :3000 (next dev), Chrome-for-Testing CDP :9444 + `agent-browser --session smoke9444 --cdp`, admin/admin123.

1. **Инцидент среды**: оба dev-сервера были OOM-убиты на 13:57 (host RAM), подняты заново; auto-launch Chrome агентом падал («exited early / DevToolsActivePort») → поднят вручную + подключение по CDP. AZAL-Chrome :9222 не трогался.
2. **Registry** `/app/payments`: заголовки ровно `№, Дата, Сумма, Остаток, Форма оплаты, Статус, Кто принял` (7/7), KPI/вкладки/фильтры на месте, пустое состояние (colspan=7).
3. **UI-create #1**: форма открылась, селект заказа → default amount 3659 → 1000/reason → submit → **400 «Idempotency-Key header is required»** (баг §13). Код починен (api/payments/form), `tsc`+vitest 1051 GREEN, страница перезагружена.
4. **Сценарий 4 платежей** на `MKT-ORD-00000501` (3659 USD): UI-create 1000 → confirm(CAPT) → 1000 → confirm → 1000 → confirm → **659 (ровно остаток)** → confirm. Все create через UI (due-guard живой), confirm — API-вызовом из страницы (UI-confirm вне скоупа prompt, §24). Остатки: 2659/1659/659/**0,00**, статусы «Ожидает→Зачислен», «Кто принял» = admin, форма «Наличные», order → `paymentStatus=PAID`.
5. **Order page**: `PaymentsTable` 7/7, 4 строки; entry `order-create-payment-button` → диалог fixed `MKT-ORD-00000501`, due=0 → amount `0` с inline error, submit disabled (защита от переплаты живьём).
6. **Booking page** (`c75046ae-…`): wrapper `booking-payments-table` + таблица 7/7, 4 строки; entry `booking-create-payment-button` → fixed `linkedOrder.id` ✓.
7. **Analytics**: карточки «платежей 4 / захвачено 3 659,00 $», навигация ок.
8. **Reserved-ловушка 0901 (баг-репорт владельца)**: `MKT-ORD-00000901` (4585 USD, PAY-00000005 PENDING 4585) — до фикса форма давала default 4585 → сервер 422 «remaining due 0 (order is fully paid)». После фикса (backend перезапущен): `GET /orders/:id` → `reservedAmount:"4585"` ✓; probe create 1000 → 422 «…exceeds remaining due 0 … **(remaining due reserved by active payments)**» ✓; форма: due-строка 4 585,00 без изменений, hint «Активные платежи резервируют 4 585,00 USD. Доступно к созданию: 0,00 USD», default amount `0.00`, submit disabled; ввод 1000 → мгновенная inline-ошибка + disabled ✓.
9. **Кнопки Подтвердить/Отменить (инкремент)**: реестр `/app/payments` — 7 строк, кнопки ровно на 3 PENDING (`PAY-00000101/102`, `PAY-00000005`), на CAPTURED-строках отсутствуют; Order `3f57c0c5-…` (MKT-ORD-00001001) — 2 PENDING → 2+2 кнопки, RU-подписи верны, enabled, ошибок нет; заголовки 7/7 канонические. Клик по confirm/cancel НЕ выполнялся (решение владельца).
10. Evidence: `docs/payments-registry-smoke.png` (реестр с 4 строками).
11. Данные — только контролируемые dev-заказы (§17); production не затрагивалась.

## 21. Typecheck

| Проект | Команда | Результат |
|---|---|---|
| frontend | `npx tsc --noEmit` | **EXIT=0** (до фикса, после Idempotency-Key и после reserved-фикса) |
| backend | `npx tsc --noEmit` | **EXIT=0** (после всех backend-правок сессии, вкл. reservedAmount/сообщения) |

## 22. Migration/schema

- Новые миграции (dev БД `travelhub1` применены):
  - `20261009100000_multi_partial_payments` — `DROP INDEX "finance"."Payment_one_active_per_order"` (снятие старого ограничения §3; due-guard переезжает на advisory lock + idempotency);
  - `20261009110000_payment_idempotency_slot` — `ADD COLUMN "Payment"."idempotencySlotKey" TEXT` + `CREATE UNIQUE INDEX "Payment_idempotencySlotKey_key"` (crash-window-3).
- Всего миграций в репо: 120.
- `backend/prisma/schema.prisma` содержит предсуществующие M4-диффы — по §18 не чистились (сознательно оставлены владельцу).
- Схема multi-тенантная (`order.*`, `finance.*`, `booking.*`, `security.*`); legacy-БД `travelhub` не трогалась.

## 23. Git status

- **NO COMMIT / NO PUSH** — соблюдено (§18/§19 prompt); последний коммит в истории: `75c6bea fix(request): keep convert action for product-less requests`.
- Working tree: **219 записей** (124 modified + 95 untracked, без учёта логов во временных папках):
  - backend: 130 (multi/partial payments + аудит нумераций §26: ids/reference-number сервисы и их спеки, storefront-concurrency e2e + pre-existing правки whatsapp/booking/catalog/permissions других сессий — не инспектировались/не коммитились);
  - frontend: 34 (payments registry/Order/Booking/PaymentsTable/CreatePaymentForm/lib + spec-ы, фикс Idempotency-Key);
  - docs: 47 (промпты, отчёты, скриншот smoke, runbook + sales-2.17C под §26);
  - корневые отчёты: 8 (M4/M5/STAGE1/STAGE2 и др., pre-existing).
- Инструкция владельца: отдельная команда на commit/push требуется.

## 24. Known limitations

1. **Pre-existing product-403** — commit `1ced16b` («Platform Create Product removed + server-side ownerless denial»): `POST /api/v1/products` от platform-актора → 403 «Commercial Product creation requires a Partner owner…». Ломает **9 e2e-сьютов на уровне харнесса** (список §19) — payments-код в них не достигается. По §18 не чинилось.
2. **partner-collect T4/T8 (403) и T12** — pre-existing, известны заранее, не регрессия.
3. **UI-confirm — частично закрыт**: `POST /payments/:code/confirm|cancel` теперь доступны из UI (кнопки в PaymentsTable при `finance.payment.manage`, §13); **fail остался API-only**; в смоуке confirm делался API-вызовом. Prompt §9/§10 UI-confirm не требовал — инкремент по запросу владельца.
4. **Полный e2e-прогон (~110 suites) уронил PostgreSQL** (host RAM 7.4 ГБ, heap 8192) — установлен режим пачек ≤5 suites / heap 4096; 52 leftover suite-БД удалены; лог инцидента `e2e-full.log`.
5. Smoke-данные остаются в dev-БД: 4 платежа на `MKT-ORD-00000501` (контролируемые данные, разрешено §17).
6. `refund-flow`/`chargeback-dispute-foundation` не могут сейчас подтвердить refund-взаимодействие e2e (блок product-403, п.1) — покрытие юнит-тестами.
7. Консоль Windows CP1251 искажает кириллицу в логах (косметика; проверялось по code points).
8. Автозапуск Chrome в `agent-browser` на этой машине нестабилен — smoke подключался к вручную поднятому Chrome по CDP.
9. **PAY-00000005** (PENDING 4585 на `MKT-ORD-00000901`) — создан владельцем до фикса, оставлен **без изменений** (сознательно): решает владелец — confirm (зачислить полной), cancel/fail (освободить остаток для partial-платежей). Пока он PENDING, доступно к созданию на этом заказе = 0,00 (теперь это видно в UI до отправки).

## 25. Final acceptance matrix (§20)

| Критерий | Статус | Evidence |
|---|---|---|
| Order 1300 → 300/500/400/100 → PAID (due 1000/500/100/0) | ✅ | e2e `multi-partial-payments` PASS (chain test:179) |
| Paid = 1300, Due = 0, Status = PAID | ✅ | тот же e2e + live: 3659→paid, due 0, `paymentStatus=PAID` |
| Количество платежей = unlimited | ✅ | e2e unlimited-count + smoke: 4 UI-платежа подряд |
| Due=300: 300 valid; 300.01 / 0 / −1 rejected | ✅ | `payment.service.spec` (формат/>due/zero/negative → 422) + `CreatePaymentForm` validation tests + live (due=0 → amount 0 blocked) |
| Таблица `№/Дата/Сумма/Остаток/Форма оплаты/Статус/Кто принял` | ✅ | 7/7 headersMatch на Registry/Order/Booking (smoke, code-point сверка) |
| Центр управления → Платежи → Создать платеж | ✅ | smoke: create ×4, пустой→4 строки, empty-state |
| Order → Создать платеж | ✅ | `order-create-payment-button`, preset fixed, due-guard живой |
| Booking → Создать платеж | ✅ | `booking-create-payment-button`, fixed = `linkedOrder.id` |
| Booking использует `linkedOrder.id` | ✅ | диалог fixed `MKT-ORD-00000501` для booking `c75046ae-…` |
| Analytics payment cards работают | ✅ | «платежей 4 / захвачено 3 659,00 $», analytics-foundation e2e PASS, файлы analytics не изменены |
| Backend — financial authority | ✅ | due-guard 422/409, advisory lock, idempotency replay; фронт только convenience |
| PENDING резервирует остаток, UI показывает доступно | ✅ | live 0901: `reservedAmount` в GET, hint/default `0.00`/blocked, 422 «reserved by active payments» + юниты BE/FE |
| Кнопки Подтвердить/Отменить для PENDING (admin/finance) | ✅ | PaymentsTable +5 spec, live реестр (3 PENDING) и Order 1001 (2 PENDING), RU/AZ/EN, 7/7 headers сохранены |
| Нумерации сплошные, Hi/Lo удалён, хвосты не сгорают | ✅ | §26: unit 156/2552, e2e storefront-concurrency 7/7 («ровно +1» live), счётчики выровнены |
| NO COMMIT / NO PUSH | ✅ | git status §23 |

**Итог: PASS.** Остаётся только pre-existing блок product-403 (§24.1) — вынесен владельцу отдельно от данного инкремента.

## 26. Аудит нумераций — сплошные последовательности (отказ от Hi/Lo)

Запрос владельца: «сделай аудит всех нумераций и там где они есть сделай сплошными и чтобы не сжигались хвосты блоков; если надо откажись от hi/lo блочной аллокации кодов».

### 26.1 Что найдено

- **Два Hi/Lo-аллокатора** (источник прыжков 1→101 и сжигания хвостов блока при рестарте): `src/shared/ids.service.ts` (`BUSINESS_SEQUENCE_BLOCK_SIZE`=100, in-memory кэш + claim-гейты, `seqClient`) и `src/shared/reference-number.service.ts` (`REFERENCE_SEQUENCE_BLOCK_SIZE`=100, те же кэш/гейты) — оба покрывают **все** бизнес-коды (ORD/REQ/PAY/PRD/USR/…, TH-YYYY, SF001) и **все** reference-номера (MKT-*/SF*-*/SAAS-*).
- **Уже сплошные**: приватный `nextCode` в `storefront-billing.service.ts` (SC/SINV/SPAY) — `SELECT max(code)+1`.
- **Дефект интерлива**: внутренний `SF-0000000N` (`nextCode(tx,"SF")`) и публичный `SF00N` (`nextStorefrontCode`) делили ОДНУ строку "SF" → публичные коды шли через один (SF002, SF004, …).
- **Мёртвый код**: `order.service.ts:848 generateOrderReferenceNumber` (private, без вызовов — вытеснен commerceSequence-путём).
- **Legacy-строки** `REFSEQ:{p}:{t}` (без `REF:`) текущим кодом не читаются: их инфляция (до 24650) накоплена старой concurrency-спекой, которая инкрементировала живые ключи; спека переведена на изолированное пространство `REFSEQ:CONCURRENCY-TEST:*`.
- **Кривые tx-вызовы** `nextCode(null as any, …)` / `nextCommerceSequence(null as any)` (`tour-request`, `azal.controller`, `order.request`) — аллокация без транзакции (autocommit на глобальном клиенте).

### 26.2 Что сделано

1. **Hi/Lo удалён** в обоих сервисах: одна аллокация = ровно один атомарный upsert `value += 1` на клиенте доменной tx (или на глобальном `prisma`, если tx не передан). In-memory состояния нет → **рестарт процесса ничего не сжигает**, откат доменной tx **возвращает** номер счётчику, multi-instance безопасность — на row-lock строки PG.
2. **SF/SFPUB разделены**: `nextStorefrontCode` теперь ведёт отдельную строку `SFPUB` — обе последовательности сплошные, без интерлива (в dev-БД строк SF ещё не было → миграция не потребовалась).
3. **Спеки переписаны** (+4 теста: сплошность 1..101 без «блоков», перезапуск продолжает последовательность, tx-пропагация, разделение SF/SFPUB); `reference-number.concurrency.spec.ts` оставлена на increment+1, но с изолированными ключами.
4. **E2E** `storefront-concurrency.e2e-spec.ts`: «ровно +1 на создание на обоих счётчиках», «storefrontCode зеркалит SFPUB» — **7/7 PASS**.
5. **Счётчики dev-БД выровнены** к видимым максимумам (скан всех code-like / `referenceNumber` / `commerceSequence` колонок; скрипт dry-run → apply, обновлено 30 строк):

| prefix | было | видимый макс. | стало |
|---|---|---|---|
| APP | 100 | 1 | **1** |
| BKG | 200 | 101 | **101** |
| CML | 3700 | 3621 | **3621** |
| CPR | 300 | 204 | **204** |
| CUS | 500 | 401 | **401** |
| MKR | 100 | 1 | **1** |
| ORD | 500 | 401 | **401** |
| PAR | 200 | 101 | **101** |
| PAY | 200 | 102 | **102** |
| PRD | 1586 | 1287 | **1287** |
| REQ | 1100 | 1001 | **1001** |
| SELL | 100 | 1 | **1** |
| SUP | 100 | 2 | **2** |
| TH-2026 | 600 | 501 | **501** |
| TRF | 400 | 301 | **301** |
| UNI | 400 | 201 | **201** |
| USR | 400 | 301 | **301** |
| REFSEQ:REFSEQ:COMMERCE:ROOT | 1100 | 1001 | **1001** |
| REFSEQ:MKT:ORD (legacy) | 24650 | 1001 | **1001** |
| REFSEQ:MKT:PAY / SF001:* / SF002:* / SF003:* (legacy) | 1450…24650 | 0 (данных нет) | **0** |
| REFSEQ:CONCURRENCY-TEST:* (9 строк) | — | тестовые | не тронуты |
| + созданы live `REFSEQ:REF:MKT:ORD/BKG/REQ` | — | 1001 / 803 / 1001 | следующий номер продолжит видимый максимум |

6. **Доки**: `load-performance-qualification-runbook.md` и `sales-structural-decomposition-2.17C.md` обновлены на текущее состояние; исторические отчёты Step 2.17B не переписывались (описывают прошлое состояние).

### 26.3 Осознанный компромисс и caveat

- **Перф**: инкремент в доменной tx держит row-lock счётчика до её commit → при 50-way бёрсте на одном prefix — сериализация (2.17B мерил p95 ~3.1s против ~148ms с Hi/Lo). По решению владельца сплошность приоритетнее; `BUSINESS_SEQUENCE_BLOCK_SIZE`/`REFERENCE_SEQUENCE_BLOCK_SIZE` кодом больше не читаются. Реальный e2e 20-way parallel storefront creations: PASS за 1761ms.
- **Autocommit-вызовы без tx**: при откате доменного шага после аллокации номер не возвращается (редкий +1 gap) — наследие legacy `null as any`-вызовов, задокументировано в `ids.service.ts`.
- **Два mechanisms refs** (commerceSequence-root `MKT-ORD-{root}` и независимый `MKT-ORD-{seq}` из `REFSEQ:REF:*`) выровнены на один видимый максимум, но формально остаются двумя счётчиками; коллизия возможна только в legacy-путях без `commerceSequence` (pre-existing дизайн; unique index `Order_referenceNumber_key` страхует ошибкой, не тихим дублем).

### 26.4 Evidence

- unit: **156 suites / 2552 tests GREEN**, `tsc --noEmit` EXIT=0; e2e: **storefront-concurrency 7/7 PASS**; сброс счётчиков: dry-run + apply (30 строк, вывод выше); backend перезапущен на новом коде, :4000 отвечает.
