"use client";

/** Skeleton карточки продукта (публичный, без реальных данных). */
export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-hidden="true">
      <div className="aspect-[16/9] animate-pulse bg-slate-200" />
      <div className="space-y-2 p-4">
        <div className="h-2.5 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
        <div className="h-5 w-1/2 animate-pulse rounded bg-slate-200 pt-1" />
      </div>
    </div>
  );
}

/** Сетка скелетонов (используется Home/Search/Category). */
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="loading">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Скелетон деталей PDP (gallery + aside). */
export function PdpSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]" aria-busy="true" aria-label="loading">
      <div>
        <div className="aspect-[16/9] animate-pulse rounded-xl bg-slate-200" />
        <div className="mt-6 h-7 w-2/3 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}
