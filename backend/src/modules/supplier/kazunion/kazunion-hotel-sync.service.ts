/**
 * KazUnion HOTEL Catalog Sync Service — idempotent import into Product(type=HOTEL).
 *
 * Mirrors `KompasHotelSyncService` but drives KazUnion's stay-only
 * `search_hotel` feed (plain HTTP, no browser):
 *  • per-country search via `KazunionHotelAdapter.search()` (PRICEPAGE pagination);
 *  • rows grouped by hotelKey → ONE Product per hotel;
 *  • one Tariff per (room, meal) at the minimum price across dates;
 *  • title «Hotel (City, Country)» — hotel rows carry a city;
 *  • `geoCountryId` resolved per country from the hotel dictionary
 *    (STATEINC → ISO-2 → Master Geography).
 *
 * §AZN: prices are requested in AZN (CURRENCY=10), so the number arriving here
 * is already the supplier's AZN amount; `publicAmountFor` applies the KazUnion
 * markup and writes the public selling price (AZN source = identity, no FX).
 *
 * §CAPTCHA: a captcha challenge THROWS out of the adapter. The country is then
 * recorded as an error — never as "0 hotels" — so a blocked sync cannot look
 * like an empty catalog.
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { IdsService } from "../../../shared/ids.service";
import { SupplierPricingService } from "../../pricing/supplier-pricing.service";
import { KazunionHotelAdapter } from "./kazunion-hotel.adapter";
import { resolveGeoCountryId } from "../geo-country-resolver";
import {
  KAZUNION_HOTEL_COUNTRIES,
  resolveHotelStateInc,
  hotelStateIncToIso,
  hotelStateIncToRu,
} from "./kazunion-hotel-countries";
import type { SupplierOffer } from "../supplier.types";

export interface KazunionHotelSyncResult {
  countriesProcessed: number;
  countriesWithoutInventory: number;
  rowsReceived: number;
  uniqueHotels: number;
  newCards: number;
  updatedCards: number;
  unchangedCards: number;
  tariffsCreated: number;
  tariffsUpdated: number;
  errors: string[];
}

export interface KazunionHotelSyncOptions {
  /** ISO-2 countries to sync. Default: all hotel-dictionary countries. */
  countryIsos?: string[];
  /** Check-in window (YYYY-MM-DD). Default: today → +30 days. */
  dateFrom?: string;
  dateTo?: string;
  /** Stay nights (single value). Default 7. */
  nights?: number;
  /** Max PRICEPAGE pages per country (safety cap). */
  maxPages?: number;
}

