/**
 * Summer Tour Catalog Sync Service
 *
 * Idempotent pipeline: Summertour search → normalize → deduplicate → upsert Products.
 * One card per unique (hotel, tour program). Starting price = min price across offers.
 * Runs as admin (no PARTNER ownership restrictions on create).
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { SupplierOfferService } from "../supplier-offer.service";
import { SummertourAdapter } from "./summertour.adapter";
import type { SupplierSearchQuery, SupplierOffer } from "../supplier.types";

export interface SyncResult {
  summerOffersReceived: number;
  uniqueNormalizedIdentities: number;
  newCards: number;
  updatedCards: number;
  duplicatesSkipped: number;
  normalizationFailures: number;
  staleHidden: number;
  publishedVisible: number;
  cards: SyncCardSummary[];
  errors: string[];
}

export interface SyncCardSummary {
  title: string;
  location: string;
  hotel: string;
  tour: string;
  startingPrice: number;
  currency: string;
  supplierRef: string;
  productId: string;
  productCode: string;
  status: string;
  action: "created" | "updated" | "unchanged";
}

/** Stable deduplication key from Summertour raw data. */
interface NormalizedIdentity {
  hotelKey: string;
  tourKey: string;
  hotelName: string;
  tourName: string;
  countryCode: string;
  resort: string;
}

@Injectable()
export class SummerSyncService {
  private readonly logger = new Logger(SummerSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly offerService: SupplierOfferService,
    private readonly summertour: SummertourAdapter,
  ) {}

  /**
   * Run full sync: search Summertour → normalize → upsert Products.
   * Idempotent: repeated syncs update prices, don't create duplicates.
   */
  async runSync(partnerId: string): Promise<SyncResult> {
    this.logger.log(`Starting Summer sync for partner ${partnerId}`);

    const result: SyncResult = {
      summerOffersReceived: 0,
      uniqueNormalizedIdentities: 0,
      newCards: 0,
      updatedCards: 0,
      duplicatesSkipped: 0,
      normalizationFailures: 0,
      staleHidden: 0,
      publishedVisible: 0,
      cards: [],
      errors: [],
    };

    // ── 1. Fetch all pages of offers ─────────────────────────────────
    let allOffers: SupplierOffer[] = [];
    for (let page = 1; page <= 5; page++) {
      try {
        const query: SupplierSearchQuery = {
          country: "turkey",
          departureCity: "baku",
          adults: 2,
          page,
        };
        const offers = await this.summertour.search(query);
        if (offers.length === 0) break;
        allOffers = allOffers.concat(offers);
        this.logger.log(`Page ${page}: ${offers.length} offers`);
      } catch (err) {
        result.errors.push(`Page ${page}: ${(err as Error).message}`);
        break;
      }
    }

    result.summerOffersReceived = allOffers.length;
    if (allOffers.length === 0) {
      this.logger.warn("No offers received from Summertour");
      return result;
    }

    // ── 2. Normalize & group by (hotel, tour) ────────────────────────
    const groups = this.groupOffers(allOffers);
    result.uniqueNormalizedIdentities = Object.keys(groups).length;
    this.logger.log(`Grouped into ${result.uniqueNormalizedIdentities} unique identities`);

    // ── 3. Get or create Summer partner ──────────────────────────────
    const summerPartner = await this.getSummerPartner();
    if (!summerPartner) {
      result.errors.push("Summer partner not found — run summer-partner-seed first");
      return result;
    }

    // ── 4. Get tours category ────────────────────────────────────────
    const toursCategory = await this.prisma.category.findUnique({
      where: { slug: "tours" },
      select: { id: true, slug: true },
    });
    if (!toursCategory) {
      result.errors.push("Category 'tours' not found");
      return result;
    }

    // ── 5. Upsert each card ──────────────────────────────────────────
    for (const [key, offers] of Object.entries(groups)) {
      try {
        const card = await this.upsertCard(key, offers, summerPartner.id, toursCategory.id);
        result.cards.push(card);
        if (card.action === "created") result.newCards++;
        else if (card.action === "updated") result.updatedCards++;
        else result.duplicatesSkipped++;
      } catch (err) {
        result.errors.push(`Card ${key}: ${(err as Error).message}`);
        result.normalizationFailures++;
      }
    }

    // ── 6. Count published ───────────────────────────────────────────
    result.publishedVisible = result.cards.filter((c) => c.status === "PUBLISHED").length;

    this.logger.log(
      `Sync complete: ${result.newCards} created, ${result.updatedCards} updated, ` +
      `${result.duplicatesSkipped} unchanged, ${result.publishedVisible} published`
    );

    return result;
  }

  // ── Grouping ──────────────────────────────────────────────────────

