/**
 * Общие справочники и хелперы для административной панели.
 */

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  TOUR: "Туры",
  HOTEL: "Отели",
  SANATORIUM: "Санатории",
  FLIGHT: "Авиабилеты",
  TRAIN: "Ж/Д билеты",
  EXCURSION: "Экскурсии",
  GUIDE: "Гиды",
  TRANSFER: "Трансферы",
  PHOTOGRAPHER: "Фотографы",
};

export const SERVICE_TYPE_ICONS: Record<string, string> = {
  TOUR: "🧳",
  HOTEL: "🏨",
  SANATORIUM: "🌿",
  FLIGHT: "✈️",
  TRAIN: "🚆",
  EXCURSION: "🚌",
  GUIDE: "🗺️",
  TRANSFER: "🚘",
  PHOTOGRAPHER: "📸",
};

// ── Каталог услуг (Гл. 4) ──

/** Статусы жизненного цикла услуги (Гл. 4.12): Черновик → … → Архив. */
export const SERVICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  REVIEW: "На согласовании",
  READY: "Готова к публикации",
  PUBLISHED: "Опубликована",
  SUSPENDED: "Приостановлена",
  ARCHIVED: "Архив",
};

export const SERVICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8",
  REVIEW: "#f59e0b",
  READY: "#8b5cf6",
  PUBLISHED: "#22c55e",
  SUSPENDED: "#f97316",
  ARCHIVED: "#6b7280",
};

/** Статус публикации (Гл. 4.10) — производный от жизненного цикла. */
export function servicePublicationLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "Черновик",
    REVIEW: "Подготовка",
    READY: "Ожидает публикации",
    PUBLISHED: "Опубликована",
    SUSPENDED: "Приостановлена",
    ARCHIVED: "Снята с публикации",
  };
  return map[status] ?? status;
}

export function servicePublicationColor(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "#94a3b8",
    REVIEW: "#f59e0b",
    READY: "#8b5cf6",
    PUBLISHED: "#22c55e",
    SUSPENDED: "#f97316",
    ARCHIVED: "#6b7280",
  };
  return map[status] ?? "#64748b";
}

/** Состояние доступности (Гл. 4.7): индикатор в таблице и карточке. */
export function serviceAvailabilityLabel(service: {
  status: string;
  quotaTotal: number | null;
  quotaBooked: number | null;
  quotaReserved: number | null;
}): { label: string; color: string } {
  if (service.status === "ARCHIVED") return { label: "Архивирована", color: "#6b7280" };
  if (service.status === "SUSPENDED") return { label: "Продажи приостановлены", color: "#f97316" };
  if (service.status !== "PUBLISHED") return { label: "Недоступна", color: "#94a3b8" };
  const total = service.quotaTotal ?? 0;
  const available = total - (service.quotaBooked ?? 0) - (service.quotaReserved ?? 0);
  if (total === 0) return { label: "Доступна", color: "#22c55e" };
  if (available <= 0) return { label: "Нет свободных мест", color: "#ef4444" };
  if (available <= Math.ceil(total * 0.1)) return { label: `Осталось мало мест · ${available}`, color: "#f59e0b" };
  return { label: `Доступна · ${available}`, color: "#22c55e" };
}

/** Действия журнала версий карточки (Гл. 4.12). */
export const SERVICE_HISTORY_ACTION_LABELS: Record<string, string> = {
  created: "Создание",
  update: "Изменение карточки",
  publish: "Публикация",
  unpublish: "Снятие с публикации",
  suspend: "Приостановка",
  archive: "Архивирование",
  restore: "Восстановление версии",
  price: "Изменение стоимости",
};

/** Полное имя пользователя (исполнителя действия в журнале бронирований). */
export function actorDisplayName(user: { firstName: string; lastName: string | null }): string {
  return `${user.firstName} ${user.lastName ?? ""}`.trim() || "Администратор";
}

/**
 * Текст автоматического системного сообщения в переписке при смене статуса
 * брони (вкладка «Переписка», Гл. 5.9). Пишется в BookingMessage с senderRole = "system".
 * Статусы — канонические коды Baseline §0.5 (UI локализует, backend хранит code).
 */
