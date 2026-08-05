"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RevenueChart, DonutChart, CHART_COLORS } from "@/components/admin/charts";
import { describeApiError } from "@/lib/api-error";
import ActiveFilterChips, { type ActiveFilterChip } from "@/components/admin/ActiveFilterChips";

/* ─── Типы данных API ─── */
interface BookingRow {
  id: string;
  bookingNumber: string;
  orderId: string;
  client: string;
  partner: string;
  provider: string;
  service: string;
  category: string;
  categoryType: string;
  direction: string;
  amount: number;
  currency: string;
  bookingStatus: string;
  paymentStatus: "paid" | "pending" | "refunded";
  manager: string;
  source: string;
  unreadCount: number;
  createdAt: string;
  serviceDate: string;
  updatedAt: string;
}

interface KpiItem {
  value: number;
  change: number;
  detail: string;
}

interface BookingsData {
  kpi: {
    newBookings: KpiItem;
    confirmedBookings: KpiItem;
    awaitingPayment: KpiItem;
    paidBookings: KpiItem;
    cancelledBookings: KpiItem;
    completedBookings: KpiItem;
    conversion: KpiItem;
    avgConfirm: KpiItem;
    forecastAI: KpiItem;
    needsAttention: KpiItem;
  };
  // Воронка конверсии жизненного цикла (Гл. 5.5): этапы накопительные —
  // entry = создано за период, confirmed = CONFIRMED+PAID+COMPLETED, paid = PAID+COMPLETED.
  funnel: { entry: number; confirmed: number; paid: number };
  bookingsSeries: { labels: string[]; values: number[] };
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
  recentBookings: { id: string; client: string; service: string; amount: number; status: string; createdAt: string }[];
  problemBookings: { id: string; client: string; service: string; amount: number; serviceDate: string; urgency: string }[];
  pendingPayments: { id: string; client: string; service: string; amount: number; createdAt: string }[];
  upcomingTrips: { id: string; client: string; service: string; destination: string; serviceDate: string }[];
  overdueConfirmations: { id: string; client: string; service: string; amount: number; hours: number }[];
  sla: { targetHours: number; compliance: number; breaches: number; total: number };
  providerNotifications: { id: string; type: string; title: string; detail: string }[];
  aiRecommendations: { level: string; title: string; effect: string }[];
  managers: string[];
  bookings: BookingRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/* ─── Быстрые действия (Гл. 5.4) ─── */
const QUICK_ACTIONS = [
  { icon: "➕", label: "Создать бронирование", color: "bg-primary" },
  { icon: "✅", label: "Подтвердить", color: "bg-emerald-500" },
  { icon: "💳", label: "Отправить на оплату", color: "bg-blue-500" },
  { icon: "✏️", label: "Изменить", color: "bg-violet-500" },
  { icon: "❌", label: "Отменить", color: "bg-red-500" },
  { icon: "📤", label: "Экспорт", color: "bg-gray-500" },
  { icon: "📥", label: "Импорт", color: "bg-gray-500" },
  { icon: "📄", label: "Сформировать отчет", color: "bg-indigo-500" },
  { icon: "🤖", label: "AI-анализ", color: "bg-fuchsia-500" },
  { icon: "⚙️", label: "Настроить страницу", color: "bg-gray-500" },
];

/* ─── Статусы и жизненный цикл (Гл. 5.7) ─── */
const LIFECYCLE = [
  "Черновик",
  "Создано",
  "Ожидает подтверждения",
  "Подтверждено",
  "Ожидает оплаты",
  "Оплачено",
  "Подготовка документов",
  "Завершено",
];

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Ожидает подтверждения",
  CONFIRMED: "Подтверждено",
  PAID: "Оплачено",
  REFUNDED: "Возвращено",
  COMPLETED: "Завершено",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PAID: "bg-emerald-100 text-emerald-700",
  REFUNDED: "bg-red-100 text-red-700",
  COMPLETED: "bg-cyan-100 text-cyan-700",
};

const PAY_STYLES: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  refunded: "bg-red-100 text-red-700",
};

const AI_PROMPTS = [
  "Спрогнозируй подтверждения на следующую неделю",
  "Какие бронирования находятся в зоне риска отмены?",
  "Проанализируй причины отказов за последний месяц",
  "Найди аномалии в бронированиях за период",
  "Создай задачи менеджерам по просроченным подтверждениям",
  "Какой поставщик чаще всех задерживает подтверждение?",
  "Сравни бронирования по странам за два периода",
  "Покажи бронирования с наибольшей стоимостью, ожидающие оплаты",
  "Спрогнозируй доход от бронирований на месяц вперёд",
  "Сформируй отчёт по конверсии бронирование → оплата",
  "Какие услуги чаще всего бронируют повторно?",
  "Выяви клиентов с высоким риском отмены",
  "Какие направления растут быстрее всего?",
  "Сколько бронирований обработал каждый менеджер?",
  "Покажи тепловую карту активности бронирований",
  "Какие платежи просрочены больше чем на 72 часа?",
  "Сформируй план действий для улучшения SLA",
  "Какие категории услуг приносят больше всего выручки?",
  "Найди бронирования с аномально низкой ценой",
  "Дай рекомендации по снижению числа отмен",
];

const PERIODS = [
  { key: "today", label: "Сегодня" },
  { key: "yesterday", label: "Вчера" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "quarter", label: "Квартал" },
  { key: "year", label: "Год" },
];

const BOOKING_STATUSES = [
  { key: "", label: "Все статусы" },
  { key: "PENDING", label: "Ожидает подтверждения" },
  { key: "CONFIRMED", label: "Подтверждено" },
  { key: "PAID", label: "Оплачено" },
  { key: "REFUNDED", label: "Возвращено" },
  { key: "COMPLETED", label: "Завершено" },
  // Группы в таблице соответствуют KPI-карточкам по оплате: «Ожидают оплаты (все)»
  // = PENDING,CONFIRMED и «Оплаченные (все)» = PAID,COMPLETED (Гл. 5.5).
  { key: "PENDING,CONFIRMED", label: "Ожидают оплаты (все)" },
  { key: "PAID,COMPLETED", label: "Оплаченные (все)" },
];

const PAYMENT_STATUSES = [
  { key: "", label: "Все платежи" },
  { key: "paid", label: "Оплачен" },
  { key: "pending", label: "Ожидает" },
  { key: "refunded", label: "Возврат" },
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

/* ─── Журнал изменений (вкладка «История», Гл. 5.9) ─── */
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

const HISTORY_META: Record<string, { icon: string; label: string }> = {
  created: { icon: "🆕", label: "Бронирование создано" },
  confirm: { icon: "✅", label: "Подтверждено" },
  pay: { icon: "💳", label: "Оплачено" },
  complete: { icon: "🏁", label: "Завершено" },
  cancel: { icon: "❌", label: "Отменено / возврат" },
  update: { icon: "✏️", label: "Изменены дата/сумма" },
};

function formatHistoryFields(fields: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof fields.amount === "number") parts.push(`сумма → ${fmtMoney(fields.amount)}`);
  if (typeof fields.serviceDate === "string") parts.push(`дата поездки → ${fmtDate(fields.serviceDate)}`);
  return parts.join(" · ");
}

/* ─── Переписка (вкладка «Переписка», Гл. 5.9) ─── */
interface BookingMessageItem {
  id: string;
  senderName: string;
  senderRole: string;
  text: string;
  isRead: boolean;
  createdAt: string;
}

