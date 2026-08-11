import { Module } from "@nestjs/common";
import { CommunicationController } from "./communication.controller";
import { CommunicationService } from "./communication.service";
import { ReverseConversationController } from "./reverse-conversation.controller";
import { ReverseConversationService } from "./reverse-conversation.service";

/**
 * PHASE 1 STEP 1.16 — Communication foundation (новый bounded context,
 * communication.*, ADR-0011). Read-only cross-domain reads по ID (ADR-0001)
 * выполняются через глобальный PrismaService; SecurityService — аудит.
 *
 * PHASE 2 STEP 2.2E — pre-sale conversations (CommunicationThread): тот же
 * bounded context, Reverse Marketplace используется ТОЛЬКО как trusted
 * context refs (никакого второго chat/message домена).
 */
@Module({
  controllers: [CommunicationController, ReverseConversationController],
  providers: [CommunicationService, ReverseConversationService],
})
export class CommunicationModule {}
