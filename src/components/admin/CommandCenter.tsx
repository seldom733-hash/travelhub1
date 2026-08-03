"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkline, DonutChart, CHART_COLORS } from "@/components/admin/charts";
import { fmtMoney, fmtDateTime, fmtNumber, ruPlural } from "@/lib/admin-data";
import { describeApiError } from "@/lib/api-error";

/* ─── Типы данных API (Гл. 1: Центр управления) ─── */

interface KpiCard {
  value: number;
  change: number;
  spark?: number[];
  planPct?: number;
  forecast?: number;
}

interface DashData {
  greeting: { name: string; timeOfDay: string; dateText: string; activeUsers: number; attentionTasks: number };
  kpi: {
    ordersToday: KpiCard;
    ordersInWork: KpiCard;
    awaitingConfirmation: KpiCard;
    awaitingPayment: KpiCard;
    completed: KpiCard;
    revenueToday: KpiCard;
    revenueMonth: KpiCard;
    commission: KpiCard;
    newUsers: KpiCard;
    newPartners: KpiCard;
  };
  queues: { key: string; label: string; statuses: string[]; count: number }[];
  tasks: { id: string; orderNumber: string; title: string; client: string; priority: string; deadline: string | Date; amount: number; tab?: string }[];
  ai: {
    summary: { text: string; href?: string }[];
    recommendations: { level: string; title: string; effect: string; action: string }[];
    warnings: { title: string; detail: string }[];
    forecast: { label: string; change: number }[];
  };
  notifications: { id: string; type: string; title: string; detail: string; at: string | Date; href: string }[];
  messages: {
    unread: number;
    items: {
      id: string;
      senderName: string;
      text: string;
      createdAt: string | Date;
      order: { id: string; orderNumber: string };
      href: string;
    }[];
  };
  calendar: {
    today: CalendarOrderItem[];
    tomorrow: CalendarOrderItem[];
    overdue: CalendarOrderItem[];
    upcoming: CalendarOrderItem[];
  };
  departments: {
    sales: { received: number; transferred: number; conversion: number };
    operations: { received: number; confirmed: number; noAvailability: number; priceChanged: number; avgTime: string };
    support: { tickets: number; avgResponse: string };
    moderation: { newServices: number; rejected: number };
  };
  events: { id: string; type: string; title: string; detail: string; at: string | Date; href?: string }[];
  health: Record<string, { status: string; latency?: string; detail?: string }>;
  system: { cpu: number; memory: number; apiMs: number; dbMs: number; queue: number; storage: string; uptime: number };
  salesByCategory: { type: string; label: string; icon: string; revenue: number }[];
  popularDestinations: { name: string; code: string | null; revenue: number; sales: number }[];
  taskCounts: {
    status: string;
    label: string;
    count: number;
    reminded: number;
    notReminded: { orderNumber: string; client: string }[];
  }[];
  periodLabel: string;
  partnersAll: number;
}

/* ─── Стили и хелперы ─── */

/** Пункт виджета «Календарь»: заказ + deep-link на карточку в реестре. */
interface CalendarOrderItem {
  id: string;
  orderNumber: string;
  serviceDate: string | Date;
  status: string;
  user: { firstName: string; lastName: string | null };
  href: string;
}

const CARD_COLORS: Record<string, string> = {
  ordersToday: "#3b82f6",
  ordersInWork: "#06b6d4",
  awaitingConfirmation: "#f59e0b",
  awaitingPayment: "#f97316",
  completed: "#22c55e",
  revenueToday: "#22c55e",
  revenueMonth: "#f97316",
  commission: "#8b5cf6",
  newUsers: "#3b82f6",
  newPartners: "#14b8a6",
};

const NOTIFY_ICONS: Record<string, string> = {
  order: "📦",
  confirm: "✅",
  pay: "⏳",
  paid: "💳",
  refund: "↩️",
  done: "🏁",
  user: "👤",
  review: "⭐",
};

const flagEmoji = (code: string | null) =>
  code
    ? code
        .toUpperCase()
        .split("")
        .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
        .join("")
    : "📍";

const QUEUE_HINTS: Record<string, string> = {
  new: "Созданные заявки, ожидающие обработки",
  check: "Ожидают ответа поставщика",
  pay: "Ждут оплаты от клиента",
  ops: "В работе операционного отдела",
  docs: "Документы готовы к выдаче",
  refund: "Оформление возвратов",
};

