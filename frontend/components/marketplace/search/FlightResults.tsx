import type { FlightFare, FlightOffer, FlightSegment } from "@/lib/flight-api";

interface FlightResultsProps {
  flights: FlightOffer[];
  loading?: boolean;
  error?: string | null;
}

function getAmount(fare?: FlightFare): number | null {
  const raw: any = fare as any;
  const value = raw?.price?.total ?? raw?.total;
  if (!value) return null;
  if (typeof value === "number") return value;
  return value.amount ?? value.value ?? value.total ?? null;
}

function getCurrency(fare?: FlightFare): string {
  const raw: any = fare as any;
  return raw?.price?.total?.currency ?? raw?.total?.currency ?? "AZN";
}

function getLowestFare(flight: FlightOffer): FlightFare | undefined {
  return [...(flight.fares ?? [])]
    .filter((fare) => fare.available !== false)
    .sort(
      (a, b) =>
        (getAmount(a) ?? Number.MAX_SAFE_INTEGER) -
        (getAmount(b) ?? Number.MAX_SAFE_INTEGER),
    )[0];
}

function formatTime(value?: string): string {
  if (!value) return "--:--";
  const m = value.match(/\d{2}:\d{2}/);
  return m ? m[0] : value.slice(11, 16) || "--:--";
}
function getTime(point?: any): string | undefined {
  return point?.time ?? point?.dateTime ?? point?.date ?? undefined;
}

function formatDuration(minutes?: number): string {
  if (!minutes || minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}ч ${mins}м` : `${hours}ч`;
}

function pointName(
  segment: FlightSegment | undefined,
  side: "departure" | "arrival",
): string {
  const point = segment?.[side];
  return point?.airport || point?.code || point?.city || "—";
}

export default function FlightResults({
  flights,
  loading = false,
  error = null,
}: FlightResultsProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (!flights.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-lg text-neutral-300">No flights found</p>
        <p className="mt-2 text-sm text-neutral-500">
          Try another date or route.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {flights.map((flight, index) => {
        const segments = flight.segments ?? [];
        const first = segments[0];
        const last = segments[segments.length - 1];
        const fare = getLowestFare(flight);
        const amount = getAmount(fare);

        const isRTCombined = flight.optionId?.endsWith("_RT") || (flight.requested?.tripType === "RT" && segments.length === 2);
        const isOWLeg = flight.optionId?.endsWith("_OW_OUT") || flight.optionId?.endsWith("_OW_IN");
        return (
          <article
            key={flight.optionId ?? `${flight.optionSetId ?? "azal"}-${index}`}
            className={`rounded-2xl border border-white/10 bg-white/[0.03] ${isOWLeg ? "p-3" : "p-5"}`}
          >
            <div className={`flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between ${isOWLeg ? "text-[13px]" : ""}`}>
              <div className="flex-1">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-white/10 px-3 py-1 font-medium text-white">
                    AZAL
                  </span>
                  {first?.flightNumber && (
                    <span className="text-neutral-500">{first.flightNumber}</span>
                  )}
                  {fare?.cabin && (
                    <span className="text-neutral-500">{fare.cabin}</span>
                  )}
                </div>

                {!isRTCombined && (
                  <div className="flex items-center gap-4">
                    <div className="min-w-[70px]">
                      <div className={`${isOWLeg ? "text-lg" : "text-2xl"} font-semibold text-white`}>
                        {formatTime(getTime(first?.departure))}
                      </div>
                      <div className={`${isOWLeg ? "text-xs" : "text-sm"} text-neutral-500`}>
                        {pointName(first, "departure")}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 text-center">
                      <div className="text-xs text-neutral-500">
                        {formatDuration(first?.duration?.minutes)}
                      </div>
                      <div className="my-2 h-px bg-white/15" />
                      <div className="text-xs text-neutral-500">
                        {segments.length > 1 ? `${segments.length - 1} stop(s)` : "Direct"}
                      </div>
                    </div>

                    <div className="min-w-[70px] text-right">
                      <div className={`${isOWLeg ? "text-lg" : "text-2xl"} font-semibold text-white`}>
                        {formatTime(getTime(last?.arrival))}
                      </div>
                      <div className={`${isOWLeg ? "text-xs" : "text-sm"} text-neutral-500`}>
                        {pointName(last, "arrival")}
                      </div>
                    </div>
                  </div>
                )}
                {isRTCombined && (
                  <div className="text-sm text-neutral-400">Round trip • {segments.length} flights • {formatDuration(segments.reduce((sum, s) => sum + (s.duration?.minutes ?? 0), 0))} total</div>
                )}

                {fare?.fareFamily && (
                  <div className="mt-4 text-sm text-neutral-400">
                    {fare.fareFamily}
                  </div>
                )}
              </div>

              <div className={`flex items-center justify-between gap-6 border-t border-white/10 pt-4 lg:min-w-[220px] lg:flex-col lg:items-end lg:border-t-0 lg:pt-0 ${isOWLeg ? "opacity-90" : ""}`}>
                <div className="text-right">
                  <div className={`${isOWLeg ? "text-lg" : "text-2xl"} font-bold text-white`}>
                    {amount !== null
                      ? `${amount.toLocaleString()} ${getCurrency(fare)}`
                      : "Price unavailable"}
                  </div>
                  <div className="text-xs text-neutral-500">total fare</div>
                  {(fare as any)?.facilities?.priceBreakdown && !isOWLeg && (
                    <div className="mt-1 text-[11px] leading-tight text-neutral-400">
                      <div>Outbound: {(fare as any).facilities.priceBreakdown.outbound.amount} {(fare as any).facilities.priceBreakdown.outbound.currency}</div>
                      <div>Inbound: {(fare as any).facilities.priceBreakdown.inbound.amount} {(fare as any).facilities.priceBreakdown.inbound.currency}</div>
                    </div>
                  )}
                </div>
                {!isOWLeg && (
                  <button
                    type="button"
                    className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                  >
                    Select
                  </button>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
