"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import CompactSearch from "@/components/marketplace/CompactSearch";
import HelpFindButton from "@/components/marketplace/search/HelpFindButton";
import TourResultsTable from "@/components/supplier/TourResultsTable";
import { t, useLocale } from "@/lib/i18n";
import type { ServiceType, SearchContext } from "@/lib/search-engine";
import { publicApi, type PublicListResult } from "@/lib/public-api";
import {
  searchSupplierOffersAll,
  type AggregatedSearchResult,
} from "@/lib/supplier-api";
import ProductCard from "@/components/public/ProductCard";
import { ProductGridSkeleton } from "@/components/public/Skeletons";
import FlightResults from "@/components/marketplace/search/FlightResults";
import {
  searchAzalFlights,
  type FlightSearchResponse,
} from "@/lib/flight-api";
import { getFlightLocationCode } from "@/lib/flight-locations";

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

// useSearchParams requires a Suspense boundary for static prerendering (next build).
export default function SearchResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark">
        <div className="mx-auto max-w-[1400px] px-6 py-16 text-center text-neutral-400">…</div>
      </div>
    }>
      <SearchResultsInner />
    </Suspense>
  );
}

function SearchResultsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();

  const service = (searchParams.get("service") || "tours") as ServiceType;
  const isValidService = VALID_SERVICES.includes(service);
  const q = searchParams.get("q") || "";
  const sort = searchParams.get("sort") || "newest";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const params = parseParams(searchParams);

  // Universal live tour search (Summer + KOMPAS) — §1: results come from
  // supplier live availability at search time, NOT the static catalog.
  const liveTours = service === "tours" && searchParams.get("live") === "1";
  const [liveResult, setLiveResult] = useState<AggregatedSearchResult | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [searchId, setSearchId] = useState("");

  const [result, setResult] = useState<PublicListResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [flightResults, setFlightResults] = useState<FlightSearchResponse | null>(null);
  const [flightError, setFlightError] = useState<string | null>(null);
  const [flightLoading, setFlightLoading] = useState(false);

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

  const flightSearchCacheRef = useRef<{ key: string; promise: Promise<FlightSearchResponse> } | null>(null);
  const flightRequestIdRef = useRef(0);
  useEffect(() => {
    let alive = true;

    // AZAL flight search path
    if (service === "flights") {
      const from = getFlightLocationCode(params.from || "");
      const to = getFlightLocationCode(params.to || "");
      const departureDate =
        params.departureDate ||
        params.departure ||
        params.start ||
        "";

      const tripType =
        (params.tripType || (params.roundTrip === "true" || params.roundTrip === "1" ? "RT" : "OW")).toUpperCase() === "RT"
          ? "RT"
          : "OW";

      const adults = Math.max(1, Number(params.adults) || 1);
      const children = Math.max(0, Number(params.children) || 0);
      const infants = Math.max(0, Number(params.infants) || 0);
      const returnDate = params.returnDate || params.return || undefined;
      const tariff = params.tariff || "ALL";
      const dedupKey = `${from}-${to}-${departureDate}-${tripType}-${adults}-${children}-${infants}-${returnDate}-${tariff}`;
      const requestId = ++flightRequestIdRef.current;

      setLoading(true);
      setError("");
      setResult(null);
      setFlightError(null);
      setFlightLoading(true);

      if (!from || !to || !departureDate) {
        setFlightError(
          "Flight search requires departure airport, arrival airport and departure date.",
        );
        setFlightLoading(false);
        setLoading(false);
        return () => {
          alive = false;
        };
      }

      let searchPromise: Promise<FlightSearchResponse>;
      if (flightSearchCacheRef.current?.key === dedupKey) {
        searchPromise = flightSearchCacheRef.current.promise;
      } else {
        setFlightResults(null);
        searchPromise = searchAzalFlights({
          from,
          to,
          departureDate,
          tripType,
          passengers: {
            adults,
            children,
            infants,
          },
          ...(returnDate ? { returnDate } : {}),
        });
        flightSearchCacheRef.current = { key: dedupKey, promise: searchPromise };
      }

      searchPromise
        .then((flightResult) => {
          if (!alive) return;
          let flights = flightResult.flights;
          if (tariff !== "ALL") {
            flights = flights
              .map((f) => ({ ...f, fares: (f.fares ?? []).filter((ff: any) => (ff.family ?? ff.fareFamily) === tariff) }))
              .filter((f) => (f.fares ?? []).length > 0);
          }
          setFlightResults({ ...flightResult, flights });
        })
        .catch((e) => {
          if (!alive) return;
          setFlightError(
            e instanceof Error ? e.message : "Unable to search AZAL flights.",
          );
        })
        .finally(() => {
          if (requestId !== flightRequestIdRef.current) return;
          setFlightLoading(false);
          setLoading(false);
        });

      return () => {
        alive = false;
      };
    }

    setLoading(true);
    setError("");
    setResult(null);
    setFlightResults(null);
    setFlightError(null);
    setFlightLoading(false);

    // Universal live tour search path (Summer + KOMPAS in parallel, §3/§12).
    if (liveTours) {
      const sid = `SRCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      setSearchId(sid);
      setLiveLoading(true);
      searchSupplierOffersAll({
        service: "tours",
        destination: params.to || undefined,
        country: params.geoCountry || undefined,
        departureCity: params.from || undefined,
        departureDateFrom: params.start || undefined,
        departureDateTo: params.start || undefined,
        nightsFrom: params.nights ? Number(params.nights) : undefined,
        nightsTo: params.nights ? Number(params.nights) : undefined,
        adults: params.adults ? Number(params.adults) : 2,
        children: params.children ? Number(params.children) : 0,
        childAges: params.childAges ? params.childAges.split(",").map(Number) : undefined,
        hotel: params.hotel || undefined,
        meal: params.meal || undefined,
      })
        .then((r) => {
          if (!alive) return;
          setLiveResult(r);
          setLiveLoading(false);
          setLoading(false);
        })
        .catch(() => {
          if (!alive) return;
          setLiveResult({ offers: [], perSupplier: {} });
          setLiveLoading(false);
          setLoading(false);
        });
      return () => {
        alive = false;
      };
    }

    // Catalog search path (existing behavior). With Master Geography
    // selection (geoCountry/geoCity/geoResort) the geo filter is authoritative:
    // free-text direction names are excluded from q so they cannot hide
    // linked inventory.
    const geoMode = params.geoCity || params.geoResort;
    const searchQuery = geoMode
      ? [q, params.hotel, params.start, params.checkIn, params.departure]
        .filter(Boolean)
        .join(" ")
      : buildQuery();

    void publicApi
      .listProducts({
        q: searchQuery || undefined,
        category: service === "tours" ? "tours" : service === "hotels" ? "accommodation" : undefined,
        geoCountry: params.geoCountry || undefined,
        geoCity: params.geoCity || undefined,
        geoResort: params.geoResort || undefined,
        sort,
        page,
        pageSize: 12,
      })
      .then((r) => {
        if (!alive) return;
        setResult(r);
        setLoading(false);
      })
      .catch((e) => {
        if (alive) {
          setError((e as Error).message);
          setLoading(false);
        }
      });

    return () => { alive = false; };
  }, [service, q, sort, page, JSON.stringify(params), locale, liveTours]);

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

        {/* Universal live tour search results — table (§6) */}
        {liveTours && service === "tours" && (
          <div className="mt-6">
            <h2 className="mb-3 font-serif text-lg font-semibold text-white">
              {t("tourSearch.results_title", locale)}
            </h2>
            <TourResultsTable result={liveResult} searchId={searchId} loading={liveLoading} />
          </div>
        )}

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
          {service === "flights" && flightResults && (
            <span className="text-sm text-neutral-500">
              {t("search.found", locale)}: {flightResults.flights.length}
            </span>
          )}
        </div>

        {/* Loading */}
        {loading && service !== "flights" && !liveTours && (
          <div className="mt-6">
            <ProductGridSkeleton count={6} />
          </div>
        )}

        {/* AZAL flight results */}
        {service === "flights" && (
          <div className="mt-6">
            <FlightResults
              flights={flightResults?.flights ?? []}
              loading={flightLoading || loading}
              error={flightError}
            />
          </div>
        )}

        {/* Catalog error */}
        {error && (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Catalog results — hidden in live-tours mode */}
        {!liveTours && service !== "flights" && !loading && !error && result && (
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
