/**
 * KOMPAS Catalog Sync Service — Idempotent pipeline.
 *
 * §10: Discover ALL countries from Baku → per-country programs → per-program search → upsert Products.
 * §7: Departure city fixed to Baku (TOWNFROMINC=1411).
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { KompasSupplierAdapter } from "./kompas.adapter";
import type { SupplierOffer } from "../supplier.types";

export interface KompasSyncResult {
  countriesDiscovered: number;
  programsDiscovered: number;
  programsSearched: number;
  offersReceived: number;
  uniqueIdentities: number;
  newCards: number;
  updatedCards: number;
  unchangedCards: number;
  normalizationFailures: number;
  errors: string[];
}

@Injectable()
export class KompasSyncService {
  private readonly logger = new Logger(KompasSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kompas: KompasSupplierAdapter,
  ) {}

  async getKompasPartner(): Promise<{ id: string } | null> {
    return this.prisma.partner.findFirst({ where: { name: "KOMPAS" } });
  }

  /**
   * §10: Full sync from Baku — discover countries → programs → search → upsert.
   */
  async runSync(partnerId: string): Promise<KompasSyncResult> {
    const syncStart = Date.now();
    this.logger.log(`Starting KOMPAS sync from Baku for partner ${partnerId}`);

    const result: KompasSyncResult = {
      countriesDiscovered: 0,
      programsDiscovered: 0,
      programsSearched: 0,
      offersReceived: 0,
      uniqueIdentities: 0,
      newCards: 0,
      updatedCards: 0,
      unchangedCards: 0,
      normalizationFailures: 0,
      errors: [],
    };

    const kompasPartner = await this.prisma.partner.findFirst({ where: { name: "KOMPAS" } });
    if (!kompasPartner) {
      result.errors.push("KOMPAS partner not found");
      return result;
    }

    const toursCategory = await this.prisma.category.findFirst({ where: { slug: "tours" } });
    if (!toursCategory) {
      result.errors.push("Tours category not found");
      return result;
    }

    // 1. Discover ALL countries and programs from Baku
    let countryPrograms: Array<{ countryId: string; countryName: string; programs: Array<{ value: string; name: string }> }> = [];
    try {
      countryPrograms = await this.kompas.discoverCountriesAndPrograms();
      result.countriesDiscovered = countryPrograms.length;
      result.programsDiscovered = countryPrograms.reduce((sum, c) => sum + c.programs.length, 0);
      this.logger.log(
        `KOMPAS: ${result.countriesDiscovered} countries, ${result.programsDiscovered} programs from Baku`,
      );
    } catch (err) {
      result.errors.push(`Country/program discovery failed: ${(err as Error).message}`);
      return result;
    }

    // 2. Search each program
    const allOffers: SupplierOffer[] = [];
    const dateFrom = this.formatDate(new Date());
    const dateTo = this.formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

    for (const country of countryPrograms) {
      for (const program of country.programs) {
        try {
          const offers = await this.kompas.search({
            destination: country.countryName,
            adults: 2,
            tourIncValue: program.value,
            tourIncName: program.name,
            departureDateFrom: dateFrom,
            departureDateTo: dateTo,
          });
          allOffers.push(...offers);
          result.programsSearched++;
          this.logger.log(
            `KOMPAS [${country.countryName}] ${program.name}: ${offers.length} offers`,
          );
        } catch (err) {
          result.errors.push(`[${country.countryName}] ${program.name}: ${(err as Error).message}`);
        }
      }
    }

    result.offersReceived = allOffers.length;

    if (allOffers.length === 0) {
      this.logger.warn("No offers received from any KOMPAS program");
      return result;
    }

    // 3. Group by tourIncValue + hotelKey
    const groups: Record<string, SupplierOffer[]> = {};
    for (const offer of allOffers) {
      const tourIncValue = (offer.rawMetadata?.tourIncValue as string) ?? "0";
      const hotelKey = (offer.rawMetadata?.hotelKey as string) ?? offer.hotelExternalId ?? "";
      if (!hotelKey) continue;
      const key = `${tourIncValue}:${hotelKey}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(offer);
    }

    result.uniqueIdentities = Object.keys(groups).length;
    this.logger.log(`Grouped into ${result.uniqueIdentities} unique identities`);

    // 4. Upsert each card
    for (const [key, offers] of Object.entries(groups)) {
      try {
        const [tourIncValue, hotelKey] = key.split(":");
        const productCode = `KOMPAS-${tourIncValue}-${hotelKey}`;

        const validOffers = offers.filter((o) => o.price.amount > 0);
        const minPrice = validOffers.length > 0
          ? Math.min(...validOffers.map((o) => o.price.amount))
          : 0;
        const currency = validOffers[0]?.price.currency ?? "USD";

        const rooms = Array.from(new Set(offers.map((o) => o.room).filter((r): r is string => !!r)));
        const meals = Array.from(new Set(offers.map((o) => o.meal).filter((m): m is string => !!m)));

        const hotelName = offers[0].hotel ?? "Unknown Hotel";
        const tourIncName = (offers[0].rawMetadata?.tourIncName as string) ?? "";
        // §1A: country from KOMPAS DOM stateKey, NOT from query
        const country = (offers[0].rawMetadata?.country as string) ?? "Unknown";

        const attributes = {
          hotelName,
          hotelKey,
          tourIncValue,
          tourIncName,
          rooms,
          meals,
          nights: offers[0].nights,
          startingPrice: minPrice,
          currency,
          supplierCode: "KOMPAS",
          country,
          departureCity: "Baku",
        };

        const existing = await this.prisma.product.findFirst({
          where: { code: productCode },
        });

        if (existing) {
          await this.prisma.$transaction(async (tx: any) => {
            const currentAttrs = existing.attributes as any;
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
              await tx.tariff.update({
                where: { id: tariff.id },
                data: { price: minPrice },
              });
            }
          });
          if (minPrice > 0 && (existing.attributes as any)?.startingPrice !== minPrice) {
            result.updatedCards++;
          } else {
            result.unchangedCards++;
          }
        } else {
          const slug = `kompas-${tourIncValue}-${hotelKey}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          await this.prisma.$transaction(async (tx: any) => {
            const idResult = await tx.$queryRaw<{ id: string }[]>`
              INSERT INTO "catalog"."Product" (
                "id", "code", "type", "title", "slug", "status", "version",
                "categoryId", "attributes", "partnerId", "publishedAt", "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid(), ${productCode}, 'TOUR'::"catalog"."ProductType",
                ${`${hotelName} — ${tourIncName}`}, ${slug}, 'PUBLISHED'::"catalog"."ProductStatus", 1,
                ${toursCategory.id}, ${JSON.stringify(attributes)}::jsonb, ${kompasPartner.id},
                now(), now(), now()
              )
              RETURNING "id"
            `;
            const productId = idResult[0].id;

            if (minPrice > 0) {
              await tx.$executeRaw`
                INSERT INTO "catalog"."Tariff" ("id", "code", "productId", "name", "price", "currency", "status", "version", "createdAt", "updatedAt")
                VALUES (gen_random_uuid(), ${`TRF-KOM-${hotelKey}-${tourIncValue}`}, ${productId}, 'Base', ${minPrice}::decimal, ${currency}, 'ACTIVE'::"catalog"."RatePlanStatus", 1, now(), now())
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
        result.errors.push(`Card ${key}: ${(err as Error).message}`);
        result.normalizationFailures++;
      }
    }

    const syncDuration = Date.now() - syncStart;
    this.logger.log(
      `KOMPAS sync complete in ${syncDuration}ms: ${result.countriesDiscovered} countries, ` +
      `${result.programsDiscovered} programs, ${result.programsSearched} searched, ` +
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
