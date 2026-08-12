import { Injectable, Logger } from "@nestjs/common";
import { Prisma, type CommercialRestrictionScope, type CommercialRestrictionType } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { CatalogAccessPolicy } from "./catalog-access.policy";
import { RoleCode } from "../../generated/prisma/enums";
import type { AuthUser } from "../../security/auth/auth.service";
import { RatePlanService } from "./rate-plan.service";
import {
  COMMERCIAL_RESTRICTION_FORBIDDEN_KEYS,
  RESTRICTION_TYPE_VALUES,
  assertCategorySupportsRestriction,
  assertStopSellScope,
  validateRestrictionInput,
  type ValidatedRestrictionInput,
} from "./restriction.validation";

const toJson = (v: Record<string, unknown>): Prisma.InputJsonValue => v as unknown as Prisma.InputJsonValue;

export interface CreateRestrictionInput {
  scope?: string;
  type?: string;
  value?: number;
  startDate?: string;
  endDate?: string;
  commercialPeriodId?: string;
}

export interface UpdateRestrictionInput {
  scope?: string;
  type?: string;
  value?: number;
  startDate?: string;
  endDate?: string;
  commercialPeriodId?: string;
}

interface TariffWithProduct {
  id: string;
  code: string;
  status: string;
  restrictions: Prisma.JsonValue | null;
  product: { id: string; code: string; partnerId: string | null; status: string; categoryId: string | null };
}

/**
 * PHASE 1 STEP 1.8D — CommercialRestriction (scoped restriction/override
 * foundation) — Catalog owner (DD-026/DD-028; Universal Pricing §30).
 *
 * Единый authority на каждом уровне:
 *  - BASE факты — Tariff.restrictions (1.8B, whitelist-валидированные);
 *  - PERIOD/DATE override — этот entity (CRS-*); TARIFF-scope в entity НЕ
 *    существует (запрещён 422 — см. validation), дублирование authority
 *    на одном уровне невозможно;
 *  - периодный stop-sell — CommercialPeriod.sellable (1.8C); STOP_SELL
 *    restriction — DATE-scope only.
 *
 * Precedence: DATE > PERIOD-attached (resolved period 1.8C) > BASE. Same-tier
 * contradiction на write → 422 (как 1.8C overlap). createdAt НЕ precedence.
 *
 * Инварианты: ownership наследуется через Tariff→Product; PARTNER — own-scope
 * и коммерческие правки под DRAFT Product; version-CAS; advisory lock на
 * Tariff сериализует concurrent create (два одинаковых DATE/PERIOD restriction
 * не могут пройти conflict-проверку); lifecycle soft ACTIVE/ARCHIVED;
 * history Restrict — delete-safety; НЕ inventory-счётчик, НЕ price-строка,
 * НЕ второй pricing/availability engine; событий нет (нет consumers).
 */
@Injectable()
export class CommercialRestrictionService {
  private readonly logger = new Logger(CommercialRestrictionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
    private readonly policy: CatalogAccessPolicy,
    private readonly ratePlans: RatePlanService,
  ) {}

  private managePermission(actor: AuthUser): string {
    return actor.role === RoleCode.PARTNER ? "catalog.product.update_own_draft" : "catalog.product.write";
  }

  private readPermission(actor: AuthUser): string {
    return actor.role === RoleCode.PARTNER ? "catalog.product.read_own" : "catalog.product.read";
  }

  /** Own-scope Tariff lookup с Product-контекстом (PARTNER — только свои). */
  private async findTariffWithProduct(id: string, actor: AuthUser): Promise<TariffWithProduct> {
    const tariff = await this.prisma.tariff.findUnique({
      where: { id },
      select: { id: true, code: true, status: true, restrictions: true, product: { select: { id: true, code: true, partnerId: true, status: true, categoryId: true } } },
    });
    if (!tariff) throw new NotFoundError(`Rate plan ${id} not found`);
    if (actor.role === RoleCode.PARTNER) {
      this.policy.assertCanManage(actor, tariff.product.partnerId, this.readPermission(actor));
    } else {
      this.policy.assertCanRead(actor, tariff.product.partnerId);
    }
    return tariff;
  }

