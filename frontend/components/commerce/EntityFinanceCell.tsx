"use client";

import EntityEmptyValue from "./EntityEmptyValue";

/**
 * Canonical Commerce Finance Cell.
 *
 * Shared label/value typography, padding, radius and semantic accent rules
 * for equivalent finance cells on Order / Booking detail pages.
 * Business fields may differ; visual grammar must not.
 */
const TONES = {
  neutral: { cell: "bg-slate-50", value: "text-slate-700" },
  positive: { cell: "bg-green-50", value: "text-green-700" },
  negative: { cell: "bg-red-50", value: "text-red-700" },
  warning: { cell: "bg-amber-50", value: "text-amber-700" },
  info: { cell: "bg-blue-50", value: "text-blue-700" },
} as const;

export default function EntityFinanceCell({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: keyof typeof TONES;
}) {
  const t = TONES[tone];
  return (
    <div className={`rounded-lg px-4 py-3 ${t.cell}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className={`mt-0.5 text-sm font-semibold ${t.value}`}>
        {value ?? <EntityEmptyValue />}
      </div>
    </div>
  );
}