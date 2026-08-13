/**
 * PHASE 2 STEP 2.10 — FinanceService (Finance Domain Foundation).
 *
 * Scope: Finance master data (Currency/ExchangeRate/Tax/TaxRule) — единственный
 * владелец (Screen Design §7, Architecture §8; Settings НЕ дублирует).
 *
 * НЕ входит в Step 2.10 (Roadmap sub-steps / §52):
 *  - payment initiation/PSP/webhooks (2.12/2.12A);
 *  - refund execution (2.13);
 *  - invoice generation / commission flow (2.14);
 *  - settlement engine (2.14A) / payout (2.14B);
 *  - ledger (2.10A) / provider-fee, settlement, payout (2.10B);
 *  - temporal milestones (2.10C).
 *
 * Инварианты:
 *  - Finance НЕ пишет в Order/Booking/Catalog/Availability/Acquisition
 *    (только reads по ID, ADR-0001); никаких cross-domain writes;
 *  - идентификаторы CUR-/FXR-/TAX-/TXR-* — server-owned (BusinessSequence);
 *  - money/rate — Decimal (платформенный контракт, finance.money);
 *  - каждое изменение — AuditLog (security.audit) с actor/причиной.
 */
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { NotFoundError, ConflictError, ValidationDomainError } from "../../shared/errors";
import { isUniqueViolation } from "../../shared/prisma-errors";
import {
  assertValidRange,
  validateIsoCode,
  validateCountryIso,
  validateRate,
  validateTaxRate,
} from "./finance.validation";

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
  ) {}

  // ── Currency ────────────────────────────────────────────────────────────────

  async listCurrencies(): Promise<Array<Record<string, unknown>>> {
    const rows = await this.prisma.currency.findMany({ orderBy: { isoCode: "asc" } });
    return rows.map((c) => this.currencyDto(c));
  }

  async getCurrencyByCode(code: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.currency.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Currency ${code} not found`);
    return this.currencyDto(row);
  }

  async createCurrency(input: {
    isoCode: string;
    name: string;
    symbol: string;
    decimals?: number;
  }): Promise<Record<string, unknown>> {
    const iso = validateIsoCode(input.isoCode);
    const existing = await this.prisma.currency.findUnique({ where: { isoCode: iso } });
    if (existing) throw new ConflictError(`Currency ${iso} already exists`);

    return this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "CUR");
      try {
        const row = await tx.currency.create({
          data: {
            code,
            isoCode: iso,
            name: input.name,
            symbol: input.symbol,
            decimals: input.decimals ?? 2,
          },
        });
        await this.security.audit(tx, { action: "finance.currency.created", resource: "Currency", resourceId: row.id, details: { code, isoCode: iso } });
        return this.currencyDto(row);
      } catch (err) {
        // Race: pre-check не гарантирует уникальность — DB unique constraint
        // (Currency_isoCode_key) является инвариантом. P2002 → контролируемый 409,
        // а не raw 500 (STRICT REVIEW 2.10 FIX 1).
        if (isUniqueViolation(err)) throw new ConflictError(`Currency ${iso} already exists`);
        throw err;
      }
    });
  }

  async updateCurrency(code: string, input: { name?: string; symbol?: string; decimals?: number; isActive?: boolean }): Promise<Record<string, unknown>> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.currency.findUnique({ where: { code } });
      if (!existing) throw new NotFoundError(`Currency ${code} not found`);

      const row = await tx.currency.update({
        where: { code },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.symbol !== undefined ? { symbol: input.symbol } : {}),
          ...(input.decimals !== undefined ? { decimals: input.decimals } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
      await this.security.audit(tx, { action: "finance.currency.updated", resource: "Currency", resourceId: row.id, details: { code } });
      return this.currencyDto(row);
    });
  }

  // ── ExchangeRate ────────────────────────────────────────────────────────────

  async listExchangeRates(): Promise<Array<Record<string, unknown>>> {
    const rows = await this.prisma.exchangeRate.findMany({ orderBy: [{ baseCurrencyIso: "asc" }, { validFrom: "desc" }] });
    return rows.map((r) => this.rateDto(r));
  }

  async getExchangeRateByCode(code: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.exchangeRate.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`ExchangeRate ${code} not found`);
    return this.rateDto(row);
  }

  async createExchangeRate(input: {
    baseCurrencyIso: string;
    quoteCurrencyIso: string;
    rate: string;
    validFrom: string;
    validTo?: string;
  }): Promise<Record<string, unknown>> {
    const base = validateIsoCode(input.baseCurrencyIso, "baseCurrencyIso");
    const quote = validateIsoCode(input.quoteCurrencyIso, "quoteCurrencyIso");
    if (base === quote) throw new ValidationDomainError("baseCurrencyIso and quoteCurrencyIso must differ");
    const rate = validateRate(input.rate);
    assertValidRange(input.validFrom, input.validTo);

    return this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "FXR");
      const row = await tx.exchangeRate.create({
        data: {
          code,
          baseCurrencyIso: base,
          quoteCurrencyIso: quote,
          rate: new Prisma.Decimal(rate),
          validFrom: new Date(input.validFrom),
          validTo: input.validTo ? new Date(input.validTo) : null,
        },
      });
      await this.security.audit(tx, { action: "finance.exchange_rate.created", resource: "ExchangeRate", resourceId: row.id, details: { code, base, quote } });
      return this.rateDto(row);
    });
  }

  async updateExchangeRate(code: string, input: { rate?: string; validFrom?: string; validTo?: string; isActive?: boolean }): Promise<Record<string, unknown>> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.exchangeRate.findUnique({ where: { code } });
      if (!existing) throw new NotFoundError(`ExchangeRate ${code} not found`);

      const rate = input.rate !== undefined ? validateRate(input.rate) : undefined;
      const validFrom = input.validFrom !== undefined ? new Date(input.validFrom) : undefined;
      const validTo = input.validTo !== undefined ? (input.validTo ? new Date(input.validTo) : null) : undefined;
      if (validFrom !== undefined && validTo !== undefined && validTo !== null && validTo <= validFrom) {
        throw new ValidationDomainError("period: validTo must be after validFrom");
      }

      const row = await tx.exchangeRate.update({
        where: { code },
        data: {
          ...(rate !== undefined ? { rate: new Prisma.Decimal(rate) } : {}),
          ...(validFrom !== undefined ? { validFrom } : {}),
          ...(validTo !== undefined ? { validTo } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
      await this.security.audit(tx, { action: "finance.exchange_rate.updated", resource: "ExchangeRate", resourceId: row.id, details: { code } });
      return this.rateDto(row);
    });
  }

  // ── Tax ─────────────────────────────────────────────────────────────────────

  async listTaxes(): Promise<Array<Record<string, unknown>>> {
    const rows = await this.prisma.tax.findMany({ orderBy: { name: "asc" }, include: { rules: true } });
    return rows.map((t) => this.taxDto(t));
  }

  async getTaxByCode(code: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.tax.findUnique({ where: { code }, include: { rules: true } });
    if (!row) throw new NotFoundError(`Tax ${code} not found`);
    return this.taxDto(row);
  }

  async createTax(input: { name: string; rate: string; countryIso?: string }): Promise<Record<string, unknown>> {
    const rate = validateTaxRate(input.rate);
    const countryIso = input.countryIso ? validateCountryIso(input.countryIso) : undefined;

    return this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "TAX");
      const row = await tx.tax.create({
        data: { code, name: input.name, rate: new Prisma.Decimal(rate), countryIso: countryIso ?? null },
        include: { rules: true },
      });
      await this.security.audit(tx, { action: "finance.tax.created", resource: "Tax", resourceId: row.id, details: { code } });
      return this.taxDto(row);
    });
  }

  async updateTax(code: string, input: { name?: string; rate?: string; countryIso?: string; isActive?: boolean }): Promise<Record<string, unknown>> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.tax.findUnique({ where: { code } });
      if (!existing) throw new NotFoundError(`Tax ${code} not found`);

      const rate = input.rate !== undefined ? validateTaxRate(input.rate) : undefined;
      const countryIso = input.countryIso !== undefined ? (input.countryIso ? validateCountryIso(input.countryIso) : null) : undefined;

      const row = await tx.tax.update({
        where: { code },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(rate !== undefined ? { rate: new Prisma.Decimal(rate) } : {}),
          ...(countryIso !== undefined ? { countryIso } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        include: { rules: true },
      });
      await this.security.audit(tx, { action: "finance.tax.updated", resource: "Tax", resourceId: row.id, details: { code } });
      return this.taxDto(row);
    });
  }

  // ── TaxRule ─────────────────────────────────────────────────────────────────

  async listTaxRules(): Promise<Array<Record<string, unknown>>> {
    const rows = await this.prisma.taxRule.findMany({ orderBy: { effectiveFrom: "desc" }, include: { tax: true } });
    return rows.map((r) => this.taxRuleDto(r));
  }

  async getTaxRuleByCode(code: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.taxRule.findUnique({ where: { code }, include: { tax: true } });
    if (!row) throw new NotFoundError(`TaxRule ${code} not found`);
    return this.taxRuleDto(row);
  }

  async createTaxRule(input: { taxId: string; productType?: string; countryIso?: string; effectiveFrom: string; effectiveTo?: string }): Promise<Record<string, unknown>> {
    const tax = await this.prisma.tax.findUnique({ where: { id: input.taxId } });
    if (!tax) throw new ValidationDomainError(`Tax ${input.taxId} not found`);
    const countryIso = input.countryIso ? validateCountryIso(input.countryIso) : undefined;
    assertValidRange(input.effectiveFrom, input.effectiveTo);

    return this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "TXR");
      const row = await tx.taxRule.create({
        data: {
          code,
          taxId: tax.id,
          productType: input.productType ?? null,
          countryIso: countryIso ?? null,
          effectiveFrom: new Date(input.effectiveFrom),
          effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        },
        include: { tax: true },
      });
      await this.security.audit(tx, { action: "finance.tax_rule.created", resource: "TaxRule", resourceId: row.id, details: { code } });
      return this.taxRuleDto(row);
    });
  }

  async updateTaxRule(code: string, input: { productType?: string; countryIso?: string; effectiveFrom?: string; effectiveTo?: string; isActive?: boolean }): Promise<Record<string, unknown>> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.taxRule.findUnique({ where: { code } });
      if (!existing) throw new NotFoundError(`TaxRule ${code} not found`);

      const effectiveFrom = input.effectiveFrom !== undefined ? new Date(input.effectiveFrom) : undefined;
      const effectiveTo = input.effectiveTo !== undefined ? (input.effectiveTo ? new Date(input.effectiveTo) : null) : undefined;
      if (effectiveFrom !== undefined && effectiveTo !== undefined && effectiveTo !== null && effectiveTo <= effectiveFrom) {
        throw new ValidationDomainError("period: effectiveTo must be after effectiveFrom");
      }
      const countryIso = input.countryIso !== undefined ? (input.countryIso ? validateCountryIso(input.countryIso) : null) : undefined;

      const row = await tx.taxRule.update({
        where: { code },
        data: {
          ...(input.productType !== undefined ? { productType: input.productType ?? null } : {}),
          ...(countryIso !== undefined ? { countryIso } : {}),
          ...(effectiveFrom !== undefined ? { effectiveFrom } : {}),
          ...(effectiveTo !== undefined ? { effectiveTo } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        include: { tax: true },
      });
      await this.security.audit(tx, { action: "finance.tax_rule.updated", resource: "TaxRule", resourceId: row.id, details: { code } });
      return this.taxRuleDto(row);
    });
  }

  // ── DTO projections (whitelist; никаких raw Prisma rows наружу) ─────────────

  private currencyDto(c: {
    id: string;
    code: string;
    isoCode: string;
    name: string;
    symbol: string;
    decimals: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Record<string, unknown> {
    return { id: c.id, code: c.code, isoCode: c.isoCode, name: c.name, symbol: c.symbol, decimals: c.decimals, isActive: c.isActive, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() };
  }

  private rateDto(r: {
    id: string;
    code: string;
    baseCurrencyIso: string;
    quoteCurrencyIso: string;
    rate: Prisma.Decimal;
    validFrom: Date;
    validTo: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Record<string, unknown> {
    return {
      id: r.id,
      code: r.code,
      baseCurrencyIso: r.baseCurrencyIso,
      quoteCurrencyIso: r.quoteCurrencyIso,
      rate: r.rate.toString(),
      validFrom: r.validFrom.toISOString(),
      validTo: r.validTo ? r.validTo.toISOString() : null,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private taxDto(t: {
    id: string;
    code: string;
    name: string;
    rate: Prisma.Decimal;
    countryIso: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    rules?: Array<{ id: string; code: string }>;
  }): Record<string, unknown> {
    return {
      id: t.id,
      code: t.code,
      name: t.name,
      rate: t.rate.toString(),
      countryIso: t.countryIso,
      isActive: t.isActive,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      rules: t.rules ? t.rules.map((r) => ({ id: r.id, code: r.code })) : undefined,
    };
  }

  private taxRuleDto(r: {
    id: string;
    code: string;
    taxId: string;
    productType: string | null;
    countryIso: string | null;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    tax?: { id: string; code: string; name: string };
  }): Record<string, unknown> {
    return {
      id: r.id,
      code: r.code,
      taxId: r.taxId,
      tax: r.tax ? { id: r.tax.id, code: r.tax.code, name: r.tax.name } : undefined,
      productType: r.productType,
      countryIso: r.countryIso,
      effectiveFrom: r.effectiveFrom.toISOString(),
      effectiveTo: r.effectiveTo ? r.effectiveTo.toISOString() : null,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
