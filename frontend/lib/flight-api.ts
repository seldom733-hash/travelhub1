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
