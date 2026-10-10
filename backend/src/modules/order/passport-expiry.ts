/**
 * §14 — Passport expiry document validation layer (Traveler Two-Stage).
 *
 * Архитектура (§4):
 *
 *   passport data
 *      ↓
 *   destination/service/supplier requirements
 *      ↓
 *   document validation
 *      ↓
 *   OK / WARNING / BLOCK / MANUAL_REVIEW
 *
 * Этот модуль реализует ТОЛЬКО базовый временной слой: срок действия паспорта
 * против дат поездки. Это НЕ универсальное юридическое правило: порог
 * (`marginDays`) — настраиваемая величина и extension point для будущих
 * destination/service/supplier-правил (visa-rules engine НЕ реализуется, §28).
 *
 * Три точки входа (§4, «Do not weaken existing D3 gates»):
 *  1. при вводе/изменении документа  → Order traveler collection (PATCH);
 *  2. перед финальным подтверждением → order.finalConfirm;
 *  3. перед Booking/supplier submission → BookingRequested consumer.
 */

/** Итоговый статус валидации документа (§4). */
export type PassportExpiryStatus = "OK" | "WARNING" | "BLOCK";

export type PassportExpiryCode =
  | "OK"
  | "EXPIRED"
  | "EXPIRING_WITHIN_MARGIN"
  | "MISSING_PASSPORT_EXPIRY"
  | "TRIP_DATES_UNKNOWN";

/**
 * Порог «паспорт истекает вскоре после поездки» (в днях после trip end).
 * Настраиваемый дефолт, НЕ юридическое правило — заменяется
 * destination/service/supplier-правилами при их появлении (§14).
 */
export const DEFAULT_PASSPORT_EXPIRY_MARGIN_DAYS = 183;

export interface PassportExpiryVerdict {
  status: PassportExpiryStatus;
  code: PassportExpiryCode;
  /** Машиночитаемое сообщение без PII (не содержит ФИО/номер паспорта). */
  message: string;
  marginDays: number;
  /** Даты в ISO (YYYY-MM-DD), нормализованные сервером. */
  passportExpiry: string | null;
  tripStartDate: string | null;
  tripEndDate: string | null;
}

export interface TripDates {
  tripStartDate?: Date | string | null;
  tripEndDate?: Date | string | null;
}

export interface PassportExpiryOptions {
  /**
   * Отсутствие passportExpiry → BLOCK. Вызывающий код передаёт true, только
   * когда поле действительно REQUIRED (pinned snapshot / Order-стадия §3).
   * НеREQUIRED отсутствующий срок = проверять нечего → OK.
   */
  requireExpiry?: boolean;
  marginDays?: number;
  now?: Date;
}

