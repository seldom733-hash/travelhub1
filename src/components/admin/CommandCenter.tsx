"use client";

import { useEffect, useState } from "react";
import { Sparkline, RevenueChart, DonutChart, CHART_COLORS } from "@/components/admin/charts";
import { fmtMoney, fmtDateTime } from "@/lib/admin-data";

interface DashData {
  kpi: {
    revenueToday: { value: number; change: number; ops: number; forecast: number };
    revenueMonth: { value: number; change: number; ops: number; planPct: number; forecast: number };
    newBookings: { created: number; confirmed: number; pending: number; cancelled: number };
    sales: { type: string; label: string; icon: string; count: number; revenue: number }[];
    online: { total: number; clients: number; partners: number; employees: number };
    avgCheck: { value: number; change: number };
    newPartners: { registered: number; pending: number; activated: number; rejected: number; change: number };
    platform: Record<string, { status: string; latency?: string; detail?: string }>;
  };
  revenueSeries: { labels: string[]; values: number[] };
  salesByCategory: { type: string; label: string; icon: string; count: number; revenue: number }[];
  recentSales: {
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    user: { firstName: string; lastName: string | null; email: string };
    service: { title: string; type: string; country: string | null; provider: { companyName: string | null; firstName: string } | null };
  }[];
  events: { id: string; type: string; title: string; detail: string; at: string }[];
  priorityTasks: { id: string; title: string; assignee: string; due: string; status: string; priority: string; provider?: string }[];
  financialNotifications: { id: string; type: string; title: string; detail: string }[];
  system: { cpu: number; memory: number; apiMs: number; dbMs: number; queue: number; storage: string; uptime: number };
  aiRecommendations: { level: string; title: string; effect: string; action: string }[];
  partnersAll: number;
}

const STATUS_LABELS: Record<string, string> = {
  PAID: "Оплачен",
  COMPLETED: "Завершён",
  PENDING: "Ожидает",
  REFUNDED: "Возврат",
};

const ACTION_BUTTONS = [
  { icon: "➕", label: "Создать заказ" },
  { icon: "📑", label: "Создать бронирование" },
  { icon: "🤝", label: "Добавить партнера" },
  { icon: "👤", label: "Добавить пользователя" },
  { icon: "📋", label: "Создать задачу" },
  { icon: "📢", label: "Создать рассылку" },
  { icon: "📊", label: "Создать отчет" },
  { icon: "📥", label: "Импорт данных" },
  { icon: "📤", label: "Экспорт данных" },
  { icon: "🤖", label: "Открыть AI Assistant" },
  { icon: "⚙️", label: "Настроить Dashboard" },
];

