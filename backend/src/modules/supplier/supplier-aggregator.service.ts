import { Injectable, Logger } from "@nestjs/common";
import { SupplierAdapterRegistry } from "./adapter/supplier-adapter.registry";
import { SupplierOfferService } from "./supplier-offer.service";
import type { SupplierSearchQuery, SupplierOffer } from "./supplier.types";

/**
 * Capability descriptor for a tour supplier adapter.
 * Populated from verified adapter behavior (docs + spec) so that the
 * aggregator can skip unsupported queries BEFORE spending a live request.
 */
export interface SupplierCapability {
  /** Countries the supplier can search, by ISO-2 code. Omitted = all. */
  countries?: string[];
  /** Nights range the supplier accepts. Omitted = unrestricted. */
  nights?: { min?: number; max?: number };
  /** Guests bounds. */
  adults?: { min?: number; max?: number };
  children?: { max?: number };
}

/** Aggregated supplier offer with normalized Master Geography keys. */
export interface AggregatedOffer extends SupplierOffer {
  /** Master Geography normalized destination keys (when resolvable). */
  geo?: {
    country?: string; // ISO-2
    city?: string;
    resort?: string;
  };
}

/** Result of an aggregate search across all enabled suppliers of a service. */
export interface AggregatedSearchResult {
  offers: AggregatedOffer[];
  perSupplier: Record<string, { count: number; error?: string }>;
}

/**
 * Service categories for supplier selection. Only suppliers whose
 * serviceTypes include the requested service are queried — a tour search
 * never hits a flight supplier and vice versa.
 */
export type SupplierServiceType = "tours" | "flights" | "hotels" | string;

/** Country-name → ISO-2 (enough to normalize supplier country names). */
const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  turkey: "TR", "турция": "TR", turkiye: "TR", türkiye: "TR",
  egypt: "EG", "египет": "EG",
  uae: "AE", "оаэ": "AE", "оаэ (эмираты)": "AE", dubai: "AE", "дубай": "AE",
  maldives: "MV", "мальдивы": "MV",
  thailand: "TH", "таиланд": "TH",
  india: "IN", "индия": "IN",
  indonesia: "ID", "индонезия": "ID",
  "sri lanka": "LK", "шри-ланка": "LK",
  georgia: "GE", "грузия": "GE",
  china: "CN", "китай": "CN",
  singapore: "SG", "сингапур": "SG",
  malaysia: "MY", "малайзия": "MY",
  kazakhstan: "KZ", "казахстан": "KZ",
  uzbekistan: "UZ", "узбекистан": "UZ",
  usa: "US", "сша": "US", "united states": "US",
  switzerland: "CH", "швейцария": "CH",
  japan: "JP", "япония": "JP",
  mauritius: "MU", "маврикий": "MU",
  zanzibar: "TZ", "занзибар": "TZ", tanzania: "TZ",
  qatar: "QA", "катар": "QA",
  kenya: "KE", "кения": "KE",
  austria: "AT", "австрия": "AT",
  seychelles: "SC", "сейшелы": "SC",
};

/**
 * Aggregates tour search across all enabled, search-enabled suppliers.
 *
 * Hybrid model: Master Geography is the single source of normalized geo,
 * but actual availability comes from live supplier searches — never assume
 * a Master Geography unit is searchable just because it exists in the
 * directory (presence in the directory ≠ searchable inventory).
 *
 * Capability check: per-supplier capability descriptors (from verified
 * adapter behavior) let the aggregator skip unsupported queries (country,
 * nights) BEFORE hitting the supplier. Previously a KOMPAS nights>14 query
 * threw "supports nights 3–14" and failed the whole request.
 *
 * Isolation: each supplier runs inside its own try/catch — one failing
 * supplier degrades to `perSupplier[code].error` instead of failing the
 * aggregate response.
 */
@Injectable()
export class SupplierAggregatorService {
  private readonly logger = new Logger(SupplierAggregatorService.name);

  /**
   * Verified capability matrix for tour suppliers (from adapter docs/specs).
   * KOMPAS: mapStateInc covers ~23 countries, nights 3–14 (adapter rejects
   * outside the range), adults 1–4 / children 0–1 per verified context.
   * SUMMERTOUR: STATEINC=9 (Turkey) hardcoded in the request builder,
   * nights unrestricted at adapter level.
   * KAZUNION: STATEINC dictionary discovered from the Baku form (8 countries),
   * nights 3–15 (site NIGHTS_FROM/TILL options).
   */
  private static readonly CAPABILITIES: Record<string, SupplierCapability> = {
    KOMPAS: {
      countries: [
        "TR", "EG", "AE", "MV", "TH", "IN", "ID", "LK", "GE", "CN", "SG",
        "MY", "KZ", "UZ", "US", "CH", "JP", "MU", "TZ", "QA", "KE", "AT", "SC",
      ],
      nights: { min: 3, max: 14 },
    },
    SUMMERTOUR: {
      countries: ["TR"],
    },
    // KazUnion serves 8 countries from Baku (discovered live from the form);
    // nights 3–15 matches the site's NIGHTS_FROM/TILL options.
    KAZUNION: {
      countries: ["TR", "TH", "MV", "CN", "GE", "KZ", "QA", "SG"],
      nights: { min: 3, max: 15 },
    },
  };

