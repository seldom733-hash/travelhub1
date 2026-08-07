import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { countriesDatabase } from "../src/lib/countries-data";
import { userBusinessCode } from "../src/lib/ids";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const hash = (s: string) => `hash:${s}`;

// ════════════════════════════════════════════════════════════════════
// Детерминированный PRNG (mulberry32) — данные воспроизводимы при перезапуске
// ════════════════════════════════════════════════════════════════════
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260731);
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;

const DAY = 86400000;
const dateBetween = (start: Date, end: Date) =>
  new Date(start.getTime() + rand() * (end.getTime() - start.getTime()));

// ════════════════════════════════════════════════════════════════════
// Пул имён и компаний
// ════════════════════════════════════════════════════════════════════
const FIRST_NAMES = [
  "Александр", "Мария", "Дмитрий", "Анна", "Сергей", "Ольга", "Алексей", "Екатерина",
  "Иван", "Наталья", "Максим", "Елена", "Артём", "Ирина", "Никита", "Татьяна",
  "Павел", "Юлия", "Роман", "Виктория", "Кирилл", "Анастасия", "Егор", "Дарья",
  "Тимур", "Ксения", "Владимир", "Полина", "Андрей", "Светлана", "Олег", "Алина",
];
const LAST_NAMES = [
  "Иванов", "Петров", "Смирнов", "Кузнецов", "Попов", "Соколов", "Лебедев", "Козлов",
  "Новиков", "Морозов", "Волков", "Соловьёв", "Васильев", "Зайцев", "Павлов", "Семёнов",
  "Голубев", "Виноградов", "Богданов", "Воробьёв", "Фёдоров", "Михайлов", "Беляев",
  "Тарасов", "Белов", "Комаров", "Орлов", "Киселёв", "Макаров", "Андреев",
];
const PARTNER_COMPANIES = [
  "Navitravel", "TravelPro", "GeoTrip", "SunHorizon", "AeroVoyage", "MedSpa Group",
  "ExcursionPro", "PhotoTravel", "CityTransfer", "RailMaster", "LuxStay", "EcoJourney",
  "AsiaDream", "BlueLagoon", "MountainPeak", "DesertOasis", "NordicWay", "OceanBreeze",
  "GoldenSun", "StarVoyage",
];

// ════════════════════════════════════════════════════════════════════
// Пул типов услуг, шаблонов названий, цен, длительностей
// ════════════════════════════════════════════════════════════════════
type ServiceTypeName =
  | "TOUR" | "HOTEL" | "SANATORIUM" | "EXCURSION" | "GUIDE"
  | "TRANSFER" | "FLIGHT" | "TRAIN" | "PHOTOGRAPHER";

type ServiceStatusName =
  | "DRAFT" | "REVIEW" | "READY" | "PUBLISHED" | "SUSPENDED" | "ARCHIVED";

const SERVICE_TYPE_WEIGHTS: [ServiceTypeName, number][] = [
  ["TOUR", 26], ["HOTEL", 22], ["EXCURSION", 12], ["GUIDE", 10], ["TRANSFER", 9],
  ["SANATORIUM", 7], ["FLIGHT", 6], ["TRAIN", 5], ["PHOTOGRAPHER", 3],
];

const TITLE_TPL: Record<ServiceTypeName, string[]> = {
  TOUR: [
    "Тур в {city}", "Отдых в {city}", "Пляжный тур: {city}, {country}",
    "Экскурсионный тур по {city}", "Романтический тур в {city}", "Семейный тур в {city}",
    "Премиум-тур в {city}", "Горящий тур в {city}", "Тур выходного дня в {city}",
  ],
  HOTEL: [
    "Отель «{city} Palace»", "Курортный отель в {city}", "Бутик-отель «{city}»",
    "SPA-отель в {city}", "Семейный отель «{city}»", "Отель 5★ в {city}",
    "Апарт-отель «{city}»", "Отель с видом на море, {city}", "Отель «{city} Garden»",
  ],
  SANATORIUM: [
    "Санаторий «{city}»", "Лечебный санаторий в {city}", "Курорт «{city} Health»",
    "Санаторий с минеральными водами, {city}", "Оздоровительный центр «{city}»",
    "Профилакторий в {city}",
  ],
  EXCURSION: [
    "Обзорная экскурсия по {city}", "Пешая экскурсия по {city}", "Экскурсия в {city}",
    "Гастротур по {city}", "Ночная экскурсия {city}", "Экскурсия по старому {city}",
    "Природная экскурсия: {city}", "Музейная экскурсия в {city}",
  ],
  GUIDE: [
    "Личный гид в {city}", "Гид-переводчик в {city}", "Экскурсовод по {city}",
    "Гид на день: {city}", "Гид по достопримечательностям {city}", "Русскоговорящий гид в {city}",
  ],
  TRANSFER: [
    "Трансфер аэропорт — отель, {city}", "Трансфер в {city}", "Встреча в аэропорту {city}",
    "Трансфер отель — аэропорт, {city}", "Индивидуальный трансфер в {city}",
    "Групповой трансфер {city}",
  ],
  FLIGHT: [
    "Авиабилет в {city}", "Перелёт в {city}", "Прямой рейс в {city}",
    "Авиабилет {city} — с вылетом из Баку", "Эконом-перелёт в {city}", "Бизнес-класс в {city}",
  ],
  TRAIN: [
    "Ж/д билет в {city}", "Поезд в {city}", "Скоростной поезд в {city}",
    "Ж/д билет {city} — из Баку", "Ночной поезд в {city}",
  ],
  PHOTOGRAPHER: [
    "Фотосессия в {city}", "Свадебная съёмка в {city}", "Лавсторi в {city}",
    "Портретная съёмка в {city}", "Репортажная съёмка {city}", "Фототур по {city}",
  ],
};

const PRICE_RANGE: Record<ServiceTypeName, [number, number]> = {
  TOUR: [350, 5500],
  HOTEL: [45, 900],
  SANATORIUM: [70, 350],
  EXCURSION: [20, 320],
  GUIDE: [15, 220],
  TRANSFER: [18, 420],
  FLIGHT: [90, 1600],
  TRAIN: [25, 350],
  PHOTOGRAPHER: [60, 520],
};

const DURATION_TPL: Record<ServiceTypeName, string[]> = {
  TOUR: ["7 ночей / 8 дней", "10 ночей / 11 дней", "14 ночей / 15 дней", "4 ночи / 5 дней"],
  HOTEL: ["1 ночь", "2 ночи", "5 ночей", "7 ночей"],
  SANATORIUM: ["7 дней", "14 дней", "21 день"],
  EXCURSION: ["2 часа", "4 часа", "6 часов", "Полный день"],
  GUIDE: ["3 часа", "6 часов", "Полный день"],
  TRANSFER: ["40 мин", "1 час", "1.5 часа", "2 часа"],
  FLIGHT: ["2ч 15м", "3ч 40м", "5ч 20м", "8ч 05м"],
  TRAIN: ["8ч", "12ч", "24ч"],
  PHOTOGRAPHER: ["1 час", "2 часа", "4 часа"],
};

const LANGUAGES = ["RU", "EN", "TR", "AZ", "GE", "DE", "FR", "IT", "ES", "TH", "EL"];

/** SEO-описание услуги (Гл. 4.8): короткий маркетинговый текст. */
function shortDescFor(geo: { country: string; city: string }): string {
  return `Путешествие в ${geo.country}: ${geo.city}. Выгодное предложение от партнёра TravelHub — бронируйте онлайн.`;
}

// Популярные направления получают больше услуг (для «популярных направлений» в дашборде)
const POPULAR_CODES = ["TR", "AE", "EG", "TH", "GE", "AZ", "RU", "IT", "ES", "GR"];

function pickCountryCode(): { code: string; country: string; city: string } {
  const pool = chance(0.72)
    ? countriesDatabase.filter((c) => POPULAR_CODES.includes(c.code))
    : countriesDatabase;
  const country = pick(pool.length ? pool : countriesDatabase);
  const city = country.cities.length ? pick(country.cities) : undefined;
  return {
    code: country.code,
    country: country.name.ru,
    city: city?.name.ru ?? country.name.ru,
  };
}

function weightedType(): ServiceTypeName {
  const total = SERVICE_TYPE_WEIGHTS.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [t, w] of SERVICE_TYPE_WEIGHTS) {
    r -= w;
    if (r <= 0) return t;
  }
  return "TOUR";
}

/**
 * Распределение даты создания: ~5% сегодня, ~15% за неделю, ~25% за месяц,
 * ~35% за год, остальное в 2025 — чтобы дашборды показывали метрики
 * «за сегодня / неделю / месяц / год».
 */
const NOW = new Date();
function serviceCreatedAt(): Date {
  const r = rand();
  if (r < 0.05) return dateBetween(new Date(NOW.getTime() - DAY), NOW);
  if (r < 0.20) return dateBetween(new Date(NOW.getTime() - 7 * DAY), NOW);
  if (r < 0.45) return dateBetween(new Date(NOW.getTime() - 30 * DAY), NOW);
  if (r < 0.80) return dateBetween(new Date(NOW.getTime() - 365 * DAY), NOW);
  return dateBetween(new Date("2025-01-01"), new Date("2025-12-31"));
}

function userCreatedAt(isBuyer: boolean): Date {
  if (isBuyer) return dateBetween(new Date("2026-01-01"), new Date("2026-07-31"));
  return dateBetween(new Date("2025-01-01"), new Date("2026-07-31"));
}

function randomName() {
  return { firstName: pick(FIRST_NAMES), lastName: pick(LAST_NAMES) };
}

