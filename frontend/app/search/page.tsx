"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import CompactSearch from "@/components/marketplace/CompactSearch";
import VitrinaFilters, { type VitrinaFilterState } from "@/components/marketplace/VitrinaFilters";
import HelpFindButton from "@/components/marketplace/search/HelpFindButton";
import { t, useLocale } from "@/lib/i18n";
import type { ServiceType, SearchContext } from "@/lib/search-engine";
import { publicApi, type PublicListResult } from "@/lib/public-api";
import ProductCard from "@/components/public/ProductCard";
import { ProductGridSkeleton } from "@/components/public/Skeletons";

const VALID_SERVICES: ServiceType[] = [
  "tours", "hotels", "flights", "sanatoriums",
  "guides", "excursions", "transfers", "car-rental",
  "railway", "cruises",
];

const INITIAL_FILTERS: VitrinaFilterState = {
  country: "",
  city: "",
  dateFrom: "",
  dateTo: "",
  adults: 2,
  children: 0,
  childAges: [],
  sort: "newest",
  categoryFilters: {},
};

function parseFilters(sp: URLSearchParams): VitrinaFilterState {
  return {
    country: sp.get("country") || "",
    city: sp.get("city") || "",
    dateFrom: sp.get("dateFrom") || sp.get("start") || "",
    dateTo: sp.get("dateTo") || "",
    adults: Math.max(1, Number(sp.get("adults")) || 2),
    children: Math.max(0, Number(sp.get("children")) || 0),
    childAges: sp.get("childAges")?.split(",").map(Number).filter((n) => !Number.isNaN(n)) ?? [],
    sort: sp.get("sort") || "newest",
    categoryFilters: Object.fromEntries(
      Array.from(sp.entries())
        .filter(([k]) => k.startsWith("f[") && k.endsWith("]"))
        .map(([k, v]) => [k.slice(2, -1), v])
    ),
  };
}

function serializeFilters(filters: VitrinaFilterState, service?: string): string {
  const sp = new URLSearchParams();
  if (service) sp.set("service", service);
  const q = filters.categoryFilters["q"] || "";
  if (q) sp.set("q", q);
  if (filters.country) sp.set("country", filters.country);
  if (filters.city) sp.set("city", filters.city);
  if (filters.dateFrom) sp.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) sp.set("dateTo", filters.dateTo);
  if (filters.adults !== 2) sp.set("adults", String(filters.adults));
  if (filters.children !== 0) sp.set("children", String(filters.children));
  if (filters.childAges.length > 0) sp.set("childAges", filters.childAges.join(","));
  if (filters.sort && filters.sort !== "newest") sp.set("sort", filters.sort);
  for (const [k, v] of Object.entries(filters.categoryFilters)) {
    if (k !== "q" && v) sp.set(`f[${k}]`, v);
  }
  return sp.toString();
}

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

