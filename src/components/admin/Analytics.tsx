"use client";

import { useEffect, useState, useMemo } from "react";
import { RevenueChart, DonutChart, CHART_COLORS } from "@/components/admin/charts";
import { fmtMoney, fmtNumber, fmtDateTime } from "@/lib/admin-data";
import ActiveFilterChips, { type ActiveFilterChip } from "@/components/admin/ActiveFilterChips";
import { describeApiError } from "@/lib/api-error";

interface AnalyticsData {
  kpi: {
    totalRevenue: { value: number; change: number; forecast: number };
    salesCount: { value: number; change: number; perDay: number };
    bookings: { created: number; confirmed: number; pending: number; cancelled: number; completed: number; change: number };
    avgCheck: { value: number; change: number };
    profit: { value: number; margin: number };
    conversion: {
      views: number;
      bookings: number;
      paid: number;
      rate: number;
      viewsToBooking: number;
      change: number;
    };
    activeUsers: { total: number; today: number };
    newPartners: { registered: number; change: number; activated: number };
    newUsers: number;
  };
  revenueSeries: { labels: string[]; values: number[] };
  salesByCategory: { type: string; label: string; icon: string; count: number; revenue: number }[];
  salesByCountry: {
    code: string;
    country: string;
    revenue: number;
    count: number;
    cities: { name: string; count: number }[];
  }[];
  onlineUsers: { id: string; country: string; city: string; page: string; action: string; device: string; at: string }[];
  recentSales: {
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    user: { firstName: string; lastName: string | null; email: string };
    service: { title: string; type: string; country: string | null; provider: { companyName: string | null; firstName: string } | null };
  }[];
  importantEvents: { id: string; type: string; title: string; at: string }[];
  aiRecommendations: { level: string; title: string; effect: string }[];
}

const SUBMENU = [
  "Обзор", "Продажи", "Доходы", "Прибыль", "Заказы", "Бронирования", "Пользователи", "Партнеры",
  "Туры", "Отели", "Санатории", "Авиабилеты", "ЖД билеты", "Экскурсии", "Гиды", "Трансферы",
  "Фотографы", "Видеографы", "Направления", "География", "Конверсия", "Воронка продаж",
  "Маркетинг", "Источники трафика", "Финансы", "Возвраты", "Жалобы", "Рейтинг партнеров",
  "AI-Аналитика", "Конструктор отчетов", "Экспорт",
];

const PERIODS = [
  { key: "today", label: "Сегодня" },
  { key: "yesterday", label: "Вчера" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "quarter", label: "Квартал" },
  { key: "year", label: "Год" },
];

const STATUS_LABELS: Record<string, string> = {
  PAID: "Оплачен",
  CONFIRMED: "Подтверждён",
  COMPLETED: "Завершён",
  PENDING: "Ожидает",
  REFUNDED: "Возврат",
};

