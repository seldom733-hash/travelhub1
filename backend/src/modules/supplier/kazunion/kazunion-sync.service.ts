/**
 * KazUnion Catalog Sync Service — idempotent pipeline (KOMPAS-style).
 *
 * Discover ALL countries from Baku → per-country programs → per-program
 * search in 31-day windows → group by program+hotel → upsert Products.
 * KazUnion serves 8 countries from Baku (China, Georgia, Kazakhstan,
 * Maldives, Qatar, Singapore, Thailand, Turkey) — all discovered live,
 * never hardcoded.
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { KazunionAdapter, kazunionCountryCandidates } from "./kazunion.adapter";
import type { SupplierOffer } from "../supplier.types";

export interface KazunionSyncResult {
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

export interface KazunionSyncOptions {
  /** Restrict sync to discovered countries whose name contains this (case-insensitive). */
  countryNameContains?: string;
  /** Search window override (ISO dates). Default: today → +30 days. */
  dateFrom?: string;
  dateTo?: string;
  /** Master Geography country code to link created cards (e.g. "TR"). */
  geoCountryCode?: string;
}

@Injectable()
export class KazunionSyncService {
  private readonly logger = new Logger(KazunionSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kazunion: KazunionAdapter,
  ) {}

  /** Find (or create) the KazUnion supplier partner. */
  async getKazunionPartner(): Promise<{ id: string } | null> {
    const existing = await this.prisma.partner.findFirst({
      where: { OR: [{ name: "KazUnion" }, { code: "PAR-KAZUNION" }] },
    });
    if (existing) return existing;
    this.logger.log("KazUnion partner not found — creating PAR-KAZUNION");
    return this.prisma.partner.create({
      data: { code: "PAR-KAZUNION", name: "KazUnion", status: "ACTIVE" },
    });
  }