/** Ленивый импорт-хелпер, чтобы типы оставались автономными. */
function toDateOnly(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  // date-only сравнение в UTC (поля хранятся как UTC-midnight, §3/§10).
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function iso(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

/**
 * §14 — базовая валидация срока действия паспорта.
 *
 * Правила:
 *  - срок отсутствует и поле REQUIRED      → BLOCK  (MISSING_PASSPORT_EXPIRY);
 *  - срок отсутствует и поле не REQUIRED   → OK;
 *  - даты поездки неизвестны               → WARNING (TRIP_DATES_UNKNOWN) —
 *    не блокируем (legacy Order без serviceDate остаётся работоспособным);
 *  - срок < trip end                       → BLOCK  (EXPIRED);
 *  - trip end ≤ срок < trip end + margin   → WARNING (EXPIRING_WITHIN_MARGIN);
 *  - иначе                                 → OK.
 */
export function validatePassportExpiry(input: {
  passportExpiry?: Date | string | null;
  tripStartDate?: Date | string | null;
  tripEndDate?: Date | string | null;
} & PassportExpiryOptions): PassportExpiryVerdict {
  const marginDays = input.marginDays ?? DEFAULT_PASSPORT_EXPIRY_MARGIN_DAYS;
  const expiry = toDateOnly(input.passportExpiry);
  const start = toDateOnly(input.tripStartDate);
  const end = toDateOnly(input.tripEndDate) ?? start;

  const base = {
    marginDays,
    passportExpiry: iso(expiry),
    tripStartDate: iso(start),
    tripEndDate: iso(end),
  };

  if (!expiry) {
    if (input.requireExpiry) {
      return {
        ...base,
        status: "BLOCK",
        code: "MISSING_PASSPORT_EXPIRY",
        message: "Passport expiry is required but not provided",
      };
    }
    return { ...base, status: "OK", code: "OK", message: "Passport expiry not required" };
  }

  if (!start && !end) {
    return {
      ...base,
      status: "WARNING",
      code: "TRIP_DATES_UNKNOWN",
      message: "Trip dates unknown — passport expiry cannot be verified",
    };
  }

  if (end && expiry.getTime() < end.getTime()) {
    return {
      ...base,
      status: "BLOCK",
      code: "EXPIRED",
      message: `Passport expires (${iso(expiry)}) before trip end (${iso(end)})`,
    };
  }

  if (end && expiry.getTime() < addDays(end, marginDays).getTime()) {
    return {
      ...base,
      status: "WARNING",
      code: "EXPIRING_WITHIN_MARGIN",
      message: `Passport expires within ${marginDays} days after trip end (${iso(end)})`,
    };
  }

  return { ...base, status: "OK", code: "OK", message: "Passport expiry valid" };
}

export interface TravelerPassportExpiryInput {
  id?: string;
  passportExpiry?: Date | string | null;
}

export interface TravelerPassportExpiryVerdict extends PassportExpiryVerdict {
  travelerId: string | null;
}

const STATUS_RANK: Record<PassportExpiryStatus, number> = { OK: 0, WARNING: 1, BLOCK: 2 };

function worstStatus(statuses: PassportExpiryStatus[]): PassportExpiryStatus {
  return statuses.reduce<PassportExpiryStatus>((acc, s) => (STATUS_RANK[s] > STATUS_RANK[acc] ? s : acc), "OK");
}

/**
 * §14 — агрегация по списку туристов (худший статус побеждает).
 * Используется точками 2 (finalConfirm) и 3 (BookingRequested consumer).
 */
export function validateTravelersPassportExpiry(
  travelers: readonly TravelerPassportExpiryInput[],
  trip: TripDates,
  options: PassportExpiryOptions = {},
): { status: PassportExpiryStatus; verdicts: TravelerPassportExpiryVerdict[] } {
  const verdicts = travelers.map<TravelerPassportExpiryVerdict>((t) => ({
    travelerId: t.id ?? null,
    ...validatePassportExpiry({
      passportExpiry: t.passportExpiry,
      tripStartDate: trip.tripStartDate,
      tripEndDate: trip.tripEndDate,
      requireExpiry: options.requireExpiry,
      marginDays: options.marginDays,
      now: options.now,
    }),
  }));
  return { status: worstStatus(verdicts.map((v) => v.status)), verdicts };
}

/**
 * Даты поездки из Order-фактов: Order хранит только date-only `serviceDate`
 * (+ его копию на OrderItem). Duration-aware trip end (serviceDate + nights)
 * появится в destination/service/supplier-слое правил (§14 extension point);
 * до тех пор trip end = последняя известная serviceDate.
 */
export function resolveTripDates(order: {
  serviceDate?: Date | null;
  items?: ReadonlyArray<{ serviceDate?: Date | null }>;
}): { tripStartDate: Date | null; tripEndDate: Date | null } {
  const dates: Date[] = [];
  if (order.serviceDate) dates.push(order.serviceDate);
  for (const item of order.items ?? []) {
    if (item.serviceDate) dates.push(item.serviceDate);
  }
  if (dates.length === 0) return { tripStartDate: null, tripEndDate: null };
  const start = new Date(Math.min(...dates.map((d) => d.getTime())));
  const end = new Date(Math.max(...dates.map((d) => d.getTime())));
  return { tripStartDate: start, tripEndDate: end };
}
