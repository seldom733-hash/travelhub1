import { Injectable, Logger } from "@nestjs/common";
import { Prisma, type CommercialPeriodKind } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { CatalogAccessPolicy } from "./catalog-access.policy";
import { RoleCode } from "../../generated/prisma/enums";
import type { AuthUser } from "../../security/auth/auth.service";
import {
  COMMERCIAL_PERIOD_CREATE_FORBIDDEN_KEYS,
  PERIOD_BULK_MAX_ROWS,
  PERIOD_MAX_PRICE,
  PERIOD_RANGE_MAX_DAYS,
  validatePeriodInput,
  type ValidatedPeriodInput,
} from "./period.validation";
import { samePriorityOverlap, type PeriodRow } from "./period-resolution";

const toJson = (v: Record<string, unknown>): Prisma.InputJsonValue => v as unknown as Prisma.InputJsonValue;

export interface CreatePeriodInput {
  kind?: string;
  startDate?: string;
  endDate?: string;
  dayOfWeek?: number[];
  price?: number;
  sellable?: boolean;
}

export interface UpdatePeriodInput {
  kind?: string;
  startDate?: string;
  endDate?: string;
  dayOfWeek?: number[];
  price?: number;
  sellable?: boolean;
}

interface TariffWithProduct {
  id: string;
  code: string;
  status: string;
  pricingMode: string;
  product: { id: string; code: string; partnerId: string | null; status: string };
}

/**
 * PHASE 1 STEP 1.8C — CommercialPeriod (period pricing & period availability
 * foundation) — Catalog owner (DD-026/DD-027).
 *
 * Канонический граф: Product → ServiceUnit → Tariff/Rate Plan → CommercialPeriod.
 * Инварианты:
 *  - ownership: период принадлежит Tariff (partnerId наследуется из Product через
 *    object-scope CatalogAccessPolicy); PARTNER — только СВОИ (DRAFT Product, как
 *    1.8B «PARTNER правит draft»); staff/ADMIN — любые не-ARCHIVED;
 *  - валюта НЕ дублируется: период наследует валюту Tariff (§10);
 *  - POR: числовая периодная цена для PRICE_ON_REQUEST плана запрещена (422, §35);
 *  - overlap: same-priority пересечение → 422 (DD-026 §3.6); advisory lock на
 *    Tariff сериализует concurrent create (нет гонки «два одинаковых периода»);
 *  - lifecycle: soft ACTIVE/ARCHIVED (archive = снятие, idempotent); физическое
 *    удаление запрещено (history Restrict); resolver игнорирует ARCHIVED;
 *  - update: version-CAS (lost-update §47, как 1.8B §39);
 *  - НИКАКИХ Quote/Sale/hold/резерваций/1.8D enforcement/времён (2.8A);
 *  - событий нет (нет consumers).
 */
