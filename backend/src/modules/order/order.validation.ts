/**
 * PHASE 2 STEP 2.7 — Order lifecycle validation (anti-mass-assignment, STRICT
 * REVIEW §28).
 *
 * Конвенция проекта (Sales/Reverse/Catalog): forged server-owned поля на
 * command-эндпоинтах → ЯВНЫЙ 422 (`assertNoForbiddenKeys` из
 * shared/field-validation), а не silent-strip через ValidationPipe whitelist.
 * Order — canonical факты (frozen money, acquisitionSource, milestone-времена,
 * ownership refs), поэтому lifecycle PATCH-команды принимают ТОЛЬКО `action`
 * (и travelers — только допустимые traveler-поля). Всё остальное — server-owned
 * → 422 (loud).
 */

/**
 * Lifecycle-команда `PATCH /orders/:id` принимает ТОЛЬКО `action`.
 * Все server-owned поля Order (identity, lifecycle, frozen money/acquisition,
 * milestone-времена, ownership/provenance refs, actor/correlation, history)
 * запрещены → 422, а не молчаливая обрезка.
 */
export const ORDER_ACTION_FORBIDDEN_KEYS = [
  // identity
  "id",
  "code",
  "number",
  // ownership / provenance refs (frozen из OrderRequested, Step 2.5)
  "customerId",
  "saleId",
  "saleCode",
  "quoteId",
  "checkoutId",
  "reservationId",
  "reservationIds",
  "orderRequestedEventId",
  // lifecycle
  "status",
  "paymentStatus",
  // money / commercial snapshot (frozen, никогда client-authoritative)
  "currency",
  "amount",
  "paidAmount",
  "subtotal",
  "discountType",
  "discountValue",
  "discountAmount",
  "paymentScheme",
  "prepaymentType",
  "prepaymentValue",
  "initialAmount",
  "remainingAmount",
  // acquisition (server-derived, Step 2.5B)
  "acquisitionSource",
  "source",
  // serviceDate + Step 2.8A local temporal факты (server-owned из OrderRequested;
  // zone/instants/type — никогда client-authoritative → 422)
  "serviceDate",
  "serviceTime",
  "serviceEndTime",
  "serviceTimeZone",
  "serviceStartsAt",
  "serviceEndsAt",
  "serviceTimeType",
  // temporal / milestones (server-owned, 2.5A)
  "submittedAt",
  "confirmedAt",
  "cancelledAt",
  "fulfilledAt",
  "closedAt",
  "createdAt",
  "updatedAt",
  // version / CAS
  "version",
  "expectedVersion",
  // D3 server-owned keys (D4 §13): traveler collection contract — pinned
  // snapshot, traveler count, acceptance/collection milestones — клиент НЕ
  // может их подменить → 422.
  "travelerCount",
  "pinnedRequirements",
  "termsAcceptedAt",
  "travelerDataCompletedAt",
  "finalConfirmedAt",
  // actor / correlation / audit
  "actor",
  "actorId",
  "actorName",
  "createdBy",
  "updatedBy",
  "createdById",
  "updatedById",
  "requestId",
  "correlationId",
  "causationId",
  "history",
  // child-graph (не управляется lifecycle-командой)
  "items",
  "travelers",
  "fulfillments",
  "fulfillment",
] as const;

/**
 * `PATCH /orders/:id/travelers` принимает ТОЛЬКО traveler-поля обновления
 * (firstName/lastName/birthDate/citizenship/gender/passportNumber). Все
 * server-owned ключи OrderTraveler (identity, orderId/customerId, derived
 * dataCompleteness, version, timestamps, actor/correlation, history) → 422.
 */
export const ORDER_TRAVELERS_FORBIDDEN_KEYS = [
  "id",
  "orderId",
  "customerId",
  // derived: dataCompleteness вычисляется сервером из passportNumber
  "dataCompleteness",
  "completeness",
  "version",
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
  "actor",
  "actorId",
  "actorName",
  "requestId",
  "correlationId",
  "causationId",
  "history",
  // D3/D4 §13: server-owned Order-level keys на traveler command → 422
  // (pinned snapshot / traveler count / collection milestones immutable).
  "travelerCount",
  "pinnedRequirements",
  "termsAcceptedAt",
  "travelerDataCompletedAt",
  "finalConfirmedAt",
] as const;
