import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { SummertourNewAdapter } from "./summertour-new.adapter";
import type { SupplierSearchQuery, SupplierOffer } from "../supplier.types";

/**
 * Summertour Bulk Catalog Sync — Playwright-based.
 *
 * Iterates over all programs × date ranges,
 * fetches prices via the existing Playwright adapter,
 * and upserts Products into the catalog schema.
 *
 * Product code format: SUMMERTOUR-{tourIncValue}-{hotelKey}
 */

export interface BulkSyncResult {
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  programs: ProgramSyncResult[];
  totalProducts: number;
  totalOffers: number;
  errors: string[];
}

export interface ProgramSyncResult {
  tourIncValue: string;
  tourIncName: string;
  hotelsFound: number;
  productsCreated: number;
  productsUpdated: number;
  offersReceived: number;
  errors: string[];
}

@Injectable()
export class SummerBulkSyncService {
  private readonly logger = new Logger(SummerBulkSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly summertour: SummertourNewAdapter,
  ) {}

  /**
   * Run full bulk sync: discover programs → per-program search → upsert.
   * Uses the existing Playwright adapter (SAMO requires browser JS execution).
   */
  async runBulkSync(): Promise<BulkSyncResult> {
    const startedAt = new Date();
    this.logger.log("Starting Summertour bulk sync (Playwright)");

    const result: BulkSyncResult = {
      startedAt,
      finishedAt: new Date(),
      durationMs: 0,
      programs: [],
      totalProducts: 0,
      totalOffers: 0,
      errors: [],
    };

    // 1. Get partner and category
    const summerPartner = await this.prisma.partner.findFirst({
      where: { name: "Summer / Summertour" },
      select: { id: true },
    });
    if (!summerPartner) {
      result.errors.push("Summer partner not found");
      result.finishedAt = new Date();
      result.durationMs = result.finishedAt.getTime() - startedAt.getTime();
      return result;
    }

    const toursCategory = await this.prisma.category.findUnique({
      where: { slug: "tours" },
      select: { id: true },
    });
    if (!toursCategory) {
      result.errors.push("Category 'tours' not found");
      result.finishedAt = new Date();
      result.durationMs = result.finishedAt.getTime() - startedAt.getTime();
      return result;
    }

    // 2. Discover programs
    let programs: Array<{ value: string; name: string }>;
    try {
      programs = await this.summertour.discoverPrograms();
    } catch (err) {
      result.errors.push(`Program discovery failed: ${(err as Error).message}`);
      result.finishedAt = new Date();
      result.durationMs = result.finishedAt.getTime() - startedAt.getTime();
      return result;
    }

    if (programs.length === 0) {
      result.errors.push("No programs discovered");
      result.finishedAt = new Date();
      result.durationMs = result.finishedAt.getTime() - startedAt.getTime();
      return result;
    }

    this.logger.log(`Discovered ${programs.length} programs`);

    // 3. For each program, search all dates and group by hotel
    for (const program of programs) {
      const programResult: ProgramSyncResult = {
        tourIncValue: program.value,
        tourIncName: program.name,
        hotelsFound: 0,
        productsCreated: 0,
        productsUpdated: 0,
        offersReceived: 0,
        errors: [],
      };

      try {
        // Search with 31-day windows across the season
        const allOffers: SupplierOffer[] = [];
        const windows = this.generateDateWindows("2026-09-15", "2027-03-31");

        for (const window of windows) {
          try {
            const query: SupplierSearchQuery = {
              country: "turkey",
              departureCity: "baku",
              adults: 2,
              children: 0,
              nightsFrom: 3,
              nightsTo: 14,
              tourIncValue: program.value,
              tourIncName: program.name,
              departureDateFrom: window.from,
              departureDateTo: window.to,
            };

            const offers = await this.summertour.search(query);
            allOffers.push(...offers);
            programResult.offersReceived += offers.length;

            this.logger.debug(
              `Program ${program.name}: ${window.from}→${window.to}: ${offers.length} offers`
            );
          } catch (err) {
            const msg = `Window ${window.from}→${window.to}: ${(err as Error).message}`;
            programResult.errors.push(msg);
            this.logger.warn(msg);
          }
        }

        // Group by hotel
        const hotelGroups = this.groupByHotel(allOffers);
        programResult.hotelsFound = Object.keys(hotelGroups).length;
        this.logger.log(
          `Program ${program.name}: ${allOffers.length} offers → ${programResult.hotelsFound} hotels`
        );

        // Upsert each hotel as a product
        for (const [hotelKey, hotelOffers] of Object.entries(hotelGroups)) {
          try {
            const upsertResult = await this.upsertProduct(
              program.value,
              program.name,
              hotelKey,
              hotelOffers,
              summerPartner.id,
              toursCategory.id,
            );
            if (upsertResult === "created") programResult.productsCreated++;
            else if (upsertResult === "updated") programResult.productsUpdated++;
          } catch (err) {
            const msg = `Hotel ${hotelKey}: ${(err as Error).message}`;
            programResult.errors.push(msg);
            this.logger.warn(msg);
          }
        }
      } catch (err) {
        programResult.errors.push((err as Error).message);
        this.logger.error(`Program ${program.name} failed: ${(err as Error).message}`);
      }

      result.programs.push(programResult);
      result.totalProducts += programResult.productsCreated + programResult.productsUpdated;
      result.totalOffers += programResult.offersReceived;
    }

    result.finishedAt = new Date();
    result.durationMs = result.finishedAt.getTime() - startedAt.getTime();

    this.logger.log(
      `Bulk sync complete in ${result.durationMs}ms: ` +
      `${result.programs.length} programs, ${result.totalOffers} offers, ` +
      `${result.totalProducts} products created/updated`
    );

    return result;
  }