export default function Analytics() {
  const [activeSection, setActiveSection] = useState("Обзор");
  const [period, setPeriod] = useState("month");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [chartMode, setChartMode] = useState<"line" | "bar" | "area">("line");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    const params = new URLSearchParams({ period });
    if (country) params.set("country", country);
    if (city) params.set("city", city);
    if (type) params.set("type", type);
    fetch(`/api/admin/analytics?${params}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await describeApiError(r, "Ошибка загрузки данных"));
        return r.json();
      })
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Неизвестная ошибка"));
  };

  useEffect(() => {
    void Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, country, city, type]);

  const revSeries = useMemo(
    () => (data ? data.revenueSeries.labels.map((l, i) => ({ label: l, value: data.revenueSeries.values[i] })) : []),
    [data]
  );

  const countries = useMemo(
    () => (data ? data.salesByCountry.map((c) => ({ code: c.code, name: c.country })) : []),
    [data]
  );

  // Города выбранной страны (из данных географии за период)
  const selectedCountryCities = useMemo(() => {
    if (!data || !country) return [];
    const entry = data.salesByCountry.find((c) => c.code === country);
    return entry ? entry.cities.map((c) => c.name) : [];
  }, [data, country]);

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-[var(--admin-card)] border border-red-200 rounded-2xl p-8 text-center max-w-md mx-auto">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-lg font-bold text-[var(--admin-text)] mb-2">Ошибка загрузки</h2>
          <p className="text-sm text-[var(--admin-muted)] mb-1">{error}</p>
          <p className="text-[11px] text-[var(--admin-muted)]/70 mb-4">Подробности — в консоли браузера (F12)</p>
          <button
            onClick={load}
            className="px-4 h-10 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="h-11 bg-[var(--admin-border)]/40 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 bg-[var(--admin-border)]/40 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const { kpi } = data;
  const conversionSteps = [
    { label: "Посетитель (оценка)", value: Math.round(kpi.conversion.views * 3.2) },
    { label: "Поиск (оценка)", value: Math.round(kpi.conversion.views * 1.6) },
    { label: "Просмотр", value: kpi.conversion.views },
    { label: "Бронирование", value: kpi.conversion.bookings },
    { label: "Оплата", value: kpi.conversion.paid },
  ];

  // ── Чипы активных фильтров (общий компонент ActiveFilterChips) ──
  // Показывают, какие фильтры/селекты применены; клик по ✕ сбрасывает фильтр.
  const activeFilterChips: ActiveFilterChip[] = [
    { key: "period", label: `Период: ${PERIODS.find((p) => p.key === period)?.label ?? period}` },
  ];
  if (country) {
    activeFilterChips.push({
      key: "country",
      label: `Страна: ${countries.find((c) => c.code === country)?.name ?? country}`,
      onClear: () => {
        setCountry("");
        setCity("");
      },
    });
  }
  if (city) activeFilterChips.push({ key: "city", label: `Город: ${city}`, onClear: () => setCity("") });
  if (type) {
    activeFilterChips.push({
      key: "type",
      label: `Услуга: ${data.salesByCategory.find((c) => c.type === type)?.label ?? type}`,
      onClear: () => setType(""),
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Панель фильтров (3.3) ── */}
      <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            placeholder="Поиск…"
            className="px-3 h-9 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm outline-none focus:border-primary w-40"
          />
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
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setCity("");
            }}
            className="px-3 h-9 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm outline-none focus:border-primary"
          >
            <option value="">Страна: все</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={!selectedCountryCities.length}
            className="px-3 h-9 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm outline-none focus:border-primary disabled:opacity-50"
          >
            <option value="">Город: все</option>
            {selectedCountryCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-3 h-9 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm outline-none focus:border-primary"
          >
            <option value="">Услуга: все</option>
            {data.salesByCategory.map((c) => (
              <option key={c.type} value={c.type}>
                {c.label}
              </option>
            ))}
          </select>
          <button className="px-3 h-9 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors ml-auto">
            Экспорт
          </button>
        </div>

        {/* Индикация активных фильтров — что сейчас применено (общий компонент
            ActiveFilterChips). Чип периода отображается всегда; остальные — по мере
            применения фильтров. */}
        <div className="mt-3 pt-3 border-t border-[var(--admin-border)]">
          <ActiveFilterChips chips={activeFilterChips} />
        </div>
      </div>

      {/* ── Подменю подразделов (3.2) ── */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {SUBMENU.map((s) => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`shrink-0 px-3.5 h-9 rounded-xl text-sm font-medium transition-colors ${
              activeSection === s ? "bg-primary text-white" : "bg-[var(--admin-card)] border border-[var(--admin-border)] text-[var(--admin-muted)] hover:text-primary"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── KPI-панель (3.4) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            title: "Общий доход",
            value: fmtMoney(kpi.totalRevenue.value),
            sub: (
              <div className="text-xs text-[var(--admin-muted)]">
                <span className={kpi.totalRevenue.change >= 0 ? "text-success" : "text-danger"}>
                  {kpi.totalRevenue.change >= 0 ? "▲" : "▼"} {Math.abs(kpi.totalRevenue.change).toFixed(1)}%
                </span>{" "}
                · прогноз {fmtMoney(kpi.totalRevenue.forecast)}
              </div>
            ),
          },
          {
            title: "Количество продаж",
            value: fmtNumber(kpi.salesCount.value),
            sub: (
              <div className="text-xs text-[var(--admin-muted)]">
                <span className={kpi.salesCount.change >= 0 ? "text-success" : "text-danger"}>
                  {kpi.salesCount.change >= 0 ? "▲" : "▼"} {Math.abs(kpi.salesCount.change).toFixed(1)}%
                </span>{" "}
                · {kpi.salesCount.perDay.toFixed(1)}/день
              </div>
            ),
          },
          {
            title: "Бронирования",
            value: fmtNumber(kpi.bookings.created),
            sub: (
              <div className="text-xs text-[var(--admin-muted)] grid grid-cols-2 gap-x-2 mt-0.5">
                <span>✓ {kpi.bookings.confirmed} подтверждено</span>
                <span>⏳ {kpi.bookings.pending} ожидает</span>
                <span>✕ {kpi.bookings.cancelled} отменено</span>
                <span>🏁 {kpi.bookings.completed} завершено</span>
              </div>
            ),
          },
          {
            title: "Средний чек",
            value: fmtMoney(kpi.avgCheck.value),
            sub: (
              <div className="text-xs text-[var(--admin-muted)]">
                <span className={kpi.avgCheck.change >= 0 ? "text-success" : "text-danger"}>
                  {kpi.avgCheck.change >= 0 ? "▲" : "▼"} {Math.abs(kpi.avgCheck.change).toFixed(1)}%
                </span>{" "}
                к предыдущему периоду
              </div>
            ),
          },
          {
            title: "Прибыль платформы",
            value: fmtMoney(kpi.profit.value),
            sub: <div className="text-xs text-[var(--admin-muted)]">комиссия {kpi.profit.margin}% после выплаты партнёрам</div>,
          },
          {
            title: "Конверсия",
            value: `${kpi.conversion.rate.toFixed(0)}%`,
            sub: (
              <div className="text-xs text-[var(--admin-muted)]">
                бронь → оплата · {kpi.conversion.viewsToBooking.toFixed(1)}% просмотр → бронь
              </div>
            ),
          },
          {
            title: "Активные пользователи",
            value: fmtNumber(kpi.activeUsers.total),
            sub: <div className="text-xs text-[var(--admin-muted)]">уникальных за период</div>,
          },
          {
            title: "Новые партнеры",
            value: fmtNumber(kpi.newPartners.registered),
            sub: (
              <div className="text-xs text-[var(--admin-muted)]">
                <span className={kpi.newPartners.change >= 0 ? "text-success" : "text-danger"}>
                  {kpi.newPartners.change >= 0 ? "▲" : "▼"} {Math.abs(kpi.newPartners.change).toFixed(1)}%
                </span>{" "}
                · новые пользователи: {kpi.newUsers}
              </div>
            ),
          },
        ].map((card) => (
          <div key={card.title} className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4 hover:shadow-lg transition-shadow">
            <div className="text-sm text-[var(--admin-muted)] font-medium mb-1">{card.title}</div>
            <div className="text-2xl font-bold">{card.value}</div>
            <div className="mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Основная рабочая область (3.5) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Левая колонка */}
        <div className="space-y-4">
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">🤖 AI Рекомендации</h3>
            <div className="space-y-2">
              {data.aiRecommendations.map((r, i) => (
                <div key={i} className="p-2.5 rounded-xl border border-[var(--admin-border)] text-sm">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">{r.effect}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">⭐ Важные события</h3>
            <div className="space-y-2.5">
              {data.importantEvents.map((e) => (
                <div key={e.id} className="flex gap-2 text-sm">
                  <span className="text-base">{e.type === "partner" ? "🤝" : e.type === "refund" ? "↩️" : "📑"}</span>
                  <div>
                    <div className="text-xs">{e.title}</div>
                    <div className="text-[11px] text-[var(--admin-muted)]">{fmtDateTime(e.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Воронка конверсии */}
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">🔄 Воронка продаж</h3>
            <div className="space-y-1.5">
              {conversionSteps.map((s, i) => {
                const prev = i === 0 ? s.value * 1.1 : conversionSteps[i - 1].value;
                return (
                  <div key={s.label} className="text-xs">
                    <div className="flex justify-between text-[var(--admin-muted)]">
                      <span>{s.label}</span>
                      <span className="font-semibold text-[var(--admin-text)]">{fmtNumber(s.value)}</span>
                    </div>
                    <div className="h-1.5 bg-[var(--admin-bg)] rounded-full mt-0.5 overflow-hidden">
                      <div className="h-full bg-primary/70 rounded-full" style={{ width: `${Math.min(100, (s.value / prev) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Центральная колонка */}
        <div className="space-y-4 lg:col-span-2">
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h3 className="font-semibold text-sm">📊 График доходов</h3>
              <div className="flex items-center gap-1">
                {(["line", "bar", "area"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setChartMode(m)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      chartMode === m ? "bg-primary text-white" : "text-[var(--admin-muted)] hover:bg-[var(--admin-bg)]"
                    }`}
                  >
                    {m === "line" ? "Линия" : m === "bar" ? "Столбцы" : "Область"}
                  </button>
                ))}
              </div>
            </div>
            <RevenueChart data={revSeries} mode={chartMode} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="font-semibold text-sm mb-3">🍩 Продажи по услугам</h3>
              <DonutChart
                data={data.salesByCategory.map((s, i) => ({
                  label: s.label,
                  value: s.revenue,
                  color: CHART_COLORS[i % CHART_COLORS.length],
                }))}
              />
            </div>
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="font-semibold text-sm mb-3">🌍 Продажи по странам</h3>
              <div className="space-y-2">
                {data.salesByCountry.slice(0, 6).map((c) => (
                  <details key={c.code} className="group">
                    <summary className="cursor-pointer list-none">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--admin-muted)]">
                          {c.code} · {c.country}
                        </span>
                        <span className="font-semibold">{fmtMoney(c.revenue)}</span>
                      </div>
                      <div className="h-1.5 bg-[var(--admin-bg)] rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(c.revenue / Math.max(1, data.salesByCountry[0]?.revenue ?? 1)) * 100}%` }}
                        />
                      </div>
                    </summary>
                    <div className="mt-2 pl-3 space-y-1">
                      {c.cities.map((ct) => (
                        <div key={ct.name} className="flex justify-between text-xs text-[var(--admin-muted)]">
                          <span>📍 {ct.name}</span>
                          <span>{ct.count} продаж</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Правая колонка */}
        <div className="space-y-4">
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">🟢 Онлайн-пользователи</h3>
            <div className="space-y-2">
              {data.onlineUsers.slice(0, 6).map((u) => (
                <div key={u.id} className="flex items-center gap-2 text-sm p-2 rounded-xl bg-[var(--admin-bg)]">
                  <span className="w-2 h-2 bg-success rounded-full animate-pulse shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate text-xs">{u.country} · {u.city}</div>
                    <div className="text-[10px] text-[var(--admin-muted)] truncate">{u.page}</div>
                  </div>
                </div>
              ))}
              {!data.onlineUsers.length && <div className="text-sm text-[var(--admin-muted)]">Нет активности за 15 минут</div>}
            </div>
          </div>

          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">🛒 Последние продажи</h3>
            <div className="space-y-2">
              {data.recentSales.slice(0, 6).map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm p-2 rounded-xl hover:bg-[var(--admin-bg)] transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs shrink-0">
                    {s.user.firstName[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs">{s.user.firstName} {s.user.lastName}</div>
                    <div className="text-[10px] text-[var(--admin-muted)] truncate">{s.service.title}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-xs">{fmtMoney(s.amount)}</div>
                    <div className="text-[10px] text-success">{STATUS_LABELS[s.status]}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">🤖 AI Assistant</h3>
            <div className="space-y-2 text-sm">
              {["Покажи доход за последние 3 месяца", "Какие туры продаются хуже всего?", "Сравни доходы Азербайджана и Турции", "Покажи все отмены за неделю"].map((q) => (
                <button
                  key={q}
                  className="w-full text-left px-3 py-2 rounded-xl bg-[var(--admin-bg)] hover:bg-primary/10 hover:text-primary transition-colors text-xs"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
