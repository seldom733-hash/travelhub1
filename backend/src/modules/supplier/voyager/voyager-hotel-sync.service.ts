/**
 * Voyager HOTEL Catalog Sync Service — idempotent pipeline (mirrors
 * KompasHotelSyncService / KazunionHotelSyncService).
 *
 * Sweep every hotel-country of the stay dictionary (16 states, verified live
 * 2026-10-22 from the /search_hotel form) → group rows by hotelKey →
 * upsert Product(type=HOTEL, accommodation) cards with one tariff per
 * (room, meal) combination at the minimum observed public price.
 *
 * Identity: `VOYAGERHTL-{hotelKey}-{stateInc}` (state-scoped: the same
 * hotelKey can exist in different states across engines — never merge).
 *
 * §FX: Voyager quotes USD (CURRENCY=2 — the only code it publishes). Every
 * catalog write converts USD→AZN via SupplierFxRateService (seeded rate,
 * never invented) and writes the PUBLIC AZN amount; a missing rate falls
 * open (source currency, no FX) — same boundary as the tour sync.
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { IdsService } from "../../../shared/ids.service";
import { VoyagerHotelAdapter } from "./voyager-hotel.adapter";
import { VoyagerHttpService } from "./voyager-http.service";
import {
  VOYAGER_HOTEL_STATEINC_BY_ISO,
  VOYAGER_HOTEL_STATE_NAMES,
} from "./voyager-countries";
import { SupplierPricingService } from "../../pricing/supplier-pricing.service";
import { resolveGeoCountryId } from "../geo-country-resolver";
import type { SamoHotelEntry } from "../samo-hotel-dict";
import type { SupplierOffer } from "../supplier.types";

export interface VoyagerHotelSyncResult {
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

export interface VoyagerHotelSyncOptions {
  /** ISO-2 countries to sync. Default: all 16 hotel-dictionary countries. */
  countryIsos?: string[];
  /** Search window override (ISO dates). Default: today → +30 days. */
  dateFrom?: string;
  dateTo?: string;
  /** Stay length (soft clamp 1..30, verified form bounds). Default 7. */
  nights?: number;
  /** Max PRICEPAGE pages per country (safety cap). Default 30. */
  maxPages?: number;
}

