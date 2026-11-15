SELECT "headerConfig"->'logo' AS current_logo
FROM constructor."ConstructorPage"
WHERE slug = 'marketplace-home';

UPDATE constructor."ConstructorPage"
SET "headerConfig" = jsonb_set(
  "headerConfig",
  '{logo}',
  '{"url":"/navitravel-icon.png","width":850,"height":1024,"size":127578,"format":"PNG"}'::jsonb,
  true
)
WHERE slug = 'marketplace-home';

SELECT "headerConfig"->'logo' AS new_logo
FROM constructor."ConstructorPage"
WHERE slug = 'marketplace-home';
