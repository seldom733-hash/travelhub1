/**
 * Shared constants used by both seed data generation and filter system.
 * Centralizes all valid slugs so seed.ts and filter options stay in sync.
 */

// ── Room types ──
export const ROOM_TYPES = [
  "standard", "superior", "deluxe", "premium", "executive", "club",
  "family", "studio", "junior_suite", "suite", "executive_suite",
  "presidential_suite", "royal_suite", "honeymoon_suite", "apartment",
  "villa", "bungalow", "cottage", "chalet", "duplex", "penthouse",
  "connecting_rooms", "accessible",
] as const;

export const ROOM_TYPE_NAMES_RU: Record<string, string> = {
  standard: "Стандартный", superior: "Улучшенный", deluxe: "Делюкс",
  premium: "Премиум", executive: "Представительский", club: "Клубный",
  family: "Семейный", studio: "Студия", junior_suite: "Полулюкс",
  suite: "Люкс", executive_suite: "Представительский люкс", presidential_suite: "Президентский люкс",
  royal_suite: "Королевский люкс", honeymoon_suite: "Свадебный люкс", apartment: "Апартаменты",
  villa: "Вилла", bungalow: "Бунгало", cottage: "Коттедж", chalet: "Шале",
  duplex: "Двухуровневый", penthouse: "Пентхаус", connecting_rooms: "Смежные номера",
  accessible: "Доступный номер",
};

// ── Bed types ──
export const BED_TYPES = [
  "single", "twin", "double", "queen", "king", "super_king",
  "sofa", "bunk", "baby_cot", "extra_bed",
] as const;

// ── View types ──
export const VIEWS = [
  "city", "sea", "sea_direct", "sea_partial", "pool", "garden",
  "mountain", "lake", "park", "river", "no_view", "panoramic",
] as const;

// ── Smoking options ──
export const SMOKING_OPTIONS = ["non_smoking", "smoking"] as const;

// ── Balcony options ──
export const BALCONY_OPTIONS = [
  "no_balcony", "balcony", "french_balcony", "terrace", "private_garden",
] as const;

// ── Bathroom options ──
export const BATHROOM_OPTIONS = [
  "shower", "bathtub", "jacuzzi", "private_pool", "shared",
] as const;

// ── Area options ──
export const AREA_OPTIONS = ["under_20", "20_30", "30_50", "over_50"] as const;

// ── Occupancy options ──
export const OCCUPANCY_OPTIONS = [
  "sgl", "dbl", "twn", "tpl", "qdpl", "2_1", "2_2", "3_1", "4_1",
] as const;

// ── Room amenities ──
export const ROOM_AMENITIES_LIST = [
  "Wi-Fi", "Кондиционер", "Мини-бар", "Сейф", "Телевизор", "Кофемашина",
  "Чайник", "Рабочий стол", "Кухня", "Холодильник", "Стиральная машина",
  "Фен", "Халаты", "Тапочки", "Микроволновая печь", "Утюг",
] as const;

// ── Meal plans ──
export const MEAL_PLANS = ["RO", "BB", "HB", "FB", "AI"] as const;

// ── Languages ──
export const LANGUAGES = ["RU", "EN", "TR", "AZ", "GE", "DE", "FR", "IT", "ES", "TH", "EL"] as const;

// ── Russian labels for room types ──
export const ROOM_TYPE_LABELS: Record<string, string> = {
  standard: "Стандарт", superior: "Улучшенный", deluxe: "Делюкс",
  premium: "Премиум", executive: "Представительский", club: "Клубный",
  family: "Семейный", studio: "Студия", junior_suite: "Полулюкс",
  suite: "Люкс", executive_suite: "Люкс предст.", presidential_suite: "Президенский",
  royal_suite: "Королевский", honeymoon_suite: "Медовый", apartment: "Апартаменты",
  villa: "Вилла", bungalow: "Бунгало", cottage: "Коттедж", chalet: "Шале",
  duplex: "Двухуровневый", penthouse: "Пентхаус", connecting_rooms: "Смежные", accessible: "Доступный",
};

// ── Russian labels for bed types ──
export const BED_TYPE_LABELS: Record<string, string> = {
  single: "Односпальная", twin: "Твин", double: "Двуспальная",
  queen: "Квин", king: "Кинг", super_king: "Супер Кинг",
  sofa: "Диван", bunk: "Двухъярусная", baby_cot: "Детская кроватка", extra_book: "Доп. место",
};

// ── Russian labels for views ──
export const VIEW_LABELS: Record<string, string> = {
  city: "Город", sea: "Море", sea_direct: "Море напрямую", sea_partial: "Море частично",
  pool: "Бассейн", garden: "Сад", mountain: "Горы", lake: "Озеро",
  park: "Парк", river: "Река", no_view: "Без вида", panoramic: "Панорамный",
};

// ── Russian labels for smoking ──
export const SMOKING_LABELS: Record<string, string> = {
  non_smoking: "Некурящий", smoking: "Курящий",
};

// ── Russian labels for balcony ──
export const BALCONY_LABELS: Record<string, string> = {
  no_balcony: "Без балкона", balcony: "Балкон", french_balcony: "Французский балкон",
  terrace: "Терраса", private_garden: "Частный сад",
};

// ── Russian labels for bathroom ──
export const BATHROOM_LABELS: Record<string, string> = {
  shower: "Душ", bathtub: "Ванна", jacuzzi: "Джакузи",
  private_pool: "Частный бассейн", shared: "Общий санузел",
};

// ── Russian labels for area ──
export const AREA_LABELS: Record<string, string> = {
  under_20: "До 20 м²", "20_30": "20–30 м²", "30_50": "30–50 м²", over_50: "Свыше 50 м²",
};

// ── Russian labels for occupancy ──
export const OCCUPANCY_LABELS: Record<string, string> = {
  sgl: "SGL", dbl: "DBL", twn: "TWN", tpl: "TPL", qdpl: "QDPL",
  "2_1": "2+1", "2_2": "2+2", "3_1": "3+1", "4_1": "4+1",
};
