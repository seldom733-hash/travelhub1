"use client";

import EntityEmptyValue from "./EntityEmptyValue";

/**
 * Canonical Commerce Entity Field.
 *
 * Unified label → value → optional meta display for detail pages.
 * Same semantic role, same visual grammar across Request / Order / Booking.
 * `mono` renders reference/code values in the canonical mono grammar.
 */
export default function EntityField({
  label,
  value,
  meta,
  mono = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  meta?: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${className ?? ""}`}>
      <span className="text-xs font-medium uppercase text-slate-400">{label}</span>
      {mono ? (
        <span className="font-mono text-xs font-medium text-blue-600">
          {value ?? <EntityEmptyValue />}
        </span>
      ) : (
        <span className="text-sm font-medium text-slate-700">
          {value ?? <EntityEmptyValue />}
        </span>
      )}
      {meta && <span className="text-xs text-slate-400">{meta}</span>}
    </div>
  );
}