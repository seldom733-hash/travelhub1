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
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-slate-50 text-2xl" aria-hidden>
        {icon}
      </div>
      <p className="text-base font-medium text-slate-700">{emptyText}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
    </div>
  );
}
