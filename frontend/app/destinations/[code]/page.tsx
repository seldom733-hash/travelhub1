"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Buildings, MapPin } from "@phosphor-icons/react";
import MarketplaceHeader, { resolveBrandName, type MarketplaceHeaderConfig } from "@/components/marketplace/MarketplaceHeader";
import MarketplaceFooter from "@/components/marketplace/MarketplaceFooter";
import ProductCard from "@/components/public/ProductCard";
import { useConstructorPublished } from "@/lib/use-constructor-published";
import { useLocale } from "@/lib/i18n";
import { publicApi, type PublicDestination, type PublicListResult } from "@/lib/public-api";
import { countryFlagUrl, destinationLabel } from "@/lib/destinations";

const COPY = {
  ru: { back: "Все направления", tours: "Туры", hotels: "Отели", emptyTours: "Для этой страны пока нет опубликованных туров.", emptyHotels: "Для этой страны пока нет опубликованных отелей.", notFound: "Направление не найдено.", error: "Не удалось загрузить предложения.", more: "Показать ещё", shown: "Показано" },
  az: { back: "Bütün istiqamətlər", tours: "Turlar", hotels: "Otellər", emptyTours: "Bu ölkə üçün hələ dərc edilmiş tur yoxdur.", emptyHotels: "Bu ölkə üçün hələ dərc edilmiş otel yoxdur.", notFound: "İstiqamət tapılmadı.", error: "Təklifləri yükləmək alınmadı.", more: "Daha çox göstər", shown: "Göstərildi" },
  en: { back: "All destinations", tours: "Tours", hotels: "Hotels", emptyTours: "No published tours for this country yet.", emptyHotels: "No published hotels for this country yet.", notFound: "Destination not found.", error: "Could not load offers.", more: "Show more", shown: "Showing" },
} as const;

const PAGE_SIZE = 48;

type Tab = "tours" | "hotels";

export default function DestinationCountryPage() {
  const params = useParams<{ code: string }>();
  const code = String(params.code ?? "").toUpperCase();
  const locale = useLocale();
  const copy = COPY[locale as keyof typeof COPY] ?? COPY.ru;
  const { page } = useConstructorPublished("marketplace-home");
  const [destination, setDestination] = useState<PublicDestination | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("tours");
  const [result, setResult] = useState<PublicListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState("");

  const headerConfig = (page?.headerConfig ?? null) as MarketplaceHeaderConfig | null;
  const brandName = page ? resolveBrandName(headerConfig) : "";
  const name = useMemo(() => destination ? destinationLabel(destination, locale) : code, [destination, locale, code]);

  useEffect(() => {
    let alive = true;
    publicApi.listDestinations()
      .then((items) => {
        if (!alive) return;
        setDestination(items.find((item) => item.code === code) ?? null);
      })
      .catch(() => { if (alive) setDestination(null); });
    return () => { alive = false; };
  }, [code]);

  useEffect(() => {
    if (destination && destination.tours === 0 && destination.hotels > 0) {
      setTab("hotels");
    }
  }, [destination]);

  useEffect(() => {
    if (destination === undefined || destination === null) return;
    let alive = true;
    setLoading(true);
    setLoadingMore(false);
    setPageNumber(1);
    setError("");
    setResult(null);
    publicApi.listProducts({ category: tab === "tours" ? "tours" : "accommodation", geoCountry: code, sort: "price_asc", page: 1, pageSize: PAGE_SIZE })
      .then((data) => { if (alive) setResult(data); })
      .catch((e) => { if (alive) setError((e as Error).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [code, tab, destination]);

  const loadMore = async () => {
    if (!result || loadingMore || result.items.length >= result.total) return;
    setLoadingMore(true);
    setError("");
    try {
      const nextPage = pageNumber + 1;
      const data = await publicApi.listProducts({
        category: tab === "tours" ? "tours" : "accommodation",
        geoCountry: code,
        sort: "price_asc",
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      setResult((previous) => previous
        ? { ...data, items: [...previous.items, ...data.items] }
        : data);
      setPageNumber(nextPage);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark">
      <MarketplaceHeader config={headerConfig} />
      <main className="mx-auto max-w-[1200px] px-6 py-10">
        <Link href="/destinations" className="inline-flex items-center gap-2 text-xs text-neutral-400 hover:text-gold">
          <ArrowLeft size={14} /> {copy.back}
        </Link>

        {destination === undefined && <div className="mt-8 h-28 animate-pulse rounded-2xl bg-white/5" />}
        {destination === null && <div className="mt-8 rounded-2xl border border-dark-border bg-dark-surface p-8 text-sm text-neutral-400">{copy.notFound}</div>}

        {destination && (
          <>
            <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={countryFlagUrl(destination.code)} alt="" className="h-14 w-20 rounded-lg object-cover shadow-sm" />
                <div>
                  <h1 className="text-3xl font-bold text-white">{name}</h1>
                  <p className="mt-1 text-sm text-neutral-400">{destination.tours} {copy.tours.toLowerCase()} · {destination.hotels} {copy.hotels.toLowerCase()}</p>
                </div>
              </div>
              <div className="inline-flex rounded-xl border border-dark-border bg-dark-surface p-1" role="tablist" aria-label={`${copy.tours}/${copy.hotels}`}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "tours"}
                  onClick={() => setTab("tours")}
                  className={`flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${tab === "tours" ? "bg-gold text-dark" : "text-neutral-400 hover:text-white"}`}
                >
                  <MapPin size={15} /> {copy.tours}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "hotels"}
                  onClick={() => setTab("hotels")}
                  className={`flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${tab === "hotels" ? "bg-gold text-dark" : "text-neutral-400 hover:text-white"}`}
                >
                  <Buildings size={15} /> {copy.hotels}
                </button>
              </div>
            </div>

            <section className="mt-7">
              {error && <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{copy.error}</div>}
              {loading && (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="overflow-hidden rounded-2xl border border-dark-border bg-dark-surface">
                      <div className="aspect-[16/9] animate-pulse bg-white/5" />
                      <div className="space-y-2 p-4">
                        <div className="h-3 w-1/3 animate-pulse rounded bg-white/5" />
                        <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
                        <div className="h-4 w-1/2 animate-pulse rounded bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!loading && result && result.items.length === 0 && (
                <div className="rounded-2xl border border-dark-border bg-dark-surface px-6 py-14 text-center text-sm text-neutral-400">
                  {tab === "tours" ? copy.emptyTours : copy.emptyHotels}
                </div>
              )}
              {!loading && result && result.items.length > 0 && (
                <>
                  <p className="mb-4 text-xs text-neutral-500">
                    {copy.shown}: {result.items.length} / {result.total}
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {result.items.map((card, index) => <ProductCard key={card.id} card={card} position={index} />)}
                  </div>
                  {result.items.length < result.total && (
                    <div className="mt-7 flex justify-center">
                      <button
                        type="button"
                        onClick={() => { void loadMore(); }}
                        disabled={loadingMore}
                        className="rounded-xl border border-gold/40 bg-gold/10 px-5 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-gold/20 disabled:cursor-wait disabled:opacity-60"
                      >
                        {loadingMore ? "…" : `${copy.more} (${Math.min(PAGE_SIZE, result.total - result.items.length)})`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </main>
      <MarketplaceFooter brandName={brandName} headerConfig={headerConfig} config={(page?.footerConfig ?? null) as never} />
    </div>
  );
}
