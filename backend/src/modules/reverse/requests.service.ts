import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import type { AuthUser } from "../../security/auth/auth.service";
import { RoleCode } from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";
import {
  normalizeDestinations,
  normalizeRequestDates,
  normalizePax,
  normalizeBudget,
  normalizePreferences,
  type CapabilityDestination,
  type BudgetHint,
} from "./requests.validation";

const toJson = (v: unknown): Prisma.InputJsonValue => v as unknown as Prisma.InputJsonValue;

/**
 * PHASE 2 STEP 2.2B — Buyer Request Foundation (reverse.*, ADR-0012).
 *
 * Demand-led entry: Buyer описывает, что хочет купить, без выбора Product.
 *
 * Инварианты:
 *  - ownership ТОЛЬКО из actor.customerId (сервер); body/query НЕ security source;
 *  - BuyerRequest НЕ Lead/Opportunity/Quote/Sale/Order/Booking/Communication —
 *    создание НЕ создаёт ни одной Sales/Order/Booking-сущности;
 *  - destination НЕ выводится из home/legal location Buyer;
 *  - PAX-minimal без PII; budget/preferences — НЕ-binding demand hints;
 *  - acquisitionSource серверный, всегда BUYER_REQUEST;
 *  - lifecycle DRAFT → SUBMITTED → CANCELLED (update только в DRAFT);
 *    никакого MATCHED/DISTRIBUTED (2.2C), Proposal (2.2D), conversion (2.2F);
 *  - CAS (version); audit history; события НЕ эмитятся (нет consumer в 2.2B);
 *  - Seller не имеет доступа (только после distribution 2.2C).
 */
