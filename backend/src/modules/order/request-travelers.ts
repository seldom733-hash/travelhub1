import { ValidationDomainError } from "../../shared/errors";

/**
 * Two-stage traveler model (REQUEST TRAVELERS → ORDER TRAVELER EXPANSION).
 *
 * Request-стадия хранит только FIO + birthDate (§2.2). Passport/identity —
 * только Order-стадия (§2.3), поэтому здесь НЕТ никаких passport-полей.
 *
 * Чистые функции вынесены из request.service, чтобы order.service (§10-инвариант
 * при копировании RequestTraveler → OrderTraveler) мог переиспользовать их без
 * циклического импорта сервисов.
 */

/** Нормализованный ввод туриста Request-стадии. */
export interface RequestTravelerInput {
  firstName?: unknown;
  lastName?: unknown;
  birthDate?: unknown;
  position?: unknown;
}

/** Минимальный вид строки RequestTraveler для read-only проекций. */
export interface RequestTravelerShape {
  firstName?: string | null;
  lastName?: string | null;
  birthDate?: Date | string | null;
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TRAVELER_NAME_MAX = 200;

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new ValidationDomainError(`invalid ${field}: required non-empty string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationDomainError(`invalid ${field}: required non-empty string`);
  }
  if (trimmed.length > TRAVELER_NAME_MAX) {
    throw new ValidationDomainError(`invalid ${field}: max length is ${TRAVELER_NAME_MAX}`);
  }
  return trimmed;
}

/**
 * §6 Request validation — обязательные поля Request-стадии.
 * firstName/lastName/birthDate REQUIRED; дата — YYYY-MM-DD, валидная, не в будущем.
 * Ничего не «угадывает»: неверный формат → 422.
 */
export function normalizeRequestTravelerInput(input: RequestTravelerInput): {
  firstName: string;
  lastName: string;
  birthDate: string;
} {
  const firstName = requireNonEmptyString(input.firstName, "firstName");
  const lastName = requireNonEmptyString(input.lastName, "lastName");

  if (typeof input.birthDate !== "string") {
    throw new ValidationDomainError("invalid birthDate: required YYYY-MM-DD string");
  }
  const raw = input.birthDate.trim();
  const match = DATE_ONLY_RE.exec(raw);
  if (!match) {
    throw new ValidationDomainError("invalid birthDate: required YYYY-MM-DD string");
  }
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (
    parsed.getUTCFullYear() !== y ||
    parsed.getUTCMonth() !== m - 1 ||
    parsed.getUTCDate() !== d
  ) {
    throw new ValidationDomainError(`invalid birthDate: ${raw} is not a real calendar date`);
  }
  const todayUtc = new Date();
  const today = Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate());
  if (parsed.getTime() > today) {
    throw new ValidationDomainError("invalid birthDate: cannot be in the future");
  }
  return { firstName, lastName, birthDate: `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}

/** §4: позиция — целое ≥ 1; если задан явный лимит партии, не выше него. */
export function assertRequestTravelerPosition(position: unknown, travelerCount: number | null | undefined): number | null {
  if (position === undefined || position === null || position === "") return null;
  const parsed = typeof position === "number" ? position : Number(position);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationDomainError("invalid position: must be a positive integer");
  }
  if (travelerCount != null && parsed > travelerCount) {
    throw new ValidationDomainError(
      `invalid position: ${parsed} exceeds travelerCount ${travelerCount}`,
    );
  }
  return parsed;
}

/**
 * §6 readiness: заявка «готова к коммерческому процессу», только если
 *  - есть хотя бы один турист;
 *  - их количество равно travelerCount;
 *  - у каждого заполнены firstName/lastName/birthDate.
 * FIO сам по себе идентичностью туристов НЕ считается (§6).
 */
export function computeRequestTravelersReadiness(
  travelers: readonly RequestTravelerShape[],
  travelerCount: number | null | undefined,
): boolean {
  const expected = travelerCount ?? null;
  if (expected == null || !Number.isInteger(expected) || expected < 1) return false;
  if (travelers.length !== expected) return false;
  return travelers.every((t) => {
    const firstName = typeof t.firstName === "string" ? t.firstName.trim() : "";
    const lastName = typeof t.lastName === "string" ? t.lastName.trim() : "";
    const birthDate = t.birthDate ?? null;
    return firstName.length > 0 && lastName.length > 0 && birthDate != null;
  });
}

/** §10: точное соответствие состава и travelerCount — иначе безопасный отказ. */
export function assertRequestTravelersMatchCount(
  travelers: readonly RequestTravelerShape[],
  travelerCount: number | null | undefined,
): number {
  const expected = travelerCount ?? null;
  if (expected == null || !Number.isInteger(expected) || expected < 1) {
    throw new ValidationDomainError("cannot proceed: travelerCount is not set on Request");
  }
  if (travelers.length !== expected) {
    throw new ValidationDomainError(
      `traveler count mismatch: travelerCount=${expected}, RequestTraveler=${travelers.length}; conversion refused`,
    );
  }
  return expected;
}
