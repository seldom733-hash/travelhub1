# Phase 1 — Definition of Done

Статус: **выполнено** (проверяется e2e-тестом `backend/test/phase1.e2e-spec.ts`).

## Чек-лист

- [x] У каждой сущности ровно один домен-владелец (модели/таблицы не продублированы):
      `catalog.*`, `crm.*`, `order.*`, `booking.*`.
- [x] Ни один домен не делает прямых записей в таблицы чужой схемы.
- [x] Междоменные связи — через события или чтение по ID (без FK между схемами).
- [x] ID в формате `PRD-/ORD-/BKG-/CUS-00000001`, `TH-YYYY-######` — неизменяемы,
      генерируются доменом-владельцем (атомарный счётчик).
- [x] Полный сценарий Product → Order → Booking проходит end-to-end,
      статусы синхронизируются событиями (Order: `SENT_TO_BOOKING →
      PARTIALLY_FULFILLED → FULFILLED → CLOSED`).
- [x] Order без обязательных данных (паспорта туристов) не может стать
      `READY_FOR_BOOKING` (422).
- [x] Повторный `BookingRequested` не создаёт второй Booking (идемпотентность).
- [x] `BookingConfirmed` обновляет агрегированное состояние Order.
- [x] Все 4 экрана имеют одинаковую структуру
      (Header / Filters / KPI / Workspace / Side Panel).
- [x] Журнал изменений (audit) для Product, Customer, Order, Booking
      (*_history таблицы + записи при каждом переходе).
- [x] Трассировка: correlationId = Order.code, causationId связывает цепочку
      `OrderReadyForBooking → BookingRequested → BookingCreated → BookingConfirmed`
      (Step 1.14: бывш. `OrderApproved` переименован в canonical `OrderReadyForBooking`).
- [x] E2E-тест полного сценария (Jest + Supertest) проходит.

## Сквозной сценарий (проверено e2e)

```text
POST /products → PRD-00000001 (DRAFT)
POST /products/:id/publish → PUBLISHED (ProductPublished)
POST /customers → CUS-00000001 (CustomerCreated)
POST /orders/bootstrap → ORD-00000001 + TH-2026-000001 (OrderCreated)
PATCH /orders/:id {action: process} → IN_PROCESSING
PATCH /orders/:id {action: confirm} → READY_FOR_BOOKING (OrderReadyForBooking)
PATCH /orders/:id {action: send}    → SENT_TO_BOOKING (BookingRequested)
  → consumer создаёт BKG-00000001 + Passenger
PATCH /bookings/:id {action: send}    → SENT_TO_SUPPLIER
PATCH /bookings/:id {action: confirm} → CONFIRMED (BookingConfirmed)
  → Order → PARTIALLY_FULFILLED (реконсиляция)
PATCH /bookings/:id {action: service} → IN_SERVICE
PATCH /bookings/:id {action: complete} → COMPLETED
  → Order → FULFILLED
PATCH /orders/:id {action: complete} → FULFILLED (OrderFulfilled)
PATCH /orders/:id {action: close} → CLOSED (OrderClosed)
```

## За пределами Phase 1 (следующие фазы)

- Sales Center (Lead → Opportunity → Quote → Sale → `OrderRequested`) — Phase 2;
- Finance, Marketing, Support, Documents, Calendar, Reports, Integrations, AI;
- RBAC-матрица и auth (задел заложен: `createdBy/updatedBy`, actor в аудите);
- публичная витрина (маркетплейс), поставщики (Supplier flow в Booking).