export default function CommandCenter() {
  const [data, setData] = useState<DashData | null>(null);
  const [period, setPeriod] = useState("month");
  const [chartMode, setChartMode] = useState<"line" | "bar" | "area">("line");

  useEffect(() => {
    fetch(`/api/admin/dashboard?period=${period}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, [period]);

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="h-11 bg-[var(--admin-border)]/40 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-36 bg-[var(--admin-border)]/40 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const { kpi } = data;
  const revSeries = data.revenueSeries.labels.map((l, i) => ({ label: l, value: data.revenueSeries.values[i] }));
  // Спарклайны строим на реальных данных серии выручки (последние 8 точек)
  const sparkToday = data.revenueSeries.values.slice(-8);
  const sparkAvg = sparkToday.map((v, i, arr) => Math.round(v / Math.max(1, arr.length) * (i + 1)));

  const kpiCards = [
    {
      title: "Доход сегодня",
      icon: "💰",
      color: "#22c55e",
      body: (
        <div>
          <div className="text-2xl font-bold">{fmtMoney(kpi.revenueToday.value)}</div>
          <div className="flex items-center gap-2 text-xs mt-1">
            <span className={kpi.revenueToday.change >= 0 ? "text-success" : "text-danger"}>
              {kpi.revenueToday.change >= 0 ? "▲" : "▼"} {Math.abs(kpi.revenueToday.change).toFixed(1)}%
            </span>
            <span className="text-[var(--admin-muted)]">{kpi.revenueToday.ops} операций</span>
          </div>
          <div className="text-xs text-[var(--admin-muted)] mt-1">Прогноз: {fmtMoney(kpi.revenueToday.forecast)}</div>
          <div className="mt-2 h-9">
            <Sparkline data={sparkToday.length > 1 ? sparkToday : [1, 2, 3, 4]} color="#22c55e" />
          </div>
        </div>
      ),
    },
    {
      title: "Доход месяца",
      icon: "📈",
      color: "#f97316",
      body: (
        <div>
          <div className="text-2xl font-bold">{fmtMoney(kpi.revenueMonth.value)}</div>
          <div className="flex items-center gap-2 text-xs mt-1">
            <span className={kpi.revenueMonth.change >= 0 ? "text-success" : "text-danger"}>
              {kpi.revenueMonth.change >= 0 ? "▲" : "▼"} {Math.abs(kpi.revenueMonth.change).toFixed(1)}%
            </span>
            <span className="text-[var(--admin-muted)]">к прошлому месяцу</span>
          </div>
          <div className="mt-2">
            <div className="h-1.5 bg-[var(--admin-bg)] rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${kpi.revenueMonth.planPct}%` }} />
            </div>
            <div className="text-[11px] text-[var(--admin-muted)] mt-1">
              {kpi.revenueMonth.planPct}% плана · прогноз {fmtMoney(kpi.revenueMonth.forecast)}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Новые бронирования",
      icon: "📑",
      color: "#06b6d4",
      body: (
        <div>
          <div className="text-2xl font-bold">{kpi.newBookings.created}</div>
          <div className="grid grid-cols-2 gap-1 text-[11px] mt-2 text-[var(--admin-muted)]">
            <span>✓ Подтверждено: {kpi.newBookings.confirmed}</span>
            <span>⏳ Ожидает: {kpi.newBookings.pending}</span>
            <span>✕ Отменено: {kpi.newBookings.cancelled}</span>
            <span>🏁 Завершено: {data.recentSales.filter((s) => s.status === "COMPLETED").length}</span>
          </div>
        </div>
      ),
    },
    {
      title: "Продажи по направлениям",
      icon: "🧳",
      color: "#8b5cf6",
      body: (
        <div>
          <div className="text-2xl font-bold">{kpi.sales.reduce((a, s) => a + s.count, 0)}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {kpi.sales.slice(0, 4).map((s) => (
              <span key={s.type} className="px-1.5 py-0.5 bg-[var(--admin-bg)] rounded-md text-[10px]">
                {s.icon} {s.label}: {s.count}
              </span>
            ))}
            {kpi.sales.length > 4 && (
              <span className="px-1.5 py-0.5 bg-[var(--admin-bg)] rounded-md text-[10px] text-[var(--admin-muted)]">
                +{kpi.sales.length - 4}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Онлайн-пользователи",
      icon: "👥",
      color: "#3b82f6",
      body: (
        <div>
          <div className="text-2xl font-bold">{kpi.online.total}</div>
          <div className="grid grid-cols-3 gap-1 text-[11px] mt-2 text-[var(--admin-muted)]">
            <span>Клиенты: {kpi.online.clients}</span>
            <span>Партнеры: {kpi.online.partners}</span>
            <span>Сотруд.: {kpi.online.employees}</span>
          </div>
        </div>
      ),
    },
    {
      title: "Средний чек",
      icon: "💳",
      color: "#f59e0b",
      body: (
        <div>
          <div className="text-2xl font-bold">{fmtMoney(kpi.avgCheck.value)}</div>
          <div className="flex items-center gap-2 text-xs mt-1">
            <span className={kpi.avgCheck.change >= 0 ? "text-success" : "text-danger"}>
              {kpi.avgCheck.change >= 0 ? "▲" : "▼"} {Math.abs(kpi.avgCheck.change).toFixed(1)}%
            </span>
            <span className="text-[var(--admin-muted)]">к предыдущему периоду</span>
          </div>
          <div className="mt-2 h-9">
            <Sparkline data={sparkAvg.length > 1 ? sparkAvg : [1, 2, 3, 4]} color="#f59e0b" />
          </div>
        </div>
      ),
    },
    {
      title: "Новые партнеры",
      icon: "🤝",
      color: "#14b8a6",
      body: (
        <div>
          <div className="text-2xl font-bold">{kpi.newPartners.registered}</div>
          <div className="grid grid-cols-2 gap-1 text-[11px] mt-2 text-[var(--admin-muted)]">
            <span>✓ Активированы: {kpi.newPartners.activated}</span>
            <span>⏳ Ожидают: {kpi.newPartners.pending}</span>
            <span>✕ Отклонены: {kpi.newPartners.rejected}</span>
            <span>Всего: {data.partnersAll}</span>
          </div>
        </div>
      ),
    },
    {
      title: "Состояние платформы",
      icon: "🖥",
      color: "#a3e635",
      body: (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {Object.entries(kpi.platform).map(([key, v]) => (
            <div key={key} className="flex items-center gap-1.5 text-[11px]">
              <span
                className={`w-2 h-2 rounded-full ${
                  v.status === "green" ? "bg-success" : v.status === "yellow" ? "bg-[#f59e0b]" : v.status === "red" ? "bg-danger" : "bg-gray-400"
                }`}
              />
              <span className="text-[var(--admin-muted)] capitalize">{key}</span>
              <span className="ml-auto text-[var(--admin-text)]/70">{v.latency ?? v.detail}</span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Панель быстрых действий (2.4) ── */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {ACTION_BUTTONS.map((b) => (
          <button
            key={b.label}
            className="shrink-0 flex items-center gap-2 px-3.5 h-10 rounded-xl bg-[var(--admin-card)] border border-[var(--admin-border)] text-sm text-[var(--admin-muted)] hover:border-primary hover:text-primary transition-colors"
          >
            <span>{b.icon}</span>
            <span className="hidden md:inline">{b.label}</span>
          </button>
        ))}
      </div>

      {/* ── KPI-панель (2.5) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.title}
            className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--admin-muted)] font-medium">{card.title}</span>
              <span className="w-8 h-8 rounded-xl flex items-center justify-center text-base" style={{ background: `${card.color}1a` }}>
                {card.icon}
              </span>
            </div>
            {card.body}
          </div>
        ))}
      </div>

      {/* ── Основная рабочая область 25/50/25 (2.6) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Левая колонка */}
        <div className="space-y-4">
          {/* Приоритетные задачи */}
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">🎯 Приоритетные задачи</h3>
            <div className="space-y-2">
              {data.priorityTasks.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-start gap-2 text-sm p-2 rounded-xl bg-[var(--admin-bg)]">
                  <span
                    className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${t.priority === "high" ? "bg-danger" : "bg-[#f59e0b]"}`}
                  />
                  <div className="min-w-0">
                    <div className="truncate">{t.title}</div>
                    <div className="text-[11px] text-[var(--admin-muted)]">
                      {t.assignee} · {fmtDateTime(t.due)} · {t.status}
                    </div>
                  </div>
                </div>
              ))}
              {!data.priorityTasks.length && <div className="text-sm text-[var(--admin-muted)]">Задач нет — всё оплачено ✅</div>}
            </div>
          </div>

          {/* AI-рекомендации */}
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">🤖 AI-рекомендации</h3>
            <div className="space-y-2">
              {data.aiRecommendations.slice(0, 4).map((r, i) => (
                <div key={i} className="p-2.5 rounded-xl border border-[var(--admin-border)] text-sm">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">{r.effect}</div>
                  <button className="mt-1.5 text-[11px] text-primary font-medium hover:underline">{r.action}</button>
                </div>
              ))}
            </div>
          </div>

          {/* Последние события */}
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">🕒 Последние события</h3>
            <div className="space-y-2.5">
              {data.events.slice(0, 6).map((e) => (
                <div key={e.id} className="flex gap-2 text-sm">
                  <span className="mt-0.5 text-base">{e.type === "booking" ? "📑" : e.type === "user" ? "👤" : "⭐"}</span>
                  <div className="min-w-0">
                    <div className="truncate">{e.title}</div>
                    <div className="text-[11px] text-[var(--admin-muted)]">
                      {e.detail} · {fmtDateTime(e.at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Центральная колонка */}
        <div className="space-y-4 lg:col-span-2">
          {/* Доходы */}
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h3 className="font-semibold text-sm">📊 Доходы</h3>
              <div className="flex items-center gap-1">
                {(["day", "week", "month", "quarter", "year"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      period === p ? "bg-secondary text-white" : "text-[var(--admin-muted)] hover:bg-[var(--admin-bg)]"
                    }`}
                  >
                    {p === "day" ? "День" : p === "week" ? "Неделя" : p === "month" ? "Месяц" : p === "quarter" ? "Квартал" : "Год"}
                  </button>
                ))}
              </div>
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

          {/* Продажи по категориям + карта активности */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="font-semibold text-sm mb-3">🍩 Продажи по категориям</h3>
              <DonutChart
                data={data.salesByCategory.map((s, i) => ({
                  label: s.label,
                  value: s.revenue,
                  color: CHART_COLORS[i % CHART_COLORS.length],
                }))}
              />
            </div>
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="font-semibold text-sm mb-3">🌍 Популярные направления</h3>
              <div className="space-y-2">
                {data.salesByCategory.slice(0, 5).map((s, i) => (
                  <div key={s.type} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--admin-muted)]">
                        {s.icon} {s.label}
                      </span>
                      <span className="font-semibold">{s.count}</span>
                    </div>
                    <div className="h-1.5 bg-[var(--admin-bg)] rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(s.count / Math.max(1, data.salesByCategory[0]?.count ?? 1)) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Правая колонка */}
        <div className="space-y-4">
          {/* Финансовые уведомления */}
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">💳 Финансовые уведомления</h3>
            <div className="space-y-2">
              {data.financialNotifications.slice(0, 6).map((n) => (
                <div key={n.id} className="flex items-start gap-2 text-sm p-2 rounded-xl bg-[var(--admin-bg)]">
                  <span className="text-base">{n.type === "payout" || n.type === "payout-partner" ? "💸" : n.type === "refund" ? "↩️" : "⏳"}</span>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{n.title}</div>
                    <div className="text-[11px] text-[var(--admin-muted)]">{n.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Последние продажи */}
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">🛒 Последние продажи</h3>
            <div className="space-y-2">
              {data.recentSales.slice(0, 6).map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm p-2 rounded-xl hover:bg-[var(--admin-bg)] transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs shrink-0">
                    {s.user.firstName[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{s.user.firstName} {s.user.lastName}</div>
                    <div className="text-[11px] text-[var(--admin-muted)] truncate">
                      {s.service.title} · {fmtDateTime(s.createdAt)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-xs">{fmtMoney(s.amount)}</div>
                    <div className="text-[10px]" style={{ color: s.status === "PAID" ? "#22c55e" : "#06b6d4" }}>
                      {STATUS_LABELS[s.status]}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Мониторинг системы */}
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">🖥 Мониторинг системы</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: "Нагрузка CPU (оценка)", value: data.system.cpu, max: 100 },
                { label: "Использование памяти", value: data.system.memory, max: 100 },
              ].map((m) => (
                <div key={m.label}>
                  <div className="flex justify-between text-xs text-[var(--admin-muted)]">
                    <span>{m.label}</span>
                    <span>{m.value}%</span>
                  </div>
                  <div className="h-1.5 bg-[var(--admin-bg)] rounded-full mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${m.value > 80 ? "bg-danger" : m.value > 60 ? "bg-[#f59e0b]" : "bg-success"}`}
                      style={{ width: `${m.value}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-[var(--admin-muted)]">
                <div className="p-2 rounded-lg bg-[var(--admin-bg)]">API: {data.system.apiMs}ms</div>
                <div className="p-2 rounded-lg bg-[var(--admin-bg)]">БД: {data.system.dbMs}ms</div>
                <div className="p-2 rounded-lg bg-[var(--admin-bg)]">Очередь: {data.system.queue}</div>
                <div className="p-2 rounded-lg bg-[var(--admin-bg)]">Uptime: {data.system.uptime} мин</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
