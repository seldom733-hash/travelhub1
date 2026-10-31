-- Slightly open the UI tracking so Manrope/Playfair do not read as cramped.
UPDATE constructor."ConstructorPage"
SET "designConfig" = jsonb_set("designConfig", '{typography,letterSpacing}', '"0.005em"', true)
WHERE slug = 'marketplace-home';

UPDATE constructor."ConstructorPageVersion" v
SET snapshot = jsonb_set(v.snapshot, '{designConfig,typography,letterSpacing}', '"0.005em"', true)
FROM constructor."ConstructorPage" p
WHERE v."pageId" = p.id
  AND p.slug = 'marketplace-home'
  AND v.status = 'published';
