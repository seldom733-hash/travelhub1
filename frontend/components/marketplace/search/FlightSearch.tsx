"use client";

import { useState, useMemo, useEffect } from "react";
import { MapPin, ArrowRight, Airplane } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import { todayISO } from "@/lib/dates";
import type { SearchContext } from "@/lib/search-engine";
import FlightAirportSelect from "./FlightAirportSelect";
import FlightDatePicker from "./FlightDatePicker";
import { fetchAzalDirectory, fetchFlightCalendar, type FlightCalendarDayPrice } from "@/lib/flight-api";
import { findFlightAirports, setRemoteAirports } from "@/lib/flight-locations";
import { useSupplierOptions } from "@/lib/supplier-registry";
import ChildAges from "./ChildAges";
import HelpFindButton from "./HelpFindButton";
import { useWidestText } from "@/lib/measure-text";
import {
  PICKER_CHECKBOX,
  PICKER_CONTROL,
  PICKER_DATE_WIDTH_EXTRA,
  PICKER_DIGIT_WIDTH_EXTRA,
  PICKER_LABEL,
  PICKER_ROW,
  PICKER_SUBMIT,
  PICKER_W_FROM,
  PICKER_W_NIGHTS,
  PICKER_W_TO,
} from "./picker-styles";

interface FlightSearchProps {
  onSearch: (ctx: SearchContext) => void;
}

