# Booking Temporal Contract (Step 2.9A)

## 1. Purpose

Зафиксировать сервер-owned temporal-факты жизненного цикла Booking как
первоклассный read-model контракт для будущих фаз (Order/Booking reconciliation,
Support, документы, Finance). `updatedAt` не является бизнес-датой.

## 2. Milestone vocabulary

| Column | Producer | Значение |
|---|---|---|
| `requestedAt` | `bookingAction(send)` | Момент отправки запроса поставщику (NEW → PREPARING_REQUEST) |
| `confirmedAt` | `bookingAction(confirm)` | Момент подтверждения (→ CONFIRMED) |
| `rejectedAt` | `bookingAction(reject)` | Момент отказа поставщика (→ SUPPLIER_REJECTED) |
| `cancelledAt` | `bookingAction(cancel)` / компенсация / born-CANCELLED | Момент отмены |
| `completedAt` | `bookingAction(complete)` | Момент завершения (→ COMPLETED) |

Все значения — UTC instants, сервер-generated, устанавливаются **внутри того же
CAS-transaction**, что и переход статуса.

## 3. Invariants

1. **First-only:** milestone пишется только при первом переходе в статус; повторный
   transition (или повторная компенсация) не перезаписывает.
2. **Atomicity:** статус и milestone — один логический переход (одна транзакция,
   CAS `version` guard); событие/история — тот же outbox batch.
3. **Терминальный milestone ровно один** для терминальных состояний:
   SUPPLIER_REJECTED → `rejectedAt`; COMPLETED → `completedAt`; CANCELLED →
   `cancelledAt`. Активная броня не имеет терминального milestone.
4. **Историческая честность:** при гонке confirm/компенсация возможны оба честных
   interleaving — `confirmedAt=null` (confirm проиграл guard) либо
   `confirmedAt <= cancelledAt` (confirm выиграл, компенсация позже).
   `confirmedAt > cancelledAt` невозможен.
5. **born-CANCELLED:** компенсация до создания (OrderCancelled раньше
   BookingRequested) создаёт бронь сразу `CANCELLED` с `cancelledAt = createdAt`.
6. **forged запрещён:** любой milestone в PATCH-теле → 422
   (`assertNoForbiddenKeys`); поле отсутствует в DTO/сериализации write-контракта.
7. **`updatedAt` ≠ бизнес-дата:** обновления конфигурации не двигают milestones.

## 4. Write-path authority

Единственные writers Booking-состояния (из Step 2.9 audit):

1. `booking.subscribers.ts` create — BookingRequested consumer (born-CANCELLED
   ветка);
2. `booking.service.ts` `bookingAction` — canonical lifecycle (CAS + milestone);
3. `booking.subscribers.ts` compensation — CAS-обновление активной брони
   (`cancelledAt`) при OrderCancelled.

Cross-domain writers: 0.

## 5. Order feedback

`BookingStatusChanged` (техн.) — единственный сигнал Order-side reconcile.
Milestone-поля не передаются в событии: Order реконсилит только статусный факт;
temporal-факты читаются из Booking read-model по `bookingId`.

## 6. Concurrency

CAS (`version`) на каждый transition; гонки confirm/confirm, confirm/reject,
confirm/cancel, complete/cancel, компенсация/command → один победитель, ровно
один milestone, loser → 409/404, raw 500 отсутствуют. Duplicate компенсация
(replay) идемпотентна: `cancelledAt` не меняется, side effects (Finance,
Availability, service-time) отсутствуют.

## 7. Migration

46_booking_temporal_milestones: 5 аддитивных `DateTime?` колонок на `Booking`.
Backfill не требуется (legacy брони — без milestone-фактов; отсутствие —
честный NULL, не фабрикация). No `db push`; `migrate deploy` + replay clean.
