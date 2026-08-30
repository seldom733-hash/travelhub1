"use client";

import Link from "next/link";

export interface KpiItem {
  label: string;
  value: string | number;
  icon: string;
  accent?: string;
  /** R4-02: Optional drill-down link. When set, card is clickable. */
  href?: string;
}

export default function Kpi({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {items.map((k) => {
        const inner = (
          <>
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-base"
              style={{ background: `${k.accent ?? "#e0e7ff"}22`, color: k.accent ?? "#4f46e5" }}
            >
              {k.icon}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-400">{k.label}</div>
              <div className="truncate text-lg font-bold text-slate-900">{k.value}</div>
            </div>
          </>
        );

        if (k.href) {
          return (
            <Link
              key={k.label}
              href={k.href}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md hover:border-blue-300 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              aria-label={`${k.label}: ${k.value}`}
            >
              {inner}
            </Link>
          );
        }

        return (
          <div
            key={k.label}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
}
