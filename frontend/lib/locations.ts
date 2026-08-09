/**
 * Authoritative location reference — frontend mirror (Phase 1 Step 1.11 FIX 2).
 *
 * География продавца — ТОЛЬКО коды (countryCode / cityCode), которые отдаёт
 * backend (системная identity из crm.Partner + справочник Catalog). Locale
 * (RU/AZ/EN) меняет ТОЛЬКО display label; идентичность страны/города от локали
 * не зависит. RU-locale НЕ является country code «RU».
 *
 * Должен совпадать с backend/src/modules/catalog/seller/locations.ts.
 */
export type Locale = "ru" | "az" | "en";

export interface LocalizedNames {
  ru: string;
  az: string;
  en: string;
}

/** Onboarding-страны (2-letter codes) + локализованные названия. */
export const COUNTRY_NAMES: Record<string, LocalizedNames> = {
  AZ: { ru: "Азербайджан", az: "Azərbaycan", en: "Azerbaijan" },
  GE: { ru: "Грузия", az: "Gürcüstan", en: "Georgia" },
  KZ: { ru: "Казахстан", az: "Qazaxıstan", en: "Kazakhstan" },
  UZ: { ru: "Узбекистан", az: "Özbəkistan", en: "Uzbekistan" },
  RU: { ru: "Россия", az: "Rusiya", en: "Russia" },
  TR: { ru: "Турция", az: "Türkiyə", en: "Türkiye" },
  AE: { ru: "ОАЭ", az: "BƏƏ", en: "UAE" },
  DE: { ru: "Германия", az: "Almaniya", en: "Germany" },
  US: { ru: "США", az: "ABŞ", en: "United States" },
  GB: { ru: "Великобритания", az: "Böyük Britaniya", en: "United Kingdom" },
  FR: { ru: "Франция", az: "Fransa", en: "France" },
  IT: { ru: "Италия", az: "İtaliya", en: "Italy" },
  ES: { ru: "Испания", az: "İspaniya", en: "Spain" },
};

export interface CityRef extends LocalizedNames {
  countryCode: string;
}

/** Канонический справочник городов (cityCode → {countryCode, ru, az, en}). */
export const CITY_REF: Record<string, CityRef> = {
  BAKU: { countryCode: "AZ", ru: "Баку", az: "Bakı", en: "Baku" },
  GANJA: { countryCode: "AZ", ru: "Гянджа", az: "Gəncə", en: "Ganja" },
  TBILISI: { countryCode: "GE", ru: "Тбилиси", az: "Tbilisi", en: "Tbilisi" },
  BATUMI: { countryCode: "GE", ru: "Батуми", az: "Batumi", en: "Batumi" },
  ALMATY: { countryCode: "KZ", ru: "Алматы", az: "Almatı", en: "Almaty" },
  ASTANA: { countryCode: "KZ", ru: "Астана", az: "Astana", en: "Astana" },
  TASHKENT: { countryCode: "UZ", ru: "Ташкент", az: "Daşkənd", en: "Tashkent" },
  SAMARKAND: { countryCode: "UZ", ru: "Самарканд", az: "Səmərqənd", en: "Samarkand" },
  MOSCOW: { countryCode: "RU", ru: "Москва", az: "Moskva", en: "Moscow" },
  SAINT_PETERSBURG: { countryCode: "RU", ru: "Санкт-Петербург", az: "Sankt-Peterburq", en: "Saint Petersburg" },
  SOCHI: { countryCode: "RU", ru: "Сочи", az: "Soçi", en: "Sochi" },
  ISTANBUL: { countryCode: "TR", ru: "Стамбул", az: "İstanbul", en: "Istanbul" },
  ANTALYA: { countryCode: "TR", ru: "Анталья", az: "Antalya", en: "Antalya" },
  DUBAI: { countryCode: "AE", ru: "Дубай", az: "Dubay", en: "Dubai" },
  ABU_DHABI: { countryCode: "AE", ru: "Абу-Даби", az: "Abu Dabi", en: "Abu Dhabi" },
  BERLIN: { countryCode: "DE", ru: "Берлин", az: "Berlin", en: "Berlin" },
  MUNICH: { countryCode: "DE", ru: "Мюнхен", az: "Münhen", en: "Munich" },
  NEW_YORK: { countryCode: "US", ru: "Нью-Йорк", az: "Nyu-York", en: "New York" },
  MIAMI: { countryCode: "US", ru: "Майами", az: "Mayami", en: "Miami" },
  LONDON: { countryCode: "GB", ru: "Лондон", az: "London", en: "London" },
  PARIS: { countryCode: "FR", ru: "Париж", az: "Paris", en: "Paris" },
  ROME: { countryCode: "IT", ru: "Рим", az: "Roma", en: "Rome" },
  MILAN: { countryCode: "IT", ru: "Милан", az: "Milan", en: "Milan" },
  MADRID: { countryCode: "ES", ru: "Мадрид", az: "Madrid", en: "Madrid" },
  BARCELONA: { countryCode: "ES", ru: "Барселона", az: "Barselona", en: "Barcelona" },
};

export function countryName(code: string | null | undefined, locale: Locale): string | null {
  if (!code) return null;
  return COUNTRY_NAMES[code]?.[locale] ?? code;
}

export function cityName(code: string | null | undefined, locale: Locale): string | null {
  if (!code) return null;
  return CITY_REF[code]?.[locale] ?? code;
}

/** "Baku, Azerbaijan" / "Баку, Азербайджан" / "Bakı, Azərbaycan" — по кодам. */
export function formatLocation(countryCode: string | null | undefined, cityCode: string | null | undefined, locale: Locale): string | null {
  const c = countryName(countryCode, locale);
  const t = cityName(cityCode, locale);
  if (!c && !t) return null;
  return [t, c].filter(Boolean).join(", ");
}

/** Города, принадлежащие стране (для select в форме предложения). */
export function citiesOf(countryCode: string | null | undefined): Array<{ code: string; countryCode: string }> {
  if (!countryCode) return [];
  return Object.entries(CITY_REF)
    .filter(([, city]) => city.countryCode === countryCode)
    .map(([code, city]) => ({ code, countryCode: city.countryCode }));
}
