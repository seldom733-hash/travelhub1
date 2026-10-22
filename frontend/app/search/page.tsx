"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import MarketplaceHeader, {
  resolveBrandName,
  type MarketplaceHeaderConfig,
} from "@/components/marketplace/MarketplaceHeader";
import HeroSearch from "@/components/marketplace/HeroSearch";
import HelpFindButton from "@/components/marketplace/search/HelpFindButton";
import TourResultsTable from "@/components/supplier/TourResultsTable";
import { t, useLocale } from "@/lib/i18n";
import type { ServiceType, SearchContext } from "@/lib/search-engine";
import { publicApi, type PublicListResult } from "@/lib/public-api";
import { useConstructorPublished } from "@/lib/use-constructor-published";
import { resolveSearchServices, type SearchServicesConfig } from "@/lib/search-services";
import {
  searchSupplierOffersAll,
  searchSupplierResolve,
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

/**
 * Night range «от–до» from the URL: ?nightsFrom/?nightsTo win, the legacy
 * single ?nights fills both bounds, and a swapped pair is normalized so the
 * backend always sees from ≤ to.
 */
function parseNightsRange(params: Record<string, string>): { from?: number; to?: number } {
  const legacy = Number(params.nights) || undefined;
  const a = Number(params.nightsFrom) || legacy;
  const b = Number(params.nightsTo) || legacy;
  if (!a && !b) return {};
  const lo = Math.min(a ?? b!, b ?? a!);
  const hi = Math.max(a ?? b!, b ?? a!);
  return { from: lo, to: hi };
}

// useSearchParams requires a Suspense boundary for static prerendering (next build).
export default function SearchResultsPage() {
  return (
    <Suspense fallback={
      /* §SKELETON-PARITY: каркас повторяет реальную страницу (:350-404) —
         шапка маркетплейса, блок поиска HeroSearch (`search-glass rounded-2xl`,
         ≈120px), заголовок результатов и сетка карточек в
         `mx-auto max-w-[1400px] px-6 py-8`. Прежде здесь была пустая тёмная
         полоса с «…», после загрузки появлялись шапка, поисковик и сетка. */
      <div className="min-h-screen bg-dark">
        {/* Neutral header placeholder: the published header config is fetched
            inside SearchResultsInner. Rendering the default <MarketplaceHeader />
            here flashed the legacy "TravelHub" brand before Navitravel loaded. */}
        <div className="h-[88px] border-b border-dark-border/60 bg-dark" aria-hidden="true" />
        <main className="mx-auto max-w-[1400px] px-6 py-8">
          <div className="mb-6 h-[120px] animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          <div className="mb-4 h-7 w-56 animate-pulse rounded bg-white/10" />
          <div className="mt-6">
            <ProductGridSkeleton count={6} />
          </div>
        </main>
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

  // Ссылки услуги «Отели» приходят как ?category=hotels — показываем форму
  // поиска отелей (без явного ?service=).
  const service = (
    searchParams.get("service") ||
    (searchParams.get("category") === "hotels" ? "hotels" : "tours")
  ) as ServiceType;
  const isValidService = VALID_SERVICES.includes(service);
  // Включённые услуги — из конфига workspace (page-builder → «Поиск»).
  // Пока конфиг грузится/недоступен, работает дефолт: tours/hotels/flights.
  const { page: constructorPage, loading: constructorLoading } = useConstructorPublished("marketplace-home");
  const { enabled: enabledServices, defaultService: configDefaultService } = resolveSearchServices(
    (constructorPage?.searchConfig ?? null) as SearchServicesConfig | null,
  );
  // Canonical brand/logo come from the same published marketplace config as the
  // home page. Passing it to the header keeps "Navitravel" on search results;
  // without it MarketplaceHeader fell back to the legacy "TravelHub" default.
  const headerConfig = (constructorPage?.headerConfig ?? null) as MarketplaceHeaderConfig | null;
  const brandName = constructorPage ? resolveBrandName(headerConfig) : "";
  // Услуга выключена в workspace (например, railway): поставщиков у неё нет,
  // поэтому результатов не будет — страница отвечает текстом
  // search.service_unavailable вместо формы выдачи.
  const serviceEnabled = enabledServices.includes(service);
  // Вкладка формы, которую пользователь выбрал, но ещё не применил кнопкой
  // поиска: при переключении вкладок URL не меняется (HeroSearch.onTabChange),
  // поэтому результаты прошлой услуги скрываем, пока поиск не нажат.
  const [formService, setFormService] = useState<string | null>(null);
  const showResults = !formService || formService === service;
  // Показываем выдачу только для включённой услуги (см. serviceEnabled).
  const resultsVisible = showResults && serviceEnabled;
  // Услуга в URL сменилась (переход или новый поиск) — «неприменённая» вкладка
  // больше ничему не противоречит.
  useEffect(() => {
    setFormService(null);
  }, [service]);
  const q = searchParams.get("q") || "";
  const sort = searchParams.get("sort") || "newest";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const params = parseParams(searchParams);
  const nightsRange = parseNightsRange(params);
  // Departure range upper bound + hotel star categories from the URL.
  const endDate = params.end || undefined;
  const hotelStars = params.hotelStars
    ? params.hotelStars.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  const suppliersFilter = params.suppliers
    ? params.suppliers.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  // Universal live search (§1): results come from supplier live availability
  // at search time, NOT the static catalog — tours (Summer + KOMPAS) and
  // hotels (ANEX hotels) share this path.
  const liveMode = (service === "tours" || service === "hotels") && searchParams.get("live") === "1";
  // Поиск «Отелей» без live=1 идёт в каталог (категория accommodation) —
  // импортированные Product(type=HOTEL) показываются как обычные карточки.
  const [liveResult, setLiveResult] = useState<AggregatedSearchResult | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  // null = still resolving the supplier set for this direction; [] = resolved
  // to none (or resolution failed); string[] = suppliers that will be queried.
  const [resolvedSuppliers, setResolvedSuppliers] = useState<string[] | null>(null);
  const [searchId, setSearchId] = useState("");
  // Departure city of the active live search — threaded to the offer card so
  // the request re-check/create contract carries the full geography context.
  const [liveDepartureCity, setLiveDepartureCity] = useState<string | undefined>(undefined);

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

    // Услуга выключена в конфиге поиска (workspace → page-builder → «Поиск»):
    // к поставщикам не обращаемся вообще, страница покажет ответ
    // «нет поставщиков, предоставляющих услугу» (см. serviceEnabled).
    if (!serviceEnabled) {
      setLoading(false);
      setResult(null);
      setLiveResult(null);
      setFlightResults(null);
      return () => { alive = false; };
    }

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
      // F1 (owner-confirmed CARRY CHILD AGES): the flight composition carries
      // the child ages as transport data — parsed from the URL the search form
      // already writes (HeroSearch/CompactSearch `childAges=…`).
      const childAges = params.childAges
        ? params.childAges.split(",").map(Number).filter((n) => !Number.isNaN(n))
        : undefined;
      const returnDate = params.returnDate || params.return || undefined;
      const tariff = params.tariff || "ALL";
      const supplier = params.supplier || "ALL";
      const direct = params.direct === "1" || params.direct === "true";
      const dedupKey = `${from}-${to}-${departureDate}-${tripType}-${adults}-${children}-${infants}-${childAges?.join(",") ?? ""}-${returnDate}-${tariff}-${supplier}-${direct ? "direct" : "all"}-${params._t ?? ""}`;
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
            ...(childAges && childAges.length ? { childAges: childAges.slice(0, children) } : {}),
          },
          ...(returnDate ? { returnDate } : {}),
          ...(supplier !== "ALL" ? { supplier } : {}),
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
          if (direct) {
            flights = flights.filter((f: any) => {
              const segs = f.segments ?? [];
              if (f.optionId?.endsWith("_RT")) return segs.length <= 2;
              return segs.length <= 1;
            });
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

    // Universal live search path (§3/§12): tours → Summer + KOMPAS +
    // ANEX in parallel, hotels → ANEX hotels.
    if (liveMode) {
      const sid = `SRCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      setSearchId(sid);
      setLiveLoading(true);
      setResolvedSuppliers(null);
      const liveQuery = {
        service,
        // Корреляция с серверными логами [SEARCH <sid>]: start/done/дедлайн
        // в агрегаторе и clientClosed в контроллере — тот же id, что в UI.
        requestId: sid,
        destination: params.to || undefined,
        country: params.geoCountry || undefined,
        geoCity: params.geoCity || undefined,
        geoResort: params.geoResort || undefined,
        departureCity: params.from || undefined,
        departureDateFrom: params.start || params.checkIn || undefined,
        // departureDateTo is a TOURS range bound — the hotels search takes an
        // exact check-in + nights (adapter derives checkOut itself).
        departureDateTo: service === "tours" ? endDate || params.start || undefined : undefined,
        nightsFrom: nightsRange.from,
        nightsTo: nightsRange.to,
        hotelStars,
        suppliers: suppliersFilter,
        adults: params.adults ? Number(params.adults) : 2,
        children: params.children ? Number(params.children) : 0,
        childAges: params.childAges ? params.childAges.split(",").map(Number) : undefined,
        hotel: params.hotel || undefined,
        meal: params.meal || undefined,
      };
      setLiveDepartureCity(liveQuery.departureCity);
      // Fast, search-free resolution of "who will answer this direction" — it
      // drives the loading states (Определяем поставщиков… → Найдены
      // поставщики: …) while the real search runs in parallel below.
      searchSupplierResolve(liveQuery)
        .then((r) => {
          if (alive) setResolvedSuppliers(r.suppliers ?? []);
        })
        .catch(() => {
          if (alive) setResolvedSuppliers([]);
        });
      searchSupplierOffersAll(liveQuery)
        .then((r) => {
          if (!alive) return;
          setLiveResult(r);
          setLiveLoading(false);
          setLoading(false);
        })
        .catch((e) => {
          if (!alive) return;
          // Surface the failure instead of rendering it as "no offers found" —
          // a dead request and a genuinely empty result must not look alike.
          setError(
            e instanceof Error && e.message
              ? e.message
              : "Failed to load live offers. Please try again.",
          );
          setLiveResult(null);
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
    // locale НЕ в зависимостях: смена языка — это только перерисовка UI (t(...)),
    // к запросам к поставщикам она не относится (язык в API не передаётся).
    // Раньше locale здесь перезапускал поиск заново при каждом переключении языка.
  }, [service, q, sort, page, JSON.stringify(params), liveMode, serviceEnabled]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / 12)) : 1;

  const updatePage = (newPage: number) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", String(newPage));
    router.push(`/search?${sp.toString()}`);
  };

  return (
    <div className="min-h-screen bg-dark">
      {constructorLoading ? (
        <div className="h-[88px] border-b border-dark-border/60 bg-dark" aria-hidden="true" />
      ) : (
        <MarketplaceHeader config={headerConfig} />
      )}
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        {/* Универсальный поисковик — тот же HeroSearch (вкладки услуг), что и
            на главной; активна вкладка текущего поиска, чтобы параметры можно
            было поменять прямо со страницы результатов. */}
        <div className="mb-6">
          <HeroSearch
            enabledServices={enabledServices}
            defaultService={isValidService && serviceEnabled ? service : configDefaultService}
            onTabChange={setFormService}
          />
        </div>

        {/* Услуга выключена в workspace (нет поставщиков) — отвечаем явно и
            ничего не запрашиваем (см. serviceEnabled / early return в эффекте). */}
        {!serviceEnabled && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-[15px] text-neutral-300">
            {t("search.service_unavailable", locale)}
          </div>
        )}

        {/* Universal live search results — table (§6).
            showResults: пока вкладка формы не применена кнопкой поиска,
            результаты прошлой услуги не показываем (см. formService выше). */}
        {resultsVisible && liveMode && (
          <div className="mt-6">
            <h1 className="mb-3 font-serif text-xl font-semibold text-white sm:text-2xl">
              {service === "hotels"
                ? t("search.results_title", locale)
                : t("tourSearch.results_title", locale)}
            </h1>
            <TourResultsTable
              result={liveResult}
              searchId={searchId}
              loading={loading || liveLoading}
              error={error}
              resolvedSuppliers={resolvedSuppliers}
              departureCity={liveDepartureCity}
            />
          </div>
        )}

        {/* Results header — catalog/flights only; in live mode the table
            already renders the single «Результаты поиска» heading above. */}
        {resultsVisible && !liveMode && (
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
        )}

        {/* Loading */}
        {resultsVisible && loading && service !== "flights" && !liveMode && (
          <div className="mt-6">
            <ProductGridSkeleton count={6} />
          </div>
        )}

        {/* AZAL flight results */}
        {resultsVisible && service === "flights" && (
          <div className="mt-6">
            <FlightResults
              flights={flightResults?.flights ?? []}
              loading={flightLoading || loading}
              error={flightError}
            />
          </div>
        )}

        {/* Catalog error (live-mode errors render inside TourResultsTable) */}
        {resultsVisible && error && !liveMode && (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Catalog results — hidden in live mode */}
        {resultsVisible && !liveMode && service !== "flights" && !loading && !error && result && (
          <>
            {result.items.length === 0 ? (
              <div className="mt-12 text-center">
                <>
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
                          nights: nightsRange.from,
                          nightsFrom: nightsRange.from,
                          nightsTo: nightsRange.to,
                          adults: params.adults ? Number(params.adults) : undefined,
                          children: params.children ? Number(params.children) : undefined,
                          hotelId: params.hotelId,
                          cityName: params.city,
                        } as SearchContext}
                      />
                    </div>
                  </>
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
          {brandName
            ? `© ${new Date().getFullYear()} ${brandName}. ${t("footer.rights_reserved", locale)}`
            : ""}
        </div>
      </footer>
    </div>
  );
}
