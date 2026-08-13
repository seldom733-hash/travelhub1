/**
 * PHASE 2 STEP 2.8 — Booking lifecycle validation (anti-mass-assignment, §28).
 *
 * Конвенция проекта (Sales/Reverse/Catalog/Order): forged server-owned поля на
 * command-эндпоинтах → ЯВНЫЙ 422 (`assertNoForbiddenKeys`), а не silent-strip
 * через ValidationPipe whitelist. Booking — canonical факты (frozen money,
 * acquisitionSource, ownership refs), поэтому lifecycle PATCH принимает ТОЛЬКО
 * `action` (создание — исключительно consumer BookingRequested, POST /bookings
 * не существует). Всё остальное — server-owned → 422 (loud).
 */

/**
 * Lifecycle-команда `PATCH /bookings/:id` принимает ТОЛЬКО `action`.
 * Все server-owned поля Booking (identity, ownership/provenance refs, frozen
 * money/currency, acquisitionSource, status/milestones, version, actor/
 * correlation, history, child-graph) запрещены → 422.
 */
export const BOOKING_ACTION_FORBIDDEN_KEYS = [
  // identity
  "id",
  "code",
  // ownership / provenance refs (server-derived, canonical linkage)
  "orderId",
  "orderCode",
  "orderItemId",
  "productId",
  "productCode",
  "customerId",
  "partnerId",
  "sellerId",
  "saleId",
  // lifecycle
  "status",
  "paymentStatus",
  // money / commercial facts (frozen, никогда client-authoritative)
  "amount",
  "currency",
  "paidAmount",
  "subtotal",
  "total",
  "price",
  // acquisition (server-copied frozen факт, Step 2.5B)
  "acquisitionSource",
  "source",
  // serviceDate + Step 2.8A temporal факты (server-owned из Order snapshot;
  // zone/instants/type — immutable frozen occurrence → 422, не silent-strip)
  "serviceDate",
  "serviceTime",
  "serviceEndTime",
  "serviceTimeZone",
  "serviceTimezone",
  "serviceTimeType",
  "serviceStartsAt",
  "serviceEndsAt",
  // temporal
  "createdAt",
  "updatedAt",
  "confirmedAt",
  "cancelledAt",
  "completedAt",
  "requestedAt",
  "rejectedAt",
  // version / CAS
  "version",
  "expectedVersion",
  // actor / correlation / audit
  "actor",
  "actorId",
  "actorName",
  "createdBy",
  "updatedBy",
  "requestId",
  "correlationId",
  "causationId",
  "history",
  // child-graph (не управляется lifecycle-командой)
  "passengers",
  "reservations",
  "supplierConfirmations",
] as const;
