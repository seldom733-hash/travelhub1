"use client";

import { useState, useEffect, useCallback } from "react";
import { RevenueChart, DonutChart, CHART_COLORS } from "@/components/admin/charts";
import ActiveFilterChips, { type ActiveFilterChip } from "@/components/admin/ActiveFilterChips";
import { describeApiError } from "@/lib/api-error";

/* ─── Types ─── */
interface Sale {
  id: string;
  orderId: string;
  client: string;
  partner: string;
  service: string;
  category: string;
  categoryType: string;
  amount: number;
  commission: number;
  partnerAmount: number;
  currency: string;
  paymentStatus: "paid" | "pending" | "refunded";
  saleStatus: "completed" | "processing" | "cancelled";
  manager: string;
  createdAt: string;
  updatedAt: string;
  serviceDate: string;
}

interface KpiData {
  revenueToday: { value: number; change: number; ops: number; avgCheck: number };
  revenueMonth: { value: number; change: number; planPct: number; forecast: number };
  salesCount: { today: number; week: number; month: number };
  conversion: { views: number; bookings: number; paid: number; rate: number };
  avgCheck: { value: number; change: number };
  refunds: { count: number; amount: number; percent: number };
  topPartner: { name: string; revenue: number; count: number } | null;
  forecastAI: { expectedRevenue: number; expectedOrders: number; planProbability: number };
}

