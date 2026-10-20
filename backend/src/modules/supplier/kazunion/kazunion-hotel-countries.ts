/**
 * KazUnion HOTEL dictionary — `search_hotel` STATEINC ↔ ISO-2.
 *
 * The hotel form is a SEPARATE upstream dictionary from the tour form
 * (verified live 2026-10-19 by parsing `<select name="STATEINC">` of
 * https://online.kazunion.com/search_hotel): 22 countries, including
 * destinations the tour form never lists (HU, IT, OM, SA, SI, CZ, …).
 *
 * Hotel-only countries can never be discovered through `search_tour`, so the
 * mapping lives here (same role as `kompas-hotel-countries.ts`).
 */

export interface KazunionHotelCountry {
  /** KazUnion `search_hotel` STATEINC. */
  stateInc: string;
  /** ISO-2 code used by Master Geography. */
  iso2: string;
  /** Russian display name exactly as the supplier writes it. */
  ru: string;
  /** English name (for ISO/EN query resolution). */
  en: string;
}

/** Full hotel dictionary — order mirrors the supplier's own form. */
export const KAZUNION_HOTEL_COUNTRIES: readonly KazunionHotelCountry[] = [
  { stateInc: "48", iso2: "AZ", ru: "Азербайджан", en: "Azerbaijan" },
  { stateInc: "81", iso2: "HU", ru: "Венгрия", en: "Hungary" },
  { stateInc: "22", iso2: "VN", ru: "Вьетнам", en: "Vietnam" },
  { stateInc: "4", iso2: "GR", ru: "Греция", en: "Greece" },
  { stateInc: "43", iso2: "GE", ru: "Грузия", en: "Georgia" },
  { stateInc: "14", iso2: "ID", ru: "Индонезия", en: "Indonesia" },
  { stateInc: "9", iso2: "IT", ru: "Италия", en: "Italy" },
  { stateInc: "7", iso2: "KZ", ru: "Казахстан", en: "Kazakhstan" },
  { stateInc: "19", iso2: "CN", ru: "Китай", en: "China" },
  { stateInc: "56", iso2: "MU", ru: "Маврикий", en: "Mauritius" },
  { stateInc: "13", iso2: "MY", ru: "Малайзия", en: "Malaysia" },
  { stateInc: "33", iso2: "MV", ru: "Мальдивы", en: "Maldives" },
  { stateInc: "77", iso2: "OM", ru: "Оман", en: "Oman" },
  { stateInc: "116", iso2: "SA", ru: "Саудовская Аравия", en: "Saudi Arabia" },
  { stateInc: "52", iso2: "SC", ru: "Сейшелы", en: "Seychelles" },
  { stateInc: "42", iso2: "SG", ru: "Сингапур", en: "Singapore" },
  { stateInc: "73", iso2: "SI", ru: "Словения", en: "Slovenia" },
  { stateInc: "12", iso2: "TH", ru: "Таиланд", en: "Thailand" },
  { stateInc: "6", iso2: "TR", ru: "Турция", en: "Turkey" },
  { stateInc: "69", iso2: "ME", ru: "Черногория", en: "Montenegro" },
  { stateInc: "31", iso2: "CZ", ru: "Чехия", en: "Czech Republic" },
  { stateInc: "20", iso2: "LK", ru: "Шри-Ланка", en: "Sri Lanka" },
] as const;

/** STATEINC → ISO-2. */
export const KAZUNION_HOTEL_STATEINC_TO_ISO: Record<string, string> = Object.fromEntries(
  KAZUNION_HOTEL_COUNTRIES.map((c) => [c.stateInc, c.iso2]),
);

/** ISO-2 → STATEINC. */
export const KAZUNION_HOTEL_ISO_TO_STATEINC: Record<string, string> = Object.fromEntries(
  KAZUNION_HOTEL_COUNTRIES.map((c) => [c.iso2, c.stateInc]),
);

/** STATEINC → Russian name (the supplier's own label). */
export const KAZUNION_HOTEL_STATEINC_TO_RU: Record<string, string> = Object.fromEntries(
  KAZUNION_HOTEL_COUNTRIES.map((c) => [c.stateInc, c.ru]),
);

/** Normalize a country label for matching (case/ё/whitespace tolerant). */
function norm(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

/**
 * Resolve a supplier-neutral country label → hotel STATEINC.
 * Accepts ISO-2 ("TR"), the Russian name ("Турция"), or the English name
 * ("Turkey"). Returns undefined when the country is not in the hotel
 * dictionary (the caller must treat that as "supplier has no hotel product
 * for this country", never as "zero hotels").
 */
export function resolveHotelStateInc(raw?: string): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  if (/^\d+$/.test(v)) return KAZUNION_HOTEL_STATEINC_TO_ISO[v] ? v : undefined;
  if (/^[A-Za-z]{2}$/.test(v)) return KAZUNION_HOTEL_ISO_TO_STATEINC[v.toUpperCase()];

  const key = norm(v);
  const byName = KAZUNION_HOTEL_COUNTRIES.find(
    (c) => norm(c.ru) === key || norm(c.en) === key,
  );
  if (byName) return byName.stateInc;

  // Substring fallback ("Турция (Анталья)" → Турция).
  const byContains = KAZUNION_HOTEL_COUNTRIES.find(
    (c) => key.includes(norm(c.ru)) || norm(c.ru).includes(key) || key.includes(norm(c.en)),
  );
  return byContains?.stateInc;
}

/** STATEINC → ISO-2 (undefined for unknown ids). */
export function hotelStateIncToIso(stateInc?: string): string | undefined {
  return stateInc ? KAZUNION_HOTEL_STATEINC_TO_ISO[stateInc] : undefined;
}

/** STATEINC → Russian country name. */
export function hotelStateIncToRu(stateInc?: string): string | undefined {
  return stateInc ? KAZUNION_HOTEL_STATEINC_TO_RU[stateInc] : undefined;
}
