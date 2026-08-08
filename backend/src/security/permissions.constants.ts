import type { RoleCode } from "../generated/prisma/enums";

/**
 * Каталог granular permissions (RBAC Matrix Baseline 1.3 §4).
 * Правило: НЕ заменять всё одним `domain:write` — права гранулярные.
 * Каталог расширяется по мере добавления доменов (Sales/Finance в Phase 2).
 */
export const PERMISSIONS = {
  // ── Catalog ───────────────────────────────────────────────────────────
  "catalog.product.read": "Чтение продуктов",
  "catalog.product.write": "Создание/изменение продуктов",
  "catalog.product.publish": "Публикация/архивация продукта",
  "catalog.product.submit_moderation": "Отправка продукта на модерацию",
  "catalog.category.write": "Управление категориями",
  "catalog.category_schema.read": "Чтение Category Schema (конфигурации категорий)",
  "catalog.category_schema.write": "Управление Category Schema (только ADMIN)",
  "catalog.availability.write": "Управление availability",

  // ── CRM ───────────────────────────────────────────────────────────────
  "crm.customer.read": "Чтение клиентов",
  "crm.customer.write": "Создание/изменение клиентов",
  "crm.contact.write": "Управление контактами",
  "crm.company.write": "Управление компаниями",
  "crm.partner.write": "Управление партнёрами",
  "crm.supplier.write": "Управление поставщиками",

  // ── Order ─────────────────────────────────────────────────────────────
  "order.read": "Чтение заказов",
  "order.accept": "Принятие заказа в работу",
  "order.edit_noncritical": "Редактирование некритичных данных заказа",
  "order.request_booking": "Передача заказа в Booking",
  "order.suspend": "Приостановка заказа",
  "order.cancel": "Отмена заказа",
  "order.close": "Закрытие заказа",
  "order.import": "Импорт/создание заказа (ADMIN exception, Phase 1 bootstrap)",

  // ── Booking ───────────────────────────────────────────────────────────
  "booking.read": "Чтение бронирований",
  "booking.send_supplier": "Отправка запроса поставщику",
  "booking.confirm": "Подтверждение/отклонение бронирования",
  "booking.request_change": "Запрос изменения бронирования",
  "booking.cancel": "Отмена бронирования",

  // ── Sales (Phase 2, каталог прав зарезервирован) ─────────────────────
  "sales.lead.read": "Чтение лидов",
  "sales.lead.write": "Управление лидами",
  "sales.opportunity.read": "Чтение сделок",
  "sales.opportunity.write": "Управление сделками",
  "sales.quote.read": "Чтение коммерческих предложений",
  "sales.quote.write": "Управление КП",
  "sales.quote.approve": "Согласование КП",
  "sales.sale.read": "Чтение продаж",
  "sales.sale.write": "Управление продажами",
  "sales.sale.complete": "Завершение продажи",

  // ── Finance (Phase 2, каталог прав зарезервирован) ───────────────────
  "finance.payment.read": "Чтение платежей",
  "finance.payment.write": "Управление платежами",
  "finance.refund.read": "Чтение возвратов",
  "finance.refund.approve": "Согласование возвратов",
  "finance.invoice.read": "Чтение счетов",
  "finance.invoice.write": "Выставление счетов",
  "finance.commission.read": "Чтение комиссий",
  "finance.commission.write": "Управление комиссиями",
  "finance.currency.manage": "Управление валютами",
  "finance.exchange_rate.manage": "Управление курсами",
  "finance.tax.manage": "Управление налогами",

  // ── Cross-cutting ─────────────────────────────────────────────────────
  "support.read": "Чтение обращений поддержки",
  "support.write": "Обработка обращений поддержки",
  "documents.read": "Чтение документов",
  "documents.write": "Управление документами",
  "settings.read": "Чтение настроек",
  "settings.write": "Управление настройками",
  "audit.read": "Чтение аудита",
  "analytics.read": "Чтение аналитики",
  "reports.read": "Чтение отчётов",
  "moderation.review": "Ревью модерации",
  "moderation.approve": "Одобрение модерации",
  "moderation.reject": "Отклонение модерации",
} as const;

