import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SecurityService } from "../../security/security.service";
import { ForbiddenError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import type { AuthUser } from "../../security/auth/auth.service";
import { RoleCode } from "../../generated/prisma/enums";
import { isRequestEligible } from "./matching.validation";
import type { CapabilityDestination } from "./capabilities.validation";
import type { Prisma } from "../../generated/prisma/client";

/**
 * PHASE 2 STEP 2.2C — Matching & Distribution (reverse.*, ADR-0012).
 *
 * Server-authoritative matching:
 *  - только системная команда (reverse.match.run, ADMIN) создаёт distribution;
 *    Seller НЕ может self-match; Buyer НЕ мутирует;
 *  - eligibility evaluated на момент run: request SUBMITTED + category match +
 *    destination coverage (strict containment) + capability ACTIVE +
 *    acceptsBuyerRequests + Seller ACTIVE; capability ≠ entitlement
 *    (канонический entitlement authority для reverse marketplace отсутствует —
 *    StorefrontEntitlementStatus — отдельный commercial контекст paid SaaS);
 *  - MATCHED/DISTRIBUTED ≠ CONTACT DISCLOSED: никаких контактов/PII, без
 *    preferences в Seller projection (не DLP-safe store, §18 prompt);
 *  - matching НЕ создаёт Lead/Opportunity/Quote/Sale/Order/Booking;
 *  - idempotent: unique (buyerRequestId, sellerId) + skipDuplicates + retry-safe;
 *  - cancel-vs-matching serialized FOR UPDATE на request row: после commit
 *    cancel'а новые distribution невозможны; existing durable rows не
 *    удаляются; Seller projection показывает актуальный request.status;
 *  - события НЕ эмитятся: consumer отсутствует (2.2D читает distributions
 *    напрямую); explicit command = наблюдаемый, retry-safe trigger (§15/§16).
 */
@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
  ) {}

  // ── Seller gate (inbox) ───────────────────────────────────────────────

  /** Gate: PARTNER + partnerId (approved onboarding) + CRM Partner ACTIVE. */
  private async assertSellerEligible(actor: AuthUser): Promise<string> {
    if (actor.role !== RoleCode.PARTNER) {
      throw new ForbiddenError("Only PARTNER can read own distributed Buyer Requests (seller-own contract)");
    }
    if (!actor.partnerId) {
      throw new ForbiddenError("Partner onboarding is not approved: distribution inbox is not available");
    }
    const partner = await this.prisma.partner.findUnique({
      where: { id: actor.partnerId },
      select: { status: true },
    });
    if (!partner || partner.status !== "ACTIVE") {
      throw new ForbiddenError("CRM partner is not ACTIVE; distribution inbox denied");
    }
    return actor.partnerId;
  }

  /** Seller-safe projection: только demand-факты, БЕЗ PII/preferences/buyerId. */
  private toSellerView(row: {
    id: string;
    buyerRequestId: string;
    distributedAt: Date;
    buyerRequest: {
      code: string;
      categoryId: string;
      categorySlug: string;
      destinations: unknown;
      serviceDateFrom: Date | null;
      serviceDateTo: Date | null;
      adults: number;
      children: number;
      infants: number;
      budget: unknown;
      status: string;
    };
  }) {
    return {
      id: row.id,
      buyerRequestId: row.buyerRequestId,
      distributedAt: row.distributedAt,
      request: {
        code: row.buyerRequest.code,
        categoryId: row.buyerRequest.categoryId,
        categorySlug: row.buyerRequest.categorySlug,
        destinations: row.buyerRequest.destinations as CapabilityDestination[],
        serviceDateFrom: row.buyerRequest.serviceDateFrom,
        serviceDateTo: row.buyerRequest.serviceDateTo,
        adults: row.buyerRequest.adults,
        children: row.buyerRequest.children,
        infants: row.buyerRequest.infants,
        budget: row.buyerRequest.budget as { currency: string; min?: number; max?: number } | null,
        // Актуальный статус: CANCELLED → Seller projection честно показывает,
        // что request больше не открыт (§11).
        status: row.buyerRequest.status,
      },
    };
  }

  // ── Seller inbox ──────────────────────────────────────────────────────

  async listOwnDistributions(actor: AuthUser, limit: number, offset: number) {
    const sellerId = await this.assertSellerEligible(actor);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.buyerRequestDistribution.findMany({
        where: { sellerId },
        orderBy: [{ distributedAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
        include: {
          buyerRequest: {
            select: {
              code: true,
              categoryId: true,
              categorySlug: true,
              destinations: true,
              serviceDateFrom: true,
              serviceDateTo: true,
              adults: true,
              children: true,
              infants: true,
              budget: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.buyerRequestDistribution.count({ where: { sellerId } }),
    ]);
    return { items: items.map((r) => this.toSellerView(r)), total };
  }

  async getOwnDistribution(actor: AuthUser, id: string) {
    const sellerId = await this.assertSellerEligible(actor);
    const row = await this.prisma.buyerRequestDistribution.findFirst({
      where: { id, sellerId },
      include: {
        buyerRequest: {
          select: {
            code: true,
            categoryId: true,
            categorySlug: true,
            destinations: true,
            serviceDateFrom: true,
            serviceDateTo: true,
            adults: true,
            children: true,
            infants: true,
            budget: true,
            status: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundError("Distribution not found");
    return this.toSellerView(row);
  }

  // ── System matching command ───────────────────────────────────────────

  /**
   * Run server-authoritative matching for one SUBMITTED BuyerRequest.
   * Возвращает детерминированный summary. Idempotent: повторный run не
   * создаёт дубликатов (unique + skipDuplicates). Batch = одна транзакция.
   */
  async runMatching(actor: AuthUser, buyerRequestId: string) {
    const request = await this.prisma.buyerRequest.findUnique({ where: { id: buyerRequestId } });
    if (!request) {
      throw new NotFoundError("Buyer request not found");
    }
    if (request.status !== "SUBMITTED") {
      throw new ValidationDomainError(`only SUBMITTED Buyer Requests are distributable (current: ${request.status})`);
    }
    const category = await this.prisma.category.findUnique({
      where: { id: request.categoryId },
      select: { slug: true, status: true },
    });
    if (!category || category.status !== "ACTIVE") {
      throw new ValidationDomainError("request category is not ACTIVE; distribution impossible");
    }

    const capabilities = await this.prisma.sellerCapability.findMany({
      where: { categoryId: request.categoryId, status: "ACTIVE", acceptsBuyerRequests: true },
      select: { id: true, sellerId: true, categoryId: true, destinations: true, status: true, acceptsBuyerRequests: true },
    });
    const sellerIds = [...new Set(capabilities.map((c) => c.sellerId))];
    const activeSellers = new Set<string>();
    if (sellerIds.length > 0) {
      const partners = await this.prisma.partner.findMany({
        where: { id: { in: sellerIds }, status: "ACTIVE" },
        select: { id: true },
      });
      partners.forEach((p) => activeSellers.add(p.id));
    }

    const requestDests = request.destinations as CapabilityDestination[];
    const eligible = capabilities.filter(
      (c) =>
        activeSellers.has(c.sellerId) &&
        isRequestEligible({
          request: { status: request.status, categoryId: request.categoryId, destinations: requestDests },
          capability: {
            status: c.status,
            categoryId: c.categoryId,
            destinations: c.destinations as CapabilityDestination[],
            acceptsBuyerRequests: c.acceptsBuyerRequests,
          },
          sellerStatus: activeSellers.has(c.sellerId) ? "ACTIVE" : "INACTIVE",
        }).eligible,
    );

    const row = await this.prisma.$transaction(async (tx) => {
      // Serialize cancel-vs-matching: row lock на request. Если cancel
      // закоммичен — статус CANCELLED → abort; если matching первый —
      // distribution durable, cancel продолжит (история не удаляется).
      const locked = (await tx.$queryRawUnsafe<Array<{ status: string }>>(
        `SELECT status FROM reverse."BuyerRequest" WHERE id = $1 FOR UPDATE`,
        buyerRequestId,
      ))[0];
      if (!locked || locked.status !== "SUBMITTED") {
        throw new ValidationDomainError(
          `Buyer request is no longer SUBMITTED (${locked?.status ?? "missing"}); no distributions committed`,
        );
      }
      // Fresh re-read capabilities внутри tx (READ COMMITTED: statement-level
      // snapshot) — deactivated/disabled до этого момента не попадут.
      const freshCaps = await tx.sellerCapability.findMany({
        where: { id: { in: eligible.map((c) => c.id) } },
        select: { id: true, status: true, acceptsBuyerRequests: true },
      });
      const stillEligibleIds = new Set(
        freshCaps.filter((c) => c.status === "ACTIVE" && c.acceptsBuyerRequests === true).map((c) => c.id),
      );
      const finalRows = eligible.filter((c) => stillEligibleIds.has(c.id));

      // Детерминированный результат: matched = eligible seller set (стабилен
      // между retry при том же state); created = только вновь персистенные.
      const matched = finalRows.length;
      const created = finalRows.length > 0
        ? (await tx.buyerRequestDistribution.createMany({
            data: finalRows.map((c) => ({ buyerRequestId, sellerId: c.sellerId })),
            skipDuplicates: true,
          })).count
        : 0;
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "reverse.match.run",
        resource: "BuyerRequest",
        resourceId: buyerRequestId,
        details: {
          requestCode: request.code,
          categorySlug: category.slug,
          candidates: capabilities.length,
          matched,
          created,
          sellerIds: finalRows.map((c) => c.sellerId),
        },
      });
      return { matched, created, sellerIds: finalRows.map((c) => c.sellerId) };
    });

    this.logger.log(
      `Matching run for ${request.code}: ${capabilities.length} candidates → ${row.matched} eligible (${row.created} new, ${row.sellerIds.length} sellers)`,
    );
    return {
      buyerRequestId,
      requestCode: request.code,
      categorySlug: category.slug,
      candidates: capabilities.length,
      matched: row.matched,
      created: row.created,
      sellerIds: row.sellerIds,
      distributedAt: new Date().toISOString(),
    };
  }
}
