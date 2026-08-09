import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { uniqueConstraintNames } from "../../../shared/prisma-errors";
import { ValidationDomainError } from "../../../shared/errors";
import { PublicCatalogService } from "../public/public-catalog.service";
import {
  MARKETPLACE_EVENT_FORBIDDEN_KEYS,
  type MarketplaceBehavioralEventType,
} from "./marketplace-behavioral.contracts";
import {
  normalizeSearchQuery,
  requiresMarketplaceCategory,
  requiresMarketplaceProduct,
  validateMarketplaceEventType,
  validateMarketplacePath,
  validateMarketplacePayload,
} from "./marketplace-behavioral.validation";
import { validateEventLocale, validateOccurredAt, validateSessionId } from "./storefront-behavioral.validation";

/**
 * PHASE 1 STEP 1.13B — ingestion behavioral events публичного Marketplace.
 *
 * Trust boundary (расширение ADR-0008 на Marketplace scope):
 *  - productId/categoryId — резолвятся СЕРВЕРОМ из slug'ов через authoritative
 *    predicates PublicCatalogService (PUBLISHED + publishedAt + MARKETPLACE
 *    channel; ACTIVE категория). Никакого клиентского identity.
 *  - acquisitionSource — server-authoritative MARKETPLACE (endpoint
 *    marketplace-scoped); клиент не может forged.
 *  - eventId — client UUID, dedup через unique constraint.
 *  - occurredAt — client UTC в пределах clock-skew окна; receivedAt — server.
 *  - payload — строгий per-eventType whitelist; search query — нормализованная
 *    и усечённая с privacy guard; contact values запрещены.
 *
 * Семантика ответа (та же, что у Storefront):
 *  - синтаксически невалидные события → 422;
 *  - семантически непубличные ресурсы (DRAFT/ARCHIVED/non-MARKETPLACE Product,
 *    несуществующая/неактивная категория, неизвестный slug) → NEUTRAL 202 +
 *    silent drop (не раскрываем скрытое состояние);
 *  - duplicate eventId → 202 (dedup);
 *  - сбой persistence → 500 (observable).
 *
 * AuditLog НЕ пишется; Outbox НЕ используется (behavioral ≠ business events).
 */
@Injectable()
export class MarketplaceBehavioralService {
  private readonly logger = new Logger(MarketplaceBehavioralService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publicCatalog: PublicCatalogService,
  ) {}

  async ingest(input: {
    eventId: string;
    eventType: string;
    occurredAt: string;
    sessionId: string;
    locale: string;
    path: string;
    productSlug?: string;
    categorySlug?: string;
    payload?: Record<string, unknown>;
  }): Promise<{ accepted: boolean }> {
    // ── Semantic validation (поверх DTO) ───────────────────────────────────
    const eventType = validateMarketplaceEventType(input.eventType) as MarketplaceBehavioralEventType;
    const sessionId = validateSessionId(input.sessionId);
    const now = new Date();
    const occurredAt = validateOccurredAt(input.occurredAt, now);
    const locale = validateEventLocale(input.locale);
    const path = validateMarketplacePath(input.path);
    const payload = validateMarketplacePayload(eventType, input.payload);

    if (requiresMarketplaceProduct(eventType) && !input.productSlug) {
      throw new ValidationDomainError(`eventType ${eventType} requires productSlug`);
    }
    if (requiresMarketplaceCategory(eventType) && !input.categorySlug) {
      throw new ValidationDomainError(`eventType ${eventType} requires categorySlug`);
    }

    // ── Authoritative resolution (neutral drop для непубличного) ───────────
    let productId: string | null = null;
    if (requiresMarketplaceProduct(eventType)) {
      const resolved = await this.publicCatalog.resolvePublicMarketplaceProductForEvents(input.productSlug!);
      if (!resolved) {
        this.logger.debug(`[behavioral] neutral drop: marketplace product "${input.productSlug}" not public (event ${input.eventId})`);
        return { accepted: true };
      }
      productId = resolved;
    }

    let categoryId: string | null = null;
    if (requiresMarketplaceCategory(eventType)) {
      const resolved = await this.publicCatalog.resolvePublicMarketplaceCategoryForEvents(input.categorySlug!);
      if (!resolved) {
        this.logger.debug(`[behavioral] neutral drop: marketplace category "${input.categorySlug}" not public (event ${input.eventId})`);
        return { accepted: true };
      }
      categoryId = resolved;
    }

    // ── Persist + dedup ────────────────────────────────────────────────────
    try {
      await this.prisma.marketplaceBehavioralEvent.create({
        data: {
          eventId: input.eventId,
          eventType,
          occurredAt,
          productId,
          categoryId,
          sessionId,
          // Server-authoritative: Marketplace events возникают в Marketplace-контексте.
          acquisitionSource: "MARKETPLACE",
          locale,
          path,
          payload: payload ? (payload as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });
      return { accepted: true };
    } catch (err) {
      const names = uniqueConstraintNames(err);
      if (names.some((n) => n.toLowerCase().includes("eventid"))) {
        this.logger.debug(`[behavioral] dedup: eventId ${input.eventId} already processed`);
        return { accepted: true };
      }
      this.logger.warn(`[behavioral] persistence failure for eventId ${input.eventId}: ${(err as Error).message}`);
      throw err;
    }
  }

  /** Список запрещённых forged-ключей (для контроллера/сырого body-check). */
  forbiddenKeys(): readonly string[] {
    return MARKETPLACE_EVENT_FORBIDDEN_KEYS;
  }

  /** Экспорт privacy-normalizer для контроллера (search guard). */
  normalizeSearch(raw: unknown): string | null {
    return normalizeSearchQuery(raw);
  }
}
