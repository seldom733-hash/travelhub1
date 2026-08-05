import { NextResponse } from "next/server";

/**
 * Проверка доступа к admin API по ролям (Гл. 1.2, 2.2).
 *
 * Сетка прав:
 * - Полные роли (ADMIN, PARTNER, DIRECTOR, FINANCE, MARKETER, ANALYST, MODERATOR) —
 *   полный доступ ко всем разделам админки и BI Center;
 * - SALES_MANAGER — Dashboard и раздел «Продажи» (заказы, продажи);
 * - OPERATOR — Dashboard и раздел «Исполнение» (бронирования);
 * - BUYER — в админку не пускаем вообще.
 */

/** Роли с полным (легаси) доступом ко всем разделам админки. */
export const FULL_ADMIN_ROLES = [
  "ADMIN",
  "PARTNER",
  "DIRECTOR",
  "FINANCE",
  "MARKETER",
  "ANALYST",
  "MODERATOR",
] as const;

/** Роли, которым доступен раздел «Продажи» . */
export const SALES_ROLES = [...FULL_ADMIN_ROLES, "SALES_MANAGER"] as const;

/** Роли, которым доступен раздел бронирований. */
export const EXECUTION_ROLES = [...FULL_ADMIN_ROLES, "OPERATOR"] as const;

/** Все роли, которым доступна админка (Dashboard и общие сервисы). */
export const ALL_ADMIN_ROLES = [...FULL_ADMIN_ROLES, "SALES_MANAGER", "OPERATOR"] as const;

/**
 * Проверяет роль пользователя против списка разрешённых.
 * Возвращает null при доступе или готовый JSON-ответ с ошибкой.
 * Семантика: 401 — нет сессии, 403 — роли недостаточно прав.
 */
export function requireRole(
  user: { role: string } | null,
  allowed: readonly string[]
): NextResponse | null {
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!allowed.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden: недостаточно прав для раздела" }, { status: 403 });
  }
  return null;
}
