// Combined country name -> ISO-2. Covers the Russian names stored by most
// syncs, the English names stored by KOMPAS tours / SUMMERTOUR, and the
// Seychelles homoglyph variant produced by ANEX ("Сейшельские Оc-ва").
export const COUNTRY_NAME_TO_ISO2_FULL: Record<string, string> = {
  // Russian
  "турция": "TR", "таиланд": "TH", "индонезия": "ID", "оаэ": "AE",
  "франция": "FR", "мальдивы": "MV", "италия": "IT",
  "сейшельские острова": "SC", "сейшельские оc-ва": "SC", "сейшельские о-ва": "SC",
  "сейшелы": "SC", "маврикий": "MU", "малайзия": "MY", "египет": "EG",
  "узбекистан": "UZ", "испания": "ES", "австрия": "AT", "китай": "CN",
  "сингапур": "SG", "индия": "IN", "вьетнам": "VN", "германия": "DE",
  "грузия": "GE", "катар": "QA", "черногория": "ME", "казахстан": "KZ",
  "сша": "US", "швейцария": "CH", "занзибар": "TZ", "кения": "KE",
  "азербайджан": "AZ", "венгрия": "HU", "шри-ланка": "LK",
  // English (KOMPAS tours / SUMMERTOUR)
  "thailand": "TH", "uae": "AE", "maldives": "MV", "georgia": "GE",
  "sri lanka": "LK", "indonesia": "ID", "malaysia": "MY", "egypt": "EG",
  "turkey": "TR", "mauritius": "MU", "uzbekistan": "UZ", "qatar": "QA",
  "zanzibar": "TZ", "kazakhstan": "KZ", "singapore": "SG", "kenya": "KE",
  "seychelles": "SC", "india": "IN", "usa": "US", "switzerland": "CH",
  "united states": "US", "united arab emirates": "AE",
};

export function countryNameToIso(raw?: string): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  return COUNTRY_NAME_TO_ISO2_FULL[v.toLowerCase()];
}

export async function resolveGeoCountryId(
  prisma: any,
  raw?: string,
): Promise<string | null> {
  const iso = countryNameToIso(raw);
  if (!iso) return null;
  const gc = await prisma.geoCountry.findUnique({
    where: { code: iso },
    select: { id: true },
  });
  return gc?.id ?? null;
}

// Build a name->id map for a set of country names in one pass (avoids N queries).
export async function buildGeoCountryMap(
  prisma: any,
  countryNames: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const distinct = Array.from(new Set(countryNames.filter(Boolean)));
  await Promise.all(
    distinct.map(async (name) => {
      map.set(name, await resolveGeoCountryId(prisma, name));
    }),
  );
  return map;
}
