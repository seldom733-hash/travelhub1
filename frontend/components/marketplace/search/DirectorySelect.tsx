"use client";

import { useMemo, useRef, useState } from "react";
import { CaretDown, MapPin, X } from "@phosphor-icons/react";
import { geoDisplayName, type GeoDirectoryEntry, type GeoLocale } from "@/lib/geo-api";
import { useWidestText } from "@/lib/measure-text";
import { useLocale, t } from "@/lib/i18n";
import { useClickOutside } from "./useClickOutside";

interface DirectorySelectProps {
  id: string;
  label: string;
  placeholder: string;
  searchPlaceholder?: string;
  value: GeoDirectoryEntry | null;
  onChange: (entry: GeoDirectoryEntry | null) => void;
  loadItems: () => Promise<GeoDirectoryEntry[]>;
  required?: boolean;
}

/**
 * Directory dropdown (Master Geography) with live search — same UX pattern
 * as FlightAirportSelect. Items load lazily on first open.
 */
export default function DirectorySelect({
  id,
  label,
  placeholder,
  searchPlaceholder,
  value,
  onChange,
  loadItems,
  required = false,
}: DirectorySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GeoDirectoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const locale = useLocale() as GeoLocale;
  const containerRef = useRef<HTMLDivElement>(null);

  const openDropdown = () => {
    setOpen(true);
    setQuery("");
    if (items === null && !loading) {
      setLoading(true);
      loadItems()
        .then((list) => setItems(list))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }
  };

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const names = item.names ?? { ru: "", en: "", az: "" };
      return (
        `${item.code} ${names.ru ?? ""} ${names.en ?? ""} ${names.az ?? ""}`
          .toLowerCase()
          .includes(q)
      );
    });
  }, [items, query]);

  const selectItem = (item: GeoDirectoryEntry) => {
    onChange(item);
    setQuery("");
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery("");
  };

  // Close when clicking another search control (selection itself closes too).
  useClickOutside(containerRef, open, () => setOpen(false));

  // Content-width: the control is as wide as the longest display text it can
  // hold (longest geo name + « · CODE» suffix), with placeholder fallback.
  // useWidestText is SSR-safe (0 on server + hydration, measured after mount).
  const widthLabels = useMemo(() => {
    const labels = (items ?? []).map(
      (i) => `${geoDisplayName(i.names, i.code, locale)} · ${i.code}`,
    );
    if (labels.length === 0) return [];
    labels.push(placeholder);
    return labels;
  }, [items, placeholder, locale]);
  const measuredPx = useWidestText(widthLabels);
  const maxTextPx = measuredPx;

  return (
    <div ref={containerRef} className="relative" style={{ maxWidth: maxTextPx > 0 ? maxTextPx + 56 : undefined }}>
      <label
        htmlFor={id}
        className="mb-0.5 block text-[13px] font-medium text-neutral-400"
      >
        {label}
        {required && <span className="ml-0.5 text-gold">*</span>}
      </label>

      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className="flex w-full items-center gap-2 rounded-xl border border-dark-border bg-dark-card px-3 py-2 text-left outline-none transition-colors hover:border-gold/40 focus:border-gold/50"
      >
        <MapPin size={14} weight="light" className="shrink-0 text-neutral-500" />

        <span className={`min-w-0 flex-1 truncate text-right text-[15px] ${value ? "text-white" : "text-neutral-500"}`}>
          {value ? `${geoDisplayName(value.names, value.code, locale)} · ${value.code}` : placeholder}
        </span>

        {value && !required ? (
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
            aria-label={t("search.clear", locale)}
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
              placeholder={searchPlaceholder ?? `${t("search.submit", locale)}…`}
              className="w-full rounded-lg border border-dark-border bg-dark-card px-3 py-2 text-[14px] text-white placeholder-neutral-500 outline-none focus:border-gold/50"
            />
          </div>

          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {loading && (
              <li className="px-3 py-4 text-center text-[14px] text-neutral-500">
                {t("search.searching", locale)}
              </li>
            )}

            {!loading && filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-[14px] text-neutral-500">
                {t("search.no_results", locale)}
              </li>
            )}

            {!loading &&
              filtered.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value?.id === item.id}
                    onClick={() => selectItem(item)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold/10 px-1 text-center text-[14px] font-semibold leading-tight text-gold">
                      {item.code.length > 6 ? item.code.slice(0, 6) : item.code}
                    </span>

                    <span className="min-w-0 flex-1 text-right">
                      <span className="block truncate text-[15px] font-medium text-white">
                        {geoDisplayName(item.names, item.code, locale)}
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
