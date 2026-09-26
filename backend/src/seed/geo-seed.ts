/* eslint-disable no-console */
/**
 * Master Geography seed (Phase 6).
 *
 * Canonical base = catalog seller reference (COUNTRY_NAMES/CITY_REF) —
 * single source of truth, no duplication — plus airports/resorts/cities
 * that the reference does not cover yet.
 *
 * Idempotent: upsert by unique code at every level; safe to re-run, never
 * creates duplicates, never deletes admin data (only adds/updates names).
 *
 * Run: npm run seed:geo
 */
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  CITY_REF,
  COUNTRY_NAMES,
} from "../modules/catalog/seller/locations";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

interface ExtraCity {
  code: string;
  countryCode: string;
  ru: string;
  en: string;
  az: string;
}

const EXTRA_CITIES: ExtraCity[] = [
  { code: "NAKHCHIVAN", countryCode: "AZ", ru: "Нахчыван", en: "Nakhchivan", az: "Naxçıvan" },
  { code: "GABALA", countryCode: "AZ", ru: "Габала", en: "Gabala", az: "Qəbələ" },
];

interface ExtraResort extends ExtraCity {
  cityCode: string;
}

const EXTRA_RESORTS: ExtraResort[] = [
  { code: "BELEK", countryCode: "TR", cityCode: "ANTALYA", ru: "Белек", en: "Belek", az: "Belek" },
  { code: "KEMER", countryCode: "TR", cityCode: "ANTALYA", ru: "Кемер", az: "Kemer", en: "Kemer" },
];

interface ExtraAirport {
  code: string;
  cityCode: string;
  ru: string;
  en: string;
  az: string;
  timeZone?: string;
}

const EXTRA_AIRPORTS: ExtraAirport[] = [
  { code: "GYD", cityCode: "BAKU", ru: "Международный аэропорт Гейдар Алиев", en: "Heydar Aliyev International Airport", az: "Heydər Əliyev adına Beynəlxalq Hava Limanı", timeZone: "Asia/Baku" },
  { code: "IST", cityCode: "ISTANBUL", ru: "Аэропорт Стамбул", en: "Istanbul Airport", az: "İstanbul Hava Limanı", timeZone: "Europe/Istanbul" },
  { code: "SAW", cityCode: "ISTANBUL", ru: "Аэропорт Сабиха Гёкчен", en: "Sabiha Gokcen International Airport", az: "Sabiha Gökçen Beynəlxalq Hava Limanı", timeZone: "Europe/Istanbul" },
  { code: "AYT", cityCode: "ANTALYA", ru: "Аэропорт Анталья", en: "Antalya Airport", az: "Antalya Hava Limanı", timeZone: "Europe/Istanbul" },
  { code: "TBS", cityCode: "TBILISI", ru: "Международный аэропорт Тбилиси", en: "Tbilisi International Airport", az: "Tbilisi Beynəlxalq Hava Limanı", timeZone: "Asia/Tbilisi" },
  { code: "BUS", cityCode: "BATUMI", ru: "Аэропорт Батуми", en: "Batumi International Airport", az: "Batumi Beynəlxalq Hava Limanı", timeZone: "Asia/Tbilisi" },
  { code: "DXB", cityCode: "DUBAI", ru: "Международный аэропорт Дубай", en: "Dubai International Airport", az: "Dubay Beynəlxalq Hava Limanı", timeZone: "Asia/Dubai" },
  { code: "LHR", cityCode: "LONDON", ru: "Аэропорт Хитроу", en: "London Heathrow Airport", az: "Hitrou Hava Limanı", timeZone: "Europe/London" },
  { code: "CDG", cityCode: "PARIS", ru: "Аэропорт Шарль-де-Голль", en: "Paris Charles de Gaulle Airport", az: "Şarl de Qoll Hava Limanı", timeZone: "Europe/Paris" },
  { code: "BER", cityCode: "BERLIN", ru: "Аэропорт Берлин-Бранденбург", en: "Berlin Brandenburg Airport", az: "Berlin-Brandenburq Hava Limanı", timeZone: "Europe/Berlin" },
  { code: "DME", cityCode: "MOSCOW", ru: "Аэропорт Домодедово", en: "Domodedovo International Airport", az: "Domodedovo Beynəlxalq Hava Limanı", timeZone: "Europe/Moscow" },
  { code: "LED", cityCode: "SAINT_PETERSBURG", ru: "Аэропорт Пулково", en: "Pulkovo Airport", az: "Pulkovo Hava Limanı", timeZone: "Europe/Moscow" },
  { code: "KVD", cityCode: "GANJA", ru: "Международный аэропорт Гянджа", en: "Ganja International Airport", az: "Gəncə Beynəlxalq Hava Limanı", timeZone: "Asia/Baku" },
  { code: "GNJ", cityCode: "GANJA", ru: "Аэропорт Гянджа", en: "Ganja Airport", az: "Gəncə Hava Limanı", timeZone: "Asia/Baku" },
  { code: "NAJ", cityCode: "NAKHCHIVAN", ru: "Международный аэропорт Нахчыван", en: "Nakhchivan International Airport", az: "Naxçıvan Beynəlxalq Hava Limanı", timeZone: "Asia/Baku" },
];

