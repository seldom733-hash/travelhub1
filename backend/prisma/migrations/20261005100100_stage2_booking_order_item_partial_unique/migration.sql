-- Stage 2 (Booking → Order, Q9): orderItemId @unique → PARTIAL unique.
--
-- Было: 1 OrderItem → ≤1 Booking навсегда (field-level unique constraint).
-- Стало: 1 OrderItem → ≤1 « занимающей » Booking: CANCELLED/SUPPLIER_REJECTED
-- не занимают item (после returnToOrder/reject повторный send создаёт B2 по
-- тому же item; старая бронь никогда не удаляется — durable history).
--
-- Предел индекса (Prisma @@unique where допускает только eq/not на полях,
-- поэтому NOT IN через две колонки):
--   status <> 'CANCELLED'  — отменённая бронь (в т.ч. born-CANCELLED,
--                            компенсация OrderCancelled, returnToOrder) свободна;
--   rejectedAt IS NULL     — отклонённая поставщиком бронь (reject ставит
--                            rejectedAt milestone first-only; SUPPLIER_REJECTED
--                            терминален, reopened-путей нет) свободна;
--   иначе (все активные + COMPLETED) — бронь занимает item (COMPLETED по Q9
--   блокирует переотправку исполненного item).
--
-- Имя объекта СОХРАНЕНО (Booking_orderItemId_key): P2002-контракт
-- booking-requested-consumer (isUniqueViolation) и e2e-инвариант
-- «дубль create по orderItemId → Booking_orderItemId_key» не меняются.
-- NULL orderItemId (legacy) не участвует в unique (Postgres NULLs distinct).

-- 1. Drop field-level unique (Prisma @unique создаёт UNIQUE INDEX, не CONSTRAINT)
DROP INDEX "booking"."Booking_orderItemId_key";

-- 2. Recreate as partial unique index under the same name
CREATE UNIQUE INDEX "Booking_orderItemId_key" ON "booking"."Booking"("orderItemId")
  WHERE ("status" <> 'CANCELLED' AND "rejectedAt" IS NULL);

-- 3. Plain index для полных поисков по orderItemId (в т.ч. terminal-брони)
CREATE INDEX "Booking_orderItemId_idx" ON "booking"."Booking"("orderItemId");
