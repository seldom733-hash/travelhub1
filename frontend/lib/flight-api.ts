export interface FlightSearchRequest {
  from: string;
  to: string;
  departureDate: string;
  tripType: "OW" | "RT";
  passengers: {
    adults: number;
    children: number;
    infants: number;
  };
  returnDate?: string;
  isStudent?: boolean;
}

export interface FlightPoint {
  airport?: string;
  city?: string;
  code?: string;
  date?: string;
  time?: string;
}

export interface FlightSegment {
  id?: string;
  departure?: FlightPoint;
  arrival?: FlightPoint;
  duration?: { minutes?: number };
  airline?: { code?: string; name?: string };
  flightNumber?: string;
}

export interface FlightPrice {
  amount?: number;
  currency?: string;
  value?: number;
  total?: number;
}

export interface FlightFare {
  id?: string;
  fareFamily?: string;
  cabin?: string;
  available?: boolean;
  price?: { total?: FlightPrice; base?: FlightPrice };
  baggage?: unknown;
  luggage?: unknown;
}

export interface FlightOffer {
  optionId?: string | null;
  optionSetId?: string | null;
  available?: boolean;
  soldOut?: boolean;
  requested?: FlightSearchRequest;
  route?: unknown;
  segments?: FlightSegment[];
  fares?: FlightFare[];
}

export interface FlightSearchResponse {
  source?: string;
  collectedAt?: string;
  requested?: FlightSearchRequest;
  summary?: unknown;
  flights: FlightOffer[];
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000/api/v1";

export async function createFlightRequest(body: { from: string; to: string; departureDate: string; returnDate?: string; tripType: string; passengers: any; fareFamily: string; price: number; currency: string; segments: any[] }): Promise<any> {
  const res = await fetch(`${API_BASE}/supplier/azal/request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Flight request failed (${res.status})`);
  return res.json();
}

export interface FlightCalendarDayPrice {
  amount?: number;
  currency?: string;
}

/**
 * Flight-date availability for a direction, fetched with a SINGLE backend
 * request (the backend fans out to the AZAL month calendar API, never
 * per-day). Result maps YYYY-MM-DD -> min price. A date present in the map
 * has flights; absent dates have none.
 */
const calendarCache = new Map<
  string,
  Promise<Record<string, FlightCalendarDayPrice>>
>();

export function fetchFlightCalendar(
  from: string,
  to: string,
): Promise<Record<string, FlightCalendarDayPrice>> {
  const key = `${from}-${to}`;
  const cached = calendarCache.get(key);
  if (cached) {
    return cached;
  }

  const pending = (async () => {
    const response = await fetch(`${API_BASE}/supplier/azal/calendar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        passengers: { adults: 1, children: 0, infants: 0 },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `AZAL flight calendar failed (${response.status})${text ? `: ${text}` : ""}`,
      );
    }

    const json = await response.json();
    const prices =
      json && typeof json === "object" && json.prices &&
        typeof json.prices === "object"
        ? (json.prices as Record<string, any>)
        : {};
    const out: Record<string, FlightCalendarDayPrice> = {};
    for (const [date, day] of Object.entries(prices)) {
      out[date] = {
        amount:
          typeof day?.outbound?.price?.amount === "number"
            ? day.outbound.price.amount
            : undefined,
        currency:
          typeof day?.outbound?.price?.currency === "string"
            ? day.outbound.price.currency
            : undefined,
      };
    }
    return out;
  })();

  calendarCache.set(key, pending);
  pending.catch(() => {
    calendarCache.delete(key);
  });
  return pending;
}

export interface AzalDirectoryEntry {
  code: string;
  city: string;
  country: string;
  airport: string;
  search: string;
}

let directoryPromise: Promise<AzalDirectoryEntry[]> | null = null;

/**
 * AZAL network directory from our backend (cached there for 24h and
 * refreshed automatically). Fetched once per page load; failures fall
 * back to the bundled static directory.
 */
export function fetchAzalDirectory(): Promise<AzalDirectoryEntry[]> {
  if (!directoryPromise) {
    directoryPromise = (async () => {
      const response = await fetch(`${API_BASE}/supplier/azal/locations`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`AZAL directory failed (${response.status})`);
      }
      const json = await response.json();
      return Array.isArray(json?.entries) ? json.entries : [];
    })();
    directoryPromise.catch(() => {
      directoryPromise = null;
    });
  }
  return directoryPromise;
}

export async function searchAzalFlights(
  request: FlightSearchRequest,
): Promise<FlightSearchResponse> {
  if (!request.from || !request.to || !request.departureDate) {
    throw new Error("Flight search requires departure airport, arrival airport and departure date.");
  }
  const response = await fetch(`${API_BASE}/supplier/azal/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `AZAL flight search failed (${response.status})${text ? `: ${text}` : ""}`,
    );
  }

  return response.json();
}
