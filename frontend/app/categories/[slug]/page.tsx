"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import PublicLayout from "@/components/PublicLayout";
import ProductCard from "@/components/public/ProductCard";
import CategoryFilters from "@/components/public/CategoryFilters";
import Pagination from "@/components/public/Pagination";
import { PublicEmptyState, PublicErrorState, PublicNotFound } from "@/components/public/PublicStates";
import { ProductGridSkeleton } from "@/components/public/Skeletons";
import { formatNumber, t, useLocale } from "@/lib/i18n";
import { fireMarketplaceFilter, fireMarketplaceSort, useMarketplaceCategoryViewed } from "@/lib/behavioral-events";
import { publicApi, PublicNotFoundError, type PublicCategory, type PublicFilterMetadata, type PublicListResult } from "@/lib/public-api";

/**
 * PHASE 1 STEP 1.7 §11 — Category page `/categories/:slug`.
 * Категория + filter metadata (ACTIVE Category Schema — не хардкод) + server-side
 * список. Фильтры/сортировка/страница сериализуются в URL. Public API only.
 * force-dynamic: см. /search — Next 16 обрезает search-параметры при client-side
 * router.replace на статически пререндеренных страницах.
 */
export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

function CategoryInner() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const slug = params?.slug ?? "";

  const sort = searchParams.get("sort") ?? "newest";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const availableFrom = searchParams.get("available_from") ?? "";
  const f: Record<string, string> = {};
  searchParams.forEach((v, k) => {
    const m = /^f\[(.+)\]$/.exec(k);
    if (m && v) f[m[1]] = v;
  });

  const [category, setCategory] = useState<PublicCategory | null>(null);
  const [meta, setMeta] = useState<PublicFilterMetadata | null>(null);
  const [result, setResult] = useState<PublicListResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setCategory(null);
    setMeta(null);
    setResult(null);
    setNotFound(false);
    setError("");
    void Promise.all([publicApi.getCategory(slug), publicApi.getCategoryFilters(slug)])
      .then(([cat, m]) => {
        if (!alive) return;
        setCategory(cat);
        setMeta(m);
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof PublicNotFoundError) setNotFound(true);
        else setError((e as Error).message);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    let alive = true;
    setResult(null);
    setError("");
    void publicApi
      .listProducts({ category: slug, sort, page, pageSize: PAGE_SIZE, available_from: availableFrom || undefined, f: Object.keys(f).length ? f : undefined })
      .then((r) => {
        if (alive) setResult(r);
      })
      .catch((e) => {
        if (alive) setError((e as Error).message);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, sort, page, availableFrom, JSON.stringify(f)]);

  const update = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    if (sort) sp.set("sort", sort);
    if (page > 1) sp.set("page", String(page));
    if (availableFrom) sp.set("available_from", availableFrom);
    for (const [k, v] of Object.entries(f)) sp.set(`f[${k}]`, v);
    for (const [k, v] of Object.entries(patch)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    router.replace(`/categories/${slug}${sp.toString() ? `?${sp.toString()}` : ""}`);
  };

  const onFilters = (next: Record<string, string>) => {
    // Step 1.13B: фильтры применяются пачкой (Apply) — событие по каждому ключу.
    for (const [k, v] of Object.entries(next)) fireMarketplaceFilter(slug, k, v);
    update({ page: undefined, ...Object.fromEntries(Object.entries(next).map(([k, v]) => [`f[${k}]`, v])) });
  };

  const onSort = (value: string) => {
    // Step 1.13B: сортировка из whitelist.
    fireMarketplaceSort(value);
    update({ sort: value, page: undefined });
  };

  // Step 1.13B: category surface реально открыта (после успешной загрузки,
  // fire-once; не для notFound/error).
  useMarketplaceCategoryViewed(slug, category !== null);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  if (notFound) {
    return (
      <PublicLayout>
        <PublicNotFound title={t("category.not_found_title", locale)} hint={t("category.not_found_hint", locale)} />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-8">
        {error && <PublicErrorState message={error} />}
        {category === null && !error && !notFound && <ProductGridSkeleton count={6} />}
        {category && (
          <>
            {/* Breadcrumb */}
            <nav className="text-xs text-slate-400" aria-label="breadcrumb">
              <Link href="/" className="hover:text-blue-600 hover:underline">
                {t("pdp.breadcrumb_home", locale)}
              </Link>
              <span className="mx-1.5">/</span>
              <span className="text-slate-600">{category.title}</span>
            </nav>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{category.title}</h1>
            {result && (
              <p className="mt-1 text-xs text-slate-400">
                {formatNumber(result.total, locale)} {t("category.services_count", locale)}
              </p>
            )}

            {/* Toolbar: sort + date (если категория требует) */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <label htmlFor="cat-sort" className="sr-only">
                {t("sort.label", locale)}
              </label>
              <select
                id="cat-sort"
                value={sort}
                onChange={(e) => onSort(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 outline-none focus:border-blue-400"
              >
                <option value="newest">{t("sort.newest", locale)}</option>
                <option value="price_asc">{t("sort.price_asc", locale)}</option>
                <option value="price_desc">{t("sort.price_desc", locale)}</option>
              </select>
              {meta?.availability?.dateRequired && (
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  {t("search.available_from", locale)}
                  <input
                    type="date"
                    value={availableFrom}
                    onChange={(e) => update({ available_from: e.target.value || undefined })}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-400"
                  />
                </label>
              )}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
              <aside className="lg:sticky lg:top-20 lg:self-start">
                {meta && meta.filters.length > 0 ? (
                  <CategoryFilters meta={meta} applied={f} onChange={onFilters} />
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-400">
                    {t("filters.no_filters", locale)}
                  </div>
                )}
              </aside>

              <div>
                {result === null ? (
                  <ProductGridSkeleton count={6} />
                ) : result.items.length === 0 ? (
                  <PublicEmptyState text={t("category.empty", locale)} />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {result.items.map((c, i) => (
                      <ProductCard key={c.id} card={c} position={i} />
                    ))}
                  </div>
                )}
                <Pagination page={page} totalPages={totalPages} onChange={(p) => update({ page: String(p) })} />
              </div>
            </div>

            <div className="mt-8">
              <Link href="/search" className="text-sm text-blue-600 hover:underline">
                ← {t("category.back_all", locale)}
              </Link>
            </div>
          </>
        )}
      </div>
    </PublicLayout>
  );
}

export default function CategoryPage() {
  return (
    <Suspense
      fallback={
        <PublicLayout>
          <div className="p-8">
            <ProductGridSkeleton count={6} />
          </div>
        </PublicLayout>
      }
    >
      <CategoryInner />
    </Suspense>
  );
}
