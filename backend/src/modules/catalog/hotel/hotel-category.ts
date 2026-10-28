/**
 * Canonical hotel-category filter for the universal search.
 *
 * Supplier dictionaries mix several different concepts in one "STARS" list:
 * star ratings, property types and marketing/audience tags. Only two groups
 * are selectable in Navitravel:
 *   - star rating 4* / 5*;
 *   - property type Boutique / Guest House / Deluxe / Apart.
 *
 * Everything else (Adults only, Family, HALAL, Kids Go Free, Recommend,
 * 1*-3*, etc.) is deliberately not exposed as a hotel category.
 */
export type CanonicalHotelCategory =
  | { kind: "STAR"; label: string; stars: 4 | 5 }
  | { kind: "PROPERTY_TYPE"; label: string; stars: null };

const PROPERTY_TYPES: Array<{ label: string; test: RegExp }> = [
  { label: "Boutique", test: /^boutique\b/i },
  { label: "Guest House", test: /^guest\s*house\b/i },
  { label: "Deluxe", test: /^deluxe\b/i },
  { label: "Apart", test: /^apart(?:ment)?s?\b/i },
];

export function canonicalHotelCategory(raw: string): CanonicalHotelCategory | null {
  const label = raw.replace(/\s+/g, " ").trim();
  if (!label) return null;

  // Star/grouped supplier labels: "4*", "5* DELUXE", "5*/HV1", "4*+".
  // Only 4 and 5 are kept.
  const stars = label.match(/^([45])\s*\*/);
  if (stars) {
    const value = Number(stars[1]) as 4 | 5;
    return { kind: "STAR", label: `${value}*`, stars: value };
  }

  for (const property of PROPERTY_TYPES) {
    if (property.test.test(label)) {
      return { kind: "PROPERTY_TYPE", label: property.label, stars: null };
    }
  }

  return null;
}
