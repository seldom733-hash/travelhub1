/**
 * ANEX Catalog Sync Service — idempotent pipeline (KOMPAS-style).
 *
 * Discover ALL countries from ANEX States → per-country search in 31-day
 * windows → group by hotel → upsert Products (TOUR type).
 *
 * ANEX serves 21 countries from Baku (verified live).
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { IdsService } from "../../../shared/ids.service";
import { AnexAdapter } from "./anex.adapter";
import { AnexProvider, type AnexState } from "./anex.provider";
import { SupplierPricingService } from "../../pricing/supplier-pricing.service";
import type { SupplierOffer } from "../supplier.types";

export interface AnexSyncResult {
  countriesDiscovered: number;
  programsSearched: number;
  offersReceived: number;
  uniqueIdentities: number;
  newCards: number;
  updatedCards: number;
  unchangedCards: number;
  normalizationFailures: number;
  errors: string[];
}

export interface AnexSyncOptions {
  countryNameContains?: string;
  dateFrom?: string;
  dateTo?: string;
  geoCountryCode?: string;
}

@Injectable()
export class AnexSyncService {
  private readonly logger = new Logger(AnexSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anex: AnexAdapter,
    private readonly anexProvider: AnexProvider,
    private readonly pricing: SupplierPricingService,
    private readonly ids: IdsService,
  ) {}

  async getAnexPartner(): Promise<{ id: string } | null> {
    return this.prisma.partner.findFirst({ where: { name: "Anextour" } });
  }

  async runSync(partnerId: string, options?: AnexSyncOptions): Promise<AnexSyncResult> {
    const syncStart = Date.now();
    this.logger.log(`Starting ANEX sync from Baku for partner ${partnerId}`);

    const result: AnexSyncResult = {
      countriesDiscovered: 0,
      programsSearched: 0,
      offersReceived: 0,
      uniqueIdentities: 0,
      newCards: 0,
      updatedCards: 0,
      unchangedCards: 0,
      normalizationFailures: 0,
      errors: [],
    };

    const anexPartner = await this.prisma.partner.findFirst({ where: { name: "Anextour" } });
    if (!anexPartner) {
      result.errors.push("ANEX partner not found");
      return result;
    }

    const toursCategory = await this.prisma.category.findFirst({ where: { slug: "tours" } });
    if (!toursCategory) {
      result.errors.push("Tours category not found");
      return result;
    }

    // 1. Discover countries
    let states: AnexState[] = [];
    try {
      states = await this.anexProvider.states();
      result.countriesDiscovered = states.length;
      this.logger.log(`ANEX: ${result.countriesDiscovered} countries from Baku`);
    } catch (err) {
      result.errors.push(`Country discovery failed: ${(err as Error).message}`);
      return result;
    }

    // 1b. Optional country scope
    let scopedStates = states;
    if (options?.countryNameContains) {
      const needle = options.countryNameContains.toLowerCase();
      scopedStates = states.filter((s) =>
        s.name.toLowerCase().includes(needle) || s.nameAlt.toLowerCase().includes(needle),
      );
      this.logger.log(`ANEX country filter '${options.countryNameContains}': ${scopedStates.length} of ${states.length} countries`);
      if (scopedStates.length === 0) {
        result.errors.push(`No discovered country matches '${options.countryNameContains}'`);
        return result;
      }
    }

    // 1c. Geo country linkage
    let geoCountryId: string | null = null;
    if (options?.geoCountryCode) {
      const gc = await this.prisma.geoCountry.findUnique({
        where: { code: options.geoCountryCode },
        select: { id: true },
      });
      geoCountryId = gc?.id ?? null;
      if (!geoCountryId) {
        result.errors.push(`Geo country ${options.geoCountryCode} not found`);
      }
    }

    // 2. Search each country
    const allOffers: SupplierOffer[] = [];
    const dateFrom = options?.dateFrom ?? this.formatDate(new Date());
    const dateTo = options?.dateTo ?? this.formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

    for (const state of scopedStates) {
      const stateName = state.nameAlt || state.name;
      try {
        const offers = await this.anex.search({
          country: stateName,
          adults: 2,
          departureDateFrom: dateFrom,
          departureDateTo: dateTo,
          nightsFrom: 2,
          nightsTo: 28,
        });
        allOffers.push(...offers);
        result.programsSearched++;
        this.logger.log(`ANEX [${stateName}]: ${offers.length} offers`);
      } catch (err) {
        result.errors.push(`[${stateName}]: ${(err as Error).message}`);
      }
    }

    result.offersReceived = allOffers.length;

    if (allOffers.length === 0) {
      this.logger.warn("No offers received from ANEX");
      return result;
    }

    // 3. Group by hotel (hotelExternalId + hotel name)
    const groups: Record<string, SupplierOffer[]> = {};
    for (const offer of allOffers) {
      const hotelKey = offer.hotelExternalId || offer.hotel || "";
      if (!hotelKey) continue;
      if (!groups[hotelKey]) groups[hotelKey] = [];
      groups[hotelKey].push(offer);
    }

    result.uniqueIdentities = Object.keys(groups).length;
    this.logger.log(`Grouped into ${result.uniqueIdentities} unique identities`);

    // 4. Upsert each card
    for (const [hotelKey, offers] of Object.entries(groups)) {
      try {
        const validOffers = offers.filter((o) => o.price.amount > 0);
        let minPrice = validOffers.length > 0
          ? Math.min(...validOffers.map((o) => o.price.amount))
          : 0;
        const currency = validOffers[0]?.price.currency || "AZN";
        // Markup
        if (minPrice > 0 && !offers.some((o) => o.pricing)) {
          minPrice = await this.pricing.publicAmountFor(minPrice, currency, this.anex.code, "tours");
        }

        const rooms = Array.from(new Set(offers.map((o) => o.room).filter((r): r is string => !!r)));
        const meals = Array.from(new Set(offers.map((o) => o.meal).filter((m): m is string => !!m)));

        const hotelName = offers[0].hotel ?? "Unknown Hotel";
        const country = offers[0].country ?? "Unknown";
        const title = `${hotelName} (${country})`;

        const attributes = {
          hotelName,
          hotelKey,
          rooms,
          meals,
          nights: offers[0].nights,
          startingPrice: minPrice,
          currency,
          supplierCode: "ANEX",
          country,
          departureCity: "Baku",
        };

        const productCode = `ANEX-${hotelKey}`;

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
            const tariff = await tx.tariff.findFirst({
              where: { productId: existing.id },
              select: { id: true, price: true },
            });
            if (tariff && minPrice > 0 && tariff.price.toNumber() !== minPrice) {
              await tx.tariff.update({ where: { id: tariff.id }, data: { price: minPrice } });
            }
            const geoPatch: { geoCountryId?: string } = {};
            if (geoCountryId && !(existing as any).geoCountryId) {
              geoPatch.geoCountryId = geoCountryId;
            }
            if (Object.keys(geoPatch).length > 0) {
              await tx.product.update({ where: { id: existing.id }, data: geoPatch });
            }
          });
          if (minPrice > 0 && (existing.attributes as any)?.startingPrice !== minPrice) {
            result.updatedCards++;
          } else {
            result.unchangedCards++;
          }
        } else {
          const slug = `anex-${hotelKey}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
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
                ${toursCategory.id}, ${JSON.stringify(attributes)}::jsonb, ${anexPartner.id},
                now(), now(), now(),
                ${geoCountryId}
              )
              RETURNING "id"
            `;
            const productId = idResult[0].id;

            if (minPrice > 0) {
              await tx.$executeRaw`
                INSERT INTO "catalog"."Tariff" ("id", "code", "productId", "name", "price", "currency", "status", "version", "createdAt", "updatedAt")
                VALUES (gen_random_uuid(), ${`TRF-ANX-${hotelKey}`}, ${productId}, 'Base', ${minPrice}::decimal, ${currency}, 'ACTIVE'::"catalog"."RatePlanStatus", 1, now(), now())
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
      `ANEX sync complete in ${syncDuration}ms: ${result.countriesDiscovered} countries, ` +
      `${result.programsSearched} searched, ${result.offersReceived} offers, ` +
      `${result.uniqueIdentities} unique, ${result.newCards} created, ${result.updatedCards} updated`,
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
