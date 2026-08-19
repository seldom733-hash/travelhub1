-- Step 3.2: Full RBAC snapshot migration
-- Materializes the complete ROLE_PERMISSIONS matrix including 5 new dashboard permissions.
-- Idempotent: safe to re-apply. Does NOT delete existing RolePermission rows.
-- Authority: after this migration, RolePermission rows = persisted effective state.

-- 1. Ensure all canonical Role rows exist
INSERT INTO "security"."Role" ("id", "code", "title") VALUES
  (gen_random_uuid(), 'ADMIN', 'Администратор'),
  (gen_random_uuid(), 'DIRECTOR', 'Директор'),
  (gen_random_uuid(), 'FINANCE', 'Финансы'),
  (gen_random_uuid(), 'MARKETER', 'Маркетолог'),
  (gen_random_uuid(), 'ANALYST', 'Аналитик'),
  (gen_random_uuid(), 'MODERATOR', 'Модератор'),
  (gen_random_uuid(), 'SALES_MANAGER', 'Менеджер продаж'),
  (gen_random_uuid(), 'OPERATOR', 'Оператор'),
  (gen_random_uuid(), 'PARTNER', 'Партнёр'),
  (gen_random_uuid(), 'BUYER', 'Покупатель')
ON CONFLICT ("code") DO NOTHING;

