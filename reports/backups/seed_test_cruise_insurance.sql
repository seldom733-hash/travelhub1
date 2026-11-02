BEGIN;
INSERT INTO catalog."Product"
  (id, code, type, title, slug, description, status, version, "publishedAt", "createdAt", "updatedAt", attributes, "categoryId", "categorySchemaId", "partnerId", "supplierRef")
SELECT v.id, v.code, v.type::catalog."ProductType", v.title, v.slug, p.description, 'PUBLISHED', p.version, p."publishedAt", now(), now(),
       p.attributes, p."categoryId", p."categorySchemaId", p."partnerId", v.ref
FROM catalog."Product" p
CROSS JOIN (VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PRD-TEST-CRUISE','CRUISE','Navitravel E2E Test Cruise','test-e2e-cruise','TEST-CRUISE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','PRD-TEST-INSURANCE','INSURANCE','Navitravel E2E Test Insurance','test-e2e-insurance','TEST-INSURANCE')
) AS v(id,code,type,title,slug,ref)
WHERE p.code='PRD-TEST-E2E';

INSERT INTO catalog."ProductPublicationChannel" (id, "productId", channel, "createdAt")
VALUES
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MARKETPLACE',now()),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','MARKETPLACE',now());
COMMIT;
