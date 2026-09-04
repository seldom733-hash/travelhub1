"use client";

/**
 * Canonical Commerce KPI Card.
 *
 * Unified visual primitive for Orders / Bookings / Requests KPI displays.
 * Layout: LABEL above VALUE, left-aligned, no decorative icons.
 * All 3 registries consume this same component.
 */
export default function CommerceKpiCard({
  value,
  label,
  active,
  onClick,
}: {
  value: number | string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors ${
        active
          ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      } ${onClick ? "cursor-pointer" : ""}`}
      aria-pressed={active}
    >
      <span className="text-xs font-medium leading-snug text-slate-500">{label}</span>
      <span className="mt-1 text-lg font-bold leading-tight text-slate-900">{value}</span>
    </button>
  );
}