export function bookingSystemMessage(status: string): string {
  const map: Record<string, string> = {
    NEW: "Бронирование создано",
    PREPARING_REQUEST: "Готовится запрос поставщику",
    SENT_TO_SUPPLIER: "Запрос отправлен поставщику",
    AWAITING_CONFIRMATION: "Ожидается подтверждение поставщика",
    CONFIRMED: "Бронирование подтверждено ✅",
    IN_SERVICE: "Услуга оказана (в поездке) 🧳",
    COMPLETED: "Поездка завершена 🎉",
    NEEDS_CLARIFICATION: "Требуются уточнения",
    SUPPLIER_REJECTED: "Поставщик отклонил запрос",
    CHANGE_REQUESTED: "Запрошены изменения",
    CANCELLATION_REQUESTED: "Запрошена отмена",
    CANCELLED: "Бронирование отменено",
    PROBLEM: "Проблемная ситуация",
  };
  return map[status] ?? `Статус брони изменён: ${status}`;
}

/** Канонические коды статусов бронирования (Baseline §0.5) для фильтров аналитики. */
export type BookingStatusFilter =
  | "NEW" | "PREPARING_REQUEST" | "SENT_TO_SUPPLIER" | "AWAITING_CONFIRMATION"
  | "CONFIRMED" | "IN_SERVICE" | "COMPLETED" | "NEEDS_CLARIFICATION"
  | "SUPPLIER_REJECTED" | "CHANGE_REQUESTED" | "CANCELLATION_REQUESTED"
  | "CANCELLED" | "PROBLEM";

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  NEW: "Новая",
  PREPARING_REQUEST: "Готовится запрос",
  SENT_TO_SUPPLIER: "Отправлено поставщику",
  AWAITING_CONFIRMATION: "Ожидает подтверждения",
  CONFIRMED: "Подтверждено",
  IN_SERVICE: "В поездке",
  COMPLETED: "Завершено",
  NEEDS_CLARIFICATION: "Требует уточнения",
  SUPPLIER_REJECTED: "Поставщик отклонил",
  CHANGE_REQUESTED: "Изменение запрошено",
  CANCELLATION_REQUESTED: "Отмена запрошена",
  CANCELLED: "Отменено",
  PROBLEM: "Проблема",
};

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  NEW: "#94a3b8",
  PREPARING_REQUEST: "#8b5cf6",
  SENT_TO_SUPPLIER: "#3b82f6",
  AWAITING_CONFIRMATION: "#f59e0b",
  CONFIRMED: "#22c55e",
  IN_SERVICE: "#06b6d4",
  COMPLETED: "#10b981",
  NEEDS_CLARIFICATION: "#f59e0b",
  SUPPLIER_REJECTED: "#ef4444",
  CHANGE_REQUESTED: "#a3e635",
  CANCELLATION_REQUESTED: "#f97316",
  CANCELLED: "#f43f5e",
  PROBLEM: "#dc2626",
};

// ── Заказы (Гл. 6) ──

export const ORDER_STATUS_LABELS: Record<string, string> = {
  NEW: "Новый",
  IN_PROCESSING: "В обработке",
  WAITING_FOR_DATA: "Ожидает данные",
  READY_FOR_BOOKING: "Готов к бронированию",
  SENT_TO_BOOKING: "Передан в бронирование",
  PARTIALLY_FULFILLED: "Частично исполнен",
  FULFILLED: "Исполнен",
  READY_TO_CLOSE: "Готов к закрытию",
  CLOSED: "Закрыт",
  CANCELLED: "Отменён",
  PROBLEM: "Проблемный",
  SUSPENDED: "Приостановлен",
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  NEW: "#94a3b8",
  IN_PROCESSING: "#3b82f6",
  WAITING_FOR_DATA: "#8b5cf6",
  READY_FOR_BOOKING: "#06b6d4",
  SENT_TO_BOOKING: "#14b8a6",
  PARTIALLY_FULFILLED: "#eab308",
  FULFILLED: "#22c55e",
  READY_TO_CLOSE: "#10b981",
  CLOSED: "#6b7280",
  CANCELLED: "#f43f5e",
  PROBLEM: "#dc2626",
  SUSPENDED: "#f97316",
};

/** Финансовое состояние заказа (Baseline §0.6): отдельно от жизненного цикла. */
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "Не оплачен",
  PARTIALLY_PAID: "Частично оплачен",
  PAID: "Оплачен",
  REFUNDED: "Возврат",
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  UNPAID: "#f97316",
  PARTIALLY_PAID: "#eab308",
  PAID: "#22c55e",
  REFUNDED: "#ef4444",
};

