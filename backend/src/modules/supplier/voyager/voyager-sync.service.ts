/**
 * Voyager Catalog Sync Service — idempotent pipeline (KOMPAS/KazUnion-style).
 *
 * Discover ALL countries from Baku (verified live dictionary 2026-10-21: 10
 * states) → per-country PRICES fan-out in 31-day windows → group by
 * program+hotel → upsert Product(type=TOUR) cards.
 *
 * Key engine difference vs KazUnion: TOURINC=0 makes Voyager fan out ALL
 * programs of a country in ONE PRICES request (verified live), so the sync
 * does NOT loop programs — one sweep per country serves every program, and
 * each row carries its own program identity (tourKey/tourText).
 *
 * §FX: Voyager prices in USD (CURRENCY=2 — the only code it publishes). The
 * catalog write converts USD→AZN through SupplierFxRateService (seeded rate,
 * never invented) and writes the public AZN price.
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { IdsService } from "../../../shared/ids.service";
import { VoyagerAdapter } from "./voyager.adapter";
import { VoyagerHttpService } from "./voyager-http.service";
import {
  VOYAGER_STATEINC_BY_ISO,
  VOYAGER_STATE_NAMES,
} from "./voyager-countries";
import { SupplierPricingService } from "../../pricing/supplier-pricing.service";
import { resolveGeoCountryId } from "../geo-country-resolver";
import type { SupplierOffer } from "../supplier.types";

export interface VoyagerSyncResult {
  countriesProcessed: number;
  countriesWithoutInventory: number;
  programsDiscovered: number;
  offersReceived: number;
  uniqueIdentities: number;
  newCards: number;
  updatedCards: number;
  unchangedCards: number;
  normalizationFailures: number;
  errors: string[];
}

export interface VoyagerSyncOptions {
  /** ISO-2 countries to sync. Default: all 10 tour-dictionary countries. */
  countryIsos?: string[];
  /** Search window override (ISO dates). Default: today → +30 days. */
  dateFrom?: string;
  dateTo?: string;
  /** Max PRICEPAGE pages per country-window (safety cap). Default 30. */
  maxPages?: number;
}

@Injectable()
export class VoyagerSyncService {
  private readonly logger = new Logger(VoyagerSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly voyager: VoyagerAdapter,
    private readonly http: VoyagerHttpService,
    private readonly pricing: SupplierPricingService,
    private readonly ids: IdsService,
  ) {}

  /** Find (or create) the Voyager supplier partner under the PRN-* scheme. */
  async getVoyagerPartner(): Promise<{ id: string } | null> {
    const existing = await this.prisma.partner.findFirst({
      where: { name: "Voyager" },
    });
    if (existing) return existing;
    const code = await this.ids.nextCode(null, "PRN");
    this.logger.log(`Voyager partner not found — creating ${code}`);
    return this.prisma.partner.create({
      data: { code, name: "Voyager", status: "ACTIVE" },
    });
  }

  async runSync(options?: VoyagerSyncOptions): Promise<VoyagerSyncResult> {
    const syncStart = Date.now();
    const result: VoyagerSyncResult = {
      countriesProcessed: 0,
      countriesWithoutInventory: 0,
      programsDiscovered: 0,
      offersReceived: 0,
      uniqueIdentities: 0,
      newCards: 0,
      updatedCards: 0,
      unchangedCards: 0,
      normalizationFailures: 0,
      errors: [],
    };

    const partner = await this.getVoyagerPartner();
    const toursCategory = await this.prisma.category.findFirst({
      where: { slug: "tours" },
    });
    if (!toursCategory) {
      result.errors.push("Tours category not found");
      return result;
    }

    const isos = options?.countryIsos?.length
      ? options.countryIsos.map((s) => s.trim().toUpperCase()).filter(Boolean)
      : Object.keys(VOYAGER_STATEINC_BY_ISO);
    const dateFrom = options?.dateFrom ?? this.formatDate(new Date());
    const dateTo =
      options?.dateTo ??
      this.formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    const windows = this.generateDateWindows(dateFrom, dateTo);
    const maxPages = options?.maxPages ?? 30;

    this.logger.log(
      `Starting Voyager sync from Baku for partner ${partner?.id ?? "?"}: ` +
        `${isos.join(",")} ${dateFrom}..${dateTo} (${windows.length} windows) maxPages=${maxPages}`,
    );

    for (const iso of isos) {
      const stateInc = VOYAGER_STATEINC_BY_ISO[iso];
      if (!stateInc) {
        result.errors.push(`Country ${iso} not in the Voyager tour dictionary`);
        continue;
      }
      const countryName = VOYAGER_STATE_NAMES[stateInc] ?? iso;

      // Program inventory for the report (one cached form fetch — the search
      // below shares the same dictionary cache).
      try {
        const dict = await this.http.fetchDictionary(stateInc);
        result.programsDiscovered += dict.programs.length;
      } catch (err) {
        this.logger.warn(
          `Voyager [${iso}] dictionary probe failed: ${(err as Error).message}`,
        );
      }

      const countryOffers: SupplierOffer[] = [];
      // MY (Malaysia) trips the supplier antibot on deep PRICES pagination
      // (page 10+ -> captcha). Cap MY at 9 pages (~900 rows) so the sweep
      // completes without a captcha; other countries keep the full cap.
      const countryMaxPages = iso === "MY" ? Math.min(maxPages, 9) : maxPages;
      for (const window of windows) {
        try {
          const offers = await this.voyager.search({
            destination: countryName,
            adults: 2,
            departureDateFrom: window.from,
            departureDateTo: window.to,
            // Full inventory: 30 pages × 100 rows (UI keeps 5).
            maxPages: countryMaxPages,
          });
          countryOffers.push(...offers);
        } catch (err) {
          result.errors.push(
            `[${countryName}] ${window.from}→${window.to}: ${(err as Error).message}`,
          );
        }
      }

      result.offersReceived += countryOffers.length;
      if (countryOffers.length === 0) {
        result.countriesWithoutInventory++;
        this.logger.log(
          `Voyager [${iso}/${stateInc}]: no inventory for ${dateFrom}..${dateTo}`,
        );
        continue;
      }

      const cards = await this.persistOffers(
        countryOffers,
        {
          toursCategoryId: toursCategory.id,
          partnerId: partner?.id ?? "",
          stateInc,
          iso,
        },
        result,
      );
      result.countriesProcessed++;
      this.logger.log(
        `Voyager [${iso}/${stateInc}]: ${countryOffers.length} offers → ${cards} cards`,
      );
    }

    this.logger.log(
      `Voyager sync complete in ${Date.now() - syncStart}ms: ` +
        `${result.countriesProcessed} countries, ${result.programsDiscovered} programs, ` +
        `${result.offersReceived} offers, ${result.uniqueIdentities} unique, ` +
        `${result.newCards} created, ${result.updatedCards} updated`,
    );
    return result;
  }

