/**
 * Единый реестр отелей (Этап B каталога фотографий).
 *
 *   cd backend && npx tsx scripts/hotel-registry.ts [--build] [--json-only] [--include-geolink-only]
 *
 * Что делает:
 *  1. Собирает supplier-native идентификаторы отелей из products
 *     (attributes.supplierCode + attributes.hotelKey) — это то, что реально
 *     показывается на сайте.
 *  2. Обогащает их из geo."SupplierGeoLink" (kind=HOTEL: label, geoCountryId/
 *     geoCityId/geoResortId) и geo.GeoCountry/GeoCity/GeoResort (имена и код).
 *  3. Группирует по (normalizedName, countryCode, cityName) → ОДНА запись
 *     catalog."Hotel" на физическую гостиницу, вне зависимости от того, в туре
 *     она, в услуге «Отели» или у другого поставщика.
 *  4. Пишет catalog."Hotel" + catalog."HotelSupplierRef" (upsert — повторный
 *     запуск не создаёт дубликатов) и отчёты в backend/data/hotels/.
 *
 * Фотографии сюда НЕ качаются (см. scripts/hotel-photo-catalog.ts).
 */
import * as fs from "fs";
import * as path from "path";
import {
  cleanHotelName,
  groupHotelRefs,
  normalizeName,
  parseStars,
  type HotelGroup,
  type HotelRef,
} from "../src/modules/catalog/hotel/hotel-identity";

const DATA_DIR = path.resolve(__dirname, "../data/hotels");

interface RawRef {
  supplierCode: string;
  externalKey: string;
  rawName: string;
  country: string;
  countryCode: string;
  city: string;
  resort: string;
  hotelHref: string;
  star: string;
  hotelInc: string;
}

type BuiltRef = HotelRef;

function parseArgs(): {
  jsonOnly: boolean;
  includeGeolinkOnly: boolean;
} {
  const args = process.argv.slice(2);
  return {
    jsonOnly: args.includes("--json-only"),
    includeGeolinkOnly: args.includes("--include-geolink-only"),
  };
}

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.resolve(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/i);
      if (m && m[1] === "DATABASE_URL" && !process.env.DATABASE_URL) {
        process.env.DATABASE_URL = m[2];
      }
    }
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("DATABASE_URL is not set (backend/.env)");
  return url;
}

