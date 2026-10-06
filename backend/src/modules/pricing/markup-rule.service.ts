/**
 * Supplier Markup (STRICT PROMPT §6/§7, design §3) — MarkupRuleService.
 *
 * Scope: master data finance.MarkupRule (MKR-*) — ЕДИНСТВЕННЫЙ authority наценки
 * платформы на supplier live price. ОТДЕЛЬНАЯ концепция от CommissionPolicy
 * (Gate B): CommissionPolicy/seller commission НЕ трогаем.
 *
 * Matching key: supplierCode + serviceType (registry SSOT — SupplierAdapterRegistry
 * + FlightSupplierRegistry; новые supplier/service появляются без миграции, Gate A).
 *
 * Инварианты / hard gates:
 *  - lifecycle DRAFT → ACTIVE → ARCHIVED (CAS from-guard): update ТОЛЬКО в DRAFT
 *    (ACTIVE/ARCHIVED immutable — новая ставка = новая rule); activate проверяет
 *    overlap-инвариант (≤1 ACTIVE rule на key с пересекающимся effective-окном)
 *    под pg_advisory_xact_lock('markup-rule:'||supplierCode||':'||serviceType) —
 *    concurrent conflicting activate → контролируемый 409, без raw 500;
 *  - rate: десятичная доля 0 ≤ rate < 1 (0.05 = 5%), ≤ 6 знаков; явный «0»
 *    валиден (explicit 0%, отличим от NOT_CONFIGURED);
 *  - resolver: детерминированный; 0 активных → NOT_CONFIGURED (runtime 0%);
 *    >1 (невозможно при lock-инварианте, backstop) → fail-closed NOT_CONFIGURED
 *    + warn (не «первая строка»);
 *  - optimistic concurrency: update с expectedVersion → stale → 409 (§32);
 *  - каждая мутация — MarkupRuleHistory (state snapshot на версию) + AuditLog
 *    (PII-free).
 */
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { MarkupRuleStatus } from "../../generated/prisma/enums";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { isUniqueViolation } from "../../shared/prisma-errors";
import { validateMarkupRate, validateServiceType, validateSupplierCode } from "./pricing.validation";

interface Actor {
  id: string;
  username: string;
}

/** Resolution-результат: configured-правило ИЛИ явный NOT_CONFIGURED. */
export type MarkupRuleResolution =
  | { found: true; rate: Prisma.Decimal; ruleCode: string; ruleVersion: number }
  | { found: false };

