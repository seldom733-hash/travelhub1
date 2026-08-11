import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { uniqueConstraintNames } from "../../shared/prisma-errors";
import type { AuthUser } from "../../security/auth/auth.service";
import { RoleCode } from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";
import { normalizeProposalContent, normalizeProposalMoney, normalizeProposalValidUntil } from "./proposal.validation";

const toJson = (v: unknown): Prisma.InputJsonValue => v as unknown as Prisma.InputJsonValue;

/**
 * PHASE 2 STEP 2.2D — Seller Proposal Foundation (reverse.*, ADR-0012).
 *
 * Seller, получивший BuyerRequest через каноническую Step 2.2C distribution,
 * создаёт и управляет СВОИМ Seller Proposal. Proposal — pre-commercial
 * competitive ответ, НЕ canonical Sales Quote (никакого второго binding
 * Quote engine; amount — НЕ-binding индикация).
 *
 * Инварианты:
 *  - ownership ТОЛЬКО из actor.partnerId (seller) / actor.customerId (buyer);
 *  - создание ТРЕБУЕТ реальной BuyerRequestDistribution к этому Seller-у
 *    (клиент не может forged distribution/self-match/arbitrary request ID);
 *  - request gate: Proposal только для SUBMITTED request; CANCELLED — новые
 *    Proposal запрещены; существующие сохраняются (история durable);
 *    DRAFT правки заморожены; withdraw — только для SUBMITTED (решение
 *    Seller-а; канселированный request не блокирует withdraw);
 *  - один Proposal на (Seller, BuyerRequest) — unique constraint, retry-safe;
 *  - PROPOSAL EXISTS ≠ CONTACT DISCLOSED (контент без контактов/URL);
 *  - создание НЕ создаёт Lead/Opportunity/Quote/Sale/Order/Booking/Product;
 *  - CAS (version); history/audit; события НЕ эмитятся (consumer — 2.2E/2.2F
 *    читают напрямую; explicit command — наблюдаемый trigger);
 *  - BUYER_REQUEST acquisition source сохраняется (2.2F propagation).
 */