export default function CommandCenter() {
  const [data, setData] = useState<DashData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiTab, setAiTab] = useState<"summary" | "recs" | "warnings" | "forecast">("summary");

  const load = () => {
    setError(null);
    fetch("/api/admin/dashboard?period=month")
      .then(async (r) => {
        if (!r.ok) throw new Error(await describeApiError(r, "Ошибка загрузки данных"));
        return r.json();
      })
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Неизвестная ошибка"));
  };

  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  // Фоновое обновление счётчика «N новых» в виджете «Сообщения» (Гл. 1.24):
  // раз в минуту опрашиваем лёгкий эндпоинт и тихо подменяем только блок
  // messages — без перезагрузки дашборда. Сбой сети игнорируем: показываем
  // последние успешно полученные значения.
  useEffect(() => {
    const refresh = () => {
      fetch("/api/admin/dashboard/messages")
        .then(async (r) => {
          if (!r.ok) throw new Error("poll failed");
          return r.json();
        })
        .then((messages: DashData["messages"]) => {
          setData((prev) => (prev ? { ...prev, messages } : prev));
        })
        .catch(() => {
          /* тихо: оставляем предыдущие значения */
        });
    };
    const timer = setInterval(refresh, 60_000);
    // Плюс мгновенное обновление при возврате на вкладку/окно: если менеджер
    // прочитал сообщения в Order Center и вернулся на дашборд раньше тика,
    // счётчик не должен устаревать до конца минуты.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-32 bg-[var(--admin-border)]/40 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const { kpi, greeting } = data;

  /* ── KPI-карточки (Гл. 1.7) ── */
  const kpiCards: { key: string; title: string; href: string; body: React.ReactNode }[] = [
    {
      key: "ordersToday",
      title: "Заказы за сегодня",
      // period=today — реестр откроется с тем же окном (24ч), что и карточка
      href: "/admin/orders?period=today",
      body: <KpiValue kpi={kpi.ordersToday} format={(v) => fmtNumber(v)} />,
    },
    {
      key: "ordersInWork",
      title: "Заказы в работе",
      href: "/admin/orders?status=DRAFT,CREATED,PROCESSING,AWAITING_CONFIRMATION,CONFIRMED,AWAITING_PAYMENT,PARTIALLY_PAID,PAID,DOCUMENT_PREP,READY,CHANGED,OVERDUE",
      body: <KpiValue kpi={kpi.ordersInWork} format={(v) => fmtNumber(v)} />,
    },
    {
      key: "awaitingConfirmation",
      title: "Ожидают подтверждения",
      href: "/admin/orders?status=AWAITING_CONFIRMATION",
      body: <KpiValue kpi={kpi.awaitingConfirmation} format={(v) => fmtNumber(v)} />,
    },
    {
      key: "awaitingPayment",
      title: "Ожидают оплаты",
      href: "/admin/orders?status=AWAITING_PAYMENT,PARTIALLY_PAID,OVERDUE",
      body: <KpiValue kpi={kpi.awaitingPayment} format={(v) => fmtNumber(v)} />,
    },
    {
      key: "completed",
      title: "Выполненные",
      href: "/admin/orders?status=COMPLETED",
      body: <KpiValue kpi={kpi.completed} format={(v) => fmtNumber(v)} />,
    },
    {
      key: "revenueToday",
      title: "Доход за сегодня",
      href: "/admin/sales",
      body: <KpiValue kpi={kpi.revenueToday} format={(v) => fmtMoney(v)} spark />,
    },
    {
      key: "revenueMonth",
      title: "Доход за месяц",
      href: "/admin/sales",
      body: (
        <div>
          <div className="text-2xl font-bold">{fmtMoney(kpi.revenueMonth.value)}</div>
          <div className="flex items-center gap-2 text-xs mt-1">
            <ChangeBadge change={kpi.revenueMonth.change} suffix=" к прошлому месяцу" />
          </div>
          <div className="mt-2">
            <div className="h-1.5 bg-[var(--admin-bg)] rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, kpi.revenueMonth.planPct ?? 0)}%` }} />
            </div>
            <div className="text-[11px] text-[var(--admin-muted)] mt-1">
              {kpi.revenueMonth.planPct}% плана · прогноз {fmtMoney(kpi.revenueMonth.forecast ?? 0)}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "commission",
      title: "Комиссия платформы",
      href: "/admin/finance",
      body: (
        <div>
          <div className="text-2xl font-bold">{fmtMoney(kpi.commission.value)}</div>
          <div className="text-xs text-[var(--admin-muted)] mt-1">12% от дохода месяца</div>
        </div>
      ),
    },
    {
      key: "newUsers",
      title: "Новые пользователи",
      href: "/admin/users",
      body: <KpiValue kpi={kpi.newUsers} format={(v) => fmtNumber(v)} spark />,
    },
    {
      key: "newPartners",
      title: "Новые партнеры",
      href: "/admin/crm",
      body: <KpiValue kpi={kpi.newPartners} format={(v) => fmtNumber(v)} spark />,
    },
  ];

  const quickActions = [
    { icon: "➕", label: "Новый заказ", href: "/admin/orders" },
    { icon: "➕", label: "Новый партнер", href: "/admin/crm" },
    { icon: "➕", label: "Новая услуга", href: "/admin/catalog" },
    { icon: "📄", label: "Создать счет", href: "/admin/finance" },
    { icon: "📧", label: "Отправить письмо", href: "/admin/support" },
    { icon: "📊", label: "Новый отчет", href: "/admin/reports" },
    { icon: "🤖", label: "Запустить AI анализ", href: "/admin/ai-center" },
  ];

  const capFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

  return (
    <div className="space-y-6">
      {/* ── Заголовок страницы (Гл. 1.6): приветствие + быстрые действия ── */}
      <div className="bg-gradient-to-br from-primary to-primary-dark text-white rounded-2xl p-5 lg:p-6 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-48 h-48 bg-white/10 rounded-full" />
        <div className="absolute right-16 bottom-0 w-24 h-24 bg-white/5 rounded-full" />
        <div className="relative">
          <h1 className="text-xl lg:text-2xl font-bold">
            {greeting.timeOfDay}, {greeting.name}!
          </h1>
          <p className="text-white/80 text-sm mt-1">
            Сегодня {capFirst(greeting.dateText)}. На платформе сейчас {fmtNumber(greeting.activeUsers)} активных пользователей.
            Есть {greeting.attentionTasks} {ruPlural(greeting.attentionTasks, "задача", "задачи", "задач")}, требующих внимания.
          </p>
          <div className="flex gap-2 mt-4 flex-wrap">
            <Link
              href="/admin/orders"
              className="px-4 h-9 rounded-xl bg-white text-primary text-sm font-semibold flex items-center gap-2 hover:bg-white/90 transition-colors"
            >
              ➕ Создать заказ
            </Link>
            <Link
              href="/admin/catalog"
              className="px-4 h-9 rounded-xl bg-white/15 text-white text-sm font-medium flex items-center gap-2 hover:bg-white/25 transition-colors"
            >
              ➕ Добавить услугу
            </Link>
            <Link
              href="/admin/crm"
              className="px-4 h-9 rounded-xl bg-white/15 text-white text-sm font-medium flex items-center gap-2 hover:bg-white/25 transition-colors"
            >
              ➕ Добавить партнера
            </Link>
            <Link
              href="/admin/analytics"
              className="px-4 h-9 rounded-xl bg-white/15 text-white text-sm font-medium flex items-center gap-2 hover:bg-white/25 transition-colors"
            >
              📊 Открыть аналитику
            </Link>
            <Link
              href="/admin/reports"
              className="px-4 h-9 rounded-xl bg-white/15 text-white text-sm font-medium flex items-center gap-2 hover:bg-white/25 transition-colors"
            >
              📑 Создать отчет
            </Link>
          </div>
        </div>
      </div>

      {/* ── KPI-панель (Гл. 1.7): 10 карточек ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpiCards.map((card) => {
          const color = CARD_COLORS[card.key] ?? "#94a3b8";
          return (
            <Link
              key={card.key}
              href={card.href}
              className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4 hover:shadow-lg hover:border-primary/40 transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--admin-muted)] font-medium group-hover:text-primary transition-colors">
                  {card.title}
                </span>
                <span className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: `${color}1a` }}>
                  <span style={{ color }}>{card.key.includes("revenue") || card.key === "commission" ? "💰" : "📊"}</span>
                </span>
              </div>
              {card.body}
            </Link>
          );
        })}
      </div>

      {/* ── Рабочая область: 3 колонки (Гл. 1.18) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Левая колонка: Задачи · Очереди · Быстрые действия */}
        <div className="space-y-4">
          {/* Мои задачи (Гл. 1.19) */}
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-2">🎯 Мои задачи</h3>
            {/* Счётчики по типам задач: общее число проблем каждого типа.
                У оплатных типов — подпись «из них напомнено N» (заказы, по которым
                менеджер уже отправлял сообщение-напоминание). Тултип (title) чипа
                перечисляет заказы, по которым напоминание ещё НЕ отправлено. */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {data.taskCounts.map((t) => {
                const notReminded = t.notReminded ?? [];
                // Точное число «не напомнено» = count − reminded (some/none — точные
                // дополнения), не зависит от take:20 в API. В тултип попадают первые 6
                // номеров из списка, остаток — числом.
                const totalNotReminded = Math.max(0, t.count - t.reminded);
                const tip =
                  notReminded.length > 0
                    ? `Напоминание не отправлено: ${notReminded
                        .slice(0, 6)
                        .map((o) => `${o.orderNumber}${o.client ? ` (${o.client})` : ""}`)
                        .join(", ")}${totalNotReminded > 6 ? ` и ещё ${totalNotReminded - 6}` : ""}`
                    : undefined;
                return (
                  <Link
                    key={t.status}
                    href={`/admin/orders?status=${t.status}`}
                    title={tip}
                    className="px-2 py-1 rounded-lg bg-[var(--admin-bg)] text-xs text-[var(--admin-muted)] hover:text-[var(--admin-text)] hover:border-primary border border-transparent transition-colors"
                  >
                    {t.label} <b className="text-[var(--admin-text)]">{t.count}</b>
                    {t.reminded > 0 && (
                      <span className="block text-[10px] text-success/90 mt-0.5">из них напомнено {t.reminded}</span>
                    )}
                  </Link>
                );
              })}
            </div>
            <div className="space-y-2">
              {data.tasks.slice(0, 5).map((t) => (
                <div key={t.id} className="p-2.5 rounded-xl bg-[var(--admin-bg)]">
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${t.priority === "high" ? "bg-danger" : "bg-[#f59e0b]"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{t.title}</div>
                      <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">
                        Заказ №{t.orderNumber} · {t.client}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-[var(--admin-muted)]">⏰ {fmtDateTime(t.deadline)}</span>
                        <Link
                          href={`/admin/orders?open=${t.id}&tab=${t.tab ?? "overview"}`}
                          className="text-[11px] text-primary font-medium hover:underline"
                        >
                          Открыть
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {!data.tasks.length && <div className="text-sm text-[var(--admin-muted)]">Нет задач, требующих внимания ✅</div>}
            </div>
          </div>

          {/* Очереди (Гл. 1.21) */}
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">📥 Очереди</h3>
            <div className="space-y-1.5">
              {data.queues.map((q) => (
                <Link
                  key={q.key}
                  href={`/admin/orders?status=${q.statuses.join(",")}`}
                  title={QUEUE_HINTS[q.key]}
                  className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-[var(--admin-bg)] transition-colors group"
                >
                  <span className="text-sm text-[var(--admin-muted)] group-hover:text-[var(--admin-text)]">{q.label}</span>
                  <span className="text-sm font-bold text-[var(--admin-text)] group-hover:text-primary transition-colors">{q.count}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Быстрые действия (Гл. 1.20) */}
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">⚡ Быстрые действия</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickActions.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className="flex items-center gap-2 px-3 h-9 rounded-xl bg-[var(--admin-bg)] text-sm text-[var(--admin-muted)] hover:border-primary hover:text-primary border border-transparent transition-colors"
                >
                  <span>{a.icon}</span>
                  <span className="truncate">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Центральная колонка: AI Центр (Гл. 1.22) */}
        <div className="space-y-4 lg:col-span-2">
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h3 className="font-semibold text-sm">🤖 AI Центр</h3>
              <div className="flex items-center gap-1 flex-wrap">
                {(
                  [
                    ["summary", "Сводка"],
                    ["recs", "Рекомендации"],
                    ["warnings", "Предупреждения"],
                    ["forecast", "Прогноз"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setAiTab(key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      aiTab === key ? "bg-secondary text-white" : "text-[var(--admin-muted)] hover:bg-[var(--admin-bg)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {aiTab === "summary" && (
              <div className="space-y-2">
                {data.ai.summary.map((s, i) => {
                  const icon = i === 0 ? "📌" : i === 1 ? "💰" : i === 2 ? "⚠️" : "✅";
                  const inner = (
                    <>
                      <span className="text-base">{icon}</span>
                      <span className="flex-1">{s.text}</span>
                      {s.href && (
                        <span className="text-[11px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                      )}
                    </>
                  );
                  // Пункт со ссылкой открывает отфильтрованный реестр заказов
                  return s.href ? (
                    <Link
                      key={i}
                      href={s.href}
                      className="group flex items-center gap-2 text-sm p-2.5 rounded-xl bg-[var(--admin-bg)] hover:bg-primary/10 transition-colors"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={i} className="flex items-center gap-2 text-sm p-2.5 rounded-xl bg-[var(--admin-bg)]">
                      {inner}
                    </div>
                  );
                })}
              </div>
            )}

            {aiTab === "recs" && (
              <div className="space-y-2">
                {data.ai.recommendations.map((r, i) => (
                  <div key={i} className="p-3 rounded-xl border border-[var(--admin-border)]">
                    <div className="flex items-start gap-2">
                      <span className="text-base">{r.level === "high" ? "🔴" : r.level === "positive" ? "🟢" : r.level === "medium" ? "🟡" : "🔵"}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{r.title}</div>
                        <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">{r.effect}</div>
                        <button className="mt-1.5 text-[11px] text-primary font-medium hover:underline">▶ {r.action}</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {aiTab === "warnings" && (
              <div className="space-y-2">
                {data.ai.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-danger/5 border border-danger/20 text-sm">
                    <span className="text-base">⚠️</span>
                    <div>
                      <div className="font-medium">{w.title}</div>
                      <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">{w.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {aiTab === "forecast" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {data.ai.forecast.map((f) => (
                  <div key={f.label} className="p-3 rounded-xl bg-[var(--admin-bg)] text-center">
                    <div className="text-xs text-[var(--admin-muted)]">{f.label}</div>
                    <div className={`text-2xl font-bold mt-1 ${f.change >= 0 ? "text-success" : "text-danger"}`}>
                      {f.change >= 0 ? "+" : ""}
                      {f.change}%
                    </div>
                    <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">прогноз на следующий период</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Продажи по категориям + направления (компактно) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="font-semibold text-sm mb-3">
                🍩 Продажи по категориям{" "}
                <span className="font-normal text-[var(--admin-muted)]">· за {data.periodLabel}</span>
              </h3>
              {data.salesByCategory.length ? (
                <DonutChart
                  data={data.salesByCategory.slice(0, 6).map((s, i) => ({
                    label: s.label,
                    value: s.revenue,
                    color: CHART_COLORS[i % CHART_COLORS.length],
                  }))}
                />
              ) : (
                <div className="text-sm text-[var(--admin-muted)]">Продаж за период нет</div>
              )}
            </div>
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="font-semibold text-sm mb-3">
                📈 Популярные направления{" "}
                <span className="font-normal text-[var(--admin-muted)]">· за {data.periodLabel}</span>
              </h3>
              <div className="space-y-2">
                {data.popularDestinations.length ? (
                  data.popularDestinations.slice(0, 6).map((d, i) => (
                    <div key={d.name} className="text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--admin-muted)] truncate">
                          {flagEmoji(d.code)} {d.name}
                        </span>
                        <span className="font-semibold shrink-0">
                          {d.sales} {ruPlural(d.sales, "продажа", "продажи", "продаж")} · {fmtMoney(d.revenue)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-[var(--admin-bg)] rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(d.sales / Math.max(1, data.popularDestinations[0]?.sales ?? 1)) * 100}%`,
                            background: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-[var(--admin-muted)]">Продаж за период нет</div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Правая колонка: Уведомления · Сообщения · Календарь */}
        <div className="space-y-4">
          {/* Уведомления (Гл. 1.23) */}
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">🔔 Уведомления</h3>
            <div className="space-y-2">
              {data.notifications.slice(0, 6).map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  title="Перейти к объекту уведомления"
                  className="group flex items-start gap-2 text-sm p-2 rounded-xl border border-transparent hover:bg-[var(--admin-bg)] hover:border-primary/40 transition-colors"
                >
                  <span className="text-base shrink-0">{NOTIFY_ICONS[n.type] ?? "🔔"}</span>
                  <div className="min-w-0">
                    <div className="truncate">{n.title}</div>
                    <div className="text-[11px] text-[var(--admin-muted)]">
                      {n.detail} · {fmtDateTime(n.at)}
                    </div>
                  </div>
                  <span className="text-[11px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0">→</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Сообщения (Гл. 1.24) */}
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">💬 Сообщения</h3>
              <div className="flex items-center gap-2">
                {/* Счётчик обновляется в фоне раз в минуту без перезагрузки дашборда */}
                <span
                  className="text-[10px] text-[var(--admin-muted)]"
                  title="Счётчик и список обновляются автоматически раз в минуту"
                >
                  🔄 1 мин
                </span>
                {data.messages.unread > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-danger text-white text-[10px] font-bold">{data.messages.unread} новых</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {/* Вся строка сообщения кликабельна: открывает карточку заказа
                  в реестре сразу на вкладке «Коммуникации» (фокус по назначению). */}
              {data.messages.items.slice(0, 5).map((m) => (
                <Link
                  key={m.id}
                  href={m.href}
                  title={`Открыть заказ №${m.order.orderNumber} — Коммуникации`}
                  className="group block text-sm p-2 rounded-xl bg-[var(--admin-bg)] border border-transparent hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs">{m.senderName}</span>
                    <span className="text-[10px] text-[var(--admin-muted)]">{fmtDateTime(m.createdAt)}</span>
                  </div>
                  <div className="text-[var(--admin-muted)] truncate mt-0.5">{m.text}</div>
                  <div className="text-[10px] text-primary font-medium mt-1 group-hover:underline">
                    Заказ №{m.order.orderNumber} →
                  </div>
                </Link>
              ))}
              {!data.messages.items.length && <div className="text-sm text-[var(--admin-muted)]">Нет непрочитанных сообщений</div>}
            </div>
          </div>

          {/* Календарь (Гл. 1.25) */}
          <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3">📅 Календарь</h3>
            {[
              { label: "Просроченные", items: data.calendar.overdue, color: "text-danger" },
              { label: "Сегодня", items: data.calendar.today, color: "text-primary" },
              { label: "Завтра", items: data.calendar.tomorrow, color: "text-[var(--admin-muted)]" },
              { label: "Предстоящие", items: data.calendar.upcoming, color: "text-[var(--admin-muted)]" },
            ].map((g) => (
              <div key={g.label} className="mb-2.5">
                <div className={`text-[11px] font-semibold uppercase tracking-wide ${g.color} mb-1`}>
                  {g.label} · {g.items.length}
                </div>
                {g.items.slice(0, 2).map((o) => (
                  <Link
                    key={o.id}
                    href={o.href}
                    title={`Открыть заказ №${o.orderNumber}`}
                    className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-[var(--admin-bg)] mb-1 hover:border-primary border border-transparent transition-colors group"
                  >
                    <span className="truncate">
                      №{o.orderNumber} · {o.user.firstName} {o.user.lastName ?? ""}
                    </span>
                    <span className="flex items-center gap-1 text-[var(--admin-muted)] shrink-0 ml-2">
                      {fmtDateTime(o.serviceDate)}
                      <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </span>
                  </Link>
                ))}
                {!g.items.length && <div className="text-[11px] text-[var(--admin-muted)] px-1 pb-1">—</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Производительность подразделений (Гл. 1.26) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <DeptCard
          title="🏢 Продажи"
          rows={[
            ["Получено", String(data.departments.sales.received)],
            ["Передано", String(data.departments.sales.transferred)],
            ["Конверсия", `${data.departments.sales.conversion}%`],
          ]}
        />
        <DeptCard
          title="⚙️ Операционный отдел"
          rows={[
            ["Получено", String(data.departments.operations.received)],
            ["Подтверждено", String(data.departments.operations.confirmed)],
            ["Нет мест", String(data.departments.operations.noAvailability)],
            ["Цена изменилась", String(data.departments.operations.priceChanged)],
            ["Среднее время", data.departments.operations.avgTime],
          ]}
        />
        <DeptCard
          title="🎧 Поддержка"
          rows={[
            ["Обращений", String(data.departments.support.tickets)],
            ["Среднее время ответа", data.departments.support.avgResponse],
          ]}
        />
        <DeptCard
          title="🛡 Модерация"
          rows={[
            ["Новых услуг", String(data.departments.moderation.newServices)],
            ["Отклонено", String(data.departments.moderation.rejected)],
          ]}
        />
      </div>

      {/* ── Последние события платформы (Гл. 1.27) ── */}
      <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
        <h3 className="font-semibold text-sm mb-3">🕒 Последние события платформы</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {data.events.slice(0, 9).map((e) => {
            const icon = e.type === "order" ? "📦" : e.type === "user" ? "👤" : "⭐";
            const body = (
              <>
                <span className="text-base shrink-0">{icon}</span>
                <div className="min-w-0">
                  <div className="truncate">{e.title}</div>
                  <div className="text-[11px] text-[var(--admin-muted)]">
                    {e.detail} · {fmtDateTime(e.at)}
                  </div>
                </div>
                {e.href && (
                  <span className="text-[11px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0">→</span>
                )}
              </>
            );
            // События-заказы ведут на карточку заказа, регистрации — в список пользователей,
            // отзывы — в модерацию контента.
            return e.href ? (
              <Link
                key={e.id}
                href={e.href}
                title="Перейти к объекту события"
                className="group flex items-start gap-2 text-sm p-2 rounded-xl bg-[var(--admin-bg)] border border-transparent hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                {body}
              </Link>
            ) : (
              <div key={e.id} className="flex items-start gap-2 text-sm p-2 rounded-xl bg-[var(--admin-bg)]">
                {body}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Панель здоровья платформы (Гл. 1.29) ── */}
      <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
        <h3 className="font-semibold text-sm mb-3">🖥 Панель здоровья платформы</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
          {Object.entries(data.health).map(([key, v]) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  v.status === "green" ? "bg-success" : v.status === "yellow" ? "bg-[#f59e0b]" : v.status === "red" ? "bg-danger" : "bg-gray-400"
                }`}
              />
              <span className="text-[var(--admin-muted)] capitalize">{key}</span>
              <span className="ml-auto text-[var(--admin-text)]/70 text-xs">{v.latency ?? v.detail}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 pt-3 border-t border-[var(--admin-border)]">
          {[
            { label: "CPU", value: `${data.system.cpu}%` },
            { label: "Память", value: `${data.system.memory}%` },
            { label: "API", value: `${data.system.apiMs}ms` },
            { label: "БД", value: `${data.system.dbMs}ms` },
            { label: "Uptime", value: `${data.system.uptime} мин` },
          ].map((m) => (
            <div key={m.label} className="p-2 rounded-lg bg-[var(--admin-bg)] text-center">
              <div className="text-[10px] text-[var(--admin-muted)] uppercase tracking-wide">{m.label}</div>
              <div className="text-sm font-semibold mt-0.5">{m.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Вспомогательные компоненты ─── */

function KpiValue({ kpi, format, spark }: { kpi: KpiCard; format: (v: number) => string; spark?: boolean }) {
  return (
    <div>
      <div className="text-2xl font-bold">{format(kpi.value)}</div>
      <div className="flex items-center gap-2 text-xs mt-1">
        <ChangeBadge change={kpi.change} />
      </div>
      {spark && kpi.spark && kpi.spark.length > 1 && kpi.spark.some((v) => v !== 0) && (
        <div className="mt-2 h-9">
          <Sparkline data={kpi.spark} color="#22c55e" />
        </div>
      )}
    </div>
  );
}

function ChangeBadge({ change, suffix = "" }: { change: number; suffix?: string }) {
  return (
    <span className={change >= 0 ? "text-success" : "text-danger"}>
      {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(change % 1 === 0 ? 0 : 1)}%
      {suffix && <span className="text-[var(--admin-muted)] font-normal"> {suffix}</span>}
    </span>
  );
}

function DeptCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
      <h3 className="font-semibold text-sm mb-3">{title}</h3>
      <div className="space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-[var(--admin-muted)]">{label}</span>
            <span className="font-semibold">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
