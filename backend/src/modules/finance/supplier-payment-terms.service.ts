/**
 * Minimal supplier payment terms (2026-10-25).
 *
 * Scope: only rules that can be applied without inventing contract terms:
 *   IMMEDIATE — срок = дата подтверждения;
 *   NET_DAYS  — дата подтверждения + N дней.
 * AFTER_INVOICE не реализован: в модели нет invoiceReceivedAt, и вычислять
 * срок «от счёта» без этой даты было бы выдумкой.
 *
 * Правило применяется ТОЛЬКО при создании обязательства; рассчитанный dueDate
 * и snapshot правила (rule/days/appliedAt) хранятся в SupplierObligation.
 * Изменение правила не переписывает существующие сроки.
 */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SecurityService } from "../../security/security.service";
import { ValidationDomainError } from "../../shared/errors";

export const PAYMENT_TERM_RULES = ["IMMEDIATE", "NET_DAYS"] as const;

export interface Actor {
  id: string;
  username: string;
}

/** Чистый расчёт срока (unit-testable): дата-only, UTC. */
export function computeDueDate(
  rule: string,
  days: number,
  base: Date,
): Date {
  const dateOnly = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  if (rule === "IMMEDIATE") return dateOnly;
  if (rule === "NET_DAYS") {
    const due = new Date(dateOnly);
    due.setUTCDate(due.getUTCDate() + days);
    return due;
  }
  throw new ValidationDomainError(`unsupported payment terms rule: ${rule}`);
}

@Injectable()
export class SupplierPaymentTermsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
  ) {}

  async list() {
    const rows = await this.prisma.supplierPaymentTerms.findMany({
      orderBy: { supplierCode: "asc" },
    });
    return rows.map((r) => ({
      supplierCode: r.supplierCode,
      rule: r.rule,
      days: r.days,
      active: r.active,
      updatedById: r.updatedById,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async upsert(
    input: { supplierCode: string; rule: string; days?: number; active?: boolean },
    actor: Actor,
  ) {
    const supplierCode = (input.supplierCode ?? "").trim().toUpperCase();
    if (!supplierCode) throw new ValidationDomainError("supplierCode is required");
    const rule = (input.rule ?? "").trim().toUpperCase();
    if (!PAYMENT_TERM_RULES.includes(rule as (typeof PAYMENT_TERM_RULES)[number])) {
      throw new ValidationDomainError(`rule must be one of ${PAYMENT_TERM_RULES.join(", ")}`);
    }
    const days = rule === "IMMEDIATE" ? 0 : Number(input.days ?? 0);
    if (!Number.isInteger(days) || days < 0 || days > 365) {
      throw new ValidationDomainError("days must be an integer in [0, 365]");
    }
    const active = input.active ?? true;

    const existing = await this.prisma.supplierPaymentTerms.findUnique({ where: { supplierCode } });
    const saved = await this.prisma.$transaction(async (tx) => {
      const row = await tx.supplierPaymentTerms.upsert({
        where: { supplierCode },
        create: { supplierCode, rule, days, active, updatedById: actor.id },
        update: { rule, days, active, updatedById: actor.id },
      });
      await this.security.audit(tx, {
        action: "finance.supplier_payment_terms.updated",
        resource: "SupplierPaymentTerms",
        resourceId: row.id,
        details: {
          supplierCode,
          oldRule: existing?.rule ?? null,
          oldDays: existing?.days ?? null,
          newRule: rule,
          newDays: days,
          active,
          actor: actor.username,
        },
      });
      return row;
    });
    return {
      supplierCode: saved.supplierCode,
      rule: saved.rule,
      days: saved.days,
      active: saved.active,
      updatedAt: saved.updatedAt.toISOString(),
    };
  }

  /** Правило для НОВОГО обязательства; null = срок вводится вручную. */
  async resolveForSupplier(supplierCode: string | null) {
    if (!supplierCode) return null;
    return this.prisma.supplierPaymentTerms.findUnique({
      where: { supplierCode: supplierCode.trim().toUpperCase() },
    });
  }
}
