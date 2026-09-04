"use client";

/**
 * Canonical Commerce Entity Field.
 *
 * Unified label → value → optional meta display for detail pages.
 * Same semantic role, same visual grammar across Request / Order / Booking.
 */
export default function EntityField({
  label,
  value,
  meta,
  className,
}: {
  label: string;
  value: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${className ?? ""}`}>
      <span className="text-xs font-medium text-slate-400 uppercase">{label}</span>
      <span className="text-sm font-medium text-slate-700">{value ?? "—"}</span>
      {meta && <span className="text-xs text-slate-400">{meta}</span>}
    </div>
  );
}