@Injectable()
export class CommercialPeriodService {
  private readonly logger = new Logger(CommercialPeriodService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
    private readonly policy: CatalogAccessPolicy,
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
      include: { product: { select: { id: true, code: true, partnerId: true, status: true } } },
    });
    if (!tariff) throw new NotFoundError(`Rate plan ${id} not found`);
    if (actor.role === RoleCode.PARTNER) {
      this.policy.assertCanManage(actor, tariff.product.partnerId, this.readPermission(actor));
    } else {
      this.policy.assertCanRead(actor, tariff.product.partnerId);
    }
    return tariff;
  }

  /** Own-scope период lookup. */
  private async findPeriod(id: string, actor: AuthUser) {
    const period = await this.prisma.commercialPeriod.findUnique({
      where: { id },
      include: { tariff: { include: { product: { select: { id: true, partnerId: true } } } } },
    });
    if (!period) throw new NotFoundError(`Commercial period ${id} not found`);
    if (actor.role === RoleCode.PARTNER) {
      this.policy.assertCanManage(actor, period.tariff.product.partnerId, this.readPermission(actor));
    } else {
      this.policy.assertCanRead(actor, period.tariff.product.partnerId);
    }
    return period;
  }

  /**
   * Advisory lock на Tariff (сериализация period-мутаций): два concurrent create
   * одинаковых same-priority периодов не могут оба пройти overlap-валидацию
   * (READ COMMITTED без lock допустил бы оба INSERT). pg_advisory_xact_lock
   * освобождается автоматически по commit/rollback.
   */
  private async lockTariff(tx: Prisma.TransactionClient, tariffId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`catalog:period:${tariffId}`}))`;
  }

  /** Parent-eligibility: Tariff ACTIVE, Product не ARCHIVED, PARTNER → DRAFT. */
  private assertEligible(tariff: TariffWithProduct, actor: AuthUser, op: string): void {
    if (tariff.status === "ARCHIVED") {
      throw new ConflictError(`Rate plan ${tariff.code} is ARCHIVED; cannot ${op} commercial periods (activate first)`);
    }
    if (tariff.product.status === "ARCHIVED") {
      throw new ConflictError(`Product ${tariff.product.code} is ARCHIVED; cannot ${op} commercial periods`);
    }
    if (tariff.pricingMode === "PRICE_ON_REQUEST") {
      throw new ValidationDomainError(
        `Rate plan ${tariff.code} is PRICE_ON_REQUEST (inquiry-only); numeric period prices are not allowed (§35)`,
      );
    }
    if (actor.role === RoleCode.PARTNER && tariff.product.status !== "DRAFT") {
      throw new ConflictError(
        `Product ${tariff.product.code} is ${tariff.product.status}; PARTNER can only manage periods of DRAFT products`,
      );
    }
  }

  /** Same-priority overlap против существующих ACTIVE периодов Tariff. */
  private assertNoOverlap(periods: PeriodRow[], candidate: PeriodRow, context: string): void {
    for (const p of periods) {
      if (samePriorityOverlap(p, candidate)) {
        throw new ValidationDomainError(
          `${context}: period ${p.code} (${p.kind} ${p.startDate.toISOString().slice(0, 10)}..${p.endDate.toISOString().slice(0, 10)}) overlaps with equal specificity — overlapping same-priority periods are forbidden (DD-026)`,
        );
      }
    }
  }

  private toRow(candidate: ValidatedPeriodInput, existing: PeriodRow[]): PeriodRow {
    return {
      id: "new",
      code: "new",
      kind: candidate.kind,
      startDate: candidate.startDate,
      endDate: candidate.endDate,
      dayOfWeek: candidate.dayOfWeek,
      price: { toNumber: () => candidate.price, toString: () => candidate.price.toFixed(2) },
      sellable: candidate.sellable,
      createdAt: new Date(),
    };
  }

  /** Прямое создание периода внутри tx (shared create/bulk logic). */
  private async createPeriodInTx(
    tx: Prisma.TransactionClient,
    tariff: TariffWithProduct,
    input: ValidatedPeriodInput,
    actor: AuthUser,
  ): Promise<{ id: string; code: string }> {
    const existing = (await tx.commercialPeriod.findMany({
      where: { tariffId: tariff.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    })) as unknown as PeriodRow[];
    this.assertNoOverlap(existing, this.toRow(input, existing), `Rate plan ${tariff.code}`);
    const code = await this.ids.nextCode(tx, "CPR");
    const created = await tx.commercialPeriod.create({
      data: {
        code,
        tariffId: tariff.id,
        kind: input.kind,
        startDate: input.startDate,
        endDate: input.endDate,
        dayOfWeek: input.dayOfWeek,
        price: new Prisma.Decimal(input.price.toFixed(2)),
        sellable: input.sellable,
        status: "ACTIVE",
        version: 1,
      },
    });
    await tx.commercialPeriodHistory.create({
      data: {
        periodId: created.id,
        version: 1,
        action: "created",
        to: "ACTIVE",
        actorId: actor.id,
        actorName: actor.username,
        comment: "Commercial period created",
      },
    });
    await this.security.audit(tx, {
      userId: actor.id,
      username: actor.username,
      action: "rate_plan.period.created",
      resource: "CommercialPeriod",
      resourceId: created.id,
      details: { code, tariffId: tariff.id, kind: input.kind, startDate: input.startDate.toISOString().slice(0, 10), endDate: input.endDate.toISOString().slice(0, 10), price: input.price, sellable: input.sellable },
    });
    return { id: created.id, code };
  }

  /** Проверка диапазона на защитный лимит (не frozen business limit). */
  private assertRangeBounds(input: ValidatedPeriodInput): void {
    const days = Math.floor((input.endDate.getTime() - input.startDate.getTime()) / 86_400_000) + 1;
    if (days > PERIOD_RANGE_MAX_DAYS) {
      throw new ValidationDomainError(`Period range exceeds the ${PERIOD_RANGE_MAX_DAYS}-day safety limit`);
    }
  }

  // ── Create (single) ──────────────────────────────────────────────────────

  async create(tariffId: string, input: CreatePeriodInput, actor: AuthUser) {
    const validated = validatePeriodInput(input);
    this.assertRangeBounds(validated);
    const tariff = await this.findTariffWithProduct(tariffId, actor);
    this.policy.assertCanManage(actor, tariff.product.partnerId, this.managePermission(actor));
    this.assertEligible(tariff, actor, "create");

    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockTariff(tx, tariffId);
      // Fresh re-read внутри tx (authoritative status/pricingMode — не stale).
      const fresh = await tx.tariff.findUniqueOrThrow({
        where: { id: tariffId },
        include: { product: { select: { id: true, code: true, partnerId: true, status: true } } },
      });
      if (fresh.status === "ARCHIVED") throw new ConflictError(`Rate plan ${fresh.code} is ARCHIVED; cannot create commercial periods`);
      if (fresh.product.status === "ARCHIVED") throw new ConflictError(`Product ${fresh.product.code} is ARCHIVED`);
      if (fresh.pricingMode === "PRICE_ON_REQUEST") {
        throw new ValidationDomainError(`Rate plan ${fresh.code} is PRICE_ON_REQUEST; numeric period prices are not allowed`);
      }
      return this.createPeriodInTx(tx, fresh, validated, actor);
    });

    this.logger.log(`Commercial period ${result.code} created under rate plan ${tariffId}`);
    return this.get(result.id, actor);
  }

  // ── Bulk (annual calendar) ───────────────────────────────────────────────

  /**
   * Annual-calendar bulk create: all-or-nothing (один tx + advisory lock).
   * Валидация каждого ряда + cross-batch overlap ДО создания; ownership
   * проверяется один раз authoritative, каждый ряд — через createPeriodInTx
   * (имеющий свою same-priority проверку против уже созданных в batch).
   */
  async bulkCreate(tariffId: string, inputs: CreatePeriodInput[], actor: AuthUser) {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new ValidationDomainError("bulk payload must be a non-empty array of periods");
    }
    if (inputs.length > PERIOD_BULK_MAX_ROWS) {
      throw new ValidationDomainError(`bulk create supports at most ${PERIOD_BULK_MAX_ROWS} periods per request`);
    }
    const validated = inputs.map((i) => validatePeriodInput(i));
    for (const v of validated) this.assertRangeBounds(v);

    const tariff = await this.findTariffWithProduct(tariffId, actor);
    this.policy.assertCanManage(actor, tariff.product.partnerId, this.managePermission(actor));
    this.assertEligible(tariff, actor, "bulk create");

    const created: Array<{ id: string; code: string }> = await this.prisma.$transaction(async (tx) => {
      await this.lockTariff(tx, tariffId);
      const fresh = await tx.tariff.findUniqueOrThrow({
        where: { id: tariffId },
        include: { product: { select: { id: true, code: true, partnerId: true, status: true } } },
      });
      if (fresh.status === "ARCHIVED") throw new ConflictError(`Rate plan ${fresh.code} is ARCHIVED; cannot create commercial periods`);
      if (fresh.product.status === "ARCHIVED") throw new ConflictError(`Product ${fresh.product.code} is ARCHIVED`);
      if (fresh.pricingMode === "PRICE_ON_REQUEST") {
        throw new ValidationDomainError(`Rate plan ${fresh.code} is PRICE_ON_REQUEST; numeric period prices are not allowed`);
      }
      const rows: Array<{ id: string; code: string }> = [];
      for (const v of validated) {
        rows.push(await this.createPeriodInTx(tx, fresh, v, actor));
      }
      return rows;
    });

    this.logger.log(`Bulk created ${created.length} commercial periods under rate plan ${tariffId}`);
    return { created: created.length, items: created };
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  async listForTariff(tariffId: string, actor: AuthUser, limit: number, offset: number, status?: string) {
    await this.findTariffWithProduct(tariffId, actor);
    const statusFilter = status === "ARCHIVED" || status === "ACTIVE" ? (status as "ACTIVE" | "ARCHIVED") : undefined;
    const where = {
      tariffId,
      ...(statusFilter ? { status: statusFilter } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.commercialPeriod.findMany({
        where,
        orderBy: [{ startDate: "asc" }, { endDate: "asc" }, { createdAt: "asc" }],
        skip: offset,
        take: limit,
      }),
      this.prisma.commercialPeriod.count({ where }),
    ]);
    return { items: items.map((r) => this.toView(r)), total };
  }

  async get(id: string, actor: AuthUser) {
    return this.toView(await this.findPeriod(id, actor));
  }

  async history(id: string, actor: AuthUser) {
    await this.findPeriod(id, actor);
    const rows = await this.prisma.commercialPeriodHistory.findMany({
      where: { periodId: id },
      orderBy: { createdAt: "desc" },
    });
    return { items: rows };
  }

  private toView(row: {
    id: string;
    code: string;
    tariffId: string;
    kind: CommercialPeriodKind;
    startDate: Date;
    endDate: Date;
    dayOfWeek: number[];
    price: Prisma.Decimal;
    sellable: boolean;
    status: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      code: row.code,
      tariffId: row.tariffId,
      kind: row.kind,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      dayOfWeek: row.dayOfWeek,
      price: row.price.toFixed(2),
      sellable: row.sellable,
      status: row.status,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // ── Update (version-CAS) ─────────────────────────────────────────────────

  async update(id: string, input: UpdatePeriodInput, actor: AuthUser) {
    const current = await this.findPeriod(id, actor);
    this.policy.assertCanManage(actor, current.tariff.product.partnerId, this.managePermission(actor));
    if (current.status === "ARCHIVED") {
      throw new ConflictError(`Commercial period ${current.code} is ARCHIVED; cannot update (activate first)`);
    }

    // Частичный update: применяем только переданные поля, остальные — из current.
    const validated = validatePeriodInput({
      kind: input.kind ?? current.kind,
      startDate: input.startDate ?? current.startDate.toISOString().slice(0, 10),
      endDate: input.endDate ?? current.endDate.toISOString().slice(0, 10),
      dayOfWeek: input.dayOfWeek ?? current.dayOfWeek,
      price: input.price ?? Number(current.price),
      sellable: input.sellable ?? current.sellable,
    });
    this.assertRangeBounds(validated);

    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockTariff(tx, current.tariffId);
      const tariff = await tx.tariff.findUniqueOrThrow({
        where: { id: current.tariffId },
        include: { product: { select: { id: true, code: true, partnerId: true, status: true } } },
      });
      if (tariff.status === "ARCHIVED") throw new ConflictError(`Rate plan ${tariff.code} is ARCHIVED; cannot update commercial periods`);
      if (tariff.product.status === "ARCHIVED") throw new ConflictError(`Product ${tariff.product.code} is ARCHIVED`);
      if (tariff.pricingMode === "PRICE_ON_REQUEST") {
        throw new ValidationDomainError(`Rate plan ${tariff.code} is PRICE_ON_REQUEST; numeric period prices are not allowed`);
      }
      if (actor.role === RoleCode.PARTNER && tariff.product.status !== "DRAFT") {
        throw new ConflictError(`Product ${tariff.product.code} is ${tariff.product.status}; PARTNER can only manage periods of DRAFT products`);
      }

      // Same-priority overlap против других ACTIVE периодов (исключая self).
      const others = (await tx.commercialPeriod.findMany({
        where: { tariffId: current.tariffId, status: "ACTIVE", id: { not: id } },
        orderBy: { createdAt: "asc" },
      })) as unknown as PeriodRow[];
      this.assertNoOverlap(others, this.toRow(validated, others), `Rate plan ${tariff.code}`);

      const res = await tx.commercialPeriod.updateMany({
        where: { id, status: { not: "ARCHIVED" }, version: current.version },
        data: {
          kind: validated.kind,
          startDate: validated.startDate,
          endDate: validated.endDate,
          dayOfWeek: validated.dayOfWeek,
          price: new Prisma.Decimal(validated.price.toFixed(2)),
          sellable: validated.sellable,
          version: { increment: 1 },
        },
      });
      if (res.count === 0) {
        const fresh = await tx.commercialPeriod.findUniqueOrThrow({ where: { id }, select: { code: true, status: true, version: true } });
        if (fresh.status === "ARCHIVED") throw new ConflictError(`Commercial period ${fresh.code} is ARCHIVED; cannot update`);
        throw new ConflictError(`Commercial period ${fresh.code} was modified concurrently; retry (version ${fresh.version} — lost-update protected)`);
      }
      const updated = await tx.commercialPeriod.findUniqueOrThrow({ where: { id } });
      await tx.commercialPeriodHistory.create({
        data: {
          periodId: id,
          version: updated.version,
          action: "updated",
          from: current.status,
          to: current.status,
          fields: toJson({
            kind: input.kind !== undefined ? validated.kind : undefined,
            startDate: input.startDate !== undefined ? validated.startDate.toISOString().slice(0, 10) : undefined,
            endDate: input.endDate !== undefined ? validated.endDate.toISOString().slice(0, 10) : undefined,
            price: input.price !== undefined ? validated.price : undefined,
            sellable: input.sellable !== undefined ? validated.sellable : undefined,
          }),
          actorId: actor.id,
          actorName: actor.username,
          comment: "Commercial period updated",
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "rate_plan.period.updated",
        resource: "CommercialPeriod",
        resourceId: id,
        details: { code: current.code, tariffId: current.tariffId },
      });
      return updated;
    });

    return this.toView(row);
  }

  // ── Lifecycle (soft, staff catalog.rate_plan.publish) ───────────────────

  async archive(id: string, actor: AuthUser) {
    const current = await this.findPeriod(id, actor);
    this.policy.assertCanManage(actor, current.tariff.product.partnerId, "catalog.rate_plan.publish");
    if (current.status === "ARCHIVED") return this.toView(current);

    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockTariff(tx, current.tariffId);
      const res = await tx.commercialPeriod.updateMany({
        where: { id, status: { not: "ARCHIVED" } },
        data: { status: "ARCHIVED", version: { increment: 1 } },
      });
      if (res.count === 0) return tx.commercialPeriod.findUniqueOrThrow({ where: { id } });
      const updated = await tx.commercialPeriod.findUniqueOrThrow({ where: { id } });
      await tx.commercialPeriodHistory.create({
        data: {
          periodId: id,
          version: updated.version,
          action: "archived",
          from: current.status,
          to: "ARCHIVED",
          actorId: actor.id,
          actorName: actor.username,
          comment: "Commercial period archived (soft; resolver ignores ARCHIVED)",
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "rate_plan.period.archived",
        resource: "CommercialPeriod",
        resourceId: id,
        details: { code: updated.code, tariffId: updated.tariffId },
      });
      return updated;
    });
    this.logger.log(`Commercial period ${row.code} archived`);
    return this.toView(row);
  }

  async activate(id: string, actor: AuthUser) {
    const current = await this.findPeriod(id, actor);
    this.policy.assertCanManage(actor, current.tariff.product.partnerId, "catalog.rate_plan.publish");
    if (current.status === "ACTIVE") return this.toView(current);

    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockTariff(tx, current.tariffId);
      const res = await tx.commercialPeriod.updateMany({
        where: { id, status: "ARCHIVED" },
        data: { status: "ACTIVE", version: { increment: 1 } },
      });
      if (res.count === 0) return tx.commercialPeriod.findUniqueOrThrow({ where: { id } });
      // Re-validate overlap при reactivation: другой same-priority период не мог
      // занять это место (resolver ambiguity недопустима).
      const others = (await tx.commercialPeriod.findMany({
        where: { tariffId: current.tariffId, status: "ACTIVE", id: { not: id } },
        orderBy: { createdAt: "asc" },
      })) as unknown as PeriodRow[];
      const revived = { ...current, status: "ACTIVE" as const };
      const selfRow: PeriodRow = {
        id: revived.id,
        code: revived.code,
        kind: revived.kind,
        startDate: revived.startDate,
        endDate: revived.endDate,
        dayOfWeek: revived.dayOfWeek,
        price: revived.price,
        sellable: revived.sellable,
        createdAt: revived.createdAt,
      };
      this.assertNoOverlap(others, selfRow, `Rate plan ${current.tariffId}`);
      const updated = await tx.commercialPeriod.findUniqueOrThrow({ where: { id } });
      await tx.commercialPeriodHistory.create({
        data: {
          periodId: id,
          version: updated.version,
          action: "activated",
          from: "ARCHIVED",
          to: "ACTIVE",
          actorId: actor.id,
          actorName: actor.username,
          comment: "Commercial period re-activated",
        },
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "rate_plan.period.activated",
        resource: "CommercialPeriod",
        resourceId: id,
        details: { code: updated.code, tariffId: updated.tariffId },
      });
      return updated;
    });
    this.logger.log(`Commercial period ${row.code} activated`);
    return this.toView(row);
  }
}
