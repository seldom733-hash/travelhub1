# Аудит жизненного цикла заявки, заказа и бронирования

Дата: 04.11.2026  
Статус: аудит текущей реализации, без изменения production-модели статусов.

## 1. Краткий вывод

Сейчас статус нельзя «просто переключить» вручную. Все переходы выполняются только командами:

- `POST /requests/:id/*` — заявка;
- `PATCH /orders/:id` с `action` — заказ;
- `PATCH /bookings/:id` с `action` — бронирование.

У администратора есть права на многие команды, но **нет инструмента «установить произвольный статус»**. Это одновременно и защита, и проблема: если бизнес-процесс зашёл в тупик, исправить статус через UI нельзя.

Также найдены разрывы:

- статусы `SUPPLIER_TIMEOUT`, `CUSTOMER_PAYMENT_TIMEOUT`, `EXPIRED` у заявки не выставляются ни одним кодом;
- `READY_TO_CLOSE` и `PARTIALLY_FULFILLED` у заказа не выставляются переходами;
- `AWAITING_CONFIRMATION` у брони не выставляется рабочим переходом (только seed);
- кнопки «Добавить платёж» в карточке сделки активны даже при нулевом долге и закрытом заказе;
- inline-редактирование заявки разрешено в `REJECTED`, `UNAVAILABLE`, `EXPIRED` — это терминальные состояния, редактировать их нельзя;
- нет общего guard «финансово закрыто → запретить изменения».

## 2. Текущая возможность ручного изменения статуса

### Заявка

| Команда | Право | Что меняет |
|---|---|---|
| `POST /requests/:id/start` | `order.edit_noncritical` | `NEW → CHECKING` |
| `POST /requests/:id/confirm-price` | `order.edit_noncritical` | `NEW/CHECKING → CONFIRMED` |
| `POST /requests/:id/propose-price` | `order.edit_noncritical` | `NEW/CHECKING → PRICE_CHANGED` |
| `POST /requests/:id/reject` | `order.edit_noncritical` | `NEW/CHECKING → REJECTED` |
| `POST /requests/:id/unavailable` | `order.edit_noncritical` | `NEW/CHECKING → UNAVAILABLE` |
| `POST /requests/:id/customer-accept` | `order.edit_noncritical` | `PRICE_CHANGED/CONFIRMED → CUSTOMER_ACCEPTED` |
| `POST /requests/:id/customer-decline` | `order.edit_noncritical` | `PRICE_CHANGED/CONFIRMED → CANCELLED_BY_CUSTOMER` |
| `POST /requests/:id/convert` | `order.edit_noncritical` | `CUSTOMER_ACCEPTED → CONVERTED` |

Произвольного `PATCH /requests/:id/status` нет.

### Заказ

| Action | Право | Переход |
|---|---|---|
| `process` | `order.accept` | `NEW → IN_PROCESSING` |
| `markWaitingData` | `order.edit_noncritical` | `IN_PROCESSING → WAITING_FOR_DATA` |
| `resumeProcessing` | `order.edit_noncritical` | `WAITING_FOR_DATA → IN_PROCESSING` |
| `confirm` | `order.edit_noncritical` | `IN_PROCESSING/WAITING_FOR_DATA → READY_FOR_BOOKING` |
| `send` | `order.request_booking` | `READY_FOR_BOOKING/PARTIALLY_FULFILLED → SENT_TO_BOOKING` |
| `complete` | `order.edit_noncritical` | `SENT_TO_BOOKING/PARTIALLY_FULFILLED → FULFILLED` |
| `close` | `order.close` | `FULFILLED/READY_TO_CLOSE → CLOSED` |
| `cancel` | `order.cancel` | любой активный → `CANCELLED` |
| `problem` | `order.edit_noncritical` | любой активный → `PROBLEM` |
| `suspend` | `order.suspend` | любой активный → `SUSPENDED` |
| `returnToRequest` | `order.cancel` | активный → `CANCELLED` + возврат заявки |

Произвольного `PATCH /orders/:id/status` нет. `PATCH /orders/:id` принимает только `action`.

### Бронирование

