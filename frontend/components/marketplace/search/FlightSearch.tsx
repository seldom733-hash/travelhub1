"use client";

import { useState, useMemo, useEffect } from "react";
import { MapPin, ArrowRight, Airplane } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import type { SearchContext } from "@/lib/search-engine";
import FlightAirportSelect from "./FlightAirportSelect";
import FlightDatePicker from "./FlightDatePicker";
import { fetchAzalDirectory, fetchFlightCalendar, type FlightCalendarDayPrice } from "@/lib/flight-api";
import { setRemoteAirports } from "@/lib/flight-locations";
import ChildAges from "./ChildAges";
import HelpFindButton from "./HelpFindButton";

interface FlightSearchProps {
  onSearch: (ctx: SearchContext) => void;
}

export default function FlightSearch({ onSearch }: FlightSearchProps) {
  const locale = useLocale();
  const [from, setFrom] = useState<import("@/lib/flight-locations").FlightAirport | null>(null);
  const [to, setTo] = useState<import("@/lib/flight-locations").FlightAirport | null>(null);
  const [departureDate, setDepartureDate] = useState("");
  const [roundTrip, setRoundTrip] = useState(false);
  const [returnDate, setReturnDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState<number[]>([]);
  const [infants, setInfants] = useState(0);
  const [serviceClass, setServiceClass] = useState("economy");
  const [tariff, setTariff] = useState("ALL");
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const t = sp.get("tariff");
      if (t) setTariff(t);
    } catch {}
  }, []);

  // Load the live AZAL directory once: new AZAL destinations then appear
  // in the From/To filters automatically (merged after the bundled list).
  useEffect(() => {
    let alive = true;
    fetchAzalDirectory()
      .then((entries) => {
        if (alive) {
          setRemoteAirports(entries);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Disable return dates before departure date
  const minReturnDate = useMemo(() => {
    if (!departureDate) return "";
    const d = new Date(departureDate);
    return d.toISOString().split("T")[0];
  }, [departureDate]);

  // Flight-date availability for the selected direction, fetched with a
  // SINGLE backend calendar request (never per-day). Presence of a date
  // in the map means AZAL has flights that day.
  const [availability, setAvailability] = useState<Record<string, FlightCalendarDayPrice> | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [returnAvailability, setReturnAvailability] = useState<Record<string, FlightCalendarDayPrice> | null>(null);

  useEffect(() => {
    if (!from?.code || !to?.code) {
      setAvailability(null);
      return;
    }
    let alive = true;
    setAvailabilityLoading(true);
    fetchFlightCalendar(from.code, to.code)
      .then((data) => {
        if (alive) {
          setAvailability(data);
        }
      })
      .catch(() => {
        if (alive) {
          setAvailability(null);
        }
      })
      .finally(() => {
        if (alive) {
          setAvailabilityLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [from?.code, to?.code]);

  // Return-leg availability uses the reverse direction.
  useEffect(() => {
    if (!roundTrip || !from?.code || !to?.code) {
      setReturnAvailability(null);
      return;
    }
    let alive = true;
    fetchFlightCalendar(to.code, from.code)
      .then((data) => {
        if (alive) {
          setReturnAvailability(data);
        }
      })
      .catch(() => {
        if (alive) {
          setReturnAvailability(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [roundTrip, from?.code, to?.code]);

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
      fromDestination: from?.city ?? "",
      toDestination: to?.city ?? "",
      departureDate,
      returnDate: roundTrip ? returnDate : undefined,
      roundTrip,
      adults,
      children,
      childAges: childAges.slice(0, children),
      infants,
      serviceClass,
      tariff,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* From */}
        <FlightAirportSelect
          id="flight-from"
          label={t("search.from", locale)}
          placeholder="Выберите город вылета"
          value={from}
          onChange={setFrom}
        />

        {/* To */}
        <FlightAirportSelect
          id="flight-to"
          label={t("search.to", locale)}
          placeholder="Выберите город прилёта"
          value={to}
          onChange={setTo}
        />

        {/* Departure date */}
        <FlightDatePicker
          id="flight-departure"
          label={t("search.departure_date", locale)}
          placeholder="Выберите дату"
          value={departureDate}
          onChange={handleDepartureChange}
          availability={availability}
          loadingAvailability={availabilityLoading}
        />

        {/* Return date (conditional) */}
        {roundTrip && (
          <FlightDatePicker
            id="flight-return"
            label={t("search.return_date", locale)}
            placeholder="Выберите дату"
            value={returnDate}
            onChange={setReturnDate}
            minDate={minReturnDate || undefined}
            availability={returnAvailability}
            disabled={!departureDate}
          />
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

      {/* Tariff (baggage) */}
      <div>
        <label htmlFor="flight-tariff" className="mb-0.5 block text-[11px] font-medium text-neutral-400">
          Тариф (багаж)
        </label>
        <select
          id="flight-tariff"
          value={tariff}
          onChange={(e) => setTariff(e.target.value)}
          className="w-full rounded-xl border border-dark-border bg-dark-card py-2 px-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50"
        >
          <option value="ALL">Все</option>
          <option value="BUDGET">BUDGET — No bag + Hand 10kg</option>
          <option value="CLASSIC">CLASSIC — Bag 1×23kg + Hand 10kg</option>
          <option value="PLUS">PLUS — Bag 1×32kg + Hand 10kg</option>
          <option value="COMFORT">COMFORT — Bag 2×32kg + Hand 10kg</option>
          <option value="BUSINESS">BUSINESS — Bag 2×32kg + Hand 10kg</option>
        </select>
      </div>

      {/* Help Find */}
      <HelpFindButton
        context={{
          serviceType: "flights",
          fromDestination: from?.city ?? "",
          toDestination: to?.city ?? "",
          departureDate,
          returnDate: roundTrip ? returnDate : undefined,
          roundTrip,
          adults,
          children,
          childAges: childAges.slice(0, children),
          infants,
          serviceClass,
          tariff,
        }}
      />

      {/* Submit */}
      <button
        type="submit"
        disabled={!from || !to || !departureDate}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-semibold transition-opacity ${!from || !to || !departureDate ? "bg-neutral-700 text-neutral-400 cursor-not-allowed opacity-60" : "btn-gold"}`}
      >
        <span>{t("marketplace.search_submit", locale)}</span>
        <ArrowRight size={16} weight="bold" />
      </button>
    </form>
  );
}
