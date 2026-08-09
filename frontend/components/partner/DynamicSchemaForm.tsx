"use client";

import { useMemo } from "react";
import { useLocale } from "@/lib/i18n";
import { pt } from "@/lib/partner-i18n";
import type { PartnerSchemaAttribute } from "@/lib/partner-api";

/** Код ошибки поля (локализация — на уровне компонента через pt). */
export interface FieldError {
  code: "required" | "number" | "integer" | "min" | "max" | "enum" | "pattern" | "date" | "time";
  bound?: number;
}

const isMissing = (v: unknown): boolean => v === undefined || v === null || v === "";

/**
 * Чистая валидация значения attribute по дефиниции ACTIVE Category Schema
 * (клиентская; backend остаётся authoritative). Возвращает ошибку или null.
 */
export function validateField(def: PartnerSchemaAttribute, value: unknown): FieldError | null {
  if (isMissing(value)) {
    return def.required ? { code: "required" } : null;
  }
  switch (def.type) {
    case "boolean":
      return def.required && value !== true ? { code: "required" } : null;
    case "number":
    case "integer": {
      const n = Number(value);
      if (typeof value !== "number" || !Number.isFinite(n)) return { code: "number" };
      if (def.type === "integer" && !Number.isInteger(n)) return { code: "integer" };
      if (def.min !== undefined && n < def.min) return { code: "min", bound: def.min };
      if (def.max !== undefined && n > def.max) return { code: "max", bound: def.max };
      return null;
    }
    case "date": {
      const d = new Date(String(value));
      if (Number.isNaN(d.getTime())) return { code: "date" };
      return null;
    }
    case "time": {
      const s = String(value);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return { code: "time" };
      return null;
    }
    case "enum":
      return def.options && !def.options.includes(String(value)) ? { code: "enum" } : null;
    default: {
      // string / text / currency + опциональный pattern (компилируется в try/catch).
      if (def.pattern) {
        try {
          if (!new RegExp(def.pattern).test(String(value))) return { code: "pattern" };
        } catch {
          /* невалидный pattern из схемы — не блокируем клиент */
        }
      }
      return null;
    }
  }
}

export interface DynamicSchemaFormProps {
  attributes: PartnerSchemaAttribute[];
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
  idPrefix?: string;
}

/**
 * Dynamic Category Schema form (Step 1.8 §8): поля строятся по ACTIVE Category
 * Schema из Partner-safe contract (types: string/text/number/integer/boolean/date/
 * time/enum/currency). Валидация: required/min/max/enum/pattern + клиентская
 * обратная связь (aria-invalid + aria-describedby). Backend — authoritative.
 */
export default function DynamicSchemaForm({ attributes, value, onChange, disabled, idPrefix = "attr" }: DynamicSchemaFormProps) {
  const locale = useLocale();

  const errors = useMemo(() => {
    const map: Record<string, FieldError | null> = {};
    for (const def of attributes) map[def.key] = validateField(def, value[def.key]);
    return map;
  }, [attributes, value]);

  const errorText = (def: PartnerSchemaAttribute): string | null => {
    const err = errors[def.key];
    if (!err) return null;
    const base = pt(`partner.val.${err.code}`, locale);
    if (err.code === "min") return `${base} ${err.bound}`;
    if (err.code === "max") return `${base} ${err.bound}`;
    return base;
  };

  const set = (key: string, next: unknown) => onChange({ ...value, [key]: next });

  const inputClass = (def: PartnerSchemaAttribute) =>
    `w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 ${
      errors[def.key]
        ? "border-red-400 focus:border-red-400 focus:ring-red-100"
        : "border-slate-200 focus:border-emerald-400 focus:ring-emerald-100"
    } disabled:cursor-not-allowed disabled:bg-slate-50`;

  return (
    <div className="space-y-4">
      {attributes.map((def) => {
        const id = `${idPrefix}-${def.key}`;
        const err = errorText(def);
        const required = def.required === true;
        return (
          <div key={def.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <label htmlFor={def.type === "boolean" ? undefined : id} className="text-sm font-medium text-slate-700">
                {def.label ?? def.key}
                {required && (
                  <span className="ml-1 text-rose-500" aria-hidden>
                    *
                  </span>
                )}
              </label>
              {def.type === "boolean" && (
                <span className="text-[11px] text-slate-400">{required ? pt("partner.form.required", locale) : ""}</span>
              )}
            </div>

            {def.type === "boolean" ? (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={value[def.key] === true}
                  onChange={(e) => set(def.key, e.target.checked)}
                  disabled={disabled}
                  aria-label={def.label ?? def.key}
                  aria-invalid={!!err}
                  aria-describedby={err ? `${id}-error` : undefined}
                  className="size-4 rounded border-slate-300 accent-emerald-600"
                />
                {pt("attr.yes", locale)}
              </label>
            ) : def.type === "text" ? (
              <textarea
                id={id}
                value={String(value[def.key] ?? "")}
                onChange={(e) => set(def.key, e.target.value)}
                disabled={disabled}
                rows={3}
                aria-invalid={!!err}
                aria-describedby={err ? `${id}-error` : undefined}
                className={inputClass(def)}
              />
            ) : def.type === "enum" ? (
              <select
                id={id}
                value={String(value[def.key] ?? "")}
                onChange={(e) => set(def.key, e.target.value)}
                disabled={disabled}
                aria-invalid={!!err}
                aria-describedby={err ? `${id}-error` : undefined}
                className={inputClass(def)}
              >
                <option value="">—</option>
                {(def.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : def.type === "date" ? (
              <input
                id={id}
                type="date"
                value={String(value[def.key] ?? "")}
                onChange={(e) => set(def.key, e.target.value)}
                disabled={disabled}
                aria-invalid={!!err}
                aria-describedby={err ? `${id}-error` : undefined}
                className={inputClass(def)}
              />
            ) : def.type === "time" ? (
              <input
                id={id}
                type="time"
                value={String(value[def.key] ?? "")}
                onChange={(e) => set(def.key, e.target.value)}
                disabled={disabled}
                aria-invalid={!!err}
                aria-describedby={err ? `${id}-error` : undefined}
                className={inputClass(def)}
              />
            ) : def.type === "number" || def.type === "integer" ? (
              <input
                id={id}
                type="number"
                step={def.type === "integer" ? 1 : "any"}
                value={value[def.key] === undefined || value[def.key] === "" ? "" : String(value[def.key])}
                onChange={(e) => set(def.key, e.target.value === "" ? undefined : Number(e.target.value))}
                disabled={disabled}
                aria-invalid={!!err}
                aria-describedby={err ? `${id}-error` : undefined}
                className={inputClass(def)}
              />
            ) : (
              <input
                id={id}
                type="text"
                value={String(value[def.key] ?? "")}
                onChange={(e) => set(def.key, e.target.value)}
                disabled={disabled}
                aria-invalid={!!err}
                aria-describedby={err ? `${id}-error` : undefined}
                className={inputClass(def)}
              />
            )}

            {err && (
              <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-rose-600">
                {err}
              </p>
            )}
            {def.type === "enum" && def.options && (
              <p className="mt-1 text-[11px] text-slate-400">{def.options.slice(0, 6).join(", ")}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