/** YYYY-MM-DD → YYYYMMDD (SAMO compact). */
function toCompact(d: string): string {
  return d.replace(/-/g, "").slice(0, 8);
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
export class KazunionHotelSyncService {
  private readonly logger = new Logger(KazunionHotelSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hotels: KazunionHotelAdapter,
    private readonly pricing: SupplierPricingService,
    private readonly ids: IdsService,
  ) {}

  async getKazunionPartner(): Promise<{ id: string } | null> {
    return this.prisma.partner.findFirst({ where: { name: "Kazunion" } });
  }

  async runSync(options?: KazunionHotelSyncOptions): Promise<KazunionHotelSyncResult> {
    const start = Date.now();
    const result: KazunionHotelSyncResult = {
      countriesProcessed: 0,
      countriesWithoutInventory: 0,
      rowsReceived: 0,
      uniqueHotels: 0,
      newCards: 0,
      updatedCards: 0,
      unchangedCards: 0,
      tariffsCreated: 0,
      tariffsUpdated: 0,
      errors: [],
    };

    const partner = await this.getKazunionPartner();
    if (!partner) {
      result.errors.push("Kazunion partner not found — run the tour sync or partner seed first");
      return result;
    }
    const category = await this.prisma.category.findFirst({ where: { slug: "accommodation" } });
    if (!category) {
      result.errors.push("accommodation category not found");
      return result;
    }

    const dateFrom = options?.dateFrom ?? todayIso();
    const dateTo = options?.dateTo ?? plusDaysIso(dateFrom, 30);
    const nights = options?.nights ?? 7;
    const maxPages = options?.maxPages ?? 30;

    const isos = options?.countryIsos?.length
      ? options.countryIsos.map((s) => s.trim().toUpperCase()).filter(Boolean)
      : KAZUNION_HOTEL_COUNTRIES.map((c) => c.iso2);

    this.logger.log(
      `KazUnion hotels sync: ${isos.join(",")} ${dateFrom}..${dateTo} ${nights}n maxPages=${maxPages}`,
    );

    for (const iso of isos) {
      const stateInc = resolveHotelStateInc(iso);
      if (!stateInc) {
        result.errors.push(`Country ${iso} not in the KazUnion hotel dictionary`);
        continue;
      }
      try {
        const offers = await this.hotels.search({
          service: "hotels",
          country: iso,
          adults: 2,
          children: 0,
          nightsFrom: nights,
          nightsTo: nights,
          departureDateFrom: dateFrom,
          departureDateTo: dateTo,
          // Full country inventory: the adapter paginates PRICEPAGE.
          maxPages,
        } as never);

        result.rowsReceived += offers.length;

        if (offers.length === 0) {
          // Genuine empty answer (verified: Turkey has no hotel inventory for
          // these dates while Vietnam returns 100 rows/page). Recorded
          // separately from errors so an empty country is visible as such.
          result.countriesWithoutInventory++;
          this.logger.log(`KazUnion hotels [${iso}/${stateInc}]: no inventory for ${dateFrom}..${dateTo}`);
          continue;
        }

        const hotels = await this.upsertCountryHotels(
          offers,
          stateInc,
          iso,
          partner.id,
          category.id,
          result,
        );
        result.countriesProcessed++;
        this.logger.log(`KazUnion hotels [${iso}/${stateInc}]: ${offers.length} rows → ${hotels} hotels`);
      } catch (err) {
        const msg = (err as Error).message;
        result.errors.push(`[${iso}]: ${msg}`);
        this.logger.warn(`KazUnion hotels [${iso}] failed: ${msg}`);
      }
    }

    this.logger.log(
      `KazUnion hotels sync done in ${Date.now() - start}ms: ${result.countriesProcessed} countries, ` +
        `${result.countriesWithoutInventory} without inventory, ${result.rowsReceived} rows, ` +
        `${result.uniqueHotels} hotels, ${result.newCards} new, ${result.updatedCards} updated, ` +
        `${result.tariffsCreated}+${result.tariffsUpdated} tariffs`,
    );
    return result;
  }

  /** Group a country's offers by hotelKey → upsert one Product + per-(room,meal) Tariffs. */
  private async upsertCountryHotels(
    offers: SupplierOffer[],
    stateInc: string,
    iso: string,
    partnerId: string,
    categoryId: string,
    result: KazunionHotelSyncResult,
  ): Promise<number> {
    const byHotel = new Map<string, SupplierOffer[]>();
    for (const o of offers) {
      const hotelKey = o.hotelExternalId || (o.rawMetadata?.hotelKey as string | undefined) || "";
      if (!hotelKey || !(o.price.amount > 0)) continue;
      const list = byHotel.get(hotelKey);
      if (list) list.push(o);
      else byHotel.set(hotelKey, [o]);
    }
    result.uniqueHotels += byHotel.size;

    const iso2 = hotelStateIncToIso(stateInc) ?? iso;
    const countryRu = hotelStateIncToRu(stateInc) ?? iso2;
    const geoCountryId =
      (await resolveGeoCountryId(this.prisma, iso2)) ??
      (await resolveGeoCountryId(this.prisma, countryRu));

    let count = 0;
    for (const [hotelKey, hotelOffers] of byHotel) {
      try {
        await this.upsertHotel(
          hotelKey,
          hotelOffers,
          stateInc,
          iso2,
          countryRu,
          geoCountryId,
          partnerId,
          categoryId,
          result,
        );
        count++;
      } catch (err) {
        result.errors.push(`hotel ${hotelKey}: ${(err as Error).message}`);
      }
    }
    return count;
  }

  private async upsertHotel(
    hotelKey: string,
    offers: SupplierOffer[],
    stateInc: string,
    iso2: string,
    countryRu: string,
    geoCountryId: string | null,
    partnerId: string,
    categoryId: string,
    result: KazunionHotelSyncResult,
  ): Promise<void> {
    const meta = (offers[0].rawMetadata ?? {}) as Record<string, unknown>;
    const hotelName = offers[0].hotel || "Unknown Hotel";
    const city = (meta.city as string) || "";
    const stars = (meta.stars as number | undefined) ?? null;
    const supplierRef = `KAZUNIONHTL-${hotelKey}-${stateInc}`;
    const title = city ? `${hotelName} (${city}, ${countryRu})` : `${hotelName} (${countryRu})`;

    // Group by (roomKey, mealKey) → one tariff each, min source amount.
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
    for (const o of offers) {
      const m = (o.rawMetadata ?? {}) as Record<string, unknown>;
      const roomKey = (m.roomKey as string) || "0";
      const mealKey = (m.mealKey as string) || "0";
      const key = `${roomKey}:${mealKey}`;
      const g = tariffGroups.get(key);
      if (g) {
        if (o.price.amount < g.minSource) g.minSource = o.price.amount;
        if (o.departureDate && !g.checkIns.includes(o.departureDate)) g.checkIns.push(o.departureDate);
      } else {
        tariffGroups.set(key, {
          room: o.room ?? "",
          meal: o.meal ?? "",
          roomKey,
          mealKey,
          minSource: o.price.amount,
          currency: o.price.currency || "AZN",
          checkIns: o.departureDate ? [o.departureDate] : [],
        });
      }
    }

    // Public AZN price per tariff (markup only — the source is ALREADY AZN).
    const tariffs: Array<{
      code: string;
      name: string;
      azn: number;
      inclusions: Record<string, unknown>;
    }> = [];
    let startingPrice = 0;
    for (const g of tariffGroups.values()) {
      const azn = await this.pricing.publicAmountFor(g.minSource, g.currency, "KAZUNION", "hotels");
      if (!(azn > 0)) continue;
      const name = [g.room, g.meal].filter(Boolean).join(" / ") || "Base";
      const code =
        `TRF-KZUH-${hotelKey}-${stateInc}-${g.roomKey || "0"}-${g.mealKey || "0"}`.slice(0, 120);
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

    const rooms = Array.from(new Set(offers.map((o) => o.room).filter(Boolean)));
    const meals = Array.from(new Set(offers.map((o) => o.meal).filter(Boolean)));
    const attributes = {
      hotelName,
      hotelKey,
      city,
      country: countryRu,
      countryCode: iso2,
      stars,
      rooms,
      meals,
      nights: offers[0].nights,
      startingPrice,
      currency: "AZN",
      supplierCode: "KAZUNION",
      service: "hotels",
    };

    const existing = await this.prisma.product.findFirst({ where: { supplierRef } });

    if (existing) {
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
        if (geoCountryId && !(existing as any).geoCountryId) patch.geoCountryId = geoCountryId;
        if (Object.keys(patch).length > 0) {
          await tx.product.update({ where: { id: existing.id }, data: patch });
        }
        const counts = await this.upsertTariffs(tx, existing.id, tariffs);
        result.tariffsCreated += counts.created;
        result.tariffsUpdated += counts.updated;
      });
      if (startingPrice > 0 && (existing.attributes as any)?.startingPrice !== startingPrice) {
        result.updatedCards++;
      } else {
        result.unchangedCards++;
      }
      return;
    }

    // New hotel: insert Product + Tariffs + publication channel.
    const slugBase = `kazunion-hotel-${iso2.toLowerCase()}-${hotelKey}`;
    await this.prisma.$transaction(async (tx: any) => {
      const prdCode = await this.ids.nextCode(tx, "PRD");
      const inserted = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO "catalog"."Product" (
          "id", "code", "supplierRef", "type", "title", "slug", "status", "version",
          "categoryId", "attributes", "partnerId", "publishedAt", "createdAt", "updatedAt",
          "geoCountryId"
        ) VALUES (
          gen_random_uuid(), ${prdCode}, ${supplierRef}, 'HOTEL'::"catalog"."ProductType",
          ${title}, ${slugBase}, 'PUBLISHED'::"catalog"."ProductStatus", 1,
          ${categoryId}, ${JSON.stringify(attributes)}::jsonb, ${partnerId},
          now(), now(), now(),
          ${geoCountryId}
        )
        RETURNING "id"
      `;
      const productId = inserted[0].id;
      const counts = await this.upsertTariffs(tx, productId, tariffs);
      result.tariffsCreated += counts.created;
      result.tariffsUpdated += counts.updated;
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