  constructor(
    private readonly registry: SupplierAdapterRegistry,
    private readonly offerService: SupplierOfferService,
  ) {}

  /** Normalize a supplier-neutral country (code or ru/en name) to ISO-2. */
  private normalizeCountry(raw?: string): string | undefined {
    if (!raw) return undefined;
    const v = raw.trim();
    if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
    return COUNTRY_NAME_TO_ISO2[v.toLowerCase()];
  }

  /** True when the supplier publicly supports this query. */
  supports(supplierCode: string, query: SupplierSearchQuery): boolean {
    const cap = SupplierAggregatorService.CAPABILITIES[supplierCode];
    if (!cap) return true; // unknown supplier → optimistic (no capability data)

    if (cap.countries) {
      const iso = this.normalizeCountry(query.country ?? query.destination);
      if (!iso || !cap.countries.includes(iso)) return false;
    }
    if (cap.nights) {
      const { min, max } = cap.nights;
      if (min !== undefined && query.nightsFrom !== undefined && query.nightsFrom < min) return false;
      if (max !== undefined && query.nightsTo !== undefined && query.nightsTo > max) return false;
      // A single-night value fills both bounds in the UI contract.
      if (min !== undefined && query.nightsTo !== undefined && query.nightsTo < min) return false;
      if (max !== undefined && query.nightsFrom !== undefined && query.nightsFrom > max) return false;
    }
    if (cap.adults) {
      const { min, max } = cap.adults;
      if (min !== undefined && query.adults < min) return false;
      if (max !== undefined && query.adults > max) return false;
    }
    if (cap.children?.max !== undefined && (query.children ?? 0) > cap.children.max) return false;
    return true;
  }

  /**
   * Search all enabled suppliers of the given service type that support
   * the query. Offers are normalized to Master Geography keys where
   * resolvable and sorted by price ascending.
   */
  async searchByService(
    serviceType: SupplierServiceType,
    query: SupplierSearchQuery,
  ): Promise<AggregatedSearchResult> {
    const candidates = this.registry
      .getEnabled()
      .filter((a) => {
        try {
          const cfg = this.registry.getConfig(a.code);
          // Service-type gate: only suppliers OF THIS SERVICE participate.
          // Missing serviceTypes on a legacy registration → treat as "all".
          if (cfg.serviceTypes?.length && !cfg.serviceTypes.includes(serviceType)) {
            return false;
          }
          return cfg.searchEnabled;
        } catch {
          return false;
        }
      })
      .filter((a) => this.supports(a.code, query));

    if (candidates.length === 0) {
      return { offers: [], perSupplier: {} };
    }

    const perSupplier: Record<string, { count: number; error?: string }> = {};
    const settled = await Promise.allSettled(
      candidates.map(async (adapter) => ({
        code: adapter.code,
        offers: await this.offerService.search(adapter.code, query),
      })),
    );

    const aggregated: AggregatedOffer[] = [];
    settled.forEach((res, i) => {
      const code = candidates[i].code;
      if (res.status === "fulfilled") {
        // Only bookable offers reach the marketplace: rows with a sales stop
        // or without flight seats are excluded, UNKNOWN stays (no fake data).
        const bookable = res.value.offers.filter(
          (o) => o.availability !== "NOT_AVAILABLE",
        );
        const hidden = res.value.offers.length - bookable.length;
        if (hidden > 0) {
          this.logger.log(`Aggregated search: ${code} — ${hidden} offers hidden (stop-sale/no seats)`);
        }
        perSupplier[code] = { count: bookable.length };
        for (const offer of bookable) {
          aggregated.push(this.normalizeGeo(offer));
        }
      } else {
        const err = res.reason instanceof Error ? res.reason.message : String(res.reason);
        this.logger.warn(`Aggregated search: supplier ${code} failed: ${err}`);
        perSupplier[code] = { count: 0, error: err };
      }
    });

    aggregated.sort((a, b) => (a.price?.amount ?? Infinity) - (b.price?.amount ?? Infinity));
    return { offers: aggregated, perSupplier };
  }

  /**
   * Normalize offer geography to Master Geography keys (ISO-2 country +
   * supplier-neutral city/resort strings when the offer carries them).
   */
  private normalizeGeo(offer: SupplierOffer): AggregatedOffer {
    const country = this.normalizeCountry(offer.country);
    return {
      ...offer,
      geo: {
        ...(country ? { country } : {}),
        ...(offer.destination ? { city: offer.destination } : {}),
      },
    };
  }
}
