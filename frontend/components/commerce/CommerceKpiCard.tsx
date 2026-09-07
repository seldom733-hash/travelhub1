"use client";

import MetricHelpPopover from "./MetricHelpPopover";

/**
 * Canonical Commerce KPI Card.
 *
 * Unified visual primitive for Orders / Bookings / Requests / Payments KPI
 * displays. Layout: LABEL above VALUE, left-aligned, no decorative icons.
 * All 4 registries consume this same component.
 *
 * `variant="total"` — TOTAL KPI micro-closure: same visual language,
 * ~15–20% larger label/value typography and padding than ordinary status
 * cards. Never rendered full-width by this component itself.
 *
 * UI-C1.2H: optional `helpId` binds a canonical Help Registry entry
 * (KPI/status definition). When set, the card is wrapped in a relative
 * container and an accessible help trigger is rendered in its top-right
 * corner. Help content always flows Registry → localizationKeys → i18n.
 */
export default function CommerceKpiCard({
  value,
  label,
  active,
  onClick,
  variant = "default",
  helpId,
  className = "",
}: {
  value: number | string;
  label: string;
  active?: boolean;
  onClick?: () => void;
  variant?: "default" | "total";
  /** Stable Help Registry entry id ({domain}.{metric-or-status}). */
  helpId?: string;
  className?: string;
}) {
  const total = variant === "total";
  const innerClassName = `flex w-full flex-col items-start rounded-xl border text-left transition-colors ${
    total ? "px-5 py-4" : "px-4 py-3"
  } ${
    active
      ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200"
      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
  } ${onClick ? "cursor-pointer" : ""}`;

  const labelClassName = `font-medium leading-snug ${
    total ? "text-sm text-slate-600" : "text-xs text-slate-500"
  } ${helpId ? "pr-6" : ""}`;

  const valueClassName = `mt-1 font-bold leading-tight text-slate-900 ${
    total ? "text-[21px]" : "text-lg"
  }`;

  // No help binding → identical DOM to the pre-H card (button as grid child,
  // className applied to the button exactly as before).
  if (!helpId) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${innerClassName} ${className}`}
        aria-pressed={active}
      >
        <span className={labelClassName}>{label}</span>
        <span className={valueClassName}>{value}</span>
      </button>
    );
  }

  // Help binding → the card is wrapped in a relative container; className now
  // sizes the wrapper and the help trigger sits in its top-right corner.
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className={innerClassName}
        aria-pressed={active}
      >
        <span className={labelClassName}>{label}</span>
        <span className={valueClassName}>{value}</span>
      </button>
      <span className="absolute right-1.5 top-1.5">
        <MetricHelpPopover entryId={helpId} />
      </span>
    </div>
  );
}