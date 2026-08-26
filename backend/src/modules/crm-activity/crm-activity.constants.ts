import { CrmActivityActivityType, CrmActivitySourceType } from '../../generated/prisma/enums';

/** Display titles for each activity type (will be i18n keys in frontend) */
export const ACTIVITY_TYPE_TITLES: Record<CrmActivityActivityType, string> = {
  [CrmActivityActivityType.NOTE_CREATED]: 'Примечание добавлено',
  [CrmActivityActivityType.ORDER_CREATED]: 'Заказ создан',
  [CrmActivityActivityType.ORDER_STATUS_CHANGED]: 'Статус заказа изменён',
  [CrmActivityActivityType.ORDER_CANCELLED]: 'Заказ отменён',
  [CrmActivityActivityType.BOOKING_CREATED]: 'Бронирование создано',
  [CrmActivityActivityType.BOOKING_STATUS_CHANGED]: 'Статус бронирования изменён',
  [CrmActivityActivityType.BOOKING_COMPLETED]: 'Бронирование завершено',
  [CrmActivityActivityType.PAYMENT_CREATED]: 'Платёж создан',
  [CrmActivityActivityType.PAYMENT_CAPTURED]: 'Платёж зачислен',
  [CrmActivityActivityType.REFUND_CREATED]: 'Возврат создан',
  [CrmActivityActivityType.REFUND_PROCESSED]: 'Возврат обработан',
  [CrmActivityActivityType.MESSAGE_SENT]: 'Сообщение отправлено',
  [CrmActivityActivityType.AUDIT_CUSTOMER_CREATED]: 'Клиент создан',
  [CrmActivityActivityType.AUDIT_CUSTOMER_STATUS_CHANGED]: 'Статус клиента изменён',
  [CrmActivityActivityType.AUDIT_PARTNER_APPROVED]: 'Партнёр одобрен',
  [CrmActivityActivityType.CUSTOMER_HISTORY_CREATED]: 'Клиент создан',
  [CrmActivityActivityType.CUSTOMER_HISTORY_STATUS_CHANGED]: 'Статус клиента изменён',
  [CrmActivityActivityType.CUSTOMER_HISTORY_UPDATED]: 'Данные клиента обновлены',
  [CrmActivityActivityType.BUYER_REQUEST_CREATED]: 'Запрос создан',
  [CrmActivityActivityType.BUYER_REQUEST_SUBMITTED]: 'Запрос отправлен',
  [CrmActivityActivityType.BUYER_REQUEST_CANCELLED]: 'Запрос отменён',
  [CrmActivityActivityType.PARTNER_APPLICATION_SUBMITTED]: 'Заявка партнёра отправлена',
  [CrmActivityActivityType.PARTNER_APPLICATION_APPROVED]: 'Заявка партнёра одобрена',
  [CrmActivityActivityType.PARTNER_APPLICATION_REJECTED]: 'Заявка партнёра отклонена',
};

/** Map source type to the permission required to read its activity items */
export const SOURCE_READ_PERMISSIONS: Record<CrmActivitySourceType, string> = {
  [CrmActivitySourceType.OPERATIONAL_NOTE]: 'operational-notes.read',
  [CrmActivitySourceType.ORDER]: 'order.read',
  [CrmActivitySourceType.BOOKING]: 'booking.read',
  [CrmActivitySourceType.PAYMENT]: 'finance.payment.read',
  [CrmActivitySourceType.REFUND]: 'finance.refund.read',
  [CrmActivitySourceType.MESSAGE]: 'communication.read',
  [CrmActivitySourceType.AUDIT_EVENT]: 'audit.read',
  [CrmActivitySourceType.CUSTOMER_HISTORY]: 'crm.customer.read',
  [CrmActivitySourceType.BUYER_REQUEST]: 'reverse.request.read_own',
  [CrmActivitySourceType.PARTNER_APPLICATION]: 'partner.onboarding.read_own',
};

/** Visibility for activity items: timeline visibility must be <= source visibility */
export const ACTIVITY_DEFAULT_VISIBILITY = 'INTERNAL';

/** Safe summary truncation length */
export const SUMMARY_MAX_LENGTH = 100;

/** Backfill batch size */
export const BACKFILL_BATCH_SIZE = 500;

/** Backfill max retries per batch */
export const BACKFILL_MAX_RETRIES = 3;
