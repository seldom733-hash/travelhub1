"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RevenueChart, DonutChart, CHART_COLORS } from "@/components/admin/charts";
import ActiveFilterChips, { type ActiveFilterChip } from "@/components/admin/ActiveFilterChips";
import { describeApiError } from "@/lib/api-error";

/* ─── Типы данных API ─── */
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
  bookingStatus: string;
  paymentStatus: "paid" | "partially" | "pending" | "refunded";
  manager: string;
  source: string;
  unreadCount: number;
  createdAt: string;
  serviceDate: string | null;
  updatedAt: string;
}

interface KpiItem {
  value: number;
  change: number;
  detail: string;
}

interface OrdersData {
  kpi: {
    totalOrders: KpiItem;
    newToday: KpiItem;
    awaitingProcessing: KpiItem;
    awaitingConfirmation: KpiItem;
    ready: KpiItem;
    completed: KpiItem;
    avgCheck: KpiItem;
    platformRevenue: KpiItem;
    newOrders: KpiItem;
    activeOrders: KpiItem;
    awaitingPayment: KpiItem;
    paidOrders: KpiItem;
    cancelledOrders: KpiItem;
    avgCycle: KpiItem;
    refunds: KpiItem;
    aiForecast: KpiItem;
    needsAttention: KpiItem;
  };
  funnel: { entry: number; confirmed: number; paid: number };
  ordersSeries: { labels: string[]; values: number[] };
  confirmSeries: { labels: string[]; values: number[] };
  bookingsByService: { type: string; label: string; icon: string; count: number; amount: number }[];
  bookingsByCountry: { code: string; country: string; count: number }[];
  heatmap: { day: string; hour: number; value: number }[];
  financial: {
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    refundedAmount: number;
    commission: number;
    expectedPayouts: number;
  };
  statusCounts: { status: string; count: number }[];
  recentOrders: { id: string; client: string; service: string; amount: number; status: string; createdAt: string }[];
  problemOrders: { id: string; client: string; service: string; amount: number; serviceDate: string | null; urgency: string }[];
  overdueActions: { id: string; client: string; service: string; amount: number; hours: number }[];
  pendingPayments: { id: string; client: string; service: string; amount: number; createdAt: string }[];
  refunds: { id: string; client: string; service: string; amount: number; status: string; updatedAt: string }[];
  upcomingTrips: { id: string; client: string; service: string; destination: string; serviceDate: string | null }[];
  providerNotifications: { id: string; type: string; title: string; detail: string }[];
  aiRecommendations: { level: string; title: string; effect: string }[];
  sla: { targetHours: number; compliance: number; breaches: number; total: number };
  managers: string[];
  orders: OrderRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/* ─── Быстрые действия (Заказ.docx, Гл. 5.5) ─── */
const QUICK_ACTIONS = [
  { icon: "➕", label: "Создать заказ", color: "bg-primary" },
  { icon: "📤", label: "Экспорт", color: "bg-blue-500" },
  { icon: "📥", label: "Импорт", color: "bg-gray-500" },
  { icon: "✏️", label: "Массовое изменение", color: "bg-violet-500" },
  { icon: "👤", label: "Назначить менеджера", color: "bg-cyan-500" },
  { icon: "📨", label: "Отправить сообщение", color: "bg-emerald-500" },
  { icon: "🤖", label: "AI Анализ", color: "bg-fuchsia-500" },
];

/* ─── Жизненный цикл заказа (Гл. 6.10) ─── */
const LIFECYCLE = [
  "Черновик",
  "Создан",
  "В обработке",
  "Ожидает подтверждения",
  "Подтверждён",
  "Ожидает оплаты",
  "Оплачен",
  "Подготовка документов",
  "Готов к поездке",
  "Завершён",
];

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  CREATED: "Создан",
  PROCESSING: "В обработке",
  AWAITING_CONFIRMATION: "Ожидает подтверждения",
  CONFIRMED: "Подтверждён",
  AWAITING_PAYMENT: "Ожидает оплаты",
  PARTIALLY_PAID: "Частично оплачен",
  PAID: "Оплачен",
  DOCUMENT_PREP: "Подготовка документов",
  READY: "Готов к поездке",
  COMPLETED: "Завершён",
  CHANGED: "Изменён",
  REFUNDED: "Возвращён",
  CANCELLED: "Отменён",
  OVERDUE: "Просрочен",
  ARCHIVED: "Архивирован",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  CREATED: "bg-slate-200 text-slate-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  AWAITING_CONFIRMATION: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-violet-100 text-violet-700",
  AWAITING_PAYMENT: "bg-orange-100 text-orange-700",
  PARTIALLY_PAID: "bg-yellow-100 text-yellow-700",
  PAID: "bg-emerald-100 text-emerald-700",
  DOCUMENT_PREP: "bg-teal-100 text-teal-700",
  READY: "bg-cyan-100 text-cyan-700",
  COMPLETED: "bg-green-100 text-green-700",
  CHANGED: "bg-lime-100 text-lime-700",
  REFUNDED: "bg-red-100 text-red-700",
  CANCELLED: "bg-rose-100 text-rose-700",
  OVERDUE: "bg-red-100 text-red-700",
  ARCHIVED: "bg-gray-100 text-gray-600",
};

const PAY_STYLES: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  partially: "bg-yellow-100 text-yellow-700",
  pending: "bg-amber-100 text-amber-700",
  refunded: "bg-red-100 text-red-700",
};

const PAY_LABELS: Record<string, string> = {
  paid: "Оплачен",
  partially: "Частично",
  pending: "Ожидает",
  refunded: "Возврат",
};

// Цветовая система статусов (Заказ.docx, Гл. 5.10): каждый аспект заказа —
// свой цвет бейджа. Статус заказа — синий, Оплата — зелёный,
// Бронирование — фиолетовый, Оказание услуги — оранжевый.
const ORDER_BADGE_STYLES = "bg-blue-100 text-blue-700 border border-blue-200";
const PAY_BADGE_STYLES: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  partially: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  pending: "bg-emerald-50 text-emerald-600 border border-dashed border-emerald-300",
  refunded: "bg-red-100 text-red-600 border border-red-200",
};
const BOOKING_BADGE_STYLES = "bg-violet-100 text-violet-700 border border-violet-200";
const SERVICE_BADGE_STYLES = "bg-orange-100 text-orange-700 border border-orange-200";

// Статус оказания услуги (производный от общего статуса заказа)
function serviceDeliveryStatus(status: string): string {
  const map: Record<string, string> = {
    COMPLETED: "Выполнена",
    READY: "Готова",
    DOCUMENT_PREP: "Документы",
    PAID: "Оплачена",
    AWAITING_PAYMENT: "Ждёт оплаты",
    PARTIALLY_PAID: "Частично оплачена",
    OVERDUE: "Просрочена",
    AWAITING_CONFIRMATION: "Ждёт подтверждения",
    CONFIRMED: "Подтверждена",
    PROCESSING: "В обработке",
    CREATED: "Создана",
    DRAFT: "Черновик",
    CHANGED: "Изменена",
    CANCELLED: "Отменена",
    REFUNDED: "Возврат",
    ARCHIVED: "Архив",
  };
  return map[status] ?? status;
}

const BOOKING_LABELS: Record<string, string> = {
  PENDING: "Ожидает",
  CONFIRMED: "Подтверждено",
  PAID: "Оплачено",
  COMPLETED: "Завершено",
  REFUNDED: "Возврат",
};

const AI_PROMPTS = [
  "Проанализируй риски отмены по текущим заказам",
  "Спрогнозируй выручку по заказам на месяц вперёд",
  "Какие заказы требуют немедленного внимания?",
  "Найди аномалии в заказах за последний месяц",
  "Сравни эффективность менеджеров по заказам",
  "Какой поставщик чаще всего задерживает подтверждение?",
  "Выяви заказы с высоким риском возврата",
  "Спрогнозируй выполнение плана по заказам",
  "Дай рекомендации по снижению числа отмен",
  "Сформируй отчёт по заказам за период",
];

const PERIODS = [
  { key: "today", label: "Сегодня" },
  { key: "yesterday", label: "Вчера" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "quarter", label: "Квартал" },
  { key: "year", label: "Год" },
];

const ORDER_STATUSES = [
  { key: "", label: "Все статусы" },
  { key: "DRAFT", label: "Черновик" },
  { key: "CREATED", label: "Создан" },
  { key: "PROCESSING", label: "В обработке" },
  { key: "AWAITING_CONFIRMATION", label: "Ожидает подтверждения" },
  { key: "CONFIRMED", label: "Подтверждён" },
  { key: "AWAITING_PAYMENT", label: "Ожидает оплаты" },
  { key: "PARTIALLY_PAID", label: "Частично оплачен" },
  { key: "PAID", label: "Оплачен" },
  { key: "DOCUMENT_PREP", label: "Подготовка документов" },
  { key: "READY", label: "Готов к поездке" },
  { key: "COMPLETED", label: "Завершён" },
  { key: "CHANGED", label: "Изменён" },
  { key: "REFUNDED", label: "Возвращён" },
  { key: "CANCELLED", label: "Отменён" },
  { key: "OVERDUE", label: "Просрочен" },
  { key: "ARCHIVED", label: "Архивирован" },
  { key: "DRAFT,CREATED,AWAITING_CONFIRMATION", label: "Новые заказы (все)" },
  { key: "DRAFT,CREATED,PROCESSING,AWAITING_CONFIRMATION", label: "Ожидают обработки (все)" },
  { key: "DOCUMENT_PREP,READY", label: "Готовы к оказанию (все)" },
  { key: "AWAITING_PAYMENT,PARTIALLY_PAID,OVERDUE", label: "Ожидают оплаты (все)" },
  { key: "PAID,DOCUMENT_PREP,READY,COMPLETED", label: "Оплаченные (все)" },
];

const PAYMENT_STATUSES = [
  { key: "", label: "Все платежи" },
  { key: "paid", label: "Оплачен" },
  { key: "partially", label: "Частично" },
  { key: "pending", label: "Ожидает" },
  { key: "refunded", label: "Возврат" },
];

const SOURCES = [
  { key: "", label: "Все источники" },
  { key: "Сайт", label: "Сайт" },
  { key: "Мобильное приложение", label: "Мобильное приложение" },
  { key: "Партнёр", label: "Партнёр" },
  { key: "Call-центр", label: "Call-центр" },
  { key: "Telegram-бот", label: "Telegram-бот" },
  { key: "WhatsApp", label: "WhatsApp" },
];

const SERVICE_TYPES = [
  { key: "", label: "Все категории" },
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

const CURRENCIES = ["", "USD", "EUR", "AZN", "RUB"];

/* ─── Журнал изменений (вкладка «История изменений», Гл. 6.9) ─── */
interface HistoryEntry {
  id: string;
  action: string;
  from: string | null;
  to: string | null;
  fields: Record<string, unknown> | null;
  actorName: string;
  comment: string | null;
  createdAt: string;
}

/** Короткое форматирование длительности: «5 мин», «3 ч 12 мин», «2 д 4 ч». */
function fmtDurationShort(ms: number): string {
  if (ms <= 0) return "—";
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h} ч ${m} мин` : `${h} ч`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d} д ${rh} ч` : `${d} д`;
}

/**
 * Длительности этапов журнала заказа (Гл. 6.9). Журнал приходит от новых к старым:
 * длительность записи i — время до следующего (более старого) перехода, т.е. сколько
 * заказ провёл в статусе, достигнутом записью i. У самой старой записи («создан»)
 * длительности нет — 0.
 */
function stageDurations(history: HistoryEntry[]): number[] {
  return history.map((h, i) => {
    if (i >= history.length - 1) return 0;
    const cur = new Date(h.createdAt).getTime();
    const next = new Date(history[i + 1].createdAt).getTime();
    return Math.max(0, cur - next);
  });
}

const HISTORY_META: Record<string, { icon: string; label: string }> = {
  created: { icon: "🆕", label: "Заказ создан" },
  process: { icon: "⚙️", label: "Принят в обработку" },
  confirm: { icon: "✅", label: "Подтверждён" },
  pay_request: { icon: "🧾", label: "Выставлен счёт" },
  pay: { icon: "💳", label: "Оплачен" },
  docs: { icon: "📄", label: "Подготовка документов" },
  ready: { icon: "🎒", label: "Готов к поездке" },
  complete: { icon: "🏁", label: "Завершён" },
  update: { icon: "✏️", label: "Изменён" },
  refund: { icon: "↩️", label: "Возврат" },
  cancel: { icon: "❌", label: "Отменён" },
  overdue: { icon: "⏰", label: "Просрочен" },
  archive: { icon: "📦", label: "Архивирован" },
  assign_manager: { icon: "👤", label: "Назначен менеджер" },
};

function formatHistoryFields(fields: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof fields.amount === "number") parts.push(`сумма → ${fmtMoney(fields.amount)}`);
  if (typeof fields.serviceDate === "string") parts.push(`дата поездки → ${fmtDate(fields.serviceDate)}`);
  return parts.join(" · ");
}

