-- Grove / logo-green marketplace palette (approved homepage direction).
-- Keeps the public shell light and uses the logo's green as the signal color.
UPDATE constructor."ConstructorPage"
SET "designConfig" = '{
  "colors": {
    "background": "#f1f4ec",
    "surface": "#fbfcf8",
    "text": "#1d2a20",
    "mutedText": "#64746a",
    "accent": "#3f7a36",
    "border": "#d5e0d2"
  },
  "typography": {
    "bodyFont": "var(--font-body)",
    "fontFamily": "var(--font-body)",
    "headingFont": "var(--font-display)",
    "baseFontSize": 16,
    "headingWeight": 600,
    "lineHeight": 1.6,
    "letterSpacing": "-0.03em"
  },
  "spacing": {
    "containerWidth": 1240,
    "sectionSpacing": 64,
    "internalPadding": 24
  },
  "components": {
    "cardRadius": 18,
    "inputRadius": 12,
    "buttonRadius": 12
  }
}'::jsonb
WHERE slug = 'marketplace-home';

UPDATE constructor."ConstructorPageVersion" v
SET snapshot = jsonb_set(v.snapshot, '{designConfig}', p."designConfig", true)
FROM constructor."ConstructorPage" p
WHERE v."pageId" = p.id
  AND p.slug = 'marketplace-home'
  AND v.status = 'published';