/**
 * Текст автоматического системного сообщения в переписке по заказу при смене
 * статуса (вкладка «Коммуникации», Гл. 6.9). Пишется в OrderMessage с senderRole = "system".
 * Статусы — канонические коды Baseline §0.4.
 */
export function orderSystemMessage(status: string): string {
  const map: Record<string, string> = {
    NEW: "Заказ создан и передан в работу",
    IN_PROCESSING: "Заказ принят в обработку",
    WAITING_FOR_DATA: "Заказ ожидает недостающие данные",
    READY_FOR_BOOKING: "Заказ готов к бронированию",
    SENT_TO_BOOKING: "Заказ передан в Booking Center",
    PARTIALLY_FULFILLED: "Часть услуг забронирована",
    FULFILLED: "Все услуги забронированы и подтверждены ✅",
    READY_TO_CLOSE: "Заказ готов к закрытию",
    CLOSED: "Заказ закрыт 🎉",
    CANCELLED: "Заказ отменён ❌",
    PROBLEM: "Проблемная ситуация — требуется действие ⏰",
    SUSPENDED: "Заказ приостановлен",
  };
  return map[status] ?? `Статус заказа изменён: ${status}`;
}

/** Группы статусов заказа для фильтров и виджетов (Baseline §0.4/0.7). */
export const ORDER_STATUS_GROUPS = {
  active: [
    "NEW",
    "IN_PROCESSING",
    "WAITING_FOR_DATA",
    "READY_FOR_BOOKING",
    "SENT_TO_BOOKING",
    "PARTIALLY_FULFILLED",
    "FULFILLED",
    "READY_TO_CLOSE",
    "PROBLEM",
    "SUSPENDED",
  ],
  paid: ["FULFILLED", "READY_TO_CLOSE", "CLOSED"],
  awaitingPayment: ["READY_FOR_BOOKING", "SENT_TO_BOOKING", "PARTIALLY_FULFILLED"],
  terminal: ["CLOSED", "CANCELLED"],
} as const;

/**
 * Детерминированный список менеджеров платформы. В схеме нет поля manager —
 * менеджер назначается ротацией по id (pickManager). Единый источник для
 * реестр заказов (фильтр «Менеджер») и Dashboard (блок «Продажи» — лучшие менеджеры).
 */
// ── Роли и рабочие пространства Dashboard (Гл. 1.2, 1.44) ──
// Стартовое пространство зависит от роли; ключи должны совпадать с WORKSPACES
// в dashboard-widgets.tsx (main, sales, execution, finance, marketing, ai).

export const WORKSPACE_KEYS = ["main", "sales", "execution", "finance", "marketing", "ai"] as const;
export type WorkspaceKey = (typeof WORKSPACE_KEYS)[number];

/** Пространство Dashboard по умолчанию для роли (Гл. 1.2). */
export const ROLE_DEFAULT_WORKSPACE: Record<string, WorkspaceKey> = {
  ADMIN: "main",
  DIRECTOR: "main",
  FINANCE: "finance",
  MARKETER: "marketing",
  ANALYST: "main",
  MODERATOR: "main",
  SALES_MANAGER: "sales",
  OPERATOR: "execution",
  PARTNER: "main",
  BUYER: "main",
};

/** Стартовое пространство роли (с фолбэком на «Главный»). */
export function roleDefaultWorkspace(role: string): WorkspaceKey {
  return ROLE_DEFAULT_WORKSPACE[role] ?? "main";
}

export const MANAGERS = ["Анна Смирнова", "Дмитрий Петров", "Ольга Козлова", "Игорь Волков", "Мария Соколова"];

/** Детерминированное назначение менеджера по id заказа (хэш id). */
export function pickManager(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MANAGERS[h % MANAGERS.length];
}

export const PLATFORM_SERVICES = [
  { key: "api", label: "API" },
  { key: "db", label: "База данных" },
  { key: "queue", label: "Очередь сообщений" },
  { key: "payments", label: "Платежные системы" },
  { key: "email", label: "Почтовый сервис" },
  { key: "sms", label: "SMS" },
  { key: "push", label: "Push-уведомления" },
  { key: "storage", label: "Файловое хранилище" },
] as const;

export type PeriodKey = "today" | "yesterday" | "week" | "month" | "quarter" | "year" | "custom";

export interface PeriodRange {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
}

