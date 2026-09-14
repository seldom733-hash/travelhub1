"use client";

import { useEffect, useState, useMemo, type FormEvent } from "react";
import { X, CaretDown, CaretRight, Funnel, ArrowClockwise } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import { publicApi, type PublicFilterMetadata, type GeographyData, type GeographyCountry, type GeographyCity } from "@/lib/public-api";

interface VitrinaFilterState {
  country: string;
  city: string;
  dateFrom: string;
  dateTo: string;
  adults: number;
  children: number;
  childAges: number[];
  sort: string;
  categoryFilters: Record<string, string>;
}

interface VitrinaFiltersProps {
  service?: string;
  applied: VitrinaFilterState;
  onChange: (next: VitrinaFilterState) => void;
  onReset: () => void;
}

const SORT_OPTIONS = [
  { value: "newest", labelKey: "sort.newest" },
  { value: "price_asc", labelKey: "sort.price_asc" },
  { value: "price_desc", labelKey: "sort.price_desc" },
];

export default function VitrinaFilters({ service, applied, onChange, onReset }: VitrinaFiltersProps) {
  const locale = useLocale();
  const [draft, setDraft] = useState<VitrinaFilterState>(applied);
  const [geo, setGeo] = useState<GeographyData | null>(null);
  const [filterMeta, setFilterMeta] = useState<PublicFilterMetadata | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    geography: true,
    dates: true,
    travelers: true,
    service: false,
  });

  // Sync draft with applied
  useEffect(() => {
    setDraft(applied);
  }, [JSON.stringify(applied)]);

  // Load geography data
  useEffect(() => {
    let alive = true;
    publicApi.getGeography().then((data) => {
      if (alive) setGeo(data);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Load category-specific filters
  useEffect(() => {
    if (!service) { setFilterMeta(null); return; }
    let alive = true;
    // Map service type to category slug
    const catSlug = serviceToCategorySlug(service);
    if (!catSlug) { setFilterMeta(null); return; }
    publicApi.getCategoryFilters(catSlug).then((meta) => {
      if (alive) setFilterMeta(meta);
    }).catch(() => { if (alive) setFilterMeta(null); });
    return () => { alive = false; };
  }, [service]);

  const cities = useMemo<GeographyCity[]>(() => {
    if (!geo || !draft.country) return [];
    return geo.cities.filter((c) => c.countryCode === draft.country);
  }, [geo, draft.country]);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setField = <K extends keyof VitrinaFilterState>(key: K, value: VitrinaFilterState[K]) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      // Reset city when country changes
      if (key === "country" && prev.city) {
        const validCity = cities.find((c) => c.code === prev.city);
        if (!validCity) next.city = "";
      }
      return next;
    });
  };

  const setCategoryFilter = (key: string, value: string) => {
    setDraft((prev) => {
      const next = { ...prev, categoryFilters: { ...prev.categoryFilters } };
      if (value === "") delete next.categoryFilters[key];
      else next.categoryFilters[key] = value;
      return next;
    });
  };

  const apply = (e?: FormEvent) => {
    e?.preventDefault();
    onChange(draft);
    setMobileOpen(false);
  };

  const reset = () => {
    const empty: VitrinaFilterState = {
      country: "", city: "", dateFrom: "", dateTo: "",
      adults: 2, children: 0, childAges: [], sort: "newest",
      categoryFilters: {},
    };
    setDraft(empty);
    onReset();
    setMobileOpen(false);
  };

  const activeCount = [
    draft.country, draft.city, draft.dateFrom, draft.dateTo,
    ...Object.keys(draft.categoryFilters),
  ].filter(Boolean).length + (draft.adults !== 2 ? 1 : 0) + (draft.children !== 0 ? 1 : 0);

  const filterPanel = (
    <form onSubmit={apply} className="space-y-1" aria-label={t("filters.title", locale)}>
      {/* Geography */}
      <FilterSection
        title={t("filters.geography", locale) || "География"}
        expanded={expandedSections.geography}
        onToggle={() => toggleSection("geography")}
      >
        <label className="block text-xs font-medium text-neutral-500 mb-1">
          {t("filters.country", locale) || "Страна"}
        </label>
        <select
          value={draft.country}
          onChange={(e) => setField("country", e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-gold focus:ring-1 focus:ring-gold/30"
        >
          <option value="">{t("filters.all_countries", locale) || "Все страны"}</option>
          {(geo?.countries ?? []).map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>

        {draft.country && (
          <>
            <label className="block text-xs font-medium text-neutral-500 mb-1 mt-3">
              {t("filters.city", locale) || "Город"}
            </label>
            <select
              value={draft.city}
              onChange={(e) => setField("city", e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-gold focus:ring-1 focus:ring-gold/30"
            >
              <option value="">{t("filters.all_cities", locale) || "Все города"}</option>
              {cities.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </>
        )}
      </FilterSection>

      {/* Dates */}
      <FilterSection
        title={t("filters.dates", locale) || "Даты"}
        expanded={expandedSections.dates}
        onToggle={() => toggleSection("dates")}
      >
        <label className="block text-xs font-medium text-neutral-500 mb-1">
          {t("filters.date_from", locale) || "Дата начала"}
        </label>
        <input
          type="date"
          value={draft.dateFrom}
          onChange={(e) => setField("dateFrom", e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-gold focus:ring-1 focus:ring-gold/30"
        />
        <label className="block text-xs font-medium text-neutral-500 mb-1 mt-3">
          {t("filters.date_to", locale) || "Дата окончания"}
        </label>
        <input
          type="date"
          value={draft.dateTo}
          min={draft.dateFrom || undefined}
          onChange={(e) => setField("dateTo", e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-gold focus:ring-1 focus:ring-gold/30"
        />
      </FilterSection>

      {/* Travelers */}
      <FilterSection
        title={t("filters.travelers", locale) || "Туристы"}
        expanded={expandedSections.travelers}
        onToggle={() => toggleSection("travelers")}
      >
        <label className="block text-xs font-medium text-neutral-500 mb-1">
          {t("filters.adults", locale) || "Взрослые"}
        </label>
        <select
          value={draft.adults}
          onChange={(e) => setField("adults", Number(e.target.value))}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-gold focus:ring-1 focus:ring-gold/30"
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        <label className="block text-xs font-medium text-neutral-500 mb-1 mt-3">
          {t("filters.children", locale) || "Дети"}
        </label>
        <select
          value={draft.children}
          onChange={(e) => {
            const val = Number(e.target.value);
            setField("children", val);
            setDraft((prev) => ({
              ...prev,
              children: val,
              childAges: Array.from({ length: val }, (_, i) => prev.childAges[i] ?? 0),
            }));
          }}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-gold focus:ring-1 focus:ring-gold/30"
        >
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        {draft.children > 0 && (
          <div className="mt-3 space-y-2">
            {Array.from({ length: draft.children }, (_, i) => (
              <div key={i}>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  {t("filters.child_age", locale) || "Возраст ребёнка"} {i + 1}
                </label>
                <select
                  value={draft.childAges[i] ?? 0}
                  onChange={(e) => {
                    const ages = [...draft.childAges];
                    ages[i] = Number(e.target.value);
                    setDraft((prev) => ({ ...prev, childAges: ages }));
                  }}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-gold focus:ring-1 focus:ring-gold/30"
                >
                  {Array.from({ length: 18 }, (_, a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </FilterSection>

      {/* Service-specific filters */}
      {filterMeta && filterMeta.filters.length > 0 && (
        <FilterSection
          title={t("filters.service_params", locale) || "Параметры услуги"}
          expanded={expandedSections.service}
          onToggle={() => toggleSection("service")}
        >
          {filterMeta.filters.map((f) => (
            <div key={f.key} className="mb-3">
              <label className="block text-xs font-medium text-neutral-500 mb-1">
                {f.label}
              </label>
              {f.type === "enum" && f.options ? (
                <select
                  value={draft.categoryFilters[f.key] ?? ""}
                  onChange={(e) => setCategoryFilter(f.key, e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-gold focus:ring-1 focus:ring-gold/30"
                >
                  <option value="">—</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : f.type === "number" || f.type === "integer" ? (
                <input
                  type="number"
                  inputMode="numeric"
                  min={f.min}
                  max={f.max}
                  value={draft.categoryFilters[f.key] ?? ""}
                  onChange={(e) => setCategoryFilter(f.key, e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-gold focus:ring-1 focus:ring-gold/30"
                />
              ) : f.type === "boolean" ? (
                <select
                  value={draft.categoryFilters[f.key] ?? ""}
                  onChange={(e) => setCategoryFilter(f.key, e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-gold focus:ring-1 focus:ring-gold/30"
                >
                  <option value="">—</option>
                  <option value="true">{t("attr.yes", locale) || "Да"}</option>
                  <option value="false">{t("attr.no", locale) || "Нет"}</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={draft.categoryFilters[f.key] ?? ""}
                  onChange={(e) => setCategoryFilter(f.key, e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-gold focus:ring-1 focus:ring-gold/30"
                />
              )}
            </div>
          ))}
        </FilterSection>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-3">
        <button
          type="submit"
          className="flex-1 rounded-lg bg-gold px-3 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-gold-light"
        >
          {t("filters.apply", locale) || "Применить"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-neutral-400 transition-colors hover:bg-white/10"
        >
          <ArrowClockwise size={16} weight="light" />
        </button>
      </div>
    </form>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-[280px] shrink-0 lg:block">
        <div className="sticky top-24 rounded-2xl border border-white/10 bg-dark-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">{t("filters.title", locale) || "Фильтры"}</h3>
            {activeCount > 0 && (
              <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-medium text-gold">
                {activeCount}
              </span>
            )}
          </div>
          {filterPanel}
        </div>
      </aside>

      {/* Mobile filter button */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-dark-card px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/5"
        >
          <Funnel size={16} weight="light" />
          {t("filters.title", locale) || "Фильтры"}
          {activeCount > 0 && (
            <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-medium text-gold">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile filter drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[320px] max-w-[85vw] overflow-y-auto bg-dark p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{t("filters.title", locale) || "Фильтры"}</h3>
              <button onClick={() => setMobileOpen(false)} className="text-neutral-400 hover:text-white">
                <X size={20} weight="light" />
              </button>
            </div>
            {filterPanel}
          </div>
        </div>
      )}
    </>
  );
}

// ── Helper components ──────────────────────────────────────────────────────

function FilterSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/5 py-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-neutral-400 hover:text-white transition-colors"
      >
        {title}
        {expanded ? <CaretDown size={14} weight="light" /> : <CaretRight size={14} weight="light" />}
      </button>
      {expanded && <div className="mt-3">{children}</div>}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function serviceToCategorySlug(service: string): string | null {
  const map: Record<string, string> = {
    tours: "tours",
    hotels: "accommodation",
    sanatoriums: "wellness-spa",
    flights: "flights",
    excursions: "excursions",
    transfers: "transfers",
    guides: "guides",
    "car-rental": "car-rental",
    railway: "rail",
    cruises: "cruises",
  };
  return map[service] ?? null;
}

export type { VitrinaFilterState };
