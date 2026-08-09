import type { RoleCode } from "../generated/prisma/enums";

/**
 * Каталог granular permissions (RBAC Matrix Baseline 1.3 §4).
 * Правило: НЕ заменять всё одним `domain:write` — права гранулярные.
 * Каталог расширяется по мере добавления доменов (Sales/Finance в Phase 2).
 */
export const PERMISSIONS = {
  // ── Catalog ───────────────────────────────────────────────────────────
  "catalog.product.read": "Чтение продуктов",
  "catalog.product.read_for_moderation": "Чтение продуктов для модерации (MODERATOR)",
  "catalog.product.write": "Создание/изменение продуктов",
  "catalog.product.publish": "Публикация/архивация продукта",
  "catalog.product.submit_moderation": "Отправка продукта на модерацию",
  "catalog.product.create_own": "Создание собственного draft Product (PARTNER)",
  "catalog.product.update_own_draft": "Редактирование собственного draft Product (PARTNER)",
  "catalog.product.read_own": "Чтение собственных продуктов (PARTNER)",
  "catalog.product.channels_own": "Управление каналами публикации собственного Product (own-scope)",
  "catalog.category.write": "Управление категориями",
  "catalog.category_schema.read": "Чтение Category Schema (конфигурации категорий)",
  "catalog.category_schema.write": "Управление Category Schema (только ADMIN)",
  // Step 1.8 (clarification): Partner-safe read ACTIVE Category Schema для dynamic
  // Product form. PARTNER НЕ получает внутреннее category_schema.read — только это
  // отдельное право (ACTIVE, editor-контракт, без admin/internal metadata).
  "catalog.category_schema.read_active_for_product_edit": "Чтение ACTIVE Category Schema для формы создания Product (PARTNER)",
  "catalog.availability.write": "Управление availability",

  // ── Catalog media (Step 1.2, RBAC Matrix §3.1) ────────────────────────
  "catalog.media.upload_own": "Загрузка media собственного Product (PARTNER)",
  "catalog.media.update_own": "Обновление media собственного Product (PARTNER)",
  "catalog.media.delete_own": "Удаление media собственного Product (PARTNER)",
  "catalog.media.reorder_own": "Изменение порядка media собственного Product (PARTNER)",
  "catalog.media.set_primary_own": "Назначение primary image собственного Product (PARTNER)",
  "catalog.media.read_for_moderation": "Чтение media для модерации (MODERATOR)",

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

  // ── Communication (Step 1.16, canonical CML-*) ─────────────────────────
  // Узкие права: internal staff — read/create (заметки и зафиксированные
  // сообщения по business context); BUYER/PARTNER — только own-scope
  // read_own (не-NOTE/не-INTERNAL по доказанной linkage). Никакой permission
  // explosion, никаких широких internal CRM прав через communication (§34).
  "communication.read": "Чтение communications (internal staff, cross-domain context)",
  "communication.create": "Создание communication по business context (internal staff)",
  "communication.read_own": "Чтение собственных communications (BUYER/PARTNER own-scope)",

  // ── Account / own profile (Step 1.9, granular own-scope) ──────────────
  "account.profile.read": "Чтение собственного профиля/аккаунта (own-scope)",
  "account.profile.update": "Обновление собственного профиля (own-scope)",

  // ── Buyer Cabinet (Step 1.13, narrow own-scope read-models) ───────────
  // Узкие права: только собственные records через доказанную Buyer linkage
  // (Order.customerId / Booking→Order), read-only, БЕЗ internal CRM/finance прав.
  "account.order.read_own": "Чтение собственных заказов (Buyer Cabinet, own-scope)",
  "account.booking.read_own": "Чтение собственных бронирований (Buyer Cabinet, own-scope)",
  "account.payment.read_own": "Чтение собственных платежей (Buyer Cabinet, own-scope)",
  "account.document.read_own": "Чтение собственных документов (Buyer Cabinet, own-scope)",
  "account.support.read_own": "Чтение собственных обращений поддержки (Buyer Cabinet, own-scope)",

  // ── Partner onboarding (Step 1.10, own-scope + review) ────────────────
  "partner.onboarding.read_own": "Чтение собственной PartnerApplication (own-scope)",
  "partner.onboarding.update_own": "Редактирование собственной PartnerApplication (own-scope)",
  "partner.onboarding.submit_own": "Отправка собственной PartnerApplication на review",
  "partner.onboarding.review": "Review очереди PartnerApplication (start/approve/reject/request changes)",

  // ── Partner Storefront (Step 1.12.1, own-scope) ────────────────────────
  "storefront.read_own": "Чтение собственной Partner Storefront (own-scope)",
  "storefront.create_own": "Создание собственной Partner Storefront (own-scope, explicit provisioning)",
  "storefront.update_own": "Редактирование собственной Partner Storefront (own-scope)",
  "storefront.activate_own": "Активация/деактивация собственной Partner Storefront (own-scope)",
  "storefront.entitlement.manage": "Управление Storefront entitlement (операционная команда; граница будущего Billing domain)",

  // ── Public Seller Identity (Step 1.11, own-scope + moderated review) ───
  "seller_public_profile.read_own": "Чтение собственного PublicSellerProfile/предложений (own-scope)",
  "seller_public_profile.propose": "Создание/редактирование/отправка предложения публичной идентичности (own-scope)",
  "seller_public_profile.review": "Review очереди предложений публичной идентичности",
  "seller_public_profile.approve_alias": "Утверждение VERIFIED_ALIAS (alias продавца)",
  "seller_public_profile.approve_brand": "Утверждение PUBLIC_BRAND (реальный бренд)",
  "seller_public_profile.request_changes": "Запрос изменений в предложении публичной идентичности",
  "seller_public_profile.hide_identity": "Скрытие/восстановление публичной идентичности продавца",

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
  "moderation.request_changes": "Запрос изменений в модерации",
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
    "account.profile.read",
    "account.profile.update",
    "catalog.product.read",
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
    // Step 1.10: DIRECTOR участвует в review Partner onboarding.
    "partner.onboarding.review",
    // Step 1.16: DIRECTOR читает communications (cross-domain контекст).
    "communication.read",
  ],

  FINANCE: [
    "account.profile.read",
    "account.profile.update",
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
    "account.profile.read",
    "account.profile.update",
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
    "account.profile.read",
    "account.profile.update",
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

  // Step 1.3 review fix: MODERATOR имеет ТОЛЬКО moderation-права — review/approve/
  // reject/request_changes + read_for_moderation (product/media). БЕЗ catalog.product.publish
  // (прямая публикация запрещена — publish только через controlled Catalog publish
  // transition после moderation decision), БЕЗ catalog.product.read (unrestricted),
  // БЕЗ category/availability write (не контент-редактор за PARTNER).
  // Step 1.3 review fix: MODERATOR имеет ТОЛЬКО moderation-права — review/approve/
  // reject/request_changes + read_for_moderation (product/media). БЕЗ catalog.product.publish
  // (прямая публикация запрещена), БЕЗ catalog.product.read (unrestricted), БЕЗ
  // category/availability write, БЕЗ CRM edit rights (нет crm.partner.write и т.п.).
  // Step 1.11: MODERATOR управляет публичной идентичностью (seller_public_profile.*).
  MODERATOR: [
    "account.profile.read",
    "account.profile.update",
    "catalog.product.read_for_moderation",
    "catalog.media.read_for_moderation",
    "moderation.review",
    "moderation.approve",
    "moderation.reject",
    "moderation.request_changes",
    "seller_public_profile.review",
    "seller_public_profile.approve_alias",
    "seller_public_profile.approve_brand",
    "seller_public_profile.request_changes",
    "seller_public_profile.hide_identity",
  ],

  SALES_MANAGER: [
    "account.profile.read",
    "account.profile.update",
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
    // Step 1.16: SALES_MANAGER фиксирует/читает коммуникации по клиентам.
    "communication.read",
    "communication.create",
  ],

  OPERATOR: [
    "account.profile.read",
    "account.profile.update",
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
    // Step 1.16: OPERATOR фиксирует коммуникации по Order/Booking/Customer.
    "communication.read",
    "communication.create",
  ],

  // Step 1.3: PARTNER НЕ имеет unrestricted catalog.product.read — только
  // read_own (server-side scope WHERE partnerId = actor.partnerId).
  PARTNER: [
    "account.profile.read",
    "account.profile.update",
    "catalog.product.read_own",
    "catalog.product.create_own",
    "catalog.product.update_own_draft",
    "catalog.product.submit_moderation",
    "catalog.product.channels_own",
    // Step 1.8 (clarification): ТОЛЬКО editor-контракт ACTIVE схемы, НЕ internal
    // category_schema.read (последний отсутствует у PARTNER и не выдаётся).
    "catalog.category_schema.read_active_for_product_edit",
    "catalog.media.upload_own",
    "catalog.media.update_own",
    "catalog.media.delete_own",
    "catalog.media.reorder_own",
    "catalog.media.set_primary_own",
    "crm.customer.read",
    "order.read",
    "booking.read",
    "sales.sale.read",
    "finance.payment.read",
    "documents.read",
    "support.read",
    // Step 1.10: PARTNER управляет СВОЕЙ PartnerApplication (onboarding), пока
    // partnerId не назначен. Selling-доступ выдаётся ТОЛЬКО approve (см. gates).
    "partner.onboarding.read_own",
    "partner.onboarding.update_own",
    "partner.onboarding.submit_own",
    // Step 1.11: PARTNER предлагает свою публичную идентичность (own-scope),
    // НЕ self-approve и НЕ сам переключает visibilityMode.
    "seller_public_profile.read_own",
    "seller_public_profile.propose",
    // Step 1.12.1: PARTNER управляет СВОЕЙ витриной (own-scope). Узкие права —
    // никаких широких internal Catalog permissions. activate_own покрывает и
    // деактивацию (тот же lifecycle-контроль).
    "storefront.read_own",
    "storefront.create_own",
    "storefront.update_own",
    "storefront.activate_own",
    // Step 1.16: PARTNER читает communications своего Partner-контекста
    // (own-scope, не-NOTE/не-INTERNAL). Никаких широких internal прав.
    "communication.read_own",
  ],

  // Step 1.3 review fix: BUYER БЕЗ unrestricted internal catalog.product.read —
  // internal/draft Product недоступны до Public Marketplace (отдельный
  // published-public read contract появится с этим шагом).
  // Step 1.9: BUYER получает только own-scope profile-права (аккаунт/профиль).
  // Step 1.13 (Buyer Cabinet): BUYER НЕ получает internal CRM/Order/Booking/Finance
  // права (`crm.customer.read`/`order.read`/`booking.read`/`finance.payment.read`
  // отозваны — это internal/unscoped read-контракты). Вместо них — узкие
  // own-scope read-model права Buyer Cabinet (§15): объектный scope всегда
  // определяется сервером через actor.customerId, никогда через query/body.
  BUYER: [
    "account.profile.read",
    "account.profile.update",
    "account.order.read_own",
    "account.booking.read_own",
    "account.payment.read_own",
    "account.document.read_own",
    "account.support.read_own",
    // Step 1.16: BUYER читает communications своего Customer-контекста
    // (own-scope, не-NOTE/не-INTERNAL).
    "communication.read_own",
  ],
};
