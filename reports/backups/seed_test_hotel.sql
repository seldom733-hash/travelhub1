BEGIN;
INSERT INTO catalog."Product"
  (id, code, type, title, slug, description, status, version, "publishedAt", "createdAt", "updatedAt", attributes, "categoryId", "categorySchemaId", "partnerId", "supplierRef")
SELECT
  '33333333-3333-4333-8333-333333333333', 'PRD-TEST-HOTEL', 'HOTEL',
  'Navitravel E2E Test Hotel', 'test-e2e-hotel', description, 'PUBLISHED', version, "publishedAt", now(), now(),
  attributes, "categoryId", "categorySchemaId", "partnerId", 'TEST-HOTEL'
FROM catalog."Product" WHERE code='PRD-TEST-E2E';

INSERT INTO catalog."ProductPublicationChannel" (id, "productId", channel, "createdAt")
VALUES ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', 'MARKETPLACE', now());
COMMIT;
