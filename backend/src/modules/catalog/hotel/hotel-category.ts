/**
 * Canonical hotel-category filter for the universal search.
 *
 * Supplier dictionaries mix several different concepts in one "STARS" list:
 * star ratings, property types and marketing/audience tags. Only two groups
 * are selectable in Navitravel:
 *   - star rating 0* / 1* / 2* / 3* / 4* / 5* (0* = без звёзд);
 *   - property type Boutique / Guest House / Deluxe / Apart.
 *
 * Everything else (Adults only, Family, HALAL, Kids Go Free, Recommend,
 * except 0*-5* which are valid hotel categories.
 */
export type CanonicalHotelCategory =
  | { kind: "STAR"; label: string; stars: 0 | 1 | 2 | 3 | 4 | 5 }
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

  // Star/grouped supplier labels: "0*", "2*", "4*", "5* DELUXE".
  const stars = label.match(/^([0-5])\s*\*/);
  if (stars) {
    const value = Number(stars[1]) as 0 | 1 | 2 | 3 | 4 | 5;
    return { kind: "STAR", label: `${value}*`, stars: value };
  }
  if (/^(без\s*зв[её]зд|no\s*star|unrated)\b/i.test(label)) {
    return { kind: "STAR", label: "0*", stars: 0 };
  }

  for (const property of PROPERTY_TYPES) {
    if (property.test.test(label)) {
      return { kind: "PROPERTY_TYPE", label: property.label, stars: null };
    }
  }

  return null;
}
