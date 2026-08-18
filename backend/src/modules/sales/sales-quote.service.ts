/**
 * Sales structural decomposition — SalesQuoteService (Wave 4 / Step 2.17C).
 *
 * Extracts Quote/Sale lifecycle writes from SalesService:
 *   - createQuote, issueQuote, addQuoteItem, updateQuoteItem, removeQuoteItem
 *   - setQuoteCustomer, setQuoteTravelers, setQuoteCommercial
 *   - createSale
 *
 * Invariants preserved:
 *   - Each method owns its own $transaction boundary (CAS version, history, audit).
 *   - issueQuote: commission freeze (ADR-0013 D6/D7/D14/D15), backend-authoritative totals.
 *   - addQuoteItem: tariff resolution, period pricing, restriction evaluation.
 *   - createSale: one Checkout → one Sale (P2002 → managed 409).
 *   - createOpportunityFromBuyerRequestSelection stays in SalesService (in-tx with Reverse).
 *   - No authority duplication: Sales remains sole-writer for quote.*, quoteItem.*, sale.*.
 *
 * Behavior-preserving: zero API, contract, or authorization changes.
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { uniqueConstraintNames } from "../../shared/prisma-errors";
import { CommissionPolicyService } from "../finance/commission-policy.service";
import { resolveApplicablePeriod, type PeriodRow } from "../catalog/period-resolution";
import { evaluateRestrictions, type AppliedRestriction, type RestrictionRow } from "../catalog/restriction-evaluation";
import { Prisma } from "../../generated/prisma/client";
import {
  CheckoutStatus,
  CommissionChannel,
  ProductStatus,
  QuoteDiscountType,
  QuoteStatus,
  SalesAcquisitionSource,
  SaleStatus,
} from "../../generated/prisma/enums";
import {
  assertQuoteComposable,
  assertQuoteTransition,
} from "./sales.validation";
import { classifyAvailability, isDateOnly } from "./sales.checkout";
import { computePaymentTerms } from "./sales.payment-terms";
import {
  discountAmountOf,
  lineAmount,
  subtotalOf,
  totalOf,
  validateDiscountValue,
} from "./sales.money";
import { quoteTotals as computeQuoteTotals } from "./sales.money";
import { pagination, writeHistory, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "./sales.history";
import { toQuoteDto, toQuoteDetailDto, toSaleDto, checkoutQuoteMeta } from "./sales.projection";
import { assertOptionalCustomer, assertOptionalProduct } from "./sales-helpers";
import { isoUtc } from "../../shared/temporal";
import { CHECKOUT_AVAILABILITY_SEMANTICS } from "./sales.checkout";
import type {
  CheckoutIntentAvailabilityDto,
  CheckoutIntentDetailDto,
  SaleDetailCompletionDto,
  SaleDto,
  QuoteDetailDto,
  QuoteDto,
  QuoteItemDto,
} from "./sales.contracts";

interface Actor {
  id: string;
  username: string;
}

@Injectable()
export class SalesQuoteService {
  private readonly logger = new Logger(SalesQuoteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
    private readonly commissionPolicies: CommissionPolicyService,
  ) {}

  /* ── Quote CRUD ────────────────────────────────────────────────────────── */

  async createQuote(
    input: { customerId?: string | null; opportunityId?: string | null; productId?: string | null },
    actor: Actor,
  ): Promise<QuoteDto> {
    let opportunityAcquisitionSource: SalesAcquisitionSource | null = null;
    if (input.opportunityId) {
      const opp = await this.prisma.opportunity.findUnique({
        where: { id: input.opportunityId },
        select: { id: true, acquisitionSource: true },
      });
      if (!opp) throw new ValidationDomainError(`Opportunity ${input.opportunityId} does not exist`);
      opportunityAcquisitionSource = opp.acquisitionSource ?? null;
    }
    await assertOptionalCustomer(this.prisma, input.customerId);
    await assertOptionalProduct(this.prisma, input.productId);

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "QTE");
      const row = await tx.quote.create({
        data: {
          code,
          customerId: input.customerId ?? null,
          opportunityId: input.opportunityId ?? null,
          productId: input.productId ?? null,
          status: QuoteStatus.DRAFT,
          acquisitionSource: opportunityAcquisitionSource,
          createdById: actor.id,
        },
      });
      await writeHistory(tx, "quoteHistory", row.id, "created", null, row.status, actor, {});
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.quote.created",
        resource: "Quote",
        resourceId: row.id,
        details: { code: row.code, status: row.status },
      });
      return row;
    });
    return toQuoteDto(created);
  }

  /**
   * Step 2.3: ISSUE — atomic freeze. One transaction: CAS, validation,
   * backend-authoritative totals, commission snapshot, persist, history + audit.
   */
  async issueQuote(code: string, getQuoteDetail: (code: string) => Promise<QuoteDetailDto>, actor: Actor): Promise<QuoteDetailDto> {
    const row = await this.prisma.quote.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);

    await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.quote.findUniqueOrThrow({
        where: { id: row.id },
        include: { items: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
      });
      assertQuoteTransition(fresh.status, QuoteStatus.ISSUED);
      if (fresh.items.length === 0) throw new ValidationDomainError(`Quote ${code} has no items; cannot issue`);
      const cur = fresh.items[0].currency;
      for (const it of fresh.items) {
        if (it.currency !== cur) throw new ValidationDomainError(`Quote ${code} has mixed currencies; cannot issue`);
      }
      const discountValue = validateDiscountValue(fresh.discountType, fresh.discountValue);
      const { subtotal, discountAmount, total } = computeQuoteTotals(fresh.items, fresh.discountType, discountValue);
      if (!fresh.validUntil) throw new ValidationDomainError(`Quote ${code} requires validUntil before issue`);
      const now = new Date();
      if (fresh.validUntil <= now) throw new ValidationDomainError(`Quote ${code} validUntil must be in the future`);

      // Commission freeze (ADR-0013 D6/D7/D14/D15)
      const commissionChannel = mapCommissionChannelFromAcquisition(fresh.acquisitionSource);
      const partnerRows = await tx.product.findMany({
        where: { id: { in: fresh.items.map((it) => it.productId) } },
        select: { partnerId: true },
      });
      const partnerIds = new Set<string>();
      for (const p of partnerRows) if (p.partnerId) partnerIds.add(p.partnerId);
      const sellerPartnerId = partnerIds.size === 1 ? [...partnerIds][0] : null;

      let commissionSnapshot: Record<string, unknown> | null = null;
      if (commissionChannel) {
        const resolution = await this.commissionPolicies.resolve(commissionChannel, now.toISOString());
        if (resolution.found) {
          commissionSnapshot = {
            policyCode: resolution.policy.code,
            policyVersion: resolution.policy.version,
            rateType: resolution.policy.rateType,
            rate: resolution.policy.rate,
            baseAmount: String(total),
            baseCurrency: fresh.currency,
            channel: commissionChannel,
            sellerPartnerId,
            selectedAt: now.toISOString(),
            roundingContractVersion: "v1",
          };
        }
      }

      const res = await tx.quote.updateMany({
        where: { id: row.id, version: fresh.version },
        data: {
          status: QuoteStatus.ISSUED,
          issuedAt: now,
          version: { increment: 1 },
          subtotal,
          discountAmount,
          total,
          commissionSnapshot: commissionSnapshot ? (commissionSnapshot as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });
      if (res.count === 0) throw new ConflictError(`Quote ${code} was modified concurrently; retry`);
      await writeHistory(tx, "quoteHistory", row.id, "issued", fresh.status, QuoteStatus.ISSUED, actor, {
        validUntil: fresh.validUntil.toISOString(),
        subtotal: String(subtotal),
        discountAmount: String(discountAmount),
        total: String(total),
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.quote.issued",
        resource: "Quote",
        resourceId: row.id,
        details: { code: row.code, from: fresh.status, to: QuoteStatus.ISSUED },
      });
    });
    return getQuoteDetail(code);
  }

  async addQuoteItem(
    code: string,
    input: { productId: string; tariffId: string; quantity: number; serviceDate?: string; durationDays?: number },
    getQuoteDetail: (code: string) => Promise<QuoteDetailDto>,
    actor: Actor,
  ): Promise<QuoteDetailDto> {
    const row = await this.prisma.quote.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);
    assertQuoteComposable(row.status);
    const serviceDate = input.serviceDate ? (await import("./sales.checkout")).parseServiceDate(input.serviceDate) : null;
    const durationDays = input.durationDays ?? null;
    const snap = await this.resolveEligibleTariff(input.productId, input.tariffId, serviceDate, durationDays);
    const amount = lineAmount(snap.price, input.quantity);

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.quote.updateMany({ where: { id: row.id, version: row.version }, data: { version: { increment: 1 } } });
      if (res.count === 0) throw new ConflictError(`Quote ${code} was modified concurrently; retry`);
      const existing = await tx.quoteItem.findMany({ where: { quoteId: row.id }, select: { currency: true }, take: 1 });
      if (existing.length > 0 && existing[0].currency !== snap.currency) {
        throw new ValidationDomainError(`Quote currency is ${existing[0].currency}; cannot add item in ${snap.currency}`);
      }
      await tx.quoteItem.create({
        data: {
          quoteId: row.id,
          productId: input.productId,
          productCode: snap.productCode,
          productTitle: snap.productTitle,
          tariffId: input.tariffId,
          tariffCode: snap.tariffCode,
          tariffName: snap.tariffName,
          quantity: input.quantity,
          serviceDate,
          unitPrice: snap.price,
          currency: snap.currency,
          amount,
          restrictionSnapshot: snap.restrictions.length > 0 ? (snap.restrictions as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        },
      });
      if (existing.length === 0) {
        await tx.quote.update({ where: { id: row.id }, data: { currency: snap.currency } });
      }
      await writeHistory(tx, "quoteHistory", row.id, "item_added", null, null, actor, {
        productCode: snap.productCode,
        tariffCode: snap.tariffCode,
        quantity: input.quantity,
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.quote.item_added",
        resource: "Quote",
        resourceId: row.id,
        details: { code: row.code, productCode: snap.productCode, tariffCode: snap.tariffCode, quantity: input.quantity },
      });
    });
    return getQuoteDetail(code);
  }

  async updateQuoteItem(code: string, itemId: string, quantity: number, getQuoteDetail: (code: string) => Promise<QuoteDetailDto>, actor: Actor): Promise<QuoteDetailDto> {
    const row = await this.prisma.quote.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);
    assertQuoteComposable(row.status);

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.quote.updateMany({ where: { id: row.id, version: row.version }, data: { version: { increment: 1 } } });
      if (res.count === 0) throw new ConflictError(`Quote ${code} was modified concurrently; retry`);
      const item = await tx.quoteItem.findFirst({ where: { id: itemId, quoteId: row.id } });
      if (!item) throw new NotFoundError(`Quote item ${itemId} not found in ${code}`);
      const amount = lineAmount(item.unitPrice, quantity);
      await this.assertFixedDiscountWithinSubtotal(tx, row.id, row.discountType, row.discountValue, { excludeItemId: itemId, replaceAmount: amount });
      await tx.quoteItem.update({ where: { id: itemId }, data: { quantity, amount } });
      await writeHistory(tx, "quoteHistory", row.id, "item_updated", null, null, actor, { itemId, quantity });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.quote.item_updated",
        resource: "Quote",
        resourceId: row.id,
        details: { code: row.code, itemId, quantity },
      });
    });
    return getQuoteDetail(code);
  }

  async removeQuoteItem(code: string, itemId: string, getQuoteDetail: (code: string) => Promise<QuoteDetailDto>, actor: Actor): Promise<QuoteDetailDto> {
    const row = await this.prisma.quote.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);
    assertQuoteComposable(row.status);

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.quote.updateMany({ where: { id: row.id, version: row.version }, data: { version: { increment: 1 } } });
      if (res.count === 0) throw new ConflictError(`Quote ${code} was modified concurrently; retry`);
      const item = await tx.quoteItem.findFirst({ where: { id: itemId, quoteId: row.id } });
      if (!item) throw new NotFoundError(`Quote item ${itemId} not found in ${code}`);
      await this.assertFixedDiscountWithinSubtotal(tx, row.id, row.discountType, row.discountValue, { excludeItemId: itemId });
      await tx.quoteItem.delete({ where: { id: itemId } });
      await writeHistory(tx, "quoteHistory", row.id, "item_removed", null, null, actor, { itemId });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.quote.item_removed",
        resource: "Quote",
        resourceId: row.id,
        details: { code: row.code, itemId },
      });
    });
    return getQuoteDetail(code);
  }

  async setQuoteCustomer(code: string, customerId: string | null, getQuoteDetail: (code: string) => Promise<QuoteDetailDto>, actor: Actor): Promise<QuoteDetailDto> {
    const row = await this.prisma.quote.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);
    assertQuoteComposable(row.status);
    await assertOptionalCustomer(this.prisma, customerId);

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.quote.updateMany({ where: { id: row.id, version: row.version }, data: { customerId, version: { increment: 1 } } });
      if (res.count === 0) throw new ConflictError(`Quote ${code} was modified concurrently; retry`);
      await writeHistory(tx, "quoteHistory", row.id, "customer_changed", null, null, actor, { customerId });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.quote.customer_changed",
        resource: "Quote",
        resourceId: row.id,
        details: { code: row.code, customerId },
      });
    });
    return getQuoteDetail(code);
  }

  async setQuoteTravelers(code: string, travelers: Array<{ firstName: string; lastName: string; birthDate?: string | null }>, getQuoteDetail: (code: string) => Promise<QuoteDetailDto>, actor: Actor): Promise<QuoteDetailDto> {
    const row = await this.prisma.quote.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);
    assertQuoteComposable(row.status);
    this.assertTravelersValid(travelers);

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.quote.updateMany({ where: { id: row.id, version: row.version }, data: { version: { increment: 1 } } });
      if (res.count === 0) throw new ConflictError(`Quote ${code} was modified concurrently; retry`);
      await tx.quoteTraveler.deleteMany({ where: { quoteId: row.id } });
      if (travelers.length > 0) {
        await tx.quoteTraveler.createMany({
          data: travelers.map((t) => ({
            quoteId: row.id,
            firstName: t.firstName.trim(),
            lastName: t.lastName.trim(),
            birthDate: t.birthDate ? new Date(`${t.birthDate}T00:00:00.000Z`) : null,
          })),
        });
      }
      await writeHistory(tx, "quoteHistory", row.id, "travelers_changed", null, null, actor, { count: travelers.length });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.quote.travelers_changed",
        resource: "Quote",
        resourceId: row.id,
        details: { code: row.code, count: travelers.length },
      });
    });
    return getQuoteDetail(code);
  }

  async setQuoteCommercial(
    code: string,
    input: { discountType: QuoteDiscountType; discountValue?: string | null; validUntil?: string | null },
    getQuoteDetail: (code: string) => Promise<QuoteDetailDto>,
    actor: Actor,
  ): Promise<QuoteDetailDto> {
    const row = await this.prisma.quote.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);
    assertQuoteComposable(row.status);
    const discountValue = validateDiscountValue(input.discountType, input.discountValue ?? null);
    await this.assertFixedDiscountWithinSubtotal(this.prisma, row.id, input.discountType, discountValue);
    let validUntil: Date | null = null;
    if (input.validUntil) {
      const d = new Date(input.validUntil);
      if (Number.isNaN(d.getTime())) throw new ValidationDomainError("validUntil must be a valid ISO date");
      if (d <= new Date()) throw new ValidationDomainError("validUntil must be in the future");
      validUntil = d;
    }

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.quote.updateMany({
        where: { id: row.id, version: row.version },
        data: { discountType: input.discountType, discountValue, validUntil, version: { increment: 1 } },
      });
      if (res.count === 0) throw new ConflictError(`Quote ${code} was modified concurrently; retry`);
      await writeHistory(tx, "quoteHistory", row.id, "commercial_changed", null, null, actor, {
        discountType: input.discountType,
        discountValue: discountValue ? String(discountValue) : null,
        validUntil: validUntil ? validUntil.toISOString() : null,
      });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.quote.commercial_changed",
        resource: "Quote",
        resourceId: row.id,
        details: { code: row.code, discountType: input.discountType },
      });
    });
    return getQuoteDetail(code);
  }

  /* ── Sale ───────────────────────────────────────────────────────────────── */

  async createSale(
    input: { customerId?: string | null; opportunityId?: string | null; quoteId?: string | null; checkoutIntentId?: string | null },
    actor: Actor,
  ): Promise<SaleDto> {
    if (input.opportunityId) {
      const opp = await this.prisma.opportunity.findUnique({ where: { id: input.opportunityId }, select: { id: true } });
      if (!opp) throw new ValidationDomainError(`Opportunity ${input.opportunityId} does not exist`);
    }
    if (input.quoteId) {
      const q = await this.prisma.quote.findUnique({ where: { id: input.quoteId }, select: { id: true } });
      if (!q) throw new ValidationDomainError(`Quote ${input.quoteId} does not exist`);
    }
    if (input.checkoutIntentId) {
      const ck = await this.prisma.checkoutIntent.findUnique({ where: { id: input.checkoutIntentId }, select: { id: true, quoteId: true, status: true } });
      if (!ck) throw new ValidationDomainError(`CheckoutIntent ${input.checkoutIntentId} does not exist`);
      if (ck.status !== CheckoutStatus.ACTIVE) {
        throw new ValidationDomainError(`CheckoutIntent ${input.checkoutIntentId} is ${ck.status}; cannot create Sale`);
      }
      if (input.quoteId && ck.quoteId !== input.quoteId) {
        throw new ValidationDomainError(`CheckoutIntent ${input.checkoutIntentId} belongs to a different Quote`);
      }
    }
    await assertOptionalCustomer(this.prisma, input.customerId);

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "SAL");
      let row: Awaited<ReturnType<typeof tx.sale.create>>;
      try {
        row = await tx.sale.create({
          data: {
            code,
            customerId: input.customerId ?? null,
            opportunityId: input.opportunityId ?? null,
            quoteId: input.quoteId ?? null,
            checkoutIntentId: input.checkoutIntentId ?? null,
            status: SaleStatus.OPEN,
            createdById: actor.id,
          },
        });
      } catch (err) {
        if (
          uniqueConstraintNames(err).some((n) => {
            const low = n.toLowerCase();
            return low.includes("checkoutintentid") || low.includes("quoteid");
          })
        ) {
          throw new ConflictError(`CheckoutIntent ${input.checkoutIntentId} is already linked to a Sale`);
        }
        throw err;
      }
      await writeHistory(tx, "saleHistory", row.id, "created", null, row.status, actor, {});
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.sale.created",
        resource: "Sale",
        resourceId: row.id,
        details: { code: row.code, status: row.status },
      });
      return row;
    });
    return toSaleDto(created);
  }

  /* ── Private helpers ───────────────────────────────────────────────────── */

  private async assertFixedDiscountWithinSubtotal(
    client: PrismaService | Prisma.TransactionClient,
    quoteId: string,
    discountType: QuoteDiscountType,
    discountValue: Prisma.Decimal | null,
    adjustment?: { excludeItemId: string; replaceAmount?: Prisma.Decimal },
  ): Promise<void> {
    if (discountType !== QuoteDiscountType.FIXED || discountValue === null) return;
    const items = await client.quoteItem.findMany({ where: { quoteId }, select: { id: true, amount: true } });
    let subtotal = adjustment
      ? subtotalOf(items.filter((i) => i.id !== adjustment.excludeItemId).map((i) => i.amount))
      : subtotalOf(items.map((i) => i.amount));
    if (adjustment?.replaceAmount) {
      subtotal = subtotal.plus(adjustment.replaceAmount);
    }
    if (discountValue.greaterThan(subtotal)) {
      throw new ValidationDomainError("Fixed discount must not exceed quote subtotal");
    }
  }

  private async resolveEligibleTariff(
    productId: string,
    tariffId: string,
    serviceDate?: Date | null,
    durationDays?: number | null,
  ): Promise<{
    productCode: string;
    productTitle: string;
    tariffCode: string;
    tariffName: string;
    price: Prisma.Decimal;
    currency: string;
    periodSource: "PERIOD" | "DATE_OVERRIDE" | "BASE" | null;
    restrictions: AppliedRestriction[];
  }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, code: true, title: true, status: true },
    });
    if (!product) throw new ValidationDomainError(`Product ${productId} does not exist`);
    if (product.status === ProductStatus.ARCHIVED) {
      throw new ValidationDomainError(`Product ${product.code} is archived and cannot be quoted`);
    }
    const tariff = await this.prisma.tariff.findUnique({
      where: { id: tariffId },
      select: { id: true, code: true, name: true, price: true, currency: true, productId: true, validFrom: true, validTo: true, status: true, pricingMode: true, restrictions: true },
    });
    if (!tariff) throw new ValidationDomainError(`Tariff ${tariffId} does not exist`);
    if (tariff.productId !== productId) {
      throw new ValidationDomainError(`Tariff ${tariff.code} does not belong to Product ${product.code}`);
    }
    if (tariff.status === "ARCHIVED") {
      throw new ValidationDomainError(`Tariff ${tariff.code} is archived and cannot be quoted`);
    }
    if (tariff.pricingMode === "PRICE_ON_REQUEST") {
      throw new ValidationDomainError(
        `Tariff ${tariff.code} is PRICE_ON_REQUEST (inquiry-only); bind a numeric quote is not allowed without an explicit quote flow`,
      );
    }
    const now = new Date();
    if (tariff.validFrom && tariff.validFrom > now) {
      throw new ValidationDomainError(`Tariff ${tariff.code} is not yet valid`);
    }
    if (tariff.validTo && tariff.validTo < now) {
      throw new ValidationDomainError(`Tariff ${tariff.code} has expired`);
    }

    if (serviceDate) {
      const periods = (await this.prisma.commercialPeriod.findMany({
        where: { tariffId, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
      })) as unknown as PeriodRow[];
      const winner = resolveApplicablePeriod(periods, serviceDate);
      const rows = (await this.prisma.commercialRestriction.findMany({
        where: { tariffId, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: { id: true, code: true, scope: true, commercialPeriodId: true, startDate: true, endDate: true, type: true, value: true },
      })) as unknown as RestrictionRow[];
      const base = this.baseRestrictionFacts(tariff.restrictions);
      const evaluation = evaluateRestrictions({
        serviceDate,
        durationDays: durationDays ?? null,
        base,
        resolvedPeriod: winner
          ? { id: winner.id, code: winner.code, kind: winner.kind, startDate: winner.startDate, endDate: winner.endDate, sellable: winner.sellable }
          : null,
        rows,
      });
      if (!evaluation.sellable) {
        throw new ValidationDomainError(
          `Tariff ${tariff.code} is not sellable for ${serviceDate.toISOString().slice(0, 10)} (${evaluation.blockedReason})`,
        );
      }
      return {
        productCode: product.code,
        productTitle: product.title,
        tariffCode: tariff.code,
        tariffName: tariff.name,
        price: winner ? new Prisma.Decimal(winner.price.toString()) : tariff.price,
        currency: tariff.currency ?? "USD",
        periodSource: winner ? winner.kind : "BASE",
        restrictions: evaluation.applied,
      };
    }

    return {
      productCode: product.code,
      productTitle: product.title,
      tariffCode: tariff.code,
      tariffName: tariff.name,
      price: tariff.price,
      currency: tariff.currency ?? "USD",
      periodSource: null,
      restrictions: [],
    };
  }

  private baseRestrictionFacts(restrictions: Prisma.JsonValue | null): {
    minStay?: number | null;
    maxStay?: number | null;
    advanceBookingDays?: number | null;
    closedToArrival?: boolean | null;
    closedToDeparture?: boolean | null;
  } {
    const r = (restrictions ?? null) as Record<string, unknown> | null;
    if (!r) return {};
    const int = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) ? v : null);
    const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
    return {
      minStay: int(r.minStay),
      maxStay: int(r.maxStay),
      advanceBookingDays: int(r.advanceBookingDays),
      closedToArrival: bool(r.closedToArrival),
      closedToDeparture: bool(r.closedToDeparture),
    };
  }

  private assertTravelersValid(travelers: Array<{ firstName: string; lastName: string; birthDate?: string | null }>): void {
    if (travelers.length > 50) throw new ValidationDomainError("Too many travelers (max 50)");
    for (const t of travelers) {
      if (t.firstName.trim().length === 0 || t.firstName.length > 100) throw new ValidationDomainError("firstName must be 1..100 chars");
      if (t.lastName.trim().length === 0 || t.lastName.length > 100) throw new ValidationDomainError("lastName must be 1..100 chars");
      if (t.birthDate && !isDateOnly(t.birthDate)) throw new ValidationDomainError("birthDate must be a calendar date (YYYY-MM-DD)");
      if (t.birthDate && new Date(`${t.birthDate}T00:00:00.000Z`).getTime() > Date.now()) {
        throw new ValidationDomainError("birthDate must not be in the future");
      }
    }
  }
}

/** Acquisition source → CommissionChannel mapping (ADR-0013 D15). */
function mapCommissionChannelFromAcquisition(source: SalesAcquisitionSource | null | undefined): CommissionChannel | null {
  return source === SalesAcquisitionSource.MARKETPLACE ? CommissionChannel.MARKETPLACE : null;
}
