import { useState } from "react";
import type { FlightFare, FlightOffer, FlightSegment } from "@/lib/flight-api";

interface FlightResultsProps {
  flights: FlightOffer[];
  loading?: boolean;
  error?: string | null;
}

interface TableRow {
  out: FlightOffer;
  inn?: FlightOffer;
  fareFamily: string;
  total: number;
  currency: string;
  outFare: any;
  inFare?: any;
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

function fareFamilyOf(fare: any): string {
  return fare?.family ?? fare?.fareFamily ?? "";
}

function fareAmount(fare: any): number {
  return fare?.total?.amount ?? fare?.price?.total?.amount ?? 0;
}

function fareCurrency(fare: any): string {
  return fare?.total?.currency ?? fare?.price?.total?.currency ?? "AZN";
}

function isRowAvailable(r: TableRow): boolean {
  if (r.out?.soldOut) return false;
  if (r.inn?.soldOut) return false;
  if (r.outFare && r.outFare.available === false) return false;
  if (r.inFare && r.inFare.available === false) return false;
  return true;
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

function getDateTime(point?: any): string {
  return point?.dateTime ?? point?.date ?? "";
}

function formatDuration(minutes?: number): string {
  if (!minutes || minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}ч ${mins}м` : `${hours}ч`;
}

function flightDurationMins(flight?: FlightOffer): number {
  const route: any = (flight as any)?.route;
  if (route?.duration) {
    return (
      (route.duration.hours ?? 0) * 60 +
      (route.duration.minutes ?? 0) +
      (route.duration.days ?? 0) * 1440
    );
  }
  return (flight?.segments ?? []).reduce((sum, s) => {
    const d: any = s.duration;
    return sum + (d?.minutes ?? (d?.hours ? d.hours * 60 : 0));
  }, 0);
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
  const [familyFilter, setFamilyFilter] = useState<string>("ALL");
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

  const rtCombined = flights.find((f) => f.optionId?.endsWith("_RT"));
  const rtOutbounds = flights.filter((f) => f.optionId?.endsWith("_OW_OUT"));
  const rtInbounds = flights.filter((f) => f.optionId?.endsWith("_OW_IN"));
  const isRTTable = !!rtCombined && rtOutbounds.length > 0 && rtInbounds.length > 0;
  const hasInbound = isRTTable;

  const rows: TableRow[] = [];
  if (isRTTable) {
    for (const out of rtOutbounds) {
      for (const inn of rtInbounds) {
        const outMap = new Map((out.fares ?? []).map((f: any) => [f.family, f]));
        const inMap = new Map((inn.fares ?? []).map((f: any) => [f.family, f]));
        const families = [...new Set([...outMap.keys(), ...inMap.keys()])].filter(f => outMap.has(f) && inMap.has(f));
        if (families.length === 0) {
          const oF = [...(out.fares ?? [])].sort((a: any,b: any)=> (a.total?.amount??999999)-(b.total?.amount??999999))[0];
          const iF = [...(inn.fares ?? [])].sort((a: any,b: any)=> (a.total?.amount??999999)-(b.total?.amount??999999))[0];
          if (oF && iF) rows.push({ out, inn, fareFamily: fareFamilyOf(oF), total: fareAmount(oF) + fareAmount(iF), currency: fareCurrency(oF), outFare: oF, inFare: iF });
        } else {
          for (const fam of families) {
            const oF = outMap.get(fam)!; const iF = inMap.get(fam)!;
            const total = fareAmount(oF) + fareAmount(iF);
            rows.push({ out, inn, fareFamily: fam, total, currency: fareCurrency(oF), outFare: oF, inFare: iF });
          }
        }
      }
    }
  } else {
    for (const flight of flights) {
      if (flight.optionId?.endsWith("_RT")) continue;
      const available = flight.fares ?? [];
      if (!available.length) continue;
      for (const f of available) {
        rows.push({ out: flight, fareFamily: fareFamilyOf(f), total: fareAmount(f), currency: fareCurrency(f), outFare: f });
      }
    }
  }

  if (rows.length) {
    const familyMinPrice = new Map<string, number>();
    for (const r of rows) {
      if (!r.fareFamily) continue;
      const cur = familyMinPrice.get(r.fareFamily);
      if (cur === undefined || r.total < cur) familyMinPrice.set(r.fareFamily, r.total);
    }
    const families = [...familyMinPrice.keys()].sort((a, b) => (familyMinPrice.get(a) ?? 0) - (familyMinPrice.get(b) ?? 0));
    const filterActive = familyFilter !== "ALL" && familyMinPrice.has(familyFilter);
    const visibleRows = filterActive ? rows.filter((r) => r.fareFamily === familyFilter) : rows;
    const sortedRows = [...visibleRows].sort((a, b) => {
      if (!sortCol) {
        const at = ((a.out.segments?.[0]?.departure as any)?.dateTime ?? 0) as string | number;
        const bt = ((b.out.segments?.[0]?.departure as any)?.dateTime ?? 0) as string | number;
        return new Date(at).getTime() - new Date(bt).getTime();
      }
      let av: any, bv: any;
      if (sortCol === "code") { av = `${a.out.segments?.[0]?.departure?.airport}-${a.out.segments?.[0]?.arrival?.airport}`; bv = `${b.out.segments?.[0]?.departure?.airport}-${b.out.segments?.[0]?.arrival?.airport}`; }
      else if (sortCol === "time") { av = getTime(a.out.segments?.[0]?.departure) ?? ""; bv = getTime(b.out.segments?.[0]?.departure) ?? ""; }
      else if (sortCol === "inTime") { av = getTime(a.inn?.segments?.[0]?.departure) ?? ""; bv = getTime(b.inn?.segments?.[0]?.departure) ?? ""; }
      else if (sortCol === "price") { av = a.total; bv = b.total; }
      else if (sortCol === "outPrice") { av = fareAmount(a.outFare) || 999999; bv = fareAmount(b.outFare) || 999999; }
      else if (sortCol === "inPrice") { av = a.inFare ? fareAmount(a.inFare) || 999999 : 999999; bv = b.inFare ? fareAmount(b.inFare) || 999999 : 999999; }
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
    const arrow = (col: string) => (sortCol === col ? (sortDir === "asc" ? "▲" : "▼") : "↕");
    return (
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-white/5 text-neutral-400">
            <tr>
              <th className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => toggleSort("code")}>Код {arrow("code")}</th>
              <th className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => toggleSort("time")}>Время вылета {arrow("time")}</th>
              <th className="px-2 py-2">Время прилета</th>
              <th className="px-2 py-2">Время в полете</th>
              {hasInbound && <th className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => toggleSort("outPrice")}>Цена за туда {arrow("outPrice")}</th>}
              {hasInbound && <th className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => toggleSort("code")}>Код {arrow("code")}</th>}
              {hasInbound && <th className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => toggleSort("inTime")}>Время вылета {arrow("inTime")}</th>}
              {hasInbound && <th className="px-2 py-2">Время прилета</th>}
              {hasInbound && <th className="px-2 py-2">Время в полете</th>}
              {hasInbound && <th className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => toggleSort("inPrice")}>Цена за обратно {arrow("inPrice")}</th>}
              {hasInbound && <th className="px-2 py-2">Общее время полета</th>}
              <th className="px-2 py-2">
                <div className="flex items-center gap-1">
                  <span>Тариф+багаж</span>
                  <select
                    value={filterActive ? familyFilter : "ALL"}
                    onChange={(e) => setFamilyFilter(e.target.value)}
                    className="rounded bg-white/10 px-1 py-0.5 text-[11px] text-white outline-none cursor-pointer hover:bg-white/20"
                  >
                    <option value="ALL">Все</option>
                    {families.map((fam) => (
                      <option key={fam} value={fam}>{fam}</option>
                    ))}
                  </select>
                </div>
              </th>
              <th className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => toggleSort("adults")}>Взрослые {arrow("adults")}</th>
              <th className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => toggleSort("children")}>Дети {arrow("children")}</th>
              <th className="px-2 py-2 cursor-pointer hover:text-white" onClick={() => toggleSort("price")}>{hasInbound ? "Общая цена" : "Цена"} {arrow("price")}</th>
              <th className="px-2 py-2">Места</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {displayRows.map((r, idx) => {
              const outSeg = r.out.segments?.[0]; const inSeg = r.inn?.segments?.[0];
              const outMins = flightDurationMins(r.out);
              const inMins = r.inn ? flightDurationMins(r.inn) : 0;
              const totalMins = outMins + inMins;
              const baggageLabel = r.outFare?.baggage?.status === "available" ? `Bag ${r.outFare.baggage.amount}×${r.outFare.baggage.weight}kg` : r.outFare?.baggage?.status === "unavailable" ? "No bag" : "";
              const handLabel = r.outFare?.luggage?.status === "available" ? `+ Hand ${r.outFare.luggage.weight}kg` : "";
              const seatsAvailable = isRowAvailable(r);
              return (
                <tr key={`${r.out.optionId}-${r.inn?.optionId ?? "ow"}-${r.fareFamily}-${idx}`} className={`hover:bg-white/5 ${seatsAvailable ? "" : "opacity-60"}`}>
                  <td className="px-2 py-2 text-white">{outSeg?.departure?.airport ?? ""}-{outSeg?.arrival?.airport ?? ""}</td>
                  <td className="px-2 py-2 text-white">{formatTime(getTime(outSeg?.departure))}</td>
                  <td className="px-2 py-2 text-white">{formatTime(getTime(outSeg?.arrival))}</td>
                  <td className="px-2 py-2 text-neutral-300">{formatDuration(outMins)}</td>
                  {hasInbound && <td className="px-2 py-2 text-white">{fareAmount(r.outFare)} {fareCurrency(r.outFare)}</td>}
                  {hasInbound && <td className="px-2 py-2 text-white">{inSeg?.departure?.airport ?? ""}-{inSeg?.arrival?.airport ?? ""}</td>}
                  {hasInbound && <td className="px-2 py-2 text-white">{formatTime(getTime(inSeg?.departure))}</td>}
                  {hasInbound && <td className="px-2 py-2 text-white">{formatTime(getTime(inSeg?.arrival))}</td>}
                  {hasInbound && <td className="px-2 py-2 text-neutral-300">{formatDuration(inMins)}</td>}
                  {hasInbound && <td className="px-2 py-2 text-white">{r.inFare ? `${fareAmount(r.inFare)} ${fareCurrency(r.inFare)}` : ""}</td>}
                  {hasInbound && <td className="px-2 py-2 text-neutral-300">{formatDuration(totalMins)}</td>}
                  <td className="px-2 py-2 text-white">{r.fareFamily} {baggageLabel} {handLabel}</td>
                  <td className="px-2 py-2 text-white text-center">{r.out.requested?.passengers?.adults ?? 1}</td>
                  <td className="px-2 py-2 text-white text-center">{r.out.requested?.passengers?.children ?? 0}</td>
                  <td className="px-2 py-2 font-bold text-white">{r.total} {r.currency}</td>
                  <td className="px-2 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${seatsAvailable ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                      {seatsAvailable ? "Есть места" : "Нет мест"}
                    </span>
                  </td>
                  <td className="px-2 py-2"><button type="button" disabled={!seatsAvailable} onClick={async () => { try { const { createFlightRequest } = await import("@/lib/flight-api"); await createFlightRequest({ from: outSeg?.departure?.airport ?? "", to: outSeg?.arrival?.airport ?? "", departureDate: getDateTime(outSeg?.departure) || r.out.requested?.departureDate || "", returnDate: r.inn ? (getDateTime(r.inn.segments?.[0]?.departure) || r.inn.requested?.departureDate || undefined) : undefined, tripType: r.inn ? "RT" : "OW", passengers: r.out.requested?.passengers ?? { adults: 1, children: 0, infants: 0 }, fareFamily: r.fareFamily, price: r.total, currency: r.currency, segments: [...(r.out.segments ?? []), ...(r.inn?.segments ?? [])] }); alert(`Заявка создана: ${r.fareFamily} ${r.total} ${r.currency}`); } catch (e) { alert(`Ошибка: ${(e as Error).message}`); } }} className={`rounded-lg px-3 py-1 text-xs font-semibold ${seatsAvailable ? "bg-white text-black hover:opacity-90" : "cursor-not-allowed bg-white/20 text-white/50"}`}>Подать заявку</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visibleRows.length > displayRows.length && <div className="px-3 py-2 text-center text-xs text-neutral-500">Показано {displayRows.length} из {visibleRows.length} вариантов</div>}
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
        const routeMins = flightDurationMins(flight);

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
                        {formatDuration(routeMins)}
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
                    {formatDuration(routeMins)}{" "}
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
                        <button type="button" onClick={async () => { try { const { createFlightRequest } = await import("@/lib/flight-api"); await createFlightRequest({ from: first?.departure?.airport ?? "", to: last?.arrival?.airport ?? "", departureDate: getDateTime(first?.departure) || flight.requested?.departureDate || "", returnDate: segments[1] ? (getDateTime(segments[1]?.departure) || flight.requested?.returnDate || undefined) : undefined, tripType: segments[1] ? "RT" : "OW", passengers: flight.requested?.passengers ?? { adults: 1, children: 0, infants: 0 }, fareFamily: fareFamilyOf(f), price: fareAmount(f), currency: fareCurrency(f), segments }); alert(`Заявка создана: ${fareFamilyOf(f)} ${fareAmount(f)} ${fareCurrency(f)}`); } catch (e) { alert(`Ошибка: ${(e as Error).message}`); } }} className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-black hover:opacity-90">Подать заявку</button>
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