interface SalesData {
  kpi: KpiData;
  salesByCategory: { type: string; label: string; icon: string; count: number; revenue: number }[];
  revenueSeries: { labels: string[]; values: number[] } | { label: string; value: number }[];
  sales: Sale[];
  topPartners: { rank: number; name: string; revenue: number; count: number }[];
  planMonitoring: { label: string; plan: number; actual: number; percent: number }[];
  topManagers: { name: string; sales: number; amount: number; conversion: number }[];
  financial: { profit: number; commission: number; partnerPayouts: number; expectedPayouts: number };
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/* ─── Quick Actions ─── */
const QUICK_ACTIONS = [
  { icon: "➕", label: "Создать продажу", color: "bg-primary" },
  { icon: "📦", label: "Новый заказ", color: "bg-blue-500" },
  { icon: "📅", label: "Новое бронирование", color: "bg-violet-500" },
  { icon: "💳", label: "Добавить оплату", color: "bg-emerald-500" },
  { icon: "↩️", label: "Возврат", color: "bg-amber-500" },
  { icon: "📤", label: "Экспорт", color: "bg-gray-500" },
  { icon: "📥", label: "Импорт", color: "bg-gray-500" },
  { icon: "📄", label: "Отчет", color: "bg-indigo-500" },
  { icon: "🤖", label: "AI-анализ", color: "bg-fuchsia-500" },
  { icon: "⚙️", label: "Настроить", color: "bg-gray-500" },
];

/* ─── Подписи значений фильтров для чипов активных фильтров ─── */
const PERIOD_LABELS: Record<string, string> = {
  today: "Сегодня",
  week: "Неделя",
  month: "Месяц",
  quarter: "Квартал",
  year: "Год",
};

const COUNTRY_LABELS: Record<string, string> = {
  TR: "Турция",
  GE: "Грузия",
  AE: "ОАЭ",
  EG: "Египет",
};

const TYPE_LABELS: Record<string, string> = {
  TOUR: "Туры",
  HOTEL: "Отели",
  FLIGHT: "Авиабилеты",
  EXCURSION: "Экскурсии",
  GUIDE: "Гиды",
  TRANSFER: "Трансферы",
  SANATORIUM: "Санатории",
};

const SALE_STATUS_LABELS: Record<string, string> = {
  PAID: "Оплачен",
  PENDING: "Ожидает",
  REFUNDED: "Возврат",
  COMPLETED: "Завершён",
};

/* ─── Helper: Format Money ─── */
function fmtMoney(n: number): string {
  if (n >= 1000000) return `₽${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `₽${(n / 1000).toFixed(0)}K`;
  return `₽${n.toLocaleString()}`;
}

/* ─── Helper Components ─── */
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    refunded: "bg-red-100 text-red-700",
    completed: "bg-emerald-100 text-emerald-700",
    processing: "bg-blue-100 text-blue-700",
    cancelled: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    paid: "Оплачен",
    pending: "Ожидает",
    refunded: "Возврат",
    completed: "Завершена",
    processing: "В обработке",
    cancelled: "Отменена",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${styles[status] || "bg-gray-100 text-gray-700"}`}>
      {labels[status] || status}
    </span>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-[var(--admin-border)]/40 rounded-xl animate-pulse ${className}`} />;
}

/* ─── Main Component ─── */
export default function SalesCenter() {
  const [data, setData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [period, setPeriod] = useState("month");
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [chartMode, setChartMode] = useState<"day" | "week" | "month" | "quarter" | "year">("month");
  const [chartType, setChartType] = useState<"line" | "bar" | "area">("line");

  // Фильтры
  const [filters, setFilters] = useState({
    country: "",
    city: "",
    partnerId: "",
    type: "",
    status: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("period", period);
      params.set("page", page.toString());
      params.set("limit", "20");
      if (filters.country) params.set("country", filters.country);
      if (filters.city) params.set("city", filters.city);
      if (filters.partnerId) params.set("partnerId", filters.partnerId);
      if (filters.type) params.set("type", filters.type);
      if (filters.status) params.set("status", filters.status);

      const res = await fetch(`/api/admin/sales?${params.toString()}`);
      if (!res.ok) throw new Error(await describeApiError(res, "Ошибка загрузки данных"));
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  }, [period, page, filters]);

  useEffect(() => {
    // fetchData вызывает setState (setLoading/setError/setData) — запускаем её в
    // микротаске, чтобы не нарушать react-hooks/set-state-in-effect
    void Promise.resolve().then(fetchData);
  }, [fetchData]);

  // Поиск по таблице (клиент-сторонний)
  const filteredSales = data?.sales.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.id.toLowerCase().includes(q) ||
      s.client.toLowerCase().includes(q) ||
      s.partner.toLowerCase().includes(q) ||
      s.service.toLowerCase().includes(q)
    );
  }) || [];

  // ── Чипы активных фильтров в шапке таблицы (общий компонент ActiveFilterChips) ──
  // Показывают, какие фильтры/селекты применены; клик по ✕ сбрасывает фильтр.
  const clearFilterChip = (patch: Partial<typeof filters>, clearSearch = false) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    if (clearSearch) setSearchQuery("");
    setPage(1);
  };
  const activeFilterChips: ActiveFilterChip[] = [
    { key: "period", label: `Период: ${PERIOD_LABELS[period] ?? period}` },
  ];
  if (filters.country) {
    activeFilterChips.push({
      key: "country",
      label: `Страна: ${COUNTRY_LABELS[filters.country] ?? filters.country}`,
      onClear: () => clearFilterChip({ country: "" }),
    });
  }
  if (filters.city) activeFilterChips.push({ key: "city", label: `Город: ${filters.city}`, onClear: () => clearFilterChip({ city: "" }) });
  if (filters.partnerId) activeFilterChips.push({ key: "partnerId", label: `Партнёр: ${filters.partnerId}`, onClear: () => clearFilterChip({ partnerId: "" }) });
  if (filters.type) {
    activeFilterChips.push({ key: "type", label: `Категория: ${TYPE_LABELS[filters.type] ?? filters.type}`, onClear: () => clearFilterChip({ type: "" }) });
  }
  if (filters.status) {
    activeFilterChips.push({ key: "status", label: `Статус: ${SALE_STATUS_LABELS[filters.status] ?? filters.status}`, onClear: () => clearFilterChip({ status: "" }) });
  }
  if (searchQuery.trim()) {
    activeFilterChips.push({ key: "search", label: `Поиск: «${searchQuery.trim()}»`, onClear: () => clearFilterChip({}, true) });
  }

  // KPI карточки из реальных данных
  const kpiCards = data
    ? [
        {
          title: "Доход сегодня",
          value: fmtMoney(data.kpi.revenueToday.value),
          change: `${data.kpi.revenueToday.change >= 0 ? "+" : ""}${data.kpi.revenueToday.change.toFixed(1)}%`,
          changeType: data.kpi.revenueToday.change >= 0 ? "up" : ("down" as const),
          subtitle: `${data.kpi.revenueToday.ops} продаж · Средний чек ${fmtMoney(data.kpi.revenueToday.avgCheck)}`,
          icon: "💰",
          color: "from-emerald-500 to-teal-500",
        },
        {
          title: "Доход месяца",
          value: fmtMoney(data.kpi.revenueMonth.value),
          change: `План: ${data.kpi.revenueMonth.planPct}%`,
          changeType: "neutral" as const,
          subtitle: `Прогноз: ${fmtMoney(data.kpi.revenueMonth.forecast)}`,
          icon: "📈",
          color: "from-blue-500 to-indigo-500",
        },
        {
          title: "Количество продаж",
          value: data.kpi.salesCount.month.toLocaleString(),
          change: `Сегодня: ${data.kpi.salesCount.today}`,
          changeType: "up" as const,
          subtitle: `Неделя: ${data.kpi.salesCount.week} · Месяц: ${data.kpi.salesCount.month}`,
          icon: "🛒",
          color: "from-violet-500 to-purple-500",
        },
        {
          title: "Конверсия",
          value: `${data.kpi.conversion.rate.toFixed(1)}%`,
          change: `${data.kpi.conversion.views} просмотров`,
          changeType: data.kpi.conversion.rate > 20 ? ("up" as const) : ("down" as const),
          subtitle: `Заявки: ${data.kpi.conversion.bookings} · Оплачено: ${data.kpi.conversion.paid}`,
          icon: "🎯",
          color: "from-pink-500 to-rose-500",
        },
        {
          title: "Средний чек",
          value: fmtMoney(data.kpi.avgCheck.value),
          change: `${data.kpi.avgCheck.change >= 0 ? "+" : ""}${data.kpi.avgCheck.change.toFixed(1)}%`,
          changeType: data.kpi.avgCheck.change >= 0 ? ("up" as const) : ("down" as const),
          subtitle: `За выбранный период`,
          icon: "💳",
          color: "from-amber-500 to-orange-500",
        },
        {
          title: "Возвраты",
          value: data.kpi.refunds.count.toString(),
          change: fmtMoney(data.kpi.refunds.amount),
          changeType: "down" as const,
          subtitle: `Процент: ${data.kpi.refunds.percent.toFixed(2)}%`,
          icon: "↩️",
          color: "from-red-500 to-rose-500",
        },
        {
          title: "Лучший партнер",
          value: data.kpi.topPartner?.name || "—",
          change: data.kpi.topPartner ? fmtMoney(data.kpi.topPartner.revenue) : "",
          changeType: "up" as const,
          subtitle: data.kpi.topPartner ? `${data.kpi.topPartner.count} продаж` : "",
          icon: "🏆",
          color: "from-cyan-500 to-blue-500",
        },
        {
          title: "Прогноз AI",
          value: fmtMoney(data.kpi.forecastAI.expectedRevenue),
          change: `Вероятность: ${data.kpi.forecastAI.planProbability}%`,
          changeType: "neutral" as const,
          subtitle: `Ожидается ${data.kpi.forecastAI.expectedOrders} заказов`,
          icon: "🤖",
          color: "from-fuchsia-500 to-pink-500",
        },
      ]
    : [];

  // Круговая диаграмма из реальных данных
  const categoryChartData = (data?.salesByCategory || []).map((cat, i) => ({
    label: cat.label,
    value: cat.revenue,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--admin-bg)] flex items-center justify-center">
        <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-8 text-center max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-[var(--admin-text)] mb-2">Ошибка загрузки</h2>
          <p className="text-sm text-[var(--admin-muted)] mb-1">{error}</p>
          <p className="text-[11px] text-[var(--admin-muted)]/70 mb-4">Подробности — в консоли браузера (F12)</p>
          <button
            onClick={fetchData}
            className="px-4 h-10 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--admin-bg)]">
      {/* ─── Breadcrumbs ─── */}
      <div className="px-4 lg:px-6 py-3 border-b border-[var(--admin-border)]">
        <nav className="text-xs text-[var(--admin-muted)] flex items-center gap-1.5">
          <span>Главная</span>
          <span>→</span>
          <span className="text-[var(--admin-text)] font-medium">Продажи</span>
        </nav>
      </div>

      {/* ─── Quick Actions ─── */}
      <div className="px-4 lg:px-6 py-3 border-b border-[var(--admin-border)] overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 min-w-max">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              className={`flex items-center gap-2 px-3 h-9 rounded-xl text-white text-xs font-medium ${action.color} hover:opacity-90 transition-opacity shrink-0`}
            >
              <span>{action.icon}</span>
              <span className="hidden sm:inline">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="px-4 lg:px-6 py-4">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
                <SkeletonBlock className="h-9 w-9 mb-3" />
                <SkeletonBlock className="h-6 w-20 mb-2" />
                <SkeletonBlock className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            {kpiCards.map((card) => (
              <div
                key={card.title}
                className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white text-lg shadow-lg`}>
                    {card.icon}
                  </div>
                  <span className="text-[11px] font-medium text-[var(--admin-muted)] leading-tight">{card.title}</span>
                </div>
                <div className="text-xl font-extrabold text-[var(--admin-text)] mb-1">{card.value}</div>
                {card.change && (
                  <div className={`text-xs font-semibold ${card.changeType === "up" ? "text-emerald-600" : card.changeType === "down" ? "text-red-600" : "text-[var(--admin-muted)]"}`}>
                    {card.change}
                  </div>
                )}
                {card.subtitle && (
                  <div className="text-[10px] text-[var(--admin-muted)] mt-1">{card.subtitle}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Filters ─── */}
      <div className="px-4 lg:px-6 pb-4">
        <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--admin-text)]">Фильтры</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setPage(1); fetchData(); }}
                className="px-3 h-8 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-dark transition-colors"
              >
                Применить
              </button>
              <button
                onClick={() => {
                  setFilters({ country: "", city: "", partnerId: "", type: "", status: "" });
                  setPage(1);
                }}
                className="px-3 h-8 rounded-lg border border-[var(--admin-border)] text-[var(--admin-muted)] text-xs font-medium hover:bg-[var(--admin-bg)] transition-colors"
              >
                Сбросить
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {/* Период */}
            <div>
              <label className="text-[10px] font-medium text-[var(--admin-muted)] mb-1 block">Период</label>
              <select
                value={period}
                onChange={(e) => { setPeriod(e.target.value); setPage(1); }}
                className="w-full h-9 px-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
              >
                <option value="today">Сегодня</option>
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
                <option value="quarter">Квартал</option>
                <option value="year">Год</option>
              </select>
            </div>
            {/* Страна */}
            <div>
              <label className="text-[10px] font-medium text-[var(--admin-muted)] mb-1 block">Страна</label>
              <select
                value={filters.country}
                onChange={(e) => setFilters({ ...filters, country: e.target.value })}
                className="w-full h-9 px-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
              >
                <option value="">Все</option>
                <option value="TR">Турция</option>
                <option value="GE">Грузия</option>
                <option value="AE">ОАЭ</option>
                <option value="EG">Египет</option>
              </select>
            </div>
            {/* Категория */}
            <div>
              <label className="text-[10px] font-medium text-[var(--admin-muted)] mb-1 block">Категория</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full h-9 px-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
              >
                <option value="">Все</option>
                <option value="TOUR">Туры</option>
                <option value="HOTEL">Отели</option>
                <option value="FLIGHT">Авиабилеты</option>
                <option value="EXCURSION">Экскурсии</option>
                <option value="GUIDE">Гиды</option>
                <option value="TRANSFER">Трансферы</option>
                <option value="SANATORIUM">Санатории</option>
              </select>
            </div>
            {/* Статус */}
            <div>
              <label className="text-[10px] font-medium text-[var(--admin-muted)] mb-1 block">Статус</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full h-9 px-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
              >
                <option value="">Все</option>
                <option value="PAID">Оплачен</option>
                <option value="PENDING">Ожидает</option>
                <option value="REFUNDED">Возврат</option>
                <option value="COMPLETED">Завершён</option>
              </select>
            </div>
            {/* Город */}
            <div>
              <label className="text-[10px] font-medium text-[var(--admin-muted)] mb-1 block">Город</label>
              <input
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                placeholder="Введите город"
                className="w-full h-9 px-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
              />
            </div>
            {/* Партнер */}
            <div>
              <label className="text-[10px] font-medium text-[var(--admin-muted)] mb-1 block">Партнер ID</label>
              <input
                value={filters.partnerId}
                onChange={(e) => setFilters({ ...filters, partnerId: e.target.value })}
                placeholder="ID партнера"
                className="w-full h-9 px-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Content: 3 Columns ─── */}
      <div className="px-4 lg:px-6 pb-4">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* ─── Left Column (25%) ─── */}
          <div className="xl:col-span-3 space-y-4">
            {/* Recent Sales */}
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--admin-text)] mb-3">Последние продажи</h3>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonBlock key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {data?.sales.slice(0, 5).map((sale) => (
                    <div
                      key={sale.id}
                      onClick={() => setSelectedSale(sale)}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--admin-bg)] transition-colors cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {sale.id.slice(-3)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-[var(--admin-text)] truncate">{sale.client}</div>
                        <div className="text-[10px] text-[var(--admin-muted)] truncate">{sale.partner}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-[var(--admin-text)]">{fmtMoney(sale.amount)}</div>
                        <StatusBadge status={sale.paymentStatus} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Partners */}
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--admin-text)] mb-3">Лучшие партнеры</h3>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <SkeletonBlock key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {data?.topPartners.slice(0, 5).map((partner) => (
                    <div key={partner.rank} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--admin-bg)] transition-colors">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center text-white text-xs font-bold">
                        {partner.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-[var(--admin-text)]">{partner.name}</div>
                        <div className="text-[10px] text-[var(--admin-muted)]">{partner.count} продаж</div>
                      </div>
                      <div className="text-xs font-bold text-primary">{fmtMoney(partner.revenue)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Recommendations */}
            <div className="bg-gradient-to-br from-fuchsia-500 to-pink-500 rounded-2xl p-4 text-white">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">🤖 AI Рекомендации</h3>
              <div className="space-y-2">
                {data?.kpi.revenueMonth.planPct && data.kpi.revenueMonth.planPct < 80 && (
                  <div className="bg-white/10 rounded-xl p-3 text-xs">
                    Выполнение плана: <span className="font-bold">{data.kpi.revenueMonth.planPct}%</span>. Рекомендуется усилить продажи.
                  </div>
                )}
                {data?.kpi.conversion.rate && data.kpi.conversion.rate < 25 && (
                  <div className="bg-white/10 rounded-xl p-3 text-xs">
                    Конверсия <span className="font-bold">{data.kpi.conversion.rate.toFixed(1)}%</span> ниже нормы. Оптимизируйте воронку продаж.
                  </div>
                )}
                <div className="bg-white/10 rounded-xl p-3 text-xs">
                  Прогноз дохода на месяц: <span className="font-bold">{fmtMoney(data?.kpi.forecastAI.expectedRevenue || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Center Column (50%) ─── */}
          <div className="xl:col-span-6 space-y-4">
            {/* Sales Chart */}
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[var(--admin-text)]">Динамика продаж</h3>
                <div className="flex items-center gap-1">
                  {(["day", "week", "month", "quarter", "year"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setChartMode(mode)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                        chartMode === mode ? "bg-primary text-white" : "text-[var(--admin-muted)] hover:bg-[var(--admin-bg)]"
                      }`}
                    >
                      {{ day: "День", week: "Неделя", month: "Месяц", quarter: "Квартал", year: "Год" }[mode]}
                    </button>
                  ))}
                </div>
              </div>
              {/* Chart type selector */}
              <div className="flex items-center gap-1 mb-3">
                {(["line", "bar", "area"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setChartType(type)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      chartType === type ? "bg-secondary text-white" : "text-[var(--admin-muted)] hover:bg-[var(--admin-bg)]"
                    }`}
                  >
                    {{ line: "📈 Линия", bar: "📊 Столбцы", area: "📉 Область" }[type]}
                  </button>
                ))}
              </div>
              {/* Chart */}
              <div className="bg-[var(--admin-bg)] rounded-xl p-4">
                {loading ? (
                  <SkeletonBlock className="h-[260px] w-full" />
                ) : (() => {
                  // Преобразуем данные из API в формат для RevenueChart
                  const seriesData = data?.revenueSeries;
                  let chartPoints: { label: string; value: number }[] = [];
                  
                  if (seriesData && typeof seriesData === "object" && "labels" in seriesData && "values" in seriesData) {
                    // Формат { labels: string[], values: number[] } из bucketize
                    chartPoints = seriesData.labels.map((label: string, i: number) => ({
                      label,
                      value: seriesData.values[i] || 0,
                    }));
                  } else if (Array.isArray(seriesData)) {
                    // Формат SeriesPoint[]
                    chartPoints = seriesData;
                  }
                  
                  return (
                    <RevenueChart
                      data={chartPoints}
                      mode={chartType}
                      height={260}
                    />
                  );
                })()}
              </div>
            </div>

            {/* Sales Table */}
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--admin-border)] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--admin-text)]">
                  Таблица продаж {data?.pagination.total ? `(${data.pagination.total})` : ""}
                </h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-[var(--admin-bg)] rounded-lg px-3 h-8">
                    <span className="text-[var(--admin-muted)]">🔍</span>
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Поиск..."
                      className="bg-transparent outline-none text-xs w-32"
                    />
                  </div>
                  <button className="px-2.5 h-8 rounded-lg border border-[var(--admin-border)] text-[11px] text-[var(--admin-muted)] hover:bg-[var(--admin-bg)] transition-colors">
                    📤 Экспорт
                  </button>
                </div>
              </div>
              {/* Чипы активных фильтров — что сейчас применено (общий компонент ActiveFilterChips).
                  Чип периода отображается всегда; остальные — по мере применения фильтров. */}
              {activeFilterChips.length > 0 && (
                <div className="px-4 py-2.5 border-b border-[var(--admin-border)]">
                  <ActiveFilterChips chips={activeFilterChips} />
                </div>
              )}
              {loading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonBlock key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-bg)]">
                          <th className="text-left px-4 py-2.5 font-semibold text-[var(--admin-muted)]">№</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-[var(--admin-muted)]">Клиент</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-[var(--admin-muted)]">Партнер</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-[var(--admin-muted)]">Услуга</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-[var(--admin-muted)]">Сумма</th>
                          <th className="text-center px-4 py-2.5 font-semibold text-[var(--admin-muted)]">Статус</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-[var(--admin-muted)]">Дата</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSales.map((sale) => (
                          <tr
                            key={sale.id}
                            onClick={() => setSelectedSale(sale)}
                            className="border-b border-[var(--admin-border)] hover:bg-[var(--admin-bg)] cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-3 font-medium text-[var(--admin-text)]">{sale.id.slice(-6)}</td>
                            <td className="px-4 py-3 text-[var(--admin-text)]">{sale.client}</td>
                            <td className="px-4 py-3 text-[var(--admin-text)]">{sale.partner}</td>
                            <td className="px-4 py-3 text-[var(--admin-text)] max-w-[200px] truncate">{sale.service}</td>
                            <td className="px-4 py-3 text-right font-bold text-[var(--admin-text)]">{fmtMoney(sale.amount)}</td>
                            <td className="px-4 py-3 text-center"><StatusBadge status={sale.paymentStatus} /></td>
                            <td className="px-4 py-3 text-[var(--admin-muted)]">{new Date(sale.createdAt).toLocaleDateString("ru-RU")}</td>
                          </tr>
                        ))}
                        {filteredSales.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-[var(--admin-muted)]">
                              Нет данных для отображения
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  {data?.pagination && data.pagination.totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-[var(--admin-border)] flex items-center justify-between text-xs text-[var(--admin-muted)]">
                      <span>
                        Показано {(data.pagination.page - 1) * data.pagination.limit + 1}–
                        {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} из {data.pagination.total}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page === 1}
                          className="px-2 py-1 rounded-lg border border-[var(--admin-border)] hover:bg-[var(--admin-bg)] disabled:opacity-50"
                        >
                          ←
                        </button>
                        {Array.from({ length: Math.min(5, data.pagination.totalPages) }, (_, i) => {
                          const p = Math.max(1, Math.min(page - 2, data.pagination.totalPages - 4)) + i;
                          if (p > data.pagination.totalPages) return null;
                          return (
                            <button
                              key={p}
                              onClick={() => setPage(p)}
                              className={`px-2 py-1 rounded-lg ${p === page ? "bg-primary text-white" : "border border-[var(--admin-border)] hover:bg-[var(--admin-bg)]"}`}
                            >
                              {p}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setPage(Math.min(data.pagination.totalPages, page + 1))}
                          disabled={page === data.pagination.totalPages}
                          className="px-2 py-1 rounded-lg border border-[var(--admin-border)] hover:bg-[var(--admin-bg)] disabled:opacity-50"
                        >
                          →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ─── Right Column (25%) ─── */}
          <div className="xl:col-span-3 space-y-4">
            {/* Category Sales Chart */}
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--admin-text)] mb-3">Продажи по категориям</h3>
              {loading ? (
                <SkeletonBlock className="h-[180px] w-full" />
              ) : (
                <DonutChart data={categoryChartData} size={180} />
              )}
            </div>

            {/* Financial Metrics */}
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--admin-text)] mb-3">Финансовые показатели</h3>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonBlock key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: "Прибыль", value: fmtMoney(data?.financial.profit || 0), color: "text-emerald-600" },
                    { label: "Комиссия платформы", value: fmtMoney(data?.financial.commission || 0), color: "text-blue-600" },
                    { label: "Выплаты партнерам", value: fmtMoney(data?.financial.partnerPayouts || 0), color: "text-violet-600" },
                    { label: "Ожидаемые выплаты", value: fmtMoney(data?.financial.expectedPayouts || 0), color: "text-amber-600" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-xs text-[var(--admin-muted)]">{item.label}</span>
                      <span className={`text-xs font-bold ${item.color}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sales Plan */}
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--admin-text)] mb-3">Мониторинг плана</h3>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonBlock key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {data?.planMonitoring.map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[var(--admin-muted)]">{item.label}</span>
                        <span className="text-xs font-semibold text-[var(--admin-text)]">{item.percent}%</span>
                      </div>
                      <div className="h-2 bg-[var(--admin-bg)] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            item.percent >= 90 ? "bg-emerald-500" : item.percent >= 70 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(item.percent, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Managers */}
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--admin-text)] mb-3">Лучшие менеджеры</h3>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <SkeletonBlock key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {data?.topManagers.map((manager, i) => (
                    <div key={manager.name} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--admin-bg)] transition-colors">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-[var(--admin-text)]">{manager.name}</div>
                        <div className="text-[10px] text-[var(--admin-muted)]">{manager.sales} продаж · Конверсия {manager.conversion}%</div>
                      </div>
                      <div className="text-xs font-bold text-primary">{fmtMoney(manager.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Sale Detail Sidebar ─── */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedSale(null)} />
          <div className="relative w-full max-w-[650px] bg-[var(--admin-card)] border-l border-[var(--admin-border)] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 z-10 px-6 py-4 border-b border-[var(--admin-border)] bg-[var(--admin-card)] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--admin-text)]">Продажа {selectedSale.id.slice(-6)}</h2>
                <p className="text-xs text-[var(--admin-muted)]">Заказ {selectedSale.orderId}</p>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="w-10 h-10 rounded-xl hover:bg-[var(--admin-bg)] flex items-center justify-center text-[var(--admin-muted)] transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedSale.paymentStatus} />
                <StatusBadge status={selectedSale.saleStatus} />
              </div>

              {/* General Info */}
              <div className="bg-[var(--admin-bg)] rounded-xl p-4">
                <h3 className="text-xs font-semibold text-[var(--admin-muted)] mb-3 uppercase">Общая информация</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[var(--admin-muted)]">Клиент:</span>
                    <span className="ml-2 font-medium text-[var(--admin-text)]">{selectedSale.client}</span>
                  </div>
                  <div>
                    <span className="text-[var(--admin-muted)]">Партнер:</span>
                    <span className="ml-2 font-medium text-[var(--admin-text)]">{selectedSale.partner}</span>
                  </div>
                  <div>
                    <span className="text-[var(--admin-muted)]">Услуга:</span>
                    <span className="ml-2 font-medium text-[var(--admin-text)]">{selectedSale.service}</span>
                  </div>
                  <div>
                    <span className="text-[var(--admin-muted)]">Категория:</span>
                    <span className="ml-2 font-medium text-[var(--admin-text)]">{selectedSale.category}</span>
                  </div>
                  <div>
                    <span className="text-[var(--admin-muted)]">Дата создания:</span>
                    <span className="ml-2 font-medium text-[var(--admin-text)]">
                      {new Date(selectedSale.createdAt).toLocaleString("ru-RU")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--admin-muted)]">Дата услуги:</span>
                    <span className="ml-2 font-medium text-[var(--admin-text)]">
                      {new Date(selectedSale.serviceDate).toLocaleString("ru-RU")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Finance */}
              <div className="bg-[var(--admin-bg)] rounded-xl p-4">
                <h3 className="text-xs font-semibold text-[var(--admin-muted)] mb-3 uppercase">Финансы</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--admin-muted)]">Стоимость:</span>
                    <span className="font-bold text-[var(--admin-text)]">{fmtMoney(selectedSale.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--admin-muted)]">Комиссия платформы (12%):</span>
                    <span className="font-medium text-blue-600">{fmtMoney(selectedSale.commission)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--admin-muted)]">Сумма партнеру (88%):</span>
                    <span className="font-medium text-violet-600">{fmtMoney(selectedSale.partnerAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--admin-muted)]">Валюта:</span>
                    <span className="font-medium text-[var(--admin-text)]">{selectedSale.currency}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors">
                  Редактировать
                </button>
                <button className="flex-1 h-10 rounded-xl border border-[var(--admin-border)] text-[var(--admin-muted)] text-sm font-medium hover:bg-[var(--admin-bg)] transition-colors">
                  История
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
