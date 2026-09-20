/**
 * Summer Tour Catalog Sync Service — V3 Multi-Program.
 *
 * Idempotent pipeline: discover programs → per-program search with 31-day windows
 * → normalize → deduplicate → upsert Products.
 * One card per unique (tourIncValue, hotelKey). Starting price = min price across offers.
 * Runs as admin (no PARTNER ownership restrictions on create).
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { SupplierOfferService } from "../supplier-offer.service";
import { SummertourNewAdapter } from "./summertour-new.adapter";
import type { SupplierSearchQuery, SupplierOffer } from "../supplier.types";

export interface SyncResult {
  programsDiscovered: number;
  programsSearched: number;
  summerOffersReceived: number;
  uniqueNormalizedIdentities: number;
  newCards: number;
  updatedCards: number;
  unchangedCards: number;
  duplicatesSkipped: number;
  normalizationFailures: number;
  staleHidden: number;
  publishedVisible: number;
  programSummaries: ProgramSummary[];
  cards: SyncCardSummary[];
  errors: string[];
}

export interface ProgramSummary {
  tourIncValue: string;
  tourIncName: string;
  discoveryStatus: "discovered" | "searched" | "error";
  searchWindows: number;
  pagesScraped: number;
  offersReceived: number;
  uniqueOffers: number;
  existingCardsMatched: number;
  newCards: number;
  updatedCards: number;
  staleCards: number;
  errors: string[];
}

export interface SyncCardSummary {
  title: string;
  location: string;
  hotel: string;
  tour: string;
  program: string;
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
  tourIncValue: string;
  tourIncName: string;
  hotelKey: string;
  tourKey: string;
  hotelName: string;
  resort: string;
  countryCode: string;
}

/** 31-day date window. */
interface DateWindow {
  from: string;
  to: string;
}

@Injectable()
export class SummerSyncService {
  private readonly logger = new Logger(SummerSyncService.name);

  /** Maximum date range per SAMO search (31 days). */
  private static readonly MAX_DATE_WINDOW_DAYS = 31;

  constructor(
    private readonly prisma: PrismaService,
    private readonly offerService: SupplierOfferService,
    private readonly summertour: SummertourNewAdapter,
  ) {}

