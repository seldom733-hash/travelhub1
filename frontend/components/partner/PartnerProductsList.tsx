"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/lib/i18n";
import { pt } from "@/lib/partner-i18n";
import { partnerApi, type PartnerListSort, type PartnerProductListItem, type PartnerLifecycleFilter } from "@/lib/partner-api";
import { formatDate, formatPrice } from "@/lib/i18n";
import type { PublicCategory } from "@/lib/public-api";

export interface InitialQuery {
  q: string;
  filter: string;
  categoryId: string;
  sort: string;
  page: number;
}

const FILTERS: Array<{ value: PartnerLifecycleFilter | ""; labelKey: string }> = [
  { value: "", labelKey: "partner.filter.all" },
  { value: "draft", labelKey: "partner.filter.draft" },
  { value: "in_moderation", labelKey: "partner.filter.in_moderation" },
  { value: "changes_requested", labelKey: "partner.filter.changes_requested" },
  { value: "published", labelKey: "partner.filter.published" },
  { value: "archived", labelKey: "partner.filter.archived" },
];

const SORTS: Array<{ value: PartnerListSort; labelKey: string }> = [
  { value: "updated_desc", labelKey: "partner.sort.updated_desc" },
  { value: "updated_asc", labelKey: "partner.sort.updated_asc" },
  { value: "created_desc", labelKey: "partner.sort.created_desc" },
  { value: "title_asc", labelKey: "partner.sort.title_asc" },
];

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-700",
  COMPLETE: "bg-brand/15 text-brand-dark",
  REVIEWED: "bg-brand/15 text-brand-dark",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  CHANGED: "bg-orange-100 text-orange-700",
  ARCHIVED: "bg-panel text-ink/60",
};

const MODERATION_BADGE: Record<string, string> = {
  SUBMITTED: "bg-brand/15 text-brand-dark",
  IN_REVIEW: "bg-brand/15 text-brand-dark",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  CHANGES_REQUESTED: "bg-rose-100 text-rose-700",
};

