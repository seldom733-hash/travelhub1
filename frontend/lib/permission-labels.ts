/**
 * Centralized human-readable names for RBAC permission codes.
 *
 * The permission CODE is the stable authorization/database identifier and MUST
 * NOT change. This dictionary is display-only and is shared by every UI that
 * shows permissions (role editor, user role card, effective permissions).
 *
 * Locale structure is ready for ru/az/en; currently Russian is canonical and
 * az/en fall back to it until translated. Unknown codes never expose the raw
 * dotted identifier: a humanized fallback is shown and the miss is logged once.
 */
export type PermissionLocale = "ru" | "az" | "en";

export interface PermissionLabel {
  ru: string;
  az?: string;
  en?: string;
}

export const PERMISSION_LABELS: Record<string, PermissionLabel> = {
  "geography.read": { ru: "Просмотр географического справочника" },
  "geography.create": { ru: "Создание записей географического справочника" },
  "geography.update": { ru: "Изменение записей географического справочника" },
  "geography.delete": { ru: "Удаление записей географического справочника" },
  "hotel_directory.read": { ru: "Просмотр гостиничного справочника" },
  "hotel_directory.create": { ru: "Создание записей гостиничного справочника" },
  "hotel_directory.update": { ru: "Изменение записей гостиничного справочника" },
  "hotel_directory.delete": { ru: "Удаление записей гостиничного справочника" },
  "catalog.dictionary.propose": { ru: "Предложение нового типа или вида в справочник" },
  "catalog.product.read": { ru: "Просмотр турпродуктов" },
  "catalog.product.read_for_moderation": { ru: "Просмотр турпродуктов на модерации" },
  "catalog.product.write": { ru: "Создание и изменение турпродуктов" },
  "catalog.product.publish": { ru: "Публикация и архивация турпродуктов" },
  "catalog.product.submit_moderation": { ru: "Отправка турпродукта на модерацию" },
  "catalog.product.create_own": { ru: "Создание собственных турпродуктов" },
  "catalog.product.update_own_draft": { ru: "Изменение собственных черновиков турпродуктов" },
  "catalog.product.read_own": { ru: "Просмотр собственных турпродуктов" },
  "catalog.product.channels_own": { ru: "Управление каналами публикации собственных турпродуктов" },
  "catalog.service_unit.publish": { ru: "Публикация и архивация услуг" },
  "catalog.rate_plan.publish": { ru: "Архивация и активация тарифных планов" },
  "catalog.category.write": { ru: "Управление категориями" },
  "catalog.category_schema.read": { ru: "Просмотр схем категорий" },
  "catalog.category_schema.write": { ru: "Управление схемами категорий" },
  "catalog.category_schema.read_active_for_product_edit": { ru: "Просмотр активных схем категорий при редактировании турпродукта" },
  "catalog.availability.write": { ru: "Управление доступностью" },
  "catalog.media.upload_own": { ru: "Загрузка медиа собственных турпродуктов" },
  "catalog.media.update_own": { ru: "Изменение медиа собственных турпродуктов" },
  "catalog.media.delete_own": { ru: "Удаление медиа собственных турпродуктов" },
  "catalog.media.reorder_own": { ru: "Изменение порядка медиа собственных турпродуктов" },
  "catalog.media.set_primary_own": { ru: "Выбор главного изображения собственного турпродукта" },
  "catalog.media.read_for_moderation": { ru: "Просмотр медиа на модерации" },
  "crm.activity.read": { ru: "Просмотр истории взаимодействий с клиентами и партнёрами" },
  "crm.customer.read": { ru: "Просмотр клиентов" },
  "crm.customer.write": { ru: "Создание и изменение клиентов" },
  "crm.contact.write": { ru: "Управление контактами" },
  "crm.company.write": { ru: "Управление компаниями" },
  "crm.partner.read": { ru: "Просмотр партнёров" },
  "crm.partner.write": { ru: "Управление партнёрами" },
  "crm.supplier.write": { ru: "Управление поставщиками" },
  "supplier.search.read": { ru: "Просмотр поиска и предложений поставщиков" },
  "supplier.search.manage": { ru: "Синхронизация и управление кэшем поставщиков" },
  "crm.customer.read_own": { ru: "Просмотр собственных клиентов" },
  "crm.customer.create_own": { ru: "Добавление клиентов и лидов в собственный CRM" },
  "crm.customer.update_own": { ru: "Изменение собственных клиентов, тегов и заметок" },
  "order.read": { ru: "Просмотр заказов" },
  "order.accept": { ru: "Принятие заказа в работу" },
  "order.edit_noncritical": { ru: "Изменение некритичных данных заказа" },
  "order.request_booking": { ru: "Передача заказа в бронирование" },
  "order.suspend": { ru: "Приостановка заказа" },
  "order.cancel": { ru: "Отмена заказов" },
  "order.close": { ru: "Закрытие заказов" },
  "booking.read": { ru: "Просмотр бронирований" },
  "booking.send_supplier": { ru: "Отправка запроса поставщику" },
  "booking.confirm": { ru: "Подтверждение и отклонение бронирований" },
  "booking.request_change": { ru: "Запрос изменения бронирования" },
  "booking.cancel": { ru: "Отмена бронирований" },
  "booking.return_to_order": { ru: "Возврат бронирования в заказ" },
  "sales.lead.read": { ru: "Просмотр лидов" },
  "sales.lead.write": { ru: "Управление лидами" },
  "sales.opportunity.read": { ru: "Просмотр сделок" },
  "sales.opportunity.write": { ru: "Управление сделками" },
  "sales.quote.read": { ru: "Просмотр коммерческих предложений" },
  "sales.quote.write": { ru: "Управление коммерческими предложениями" },
  "sales.quote.approve": { ru: "Согласование коммерческих предложений" },
  "sales.sale.read": { ru: "Просмотр продаж" },
  "sales.sale.write": { ru: "Управление продажами" },
  "sales.sale.complete": { ru: "Завершение продаж" },
  "sales.kpi.read": { ru: "Просмотр сводных показателей продаж" },
  "sales.checkout.read": { ru: "Просмотр контекста оформления заказа" },
  "sales.checkout.write": { ru: "Управление контекстом оформления заказа" },
  "sales.discount.grant": { ru: "Предоставление индивидуальной скидки" },
  "finance.payment.read": { ru: "Просмотр платежей" },
  "finance.payment.write": { ru: "Управление платежами" },
  "finance.payment.create": { ru: "Создание платежей" },
  "finance.payment.manage": { ru: "Подтверждение, отмена и завершение платежей" },
  "finance.refund.read": { ru: "Просмотр возвратов" },
  "finance.refund.write": { ru: "Создание возвратов" },
  "finance.refund.approve": { ru: "Согласование возвратов" },
  "finance.refund.execute": { ru: "Исполнение возвратов" },
  "finance.dispute.read": { ru: "Просмотр споров" },
  "finance.dispute.write": { ru: "Управление спорами" },
  "finance.invoice.read": { ru: "Просмотр счетов" },
  "finance.invoice.write": { ru: "Выставление счетов" },
  "finance.commission.read": { ru: "Просмотр комиссий" },
  "finance.commission.write": { ru: "Управление комиссиями" },
  "finance.commission.manage": { ru: "Управление политикой комиссий" },
  "finance.currency.manage": { ru: "Управление валютами" },
  "finance.exchange_rate.manage": { ru: "Управление курсами валют" },
  "finance.tax.manage": { ru: "Управление налогами" },
  "finance.fx_rate.read": { ru: "Просмотр курсов поставщиков к AZN" },
  "finance.fx_rate.manage": { ru: "Управление курсами поставщиков к AZN" },
  "finance.obligation.read": { ru: "Просмотр обязательств поставщиков" },
  "finance.obligation.manage": { ru: "Управление обязательствами поставщиков" },
  "finance.supplier_payout.read": { ru: "Просмотр выплат поставщикам" },
  "finance.supplier_payout.manage": { ru: "Создание выплат поставщикам" },
  "finance.supplier_payment.confirm": { ru: "Подтверждение исполнения платежа поставщику" },
  "finance.overview.read": { ru: "Просмотр финансовой сводки" },
  "finance.ledger.read": { ru: "Просмотр финансовых проводок" },
  "finance.provider_fee.read": { ru: "Просмотр комиссий провайдеров" },
  "finance.settlement.read": { ru: "Просмотр расчётов" },
  "finance.payout.read": { ru: "Просмотр выплат" },
  "pricing.markup.read": { ru: "Просмотр правил наценки и матрицы наценок" },
  "pricing.markup.manage": { ru: "Управление правилами наценки" },
  "communication.read": { ru: "Просмотр внутренних сообщений" },
  "communication.create": { ru: "Создание сообщений по бизнес-контексту" },
  "communication.read_own": { ru: "Просмотр собственных сообщений" },
  "communication.write_own": { ru: "Ведение собственных предпродажных диалогов" },
  "reverse.capability.read_own": { ru: "Просмотр собственных коммерческих возможностей продавца" },
  "reverse.capability.write_own": { ru: "Управление собственными коммерческими возможностями продавца" },
  "reverse.request.read_own": { ru: "Просмотр собственных заявок покупателя" },
  "reverse.request.write_own": { ru: "Создание и изменение собственных заявок покупателя" },
  "reverse.match.run": { ru: "Запуск подбора и распределения заявок покупателей" },
  "reverse.distribution.read_own": { ru: "Просмотр распределённых собственных заявок покупателя" },
  "reverse.proposal.read_own": { ru: "Просмотр собственных предложений продавца" },
  "reverse.proposal.write_own": { ru: "Создание и изменение собственных предложений продавца" },
  "reverse.proposal.select_own": { ru: "Выбор предложения продавца по собственной заявке" },
  "account.profile.read": { ru: "Просмотр собственного профиля" },
  "account.profile.update": { ru: "Изменение собственного профиля" },
  "account.order.read_own": { ru: "Просмотр собственных заказов" },
  "account.booking.read_own": { ru: "Просмотр собственных бронирований" },
  "account.payment.read_own": { ru: "Просмотр собственных платежей" },
  "account.document.read_own": { ru: "Просмотр собственных документов" },
  "account.support.read_own": { ru: "Просмотр собственных обращений в поддержку" },
  "partner.onboarding.read_own": { ru: "Просмотр собственной заявки партнёра" },
  "partner.onboarding.update_own": { ru: "Изменение собственной заявки партнёра" },
  "partner.onboarding.submit_own": { ru: "Отправка заявки партнёра на рассмотрение" },
  "partner.onboarding.review": { ru: "Рассмотрение заявок партнёров" },
  "storefront.read_own": { ru: "Просмотр собственной витрины партнёра" },
  "storefront.create_own": { ru: "Создание собственной витрины партнёра" },
  "storefront.update_own": { ru: "Изменение собственной витрины партнёра" },
  "storefront.activate_own": { ru: "Активация и деактивация собственной витрины партнёра" },
  "storefront.entitlement.manage": { ru: "Управление доступом к витринам партнёров" },
  "seller_public_profile.read_own": { ru: "Просмотр собственного публичного профиля продавца" },
  "seller_public_profile.propose": { ru: "Предложение публичной идентичности продавца" },
  "seller_public_profile.review": { ru: "Рассмотрение предложений публичной идентичности" },
  "seller_public_profile.approve_alias": { ru: "Утверждение псевдонима продавца" },
  "seller_public_profile.approve_brand": { ru: "Утверждение публичного бренда продавца" },
  "seller_public_profile.request_changes": { ru: "Запрос изменений публичной идентичности" },
  "seller_public_profile.hide_identity": { ru: "Скрытие и восстановление публичной идентичности продавца" },
  "operational-notes.read": { ru: "Просмотр рабочих заметок" },
  "operational-notes.create": { ru: "Создание рабочих заметок" },
  "operational-notes.update": { ru: "Изменение рабочих заметок" },
  "operational-notes.delete": { ru: "Удаление рабочих заметок" },
  "support.read": { ru: "Просмотр обращений в поддержку" },
  "support.write": { ru: "Обработка обращений в поддержку" },
  "support.case.create": { ru: "Создание обращений в поддержку" },
  "support.case.read": { ru: "Просмотр обращений в поддержку" },
  "support.case.update": { ru: "Изменение обращений в поддержку" },
  "support.case.assign": { ru: "Назначение обращений в поддержку исполнителю" },
  "support.case.delete": { ru: "Удаление обращений в поддержку" },
  "documents.read": { ru: "Просмотр документов" },
  "documents.write": { ru: "Управление документами" },
  "settings.read": { ru: "Просмотр настроек" },
  "settings.write": { ru: "Управление настройками" },
  "audit.read": { ru: "Просмотр журнала аудита" },
  "analytics.read": { ru: "Просмотр аналитики" },
  "reports.read": { ru: "Просмотр отчётов" },
  "moderation.review": { ru: "Рассмотрение на модерации" },
  "moderation.approve": { ru: "Одобрение на модерации" },
  "moderation.reject": { ru: "Отклонение на модерации" },
  "moderation.request_changes": { ru: "Запрос изменений на модерации" },
  "dashboard.executive.read": { ru: "Просмотр ключевых показателей для руководства" },
  "dashboard.operational.read": { ru: "Просмотр операционных показателей" },
  "dashboard.financial.read": { ru: "Просмотр финансовых показателей" },
  "dashboard.marketplace.read": { ru: "Просмотр показателей маркетплейса" },
  "dashboard.catalog.read": { ru: "Просмотр состояния каталога" },
  "dashboard.channels.read": { ru: "Просмотр показателей каналов продаж" },
  "dashboard.attention.read": { ru: "Просмотр задач, требующих внимания" },
  "dashboard.insights.read": { ru: "Просмотр ленты рекомендаций и рисков" },
  "dashboard.customize": { ru: "Настройка рабочего стола" },
  "marketing.read": { ru: "Просмотр маркетинговых данных" },
  "marketing.campaign.read": { ru: "Просмотр маркетинговых кампаний" },
  "marketing.campaign.create": { ru: "Создание маркетинговых кампаний" },
  "marketing.campaign.update": { ru: "Изменение маркетинговых кампаний" },
  "marketing.campaign.delete": { ru: "Удаление маркетинговых кампаний" },
  "marketing.audience.read": { ru: "Просмотр маркетинговых аудиторий" },
  "marketing.audience.manage": { ru: "Управление маркетинговыми аудиториями" },
  "marketing.attribution.read": { ru: "Просмотр маркетинговых атрибуций" },
  "marketing.attribution.manage": { ru: "Управление маркетинговыми атрибуциями" },
  "whatsapp.read": { ru: "Просмотр WhatsApp-интеграции" },
  "whatsapp.send": { ru: "Отправка сообщений в WhatsApp" },
  "whatsapp.send.recover": { ru: "Повторная отправка сообщений в WhatsApp" },
  "whatsapp.manage": { ru: "Управление WhatsApp-интеграцией" },
  "whatsapp.session.admin": { ru: "Администрирование сессии WhatsApp" },
};

