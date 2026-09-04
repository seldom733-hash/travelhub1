"use client";

/**
 * Canonical Commerce KPI Card.
 *
 * Unified visual primitive for Orders / Bookings / Requests KPI displays.
 * Layout: LABEL above VALUE, left-aligned, no decorative icons.
 * All 3 registries consume this same component.
 *
 * `variant="total"` — TOTAL KPI micro-closure: same visual language,
 * ~15–20% larger label/value typography and padding than ordinary status
 * cards. Never rendered full-width by this component itself.
 */
export default function CommerceKpiCard({
  value,
  label,
  active,
  onClick,
  variant = "default",
  className = "",
}: {
  value: number | string;
  label: string;
  active?: boolean;
  onClick?: () => void;
  variant?: "default" | "total";
  className?: string;
}) {
  const total = variant === "total";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start rounded-xl border text-left transition-colors ${className} ${
        total ? "px-5 py-4" : "px-4 py-3"
      } ${
        active
          ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      } ${onClick ? "cursor-pointer" : ""}`}
      aria-pressed={active}
    >
      <span
        className={`font-medium leading-snug ${
          total ? "text-sm text-slate-600" : "text-xs text-slate-500"
        }`}
      >
        {label}
      </span>
      <span
        className={`mt-1 font-bold leading-tight text-slate-900 ${
          total ? "text-[21px]" : "text-lg"
        }`}
      >
        {value}
      </span>
    </button>
  );
}