  /** Group offers by hotelKey. */
  private groupByHotel(offers: SupplierOffer[]): Record<string, SupplierOffer[]> {
    const groups: Record<string, SupplierOffer[]> = {};
    for (const offer of offers) {
      const hotelKey = (offer.rawMetadata?.hotelKey as string) ?? offer.hotelExternalId ?? "unknown";
      if (!groups[hotelKey]) groups[hotelKey] = [];
      groups[hotelKey].push(offer);
    }
    return groups;
  }

  /**
   * Upsert a product in the catalog from scraped offers.
   */
  private async upsertProduct(
    tourIncValue: string,
    tourIncName: string,
    hotelKey: string,
    offers: SupplierOffer[],
    partnerId: string,
    categoryId: string,
  ): Promise<"created" | "updated" | "unchanged"> {
    const productCode = `SUMMERTOUR-${tourIncValue}-${hotelKey}`;

    // Find minimum price
    const validOffers = offers.filter((o) => o.price.amount > 0);
    const minPrice = validOffers.length > 0
      ? Math.min(...validOffers.map((o) => o.price.amount))
      : 0;
    const currency = validOffers[0]?.price.currency ?? "USD";

    // Extract hotel name from first offer
    const hotelName = offers[0]?.hotel ?? `Hotel ${hotelKey}`;

    // Extract resort from hotel name: "HIMEROS BEACH HOTEL 3* (Side)" → "Side"
    const resortMatch = hotelName.match(/\(([^)]+)\)/);
    const resort = resortMatch?.[1] ?? "";

    // Extract unique rooms, meals, nights, dates
    const uniqueRooms = [...new Set(offers.map((o) => o.room).filter((r): r is string => !!r))];
    const uniqueMeals = [...new Set(offers.map((o) => o.meal).filter((m): m is string => !!m))];
    const uniqueNights = [...new Set(offers.map((o) => o.nights).filter((n) => n > 0))].sort((a, b) => a - b);
    const uniqueDates = [...new Set(offers.map((o) => o.departureDate).filter((d) => !!d))].sort();

