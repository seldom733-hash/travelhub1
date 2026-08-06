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

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
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
  type GeoRegion,
} from "@/lib/analytics";
import { BOOKING_STATUS_LABELS, ORDER_STATUS_LABELS, MANAGERS } from "@/lib/admin-data";
import { exportCSV, exportExcel, exportPDF, exportPNG } from "@/components/admin/dashboard-widgets";
import ReportBuilder from "@/components/admin/ReportBuilder";
import OperationsCenter from "@/components/admin/OperationsCenter";
import AnalyticsSettings, {
  loadBiSettings,
  saveBiSettings,
  DEFAULT_BI_SETTINGS,
  CURRENCY_SYMBOLS,
  AUTO_REFRESH_OPTIONS,
  BI_KPI_HISTORY_KEY,
  BI_KPI_HISTORY_RESET_EVENT,
  type BiSettings,
} from "@/components/admin/AnalyticsSettings";

const PERIODS = [
  { key: "today", label: "Сегодня" },
  { key: "yesterday", label: "Вчера" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "quarter", label: "Квартал" },
  { key: "year", label: "Год" },
];

const TABS: { key: string; title: string; icon: string; section?: AnalyticsSection }[] = [
  { key: "overview", title: "Общая", icon: "🏛️", section: "overview" },
  { key: "sales", title: "Продажи", icon: "💼", section: "sales" },
  { key: "orders", title: "Заказы", icon: "📦", section: "orders" },
  { key: "bookings", title: "Бронирования", icon: "📑", section: "bookings" },
  { key: "finance", title: "Финансы", icon: "💰", section: "finance" },
  { key: "crm", title: "Клиенты", icon: "👥", section: "crm" },
  { key: "partners", title: "Партнёры", icon: "🤝", section: "partners" },
  { key: "catalog", title: "Каталог", icon: "🗂️", section: "catalog" },
  { key: "marketing", title: "Маркетинг", icon: "📣", section: "marketing" },
  { key: "departments", title: "Подразделения", icon: "🏢", section: "departments" },
  { key: "ai", title: "AI Analytics", icon: "🤖", section: "ai" },
  { key: "operations", title: "Оперативно", icon: "🚨" },
  { key: "reports", title: "Отчёты", icon: "🧾" },
  { key: "settings", title: "Настройки", icon: "⚙️" },
];

const BOOKING_STATUSES = Object.entries(BOOKING_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const ORDER_STATUSES = Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const CURRENCIES = ["USD", "AZN", "EUR", "TRY", "RUB", "GBP"];

// Секции, где фильтры «Статус» и «Валюта» применяются к данным (Гл. 2.7).
const STATUS_SECTIONS: AnalyticsSection[] = ["overview", "sales", "orders", "bookings", "finance", "catalog", "marketing"];
const CURRENCY_SECTIONS: AnalyticsSection[] = ["overview", "sales", "orders", "bookings", "finance", "catalog", "marketing", "departments"];

// Роль пользователя → раздел аналитики по умолчанию (Гл. 2.2: каждая роль
// получает собственный набор аналитических панелей).
const ROLE_DEFAULT_TAB: Record<string, string> = {
  FINANCE: "finance",
  MARKETER: "marketing",
  ANALYST: "overview",
  MODERATOR: "catalog",
  PARTNER: "partners",
  DIRECTOR: "overview",
  ADMIN: "overview",
};

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

// Максимум точек в истории значений KPI («последние N обновлений»).
const KPI_HISTORY_MAX = 12;
// Лимит контекстов (раздел + набор фильтров) в localStorage: при превышении
// вытесняются самые старые по времени последнего обновления.
const KPI_HISTORY_MAX_CONTEXTS = 20;

// Запись истории по одному контексту: значения (кап KPI_HISTORY_MAX) и время
// последнего обновления — для вытеснения старых контекстов при лимите.
interface KpiHistoryEntry {
  values: number[];
  updatedAt: number;
}
type KpiHistoryStore = Record<string, KpiHistoryEntry>;

// Единый ключ контекста данных для истории KPI: раздел + все активные фильтры.
// Используется и при записи истории (load), и при чтении (рендер) — чтобы эти
// два места не разошлись при добавлении новых фильтров.
function dataContextKey(
  section: AnalyticsSection | null,
  period: string,
  country: string,
  city: string,
  type: string,
  partner: string,
  manager: string,
  from: string,
  to: string,
  status: string,
  currency: string
): string {
  return [section, period, country, city, type, partner, manager, from, to, status, currency].join("|");
}

// Валюта отображения сумм — переключается из «Настроек аналитики» (localStorage).
let activeCurrencySymbol = "$";

export function setActiveCurrencySymbol(sym: string) {
  activeCurrencySymbol = sym;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " " + activeCurrencySymbol;

const fmtNumber = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n));

/* ─── Сохранённые представления и журнал изменений BI (Гл. 2.6) ─── */

const BI_VIEWS_KEY = "bi-saved-views";
const BI_HISTORY_KEY = "bi-center-history";
const BI_HISTORY_MAX = 60;

interface BiSavedView {
  name: string;
  tab: string;
  period: string;
  country: string;
  city: string;
  type: string;
  partner: string;
  manager: string;
  from: string;
  to: string;
  status: string;
  currency: string;
  savedAt: number;
}

interface BiHistoryEntry {
  at: number;
  action: string;
  detail?: string;
}