| Action | Право | Переход |
|---|---|---|
| `prepare` | `booking.send_supplier` | `NEW → PREPARING_REQUEST` |
| `send` | `booking.send_supplier` | `NEW/PREPARING_REQUEST → SENT_TO_SUPPLIER` |
| `requestClarification` | `booking.confirm` | `SENT_TO_SUPPLIER/AWAITING_CONFIRMATION → NEEDS_CLARIFICATION` |
| `resume` | `booking.confirm` | `NEEDS_CLARIFICATION → SENT_TO_SUPPLIER` |
| `confirm` | `booking.confirm` | `SENT_TO_SUPPLIER/AWAITING_CONFIRMATION → CONFIRMED` |
| `reject` | `booking.confirm` | `SENT_TO_SUPPLIER/AWAITING_CONFIRMATION → SUPPLIER_REJECTED` |
| `service` | `booking.confirm` | `CONFIRMED → IN_SERVICE` |
| `requestChange` | `booking.request_change` | `CONFIRMED/IN_SERVICE → CHANGE_REQUESTED` |
| `resolveChange` | `booking.request_change` | `CHANGE_REQUESTED → CONFIRMED` |
| `requestCancellation` | `booking.cancel` | `CONFIRMED/IN_SERVICE/CHANGE_REQUESTED/NEEDS_CLARIFICATION → CANCELLATION_REQUESTED` |
| `complete` | `booking.confirm` | `IN_SERVICE → COMPLETED` |
| `cancel` | `booking.cancel` | любой активный → `CANCELLED` |
| `problem` | `booking.confirm` | любой активный → `PROBLEM` |
| `returnToOrder` | `booking.return_to_order` | см. отдельные guards |

## 3. Полные условия переходов

### 3.1 Заявка: от создания до заказа

#### Создание

`POST /requests` создаёт заявку в `NEW`.

Условия:

- выбран клиент/продукт или передан snapshot;
- `travelerCount` — положительное целое;
- состав туристов, если передан, совпадает с `travelerCount`;
- создаётся `commerceSequence` и `MKT-REQ-*`;
- создаётся `supplierResponseDeadline` (по умолчанию 48 часов);
- заявка попадает в авто-распределение или в очередь `QUEUED`.

#### `NEW → CHECKING`

Условия:

- статус ровно `NEW`;
- есть право `order.edit_noncritical`;
- устанавливаются `processingStartedAt`, `firstOpenedAt` (если пусто);
- пишется история `PROCESSING_STARTED`.

#### `NEW/CHECKING → CONFIRMED`

Условия:

- статус `NEW` или `CHECKING`;
- поставщик подтвердил цену;
- записываются `supplierRespondedAt`, `supplierDecision=CONFIRMED`;
- `confirmedPrice` становится актуальной ценой.

#### `NEW/CHECKING → PRICE_CHANGED`

Условия:

- статус `NEW` или `CHECKING`;
- новая цена > 0;
- создаётся `customerActionDeadline` (+48 часов);
- клиент должен принять или отклонить новую цену.

#### `NEW/CHECKING → REJECTED`

Условия:

- поставщик отклонил заявку;
- терминальное состояние;
- дальнейшие действия по заявке запрещены.

#### `NEW/CHECKING → UNAVAILABLE`

Условия:

- услуга недоступна;
- терминальное состояние.

#### `PRICE_CHANGED/CONFIRMED → CUSTOMER_ACCEPTED`

Условия:

- статус `PRICE_CHANGED` или `CONFIRMED`;
- `customerActionDeadline` не истёк;
- фиксируются `customerAcceptedAt`, итоговая цена, состав туристов;
- **туристы на этом шаге не обязательны** — они заполняются в карточке реестра после принятия;
- после этого возможна конвертация в заказ.

#### `PRICE_CHANGED/CONFIRMED → CANCELLED_BY_CUSTOMER`

Условия:

- клиент отказался;
- терминальное состояние;
- дальнейшая конвертация невозможна.

#### `CUSTOMER_ACCEPTED → CONVERTED`

Условия:

- статус ровно `CUSTOMER_ACCEPTED`;
- есть `customerAcceptedAt` и `travelerCount`;
- состав туристов полный и совпадает с `travelerCount`;
- создаётся ровно один `Order` на `commerceSequence`;
- повторная конвертация запрещена;
- заявка становится терминальной `CONVERTED`.

### 3.2 Заказ

#### `NEW → IN_PROCESSING`

Условия:

- заказ в `NEW`;
- право `order.accept`;
- заказ не Storefront-tenant, запрещённый для platform scope.

#### `IN_PROCESSING → WAITING_FOR_DATA`

Условия:

- заказ в `IN_PROCESSING`;
- право `order.edit_noncritical`.

#### `WAITING_FOR_DATA → IN_PROCESSING`

Условия:

- заказ в `WAITING_FOR_DATA`;
- право `order.edit_noncritical`.

#### `IN_PROCESSING/WAITING_FOR_DATA → READY_FOR_BOOKING`

