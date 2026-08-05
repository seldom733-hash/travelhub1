"use client";

/**
 * Настройки аналитики (Гл. 2.3 «Настройки»).
 *
 * Персональные предпочтения отображения BI Center, сохраняются в localStorage:
 * валюта отображения, период по умолчанию, плотность сетки KPI и глубина
 * AI-анализа. Значения читаются основным компонентом BiCenter.
 */

import { useEffect, useState } from "react";

export interface BiSettings {
  currency: string; // "USD" | "AZN" | "EUR" | "TRY" | "RUB"
  defaultPeriod: string; // today | yesterday | week | month | quarter | year
  kpiDensity: "compact" | "comfortable" | "wide"; // колонок KPI
  aiDepth: "brief" | "full"; // краткие / полные AI-инсайты
  autoRefresh: number; // минуты: 0 = выключено, 1 | 5 | 15 | 30 | 60
}

export const BI_SETTINGS_KEY = "bi-center-settings";
// Ключ localStorage для истории значений KPI (мини-графики BI Center).
export const BI_KPI_HISTORY_KEY = "bi-kpi-history";
// Событие сброса истории KPI: «Настройки» → BiCenter (состояние + хранилище).
export const BI_KPI_HISTORY_RESET_EVENT = "bi-kpi-history-reset";

export const DEFAULT_BI_SETTINGS: BiSettings = {
  currency: "USD",
  defaultPeriod: "month",
  kpiDensity: "comfortable",
  aiDepth: "full",
  autoRefresh: 0,
};

// Интервалы автообновления BI Center (Гл. 2.8, «автообновление по таймеру»).
export const AUTO_REFRESH_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Выкл" },
  { value: 1, label: "1 мин" },
  { value: 5, label: "5 мин" },
  { value: 15, label: "15 мин" },
  { value: 30, label: "30 мин" },
  { value: 60, label: "60 мин" },
];

