import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { isoUtc } from "../../shared/temporal";
import type { Prisma } from "../../generated/prisma/client";
import {
  LeadStatus,
  OpportunityStatus,
  ProductStatus,
  QuoteDiscountType,
  QuoteStatus,
  RoleCode,
  SaleStatus,
} from "../../generated/prisma/enums";
import {
  assertLeadTransition,
  assertOpportunityTransition,
  assertQuoteComposable,
  assertQuoteTransition,
} from "./sales.validation";
import {
  discountAmountOf,
  lineAmount,
  subtotalOf,
  totalOf,
  validateDiscountValue,
} from "./sales.money";
import {
  buildLeadListWhere,
  buildOpportunityListWhere,
  buildQuoteListWhere,
  buildSaleListWhere,
  createdAtRange,
  salesOrderBy,
  SALES_QUEUES,
  type LeadListQueryInput,
  type OpportunityListQueryInput,
  type QuoteListQueryInput,
  type SaleListQueryInput,
  type SalesQueueKey,
} from "./sales.filters";
import type {
  LeadDto,
  OpportunityDto,
  QuoteDetailDto,
  QuoteDto,
  QuoteItemDto,
  QuoteTravelerDto,
  SaleDto,
  SalesHistoryItemDto,
  SalesKpiDto,
  SalesListResult,
} from "./sales.contracts";

const PAGE_SIZE_MAX = 50;
const PAGE_SIZE_DEFAULT = 20;

interface Actor {
  id: string;
  username: string;
}

/**
 * PHASE 2 STEP 2.1 — Sales Domain Foundation (sales.*, новый bounded context).
 *
 * Владелец Sales-сущностей — Sales (ADR-0001): НЕ пишет в Catalog/CRM/Order/
 * Booking/Finance/Security. Cross-domain ссылки (customerId → crm.Customer,
 * assignedToId → security.User, productId → catalog.Product) — read-by-ID
 * валидация существования (ADR-0001), без FK и без расширения прав.
 *
 * Инварианты:
 *  - Sale ≠ Order: создание/переходы НЕ создают Order/Booking/Payment, не
 *    резервируют Availability (Step 2.3A/2.4), не публикуют OrderRequested;
 *  - behavioral события НЕ создают Lead (никакого автоматического consumer);
 *  - переходы детерминированные (sales.validation) + CAS по version →
 *    двойной переход/retry не создаёт дубликат history-milestone;
 *  - canonical коды LED-/OPP-/QTE-/SAL- через BusinessSequence (атомарно);
 *  - history (audit by default) + AuditLog (без PII/body);
 *  - money-поля отсутствуют (monetary contract — Step 2.3A/2.4);
 *  - PII не копируется (только canonical customerId reference).
 */
