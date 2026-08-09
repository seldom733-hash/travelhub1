import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { uniqueConstraintNames } from "../../../shared/prisma-errors";
import { ValidationDomainError } from "../../../shared/errors";
import { PublicCatalogService } from "../public/public-catalog.service";
import { SOCIAL_PLATFORMS } from "../storefront/storefront.service";
import { STOREFRONT_EVENT_FORBIDDEN_KEYS } from "./storefront-behavioral.contracts";
import {
  requiresProduct,
  validateEventLocale,
  validateEventPayload,
  validateEventPath,
  validateEventType,
  validateOccurredAt,
  validateSessionId,
} from "./storefront-behavioral.validation";

/**
 * PHASE 1 STEP 1.12.3 — ingestion behavioral events публичной Storefront.
 *
 * Trust boundary (ADR-0008):
 *  - storefrontId/productId — резолвятся СЕРВЕРОМ из slug'ов через authoritative
 *    predicates PublicCatalogService (ACTIVE+entitled витрина; PUBLISHED+
 *    PARTNER_STOREFRONT+partnerId Product). Никакого клиентского partnerId.
 *  - acquisitionSource — server-authoritative PARTNER_STOREFRONT (endpoint
 *    storefront-scoped); клиент не может forged.
 *  - eventId — client UUID, dedup через unique constraint.
 *  - occurredAt — client UTC в пределах clock-skew окна; receivedAt — server.
 *  - payload — строгий per-eventType whitelist; contact values запрещены.
 *
 * Семантика ответа:
 *  - синтаксически невалидные события → 422 (клиент чинит баг);
 *  - семантически непубличные ресурсы (DRAFT/INACTIVE/NONE/SUSPENDED/EXPIRED
 *    витрина, непубличный/чужой/неканальный Product, неизвестный slug) →
 *    NEUTRAL 202 + silent drop (не раскрываем скрытое состояние);
 *  - duplicate eventId → 202 (dedup, метрики не удваиваются);
 *  - сбой persistence → 500 (observable), фронтенд не блокирует навигацию.
 *
 * AuditLog НЕ пишется (behavioral event ≠ AuditLog; §11). Page views/clicks в
 * AuditLog не попадают никогда.
 */
@Injectable()
export class StorefrontBehavioralService {
  private readonly logger = new Logger(StorefrontBehavioralService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publicCatalog: PublicCatalogService,
  ) {}

  /**
   * Обработка одного behavioral event. Возвращает { accepted: true } в любом
   * «нормальном» исходе (persisted / neutral drop / dedup).
   */
  async ingest(
    slug: string,
    input: {
      eventId: string;
      eventType: string;
      occurredAt: string;
      sessionId: string;
      locale: string;
      path: string;
      productSlug?: string;
      payload?: Record<string, unknown>;
    },
  ): Promise<{ accepted: boolean }> {
    // ── Semantic validation (поверх DTO) ───────────────────────────────────
    const eventType = validateEventType(input.eventType);
    const sessionId = validateSessionId(input.sessionId);
    const now = new Date();
    const occurredAt = validateOccurredAt(input.occurredAt, now);
    const locale = validateEventLocale(input.locale);
    const path = validateEventPath(input.path, slug);
    const payload = validateEventPayload(eventType, input.payload, SOCIAL_PLATFORMS);

    if (requiresProduct(eventType) && !input.productSlug) {
      throw new ValidationDomainError(`eventType ${eventType} requires productSlug`);
    }

    // ── Authoritative resolution (neutral drop для непубличного) ───────────
    const storefront = await this.publicCatalog.resolvePublicStorefrontForEvents(slug);
    if (!storefront) {
      this.logger.debug(`[behavioral] neutral drop: storefront "${slug}" not public (event ${input.eventId})`);
      return { accepted: true };
    }
    let productId: string | null = null;
    if (requiresProduct(eventType)) {
      const resolved = await this.publicCatalog.resolvePublicStorefrontProductForEvents(
        slug,
        storefront.partnerId,
        input.productSlug!,
      );
      if (!resolved) {
        this.logger.debug(`[behavioral] neutral drop: product "${input.productSlug}" not public in storefront "${slug}"`);
        return { accepted: true };
      }
      productId = resolved;
    }

    // ── Persist + dedup ────────────────────────────────────────────────────
    try {
      await this.prisma.storefrontBehavioralEvent.create({
        data: {
          eventId: input.eventId,
          eventType,
          occurredAt,
          storefrontId: storefront.id,
          productId,
          sessionId,
          // Server-authoritative: Storefront events возникают в Storefront-контексте.
          acquisitionSource: "PARTNER_STOREFRONT",
          locale,
          path,
          payload: payload ? (payload as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });
      return { accepted: true };
    } catch (err) {
      const names = uniqueConstraintNames(err);
      if (names.some((n) => n.toLowerCase().includes("eventid"))) {
        // Повторная доставка того же eventId — dedup, метрики не удваиваются.
        this.logger.debug(`[behavioral] dedup: eventId ${input.eventId} already processed`);
        return { accepted: true };
      }
      this.logger.warn(`[behavioral] persistence failure for eventId ${input.eventId}: ${(err as Error).message}`);
      throw err;
    }
  }

  /** Список запрещённых forged-ключей (для контроллера/сырого body-check). */
  forbiddenKeys(): readonly string[] {
    return STOREFRONT_EVENT_FORBIDDEN_KEYS;
  }
}