  private groupOffers(offers: SupplierOffer[]): Record<string, SupplierOffer[]> {
    const groups: Record<string, SupplierOffer[]> = {};

    for (const offer of offers) {
      const identity = this.normalizeIdentity(offer);
      if (!identity) continue;

      const key = `${identity.tourKey}:${identity.hotelKey}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(offer);
    }

    return groups;
  }

  private normalizeIdentity(offer: SupplierOffer): NormalizedIdentity | null {
    try {
      const hotelKey = offer.rawMetadata?.hotelKey as string ?? offer.hotelExternalId ?? "";
      const tourKey = offer.rawMetadata?.tourKey as string ?? "";

      if (!hotelKey || !tourKey) return null;

      // Extract resort from hotel name: "HIMEROS BEACH HOTEL 3* (Сиде)" → "Сиде"
      const resortMatch = offer.hotel.match(/\(([^)]+)\)/);
      const resort = resortMatch?.[1] ?? "";

      return {
        hotelKey,
        tourKey,
        hotelName: offer.hotel,
        tourName: offer.tour ?? "",
        countryCode: "TR", // Summertour only serves Turkey
        resort,
      };
    } catch {
      return null;
    }
  }

  // ── Card Upsert ──────────────────────────────────────────────────

  private async upsertCard(
    key: string,
    offers: SupplierOffer[],
    partnerId: string,
    categoryId: string,
  ): Promise<SyncCardSummary> {
    const [tourKey, hotelKey] = key.split(":");
    const identity = this.normalizeIdentity(offers[0])!;

    // Stable product code
    const productCode = `SUMMERTOUR-${tourKey}-${hotelKey}`;

    // Find minimum price across all offers
    const validOffers = offers.filter((o) => o.price.amount > 0);
    const minPrice = validOffers.length > 0
      ? Math.min(...validOffers.map((o) => o.price.amount))
      : 0;
    const currency = validOffers[0]?.price.currency ?? "USD";

    // Build title
    const title = this.buildTitle(identity);

    // Build slug (deterministic)
    const slug = this.buildSlug(tourKey, hotelKey, identity);

    // Build attributes (tours schema: days, nights, itinerary, included, excluded)
    const nights = offers[0]?.nights ?? 7;
    const days = nights + 1;
    const attributes: Record<string, unknown> = {
      days,
      nights,
      hotel: identity.hotelName,
      hotelKey,
      tour: identity.tourName,
      tourKey,
      country: "Turkey",
      countryCode: identity.countryCode,
      resort: identity.resort,
      supplier: "Summertour",
      supplierCode: "SUMMERTOUR",
      startingPrice: minPrice,
      currency,
      offerCount: offers.length,
      // Raw supplier references for future price calendar
      rawHotelKey: hotelKey,
      rawTourKey: tourKey,
    };

    // Check if product already exists
    const existing = await this.prisma.product.findUnique({
      where: { code: productCode },
      select: { id: true, code: true, status: true, version: true },
    });

    if (existing) {
      // Update: refresh attributes and tariffs
      await this.prisma.$transaction(async (tx: any) => {
        await tx.product.update({
          where: { id: existing.id },
          data: { attributes, updatedAt: new Date() },
        });

        // Update tariff price if changed
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

      return {
        title,
        location: `${identity.countryCode} / ${identity.resort}`,
        hotel: identity.hotelName,
        tour: identity.tourName,
        startingPrice: minPrice,
        currency,
        supplierRef: `hotelKey=${hotelKey}, tourKey=${tourKey}`,
        productId: existing.id,
        productCode,
        status: existing.status,
        action: "unchanged",
      };
    }

    // Create new product
    const product = await this.prisma.$transaction(async (tx: any) => {
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

      // Add default tariff
      if (minPrice > 0) {
        await tx.$executeRaw`
          INSERT INTO "catalog"."Tariff" ("id", "code", "productId", "name", "price", "currency", "status", "version", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), ${`TRF-SUM-${hotelKey}-${tourKey}`}, ${id}, 'Base', ${minPrice}::decimal, ${currency}, 'ACTIVE'::"catalog"."RatePlanStatus", 1, now(), now())
        `;
      }

      // Add publication channels (MARKETPLACE + PARTNER_STOREFRONT)
      await tx.$executeRaw`
        INSERT INTO "catalog"."ProductPublicationChannel" ("id", "productId", "channel", "createdAt")
        VALUES (gen_random_uuid(), ${id}, 'MARKETPLACE'::"catalog"."PublicationChannel", now())
      `;
      await tx.$executeRaw`
        INSERT INTO "catalog"."ProductPublicationChannel" ("id", "productId", "channel", "createdAt")
        VALUES (gen_random_uuid(), ${id}, 'PARTNER_STOREFRONT'::"catalog"."PublicationChannel", now())
      `;

      return tx.product.findUnique({ where: { id }, select: { id: true, code: true, status: true } });
    });

    return {
      title,
      location: `${identity.countryCode} / ${identity.resort}`,
      hotel: identity.hotelName,
      tour: identity.tourName,
      startingPrice: minPrice,
      currency,
      supplierRef: `hotelKey=${hotelKey}, tourKey=${tourKey}`,
      productId: product!.id,
      productCode,
      status: product!.status,
      action: "created",
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private buildTitle(identity: NormalizedIdentity): string {
    const resort = identity.resort ? ` (${identity.resort})` : "";
    return `${identity.hotelName}${resort} — ${identity.tourName}`;
  }

  private buildSlug(tourKey: string, hotelKey: string, identity: NormalizedIdentity): string {
    const resort = identity.resort
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `summer-${tourKey}-${hotelKey}${resort ? `-${resort}` : ""}`;
  }

  private async getSummerPartner() {
    return this.prisma.partner.findFirst({
      where: { name: "Summer / Summertour" },
      select: { id: true, code: true, name: true },
    });
  }
}
