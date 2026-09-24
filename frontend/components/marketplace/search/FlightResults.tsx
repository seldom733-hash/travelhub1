import { useState } from "react";
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
function getTimezone(point?: any): string | undefined {
  return point?.timezone ?? point?.terminal ?? undefined;
}

export default function FlightResults({
  flights,
  loading = false,
  error = null,
}: FlightResultsProps) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
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

  // RT table: if we have combined + outbound + inbound, show table of all tariff combinations
  const rtCombined = flights.find((f) => f.optionId?.endsWith("_RT"));
  const rtOutbounds = flights.filter((f) => f.optionId?.endsWith("_OW_OUT"));
  const rtInbounds = flights.filter((f) => f.optionId?.endsWith("_OW_IN"));
  const isRTTable = !!rtCombined && rtOutbounds.length > 0 && rtInbounds.length > 0;
  if (isRTTable) {
    const outFlights = rtOutbounds;
    const inFlights = rtInbounds;
    const rows: Array<{ out: typeof outFlights[0]; inn: typeof inFlights[0]; fareFamily: string; total: number; currency: string; outFare: any; inFare: any }> = [];
    for (const out of outFlights) {
      for (const inn of inFlights) {
        const outMap = new Map((out.fares ?? []).filter((f: any) => f.available !== false).map((f: any) => [f.family, f]));
        const inMap = new Map((inn.fares ?? []).filter((f: any) => f.available !== false).map((f: any) => [f.family, f]));
        const families = [...new Set([...outMap.keys(), ...inMap.keys()])].filter(f => outMap.has(f) && inMap.has(f));
        if (families.length === 0) {
          const oF = [...(out.fares ?? [])].filter((f: any) => f.available !== false).sort((a: any,b: any)=> (a.total?.amount??999999)-(b.total?.amount??999999))[0];
          const iF = [...(inn.fares ?? [])].filter((f: any) => f.available !== false).sort((a: any,b: any)=> (a.total?.amount??999999)-(b.total?.amount??999999))[0];
          if (oF && iF) rows.push({ out, inn, fareFamily: oF.family, total: (oF.total?.amount??0)+(iF.total?.amount??0), currency: oF.total?.currency ?? "AZN", outFare: oF, inFare: iF });
        } else {
          for (const fam of families) {
            const oF = outMap.get(fam)!; const iF = inMap.get(fam)!;
            const total = (oF.total?.amount ?? 0) + (iF.total?.amount ?? 0);
            rows.push({ out, inn, fareFamily: fam, total, currency: oF.total?.currency ?? "AZN", outFare: oF, inFare: iF });
          }
        }
      }
    }
    // Sorting
    const sortedRows = [...rows].sort((a,b) => {
      if (!sortCol) return new Date(a.out.segments?.[0]?.departure?.dateTime ?? 0).getTime() - new Date(b.out.segments?.[0]?.departure?.dateTime ?? 0).getTime();
      let av: any, bv: any;
      if (sortCol === "code") { av = `${a.out.segments?.[0]?.departure?.airport}-${a.out.segments?.[0]?.arrival?.airport}`; bv = `${b.out.segments?.[0]?.departure?.airport}-${b.out.segments?.[0]?.arrival?.airport}`; }
      else if (sortCol === "time") { av = getTime(a.out.segments?.[0]?.departure) ?? ""; bv = getTime(b.out.segments?.[0]?.departure) ?? ""; }
      else if (sortCol === "inTime") { av = getTime(a.inn.segments?.[0]?.departure) ?? ""; bv = getTime(b.inn.segments?.[0]?.departure) ?? ""; }
      else if (sortCol === "price") { av = a.total; bv = b.total; }
      else if (sortCol === "outPrice") { av = a.outFare?.total?.amount ?? 999999; bv = b.outFare?.total?.amount ?? 999999; }
      else if (sortCol === "inPrice") { av = a.inFare?.total?.amount ?? 999999; bv = b.inFare?.total?.amount ?? 999999; }
      else if (sortCol === "adults") { av = a.out.requested?.passengers?.adults ?? 0; bv = b.out.requested?.passengers?.adults ?? 0; }
      else if (sortCol === "children") { av = a.out.requested?.passengers?.children ?? 0; bv = b.out.requested?.passengers?.children ?? 0; }
      else return 0;
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    const displayRows = sortedRows.slice(0, 50);
    const toggleSort = (col: string) => {
      if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
      else { setSortCol(col); setSortDir("asc"); }
    };
    return (
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-white/5 text-neutral-400">
            <tr>
              <th className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => toggleSort("code")}>Код {sortCol==="code" ? (sortDir==="asc"?"▲":"▼") : "↕"}</th>
              <th className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => toggleSort("time")}>Время вылета {sortCol==="time" ? (sortDir==="asc"?"▲":"▼") : "↕"}</th>
              <th className="px-2 py-2">Время прилета</th>
              <th className="px-2 py-2">Время в полете</th>
              <th className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => toggleSort("outPrice")}>Цена за туда {sortCol==="outPrice" ? (sortDir==="asc"?"▲":"▼") : "↕"}</th>
              <th className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => toggleSort("code")}>Код {sortCol==="code" ? (sortDir==="asc"?"▲":"▼") : "↕"}</th>
              <th className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => toggleSort("inTime")}>Время вылета {sortCol==="inTime" ? (sortDir==="asc"?"▲":"▼") : "↕"}</th>
              <th className="px-2 py-2">Время прилета</th>
              <th className="px-2 py-2">Время в полете</th>
              <th className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => toggleSort("inPrice")}>Цена за обратно {sortCol==="inPrice" ? (sortDir==="asc"?"▲":"▼") : "↕"}</th>
              <th className="px-2 py-2">Общее время полета</th>
              <th className="px-2 py-2">Тариф+багаж</th>
              <th className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => toggleSort("adults")}>Взрослые {sortCol==="adults" ? (sortDir==="asc"?"▲":"▼") : "↕"}</th>
              <th className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => toggleSort("children")}>Дети {sortCol==="children" ? (sortDir==="asc"?"▲":"▼") : "↕"}</th>
              <th className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => toggleSort("price")}>Общая цена {sortCol==="price" ? (sortDir==="asc"?"▲":"▼") : "↕"}</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {displayRows.map((r, idx) => {
              const outSeg = r.out.segments?.[0]; const inSeg = r.inn.segments?.[0];
              const outMins = r.out.route?.duration ? r.out.route.duration.hours*60 + r.out.route.duration.minutes + (r.out.route.duration.days??0)*1440 : r.out.segments?.reduce((s, seg:any)=>s+(seg.duration?.minutes??0),0) ?? 0;
              const inMins = r.inn.route?.duration ? r.inn.route.duration.hours*60 + r.inn.route.duration.minutes + (r.inn.route.duration.days??0)*1440 : r.inn.segments?.reduce((s, seg:any)=>s+(seg.duration?.minutes??0),0) ?? 0;
              const totalMins = outMins + inMins;
              const baggageLabel = r.outFare.baggage?.status === "available" ? `Bag ${r.outFare.baggage.amount}×${r.outFare.baggage.weight}kg` : r.outFare.baggage?.status === "unavailable" ? "No bag" : "";
              const handLabel = r.outFare.luggage?.status === "available" ? `+ Hand ${r.outFare.luggage.weight}kg` : "";
              return (
                <tr key={`${r.out.optionId}-${r.inn.optionId}-${r.fareFamily}-${idx}`} className="hover:bg-white/5">
                  <td className="px-2 py-2 text-white">{outSeg?.departure?.airport ?? ""}-{outSeg?.arrival?.airport ?? ""}</td>
                  <td className="px-2 py-2 text-white">{formatTime(getTime(outSeg?.departure))}</td>
                  <td className="px-2 py-2 text-white">{formatTime(getTime(outSeg?.arrival))}</td>
                  <td className="px-2 py-2 text-neutral-300">{formatDuration(outMins)}</td>
                  <td className="px-2 py-2 text-white">{r.outFare.total.amount} {r.outFare.total.currency}</td>
                  <td className="px-2 py-2 text-white">{inSeg?.departure?.airport ?? ""}-{inSeg?.arrival?.airport ?? ""}</td>
                  <td className="px-2 py-2 text-white">{formatTime(getTime(inSeg?.departure))}</td>
                  <td className="px-2 py-2 text-white">{formatTime(getTime(inSeg?.arrival))}</td>
                  <td className="px-2 py-2 text-neutral-300">{formatDuration(inMins)}</td>
                  <td className="px-2 py-2 text-white">{r.inFare.total.amount} {r.inFare.total.currency}</td>
                  <td className="px-2 py-2 text-neutral-300">{formatDuration(totalMins)}</td>
                  <td className="px-2 py-2 text-white">{r.fareFamily} {baggageLabel} {handLabel}</td>
                  <td className="px-2 py-2 text-white text-center">{r.out.requested?.passengers?.adults ?? 1}</td>
                  <td className="px-2 py-2 text-white text-center">{r.out.requested?.passengers?.children ?? 0}</td>
                  <td className="px-2 py-2 font-bold text-white">{r.total} {r.currency}</td>
                  <td className="px-2 py-2"><button type="button" onClick={async () => { try { const { createFlightRequest } = await import("@/lib/flight-api"); await createFlightRequest({ from: r.out.segments?.[0]?.departure?.airport ?? "", to: r.out.segments?.[0]?.arrival?.airport ?? "", departureDate: r.out.segments?.[0]?.departure?.dateTime ?? "", returnDate: r.inn.segments?.[0]?.departure?.dateTime, tripType: "RT", passengers: r.out.requested?.passengers ?? { adults: 1, children: 0, infants: 0 }, fareFamily: r.fareFamily, price: r.total, currency: r.currency, segments: [...(r.out.segments ?? []), ...(r.inn.segments ?? [])] }); alert(`Заявка создана: ${r.fareFamily} ${r.total} ${r.currency}`); } catch (e) { alert(`Ошибка: ${(e as Error).message}`); } }} className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-black hover:opacity-90">Подать заявку</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length > 30 && <div className="px-3 py-2 text-center text-xs text-neutral-500">Показано 30 из {rows.length} комбинаций</div>}
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
                        {pointName(first, "departure")} {getTimezone(first?.departure) ? `(${getTimezone(first?.departure)?.split("/").pop()})` : ""}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 text-center">
                      <div className="text-xs text-neutral-500">
                        {formatDuration(
                          flight.route?.duration
                            ? flight.route.duration.hours * 60 + flight.route.duration.minutes + (flight.route.duration.days ?? 0) * 1440
                            : segments.reduce((sum, s) => sum + (s.duration?.minutes ?? (s.duration?.hours ? s.duration.hours * 60 : 0)), 0) || first?.duration?.minutes
                        )}
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
                        {pointName(last, "arrival")} {getTimezone(last?.arrival) ? `(${getTimezone(last?.arrival)?.split("/").pop()})` : ""}
                      </div>
                    </div>
                  </div>
                )}
                {isRTCombined && (
                  <div className="text-sm text-neutral-400">
                    Round trip • {segments.length} flights •{" "}
                    {formatDuration(
                      flight.route?.duration
                        ? flight.route.duration.hours * 60 + flight.route.duration.minutes + (flight.route.duration.days ?? 0) * 1440
                        : segments.reduce((sum, s) => sum + (s.duration?.minutes ?? 0), 0)
                    )}{" "}
                    total
                  </div>
                )}

                {fare?.fareFamily && (
                  <div className="mt-4 text-sm text-neutral-400">
                    {fare.fareFamily}
                  </div>
                )}
              </div>

              <div className={`flex flex-col gap-2 border-t border-white/10 pt-4 lg:min-w-[260px] lg:border-t-0 lg:pt-0 ${isOWLeg ? "opacity-90" : ""}`}>
                <div className="text-right">
                  <div className={`${isOWLeg ? "text-lg" : "text-2xl"} font-bold text-white`}>
                    {(() => {
                      const fares = flight.fares ?? [];
                      const amounts = fares.map((f: any) => f.total?.amount ?? f.price?.total?.amount).filter((v: any) => typeof v === "number") as number[];
                      const min = amounts.length ? Math.min(...amounts) : amount;
                      const max = amounts.length ? Math.max(...amounts) : amount;
                      const cur = getCurrency(fare as any);
                      if (min == null || max == null) return "Price unavailable";
                      return min === max ? `${(min as number).toLocaleString()} ${cur}` : `${(min as number).toLocaleString()} - ${(max as number).toLocaleString()} ${cur}`;
                    })()}
                  </div>
                  <div className="text-xs text-neutral-500">total fare {flight.fares?.length ? `• ${flight.fares.length} tariffs` : ""}</div>
                  {(fare as any)?.facilities?.priceBreakdown && !isOWLeg && (
                    <div className="mt-1 text-[11px] leading-tight text-neutral-400">
                      <div>Outbound: {(fare as any).facilities.priceBreakdown.outbound.amount} {(fare as any).facilities.priceBreakdown.outbound.currency}</div>
                      <div>Inbound: {(fare as any).facilities.priceBreakdown.inbound.amount} {(fare as any).facilities.priceBreakdown.inbound.currency}</div>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  {[...(flight.fares ?? [])].sort((a: any, b: any) => (a.total?.amount ?? a.price?.total?.amount ?? 999999) - (b.total?.amount ?? b.price?.total?.amount ?? 999999)).map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-1.5 text-xs">
                      <span className="font-medium text-white">{f.family} • {f.cabin}</span>
                      <span className="text-neutral-300">{f.total?.amount ?? f.price?.total?.amount ?? 0} {f.total?.currency ?? f.price?.total?.currency ?? "AZN"}</span>
                      <span className="text-neutral-400">
                        {f.baggage?.status === "available" ? `Bag ${f.baggage.amount}×${f.baggage.weight}kg` : f.baggage?.status === "unavailable" ? "No bag" : ""}
                        {f.luggage?.status === "available" ? ` + Hand ${f.luggage.weight}kg` : ""}
                      </span>
                      {isRTCombined && (
                        <button type="button" onClick={() => alert(`Заявка создана: ${r.fareFamily} ${r.total} ${r.currency} — ${r.out.segments?.[0]?.departure?.airport}-${r.out.segments?.[0]?.arrival?.airport} ${formatTime(getTime(r.out.segments?.[0]?.departure))} → ${r.inn.segments?.[0]?.departure?.airport}-${r.inn.segments?.[0]?.arrival?.airport} ${formatTime(getTime(r.inn.segments?.[0]?.departure))}`)} className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-black hover:opacity-90">Подать заявку</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
