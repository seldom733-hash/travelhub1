"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ProductCard from "@/components/public/ProductCard";
import CategoryFilters from "@/components/public/CategoryFilters";
import Pagination from "@/components/public/Pagination";
import { PublicEmptyState, PublicErrorState } from "@/components/public/PublicStates";
import { ProductGridSkeleton } from "@/components/public/Skeletons";
import { formatNumber, t, useLocale } from "@/lib/i18n";
import { fireMarketplaceFilter, fireMarketplaceSearch, fireMarketplaceSort } from "@/lib/behavioral-events";
import { publicApi, type PublicCategory, type PublicFilterMetadata, type PublicListResult } from "@/lib/public-api";

/**
 * PHASE 1 STEP 1.7 §9 — client-часть Search Results.
 * Состояние — props (server прочитал searchParams): q, category, sort, page,
 * availableFrom, initialFilters (f[key]=value). Любое изменение → router.replace
 * с новым URL → server отдаёт новые props → эффекты перезапрашивают public API.
 * Фильтры строятся динамически из filter metadata выбранной категории (§10).
 */
export interface SearchResultsProps {
  q: string;
  category: string;
  sort: string;
  page: number;
  availableFrom: string;
  initialFilters: Record<string, string>;
}

const PAGE_SIZE = 12;

export default function SearchResults({ q, category, sort, page, availableFrom, initialFilters }: SearchResultsProps) {
  const router = useRouter();
  const locale = useLocale();
  const filters = initialFilters;

  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [meta, setMeta] = useState<PublicFilterMetadata | null>(null);
  const [result, setResult] = useState<PublicListResult | null>(null);
  const [error, setError] = useState("");
  const [qInput, setQInput] = useState(q);

  useEffect(() => setQInput(q), [q]);

  // Категории — из public API (один раз).
  useEffect(() => {
    let alive = true;
    void publicApi
      .listCategories()
      .then((c) => {
        if (alive) setCategories(c);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Filter metadata выбранной категории (для category-specific фильтров).
  useEffect(() => {
    let alive = true;
    setMeta(null);
    if (!category) return undefined;
    void publicApi
      .getCategoryFilters(category)
      .then((m) => {
        if (alive) setMeta(m);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [category]);

  // Результаты — server-side public API.
  useEffect(() => {
    let alive = true;
    setError("");
    setResult(null);
    void publicApi
      .listProducts({
        q: q || undefined,
        category: category || undefined,
        sort,
        page,
        pageSize: PAGE_SIZE,
        available_from: availableFrom || undefined,
        f: Object.keys(filters).length > 0 ? filters : undefined,
      })
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
  }, [q, category, sort, page, availableFrom, JSON.stringify(filters)]);

  /** Обновляет URL — состояние живёт в URL (server-props), не в памяти. */
  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (category) next.set("category", category);
    if (sort) next.set("sort", sort);
    if (page > 1) next.set("page", String(page));
    if (availableFrom) next.set("available_from", availableFrom);
    for (const [k, v] of Object.entries(filters)) next.set(`f[${k}]`, v);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(`/search${qs ? `?${qs}` : ""}`);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // Step 1.13B: committed search (НЕ keystroke) — durable behavioral event.
    fireMarketplaceSearch(qInput.trim(), category || undefined);
    update({ q: qInput.trim() || undefined, page: undefined });
  };

  const onFilters = (next: Record<string, string>) => {
    // Step 1.13B: фильтры применяются пачкой (Apply) — события по каждому ключу
    // (whitelist key/value, без DOM-дампов); сервер резолвит категорию.
    if (category) {
      for (const [k, v] of Object.entries(next)) fireMarketplaceFilter(category, k, v);
    }
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (category) sp.set("category", category);
    if (sort) sp.set("sort", sort);
    if (availableFrom) sp.set("available_from", availableFrom);
    for (const [k, v] of Object.entries(next)) sp.set(`f[${k}]`, v);
    const qs = sp.toString();
    router.replace(`/search${qs ? `?${qs}` : ""}`);
  };

  const onSort = (value: string) => {
    // Step 1.13B: сортировка из whitelist (newest/price_asc/price_desc).
    fireMarketplaceSort(value);
    update({ sort: value });
  };

  const dateRequired = meta?.availability?.dateRequired === true;
  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">{t("search.title", locale)}</h1>

      {/* Search form */}
      <form onSubmit={submit} role="search" className="mt-4 flex max-w-2xl gap-2">
        <label htmlFor="search-q" className="sr-only">
          {t("search.placeholder", locale)}
        </label>
        <input
          id="search-q"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder={t("search.placeholder", locale)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          {t("search.submit", locale)}
        </button>
      </form>

      {/* Toolbar: category + sort + date */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <label htmlFor="search-category" className="sr-only">
          {t("search.category_all", locale)}
        </label>
        <select
          id="search-category"
          value={category}
          onChange={(e) => update({ category: e.target.value || undefined, page: undefined })}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 outline-none focus:border-blue-400"
        >
          <option value="">{t("search.category_all", locale)}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.title}
            </option>
          ))}
        </select>

        <label htmlFor="search-sort" className="sr-only">
          {t("sort.label", locale)}
        </label>
        <select
          id="search-sort"
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 outline-none focus:border-blue-400"
        >
          <option value="newest">{t("sort.newest", locale)}</option>
          <option value="price_asc">{t("sort.price_asc", locale)}</option>
          <option value="price_desc">{t("sort.price_desc", locale)}</option>
        </select>

        {dateRequired && (
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

        <span className="text-xs text-slate-400" aria-live="polite">
          {result ? `${t("search.found", locale)}: ${formatNumber(result.total, locale)}` : "…"}
        </span>
      </div>

      {error && (
        <div className="mt-4">
          <PublicErrorState message={error} />
        </div>
      )}
      {result === null && !error && (
        <div className="mt-6">
          <ProductGridSkeleton count={6} />
        </div>
      )}

      {/* Results + filters */}
      {result && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            {category && meta ? (
              <CategoryFilters meta={meta} applied={filters} onChange={onFilters} />
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-400">
                {t("filters.no_filters", locale)}
              </div>
            )}
          </aside>

          <div>
            {result.items.length === 0 ? (
              <PublicEmptyState text={t("search.empty", locale)} />
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
      )}
    </div>
  );
}
