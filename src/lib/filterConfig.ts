/**
 * Filter definitions per service category.
 * Mirrors the old project's filterConfig.ts — same types, order, and options.
 */
import {
  ROOM_TYPES, BED_TYPES, VIEWS,
  SMOKING_OPTIONS, BALCONY_OPTIONS, BATHROOM_OPTIONS,
  AREA_OPTIONS, OCCUPANCY_OPTIONS,
} from "./constants";

// ── Types ──

export type FilterType = "checkbox" | "radio" | "range" | "rating" | "date" | "country" | "city" | "region";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterDefinition {
  id: string;
  i18nKey: string;
  type: FilterType;
  options?: FilterOption[];
  min?: number;
  max?: number;
  /** Optional group header — filters sharing the same group are visually grouped under a label. */
  group?: string;
}

export type ServiceCategory = "tour" | "hotel" | "sanatorium" | "excursion" | "guide" | "photographer" | "flight" | "train" | "transfer";

// ── Helpers: generate FilterOption[] from shared constant arrays ──

function slugOptions(slugs: readonly string[], labelMap: Record<string, string>): FilterOption[] {
  return slugs.map(s => ({ label: labelMap[s] ?? s, value: s }));
}

/** Room type options with Russian labels */
const roomTypeOptions: FilterOption[] = slugOptions(ROOM_TYPES, {
  standard: "Стандарт", superior: "Улучшенный", deluxe: "Делюкс",
  premium: "Премиум", executive: "Представительский", club: "Клубный",
  family: "Семейный", studio: "Студия", junior_suite: "Полулюкс",
  suite: "Люкс", executive_suite: "Люкс предст.", presidential_suite: "Президенский",
  royal_suite: "Королевский", honeymoon_suite: "Медовый", apartment: "Апартаменты",
  villa: "Вилла", bungalow: "Бунгало", cottage: "Коттедж", chalet: "Шале",
  duplex: "Двухуровневый", penthouse: "Пентхаус", connecting_rooms: "Смежные", accessible: "Доступный",
});

/** Bed type options with Russian labels */
const bedTypeOptions: FilterOption[] = slugOptions(BED_TYPES, {
  single: "Односпальная", twin: "Твин", double: "Двуспальная",
  queen: "Квин", king: "Кинг", super_king: "Супер Кинг",
  sofa: "Диван", bunk: "Двухъярусная", baby_cot: "Детская кроватка", extra_bed: "Доп. место",
});

/** View options with Russian labels */
const VIEW_LABELS: Record<string, string> = {
  city: "Город", sea: "Море", sea_direct: "Море напрямую", sea_partial: "Море частично",
  pool: "Бассейн", garden: "Сад", mountain: "Горы", lake: "Озеро",
  park: "Парк", river: "Река", no_view: "Без вида", panoramic: "Панорамный",
};
const viewOptions: FilterOption[] = VIEWS.map(s => ({ label: VIEW_LABELS[s] ?? s, value: s }));

const SMOKING_LABELS: Record<string, string> = {
  non_smoking: "Некурящий", smoking: "Курящий",
};
const smokingOptions: FilterOption[] = SMOKING_OPTIONS.map(s => ({ label: SMOKING_LABELS[s] ?? s, value: s }));

const BALCONY_LABELS: Record<string, string> = {
  no_balcony: "Без балкона", balcony: "Балкон", french_balcony: "Французский балкон",
  terrace: "Терраса", private_garden: "Частный сад",
};
const balconyOptions: FilterOption[] = BALCONY_OPTIONS.map(s => ({ label: BALCONY_LABELS[s] ?? s, value: s }));

const BATHROOM_LABELS: Record<string, string> = {
  shower: "Душ", bathtub: "Ванна", jacuzzi: "Джакузи",
  private_pool: "Частный бассейн", shared: "Общий санузел",
};
const bathroomOptions: FilterOption[] = BATHROOM_OPTIONS.map(s => ({ label: BATHROOM_LABELS[s] ?? s, value: s }));