/** Возвращает границы выбранного периода и предыдущего (для сравнения). */
export function periodRange(period: PeriodKey, from?: string, to?: string): PeriodRange {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = 86400000;

  let start: Date;
  let end: Date = now;
  switch (period) {
    case "today":
      start = startOfDay;
      break;
    case "yesterday":
      start = new Date(startOfDay.getTime() - day);
      end = startOfDay;
      break;
    case "week":
      start = new Date(startOfDay.getTime() - 6 * day);
      break;
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      break;
    }
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = from ? new Date(from) : new Date(now.getFullYear(), 0, 1);
      if (to) end = new Date(to);
      break;
  }

  const len = end.getTime() - start.getTime();
  return { start, end, prevStart: new Date(start.getTime() - len), prevEnd: start };
}

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " $";

export const fmtNumber = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n));

export const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

export const fmtDateTime = (d: Date | string) =>
  new Date(d).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Русская плюрализация: plural(5, "заказ", "заказа", "заказов") → "заказов".
 * Учитывает исключения 11–14.
 */
export function ruPlural(n: number, one: string, few: string, many: string): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

/** Число и процент изменения относительно предыдущего периода. */
export function changePct(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Тренд серии значений: ожидаемое изменение следующего бакета (%).
 * Наблюдения, где активности ещё не было («пустой разгон» в начале) и неполный
 * текущий бакет (нулевой последний элемент) отбрасываются, чтобы они не
 * занижали базовый уровень. Наклон линейной регрессии нормируется на последнее
 * значение серии; результат ограничен [-50, +50], чтобы прогноз не выглядел
 * абсурдным на шумных данных. Возвращает 0 при < 2 точек или нулевой базе.
 */
export function seriesTrendPct(values: number[]): number {
  let arr = values.slice();
  const first = arr.findIndex((v) => v > 0);
  if (first < 0) return 0;
  arr = arr.slice(first);
  // Нулевой последний бакет считаем неполным текущим периодом и отбрасываем
  // (например, утро — день ещё не принёс выручки). Если в конце два нуля
  // подряд — реальное затухание, тогда возвращается 0 выше.
  if (arr.length > 1 && arr[arr.length - 1] === 0) arr = arr.slice(0, -1);
  const n = arr.length;
  if (n < 2) return 0;
  const last = arr[n - 1];
  if (last <= 0) return 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  arr.forEach((y, i) => {
    sx += i;
    sy += y;
    sxx += i * i;
    sxy += i * y;
  });
  const denom = n * sxx - sx * sx;
  if (denom === 0) return 0;
  const slope = (n * sxy - sx * sy) / denom;
  const pct = (slope / last) * 100;
  return Math.max(-50, Math.min(50, Math.round(pct)));
}

/**
 * Бакетизация выручки по периоду.
 * Сегодня/вчера — 3-часовые бакеты (8 точек), неделя — по дням (7 точек),
 * месяц — декады по 10 дней (3–4 точки), квартал — по месяцам (3 точки),
 * год — 12 месяцев. Для произвольного периода (custom) гранулярность
 * подстраивается под длину диапазона: до 2.5 суток — часы, до 62 суток — дни,
 * иначе — месяцы. Это сохраняет спарклайны KPI-карточек при drill-down на
 * конкретный день (Гл. 3.6): суженный до суток custom-период даёт 24 часовых
 * бакета, а не один месячный.
 */
export function bucketize(
  rows: { at: Date; amount: number }[],
  period: PeriodKey,
  range?: { start: Date; end: Date }
): { labels: string[]; values: number[]; starts: string[] } {
  const gran = bucketGranularity(period, range);
  const withDate = gran === "hour" && hourWithDate(period, range);
  const starts = bucketStarts(period, range);
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = bucketKey(r.at, gran, withDate);
    map.set(key, (map.get(key) ?? 0) + r.amount);
  }
  const labels = starts.map((d) => bucketKey(d, gran, withDate));
  const values = labels.map((k) => Math.round(map.get(k) ?? 0));
  // starts — ISO-метки начала каждого бакета: клиент использует их для
  // drill-down (Гл. 3.6) — фильтр реестра по границам выбранной точки.
  return { labels, values, starts: starts.map((d) => d.toISOString()) };
}

type BucketGranularity = "3h" | "hour" | "day" | "10d" | "month";

// Гранулярность бакетов для периода. Для custom — по длине диапазона.
function bucketGranularity(period: PeriodKey, range?: { start: Date; end: Date }): BucketGranularity {
  if (period === "today" || period === "yesterday") return "3h";
  if (period === "week") return "day";
  if (period === "month") return "10d";
  if (period === "custom" && range) {
    const span = range.end.getTime() - range.start.getTime();
    if (span <= 2.5 * 86400000) return "hour";
    if (span <= 62 * 86400000) return "day";
  }
  return "month";
}

