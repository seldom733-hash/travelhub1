"use client";

import { useLocale } from "@/lib/i18n";
import { pt } from "@/lib/partner-i18n";

/** Строка тарифа в форме (id — стабильный key). */
export interface TariffDraft {
  id: number;
  name: string;
  price: string;
  currency: string;
}

let seq = 0;

/** Новая пустая строка тарифа (валюта по умолчанию — USD, как на backend). */
export const newTariffDraft = (): TariffDraft => ({ id: ++seq, name: "", price: "", currency: "USD" });

/** Преобразование существующих тарифов в черновики формы (пусто → одна пустая строка). */
export const tariffDraftsFrom = (rows: { name: string; price: string | number; currency?: string }[]): TariffDraft[] =>
  rows.length
    ? rows.map((r) => ({ id: ++seq, name: r.name, price: String(r.price), currency: r.currency || "USD" }))
    : [newTariffDraft()];

/** Конвертация черновиков в payload (name/price/currency) — пустые строки исключаются. */
export const tariffDraftsToPayload = (drafts: TariffDraft[]): { name: string; price: number; currency: string }[] =>
  drafts
    .filter((t) => t.name.trim() !== "" && t.price.trim() !== "")
    .map((t) => ({ name: t.name.trim(), price: Number(t.price), currency: t.currency.trim() || "USD" }));

/**
 * Редактор тарифов Partner Cabinet (Step 1.8 §13): названия/цены/валюты.
 * Тарифы сохраняются через Product create/update contract (ownership на backend).
 * Управляемый компонент — value/onChange через props.
 */
export default function TariffList({
  value,
  onChange,
  disabled,
}: {
  value: TariffDraft[];
  onChange: (next: TariffDraft[]) => void;
  disabled?: boolean;
}) {
  const locale = useLocale();
  const update = (id: number, patch: Partial<TariffDraft>) => onChange(value.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  return (
    <div className="space-y-2">
      {value.map((t) => (
        <div key={t.id} className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`tariff-name-${t.id}`}>
            {pt("partner.form.tariff_name", locale)}
          </label>
          <input
            id={`tariff-name-${t.id}`}
            value={t.name}
            onChange={(e) => update(t.id, { name: e.target.value })}
            placeholder={pt("partner.form.tariff_name", locale)}
            disabled={disabled}
            className="w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400 disabled:bg-slate-50"
          />
          <label className="sr-only" htmlFor={`tariff-price-${t.id}`}>
            {pt("partner.form.tariff_price", locale)}
          </label>
          <input
            id={`tariff-price-${t.id}`}
            type="number"
            min={0}
            step="0.01"
            value={t.price}
            onChange={(e) => update(t.id, { price: e.target.value })}
            placeholder={pt("partner.form.tariff_price", locale)}
            disabled={disabled}
            className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400 disabled:bg-slate-50"
          />
          <label className="sr-only" htmlFor={`tariff-currency-${t.id}`}>
            {pt("partner.form.tariff_currency", locale)}
          </label>
          <input
            id={`tariff-currency-${t.id}`}
            value={t.currency}
            onChange={(e) => update(t.id, { currency: e.target.value.toUpperCase() })}
            placeholder="USD"
            maxLength={3}
            disabled={disabled}
            className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm uppercase outline-none transition focus:border-emerald-400 disabled:bg-slate-50"
          />
          {value.length > 1 && !disabled && (
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x.id !== t.id))}
              aria-label={pt("partner.media.delete", locale)}
              className="text-slate-400 transition-colors hover:text-rose-500"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button" onClick={() => onChange([...value, newTariffDraft()])} className="text-sm font-medium text-emerald-600 hover:underline">
          {pt("partner.form.add_tariff", locale)}
        </button>
      )}
    </div>
  );
}
