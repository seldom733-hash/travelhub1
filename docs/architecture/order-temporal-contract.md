# Order Temporal Contract (Phase 2 — Step 2.5A)

## 1. Mission

Зафиксировать честную temporal-семантику Order: каждый milestone отражает
реальный business transition, а не `updatedAt`.

```text
Order.createdAt      — момент создания записи (system fact)
Order.submittedAt    — момент принятия заказа в работу (buyer submit / bootstrap)
Order.confirmedAt    — подтверждение (staff/admin confirm)
Order.fulfilledAt    — исполнение (reconcile через Booking FULFILLED-события)
Order.closedAt       — закрытие заказа (terminal)
Order.cancelledAt    — отмена (terminal)
```

Правило: `updatedAt` НЕ используется как дата заказа/оплаты/брони. Если
canonical timestamp отсутствует — поля `null` (честная семантика), UI
показывает меньше информации, а не выдуманную дату.

## 2. Owner boundaries

| Домен | Владеет | Роль в 2.5A |
|---|---|---|
| Order | Order + milestone-колонки | пишет только свои поля на своих переходах |
| Sales | Sale/Quote/CheckoutIntent | не участвует (temporal — Order-internal) |
| Booking | Booking lifecycle | source-факты для `fulfilledAt` (reconcile) |
| EventBus | Outbox/Inbox | `occurredAt` в history/events сохраняется |

## 3. Schema change

Additive, без backfill (легаси-строки остаются `null`):

- `submittedAt DateTime?` — оба create-пути (consumer `createOrderFromRequested`
  и bootstrap) пишут `new Date()` в одной транзакции с Order-графом.
- `confirmedAt DateTime?` — переход подтверждения.
- `fulfilledAt DateTime?` — reconcile: `OrderSubscribers` на booking-событиях
  (`FULFILLED`-переход) проставляет, когда все fulfillment-строки исполнены.
- `closedAt DateTime?`, `cancelledAt DateTime?` — терминальные переходы,
  детерминированные guards (нельзя closed+cancelled одновременно).

Миграция `add_order_temporal_contract` — чисто additive (FK отсутствуют),
проверена `migrate status` (29 migrations, up to date) и replay в e2e
globalSetup.

## 4. Semantics

- Терминальность: `closedAt` и `cancelledAt` — взаимоисключающие; повторные
  переходы детерминированы (guard + history fact).
- Reconcile `fulfilledAt` — идемпотентный (проставляет только если ещё `null`).
- Timestamps — UTC (платформенная конвенция).
- History/events сохраняют `occurredAt` (не переиспользуют `updatedAt`).

## 5. Tests

`test/order-temporal-contract.e2e-spec.ts` (10): consumer-путь пишет
`submittedAt`; bootstrap-путь пишет `submittedAt`; confirm → `confirmedAt`;
reconcile → `fulfilledAt`; close → `closedAt`; cancel → `cancelledAt`;
closed+cancelled несовместимы; `updatedAt` не подменяет milestones;
staff-read видит milestones; легаси-строка без перехода — честный `null`.

Полный serial e2e: 580/580 (39 suites), unit 314/314, frontend tsc/vitest
(135)/build — green.