// Для часовых бакетов custom-периода, охватывающего несколько дней, ключ должен
// включать дату, иначе часы разных дней сольются в один бакет.
function hourWithDate(period: PeriodKey, range?: { start: Date; end: Date }): boolean {
  if (!range) return false;
  const s = range.start;
  const e = range.end;
  return s.getDate() !== e.getDate() || s.getMonth() !== e.getMonth() || s.getFullYear() !== e.getFullYear();
}

function bucketKey(d: Date, gran: BucketGranularity, withDate: boolean): string {
  if (gran === "3h") {
    const h = Math.floor(d.getHours() / 3) * 3;
    return `${String(h).padStart(2, "0")}–${String(h + 3).padStart(2, "0")}`;
  }
  if (gran === "hour") {
    const hh = `${String(d.getHours()).padStart(2, "0")}:00`;
    return withDate ? `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${hh}` : hh;
  }
  if (gran === "10d") {
    const day = d.getDate();
    const start = Math.floor((day - 1) / 10) * 10 + 1;
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const end = Math.min(start + 9, lastDay);
    const s = String(start).padStart(2, "0");
    return end > start ? `${s}–${String(end).padStart(2, "0")}` : s;
  }
  if (gran === "day") {
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Начало каждого бакета периода (Date[]) — по той же гранулярности, что и
 * bucketize (единый источник меток для бакетизации).
 */
function bucketStarts(period: PeriodKey, range?: { start: Date; end: Date }): Date[] {
  const now = new Date();
  const gran = bucketGranularity(period, range);
  const r = range ?? { start: new Date(now.getFullYear(), now.getMonth() - 11, 1), end: now };
  const out: Date[] = [];
  if (gran === "3h") {
    // Сегодня/вчера: 8 бакетов по 3 часа от полуночи (вся точка покрывает период)
    const base = new Date(r.start.getFullYear(), r.start.getMonth(), r.start.getDate());
    for (let h = 0; h < 24; h += 3) out.push(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h));
    return out;
  }
  if (gran === "hour") {
    if (period === "today" || period === "yesterday") {
      const base = new Date(r.start.getFullYear(), r.start.getMonth(), r.start.getDate());
      for (let h = 0; h < 24; h++) out.push(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h));
    } else {
      // custom: часы от начала до конца диапазона
      const startMs = Math.floor(r.start.getTime() / 3600000) * 3600000;
      for (let t = startMs; t <= r.end.getTime(); t += 3600000) out.push(new Date(t));
    }
    return out;
  }
  if (gran === "day") {
    if (period === "week") {
      // Неделя: 7 дней, заканчивая сегодняшним
      for (let i = 6; i >= 0; i--) out.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
    } else {
      // custom: дни от начала до конца диапазона
      const s = new Date(r.start.getFullYear(), r.start.getMonth(), r.start.getDate());
      const e = new Date(r.end.getFullYear(), r.end.getMonth(), r.end.getDate());
      for (let d = new Date(s); d <= e; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) out.push(new Date(d));
    }
    return out;
  }
  if (gran === "10d") {
    // Месяц: декады от 1-го числа до конца месяца (3–4 бакета)
    const s = new Date(r.start.getFullYear(), r.start.getMonth(), 1);
    const lastDay = new Date(s.getFullYear(), s.getMonth() + 1, 0);
    for (let d = new Date(s); d <= lastDay; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 10)) out.push(new Date(d));
    return out;
  }
  // Месяцы периода: квартал — весь квартал (3 месяца), год — 12 месяцев,
  // custom — от месяца начала до месяца конца диапазона. Будущие месяцы
  // периода включаются нулевыми бакетами, чтобы квартал всегда давал 3 точки.
  const s = new Date(r.start.getFullYear(), r.start.getMonth(), 1);
  const e =
    period === "quarter"
      ? new Date(r.start.getFullYear(), Math.floor(r.start.getMonth() / 3) * 3 + 2, 1)
      : period === "year"
      ? new Date(r.start.getFullYear(), 11, 1)
      : new Date(r.end.getFullYear(), r.end.getMonth(), 1);
  let cursor = new Date(s);
  while (cursor <= e) {
    out.push(new Date(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return out;
}
