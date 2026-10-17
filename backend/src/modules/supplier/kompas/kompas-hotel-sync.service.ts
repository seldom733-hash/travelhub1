/**
 * KOMPAS HOTEL Catalog Sync Service — idempotent import into Product(type=HOTEL).
 *
 * Mirrors the tour KompasSyncService but for the stay-only `search_hotel`:
 *  • per-country search via the shared Playwright machinery
 *    (KompasSupplierAdapter.searchHotelRows, PRICEPAGE pagination);
 *  • rows grouped by hotelKey → ONE Product per hotel (variant A);
 *  • one Tariff per (room, meal) at the minimum AZN price across dates;
 *  • title «Hotel (City, Country)» — hotels DO carry a city (unlike tours).
 *
 * §AZN: prices are requested in AZN (CURRENCY=13), so the number arriving here
 * is already the supplier's AZN amount; SupplierPricingService.publicAmountFor
 * applies the KOMPAS markup and writes the public selling price (no FX step —
 * an AZN source is an identity), exactly like the tour import.
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { IdsService } from "../../../shared/ids.service";
import {
  KompasSupplierAdapter,
  KOMPAS_CURRENCY_INC,
  type KompasHotelRawRow,
} from "./kompas.adapter";
import { SupplierPricingService } from "../../pricing/supplier-pricing.service";
import {
  hotelStateIncToIso,
  hotelStateIncToRu,
  resolveHotelStateInc,
} from "./kompas-hotel-countries";

export interface KompasHotelSyncResult {
  countriesProcessed: number;
  rowsReceived: number;
  uniqueHotels: number;
  newCards: number;
  updatedCards: number;
  unchangedCards: number;
  tariffsCreated: number;
  tariffsUpdated: number;
  errors: string[];
}

export interface KompasHotelSyncOptions {
  /** ISO-2 countries to sync (default: a curated top set). */
  countryIsos?: string[];
  /** Check-in window (YYYY-MM-DD). Default: today → +1 day (2-day range). */
  dateFrom?: string;
  dateTo?: string;
  /** Stay nights (single value). Default 7. */
  nights?: number;
  /** Max PRICEPAGE pages per country (safety cap; stops early when a page is empty). */
  maxPages?: number;
}

/** Curated top countries to import first (high KOMPAS hotel inventory). */
const DEFAULT_COUNTRY_ISOS = ["TR", "AE", "EG", "TH", "MV", "GE"];

/** YYYY-MM-DD → YYYYMMDD (SAMO compact). */
function toCompact(d: string): string {
  return d.replace(/-/g, "").slice(0, 8);
}

