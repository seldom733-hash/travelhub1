/**
 * Канонический каталог permissions (RBAC Matrix — Baseline 1.3 SYNC, §4).
 *
 * Гранулярные права вместо «domain:write» на всё: каждое действие проверяет
 * конкретное право. Роли — строго канонические (ADMIN, DIRECTOR, FINANCE,
 * MARKETER, ANALYST, MODERATOR, SALES_MANAGER, OPERATOR, PARTNER, BUYER).
 *
 * Критические ограничения (Baseline §3, RBAC Matrix §3):
 *  - SALES_MANAGER: linked order read + bootstrap create (временное исключение
 *    Phase 1, аудируется); НЕ имеет order lifecycle write и booking commands;
 *  - OPERATOR: основная операционная роль Order/Booking/Support;
 *  - FINANCE: владелец финансовых операций и master-данных (Currency/Tax…);
 *  - PARTNER: только собственный scope (object scope, см. requireObjectScope);
 *  - BUYER: только собственные объекты; без внутренних API;
 *  - ANALYST: read-only.
 */
import { NextResponse } from "next/server";

export type Permission = string;

// ── Канонические роли ──
export const CANONICAL_ROLES = [
  "ADMIN",
  "DIRECTOR",
  "FINANCE",
  "MARKETER",
  "ANALYST",
  "MODERATOR",
  "SALES_MANAGER",
  "OPERATOR",
  "PARTNER",
  "BUYER",
] as const;

// ── Справочник прав (RBAC Matrix §4) ──
export const PERMISSIONS = {
  // Catalog
  catalogProductRead: "catalog.product.read",
  catalogProductWrite: "catalog.product.write",
  catalogProductPublish: "catalog.product.publish",
  catalogProductArchive: "catalog.product.archive",
  catalogProductSubmitModeration: "catalog.product.submit_moderation",
  moderationReview: "moderation.review",
  moderationApprove: "moderation.approve",
  moderationReject: "moderation.reject",
  // Sales
  salesRead: "sales.read",
  salesWrite: "sales.write",
  salesQuoteApprove: "sales.quote.approve",
  salesSaleComplete: "sales.sale.complete",
  // CRM
  crmRead: "crm.read",
  crmWrite: "crm.write",
  // Order
  orderRead: "order.read",
  orderCreate: "order.create",
  orderAccept: "order.accept",
  orderEdit: "order.edit_noncritical",
  orderRequestBooking: "order.request_booking",
  orderSuspend: "order.suspend",
  orderCancel: "order.cancel",
  orderClose: "order.close",
  // Booking
  bookingRead: "booking.read",
  bookingCreate: "booking.create",
  bookingSendSupplier: "booking.send_supplier",
  bookingConfirm: "booking.confirm",
  bookingRequestChange: "booking.request_change",
  bookingCancel: "booking.cancel",
  // Finance
  financeRead: "finance.read",
  financePaymentWrite: "finance.payment.write",
  financeRefundApprove: "finance.refund.approve",
  financeCurrencyManage: "finance.currency.manage",
  financeTaxManage: "finance.tax.manage",
  // Documents / Support / Moderation / Settings / Audit / Analytics
  documentsRead: "documents.read",
  documentsWrite: "documents.write",
  supportRead: "support.read",
  supportWrite: "support.write",
  settingsWrite: "settings.write",
  auditRead: "audit.read",
  analyticsRead: "analytics.read",
  dashboardRead: "dashboard.read",
  integrationsRead: "integrations.read",
  integrationsWrite: "integrations.write",
  usersManage: "users.manage",
} as const;