const QUICK_REPLIES = [
  "Ваше бронирование подтверждено ✅",
  "Напоминаем об оплате — счёт действителен 48 часов",
  "Документы отправлены на вашу почту",
  "Дату можно изменить — укажите желаемую",
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

/* ─── Тепловая карта ─── */
function ActivityHeatmap({ data }: { data: { day: string; hour: number; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  // Индекс по ключу "день:час" — без O(n²) поиска по массиву
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
                    title={`${d} ${h}:00 — ${v} бронирований`}
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

/* ─── Карточка бронирования (боковая панель 600–700px, Гл. 5.6) ─── */
function BookingDetailSidebar({
  booking,
  onClose,
  onAction,
  onEdit,
  acting,
  historyVersion,
  onMessagesRead,
}: {
  booking: BookingRow;
  onClose: () => void;
  onAction: (action: "confirm" | "pay" | "cancel" | "complete") => void;
  onEdit: () => void;
  acting: string | null;
  historyVersion: number;
  onMessagesRead: () => void;
}) {
  const [tab, setTab] = useState("overview");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const busy = acting !== null;

  // Загрузка журнала изменений: при открытии карточки и после каждого действия (historyVersion)
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const res = await fetch(`/api/admin/bookings/${booking.id}/history`);
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
  }, [booking.id, historyVersion]);

  // ── Переписка: загрузка сообщений при открытии карточки и после действий ──
  // (historyVersion инкрементируется родителем после confirm/pay/cancel/complete —
  //  системные сообщения о смене статуса появляются в чате сразу)
  const [messages, setMessages] = useState<BookingMessageItem[]>([]);
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
        const res = await fetch(`/api/admin/bookings/${booking.id}/messages`);
        if (!res.ok) throw new Error(await describeApiError(res, "Ошибка загрузки переписки"));
        const json = await res.json();
        if (!cancelled) setMessages(json.messages ?? []);
      } catch (err) {
        if (!cancelled) setMessagesError(err instanceof Error ? err.message : "Неизвестная ошибка");
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [booking.id, historyVersion]);

  // Автопрокрутка к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, messagesLoading]);

  // Счётчик «требует внимания»: непрочитанные system/manager сообщения (Гл. 5.9)
  const unreadMessages = messages.filter(
    (m) => (m.senderRole === "system" || m.senderRole === "manager") && !m.isRead
  ).length;

  // Пометить переписку прочитанной при открытии вкладки «Переписка».
  // Ждём ответ сервера и только потом сбрасываем локально — чтобы не рассинхронизироваться
  // с БД (если POST упал, бейдж остаётся и повторится при следующем открытии).
  const markMessagesRead = async () => {
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/messages/read`, { method: "POST" });
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
      const res = await fetch(`/api/admin/bookings/${booking.id}/messages`, {
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
      // Перечитываем переписку, чтобы получить полный порядок сообщений
      const list = await fetch(`/api/admin/bookings/${booking.id}/messages`);
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

  const isRefunded = booking.bookingStatus === "REFUNDED";
  const stageIndex = isRefunded
    ? -1
    : booking.bookingStatus === "COMPLETED"
    ? 7
    : booking.bookingStatus === "PAID"
    ? 5
    : booking.bookingStatus === "CONFIRMED"
    ? 3
    : 2;

  const tabs = [
    { key: "overview", label: "Обзор" },
    { key: "client", label: "Клиент" },
    { key: "order", label: "Заказ" },
    { key: "service", label: "Услуга" },
    { key: "provider", label: "Поставщик" },
    { key: "payments", label: "Платежи" },
    { key: "documents", label: "Документы" },
    { key: "history", label: "История" },
    { key: "messages", label: "Переписка" },
    { key: "ai", label: "AI-анализ" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-[650px] bg-[var(--admin-card)] border-l border-[var(--admin-border)] overflow-y-auto shadow-2xl">
        {/* Шапка */}
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-[var(--admin-border)] bg-[var(--admin-card)]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[var(--admin-text)]">{booking.bookingNumber}</h2>
                <Badge label={STATUS_LABELS[booking.bookingStatus] ?? booking.bookingStatus} className={STATUS_STYLES[booking.bookingStatus]} />
              </div>
              <p className="text-xs text-[var(--admin-muted)] mt-0.5">Заказ {booking.orderId} · {booking.client}</p>
            </div>
            <button onClick={onClose} className="ac-btn ac-btn-ghost ac-btn-icon">
              ✕
            </button>
          </div>

          {/* Жизненный цикл */}
          {isRefunded && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-xs">
              <span>↩️</span>
              <span className="font-medium text-red-700">Бронирование возвращено — вне линейного жизненного цикла</span>
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

          {/* Вкладки */}
          <div className="mt-3 flex gap-1 overflow-x-auto no-scrollbar pb-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  // Открытие переписки сбрасывает счётчик «требует внимания»
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
                <InfoRow k="Бронирование" v={booking.bookingNumber} />
                <InfoRow k="Заказ" v={booking.orderId} />
                <InfoRow k="Создано" v={fmtDateTime(booking.createdAt)} />
                <InfoRow k="Последнее изменение" v={fmtDateTime(booking.updatedAt)} />
                <InfoRow k="Менеджер" v={booking.manager} />
                <InfoRow k="Источник" v={booking.source} />
              </InfoBlock>
              <InfoBlock title="Финансы">
                <InfoRow k="Стоимость" v={`${fmtMoney(booking.amount)} · ${booking.currency}`} bold />
                <InfoRow k="Статус оплаты" v={<Badge label={booking.paymentStatus === "paid" ? "Оплачен" : booking.paymentStatus === "pending" ? "Ожидает" : "Возврат"} className={PAY_STYLES[booking.paymentStatus]} />} />
                <InfoRow k="Комиссия (12%)" v={fmtMoney(booking.amount * 0.12)} />
              </InfoBlock>
              <div className="flex gap-2">
                <button
                  onClick={() => onAction("confirm")}
                  disabled={busy || booking.bookingStatus !== "PENDING"}
                  className={`flex-1 h-10 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    acting === "confirm" ? "bg-primary-dark" : "bg-primary hover:bg-primary-dark"
                  }`}
                >
                  {acting === "confirm" ? "Подтверждаем…" : "Подтвердить"}
                </button>
                <button
                  onClick={() => onAction("pay")}
                  disabled={busy || !["PENDING", "CONFIRMED"].includes(booking.bookingStatus)}
                  className={`flex-1 h-10 rounded-xl border text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    acting === "pay"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-[var(--admin-border)] text-[var(--admin-muted)] hover:bg-[var(--admin-bg)]"
                  }`}
                >
                  {acting === "pay" ? "Отправляем…" : "Отправить на оплату"}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onAction("complete")}
                  disabled={busy || booking.bookingStatus !== "PAID"}
                  className="ac-btn ac-btn-secondary flex-1"
                >
                  Завершить поездку
                </button>
                <button
                  onClick={() => onAction("cancel")}
                  disabled={busy || !["PENDING", "CONFIRMED", "PAID"].includes(booking.bookingStatus)}
                  className="ac-btn ac-btn-danger flex-1"
                >
                  Отменить
                </button>
              </div>
              <button
                onClick={onEdit}
                disabled={busy || booking.bookingStatus === "REFUNDED"}
                className="ac-btn w-full border-violet-200 text-violet-600 hover:bg-violet-50"
              >
                ✏️ Изменить даты и сумму
              </button>
            </div>
          )}
          {tab === "client" && (
            <InfoBlock title="Клиент">
              <InfoRow k="Имя" v={booking.client} />
              <InfoRow k="Тип" v="Физическое лицо" />
              <InfoRow k="Статус" v="Постоянный клиент" />
              <InfoRow k="История" v="5 бронирований · 4 завершено" />
            </InfoBlock>
          )}
          {tab === "order" && (
            <InfoBlock title="Заказ">
              <InfoRow k="Номер заказа" v={booking.orderId} />
              <InfoRow k="Дата создания" v={fmtDateTime(booking.createdAt)} />
              <InfoRow k="Состав" v="1 позиция" />
              <InfoRow k="Сумма" v={fmtMoney(booking.amount)} />
            </InfoBlock>
          )}
          {tab === "service" && (
            <InfoBlock title="Услуга">
              <InfoRow k="Название" v={booking.service} />
              <InfoRow k="Категория" v={booking.category} />
              <InfoRow k="Направление" v={booking.direction} />
              <InfoRow k="Дата поездки" v={fmtDate(booking.serviceDate)} />
              <InfoRow k="Валюта" v={booking.currency} />
            </InfoBlock>
          )}
          {tab === "provider" && (
            <InfoBlock title="Поставщик / Партнёр">
              <InfoRow k="Поставщик" v={booking.provider} />
              <InfoRow k="Партнёр" v={booking.partner} />
              <InfoRow k="Рейтинг" v="★★★★☆ 4.2" />
              <InfoRow k="SLA" v="Ответ ≤ 12 ч" />
            </InfoBlock>
          )}
          {tab === "payments" && (
            <InfoBlock title="Платежи">
              <InfoRow k="Сумма" v={fmtMoney(booking.amount)} />
              <InfoRow k="Способ" v={booking.paymentStatus === "paid" ? "Банковская карта" : "Ожидание"} />
              <InfoRow k="Статус" v={<Badge label={booking.paymentStatus === "paid" ? "Оплачен" : booking.paymentStatus === "pending" ? "Ожидает" : "Возврат"} className={PAY_STYLES[booking.paymentStatus]} />} />
            </InfoBlock>
          )}
          {tab === "documents" && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[var(--admin-muted)] uppercase mb-2">Документы</h3>
              {["Ваучер", "Договор оферты", "Чек об оплате"].map((d, i) => (
                <div key={d} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--admin-bg)] text-sm">
                  <span className="text-base">{i === 0 ? "🎫" : i === 1 ? "📄" : "🧾"}</span>
                  <span className="flex-1 text-[var(--admin-text)]">{d}</span>
                  <span className="text-[var(--admin-muted)] text-xs">{booking.paymentStatus === "paid" ? "Готов" : "—"}</span>
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
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {tab === "messages" && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-[var(--admin-muted)] uppercase">Переписка</h3>
              {/* Лента сообщений */}
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

              {/* Быстрые ответы */}
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

              {/* Поле ввода */}
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
          {tab === "ai" && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[var(--admin-muted)] uppercase mb-2">AI-анализ</h3>
              <div className="bg-gradient-to-br from-fuchsia-500 to-pink-500 rounded-xl p-4 text-white text-sm space-y-2">
                <p>🛡️ <b>Риск отмены:</b> {booking.paymentStatus === "pending" ? "средний (18%) — клиент не оплатил в течение 24 ч" : "низкий (3%)"}</p>
                <p>⏱️ <b>Рекомендация:</b> {booking.paymentStatus === "pending" ? "отправить напоминание об оплате" : "отправить документы и чек клиенту"}</p>
              </div>
              {["Почему эта бронь в зоне риска?", "Спрогнозируй вероятность отмены", "Что сделать, чтобы удержать клиента?"].map((q) => (
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

/* ─── Модальное окно создания бронирования (Гл. 5.4 «Создать бронирование») ─── */
function CreateBookingModal({ onClose, onCreated }: { onClose: () => void; onCreated: (msg: string) => void }) {
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

  // Загрузка справочников при открытии формы
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/bookings?mode=form");
        if (!res.ok) throw new Error("Ошибка загрузки справочников");
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

  // Минимальная дата «завтра» — считается один раз при открытии формы (импурная
  // операция Date.now() вынесена в ленивый инициализатор состояния, чтобы не
  // нарушать react-hooks/purity).
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
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: clientId,
          serviceId,
          // Полдень локального времени: дата без времени парсится как UTC-полночь,
          // что на машинах с отрицательным смещением может дать «вчера»
          serviceDate: new Date(`${serviceDate}T12:00:00`).toISOString(),
          amount: amount ? parseFloat(amount) : undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.detail ?? json?.error ?? "Не удалось создать бронирование");
        return;
      }
      onCreated(json?.message ?? "Бронирование создано");
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
        {/* Шапка */}
        <div className="px-5 py-4 border-b border-[var(--admin-border)] flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[var(--admin-text)]">➕ Создать бронирование</h2>
            <p className="text-xs text-[var(--admin-muted)] mt-0.5">Новая бронь создаётся со статусом «Ожидает подтверждения»</p>
          </div>
          <button onClick={onClose} className="ac-btn ac-btn-ghost ac-btn-icon">
            ✕
          </button>
        </div>

        {/* Форма */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              {/* Клиент */}
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

              {/* Услуга + категория */}
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

              {/* Дата поездки + сумма */}
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

        {/* Футер */}
        <div className="px-5 py-4 border-t border-[var(--admin-border)] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="ac-btn ac-btn-secondary"
          >
            Отмена
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting || loading || !clientId || !serviceId || !serviceDate}
            className="ac-btn ac-btn-primary"
          >
            {submitting ? "Создаём…" : "Создать бронирование"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Модальное окно редактирования бронирования (Гл. 5.4 «Изменить») ─── */
function EditBookingModal({ booking, onClose, onSaved }: { booking: BookingRow; onClose: () => void; onSaved: (msg: string, updated: BookingRow) => void }) {
  const [serviceDate, setServiceDate] = useState(() => booking.serviceDate.slice(0, 10));
  const [amount, setAmount] = useState(String(booking.amount));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Минимальная дата: завтра, но не строже текущей даты брони (чтобы можно было сохранить без изменений)
  const [minDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrow = d.toISOString().slice(0, 10);
    const current = booking.serviceDate.slice(0, 10);
    return current < tomorrow ? current : tomorrow;
  });

  const handleSave = async () => {
    setError(null);
    const currentDate = booking.serviceDate.slice(0, 10);
    const dateChanged = serviceDate !== currentDate;
    const newAmount = parseFloat(amount);
    const amountChanged = newAmount !== booking.amount;
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
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          // Полдень локального времени — см. комментарий в форме создания
          serviceDate: dateChanged ? new Date(`${serviceDate}T12:00:00`).toISOString() : undefined,
          amount: amountChanged ? newAmount : undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.detail ?? json?.error ?? "Не удалось сохранить изменения");
        return;
      }
      onSaved(json?.message ?? "Бронирование изменено", json?.booking);
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
        {/* Шапка */}
        <div className="px-5 py-4 border-b border-[var(--admin-border)] flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[var(--admin-text)]">✏️ Изменить бронирование</h2>
            <p className="text-xs text-[var(--admin-muted)] mt-0.5">{booking.bookingNumber} · {booking.client}</p>
          </div>
          <button onClick={onClose} className="ac-btn ac-btn-ghost ac-btn-icon">
            ✕
          </button>
        </div>

        {/* Форма */}
        <div className="p-5 space-y-4">
          <div className="bg-[var(--admin-bg)] rounded-xl p-3 text-xs text-[var(--admin-muted)]">
            <b className="text-[var(--admin-text)]">{booking.service}</b>
            <div className="mt-0.5">{booking.direction} · {booking.category}</div>
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
              <label className="text-[11px] font-medium text-[var(--admin-muted)] mb-1.5 block">Сумма, {booking.currency}</label>
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

        {/* Футер */}
        <div className="px-5 py-4 border-t border-[var(--admin-border)] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="ac-btn ac-btn-secondary"
          >
            Отмена
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={submitting}
            className="ac-btn ac-btn-primary"
          >
            {submitting ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Главный компонент ─── */
export default function BookingCenter() {
  const [data, setData] = useState<BookingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState("month");
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  // Сортировка таблицы по числу непрочитанных сообщений (убывание), Гл. 5.8
  const [sortUnread, setSortUnread] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const [chartMode, setChartMode] = useState<"line" | "bar" | "area">("line");
  const [aiOpen, setAiOpen] = useState(false);
  const [savedFilters, setSavedFilters] = useState<string[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<BookingRow | null>(null);
  // Счётчик обновлений журнала: инкремент после действия → сайдбар перезагружает «Историю»
  const [historyVersion, setHistoryVersion] = useState(0);
  // Выбранные строки таблицы для массовых действий (Гл. 5.8)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRunning, setBulkRunning] = useState<string | null>(null);

  // Фильтры (Гл. 5.5)
  const [filters, setFilters] = useState({
    country: "",
    city: "",
    type: "",
    status: "",
    paymentStatus: "",
    manager: "",
    source: "",
    currency: "",
    minPrice: "",
    maxPrice: "",
    // «Требуют внимания»: только брони с непрочитанными сообщениями (Гл. 5.6)
    needsAttention: false,
  });

  // Справочники для каскадных фильтров «Страна → Город» (все страны из БД, Гл. 5.6)
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  const [countryCities, setCountryCities] = useState<string[]>([]);
  // Счётчик запросов городов: игнорирует устаревшие ответы при быстрой смене страны
  const cityReqSeq = useRef(0);

  const fetchData = useCallback(async (): Promise<BookingsData | null> => {
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
      if (filters.paymentStatus) params.set("paymentStatus", filters.paymentStatus);
      if (filters.manager) params.set("manager", filters.manager);
      if (filters.source) params.set("source", filters.source);
      if (filters.currency) params.set("currency", filters.currency);
      if (filters.minPrice) params.set("minPrice", filters.minPrice);
      if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
      if (filters.needsAttention) params.set("needsAttention", "1");
      if (sortUnread) params.set("sort", "unread");

      const res = await fetch(`/api/admin/bookings?${params.toString()}`);
      if (!res.ok) throw new Error(await describeApiError(res, "Ошибка загрузки данных"));
      const json: unknown = await res.json();
      // Защита от неполного/устаревшего ответа (например, без funnel): невалидный
      // ответ не должен попадать в состояние — иначе рендер упадёт с белым экраном.
      const requiredKeys = [
        "kpi",
        "funnel",
        "bookingsSeries",
        "confirmSeries",
        "bookingsByService",
        "bookingsByCountry",
        "heatmap",
        "financial",
        "bookings",
        "pagination",
      ];
      if (typeof json !== "object" || json === null || requiredKeys.some((k) => !(k in json))) {
        throw new Error("Некорректный ответ сервера — обновите страницу");
      }
      return json as BookingsData;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
      return null;
    } finally {
      setLoading(false);
    }
  }, [period, page, filters, sortUnread]);

  // ── Справочник стран для фильтра «Страна» — все страны из БД (Гл. 5.6) ──
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      try {
        const res = await fetch("/api/countries");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          const list = ((json.countries ?? []) as { code: string; name: string }[])
            .map((c) => ({ code: c.code, name: c.name }))
            .sort((a, b) => a.name.localeCompare(b.name, "ru"));
          setCountries(list);
        }
      } catch {
        /* не критично — останется запасной список из bookingsByCountry */
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Действия с бронированием (PATCH /api/admin/bookings/[id]) ──
  const runBookingAction = useCallback(
    async (id: string, action: "confirm" | "pay" | "cancel" | "complete") => {
      setActing(action);
      setActionMsg(null);
      try {
        const res = await fetch(`/api/admin/bookings/${id}`, {
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
        // Применяем свежие данные (fetchData возвращает результат, но эффект-загрузчик
        // не сработает — обновляем состояние здесь) и синхронизируем открытую карточку
        const fresh = await fetchData();
        if (fresh) setData(fresh);
        if (json?.booking?.status) {
          setSelectedBooking((prev) =>
            prev?.id === id
              ? {
                  ...prev,
                  bookingStatus: json.booking.status as string,
                  paymentStatus:
                    json.booking.status === "PAID" || json.booking.status === "COMPLETED"
                      ? "paid"
                      : json.booking.status === "REFUNDED"
                      ? "refunded"
                      : "pending",
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

  // Быстрое действие «Подтвердить/Отменить/Отправить на оплату» работает по выбранной строке
  const quickActionOnSelection = async (action: "confirm" | "cancel" | "pay") => {
    if (!selectedBooking) {
      setActionMsg({ ok: false, text: "Сначала выберите бронирование в таблице" });
      return;
    }
    const ok = await runBookingAction(selectedBooking.id, action);
    if (ok) setSelectedBooking(null);
  };

  // Защита от гонки запросов: применяем только ответ последнего запроса
  const requestSeq = useRef(0);
  useEffect(() => {
    // setState вызывается в микротаске, а не синхронно в теле эффекта
    // (react-hooks/set-state-in-effect)
    const seq = ++requestSeq.current;
    void Promise.resolve()
      .then(fetchData)
      .then((res) => {
        if (seq === requestSeq.current && res) setData(res);
      });
  }, [fetchData]);

  const resetFilters = () => {
    setFilters({ country: "", city: "", type: "", status: "", paymentStatus: "", manager: "", source: "", currency: "", minPrice: "", maxPrice: "", needsAttention: false });
    setPage(1);
  };

  const saveFilter = () => {
    const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "Период";
    const statusLabel = filters.status
      ? STATUS_LABELS[filters.status] ?? BOOKING_STATUSES.find((o) => o.key === filters.status)?.label ?? filters.status
      : "все статусы";
    const attentionLabel = filters.needsAttention ? " · 💬 требует внимания" : "";
    const label = `${periodLabel} · ${statusLabel}${attentionLabel}`;
    if (!savedFilters.includes(label)) setSavedFilters([...savedFilters, label]);
  };

  const removeSavedFilter = (label: string) => {
    setSavedFilters(savedFilters.filter((s) => s !== label));
  };

  // Экспорт текущей таблицы в CSV (Гл. 5.4 «Экспорт»)
  const exportCsv = () => {
    if (!data?.bookings.length) return;
    const headers = ["№ брони", "№ заказа", "Клиент", "Партнёр", "Поставщик", "Услуга", "Категория", "Направление", "Стоимость", "Валюта", "Статус", "Оплата", "Непрочитанные", "Менеджер", "Создано", "Дата поездки", "Изменено"];
    const rows = data.bookings.map((b) => [
      b.bookingNumber, b.orderId, b.client, b.partner, b.provider, b.service, b.category, b.direction,
      String(b.amount), b.currency,
      STATUS_LABELS[b.bookingStatus] ?? b.bookingStatus,
      b.paymentStatus === "paid" ? "Оплачен" : b.paymentStatus === "pending" ? "Ожидает" : "Возврат",
      b.unreadCount ?? 0, b.manager, fmtDate(b.createdAt), fmtDate(b.serviceDate), fmtDate(b.updatedAt),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Клик по KPI-карточке → фильтр статуса (Гл. 5.5) ──
  // Плавная прокрутка к панели фильтрации + toggle: повторный клик сбрасывает фильтр.
  // Карточки взаимоисключающие: клик по карточке статуса снимает фильтр
  // «Требуют внимания» (needsAttention), чтобы не получить пустую комбинацию.
  const scrollToFilterPanel = () => {
    document.getElementById("booking-filter-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const toggleStatusFilter = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status === value ? "" : value,
      needsAttention: false,
    }));
    setPage(1);
    scrollToFilterPanel();
  };

  // Каскад «Страна → Город» (как в каталоге услуг, Гл. 5.6): смена страны
  // сбрасывает город и подгружает города выбранной страны из БД.
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
    /** Текст бейджа в активном состоянии (по умолчанию «✕ снять») */
    activeHint?: string;
    /** Мини-прогресс-бар под карточкой (например, прогресс завершённости) */
    progress?: { pct: number };
  }[] = data
    ? [
        {
          title: "Новые бронирования",
          value: String(data.kpi.newBookings.value),
          change: `${data.kpi.newBookings.change >= 0 ? "+" : ""}${data.kpi.newBookings.change.toFixed(0)}%`,
          changeType: data.kpi.newBookings.change >= 0 ? "up" : "down",
          subtitle: data.kpi.newBookings.detail,
          icon: "🆕",
          color: "from-blue-500 to-indigo-500",
          // Клик по карточке фильтрует по статусу PENDING — «Ожидает подтверждения» (Гл. 5.5)
          onClick: () => toggleStatusFilter("PENDING"),
          active: filters.status === "PENDING",
        },
        {
          title: "Подтверждённые",
          value: String(data.kpi.confirmedBookings.value),
          change: `${data.kpi.confirmedBookings.change >= 0 ? "+" : ""}${data.kpi.confirmedBookings.change.toFixed(0)}%`,
          changeType: data.kpi.confirmedBookings.change >= 0 ? "up" : "down",
          subtitle: data.kpi.confirmedBookings.detail,
          icon: "✅",
          color: "from-emerald-500 to-teal-500",
          // Клик по карточке фильтрует по статусу CONFIRMED — «подтверждены, ждут оплаты»,
          // без оплаченных и завершённых (Гл. 5.5)
          onClick: () => toggleStatusFilter("CONFIRMED"),
          active: filters.status === "CONFIRMED",
        },
        {
          title: "Ожидают оплаты",
          value: String(data.kpi.awaitingPayment.value),
          change: `${data.kpi.awaitingPayment.change >= 0 ? "+" : ""}${data.kpi.awaitingPayment.change.toFixed(0)}%`,
          changeType: data.kpi.awaitingPayment.change > 0 ? "down" : "up",
          subtitle: data.kpi.awaitingPayment.detail,
          icon: "⏳",
          color: "from-amber-500 to-orange-500",
          // Клик по карточке фильтрует по группе PENDING,CONFIRMED — той же, по которой
          // считается KPI, чтобы число карточки совпадало с таблицей (Гл. 5.5)
          onClick: () => toggleStatusFilter("PENDING,CONFIRMED"),
          active: filters.status === "PENDING,CONFIRMED",
        },
        {
          title: "Оплаченные",
          value: String(data.kpi.paidBookings.value),
          change: `${data.kpi.paidBookings.change >= 0 ? "+" : ""}${data.kpi.paidBookings.change.toFixed(0)}%`,
          changeType: data.kpi.paidBookings.change >= 0 ? "up" : "down",
          subtitle: data.kpi.paidBookings.detail,
          icon: "💳",
          color: "from-cyan-500 to-blue-500",
          // Клик по карточке фильтрует по группе PAID,COMPLETED — «Оплата = оплачена»,
          // той же, по которой считается KPI, чтобы число карточки совпадало с таблицей (Гл. 5.5)
          onClick: () => toggleStatusFilter("PAID,COMPLETED"),
          active: filters.status === "PAID,COMPLETED",
        },
        {
          title: "Отменённые",
          value: String(data.kpi.cancelledBookings.value),
          change: `${data.kpi.cancelledBookings.change >= 0 ? "+" : ""}${data.kpi.cancelledBookings.change.toFixed(0)}%`,
          changeType: data.kpi.cancelledBookings.change > 0 ? "down" : "up",
          subtitle: data.kpi.cancelledBookings.detail,
          icon: "❌",
          color: "from-red-500 to-rose-500",
          // Клик по карточке фильтрует по статусу REFUNDED (Гл. 5.5)
          onClick: () => toggleStatusFilter("REFUNDED"),
          active: filters.status === "REFUNDED",
        },
        {
          title: "Завершённые",
          value: String(data.kpi.completedBookings.value),
          change: `${data.kpi.completedBookings.change >= 0 ? "+" : ""}${data.kpi.completedBookings.change.toFixed(0)}%`,
          changeType: data.kpi.completedBookings.change >= 0 ? "up" : "down",
          subtitle: data.kpi.completedBookings.detail,
          icon: "🏁",
          color: "from-green-500 to-emerald-600",
          // Клик по карточке фильтрует по статусу COMPLETED (Гл. 5.5)
          onClick: () => toggleStatusFilter("COMPLETED"),
          active: filters.status === "COMPLETED",
          // Прогресс завершённости: доля COMPLETED от всех оплаченных (PAID + COMPLETED)
          // — знаменатель уже включает завершённых, т.к. «Оплаченные» = PAID+COMPLETED (Гл. 5.5)
          progress: (() => {
            const paid = data.kpi.paidBookings.value;
            const completed = data.kpi.completedBookings.value;
            const total = paid;
            return { pct: total ? Math.round((completed / total) * 100) : 0 };
          })(),
        },
        {
          title: "Требуют внимания",
          value: String(data.kpi.needsAttention.value),
          change: `${data.kpi.needsAttention.change >= 0 ? "+" : ""}${data.kpi.needsAttention.change.toFixed(0)}%`,
          changeType: data.kpi.needsAttention.change > 0 ? "down" : "up",
          subtitle: data.kpi.needsAttention.detail,
          icon: "💬",
          color: "from-rose-500 to-red-500",
          // Клик по карточке переключает фильтр «Требуют внимания» в панели фильтрации (Гл. 5.5).
          // Карточки взаимоисключающие: снимаем фильтр статуса, чтобы не комбинировать два активных.
          onClick: () => {
            setFilters((prev) => ({
              ...prev,
              needsAttention: !prev.needsAttention,
              status: "",
            }));
            setPage(1);
            scrollToFilterPanel();
          },
          active: filters.needsAttention,
        },
        { title: "Конверсия бронь→оплата", value: `${data.kpi.conversion.value.toFixed(1)}%`, change: "", changeType: "neutral", subtitle: data.kpi.conversion.detail, icon: "🎯", color: "from-pink-500 to-rose-500" },
        { title: "Прогноз AI", value: String(data.kpi.forecastAI.value), change: "", changeType: "neutral", subtitle: data.kpi.forecastAI.detail, icon: "🤖", color: "from-fuchsia-500 to-pink-500" },
      ]
    : [];

  const bookingsSeriesPoints = useMemo(
    () => (data ? data.bookingsSeries.labels.map((l, i) => ({ label: l, value: data.bookingsSeries.values[i] })) : []),
    [data]
  );
  const confirmSeriesPoints = useMemo(
    () => (data ? data.confirmSeries.labels.map((l, i) => ({ label: l, value: data.confirmSeries.values[i] })) : []),
    [data]
  );

  // Диаграмма «Статусы бронирований»: все сегменты — по полному периоду. «Оплачено»
  // здесь только PAID (завершённые вынесены отдельным сегментом COMPLETED), т.к. KPI
  // «Оплаченные» = PAID + COMPLETED и без вычитания сегменты задвоили бы завершённых.
  const statusDonutData = useMemo(
    () =>
      data
        ? [
            { label: "Ожидает", value: data.kpi.awaitingPayment.value, color: "#f59e0b" },
            { label: "Оплачено", value: Math.max(0, data.kpi.paidBookings.value - data.kpi.completedBookings.value), color: "#22c55e" },
            { label: "Завершено", value: data.kpi.completedBookings.value, color: "#14b8a6" },
            { label: "Возвращено", value: data.kpi.cancelledBookings.value, color: "#ef4444" },
          ]
        : [],
    [data]
  );

  const serviceDonutData = useMemo(
    () =>
      (data?.bookingsByService || []).map((s, i) => ({ label: s.label, value: s.count, color: CHART_COLORS[i % CHART_COLORS.length] })),
    [data]
  );

  // Клиентский поиск по таблице
  const visibleBookings = useMemo(() => {
    const rows = data?.bookings || [];
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(
      (b) =>
        b.bookingNumber.toLowerCase().includes(q) ||
        b.orderId.toLowerCase().includes(q) ||
        b.client.toLowerCase().includes(q) ||
        b.service.toLowerCase().includes(q) ||
        b.direction.toLowerCase().includes(q) ||
        b.provider.toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  // ── Чипы активных фильтров в шапке таблицы (Гл. 5.8) ──
  // Показывают, какие фильтры/селекты применены; клик по ✕ сбрасывает фильтр.
  const clearFilterChip = (patch: Partial<typeof filters>, clearSearch = false) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    if (clearSearch) setSearchQuery("");
    setPage(1);
  };
  const activeFilterChips: ActiveFilterChip[] = [];
  {
    const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;
    activeFilterChips.push({ key: "period", label: `Период: ${periodLabel}` });
    if (filters.country) {
      const name =
        countries.find((c) => c.code === filters.country)?.name ??
        data?.bookingsByCountry.find((c) => c.code === filters.country)?.country ??
        filters.country;
      activeFilterChips.push({ key: "country", label: `Страна: ${name}`, onClear: () => clearFilterChip({ country: "", city: "" }) });
    }
    if (filters.city) activeFilterChips.push({ key: "city", label: `Город: ${filters.city}`, onClear: () => clearFilterChip({ city: "" }) });
    if (filters.type) {
      activeFilterChips.push({ key: "type", label: `Категория: ${SERVICE_TYPES.find((t) => t.key === filters.type)?.label ?? filters.type}`, onClear: () => clearFilterChip({ type: "" }) });
    }
    if (filters.status) {
      const statusLabel = STATUS_LABELS[filters.status] ?? BOOKING_STATUSES.find((o) => o.key === filters.status)?.label ?? filters.status;
      activeFilterChips.push({ key: "status", label: `Статус: ${statusLabel}`, onClear: () => clearFilterChip({ status: "" }) });
    }
    if (filters.paymentStatus) {
      activeFilterChips.push({ key: "paymentStatus", label: `Оплата: ${PAYMENT_STATUSES.find((o) => o.key === filters.paymentStatus)?.label ?? filters.paymentStatus}`, onClear: () => clearFilterChip({ paymentStatus: "" }) });
    }
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

  // Состояние выбора «все на странице» / «частично» — для чекбокса в шапке таблицы
  const allVisibleSelected = visibleBookings.length > 0 && visibleBookings.every((b) => selectedIds.includes(b.id));
  const someVisibleSelected = visibleBookings.some((b) => selectedIds.includes(b.id));

  // ── Массовые действия: выбор чекбоксами → POST /api/admin/bookings/bulk (Гл. 5.8) ──
  const toggleRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleAllVisible = () => {
    const ids = visibleBookings.map((b) => b.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) => (allSelected ? prev.filter((x) => !ids.includes(x)) : [...new Set([...prev, ...ids])]));
  };
  const clearSelection = () => setSelectedIds([]);

  const runBulkAction = async (action: "confirm" | "pay" | "cancel") => {
    if (!selectedIds.length) return;
    setBulkRunning(action);
    setActionMsg(null);
    try {
      const res = await fetch("/api/admin/bookings/bulk", {
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
            className="ac-btn ac-btn-primary"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--admin-bg)]">
      {/* ─── Breadcrumbs (Гл. 5.3) ─── */}
      <div className="px-4 lg:px-6 py-3 border-b border-[var(--admin-border)]">
        <nav className="text-xs text-[var(--admin-muted)] flex items-center gap-1.5">
          <span>Главная</span>
          <span>→</span>
          <span className="text-[var(--admin-text)] font-medium">Бронирования (Booking Center)</span>
        </nav>
      </div>

      {/* ─── Панель быстрых действий (Гл. 5.4) ─── */}
      <div className="px-4 lg:px-6 py-3 border-b border-[var(--admin-border)] overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 min-w-max">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => {
                if (action.icon === "🤖") setAiOpen(true);
                if (action.label === "Сформировать отчет") exportCsv();
                if (action.label === "Создать бронирование") setCreateOpen(true);
                if (action.label === "Изменить") {
                  if (!selectedBooking) {
                    setActionMsg({ ok: false, text: "Сначала выберите бронирование в таблице" });
                  } else {
                    setEditBooking(selectedBooking);
                  }
                }
                if (action.label === "Подтвердить") void quickActionOnSelection("confirm");
                if (action.label === "Отправить на оплату") void quickActionOnSelection("pay");
                if (action.label === "Отменить") void quickActionOnSelection("cancel");
              }}
              className={`ac-btn shrink-0 text-white ${action.color} hover:opacity-90`}
              title={action.label}
            >
              <span>{action.icon}</span>
              <span className="hidden sm:inline">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── KPI-панель (Гл. 5.5): 9 карточек ─── */}
      <div className="px-4 lg:px-6 py-4">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-9 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
                <SkeletonBlock className="h-9 w-9 mb-3" />
                <SkeletonBlock className="h-6 w-20 mb-2" />
                <SkeletonBlock className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-9 gap-3">
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
                className={`ac-card ac-card-hover p-3.5 ${
                  card.onClick ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/60" : ""
                } ${card.active ? "ac-card-active ring-2 ring-primary/40" : ""}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={`ac-kpi-icon shrink-0 bg-gradient-to-br ${card.color} text-white shadow-lg`}>{card.icon}</div>
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
                <div className="text-2xl font-bold text-[var(--admin-text)] mb-1">{card.value}</div>
                {card.change && (
                  <div className={`text-xs font-semibold ${card.changeType === "up" ? "text-emerald-600" : card.changeType === "down" ? "text-red-600" : "text-[var(--admin-muted)]"}`}>
                    {card.change}
                  </div>
                )}
                {card.subtitle && <div className="text-[10px] text-[var(--admin-muted)] mt-1">{card.subtitle}</div>}
                {card.progress && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[10px] text-[var(--admin-muted)] mb-1">
                      <span>Прогресс завершённости</span>
                      <span className="font-semibold text-emerald-600">{card.progress.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-[var(--admin-bg)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, card.progress.pct)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─── Воронка конверсии (Гл. 5.5): создано → подтверждено → оплачено ─── */}
        {/* data.funnel в guard: даже частичный ответ не должен ронять всю страницу */}
        {!loading && data && data.funnel && (() => {
          const entry = data.funnel.entry;
          const confirmed = data.funnel.confirmed;
          const paid = data.funnel.paid;
          const conv1 = entry ? Math.round((confirmed / entry) * 100) : 0;
          const conv2 = confirmed ? Math.round((paid / confirmed) * 100) : 0;
          const convTotal = entry ? Math.round((paid / entry) * 100) : 0;
          const stages = [
            { label: "Новые бронирования", icon: "🆕", value: entry, pct: 100, share: 100, color: "from-blue-500 to-indigo-500", fromPrev: null },
            { label: "Подтверждённые", icon: "✅", value: confirmed, pct: entry ? Math.round((confirmed / entry) * 100) : 0, share: conv1, color: "from-emerald-500 to-teal-500", fromPrev: conv1 },
            { label: "Оплаченные", icon: "💳", value: paid, pct: entry ? Math.round((paid / entry) * 100) : 0, share: convTotal, color: "from-cyan-500 to-blue-500", fromPrev: conv2 },
          ];
          return (
            <div className="mt-3 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <h3 className="text-sm font-semibold text-[var(--admin-text)]">🔻 Воронка конверсии</h3>
                <span className="text-[10px] text-[var(--admin-muted)]">жизненный цикл: создано → подтверждено → оплачено · полный период</span>
              </div>
              <div className="space-y-1">
                {stages.map((s) => (
                  <div key={s.label}>
                    {s.fromPrev !== null && (
                      <div className="flex items-center gap-1.5 pl-40 mb-1 text-[10px] font-medium text-emerald-600">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 text-[9px] shrink-0">↓</span>
                        {s.fromPrev}% перешли на этап
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="w-40 shrink-0 flex items-center gap-2">
                        <span className="text-sm shrink-0">{s.icon}</span>
                        <span className="text-xs font-medium text-[var(--admin-text)]">{s.label}</span>
                      </div>
                      <div className="flex-1">
                        <div
                          className={`h-8 rounded-lg bg-gradient-to-r ${s.color} flex items-center px-3 text-white text-xs font-bold shadow-sm transition-all`}
                          style={{ width: `${Math.max(30, s.pct)}%` }}
                        >
                          {s.value}
                        </div>
                      </div>
                      <div className="w-14 shrink-0 text-right text-xs font-semibold text-[var(--admin-muted)]">{s.share}%</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--admin-border)] text-[11px] text-[var(--admin-muted)]">
                Итог конверсии: <span className="font-bold text-emerald-600">{convTotal}%</span> броней дошли до оплаты ({paid} из {entry})
              </div>
            </div>
          );
        })()}
      </div>

      {/* ─── Панель фильтрации (Гл. 5.6) ─── */}
      <div id="booking-filter-panel" className="px-4 lg:px-6 pb-4">
        <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h3 className="text-sm font-semibold text-[var(--admin-text)]">Фильтры</h3>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--admin-muted)]">Период:</span>
              <div className="ac-tabs">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => { setPeriod(p.key); setPage(1); }}
                    className={`ac-tab ${period === p.key ? "ac-tab-active" : ""}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <button onClick={() => { setPage(1); fetchData(); }} className="ac-btn ac-btn-primary ac-btn-sm">
                Применить
              </button>
              <button onClick={resetFilters} className="ac-btn ac-btn-secondary ac-btn-sm">
                Сбросить
              </button>
              <button onClick={saveFilter} className="ac-btn ac-btn-secondary ac-btn-sm" title="Сохранить текущий фильтр">
                💾 Сохранить
              </button>
            </div>
          </div>

          {/* Быстрые фильтры */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <span className="text-[11px] text-[var(--admin-muted)]">Быстрые:</span>
            {[
              { label: "Ожидают оплаты", f: { status: "PENDING,CONFIRMED" } },
              { label: "Оплачено сегодня", f: { paymentStatus: "paid" } },
              { label: "Просроченные", f: { status: "PENDING" } },
              { label: "Возвраты", f: { status: "REFUNDED" } },
              { label: "💬 Требуют внимания", f: { needsAttention: true } },
            ].map((qf) => (
              <button
                key={qf.label}
                onClick={() => {
                  // Быстрые фильтры взаимоисключающие (как и KPI-карточки): статус и
                  // «Требуют внимания» не комбинируются, чтобы не получить пустую таблицу.
                  // Мержим в промежуточный объект, чтобы не перекрыть значение qf.f.
                  setFilters((prev) => {
                    const merged = { ...prev, ...qf.f };
                    if ("status" in qf.f) merged.needsAttention = false;
                    if ("needsAttention" in qf.f) merged.status = "";
                    return merged;
                  });
                  setPage(1);
                }}
                className="ac-chip"
              >
                {qf.label}
              </button>
            ))}
            {savedFilters.map((sf) => (
              <button
                key={sf}
                onClick={() => removeSavedFilter(sf)}
                className="ac-chip ac-chip-active"
                title="Удалить фильтр"
              >
                {sf} ✕
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            <FilterSelect
              label="Страна"
              value={filters.country}
              onChange={handleCountryChange}
              options={[
                { key: "", label: "Все" },
                ...(countries.length
                  ? countries.map((c) => ({ key: c.code, label: c.name }))
                  : (data?.bookingsByCountry.map((c) => ({ key: c.code, label: c.country })) ?? [])),
              ]}
            />
            <FilterSelect
              label="Город"
              value={filters.city}
              onChange={(v) => { setFilters({ ...filters, city: v }); setPage(1); }}
              disabled={!filters.country}
              options={[
                { key: "", label: filters.country ? "Все города" : "Сначала выберите страну" },
                ...countryCities.map((c) => ({ key: c, label: c })),
              ]}
            />
            <FilterSelect label="Категория услуги" value={filters.type} onChange={(v) => setFilters({ ...filters, type: v })} options={SERVICE_TYPES} />
            <FilterSelect label="Статус бронирования" value={filters.status} onChange={(v) => { setFilters({ ...filters, status: v, needsAttention: false }); setPage(1); }} options={BOOKING_STATUSES} />
            <FilterSelect label="Статус оплаты" value={filters.paymentStatus} onChange={(v) => setFilters({ ...filters, paymentStatus: v })} options={PAYMENT_STATUSES} />
            <FilterSelect label="Переписка" value={filters.needsAttention ? "1" : ""} onChange={(v) => { setFilters({ ...filters, needsAttention: v === "1", status: "" }); setPage(1); }} options={[{ key: "", label: "Все" }, { key: "1", label: "💬 Требуют внимания" }]} />
            <FilterSelect label="Менеджер" value={filters.manager} onChange={(v) => setFilters({ ...filters, manager: v })} options={[{ key: "", label: "Все" }, ...(data?.managers.map((m) => ({ key: m, label: m })) ?? [])]} />
            <FilterSelect label="Источник" value={filters.source} onChange={(v) => setFilters({ ...filters, source: v })} options={[{ key: "", label: "Все" }, { key: "Сайт", label: "Сайт" }, { key: "Партнёр", label: "Партнёр" }, { key: "Call-центр", label: "Call-центр" }, { key: "Telegram-бот", label: "Telegram-бот" }, { key: "WhatsApp", label: "WhatsApp" }]} />
            <FilterSelect label="Валюта" value={filters.currency} onChange={(v) => setFilters({ ...filters, currency: v })} options={CURRENCIES.map((c) => ({ key: c, label: c || "Все" }))} />
            <div>
              <label className="text-[10px] font-medium text-[var(--admin-muted)] mb-1 block">Мин. стоимость</label>
              <input value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} placeholder="0" className="w-full h-9 px-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-[var(--admin-muted)] mb-1 block">Макс. стоимость</label>
              <input value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} placeholder="∞" className="w-full h-9 px-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-xs text-[var(--admin-text)] outline-none focus:border-primary transition-colors" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Рабочая область 25/50/25 (Гл. 5.7) ─── */}
      <div className="px-4 lg:px-6 pb-4">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* ── Левая колонка (25%) ── */}
          <div className="xl:col-span-3 space-y-4">
            <Widget title="🕒 Последние бронирования">
              {loading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-12 w-full" />)}</div>
              ) : (
                <div className="space-y-2">
                  {(data?.recentBookings || []).slice(0, 4).map((b) => (
                    <div key={b.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-[var(--admin-bg)] transition-colors cursor-pointer" onClick={() => { const row = data?.bookings.find((x) => x.id === b.id); if (row) setSelectedBooking(row); }}>
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{b.client[0]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-[var(--admin-text)] truncate">{b.client}</div>
                        <div className="text-[10px] text-[var(--admin-muted)] truncate">{b.service}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-[var(--admin-text)]">{fmtMoney(b.amount)}</div>
                        <Badge label={STATUS_LABELS[b.status] ?? b.status} className={STATUS_STYLES[b.status]} />
                      </div>
                    </div>
                  ))}
                  {!data?.recentBookings.length && <div className="text-xs text-[var(--admin-muted)]">Нет данных</div>}
                </div>
              )}
            </Widget>

            <Widget title="⚠️ Проблемные бронирования">
              {loading ? <SkeletonBlock className="h-32 w-full" /> : (
                <div className="space-y-2">
                  {(data?.problemBookings || []).map((p) => (
                    <div key={p.id} className={`p-2.5 rounded-xl text-xs ${p.urgency === "high" ? "bg-red-50 border border-red-100" : "bg-amber-50 border border-amber-100"}`}>
                      <div className="font-medium text-[var(--admin-text)] truncate">{p.client} — {p.service}</div>
                      <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">
                        {fmtMoney(p.amount)} · поездка {fmtDate(p.serviceDate)} {p.urgency === "high" ? "· 🔴 срочно" : "· 🟡 скоро"}
                      </div>
                    </div>
                  ))}
                  {!data?.problemBookings.length && <div className="text-xs text-[var(--admin-muted)]">Проблемных бронирований нет 🎉</div>}
                </div>
              )}
            </Widget>

            <div className="bg-gradient-to-br from-fuchsia-500 to-pink-500 rounded-2xl p-4 text-white">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">🤖 AI Рекомендации</h3>
              <div className="space-y-2">
                {(data?.aiRecommendations || []).slice(0, 4).map((r, i) => (
                  <div key={i} className="bg-white/10 rounded-xl p-2.5 text-xs">
                    <div className="font-medium">{r.title}</div>
                    <div className="text-white/70 text-[10px] mt-0.5">{r.effect}</div>
                  </div>
                ))}
              </div>
            </div>

            <Widget title="🔔 Уведомления поставщиков">
              <div className="space-y-2">
                {(data?.providerNotifications || []).map((n) => (
                  <div key={n.id} className="flex gap-2 p-2 rounded-xl bg-[var(--admin-bg)] text-xs">
                    <span className="shrink-0">{n.type === "warning" ? "⚠️" : "ℹ️"}</span>
                    <div>
                      <div className="font-medium text-[var(--admin-text)]">{n.title}</div>
                      <div className="text-[10px] text-[var(--admin-muted)]">{n.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Widget>
          </div>

          {/* ── Центральная колонка (50%) ── */}
          <div className="xl:col-span-6 space-y-4">
            <Widget title="📊 График бронирований">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div className="flex items-center gap-1">
                  {(["line", "bar", "area"] as const).map((m) => (
                    <button key={m} onClick={() => setChartMode(m)} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${chartMode === m ? "bg-primary text-white" : "text-[var(--admin-muted)] hover:bg-[var(--admin-bg)]"}`}>
                      {{ line: "📈 Линия", bar: "📊 Столбцы", area: "📉 Область" }[m]}
                    </button>
                  ))}
                </div>
              </div>
              {loading ? <SkeletonBlock className="h-[220px] w-full" /> : <RevenueChart data={bookingsSeriesPoints} mode={chartMode} height={220} color="#3b82f6" />}
            </Widget>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Widget title="🍩 Статусы бронирований">
                {loading ? <SkeletonBlock className="h-[180px] w-full" /> : <DonutChart data={statusDonutData} size={170} />}
              </Widget>
              <Widget title="🧳 Бронирования по услугам">
                {loading ? <SkeletonBlock className="h-[180px] w-full" /> : <DonutChart data={serviceDonutData} size={170} />}
              </Widget>
            </div>

            <Widget title="🌍 Бронирования по странам">
              {loading ? <SkeletonBlock className="h-[140px] w-full" /> : (
                <div className="space-y-2">
                  {(data?.bookingsByCountry || []).slice(0, 6).map((c) => {
                    const maxCount = Math.max(1, ...(data?.bookingsByCountry || []).slice(0, 6).map((x) => x.count));
                    return (
                      <div key={c.code} className="flex items-center justify-between text-sm">
                        <span className="text-[var(--admin-muted)] text-xs">{c.code} · {c.country}</span>
                        <div className="flex items-center gap-3 flex-1 mx-3">
                          <div className="h-1.5 bg-[var(--admin-bg)] rounded-full flex-1 overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${(c.count / maxCount) * 100}%` }} />
                          </div>
                          <span className="font-semibold text-xs w-8 text-right">{c.count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Widget>

            <Widget title="🔥 Тепловая карта активности">
              {loading ? <SkeletonBlock className="h-[140px] w-full" /> : <ActivityHeatmap data={data?.heatmap ?? []} />}
            </Widget>

            <Widget title="✅ Динамика подтверждений">
              {loading ? <SkeletonBlock className="h-[160px] w-full" /> : <RevenueChart data={confirmSeriesPoints} mode="area" height={160} color="#22c55e" />}
            </Widget>
          </div>

          {/* ── Правая колонка (25%) ── */}
          <div className="xl:col-span-3 space-y-4">
            <Widget title="💰 Финансовая информация">
              {loading ? <SkeletonBlock className="h-32 w-full" /> : (
                <div className="space-y-3">
                  {[
                    { label: "Всего бронирований", value: fmtMoney(data?.financial.totalAmount ?? 0), color: "text-[var(--admin-text)]" },
                    { label: "Оплачено", value: fmtMoney(data?.financial.paidAmount ?? 0), color: "text-emerald-600" },
                    { label: "Ожидает оплаты", value: fmtMoney(data?.financial.pendingAmount ?? 0), color: "text-amber-600" },
                    { label: "Возвращено", value: fmtMoney(data?.financial.refundedAmount ?? 0), color: "text-red-600" },
                    { label: "Комиссия (12%)", value: fmtMoney(data?.financial.commission ?? 0), color: "text-blue-600" },
                    { label: "Выплаты партнёрам", value: fmtMoney(data?.financial.expectedPayouts ?? 0), color: "text-violet-600" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-xs text-[var(--admin-muted)]">{item.label}</span>
                      <span className={`text-xs font-bold ${item.color}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </Widget>

            <Widget title="💳 Ожидающие оплаты">
              {loading ? <SkeletonBlock className="h-32 w-full" /> : (
                <div className="space-y-2">
                  {(data?.pendingPayments || []).map((p) => (
                    <div key={p.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-[var(--admin-bg)] transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-[var(--admin-text)] truncate">{p.client}</div>
                        <div className="text-[10px] text-[var(--admin-muted)] truncate">{p.service}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-amber-600">{fmtMoney(p.amount)}</div>
                        <div className="text-[10px] text-[var(--admin-muted)]">{fmtDate(p.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                  {!data?.pendingPayments.length && <div className="text-xs text-[var(--admin-muted)]">Нет ожидающих оплат</div>}
                </div>
              )}
            </Widget>

            <Widget title="✈️ Ближайшие даты поездок">
              {loading ? <SkeletonBlock className="h-32 w-full" /> : (
                <div className="space-y-2">
                  {(data?.upcomingTrips || []).map((t) => (
                    <div key={t.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--admin-bg)] text-xs">
                      <span className="text-base">📅</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[var(--admin-text)] truncate">{t.client}</div>
                        <div className="text-[10px] text-[var(--admin-muted)] truncate">{t.destination}</div>
                      </div>
                      <div className="text-right shrink-0 font-semibold text-primary">{fmtDate(t.serviceDate)}</div>
                    </div>
                  ))}
                  {!data?.upcomingTrips.length && <div className="text-xs text-[var(--admin-muted)]">Нет ближайших поездок</div>}
                </div>
              )}
            </Widget>

            <Widget title="⏰ Просроченные подтверждения">
              {loading ? <SkeletonBlock className="h-24 w-full" /> : (
                <div className="space-y-2">
                  {(data?.overdueConfirmations || []).map((o) => (
                    <div key={o.id} className="flex items-center gap-2 p-2 rounded-xl bg-red-50 border border-red-100 text-xs">
                      <span>⏱️</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[var(--admin-text)] truncate">{o.client}</div>
                        <div className="text-[10px] text-[var(--admin-muted)] truncate">{o.service}</div>
                      </div>
                      <div className="text-right shrink-0 font-semibold text-red-600">{o.hours} ч</div>
                    </div>
                  ))}
                  {!data?.overdueConfirmations.length && <div className="text-xs text-[var(--admin-muted)]">Просрочек нет ✅</div>}
                </div>
              )}
            </Widget>

            <Widget title="🎯 Контроль SLA">
              {loading ? <SkeletonBlock className="h-24 w-full" /> : data && (
                <div className="space-y-3">
                  {/* Ср. время подтверждения — перенесено из KPI-карточек (Гл. 5.5) */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--admin-muted)]">⏱️ Ср. время подтверждения</span>
                    <span className="font-bold text-[var(--admin-text)]">{data.kpi.avgConfirm.value.toFixed(1)} ч</span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[var(--admin-muted)]">Соблюдение SLA (цель {data.sla.targetHours} ч)</span>
                      <span className={`text-xs font-bold ${data.sla.compliance >= 90 ? "text-emerald-600" : data.sla.compliance >= 70 ? "text-amber-600" : "text-red-600"}`}>{data.sla.compliance}%</span>
                    </div>
                    <div className="h-2 bg-[var(--admin-bg)] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${data.sla.compliance >= 90 ? "bg-emerald-500" : data.sla.compliance >= 70 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, data.sla.compliance)}%` }} />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-[var(--admin-muted)]">
                    <span>Просрочено: <b className="text-red-600">{data.sla.breaches}</b></span>
                    <span>Всего: {data.sla.total}</span>
                  </div>
                </div>
              )}
            </Widget>
          </div>
        </div>
      </div>

      {/* ─── Таблица бронирований (Гл. 5.8) ─── */}
      <div className="px-4 lg:px-6 pb-6">
        <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--admin-border)] flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-[var(--admin-text)]">Таблица бронирований {data?.pagination.total ? `(${data.pagination.total})` : ""}</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-[var(--admin-bg)] rounded-xl px-3 h-9 w-56">
                <span className="text-[var(--admin-muted)]">🔍</span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск: № брони, клиент, услуга…"
                  className="bg-transparent outline-none text-xs w-full"
                />
              </div>
              <button className="ac-btn ac-btn-secondary ac-btn-sm">📤 Экспорт</button>
            </div>
          </div>

          {/* Чипы активных фильтров — что сейчас применено (Гл. 5.8).
              Общий компонент ActiveFilterChips; чип периода отображается всегда,
              остальные — по мере применения фильтров. */}
          {activeFilterChips.length > 0 && (
            <div className="px-4 py-2.5 border-b border-[var(--admin-border)]">
              <ActiveFilterChips chips={activeFilterChips} />
            </div>
          )}

          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} className="h-12 w-full" />)}</div>
          ) : (
            <>
              {/* Панель массовых действий (видна при выборе ≥ 1 строки) */}
              {selectedIds.length > 0 && (
                <div className="px-4 py-2.5 border-b border-[var(--admin-border)] bg-primary/5 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-primary">Выбрано: {selectedIds.length}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => void runBulkAction("confirm")}
                      disabled={bulkRunning !== null}
                      className="ac-btn ac-btn-sm bg-emerald-500 text-white hover:bg-emerald-600"
                    >
                      {bulkRunning === "confirm" ? "Подтверждаем…" : `✅ Подтвердить (${selectedIds.length})`}
                    </button>
                    <button
                      onClick={() => void runBulkAction("pay")}
                      disabled={bulkRunning !== null}
                      className="ac-btn ac-btn-sm bg-blue-500 text-white hover:bg-blue-600"
                    >
                      {bulkRunning === "pay" ? "Отправляем…" : `💳 На оплату (${selectedIds.length})`}
                    </button>
                    <button
                      onClick={() => void runBulkAction("cancel")}
                      disabled={bulkRunning !== null}
                      className="ac-btn ac-btn-sm bg-red-500 text-white hover:bg-red-600"
                    >
                      {bulkRunning === "cancel" ? "Отменяем…" : `❌ Отменить (${selectedIds.length})`}
                    </button>
                  </div>
                  <button onClick={clearSelection} className="ac-btn ac-btn-secondary ac-btn-sm ml-auto">
                    ✕ Снять выбор
                  </button>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="ac-table whitespace-nowrap">
                  <thead>
                    <tr>
                      <th className="ac-th w-8 pl-4">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                          }}
                          onChange={toggleAllVisible}
                          title="Выбрать все на странице"
                          className="accent-[var(--primary)] w-4 h-4 cursor-pointer"
                        />
                      </th>
                      {["№ брони", "№ заказа", "Клиент", "Партнёр", "Поставщик", "Услуга", "Категория", "Направление", "Стоимость", "Валюта", "Статус брони", "Статус оплаты", "Переписка", "Менеджер", "Создано", "Дата поездки", "Изменено"].map((h) => (
                        <th key={h} className="ac-th">
                          {h === "Переписка" ? (
                            /* Клик по заголовку «Переписка» сортирует по числу непрочитанных (убывание), Гл. 5.8 */
                            <button
                              onClick={() => {
                                setSortUnread((v) => !v);
                                setPage(1);
                              }}
                              title={sortUnread ? "Сортировка по непрочитанным: включена" : "Сортировать по числу непрочитанных"}
                              className={`inline-flex items-center gap-1 font-semibold transition-colors ${
                                sortUnread ? "text-primary" : "text-[var(--admin-muted)] hover:text-[var(--admin-text)]"
                              }`}
                            >
                              {h}
                              <span className={`text-[9px] ${sortUnread ? "opacity-100" : "opacity-40"}`}>▼</span>
                            </button>
                          ) : (
                            h
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleBookings.map((b) => {
                      const isSelected = selectedIds.includes(b.id);
                      // Строки с непрочитанными сообщениями выделяются: лёгкая красная
                      // подложка + жирный шрифт (Гл. 5.8). Жирность сохраняется даже при
                      // выборе строки (фон выбирает приоритет, шрифт — независимо).
                      const hasUnread = b.unreadCount > 0;
                      return (
                      <tr
                        key={b.id}
                        onClick={() => setSelectedBooking(b)}
                        className={`ac-tr cursor-pointer ${
                          isSelected ? "bg-primary/5" : hasUnread ? "bg-red-50/70" : ""
                        } ${hasUnread ? "font-semibold" : ""}`}
                      >
                        <td className="ac-td w-8 pl-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(b.id)}
                            className="accent-[var(--primary)] w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="ac-td font-semibold text-primary">{b.bookingNumber}</td>
                        <td className="ac-td text-[var(--admin-muted)]">{b.orderId}</td>
                        <td className="ac-td font-medium">{b.client}</td>
                        <td className="ac-td">{b.partner}</td>
                        <td className="ac-td">{b.provider}</td>
                        <td className="ac-td max-w-[180px] truncate" title={b.service}>{b.service}</td>
                        <td className="ac-td text-[var(--admin-muted)]">{b.category}</td>
                        <td className="ac-td text-[var(--admin-muted)]">{b.direction}</td>
                        <td className="ac-td text-right font-bold">{fmtMoney(b.amount)}</td>
                        <td className="ac-td text-[var(--admin-muted)]">{b.currency}</td>
                        <td className="ac-td"><Badge label={STATUS_LABELS[b.bookingStatus] ?? b.bookingStatus} className={STATUS_STYLES[b.bookingStatus]} /></td>
                        <td className="ac-td"><Badge label={b.paymentStatus === "paid" ? "Оплачен" : b.paymentStatus === "pending" ? "Ожидает" : "Возврат"} className={PAY_STYLES[b.paymentStatus]} /></td>
                        <td className="ac-td">
                          {b.unreadCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-600 text-[11px] font-semibold">
                              <span>💬</span>
                              {b.unreadCount}
                            </span>
                          ) : (
                            <span className="text-[var(--admin-muted)]">—</span>
                          )}
                        </td>
                        <td className="ac-td">{b.manager}</td>
                        <td className="ac-td text-[var(--admin-muted)]">{fmtDate(b.createdAt)}</td>
                        <td className="ac-td">{fmtDate(b.serviceDate)}</td>
                        <td className="ac-td text-[var(--admin-muted)]">{fmtDate(b.updatedAt)}</td>
                      </tr>
                      );
                    })}
                    {!visibleBookings.length && (
                      <tr><td colSpan={18} className="px-4 py-8 text-center text-[var(--admin-muted)]">Нет данных для отображения</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {data?.pagination && data.pagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-[var(--admin-border)] flex items-center justify-between text-xs text-[var(--admin-muted)]">
                  <span>Показано {(data.pagination.page - 1) * data.pagination.limit + 1}–{Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} из {data.pagination.total}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-2 py-1 rounded-lg border border-[var(--admin-border)] hover:bg-[var(--admin-bg)] disabled:opacity-50">←</button>
                    {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1).slice(Math.max(0, page - 3), Math.max(0, page - 3) + Math.min(5, data.pagination.totalPages)).map((p) => (
                      <button key={p} onClick={() => setPage(p)} className={`px-2 py-1 rounded-lg ${p === page ? "bg-primary text-white" : "border border-[var(--admin-border)] hover:bg-[var(--admin-bg)]"}`}>{p}</button>
                    ))}
                    <button onClick={() => setPage(Math.min(data.pagination.totalPages, page + 1))} disabled={page === data.pagination.totalPages} className="px-2 py-1 rounded-lg border border-[var(--admin-border)] hover:bg-[var(--admin-bg)] disabled:opacity-50">→</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── Карточка бронирования (боковая панель) ─── */}
      {selectedBooking && (
        <BookingDetailSidebar
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onAction={(a) => void runBookingAction(selectedBooking.id, a)}
          onEdit={() => setEditBooking(selectedBooking)}
          acting={acting}
          historyVersion={historyVersion}
          // Переписка прочитана → обновляем счётчики в таблице
          onMessagesRead={() => {
            void fetchData().then((fresh) => {
              if (fresh) setData(fresh);
            });
          }}
        />
      )}

      {/* ─── Модальное окно создания бронирования ─── */}
      {createOpen && (
        <CreateBookingModal
          onClose={() => setCreateOpen(false)}
          onCreated={async (msg) => {
            setCreateOpen(false);
            setActionMsg({ ok: true, text: msg });
            const fresh = await fetchData();
            if (fresh) setData(fresh);
          }}
        />
      )}

      {/* ─── Модальное окно редактирования бронирования ─── */}
      {editBooking && (
        <EditBookingModal
          booking={editBooking}
          onClose={() => setEditBooking(null)}
          onSaved={async (msg, updated) => {
            setEditBooking(null);
            setActionMsg({ ok: true, text: msg });
            setHistoryVersion((v) => v + 1);
            // Обновляем открытую карточку и данные таблицы/виджетов
            setSelectedBooking((prev) => (prev?.id === updated.id ? updated : prev));
            const fresh = await fetchData();
            if (fresh) setData(fresh);
          }}
        />
      )}

      {/* ─── Тост о результате действия ─── */}
      {actionMsg && (
        <div className="fixed bottom-6 right-6 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div
            className={`px-4 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2 ${
              actionMsg.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            <span>{actionMsg.ok ? "✅" : "⚠️"}</span>
            {actionMsg.text}
            <button onClick={() => setActionMsg(null)} className="ml-2 opacity-70 hover:opacity-100 transition-opacity">✕</button>
          </div>
        </div>
      )}

      {/* ─── Правая AI-панель 420–480px (Гл. 5.10) ─── */}
      {aiOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setAiOpen(false)} />
          <div className="relative w-full max-w-[460px] bg-[var(--admin-card)] border-l border-[var(--admin-border)] flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-[var(--admin-border)] flex items-center justify-between">
              <div>
                <h2 className="font-bold text-[var(--admin-text)] flex items-center gap-2">🤖 AI Assistant</h2>
                <p className="text-xs text-[var(--admin-muted)] mt-0.5">Анализ и прогнозы по бронированиям</p>
              </div>
              <button onClick={() => setAiOpen(false)} className="ac-btn ac-btn-ghost ac-btn-icon">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-[var(--admin-muted)] font-semibold mb-2">Примеры запросов</div>
              {AI_PROMPTS.map((q, i) => (
                <button key={i} className="w-full text-left px-3 py-2.5 rounded-xl bg-[var(--admin-bg)] hover:bg-primary/10 hover:text-primary transition-colors text-xs text-[var(--admin-muted)]">
                  {q}
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-[var(--admin-border)]">
              <div className="flex items-center gap-2 bg-[var(--admin-bg)] rounded-xl px-3.5 h-11">
                <input placeholder="Задайте вопрос о бронированиях…" className="flex-1 bg-transparent outline-none text-sm" />
                <button className="ac-btn ac-btn-primary ac-btn-icon shrink-0">➤</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Вспомогательные компоненты ─── */
function Widget({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-[var(--admin-text)] mb-3">{title}</h3>
      {children}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (v: string) => void; options: { key: string; label: string }[]; disabled?: boolean }) {
  return (
    <div>
      <label className="text-[10px] font-medium text-[var(--admin-muted)] mb-1 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="ac-select w-full"
      >
        {options.map((o) => (
          <option key={o.key || o.label} value={o.key}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