const AREA_LABELS: Record<string, string> = {
  under_20: "До 20 м²", "20_30": "20–30 м²", "30_50": "30–50 м²", over_50: "Свыше 50 м²",
};
const areaOptions: FilterOption[] = AREA_OPTIONS.map(s => ({ label: AREA_LABELS[s] ?? s, value: s }));

const OCCUPANCY_LABELS: Record<string, string> = {
  sgl: "SGL", dbl: "DBL", twn: "TWN", tpl: "TPL", qdpl: "QDPL",
  "2_1": "2+1", "2_2": "2+2", "3_1": "3+1", "4_1": "4+1",
};
const occupancyOptions: FilterOption[] = OCCUPANCY_OPTIONS.map(s => ({ label: OCCUPANCY_LABELS[s] ?? s, value: s }));

/** Stars filter options */
const starsOptions: FilterOption[] = [
  { label: "Без звёзд", value: "none" },
  { label: "★★★★★", value: "5" },
  { label: "★★★★", value: "4" },
  { label: "★★★", value: "3" },
  { label: "★★", value: "2" },
  { label: "★", value: "1" },
];

// ── Filter configs per category ──

export const filterConfigs: Record<ServiceCategory, FilterDefinition[]> = {
  // Туры: Страна, Город, Дата, Ночей, Питание, Тип отдыха, Первая линия, Всё включено, Дети, Аквапарк, Горящие, Без визы, Цена, Рейтинг, + Отель/Авиа
  tour: [
    { id: "country", i18nKey: "Страна", type: "country" },
    { id: "city", i18nKey: "Город", type: "city" },
    { id: "startDate", i18nKey: "Дата заезда", type: "date" },
    { id: "nights", i18nKey: "Кол-во ночей", type: "radio", options: [
      { label: "До вылета", value: "0" },
      { label: "1–3 ночи", value: "1-3" },
      { label: "4–7 ночей", value: "4-7" },
      { label: "8–14 ночей", value: "8-14" },
      { label: "15+ ночей", value: "15+" },
    ]},
    { id: "meal", i18nKey: "Питание", type: "checkbox", options: [
      { label: "Без питания", value: "none" },
      { label: "Завтрак", value: "breakfast" },
      { label: "Полупансион", value: "half" },
      { label: "Полный пансион", value: "full" },
      { label: "Всё включено", value: "all_inclusive" },
    ]},
    { id: "tourType", i18nKey: "Тип отдыха", type: "checkbox", options: [
      { label: "Пляжный", value: "beach" },
      { label: "Групповой", value: "group" },
      { label: "Индивидуальный", value: "individual" },
      { label: "Круиз", value: "cruise" },
      { label: "Горнолыжный", value: "ski" },
    ]},
    { id: "firstLine", i18nKey: "Первая линия", type: "checkbox", options: [
      { label: "Первая линия", value: "first_line" },
    ]},
    { id: "allInclusive", i18nKey: "Всё включено", type: "checkbox", options: [
      { label: "Всё включено", value: "all_inclusive" },
    ]},
    { id: "kids", i18nKey: "Для детей", type: "checkbox", options: [
      { label: "Для детей", value: "kids" },
    ]},
    { id: "waterpark", i18nKey: "Аквапарк", type: "checkbox", options: [
      { label: "Аквапарк", value: "waterpark" },
    ]},
    { id: "hotTour", i18nKey: "Горящие туры", type: "checkbox", options: [
      { label: "Горящие туры", value: "hot" },
    ]},
    { id: "visa", i18nKey: "Виза", type: "radio", options: [
      { label: "Без визы", value: "free" },
      { label: "Нужна виза", value: "required" },
    ]},
    { id: "price", i18nKey: "Цена", type: "range", min: 0, max: 10000 },
    { id: "rating", i18nKey: "Рейтинг", type: "rating" },
    // ── Фильтры отеля ──
    { id: "stars", i18nKey: "Звёзды отеля", type: "checkbox", group: "hotel", options: starsOptions },
    { id: "view", i18nKey: "Вид из окна", type: "checkbox", group: "hotel", options: viewOptions },
    { id: "smoking", i18nKey: "Курение", type: "checkbox", group: "hotel", options: smokingOptions },
    { id: "balcony", i18nKey: "Балкон", type: "checkbox", group: "hotel", options: balconyOptions },
    { id: "bathroom", i18nKey: "Санузел", type: "checkbox", group: "hotel", options: bathroomOptions },
    { id: "area", i18nKey: "Площадь номера", type: "checkbox", group: "hotel", options: areaOptions },
    { id: "occupancy", i18nKey: "Вместимость", type: "checkbox", group: "hotel", options: occupancyOptions },
    { id: "amenities", i18nKey: "Удобства отеля", type: "checkbox", group: "hotel", options: [
      { label: "Бассейн", value: "pool" }, { label: "SPA", value: "spa" },
      { label: "Wi-Fi", value: "wifi" }, { label: "Парковка", value: "parking" },
      { label: "Спортзал", value: "gym" }, { label: "Пляж", value: "beach" },
      { label: "Аквапарк", value: "waterpark" }, { label: "Детский клуб", value: "kids_club" },
    ]},
    { id: "roomAmenities", i18nKey: "Удобства номера", type: "checkbox", group: "hotel", options: [
      { label: "Wi-Fi в номере", value: "wifi" }, { label: "Кондиционер", value: "aircon" },
      { label: "Мини-бар", value: "minibar" }, { label: "Сейф", value: "safe" },
      { label: "Телевизор", value: "tv" }, { label: "Кофемашина", value: "coffee" },
      { label: "Чайник", value: "kettle" }, { label: "Рабочий стол", value: "desk" },
      { label: "Кухня", value: "kitchen" }, { label: "Холодильник", value: "fridge" },
      { label: "Микроволновая", value: "microwave" }, { label: "Стиральная машина", value: "washer" },
      { label: "Фен", value: "hairdryer" }, { label: "Халаты", value: "bathrobes" },
      { label: "Тапочки", value: "slippers" }, { label: "Утюг", value: "iron" },
    ]},
    { id: "distanceToSea", i18nKey: "Расстояние до моря", type: "radio", group: "hotel", options: [
      { label: "На пляже", value: "0" }, { label: "До 100 м", value: "100" },
      { label: "До 500 м", value: "500" }, { label: "До 1 км", value: "1000" },
    ]},
    { id: "petsAllowed", i18nKey: "Домашние животные", type: "checkbox", group: "hotel", options: [
      { label: "Разрешены животные", value: "pets" },
    ]},
    // ── Фильтры авиарейса ──
    { id: "stops", i18nKey: "Пересадки", type: "radio", group: "flight", options: [
      { label: "Прямой", value: "0" }, { label: "1 пересадка", value: "1" },
      { label: "2+ пересадки", value: "2+" },
    ]},
    { id: "airline", i18nKey: "Авиакомпания", type: "checkbox", group: "flight", options: [
      { label: "AZAL", value: "azal" }, { label: "Turkish Airlines", value: "turkish" },
      { label: "FlyDubai", value: "flydubai" }, { label: "S7", value: "s7" },
      { label: "Qatar Airways", value: "qatar" },
    ]},
    { id: "departureTime", i18nKey: "Время вылета", type: "checkbox", group: "flight", options: [
      { label: "Утро (06–12)", value: "morning" }, { label: "День (12–18)", value: "afternoon" },
      { label: "Вечер (18–00)", value: "evening" }, { label: "Ночь (00–06)", value: "night" },
    ]},
    { id: "baggage", i18nKey: "Багаж", type: "radio", group: "flight", options: [
      { label: "Только ручная", value: "cabin" }, { label: "Есть багаж", value: "checked" },
    ]},
  ],

  // Отели: Страна, Город, Дата, Звёзды, Тип номера, Кровати, Питание, Вид, Курение, Балкон, Санузел, Площадь, Вместимость, Удобства, Расст. до моря, Цена, Рейтинг
  hotel: [
    { id: "country", i18nKey: "Страна", type: "country" },
    { id: "city", i18nKey: "Город", type: "city" },
    { id: "startDate", i18nKey: "Дата заезда", type: "date" },
    { id: "stars", i18nKey: "Звёзды", type: "checkbox", options: starsOptions },
    { id: "roomType", i18nKey: "Тип номера", type: "checkbox", options: roomTypeOptions },
    { id: "bedType", i18nKey: "Тип кроватей", type: "checkbox", options: bedTypeOptions },
    { id: "meal", i18nKey: "Питание", type: "checkbox", options: [
      { label: "Без питания", value: "none" },
      { label: "Завтрак", value: "breakfast" },
      { label: "Полупансион", value: "half" },
      { label: "Полный пансион", value: "full" },
      { label: "Всё включено", value: "all_inclusive" },
    ]},
    { id: "view", i18nKey: "Вид из окна", type: "checkbox", options: viewOptions },
    { id: "smoking", i18nKey: "Курение", type: "checkbox", options: smokingOptions },
    { id: "balcony", i18nKey: "Балкон", type: "checkbox", options: balconyOptions },
    { id: "bathroom", i18nKey: "Санузел", type: "checkbox", options: bathroomOptions },
    { id: "area", i18nKey: "Площадь номера", type: "checkbox", options: areaOptions },
    { id: "occupancy", i18nKey: "Вместимость", type: "checkbox", options: occupancyOptions },
    { id: "amenities", i18nKey: "Удобства отеля", type: "checkbox", options: [
      { label: "Бассейн", value: "pool" }, { label: "SPA", value: "spa" },
      { label: "Wi-Fi", value: "wifi" }, { label: "Парковка", value: "parking" },
      { label: "Спортзал", value: "gym" }, { label: "Пляж", value: "beach" },
      { label: "Аквапарк", value: "waterpark" }, { label: "Детский клуб", value: "kids_club" },
    ]},
    { id: "roomAmenities", i18nKey: "Удобства номера", type: "checkbox", options: [
      { label: "Wi-Fi в номере", value: "wifi" }, { label: "Кондиционер", value: "aircon" },
      { label: "Мини-бар", value: "minibar" }, { label: "Сейф", value: "safe" },
      { label: "Телевизор", value: "tv" }, { label: "Кофемашина", value: "coffee" },
      { label: "Чайник", value: "kettle" }, { label: "Рабочий стол", value: "desk" },
      { label: "Кухня", value: "kitchen" }, { label: "Холодильник", value: "fridge" },
      { label: "Микроволновая", value: "microwave" }, { label: "Стиральная машина", value: "washer" },
      { label: "Фен", value: "hairdryer" }, { label: "Халаты", value: "bathrobes" },
      { label: "Тапочки", value: "slippers" }, { label: "Утюг", value: "iron" },
    ]},
    { id: "distanceToSea", i18nKey: "Расстояние до моря", type: "radio", options: [
      { label: "На пляже", value: "0" }, { label: "До 100 м", value: "100" },
      { label: "До 500 м", value: "500" }, { label: "До 1 км", value: "1000" },
    ]},
    { id: "petsAllowed", i18nKey: "Домашние животные", type: "checkbox", options: [
      { label: "Разрешены животные", value: "pets" },
    ]},
    { id: "price", i18nKey: "Цена", type: "range", min: 0, max: 5000 },
    { id: "rating", i18nKey: "Рейтинг", type: "rating" },
    { id: "cancellation", i18nKey: "Бесплатная отмена", type: "checkbox", options: [
      { label: "Бесплатная отмена", value: "free_cancel" },
    ]},
  ],

  // Санатории: Страна, Город, Дата, Звёзды, Профиль лечения, Удобства, Диета, Врач, Цена, Рейтинг
  sanatorium: [
    { id: "country", i18nKey: "Страна", type: "country" },
    { id: "city", i18nKey: "Город", type: "city" },
    { id: "startDate", i18nKey: "Дата заезда", type: "date" },
    { id: "stars", i18nKey: "Звёзды", type: "checkbox", options: starsOptions },
    { id: "treatment", i18nKey: "Профиль лечения", type: "checkbox", options: [
      { label: "Минеральные воды", value: "mineral_water" },
      { label: "Грязелечение", value: "mud_therapy" },
      { label: "Кардиология", value: "cardiology" },
      { label: "Опорно-двигательный", value: "musculoskeletal" },
      { label: "Суставы", value: "joints" },
      { label: "Нервная система", value: "nervous" },
      { label: "Косметология", value: "cosmetology" },
      { label: "Стоматология", value: "dental" },
      { label: "Детокс", value: "detox" },
    ]},
    { id: "amenities", i18nKey: "Удобства", type: "checkbox", options: [
      { label: "Бассейн", value: "pool" }, { label: "SPA", value: "spa" },
      { label: "Wi-Fi", value: "wifi" }, { label: "Спортзал", value: "gym" },
    ]},
    { id: "diet", i18nKey: "Диета", type: "checkbox", options: [
      { label: "Без соли", value: "no_salt" }, { label: "Веганская", value: "vegan" },
      { label: "Диабетическая", value: "diabetic" }, { label: "Гипоаллергенная", value: "hypoallergenic" },
    ]},
    { id: "hasDoctor", i18nKey: "Врач на территории", type: "checkbox", options: [
      { label: "Врач на территории", value: "doctor" },
    ]},
    { id: "price", i18nKey: "Цена", type: "range", min: 0, max: 3000 },
    { id: "rating", i18nKey: "Рейтинг", type: "rating" },
  ],

  // Экскурсии: Страна, Город, Дата, Категория, Длительность, Язык, Тип, Дети, Транспорт, Билеты, Цена, Рейтинг
  excursion: [
    { id: "country", i18nKey: "Страна", type: "country" },
    { id: "city", i18nKey: "Город", type: "city" },
    { id: "startDate", i18nKey: "Дата", type: "date" },
    { id: "category", i18nKey: "Категория", type: "checkbox", options: [
      { label: "Обзорная", value: "sightseeing" }, { label: "Приключения", value: "adventure" },
      { label: "Культурная", value: "cultural" }, { label: "Природа", value: "nature" },
      { label: "Гастрономия", value: "food" },
    ]},
    { id: "duration", i18nKey: "Длительность", type: "radio", options: [
      { label: "До 2 часов", value: "2" }, { label: "До 4 часов", value: "4" },
      { label: "До 8 часов", value: "8" }, { label: "Весь день", value: "full" },
      { label: "Несколько дней", value: "multi" },
    ]},
    { id: "language", i18nKey: "Язык", type: "checkbox", options: [
      { label: "Русский", value: "ru" }, { label: "Английский", value: "en" },
      { label: "Азербайджанский", value: "az" }, { label: "Турецкий", value: "tr" },
      { label: "Арабский", value: "ar" },
    ]},
    { id: "excursionType", i18nKey: "Тип экскурсии", type: "radio", options: [
      { label: "Групповая", value: "group" }, { label: "Индивидуальная", value: "individual" },
    ]},
    { id: "kids", i18nKey: "Для детей", type: "checkbox", options: [
      { label: "Для детей", value: "kids" },
    ]},
    { id: "tourType", i18nKey: "Транспорт", type: "checkbox", options: [
      { label: "Пешая", value: "walking" }, { label: "Автобусная", value: "bus" },
      { label: "Морская", value: "sea" },
    ]},
    { id: "ticketsIncluded", i18nKey: "Билеты включены", type: "checkbox", options: [
      { label: "Билеты включены", value: "tickets_included" },
    ]},
    { id: "price", i18nKey: "Цена", type: "range", min: 0, max: 500 },
    { id: "rating", i18nKey: "Рейтинг", type: "rating" },
  ],

  // Гиды: Страна, Город, Дата, Язык, Опыт, Авто, Лицензия, Специализация, Цена, Рейтинг
  guide: [
    { id: "country", i18nKey: "Страна", type: "country" },
    { id: "city", i18nKey: "Город", type: "city" },
    { id: "startDate", i18nKey: "Дата", type: "date" },
    { id: "language", i18nKey: "Язык", type: "checkbox", options: [
      { label: "Русский", value: "ru" }, { label: "Английский", value: "en" },
      { label: "Азербайджанский", value: "az" }, { label: "Турецкий", value: "tr" },
      { label: "Немецкий", value: "de" }, { label: "Французский", value: "fr" },
    ]},
    { id: "experience", i18nKey: "Опыт работы", type: "radio", options: [
      { label: "До 1 года", value: "1" }, { label: "До 3 лет", value: "3" },
      { label: "До 5 лет", value: "5" }, { label: "Свыше 5 лет", value: "5+" },
    ]},
    { id: "hasCar", i18nKey: "Есть автомобиль", type: "checkbox", options: [
      { label: "Есть автомобиль", value: "car" },
    ]},
    { id: "hasLicense", i18nKey: "Лицензия", type: "checkbox", options: [
      { label: "Лицензия", value: "license" },
    ]},
    { id: "specialization", i18nKey: "Специализация", type: "checkbox", options: [
      { label: "История", value: "history" }, { label: "Природа", value: "nature" },
      { label: "Музеи", value: "museums" }, { label: "Пешеходные", value: "walking" },
      { label: "Гастрономия", value: "gastronomy" }, { label: "Приключения", value: "adventure" },
      { label: "VIP", value: "vip" },
    ]},
    { id: "price", i18nKey: "Цена", type: "range", min: 0, max: 500 },
    { id: "rating", i18nKey: "Рейтинг", type: "rating" },
  ],

  // Фотографы: Страна, Город, Дата, Язык, Опыт, Жанр, Цена, Рейтинг
  photographer: [
    { id: "country", i18nKey: "Страна", type: "country" },
    { id: "city", i18nKey: "Город", type: "city" },
    { id: "startDate", i18nKey: "Дата", type: "date" },
    { id: "language", i18nKey: "Язык", type: "checkbox", options: [
      { label: "Русский", value: "ru" }, { label: "Английский", value: "en" },
      { label: "Азербайджанский", value: "az" },
    ]},
    { id: "experience", i18nKey: "Опыт работы", type: "radio", options: [
      { label: "До 1 года", value: "1" }, { label: "До 3 лет", value: "3" },
      { label: "До 5 лет", value: "5" }, { label: "Свыше 5 лет", value: "5+" },
    ]},
    { id: "genre", i18nKey: "Жанр", type: "checkbox", options: [
      { label: "Love Story", value: "love_story" }, { label: "Семейная", value: "family" },
      { label: "Портретная", value: "portrait" }, { label: "Свадебная", value: "wedding" },
      { label: "Индивидуальная", value: "individual" }, { label: "Путешествия", value: "travel" },
      { label: "Мероприятия", value: "event" }, { label: "Коммерческая", value: "commercial" },
    ]},
    { id: "price", i18nKey: "Цена", type: "range", min: 0, max: 2000 },
    { id: "rating", i18nKey: "Рейтинг", type: "rating" },
  ],

  // Авиабилеты: Дата, Пересадки, Авиакомпания, Время вылета, Багаж, Возврат, Цена
  flight: [
    { id: "startDate", i18nKey: "Дата вылета", type: "date" },
    { id: "stops", i18nKey: "Пересадки", type: "radio", options: [
      { label: "Прямой", value: "0" }, { label: "1 пересадка", value: "1" },
      { label: "2+ пересадки", value: "2+" },
    ]},
    { id: "airline", i18nKey: "Авиакомпания", type: "checkbox", options: [
      { label: "AZAL", value: "azal" }, { label: "Turkish Airlines", value: "turkish" },
      { label: "FlyDubai", value: "flydubai" }, { label: "S7", value: "s7" },
      { label: "Qatar Airways", value: "qatar" },
    ]},
    { id: "departureTime", i18nKey: "Время вылета", type: "checkbox", options: [
      { label: "Утро (06–12)", value: "morning" }, { label: "День (12–18)", value: "afternoon" },
      { label: "Вечер (18–00)", value: "evening" }, { label: "Ночь (00–06)", value: "night" },
    ]},
    { id: "baggage", i18nKey: "Багаж", type: "radio", options: [
      { label: "Только ручная", value: "cabin" }, { label: "Есть багаж", value: "checked" },
    ]},
    { id: "refundable", i18nKey: "Возвратный", type: "checkbox", options: [
      { label: "Возвратный", value: "refundable" },
    ]},
    { id: "price", i18nKey: "Цена", type: "range", min: 0, max: 5000 },
  ],

  // ЖД билеты: Дата, Тип вагона, Время отправления, Перевозчик, Цена
  train: [
    { id: "startDate", i18nKey: "Дата отправления", type: "date" },
    { id: "wagonType", i18nKey: "Тип вагона", type: "checkbox", options: [
      { label: "Плацкарт", value: "platzkart" }, { label: "Купе", value: "kupe" },
      { label: "СВ", value: "sv" }, { label: "Бизнес", value: "business" },
    ]},
    { id: "departureTime", i18nKey: "Время отправления", type: "checkbox", options: [
      { label: "Утро (06–12)", value: "morning" }, { label: "День (12–18)", value: "afternoon" },
      { label: "Вечер (18–00)", value: "evening" }, { label: "Ночь (00–06)", value: "night" },
    ]},
    { id: "carrier", i18nKey: "Перевозчик", type: "checkbox", options: [
      { label: "АДЫ", value: "ady" }, { label: "РЖД", value: "rzd" },
      { label: "TCDD", value: "tcdd" },
    ]},
    { id: "price", i18nKey: "Цена", type: "range", min: 0, max: 1000 },
  ],

  // Трансферы: Страна, Город, Дата, Класс авто, Вместимость, Встреча, Цена
  transfer: [
    { id: "country", i18nKey: "Страна", type: "country" },
    { id: "city", i18nKey: "Город", type: "city" },
    { id: "startDate", i18nKey: "Дата", type: "date" },
    { id: "carClass", i18nKey: "Класс авто", type: "radio", options: [
      { label: "Эконом", value: "economy" }, { label: "Комфорт", value: "comfort" },
      { label: "Бизнес", value: "business" }, { label: "Минивэн", value: "van" },
      { label: "Микроавтобус", value: "minibus" },
    ]},
    { id: "capacity", i18nKey: "Вместимость", type: "radio", options: [
      { label: "До 3 чел.", value: "3" }, { label: "До 6 чел.", value: "6" },
      { label: "До 12 чел.", value: "12" }, { label: "До 20 чел.", value: "20" },
    ]},
    { id: "meetingType", i18nKey: "Встреча", type: "radio", options: [
      { label: "С табличкой", value: "sign" }, { label: "Табло", value: "board" },
    ]},
    { id: "price", i18nKey: "Цена", type: "range", min: 0, max: 500 },
  ],
};