/* ─── Переписка (вкладка «Коммуникации», Гл. 6.9) ─── */
interface OrderMessageItem {
  id: string;
  senderName: string;
  senderRole: string;
  text: string;
  isRead: boolean;
  createdAt: string;
}

const QUICK_REPLIES = [
  "Ваш заказ подтверждён ✅",
  "Напоминаем об оплате — счёт действителен 48 часов",
  "Документы отправлены на вашу почту",
  "Дату поездки можно изменить — укажите желаемую",
  "Спасибо за оплату! Ваучер готов",
  "Поездка подтверждена, приятного отдыха!",
];

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " $";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${className}`}>
      {label}
    </span>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-[var(--admin-border)]/40 rounded-xl animate-pulse ${className}`} />;
}

/* ─── Тепловая карта активности заказов ─── */
function ActivityHeatmap({ data }: { data: { day: string; hour: number; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const valueMap = useMemo(() => new Map(data.map((d) => [`${d.day}:${d.hour}`, d.value])), [data]);
  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="min-w-[560px]">
        <div className="grid grid-cols-[36px_repeat(24,1fr)] gap-[3px]">
          {days.map((d) => (
            <div key={d} className="contents">
              <div className="text-[10px] text-[var(--admin-muted)] flex items-center justify-end pr-1 h-3.5">{d}</div>
              {Array.from({ length: 24 }).map((_, h) => {
                const v = valueMap.get(`${d}:${h}`) ?? 0;
                const opacity = v === 0 ? 0.08 : 0.2 + (v / max) * 0.8;
                return (
                  <div
                    key={`${d}-${h}`}
                    title={`${d} ${h}:00 — ${v} заказов`}
                    className="h-3.5 rounded-[3px] bg-primary"
                    style={{ opacity }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--admin-muted)]">
          <span>Меньше</span>
          {[0.08, 0.3, 0.55, 0.8, 1].map((o) => (
            <div key={o} className="w-3.5 h-3.5 rounded-[3px] bg-primary" style={{ opacity: o }} />
          ))}
          <span>Больше</span>
          <span className="ml-auto">Часы (0–23)</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Карточка заказа (боковая панель 600–700px, Гл. 6.9) ─── */
function OrderDetailSidebar({
  order,
  onClose,
  onAction,
  onEdit,
  acting,
  historyVersion,
  onMessagesRead,
  initialTab = "overview",
}: {
  order: OrderRow;
  onClose: () => void;
  onAction: (action: "confirm" | "pay" | "complete" | "cancel" | "refund" | "archive") => void;
  onEdit: () => void;
  acting: string | null;
  historyVersion: number;
  onMessagesRead: () => void;
  initialTab?: string;
}) {
  const [tab, setTab] = useState(initialTab);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const busy = acting !== null;

  // Загрузка журнала изменений заказа
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const res = await fetch(`/api/admin/orders/${order.id}/history`);
        if (!res.ok) throw new Error(await describeApiError(res, "Ошибка загрузки истории"));
        const json = await res.json();
        if (!cancelled) setHistory(json.history ?? []);
      } catch (err) {
        if (!cancelled) setHistoryError(err instanceof Error ? err.message : "Неизвестная ошибка");
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [order.id, historyVersion]);

  // Текущее время (Гл. 6.9): вычисляется один раз в ленивом инициализаторе (как в
  // BookingCenter, чтобы не нарушать react-hooks/purity) и тикает раз в минуту —
  // таймеры «идёт этап» и «в обработке» остаются актуальными.
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Длительности этапов цикла (вкладка «История», Гл. 6.9): сколько заказ провёл
  // в каждом статусе, где «узкое место» (самый долгий этап) и общая длительность
  // обработки — чтобы было видно, на каком шаге заявка застряла.
  const cycle = useMemo(() => {
    const durations = stageDurations(history);
    let slowestIdx = -1;
    let slowestDur = 0;
    durations.forEach((d, i) => {
      if (d > slowestDur) {
        slowestDur = d;
        slowestIdx = i;
      }
    });
    const firstAt = history.length ? new Date(history[history.length - 1].createdAt).getTime() : 0;
    const lastAt = history.length ? new Date(history[0].createdAt).getTime() : 0;
    const terminal = ["COMPLETED", "REFUNDED", "CANCELLED", "ARCHIVED"].includes(order.status);
    // Завершённый цикл — от первого перехода до последнего; в работе — от создания до сейчас
    const totalMs = history.length ? (terminal ? lastAt - firstAt : nowTs - firstAt) : 0;
    const currentStageMs = Math.max(0, nowTs - lastAt);
    // Узкое место: самый долгий завершённый этап, но если текущий этап уже идёт
    // дольше всех — он и есть узкое место (заявка застряла именно на нём).
    const currentIsSlowest = !terminal && currentStageMs > slowestDur && currentStageMs > 0;
    return {
      durations,
      slowestIdx: currentIsSlowest ? -1 : slowestIdx,
      slowestDur: currentIsSlowest ? currentStageMs : slowestIdx >= 0 ? slowestDur : 0,
      currentIsSlowest,
      totalMs: Math.max(0, totalMs),
      currentStageMs,
      terminal,
    };
  }, [history, order.status, nowTs]);

  // ── Коммуникации: загрузка переписки заказа ──
  const [messages, setMessages] = useState<OrderMessageItem[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [sendAsClient, setSendAsClient] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      setMessagesLoading(true);
      setMessagesError(null);
      try {
        const res = await fetch(`/api/admin/orders/${order.id}/messages`);
        if (!res.ok) throw new Error(await describeApiError(res, "Ошибка загрузки переписки"));
        const json = await res.json();
        const rows: OrderMessageItem[] = json.messages ?? [];
        if (!cancelled) setMessages(rows);
        // Карточка открылась сразу на вкладке «Коммуникации» (глубокий переход из
        // виджета «Сообщения» дашборда): непрочитанные помечаем прочитанными автоматически.
        const unread = rows.filter(
          (m) => (m.senderRole === "system" || m.senderRole === "manager") && !m.isRead
        ).length;
        if (initialTab === "messages" && unread > 0) {
          void fetch(`/api/admin/orders/${order.id}/messages/read`, { method: "POST" })
            .then(() => {
              if (cancelled) return;
              setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
              onMessagesRead();
            })
            .catch(() => {
              /* не критично */
            });
        }
      } catch (err) {
        if (!cancelled) setMessagesError(err instanceof Error ? err.message : "Неизвестная ошибка");
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // onMessagesRead — проп, пересоздаётся родителем каждый рендер; включать его
    // в deps нельзя (бесконечная перезагрузка переписки), а колбэк и так актуален.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, historyVersion, initialTab]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, messagesLoading]);

  const unreadMessages = messages.filter(
    (m) => (m.senderRole === "system" || m.senderRole === "manager") && !m.isRead
  ).length;

  const markMessagesRead = async () => {
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/messages/read`, { method: "POST" });
      if (!res.ok) return;
      setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
      onMessagesRead();
    } catch {
      /* не критично */
    }
  };

  const sendMessage = async (text: string) => {
    const t = text.trim();
    if (!t || messageSending) return;
    setMessageSending(true);
    setMessagesError(null);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, asClient: sendAsClient }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMessagesError(json?.detail ?? json?.error ?? "Не удалось отправить сообщение");
        return;
      }
      setMessageText("");
      const list = await fetch(`/api/admin/orders/${order.id}/messages`);
      if (list.ok) {
        const lj = await list.json();
        setMessages(lj.messages ?? []);
      }
    } catch {
      setMessagesError("Ошибка сети");
    } finally {
      setMessageSending(false);
    }
  };

  // Индекс стадии жизненного цикла (Гл. 6.10)
  const stageIndex =
    order.status === "DRAFT"
      ? 0
      : order.status === "CREATED"
      ? 1
      : order.status === "PROCESSING"
      ? 2
      : order.status === "AWAITING_CONFIRMATION"
      ? 3
      : order.status === "CONFIRMED"
      ? 4
      : order.status === "AWAITING_PAYMENT" || order.status === "PARTIALLY_PAID"
      ? 5
      : order.status === "PAID"
      ? 6
      : order.status === "DOCUMENT_PREP"
      ? 7
      : order.status === "READY"
      ? 8
      : order.status === "COMPLETED"
      ? 9
      : -1;
  const terminal = ["COMPLETED", "REFUNDED", "CANCELLED", "ARCHIVED"].includes(order.status);

  // 12 вкладок карточки заказа (Заказ.docx, Гл. 5.9)
  const tabs = [
    { key: "overview", label: "Обзор" },
    { key: "client", label: "Клиент" },
    { key: "services", label: "Услуга" },
    { key: "payments", label: "Оплата" },
    { key: "bookings", label: "Бронирование ⭐" },
    { key: "documents", label: "Документы" },
    { key: "finances", label: "Финансы" },
    { key: "partners", label: "Партнёр" },
    { key: "messages", label: "Коммуникации" },
    { key: "history", label: "История" },
    { key: "ai", label: "AI-анализ" },
    { key: "related", label: "Связанные объекты" },
  ];

  const refundedStatus = order.status === "REFUNDED" || order.status === "CANCELLED";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-[650px] bg-[var(--admin-card)] border-l border-[var(--admin-border)] overflow-y-auto shadow-2xl">
        {/* Шапка (Заказ.docx, Гл. 5.8): слева № заказа/дата/тип/статус, справа кнопки */}
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-[var(--admin-border)] bg-[var(--admin-card)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[var(--admin-text)]">{order.orderNumber}</h2>
                <Badge label={STATUS_LABELS[order.status] ?? order.status} className={ORDER_BADGE_STYLES} />
              </div>
              <p className="text-xs text-[var(--admin-muted)] mt-0.5">
                Создан {fmtDateTime(order.createdAt)} · {order.category} · {order.client} · {order.bookingsCount} бронь
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              <button
                onClick={onEdit}
                disabled={busy || terminal}
                className="px-3 h-8 rounded-lg bg-[var(--admin-bg)] text-[var(--admin-muted)] text-[11px] font-medium hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-40"
                title="Редактировать заказ"
              >
                ✏️ Редактировать
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 h-8 rounded-lg bg-[var(--admin-bg)] text-[var(--admin-muted)] text-[11px] font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                title="Печать карточки заказа"
              >
                🖨 Печать
              </button>
              <button
                onClick={() => setTab("messages")}
                className="px-3 h-8 rounded-lg bg-[var(--admin-bg)] text-[var(--admin-muted)] text-[11px] font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                title="Отправить клиенту"
              >
                📨 Клиенту
              </button>
              <button
                onClick={() => setTab("partners")}
                className="px-3 h-8 rounded-lg bg-[var(--admin-bg)] text-[var(--admin-muted)] text-[11px] font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                title="Связаться с партнёром"
              >
                🤝 Партнёру
              </button>
              <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-[var(--admin-bg)] flex items-center justify-center text-[var(--admin-muted)] transition-colors">
                ✕
              </button>
            </div>
          </div>

          {/* Жизненный цикл */}
          {refundedStatus && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-xs">
              <span>↩️</span>
              <span className="font-medium text-red-700">
                Заказ {order.status === "REFUNDED" ? "возвращён" : "отменён"} — вне линейного жизненного цикла
              </span>
            </div>
          )}
          {order.status === "OVERDUE" && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-xs">
              <span>⏰</span>
              <span className="font-medium text-red-700">Заказ просрочен — требуется действие</span>
            </div>
          )}
          <div className="mt-4 flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
            {LIFECYCLE.map((stage, i) => (
              <div key={stage} className="flex items-center gap-1 shrink-0">
                <div className={`flex flex-col items-center gap-1 min-w-[64px]`}>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[8px] font-bold ${
                      i <= stageIndex ? "bg-primary border-primary text-white" : "border-[var(--admin-border)] text-[var(--admin-muted)]"
                    }`}
                  >
                    {i <= stageIndex ? "✓" : ""}
                  </div>
                  <span className={`text-[9px] leading-tight text-center ${i <= stageIndex ? "text-primary font-medium" : "text-[var(--admin-muted)]"}`}>
                    {stage}
                  </span>
                </div>
                {i < LIFECYCLE.length - 1 && <div className={`h-0.5 w-4 rounded ${i < stageIndex ? "bg-primary" : "bg-[var(--admin-border)]"}`} />}
              </div>
            ))}
          </div>

          {/* Время цикла (Гл. 6.9): длительность завершённого цикла или сколько
              текущий этап уже в работе — видно, где заявка задерживается. */}
          {!refundedStatus && order.status !== "OVERDUE" && (
            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[var(--admin-muted)] px-0.5">
              {terminal ? (
                <>
                  <span>🕒 Цикл завершён</span>
                  {/* Считаем по журналу (как в «Истории»); до загрузки журнала — по полям заказа */}
                  <b>
                    {cycle.totalMs > 0
                      ? fmtDurationShort(cycle.totalMs)
                      : fmtDurationShort(new Date(order.updatedAt).getTime() - new Date(order.createdAt).getTime())}
                  </b>
                </>
              ) : (
                <>
                  <span>Текущий этап «{STATUS_LABELS[order.status] ?? order.status}» · идёт</span>
                  <b>{fmtDurationShort(Math.max(0, nowTs - new Date(order.updatedAt).getTime()))}</b>
                </>
              )}
            </div>
          )}

          {/* Вкладки */}
          <div className="mt-3 flex gap-1 overflow-x-auto no-scrollbar pb-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  if (t.key === "messages" && unreadMessages > 0) void markMessagesRead();
                }}
                className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  tab === t.key ? "bg-primary text-white" : "text-[var(--admin-muted)] hover:bg-[var(--admin-bg)]"
                }`}
              >
                {t.label}
                {t.key === "messages" && unreadMessages > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold">
                    {unreadMessages}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {tab === "overview" && (
            <div className="space-y-4">
              <InfoBlock title="Общая информация">
                <InfoRow k="Номер заказа" v={order.orderNumber} />
                <InfoRow k="Создано" v={fmtDateTime(order.createdAt)} />
                <InfoRow k="Последнее изменение" v={fmtDateTime(order.updatedAt)} />
                <InfoRow k="Менеджер" v={order.manager} />
                <InfoRow k="Источник" v={order.source} />
                <InfoRow k="Состав" v={`${order.bookingsCount} бронь · ${order.servicesCount} услуга`} />
              </InfoBlock>
              <InfoBlock title="Финансы">
                <InfoRow k="Стоимость заказа" v={`${fmtMoney(order.amount)} · ${order.currency}`} bold />
                <InfoRow k="Оплачено" v={fmtMoney(order.paidAmount)} />
                <InfoRow k="Остаток" v={fmtMoney(Math.max(0, order.amount - order.paidAmount))} />
                <InfoRow k="Комиссия (12%)" v={fmtMoney(order.paidAmount * 0.12)} />
              </InfoBlock>
              <div className="flex gap-2">
                <button
                  onClick={() => onAction("confirm")}
                  disabled={busy || !["AWAITING_CONFIRMATION", "PROCESSING"].includes(order.status)}
                  className={`flex-1 h-10 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    acting === "confirm" ? "bg-primary-dark" : "bg-primary hover:bg-primary-dark"
                  }`}
                >
                  {acting === "confirm" ? "Подтверждаем…" : "Подтвердить"}
                </button>
                <button
                  onClick={() => onAction("pay")}
                  disabled={busy || !["CONFIRMED", "AWAITING_PAYMENT", "PARTIALLY_PAID"].includes(order.status)}
                  className={`flex-1 h-10 rounded-xl border text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    acting === "pay"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-[var(--admin-border)] text-[var(--admin-muted)] hover:bg-[var(--admin-bg)]"
                  }`}
                >
                  {acting === "pay" ? "Принимаем оплату…" : "Принять оплату"}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onAction("complete")}
                  disabled={busy || !["PAID", "DOCUMENT_PREP", "READY"].includes(order.status)}
                  className="flex-1 h-10 rounded-xl border border-[var(--admin-border)] text-[var(--admin-muted)] text-sm font-medium hover:bg-[var(--admin-bg)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Завершить заказ
                </button>
                <button
                  onClick={() => onAction("refund")}
                  disabled={busy || !["PAID", "PARTIALLY_PAID", "DOCUMENT_PREP", "READY", "AWAITING_PAYMENT"].includes(order.status)}
                  className="flex-1 h-10 rounded-xl border border-orange-200 text-orange-600 text-sm font-medium hover:bg-orange-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Оформить возврат
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onAction("cancel")}
                  disabled={busy || terminal}
                  className="flex-1 h-10 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Отменить
                </button>
                <button
                  onClick={() => onAction("archive")}
                  disabled={busy || !["COMPLETED", "CANCELLED", "REFUNDED"].includes(order.status)}
                  className="flex-1 h-10 rounded-xl border border-[var(--admin-border)] text-[var(--admin-muted)] text-sm font-medium hover:bg-[var(--admin-bg)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Архивировать
                </button>
              </div>
              <button
                onClick={onEdit}
                disabled={busy || terminal}
                className="w-full h-10 rounded-xl border border-violet-200 text-violet-600 text-sm font-medium hover:bg-violet-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ✏️ Изменить даты и сумму
              </button>
            </div>
          )}
          {tab === "client" && (
            <InfoBlock title="Клиент">
              <InfoRow k="Имя" v={order.client} />
              <InfoRow k="Тип" v="Физическое лицо" />
              <InfoRow k="Статус" v="Постоянный клиент" />
              <InfoRow k="История" v="5 заказов · 4 завершено" />
            </InfoBlock>
          )}
          {tab === "bookings" && (
            <InfoBlock title="Бронирования в составе заказа">
              <div className="space-y-2.5 text-sm">
                {[1, 2, 3].slice(0, Math.max(1, order.bookingsCount)).map((i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--admin-card)] border border-[var(--admin-border)] p-3">
                    <div>
                      <div className="font-medium text-[var(--admin-text)] text-xs">{order.service}</div>
                      <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">{order.category} · {order.serviceDate ? fmtDate(order.serviceDate) : "—"}</div>
                    </div>
                    <Badge label={STATUS_LABELS[order.bookingStatus] ?? order.bookingStatus} className={STATUS_STYLES[order.bookingStatus]} />
                  </div>
                ))}
              </div>
            </InfoBlock>
          )}
          {tab === "services" && (
            <InfoBlock title="Услуги">
              <InfoRow k="Основная услуга" v={order.service} />
              <InfoRow k="Категория" v={order.category} />
              <InfoRow k="Дата поездки" v={order.serviceDate ? fmtDate(order.serviceDate) : "—"} />
              <InfoRow k="Количество позиций" v={String(order.bookingsCount)} />
            </InfoBlock>
          )}
          {tab === "partners" && (
            <InfoBlock title="Партнёр / Поставщик">
              <InfoRow k="Поставщик" v={order.provider} />
              <InfoRow k="Партнёр" v={order.partner} />
              <InfoRow k="Рейтинг" v="★★★★☆ 4.2" />
              <InfoRow k="SLA" v="Ответ ≤ 12 ч" />
            </InfoBlock>
          )}
          {tab === "finances" && (
            <InfoBlock title="Финансовые показатели">
              <InfoRow k="Сумма заказа" v={fmtMoney(order.amount)} bold />
              <InfoRow k="Оплачено" v={fmtMoney(order.paidAmount)} />
              <InfoRow k="Остаток" v={fmtMoney(Math.max(0, order.amount - order.paidAmount))} />
              <InfoRow k="Комиссия (12%)" v={fmtMoney(order.paidAmount * 0.12)} />
              <InfoRow k="Выплаты партнёру" v={fmtMoney(order.paidAmount * 0.88)} />
            </InfoBlock>
          )}
          {tab === "payments" && (
            <InfoBlock title="Платежи">
              <InfoRow k="Сумма" v={fmtMoney(order.amount)} />
              <InfoRow k="Оплачено" v={fmtMoney(order.paidAmount)} />
              <InfoRow
                k="Статус оплаты"
                v={<Badge label={PAY_LABELS[order.paymentStatus] ?? order.paymentStatus} className={PAY_STYLES[order.paymentStatus]} />}
              />
              <InfoRow k="Способ" v={order.paymentStatus === "paid" ? "Банковская карта" : "Ожидание"} />
            </InfoBlock>
          )}
          {tab === "documents" && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[var(--admin-muted)] uppercase mb-2">Документы</h3>
              {["Ваучер", "Договор оферты", "Чек об оплате"].map((d, i) => (
                <div key={d} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--admin-bg)] text-sm">
                  <span className="text-base">{i === 0 ? "🎫" : i === 1 ? "📄" : "🧾"}</span>
                  <span className="flex-1 text-[var(--admin-text)]">{d}</span>
                  <span className="text-[var(--admin-muted)] text-xs">{order.paymentStatus === "paid" ? "Готов" : "—"}</span>
                </div>
              ))}
            </div>
          )}
          {tab === "history" && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[var(--admin-muted)] uppercase">История изменений</h3>
              {historyLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <SkeletonBlock key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : historyError ? (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">⚠️ {historyError}</div>
              ) : !history.length ? (
                <div className="text-xs text-[var(--admin-muted)] bg-[var(--admin-bg)] rounded-xl p-4 text-center">Журнал пуст</div>
              ) : (
                <div className="space-y-3">
                  {/* Сводка цикла: общая длительность, узкое место, текущий этап */}
                  {cycle.totalMs > 0 && (
                    <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-[var(--admin-muted)]">
                          {cycle.terminal ? "🕒 Полный цикл обработки" : "🕒 В обработке с момента создания"}
                        </span>
                        <b>{fmtDurationShort(cycle.totalMs)}</b>
                      </div>
                      {cycle.slowestDur > 0 && cycle.totalMs > 0 && (() => {
                        const label = cycle.currentIsSlowest
                          ? `Текущий этап «${STATUS_LABELS[order.status] ?? order.status}»`
                          : (HISTORY_META[history[cycle.slowestIdx].action]?.label ?? history[cycle.slowestIdx].action);
                        const bottleneckText = `Узкое место: ${label} — ${fmtDurationShort(cycle.slowestDur)} (${Math.round((cycle.slowestDur / cycle.totalMs) * 100)}% цикла)`;
                        return (
                          <div className="flex items-center gap-1.5 text-[11px] text-danger font-medium">
                            <span>⚠️</span>
                            <span className="truncate" title={bottleneckText}>
                              {bottleneckText}
                            </span>
                          </div>
                        );
                      })()}
                      {!cycle.terminal && cycle.currentStageMs > 0 && (
                        <div className="text-[11px] text-[var(--admin-muted)]">Текущий этап идёт {fmtDurationShort(cycle.currentStageMs)}</div>
                      )}
                    </div>
                  )}
                  <div className="relative">
                  {history.map((h, i) => {
                    const meta = HISTORY_META[h.action] ?? { icon: "📝", label: h.action };
                    const isNewest = i === 0;
                    const title = h.action === "update" && h.fields ? formatHistoryFields(h.fields) : meta.label;
                    const statusLine =
                      h.from && h.to ? `${STATUS_LABELS[h.from] ?? h.from} → ${STATUS_LABELS[h.to] ?? h.to}` : null;
                    return (
                      <div key={h.id} className="flex gap-3 text-sm relative pb-4 last:pb-0">
                        {i < history.length - 1 && (
                          <div className="absolute left-[7px] top-5 bottom-0 w-px bg-[var(--admin-border)]" />
                        )}
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5 ${
                            isNewest ? "bg-primary text-white" : "bg-[var(--admin-border)]"
                          }`}
                        >
                          {isNewest ? "✓" : ""}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[var(--admin-text)] font-medium">
                              <span className="mr-1">{meta.icon}</span>
                              {title}
                            </span>
                            {h.to && <Badge label={STATUS_LABELS[h.to] ?? h.to} className={STATUS_STYLES[h.to] ?? ""} />}
                          </div>
                          {statusLine && <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">{statusLine}</div>}
                          {h.comment && <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">{h.comment}</div>}
                          <div className="text-[10px] text-[var(--admin-muted)] mt-1">
                            {fmtDateTime(h.createdAt)} · {h.actorName}
                            {cycle.durations[i] > 0 && (
                              <span className={i === cycle.slowestIdx ? "text-danger font-semibold" : ""}>
                                {" · "}⏱ {fmtDurationShort(cycle.durations[i])}
                                {i === cycle.slowestIdx && " ⚠️"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}
            </div>
          )}
          {tab === "messages" && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-[var(--admin-muted)] uppercase">Коммуникации</h3>
              <div className="bg-[var(--admin-bg)] rounded-xl p-3 h-[340px] overflow-y-auto space-y-2.5">
                {messagesLoading ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <SkeletonBlock key={i} className="h-10 w-2/3" />
                    ))}
                  </div>
                ) : messagesError ? (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">⚠️ {messagesError}</div>
                ) : !messages.length ? (
                  <div className="text-xs text-[var(--admin-muted)] text-center py-8">Переписка пуста — напишите первое сообщение</div>
                ) : (
                  messages.map((m) => {
                    const isManager = m.senderRole === "manager";
                    const isSystem = m.senderRole === "system";
                    if (isSystem) {
                      return (
                        <div key={m.id} className="text-center text-[10px] text-[var(--admin-muted)] py-1">
                          {m.text} · {fmtDateTime(m.createdAt)}
                        </div>
                      );
                    }
                    return (
                      <div key={m.id} className={`flex ${isManager ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`px-3 py-2 rounded-2xl text-xs max-w-[85%] shadow-sm ${
                            isManager ? "bg-primary text-white rounded-br-md" : "bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-bl-md"
                          }`}
                        >
                          <div className={`text-[10px] mb-0.5 ${isManager ? "text-white/70" : "text-[var(--admin-muted)]"}`}>
                            {m.senderName} · {fmtDateTime(m.createdAt)}
                          </div>
                          {m.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {QUICK_REPLIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => setMessageText(q)}
                    className="px-2 py-1 rounded-lg bg-[var(--admin-bg)] border border-[var(--admin-border)] text-[10px] text-[var(--admin-muted)] hover:border-primary hover:text-primary transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage(messageText);
                      }
                    }}
                    rows={2}
                    placeholder="Сообщение… (Enter — отправить)"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors resize-none"
                  />
                  <label className="flex items-center gap-1.5 mt-1.5 text-[10px] text-[var(--admin-muted)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sendAsClient}
                      onChange={(e) => setSendAsClient(e.target.checked)}
                      className="accent-[var(--primary)] w-3.5 h-3.5 cursor-pointer"
                    />
                    Отправить от имени клиента (демо)
                  </label>
                </div>
                <button
                  onClick={() => void sendMessage(messageText)}
                  disabled={messageSending || !messageText.trim()}
                  className="h-10 px-4 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {messageSending ? "…" : "➤"}
                </button>
              </div>
            </div>
          )}
          {tab === "related" && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[var(--admin-muted)] uppercase mb-2">Связанные объекты</h3>
              <div className="space-y-2">
                {[
                  { icon: "↩️", label: "Возвраты", value: order.status === "REFUNDED" ? "1 возврат оформлен" : "Возвратов нет" },
                  { icon: "🎟", label: "Промокоды", value: "—" },
                  { icon: "🎧", label: "Обращения в поддержку", value: "—" },
                  { icon: "🧾", label: "Счета", value: order.paymentStatus === "paid" ? "Счёт №INV-" + order.orderNumber.replace("ORD-", "") : "Счёт не выставлен" },
                  { icon: "📄", label: "Документы", value: order.paymentStatus === "paid" ? "Ваучер · Договор · Чек" : "—" },
                  { icon: "⭐", label: "Отзывы", value: order.status === "COMPLETED" ? "Клиент оставил отзыв 5/5" : "Отзыв после поездки" },
                ].map((r) => (
                  <div key={r.label} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--admin-bg)] text-sm">
                    <span className="text-base">{r.icon}</span>
                    <span className="flex-1 text-[var(--admin-text)] text-xs font-medium">{r.label}</span>
                    <span className="text-[var(--admin-muted)] text-xs">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === "ai" && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[var(--admin-muted)] uppercase mb-2">AI-анализ</h3>
              <div className="bg-gradient-to-br from-fuchsia-500 to-pink-500 rounded-xl p-4 text-white text-sm space-y-2">
                <p>🛡️ <b>Риск отмены:</b> {order.paymentStatus === "pending" ? "средний (18%) — заказ не оплачен в течение 24 ч" : "низкий (3%)"}</p>
                <p>⏱️ <b>Рекомендация:</b> {order.paymentStatus === "pending" ? "напомнить клиенту об оплате" : "отправить документы и чек клиенту"}</p>
              </div>
              {["Почему этот заказ в зоне риска?", "Спрогнозируй вероятность отмены", "Что сделать, чтобы удержать клиента?"].map((q) => (
                <button key={q} className="w-full text-left px-3 py-2 rounded-xl bg-[var(--admin-bg)] hover:bg-primary/10 hover:text-primary transition-colors text-xs text-[var(--admin-muted)]">
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--admin-bg)] rounded-xl p-4">
      <h3 className="text-xs font-semibold text-[var(--admin-muted)] uppercase mb-3">{title}</h3>
      <div className="space-y-2.5 text-sm">{children}</div>
    </div>
  );
}

function InfoRow({ k, v, bold }: { k: string; v: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[var(--admin-muted)] text-xs shrink-0">{k}</span>
      <span className={`text-right text-[var(--admin-text)] text-xs ${bold ? "font-bold" : "font-medium"}`}>{v}</span>
    </div>
  );
}

/* ─── Модальное окно создания заказа (Гл. 6.4 «Создать заказ») ─── */
function CreateOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: (msg: string) => void }) {
  const [clients, setClients] = useState<{ id: string; name: string; email: string }[]>([]);
  const [services, setServices] = useState<{ id: string; type: string; category: string; title: string; price: number; currency: string; direction: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/orders?mode=form");
        if (!res.ok) throw new Error(await describeApiError(res, "Ошибка загрузки справочников"));
        const json = await res.json();
        if (!cancelled) {
          setClients(json.clients ?? []);
          setServices(json.services ?? []);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Неизвестная ошибка");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedService = services.find((s) => s.id === serviceId);
  const filteredServices = categoryFilter ? services.filter((s) => s.type === categoryFilter) : services;
  const categories = [...new Set(services.map((s) => s.type))];

  const [minDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });

  const handleServiceChange = (id: string) => {
    setServiceId(id);
    const svc = services.find((s) => s.id === id);
    if (svc) setAmount(String(Math.round(svc.price * 100) / 100));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!clientId || !serviceId || !serviceDate) {
      setError("Заполните клиента, услугу и дату поездки");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: clientId,
          serviceId,
          serviceDate: new Date(`${serviceDate}T12:00:00`).toISOString(),
          amount: amount ? parseFloat(amount) : undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.detail ?? json?.error ?? "Не удалось создать заказ");
        return;
      }
      onCreated(json?.message ?? "Заказ создан");
    } catch {
      setError("Ошибка сети");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--admin-border)] flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[var(--admin-text)]">➕ Создать заказ</h2>
            <p className="text-xs text-[var(--admin-muted)] mt-0.5">Заказ создаётся со статусом «Ожидает подтверждения» и первой бронированием</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-[var(--admin-bg)] flex items-center justify-center text-[var(--admin-muted)] transition-colors">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div>
                <label className="text-[11px] font-medium text-[var(--admin-muted)] mb-1.5 block">Клиент *</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] text-sm text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
                >
                  <option value="">Выберите клиента…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-[var(--admin-muted)] mb-1.5 block">Категория</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setCategoryFilter("")}
                    className={`px-2.5 h-7 rounded-lg text-[11px] font-medium transition-colors ${categoryFilter === "" ? "bg-primary text-white" : "bg-[var(--admin-bg)] text-[var(--admin-muted)] hover:text-primary"}`}
                  >
                    Все
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-2.5 h-7 rounded-lg text-[11px] font-medium transition-colors ${categoryFilter === cat ? "bg-primary text-white" : "bg-[var(--admin-bg)] text-[var(--admin-muted)] hover:text-primary"}`}
                    >
                      {SERVICE_TYPES.find((t) => t.key === cat)?.label ?? cat}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-[var(--admin-muted)] mb-1.5 block">Услуга *</label>
                <select
                  value={serviceId}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] text-sm text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
                >
                  <option value="">Выберите услугу…</option>
                  {filteredServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} · {s.direction} · {s.price} {s.currency}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-[var(--admin-muted)] mb-1.5 block">Дата поездки *</label>
                  <input
                    type="date"
                    min={minDate}
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] text-sm text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--admin-muted)] mb-1.5 block">Сумма, USD</label>
                  <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Цена услуги (авто)"
                    className="w-full h-10 px-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] text-sm text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              {selectedService && (
                <div className="bg-[var(--admin-bg)] rounded-xl p-3 text-xs text-[var(--admin-muted)]">
                  <b className="text-[var(--admin-text)]">{selectedService.category}</b> · {selectedService.direction} ·
                  базовая цена {selectedService.price} {selectedService.currency}
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-600">⚠️ {error}</div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[var(--admin-border)] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 h-10 rounded-xl border border-[var(--admin-border)] text-[var(--admin-muted)] text-sm font-medium hover:bg-[var(--admin-bg)] transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting || loading || !clientId || !serviceId || !serviceDate}
            className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Создаём…" : "Создать заказ"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Модальное окно редактирования заказа (Гл. 6.4 «Изменить заказ») ─── */
function EditOrderModal({ order, onClose, onSaved }: { order: OrderRow; onClose: () => void; onSaved: (msg: string, updated: OrderRow) => void }) {
  const [serviceDate, setServiceDate] = useState(() => (order.serviceDate ? order.serviceDate.slice(0, 10) : ""));
  const [amount, setAmount] = useState(String(order.amount));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [minDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrow = d.toISOString().slice(0, 10);
    const current = order.serviceDate ? order.serviceDate.slice(0, 10) : tomorrow;
    return current < tomorrow ? current : tomorrow;
  });

  const handleSave = async () => {
    setError(null);
    const currentDate = order.serviceDate ? order.serviceDate.slice(0, 10) : "";
    const dateChanged = serviceDate !== currentDate;
    const newAmount = parseFloat(amount);
    const amountChanged = newAmount !== order.amount;
    if (!dateChanged && !amountChanged) {
      setError("Нет изменений — обновите дату или сумму");
      return;
    }
    if (isNaN(newAmount) || newAmount <= 0) {
      setError("Укажите сумму больше нуля");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          serviceDate: dateChanged ? new Date(`${serviceDate}T12:00:00`).toISOString() : undefined,
          amount: amountChanged ? newAmount : undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.detail ?? json?.error ?? "Не удалось сохранить изменения");
        return;
      }
      onSaved(json?.message ?? "Заказ изменён", json?.order);
    } catch {
      setError("Ошибка сети");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--admin-border)] flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[var(--admin-text)]">✏️ Изменить заказ</h2>
            <p className="text-xs text-[var(--admin-muted)] mt-0.5">{order.orderNumber} · {order.client}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-[var(--admin-bg)] flex items-center justify-center text-[var(--admin-muted)] transition-colors">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-[var(--admin-bg)] rounded-xl p-3 text-xs text-[var(--admin-muted)]">
            <b className="text-[var(--admin-text)]">{order.service}</b>
            <div className="mt-0.5">{order.category} · {order.bookingsCount} бронь</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[var(--admin-muted)] mb-1.5 block">Дата поездки</label>
              <input
                type="date"
                min={minDate}
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] text-sm text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--admin-muted)] mb-1.5 block">Сумма, {order.currency}</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] text-sm text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-600">⚠️ {error}</div>}
        </div>

        <div className="px-5 py-4 border-t border-[var(--admin-border)] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 h-10 rounded-xl border border-[var(--admin-border)] text-[var(--admin-muted)] text-sm font-medium hover:bg-[var(--admin-bg)] transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={submitting}
            className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Модальное окно массового изменения / назначения менеджера (Заказ.docx, Гл. 5.5) ─── */
