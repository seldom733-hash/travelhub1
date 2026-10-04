import type {
  FlightDuration,
  FlightFare,
  FlightFareRule,
  FlightOffer,
  FlightRoute,
  FlightSearchQuery,
  FlightSegment,
  FlightStop,
} from "../azal/flight.types";
import type {
  AviasalesAdditionalTariffInfo,
  AviasalesChunk,
  AviasalesFlightLeg,
  AviasalesFlightTerms,
  AviasalesProposal,
  AviasalesTariffFamily,
  AviasalesTicket,
} from "./aviasales.types";

const SOURCE = "AVIASALES";
const CURRENCY_FALLBACK = "AZN";

/**
 * Translate one Aviasales result chunk into supplier-neutral offers.
 *
 * One `ticket` (one physical itinerary + all fares the market offers for it)
 * becomes one offer with several fares. Proposals are collapsed to a single
 * fare per tariff family — Aviasales re-sells the same family through dozens
 * of agents, and the UI groups rows by family anyway.
 *
 * Only one-way chunks are accepted. The adapter decomposes RT into two OW
 * searches (see AviasalesAdapter), so a multi-segment ticket would mean the
 * supplier answered something we did not ask for — dropping it beats emitting
 * an offer whose fares carry the price of BOTH directions.
 */
export function parseAviasalesChunk(
  chunk: AviasalesChunk,
  query: FlightSearchQuery,
): FlightOffer[] {
  const legs = Array.isArray(chunk.flight_legs) ? chunk.flight_legs : [];
  const tickets = Array.isArray(chunk.tickets) ? chunk.tickets : [];

  const offers: FlightOffer[] = [];

  tickets.forEach((ticket, index) => {
    const offer = parseTicket(ticket, index, legs, chunk, query);

    if (offer) {
      offers.push(offer);
    }
  });

  return offers;
}

/** Maps an Aviasales itinerary to the shared tariff taxonomy. */
export function aviasalesTariffFamily(
  tripClass: string | undefined,
  checkedBags: number,
): AviasalesTariffFamily {
  if (tripClass === "C" || tripClass === "J") {
    return "BUSINESS";
  }
  if (checkedBags >= 2) {
    return "COMFORT";
  }
  // Aviasales never exposes the checked-bag weight, so the 23kg (CLASSIC) and
  // 32kg (PLUS) tiers are indistinguishable — every single checked bag lands
  // in CLASSIC. PLUS stays reserved for suppliers that do report the weight.
  if (checkedBags === 1) {
    return "CLASSIC";
  }
  return "BUDGET";
}

function parseTicket(
  ticket: AviasalesTicket,
  index: number,
  legs: AviasalesFlightLeg[],
  chunk: AviasalesChunk,
  query: FlightSearchQuery,
): FlightOffer | null {
  const segments = Array.isArray(ticket.segments) ? ticket.segments : [];

  if (segments.length !== 1) {
    return null;
  }

  const legIndexes = Array.isArray(segments[0]?.flights)
    ? segments[0].flights
    : [];
  const legValues = legIndexes
    .map((legIndex) => legs[legIndex])
    .filter((leg): leg is AviasalesFlightLeg => Boolean(leg));

  if (!legValues.length || !legValues[0]?.local_departure_date_time) {
    return null;
  }

  const parsedSegments = buildSegments(legValues, ticket, index);

  if (!parsedSegments.length) {
    return null;
  }

  const fares = buildFares(ticket, legIndexes, chunk);

  if (!fares.length) {
    return null;
  }

  const optionId = `${SOURCE}-${index}-${ticket.id ?? "ticket"}`;

  return {
    optionId,
    optionSetId: optionId,
    available: true,
    selected: false,
    userSelected: false,
    soldOut: false,
    requested: { ...query, passengers: { ...query.passengers } },
    route: buildRoute(legValues),
    segments: parsedSegments,
    fares,
  };
}

function buildSegments(
  legValues: AviasalesFlightLeg[],
  ticket: AviasalesTicket,
  index: number,
): FlightSegment[] {
  return legValues.map((leg, position) => {
    const carrier = leg.operating_carrier_designator?.carrier ?? null;
    const number = leg.operating_carrier_designator?.number ?? null;

    return {
      id: `${index}:${ticket.id ?? "ticket"}:${position}`,
      departure: {
        airport: leg.origin ?? null,
        terminal: null,
        dateTime: leg.local_departure_date_time ?? null,
        timezone: null,
      },
      arrival: {
        airport: leg.destination ?? null,
        terminal: null,
        dateTime: leg.local_arrival_date_time ?? null,
        timezone: null,
      },
      duration: durationBetween(
        leg.departure_unix_timestamp,
        leg.arrival_unix_timestamp,
      ),
      marketingAirline: { code: carrier, flightNumber: number },
      operatingAirline: { code: carrier, flightNumber: number },
      aircraft: leg.equipment
        ? {
            name: leg.equipment.name ?? null,
            code: leg.equipment.code ?? null,
          }
        : null,
      codeShare: false,
      checkinOpen: null,
    };
  });
}

