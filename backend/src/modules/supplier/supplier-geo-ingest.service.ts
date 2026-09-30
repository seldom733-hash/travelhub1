import { Injectable, Logger, Inject } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SupplierAdapterRegistry } from "./adapter/supplier-adapter.registry";
import { ANEX_STATEINC_TO_ISO, AnexProvider } from "./anex/anex.provider";

/**
 * SupplierGeoIngestService — automated supplier geo mapping ingestion.
 *
 * Flow (per supplier adapter that implements discoverGeoOptions):
 *   discover (live supplier form)
 *     → normalize labels (strip prefixes like "AE:", "из Баку", GDS suffixes)
 *     → hierarchy-aware mapping to Master Geography:
 *         TOUR program  → country link only (never invents geography)
 *         TOWN + parent → GeoResort under the parent group's GeoCity
 *         TOWN          → GeoCity (match, else create)
 *     → auto-create missing parent GeoCity / GeoResort entries
 *     → retire GeoCity rows that are really resorts (links moved to the
 *       GeoResort, city status → INACTIVE so it leaves the picker's city list)
 *     → upsert SupplierGeoLink (idempotent on supplierCode+kind+externalId)
 *
 * Adding a NEW supplier requires zero schema changes: implement
 * discoverGeoOptions in its adapter and run ingest with its code.
 */