  /**
   * Run full V3 sync: discover programs → per-program search → normalize → upsert.
   * Idempotent: repeated syncs update prices, don't create duplicates.
   */
  async runSync(partnerId: string): Promise<SyncResult> {
    const syncStart = Date.now();
    this.logger.log(`Starting V3 Summer sync for partner ${partnerId}`);

    const result: SyncResult = {
      programsDiscovered: 0,
      programsSearched: 0,
      summerOffersReceived: 0,
      uniqueNormalizedIdentities: 0,
      newCards: 0,
      updatedCards: 0,
      unchangedCards: 0,
      duplicatesSkipped: 0,
      normalizationFailures: 0,
      staleHidden: 0,
      publishedVisible: 0,
      programSummaries: [],
      cards: [],
      errors: [],
    };

    // ── 1. Discover all Summer programs ─────────────────────────────
    const programs = await this.summertour.discoverPrograms();
    result.programsDiscovered = programs.length;

    if (programs.length === 0) {
      result.errors.push("No programs discovered from Summertour");
      this.logger.warn("No programs discovered");
      return result;
    }

    this.logger.log(`Discovered ${programs.length} programs: ${programs.map((p) => p.name).join(", ")}`);

    // ── 2. Get or create Summer partner ──────────────────────────────
    const summerPartner = await this.getSummerPartner();
    if (!summerPartner) {
      result.errors.push("Summer partner not found — run summer-partner-seed first");
      return result;
    }

    // ── 3. Get tours category ────────────────────────────────────────
    const toursCategory = await this.prisma.category.findUnique({
      where: { slug: "tours" },
      select: { id: true, slug: true },
    });
    if (!toursCategory) {
      result.errors.push("Category 'tours' not found");
      return result;
    }

    // ── 4. Search each program with 31-day windows ──────────────────
    // Collect all offers across all programs for global dedup
    const allOffersByProgram = new Map<string, SupplierOffer[]>();

    for (const program of programs) {
      const summary: ProgramSummary = {
        tourIncValue: program.value,
        tourIncName: program.name,
        discoveryStatus: "discovered",
        searchWindows: 0,
        pagesScraped: 0,
        offersReceived: 0,
        uniqueOffers: 0,
        existingCardsMatched: 0,
        newCards: 0,
        updatedCards: 0,
        staleCards: 0,
        errors: [],
      };

      try {
        // Generate 31-day date windows for the season (Sep 2026 — Mar 2027)
        const windows = this.generateDateWindows("2026-09-15", "2027-03-31");
        summary.searchWindows = windows.length;

        let programOffers: SupplierOffer[] = [];

        for (const window of windows) {
          try {
            const query: SupplierSearchQuery = {
              country: "turkey",
              departureCity: "baku",
              adults: 2,
              tourIncValue: program.value,
              tourIncName: program.name,
              departureDateFrom: window.from,
              departureDateTo: window.to,
            };

            const offers = await this.summertour.search(query);
            summary.offersReceived += offers.length;
            summary.pagesScraped += Math.ceil(offers.length / 100) || 1;
            programOffers = programOffers.concat(offers);

            this.logger.debug(
              `Program ${program.name}: window ${window.from}→${window.to}: ${offers.length} offers`,
            );
          } catch (err) {
            const msg = `Window ${window.from}→${window.to}: ${(err as Error).message}`;
            summary.errors.push(msg);
            this.logger.warn(msg);
          }
        }

        // Deduplicate within program
        const uniqueOffers = this.deduplicateOffers(programOffers);
        summary.uniqueOffers = uniqueOffers.length;
        allOffersByProgram.set(program.value, uniqueOffers);
        summary.discoveryStatus = "searched";
        result.programsSearched++;

        this.logger.log(
          `Program ${program.name}: ${summary.offersReceived} raw → ${summary.uniqueOffers} unique`,
        );
      } catch (err) {
        summary.discoveryStatus = "error";
        summary.errors.push((err as Error).message);
        result.errors.push(`Program ${program.name}: ${(err as Error).message}`);
        this.logger.error(`Program ${program.name} failed: ${(err as Error).message}`);
      }

      result.programSummaries.push(summary);
    }

    // ── 5. Normalize & group across all programs ─────────────────────
    const allOffers = Array.from(allOffersByProgram.values()).flat();
    result.summerOffersReceived = allOffers.length;

    if (allOffers.length === 0) {
      this.logger.warn("No offers received from any Summer program");
      return result;
    }

    const groups = this.groupOffers(allOffers);
    result.uniqueNormalizedIdentities = Object.keys(groups).length;
    this.logger.log(`Grouped into ${result.uniqueNormalizedIdentities} unique identities across all programs`);

    // ── 6. Upsert each card ──────────────────────────────────────────
    for (const [key, offers] of Object.entries(groups)) {
      try {
        const card = await this.upsertCard(key, offers, summerPartner.id, toursCategory.id);
        result.cards.push(card);

        if (card.action === "created") {
          result.newCards++;
          // Update program summary
          const progSummary = result.programSummaries.find(
            (s) => s.tourIncValue === offers[0].rawMetadata?.tourIncValue,
          );
          if (progSummary) progSummary.newCards++;
        } else if (card.action === "updated") {
          result.updatedCards++;
          const progSummary = result.programSummaries.find(
            (s) => s.tourIncValue === offers[0].rawMetadata?.tourIncValue,
          );
          if (progSummary) progSummary.updatedCards++;
        } else {
          result.unchangedCards++;
          const progSummary = result.programSummaries.find(
            (s) => s.tourIncValue === offers[0].rawMetadata?.tourIncValue,
          );
          if (progSummary) progSummary.existingCardsMatched++;
        }
      } catch (err) {
        result.errors.push(`Card ${key}: ${(err as Error).message}`);
        result.normalizationFailures++;
      }
    }

    // ── 7. Count published ───────────────────────────────────────────
    result.publishedVisible = result.cards.filter((c) => c.status === "PUBLISHED").length;

    const syncDuration = Date.now() - syncStart;
    this.logger.log(
      `V3 Sync complete in ${syncDuration}ms: ${result.programsSearched} programs, ` +
      `${result.summerOffersReceived} offers, ${result.uniqueNormalizedIdentities} unique, ` +
      `${result.newCards} created, ${result.updatedCards} updated, ${result.unchangedCards} unchanged, ` +
      `${result.publishedVisible} published`,
    );

    return result;
  }

  // ── Date Window Generation ────────────────────────────────────────

