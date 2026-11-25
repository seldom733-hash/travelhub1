"use client";

/** Public-safe loading state (Step 1.6 §19). */
export function PublicLoading({ label = "Загрузка…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-line bg-panel py-10 text-sm text-ink/60">
      <span className="inline-block size-3 animate-spin rounded-full border-2 border-line border-t-blue-500" />
      {label}
    </div>
  );
}

/** Public-safe error state: нейтральное сообщение, без internal dump (Step 1.6 §18). */
export function PublicErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
      Не удалось загрузить данные каталога: {message}
    </div>
  );
}

/** Public empty state (Step 1.6 §18: empty search/категория — не error dump). */
export function PublicEmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-panel px-4 py-10 text-center text-sm text-ink/60">
      {text}
    </div>
  );
}

/** Нейтральный public 404 (непубличный/несуществующий продукт или категория). */
export function PublicNotFound({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <div className="text-4xl">🔍</div>
      <h1 className="mt-3 text-xl font-bold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink/60">{hint}</p>
      <a href="/search" className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark">
        Вернуться к поиску
      </a>
    </div>
  );
}
