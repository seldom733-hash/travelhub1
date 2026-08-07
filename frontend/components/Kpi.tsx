"use client";

export interface KpiItem {
  label: string;
  value: string | number;
  icon: string;
  accent?: string;
}

export default function Kpi({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {items.map((k) => (
        <div
          key={k.label}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
        >
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
        </div>
      ))}
    </div>
  );
}
