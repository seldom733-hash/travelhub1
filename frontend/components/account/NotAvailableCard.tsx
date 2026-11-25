/**
 * Buyer Cabinet neutral empty/not-yet-available card (Step 1.13 §5/§9/§10/§11).
 * Используется для разделов, где canonical domain ещё не существует: честный
 * empty state вместо fake records/выдуманных KPI (§25).
 */
export default function NotAvailableCard({
  icon,
  emptyText,
  hint,
}: {
  icon: string;
  emptyText: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-panel text-2xl" aria-hidden>
        {icon}
      </div>
      <p className="text-base font-medium text-ink">{emptyText}</p>
      <p className="mt-1 text-sm text-ink/60">{hint}</p>
    </div>
  );
}

/**
 * §SKELETON-PARITY (2026-10-16): заглушка загрузки ТОЙ ЖЕ формы, что и сам
 * `NotAvailableCard` — `/account/payments` и `/account/support` сразу переходят
 * в этот empty-state, поэтому прежний скелетон `h-32 rounded-2xl border-line
 * bg-white` давал другой силуэт (сплошная рамка и другая высота) и «прыгал».
 */
export function NotAvailableCardSkeleton() {
  return (
    <div
      className="rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center"
      aria-busy="true"
      aria-label="loading"
    >
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-panel" />
      <div className="mx-auto h-5 w-56 animate-pulse rounded bg-panel" />
      <div className="mx-auto mt-1 h-4 w-72 animate-pulse rounded bg-panel" />
    </div>
  );
}