export const PERMISSION_GROUP_LABELS: Record<string, PermissionLabel> = {
  account: { ru: "Личный кабинет" },
  analytics: { ru: "Аналитика" },
  audit: { ru: "Аудит" },
  booking: { ru: "Бронирования" },
  catalog: { ru: "Каталог" },
  communication: { ru: "Коммуникации" },
  crm: { ru: "Клиенты и партнёры" },
  dashboard: { ru: "Рабочий стол" },
  documents: { ru: "Документы" },
  finance: { ru: "Финансы" },
  geography: { ru: "География" },
  hotel_directory: { ru: "Гостиничный справочник" },
  marketing: { ru: "Маркетинг" },
  moderation: { ru: "Модерация" },
  "operational-notes": { ru: "Рабочие заметки" },
  order: { ru: "Заказы" },
  partner: { ru: "Партнёры" },
  pricing: { ru: "Цены и наценки" },
  reports: { ru: "Отчёты" },
  reverse: { ru: "Заявки и предложения" },
  sales: { ru: "Продажи" },
  seller_public_profile: { ru: "Публичные профили продавцов" },
  settings: { ru: "Настройки" },
  storefront: { ru: "Витрины партнёров" },
  supplier: { ru: "Поставщики" },
  support: { ru: "Поддержка" },
  whatsapp: { ru: "WhatsApp" },
};

