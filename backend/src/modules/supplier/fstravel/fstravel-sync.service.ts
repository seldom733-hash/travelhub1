/**
 * FSTravel Catalog Sync Service — idempotent pipeline.
 *
 * Discover countries → per-country search → group by hotel → upsert Products.
 * FSTravel is SAMO-based, serves tours from Baku. Prices in EUR.
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { IdsService } from "../../../shared/ids.service";
import { FstravelAdapter } from "./fstravel.adapter";
import { SupplierPricingService } from "../../pricing/supplier-pricing.service";
import { buildGeoCountryMap } from "../geo-country-resolver";
import type { SupplierOffer } from "../supplier.types";

export interface FstravelSyncResult {
  countriesDiscovered: number;
  offersReceived: number;
  uniqueIdentities: number;
  newCards: number;
  updatedCards: number;
  unchangedCards: number;
  normalizationFailures: number;
  errors: string[];
}

export interface FstravelSyncOptions {
  countryNameContains?: string;
  dateFrom?: string;
  dateTo?: string;
  geoCountryCode?: string;
}

const FSTRAVEL_STATES: Record<string, string> = {
  "Вьетнам": "293645", "Германия": "351392", "Грузия": "223991",
  "Египет": "18498", "Индия": "18028", "Индонезия": "250722",
  "Испания": "18747", "Италия": "18770", "Китай": "230826",
  "Маврикий": "293483", "Малайзия": "435746", "Мальдивы": "275410",
  "Марокко": "745206", "ОАЭ": "20613", "Польша": "287299",
  "Саудовская Аравия": "841186", "Сейшелы": "284350", "Сербия": "209834",
  "Сингапур": "251543", "Таиланд": "20625", "Танзания": "439254",
  "Турция": "18803", "Франция": "18808", "Шри-Ланка": "20629",
  "Южная Корея": "277390", "Япония": "337852",
};

@Injectable()
export class FstravelSyncService {
  private readonly logger = new Logger(FstravelSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fstravel: FstravelAdapter,
    private readonly pricing: SupplierPricingService,
    private readonly ids: IdsService,
  ) {}

  async getFstravelPartner(): Promise<{ id: string } | null> {
    return this.prisma.partner.findFirst({ where: { name: "FSTravel" } });
  }

  async runSync(partnerId: string, options?: FstravelSyncOptions): Promise<FstravelSyncResult> {
    const syncStart = Date.now();
    this.logger.log(`Starting FSTRAVEL sync for partner ${partnerId}`);

    const result: FstravelSyncResult = {
      countriesDiscovered: 0,
      offersReceived: 0,
      uniqueIdentities: 0,
      newCards: 0,
      updatedCards: 0,
      unchangedCards: 0,
      normalizationFailures: 0,
      errors: [],
    };

    const partner = await this.prisma.partner.findFirst({ where: { name: "FSTravel" } });
    if (!partner) {
      result.errors.push("FSTRAVEL partner not found");
      return result;
    }

    const toursCategory = await this.prisma.category.findFirst({ where: { slug: "tours" } });
    if (!toursCategory) {
      result.errors.push("Tours category not found");
      return result;
    }

    const allOffers: SupplierOffer[] = [];
    const dateFrom = options?.dateFrom ?? this.formatDate(new Date());
    const dateTo = options?.dateTo ?? this.formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

    const countryNames = Object.keys(FSTRAVEL_STATES);
    let scopedCountries = countryNames;
    if (options?.countryNameContains) {
      const needle = options.countryNameContains.toLowerCase();
      scopedCountries = countryNames.filter((c) => c.toLowerCase().includes(needle));
      if (scopedCountries.length === 0) {
        result.errors.push(`No country matches '${options.countryNameContains}'`);
        return result;
      }
    }

    result.countriesDiscovered = scopedCountries.length;

    for (const country of scopedCountries) {
      try {
        const offers = await this.fstravel.search({
          country,
          adults: 2,
          departureDateFrom: dateFrom,
          departureDateTo: dateTo,
          nightsFrom: 3,
          nightsTo: 14,
        });
        allOffers.push(...offers);
        this.logger.log(`FSTRAVEL [${country}]: ${offers.length} offers`);
      } catch (err) {
        result.errors.push(`[${country}]: ${(err as Error).message}`);
      }
    }

    result.offersReceived = allOffers.length;

    if (allOffers.length === 0) {
      this.logger.warn("No offers received from FSTRAVEL");
      return result;
    }

    // Group by hotel
    const groups: Record<string, SupplierOffer[]> = {};
    for (const offer of allOffers) {
      const hotelKey = offer.hotelExternalId || offer.hotel || "";
      if (!hotelKey) continue;
      if (!groups[hotelKey]) groups[hotelKey] = [];
      groups[hotelKey].push(offer);
    }

    result.uniqueIdentities = Object.keys(groups).length;
    this.logger.log(`Grouped into ${result.uniqueIdentities} unique identities`);

    // Master Geography linkage per card (so the catalog is filterable by
    // country). Resolve once per distinct country to avoid N queries.
    const geoMap = await buildGeoCountryMap(
      this.prisma,
      Object.values(groups).map((o) => o[0]?.country).filter((c): c is string => !!c),
    );

    // Upsert each card
    for (const [hotelKey, offers] of Object.entries(groups)) {
      try {
        const validOffers = offers.filter((o) => o.price.amount > 0);
        let minPrice = validOffers.length > 0
          ? Math.min(...validOffers.map((o) => o.price.amount))
          : 0;
        const currency = validOffers[0]?.price.currency || "EUR";
        if (minPrice > 0 && !offers.some((o) => o.pricing)) {
          minPrice = await this.pricing.publicAmountFor(minPrice, currency, this.fstravel.code, "tours");
        }

        const hotelName = offers[0].hotel ?? "Unknown Hotel";
        const country = offers[0].country ?? "Unknown";
        const title = `${hotelName} (${country})`;

        const attributes = {
          hotelName,
          hotelKey,
          startingPrice: minPrice,
          currency,
          supplierCode: "FSTRAVEL",
          country,
          departureCity: "Baku",
        };

        const productCode = `FSTRAVEL-${hotelKey}`;

        const existing = await this.prisma.product.findFirst({
          where: { supplierRef: productCode },
        });

        if (existing) {
          await this.prisma.$transaction(async (tx: any) => {
            const currentAttrs = existing.attributes as any;
            if (existing.title !== title) {
              await tx.product.update({ where: { id: existing.id }, data: { title } });
            }
            if (currentAttrs?.startingPrice !== minPrice) {
              await tx.product.update({
                where: { id: existing.id },
                data: { attributes: { ...currentAttrs, startingPrice: minPrice, currency } },
              });
            }
            const geoPatch: { geoCountryId?: string } = {};
            const gci = geoMap.get(country) ?? null;
            if (gci && !(existing as any).geoCountryId) {
              geoPatch.geoCountryId = gci;
            }
            if (Object.keys(geoPatch).length > 0) {
              await tx.product.update({ where: { id: existing.id }, data: geoPatch });
            }
            const tariff = await tx.tariff.findFirst({
              where: { productId: existing.id },
              select: { id: true, price: true },
            });
            if (tariff && minPrice > 0 && tariff.price.toNumber() !== minPrice) {
              await tx.tariff.update({ where: { id: tariff.id }, data: { price: minPrice } });
            }
          });
          if (minPrice > 0 && (existing.attributes as any)?.startingPrice !== minPrice) {
            result.updatedCards++;
          } else {
            result.unchangedCards++;
          }
        } else {
          const slug = `fstravel-${hotelKey}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          await this.prisma.$transaction(async (tx: any) => {
            const prdCode = await this.ids.nextCode(tx, "PRD");
            const idResult = await tx.$queryRaw<{ id: string }[]>`
              INSERT INTO "catalog"."Product" (
                "id", "code", "supplierRef", "type", "title", "slug", "status", "version",
                "categoryId", "attributes", "partnerId", "publishedAt", "createdAt", "updatedAt",
                "geoCountryId"
              ) VALUES (
                gen_random_uuid(), ${prdCode}, ${productCode}, 'TOUR'::"catalog"."ProductType",
                ${title}, ${slug}, 'PUBLISHED'::"catalog"."ProductStatus", 1,
                ${toursCategory.id}, ${JSON.stringify(attributes)}::jsonb, ${partner.id},
                now(), now(), now(),
                ${geoMap.get(country) ?? null}
              )
              RETURNING "id"
            `;
            const productId = idResult[0].id;

            if (minPrice > 0) {
              await tx.$executeRaw`
                INSERT INTO "catalog"."Tariff" ("id", "code", "productId", "name", "price", "currency", "status", "version", "createdAt", "updatedAt")
                VALUES (gen_random_uuid(), ${`TRF-FST-${hotelKey}`}, ${productId}, 'Base', ${minPrice}::decimal, ${currency}, 'ACTIVE'::"catalog"."RatePlanStatus", 1, now(), now())
              `;
            }

            await tx.$executeRaw`
              INSERT INTO "catalog"."ProductPublicationChannel" ("id", "productId", "channel", "createdAt")
              VALUES (gen_random_uuid(), ${productId}, 'MARKETPLACE'::"catalog"."PublicationChannel", now())
            `;
          });
          result.newCards++;
        }
      } catch (err) {
        result.errors.push(`Card ${hotelKey}: ${(err as Error).message}`);
        result.normalizationFailures++;
      }
    }

    const syncDuration = Date.now() - syncStart;
    this.logger.log(
      `FSTRAVEL sync complete in ${syncDuration}ms: ${result.countriesDiscovered} countries, ` +
      `${result.offersReceived} offers, ${result.uniqueIdentities} unique, ` +
      `${result.newCards} created, ${result.updatedCards} updated`,
    );

    return result;
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
}