function BulkActionModal({
  mode,
  count,
  managers,
  onClose,
  onApply,
}: {
  mode: "edit" | "manager";
  count: number;
  managers: string[];
  onClose: () => void;
  onApply: (payload: { action: string; value?: string }) => Promise<void>;
}) {
  const [manager, setManager] = useState("");
  const [bulkAction, setBulkAction] = useState("confirm");
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    if (mode === "manager" && !manager) return;
    setApplying(true);
    try {
      await onApply(mode === "manager" ? { action: "assign_manager", value: manager } : { action: bulkAction });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--admin-border)] flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[var(--admin-text)]">
              {mode === "manager" ? "👤 Назначить менеджера" : "✏️ Массовое изменение"}
            </h2>
            <p className="text-xs text-[var(--admin-muted)] mt-0.5">Выбрано заказов: {count}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-[var(--admin-bg)] flex items-center justify-center text-[var(--admin-muted)] transition-colors">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {mode === "manager" ? (
            <div>
              <label className="text-[11px] font-medium text-[var(--admin-muted)] mb-1.5 block">Менеджер *</label>
              <select
                value={manager}
                onChange={(e) => setManager(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] text-sm text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
              >
                <option value="">Выберите менеджера…</option>
                {managers.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <p className="text-[10px] text-[var(--admin-muted)] mt-2">Назначение фиксируется в журнале истории каждого заказа.</p>
            </div>
          ) : (
            <div>
              <label className="text-[11px] font-medium text-[var(--admin-muted)] mb-1.5 block">Действие *</label>
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] text-sm text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
              >
                <option value="confirm">✅ Подтвердить</option>
                <option value="pay">💳 Отметить оплаченными</option>
                <option value="complete">🏁 Завершить</option>
                <option value="cancel">❌ Отменить</option>
                <option value="archive">📦 Архивировать</option>
              </select>
              <p className="text-[10px] text-[var(--admin-muted)] mt-2">Действие применится к заказам, для которых переход допустим по жизненному циклу.</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[var(--admin-border)] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 h-10 rounded-xl border border-[var(--admin-border)] text-[var(--admin-muted)] text-sm font-medium hover:bg-[var(--admin-bg)] transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={() => void handleApply()}
            disabled={applying || (mode === "manager" && !manager)}
            className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {applying ? "Применяем…" : "Применить"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Главный компонент: Order Center (Заказ.docx, Гл. 5) ─── */
export default function OrderCenter() {
  const [data, setData] = useState<OrdersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState("month");
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortUnread, setSortUnread] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [chartMode, setChartMode] = useState<"line" | "bar" | "area">("line");
  const [aiOpen, setAiOpen] = useState(false);
  const [savedFilters, setSavedFilters] = useState<string[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<OrderRow | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRunning, setBulkRunning] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState<"edit" | "manager" | null>(null);
  const [orderSidebarInitialTab, setOrderSidebarInitialTab] = useState<string>("overview");
  // Переход из виджета «Мои задачи» Dashboard: ?open=<id>&tab=<вкладка>
  const [urlOpenId, setUrlOpenId] = useState<string | null>(null);
  const [urlOpenTab, setUrlOpenTab] = useState("overview");
  // Глубокая ссылка из Dashboard (KPI, задачи, AI-центр): после загрузки данных
  // прокручиваем страницу к таблице заказов, чтобы фокус был на нужном месте.
  const tableSectionRef = useRef<HTMLDivElement | null>(null);
  const [deepLinkArrived, setDeepLinkArrived] = useState(false);
  const scrolledToTableRef = useRef(false);

  // Фильтры (Гл. 6.6). Статус из URL (?status=...) применяется после монтирования,
  // чтобы не расходился серверный и клиентский первый рендер (безопасно для гидратации).
  const [filters, setFilters] = useState({
    country: "",
    city: "",
    type: "",
    status: "",
    bookingStatus: "",
    paymentStatus: "",
    manager: "",
    source: "",
    currency: "",
    minPrice: "",
    maxPrice: "",
    needsAttention: false,
  });

  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  const [countryCities, setCountryCities] = useState<string[]>([]);
  const cityReqSeq = useRef(0);

  // KPI-карточки Dashboard ведут на /admin/orders?status=... — применяем фильтр из URL.
  // Канонический паттерн «adjust state during render» (как в FilterSidebar):
  // сравнение через state вместо ref, без нарушения правил react-hooks.
  const [urlFilterApplied, setUrlFilterApplied] = useState(false);
  if (!urlFilterApplied && typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status") ?? "";
    const bookingStatus = params.get("bookingStatus") ?? "";
    // Период из URL (?period=today) — карточки Dashboard ведут сюда с нужным окном,
    // чтобы число на карточке совпадало с записями в таблице реестра.
    const urlPeriod = params.get("period");
    // Открыть конкретный заказ из «Моих задач» (?open=<id>&tab=<вкладка>)
    const urlOpen = params.get("open");
    if (status || bookingStatus || urlPeriod || urlOpen) {
      setFilters((prev) => ({ ...prev, status, bookingStatus }));
      if (urlPeriod === "today" || urlPeriod === "week" || urlPeriod === "month" || urlPeriod === "quarter" || urlPeriod === "year" || urlPeriod === "yesterday") {
        setPeriod(urlPeriod);
      }
      if (urlOpen) {
        setUrlOpenId(urlOpen);
        setUrlOpenTab(params.get("tab") ?? "overview");
      }
      setDeepLinkArrived(true);
      setUrlFilterApplied(true);
    }
  }

  // Автопрокрутка к таблице после загрузки данных по глубокой ссылке (Гл. 6.8).
  // Флаг-состояние ставится во время рендера, а ref «уже прокручено» пишется
  // только в эффекте — это единственный раз, когда мы трогаем DOM.
  useEffect(() => {
    if (deepLinkArrived && !scrolledToTableRef.current && data && !loading) {
      scrolledToTableRef.current = true;
      tableSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [deepLinkArrived, data, loading]);

  // Карточка заказа из «Моих задач»: подтягиваем заказ по id и открываем боковую
  // панель с нужной вкладкой (для «Добить оплату» — «Оплата», для «Подтвердить» — «Обзор»).
  useEffect(() => {
    if (!urlOpenId) return;
    let cancelled = false;
    void Promise.resolve().then(async () => {
      try {
        const res = await fetch(`/api/admin/orders/${urlOpenId}`);
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled || !json?.order) return;
        const o = json.order;
        setSelectedOrder({
          id: o.id,
          orderNumber: o.orderNumber,
          client: o.client,
          partner: o.partner ?? "—",
          provider: o.provider ?? "—",
          service: o.service ?? "—",
          category: o.category ?? "—",
          categoryType: o.categoryType ?? "",
          servicesCount: o.servicesCount ?? 1,
          bookingsCount: o.bookingsCount ?? 1,
          amount: o.amount ?? 0,
          paidAmount: o.paidAmount ?? 0,
          commission: o.commission ?? Math.round((o.paidAmount ?? 0) * 0.12),
          currency: o.currency ?? "USD",
          status: o.status,
          bookingStatus: o.bookingStatus ?? "",
          paymentStatus: o.paymentStatus ?? "pending",
          manager: o.manager ?? "—",
          source: o.source ?? "—",
          unreadCount: 0,
          createdAt: o.createdAt,
          serviceDate: o.serviceDate ?? null,
          updatedAt: o.updatedAt,
        });
        setOrderSidebarInitialTab(urlOpenTab);
      } catch {
        /* карточка не откроется, но страница реестра останется рабочей */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [urlOpenId, urlOpenTab]);

  const fetchData = useCallback(async (): Promise<OrdersData | null> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("period", period);
      params.set("page", page.toString());
      params.set("limit", "15");
      if (filters.country) params.set("country", filters.country);
      if (filters.city) params.set("city", filters.city);
      if (filters.type) params.set("type", filters.type);
      if (filters.status) params.set("status", filters.status);
      if (filters.bookingStatus) params.set("bookingStatus", filters.bookingStatus);
      if (filters.paymentStatus) params.set("paymentStatus", filters.paymentStatus);
      if (filters.manager) params.set("manager", filters.manager);
      if (filters.source) params.set("source", filters.source);
      if (filters.currency) params.set("currency", filters.currency);
      if (filters.minPrice) params.set("minPrice", filters.minPrice);
      if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
      if (filters.needsAttention) params.set("needsAttention", "1");
      if (sortUnread) params.set("sort", "unread");

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      if (!res.ok) throw new Error(await describeApiError(res, "Ошибка загрузки данных"));
      const json: unknown = await res.json();
      // Защита от неполного/устаревшего ответа: невалидный ответ не попадает в состояние
      const requiredKeys = [
        "kpi",
        "funnel",
        "ordersSeries",
        "confirmSeries",
        "bookingsByService",
        "bookingsByCountry",
        "heatmap",
        "financial",
        "statusCounts",
        "recentOrders",
        "problemOrders",
        "pendingPayments",
        "refunds",
        "upcomingTrips",
        "aiRecommendations",
        "sla",
        "managers",
        "orders",
        "pagination",
      ];
      if (typeof json !== "object" || json === null || requiredKeys.some((k) => !(k in json))) {
        throw new Error("Некорректный ответ сервера — обновите страницу");
      }
      return json as OrdersData;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
      return null;
    } finally {
      setLoading(false);
    }
  }, [period, page, filters, sortUnread]);

  // ── Справочник стран ──
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      try {
        const res = await fetch("/api/countries");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setCountries(json.countries ?? []);
      } catch {
        /* не критично */
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Каскад «Страна → Город» (Гл. 6.6): смена страны сбрасывает город и
  // подгружает города выбранной страны из БД.
  const handleCountryChange = (code: string) => {
    setFilters((prev) => ({ ...prev, country: code, city: "" }));
    setPage(1);
    const seq = ++cityReqSeq.current;
    if (code) {
      setCountryCities([]);
      void fetch(`/api/cities?countries=${encodeURIComponent(code)}`)
        .then((res) => (res.ok ? res.json() : { cities: [] }))
        .then((json) => {
          if (seq === cityReqSeq.current) {
            setCountryCities(((json.cities ?? []) as { name: string }[]).map((c) => c.name));
          }
        })
        .catch(() => {
          if (seq === cityReqSeq.current) setCountryCities([]);
        });
    } else {
      setCountryCities([]);
    }
  };

  // ── Загрузка данных: применяем только ответ последнего запроса ──
  const requestSeq = useRef(0);
  useEffect(() => {
    const seq = ++requestSeq.current;
    void Promise.resolve()
      .then(fetchData)
      .then((res) => {
        if (seq === requestSeq.current && res) setData(res);
      });
  }, [fetchData]);

  // ── Действия с заказом (PATCH /api/admin/orders/[id]) ──
  const runOrderAction = useCallback(
    async (id: string, action: "confirm" | "pay" | "complete" | "cancel" | "refund" | "archive") => {
      setActing(action);
      setActionMsg(null);
      try {
        const res = await fetch(`/api/admin/orders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setActionMsg({ ok: false, text: json?.detail ?? json?.error ?? "Не удалось выполнить действие" });
          return false;
        }
        setActionMsg({ ok: true, text: json?.message ?? "Готово" });
        setHistoryVersion((v) => v + 1);
        const fresh = await fetchData();
        if (fresh) setData(fresh);
        if (json?.order?.status) {
          setSelectedOrder((prev) =>
            prev?.id === id
              ? {
                  ...prev,
                  status: json.order.status as string,
                  paymentStatus:
                    ["PAID", "DOCUMENT_PREP", "READY", "COMPLETED"].includes(json.order.status as string)
                      ? "paid"
                      : json.order.status === "PARTIALLY_PAID"
                      ? "partially"
                      : json.order.status === "REFUNDED" || json.order.status === "CANCELLED"
                      ? "refunded"
                      : "pending",
                  paidAmount: typeof json.order.paidAmount === "number" ? json.order.paidAmount : prev.paidAmount,
                  updatedAt: json.order.updatedAt,
                }
              : prev
          );
        }
        return true;
      } catch {
        setActionMsg({ ok: false, text: "Ошибка сети" });
        return false;
      } finally {
        setActing(null);
      }
    },
    [fetchData]
  );

  const resetFilters = () => {
    setFilters({ country: "", city: "", type: "", status: "", bookingStatus: "", paymentStatus: "", manager: "", source: "", currency: "", minPrice: "", maxPrice: "", needsAttention: false });
    setPage(1);
  };

  const saveFilter = () => {
    const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "Период";
    const statusLabel = filters.status
      ? STATUS_LABELS[filters.status] ?? ORDER_STATUSES.find((o) => o.key === filters.status)?.label ?? filters.status
      : "все статусы";
    const attentionLabel = filters.needsAttention ? " · 💬 требует внимания" : "";
    const label = `${periodLabel} · ${statusLabel}${attentionLabel}`;
    if (!savedFilters.includes(label)) setSavedFilters([...savedFilters, label]);
  };

  const toggleStatusFilter = (status: string) => {
    setFilters((prev) => ({ ...prev, status: prev.status === status ? "" : status }));
    setPage(1);
  };

  // ── KPI-карточки (Заказ.docx, Гл. 5.4): 12 показателей ──
  const kpiCards: {
    title: string;
    value: string;
    change: string;
    changeType: "up" | "down" | "neutral";
    subtitle: string;
    icon: string;
    color: string;
    onClick?: () => void;
    active?: boolean;
    activeHint?: string;
    progress?: { pct: number };
  }[] = data
    ? [
        {
          title: "Всего заказов",
          value: String(data.kpi.totalOrders.value),
          change: `${data.kpi.totalOrders.change >= 0 ? "+" : ""}${data.kpi.totalOrders.change.toFixed(0)}%`,
          changeType: data.kpi.totalOrders.change >= 0 ? "up" : "down",
          subtitle: data.kpi.totalOrders.detail,
          icon: "📦",
          color: "from-slate-600 to-slate-800",
        },
        {
          title: "Новые сегодня",
          value: String(data.kpi.newToday.value),
          change: "",
          changeType: "neutral",
          subtitle: data.kpi.newToday.detail,
          icon: "🆕",
          color: "from-blue-500 to-indigo-500",
        },
        {
          title: "Ожидают обработки",
          value: String(data.kpi.awaitingProcessing.value),
          change: `${data.kpi.awaitingProcessing.change >= 0 ? "+" : ""}${data.kpi.awaitingProcessing.change.toFixed(0)}%`,
          changeType: data.kpi.awaitingProcessing.change >= 0 ? "up" : "down",
          subtitle: data.kpi.awaitingProcessing.detail,
          icon: "⚡",
          color: "from-cyan-500 to-blue-500",
          onClick: () => toggleStatusFilter("DRAFT,CREATED,PROCESSING,AWAITING_CONFIRMATION"),
          active: filters.status === "DRAFT,CREATED,PROCESSING,AWAITING_CONFIRMATION",
        },
        {
          title: "Ожидают оплаты",
          value: String(data.kpi.awaitingPayment.value),
          change: `${data.kpi.awaitingPayment.change >= 0 ? "+" : ""}${data.kpi.awaitingPayment.change.toFixed(0)}%`,
          changeType: data.kpi.awaitingPayment.change > 0 ? "down" : "up",
          subtitle: data.kpi.awaitingPayment.detail,
          icon: "⏳",
          color: "from-amber-500 to-orange-500",
          onClick: () => toggleStatusFilter("AWAITING_PAYMENT,PARTIALLY_PAID,OVERDUE"),
          active: filters.status === "AWAITING_PAYMENT,PARTIALLY_PAID,OVERDUE",
        },
        {
          title: "Оплачены",
          value: String(data.kpi.paidOrders.value),
          change: `${data.kpi.paidOrders.change >= 0 ? "+" : ""}${data.kpi.paidOrders.change.toFixed(0)}%`,
          changeType: data.kpi.paidOrders.change >= 0 ? "up" : "down",
          subtitle: data.kpi.paidOrders.detail,
          icon: "💳",
          color: "from-emerald-500 to-teal-500",
          onClick: () => toggleStatusFilter("PAID,DOCUMENT_PREP,READY,COMPLETED"),
          active: filters.status === "PAID,DOCUMENT_PREP,READY,COMPLETED",
        },
        {
          title: "Требуют подтверждения",
          value: String(data.kpi.awaitingConfirmation.value),
          change: `${data.kpi.awaitingConfirmation.change >= 0 ? "+" : ""}${data.kpi.awaitingConfirmation.change.toFixed(0)}%`,
          changeType: data.kpi.awaitingConfirmation.change >= 0 ? "up" : "down",
          subtitle: data.kpi.awaitingConfirmation.detail,
          icon: "🤝",
          color: "from-violet-500 to-purple-500",
          onClick: () => toggleStatusFilter("AWAITING_CONFIRMATION"),
          active: filters.status === "AWAITING_CONFIRMATION",
        },
        {
          title: "Готовы к оказанию",
          value: String(data.kpi.ready.value),
          change: `${data.kpi.ready.change >= 0 ? "+" : ""}${data.kpi.ready.change.toFixed(0)}%`,
          changeType: data.kpi.ready.change >= 0 ? "up" : "down",
          subtitle: data.kpi.ready.detail,
          icon: "🎒",
          color: "from-teal-500 to-cyan-500",
          onClick: () => toggleStatusFilter("DOCUMENT_PREP,READY"),
          active: filters.status === "DOCUMENT_PREP,READY",
        },
        {
          title: "Выполнены",
          value: String(data.kpi.completed.value),
          change: `${data.kpi.completed.change >= 0 ? "+" : ""}${data.kpi.completed.change.toFixed(0)}%`,
          changeType: data.kpi.completed.change >= 0 ? "up" : "down",
          subtitle: data.kpi.completed.detail,
          icon: "🏁",
          color: "from-green-500 to-emerald-600",
          onClick: () => toggleStatusFilter("COMPLETED"),
          active: filters.status === "COMPLETED",
        },
        {
          title: "Отменены",
          value: String(data.kpi.cancelledOrders.value),
          change: `${data.kpi.cancelledOrders.change >= 0 ? "+" : ""}${data.kpi.cancelledOrders.change.toFixed(0)}%`,
          changeType: data.kpi.cancelledOrders.change > 0 ? "down" : "up",
          subtitle: data.kpi.cancelledOrders.detail,
          icon: "❌",
          color: "from-red-500 to-rose-500",
          onClick: () => toggleStatusFilter("CANCELLED"),
          active: filters.status === "CANCELLED",
        },
        {
          title: "Возвраты",
          value: String(data.kpi.refunds.value),
          change: `${data.kpi.refunds.change >= 0 ? "+" : ""}${data.kpi.refunds.change.toFixed(0)}%`,
          changeType: data.kpi.refunds.change > 0 ? "down" : "up",
          subtitle: data.kpi.refunds.detail,
          icon: "↩️",
          color: "from-orange-500 to-red-500",
          onClick: () => toggleStatusFilter("REFUNDED"),
          active: filters.status === "REFUNDED",
        },
        {
          title: "Средний чек",
          value: fmtMoney(data.kpi.avgCheck.value),
          change: "",
          changeType: "neutral",
          subtitle: data.kpi.avgCheck.detail,
          icon: "🧾",
          color: "from-pink-500 to-rose-500",
        },
        {
          title: "Доход платформы",
          value: fmtMoney(data.kpi.platformRevenue.value),
          change: "",
          changeType: "neutral",
          subtitle: data.kpi.platformRevenue.detail,
          icon: "🏦",
          color: "from-indigo-500 to-blue-600",
        },
      ]
    : [];

  // ── Серии для графиков ──
  const ordersSeriesPoints = useMemo(
    () => (data ? data.ordersSeries.labels.map((l, i) => ({ label: l, value: data.ordersSeries.values[i] })) : []),
    [data]
  );
  // Круговая диаграмма статусов заказов (Гл. 6.7)
  const statusDonutData = useMemo(() => {
    if (!data) return [];
    const len = CHART_COLORS.length;
    return (data.statusCounts ?? [])
      .map((s) => {
        // Отрицательный findIndex (-1) дал бы неопределённый цвет — нормализуем индекс
        const idx = ((ORDER_STATUSES.findIndex((o) => o.key === s.status) % len) + len) % len;
        return { label: STATUS_LABELS[s.status] ?? s.status, value: s.count, color: CHART_COLORS[idx] };
      })
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const serviceDonutData = useMemo(
    () =>
      (data?.bookingsByService ?? []).map((s, i) => ({
        label: s.label,
        value: s.count,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [data]
  );

  // ── Таблица ──
  const visibleOrders = data?.orders ?? [];
  const allVisibleSelected = visibleOrders.length > 0 && visibleOrders.every((b) => selectedIds.includes(b.id));
  const someVisibleSelected = visibleOrders.some((b) => selectedIds.includes(b.id));

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleAllVisible = () => {
    const ids = visibleOrders.map((b) => b.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) => (allSelected ? prev.filter((x) => !ids.includes(x)) : [...new Set([...prev, ...ids])]));
  };
  const clearSelection = () => setSelectedIds([]);

  // ── Массовые действия (Гл. 6.8) ──
  const runBulkAction = async (action: "confirm" | "pay" | "complete" | "cancel" | "archive") => {
    if (!selectedIds.length) return;
    setBulkRunning(action);
    setActionMsg(null);
    try {
      const res = await fetch("/api/admin/orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: selectedIds }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setActionMsg({ ok: false, text: json?.detail ?? json?.error ?? "Не удалось выполнить массовое действие" });
        return;
      }
      setActionMsg({ ok: true, text: json?.message ?? "Готово" });
      setSelectedIds([]);
      setHistoryVersion((v) => v + 1);
      const fresh = await fetchData();
      if (fresh) setData(fresh);
    } catch {
      setActionMsg({ ok: false, text: "Ошибка сети" });
    } finally {
      setBulkRunning(null);
    }
  };

  // ── Экспорт CSV (Заказ.docx, Гл. 5.5 «Экспорт») ──
  const exportCsv = () => {
    if (!data?.orders?.length) return;
    const header = ["№ заказа", "Дата", "Клиент", "Услуга", "Категория", "Партнёр", "Стоимость", "Комиссия", "Валюта", "Статус заказа", "Оплата", "Бронирование", "Услуга", "Менеджер", "Изменено"];
    const rows = data.orders.map((o) => [
      o.orderNumber,
      fmtDate(o.createdAt),
      o.client,
      o.service,
      o.category,
      o.partner,
      o.amount,
      o.commission,
      o.currency,
      STATUS_LABELS[o.status] ?? o.status,
      PAY_LABELS[o.paymentStatus] ?? o.paymentStatus,
      BOOKING_LABELS[o.bookingStatus] ?? (o.bookingStatus || "—"),
      serviceDeliveryStatus(o.status),
      o.manager,
      fmtDateTime(o.updatedAt),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Активные фильтры-чипы ──
  const activeFilterChips: ActiveFilterChip[] = [];
  if (data && (filters.status || filters.bookingStatus || filters.paymentStatus || filters.manager || filters.source || filters.currency || filters.minPrice || filters.maxPrice || filters.needsAttention || filters.country || filters.city || searchQuery.trim())) {
    if (filters.country) activeFilterChips.push({ key: "country", label: `Страна: ${countries.find((c) => c.code === filters.country)?.name ?? filters.country}`, onClear: () => clearFilterChip({ country: "" }) });
    if (filters.city) activeFilterChips.push({ key: "city", label: `Город: ${filters.city}`, onClear: () => clearFilterChip({ city: "" }) });
    if (filters.type) activeFilterChips.push({ key: "type", label: `Категория: ${SERVICE_TYPES.find((t) => t.key === filters.type)?.label ?? filters.type}`, onClear: () => clearFilterChip({ type: "" }) });
    if (filters.status) activeFilterChips.push({ key: "status", label: `Статус: ${ORDER_STATUSES.find((o) => o.key === filters.status)?.label ?? filters.status}`, onClear: () => clearFilterChip({ status: "" }) });
    if (filters.bookingStatus) activeFilterChips.push({ key: "bookingStatus", label: `Статус брони: ${filters.bookingStatus}`, onClear: () => clearFilterChip({ bookingStatus: "" }) });
    if (filters.paymentStatus) activeFilterChips.push({ key: "paymentStatus", label: `Оплата: ${PAYMENT_STATUSES.find((o) => o.key === filters.paymentStatus)?.label ?? filters.paymentStatus}`, onClear: () => clearFilterChip({ paymentStatus: "" }) });
    if (filters.manager) activeFilterChips.push({ key: "manager", label: `Менеджер: ${filters.manager}`, onClear: () => clearFilterChip({ manager: "" }) });
    if (filters.source) activeFilterChips.push({ key: "source", label: `Источник: ${filters.source}`, onClear: () => clearFilterChip({ source: "" }) });
    if (filters.currency) activeFilterChips.push({ key: "currency", label: `Валюта: ${filters.currency}`, onClear: () => clearFilterChip({ currency: "" }) });
    if (filters.minPrice || filters.maxPrice) {
      activeFilterChips.push({ key: "price", label: `Стоимость: ${filters.minPrice || "0"}–${filters.maxPrice || "∞"}`, onClear: () => clearFilterChip({ minPrice: "", maxPrice: "" }) });
    }
    if (filters.needsAttention) {
      activeFilterChips.push({ key: "attention", label: "💬 Требуют внимания", onClear: () => clearFilterChip({ needsAttention: false }) });
    }
    if (searchQuery.trim()) activeFilterChips.push({ key: "search", label: `Поиск: «${searchQuery.trim()}»`, onClear: () => clearFilterChip({}, true) });
  }
  function clearFilterChip(patch: Partial<typeof filters>, clearSearch = false) {
    setFilters((prev) => ({ ...prev, ...patch }));
    if (clearSearch) setSearchQuery("");
    setPage(1);
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--admin-bg)] flex items-center justify-center">
        <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-8 text-center max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-[var(--admin-text)] mb-2">Ошибка загрузки</h2>
          <p className="text-sm text-[var(--admin-muted)] mb-1">{error}</p>
          <p className="text-[11px] text-[var(--admin-muted)]/70 mb-4">Подробности — в консоли браузера (F12)</p>
          <button
            onClick={async () => {
              const fresh = await fetchData();
              if (fresh) setData(fresh);
            }}
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
      {/* ─── Breadcrumbs (Гл. 6.3) ─── */}
      <div className="px-4 lg:px-6 py-3 border-b border-[var(--admin-border)]">
        <nav className="text-xs text-[var(--admin-muted)] flex items-center gap-1.5">
          <span>Главная</span>
          <span>→</span>
          <span className="text-[var(--admin-text)] font-medium">Заказы (Order Center)</span>
        </nav>
      </div>

      {/* ─── Панель быстрых действий (Гл. 6.4) ─── */}
      <div className="px-4 lg:px-6 py-3 border-b border-[var(--admin-border)] overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 min-w-max">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => {
                if (action.label === "Создать заказ") setCreateOpen(true);
                if (action.label === "Экспорт") exportCsv();
                if (action.label === "Импорт") {
                  setActionMsg({ ok: true, text: "Импорт заказов из CSV (демо) — выберите файл в реальном модуле" });
                }
                if (action.label === "Массовое изменение") {
                  if (!selectedIds.length) {
                    setActionMsg({ ok: false, text: "Сначала выберите заказы в таблице" });
                  } else {
                    setBulkMode("edit");
                  }
                }
                if (action.label === "Назначить менеджера") {
                  if (!selectedIds.length) {
                    setActionMsg({ ok: false, text: "Сначала выберите заказы в таблице" });
                  } else {
                    setBulkMode("manager");
                  }
                }
                if (action.label === "Отправить сообщение") {
                  if (!selectedOrder) {
                    setActionMsg({ ok: false, text: "Сначала выберите заказ в таблице" });
                  } else {
                    setOrderSidebarInitialTab("messages");
                    setSelectedOrder((prev) => ({ ...prev! }));
                  }
                }
                if (action.label === "AI Анализ") setAiOpen(true);
              }}
              className={`flex items-center gap-2 px-3 h-9 rounded-xl text-white text-xs font-medium ${action.color} hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all shrink-0`}
              title={action.label}
            >
              <span>{action.icon}</span>
              <span className="hidden sm:inline">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── KPI-панель (Заказ.docx, Гл. 5.4): 12 карточек ─── */}
      <div className="px-4 lg:px-6 py-4">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
                <SkeletonBlock className="h-9 w-9 mb-3" />
                <SkeletonBlock className="h-6 w-20 mb-2" />
                <SkeletonBlock className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {kpiCards.map((card) => (
              <div
                key={card.title}
                onClick={card.onClick}
                role={card.onClick ? "button" : undefined}
                tabIndex={card.onClick ? 0 : undefined}
                onKeyDown={(e) => {
                  if (card.onClick && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    card.onClick();
                  }
                }}
                title={card.onClick ? `Показать фильтр: ${card.title}` : undefined}
                className={`bg-[var(--admin-card)] border rounded-2xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all card-hover ${
                  card.onClick ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/60" : ""
                } ${card.active ? "border-primary ring-2 ring-primary/40 bg-primary/5" : "border-[var(--admin-border)]"}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white text-lg shadow-lg`}>{card.icon}</div>
                  <span className="text-[11px] font-medium text-[var(--admin-muted)] leading-tight">{card.title}</span>
                  {card.onClick && (
                    <span
                      className={`ml-auto shrink-0 inline-flex items-center px-1.5 h-4 rounded-full text-[9px] font-semibold transition-colors ${
                        card.active ? "bg-primary text-white" : "bg-[var(--admin-bg)] text-[var(--admin-muted)]"
                      }`}
                    >
                      {card.active ? (card.activeHint ?? "✕ снять") : "⇣ фильтр"}
                    </span>
                  )}
                </div>
                <div className="text-xl font-extrabold text-[var(--admin-text)] mb-1">{card.value}</div>
                {card.change && (
                  <div className={`text-xs font-semibold ${card.changeType === "up" ? "text-emerald-600" : card.changeType === "down" ? "text-red-600" : "text-[var(--admin-muted)]"}`}>
                    {card.change}
                  </div>
                )}
                {card.subtitle && <div className="text-[10px] text-[var(--admin-muted)] mt-1">{card.subtitle}</div>}
                {card.progress && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[10px] text-[var(--admin-muted)] mb-1">
                      <span>Прогресс</span>
                      <span className="font-semibold text-violet-600">{card.progress.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-[var(--admin-bg)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, card.progress.pct)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Основная рабочая область 25/50/25 (Гл. 6.7) ─── */}
      {!loading && data && (
        <div className="px-4 lg:px-6 pb-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Левая колонка: последние заказы, проблемные, AI-рекомендации */}
          <div className="space-y-4">
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--admin-text)] mb-3">🕘 Последние заказы</h3>
              <div className="space-y-2.5">
                {data.recentOrders.map((o) => (
                  <div key={o.id} className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--admin-text)] truncate">{o.client}</span>
                      <Badge label={STATUS_LABELS[o.status] ?? o.status} className={STATUS_STYLES[o.status]} />
                    </div>
                    <div className="text-[10px] text-[var(--admin-muted)] truncate">{o.service} · {fmtMoney(o.amount)}</div>
                    <div className="text-[10px] text-[var(--admin-muted)]">{fmtDateTime(o.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--admin-text)] mb-3">⚠️ Проблемные заказы</h3>
              {data.problemOrders.length ? (
                <div className="space-y-2.5">
                  {data.problemOrders.map((o) => (
                    <div key={o.id} className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${o.urgency === "high" ? "bg-red-500" : "bg-amber-500"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-[var(--admin-text)]">{o.client} · {o.service}</div>
                        <div className="text-[10px] text-[var(--admin-muted)]">{fmtMoney(o.amount)}{o.serviceDate ? ` · дата ${fmtDate(o.serviceDate)}` : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[var(--admin-muted)]">Проблемных заказов нет 🎉</div>
              )}
            </div>

            <div className="bg-gradient-to-br from-fuchsia-500 to-pink-500 rounded-2xl p-4 text-white">
              <h3 className="text-sm font-semibold mb-3">🤖 AI-рекомендации</h3>
              <div className="space-y-2">
                {data.aiRecommendations.map((r, i) => (
                  <div key={i} className="text-xs flex gap-2">
                    <span>{r.level === "high" ? "🔴" : r.level === "medium" ? "🟡" : "🟢"}</span>
                    <div>
                      <div className="font-medium">{r.title}</div>
                      <div className="text-white/70">{r.effect}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Центральная колонка: графики */}
          <div className="space-y-4 lg:col-span-2">
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h3 className="text-sm font-semibold text-[var(--admin-text)]">📈 Динамика заказов</h3>
                <div className="flex items-center gap-1">
                  {(["line", "bar", "area"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setChartMode(m)}
                      className={`px-2.5 h-7 rounded-lg text-[11px] font-medium transition-colors ${chartMode === m ? "bg-primary text-white" : "text-[var(--admin-muted)] hover:bg-[var(--admin-bg)]"}`}
                    >
                      {m === "line" ? "Линия" : m === "bar" ? "Столбцы" : "Область"}
                    </button>
                  ))}
                </div>
              </div>
              <RevenueChart data={ordersSeriesPoints} mode={chartMode} height={220} color="#3b82f6" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-[var(--admin-text)] mb-3">🟣 Статусы заказов</h3>
                <DonutChart data={statusDonutData} size={170} />
              </div>
              <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-[var(--admin-text)] mb-3">🗂 Заказы по категориям</h3>
                <DonutChart data={serviceDonutData} size={170} />
              </div>
            </div>

            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--admin-text)] mb-3">🌍 География заказов</h3>
              {data.bookingsByCountry.length ? (
                <div className="space-y-2">
                  {data.bookingsByCountry.slice(0, 8).map((c) => {
                    const max = data.bookingsByCountry[0]?.count || 1;
                    return (
                      <div key={c.code} className="flex items-center gap-2 text-xs">
                        <span className="w-32 shrink-0 truncate text-[var(--admin-muted)]">{c.country}</span>
                        <div className="flex-1 h-2 bg-[var(--admin-bg)] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full" style={{ width: `${(c.count / max) * 100}%` }} />
                        </div>
                        <span className="w-8 shrink-0 text-right font-semibold text-[var(--admin-text)]">{c.count}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-[var(--admin-muted)]">Нет данных за период</div>
              )}
            </div>

            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--admin-text)] mb-3">🕐 Карта активности</h3>
              <ActivityHeatmap data={data.heatmap} />
            </div>
          </div>

          {/* Правая колонка: финансы, оплаты, возвраты, поездки, SLA */}
          <div className="space-y-4">
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--admin-text)] mb-3">💰 Финансовые показатели</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-[var(--admin-muted)]">Сумма заказов</span><b>{fmtMoney(data.financial.totalAmount)}</b></div>
                <div className="flex justify-between"><span className="text-[var(--admin-muted)]">Оплачено</span><b className="text-emerald-600">{fmtMoney(data.financial.paidAmount)}</b></div>
                <div className="flex justify-between"><span className="text-[var(--admin-muted)]">Ожидает оплаты</span><b className="text-amber-600">{fmtMoney(data.financial.pendingAmount)}</b></div>
                <div className="flex justify-between"><span className="text-[var(--admin-muted)]">Возвращено</span><b className="text-red-600">{fmtMoney(data.financial.refundedAmount)}</b></div>
                <div className="flex justify-between"><span className="text-[var(--admin-muted)]">Комиссия (12%)</span><b className="text-blue-600">{fmtMoney(data.financial.commission)}</b></div>
                <div className="flex justify-between"><span className="text-[var(--admin-muted)]">Выплаты партнёрам</span><b className="text-violet-600">{fmtMoney(data.financial.expectedPayouts)}</b></div>
              </div>
            </div>

            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--admin-text)] mb-3">⏳ Ожидающие оплаты</h3>
              {data.pendingPayments.length ? (
                <div className="space-y-2.5">
                  {data.pendingPayments.map((p) => (
                    <div key={p.id} className="text-xs">
                      <div className="font-medium text-[var(--admin-text)] truncate">{p.client}</div>
                      <div className="text-[10px] text-[var(--admin-muted)] truncate">{p.service}</div>
                      <div className="text-[10px] text-amber-600 font-semibold">{fmtMoney(p.amount)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[var(--admin-muted)]">Ожидающих оплат нет</div>
              )}
            </div>

            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--admin-text)] mb-3">↩️ Возвраты</h3>
              {data.refunds.length ? (
                <div className="space-y-2.5">
                  {data.refunds.map((r) => (
                    <div key={r.id} className="text-xs">
                      <div className="font-medium text-[var(--admin-text)] truncate">{r.client}</div>
                      <div className="text-[10px] text-[var(--admin-muted)] truncate">{r.service}</div>
                      <div className="text-[10px] text-red-600 font-semibold">{fmtMoney(r.amount)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[var(--admin-muted)]">Возвратов за период нет</div>
              )}
            </div>

            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--admin-text)] mb-3">✈️ Ближайшие поездки</h3>
              {data.upcomingTrips.length ? (
                <div className="space-y-2.5">
                  {data.upcomingTrips.map((t) => (
                    <div key={t.id} className="text-xs">
                      <div className="font-medium text-[var(--admin-text)] truncate">{t.client}</div>
                      <div className="text-[10px] text-[var(--admin-muted)] truncate">{t.service}</div>
                      <div className="text-[10px] text-cyan-600">{t.serviceDate ? fmtDate(t.serviceDate) : "—"}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[var(--admin-muted)]">Поездок в ближайшие 30 дней нет</div>
              )}
            </div>

            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--admin-text)] mb-3">⏱️ Контроль SLA</h3>
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className="text-[var(--admin-muted)]">Соблюдение регламентов</span>
                <b className={data.sla.compliance >= 80 ? "text-emerald-600" : data.sla.compliance >= 50 ? "text-amber-600" : "text-red-600"}>{data.sla.compliance}%</b>
              </div>
              <div className="h-2 bg-[var(--admin-bg)] rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full ${data.sla.compliance >= 80 ? "bg-emerald-500" : data.sla.compliance >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${data.sla.compliance}%` }}
                />
              </div>
              <div className="text-[10px] text-[var(--admin-muted)]">
                Цель: {data.sla.targetHours} ч · Просрочено: {data.sla.breaches} из {data.sla.total}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Панель фильтрации (Гл. 6.6) ─── */}
      <div id="order-filter-panel" className="px-4 lg:px-6 pb-4">
        <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h3 className="text-sm font-semibold text-[var(--admin-text)]">Фильтры</h3>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--admin-muted)]">Период:</span>
              <div className="flex items-center gap-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => { setPeriod(p.key); setPage(1); }}
                    className={`px-2.5 h-7 rounded-lg text-[11px] font-medium transition-colors ${period === p.key ? "bg-primary text-white" : "text-[var(--admin-muted)] hover:bg-[var(--admin-bg)]"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <button onClick={() => { setPage(1); fetchData(); }} className="px-3 h-8 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-dark transition-colors">
                Применить
              </button>
              <button onClick={resetFilters} className="px-3 h-8 rounded-lg border border-[var(--admin-border)] text-[var(--admin-muted)] text-xs font-medium hover:bg-[var(--admin-bg)] transition-colors">
                Сбросить
              </button>
              <button onClick={saveFilter} className="px-3 h-8 rounded-lg border border-[var(--admin-border)] text-[var(--admin-muted)] text-xs font-medium hover:bg-[var(--admin-bg)] transition-colors">
                💾 Сохранить фильтр
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
            <select
              value={filters.country}
              onChange={(e) => handleCountryChange(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
            >
              <option value="">Все страны</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            <select
              value={filters.city}
              onChange={(e) => { setFilters((prev) => ({ ...prev, city: e.target.value })); setPage(1); }}
              disabled={!filters.country}
              className="h-9 px-2.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors disabled:opacity-40"
            >
              <option value="">Все города</option>
              {countryCities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={filters.type}
              onChange={(e) => { setFilters((prev) => ({ ...prev, type: e.target.value })); setPage(1); }}
              className="h-9 px-2.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
            >
              {SERVICE_TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => { setFilters((prev) => ({ ...prev, status: e.target.value })); setPage(1); }}
              className="h-9 px-2.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <select
              value={filters.paymentStatus}
              onChange={(e) => { setFilters((prev) => ({ ...prev, paymentStatus: e.target.value })); setPage(1); }}
              className="h-9 px-2.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
            >
              {PAYMENT_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <select
              value={filters.source}
              onChange={(e) => { setFilters((prev) => ({ ...prev, source: e.target.value })); setPage(1); }}
              className="h-9 px-2.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
            >
              {SOURCES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <select
              value={filters.manager}
              onChange={(e) => { setFilters((prev) => ({ ...prev, manager: e.target.value })); setPage(1); }}
              className="h-9 px-2.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
            >
              <option value="">Все менеджеры</option>
              {data?.managers.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={filters.currency}
              onChange={(e) => { setFilters((prev) => ({ ...prev, currency: e.target.value })); setPage(1); }}
              className="h-9 px-2.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c || "Все валюты"}</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              value={filters.minPrice}
              onChange={(e) => { setFilters((prev) => ({ ...prev, minPrice: e.target.value })); setPage(1); }}
              placeholder="Цена от"
              className="h-9 px-2.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
            />
            <input
              type="number"
              min="0"
              value={filters.maxPrice}
              onChange={(e) => { setFilters((prev) => ({ ...prev, maxPrice: e.target.value })); setPage(1); }}
              placeholder="Цена до"
              className="h-9 px-2.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
            />
            <label className="flex items-center gap-2 h-9 px-2.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-muted)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filters.needsAttention}
                onChange={(e) => { setFilters((prev) => ({ ...prev, needsAttention: e.target.checked })); setPage(1); }}
                className="accent-[var(--primary)] w-3.5 h-3.5 cursor-pointer"
              />
              💬 Требуют внимания
            </label>
          </div>

          {savedFilters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mt-3">
              <span className="text-[10px] text-[var(--admin-muted)] uppercase font-semibold">Сохранённые:</span>
              {savedFilters.map((s) => (
                <button
                  key={s}
                  onClick={() => setSavedFilters(savedFilters.filter((x) => x !== s))}
                  className="px-2.5 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 transition-colors"
                >
                  {s} ✕
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ActiveFilterChips chips={activeFilterChips} />

      {/* ─── Таблица заказов (Гл. 6.8) ─── */}
      <div ref={tableSectionRef} className="px-4 lg:px-6 pb-4 scroll-mt-4">
        <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--admin-border)] flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--admin-text)]">Заказы</h3>
              <Badge label={`${data?.pagination.total ?? 0} всего`} className="bg-[var(--admin-bg)] text-[var(--admin-muted)]" />
              {selectedIds.length > 0 && (
                <Badge label={`Выбрано: ${selectedIds.length}`} className="bg-primary text-white" />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Массовые действия */}
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {[
                    { key: "confirm", label: "✅ Подтвердить" },
                    { key: "pay", label: "💳 Оплатить" },
                    { key: "complete", label: "🏁 Завершить" },
                    { key: "cancel", label: "❌ Отменить" },
                    { key: "archive", label: "📦 Архив" },
                  ].map((b) => (
                    <button
                      key={b.key}
                      onClick={() => void runBulkAction(b.key as "confirm" | "pay" | "complete" | "cancel" | "archive")}
                      disabled={bulkRunning !== null}
                      className="px-2.5 h-7 rounded-lg bg-[var(--admin-bg)] text-[var(--admin-muted)] text-[11px] font-medium hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-40"
                    >
                      {bulkRunning === b.key ? "…" : b.label}
                    </button>
                  ))}
                  <button onClick={clearSelection} className="px-2.5 h-7 rounded-lg text-[var(--admin-muted)] text-[11px] hover:bg-[var(--admin-bg)] transition-colors">
                    Снять ✕
                  </button>
                </div>
              )}
              <div className="relative">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") setPage(1); }}
                  placeholder="Поиск: номер, клиент, услуга…"
                  className="h-8 pl-8 pr-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors w-52"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--admin-muted)] text-xs">🔍</span>
              </div>
              <button
                onClick={() => { setSortUnread((v) => !v); setPage(1); }}
                className={`px-2.5 h-8 rounded-lg text-[11px] font-medium transition-colors ${sortUnread ? "bg-primary text-white" : "bg-[var(--admin-bg)] text-[var(--admin-muted)] hover:text-primary"}`}
                title="Сначала заказы с непрочитанными сообщениями"
              >
                💬 Требуют внимания
              </button>
              <button onClick={exportCsv} className="px-2.5 h-8 rounded-lg bg-[var(--admin-bg)] text-[var(--admin-muted)] text-[11px] font-medium hover:text-primary transition-colors">
                📤 Экспорт CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-sm min-w-[1360px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-[var(--admin-muted)] border-b border-[var(--admin-border)]">
                  <th className="px-3 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(el) => { if (el) el.indeterminate = someVisibleSelected; }}
                      onChange={toggleAllVisible}
                      className="accent-[var(--primary)] w-3.5 h-3.5 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-2.5">№ заказа</th>
                  <th className="px-3 py-2.5">Дата</th>
                  <th className="px-3 py-2.5">Клиент</th>
                  <th className="px-3 py-2.5">Услуга</th>
                  <th className="px-3 py-2.5">Партнёр</th>
                  <th className="px-3 py-2.5 text-right">Стоимость</th>
                  <th className="px-3 py-2.5 text-right">Комиссия</th>
                  <th className="px-3 py-2.5">Статус заказа</th>
                  <th className="px-3 py-2.5">Оплата</th>
                  <th className="px-3 py-2.5">Бронирование</th>
                  <th className="px-3 py-2.5">Услуга (статус)</th>
                  <th className="px-3 py-2.5">Менеджер</th>
                  <th className="px-3 py-2.5">Изменено</th>
                  <th className="px-3 py-2.5">Действия</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => {
                      setOrderSidebarInitialTab("overview");
                      setSelectedOrder(o);
                    }}
                    className="border-b border-[var(--admin-border)] last:border-0 hover:bg-[var(--admin-bg)]/60 transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(o.id)}
                        onChange={() => toggleRow(o.id)}
                        className="accent-[var(--primary)] w-3.5 h-3.5 cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[var(--admin-text)]">{o.orderNumber}</span>
                        {o.unreadCount > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold">
                            {o.unreadCount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--admin-muted)] whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-[var(--admin-text)]">{o.client}</div>
                      <div className="text-[10px] text-[var(--admin-muted)]">{o.source}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-[var(--admin-text)] text-xs">{o.service}</div>
                      <div className="text-[10px] text-[var(--admin-muted)]">{o.category}{o.serviceDate ? ` · ${fmtDate(o.serviceDate)}` : ""}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--admin-muted)]">{o.partner}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="font-semibold text-[var(--admin-text)]">{fmtMoney(o.amount)}</div>
                      {o.paidAmount > 0 && o.paidAmount < o.amount && (
                        <div className="text-[10px] text-amber-600">оплачено {fmtMoney(o.paidAmount)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold text-blue-600">
                      {o.commission > 0 ? fmtMoney(o.commission) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge label={STATUS_LABELS[o.status] ?? o.status} className={ORDER_BADGE_STYLES} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge label={PAY_LABELS[o.paymentStatus] ?? o.paymentStatus} className={PAY_BADGE_STYLES[o.paymentStatus]} />
                    </td>
                    <td className="px-3 py-2.5">
                      {o.bookingStatus ? (
                        <Badge label={BOOKING_LABELS[o.bookingStatus] ?? o.bookingStatus} className={BOOKING_BADGE_STYLES} />
                      ) : (
                        <span className="text-[10px] text-[var(--admin-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge label={serviceDeliveryStatus(o.status)} className={SERVICE_BADGE_STYLES} />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--admin-muted)]">{o.manager}</td>
                    <td className="px-3 py-2.5 text-xs text-[var(--admin-muted)] whitespace-nowrap">{fmtDateTime(o.updatedAt)}</td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedOrder(o)}
                          title="Открыть карточку заказа"
                          className="w-7 h-7 rounded-lg bg-[var(--admin-bg)] text-[var(--admin-muted)] hover:bg-primary/10 hover:text-primary transition-colors text-xs"
                        >
                          👁
                        </button>
                        <button
                          onClick={() => setEditOrder(o)}
                          title="Редактировать заказ"
                          className="w-7 h-7 rounded-lg bg-[var(--admin-bg)] text-[var(--admin-muted)] hover:bg-primary/10 hover:text-primary transition-colors text-xs"
                        >
                          ✏️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!visibleOrders.length && !loading && (
                  <tr>
                    <td colSpan={15} className="px-4 py-10 text-center text-sm text-[var(--admin-muted)]">
                      Заказы не найдены — измените фильтры
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Пагинация */}
          {data && (
            <div className="px-4 py-3 border-t border-[var(--admin-border)] flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-[var(--admin-muted)]">
                Страница {data.pagination.page} из {data.pagination.totalPages} · {data.pagination.total} заказов
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="px-3 h-8 rounded-lg border border-[var(--admin-border)] text-xs text-[var(--admin-muted)] hover:bg-[var(--admin-bg)] transition-colors disabled:opacity-40"
                >
                  ←
                </button>
                {Array.from({ length: data.pagination.totalPages }).slice(0, 7).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i + 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === i + 1 ? "bg-primary text-white" : "text-[var(--admin-muted)] hover:bg-[var(--admin-bg)]"}`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage(Math.min(data.pagination.totalPages, page + 1))}
                  disabled={page >= data.pagination.totalPages}
                  className="px-3 h-8 rounded-lg border border-[var(--admin-border)] text-xs text-[var(--admin-muted)] hover:bg-[var(--admin-bg)] transition-colors disabled:opacity-40"
                >
                  →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Боковая панель заказа (Заказ.docx, Гл. 5.8–5.9) ─── */}
      {selectedOrder && (
        <OrderDetailSidebar
          key={`${selectedOrder.id}-${orderSidebarInitialTab}`}
          order={selectedOrder}
          onClose={() => {
            setSelectedOrder(null);
            setOrderSidebarInitialTab("overview");
          }}
          onAction={(action) => void runOrderAction(selectedOrder.id, action)}
          onEdit={() => setEditOrder(selectedOrder)}
          acting={acting}
          historyVersion={historyVersion}
          initialTab={orderSidebarInitialTab}
          onMessagesRead={() => {
            void fetchData().then((fresh) => {
              if (fresh) setData(fresh);
            });
          }}
        />
      )}

      {/* ─── Модальное окно массового изменения / назначения менеджера (Гл. 5.5) ─── */}
      {bulkMode && selectedIds.length > 0 && (
        <BulkActionModal
          mode={bulkMode}
          count={selectedIds.length}
          managers={data?.managers ?? []}
          onClose={() => setBulkMode(null)}
          onApply={async (payload) => {
            setBulkRunning("bulk");
            setActionMsg(null);
            try {
              const res = await fetch("/api/admin/orders/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: payload.action, ids: selectedIds, ...(payload.value !== undefined ? { value: payload.value } : {}) }),
              });
              const json = await res.json().catch(() => null);
              if (!res.ok) {
                setActionMsg({ ok: false, text: json?.detail ?? json?.error ?? "Не удалось выполнить массовое действие" });
                return;
              }
              setActionMsg({ ok: true, text: json?.message ?? "Готово" });
              setBulkMode(null);
              setSelectedIds([]);
              setHistoryVersion((v) => v + 1);
              const fresh = await fetchData();
              if (fresh) setData(fresh);
            } catch {
              setActionMsg({ ok: false, text: "Ошибка сети" });
            } finally {
              setBulkRunning(null);
            }
          }}
        />
      )}

      {/* ─── Модальное окно создания заказа ─── */}
      {createOpen && (
        <CreateOrderModal
          onClose={() => setCreateOpen(false)}
          onCreated={async (msg) => {
            setCreateOpen(false);
            setActionMsg({ ok: true, text: msg });
            const fresh = await fetchData();
            if (fresh) setData(fresh);
          }}
        />
      )}

      {/* ─── Модальное окно редактирования заказа ─── */}
      {editOrder && (
        <EditOrderModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSaved={async (msg, updated) => {
            setEditOrder(null);
            setActionMsg({ ok: true, text: msg });
            setSelectedOrder((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
            setHistoryVersion((v) => v + 1);
            const fresh = await fetchData();
            if (fresh) setData(fresh);
          }}
        />
      )}

      {/* ─── Правая AI-панель (Гл. 6.11, 420–480px) ─── */}
      {aiOpen && (
        <div className="fixed inset-y-0 right-0 z-50 flex">
          <div className="absolute inset-0 bg-black/20" onClick={() => setAiOpen(false)} />
          <div className="relative w-[460px] max-w-[calc(100vw-2rem)] bg-[var(--admin-card)] border-l border-[var(--admin-border)] shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--admin-border)] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[var(--admin-text)]">🤖 AI Assistant</h3>
                <p className="text-xs text-[var(--admin-muted)] mt-0.5">Анализ заказов · прогнозы · рекомендации</p>
              </div>
              <button onClick={() => setAiOpen(false)} className="w-9 h-9 rounded-xl hover:bg-[var(--admin-bg)] flex items-center justify-center text-[var(--admin-muted)] transition-colors">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {data?.aiRecommendations.map((r, i) => (
                <div key={i} className="rounded-xl bg-[var(--admin-bg)] p-3 text-xs">
                  <div className="flex items-center gap-2 font-medium text-[var(--admin-text)]">
                    <span>{r.level === "high" ? "🔴" : r.level === "medium" ? "🟡" : "🟢"}</span>
                    {r.title}
                  </div>
                  <div className="text-[var(--admin-muted)] mt-1">{r.effect}</div>
                </div>
              ))}
              <div className="text-[10px] uppercase tracking-wide text-[var(--admin-muted)] font-semibold pt-2">Спросить</div>
              {AI_PROMPTS.map((q) => (
                <button
                  key={q}
                  className="w-full text-left px-3 py-2 rounded-xl bg-[var(--admin-bg)] hover:bg-primary/10 hover:text-primary transition-colors text-xs text-[var(--admin-muted)]"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-[var(--admin-border)]">
              <div className="flex items-center gap-2">
                <input
                  placeholder="Вопрос о заказах…"
                  className="flex-1 h-10 px-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors"
                />
                <button className="h-10 px-4 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-dark transition-colors">
                  ➤
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Тост о результате действия ─── */}
      {actionMsg && (
        <div className="fixed bottom-6 right-6 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div
            className={`px-4 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2 ${
              actionMsg.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            {actionMsg.ok ? "✅" : "⚠️"} {actionMsg.text}
            <button onClick={() => setActionMsg(null)} className="ml-2 opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