const warnedMissing = new Set<string>();

function humanize(code: string): string {
  const words = code.replace(/[._-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Дополнительное право доступа";
}

/** Display name; missing translation is logged and never returns the raw code. */
export function permissionLabel(code: string, locale: PermissionLocale = "ru"): string {
  const label = PERMISSION_LABELS[code];
  if (!label) {
    if (!warnedMissing.has(code)) {
      warnedMissing.add(code);
      console.warn("[rbac] missing display name for permission", code);
    }
    return humanize(code);
  }
  return label[locale] ?? label.ru;
}

export function permissionGroupLabel(group: string, locale: PermissionLocale = "ru"): string {
  const label = PERMISSION_GROUP_LABELS[group];
  return label ? label[locale] ?? label.ru : humanize(group);
}

export function permissionGroupOf(code: string): string {
  return code.split(".")[0] || "other";
}

/**
 * Localize backend permission errors for display. Backend keeps returning the
 * canonical codes for API clients; the UI must not leak them to end users.
 */
export function humanizePermissionMessage(message: string): string {
  const match = message.match(/^(Missing|Unknown) permission\(s\):\s*(.+)$/i);
  if (!match) return message;
  const [, kind, codesRaw] = match;
  const codes = codesRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const names = codes.map((code) => permissionLabel(code));
  return kind.toLowerCase() === "missing"
    ? `Недостаточно прав: ${names.join(", ")}`
    : `Неизвестные права: ${names.join(", ")}`;
}
