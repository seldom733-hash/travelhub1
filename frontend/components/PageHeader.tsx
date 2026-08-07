"use client";

export default function PageHeader({
  title,
  breadcrumbs,
  actions,
}: {
  title: string;
  breadcrumbs: string[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
      <div>
        <div className="text-xs text-slate-400">
          {breadcrumbs.map((c, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-1">/</span>}
              {c}
            </span>
          ))}
        </div>
        <h1 className="mt-0.5 text-lg font-bold text-slate-900">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
