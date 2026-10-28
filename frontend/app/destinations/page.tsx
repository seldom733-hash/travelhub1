"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, MapTrifold } from "@phosphor-icons/react";
import MarketplaceHeader, { resolveBrandName, type MarketplaceHeaderConfig } from "@/components/marketplace/MarketplaceHeader";
import MarketplaceFooter from "@/components/marketplace/MarketplaceFooter";
import { useConstructorPublished } from "@/lib/use-constructor-published";
import { useLocale } from "@/lib/i18n";
import { publicApi, type PublicDestination } from "@/lib/public-api";
import { countryFlagUrl, destinationLabel } from "@/lib/destinations";

const COPY = {
  ru: { title: "Направления", subtitle: "Страны, куда уже есть опубликованные туры или отели.", tours: "туров", hotels: "отелей", empty: "Пока нет опубликованных направлений.", error: "Не удалось загрузить направления." },
  az: { title: "İstiqamətlər", subtitle: "Dərc edilmiş turlar və ya otellər olan ölkələr.", tours: "tur", hotels: "otel", empty: "Hələ dərc edilmiş istiqamət yoxdur.", error: "İstiqamətləri yükləmək alınmadı." },
  en: { title: "Destinations", subtitle: "Countries with published tours or hotels.", tours: "tours", hotels: "hotels", empty: "No published destinations yet.", error: "Could not load destinations." },
} as const;

export default function DestinationsPage() {
  const locale = useLocale();
  const copy = COPY[locale as keyof typeof COPY] ?? COPY.ru;
  const { page } = useConstructorPublished("marketplace-home");
  const [destinations, setDestinations] = useState<PublicDestination[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    publicApi.listDestinations()
      .then((items) => { if (alive) setDestinations(items); })
      .catch((e) => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, []);

  const headerConfig = (page?.headerConfig ?? null) as MarketplaceHeaderConfig | null;
  const brandName = page ? resolveBrandName(headerConfig) : "";

  return (
    <div className="min-h-screen bg-dark">
      <MarketplaceHeader config={headerConfig} />
      <main className="mx-auto max-w-[1200px] px-6 py-12">
        <div className="mb-8 flex items-start gap-3">
          <span className="mt-1 rounded-xl bg-gold/10 p-2 text-gold"><MapTrifold size={26} /></span>
          <div>
            <h1 className="text-3xl font-bold text-white">{copy.title}</h1>
            <p className="mt-1 text-sm text-neutral-400">{copy.subtitle}</p>
          </div>
        </div>

        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{copy.error}</div>}
        {!destinations && !error && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/5" />)}
          </div>
        )}
        {destinations && destinations.length === 0 && (
          <div className="rounded-2xl border border-dark-border bg-dark-surface px-6 py-12 text-center text-sm text-neutral-400">{copy.empty}</div>
        )}
        {destinations && destinations.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.map((destination) => (
              <Link
                key={destination.code}
                href={`/destinations/${destination.code}`}
                className="group rounded-2xl border border-dark-border bg-dark-surface p-5 transition-all hover:-translate-y-0.5 hover:border-gold/40 hover:bg-white/[0.04]"
              >
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={countryFlagUrl(destination.code)} alt="" loading="lazy" className="h-8 w-12 rounded object-cover shadow-sm" />
                  <div className="min-w-0">
                    <div className="truncate text-lg font-semibold text-white">{destinationLabel(destination, locale)}</div>
                    <div className="text-xs text-neutral-500">{destination.code}</div>
                  </div>
                  <ArrowRight size={18} className="ml-auto text-neutral-500 transition-transform group-hover:translate-x-1 group-hover:text-gold" />
                </div>
                <div className="mt-4 flex gap-2 text-xs">
                  <span className="rounded-full bg-gold/10 px-2.5 py-1 text-gold">{destination.tours} {copy.tours}</span>
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-neutral-300">{destination.hotels} {copy.hotels}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <MarketplaceFooter brandName={brandName} headerConfig={headerConfig} config={(page?.footerConfig ?? null) as never} />
    </div>
  );
}
