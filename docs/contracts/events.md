# Event Catalog (Phase 1)

Envelope (все события):

```ts
{
  eventId: string;          // events.OutboxEvent.id
  aggregateType: string;    // "Product" | "Customer" | "Order" | "Booking"
  aggregateId: string;
  eventType: string;
  payload: Json;
  correlationId: string | null; // сквозной ID бизнес-процесса (как правило Order.code)
  causationId:   string | null; // ID события-родителя (трассировка)
  occurredAt:    Date;
}
```

## Издатели

| Событие | Издатель | Payload |
|---|---|---|
| `ProductCreated` | Catalog | `{ productId, code, title, type }` |
| `ProductPublished` | Catalog | `{ productId, code, title, type }` |
| `ProductArchived` | Catalog | `{ productId, code, title, type }` |
| `CustomerCreated` | CRM | `{ customerId, code, name, email }` |
| `CustomerUpdated` | CRM | `{ customerId, code, name, email, changedFields[] }` |
| `OrderCreated` | Order | `{ orderId, code, number, customerId, amount, currency }` |
| `OrderApproved` | Order | `{ orderId, code, customerId }` — готов к бронированию |
| `OrderCancelled` | Order | `{ orderId, code, customerId }` |
| `OrderStatusChanged` | Order | `{ from, to, reason?, actor? }` |
| `BookingRequested` | Order | `{ orderId, orderCode, customerId, items[], travelers[] }` |
| `BookingCreated` | Booking | `{ count, bookings[{id,code}], orderId }` |
| `BookingConfirmed` | Booking | `{ bookingId, code, orderId, productId }` |
| `BookingRejected` | Booking | `{ bookingId, code, orderId, productId, reason }` |
| `BookingCancelled` | Booking | `{ bookingId, code, orderId, productId }` |
| `BookingStatusChanged` | Booking | `{ from, to, bookingId, orderId, code }` |

## Подписчики

| Домен | Событие | Действие |
|---|---|---|
| **Booking** | `BookingRequested` | создаёт Booking (BKG-*) на каждый OrderItem + Passenger из COMPLETE OrderTraveler; идемпотентно (InboxEvent + проверка существующих броней) |
| **Order** | `BookingConfirmed` | реконсиляция агрегата: `SENT_TO_BOOKING → PARTIALLY_FULFILLED → FULFILLED` |
| **Order** | `BookingStatusChanged` (→ CONFIRMED/IN_SERVICE/COMPLETED) | реконсиляция агрегата |
| **Order** | `BookingRejected` | заказ → `PROBLEM` |

**Правило:** Order никогда не пишет в таблицы Booking и наоборот.
Взаимодействие — только события + чтение по ID.

## Механика (transactional outbox)

1. Домен в своей транзакции меняет сущность и вызывает `EventBusService.emit(tx, …)`
   — событие записывается в `events.OutboxEvent` **атомарно** с изменением.
2. После коммита домен вызывает `publishPending()` — диспетчер рассылает
   PENDING-события подписчикам и помечает их PUBLISHED (при ошибке — FAILED,
   событие сохраняется для повторной публикации).
3. События-результаты (`BookingCreated`, `OrderCreated` из consumer-ов)
   пишутся сразу PUBLISHED (фиксация факта в ленте, без повторной рассылки).
4. Идемпотентность consumer-ов: `events.InboxEvent` (unique consumerId+eventId).

Реализация: `backend/src/eventbus/eventbus.service.ts`,
`backend/src/eventbus/domain-events.ts`.
