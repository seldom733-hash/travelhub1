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

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING: "Ожидает оплаты",
  PAID: "Оплачен",
  REFUNDED: "Возврат",
  COMPLETED: "Завершён",
};

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  PAID: "#22c55e",
  REFUNDED: "#ef4444",
  COMPLETED: "#06b6d4",
};

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

/** Число и процент изменения относительно предыдущего периода. */
export function changePct(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
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
