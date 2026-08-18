import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { isoUtc } from "../../shared/temporal";
import { EventBusService } from "../../eventbus/eventbus.service";
import { CatalogService } from "../catalog/catalog.service";
import { Prisma } from "../../generated/prisma/client";
import {
  CheckoutStatus,
  CommissionChannel,
  LeadStatus,
  OpportunityStatus,
  PaymentScheme,
  QuoteDiscountType,
  SalesAcquisitionSource,
  SaleStatus,
} from "../../generated/prisma/enums";
import { classifyAvailability, CHECKOUT_AVAILABILITY_SEMANTICS } from "./sales.checkout";
import type {
  CheckoutListQueryInput,
  LeadListQueryInput,
  OpportunityListQueryInput,
  QuoteListQueryInput,
  SaleListQueryInput,
  SalesQueueKey,
} from "./sales.filters";
import type {
  CheckoutIntentAvailabilityDto,
  CheckoutIntentDetailDto,
  CheckoutIntentDto,
  SaleDetailCompletionDto,
  SaleDto,
  SalesHistoryItemDto,
  SalesKpiDto,
  SalesListResult,
  LeadDto,
  OpportunityDto,
  QuoteDetailDto,
  QuoteDto,
} from "./sales.contracts";
import { writeHistory, PAGE_SIZE_DEFAULT } from "./sales.history";
import { SalesQueryService } from "./sales-query.service";
import { SalesLifecycleService } from "./sales-lifecycle.service";
import { SalesQuoteService } from "./sales-quote.service";
import { SalesCheckoutService } from "./sales-checkout.service";
import { SalesCompletionService } from "./sales-completion.service";

interface Actor {
  id: string;
  username: string;
}

/**
 * PHASE 2 STEP 2.17C — Sales Facade (Wave 0–4 delegation, Wave 5 completeSale stays).
 *
 * This service is now a thin delegation facade. All read methods delegate to
 * SalesQueryService, lifecycle writes to SalesLifecycleService, Quote/Sale writes
 * to SalesQuoteService, and Checkout writes to SalesCheckoutService.
 *
 * Methods that MUST stay in this facade:
 *   - completeSale: uses CatalogService + EventBusService (Wave 5 extraction scope).
 *   - createOpportunityFromBuyerRequestSelection: in-tx boundary with Reverse module.
 *   - Private helpers used by completeSale (assertCheckoutMutable, availabilityFor, etc.).
 */
