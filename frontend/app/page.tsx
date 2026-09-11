"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, CreditCard, Globe } from "@phosphor-icons/react";
import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import HeroSection from "@/components/marketplace/HeroSection";
import PopularDestinations from "@/components/marketplace/PopularDestinations";
import ProductCard from "@/components/public/ProductCard";
import { PublicEmptyState, PublicErrorState } from "@/components/public/PublicStates";
import { ProductGridSkeleton } from "@/components/public/Skeletons";
import { t, useLocale } from "@/lib/i18n";
import { useMarketplaceViewed } from "@/lib/behavioral-events";
import { publicApi, type PublicListResult } from "@/lib/public-api";

export default function MarketplacePage() {
  const locale = useLocale();
  const [products, setProducts] = useState<PublicListResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void publicApi
      .listProducts({ pageSize: 6 })
      .then((list) => {
        if (alive) setProducts(list);
      })
      .catch((e) => {
        if (alive) setError((e as Error).message);
      });
    return () => {
      alive = false;
    };
  }, []);

  useMarketplaceViewed(true);

  return (
    <div className="min-h-screen bg-dark">
      <MarketplaceHeader />
      <main>
        {/* Hero + Search + Quick Categories */}
        <HeroSection />

        {/* Popular Destinations */}
        <PopularDestinations />

        {/* Published Services */}
        <section className="bg-dark-surface py-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h2 className="font-serif text-2xl font-bold text-white sm:text-3xl">
                  {t("marketplace.published_title", locale)}
                </h2>
                <p className="mt-2 text-sm text-neutral-400">
                  {t("marketplace.published_subtitle", locale)}
                </p>
              </div>
              <Link
                href="/search"
                className="hidden items-center gap-1 text-sm text-gold transition-colors hover:text-gold-light sm:flex"
              >
                {t("marketplace.view_all", locale)}
                <ArrowRight size={16} weight="light" />
              </Link>
            </div>

            {error && <PublicErrorState message={error} />}

            {products === null ? (
              <ProductGridSkeleton count={3} />
            ) : products.items.length === 0 ? (
              <PublicEmptyState text={t("home.published_empty", locale)} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.items.map((c, i) => (
                  <ProductCard key={c.id} card={c} position={i} />
                ))}
              </div>
            )}

            <div className="mt-6 text-center sm:hidden">
              <Link
                href="/search"
                className="inline-flex items-center gap-1 text-sm text-gold transition-colors hover:text-gold-light"
              >
                {t("marketplace.view_all", locale)}
                <ArrowRight size={16} weight="light" />
              </Link>
            </div>
          </div>
        </section>

        {/* Trust Section */}
        <section className="bg-dark py-16">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="mb-8 text-center font-serif text-2xl font-bold text-white sm:text-3xl">
              {t("marketplace.why_travelhub", locale)}
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="rounded-2xl border border-dark-border bg-dark-card p-6 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-gold/10 text-gold">
                  <ShieldCheck size={28} weight="light" />
                </div>
                <h3 className="mt-4 font-serif text-lg font-semibold text-white">
                  {t("marketplace.trust_1_title", locale)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  {t("marketplace.trust_1_text", locale)}
                </p>
              </div>
              <div className="rounded-2xl border border-dark-border bg-dark-card p-6 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-gold/10 text-gold">
                  <CreditCard size={28} weight="light" />
                </div>
                <h3 className="mt-4 font-serif text-lg font-semibold text-white">
                  {t("marketplace.trust_2_title", locale)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  {t("marketplace.trust_2_text", locale)}
                </p>
              </div>
              <div className="rounded-2xl border border-dark-border bg-dark-card p-6 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-gold/10 text-gold">
                  <Globe size={28} weight="light" />
                </div>
                <h3 className="mt-4 font-serif text-lg font-semibold text-white">
                  {t("marketplace.trust_3_title", locale)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  {t("marketplace.trust_3_text", locale)}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Partner CTA */}
        <section className="bg-dark-surface py-16">
          <div className="mx-auto max-w-7xl px-4 text-center">
            <h2 className="font-serif text-2xl font-bold text-white sm:text-3xl">
              {t("marketplace.partner_cta_title", locale)}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-neutral-400">
              {t("marketplace.partner_cta_text", locale)}
            </p>
            <Link
              href="/become-a-partner"
              className="btn-gold mt-8 inline-flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold"
            >
              {t("marketplace.partner_cta_button", locale)}
              <ArrowRight size={18} weight="bold" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-border bg-dark py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-neutral-500">
          {t("footer.text", locale)} © {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
