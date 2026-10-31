-- Refresh the marketplace design tokens for the unified dark "Caspian"
-- system (deep ink, sea-glass accent, Unbounded/Onest typography).
-- Idempotent: safe when the same values are already stored.
UPDATE constructor."ConstructorPage"
SET "designConfig" = '{
  "colors": {
    "background": "#071417",
    "surface": "#0d2226",
    "text": "#f4f0e6",
    "mutedText": "#9bb1ae",
    "accent": "#a8e6cf",
    "border": "#23464a"
  },
  "typography": {
    "bodyFont": "var(--font-body)",
    "fontFamily": "var(--font-body)",
    "headingFont": "var(--font-display)",
    "baseFontSize": 16,
    "headingWeight": 600,
    "lineHeight": 1.6,
    "letterSpacing": "-0.02em"
  },
  "spacing": {
    "containerWidth": 1280,
    "sectionSpacing": 76,
    "internalPadding": 24
  },
  "components": {
    "cardRadius": 20,
    "inputRadius": 12,
    "buttonRadius": 12
  }
}'::jsonb
WHERE slug = 'marketplace-home';

UPDATE constructor."ConstructorPageVersion" v
SET snapshot = jsonb_set(
  v.snapshot,
  '{designConfig}',
  p."designConfig",
  true
)
FROM constructor."ConstructorPage" p
WHERE v."pageId" = p.id
  AND p.slug = 'marketplace-home'
  AND v.status = 'published';
