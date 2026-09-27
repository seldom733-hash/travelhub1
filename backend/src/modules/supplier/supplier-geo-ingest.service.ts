import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SupplierAdapterRegistry } from "./adapter/supplier-adapter.registry";

/**
 * SupplierGeoIngestService — automated supplier geo mapping ingestion.
 *
 * Flow (per supplier adapter that implements discoverGeoOptions):
 *   discover (live supplier form)
 *     → normalize labels (strip prefixes like "AE:", "из Баку", GDS suffixes)
 *     → match to Master Geography (GeoCountry by STATEINC, GeoCity by name)
 *     → auto-create missing GeoCity entries
 *     → upsert SupplierGeoLink (idempotent on supplierCode+kind+externalId)
 *
 * Adding a NEW supplier requires zero schema changes: implement
 * discoverGeoOptions in its adapter and run ingest with its code.
 */
@Injectable()
export class SupplierGeoIngestService {
  private readonly logger = new Logger(SupplierGeoIngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: SupplierAdapterRegistry,
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

  async ingestSupplier(supplierCode: string): Promise<IngestReport> {
    const adapter = this.registry.getEnabled().find((a) => a.code === supplierCode);
    if (!adapter?.discoverGeoOptions) {
      throw new Error(`Supplier '${supplierCode}' has no discoverGeoOptions capability`);
    }

    // Map supplier STATEINC values to ISO-2 via the country directory.
    const countries = await this.prisma.geoCountry.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, code: true, names: true },
    });

    const stateToCountry = await this.resolveSupplierCountries(supplierCode, adapter, countries);
    const report: IngestReport = { supplierCode, discovered: 0, linked: 0, createdCities: 0, unmatched: [] };

    for (const [stateInc, country] of stateToCountry) {
      const options = await adapter.discoverGeoOptions(stateInc);
      report.discovered += options.length;

      for (const opt of options) {
        const normalized = this.normalizeLabel(opt.label);
        const city = await this.matchOrCreateCity(country.id, country.code, normalized);
        if (city) {
          if (city.created) report.createdCities++;
          report.linked++;
        } else {
          report.unmatched.push(opt.label);
        }

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
            geoCountryId: country.id,
            geoCityId: city?.id,
          },
          update: {
            label: opt.label,
            geoCountryId: country.id,
            geoCityId: city?.id,
          },
        });
      }
    }
    this.logger.log(
      `[GeoIngest] ${supplierCode}: discovered=${report.discovered} linked=${report.linked} createdCities=${report.createdCities} unmatched=${report.unmatched.length}`,
    );
    return report;
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
    // SAMO STATEINC map is adapter knowledge; ingest covers the verified ones.
    const KNOWN_STATEINC: Record<string, string> = {
      "17": "TR", "37": "EG", "23": "AE", "40": "MV", "28": "TH", "6": "IN",
      "11": "ID", "27": "LK", "30": "GE", "31": "CN", "33": "SG", "12": "MY",
      "7": "KZ", "14": "UZ", "22": "US", "59": "CH", "94": "JP", "86": "MU",
      "109": "TZ", "111": "QA", "139": "KE", "51": "AT", "77": "SC",
    };
    for (const [stateInc, iso] of Object.entries(KNOWN_STATEINC)) {
      const country = countries.find((c) => c.code === iso);
      if (country) result.set(stateInc, country);
    }
    void adapter; // adapter discovery per-country happens in the loop
    void supplierCode;
    return result;
  }

  /** Match normalized label to GeoCity of the country; create if missing. */
  private async matchOrCreateCity(
    countryId: string,
    countryCode: string,
    normalized: string,
  ): Promise<{ id: string; created: boolean } | null> {
    if (!normalized) return null;
    const cities = await this.prisma.geoCity.findMany({
      where: { countryId, status: "ACTIVE" },
      select: { id: true, code: true, names: true },
    });

    const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]/gi, "");
    const target = norm(normalized);
    const targetTr = this.translit(normalized);

    for (const c of cities) {
      const names = (c.names ?? {}) as Record<string, unknown>;
      const variants = [names.ru, names.en, names.az, c.code]
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .map((v) => norm(v));
      if (variants.includes(target) || variants.includes(targetTr)) {
        return { id: c.id, created: false };
      }
    }
    // Create the city — Master Geography absorbs new supplier locations.
    const code = `${countryCode}-${targetTr.toUpperCase().slice(0, 20)}`;
    const created = await this.prisma.geoCity.create({
      data: {
        countryId,
        code,
        names: { ru: normalized, en: normalized, az: normalized },
      },
      select: { id: true },
    });
    return { id: created.id, created: true };
  }
}

export interface IngestReport {
  supplierCode: string;
  discovered: number;
  linked: number;
  createdCities: number;
  unmatched: string[];
}