@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
  ) {}

  /* ── Lead ───────────────────────────────────────────────────────────────── */

  async createLead(
    input: { name: string; customerId?: string | null; assignedToId?: string | null },
    actor: Actor,
  ): Promise<LeadDto> {
    const name = input.name.trim();
    if (name.length === 0) throw new ValidationDomainError("Lead name is required");
    if (name.length > 200) throw new ValidationDomainError("Lead name is too long (max 200)");

    await this.assertOptionalCustomer(input.customerId);
    await this.assertOptionalUser(input.assignedToId);

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "LED");
      const row = await tx.lead.create({
        data: {
          code,
          name,
          customerId: input.customerId ?? null,
          assignedToId: input.assignedToId ?? null,
          status: LeadStatus.NEW,
          createdById: actor.id,
        },
      });
      await this.writeHistory(tx, "leadHistory", row.id, "created", null, row.status, actor, { name });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.lead.created",
        resource: "Lead",
        resourceId: row.id,
        details: { code: row.code, status: row.status },
      });
      return row;
    });
    this.logger.log(`Lead ${created.code} created by ${actor.username}`);
    return this.toLeadDto(created);
  }

  async listLeads(query: LeadListQueryInput): Promise<SalesListResult<LeadDto>> {
    const { p, ps } = this.pagination(query.page, query.pageSize);
    const where = buildLeadListWhere(query);
    const orderBy = salesOrderBy(query.sort, query.order) as Prisma.LeadOrderByWithRelationInput[];
    const [items, total] = await Promise.all([
      this.prisma.lead.findMany({ where, orderBy, skip: (p - 1) * ps, take: ps }),
      this.prisma.lead.count({ where }),
    ]);
    return { items: items.map((r) => this.toLeadDto(r)), total, page: p, pageSize: ps, hasMore: p * ps < total };
  }

  async getLeadByCode(code: string): Promise<LeadDto> {
    const row = await this.prisma.lead.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Lead ${code} not found`);
    return this.toLeadDto(row);
  }

  async transitionLead(code: string, to: LeadStatus, actor: Actor): Promise<LeadDto> {
    const row = await this.prisma.lead.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Lead ${code} not found`);
    assertLeadTransition(row.status, to);

    const updated = await this.prisma.$transaction(async (tx) => {
      // CAS по version: concurrent duplicate transition не проходит дважды.
      const res = await tx.lead.updateMany({
        where: { id: row.id, version: row.version },
        data: { status: to, version: { increment: 1 } },
      });
      if (res.count === 0) throw new ConflictError(`Lead ${code} was modified concurrently; retry`);
      const fresh = await tx.lead.findUniqueOrThrow({ where: { id: row.id } });
      await this.writeHistory(tx, "leadHistory", row.id, "status_changed", row.status, to, actor, {});
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.lead.status_changed",
        resource: "Lead",
        resourceId: row.id,
        details: { code: row.code, from: row.status, to },
      });
      return fresh;
    });
    return this.toLeadDto(updated);
  }

  /* ── Opportunity ────────────────────────────────────────────────────────── */

  async createOpportunity(
    input: { title: string; leadId?: string | null; customerId?: string | null; assignedToId?: string | null },
    actor: Actor,
  ): Promise<OpportunityDto> {
    const title = input.title.trim();
    if (title.length === 0) throw new ValidationDomainError("Opportunity title is required");
    if (title.length > 200) throw new ValidationDomainError("Opportunity title is too long (max 200)");

    if (input.leadId) {
      const lead = await this.prisma.lead.findUnique({ where: { id: input.leadId }, select: { id: true } });
      if (!lead) throw new ValidationDomainError(`Lead ${input.leadId} does not exist`);
    }
    await this.assertOptionalCustomer(input.customerId);
    await this.assertOptionalUser(input.assignedToId);

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "OPP");
      const row = await tx.opportunity.create({
        data: {
          code,
          title,
          leadId: input.leadId ?? null,
          customerId: input.customerId ?? null,
          assignedToId: input.assignedToId ?? null,
          status: OpportunityStatus.NEW,
          createdById: actor.id,
        },
      });
      await this.writeHistory(tx, "opportunityHistory", row.id, "created", null, row.status, actor, { title });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.opportunity.created",
        resource: "Opportunity",
        resourceId: row.id,
        details: { code: row.code, status: row.status },
      });
      return row;
    });
    return this.toOpportunityDto(created);
  }

  async listOpportunities(query: OpportunityListQueryInput): Promise<SalesListResult<OpportunityDto>> {
    const { p, ps } = this.pagination(query.page, query.pageSize);
    const where = buildOpportunityListWhere(query);
    const orderBy = salesOrderBy(query.sort, query.order) as Prisma.OpportunityOrderByWithRelationInput[];
    const [items, total] = await Promise.all([
      this.prisma.opportunity.findMany({ where, orderBy, skip: (p - 1) * ps, take: ps }),
      this.prisma.opportunity.count({ where }),
    ]);
    return { items: items.map((r) => this.toOpportunityDto(r)), total, page: p, pageSize: ps, hasMore: p * ps < total };
  }

  async getOpportunityByCode(code: string): Promise<OpportunityDto> {
    const row = await this.prisma.opportunity.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Opportunity ${code} not found`);
    return this.toOpportunityDto(row);
  }

  async transitionOpportunity(code: string, to: OpportunityStatus, actor: Actor): Promise<OpportunityDto> {
    const row = await this.prisma.opportunity.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Opportunity ${code} not found`);
    assertOpportunityTransition(row.status, to);

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.opportunity.updateMany({
        where: { id: row.id, version: row.version },
        data: { status: to, version: { increment: 1 } },
      });
      if (res.count === 0) throw new ConflictError(`Opportunity ${code} was modified concurrently; retry`);
      const fresh = await tx.opportunity.findUniqueOrThrow({ where: { id: row.id } });
      await this.writeHistory(tx, "opportunityHistory", row.id, "status_changed", row.status, to, actor, {});
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.opportunity.status_changed",
        resource: "Opportunity",
        resourceId: row.id,
        details: { code: row.code, from: row.status, to },
      });
      return fresh;
    });
    return this.toOpportunityDto(updated);
  }

  /* ── Quote ──────────────────────────────────────────────────────────────── */

  async createQuote(
    input: { customerId?: string | null; opportunityId?: string | null; productId?: string | null },
    actor: Actor,
  ): Promise<QuoteDto> {
    if (input.opportunityId) {
      const opp = await this.prisma.opportunity.findUnique({ where: { id: input.opportunityId }, select: { id: true } });
      if (!opp) throw new ValidationDomainError(`Opportunity ${input.opportunityId} does not exist`);
    }
    await this.assertOptionalCustomer(input.customerId);
    await this.assertOptionalProduct(input.productId);

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "QTE");
      const row = await tx.quote.create({
        data: {
          code,
          customerId: input.customerId ?? null,
          opportunityId: input.opportunityId ?? null,
          productId: input.productId ?? null,
          status: QuoteStatus.DRAFT,
          createdById: actor.id,
        },
      });
      await this.writeHistory(tx, "quoteHistory", row.id, "created", null, row.status, actor, {});
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
    return this.toQuoteDto(created);
  }

  async listQuotes(query: QuoteListQueryInput): Promise<SalesListResult<QuoteDto>> {
    const { p, ps } = this.pagination(query.page, query.pageSize);
    const where = buildQuoteListWhere(query);
    const orderBy = salesOrderBy(query.sort, query.order) as Prisma.QuoteOrderByWithRelationInput[];
    const [items, total] = await Promise.all([
      this.prisma.quote.findMany({ where, orderBy, skip: (p - 1) * ps, take: ps }),
      this.prisma.quote.count({ where }),
    ]);
    return { items: items.map((r) => this.toQuoteDto(r)), total, page: p, pageSize: ps, hasMore: p * ps < total };
  }

  async getQuoteByCode(code: string): Promise<QuoteDto> {
    const row = await this.prisma.quote.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);
    return this.toQuoteDto(row);
  }

  /**
   * Step 2.3: ISSUE — atomic freeze коммерческого предложения.
   * Одна транзакция: CAS по version (concurrent edit → 409), валидация состава
   * (>=1 item, единая валюта, validUntil > now, discount bounds), расчёт
   * backend-authoritative totals (Decimal), персист subtotal/discountAmount/total/
   * issuedAt, history + audit. Нет состояния ISSUED без snapshot/history.
   * Повторный ISSUE — детерминированный 422 (terminal protection, lifecycle
   * convention Step 2.1). Никаких Order/Booking/OrderRequested/Payment effects.
   */
  async issueQuote(code: string, actor: Actor): Promise<QuoteDetailDto> {
    const row = await this.prisma.quote.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);

    const updated = await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.quote.findUniqueOrThrow({
        where: { id: row.id },
        include: { items: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
      });
      // Терминал: повторный ISSUE → 422 (deterministic conflict).
      assertQuoteTransition(fresh.status, QuoteStatus.ISSUED);
      // Валидация состава до CAS: ошибки → rollback без изменения состояния.
      if (fresh.items.length === 0) throw new ValidationDomainError(`Quote ${code} has no items; cannot issue`);
      const cur = fresh.items[0].currency;
      for (const it of fresh.items) {
        if (it.currency !== cur) throw new ValidationDomainError(`Quote ${code} has mixed currencies; cannot issue`);
      }
      const discountValue = validateDiscountValue(fresh.discountType, fresh.discountValue);
      // FIXED > subtotal → 422 внутри quoteTotals (строгий контракт, без silent
      // clamp; preview и ISSUE используют одинаковую семантику).
      const { subtotal, discountAmount, total } = this.quoteTotals(fresh.items, fresh.discountType, discountValue);
      if (!fresh.validUntil) throw new ValidationDomainError(`Quote ${code} requires validUntil before issue`);
      const now = new Date();
      if (fresh.validUntil <= now) throw new ValidationDomainError(`Quote ${code} validUntil must be in the future`);

      const res = await tx.quote.updateMany({
        where: { id: row.id, version: fresh.version },
        data: {
          status: QuoteStatus.ISSUED,
          issuedAt: now,
          version: { increment: 1 },
          subtotal,
          discountAmount,
          total,
        },
      });
      if (res.count === 0) throw new ConflictError(`Quote ${code} was modified concurrently; retry`);
      await this.writeHistory(tx, "quoteHistory", row.id, "issued", fresh.status, QuoteStatus.ISSUED, actor, {
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
      return fresh;
    });
    return this.getQuoteDetail(code);
  }

  /* ── Step 2.3 — Quote composition (DRAFT only, CAS + history + audit) ─────── */

  async getQuoteDetail(code: string): Promise<QuoteDetailDto> {
    const row = await this.prisma.quote.findUnique({
      where: { code },
      include: {
        items: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        travelers: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      },
    });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);
    return this.toQuoteDetailDto(row);
  }

  async addQuoteItem(
    code: string,
    input: { productId: string; tariffId: string; quantity: number },
    actor: Actor,
  ): Promise<QuoteDetailDto> {
    const row = await this.prisma.quote.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);
    assertQuoteComposable(row.status);
    const snap = await this.resolveEligibleTariff(input.productId, input.tariffId);
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
          unitPrice: snap.price,
          currency: snap.currency,
          amount,
        },
      });
      // Первый item фиксирует валюту КП.
      if (existing.length === 0) {
        await tx.quote.update({ where: { id: row.id }, data: { currency: snap.currency } });
      }
      await this.writeHistory(tx, "quoteHistory", row.id, "item_added", null, null, actor, {
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
    return this.getQuoteDetail(code);
  }

  async updateQuoteItem(code: string, itemId: string, quantity: number, actor: Actor): Promise<QuoteDetailDto> {
    const row = await this.prisma.quote.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);
    assertQuoteComposable(row.status);

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.quote.updateMany({ where: { id: row.id, version: row.version }, data: { version: { increment: 1 } } });
      if (res.count === 0) throw new ConflictError(`Quote ${code} was modified concurrently; retry`);
      const item = await tx.quoteItem.findFirst({ where: { id: itemId, quoteId: row.id } });
      if (!item) throw new NotFoundError(`Quote item ${itemId} not found in ${code}`);
      const amount = lineAmount(item.unitPrice, quantity);
      // Строгий FIXED-guard по ПРОСПЕКТИВНОМУ subtotal (до записи): уменьшение
      // quantity не может сделать FIXED > subtotal (422, без partial write).
      await this.assertFixedDiscountWithinSubtotal(tx, row.id, row.discountType, row.discountValue, { excludeItemId: itemId, replaceAmount: amount });
      await tx.quoteItem.update({ where: { id: itemId }, data: { quantity, amount } });
      await this.writeHistory(tx, "quoteHistory", row.id, "item_updated", null, null, actor, { itemId, quantity });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.quote.item_updated",
        resource: "Quote",
        resourceId: row.id,
        details: { code: row.code, itemId, quantity },
      });
    });
    return this.getQuoteDetail(code);
  }

  async removeQuoteItem(code: string, itemId: string, actor: Actor): Promise<QuoteDetailDto> {
    const row = await this.prisma.quote.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);
    assertQuoteComposable(row.status);

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.quote.updateMany({ where: { id: row.id, version: row.version }, data: { version: { increment: 1 } } });
      if (res.count === 0) throw new ConflictError(`Quote ${code} was modified concurrently; retry`);
      const item = await tx.quoteItem.findFirst({ where: { id: itemId, quoteId: row.id } });
      if (!item) throw new NotFoundError(`Quote item ${itemId} not found in ${code}`);
      // Строгий FIXED-guard: удаление item не может уменьшить subtotal ниже FIXED (до записи).
      await this.assertFixedDiscountWithinSubtotal(tx, row.id, row.discountType, row.discountValue, { excludeItemId: itemId });
      await tx.quoteItem.delete({ where: { id: itemId } });
      await this.writeHistory(tx, "quoteHistory", row.id, "item_removed", null, null, actor, { itemId });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.quote.item_removed",
        resource: "Quote",
        resourceId: row.id,
        details: { code: row.code, itemId },
      });
    });
    return this.getQuoteDetail(code);
  }

  async setQuoteCustomer(code: string, customerId: string | null, actor: Actor): Promise<QuoteDetailDto> {
    const row = await this.prisma.quote.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);
    assertQuoteComposable(row.status);
    await this.assertOptionalCustomer(customerId);

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.quote.updateMany({ where: { id: row.id, version: row.version }, data: { customerId, version: { increment: 1 } } });
      if (res.count === 0) throw new ConflictError(`Quote ${code} was modified concurrently; retry`);
      await this.writeHistory(tx, "quoteHistory", row.id, "customer_changed", null, null, actor, { customerId });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.quote.customer_changed",
        resource: "Quote",
        resourceId: row.id,
        details: { code: row.code, customerId },
      });
    });
    return this.getQuoteDetail(code);
  }

  async setQuoteTravelers(code: string, travelers: Array<{ firstName: string; lastName: string; birthDate?: string | null }>, actor: Actor): Promise<QuoteDetailDto> {
    const row = await this.prisma.quote.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);
    assertQuoteComposable(row.status);
    if (travelers.length > 50) throw new ValidationDomainError("Too many travelers (max 50)");
    for (const t of travelers) {
      if (t.firstName.trim().length === 0 || t.firstName.length > 100) throw new ValidationDomainError("firstName must be 1..100 chars");
      if (t.lastName.trim().length === 0 || t.lastName.length > 100) throw new ValidationDomainError("lastName must be 1..100 chars");
      if (t.birthDate && !isDateOnly(t.birthDate)) throw new ValidationDomainError("birthDate must be a calendar date (YYYY-MM-DD)");
      if (t.birthDate && new Date(`${t.birthDate}T00:00:00.000Z`).getTime() > Date.now()) {
        throw new ValidationDomainError("birthDate must not be in the future");
      }
    }

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
            // Date-only: календарная дата хранится как UTC midnight (без day-shift).
            birthDate: t.birthDate ? new Date(`${t.birthDate}T00:00:00.000Z`) : null,
          })),
        });
      }
      await this.writeHistory(tx, "quoteHistory", row.id, "travelers_changed", null, null, actor, { count: travelers.length });
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.quote.travelers_changed",
        resource: "Quote",
        resourceId: row.id,
        details: { code: row.code, count: travelers.length },
      });
    });
    return this.getQuoteDetail(code);
  }

  async setQuoteCommercial(
    code: string,
    input: { discountType: QuoteDiscountType; discountValue?: string | null; validUntil?: string | null },
    actor: Actor,
  ): Promise<QuoteDetailDto> {
    const row = await this.prisma.quote.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);
    assertQuoteComposable(row.status);
    const discountValue = validateDiscountValue(input.discountType, input.discountValue ?? null);
    // Строгий FIXED-guard ДО записи: FIXED > текущий subtotal → 422. Никакого
    // silent clamp и никакого partial write (невалидное состояние не сохраняется).
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
      await this.writeHistory(tx, "quoteHistory", row.id, "commercial_changed", null, null, actor, {
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
    return this.getQuoteDetail(code);
  }

  /* ── Sale ───────────────────────────────────────────────────────────────── */

  async createSale(
    input: { customerId?: string | null; opportunityId?: string | null; quoteId?: string | null },
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
    await this.assertOptionalCustomer(input.customerId);

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "SAL");
      const row = await tx.sale.create({
        data: {
          code,
          customerId: input.customerId ?? null,
          opportunityId: input.opportunityId ?? null,
          quoteId: input.quoteId ?? null,
          status: SaleStatus.OPEN,
          createdById: actor.id,
        },
      });
      await this.writeHistory(tx, "saleHistory", row.id, "created", null, row.status, actor, {});
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
    return this.toSaleDto(created);
  }

  async listSales(query: SaleListQueryInput): Promise<SalesListResult<SaleDto>> {
    const { p, ps } = this.pagination(query.page, query.pageSize);
    const where = buildSaleListWhere(query);
    const orderBy = salesOrderBy(query.sort, query.order) as Prisma.SaleOrderByWithRelationInput[];
    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({ where, orderBy, skip: (p - 1) * ps, take: ps }),
      this.prisma.sale.count({ where }),
    ]);
    return { items: items.map((r) => this.toSaleDto(r)), total, page: p, pageSize: ps, hasMore: p * ps < total };
  }

  async getSaleByCode(code: string): Promise<SaleDto> {
    const row = await this.prisma.sale.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Sale ${code} not found`);
    return this.toSaleDto(row);
  }

  /* ── History (Step 2.2, entity-scoped immutable projection) ─────────────── */

  async leadHistory(code: string, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<SalesListResult<SalesHistoryItemDto>> {
    const row = await this.prisma.lead.findUnique({ where: { code }, select: { id: true } });
    if (!row) throw new NotFoundError(`Lead ${code} not found`);
    return this.entityHistory("leadHistory", row.id, page, pageSize);
  }

  async opportunityHistory(code: string, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<SalesListResult<SalesHistoryItemDto>> {
    const row = await this.prisma.opportunity.findUnique({ where: { code }, select: { id: true } });
    if (!row) throw new NotFoundError(`Opportunity ${code} not found`);
    return this.entityHistory("opportunityHistory", row.id, page, pageSize);
  }

  async quoteHistory(code: string, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<SalesListResult<SalesHistoryItemDto>> {
    const row = await this.prisma.quote.findUnique({ where: { code }, select: { id: true } });
    if (!row) throw new NotFoundError(`Quote ${code} not found`);
    return this.entityHistory("quoteHistory", row.id, page, pageSize);
  }

  async saleHistory(code: string, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<SalesListResult<SalesHistoryItemDto>> {
    const row = await this.prisma.sale.findUnique({ where: { code }, select: { id: true } });
    if (!row) throw new NotFoundError(`Sale ${code} not found`);
    return this.entityHistory("saleHistory", row.id, page, pageSize);
  }

  /* ── Assign / reassign (Step 2.2, CAS + history + audit) ────────────────── */

  async assignLead(code: string, assignedToId: string | null, actor: Actor): Promise<LeadDto> {
    if (assignedToId !== null) await this.assertOptionalUser(assignedToId); // staff-only
    const row = await this.prisma.lead.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Lead ${code} not found`);

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.lead.updateMany({
        where: { id: row.id, version: row.version },
        data: { assignedToId, version: { increment: 1 } },
      });
      if (res.count === 0) throw new ConflictError(`Lead ${code} was modified concurrently; retry`);
      const fresh = await tx.lead.findUniqueOrThrow({ where: { id: row.id } });
      await this.writeHistory(tx, "leadHistory", row.id, "assigned", row.assignedToId, assignedToId, actor, {});
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.lead.assigned",
        resource: "Lead",
        resourceId: row.id,
        details: { code: row.code, from: row.assignedToId, to: assignedToId },
      });
      return fresh;
    });
    return this.toLeadDto(updated);
  }

  async assignOpportunity(code: string, assignedToId: string | null, actor: Actor): Promise<OpportunityDto> {
    if (assignedToId !== null) await this.assertOptionalUser(assignedToId); // staff-only
    const row = await this.prisma.opportunity.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`Opportunity ${code} not found`);

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.opportunity.updateMany({
        where: { id: row.id, version: row.version },
        data: { assignedToId, version: { increment: 1 } },
      });
      if (res.count === 0) throw new ConflictError(`Opportunity ${code} was modified concurrently; retry`);
      const fresh = await tx.opportunity.findUniqueOrThrow({ where: { id: row.id } });
      await this.writeHistory(tx, "opportunityHistory", row.id, "assigned", row.assignedToId, assignedToId, actor, {});
      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "sales.opportunity.assigned",
        resource: "Opportunity",
        resourceId: row.id,
        details: { code: row.code, from: row.assignedToId, to: assignedToId },
      });
      return fresh;
    });
    return this.toOpportunityDto(updated);
  }

  /* ── Center read models: KPI + queues (Step 2.2) ─────────────────────────── */

  async centerKpi(from?: string, to?: string): Promise<SalesKpiDto> {
    const range = createdAtRange(from, to); // валидирует from <= to (422)
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

  /**
   * Operational queue (read model): статусный predicate из canonical lifecycle,
   * oldest-first (FIFO work order), детерминированный tie-breaker code asc.
   * Никаких side effects при чтении; count и items — один и тот же predicate.
   */
  async centerQueue(queue: SalesQueueKey, page = 1, pageSize = PAGE_SIZE_DEFAULT): Promise<SalesListResult<LeadDto | OpportunityDto | QuoteDto | SaleDto>> {
    const def = SALES_QUEUES[queue];
    const unassigned = (def as { unassigned?: boolean }).unassigned ?? false;
    const { p, ps } = this.pagination(page, pageSize);
    const skip = (p - 1) * ps;

    // Каждая ветка — entity-specific типизация where (status из union кастится
    // безопасно: ключи очередей жёстко маппятся на свой enum в SALES_QUEUES).
    if (def.entity === "lead") {
      const where: Prisma.LeadWhereInput = { status: def.status as LeadStatus, ...(unassigned ? { assignedToId: null } : {}) };
      const [items, total] = await Promise.all([
        this.prisma.lead.findMany({ where, orderBy: [{ createdAt: "asc" }, { code: "asc" }], skip, take: ps }),
        this.prisma.lead.count({ where }),
      ]);
      return { items: items.map((r) => this.toLeadDto(r)), total, page: p, pageSize: ps, hasMore: p * ps < total };
    }
    if (def.entity === "opportunity") {
      const where: Prisma.OpportunityWhereInput = { status: def.status as OpportunityStatus, ...(unassigned ? { assignedToId: null } : {}) };
      const [items, total] = await Promise.all([
        this.prisma.opportunity.findMany({ where, orderBy: [{ createdAt: "asc" }, { code: "asc" }], skip, take: ps }),
        this.prisma.opportunity.count({ where }),
      ]);
      return { items: items.map((r) => this.toOpportunityDto(r)), total, page: p, pageSize: ps, hasMore: p * ps < total };
    }
    if (def.entity === "quote") {
      const where: Prisma.QuoteWhereInput = { status: def.status as QuoteStatus };
      const [items, total] = await Promise.all([
        this.prisma.quote.findMany({ where, orderBy: [{ createdAt: "asc" }, { code: "asc" }], skip, take: ps }),
        this.prisma.quote.count({ where }),
      ]);
      return { items: items.map((r) => this.toQuoteDto(r)), total, page: p, pageSize: ps, hasMore: p * ps < total };
    }
    const where: Prisma.SaleWhereInput = { status: def.status as SaleStatus };
    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({ where, orderBy: [{ createdAt: "asc" }, { code: "asc" }], skip, take: ps }),
      this.prisma.sale.count({ where }),
    ]);
    return { items: items.map((r) => this.toSaleDto(r)), total, page: p, pageSize: ps, hasMore: p * ps < total };
  }

  /* ── Internals ──────────────────────────────────────────────────────────── */

  /** Cross-domain read-by-ID (ADR-0001): crm.Customer существует. */
  private async assertOptionalCustomer(customerId?: string | null): Promise<void> {
    if (!customerId) return;
    const exists = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!exists) throw new ValidationDomainError(`Customer ${customerId} does not exist`);
  }

  /**
   * Cross-domain read-by-ID (ADR-0001): security.User существует и является
   * внутренним staff-пользователем (BUYER/PARTNER не могут быть назначены
   * ответственным в internal Sales-контуре; assignedToId — business reference,
   * не authorization scope).
   */
  private async assertOptionalUser(userId?: string | null): Promise<void> {
    if (!userId) return;
    const exists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: { select: { code: true } } },
    });
    if (!exists) throw new ValidationDomainError(`User ${userId} does not exist`);
    if (exists.role?.code === RoleCode.BUYER || exists.role?.code === RoleCode.PARTNER) {
      throw new ValidationDomainError(`User ${userId} must be an internal staff user to be assigned`);
    }
  }

  /** Cross-domain read-by-ID (ADR-0001): catalog.Product существует. */
  private async assertOptionalProduct(productId?: string | null): Promise<void> {
    if (!productId) return;
    const exists = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!exists) throw new ValidationDomainError(`Product ${productId} does not exist`);
  }

  private pagination(page?: number, pageSize?: number): { p: number; ps: number } {
    return { p: Math.max(1, page ?? 1), ps: Math.min(PAGE_SIZE_MAX, Math.max(1, pageSize ?? PAGE_SIZE_DEFAULT)) };
  }

  /** Entity-scoped history read model (immutable, ordered asc, paginated). */
  private async entityHistory(
    model: "leadHistory" | "opportunityHistory" | "quoteHistory" | "saleHistory",
    entityId: string,
    page: number,
    pageSize: number,
  ): Promise<SalesListResult<SalesHistoryItemDto>> {
    const { p, ps } = this.pagination(page, pageSize);
    const idField =
      model === "leadHistory" ? "leadId" : model === "opportunityHistory" ? "opportunityId" : model === "quoteHistory" ? "quoteId" : "saleId";
    const client = this.prisma as any;
    const [rows, total] = await Promise.all([
      client[model].findMany({ where: { [idField]: entityId }, orderBy: { createdAt: "asc" }, skip: (p - 1) * ps, take: ps }),
      client[model].count({ where: { [idField]: entityId } }),
    ]);
    return {
      items: rows.map((r: { id: string; action: string; from: string | null; to: string | null; actorId: string | null; actorName: string | null; createdAt: Date }) => ({
        id: r.id,
        action: r.action,
        from: r.from,
        to: r.to,
        actorId: r.actorId,
        actorName: r.actorName,
        createdAt: isoUtc(r.createdAt),
      })),
      total,
      page: p,
      pageSize: ps,
      hasMore: p * ps < total,
    };
  }

  /** History (audit by default) — без PII и без полного sensitive snapshot. */
  private async writeHistory(
    tx: Prisma.TransactionClient,
    model: "leadHistory" | "opportunityHistory" | "quoteHistory" | "saleHistory",
    entityId: string,
    action: string,
    from: string | null,
    to: string | null,
    actor: Actor,
    fields: Record<string, unknown>,
  ): Promise<void> {
    await (tx[model] as any).create({
      data: {
        ...(model === "leadHistory"
          ? { leadId: entityId }
          : model === "opportunityHistory"
            ? { opportunityId: entityId }
            : model === "quoteHistory"
              ? { quoteId: entityId }
              : { saleId: entityId }),
        action,
        from,
        to,
        fields: (Object.keys(fields).length > 0 ? fields : null) as Prisma.InputJsonValue | null,
        actorId: actor.id,
        actorName: actor.username,
      },
    });
  }

  /* ── DTO whitelist ──────────────────────────────────────────────────────── */

  private toLeadDto(row: {
    id: string;
    code: string;
    name: string;
    customerId: string | null;
    assignedToId: string | null;
    status: LeadStatus;
    version: number;
    createdById: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): LeadDto {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      customerId: row.customerId,
      assignedToId: row.assignedToId,
      status: row.status,
      version: row.version,
      createdById: row.createdById,
      createdAt: isoUtc(row.createdAt),
      updatedAt: isoUtc(row.updatedAt),
    };
  }

  private toOpportunityDto(row: {
    id: string;
    code: string;
    title: string;
    leadId: string | null;
    customerId: string | null;
    assignedToId: string | null;
    status: OpportunityStatus;
    version: number;
    createdById: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): OpportunityDto {
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      leadId: row.leadId,
      customerId: row.customerId,
      assignedToId: row.assignedToId,
      status: row.status,
      version: row.version,
      createdById: row.createdById,
      createdAt: isoUtc(row.createdAt),
      updatedAt: isoUtc(row.updatedAt),
    };
  }

  private toQuoteDto(row: {
    id: string;
    code: string;
    customerId: string | null;
    opportunityId: string | null;
    productId: string | null;
    status: QuoteStatus;
    version: number;
    createdById: string | null;
    createdAt: Date;
    updatedAt: Date;
    currency: string;
    validUntil: Date | null;
    issuedAt: Date | null;
    discountType: QuoteDiscountType;
    discountValue: Prisma.Decimal | null;
    discountAmount: Prisma.Decimal | null;
    subtotal: Prisma.Decimal | null;
    total: Prisma.Decimal | null;
  }): QuoteDto {
    return {
      id: row.id,
      code: row.code,
      customerId: row.customerId,
      opportunityId: row.opportunityId,
      productId: row.productId,
      status: row.status,
      version: row.version,
      createdById: row.createdById,
      createdAt: isoUtc(row.createdAt),
      updatedAt: isoUtc(row.updatedAt),
      currency: row.currency,
      validUntil: row.validUntil ? isoUtc(row.validUntil) : null,
      issuedAt: row.issuedAt ? isoUtc(row.issuedAt) : null,
      discountType: row.discountType,
      discountValue: row.discountValue ? String(row.discountValue) : null,
      discountAmount: row.discountAmount ? String(row.discountAmount) : null,
      subtotal: row.subtotal ? String(row.subtotal) : null,
      total: row.total ? String(row.total) : null,
    };
  }

  /**
   * Step 2.3 detail projection (whitelist). Для DRAFT totals вычисляются на лету
   * (preview); для ISSUED — персистенные immutable значения. Items/travelers —
   * Sales-owned snapshot без internal Catalog/CRM/Audit fields.
   */
  private toQuoteDetailDto(row: {
    id: string;
    code: string;
    customerId: string | null;
    opportunityId: string | null;
    productId: string | null;
    status: QuoteStatus;
    version: number;
    createdById: string | null;
    createdAt: Date;
    updatedAt: Date;
    currency: string;
    validUntil: Date | null;
    issuedAt: Date | null;
    discountType: QuoteDiscountType;
    discountValue: Prisma.Decimal | null;
    discountAmount: Prisma.Decimal | null;
    subtotal: Prisma.Decimal | null;
    total: Prisma.Decimal | null;
    items: Array<{
      id: string;
      productId: string;
      productCode: string;
      productTitle: string;
      tariffId: string;
      tariffCode: string;
      tariffName: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      currency: string;
      amount: Prisma.Decimal;
    }>;
    travelers: Array<{ id: string; firstName: string; lastName: string; birthDate: Date | null }>;
  }): QuoteDetailDto {
    const base = this.toQuoteDto(row);
    let subtotal = row.subtotal;
    let discountAmount = row.discountAmount;
    let total = row.total;
    if (row.status === QuoteStatus.DRAFT) {
      const t = this.quoteTotals(row.items, row.discountType, row.discountValue);
      subtotal = t.subtotal;
      discountAmount = t.discountAmount;
      total = t.total;
    }
    return {
      ...base,
      subtotal: subtotal ? String(subtotal) : null,
      discountAmount: discountAmount ? String(discountAmount) : null,
      total: total ? String(total) : null,
      items: row.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productCode: i.productCode,
        productTitle: i.productTitle,
        tariffId: i.tariffId,
        tariffCode: i.tariffCode,
        tariffName: i.tariffName,
        quantity: i.quantity,
        unitPrice: String(i.unitPrice),
        currency: i.currency,
        amount: String(i.amount),
      })),
      travelers: row.travelers.map((t) => ({
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        birthDate: t.birthDate ? isoUtc(t.birthDate) : null,
      })),
    };
  }

  /**
   * Строгий FIXED-guard (без silent clamp): discountValue ≤ ПРОСПЕКТИВНЫЙ subtotal
   * (после текущей мутации состава). Вызывается ДО записи во всех мутациях, которые
   * могут уменьшить subtotal (set commercial, update/remove item):
   *  - невалидный FIXED никогда не сохраняется (422 до commit);
   *  - response-projection (preview) никогда не падает — инвариант поддерживается;
   *  - ISSUE остаётся последней защитой (money-слой strict).
   */
  private async assertFixedDiscountWithinSubtotal(
    client: PrismaService | Prisma.TransactionClient,
    quoteId: string,
    discountType: QuoteDiscountType,
    discountValue: Prisma.Decimal | null,
    adjustment?: { excludeItemId: string; replaceAmount?: Prisma.Decimal },
  ): Promise<void> {
    if (discountType !== QuoteDiscountType.FIXED || discountValue === null) return;
    const items = await client.quoteItem.findMany({ where: { quoteId }, select: { id: true, amount: true } });
    // ПРОСПЕКТИВНЫЙ subtotal: все items кроме исключённого (+ заменяемая сумма).
    // subtotalOf округляет к 2dp; plus 2dp-суммы остаётся точным (без float).
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

  /** Step 2.3: backend-authoritative totals (Decimal, half-up 2dp). */
  private quoteTotals(
    items: Array<{ unitPrice: Prisma.Decimal; quantity: number }>,
    discountType: QuoteDiscountType,
    discountValue: Prisma.Decimal | null,
  ): { subtotal: Prisma.Decimal; discountAmount: Prisma.Decimal; total: Prisma.Decimal } {
    const subtotal = subtotalOf(items.map((i) => lineAmount(i.unitPrice, i.quantity)));
    const discountAmount = discountAmountOf(subtotal, discountType, discountValue);
    const total = totalOf(subtotal, discountAmount);
    return { subtotal, discountAmount, total };
  }

  /**
   * Step 2.3 eligibility (server-side, read-only): Product существует и не
   * ARCHIVED; Tariff существует и принадлежит Product; tariff validity window
   * (если задан) покрывает текущий момент. Без capacity reservation/locking.
   */
  private async resolveEligibleTariff(productId: string, tariffId: string): Promise<{
    productCode: string;
    productTitle: string;
    tariffCode: string;
    tariffName: string;
    price: Prisma.Decimal;
    currency: string;
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
      select: { id: true, code: true, name: true, price: true, currency: true, productId: true, validFrom: true, validTo: true },
    });
    if (!tariff) throw new ValidationDomainError(`Tariff ${tariffId} does not exist`);
    if (tariff.productId !== productId) {
      throw new ValidationDomainError(`Tariff ${tariff.code} does not belong to Product ${product.code}`);
    }
    const now = new Date();
    if (tariff.validFrom && tariff.validFrom > now) {
      throw new ValidationDomainError(`Tariff ${tariff.code} is not yet valid`);
    }
    if (tariff.validTo && tariff.validTo < now) {
      throw new ValidationDomainError(`Tariff ${tariff.code} has expired`);
    }
    return {
      productCode: product.code,
      productTitle: product.title,
      tariffCode: tariff.code,
      tariffName: tariff.name,
      price: tariff.price,
      currency: tariff.currency ?? "USD",
    };
  }

  private toSaleDto(row: {
    id: string;
    code: string;
    customerId: string | null;
    opportunityId: string | null;
    quoteId: string | null;
    status: SaleStatus;
    version: number;
    createdById: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): SaleDto {
    return {
      id: row.id,
      code: row.code,
      customerId: row.customerId,
      opportunityId: row.opportunityId,
      quoteId: row.quoteId,
      status: row.status,
      version: row.version,
      createdById: row.createdById,
      createdAt: isoUtc(row.createdAt),
      updatedAt: isoUtc(row.updatedAt),
    };
  }
}

/**
 * Календарная дата YYYY-MM-DD (без time-компонента/timezone). Используется для
 * birthDate: исключает timezone day-shift (Prisma DateTime хранит UTC instant),
 * а также невалидные календарные даты (2023-02-30 и т.п.).
 */
function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Статус-счётчики groupBy → Record<status, count> с zero-fill по всем enum-значениям. */
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
