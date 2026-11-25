"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";
import { pt } from "@/lib/partner-i18n";
import { partnerApi, type PartnerLifecycleFilter } from "@/lib/partner-api";

interface Stat {
  key: string;
  labelKey: string;
  filter: PartnerLifecycleFilter | null;
  accent: string;
}

const STATS: Stat[] = [
  { key: "total", labelKey: "partner.overview.total", filter: null, accent: "bg-ink" },
  { key: "draft", labelKey: "partner.overview.draft", filter: "draft", accent: "bg-amber-500" },
  { key: "in_moderation", labelKey: "partner.overview.in_moderation", filter: "in_moderation", accent: "bg-brand" },
  { key: "changes_requested", labelKey: "partner.overview.changes_requested", filter: "changes_requested", accent: "bg-rose-500" },
  { key: "published", labelKey: "partner.overview.published", filter: "published", accent: "bg-emerald-500" },
  { key: "archived", labelKey: "partner.overview.archived", filter: "archived", accent: "bg-panel" },
];

/** Сводка портфеля (только own-scope): лёгкие запросы total по фильтрам. */
async function loadCounts(): Promise<Record<string, number>> {
  const entries = await Promise.all(
    STATS.map(async (s) => {
      const res = await partnerApi.listProducts(s.filter ? { filter: s.filter, pageSize: 1 } : { pageSize: 1 });
      return [s.key, res.total] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export default function PartnerOverviewPage() {
  const locale = useLocale();
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    loadCounts()
      .then((c) => {
        if (alive) setCounts(c);
      })
      .catch((err) => {
        if (alive) setError((err as Error).message);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{pt("partner.overview.title", locale)}</h1>
          <p className="mt-1 text-sm text-ink/60">{pt("partner.overview.subtitle", locale)}</p>
        </div>
        <Link
          href="/partner/products/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          {pt("partner.products.new", locale)}
        </Link>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {STATS.map((s) => (
          <Link
            key={s.key}
            href={s.filter ? `/partner/products?filter=${s.filter}` : "/partner/products"}
            className="group rounded-2xl border border-line bg-white p-4 transition-shadow hover:shadow-md"
          >
            <div className={`mb-3 inline-flex size-9 items-center justify-center rounded-xl text-sm font-bold text-white ${s.accent}`}>
              {counts ? counts[s.key] ?? 0 : "…"}
            </div>
            <div className="text-xs font-medium text-ink/60">{pt(s.labelKey, locale)}</div>
            <div className="mt-1 text-[10px] text-ink/60 transition-colors group-hover:text-emerald-600">{pt("partner.overview.open", locale)} →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