/** Текущее представление (вкладка + фильтры) в виде сериализуемого объекта. */
function currentViewState(state: {
  tab: string;
  period: string;
  country: string;
  city: string;
  type: string;
  partner: string;
  manager: string;
  from: string;
  to: string;
  status: string;
  currency: string;
}): Omit<BiSavedView, "name" | "savedAt"> {
  return {
    tab: state.tab,
    period: state.period,
    country: state.country,
    city: state.city,
    type: state.type,
    partner: state.partner,
    manager: state.manager,
    from: state.from,
    to: state.to,
    status: state.status,
    currency: state.currency,
  };
}

function loadBiViews(): BiSavedView[] {
  try {
    const raw = localStorage.getItem(BI_VIEWS_KEY);
    if (raw) return JSON.parse(raw) as BiSavedView[];
  } catch {
    /* ignore */
  }
  return [];
}

function loadBiHistory(): BiHistoryEntry[] {
  try {
    const raw = localStorage.getItem(BI_HISTORY_KEY);
    if (raw) return JSON.parse(raw) as BiHistoryEntry[];
  } catch {
    /* ignore */
  }
  return [];
}

function persistBiViews(views: BiSavedView[]) {
  try {
    localStorage.setItem(BI_VIEWS_KEY, JSON.stringify(views));
  } catch {
    /* ignore */
  }
}

function persistBiHistory(history: BiHistoryEntry[]) {
  try {
    localStorage.setItem(BI_HISTORY_KEY, JSON.stringify(history.slice(-BI_HISTORY_MAX)));
  } catch {
    /* ignore */
  }
}

/** Собрать таблицу строк из данных раздела (KPI + таблицы) для экспорта (Гл. 2.6). */
function buildExportRows(data: AnalyticsSectionData): { title: string; rows: (string | number)[][] }[] {
  const out: { title: string; rows: (string | number)[][] }[] = [];
  // KPI-панель: показатель / значение / изменение
  const kpiRows: (string | number)[][] = [["Показатель", "Значение", "Изменение к прошлому"]];
  for (const k of data.kpis) {
    kpiRows.push([
      k.title,
      `${k.value}${k.unit ?? ""}`,
      k.change !== undefined ? `${k.change >= 0 ? "+" : ""}${k.change.toFixed(1)}%` : "—",
    ]);
  }
  out.push({ title: `${data.title} — KPI`, rows: kpiRows });
  // Каждая таблица раздела
  for (const t of data.tables) {
    const rows: (string | number)[][] = [t.columns.map((c) => c.label)];
    for (const r of t.rows) rows.push(t.columns.map((c) => r[c.key] ?? ""));
    out.push({ title: t.title, rows });
  }
  return out;
}

// Форматирование значения KPI: unit «%» и прочие подписи («шт», «чел.», «ч»,
// «×», «/100») добавляются как есть; БЕЗ unit значение считается денежным и
// выводится с валютой отображения из «Настроек аналитики».
const formatKpiValue = (kpi: KpiCard) => {
  if (kpi.unit === "%") return `${kpi.value.toFixed(1)}%`;
  if (kpi.unit) return `${kpi.value}${kpi.unit}`;
  return fmtMoney(kpi.value);
};

/* ─── Вспомогательные отрисовщики ─── */

/* Единые иконки и акценты KPI-карточек — согласованы с Центром управления. */
const KPI_META: [string, string, string][] = [
  ["revenue", "💰", "#16a34a"],
  ["orders", "📦", "#3b82f6"],
  ["bookings", "📑", "#06b6d4"],
  ["conversion", "🎯", "#f59e0b"],
  ["avgCheck", "🧾", "#8b5cf6"],
  ["commission", "📊", "#8b5cf6"],
  ["profit", "📈", "#16a34a"],
  ["refund", "↩️", "#ef4444"],
  ["client", "👥", "#3b82f6"],
  ["partner", "🤝", "#14b8a6"],
  ["health", "💚", "#22c55e"],
  ["traffic", "🚦", "#06b6d4"],
  ["catalog", "🗂️", "#f97316"],
  ["service", "🛎️", "#f97316"],
  ["repeat", "🔁", "#8b5cf6"],
  ["activity", "⚡", "#06b6d4"],
];
const kpiMeta = (key: string) => {
  const m = KPI_META.find(([k]) => key.includes(k));
  return m ? { icon: m[1], color: m[2] } : { icon: "📊", color: "#64748b" };
};

