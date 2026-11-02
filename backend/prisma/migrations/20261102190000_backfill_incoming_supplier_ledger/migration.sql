BEGIN;
INSERT INTO finance."LedgerTransaction"
  (id, code, amount, currency, type, "sourceType", "sourceId", "sourceEventId", "businessRef", "occurredAt", "createdAt")
VALUES
  (gen_random_uuid()::text, 'LTX-00000113', 300.00, 'AZN', 'SUPPLIER_REFUND', 'SUPPLIER_PAYOUT', '014eac17-58cf-40bb-94c0-5c73da9341a7', NULL, 'SPO-00000001-2', '2026-11-02 13:53:05.683', now()),
  (gen_random_uuid()::text, 'LTX-00000114', 300.00, 'AZN', 'SUPPLIER_REFUND', 'SUPPLIER_PAYOUT', '53afb3e9-50c0-4158-9287-5b4cefdfc179', NULL, 'SPO-00000007-2', '2026-11-02 13:58:11.167', now());
UPDATE events."BusinessSequence" SET value=114 WHERE prefix='LTX';
COMMIT;
