"use client";

/** Черновик строки тарифа в форме (id — стабильный key). */
export interface TariffDraft {
  id: number;
  name: string;
  price: string;
  currency: string;
}

let seq = 0;

/** Новая пустая строка тарифа. */
export const newTariffDraft = (): TariffDraft => ({ id: ++seq, name: "", price: "", currency: "RUB" });

/** Преобразование существующих тарифов продукта в черновики формы (пусто → одна пустая строка). */
export const tariffDraftsFrom = (
  rows: { name: string; price: string | number; currency: string }[]
): TariffDraft[] =>
  rows.length
    ? rows.map((r) => ({ id: ++seq, name: r.name, price: String(r.price), currency: r.currency || "RUB" }))
    : [newTariffDraft()];

/**
 * Редактор тарифов: список строк (название/цена/валюта) с добавлением и удалением.
 * Управляемый компонент — значение и изменение приходят через props.
 */
export default function TariffEditor({
  value,
  onChange,
}: {
  value: TariffDraft[];
  onChange: (next: TariffDraft[]) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Тарифы</label>
        <button
          type="button"
          onClick={() => onChange([...value, newTariffDraft()])}
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          ＋ добавить
        </button>
      </div>
      <div className="space-y-2">
        {value.map((t) => (
          <div key={t.id} className="flex items-center gap-2">
            <input
              value={t.name}
              onChange={(e) => onChange(value.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))}
              placeholder="Название"
              className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
            />
            <input
              type="number"
              value={t.price}
              onChange={(e) => onChange(value.map((x) => (x.id === t.id ? { ...x, price: e.target.value } : x)))}
              placeholder="Цена"
              className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
            />
            <input
              value={t.currency}
              onChange={(e) => onChange(value.map((x) => (x.id === t.id ? { ...x, currency: e.target.value } : x)))}
              className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
            />
            {value.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x.id !== t.id))}
                className="text-slate-400 transition-colors hover:text-red-500"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