function KpiCardView({
  kpi,
  history,
  onDrill,
}: {
  kpi: KpiCard;
  // История значений за последние обновления (автообновление / ручное «Обновить»).
  history?: number[];
  onDrill?: (kpi: KpiCard) => void;
}) {
  const toneColor =
    kpi.tone === "positive" ? "text-success" : kpi.tone === "negative" ? "text-danger" : "text-[var(--admin-muted)]";
  const changeColor = (kpi.change ?? 0) >= 0 ? "text-success" : "text-danger";
  const value = formatKpiValue(kpi);
  const { icon, color } = kpiMeta(kpi.key);

  return (
    <button
      onClick={() => onDrill?.(kpi)}
      title="Кликните для детализации (drill-down)"
      className="ac-card ac-card-hover p-3.5 group text-left w-full"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="ac-kpi-icon shrink-0" style={{ background: `${color}1a`, color }}>
            {icon}
          </span>
          <span className="text-[11px] text-[var(--admin-muted)] font-medium leading-tight line-clamp-2">{kpi.title}</span>
        </div>
        {(kpi.forecast ?? 0) > 0 && (
          <span className="ac-badge bg-primary/10 text-primary shrink-0">AI</span>
        )}
      </div>
      <div className={`text-2xl font-bold mt-2.5 ${toneColor}`}>{value}</div>
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
      {/* Мини-график «последние N обновлений» — история значений KPI,
          накопленная автообновлением и ручными обновлениями. */}
      {history && history.length >= 2 && (
        <div className="mt-2 pt-2 border-t border-[var(--admin-border)]/60">
          <div className="text-[9px] text-[var(--admin-muted)] mb-1" title="Значения KPI за последние обновления">
            📈 история · {history.length} обновл.
          </div>
          <Sparkline data={history} color="#f97316" height={20} />
        </div>
      )}
    </button>
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
        <table className="ac-table">
          <thead>
            <tr>
              {table.columns.map((c) => (
                <th key={c.key} className={`ac-th ${c.align === "right" ? "text-right" : ""}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.slice(0, 25).map((row, i) => (
              <tr key={i} className="ac-tr">
                {table.columns.map((c) => (
                  <td key={c.key} className={`ac-td ${c.align === "right" ? "text-right" : ""}`}>
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

/* ─── Интерактивная карта географии (2.9.10 «Страна → Регион → Курорт») ─── */

function GeoMapCard({ geo }: { geo: GeoRegion[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const max = Math.max(...geo.map((g) => g.revenue), 1);
  return (
    <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
      <h3 className="font-semibold text-sm mb-1">🗺️ География продаж</h3>
      <p className="text-[10px] text-[var(--admin-muted)] mb-3">
        Кликните страну, чтобы увидеть города (Страна → Курорт, Гл. 2.9.10)
      </p>
      <div className="space-y-2">
        {geo.slice(0, 10).map((g) => (
          <div key={g.code} className="border border-[var(--admin-border)] rounded-xl overflow-hidden">
            <button
              onClick={() => setOpen(open === g.code ? null : g.code)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-[var(--admin-bg)] transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-xs mb-1">
                  <span className="font-semibold truncate">
                    {g.code} · {g.name}
                  </span>
                  <span className="font-bold shrink-0">{fmtMoney(g.revenue)}</span>
                </div>
                <div className="h-1.5 bg-[var(--admin-bg)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-amber-500 transition-all"
                    style={{ width: `${Math.max(3, (g.revenue / max) * 100)}%` }}
                  />
                </div>
              </div>
              <span className={`text-[var(--admin-muted)] transition-transform ${open === g.code ? "rotate-180" : ""}`}>▾</span>
            </button>
            {open === g.code && (
              <div className="px-3 pb-2 pt-1 bg-[var(--admin-bg)]/50">
                {g.cities.length ? (
                  g.cities.map((c) => (
                    <div key={c.name} className="flex items-center justify-between text-[11px] py-1 border-b border-[var(--admin-border)]/50 last:border-0">
                      <span className="text-[var(--admin-muted)]">📍 {c.name}</span>
                      <span className="font-semibold">
                        {fmtMoney(c.revenue)} <span className="text-[var(--admin-muted)] font-normal">· {c.count} прод.</span>
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-[11px] text-[var(--admin-muted)] py-1">Нет данных по городам</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Модалка drill-down: клик по KPI → последние заказы/бронирования (Принцип 3) ─── */

interface DrillRow {
  id: string;
  label: string;
  detail: string;
  amount: number;
  status: string;
  at: string;
  /** order — заказ (реестр «Продажи и исполнение»), иначе — бронирование (Booking Center). */
  type?: "order" | "booking";
}

function DrillDownModal({
  kpi,
  rows,
  loading,
  onClose,
}: {
  kpi: KpiCard | null;
  rows: DrillRow[];
  loading: boolean;
  onClose: () => void;
}) {
  if (!kpi) return null;
  return (
    <div
      className="no-print fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 pt-16 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl w-full max-w-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold">🔍 Детализация: {kpi.title}</h3>
            <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">
              Значение: {formatKpiValue(kpi)}
              {kpi.detail ? ` · ${kpi.detail}` : ""} — последние записи за период
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--admin-muted)] hover:text-[var(--admin-text)] text-lg">
            ✕
          </button>
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-[var(--admin-border)]/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : rows.length ? (
          <div className="space-y-1.5 max-h-96 overflow-y-auto no-scrollbar pr-1">
            {rows.map((r) => {
              // Глубокий переход: заказы → карточка в реестре, бронирования → Booking Center
              const isOrder = r.type === "order" || !!r.label.match(/^ORD-/);
              const href = isOrder
                ? `/admin/sales-execution?open=${r.id}&tab=overview`
                : `/admin/bookings?open=${r.id}`;
              return (
                <Link
                  key={r.id}
                  href={href}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-[var(--admin-bg)] hover:border-primary border border-transparent transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{r.label}</div>
                    <div className="text-[10px] text-[var(--admin-muted)] truncate">{r.detail} · {r.at}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold">{fmtMoney(r.amount)}</div>
                    <div className="text-[10px] text-[var(--admin-muted)]">{r.status}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-[var(--admin-muted)]">Нет записей за выбранный период</div>
        )}
      </div>
    </div>
  );
}

/* ─── Основной компонент ─── */

export default function BiCenter() {
  // Текущая вкладка: аналитический раздел или инструмент (reports / settings).
  const [tab, setTab] = useState<string>("overview");
  const section: AnalyticsSection | null = TABS.find((t) => t.key === tab)?.section ?? null;
  const [settings, setSettings] = useState<BiSettings>({ ...DEFAULT_BI_SETTINGS });
  const [period, setPeriod] = useState("month");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [partner, setPartner] = useState("");
  const [manager, setManager] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [currency, setCurrency] = useState("");
  // Сохранённые представления и журнал изменений BI (Гл. 2.6)
  const [views, setViews] = useState<BiSavedView[]>([]);
  const [history, setHistory] = useState<BiHistoryEntry[]>([]);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  // Персональный набор KPI (Гл. 2.8): попап выбора карточек текущего раздела
  const [kpiMenuOpen, setKpiMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [data, setData] = useState<AnalyticsSectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Момент последнего успешного обновления — индикатор «обновлено HH:MM».
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  // Drill-down: выбранный KPI и строки детализации
  const [drillKpi, setDrillKpi] = useState<KpiCard | null>(null);
  const [drillRows, setDrillRows] = useState<DrillRow[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  // История значений KPI по обновлениям. Ключ: контекст данных (раздел + все
  // фильтры) + key KPI — графики разных периодов/фильтров не смешиваются.
  // Сохраняется в localStorage — переживает перезагрузку страницы.
  const [kpiHistory, setKpiHistory] = useState<KpiHistoryStore>({});
  // Флаг: история восстановлена из localStorage. До этого сохранение пропускаем —
  // иначе первый же эффект затёр бы сохранённые данные пустым состоянием.
  const [kpiHydrated, setKpiHydrated] = useState(false);

  // Загрузка настроек аналитики (валюта, период по умолчанию, плотность KPI).
  // Вкладка и период из «Поделиться» (?tab=&period=) имеют приоритет над настройками.
  useEffect(() => {
    const timer = setTimeout(() => {
      const s = loadBiSettings();
      setSettings(s);
      const urlTab = new URLSearchParams(window.location.search).get("tab");
      const urlPeriod = new URLSearchParams(window.location.search).get("period");
      if (urlTab && TABS.some((t) => t.key === urlTab)) {
        setTab(urlTab);
      } else {
        // Раздел по умолчанию по роли пользователя (2.2)
        fetch("/api/auth/me")
          .then((r) => (r.ok ? r.json() : null))
          .then((u: { role?: string } | null) => {
            const roleTab = u?.role ? ROLE_DEFAULT_TAB[u.role] : undefined;
            if (roleTab && TABS.some((t) => t.key === roleTab)) setTab(roleTab);
          })
          .catch(() => {});
      }
      setPeriod(urlPeriod ?? s.defaultPeriod);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Валюта отображения сумм (Настройки аналитики) — обновляет модульную переменную
  useEffect(() => {
    setActiveCurrencySymbol(CURRENCY_SYMBOLS[settings.currency] ?? "$");
  }, [settings.currency]);

  // Восстановление истории KPI из localStorage (переживает перезагрузку).
  // Валидируем форму (массивы значений), битые записи отбрасываем, лимит
  // контекстов применяем сразу — хранилище не может разрастись сверх лимита.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem(BI_KPI_HISTORY_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (parsed && typeof parsed === "object") {
            const store: KpiHistoryStore = {};
            for (const [key, entry] of Object.entries(parsed as Record<string, KpiHistoryEntry>)) {
              if (Array.isArray(entry?.values) && typeof entry.updatedAt === "number") store[key] = entry;
            }
            const keys = Object.keys(store);
            if (keys.length > KPI_HISTORY_MAX_CONTEXTS) {
              const sorted = keys.sort((a, b) => store[a].updatedAt - store[b].updatedAt);
              for (const stale of sorted.slice(0, keys.length - KPI_HISTORY_MAX_CONTEXTS)) delete store[stale];
            }
            setKpiHistory(store);
          }
        }
      } catch {
        /* ignore */
      }
      setKpiHydrated(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Сброс истории KPI из «Настроек аналитики» (кнопка «🗑 Сбросить историю KPI»).
  useEffect(() => {
    const onReset = () => setKpiHistory({});
    window.addEventListener(BI_KPI_HISTORY_RESET_EVENT, onReset);
    return () => window.removeEventListener(BI_KPI_HISTORY_RESET_EVENT, onReset);
  }, []);

  // Сохранение истории KPI в localStorage при каждом изменении.
  useEffect(() => {
    if (!kpiHydrated) return;
    try {
      localStorage.setItem(BI_KPI_HISTORY_KEY, JSON.stringify(kpiHistory));
    } catch {
      /* ignore */
    }
  }, [kpiHistory, kpiHydrated]);

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

  // silent=true — фоновое автообновление по таймеру: не показываем скелетон,
  // чтобы данные не «мигали» при каждом интервале.
  const load = useCallback((silent?: boolean) => {
    // Инструменты (Отчёты/Настройки) данных не загружают.
    if (!section) return;
    if (!silent) setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    // Произвольный период (2.7): при заданных границах переключаемся на custom.
    if (from && to) {
      params.set("period", "custom");
      params.set("from", from);
      params.set("to", `${to}T23:59:59`);
    } else {
      params.set("period", period);
    }
    if (country) params.set("country", country);
    if (city) params.set("city", city);
    if (type) params.set("type", type);
    if (partner) params.set("partnerId", partner);
    if (manager) params.set("manager", manager);
    if (status) params.set("status", status);
    if (currency) params.set("currency", currency);
    fetch(`/api/admin/analytics/${section}?${params}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await describeApiError(r, "Ошибка загрузки данных"));
        return r.json();
      })
      .then((d: AnalyticsSectionData) => {
        setData(d);
        setLastUpdated(new Date());
        // Записываем значения KPI в историю (автообновление + «Обновить»),
        // ключ включает контекст, чтобы не смешивать периоды и фильтры.
        if (section) {
          const ctx = dataContextKey(section, period, country, city, type, partner, manager, from, to, status, currency);
          setKpiHistory((prev) => {
            const next = { ...prev };
            const now = Date.now();
            for (const k of d.kpis) {
              const key = `${ctx}|${k.key}`;
              const entry = next[key];
              next[key] = {
                // Guard: entry.values может быть битым (не массивом) в хранилище.
                values: [...(Array.isArray(entry?.values) ? entry.values : []), k.value].slice(-KPI_HISTORY_MAX),
                updatedAt: now,
              };
            }
            // Лимит контекстов: при превышении вытесняем самые старые (по времени
            // последнего обновления), чтобы localStorage не разрастался.
            const keys = Object.keys(next);
            if (keys.length > KPI_HISTORY_MAX_CONTEXTS) {
              const sorted = keys.sort((a, b) => next[a].updatedAt - next[b].updatedAt);
              for (const stale of sorted.slice(0, keys.length - KPI_HISTORY_MAX_CONTEXTS)) delete next[stale];
            }
            return next;
          });
        }
        if (!silent) setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Неизвестная ошибка");
        setLoading(false);
      });
  }, [section, period, country, city, type, partner, manager, from, to, status, currency]);

  // Drill-down: клик по KPI → последние заказы/бронирования за период (Принцип 3).
  const handleDrill = useCallback(
    (kpi: KpiCard) => {
      setDrillKpi(kpi);
      setDrillLoading(true);
      setDrillRows([]);
      const params = new URLSearchParams();
      if (from && to) {
        params.set("period", "custom");
        params.set("from", from);
        params.set("to", `${to}T23:59:59`);
      } else {
        params.set("period", period);
      }
      if (country) params.set("country", country);
      if (city) params.set("city", city);
      if (type) params.set("type", type);
      if (status) params.set("status", status);
      params.set("limit", "10");
      // Для заказных разделов берём заказы, иначе бронирования.
      const entity = section === "sales" || section === "orders" ? "orders" : "bookings";
      fetch(`/api/admin/${entity}?${params}`)
        .then(async (r) => {
          if (!r.ok) throw new Error(await describeApiError(r, "Ошибка загрузки детализации"));
          return r.json();
        })
        .then((d) => {
          const items = (d.orders ?? d.bookings ?? []) as {
            id: string;
            orderNumber?: string;
            amount?: number;
            status?: string;
            createdAt?: string;
            service?: { title?: string };
            user?: { firstName?: string; lastName?: string | null };
          }[];
          setDrillRows(
            items.map((it) => ({
              id: it.id,
              label: it.orderNumber ?? "Бронирование",
              detail: it.service?.title ?? it.user?.firstName ?? "—",
              amount: it.amount ?? 0,
              status: it.status ?? "",
              at: it.createdAt ? new Date(it.createdAt).toLocaleDateString("ru-RU") : "",
              type: "orderNumber" in it && it.orderNumber ? "order" : "booking",
            }))
          );
        })
        .catch(() => setDrillRows([]))
        .finally(() => setDrillLoading(false));
    },
    [section, period, country, city, type, status, from, to]
  );

  // Первичная загрузка: откладываем, чтобы setState в load не ловил
  // react-hooks/set-state-in-effect (как в AdminHeader).
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Автообновление по таймеру (Гл. 2.8): интервал задаётся в «Настройках»
  // (autoRefresh, минуты; 0 = выключено). Обновление тихое — без скелетона.
  // load меняет ссылку при каждой смене фильтра, поэтому держим актуальный
  // load в ref — каденция таймера фиксированная и не сбрасывается фильтрами
  // (иначе при активной смене фильтров таймер мог бы не срабатывать вовсе).
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const autoRefreshMinutes = settings.autoRefresh ?? 0;
  useEffect(() => {
    if (!section || autoRefreshMinutes <= 0) return;
    const id = setInterval(() => void loadRef.current(true), autoRefreshMinutes * 60_000);
    return () => clearInterval(id);
  }, [autoRefreshMinutes, section]);

  const resetFilters = () => {
    setCountry("");
    setCity("");
    setType("");
    setPartner("");
    setManager("");
    setFrom("");
    setTo("");
    setStatus("");
    setCurrency("");
  };

  // Загрузка сохранённых представлений и журнала изменений BI (Гл. 2.6).
  useEffect(() => {
    const timer = setTimeout(() => {
      setViews(loadBiViews());
      setHistory(loadBiHistory());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Журнал изменений BI (Гл. 2.6): фиксируем ключевые действия пользователя.
  const logBi = useCallback((action: string, detail?: string) => {
    setHistory((prev) => {
      const next = [...prev, { at: Date.now(), action, detail }];
      persistBiHistory(next);
      return next;
    });
  }, []);

  // Статусы для активного раздела: заказы (overview/sales/orders/finance — все эти
  // модули строятся на заказах, Гл. 3) или бронирования.
  const statusIsOrder = section === "overview" || section === "sales" || section === "orders" || section === "finance";
  const statusOptions = statusIsOrder ? ORDER_STATUSES : BOOKING_STATUSES;

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
  if (manager) chips.push({ key: "manager", label: `Менеджер: ${manager}`, onClear: () => setManager("") });
  if (from && to) chips.push({ key: "custom", label: `Период: ${from} — ${to}`, onClear: () => { setFrom(""); setTo(""); } });
  if (status) chips.push({ key: "status", label: `Статус: ${statusOptions.find((o) => o.value === status)?.label ?? status}`, onClear: () => setStatus("") });
  if (currency) chips.push({ key: "currency", label: `Валюта: ${currency}`, onClear: () => setCurrency("") });

  return (
    <div className="space-y-5">
      {/* ── Заголовок раздела + навигация (2.6) ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Центр бизнес-аналитики</h1>
          <div className="text-xs text-[var(--admin-muted)] mt-1">
            Business Intelligence Center · {data?.periodLabel ?? "…"} ·{" "}
            <span className="text-success" title="Момент последнего успешного обновления данных">
              ● обновлено{" "}
              {lastUpdated
                ? lastUpdated.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
                : "—"}
            </span>
            {autoRefreshMinutes > 0 && (
              <span className="text-primary" title="Данные обновляются автоматически по таймеру">
                {" "}· авто:{AUTO_REFRESH_OPTIONS.find((o) => o.value === autoRefreshMinutes)?.label ?? `${autoRefreshMinutes} мин`}
              </span>
            )}
          </div>
          {/* Печатный заголовок отчёта (Гл. 2.6) — виден только в PDF/печати.
              На вкладке «Отчёты» свой заголовок рисует конструктор отчётов. */}
          {section && (
            <div className="print-only">
              <div className="text-xl font-bold">Отчёт TravelHub — {TABS.find((t) => t.key === tab)?.title}</div>
              <div className="text-xs text-[var(--admin-muted)] mt-1">
                Период: {PERIODS.find((p) => p.key === period)?.label ?? period}
                {country ? ` · Страна: ${country}` : ""}
                {city ? ` · Город: ${city}` : ""}
                {type ? ` · Услуга: ${SERVICE_TYPES.find((t) => t.key === type)?.label ?? type}` : ""}
                {status ? ` · Статус: ${status}` : ""}
              </div>
              <div className="text-xs text-[var(--admin-muted)] mt-0.5">
                Сформирован: {new Date().toLocaleString("ru-RU")} · TravelHub Admin
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 no-print">
          <button
            onClick={() => {
              // «Поделиться» (2.6): копирует ссылку с текущими фильтрами.
              const params = new URLSearchParams();
              params.set("tab", tab);
              params.set("period", period);
              if (country) params.set("country", country);
              if (city) params.set("city", city);
              if (type) params.set("type", type);
              if (partner) params.set("partnerId", partner);
              if (manager) params.set("manager", manager);
              if (status) params.set("status", status);
              if (currency) params.set("currency", currency);
              const url = `${window.location.pathname}?${params.toString()}`;
              void navigator.clipboard?.writeText(url).then(() => {
                const btn = document.getElementById("bi-share-btn");
                if (btn) btn.textContent = "✓ Скопировано";
                setTimeout(() => {
                  if (btn) btn.textContent = "🔗 Поделиться";
                }, 1500);
              }).catch(() => {});
            }}
            id="bi-share-btn"
            className="ac-btn ac-btn-secondary"
          >
            🔗 Поделиться
          </button>
          {/* «Обновить» — только для аналитических разделов (на инструментах
              данные не загружаются). */}
          {section && (
            <button
              onClick={() => void load()}
              className="ac-btn ac-btn-secondary"
            >
              ↻ Обновить
            </button>
          )}
          {/* Сохранённые представления (Гл. 2.6 «Сохранить») */}
          <div className="relative">
            <button
              onClick={() => { setViewsOpen(!viewsOpen); setHistoryOpen(false); }}
              className="ac-btn ac-btn-secondary"
              title="Сохранить текущее представление (вкладка + фильтры)"
            >
              💾 Сохранить
            </button>
            {viewsOpen && (
              <div className="absolute right-0 mt-2 w-80 z-30 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-xl p-3 space-y-2">
                <div className="text-xs font-semibold">Сохранённые представления</div>
                <div className="flex gap-2">
                  <input
                    value={newViewName}
                    onChange={(e) => setNewViewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const name = newViewName.trim();
                        if (!name) return;
                        const next = [...views.filter((v) => v.name !== name), { name, ...currentViewState({ tab, period, country, city, type, partner, manager, from, to, status, currency }), savedAt: Date.now() }];
                        setViews(next);
                        persistBiViews(next);
                        setNewViewName("");
                        logBi("Сохранить представление", name);
                      }
                    }}
                    placeholder="Название представления…"
                    className="ac-input flex-1"
                  />
                  <button
                    onClick={() => {
                      const name = newViewName.trim();
                      if (!name) return;
                      const next = [...views.filter((v) => v.name !== name), { name, ...currentViewState({ tab, period, country, city, type, partner, manager, from, to, status, currency }), savedAt: Date.now() }];
                      setViews(next);
                      persistBiViews(next);
                      setNewViewName("");
                      logBi("Сохранить представление", name);
                    }}
                    className="ac-btn ac-btn-primary"
                  >
                    ✓
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto no-scrollbar space-y-1">
                  {views.map((v) => (
                    <div key={v.name} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--admin-bg)]">
                      <button
                        onClick={() => {
                          setTab(v.tab);
                          setPeriod(v.period);
                          setCountry(v.country);
                          setCity(v.city);
                          setType(v.type);
                          setPartner(v.partner);
                          setManager(v.manager);
                          setFrom(v.from);
                          setTo(v.to);
                          setStatus(v.status);
                          setCurrency(v.currency);
                          setViewsOpen(false);
                          logBi("Применить представление", v.name);
                        }}
                        className="flex-1 text-left text-xs truncate"
                        title={`Применить: ${v.tab} · ${v.period}${v.country ? ` · ${v.country}` : ""}`}
                      >
                        {v.name}
                        <span className="block text-[10px] text-[var(--admin-muted)]">
                          {new Date(v.savedAt).toLocaleDateString("ru-RU")}
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          const next = views.filter((x) => x.name !== v.name);
                          setViews(next);
                          persistBiViews(next);
                          logBi("Удалить представление", v.name);
                        }}
                        className="text-danger text-xs hover:bg-danger/10 rounded-lg p-1"
                        title="Удалить"
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                  {!views.length && <div className="text-[11px] text-[var(--admin-muted)]">Пока нет сохранённых представлений</div>}
                </div>
              </div>
            )}
          </div>
          {/* История изменений BI (Гл. 2.6) */}
          <button
            onClick={() => { setHistoryOpen(true); setViewsOpen(false); }}
            className="ac-btn ac-btn-secondary"
            title="Журнал действий с представлениями BI Center"
          >
            🕘 История
          </button>
          {/* Экспорт (Гл. 2.6): JSON / CSV / Excel / PDF / PNG */}
          {section && data && (
            <div className="relative">
              <button
                onClick={() => setExportOpen(!exportOpen)}
                className="ac-btn ac-btn-primary"
              >
                ⬇ Экспорт ▾
              </button>
              {exportOpen && (
                <div className="absolute right-0 mt-2 w-44 z-30 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-xl p-1.5 space-y-0.5">
                  {([
                    { key: "json", label: "📄 JSON (все данные)" },
                    { key: "csv", label: "📊 CSV (таблицы)" },
                    { key: "xls", label: "📗 Excel (таблицы)" },
                    { key: "pdf", label: "📕 PDF (таблицы)" },
                    { key: "png", label: "🖼 PNG (KPI)" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        setExportOpen(false);
                        const parts = buildExportRows(data);
                        const base = `bi-${section}-${period}`;
                        if (opt.key === "json") {
                          const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = `${base}.json`;
                          a.click();
                          URL.revokeObjectURL(a.href);
                        } else if (opt.key === "csv") {
                          const all: (string | number)[][] = [[data.title, "", ""]];
                          for (const p of parts) {
                            all.push(["", "", ""]);
                            for (const r of p.rows) all.push(r);
                          }
                          exportCSV(`${base}.csv`, all);
                        } else if (opt.key === "xls") {
                          const all: (string | number)[][] = [];
                          for (const p of parts) {
                            all.push([p.title, "", ""]);
                            for (const r of p.rows) all.push(r);
                          }
                          exportExcel(`${base}.xls`, data.title, all);
                        } else if (opt.key === "pdf") {
                          const all: (string | number)[][] = [];
                          for (const p of parts) {
                            all.push([p.title, "", ""]);
                            for (const r of p.rows) all.push(r);
                          }
                          exportPDF(`${base}.pdf`, data.title, all);
                        } else {
                          exportPNG(`${base}.png`, data.title, parts[0]?.rows ?? []);
                        }
                        logBi("Экспорт", `${opt.key.toUpperCase()} · ${data.title}`);
                      }}
                      className="w-full text-left text-xs px-2.5 py-2 rounded-xl hover:bg-[var(--admin-bg)] transition-colors"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* «PDF / Печать» (2.6): печатная версия страницы через window.print */}
          {(section || tab === "reports") && (
            <button
              onClick={() => window.print()}
              title="Экспорт в PDF — откройте печатную версию и сохраните в PDF"
              className="ac-btn ac-btn-inverse"
            >
              🖨 Печать
            </button>
          )}
        </div>
      </div>

      {/* ── Вкладки разделов (2.3) ── */}
      <div className="no-print ac-tabs overflow-x-auto no-scrollbar max-w-full">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setStatus(""); // статусы заказов и броней не взаимозаменяемы
              // Перечитываем настройки аналитики — они могли измениться во вкладке
              // «Настройки» (валюта, период по умолчанию, плотность KPI).
              const s = loadBiSettings();
              setSettings(s);
              if (s.defaultPeriod) setPeriod(s.defaultPeriod);
            }}
            className={`ac-tab shrink-0 ${tab === t.key ? "ac-tab-active" : ""}`}
          >
            {t.icon} {t.title}
          </button>
        ))}
      </div>

      {/* ── Панель фильтров (2.7) — для аналитических разделов ── */}
      {section && (
      <div className="no-print ac-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="ac-tabs flex-wrap">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`ac-tab ${period === p.key ? "ac-tab-active" : ""}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="ac-select max-w-48"
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
            className="ac-input w-44"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Город…"
            className="ac-input w-36"
          />
          <select
            value={partner}
            onChange={(e) => setPartner(e.target.value)}
            className="ac-select max-w-44"
          >
            <option value="">Партнёр: все</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {/* Ответственный менеджер (Гл. 2.7) — применяется в разделах Продажи/Заказы */}
          {(section === "sales" || section === "orders") && (
            <select
              value={manager}
              onChange={(e) => setManager(e.target.value)}
              className="ac-select max-w-44"
              title="Фильтр по ответственному менеджеру (разделы Продажи и Заказы)"
            >
              <option value="">Менеджер: все</option>
              {MANAGERS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
          {STATUS_SECTIONS.includes(section) && (
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="ac-select max-w-48"
            >
              <option value="">Статус: все</option>
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          {CURRENCY_SECTIONS.includes(section) && (
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="ac-select"
            >
              <option value="">Валюта: все</option>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-1 text-xs text-[var(--admin-muted)]">
            <span>с</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="ac-input"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-[var(--admin-muted)]">
            <span>по</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="ac-input"
            />
          </label>
          {(country || city || type || partner || manager || from || to || status || currency) && (
            <button
              onClick={resetFilters}
              className="ac-btn ac-btn-danger"
            >
              ✕ Сбросить фильтры
            </button>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-[var(--admin-border)]">
          <ActiveFilterChips chips={chips} />
        </div>
      </div>
      )}

      {/* ── Оперативные панели (Гл. 2: контроль-центры) ── */}
      {!section && tab === "operations" && <OperationsCenter />}

      {/* ── Инструменты: Конструктор отчётов и Настройки аналитики ── */}
      {!section && tab === "reports" && <ReportBuilder />}
      {!section && tab === "settings" && <AnalyticsSettings />}

      {/* ── Состояния загрузки / ошибки (только для аналитических разделов) ── */}
      {section && error && (
        <div className="bg-[var(--admin-card)] border border-red-200 rounded-2xl p-8 text-center max-w-md mx-auto">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-lg font-bold mb-2">Ошибка загрузки</h2>
          <p className="text-sm text-[var(--admin-muted)] mb-4">{error}</p>
          <button onClick={() => void load()} className="ac-btn ac-btn-primary">
            Повторить
          </button>
        </div>
      )}

      {section && loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-32 bg-[var(--admin-border)]/40 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {section && !loading && !error && data && (
        <>
          {/* ── KPI-панель (2.8) ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-sm text-[var(--admin-muted)]">
                {data.title} — KPI <span className="text-[10px] text-primary">клик по карточке = детализация</span>
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--admin-muted)]">{data.periodLabel}</span>
                {/* Персональный набор KPI (Гл. 2.8): выбор видимых карточек */}
                <div className="relative">
                  <button
                    onClick={() => setKpiMenuOpen(!kpiMenuOpen)}
                    className="text-[11px] text-[var(--admin-muted)] hover:text-primary transition-colors"
                    title="Настроить набор KPI (Гл. 2.8)"
                  >
                    ⚙️ Настроить KPI
                  </button>
                  {kpiMenuOpen && (
                    <div className="absolute right-0 mt-1 w-72 z-30 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-xl p-3 space-y-1 max-h-80 overflow-y-auto no-scrollbar">
                      <div className="text-xs font-semibold mb-1">Видимые показатели</div>
                      {data.kpis.map((k) => {
                        const hidden = settings.hiddenKpis[section] ?? [];
                        const isHidden = hidden.includes(k.key);
                        return (
                          <label key={k.key} className="flex items-center gap-2 text-[11px] py-1 px-1.5 rounded-lg hover:bg-[var(--admin-bg)] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!isHidden}
                              onChange={() => {
                                const cur = settings.hiddenKpis[section] ?? [];
                                const next = isHidden ? cur.filter((x) => x !== k.key) : [...cur, k.key];
                                const patch = { ...settings, hiddenKpis: { ...settings.hiddenKpis, [section]: next } };
                                setSettings(patch);
                                saveBiSettings(patch);
                              }}
                            />
                            <span className="truncate" title={k.title}>{k.title}</span>
                          </label>
                        );
                      })}
                      <div className="pt-2 mt-1 border-t border-[var(--admin-border)] flex gap-2">
                        <button
                          onClick={() => {
                            const patch = { ...settings, hiddenKpis: { ...settings.hiddenKpis, [section]: [] } };
                            setSettings(patch);
                            saveBiSettings(patch);
                          }}
                          className="text-[11px] text-primary"
                        >
                          Показать все
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Плотность KPI из «Настроек аналитики» (2.3) */}
            <div
              className={`grid gap-4 ${
                settings.kpiDensity === "compact"
                  ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
                  : settings.kpiDensity === "wide"
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
              }`}
            >
              {data.kpis
                .filter((k) => !(settings.hiddenKpis[section] ?? []).includes(k.key))
                .map((k) => {
                // История значений для текущего контекста (раздел + фильтры).
                const historyKey = dataContextKey(section, period, country, city, type, partner, manager, from, to, status, currency) + "|" + k.key;
                return (
                  <KpiCardView key={k.key} kpi={k} history={kpiHistory[historyKey]?.values} onDrill={handleDrill} />
                );
              })}
            </div>
          </div>

          {/* ── Индекс здоровья + Пульс (только Общая аналитика) ── */}
          {(data.health || data.pulse) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.health && <HealthCard health={data.health} />}
              {data.pulse && <PulseCard pulse={data.pulse} />}
            </div>
          )}

          {/* ── Интерактивная карта географии (2.9.10) ── */}
          {data.geo && data.geo.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GeoMapCard geo={data.geo} />
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

          {/* ── AI-анализ (глубина из «Настроек») ── */}
          <AiInsightCard ai={settings.aiDepth === "brief" ? data.ai.slice(0, 3) : data.ai} />
        </>
      )}

      {/* ── Модалка drill-down ── */}
      <DrillDownModal
        kpi={drillKpi}
        rows={drillRows}
        loading={drillLoading}
        onClose={() => setDrillKpi(null)}
      />

      {/* ── Модалка истории изменений BI (Гл. 2.6) ── */}
      {historyOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 pt-16 overflow-y-auto"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl w-full max-w-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-semibold">🕘 История изменений BI Center</h3>
                <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">
                  Журнал действий с представлениями и экспортом (Гл. 2.6)
                </div>
              </div>
              <button onClick={() => setHistoryOpen(false)} className="text-[var(--admin-muted)] hover:text-[var(--admin-text)] text-lg">
                ✕
              </button>
            </div>
            <div className="space-y-1.5 max-h-96 overflow-y-auto no-scrollbar pr-1">
              {[...history].reverse().map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-xl bg-[var(--admin-bg)]">
                  <span className="text-[10px] text-[var(--admin-muted)] shrink-0 pt-0.5">
                    {new Date(h.at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="font-medium">{h.action}</span>
                  {h.detail && <span className="text-[var(--admin-muted)] truncate">· {h.detail}</span>}
                </div>
              ))}
              {!history.length && <div className="py-8 text-center text-sm text-[var(--admin-muted)]">Журнал пуст</div>}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setHistory([]);
                  persistBiHistory([]);
                }}
                className="px-3 h-8 rounded-lg bg-[var(--admin-bg)] border border-danger/30 text-xs font-medium text-danger hover:bg-danger/10 transition-colors"
              >
                🗑 Очистить журнал
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
