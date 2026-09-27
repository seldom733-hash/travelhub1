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
import { KazunionAdapter, kazunionCountryCandidates, type KazunionSearchQuery } from "./kazunion.adapter";
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
  /** Master Geography country code to link created cards (e.g. "TR").
   *  Only used as fallback when the discovered country name has no ISO-2 mapping;
   *  per-card linkage is derived from the supplier's own country name. */
  geoCountryCode?: string;
}

/** Supplier country names (ru/en) → ISO-2 (geo directory codes). */
const COUNTRY_ISO: Record<string, string> = {
  "турция": "TR", "turkey": "TR",
  "китай": "CN", "china": "CN",
  "грузия": "GE", "georgia": "GE",
  "казахстан": "KZ", "kazakhstan": "KZ",
  "мальдивы": "MV", "maldives": "MV",
  "катар": "QA", "qatar": "QA",
  "сингапур": "SG", "singapore": "SG",
  "таиланд": "TH", "thailand": "TH",
};

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
      for (const c of countryPrograms) {
        if (c.programs.length === 0) {
          result.errors.push(
            `[${c.countryName}] no programs discovered (empty dictionary — possible supplier block)`,
          );
        }
      }
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

    // 2. Search each program in 31-day windows (SAMO is silent on wide ranges).
    //    Cards are persisted per program so a mid-run restart keeps progress.
    const defaultGeoCountryId = scoped.length === 1 ? geoCountryId : null;
    const dateFrom = options?.dateFrom ?? this.formatDate(new Date());
    const dateTo =
      options?.dateTo ??
      this.formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    const windows = this.generateDateWindows(dateFrom, dateTo);

    for (const country of scoped) {
      for (const program of country.programs) {
        let programOffers = 0;
        const programOfferList: SupplierOffer[] = [];
        for (const window of windows) {
          try {
            const offers = await this.kazunion.search({
              destination: country.countryName,
              adults: 2,
              tourIncValue: program.value,
              tourIncName: program.name,
              departureDateFrom: window.from,
              departureDateTo: window.to,
              // Full program inventory: 30 pages x 100 rows (UI keeps 5).
              maxPages: 30,
            } as KazunionSearchQuery);
            programOfferList.push(...offers);
            programOffers += offers.length;
          } catch (err) {
            result.errors.push(
              `[${country.countryName}] ${program.name} ${window.from}→${window.to}: ${(err as Error).message}`,
            );
          }
        }
        result.programsSearched++;
        result.offersReceived += programOffers;
        this.logger.log(
          `KazUnion [${country.countryName}] ${program.name}: ${programOffers} offers`,
        );
        if (programOfferList.length > 0) {
          await this.persistOffers(
            programOfferList,
            { toursCategoryId: toursCategory.id, partnerId, geoCountryId: defaultGeoCountryId },
            result,
          );
        }
      }
    }

    if (result.offersReceived === 0) {
      this.logger.warn("No offers received from any KazUnion program");
    } else {
      this.logger.log(`Grouped into ${result.uniqueIdentities} unique identities`);
    }

    this.logger.log(
      `KazUnion sync complete in ${Date.now() - syncStart}ms: ` +
        `${result.countriesDiscovered} countries, ${result.programsDiscovered} programs, ` +
        `${result.programsSearched} searched, ${result.offersReceived} offers, ` +
        `${result.uniqueIdentities} unique, ${result.newCards} created, ${result.updatedCards} updated`,
    );
    return result;
  }

  /** Group a program's offers by identity (tourInc+hotel) and upsert cards. */
  private async persistOffers(
    offers: SupplierOffer[],
    ctx: { toursCategoryId: string; partnerId: string; geoCountryId: string | null },
    result: KazunionSyncResult,
  ): Promise<void> {
    const groups: Record<string, SupplierOffer[]> = {};
    for (const offer of offers) {
      const tourIncValue = (offer.rawMetadata?.tourIncValue as string) ?? "0";
      const hotelKey =
        (offer.rawMetadata?.hotelKey as string) ?? offer.hotelExternalId ?? "";
      if (!hotelKey) continue;
      const key = `${tourIncValue}:${hotelKey}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(offer);
    }
    result.uniqueIdentities += Object.keys(groups).length;

    // Upsert each card (idempotent by code)
    for (const [key, groupOffers] of Object.entries(groups)) {
      try {
        const [tourIncValue, hotelKey] = key.split(":");
        const productCode = `KAZUNION-${tourIncValue}-${hotelKey}`;

        const validOffers = groupOffers.filter((o) => o.price.amount > 0);
        const minPrice =
          validOffers.length > 0
            ? Math.min(...validOffers.map((o) => o.price.amount))
            : 0;
        const currency = validOffers[0]?.price.currency ?? "USD";

        const rooms = Array.from(
          new Set(groupOffers.map((o) => o.room).filter((r): r is string => !!r)),
        );
        const meals = Array.from(
          new Set(groupOffers.map((o) => o.meal).filter((m): m is string => !!m)),
        );

        const hotelName = groupOffers[0].hotel ?? "Unknown Hotel";
        const tourIncName = (groupOffers[0].rawMetadata?.tourIncName as string) ?? "";
        const country = (groupOffers[0].rawMetadata?.country as string) ?? "Unknown";

        // Country granularity geo link: discovered name → ISO-2 → geo id
        // (per card, so a full 8-country sync links each card correctly).
        const cardGeoId = (await this.geoIdForCountry(country)) ?? ctx.geoCountryId;

        const attributes = {
          hotelName,
          hotelKey,
          tourIncValue,
          tourIncName,
          rooms,
          meals,
          nights: groupOffers[0].nights,
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
            if (cardGeoId && !(existing as any).geoCountryId) {
              geoPatch.geoCountryId = cardGeoId;
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
                ${ctx.toursCategoryId}, ${JSON.stringify(attributes)}::jsonb, ${ctx.partnerId},
                now(), now(), now(),
                ${cardGeoId}
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
  }

  /** ISO-2 → geo country id (cached). Returns null when unmapped/absent. */
  private readonly geoIsoCache = new Map<string, string | null>();

  private async geoIdForCountry(countryName: string): Promise<string | null> {
    const iso = COUNTRY_ISO[countryName.trim().toLowerCase()];
    if (!iso) return null;
    if (this.geoIsoCache.has(iso)) return this.geoIsoCache.get(iso)!;
    const gc = await this.prisma.geoCountry.findUnique({
      where: { code: iso },
      select: { id: true },
    });
    const id = gc?.id ?? null;
    this.geoIsoCache.set(iso, id);
    return id;
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
