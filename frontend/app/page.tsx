"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PublicLayout from "@/components/PublicLayout";
import ProductCard from "@/components/public/ProductCard";
import { PublicEmptyState, PublicErrorState } from "@/components/public/PublicStates";
import { ProductGridSkeleton } from "@/components/public/Skeletons";
import { t, useLocale } from "@/lib/i18n";
import { fireMarketplaceSearch, useMarketplaceViewed } from "@/lib/behavioral-events";
import { publicApi, type PublicCategory, type PublicListResult } from "@/lib/public-api";

/**
 * PHASE 1 STEP 1.7 §3 — Marketplace Home `/`.
 * Структура: Hero/Search → Service Categories → Published services (нейтральный
 * newest-блок; curated/popular отсутствуют — секции не выдумываем) → Trust.
 * Только Public Catalog API (§21). НЕ внутренний Dashboard.
 */
export default function MarketplacePage() {
  const router = useRouter();
  const locale = useLocale();
  const [categories, setCategories] = useState<PublicCategory[] | null>(null);
  const [products, setProducts] = useState<PublicListResult | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    let alive = true;
    void Promise.all([publicApi.listCategories(), publicApi.listProducts({ pageSize: 6 })])
      .then(([cats, list]) => {
        if (!alive) return;
        setCategories(cats);
        setProducts(list);
      })
      .catch((e) => {
        if (alive) setError((e as Error).message);
      });
    return () => {
      alive = false;
    };
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    // Step 1.13B: committed search (НЕ keystroke) — durable behavioral event.
    fireMarketplaceSearch(query, category || undefined);
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (category) sp.set("category", category);
    const qs = sp.toString();
    router.push(`/search${qs ? `?${qs}` : ""}`);
  };

  // Step 1.13B: home реально открыта (client render, fire-once; не SSR/prefetch).
  useMarketplaceViewed(true);

  return (
    <PublicLayout>
      {/* Hero + universal search (Что/куда + категория) */}
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">{t("home.hero_title", locale)}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-blue-100">{t("home.hero_subtitle", locale)}</p>

          <form onSubmit={submit} role="search" className="mx-auto mt-8 flex max-w-2xl flex-col gap-2 sm:flex-row">
            <label htmlFor="home-q" className="sr-only">
              {t("home.hero_search_placeholder", locale)}
            </label>
            <input
              id="home-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("home.hero_search_placeholder", locale)}
              className="w-full flex-1 rounded-lg px-4 py-2.5 text-sm text-slate-900 outline-none"
            />
            <label htmlFor="home-category" className="sr-only">
              {t("home.categories_title", locale)}
            </label>
            <select
              id="home-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
            >
              <option value="">{t("search.category_all", locale)}</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.title}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-white/15 px-5 py-2.5 text-sm font-medium backdrop-blur transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
            >
              {t("home.hero_find", locale)}
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {error && <PublicErrorState message={error} />}

        {/* Service Categories */}
        <section className="mb-10" aria-labelledby="home-categories">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="home-categories" className="text-lg font-bold text-slate-900">
              {t("home.categories_title", locale)}
            </h2>
            <Link href="/search" className="text-sm text-blue-600 hover:underline">
              {t("home.categories_all", locale)} →
            </Link>
          </div>
          {categories === null ? (
            <div className="h-10 animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />
          ) : categories.length === 0 ? (
            <PublicEmptyState text={t("state.loading", locale)} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/categories/${c.slug}`}
                  className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-500"
                >
                  {c.title}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Published services (нейтральный newest-блок — curated-секции нет) */}
        <section aria-labelledby="home-published">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="home-published" className="text-lg font-bold text-slate-900">
              {t("home.published_title", locale)}
            </h2>
            <Link href="/search" className="text-sm text-blue-600 hover:underline">
              {t("home.published_all", locale)} →
            </Link>
          </div>
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
        </section>

        {/* Trust / value section (без выдуманных данных) */}
        <section className="mt-14" aria-labelledby="home-trust">
          <h2 id="home-trust" className="text-lg font-bold text-slate-900">
            {t("home.trust_title", locale)}
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-2xl">✅</div>
            <h3 className="mt-2 font-semibold text-slate-900">
              {t("home.trust_1_title", locale)}
            </h3>
            <p className="mt-1 text-xs text-slate-500">{t("home.trust_1_text", locale)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-2xl">💳</div>
            <h3 className="mt-2 font-semibold text-slate-900">{t("home.trust_2_title", locale)}</h3>
            <p className="mt-1 text-xs text-slate-500">{t("home.trust_2_text", locale)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-2xl">🌍</div>
            <h3 className="mt-2 font-semibold text-slate-900">{t("home.trust_3_title", locale)}</h3>
            <p className="mt-1 text-xs text-slate-500">{t("home.trust_3_text", locale)}</p>
          </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