  /** Own-scope restriction lookup. */
  private async findRestriction(id: string, actor: AuthUser) {
    const row = await this.prisma.commercialRestriction.findUnique({
      where: { id },
      include: { tariff: { include: { product: { select: { id: true, partnerId: true } } } } },
    });
    if (!row) throw new NotFoundError(`Commercial restriction ${id} not found`);
    if (actor.role === RoleCode.PARTNER) {
      this.policy.assertCanManage(actor, row.tariff.product.partnerId, this.readPermission(actor));
    } else {
      this.policy.assertCanRead(actor, row.tariff.product.partnerId);
    }
    return row;
  }

  /** Advisory lock на Tariff (сериализация restriction-мутаций; отдельный ключ
   * от period-лока — restriction-операции не блокируют периодные и наоборот). */
  private async lockTariff(tx: Prisma.TransactionClient, tariffId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`catalog:restriction:${tariffId}`}))`;
  }

  /** Parent-eligibility: Tariff ACTIVE, Product не ARCHIVED, PARTNER → DRAFT. */
  private assertEligible(tariff: TariffWithProduct, actor: AuthUser, op: string): void {
    if (tariff.status === "ARCHIVED") {
      throw new ConflictError(`Rate plan ${tariff.code} is ARCHIVED; cannot ${op} commercial restrictions (activate first)`);
    }
    if (tariff.product.status === "ARCHIVED") {
      throw new ConflictError(`Product ${tariff.product.code} is ARCHIVED; cannot ${op} commercial restrictions`);
    }
    if (actor.role === RoleCode.PARTNER && tariff.product.status !== "DRAFT") {
      throw new ConflictError(
        `Product ${tariff.product.code} is ${tariff.product.status}; PARTNER can only manage restrictions of DRAFT products`,
      );
    }
  }

  /** Категорийный гейт (DD-028): unsupported type для категории → 422. */
  private async assertCategorySupported(
    tx: Prisma.TransactionClient,
    tariff: TariffWithProduct,
    type: CommercialRestrictionType,
  ): Promise<void> {
    const allowed = await this.ratePlans.allowedRestrictionTypes(tx, tariff.product.categoryId);
    assertCategorySupportsRestriction(type, allowed, tariff.product.code);
  }

  /**
   * Same-tier conflict против существующих ACTIVE restriction Tariff:
   *  - DATE: две DATE-строки одного типа на одну дату → 422;
   *  - PERIOD: две PERIOD-строки одного типа на один период → 422.
   * Меж-tier конфликт (DATE vs PERIOD vs BASE) НЕ конфликт — это override.
   */
  private async assertNoConflict(
    tx: Prisma.TransactionClient,
    tariffId: string,
    candidate: ValidatedRestrictionInput,
    excludeId?: string,
  ): Promise<void> {
    const where = {
      tariffId,
      status: "ACTIVE",
      type: candidate.type,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    } as Prisma.CommercialRestrictionWhereInput;
    if (candidate.scope === "DATE") {
      where.scope = "DATE";
      where.startDate = candidate.startDate;
      where.endDate = candidate.endDate;
    } else {
      where.scope = "PERIOD";
    }
    const rows = await tx.commercialRestriction.findMany({ where, select: { code: true, commercialPeriodId: true, startDate: true } });
    if (rows.length > 0) {
      const r = rows[0];
      if (candidate.scope === "DATE") {
        throw new ValidationDomainError(
          `Restriction ${candidate.type} already exists for date ${candidate.startDate?.toISOString().slice(0, 10)} (${r.code}) — same-tier duplicate`,
        );
      }
      throw new ValidationDomainError(
        `Restriction ${candidate.type} already exists for commercial period ${r.commercialPeriodId ?? "?"} (${r.code}) — same-tier duplicate`,
      );
    }
  }

  /** MIN_STAY override не может противоречить base maxStay (fail-closed набор). */
  private assertMinStayVsBaseMax(tariff: TariffWithProduct, candidate: ValidatedRestrictionInput): void {
    if (candidate.type !== "MIN_STAY" || candidate.value === null) return;
    const base = (tariff.restrictions ?? null) as Record<string, unknown> | null;
    const baseMax = base && typeof base.maxStay === "number" ? base.maxStay : null;
    if (baseMax !== null && candidate.value > baseMax) {
      throw new ValidationDomainError(
        `MIN_STAY ${candidate.value} exceeds base maxStay ${baseMax} of rate plan ${tariff.code} — contradictory range`,
      );
    }
  }

  /** Прямое создание restriction внутри tx. */
  private async createInTx(
    tx: Prisma.TransactionClient,
    tariff: TariffWithProduct,
    input: ValidatedRestrictionInput,
    commercialPeriodId: string | null,
    actor: AuthUser,
  ): Promise<{ id: string; code: string }> {
    await this.assertNoConflict(tx, tariff.id, input);
    this.assertMinStayVsBaseMax(tariff, input);
    await this.assertCategorySupported(tx, tariff, input.type);
    const code = await this.ids.nextCode(tx, "CRS");
    const created = await tx.commercialRestriction.create({
      data: {
        code,
        tariffId: tariff.id,
        scope: input.scope,
        commercialPeriodId,
        startDate: input.startDate,
        endDate: input.endDate,
        type: input.type,
        value: input.value,
        status: "ACTIVE",
        version: 1,
        createdById: actor.id,
      },
    });
    await tx.commercialRestrictionHistory.create({
      data: {
        restrictionId: created.id,
        version: 1,
        action: "created",
        from: null,
        to: "ACTIVE",
        actorId: actor.id,
        actorName: actor.username,
        comment: "Commercial restriction created",
      },
    });
    await this.security.audit(tx, {
      userId: actor.id,
      username: actor.username,
      action: "rate_plan.restriction.created",
      resource: "CommercialRestriction",
      resourceId: created.id,
      details: {
        code,
        tariffId: tariff.id,
        scope: input.scope,
        type: input.type,
        value: input.value,
        commercialPeriodId,
        startDate: input.startDate ? input.startDate.toISOString().slice(0, 10) : null,
      },
    });
    return { id: created.id, code };
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(tariffId: string, input: CreateRestrictionInput, actor: AuthUser) {
    const validated = validateRestrictionInput(input);
    assertStopSellScope(validated.scope, validated.type);
    const tariff = await this.findTariffWithProduct(tariffId, actor);
    this.policy.assertCanManage(actor, tariff.product.partnerId, this.managePermission(actor));
    this.assertEligible(tariff, actor, "create");

    // PERIOD-scope: период обязателен, принадлежит Tariff, ACTIVE.
    let commercialPeriodId: string | null = null;
    if (validated.scope === "PERIOD") {
      if (!input.commercialPeriodId) {
        throw new ValidationDomainError("PERIOD-scope restrictions require commercialPeriodId");
      }
      commercialPeriodId = input.commercialPeriodId;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockTariff(tx, tariffId);
      const fresh = await tx.tariff.findUniqueOrThrow({
        where: { id: tariffId },
        select: { id: true, code: true, status: true, restrictions: true, product: { select: { id: true, code: true, partnerId: true, status: true, categoryId: true } } },
      });
      if (fresh.status === "ARCHIVED") throw new ConflictError(`Rate plan ${fresh.code} is ARCHIVED; cannot create commercial restrictions`);
      if (fresh.product.status === "ARCHIVED") throw new ConflictError(`Product ${fresh.product.code} is ARCHIVED`);
      if (actor.role === RoleCode.PARTNER && fresh.product.status !== "DRAFT") {
        throw new ConflictError(`Product ${fresh.product.code} is ${fresh.product.status}; PARTNER can only manage restrictions of DRAFT products`);
      }
      if (validated.scope === "PERIOD") {
        const period = await tx.commercialPeriod.findUnique({
          where: { id: commercialPeriodId! },
          select: { id: true, tariffId: true, status: true, code: true },
        });
        if (!period || period.tariffId !== tariffId) {
          throw new ValidationDomainError(`Commercial period ${commercialPeriodId} does not belong to rate plan ${fresh.code}`);
        }
        if (period.status !== "ACTIVE") {
          throw new ConflictError(`Commercial period ${period.code} is ${period.status}; attach restrictions to ACTIVE periods only`);
        }
      }
      return this.createInTx(tx, fresh, validated, commercialPeriodId, actor);
    });

    this.logger.log(`Commercial restriction ${result.code} created under rate plan ${tariffId}`);
    return this.get(result.id, actor);
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  async listForTariff(tariffId: string, actor: AuthUser, limit: number, offset: number, status?: string) {
    await this.findTariffWithProduct(tariffId, actor);
    const statusFilter = status === "ARCHIVED" || status === "ACTIVE" ? (status as "ACTIVE" | "ARCHIVED") : undefined;
    const where = { tariffId, ...(statusFilter ? { status: statusFilter } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.commercialRestriction.findMany({
        where,
        orderBy: [{ type: "asc" }, { createdAt: "asc" }],
        skip: offset,
        take: limit,
      }),
      this.prisma.commercialRestriction.count({ where }),
    ]);
    return { items: items.map((r) => this.toView(r)), total };
  }

  async get(id: string, actor: AuthUser) {
    return this.toView(await this.findRestriction(id, actor));
  }

  async history(id: string, actor: AuthUser) {
    await this.findRestriction(id, actor);
    const rows = await this.prisma.commercialRestrictionHistory.findMany({
      where: { restrictionId: id },
      orderBy: { createdAt: "desc" },
    });
    return { items: rows };
  }

  private toView(row: {
    id: string;
    code: string;
    tariffId: string;
    scope: CommercialRestrictionScope;
    commercialPeriodId: string | null;
    startDate: Date | null;
    endDate: Date | null;
    type: CommercialRestrictionType;
    value: number | null;
    status: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
  }) {
    return {
      id: row.id,
      code: row.code,
      tariffId: row.tariffId,
      scope: row.scope,
      commercialPeriodId: row.commercialPeriodId,
      startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : null,
      endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : null,
      type: row.type,
      value: row.value,
      status: row.status,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      archivedAt: row.archivedAt,
    };
  }

  // ── Update (version-CAS) ──────────────────────────────────────────────────

  async update(id: string, input: UpdateRestrictionInput, actor: AuthUser) {
    const current = await this.findRestriction(id, actor);
    this.policy.assertCanManage(actor, current.tariff.product.partnerId, this.managePermission(actor));
    if (current.status === "ARCHIVED") {
      throw new ConflictError(`Commercial restriction ${current.code} is ARCHIVED; cannot update (activate first)`);
    }

    const validated = validateRestrictionInput({
      scope: input.scope ?? current.scope,
      type: input.type ?? current.type,
      value: input.value !== undefined ? input.value : current.value,
      startDate: input.startDate ?? (current.startDate ? current.startDate.toISOString().slice(0, 10) : undefined),
      endDate: input.endDate ?? (current.endDate ? current.endDate.toISOString().slice(0, 10) : undefined),
    });
    assertStopSellScope(validated.scope, validated.type);
    const commercialPeriodId = input.commercialPeriodId !== undefined ? (input.commercialPeriodId || null) : current.commercialPeriodId;
    if (validated.scope === "PERIOD" && !commercialPeriodId) {
      throw new ValidationDomainError("PERIOD-scope restrictions require commercialPeriodId");
    }

    const tariff = await this.findTariffWithProduct(current.tariffId, actor);
    this.assertEligible(tariff, actor, "update");

    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockTariff(tx, current.tariffId);
      const fresh = await tx.tariff.findUniqueOrThrow({
        where: { id: current.tariffId },
        select: { id: true, code: true, status: true, restrictions: true, product: { select: { id: true, code: true, partnerId: true, status: true, categoryId: true } } },
      });
      if (fresh.status === "ARCHIVED") throw new ConflictError(`Rate plan ${fresh.code} is ARCHIVED; cannot update commercial restrictions`);
      if (fresh.product.status === "ARCHIVED") throw new ConflictError(`Product ${fresh.product.code} is ARCHIVED`);
      if (actor.role === RoleCode.PARTNER && fresh.product.status !== "DRAFT") {
        throw new ConflictError(`Product ${fresh.product.code} is ${fresh.product.status}; PARTNER can only manage restrictions of DRAFT products`);
      }
      if (validated.scope === "PERIOD") {
        const period = await tx.commercialPeriod.findUnique({
          where: { id: commercialPeriodId! },
          select: { id: true, tariffId: true, status: true, code: true },
        });
        if (!period || period.tariffId !== current.tariffId) {
          throw new ValidationDomainError(`Commercial period ${commercialPeriodId} does not belong to rate plan ${fresh.code}`);
        }
        if (period.status !== "ACTIVE") {
          throw new ConflictError(`Commercial period ${period.code} is ${period.status}; attach restrictions to ACTIVE periods only`);
        }
      }
      await this.assertNoConflict(tx, current.tariffId, validated, id);
      this.assertMinStayVsBaseMax(fresh, validated);
      await this.assertCategorySupported(tx, fresh, validated.type);

      const res = await tx.commercialRestriction.updateMany({
        where: { id, status: { not: "ARCHIVED" }, version: current.version },
        data: {
          scope: validated.scope,
          commercialPeriodId,
          startDate: validated.startDate,
          endDate: validated.endDate,
          type: validated.type,
          value: validated.value,
          version: { increment: 1 },
        },
      });
      if (res.count === 0) {
        const freshRow = await tx.commercialRestriction.findUniqueOrThrow({ where: { id }, select: { code: true, status: true, version: true } });
        if (freshRow.status === "ARCHIVED") throw new ConflictError(`Commercial restriction ${freshRow.code} is ARCHIVED; cannot update`);
        throw new ConflictError(`Commercial restriction ${freshRow.code} was modified concurrently; retry (version ${freshRow.version} — lost-update protected)`);
      }
      const updated = await tx.commercialRestriction.findUniqueOrThrow({ where: { id } });
      await tx.commercialRestrictionHistory.create({
        data: {
          restrictionId: id,
          version: updated.version,
          action: "updated",
          from: current.status,
          to: current.status,
          fields: toJson({
            scope: input.scope !== undefined ? validated.scope : undefined,
            type: input.type !== undefined ? validated.type : undefined,
            value: input.value !== undefined ? validated.value : undefined,
            commercialPeriodId: input.commercialPeriodId !== undefined ? commercialPeriodId : undefined,
          }),
          actorId: actor.id,
          actorName: actor.username,
          comment: "Commercial restriction updated",
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "rate_plan.restriction.updated",
        resource: "CommercialRestriction",
        resourceId: id,
        details: { code: current.code, tariffId: current.tariffId, type: validated.type },
      });
      return updated;
    });

    return this.toView(row);
  }

  // ── Lifecycle (soft, staff catalog.rate_plan.publish) ─────────────────────

  async archive(id: string, actor: AuthUser) {
    const current = await this.findRestriction(id, actor);
    this.policy.assertCanManage(actor, current.tariff.product.partnerId, "catalog.rate_plan.publish");
    if (current.status === "ARCHIVED") return this.toView(current);

    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockTariff(tx, current.tariffId);
      const res = await tx.commercialRestriction.updateMany({
        where: { id, status: { not: "ARCHIVED" } },
        data: { status: "ARCHIVED", version: { increment: 1 }, archivedAt: new Date() },
      });
      if (res.count === 0) return tx.commercialRestriction.findUniqueOrThrow({ where: { id } });
      const updated = await tx.commercialRestriction.findUniqueOrThrow({ where: { id } });
      await tx.commercialRestrictionHistory.create({
        data: {
          restrictionId: id,
          version: updated.version,
          action: "archived",
          from: current.status,
          to: "ARCHIVED",
          actorId: actor.id,
          actorName: actor.username,
          comment: "Commercial restriction archived (soft; resolver ignores ARCHIVED)",
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "rate_plan.restriction.archived",
        resource: "CommercialRestriction",
        resourceId: id,
        details: { code: updated.code, tariffId: updated.tariffId, type: updated.type },
      });
      return updated;
    });
    this.logger.log(`Commercial restriction ${row.code} archived`);
    return this.toView(row);
  }

  async activate(id: string, actor: AuthUser) {
    const current = await this.findRestriction(id, actor);
    this.policy.assertCanManage(actor, current.tariff.product.partnerId, "catalog.rate_plan.publish");
    if (current.status === "ACTIVE") return this.toView(current);

    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockTariff(tx, current.tariffId);
      // Parent-eligibility (STRICT REVIEW §44/§51): активация НЕ должна вернуть
      // ACTIVE restriction под ineligible parent (ARCHIVED Rate Plan / ARCHIVED
      // Product / ARCHIVED период для PERIOD-scope) — restriction невидимо
      // «просыпается» только вместе с живым коммерческим контекстом.
      const fresh = await tx.tariff.findUniqueOrThrow({
        where: { id: current.tariffId },
        select: { id: true, code: true, status: true, product: { select: { code: true, status: true } } },
      });
      if (fresh.status === "ARCHIVED") {
        throw new ConflictError(`Rate plan ${fresh.code} is ARCHIVED; cannot activate commercial restrictions (activate plan first)`);
      }
      if (fresh.product.status === "ARCHIVED") {
        throw new ConflictError(`Product ${fresh.product.code} is ARCHIVED; cannot activate commercial restrictions`);
      }
      if (current.scope === "PERIOD" && current.commercialPeriodId) {
        const period = await tx.commercialPeriod.findUnique({
          where: { id: current.commercialPeriodId },
          select: { code: true, status: true },
        });
        if (!period || period.status !== "ACTIVE") {
          throw new ConflictError(`Commercial period ${period?.code ?? current.commercialPeriodId} is not ACTIVE; cannot activate PERIOD-scope restriction`);
        }
      }
      const res = await tx.commercialRestriction.updateMany({
        where: { id, status: "ARCHIVED" },
        data: { status: "ACTIVE", version: { increment: 1 }, archivedAt: null },
      });
      if (res.count === 0) return tx.commercialRestriction.findUniqueOrThrow({ where: { id } });
      // Re-validate conflict при reactivation: same-tier место не могло быть
      // занято (resolver ambiguity недопустима).
      const candidate: ValidatedRestrictionInput = {
        scope: current.scope,
        type: current.type,
        value: current.value,
        startDate: current.startDate,
        endDate: current.endDate,
      };
      await this.assertNoConflict(tx, current.tariffId, candidate, id);
      const updated = await tx.commercialRestriction.findUniqueOrThrow({ where: { id } });
      await tx.commercialRestrictionHistory.create({
        data: {
          restrictionId: id,
          version: updated.version,
          action: "activated",
          from: "ARCHIVED",
          to: "ACTIVE",
          actorId: actor.id,
          actorName: actor.username,
          comment: "Commercial restriction re-activated",
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "rate_plan.restriction.activated",
        resource: "CommercialRestriction",
        resourceId: id,
        details: { code: updated.code, tariffId: updated.tariffId, type: updated.type },
      });
      return updated;
    });
    this.logger.log(`Commercial restriction ${row.code} activated`);
    return this.toView(row);
  }
}

// Re-export для контроллера (forbidden keys).
export { COMMERCIAL_RESTRICTION_FORBIDDEN_KEYS, RESTRICTION_TYPE_VALUES };