Условия:

- все туристы имеют `dataCompleteness=COMPLETE`;
- для D3-заказа (`travelerCount>0` и `termsAcceptedAt!=null`) обязателен `finalConfirmedAt`;
- иначе 422.

#### `READY_FOR_BOOKING/PARTIALLY_FULFILLED → SENT_TO_BOOKING`

Условия:

- есть хотя бы одна свободная `OrderItem`;
- активная бронь не занимает все items;
- legacy-бронь без `orderItemId` блокирует отправку;
- D3-заказ должен иметь `finalConfirmedAt`.

#### `SENT_TO_BOOKING/PARTIALLY_FULFILLED → FULFILLED`

Условия:

- заказ в `SENT_TO_BOOKING` или `PARTIALLY_FULFILLED`;
- право `order.edit_noncritical`;
- финансовые условия **не проверяются**.

#### `FULFILLED/READY_TO_CLOSE → CLOSED`

Условия:

- заказ в `FULFILLED` или `READY_TO_CLOSE`;
- право `order.close`;
- финансовые условия **не проверяются**.

#### Любой активный → `CANCELLED`

Условия:

- заказ не в терминальном `CLOSED`/`CANCELLED`;
- право `order.cancel`;
- активные брони и платежи **не блокируют** обычную отмену.

#### Любой активный → `PROBLEM` / `SUSPENDED`

Условия:

- статус не равен целевому;
- соответствующее право.

#### `returnToRequest`

Условия:

- есть связанная заявка;
- заявка в `CONVERTED`;
- нет активных броней;
- нет платежей;
- нет возвратов;
- иначе 409.

### 3.3 Бронирование

#### `NEW → PREPARING_REQUEST`

Условия:

- бронь в `NEW`;
- право `booking.send_supplier`.

#### `NEW/PREPARING_REQUEST → SENT_TO_SUPPLIER`

Условия:

- есть право `booking.send_supplier`;
- заказ не в `CANCELLED`/`CLOSED`.

#### `SENT_TO_SUPPLIER/AWAITING_CONFIRMATION → CONFIRMED`

Условия:

- право `booking.confirm`;
- заказ не в `CANCELLED`/`CLOSED`.

#### `SENT_TO_SUPPLIER/AWAITING_CONFIRMATION → SUPPLIER_REJECTED`

Условия:

- право `booking.confirm`;
- заказ не терминальный.

#### `CONFIRMED → IN_SERVICE`

Условия:

- бронь подтверждена;
- право `booking.confirm`.

#### `IN_SERVICE → COMPLETED`

Условия:

- бронь в `IN_SERVICE`;
- право `booking.confirm`.

#### `CONFIRMED/IN_SERVICE → CHANGE_REQUESTED`

Условия:

- право `booking.request_change`.

#### `CHANGE_REQUESTED → CONFIRMED`

Условия:

- изменение согласовано;
- право `booking.request_change`.

#### `CONFIRMED/IN_SERVICE/CHANGE_REQUESTED/NEEDS_CLARIFICATION → CANCELLATION_REQUESTED`

Условия:

- право `booking.cancel`;
- запрошена отмена.

#### Любой активный → `CANCELLED`

Условия:

- право `booking.cancel`;
- заказ не в `CANCELLED`/`CLOSED` (кроме безопасного сведения к терминальному).

#### `returnToOrder`

Условия:

- direct-ветка: бронь ещё не подтверждена → `CANCELLED`;
- phase-2: бронь уже `CANCELLED`/`SUPPLIER_REJECTED` → меняется только агрегат заказа;
- `CONFIRMED/IN_SERVICE/CHANGE_REQUESTED/CANCELLATION_REQUESTED` → 409 до подтверждённой отмены;
- `COMPLETED` → 409.

## 4. Финансовые блокировки

### Платёж клиента

Backend `PaymentService`:

- заказ не в `CANCELLED`/`CLOSED`;
- `0 < amount <= available`;
- `available = order.amount − captured − pending/reserved`;
- без суммы списывается весь остаток;
- идемпотентность обязательна.

Проблема UI:

- кнопка «+ Добавить платёж» показывается при `orderId`, даже если `clientDebt=0`;
- кнопка активна для `CLOSED`/`CANCELLED`;
- backend отклонит, но пользователь видит рабочую кнопку.

### Платёж поставщику

- создаётся против `SupplierObligation`;
- распределение не может превысить `remainingAmount`;
- только `CONFIRMED` уменьшает долг;
- переплата по обязательству запрещена.