-- 2. Ensure all Permission rows exist (full catalog snapshot + 5 new dashboard permissions)
INSERT INTO "security"."Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'catalog.product.read', 'Чтение продуктов'),
  (gen_random_uuid(), 'catalog.product.read_for_moderation', 'Чтение продуктов для модерации (MODERATOR)'),
  (gen_random_uuid(), 'catalog.product.write', 'Создание/изменение продуктов'),
  (gen_random_uuid(), 'catalog.product.publish', 'Публикация/архивация продукта'),
  (gen_random_uuid(), 'catalog.product.submit_moderation', 'Отправка продукта на модерацию'),
  (gen_random_uuid(), 'catalog.product.create_own', 'Создание собственного draft Product (PARTNER)'),
  (gen_random_uuid(), 'catalog.product.update_own_draft', 'Редактирование собственного draft Product (PARTNER)'),
  (gen_random_uuid(), 'catalog.product.read_own', 'Чтение собственных продуктов (PARTNER)'),
  (gen_random_uuid(), 'catalog.product.channels_own', 'Управление каналами публикации собственного Product (own-scope)'),
  (gen_random_uuid(), 'catalog.service_unit.publish', 'Публикация/архивация Service Unit'),
  (gen_random_uuid(), 'catalog.rate_plan.publish', 'Архивация/активация Rate Plan'),
  (gen_random_uuid(), 'catalog.category.write', 'Управление категориями'),
  (gen_random_uuid(), 'catalog.category_schema.read', 'Чтение Category Schema'),
  (gen_random_uuid(), 'catalog.category_schema.write', 'Управление Category Schema (только ADMIN)'),
  (gen_random_uuid(), 'catalog.category_schema.read_active_for_product_edit', 'Чтение ACTIVE Category Schema для формы создания Product (PARTNER)'),
  (gen_random_uuid(), 'catalog.availability.write', 'Управление availability'),
  (gen_random_uuid(), 'catalog.media.upload_own', 'Загрузка media собственного Product (PARTNER)'),
  (gen_random_uuid(), 'catalog.media.update_own', 'Обновление media собственного Product (PARTNER)'),
  (gen_random_uuid(), 'catalog.media.delete_own', 'Удаление media собственного Product (PARTNER)'),
  (gen_random_uuid(), 'catalog.media.reorder_own', 'Изменение порядка media собственного Product (PARTNER)'),
  (gen_random_uuid(), 'catalog.media.set_primary_own', 'Назначение primary image собственного Product (PARTNER)'),
  (gen_random_uuid(), 'catalog.media.read_for_moderation', 'Чтение media для модерации (MODERATOR)'),
  (gen_random_uuid(), 'crm.customer.read', 'Чтение клиентов'),
  (gen_random_uuid(), 'crm.customer.write', 'Создание/изменение клиентов'),
  (gen_random_uuid(), 'crm.contact.write', 'Управление контактами'),
  (gen_random_uuid(), 'crm.company.write', 'Управление компаниями'),
  (gen_random_uuid(), 'crm.partner.write', 'Управление партнёрами'),
  (gen_random_uuid(), 'crm.supplier.write', 'Управление поставщиками'),
  (gen_random_uuid(), 'order.read', 'Чтение заказов'),
  (gen_random_uuid(), 'order.accept', 'Принятие заказа в работу'),
  (gen_random_uuid(), 'order.edit_noncritical', 'Редактирование некритичных данных заказа'),
  (gen_random_uuid(), 'order.request_booking', 'Передача заказа в Booking'),
  (gen_random_uuid(), 'order.suspend', 'Приостановка заказа'),
  (gen_random_uuid(), 'order.cancel', 'Отмена заказа'),
  (gen_random_uuid(), 'order.close', 'Закрытие заказа'),
  (gen_random_uuid(), 'booking.read', 'Чтение бронирований'),
  (gen_random_uuid(), 'booking.send_supplier', 'Отправка запроса поставщику'),
  (gen_random_uuid(), 'booking.confirm', 'Подтверждение/отклонение бронирования'),
  (gen_random_uuid(), 'booking.request_change', 'Запрос изменения бронирования'),
  (gen_random_uuid(), 'booking.cancel', 'Отмена бронирования'),
  (gen_random_uuid(), 'sales.lead.read', 'Чтение лидов'),
  (gen_random_uuid(), 'sales.lead.write', 'Управление лидами'),
  (gen_random_uuid(), 'sales.opportunity.read', 'Чтение сделок'),
  (gen_random_uuid(), 'sales.opportunity.write', 'Управление сделками'),
  (gen_random_uuid(), 'sales.quote.read', 'Чтение коммерческих предложений'),
  (gen_random_uuid(), 'sales.quote.write', 'Управление КП'),
  (gen_random_uuid(), 'sales.quote.approve', 'Согласование КП'),
  (gen_random_uuid(), 'sales.sale.read', 'Чтение продаж'),
  (gen_random_uuid(), 'sales.sale.write', 'Управление продажами'),
  (gen_random_uuid(), 'sales.sale.complete', 'Завершение продажи'),
  (gen_random_uuid(), 'sales.kpi.read', 'Чтение агрегированного Sales read model (KPI, count-based)'),
  (gen_random_uuid(), 'sales.checkout.read', 'Чтение checkout commercial intent context'),
  (gen_random_uuid(), 'sales.checkout.write', 'Управление checkout commercial intent context'),
  (gen_random_uuid(), 'finance.payment.read', 'Чтение платежей'),
  (gen_random_uuid(), 'finance.payment.write', 'Управление платежами'),
  (gen_random_uuid(), 'finance.refund.read', 'Чтение возвратов'),
  (gen_random_uuid(), 'finance.refund.write', 'Управление возвратами (создание/исполнение)'),
  (gen_random_uuid(), 'finance.refund.approve', 'Согласование возвратов'),
  (gen_random_uuid(), 'finance.dispute.read', 'Чтение споров'),
  (gen_random_uuid(), 'finance.dispute.write', 'Управление спорами (открытие/закрытие)'),
  (gen_random_uuid(), 'finance.invoice.read', 'Чтение счетов'),
  (gen_random_uuid(), 'finance.invoice.write', 'Выставление счетов'),
  (gen_random_uuid(), 'finance.commission.read', 'Чтение комиссий'),
  (gen_random_uuid(), 'finance.commission.write', 'Управление комиссиями'),
  (gen_random_uuid(), 'finance.commission.manage', 'Управление Commission Policy'),
  (gen_random_uuid(), 'finance.currency.manage', 'Управление валютами'),
  (gen_random_uuid(), 'finance.exchange_rate.manage', 'Управление курсами'),
  (gen_random_uuid(), 'finance.tax.manage', 'Управление налогами'),
  (gen_random_uuid(), 'finance.ledger.read', 'Чтение LedgerTransaction (Finance Center)'),
  (gen_random_uuid(), 'finance.provider_fee.read', 'Чтение ProviderFee (Finance Center)'),
  (gen_random_uuid(), 'finance.settlement.read', 'Чтение Settlement (Finance Center)'),
  (gen_random_uuid(), 'finance.payout.read', 'Чтение Payout (Finance Center)'),
  (gen_random_uuid(), 'communication.read', 'Чтение communications (internal staff)'),
  (gen_random_uuid(), 'communication.create', 'Создание communication по business context (internal staff)'),
  (gen_random_uuid(), 'communication.read_own', 'Чтение собственных communications (BUYER/PARTNER own-scope)'),
  (gen_random_uuid(), 'communication.write_own', 'Открытие/отправка в собственные pre-sale conversations'),
  (gen_random_uuid(), 'reverse.capability.read_own', 'Чтение собственных Seller Commercial Capabilities (own-scope)'),
  (gen_random_uuid(), 'reverse.capability.write_own', 'Создание/изменение собственных Seller Commercial Capabilities (own-scope)'),
  (gen_random_uuid(), 'reverse.request.read_own', 'Чтение собственных Buyer Requests (BUYER own-scope)'),
  (gen_random_uuid(), 'reverse.request.write_own', 'Создание/изменение собственных Buyer Requests (BUYER own-scope)'),
  (gen_random_uuid(), 'reverse.match.run', 'Запуск matching/distribution для BuyerRequest (system command)'),
  (gen_random_uuid(), 'reverse.distribution.read_own', 'Чтение распределённых Buyer Requests (Seller own-scope inbox)'),
  (gen_random_uuid(), 'reverse.proposal.read_own', 'Чтение собственных Seller Proposals (Seller own-scope)'),
  (gen_random_uuid(), 'reverse.proposal.write_own', 'Создание/изменение собственных Seller Proposals (Seller own-scope)'),
  (gen_random_uuid(), 'reverse.proposal.select_own', 'Выбор Seller Proposal → конверсия в Opportunity (BUYER own-scope)'),
  (gen_random_uuid(), 'account.profile.read', 'Чтение собственного профиля/аккаунта (own-scope)'),
  (gen_random_uuid(), 'account.profile.update', 'Обновление собственного профиля (own-scope)'),
  (gen_random_uuid(), 'account.order.read_own', 'Чтение собственных заказов (Buyer Cabinet, own-scope)'),
  (gen_random_uuid(), 'account.booking.read_own', 'Чтение собственных бронирований (Buyer Cabinet, own-scope)'),
  (gen_random_uuid(), 'account.payment.read_own', 'Чтение собственных платежей (Buyer Cabinet, own-scope)'),
  (gen_random_uuid(), 'account.document.read_own', 'Чтение собственных документов (Buyer Cabinet, own-scope)'),
  (gen_random_uuid(), 'account.support.read_own', 'Чтение собственных обращений поддержки (Buyer Cabinet, own-scope)'),
  (gen_random_uuid(), 'partner.onboarding.read_own', 'Чтение собственной PartnerApplication (own-scope)'),
  (gen_random_uuid(), 'partner.onboarding.update_own', 'Редактирование собственной PartnerApplication (own-scope)'),
  (gen_random_uuid(), 'partner.onboarding.submit_own', 'Отправка собственной PartnerApplication на review'),
  (gen_random_uuid(), 'partner.onboarding.review', 'Review очереди PartnerApplication'),
  (gen_random_uuid(), 'storefront.read_own', 'Чтение собственной Partner Storefront (own-scope)'),
  (gen_random_uuid(), 'storefront.create_own', 'Создание собственной Partner Storefront (own-scope)'),
  (gen_random_uuid(), 'storefront.update_own', 'Редактирование собственной Partner Storefront (own-scope)'),
  (gen_random_uuid(), 'storefront.activate_own', 'Активация/деактивация собственной Partner Storefront (own-scope)'),
  (gen_random_uuid(), 'storefront.entitlement.manage', 'Управление Storefront entitlement'),
  (gen_random_uuid(), 'seller_public_profile.read_own', 'Чтение собственного PublicSellerProfile (own-scope)'),
  (gen_random_uuid(), 'seller_public_profile.propose', 'Создание предложения публичной идентичности (own-scope)'),
  (gen_random_uuid(), 'seller_public_profile.review', 'Review очереди предложений публичной идентичности'),
  (gen_random_uuid(), 'seller_public_profile.approve_alias', 'Утверждение VERIFIED_ALIAS'),
  (gen_random_uuid(), 'seller_public_profile.approve_brand', 'Утверждение PUBLIC_BRAND'),
  (gen_random_uuid(), 'seller_public_profile.request_changes', 'Запрос изменений в предложении публичной идентичности'),
  (gen_random_uuid(), 'seller_public_profile.hide_identity', 'Скрытие/восстановление публичной идентичности продавца'),
  (gen_random_uuid(), 'support.read', 'Чтение обращений поддержки'),
  (gen_random_uuid(), 'support.write', 'Обработка обращений поддержки'),
  (gen_random_uuid(), 'documents.read', 'Чтение документов'),
  (gen_random_uuid(), 'documents.write', 'Управление документами'),
  (gen_random_uuid(), 'settings.read', 'Чтение настроек'),
  (gen_random_uuid(), 'settings.write', 'Управление настройками'),
  (gen_random_uuid(), 'audit.read', 'Чтение аудита'),
  (gen_random_uuid(), 'analytics.read', 'Чтение аналитики'),
  (gen_random_uuid(), 'reports.read', 'Чтение отчётов'),
  (gen_random_uuid(), 'moderation.review', 'Ревью модерации'),
  (gen_random_uuid(), 'moderation.approve', 'Одобрение модерации'),
  (gen_random_uuid(), 'moderation.reject', 'Отклонение модерации'),
  (gen_random_uuid(), 'moderation.request_changes', 'Запрос изменений в модерации'),
  -- Step 3.2: 5 new dashboard section authority permissions
  (gen_random_uuid(), 'dashboard.executive.read', 'Чтение Executive KPIs (GMV, Revenue, Orders, Bookings, AOV, Conversion)'),
  (gen_random_uuid(), 'dashboard.operational.read', 'Чтение Operational KPIs (Orders Fulfilled, Bookings Confirmed, Funnel)'),
  (gen_random_uuid(), 'dashboard.financial.read', 'Чтение Financial KPIs (Commission, Reconciliation, Payments)'),
  (gen_random_uuid(), 'dashboard.marketplace.read', 'Чтение Marketplace KPIs (Sessions, Partners, Customers)'),
  (gen_random_uuid(), 'dashboard.customize', 'Настройка layout Command Center (save/reset)')
