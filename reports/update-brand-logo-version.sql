UPDATE constructor."ConstructorPageVersion" v
SET snapshot = jsonb_set(
  v.snapshot,
  '{headerConfig,logo}',
  '{"url":"/navitravel-icon.png","width":850,"height":1024,"size":127578,"format":"PNG"}'::jsonb,
  true
)
FROM constructor."ConstructorPage" p
WHERE p.id = v."pageId"
  AND p.slug = 'marketplace-home'
  AND v.version = p."currentVersion";

UPDATE constructor."ConstructorPage" p
SET "headerConfig" = jsonb_set(
  p."headerConfig",
  '{logo}',
  '{"url":"/navitravel-icon.png","width":850,"height":1024,"size":127578,"format":"PNG"}'::jsonb,
  true
)
WHERE p.slug = 'marketplace-home';
