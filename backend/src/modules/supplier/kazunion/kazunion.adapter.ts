import { Injectable, Logger } from "@nestjs/common";
import {
  KazunionHttpService,
  type KazunionOfferRow,
  type KazunionProgram,
} from "./kazunion-http.service";
import type {
  SupplierAdapter,
  SupplierSearchQuery,
  SupplierOffer,
  SupplierOfferDetail,
  SupplierOfferRef,
  SupplierPriceSnapshot,
  SupplierAvailability,
  SupplierAvailabilitySnapshot,
  PriceCalendarQuery,
  PriceCalendarEntry,
  PriceCalendarResult,
} from "../supplier.types";

/**
 * KazUnion adapter (online.kazunion.com) — SAMO platform like Summertour,
 * but served over plain HTTP (verified live: no browser session, no captcha).
 *
 * Search flow: country → STATEINC (discovered dictionary) → TOURINC programs
 * (explicit tourIncValue or all programs of the country) → PRICES query per
 * program with PRICEPAGE pagination → normalized SupplierOffer[].
 *
 * Departure town: KazUnion supports departure towns per country group; the
 * default (and our sync source) is Baku = 849.
 */

/** Departure town aliases (ru/en) → KazUnion TOWNFROMINC. */
const TOWN_ALIASES: Record<string, string> = {
  baku: "849", баку: "849", "1411": "849", // 1411 = KOMPAS Baku id
  moscow: "2", москва: "2",
  "saint petersburg": "613", "st. petersburg": "613", "sankt-peterburg": "613", "санкт-петербург": "613", спб: "613",
  ufa: "1470", уфа: "1470",
  yekaterinburg: "207", екатеринбург: "207",
  irkutsk: "2133", иркутск: "2133",
  krasnoyarsk: "1379", красноярск: "1379",
  novosibirsk: "807", новосибирск: "807",
  sochi: "843", сочи: "843",
  almaty: "57", алматы: "57",
  astana: "7", астана: "7", nur: "7",
  shymkent: "94", шымкент: "94",
  atyrau: "9", атырау: "9",
  aktobe: "95", актау: "95",
  aktau: "68",
  oral: "5", уральск: "5",
  yerevan: "850", ереван: "850",
  tbilisi: "573", тбилиси: "573",
  bishkek: "86", бишкек: "86",
  samarkand: "838", самарканд: "838",
  tashkent: "839", ташкент: "839",
  andijan: "1319", андижан: "1319",
  urgench: "1451", ургенч: "1451",
  istanbul: "174", стамбул: "174",
};

/** Country aliases (ISO-2 / ru / en) → candidate state names as served by the supplier (Russian labels first). */
const COUNTRY_ALIASES: Record<string, string[]> = {
  tr: ["Турция", "Turkey"], turkey: ["Турция", "Turkey"], турция: ["Турция", "Turkey"],
  türkiye: ["Турция", "Turkey"], turkiye: ["Турция", "Turkey"],
  cn: ["Китай", "China"], china: ["Китай", "China"], китай: ["Китай", "China"],
  ge: ["Грузия", "Georgia"], georgia: ["Грузия", "Georgia"], грузия: ["Грузия", "Georgia"],
  kz: ["Казахстан", "Kazakhstan"], kazakhstan: ["Казахстан", "Kazakhstan"], казахстан: ["Казахстан", "Kazakhstan"],
  mv: ["Мальдивы", "Maldives"], maldives: ["Мальдивы", "Maldives"], мальдивы: ["Мальдивы", "Maldives"],
  qa: ["Катар", "Qatar"], qatar: ["Катар", "Qatar"], катар: ["Катар", "Qatar"],
  sg: ["Сингапур", "Singapore"], singapore: ["Сингапур", "Singapore"], сингапур: ["Сингапур", "Singapore"],
  th: ["Таиланд", "Thailand"], thailand: ["Таиланд", "Thailand"], таиланд: ["Таиланд", "Thailand"],
};

