/**
 * Injection tokens WhatsApp-слоя (M2): вынесены в отдельный модуль без
 * зависимостей, чтобы сервисы не создавали циклических импортов с
 * whatsapp.module.ts.
 */

/** Injection token для валидированной WhatsApp-конфигурации. */
export const WHATSAPP_CONFIG = "WHATSAPP_CONFIG";

/**
 * Injection token транспортного провайдера.
 * Значение — WhatsAppProvider, либо null, когда WHATSAPP_ENABLED=false
 * (kill-switch: модуль не инициализирует транспорт).
 */
export const WHATSAPP_PROVIDER = "WHATSAPP_PROVIDER";
