import { Module } from "@nestjs/common";
import { CommunicationController } from "./communication.controller";
import { CommunicationService } from "./communication.service";

/**
 * PHASE 1 STEP 1.16 — Communication foundation (новый bounded context,
 * communication.*, ADR-0011). Read-only cross-domain reads по ID (ADR-0001)
 * выполняются через глобальный PrismaService; SecurityService — аудит.
 */
@Module({
  controllers: [CommunicationController],
  providers: [CommunicationService],
})
export class CommunicationModule {}