  async runSync(
    partnerId: string,
    options?: KazunionSyncOptions,
  ): Promise<KazunionSyncResult> {
    const syncStart = Date.now();
    this.logger.log(`Starting KazUnion sync from Baku for partner ${partnerId}`);

    const result: KazunionSyncResult = {
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

    const toursCategory = await this.prisma.category.findFirst({
      where: { slug: "tours" },
    });
    if (!toursCategory) {
      result.errors.push("Tours category not found");
      return result;
    }

    // 1. Discover countries and programs from Baku
    let countryPrograms: Array<{
      countryId: string;
      countryName: string;
      programs: Array<{ value: string; name: string }>;
    }> = [];
    try {
      countryPrograms = await this.kazunion.discoverCountriesAndProgramsForSync();
      result.countriesDiscovered = countryPrograms.length;
      result.programsDiscovered = countryPrograms.reduce(
        (sum, c) => sum + c.programs.length,
        0,
      );
      this.logger.log(
        `KazUnion: ${result.countriesDiscovered} countries, ${result.programsDiscovered} programs from Baku`,
      );
    } catch (err) {
      result.errors.push(`Country/program discovery failed: ${(err as Error).message}`);
      return result;
    }

    // 1b. Optional country scope
    let scoped = countryPrograms;
    if (options?.countryNameContains) {
      const needle = options.countryNameContains.toLowerCase();
      // Aliases so "Turkey" matches the supplier's Russian label "Турция" and vice versa.
      const candidates = kazunionCountryCandidates(options.countryNameContains).map((c) =>
        c.toLowerCase(),
      );
      scoped = countryPrograms.filter((c) => {
        const name = c.countryName.toLowerCase();
        return candidates.some((cand) => name.includes(cand)) || name.includes(needle);
      });
      this.logger.log(
        `KazUnion country filter '${options.countryNameContains}': ${scoped.length} of ${countryPrograms.length} countries`,
      );
      if (scoped.length === 0) {
        result.errors.push(
          `No discovered country matches '${options.countryNameContains}'`,
        );
        return result;
      }
    }

    // 1c. Optional Master Geography linkage (country granularity — same
    // constraint as KOMPAS: offers do not carry city identity).
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

    // 2. Search each program in 31-day windows (SAMO is silent on wide ranges)
    const allOffers: SupplierOffer[] = [];
    const dateFrom = options?.dateFrom ?? this.formatDate(new Date());
    const dateTo =
      options?.dateTo ??
      this.formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    const windows = this.generateDateWindows(dateFrom, dateTo);

    for (const country of scoped) {
      for (const program of country.programs) {
        let programOffers = 0;
        for (const window of windows) {
          try {
            const offers = await this.kazunion.search({
              destination: country.countryName,
              adults: 2,
              tourIncValue: program.value,
              tourIncName: program.name,
              departureDateFrom: window.from,
              departureDateTo: window.to,
            });
            allOffers.push(...offers);
            programOffers += offers.length;
          } catch (err) {
            result.errors.push(
              `[${country.countryName}] ${program.name} ${window.from}→${window.to}: ${(err as Error).message}`,
            );
          }
        }
        result.programsSearched++;
        this.logger.log(
          `KazUnion [${country.countryName}] ${program.name}: ${programOffers} offers`,
        );
      }
    }

    result.offersReceived = allOffers.length;
    if (allOffers.length === 0) {
      this.logger.warn("No offers received from any KazUnion program");
      return result;
    }

    // 3. Group by tourIncValue + hotelKey
    const groups: Record<string, SupplierOffer[]> = {};
    for (const offer of allOffers) {
      const tourIncValue = (offer.rawMetadata?.tourIncValue as string) ?? "0";
      const hotelKey =
        (offer.rawMetadata?.hotelKey as string) ?? offer.hotelExternalId ?? "";
      if (!hotelKey) continue;
      const key = `${tourIncValue}:${hotelKey}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(offer);
    }
    result.uniqueIdentities = Object.keys(groups).length;
    this.logger.log(`Grouped into ${result.uniqueIdentities} unique identities`);

    // 4. Upsert each card (idempotent by code)
    for (const [key, offers] of Object.entries(groups)) {
      try {
        const [tourIncValue, hotelKey] = key.split(":");
        const productCode = `KAZUNION-${tourIncValue}-${hotelKey}`;

        const validOffers = offers.filter((o) => o.price.amount > 0);
        const minPrice =
          validOffers.length > 0
            ? Math.min(...validOffers.map((o) => o.price.amount))
            : 0;
        const currency = validOffers[0]?.price.currency ?? "USD";

        const rooms = Array.from(
          new Set(offers.map((o) => o.room).filter((r): r is string => !!r)),
        );
        const meals = Array.from(
          new Set(offers.map((o) => o.meal).filter((m): m is string => !!m)),
        );

        const hotelName = offers[0].hotel ?? "Unknown Hotel";
        const tourIncName = (offers[0].rawMetadata?.tourIncName as string) ?? "";
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
          supplierCode: "KAZUNION",
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
                data: {
                  attributes: { ...currentAttrs, startingPrice: minPrice, currency },
                },
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
            const geoPatch: { geoCountryId?: string } = {};
            if (geoCountryId && !(existing as any).geoCountryId) {
              geoPatch.geoCountryId = geoCountryId;
            }
            if (Object.keys(geoPatch).length > 0) {
              await tx.product.update({
                where: { id: existing.id },
                data: geoPatch,
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
            `kazunion-${tourIncValue}-${hotelKey}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          await this.prisma.$transaction(async (tx: any) => {
            const idResult = await tx.$queryRaw<{ id: string }[]>`
              INSERT INTO "catalog"."Product" (
                "id", "code", "type", "title", "slug", "status", "version",
                "categoryId", "attributes", "partnerId", "publishedAt", "createdAt", "updatedAt",
                "geoCountryId"
              ) VALUES (
                gen_random_uuid(), ${productCode}, 'TOUR'::"catalog"."ProductType",
                ${`${hotelName} — ${tourIncName}`}, ${slug}, 'PUBLISHED'::"catalog"."ProductStatus", 1,
                ${toursCategory.id}, ${JSON.stringify(attributes)}::jsonb, ${partnerId},
                now(), now(), now(),
                ${geoCountryId}
              )
              RETURNING "id"
            `;
            const productId = idResult[0].id;

            if (minPrice > 0) {
              await tx.$executeRaw`
                INSERT INTO "catalog"."Tariff" ("id", "code", "productId", "name", "price", "currency", "status", "version", "createdAt", "updatedAt")
                VALUES (gen_random_uuid(), ${`TRF-KZU-${hotelKey}-${tourIncValue}`}, ${productId}, 'Base', ${minPrice}::decimal, ${currency}, 'ACTIVE'::"catalog"."RatePlanStatus", 1, now(), now())
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

    this.logger.log(
      `KazUnion sync complete in ${Date.now() - syncStart}ms: ` +
        `${result.countriesDiscovered} countries, ${result.programsDiscovered} programs, ` +
        `${result.programsSearched} searched, ${result.offersReceived} offers, ` +
        `${result.uniqueIdentities} unique, ${result.newCards} created, ${result.updatedCards} updated`,
    );
    return result;
  }

  private generateDateWindows(
    from: string,
    to: string,
  ): Array<{ from: string; to: string }> {
    const windows: Array<{ from: string; to: string }> = [];
    const current = new Date(from);
    const end = new Date(to);
    while (current <= end) {
      const windowEnd = new Date(current);
      windowEnd.setDate(windowEnd.getDate() + 30);
      if (windowEnd > end) windowEnd.setTime(end.getTime());
      windows.push({ from: this.formatDate(current), to: this.formatDate(windowEnd) });
      current.setTime(windowEnd.getTime());
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