interface TariffGroup {
  room: string;
  meal: string;
  roomKey: string;
  mealKey: string;
  minSource: number;
  currency: string;
  checkIns: string[];
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Trailing «5*» of a hotel name → 5 (already done by the adapter; kept for parity). */
function parseStars(name: string): number | null {
  const m = name.match(/(\d)\s*\*\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

@Injectable()
export class VoyagerHotelSyncService {
  private readonly logger = new Logger(VoyagerHotelSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hotels: VoyagerHotelAdapter,
    private readonly http: VoyagerHttpService,
    private readonly pricing: SupplierPricingService,
    private readonly ids: IdsService,
  ) {}

  async getVoyagerPartner(): Promise<{ id: string } | null> {
    return this.prisma.partner.findFirst({ where: { name: "Voyager" } });
  }

  async runSync(options?: VoyagerHotelSyncOptions): Promise<VoyagerHotelSyncResult> {
    const start = Date.now();
    const result: VoyagerHotelSyncResult = {
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

    const partner = await this.getVoyagerPartner();
    if (!partner) {
      result.errors.push("Voyager partner not found — run the tour sync or partner seed first");
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
      : Object.keys(VOYAGER_HOTEL_STATEINC_BY_ISO);

    this.logger.log(
      `Voyager hotels sync: ${isos.join(",")} ${dateFrom}..${dateTo} ${nights}n maxPages=${maxPages}`,
    );

    for (const iso of isos) {
      const stateInc = VOYAGER_HOTEL_STATEINC_BY_ISO[iso];
      if (!stateInc) {
        result.errors.push(`Country ${iso} not in the Voyager hotel dictionary`);
        continue;
      }
      const countryRu = VOYAGER_HOTEL_STATE_NAMES[stateInc] ?? iso;

      try {
        // Country dictionary: hotel entries carry star/townKey for card
        // enrichment (one cached form fetch shared with the search below).
        const dict = await this.http.fetchHotelDictionary(stateInc);
        const hotelDict = new Map<string, SamoHotelEntry>();
        for (const h of dict.hotels) hotelDict.set(h.id, h);
        const townById = new Map<string, string>();
        for (const t of dict.towns) townById.set(t.value, t.name);

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
          // Genuine empty answer — recorded separately from errors so an
          // empty country is visible as such.
          result.countriesWithoutInventory++;
          this.logger.log(`Voyager hotels [${iso}/${stateInc}]: no inventory for ${dateFrom}..${dateTo}`);
          continue;
        }

        const hotels = await this.upsertCountryHotels(
          offers,
          stateInc,
          iso,
          countryRu,
          hotelDict,
          townById,
          partner.id,
          category.id,
          result,
        );
        result.countriesProcessed++;
        this.logger.log(`Voyager hotels [${iso}/${stateInc}]: ${offers.length} rows → ${hotels} hotels`);
      } catch (err) {
        const msg = (err as Error).message;
        result.errors.push(`[${iso}]: ${msg}`);
        this.logger.warn(`Voyager hotels [${iso}] failed: ${msg}`);
      }
    }

    this.logger.log(
      `Voyager hotels sync done in ${Date.now() - start}ms: ${result.countriesProcessed} countries, ` +
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
    countryRu: string,
    hotelDict: Map<string, SamoHotelEntry>,
    townById: Map<string, string>,
    partnerId: string,
    categoryId: string,
    result: VoyagerHotelSyncResult,
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

    const geoCountryId = await resolveGeoCountryId(this.prisma, iso);

    let count = 0;
    for (const [hotelKey, hotelOffers] of byHotel) {
      try {
        await this.upsertHotel(
          hotelKey,
          hotelOffers,
          stateInc,
          iso,
          countryRu,
          hotelDict,
          townById,
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

  /** Upsert one hotel Product card and its (room, meal) tariffs. */
  private async upsertHotel(
    hotelKey: string,
    hotelOffers: SupplierOffer[],
    stateInc: string,
    iso: string,
    countryRu: string,
    hotelDict: Map<string, SamoHotelEntry>,
    townById: Map<string, string>,
    geoCountryId: string | null,
    partnerId: string,
    categoryId: string,
    result: VoyagerHotelSyncResult,
  ): Promise<void> {
    const supplierRef = `VOYAGERHTL-${hotelKey}-${stateInc}`;
    const hotelName = hotelOffers[0].hotel || hotelDict.get(hotelKey)?.name || hotelKey;
    const entry = hotelDict.get(hotelKey);
    const stars =
      parseStars(hotelName) ??
      (entry?.star ? parseStars(entry.star) : null) ??
      ((hotelOffers[0].rawMetadata?.stars as number | null | undefined) ?? null);
    const city =
      entry?.townKey !== undefined && townById.has(entry.townKey)
        ? townById.get(entry.townKey)!
        : ((hotelOffers[0].rawMetadata?.city as string | undefined) || "");

    // ── Min-price per (room, meal) tariff ─────────────────────────────────
    const tariffGroups = new Map<string, TariffGroup>();
    for (const o of hotelOffers) {
      if (!(o.price.amount > 0)) continue;
      const roomKey = (o.rawMetadata?.roomKey as string | undefined) ?? "";
      const mealKey = (o.rawMetadata?.mealKey as string | undefined) ?? "";
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
          currency: o.price.currency || "USD",
          checkIns: o.departureDate ? [o.departureDate] : [],
        });
      }
    }

    // Public price per tariff: convert source→AZN (SupplierFxRate, §FX), затем
    // markup. applyWithFx возвращает и сумму, и валюту; метка валюты всегда
    // соответствует сумме (нет курса → source currency, fail-open).
    const resolution = await this.pricing.resolve("VOYAGER", "hotels");
    const tariffs: Array<{
      code: string;
      name: string;
      azn: number;
      currency: string;
      checkIns: string[];
      room: string;
      meal: string;
      inclusions: Record<string, unknown>;
    }> = [];
    const pricedGroups: Array<{ amount: number; currency: string }> = [];
    for (const g of tariffGroups.values()) {
      const fx = await this.pricing.resolveFxSafe("VOYAGER", g.currency);
      const { pricing, fxJson } = this.pricing.applyWithFx(resolution, g.minSource, g.currency, fx);
      const amount = Number(pricing.publicPrice.toString());
      const currency = fxJson ? "AZN" : g.currency;
      pricedGroups.push({ amount, currency });
      tariffs.push({
        code: `TRF-VOY-H-${hotelKey}-${stateInc}-${g.roomKey || "x"}-${g.mealKey || "x"}`,
        name: [g.room, g.meal].filter(Boolean).join(" / ") || "Base",
        azn: amount,
        currency,
        checkIns: g.checkIns.sort(),
        room: g.room,
        meal: g.meal,
        inclusions: {
          meal: g.meal,
          room: g.room,
          mealKey: g.mealKey,
          roomKey: g.roomKey,
          checkIns: g.checkIns.sort(),
          supplierRef,
          sourceMinPrice: g.minSource,
          sourceCurrency: g.currency,
        },
      });
    }

    // startingPrice — минимум в ОДНОЙ валюте (иначе сравнивать суммы нельзя).
    // Все группы обычно конвертированы в AZN; при частично настроенных курсах
    // берём AZN-подмножество, иначе — валюту первой группы.
    const startingPool = pricedGroups.every((p) => p.currency === pricedGroups[0]?.currency)
      ? pricedGroups
      : pricedGroups.filter((p) => p.currency === "AZN");
    let startingPrice = 0;
    let startingCurrency = pricedGroups[0]?.currency ?? "AZN";
    for (const group of startingPool) {
      if (!startingPrice || group.amount < startingPrice) {
        startingPrice = group.amount;
        startingCurrency = group.currency;
      }
    }

    const existing = await this.prisma.product.findFirst({ where: { supplierRef } });

    const title = hotelName;
    const attributes = {
      hotelName,
      hotelKey,
      city,
      country: countryRu,
      countryCode: iso,
      stars,
      rooms: tariffs.map((t) => t.room).filter(Boolean),
      meals: tariffs.map((t) => t.meal).filter(Boolean),
      nights: hotelOffers[0].nights,
      startingPrice,
      currency: startingCurrency,
      supplierCode: "VOYAGER",
      service: "hotels",
      stateInc,
      checkIns: Array.from(new Set(tariffs.flatMap((t) => t.checkIns))).sort(),
    };

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
    const slugBase = `voyager-hotel-${iso.toLowerCase()}-${hotelKey}`;
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
    tariffs: Array<{
      code: string;
      name: string;
      azn: number;
      currency: string;
      inclusions: Record<string, unknown>;
    }>,
  ): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    for (const t of tariffs) {
      const res = await tx.$queryRaw<{ inserted: boolean }[]>`
        INSERT INTO "catalog"."Tariff" (
          "id", "code", "productId", "name", "price", "currency", "inclusions", "status", "version", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), ${t.code}, ${productId}, ${t.name}, ${t.azn}::decimal, ${t.currency},
          ${JSON.stringify(t.inclusions)}::jsonb, 'ACTIVE'::"catalog"."RatePlanStatus", 1, now(), now()
        )
        ON CONFLICT ("code") DO UPDATE SET
          "name" = EXCLUDED."name",
          "price" = EXCLUDED."price",
          "currency" = EXCLUDED."currency",
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
