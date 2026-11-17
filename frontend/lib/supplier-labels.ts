import type { Locale } from "@/lib/i18n";

/** Small supplier-card dictionary; values supplied by the supplier are codes. */
export function sx(locale: Locale, ru: string, az: string, en: string): string {
  return locale === "az" ? az : locale === "en" ? en : ru;
}

export const MONTHS: Record<Locale, string[]> = {
  ru: ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"],
  az: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

export const WEEKDAYS: Record<Locale, string[]> = {
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  az: ["B.e.", "Ç.a.", "Ç.", "C.a.", "C.", "Ş.", "B."],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

const MEAL: Record<Locale, Record<string, string>> = {
  ru: { RO: "Без питания", BB: "Завтрак", HB: "Полупансион", FB: "Полный пансион", AI: "Всё включено", UAI: "Ультра всё включено" },
  az: { RO: "Yeməksiz", BB: "Səhər yeməyi", HB: "Yarım pansiyon", FB: "Tam pansiyon", AI: "Hər şey daxil", UAI: "Ultra hər şey daxil" },
  en: { RO: "Room only", BB: "Breakfast", HB: "Half board", FB: "Full board", AI: "All inclusive", UAI: "Ultra all inclusive" },
};

const ROOM: Record<Locale, Array<[RegExp, string]>> = {
  ru: [
    [/^SGL\b/i, "Одноместный"], [/^DBL\b/i, "Двухместный"], [/^TWIN\b/i, "Двухместный с двумя кроватями"],
    [/^TRPL\b/i, "Трёхместный"], [/^QUAD\b/i, "Четырёхместный"], [/^SUITE\b/i, "Люкс"],
    [/^FAMILY\b/i, "Семейный"], [/^DELUXE\b/i, "Делюкс"], [/^STANDARD\b|^STANDART\b/i, "Стандартный"], [/^ECONOMY\b|^ECO\b/i, "Эконом"],
  ],
  az: [
    [/^SGL\b/i, "Bir nəfərlik"], [/^DBL\b/i, "İki nəfərlik"], [/^TWIN\b/i, "İki çarpayılı"],
    [/^TRPL\b/i, "Üç nəfərlik"], [/^QUAD\b/i, "Dörd nəfərlik"], [/^SUITE\b/i, "Lüks"],
    [/^FAMILY\b/i, "Ailə"], [/^DELUXE\b/i, "Delüks"], [/^STANDARD\b|^STANDART\b/i, "Standart"], [/^ECONOMY\b|^ECO\b/i, "Ekonom"],
  ],
  en: [
    [/^SGL\b/i, "Single"], [/^DBL\b/i, "Double"], [/^TWIN\b/i, "Twin"],
    [/^TRPL\b/i, "Triple"], [/^QUAD\b/i, "Quad"], [/^SUITE\b/i, "Suite"],
    [/^FAMILY\b/i, "Family"], [/^DELUXE\b/i, "Deluxe"], [/^STANDARD\b|^STANDART\b/i, "Standard"], [/^ECONOMY\b|^ECO\b/i, "Economy"],
  ],
};

const TRANSPORT: Record<Locale, Record<string, string>> = {
  ru: { "эконом": "Эконом", "бизнес": "Бизнес", "комфорт": "Комфорт", "эконом-класс": "Эконом" },
  az: { "эконом": "Ekonom", "бизнес": "Biznes", "комфорт": "Komfort", "эконом-класс": "Ekonom" },
  en: { "эконом": "Economy", "бизнес": "Business", "комфорт": "Comfort", "эконом-класс": "Economy" },
};

export function humanMeal(value: string | undefined, locale: Locale): string {
  const raw = (value ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const code = raw.match(/^(RO|BB|HB|FB|AI|UAI)\b/i)?.[1]?.toUpperCase();
  return (code && MEAL[locale][code]) || raw;
}

export function humanRoom(value: string | undefined, locale: Locale): string {
  const raw = (value ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  for (const [re, label] of ROOM[locale]) {
    if (re.test(raw)) {
      const suffix = raw.replace(re, "").replace(/^\s*[/,-]?\s*/, "").trim();
      return suffix ? `${label} · ${suffix}` : label;
    }
  }
  return raw;
}

export function humanTransport(value: string | undefined, locale: Locale): string {
  const raw = (value ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  return TRANSPORT[locale][raw.toLowerCase()] ?? raw;
}

/**
 * Display-only short tour/hotel title: everything before the first name
 * delimiter — «.», «(» or a dash. The full value stays in the data for
 * matching/queries; this is only for what the user sees on cards and pages.
 */
export function displayTourName(raw: string | null | undefined): string {
  const value = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  const cut = value.search(/[.(]|\s[-–—]\s|[-–—]/);
  if (cut > 0) {
    const short = value.slice(0, cut).replace(/[\s/,;:]+$/, "").trim();
    if (short.length >= 3) return short;
  }
  return value;
}
