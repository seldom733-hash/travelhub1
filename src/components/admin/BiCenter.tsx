"use client";

/**
 * Центр бизнес-аналитики (Гл. 2) — единое пространство для мониторинга,
 * анализа и прогнозирования всех бизнес-процессов платформы.
 *
 * Реализует «Единую логику страниц» (2.4, 2.5): заголовок → панель фильтров →
 * KPI → графики → дополнительные диаграммы → таблицы → AI-анализ.
 * Каждая вкладка (раздел 2.9–2.17) отдаёт унифицированную схему данных,
 * которую рендерит один набор блоков.
 */

import { useEffect, useState, useCallback } from "react";
import { RevenueChart, DonutChart, Sparkline, CHART_COLORS } from "@/components/admin/charts";
import ActiveFilterChips, { type ActiveFilterChip } from "@/components/admin/ActiveFilterChips";
import { describeApiError } from "@/lib/api-error";
import {
  type AnalyticsSectionData,
  type AnalyticsSection,
  type KpiCard,
  type SeriesBlock,
  type DonutBlock,
  type BarListBlock,
  type FunnelBlock,
  type HealthBlock,
  type PulseItem,
  type AiInsight,
  type TableBlock,
} from "@/lib/analytics";

const PERIODS = [
  { key: "today", label: "Сегодня" },
  { key: "yesterday", label: "Вчера" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "quarter", label: "Квартал" },
  { key: "year", label: "Год" },
];

const TABS: { key: AnalyticsSection; title: string; icon: string }[] = [
  { key: "overview", title: "Общая", icon: "🏛️" },
  { key: "sales", title: "Продажи", icon: "💼" },
  { key: "orders", title: "Заказы", icon: "📦" },
  { key: "bookings", title: "Бронирования", icon: "📑" },
  { key: "finance", title: "Финансы", icon: "💰" },
  { key: "crm", title: "Клиенты", icon: "👥" },
  { key: "partners", title: "Партнёры", icon: "🤝" },
  { key: "catalog", title: "Каталог", icon: "🗂️" },
  { key: "marketing", title: "Маркетинг", icon: "📣" },
];

const SERVICE_TYPES = [
  { key: "TOUR", label: "Туры" },
  { key: "HOTEL", label: "Отели" },
  { key: "SANATORIUM", label: "Санатории" },
  { key: "FLIGHT", label: "Авиабилеты" },
  { key: "TRAIN", label: "Ж/Д билеты" },
  { key: "EXCURSION", label: "Экскурсии" },
  { key: "GUIDE", label: "Гиды" },
  { key: "TRANSFER", label: "Трансферы" },
  { key: "PHOTOGRAPHER", label: "Фотографы" },
];

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " $";

const fmtNumber = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n));

/* ─── Вспомогательные отрисовщики ─── */

function KpiCardView({ kpi }: { kpi: KpiCard }) {
  const toneColor =
    kpi.tone === "positive" ? "text-success" : kpi.tone === "negative" ? "text-danger" : "text-[var(--admin-muted)]";
  const changeColor = (kpi.change ?? 0) >= 0 ? "text-success" : "text-danger";
  const value = kpi.unit === "%" ? `${kpi.value.toFixed(1)}%` : kpi.unit ? `${kpi.value}${kpi.unit}` : fmtMoney(kpi.value);

  return (
    <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4 hover:shadow-lg transition-shadow group">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs text-[var(--admin-muted)] font-medium leading-tight">{kpi.title}</div>
        {(kpi.forecast ?? 0) > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium shrink-0">AI</span>
        )}
      </div>
      <div className={`text-2xl font-bold mt-1 ${toneColor}`}>{value}</div>
      <div className="flex items-end justify-between gap-2 mt-1.5">
        <div className="text-[11px] text-[var(--admin-muted)] space-y-0.5 min-w-0">
          {kpi.change !== undefined && (
            <div className={changeColor}>
              {kpi.change >= 0 ? "▲" : "▼"} {Math.abs(kpi.change).toFixed(1)}% к прошлому
            </div>
          )}
          {kpi.detail && <div className="truncate max-w-[140px]">{kpi.detail}</div>}
        </div>
        {kpi.spark && kpi.spark.length > 1 && (
          <div className="w-20 h-8 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
            <Sparkline data={kpi.spark} color={kpi.tone === "negative" ? "#ef4444" : "#22c55e"} height={30} />
          </div>
        )}
      </div>
    </div>
  );
}