@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
  ) {}

  /**
   * Gate: строго BUYER (даже ADMIN/PARTNER → 403 — Buyer-owned контракт,
   * как Buyer Cabinet precedent). Требует customerId != null (Step 1.9
   * mapping). Возвращает канонический customerId (единственный security source).
   */
  private async assertEligible(actor: AuthUser): Promise<string> {
    if (actor.role !== RoleCode.BUYER) {
      throw new ForbiddenError("Only BUYER can manage Buyer Requests (buyer-own contract)");
    }
    if (!actor.customerId) {
      throw new ForbiddenError("Buyer is not mapped to a CRM customer; Buyer Requests are not allowed");
    }
    return actor.customerId;
  }

  /** Own-scope lookup: request принадлежит этому Buyer (иначе neutral 404). */
  private async findOwn(id: string, buyerId: string) {
    const row = await this.prisma.buyerRequest.findFirst({ where: { id, buyerId } });
    if (!row) throw new NotFoundError("Buyer request not found");
    return row;
  }

  private toView(row: {
    id: string;
    code: string;
    buyerId: string;
    categoryId: string;
    categorySlug: string;
    destinations: unknown;
    serviceDateFrom: Date | null;
    serviceDateTo: Date | null;
    adults: number;
    children: number;
    infants: number;
    budget: unknown;
    preferences: unknown;
    acquisitionSource: string;
    status: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    submittedAt: Date | null;
    cancelledAt: Date | null;
    // Step 2.2F: канонический выбранный Proposal (server-owned; own-request view).
    selectedProposalId: string | null;
  }) {
    return {
      id: row.id,
      code: row.code,
      buyerId: row.buyerId,
      categoryId: row.categoryId,
      categorySlug: row.categorySlug,
      destinations: row.destinations as CapabilityDestination[],
      serviceDateFrom: row.serviceDateFrom,
      serviceDateTo: row.serviceDateTo,
      adults: row.adults,
      children: row.children,
      infants: row.infants,
      budget: row.budget as BudgetHint | null,
      preferences: row.preferences as Record<string, unknown> | null,
      acquisitionSource: row.acquisitionSource,
      status: row.status,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      submittedAt: row.submittedAt,
      cancelledAt: row.cancelledAt,
      selectedProposalId: row.selectedProposalId,
    };
  }

  // ── Reads ─────────────────────────────────────────────────────────────

  async listOwn(actor: AuthUser, limit: number, offset: number) {
    const buyerId = await this.assertEligible(actor);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.buyerRequest.findMany({
        where: { buyerId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
      }),
      this.prisma.buyerRequest.count({ where: { buyerId } }),
    ]);
    return { items: items.map((r) => this.toView(r)), total };
  }

  async getOwn(actor: AuthUser, id: string) {
    const buyerId = await this.assertEligible(actor);
    return this.toView(await this.findOwn(id, buyerId));
  }

  async historyOwn(actor: AuthUser, id: string) {
    const buyerId = await this.assertEligible(actor);
    await this.findOwn(id, buyerId); // own-scope gate (404 neutral)
    const rows = await this.prisma.buyerRequestHistory.findMany({
      where: { requestId: id },
      orderBy: { createdAt: "desc" },
    });
    return { items: rows };
  }

  // ── Create ────────────────────────────────────────────────────────────

  async createOwn(
    actor: AuthUser,
    input: {
      categoryId: string;
      destinations: unknown;
      serviceDateFrom?: string;
      serviceDateTo?: string;
      adults?: number;
      children?: number;
      infants?: number;
      budget?: unknown;
      preferences?: unknown;
    },
  ) {
    const buyerId = await this.assertEligible(actor);

    // Category — read-by-ID (ADR-0001): Catalog остаётся владельцем taxonomy.
    // Запрос НЕ требует существования Product (zero-Product request легален).
    const category = await this.prisma.category.findUnique({
      where: { id: input.categoryId },
      select: { slug: true, status: true },
    });
    if (!category) {
      throw new ValidationDomainError("category does not exist");
    }
    if (category.status !== "ACTIVE") {
      throw new ValidationDomainError("category is not ACTIVE; request cannot reference it");
    }

    const destinations = normalizeDestinations(input.destinations);
    const dates = normalizeRequestDates(input.serviceDateFrom, input.serviceDateTo);
    const pax = normalizePax(input.adults ?? 1, input.children ?? 0, input.infants ?? 0);
    const budget = normalizeBudget(input.budget);
    const preferences = normalizePreferences(input.preferences);

    const row = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "BRQ");
      const created = await tx.buyerRequest.create({
        data: {
          code,
          buyerId,
          categoryId: input.categoryId,
          categorySlug: category.slug,
          destinations: toJson(destinations),
          serviceDateFrom: dates.serviceDateFrom,
          serviceDateTo: dates.serviceDateTo,
          adults: pax.adults,
          children: pax.children,
          infants: pax.infants,
          budget: budget ? toJson(budget) : undefined,
          preferences: preferences ? toJson(preferences) : undefined,
          acquisitionSource: "BUYER_REQUEST", // server-owned
          createdBy: actor.id,
        },
      });
      await tx.buyerRequestHistory.create({
        data: {
          requestId: created.id,
          action: "created",
          to: "DRAFT",
          actorId: actor.id,
          actorName: actor.username,
          fields: { categoryId: input.categoryId, categorySlug: category.slug, destinations: toJson(destinations) },
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "request.created",
        resource: "BuyerRequest",
        resourceId: created.id,
        details: { buyerId, categoryId: input.categoryId, categorySlug: category.slug },
      });
      return created;
    });

    this.logger.log(`BuyerRequest ${row.code} (${row.categorySlug}) created for buyer ${buyerId} (DRAFT)`);
    return this.toView(row);
  }

  // ── Update (DRAFT only) ───────────────────────────────────────────────

  async updateOwn(
    actor: AuthUser,
    id: string,
    input: {
      categoryId?: string;
      destinations?: unknown;
      serviceDateFrom?: string;
      serviceDateTo?: string;
      adults?: number;
      children?: number;
      infants?: number;
      budget?: unknown;
      preferences?: unknown;
      expectedVersion: number;
    },
  ) {
    const buyerId = await this.assertEligible(actor);
    const current = await this.findOwn(id, buyerId);
    if (current.status !== "DRAFT") {
      throw new ValidationDomainError("only DRAFT Buyer Requests are editable (submitted/cancelled are frozen)");
    }

    // Частичный PATCH: применяем только переданные поля.
    let category: { slug: string; status: string } | null = null;
    if (input.categoryId !== undefined) {
      category = await this.prisma.category.findUnique({
        where: { id: input.categoryId },
        select: { slug: true, status: true },
      });
      if (!category) {
        throw new ValidationDomainError("category does not exist");
      }
      if (category.status !== "ACTIVE") {
        throw new ValidationDomainError("category is not ACTIVE; request cannot reference it");
      }
    }

    const destinations = input.destinations === undefined ? undefined : normalizeDestinations(input.destinations);
    const dates = normalizeRequestDates(input.serviceDateFrom, input.serviceDateTo);
    const pax = normalizePax(input.adults ?? current.adults, input.children ?? current.children, input.infants ?? current.infants);
    const budget = input.budget === undefined ? undefined : normalizeBudget(input.budget);
    const preferences = input.preferences === undefined ? undefined : normalizePreferences(input.preferences);

    const data: Prisma.BuyerRequestUpdateManyMutationInput = {
      version: { increment: 1 },
    };
    const changed: Record<string, unknown> = {};
    if (category) {
      data.categoryId = input.categoryId;
      data.categorySlug = category.slug;
      changed.categoryId = input.categoryId;
    }
    if (destinations) {
      data.destinations = toJson(destinations);
      changed.destinations = destinations;
    }
    if (dates.serviceDateFrom !== undefined) {
      data.serviceDateFrom = dates.serviceDateFrom;
      changed.serviceDateFrom = dates.serviceDateFrom;
    }
    if (dates.serviceDateTo !== undefined) {
      data.serviceDateTo = dates.serviceDateTo;
      changed.serviceDateTo = dates.serviceDateTo;
    }
    data.adults = pax.adults;
    data.children = pax.children;
    data.infants = pax.infants;
    if (budget !== undefined) {
      data.budget = budget ? toJson(budget) : Prisma.DbNull;
      changed.budget = budget ?? null;
    }
    if (preferences !== undefined) {
      data.preferences = preferences ? toJson(preferences) : Prisma.DbNull;
      changed.preferences = preferences ?? null;
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const res = await tx.buyerRequest.updateMany({
        where: { id, buyerId, version: input.expectedVersion },
        data,
      });
      if (res.count === 0) {
        throw new ConflictError("Buyer request was modified concurrently (stale version)");
      }
      const fresh = await tx.buyerRequest.findUniqueOrThrow({ where: { id } });
      await tx.buyerRequestHistory.create({
        data: {
          requestId: id,
          action: "updated",
          actorId: actor.id,
          actorName: actor.username,
          fields: toJson(changed),
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "request.updated",
        resource: "BuyerRequest",
        resourceId: id,
        details: { buyerId, ...changed },
      });
      return fresh;
    });

    return this.toView(row);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  async submitOwn(actor: AuthUser, id: string, expectedVersion: number) {
    const buyerId = await this.assertEligible(actor);
    const current = await this.findOwn(id, buyerId);
    if (current.status === "SUBMITTED") {
      return this.toView(current); // deterministic no-op
    }
    if (current.status === "CANCELLED") {
      throw new ValidationDomainError("cannot submit a CANCELLED Buyer Request");
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const res = await tx.buyerRequest.updateMany({
        where: { id, buyerId, version: expectedVersion },
        data: { status: "SUBMITTED", submittedAt: new Date(), version: { increment: 1 } },
      });
      if (res.count === 0) {
        throw new ConflictError("Buyer request was modified concurrently (stale version)");
      }
      const fresh = await tx.buyerRequest.findUniqueOrThrow({ where: { id } });
      await tx.buyerRequestHistory.create({
        data: {
          requestId: id,
          action: "submitted",
          from: current.status,
          to: "SUBMITTED",
          actorId: actor.id,
          actorName: actor.username,
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "request.submitted",
        resource: "BuyerRequest",
        resourceId: id,
        details: { buyerId, categoryId: fresh.categoryId },
      });
      return fresh;
    });

    return this.toView(row);
  }

  async cancelOwn(actor: AuthUser, id: string, expectedVersion: number) {
    const buyerId = await this.assertEligible(actor);
    const current = await this.findOwn(id, buyerId);
    if (current.status === "CANCELLED") {
      return this.toView(current); // deterministic no-op
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const res = await tx.buyerRequest.updateMany({
        where: { id, buyerId, version: expectedVersion },
        data: { status: "CANCELLED", cancelledAt: new Date(), version: { increment: 1 } },
      });
      if (res.count === 0) {
        throw new ConflictError("Buyer request was modified concurrently (stale version)");
      }
      const fresh = await tx.buyerRequest.findUniqueOrThrow({ where: { id } });
      await tx.buyerRequestHistory.create({
        data: {
          requestId: id,
          action: "cancelled",
          from: current.status,
          to: "CANCELLED",
          actorId: actor.id,
          actorName: actor.username,
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "request.cancelled",
        resource: "BuyerRequest",
        resourceId: id,
        details: { buyerId, categoryId: fresh.categoryId },
      });
      return fresh;
    });

    return this.toView(row);
  }
}
