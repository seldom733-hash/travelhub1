/**
 * KOMPAS HOTEL country dictionary — STATEINC ↔ ISO-2 / ru-name.
 *
 * Sourced live from the `/search_hotel` STATEINC select (probe 2026-10-12):
 * the HOTEL search exposes 53 countries — a WIDER set than the tour search's
 * ~23, because a stay-only booking needs no departure flight from Baku.
 *
 * The tour dictionary (mapStateInc / STATE_INC_TO_COUNTRY in kompas.adapter.ts)
 * is intentionally NOT reused/overwritten here: the two searches are separate
 * upstream dictionaries (same split as ANEX `/samo/searchtour/States` 21 vs
 * `/samo/searchhotel/States` 52). Keep them independent.
 */

/** STATEINC → ISO-2 (canonical, for geo-linking + aggregator capability match). */
export const KOMPAS_HOTEL_STATEINC_TO_ISO: Record<string, string> = {
  "51": "AT", // Австрия
  "61": "AZ", // Азербайджан
  "157": "AD", // Андорра
  "132": "AR", // Аргентина
  "69": "AM", // Армения
  "117": "BH", // Бахрейн
  "45": "BG", // Болгария
  "98": "BR", // Бразилия
  "54": "GB", // Великобритания
  "65": "HU", // Венгрия
  "32": "VN", // Вьетнам
  "21": "DE", // Германия
  "26": "GR", // Греция
  "30": "GE", // Грузия
  "56": "DO", // Доминиканская Республика
  "37": "EG", // Египет
  "109": "TZ", // Занзибар (Танзания)
  "6": "IN", // Индия
  "11": "ID", // Индонезия
  "34": "ES", // Испания
  "42": "IT", // Италия
  "7": "KZ", // Казахстан
  "39": "KH", // Камбоджа
  "111": "QA", // Катар
  "139": "KE", // Кения
  "47": "CY", // Кипр
  "31": "CN", // Китай
  "86": "MU", // Маврикий
  "12": "MY", // Малайзия
  "40": "MV", // Мальдивы
  "75": "MA", // Марокко
  "108": "MX", // Мексика
  "52": "NL", // Нидерланды (Голландия)
  "23": "AE", // ОАЭ
  "78": "OM", // Оман
  "81": "PT", // Португалия
  "124": "SA", // Саудовская Аравия
  "77": "SC", // Сейшельские Острова
  "33": "SG", // Сингапур
  "55": "SI", // Словения
  "22": "US", // США
  "28": "TH", // Таиланд
  "95": "TN", // Тунис
  "17": "TR", // Турция
  "14": "UZ", // Узбекистан
  "10": "UA", // Украина
  "71": "PH", // Филиппины
  "16": "ME", // Черногория
  "49": "CZ", // Чехия
  "59": "CH", // Швейцария
  "27": "LK", // Шри-Ланка
  "57": "KR", // Южная Корея
  "94": "JP", // Япония
};