Проблема UI: кнопка доступна при `supplierDebt=0`.

### Возврат

- `Создать возврат` показывается всегда;
- должен быть недоступен, если нет полученных платежей.

## 5. Найденные дефекты и риски

1. **Нет административного force-status.** Админ может только выбирать доступные lifecycle-команды.
2. **Нет автоматических timeout-переходов заявки.** `SUPPLIER_TIMEOUT`, `CUSTOMER_PAYMENT_TIMEOUT`, `EXPIRED` не выставляются.
3. **`READY_TO_CLOSE` и `PARTIALLY_FULFILLED` не выставляются.** Статусы существуют, но переходов в них нет.
4. **`AWAITING_CONFIRMATION` у брони не выставляется.** Только seed.
5. **`close` и `complete` не проверяют долг клиента/поставщика.** Закрыть можно с непогашенным долгом.
6. **UI платежей не блокируется при нулевом долге/закрытом заказе.**
7. **Inline-edit заявки разрешён в `REJECTED`/`UNAVAILABLE`/`EXPIRED`.** Терминальные статусы должны быть read-only.
8. **`CANCELLED` заказ можно `problem`/`suspend`?** Нет, active list не включает CANCELLED; проверено.
9. **Нет единого признака `financialLocked`.** Каждый экран решает сам.
10. **Возврат в заявку** разрешён только без платежей/возвратов, но UI не показывает причину заранее.

## 6. Предлагаемый инструмент администратора

Не давать прямой `UPDATE status`. Нужен контролируемый «Force Status»:

```text
POST /admin/lifecycle/:entity/:id/force-status
```

Body:

```json
{
  "status": "PROBLEM",
  "reason": "Поставщик не выходит на связь",
  "expectedVersion": 7,
  "confirmFinancialRisk": true
}
```

Правила:

- только `ADMIN`;
- обязательный `reason`;
- `expectedVersion` — защита от конкурентного изменения;
- разрешены только статусы, для которых есть безопасный путь;
- запрещено обходить финансовые инварианты без `confirmFinancialRisk`;
- запись в историю: кто, когда, из какого статуса, причина;
- событие `StatusForced` в outbox;
- не выполнять побочные финансовые операции автоматически.

Для заявки force-status должен быть ограничен:

```text
NEW, CHECKING, PROBLEM? — нет PROBLEM в enum
```

Поэтому для заявки нужен отдельный список допустимых ручных статусов, иначе придётся расширять enum.

## 7. Предлагаемые правила блокировки

### Заявка

- `REJECTED`, `UNAVAILABLE`, `EXPIRED`, `CANCELLED_BY_CUSTOMER`, `CONVERTED` — read-only для всех, кроме admin force.
- `CONVERTED` — нельзя менять коммерческие поля, но можно смотреть.

### Заказ

- `CLOSED`, `CANCELLED` — read-only.
- `FULFILLED` — нельзя добавлять услуги и платежи, можно закрыть.
- `clientDebt <= 0` — кнопка платежа клиента disabled.
- `supplierDebt <= 0` — кнопка платежа поставщику disabled.
- `clientReceived <= 0` — возврат disabled.
- `close` требует `clientDebt <= 0` и `supplierDebt <= 0`, иначе 409.
- `complete` не требует оплаты, но после `FULFILLED` оплата разрешена до `CLOSED`.

### Бронирование

- `COMPLETED`, `CANCELLED`, `SUPPLIER_REJECTED` — read-only.
- `CANCELLATION_REQUESTED` — нельзя `service`/`complete`.
- `IN_SERVICE` — нельзя `reject`.

## 8. Что нужно решить бизнесу

1. Можно ли закрыть заказ с долгом клиента?
2. Можно ли закрыть заказ с долгом поставщику?
3. Должен ли `complete` требовать полной оплаты?
4. Нужны ли автоматические timeout-переходы заявки, и кто их запускает?
5. Нужен ли `PROBLEM` для заявки, или достаточно текущих статусов?
6. Должен ли администратор иметь право откатывать `CLOSED`/`CANCELLED`?
7. Нужен ли отдельный статус «финансово закрыт» вместо вычисляемого `clientDebt=0`?

## 9. Следующий шаг

1. Утвердить правила закрытия и блокировок.
2. Утвердить список статусов, доступных для force-status.
3. Реализовать `financialLocked` в BFF-агрегате сделки.
4. Отключить кнопки платежей/возвратов по `clientDebt`/`supplierDebt`/статусу.
5. Добавить admin force-status с аудитом.
