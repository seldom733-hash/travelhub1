"use client";

import { useEffect, useState, type FormEvent } from "react";
import { t, useLocale } from "@/lib/i18n";
import { buildFilterControls } from "@/lib/marketplace-utils";
import type { PublicFilterMetadata } from "@/lib/public-api";

/**
 * PHASE 1 STEP 1.7 §10 — category-specific фильтры, построенные динамически из
 * filter metadata (`GET /api/v1/public/categories/:slug/filters`). НЕ хардкод
 * под конкретную категорию: тип контрола выводится из type атрибута schema.
 *
 * onChange(newApplied) — родитель сериализует в URL (f[key]=value) и вызывает
 * public API. Локальный draft применяется по кнопке «Применить» (submit).
 */
export default function CategoryFilters({
  meta,
  applied,
  onChange,
}: {
  meta: PublicFilterMetadata;
  applied: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const locale = useLocale();
  const [draft, setDraft] = useState<Record<string, string>>(applied);
  const [open, setOpen] = useState(false);

  // URL изменился (router.replace) → синхронизируем локальный draft с applied.
  useEffect(() => {
    setDraft(applied);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(applied)]);

  const controls = buildFilterControls(meta);
  if (controls.length === 0) return null;

  const set = (key: string, value: string) =>
    setDraft((d) => {
      const next = { ...d };
      if (value === "" || value === "false") delete next[key];
      else next[key] = value;
      return next;
    });

  const apply = (e?: FormEvent) => {
    e?.preventDefault();
    onChange(draft);
    setOpen(false);
  };

  const reset = () => {
    setDraft({});
    onChange({});
  };

  const filterForm = (
    <form
      onSubmit={apply}
      className="space-y-4"
      aria-label={t("filters.title", locale)}
      onKeyDown={(e) => {
        // Enter в input'е = применить, а не submit по умолчанию со сбросом страницы
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
          e.preventDefault();
          apply();
        }
      }}
    >
      {controls.map((c) => (
        <div key={c.key} className="space-y-1.5">
          <label htmlFor={`f-${c.key}`} className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            {c.label}
          </label>
          {c.kind === "select" && (
            <select
              id={`f-${c.key}`}
              value={draft[c.key] ?? ""}
              onChange={(e) => set(c.key, e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">—</option>
              {(c.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )}
          {c.kind === "checkbox" && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                id={`f-${c.key}`}
                type="checkbox"
                checked={draft[c.key] === "true"}
                onChange={(e) => set(c.key, e.target.checked ? "true" : "")}
                className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              {t("attr.yes", locale)}
            </label>
          )}
          {c.kind === "number" && (
            <div className="flex items-center gap-2">
              {c.min !== undefined && (
                <input
                  id={`f-${c.key}`}
                  type="number"
                  inputMode="numeric"
                  min={c.min}
                  max={c.max}
                  placeholder={String(c.min)}
                  value={draft[c.key] ?? ""}
                  onChange={(e) => set(c.key, e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              )}
              {c.min === undefined && c.max === undefined && (
                <input
                  id={`f-${c.key}`}
                  type="number"
                  inputMode="numeric"
                  value={draft[c.key] ?? ""}
                  onChange={(e) => set(c.key, e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              )}
            </div>
          )}
          {c.kind === "date" && (
            <input
              id={`f-${c.key}`}
              type="date"
              value={draft[c.key] ?? ""}
              onChange={(e) => set(c.key, e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          )}
          {c.kind === "text" && (
            <input
              id={`f-${c.key}`}
              type="text"
              value={draft[c.key] ?? ""}
              onChange={(e) => set(c.key, e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          )}
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          {t("filters.apply", locale)}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          {t("filters.reset", locale)}
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-3">
      {/* Desktop: sidebar блок (скрыт, если на ≥lg открыт mobile drawer — иначе дублируются id f-*) */}
      <div className={`rounded-2xl border border-slate-200 bg-white p-4 ${open ? "hidden" : "hidden lg:block"}`}>{filterForm}</div>

      {/* Mobile: кнопка-дразер */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-filters"
          className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          <span>
            {t("filters.title", locale)} {Object.keys(applied).length > 0 ? `(${Object.keys(applied).length})` : ""}
          </span>
          <span aria-hidden>{open ? "▲" : "▼"}</span>
        </button>
        {open && (
          <div id="mobile-filters" className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
            {filterForm}
          </div>
        )}
      </div>
    </div>
  );
}
