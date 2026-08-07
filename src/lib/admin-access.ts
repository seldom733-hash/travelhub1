import { NextResponse } from "next/server";

/**
 * Проверка доступа к admin API по ролям (Гл. 1.2, 2.2).
 *
 * Сетка прав (RBAC Matrix — Baseline 1.3 SYNC):
 * - Полные роли (ADMIN, DIRECTOR, FINANCE, MARKETER, ANALYST, MODERATOR) —
 *   доступ к разделам админки и BI Center в рамках прав (см. lib/permissions.ts);
 * - PARTNER — ТОЛЬКО свой scope (Каталог: свои продукты); НЕ имеет доступа
 *   к внутренним рабочим центрам (Baseline §10, §13);
 * - SALES_MANAGER — Dashboard и «Продажи»; без order lifecycle write;
 * - OPERATOR — Dashboard и «Исполнение» (бронирования);
 * - BUYER — в админку не пускаем вообще.
 */

/** Роли с полным (легаси) доступом к разделам админки (PARTNER исключён). */
export const FULL_ADMIN_ROLES = [
  "ADMIN",
  "DIRECTOR",
  "FINANCE",
  "MARKETER",
  "ANALYST",
  "MODERATOR",
] as const;

/** Роли с доступом к Каталогу (PARTNER — только собственный scope, см. catalog routes). */
export const CATALOG_ROLES = ["ADMIN", "MODERATOR", "PARTNER"] as const;

/** Роли, которым доступен раздел «Продажи» (SALES_MANAGER — linked read + bootstrap-create). */
export const SALES_ROLES = [...FULL_ADMIN_ROLES, "SALES_MANAGER"] as const;

/** Роли с правом управления жизненным циклом заказа (order lifecycle write). */
export const ORDER_LIFECYCLE_ROLES = ["ADMIN", "DIRECTOR", "OPERATOR"] as const;

/** Роли с правом финансовых операций по заказу (payment/refund). */
export const ORDER_PAYMENT_ROLES = ["ADMIN", "FINANCE", "OPERATOR", "DIRECTOR"] as const;

/** Роли с доступом к Finance Center (владелец — FINANCE, Baseline §0.6). */
export const FINANCE_ROLES = ["ADMIN", "FINANCE", "DIRECTOR"] as const;

/** Роли, которым доступен раздел бронирований. */
export const EXECUTION_ROLES = [...FULL_ADMIN_ROLES, "OPERATOR"] as const;

/** Все роли, которым доступна админка (Dashboard и общие сервисы). */
export const ALL_ADMIN_ROLES = [...FULL_ADMIN_ROLES, "SALES_MANAGER", "OPERATOR"] as const;

/** Роли с доступом к Dashboard (в т.ч. PARTNER — собственный scope). */
export const DASHBOARD_ROLES = [...ALL_ADMIN_ROLES, "PARTNER"] as const;

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