/** Матрица роль → права (RBAC Matrix Baseline 1.3, §2). */
const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  ADMIN: Object.values(PERMISSIONS),
  DIRECTOR: [
    PERMISSIONS.catalogProductRead,
    PERMISSIONS.catalogProductWrite,
    PERMISSIONS.salesRead,
    PERMISSIONS.crmRead,
    PERMISSIONS.orderRead,
    PERMISSIONS.orderAccept,
    PERMISSIONS.orderEdit,
    PERMISSIONS.orderRequestBooking,
    PERMISSIONS.orderSuspend,
    PERMISSIONS.orderCancel,
    PERMISSIONS.orderClose,
    PERMISSIONS.bookingRead,
    PERMISSIONS.bookingCreate,
    PERMISSIONS.bookingSendSupplier,
    PERMISSIONS.bookingConfirm,
    PERMISSIONS.bookingRequestChange,
    PERMISSIONS.bookingCancel,
    PERMISSIONS.financeRead,
    PERMISSIONS.documentsRead,
    PERMISSIONS.supportRead,
    PERMISSIONS.moderationReview,
    PERMISSIONS.auditRead,
    PERMISSIONS.analyticsRead,
    PERMISSIONS.dashboardRead,
    PERMISSIONS.integrationsRead,
  ],
  FINANCE: [
    PERMISSIONS.catalogProductRead,
    PERMISSIONS.salesRead,
    PERMISSIONS.crmRead,
    PERMISSIONS.orderRead,
    PERMISSIONS.bookingRead,
    PERMISSIONS.financeRead,
    PERMISSIONS.financePaymentWrite,
    PERMISSIONS.financeRefundApprove,
    PERMISSIONS.financeCurrencyManage,
    PERMISSIONS.financeTaxManage,
    PERMISSIONS.documentsRead,
    PERMISSIONS.supportRead,
    PERMISSIONS.auditRead,
    PERMISSIONS.analyticsRead,
    PERMISSIONS.dashboardRead,
    PERMISSIONS.integrationsRead,
  ],
  MARKETER: [
    PERMISSIONS.catalogProductRead,
    PERMISSIONS.salesRead,
    PERMISSIONS.crmRead,
    PERMISSIONS.documentsRead,
    PERMISSIONS.analyticsRead,
    PERMISSIONS.dashboardRead,
    PERMISSIONS.integrationsRead,
    "marketing.read",
    "marketing.write",
  ],
  ANALYST: [
    PERMISSIONS.catalogProductRead,
    PERMISSIONS.salesRead,
    PERMISSIONS.crmRead,
    PERMISSIONS.orderRead,
    PERMISSIONS.bookingRead,
    PERMISSIONS.financeRead,
    PERMISSIONS.documentsRead,
    PERMISSIONS.auditRead,
    PERMISSIONS.analyticsRead,
    PERMISSIONS.dashboardRead,
    PERMISSIONS.integrationsRead,
  ],
  MODERATOR: [
    PERMISSIONS.catalogProductRead,
    PERMISSIONS.catalogProductWrite,
    PERMISSIONS.catalogProductPublish,
    PERMISSIONS.catalogProductArchive,
    PERMISSIONS.moderationReview,
    PERMISSIONS.moderationApprove,
    PERMISSIONS.moderationReject,
    PERMISSIONS.analyticsRead,
    PERMISSIONS.dashboardRead,
  ],
  SALES_MANAGER: [
    PERMISSIONS.salesRead,
    PERMISSIONS.salesWrite,
    PERMISSIONS.salesQuoteApprove,
    PERMISSIONS.salesSaleComplete,
    PERMISSIONS.crmRead,
    PERMISSIONS.crmWrite,
    // linked order read + временный bootstrap-create (Phase 1, аудируется);
    // lifecycle write отсутствует (Baseline §10, RBAC Matrix §3).
    PERMISSIONS.orderRead,
    PERMISSIONS.orderCreate,
    PERMISSIONS.bookingRead,
    PERMISSIONS.documentsRead,
    PERMISSIONS.analyticsRead,
    PERMISSIONS.dashboardRead,
  ],
  OPERATOR: [
    PERMISSIONS.catalogProductRead,
    PERMISSIONS.salesRead,
    PERMISSIONS.crmRead,
    PERMISSIONS.crmWrite,
    PERMISSIONS.orderRead,
    PERMISSIONS.orderCreate,
    PERMISSIONS.orderAccept,
    PERMISSIONS.orderEdit,
    PERMISSIONS.orderRequestBooking,
    PERMISSIONS.orderSuspend,
    PERMISSIONS.orderCancel,
    PERMISSIONS.orderClose,
    PERMISSIONS.bookingRead,
    PERMISSIONS.bookingCreate,
    PERMISSIONS.bookingSendSupplier,
    PERMISSIONS.bookingConfirm,
    PERMISSIONS.bookingRequestChange,
    PERMISSIONS.bookingCancel,
    PERMISSIONS.documentsRead,
    PERMISSIONS.documentsWrite,
    PERMISSIONS.supportRead,
    PERMISSIONS.supportWrite,
    PERMISSIONS.analyticsRead,
    PERMISSIONS.dashboardRead,
  ],
  PARTNER: [
    // Только собственный scope (object scope): catalog write — свои drafts,
    // moderation submit — свои продукты (Baseline §3, RBAC Matrix §3).
    PERMISSIONS.catalogProductRead,
    PERMISSIONS.catalogProductWrite,
    PERMISSIONS.catalogProductSubmitModeration,
    PERMISSIONS.documentsRead,
    PERMISSIONS.analyticsRead,
    PERMISSIONS.dashboardRead,
  ],
  BUYER: [
    // Только собственные объекты (cabinet); внутренние API недоступны.
    "buyer.own.read",
    "buyer.own.checkout",
  ],
};

/** Есть ли у роли право (ADMIN = всё). */
export function hasPermission(role: string | null | undefined, permission: string): boolean {
  if (!role) return false;
  if (role === "ADMIN") return true;
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

export interface PermissionUser {
  role: string;
}

/**
 * Проверка права с HTTP-ответом (для route handlers).
 * Возвращает null при доступе или готовый JSON-ответ 401/403.
 */
export function requirePermission(user: PermissionUser | null, permission: string): NextResponse | null {
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(user.role, permission)) {
    return NextResponse.json(
      { error: `Forbidden: недостаточно прав (${permission})` },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Object scope (RBAC Matrix §3): PARTNER видит только свои ресурсы.
 * Применяется в запросах домена-владельца (например, Catalog):
 *   resource.partnerId/providerId == currentUserId.
 */
export function partnerScopeWhere(user: { id: string; role: string }): Record<string, string> | null {
  if (user.role !== "PARTNER") return null;
  return { providerId: user.id };
}

/** Может ли роль действовать над объектом владельца (PARTNER object scope). */
export function canActOnOwnerObject(user: { id: string; role: string }, ownerId: string | null | undefined): boolean {
  if (user.role !== "PARTNER") return true;
  return !!ownerId && ownerId === user.id;
}