/** Normalized ru-name / alias → STATEINC (for resolving a query country). */
const HOTEL_NAME_TO_STATEINC: Record<string, string> = {
  австрия: "51",
  austria: "51",
  азербайджан: "61",
  azerbaijan: "61",
  андорра: "157",
  andorra: "157",
  аргентина: "132",
  argentina: "132",
  армения: "69",
  armenia: "69",
  бахрейн: "117",
  bahrain: "117",
  болгария: "45",
  bulgaria: "45",
  бразилия: "98",
  brazil: "98",
  великобритания: "54",
  "соединенное королевство": "54",
  uk: "54",
  "great britain": "54",
  венгрия: "65",
  hungary: "65",
  вьетнам: "32",
  vietnam: "32",
  германия: "21",
  germany: "21",
  греция: "26",
  greece: "26",
  грузия: "30",
  georgia: "30",
  "доминиканская республика": "56",
  "dominican republic": "56",
  египет: "37",
  egypt: "37",
  занзибар: "109",
  "занзибар (танзания)": "109",
  zanzibar: "109",
  танзания: "109",
  tanzania: "109",
  индия: "6",
  india: "6",
  индонезия: "11",
  indonesia: "11",
  испания: "34",
  spain: "34",
  италия: "42",
  italy: "42",
  казахстан: "7",
  kazakhstan: "7",
  камбоджа: "39",
  cambodia: "39",
  катар: "111",
  qatar: "111",
  кения: "139",
  kenya: "139",
  кипр: "47",
  cyprus: "47",
  китай: "31",
  china: "31",
  маврикий: "86",
  mauritius: "86",
  малайзия: "12",
  malaysia: "12",
  мальдивы: "40",
  maldives: "40",
  марокко: "75",
  morocco: "75",
  мексика: "108",
  mexico: "108",
  нидерланды: "52",
  голландия: "52",
  netherlands: "52",
  оаэ: "23",
  "объединенные арабские эмираты": "23",
  uae: "23",
  "united arab emirates": "23",
  оман: "78",
  oman: "78",
  португалия: "81",
  portugal: "81",
  "саудовская аравия": "124",
  "saudi arabia": "124",
  "сейшельские острова": "77",
  сейшелы: "77",
  seychelles: "77",
  сингапур: "33",
  singapore: "33",
  словения: "55",
  slovenia: "55",
  сша: "22",
  "соединенные штаты": "22",
  "united states": "22",
  usa: "22",
  "америка": "22",
  таиланд: "28",
  thailand: "28",
  тунис: "95",
  tunisia: "95",
  турция: "17",
  turkey: "17",
  узбекистан: "14",
  uzbekistan: "14",
  украина: "10",
  ukraine: "10",
  филиппины: "71",
  philippines: "71",
  черногория: "16",
  montenegro: "16",
  чехия: "49",
  "czech republic": "49",
  czechia: "49",
  швейцария: "59",
  switzerland: "59",
  "шри-ланка": "27",
  "sri lanka": "27",
  "южная корея": "57",
  "south korea": "57",
  korea: "57",
  япония: "94",
  japan: "94",
};

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/**
 * Resolve a query country (ISO-2 code or ru/en name/alias) to the hotel
 * STATEINC. Returns undefined when the country is not in the hotel dictionary.
 */
export function resolveHotelStateInc(raw?: string): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  if (!v) return undefined;
  // ISO-2 code → find by value.
  if (/^[A-Za-z]{2}$/.test(v)) {
    const iso = v.toUpperCase();
    const entry = Object.entries(KOMPAS_HOTEL_STATEINC_TO_ISO).find(([, i]) => i === iso);
    return entry?.[0];
  }
  return HOTEL_NAME_TO_STATEINC[normKey(v)];
}

/** ISO-2 for a hotel STATEINC (for geo/capability), or undefined. */
export function hotelStateIncToIso(stateInc: string): string | undefined {
  return KOMPAS_HOTEL_STATEINC_TO_ISO[String(stateInc)];
}

/** STATEINC → ru country name (for the «Hotel (City, Country)» title). */
export const KOMPAS_HOTEL_STATEINC_TO_RU: Record<string, string> = {
  "51": "Австрия",
  "61": "Азербайджан",
  "157": "Андорра",
  "132": "Аргентина",
  "69": "Армения",
  "117": "Бахрейн",
  "45": "Болгария",
  "98": "Бразилия",
  "54": "Великобритания",
  "65": "Венгрия",
  "32": "Вьетнам",
  "21": "Германия",
  "26": "Греция",
  "30": "Грузия",
  "56": "Доминиканская Республика",
  "37": "Египет",
  "109": "Занзибар",
  "6": "Индия",
  "11": "Индонезия",
  "34": "Испания",
  "42": "Италия",
  "7": "Казахстан",
  "39": "Камбоджа",
  "111": "Катар",
  "139": "Кения",
  "47": "Кипр",
  "31": "Китай",
  "86": "Маврикий",
  "12": "Малайзия",
  "40": "Мальдивы",
  "75": "Марокко",
  "108": "Мексика",
  "52": "Нидерланды",
  "23": "ОАЭ",
  "78": "Оман",
  "81": "Португалия",
  "124": "Саудовская Аравия",
  "77": "Сейшельские Острова",
  "33": "Сингапур",
  "55": "Словения",
  "22": "США",
  "28": "Таиланд",
  "95": "Тунис",
  "17": "Турция",
  "14": "Узбекистан",
  "10": "Украина",
  "71": "Филиппины",
  "16": "Черногория",
  "49": "Чехия",
  "59": "Швейцария",
  "27": "Шри-Ланка",
  "57": "Южная Корея",
  "94": "Япония",
};

/** ru country name for a hotel STATEINC, or undefined. */
export function hotelStateIncToRu(stateInc: string): string | undefined {
  return KOMPAS_HOTEL_STATEINC_TO_RU[String(stateInc)];
}

/** Every hotel STATEINC (for the sync loop). */
export function allHotelStateIncs(): string[] {
  return Object.keys(KOMPAS_HOTEL_STATEINC_TO_ISO);
}