async function main(): Promise<void> {
  let countries = 0;
  for (const [code, names] of Object.entries(COUNTRY_NAMES)) {
    await prisma.geoCountry.upsert({
      where: { code },
      create: { code, names: { ru: names.ru, en: names.en, az: names.az } },
      update: { names: { ru: names.ru, en: names.en, az: names.az } },
    });
    countries += 1;
  }

  const countryIdByCode = new Map<string, string>();
  for (const c of await prisma.geoCountry.findMany({ select: { id: true, code: true } })) {
    countryIdByCode.set(c.code, c.id);
  }

  let cities = 0;
  const upsertCity = async (
    code: string,
    countryCode: string,
    names: { ru: string; en: string; az: string },
  ): Promise<string> => {
    const countryId = countryIdByCode.get(countryCode);
    if (!countryId) throw new Error(`seed: unknown country ${countryCode} for city ${code}`);
    const city = await prisma.geoCity.upsert({
      where: { code },
      create: { code, countryId, names },
      update: { names },
    });
    cities += 1;
    return city.id;
  };

  const cityIdByCode = new Map<string, string>();
  for (const [code, ref] of Object.entries(CITY_REF)) {
    cityIdByCode.set(
      code,
      await upsertCity(code, ref.countryCode, { ru: ref.ru, en: ref.en, az: ref.az }),
    );
  }
  for (const extra of EXTRA_CITIES) {
    cityIdByCode.set(
      extra.code,
      await upsertCity(extra.code, extra.countryCode, { ru: extra.ru, en: extra.en, az: extra.az }),
    );
  }

  let resorts = 0;
  for (const resort of EXTRA_RESORTS) {
    const cityId = cityIdByCode.get(resort.cityCode);
    if (!cityId) throw new Error(`seed: unknown city ${resort.cityCode} for resort ${resort.code}`);
    await prisma.geoResort.upsert({
      where: { code: resort.code },
      create: {
        code: resort.code,
        cityId,
        names: { ru: resort.ru, en: resort.en, az: resort.az },
      },
      update: { names: { ru: resort.ru, en: resort.en, az: resort.az } },
    });
    resorts += 1;
  }

  let airports = 0;
  for (const airport of EXTRA_AIRPORTS) {
    const cityId = cityIdByCode.get(airport.cityCode);
    if (!cityId) throw new Error(`seed: unknown city ${airport.cityCode} for airport ${airport.code}`);
    await prisma.geoAirport.upsert({
      where: { code: airport.code },
      create: {
        code: airport.code,
        cityId,
        names: { ru: airport.ru, en: airport.en, az: airport.az },
        timeZone: airport.timeZone ?? null,
      },
      update: {
        names: { ru: airport.ru, en: airport.en, az: airport.az },
        timeZone: airport.timeZone ?? null,
      },
    });
    airports += 1;
  }

  console.log(
    `geo-seed done: countries=${countries} cities=${cities} resorts=${resorts} airports=${airports}`,
  );
}

main()
  .catch((e) => {
    console.error(`geo-seed FAILED: ${(e as Error).message}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
