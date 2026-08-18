/**
 * STEP 2.17C — Wave 2: SalesQueryService (read-only methods).
 *
 * Extracted from SalesService facade. All methods are read-only (no
 * transactions, no writes). The facade delegates read methods here.
 * Wave 0 characterization tests verify behavior preservation through
 * the facade's public API.
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NotFoundError } from "../../shared/errors";
import { isoUtc } from "../../shared/temporal";
import { Prisma } from "../../generated/prisma/client";
import {
  CheckoutStatus,
  LeadStatus,
  OpportunityStatus,
  QuoteStatus,
  SaleStatus,
} from "../../generated/prisma/enums";
import {
  buildCheckoutListWhere,
  buildLeadListWhere,
  buildOpportunityListWhere,
  buildQuoteListWhere,
  buildSaleListWhere,
  createdAtRange,
  salesOrderBy,
  SALES_QUEUES,
  type CheckoutListQueryInput,
  type LeadListQueryInput,
  type OpportunityListQueryInput,
  type QuoteListQueryInput,
  type SaleListQueryInput,
  type SalesQueueKey,
} from "./sales.filters";
import { pagination, entityHistory, PAGE_SIZE_DEFAULT } from "./sales.history";
import {
  toLeadDto,
  toOpportunityDto,
  toQuoteDto,
  toQuoteDetailDto,
  toCheckoutIntentDto,
  toCheckoutIntentDetailDto,
  toSaleDto,
  checkoutQuoteMeta,
} from "./sales.projection";
import { classifyAvailability } from "./sales.checkout";
import type {
  CheckoutIntentAvailabilityDto,
  CheckoutIntentDetailDto,
  CheckoutIntentDto,
  SalesHistoryItemDto,
  SalesKpiDto,
  SalesListResult,
  LeadDto,
  OpportunityDto,
  QuoteDto,
  SaleDto,
} from "./sales.contracts";

const CHECKOUT_AVAILABILITY_SEMANTICS =
  "checked, not reserved — read-only capacity snapshot; no capacity hold (reservation/locking owner is the Order/Booking boundary, Step 2.4)";

function toStatusMap<E extends string>(
  rows: Array<{ status: E; _count: { _all: number } }>,
  enumValues: Record<string, E> | readonly E[],
): Record<string, number> {
  const values = Array.isArray(enumValues) ? enumValues : Object.values(enumValues);
  const map: Record<string, number> = {};
  for (const v of values) map[v] = 0;
  for (const r of rows) map[r.status] = r._count._all;
  return map;
}

@Injectable()
export class SalesQueryService {
  private readonly logger = new Logger(SalesQueryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /* ── Lead reads ──────────────────────────────────────────────────────────── */

  async listLeads(query: LeadListQueryInput): Promise<SalesListResult<LeadDto>> {
    const { p, ps } = pagination(query.page, query.pageSize);
    const where = buildLeadListWhere(query);
    const orderBy = salesOrderBy(query.sort, query.order) as Prisma.LeadOrderByWithRelationInput[];
    const [items, total] = await Promise.all([
      this.prisma.lead.findMany({ where, orderBy, skip: (p - 1) * ps, take: ps }),
      this.prisma.lead.count({ where }),
    ]);
    return { items: items.map((r) => toLeadDto(r)), total, page: p, pageSize: ps, hasMore: p * ps < total };
  }

  async getLeadByCode(code: string): Promise<LeadDto> {
    const row = await this.prisma.lead.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Lead ${code} not found`);
    return toLeadDto(row);
  }

  async leadHistory(code: string, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<SalesListResult<SalesHistoryItemDto>> {
    const row = await this.prisma.lead.findUnique({ where: { code }, select: { id: true } });
    if (!row) throw new NotFoundError(`Lead ${code} not found`);
    return entityHistory(this.prisma, "leadHistory", row.id, page, pageSize);
  }

  /* ── Opportunity reads ───────────────────────────────────────────────────── */

  async listOpportunities(query: OpportunityListQueryInput): Promise<SalesListResult<OpportunityDto>> {
    const { p, ps } = pagination(query.page, query.pageSize);
    const where = buildOpportunityListWhere(query);
    const orderBy = salesOrderBy(query.sort, query.order) as Prisma.OpportunityOrderByWithRelationInput[];
    const [items, total] = await Promise.all([
      this.prisma.opportunity.findMany({ where, orderBy, skip: (p - 1) * ps, take: ps }),
      this.prisma.opportunity.count({ where }),
    ]);
    return { items: items.map((r) => toOpportunityDto(r)), total, page: p, pageSize: ps, hasMore: p * ps < total };
  }

  async getOpportunityByCode(code: string): Promise<OpportunityDto> {
    const row = await this.prisma.opportunity.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Opportunity ${code} not found`);
    return toOpportunityDto(row);
  }

  async opportunityHistory(code: string, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<SalesListResult<SalesHistoryItemDto>> {
    const row = await this.prisma.opportunity.findUnique({ where: { code }, select: { id: true } });
    if (!row) throw new NotFoundError(`Opportunity ${code} not found`);
    return entityHistory(this.prisma, "opportunityHistory", row.id, page, pageSize);
  }

  /* ── Quote reads ─────────────────────────────────────────────────────────── */

  async listQuotes(query: QuoteListQueryInput): Promise<SalesListResult<QuoteDto>> {
    const { p, ps } = pagination(query.page, query.pageSize);
    const where = buildQuoteListWhere(query);
    const orderBy = salesOrderBy(query.sort, query.order) as Prisma.QuoteOrderByWithRelationInput[];
    const [items, total] = await Promise.all([
      this.prisma.quote.findMany({ where, orderBy, skip: (p - 1) * ps, take: ps }),
      this.prisma.quote.count({ where }),
    ]);
    return { items: items.map((r) => toQuoteDto(r)), total, page: p, pageSize: ps, hasMore: p * ps < total };
  }

  async getQuoteByCode(code: string): Promise<QuoteDto> {
    const row = await this.prisma.quote.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);
    return toQuoteDto(row);
  }

  async getQuoteDetail(code: string): Promise<import("./sales.contracts").QuoteDetailDto> {
    const row = await this.prisma.quote.findUnique({
      where: { code },
      include: {
        items: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        travelers: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      },
    });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);
    return toQuoteDetailDto(row);
  }

  async quoteHistory(code: string, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<SalesListResult<SalesHistoryItemDto>> {
    const row = await this.prisma.quote.findUnique({ where: { code }, select: { id: true } });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);
    return entityHistory(this.prisma, "quoteHistory", row.id, page, pageSize);
  }

  /* ── Sale reads ──────────────────────────────────────────────────────────── */

  async listSales(query: SaleListQueryInput): Promise<SalesListResult<SaleDto>> {
    const { p, ps } = pagination(query.page, query.pageSize);
    const where = buildSaleListWhere(query);
    const orderBy = salesOrderBy(query.sort, query.order) as Prisma.SaleOrderByWithRelationInput[];
    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({ where, orderBy, skip: (p - 1) * ps, take: ps }),
      this.prisma.sale.count({ where }),
    ]);
    return { items: items.map((r) => toSaleDto(r)), total, page: p, pageSize: ps, hasMore: p * ps < total };
  }

  async getSaleByCode(code: string): Promise<SaleDto> {
    const row = await this.prisma.sale.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Sale ${code} not found`);
    return toSaleDto(row);
  }

  async saleHistory(code: string, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<SalesListResult<SalesHistoryItemDto>> {
    const row = await this.prisma.sale.findUnique({ where: { code }, select: { id: true } });
    if (!row) throw new NotFoundError(`Sale ${code} not found`);
    return entityHistory(this.prisma, "saleHistory", row.id, page, pageSize);
  }

  /* ── CheckoutIntent reads ────────────────────────────────────────────────── */

  async listCheckoutIntents(query: CheckoutListQueryInput): Promise<SalesListResult<CheckoutIntentDto>> {
    const { p, ps } = pagination(query.page, query.pageSize);
    const where = buildCheckoutListWhere(query);
    const orderBy = salesOrderBy(query.sort, query.order) as Prisma.CheckoutIntentOrderByWithRelationInput[];
    const [items, total] = await Promise.all([
      this.prisma.checkoutIntent.findMany({ where, orderBy, skip: (p - 1) * ps, take: ps }),
      this.prisma.checkoutIntent.count({ where }),
    ]);
    // Batch quote meta (quoteCode + validity) — один запрос, без N+1.
    const quoteIds = [...new Set(items.map((i) => i.quoteId))];
    const quotes =
      quoteIds.length > 0
        ? await this.prisma.quote.findMany({ where: { id: { in: quoteIds } }, select: { id: true, code: true, validUntil: true } })
        : [];
    const quoteMap = new Map(quotes.map((q) => [q.id, q]));
    return {
      items: items.map((r) => toCheckoutIntentDto(r, checkoutQuoteMeta(quoteMap.get(r.quoteId) ?? null))),
      total,
      page: p,
      pageSize: ps,
      hasMore: p * ps < total,
    };
  }

  async getCheckoutIntentByCode(code: string): Promise<CheckoutIntentDetailDto> {
    return this.getCheckoutIntentDetail(code);
  }

  async checkoutIntentHistory(code: string, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<SalesListResult<SalesHistoryItemDto>> {
    const row = await this.prisma.checkoutIntent.findUnique({ where: { code }, select: { id: true } });
    if (!row) throw new NotFoundError(`CheckoutIntent ${code} not found`);
    return entityHistory(this.prisma, "checkoutIntentHistory", row.id, page, pageSize);
  }

  /* ── CheckoutIntent detail (read-only projection) ────────────────────────── */

  async checkoutQuoteItems(quoteId: string): Promise<
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

  async availabilityFor(
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

  private async getCheckoutIntentDetail(code: string): Promise<CheckoutIntentDetailDto> {
    const row = await this.prisma.checkoutIntent.findUnique({
      where: { code },
      include: { travelers: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
    });
    if (!row) throw new NotFoundError(`CheckoutIntent ${code} not found`);
    const quote = await this.prisma.quote.findUnique({
      where: { id: row.quoteId },
      select: { code: true, validUntil: true },
    });
    if (!quote) throw new NotFoundError(`Quote for CheckoutIntent ${code} not found`);
    const items = await this.checkoutQuoteItems(row.quoteId);
    const availability = await this.availabilityFor(items, row.serviceDate);
    return toCheckoutIntentDetailDto(row, checkoutQuoteMeta(quote), availability);
  }

  /* ── Sales Center reads ──────────────────────────────────────────────────── */

  async centerKpi(from?: string, to?: string): Promise<SalesKpiDto> {
    const range = createdAtRange(from, to);
    const where = Object.keys(range).length > 0 ? range : {};
    const period = { from: from ?? null, to: to ?? null };

    const [leadTotal, leadByStatus, leadUnassigned, oppTotal, oppByStatus, oppUnassigned, quoteByStatus, saleByStatus, oppFromLeads, quotesFromOpps, salesFromQuotes, salesFromOpps] =
      await Promise.all([
        this.prisma.lead.count({ where }),
        this.prisma.lead.groupBy({ by: ["status"], where, _count: { _all: true } }),
        this.prisma.lead.count({ where: { ...where, assignedToId: null } }),
        this.prisma.opportunity.count({ where }),
        this.prisma.opportunity.groupBy({ by: ["status"], where, _count: { _all: true } }),
        this.prisma.opportunity.count({ where: { ...where, assignedToId: null } }),
        this.prisma.quote.groupBy({ by: ["status"], where, _count: { _all: true } }),
        this.prisma.sale.groupBy({ by: ["status"], where, _count: { _all: true } }),
        this.prisma.opportunity.count({ where: { ...where, leadId: { not: null } } }),
        this.prisma.quote.count({ where: { ...where, opportunityId: { not: null } } }),
        this.prisma.sale.count({ where: { ...where, quoteId: { not: null } } }),
        this.prisma.sale.count({ where: { ...where, opportunityId: { not: null } } }),
      ]);

    return {
      period,
      leads: { total: leadTotal, byStatus: toStatusMap(leadByStatus, LeadStatus), unassigned: leadUnassigned },
      opportunities: { total: oppTotal, byStatus: toStatusMap(oppByStatus, OpportunityStatus), unassigned: oppUnassigned },
      quotes: { total: quoteByStatus.reduce((s, r) => s + r._count._all, 0), byStatus: toStatusMap(quoteByStatus, QuoteStatus) },
      sales: { total: saleByStatus.reduce((s, r) => s + r._count._all, 0), byStatus: toStatusMap(saleByStatus, SaleStatus) },
      funnel: {
        opportunitiesFromLeads: oppFromLeads,
        quotesFromOpportunities: quotesFromOpps,
        salesFromQuotes: salesFromQuotes,
        salesFromOpportunities: salesFromOpps,
      },
    };
  }

  async centerQueue(queue: SalesQueueKey, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<SalesListResult<LeadDto | OpportunityDto | QuoteDto | SaleDto>> {
    const def = SALES_QUEUES[queue];
    const unassigned = (def as { unassigned?: boolean }).unassigned ?? false;
    const { p, ps } = pagination(page, pageSize);
    const skip = (p - 1) * ps;

    if (def.entity === "lead") {
      const where: Prisma.LeadWhereInput = { status: def.status as LeadStatus, ...(unassigned ? { assignedToId: null } : {}) };
      const [items, total] = await Promise.all([
        this.prisma.lead.findMany({ where, orderBy: [{ createdAt: "asc" }, { code: "asc" }], skip, take: ps }),
        this.prisma.lead.count({ where }),
      ]);
      return { items: items.map((r) => toLeadDto(r)), total, page: p, pageSize: ps, hasMore: p * ps < total };
    }
    if (def.entity === "opportunity") {
      const where: Prisma.OpportunityWhereInput = { status: def.status as OpportunityStatus, ...(unassigned ? { assignedToId: null } : {}) };
      const [items, total] = await Promise.all([
        this.prisma.opportunity.findMany({ where, orderBy: [{ createdAt: "asc" }, { code: "asc" }], skip, take: ps }),
        this.prisma.opportunity.count({ where }),
      ]);
      return { items: items.map((r) => toOpportunityDto(r)), total, page: p, pageSize: ps, hasMore: p * ps < total };
    }
    if (def.entity === "quote") {
      const where: Prisma.QuoteWhereInput = { status: def.status as QuoteStatus };
      const [items, total] = await Promise.all([
        this.prisma.quote.findMany({ where, orderBy: [{ createdAt: "asc" }, { code: "asc" }], skip, take: ps }),
        this.prisma.quote.count({ where }),
      ]);
      return { items: items.map((r) => toQuoteDto(r)), total, page: p, pageSize: ps, hasMore: p * ps < total };
    }
    const where: Prisma.SaleWhereInput = { status: def.status as SaleStatus };
    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({ where, orderBy: [{ createdAt: "asc" }, { code: "asc" }], skip, take: ps }),
      this.prisma.sale.count({ where }),
    ]);
    return { items: items.map((r) => toSaleDto(r)), total, page: p, pageSize: ps, hasMore: p * ps < total };
  }
}
