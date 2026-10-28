import { Injectable, Logger } from "@nestjs/common";
import { AnexAdapter } from "../anex/anex.adapter";
import { AnexProvider } from "../anex/anex.provider";
import { SupplierPricingService } from "../../pricing/supplier-pricing.service";
import { SupplierOfferService } from "../supplier-offer.service";
import { SupplierAdapterRegistry } from "../adapter/supplier-adapter.registry";
import type { SupplierCatalogCoverage, SupplierSearchQuery } from "../supplier.types";
import {
  VOYAGER_HOTEL_STATEINC_BY_ISO,
  VOYAGER_HOTEL_STATE_NAMES,
  VOYAGER_STATEINC_BY_ISO,
  VOYAGER_STATE_NAMES,
} from "../voyager/voyager-countries";
import { KAZUNION_HOTEL_COUNTRIES, KAZUNION_HOTEL_ISO_TO_STATEINC } from "../kazunion/kazunion-hotel-countries";
import { KOMPAS_HOTEL_ISO_TO_EN, KOMPAS_HOTEL_STATEINC_TO_ISO, KOMPAS_HOTEL_STATEINC_TO_RU } from "../kompas/kompas-hotel-countries";
import type { SupplierOffer } from "../supplier.types";
import type {
  CatalogCapability,
  CatalogRecord,
  CatalogServiceType,
  CatalogSourceResult,
  CatalogTariffRecord,
} from "./supplier-catalog.types";

const ANEX_COUNTRY_CACHE_MS = 5 * 60 * 1000;

const FSTRAVEL_ISO = ["AE", "CN", "DE", "EG", "ES", "FR", "GE", "ID", "IN", "IT", "JP", "KR", "LK", "MA", "MU", "MY", "MV", "PL", "RS", "SA", "SC", "SG", "TH", "TZ", "TR", "VN"];

const KOMPAS_ISO_TO_STATEINC: Record<string, string> = Object.fromEntries(
  Object.entries(KOMPAS_HOTEL_STATEINC_TO_ISO).map(([stateInc, iso]) => [iso, stateInc]),
);

