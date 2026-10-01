/* eslint-disable no-console */
/**
 * Hotel reference directory seed (Справочники → Отели).
 *
 * Canonical classifications: hotel categories (stars), room types,
 * placement (occupancy) types, meal types.
 *
 * Idempotent: upsert by unique code; safe to re-run, never duplicates,
 * never deletes admin data (only adds/updates names).
 *
 * Run: npm run seed:hotel-directory
 */
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

interface Entry {
  code: string;
  ru: string;
  en: string;
  az: string;
}

const CATEGORIES: Entry[] = [
  { code: "1*", ru: "1 звезда", en: "1 star", az: "1 ulduz" },
  { code: "2*", ru: "2 звезды", en: "2 stars", az: "2 ulduz" },
  { code: "3*", ru: "3 звезды", en: "3 stars", az: "3 ulduz" },
  { code: "4*", ru: "4 звезды", en: "4 stars", az: "4 ulduz" },
  { code: "5*", ru: "5 звёзд", en: "5 stars", az: "5 ulduz" },
  { code: "HV-1", ru: "Holiday Village 1 категории", en: "Holiday Village category 1", az: "1-ci kateqoriya Holiday Village" },
  { code: "HV-2", ru: "Holiday Village 2 категории", en: "Holiday Village category 2", az: "2-ci kateqoriya Holiday Village" },
];

const ROOM_TYPES: Entry[] = [
  { code: "STD", ru: "Стандарт", en: "Standard", az: "Standart" },
  { code: "SUPERIOR", ru: "Улучшенный", en: "Superior", az: "Superior" },
  { code: "DELUXE", ru: "Делюкс", en: "Deluxe", az: "Deluxe" },
  { code: "JUNIOR_SUITE", ru: "Полулюкс", en: "Junior Suite", az: "Junior Suite" },
  { code: "SUITE", ru: "Люкс", en: "Suite", az: "Suite" },
  { code: "FAMILY", ru: "Семейный", en: "Family", az: "Ailə" },
  { code: "VILLA", ru: "Вилла", en: "Villa", az: "Villa" },
];

const PLACEMENT_TYPES: Entry[] = [
  { code: "SNGL", ru: "Одноместное", en: "Single", az: "Tək nəfərlik" },
  { code: "DBL", ru: "Двухместное", en: "Double", az: "İki nəfərlik" },
  { code: "TWIN", ru: "Двухспальное", en: "Twin", az: "Twin" },
  { code: "TRPL", ru: "Трёхместное", en: "Triple", az: "Üç nəfərlik" },
  { code: "QDPL", ru: "Четырёхместное", en: "Quadruple", az: "Dörd nəfərlik" },
];

const MEAL_TYPES: Entry[] = [
  { code: "RO", ru: "Без питания", en: "Room only", az: "Qidalanmasız" },
  { code: "BB", ru: "Завтрак", en: "Bed and breakfast", az: "Səhər yeməyi" },
  { code: "HB", ru: "Полупансион", en: "Half board", az: "Yarım pansion" },
  { code: "FB", ru: "Полный пансион", en: "Full board", az: "Tam pansion" },
  { code: "AI", ru: "Всё включено", en: "All inclusive", az: "Hər şey daxil" },
  { code: "UAI", ru: "Ультра всё включено", en: "Ultra all inclusive", az: "Ultra hər şey daxil" },
];

const VIEW_TYPES: Entry[] = [
  { code: "STANDARD", ru: "Без вида", en: "No view", az: "Mənzərəsiz" },
  { code: "SEA", ru: "На море", en: "Sea view", az: "Dəniz mənzərəsi" },
  { code: "CITY", ru: "На город", en: "City view", az: "Şəhər mənzərəsi" },
  { code: "POOL", ru: "На бассейн", en: "Pool view", az: "Hovuz mənzərəsi" },
  { code: "GARDEN", ru: "На сад", en: "Garden view", az: "Bağ mənzərəsi" },
  { code: "MOUNTAIN", ru: "На горы", en: "Mountain view", az: "Dağ mənzərəsi" },
  { code: "MARINA", ru: "На марину", en: "Marina view", az: "Marina mənzərəsi" },
  { code: "PARKING", ru: "На парковку", en: "Parking view", az: "Parkinq mənzərəsi" },
];

async function seed(
  delegate: "hotelCategory" | "roomType" | "placementType" | "mealType" | "viewType",
  entries: Entry[],
): Promise<number> {
  let n = 0;
  for (const [index, entry] of entries.entries()) {
    await (prisma[delegate] as unknown as {
      upsert: (args: unknown) => Promise<unknown>;
    }).upsert({
      where: { code: entry.code },
      create: {
        code: entry.code,
        names: { ru: entry.ru, en: entry.en, az: entry.az },
        sortOrder: index,
      },
      update: {
        names: { ru: entry.ru, en: entry.en, az: entry.az },
        sortOrder: index,
      },
    });
    n += 1;
  }
  return n;
}

async function main(): Promise<void> {
  const categories = await seed("hotelCategory", CATEGORIES);
  const roomTypes = await seed("roomType", ROOM_TYPES);
  const placements = await seed("placementType", PLACEMENT_TYPES);
  const meals = await seed("mealType", MEAL_TYPES);
  const views = await seed("viewType", VIEW_TYPES);
  console.log(
    `hotel-directory-seed done: categories=${categories} roomTypes=${roomTypes} placements=${placements} meals=${meals} views=${views}`,
  );
}

main()
  .catch((e) => {
    console.error(`hotel-directory-seed FAILED: ${(e as Error).message}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