type MarkupRuleRow = {
  id: string;
  code: string;
  supplierCode: string;
  serviceType: string;
  rate: Prisma.Decimal;
  status: MarkupRuleStatus;
  version: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class MarkupRuleService {
  private readonly logger = new Logger(MarkupRuleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
  ) {}

  // ── Create (DRAFT) ─────────────────────────────────────────────────────────

  /**
   * Создание MarkupRule (DRAFT, version 1). effectiveFrom default = now
   * (server-owned). DRAFT не селектируема → overlap на create не проверяется
   * (инвариант — на activate).
   */
  async create(
    input: { supplierCode: string; serviceType: string; rate: string; effectiveFrom?: string; effectiveTo?: string },
    actor: Actor,
  ): Promise<Record<string, unknown>> {
    const supplierCode = validateSupplierCode(input.supplierCode);
    const serviceType = validateServiceType(input.serviceType);
    const rate = validateMarkupRate(input.rate);
    const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : new Date();
    const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;
    if (Number.isNaN(effectiveFrom.getTime()) || (effectiveTo !== null && Number.isNaN(effectiveTo.getTime()))) {
      throw new ValidationDomainError("markup rule effective period must be valid ISO 8601 instants");
    }
    if (effectiveTo !== null && effectiveTo <= effectiveFrom) {
      throw new ValidationDomainError("markup rule effective period: effectiveTo must be after effectiveFrom");
    }

    return this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "MKR");
      try {
        const row = await tx.markupRule.create({
          data: {
            code,
            supplierCode,
            serviceType,
            rate: new Prisma.Decimal(rate),
            status: MarkupRuleStatus.DRAFT,
            version: 1,
            effectiveFrom,
            effectiveTo,
          },
        });
        await this.writeHistory(tx, row, "created", actor, `Rule создана (DRAFT v1) для ${supplierCode} + ${serviceType}`);
        await this.security.audit(tx, { action: "pricing.markup_rule.created", resource: "MarkupRule", resourceId: row.id, details: { code, supplierCode, serviceType, rate } });
        return this.ruleDto(row);
      } catch (err) {
        if (isUniqueViolation(err)) throw new ConflictError(`MarkupRule code collision — retry`);
        throw err;
      }
    });
  }

  // ── Update (DRAFT only, version bump, optimistic concurrency) ──────────────

  async update(
    code: string,
    input: { rate?: string; effectiveFrom?: string; effectiveTo?: string | null; expectedVersion?: number },
    actor: Actor,
  ): Promise<Record<string, unknown>> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.markupRule.findUnique({ where: { code } });
      if (!existing) throw new NotFoundError(`MarkupRule ${code} not found`);
      await this.lockKey(tx, existing.supplierCode, existing.serviceType);
      const fresh = await tx.markupRule.findUniqueOrThrow({ where: { id: existing.id } });
      if (input.expectedVersion !== undefined && fresh.version !== input.expectedVersion) {
        throw new ConflictError(`MarkupRule ${code} was modified concurrently (expected v${input.expectedVersion}, current v${fresh.version}) — reload and retry`);
      }
      if (fresh.status !== MarkupRuleStatus.DRAFT) {
        throw new ValidationDomainError(`MarkupRule ${code} is ${fresh.status} — update allowed only in DRAFT (create a new rule for changes)`);
      }

      const rate = input.rate !== undefined ? validateMarkupRate(input.rate) : undefined;
      const effectiveFrom = input.effectiveFrom !== undefined ? new Date(input.effectiveFrom) : undefined;
      const effectiveTo = input.effectiveTo !== undefined ? (input.effectiveTo ? new Date(input.effectiveTo) : null) : undefined;
      const from = effectiveFrom ?? fresh.effectiveFrom;
      const to = effectiveTo !== undefined ? effectiveTo : fresh.effectiveTo;
      if (to !== null && to <= from) {
        throw new ValidationDomainError("markup rule effective period: effectiveTo must be after effectiveFrom");
      }

      const row = await tx.markupRule.update({
        where: { id: fresh.id },
        data: {
          ...(rate !== undefined ? { rate: new Prisma.Decimal(rate) } : {}),
          ...(effectiveFrom !== undefined ? { effectiveFrom } : {}),
          ...(effectiveTo !== undefined ? { effectiveTo } : {}),
          version: { increment: 1 },
        },
      });
      await this.writeHistory(tx, row, "updated", actor, `Rule обновлена (DRAFT v${row.version})`);
      await this.security.audit(tx, { action: "pricing.markup_rule.updated", resource: "MarkupRule", resourceId: row.id, details: { code, version: row.version } });
      return this.ruleDto(row);
    });
  }

  // ── Activate (DRAFT → ACTIVE, overlap-checked) ─────────────────────────────

  async activate(code: string, actor: Actor): Promise<Record<string, unknown>> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.markupRule.findUnique({ where: { code } });
      if (!existing) throw new NotFoundError(`MarkupRule ${code} not found`);
      await this.lockKey(tx, existing.supplierCode, existing.serviceType);
      const fresh = await tx.markupRule.findUniqueOrThrow({ where: { id: existing.id } });
      if (fresh.status === MarkupRuleStatus.ACTIVE) return this.ruleDto(fresh); // idempotent no-op
      if (fresh.status !== MarkupRuleStatus.DRAFT) {
        throw new ValidationDomainError(`MarkupRule ${code} is ${fresh.status} — cannot activate`);
      }

      await this.assertNoOverlap(tx, fresh);
      const row = await tx.markupRule.update({ where: { id: fresh.id }, data: { status: MarkupRuleStatus.ACTIVE } });
      await this.writeHistory(tx, row, "activated", actor, `Rule активирована (ACTIVE v${row.version})`);
      await this.security.audit(tx, { action: "pricing.markup_rule.activated", resource: "MarkupRule", resourceId: row.id, details: { code, version: row.version } });
      return this.ruleDto(row);
    });
  }

  // ── Archive (→ ARCHIVED, terminal) ─────────────────────────────────────────

  async archive(code: string, actor: Actor): Promise<Record<string, unknown>> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.markupRule.findUnique({ where: { code } });
      if (!existing) throw new NotFoundError(`MarkupRule ${code} not found`);
      await this.lockKey(tx, existing.supplierCode, existing.serviceType);
      const fresh = await tx.markupRule.findUniqueOrThrow({ where: { id: existing.id } });
      if (fresh.status === MarkupRuleStatus.ARCHIVED) return this.ruleDto(fresh); // idempotent no-op
      const row = await tx.markupRule.update({ where: { id: fresh.id }, data: { status: MarkupRuleStatus.ARCHIVED } });
      await this.writeHistory(tx, row, "archived", actor, `Rule архивирована (ARCHIVED)`);
      await this.security.audit(tx, { action: "pricing.markup_rule.archived", resource: "MarkupRule", resourceId: row.id, details: { code } });
      return this.ruleDto(row);
    });
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async list(query: { supplierCode?: string; serviceType?: string; status?: string; page?: number; pageSize?: number }): Promise<Record<string, unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.MarkupRuleWhereInput = {};
    if (query.supplierCode !== undefined) where.supplierCode = validateSupplierCode(query.supplierCode);
    if (query.serviceType !== undefined) where.serviceType = validateServiceType(query.serviceType);
    if (query.status !== undefined) {
      if (!Object.values(MarkupRuleStatus).includes(query.status as MarkupRuleStatus)) {
        throw new ValidationDomainError(`status must be one of: ${Object.values(MarkupRuleStatus).join(", ")}`);
      }
      where.status = query.status as MarkupRuleStatus;
    }
    const [rows, total] = await Promise.all([
      this.prisma.markupRule.findMany({ where, orderBy: [{ supplierCode: "asc" }, { serviceType: "asc" }, { effectiveFrom: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.markupRule.count({ where }),
    ]);
    return { items: rows.map((r) => this.ruleDto(r)), page, pageSize, total };
  }

  async getByCode(code: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.markupRule.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`MarkupRule ${code} not found`);
    return this.ruleDto(row);
  }

  async history(code: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.markupRule.findUnique({ where: { code }, select: { id: true } });
    if (!row) throw new NotFoundError(`MarkupRule ${code} not found`);
    const rows = await this.prisma.markupRuleHistory.findMany({ where: { ruleId: row.id }, orderBy: { createdAt: "desc" } });
    return {
      items: rows.map((h) => ({
        id: h.id,
        action: h.action,
        version: h.version,
        fields: h.fields,
        actorId: h.actorId,
        actorName: h.actorName,
        comment: h.comment,
        createdAt: h.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Детерминированный resolver (read path для SupplierPricingService).
   * 0 активных в окне → NOT_CONFIGURED (runtime 0%, design §3); >1 — backstop
   * fail-closed (overlap исключён lock-инвариантом activate).
   */
  async resolve(supplierCode: string, serviceType: string, at: Date = new Date()): Promise<MarkupRuleResolution> {
    const key = validateSupplierCode(supplierCode);
    const svc = validateServiceType(serviceType);
    const rows = await this.prisma.markupRule.findMany({
      where: {
        supplierCode: key,
        serviceType: svc,
        status: MarkupRuleStatus.ACTIVE,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: { effectiveFrom: "asc" },
    });
    if (rows.length === 0) return { found: false };
    if (rows.length > 1) {
      this.logger.warn(`MarkupRule AMBIGUOUS for ${key}+${svc} at ${at.toISOString()} — fail-closed NOT_CONFIGURED (${rows.length} overlapping ACTIVE rules)`);
      return { found: false };
    }
    return { found: true, rate: rows[0].rate, ruleCode: rows[0].code, ruleVersion: rows[0].version };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async lockKey(tx: Prisma.TransactionClient, supplierCode: string, serviceType: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`markup-rule:${supplierCode}:${serviceType}`}))`;
  }

  /** Overlap-инвариант: пересечение [aFrom, aTo) с [bFrom, bTo) ⇔ aFrom < bTo AND bFrom < aTo. */
  private async assertNoOverlap(tx: Prisma.TransactionClient, rule: { id: string; supplierCode: string; serviceType: string; effectiveFrom: Date; effectiveTo: Date | null }): Promise<void> {
    const to = rule.effectiveTo ?? new Date("9999-12-31T23:59:59.999Z");
    const conflicting = await tx.markupRule.findFirst({
      where: {
        id: { not: rule.id },
        supplierCode: rule.supplierCode,
        serviceType: rule.serviceType,
        status: MarkupRuleStatus.ACTIVE,
        effectiveFrom: { lt: to },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: rule.effectiveFrom } }],
      },
    });
    if (conflicting) {
      throw new ConflictError(`ACTIVE MarkupRule ${conflicting.code} already covers ${rule.supplierCode} + ${rule.serviceType} at this effective period — archive it first or choose a non-overlapping period`);
    }
  }

  private async writeHistory(
    tx: Prisma.TransactionClient,
    rule: MarkupRuleRow,
    action: string,
    actor: Actor,
    comment: string,
  ): Promise<void> {
    await tx.markupRuleHistory.create({
      data: {
        ruleId: rule.id,
        action,
        version: rule.version,
        fields: {
          code: rule.code,
          supplierCode: rule.supplierCode,
          serviceType: rule.serviceType,
          rate: rule.rate.toString(),
          status: rule.status,
          effectiveFrom: rule.effectiveFrom.toISOString(),
          effectiveTo: rule.effectiveTo ? rule.effectiveTo.toISOString() : null,
        },
        actorId: actor.id,
        actorName: actor.username,
        comment,
      },
    });
  }

  private ruleDto(p: MarkupRuleRow): Record<string, unknown> {
    return {
      id: p.id,
      code: p.code,
      supplierCode: p.supplierCode,
      serviceType: p.serviceType,
      rate: p.rate.toString(),
      status: p.status,
      version: p.version,
      effectiveFrom: p.effectiveFrom.toISOString(),
      effectiveTo: p.effectiveTo ? p.effectiveTo.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
