"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import CompactSearch from "@/components/marketplace/CompactSearch";
import HelpFindButton from "@/components/marketplace/search/HelpFindButton";
import PriceConfigurator from "@/components/supplier/PriceConfigurator";
import PriceCalendar from "@/components/supplier/PriceCalendar";
import VitrinaFilters from "@/components/supplier/VitrinaFilters";
import { t, useLocale } from "@/lib/i18n";
import type { ServiceType, SearchContext } from "@/lib/search-engine";
import { publicApi, type PublicListResult } from "@/lib/public-api";
import {
  searchSupplierOffers,
  type SupplierOffer,
  type SupplierSearchQuery,
  type SupplierPriceCalendarQuery,
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
  const supplierCode = searchParams.get("supplier") || undefined;

  const [result, setResult] = useState<PublicListResult | null>(null);
  const [supplierOffers, setSupplierOffers] = useState<SupplierOffer[]>([]);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [flightResults, setFlightResults] = useState<FlightSearchResponse | null>(null);
  const [flightError, setFlightError] = useState<string | null>(null);
  const [flightLoading, setFlightLoading] = useState(false);

  // VitrinaFilters: convert SupplierSearchQuery back to URL params and navigate
  const handleFilterSearch = useCallback((query: SupplierSearchQuery) => {
    const sp = new URLSearchParams();
    sp.set("service", "tours");
    sp.set("supplier", query.supplierCode || "KOMPAS");
    if (query.departureCity) sp.set("from", query.departureCity);
    if (query.destination) sp.set("to", query.destination);
    if (query.nightsFrom) sp.set("nights", String(query.nightsFrom));
    if (query.adults) sp.set("adults", String(query.adults));
    if (query.children) sp.set("children", String(query.children));
    if (query.childAges?.length) sp.set("childAges", query.childAges.join(","));
    if (query.hotel) sp.set("hotel", query.hotel);
    if (query.meal) sp.set("meal", query.meal);
    router.push(`/search?${sp.toString()}`);
  }, [router]);

  // Build PriceCalendar query from first offer + search params.
  // NOTE: PriceCalendarQuery contract uses singular `nights`; hotel name is
  // normalized to single-line because supplier hotel strings contain line breaks.
  const buildCalendarQuery = useCallback((): SupplierPriceCalendarQuery | null => {
    if (supplierOffers.length === 0) return null;
    const first = supplierOffers[0];
    // Use LOCAL date, not UTC: KOMPAS/SAMO returns 0 rows when CHECKIN_BEG is in
    // the past, and UTC date can be one day behind local time.
    const nowLocal = new Date();
    const today = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, "0")}-${String(nowLocal.getDate()).padStart(2, "0")}`;
    const dateTo = new Date(nowLocal.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const nights = params.nights ? Number(params.nights) : first.nights;
    return {
      supplierCode: first.supplierCode,
      hotel: first.hotel?.replace(/\s*\r?\n\s*/g, " ").replace(/\s{2,}/g, " ").trim(),
      hotelExternalId: first.hotelExternalId,
      destination: params.to || first.destination || first.country || undefined,
      dateFrom: params.start || today,
      dateTo: params.start || dateTo,
      nights,
      adults: first.adults,
      children: first.children || undefined,
      childAges: first.childAges.length > 0 ? first.childAges : undefined,
      tourIncValue: first.tourIncValue ?? (first.rawMetadata?.tourIncValue as string) ?? undefined,
      tourIncName: first.tourIncName ?? (first.rawMetadata?.tourIncName as string) ?? undefined,
      tourIncValues: first.tourIncValues ?? undefined,
      tourIncNames: first.tourIncNames ?? undefined,
    };
  }, [supplierOffers, params]);

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
    setSupplierError(null);
    setResult(null);
    setSupplierOffers([]);
    setFlightResults(null);
    setFlightError(null);
    setFlightLoading(false);

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

      setFlightLoading(true);

      void searchAzalFlights({
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
      })
        .then((flightResult) => {
          if (!alive) return;
          setFlightResults(flightResult);
          setFlightLoading(false);
          setLoading(false);
        })
        .catch((e) => {
          if (!alive) return;
          setFlightError(
            e instanceof Error ? e.message : "Unable to search AZAL flights.",
          );
          setFlightLoading(false);
          setLoading(false);
        });

      return () => {
        alive = false;
      };
    }

    // Supplier search path
    if (supplierCode) {
      searchSupplierOffers({
        supplierCode,
        destination: params.to || undefined,
        departureCity: params.from || undefined,
        nightsFrom: params.nights ? Number(params.nights) : undefined,
        nightsTo: params.nights ? Number(params.nights) : undefined,
        adults: params.adults ? Number(params.adults) : 2,
        children: params.children ? Number(params.children) : 0,
        childAges: params.childAges ? params.childAges.split(",").map(Number) : undefined,
        hotel: params.hotel || undefined,
        meal: params.meal || undefined,
      })
        .then((offers) => {
          if (alive) {
            setSupplierOffers(offers);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (alive) {
            const msg = (e as Error).message;
            // Classify error for better UX
            if (msg.includes("supports nights") || msg.includes("UNSUPPORTED")) {
              setSupplierError(t("supplier.error.unsupported", locale));
            } else if (msg.includes("timeout") || msg.includes("TIMEOUT")) {
              setSupplierError(t("supplier.error.timeout", locale));
            } else if (msg.includes("no price_info") || msg.includes("NO_RESULT")) {
              setSupplierError(t("supplier.error.no_results", locale));
            } else {
              setSupplierError(t("supplier.error.generic", locale));
            }
            setLoading(false);
          }
        });
      return () => { alive = false; };
    }

    // Catalog search path (existing behavior)
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
  }, [service, q, sort, page, JSON.stringify(params), supplierCode, locale]);

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

        {/* VitrinaFilters — shown when supplier=KOMPAS */}
        {supplierCode && (
          <div className="mb-6">
            <VitrinaFilters
              initial={{
                departureCity: params.from || undefined,
                destination: params.to || undefined,
                nightsFrom: params.nights ? Number(params.nights) : undefined,
                nightsTo: params.nights ? Number(params.nights) : undefined,
                adults: params.adults ? Number(params.adults) : undefined,
                children: params.children ? Number(params.children) : undefined,
                hotel: params.hotel || undefined,
                meal: params.meal || undefined,
              }}
              onSearch={handleFilterSearch}
              supplierCode={supplierCode}
            />
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
          {supplierOffers.length > 0 && service !== "flights" && (
            <span className="text-sm text-neutral-500">
              {t("search.found", locale)}: {supplierOffers.length}
            </span>
          )}
          {service === "flights" && flightResults && (
            <span className="text-sm text-neutral-500">
              {t("search.found", locale)}: {flightResults.flights.length}
            </span>
          )}
        </div>

        {/* Loading */}
        {loading && (
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

        {/* Supplier error (classified) */}
        {supplierError && (
          <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-400">
            {supplierError}
          </div>
        )}

        {/* Catalog error */}
        {error && (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Supplier results */}
        {!loading && !supplierError && supplierOffers.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {supplierOffers.map((offer, i) => (
                <PriceConfigurator key={`${offer.externalOfferId}-${i}`} offer={offer} />
              ))}
            </div>

            {/* PriceCalendar — toggle for date-based view */}
            <div className="mt-6">
              <button
                onClick={() => setCalendarVisible((v) => !v)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/10"
              >
                {calendarVisible
                  ? t("supplier.calendar.hide", locale)
                  : t("supplier.calendar.show", locale)}
              </button>
              {calendarVisible && (() => {
                const calQuery = buildCalendarQuery();
                return calQuery ? (
                  <div className="mt-4">
                    <PriceCalendar
                      query={calQuery}
                      onSelect={(entry) => {
                        if (entry.price !== null) {
                          setCalendarVisible(false);
                        }
                      }}
                    />
                  </div>
                ) : null;
              })()}
            </div>
          </>
        )}

        {/* Supplier empty */}
        {!loading && !supplierError && supplierCode && supplierOffers.length === 0 && (
          <div className="mt-12 text-center">
            <p className="text-lg text-neutral-400">{t("search.empty_results", locale)}</p>
            <p className="mt-2 text-sm text-neutral-500">{t("search.empty_results_hint", locale)}</p>
          </div>
        )}

        {/* Catalog results */}
        {service !== "flights" && !loading && !error && result && (
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
