"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { activityApi, type ActivityItem } from "@/lib/api";
import { useLocale, t } from "@/lib/i18n";

const SOURCE_TYPES = [
  "OPERATIONAL_NOTE", "ORDER", "BOOKING", "PAYMENT", "REFUND",
  "MESSAGE", "AUDIT_EVENT", "CUSTOMER_HISTORY", "BUYER_REQUEST", "PARTNER_APPLICATION",
] as const;

const ACTIVITY_ICONS: Record<string, string> = {
  OPERATIONAL_NOTE: "📝",
  ORDER: "🧾",
  BOOKING: "📑",
  PAYMENT: "💳",
  REFUND: "↩️",
  MESSAGE: "💬",
  AUDIT_EVENT: "🔍",
  CUSTOMER_HISTORY: "📋",
  BUYER_REQUEST: "📩",
  PARTNER_APPLICATION: "🤝",
};

export default function CustomerActivity({ customerId }: { customerId: string }) {
  const locale = useLocale();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (cursor?: string, replace = false) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError("");
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await activityApi.listCustomer(customerId, {
          sourceType: sourceFilter || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          cursor,
          limit: 20,
        });
        if (controller.signal.aborted) return;
        setItems((prev) => (replace || !cursor ? res.items : [...prev, ...res.items]));
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [customerId, sourceFilter, dateFrom, dateTo],
  );

  useEffect(() => {
    void load(undefined, true);
  }, [load]);

  const handleFilterChange = (src: string) => {
    setSourceFilter(src);
  };

  const handleLoadMore = () => {
    if (nextCursor) void load(nextCursor, false);
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-xs text-slate-400">
        {t("activity.loading", locale)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
        {t("activity.error", locale)}: {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={sourceFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400"
        >
          <option value="">{t("activity.all_sources", locale)}</option>
          {SOURCE_TYPES.map((src) => (
            <option key={src} value={src}>
              {t(`activity.source.${src}`, locale)}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400">{t("admin.filter.date_from", locale)}</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400"
          />
          <span className="text-xs text-slate-400">{t("admin.filter.date_to", locale)}</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400"
          />
        </div>
      </div>

      {/* Timeline */}
      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">
          {t("activity.empty", locale)}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const icon = ACTIVITY_ICONS[item.sourceType] ?? "📌";
            const sourceLabel = t(`activity.source.${item.sourceType}`, locale);
            const eventLabel = t(`activity.event.${item.activityType}`, locale);
            const ts = new Date(item.occurredAt);
            const dateStr = ts.toLocaleDateString(locale === "az" ? "az-AZ" : locale === "en" ? "en-US" : "ru-RU");
            const timeStr = ts.toLocaleTimeString(locale === "az" ? "az-AZ" : locale === "en" ? "en-US" : "ru-RU", { hour: "2-digit", minute: "2-digit" });

            const inner = (
              <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-white px-4 py-3 text-xs transition-colors hover:bg-blue-50/30">
                <div className="mt-0.5 text-base">{icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      {sourceLabel}
                    </span>
                    <span className="font-medium text-slate-700">{eventLabel}</span>
                  </div>
                  {item.summary && (
                    <div className="mt-0.5 truncate text-slate-400">{item.summary}</div>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-slate-400">
                    <span>{dateStr} {timeStr}</span>
                    {item.actor?.name && (
                      <span>{t("activity.by", locale)} {item.actor.name}</span>
                    )}
                  </div>
                </div>
              </div>
            );

            return item.deepLink ? (
              <Link key={item.id} href={item.deepLink} className="block">
                {inner}
              </Link>
            ) : (
              <div key={item.id}>{inner}</div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="text-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {loadingMore ? t("activity.loading", locale) : t("activity.load_more", locale)}
          </button>
        </div>
      )}
    </div>
  );
}