function pickName(names: unknown): string {
  if (!names || typeof names !== "object") return "";
  const n = names as Record<string, unknown>;
  for (const lang of ["en", "ru", "az"]) {
    const v = n[lang];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

async function main(): Promise<void> {
  const { jsonOnly, includeGeolinkOnly } = parseArgs();
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString: databaseUrl() });
  const prisma = new PrismaClient({ adapter });

  try {
    // --- исходные данные -------------------------------------------------
    const productRows = await prisma.$queryRaw<
      Array<{
        supplierCode: string;
        hotelKey: string;
        name: string | null;
        country: string | null;
        countryCode: string | null;
        city: string | null;
        resort: string | null;
        hotelHref: string | null;
        hotelInc: string | null;
      }>
    >`
      SELECT
        COALESCE(attributes->>'supplierCode', '')            AS "supplierCode",
        COALESCE(attributes->>'hotelKey', '')                AS "hotelKey",
        COALESCE(attributes->>'hotelName', attributes->>'hotel') AS "name",
        attributes->>'country'                                AS "country",
        attributes->>'countryCode'                            AS "countryCode",
        attributes->>'city'                                   AS "city",
        attributes->>'resort'                                 AS "resort",
        attributes->>'hotelHref'                              AS "hotelHref",
        attributes->>'hotelInc'                               AS "hotelInc"
      FROM catalog."Product"
      WHERE jsonb_exists(attributes, 'hotelKey')
        AND COALESCE(attributes->>'hotelKey', '') <> ''
        AND COALESCE(attributes->>'supplierCode', '') <> ''
    `;

    const geolinkRows = await prisma.$queryRaw<
      Array<{
        supplierCode: string;
        externalId: string;
        label: string | null;
        geoCountryId: string | null;
        geoCityId: string | null;
        geoResortId: string | null;
      }>
    >`
      SELECT "supplierCode", "externalId", "label", "geoCountryId", "geoCityId", "geoResortId"
      FROM geo."SupplierGeoLink" WHERE kind = 'HOTEL'
    `;

    const countries = await prisma.$queryRaw<Array<{ id: string; code: string; names: unknown }>>`
      SELECT id, code, names FROM geo."GeoCountry"
    `;
    const cities = await prisma.$queryRaw<Array<{ id: string; names: unknown }>>`
      SELECT id, names FROM geo."GeoCity"
    `;
    const resorts = await prisma.$queryRaw<Array<{ id: string; names: unknown }>>`
      SELECT id, names FROM geo."GeoResort"
    `;

    const countryById = new Map(countries.map((c) => [c.id, c]));
    const cityById = new Map(cities.map((c) => [c.id, c]));
    const resortById = new Map(resorts.map((r) => [r.id, r]));
    const geolinkByKey = new Map<string, (typeof geolinkRows)[number]>();
    for (const g of geolinkRows) geolinkByKey.set(`${g.supplierCode}\u0000${g.externalId}`, g);

    // --- построение ref-ов ------------------------------------------------
    const refsByKey = new Map<string, BuiltRef>();
    const noName: string[] = [];

    const buildRef = (supplierCode: string, externalKey: string, raw: Partial<RawRef>): BuiltRef => {
      const geo = geolinkByKey.get(`${supplierCode}\u0000${externalKey}`);
      const geoCountry = geo?.geoCountryId ? countryById.get(geo.geoCountryId) : undefined;
      const geoCity = geo?.geoCityId ? cityById.get(geo.geoCityId) : undefined;
      const geoResort = geo?.geoResortId ? resortById.get(geo.geoResortId) : undefined;

      const rawName = (raw.rawName ?? "").trim() || (geo?.label ?? "").trim();
      const name = cleanHotelName(rawName);
      const stars = parseStars(raw.rawName ?? "") ?? parseStars(geo?.label ?? "");
      const countryCode = (raw.countryCode ?? "").trim().toUpperCase() || (geoCountry?.code ?? "").toUpperCase();
      const countryName = (raw.country ?? "").trim() || pickName(geoCountry?.names);
      // Город: атрибут продукта → «(Город)» из названия → geo-справочник.
      const parenCity = /\(([^()]*)\)\s*(?:\d\s*\*+\s*)?$/.exec((raw.rawName ?? "").replace(/\s+/g, " ").trim())?.[1] ?? "";
      const cityName = (raw.city ?? "").trim() || parenCity.trim() || pickName(geoCity?.names);
      const resortName = (raw.resort ?? "").trim() || pickName(geoResort?.names);

      return {
        supplierCode,
        externalKey,
        name,
        normalizedName: normalizeName(name),
        stars,
        countryCode,
        countryName,
        cityName,
        cityKey: normalizeName(cityName),
        resortName,
        hotelHref: (raw.hotelHref ?? "").trim(),
        source: "product",
      };
    };

    const seen = new Set<string>();
    for (const row of productRows) {
      const key = `${row.supplierCode}\u0000${row.hotelKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const ref = buildRef(row.supplierCode, row.hotelKey, {
        rawName: row.name ?? "",
        country: row.country ?? "",
        countryCode: row.countryCode ?? "",
        city: row.city ?? "",
        resort: row.resort ?? "",
        hotelHref: row.hotelHref ?? "",
      });
      if (!ref.normalizedName) {
        noName.push(`${row.supplierCode}:${row.hotelKey} "${(row.name ?? "").slice(0, 60)}"`);
        continue;
      }
      refsByKey.set(key, ref);
    }

    if (includeGeolinkOnly) {
      for (const g of geolinkRows) {
        const key = `${g.supplierCode}\u0000${g.externalId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const ref = buildRef(g.supplierCode, g.externalId, { rawName: g.label ?? "" });
        ref.source = "geolink";
        if (!ref.normalizedName) continue;
        refsByKey.set(key, ref);
      }
    }

    // --- группировка в физические гостиницы ------------------------------
    const groupList = groupHotelRefs([...refsByKey.values()]);

    // --- отчёт о склейках (для ручной проверки) ---------------------------
    const refLabel = (r: BuiltRef): string =>
      `${r.supplierCode}:${r.externalKey}${r.stars != null ? `(${r.stars}*)` : ""}`;
    const mergedAcrossSuppliers = groupList
      .filter((g) => new Set(g.refs.map((r) => r.supplierCode)).size > 1)
      .map((g) => ({
        hotel: g.name,
        country: g.countryCode,
        city: g.cityName,
        refs: g.refs.map(refLabel),
      }));
    const mergedWithinSupplier = groupList
      .filter((g) => {
        const bySupplier = new Map<string, Set<string>>();
        for (const r of g.refs) {
          if (!bySupplier.has(r.supplierCode)) bySupplier.set(r.supplierCode, new Set());
          bySupplier.get(r.supplierCode)!.add(r.externalKey);
        }
        return [...bySupplier.values()].some((s) => s.size > 1);
      })
      .map((g) => ({
        hotel: g.name,
        country: g.countryCode,
        city: g.cityName,
        refs: g.refs.map(refLabel),
      }));
    // Группы, где у ref-ов РАЗНАЯ звёздность: склейка name+country+city рискует
    // соединить «X 4*» и «X 5*». Выносим отдельно для ручного решения.
    const starConflicts = groupList
      .filter((g) => new Set(g.refs.map((r) => r.stars ?? -1)).size > 1)
      .map((g) => ({
        hotel: g.name,
        country: g.countryCode,
        city: g.cityName,
        refs: g.refs.map(refLabel),
      }));

    const summary = {
      generatedAt: new Date().toISOString(),
      suppliers: [...new Set(groupList.flatMap((g) => g.refs.map((r) => r.supplierCode)))].sort(),
      refs: refsByKey.size,
      hotels: groupList.length,
      mergedAcrossSuppliers: mergedAcrossSuppliers.length,
      mergedWithinSupplier: mergedWithinSupplier.length,
      starConflicts: starConflicts.length,
      refsWithoutName: noName.length,
    };

    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(DATA_DIR, "hotel-registry.json"),
      JSON.stringify({ summary, hotels: groupList.map((g) => ({
        name: g.name, countryCode: g.countryCode, cityName: g.cityName, stars: g.stars,
        refs: g.refs.map((r) => `${r.supplierCode}:${r.externalKey}`),
      })) }, null, 2),
      "utf8",
    );
    fs.writeFileSync(
      path.join(DATA_DIR, "hotel-ambiguous.json"),
      JSON.stringify({ mergedAcrossSuppliers, mergedWithinSupplier, starConflicts, refsWithoutName: noName }, null, 2),
      "utf8",
    );

    if (jsonOnly) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    // --- запись в БД (идемпотентно) ---------------------------------------
    const dbExisting = await prisma.hotel.findMany({
      select: { id: true, normalizedName: true, countryCode: true, cityName: true },
    });
    const hotelIdByKey = new Map(
      dbExisting.map((h) => [`${h.normalizedName}|${h.countryCode}|${h.cityName}`, h.id]),
    );

    let hotelsCreated = 0;
    let hotelsUpdated = 0;
    for (const g of groupList) {
      // Уникальный индекс — на (normalizedName, countryCode, cityName). cityKey
      // в ключе группы нормализован, но в БД хранится отображаемое cityName,
      // поэтому ищем и по нормализованному, и по сохранённому варианту.
      const lookupKey = `${g.normalizedName}|${g.countryCode}|${g.cityName}`;
      let hotelId = hotelIdByKey.get(lookupKey);
      if (!hotelId) {
        const created = await prisma.hotel.upsert({
          where: {
            normalizedName_countryCode_cityName: {
              normalizedName: g.normalizedName,
              countryCode: g.countryCode,
              cityName: g.cityName,
            },
          },
          create: {
            name: g.name,
            normalizedName: g.normalizedName,
            stars: g.stars,
            countryCode: g.countryCode,
            countryName: g.countryName,
            cityName: g.cityName,
            resortName: g.resortName,
          },
          update: {},
          select: { id: true },
        });
        hotelId = created.id;
        hotelIdByKey.set(lookupKey, hotelId);
        hotelsCreated += 1;
      } else {
        hotelsUpdated += 1;
      }

      for (const ref of g.refs) {
        await prisma.hotelSupplierRef.upsert({
          where: {
            supplierCode_externalKey: {
              supplierCode: ref.supplierCode,
              externalKey: ref.externalKey,
            },
          },
          create: {
            hotelId,
            supplierCode: ref.supplierCode,
            externalKey: ref.externalKey,
            name: ref.name,
            countryCode: ref.countryCode,
            cityName: ref.cityName,
            resortName: ref.resortName,
            stars: ref.stars,
            hotelHref: ref.hotelHref || null,
            source: ref.source,
          },
          update: {
            hotelId,
            name: ref.name,
            countryCode: ref.countryCode,
            cityName: ref.cityName,
            resortName: ref.resortName,
            stars: ref.stars,
            hotelHref: ref.hotelHref || null,
            lastSeenAt: new Date(),
          },
        });
      }
    }

    console.log(JSON.stringify({ ...summary, hotelsCreated, hotelsUpdated }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