export default function FlightSearch({ onSearch }: FlightSearchProps) {
  const locale = useLocale();
  const [from, setFrom] = useState<import("@/lib/flight-locations").FlightAirport | null>(null);
  const [to, setTo] = useState<import("@/lib/flight-locations").FlightAirport | null>(null);
  // Default departure/return = today (platform-wide default for date fields).
  const [departureDate, setDepartureDate] = useState(todayISO());
  const [roundTrip, setRoundTrip] = useState(false);
  const [returnDate, setReturnDate] = useState(todayISO());
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState<number[]>([]);
  const [infants, setInfants] = useState(0);
  const [direct, setDirect] = useState(false);

  // Restore the form from the URL so a second search on the results page
  // starts with the previously selected airports/dates instead of an empty form.
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const pickAirport = (value: string | null) => {
        if (!value) return null;
        const list = findFlightAirports(value);
        return list.find((a) => a.code.toUpperCase() === value.trim().toUpperCase()) ?? list[0] ?? null;
      };
      const fromAirport = pickAirport(sp.get("from"));
      const toAirport = pickAirport(sp.get("to"));
      if (fromAirport) setFrom(fromAirport);
      if (toAirport) setTo(toAirport);

      const dep = sp.get("departureDate") || sp.get("departure") || sp.get("start");
      if (dep) setDepartureDate(dep);
      const rt = sp.get("roundTrip") === "1" || sp.get("tripType")?.toUpperCase() === "RT";
      setRoundTrip(rt);
      const ret = sp.get("returnDate") || sp.get("return");
      if (ret) setReturnDate(ret);

      const a = Number(sp.get("adults"));
      if (Number.isFinite(a) && a > 0) setAdults(a);
      const c = Number(sp.get("children"));
      if (Number.isFinite(c) && c >= 0) setChildren(c);
      const inf = Number(sp.get("infants"));
      if (Number.isFinite(inf) && inf >= 0) setInfants(inf);
      const ages = sp.get("childAges");
      if (ages) setChildAges(ages.split(",").map(Number).filter((n) => !Number.isNaN(n)));

      const t = sp.get("tariff");
      if (t) setTariff(t);
      const s = sp.get("supplier");
      if (s) setSupplier(s);
      setDirect(sp.get("direct") === "1" || sp.get("direct") === "true");
    } catch {}
    // Run once on mount; the form is the source of truth afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [tariff, setTariff] = useState("ALL");
  const [supplier, setSupplier] = useState("ALL");
  // Registry-driven supplier options (§4.7): backend FlightSupplierRegistry,
  // no hardcoded option list. A URL-selected supplier missing from the
  // registry is kept as its own option so the <select> never blanks out.
  const flightSuppliers = useSupplierOptions("flights");
  const supplierOptions = useMemo(() => {
    const options = flightSuppliers.map((s) => ({ value: s.code, label: s.name }));
    if (supplier && supplier !== "ALL" && !options.some((o) => o.value === supplier)) {
      options.unshift({ value: supplier, label: supplier });
    }
    return options;
  }, [flightSuppliers, supplier]);
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const t = sp.get("tariff");
      if (t) setTariff(t);
      const s = sp.get("supplier");
      if (s) setSupplier(s);
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
      direct,
      tariff,
      supplier,
    });
  };

  // Content-width: те же размеры, что в поиске туров.
  const datePx = useWidestText(["00.00.0000"]);
  const digitPx = useWidestText(["0"]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className={PICKER_ROW}>
        {/* From */}
        <div className={PICKER_W_FROM}>
          <FlightAirportSelect
            id="flight-from"
            label={t("search.from", locale)}
            placeholder={t("search.select_departure_city", locale)}
            value={from}
            onChange={setFrom}
          />
        </div>

        {/* To */}
        <div className={PICKER_W_TO}>
          <FlightAirportSelect
            id="flight-to"
            label={t("search.to", locale)}
            placeholder={t("search.select_arrival_city", locale)}
            value={to}
            onChange={setTo}
          />
        </div>

        {/* Departure date */}
        <div style={{ maxWidth: datePx + PICKER_DATE_WIDTH_EXTRA, flex: "1 1 0" }}>
          <FlightDatePicker
            id="flight-departure"
            label={t("search.departure_date", locale)}
            placeholder={t("search.select_date", locale)}
            value={departureDate}
            onChange={handleDepartureChange}
            availability={availability}
            loadingAvailability={availabilityLoading}
          />
        </div>

        {/* Supplier */}
        <div className={PICKER_W_NIGHTS}>
          <label htmlFor="flight-supplier" className={PICKER_LABEL}>
            {t("search.supplier", locale)}
          </label>
          <select
            id="flight-supplier"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            className={PICKER_CONTROL}
          >
            <option value="ALL">{t("search.all_suppliers", locale)}</option>
            {supplierOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Return date (conditional) */}
        {roundTrip && (
          <div style={{ maxWidth: datePx + PICKER_DATE_WIDTH_EXTRA, flex: "1 1 0" }}>
            <FlightDatePicker
              id="flight-return"
              label={t("search.return_date", locale)}
              placeholder={t("search.select_date", locale)}
              value={returnDate}
              onChange={setReturnDate}
              minDate={minReturnDate || undefined}
              availability={returnAvailability}
              disabled={!departureDate}
            />
          </div>
        )}
      </div>

      {/* Round-trip checkbox */}
      <label className={`self-start ${PICKER_CHECKBOX}`}>
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

      <div className={PICKER_ROW}>
        {/* Adults */}
        <div style={{ maxWidth: digitPx + PICKER_DIGIT_WIDTH_EXTRA }}>
          <label htmlFor="flight-adults" className={PICKER_LABEL}>
            {t("search.adults", locale)}
          </label>
          <select
            id="flight-adults"
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className={PICKER_CONTROL}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Children */}
        <div style={{ maxWidth: digitPx + PICKER_DIGIT_WIDTH_EXTRA }}>
          <label htmlFor="flight-children" className={PICKER_LABEL}>
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
            className={PICKER_CONTROL}
          >
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Infants */}
        <div style={{ maxWidth: digitPx + PICKER_DIGIT_WIDTH_EXTRA }}>
          <label htmlFor="flight-infants" className={PICKER_LABEL}>
            {t("search.infants", locale)}
          </label>
          <select
            id="flight-infants"
            value={infants}
            onChange={(e) => setInfants(Number(e.target.value))}
            className={PICKER_CONTROL}
          >
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Direct flight only */}
        <label className={PICKER_CHECKBOX}>
          <input
            type="checkbox"
            checked={direct}
            onChange={(e) => setDirect(e.target.checked)}
            className="size-3.5 rounded border-dark-border accent-gold"
          />
          {t("search.direct_flight", locale)}
        </label>
      </div>

      {/* Child ages */}
      {children > 0 && (
        <ChildAges count={children} ages={childAges} onChange={setChildAges} />
      )}

      {/* Tariff (baggage) */}
      <div>
        <label htmlFor="flight-tariff" className={PICKER_LABEL}>
          {t("search.tariff_baggage", locale)}
        </label>
        <select
          id="flight-tariff"
          value={tariff}
          onChange={(e) => setTariff(e.target.value)}
          className={PICKER_CONTROL}
        >
          <option value="ALL">{t("search.all", locale)}</option>
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
          direct,
          tariff,
          supplier,
        }}
      />

      {/* Submit */}
      <button
        type="submit"
        disabled={!from || !to || !departureDate}
        className={`${!from || !to || !departureDate ? "bg-neutral-700 text-neutral-400 cursor-not-allowed opacity-60" : "btn-gold"} ${PICKER_SUBMIT}`}
      >
        <span>{t("marketplace.search_submit", locale)}</span>
        <ArrowRight size={16} weight="bold" />
      </button>
    </form>
  );
}