/** Supplier-neutral star rating → KazUnion STARS checklistbox ids. */
const STARS_KEY: Record<number, string> = { 3: "10003", 4: "10004", 5: "10001" };

/** Country alias lookup shared with the sync service (ru/en/ISO-2 → supplier names). */
export function kazunionCountryCandidates(input: string): string[] {
  const key = input.trim().toLowerCase();
  return COUNTRY_ALIASES[key] ?? [input.trim()];
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

function generateWindows(from: string, to: string, sizeDays = 30): Array<{ from: string; to: string }> {
  const windows: Array<{ from: string; to: string }> = [];
  const current = new Date(from);
  const end = new Date(to);
  while (current <= end) {
    const windowEnd = new Date(current);
    windowEnd.setDate(windowEnd.getDate() + sizeDays);
    if (windowEnd > end) windowEnd.setTime(end.getTime());
    windows.push({ from: toIsoDate(current), to: toIsoDate(windowEnd) });
    current.setTime(windowEnd.getTime());
    current.setDate(current.getDate() + 1);
  }
  return windows;
}

@Injectable()
export class KazunionAdapter implements SupplierAdapter {
  readonly code = "KAZUNION";
  readonly name = "KazUnion (online.kazunion.com)";
  readonly enabled = true;

  private readonly logger = new Logger(KazunionAdapter.name);
  /** Program → STATEINC memory (calendar fallback when destination is absent). */
  private readonly programState = new Map<string, string>();

  constructor(private readonly http: KazunionHttpService) {}

  // ── Resolution helpers ────────────────────────────────────────────────

  private resolveTown(departureCity?: string): string {
    if (!departureCity) return "849";
    const key = departureCity.trim().toLowerCase();
    const mapped = TOWN_ALIASES[key];
    if (mapped) return mapped;
    if (/^\d+$/.test(key)) {
      this.logger.warn(`KazUnion: unknown departure town id ${key} — falling back to Baku (849)`);
      return "849";
    }
    this.logger.warn(`KazUnion: unknown departure town "${departureCity}" — falling back to Baku (849)`);
    return "849";
  }

  /** Supplier-neutral transport → KazUnion FREIGHTTYPE select (0 = any, 2 = regular). */
  private resolveFreightType(transport?: string): string {
    if (!transport) return "0";
    const t = transport.trim().toLowerCase();
    if (/^\d+$/.test(t)) return t;
    if (/регуляр|regular/.test(t)) return "2";
    return "0";
  }

  /** Supplier-neutral stars → KazUnion STARS checklistbox ids (undefined = any). */
  private resolveStarsKey(stars?: number[]): string | undefined {
    if (!stars?.length) return undefined;
    const keys = stars.map((s) => STARS_KEY[s]).filter((k): k is string => Boolean(k));
    return keys.length ? keys.join(",") : undefined;
  }

  /** Resolve a supplier-neutral country/destination string → STATEINC. */
  private async resolveState(candidate: string | undefined, townFrom: string): Promise<{ value: string; name: string }> {
    if (!candidate) {
      throw new Error("KazUnion: UNSUPPORTED query — country/destination is required");
    }
    const states = await this.http.discoverStates(townFrom);
    const wanted = candidate.trim().toLowerCase();
    const candidates = (COUNTRY_ALIASES[wanted] ?? [candidate.trim()]).map((c) => c.toLowerCase());

    let state = states.find((s) => candidates.includes(s.name.toLowerCase()));
    if (!state) state = states.find((s) => s.name.toLowerCase() === wanted);
    if (!state) {
      const available = states.map((s) => s.name).join(", ");
      throw new Error(
        `KazUnion: UNSUPPORTED destination "${candidate}" — supplier serves: ${available}`,
      );
    }
    return state;
  }

  // ── Sync discovery ────────────────────────────────────────────────────

  /** Countries + programs from Baku (sync entry point). */
  async discoverCountriesAndProgramsForSync(): Promise<
    Array<{ countryId: string; countryName: string; programs: KazunionProgram[] }>
  > {
    return this.http.discoverCountriesAndPrograms("849");
  }

  // ── SupplierAdapter ───────────────────────────────────────────────────

  async search(query: SupplierSearchQuery): Promise<SupplierOffer[]> {
    const start = Date.now();
    const townFrom = this.resolveTown(query.departureCity);
    const state = await this.resolveState(query.country ?? query.destination, townFrom);

    let programs: KazunionProgram[];
    if (query.tourIncValue) {
      programs = [{ value: query.tourIncValue, name: query.tourIncName ?? "" }];
    } else {
      programs = await this.http.discoverPrograms(state.value, townFrom);
      if (programs.length === 0) {
        this.logger.warn(`KazUnion: no programs discovered for ${state.name} (town=${townFrom})`);
        return [];
      }
    }

    const dateFrom = query.departureDateFrom ?? toIsoDate(new Date());
    const dateTo = query.departureDateTo
      ? (query.departureDateTo < dateFrom ? dateFrom : query.departureDateTo)
      : addDays(dateFrom, 7);
    const nightsFrom = query.nightsFrom ?? 3;
    const nightsTill = query.nightsTo ?? (query.nightsFrom !== undefined ? query.nightsFrom : 15);

    const dict = await this.http.fetchDictionary(townFrom, state.value);
    const mealKey = this.resolveMeal(query.meal, dict.meals);
    const townKey = this.resolveTownFilter(query.destination, dict.towns, state.name);

    const rows: KazunionOfferRow[] = [];
    for (const program of programs) {
      try {
        const programRows = await this.http.fetchPrices({
          townFromInc: townFrom,
          stateInc: state.value,
          tourInc: program.value,
          checkInBeg: dateFrom,
          checkInEnd: dateTo,
          nightsFrom,
          nightsTill,
          adults: query.adults ?? 2,
          children: query.children ?? 0,
          childAges: query.childAges,
          hotelKey: query.hotelExternalId,
          mealKey,
          townKey,
          freightType: this.resolveFreightType(query.transport),
          starsKey: this.resolveStarsKey(query.hotelStars),
          starsAny: !query.hotelStars?.length,
        });
        rows.push(...programRows);
        this.programState.set(program.value, state.value);
      } catch (err) {
        const msg = (err as Error).message;
        // Fail the whole search on captcha/HTTP errors — never show partial
        // inventory as if it were complete.
        if (/captcha|antibot|HTTP \d|Timeout/i.test(msg)) {
          throw new Error(`KazUnion: ${msg}`);
        }
        this.logger.warn(`KazUnion program ${program.value} (${program.name}) failed: ${msg}`);
      }
    }

    const offers = this.normalizeRows(rows, query, state, programs);
    this.logger.log(
      `KazUnion search ${state.name} ${programs.length} program(s) ${dateFrom}→${dateTo}: ` +
      `${rows.length} rows → ${offers.length} offers in ${Date.now() - start}ms`,
    );
    return offers;
  }

  async getOffer(ref: SupplierOfferRef): Promise<SupplierOfferDetail> {
    const offers = await this.search({ ...ref.searchContext, adults: ref.searchContext.adults ?? 2 });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    if (m) return { ...m };
    return {
      supplierCode: this.code,
      externalOfferId: ref.externalOfferId,
      externalClaim: ref.externalClaim,
      hotel: ref.searchContext.hotel ?? "",
      departureDate: ref.searchContext.departureDateFrom ?? "",
      nights: ref.searchContext.nightsFrom ?? 0,
      adults: ref.searchContext.adults ?? 2,
      children: ref.searchContext.children ?? 0,
      childAges: ref.searchContext.childAges ?? [],
      price: { amount: 0, currency: "USD", fetchedAt: new Date(), expiresAt: new Date(), queryHash: "", source: this.code },
      availability: "NOT_AVAILABLE",
      fetchedAt: new Date(),
      expiresAt: new Date(),
    };
  }

  async refreshPrice(ref: SupplierOfferRef): Promise<SupplierPriceSnapshot> {
    const offers = await this.search({ ...ref.searchContext, adults: ref.searchContext.adults ?? 2 });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    return m
      ? m.price
      : {
          amount: 0,
          currency: "USD",
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          queryHash: JSON.stringify(ref.searchContext),
          source: this.code,
        };
  }

  async refreshAvailability(ref: SupplierOfferRef): Promise<SupplierAvailabilitySnapshot> {
    const offers = await this.search({ ...ref.searchContext, adults: ref.searchContext.adults ?? 2 });
    const m = offers.find((o) => o.externalOfferId === ref.externalOfferId);
    return {
      availability: m ? "AVAILABLE" : "NOT_AVAILABLE",
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };
  }

  async getPriceCalendar(query: PriceCalendarQuery): Promise<PriceCalendarResult> {
    const now = new Date();
    const townFrom = "849"; // Baku — PriceCalendarQuery carries no departure town

    let stateInc: string | undefined;
    let stateName: string | undefined;

    // 1. Program memory from previous searches (cheapest, exact).
    const explicitPrograms = (query.tourIncValues?.length ? query.tourIncValues : query.tourIncValue ? [query.tourIncValue] : [])
      .map((v, i) => ({ value: v, name: query.tourIncNames?.[i] ?? (v === query.tourIncValue ? query.tourIncName : undefined) ?? "" }));
    for (const p of explicitPrograms) {
      const remembered = this.programState.get(p.value);
      if (remembered) {
        stateInc = remembered;
        break;
      }
    }

    // 2. Destination name → STATEINC.
    if (!stateInc && query.destination) {
      try {
        const state = await this.resolveState(query.destination, townFrom);
        stateInc = state.value;
        stateName = state.name;
      } catch {
        /* fall through to program scan */
      }
    }

    // 3. Scan discovered programs of every state (dictionary is cached).
    let programs = explicitPrograms;
    if (!stateInc) {
      const states = await this.http.discoverStates(townFrom);
      for (const state of states) {
        const found = await this.http.discoverPrograms(state.value, townFrom);
        const wanted = new Set(programs.map((p) => p.value));
        if (programs.length > 0 && found.some((p) => wanted.has(p.value))) {
          stateInc = state.value;
          stateName = state.name;
          break;
        }
      }
    }

    if (!stateInc) {
      const states = await this.http.discoverStates(townFrom);
      throw new Error(
        `KazUnion: UNSUPPORTED calendar — cannot resolve country (destination=${query.destination ?? "?"}, ` +
        `programs=${programs.map((p) => p.value).join("/") || "none"}; serves: ${states.map((s) => s.name).join(", ")})`,
      );
    }
    if (!stateName) {
      const states = await this.http.discoverStates(townFrom);
      stateName = states.find((s) => s.value === stateInc)?.name ?? stateInc;
    }

    // No explicit program → calendar covers every program of the country.
    if (programs.length === 0) {
      const discovered = await this.http.discoverPrograms(stateInc, townFrom);
      programs = discovered.map((p) => ({ value: p.value, name: p.name }));
    }

    const dict = await this.http.fetchDictionary(townFrom, stateInc);
    const mealKey = this.resolveMeal(query.meal, dict.meals);

    const collected: SupplierOffer[] = [];
    const windows = generateWindows(query.dateFrom, query.dateTo, 30);
    for (const window of windows) {
      for (const program of programs) {
        try {
          const rows = await this.http.fetchPrices({
            townFromInc: townFrom,
            stateInc,
            tourInc: program.value,
            checkInBeg: window.from,
            checkInEnd: window.to,
            nightsFrom: query.nights,
            nightsTill: query.nights,
            adults: query.adults ?? 2,
            children: query.children ?? 0,
            childAges: query.childAges,
            hotelKey: query.hotelExternalId,
            mealKey,
            starsAny: true,
            maxPages: 5,
          });
          this.programState.set(program.value, stateInc);
          const offers = this.normalizeRows(
            rows,
            {
              adults: query.adults ?? 2,
              children: query.children,
              childAges: query.childAges,
              tourIncValue: program.value,
              tourIncName: program.name,
              destination: query.destination,
              hotel: query.hotel,
              hotelExternalId: query.hotelExternalId,
            } as SupplierSearchQuery,
            { value: stateInc, name: stateName },
            [{ value: program.value, name: program.name }],
          );
          collected.push(...offers);
        } catch (err) {
          this.logger.warn(
            `KazUnion calendar window ${window.from}→${window.to} program ${program.value}: ${(err as Error).message}`,
          );
        }
      }
    }

    const deduped = this.dedup(collected);
    const filtered = query.hotel
      ? deduped.filter((o) => o.hotel === query.hotel || o.hotelExternalId === query.hotelExternalId)
      : deduped;

    const byDate = new Map<string, SupplierOffer[]>();
    for (const offer of filtered) {
      const arr = byDate.get(offer.departureDate) ?? [];
      arr.push(offer);
      byDate.set(offer.departureDate, arr);
    }

    const allDates: string[] = [];
    {
      const cur = new Date(query.dateFrom);
      const end = new Date(query.dateTo);
      while (cur <= end) {
        allDates.push(toIsoDate(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }

    const entries: PriceCalendarEntry[] = [];
    for (const date of allDates) {
      const arr = (byDate.get(date) ?? []).sort((a, b) => a.price.amount - b.price.amount);
      if (arr.length > 0) {
        const best = arr[0];
        entries.push({
          date,
          price: best.price.amount,
          currency: best.price.currency,
          availability: best.availability,
          offerCount: arr.length,
          offers: arr.map((o) => ({
            tourIncValue: (o.rawMetadata?.tourIncValue as string) ?? "",
            tourIncName: (o.rawMetadata?.tourIncName as string) ?? undefined,
            externalOfferId: o.externalOfferId,
            externalClaim: o.externalClaim,
            hotel: o.hotel,
            hotelExternalId: o.hotelExternalId,
            departureDate: o.departureDate,
            nights: o.nights,
            room: o.room,
            meal: o.meal,
            adults: o.adults,
            children: o.children,
            childAges: o.childAges,
            availability: o.availability,
            price: o.price.amount,
            currency: o.price.currency,
            transport: o.transport,
          })),
          bestOfferRef: {
            supplierCode: this.code,
            externalOfferId: best.externalOfferId,
            externalClaim: best.externalClaim,
            searchContext: {
              adults: query.adults ?? 2,
              children: query.children,
              childAges: query.childAges,
              hotel: query.hotel,
              room: query.room,
              meal: query.meal,
              nightsFrom: query.nights,
              nightsTo: query.nights,
              departureDateFrom: date,
              departureDateTo: date,
              tourIncValue: (best.rawMetadata?.tourIncValue as string) ?? query.tourIncValue,
              tourIncName: (best.rawMetadata?.tourIncName as string) ?? query.tourIncName,
            },
          },
        });
      } else {
        entries.push({
          date,
          price: null,
          currency: null,
          availability: "NOT_AVAILABLE",
          offerCount: 0,
          absenceCode: "SUPPLIER_NO_RESULT",
          absenceText: `Цена не получена — KazUnion не предоставил предложение на ${date}`,
        });
      }
    }

    entries.sort((a, b) => a.date.localeCompare(b.date));
    return {
      supplierCode: this.code,
      contextHash: JSON.stringify({
        hotel: query.hotel,
        room: query.room,
        meal: query.meal,
        adults: query.adults,
        children: query.children,
        nights: query.nights,
        programs: programs.map((p) => p.value),
      }),
      entries,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      totalOffersScanned: deduped.length,
    };
  }

  // ── Normalization ─────────────────────────────────────────────────────

  private resolveMeal(meal: string | undefined, meals: Array<{ value: string; name: string }>): string | undefined {
    if (!meal) return undefined;
    if (/^\d+$/.test(meal)) return meal;
    const wanted = meal.trim().toLowerCase();
    const hit = meals.find((m) => m.name.trim().toLowerCase() === wanted);
    if (hit) return hit.value;
    this.logger.warn(`KazUnion: meal "${meal}" not in dictionary (${meals.map((m) => m.name).join(",")}) — no meal filter`);
    return undefined;
  }

  /** Match destination against the TOWNS dictionary (city/district filter). */
  private resolveTownFilter(
    destination: string | undefined,
    towns: Array<{ value: string; name: string }>,
    stateName: string,
  ): string | undefined {
    if (!destination) return undefined;
    const wanted = destination.trim().toLowerCase();
    if (!wanted || wanted === stateName.trim().toLowerCase()) return undefined;
    const hit = towns.find((t) => t.name.trim().toLowerCase() === wanted);
    if (hit) return hit.value;
    const loose = towns.find((t) => t.name.trim().toLowerCase().includes(wanted));
    if (loose) return loose.value;
    return undefined;
  }

  private normalizeRows(
    rows: KazunionOfferRow[],
    query: SupplierSearchQuery,
    state: { value: string; name: string },
    programs: KazunionProgram[],
  ): SupplierOffer[] {
    const now = new Date();
    const programByName = new Map(programs.map((p) => [p.value, p.name]));
    const out: SupplierOffer[] = [];

    for (const raw of rows) {
      if (!raw.hotel) continue;
      const departureDate = this.parseDepartureDate(raw);
      if (!departureDate) continue;

      const programName =
        programByName.get(raw.tourKey) ?? query.tourIncName ?? undefined;
      const tourIncValue = query.tourIncValue ?? raw.tourKey;

      out.push({
        supplierCode: this.code,
        externalOfferId: `${raw.spoKey}-${raw.hotelKey}-${raw.checkIn}-${raw.roomKey}-${raw.mealKey}`,
        externalClaim: raw.claim || undefined,
        tour: raw.tourKey || undefined,
        hotel: raw.hotel,
        hotelExternalId: raw.hotelKey || undefined,
        country: state.name,
        destination: query.destination,
        departureDate,
        nights: raw.nights,
        room: raw.roomText || raw.roomKey || undefined,
        meal: raw.mealText || undefined,
        adults: raw.adults || query.adults || 2,
        children: raw.children || query.children || 0,
        childAges: query.childAges ?? [],
        price: {
          amount: raw.price,
          currency: raw.currency,
          fetchedAt: now,
          expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
          queryHash: "",
          source: this.code,
        },
        // Honest availability: stop-sale → NOT_AVAILABLE, seat markers →
        // AVAILABLE, otherwise UNKNOWN (never fake AVAILABLE).
        availability: (raw.stopSale
          ? "NOT_AVAILABLE"
          : raw.seatsAvailable
            ? "AVAILABLE"
            : "UNKNOWN") as SupplierAvailability,
        transport: raw.transport || undefined,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
        rawMetadata: {
          spoKey: raw.spoKey,
          hotelKey: raw.hotelKey,
          tourKey: raw.tourKey,
          mealKey: raw.mealKey,
          roomKey: raw.roomKey,
          roomText: raw.roomText,
          mealText: raw.mealText,
          catClaim: raw.claim,
          tourIncValue,
          tourIncName: programName,
          stateInc: state.value,
          townFromInc: this.resolveTown(query.departureCity),
          country: state.name,
          seatsAvailable: raw.seatsAvailable,
          stopSale: raw.stopSale,
        },
      });
    }

    return this.dedup(out);
  }

  /** "05.10.2026, Пн" → "2026-10-05" (fallback: class checkIn YYYYMMDD). */
  private parseDepartureDate(raw: KazunionOfferRow): string {
    const m = raw.departureDateText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    if (/^\d{8}$/.test(raw.checkIn)) {
      return `${raw.checkIn.slice(0, 4)}-${raw.checkIn.slice(4, 6)}-${raw.checkIn.slice(6, 8)}`;
    }
    return "";
  }

  private dedup(offers: SupplierOffer[]): SupplierOffer[] {
    const seen = new Set<string>();
    const out: SupplierOffer[] = [];
    for (const o of offers) {
      const key = `${o.externalOfferId}|${o.externalClaim ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(o);
    }
    return out;
  }
}
