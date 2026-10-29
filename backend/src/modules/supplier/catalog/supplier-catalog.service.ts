import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { IdsService } from "../../../shared/ids.service";
import { SupplierCatalogSource } from "./supplier-catalog.source";
import { SupplierAdapterRegistry } from "../adapter/supplier-adapter.registry";
import { HotelPhotoSyncService } from "../../catalog/hotel/hotel-photo-sync.service";
import type {
  CatalogCapability,
  CatalogItemAction,
  CatalogPlan,
  CatalogPlanItem,
  CatalogRecord,
  CatalogServiceType,
} from "./supplier-catalog.types";

type RunServiceType = CatalogServiceType | "all";
type RunStatus = "PREVIEWING" | "PREVIEW_READY" | "APPLYING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";

const PARTNER_NAME: Record<string, string> = {
  ANEX: "Anextour",
  VOYAGER: "Voyager",
  KOMPAS: "Kompastour",
  KAZUNION: "Kazunion",
  SUMMERTOUR: "Summertour",
  FSTRAVEL: "FSTravel",
};

function stableHash(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 16);
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90) || "supplier-product";
}

function recordFromJson(value: unknown): CatalogRecord {
  return value as CatalogRecord;
}

@Injectable()
export class SupplierCatalogService implements OnModuleInit {
  private readonly logger = new Logger(SupplierCatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly source: SupplierCatalogSource,
    private readonly registry?: SupplierAdapterRegistry,
    private readonly photoSync?: HotelPhotoSyncService,
  ) {}

  async onModuleInit(): Promise<void> {
    // A process restart or killed background job can leave an active run
    // holding activeKey forever. A sampled one-year ANEX sweep can take up to
    // an hour; allow a 90-minute stale window.
    const cutoff = new Date(Date.now() - 90 * 60 * 1000);
    const stale = await this.prisma.supplierCatalogRun.updateMany({
      where: { status: { in: ["PREVIEWING", "APPLYING"] }, startedAt: { lt: cutoff } },
      data: {
        status: "FAILED",
        coverage: "FAILED",
        activeKey: null,
        finishedAt: new Date(),
        errors: { fatal: "stale run: process restarted or source did not settle" },
      },
    });
    if (stale.count > 0) this.logger.warn(`Marked ${stale.count} stale supplier catalog run(s) as FAILED`);
  }

  capabilities(): Promise<CatalogCapability[]> {
    return this.source.capabilities();
  }

  /** Hide capabilities whose CRM partner is not ACTIVE (e.g. FSTravel). */
  async activeCapabilities(): Promise<CatalogCapability[]> {
    const caps = await this.source.capabilities();
    // Persisted discovery adds countries that were not in the static supplier
    // dictionary at release time. Deduplicate by supplier/service/key.
    const discovered = await this.prisma.supplierCatalogCountry.findMany({
      orderBy: { countryLabel: "asc" },
    });
    for (const row of discovered) {
      let cap = caps.find((c) => c.supplierCode === row.supplierCode && c.serviceTypes.includes(row.serviceType as CatalogServiceType));
      if (!cap) {
        cap = {
          supplierCode: row.supplierCode,
          name: row.supplierCode,
          serviceTypes: [row.serviceType as CatalogServiceType],
          countries: [],
        };
        caps.push(cap);
      }
      if (!cap.countries.some((c) => c.key === row.countryKey)) {
        cap.countries.push({ key: row.countryKey, label: row.countryLabel });
      }
    }
    const names = [...new Set(caps.map((c) => PARTNER_NAME[c.supplierCode]).filter(Boolean))];
    if (names.length === 0) return caps;
    const partners = await this.prisma.partner.findMany({
      where: { name: { in: names } },
      select: { name: true, status: true },
    });
    const statusByName = new Map(partners.map((p) => [p.name, p.status]));
    return caps.map((cap) => {
      const name = PARTNER_NAME[cap.supplierCode];
      const status = name ? statusByName.get(name) : undefined;
      if (!name || status === "ACTIVE") return cap;
      return {
        ...cap,
        countries: [],
        unavailableReason: `Supplier partner ${name} is ${status ?? "missing"}; catalog sync requires ACTIVE`,
      };
    });
  }

