"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Sparkline } from "@/components/admin/charts";
import {
  fmtMoney,
  fmtDateTime,
  fmtDate,
  fmtNumber,
  ruPlural,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_GROUPS,
  SERVICE_TYPE_ICONS,
  SERVICE_TYPE_LABELS,
} from "@/lib/admin-data";
import {
  AUTOMATION_SCENARIOS,
  CRITICALITY_LABELS,
  CRITICALITY_COLORS,
  EXCEPTION_CATEGORIES,
  EXCEPTION_STATUS_LABELS,
  EXCEPTION_STATUS_COLORS,
} from "@/lib/sales-automation";

/**
 * «Продажи и исполнение» — основной операционный центр платформы.
 * Реализация по документу travelhub_Архитектура.docx, Глава 3 (3.1–3.10).
 *
 * Архитектура страницы (3.3):
 *   KPI-панель (3.6) → Рабочие очереди (3.7) → Панель фильтрации (3.9)
 *   → Реестр заказов (3.8) → Карточка заказа (3.10, открывается поверх списка).
 *
 * Данные: GET /api/admin/orders (реестр + KPI + SLA очередей), карточка —
 * GET /api/admin/orders/[id] (+ history, messages), массовые операции —
 * POST /api/admin/orders/bulk, создание — POST /api/admin/orders.
 */

// ── Типы (контракт GET /api/admin/orders) ──

interface KpiItem {
  value: number;
  change?: number;
  detail?: string;
}

interface QueueSla {
  total: number;
  compliance: number;
  avgHours: number;
}

interface OrderRow {
  id: string;
  orderNumber: string;
  client: string;
  partner: string;
  provider: string;
  service: string;
  category: string;
  categoryType: string;
  servicesCount: number;
  bookingsCount: number;
  amount: number;
  paidAmount: number;
  commission: number;
  currency: string;
  status: string;
  priority: string;
  bookingStatus: string;
  paymentStatus: string;
  manager: string;
  source: string;
  unreadCount: number;
  // Эскалация заказа (Гл. 3.17): реальное активное исключение из БД
  escalated: boolean;
  createdAt: string;
  serviceDate: string | null;
  updatedAt: string;
}

interface KanbanOrder {
  id: string;
  orderNumber: string;
  client: string;
  service: string;
  categoryType: string;
  status: string;
  priority: string;
  amount: number;
  currency: string;
  manager: string;
  serviceDate: string | null;
  escalated: boolean;
  unreadCount: number;
}

interface OrdersResponse {
  kpi: Record<string, KpiItem>;
  queueSla: Record<string, QueueSla>;
  orders: OrderRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  managers: string[];
  statusCounts: { status: string; count: number }[];
  financial: {
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    refundedAmount: number;
    commission: number;
    expectedPayouts: number;
  };
  sla: { targetHours: number; compliance: number; breaches: number; total: number };
  ordersSeries: { labels: string[]; values: number[]; starts: string[] };
  // Серии KPI-карточек (Гл. 3.6): у каждой карточки свой мини-график — динамика
  // её набора статусов, а не общая динамика заказов. starts — ISO-границы
  // бакетов (для drill-down по точке графика).
  kpiSeries: Record<string, { labels: string[]; values: number[]; starts: string[] }>;
  aiRecommendations: { level: string; title: string; effect: string; orderId?: string }[];
  providerNotifications: { id: string; type: string; title: string; detail: string }[];
  automation: {
    scenarios: { key: string; icon: string; title: string; description: string; group: string; enabled: boolean }[];
    journal: { id: string; at: string; event: string; action: string; result: string; durationMs: number; source: string; orderNumber?: string }[];
    stats: { total: number; success: number; errors: number; skipped: number; avgMs: number };
  };
  exceptions: {
    list: {
      id: string;
      type: string;
      category: string;
      criticality: string;
      orderNumber: string;
      orderId: string;
      manager: string;
      createdAt: string;
      updatedAt?: string;
      status: string;
      description: string;
      aiSuggestion: string;
      history?: {
        id: string;
        action: string;
        from: string | null;
        to: string | null;
        comment: string | null;
        actorName: string;
        createdAt: string;
      }[];
    }[];
    stats: { total: number; active: number; critical: number; inWork: number; resolved: number };
  };
  period: { start: string; end: string };
  kanban: KanbanOrder[];
}

// ── Константы очередей и приоритетов (Гл. 3.7, 3.8) ──

// Очереди (Гл. 3.7) на канонических статусах Baseline §0.4. Оплата — отдельное
// измерение paymentStatus, поэтому «Ожидание оплаты» заменено на этапы бронирования.
const QUEUES: {
  key: string;
  icon: string;
  title: string;
  statuses: string;
  color: string;
}[] = [
  { key: "new", icon: "🆕", title: "Новые", statuses: "NEW", color: "from-blue-500 to-indigo-600" },
  { key: "check", icon: "🔍", title: "В обработке", statuses: "IN_PROCESSING,WAITING_FOR_DATA", color: "from-cyan-500 to-teal-600" },
  { key: "provider", icon: "🤝", title: "Ожидание поставщика", statuses: "SENT_TO_BOOKING", color: "from-violet-500 to-purple-600" },
  { key: "booking", icon: "🚀", title: "Готовы к бронированию", statuses: "READY_FOR_BOOKING,PARTIALLY_FULFILLED", color: "from-sky-500 to-blue-600" },
  { key: "fulfilled", icon: "✅", title: "Исполнены", statuses: "FULFILLED,READY_TO_CLOSE", color: "from-emerald-500 to-teal-600" },
  { key: "closed", icon: "🎉", title: "Закрыты", statuses: "CLOSED", color: "from-slate-500 to-slate-700" },
  { key: "problem", icon: "⏰", title: "Проблемные", statuses: "PROBLEM,SUSPENDED", color: "from-red-500 to-rose-600" },
  { key: "refunds", icon: "↩️", title: "Отмены", statuses: "CANCELLED", color: "from-rose-500 to-red-600" },
  { key: "all", icon: "👥", title: "Все мои", statuses: "", color: "from-slate-500 to-slate-700" },
];

// ── Kanban-режим рабочих очередей (Гл. 3.7) ──
// Колонки соответствуют этапам жизненного цикла заказа; карточку можно
// перетащить только в колонку допустимого перехода (KANBAN_MOVES зеркалит
// TRANSITIONS из /api/admin/orders/[id]/route.ts, Гл. 3.15).
// Колонки Kanban (Гл. 3.7) — канонический жизненный цикл Baseline §0.4:
// NEW → IN_PROCESSING → WAITING_FOR_DATA → READY_FOR_BOOKING → SENT_TO_BOOKING
// → PARTIALLY_FULFILLED → FULFILLED → READY_TO_CLOSE → CLOSED; ветви PROBLEM/SUSPENDED/CANCELLED.
const KANBAN_COLUMNS: { key: string; title: string; statuses: string[]; color: string }[] = [
  { key: "new", title: "🆕 Новые", statuses: ["NEW"], color: "#3b82f6" },
  { key: "check", title: "🔍 В обработке", statuses: ["IN_PROCESSING", "WAITING_FOR_DATA"], color: "#06b6d4" },
  { key: "ready", title: "🚀 Готов к бронированию", statuses: ["READY_FOR_BOOKING"], color: "#8b5cf6" },
  { key: "sent", title: "🤝 Передан в бронирование", statuses: ["SENT_TO_BOOKING"], color: "#14b8a6" },
  { key: "partial", title: "📌 Частично исполнен", statuses: ["PARTIALLY_FULFILLED"], color: "#eab308" },
  { key: "fulfilled", title: "✅ Исполнен", statuses: ["FULFILLED"], color: "#16a34a" },
  { key: "close", title: "📄 Готов к закрытию", statuses: ["READY_TO_CLOSE"], color: "#0d9488" },
  { key: "done", title: "🎉 Закрыт", statuses: ["CLOSED"], color: "#64748b" },
  { key: "problem", title: "⏰ Проблемные", statuses: ["PROBLEM", "SUSPENDED"], color: "#dc2626" },
  { key: "refunds", title: "↩️ Отмены", statuses: ["CANCELLED"], color: "#f43f5e" },
];

// Статус → колонка Kanban (для быстрого поиска колонки целевого статуса)
const KANBAN_STATUS_COLUMN: Record<string, string> = {};
for (const col of KANBAN_COLUMNS) {
  for (const s of col.statuses) KANBAN_STATUS_COLUMN[s] = col.key;
}

// Допустимые перемещения: статус → [{ action, toStatus, label }].
// Зеркалит TRANSITIONS бэкенда (confirm/pay/complete/cancel/refund + process/send).
// Переходы зеркалят TRANSITIONS бэкенда /api/admin/orders/[id] (Baseline §0.4).
const KANBAN_MOVES: Record<string, { action: string; toStatus: string; label: string }[]> = {
  NEW: [
    { action: "process", toStatus: "IN_PROCESSING", label: "Принять в работу" },
    { action: "cancel", toStatus: "CANCELLED", label: "Отменить" },
  ],
  IN_PROCESSING: [
    { action: "confirm", toStatus: "READY_FOR_BOOKING", label: "Готов к бронированию" },
    { action: "cancel", toStatus: "CANCELLED", label: "Отменить" },
  ],
  WAITING_FOR_DATA: [
    { action: "confirm", toStatus: "READY_FOR_BOOKING", label: "Готов к бронированию" },
    { action: "cancel", toStatus: "CANCELLED", label: "Отменить" },
  ],
  READY_FOR_BOOKING: [
    { action: "send", toStatus: "SENT_TO_BOOKING", label: "Передать в Booking Center" },
    { action: "cancel", toStatus: "CANCELLED", label: "Отменить" },
  ],
  SENT_TO_BOOKING: [
    { action: "complete", toStatus: "FULFILLED", label: "Забронировано и подтверждено" },
    { action: "cancel", toStatus: "CANCELLED", label: "Отменить" },
  ],
  PARTIALLY_FULFILLED: [
    { action: "complete", toStatus: "FULFILLED", label: "Исполнить полностью" },
    { action: "cancel", toStatus: "CANCELLED", label: "Отменить" },
  ],
  FULFILLED: [
    { action: "close", toStatus: "CLOSED", label: "Закрыть заказ" },
    { action: "cancel", toStatus: "CANCELLED", label: "Отменить" },
  ],
  READY_TO_CLOSE: [
    { action: "close", toStatus: "CLOSED", label: "Закрыть заказ" },
    { action: "cancel", toStatus: "CANCELLED", label: "Отменить" },
  ],
  PROBLEM: [{ action: "process", toStatus: "IN_PROCESSING", label: "Вернуть в работу" }],
  SUSPENDED: [{ action: "process", toStatus: "IN_PROCESSING", label: "Возобновить" }],
  CLOSED: [],
  CANCELLED: [],
};

const PRIORITY_META: Record<string, { label: string; color: string; stars: string }> = {
  LOW: { label: "Низкий", color: "#94a3b8", stars: "★" },
  MEDIUM: { label: "Средний", color: "#3b82f6", stars: "★★" },
  HIGH: { label: "Высокий", color: "#f97316", stars: "★★★" },
  URGENT: { label: "Срочный", color: "#dc2626", stars: "★★★★" },
};

const PERIODS: { key: string; label: string }[] = [
  { key: "today", label: "Сегодня" },
  { key: "yesterday", label: "Вчера" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "quarter", label: "Квартал" },
];

const STATUS_OPTIONS = Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label }));

// Действия, доступные для статуса (Гл. 3.4 «Работа по этапам»)
const ACTIONS_BY_STATUS: Record<string, { action: string; label: string; cls: string }[]> = {
  NEW: [{ action: "process", label: "Принять в работу", cls: "text-blue-600" }],
  IN_PROCESSING: [{ action: "confirm", label: "Готов к бронированию", cls: "text-violet-600" }],
  WAITING_FOR_DATA: [{ action: "confirm", label: "Готов к бронированию", cls: "text-violet-600" }],
  READY_FOR_BOOKING: [{ action: "send", label: "Передать в Booking Center", cls: "text-cyan-600" }],
  SENT_TO_BOOKING: [{ action: "complete", label: "Подтверждено поставщиком", cls: "text-teal-600" }],
  PARTIALLY_FULFILLED: [{ action: "complete", label: "Исполнить полностью", cls: "text-teal-600" }],
  FULFILLED: [{ action: "close", label: "Закрыть заказ", cls: "text-emerald-600" }],
  READY_TO_CLOSE: [{ action: "close", label: "Закрыть заказ", cls: "text-emerald-600" }],
  PROBLEM: [{ action: "process", label: "Вернуть в работу", cls: "text-blue-600" }],
  SUSPENDED: [{ action: "process", label: "Возобновить", cls: "text-blue-600" }],
};

const PAYMENT_LABELS: Record<string, string> = {
  paid: "Оплачено",
  partially: "Частично",
  pending: "Ожидает",
  refunded: "Возврат",
};

// Состояние документов по статусу заказа (Гл. 3.8, колонка «Документы»)
const DOCS_LABELS: Record<string, string> = {
  NEW: "Нет",
  IN_PROCESSING: "—",
  WAITING_FOR_DATA: "—",
  READY_FOR_BOOKING: "—",
  SENT_TO_BOOKING: "—",
  PARTIALLY_FULFILLED: "Готовятся",
  FULFILLED: "Готовы",
  READY_TO_CLOSE: "Готовы",
  CLOSED: "Отправлены",
  CANCELLED: "—",
  PROBLEM: "—",
  SUSPENDED: "—",
};

// Этапы жизненного цикла заказа (Гл. 3.1, 3.10) — канонические стадии Baseline §0.4
const LIFECYCLE = [
  { key: "NEW", label: "Создан" },
  { key: "IN_PROCESSING", label: "В обработке" },
  { key: "READY_FOR_BOOKING", label: "Готов к бронированию" },
  { key: "SENT_TO_BOOKING", label: "В бронировании" },
  { key: "FULFILLED", label: "Исполнен" },
  { key: "READY_TO_CLOSE", label: "Готов к закрытию" },
  { key: "CLOSED", label: "Закрыт" },
];

const STAGE_OF: Record<string, number> = {
  NEW: 0,
  IN_PROCESSING: 1,
  WAITING_FOR_DATA: 1,
  READY_FOR_BOOKING: 2,
  SENT_TO_BOOKING: 3,
  PARTIALLY_FULFILLED: 4,
  FULFILLED: 4,
  READY_TO_CLOSE: 5,
  CLOSED: 6,
  CANCELLED: 6,
  PROBLEM: 1,
  SUSPENDED: 1,
};

// ── Контроль исполнения (Гл. 3.4): SLA-лимиты по этапам жизненного цикла ──
// Допустимое время (часов) на каждый этап. В сумме — целевой цикл заказа.
const STAGE_SLA_HOURS: Record<string, number> = {
  NEW: 4,
  IN_PROCESSING: 24,
  READY_FOR_BOOKING: 24,
  SENT_TO_BOOKING: 48,
  FULFILLED: 72,
  READY_TO_CLOSE: 24,
  CLOSED: 24,
};

// Подразделение по имени менеджера (детерминированно, Гл. 3.4 «Контроль исполнения»)
function departmentOf(manager: string): string {
  const known: Record<string, string> = {
    "Анна Смирнова": "Отдел продаж",
    "Игорь Волков": "Отдел продаж",
    "Ольга Козлова": "Отдел продаж",
    "Дмитрий Петров": "Отдел исполнения",
    "Мария Соколова": "Отдел исполнения",
    "Елена Кузнецова": "Отдел исполнения",
  };
  return known[manager] ?? "Отдел исполнения";
}

// Детерминированное время начала этапа: createdAt + сумма длительностей
// предыдущих этапов (каждый 1–6 ч от хеша заказа). Для демо-режима.
function stageStartAt(orderId: string, createdAtMs: number, stageIdx: number): Date {
  let offset = 0;
  for (let i = 0; i < stageIdx; i++) {
    let h = 0;
    const seed = `${orderId}-${i}`;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    offset += (1 + (h % 6)) * 3600000;
  }
  return new Date(createdAtMs + offset);
}

