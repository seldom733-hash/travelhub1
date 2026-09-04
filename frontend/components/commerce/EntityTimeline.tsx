"use client";

import { useLocale, LOCALE_TAGS } from "@/lib/i18n";

/**
 * Canonical Commerce Entity Timeline.
 *
 * Business milestones / current stage presentation — NOT audit history.
 * Same dot/label/time grammar on Request, Order and Booking detail pages.
 * Timestamps are formatted with the active locale (never a hardcoded locale).
 */
export default function EntityTimeline({
  items,
}: {
  items: Array<{ key: string; label: string; timestamp: string | null }>;
}) {
  const locale = useLocale();
  const fmt = (v: string | null) =>
    v ? new Date(v).toLocaleString(LOCALE_TAGS[locale]) : null;

  return (
    <div className="space-y-3">
      {items
        .filter((i) => i.timestamp)
        .map((i) => (
          <div key={i.key} className="flex items-start gap-3">
            <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
            <div>
              <div className="text-xs font-medium text-slate-700">{i.label}</div>
              <div className="font-mono text-[11px] text-slate-400">{fmt(i.timestamp)}</div>
            </div>
          </div>
        ))}
    </div>
  );
}