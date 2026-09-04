"use client";

/**
 * Canonical Commerce KPI Card.
 *
 * Unified visual primitive for Orders / Bookings / Requests KPI displays.
 * Business content remains domain-specific — this only provides visual consistency.
 */
export default function CommerceKpiCard({
  value,
  label,
  active,
  onClick,
  icon,
}: {
  value: number | string;
  label: string;
  active?: boolean;
  onClick?: () => void;
  icon?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-center transition-colors ${
        active
          ? "border-blue-300 bg-blue-50"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {icon && <div className="mb-1 text-base">{icon}</div>}
      <div className="text-xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </button>
  );
}