export default function SalesExecution() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Состояние, инициализированное из URL (Dashboard ведёт сюда с фильтром)
  const [period, setPeriod] = useState(searchParams.get("period") || "month");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [priority, setPriority] = useState(searchParams.get("priority") || "");
  const [manager, setManager] = useState(searchParams.get("manager") || "");
  const [source, setSource] = useState(searchParams.get("source") || "");
  const [paymentStatus, setPaymentStatus] = useState(searchParams.get("paymentStatus") || "");
  const [category, setCategory] = useState(searchParams.get("type") || "");
  // Фильтр «Эскалированные» (Гл. 3.17): переключается KPI-карточкой «🚨 Эскалации»
  const [escalated, setEscalated] = useState(searchParams.get("escalated") === "1");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [showFilters, setShowFilters] = useState(false);
  // Режим реестра (Гл. 3.7): «Таблица» (по умолчанию) или «Kanban» — доска с
  // колонками по статусам и перетаскиванием карточек между допустимыми переходами.
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  // Kanban (Гл. 3.7): группировка колонок по менеджеру — у каждого менеджера свой
  // ряд колонок доски. Фильтр по приоритету над доской использует общий priority (3.9).
  const [kanbanGroupBy, setKanbanGroupBy] = useState<"none" | "manager">("none");

  // Открытая карточка заказа (Гл. 3.10)
  const [openId, setOpenId] = useState<string | null>(searchParams.get("open"));
  const [openTab, setOpenTab] = useState(searchParams.get("tab") || "overview");

  // Синхронизация открытой карточки с URL: переходы внутри раздела
  // («Новый заказ» → ?open=new, deep-ссылки Dashboard → ?open=ID) меняют только
  // URL без перемонтирования страницы — состояние подтягиваем из searchParams.
  const urlOpen = searchParams.get("open");
  const urlTab = searchParams.get("tab");
  useEffect(() => {
    // setState в микротаске — синхронный вызов ловит react-hooks/set-state-in-effect
    void Promise.resolve().then(() => {
      setOpenId(urlOpen);
      setOpenTab(urlTab || "overview");
    });
  }, [urlOpen, urlTab]);

  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  // Открытие карточки после применения фильтра быстрого действия (Гл. 3.5):
  // «Создать счёт» и «Отправить документы» применяют фильтр по статусам и,
  // когда данные загрузятся, открывают первый подходящий заказ на нужной вкладке.
  const [quickOpen, setQuickOpen] = useState<{ statuses: string; tab: string } | null>(null);
  // Drill-down по бакету спарклайна KPI-карточки (Гл. 3.6): клик по точке графика
  // сужает реестр заказов до временного бакета (createdAt в границах бакета),
  // KPI и графики остаются по периоду. Инициализируется из URL
  // (bucketFrom/bucketTo), чтобы фильтр переживал перезагрузку и deep-ссылки.
  const [bucketFilter, setBucketFilter] = useState<{ from: string; to: string; label: string } | null>(() => {
    const f = searchParams.get("bucketFrom");
    const t = searchParams.get("bucketTo");
    return f && t ? { from: f, to: t, label: searchParams.get("bucketLabel") || "выбранный бакет" } : null;
  });

  // Построение параметров запроса реестра
  const buildParams = useCallback(
    (pageNum: number) => {
      const params = new URLSearchParams({
        period,
        page: String(pageNum),
        limit: String(limit),
      });
      // В Kanban-режиме колонки заменяют фильтр статуса (Гл. 3.7)
      if (status && viewMode !== "kanban") params.set("status", status);
      if (priority) params.set("priority", priority);
      if (manager) params.set("manager", manager);
      if (source) params.set("source", source);
      if (paymentStatus) params.set("paymentStatus", paymentStatus);
      if (category) params.set("type", category);
      if (escalated) params.set("escalated", "1");
      if (search) params.set("search", search);
      // Бакет спарклайна (Гл. 3.6): фильтр реестра по границам точки графика
      if (bucketFilter) {
        params.set("bucketFrom", bucketFilter.from);
        params.set("bucketTo", bucketFilter.to);
      }
      return params;
    },
    [period, status, priority, manager, source, paymentStatus, category, escalated, search, limit, viewMode, bucketFilter]
  );

  // Единый загрузчик списка заказов (используется эффектом и refreshData)
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/orders?${buildParams(page).toString()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [buildParams, page]);

  // Обновление списка (с дебаунсом для поиска)
  useEffect(() => {
    const t = setTimeout(() => {
      loadData();
    }, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [loadData, search]);

  // Перезагрузка данных после SLA-действия из карточки (Гл. 3.16/3.17):
  // журнал автоматизации и реестр исключений персистентны (таблицы AutomationLog/
  // ExceptionLog), поэтому после действия просто перезапрашиваем API.
  const refreshData = useCallback(() => {
    loadData();
  }, [loadData]);

  // Подсветка строки исключения после перехода из карточки (Гл. 3.17):
  // «📍 Открыть в реестре исключений» закрывает карточку, раскрывает и
  // прокручивает панель исключений, подсвечивая строку заказа.
  const [excHighlight, setExcHighlight] = useState<string | null>(null);
  // Состояние панели реестра исключений (Гл. 3.17): объявлено здесь, а не в блоке
  // автоматизации, потому что linkException (ниже) открывает панель через setExcOpen
  // — ссылка на setter до его объявления ловит react-hooks/immutability.
  const [excOpen, setExcOpen] = useState(true);
  // Функция остановки цикла прокрутки: хранится в ref, чтобы очистить цикл
  // при повторном клике или размонтировании компонента.
  const scrollRetryStopRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => scrollRetryStopRef.current?.();
  }, []);
  const linkException = useCallback((orderId: string) => {
    setOpenId(null);
    setOpenTab("overview");
    setExcOpen(true);
    const p = new URLSearchParams(searchParams.toString());
    p.delete("open");
    p.delete("tab");
    router.replace(`/admin/sales-execution${p.toString() ? `?${p.toString()}` : ""}`);
    setExcHighlight(orderId);
    // Прокрутка к панели исключений: навигация (router.replace) может откатить
    // плавный скролл после его старта, поэтому повторяем попытки, пока секция
    // не окажется в верхней зоне просмотра. Цикл останавливается, если секция
    // в зоне видимости, исчерпан лимит попыток, пользователь начал прокручивать
    // страницу вручную (wheel/touch) или компонент размонтирован.
    scrollRetryStopRef.current?.();
    const target = document.querySelector("#exceptions-section");
    let attempts = 0;
    const stop = () => {
      window.clearInterval(iv);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      if (scrollRetryStopRef.current === stop) scrollRetryStopRef.current = null;
    };
    const iv = window.setInterval(() => {
      attempts++;
      if (!target?.isConnected) {
        stop();
        return;
      }
      const rect = target.getBoundingClientRect();
      if (rect.top >= -80 && rect.top < window.innerHeight * 0.4) {
        stop();
        return;
      }
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (attempts >= 12) stop();
    }, 250);
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    scrollRetryStopRef.current = stop;
    window.setTimeout(() => {
      stop();
      setExcHighlight(null);
    }, 5000);
  }, [router, searchParams]);

  // Смена статуса исключения (Гл. 3.17): PATCH в персистентный реестр с записью
  // в журнал обработки (ExceptionLogHistory), затем обновление списка.
  const changeExceptionStatus = useCallback(async (id: string, action: "take" | "resolve" | "close") => {
    // id приходит с префиксом `exc-` из API-ответа — отдаём в PATCH чистый id из БД
    const cleanId = id.startsWith("exc-") ? id.slice(4) : id;
    try {
      const res = await fetch(`/api/admin/exceptions/${cleanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Ошибка смены статуса");
      await loadData();
    } catch (e) {
      alert(errText(e));
    }
  }, [loadData]);

  // Применение фильтра очереди / KPI с синхронизацией URL
  const applyQueue = useCallback(
    (statuses: string) => {
      setStatus(statuses);
      // Выбор очереди открывает отфильтрованный табличный реестр (Гл. 3.7)
      setViewMode("table");
      setPage(1);
      // Бакет спарклайна привязан к точке графика — очередь сбрасывает его
      setBucketFilter(null);
      const p = new URLSearchParams(searchParams.toString());
      if (statuses) p.set("status", statuses);
      else p.delete("status");
      p.delete("open");
      p.delete("bucketFrom");
      p.delete("bucketTo");
      p.delete("bucketLabel");
      router.replace(`/admin/sales-execution?${p.toString()}`);
    },
    [router, searchParams]
  );

  // Быстрые фильтры периода (Гл. 3.9): Сегодня / Вчера
  const applyPeriod = useCallback(
    (key: string) => {
      setPeriod(key);
      setPage(1);
      // Бакет спарклайна привязан к старому периоду — сбрасываем при смене периода
      setBucketFilter(null);
      const p = new URLSearchParams(searchParams.toString());
      p.set("period", key);
      p.delete("open");
      p.delete("bucketFrom");
      p.delete("bucketTo");
      p.delete("bucketLabel");
      router.replace(`/admin/sales-execution?${p.toString()}`);
    },
    [router, searchParams]
  );

  // Надёжная прокрутка к реестру после клика по точке спарклайна: перезагрузка
  // данных (скелетон) сдвигает layout, поэтому плавный скролл повторяется, пока
  // секция реестра не окажется в зоне видимости. Цикл останавливается, если
  // секция видна, исчерпан лимит попыток, пользователь начал прокручивать
  // вручную или компонент размонтирован (очистка в эффекте ниже).
  const scrollToRegistry = useCallback(() => {
    const target = document.querySelector("#registry-section");
    if (!target) return;
    scrollRetryStopRef.current?.();
    let attempts = 0;
    const stop = () => {
      window.clearInterval(iv);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      if (scrollRetryStopRef.current === stop) scrollRetryStopRef.current = null;
    };
    const iv = window.setInterval(() => {
      attempts++;
      if (!target.isConnected) {
        stop();
        return;
      }
      const rect = target.getBoundingClientRect();
      if (rect.top >= -80 && rect.top < window.innerHeight * 0.4) {
        stop();
        return;
      }
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (attempts >= 12) stop();
    }, 250);
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    scrollRetryStopRef.current = stop;
  }, []);

  // Применение drill-down по бакету спарклайна (Гл. 3.6): реестр заказов
  // сужается до временного бакета точки (from/to — ISO-границы бакета).
  // Период и KPI-карточки не меняются. Прокрутку к реестру выполняет сам
  // обработчик клика (scrollToRegistry вызывается отдельно, чтобы не тянуть
  // доступ к ref в колбэк — react-hooks/refs).
  const applyBucketFilter = useCallback(
    (from: string, to: string, label: string) => {
      setBucketFilter({ from, to, label });
      setPage(1);
      const p = new URLSearchParams(searchParams.toString());
      p.set("bucketFrom", from);
      p.set("bucketTo", to);
      p.set("bucketLabel", label);
      p.delete("open");
      p.delete("tab");
      router.replace(`/admin/sales-execution?${p.toString()}`);
    },
    [router, searchParams]
  );

  // Снятие фильтра по бакету: чип над реестром или повторный клик по активной точке
  const clearBucketFilter = useCallback(() => {
    setBucketFilter(null);
    setPage(1);
    const p = new URLSearchParams(searchParams.toString());
    p.delete("bucketFrom");
    p.delete("bucketTo");
    p.delete("bucketLabel");
    router.replace(`/admin/sales-execution?${p.toString()}`);
  }, [router, searchParams]);

  // Прокрутка к реестру после drill-down (Гл. 3.6): клик по точке ставит флаг
  // в обработчике события, а эффект ниже скроллит после перезагрузки данных
  // (доступ к ref — только в эффекте, react-hooks/refs).
  const scrollToRegistryAfterBucketRef = useRef(false);
  useEffect(() => {
    if (!scrollToRegistryAfterBucketRef.current) return;
    scrollToRegistryAfterBucketRef.current = false;
    scrollToRegistry();
  }, [bucketFilter, scrollToRegistry]);

  const resetFilters = () => {
    setStatus("");
    setPriority("");
    setManager("");
    setSource("");
    setPaymentStatus("");
    setCategory("");
    setEscalated(false);
    setSearch("");
    setPage(1);
    setBucketFilter(null);
    router.replace("/admin/sales-execution");
  };

  // Переключение фильтра «Эскалированные» (Гл. 3.17): клик по KPI-карточке
  // применяет/снимает фильтр, синхронизируя URL. Значение берём из состояния
  // напрямую (escalated в зависимостях): запись в ref во время рендера ловит
  // react-hooks/refs, а колбэк пересоздаётся после каждого изменения фильтра.
  const toggleEscalated = useCallback(() => {
    const next = !escalated;
    setEscalated(next);
    setPage(1);
    // Бакет спарклайна не сочетается с фильтром эскалаций — сбрасываем
    setBucketFilter(null);
    const p = new URLSearchParams(searchParams.toString());
    if (next) p.set("escalated", "1");
    else p.delete("escalated");
    p.delete("open");
    p.delete("bucketFrom");
    p.delete("bucketTo");
    p.delete("bucketLabel");
    router.replace(`/admin/sales-execution?${p.toString()}`);
  }, [router, searchParams, escalated]);

  // ── Массовые операции (Гл. 3.8) ──
  const runBulk = async (action: string, value?: string) => {
    if (!selected.length) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/admin/orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: selected, ...(value ? { value } : {}) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Ошибка массовой операции");
      alert(j.message || "Операция выполнена");
      setSelected([]);
      setPage(1);
      setLoading(true);
      const r = await fetch(`/api/admin/orders?${buildParams(1).toString()}`);
      setData(await r.json());
    } catch (e) {
      alert(errText(e));
    } finally {
      setBulkBusy(false);
    }
  };

  // Перемещение карточки в Kanban (Гл. 3.7): переход по жизненному циклу через
  // PATCH /api/admin/orders/[id]. После успеха реестр и доска перезагружаются.
  const runKanbanMove = async (order: KanbanOrder, action: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Ошибка перехода");
      await loadData();
    } catch (e) {
      alert(errText(e));
    }
  };

  const kpi = data?.kpi;
  const queueSla = data?.queueSla;
  const orders = data?.orders ?? [];
  const pagination = data?.pagination;
  const allChecked = orders.length > 0 && orders.every((o) => selected.includes(o.id));

  // Открытие карточки заказа с нужной вкладкой (Гл. 3.8 «Контекстные действия»)
  const openCard = useCallback(
    (id: string, tab: string) => {
      setOpenId(id);
      setOpenTab(tab);
      const p = new URLSearchParams(searchParams.toString());
      p.set("open", id);
      p.set("tab", tab);
      router.replace(`/admin/sales-execution?${p.toString()}`);
    },
    [router, searchParams]
  );

  // Экспорт выбранных заказов в CSV (Гл. 3.8 «Массовые операции»)
  const exportSelectedCsv = () => {
    if (!selected.length) return;
    downloadOrdersCsv(
      orders.filter((o) => selected.includes(o.id)),
      `orders-selected-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };
  // Экспорт текущей страницы реестра (Гл. 3.3 «Нижняя панель действий»)
  const exportRegistryCsv = () => {
    downloadOrdersCsv(orders, `orders-page-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const toggleAll = () => {
    setSelected(allChecked ? [] : orders.map((o) => o.id));
  };
  const toggleOne = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  // После загрузки данных открываем первый заказ, подходящий под фильтр
  // быстрого действия (Гл. 3.5): «Создать счёт» → вкладка finance,
  // «Отправить документы» → вкладка docs.
  useEffect(() => {
    if (!quickOpen || !data || loading) return;
    const statuses = quickOpen.statuses.split(",");
    // Ждём отфильтрованные данные: на старых (нефильтрованных) не срабатываем,
    // чтобы не открывать карточку из устаревшей выборки и не сбрасывать ожидание раньше времени.
    if (!data.orders.length || !data.orders.every((o) => statuses.includes(o.status))) return;
    // setState в микротаске — синхронный вызов ловит react-hooks/set-state-in-effect
    void Promise.resolve().then(() => {
      openCard(data.orders[0].id, quickOpen.tab);
      setQuickOpen(null);
    });
  }, [quickOpen, data, loading, openCard]);

  // ── KPI-карточки (Гл. 3.6): Новые / В работе / Ожидают поставщика /
  //    Ожидают оплаты / Документы / Просрочено / Возвраты / SLA ──
  const kpiCards = useMemo(() => {
    if (!kpi) return [];
    const statusCount = (list: string[]) =>
      list
        .map((s) => data?.statusCounts.find((x) => x.status === s)?.count ?? 0)
        .reduce((a, b) => a + b, 0);
    return [
      {
        key: "new",
        icon: "🆕",
        title: "Новые заказы",
        value: statusCount(["NEW"]),
        change: kpi.newOrders?.change ?? 0,
        detail: `+${kpi.newToday?.value ?? 0} за 24 ч`,
        statuses: "DRAFT,CREATED",
        color: "#3b82f6",
      },
      {
        key: "active",
        icon: "🔧",
        title: "В работе",
        value: kpi.activeOrders?.value ?? 0,
        change: kpi.activeOrders?.change ?? 0,
        detail: "Проверка, поставщик, оплата, документы",
        statuses: ORDER_STATUS_GROUPS.active.join(","),
        color: "#06b6d4",
      },
      {
        key: "provider",
        icon: "🤝",
        title: "Ожидают поставщика",
        value: kpi.awaitingConfirmation?.value ?? 0,
        change: kpi.awaitingConfirmation?.change ?? 0,
        detail: "Передан в Booking Center",
        statuses: "SENT_TO_BOOKING",
        color: "#8b5cf6",
      },
      {
        key: "payment",
        icon: "⏳",
        title: "Ожидают оплаты",
        value: kpi.awaitingPayment?.value ?? 0,
        change: kpi.awaitingPayment?.change ?? 0,
        detail: `${fmtMoney(data?.financial?.pendingAmount ?? 0)} в ожидании`,
        // Оплата — отдельное измерение paymentStatus; карточка открывает очередь
        // активных этапов бронирования (Baseline §0.6).
        statuses: "READY_FOR_BOOKING,SENT_TO_BOOKING,PARTIALLY_FULFILLED",
        color: "#f97316",
      },
      {
        key: "docs",
        icon: "📄",
        title: "Исполнены и готовы к закрытию",
        value: kpi.ready?.value ?? 0,
        change: kpi.ready?.change ?? 0,
        detail: "Все услуги подтверждены",
        statuses: "FULFILLED,READY_TO_CLOSE",
        color: "#14b8a6",
      },
      {
        key: "overdue",
        icon: "⏰",
        title: "Проблемные",
        value: statusCount(["PROBLEM", "SUSPENDED"]),
        change: kpi.avgCycle?.change ?? 0,
        detail: "Требуется немедленное действие",
        statuses: "PROBLEM,SUSPENDED",
        color: "#dc2626",
      },
      {
        key: "refunds",
        icon: "↩️",
        title: "Отмены и возвраты",
        value: kpi.refunds?.value ?? 0,
        change: kpi.refunds?.change ?? 0,
        detail: `${fmtMoney(data?.financial?.refundedAmount ?? 0)} возвращено`,
        statuses: "CANCELLED",
        color: "#f43f5e",
      },
      {
        key: "sla",
        icon: "🛡",
        title: "Соблюдение SLA",
        value: data?.sla?.compliance ?? 100,
        change: 0,
        detail: `${data?.sla?.breaches ?? 0} нарушений · цель ${data?.sla?.targetHours ?? 48} ч`,
        statuses: "",
        color: (data?.sla?.compliance ?? 100) >= 90 ? "#22c55e" : (data?.sla?.compliance ?? 100) >= 70 ? "#f59e0b" : "#dc2626",
        isPct: true,
      },
      {
        key: "escalations",
        icon: "🚨",
        title: "Эскалации",
        value: kpi.escalations?.value ?? 0,
        change: kpi.escalations?.change ?? 0,
        detail: kpi.escalations?.detail ?? "Заказы с активными исключениями",
        statuses: "",
        color: "#dc2626",
      },
    ];
  }, [kpi, data]);

  const seriesValues = data?.ordersSeries?.values ?? [];
  // Мини-график KPI-карточки (Гл. 3.6): своя серия на карточку из kpiSeries;
  // если ключа нет (старые данные) — fallback на общую динамику заказов.
  // Нулевая (плоская) серия карточки — например «Просрочено» без заказов —
  // не рисуется, чтобы не показывать пустой график.
  const kpiSeriesValues = (key: string): number[] | null => {
    const own = data?.kpiSeries?.[key]?.values;
    if (own) return own.some((v) => v > 0) ? own : null;
    return seriesValues.length > 1 ? seriesValues : null;
  };
  // Тренд KPI-карточки (Гл. 3.6): изменение последнего бакета серии относительно
  // предыдущего. Положительное — ▲ (рост), отрицательное — ▼ (снижение),
  // нулевое — • (без изменений). Для SLA тренд «вверх» = улучшение (больше %).
  const kpiTrend = (key: string): { dir: "up" | "down" | "flat"; delta: number } | null => {
    const own = data?.kpiSeries?.[key]?.values;
    // Нулевая серия (например «Просрочено» без заказов) — тренда нет, как и графика.
    if (!own || own.length < 2 || !own.some((v) => v > 0)) return null;
    const prev = own[own.length - 2];
    const last = own[own.length - 1];
    const delta = last - prev;
    if (delta > 0) return { dir: "up", delta };
    if (delta < 0) return { dir: "down", delta };
    return { dir: "flat", delta: 0 };
  };
  const activeFiltersCount =
    [status, priority, manager, source, paymentStatus, category, escalated ? "1" : ""].filter(Boolean).length;

  // ── Настройка KPI (Гл. 3.6): видимость карточек, сохранение в localStorage ──
  const [kpiHidden, setKpiHidden] = useState<string[]>([]);
  const [kpiSettingsOpen, setKpiSettingsOpen] = useState(false);
  useEffect(() => {
    // setState в микротаске — синхронный вызов ловит react-hooks/set-state-in-effect;
    // try/catch внутри микротаска, чтобы повреждённый JSON не давал rejection
    void Promise.resolve().then(() => {
      try {
        const raw = localStorage.getItem("sales-kpi-hidden");
        if (raw) setKpiHidden(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    });
  }, []);
  const toggleKpi = (key: string) => {
    setKpiHidden((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        localStorage.setItem("sales-kpi-hidden", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const resetKpi = () => {
    setKpiHidden([]);
    try {
      localStorage.removeItem("sales-kpi-hidden");
    } catch {
      /* ignore */
    }
  };

  // ── Автоматизация (Гл. 3.16): включённые сценарии и свёрнутость панели автоматизации ──
  const [autoDisabled, setAutoDisabled] = useState<string[]>([]);
  const [autoOpen, setAutoOpen] = useState(true);
  useEffect(() => {
    // setState в микротаске — синхронный вызов ловит react-hooks/set-state-in-effect;
    // try/catch внутри микротаска, чтобы повреждённый JSON не давал rejection
    void Promise.resolve().then(() => {
      try {
        const raw = localStorage.getItem("sales-auto-disabled");
        if (raw) setAutoDisabled(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    });
  }, []);
  const toggleScenario = (key: string) => {
    const next = autoDisabled.includes(key) ? autoDisabled.filter((k) => k !== key) : [...autoDisabled, key];
    setAutoDisabled(next);
    try {
      localStorage.setItem("sales-auto-disabled", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  const resetScenarios = () => {
    setAutoDisabled([]);
    try {
      localStorage.removeItem("sales-auto-disabled");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-4">
          Ошибка загрузки: {error}
        </div>
      )}

      {/* ── Заголовок раздела + хлебные крошки + быстрые действия (Гл. 3.3, 3.5) ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          {/* Хлебные крошки (3.5): Главная → Продажи и исполнение → Заказы */}
          <nav className="text-xs text-[var(--admin-muted)] flex items-center gap-1.5">
            <span>Главная</span>
            <span>›</span>
            <span className="text-[var(--admin-text)] font-medium">Продажи и исполнение</span>
            <span>›</span>
            <span>Заказы</span>
          </nav>
          <h1 className="text-xl font-bold mt-1">🧳 Продажи и исполнение</h1>
          <p className="text-xs text-[var(--admin-muted)] mt-0.5">
            Операционный центр: заказы, поставщики, документы, оплаты, возвраты (Гл. 3)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Индикаторы состояния системы (Гл. 3.5) */}
          <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-[var(--admin-muted)]">
            {[
              { label: "API поставщиков", state: "green" },
              { label: "Платежные сервисы", state: "green" },
              { label: "Email", state: "green" },
              { label: "SMS", state: "yellow" },
              { label: "Очереди обработки", state: "green" },
              { label: "AI сервис", state: "green" },
            ].map((s) => (
              <span key={s.label} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--admin-bg)]" title={s.label}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.state === "green" ? "bg-emerald-500" : "bg-amber-400"}`} />
                <span className="hidden xl:inline">{s.label}</span>
              </span>
            ))}
          </div>
          {/* Быстрые действия (Гл. 3.5): ⚡ меню часто используемых операций */}
          <QuickActionsMenu
            onNewOrder={() => router.push("/admin/sales-execution?open=new")}
            onApplyFilter={(statuses) => applyQueue(statuses)}
            onApplyFilterAndOpen={(statuses, tab) => {
              // Фильтр + автооткрытие карточки первого подходящего заказа
              applyQueue(statuses);
              setQuickOpen({ statuses, tab });
            }}
            onGoQueue={() => document.querySelector("#queues-section")?.scrollIntoView({ behavior: "smooth" })}
            onAi={() => document.querySelector("#ai-assistant-section")?.scrollIntoView({ behavior: "smooth" })}
          />
          <button
            onClick={() => router.push("/admin/sales-execution?open=new")}
            className="ac-btn ac-btn-primary"
          >
            ➕ Новый заказ
          </button>
        </div>
      </div>

      {/* ── KPI-панель (Гл. 3.6) ── */}
      <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold">KPI-панель</h2>
            <p className="text-xs text-[var(--admin-muted)] mt-0.5">
              Текущее состояние операционной деятельности · период: {PERIODS.find((p) => p.key === period)?.label}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="ac-tabs">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => applyPeriod(p.key)}
                  className={`ac-tab ${period === p.key ? "ac-tab-active" : ""}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Настройка KPI (Гл. 3.6): скрытие карточек, восстановление набора */}
            <div className="relative">
              <button
                onClick={() => setKpiSettingsOpen((s) => !s)}
                className={`ac-btn ac-btn-sm ${kpiSettingsOpen ? "ac-btn-primary" : "ac-btn-secondary"}`}
                title="Настроить KPI-панель"
              >
                ⚙️
              </button>
              {kpiSettingsOpen && (
                <div className="absolute right-0 top-full mt-2 z-30 w-64 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl p-3 space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)] mb-1.5">Отображаемые показатели</div>
                  {kpiCards.map((c) => (
                    <label key={c.key} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-[var(--admin-bg)] rounded-lg px-1.5">
                      <input
                        type="checkbox"
                        checked={!kpiHidden.includes(c.key)}
                        onChange={() => toggleKpi(c.key)}
                        className="accent-primary"
                      />
                      <span className="text-xs">{c.icon} {c.title}</span>
                    </label>
                  ))}
                  <div className="border-t border-[var(--admin-border)] pt-2 mt-2 flex items-center justify-between">
                    <button onClick={resetKpi} className="text-[11px] text-primary hover:underline">↺ Восстановить стандартный набор</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {loading && !data
            ? Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-28 bg-[var(--admin-bg)] rounded-2xl animate-pulse" />
              ))
            : kpiCards
                .filter((c) => !kpiHidden.includes(c.key))
                .map((c) => {
                  const spark = kpiSeriesValues(c.key);
                  // Тренд-метка (Гл. 3.6): ▲/▼/• по последнему бакету серии относительно
                  // предыдущего. Цвет — контекстный: рост зелёный, спад красный.
                  const trend = kpiTrend(c.key);
                  // Спарклайн карточки: последние 10 бакетов серии.
                  const sparkSlice = spark && spark.length > 1 ? spark.slice(-10) : null;
                  const seriesMeta = data?.kpiSeries?.[c.key];
                  // Активный бакет (drill-down, Гл. 3.6): подсветка выбранной точки
                  // на карточке, если фильтр реестра задан именно с этой карточки.
                  const activeFullIdx =
                    bucketFilter && seriesMeta?.starts ? seriesMeta.starts.indexOf(bucketFilter.from) : -1;
                  const activeIdx =
                    activeFullIdx >= 0 && spark && sparkSlice ? activeFullIdx - (spark.length - sparkSlice.length) : -1;
                  return (
                    <button
                      key={c.key}
                      onClick={() => {
                        if (c.key === "escalations") {
                          toggleEscalated();
                          return;
                        }
                        if (c.statuses) applyQueue(c.statuses);
                        else setShowFilters(true);
                      }}
                      className={`ac-card ac-card-hover p-3.5 group text-left w-full ${
                        c.key === "escalations" && escalated ? "ring-2 ring-red-500/60 shadow-lg" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="ac-kpi-icon shrink-0" style={{ background: `${c.color}1a`, color: c.color }}>{c.icon}</span>
                        <span className="text-[11px] font-medium text-[var(--admin-muted)] leading-tight line-clamp-2 flex-1">{c.title}</span>
                        {trend && (
                          <span
                            title={`Последний период: ${trend.dir === "up" ? "рост" : trend.dir === "down" ? "снижение" : "без изменений"} ${Math.abs(trend.delta)}`}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                              trend.dir === "up"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : trend.dir === "down"
                                ? "bg-red-500/10 text-red-500"
                                : "bg-[var(--admin-bg)] text-[var(--admin-muted)]"
                            }`}
                          >
                            {trend.dir === "up" ? "▲" : trend.dir === "down" ? "▼" : "•"}
                            {trend.delta > 0 ? `+${trend.delta}` : trend.delta}
                          </span>
                        )}
                      </div>
                      <div className="mt-2.5 text-2xl font-bold leading-none" style={{ color: c.color }}>
                        {c.isPct ? `${c.value}%` : fmtNumber(c.value)}
                      </div>
                      <div className="text-[10px] text-[var(--admin-muted)] mt-1 line-clamp-2">{c.detail}</div>
                      {sparkSlice && (
                        <div className="mt-2 h-6">
                          <Sparkline
                            data={sparkSlice}
                            color={c.color}
                            height={24}
                            pointLabels={seriesMeta?.labels?.slice(-sparkSlice.length)}
                            activeIndex={activeIdx}
                            // Клик по точке (Гл. 3.6): drill-down — реестр заказов
                            // сужается до бакета точки (временной фильтр createdAt),
                            // период и графики не меняются. Повторный клик по активной
                            // точке снимает фильтр.
                            onPointClick={(idx) => {
                              const meta = data?.kpiSeries?.[c.key];
                              if (!meta?.starts || !spark || spark.length < 2) return;
                              // idx — позиция в sparkSlice (последние 10 бакетов);
                              // пересчитываем индекс в полной серии
                              const i = spark.length - sparkSlice.length + idx;
                              const from = meta.starts[i];
                              if (!from) return;
                              if (bucketFilter && bucketFilter.from === from) {
                                clearBucketFilter();
                                return;
                              }
                              const to = i + 1 < meta.starts.length ? meta.starts[i + 1] : data?.period?.end ?? from;
                              applyBucketFilter(from, to, meta.labels[i] ?? "");
                              // Прокрутка к реестру после перезагрузки данных
                              // (перезагрузка сдвигает layout — см. scrollToRegistry)
                              scrollToRegistryAfterBucketRef.current = true;
                            }}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
        </div>
      </div>

      {/* ── Рабочие очереди (Гл. 3.7) ── */}
      <div id="queues-section" className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold">Рабочие очереди</h2>
            <p className="text-xs text-[var(--admin-muted)] mt-0.5">
              Персональные задачи · выбор очереди применяет фильтр к реестру (3.7)
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[var(--admin-muted)]">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> SLA в норме
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Есть риски
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {loading && !data
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-24 bg-[var(--admin-bg)] rounded-2xl animate-pulse" />
              ))
            : QUEUES.map((q) => {
                const sla = queueSla?.[q.key];
                const count = sla?.total ?? 0;
                const active = status === q.statuses && status !== "";
                return (
                  <button
                    key={q.key}
                    onClick={() => applyQueue(q.statuses)}
                    className={`relative text-left rounded-2xl p-3.5 overflow-hidden transition-all group ${
                      active
                        ? "ring-2 ring-primary shadow-lg"
                        : "hover:shadow-md hover:-translate-y-0.5 border border-transparent"
                    }`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${q.color} opacity-90`} />
                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <span className="text-lg">{q.icon}</span>
                        <span className="text-[10px] font-bold text-white/90 bg-black/20 rounded-md px-1.5 py-0.5">
                          {q.key === "all" ? fmtNumber(kpi?.totalOrders?.value ?? 0) : fmtNumber(count)}
                        </span>
                      </div>
                      <div className="mt-1.5 text-sm font-semibold text-white leading-tight">{q.title}</div>
                      <div className="mt-1 text-[10px] text-white/85">
                        SLA: {q.key === "all" ? `${data?.sla?.compliance ?? 100}%` : `${sla?.compliance ?? 100}%`}
                      </div>
                      {!!sla?.avgHours && (
                        <div className="text-[10px] text-white/75">⏱ {sla.avgHours} ч средн.</div>
                      )}
                    </div>
                  </button>
                );
              })}
        </div>
      </div>

      {/* ── AI Assistant (Гл. 3.3, 3.4): рекомендации по заказам ── */}
      <div
        id="ai-assistant-section"
        className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <div>
              <h2 className="text-base font-bold">AI Assistant</h2>
              <p className="text-xs text-[var(--admin-muted)] mt-0.5">Рекомендации и предупреждения по заказам (3.3, 3.4)</p>
            </div>
          </div>
          <span className="text-[11px] text-[var(--admin-muted)]">AI не изменяет данные без подтверждения · рекомендации требуют решения пользователя</span>
        </div>
        {!data?.aiRecommendations || data.aiRecommendations.length === 0 ? (
          <div className="text-xs text-[var(--admin-muted)] py-3">Рекомендации появятся при наличии данных</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.aiRecommendations.map((r) => {
              const clickable = Boolean(r.orderId);
              return (
                <button
                  key={r.title}
                  onClick={() => {
                    if (r.orderId) {
                      openCard(r.orderId, "ai");
                    }
                  }}
                  disabled={!clickable}
                  title={clickable ? "Открыть AI-анализ заказа" : undefined}
                  className={`p-3 rounded-xl border text-left w-full transition-colors ${
                    r.level === "high"
                      ? "bg-red-50 border-red-200"
                      : r.level === "medium"
                      ? "bg-amber-50 border-amber-200"
                      : "bg-[var(--admin-bg)] border-[var(--admin-border)]"
                  } ${clickable ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : "cursor-default"} disabled:opacity-90`}
                >
                  <div className={`text-xs font-semibold ${r.level === "high" ? "text-red-700" : r.level === "medium" ? "text-amber-700" : "text-[var(--admin-text)]"}`}>
                    {r.title}
                  </div>
                  <div className="text-[11px] text-[var(--admin-muted)] mt-1">{r.effect}</div>
                  {clickable && (
                    <div className="text-[10px] text-primary font-semibold mt-1.5">
                      Открыть AI-анализ заказа →
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Автоматизация процессов исполнения (Гл. 3.16) ── */}
      <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl">
        <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2 cursor-pointer" onClick={() => setAutoOpen((o) => !o)}>
          <div className="flex items-center gap-2">
            <span className="text-lg">⚙️</span>
            <div>
              <h2 className="text-base font-bold">Автоматизация процессов исполнения</h2>
              <p className="text-xs text-[var(--admin-muted)] mt-0.5">
                Business Event Engine · события → правила → действия → журнал (3.16)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[var(--admin-muted)]">
            {data?.automation && (
              <>
                <span className="px-2 py-0.5 rounded-lg bg-[var(--admin-bg)]">✓ {data.automation.stats.success} успешно</span>
                {data.automation.stats.errors > 0 && (
                  <span className="px-2 py-0.5 rounded-lg bg-red-50 text-red-600">✕ {data.automation.stats.errors} ошибок</span>
                )}
                <span className="px-2 py-0.5 rounded-lg bg-[var(--admin-bg)]">⏱ ср. {data.automation.stats.avgMs} мс</span>
              </>
            )}
            <span className="text-[var(--admin-muted)]">{autoOpen ? "▾" : "▸"}</span>
          </div>
        </div>

        {autoOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-[var(--admin-border)] pt-4">
            {/* Сценарии автоматизации (3.16 «Правила обработки») */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {(data?.automation?.scenarios ?? AUTOMATION_SCENARIOS).map((s) => {
                const disabled = autoDisabled.includes(s.key);
                return (
                  <div
                    key={s.key}
                    className={`rounded-xl border p-3 transition-colors ${
                      disabled ? "border-[var(--admin-border)] bg-[var(--admin-bg)]/40 opacity-70" : "border-[var(--admin-border)] bg-[var(--admin-bg)]/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base">{s.icon}</span>
                        <span className="text-xs font-semibold truncate">{s.title}</span>
                      </div>
                      <button
                        onClick={() => toggleScenario(s.key)}
                        className={`relative w-8 rounded-full transition-colors shrink-0 ${disabled ? "bg-[var(--admin-border)]" : "bg-emerald-500"}`}
                        style={{ height: "18px" }}
                        title={disabled ? "Сценарий выключен" : "Сценарий включён"}
                      >
                        <span
                          className={`absolute w-3.5 h-3.5 rounded-full bg-white shadow transition-all ${disabled ? "left-0.5" : "left-4"}`}
                          style={{ top: "2px" }}
                        />
                      </button>
                    </div>
                    <p className="text-[11px] text-[var(--admin-muted)] mt-1.5 leading-snug">{s.description}</p>
                    <div className="text-[10px] text-[var(--admin-muted)] mt-1.5">Группа: {s.group}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-[11px] text-[var(--admin-muted)]">
                {data?.automation
                  ? `Всего операций за период: ${data.automation.stats.total} · успешно ${data.automation.stats.success} · ошибок ${data.automation.stats.errors} · пропущено ${data.automation.stats.skipped}`
                  : "Загрузка…"}
              </div>
              <button onClick={resetScenarios} className="ac-btn ac-btn-secondary ac-btn-sm">
                ↺ Восстановить все сценарии
              </button>
            </div>

            {/* Журнал автоматических операций (3.16 «Мониторинг») */}
            <div>
              <h4 className="text-[11px] font-semibold text-[var(--admin-muted)] uppercase mb-2">Журнал автоматических операций</h4>
              {!data?.automation || data.automation.journal.length === 0 ? (
                <div className="text-xs text-[var(--admin-muted)] py-3">Нет автоматических операций за период</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="ac-table">
                    <thead>
                      <tr>
                        <th className="ac-th">Время</th>
                        <th className="ac-th">Событие</th>
                        <th className="ac-th">Выполненное действие</th>
                        <th className="ac-th">Результат</th>
                        <th className="ac-th">Длит.</th>
                        <th className="ac-th">Источник</th>
                        <th className="ac-th">Заказ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.automation.journal.map((ev) => (
                        <tr key={ev.id} className="ac-tr">
                          <td className="ac-td whitespace-nowrap text-[var(--admin-muted)]">{fmtDateTime(ev.at)}</td>
                          <td className="ac-td font-semibold whitespace-nowrap">{ev.event}</td>
                          <td className="ac-td text-[var(--admin-muted)] max-w-[320px]">{ev.action}</td>
                          <td className="ac-td">
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold ${
                                ev.result === "success"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : ev.result === "error"
                                  ? "bg-red-50 text-red-600"
                                  : "bg-[var(--admin-bg)] text-[var(--admin-muted)]"
                              }`}
                            >
                              {ev.result === "success" ? "✓ Успех" : ev.result === "error" ? "✕ Ошибка" : "– Пропущено"}
                            </span>
                          </td>
                          <td className="ac-td text-[var(--admin-muted)]">{ev.durationMs} мс</td>
                          <td className="ac-td text-[var(--admin-muted)]">{ev.source}</td>
                          <td className="ac-td text-primary">{ev.orderNumber ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Исключительные ситуации (Гл. 3.17) ── */}
      <div id="exceptions-section" className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl">
        <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2 cursor-pointer" onClick={() => setExcOpen((o) => !o)}>
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <h2 className="text-base font-bold">Исключительные ситуации</h2>
              <p className="text-xs text-[var(--admin-muted)] mt-0.5">
                Exception Management Engine · обнаружение → классификация → критичность → сценарий (3.17)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[var(--admin-muted)]">
            {data?.exceptions && (
              <>
                {data.exceptions.stats.critical > 0 && (
                  <span className="px-2 py-0.5 rounded-lg bg-red-50 text-red-600 font-semibold">⛔ {data.exceptions.stats.critical} критических</span>
                )}
                <span className="px-2 py-0.5 rounded-lg bg-[var(--admin-bg)]">Активно: {data.exceptions.stats.active}</span>
                <span className="px-2 py-0.5 rounded-lg bg-[var(--admin-bg)]">В работе: {data.exceptions.stats.inWork}</span>
              </>
            )}
            <span className="text-[var(--admin-muted)]">{excOpen ? "▾" : "▸"}</span>
          </div>
        </div>

        {excOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-[var(--admin-border)] pt-4">
            {!data?.exceptions || data.exceptions.list.length === 0 ? (
              <div className="text-xs text-[var(--admin-muted)] py-3">Исключительных ситуаций за период нет</div>
            ) : (
              <>
                {/* Панель контроля исключений (3.17) */}
                <div className="overflow-x-auto">
                  <table className="ac-table min-w-[900px]">
                    <thead>
                      <tr>
                        <th className="ac-th">Тип</th>
                        <th className="ac-th">Категория</th>
                        <th className="ac-th">Критичность</th>
                        <th className="ac-th">Заказ</th>
                        <th className="ac-th">Ответственный</th>
                        <th className="ac-th">Время</th>
                        <th className="ac-th">Статус</th>
                        <th className="ac-th">Описание</th>
                        <th className="ac-th">AI-рекомендация</th>
                        <th className="ac-th">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.exceptions.list.map((e) => (
                        <ExceptionRow
                          key={e.id}
                          e={e}
                          highlight={e.criticality === "critical" ? "bg-red-50/40" : ""}
                          highlightOrder={excHighlight}
                          onStatusChange={changeExceptionStatus}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Категории исключений (3.17) */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-[var(--admin-muted)]">Категории:</span>
                  {EXCEPTION_CATEGORIES.map((c) => (
                    <span key={c} className="px-2 py-0.5 rounded-lg bg-[var(--admin-bg)] text-[10px] text-[var(--admin-muted)]">
                      {c}
                    </span>
                  ))}
                </div>

                {/* Эскалация (3.17) */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--admin-bg)] flex-wrap">
                  <span className="text-base">🚨</span>
                  <div className="text-[11px] text-[var(--admin-muted)] flex-1 min-w-[200px]">
                    Эскалация запускается автоматически при критических исключениях: уведомление руководителя, передача заказа, изменение приоритета, создание инцидента.
                  </div>
                  <button
                    onClick={() => alert("Эскалация: руководитель уведомлён, инцидент создан, приоритет повышен (демо).")}
                    className="ac-btn ac-btn-danger ac-btn-sm"
                  >
                    🚨 Эскалировать все критические
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Панель фильтрации (Гл. 3.9) ── */}
      <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Быстрый поиск (3.9): номер, клиент, услуга, поставщик… */}
          <div className="relative flex-1 min-w-[220px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--admin-muted)]">🔍</span>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Поиск: № заказа, клиент, услуга, поставщик…"
              className="w-full h-10 pl-9 pr-3 rounded-xl text-sm bg-[var(--admin-bg)] border border-[var(--admin-border)] focus:border-primary focus:outline-none"
            />
          </div>

          {/* Быстрые фильтры (3.9) */}
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { label: "Сегодня", action: () => applyPeriod("today") },
              { label: "Вчера", action: () => applyPeriod("yesterday") },
              { label: "Мои заказы", statuses: "" },
              { label: "Новые", statuses: "NEW" },
              { label: "В обработке", statuses: "IN_PROCESSING,WAITING_FOR_DATA" },
              { label: "Готовы к бронированию", statuses: "READY_FOR_BOOKING" },
              { label: "В бронировании", statuses: "SENT_TO_BOOKING" },
              { label: "Проблемные", statuses: "PROBLEM,SUSPENDED" },
              { label: "Отмены", statuses: "CANCELLED" },
              { label: "🚨 Эскалированные", active: escalated, action: toggleEscalated },
            ].map((f) => (
              <button
                key={f.label}
                onClick={() => (f.action ? f.action() : applyQueue(f.statuses ?? ""))}
                className={`px-3 h-9 rounded-lg text-xs font-medium border transition-colors ${
                  f.active ?? (f.statuses !== undefined && f.statuses !== "" && status === f.statuses)
                    ? "bg-primary text-white border-primary"
                    : "bg-[var(--admin-bg)] border-[var(--admin-border)] text-[var(--admin-muted)] hover:border-primary hover:text-primary"
                }`}
              >
                {f.label}
              </button>
            ))}
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`px-3 h-9 rounded-lg text-xs font-medium border transition-colors ${
                showFilters ? "bg-primary text-white border-primary" : "bg-[var(--admin-bg)] border-[var(--admin-border)] text-[var(--admin-muted)] hover:border-primary hover:text-primary"
              }`}
            >
              ⚙ Расширенные
            </button>
            {(activeFiltersCount > 0 || showFilters) && (
              <button
                onClick={resetFilters}
                className="ac-btn ac-btn-danger"
              >
                ✕ Сбросить
              </button>
            )}
          </div>
        </div>

        {/* Расширенные фильтры (3.9): сгруппированы по блокам */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mt-4 pt-4 border-t border-[var(--admin-border)]">
            <FilterSelect label="Статус" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUS_OPTIONS} placeholder="Все статусы" />
            <FilterSelect
              label="Приоритет"
              value={priority}
              onChange={(v) => { setPriority(v); setPage(1); }}
              options={Object.entries(PRIORITY_META).map(([v, m]) => ({ value: v, label: m.label }))}
              placeholder="Любой"
            />
            <FilterSelect
              label="Категория услуги"
              value={category}
              onChange={(v) => { setCategory(v); setPage(1); }}
              options={Object.entries(SERVICE_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              placeholder="Все"
            />
            <FilterSelect
              label="Менеджер"
              value={manager}
              onChange={(v) => { setManager(v); setPage(1); }}
              options={(data?.managers ?? []).map((m) => ({ value: m, label: m }))}
              placeholder="Любой"
            />
            <FilterSelect
              label="Источник"
              value={source}
              onChange={(v) => { setSource(v); setPage(1); }}
              options={["Сайт", "Мобильное приложение", "Партнёр", "Call-центр", "Telegram-бот", "WhatsApp"].map((s) => ({ value: s, label: s }))}
              placeholder="Любой"
            />
            <FilterSelect
              label="Оплата"
              value={paymentStatus}
              onChange={(v) => { setPaymentStatus(v); setPage(1); }}
              options={Object.entries(PAYMENT_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              placeholder="Любая"
            />
          </div>
        )}
      </div>

      {/* ── Реестр заказов (Гл. 3.8) ── */}
      <div id="registry-section" className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--admin-border)] flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold">Реестр заказов</h2>
            <span className="text-xs text-[var(--admin-muted)]">
              {viewMode === "kanban"
                ? data
                  ? `Доска: ${data.kanban.length} заказов${data.kanban.length >= 150 ? " · показано до 150" : ""}`
                  : "…"
                : pagination
                ? `Найдено: ${pagination.total} ${ruPlural(pagination.total, "заказ", "заказа", "заказов")}`
                : "…"}
            </span>
            {/* Drill-down по бакету спарклайна (Гл. 3.6): активный фильтр точки */}
            {bucketFilter && (
              <button
                onClick={clearBucketFilter}
                title={`Снять фильтр по бакету «${bucketFilter.label}»`}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 transition-colors"
              >
                🎯 {bucketFilter.label}
                <span className="text-primary/60">✕</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Режим отображения реестра (Гл. 3.7): таблица / Kanban-доска */}
            <div className="flex items-center gap-1 rounded-xl bg-[var(--admin-bg)] p-0.5 border border-[var(--admin-border)]">
              <button
                onClick={() => setViewMode("table")}
                className={`px-2.5 h-8 rounded-lg text-[11px] font-medium transition-colors ${
                  viewMode === "table" ? "bg-primary text-white" : "text-[var(--admin-muted)] hover:text-primary"
                }`}
              >
                📋 Таблица
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                className={`px-2.5 h-8 rounded-lg text-[11px] font-medium transition-colors ${
                  viewMode === "kanban" ? "bg-primary text-white" : "text-[var(--admin-muted)] hover:text-primary"
                }`}
                title="Kanban: колонки по статусам, перетаскивание карточек в пределах допустимых переходов (Гл. 3.7)"
              >
                🃏 Kanban
              </button>
            </div>
            {viewMode === "table" && orders.reduce((a, o) => a + o.amount, 0) > 0 && (
              <span className="text-xs text-[var(--admin-muted)]">
                Сумма выборки: <b>{fmtMoney(orders.reduce((a, o) => a + o.amount, 0))}</b>
              </span>
            )}
            {/* Сохранённые представления (Гл. 3.9) */}
            <SavedViews
              current={{
                period,
                status,
                priority,
                manager,
                source,
                paymentStatus,
                category,
                search,
              }}
              onApply={(v) => {
                setPeriod(v.period ?? "month");
                setStatus(v.status ?? "");
                setPriority(v.priority ?? "");
                setManager(v.manager ?? "");
                setSource(v.source ?? "");
                setPaymentStatus(v.paymentStatus ?? "");
                setCategory(v.category ?? "");
                setSearch(v.search ?? "");
                setPage(1);
              }}
            />
            <button
              onClick={() => router.push("/admin/sales-execution?open=new")}
              className="ac-btn ac-btn-primary"
            >
              ➕ Новый заказ
            </button>
          </div>
        </div>

        {/* Панель массовых действий (3.8) */}
        {viewMode === "table" && selected.length > 0 && (
          <div className="px-4 py-2.5 bg-primary/5 border-b border-[var(--admin-border)] flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-primary">
              Выбрано: {selected.length} {ruPlural(selected.length, "заказ", "заказа", "заказов")}
            </span>
            <div className="h-4 w-px bg-[var(--admin-border)]" />
            <BulkBtn onClick={() => runBulk("confirm")} disabled={bulkBusy} label="✓ Подтвердить" />
            <BulkBtn onClick={() => runBulk("pay")} disabled={bulkBusy} label="💳 На оплату" />
            <BulkBtn onClick={() => runBulk("complete")} disabled={bulkBusy} label="🎉 Завершить" />
            <BulkBtn onClick={() => runBulk("cancel")} disabled={bulkBusy} label="✕ Отменить" />
            <BulkBtn onClick={() => runBulk("close")} disabled={bulkBusy} label="📄 Закрыть" />
            <BulkBtn onClick={exportSelectedCsv} disabled={bulkBusy} label="📤 Экспорт" />
            <select
              onChange={(e) => {
                if (e.target.value) {
                  runBulk("assign_manager", e.target.value);
                  e.target.value = "";
                }
              }}
              className="ac-select"
            >
              <option value="">👤 Назначить менеджера…</option>
              {(data?.managers ?? []).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  runBulk("set_priority", e.target.value);
                  e.target.value = "";
                }
              }}
              className="ac-select"
            >
              <option value="">⭐ Изменить приоритет…</option>
              {Object.entries(PRIORITY_META).map(([v, m]) => (
                <option key={v} value={v}>{m.stars} {m.label}</option>
              ))}
            </select>
            <button
              onClick={() => setSelected([])}
              className="ml-auto text-xs text-[var(--admin-muted)] hover:text-rose-600"
            >
              Отменить выбор
            </button>
          </div>
        )}

        {viewMode === "kanban" ? (
          <KanbanBoard
            orders={data?.kanban ?? []}
            loading={loading && !data}
            onOpenCard={(id) => openCard(id, "overview")}
            onMove={runKanbanMove}
            priority={priority}
            onPriorityChange={(v) => {
              setPriority(v);
              setPage(1);
            }}
            groupBy={kanbanGroupBy}
            onGroupByChange={setKanbanGroupBy}
          />
        ) : (
        <div className="overflow-x-auto">
          <table className="ac-table min-w-[1100px]">
            <thead>
              <tr>
                <th className="ac-th w-8">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} className="accent-primary" />
                </th>
                <th className="ac-th w-9" title="Эскалированные заказы (Гл. 3.17)">🚨</th>
                <th className="ac-th">№ заказа</th>
                <th className="ac-th">Статус</th>
                <th className="ac-th">Приоритет</th>
                <th className="ac-th">Клиент / Услуга</th>
                <th className="ac-th">Поставщик</th>
                <th className="ac-th">Менеджер</th>
                <th className="ac-th">Дата создания</th>
                <th className="ac-th">Срок исполнения</th>
                <th className="ac-th">Оплата</th>
                <th className="ac-th">Документы</th>
                <th className="ac-th">SLA</th>
                <th className="ac-th">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={14} className="ac-td">
                        <div className="h-10 bg-[var(--admin-bg)] rounded-xl animate-pulse" />
                      </td>
                    </tr>
                  ))
                : orders.length === 0 && (
                    <tr>
                      <td colSpan={14} className="ac-td py-12 text-center text-[var(--admin-muted)]">
                        <div className="text-3xl mb-2">🗂</div>
                        Заказы не найдены. Измените условия фильтрации или нажмите «Сбросить».
                      </td>
                    </tr>
                  )}
              {orders.map((o) => {
                const p = PRIORITY_META[o.priority] ?? PRIORITY_META.MEDIUM;
                const slaColor = o.status === "PROBLEM" || o.status === "SUSPENDED" ? "#dc2626" : o.status === "SENT_TO_BOOKING" || o.status === "WAITING_FOR_DATA" ? "#f59e0b" : "#22c55e";
                // Подсветка строк: проблемные — сильная красная подложка,
                // эскалированные (Гл. 3.17) — лёгкая красная (светлее),
                // чтобы заказы, требующие внимания, выделялись без клика.
                const rowBg = o.status === "PROBLEM" || o.status === "SUSPENDED" ? "bg-red-50/40" : o.escalated ? "bg-red-50/30" : "";
                return (
                  <tr
                    key={o.id}
                    onClick={() => openCard(o.id, "overview")}
                    className={`group border-b border-[var(--admin-border)]/60 hover:bg-[var(--admin-bg)] cursor-pointer transition-colors relative ${rowBg}`}
                  >
                    <td className="ac-td" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggleOne(o.id)} className="accent-primary" />
                    </td>
                    {/* Колонка-индикатор эскалации (Гл. 3.17): клик открывает
                        реестр исключений и подсвечивает строку заказа */}
                    <td className="ac-td text-center" onClick={(e) => e.stopPropagation()}>
                      {o.escalated ? (
                        <button
                          title="Эскалирован: открыть реестр исключений"
                          onClick={() => linkException(o.id)}
                          className="ac-btn ac-btn-ghost ac-btn-icon text-red-500 hover:bg-red-50 hover:scale-110 transition-transform"
                        >
                          🚨
                        </button>
                      ) : null}
                    </td>
                    <td className="ac-td">
                      <div className="font-bold text-xs">{o.orderNumber}</div>
                      {o.unreadCount > 0 && (
                        <span className="text-[10px] text-primary font-semibold">💬 {o.unreadCount}</span>
                      )}
                    </td>
                    <td className="ac-td">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap"
                        style={{ background: `${ORDER_STATUS_COLORS[o.status]}1a`, color: ORDER_STATUS_COLORS[o.status] }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: ORDER_STATUS_COLORS[o.status] }} />
                        {ORDER_STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="ac-td">
                      <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: p.color }} title={`${p.label} (${p.stars})`}>
                        {p.stars} {p.label}
                      </span>
                    </td>
                    <td className="ac-td">
                      <div className="font-semibold text-xs">{o.client}</div>
                      <div className="text-[11px] text-[var(--admin-muted)] truncate max-w-[180px]">
                        {SERVICE_TYPE_ICONS[o.categoryType] ?? "🧩"} {o.service}
                      </div>
                    </td>
                    <td className="ac-td text-[var(--admin-muted)]">{o.provider}</td>
                    <td className="ac-td">{o.manager}</td>
                    <td className="ac-td text-[var(--admin-muted)] whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                    <td className="ac-td text-[var(--admin-muted)] whitespace-nowrap">
                      {o.serviceDate ? fmtDate(o.serviceDate) : "—"}
                    </td>
                    <td className="ac-td">
                      <div className="text-xs font-semibold" style={{ color: o.paymentStatus === "paid" ? "#22c55e" : o.paymentStatus === "pending" ? "#f97316" : "#ef4444" }}>
                        {PAYMENT_LABELS[o.paymentStatus] ?? o.paymentStatus}
                      </div>
                      <div className="text-[10px] text-[var(--admin-muted)]">
                        {fmtMoney(o.paidAmount)} / {fmtMoney(o.amount)}
                      </div>
                    </td>
                    <td className="ac-td">{DOCS_LABELS[o.status] ?? "—"}</td>
                    <td className="ac-td">
                      <span className="text-xs font-bold" style={{ color: slaColor }}>
                        {o.status === "PROBLEM" || o.status === "SUSPENDED" ? "✕" : "✓"} {o.status === "PROBLEM" || o.status === "SUSPENDED" ? "0%" : "100%"}
                      </span>
                    </td>
                    {/* Контекстные действия (Гл. 3.8): панель при наведении на строку */}
                    <td className="ac-td w-0" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button title="Просмотр" onClick={() => openCard(o.id, "overview")} className="ac-btn ac-btn-ghost ac-btn-icon">👁</button>
                        <button title="Редактировать" onClick={() => openCard(o.id, "overview")} className="ac-btn ac-btn-ghost ac-btn-icon">✏️</button>
                        <button title="Документы" onClick={() => openCard(o.id, "docs")} className="ac-btn ac-btn-ghost ac-btn-icon">📄</button>
                        <button title="Оплата" onClick={() => openCard(o.id, "finance")} className="ac-btn ac-btn-ghost ac-btn-icon">💳</button>
                        <button title="Отправить клиенту" onClick={() => openCard(o.id, "messages")} className="ac-btn ac-btn-ghost ac-btn-icon">📧</button>
                        <button title="AI-анализ" onClick={() => openCard(o.id, "ai")} className="ac-btn ac-btn-ghost ac-btn-icon">🤖</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}

        {/* Пагинация (3.8): пагинация · размер страницы · количество найденных */}
        {viewMode === "table" && pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-[var(--admin-border)] flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-[var(--admin-muted)]">
              Стр. {pagination.page} из {pagination.totalPages} · {pagination.total} записей
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="ac-btn ac-btn-secondary"
              >
                ← Назад
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="ac-btn ac-btn-secondary"
              >
                Вперёд →
              </button>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value));
                  setPage(1);
                }}
                className="ac-select ml-2"
              >
                {[10, 15, 25, 50].map((n) => (
                  <option key={n} value={n}>{n} на стр.</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Нижняя панель действий (Гл. 3.3): экспорт · сводка · массовые операции */}
        {viewMode === "table" && (
        <div className="px-4 py-3 border-t border-[var(--admin-border)] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap text-[11px] text-[var(--admin-muted)]">
            <span>Найдено: <b className="text-[var(--admin-text)]">{pagination?.total ?? 0}</b> заказов</span>
            {orders.length > 0 && (
              <span>
                · Сумма выборки: <b className="text-[var(--admin-text)]">{fmtMoney(orders.reduce((a, o) => a + o.amount, 0))}</b>
              </span>
            )}
            {selected.length > 0 && (
              <span className="text-primary font-semibold">· Выбрано: {selected.length}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={exportSelectedCsv} disabled={!selected.length} className="ac-btn ac-btn-secondary ac-btn-sm">
              📤 Экспорт выбранных
            </button>
            <button onClick={exportRegistryCsv} className="ac-btn ac-btn-primary ac-btn-sm">
              📥 Экспорт реестра (CSV)
            </button>
          </div>
        </div>
        )}
      </div>

      {/* ── Карточка заказа (Гл. 3.10) ── */}
      {openId && openId !== "new" && (
        <OrderCard
          orderId={openId}
          tab={openTab}
          onTab={setOpenTab}
          onDataChanged={refreshData}
          onLinkException={linkException}
          onClose={() => {
            setOpenId(null);
            const p = new URLSearchParams(searchParams.toString());
            p.delete("open");
            p.delete("tab");
            router.replace(`/admin/sales-execution${p.toString() ? `?${p.toString()}` : ""}`);
          }}
        />
      )}

      {openId === "new" && (
        <CreateOrderModal
          onClose={() => {
            setOpenId(null);
            const p = new URLSearchParams(searchParams.toString());
            p.delete("open");
            router.replace(`/admin/sales-execution${p.toString() ? `?${p.toString()}` : ""}`);
          }}
          onCreated={(id) => {
            setOpenId(null);
            setPage(1);
            const p = new URLSearchParams(searchParams.toString());
            p.set("open", id);
            p.set("tab", "overview");
            router.replace(`/admin/sales-execution?${p.toString()}`);
          }}
        />
      )}
    </div>
  );
}

/** Краткое сообщение об ошибке (Error или строка). */
function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Общий помощник экспорта заказов в CSV (Гл. 3.8): BOM + разделитель «;». */
function downloadOrdersCsv(rows: OrderRow[], filename: string) {
  const header = ["№ заказа", "Клиент", "Услуга", "Статус", "Приоритет", "Оплата", "Сумма", "Валюта", "Менеджер", "Дата создания", "Срок исполнения"];
  const body = rows.map((o) => [
    o.orderNumber,
    o.client,
    o.service,
    ORDER_STATUS_LABELS[o.status] ?? o.status,
    PRIORITY_META[o.priority]?.label ?? o.priority,
    PAYMENT_LABELS[o.paymentStatus] ?? o.paymentStatus,
    String(o.amount),
    o.currency,
    o.manager,
    fmtDate(o.createdAt),
    o.serviceDate ? fmtDate(o.serviceDate) : "—",
  ]);
  const csv = [header, ...body]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Вспомогательные UI-компоненты ──

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-[var(--admin-muted)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ac-select mt-1 w-full"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function BulkBtn({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="ac-btn ac-btn-secondary ac-btn-sm"
    >
      {label}
    </button>
  );
}

/**
 * Быстрые действия (Гл. 3.5): ⚡ меню часто используемых операций.
 * Состав фиксирован для демо; персонализация по роли — на будущее.
 */
function QuickActionsMenu({
  onNewOrder,
  onApplyFilter,
  onApplyFilterAndOpen,
  onGoQueue,
  onAi,
}: {
  onNewOrder: () => void;
  onApplyFilter: (statuses: string) => void;
  onApplyFilterAndOpen: (statuses: string, tab: string) => void;
  onGoQueue: () => void;
  onAi: () => void;
}) {
  const [open, setOpen] = useState(false);
  const items = [
    { icon: "➕", label: "Создать заказ", run: onNewOrder },
    { icon: "🔍", label: "В обработке", statuses: "IN_PROCESSING,WAITING_FOR_DATA" },
    { icon: "🧾", label: "Готовы к бронированию", statuses: "READY_FOR_BOOKING", tab: "finance" },
    { icon: "📤", label: "Исполнены", statuses: "FULFILLED,READY_TO_CLOSE", tab: "docs" },
    { icon: "↩️", label: "Отмены", statuses: "CANCELLED" },
    { icon: "📋", label: "Перейти в рабочую очередь", run: onGoQueue },
    { icon: "🤖", label: "Запустить AI-анализ", run: onAi },
  ] as { icon: string; label: string; statuses?: string; tab?: string; run?: () => void }[];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`ac-btn ${open ? "ac-btn-primary" : "ac-btn-secondary"}`}
        title="Быстрые действия"
      >
        ⚡ Быстрые действия ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-40 w-64 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl p-1.5">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                if (it.statuses && it.tab) onApplyFilterAndOpen(it.statuses, it.tab);
                else if (it.statuses) onApplyFilter(it.statuses);
                else it.run?.();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs hover:bg-[var(--admin-bg)] transition-colors text-left"
            >
              <span className="text-sm">{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface SavedView {
  id: string;
  name: string;
  period: string;
  status: string;
  priority: string;
  manager: string;
  source: string;
  paymentStatus: string;
  category: string;
  search: string;
}

/**
 * Сохранённые представления (Гл. 3.9): сохранение комбинации фильтров,
 * переключение между конфигурациями. Хранятся в localStorage пользователя.
 */
function SavedViews({
  current,
  onApply,
}: {
  current: Omit<SavedView, "id" | "name">;
  onApply: (v: SavedView) => void;
}) {
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<SavedView[]>([]);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // setState в микротаске — синхронный вызов ловит react-hooks/set-state-in-effect
    void Promise.resolve().then(() => {
      try {
        setViews(JSON.parse(localStorage.getItem("sales-views") || "[]"));
      } catch {
        setViews([]);
      }
    });
  }, [open]);

  const persist = (next: SavedView[]) => {
    setViews(next);
    try {
      localStorage.setItem("sales-views", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const save = () => {
    const v: SavedView = { id: `v${Date.now()}`, name: name.trim() || `Представление ${views.length + 1}`, ...current };
    persist([...views, v]);
    setName("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const remove = (id: string) => persist(views.filter((v) => v.id !== id));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`ac-btn ac-btn-sm ${open ? "ac-btn-primary" : "ac-btn-secondary"}`}
        title="Сохранённые представления фильтров"
      >
        💾 Представления {views.length > 0 && `(${views.length})`}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-72 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)] mb-2">Сохранённые представления</div>
          <div className="flex gap-1.5 mb-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="Название (напр. «Заказы Турции»)"
              className="flex-1 h-8 px-2.5 rounded-lg text-xs bg-[var(--admin-bg)] border border-[var(--admin-border)] focus:border-primary focus:outline-none"
            />
            <button onClick={save} className="ac-btn ac-btn-primary ac-btn-sm">{saved ? "✓" : "💾"}</button>
          </div>
          {views.length === 0 ? (
            <div className="text-[11px] text-[var(--admin-muted)] py-2 text-center">Сохраните текущую комбинацию фильтров</div>
          ) : (
            <div className="space-y-1 max-h-52 overflow-y-auto no-scrollbar">
              {views.map((v) => (
                <div key={v.id} className="flex items-center gap-1.5 group/view">
                  <button
                    onClick={() => {
                      onApply(v);
                      setOpen(false);
                    }}
                    className="flex-1 text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-[var(--admin-bg)] truncate"
                  >
                    {v.name}
                    {(v.status || v.priority || v.manager || v.search) && (
                      <span className="block text-[10px] text-[var(--admin-muted)] truncate">
                        {[v.status && ORDER_STATUS_LABELS[v.status.split(",")[0]] ? ORDER_STATUS_LABELS[v.status.split(",")[0]] + (v.status.includes(",") ? "+" : "") : "", v.priority ? PRIORITY_META[v.priority]?.label : "", v.search].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => remove(v.id)}
                    className="text-[var(--admin-muted)] hover:text-rose-600 text-xs px-1 opacity-0 group-hover/view:opacity-100"
                    title="Удалить"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Kanban-доска (Гл. 3.7) ──

/**
 * Kanban-представление рабочих очередей (Гл. 3.7): заказы распределены по
 * колонкам этапов жизненного цикла. Карточку можно перетащить в колонку
 * допустимого перехода (KANBAN_MOVES зеркалит TRANSITIONS бэкенда) либо
 * выполнить переход кнопкой на карточке. Недоступные колонки подсвечиваются
 * и сброс не принимают. Клик по карточке открывает карточку заказа (3.10).
 */
function KanbanBoard({
  orders,
  loading,
  onOpenCard,
  onMove,
  priority,
  onPriorityChange,
  groupBy,
  onGroupByChange,
}: {
  orders: KanbanOrder[];
  loading: boolean;
  onOpenCard: (id: string) => void;
  onMove: (order: KanbanOrder, action: string) => Promise<void>;
  // Kanban (Гл. 3.7): фильтр по приоритету над доской (общий с панелью фильтров)
  priority: string;
  onPriorityChange: (v: string) => void;
  // Группировка колонок по менеджеру: у каждого менеджера свой ряд колонок
  groupBy: "none" | "manager";
  onGroupByChange: (g: "none" | "manager") => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  // Подавление клика сразу после перетаскивания (иначе после drop открывается
  // карточка заказа без намеренного клика).
  const justDraggedRef = useRef(false);

  // Колонки, куда можно переместить карточку с данным статусом
  const allowedCols = (status: string): string[] => {
    const cols: string[] = [];
    for (const m of KANBAN_MOVES[status] ?? []) {
      const c = KANBAN_STATUS_COLUMN[m.toStatus];
      if (c && !cols.includes(c)) cols.push(c);
    }
    return cols;
  };
  const canDrop = (status: string, colKey: string) => allowedCols(status).includes(colKey);

  const dragOrder = dragId ? orders.find((o) => o.id === dragId) : null;
  const clearDrag = () => {
    setDragId(null);
    setDragOverCol(null);
  };

  const handleDrop = (colKey: string) => {
    if (!dragOrder) return;
    // Сброс на колонку, где карточка уже находится, — no-op: переход доступен
    // только в другую колонку (или кнопкой на самой карточке).
    if (KANBAN_STATUS_COLUMN[dragOrder.status] === colKey) {
      clearDrag();
      return;
    }
    const move = (KANBAN_MOVES[dragOrder.status] ?? []).find((m) => KANBAN_STATUS_COLUMN[m.toStatus] === colKey);
    if (move) void onMove(dragOrder, move.action);
    clearDrag();
  };

  // Ряд колонок для заданного набора заказов: общий для всего реестра и для
  // каждого менеджера при группировке. prefix — ключ группы, чтобы подсветка
  // drag&drop не перекрывала одноимённые колонки соседних групп (Гл. 3.7).
  const renderColumns = (items: KanbanOrder[], prefix: string) => (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
      {KANBAN_COLUMNS.map((col) => {
        const colItems = items.filter((o) => col.statuses.includes(o.status));
        const droppable = dragOrder ? canDrop(dragOrder.status, col.key) : false;
        const dropKey = `${prefix}::${col.key}`;
        const isOver = dragOverCol === dropKey;
        return (
          <div
            key={dropKey}
            onDragOver={(e) => {
              e.preventDefault();
              if (droppable) setDragOverCol((c) => (c === dropKey ? c : dropKey));
            }}
            onDragLeave={(e) => {
              // Не сбрасываем подсветку при наведении на дочерние элементы колонки
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverCol((c) => (c === dropKey ? null : c));
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (droppable) handleDrop(col.key);
            }}
            className={`w-[250px] shrink-0 rounded-2xl border p-2.5 flex flex-col transition-all ${
              isOver && droppable
                ? "border-primary ring-2 ring-primary/30 bg-primary/5 shadow-lg"
                : isOver
                ? "border-[var(--admin-border)] opacity-60"
                : "border-[var(--admin-border)] bg-[var(--admin-bg)]"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col.color }} />
                <span className="text-xs font-bold truncate">{col.title}</span>
              </div>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg shrink-0"
                style={{ background: `${col.color}1a`, color: col.color }}
              >
                {colItems.length}
              </span>
            </div>
            <div className="space-y-2 overflow-y-auto no-scrollbar flex-1 min-h-[90px]">
              {colItems.length === 0 && (
                <div
                  className={`text-[10px] text-center py-4 rounded-xl border border-dashed transition-colors ${
                    droppable
                      ? "border-primary text-primary"
                      : "border-[var(--admin-border)] text-[var(--admin-muted)]"
                  }`}
                >
                  {droppable ? "↓ Перетащите сюда" : "Пусто"}
                </div>
              )}
              {colItems.map((o) => {
                const p = PRIORITY_META[o.priority] ?? PRIORITY_META.MEDIUM;
                const moves = KANBAN_MOVES[o.status] ?? [];
                return (
                  <div
                    key={o.id}
                    draggable
                    onDragStart={(e) => {
                      justDraggedRef.current = false;
                      setDragId(o.id);
                      setDragOverCol(null);
                      e.dataTransfer.setData("text/plain", o.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      justDraggedRef.current = true;
                      clearDrag();
                    }}
                    onClick={() => {
                      if (justDraggedRef.current) {
                        justDraggedRef.current = false;
                        return;
                      }
                      onOpenCard(o.id);
                    }}
                    className={`group rounded-xl border border-[var(--admin-border)] bg-[var(--admin-card)] p-2.5 cursor-grab active:cursor-grabbing select-none transition-all hover:shadow-md hover:-translate-y-0.5 ${
                      dragId === o.id ? "opacity-40 rotate-1" : ""
                    } ${o.escalated ? "ring-1 ring-red-300" : ""}`}
                    title={`${o.orderNumber} · ${o.client} — перетащите в колонку допустимого перехода`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold">{o.orderNumber}</span>
                      <span className="flex items-center gap-1 text-[10px]">
                        {o.escalated && <span title="Эскалирован (Гл. 3.17)">🚨</span>}
                        {o.unreadCount > 0 && <span className="text-primary font-semibold">💬 {o.unreadCount}</span>}
                      </span>
                    </div>
                    <div className="text-xs font-semibold truncate mt-0.5">{o.client}</div>
                    <div className="text-[10px] text-[var(--admin-muted)] truncate">
                      {SERVICE_TYPE_ICONS[o.categoryType] ?? "🧩"} {o.service}
                    </div>
                    <div className="flex items-center justify-between mt-1.5 gap-1">
                      <span className="text-[10px] font-semibold" style={{ color: p.color }}>
                        {p.stars} {fmtMoney(o.amount)} {o.currency}
                      </span>
                      <span className="text-[10px] text-[var(--admin-muted)] truncate max-w-[90px]">{o.manager}</span>
                    </div>
                    {/* Быстрые переходы (Гл. 3.7): альтернатива drag&drop */}
                    {moves.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {moves.map((m) => (
                          <button
                            key={m.action}
                            onClick={(e) => {
                              e.stopPropagation();
                              void onMove(o, m.action);
                            }}
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-lg bg-[var(--admin-bg)] text-[var(--admin-muted)] hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Группировка заказов по менеджеру (Гл. 3.7): каждый менеджер — свой ряд колонок
  const managerGroups = useMemo(() => {
    const m = new Map<string, KanbanOrder[]>();
    for (const o of orders) {
      const key = o.manager || "Без менеджера";
      const arr = m.get(key);
      if (arr) arr.push(o);
      else m.set(key, [o]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "ru"));
  }, [orders]);

  return (
    <div className="px-4 py-4 border-t border-[var(--admin-border)]">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="text-[11px] text-[var(--admin-muted)]">
          🃏 Kanban · перетащите карточку в колонку допустимого перехода или используйте кнопки на
          карточке (Гл. 3.7). Колонки соответствуют этапам жизненного цикла заказа.
        </div>
        {dragOrder && (
          <div className="text-[11px] font-medium text-primary">
            Перемещается: {dragOrder.orderNumber} · {dragOrder.client}
          </div>
        )}
      </div>

      {/* Панель над доской (Гл. 3.7): фильтр по приоритету и группировка по менеджеру */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <select
          value={priority}
          onChange={(e) => onPriorityChange(e.target.value)}
          className="ac-select"
          style={{ width: "auto", height: "2rem" }}
          title="Фильтр по приоритету (общий с панелью фильтров, Гл. 3.9)"
        >
          <option value="">⭐ Все приоритеты</option>
          {Object.entries(PRIORITY_META).map(([v, m]) => (
            <option key={v} value={v}>
              {m.stars} {m.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1 rounded-xl bg-[var(--admin-bg)] p-0.5 border border-[var(--admin-border)]">
          <button
            onClick={() => onGroupByChange("none")}
            className={`px-2.5 h-7 rounded-lg text-[11px] font-medium transition-colors ${
              groupBy === "none" ? "bg-primary text-white" : "text-[var(--admin-muted)] hover:text-primary"
            }`}
            title="Без группировки — одна доска по всем заказам"
          >
            Без групп
          </button>
          <button
            onClick={() => onGroupByChange("manager")}
            className={`px-2.5 h-7 rounded-lg text-[11px] font-medium transition-colors ${
              groupBy === "manager" ? "bg-primary text-white" : "text-[var(--admin-muted)] hover:text-primary"
            }`}
            title="Сгруппировать колонки по менеджеру — у каждого менеджера свой ряд колонок"
          >
            👤 По менеджеру
          </button>
        </div>
        {groupBy === "manager" && (
          <span className="text-[11px] text-[var(--admin-muted)]">
            {managerGroups.length} {ruPlural(managerGroups.length, "менеджер", "менеджера", "менеджеров")} ·{" "}
            {orders.length} {ruPlural(orders.length, "заказ", "заказа", "заказов")}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          {KANBAN_COLUMNS.map((c) => (
            <div key={c.key} className="w-[250px] shrink-0 rounded-2xl bg-[var(--admin-bg)] p-2.5">
              <div className="h-4 w-24 bg-[var(--admin-border)] rounded animate-pulse mb-2" />
              <div className="h-20 bg-[var(--admin-border)]/60 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-xs text-[var(--admin-muted)] py-8 text-center">
          Заказы не найдены. Измените условия фильтрации или нажмите «Сбросить».
        </div>
      ) : groupBy === "manager" ? (
        <div className="space-y-4">
          {managerGroups.map(([mgr, items]) => (
            <div
              key={mgr}
              className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-card)]/40 p-3"
            >
              <div className="flex items-center justify-between gap-2 mb-2.5 px-1">
                <span className="text-xs font-bold truncate">👤 {mgr}</span>
                <span className="text-[11px] text-[var(--admin-muted)] shrink-0">
                  {items.length} {ruPlural(items.length, "заказ", "заказа", "заказов")} ·{" "}
                  {fmtMoney(items.reduce((a, o) => a + o.amount, 0))}
                </span>
              </div>
              {renderColumns(items, `m:${mgr}`)}
            </div>
          ))}
        </div>
      ) : (
        renderColumns(orders, "all")
      )}
    </div>
  );
}

// ── Карточка заказа (Гл. 3.10) ──

interface OrderCardData {
  id: string;
  orderNumber: string;
  version: number;
  client: string;
  clientEmail: string;
  clientPhone: string;
  clientSince: string;
  partner: string;
  provider: string;
  service: string;
  category: string;
  categoryType: string;
  servicesCount: number;
  bookingsCount: number;
  bookingStatus: string;
  paymentStatus: string;
  status: string;
  priority: string;
  currency: string;
  amount: number;
  paidAmount: number;
  commission: number;
  serviceDate: string | null;
  source: string;
  manager: string;
  createdAt: string;
  updatedAt: string;
  // Состав заказа (Baseline §3, OrderItem): канонический состав до/вместо броней.
  items: {
    id: string;
    title: string;
    type: string;
    category: string;
    quantity: number;
    price: number;
    currency: string;
    amount: number;
    serviceDate: string | null;
    serviceId: string;
    direction: string;
    provider: string;
  }[];
  // Туристы заказа (Baseline §4, OrderTraveler) + готовность к бронированию.
  travelers: {
    id: string;
    firstName: string;
    lastName: string;
    birthDate: string | null;
    citizenship: string | null;
    gender: string | null;
    passportNumber: string | null;
    passportExpiry: string | null;
    dataCompleteness: string;
    version: number;
  }[];
  bookingReady: { ready: boolean; reason: string; complete: number; total: number };
  bookings: {
    id: string;
    bookingNumber: string;
    service: string;
    category: string;
    categoryType: string;
    status: string;
    amount: number;
    currency: string;
    serviceDate: string;
    createdAt: string;
    direction: string;
  }[];
  financial: {
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    commission: number;
    expectedPayouts: number;
  };
  // Активные исключения заказа (Гл. 3.17): персистентные эскалации в статусе
  // new/working — карточка показывает бейдж «🚨 Эскалирован».
  activeExceptions?: {
    id: string;
    type: string;
    criticality: string;
    status: string;
    description: string;
    createdAt: string;
  }[];
}

// Вкладки карточки (Гл. 3.10): Общая · Клиент · Услуги · Бронирования ·
// Финансы · Документы · История · AI
const CARD_TABS = [
  { key: "overview", label: "📋 Общая" },
  { key: "client", label: "👤 Клиент" },
  { key: "travelers", label: "👥 Туристы" },
  { key: "services", label: "🧩 Услуги" },
  { key: "bookings", label: "🔖 Бронирования" },
  { key: "finance", label: "💰 Финансы" },
  { key: "docs", label: "📄 Документы" },
  { key: "messages", label: "💬 Комментарии" },
  { key: "history", label: "🕘 История" },
  { key: "ai", label: "🤖 AI" },
];

const ACTION_ICONS: Record<string, string> = {
  created: "📝",
  confirm: "✅",
  pay: "💳",
  complete: "🎉",
  cancel: "✕",
  update: "✏️",
  refund: "↩️",
  archive: "📦",
  // Снятие/возобновление эскалации из реестра исключений (Гл. 3.17)
  escalation_resolved: "✅",
  escalation_closed: "🔓",
  escalation_reopened: "🚨",
};

// Типы документов заказа (Гл. 3.12 — блок «Документы»)
const DOC_TYPES = ["Ваучер", "Договор", "Счёт", "Чек", "Страховой полис"];

function OrderCard({
  orderId,
  tab,
  onTab,
  onDataChanged,
  onLinkException,
  onClose,
}: {
  orderId: string;
  tab: string;
  onTab: (t: string) => void;
  onDataChanged?: () => void;
  // Переход к строке исключения в реестре (Гл. 3.17): закрывает карточку,
  // раскрывает и прокручивает панель «Исключительные ситуации».
  onLinkException?: (orderId: string) => void;
  onClose: () => void;
}) {
  const [order, setOrder] = useState<OrderCardData | null>(null);
  const [history, setHistory] = useState<{ id: string; action: string; from: string | null; to: string | null; fields: Record<string, unknown> | null; actorName: string; comment: string; createdAt: string }[]>([]);
  const [messages, setMessages] = useState<{ id: string; senderName: string; senderRole: string; text: string; isRead: boolean; createdAt: string }[]>([]);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [aiInsights, setAiInsights] = useState<{ level: string; title: string; effect: string }[]>([]);
  // Сформированные в этой сессии документы (Гл. 3.12 «Ручное создание»)
  const [docsGenerated, setDocsGenerated] = useState<string[]>([]);

  // Открытие вкладки «Комментарии» помечает сообщения прочитанными (Гл. 3.14)
  const openMessages = () => {
    onTab("messages");
    if (messagesUnread > 0) {
      fetch(`/api/admin/orders/${orderId}/messages/read`, { method: "POST" })
        .then(() => setMessagesUnread(0))
        .catch(() => {});
    }
  };

  // Скачивание документа (Гл. 3.12 «Предпросмотр»): демо-генерация файла
  const downloadDoc = (name: string) => {
    if (!order) return;
    const blob = new Blob(
      [`${name}\nЗаказ: ${order.orderNumber}\nКлиент: ${order.client}\nСумма: ${fmtMoney(order.amount)} ${order.currency}\n\nTravelHub — сформировано в демо-режиме`],
      { type: "text/plain;charset=utf-8" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name.toLowerCase()}-${order.orderNumber}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      Promise.all([
        fetch(`/api/admin/orders/${orderId}`).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        }),
        fetch(`/api/admin/orders/${orderId}/history`).then((r) => r.json()).catch(() => ({ history: [] })),
        fetch(`/api/admin/orders/${orderId}/messages`).then((r) => r.json()).catch(() => ({ messages: [], unreadCount: 0 })),
      ])
      .then(([o, h, m]) => {
        setOrder(o.order);
        setHistory(h.history ?? []);
        setMessages(m.messages ?? []);
        setMessagesUnread(m.unreadCount ?? 0);
        setEditDate(o.order.serviceDate ? o.order.serviceDate.slice(0, 10) : "");
        setEditAmount(String(o.order.amount));
        // AI-инсайты (Гл. 3.10, вкладка AI)
        const ins: { level: string; title: string; effect: string }[] = [];
        if (o.order.status === "PROBLEM" || o.order.status === "SUSPENDED") {
          ins.push({ level: "high", title: "Проблемный заказ", effect: "Свяжитесь с поставщиком и клиентом, уточните новые сроки" });
        }
        if (o.order.paymentStatus === "pending" && o.order.financial?.pendingAmount > 0) {
          ins.push({
            level: "medium",
            title: "Ожидается оплата",
            effect: `${fmtMoney(o.order.financial.pendingAmount)} к получению · отправьте напоминание клиенту`,
          });
        }
        if (o.order.status === "SENT_TO_BOOKING") {
          ins.push({ level: "medium", title: "Ждём подтверждения поставщика", effect: "Среднее время ответа 4–8 часов · при задержке предложите альтернативу" });
        }
        ins.push(
          { level: "info", title: "Комиссия платформы", effect: `${fmtMoney(o.order.commission)} · ожидаемая выплата ${fmtMoney(o.order.financial?.expectedPayouts ?? 0)}` },
          { level: "info", title: "Менеджер заказа", effect: o.order.manager },
          { level: "info", title: "Источник обращения", effect: o.order.source }
        );
        setAiInsights(ins);
      })
      .catch((e) => setError(errText(e)))
      .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [orderId]);

  // Автопрокрутка чата
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const runAction = async (action: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, version: order?.version }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Ошибка");
      const o = await fetch(`/api/admin/orders/${orderId}`).then((r) => r.json());
      setOrder(o.order);
      setHistory((h) => [{ id: `h-${Date.now()}`, action, from: j.order?.from, to: j.order?.status, fields: null, actorName: "Вы", comment: j.message, createdAt: new Date().toISOString() }, ...h]);
      setMessages((m) => [...m, { id: `m-${Date.now()}`, senderName: "Система", senderRole: "system", text: j.message, isRead: true, createdAt: new Date().toISOString() }]);
    } catch (e) {
      alert(errText(e));
    }
  };

  // Автоматизация исполнения (Гл. 3.16 «Контроль SLA»): действия из бейджа SLA
  // и виджетов «Контроль исполнения» — повышение приоритета, эскалация,
  // уведомление руководителя. Каждое действие пишется в журнал автоматизации
  // (клиентский журнал + история заказа + системное сообщение в переписке).
  const runSlaAction = async (action: "raise_priority" | "escalate" | "notify_manager") => {
    if (!order) return;
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const j = await res.json();
    if (!res.ok) {
      alert(j.error || "Ошибка");
      return;
    }
    const o = await fetch(`/api/admin/orders/${orderId}`).then((r) => r.json());
    setOrder(o.order);
    setHistory((h) => [{ id: `h-${Date.now()}`, action, from: order.status, to: order.status, fields: null, actorName: "Вы", comment: j.message, createdAt: new Date().toISOString() }, ...h]);
    setMessages((m) => [...m, { id: `m-${Date.now()}`, senderName: "Система", senderRole: "system", text: j.message, isRead: true, createdAt: new Date().toISOString() }]);
    // Журнал автоматизации и реестр исключений персистентны (AutomationLog/
    // ExceptionLog): перезапрашиваем список, чтобы новые записи появились
    // на странице и пережили перезагрузку.
    onDataChanged?.();
  };

  // Снятие эскалации из шапки карточки (Гл. 3.17): активное исключение заказа
  // помечается решённым — PATCH /api/admin/exceptions/[id] пишет историю заказа,
  // журнал автоматизации и системное сообщение. Бейдж исчезает после обновления.
  const clearEscalation = async (excId: string) => {
    const res = await fetch(`/api/admin/exceptions/${excId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve" }),
    });
    const j = await res.json();
    if (!res.ok) {
      alert(j.error || "Ошибка снятия эскалации");
      return;
    }
    const o = await fetch(`/api/admin/orders/${orderId}`).then((r) => r.json());
    setOrder(o.order);
    setHistory((h) => [
      { id: `h-${Date.now()}`, action: "escalation_resolved", from: null, to: null, fields: null, actorName: "Вы", comment: j.message || "Эскалация снята", createdAt: new Date().toISOString() },
      ...h,
    ]);
    onDataChanged?.();
  };

  const saveEdit = async () => {
    if (!editDate && !(editAmount && parseFloat(editAmount) > 0)) {
      alert("Укажите новую дату или сумму");
      return;
    }
    const body: Record<string, unknown> = { action: "update" };
    if (editDate) body.serviceDate = editDate;
    if (editAmount && parseFloat(editAmount) > 0) body.amount = parseFloat(editAmount);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Ошибка");
      setEditing(false);
      const o = await fetch(`/api/admin/orders/${orderId}`).then((r) => r.json());
      setOrder(o.order);
      setHistory((h) => [{ id: `h-${Date.now()}`, action: "update", from: j.order?.from, to: j.order?.status, fields: null, actorName: "Вы", comment: "Изменены дата/сумма", createdAt: new Date().toISOString() }, ...h]);
    } catch (e) {
      alert(errText(e));
    }
  };

  const sendMessage = async () => {
    if (!msgText.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msgText }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Ошибка");
      setMessages((m) => [...m, j.item]);
      setMsgText("");
    } catch (e) {
      alert(errText(e));
    } finally {
      setSending(false);
    }
  };

  if (!order && loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-8 w-full max-w-lg">
          <div className="h-6 bg-[var(--admin-bg)] rounded-xl animate-pulse mb-3" />
          <div className="h-4 bg-[var(--admin-bg)] rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-8 w-full max-w-lg text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <div className="text-sm text-[var(--admin-muted)]">{error || "Заказ не найден"}</div>
          <button onClick={onClose} className="ac-btn ac-btn-primary mt-4">Закрыть</button>
        </div>
      </div>
    );
  }

  const p = PRIORITY_META[order.priority] ?? PRIORITY_META.MEDIUM;
  const stage = STAGE_OF[order.status] ?? 0;
  const actions = ACTIONS_BY_STATUS[order.status] ?? [];
  const isClosed = ["CLOSED", "CANCELLED"].includes(order.status);
  const docsReady = ["FULFILLED", "READY_TO_CLOSE", "CLOSED"].includes(order.status);
  // Действия, требующие готовности туристов (Baseline §4): confirm (→ Готов к
  // бронированию) и send (→ Передать в Booking Center) блокируются с причиной,
  // пока не заполнены паспортные данные (Screen Design Brief §25).
  const isActionBlocked = (a: string): boolean =>
    (a === "confirm" || a === "send") && !!order.bookingReady && !order.bookingReady.ready;
  // Перезагрузка карточки после изменения туристов.
  const reloadOrder = async () => {
    const r = await fetch(`/api/admin/orders/${orderId}`);
    if (r.ok) setOrder((await r.json()).order);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto no-scrollbar">
      <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl w-full max-w-4xl my-6">
        {/* Хлебные крошки (3.5): Главная → Продажи и исполнение → Заказ №… */}
        <nav className="px-5 pt-3 text-[11px] text-[var(--admin-muted)] flex items-center gap-1.5 flex-wrap">
          <span>Главная</span>
          <span>›</span>
          <button onClick={onClose} className="hover:text-primary transition-colors">Продажи и исполнение</button>
          <span>›</span>
          <span className="text-[var(--admin-text)] font-medium">{order.orderNumber}</span>
        </nav>

        {/* Заголовок карточки (3.10): № заказа · статус · приоритет · действия */}
        <div className="px-5 py-4 border-b border-[var(--admin-border)] flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold">{order.orderNumber}</h3>
              <span
                className="px-2 py-0.5 rounded-lg text-[11px] font-semibold"
                style={{ background: `${ORDER_STATUS_COLORS[order.status]}1a`, color: ORDER_STATUS_COLORS[order.status] }}
              >
                {ORDER_STATUS_LABELS[order.status] ?? order.status}
              </span>
              <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold" style={{ background: `${p.color}1a`, color: p.color }}>
                {p.stars} {p.label}
              </span>
              {/* Сводный индикатор SLA по заказу (Гл. 3.4) */}
              <SlaHeaderBadge order={order} onRunSlaAction={runSlaAction} />
              {/* Бейдж эскалации (Гл. 3.17): активное исключение по заказу */}
              {order.activeExceptions && order.activeExceptions.length > 0 && (
                <EscalationBadge
                  count={order.activeExceptions.length}
                  onLink={() => onLinkException?.(order.id)}
                  onClear={() => clearEscalation(order.activeExceptions![0].id)}
                />
              )}
            </div>
            <div className="text-xs text-[var(--admin-muted)] mt-1">
              {SERVICE_TYPE_ICONS[order.categoryType] ?? "🧩"} {order.service} · {order.source}
            </div>
            <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">
              Создан {fmtDateTime(order.createdAt)} · Ответственный: {order.manager}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {editing ? (
              <>
                <button onClick={saveEdit} className="ac-btn ac-btn-sm bg-emerald-500 text-white hover:bg-emerald-600">Сохранить</button>
                <button onClick={() => setEditing(false)} className="ac-btn ac-btn-secondary ac-btn-sm">Отмена</button>
              </>
            ) : (
              <>
                {actions.map((a) => (
                  <button
                    key={a.action}
                    onClick={() => !isActionBlocked(a.action) && runAction(a.action)}
                    disabled={isActionBlocked(a.action)}
                    title={isActionBlocked(a.action) ? (order.bookingReady?.reason ?? "Данные туристов не заполнены") : undefined}
                    className={`ac-btn ac-btn-sm bg-[var(--admin-bg)] border border-[var(--admin-border)] hover:border-primary ${a.cls} ${
                      isActionBlocked(a.action) ? "opacity-45 cursor-not-allowed" : ""
                    }`}
                  >
                    {a.label}
                    {isActionBlocked(a.action) && <span className="ml-1 text-[10px]">🔒</span>}
                  </button>
                ))}
                <button onClick={() => onTab("docs")} className="ac-btn ac-btn-secondary ac-btn-sm">📄 Документы</button>
                <button onClick={openMessages} className="ac-btn ac-btn-secondary ac-btn-sm">📧 Отправить клиенту</button>
                <button onClick={() => setEditing(true)} className="ac-btn ac-btn-primary ac-btn-sm">✏️ Редактировать</button>
                {["FULFILLED", "READY_TO_CLOSE"].includes(order.status) && (
                  <button onClick={() => runAction("refund")} className="ac-btn ac-btn-danger ac-btn-sm">
                    ↩️ Возврат
                  </button>
                )}
                {!isClosed && (
                  <button onClick={() => runAction("cancel")} className="ac-btn ac-btn-danger ac-btn-sm">
                    ✕
                  </button>
                )}
              </>
            )}
            <button onClick={onClose} className="ac-btn ac-btn-ghost ac-btn-sm ac-btn-icon">✕</button>
          </div>
        </div>

        {/* Таймлайн жизненного цикла (3.10): Создан → Проверка → Подтверждение → Оплата → Документы → Исполнен */}
        <div className="px-5 py-3 border-b border-[var(--admin-border)]">
          <div className="flex items-center">
            {LIFECYCLE.map((s, i) => {
              const done = i < stage;
              const current = i === stage;
              const failed = (order.status === "PROBLEM" || order.status === "SUSPENDED") && i >= stage;
              return (
                <div key={s.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border-2 transition-colors ${
                        done
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : current
                          ? "bg-primary border-primary text-white"
                          : failed
                          ? "bg-red-500 border-red-500 text-white"
                          : "bg-[var(--admin-bg)] border-[var(--admin-border)] text-[var(--admin-muted)]"
                      }`}
                    >
                      {done ? "✓" : current ? "●" : failed ? "!" : ""}
                    </div>
                    <span className={`text-[10px] whitespace-nowrap ${current ? "font-semibold text-primary" : "text-[var(--admin-muted)]"}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < LIFECYCLE.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 mb-4 rounded-full ${i < stage ? "bg-emerald-500" : "bg-[var(--admin-border)]"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Вкладки (3.10): Общая · Клиент · Услуги · Бронирования · Финансы ·
            Документы · Комментарии · История · AI */}
        <div className="px-5 pt-3 ac-tabs overflow-x-auto no-scrollbar max-w-full">
          {CARD_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => (t.key === "messages" ? openMessages() : onTab(t.key))}
              className={`ac-tab shrink-0 ${tab === t.key ? "ac-tab-active" : ""}`}
            >
              {t.label}
              {t.key === "messages" && messagesUnread > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold ml-0.5">
                  {messagesUnread}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Рабочая область вкладки */}
        <div className="px-5 py-4 min-h-[280px] max-h-[55vh] overflow-y-auto no-scrollbar">
          {tab === "overview" && <OverviewTab order={order} onEdit={() => setEditing(true)} onTab={onTab} onRunSlaAction={runSlaAction} />}
          {tab === "client" && <ClientTab order={order} onRunSlaAction={runSlaAction} />}
          {tab === "travelers" && <TravelersTab order={order} onChanged={reloadOrder} />}
          {tab === "services" && <ServicesTab order={order} onRunSlaAction={runSlaAction} />}
          {tab === "bookings" && <BookingsTab order={order} />}
          {tab === "finance" && <FinanceTab order={order} onRunSlaAction={runSlaAction} />}
          {tab === "docs" && (
            <div className="space-y-3">
              {/* Сводная информация (3.12) */}
              {(() => {
                const ready = order.status === "FULFILLED" || order.status === "READY_TO_CLOSE" || order.status === "CLOSED";
                const list = DOC_TYPES.map((d) => {
                  const generated = docsGenerated.includes(d);
                  const isReady = generated || ready;
                  return {
                    name: d,
                    status: !docsReady ? "Ожидает оплаты" : isReady ? "Готов" : "Формируется",
                    version: isReady ? "v1" : "—",
                    author: generated ? "Вы" : ready ? "Система" : "—",
                    generated: isReady,
                  };
                });
                const readyCount = list.filter((d) => d.status === "Готов").length;
                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Всего документов", value: DOC_TYPES.length, color: "text-[var(--admin-text)]" },
                        { label: "Готово", value: readyCount, color: "text-emerald-600" },
                        { label: "Формируется", value: docsReady ? DOC_TYPES.length - readyCount : DOC_TYPES.length, color: "text-amber-600" },
                        { label: "Ошибки генерации", value: 0, color: "text-[var(--admin-muted)]" },
                      ].map((s) => (
                        <div key={s.label} className="bg-[var(--admin-bg)] rounded-xl p-3 text-center">
                          <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                          <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    {/* Реестр документов (3.12) */}
                    <table className="ac-table">
                      <thead>
                        <tr>
                          <th className="ac-th">Документ</th>
                          <th className="ac-th">Статус</th>
                          <th className="ac-th">Версия</th>
                          <th className="ac-th">Автор</th>
                          <th className="ac-th">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((d) => (
                          <tr key={d.name} className="ac-tr">
                            <td className="ac-td">
                              <span className="text-xs font-semibold flex items-center gap-2">
                                <span>📄</span> {d.name}
                              </span>
                            </td>
                            <td className="ac-td">
                              <span
                                className="inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold"
                                style={{
                                  background:
                                    d.status === "Готов"
                                      ? "#22c55e1a"
                                      : d.status === "Формируется"
                                      ? "#f59e0b1a"
                                      : "var(--admin-bg)",
                                  color:
                                    d.status === "Готов"
                                      ? "#16a34a"
                                      : d.status === "Формируется"
                                      ? "#d97706"
                                      : "var(--admin-muted)",
                                }}
                              >
                                {d.status}
                              </span>
                            </td>
                            <td className="ac-td text-[var(--admin-muted)]">{d.version}</td>
                            <td className="ac-td text-[var(--admin-muted)]">{d.author}</td>
                            <td className="ac-td">
                              <div className="flex items-center gap-1.5">
                                {!d.generated && docsReady && (
                                  <button
                                    onClick={() => setDocsGenerated((p) => [...p, d.name])}
                                    className="ac-btn ac-btn-secondary ac-btn-sm"
                                  >
                                    ⚙️ Сформировать
                                  </button>
                                )}
                                <button
                                  disabled={!d.generated}
                                  onClick={() => downloadDoc(d.name)}
                                  className="ac-btn ac-btn-secondary ac-btn-sm"
                                >
                                  ⬇ Скачать
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="text-[11px] text-[var(--admin-muted)]">
                      Генерация выполняется по шаблонам (3.12): после оплаты — ваучер, авиабилеты, страховой полис, маршрут; версии и история фиксируются в журнале.
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          {tab === "history" && (
            <div className="space-y-2">
              {history.length === 0 && (
                <div className="text-center text-sm text-[var(--admin-muted)] py-10">История изменений пуста</div>
              )}
              {history.map((h) => (
                <div key={h.id} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--admin-bg)]">
                  <div className="text-base leading-none mt-0.5">{ACTION_ICONS[h.action] ?? "📝"}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold">{h.comment || h.action}</div>
                    <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">
                      {h.actorName} · {fmtDateTime(h.createdAt)}
                      {h.from && h.to && h.from !== h.to && (
                        <span> · {ORDER_STATUS_LABELS[h.from] ?? h.from} → {ORDER_STATUS_LABELS[h.to] ?? h.to}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab === "ai" && (
            <div className="space-y-2">
              {aiInsights.map((ins) => (
                <div
                  key={ins.title}
                  className={`p-3 rounded-xl border ${
                    ins.level === "high" ? "bg-red-50 border-red-200" : ins.level === "medium" ? "bg-amber-50 border-amber-200" : "bg-[var(--admin-bg)] border-[var(--admin-border)]"
                  }`}
                >
                  <div className={`text-xs font-semibold ${ins.level === "high" ? "text-red-700" : ins.level === "medium" ? "text-amber-700" : "text-[var(--admin-text)]"}`}>
                    {ins.title}
                  </div>
                  <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">{ins.effect}</div>
                </div>
              ))}
            </div>
          )}
          {tab === "messages" && (
            <div className="flex flex-col h-[380px]">
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1">
                {messages.length === 0 && (
                  <div className="text-center text-sm text-[var(--admin-muted)] py-10">
                    Переписка пуста. Начните общение с клиентом.
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.senderRole === "client" ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${
                        m.senderRole === "client"
                          ? "bg-[var(--admin-bg)] border border-[var(--admin-border)]"
                          : m.senderRole === "system"
                          ? "bg-secondary/10 text-[var(--admin-muted)] italic"
                          : "bg-primary text-white"
                      }`}
                    >
                      <div className="text-[10px] opacity-70 mb-0.5">
                        {m.senderName} · {fmtDateTime(m.createdAt)}
                      </div>
                      {m.text}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex gap-2 mt-3">
                <input
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Сообщение клиенту…"
                  className="flex-1 h-10 px-3 rounded-xl text-sm bg-[var(--admin-bg)] border border-[var(--admin-border)] focus:border-primary focus:outline-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !msgText.trim()}
                  className="px-4 h-10 rounded-xl text-sm font-semibold bg-primary text-white disabled:opacity-40"
                >
                  Отправить
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Вкладки карточки ──

/**
 * Расчёт SLA-данных заказа (Гл. 3.4): этапы жизненного цикла с временем начала,
 * допустимым/затраченным/оставшимся временем и статусом SLA. Переиспользуется
 * в полном блоке «Контроль исполнения», в бейдже шапки карточки и в компактном
 * виджете на вкладках.
 */
function buildSlaData(order: OrderCardData) {
  const stage = STAGE_OF[order.status] ?? 0;
  const createdAtMs = new Date(order.createdAt).getTime();
  const now = Date.now();
  const isClosed = ["CLOSED", "CANCELLED"].includes(order.status);
  const isOverdue = order.status === "PROBLEM" || order.status === "SUSPENDED";

  const fmtH = (ms: number) => {
    const h = ms / 3600000;
    return h < 1 ? `${Math.round(h * 60)} мин` : h < 48 ? `${Math.round(h)} ч` : `${(h / 24).toFixed(1)} дн`;
  };

  // Статус SLA этапа (Гл. 3.4): зелёный — в норме, жёлтый — риск, красный — нарушен
  const slaStatus = (remaining: number): { label: string; cls: string } => {
    if (remaining < 0) return { label: "Нарушен", cls: "bg-red-50 text-red-600" };
    if (remaining < 3600000 * 6) return { label: "Риск", cls: "bg-amber-50 text-amber-600" };
    return { label: "В норме", cls: "bg-emerald-500/10 text-emerald-600" };
  };

  const rows = LIFECYCLE.map((s, i) => {
    const start = stageStartAt(order.id, createdAtMs, i);
    const startMs = start.getTime();
    const allowed = STAGE_SLA_HOURS[s.key] * 3600000;
    const done = i < stage;
    const current = i === stage;
    const failed = isOverdue && i >= stage;

    let remaining = 0;
    let elapsed = 0;
    if (done) {
      // Завершённый этап: время начала следующего этапа − начало текущего
      const nextStart = stageStartAt(order.id, createdAtMs, i + 1).getTime();
      elapsed = Math.max(0, nextStart - startMs);
      remaining = allowed - elapsed;
    } else if (current && !isClosed) {
      elapsed = Math.max(0, now - startMs);
      remaining = allowed - elapsed;
    } else if (current && isClosed && !failed) {
      // Закрыт на текущем этапе: время в этапе по updatedAt
      elapsed = Math.max(0, new Date(order.updatedAt).getTime() - startMs);
      remaining = allowed - elapsed;
    } else if (failed) {
      remaining = -1;
    }

    return { s, start, done, current, failed, elapsed, remaining, allowed };
  });

  const currentRow = rows.find((r) => r.current);
  // Закрытый заказ: жизненный цикл завершён — SLA больше не оценивается (Гл. 3.4)
  const currentStageSla = isClosed
    ? { label: "Завершён", cls: "bg-emerald-500/10 text-emerald-600" }
    : currentRow
    ? slaStatus(currentRow.remaining)
    : { label: "—", cls: "bg-[var(--admin-bg)] text-[var(--admin-muted)]" };

  return { stage, isClosed, isOverdue, fmtH, slaStatus, rows, currentRow, currentStageSla };
}

/**
 * Строка реестра исключений (Гл. 3.17): тип, категория, критичность, заказ,
 * ответственный, время, статус, описание и AI-рекомендация. Переиспользуется
 * для серверных исключений и клиентских эскалаций (выделяются подсветкой).
 */
function ExceptionRow({
  e,
  highlight,
  highlightOrder,
  onStatusChange,
}: {
  e: {
    id: string;
    type: string;
    category: string;
    criticality: string;
    orderNumber: string;
    manager: string;
    createdAt: string;
    updatedAt?: string;
    status: string;
    description: string;
    aiSuggestion: string;
    history?: {
      id: string;
      action: string;
      from: string | null;
      to: string | null;
      comment: string | null;
      actorName: string;
      createdAt: string;
    }[];
    orderId?: string;
  };
  highlight: string;
  highlightOrder?: string | null;
  onStatusChange?: (id: string, action: "take" | "resolve" | "close") => void;
}) {
  const crit = e.criticality as "low" | "medium" | "high" | "critical";
  const st = e.status as "new" | "working" | "resolved" | "closed";
  // Персистентное исключение (из БД) имеет updatedAt — для него доступно
  // управление статусом и история обработки (Гл. 3.17). Демо-строки статичны.
  const isPersistent = e.updatedAt !== undefined;
  const [showHistory, setShowHistory] = useState(false);
  const history = e.history ?? [];
  // Подсветка строки после перехода из карточки заказа (Гл. 3.17)
  const isOrderHighlight = Boolean(highlightOrder && e.orderId && e.orderId === highlightOrder);
  const rowBg = isOrderHighlight ? "bg-primary/10" : highlight;
  const actions: { action: "take" | "resolve" | "close"; label: string; cls: string }[] = [];
  if (st === "new" || st === "working") {
    if (st === "new") actions.push({ action: "take", label: "Взять в работу", cls: "ac-btn-secondary" });
    actions.push({ action: "resolve", label: "Решено", cls: "ac-btn-secondary" });
    actions.push({ action: "close", label: "Закрыть", cls: "ac-btn-danger" });
  } else if (st === "resolved") {
    actions.push({ action: "take", label: "↺ В работу", cls: "ac-btn-secondary" });
    actions.push({ action: "close", label: "Закрыть", cls: "ac-btn-danger" });
  } else if (st === "closed") {
    actions.push({ action: "take", label: "↺ Открыть", cls: "ac-btn-secondary" });
  }
  return (
    <>
      <tr className={`ac-tr ${rowBg}`}>
        <td className="ac-td font-semibold whitespace-nowrap">
          {e.type}
          {isOrderHighlight && <span className="text-[9px] text-primary font-bold ml-1">📍</span>}
        </td>
        <td className="ac-td text-[var(--admin-muted)]">{e.category}</td>
        <td className="ac-td">
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold"
            style={{ background: `${CRITICALITY_COLORS[crit]}1a`, color: CRITICALITY_COLORS[crit] }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: CRITICALITY_COLORS[crit] }} />
            {CRITICALITY_LABELS[crit]}
          </span>
        </td>
        <td className="ac-td text-primary">{e.orderNumber}</td>
        <td className="ac-td text-[var(--admin-muted)]">{e.manager}</td>
        <td className="ac-td text-[var(--admin-muted)] whitespace-nowrap">{fmtDateTime(e.createdAt)}</td>
        <td className="ac-td">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="px-2 py-0.5 rounded-lg text-[11px] font-semibold"
              style={{ background: `${EXCEPTION_STATUS_COLORS[st]}1a`, color: EXCEPTION_STATUS_COLORS[st] }}
            >
              {EXCEPTION_STATUS_LABELS[st]}
            </span>
            {isPersistent && history.length > 0 && (
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="text-[10px] text-[var(--admin-muted)] hover:text-primary transition-colors"
                title="История обработки"
              >
                🕘 {history.length} {showHistory ? "▾" : "▸"}
              </button>
            )}
          </div>
        </td>
        <td className="ac-td max-w-[280px]">
          <div className="text-[11px] text-[var(--admin-muted)] leading-snug">{e.description}</div>
        </td>
        <td className="ac-td max-w-[260px]">
          <div className="text-[11px] text-violet-600 leading-snug">🤖 {e.aiSuggestion}</div>
        </td>
        <td className="ac-td whitespace-nowrap">
          {isPersistent && onStatusChange && (
            <div className="flex items-center gap-1">
              {actions.map((a) => (
                <button
                  key={a.action}
                  onClick={() => onStatusChange(e.id, a.action)}
                  className={`ac-btn ac-btn-sm ${a.cls}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </td>
      </tr>
      {showHistory && isPersistent && (
        <tr className="ac-tr">
          <td colSpan={10} className="ac-td bg-[var(--admin-bg)]/50">
            <div className="text-[11px] text-[var(--admin-muted)] mb-1.5">
              🕘 История обработки исключения (Гл. 3.17):
            </div>
            {history.length === 0 ? (
              <div className="text-[11px] text-[var(--admin-muted)]">Записей пока нет</div>
            ) : (
              <div className="space-y-1">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 text-[11px] flex-wrap">
                    <span className="text-[var(--admin-muted)] whitespace-nowrap">{fmtDateTime(h.createdAt)}</span>
                    <span className="font-semibold whitespace-nowrap">{h.actorName}</span>
                    <span className="text-[var(--admin-muted)]">
                      {EXCEPTION_STATUS_LABELS[h.from as "new" | "working" | "resolved" | "closed"] ?? h.from} →{" "}
                      {EXCEPTION_STATUS_LABELS[h.to as "new" | "working" | "resolved" | "closed"] ?? h.to}
                    </span>
                    <span className="text-[var(--admin-muted)]">· {h.comment ?? h.action}</span>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Компактный виджет «Контроль исполнения» (Гл. 3.4): исполнитель, подразделение,
 * текущий этап с оставшимся временем по SLA и мини-прогресс этапов жизненного
 * цикла. Используется на вкладках «Клиент», «Услуги», «Финансы».
 */
function SlaMiniWidget({
  order,
  onRunSlaAction,
}: {
  order: OrderCardData;
  onRunSlaAction?: (action: "raise_priority" | "escalate" | "notify_manager") => void;
}) {
  const sla = buildSlaData(order);
  const { currentRow, currentStageSla, fmtH, rows, stage, isClosed } = sla;
  const remaining = currentRow && !isClosed ? currentRow.remaining : null;
  const slaNeedsAction = !isClosed && (currentStageSla.label === "Риск" || currentStageSla.label === "Нарушен");
  const canRaise = order.priority !== "URGENT";
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] p-3.5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-[11px] font-semibold text-[var(--admin-muted)] uppercase">Контроль исполнения</h4>
        <span className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold ${currentStageSla.cls}`}>
          SLA: {currentStageSla.label}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-[var(--admin-bg)] rounded-xl p-2.5">
          <div className="text-[10px] uppercase text-[var(--admin-muted)]">Исполнитель</div>
          <div className="text-xs font-semibold mt-0.5 truncate">👤 {order.manager}</div>
        </div>
        <div className="bg-[var(--admin-bg)] rounded-xl p-2.5">
          <div className="text-[10px] uppercase text-[var(--admin-muted)]">Подразделение</div>
          <div className="text-xs font-semibold mt-0.5 truncate">🏢 {departmentOf(order.manager)}</div>
        </div>
        <div className="bg-[var(--admin-bg)] rounded-xl p-2.5">
          <div className="text-[10px] uppercase text-[var(--admin-muted)]">Текущий этап</div>
          <div className="text-xs font-semibold mt-0.5">
            {LIFECYCLE[stage]?.label ?? "—"}
            {currentRow && !isClosed && (
              <span className="text-[10px] text-[var(--admin-muted)] font-normal block">
                начат {fmtDateTime(currentRow.start.toISOString())}
              </span>
            )}
          </div>
        </div>
        <div className="bg-[var(--admin-bg)] rounded-xl p-2.5">
          <div className="text-[10px] uppercase text-[var(--admin-muted)]">Осталось по SLA</div>
          <div className="text-xs font-semibold mt-0.5">
            {remaining !== null ? (
              <span style={remaining < 0 ? { color: "#dc2626" } : { color: "#16a34a" }}>{fmtH(remaining)}</span>
            ) : (
              <span className="text-[var(--admin-muted)] font-normal">—</span>
            )}
          </div>
        </div>
      </div>
      {/* Мини-прогресс этапов жизненного цикла (Гл. 3.4) */}
      <div className="flex items-center gap-1">
        {rows.map((r, i) => {
          const st = r.failed
            ? "bg-red-500"
            : r.done
            ? "bg-emerald-500"
            : r.current && !isClosed
            ? "bg-amber-500"
            : "bg-[var(--admin-border)]";
          return (
            <div key={r.s.key} className="flex-1 flex flex-col items-center gap-1 group">
              <div
                className={`h-1.5 w-full rounded-full ${st}`}
                title={`${r.s.label}${r.current && !isClosed ? ` · осталось ${fmtH(r.remaining)}` : ""}`}
              />
              <span
                className={`text-[9px] leading-none ${r.current && !isClosed ? "font-bold" : "text-[var(--admin-muted)]"} ${
                  r.failed ? "text-red-500" : ""
                }`}
              >
                {i === stage ? (isClosed ? "🏁" : "●") : r.done ? "✓" : r.failed ? "⛔" : ""}
              </span>
            </div>
          );
        })}
      </div>
      {slaNeedsAction && (
        <div className="flex items-center gap-2 flex-wrap">
          {canRaise && (
            <button onClick={() => onRunSlaAction?.("raise_priority")} className="ac-btn ac-btn-secondary ac-btn-sm">
              ⬆️ Повысить приоритет
            </button>
          )}
          <button onClick={() => onRunSlaAction?.("escalate")} className="ac-btn ac-btn-danger ac-btn-sm">
            🚨 Эскалировать
          </button>
          <button onClick={() => onRunSlaAction?.("notify_manager")} className="ac-btn ac-btn-secondary ac-btn-sm">
            🔔 Уведомить руководителя
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Сводный индикатор SLA в шапке карточки заказа (Гл. 3.4): цветной бейдж со
 * статусом SLA текущего этапа и оставшимся временем.
 */
function SlaHeaderBadge({
  order,
  onRunSlaAction,
}: {
  order: OrderCardData;
  onRunSlaAction?: (action: "raise_priority" | "escalate" | "notify_manager") => void;
}) {
  const sla = buildSlaData(order);
  const { currentRow, currentStageSla, fmtH, isClosed } = sla;
  const remaining = currentRow && !isClosed ? currentRow.remaining : null;
  const slaNeedsAction = !isClosed && (currentStageSla.label === "Риск" || currentStageSla.label === "Нарушен");
  const canRaise = order.priority !== "URGENT";
  const dot =
    currentStageSla.label === "Завершён" || currentStageSla.label === "В норме"
      ? "bg-emerald-500"
      : currentStageSla.label === "Риск"
      ? "bg-amber-500"
      : currentStageSla.label === "Нарушен"
      ? "bg-red-500"
      : "bg-[var(--admin-border)]";
  return (
    <span
      className={`relative px-2 py-0.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 ${currentStageSla.cls}`}
      title={
        remaining !== null
          ? `SLA: ${currentStageSla.label} · осталось ${fmtH(remaining)}`
          : `SLA: ${currentStageSla.label}`
      }
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {currentStageSla.label}
      {remaining !== null && <span className="opacity-70">· {fmtH(remaining)}</span>}
      {slaNeedsAction && (
        <span className="group inline-flex items-center">
          <span className="ml-1 opacity-70 cursor-help" title="Требует действия (Гл. 3.16 «Контроль SLA»)">⚡</span>
          {/* pt-1 — hover-мост: часть контейнера, попадая под курсор, не
              разрывает group-hover (иначе меню исчезает на зазоре mt-1) */}
          <span className="absolute right-0 top-full z-30 pt-1 hidden group-hover:flex">
            <span className="flex flex-col gap-1 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-xl p-1.5 shadow-xl min-w-[190px]">
              {canRaise && (
                <button onClick={() => onRunSlaAction?.("raise_priority")} className="ac-btn ac-btn-secondary ac-btn-sm justify-start">
                  ⬆️ Повысить приоритет
                </button>
              )}
              <button onClick={() => onRunSlaAction?.("escalate")} className="ac-btn ac-btn-danger ac-btn-sm justify-start">
                🚨 Эскалировать
              </button>
              <button onClick={() => onRunSlaAction?.("notify_manager")} className="ac-btn ac-btn-secondary ac-btn-sm justify-start">
                🔔 Уведомить руководителя
              </button>
            </span>
          </span>
        </span>
      )}
    </span>
  );
}

/**
 * Бейдж «🚨 Эскалирован» в шапке карточки заказа (Гл. 3.17): показывается,
 * когда у заказа есть активное исключение (статус new/working). При наведении
 * раскрывает меню: «Снять эскалацию» (пометка решённым через PATCH реестра
 * исключений) и «Открыть в реестре исключений» (закрывает карточку и
 * прокручивает панель исключений к строке заказа).
 */
function EscalationBadge({
  count,
  onLink,
  onClear,
}: {
  count: number;
  onLink: () => void;
  onClear: () => void;
}) {
  return (
    <span className="group relative inline-flex items-center">
      <span
        className="px-2 py-0.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 bg-red-500/10 text-red-600 cursor-pointer"
        title={`Заказ эскалирован${count > 1 ? `: ${count} активных исключений` : ""} (Гл. 3.17)`}
      >
        🚨 Эскалирован
        {count > 1 && <span className="opacity-70">×{count}</span>}
        <span className="opacity-70 text-[9px]">▾</span>
      </span>
      {/* pt-1 — hover-мост: часть контейнера, попадая под курсор, не
          разрывает group-hover (иначе меню исчезает на зазоре) */}
      <span className="absolute right-0 top-full z-30 pt-1 hidden group-hover:flex">
        <span className="flex flex-col gap-1 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-xl p-1.5 shadow-xl min-w-[230px]">
          <button onClick={onClear} className="ac-btn ac-btn-primary ac-btn-sm justify-start">
            ✅ Снять эскалацию
          </button>
          <button onClick={onLink} className="ac-btn ac-btn-secondary ac-btn-sm justify-start">
            📍 Открыть в реестре исключений
          </button>
        </span>
      </span>
    </span>
  );
}

/**
 * Контроль исполнения (Гл. 3.4): текущий исполнитель, подразделение, время
 * начала этапа, допустимое/оставшееся время и статус SLA по каждому этапу
 * жизненного цикла заказа.
 */
function ExecutionControl({
  order,
  onRunSlaAction,
}: {
  order: OrderCardData;
  onRunSlaAction?: (action: "raise_priority" | "escalate" | "notify_manager") => void;
}) {
  const sla = buildSlaData(order);
  const { stage, isClosed, fmtH, slaStatus, rows, currentRow, currentStageSla } = sla;
  const slaNeedsAction = !isClosed && (currentStageSla.label === "Риск" || currentStageSla.label === "Нарушен");
  const canRaise = order.priority !== "URGENT";
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] p-3.5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-[11px] font-semibold text-[var(--admin-muted)] uppercase">Контроль исполнения</h4>
        <span className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold ${currentStageSla.cls}`}>
          SLA: {currentStageSla.label}
        </span>
      </div>

      {/* Текущий исполнитель + подразделение (3.4) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-[var(--admin-bg)] rounded-xl p-2.5">
          <div className="text-[10px] uppercase text-[var(--admin-muted)]">Исполнитель</div>
          <div className="text-xs font-semibold mt-0.5">👤 {order.manager}</div>
        </div>
        <div className="bg-[var(--admin-bg)] rounded-xl p-2.5">
          <div className="text-[10px] uppercase text-[var(--admin-muted)]">Подразделение</div>
          <div className="text-xs font-semibold mt-0.5">🏢 {departmentOf(order.manager)}</div>
        </div>
        <div className="bg-[var(--admin-bg)] rounded-xl p-2.5">
          <div className="text-[10px] uppercase text-[var(--admin-muted)]">Текущий этап</div>
          <div className="text-xs font-semibold mt-0.5">
            {LIFECYCLE[stage]?.label ?? "—"}
            {currentRow && !isClosed && (
              <span className="text-[10px] text-[var(--admin-muted)] font-normal block">
                начат {fmtDateTime(currentRow.start.toISOString())}
              </span>
            )}
          </div>
        </div>
        <div className="bg-[var(--admin-bg)] rounded-xl p-2.5">
          <div className="text-[10px] uppercase text-[var(--admin-muted)]">Осталось по SLA</div>
          <div className="text-xs font-semibold mt-0.5" style={{ color: currentRow && currentRow.remaining < 0 ? "#dc2626" : "#16a34a" }}>
            {currentRow && !isClosed ? fmtH(currentRow.remaining) : "—"}
          </div>
        </div>
      </div>

      {/* Таблица SLA по этапам жизненного цикла (3.4) */}
      <div className="overflow-x-auto">
        <table className="ac-table min-w-[640px]">
          <thead>
            <tr>
              <th className="ac-th">Этап</th>
              <th className="ac-th">Начало этапа</th>
              <th className="ac-th">Допустимо</th>
              <th className="ac-th">Затрачено</th>
              <th className="ac-th">Осталось</th>
              <th className="ac-th">SLA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = r.failed
                ? { label: "Нарушен", cls: "bg-red-50 text-red-600" }
                : r.current && !isClosed
                ? slaStatus(r.remaining)
                : r.done
                ? { label: "✓ Выполнен", cls: "bg-emerald-500/10 text-emerald-600" }
                : { label: "—", cls: "bg-[var(--admin-bg)] text-[var(--admin-muted)]" };
              return (
                <tr
                  key={r.s.key}
                  className={`ac-tr ${r.failed ? "bg-red-50/40" : r.current && !isClosed ? "bg-primary/5" : ""}`}
                >
                  <td className="ac-td">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      {r.done ? "✅" : r.current ? (isClosed ? "🏁" : "●") : r.failed ? "⛔" : "○"}
                      {r.s.label}
                    </span>
                  </td>
                  <td className="ac-td text-[var(--admin-muted)] whitespace-nowrap">
                    {r.done || r.current ? fmtDateTime(r.start.toISOString()) : "—"}
                  </td>
                  <td className="ac-td whitespace-nowrap">{fmtH(r.allowed)}</td>
                  <td className="ac-td text-[var(--admin-muted)] whitespace-nowrap">
                    {r.done || r.current ? fmtH(r.elapsed) : "—"}
                  </td>
                  <td className="ac-td whitespace-nowrap">
                    {r.failed ? (
                      <span className="text-red-600 font-semibold">Просрочен</span>
                    ) : r.done || (r.current && !isClosed) ? (
                      <span style={{ color: r.remaining < 0 ? "#dc2626" : r.remaining < 3600000 * 6 ? "#d97706" : "#16a34a" }}>
                        {fmtH(r.remaining)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="ac-td">
                    <span className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {slaNeedsAction && (
        <div className="flex items-center gap-2 flex-wrap px-1">
          {canRaise && (
            <button onClick={() => onRunSlaAction?.("raise_priority")} className="ac-btn ac-btn-secondary ac-btn-sm">
              ⬆️ Повысить приоритет
            </button>
          )}
          <button onClick={() => onRunSlaAction?.("escalate")} className="ac-btn ac-btn-danger ac-btn-sm">
            🚨 Эскалировать
          </button>
          <button onClick={() => onRunSlaAction?.("notify_manager")} className="ac-btn ac-btn-secondary ac-btn-sm">
            🔔 Уведомить руководителя
          </button>
        </div>
      )}
    </div>
  );
}

function OverviewTab({
  order,
  onEdit,
  onTab,
  onRunSlaAction,
}: {
  order: OrderCardData;
  onEdit: () => void;
  onTab: (t: string) => void;
  onRunSlaAction?: (action: "raise_priority" | "escalate" | "notify_manager") => void;
}) {
  const p = PRIORITY_META[order.priority] ?? PRIORITY_META.MEDIUM;
  const fields: { label: string; value: string }[] = [
    { label: "Номер заказа", value: order.orderNumber },
    { label: "Дата создания", value: fmtDateTime(order.createdAt) },
    { label: "Статус", value: ORDER_STATUS_LABELS[order.status] ?? order.status },
    { label: "Приоритет", value: `${p.stars} ${p.label}` },
    { label: "Канал продаж", value: order.source },
    { label: "Ответственный", value: order.manager },
    { label: "Кол-во услуг", value: String(order.servicesCount) },
    { label: "Поездка", value: order.serviceDate ? fmtDate(order.serviceDate) : "—" },
    { label: "Стоимость", value: `${fmtMoney(order.amount)} ${order.currency}` },
    { label: "Оплата", value: PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus },
    { label: "Документы", value: DOCS_LABELS[order.status] ?? "—" },
    { label: "Поставщик", value: order.provider },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {fields.map((f) => (
          <div key={f.label} className="bg-[var(--admin-bg)] rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wide text-[var(--admin-muted)]">{f.label}</div>
            <div className="text-xs font-semibold mt-0.5">{f.value}</div>
          </div>
        ))}
      </div>
      <ExecutionControl order={order} onRunSlaAction={onRunSlaAction} />
      <div className="flex items-center gap-2">
        <button onClick={onEdit} className="ac-btn ac-btn-primary ac-btn-sm">✏️ Изменить даты и сумму</button>
        <button onClick={() => onTab("history")} className="ac-btn ac-btn-secondary ac-btn-sm">
          🕘 История изменений
        </button>
        <button onClick={() => onTab("ai")} className="ac-btn ac-btn-secondary ac-btn-sm">
          🤖 AI-анализ
        </button>
      </div>
    </div>
  );
}

function ClientTab({ order, onRunSlaAction }: { order: OrderCardData; onRunSlaAction?: (action: "raise_priority" | "escalate" | "notify_manager") => void }) {
  return (
    <div className="space-y-3">
      {/* Компактный контроль исполнения (Гл. 3.4) */}
      <SlaMiniWidget order={order} onRunSlaAction={onRunSlaAction} />
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-[var(--admin-bg)]">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
          {order.client.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-bold">{order.client}</div>
          <div className="text-[11px] text-[var(--admin-muted)]">Клиент платформы · с {fmtDate(order.clientSince)}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-[var(--admin-bg)] rounded-xl p-3">
          <div className="text-[10px] uppercase text-[var(--admin-muted)]">Email</div>
          <div className="text-xs font-semibold mt-0.5">{order.clientEmail}</div>
        </div>
        <div className="bg-[var(--admin-bg)] rounded-xl p-3">
          <div className="text-[10px] uppercase text-[var(--admin-muted)]">Телефон</div>
          <div className="text-xs font-semibold mt-0.5">{order.clientPhone}</div>
        </div>
      </div>
      <div className="text-[11px] text-[var(--admin-muted)]">
        Полная карточка клиента, история поездок и финансовая история доступны в CRM.
      </div>
    </div>
  );
}

/**
 * Вкладка «Туристы» (Baseline §4, OrderTraveler): участники заказа ДО Booking.
 * Заполнение паспортных данных управляет готовностью к бронированию
 * (bookingReady) — действие «Передать в Booking Center» блокируется с причиной,
 * пока данные неполные (Screen Design Brief §25).
 */
interface TravelerRow {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  citizenship: string | null;
  gender: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  dataCompleteness: string;
}

function TravelersTab({ order, onChanged }: { order: OrderCardData; onChanged: () => Promise<void> }) {
  const [rows, setRows] = useState<TravelerRow[]>(() => order.travelers.map((t) => ({ ...t })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Синхронизация с данными карточки (после перезагрузки).
  useEffect(() => {
    // setState в микротаске — синхронный вызов ловит react-hooks/set-state-in-effect
    void Promise.resolve().then(() => {
      setRows(order.travelers.map((t) => ({ ...t })));
    });
  }, [order.travelers]);

  const patchRow = (i: number, k: keyof TravelerRow, v: string | null) => {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));
  };
  const addRow = () => {
    setRows((r) => [
      ...r,
      { id: "", firstName: "", lastName: "", birthDate: null, citizenship: "", gender: "M", passportNumber: "", passportExpiry: null, dataCompleteness: "incomplete" },
    ]);
  };
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "travelers", travelers: rows, version: order.version }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Ошибка сохранения");
      setMsg({ ok: true, text: j.message || "Туристы сохранены" });
      await onChanged();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  const br = order.bookingReady;
  const inputCls =
    "w-full h-9 px-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors";

  return (
    <div className="space-y-4">
      {/* Индикатор готовности к бронированию (Screen Design Brief §25) */}
      <div
        className={`rounded-xl px-4 py-3 text-xs border ${
          br?.ready
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
            : "bg-amber-500/10 border-amber-500/30 text-amber-700"
        }`}
      >
        {br?.ready
          ? `✅ Данные туристов заполнены (${br.complete}/${br.total}) — заказ можно передать в Booking Center`
          : `⚠️ ${br?.reason || "Заполните паспортные данные туристов"}`}
      </div>

      {rows.length === 0 && (
        <div className="text-xs text-[var(--admin-muted)]">Туристов пока нет — добавьте участников поездки.</div>
      )}

      {rows.map((t, i) => (
        <div key={i} className="rounded-xl border border-[var(--admin-border)] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
              Турист {i + 1}{" "}
              {t.passportNumber
                ? <span className="text-emerald-600">· паспортные данные ✓</span>
                : <span className="text-amber-600">· данные неполные</span>}
            </span>
            <button onClick={() => removeRow(i)} className="text-xs text-red-500 hover:underline" title="Удалить">
              ✕ Удалить
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <input className={inputCls} placeholder="Имя *" value={t.firstName} onChange={(e) => patchRow(i, "firstName", e.target.value)} />
            <input className={inputCls} placeholder="Фамилия *" value={t.lastName} onChange={(e) => patchRow(i, "lastName", e.target.value)} />
            <input
              className={inputCls}
              type="date"
              value={t.birthDate ?? ""}
              onChange={(e) => patchRow(i, "birthDate", e.target.value || null)}
            />
            <input className={inputCls} placeholder="Гражданство" value={t.citizenship ?? ""} onChange={(e) => patchRow(i, "citizenship", e.target.value)} />
            <select
              className={inputCls}
              value={t.gender ?? "M"}
              onChange={(e) => patchRow(i, "gender", e.target.value)}
            >
              <option value="M">Мужской</option>
              <option value="F">Женский</option>
            </select>
            <input
              className={inputCls}
              placeholder="№ паспорта *"
              value={t.passportNumber ?? ""}
              onChange={(e) => patchRow(i, "passportNumber", e.target.value)}
            />
            <input
              className={inputCls}
              type="date"
              value={t.passportExpiry ?? ""}
              onChange={(e) => patchRow(i, "passportExpiry", e.target.value || null)}
            />
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={addRow} className="ac-btn ac-btn-secondary ac-btn-sm">
          ➕ Добавить туриста
        </button>
        <button onClick={save} disabled={busy || rows.length === 0} className="ac-btn ac-btn-primary ac-btn-sm">
          {busy ? "Сохранение…" : "💾 Сохранить туристов"}
        </button>
        {msg && (
          <span className={`text-xs ${msg.ok ? "text-emerald-600" : "text-red-500"}`}>{msg.text}</span>
        )}
      </div>
    </div>
  );
}

function ServicesTab({ order, onRunSlaAction }: { order: OrderCardData; onRunSlaAction?: (action: "raise_priority" | "escalate" | "notify_manager") => void }) {
  // Состав заказа (Baseline §3): OrderItems — канонический состав. Бронирования
  // появляются после «Передать в Booking Center» (событие BookingRequested).
  const composition = order.items.length ? order.items : order.bookings.map((b) => ({
    id: b.id,
    title: b.service,
    type: b.categoryType,
    category: b.category,
    quantity: 1,
    price: b.amount,
    currency: b.currency,
    amount: b.amount,
    serviceDate: b.serviceDate,
    serviceId: "",
    direction: b.direction,
    provider: "",
  }));
  return (
    <div className="space-y-3">
      {/* Компактный контроль исполнения (Гл. 3.4) */}
      <SlaMiniWidget order={order} onRunSlaAction={onRunSlaAction} />
      <div className="p-4 rounded-2xl bg-[var(--admin-bg)]">
        <div className="flex items-start gap-3">
          <div className="text-xl">{SERVICE_TYPE_ICONS[order.categoryType] ?? "🧩"}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold">{order.service}</div>
            <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">
              {order.category} · {order.partner} · {order.serviceDate ? fmtDate(order.serviceDate) : "—"}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-bold">{fmtMoney(order.amount)} {order.currency}</div>
            <div className="text-[10px] text-[var(--admin-muted)]">Комиссия {fmtMoney(order.commission)}</div>
          </div>
        </div>
      </div>

      {/* Состав заказа (Baseline §3): OrderItem — позиции, зафиксированные при создании */}
      {composition.length > 0 ? (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
            Состав заказа · {composition.length}
          </div>
          {composition.map((it, i) => (
            <div key={it.id || i} className="flex items-center justify-between p-3 rounded-xl bg-[var(--admin-bg)]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base">{SERVICE_TYPE_ICONS[it.type] ?? "🧩"}</span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{it.title}</div>
                  <div className="text-[10px] text-[var(--admin-muted)]">
                    {it.category} · {it.direction || "—"}
                    {it.quantity > 1 ? ` · ×${it.quantity}` : ""}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <div className="text-xs font-bold">{fmtMoney(it.amount)} {it.currency}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-sm text-[var(--admin-muted)] py-8">Состав заказа пуст</div>
      )}

      {order.bookings.length > 1 && (
        <div className="text-[11px] text-[var(--admin-muted)]">
          В заказ входит {order.bookings.length} бронирований — см. вкладку «Бронирования».
        </div>
      )}
    </div>
  );
}

function BookingsTab({ order }: { order: OrderCardData }) {
  return (
    <div className="space-y-2">
      {order.bookings.length === 0 && (
        <div className="text-center text-sm text-[var(--admin-muted)] py-10">
          Бронирований нет — они создаются после команды «Передать в Booking Center»
        </div>
      )}
      {order.bookings.map((b) => (
        <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--admin-bg)]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base">{SERVICE_TYPE_ICONS[b.categoryType] ?? "🔖"}</span>
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate">{b.service}</div>
              <div className="text-[10px] text-[var(--admin-muted)]">{b.direction} · {b.bookingNumber}</div>
            </div>
          </div>
          <div className="text-right shrink-0 ml-3">
            <div className="text-xs font-bold">{fmtMoney(b.amount)} {b.currency}</div>
            <div className="text-[10px] text-[var(--admin-muted)]">{fmtDate(b.serviceDate)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Способы оплаты (Гл. 3.11 «Платежи»)
const PAYMENT_METHODS = ["Банковская карта", "Банковский перевод", "Stripe", "PayPal", "Внутренний баланс"];

function FinanceTab({ order, onRunSlaAction }: { order: OrderCardData; onRunSlaAction?: (action: "raise_priority" | "escalate" | "notify_manager") => void }) {
  const f = order.financial;
  const total = f?.totalAmount ?? order.amount;
  const paid = f?.paidAmount ?? order.paidAmount;
  const pending = Math.max(0, total - paid);
  const commission = f?.commission ?? order.commission;
  const payout = f?.expectedPayouts ?? Math.max(0, total - commission);
  const isRefund = order.paymentStatus === "refunded" || order.status === "CANCELLED";

  // Счета (Гл. 3.11): выставляются на сумму заказа, статус зависит от оплаты
  const invoiceStatus = isRefund
    ? "Аннулирован"
    : order.paymentStatus === "paid"
    ? "Оплачен"
    : order.paymentStatus === "partially_paid"
    ? "Частично оплачен"
    : pending > 0
    ? "Отправлен"
    : "Черновик";
  const invoiceNumber = `INV-${order.orderNumber.replace(/\D/g, "") || "0001"}`;

  // Платежи (Гл. 3.11): из оплаченной суммы, способ детерминирован по заказу
  const payments =
    paid > 0
      ? [
          {
            id: "p1",
            date: order.createdAt,
            amount: paid,
            method: PAYMENT_METHODS[(order.orderNumber.length + order.client.length) % PAYMENT_METHODS.length],
            status: "Завершён",
          },
        ]
      : [];

  // Возврат (Гл. 3.11): если заказ в возврате
  const refund = isRefund
    ? {
        reason: order.status === "CANCELLED" ? "Отмена по инициативе клиента" : "Возврат денежных средств",
        amount: paid > 0 ? paid : total,
        stage: "Завершён",
        status: "Выплачен",
        manager: order.manager,
      }
    : null;

  // Журнал финансовых операций (Гл. 3.11): аудит-лента
  const journal = [
    { id: "j1", at: order.createdAt, who: order.manager, what: "Создан заказ", obj: order.orderNumber, note: `Сумма: ${fmtMoney(total)} ${order.currency}` },
    ...(paid > 0
      ? [
          {
            id: "j2",
            at: order.updatedAt,
            who: order.manager,
            what: "Зарегистрирован платёж",
            obj: invoiceNumber,
            note: `${fmtMoney(paid)} ${order.currency} · ${PAYMENT_LABELS[order.paymentStatus] ?? "оплачен"}`,
          },
        ]
      : []),
    ...(pending > 0 && !isRefund
      ? [
          {
            id: "j3",
            at: order.updatedAt,
            who: "Система",
            what: "Выставлен счёт",
            obj: invoiceNumber,
            note: `К оплате: ${fmtMoney(pending)} ${order.currency}`,
          },
        ]
      : []),
    ...(refund
      ? [
          {
            id: "j4",
            at: order.updatedAt,
            who: order.manager,
            what: "Оформлен возврат",
            obj: order.orderNumber,
            note: `${fmtMoney(refund.amount)} ${order.currency} · ${refund.reason}`,
          },
        ]
      : []),
  ];

  const summary = [
    { label: "Стоимость заказа", value: fmtMoney(total), color: "text-[var(--admin-text)]" },
    { label: "Оплачено", value: fmtMoney(paid), color: "text-emerald-600" },
    { label: "К оплате", value: fmtMoney(pending), color: pending > 0 ? "text-amber-600" : "text-emerald-600" },
    { label: "Комиссия", value: fmtMoney(commission), color: "text-blue-600" },
  ];

  return (
    <div className="space-y-4">
      {/* Компактный контроль исполнения (Гл. 3.4) */}
      <SlaMiniWidget order={order} onRunSlaAction={onRunSlaAction} />
      {/* Финансовая сводка (3.11) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summary.map((s) => (
          <div key={s.label} className="bg-[var(--admin-bg)] rounded-xl p-3 text-center">
            <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Стоимость услуг (3.11) */}
      <div>
        <h4 className="text-[11px] font-semibold text-[var(--admin-muted)] uppercase mb-2">Стоимость услуг</h4>
        <table className="ac-table">
          <thead>
            <tr>
              <th className="ac-th">Услуга</th>
              <th className="ac-th">Кол-во</th>
              <th className="ac-th">Цена</th>
              <th className="ac-th">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {(order.bookings.length > 0 ? order.bookings : [{ id: "b0", bookingNumber: "—", service: order.service, category: order.category, categoryType: order.categoryType, status: "", amount: total, currency: order.currency, serviceDate: "", createdAt: order.createdAt, direction: order.partner }]).map((b) => (
              <tr key={b.id} className="ac-tr">
                <td className="ac-td">
                  <span className="text-xs font-semibold flex items-center gap-2">
                    <span>{SERVICE_TYPE_ICONS[b.categoryType] ?? "🧩"}</span> {b.service}
                  </span>
                </td>
                <td className="ac-td">1</td>
                <td className="ac-td">{fmtMoney(b.amount)} {b.currency}</td>
                <td className="ac-td font-semibold">{fmtMoney(b.amount)} {b.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Счета (3.11) */}
      <div>
        <h4 className="text-[11px] font-semibold text-[var(--admin-muted)] uppercase mb-2">Счета</h4>
        <div className="rounded-xl border border-[var(--admin-border)] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--admin-bg)]">
            <div>
              <div className="text-xs font-bold">{invoiceNumber}</div>
              <div className="text-[10px] text-[var(--admin-muted)]">Создан {fmtDate(order.createdAt)} · срок {fmtDate(order.updatedAt)}</div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded-lg text-[11px] font-semibold"
                style={{
                  background: invoiceStatus === "Оплачен" ? "#22c55e1a" : invoiceStatus === "Аннулирован" ? "#ef44441a" : "#f59e0b1a",
                  color: invoiceStatus === "Оплачен" ? "#16a34a" : invoiceStatus === "Аннулирован" ? "#dc2626" : "#d97706",
                }}
              >
                {invoiceStatus}
              </span>
              <button className="ac-btn ac-btn-secondary ac-btn-sm">⬇ PDF</button>
            </div>
          </div>
          <div className="px-3 py-2 text-xs text-[var(--admin-muted)]">
            Сумма: <b className="text-[var(--admin-text)]">{fmtMoney(total)} {order.currency}</b>
            {pending > 0 && !isRefund && (
              <span className="ml-2">· Оплачено {fmtMoney(paid)} · <span className="text-amber-600">к оплате {fmtMoney(pending)}</span></span>
            )}
          </div>
        </div>
      </div>

      {/* Платежи (3.11) */}
      <div>
        <h4 className="text-[11px] font-semibold text-[var(--admin-muted)] uppercase mb-2">Платежи</h4>
        {payments.length === 0 ? (
          <div className="text-xs text-[var(--admin-muted)] py-3 bg-[var(--admin-bg)] rounded-xl px-3">Платежей ещё не было</div>
        ) : (
          <div className="space-y-2">
            {payments.map((pm) => (
              <div key={pm.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--admin-bg)]">
                <div className="min-w-0">
                  <div className="text-xs font-semibold">{fmtMoney(pm.amount)} {order.currency}</div>
                  <div className="text-[10px] text-[var(--admin-muted)]">{pm.method} · {fmtDate(pm.date)}</div>
                </div>
                <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-600">{pm.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Комиссии (3.11) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--admin-bg)] rounded-xl p-3">
          <div className="text-[10px] uppercase text-[var(--admin-muted)]">Комиссия платформы (12%)</div>
          <div className="text-xs font-bold mt-0.5 text-blue-600">{fmtMoney(commission)} {order.currency}</div>
        </div>
        <div className="bg-[var(--admin-bg)] rounded-xl p-3">
          <div className="text-[10px] uppercase text-[var(--admin-muted)]">Выплата партнёру (88%)</div>
          <div className="text-xs font-bold mt-0.5 text-violet-600">{fmtMoney(payout)} {order.currency}</div>
        </div>
      </div>

      {/* Возвраты (3.11) */}
      {refund && (
        <div>
          <h4 className="text-[11px] font-semibold text-[var(--admin-muted)] uppercase mb-2">Возврат</h4>
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--admin-muted)]">Причина</span>
              <span className="font-semibold">{refund.reason}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--admin-muted)]">Сумма</span>
              <span className="font-semibold">{fmtMoney(refund.amount)} {order.currency}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--admin-muted)]">Этап</span>
              <span className="font-semibold text-emerald-600">{refund.stage} · {refund.status}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--admin-muted)]">Ответственный</span>
              <span className="font-semibold">{refund.manager}</span>
            </div>
          </div>
        </div>
      )}

      {/* Журнал финансовых операций (3.11) */}
      <div>
        <h4 className="text-[11px] font-semibold text-[var(--admin-muted)] uppercase mb-2">Журнал финансовых операций</h4>
        <div className="space-y-1.5">
          {journal.map((j) => (
            <div key={j.id} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--admin-bg)]">
              <span className="text-[11px] text-[var(--admin-muted)] shrink-0 mt-0.5">{fmtDate(j.at)}</span>
              <div className="min-w-0">
                <div className="text-[11px]">
                  <b>{j.who}</b> · {j.what} · <span className="text-primary">{j.obj}</span>
                </div>
                <div className="text-[10px] text-[var(--admin-muted)]">{j.note}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-[var(--admin-muted)] mt-1.5">Журнал является частью системы аудита и недоступен для изменения.</div>
      </div>
    </div>
  );
}

// ── Модальное окно «Новый заказ» (Гл. 3.5 «Быстрое создание») ──

interface FormClient {
  id: string;
  name: string;
  email: string;
}

interface FormService {
  id: string;
  type: string;
  category: string;
  title: string;
  price: number;
  currency: string;
  direction: string;
}

function CreateOrderModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [clients, setClients] = useState<FormClient[]>([]);
  const [services, setServices] = useState<FormService[]>([]);
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [amount, setAmount] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch("/api/admin/orders?mode=form")
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((j) => {
          setClients(j.clients ?? []);
          setServices(j.services ?? []);
        })
        .catch((e) => setError(errText(e)));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const selectedService = services.find((s) => s.id === serviceId);

  const submit = async () => {
    if (!clientId || !serviceId) {
      setError("Выберите клиента и услугу");
      return;
    }
    if (!serviceDate) {
      setError("Укажите дату поездки");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: clientId,
          serviceId,
          serviceDate,
          amount: amount && parseFloat(amount) > 0 ? parseFloat(amount) : undefined,
          priority,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Ошибка создания");
      onCreated(j.order.id);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-5 py-4 border-b border-[var(--admin-border)] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">➕ Новый заказ</h3>
            <p className="text-xs text-[var(--admin-muted)] mt-0.5">Клиент → услуга → даты → создание</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--admin-muted)] hover:bg-[var(--admin-bg)]">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-2.5">{error}</div>}
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--admin-muted)]">Клиент</span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="ac-select mt-1 w-full"
            >
              <option value="">Выберите клиента…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--admin-muted)]">Услуга</span>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="ac-select mt-1 w-full"
            >
              <option value="">Выберите услугу…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{SERVICE_TYPE_ICONS[s.type] ?? "🧩"} {s.title} — {fmtMoney(s.price)} {s.currency}</option>
              ))}
            </select>
          </label>
          {selectedService && (
            <div className="text-[11px] text-[var(--admin-muted)]">
              {selectedService.category} · {selectedService.direction} · цена {fmtMoney(selectedService.price)} {selectedService.currency}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-medium text-[var(--admin-muted)]">Дата поездки</span>
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="ac-select mt-1 w-full"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-[var(--admin-muted)]">Сумма (необязательно)</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={selectedService ? `${selectedService.price} ${selectedService.currency}` : "Авто из услуги"}
                className="ac-select mt-1 w-full"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--admin-muted)]">Приоритет</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="ac-select mt-1 w-full"
            >
              {Object.entries(PRIORITY_META).map(([v, m]) => (
                <option key={v} value={v}>{m.stars} {m.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="px-5 py-4 border-t border-[var(--admin-border)] flex items-center justify-end gap-2">
          <button onClick={onClose} className="ac-btn ac-btn-secondary">
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="ac-btn ac-btn-primary"
          >
            {busy ? "Создание…" : "Создать заказ"}
          </button>
        </div>
      </div>
    </div>
  );
}
