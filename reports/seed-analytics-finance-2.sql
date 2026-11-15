INSERT INTO finance."Refund" (
  id, code, "paymentId", "orderId", amount, currency, status, reason, version,
  "createdAt", "updatedAt", "requestedAt", "approvedAt", "processedAt", "isActiveRefund", "referenceNumber"
) VALUES (
  '33333333-3333-4333-8333-333333333301', 'REF-E2E-0002',
  '22222222-2222-4222-8222-222222222201', '251be197-6626-491c-b7ad-debd31977b9d',
  10.00, 'AZN', 'PROCESSED', 'E2E partial refund', 1,
  '2026-11-14 12:10:00+00', '2026-11-14 12:10:00+00', '2026-11-14 12:10:00+00',
  '2026-11-14 12:11:00+00', '2026-11-14 12:12:00+00', true, 'MKT-REF-E2E-0002'
), (
  '33333333-3333-4333-8333-333333333302', 'REF-E2E-0003',
  '22222222-2222-4222-8222-222222222201', '251be197-6626-491c-b7ad-debd31977b9d',
  5.00, 'AZN', 'REQUESTED', 'E2E pending refund', 1,
  '2026-11-14 12:13:00+00', '2026-11-14 12:13:00+00', '2026-11-14 12:13:00+00',
  NULL, NULL, true, 'MKT-REF-E2E-0003'
);

UPDATE "order"."Order"
SET status = 'CLOSED', "closedAt" = '2026-11-14 12:20:00+00', "updatedAt" = now()
WHERE id = '82318f58-e02b-4a01-a3c9-f0e368147b13';

INSERT INTO finance."OrderFinancialSettlement" (
  id, code, "orderId", "originalAmount", currency, "capturedAmount", "refundedAmount",
  "pendingRefundAmount", "finalCustomerLiability", "penaltyAmount", "clientPenaltyAmount",
  "clientPenaltyStatus", "supplierPenaltyStatus", "platformPenaltyShare", "supplierPenaltyShare",
  "annulledUnpaidAmount", "remainingToPay", "remainingToRefund", "writeOffAmount",
  status, reason, "confirmedAt", version, "createdAt", "updatedAt"
) VALUES (
  '44444444-4444-4444-8444-444444444401', 'SET-E2E-0001',
  '82318f58-e02b-4a01-a3c9-f0e368147b13', 1000.00, 'AZN', 0.00, 0.00,
  0.00, 1000.00, 0.00, 0.00, 'CONFIRMED', 'CONFIRMED', 0.00, 0.00,
  0.00, 0.00, 0.00, 0.00, 'OPEN', 'E2E settlement', '2026-11-14 12:20:00+00',
  1, '2026-11-14 12:20:00+00', '2026-11-14 12:20:00+00'
);

INSERT INTO finance."OrderFinancialAdjustment" (
  id, code, "orderId", "settlementId", type, amount, currency, reason,
  "occurredAt", "idempotencyKey", "createdAt"
) VALUES (
  '55555555-5555-4555-8555-555555555501', 'FAD-E2E-0001',
  '82318f58-e02b-4a01-a3c9-f0e368147b13', '44444444-4444-4444-8444-444444444401',
  'CUSTOMER_PENALTY', 20.00, 'AZN', 'E2E adjustment',
  '2026-11-14 12:25:00+00', 'e2e-adjustment-1', '2026-11-14 12:25:00+00'
);
