"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Buildings, CaretDown, X } from "@phosphor-icons/react";
import { useLocale } from "@/lib/i18n";
import { widestText } from "@/lib/measure-text";
import { useClickOutside } from "./useClickOutside";

export interface SupplierStarOption {
  /** Supplier label verbatim ("5*", "HV-1", …). */
  label: string;
  /** Parsed star count (null for non-numeric like "HV-1"). */
  stars: number | null;
  suppliers: string[];
  externalIds: Record<string, string>;
}

const FALLBACK: SupplierStarOption[] = [1, 2, 3, 4, 5].map((s) => ({
  label: `${s}*`,
  stars: s,
  suppliers: [],
  externalIds: {},
}));

/**
 * HotelStarsSelect — «Категория отеля» dropdown for the universal search.
 *
 * The option list is the FULL set of hotel categories known from supplier
 * dictionaries (GET /api/v1/geo/supplier-stars — SupplierGeoLink kind=STAR
 * ingested from KOMPAS/KazUnion forms), with a static 1★–5★ fallback while
 * loading/offline. Multi-select; empty = any category.
 */
export default function HotelStarsSelect({
  selected,
  onChange,
  countryCode,
}: {
  selected: string[];
  onChange: (labels: string[]) => void;
  /** Optional ISO-2 filter: only categories of that country's suppliers. */
  countryCode?: string;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<SupplierStarOption[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Multi-select: stays open while picking (like «Куда»), closes on trigger
  // or a click on another search control.
  useClickOutside(containerRef, open, () => setOpen(false));

  useEffect(() => {
    let alive = true;
    const qs = countryCode ? `?countryCode=${encodeURIComponent(countryCode)}` : "";
    fetch(`/api/v1/geo/supplier-stars${qs}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((list: SupplierStarOption[]) => {
        if (!alive) return;
        setOptions(Array.isArray(list) && list.length > 0 ? list : FALLBACK);
      })
      .catch(() => {
        if (alive) setOptions(FALLBACK);
      });
    return () => {
      alive = false;
    };
  }, [countryCode]);

  const toggle = (label: string) => {
    onChange(
      selected.includes(label)
        ? selected.filter((s) => s !== label)
        : [...selected, label],
    );
    // Collapse after picking an option (same contract as «Откуда»);
    // reopening lets the user add/remove more values.
    setOpen(false);
  };

  // Content-width: fits the widest plausible summary (top 3 labels + «…»).
  const maxTextPx = useMemo(() => {
    const pool = (options ?? FALLBACK).map((o) => o.label);
    const sample = pool.slice(0, 4).join(", ") + ", …";
    return widestText([sample]);
  }, [options]);

  const label =
    selected.length > 0
      ? selected.slice(0, 3).join(", ") + (selected.length > 3 ? `, … +${selected.length - 3}` : "")
      : locale === "ru"
        ? "Любая"
        : locale === "az"
          ? "İstənilən"
          : "Any";

  return (
    <div ref={containerRef} className="relative" style={{ maxWidth: maxTextPx > 0 ? maxTextPx + 56 : undefined }}>
      <label htmlFor="hotel-stars" className="mb-0.5 block text-[13px] font-medium text-neutral-400">
        {locale === "ru" ? "Категория отеля" : locale === "az" ? "Otel kateqoriyası" : "Hotel category"}
      </label>
      <button
        id="hotel-stars"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-dark-border bg-dark-card px-3 py-2 text-left outline-none transition-colors hover:border-gold/40 focus:border-gold/50"
      >
        <Buildings size={14} weight="light" className="shrink-0 text-neutral-500" />
        <span className={`min-w-0 flex-1 truncate text-[15px] ${selected.length ? "text-white" : "text-neutral-500"}`}>
          {label}
        </span>
        {selected.length > 0 ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={locale === "az" ? "Sıfırla" : "Сбросить"}
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onChange([]);
              }
            }}
            className="shrink-0 text-neutral-500 transition-colors hover:text-white"
          >
            <X size={14} />
          </span>
        ) : (
          <CaretDown size={14} className={`shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-[60] mt-1 overflow-hidden rounded-xl border border-dark-border bg-dark-surface shadow-xl">
          <ul role="listbox" aria-multiselectable="true" className="max-h-56 overflow-y-auto py-1">
            {(options ?? []).map((opt) => {
              const active = selected.includes(opt.label);
              return (
                <li key={opt.label}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => toggle(opt.label)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5 ${active ? "bg-gold/10" : ""}`}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-[13px] font-semibold text-gold">
                      {opt.label}
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] font-medium text-white">
                      {opt.label}
                    </span>
                    {active && <span className="text-[13px] text-gold">✓</span>}
                  </button>
                </li>
              );
            })}
            {options === null && (
              <li className="px-3 py-3 text-center text-[14px] text-neutral-500">Загрузка…</li>
            )}
          </ul>
          {selected.length > 0 && (
            <div className="border-t border-dark-border p-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full rounded-lg px-2 py-1.5 text-[13px] text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                {locale === "ru" ? "Сбросить" : locale === "az" ? "Sıfırla" : "Reset"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
