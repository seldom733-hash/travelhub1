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
      firstName: "Надир",
      lastName: "Сулейманов",
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
  const serviceRecords: { id: string; price: number; discountPrice: number | null; currency: string }[] = [];

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
      serviceRecords.push({ id: svc.id, price: svc.price, discountPrice: svc.discountPrice, currency: svc.currency || "USD" });
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

  type BookingStatusValue = "PENDING" | "CONFIRMED" | "PAID" | "REFUNDED" | "COMPLETED";
  const statuses: BookingStatusValue[] = [];
  const statusPlan: Array<[BookingStatusValue, number]> = [
    ["REFUNDED", 5],
    ["PENDING", 10],
    ["CONFIRMED", 12],
    ["PAID", 55],
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
    if (bk.status === "PAID") {
      // «Ждут даты» — дата услуги после 01.08.2026.
      serviceDate = dateBetween(AFTER_AUG, new Date("2026-12-31"));
    } else if (bk.status === "PENDING" || bk.status === "CONFIRMED") {
      // Ожидание оплаты / подтверждено — будущая дата услуги (до 3 месяцев).
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
      r < 0.35 ? "PAID" : r < 0.62 ? "COMPLETED" : r < 0.78 ? "PENDING" : r < 0.92 ? "CONFIRMED" : "REFUNDED";
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
    const isPast = status === "COMPLETED" || status === "REFUNDED";
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
        userId: bk.userId,
        serviceId: bk.serviceId,
        status: bk.status,
        amount: bk.amount,
        serviceDate: bk.serviceDate,
        createdAt: bk.createdAt,
      },
    });
  }

  // ── Booking Center: целевые сценарии для виджетов (Гл. 5) ──
  // Бронирования с гарантированными окнами дат, чтобы панель Booking Center
  // показывала: ближайшие поездки, просроченные подтверждения, проблемные брони,
  // ожидающие оплаты и свежие брони за сегодня/неделю.
  const bcTargets: Array<{
    count: number;
    status: BookingStatusValue;
    createdAgoHours: [number, number];
    serviceDateInDays: [number, number];
  }> = [
    // Ближайшие поездки (PAID, дата через 1–25 дней)
    { count: 8, status: "PAID", createdAgoHours: [3 * 24, 20 * 24], serviceDateInDays: [1, 25] },
    // Ожидают оплаты / подтверждены, дата скоро → «Проблемные бронирования» (0–3 дня)
    { count: 6, status: "PENDING", createdAgoHours: [2 * 24, 10 * 24], serviceDateInDays: [0, 3] },
    // Просроченные подтверждения (CONFIRMED давно созданы, но без оплаты)
    { count: 5, status: "CONFIRMED", createdAgoHours: [50 * 24, 90 * 24], serviceDateInDays: [7, 60] },
    // Свежие ожидающие оплаты (PENDING, созданы 1–3 дня назад)
    { count: 7, status: "PENDING", createdAgoHours: [12, 3 * 24], serviceDateInDays: [10, 60] },
    // Подтверждённые сегодня/на этой неделе
    { count: 6, status: "CONFIRMED", createdAgoHours: [2, 5 * 24], serviceDateInDays: [5, 45] },
    // Свежие оплаченные сегодня
    { count: 5, status: "PAID", createdAgoHours: [1, 8], serviceDateInDays: [15, 70] },
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
      to: "PENDING",
      actorName: clientName,
      comment: "Бронирование создано",
      createdAt: b.createdAt,
    });
    if (b.status === "CONFIRMED" || b.status === "PAID" || b.status === "COMPLETED") {
      historyRows.push({
        bookingId: b.id,
        action: "confirm",
        from: "PENDING",
        to: "CONFIRMED",
        actorName: pick(MANAGER_POOL),
        comment: "Подтверждено поставщиком",
        createdAt: at(0.35),
      });
    }
    if (b.status === "PAID" || b.status === "COMPLETED") {
      historyRows.push({
        bookingId: b.id,
        action: "pay",
        from: "CONFIRMED",
        to: "PAID",
        actorName: pick(MANAGER_POOL),
        comment: "Оплата получена",
        createdAt: at(0.6),
      });
    }
    if (b.status === "COMPLETED") {
      historyRows.push({
        bookingId: b.id,
        action: "complete",
        from: "PAID",
        to: "COMPLETED",
        actorName: pick(MANAGER_POOL),
        comment: "Поездка завершена",
        createdAt: at(0.9),
      });
    }
    if (b.status === "REFUNDED") {
      historyRows.push({
        bookingId: b.id,
        action: "cancel",
        from: "PAID",
        to: "REFUNDED",
        actorName: pick(MANAGER_POOL),
        comment: "Отменено, средства возвращены",
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
    if (status === "COMPLETED" || status === "REFUNDED") return randInt(2, 4);
    if (status === "PAID") return randInt(1, 3);
    return randInt(1, 2);
  };
  // Автоматические системные сообщения по статусу (Гл. 5.9): создание →
  // подтверждение → оплата → завершение (или отмена). Временные метки совпадают
  // с журналом истории, чтобы хронология чата и журнала согласовывались.
  const SYSTEM_EVENTS: Record<string, { text: string; f: number }[]> = {
    PENDING: [{ text: "Бронирование создано и ожидает подтверждения", f: 0 }],
    CONFIRMED: [
      { text: "Бронирование создано и ожидает подтверждения", f: 0 },
      { text: "Бронирование подтверждено ✅", f: 0.35 },
    ],
    PAID: [
      { text: "Бронирование создано и ожидает подтверждения", f: 0 },
      { text: "Бронирование подтверждено ✅", f: 0.35 },
      { text: "Оплата получена 💳", f: 0.6 },
    ],
    COMPLETED: [
      { text: "Бронирование создано и ожидает подтверждения", f: 0 },
      { text: "Бронирование подтверждено ✅", f: 0.35 },
      { text: "Оплата получена 💳", f: 0.6 },
      { text: "Поездка завершена 🎉", f: 0.9 },
    ],
    REFUNDED: [
      { text: "Бронирование создано и ожидает подтверждения", f: 0 },
      { text: "Бронирование отменено, средства возвращены ↩️", f: 0.5 },
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
    const terminal = b.status === "COMPLETED" || b.status === "REFUNDED";
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

  // ── Заказы (Order Center, Гл. 6): группируем бронирования в заказы ──
  // Заказ — центральная сущность платформы: объединяет 1–3 брони одного клиента.
  // Статус заказа выводится из статусов входящих броней; далее добавляем целевые
  // заказы с фиксированными статусами жизненного цикла (Гл. 6.10), чтобы виджеты
  // Order Center были заполнены.
  await prisma.order.deleteMany({});
  type OrderStatusValue =
    | "DRAFT" | "CREATED" | "PROCESSING" | "AWAITING_CONFIRMATION" | "CONFIRMED"
    | "AWAITING_PAYMENT" | "PARTIALLY_PAID" | "PAID" | "DOCUMENT_PREP" | "READY"
    | "COMPLETED" | "CHANGED" | "REFUNDED" | "CANCELLED" | "OVERDUE" | "ARCHIVED";
  const orderSources = ["Сайт", "Мобильное приложение", "Партнёр", "Call-центр", "Telegram-бот", "WhatsApp"];
  const orderStatusFromBookings = (items: { status: string }[]): OrderStatusValue => {
    const st = new Set(items.map((b) => b.status));
    const has = (s: string) => st.has(s);
    if (has("REFUNDED")) return "REFUNDED";
    if (st.size === 1 && has("COMPLETED")) return "COMPLETED";
    if (has("COMPLETED") || has("PAID")) return has("PENDING") || has("CONFIRMED") ? "PARTIALLY_PAID" : "PAID";
    if (st.size === 1 && has("CONFIRMED")) return "AWAITING_PAYMENT";
    if (has("CONFIRMED")) return "CONFIRMED";
    if (st.size === 1 && has("PENDING")) return "AWAITING_CONFIRMATION";
    return "CREATED";
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
        g.items.filter((b) => b.status === "PAID" || b.status === "COMPLETED").reduce((a, b) => a + b.amount, 0) * 100
      ) / 100;
    const status = orderStatusFromBookings(g.items);
    const serviceDate = new Date(Math.min(...g.items.map((b) => b.serviceDate.getTime())));
    const createdAt = new Date(Math.min(...g.items.map((b) => b.createdAt.getTime())));
    const updatedAt = new Date(Math.max(...g.items.map((b) => b.updatedAt.getTime())));
    const created = await prisma.order.create({
      data: {
        orderNumber: `ORD-${String(1000 + ordIdx)}`,
        userId: g.userId,
        status,
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

  // ── Целевые заказы по статусам жизненного цикла (для виджетов Order Center) ──
  const bookingStatusFor = (s: OrderStatusValue): BookingStatusValue => {
    if (s === "COMPLETED" || s === "ARCHIVED") return "COMPLETED";
    if (s === "REFUNDED" || s === "CANCELLED") return "REFUNDED";
    if (s === "PAID" || s === "DOCUMENT_PREP" || s === "READY") return "PAID";
    if (s === "PARTIALLY_PAID") return "PAID";
    if (s === "AWAITING_PAYMENT") return "CONFIRMED";
    return "PENDING";
  };
  const orderTargets: Array<{
    count: number;
    status: OrderStatusValue;
    createdAgoHours: [number, number];
    serviceDateInDays: [number, number];
  }> = [
    { count: 4, status: "DRAFT", createdAgoHours: [2, 24], serviceDateInDays: [20, 60] },
    { count: 5, status: "CREATED", createdAgoHours: [6, 48], serviceDateInDays: [10, 45] },
    { count: 5, status: "PROCESSING", createdAgoHours: [12, 72], serviceDateInDays: [5, 40] },
    { count: 5, status: "AWAITING_CONFIRMATION", createdAgoHours: [4, 36], serviceDateInDays: [3, 30] },
    { count: 5, status: "CONFIRMED", createdAgoHours: [24, 96], serviceDateInDays: [7, 45] },
    { count: 6, status: "AWAITING_PAYMENT", createdAgoHours: [12, 60], serviceDateInDays: [5, 35] },
    { count: 4, status: "PARTIALLY_PAID", createdAgoHours: [48, 120], serviceDateInDays: [10, 50] },
    { count: 5, status: "PAID", createdAgoHours: [6, 72], serviceDateInDays: [2, 30] },
    { count: 4, status: "DOCUMENT_PREP", createdAgoHours: [72, 160], serviceDateInDays: [5, 25] },
    { count: 4, status: "READY", createdAgoHours: [96, 200], serviceDateInDays: [1, 14] },
    { count: 5, status: "COMPLETED", createdAgoHours: [240, 720], serviceDateInDays: [-30, -1] },
    { count: 3, status: "CHANGED", createdAgoHours: [48, 144], serviceDateInDays: [10, 40] },
    { count: 4, status: "REFUNDED", createdAgoHours: [120, 400], serviceDateInDays: [-20, -2] },
    { count: 4, status: "CANCELLED", createdAgoHours: [60, 300], serviceDateInDays: [5, 30] },
    { count: 4, status: "OVERDUE", createdAgoHours: [120, 500], serviceDateInDays: [2, 20] },
    { count: 3, status: "ARCHIVED", createdAgoHours: [700, 1500], serviceDateInDays: [-90, -10] },
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
        ["PAID", "PARTIALLY_PAID", "DOCUMENT_PREP", "READY", "COMPLETED"].includes(t.status)
          ? t.status === "PARTIALLY_PAID"
            ? Math.round(amount * 0.5 * 100) / 100
            : amount
          : 0;
      ordIdx++;
      const created = await prisma.order.create({
        data: {
          orderNumber: `ORD-${String(1000 + ordIdx)}`,
          userId: buyer.id,
          status: t.status,
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
            to: "PENDING",
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

  // ── Журнал изменений заказов и переписка по заказам (Гл. 6.9) ──
  // Шаги жизненного цикла для каждого статуса: history (action/from/to/comment)
  // и системные сообщения чата совпадают по времени, чтобы хронологии сходились.
  type OrderStep = { action: string; from: string | null; to: string; comment: string; text: string; f: number };
  const ORDER_STEPS: Record<string, OrderStep[]> = {
    DRAFT: [{ action: "created", from: null, to: "DRAFT", comment: "Заказ создан как черновик", text: "Заказ создан как черновик", f: 0 }],
    CREATED: [{ action: "created", from: null, to: "CREATED", comment: "Заказ создан", text: "Заказ создан и передан в работу", f: 0 }],
    PROCESSING: [
      { action: "created", from: null, to: "CREATED", comment: "Заказ создан", text: "Заказ создан и передан в работу", f: 0 },
      { action: "process", from: "CREATED", to: "PROCESSING", comment: "Заказ принят в обработку", text: "Заказ принят в обработку", f: 0.3 },
    ],
    AWAITING_CONFIRMATION: [
      { action: "created", from: null, to: "AWAITING_CONFIRMATION", comment: "Заказ создан", text: "Заказ создан и ожидает подтверждения", f: 0 },
    ],
    CONFIRMED: [
      { action: "created", from: null, to: "AWAITING_CONFIRMATION", comment: "Заказ создан", text: "Заказ создан и ожидает подтверждения", f: 0 },
      { action: "confirm", from: "AWAITING_CONFIRMATION", to: "CONFIRMED", comment: "Заказ подтверждён", text: "Заказ подтверждён ✅", f: 0.4 },
    ],
    AWAITING_PAYMENT: [
      { action: "created", from: null, to: "AWAITING_CONFIRMATION", comment: "Заказ создан", text: "Заказ создан и ожидает подтверждения", f: 0 },
      { action: "confirm", from: "AWAITING_CONFIRMATION", to: "CONFIRMED", comment: "Заказ подтверждён", text: "Заказ подтверждён ✅", f: 0.4 },
      { action: "pay_request", from: "CONFIRMED", to: "AWAITING_PAYMENT", comment: "Выставлен счёт на оплату", text: "Ожидается оплата заказа", f: 0.5 },
    ],
    PARTIALLY_PAID: [
      { action: "created", from: null, to: "AWAITING_CONFIRMATION", comment: "Заказ создан", text: "Заказ создан и ожидает подтверждения", f: 0 },
      { action: "confirm", from: "AWAITING_CONFIRMATION", to: "CONFIRMED", comment: "Заказ подтверждён", text: "Заказ подтверждён ✅", f: 0.4 },
      { action: "pay", from: "CONFIRMED", to: "PARTIALLY_PAID", comment: "Частичная оплата получена", text: "Частичная оплата получена 💳", f: 0.55 },
    ],
    PAID: [
      { action: "created", from: null, to: "AWAITING_CONFIRMATION", comment: "Заказ создан", text: "Заказ создан и ожидает подтверждения", f: 0 },
      { action: "confirm", from: "AWAITING_CONFIRMATION", to: "CONFIRMED", comment: "Заказ подтверждён", text: "Заказ подтверждён ✅", f: 0.4 },
      { action: "pay", from: "CONFIRMED", to: "PAID", comment: "Заказ оплачен", text: "Заказ оплачен 💳", f: 0.6 },
    ],
    DOCUMENT_PREP: [
      { action: "created", from: null, to: "AWAITING_CONFIRMATION", comment: "Заказ создан", text: "Заказ создан и ожидает подтверждения", f: 0 },
      { action: "confirm", from: "AWAITING_CONFIRMATION", to: "CONFIRMED", comment: "Заказ подтверждён", text: "Заказ подтверждён ✅", f: 0.4 },
      { action: "pay", from: "CONFIRMED", to: "PAID", comment: "Заказ оплачен", text: "Заказ оплачен 💳", f: 0.6 },
      { action: "docs", from: "PAID", to: "DOCUMENT_PREP", comment: "Готовятся документы", text: "Готовятся документы 📄", f: 0.7 },
    ],
    READY: [
      { action: "created", from: null, to: "AWAITING_CONFIRMATION", comment: "Заказ создан", text: "Заказ создан и ожидает подтверждения", f: 0 },
      { action: "confirm", from: "AWAITING_CONFIRMATION", to: "CONFIRMED", comment: "Заказ подтверждён", text: "Заказ подтверждён ✅", f: 0.4 },
      { action: "pay", from: "CONFIRMED", to: "PAID", comment: "Заказ оплачен", text: "Заказ оплачен 💳", f: 0.6 },
      { action: "docs", from: "PAID", to: "DOCUMENT_PREP", comment: "Готовятся документы", text: "Готовятся документы 📄", f: 0.7 },
      { action: "ready", from: "DOCUMENT_PREP", to: "READY", comment: "Заказ готов к поездке", text: "Заказ готов к поездке 🎒", f: 0.8 },
    ],
    COMPLETED: [
      { action: "created", from: null, to: "AWAITING_CONFIRMATION", comment: "Заказ создан", text: "Заказ создан и ожидает подтверждения", f: 0 },
      { action: "confirm", from: "AWAITING_CONFIRMATION", to: "CONFIRMED", comment: "Заказ подтверждён", text: "Заказ подтверждён ✅", f: 0.4 },
      { action: "pay", from: "CONFIRMED", to: "PAID", comment: "Заказ оплачен", text: "Заказ оплачен 💳", f: 0.6 },
      { action: "complete", from: "PAID", to: "COMPLETED", comment: "Заказ завершён", text: "Заказ завершён 🎉", f: 0.9 },
    ],
    CHANGED: [
      { action: "created", from: null, to: "CREATED", comment: "Заказ создан", text: "Заказ создан", f: 0 },
      { action: "update", from: "CREATED", to: "CHANGED", comment: "Заказ изменён менеджером", text: "Заказ изменён менеджером ✏️", f: 0.5 },
    ],
    REFUNDED: [
      { action: "created", from: null, to: "AWAITING_CONFIRMATION", comment: "Заказ создан", text: "Заказ создан и ожидает подтверждения", f: 0 },
      { action: "confirm", from: "AWAITING_CONFIRMATION", to: "CONFIRMED", comment: "Заказ подтверждён", text: "Заказ подтверждён ✅", f: 0.4 },
      { action: "pay", from: "CONFIRMED", to: "PAID", comment: "Заказ оплачен", text: "Заказ оплачен 💳", f: 0.6 },
      { action: "refund", from: "PAID", to: "REFUNDED", comment: "Оформлен возврат", text: "Оформлен возврат ↩️", f: 0.75 },
    ],
    CANCELLED: [
      { action: "created", from: null, to: "CREATED", comment: "Заказ создан", text: "Заказ создан", f: 0 },
      { action: "cancel", from: "CREATED", to: "CANCELLED", comment: "Заказ отменён", text: "Заказ отменён ❌", f: 0.5 },
    ],
    OVERDUE: [
      { action: "created", from: null, to: "AWAITING_CONFIRMATION", comment: "Заказ создан", text: "Заказ создан и ожидает подтверждения", f: 0 },
      { action: "confirm", from: "AWAITING_CONFIRMATION", to: "CONFIRMED", comment: "Заказ подтверждён", text: "Заказ подтверждён ✅", f: 0.4 },
      { action: "pay_request", from: "CONFIRMED", to: "AWAITING_PAYMENT", comment: "Выставлен счёт на оплату", text: "Ожидается оплата заказа", f: 0.5 },
      { action: "overdue", from: "AWAITING_PAYMENT", to: "OVERDUE", comment: "Заказ просрочен", text: "Заказ просрочен — требуется действие ⏰", f: 0.7 },
    ],
    ARCHIVED: [
      { action: "created", from: null, to: "CREATED", comment: "Заказ создан", text: "Заказ создан", f: 0 },
      { action: "complete", from: "CREATED", to: "COMPLETED", comment: "Заказ завершён", text: "Заказ завершён 🎉", f: 0.8 },
      { action: "archive", from: "COMPLETED", to: "ARCHIVED", comment: "Заказ архивирован", text: "Заказ архивирован 📦", f: 0.95 },
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
    const steps = ORDER_STEPS[o.status] ?? [{ action: "created", from: null, to: "CREATED", comment: "Заказ создан", text: "Заказ создан", f: 0 }];
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
    const terminal = ["COMPLETED", "REFUNDED", "CANCELLED", "ARCHIVED"].includes(o.status);
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
    if (o.status !== "DRAFT" && o.status !== "ARCHIVED") {
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
    bookingHistory: await prisma.bookingHistory.count(),
    bookingMessages: await prisma.bookingMessage.count(),
    orders: await prisma.order.count(),
    orderHistory: await prisma.orderHistory.count(),
    orderMessages: await prisma.orderMessage.count(),
  };
  console.log("Seed completed:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
