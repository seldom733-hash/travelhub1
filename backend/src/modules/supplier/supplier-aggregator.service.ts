import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
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
  /**
   * Per-service overrides keyed by service type ("hotels", "flights", …).
   * A provider can accept different bounds per category (ANEX tours: nights
   * 2–28 and at most 1 child; ANEX hotels: nights 1–30 and up to 5 children).
   * The active capability = base merged with services[query.service].
   */
  services?: Record<string, Omit<SupplierCapability, "services">>;
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
  azerbaijan: "AZ", "азербайджан": "AZ",
  russia: "RU", "россия": "RU",
  greece: "GR", "греция": "GR",
  cyprus: "CY", "кипр": "CY",
  hungary: "HU", "венгрия": "HU",
  serbia: "RS", "сербия": "RS",
  montenegro: "ME", "черногория": "ME",
  portugal: "PT", "португалия": "PT",
  vietnam: "VN", "вьетнам": "VN",
  oman: "OM", "оман": "OM",
  nepal: "NP", "непал": "NP",
  cuba: "CU", "куба": "CU",
  dominican: "DO", "dominican republic": "DO", "доминикана": "DO", "доминиканская республика": "DO",
  // Remaining /samo/searchhotel/States countries (52-state hotel dictionary —
  // the tour ingest never covered them, so their names must normalize too).
  argentina: "AR", аргентина: "AR",
  brazil: "BR", бразилия: "BR",
  "cape verde": "CV", "кабо-верде": "CV", "cabo verde": "CV",
  fiji: "FJ", фиджи: "FJ",
  "hong kong": "HK", гонконг: "HK", "китай (гонконг)": "HK",
  jordan: "JO", иордания: "JO",
  cambodia: "KH", камбоджа: "KH",
  monaco: "MC", монако: "MC",
  madagascar: "MG", мадагаскар: "MG",
  mongolia: "MN", монголия: "MN",
  macau: "MO", "китай (макао)": "MO", "china (macau)": "MO",
  mexico: "MX", мексика: "MX",
  namibia: "NA", намибия: "NA",
  panama: "PA", панама: "PA",
  peru: "PE", перу: "PE",
  philippines: "PH", филиппины: "PH",
  tunisia: "TN", тунис: "TN",
  uruguay: "UY", уругвай: "UY",
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
    // ANEX (webapi.anextour.az): 21 countries from Baku (verified live from
    // /samo/searchtour/States), nights 2–28 (Nights dictionary), children
    // limited to 1 — the AGES param only accepts a single child age.
    ANEX: {
      countries: [
        "TR", "EG", "AE", "TH", "LK", "AT", "GE", "IN", "ID", "ES", "IT",
        "KZ", "CN", "MU", "MY", "MV", "SC", "SG", "UZ", "FR", "QA",
      ],
      nights: { min: 2, max: 28 },
      children: { max: 1 },
      // Hotels (AnexHotelAdapter, verified live): stay nights 1..30 and the
      // AGES csv accepts several children — override the tour bounds.
      // countries is a FULL override (supports() merges {...base, ...svc}):
      // hotels use a separate upstream dictionary /samo/searchhotel/States
      // (52 countries — AZ, CH, KE, RU, GR, CY, JP… — verified live), while
      // /samo/searchtour/States has 21 and has no AZ at all.
      services: {
        hotels: {
          countries: [
            "AE", "AR", "AT", "AZ", "BR", "CH", "CN", "CV", "CY", "DO",
            "EG", "ES", "FJ", "FR", "GE", "GR", "HK", "HU", "ID", "IN",
            "IT", "JO", "JP", "KE", "KH", "KZ", "LK", "MC", "ME", "MG",
            "MN", "MO", "MU", "MV", "MX", "NA", "NP", "OM", "PA", "PE",
            "PH", "PT", "RS", "RU", "SC", "SG", "TH", "TN", "TR", "UY",
            "UZ", "VN",
          ],
          nights: { min: 1, max: 30 },
          children: { max: 5 },
        },
      },
    },
  };

  constructor(
    private readonly registry: SupplierAdapterRegistry,
    private readonly offerService: SupplierOfferService,
    private readonly prisma: PrismaService,
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
    const base = SupplierAggregatorService.CAPABILITIES[supplierCode];
    if (!base) return true; // unknown supplier → optimistic (no capability data)
    // Per-service capability override (§: one provider, different category
    // bounds — ANEX hotels accept nights 1..30 / 5 children vs tours 2..28 / 1).
    const svc = query.service ? base.services?.[query.service] : undefined;
    const cap = svc ? { ...base, ...svc, services: undefined } : base;

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
    const { jobs, hasCandidates } = await this.buildJobs(serviceType, query);

    if (jobs.length === 0) {
      if (hasCandidates && (query.geoCity || query.geoResort)) {
        this.logger.warn(
          `Aggregated search: no supplier has a geo mapping for city "${query.geoResort ?? query.geoCity}" — returning empty result instead of whole-country data`,
        );
      }
      return { offers: [], perSupplier: {} };
    }
    const perSupplier: Record<string, { count: number; error?: string }> = {};
    // Supplier-side STARS filters are best-effort (KazUnion can leak rows of
    // adjacent categories) — enforce the requested hotel category below.
    const wantedStars = this.wantedStarTokens(query);
    // Selected hotel: jobs WITH a resolved HOTELS id are filtered server-side
    // (and adapters re-check by name); jobs without one — the supplier's
    // dictionary lacks that hotel — must never leak other hotels either.
    const wantedHotel = this.normHotel(query.hotel ?? "");
    const settled = await Promise.allSettled(
      jobs.map(async (job) => ({
        code: job.code,
        offers: await this.offerService.search(job.code, job.q),
      })),
    );

    const aggregated: AggregatedOffer[] = [];
    // Jobs can legitimately return the SAME offer (TOURINC fan-out = N jobs
    // over one supplier, verified live: Гойнюк 3 jobs → 2235 offers of which
    // only 921 unique). One external offer must reach the marketplace once.
    const seenOffers = new Set<string>();
    settled.forEach((res, i) => {
      const code = jobs[i].code;
      if (res.status === "fulfilled") {
        // Only bookable offers reach the marketplace: rows with a sales stop
        // or without flight seats are excluded, UNKNOWN stays (no fake data).
        let bookable = res.value.offers.filter(
          (o) => o.availability !== "NOT_AVAILABLE",
        );
        if (wantedStars) {
          const before = bookable.length;
          bookable = bookable.filter((o) => this.offerStarInCategory(o.hotel, wantedStars));
          const dropped = before - bookable.length;
          if (dropped > 0) {
            this.logger.log(
              `Aggregated search: ${code} — ${dropped} offers dropped (hotel category ${[...wantedStars].join(", ")})`,
            );
          }
        }
        if (wantedHotel && !jobs[i].q.hotelExternalId) {
          // No native HOTELS id for this supplier → the name is the only
          // truth: drop every offer of another hotel.
          const before = bookable.length;
          bookable = bookable.filter((o) => this.offerHotelMatches(o.hotel, wantedHotel));
          const dropped = before - bookable.length;
          if (dropped > 0) {
            this.logger.log(
              `Aggregated search: ${code} — ${dropped} offers dropped (hotel "${query.hotel}" not in supplier dictionary)`,
            );
          }
        }
        const hidden = res.value.offers.length - bookable.length;
        if (hidden > 0) {
          this.logger.log(`Aggregated search: ${code} — ${hidden} offers hidden (stop-sale/no seats)`);
        }
        let unique = 0;
        for (const offer of bookable) {
          const key = `${code}:${offer.externalOfferId}`;
          if (seenOffers.has(key)) continue;
          seenOffers.add(key);
          unique += 1;
          aggregated.push(this.normalizeGeo(offer));
        }
        perSupplier[code] = {
          count: (perSupplier[code]?.count ?? 0) + unique,
        };
      } else {
        const err = res.reason instanceof Error ? res.reason.message : String(res.reason);
        this.logger.warn(`Aggregated search: ${code} (job ${i}) failed: ${err}`);
        if (!perSupplier[code]?.count) perSupplier[code] = { count: 0, error: err };
      }
    });

    aggregated.sort((a, b) => (a.price?.amount ?? Infinity) - (b.price?.amount ?? Infinity));
    return { offers: aggregated, perSupplier };
  }

  /**
   * Requested hotel-category tokens ("3*", "4*+") parsed from the query's
   * hotelStars labels. Returns null when the post-filter must not run:
   * no stars requested, or a non-star label («Семейный», «SpecClass» …)
   * that cannot be verified from the hotel name.
   */
  private wantedStarTokens(query: SupplierSearchQuery): Set<string> | null {
    if (!query.hotelStars?.length) return null;
    const tokens = new Set<string>();
    for (const label of query.hotelStars) {
      const m = label.trim().match(/^([1-5])\s*(\*\+?)$/);
      if (!m) return null;
      tokens.add(`${m[1]}${m[2]}`);
    }
    return tokens;
  }

  /**
   * true when the offer may belong to the requested category: hotels without
   * a parsable star rating in the name stay (cannot disprove), hotels with a
   * different token ("4*" vs wanted "3*") are dropped.
   */
  private offerStarInCategory(hotel: string | undefined, wanted: Set<string>): boolean {
    const m = (hotel ?? "").match(/([1-5])\s*(\*\+?)/);
    if (!m) return true;
    return wanted.has(`${m[1]}${m[2]}`);
  }

  /** Normalized hotel identity: lowercase, ё→е, alphanumerics only. */
  private normHotel(s: string): string {
    return s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]/gi, "");
  }

  /**
   * The offer is for the selected hotel: exact normalized match, or one name
   * contains the other (supplier strings vary in suffixes/parentheses) with a
   * length guard so a very short name cannot match everything.
   */
  private offerHotelMatches(hotel: string | undefined, wanted: string): boolean {
    const n = this.normHotel(hotel ?? "");
    if (!n) return false;
    if (n === wanted) return true;
    if (n.length >= 4 && wanted.includes(n)) return true;
    if (wanted.length >= 4 && n.includes(wanted)) return true;
    return false;
  }

  /**
   * Enabled supplier adapters OF THE GIVEN SERVICE (search-enabled), for the
   * search form's «Поставщики» picker. Deterministic order by code.
   */
  listSuppliersOfService(serviceType: SupplierServiceType): Array<{
    code: string;
    name: string;
  }> {
    return this.registry
      .getEntries()
      .filter(({ adapter, config }) => {
        // Entries-based: the same code can be registered per category, so the
        // registration's own serviceTypes decide (not getConfig(code), which
        // resolves only the first entry of that code).
        if (config.serviceTypes?.length && !config.serviceTypes.includes(serviceType)) {
          return false;
        }
        return adapter.enabled && config.searchEnabled;
      })
      .map(({ adapter }) => ({ code: adapter.code, name: adapter.name }))
      .sort((x, y) => x.code.localeCompare(y.code));
  }

  /**
   * Distinct supplier codes that WILL be queried for this direction: the same
   * capability + geo-link resolution as the live search, but without spending a
   * live request. Powers the loading UI ("Определяем поставщиков…" → "Найдены
   * поставщики: …") so the user sees who is being asked while the search runs.
   */
  async resolveSuppliers(
    serviceType: SupplierServiceType,
    query: SupplierSearchQuery,
  ): Promise<string[]> {
    const { jobs } = await this.buildJobs(serviceType, query);
    const codes: string[] = [];
    for (const job of jobs) {
      if (!codes.includes(job.code)) codes.push(job.code);
    }
    return codes;
  }

  /**
   * Candidate suppliers → concrete search jobs: capability gate, then
   * SupplierGeoLink resolution. Shared by the live search and by
   * resolveSuppliers so both always agree on who participates.
   */
  private async buildJobs(
    serviceType: SupplierServiceType,
    query: SupplierSearchQuery,
  ): Promise<{ jobs: { code: string; q: SupplierSearchQuery }[]; hasCandidates: boolean }> {
    // Category context travels WITH the query: it selects the right adapter on
    // registry lookups (tours vs hotels of one provider), participates in the
    // search cache key (deriveSearchKey hashes the whole query), and lets
    // per-service capability overrides apply in supports().
    const svcQuery: SupplierSearchQuery = { ...query, service: serviceType };
    const candidates = this.registry
      .getEntries()
      .filter(({ adapter, config }) => {
        // Entries-based: a provider code registers one adapter per service;
        // the registration's own serviceTypes gate the category (not
        // getConfig(code), which can only resolve the first entry of a code).
        if (config.serviceTypes?.length && !config.serviceTypes.includes(serviceType)) {
          return false;
        }
        return adapter.enabled && config.searchEnabled;
      })
      // Supplier whitelist («Поставщики» picker): empty = all.
      .filter(({ adapter }) => !svcQuery.suppliers?.length || svcQuery.suppliers.includes(adapter.code))
      .filter(({ adapter }) => this.supports(adapter.code, svcQuery))
      .map(({ adapter }) => adapter);

    if (candidates.length === 0) {
      return { jobs: [], hasCandidates: false };
    }

    // City/resort → supplier town/program resolution (SupplierGeoLink): when
    // the user picks a Master Geography city/resort, replace the whole-country
    // search with per-city filters (e.g. Дубай → TOWNS=<ids>, legacy: TOURINC
    // 3706). Suppliers without a mapping for the city are skipped — they
    // cannot answer the query precisely (a country-wide result would be a
    // false match).
    const perSupplierQueries = await this.resolveGeoQueries(
      candidates.map((a) => a.code),
      svcQuery,
    );

    // Hotel star category labels ("5*", "HV-1") → supplier-native STARS ids
    // (SupplierGeoLink kind=STAR). Per-supplier: a supplier without an ingested
    // mapping for the label searches without the star filter (never a wrong id).
    if (svcQuery.hotelStars?.length) {
      await this.resolveStarKeys(svcQuery, perSupplierQueries);
    }

    // Selected hotel NAME → per-supplier native HOTELS ids (kind=HOTEL), so
    // each adapter filters server-side (HOTELS=<id>&HOTELS_ANY=0).
    if (svcQuery.hotel?.trim()) {
      await this.resolveHotelKeys(svcQuery, perSupplierQueries);
    }

    // One job per geo link (TOURINC is singular per SAMO search); without a
    // program filter — «Любой» — a supplier resolves to a single job.
    const jobs: { code: string; q: SupplierSearchQuery }[] = [];
    for (const adapter of candidates) {
      const raw = perSupplierQueries[adapter.code];
      // No entry = no precise city mapping for this supplier → skip it.
      if (!raw) continue;
      // `suppliers` is a ROUTING hint (which suppliers to query), not search
      // criteria — but resolveGeoQueries shares the original query object, so
      // it used to leak into job.q. The search cache derives its key from the
      // whole q: «KOMPAS» and «KOMPAS,ANEX» selections then produced different
      // keys for the SAME search — every multi-supplier query missed the cache
      // and re-ran the slowest adapter. Strip it at the job boundary.
      const q: SupplierSearchQuery = { ...raw, suppliers: undefined };
      jobs.push({ code: adapter.code, q });
    }
    return { jobs, hasCandidates: true };
  }

  /**
   * Resolve hotelStars labels → per-supplier native STARS ids (starKeys) via
   * SupplierGeoLink kind=STAR. Mutates the per-supplier query map: a supplier
   * whose dictionary has no such category searches without the filter.
   */
  private async resolveStarKeys(
    query: SupplierSearchQuery,
    perSupplierQueries: Record<string, SupplierSearchQuery>,
  ): Promise<void> {
    const wanted = query.hotelStars!.map((s) => s.trim().toLowerCase()).filter(Boolean);
    const links = await this.prisma.supplierGeoLink.findMany({
      where: { kind: "STAR", supplierCode: { in: Object.keys(perSupplierQueries) } },
      select: { supplierCode: true, externalId: true, label: true },
    });
    for (const [code, q] of Object.entries(perSupplierQueries)) {
      const supplierLinks = links.filter((l) => l.supplierCode === code);
      if (supplierLinks.length === 0) {
        // No ingested star dictionary → the adapter's own mapping handles
        // numeric stars (KazUnion STARS_KEY), or the filter is dropped.
        continue;
      }
      const ids = supplierLinks
        .filter((l) => wanted.includes(l.label.trim().toLowerCase()))
        .map((l) => l.externalId);
      if (ids.length > 0) {
        perSupplierQueries[code] = { ...q, starKeys: { ...q.starKeys, [code]: ids.join(",") } };
      }
    }
  }

  /**
   * Resolve the selected hotel NAME → per-supplier native HOTELS id
   * (SupplierGeoLink kind=HOTEL) so adapters filter server-side
   * (HOTELS=<id>&HOTELS_ANY=0). Country-scoped: the same name can exist in
   * different countries with different ids. A supplier whose dictionary has
   * no such hotel keeps no key — its offers are then name-post-filtered in
   * searchByService (and adapters re-check by name themselves).
   */
  private async resolveHotelKeys(
    query: SupplierSearchQuery,
    perSupplierQueries: Record<string, SupplierSearchQuery>,
  ): Promise<void> {
    const wanted = this.normHotel(query.hotel!.trim());
    if (!wanted) return;

    const iso = this.normalizeCountry(query.country ?? query.destination);
    const country = iso
      ? await this.prisma.geoCountry.findUnique({ where: { code: iso }, select: { id: true } })
      : null;
    const links = await this.prisma.supplierGeoLink.findMany({
      where: {
        kind: "HOTEL",
        supplierCode: { in: Object.keys(perSupplierQueries) },
        ...(country ? { OR: [{ geoCountryId: country!.id }, { geoCountryId: null }] } : {}),
      },
      select: { supplierCode: true, externalId: true, label: true },
    });
    for (const [code, q] of Object.entries(perSupplierQueries)) {
      const match = links.find(
        (l) => l.supplierCode === code && this.normHotel(l.label) === wanted,
      );
      if (match) {
        perSupplierQueries[code] = { ...q, hotelExternalId: match.externalId };
      }
    }
  }

  /**
   * When geoCity/geoResort is set, resolve SupplierGeoLink rows to supplier-
   * specific town filters (TOWNS=<ids>) or legacy TOURINC fan-out.
   *
   * Precision rule: a supplier WITHOUT links for the selected city must NOT
   * silently widen to the whole-country search — that is exactly how
   * "страна+город» returned «все туры страны". Such suppliers are skipped
   * for this query: showing nothing from a supplier is honest, showing
   * another city's tours as if they matched is not.
   */
  private async resolveGeoQueries(
    supplierCodes: string[],
    query: SupplierSearchQuery,
  ): Promise<Record<string, SupplierSearchQuery>> {
    const result: Record<string, SupplierSearchQuery> = {};
    const geoCode = query.geoResort ?? query.geoCity;
    if (!geoCode) {
      for (const code of supplierCodes) result[code] = query;
      return result;
    }

    try {
      // Codes such as "AE-DEIRA" or "AE-DUBAY IZ BAKU" never appear verbatim in
      // a supplier label — their Master Geography names do ("Deira",
      // "Дубай из Баку"). Match labels against those names too, scoped to the
      // geo entity's own country so a name cannot bleed into another country.
      const { names: geoNames, countryCode, cityId } = await this.resolveGeoNames(geoCode);

      const conditions: Prisma.SupplierGeoLinkWhereInput[] = [
        { geoCity: { code: geoCode } },
        { geoResort: { code: geoCode } },
        // Scoped to the entity's country: a bare `contains: geoCode` matches
        // "BAKU" inside "Bakung Beach Resort" (Indonesia) and fanned a Baku
        // city search out into 3 whole-inventory jobs.
        ...(countryCode
          ? [{ label: { contains: geoCode, mode: "insensitive" as const }, geoCountry: { code: countryCode } }]
          : []),
      ];
      // A city search must cover its resorts too: selecting "Пхукет" means all
      // of Phuket's towns (KOMPAS groups them under the city), not only the
      // town that carries the city's own name.
      if (cityId) conditions.push({ geoResort: { cityId } });
      for (const name of geoNames) {
        conditions.push({
          label: { contains: name, mode: "insensitive" },
          ...(countryCode ? { geoCountry: { code: countryCode } } : {}),
        });
      }

      const links = await this.prisma.supplierGeoLink.findMany({
        where: {
          supplierCode: { in: supplierCodes },
          OR: conditions,
        },
        select: { supplierCode: true, externalId: true, label: true, kind: true },
      });
      for (const code of supplierCodes) {
        const supplierLinks = links.filter((l) => l.supplierCode === code);
        if (supplierLinks.length === 0) {
          // No mapping for this city → the supplier cannot answer it precisely.
          // Leave the code out of the result: the job builder skips suppliers
          // missing from the map instead of running a whole-country search.
          continue;
        }
        // SAMO: city/resort filter = TOWNS=<ids>&TOWNS_ANY=0 (verified
        // supplier capture). Resort selection = subset of the city's towns.
        const townLinks = supplierLinks.filter((l) => l.kind === "TOWN");
        const townIds = townLinks.map((l) => l.externalId);
        // The NAME channel travels with the id one: ANEX hotel rows of the
        // no-flight packets carry a NEGATIVE townInc (id filter dead), so the
        // adapter also matches the row's townName/hotelTownName against these
        // (entity names + the supplier's own TOWN labels).
        const townNames = [
          ...new Set([...geoNames, ...townLinks.map((l) => l.label).filter((l): l is string => !!l)]),
        ];
        if (townIds.length > 0) {
          result[code] = { ...query, towns: townIds.join(","), townNames };
          continue;
        }
        // No TOWN ids for this city (e.g. KOMPAS has no resort link for a
        // city-tour destination like Istanbul): search WITHOUT a program
        // filter — «Любой». The legacy TOURINC fan-out pinned the search to
        // the programs stored at ingest time; when the supplier re-numbers its
        // programs those ids go stale and the search silently returns nothing.
        // Country-wide precision for such cities is an accepted trade-off;
        // townNames still travels for adapters that post-filter by name.
        result[code] = { ...query, townNames };
      }
    } catch (e) {
      // Geo resolution failed → be conservative: skip every supplier for this
      // city query rather than returning an unfiltered country result.
      this.logger.warn(
        `resolveGeoQueries failed — skipping suppliers for city "${geoCode}" ` +
        `(no precise country fallback): ${e instanceof Error ? e.message : String(e)}`,
      );
      return {};
    }
    return result;
  }

  /**
   * Display names + ISO country of a Master Geography code (city or resort).
   * Supplier labels carry names ("Deira"), never our codes ("AE-DEIRA"), so
   * this is what makes label matching possible for unlinked geo objects.
   */
  private async resolveGeoNames(
    geoCode: string,
  ): Promise<{ names: string[]; countryCode: string; cityId?: string }> {
    const city = await this.prisma.geoCity.findUnique({
      where: { code: geoCode },
      select: { id: true, names: true, country: { select: { code: true } } },
    });
    if (city) {
      return {
        names: this.nameVariants(city.names),
        countryCode: city.country.code,
        cityId: city.id,
      };
    }
    const resort = await this.prisma.geoResort.findUnique({
      where: { code: geoCode },
      select: { names: true, city: { select: { country: { select: { code: true } } } } },
    });
    if (resort) {
      // No cityId for a RESORT on purpose: widening to the city's TOWN links
      // would answer «Гойнюк» with every town of KEMER. The resort keeps its
      // direct links plus the name channel (townNames) which is precise.
      return { names: this.nameVariants(resort.names), countryCode: resort.city.country.code };
    }
    return { names: [], countryCode: "" };
  }

  private nameVariants(names: unknown): string[] {
    if (!names || typeof names !== "object") return [];
    const out = new Set<string>();
    for (const value of Object.values(names as Record<string, unknown>)) {
      if (typeof value !== "string") continue;
      const name = value.trim();
      if (name.length >= 3) out.add(name);
    }
    return [...out];
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