function buildRoute(legValues: AviasalesFlightLeg[]): FlightRoute {
  const first = legValues[0];
  const last = legValues[legValues.length - 1];
  const stops: FlightStop[] = [];

  for (let position = 1; position < legValues.length; position += 1) {
    const arrival = legValues[position - 1];
    const departure = legValues[position];

    stops.push({
      airport: arrival.destination ?? null,
      duration: durationBetween(
        arrival.arrival_unix_timestamp,
        departure.departure_unix_timestamp,
      ),
    });
  }

  return {
    actualFrom: first.origin ?? null,
    actualTo: last.destination ?? null,
    departureDate: first.local_departure_date_time?.slice(0, 10) ?? null,
    arrivalDate: last.local_arrival_date_time?.slice(0, 10) ?? null,
    departureTimezone: null,
    arrivalTimezone: null,
    duration: durationBetween(
      first.departure_unix_timestamp,
      last.arrival_unix_timestamp,
    ),
    stops,
    carbonEmissions: null,
    selectedCarbonEmission: null,
  };
}

function buildFares(
  ticket: AviasalesTicket,
  legIndexes: number[],
  chunk: AviasalesChunk,
): FlightFare[] {
  const proposals = Array.isArray(ticket.proposals) ? ticket.proposals : [];
  const cheapestPerFamily = new Map<
    AviasalesTariffFamily,
    { proposal: AviasalesProposal; termsList: AviasalesFlightTerms[]; price: number }
  >();

  for (const proposal of proposals) {
    const price = roundMoney(proposal.price?.value);

    if (price === null) {
      continue;
    }

    const termsList = legIndexes
      .map((legIndex) => proposal.flight_terms?.[String(legIndex)])
      .filter((terms): terms is AviasalesFlightTerms => Boolean(terms));

    if (!termsList.length) {
      continue;
    }

    const family = aviasalesTariffFamily(
      termsList[0]?.trip_class,
      Math.max(...termsList.map((terms) => terms.total_baggage_count ?? 0)),
    );
    const existing = cheapestPerFamily.get(family);

    if (!existing || price < existing.price) {
      cheapestPerFamily.set(family, { proposal, termsList, price });
    }
  }

  return [...cheapestPerFamily.entries()]
    .map(([family, group]) => buildFare(ticket, family, group, chunk))
    .sort((a, b) => (a.total.amount ?? 0) - (b.total.amount ?? 0));
}

function buildFare(
  ticket: AviasalesTicket,
  family: AviasalesTariffFamily,
  group: {
    proposal: AviasalesProposal;
    termsList: AviasalesFlightTerms[];
    price: number;
  },
  chunk: AviasalesChunk,
): FlightFare {
  const { proposal, termsList, price } = group;
  const lead = termsList[0] ?? {};
  const checkedBags = Math.max(
    ...termsList.map((terms) => terms.total_baggage_count ?? 0),
  );
  const handCount = Math.max(
    ...termsList.map((terms) => terms.handbags?.count ?? 0),
  );
  const handWeight =
    termsList
      .map((terms) => terms.handbags?.weight)
      .find((weight) => typeof weight === "number") ?? null;
  const currency = proposal.price?.currency_code ?? CURRENCY_FALLBACK;
  const tripClass = lead.trip_class ?? null;

  return {
    id: `${ticket.id ?? "ticket"}:${proposal.id ?? price}`,
    family,
    total: { amount: price, currency },
    base: { amount: price, currency },
    taxes: [],
    fees: [],
    cabin: tripClass === "C" || tripClass === "J" ? "Business" : "Economy",
    bookingClass: tripClass,
    fareCode: lead.fare_code ?? null,
    available: true,
    selected: false,
    baggage: {
      status: checkedBags > 0 ? "available" : "unavailable",
      amount: checkedBags,
      // Aviasales exposes the bag COUNT but never its weight.
      weight: null,
      unit: "kg",
    },
    luggage: {
      status: handCount > 0 ? "available" : "unavailable",
      amount: handCount,
      weight: handWeight,
      unit: "kg",
    },
    changes: mapRule(lead.additional_tariff_info, "change_before_flight"),
    refund: mapRule(lead.additional_tariff_info, "return_before_flight"),
    facilities: {
      agentId: proposal.agent_id ?? null,
      agent: agentLabel(chunk, proposal.agent_id),
      itineraryKey: proposal.itinerary_key ?? null,
      isCharter: lead.is_charter ?? false,
      fromMainAirline: proposal.from_main_airline ?? false,
      tags: proposal.tags ?? [],
    },
    earnMiles: null,
    earnPoints: null,
    labels: [],
  };
}

function agentLabel(chunk: AviasalesChunk, agentId?: number): string | null {
  if (agentId === undefined || !chunk.agents) {
    return null;
  }

  const agent = chunk.agents[String(agentId)];

  return agent?.label?.az?.default ?? null;
}

function mapRule(
  info: AviasalesAdditionalTariffInfo | undefined,
  key: keyof AviasalesAdditionalTariffInfo,
): FlightFareRule | null {
  const available = info?.[key]?.available;

  if (typeof available !== "boolean") {
    return null;
  }

  return {
    status: available ? "available" : "unavailable",
    amount: null,
    currency: null,
    messages: null,
  };
}

function durationBetween(
  fromSeconds?: number,
  toSeconds?: number,
): FlightDuration | null {
  const start = finiteNumber(fromSeconds);
  const end = finiteNumber(toSeconds);

  if (start === null || end === null) {
    return null;
  }

  const totalMinutes = Math.max(0, Math.round((end - start) / 60));

  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
  };
}

function finiteNumber(value?: number): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Aviasales quotes fractional AZN (`207.22846…`) — money is 2 decimals. */
function roundMoney(value?: number): number | null {
  const raw = finiteNumber(value);

  return raw === null ? null : Math.round(raw * 100) / 100;
}