function day(offset = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function option(key: string, label: string): { key: string; label: string } {
  return { key, label };
}

/**
 * Catalog source contract. A source only fetches and normalizes supplier data;
 * it never writes Product/Tariff. The preview/apply engine owns persistence.
 *
 * The generic path uses SupplierOfferService (registry + cache/resilience), so
 * every registered catalog adapter has one consistent search boundary. ANEX
 * tours keeps its provider-specific country dictionary.
 */
@Injectable()
export class SupplierCatalogSource {
  private readonly logger = new Logger(SupplierCatalogSource.name);
  private anexCountries: { at: number; countries: Array<{ key: string; label: string; searchLabel: string }> } | null = null;

  constructor(
    private readonly anex: AnexAdapter,
    private readonly anexProvider: AnexProvider,
    private readonly pricing: SupplierPricingService,
    private readonly offers: SupplierOfferService,
    private readonly registry?: SupplierAdapterRegistry,
  ) {}

  async capabilities(): Promise<CatalogCapability[]> {
    const anexCountries = await this.anexCountriesCached();
    const voyagerTourCountries = Object.entries(VOYAGER_STATEINC_BY_ISO).map(([iso]) => option(iso, iso));
    const voyagerHotelCountries = Object.entries(VOYAGER_HOTEL_STATEINC_BY_ISO).map(([iso]) => option(iso, iso));
    const kazunionCountries = KAZUNION_HOTEL_COUNTRIES.map((country) => option(country.iso2, country.iso2));
    const kompasCountries = Object.entries(KOMPAS_ISO_TO_STATEINC).map(([iso]) => option(iso, iso));
    // Tour and hotel forms are separate supplier dictionaries. Never merge them:
    // selecting "Туры" must show only tour countries, "Отели" only hotel countries.
    const kompasTourCountries = [
      "TR", "EG", "AE", "MV", "TH", "IN", "ID", "LK", "GE", "CN", "SG", "MY",
      "KZ", "UZ", "US", "CH", "JP", "MU", "TZ", "QA", "KE", "AT", "SC",
    ].map((iso) => option(iso, iso));
    const kazunionTourCountries = ["TR", "CN", "GE", "KZ", "MV", "QA", "SG", "TH"].map((iso) =>
      option(iso, iso),
    );
    const fstravelCountries = FSTRAVEL_ISO.map((iso) => option(iso, iso));

    return [
      { supplierCode: "ANEX", name: "ANEX", serviceTypes: ["tours"], countries: anexCountries },
      {
        supplierCode: "ANEX", name: "ANEX", serviceTypes: ["hotels"], countries: [],
        unavailableReason: "ANEX hotel catalog sync is not implemented; hotel offers are live-search only",
      },
      { supplierCode: "VOYAGER", name: "Voyager", serviceTypes: ["tours"], countries: voyagerTourCountries },
      { supplierCode: "VOYAGER", name: "Voyager", serviceTypes: ["hotels"], countries: voyagerHotelCountries },
      { supplierCode: "KOMPAS", name: "KOMPAS", serviceTypes: ["tours"], countries: kompasTourCountries },
      { supplierCode: "KOMPAS", name: "KOMPAS", serviceTypes: ["hotels"], countries: kompasCountries },
      { supplierCode: "KAZUNION", name: "KazUnion", serviceTypes: ["tours"], countries: kazunionTourCountries },
      { supplierCode: "KAZUNION", name: "KazUnion", serviceTypes: ["hotels"], countries: kazunionCountries },
      { supplierCode: "SUMMERTOUR", name: "SummerTour", serviceTypes: ["tours"], countries: [option("TR", "Турция")] },
      { supplierCode: "FSTRAVEL", name: "FSTravel", serviceTypes: ["tours"], countries: fstravelCountries },
    ];
  }

  async fetch(input: {
    supplierCode: string;
    serviceType: CatalogServiceType;
    countryKey: string;
  }): Promise<CatalogSourceResult> {
    if (input.supplierCode === "ANEX") {
      return this.fetchAnex(input);
    }
    return this.fetchGeneric(input);
  }

  private async fetchAnex(input: { serviceType: CatalogServiceType; countryKey: string }): Promise<CatalogSourceResult> {
    if (input.serviceType !== "tours") {
      return { records: [], complete: false, errors: ["ANEX hotel catalog sync is not implemented"], scope: input };
    }
    const countries = await this.anexCountriesCached();
    const country = countries.find((c) => c.key === input.countryKey);
    if (!country) {
      return { records: [], complete: false, errors: [`Unknown ANEX country ${input.countryKey}`], scope: input };
    }

    let offers: SupplierOffer[] = [];
    let coverage: SupplierCatalogCoverage | null = null;
    const errors: string[] = [];
    const sampledDates: string[] = [];
    // One 7-day week every 5 weeks. Query each date separately: a multi-day
    // ANEX window is answered sparsely, so it would silently miss weekdays.
    for (let offset = 0; offset < 365; offset += 35) {
      for (let dayOffset = 0; dayOffset < 7 && offset + dayOffset < 365; dayOffset++) {
        sampledDates.push(day(offset + dayOffset));
      }
    }
    for (const date of sampledDates) {
      try {
        const result = this.anex.searchCatalog
          ? await this.anex.searchCatalog({
            service: "tours",
            country: country.searchLabel,
            adults: 2,
            departureDateFrom: date,
            departureDateTo: date,
            nightsFrom: 2,
            nightsTo: 7,
            nightOptions: [2, 3, 4, 5, 6, 7],
          })
          : {
            offers: await this.anex.search({
              service: "tours",
              country: country.searchLabel,
              adults: 2,
              departureDateFrom: date,
              departureDateTo: date,
              nightsFrom: 2,
              nightsTo: 7,
              nightOptions: [2, 3, 4, 5, 6, 7],
            }),
            coverage: null,
          };
        offers = offers.concat(result.offers);
        if (result.coverage) coverage = this.mergeCoverage(coverage, result.coverage);
      } catch (error) {
        errors.push(`${date}: ${(error as Error).message}`);
      }
    }

    const groups = groupBy(offers, (offer) => offer.hotelExternalId || offer.hotel || "");
    const records: CatalogRecord[] = [];
    for (const [hotelKey, hotelOffers] of groups) {
      const record = await this.toRecord({
        supplierCode: "ANEX",
        serviceType: "tours",
        externalKey: `ANEX-${hotelKey}`,
        offers: hotelOffers,
        countryCode: country.key,
        stateCode: country.key,
        countryLabel: country.searchLabel,
        hotelKey,
      });
      if (record.error) errors.push(record.error);
      else if (record.record) records.push(record.record);
    }

    return {
      records,
      // Eleven sampled weeks (7 days every 5 weeks), six night lengths
      // (2–7), not the full 365-date/2–28-night matrix. Keep the run PARTIAL
      // so confirm can create/update, but archive of unobserved products is
      // blocked.
      complete: false,
      errors,
      scope: {
        supplierCode: "ANEX",
        serviceType: "tours",
        countryKey: country.key,
        countryLabel: country.key,
        dateFrom: day(0),
        dateTo: day(365),
        coverage,
      },
    };
  }

  private isComplete(coverage: SupplierCatalogCoverage | null, recordCount: number): boolean {
    return Boolean(
      coverage &&
      recordCount > 0 &&
      coverage.pagesFetched > 0 &&
      !coverage.truncated &&
      coverage.programsComplete &&
      coverage.windowsComplete &&
      coverage.errors.length === 0,
    );
  }

  private nightsRange(supplierCode: string, isHotel: boolean): { nightsFrom: number; nightsTo: number } {
    if (isHotel) return { nightsFrom: 7, nightsTo: 7 };
    if (supplierCode === "ANEX") return { nightsFrom: 2, nightsTo: 28 };
    return { nightsFrom: 3, nightsTo: 14 };
  }

  private async fetchSummerPrograms(
    input: { supplierCode: string; serviceType: CatalogServiceType; countryKey: string },
    query: SupplierSearchQuery,
    countryLabel: string,
  ): Promise<CatalogSourceResult> {
    const adapter = this.registry!.get(input.supplierCode, input.serviceType);
    const discover = (adapter as unknown as { discoverPrograms?: () => Promise<Array<{ value: string; name: string }>> }).discoverPrograms;
    if (!discover) {
      return { records: [], complete: false, errors: ["SUMMERTOUR program discovery is unavailable"], scope: input };
    }
    let programs: Array<{ value: string; name: string }> = [];
    const errors: string[] = [];
    try {
      programs = await discover.call(adapter);
    } catch (error) {
      errors.push(`SUMMERTOUR program discovery failed: ${(error as Error).message}`);
    }
    if (programs.length === 0) {
      return { records: [], complete: false, errors, scope: { ...input, countryLabel, programs: [] } };
    }

    let offers: SupplierOffer[] = [];
    let coverage: SupplierCatalogCoverage | null = null;
    for (const program of programs) {
      try {
        const result = await adapter.searchCatalog?.({
          ...query,
          tourIncValue: program.value,
          tourIncName: program.name,
          skipTownDiscovery: true,
        } as SupplierSearchQuery & { skipTownDiscovery: boolean });
        if (!result) continue;
        offers = offers.concat(result.offers);
        coverage = this.mergeCoverage(coverage, result.coverage);
      } catch (error) {
        errors.push(`SUMMERTOUR ${program.value}: ${(error as Error).message}`);
        coverage = this.mergeCoverage(coverage, {
          pagesFetched: 0,
          pageCount: null,
          hasMore: null,
          truncated: true,
          programsComplete: false,
          windowsComplete: false,
          errors: [(error as Error).message],
        });
      }
    }

    const grouped = groupBy(offers, (offer) => this.externalKey(input.supplierCode, input.serviceType, input.countryKey, offer));
    const records: CatalogRecord[] = [];
    for (const [externalKey, group] of grouped) {
      const first = group[0];
      const hotelKey = this.hotelKey(first);
      const stateInc = String(first.rawMetadata?.stateInc ?? this.stateForCountry(input.supplierCode, input.countryKey) ?? "");
      const converted = await this.toRecord({
        supplierCode: input.supplierCode,
        serviceType: input.serviceType,
        externalKey,
        offers: group,
        countryCode: input.countryKey,
        stateCode: stateInc,
        countryLabel,
        hotelKey,
      });
      if (converted.error) errors.push(converted.error);
      else if (converted.record) records.push(converted.record);
    }

    return {
      records,
      complete: this.isComplete(coverage, records.length),
      errors,
      scope: { ...input, countryLabel, programs, coverage },
    };
  }

  private mergeCoverage(a: SupplierCatalogCoverage | null, b: SupplierCatalogCoverage): SupplierCatalogCoverage {
    if (!a) return b;
    const truncated = a.truncated || b.truncated;
    return {
      pagesFetched: a.pagesFetched + b.pagesFetched,
      pageCount: a.pageCount === null ? b.pageCount : b.pageCount === null ? a.pageCount : Math.max(a.pageCount, b.pageCount),
      hasMore: truncated ? true : a.hasMore === null || b.hasMore === null ? null : false,
      truncated,
      programsComplete: a.programsComplete && b.programsComplete,
      windowsComplete: a.windowsComplete && b.windowsComplete,
      errors: [...a.errors, ...b.errors],
    };
  }

  private async fetchGeneric(input: {
    supplierCode: string;
    serviceType: CatalogServiceType;
    countryKey: string;
  }): Promise<CatalogSourceResult> {
    const countryLabel = this.countryLabel(input.supplierCode, input.countryKey);
    const isHotel = input.serviceType === "hotels";
    const { nightsFrom, nightsTo } = this.nightsRange(input.supplierCode, isHotel);
    let offers: SupplierOffer[] = [];
    let coverage: SupplierCatalogCoverage | null = null;
    const errors: string[] = [];
    const query = {
      service: input.serviceType,
      country: input.countryKey,
      destination: countryLabel,
      adults: 2,
      children: 0,
      departureDateFrom: day(0),
      departureDateTo: day(30),
      nightsFrom,
      nightsTo,
      maxPages: 50,
    };
    const adapter = this.registry?.get(input.supplierCode, input.serviceType);
    if (
      input.supplierCode === "SUMMERTOUR" &&
      !isHotel &&
      adapter &&
      typeof (adapter as unknown as { discoverPrograms?: () => Promise<Array<{ value: string; name: string }>> }).discoverPrograms === "function"
    ) {
      return this.fetchSummerPrograms(input, query, countryLabel);
    }
    try {
      if (adapter?.searchCatalog) {
        const result = await adapter.searchCatalog(query);
        offers = result.offers;
        coverage = result.coverage;
      } else {
        offers = await this.offers.search(input.supplierCode, query);
        coverage = null;
      }
    } catch (error) {
      errors.push((error as Error).message);
    }

    const grouped = groupBy(offers, (offer) => this.externalKey(input.supplierCode, input.serviceType, input.countryKey, offer));
    const records: CatalogRecord[] = [];
    for (const [externalKey, group] of grouped) {
      const first = group[0];
      const hotelKey = this.hotelKey(first);
      const stateInc = String(first.rawMetadata?.stateInc ?? this.stateForCountry(input.supplierCode, input.countryKey) ?? "");
      const converted = await this.toRecord({
        supplierCode: input.supplierCode,
        serviceType: input.serviceType,
        externalKey,
        offers: group,
        countryCode: input.countryKey,
        stateCode: isHotel ? stateInc : null,
        countryLabel,
        hotelKey,
      });
      if (converted.error) errors.push(converted.error);
      else if (converted.record) records.push(converted.record);
    }

    return {
      records,
      complete: this.isComplete(coverage, records.length),
      errors,
      scope: {
        ...input,
        countryLabel,
        dateFrom: day(0),
        dateTo: day(30),
        coverage,
      },
    };
  }

  private async toRecord(input: {
    supplierCode: string;
    serviceType: CatalogServiceType;
    externalKey: string;
    offers: SupplierOffer[];
    countryCode: string;
    stateCode: string | null;
    countryLabel: string;
    hotelKey: string;
  }): Promise<{ record: CatalogRecord; error?: never } | { record?: never; error: string }> {
    const valid = input.offers.filter((offer) => offer.price.amount > 0);
    if (valid.length === 0) {
      return { error: `${input.supplierCode}/${input.externalKey}: no positive price — card skipped` };
    }
    // Card price basis: 2 adults, nearest future departure date, then the
    // minimum available night count on that date. Fall back to the minimum
    // offer when the source does not expose date/nights.
    const today = new Date().toISOString().slice(0, 10);
    const dated = valid.filter((offer) =>
      Boolean(offer.departureDate) &&
      Number(offer.nights) > 0 &&
      (offer.adults === undefined || offer.adults === 2),
    );
    const future = dated.filter((offer) => offer.departureDate! >= today);
    const pool = future.length > 0 ? future : dated;
    const nearestDate = pool.length > 0
      ? pool.reduce((min, offer) => (offer.departureDate! < min ? offer.departureDate! : min), pool[0].departureDate!)
      : null;
    const atNearest = nearestDate ? pool.filter((offer) => offer.departureDate === nearestDate) : [];
    const minNights = atNearest.length > 0
      ? Math.min(...atNearest.map((offer) => Number(offer.nights)))
      : null;
    const first = atNearest.length > 0
      ? atNearest
          .filter((offer) => Number(offer.nights) === minNights)
          .sort((a, b) => a.price.amount - b.price.amount)[0] ?? atNearest[0]
      : valid[0];
    const sourcePrice = first.price.amount;
    const sourceCurrency = first.price.currency || "AZN";
    let amount = sourcePrice;
    let currency = sourceCurrency;
    try {
      if (input.supplierCode === "VOYAGER") {
        const converted = await this.pricing.publicAmountWithFxFor(sourcePrice, sourceCurrency, "VOYAGER", input.serviceType);
        amount = converted.amount;
        currency = converted.currency;
      } else {
        amount = await this.pricing.publicAmountFor(sourcePrice, sourceCurrency, input.supplierCode, input.serviceType);
      }
    } catch (error) {
      return { error: `${input.supplierCode}/${input.externalKey}: pricing failed: ${(error as Error).message}` };
    }
    if (!(amount > 0)) {
      return { error: `${input.supplierCode}/${input.externalKey}: public price is not positive — card skipped` };
    }

    const hotelName = first.hotel || "Unknown Hotel";
    const tourKey = this.tourKeyFor(input.supplierCode, first);
    const programName = String(first.rawMetadata?.tourIncName ?? first.tour ?? "");
    const isHotel = input.serviceType === "hotels";
    const title = isHotel ? `${hotelName} (${input.countryLabel})` : `${hotelName}${programName ? ` — ${programName}` : ""} (${input.countryLabel})`;
    const tariffs: CatalogTariffRecord[] = [{
      name: "Base",
      amount,
      currency,
      validFrom: nearestDate ?? undefined,
      inclusions: {
        room: first.room ?? null,
        meal: first.meal ?? null,
        sourcePrice,
        sourceCurrency,
        tourKey,
        priceDate: nearestDate,
        priceNights: minNights,
        priceAdults: 2,
      },
    }];
    return {
      record: {
        supplierCode: input.supplierCode,
        serviceType: input.serviceType,
        externalKey: input.externalKey,
        productType: isHotel ? "HOTEL" : "TOUR",
        categorySlug: isHotel ? "accommodation" : "tours",
        title,
        countryCode: input.countryCode,
        stateCode: input.stateCode,
        hotelKey: input.hotelKey,
        hotelName,
        attributes: {
          ...(first.rawMetadata ?? {}),
          hotelName,
          hotelKey: input.hotelKey,
          country: input.countryLabel,
          countryCode: input.countryCode,
          supplierCode: input.supplierCode,
          startingPrice: amount,
          currency,
          priceDate: nearestDate,
          priceNights: minNights,
          priceAdults: 2,
          priceBasis: "nearest-date-2-adults-min-nights",
          ...(isHotel ? {} : { tourIncValue: tourKey, tourIncName: programName }),
        },
        startingPrice: amount,
        currency,
        tariffs,
      },
    };
  }

  private externalKey(supplierCode: string, serviceType: CatalogServiceType, countryKey: string, offer: SupplierOffer): string {
    const hotelKey = this.hotelKey(offer);
    if (!hotelKey) return "";
    if (serviceType === "hotels") {
      const state = String(offer.rawMetadata?.stateInc ?? this.stateForCountry(supplierCode, countryKey) ?? "");
      return `${supplierCode}HTL-${hotelKey}-${state}`;
    }
    const tourKey = this.tourKeyFor(supplierCode, offer);
    if (supplierCode === "ANEX") return `ANEX-${hotelKey}`;
    if (supplierCode === "FSTRAVEL") return `FSTRAVEL-${hotelKey}`;
    return `${supplierCode}-${tourKey}-${hotelKey}`;
  }

  private tourKeyFor(supplierCode: string, offer: SupplierOffer): string {
    if (supplierCode === "VOYAGER") return String(offer.rawMetadata?.tourKey ?? "0");
    return String(offer.rawMetadata?.tourIncValue ?? offer.rawMetadata?.tourKey ?? "0");
  }

  private hotelKey(offer: SupplierOffer): string {
    return String(
      offer.rawMetadata?.hotelKey ??
      offer.hotelExternalId ??
      offer.rawMetadata?.hotelInc ??
      "",
    );
  }

  private stateForCountry(supplierCode: string, countryKey: string): string | undefined {
    if (supplierCode === "VOYAGER") {
      return VOYAGER_HOTEL_STATEINC_BY_ISO[countryKey] ?? VOYAGER_STATEINC_BY_ISO[countryKey];
    }
    if (supplierCode === "KOMPAS") return KOMPAS_ISO_TO_STATEINC[countryKey];
    if (supplierCode === "KAZUNION") return KAZUNION_HOTEL_ISO_TO_STATEINC[countryKey];
    return undefined;
  }

  private countryLabel(supplierCode: string, countryKey: string): string {
    if (supplierCode === "VOYAGER") {
      const state = VOYAGER_STATEINC_BY_ISO[countryKey] ?? VOYAGER_HOTEL_STATEINC_BY_ISO[countryKey];
      return VOYAGER_STATE_NAMES[state] ?? VOYAGER_HOTEL_STATE_NAMES[state] ?? countryKey;
    }
    if (supplierCode === "KOMPAS") {
      const stateInc = KOMPAS_ISO_TO_STATEINC[countryKey];
      return KOMPAS_HOTEL_STATEINC_TO_RU[stateInc] ?? KOMPAS_HOTEL_ISO_TO_EN[countryKey] ?? countryKey;
    }
    if (supplierCode === "KAZUNION") {
      return KAZUNION_HOTEL_COUNTRIES.find((country) => country.iso2 === countryKey)?.ru ?? countryKey;
    }
    if (supplierCode === "SUMMERTOUR") return "Турция";
    return countryKey;
  }

  private async anexCountriesCached(): Promise<Array<{ key: string; label: string; searchLabel: string }>> {
    const now = Date.now();
    if (this.anexCountries && now - this.anexCountries.at < ANEX_COUNTRY_CACHE_MS) {
      return this.anexCountries.countries;
    }
    try {
      const states = await this.anexProvider.states();
      const countries = states.map((state) => ({
        key: state.stateISO,
        label: state.stateISO,
        searchLabel: state.nameAlt || state.name,
      }));
      this.anexCountries = { at: now, countries };
      return countries;
    } catch (error) {
      this.logger.warn(`ANEX countries discovery failed: ${(error as Error).message}`);
      return this.anexCountries?.countries ?? [];
    }
  }
}