export function loadBiSettings(): BiSettings {
  try {
    const raw = localStorage.getItem(BI_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_BI_SETTINGS, ...(JSON.parse(raw) as Partial<BiSettings>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_BI_SETTINGS;
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  AZN: "₼",
  TRY: "₺",
  RUB: "₽",
};

const CURRENCIES = [
  { key: "USD", label: "Доллар США ($)" },
  { key: "EUR", label: "Евро (€)" },
  { key: "AZN", label: "Манат (₼)" },
  { key: "TRY", label: "Лира (₺)" },
  { key: "RUB", label: "Рубль (₽)" },
];

const PERIODS = [
  { key: "today", label: "Сегодня" },
  { key: "yesterday", label: "Вчера" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "quarter", label: "Квартал" },
  { key: "year", label: "Год" },
];

const DENSITIES = [
  { key: "compact", label: "Компактно", hint: "6 KPI в ряд" },
  { key: "comfortable", label: "Удобно", hint: "4 KPI в ряд" },
  { key: "wide", label: "Просторно", hint: "2 KPI в ряд" },
];

export default function AnalyticsSettings() {
  const [settings, setSettings] = useState<BiSettings>(DEFAULT_BI_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSettings(loadBiSettings()), 0);
    return () => clearTimeout(timer);
  }, []);

  const update = (patch: Partial<BiSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      localStorage.setItem(BI_SETTINGS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-5">
        <h2 className="font-semibold text-sm mb-1">⚙️ Настройки аналитики</h2>
        <p className="text-[11px] text-[var(--admin-muted)] mb-4">
          Персональные предпочтения отображения BI Center (Гл. 2.3). Сохраняются в вашем браузере.
        </p>

        {/* Валюта отображения */}
        <div className="mb-4">
          <div className="text-xs font-medium mb-2">Валюта отображения сумм</div>
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map((c) => (
              <button
                key={c.key}
                onClick={() => update({ currency: c.key })}
                className={`px-3 h-9 rounded-xl text-xs font-medium transition-colors border ${
                  settings.currency === c.key
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "bg-[var(--admin-bg)] border-[var(--admin-border)] text-[var(--admin-muted)] hover:border-primary/40"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Период по умолчанию */}
        <div className="mb-4">
          <div className="text-xs font-medium mb-2">Период по умолчанию</div>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => update({ defaultPeriod: p.key })}
                className={`px-3 h-9 rounded-xl text-xs font-medium transition-colors border ${
                  settings.defaultPeriod === p.key
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "bg-[var(--admin-bg)] border-[var(--admin-border)] text-[var(--admin-muted)] hover:border-primary/40"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Плотность KPI */}
        <div className="mb-4">
          <div className="text-xs font-medium mb-2">Плотность KPI-панели</div>
          <div className="flex flex-wrap gap-2">
            {DENSITIES.map((d) => (
              <button
                key={d.key}
                onClick={() => update({ kpiDensity: d.key as BiSettings["kpiDensity"] })}
                className={`px-3 h-9 rounded-xl text-xs font-medium transition-colors border ${
                  settings.kpiDensity === d.key
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "bg-[var(--admin-bg)] border-[var(--admin-border)] text-[var(--admin-muted)] hover:border-primary/40"
                }`}
              >
                {d.label} <span className="opacity-60">· {d.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Глубина AI */}
        <div className="mb-4">
          <div className="text-xs font-medium mb-2">Глубина AI-анализа</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => update({ aiDepth: "brief" })}
              className={`px-3 h-9 rounded-xl text-xs font-medium transition-colors border ${
                settings.aiDepth === "brief"
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-[var(--admin-bg)] border-[var(--admin-border)] text-[var(--admin-muted)] hover:border-primary/40"
              }`}
            >
              Краткие инсайты (заголовки)
            </button>
            <button
              onClick={() => update({ aiDepth: "full" })}
              className={`px-3 h-9 rounded-xl text-xs font-medium transition-colors border ${
                settings.aiDepth === "full"
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-[var(--admin-bg)] border-[var(--admin-border)] text-[var(--admin-muted)] hover:border-primary/40"
              }`}
            >
              Полные инсайты (с деталями)
            </button>
          </div>
        </div>

        {/* Автообновление данных (Гл. 2.8) */}
        <div className="mt-4">
          <div className="text-xs font-medium mb-1">Автообновление данных</div>
          <div className="text-[11px] text-[var(--admin-muted)] mb-2">
            Данные BI Center обновляются по таймеру без участия пользователя.
          </div>
          <div className="flex flex-wrap gap-2">
            {AUTO_REFRESH_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => update({ autoRefresh: o.value })}
                className={`px-3 h-9 rounded-xl text-xs font-medium transition-colors border ${
                  settings.autoRefresh === o.value
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "bg-[var(--admin-bg)] border-[var(--admin-border)] text-[var(--admin-muted)] hover:border-primary/40"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[var(--admin-border)] flex items-center justify-between">
          <span className="text-[11px] text-[var(--admin-muted)]">
            {saved ? "✓ Изменения сохранены" : "Изменения применяются сразу"}
          </span>
          <button
            onClick={() => update(DEFAULT_BI_SETTINGS)}
            className="px-3 h-8 rounded-lg bg-[var(--admin-bg)] border border-[var(--admin-border)] text-xs font-medium hover:border-primary transition-colors"
          >
            Сбросить к значениям по умолчанию
          </button>
          <button
            onClick={() => {
              // Очищаем сохранённую историю KPI и сообщаем BiCenter через событие.
              try {
                localStorage.removeItem(BI_KPI_HISTORY_KEY);
              } catch {
                /* ignore */
              }
              window.dispatchEvent(new Event(BI_KPI_HISTORY_RESET_EVENT));
            }}
            title="Удалить историю значений KPI из этого браузера"
            className="px-3 h-8 rounded-lg bg-[var(--admin-bg)] border border-danger/30 text-xs font-medium text-danger hover:bg-danger/10 transition-colors"
          >
            🗑 Сбросить историю KPI
          </button>
        </div>
      </div>
    </div>
  );
}
