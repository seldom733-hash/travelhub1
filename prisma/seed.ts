import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { countriesDatabase } from "../src/lib/countries-data";

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
    update: {},
    create: {
      email: "admin@travelhub.az",
      passwordHash: hash("admin123"),
      firstName: "Александр",
      lastName: "Администратор",
      role: "ADMIN",
    },
  });

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
  const serviceRecords: { id: string; price: number; discountPrice: number | null }[] = [];

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
    const active = chance(0.95);

    const svc = await prisma.service.create({
      data: {
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
        createdAt: serviceCreatedAt(),
      },
    });
    if (active) {
      serviceRecords.push({ id: svc.id, price: svc.price, discountPrice: svc.discountPrice });
    }
  };

  for (let p = 0; p < partnerIds.length; p++) {
    for (let s = 0; s < countsByPartner[p]; s++) {
      await createService(partnerIds[p]);
    }
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

  const statuses: Array<"PENDING" | "PAID" | "REFUNDED" | "COMPLETED"> = [];
  const statusPlan: Array<[(typeof statuses)[number], number]> = [
    ["REFUNDED", 5],
    ["PENDING", 10],
    ["PAID", 67],
    ["COMPLETED", 48],
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
    status: (typeof statuses)[number];
  }> = activeBookers.map((b) => ({ buyerId: b.id, regDate: b.createdAt, status: statuses.pop()! }));
  while (statuses.length) {
    const b = pick(activeBookers);
    bookings.push({ buyerId: b.id, regDate: b.createdAt, status: statuses.pop()! });
  }

  const AFTER_AUG = new Date("2026-08-02");
  for (const bk of bookings) {
    const svc = pick(serviceRecords);
    let serviceDate: Date;
    if (bk.status === "PAID") {
      // «Ждут даты» — дата услуги после 01.08.2026.
      serviceDate = dateBetween(AFTER_AUG, new Date("2026-12-31"));
    } else if (bk.status === "PENDING") {
      // Ожидание оплаты — будущая дата услуги (до 3 месяцев).
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
  const reviewBuyers = buyerRecords.filter((b) => chance(0.9));
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
  // Расширяем статистику: помимо заданных 130 броней добавляем ~200 броней,
  // равномерно распределённых по 2026 году, включая сегодняшние.
  const EXTRA_BOOKINGS = 200;
  const extraBookings: {
    userId: string;
    regDate: Date;
    serviceId: string;
    amount: number;
    status: (typeof statuses)[number];
    serviceDate: Date;
  }[] = [];
  for (let i = 0; i < EXTRA_BOOKINGS; i++) {
    const buyer = pick(buyerRecords);
    const svc = pick(serviceRecords);
    const r = rand();
    const status: (typeof statuses)[number] =
      r < 0.4 ? "PAID" : r < 0.75 ? "COMPLETED" : r < 0.9 ? "PENDING" : "REFUNDED";
    // Дата создания: сегодня (10%), за неделю (20%), за месяц (30%), остальное в течение 2026
    let createdAt: Date;
    const cr = rand();
    if (cr < 0.1) createdAt = dateBetween(new Date(NOW.getTime() - 12 * 3600000), NOW);
    else if (cr < 0.3) createdAt = dateBetween(new Date(NOW.getTime() - 7 * DAY), NOW);
    else if (cr < 0.6) createdAt = dateBetween(new Date(NOW.getTime() - 30 * DAY), NOW);
    else createdAt = dateBetween(new Date("2026-01-01"), new Date("2026-07-01"));
    // Дата услуги: для завершённых/возвратов — в прошлом после создания,
    // для PAID/PENDING — в будущем (после 01.08.2026)
    const isPast = status === "COMPLETED" || status === "REFUNDED";
    let serviceDate: Date;
    if (isPast) {
      const start = new Date(Math.min(createdAt.getTime() + DAY, NOW.getTime() - DAY));
      serviceDate = dateBetween(start, new Date(NOW.getTime() - 3600000));
    } else {
      serviceDate = dateBetween(new Date("2026-08-02"), new Date("2026-12-31"));
    }
    extraBookings.push({
      userId: buyer.id,
      regDate: buyer.createdAt,
      serviceId: svc.id,
      amount: svc.discountPrice ?? svc.price,
      status,
      serviceDate,
    });
  }
  for (const bk of extraBookings) {
    const maxCreated = new Date(Math.min(bk.serviceDate.getTime() - DAY, NOW.getTime()));
    const createdAt = dateBetween(
      new Date(Math.min(bk.regDate.getTime(), maxCreated.getTime() - DAY)),
      maxCreated
    );
    await prisma.booking.create({
      data: {
        userId: bk.userId,
        serviceId: bk.serviceId,
        status: bk.status,
        amount: bk.amount,
        serviceDate: bk.serviceDate,
        createdAt,
      },
    });
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

  const counts = {
    countries: await prisma.country.count(),
    cities: await prisma.city.count(),
    users: await prisma.user.count(),
    buyers: await prisma.user.count({ where: { role: "BUYER" } }),
    partners: await prisma.user.count({ where: { role: "PARTNER" } }),
    services: await prisma.service.count(),
    bookings: await prisma.booking.count(),
    serviceViews: await prisma.serviceView.count(),
    reviews: await prisma.review.count(),
  };
  console.log("Seed completed:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