export type PermissionCode = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionCode[];

/**
 * Роль → права (RBAC Matrix Baseline 1.3 §2 «Базовая матрица»).
 * PARTNER/BUYER получают объектный scope дополнительно (partnerId/customerId),
 * здесь — только матричные разрешения.
 */
export const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  ADMIN: ALL_PERMISSIONS,

  DIRECTOR: [
    "catalog.product.read",
    "catalog.category_schema.read",
    "crm.customer.read",
    "order.read",
    "booking.read",
    "sales.lead.read",
    "sales.opportunity.read",
    "sales.quote.read",
    "sales.sale.read",
    "finance.payment.read",
    "finance.refund.read",
    "finance.invoice.read",
    "finance.commission.read",
    "support.read",
    "documents.read",
    "settings.read",
    "audit.read",
    "analytics.read",
    "reports.read",
  ],

  FINANCE: [
    "catalog.product.read",
    "crm.customer.read",
    "order.read",
    "booking.read",
    "sales.sale.read",
    "finance.payment.read",
    "finance.payment.write",
    "finance.refund.read",
    "finance.refund.approve",
    "finance.invoice.read",
    "finance.invoice.write",
    "finance.commission.read",
    "finance.commission.write",
    "finance.currency.manage",
    "finance.exchange_rate.manage",
    "finance.tax.manage",
    "support.read",
    "documents.read",
    "settings.read",
    "audit.read",
  ],

  MARKETER: [
    "catalog.product.read",
    "crm.customer.read",
    "sales.lead.read",
    "sales.opportunity.read",
    "sales.sale.read",
    "analytics.read",
    "reports.read",
    "settings.read",
  ],

  ANALYST: [
    "catalog.product.read",
    "crm.customer.read",
    "order.read",
    "booking.read",
    "sales.lead.read",
    "sales.opportunity.read",
    "sales.quote.read",
    "sales.sale.read",
    "finance.payment.read",
    "finance.refund.read",
    "finance.invoice.read",
    "finance.commission.read",
    "support.read",
    "documents.read",
    "settings.read",
    "audit.read",
    "analytics.read",
    "reports.read",
  ],

  MODERATOR: [
    "catalog.product.read",
    "catalog.product.write",
    "catalog.product.publish",
    "catalog.product.submit_moderation",
    "catalog.category.write",
    "catalog.category_schema.read",
    "catalog.availability.write",
    "crm.customer.read",
    "moderation.review",
    "moderation.approve",
    "moderation.reject",
  ],

  SALES_MANAGER: [
    "catalog.product.read",
    "crm.customer.read",
    "crm.customer.write",
    "crm.contact.write",
    "order.read",
    "booking.read",
    "sales.lead.read",
    "sales.lead.write",
    "sales.opportunity.read",
    "sales.opportunity.write",
    "sales.quote.read",
    "sales.quote.write",
    "sales.quote.approve",
    "sales.sale.read",
    "sales.sale.write",
    "sales.sale.complete",
    "finance.payment.read",
    "finance.refund.read",
    "finance.invoice.read",
    "support.read",
    "documents.read",
  ],

  OPERATOR: [
    "catalog.product.read",
    "crm.customer.read",
    "crm.customer.write",
    "crm.contact.write",
    "order.read",
    "order.accept",
    "order.edit_noncritical",
    "order.request_booking",
    "order.suspend",
    "order.cancel",
    "order.close",
    "booking.read",
    "booking.send_supplier",
    "booking.confirm",
    "booking.request_change",
    "booking.cancel",
    "support.read",
    "support.write",
    "documents.read",
    "documents.write",
  ],

  PARTNER: [
    "catalog.product.read",
    "catalog.product.submit_moderation",
    "crm.customer.read",
    "order.read",
    "booking.read",
    "sales.sale.read",
    "finance.payment.read",
    "documents.read",
    "support.read",
  ],

  BUYER: ["catalog.product.read", "crm.customer.read", "order.read", "booking.read", "finance.payment.read"],
};