    const nights = offers[0]?.nights ?? 7;
    const days = nights + 1;

    const attributes: Record<string, unknown> = {
      days,
      nights,
      hotel: hotelName,
      hotelKey,
      tour: tourIncName,
      tourKey: offers[0]?.rawMetadata?.tourKey,
      tourIncValue,
      tourIncName,
      country: "Turkey",
      countryCode: "TR",
      resort,
      supplier: "Summertour",
      supplierCode: "SUMMERTOUR",
      startingPrice: minPrice,
      currency,
      offerCount: offers.length,
      rooms: uniqueRooms,
      meals: uniqueMeals,
      availableNights: uniqueNights,
      availableDates: uniqueDates,
      rawHotelKey: hotelKey,
      rawTourKey: offers[0]?.rawMetadata?.tourKey,
    };

    // Check if product exists
    const existing = await this.prisma.product.findUnique({
      where: { code: productCode },
      select: { id: true, code: true, status: true, version: true },
    });

    if (existing) {
      // Update attributes and tariff
      await this.prisma.$transaction(async (tx: any) => {
        await tx.product.update({
          where: { id: existing.id },
          data: { attributes, updatedAt: new Date() },
        });

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

      return "updated";
    }

    // Create new product
    const slug = this.buildSlug(tourIncValue, hotelKey, resort);
    const title = resort ? `${hotelName} (${resort}) — ${tourIncName}` : `${hotelName} — ${tourIncName}`;

    await this.prisma.$transaction(async (tx: any) => {
      const idResult = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO "catalog"."Product" (
          "id", "code", "type", "title", "slug", "status", "version",
          "categoryId", "attributes", "partnerId", "publishedAt", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), ${productCode}, 'TOUR'::"catalog"."ProductType",
          ${title}, ${slug}, 'PUBLISHED'::"catalog"."ProductStatus", 1,
          ${categoryId}, ${JSON.stringify(attributes)}::jsonb, ${partnerId},
          now(), now(), now()
        )
        RETURNING "id"
      `;
      const id = idResult[0].id;

      if (minPrice > 0) {
        await tx.$executeRaw`
          INSERT INTO "catalog"."Tariff" ("id", "code", "productId", "name", "price", "currency", "status", "version", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), ${`TRF-SUM-${hotelKey}-${tourIncValue}`}, ${id}, 'Base', ${minPrice}::decimal, ${currency}, 'ACTIVE'::"catalog"."RatePlanStatus", 1, now(), now())
        `;
      }

      await tx.$executeRaw`
        INSERT INTO "catalog"."ProductPublicationChannel" ("id", "productId", "channel", "createdAt")
        VALUES (gen_random_uuid(), ${id}, 'MARKETPLACE'::"catalog"."PublicationChannel", now())
      `;
      await tx.$executeRaw`
        INSERT INTO "catalog"."ProductPublicationChannel" ("id", "productId", "channel", "createdAt")
        VALUES (gen_random_uuid(), ${id}, 'PARTNER_STOREFRONT'::"catalog"."PublicationChannel", now())
      `;
    });

    return "created";
  }

  private buildSlug(tourIncValue: string, hotelKey: string, resort: string): string {
    const resortSlug = resort
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `summer-${tourIncValue}-${hotelKey}${resortSlug ? `-${resortSlug}` : ""}`;
  }

  private generateDateWindows(from: string, to: string): Array<{ from: string; to: string }> {
    const windows: Array<{ from: string; to: string }> = [];
    let current = new Date(from);
    const end = new Date(to);

    while (current < end) {
      const windowEnd = new Date(current);
      windowEnd.setDate(windowEnd.getDate() + 30);
      if (windowEnd > end) windowEnd.setTime(end.getTime());

      windows.push({
        from: this.formatDate(current),
        to: this.formatDate(windowEnd),
      });

      current = new Date(windowEnd);
      current.setDate(current.getDate() + 1);
    }

    return windows;
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
}
