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

/** Полное имя пользователя (исполнителя действия в журнале бронирований). */
export function actorDisplayName(user: { firstName: string; lastName: string | null }): string {
  return `${user.firstName} ${user.lastName ?? ""}`.trim() || "Администратор";
}

/**
 * Текст автоматического системного сообщения в переписке при смене статуса
 * брони (вкладка «Переписка», Гл. 5.9). Пишется в BookingMessage с senderRole = "system".
 */
export function bookingSystemMessage(status: string): string {
  const map: Record<string, string> = {
    PENDING: "Бронирование создано и ожидает подтверждения",
    CONFIRMED: "Бронирование подтверждено ✅",
    PAID: "Оплата получена 💳",
    COMPLETED: "Поездка завершена 🎉",
    REFUNDED: "Бронирование отменено, средства возвращены ↩️",
  };
  return map[status] ?? `Статус брони изменён: ${status}`;
}

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING: "Ожидает подтверждения",
  CONFIRMED: "Подтверждено",
  PAID: "Оплачен",
  REFUNDED: "Возврат",
  COMPLETED: "Завершён",
};

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#3b82f6",
  PAID: "#22c55e",
  REFUNDED: "#ef4444",
  COMPLETED: "#06b6d4",
};

// ── Заказы (Гл. 6) ──

export const ORDER_STATUS_LABELS: Record<string, string> = {
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

export const ORDER_STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8",
  CREATED: "#64748b",
  PROCESSING: "#3b82f6",
  AWAITING_CONFIRMATION: "#f59e0b",
  CONFIRMED: "#8b5cf6",
  AWAITING_PAYMENT: "#f97316",
  PARTIALLY_PAID: "#eab308",
  PAID: "#22c55e",
  DOCUMENT_PREP: "#14b8a6",
  READY: "#06b6d4",
  COMPLETED: "#10b981",
  CHANGED: "#a3e635",
  REFUNDED: "#ef4444",
  CANCELLED: "#f43f5e",
  OVERDUE: "#dc2626",
  ARCHIVED: "#6b7280",
};

/**
 * Текст автоматического системного сообщения в переписке по заказу при смене
 * статуса (вкладка «Коммуникации», Гл. 6.9). Пишется в OrderMessage с senderRole = "system".
 */
export function orderSystemMessage(status: string): string {
  const map: Record<string, string> = {
    CREATED: "Заказ создан и передан в работу",
    PROCESSING: "Заказ принят в обработку",
    AWAITING_CONFIRMATION: "Заказ создан и ожидает подтверждения",
    CONFIRMED: "Заказ подтверждён ✅",
    AWAITING_PAYMENT: "Ожидается оплата заказа",
    PARTIALLY_PAID: "Частичная оплата получена 💳",
    PAID: "Заказ оплачен 💳",
    DOCUMENT_PREP: "Готовятся документы 📄",
    READY: "Заказ готов к поездке 🎒",
    COMPLETED: "Заказ завершён 🎉",
    CHANGED: "Заказ изменён ✏️",
    REFUNDED: "Оформлен возврат ↩️",
    CANCELLED: "Заказ отменён ❌",
    OVERDUE: "Заказ просрочен — требуется действие ⏰",
    ARCHIVED: "Заказ архивирован 📦",
  };
  return map[status] ?? `Статус заказа изменён: ${status}`;
}

/** Группы статусов заказа для фильтров и виджетов. */
export const ORDER_STATUS_GROUPS = {
  active: [
    "DRAFT",
    "CREATED",
    "PROCESSING",
    "AWAITING_CONFIRMATION",
    "CONFIRMED",
    "AWAITING_PAYMENT",
    "PARTIALLY_PAID",
    "PAID",
    "DOCUMENT_PREP",
    "READY",
    "CHANGED",
    "OVERDUE",
  ],
  paid: ["PAID", "DOCUMENT_PREP", "READY", "COMPLETED"],
  awaitingPayment: ["AWAITING_PAYMENT", "PARTIALLY_PAID", "OVERDUE"],
  terminal: ["COMPLETED", "REFUNDED", "CANCELLED", "ARCHIVED"],
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
 * День/вчера — по часам, неделя/месяц — по дням, квартал/год — по месяцам.
 * Окно меток ограничено границами периода, чтобы не было пустых бакетов.
 */
export function bucketize(
  rows: { at: Date; amount: number }[],
  period: PeriodKey,
  range?: { start: Date; end: Date }
): { labels: string[]; values: number[] } {
  const map = new Map<string, number>();
  const add = (key: string, amount: number) => map.set(key, (map.get(key) ?? 0) + amount);
  for (const r of rows) add(bucketKey(r.at, period), r.amount);

  const labels: string[] = [];
  const values: number[] = [];
  for (const key of orderedKeys(period, range)) {
    labels.push(key);
    values.push(Math.round(map.get(key) ?? 0));
  }
  return { labels, values };
}

function bucketKey(d: Date, period: PeriodKey): string {
  if (period === "today" || period === "yesterday") {
    return `${String(d.getHours()).padStart(2, "0")}:00`;
  }
  if (period === "week" || period === "month") {
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function orderedKeys(period: PeriodKey, range?: { start: Date; end: Date }): string[] {
  const now = new Date();
  const out: string[] = [];
  if (period === "today" || period === "yesterday") {
    for (let h = 0; h < 24; h++) out.push(`${String(h).padStart(2, "0")}:00`);
  } else if (period === "week" || period === "month") {
    const count = period === "week" ? 7 : 31;
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      out.push(`${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
  } else {
    // Квартал/год: месяцы в пределах выбранного диапазона (без пустых бакетов)
    const start = range?.start ?? new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const end = range?.end ?? now;
    const s = new Date(start.getFullYear(), start.getMonth(), 1);
    const e = new Date(end.getFullYear(), end.getMonth(), 1);
    let cursor = new Date(s);
    while (cursor <= e) {
      out.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }
  return out;
}