@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
    private readonly eventBus: EventBusService,
    private readonly catalog: CatalogService,
    /** Step 2.17C Wave 2–4: collaborators. */
    private readonly query: SalesQueryService,
    private readonly lifecycle: SalesLifecycleService,
    private readonly quoteWrites: SalesQuoteService,
    private readonly checkoutWrites: SalesCheckoutService,
    /** Step 2.17C Wave 5: Sale completion (Catalog reservation + EventBus outbox). */
    private readonly completion: SalesCompletionService,
  ) {}

  /* ── Lead (delegated → lifecycle) ──────────────────────────────────────── */

  async createLead(
    input: { name: string; customerId?: string | null; assignedToId?: string | null },
    actor: Actor,
  ): Promise<LeadDto> {
    return this.lifecycle.createLead(input, actor) as Promise<LeadDto>;
  }

  async listLeads(query: LeadListQueryInput): Promise<SalesListResult<LeadDto>> {
    return this.query.listLeads(query);
  }

  async getLeadByCode(code: string): Promise<LeadDto> {
    return this.query.getLeadByCode(code);
  }

  async transitionLead(code: string, to: LeadStatus, actor: Actor): Promise<LeadDto> {
    return this.lifecycle.transitionLead(code, to, actor) as Promise<LeadDto>;
  }

  /* ── Opportunity ────────────────────────────────────────────────────────── */

  async createOpportunity(
    input: { title: string; leadId?: string | null; customerId?: string | null; assignedToId?: string | null },
    actor: Actor,
  ): Promise<OpportunityDto> {
    return this.lifecycle.createOpportunity(input, actor) as Promise<OpportunityDto>;
  }

  /**
   * Step 2.2F (DD-030): canonical conversion. Owner-метод Sales (ADR-0001):
   * вызывается Reverse owner command в ЕДИНОЙ транзакции (тот же tx, что selection).
   * MUST STAY in facade: in-tx boundary with Reverse module.
   */
  async createOpportunityFromBuyerRequestSelection(
    tx: Prisma.TransactionClient,
    input: { title: string; customerId: string; buyerRequestId: string; proposalId: string; sellerId: string },
    actor: Actor,
  ): Promise<{ id: string; code: string }> {
    const title = input.title.trim();
    if (title.length === 0) throw new ValidationDomainError("Opportunity title is required");
    if (title.length > 200) throw new ValidationDomainError("Opportunity title is too long (max 200)");
    const customerExists = await tx.customer.findUnique({ where: { id: input.customerId }, select: { id: true } });
    if (!customerExists) throw new ValidationDomainError(`Customer ${input.customerId} does not exist`);

    const code = await this.ids.nextCode(tx, "OPP");
    const row = await tx.opportunity.create({
      data: {
        code,
        title,
        leadId: null,
        customerId: input.customerId,
        status: OpportunityStatus.NEW,
        acquisitionSource: SalesAcquisitionSource.BUYER_REQUEST,
        buyerRequestId: input.buyerRequestId,
        proposalId: input.proposalId,
        sellerId: input.sellerId,
        createdById: actor.id,
      },
    });
    await writeHistory(tx, "opportunityHistory", row.id, "created", null, row.status, actor, {
      title,
      source: "buyer_request_proposal_selection",
      buyerRequestId: input.buyerRequestId,
      proposalId: input.proposalId,
      acquisitionSource: SalesAcquisitionSource.BUYER_REQUEST,
    });
    await this.security.audit(tx, {
      userId: actor.id,
      username: actor.username,
      action: "sales.opportunity.created_from_buyer_request",
      resource: "Opportunity",
      resourceId: row.id,
      details: {
        code: row.code,
        status: row.status,
        acquisitionSource: SalesAcquisitionSource.BUYER_REQUEST,
        buyerRequestId: input.buyerRequestId,
        proposalId: input.proposalId,
        sellerId: input.sellerId,
      },
    });
    this.logger.log(`Opportunity ${row.code} created from BuyerRequest proposal selection (BUYER_REQUEST)`);
    return { id: row.id, code: row.code };
  }

  async listOpportunities(query: OpportunityListQueryInput): Promise<SalesListResult<OpportunityDto>> {
    return this.query.listOpportunities(query);
  }

  async getOpportunityByCode(code: string): Promise<OpportunityDto> {
    return this.query.getOpportunityByCode(code);
  }

  async transitionOpportunity(code: string, to: OpportunityStatus, actor: Actor): Promise<OpportunityDto> {
    return this.lifecycle.transitionOpportunity(code, to, actor) as Promise<OpportunityDto>;
  }

  /* ── Quote (delegated → quoteWrites) ───────────────────────────────────── */

  async createQuote(
    input: { customerId?: string | null; opportunityId?: string | null; productId?: string | null },
    actor: Actor,
  ): Promise<QuoteDto> {
    return this.quoteWrites.createQuote(input, actor);
  }

  async listQuotes(query: QuoteListQueryInput): Promise<SalesListResult<QuoteDto>> {
    return this.query.listQuotes(query);
  }

  async getQuoteByCode(code: string): Promise<QuoteDto> {
    return this.query.getQuoteByCode(code);
  }

  async issueQuote(code: string, actor: Actor): Promise<QuoteDetailDto> {
    return this.quoteWrites.issueQuote(code, (c) => this.getQuoteDetail(c), actor);
  }

  async getQuoteDetail(code: string): Promise<QuoteDetailDto> {
    return this.query.getQuoteDetail(code);
  }

  async addQuoteItem(
    code: string,
    input: { productId: string; tariffId: string; quantity: number; serviceDate?: string; durationDays?: number },
    actor: Actor,
  ): Promise<QuoteDetailDto> {
    return this.quoteWrites.addQuoteItem(code, input, (c) => this.getQuoteDetail(c), actor);
  }

  async updateQuoteItem(code: string, itemId: string, quantity: number, actor: Actor): Promise<QuoteDetailDto> {
    return this.quoteWrites.updateQuoteItem(code, itemId, quantity, (c) => this.getQuoteDetail(c), actor);
  }

  async removeQuoteItem(code: string, itemId: string, actor: Actor): Promise<QuoteDetailDto> {
    return this.quoteWrites.removeQuoteItem(code, itemId, (c) => this.getQuoteDetail(c), actor);
  }

  async setQuoteCustomer(code: string, customerId: string | null, actor: Actor): Promise<QuoteDetailDto> {
    return this.quoteWrites.setQuoteCustomer(code, customerId, (c) => this.getQuoteDetail(c), actor);
  }

  async setQuoteTravelers(code: string, travelers: Array<{ firstName: string; lastName: string; birthDate?: string | null }>, actor: Actor): Promise<QuoteDetailDto> {
    return this.quoteWrites.setQuoteTravelers(code, travelers, (c) => this.getQuoteDetail(c), actor);
  }

  async setQuoteCommercial(
    code: string,
    input: { discountType: QuoteDiscountType; discountValue?: string | null; validUntil?: string | null },
    actor: Actor,
  ): Promise<QuoteDetailDto> {
    return this.quoteWrites.setQuoteCommercial(code, input, (c) => this.getQuoteDetail(c), actor);
  }

  /* ── Sale ───────────────────────────────────────────────────────────────── */

  async createSale(
    input: { customerId?: string | null; opportunityId?: string | null; quoteId?: string | null; checkoutIntentId?: string | null },
    actor: Actor,
  ): Promise<SaleDto> {
    return this.quoteWrites.createSale(input, actor);
  }

  async listSales(query: SaleListQueryInput): Promise<SalesListResult<SaleDto>> {
    return this.query.listSales(query);
  }

  async getSaleByCode(code: string): Promise<SaleDto> {
    return this.query.getSaleByCode(code);
  }

  /**
   * Step 2.4 — canonical Sale completion → OrderRequested.
   * MUST STAY: uses CatalogService.reserveAvailability + EventBusService.
   * This is the sole write method that crosses Sales boundaries (reservation + outbox).
   */
  async completeSale(code: string, expectedVersion: number, actor: Actor): Promise<SaleDetailCompletionDto> {
    return this.completion.completeSale(code, expectedVersion, (row) => this.assertCheckoutMutable(row), actor);
  }

  /* ── CheckoutIntent (delegated → checkoutWrites) ──────────────────────── */

  async createCheckoutIntent(
    input: {
      quoteId: string;
      customerId?: string | null;
      serviceDate?: string | null;
      travelers?: Array<{ firstName: string; lastName: string; birthDate?: string | null }> | null;
    },
    actor: Actor,
  ): Promise<CheckoutIntentDetailDto> {
    return this.checkoutWrites.createCheckoutIntent(input, (c) => this.getCheckoutIntentDetail(c), actor);
  }

  async listCheckoutIntents(query: CheckoutListQueryInput): Promise<SalesListResult<CheckoutIntentDto>> {
    return this.query.listCheckoutIntents(query);
  }

  async getCheckoutIntentByCode(code: string): Promise<CheckoutIntentDetailDto> {
    return this.query.getCheckoutIntentByCode(code);
  }

  async checkoutIntentHistory(code: string, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<SalesListResult<SalesHistoryItemDto>> {
    return this.query.checkoutIntentHistory(code, page, pageSize);
  }

  async setCheckoutTravelers(
    code: string,
    travelers: Array<{ firstName: string; lastName: string; birthDate?: string | null }>,
    expectedVersion: number,
    actor: Actor,
  ): Promise<CheckoutIntentDetailDto> {
    return this.checkoutWrites.setCheckoutTravelers(code, travelers, expectedVersion, (c) => this.getCheckoutIntentDetail(c), actor);
  }

  async setCheckoutServiceDate(
    code: string,
    input: { serviceDate: string; serviceTime?: string | null; serviceEndTime?: string | null },
    expectedVersion: number,
    actor: Actor,
  ): Promise<CheckoutIntentDetailDto> {
    return this.checkoutWrites.setCheckoutServiceDate(code, input, expectedVersion, (c) => this.getCheckoutIntentDetail(c), actor);
  }

  async revalidateCheckoutIntent(code: string, expectedVersion: number, actor: Actor): Promise<CheckoutIntentDetailDto> {
    return this.checkoutWrites.revalidateCheckoutIntent(code, expectedVersion, (qid) => this.checkoutQuoteItems(qid), (items, sd) => this.availabilityFor(items, sd), (c) => this.getCheckoutIntentDetail(c), actor);
  }

  async cancelCheckoutIntent(code: string, expectedVersion: number, actor: Actor): Promise<CheckoutIntentDetailDto> {
    return this.checkoutWrites.cancelCheckoutIntent(code, expectedVersion, (c) => this.getCheckoutIntentDetail(c), actor);
  }

  async setCheckoutPaymentTerms(
    code: string,
    input: {
      scheme: PaymentScheme;
      prepaymentType?: "PERCENTAGE" | "FIXED" | null;
      prepaymentValue?: string | null;
    },
    expectedVersion: number,
    actor: Actor,
  ): Promise<CheckoutIntentDetailDto> {
    return this.checkoutWrites.setCheckoutPaymentTerms(code, input, expectedVersion, (c) => this.getCheckoutIntentDetail(c), actor);
  }

  /* ── History (delegated → query) ──────────────────────────────────────── */

  async leadHistory(code: string, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<SalesListResult<SalesHistoryItemDto>> {
    return this.query.leadHistory(code, page, pageSize);
  }

  async opportunityHistory(code: string, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<SalesListResult<SalesHistoryItemDto>> {
    return this.query.opportunityHistory(code, page, pageSize);
  }

  async quoteHistory(code: string, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<SalesListResult<SalesHistoryItemDto>> {
    return this.query.quoteHistory(code, page, pageSize);
  }

  async saleHistory(code: string, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<SalesListResult<SalesHistoryItemDto>> {
    return this.query.saleHistory(code, page, pageSize);
  }

  /* ── Assign (delegated → lifecycle) ──────────────────────────────────── */

  async assignLead(code: string, assignedToId: string | null, actor: Actor): Promise<LeadDto> {
    return this.lifecycle.assignLead(code, assignedToId, actor) as Promise<LeadDto>;
  }

  async assignOpportunity(code: string, assignedToId: string | null, actor: Actor): Promise<OpportunityDto> {
    return this.lifecycle.assignOpportunity(code, assignedToId, actor) as Promise<OpportunityDto>;
  }

  /* ── Center (delegated → query) ──────────────────────────────────────── */

  async centerKpi(from?: string, to?: string): Promise<SalesKpiDto> {
    return this.query.centerKpi(from, to);
  }

  async centerQueue(queue: SalesQueueKey, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<SalesListResult<LeadDto | OpportunityDto | QuoteDto | SaleDto>> {
    return this.query.centerQueue(queue, page, pageSize);
  }

  /* ── Private helpers (used by completeSale + revalidate) ─────────────── */

  /** Only ACTIVE intent is mutable (cancelled = terminal). */
  private assertCheckoutMutable(row: { status: CheckoutStatus; code: string }): void {
    if (row.status !== CheckoutStatus.ACTIVE) {
      throw new ValidationDomainError(`CheckoutIntent ${row.code} is ${row.status}`);
    }
  }

  private async getCheckoutIntentDetail(code: string): Promise<CheckoutIntentDetailDto> {
    return this.query.getCheckoutIntentByCode(code);
  }

  private async checkoutQuoteItems(quoteId: string): Promise<
    Array<{ id: string; productId: string; productCode: string; productTitle: string; tariffId: string; tariffCode: string; quantity: number }>
  > {
    return this.prisma.quoteItem.findMany({
      where: { quoteId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        productId: true,
        productCode: true,
        productTitle: true,
        tariffId: true,
        tariffCode: true,
        quantity: true,
      },
    });
  }

  private async availabilityFor(
    items: Array<{ id: string; productId: string; productCode: string; productTitle: string; tariffId: string; tariffCode: string; quantity: number }>,
    serviceDate: Date | null,
  ): Promise<CheckoutIntentAvailabilityDto> {
    if (!serviceDate) {
      return { state: "NOT_SPECIFIED", checkedAt: null, semantics: CHECKOUT_AVAILABILITY_SEMANTICS, items: [] };
    }
    const rows = await this.prisma.availability.findMany({
      where: { date: serviceDate, ...(items.length > 0 ? { OR: items.map((i) => ({ productId: i.productId, tariffId: i.tariffId })) } : {}) },
      select: { productId: true, tariffId: true, slotsTotal: true, slotsBooked: true, slotsReserved: true },
    });
    const byKey = new Map(rows.map((r) => [`${r.productId}:${r.tariffId}`, r]));
    const itemDtos = items.map((i) => {
      const row = byKey.get(`${i.productId}:${i.tariffId}`) ?? null;
      const cls = classifyAvailability(i.quantity, row);
      return {
        itemId: i.id,
        productId: i.productId,
        productCode: i.productCode,
        productTitle: i.productTitle,
        tariffId: i.tariffId,
        tariffCode: i.tariffCode,
        quantity: i.quantity,
        required: i.quantity,
        slotsTotal: row?.slotsTotal ?? null,
        slotsBooked: row?.slotsBooked ?? null,
        slotsReserved: row?.slotsReserved ?? null,
        availableSlots: cls.availableSlots,
        level: cls.level,
      };
    });
    return { state: "CHECKED_NOT_RESERVED", checkedAt: isoUtc(new Date()), semantics: CHECKOUT_AVAILABILITY_SEMANTICS, items: itemDtos };
  }
}

/** Step 2.12E (ADR-0013 D15): re-exported for finance commission boundary. */
export function mapCommissionChannelFromAcquisition(source: SalesAcquisitionSource | null | undefined): CommissionChannel | null {
  return source === SalesAcquisitionSource.MARKETPLACE ? CommissionChannel.MARKETPLACE : null;
}