@Injectable()
export class SupplierGeoIngestService {
  private readonly logger = new Logger(SupplierGeoIngestService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SupplierAdapterRegistry) private readonly registry: SupplierAdapterRegistry,
    @Inject(AnexProvider) private readonly anex: AnexProvider,
  ) {}

  /** Label normalization: "AE: Дубай из Баку (GDS: AZAL)" → "Дубай". */
  normalizeLabel(label: string): string {
    let s = label.replace(/\s+/g, " ").trim();
    s = s.replace(/^[A-Z]{2,3}\s*:\s*/u, ""); // country prefix "AE: "
    s = s.replace(/\s*из\s+[А-Яа-яЁёA-Za-z]+\s*$/u, ""); // trailing "из Баку"
    s = s.replace(/\s*\(GDS[^)]*\)/giu, ""); // "(GDS: AZAL)"
    s = s.replace(/^(тур|программа)\s+/iu, "");
    return s.trim();
  }

  /** Translit fallback for label→city matching when names are provider-specific. */
  private static readonly TRANSLIT: Record<string, string> = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
  };

  private translit(s: string): string {
    return [...s.toLowerCase()]
      .map((ch) => SupplierGeoIngestService.TRANSLIT[ch] ?? ch)
      .join("");
  }

  private norm(s: string): string {
    return s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]/gi, "");
  }

  /** Normalized match variants (ru/en/az names + code) of a geo entity. */
  private variantsOf(entity: { names?: unknown; code?: string | null }): string[] {
    const names = (entity.names ?? {}) as Record<string, unknown>;
    return [names.ru, names.en, names.az, entity.code]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .map((v) => this.norm(v));
  }

  /** Substring containment ("Дубай из Баку" ⊇ "Дубай"), length-guarded. */
  private containsMatch(variant: string, target: string): boolean {
    return (
      (target.length >= 4 && variant.includes(target)) ||
      (variant.length >= 4 && target.includes(variant))
    );
  }

  async ingestSupplier(supplierCode: string, onlyStateIncs?: string[]): Promise<IngestReport> {
    // Prefer the adapter that actually implements geo discovery: the same
    // provider code can register several category adapters (ANEX tours/hotels),
    // and only the tours adapter carries discoverGeoOptions.
    const adapter = this.registry
      .getEnabled()
      .find((a) => a.code === supplierCode && a.discoverGeoOptions);
    if (!adapter?.discoverGeoOptions) {
      throw new Error(`Supplier '${supplierCode}' has no discoverGeoOptions capability`);
    }

    // Map supplier STATEINC values to ISO-2 via the country directory.
    const countries = await this.prisma.geoCountry.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, code: true, names: true },
    });

    const stateToCountry = await this.resolveSupplierCountries(supplierCode, adapter, countries);
    const report: IngestReport = {
      supplierCode,
      discovered: 0,
      linked: 0,
      createdCities: 0,
      createdResorts: 0,
      retiredCities: 0,
      unmatched: [],
    };

    for (const [stateInc, country] of stateToCountry) {
      if (onlyStateIncs && !onlyStateIncs.includes(stateInc)) continue;
      const options = await adapter.discoverGeoOptions(stateInc);
      report.discovered += options.length;

      for (const opt of options) {
        const normalized = this.normalizeLabel(opt.label);

        // Programs are not geography: link them to the country, and to a city
        // only when the program's own name IS that city (exact match). Never
        // create a GeoCity from a program label ("Курорты ... из Баку").
        // Hotel categories (kind=STAR) are supplier dictionary entries too —
        // linked to the country only, never treated as geography.
        if (opt.kind === "STAR") {
          report.linked++;
          await this.upsertLink(supplierCode, opt, country.id, null, null);
          continue;
        }
        if (opt.kind === "TOUR") {
          const city = normalized ? await this.findExactCity(country.id, normalized) : null;
          report.linked++;
          await this.upsertLink(supplierCode, opt, country.id, city?.id ?? null, null);
          continue;
        }
        // Hotel dictionary (kind=HOTEL): geo-link through the hotel's town —
        // the same run's TOWN links (discovered first) carry the city/resort
        // of that townKey. Hotels of a town not yet ingested link country-only
        // so the hotel picker still works at country scope.
        if (opt.kind === "HOTEL") {
          report.linked++;
          let townLink: {
            geoCountryId: string | null;
            geoCityId: string | null;
            geoResortId: string | null;
          } | null = null;
          if (opt.townKey) {
            townLink = await this.prisma.supplierGeoLink.findUnique({
              where: {
                supplierCode_kind_externalId: {
                  supplierCode,
                  kind: "TOWN",
                  externalId: opt.townKey,
                },
              },
              select: { geoCountryId: true, geoCityId: true, geoResortId: true },
            });
          }
          await this.upsertLink(
            supplierCode,
            opt,
            townLink?.geoCountryId ?? country.id,
            townLink?.geoCityId ?? null,
            townLink?.geoResortId ?? null,
          );
          continue;
        }

        const target = await this.resolveTownTarget(country, normalized, opt.parentLabel);
        if (target) {
          report.linked++;
          if (target.type === "city" && target.created) report.createdCities++;
          if (target.type === "resort" && target.created) report.createdResorts++;
          if (target.retiredCity) report.retiredCities++;
        } else {
          report.unmatched.push(opt.label);
        }

        await this.upsertLink(
          supplierCode,
          opt,
          country.id,
          target?.type === "city" ? target.id : null,
          target?.type === "resort" ? target.id : null,
        );
      }
    }
    this.logger.log(
      `[GeoIngest] ${supplierCode}: discovered=${report.discovered} linked=${report.linked} ` +
        `cities=${report.createdCities} resorts=${report.createdResorts} retired=${report.retiredCities} ` +
        `unmatched=${report.unmatched.length}`,
    );
    return report;
  }

  /**
   * ANEX HOTELS geo ingestion — the 52-country dictionary of
   * /samo/searchhotel/{States,Towns}. The tour adapter's discoverGeoOptions
   * cannot cover it: /samo/searchtour/Towns answers HTTP 500 for hotel-only
   * states (AZ, DO, JO…) and the country lists differ (52 vs 21).
   *
   * Per state:
   *   GeoCountry (upsert by ISO — missing rows are created with ru/en names
   *   from the supplier dictionary) → hotel towns:
   *   town.region → GeoCity, town → GeoResort under that city (flat towns
   *   with no region become a city), plus an ANEX kind=TOWN link
   *   (externalId = hotel town id — one shared id space, verified: TR town
   *   123 = «Авсаллар» in both dictionaries).
   */
  async ingestAnexHotels(stateIsos?: string[]): Promise<IngestReport> {
    const report: IngestReport = {
      supplierCode: "ANEX",
      discovered: 0,
      linked: 0,
      createdCities: 0,
      createdResorts: 0,
      retiredCities: 0,
      unmatched: [],
    };
    const states = await this.anex.hotelStates();
    for (const state of states) {
      if (stateIsos?.length && !stateIsos.includes(state.stateISO)) continue;
      const country = await this.upsertCountry(state.stateISO, state.name, state.nameAlt);
      let towns: Awaited<ReturnType<AnexProvider["hotelTowns"]>> = [];
      try {
        towns = await this.anex.hotelTowns(String(state.id));
      } catch (e) {
        report.unmatched.push(`STATE ${state.stateISO}: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      for (const t of towns) {
        report.discovered++;
        const normalized = this.normalizeLabel(t.name);
        if (!normalized) continue;
        const target = await this.resolveTownTarget(country, normalized, t.region || undefined);
        if (!target) {
          report.unmatched.push(t.name);
          continue;
        }
        if (target.created) {
          if (target.type === "city") report.createdCities++;
          else report.createdResorts++;
        }
        if (target.retiredCity) report.retiredCities++;
        report.linked++;
        await this.upsertLink(
          "ANEX",
          { externalId: String(t.id), label: t.name, kind: "TOWN" },
          country.id,
          target.type === "city" ? target.id : null,
          target.type === "resort" ? target.id : null,
        );
      }
    }
    this.logger.log(
      `[GeoIngest] ANEX hotels: discovered=${report.discovered} linked=${report.linked} ` +
        `cities=${report.createdCities} resorts=${report.createdResorts} ` +
        `unmatched=${report.unmatched.length}`,
    );
    return report;
  }

  /** Country upsert by ISO — Master Geography rows missing from the hotel
   *  dictionary's 52 states are created with the supplier's ru/en names. */
  private async upsertCountry(code: string, ruName: string, enName: string) {
    const existing = await this.prisma.geoCountry.findUnique({
      where: { code },
      select: { id: true, code: true },
    });
    if (existing) return existing;
    const title = (s: string) =>
      s.toLowerCase().replace(/(^|[\s\-])(\p{L})/gu, (_m, p, c: string) => p + c.toUpperCase());
    const created = await this.prisma.geoCountry.create({
      data: {
        code,
        names: { ru: ruName || title(enName), en: title(enName || ruName) },
        status: "ACTIVE",
      },
      select: { id: true, code: true },
    });
    this.logger.log(`[GeoIngest] created GeoCountry ${code} (${ruName})`);
    return created;
  }

  /**
   * Resolve supplier STATEINC → our GeoCountry. Uses the adapter's own
   * STATEINC select labels when possible; falls back to the static map.
   */
  private async resolveSupplierCountries(
    supplierCode: string,
    adapter: { discoverGeoOptions?: (s?: string) => Promise<{ externalId: string; label: string; kind: string }[]> },
    countries: { id: string; code: string; names: any }[],
  ): Promise<Map<string, { id: string; code: string; names: any }>> {
    const result = new Map<string, { id: string; code: string; names: any }>();
    // SAMO STATEINC map is adapter knowledge; ingest covers the verified ones
    // per supplier (KOMPAS 23=AE..., SUMMERTOUR 9=TR, KAZUNION 6=TR — from
    // verified supplier captures).
    const SUPPLIER_STATEINC: Record<string, Record<string, string>> = {
      KOMPAS: {
        "17": "TR", "37": "EG", "23": "AE", "40": "MV", "28": "TH", "6": "IN",
        "11": "ID", "27": "LK", "30": "GE", "31": "CN", "33": "SG", "12": "MY",
        "7": "KZ", "14": "UZ", "22": "US", "59": "CH", "94": "JP", "86": "MU",
        "109": "TZ", "111": "QA", "139": "KE", "51": "AT", "77": "SC",
      },
      SUMMERTOUR: { "9": "TR" },
      KAZUNION: { "6": "TR" },
      // ANEX STATEINC → ISO-2 (shared with the adapter — single source of truth).
      ANEX: ANEX_STATEINC_TO_ISO,
    };
    const KNOWN_STATEINC: Record<string, string> = SUPPLIER_STATEINC[supplierCode] ?? SUPPLIER_STATEINC.KOMPAS;
    for (const [stateInc, iso] of Object.entries(KNOWN_STATEINC)) {
      const country = countries.find((c) => c.code === iso);
      if (country) result.set(stateInc, country);
    }
    void adapter; // adapter discovery per-country happens in the loop
    void supplierCode;
    return result;
  }

  /**
   * TOWN mapping. With a supplier group (parent) label the option is a resort
   * of that group's city — unless the town IS the group itself, in which case
   * it stays a city. Without a parent the option is matched/created as a city
   * (flat supplier directories).
   */
  private async resolveTownTarget(
    country: { id: string; code: string },
    normalized: string,
    parentLabel?: string,
  ): Promise<TownTarget | null> {
    if (!normalized) return null;

    if (parentLabel) {
      const parentNorm = this.normalizeLabel(parentLabel);
      if (parentNorm && parentNorm !== normalized) {
        const parent = await this.matchOrCreateCity(country.id, country.code, parentNorm);
        if (parent) {
          const resort = await this.matchOrCreateResort(parent.id, country.code, normalized);
          let retiredCity = false;
          // Earlier ingest runs stored this town as a GeoCity — retire it so
          // the picker stops listing a resort under "Город".
          const oldCity = await this.findAutoCreatedCity(country.id, country.code, normalized);
          if (oldCity && oldCity.id !== parent.id) {
            retiredCity = await this.retireCityAsResort(oldCity.id, resort.id);
          }
          return { type: "resort", id: resort.id, created: resort.created, retiredCity };
        }
      }
      // Town == group (or unresolvable group) → fall through to city logic.
    }

    // 1) Existing ACTIVE city match (exact, then substring) — an existing
    // city always wins, exactly as before.
    const matchedCity = await this.matchCity(country.id, normalized);
    if (matchedCity) return { type: "city", id: matchedCity.id, created: false };

    // 2) Flat supplier directories (KazUnion's dictionary has no groups): a
    // town that already exists as a resort somewhere in this country links
    // to that resort instead of minting a twin city — the picker's «Город»
    // list must not show resorts (the whole point of the hierarchy ingest).
    const existingResort = await this.matchCountryResort(country.id, normalized);
    if (existingResort) {
      let retiredCity = false;
      const oldCity = await this.findAutoCreatedCity(country.id, country.code, normalized);
      if (oldCity && oldCity.id !== existingResort.cityId) {
        retiredCity = await this.retireCityAsResort(oldCity.id, existingResort.id);
      }
      return { type: "resort", id: existingResort.id, created: false, retiredCity };
    }

    // 3) Nothing matched — Master Geography absorbs the new supplier
    // location as a city.
    const createdCity = await this.createCity(country.id, country.code, normalized);
    return createdCity ? { type: "city", id: createdCity.id, created: true } : null;
  }

  /** Exact-name city match (no substring, no creation) — used for TOUR labels. */
  private async findExactCity(countryId: string, normalized: string): Promise<{ id: string } | null> {
    const cities = await this.prisma.geoCity.findMany({
      where: { countryId, status: "ACTIVE" },
      select: { id: true, names: true },
    });
    const target = this.norm(normalized);
    const targetTr = this.translit(normalized);
    for (const c of cities) {
      const names = (c.names ?? {}) as Record<string, unknown>;
      const variants = [names.ru, names.en, names.az]
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .map((v) => this.norm(v));
      if (variants.includes(target) || variants.includes(targetTr)) return { id: c.id };
    }
    return null;
  }

  /** Match normalized label to GeoCity of the country; create if missing. */
  private async matchOrCreateCity(
    countryId: string,
    countryCode: string,
    normalized: string,
  ): Promise<{ id: string; created: boolean } | null> {
    const matched = await this.matchCity(countryId, normalized);
    if (matched) return { id: matched.id, created: false };
    const created = await this.createCity(countryId, countryCode, normalized);
    return created ? { id: created.id, created: true } : null;
  }

  /**
   * Match normalized label to an existing ACTIVE GeoCity of the country
   * (exact pass first, then substring containment). Null when nothing
   * matches — the caller decides whether to create a city or to fall back
   * to a country-wide resort match (flat supplier directories).
   */
  private async matchCity(
    countryId: string,
    normalized: string,
  ): Promise<{ id: string } | null> {
    if (!normalized) return null;
    const cities = await this.prisma.geoCity.findMany({
      where: { countryId, status: "ACTIVE" },
      select: { id: true, code: true, names: true },
    });

    const target = this.norm(normalized);
    const targetTr = this.translit(normalized);

    // Two passes over ALL candidates: exact match wins globally, so a junk
    // row listed earlier ("ID-BALI IZ BAKU") can never shadow the exact
    // master ("Bali") with a substring hit.
    for (const c of cities) {
      if (this.variantsOf(c).some((v) => v === target || v === targetTr)) {
        return { id: c.id };
      }
    }
    // Substring containment — the supplier label usually appends context
    // ("Дубай из Баку" contains master "Дубай").
    for (const c of cities) {
      if (this.variantsOf(c).some((v) => this.containsMatch(v, target))) {
        return { id: c.id };
      }
    }
    return null;
  }

  /** Create the city — Master Geography absorbs new supplier locations. */
  private async createCity(
    countryId: string,
    countryCode: string,
    normalized: string,
  ): Promise<{ id: string } | null> {
    if (!normalized) return null;
    // Upsert by deterministic code: re-runs and label variants converge.
    const target = this.norm(normalized);
    const targetTr = this.translit(normalized);
    const code = `${countryCode}-${targetTr.toUpperCase().slice(0, 20)}`;
    const city = await this.prisma.geoCity.upsert({
      where: { code },
      create: {
        countryId,
        code,
        names: { ru: normalized, en: normalized, az: normalized },
      },
      update: {},
      select: { id: true },
    });
    return { id: city.id };
  }

  /**
   * Country-wide ACTIVE resort match (exact, then substring) — used when a
   * flat supplier directory lists a town that the hierarchical ingest
   * already stored as a resort (KazUnion: no group headers in its dictionary).
   */
  private async matchCountryResort(
    countryId: string,
    normalized: string,
  ): Promise<{ id: string; cityId: string } | null> {
    if (!normalized) return null;
    const resorts = await this.prisma.geoResort.findMany({
      where: { status: "ACTIVE", city: { countryId } },
      select: { id: true, cityId: true, code: true, names: true },
    });

    const target = this.norm(normalized);
    const targetTr = this.translit(normalized);

    for (const r of resorts) {
      if (this.variantsOf(r).some((v) => v === target || v === targetTr)) {
        return { id: r.id, cityId: r.cityId };
      }
    }
    for (const r of resorts) {
      if (this.variantsOf(r).some((v) => this.containsMatch(v, target))) {
        return { id: r.id, cityId: r.cityId };
      }
    }
    return null;
  }

  /** Match (or create) a GeoResort of the given city for a supplier town. */
  private async matchOrCreateResort(
    cityId: string,
    countryCode: string,
    normalized: string,
  ): Promise<{ id: string; created: boolean }> {
    const target = this.norm(normalized);
    const targetTr = this.translit(normalized);

    const existing = await this.prisma.geoResort.findMany({
      where: { cityId, status: "ACTIVE" },
      select: { id: true, code: true, names: true },
    });
    for (const r of existing) {
      if (this.variantsOf(r).some((v) => v === target || v === targetTr)) {
        return { id: r.id, created: false };
      }
    }
    for (const r of existing) {
      if (this.variantsOf(r).some((v) => this.containsMatch(v, target))) {
        return { id: r.id, created: false };
      }
    }

    const code = `${countryCode}-${targetTr.toUpperCase().slice(0, 20)}`;
    const created = await this.prisma.geoResort.upsert({
      where: { code },
      create: {
        cityId,
        code,
        names: { ru: normalized, en: normalized, az: normalized },
        status: "ACTIVE",
      },
      update: {},
      select: { id: true },
    });
    return { id: created.id, created: true };
  }

  /**
   * Find the ACTIVE GeoCity this town was previously stored as (deterministic
   * ingest code, exact name, or exact code match).
   */
  private async findAutoCreatedCity(
    countryId: string,
    countryCode: string,
    normalized: string,
  ): Promise<{ id: string; code: string } | null> {
    const target = this.norm(normalized);
    const targetTr = this.translit(normalized);
    const code = `${countryCode}-${targetTr.toUpperCase().slice(0, 20)}`;

    const cities = await this.prisma.geoCity.findMany({
      where: { countryId, status: "ACTIVE" },
      select: { id: true, code: true, names: true },
    });
    for (const c of cities) {
      if (c.code === code) return { id: c.id, code: c.code };
      const names = (c.names ?? {}) as Record<string, unknown>;
      const variants = [names.ru, names.en, names.az]
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .map((v) => this.norm(v));
      if (variants.includes(target) || variants.includes(targetTr)) {
        return { id: c.id, code: c.code };
      }
    }
    return null;
  }

  /**
   * Retire a GeoCity that is really a resort: move its TOWN links to the
   * GeoResort, drop geoCityId from the rest (TOUR links keep the country),
   * then hide the city from the directory (status INACTIVE). Skipped when the
   * city already has resorts/airports — those prove it is a real city.
   */
  private async retireCityAsResort(cityId: string, resortId: string): Promise<boolean> {
    const city = await this.prisma.geoCity.findUnique({
      where: { id: cityId },
      select: { resorts: { select: { id: true } }, airports: { select: { id: true } } },
    });
    if (!city || city.resorts.length > 0 || city.airports.length > 0) return false;

    await this.prisma.$transaction([
      this.prisma.supplierGeoLink.updateMany({
        where: { geoCityId: cityId, kind: { not: "TOWN" } },
        data: { geoCityId: null },
      }),
      this.prisma.supplierGeoLink.updateMany({
        where: { geoCityId: cityId, kind: "TOWN" },
        data: { geoCityId: null, geoResortId: resortId },
      }),
      this.prisma.geoCity.update({ where: { id: cityId }, data: { status: "INACTIVE" } }),
    ]);
    return true;
  }

  private async upsertLink(
    supplierCode: string,
    opt: { externalId: string; label: string; kind: string },
    geoCountryId: string,
    geoCityId: string | null,
    geoResortId: string | null,
  ): Promise<void> {
    await this.prisma.supplierGeoLink.upsert({
      where: {
        supplierCode_kind_externalId: {
          supplierCode,
          kind: opt.kind,
          externalId: opt.externalId,
        },
      },
      create: {
        supplierCode,
        kind: opt.kind,
        externalId: opt.externalId,
        label: opt.label,
        geoCountryId,
        geoCityId,
        geoResortId,
      },
      update: {
        label: opt.label,
        geoCountryId,
        geoCityId,
        geoResortId,
      },
    });
  }
}

export interface IngestReport {
  supplierCode: string;
  discovered: number;
  linked: number;
  createdCities: number;
  createdResorts: number;
  retiredCities: number;
  unmatched: string[];
}

interface TownTarget {
  type: "city" | "resort";
  id: string;
  created: boolean;
  retiredCity?: boolean;
}