async function main() {
  console.log("Seeding TravelHub v1...");

  // ── Админ ──
  await prisma.user.upsert({
    where: { email: "admin@travelhub.az" },
    update: { defaultWorkspace: "main" },
    create: {
      email: "admin@travelhub.az",
      passwordHash: hash("admin123"),
      firstName: "Надир",
      lastName: "Сулейманов",
      role: "ADMIN",
      defaultWorkspace: "main",
    },
  });

  // ── Менеджер по продажам и операционист (Гл. 1.2): стартовые пространства
  // «Продажи» и «Исполнение» фиксируются в настройках пользователя.
  await prisma.user.upsert({
    where: { email: "sales@travelhub.az" },
    update: { defaultWorkspace: "sales" },
    create: {
      email: "sales@travelhub.az",
      passwordHash: hash("manager123"),
      firstName: "Айхан",
      lastName: "Рагимов",
      role: "SALES_MANAGER",
      defaultWorkspace: "sales",
      createdAt: userCreatedAt(false),
    },
  });
  await prisma.user.upsert({
    where: { email: "operator@travelhub.az" },
    update: { defaultWorkspace: "execution" },
    create: {
      email: "operator@travelhub.az",
      passwordHash: hash("manager123"),
      firstName: "Эльвин",
      lastName: "Мамедов",
      role: "OPERATOR",
      defaultWorkspace: "execution",
      createdAt: userCreatedAt(false),
    },
  });

  // ── Роли из Гл. 2.2: Руководитель, Финансовый отдел, Маркетолог, Аналитик, Модератор ──
  // Каждая роль получает рабочее пространство Dashboard по умолчанию и полный доступ
  // к админке (см. FULL_ADMIN_ROLES в lib/admin-access.ts).
  const roleUsers: { email: string; role: string; firstName: string; lastName: string; workspace: string }[] = [
    { email: "director@travelhub.az", role: "DIRECTOR", firstName: "Лейла", lastName: "Алиева", workspace: "main" },
    { email: "finance@travelhub.az", role: "FINANCE", firstName: "Кямал", lastName: "Гусейнов", workspace: "finance" },
    { email: "marketer@travelhub.az", role: "MARKETER", firstName: "Нигяр", lastName: "Гаджиева", workspace: "marketing" },
    { email: "analyst@travelhub.az", role: "ANALYST", firstName: "Рауф", lastName: "Бабаев", workspace: "main" },
    { email: "moderator@travelhub.az", role: "MODERATOR", firstName: "Айсель", lastName: "Каримова", workspace: "main" },
  ];
  for (const u of roleUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { defaultWorkspace: u.workspace },
      create: {
        email: u.email,
        passwordHash: hash("manager123"),
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role as never,
        defaultWorkspace: u.workspace,
        createdAt: userCreatedAt(false),
      },
    });
  }

  // ── Демо-покупатель ──
  const buyerRecords: { id: string; createdAt: Date }[] = [];
  const demoBuyer = await prisma.user.upsert({
    where: { email: "buyer@mail.com" },
    update: {},
    create: {
      email: "buyer@mail.com",
      passwordHash: hash("buyer123"),
      firstName: "Мария",
      role: "BUYER",
    },
  });
  buyerRecords.push({ id: demoBuyer.id, createdAt: demoBuyer.createdAt });

  // ── Партнёры: 3 существующих + 17 новых = 20 ──
  const existingPartners = [
    { email: "info@navitravel.az", companyName: "Navitravel", firstName: "Navitravel" },
    { email: "travelpro@mail.com", companyName: "TravelPro", firstName: "TravelPro" },
    { email: "geotrip@mail.com", companyName: "GeoTrip", firstName: "GeoTrip" },
  ];
  const partnerIds: string[] = [];
  for (const p of existingPartners) {
    const u = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: {
        email: p.email,
        passwordHash: hash("partner123"),
        firstName: p.firstName,
        companyName: p.companyName,
        role: "PARTNER",
        createdAt: userCreatedAt(false),
      },
    });
    partnerIds.push(u.id);
  }
  for (let i = 3; i < 20; i++) {
    const email = `partner${String(i + 1).padStart(2, "0")}@travelhub.az`;
    const company = PARTNER_COMPANIES[i];
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: hash("partner123"),
        firstName: company.split(" ")[0],
        companyName: company,
        role: "PARTNER",
        createdAt: userCreatedAt(false),
      },
    });
    partnerIds.push(u.id);
  }

  // ── 200 покупателей: buyer001@mail.com … buyer200@mail.com ──
  // Большинство — в окне 01.01–31.07.2026, ~8% — за последнюю неделю,
  // чтобы метрики «новые пользователи сегодня/неделю» в дашборде были ненулевыми.
  for (let i = 1; i <= 200; i++) {
    const email = `buyer${String(i).padStart(3, "0")}@mail.com`;
    const n = randomName();
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: hash("buyer123"),
        firstName: n.firstName,
        lastName: n.lastName,
        role: "BUYER",        createdAt: chance(0.08)
          ? dateBetween(new Date(NOW.getTime() - 7 * DAY), NOW)
          : userCreatedAt(true),
    },
  });
  buyerRecords.push({ id: u.id, createdAt: u.createdAt });
  }

  // ── Несколько покупателей с регистрацией «сегодня/вчера» ──
  // Чтобы в дашбордах метрики «новые пользователи сегодня» были ненулевыми.
  const TODAY_EMAILS = ["fresh1@mail.com", "fresh2@mail.com", "fresh3@mail.com", "fresh4@mail.com"];
  for (const email of TODAY_EMAILS) {
    const n = randomName();
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: hash("buyer123"),
        firstName: n.firstName,
        lastName: n.lastName,
        role: "BUYER",
        createdAt: chance(0.5)
          ? dateBetween(new Date(NOW.getTime() - 6 * 3600000), NOW)
          : dateBetween(new Date(NOW.getTime() - DAY), new Date(NOW.getTime() - 6 * 3600000)),
      },
    });
    buyerRecords.push({ id: u.id, createdAt: u.createdAt });
  }

  // ── 500 услуг, неравномерно распределённых между партнёрами ──
  // Идемпотентность: сид — источник данных услуг, поэтому перед созданием удаляем все.
  // ── Канонические коды пользователей (Baseline §0.8): USR-* для персонала,
  // CUS-* для клиентов/партнёров. Бэкфилл для записей без кода (fresh seed).
  const codeLessUsers = await prisma.user.findMany({
    where: { code: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true },
  });
  if (codeLessUsers.length) {
    const userCodes = await prisma.user.findMany({ select: { code: true } });
    const allCodes = userCodes.map((u) => u.code).filter((c): c is string => !!c);
    for (const u of codeLessUsers) {
      const code = userBusinessCode(u.role, allCodes);
      await prisma.user.update({ where: { id: u.id }, data: { code } });
      allCodes.push(code);
    }
  }

  // Идемпотентность: удаляем зависимые записи с onDelete: Restrict (OrderItem,
  // QuoteItem) заранее — каскадные (Booking, ServiceHistory и др.) уйдут сами.
  await prisma.orderItem.deleteMany({});
  await prisma.quoteItem.deleteMany({});

  await prisma.service.deleteMany({});

  // Случайные веса (1..6) → одни партнёры получают много услуг, другие мало.
  // Ровно 500: floor + распределение остатка по наибольшим дробным частям.
  const weights = partnerIds.map(() => randInt(1, 6));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (500 * w) / weightSum);
  const countsByPartner = raw.map((r) => Math.floor(r));
  let allocated = countsByPartner.reduce((a, b) => a + b, 0);
  const remainders = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < 500 - allocated && k < remainders.length; k++) {
    countsByPartner[remainders[k].i]++;
  }
  allocated = countsByPartner.reduce((a, b) => a + b, 0);
  // Крайний случай округления: добиваем первых партнёров до ровно 500.
  for (let p = 0; allocated < 500; p = (p + 1) % partnerIds.length) {
    countsByPartner[p]++;
    allocated++;
  }

  let serviceSeq = 0;
  const serviceRecords: { id: string; type: ServiceTypeName; price: number; discountPrice: number | null; currency: string }[] = [];

  // ── Каталог (Гл. 4): жизненный цикл услуги (4.12), менеджер, квоты, SEO ──
  // Статусы по спецификации: Черновик → Проверка/Согласование → Публикация →
  // Активная продажа → Приостановка → Архив. Активные (PUBLISHED) услуги видны
  // публичному каталогу (isActive = status === PUBLISHED || SUSPENDED).
  const CATALOG_MANAGERS = ["Анна Смирнова", "Дмитрий Петров", "Ольга Козлова", "Игорь Волков", "Мария Соколова"];
  const catalogManagerFor = (id: string): string => {
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return CATALOG_MANAGERS[h % CATALOG_MANAGERS.length];
  };
  // Ответственные сотрудники каталога (Гл. 4.5): реальные пользователи админки.
  const catalogManagers = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SALES_MANAGER", "MODERATOR", "DIRECTOR", "OPERATOR"] }, isActive: true },
    select: { id: true, firstName: true },
  });
  const managerFor = (id: string): string | null => {
    if (!catalogManagers.length) return null;
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return catalogManagers[h % catalogManagers.length].id;
  };
  const CATEGORY_TPL: Record<ServiceTypeName, string[]> = {
    TOUR: ["Пляжный", "Экскурсионный", "Семейный", "Премиум", "Горящий"],
    HOTEL: ["Курортный", "Бутик", "SPA", "Семейный", "5★"],
    SANATORIUM: ["Лечебный", "Оздоровительный", "Профилакторий"],
    EXCURSION: ["Обзорная", "Пешая", "Гастро", "Ночная", "Природная"],
    GUIDE: ["Личный гид", "Гид-переводчик", "Экскурсовод"],
    TRANSFER: ["Аэропорт", "Индивидуальный", "Групповой"],
    FLIGHT: ["Эконом", "Бизнес", "Прямой рейс"],
    TRAIN: ["Скоростной", "Ночной", "Стандарт"],
    PHOTOGRAPHER: ["Свадебная", "Портретная", "Репортажная", "Фототур"],
  };
  const CHANNELS_POOL = ["Сайт", "Мобильное приложение", "B2B-портал", "Внутренний каталог", "API для партнёров"];
  const pickChannels = (): string[] => {
    const n = randInt(1, 3);
    const out: string[] = [];
    while (out.length < n) {
      const ch = pick(CHANNELS_POOL);
      if (!out.includes(ch)) out.push(ch);
    }
    return out;
  };
  const STATUS_PLAN: ServiceStatusName[] = [];
  const catalogStatusPlan: Array<[ServiceStatusName, number]> = [
    ["PUBLISHED", 320],
    ["DRAFT", 60],
    ["REVIEW", 40],
    ["READY", 35],
    ["SUSPENDED", 25],
    ["ARCHIVED", 20],
  ];
  for (const [s, n] of catalogStatusPlan) {
    for (let i = 0; i < n; i++) STATUS_PLAN.push(s);
  }
  for (let i = STATUS_PLAN.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [STATUS_PLAN[i], STATUS_PLAN[j]] = [STATUS_PLAN[j], STATUS_PLAN[i]];
  }

  const createService = async (providerId: string) => {
    serviceSeq++;
    const type = weightedType();
    const geo = pickCountryCode();
    const titleTpl = pick(TITLE_TPL[type]).replace("{city}", geo.city).replace("{country}", geo.country);
    const [minP, maxP] = PRICE_RANGE[type];
    const price = Math.round(randInt(minP, maxP) / 5) * 5;
    const hasDiscount = chance(0.3);
    const isHot = chance(0.1);
    const rating = Math.round((3.5 + rand() * 1.5) * 10) / 10;
    const reviewCount = chance(0.4) ? randInt(1, 180) : 0;
    const langCount = randInt(1, 3);
    const languagesArr: string[] = [];
    while (languagesArr.length < langCount) {
      const l = pick(LANGUAGES);
      if (!languagesArr.includes(l)) languagesArr.push(l);
    }
    const images = JSON.stringify([
      "/8c1f6b8a-ab32-4328-bd69-dc88fa854597.png",
      "/placeholder.svg",
    ]);
    const status = STATUS_PLAN[serviceSeq % STATUS_PLAN.length];
    // Публичный каталог показывает PUBLISHED и SUSPENDED (временно недоступные)
    const active = status === "PUBLISHED" || status === "SUSPENDED";
    const createdAt = serviceCreatedAt();
    const manager = catalogManagerFor("svc-" + serviceSeq);
    const managerId = managerFor("svc-" + serviceSeq);
    // Квоты (Гл. 4.7): у услуг с вместимостью — квота, часть забронирована/в резерве
    const hasQuota = ["TOUR", "HOTEL", "SANATORIUM", "EXCURSION", "TRANSFER"].includes(type) && chance(0.75);
    const quotaTotal = hasQuota ? randInt(10, 400) : 0;
    const quotaBooked = hasQuota ? randInt(0, Math.max(0, Math.floor(quotaTotal * 0.6))) : 0;
    const quotaReserved = hasQuota ? randInt(0, Math.max(0, Math.floor((quotaTotal - quotaBooked) * 0.4))) : 0;
    // Период продажи и оказания (Гл. 4.7): активные услуги — в текущем окне
    const salesStart = new Date(createdAt.getTime() - randInt(5, 90) * DAY);
    const salesEnd = new Date(Math.max(createdAt.getTime(), NOW.getTime()) + randInt(90, 400) * DAY);
    const serviceStart = new Date(NOW.getTime() - randInt(0, 30) * DAY);
    const serviceEnd = new Date(NOW.getTime() + randInt(120, 500) * DAY);
    const tags = JSON.stringify([
      ...(chance(0.5) ? [pick(["Семейный", "VIP", "Корпоративный", "Авторский", "Пакетный"])] : []),
      ...(chance(0.3) ? ["Сезонный"] : []),
    ]);
    const channels = JSON.stringify(pickChannels());

    const svc = await prisma.service.create({
      data: {
        code: `PRD-${String(serviceSeq).padStart(8, "0")}`,
        type,
        title: titleTpl,
        slug: `${type.toLowerCase()}-${String(serviceSeq).padStart(4, "0")}`,
        shortDesc: pick([
          "Уникальное предложение от проверенного партнёра.",
          "Лучшее соотношение цены и качества.",
          "Идеальный вариант для вашего отдыха.",
          "Популярное направление сезона.",
          "Комфорт и сервис на высшем уровне.",
          "Рекомендуем для семейного и парного отдыха.",
        ]),
        description: `Проведённое в тестовом датасете описание услуги «${titleTpl}». Направление: ${geo.country}, город ${geo.city}. Услуга предоставляется партнёром платформы TravelHub.`,
        price,
        currency: "USD",
        discountPrice: hasDiscount ? Math.round(price * (1 - randInt(5, 25) / 100)) : null,
        city: geo.city,
        country: geo.country,
        countryCode: geo.code,
        rating,
        reviewCount,
        images,
        duration: pick(DURATION_TPL[type]),
        maxGuests: ["TOUR", "EXCURSION", "GUIDE"].includes(type) ? randInt(1, 15) : null,
        languages: languagesArr.join(","),
        isActive: active,
        isFeatured: chance(0.15),
        isHot,
        hotDiscount: isHot ? randInt(10, 40) : 0,
        providerId,
        createdAt,
        // ── Каталог (Гл. 4) ──
        status,
        version: 1,
        managerId,
        publishedAt: status === "PUBLISHED" ? new Date(createdAt.getTime() + randInt(1, 30) * DAY) : null,
        category: pick(CATEGORY_TPL[type]),
        tags,
        salesStart,
        salesEnd,
        serviceStart,
        serviceEnd,
        quotaTotal,
        quotaBooked,
        quotaReserved,
        seoTitle: titleTpl,
        seoDescription: shortDescFor(geo),
        seoKeywords: [geo.country, geo.city, type.toLowerCase()].join(", "),
        channels,
      },
    });
    if (active) {
      serviceRecords.push({ id: svc.id, type, price: svc.price, discountPrice: svc.discountPrice, currency: svc.currency || "USD" });
    }
    // История версий (Гл. 4.12): создание + переходы по жизненному циклу
    const historyRows: {
      version: number;
      action: string;
      from: string | null;
      to: string | null;
      actorName: string;
      comment: string;
      createdAt: Date;
    }[] = [
      {
        version: 1,
        action: "created",
        from: null,
        to: "DRAFT",
        actorName: manager,
        comment: "Карточка услуги создана",
        createdAt,
      },
    ];
    if (status === "REVIEW" || status === "READY" || status === "PUBLISHED" || status === "SUSPENDED" || status === "ARCHIVED") {
      const t1 = new Date(createdAt.getTime() + randInt(1, 48) * 3600000);
      historyRows.push({
        version: 2,
        action: "update",
        from: "DRAFT",
        to: "REVIEW",
        actorName: manager,
        comment: "Заполнены основные сведения, отправлено на согласование",
        createdAt: t1,
      });
    }
    if (status === "READY" || status === "PUBLISHED" || status === "SUSPENDED" || status === "ARCHIVED") {
      const t2 = new Date(createdAt.getTime() + randInt(2, 96) * 3600000);
      historyRows.push({
        version: 3,
        action: "update",
        from: "REVIEW",
        to: "READY",
        actorName: manager,
        comment: "Согласовано, готова к публикации",
        createdAt: t2,
      });
    }
    if (status === "PUBLISHED" || status === "SUSPENDED" || status === "ARCHIVED") {
      const t3 = new Date(createdAt.getTime() + randInt(3, 120) * 3600000);
      historyRows.push({
        version: 4,
        action: "publish",
        from: "READY",
        to: "PUBLISHED",
        actorName: manager,
        comment: "Опубликована, доступна для продажи",
        createdAt: t3,
      });
    }
    if (status === "SUSPENDED") {
      const t4 = new Date(Math.min(createdAt.getTime() + randInt(10, 200) * 3600000, NOW.getTime() - 3600000));
      historyRows.push({
        version: 5,
        action: "suspend",
        from: "PUBLISHED",
        to: "SUSPENDED",
        actorName: manager,
        comment: "Продажи приостановлены",
        createdAt: t4,
      });
    }
    if (status === "ARCHIVED") {
      const t5 = new Date(Math.min(createdAt.getTime() + randInt(20, 300) * 3600000, NOW.getTime() - 3600000));
      historyRows.push({
        version: 6,
        action: "archive",
        from: "PUBLISHED",
        to: "ARCHIVED",
        actorName: manager,
        comment: "Услуга архивирована",
        createdAt: t5,
      });
    }
    for (const h of historyRows) {
      await prisma.serviceHistory.create({
        data: { serviceId: svc.id, ...h, actorId: null, fields: null },
      });
    }
    // Номер текущей редакции (Гл. 4.12) = последняя версия в журнале
    if (historyRows.length > 1) {
      await prisma.service.update({
        where: { id: svc.id },
        data: { version: historyRows[historyRows.length - 1].version },
      });
    }
  };

  for (let p = 0; p < partnerIds.length; p++) {
    for (let s = 0; s < countsByPartner[p]; s++) {
      await createService(partnerIds[p]);
    }
  }

  // ── Связи между услугами (Гл. 4.9): 40% услуг получают 1–3 связанные ──
  const allSvcRows = await prisma.service.findMany({ select: { id: true } });
  const allSvcIds = allSvcRows.map((s) => s.id);
  for (const sid of allSvcIds) {
    if (!chance(0.4)) continue;
    const n = randInt(1, 3);
    const pool = allSvcIds.filter((x) => x !== sid);
    const links: string[] = [];
    while (links.length < n && pool.length) {
      const l = pick(pool);
      if (!links.includes(l)) links.push(l);
    }
    await prisma.service.update({ where: { id: sid }, data: { relatedIds: JSON.stringify(links) } });
  }

  // ── Активность покупателей: просмотры и бронирования ──
  // Идемпотентность: чистим таблицы активности перед созданием.
  await prisma.serviceView.deleteMany({});
  await prisma.booking.deleteMany({});

  // Просмотры: у каждого покупателя 5–40 просмотров услуг в разное время с момента регистрации.
  const viewRows: { userId: string; serviceId: string; viewedAt: Date }[] = [];
  for (const buyer of buyerRecords) {
    const views = randInt(5, 40);
    for (let v = 0; v < views; v++) {
      viewRows.push({
        userId: buyer.id,
        serviceId: pick(serviceRecords).id,
        viewedAt: dateBetween(buyer.createdAt, NOW),
      });
    }
  }
  for (let i = 0; i < viewRows.length; i += 1000) {
    await prisma.serviceView.createMany({ data: viewRows.slice(i, i + 1000) });
  }

  // Бронирования: 70 покупателей совершали бронирования, всего 130 броней:
  // 5 — возврат, 10 — ожидание оплаты, 115 — оплачены (48 завершено, 67 ждут даты после 01.08.2026).
  const bookingBuyers = [...buyerRecords];
  for (let i = bookingBuyers.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [bookingBuyers[i], bookingBuyers[j]] = [bookingBuyers[j], bookingBuyers[i]];
  }
  const activeBookers = bookingBuyers.slice(0, 70);

  // Канонический код бронирования BKG-* (Baseline §0.8) — сквозной счётчик.
  let bkgSeq = 0;

  // Канонические статусы бронирования (Baseline §0.5): NEW → … → CONFIRMED →
  // IN_SERVICE → COMPLETED; ветви CANCELLED. Оплата — на уровне Order (§0.6),
  // поэтому «оплаченные» брони сидим как CONFIRMED.
  type BookingStatusValue = "NEW" | "CONFIRMED" | "IN_SERVICE" | "COMPLETED" | "CANCELLED";
  const statuses: BookingStatusValue[] = [];
  const statusPlan: Array<[BookingStatusValue, number]> = [
    ["CANCELLED", 5],
    ["NEW", 10],
    ["CONFIRMED", 67],
    ["IN_SERVICE", 5],
    ["COMPLETED", 43],
  ];
  for (const [s, n] of statusPlan) {
    for (let i = 0; i < n; i++) statuses.push(s);
  }
  for (let i = statuses.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [statuses[i], statuses[j]] = [statuses[j], statuses[i]];
  }

  // Каждому из 70 покупателей — минимум одно бронирование, остаток раздаём случайно.
  const bookings: Array<{
    buyerId: string;
    regDate: Date;
    status: BookingStatusValue;
  }> = activeBookers.map((b) => ({ buyerId: b.id, regDate: b.createdAt, status: statuses.pop()! }));
  while (statuses.length) {
    const b = pick(activeBookers);
    bookings.push({ buyerId: b.id, regDate: b.createdAt, status: statuses.pop()! });
  }

  const AFTER_AUG = new Date("2026-08-02");
  for (const bk of bookings) {
    const svc = pick(serviceRecords);
    let serviceDate: Date;
    if (bk.status === "CONFIRMED") {
      // «Ждут даты» — дата услуги после 01.08.2026.
      serviceDate = dateBetween(AFTER_AUG, new Date("2026-12-31"));
    } else if (bk.status === "NEW" || bk.status === "IN_SERVICE") {
      // Ожидание подтверждения / в обслуживании — будущая дата услуги (до 3 месяцев).
      serviceDate = dateBetween(NOW, new Date(NOW.getTime() + 90 * DAY));
    } else {
      // Возврат / завершено — услуга уже оказана: между регистрацией и сегодня.
      const end = new Date(NOW.getTime() - DAY);
      const reg = new Date(bk.regDate.getTime() + DAY);
      const start = reg.getTime() > end.getTime() ? new Date(end.getTime() - DAY) : reg;
      serviceDate = dateBetween(start, end);
    }
    // createdAt — до даты услуги (для обычных покупателей — между регистрацией и датой).
    // Для совсем свежих покупателей (крайний случай) гарантируем start < end, чтобы
    // dateBetween не получил инвертированный интервал.
    const maxCreated = new Date(Math.min(serviceDate.getTime() - DAY, NOW.getTime()));
    const createdAt = dateBetween(
      new Date(Math.min(bk.regDate.getTime(), maxCreated.getTime() - DAY)),
      maxCreated
    );
    await prisma.booking.create({
      data: {
        code: `BKG-${String(++bkgSeq).padStart(8, "0")}`,
        userId: bk.buyerId,
        serviceId: svc.id,
        status: bk.status,
        amount: svc.discountPrice ?? svc.price,
        serviceDate,
        createdAt,
      },
    });
  }

  // ── Ревью покупателей на услуги (разные периоды) ──
  // Таблица Review пуста (услуги каскадно удаляют свои отзывы при deleteMany выше) —
  // засеем её, чтобы рейтинги и аналитика были реальными.
  const reviewBuyers = buyerRecords.filter(() => chance(0.9));
  const REVIEW_TEXTS = [
    "Отличная организация, всё понравилось!", "Хорошее соотношение цены и качества.",
    "Сервис на высшем уровне, рекомендую.", "Всё прошло гладко, без нареканий.",
    "Неплохо, но есть к чему стремиться.", "Понравилось, вернусь ещё раз.",
    "Средне, ожидал большего.", "Быстро и удобно, спасибо!",
    "Отдых удался, спасибо партнёру!", "Рекомендую всем знакомым.",
    "Хороший сервис, но были мелкие недочёты.", "Прекрасный опыт, всё чётко.",
  ];
  const reviewRows: { userId: string; serviceId: string; rating: number; text: string; createdAt: Date }[] = [];
  // ~60% активных услуг получают 1–6 отзывов
  for (const svc of serviceRecords) {
    if (!chance(0.6)) continue;
    const n = randInt(1, 6);
    for (let r = 0; r < n; r++) {
      const buyer = pick(reviewBuyers);
      reviewRows.push({
        userId: buyer.id,
        serviceId: svc.id,
        rating: randInt(3, 5),
        text: pick(REVIEW_TEXTS),
        createdAt: dateBetween(
          new Date(Math.max(buyer.createdAt.getTime(), new Date("2026-01-01").getTime())),
          NOW
        ),
      });
    }
  }
  for (let i = 0; i < reviewRows.length; i += 1000) {
    await prisma.review.createMany({ data: reviewRows.slice(i, i + 1000) });
  }
  // Синхронизируем rating/reviewCount услуг с реальными отзывами
  const reviewAgg = await prisma.review.groupBy({
    by: ["serviceId"],
    _avg: { rating: true },
    _count: { id: true },
  });
  for (const row of reviewAgg) {
    await prisma.service.update({
      where: { id: row.serviceId },
      data: { rating: Math.round((row._avg.rating ?? 4) * 10) / 10, reviewCount: row._count.id },
    });
  }

  // ── Дополнительные брони за разные периоды 2026 (для графиков) ──
  // Расширяем статистику: помимо заданных ~130 броней добавляем ~250 броней,
  // равномерно распределённых по 2026 году, включая сегодняшние.
  const EXTRA_BOOKINGS = 250;
  const extraBookings: {
    userId: string;
    serviceId: string;
    amount: number;
    status: BookingStatusValue;
    serviceDate: Date;
    createdAt: Date;
  }[] = [];
  for (let i = 0; i < EXTRA_BOOKINGS; i++) {
    const buyer = pick(buyerRecords);
    const svc = pick(serviceRecords);
    const r = rand();
    const status: BookingStatusValue =
      r < 0.35 ? "CONFIRMED" : r < 0.62 ? "COMPLETED" : r < 0.78 ? "NEW" : r < 0.92 ? "CONFIRMED" : "CANCELLED";
    // Дата создания: сегодня (10%), за неделю (20%), за месяц (30%), остальное в течение 2026
    const cr = rand();
    const createdAt: Date =
      cr < 0.1
        ? dateBetween(new Date(NOW.getTime() - 12 * 3600000), NOW)
        : cr < 0.3
        ? dateBetween(new Date(NOW.getTime() - 7 * DAY), NOW)
        : cr < 0.6
        ? dateBetween(new Date(NOW.getTime() - 30 * DAY), NOW)
        : dateBetween(new Date("2026-01-01"), new Date("2026-07-01"));
    // Дата услуги: для завершённых/возвратов — в прошлом после создания,
    // для PAID/PENDING/CONFIRMED — в будущем (после 01.08.2026)
    const isPast = status === "COMPLETED" || status === "CANCELLED";
    const serviceDate: Date = isPast
      ? dateBetween(
          new Date(Math.min(createdAt.getTime() + DAY, NOW.getTime() - DAY)),
          new Date(NOW.getTime() - 3600000)
        )
      : dateBetween(new Date("2026-08-02"), new Date("2026-12-31"));
    extraBookings.push({
      userId: buyer.id,
      serviceId: svc.id,
      amount: svc.discountPrice ?? svc.price,
      status,
      serviceDate,
      createdAt,
    });
  }
  for (const bk of extraBookings) {
    await prisma.booking.create({
      data: {
        code: `BKG-${String(++bkgSeq).padStart(8, "0")}`,
        userId: bk.userId,
        serviceId: bk.serviceId,
        status: bk.status,
        amount: bk.amount,
        serviceDate: bk.serviceDate,
        createdAt: bk.createdAt,
      },
    });
  }

  // ── Бронирования: целевые сценарии для виджетов (Гл. 5) ──
  // Бронирования с гарантированными окнами дат, чтобы панель бронирований
  // показывала: ближайшие поездки, просроченные подтверждения, проблемные брони,
  // ожидающие оплаты и свежие брони за сегодня/неделю.
  const bcTargets: Array<{
    count: number;
    status: BookingStatusValue;
    createdAgoHours: [number, number];
    serviceDateInDays: [number, number];
  }> = [
    // Ближайшие поездки (CONFIRMED, дата через 1–25 дней)
    { count: 8, status: "CONFIRMED", createdAgoHours: [3 * 24, 20 * 24], serviceDateInDays: [1, 25] },
    // Ожидают подтверждения, дата скоро → «Проблемные бронирования» (0–3 дня)
    { count: 6, status: "NEW", createdAgoHours: [2 * 24, 10 * 24], serviceDateInDays: [0, 3] },
    // Просроченные подтверждения (CONFIRMED давно созданы)
    { count: 5, status: "CONFIRMED", createdAgoHours: [50 * 24, 90 * 24], serviceDateInDays: [7, 60] },
    // Свежие ожидающие подтверждения (NEW, созданы 1–3 дня назад)
    { count: 7, status: "NEW", createdAgoHours: [12, 3 * 24], serviceDateInDays: [10, 60] },
    // Подтверждённые сегодня/на этой неделе
    { count: 6, status: "CONFIRMED", createdAgoHours: [2, 5 * 24], serviceDateInDays: [5, 45] },
    // Свежие подтверждённые сегодня
    { count: 5, status: "CONFIRMED", createdAgoHours: [1, 8], serviceDateInDays: [15, 70] },
  ];
  for (const t of bcTargets) {
    for (let i = 0; i < t.count; i++) {
      const buyer = pick(buyerRecords);
      const svc = pick(serviceRecords);
      const createdHours = randInt(t.createdAgoHours[0], t.createdAgoHours[1]);
      const createdAt = new Date(NOW.getTime() - createdHours * 3600000);
      const serviceDate = new Date(NOW.getTime() + randInt(t.serviceDateInDays[0], t.serviceDateInDays[1]) * DAY);
      await prisma.booking.create({
        data: {
          code: `BKG-${String(++bkgSeq).padStart(8, "0")}`,
          userId: buyer.id,
          serviceId: svc.id,
          status: t.status,
          amount: svc.discountPrice ?? svc.price,
          serviceDate,
          createdAt,
        },
      });
    }
  }

  // ── Журнал изменений бронирований (вкладка «История», Гл. 5.9) ──
  // Для каждой брони генерируем хронологию, соответствующую её финальному статусу:
  //   created → [confirm] → [pay] → [complete] | [cancel]
  // Удаление избыточно (booking.deleteMany каскадно удаляет историю), но безопасно.
  await prisma.bookingHistory.deleteMany({});
  const MANAGER_POOL = ["Анна Смирнова", "Дмитрий Петров", "Ольга Козлова", "Игорь Волков", "Мария Соколова"];
  const allBookings = await prisma.booking.findMany({
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });
  const historyRows: {
    bookingId: string;
    action: string;
    from: string | null;
    to: string | null;
    actorName: string;
    comment: string;
    createdAt: Date;
  }[] = [];
  for (const b of allBookings) {
    const clientName = `${b.user.firstName} ${b.user.lastName ?? ""}`.trim() || "Клиент";
    // Интервал между созданием и обновлением (кап 10 дней — переходы происходят вскоре после создания)
    const span = Math.min(Math.max(b.updatedAt.getTime() - b.createdAt.getTime(), 0), 10 * DAY);
    const at = (f: number) => new Date(b.createdAt.getTime() + Math.floor(span * f));
    historyRows.push({
      bookingId: b.id,
      action: "created",
      from: null,
      to: "NEW",
      actorName: clientName,
      comment: "Бронирование создано",
      createdAt: b.createdAt,
    });
    if (b.status === "CONFIRMED" || b.status === "IN_SERVICE" || b.status === "COMPLETED") {
      historyRows.push({
        bookingId: b.id,
        action: "confirm",
        from: "NEW",
        to: "CONFIRMED",
        actorName: pick(MANAGER_POOL),
        comment: "Подтверждено поставщиком",
        createdAt: at(0.35),
      });
    }
    if (b.status === "IN_SERVICE" || b.status === "COMPLETED") {
      historyRows.push({
        bookingId: b.id,
        action: "in_service",
        from: "CONFIRMED",
        to: "IN_SERVICE",
        actorName: pick(MANAGER_POOL),
        comment: "Услуга оказывается",
        createdAt: at(0.6),
      });
    }
    if (b.status === "COMPLETED") {
      historyRows.push({
        bookingId: b.id,
        action: "complete",
        from: "IN_SERVICE",
        to: "COMPLETED",
        actorName: pick(MANAGER_POOL),
        comment: "Поездка завершена",
        createdAt: at(0.9),
      });
    }
    if (b.status === "CANCELLED") {
      historyRows.push({
        bookingId: b.id,
        action: "cancel",
        from: "CONFIRMED",
        to: "CANCELLED",
        actorName: pick(MANAGER_POOL),
        comment: "Отменено",
        createdAt: at(0.5),
      });
    }
  }
  for (let i = 0; i < historyRows.length; i += 1000) {
    await prisma.bookingHistory.createMany({ data: historyRows.slice(i, i + 1000) });
  }

  // ── Переписка менеджера и клиента (вкладка «Переписка», Гл. 5.9) ──
  // Генерируем 0–4 сообщения на бронь в зависимости от статуса: у завершённых
  // диалог длиннее, у свежих — 1–2 сообщения. Удаление избыточно (каскад), но безопасно.
  await prisma.bookingMessage.deleteMany({});
  const CLIENT_MESSAGES = [
    "Здравствуйте! Подтвердите, пожалуйста, бронирование",
    "Спасибо, всё отлично!",
    "Когда будут готовы документы?",
    "Можно ли перенести дату поездки?",
    "Уже оплатил — чек приложу к письму",
    "Гид будет говорить на русском?",
    "Спасибо за оперативность!",
    "Подскажите, что входит в стоимость?",
    "Пришлите, пожалуйста, счёт на оплату",
    "Отлично, ждём ваучер",
  ];
  const MANAGER_MESSAGES = [
    "Здравствуйте! Бронирование принято, ожидаем подтверждение поставщика",
    "Ваше бронирование подтверждено ✅",
    "Напоминаем об оплате — счёт действителен 48 часов",
    "Документы отправлены на вашу почту",
    "Дату можно изменить — напишите желаемую",
    "Спасибо за оплату! Ваучер уже готов",
    "Поездка подтверждена, приятного отдыха!",
    "В стоимость входят трансфер и завтраки",
    "Счёт сформирован и выслан на email",
    "Благодарим за обращение! Готовы помочь",
  ];
  const messageBookings = await prisma.booking.findMany({
    select: { id: true, status: true, createdAt: true, updatedAt: true },
  });
  const messageRows: {
    bookingId: string;
    senderName: string;
    senderRole: string;
    text: string;
    isRead: boolean;
    createdAt: Date;
  }[] = [];
  const msgCountFor = (status: string): number => {
    if (status === "COMPLETED" || status === "CANCELLED") return randInt(2, 4);
    if (status === "CONFIRMED" || status === "IN_SERVICE") return randInt(1, 3);
    return randInt(1, 2);
  };
  // Автоматические системные сообщения по статусу (Гл. 5.9): создание →
  // подтверждение → обслуживание → завершение (или отмена). Временные метки
  // совпадают с журналом истории, чтобы хронология чата и журнала согласовывались.
  const SYSTEM_EVENTS: Record<string, { text: string; f: number }[]> = {
    NEW: [{ text: "Бронирование создано и ожидает подтверждения", f: 0 }],
    CONFIRMED: [
      { text: "Бронирование создано и ожидает подтверждения", f: 0 },
      { text: "Бронирование подтверждено ✅", f: 0.35 },
    ],
    IN_SERVICE: [
      { text: "Бронирование создано и ожидает подтверждения", f: 0 },
      { text: "Бронирование подтверждено ✅", f: 0.35 },
      { text: "Услуга оказывается 🧳", f: 0.6 },
    ],
    COMPLETED: [
      { text: "Бронирование создано и ожидает подтверждения", f: 0 },
      { text: "Бронирование подтверждено ✅", f: 0.35 },
      { text: "Услуга оказывается 🧳", f: 0.6 },
      { text: "Поездка завершена 🎉", f: 0.9 },
    ],
    CANCELLED: [
      { text: "Бронирование создано и ожидает подтверждения", f: 0 },
      { text: "Бронирование отменено ↩️", f: 0.5 },
    ],
  };
  for (const b of messageBookings) {
    const n = msgCountFor(b.status);
    const span = Math.max(b.updatedAt.getTime() - b.createdAt.getTime(), 3600000);
    // События: системные (по статусу) + диалог клиент/менеджер, сортируются по времени.
    // Непрочитанными помечаем system/manager сообщения (они «требуют внимания»):
    // «создано» прочитано (админ видел), статусные переходы — непрочитанные, чтобы
    // бейджи на вкладке и в таблице были заполнены (Гл. 5.9).
    // У завершённых/возвращённых броней всё прочитано — работа по ним закрыта.
    const terminal = b.status === "COMPLETED" || b.status === "CANCELLED";
    const events: { at: number; senderName: string; senderRole: string; text: string; isRead: boolean }[] =
      (SYSTEM_EVENTS[b.status] ?? []).map((e) => ({
        at: e.f,
        senderName: "Система",
        senderRole: "system",
        text: e.text,
        isRead: terminal || e.f === 0, // «Бронирование создано» прочитано, переходы — нет
      }));
    let isClient = chance(0.5);
    for (let i = 0; i < n; i++) {
      isClient = !isClient; // диалог чередуется: клиент ↔ менеджер
      events.push({
        at: (i + 1) / (n + 1),
        senderName: isClient ? "Клиент" : pick(MANAGER_POOL),
        senderRole: isClient ? "client" : "manager",
        text: pick(isClient ? CLIENT_MESSAGES : MANAGER_MESSAGES),
        isRead: isClient || terminal, // сообщения клиента и закрытых броней прочитаны
      });
    }
    events.sort((a, b2) => a.at - b2.at);
    for (const e of events) {
      messageRows.push({
        bookingId: b.id,
        senderName: e.senderName,
        senderRole: e.senderRole,
        text: e.text,
        isRead: e.isRead,
        createdAt: new Date(b.createdAt.getTime() + Math.floor(span * e.at)),
      });
    }
  }
  for (let i = 0; i < messageRows.length; i += 1000) {
    await prisma.bookingMessage.createMany({ data: messageRows.slice(i, i + 1000) });
  }

  // ── Заказы (Гл. 6): группируем бронирования в заказы ──
  // Заказ — центральная сущность платформы: объединяет 1–3 брони одного клиента.
  // Статус заказа выводится из статусов входящих броней; далее добавляем целевые
  // заказы с фиксированными статусами жизненного цикла (Гл. 6.10), чтобы виджеты
  // реестр заказов был заполнен.
  await prisma.order.deleteMany({});
  // Канонические статусы заказа (Baseline §0.4): NEW → IN_PROCESSING →
  // WAITING_FOR_DATA → READY_FOR_BOOKING → SENT_TO_BOOKING → PARTIALLY_FULFILLED
  // → FULFILLED → READY_TO_CLOSE → CLOSED; ветви CANCELLED/PROBLEM/SUSPENDED.
  type OrderStatusValue =
    | "NEW" | "IN_PROCESSING" | "WAITING_FOR_DATA" | "READY_FOR_BOOKING" | "SENT_TO_BOOKING"
    | "PARTIALLY_FULFILLED" | "FULFILLED" | "READY_TO_CLOSE" | "CLOSED"
    | "CANCELLED" | "PROBLEM" | "SUSPENDED";
  const orderSources = ["Сайт", "Мобильное приложение", "Партнёр", "Call-центр", "Telegram-бот", "WhatsApp"];
  // Приоритет заказа по статусу (Гл. 3.7): проблемные — срочные, активные
  // этапы — высокий, завершённые/отменённые — низкий.
  const orderPriorityForStatus = (s: string): string => {
    if (s === "PROBLEM") return "URGENT";
    if (["NEW", "IN_PROCESSING", "WAITING_FOR_DATA", "READY_FOR_BOOKING", "SENT_TO_BOOKING", "PARTIALLY_FULFILLED"].includes(s)) return "HIGH";
    if (["CLOSED", "CANCELLED", "SUSPENDED"].includes(s)) return "LOW";
    return "MEDIUM";
  };
  const orderStatusFromBookings = (items: { status: string }[]): OrderStatusValue => {
    const st = new Set(items.map((b) => b.status));
    const has = (s: string) => st.has(s);
    if (has("CANCELLED")) return "CANCELLED";
    if (st.size === 1 && has("COMPLETED")) return "CLOSED";
    if (has("COMPLETED")) return has("NEW") || has("CONFIRMED") ? "PARTIALLY_FULFILLED" : "FULFILLED";
    if (st.size === 1 && has("CONFIRMED")) return "FULFILLED";
    if (has("CONFIRMED")) return "SENT_TO_BOOKING";
    if (st.size === 1 && has("NEW")) return "NEW";
    if (has("NEW")) return "IN_PROCESSING";
    return "NEW";
  };
  const bookingPool = await prisma.booking.findMany({
    select: { id: true, userId: true, amount: true, status: true, serviceDate: true, createdAt: true, updatedAt: true },
  });
  const poolByUser = new Map<string, typeof bookingPool>();
  for (const b of bookingPool) {
    const arr = poolByUser.get(b.userId) ?? [];
    arr.push(b);
    poolByUser.set(b.userId, arr);
  }
  const orderGroups: { userId: string; items: typeof bookingPool }[] = [];
  for (const [userId, items] of poolByUser) {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (let i = 0; i < shuffled.length; ) {
      const n = randInt(1, 3);
      const slice = shuffled.slice(i, i + n);
      if (slice.length) orderGroups.push({ userId, items: slice });
      i += n;
    }
  }
  let ordIdx = 0;
  for (const g of orderGroups) {
    ordIdx++;
    const amount = Math.round(g.items.reduce((a, b) => a + b.amount, 0) * 100) / 100;
    const paidAmount =
      Math.round(
        g.items.filter((b) => b.status === "CONFIRMED" || b.status === "IN_SERVICE" || b.status === "COMPLETED").reduce((a, b) => a + b.amount, 0) * 100
      ) / 100;
    const status = orderStatusFromBookings(g.items);
    const paymentStatus =
      status === "CANCELLED" ? "UNPAID" : paidAmount >= amount ? "PAID" : paidAmount > 0 ? "PARTIALLY_PAID" : "UNPAID";
    const serviceDate = new Date(Math.min(...g.items.map((b) => b.serviceDate.getTime())));
    const createdAt = new Date(Math.min(...g.items.map((b) => b.createdAt.getTime())));
    const updatedAt = new Date(Math.max(...g.items.map((b) => b.updatedAt.getTime())));
    const created = await prisma.order.create({
      data: {
        code: `ORD-${String(ordIdx).padStart(8, "0")}`,
        orderNumber: `TH-${NOW.getFullYear()}-${String(1000 + ordIdx).padStart(6, "0")}`,
        userId: g.userId,
        status,
        paymentStatus,
        priority: orderPriorityForStatus(status) as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
        currency: "USD",
        amount,
        paidAmount,
        serviceDate,
        source: pick(orderSources),
        createdAt,
        updatedAt,
      },
      select: { id: true },
    });
    await prisma.booking.updateMany({
      where: { id: { in: g.items.map((b) => b.id) } },
      data: { orderId: created.id },
    });
  }

  // ── Целевые заказы по статусам жизненного цикла (для реестра заказов) ──
  const bookingStatusFor = (s: OrderStatusValue): BookingStatusValue => {
    if (s === "CLOSED") return "COMPLETED";
    if (s === "CANCELLED" || s === "PROBLEM" || s === "SUSPENDED") return "CANCELLED";
    if (s === "FULFILLED" || s === "READY_TO_CLOSE") return "IN_SERVICE";
    if (s === "PARTIALLY_FULFILLED" || s === "SENT_TO_BOOKING") return "CONFIRMED";
    return "NEW";
  };
  const orderTargets: Array<{
    count: number;
    status: OrderStatusValue;
    payment: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "REFUNDED";
    createdAgoHours: [number, number];
    serviceDateInDays: [number, number];
  }> = [
    { count: 4, status: "NEW", payment: "UNPAID", createdAgoHours: [2, 24], serviceDateInDays: [20, 60] },
    { count: 5, status: "IN_PROCESSING", payment: "UNPAID", createdAgoHours: [6, 48], serviceDateInDays: [10, 45] },
    { count: 5, status: "WAITING_FOR_DATA", payment: "UNPAID", createdAgoHours: [4, 36], serviceDateInDays: [3, 30] },
    { count: 5, status: "READY_FOR_BOOKING", payment: "UNPAID", createdAgoHours: [24, 96], serviceDateInDays: [7, 45] },
    { count: 6, status: "SENT_TO_BOOKING", payment: "PARTIALLY_PAID", createdAgoHours: [12, 60], serviceDateInDays: [5, 35] },
    { count: 4, status: "PARTIALLY_FULFILLED", payment: "PARTIALLY_PAID", createdAgoHours: [48, 120], serviceDateInDays: [10, 50] },
    { count: 5, status: "FULFILLED", payment: "PAID", createdAgoHours: [6, 72], serviceDateInDays: [2, 30] },
    { count: 4, status: "READY_TO_CLOSE", payment: "PAID", createdAgoHours: [96, 200], serviceDateInDays: [1, 14] },
    { count: 5, status: "CLOSED", payment: "PAID", createdAgoHours: [240, 720], serviceDateInDays: [-30, -1] },
    { count: 3, status: "IN_PROCESSING", payment: "UNPAID", createdAgoHours: [48, 144], serviceDateInDays: [10, 40] },
    { count: 4, status: "CLOSED", payment: "REFUNDED", createdAgoHours: [120, 400], serviceDateInDays: [-20, -2] },
    { count: 4, status: "CANCELLED", payment: "UNPAID", createdAgoHours: [60, 300], serviceDateInDays: [5, 30] },
    { count: 4, status: "PROBLEM", payment: "PARTIALLY_PAID", createdAgoHours: [120, 500], serviceDateInDays: [2, 20] },
    { count: 3, status: "SUSPENDED", payment: "UNPAID", createdAgoHours: [700, 1500], serviceDateInDays: [-90, -10] },
  ];
  for (const t of orderTargets) {
    for (let i = 0; i < t.count; i++) {
      const buyer = pick(buyerRecords);
      const svc = pick(serviceRecords);
      const createdHours = randInt(t.createdAgoHours[0], t.createdAgoHours[1]);
      const createdAt = new Date(NOW.getTime() - createdHours * 3600000);
      const serviceDate = new Date(NOW.getTime() + randInt(t.serviceDateInDays[0], t.serviceDateInDays[1]) * DAY);
      const amount = Math.round((svc.discountPrice ?? svc.price) * randInt(1, 2) * 100) / 100;
      const paidAmount =
        t.payment === "PAID" || t.payment === "REFUNDED"
          ? amount
          : t.payment === "PARTIALLY_PAID"
            ? Math.round(amount * 0.5 * 100) / 100
            : 0;
      ordIdx++;
      const created = await prisma.order.create({
        data: {
          code: `ORD-${String(ordIdx).padStart(8, "0")}`,
          orderNumber: `TH-${NOW.getFullYear()}-${String(1000 + ordIdx).padStart(6, "0")}`,
          userId: buyer.id,
          status: t.status,
          paymentStatus: t.payment,
          priority: orderPriorityForStatus(t.status) as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
          currency: svc.currency || "USD",
          amount,
          paidAmount,
          serviceDate,
          source: pick(orderSources),
          createdAt,
          updatedAt: new Date(Math.min(createdAt.getTime() + randInt(2, 72) * 3600000, NOW.getTime())),
        },
        select: { id: true },
      });
      const nBookings = randInt(1, 2);
      for (let k = 0; k < nBookings; k++) {
        const bkSvc = pick(serviceRecords);
        const booking = await prisma.booking.create({
          data: {
            code: `BKG-${String(++bkgSeq).padStart(8, "0")}`,
            userId: buyer.id,
            serviceId: bkSvc.id,
            status: bookingStatusFor(t.status),
            amount: bkSvc.discountPrice ?? bkSvc.price,
            serviceDate,
            orderId: created.id,
            createdAt,
          },
        });
        await prisma.bookingHistory.create({
          data: {
            bookingId: booking.id,
            action: "created",
            from: null,
            to: "NEW",
            actorName: "Система",
            comment: "Бронирование создано в составе заказа",
            createdAt,
          },
        });
        await prisma.bookingMessage.create({
          data: {
            bookingId: booking.id,
            senderId: null,
            senderName: "Система",
            senderRole: "system",
            text: "Бронирование создано в составе заказа",
            createdAt,
          },
        });
      }
    }
  }

  // ── Состав заказа и туристы (Baseline §3/§4): OrderItem + OrderTraveler ──
  // Бэкфилл для всех заказов: позиции — из броней (услуги), туристы — клиент +
  // детерминированный набор паспортных данных (dataCompleteness = complete), чтобы
  // канонические preconditions (confirm/send) не блокировали демо-флоу.
  // Runtime-заказы создают items/travelers на этапе создания (POST /orders).
  {
    const seedOrders = await prisma.order.findMany({
      include: { user: true, bookings: { include: { service: true } } },
    });
    let travSeq = 0;
    for (const o of seedOrders) {
      const itemCount = await prisma.orderItem.count({ where: { orderId: o.id } });
      if (!itemCount) {
        for (const b of o.bookings) {
          const price = b.service.discountPrice ?? b.service.price;
          await prisma.orderItem.create({
            data: {
              orderId: o.id,
              serviceId: b.serviceId,
              title: b.service.title,
              type: b.service.type,
              quantity: 1,
              price,
              currency: b.service.currency || "USD",
              amount: b.amount || price,
              serviceDate: b.serviceDate,
            },
          });
        }
      }
      const travelerCount = await prisma.orderTraveler.count({ where: { orderId: o.id } });
      if (!travelerCount) {
        const n = 1 + (o.id.charCodeAt(o.id.length - 1) % 2); // 1–2 туриста
        const companions = ["Мария", "Алексей", "Елена", "Дмитрий"];
        for (let i = 0; i < n; i++) {
          travSeq++;
          const fn = i === 0 ? o.user.firstName : companions[(o.id.charCodeAt(1) + i) % companions.length];
          const ln = i === 0 ? (o.user.lastName ?? "Петров") : "Смирнова";
          const birthYear = 1975 + ((travSeq * 7) % 25);
          await prisma.orderTraveler.create({
            data: {
              orderId: o.id,
              customerId: o.userId,
              firstName: fn,
              lastName: ln,
              birthDate: new Date(`${birthYear}-${String(1 + (travSeq % 12)).padStart(2, "0")}-15`),
              citizenship: "RU",
              gender: i === 0 ? "M" : "F",
              passportNumber: `P${String(100000000 + travSeq * 17)}`,
              passportExpiry: new Date("2031-01-01"),
              dataCompleteness: "complete",
            },
          });
        }
      }
    }
  }

  // ── Журнал изменений заказов и переписка по заказам (Гл. 6.9) ──
  // Шаги жизненного цикла для каждого статуса: history (action/from/to/comment)
  // и системные сообщения чата совпадают по времени, чтобы хронологии сходились.
  type OrderStep = { action: string; from: string | null; to: string; comment: string; text: string; f: number };
  const ORDER_STEPS: Record<string, OrderStep[]> = {
    NEW: [{ action: "created", from: null, to: "NEW", comment: "Заказ создан", text: "Заказ создан и передан в работу", f: 0 }],
    IN_PROCESSING: [
      { action: "created", from: null, to: "NEW", comment: "Заказ создан", text: "Заказ создан и передан в работу", f: 0 },
      { action: "process", from: "NEW", to: "IN_PROCESSING", comment: "Заказ принят в обработку", text: "Заказ принят в обработку", f: 0.3 },
    ],
    WAITING_FOR_DATA: [
      { action: "created", from: null, to: "NEW", comment: "Заказ создан", text: "Заказ создан и передан в работу", f: 0 },
      { action: "process", from: "NEW", to: "IN_PROCESSING", comment: "Заказ принят в обработку", text: "Заказ принят в обработку", f: 0.3 },
      { action: "wait_data", from: "IN_PROCESSING", to: "WAITING_FOR_DATA", comment: "Запрошены недостающие данные", text: "Ожидание недостающих данных клиента", f: 0.5 },
    ],
    READY_FOR_BOOKING: [
      { action: "created", from: null, to: "NEW", comment: "Заказ создан", text: "Заказ создан и передан в работу", f: 0 },
      { action: "process", from: "NEW", to: "IN_PROCESSING", comment: "Заказ принят в обработку", text: "Заказ принят в обработку", f: 0.3 },
      { action: "ready", from: "IN_PROCESSING", to: "READY_FOR_BOOKING", comment: "Заказ готов к бронированию", text: "Заказ готов к бронированию ✅", f: 0.5 },
    ],
    SENT_TO_BOOKING: [
      { action: "created", from: null, to: "NEW", comment: "Заказ создан", text: "Заказ создан и передан в работу", f: 0 },
      { action: "process", from: "NEW", to: "IN_PROCESSING", comment: "Заказ принят в обработку", text: "Заказ принят в обработку", f: 0.3 },
      { action: "ready", from: "IN_PROCESSING", to: "READY_FOR_BOOKING", comment: "Заказ готов к бронированию", text: "Заказ готов к бронированию ✅", f: 0.5 },
      { action: "send", from: "READY_FOR_BOOKING", to: "SENT_TO_BOOKING", comment: "Передан в Booking Center", text: "Заказ передан в бронирование 🚀", f: 0.6 },
    ],
    PARTIALLY_FULFILLED: [
      { action: "created", from: null, to: "NEW", comment: "Заказ создан", text: "Заказ создан и передан в работу", f: 0 },
      { action: "process", from: "NEW", to: "IN_PROCESSING", comment: "Заказ принят в обработку", text: "Заказ принят в обработку", f: 0.3 },
      { action: "ready", from: "IN_PROCESSING", to: "READY_FOR_BOOKING", comment: "Заказ готов к бронированию", text: "Заказ готов к бронированию ✅", f: 0.5 },
      { action: "send", from: "READY_FOR_BOOKING", to: "SENT_TO_BOOKING", comment: "Передан в Booking Center", text: "Заказ передан в бронирование 🚀", f: 0.6 },
      { action: "partial", from: "SENT_TO_BOOKING", to: "PARTIALLY_FULFILLED", comment: "Часть услуг забронирована", text: "Часть услуг забронирована 📌", f: 0.75 },
    ],
    FULFILLED: [
      { action: "created", from: null, to: "NEW", comment: "Заказ создан", text: "Заказ создан и передан в работу", f: 0 },
      { action: "process", from: "NEW", to: "IN_PROCESSING", comment: "Заказ принят в обработку", text: "Заказ принят в обработку", f: 0.3 },
      { action: "ready", from: "IN_PROCESSING", to: "READY_FOR_BOOKING", comment: "Заказ готов к бронированию", text: "Заказ готов к бронированию ✅", f: 0.5 },
      { action: "send", from: "READY_FOR_BOOKING", to: "SENT_TO_BOOKING", comment: "Передан в Booking Center", text: "Заказ передан в бронирование 🚀", f: 0.6 },
      { action: "fulfill", from: "SENT_TO_BOOKING", to: "FULFILLED", comment: "Услуги забронированы и подтверждены", text: "Все услуги подтверждены ✅", f: 0.85 },
    ],
    READY_TO_CLOSE: [
      { action: "created", from: null, to: "NEW", comment: "Заказ создан", text: "Заказ создан и передан в работу", f: 0 },
      { action: "process", from: "NEW", to: "IN_PROCESSING", comment: "Заказ принят в обработку", text: "Заказ принят в обработку", f: 0.3 },
      { action: "ready", from: "IN_PROCESSING", to: "READY_FOR_BOOKING", comment: "Заказ готов к бронированию", text: "Заказ готов к бронированию ✅", f: 0.5 },
      { action: "send", from: "READY_FOR_BOOKING", to: "SENT_TO_BOOKING", comment: "Передан в Booking Center", text: "Заказ передан в бронирование 🚀", f: 0.6 },
      { action: "fulfill", from: "SENT_TO_BOOKING", to: "FULFILLED", comment: "Услуги забронированы и подтверждены", text: "Все услуги подтверждены ✅", f: 0.85 },
      { action: "ready_close", from: "FULFILLED", to: "READY_TO_CLOSE", comment: "Готов к закрытию", text: "Заказ готов к закрытию 📄", f: 0.9 },
    ],
    CLOSED: [
      { action: "created", from: null, to: "NEW", comment: "Заказ создан", text: "Заказ создан и передан в работу", f: 0 },
      { action: "process", from: "NEW", to: "IN_PROCESSING", comment: "Заказ принят в обработку", text: "Заказ принят в обработку", f: 0.3 },
      { action: "ready", from: "IN_PROCESSING", to: "READY_FOR_BOOKING", comment: "Заказ готов к бронированию", text: "Заказ готов к бронированию ✅", f: 0.5 },
      { action: "send", from: "READY_FOR_BOOKING", to: "SENT_TO_BOOKING", comment: "Передан в Booking Center", text: "Заказ передан в бронирование 🚀", f: 0.6 },
      { action: "fulfill", from: "SENT_TO_BOOKING", to: "FULFILLED", comment: "Услуги забронированы и подтверждены", text: "Все услуги подтверждены ✅", f: 0.85 },
      { action: "ready_close", from: "FULFILLED", to: "READY_TO_CLOSE", comment: "Готов к закрытию", text: "Заказ готов к закрытию 📄", f: 0.9 },
      { action: "close", from: "READY_TO_CLOSE", to: "CLOSED", comment: "Заказ закрыт", text: "Заказ закрыт 🎉", f: 0.95 },
    ],
    CANCELLED: [
      { action: "created", from: null, to: "NEW", comment: "Заказ создан", text: "Заказ создан", f: 0 },
      { action: "cancel", from: "NEW", to: "CANCELLED", comment: "Заказ отменён", text: "Заказ отменён ❌", f: 0.5 },
    ],
    PROBLEM: [
      { action: "created", from: null, to: "NEW", comment: "Заказ создан", text: "Заказ создан", f: 0 },
      { action: "problem", from: "NEW", to: "PROBLEM", comment: "Проблемная ситуация", text: "Проблемная ситуация — требуется действие ⏰", f: 0.5 },
    ],
    SUSPENDED: [
      { action: "created", from: null, to: "NEW", comment: "Заказ создан", text: "Заказ создан", f: 0 },
      { action: "suspend", from: "NEW", to: "SUSPENDED", comment: "Заказ приостановлен", text: "Заказ приостановлен ⏸️", f: 0.5 },
    ],
  };
  await prisma.orderHistory.deleteMany({});
  await prisma.orderMessage.deleteMany({});
  const ORDER_CLIENT_MESSAGES = [
    "Здравствуйте! Уточните, пожалуйста, статус моего заказа",
    "Спасибо, всё отлично!",
    "Когда будут готовы документы?",
    "Можно ли добавить ещё одну услугу в заказ?",
    "Уже оплатил — чек приложу к письму",
    "Хотел бы перенести дату поездки",
    "Спасибо за оперативность!",
    "Пришлите, пожалуйста, счёт на оплату",
    "Отлично, ждём ваучер",
  ];
  const ORDER_MANAGER_MESSAGES = [
    "Здравствуйте! Заказ принят в обработку",
    "Ваш заказ подтверждён ✅",
    "Напоминаем об оплате — счёт действителен 48 часов",
    "Документы отправлены на вашу почту",
    "Дату поездки можно изменить — напишите желаемую",
    "Спасибо за оплату! Ваучер уже готов",
    "Поездка подтверждена, приятного отдыха!",
    "Счёт сформирован и выслан на email",
    "Благодарим за обращение! Готовы помочь",
  ];
  const allOrders = await prisma.order.findMany({
    select: { id: true, status: true, createdAt: true, updatedAt: true, user: { select: { firstName: true, lastName: true } } },
  });
  const orderHistoryRows: {
    orderId: string;
    action: string;
    from: string | null;
    to: string | null;
    actorName: string;
    comment: string;
    createdAt: Date;
  }[] = [];
  const orderMessageRows: {
    orderId: string;
    senderName: string;
    senderRole: string;
    text: string;
    isRead: boolean;
    createdAt: Date;
  }[] = [];
  for (const o of allOrders) {
    const steps = ORDER_STEPS[o.status] ?? [{ action: "created", from: null, to: "NEW", comment: "Заказ создан", text: "Заказ создан", f: 0 }];
    const span = Math.max(o.updatedAt.getTime() - o.createdAt.getTime(), 3600000);
    const at = (f: number) => new Date(o.createdAt.getTime() + Math.floor(span * f));
    const clientName = `${o.user.firstName} ${o.user.lastName ?? ""}`.trim() || "Клиент";
    for (const s of steps) {
      orderHistoryRows.push({
        orderId: o.id,
        action: s.action,
        from: s.from,
        to: s.to,
        actorName: s.action === "created" ? clientName : pick(MANAGER_POOL),
        comment: s.comment,
        createdAt: at(s.f),
      });
    }
    const terminal = ["CLOSED", "CANCELLED", "SUSPENDED"].includes(o.status);
    for (const s of steps) {
      orderMessageRows.push({
        orderId: o.id,
        senderName: "Система",
        senderRole: "system",
        text: s.text,
        isRead: terminal || s.f === 0,
        createdAt: at(s.f),
      });
    }
    if (o.status !== "NEW" && o.status !== "SUSPENDED") {
      const n = terminal ? randInt(1, 2) : randInt(1, 3);
      let isClient = chance(0.5);
      for (let i = 0; i < n; i++) {
        isClient = !isClient;
        orderMessageRows.push({
          orderId: o.id,
          senderName: isClient ? "Клиент" : pick(MANAGER_POOL),
          senderRole: isClient ? "client" : "manager",
          text: pick(isClient ? ORDER_CLIENT_MESSAGES : ORDER_MANAGER_MESSAGES),
          isRead: isClient || terminal,
          createdAt: at((i + 1) / (n + 1)),
        });
      }
    }
  }
  orderHistoryRows.sort((a, b) => (a.createdAt.getTime() - b.createdAt.getTime()));
  orderMessageRows.sort((a, b) => (a.createdAt.getTime() - b.createdAt.getTime()));
  for (let i = 0; i < orderHistoryRows.length; i += 1000) {
    await prisma.orderHistory.createMany({ data: orderHistoryRows.slice(i, i + 1000) });
  }
  for (let i = 0; i < orderMessageRows.length; i += 1000) {
    await prisma.orderMessage.createMany({ data: orderMessageRows.slice(i, i + 1000) });
  }

  // ── Журнал автоматизации (Гл. 3.16) и реестр исключений (Гл. 3.17) ──
  // Персистентные записи привязаны к реальным заказам и видны в разделе
  // «Продажи и исполнение»: журнал автоматических операций, исключения и журнал
  // их обработки. Менеджер определяется той же ротацией, что и в реестре заказов
  // (pickManager в admin-data.ts), чтобы фильтры и подписи совпадали.
  await prisma.exceptionLogHistory.deleteMany({});
  await prisma.automationLog.deleteMany({});
  await prisma.exceptionLog.deleteMany({});

  const seedOrders = await prisma.order.findMany({
    select: { id: true, orderNumber: true, status: true, paymentStatus: true, createdAt: true, updatedAt: true },
  });

  const seedManagers = ["Анна Смирнова", "Дмитрий Петров", "Ольга Козлова", "Игорь Волков", "Мария Соколова"];
  const seedManagerFor = (id: string): string => {
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return seedManagers[h % seedManagers.length];
  };
  const seedDuration = (seed: string, min = 15, max = 950): number => {
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return min + (h % (max - min));
  };
  const seedSource = (seed: string): string => (seed.length % 4 === 0 ? "AI Center" : "Business Event Engine");

  const automationLogRows: {
    orderId: string | null;
    event: string;
    action: string;
    result: string;
    durationMs: number;
    source: string;
    actorName: string | null;
    createdAt: Date;
  }[] = [];
  const exceptionLogRows: {
    orderId: string | null;
    type: string;
    category: string;
    criticality: string;
    orderNumber: string | null;
    manager: string;
    status: string;
    description: string;
    aiSuggestion: string;
    actorName: string;
    createdAt: Date;
    updatedAt: Date;
  }[] = [];
  const exceptionHistoryRows: {
    exceptionLogId: string;
    action: string;
    from: string | null;
    to: string | null;
    comment: string;
    actorName: string;
    createdAt: Date;
  }[] = [];

  const nowMs = Date.now();
  for (const o of seedOrders) {
    const manager = seedManagerFor(o.id);
    const updatedAt = o.updatedAt.getTime();
    const paid = o.paymentStatus === "PAID" || o.paymentStatus === "REFUNDED";
    const awaiting = o.paymentStatus === "UNPAID" || o.paymentStatus === "PARTIALLY_PAID";

    // Создание заказа → авто-назначение исполнителя (3.16)
    automationLogRows.push({
      orderId: o.id,
      event: "Создание заказа",
      action: `Авто-назначение исполнителя → ${manager}`,
      result: "success",
      durationMs: seedDuration(o.id + "a"),
      source: "Business Event Engine",
      actorName: manager,
      createdAt: o.createdAt,
    });

    // Окончание срока SLA → повышение приоритета, задача, уведомление (3.16)
    if (o.status === "PROBLEM") {
      automationLogRows.push({
        orderId: o.id,
        event: "Окончание срока SLA",
        action: `Повышение приоритета, создание задачи, уведомление руководителя (${o.orderNumber})`,
        result: "success",
        durationMs: seedDuration(o.id + "b"),
        source: "Business Event Engine",
        actorName: manager,
        createdAt: new Date(updatedAt),
      });
    }

    // Полная оплата → авто-переход статуса + генерация документов (3.16)
    if (paid) {
      automationLogRows.push({
        orderId: o.id,
        event: "Поступление полной оплаты",
        action: "Авто-переход статуса → Оплачен · генерация ваучера, авиабилетов, страхового полиса",
        result: "success",
        durationMs: seedDuration(o.id + "c"),
        source: seedSource(o.id + "c"),
        actorName: manager,
        createdAt: new Date(updatedAt),
      });
    }

    // Приближение срока оплаты → авто-уведомление клиенту (3.16)
    if (awaiting) {
      automationLogRows.push({
        orderId: o.id,
        event: "Приближение срока оплаты",
        action: "Авто-уведомление клиенту с ссылкой на оплату",
        result: "success",
        durationMs: seedDuration(o.id + "d"),
        source: "Business Event Engine",
        actorName: manager,
        createdAt: new Date(updatedAt),
      });
    }

    // Ошибка генерации документа → задача на повторную обработку (3.16)
    if (o.id.length % 11 === 0) {
      automationLogRows.push({
        orderId: o.id,
        event: "Ошибка генерации документа",
        action: "Перевод в ручной режим · создана задача на повторную обработку",
        result: "error",
        durationMs: seedDuration(o.id + "e"),
        source: "Business Event Engine",
        actorName: manager,
        createdAt: new Date(updatedAt),
      });
    }

    // Исключительные ситуации (Гл. 3.17) — по фактическому статусу заказа
    const hours = Math.max(1, Math.round((nowMs - o.createdAt.getTime()) / 3600000));
    const exCreated = new Date(updatedAt);
    const exUpdated = new Date(Math.min(updatedAt + ((o.id.length * 7) % 48) * 3600000, nowMs));
    if (o.status === "PROBLEM") {
      exceptionLogRows.push({
        orderId: o.id,
        type: "Нарушение SLA",
        category: "Нарушения SLA",
        criticality: "critical",
        orderNumber: o.orderNumber,
        manager,
        status: "new",
        description: `Срок обработки превышен (${hours} ч). Требуется немедленное действие и эскалация руководителю.`,
        aiSuggestion: "Повысить приоритет до «Срочный», уведомить руководителя подразделения и запросить подтверждение у поставщика.",
        actorName: manager,
        createdAt: exCreated,
        updatedAt: exUpdated,
      });
    } else if (o.status === "SENT_TO_BOOKING" && hours > 24) {
      exceptionLogRows.push({
        orderId: o.id,
        type: "Нет ответа поставщика",
        category: "Ошибки взаимодействия с поставщиками",
        criticality: "high",
        orderNumber: o.orderNumber,
        manager,
        status: "working",
        description: `Поставщик не подтвердил бронь за ${hours} ч. Возможен срыв сроков.`,
        aiSuggestion: "Предложить альтернативного поставщика или выполнить повторную попытку бронирования с повышением приоритета.",
        actorName: manager,
        createdAt: exCreated,
        updatedAt: exUpdated,
      });
    } else if (o.paymentStatus === "UNPAID" && o.status !== "NEW" && o.status !== "IN_PROCESSING" && hours > 24) {
      exceptionLogRows.push({
        orderId: o.id,
        type: "Задержка оплаты",
        category: "Ошибки оплаты",
        criticality: "medium",
        orderNumber: o.orderNumber,
        manager,
        status: "new",
        description: `Счёт не оплачен клиентом за ${hours} ч. Срок действия ссылки на оплату может истечь.`,
        aiSuggestion: "Создать новую ссылку на оплату и напомнить клиенту; при отказе банка — предложить альтернативный способ оплаты.",
        actorName: manager,
        createdAt: exCreated,
        updatedAt: exUpdated,
      });
    } else if (o.status === "CANCELLED" || o.paymentStatus === "REFUNDED") {
      exceptionLogRows.push({
        orderId: o.id,
        type: "Отмена / возврат",
        category: "Ошибки бронирования",
        criticality: "low",
        orderNumber: o.orderNumber,
        manager,
        status: "closed",
        description: `Заказ ${o.paymentStatus === "REFUNDED" ? "возвращён" : "отменён"}. Возврат средств ${o.paymentStatus === "REFUNDED" ? "оформлен" : "не требуется"}.`,
        aiSuggestion: "Проанализировать причину отмены и предложить клиенту альтернативное предложение для удержания.",
        actorName: manager,
        createdAt: exCreated,
        updatedAt: exUpdated,
      });
    }
  }

  // Системные исключения и события (детерминированные, Гл. 3.16/3.17)
  const sysManager = seedManagerFor("sys-conf");
  // Критическая эскалация со свежей датой: OVERDUE-заказы сидятся за 5–20 дней,
  // поэтому их исключения не попадают в текущий календарный месяц — добавляем
  // системную критическую эскалацию, чтобы панель исключений периода «месяц»
  // показывала критический уровень (Гл. 3.17).
  exceptionLogRows.push(
    {
      orderId: null,
      type: "Срыв сроков исполнения",
      category: "Нарушения SLA",
      criticality: "critical",
      orderNumber: "SYS-SLA",
      manager: sysManager,
      status: "working",
      description: "Совокупная эскалация: по 2 заказам превышен норматив подтверждения поставщиков. Требуется вмешательство руководителя.",
      aiSuggestion: "Распределить заявки между менеджерами и запросить у поставщиков подтверждение по приоритетным направлениям.",
      actorName: sysManager,
      createdAt: new Date(nowMs - 5 * 3600000),
      updatedAt: new Date(nowMs - 2 * 3600000),
    },
    {
      orderId: null,
      type: "Интеграция недоступна",
      category: "Ошибки интеграции",
      criticality: "high",
      orderNumber: "SYS-INT",
      manager: "Системный администратор",
      status: "working",
      description: "API платёжного шлюза недоступен — повторные попытки автоматически поставлены в очередь.",
      aiSuggestion: "Переключиться на резервный платёжный провайдер или продолжить попытки с экспоненциальной задержкой.",
      actorName: "Системный администратор",
      createdAt: new Date(nowMs - 2 * 3600000),
      updatedAt: new Date(nowMs - 2 * 3600000),
    },
    {
      orderId: null,
      type: "Конфликт изменений",
      category: "Конфликт данных",
      criticality: "medium",
      orderNumber: "SYS-CONF",
      manager: sysManager,
      status: "resolved",
      description: "Два сотрудника одновременно редактировали заказ. Изменения объединены без потери данных.",
      aiSuggestion: "Включить блокировку редактирования заказа вторым пользователем при активной сессии.",
      actorName: sysManager,
      createdAt: new Date(nowMs - 9 * 3600000),
      updatedAt: new Date(nowMs - 3 * 3600000),
    }
  );
  automationLogRows.push(
    {
      orderId: null,
      event: "Синхронизация с поставщиками",
      action: "Обновлены тарифы 3 партнёров, проверена доступность API",
      result: "success",
      durationMs: seedDuration("sync1"),
      source: "Business Event Engine",
      actorName: null,
      createdAt: new Date(nowMs - 6 * 3600000),
    },
    {
      orderId: null,
      event: "Интеграция с платёжным шлюзом",
      action: "Повторная попытка оплаты после ошибки банка",
      result: "skipped",
      durationMs: seedDuration("pay1"),
      source: "Business Event Engine",
      actorName: null,
      createdAt: new Date(nowMs - 26 * 3600000),
    },
    {
      orderId: null,
      event: "AI-анализ портфеля заказов",
      action: "Выявлен риск отмены по 2 заказам — рекомендации переданы менеджерам",
      result: "success",
      durationMs: seedDuration("ai1"),
      source: "AI Center",
      actorName: null,
      createdAt: new Date(nowMs - 50 * 3600000),
    }
  );

  for (let i = 0; i < automationLogRows.length; i += 1000) {
    await prisma.automationLog.createMany({ data: automationLogRows.slice(i, i + 1000) });
  }

  // Журнал обработки исключений (Гл. 3.17): цепочки take/resolve/close по статусу
  for (const ex of exceptionLogRows) {
    const created = await prisma.exceptionLog.create({
      data: ex,
      select: { id: true },
    });
    const span = Math.max(ex.updatedAt.getTime() - ex.createdAt.getTime(), 3600000);
    const chain: { action: string; from: string | null; to: string; comment: string; f: number }[] =
      ex.status === "closed"
        ? [
            { action: "take", from: "new", to: "working", comment: "Взят в работу", f: 0.2 },
            { action: "resolve", from: "working", to: "resolved", comment: "Помечен решённым", f: 0.6 },
            { action: "close", from: "resolved", to: "closed", comment: "Закрыт", f: 0.9 },
          ]
        : ex.status === "resolved"
        ? [
            { action: "take", from: "new", to: "working", comment: "Взят в работу", f: 0.3 },
            { action: "resolve", from: "working", to: "resolved", comment: "Помечен решённым", f: 0.7 },
          ]
        : ex.status === "working"
        ? [{ action: "take", from: "new", to: "working", comment: "Взят в работу", f: 0.4 }]
        : [];
    for (const step of chain) {
      exceptionHistoryRows.push({
        exceptionLogId: created.id,
        action: step.action,
        from: step.from,
        to: step.to,
        comment: step.comment,
        actorName: ex.actorName,
        createdAt: new Date(ex.createdAt.getTime() + Math.floor(span * step.f)),
      });
    }
  }
  for (let i = 0; i < exceptionHistoryRows.length; i += 1000) {
    await prisma.exceptionLogHistory.createMany({ data: exceptionHistoryRows.slice(i, i + 1000) });
  }

  // ── Outbox доменных событий (Гл. 6): историческая лента событий Order Center ──
  // Для каждого заказа — событие создания и событие ключевого перехода его
  // жизненного цикла (публикуются в ленту «Последние события», Гл. 5.3).
  await prisma.orderEvent.deleteMany({});
  const eventOrders = await prisma.order.findMany({
    select: { id: true, orderNumber: true, status: true, paymentStatus: true, amount: true, createdAt: true },
  });
  const eventStatusMap: Record<string, string> = {
    SENT_TO_BOOKING: "ORDER_SENT_TO_BOOKING",
    PARTIALLY_FULFILLED: "ORDER_SENT_TO_BOOKING",
    FULFILLED: "ORDER_FULFILLED",
    READY_TO_CLOSE: "ORDER_FULFILLED",
    CLOSED: "ORDER_CLOSED",
    CANCELLED: "ORDER_CANCELLED",
    PROBLEM: "ORDER_PROBLEM",
    READY_FOR_BOOKING: "ORDER_READY_FOR_BOOKING",
  };
  const eventRows = eventOrders.flatMap((o) => {
    return [
      {
        orderId: o.id,
        type: "ORDER_CREATED" as never,
        payload: { amount: o.amount },
        status: "PUBLISHED" as never,
        createdAt: new Date(o.createdAt.getTime() - 3 * 3600000),
        publishedAt: o.createdAt,
      },
      {
        orderId: o.id,
        type: (eventStatusMap[o.status] ?? "ORDER_STATUS_CHANGED") as never,
        payload: {
          to: o.status,
          ...(o.paymentStatus === "PAID" ? { paymentStatus: o.paymentStatus } : {}),
          amount: o.amount,
        },
        status: "PUBLISHED" as never,
        createdAt: o.createdAt,
        publishedAt: o.createdAt,
      },
    ];
  });
  for (let i = 0; i < eventRows.length; i += 500) {
    await prisma.orderEvent.createMany({ data: eventRows.slice(i, i + 500) });
  }

  // ── Журнал аудита (Гл. 3.18) ──
  // Централизованная регистрация значимых действий: входы/выходы пользователей,
  // создание и изменение заказов, финансовые операции, документооборот, события
  // безопасности, интеграции и AI-анализ. Записи неизменяемы и используются для
  // аудита, расследований и соответствия. Менеджеры — та же ротация, что и в
  // реестре заказов (pickManager), чтобы подписи совпадали.
  await prisma.auditLog.deleteMany({});

  const auditStaff = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SALES_MANAGER", "OPERATOR", "DIRECTOR", "FINANCE", "MODERATOR", "ANALYST"] }, isActive: true },
    select: { id: true, firstName: true, lastName: true, role: true, email: true },
  });
  const staffFor = (seed: string) => {
    if (!auditStaff.length) return null;
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return auditStaff[h % auditStaff.length];
  };
  const auditDepartment = (role: string): string => {
    const map: Record<string, string> = {
      ADMIN: "Администрация",
      DIRECTOR: "Руководство",
      SALES_MANAGER: "Отдел продаж",
      OPERATOR: "Отдел исполнения",
      FINANCE: "Финансовый отдел",
      MODERATOR: "Модерация",
      ANALYST: "Аналитика",
    };
    return map[role] ?? "Система";
  };

  const auditRows: {
    eventId: string;
    userId: string | null;
    actorName: string;
    actorRole?: string | null;
    department?: string | null;
    category: string;
    action: string;
    objectType?: string | null;
    objectId?: string | null;
    objectNumber?: string | null;
    fromData?: string | null;
    toData?: string | null;
    comment?: string | null;
    source: string;
    ip?: string | null;
    userAgent?: string | null;
    criticality: string;
    createdAt: Date;
  }[] = [];
  let auditSeq = 0;
  const auditPush = (r: Omit<typeof auditRows[number], "eventId">) => {
    auditSeq++;
    auditRows.push({ eventId: `AUD-${String(auditSeq).padStart(6, "0")}`, ...r });
  };

  const staffNames = auditStaff.map((s) => `${s.firstName} ${s.lastName ?? ""}`.trim());
  const auditManagerFor = (seed: string): string => {
    if (!staffNames.length) return "Система";
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return staffNames[h % staffNames.length];
  };

  const auditNowMs = Date.now();
  // Входы/выходы сотрудников: 1–3 сессии в день на сотрудника за последние 60 дней
  for (const staff of auditStaff) {
    const sessions = 1 + (staff.id.length % 3);
    for (let i = 0; i < sessions; i++) {
      const dayAgo = randInt(0, 60);
      const loginAt = new Date(auditNowMs - dayAgo * 86400000 - randInt(1, 12) * 3600000);
      const logoutAt = new Date(loginAt.getTime() + randInt(2, 9) * 3600000);
      const role = staff.role;
      auditPush({
        userId: staff.id,
        actorName: `${staff.firstName} ${staff.lastName ?? ""}`.trim(),
        actorRole: role,
        department: auditDepartment(role),
        category: "Безопасность",
        action: "login",
        objectType: "Пользователь",
        objectId: staff.id,
        objectNumber: staff.email,
        comment: "Вход в систему",
        source: "Web",
        ip: `10.0.${randInt(0, 4)}.${randInt(2, 254)}`,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0 Safari/537.36",
        criticality: "info",
        createdAt: loginAt,
      });
      auditPush({
        userId: staff.id,
        actorName: `${staff.firstName} ${staff.lastName ?? ""}`.trim(),
        actorRole: role,
        department: auditDepartment(role),
        category: "Безопасность",
        action: "logout",
        objectType: "Пользователь",
        objectId: staff.id,
        objectNumber: staff.email,
        comment: "Выход из системы",
        source: "Web",
        ip: `10.0.${randInt(0, 4)}.${randInt(2, 254)}`,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0 Safari/537.36",
        criticality: "info",
        createdAt: logoutAt,
      });
    }
  }

  // События заказов: создание (из createdAt), оплата/возврат/статусы, документы
  const auditOrders = await prisma.order.findMany({
    select: { id: true, orderNumber: true, status: true, paymentStatus: true, createdAt: true, updatedAt: true, amount: true, paidAmount: true },
  });
  const paidOrderStatuses = ["FULFILLED", "READY_TO_CLOSE", "CLOSED"];
  const docsOrderStatuses = ["FULFILLED", "READY_TO_CLOSE", "CLOSED"];
  for (const o of auditOrders) {
    const manager = auditManagerFor(o.id);
    auditPush({
      userId: staffFor(o.id)?.id ?? null,
      actorName: manager,
      actorRole: "SALES_MANAGER",
      department: "Отдел продаж",
      category: "Пользовательские действия",
      action: "create",
      objectType: "Заказ",
      objectId: o.id,
      objectNumber: o.orderNumber,
      toData: JSON.stringify({ amount: o.amount, status: o.status }),
      comment: "Заказ создан",
      source: pick(["Web", "Mobile", "API"]),
      ip: `10.0.${randInt(0, 4)}.${randInt(2, 254)}`,
      userAgent: null,
      criticality: "info",
      createdAt: o.createdAt,
    });
    // Полная оплата → финансовое событие
    if (paidOrderStatuses.includes(o.status) && o.paidAmount > 0) {
      auditPush({
        userId: staffFor(o.id + "pay")?.id ?? null,
        actorName: auditManagerFor(o.id + "pay"),
        actorRole: "FINANCE",
        department: "Финансовый отдел",
        category: "Финансовые операции",
        action: "payment",
        objectType: "Заказ",
        objectId: o.id,
        objectNumber: o.orderNumber,
        toData: JSON.stringify({ paidAmount: o.paidAmount, amount: o.amount }),
        comment: "Поступление оплаты по заказу",
        source: pick(["Web", "API", "Integration"]),
        ip: `10.0.${randInt(0, 4)}.${randInt(2, 254)}`,
        userAgent: null,
        criticality: "info",
        createdAt: new Date(Math.min(o.updatedAt.getTime(), auditNowMs)),
      });
    }
    // Возврат/отмена → событие с критичностью warning
    if (o.status === "CANCELLED" || o.paymentStatus === "REFUNDED") {
      auditPush({
        userId: staffFor(o.id + "ref")?.id ?? null,
        actorName: auditManagerFor(o.id + "ref"),
        actorRole: "FINANCE",
        department: "Финансовый отдел",
        category: "Финансовые операции",
        action: o.paymentStatus === "REFUNDED" ? "refund" : "status",
        objectType: "Заказ",
        objectId: o.id,
        objectNumber: o.orderNumber,
        fromData: JSON.stringify({ status: "FULFILLED", paymentStatus: "PAID" }),
        toData: JSON.stringify({ status: o.status, paymentStatus: o.paymentStatus }),
        comment: o.paymentStatus === "REFUNDED" ? "Оформлен возврат средств" : "Заказ отменён",
        source: "Web",
        ip: `10.0.${randInt(0, 4)}.${randInt(2, 254)}`,
        userAgent: null,
        criticality: "warning",
        createdAt: o.updatedAt,
      });
    }
    // Документооборот: ваучер для готовых к поездке
    if (docsOrderStatuses.includes(o.status)) {
      auditPush({
        userId: staffFor(o.id + "doc")?.id ?? null,
        actorName: auditManagerFor(o.id + "doc"),
        actorRole: "OPERATOR",
        department: "Отдел исполнения",
        category: "Документооборот",
        action: "document",
        objectType: "Заказ",
        objectId: o.id,
        objectNumber: o.orderNumber,
        toData: JSON.stringify({ document: "Ваучер", status: "Готов" }),
        comment: "Сформирован ваучер по шаблону",
        source: pick(["Web", "System"]),
        ip: `10.0.${randInt(0, 4)}.${randInt(2, 254)}`,
        userAgent: null,
        criticality: "info",
        createdAt: o.updatedAt,
      });
    }
  }

  // Системные события: интеграции, AI-анализ, безопасность (детерминированные)
  const sysEvents: {
    category: string;
    action: string;
    objectType: string;
    comment: string;
    criticality: string;
    source: string;
    hoursAgo: number;
  }[] = [
    {
      category: "Интеграции",
      action: "integration",
      objectType: "Поставщик",
      comment: "Синхронизация тарифов с партнёрами: обновлено 3 поставщика",
      criticality: "info",
      source: "Integration",
      hoursAgo: 6,
    },
    {
      category: "Интеграции",
      action: "integration",
      objectType: "Платёжный шлюз",
      comment: "API платёжного шлюза недоступен — повторные попытки в очереди",
      criticality: "error",
      source: "Integration",
      hoursAgo: 26,
    },
    {
      category: "AI-события",
      action: "ai",
      objectType: "Портфель заказов",
      comment: "AI-анализ: выявлен риск отмены по 2 заказам, рекомендации переданы менеджерам",
      criticality: "info",
      source: "AI",
      hoursAgo: 50,
    },
    {
      category: "Безопасность",
      action: "security",
      objectType: "Пользователь",
      comment: "Обнаружено большое количество неудачных попыток входа (защита от перебора)",
      criticality: "critical",
      source: "System",
      hoursAgo: 9,
    },
    {
      category: "Пользовательские действия",
      action: "bulk",
      objectType: "Заказ",
      comment: "Массовое изменение приоритета: 12 заказов",
      criticality: "info",
      source: "Web",
      hoursAgo: 30,
    },
    {
      category: "Документооборот",
      action: "document",
      objectType: "Договор",
      comment: "Договор подписан электронной подписью",
      criticality: "info",
      source: "Web",
      hoursAgo: 78,
    },
  ];
  for (const ev of sysEvents) {
    auditPush({
      userId: staffFor(ev.comment)?.id ?? null,
      actorName: ev.source === "System" || ev.source === "Integration" || ev.source === "AI" ? (ev.source === "AI" ? "AI Center" : ev.source === "Integration" ? "Business Event Engine" : "Система") : auditManagerFor(ev.comment),
      actorRole: ev.source === "AI" ? "AI" : null,
      department: ev.source === "AI" ? "AI Center" : ev.source === "Integration" ? "Интеграции" : ev.source === "System" ? "Система" : "Отдел продаж",
      category: ev.category,
      action: ev.action,
      objectType: ev.objectType,
      comment: ev.comment,
      source: ev.source,
      ip: ev.source === "Web" ? `10.0.${randInt(0, 4)}.${randInt(2, 254)}` : null,
      userAgent: null,
      criticality: ev.criticality,
      createdAt: new Date(auditNowMs - ev.hoursAgo * 3600000),
    });
  }

  for (let i = 0; i < auditRows.length; i += 1000) {
    await prisma.auditLog.createMany({ data: auditRows.slice(i, i + 1000) });
  }

  // ── Страны и города (без изменений) ──
  const uniqueCountries = countriesDatabase.filter((c, i, arr) => arr.findIndex(x => x.code === c.code) === i);
  console.log(`Seeding ${uniqueCountries.length} countries...`);
  for (const country of uniqueCountries) {
    await prisma.country.upsert({
      where: { code: country.code },
      update: { nameRu: country.name.ru, nameEn: country.name.en },
      create: { code: country.code, nameRu: country.name.ru, nameEn: country.name.en },
    });
    let cityIdx = 0;
    for (const city of country.cities) {
      cityIdx++;
      const cityId = `${country.code.toLowerCase()}-${cityIdx}`;
      await prisma.city.upsert({
        where: { id: cityId },
        update: { nameRu: city.name.ru, nameEn: city.name.en, countryCode: country.code },
        create: { id: cityId, nameRu: city.name.ru, nameEn: city.name.en, countryCode: country.code },
      });
    }
  }

  // ── Phase 2: Sales Center (Lead → Opportunity → Quote → Sale) ──
  // Идемпотентность: удаляем и создаём заново (сид — источник данных).
  await prisma.sale.deleteMany({});
  await prisma.quoteItem.deleteMany({});
  await prisma.quote.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.leadHistory.deleteMany({});
  await prisma.lead.deleteMany({});

  const SALES_MANAGERS = ["Айхан Рагимов", "Лейла Алиева", "Надир Сулейманов"];
  const LEAD_SOURCES = ["Сайт", "Call-центр", "Telegram-бот", "WhatsApp", "Партнёр", "Реклама"];
  const INTERESTS = ["Тур в Турцию", "Отель 5★ в Дубае", "Экскурсии по Грузии", "Санаторий в Баку", "Гид в Стамбуле", "Трансфер из аэропорта"];

  // Лиды: 40 шт. — новые, квалифицированные, конвертированные, отклонённые.
  const leadRows: { id: string; code: string; createdAt: Date }[] = [];
  let ledSeq = 0;
  const leadStatusPlan: Array<["NEW" | "QUALIFIED" | "CONVERTED" | "DISQUALIFIED", number]> = [
    ["NEW", 18], ["QUALIFIED", 10], ["CONVERTED", 6], ["DISQUALIFIED", 6],
  ];
  const leadStatuses: Array<"NEW" | "QUALIFIED" | "CONVERTED" | "DISQUALIFIED"> = [];
  for (const [s, n] of leadStatusPlan) {
    for (let i = 0; i < n; i++) leadStatuses.push(s);
  }
  for (let i = leadStatuses.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [leadStatuses[i], leadStatuses[j]] = [leadStatuses[j], leadStatuses[i]];
  }
  for (const st of leadStatuses) {
    const n = randomName();
    const createdAt = dateBetween(new Date(NOW.getTime() - 60 * DAY), NOW);
    const lead = await prisma.lead.create({
      data: {
        code: `LED-${String(++ledSeq).padStart(8, "0")}`,
        source: pick(LEAD_SOURCES),
        customerId: pick(buyerRecords).id,
        customerName: `${n.firstName} ${n.lastName}`,
        contactEmail: `lead${ledSeq}@mail.com`,
        contactPhone: `+9945${randInt(1000000, 9999999)}`,
        interest: pick(INTERESTS),
        ownerId: pick(catalogManagers).id,
        ownerName: pick(SALES_MANAGERS),
        qualification: pick(["cold", "warm", "hot"]),
        status: st,
        nextAction: st === "NEW" ? pick(["Позвонить клиенту", "Отправить каталог", "Согласовать бюджет"]) : null,
        nextActionAt: st === "NEW" ? new Date(NOW.getTime() + randInt(6, 72) * 3600000) : null,
        slaDueAt: new Date(createdAt.getTime() + 72 * 3600000),
        createdAt,
      },
    });
    leadRows.push({ id: lead.id, code: lead.code, createdAt });
    await prisma.leadHistory.create({
      data: {
        leadId: lead.id,
        action: "created",
        from: null,
        to: st,
        actorId: null,
        actorName: "Система",
        comment: "Лид создан",
        createdAt,
      },
    });
  }

  // Возможности: из квалифицированных лидов и напрямую.
  const oppRows: { id: string; code: string; customerId: string; customerName: string; createdAt: Date }[] = [];
  let oppSeq = 0;
  const oppStages = ["QUALIFICATION", "NEED_ANALYSIS", "QUOTE", "NEGOTIATION", "WON", "LOST"];
  for (let i = 0; i < 22; i++) {
    const n = randomName();
    const buyer = pick(buyerRecords);
    const stage = pick(oppStages);
    const budget = randInt(800, 8000);
    const createdAt = dateBetween(new Date(NOW.getTime() - 50 * DAY), NOW);
    const opp = await prisma.opportunity.create({
      data: {
        code: `OPP-${String(++oppSeq).padStart(8, "0")}`,
        customerId: buyer.id,
        customerName: `${n.firstName} ${n.lastName}`,
        contactEmail: `opp${oppSeq}@mail.com`,
        contactPhone: `+9945${randInt(1000000, 9999999)}`,
        ownerId: pick(catalogManagers).id,
        ownerName: pick(SALES_MANAGERS),
        need: pick(INTERESTS),
        productsRef: JSON.stringify([]),
        budget,
        currency: "USD",
        expectedCloseDate: new Date(NOW.getTime() + randInt(7, 60) * DAY),
        probability: stage === "WON" ? 100 : stage === "LOST" ? 0 : randInt(15, 85),
        stage,
        nextAction: chance(0.6) ? pick(["Согласовать условия", "Подготовить предложение", "Перезвонить клиенту"]) : null,
        nextActionAt: chance(0.5) ? new Date(NOW.getTime() + randInt(6, 72) * 3600000) : null,
        risks: chance(0.3) ? "Возможен срыв сроков" : null,
        createdAt,
      },
    });
    oppRows.push({ id: opp.id, code: opp.code, customerId: buyer.id, customerName: `${n.firstName} ${n.lastName}`, createdAt });
  }

  // Предложения: 14 шт. (версии, статусы DRAFT/SENT/ACCEPTED/REJECTED).
  const quoteRows: { id: string; code: string; customerId: string; createdAt: Date }[] = [];
  let qteSeq = 0;
  const quoteStatusPlan: Array<["DRAFT" | "SENT" | "ACCEPTED" | "REJECTED", number]> = [
    ["DRAFT", 3], ["SENT", 5], ["ACCEPTED", 4], ["REJECTED", 2],
  ];
  const quoteStatuses: Array<"DRAFT" | "SENT" | "ACCEPTED" | "REJECTED"> = [];
  for (const [s, n] of quoteStatusPlan) {
    for (let i = 0; i < n; i++) quoteStatuses.push(s);
  }
  const saleRows: { id: string; code: string; customerId: string; amount: number; createdAt: Date }[] = [];
  let salSeq = 0;
  for (const st of quoteStatuses) {
    const opp = pick(oppRows);
    const svc = pick(serviceRecords);
    const qty = randInt(1, 3);
    const price = svc.discountPrice ?? svc.price;
    const amount = Math.round(price * qty * 100) / 100;
    const createdAt = dateBetween(new Date(opp.createdAt.getTime()), NOW);
    // Имя клиента берём из возможности — Quote.customerId совпадает с customerName.
    const customerName = opp.customerName;
    const quote = await prisma.quote.create({
      data: {
        code: `QTE-${String(++qteSeq).padStart(8, "0")}`,
        opportunityId: opp.id,
        customerId: opp.customerId,
        customerName,
        currency: "USD",
        version: chance(0.3) ? 2 : 1,
        discount: chance(0.4) ? Math.round(amount * 0.05 * 100) / 100 : 0,
        fees: 0,
        validUntil: new Date(NOW.getTime() + 14 * DAY),
        status: st,
        approval: st === "ACCEPTED" ? "approved" : st === "REJECTED" ? "rejected" : "pending",
        approvedBy: st === "ACCEPTED" || st === "REJECTED" ? pick(SALES_MANAGERS) : null,
        acceptedAt: st === "ACCEPTED" ? new Date(createdAt.getTime() + randInt(1, 5) * DAY) : null,
        createdAt,
      },
    });
    await prisma.quoteItem.create({
      data: {
        quoteId: quote.id,
        serviceId: svc.id,
        title: "Услуга TravelHub",
        type: svc.type ?? "TOUR",
        quantity: qty,
        price,
        amount,
      },
    });
    quoteRows.push({ id: quote.id, code: quote.code, customerId: opp.customerId, createdAt });
    if (st === "ACCEPTED") {
      // Принятое предложение → сделка (SAL-*).
      const sale = await prisma.sale.create({
        data: {
          code: `SAL-${String(++salSeq).padStart(8, "0")}`,
          quoteId: quote.id,
          customerId: opp.customerId,
          customerName,
          amount: amount - (quote.discount || 0) + (quote.fees || 0),
          currency: "USD",
          status: "WON",
          closedAt: quote.acceptedAt ?? createdAt,
          createdAt,
        },
      });
      saleRows.push({ id: sale.id, code: sale.code, customerId: opp.customerId, amount, createdAt });
    }
  }

  // ── Phase 2: Finance Center (Payment/Refund/Invoice/Commission/Currency/Tax) ──
  await prisma.payment.deleteMany({});
  await prisma.refund.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.commission.deleteMany({});
  await prisma.exchangeRate.deleteMany({});
  await prisma.taxRule.deleteMany({});
  await prisma.tax.deleteMany({});
  await prisma.currency.deleteMany({});

  // Валюты (владелец — Finance, Baseline §0.6).
  await Promise.all([
    prisma.currency.create({ data: { code: "CUR-00000001", name: "Доллар США", symbol: "$", isBase: true, isActive: true } }),
    prisma.currency.create({ data: { code: "CUR-00000002", name: "Евро", symbol: "€", isBase: false, isActive: true } }),
    prisma.currency.create({ data: { code: "CUR-00000003", name: "Азербайджанский манат", symbol: "₼", isBase: false, isActive: true } }),
    prisma.currency.create({ data: { code: "CUR-00000004", name: "Турецкая лира", symbol: "₺", isBase: false, isActive: true } }),
  ]);
  await prisma.exchangeRate.createMany({
    data: [
      { code: "FXR-00000001", fromCode: "CUR-00000001", toCode: "CUR-00000002", rate: 0.92, date: new Date() },
      { code: "FXR-00000002", fromCode: "CUR-00000001", toCode: "CUR-00000003", rate: 1.7, date: new Date() },
      { code: "FXR-00000003", fromCode: "CUR-00000001", toCode: "CUR-00000004", rate: 34.2, date: new Date() },
    ],
  });
  const taxes = await Promise.all([
    prisma.tax.create({ data: { code: "TAX-00000001", name: "НДС", rate: 12, isActive: true } }),
    prisma.tax.create({ data: { code: "TAX-00000002", name: "Налог на проживание", rate: 5, isActive: true } }),
  ]);
  await prisma.taxRule.createMany({
    data: [
      { code: "TXR-00000001", taxId: taxes[0].id, country: null, serviceType: null, rateOverride: null, isActive: true },
      { code: "TXR-00000002", taxId: taxes[1].id, country: "Турция", serviceType: "HOTEL", rateOverride: 8, isActive: true },
    ],
  });

  // Платежи: по реальным заказам (PAID/PARTIALLY_PAID) + свежие в CREATED.
  const ordersForFinance = await prisma.order.findMany({
    select: { id: true, orderNumber: true, amount: true, paymentStatus: true, userId: true, createdAt: true },
    take: 60,
  });
  let paySeq = 0;
  let rfdSeq = 0;
  let invSeq = 0;
  let cmsSeq = 0;
  for (const o of ordersForFinance) {
    const amount = o.paymentStatus === "PAID" ? o.amount : o.amount * 0.5;
    const pay = await prisma.payment.create({
      data: {
        code: `PAY-${String(++paySeq).padStart(8, "0")}`,
        orderId: o.id,
        customerId: o.userId ?? null,
        amount: Math.round(amount * 100) / 100,
        currency: "USD",
        method: pick(["Банковский перевод", "Карта", "Наличные", "Онлайн-оплата"]),
        status: o.paymentStatus === "PAID" || o.paymentStatus === "PARTIALLY_PAID" ? "RECEIVED" : "CREATED",
        receivedAt: o.paymentStatus === "PAID" || o.paymentStatus === "PARTIALLY_PAID" ? o.createdAt : null,
        createdAt: o.createdAt,
      },
    });
    if (o.paymentStatus === "REFUNDED") {
      await prisma.refund.create({
        data: {
          code: `RFD-${String(++rfdSeq).padStart(8, "0")}`,
          orderId: o.id,
          paymentId: pay.id,
          amount: Math.round(o.amount * 100) / 100,
          currency: "USD",
          reason: "Отмена бронирования",
          status: "COMPLETED",
          completedAt: new Date(o.createdAt.getTime() + DAY),
          createdAt: o.createdAt,
        },
      });
    }
    if (o.paymentStatus === "PAID" || o.paymentStatus === "PARTIALLY_PAID") {
      await prisma.invoice.create({
        data: {
          code: `INV-${String(++invSeq).padStart(8, "0")}`,
          orderId: o.id,
          customerId: o.userId ?? null,
          amount: Math.round(o.amount * 100) / 100,
          currency: "USD",
          status: "PAID",
          issuedAt: new Date(o.createdAt.getTime() + 3600000),
          dueAt: new Date(o.createdAt.getTime() + 3 * DAY),
          createdAt: o.createdAt,
        },
      });
      await prisma.commission.create({
        data: {
          code: `CMS-${String(++cmsSeq).padStart(8, "0")}`,
          orderId: o.id,
          partnerId: null,
          amount: Math.round(o.amount * 0.12 * 100) / 100,
          currency: "USD",
          rate: 0.12,
          status: chance(0.6) ? "PAID" : "PENDING",
          paidAt: chance(0.6) ? new Date(o.createdAt.getTime() + 2 * DAY) : null,
          createdAt: o.createdAt,
        },
      });
    }
  }
  // Возвраты: по заказам с paymentStatus REFUNDED (в т.ч. целевые из Phase 1 сида).
  // Создаём и платёж, если его нет (REFUNDED-заказы могли не попасть в выборку выше).
  const refundOrders = await prisma.order.findMany({
    where: { paymentStatus: "REFUNDED" },
    select: { id: true, orderNumber: true, amount: true, userId: true, createdAt: true },
  });
  for (const o of refundOrders) {
    let pay = await prisma.payment.findFirst({ where: { orderId: o.id }, select: { id: true } });
    if (!pay) {
      pay = await prisma.payment.create({
        data: {
          code: `PAY-${String(++paySeq).padStart(8, "0")}`,
          orderId: o.id,
          customerId: o.userId ?? null,
          amount: Math.round(o.amount * 100) / 100,
          currency: "USD",
          method: "Банковский перевод",
          status: "REFUNDED",
          receivedAt: o.createdAt,
          createdAt: o.createdAt,
        },
        select: { id: true },
      });
    }
    await prisma.refund.create({
      data: {
        code: `RFD-${String(++rfdSeq).padStart(8, "0")}`,
        orderId: o.id,
        paymentId: pay.id,
        amount: Math.round(o.amount * 100) / 100,
        currency: "USD",
        reason: "Отмена бронирования",
        status: "COMPLETED",
        completedAt: new Date(o.createdAt.getTime() + DAY),
        createdAt: o.createdAt,
      },
    });
  }

  // Несколько «свежих» платежей в статусе CREATED (очередь Finance).
  for (let i = 0; i < 5; i++) {
    const o = pick(ordersForFinance);
    await prisma.payment.create({
      data: {
        code: `PAY-${String(++paySeq).padStart(8, "0")}`,
        orderId: o.id,
        customerId: o.userId ?? null,
        amount: Math.round(o.amount * 0.5 * 100) / 100,
        currency: "USD",
        method: "Банковский перевод",
        status: "CREATED",
        createdAt: new Date(NOW.getTime() - randInt(1, 24) * 3600000),
      },
    });
  }

  const counts = {
    countries: await prisma.country.count(),
    cities: await prisma.city.count(),
    users: await prisma.user.count(),
    buyers: await prisma.user.count({ where: { role: "BUYER" } }),
    partners: await prisma.user.count({ where: { role: "PARTNER" } }),
    salesManagers: await prisma.user.count({ where: { role: "SALES_MANAGER" } }),
    operators: await prisma.user.count({ where: { role: "OPERATOR" } }),
    services: await prisma.service.count(),
    bookings: await prisma.booking.count(),
    serviceViews: await prisma.serviceView.count(),
    reviews: await prisma.review.count(),
    bookingHistory: await prisma.bookingHistory.count(),
    bookingMessages: await prisma.bookingMessage.count(),
    orders: await prisma.order.count(),
    orderHistory: await prisma.orderHistory.count(),
    orderMessages: await prisma.orderMessage.count(),
    automationLogs: await prisma.automationLog.count(),
    exceptions: await prisma.exceptionLog.count(),
    exceptionHistory: await prisma.exceptionLogHistory.count(),
    auditLogs: await prisma.auditLog.count(),
    leads: await prisma.lead.count(),
    opportunities: await prisma.opportunity.count(),
    quotes: await prisma.quote.count(),
    sales: await prisma.sale.count(),
    payments: await prisma.payment.count(),
    refunds: await prisma.refund.count(),
    invoices: await prisma.invoice.count(),
    commissions: await prisma.commission.count(),
    currencies: await prisma.currency.count(),
    taxes: await prisma.tax.count(),
  };
  console.log("Seed completed:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