function FunnelView({ funnel }: { funnel: FunnelBlock }) {
  const max = Math.max(...funnel.steps.map((s) => s.value), 1);
  return (
    <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
      <h3 className="font-semibold text-sm mb-3">🔄 {funnel.title}</h3>
      <div className="space-y-2">
        {funnel.steps.map((s, i) => (
          <div key={s.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[var(--admin-muted)]">
                {i + 1}. {s.label}
              </span>
              <span className="font-semibold">{fmtNumber(s.value)}</span>
            </div>
            <div className="h-2.5 bg-[var(--admin-bg)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                style={{ width: `${Math.max(4, (s.value / max) * 100)}%` }}
              />
            </div>
            {s.detail && <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">{s.detail}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function SeriesCard({ series, height = 200 }: { series: SeriesBlock; height?: number }) {
  const color = series.color ?? CHART_COLORS[0];
  const data = series.data.labels.map((l, i) => ({ label: l, value: series.data.values[i] ?? 0 }));
  return (
    <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
      <h3 className="font-semibold text-sm mb-1">
        {series.icon} {series.title}
      </h3>
      <div className="text-[10px] text-[var(--admin-muted)] mb-2">
        Итог: {fmtMoney(series.data.values.reduce((a, v) => a + v, 0))}
      </div>
      <RevenueChart data={data} mode={series.mode} height={height} color={color} />
    </div>
  );
}

function DonutCard({ donut }: { donut: DonutBlock }) {
  const total = donut.data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
      <h3 className="font-semibold text-sm mb-3">
        {donut.icon} {donut.title}
      </h3>
      <DonutChart
        data={donut.data.map((d, i) => ({
          label: d.label,
          value: d.value,
          color: d.color ?? CHART_COLORS[i % CHART_COLORS.length],
        }))}
        size={190}
      />
      {total === 0 && <div className="text-xs text-[var(--admin-muted)]">Нет данных за период</div>}
    </div>
  );
}

function BarListCard({ list }: { list: BarListBlock }) {
  const max = list.maxValue ?? Math.max(...list.rows.map((r) => r.value), 1);
  return (
    <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
      <h3 className="font-semibold text-sm mb-3">
        {list.icon} {list.title}
      </h3>
      <div className="space-y-2.5">
        {list.rows.slice(0, 10).map((r, i) => (
          <div key={r.label + i}>
            <div className="flex items-center justify-between gap-2 text-xs mb-1">
              <span className="text-[var(--admin-muted)] truncate" title={r.label}>
                {r.label}
              </span>
              <span className="font-semibold shrink-0">{fmtNumber(r.value)}</span>
            </div>
            <div className="h-2 bg-[var(--admin-bg)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(2, (r.value / max) * 100)}%`,
                  background: i === 0 ? "var(--primary, #f97316)" : "#06b6d4",
                  opacity: 0.85,
                }}
              />
            </div>
            {r.sub && <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">{r.sub}</div>}
          </div>
        ))}
        {!list.rows.length && <div className="text-xs text-[var(--admin-muted)]">Нет данных за период</div>}
      </div>
    </div>
  );
}

function TableCard({ table }: { table: TableBlock }) {
  return (
    <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
      <h3 className="font-semibold text-sm mb-3">
        {table.icon} {table.title}
      </h3>
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[var(--admin-muted)] border-b border-[var(--admin-border)]">
              {table.columns.map((c) => (
                <th key={c.key} className={`py-2 pr-3 font-medium whitespace-nowrap ${c.align === "right" ? "text-right" : ""}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.slice(0, 25).map((row, i) => (
              <tr key={i} className="border-b border-[var(--admin-border)]/50 hover:bg-[var(--admin-bg)] transition-colors">
                {table.columns.map((c) => (
                  <td key={c.key} className={`py-2 pr-3 whitespace-nowrap ${c.align === "right" ? "text-right" : ""}`}>
                    {String(row[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
            {!table.rows.length && (
              <tr>
                <td colSpan={table.columns.length} className="py-4 text-center text-[var(--admin-muted)]">
                  Нет данных за период
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HealthCard({ health }: { health: HealthBlock }) {
  const color = health.value >= 80 ? "#22c55e" : health.value >= 60 ? "#06b6d4" : health.value >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
      <h3 className="font-semibold text-sm mb-3">💚 Индекс здоровья бизнеса</h3>
      <div className="flex items-center gap-4">
        <div className="relative w-28 h-28 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--admin-bg)" strokeWidth="10" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke={color} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${(health.value / 100) * 264} 264`}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold" style={{ color }}>{health.value}</div>
            <div className="text-[9px] text-[var(--admin-muted)]">из 100</div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm mb-2">{health.label}</div>
          <div className="space-y-1.5">
            {health.factors.map((f) => (
              <div key={f.label} className="flex items-center gap-2 text-[11px]">
                <span className={f.effect === "up" ? "text-success" : "text-danger"}>
                  {f.effect === "up" ? "▲" : "▼"}
                </span>
                <span className="flex-1 text-[var(--admin-muted)] truncate">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PulseCard({ pulse }: { pulse: PulseItem[] }) {
  const icons: Record<PulseItem["type"], string> = {
    sales: "📈",
    alert: "⚠️",
    partner: "🤝",
    system: "⚙️",
    support: "🎧",
  };
  return (
    <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
      <h3 className="font-semibold text-sm mb-3">🫀 Пульс компании (24 ч)</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar pr-1">
        {pulse.slice(0, 12).map((p, i) => (
          <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-xl bg-[var(--admin-bg)]">
            <span className="text-sm shrink-0">{icons[p.type] ?? "•"}</span>
            <div className="min-w-0">
              <div className="font-medium truncate">{p.title}</div>
              <div className="text-[10px] text-[var(--admin-muted)]">{p.time}</div>
            </div>
          </div>
        ))}
        {!pulse.length && <div className="text-xs text-[var(--admin-muted)]">Нет событий за 24 часа</div>}
      </div>
    </div>
  );
}

function AiInsightCard({ ai }: { ai: AiInsight[] }) {
  const levelMeta: Record<AiInsight["level"], { icon: string; cls: string }> = {
    positive: { icon: "✅", cls: "border-success/30 bg-success/5" },
    medium: { icon: "⚡", cls: "border-amber-500/30 bg-amber-500/5" },
    high: { icon: "🚨", cls: "border-danger/30 bg-danger/5" },
    info: { icon: "💡", cls: "border-primary/30 bg-primary/5" },
  };
  return (
    <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
      <h3 className="font-semibold text-sm mb-3">🤖 AI-инсайты и рекомендации</h3>
      <div className="space-y-2">
        {ai.map((a, i) => {
          const m = levelMeta[a.level] ?? levelMeta.info;
          return (
            <div key={i} className={`p-2.5 rounded-xl border text-xs ${m.cls}`}>
              <div className="font-semibold flex items-center gap-1.5">
                <span>{m.icon}</span> {a.title}
              </div>
              {a.detail && <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">{a.detail}</div>}
            </div>
          );
        })}
        {!ai.length && <div className="text-xs text-[var(--admin-muted)]">AI-анализ недоступен за период</div>}
      </div>
    </div>
  );
}

/* ─── Основной компонент ─── */

export default function BiCenter() {
  const [section, setSection] = useState<AnalyticsSection>("overview");
  const [period, setPeriod] = useState("month");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [partner, setPartner] = useState("");
  const [data, setData] = useState<AnalyticsSectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);

  // Список партнёров для фильтра (Гл. 2.7). setState в эффекте откладываем на
  // микротаск — синхронный вызов ловит react-hooks/set-state-in-effect.
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch("/api/admin/search?q=&scope=partners")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.partners?.length) {
            setPartners(d.partners.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
          }
        })
        .catch(() => {});
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ period });
    if (country) params.set("country", country);
    if (city) params.set("city", city);
    if (type) params.set("type", type);
    if (partner) params.set("partnerId", partner);
    fetch(`/api/admin/analytics/${section}?${params}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await describeApiError(r, "Ошибка загрузки данных"));
        return r.json();
      })
      .then((d: AnalyticsSectionData) => {
        setData(d);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Неизвестная ошибка");
        setLoading(false);
      });
  }, [section, period, country, city, type, partner]);

  // Первичная загрузка: откладываем, чтобы setState в load не ловил
  // react-hooks/set-state-in-effect (как в AdminHeader).
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const resetFilters = () => {
    setCountry("");
    setCity("");
    setType("");
    setPartner("");
  };

  const chips: ActiveFilterChip[] = [
    { key: "period", label: `Период: ${PERIODS.find((p) => p.key === period)?.label ?? period}` },
  ];
  if (country) chips.push({ key: "country", label: `Страна: ${country}`, onClear: () => { setCountry(""); setCity(""); } });
  if (city) chips.push({ key: "city", label: `Город: ${city}`, onClear: () => setCity("") });
  if (type) chips.push({ key: "type", label: `Услуга: ${SERVICE_TYPES.find((t) => t.key === type)?.label ?? type}`, onClear: () => setType("") });
  if (partner) {
    const partnerName = partners.find((p) => p.id === partner)?.name ?? partner;
    chips.push({ key: "partner", label: `Партнёр: ${partnerName}`, onClear: () => setPartner("") });
  }

  return (
    <div className="space-y-5">
      {/* ── Заголовок раздела + навигация (2.6) ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Центр бизнес-аналитики</h1>
          <div className="text-xs text-[var(--admin-muted)] mt-1">
            Business Intelligence Center · {data?.periodLabel ?? "…"} ·{" "}
            <span className="text-success">● данные обновлены</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            className="px-3 h-9 rounded-xl bg-[var(--admin-card)] border border-[var(--admin-border)] text-sm font-medium hover:border-primary transition-colors"
          >
            ↻ Обновить
          </button>
          <button
            onClick={() => {
              const json = JSON.stringify(data, null, 2);
              const blob = new Blob([json], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `bi-${section}-${period}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
            className="px-3 h-9 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            ⬇ Экспорт
          </button>
        </div>
      </div>

      {/* ── Вкладки разделов (2.3) ── */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSection(t.key)}
            className={`shrink-0 px-3.5 h-9 rounded-xl text-sm font-medium transition-all ${
              section === t.key
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "bg-[var(--admin-card)] border border-[var(--admin-border)] text-[var(--admin-muted)] hover:text-primary hover:border-primary/40"
            }`}
          >
            {t.icon} {t.title}
          </button>
        ))}
      </div>

      {/* ── Панель фильтров (2.7) ── */}
      <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 h-9 rounded-xl text-xs font-medium transition-colors ${
                  period === p.key ? "bg-secondary text-white" : "text-[var(--admin-muted)] hover:bg-[var(--admin-bg)]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-3 h-9 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm outline-none focus:border-primary"
          >
            <option value="">Услуга: все</option>
            {SERVICE_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
          <input
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setCity("");
            }}
            placeholder="Код страны (AZ, TR…)…"
            title="ISO-код страны, например AZ, TR, GE, RU"
            className="px-3 h-9 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm outline-none focus:border-primary w-44"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Город…"
            className="px-3 h-9 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm outline-none focus:border-primary w-36"
          />
          <select
            value={partner}
            onChange={(e) => setPartner(e.target.value)}
            className="px-3 h-9 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm outline-none focus:border-primary max-w-44"
          >
            <option value="">Партнёр: все</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {(country || city || type || partner) && (
            <button
              onClick={resetFilters}
              className="px-3 h-9 rounded-xl text-xs font-medium text-danger border border-danger/30 hover:bg-danger/10 transition-colors"
            >
              ✕ Сбросить фильтры
            </button>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-[var(--admin-border)]">
          <ActiveFilterChips chips={chips} />
        </div>
      </div>

      {/* ── Состояния загрузки / ошибки ── */}
      {error && (
        <div className="bg-[var(--admin-card)] border border-red-200 rounded-2xl p-8 text-center max-w-md mx-auto">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-lg font-bold mb-2">Ошибка загрузки</h2>
          <p className="text-sm text-[var(--admin-muted)] mb-4">{error}</p>
          <button onClick={() => void load()} className="px-4 h-10 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors">
            Повторить
          </button>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-32 bg-[var(--admin-border)]/40 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* ── KPI-панель (2.8) ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-sm text-[var(--admin-muted)]">
                {data.title} — KPI
              </h2>
              <span className="text-[11px] text-[var(--admin-muted)]">{data.periodLabel}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {data.kpis.map((k) => (
                <KpiCardView key={k.key} kpi={k} />
              ))}
            </div>
          </div>

          {/* ── Индекс здоровья + Пульс (только Общая аналитика) ── */}
          {(data.health || data.pulse) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.health && <HealthCard health={data.health} />}
              {data.pulse && <PulseCard pulse={data.pulse} />}
            </div>
          )}

          {/* ── Воронки ── */}
          {data.funnels.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.funnels.map((f) => (
                <FunnelView key={f.key} funnel={f} />
              ))}
            </div>
          )}

          {/* ── Основные графики ── */}
          {data.series.length > 0 && (
            <div className={`grid gap-4 ${data.series.length > 2 ? "grid-cols-1 xl:grid-cols-3" : data.series.length === 2 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
              {data.series.map((s) => (
                <SeriesCard key={s.key} series={s} height={200} />
              ))}
            </div>
          )}

          {/* ── Диаграммы + рейтинги ── */}
          {(data.donuts.length > 0 || data.barLists.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.donuts.map((d) => (
                <DonutCard key={d.key} donut={d} />
              ))}
              {data.barLists.map((b) => (
                <BarListCard key={b.key} list={b} />
              ))}
            </div>
          )}

          {/* ── Таблицы ── */}
          {data.tables.length > 0 && (
            <div className="space-y-4">
              {data.tables.map((t) => (
                <TableCard key={t.key} table={t} />
              ))}
            </div>
          )}

          {/* ── AI-анализ ── */}
          <AiInsightCard ai={data.ai} />
        </>
      )}
    </div>
  );
}
