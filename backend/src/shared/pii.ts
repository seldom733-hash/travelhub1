import { RoleCode } from "../generated/prisma/enums";

/**
 * PHASE 1 STEP 1.17 — field-level redaction для traveler/passenger PII.
 *
 * Поля OrderTraveler/Passenger, содержащие паспортные и персональные данные:
 *  - passportNumber / passportExpiry — паспортные данные;
 *  - birthDate — дата рождения (чувствительная PII).
 * Имена (firstName/lastName) и гражданство/пол остаются для идентификации.
 * Контактных полей (email/phone) у traveler/passenger в Phase 1 нет — при
 * появлении они добавляются в список.
 *
 * Политика доступа: полные PII видят ТОЛЬКО операционные роли — OPERATOR
 * (ведение заказа/бронирования) и ADMIN (полный контроль). Остальные staff-роли
 * (SALES_MANAGER/FINANCE/ANALYST/MARKETER/DIRECTOR/MODERATOR) получают redacted
 * projection (чувствительные поля → null, стабильная форма без утечки).
 */
export const TRAVELER_PII_FIELDS = ["passportNumber", "passportExpiry", "birthDate"] as const;

/** Кто может видеть полные PII traveler'ов/пассажиров. */
export function canViewTravelerPii(role: RoleCode): boolean {
  return role === RoleCode.OPERATOR || role === RoleCode.ADMIN;
}

/** Тип зрителя: отсутствует (internal trusted call) или роль пользователя. */
export type TravelerViewer = { role: RoleCode } | null | undefined;

/**
 * Redacts PII-поля строки traveler/passenger, если зритель не имеет доступа.
 * Чистая функция: возвращает копию, не мутирует входные данные.
 * Без зрителя (internal call) — данные не трогаются.
 */
export function redactTravelerPii<T extends Record<string, unknown>>(row: T, viewer: TravelerViewer): T {
  if (!viewer || canViewTravelerPii(viewer.role)) return row;
  const out: Record<string, unknown> = { ...row };
  for (const field of TRAVELER_PII_FIELDS) {
    out[field] = null;
  }
  return out as T;
}

/** Redacts массив строк traveler/passenger (list-проекции). */
export function redactTravelersPii<T extends Record<string, unknown>>(rows: T[], viewer: TravelerViewer): T[] {
  return rows.map((r) => redactTravelerPii(r, viewer));
}