@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
  ) {}

  // ── Gates ─────────────────────────────────────────────────────────────

  /** Gate: PARTNER + partnerId (approved onboarding) + CRM Partner ACTIVE. */
  private async assertSellerEligible(actor: AuthUser): Promise<string> {
    if (actor.role !== RoleCode.PARTNER) {
      throw new ForbiddenError("Only PARTNER can manage Seller Proposals (seller-own contract)");
    }
    if (!actor.partnerId) {
      throw new ForbiddenError("Partner onboarding is not approved: Seller Proposals are not available");
    }
    const partner = await this.prisma.partner.findUnique({
      where: { id: actor.partnerId },
      select: { status: true },
    });
    if (!partner || partner.status !== "ACTIVE") {
      throw new ForbiddenError("CRM partner is not ACTIVE; Seller Proposals denied");
    }
    return actor.partnerId;
  }

  /** Gate: строго BUYER + customerId (own-request proposal read). */
  private async assertBuyerEligible(actor: AuthUser): Promise<string> {
    if (actor.role !== RoleCode.BUYER) {
      throw new ForbiddenError("Only BUYER can read Proposals of own Buyer Requests (buyer-own contract)");
    }
    if (!actor.customerId) {
      throw new ForbiddenError("Buyer is not mapped to a CRM customer; Proposal reads are not allowed");
    }
    return actor.customerId;
  }

  /** Own-scope lookup (seller): чужой id → neutral 404. */
  private async findOwn(id: string, sellerId: string) {
    const row = await this.prisma.sellerProposal.findFirst({ where: { id, sellerId } });
    if (!row) throw new NotFoundError("Seller proposal not found");
    return row;
  }

  /**
   * Резолвит каноническую distribution (buyerRequestId, sellerId) — единственный
   * легальный путь создания Proposal. Отсутствие → 422 (нейтральное сообщение:
   * не раскрывает существование чужого request, анти-enumeration).
   */
  private async resolveDistribution(buyerRequestId: string, sellerId: string) {
    const dist = await this.prisma.buyerRequestDistribution.findFirst({
      where: { buyerRequestId, sellerId },
      select: { id: true, buyerRequest: { select: { status: true, code: true } } },
    });
    if (!dist) {
      throw new ValidationDomainError(
        "This BuyerRequest was not distributed to your seller account; Proposal cannot be created",
      );
    }
    return dist;
  }

  // ── Projections ───────────────────────────────────────────────────────

  private toSellerView(row: {
    id: string;
    code: string;
    sellerId: string;
    buyerRequestId: string;
    distributionId: string;
    amount: Prisma.Decimal | null;
    currency: string | null;
    description: string | null;
    includedServices: string | null;
    exclusions: string | null;
    conditions: string | null;
    notes: string | null;
    validUntil: Date | null;
    status: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    submittedAt: Date | null;
    withdrawnAt: Date | null;
  }) {
    return {
      id: row.id,
      code: row.code,
      buyerRequestId: row.buyerRequestId,
      distributionId: row.distributionId,
      money: {
        amount: row.amount ? row.amount.toFixed(2) : null,
        currency: row.currency,
      },
      description: row.description,
      includedServices: row.includedServices,
      exclusions: row.exclusions,
      conditions: row.conditions,
      notes: row.notes,
      validUntil: row.validUntil,
      status: row.status,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      submittedAt: row.submittedAt,
      withdrawnAt: row.withdrawnAt,
    };
  }

  /**
   * Seller-safe identity (ADR-0005): из PublicSellerProfile (catalog.*, read-only
   * по ADR-0001), НИКОГДА raw crm.Partner. Профиль HIDDEN/отсутствует → null
   * (идентичность не показывается). ANONYMOUS → displayName=null (фронтенд
   * локализует generic label). Та же семантика, что PublicCatalogService
   * toPublicSeller — без дублирования cross-module dependency.
   */
  private toPublicSeller(p: {
    publicId: string;
    partnerId: string;
    status: string;
    visibilityMode: string;
    publicDisplayName: string | null;
    countryCode: string | null;
    cityCode: string | null;
    verified: boolean;
    memberSince: Date;
  }) {
    const mode = (["ANONYMOUS", "VERIFIED_ALIAS", "PUBLIC_BRAND"] as const).includes(
      p.visibilityMode as "ANONYMOUS" | "VERIFIED_ALIAS" | "PUBLIC_BRAND",
    )
      ? (p.visibilityMode as "ANONYMOUS" | "VERIFIED_ALIAS" | "PUBLIC_BRAND")
      : "ANONYMOUS";
    return {
      publicId: p.publicId,
      displayName: mode === "ANONYMOUS" ? null : (p.publicDisplayName ?? null),
      visibilityMode: mode,
      verified: p.verified,
      memberSince: p.memberSince.toISOString(),
      countryCode: p.countryCode,
      cityCode: p.cityCode,
    };
  }

  /** Batch seller identity по partnerId (только APPROVED; HIDDEN → null). */
  private async sellerIdentityMap(partnerIds: string[]): Promise<Map<string, ReturnType<ProposalsService["toPublicSeller"]>>> {
    const unique = [...new Set(partnerIds)];
    if (unique.length === 0) return new Map();
    const profiles = await this.prisma.publicSellerProfile.findMany({ where: { partnerId: { in: unique } } });
    const out = new Map<string, ReturnType<ProposalsService["toPublicSeller"]>>();
    for (const p of profiles) {
      if (p.status !== "APPROVED") continue; // HIDDEN — идентичность не показывается
      out.set(p.partnerId, this.toPublicSeller(p));
    }
    return out;
  }

  /**
   * Buyer-facing projection (Step 2.2D §19/§25, ADR-0005): только proposal-facts
   * + seller-safe Seller identity (publicId, НЕ внутренний partnerId), без
   * internal CRM/audit/ranking/notes.
   */
  private toBuyerView(
    row: {
      id: string;
      code: string;
      sellerId: string;
      buyerRequestId: string;
      amount: Prisma.Decimal | null;
      currency: string | null;
      description: string | null;
      includedServices: string | null;
      exclusions: string | null;
      conditions: string | null;
      validUntil: Date | null;
      status: string;
      submittedAt: Date | null;
    },
    seller: ReturnType<ProposalsService["toPublicSeller"]> | null,
  ) {
    return {
      id: row.id,
      code: row.code,
      buyerRequestId: row.buyerRequestId,
      seller,
      money: {
        amount: row.amount ? row.amount.toFixed(2) : null,
        currency: row.currency,
      },
      description: row.description,
      includedServices: row.includedServices,
      exclusions: row.exclusions,
      conditions: row.conditions,
      validUntil: row.validUntil,
      status: row.status,
      submittedAt: row.submittedAt,
    };
  }

  // ── Seller reads ──────────────────────────────────────────────────────

  async listOwn(actor: AuthUser, limit: number, offset: number) {
    const sellerId = await this.assertSellerEligible(actor);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.sellerProposal.findMany({
        where: { sellerId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
      }),
      this.prisma.sellerProposal.count({ where: { sellerId } }),
    ]);
    return { items: items.map((p) => this.toSellerView(p)), total };
  }

  async getOwn(actor: AuthUser, id: string) {
    const sellerId = await this.assertSellerEligible(actor);
    return this.toSellerView(await this.findOwn(id, sellerId));
  }

  async historyOwn(actor: AuthUser, id: string) {
    const sellerId = await this.assertSellerEligible(actor);
    await this.findOwn(id, sellerId); // own-scope gate (neutral 404)
    const rows = await this.prisma.sellerProposalHistory.findMany({
      where: { proposalId: id },
      orderBy: { createdAt: "desc" },
    });
    return { items: rows };
  }

  // ── Seller create ─────────────────────────────────────────────────────

  async createOwn(
    actor: AuthUser,
    input: {
      buyerRequestId: string;
      money?: unknown;
      description?: string;
      includedServices?: string;
      exclusions?: string;
      conditions?: string;
      notes?: string;
      validUntil?: string;
    },
  ) {
    const sellerId = await this.assertSellerEligible(actor);

    // Distribution gate: Proposal ТОЛЬКО на реально распределённый request.
    // (резолвится сервером по (buyerRequestId, sellerId); клиент не передаёт
    // distributionId/status/matched state).
    const dist = await this.resolveDistribution(input.buyerRequestId, sellerId);
    if (dist.buyerRequest.status !== "SUBMITTED") {
      throw new ValidationDomainError(
        `BuyerRequest is not open for Proposals (current: ${dist.buyerRequest.status}); only SUBMITTED requests accept Proposals`,
      );
    }

    const money = normalizeProposalMoney(input.money);
    const content = normalizeProposalContent({
      description: input.description,
      includedServices: input.includedServices,
      exclusions: input.exclusions,
      conditions: input.conditions,
      notes: input.notes,
    });
    const validUntil = normalizeProposalValidUntil(input.validUntil);

    const row = await this.prisma.$transaction(async (tx) => {
      // Serialize cancel-vs-create: row lock на request. Если cancel уже
      // закоммичен — статус CANCELLED → abort; если create первый — Proposal
      // durable, cancel продолжит (история не удаляется). READ COMMITTED ок:
      // FOR UPDATE даёт детерминированный порядок (та же техника, что 2.2C).
      const lockedReq = (await tx.$queryRawUnsafe<Array<{ status: string }>>(
        `SELECT status FROM reverse."BuyerRequest" WHERE id = $1 FOR UPDATE`,
        input.buyerRequestId,
      ))[0];
      if (!lockedReq || lockedReq.status !== "SUBMITTED") {
        throw new ValidationDomainError(
          `BuyerRequest is no longer open for Proposals (${lockedReq?.status ?? "missing"}); no Proposal committed`,
        );
      }
      const code = await this.ids.nextCode(tx, "PRP");
      let created;
      try {
        created = await tx.sellerProposal.create({
          data: {
            code,
            sellerId,
            buyerRequestId: input.buyerRequestId,
            distributionId: dist.id,
            amount: money.amount ? new Prisma.Decimal(money.amount) : null,
            currency: money.currency,
            description: content.description,
            includedServices: content.includedServices,
            exclusions: content.exclusions,
            conditions: content.conditions,
            notes: content.notes,
            validUntil,
            createdById: actor.id,
          },
        });
      } catch (err) {
        const names = uniqueConstraintNames(err);
        if (names.some((n) => n.toLowerCase().includes("buyerrequestid"))) {
          throw new ConflictError(
            "A proposal for this BuyerRequest already exists for this seller (one proposal per seller+request)",
          );
        }
        throw err;
      }
      await tx.sellerProposalHistory.create({
        data: {
          proposalId: created.id,
          action: "created",
          to: "DRAFT",
          actorId: actor.id,
          actorName: actor.username,
          fields: {
            buyerRequestId: input.buyerRequestId,
            money: toJson(money),
            description: content.description,
            includedServices: content.includedServices,
            exclusions: content.exclusions,
            conditions: content.conditions,
            notes: content.notes,
            validUntil: validUntil ? validUntil.toISOString() : null,
          },
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "proposal.created",
        resource: "SellerProposal",
        resourceId: created.id,
        details: { sellerId, buyerRequestId: input.buyerRequestId, distributionId: dist.id },
      });
      return created;
    });

    this.logger.log(`SellerProposal ${row.code} created for buyer request ${input.buyerRequestId} (DRAFT)`);
    return this.toSellerView(row);
  }

  // ── Seller update (DRAFT only) ────────────────────────────────────────

  async updateOwn(
    actor: AuthUser,
    id: string,
    input: {
      money?: unknown;
      description?: string;
      includedServices?: string;
      exclusions?: string;
      conditions?: string;
      notes?: string;
      validUntil?: string;
      expectedVersion: number;
    },
  ) {
    const sellerId = await this.assertSellerEligible(actor);
    const current = await this.findOwn(id, sellerId);
    if (current.status !== "DRAFT") {
      throw new ValidationDomainError("only DRAFT Proposals are editable (submitted/withdrawn are frozen)");
    }
    // Честный контракт (Step 2.2D §12): если request отменён после создания
    // Proposal — DRAFT правки запрещены (request закрыт для новых предложений),
    // но withdraw (SUBMITTED → WITHDRAWN) остаётся доступен (решение Seller-а).
    // Сериализация cancel-vs-update — внутри транзакции (FOR UPDATE на request),
    // чтобы исключить TOCTOU: см. updateOwn -> tx.

    // Частичный PATCH: undefined = не трогать; null/пустая строка = очистить
    // поле (честный partial-update, обратимый для всех контент-полей).
    const money = input.money === undefined ? undefined : normalizeProposalMoney(input.money);
    const validUntil = input.validUntil === undefined ? undefined : normalizeProposalValidUntil(input.validUntil);

    // Для контент-полей отдельно валидируем каждое ПЕРЕДАННОЕ поле (не все сразу,
    // иначе отсутствующие поля трактовались бы как «очистить»).
    const content = normalizeProposalContent({
      description: input.description,
      includedServices: input.includedServices,
      exclusions: input.exclusions,
      conditions: input.conditions,
      notes: input.notes,
    });
    const contentKeys = ["description", "includedServices", "exclusions", "conditions", "notes"] as const;
    const contentProvided = contentKeys.filter((k) => (input as Record<string, unknown>)[k] !== undefined);

    const data: Prisma.SellerProposalUpdateManyMutationInput = {
      version: { increment: 1 },
    };
    const changed: Record<string, unknown> = {};
    if (money !== undefined) {
      data.amount = money.amount ? new Prisma.Decimal(money.amount) : null;
      data.currency = money.currency;
      changed.money = toJson(money);
    }
    for (const key of contentKeys) {
      if (!contentProvided.includes(key)) continue;
      const value = content[key];
      (data as Record<string, unknown>)[key] = value; // null = очистить
      changed[key] = value;
    }
    if (validUntil !== undefined) {
      data.validUntil = validUntil;
      changed.validUntil = validUntil ? validUntil.toISOString() : null;
    }

    const row = await this.prisma.$transaction(async (tx) => {
      // Serialize cancel-vs-update: если cancel закоммичен до нас — правка
      // заморожена (422); если update первый — правка durable, cancel потом
      // просто закроет request (история Proposal сохраняется).
      const lockedReq = (await tx.$queryRawUnsafe<Array<{ status: string }>>(
        `SELECT status FROM reverse."BuyerRequest" WHERE id = $1 FOR UPDATE`,
        current.buyerRequestId,
      ))[0];
      if (!lockedReq || lockedReq.status !== "SUBMITTED") {
        throw new ValidationDomainError(
          "BuyerRequest is no longer open; DRAFT Proposal is frozen (withdraw remains available)",
        );
      }
      const res = await tx.sellerProposal.updateMany({
        where: { id, sellerId, version: input.expectedVersion },
        data,
      });
      if (res.count === 0) {
        throw new ConflictError("Seller proposal was modified concurrently (stale version)");
      }
      const fresh = await tx.sellerProposal.findUniqueOrThrow({ where: { id } });
      await tx.sellerProposalHistory.create({
        data: {
          proposalId: id,
          action: "updated",
          actorId: actor.id,
          actorName: actor.username,
          fields: toJson(changed),
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "proposal.updated",
        resource: "SellerProposal",
        resourceId: id,
        details: { sellerId, ...changed },
      });
      return fresh;
    });

    return this.toSellerView(row);
  }

  // ── Seller lifecycle ──────────────────────────────────────────────────

  async submitOwn(actor: AuthUser, id: string, expectedVersion: number) {
    const sellerId = await this.assertSellerEligible(actor);
    const current = await this.findOwn(id, sellerId);
    if (current.status === "SUBMITTED") {
      return this.toSellerView(current); // deterministic no-op
    }
    if (current.status !== "DRAFT") {
      throw new ValidationDomainError("cannot submit a Proposal that is not DRAFT (already withdrawn)");
    }

    const row = await this.prisma.$transaction(async (tx) => {
      // Serialize cancel-vs-submit (Step 2.2D §14): FOR UPDATE на request row.
      // Если cancel закоммичен раньше — Proposal НЕ может стать SUBMITTED на
      // CANCELLED request (422); если submit первый — Proposal SUBMITTED durable,
      // cancel продолжит (история не удаляется, Buyer projection показывает
      // актуальный request.status). Никакого impossible state.
      const lockedReq = (await tx.$queryRawUnsafe<Array<{ status: string }>>(
        `SELECT status FROM reverse."BuyerRequest" WHERE id = $1 FOR UPDATE`,
        current.buyerRequestId,
      ))[0];
      if (!lockedReq || lockedReq.status !== "SUBMITTED") {
        throw new ValidationDomainError(
          `BuyerRequest is no longer open; Proposal cannot be submitted (${lockedReq?.status ?? "missing"})`,
        );
      }
      const res = await tx.sellerProposal.updateMany({
        where: { id, sellerId, version: expectedVersion },
        data: { status: "SUBMITTED", submittedAt: new Date(), version: { increment: 1 } },
      });
      if (res.count === 0) {
        throw new ConflictError("Seller proposal was modified concurrently (stale version)");
      }
      const fresh = await tx.sellerProposal.findUniqueOrThrow({ where: { id } });
      await tx.sellerProposalHistory.create({
        data: {
          proposalId: id,
          action: "submitted",
          from: "DRAFT",
          to: "SUBMITTED",
          actorId: actor.id,
          actorName: actor.username,
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "proposal.submitted",
        resource: "SellerProposal",
        resourceId: id,
        details: { sellerId, buyerRequestId: fresh.buyerRequestId },
      });
      return fresh;
    });

    return this.toSellerView(row);
  }

  async withdrawOwn(actor: AuthUser, id: string, expectedVersion: number) {
    const sellerId = await this.assertSellerEligible(actor);
    const current = await this.findOwn(id, sellerId);
    if (current.status === "WITHDRAWN") {
      return this.toSellerView(current); // deterministic no-op
    }
    if (current.status !== "SUBMITTED") {
      throw new ValidationDomainError("cannot withdraw a Proposal that is not SUBMITTED (drafts are edited or submitted)");
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const res = await tx.sellerProposal.updateMany({
        where: { id, sellerId, version: expectedVersion },
        data: { status: "WITHDRAWN", withdrawnAt: new Date(), version: { increment: 1 } },
      });
      if (res.count === 0) {
        throw new ConflictError("Seller proposal was modified concurrently (stale version)");
      }
      const fresh = await tx.sellerProposal.findUniqueOrThrow({ where: { id } });
      await tx.sellerProposalHistory.create({
        data: {
          proposalId: id,
          action: "withdrawn",
          from: "SUBMITTED",
          to: "WITHDRAWN",
          actorId: actor.id,
          actorName: actor.username,
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "proposal.withdrawn",
        resource: "SellerProposal",
        resourceId: id,
        details: { sellerId, buyerRequestId: fresh.buyerRequestId },
      });
      return fresh;
    });

    return this.toSellerView(row);
  }

  // ── Buyer own-request reads ───────────────────────────────────────────

  /** Buyer: proposals СВОЕГО request (own-request scope, neutral 404). */
  async listForRequest(actor: AuthUser, requestId: string, limit: number, offset: number) {
    const buyerId = await this.assertBuyerEligible(actor);
    const request = await this.prisma.buyerRequest.findFirst({ where: { id: requestId, buyerId } });
    if (!request) throw new NotFoundError("Buyer request not found");

    const [items, total] = await this.prisma.$transaction([
      this.prisma.sellerProposal.findMany({
        where: { buyerRequestId: requestId, status: { in: ["SUBMITTED", "WITHDRAWN"] } },
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
      }),
      this.prisma.sellerProposal.count({
        where: { buyerRequestId: requestId, status: { in: ["SUBMITTED", "WITHDRAWN"] } },
      }),
    ]);
    // Только SUBMITTED/WITHDRAWN видны Buyer-у (DRAFT — не направлен).
    const sellers = await this.sellerIdentityMap(items.map((p) => p.sellerId));
    return { items: items.map((p) => this.toBuyerView(p, sellers.get(p.sellerId) ?? null)), total };
  }

  /** Buyer: один Proposal СВОЕГО request. Cross-request/cross-buyer → neutral 404. */
  async getForRequest(actor: AuthUser, requestId: string, proposalId: string) {
    const buyerId = await this.assertBuyerEligible(actor);
    const request = await this.prisma.buyerRequest.findFirst({ where: { id: requestId, buyerId } });
    if (!request) throw new NotFoundError("Buyer request not found");
    const row = await this.prisma.sellerProposal.findFirst({
      where: { id: proposalId, buyerRequestId: requestId, status: { in: ["SUBMITTED", "WITHDRAWN"] } },
    });
    if (!row) throw new NotFoundError("Seller proposal not found");
    const sellers = await this.sellerIdentityMap([row.sellerId]);
    return this.toBuyerView(row, sellers.get(row.sellerId) ?? null);
  }
}