ON CONFLICT ("code") DO NOTHING;

-- 3. Default RolePermission assignments (full ROLE_PERMISSIONS snapshot)
-- Only adds missing links. Does NOT delete existing rows.

-- ADMIN gets ALL_PERMISSIONS
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE r."code" = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- DIRECTOR defaults
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'account.profile.read', 'account.profile.update', 'catalog.product.read',
  'catalog.category_schema.read', 'crm.customer.read', 'order.read', 'booking.read',
  'sales.lead.read', 'sales.opportunity.read', 'sales.quote.read', 'sales.sale.read',
  'sales.kpi.read', 'sales.checkout.read', 'finance.payment.read', 'finance.refund.read',
  'finance.dispute.read', 'finance.invoice.read', 'finance.commission.read',
  'finance.ledger.read', 'finance.provider_fee.read', 'finance.settlement.read',
  'finance.payout.read', 'support.read', 'documents.read', 'settings.read',
  'audit.read', 'analytics.read', 'reports.read', 'partner.onboarding.review',
  'communication.read',
  'dashboard.executive.read', 'dashboard.operational.read', 'dashboard.financial.read',
  'dashboard.marketplace.read', 'dashboard.customize'
)
WHERE r."code" = 'DIRECTOR'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- FINANCE defaults
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'account.profile.read', 'account.profile.update', 'catalog.product.read',
  'order.read', 'booking.read', 'sales.sale.read',
  'finance.payment.read', 'finance.payment.write', 'finance.refund.read',
  'finance.refund.write', 'finance.refund.approve', 'finance.dispute.read',
  'finance.dispute.write', 'finance.invoice.read', 'finance.invoice.write',
  'finance.commission.read', 'finance.commission.write', 'finance.commission.manage',
  'finance.currency.manage', 'finance.exchange_rate.manage', 'finance.tax.manage',
  'finance.ledger.read', 'finance.provider_fee.read', 'finance.settlement.read',
  'finance.payout.read', 'support.read', 'documents.read', 'settings.read', 'audit.read'
)
WHERE r."code" = 'FINANCE'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- MARKETER defaults
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'account.profile.read', 'account.profile.update', 'catalog.product.read',
  'sales.kpi.read', 'analytics.read', 'reports.read', 'settings.read',
  'dashboard.executive.read', 'dashboard.marketplace.read', 'dashboard.customize'
)
WHERE r."code" = 'MARKETER'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- ANALYST defaults
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'account.profile.read', 'account.profile.update', 'catalog.product.read',
  'order.read', 'booking.read', 'sales.kpi.read',
  'finance.payment.read', 'finance.refund.read', 'finance.dispute.read',
  'finance.invoice.read', 'finance.commission.read', 'finance.ledger.read',
  'finance.provider_fee.read', 'finance.settlement.read', 'finance.payout.read',
  'support.read', 'documents.read', 'settings.read', 'audit.read',
  'analytics.read', 'reports.read',
  'dashboard.executive.read', 'dashboard.operational.read', 'dashboard.financial.read',
  'dashboard.marketplace.read', 'dashboard.customize'
)
WHERE r."code" = 'ANALYST'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- MODERATOR defaults
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'account.profile.read', 'account.profile.update',
  'catalog.product.read_for_moderation', 'catalog.media.read_for_moderation',
  'moderation.review', 'moderation.approve', 'moderation.reject',
  'moderation.request_changes', 'seller_public_profile.review',
  'seller_public_profile.approve_alias', 'seller_public_profile.approve_brand',
  'seller_public_profile.request_changes', 'seller_public_profile.hide_identity'
)
WHERE r."code" = 'MODERATOR'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- SALES_MANAGER defaults
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'account.profile.read', 'account.profile.update', 'catalog.product.read',
  'crm.customer.read', 'crm.customer.write', 'crm.contact.write',
  'order.read', 'booking.read', 'sales.lead.read', 'sales.lead.write',
  'sales.opportunity.read', 'sales.opportunity.write', 'sales.quote.read',
  'sales.quote.write', 'sales.quote.approve', 'sales.sale.read', 'sales.sale.write',
  'sales.sale.complete', 'sales.kpi.read', 'sales.checkout.read', 'sales.checkout.write',
  'finance.payment.read', 'finance.refund.read', 'finance.dispute.read',
  'finance.invoice.read', 'support.read', 'documents.read',
  'communication.read', 'communication.create'
)
WHERE r."code" = 'SALES_MANAGER'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- OPERATOR defaults
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'account.profile.read', 'account.profile.update', 'catalog.product.read',
  'crm.customer.read', 'crm.customer.write', 'crm.contact.write',
  'order.read', 'order.accept', 'order.edit_noncritical', 'order.request_booking',
  'order.suspend', 'order.cancel', 'order.close',
  'booking.read', 'booking.send_supplier', 'booking.confirm',
  'booking.request_change', 'booking.cancel',
  'support.read', 'support.write', 'documents.read', 'documents.write',
  'communication.read', 'communication.create'
)
WHERE r."code" = 'OPERATOR'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- PARTNER defaults
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'account.profile.read', 'account.profile.update',
  'catalog.product.read_own', 'catalog.product.create_own',
  'catalog.product.update_own_draft', 'catalog.product.submit_moderation',
  'catalog.product.channels_own',
  'catalog.category_schema.read_active_for_product_edit',
  'catalog.media.upload_own', 'catalog.media.update_own', 'catalog.media.delete_own',
  'catalog.media.reorder_own', 'catalog.media.set_primary_own',
  'partner.onboarding.read_own', 'partner.onboarding.update_own',
  'partner.onboarding.submit_own',
  'seller_public_profile.read_own', 'seller_public_profile.propose',
  'storefront.read_own', 'storefront.create_own', 'storefront.update_own',
  'storefront.activate_own',
  'communication.read_own', 'communication.write_own',
  'reverse.capability.read_own', 'reverse.capability.write_own',
  'reverse.distribution.read_own',
  'reverse.proposal.read_own', 'reverse.proposal.write_own'
)
WHERE r."code" = 'PARTNER'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- BUYER defaults
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r
JOIN "security"."Permission" p ON p."code" IN (
  'account.profile.read', 'account.profile.update',
  'reverse.request.read_own', 'reverse.request.write_own',
  'reverse.proposal.read_own', 'reverse.proposal.select_own',
  'account.order.read_own', 'account.booking.read_own',
  'account.payment.read_own', 'account.document.read_own',
  'account.support.read_own',
  'communication.read_own', 'communication.write_own'
)
WHERE r."code" = 'BUYER'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );
