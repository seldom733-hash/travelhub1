import { Module } from "@nestjs/common";
import { loadWhatsAppConfig, type WhatsAppConfig } from "./whatsapp.config";
import { WHATSAPP_CONFIG, WHATSAPP_PROVIDER } from "./whatsapp.tokens";
import { IdsService } from "../../shared/ids.service";
import { CrmModule } from "../../modules/crm/crm.module";
import { WhatsAppSessionLeaseService } from "./lease/session-lease.service";
import { WhatsAppOutboundService } from "./outbound/outbound.service";
import { WhatsAppInboundService } from "./inbound/inbound.service";
import { WhatsAppConversationsService } from "./conversations/conversations.service";
import { WhatsAppSessionRuntimeService } from "./session/session-runtime.service";
import { WhatsAppSessionRegistryService } from "./session/session-registry.service";
import { WhatsAppController } from "./whatsapp.controller";
import { WhatsAppSessionsController } from "./whatsapp-sessions.controller";
import { WhatsAppConversationsController } from "./whatsapp-conversations.controller";
import type { WhatsAppProvider } from "./provider/whatsapp-provider";

export { WHATSAPP_CONFIG, WHATSAPP_PROVIDER } from "./whatsapp.tokens";

/**
 * WhatsAppModule — M2 «Реальный провайдер / Session foundation»
 * (мастер-промпт v2.3 §6, milestone M2).
 *
 * Fail-closed конфигурации (§6.3): фабрика WHATSAPP_CONFIG бросает
 * WhatsAppConfigError при WHATSAPP_ENABLED=true с невалидной конфигурацией.
 *
 * Kill-switch: WHATSAPP_ENABLED=false (дефолт) → WHATSAPP_PROVIDER = null,
 * ни один lifecycle/outbound-вызов не выполняется (503), соединения не
 * открываются, поведение остального приложения не меняется.
 *
 * Провайдер выбирается по WHATSAPP_PROVIDER:
 *  - "baileys" (дефолт) — реальный BaileysWhatsAppProvider
 *    (@whiskeysockets/baileys@6.7.24, импорт только в provider/baileys/);
 *  - "mock" — MockWhatsAppProvider (контрактные тесты/e2e/демо).
 *
 * Lease/fencing: WhatsAppSessionLeaseService (CAS, per-account ключ) +
 * per-account WhatsAppSessionOwnershipService (heartbeat, self-fencing),
 * экземпляры которых создаёт реестр сессий; все lifecycle/auth/outbound-
 * операции проходят assertActive/ensureOwnership.
 */
@Module({
  // M4.4: CrmModule — CRM-owned создание Customer в onboarding (WhatsApp не
  // пишет в crm.* напрямую). ActivationService — из @Global SecurityModule.
  imports: [CrmModule],
  controllers: [WhatsAppController, WhatsAppSessionsController, WhatsAppConversationsController],
  providers: [
    {
      provide: WHATSAPP_CONFIG,
      useFactory: (): WhatsAppConfig => loadWhatsAppConfig(),
    },
    IdsService,
    WhatsAppSessionLeaseService,
    // M5: реестр сессий — per-account провайдеры/ownership/lease; владелец
    // lifecycle-контекстов. WHATSAPP_PROVIDER ниже — стабильный legacy-прокси.
    WhatsAppSessionRegistryService,
    {
      // M5: legacy-прокси на primary-номер (e2e/контрактные тесты M1-M4);
      // подписки событий живут на hub'ах реестра и переживают смену контекста.
      provide: WHATSAPP_PROVIDER,
      useFactory: (registry: WhatsAppSessionRegistryService): WhatsAppProvider | null =>
        registry.provideLegacyProvider(),
      inject: [WhatsAppSessionRegistryService],
    },
    WhatsAppSessionRuntimeService,
    WhatsAppOutboundService,
    WhatsAppInboundService,
    WhatsAppConversationsService,
  ],
  exports: [WHATSAPP_CONFIG, WHATSAPP_PROVIDER],
})
export class WhatsAppModule {}
