"use client";

import { useMemo, useRef, useState } from "react";
import { CaretDown, MapPin, X } from "@phosphor-icons/react";
import {
  findFlightAirports,
  type FlightAirport,
} from "@/lib/flight-locations";

interface FlightAirportSelectProps {
  id: string;
  label: string;
  placeholder: string;
  value: FlightAirport | null;
  onChange: (airport: FlightAirport | null) => void;
  required?: boolean;
}

export default function FlightAirportSelect({
  id,
  label,
  placeholder,
  value,
  onChange,
  required = true,
}: FlightAirportSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const airports = useMemo(() => findFlightAirports(query).slice(0, 12), [query]);

  const selectAirport = (airport: FlightAirport) => {
    onChange(airport);
    setQuery("");
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor={id}
        className="mb-0.5 block text-[11px] font-medium text-neutral-400"
      >
        {label}
        {required && <span className="ml-0.5 text-gold">*</span>}
      </label>

      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-dark-border bg-dark-card px-3 py-2 text-left outline-none transition-colors hover:border-gold/40 focus:border-gold/50"
      >
        <MapPin size={14} weight="light" className="shrink-0 text-neutral-500" />

        <span className={`min-w-0 flex-1 truncate text-[13px] ${value ? "text-white" : "text-neutral-500"}`}>
          {value ? `${value.city} · ${value.code}` : placeholder}
        </span>

        {value ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                clear();
              }
            }}
            className="text-neutral-500 hover:text-white"
            aria-label="Очистить"
          >
            <X size={14} />
          </span>
        ) : (
          <CaretDown
            size={14}
            className={`shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-[60] mt-1 overflow-hidden rounded-xl border border-dark-border bg-dark-surface shadow-xl">
          <div className="border-b border-dark-border p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск города или аэропорта..."
              className="w-full rounded-lg border border-dark-border bg-dark-card px-3 py-2 text-[12px] text-white placeholder-neutral-500 outline-none focus:border-gold/50"
            />
          </div>

          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {airports.length === 0 && (
              <li className="px-3 py-4 text-center text-[12px] text-neutral-500">
                Аэропорт не найден
              </li>
            )}

            {airports.map((airport) => (
              <li key={airport.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value?.code === airport.code}
                  onClick={() => selectAirport(airport)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-[11px] font-semibold text-gold">
                    {airport.code}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-white">
                      {airport.city}
                    </span>
                    <span className="block truncate text-[11px] text-neutral-500">
                      {airport.airport} · {airport.country}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
