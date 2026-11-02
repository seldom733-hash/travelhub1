import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { MarkupRuleStatus } from "../../generated/prisma/enums";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { validateMarkupRate, validateServiceType, validateSupplierCode } from "./pricing.validation";

type Actor = { id: string; username: string };

export interface CommissionInput {
  supplierCode: string;
  serviceType: string;
  commissionType?: "PERCENT" | "FIXED";
  rate?: string;
  fixedAmount?: string;
  fixedCurrency?: string;
  calculationBase?: "SUPPLIER_BASE" | "STOREFRONT";
  effectiveFrom?: string;
  effectiveTo?: string;
}

@Injectable()
export class SupplierCommissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
  ) {}

  async list(query: { supplierCode?: string; serviceType?: string; status?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.SupplierCommissionRuleWhereInput = {};
    if (query.supplierCode) where.supplierCode = validateSupplierCode(query.supplierCode);
    if (query.serviceType) where.serviceType = validateServiceType(query.serviceType);
    if (query.status) where.status = query.status as MarkupRuleStatus;
    const [items, total] = await Promise.all([
      this.prisma.supplierCommissionRule.findMany({ where, orderBy: [{ supplierCode: "asc" }, { serviceType: "asc" }, { effectiveFrom: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.supplierCommissionRule.count({ where }),
    ]);
    return { items: items.map((row) => this.dto(row)), total, page, pageSize };
  }

  async create(input: CommissionInput, actor: Actor) {
    const supplierCode = validateSupplierCode(input.supplierCode);
    const serviceType = validateServiceType(input.serviceType);
    const commissionType = input.commissionType === "FIXED" ? "FIXED" : "PERCENT";
    const rate = commissionType === "PERCENT" ? validateMarkupRate(input.rate ?? "0") : null;
    const fixedAmount = commissionType === "FIXED" ? this.money(input.fixedAmount ?? "0", "fixedAmount") : null;
    const from = input.effectiveFrom ? new Date(input.effectiveFrom) : new Date();
    const to = input.effectiveTo ? new Date(input.effectiveTo) : null;
    if (to && to <= from) throw new ValidationDomainError("effectiveTo must be after effectiveFrom");
    return this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "CMR");
      const row = await tx.supplierCommissionRule.create({ data: { code, supplierCode, serviceType, commissionType, rate: rate ? new Prisma.Decimal(rate) : null, fixedAmount, fixedCurrency: input.fixedCurrency?.toUpperCase() ?? null, calculationBase: input.calculationBase === "STOREFRONT" ? "STOREFRONT" : "SUPPLIER_BASE", status: MarkupRuleStatus.DRAFT, effectiveFrom: from, effectiveTo: to } });
      await this.writeHistory(tx, row, actor, "Commission rule created (DRAFT)");
      await this.security.audit(tx, { action: "pricing.commission_rule.created", resource: "SupplierCommissionRule", resourceId: row.id, details: { code, supplierCode, serviceType } });
      return this.dto(row);
    });
  }

  async update(code: string, input: Partial<CommissionInput> & { expectedVersion?: number }, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.supplierCommissionRule.findUnique({ where: { code } });
      if (!row) throw new NotFoundError(`Commission rule ${code} not found`);
      if (row.status !== MarkupRuleStatus.DRAFT) throw new ValidationDomainError("Only DRAFT commission rules can be updated");
      if (input.expectedVersion != null && input.expectedVersion !== row.version) throw new ConflictError("Commission rule was modified concurrently");
      const type = input.commissionType ?? (row.commissionType as "PERCENT" | "FIXED");
      const rate = type === "PERCENT" ? validateMarkupRate(input.rate ?? row.rate?.toString() ?? "0") : null;
      const fixedAmount = type === "FIXED" ? this.money(input.fixedAmount ?? row.fixedAmount?.toString() ?? "0", "fixedAmount") : null;
      const updated = await tx.supplierCommissionRule.update({ where: { id: row.id }, data: { commissionType: type, rate: rate ? new Prisma.Decimal(rate) : null, fixedAmount, fixedCurrency: input.fixedCurrency?.toUpperCase() ?? row.fixedCurrency, calculationBase: input.calculationBase ?? row.calculationBase, effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : row.effectiveFrom, effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : row.effectiveTo, version: { increment: 1 } } });
      await this.writeHistory(tx, updated, actor, "Commission rule updated");
      await this.security.audit(tx, { action: "pricing.commission_rule.updated", resource: "SupplierCommissionRule", resourceId: row.id, details: { code, version: updated.version } });
      return this.dto(updated);
    });
  }

  async activate(code: string, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.supplierCommissionRule.findUnique({ where: { code } });
      if (!row) throw new NotFoundError(`Commission rule ${code} not found`);
      if (row.status === MarkupRuleStatus.ACTIVE) return this.dto(row);
      if (row.status !== MarkupRuleStatus.DRAFT) throw new ValidationDomainError("Only DRAFT commission rules can be activated");
      const conflict = await tx.supplierCommissionRule.count({ where: { id: { not: row.id }, supplierCode: row.supplierCode, serviceType: row.serviceType, status: MarkupRuleStatus.ACTIVE, effectiveFrom: { lt: row.effectiveTo ?? new Date("2999-01-01") }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: row.effectiveFrom } }] } });
      if (conflict > 0) throw new ConflictError("Another active commission rule overlaps this period");
      const updated = await tx.supplierCommissionRule.update({ where: { id: row.id }, data: { status: MarkupRuleStatus.ACTIVE } });
      await this.writeHistory(tx, updated, actor, "Commission rule activated");
      await this.security.audit(tx, { action: "pricing.commission_rule.activated", resource: "SupplierCommissionRule", resourceId: row.id, details: { code } });
      return this.dto(updated);
    });
  }

  async archive(code: string, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.supplierCommissionRule.findUnique({ where: { code } });
      if (!row) throw new NotFoundError(`Commission rule ${code} not found`);
      if (row.status === MarkupRuleStatus.ARCHIVED) return this.dto(row);
      const updated = await tx.supplierCommissionRule.update({ where: { id: row.id }, data: { status: MarkupRuleStatus.ARCHIVED } });
      await this.writeHistory(tx, updated, actor, "Commission rule archived");
      await this.security.audit(tx, { action: "pricing.commission_rule.archived", resource: "SupplierCommissionRule", resourceId: row.id, details: { code } });
      return this.dto(updated);
    });
  }

  async history(code: string) {
    const row = await this.prisma.supplierCommissionRule.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Commission rule ${code} not found`);
    return this.prisma.supplierCommissionRuleHistory.findMany({ where: { ruleId: row.id }, orderBy: { createdAt: "desc" } });
  }

  async resolveActive(supplierCode: string, serviceType: string, at: Date = new Date()) {
    const rows = await this.prisma.supplierCommissionRule.findMany({
      where: {
        supplierCode: validateSupplierCode(supplierCode),
        serviceType: validateServiceType(serviceType),
        status: MarkupRuleStatus.ACTIVE,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: { effectiveFrom: "desc" },
      take: 2,
    });
    if (rows.length > 1) throw new ConflictError(`Multiple active commission rules for ${supplierCode}/${serviceType}`);
    const row = rows[0];
    if (!row) return null;
    return {
      commissionType: row.commissionType as "PERCENT" | "FIXED",
      rate: row.rate,
      fixedAmount: row.fixedAmount,
      calculationBase: row.calculationBase as "SUPPLIER_BASE" | "STOREFRONT",
      ruleCode: row.code,
      ruleVersion: row.version,
    };
  }

  private money(value: string, field: string): Prisma.Decimal {
    const amount = new Prisma.Decimal(value);
    if (amount.isNegative()) throw new ValidationDomainError(`${field} must be >= 0`);
    return amount;
  }

  private async writeHistory(tx: Prisma.TransactionClient, row: { id: string; code: string; version: number; supplierCode: string; serviceType: string; commissionType: string; rate: Prisma.Decimal | null; fixedAmount: Prisma.Decimal | null; calculationBase: string; status: string }, actor: Actor, comment: string) {
    await tx.supplierCommissionRuleHistory.create({ data: { ruleId: row.id, action: comment.startsWith("created") ? "created" : "changed", version: row.version, fields: { code: row.code, supplierCode: row.supplierCode, serviceType: row.serviceType, commissionType: row.commissionType, rate: row.rate?.toString() ?? null, fixedAmount: row.fixedAmount?.toString() ?? null, calculationBase: row.calculationBase, status: row.status }, actorId: actor.id, actorName: actor.username, comment } });
  }

  private dto(row: { id: string; code: string; supplierCode: string; serviceType: string; commissionType: string; rate: Prisma.Decimal | null; fixedAmount: Prisma.Decimal | null; fixedCurrency: string | null; calculationBase: string; status: string; version: number; effectiveFrom: Date; effectiveTo: Date | null; updatedAt: Date }) {
    return { id: row.id, code: row.code, supplierCode: row.supplierCode, serviceType: row.serviceType, commissionType: row.commissionType, rate: row.rate?.toString() ?? null, fixedAmount: row.fixedAmount?.toString() ?? null, fixedCurrency: row.fixedCurrency, calculationBase: row.calculationBase, status: row.status, version: row.version, effectiveFrom: row.effectiveFrom.toISOString(), effectiveTo: row.effectiveTo?.toISOString() ?? null, updatedAt: row.updatedAt.toISOString() };
  }
}