  /**
   * Discover supplier-native countries and persist only those that resolve to
   * a Master Geography ISO-2 code. Unknown names are reported, never guessed.
   */
  async discoverCountries(
    actor: { id: string; username: string },
    input: { supplierCode: string; serviceType: CatalogServiceType },
  ) {
    const adapter = this.registry?.get(input.supplierCode, input.serviceType);
    if (!adapter) return { discovered: 0, skipped: 0, countries: [] };
    let raw: Array<{ countryId?: string; countryName?: string }> = [];
    const anyAdapter = adapter as unknown as {
      discoverCountries?: () => Promise<Array<{ countryId?: string; countryName?: string }>>;
      discoverCountriesAndPrograms?: () => Promise<Array<{ countryId?: string; countryName?: string }>>;
      discoverCountriesAndProgramsForSync?: () => Promise<Array<{ countryId?: string; countryName?: string }>>;
    };
    if (input.supplierCode === "VOYAGER" && anyAdapter.discoverCountries) {
      raw = await anyAdapter.discoverCountries();
    } else if (input.supplierCode === "KAZUNION" && anyAdapter.discoverCountries) {
      raw = await anyAdapter.discoverCountries();
    } else if (input.serviceType === "tours" && input.supplierCode === "KOMPAS" && anyAdapter.discoverCountriesAndPrograms) {
      raw = await anyAdapter.discoverCountriesAndPrograms();
    } else if (input.serviceType === "tours" && input.supplierCode === "KAZUNION" && anyAdapter.discoverCountriesAndProgramsForSync) {
      raw = await anyAdapter.discoverCountriesAndProgramsForSync();
    } else if (input.serviceType === "hotels" && input.supplierCode === "KOMPAS" && anyAdapter.discoverCountries) {
      raw = await anyAdapter.discoverCountries();
    }

    const geo = await this.prisma.geoCountry.findMany({
      where: { status: "ACTIVE" },
      select: { code: true, names: true },
    });
    const byName = new Map<string, string>();
    for (const country of geo) {
      const names = (country.names ?? {}) as Record<string, unknown>;
      for (const value of Object.values(names)) {
        if (typeof value === "string") byName.set(this.normalizeCountry(value), country.code);
      }
    }
    const resolved = new Map<string, string>();
    let skipped = 0;
    for (const country of raw) {
      const name = country.countryName?.trim();
      if (!name) { skipped += 1; continue; }
      const iso = /^[A-Za-z]{2}$/.test(country.countryId ?? "")
        ? country.countryId!.toUpperCase()
        : byName.get(this.normalizeCountry(name));
      if (!iso) { skipped += 1; continue; }
      resolved.set(iso, name);
    }

    const existing = await this.prisma.supplierCatalogCountry.findMany({
      where: { supplierCode: input.supplierCode, serviceType: input.serviceType },
      select: { countryKey: true },
    });
    const known = new Set(existing.map((row) => row.countryKey));
    for (const [key, label] of resolved) {
      await this.prisma.supplierCatalogCountry.upsert({
        where: {
          supplierCode_serviceType_countryKey: {
            supplierCode: input.supplierCode,
            serviceType: input.serviceType,
            countryKey: key,
          },
        },
        create: { supplierCode: input.supplierCode, serviceType: input.serviceType, countryKey: key, countryLabel: label, source: "DISCOVERED" },
        update: { countryLabel: label, lastSeenAt: new Date() },
      });
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        username: actor.username,
        action: "supplier_catalog.countries_discovered",
        resource: "SupplierCatalogCountry",
        resourceId: `${input.supplierCode}:${input.serviceType}`,
        details: { discovered: resolved.size, skipped } as Prisma.InputJsonValue,
      },
    }).catch(() => undefined);
    return {
      discovered: [...resolved.keys()].filter((key) => !known.has(key)).length,
      skipped,
      countries: [...resolved.entries()].map(([key, label]) => ({ key, label })),
    };
  }

  private normalizeCountry(value: string): string {
    return value.toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, "");
  }

  /**
   * One successful full country sync per supplier/service per Baku day.
   * A completed ALL run also counts as covering its countries.
   */
  private async assertCountryNotSyncedToday(
    supplierCode: string,
    services: CatalogServiceType[],
    countryCode: string,
  ): Promise<void> {
    // Temporary operational escape hatch: allows a deliberate re-sync of a
    // country already completed today (e.g. after a price-currency fix).
    // Enabled only via the backend process env, never persisted in the DB.
    if (process.env.SUPPLIER_CATALOG_ALLOW_RERUN_TODAY === "true") return;
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Baku",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const dayStart = new Date(`${day}T00:00:00+04:00`);
    const runs = await this.prisma.supplierCatalogRun.findMany({
      where: {
        supplierCode,
        status: "COMPLETED",
        coverage: "COMPLETE",
        finishedAt: { gte: dayStart },
      },
      select: { serviceType: true, countryCode: true, scope: true },
    });
    const covers = (run: { serviceType: string; countryCode: string | null; scope: Prisma.JsonValue | null }, service: CatalogServiceType) => {
      if (run.serviceType !== service && run.serviceType !== "all") return false;
      if (run.countryCode?.toUpperCase() === countryCode.toUpperCase()) return true;
      const scope = (run.scope ?? {}) as { countries?: unknown; countriesByService?: Record<string, unknown> };
      const countries = scope.countriesByService?.[service] ?? scope.countries;
      return Array.isArray(countries) && countries.some((value) => String(value).toUpperCase() === countryCode.toUpperCase());
    };
    const missing = services.filter((service) => !runs.some((run) => covers(run, service)));
    if (missing.length > 0) return;
    const subject = services.length === 2 ? "туры и отели" : services[0] === "tours" ? "туры" : "отели";
    throw new ConflictException(
      `Сегодня для страны ${countryCode} ${subject} уже полностью загружены. Повторный синк этой страны запрещён до завтра.`,
    );
  }

  async startPreview(
    actor: { id: string; username: string },
    input: { supplierCode: string; serviceType: RunServiceType; countryKey: string },
  ) {
    const neededServices: CatalogServiceType[] = input.serviceType === "all" ? ["tours", "hotels"] : [input.serviceType];
    const allCountries = input.countryKey === "ALL";
    if (!allCountries) {
      await this.assertCountryNotSyncedToday(input.supplierCode, neededServices, input.countryKey);
    }
    // ALL = every country the supplier has, including countries discovered
    // after the static dictionary was released. Discover BEFORE building the
    // scope so the first ALL preview already contains them; persisted rows are
    // also what the country picker reads on the next capabilities request.
    if (allCountries) {
      for (const service of neededServices) {
        try {
          await this.discoverCountries(actor, {
            supplierCode: input.supplierCode,
            serviceType: service,
          });
        } catch (error) {
          this.logger.warn(
            `Pre-preview country discovery ${input.supplierCode}/${service} failed: ${(error as Error).message}`,
          );
        }
      }
    }
    const capabilities = await this.activeCapabilities();
    const supported = neededServices.filter((service) =>
      capabilities.some(
        (cap) =>
          cap.supplierCode === input.supplierCode &&
          cap.serviceTypes.includes(service) &&
          (allCountries ? cap.countries.length > 0 : cap.countries.some((country) => country.key === input.countryKey)),
      ),
    );
    if (supported.length === 0 || (input.serviceType !== "all" && supported.length !== 1)) {
      throw new BadRequestException("This supplier/category/country is not supported by the catalog importer");
    }
    const countriesByService: Record<string, string[]> = {};
    for (const service of supported) {
      countriesByService[service] = allCountries
        ? [...new Set(
            capabilities
              .filter((cap) => cap.supplierCode === input.supplierCode && cap.serviceTypes.includes(service))
              .flatMap((cap) => cap.countries.map((country) => country.key)),
          )]
        : [input.countryKey];
    }
    const countries = allCountries
      ? [...new Set(Object.values(countriesByService).flat())]
      : [input.countryKey];

    const partnerName = PARTNER_NAME[input.supplierCode];
    if (partnerName) {
      const partner = await this.prisma.partner.findFirst({
        where: { name: partnerName },
        select: { status: true },
      });
      if (!partner || partner.status !== "ACTIVE") {
        throw new BadRequestException(
          `Supplier partner ${partnerName} is ${partner?.status ?? "missing"}; catalog sync requires ACTIVE`,
        );
      }
    }

    const run = await this.prisma.supplierCatalogRun.create({
      data: {
        supplierCode: input.supplierCode,
        serviceType: input.serviceType,
        countryCode: input.countryKey,
        status: "PREVIEWING",
        coverage: "PARTIAL",
        activeKey: `preview:${input.supplierCode}:${input.serviceType}:${input.countryKey}`,
        createdById: actor.id,
        createdByName: actor.username,
        scope: { ...input, countries, countriesByService },
      },
    }).catch((error) => {
      if ((error as { code?: string }).code === "P2002") {
        throw new ConflictException("A preview for this supplier/category/country is already running");
      }
      throw error;
    });

    void this.executePreview(run.id, { ...input, countries, countriesByService }, actor).catch(async (error) => {
      this.logger.error(`Preview ${run.id} failed: ${(error as Error).message}`);
      await this.failRun(run.id, (error as Error).message).catch(() => undefined);
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        username: actor.username,
        action: "supplier_catalog.preview_started",
        resource: "SupplierCatalogRun",
        resourceId: run.id,
        details: { ...input } as Prisma.InputJsonValue,
      },
    }).catch(() => undefined);

    return this.getRun(run.id);
  }

  async listRuns(limit = 30) {
    return this.prisma.supplierCatalogRun.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
      select: {
        id: true,
        supplierCode: true,
        serviceType: true,
        countryCode: true,
        status: true,
        coverage: true,
        counts: true,
        errors: true,
        createdAt: true,
        finishedAt: true,
        confirmedAt: true,
        createdByName: true,
      },
    });
  }

  async getRun(id: string) {
    const run = await this.prisma.supplierCatalogRun.findUnique({
      where: { id },
      include: { items: { orderBy: { createdAt: "asc" }, take: 1000 } },
    });
    if (!run) throw new NotFoundException("Supplier catalog run not found");
    const photos = await this.photoStatusByItem(run.items);
    return {
      ...run,
      items: run.items.map((item) => ({
        ...item,
        photo: photos.get(item.id) ? "YES" : "NO",
      })),
    };
  }

  /**
   * Photo column of the update report. "YES" means the shared physical-hotel
   * file exists under frontend/public/hotels (or an uploaded ProductMedia
   * primary image exists); "NO" means neither is available.
   */
  private async photoStatusByItem(
    items: Array<{
      id: string;
      productId: string | null;
      before: Prisma.JsonValue | null;
      after: Prisma.JsonValue | null;
    }>,
  ): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();
    const pairs: Array<{ supplierCode: string; externalKey: string }> = [];
    const productIds: string[] = [];
    const itemPair = new Map<string, string>();
    for (const item of items) {
      if (item.productId) productIds.push(item.productId);
      const value = (item.after ?? item.before) as { attributes?: Record<string, unknown> } | null;
      const attrs = value?.attributes ?? {};
      const supplierCode = typeof attrs.supplierCode === "string" ? attrs.supplierCode : "";
      const externalKey =
        typeof attrs.hotelKey === "string"
          ? attrs.hotelKey
          : typeof attrs.hotelExternalId === "string"
            ? attrs.hotelExternalId
            : "";
      if (supplierCode && externalKey) {
        pairs.push({ supplierCode, externalKey });
        itemPair.set(item.id, `${supplierCode}\u0000${externalKey}`);
      }
    }
    const [refs, media] = await Promise.all([
      pairs.length
        ? this.prisma.hotelSupplierRef.findMany({
            where: { OR: pairs },
            select: {
              supplierCode: true,
              externalKey: true,
              hotel: { select: { photoFile: true, photoStatus: true } },
            },
          })
        : Promise.resolve([]),
      productIds.length
        ? this.prisma.productMedia.findMany({
            where: { productId: { in: productIds }, isPrimary: true, status: "PUBLISHED" },
            select: { productId: true },
          })
        : Promise.resolve([]),
    ]);
    const mediaProducts = new Set(media.map((m) => m.productId));
    const photoByPair = new Map(
      refs.map((ref) => [
        `${ref.supplierCode}\u0000${ref.externalKey}`,
        Boolean(ref.hotel?.photoFile && this.hotelPhotoFileExists(ref.hotel.photoFile)),
      ]),
    );
    for (const item of items) {
      const pair = itemPair.get(item.id);
      result.set(item.id, Boolean(item.productId && mediaProducts.has(item.productId)) || Boolean(pair && photoByPair.get(pair)));
    }
    return result;
  }

  private hotelPhotoFileExists(photoFile: string): boolean {
    const candidates = [
      path.resolve(process.cwd(), "../frontend/public/hotels", photoFile),
      path.resolve(process.cwd(), "frontend/public/hotels", photoFile),
      path.resolve(__dirname, "../../../../frontend/public/hotels", photoFile),
    ];
    return candidates.some((candidate) => fs.existsSync(candidate));
  }

  async confirm(actor: { id: string; username: string }, id: string) {
    const run = await this.prisma.supplierCatalogRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException("Supplier catalog run not found");
    if (run.status !== "PREVIEW_READY") {
      throw new ConflictException(`Run is ${run.status}; only PREVIEW_READY can be confirmed`);
    }
    if (run.coverage === "FAILED") {
      throw new ConflictException("Preview failed; cannot apply");
    }
    const locked = await this.prisma.supplierCatalogRun.updateMany({
      where: { id, status: "PREVIEW_READY", activeKey: null },
      data: { status: "APPLYING", activeKey: `apply:${id}`, confirmedAt: new Date() },
    });
    if (locked.count === 0) throw new ConflictException("Run is already being applied");

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        username: actor.username,
        action: "supplier_catalog.apply_confirmed",
        resource: "SupplierCatalogRun",
        resourceId: id,
        details: { supplierCode: run.supplierCode, serviceType: run.serviceType, countryCode: run.countryCode } as Prisma.InputJsonValue,
      },
    }).catch(() => undefined);

    void this.executeApply(id).catch(async (error) => {
      this.logger.error(`Apply ${id} failed: ${(error as Error).message}`);
      await this.finishRun(id, "FAILED", { error: (error as Error).message }).catch(() => undefined);
    });

    return this.getRun(id);
  }

  async cancel(id: string) {
    const run = await this.prisma.supplierCatalogRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException("Supplier catalog run not found");
    if (!["PREVIEWING", "PREVIEW_READY"].includes(run.status)) {
      throw new ConflictException("Only a preview can be cancelled");
    }
    return this.prisma.supplierCatalogRun.update({
      where: { id },
      data: { status: "CANCELLED", activeKey: null, finishedAt: new Date() },
    });
  }

  /**
   * Explicit manual approval for a legacy archived card. Nothing is restored
   * automatically; the operator must select the preview item after reviewing
   * its before/after identifiers.
   */
  async manualRestore(actor: { id: string; username: string }, runId: string, itemId: string) {
    const item = await this.prisma.supplierCatalogRunItem.findFirst({
      where: { id: itemId, runId },
    });
    if (!item) throw new NotFoundException("Preview item not found");
    if (item.action !== "LEGACY_ARCHIVED") {
      throw new ConflictException("Only LEGACY_ARCHIVED preview items need manual restore");
    }
    if (!item.productId || !item.after) throw new ConflictException("Preview item has no product/source record");
    await this.restoreProduct(runId, item.productId, recordFromJson(item.after));
    await this.prisma.supplierCatalogRunItem.update({
      where: { id: item.id },
      data: {
        action: "RESTORE",
        applied: true,
        reason: `Manual restore approved by ${actor.username}`,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        username: actor.username,
        action: "supplier_catalog.item_restored",
        resource: "SupplierCatalogRun",
        resourceId: runId,
        details: { itemId, productId: item.productId, externalKey: item.externalKey } as Prisma.InputJsonValue,
      },
    });
    return this.getRun(runId);
  }

  private async executePreview(
    id: string,
    input: { supplierCode: string; serviceType: RunServiceType; countryKey: string; countries?: string[]; countriesByService?: Record<string, string[]> },
    actor: { id: string; username: string },
  ): Promise<void> {
    let records: CatalogRecord[] = [];
    let complete = true;
    const errors: string[] = [];
    const sourceScopes: Record<string, unknown>[] = [];
    const services: CatalogServiceType[] = input.serviceType === "all" ? ["tours", "hotels"] : [input.serviceType];
    for (const service of services) {
      const countryKeys = input.countriesByService?.[service] ?? input.countries ?? [input.countryKey];
      for (const countryKey of countryKeys) {
        const result = await this.withTimeout(
          this.source.fetch({ supplierCode: input.supplierCode, serviceType: service, countryKey }),
          60 * 60 * 1000,
          `${input.supplierCode}/${service}/${countryKey} source timeout`,
        );
        records = records.concat(result.records);
        complete = complete && result.complete;
        errors.push(...result.errors);
        sourceScopes.push({ service, countryKey, ...result.scope });
      }
    }
    if (errors.length > 0 && records.length === 0) {
      await this.failRun(id, errors.join("; "));
      return;
    }
    const plan = await this.buildPlan(records, complete, input);
    const coverage = complete && errors.length === 0 ? "COMPLETE" : "PARTIAL";
    plan.coverage = coverage;
    plan.errors = errors;
    const counts = this.counts(plan.items);

    await this.prisma.$transaction(async (tx) => {
      await tx.supplierCatalogRunItem.deleteMany({ where: { runId: id } });
      if (plan.items.length > 0) {
        await tx.supplierCatalogRunItem.createMany({
          data: plan.items.map((item) => ({
            runId: id,
            productId: item.productId,
            supplierRef: item.supplierRef,
            externalKey: item.externalKey,
            action: item.action,
            reason: item.reason ?? null,
            before: item.before as Prisma.InputJsonValue ?? undefined,
            after: item.after as Prisma.InputJsonValue ?? undefined,
            error: item.error ?? null,
          })),
        });
      }
      await tx.supplierCatalogRun.update({
        where: { id },
        data: {
          status: "PREVIEW_READY",
          coverage,
          counts: counts as Prisma.InputJsonValue,
          errors: (errors.length ? errors : Prisma.DbNull) as Prisma.InputJsonValue,
          scope: { ...input, sourceScopes } as Prisma.InputJsonValue,
          activeKey: null,
          finishedAt: new Date(),
        },
      });
    });

    // New supplier countries are persisted after a successful preview, so the
    // next capabilities request can offer them. Discovery never changes
    // Products and never starts apply/archive.
    if (
      input.serviceType !== "all" &&
      ["KOMPAS", "KAZUNION", "VOYAGER"].includes(input.supplierCode)
    ) {
      void this.discoverCountries(actor, { supplierCode: input.supplierCode, serviceType: input.serviceType })
        .catch((error) => this.logger.warn(`Country discovery after ${id} failed: ${(error as Error).message}`));
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async executeApply(id: string): Promise<void> {
    const run = await this.prisma.supplierCatalogRun.findUnique({ where: { id }, include: { items: true } });
    if (!run) throw new NotFoundException("Supplier catalog run not found");
    const errors: string[] = [];
    let applied = 0;
    for (const item of run.items) {
      if (["AMBIGUOUS", "LEGACY_ARCHIVED", "UNCHANGED"].includes(item.action)) continue;
      if (item.action === "ARCHIVE" && run.coverage !== "COMPLETE") {
        errors.push(`${item.externalKey}: archive blocked — coverage is ${run.coverage}`);
        continue;
      }
      try {
        await this.applyItem(id, item);
        await this.prisma.supplierCatalogRunItem.update({ where: { id: item.id }, data: { applied: true } });
        applied += 1;
      } catch (error) {
        errors.push(`${item.externalKey}: ${(error as Error).message}`);
        await this.prisma.supplierCatalogRunItem.update({
          where: { id: item.id },
          data: { error: (error as Error).message, applied: false },
        });
      }
    }
    await this.finishRun(id, errors.length ? "PARTIAL" : "COMPLETED", {
      applied,
      errors: errors.length ? errors : null,
    });
    // Photos are a best-effort post-apply step: never fail a completed sync
    // because an external image provider is unavailable.
    void this.photoSync?.afterApply(run.supplierCode).catch((error) =>
      this.logger.warn(`Photo backfill after run ${id} failed: ${(error as Error).message}`),
    );
  }

  private async applyItem(runId: string, item: {
    id: string;
    action: string;
    productId: string | null;
    externalKey: string;
    supplierRef: string | null;
    after: Prisma.JsonValue | null;
  }): Promise<void> {
    if (item.action === "ARCHIVE") {
      if (!item.productId) throw new Error("Archive item has no Product");
      await this.archiveProduct(runId, item.productId);
      return;
    }
    const record = item.after ? recordFromJson(item.after) : null;
    if (!record) throw new Error("Preview item has no source record");
    if (item.action === "CREATE") {
      await this.createProduct(runId, record);
      return;
    }
    if (!item.productId) throw new Error("Preview item has no Product");
    if (item.action === "UPDATE") {
      await this.updateProduct(item.productId, record);
      return;
    }
    if (item.action === "RESTORE") {
      await this.restoreProduct(runId, item.productId, record);
    }
  }

  private async createProduct(runId: string, record: CatalogRecord): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { slug: record.categorySlug } });
    if (!category) throw new Error(`Category ${record.categorySlug} not found`);
    const partnerName = PARTNER_NAME[record.supplierCode] ?? record.supplierCode;
    const partner = await this.prisma.partner.findFirst({ where: { name: partnerName } });
    if (!partner) throw new Error(`Partner ${partnerName} not found`);
    const geo = await this.geoCountryId(record.countryCode);
    const baseSlug = slugify(record.externalKey);
    let slug = baseSlug;
    let product: { id: string; code: string };

    try {
      product = await this.prisma.$transaction(async (tx) => {
        const code = await this.ids.nextCode(tx, "PRD");
        const existingSlug = await tx.product.findUnique({ where: { slug } });
        if (existingSlug) slug = `${baseSlug}-${stableHash(record.externalKey)}`;
        const created = await tx.product.create({
          data: {
            code,
            supplierRef: record.externalKey,
            type: record.productType,
            title: record.title,
            slug,
            status: "PUBLISHED",
            version: 1,
            publishedAt: new Date(),
            categoryId: category.id,
            partnerId: partner.id,
            attributes: record.attributes as Prisma.InputJsonValue,
            geoCountryId: geo,
          },
          select: { id: true, code: true },
        });
        await tx.productPublicationChannel.create({
          data: { productId: created.id, channel: "MARKETPLACE" },
        });
        await this.upsertTariffs(tx, created.id, record);
        await tx.productHistory.create({
          data: {
            productId: created.id,
            version: 1,
            action: "supplier.create",
            from: null,
            to: "PUBLISHED",
            fields: { runId, supplierRef: record.externalKey, source: "supplier_catalog" } as Prisma.InputJsonValue,
          },
        });
        await tx.supplierCatalogIdentity.upsert({
          where: {
            supplierCode_serviceType_externalKey: {
              supplierCode: record.supplierCode,
              serviceType: record.serviceType,
              externalKey: record.externalKey,
            },
          },
          create: {
            supplierCode: record.supplierCode,
            serviceType: record.serviceType,
            externalKey: record.externalKey,
            countryCode: record.countryCode,
            stateCode: record.stateCode,
            productId: created.id,
            status: "ACTIVE",
          },
          update: {
            productId: created.id,
            countryCode: record.countryCode,
            stateCode: record.stateCode,
            status: "ACTIVE",
            archivedByRunId: null,
            lastSeenAt: new Date(),
          },
        });
        return created;
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        throw new Error("A product with the same supplierRef or slug already exists");
      }
      throw error;
    }
    this.logger.log(`Supplier catalog run ${runId}: created ${product.code} (${record.externalKey})`);
  }

  private async updateProduct(productId: string, record: CatalogRecord): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id: productId } });
      if (!existing) throw new Error("Product not found");
      const current = (existing.attributes ?? {}) as Record<string, unknown>;
      await tx.product.update({
        where: { id: productId },
        data: {
          title: record.title,
          attributes: { ...current, ...record.attributes } as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });
      await tx.productPublicationChannel.upsert({
        where: { productId_channel: { productId, channel: "MARKETPLACE" } },
        create: { productId, channel: "MARKETPLACE" },
        update: {},
      });
      await this.upsertTariffs(tx, productId, record);
      await tx.productHistory.create({
        data: {
          productId,
          version: existing.version + 1,
          action: "supplier.update",
          from: existing.status,
          to: existing.status,
          fields: { supplierRef: record.externalKey, source: "supplier_catalog" } as Prisma.InputJsonValue,
        },
      });
      await tx.supplierCatalogIdentity.upsert({
        where: {
          supplierCode_serviceType_externalKey: {
            supplierCode: record.supplierCode,
            serviceType: record.serviceType,
            externalKey: record.externalKey,
          },
        },
        create: {
          supplierCode: record.supplierCode,
          serviceType: record.serviceType,
          externalKey: record.externalKey,
          countryCode: record.countryCode,
          stateCode: record.stateCode,
          productId,
          status: "ACTIVE",
        },
        update: { productId, countryCode: record.countryCode, stateCode: record.stateCode, lastSeenAt: new Date() },
      });
    });
  }

  private async restoreProduct(runId: string, productId: string, record: CatalogRecord): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id: productId } });
      if (!existing) throw new Error("Product not found");
      await tx.product.update({
        where: { id: productId },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          version: { increment: 1 },
          title: record.title,
          attributes: { ...((existing.attributes ?? {}) as object), ...record.attributes } as Prisma.InputJsonValue,
        },
      });
      await tx.productPublicationChannel.upsert({
        where: { productId_channel: { productId, channel: "MARKETPLACE" } },
        create: { productId, channel: "MARKETPLACE" },
        update: {},
      });
      await this.upsertTariffs(tx, productId, record);
      await tx.productHistory.create({
        data: {
          productId,
          version: existing.version + 1,
          action: "supplier.restore",
          from: "ARCHIVED",
          to: "PUBLISHED",
          fields: { runId, supplierRef: record.externalKey, source: "supplier_catalog" } as Prisma.InputJsonValue,
        },
      });
      await tx.supplierCatalogIdentity.upsert({
        where: {
          supplierCode_serviceType_externalKey: {
            supplierCode: record.supplierCode,
            serviceType: record.serviceType,
            externalKey: record.externalKey,
          },
        },
        create: {
          supplierCode: record.supplierCode,
          serviceType: record.serviceType,
          externalKey: record.externalKey,
          countryCode: record.countryCode,
          stateCode: record.stateCode,
          productId,
          status: "ACTIVE",
        },
        update: { status: "ACTIVE", archivedByRunId: null, lastSeenAt: new Date() },
      });
    });
  }

  private async archiveProduct(runId: string, productId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id: productId } });
      if (!existing) throw new Error("Product not found");
      if (existing.status === "ARCHIVED") return;
      await tx.product.update({
        where: { id: productId },
        data: { status: "ARCHIVED", version: { increment: 1 } },
      });
      await tx.productHistory.create({
        data: {
          productId,
          version: existing.version + 1,
          action: "supplier.archive",
          from: existing.status,
          to: "ARCHIVED",
          fields: { runId, source: "supplier_catalog" } as Prisma.InputJsonValue,
        },
      });
      const identity = await tx.supplierCatalogIdentity.findFirst({ where: { productId } });
      if (identity) {
        await tx.supplierCatalogIdentity.update({
          where: { id: identity.id },
          data: { status: "ARCHIVED", archivedByRunId: runId, lastSeenAt: new Date() },
        });
      }
    });
  }

  private async upsertTariffs(tx: Prisma.TransactionClient, productId: string, record: CatalogRecord): Promise<void> {
    for (const [index, tariff] of record.tariffs.entries()) {
      const code = `TRF-SUP-${stableHash(record.externalKey)}-${index}`;
      await tx.tariff.upsert({
        where: { code },
        create: {
          code,
          productId,
          name: tariff.name,
          price: new Prisma.Decimal(tariff.amount),
          currency: tariff.currency,
          status: "ACTIVE",
          validFrom: tariff.validFrom ? new Date(`${tariff.validFrom}T00:00:00Z`) : null,
          inclusions: (tariff.inclusions ?? {}) as Prisma.InputJsonValue,
        },
        update: {
          productId,
          name: tariff.name,
          price: new Prisma.Decimal(tariff.amount),
          currency: tariff.currency,
          validFrom: tariff.validFrom ? new Date(`${tariff.validFrom}T00:00:00Z`) : null,
          inclusions: (tariff.inclusions ?? {}) as Prisma.InputJsonValue,
        },
      });
    }
  }

  private async geoCountryId(code: string | null): Promise<string | null> {
    if (!code || !/^[A-Z]{2}$/i.test(code)) return null;
    const country = await this.prisma.geoCountry.findUnique({ where: { code: code.toUpperCase() } });
    return country?.id ?? null;
  }

  private async buildPlan(
    records: CatalogRecord[],
    complete: boolean,
    input: { supplierCode: string; serviceType: RunServiceType; countryKey: string },
  ): Promise<CatalogPlan> {
    const refs = records.map((record) => record.externalKey);
    const products: Array<{
      id: string;
      supplierRef: string | null;
      status: string;
      version: number;
      code: string;
      title: string;
      type: string;
      attributes: Prisma.JsonValue | null;
    }> = [];
    for (let i = 0; i < refs.length; i += 400) {
      const chunk = refs.slice(i, i + 400);
      const rows = await this.prisma.product.findMany({
        where: { supplierRef: { in: chunk } },
        select: { id: true, supplierRef: true, status: true, version: true, code: true, title: true, type: true, attributes: true },
      });
      products.push(...rows);
    }
    const productByRef = new Map(products.map((product) => [product.supplierRef, product]));
    const identities = await this.prisma.supplierCatalogIdentity.findMany({
      where: { supplierCode: input.supplierCode, externalKey: { in: refs } },
    });
    const identityByKey = new Map(identities.map((identity) => [identity.externalKey, identity]));
    const seen = new Set(refs);
    const items: CatalogPlanItem[] = [];

    for (const record of records) {
      if (!(record.startingPrice > 0) || record.tariffs.length === 0) {
        items.push({ productId: null, supplierRef: record.externalKey, externalKey: record.externalKey, action: "ERROR", error: "No positive price/tariff" });
        continue;
      }
      const product = productByRef.get(record.externalKey);
      if (!product) {
        items.push({
          productId: null,
          supplierRef: null,
          externalKey: record.externalKey,
          action: "CREATE",
          after: record as unknown as Record<string, unknown>,
        });
        continue;
      }
      if (product.status === "ARCHIVED") {
        const identity = identityByKey.get(record.externalKey);
        if (identity?.status === "ARCHIVED" && identity.archivedByRunId) {
          items.push({
            productId: product.id,
            supplierRef: product.supplierRef,
            externalKey: record.externalKey,
            action: "RESTORE",
            after: record as unknown as Record<string, unknown>,
            before: { status: product.status, code: product.code, title: product.title },
          });
        } else {
          items.push({
            productId: product.id,
            supplierRef: product.supplierRef,
            externalKey: record.externalKey,
            action: "LEGACY_ARCHIVED",
            reason: "Archived before the sync-origin mechanism; manual review required",
            before: { status: product.status, code: product.code, title: product.title },
            after: record as unknown as Record<string, unknown>,
          });
        }
        continue;
      }
      items.push({
        productId: product.id,
        supplierRef: product.supplierRef,
        externalKey: record.externalKey,
        action: "UPDATE",
        after: record as unknown as Record<string, unknown>,
        before: { title: product.title, status: product.status, version: product.version },
      });
    }

    // Archive only when the source explicitly proved completeness. This block
    // is intentionally empty for incomplete sources such as ANEX today.
    if (complete) {
      const prefix = `${input.supplierCode}-`;
      const candidates = await this.prisma.product.findMany({
        where: {
          supplierRef: { startsWith: prefix },
          status: "PUBLISHED",
          ...(input.serviceType === "all"
            ? { type: { in: ["TOUR", "HOTEL"] } }
            : { type: input.serviceType === "tours" ? "TOUR" : "HOTEL" }),
        },
        select: { id: true, supplierRef: true, title: true, code: true, attributes: true },
        take: 5000,
      });
      for (const product of candidates) {
        if (!product.supplierRef || seen.has(product.supplierRef)) continue;
        const attrs = (product.attributes ?? {}) as Record<string, unknown>;
        // Archive only when the product carries an explicit, exact country
        // code for this scope. A missing/legacy country field must never be
        // treated as a match: that previously produced cross-country archive
        // candidates (e.g. an Austria preview listing Turkey/Thailand cards).
        const countryCode = typeof attrs.countryCode === "string" ? attrs.countryCode : "";
        if (countryCode !== input.countryKey) continue;
        items.push({
          productId: product.id,
          supplierRef: product.supplierRef,
          externalKey: product.supplierRef,
          action: "ARCHIVE",
          reason: "Not present in a complete preview for the selected scope",
          before: { status: "PUBLISHED", code: product.code, title: product.title },
        });
      }
    }

    return {
      items,
      counts: this.counts(items),
      coverage: complete ? "COMPLETE" : "PARTIAL",
      errors: [],
      sourceRecords: records,
    };
  }

  private counts(items: CatalogPlanItem[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const item of items) counts[item.action] = (counts[item.action] ?? 0) + 1;
    return counts;
  }

  private async failRun(id: string, message: string): Promise<void> {
    await this.prisma.supplierCatalogRun.update({
      where: { id },
      data: { status: "FAILED", coverage: "FAILED", activeKey: null, errors: { fatal: message }, finishedAt: new Date() },
    }).catch(() => undefined);
  }

  private async finishRun(id: string, status: RunStatus, extra: { applied?: number; errors?: string[] | null; error?: string }): Promise<void> {
    await this.prisma.supplierCatalogRun.update({
      where: { id },
      data: {
        status,
        activeKey: null,
        finishedAt: new Date(),
        ...(extra.errors ? { errors: extra.errors } : {}),
        ...(extra.applied !== undefined ? { counts: { applied: extra.applied } } : {}),
        ...(extra.error ? { errors: { fatal: extra.error } } : {}),
      },
    });
  }
}