/** Parse stars from a hotel name («SIESTA BEACH HOTEL 3*» → 3), else null. */
function parseStars(name: string): number | null {
  const m = /(\d)\s*\*+\s*$/.exec(name || "");
  return m ? Number(m[1]) : null;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function plusDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class KompasHotelSyncService {
  private readonly logger = new Logger(KompasHotelSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kompas: KompasSupplierAdapter,
    private readonly pricing: SupplierPricingService,
    private readonly ids: IdsService,
  ) {}

  async getKompasPartner(): Promise<{ id: string } | null> {
    return this.prisma.partner.findFirst({ where: { name: "KOMPAS" } });
  }

  async runSync(options?: KompasHotelSyncOptions): Promise<KompasHotelSyncResult> {
    const start = Date.now();
    const result: KompasHotelSyncResult = {
      countriesProcessed: 0,
      rowsReceived: 0,
      uniqueHotels: 0,
      newCards: 0,
      updatedCards: 0,
      unchangedCards: 0,
      tariffsCreated: 0,
      tariffsUpdated: 0,
      errors: [],
    };

    const partner = await this.getKompasPartner();
    if (!partner) {
      result.errors.push("KOMPAS partner not found");
      return result;
    }
    const category = await this.prisma.category.findFirst({ where: { slug: "accommodation" } });
    if (!category) {
      result.errors.push("accommodation category not found");
      return result;
    }

    const dateFrom = options?.dateFrom ?? todayIso();
    const dateTo = options?.dateTo ?? plusDaysIso(dateFrom, 1);
    const nights = options?.nights ?? 7;
    const maxPages = options?.maxPages ?? 40;
    const isos = options?.countryIsos?.length ? options.countryIsos : DEFAULT_COUNTRY_ISOS;

    this.logger.log(
      `KOMPAS hotels sync: ${isos.join(",")} ${dateFrom}..${dateTo} ${nights}n maxPages=${maxPages}`,
    );

    for (const iso of isos) {
      const stateInc = resolveHotelStateInc(iso);
      if (!stateInc) {
        result.errors.push(`Country ${iso} not in hotel dictionary`);
        continue;
      }
      try {
        const rows = await this.kompas.searchHotelRows({
          stateInc,
          checkInBeg: toCompact(dateFrom),
          checkInEnd: toCompact(dateTo),
          nightsFrom: nights,
          nightsTo: nights,
          adults: 2,
          children: 0,
          maxPages,
        });
        result.rowsReceived += rows.length;
        const created = await this.upsertCountryHotels(rows, stateInc, iso, partner.id, category.id, result);
        result.countriesProcessed++;
        this.logger.log(
          `KOMPAS hotels [${iso}/${stateInc}]: ${rows.length} rows → ${created} hotels`,
        );
      } catch (err) {
        result.errors.push(`[${iso}]: ${(err as Error).message}`);
        this.logger.warn(`KOMPAS hotels [${iso}] failed: ${(err as Error).message}`);
      }
    }

    this.logger.log(
      `KOMPAS hotels sync done in ${Date.now() - start}ms: ${result.countriesProcessed} countries, ` +
        `${result.rowsReceived} rows, ${result.uniqueHotels} hotels, ${result.newCards} new, ` +
        `${result.updatedCards} updated, ${result.tariffsCreated}+${result.tariffsUpdated} tariffs`,
    );
    return result;
  }

  /** Group a country's rows by hotelKey → upsert one Product + per-(room,meal) Tariffs. */
  private async upsertCountryHotels(
    rows: KompasHotelRawRow[],
    stateInc: string,
    iso: string,
    partnerId: string,
    categoryId: string,
    result: KompasHotelSyncResult,
  ): Promise<number> {
    const byHotel = new Map<string, KompasHotelRawRow[]>();
    for (const r of rows) {
      if (!r.hotelKey || !(r.price > 0)) continue;
      const list = byHotel.get(r.hotelKey);
      if (list) list.push(r);
      else byHotel.set(r.hotelKey, [r]);
    }
    result.uniqueHotels += byHotel.size;

    const iso2 = hotelStateIncToIso(stateInc) ?? iso;
    const countryRu = hotelStateIncToRu(stateInc) ?? iso2;
    let hotels = 0;

    for (const [hotelKey, hotelRows] of byHotel) {
      try {
        await this.upsertHotel(hotelKey, hotelRows, stateInc, iso2, countryRu, partnerId, categoryId, result);
        hotels++;
      } catch (err) {
        result.errors.push(`hotel ${hotelKey}: ${(err as Error).message}`);
      }
    }
    return hotels;
  }

  private async upsertHotel(
    hotelKey: string,
    rows: KompasHotelRawRow[],
    stateInc: string,
    iso2: string,
    countryRu: string,
    partnerId: string,
    categoryId: string,
    result: KompasHotelSyncResult,
  ): Promise<void> {
    const hotelName = rows[0].hotelName || "Unknown Hotel";
    const city = rows.find((r) => r.city)?.city ?? "";
    const hotelHref = rows.find((r) => r.hotelHref)?.hotelHref ?? "";
    const stars = parseStars(hotelName);
    const supplierRef = `KOMPASHTL-${hotelKey}-${stateInc}`;
    // «Hotel (City, Country)» — falls back to «Hotel (Country)» without a city.
    const title = city ? `${hotelName} (${city}, ${countryRu})` : `${hotelName} (${countryRu})`;

    // Group rows by (roomKey, mealKey) → one tariff each, min source amount
    // across dates (source currency = AZN, §AZN CURRENCY=13).
    const tariffGroups = new Map<
      string,
      {
        room: string;
        meal: string;
        roomKey: string;
        mealKey: string;
        minSource: number;
        currency: string;
        checkIns: string[];
      }
    >();
    for (const r of rows) {
      const key = `${r.roomKey || "0"}:${r.mealKey || "0"}`;
      const g = tariffGroups.get(key);
      if (g) {
        if (r.price < g.minSource) g.minSource = r.price;
        if (r.checkIn && !g.checkIns.includes(r.checkIn)) g.checkIns.push(r.checkIn);
      } else {
        tariffGroups.set(key, {
          room: r.room,
          meal: r.meal,
          roomKey: r.roomKey,
          mealKey: r.mealKey,
          minSource: r.price,
          currency: r.currency || KOMPAS_CURRENCY_INC,
          checkIns: r.checkIn ? [r.checkIn] : [],
        });
      }
    }

    // Public AZN price per tariff (markup only — the source is ALREADY AZN,
    // so there is no FX step); startingPrice = min.
    const tariffs: Array<{ code: string; name: string; azn: number; inclusions: Record<string, unknown> }> = [];
    let startingPrice = 0;
    for (const g of tariffGroups.values()) {
      // Currency comes from the rows themselves (never hardcoded) — if the
      // supplier ever answers in another currency, the price is not silently
      // relabelled.
      const azn = await this.pricing.publicAmountFor(g.minSource, g.currency, "KOMPAS", "hotels");
      if (!(azn > 0)) continue;
      const name = [g.room, g.meal].filter(Boolean).join(" / ") || "Base";
      const code = `TRF-KOMH-${hotelKey}-${stateInc}-${g.roomKey || "0"}-${g.mealKey || "0"}`.slice(0, 120);
      tariffs.push({
        code,
        name,
        azn,
        inclusions: {
          room: g.room,
          meal: g.meal,
          roomKey: g.roomKey,
          mealKey: g.mealKey,
          checkIns: g.checkIns.sort(),
        },
      });
      if (!startingPrice || azn < startingPrice) startingPrice = azn;
    }

    const rooms = Array.from(new Set(rows.map((r) => r.room).filter(Boolean)));
    const meals = Array.from(new Set(rows.map((r) => r.meal).filter(Boolean)));
    const attributes = {
      hotelName,
      hotelKey,
      city,
      country: countryRu,
      countryCode: iso2,
      stars,
      hotelHref,
      rooms,
      meals,
      nights: rows[0].nights,
      startingPrice,
      currency: "AZN",
      supplierCode: "KOMPAS",
    };

    const existing = await this.prisma.product.findFirst({ where: { supplierRef } });

    if (existing) {
      const beforeTariffs = tariffs.length;
      await this.prisma.$transaction(async (tx: any) => {
        const patch: Record<string, unknown> = {};
        if (existing.title !== title) patch.title = title;
        const cur = existing.attributes as any;
        if (
          cur?.startingPrice !== startingPrice ||
          cur?.city !== city ||
          cur?.stars !== stars ||
          cur?.hotelName !== hotelName
        ) {
          patch.attributes = { ...cur, ...attributes };
        }
        if (Object.keys(patch).length > 0) {
          await tx.product.update({ where: { id: existing.id }, data: patch });
        }
        const tariffCounts = await this.upsertTariffs(tx, existing.id, tariffs);
        result.tariffsCreated += tariffCounts.created;
        result.tariffsUpdated += tariffCounts.updated;
      });
      void beforeTariffs;
      if (startingPrice > 0 && (existing.attributes as any)?.startingPrice !== startingPrice) {
        result.updatedCards++;
      } else {
        result.unchangedCards++;
      }
      return;
    }

    // New hotel: insert Product + Tariffs + publication channel.
    const slugBase = `kompas-hotel-${iso2.toLowerCase()}-${hotelKey}`;
    await this.prisma.$transaction(async (tx: any) => {
      const prdCode = await this.ids.nextCode(tx, "PRD");
      const inserted = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO "catalog"."Product" (
          "id", "code", "supplierRef", "type", "title", "slug", "status", "version",
          "categoryId", "attributes", "partnerId", "publishedAt", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), ${prdCode}, ${supplierRef}, 'HOTEL'::"catalog"."ProductType",
          ${title}, ${slugBase}, 'PUBLISHED'::"catalog"."ProductStatus", 1,
          ${categoryId}, ${JSON.stringify(attributes)}::jsonb, ${partnerId},
          now(), now(), now()
        )
        RETURNING "id"
      `;
      const productId = inserted[0].id;
      const tariffCounts = await this.upsertTariffs(tx, productId, tariffs);
      result.tariffsCreated += tariffCounts.created;
      result.tariffsUpdated += tariffCounts.updated;
      await tx.$executeRaw`
        INSERT INTO "catalog"."ProductPublicationChannel" ("id", "productId", "channel", "createdAt")
        VALUES (gen_random_uuid(), ${productId}, 'MARKETPLACE'::"catalog"."PublicationChannel", now())
        ON CONFLICT DO NOTHING
      `;
    });
    result.newCards++;
  }

  /** Upsert tariffs by unique code (create missing, refresh price/name/inclusions). */
  private async upsertTariffs(
    tx: any,
    productId: string,
    tariffs: Array<{ code: string; name: string; azn: number; inclusions: Record<string, unknown> }>,
  ): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    for (const t of tariffs) {
      const res = await tx.$queryRaw<{ inserted: boolean }[]>`
        INSERT INTO "catalog"."Tariff" (
          "id", "code", "productId", "name", "price", "currency", "inclusions", "status", "version", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), ${t.code}, ${productId}, ${t.name}, ${t.azn}::decimal, 'AZN',
          ${JSON.stringify(t.inclusions)}::jsonb, 'ACTIVE'::"catalog"."RatePlanStatus", 1, now(), now()
        )
        ON CONFLICT ("code") DO UPDATE SET
          "name" = EXCLUDED."name",
          "price" = EXCLUDED."price",
          "inclusions" = EXCLUDED."inclusions",
          "updatedAt" = now()
        RETURNING (xmax = 0) AS inserted
      `;
      if (res?.[0]?.inserted) created++;
      else updated++;
    }
    return { created, updated };
  }
}
