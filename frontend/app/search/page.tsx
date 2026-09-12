"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import CompactSearch from "@/components/marketplace/CompactSearch";
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

function parseParams(sp: URLSearchParams): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [k, v] of sp.entries()) {
    if (v) params[k] = v;
  }
  return params;
}

export default function SearchResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();

  const service = (searchParams.get("service") || "tours") as ServiceType;
  const isValidService = VALID_SERVICES.includes(service);
  const q = searchParams.get("q") || "";
  const sort = searchParams.get("sort") || "newest";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const params = parseParams(searchParams);

  const [result, setResult] = useState<PublicListResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Build query from service-specific params
  const buildQuery = () => {
    const parts: string[] = [];
    if (q) parts.push(q);
    if (params.from) parts.push(params.from);
    if (params.to) parts.push(params.to);
    if (params.city) parts.push(params.city);
    if (params.hotel) parts.push(params.hotel);
    if (params.start) parts.push(params.start);
    if (params.checkIn) parts.push(params.checkIn);
    if (params.departure) parts.push(params.departure);
    return parts.join(" ");
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setResult(null);

    const searchQuery = buildQuery();

    void publicApi
      .listProducts({
        q: searchQuery || undefined,
        category: service === "tours" ? "tours" : service === "hotels" ? "accommodation" : undefined,
        sort,
        page,
        pageSize: 12,
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
  }, [service, q, sort, page, JSON.stringify(params)]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / 12)) : 1;

  const updatePage = (newPage: number) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", String(newPage));
    router.push(`/search?${sp.toString()}`);
  };

  return (
    <div className="min-h-screen bg-dark">
      <MarketplaceHeader />
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        {/* Compact search bar */}
        <div className="mb-6">
          <CompactSearch service={isValidService ? service : "tours"} params={params} />
        </div>

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
                    onClick={() => router.push("/")}
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/10"
                  >
                    {t("search.change_search", locale)}
                  </button>
                  <HelpFindButton
                    context={{
                      serviceType: isValidService ? service : "tours",
                      query: buildQuery(),
                      fromDestination: params.from,
                      toDestination: params.to,
                      startDate: params.start,
                      nights: params.nights ? Number(params.nights) : undefined,
                      adults: params.adults ? Number(params.adults) : undefined,
                      children: params.children ? Number(params.children) : undefined,
                      hotelId: params.hotelId,
                      cityName: params.city,
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
      </main>

      <footer className="border-t border-dark-border bg-dark py-8">
        <div className="mx-auto max-w-[1400px] px-6 text-center text-sm text-neutral-500">
          © {new Date().getFullYear()} TravelHub
        </div>
      </footer>
    </div>
  );
}