  /** Generate 31-day date windows covering the given range. */
  generateDateWindows(from: string, to: string): DateWindow[] {
    const windows: DateWindow[] = [];
    const maxDays = SummerSyncService.MAX_DATE_WINDOW_DAYS;

    let current = new Date(from);
    const end = new Date(to);

    while (current < end) {
      const windowEnd = new Date(current);
      windowEnd.setDate(windowEnd.getDate() + maxDays - 1);
      if (windowEnd > end) windowEnd.setTime(end.getTime());

      windows.push({
        from: this.formatDate(current),
        to: this.formatDate(windowEnd),
      });

      current = new Date(windowEnd);
      current.setDate(current.getDate() + 1); // next window starts day after
    }

    return windows;
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // ── Deduplication ─────────────────────────────────────────────────

  /** Remove duplicate offers within a program by externalOfferId. */
  private deduplicateOffers(offers: SupplierOffer[]): SupplierOffer[] {
    const seen = new Map<string, SupplierOffer>();
    for (const offer of offers) {
      const key = offer.externalOfferId;
      if (!seen.has(key)) {
        seen.set(key, offer);
      } else {
        // Keep the one with higher price (more recent) or the existing one
        const existing = seen.get(key)!;
        if (offer.price.amount > existing.price.amount) {
          seen.set(key, offer);
        }
      }
    }
    return Array.from(seen.values());
  }

  // ── Grouping ──────────────────────────────────────────────────────

  private groupOffers(offers: SupplierOffer[]): Record<string, SupplierOffer[]> {
    const groups: Record<string, SupplierOffer[]> = {};

    for (const offer of offers) {
      const identity = this.normalizeIdentity(offer);
      if (!identity) continue;

      // Group by: tourIncValue + hotelKey (program + hotel = one card)
      const key = `${identity.tourIncValue}:${identity.hotelKey}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(offer);
    }

    return groups;
  }

  private normalizeIdentity(offer: SupplierOffer): NormalizedIdentity | null {
    try {
      const tourIncValue = (offer.rawMetadata?.tourIncValue as string) ?? "0";
      const tourIncName = (offer.rawMetadata?.tourIncName as string) ?? "";
      const hotelKey = (offer.rawMetadata?.hotelKey as string) ?? offer.hotelExternalId ?? "";
      const tourKey = (offer.rawMetadata?.tourKey as string) ?? "";

      if (!hotelKey) return null;

      // Extract resort from hotel name: "HIMEROS BEACH HOTEL 3* (Сиде)" → "Сиде"
      const resortMatch = offer.hotel.match(/\(([^)]+)\)/);
      const resort = resortMatch?.[1] ?? "";

      return {
        tourIncValue,
        tourIncName,
        hotelKey,
        tourKey,
        hotelName: offer.hotel,
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
    const [tourIncValue, hotelKey] = key.split(":");
    const identity = this.normalizeIdentity(offers[0])!;

    // Stable product code: SUMMERTOUR-{tourIncValue}-{hotelKey}
    // Preserves backward compat with existing SUMMERTOUR-{tourKey}-{hotelKey} cards
    const productCode = `SUMMERTOUR-${tourIncValue}-${hotelKey}`;

    // Find minimum price across all offers
    const validOffers = offers.filter((o) => o.price.amount > 0);
    const minPrice = validOffers.length > 0
      ? Math.min(...validOffers.map((o) => o.price.amount))
      : 0;
    const currency = validOffers[0]?.price.currency ?? "USD";

    // Build title
    const title = this.buildTitle(identity);

    // Build slug (deterministic)
    const slug = this.buildSlug(tourIncValue, hotelKey, identity);

    // Extract unique rooms, meals, nights, and departure dates from scraped offers
    const uniqueRooms = [...new Set(offers.map((o) => o.room).filter((r): r is string => !!r))];
    const uniqueMeals = [...new Set(offers.map((o) => o.meal).filter((m): m is string => !!m))];
    const uniqueNights = [...new Set(offers.map((o) => o.nights).filter((n) => n > 0))].sort((a, b) => a - b);
    const uniqueDates = [...new Set(offers.map((o) => o.departureDate).filter((d) => d))].sort();

    const nights = offers[0]?.nights ?? 7;
    const days = nights + 1;

    const attributes: Record<string, unknown> = {
      days,
      nights,
      hotel: identity.hotelName,
      hotelKey,
      tour: identity.tourIncName,
      tourKey: offers[0]?.rawMetadata?.tourKey,
      tourIncValue,
      tourIncName: identity.tourIncName,
      country: "Turkey",
      countryCode: identity.countryCode,
      resort: identity.resort,
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
        tour: identity.tourIncName,
        program: identity.tourIncName,
        startingPrice: minPrice,
        currency,
        supplierRef: `tourInc=${tourIncValue}, hotelKey=${hotelKey}`,
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
          VALUES (gen_random_uuid(), ${`TRF-SUM-${hotelKey}-${tourIncValue}`}, ${id}, 'Base', ${minPrice}::decimal, ${currency}, 'ACTIVE'::"catalog"."RatePlanStatus", 1, now(), now())
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
      tour: identity.tourIncName,
      program: identity.tourIncName,
      startingPrice: minPrice,
      currency,
      supplierRef: `tourInc=${tourIncValue}, hotelKey=${hotelKey}`,
      productId: product!.id,
      productCode,
      status: product!.status,
      action: "created",
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private buildTitle(identity: NormalizedIdentity): string {
    const resort = identity.resort ? ` (${identity.resort})` : "";
    return `${identity.hotelName}${resort} — ${identity.tourIncName}`;
  }

  private buildSlug(tourIncValue: string, hotelKey: string, identity: NormalizedIdentity): string {
    const resort = identity.resort
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `summer-${tourIncValue}-${hotelKey}${resort ? `-${resort}` : ""}`;
  }

  private async getSummerPartner() {
    return this.prisma.partner.findFirst({
      where: { name: "Summer / Summertour" },
      select: { id: true, code: true, name: true },
    });
  }
}
