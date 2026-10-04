import { Module } from "@nestjs/common";
import { loadWhatsAppConfig, type WhatsAppConfig } from "./whatsapp.config";
import { WHATSAPP_CONFIG, WHATSAPP_PROVIDER } from "./whatsapp.tokens";
import { IdsService } from "../../shared/ids.service";
import { WhatsAppSessionLeaseService } from "./lease/session-lease.service";
import { WhatsAppSessionOwnershipService } from "./ownership/session-ownership.service";
import { WhatsAppOutboundService } from "./outbound/outbound.service";
import { WhatsAppInboundService } from "./inbound/inbound.service";
import { WhatsAppConversationsService } from "./conversations/conversations.service";
import { WhatsAppSessionRuntimeService } from "./session/session-runtime.service";
import { WhatsAppController } from "./whatsapp.controller";
import { WhatsAppConversationsController } from "./whatsapp-conversations.controller";
import { MockWhatsAppProvider } from "./provider/mock/mock-whatsapp.provider";
import { BaileysWhatsAppProvider } from "./provider/baileys/baileys-provider";
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
 * Lease/fencing: WhatsAppSessionLeaseService (CAS, singleton-строка) +
 * WhatsAppSessionOwnershipService (heartbeat, self-fencing); все lifecycle/
 * auth/outbound-операции проходят assertActive/ensureOwnership.
 */
@Module({
  controllers: [WhatsAppController, WhatsAppConversationsController],
  providers: [
    {
      provide: WHATSAPP_CONFIG,
      useFactory: (): WhatsAppConfig => loadWhatsAppConfig(),
    },
    IdsService,
    WhatsAppSessionLeaseService,
    WhatsAppSessionOwnershipService,
    {
      provide: WHATSAPP_PROVIDER,
      useFactory: (
        config: WhatsAppConfig,
        lease: WhatsAppSessionLeaseService,
        ownership: WhatsAppSessionOwnershipService,
      ): WhatsAppProvider | null => {
        if (!config.enabled) return null;
        const getFencingToken = (): number => ownership.current?.fencingToken ?? 0;
        if (config.provider === "mock") {
          return new MockWhatsAppProvider({ instanceId: lease.instanceId, startFlow: "connected" });
        }
        return new BaileysWhatsAppProvider({
          config,
          instanceId: lease.instanceId,
          getFencingToken,
        });
      },
      inject: [WHATSAPP_CONFIG, WhatsAppSessionLeaseService, WhatsAppSessionOwnershipService],
    },
    WhatsAppSessionRuntimeService,
    WhatsAppOutboundService,
    WhatsAppInboundService,
    WhatsAppConversationsService,
  ],
  exports: [WHATSAPP_CONFIG, WHATSAPP_PROVIDER],
})
export class WhatsAppModule {}
