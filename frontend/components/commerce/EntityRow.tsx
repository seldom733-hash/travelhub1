"use client";

/**
 * Canonical Commerce Entity Row.
 *
 * Shared list-row grammar for payments, refunds, items, passengers,
 * supplier confirmations and history entries on Request / Order / Booking
 * detail pages. Different business content, same visual grammar.
 */
export default function EntityRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-100 bg-white px-4 py-2.5 text-xs ${className ?? ""}`}
    >
      {children}
    </div>
  );
}