  /** Group offers by identity (program+hotel) and upsert cards. */
  private async persistOffers(
    offers: SupplierOffer[],
    ctx: {
      toursCategoryId: string;
      partnerId: string;
      stateInc: string;
      iso: string;
    },
    result: VoyagerSyncResult,
  ): Promise<number> {
    const groups: Record<string, SupplierOffer[]> = {};
    for (const offer of offers) {
      const tourKey = (offer.rawMetadata?.tourKey as string) ?? "0";
      const hotelKey =
        (offer.rawMetadata?.hotelKey as string) ?? offer.hotelExternalId ?? "";
      if (!hotelKey) continue;
      const key = `${tourKey}:${hotelKey}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(offer);
    }
    result.uniqueIdentities += Object.keys(groups).length;

    const geoCountryId = await resolveGeoCountryId(this.prisma, ctx.iso);

    let created = 0;
    for (const [key, groupOffers] of Object.entries(groups)) {
      try {
        const [tourKey, hotelKey] = key.split(":");
        const productCode = `VOYAGER-${tourKey}-${hotelKey}`;

        const validOffers = groupOffers.filter((o) => o.price.amount > 0);
        const minSource = validOffers.length
          ? Math.min(...validOffers.map((o) => o.price.amount))
          : 0;
        const sourceCurrency = validOffers[0]?.price.currency ?? "USD";
        // Markup boundary (§9): Tariff/startingPrice are customer-facing —
        // write the PUBLIC price. Voyager quotes USD, поэтому convert-then-markup:
        // publicAmountWithFxFor возвращает И сумму, И валюту (AZN, если курс
        // настроен; иначе source). Раньше здесь маркап применялся к USD-сумме,
        // но метка ставилась "AZN" — цена на витрине занижалась на курс.
        let minPrice = 0;
        let publicCurrency = sourceCurrency;
        if (minSource > 0) {
          const converted = await this.pricing.publicAmountWithFxFor(
            minSource,
            sourceCurrency,
            "VOYAGER",
            "tours",
          );
          minPrice = converted.amount;
          publicCurrency = converted.currency;
        }

        const rooms = Array.from(
          new Set(groupOffers.map((o) => o.room).filter((r): r is string => !!r)),
        );
        const meals = Array.from(
          new Set(groupOffers.map((o) => o.meal).filter((m): m is string => !!m)),
        );

        const hotelName = groupOffers[0].hotel ?? "Unknown Hotel";
        const tourIncName = (groupOffers[0].rawMetadata?.tourText as string) ?? "";
        const country =
          (groupOffers[0].rawMetadata?.country as string) ?? ctx.iso;
        // Город отеля из названия ячейки («Отель (Дубай)») — в реестре отелей
        // (catalog."Hotel") город входит в ключ группировки, без него отели
        // одного названия в разных городах склеиваются, а фото ищется хуже.
        const hotelCity = (groupOffers[0].rawMetadata?.hotelCity as string) ?? "";

        const attributes = {
          hotelName,
          hotelKey,
          tourIncValue: tourKey,
          tourIncName,
          rooms,
          meals,
          nights: groupOffers[0].nights,
          startingPrice: minPrice,
          currency: publicCurrency,
          supplierCode: "VOYAGER",
          country,
          countryCode: ctx.iso,
          ...(hotelCity ? { city: hotelCity } : {}),
          departureCity: "Baku",
        };

        const existing = await this.prisma.product.findFirst({
          where: { supplierRef: productCode },
        });

        if (existing) {
          await this.prisma.$transaction(async (tx: any) => {
            const currentAttrs = (existing.attributes ?? {}) as Record<string, unknown>;
            // Дополняем гео: карточка, созданная до появления countryCode/city,
            // не попадает в реестр отелей → остаётся без фото.
            const patch: Record<string, unknown> = {};
            if (currentAttrs.startingPrice !== minPrice) {
              patch.startingPrice = minPrice;
              patch.currency = publicCurrency;
            }
            if (!currentAttrs.countryCode) patch.countryCode = ctx.iso;
            if (!currentAttrs.city && hotelCity) patch.city = hotelCity;
            if (Object.keys(patch).length > 0) {
              await tx.product.update({
                where: { id: existing.id },
                data: { attributes: { ...currentAttrs, ...patch } },
              });
            }
            const tariff = await tx.tariff.findFirst({
              where: { productId: existing.id },
              select: { id: true, price: true },
            });
            if (tariff && minPrice > 0 && tariff.price.toNumber() !== minPrice) {
              await tx.tariff.update({
                where: { id: tariff.id },
                data: { price: minPrice },
              });
            }
            if (geoCountryId && !(existing as any).geoCountryId) {
              await tx.product.update({
                where: { id: existing.id },
                data: { geoCountryId },
              });
            }
          });
          if (minPrice > 0 && (existing.attributes as any)?.startingPrice !== minPrice) {
            result.updatedCards++;
          } else {
            result.unchangedCards++;
          }
        } else {
          const slug =
            `voyager-${tourKey}-${hotelKey}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          await this.prisma.$transaction(async (tx: any) => {
            const prdCode = await this.ids.nextCode(tx, "PRD");
            const idResult = await tx.$queryRaw<{ id: string }[]>`
              INSERT INTO "catalog"."Product" (
                "id", "code", "supplierRef", "type", "title", "slug", "status", "version",
                "categoryId", "attributes", "partnerId", "publishedAt", "createdAt", "updatedAt",
                "geoCountryId"
              ) VALUES (
                gen_random_uuid(), ${prdCode}, ${productCode}, 'TOUR'::"catalog"."ProductType",
                ${`${hotelName} — ${tourIncName}`.trim()}, ${slug}, 'PUBLISHED'::"catalog"."ProductStatus", 1,
                ${ctx.toursCategoryId}, ${JSON.stringify(attributes)}::jsonb, ${ctx.partnerId},
                now(), now(), now(),
                ${geoCountryId}
              )
              RETURNING "id"
            `;
            const productId = idResult[0].id;

            if (minPrice > 0) {
              await tx.$executeRaw`
                INSERT INTO "catalog"."Tariff" ("id", "code", "productId", "name", "price", "currency", "status", "version", "createdAt", "updatedAt")
                VALUES (gen_random_uuid(), ${`TRF-VOY-${hotelKey}-${tourKey}`}, ${productId}, 'Base', ${minPrice}::decimal, ${publicCurrency}, 'ACTIVE'::"catalog"."RatePlanStatus", 1, now(), now())
              `;
            }

            await tx.$executeRaw`
              INSERT INTO "catalog"."ProductPublicationChannel" ("id", "productId", "channel", "createdAt")
              VALUES (gen_random_uuid(), ${productId}, 'MARKETPLACE'::"catalog"."PublicationChannel", now())
            `;
          });
          result.newCards++;
          created++;
        }
      } catch (err) {
        result.errors.push(`Card ${key}: ${(err as Error).message}`);
        result.normalizationFailures++;
      }
    }
    return created;
  }

  /** YYYY-MM-DD of `d` (local). */
  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  /** Inclusive ISO-date windows of at most 31 days (SAMO is silent wide). */
  private generateDateWindows(
    from: string,
    to: string,
    sizeDays = 31,
  ): Array<{ from: string; to: string }> {
    const windows: Array<{ from: string; to: string }> = [];
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return windows;
    const cursor = new Date(start);
    for (let guard = 0; cursor <= end && guard < 40; guard++) {
      const windowEnd = new Date(cursor);
      windowEnd.setUTCDate(windowEnd.getUTCDate() + sizeDays - 1);
      const capped = windowEnd > end ? end : windowEnd;
      windows.push({
        from: cursor.toISOString().slice(0, 10),
        to: capped.toISOString().slice(0, 10),
      });
      const next = new Date(capped);
      next.setUTCDate(next.getUTCDate() + 1);
      cursor.setTime(next.getTime());
    }
    return windows;
  }
}
