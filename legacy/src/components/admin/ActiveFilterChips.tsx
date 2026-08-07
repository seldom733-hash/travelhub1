"use client";

/* ─── Чипы активных фильтров (общий компонент) ───
   Используется в реестре заказов и аналитике:
   показывает, какие фильтры/селекты применены; клик по ✕ сбрасывает фильтр.

   Компонент рендерит только строку чипов (flex-wrap) — обёртку с рамкой/отступами
   выбирает вызывающая страница (под шапкой таблицы или внутри панели фильтров). */
export interface ActiveFilterChip {
  key: string;
  label: string;
  /** Если задан — чип получает кнопку «✕», вызывающую сброс конкретного фильтра. */
  onClear?: () => void;
}

export default function ActiveFilterChips({ chips }: { chips: ActiveFilterChip[] }) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[11px] font-medium text-primary"
        >
          {chip.label}
          {chip.onClear && (
            <button
              onClick={chip.onClear}
              className="w-4 h-4 rounded-full bg-primary/15 hover:bg-primary/30 flex items-center justify-center text-[10px] leading-none transition-colors"
              title="Сбросить фильтр"
            >
              ✕
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
