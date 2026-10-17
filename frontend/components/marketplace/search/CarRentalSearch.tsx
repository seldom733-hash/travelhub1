"use client";

import { useState } from "react";
import { MapPin, CalendarBlank, ArrowRight } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import { todayISO } from "@/lib/dates";
import { useWidestText } from "@/lib/measure-text";
import type { SearchContext } from "@/lib/search-engine";
import LiveSearchInput from "./LiveSearchInput";
import HelpFindButton from "./HelpFindButton";
import {
  PICKER_CONTROL,
  PICKER_CONTROL_ICON,
  PICKER_DATE_WIDTH_EXTRA,
  PICKER_DIGIT_WIDTH_EXTRA,
  PICKER_LABEL,
  PICKER_ROW,
  PICKER_SUBMIT,
  PICKER_W_FROM,
  PICKER_W_TO,
} from "./picker-styles";

interface CarRentalSearchProps {
  onSearch: (ctx: SearchContext) => void;
}

export default function CarRentalSearch({ onSearch }: CarRentalSearchProps) {
  const locale = useLocale();
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  // Default pickup/return = today (platform-wide default for date fields).
  const [pickupDate, setPickupDate] = useState(todayISO());
  const [returnDate, setReturnDate] = useState(todayISO());
  const [driverAge, setDriverAge] = useState(25);
  // Content-width: те же размеры, что в поиске туров.
  const datePx = useWidestText(["00.00.0000"]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({ serviceType: "car-rental", fromDestination: pickup, toDestination: dropoff, startDate: pickupDate, returnDate, adults: 1 });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className={PICKER_ROW}>
        <div className={PICKER_W_FROM}>
          <LiveSearchInput id="car-pickup" label={t("search.pickup", locale)} placeholder={t("search.pickup", locale)} icon={<MapPin size={14} weight="light" />} onSelect={(r) => setPickup(r.name)} onClear={() => setPickup("")} filterType="destination" />
        </div>
        <div className={PICKER_W_TO}>
          <LiveSearchInput id="car-dropoff" label={t("search.dropoff", locale)} placeholder={t("search.dropoff", locale)} icon={<MapPin size={14} weight="light" />} onSelect={(r) => setDropoff(r.name)} onClear={() => setDropoff("")} filterType="destination" />
        </div>
        <div style={{ minWidth: datePx + PICKER_DATE_WIDTH_EXTRA, maxWidth: datePx + PICKER_DATE_WIDTH_EXTRA }}>
          <label htmlFor="car-pickup-date" className={PICKER_LABEL}>{t("search.check_in", locale)}</label>
          <div className="relative">
            <CalendarBlank size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input id="car-pickup-date" type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className={PICKER_CONTROL_ICON} />
          </div>
        </div>
        <div style={{ minWidth: datePx + PICKER_DATE_WIDTH_EXTRA, maxWidth: datePx + PICKER_DATE_WIDTH_EXTRA }}>
          <label htmlFor="car-return-date" className={PICKER_LABEL}>{t("search.check_out", locale)}</label>
          <div className="relative">
            <CalendarBlank size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input id="car-return-date" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} min={pickupDate || undefined} className={PICKER_CONTROL_ICON} />
          </div>
        </div>
        <div style={{ maxWidth: datePx + PICKER_DIGIT_WIDTH_EXTRA }}>
          <label htmlFor="car-driver-age" className={PICKER_LABEL}>{t("search.driver_age", locale)}</label>
          <select id="car-driver-age" value={driverAge} onChange={(e) => setDriverAge(Number(e.target.value))} className={PICKER_CONTROL}>
            {Array.from({ length: 15 }, (_, i) => i + 18).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <HelpFindButton context={{ serviceType: "car-rental", fromDestination: pickup, toDestination: dropoff, startDate: pickupDate, returnDate }} />
      <button type="submit" className={`btn-gold ${PICKER_SUBMIT}`}>
        <span>{t("marketplace.search_submit", locale)}</span>
        <ArrowRight size={16} weight="bold" />
      </button>
    </form>
  );
}