export default function SearchResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();

  const service = (searchParams.get("service") || "") as ServiceType;
  const isValidService = VALID_SERVICES.includes(service);
  const q = searchParams.get("q") || "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const filters = parseFilters(searchParams);

  const [result, setResult] = useState<PublicListResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const pushWithFilters = useCallback((nextFilters: VitrinaFilterState, nextService?: string) => {
    const qs = serializeFilters(nextFilters, nextService ?? service);
    router.push(`/search?${qs}`);
  }, [router, service]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setResult(null);

    const categorySlug = isValidService ? (serviceToCategorySlug(service) ?? undefined) : undefined;
    const searchQuery = [q, filters.country, filters.city].filter(Boolean).join(" ") || undefined;

    void publicApi
      .listProducts({
        q: searchQuery,
        category: categorySlug,
        sort: filters.sort,
        page,
        pageSize: 12,
        country: filters.country || undefined,
        city: filters.city || undefined,
        available_from: filters.dateFrom || undefined,
        f: Object.keys(filters.categoryFilters).length > 0 ? filters.categoryFilters : undefined,
      })
      .then((r) => {
        if (alive) {
          setResult(r);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (alive) {
          setError((e as Error).message);
          setLoading(false);
        }
      });

    return () => { alive = false; };
  }, [service, q, filters.sort, filters.country, filters.city, filters.dateFrom, JSON.stringify(filters.categoryFilters), page, isValidService]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / 12)) : 1;

  const updatePage = (newPage: number) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", String(newPage));
    router.push(`/search?${sp.toString()}`);
  };

  const handleFilterChange = (next: VitrinaFilterState) => {
    pushWithFilters(next);
  };

  const handleFilterReset = () => {
    pushWithFilters({ ...INITIAL_FILTERS, sort: "newest" });
  };

  return (
    <div className="min-h-screen bg-dark">
      <MarketplaceHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Compact search bar */}
        <div className="mb-6">
          <CompactSearch service={isValidService ? service : "tours"} params={{
            from: filters.country,
            to: filters.city,
            start: filters.dateFrom,
            adults: String(filters.adults),
            children: String(filters.children),
          }} />
        </div>

        {/* Mobile filter button */}
        <div className="mb-4 lg:hidden">
          <VitrinaFilters
            service={isValidService ? service : undefined}
            applied={filters}
            onChange={handleFilterChange}
            onReset={handleFilterReset}
          />
        </div>

        <div className="flex gap-6">
          {/* Desktop sidebar filters */}
          <VitrinaFilters
            service={isValidService ? service : undefined}
            applied={filters}
            onChange={handleFilterChange}
            onReset={handleFilterReset}
          />

          {/* Main content */}
          <div className="min-w-0 flex-1">
            {/* Results header */}
            <div className="mb-4 flex items-center justify-between">
              <h1 className="font-serif text-xl font-semibold text-white sm:text-2xl">
                {t("search.results_title", locale)}
              </h1>
              {result && (
                <span className="text-sm text-neutral-500">
                  {t("search.found", locale)}: {result.total}
                </span>
              )}
            </div>

            {/* Sort bar */}
            <div className="mb-4 flex items-center gap-3">
              <label className="text-xs text-neutral-500">{t("sort.label", locale) || "Сортировка:"}</label>
              <select
                value={filters.sort}
                onChange={(e) => handleFilterChange({ ...filters, sort: e.target.value })}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none transition focus:border-gold"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey, locale)}
                  </option>
                ))}
              </select>
            </div>

            {/* Loading */}
            {loading && (
              <div className="mt-6">
                <ProductGridSkeleton count={6} />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Results */}
            {!loading && !error && result && (
              <>
                {result.items.length === 0 ? (
                  <div className="mt-12 text-center">
                    <p className="text-lg text-neutral-400">{t("search.empty_results", locale)}</p>
                    <p className="mt-2 text-sm text-neutral-500">{t("search.empty_results_hint", locale)}</p>
                    <div className="mt-6 flex items-center justify-center gap-3">
                      <button
                        onClick={handleFilterReset}
                        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/10"
                      >
                        {t("search.change_search", locale)}
                      </button>
                      <HelpFindButton
                        context={{
                          serviceType: isValidService ? service : "tours",
                          query: q,
                          fromDestination: filters.country,
                          toDestination: filters.city,
                          startDate: filters.dateFrom,
                          adults: filters.adults,
                          children: filters.children,
                        } as SearchContext}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {result.items.map((item, i) => (
                      <ProductCard key={item.id} card={item} position={i} />
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <button
                      onClick={() => updatePage(page - 1)}
                      disabled={page <= 1}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5"
                    >
                      {t("pagination.prev", locale)}
                    </button>
                    <span className="px-3 text-sm text-neutral-500">
                      {t("pagination.page", locale)} {page} {t("pagination.of", locale)} {totalPages}
                    </span>
                    <button
                      onClick={() => updatePage(page + 1)}
                      disabled={page >= totalPages}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5"
                    >
                      {t("pagination.next", locale)}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-dark-border bg-dark py-8">
        <div className="mx-auto max-w-[1400px] px-6 text-center text-sm text-neutral-500">
          © {new Date().getFullYear()} TravelHub
        </div>
      </footer>
    </div>
  );
}

const SORT_OPTIONS = [
  { value: "newest", labelKey: "sort.newest" },
  { value: "price_asc", labelKey: "sort.price_asc" },
  { value: "price_desc", labelKey: "sort.price_desc" },
];
