import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { uniqueConstraintNames } from "../../shared/prisma-errors";
import type { AuthUser } from "../../security/auth/auth.service";
import { RoleCode } from "../../generated/prisma/enums";
import { normalizeDestinations, type CapabilityDestination } from "./capabilities.validation";
import type { Prisma } from "../../generated/prisma/client";

/** Prisma JSON требует JSON-совместимый тип (без интерфейсных index-signature). */
const toJson = (d: CapabilityDestination[]): Prisma.InputJsonValue => d as unknown as Prisma.InputJsonValue;

/**
 * PHASE 2 STEP 2.2A — Seller Commercial Capabilities & Destination Coverage.
 *
 * Владелец: reverse.* (ADR-0012). Seller-declared commercial eligibility —
 * НЕ inventory/Product/pricing/availability/entitlement.
 *
 * Инварианты:
 *  - ownership ТОЛЬКО из actor.partnerId (сервер), никогда из body/query;
 *  - legal/registration country НЕ определяет и НЕ подставляет coverage;
 *  - capability ≠ entitlement (gate — Step 2.2C, здесь отсутствует);
 *  - один capability на (sellerId, categoryId) — deterministic duplicate rule;
 *  - CAS (version) — stale expectedVersion → 409; переходы lifecycle с
 *    no-op при том же состоянии; timestamps — реальные переходы (UTC);
 *  - audit history по каждому meaningful mutation; события НЕ эмитятся
 *    (нет consumer/business meaning в 2.2A);
 *  - никаких cross-context writes (только read-by-ID: crm.Partner,
 *    catalog.Category — ADR-0001).
 */
@Injectable()
export class CapabilitiesService {
  private readonly logger = new Logger(CapabilitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
  ) {}

  // ── Eligibility (Step 2.2A §12/§14) ───────────────────────────────────

  /**
   * Gate: PARTNER управляет capabilities только если authenticated (guard),
   * role=PARTNER, User ACTIVE (guard), User.partnerId != null (approved
   * onboarding), CRM Partner reference валиден (существует + ACTIVE;
   * cross-schema read ADR-0001). Pending PARTNER (partnerId=null) → 403;
   * BUYER/MODERATOR/ADMIN → 403 (partner-own контракт). Возвращает
   * канонический partnerId (единственный security source).
   */
  private async assertEligible(actor: AuthUser): Promise<string> {
    if (actor.role !== RoleCode.PARTNER) {
      throw new ForbiddenError("Only PARTNER can manage Seller capabilities (partner-own contract)");
    }
    if (!actor.partnerId) {
      throw new ForbiddenError(
        "Partner onboarding is not approved: capabilities are not allowed until User.partnerId is assigned",
      );
    }
    const partner = await this.prisma.partner.findUnique({
      where: { id: actor.partnerId },
      select: { status: true },
    });
    if (!partner) {
      throw new ForbiddenError("CRM partner reference is not valid; capabilities access denied");
    }
    if (partner.status !== "ACTIVE") {
      throw new ForbiddenError("CRM partner is not ACTIVE; capabilities access denied");
    }
    return actor.partnerId;
  }

  /** Own-scope lookup: capability принадлежит этому Seller (иначе neutral 404). */
  private async findOwn(id: string, sellerId: string) {
    const row = await this.prisma.sellerCapability.findFirst({ where: { id, sellerId } });
    if (!row) throw new NotFoundError("Seller capability not found");
    return row;
  }

  private toView(row: {
    id: string;
    code: string;
    sellerId: string;
    categoryId: string;
    categorySlug: string;
    destinations: unknown;
    acceptsBuyerRequests: boolean;
    status: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    activatedAt: Date | null;
    deactivatedAt: Date | null;
  }) {
    return {
      id: row.id,
      code: row.code,
      sellerId: row.sellerId,
      categoryId: row.categoryId,
      categorySlug: row.categorySlug,
      destinations: row.destinations as CapabilityDestination[],
      acceptsBuyerRequests: row.acceptsBuyerRequests,
      status: row.status,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      activatedAt: row.activatedAt,
      deactivatedAt: row.deactivatedAt,
    };
  }

