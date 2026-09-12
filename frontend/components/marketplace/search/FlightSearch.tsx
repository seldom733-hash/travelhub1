"use client";

import { useState, useMemo } from "react";
import { MapPin, CalendarBlank, ArrowRight, Airplane } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import type { SearchContext } from "@/lib/search-engine";
import LiveSearchInput from "./LiveSearchInput";
import ChildAges from "./ChildAges";
import HelpFindButton from "./HelpFindButton";

interface FlightSearchProps {
  onSearch: (ctx: SearchContext) => void;
}

export default function FlightSearch({ onSearch }: FlightSearchProps) {
  const locale = useLocale();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [roundTrip, setRoundTrip] = useState(false);
  const [returnDate, setReturnDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState<number[]>([]);
  const [infants, setInfants] = useState(0);
  const [serviceClass, setServiceClass] = useState("economy");
  const [baggage, setBaggage] = useState(false);

  // Disable return dates before departure date
  const minReturnDate = useMemo(() => {
    if (!departureDate) return "";
    const d = new Date(departureDate);
    return d.toISOString().split("T")[0];
  }, [departureDate]);

  // Clear return date if it becomes invalid
  const handleDepartureChange = (date: string) => {
    setDepartureDate(date);
    if (returnDate && date && returnDate < date) {
      setReturnDate("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      serviceType: "flights",
      fromDestination: from,
      toDestination: to,
      departureDate,
      returnDate: roundTrip ? returnDate : undefined,
      roundTrip,
      adults,
      children,
      childAges: childAges.slice(0, children),
      infants,
      serviceClass,
      baggage,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* From */}
        <LiveSearchInput
          id="flight-from"
          label={t("search.from", locale)}
          placeholder="Город вылета"
          icon={<MapPin size={14} weight="light" />}
          onSelect={(r) => setFrom(r.name)}
          onClear={() => setFrom("")}
          filterType="destination"
        />

        {/* To */}
        <LiveSearchInput
          id="flight-to"
          label={t("search.to", locale)}
          placeholder="Город прилёта"
          icon={<MapPin size={14} weight="light" />}
          onSelect={(r) => setTo(r.name)}
          onClear={() => setTo("")}
          filterType="destination"
        />

        {/* Departure date */}
        <div>
          <label htmlFor="flight-departure" className="mb-0.5 block text-[11px] font-medium text-neutral-400">
            {t("search.departure_date", locale)}
          </label>
          <div className="relative">
            <CalendarBlank size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              id="flight-departure"
              type="date"
              value={departureDate}
              onChange={(e) => handleDepartureChange(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full rounded-xl border border-dark-border bg-dark-card py-2 pl-9 pr-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50"
            />
          </div>
        </div>

        {/* Return date (conditional) */}
        {roundTrip && (
          <div>
            <label htmlFor="flight-return" className="mb-0.5 block text-[11px] font-medium text-neutral-400">
              {t("search.return_date", locale)}
            </label>
            <div className="relative">
              <CalendarBlank size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                id="flight-return"
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                min={minReturnDate || new Date().toISOString().split("T")[0]}
                disabled={!departureDate}
                className="w-full rounded-xl border border-dark-border bg-dark-card py-2 pl-9 pr-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50 disabled:opacity-50"
              />
            </div>
          </div>
        )}
      </div>

      {/* Round-trip checkbox */}
      <label className="flex cursor-pointer items-center gap-2 self-start rounded-xl border border-dark-border bg-dark-card px-4 py-2 text-[13px] text-neutral-300 transition-colors hover:border-gold/30 hover:text-white">
        <input
          type="checkbox"
          checked={roundTrip}
          onChange={(e) => {
            setRoundTrip(e.target.checked);
            if (!e.target.checked) setReturnDate("");
          }}
          className="size-3.5 rounded border-dark-border accent-gold"
        />
        {t("search.round_trip", locale)}
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Adults */}
        <div>
          <label htmlFor="flight-adults" className="mb-0.5 block text-[11px] font-medium text-neutral-400">
            {t("search.adults", locale)}
          </label>
          <select
            id="flight-adults"
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className="w-full rounded-xl border border-dark-border bg-dark-card py-2 px-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Children */}
        <div>
          <label htmlFor="flight-children" className="mb-0.5 block text-[11px] font-medium text-neutral-400">
            {t("search.children", locale)}
          </label>
          <select
            id="flight-children"
            value={children}
            onChange={(e) => {
              const val = Number(e.target.value);
              setChildren(val);
              setChildAges(Array(val).fill(0));
            }}
            className="w-full rounded-xl border border-dark-border bg-dark-card py-2 px-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50"
          >
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Infants */}
        <div>
          <label htmlFor="flight-infants" className="mb-0.5 block text-[11px] font-medium text-neutral-400">
            {t("search.infants", locale)}
          </label>
          <select
            id="flight-infants"
            value={infants}
            onChange={(e) => setInfants(Number(e.target.value))}
            className="w-full rounded-xl border border-dark-border bg-dark-card py-2 px-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50"
          >
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Service class */}
        <div>
          <label htmlFor="flight-class" className="mb-0.5 block text-[11px] font-medium text-neutral-400">
            {t("search.service_class", locale)}
          </label>
          <select
            id="flight-class"
            value={serviceClass}
            onChange={(e) => setServiceClass(e.target.value)}
            className="w-full rounded-xl border border-dark-border bg-dark-card py-2 px-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50"
          >
            <option value="economy">{t("search.class_economy", locale)}</option>
            <option value="business">{t("search.class_business", locale)}</option>
            <option value="first">{t("search.class_first", locale)}</option>
          </select>
        </div>
      </div>

      {/* Child ages */}
      {children > 0 && (
        <ChildAges count={children} ages={childAges} onChange={setChildAges} />
      )}

      {/* Baggage checkbox */}
      <label className="flex cursor-pointer items-center gap-2 self-start rounded-xl border border-dark-border bg-dark-card px-4 py-2 text-[13px] text-neutral-300 transition-colors hover:border-gold/30 hover:text-white">
        <input
          type="checkbox"
          checked={baggage}
          onChange={(e) => setBaggage(e.target.checked)}
          className="size-3.5 rounded border-dark-border accent-gold"
        />
        {t("search.baggage", locale)}
      </label>

      {/* Help Find */}
      <HelpFindButton
        context={{
          serviceType: "flights",
          fromDestination: from,
          toDestination: to,
          departureDate,
          returnDate: roundTrip ? returnDate : undefined,
          roundTrip,
          adults,
          children,
          childAges: childAges.slice(0, children),
          infants,
          serviceClass,
          baggage,
        }}
      />

      {/* Submit */}
      <button
        type="submit"
        className="btn-gold flex w-full items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-semibold"
      >
        <span>{t("marketplace.search_submit", locale)}</span>
        <ArrowRight size={16} weight="bold" />
      </button>
    </form>
  );
}
