BEGIN;
INSERT INTO catalog."Product"
  (id, code, type, title, slug, description, status, version, "publishedAt", "createdAt", "updatedAt", attributes, "categoryId", "categorySchemaId", "partnerId", "supplierRef")
SELECT v.id, v.code, v.type::catalog."ProductType", v.title, v.slug, p.description, 'PUBLISHED', p.version, p."publishedAt", now(), now(),
       p.attributes, p."categoryId", p."categorySchemaId", p."partnerId", v.ref
FROM catalog."Product" p
CROSS JOIN (VALUES
  ('55555555-5555-4555-8555-555555555555','PRD-TEST-FLIGHT','FLIGHT','Navitravel E2E Test Flight','test-e2e-flight','TEST-FLIGHT'),
  ('66666666-6666-4666-8666-666666666666','PRD-TEST-TRANSFER','TRANSFER','Navitravel E2E Test Transfer','test-e2e-transfer','TEST-TRANSFER'),
  ('77777777-7777-4777-8777-777777777777','PRD-TEST-EXCURSION','EXCURSION','Navitravel E2E Test Excursion','test-e2e-excursion','TEST-EXCURSION'),
  ('88888888-8888-4888-8888-888888888888','PRD-TEST-SANATORIUM','SANATORIUM','Navitravel E2E Test Sanatorium','test-e2e-sanatorium','TEST-SANATORIUM')
) AS v(id,code,type,title,slug,ref)
WHERE p.code='PRD-TEST-E2E';

INSERT INTO catalog."ProductPublicationChannel" (id, "productId", channel, "createdAt")
SELECT v.id, v.pid, 'MARKETPLACE', now()
FROM (VALUES
  ('99999999-9999-4999-8999-999999999991','55555555-5555-4555-8555-555555555555'),
  ('99999999-9999-4999-8999-999999999992','66666666-6666-4666-8666-666666666666'),
  ('99999999-9999-4999-8999-999999999993','77777777-7777-4777-8777-777777777777'),
  ('99999999-9999-4999-8999-999999999994','88888888-8888-4888-8888-888888888888')
) AS v(id,pid);
COMMIT;