export default function PartnerProductsList({ initial }: { initial: InitialQuery }) {
  const router = useRouter();
  const locale = useLocale();
  const [q, setQ] = useState(initial.q);
  const [draftQ, setDraftQ] = useState(initial.q);
  const [filter, setFilter] = useState<PartnerLifecycleFilter | "">((initial.filter as PartnerLifecycleFilter) || "");
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [sort, setSort] = useState<PartnerListSort>((initial.sort as PartnerListSort) || "updated_desc");
  const [page, setPage] = useState(initial.page);
  const [items, setItems] = useState<PartnerProductListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<PublicCategory[]>([]);

  useEffect(() => {
    let alive = true;
    void partnerApi
      .listCategories()
      .then((c) => {
        if (alive) setCategories(c);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(
    (query: { q: string; filter: PartnerLifecycleFilter | ""; categoryId: string; sort: PartnerListSort; page: number }) => {
      let alive = true;
      setItems(null);
      setError("");
      partnerApi
        .listProducts({
          search: query.q || undefined,
          filter: query.filter || undefined,
          categoryId: query.categoryId || undefined,
          sort: query.sort,
          page: query.page,
          pageSize: 20,
        })
        .then((res) => {
          if (!alive) return;
          setItems(res.items);
          setTotal(res.total);
        })
        .catch((err) => {
          if (alive) setError((err as Error).message);
        });
      return () => {
        alive = false;
      };
    },
    [],
  );

  useEffect(() => {
    const cancel = load({ q, filter, categoryId, sort, page });
    return cancel;
  }, [q, filter, categoryId, sort, page, load]);

  // Shareable URL: обновляем query, сохраняя состояние (pushState через router.replace).
  const syncUrl = useCallback(
    (next: { q: string; filter: PartnerLifecycleFilter | ""; categoryId: string; sort: PartnerListSort; page: number }) => {
      const sp = new URLSearchParams();
      if (next.q) sp.set("q", next.q);
      if (next.filter) sp.set("filter", next.filter);
      if (next.categoryId) sp.set("categoryId", next.categoryId);
      if (next.sort && next.sort !== "updated_desc") sp.set("sort", next.sort);
      if (next.page > 1) sp.set("page", String(next.page));
      const qs = sp.toString();
      router.replace(`/partner/products${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router],
  );

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQ(draftQ);
    setPage(1);
    syncUrl({ q: draftQ, filter, categoryId, sort, page: 1 });
  };

  const changeFilter = (f: PartnerLifecycleFilter | "") => {
    setFilter(f);
    setPage(1);
    syncUrl({ q, filter: f, categoryId, sort, page: 1 });
  };

  const changeCategory = (c: string) => {
    setCategoryId(c);
    setPage(1);
    syncUrl({ q, filter, categoryId: c, sort, page: 1 });
  };

  const changeSort = (s: PartnerListSort) => {
    setSort(s);
    setPage(1);
    syncUrl({ q, filter, categoryId, sort: s, page: 1 });
  };

  const goPage = (p: number) => {
    setPage(p);
    syncUrl({ q, filter, categoryId, sort, page: p });
  };

  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{pt("partner.products.title", locale)}</h1>
          <p className="mt-1 text-sm text-ink/60">{pt("partner.products.subtitle", locale)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/partner/products/new/constructor"
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
          >
            🧳 Конструктор тура
          </Link>
          <Link
            href="/partner/products/new"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            {pt("partner.products.new", locale)}
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <form onSubmit={applySearch} role="search" className="min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="partner-search" className="sr-only">
            {pt("partner.products.search", locale)}
          </label>
          <input
            id="partner-search"
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            placeholder={pt("partner.products.search", locale)}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </form>

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label={pt("partner.filter.all", locale)}>
          {FILTERS.map((f) => (
            <button
              key={f.value || "all"}
              type="button"
              onClick={() => changeFilter(f.value)}
              aria-pressed={filter === f.value}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.value ? "bg-emerald-600 text-white" : "bg-white text-ink/60 border border-line hover:border-emerald-300"
              }`}
            >
              {pt(f.labelKey, locale)}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label className="sr-only" htmlFor="partner-category">
            {pt("partner.product.category", locale)}
          </label>
          <select
            id="partner-category"
            value={categoryId}
            onChange={(e) => changeCategory(e.target.value)}
            className="rounded-lg border border-line bg-white px-2 py-2 text-xs outline-none focus:border-emerald-400"
          >
            <option value="">{pt("partner.product.category", locale)}: {pt("partner.filter.all", locale)}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="partner-sort">
            {pt("partner.sort.label", locale)}
          </label>
          <select
            id="partner-sort"
            value={sort}
            onChange={(e) => changeSort(e.target.value as PartnerListSort)}
            className="rounded-lg border border-line bg-white px-2 py-2 text-xs outline-none focus:border-emerald-400"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {pt(s.labelKey, locale)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-panel text-[11px] uppercase tracking-wide text-ink/60">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">{pt("partner.form.title", locale)}</th>
                <th className="px-4 py-3 font-medium">{pt("partner.product.category", locale)}</th>
                <th className="px-4 py-3 font-medium">{pt("partner.product.status", locale) ?? "Status"}</th>
                <th className="px-4 py-3 font-medium">{pt("partner.moderation.title", locale)}</th>
                <th className="px-4 py-3 font-medium">{pt("partner.product.price_from", locale)}</th>
                <th className="px-4 py-3 font-medium">{pt("partner.product.updated", locale)}</th>
                <th className="px-4 py-3 text-right font-medium">→</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items === null &&
                Array.from({ length: 5 }).map((_, i) => (
                  /* §SKELETON-PARITY: строка повторяет реальную (:288-…): 8 ячеек
                     `px-4 py-3`, превью `size-10` в колонке названия. Раньше была
                     одна полоса `colSpan={8} h-4` — другая высота строки и ритм. */
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-3 w-4 rounded bg-panel" /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-10 shrink-0 rounded-lg bg-panel" />
                        <div className="h-4 w-40 rounded bg-panel" />
                      </div>
                    </td>
                    <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-panel" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-20 rounded-full bg-panel" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-panel" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-panel" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-panel" /></td>
                    <td className="px-4 py-3 text-right"><div className="ml-auto h-4 w-8 rounded bg-panel" /></td>
                  </tr>
                ))}
              {items?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-ink/60">
                    {q || filter || categoryId ? pt("partner.products.no_results", locale) : pt("partner.products.empty", locale)}
                  </td>
                </tr>
              )}
              {items?.map((p, idx) => (
                <tr key={p.id} className="transition-colors hover:bg-panel/70">
                  <td className="px-4 py-3 text-xs text-ink/60">{(page - 1) * pageSize + idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.thumbnail ? (
                        <img
                          src={`/api/v1/public/media/${p.thumbnail.id}/thumb`}
                          alt=""
                          className="size-10 shrink-0 rounded-lg object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-panel text-ink/60">🖼</div>
                      )}
                      <div className="min-w-0">
                        <Link href={`/partner/products/${p.id}`} className="block truncate font-medium text-ink hover:text-emerald-700">
                          {p.title}
                        </Link>
                        <div className="text-[11px] text-ink/60">{p.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink/60">{p.category?.title ?? pt("partner.product.no_category", locale)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[p.status] ?? "bg-panel text-ink/60"}`}>
                      {pt(`partner.status.${p.status}`, locale)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.moderation ? (
                      <div className="flex flex-col items-start gap-0.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${MODERATION_BADGE[p.moderation.status] ?? "bg-panel text-ink/60"}`}>
                          {pt(`partner.moderation.${p.moderation.status}`, locale)}
                        </span>
                        {p.moderation.reasonCode && <span className="text-[10px] text-ink/60">{pt(`partner.reason.${p.moderation.reasonCode}`, locale)}</span>}
                      </div>
                    ) : (
                      <span className="text-xs text-ink/60">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink/60">
                    {formatPrice(p.priceFrom, p.currency, locale) ?? pt("partner.product.price_on_request", locale)}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink/60">{formatDate(p.updatedAt, locale)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1 text-[11px]">
                      <Link href={`/partner/products/${p.id}`} className="rounded-md px-2 py-1 text-ink/60 hover:bg-panel hover:text-ink">
                        {pt("partner.product.view", locale)}
                      </Link>
                      <Link href={`/partner/products/${p.id}/edit`} className="rounded-md px-2 py-1 text-ink/60 hover:bg-panel hover:text-ink">
                        {pt("partner.product.edit", locale)}
                      </Link>
                      <Link href={`/partner/products/${p.id}/moderation`} className="rounded-md px-2 py-1 text-ink/60 hover:bg-panel hover:text-ink">
                        {pt("partner.product.moderation", locale)}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {items && total > 0 && (
        <div className="mt-4 flex items-center justify-between text-xs text-ink/60">
          <span>
            {total} {pt("partner.products.count", locale)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goPage(page - 1)}
              className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40"
            >
              {pt("pagination.prev", locale)}
            </button>
            <span>
              {pt("pagination.page", locale)} {page} {pt("pagination.of", locale)} {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => goPage(page + 1)}
              className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40"
            >
              {pt("pagination.next", locale)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