  // ── Reads ─────────────────────────────────────────────────────────────

  async listOwn(actor: AuthUser, limit: number, offset: number) {
    const sellerId = await this.assertEligible(actor);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.sellerCapability.findMany({
        where: { sellerId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
      }),
      this.prisma.sellerCapability.count({ where: { sellerId } }),
    ]);
    return { items: items.map((r) => this.toView(r)), total };
  }

  async getOwn(actor: AuthUser, id: string) {
    const sellerId = await this.assertEligible(actor);
    return this.toView(await this.findOwn(id, sellerId));
  }

  async historyOwn(actor: AuthUser, id: string) {
    const sellerId = await this.assertEligible(actor);
    await this.findOwn(id, sellerId); // own-scope gate (404 neutral)
    const rows = await this.prisma.sellerCapabilityHistory.findMany({
      where: { capabilityId: id },
      orderBy: { createdAt: "desc" },
    });
    return { items: rows };
  }

  // ── Create ────────────────────────────────────────────────────────────

  async createOwn(actor: AuthUser, input: { categoryId: string; destinations: unknown }) {
    const sellerId = await this.assertEligible(actor);

    // Category — read-by-ID (ADR-0001): Catalog остаётся владельцем taxonomy.
    const category = await this.prisma.category.findUnique({
      where: { id: input.categoryId },
      select: { slug: true, status: true },
    });
    if (!category) {
      throw new ValidationDomainError("category does not exist");
    }
    if (category.status !== "ACTIVE") {
      throw new ValidationDomainError("category is not ACTIVE; capability cannot reference it");
    }

    const destinations = normalizeDestinations(input.destinations);

    const row = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "CAP");
      let created;
      try {
        created = await tx.sellerCapability.create({
          data: {
            code,
            sellerId,
            categoryId: input.categoryId,
            categorySlug: category.slug,
            destinations: toJson(destinations),
            createdById: actor.id,
          },
        });
      } catch (err) {
        const names = uniqueConstraintNames(err);
        if (names.some((n) => n.toLowerCase().includes("sellerid"))) {
          throw new ConflictError(
            "A capability for this category already exists for this seller (one capability per seller+category)",
          );
        }
        throw err;
      }
      await tx.sellerCapabilityHistory.create({
        data: {
          capabilityId: created.id,
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
        action: "capability.created",
        resource: "SellerCapability",
        resourceId: created.id,
        details: { partnerId: sellerId, categoryId: input.categoryId, categorySlug: category.slug },
      });
      return created;
    });

    this.logger.log(`Capability ${row.code} (${row.categorySlug}) created for seller ${sellerId} (DRAFT)`);
    return this.toView(row);
  }

  // ── Update (destinations) ─────────────────────────────────────────────

  async updateOwn(actor: AuthUser, id: string, input: { destinations: unknown; expectedVersion: number }) {
    const sellerId = await this.assertEligible(actor);
    const current = await this.findOwn(id, sellerId);
    const destinations = normalizeDestinations(input.destinations);

    const row = await this.prisma.$transaction(async (tx) => {
      const res = await tx.sellerCapability.updateMany({
        where: { id, sellerId, version: input.expectedVersion },
        data: { destinations: toJson(destinations), version: { increment: 1 } },
      });
      if (res.count === 0) {
        throw new ConflictError("Seller capability was modified concurrently (stale version)");
      }
      const fresh = await tx.sellerCapability.findUniqueOrThrow({ where: { id } });
      await tx.sellerCapabilityHistory.create({
        data: {
          capabilityId: id,
          action: "destinations_updated",
          actorId: actor.id,
          actorName: actor.username,
          fields: { from: current.destinations, to: toJson(destinations) },
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "capability.updated",
        resource: "SellerCapability",
        resourceId: id,
        details: { partnerId: sellerId, categoryId: fresh.categoryId, destinations },
      });
      return fresh;
    });

    return this.toView(row);
  }

  // ── Accepts Buyer Requests ────────────────────────────────────────────

  async setAcceptsRequests(actor: AuthUser, id: string, accepts: boolean, expectedVersion: number) {
    const sellerId = await this.assertEligible(actor);
    const current = await this.findOwn(id, sellerId);
    if (current.acceptsBuyerRequests === accepts) {
      // Deterministic no-op при том же состоянии (без мутации/версии).
      return this.toView(current);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const res = await tx.sellerCapability.updateMany({
        where: { id, sellerId, version: expectedVersion },
        data: { acceptsBuyerRequests: accepts, version: { increment: 1 } },
      });
      if (res.count === 0) {
        throw new ConflictError("Seller capability was modified concurrently (stale version)");
      }
      const fresh = await tx.sellerCapability.findUniqueOrThrow({ where: { id } });
      await tx.sellerCapabilityHistory.create({
        data: {
          capabilityId: id,
          action: "accepts_requests_updated",
          from: String(current.acceptsBuyerRequests),
          to: String(accepts),
          actorId: actor.id,
          actorName: actor.username,
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "capability.accepts_requests_updated",
        resource: "SellerCapability",
        resourceId: id,
        details: { partnerId: sellerId, from: current.acceptsBuyerRequests, to: accepts },
      });
      return fresh;
    });

    return this.toView(row);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  async activateOwn(actor: AuthUser, id: string, expectedVersion: number) {
    const sellerId = await this.assertEligible(actor);
    const current = await this.findOwn(id, sellerId);
    if (current.status === "ACTIVE") {
      return this.toView(current); // deterministic no-op
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const res = await tx.sellerCapability.updateMany({
        where: { id, sellerId, version: expectedVersion },
        data: { status: "ACTIVE", activatedAt: new Date(), version: { increment: 1 } },
      });
      if (res.count === 0) {
        throw new ConflictError("Seller capability was modified concurrently (stale version)");
      }
      const fresh = await tx.sellerCapability.findUniqueOrThrow({ where: { id } });
      await tx.sellerCapabilityHistory.create({
        data: {
          capabilityId: id,
          action: "activated",
          from: current.status,
          to: "ACTIVE",
          actorId: actor.id,
          actorName: actor.username,
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "capability.activated",
        resource: "SellerCapability",
        resourceId: id,
        details: { partnerId: sellerId, categoryId: fresh.categoryId },
      });
      return fresh;
    });

    return this.toView(row);
  }

  async deactivateOwn(actor: AuthUser, id: string, expectedVersion: number) {
    const sellerId = await this.assertEligible(actor);
    const current = await this.findOwn(id, sellerId);
    if (current.status === "INACTIVE") {
      return this.toView(current); // deterministic no-op
    }
    if (current.status === "DRAFT") {
      throw new ValidationDomainError("cannot deactivate a DRAFT capability (only ACTIVE → INACTIVE)");
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const res = await tx.sellerCapability.updateMany({
        where: { id, sellerId, version: expectedVersion },
        data: { status: "INACTIVE", deactivatedAt: new Date(), version: { increment: 1 } },
      });
      if (res.count === 0) {
        throw new ConflictError("Seller capability was modified concurrently (stale version)");
      }
      const fresh = await tx.sellerCapability.findUniqueOrThrow({ where: { id } });
      await tx.sellerCapabilityHistory.create({
        data: {
          capabilityId: id,
          action: "deactivated",
          from: current.status,
          to: "INACTIVE",
          actorId: actor.id,
          actorName: actor.username,
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "capability.deactivated",
        resource: "SellerCapability",
        resourceId: id,
        details: { partnerId: sellerId, categoryId: fresh.categoryId },
      });
      return fresh;
    });

    return this.toView(row);
  }
}
