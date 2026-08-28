import { Injectable, ForbiddenException } from "@nestjs/common";
import type { Prisma, CustomerType, EntityStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type CustomerEventPayload, type PartnerEventPayload } from "../../eventbus/domain-events";
import { IdsService } from "../../shared/ids.service";
import { ConflictError, NotFoundError } from "../../shared/errors";
import { normalizeEmail } from "../../shared/field-validation";
import { normalizeInitialNote } from "../operational-notes/operational-notes.types";

import { buildSortClause, type SortDirection } from '../../shared/sort';

export interface CreateCustomerInput {
  type?: CustomerType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email: string;
  phone?: string;
  initialNote?: string;
}

export interface UpdateCustomerInput {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone?: string;
  status?: EntityStatus;
}

export interface CreateContactInput {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
}

export interface CustomerListQuery {
  search?: string;
  status?: string;
  customerType?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: string;
}

export interface EnsureBuyerCustomerInput {
  /** Canonical identity key (нормализованный email) — deterministic match. */
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  actorUserId?: string;
}

export interface CreateOrLinkPartnerInput {
  /** Display name (brand). НЕ identity-ключ (no merge по имени). */
  name: string;
  /** INDIVIDUAL — канонический ключ (нормализованный email). */
  contactEmail?: string;
  /** COMPANY — канонический ключ (регистрационный номер). */
  registrationNumber?: string;
  taxId?: string;
  companyId?: string;
  /** Authoritative country (2-letter code) — системная identity, не locale-значение. */
  countryCode?: string;
  actorUserId?: string;
}

/**
 * CRM (mini, Phase 1) — единственный владелец клиентских мастер-данных
 * (Customer/Contact/Company/Partner/Supplier). Order/Booking хранят только customerId.
 * Публикует: CustomerCreated, CustomerUpdated.
 */
@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly eventBus: EventBusService,
  ) {}

  // ── Customer ───────────────────────────────────────────────────────────────

  async createCustomer(input: CreateCustomerInput, actor?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findUnique({ where: { email: input.email }, select: { id: true } });
      if (existing) throw new ConflictError(`Customer with email ${input.email} already exists`);

      const code = await this.ids.nextCode(tx, "CUS");
      const customer = await tx.customer.create({
        data: {
          code,
          type: input.type ?? "PERSON",
          firstName: input.firstName ?? null,
          lastName: input.lastName ?? null,
          companyName: input.companyName ?? null,
          email: input.email,
          phone: input.phone ?? null,
          status: "ACTIVE",
          version: 1,
        },
        select: { id: true, code: true, type: true, firstName: true, lastName: true, companyName: true, email: true, status: true },
      });

      await tx.customerHistory.create({
        data: {
          customerId: customer.id,
          action: "created",
          to: "ACTIVE",
          actorId: actor ?? null,
          actorName: actor ?? null,
          comment: "Клиент создан (CRM Center)",
        },
      });

      // STRICT REVIEW FIX (PII minimization): email убран из payload — у
      // CustomerCreated НЕТ consumer-ов, email остаётся в CRM master-data (по
      // customerId можно прочитать по ID, ADR-0001). Payload: canonical refs.
      const eventId = await this.eventBus.emit(tx, {
        aggregateType: "Customer",
        aggregateId: customer.id,
        eventType: DomainEvents.CustomerCreated,
        payload: {
          customerId: customer.id,
          code: customer.code,
          name: customer.companyName ?? `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim(),
        } as CustomerEventPayload,
      });

      // Phase 3 Round 2D: optional initial OperationalNote (same transaction)
      const noteText = normalizeInitialNote(input.initialNote);
      let initialNote: any = null;
      if (noteText) {
        initialNote = await tx.operationalNote.create({
          data: {
            entityType: "Customer",
            entityId: customer.id,
            text: noteText,
            visibility: "INTERNAL",
            authorUserId: null,
            authorName: actor ?? null,
          },
        });
      }

      return { customer, eventId, initialNote };
    });

    await this.eventBus.publishPending();
    return result;
  }

  async listCustomers(query: CustomerListQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.CustomerWhereInput = {
      ...(query.status ? { status: query.status as EntityStatus } : {}),
      ...(query.customerType ? { type: query.customerType as CustomerType } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: "insensitive" } },
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
              { companyName: { contains: query.search, mode: "insensitive" } },
              { code: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const orderBy = buildSortClause(
      query.sortBy,
      query.sortDirection,
      { code: 'code', name: 'companyName', type: 'type', email: 'email', status: 'status', createdAt: 'createdAt' },
      { createdAt: 'desc' },
    );

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getCustomer(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { contacts: { orderBy: { createdAt: "asc" } }, history: { orderBy: { createdAt: "desc" }, take: 50 } },
    });
    if (!customer) throw new NotFoundError(`Customer ${id} not found`);
    return customer;
  }

  async updateCustomer(id: string, input: UpdateCustomerInput, actor?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError(`Customer ${id} not found`);

      const customer = await tx.customer.update({
        where: { id },
        data: {
          firstName: input.firstName !== undefined ? input.firstName : existing.firstName,
          lastName: input.lastName !== undefined ? input.lastName : existing.lastName,
          companyName: input.companyName !== undefined ? input.companyName : existing.companyName,
          phone: input.phone !== undefined ? input.phone : existing.phone,
          status: input.status ?? existing.status,
          version: { increment: 1 },
        },
        select: { id: true, code: true, type: true, firstName: true, lastName: true, companyName: true, email: true, status: true, version: true },
      });

      await tx.customerHistory.create({
        data: {
          customerId: id,
          action: "update",
          from: existing.status,
          to: customer.status,
          fields: { firstName: input.firstName, lastName: input.lastName, phone: input.phone } as Prisma.InputJsonValue,
          actorId: actor ?? null,
          actorName: actor ?? null,
          comment: "Клиент обновлён",
        },
      });

      const eventId = await this.eventBus.emit(tx, {
        aggregateType: "Customer",
        aggregateId: id,
        eventType: DomainEvents.CustomerUpdated,
        payload: {
          customerId: id,
          code: customer.code,
          name: customer.companyName ?? `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim(),
          changedFields: Object.keys(input),
        } as CustomerEventPayload,
      });

      return { customer, eventId };
    });

    await this.eventBus.publishPending();
    return result;
  }

  /**
   * Step 1.9 — CRM-owned application command для BUYER identity link.
   *
   * create-or-link crm.Customer по КАНОНИЧЕСКОМУ ключу (нормализованный email,
   * Customer.email @unique):
   *  - существует однозначный Customer с таким email → reuse (link), НЕ merge;
   *  - нет → создать ровно одного Customer;
   *  - retry/повтор регистрации никогда не создаёт дубликат (unique + reuse);
   *  - НЕМБИГУОЗНЫЙ legacy match НЕ merge'ится автоматически (только email
   *    считаем deterministic; имя/телефон не являются ключом связи);
   *  - работает в транзакции вызывающего (tx): вся orchestration регистрации
   *    (User + Customer + link) атомарна, иначе регистрация падает целиком.
   *
   * Владелец Customer — CRM: пишет crm.* только этот сервис, вызванный как
   * application service из Auth (security не трогает crm.Customer напрямую).
   */
  async ensureCustomerForBuyer(
    tx: Prisma.TransactionClient,
    input: EnsureBuyerCustomerInput,
  ): Promise<{ customerId: string; created: boolean }> {
    const email = normalizeEmail(input.email);

    // Deterministic reuse: ровно один Customer на email (unique constraint).
    const existing = await tx.customer.findUnique({ where: { email }, select: { id: true } });
    if (existing) return { customerId: existing.id, created: false };

    const code = await this.ids.nextCode(tx, "CUS");
    const customer = await tx.customer.create({
      data: {
        code,
        type: "PERSON",
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        email,
        phone: input.phone ?? null,
        status: "ACTIVE",
        version: 1,
      },
      select: { id: true, code: true },
    });

    await tx.customerHistory.create({
      data: {
        customerId: customer.id,
        action: "created",
        to: "ACTIVE",
        actorId: input.actorUserId ?? null,
        actorName: input.actorUserId ?? null,
        comment: "Buyer self-registration (Step 1.9)",
      },
    });

    await this.eventBus.emit(tx, {
      aggregateType: "Customer",
      aggregateId: customer.id,
      eventType: DomainEvents.CustomerCreated,
      payload: {
        customerId: customer.id,
        code: customer.code,
        name: `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim(),
      } as CustomerEventPayload,
    });

    return { customerId: customer.id, created: true };
  }

  /**
   * Step 1.9 — sync email на связанном Customer (identity-поле владеет security;
   * Customer.email синхронизируется ОДНИМ CRM-owned command, чтобы канонический
   * ключ связи оставался детерминированным). Провал → 404/409, без частичных правок.
   */
  async updateCustomerEmail(customerId: string, email: string): Promise<void> {
    const normalized = normalizeEmail(email);
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findUnique({ where: { id: customerId }, select: { id: true } });
      if (!existing) throw new NotFoundError(`Customer ${customerId} not found`);
      const dup = await tx.customer.findUnique({ where: { email: normalized }, select: { id: true } });
      if (dup && dup.id !== customerId) throw new ConflictError("Email already used by another customer");
      await tx.customer.update({ where: { id: customerId }, data: { email: normalized, version: { increment: 1 } } });
      await tx.customerHistory.create({
        data: {
          customerId,
          action: "update",
          fields: { email: normalized } as Prisma.InputJsonValue,
          comment: "Email synced from User identity (Step 1.9)",
        },
      });
    });
  }

  /**
   * Step 1.10 — CRM-owned application command для Partner activation
   * (create-or-link crm.Partner). Вызывается ТОЛЬКО из approve-оркестрации
   * (PartnerOnboardingService) внутри её транзакции (tx): CRM остаётся
   * владельцем Partner, security НЕ пишет в crm.* напрямую (ADR-0004).
   *
   * Deterministic matching (ADR-0004 §9):
   *  - INDIVIDUAL → contactEmail (нормализованный, partial unique в БД);
   *  - COMPANY   → registrationNumber (partial unique в БД);
   *  - НЕ merge по brand/display name; ambiguous/no key → создать новый Partner
   *    (нет ключа = нет кандидата для ошибочного link);
   *  - retry approve идемпотентен: повторный create с тем же ключом физически
   *    невозможен (DB partial unique) + reuse существующего.
   */
  async createOrLinkPartner(
    tx: Prisma.TransactionClient,
    input: CreateOrLinkPartnerInput,
  ): Promise<{ partnerId: string; created: boolean }> {
    const contactEmail = input.contactEmail ? normalizeEmail(input.contactEmail) : undefined;
    // Deterministic reuse: ровно один Partner на ключ (DB partial unique).
    if (contactEmail) {
      const existing = await tx.partner.findUnique({ where: { contactEmail }, select: { id: true } });
      if (existing) return { partnerId: existing.id, created: false };
    }
    if (input.registrationNumber) {
      const existing = await tx.partner.findUnique({
        where: { registrationNumber: input.registrationNumber },
        select: { id: true },
      });
      if (existing) return { partnerId: existing.id, created: false };
    }

    const code = await this.ids.nextCode(tx, "PAR");
    const partner = await tx.partner.create({
      data: {
        code,
        name: input.name,
        companyId: input.companyId ?? null,
        contactEmail: contactEmail ?? null,
        registrationNumber: input.registrationNumber ?? null,
        taxId: input.taxId ?? null,
        countryCode: input.countryCode ?? null,
        status: "ACTIVE",
      },
      select: { id: true, code: true, name: true },
    });

    // STRICT REVIEW FIX (PII minimization): contactEmail/registrationNumber убраны
    // из payload — единственный consumer (Catalog seller profile) использует только
    // partnerId (countryCode читает из CRM по ID). Канонические identity-ключи
    // остаются в CRM master-data.
    await this.eventBus.emit(tx, {
      aggregateType: "Partner",
      aggregateId: partner.id,
      eventType: DomainEvents.PartnerCreated,
      payload: {
        partnerId: partner.id,
        code: partner.code,
        name: partner.name,
        source: "partner_onboarding",
      } as PartnerEventPayload,
    });

    return { partnerId: partner.id, created: true };
  }

  // ── Contact / Company / Partner / Supplier ─────────────────────────────────

  async createContact(customerId: string, input: CreateContactInput) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!customer) throw new NotFoundError(`Customer ${customerId} not found`);
    return this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "CNT");
      return tx.contact.create({
        data: { code, customerId, name: input.name, email: input.email ?? null, phone: input.phone ?? null, role: input.role ?? null },
      });
    });
  }

  async listContacts(customerId: string) {
    return this.prisma.contact.findMany({ where: { customerId }, orderBy: { createdAt: "asc" } });
  }

  async createCompany(name: string, inn?: string) {
    return this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "COM");
      return tx.company.create({ data: { code, name, inn: inn ?? null, status: "ACTIVE" } });
    });
  }

  async listCompanies() {
    return this.prisma.company.findMany({ orderBy: { name: "asc" } });
  }

  async createPartner(name: string, companyId?: string, countryCode?: string) {
    return this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "PAR");
      return tx.partner.create({ data: { code, name, companyId: companyId ?? null, countryCode: countryCode ?? null, status: "ACTIVE" } });
    });
  }

  async createSupplier(name: string, companyId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "SUP");
      return tx.supplier.create({ data: { code, name, companyId: companyId ?? null, status: "ACTIVE" } });
    });
  }

  async listSuppliers() {
    return this.prisma.supplier.findMany({ orderBy: { name: "asc" } });
  }

  // ── Step 3.5 Round 5 — Customer Commercial Partners from Transactional Activity ──

  /**
   * Derive commercial Partner relationships from canonical transactional activity.
   * Hard invariant: PartnerCustomerRelation is OPTIONAL enrichment, not required.
   * Commercial relationship exists when Order.customerId = customer AND Order.sellerPartnerId = partner.
   */
  async getCustomerPartners(customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!customer) throw new NotFoundError(`Customer ${customerId} not found`);

    // Get distinct partners from customer's orders
    const partnerOrders = await this.prisma.order.findMany({
      where: { customerId },
      select: { sellerPartnerId: true, id: true, amount: true, currency: true, createdAt: true, status: true },
    });

    // Group by partner and aggregate
    const partnerMap = new Map<string, { orderCount: number; totalAmount: number; currency: string; lastActivity: Date; orderIds: string[] }>();
    for (const o of partnerOrders) {
      if (!o.sellerPartnerId) continue;
      const existing = partnerMap.get(o.sellerPartnerId);
      if (existing) {
        existing.orderCount++;
        existing.totalAmount += Number(o.amount);
        if (o.createdAt > existing.lastActivity) existing.lastActivity = o.createdAt;
        existing.orderIds.push(o.id);
      } else {
        partnerMap.set(o.sellerPartnerId, {
          orderCount: 1,
          totalAmount: Number(o.amount),
          currency: o.currency,
          lastActivity: o.createdAt,
          orderIds: [o.id],
        });
      }
    }

    // Get bookings count per partner
    const allOrderIds = partnerOrders.map((o) => o.id);
    const partnerBookings = allOrderIds.length > 0
      ? await this.prisma.booking.findMany({
          where: { orderId: { in: allOrderIds } },
          select: { orderId: true },
        })
      : [];
    const bookingCountByOrder = new Map<string, number>();
    for (const b of partnerBookings) {
      bookingCountByOrder.set(b.orderId, (bookingCountByOrder.get(b.orderId) ?? 0) + 1);
    }

    // Fetch partner identities
    const partnerIds = Array.from(partnerMap.keys());
    const partners = partnerIds.length > 0
      ? await this.prisma.partner.findMany({
          where: { id: { in: partnerIds } },
          select: { id: true, code: true, name: true, status: true },
        })
      : [];
    const partnerIdentityMap = new Map(partners.map((p) => [p.id, p]));

    // Get optional PartnerCustomerRelation enrichment
    const relations = await this.prisma.partnerCustomerRelation.findMany({
      where: { customerId },
      select: { partnerId: true, lifecycle: true, leadSource: true, assignedTo: true },
    });
    const relationMap = new Map(relations.map((r) => [r.partnerId, r]));

    // Build result
    const result = partnerIds.map((pid) => {
      const agg = partnerMap.get(pid)!;
      let totalBookings = 0;
      for (const oid of agg.orderIds) {
        totalBookings += bookingCountByOrder.get(oid) ?? 0;
      }
      const identity = partnerIdentityMap.get(pid);
      const relation = relationMap.get(pid);
      return {
        partnerId: pid,
        partnerCode: identity?.code ?? null,
        partnerName: identity?.name ?? pid,
        partnerStatus: identity?.status ?? null,
        orderCount: agg.orderCount,
        totalBookings,
        totalAmount: agg.totalAmount,
        currency: agg.currency,
        lastActivity: agg.lastActivity.toISOString(),
        // Optional CRM enrichment
        lifecycle: relation?.lifecycle ?? null,
        leadSource: relation?.leadSource ?? null,
        assignedTo: relation?.assignedTo ?? null,
      };
    });

    // Sort by last activity descending
    result.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

    return { items: result, total: result.length };
  }

  // ── Partner List/Detail (Step 3.5 — CRM Completion) ────────────────────

  async listPartners(query: CustomerListQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.PartnerWhereInput = {
      ...(query.status ? { status: query.status as EntityStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { code: { contains: query.search, mode: "insensitive" } },
              { contactEmail: { contains: query.search, mode: "insensitive" } },
              { registrationNumber: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const orderBy = buildSortClause(
      query.sortBy,
      query.sortDirection,
      { code: 'code', name: 'name', email: 'contactEmail', country: 'countryCode', status: 'status', createdAt: 'createdAt' },
      { name: 'asc' },
    );

    const [items, total] = await Promise.all([
      this.prisma.partner.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.partner.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getPartner(id: string, sort?: { sortBy?: string; sortDirection?: string; status?: string; bookingStatus?: string; productStatus?: string }) {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
      include: {
        customerRelations: {
          include: { customer: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!partner) throw new NotFoundError(`Partner ${id} not found`);

    // Aggregate: products (services) owned by this partner
    const productWhere: any = { partnerId: id };
    if (sort?.productStatus) productWhere.status = sort.productStatus;
    const products = await this.prisma.product.findMany({
      where: productWhere,
      orderBy: buildSortClause(
        sort?.sortBy,
        sort?.sortDirection,
        { code: 'code', name: 'title', type: 'type', status: 'status', createdAt: 'createdAt' },
        { createdAt: 'desc' },
      ),
      take: 20,
      select: { id: true, code: true, title: true, type: true, status: true, slug: true, createdAt: true },
    });
    const totalProducts = await this.prisma.product.count({ where: productWhere });

    // Aggregate: orders where this partner is seller
    const orderWhere: any = { sellerPartnerId: id };
    if (sort?.status) orderWhere.status = sort.status;
    const orders = await this.prisma.order.findMany({
      where: orderWhere,
      orderBy: buildSortClause(
        sort?.sortBy,
        sort?.sortDirection,
        { code: 'code', createdAt: 'createdAt', amount: 'amount', status: 'status' },
        { createdAt: 'desc' },
      ),
      take: 20,
      select: { id: true, code: true, number: true, status: true, paymentStatus: true, amount: true, currency: true, customerId: true, createdAt: true },
    });
    const totalOrders = await this.prisma.order.count({ where: orderWhere });

    // Aggregate: bookings through partner's orders
    const orderIds = orders.map((o) => o.id);
    const bookingWhere: any = orderIds.length > 0 ? { orderId: { in: orderIds } } : { orderId: '__none__' };
    if (sort?.bookingStatus) bookingWhere.status = sort.bookingStatus;
    const bookings = orderIds.length > 0
      ? await this.prisma.booking.findMany({
          where: bookingWhere,
          orderBy: buildSortClause(
            sort?.sortBy,
            sort?.sortDirection,
            { code: 'code', createdAt: 'createdAt', amount: 'amount', status: 'status' },
            { createdAt: 'desc' },
          ),
          take: 20,
          select: { id: true, code: true, status: true, amount: true, currency: true, orderId: true, createdAt: true },
        })
      : [];
    const totalBookings = orderIds.length > 0
      ? await this.prisma.booking.count({ where: bookingWhere })
      : 0;    // PartnerStorefront state
    const storefront = await (this.prisma as any).partnerStorefront.findUnique({
      where: { partnerId: id },
      select: { id: true, code: true, slug: true, status: true, entitlementStatus: true, businessName: true, tagline: true, defaultLocale: true, countryCode: true, cityCode: true },
    });

    // Commercial customers from transactional activity (distinct by customerId)
    const distinctCustomerIds = [...new Set(orders.map((o) => o.customerId).filter((c): c is string => c !== null))];
    const commercialCustomers = distinctCustomerIds.length > 0
      ? await this.prisma.customer.findMany({
          where: { id: { in: distinctCustomerIds } },
          select: { id: true, code: true, firstName: true, lastName: true, companyName: true, email: true, status: true },
        })
      : [];
    const customerIdentityMap = new Map(commercialCustomers.map((c) => [c.id, c]));

    // Aggregate per customer: orders, bookings, amount, last activity
    const customerAggMap = new Map<string, { orderCount: number; totalAmount: number; currency: string; lastActivity: Date; bookingCount: number }>();
    for (const o of orders) {
      if (!o.customerId) continue;
      const existing = customerAggMap.get(o.customerId);
      const bookingCountForOrder = bookings.filter((b) => b.orderId === o.id).length;
      if (existing) {
        existing.orderCount++;
        existing.totalAmount += Number(o.amount);
        existing.bookingCount += bookingCountForOrder;
        if (o.createdAt > existing.lastActivity) existing.lastActivity = o.createdAt;
      } else {
        customerAggMap.set(o.customerId, {
          orderCount: 1,
          totalAmount: Number(o.amount),
          currency: o.currency,
          lastActivity: o.createdAt,
          bookingCount: bookingCountForOrder,
        });
      }
    }

    // Get optional PartnerCustomerRelation enrichment
    const relations = await this.prisma.partnerCustomerRelation.findMany({
      where: { partnerId: id },
      select: { customerId: true, lifecycle: true, leadSource: true, assignedTo: true },
    });
    const relationMap = new Map(relations.map((r) => [r.customerId, r]));

    // Build enriched commercial customer list
    const enrichedCustomers = distinctCustomerIds.map((cid) => {
      const identity = customerIdentityMap.get(cid);
      const agg = customerAggMap.get(cid)!;
      const relation = relationMap.get(cid);
      return {
        customerId: cid,
        customerCode: identity?.code ?? null,
        firstName: identity?.firstName ?? null,
        lastName: identity?.lastName ?? null,
        companyName: identity?.companyName ?? null,
        email: identity?.email ?? null,
        customerStatus: identity?.status ?? null,
        orderCount: agg.orderCount,
        bookingCount: agg.bookingCount,
        totalAmount: agg.totalAmount,
        currency: agg.currency,
        lastActivity: agg.lastActivity.toISOString(),
        // Optional CRM enrichment
        lifecycle: relation?.lifecycle ?? null,
        leadSource: relation?.leadSource ?? null,
        assignedTo: relation?.assignedTo ?? null,
      };
    });
    enrichedCustomers.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

    return {
      ...partner,
      products,
      totalProducts,
      orders,
      totalOrders,
      bookings,
      totalBookings,
      totalCustomers: enrichedCustomers.length,
      commercialCustomers: enrichedCustomers,
      storefront,
    };
  }

  // ── Customer Detail with related data (Step 3.5) ──────────────────────

  async getCustomerDetail(id: string, sort?: { sortBy?: string; sortDirection?: string; status?: string; bookingStatus?: string; paymentStatus?: string }) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: { createdAt: "asc" } },
        history: { orderBy: { createdAt: "desc" }, take: 50 },
        partnerRelations: {
          include: { partner: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!customer) throw new NotFoundError(`Customer ${id} not found`);

    // Aggregate orders from direct customerId reference
    const orderWhere: any = { customerId: id };
    if (sort?.status) orderWhere.status = sort.status;
    const orders = await this.prisma.order.findMany({
      where: orderWhere,
      orderBy: buildSortClause(
        sort?.sortBy,
        sort?.sortDirection,
        { code: 'code', name: 'number', createdAt: 'createdAt', amount: 'amount', status: 'status' },
        { createdAt: 'desc' },
      ),
      take: 20,
      select: { id: true, code: true, number: true, status: true, paymentStatus: true, amount: true, paidAmount: true, currency: true, createdAt: true },
    });

    // ── Canonical Payment Ownership (Round 2C.2R) ─────────────────────────
    // Payment customer is resolved via:
    //   1. Direct: Payment.customerId == customer.id
    //   2. Order-derived: Payment.orderId → Order.customerId == customer.id
    // Merge + dedupe by Payment.id, then paginate/sort.

    // orderIds from the paginated orders (for UI bookings tab)
    const orderIds = orders.map((o) => o.id);

    // Get ALL order IDs for this customer (no limit) for payment resolution
    const allOrderIds = (await this.prisma.order.findMany({
      where: { customerId: id },
      select: { id: true },
    })).map((o) => o.id);

    // Bookings still use the paginated order set (UI tab)
    const bookingWhere: any = orderIds.length > 0 ? { orderId: { in: orderIds } } : { orderId: '__none__' };
    if (sort?.bookingStatus) bookingWhere.status = sort.bookingStatus;
    const [bookings, totalOrders, totalBookings] = await Promise.all([
      orderIds.length > 0
        ? this.prisma.booking.findMany({
            where: bookingWhere,
            orderBy: buildSortClause(
              sort?.sortBy,
              sort?.sortDirection,
              { code: 'code', createdAt: 'createdAt', amount: 'amount', status: 'status' },
              { createdAt: 'desc' },
            ),
            take: 20,
            select: { id: true, code: true, status: true, amount: true, currency: true, orderId: true, productId: true, createdAt: true },
          })
        : Promise.resolve([]),
      this.prisma.order.count({ where: orderWhere }),
      orderIds.length > 0
        ? this.prisma.booking.count({ where: bookingWhere })
        : Promise.resolve(0),
    ]);
    // Note: orderIds = first 20 orders (for UI bookings tab)
    // allOrderIds = ALL order IDs (for canonical payment resolution)

    // Canonical payments: direct + order-derived, deduped
    const paymentSelect = { id: true, code: true, status: true, amount: true, currency: true, orderId: true, paymentMethod: true, createdAt: true, paidAt: true } as const;
    const directPaymentWhere: any = { customerId: id };
    if (sort?.paymentStatus) directPaymentWhere.status = sort.paymentStatus;
    const orderPaymentWhere: any = allOrderIds.length > 0 ? { orderId: { in: allOrderIds } } : { orderId: '__none__' };
    if (sort?.paymentStatus) orderPaymentWhere.status = sort.paymentStatus;
    const [directPayments, orderPayments] = await Promise.all([
      this.prisma.payment.findMany({
        where: directPaymentWhere,
        select: paymentSelect,
      }),
      allOrderIds.length > 0
        ? this.prisma.payment.findMany({
            where: orderPaymentWhere,
            select: paymentSelect,
          })
        : Promise.resolve([]),
    ]);

    // Merge + dedupe: direct payments take precedence (same row if dual-link)
    const paymentMapById = new Map<string, typeof directPayments[number]>();
    for (const p of orderPayments) paymentMapById.set(p.id, p);
    for (const p of directPayments) paymentMapById.set(p.id, p); // direct overwrites if dual-link
    let canonicalPayments = Array.from(paymentMapById.values());

    // Deterministic sort on merged set
    const paymentSortKey = sort?.sortBy === 'paymentDate' ? 'paidAt'
      : sort?.sortBy === 'code' ? 'code'
      : sort?.sortBy === 'amount' ? 'amount'
      : sort?.sortBy === 'status' ? 'status'
      : 'createdAt';
    const paymentSortDir: 'asc' | 'desc' = sort?.sortDirection === 'asc' ? 'asc' : 'desc';
    canonicalPayments.sort((a, b) => {
      const aVal = a[paymentSortKey] ?? a.createdAt;
      const bVal = b[paymentSortKey] ?? b.createdAt;
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return paymentSortDir === 'desc' ? -cmp : cmp;
    });

    const totalPayments = canonicalPayments.length;
    canonicalPayments = canonicalPayments.slice(0, 20);

    // Enrich payments with Order context (code, number, item count)
    // orderMap includes both paginated orders (full objects) and on-demand fetched ones
    const orderMap = new Map<string, { code: string; number: string }>();
    for (const o of orders) orderMap.set(o.id, { code: o.code, number: o.number });
    // For orders not in the paginated set, fetch their code/number on demand
    const missingOrderIds = canonicalPayments
      .map(p => p.orderId)
      .filter((oid): oid is string => !!oid && !orderMap.has(oid));
    if (missingOrderIds.length > 0) {
      const missingOrders = await this.prisma.order.findMany({
        where: { id: { in: missingOrderIds } },
        select: { id: true, code: true, number: true },
      });
      for (const o of missingOrders) orderMap.set(o.id, { code: o.code, number: o.number });
    }
    const enrichedPayments = canonicalPayments.map((p) => ({
      ...p,
      orderCode: orderMap.get(p.orderId!)?.code ?? null,
      orderNumber: orderMap.get(p.orderId!)?.number ?? null,
    }));

    // Refunds: Customer → Order → Payment → Refund (cross-schema, no FK)
    const paymentIds = canonicalPayments.map((p) => p.id);
    const [refunds, totalRefunds] = paymentIds.length > 0
      ? await Promise.all([
          this.prisma.refund.findMany({
            where: { paymentId: { in: paymentIds } },
            orderBy: buildSortClause(
              sort?.sortBy,
              sort?.sortDirection,
              { code: 'code', refundDate: 'processedAt', amount: 'amount', status: 'status' },
              { createdAt: 'desc' },
            ),
            take: 20,
            select: { id: true, code: true, amount: true, currency: true, status: true, reason: true, paymentId: true, orderId: true, createdAt: true, processedAt: true },
          }),
          this.prisma.refund.count({ where: { paymentId: { in: paymentIds } } }),
        ])
      : [[], 0];

    // Enrich refunds with Payment and Order context
    const paymentLookup = new Map(canonicalPayments.map((p) => [p.id, p]));
    const enrichedRefunds = refunds.map((r) => ({
      ...r,
      paymentCode: paymentLookup.get(r.paymentId)?.code ?? null,
      orderCode: orderMap.get(r.orderId)?.code ?? null,
      orderNumber: orderMap.get(r.orderId)?.number ?? null,
    }));

    return {
      ...customer,
      orders,
      bookings,
      payments: enrichedPayments,
      refunds: enrichedRefunds,
      summary: {
        totalOrders,
        totalBookings,
        totalPayments,
        totalRefunds,
      },
    };
  }

  // ── Partner Customer Relations (Step 3.5B) ──────────────────────────────

  async createPartnerCustomerRelation(partnerId: string, customerId: string, input: { leadSource?: string; assignedTo?: string; lifecycle?: string; tags?: string[]; notes?: string }, actor?: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId }, select: { id: true } });
    if (!partner) throw new NotFoundError(`Partner ${partnerId} not found`);
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!customer) throw new NotFoundError(`Customer ${customerId} not found`);

    const existing = await this.prisma.partnerCustomerRelation.findUnique({ where: { partnerId_customerId: { partnerId, customerId } } });
    if (existing) throw new ConflictError(`Relation between partner ${partnerId} and customer ${customerId} already exists`);

    const result = await this.prisma.$transaction(async (tx) => {
      const relation = await tx.partnerCustomerRelation.create({
        data: {
          partnerId,
          customerId,
          leadSource: input.leadSource ?? null,
          assignedTo: input.assignedTo ?? null,
          lifecycle: input.lifecycle ?? "LEAD",
          tags: input.tags ?? [],
          notes: input.notes ?? null,
        },
      });

      await tx.partnerCustomerRelationHistory.create({
        data: {
          relationId: relation.id,
          action: "created",
          to: "ACTIVE",
          actorId: actor ?? null,
          actorName: actor ?? null,
          comment: "Partner-Customer relation created",
        },
      });

      return relation;
    });

    return result;
  }

  async updatePartnerCustomerRelation(relationId: string, input: { status?: EntityStatus; lifecycle?: string; tags?: string[]; notes?: string; assignedTo?: string }, actor?: string) {
    const existing = await this.prisma.partnerCustomerRelation.findUnique({ where: { id: relationId } });
    if (!existing) throw new NotFoundError(`Partner-Customer relation ${relationId} not found`);

    const result = await this.prisma.$transaction(async (tx) => {
      const relation = await tx.partnerCustomerRelation.update({
        where: { id: relationId },
        data: {
          status: input.status ?? existing.status,
          lifecycle: input.lifecycle ?? existing.lifecycle,
          tags: input.tags ?? existing.tags,
          notes: input.notes ?? existing.notes,
          assignedTo: input.assignedTo ?? existing.assignedTo,
          version: { increment: 1 },
        },
      });

      await tx.partnerCustomerRelationHistory.create({
        data: {
          relationId,
          action: "update",
          from: existing.status,
          to: relation.status,
          fields: input as Prisma.InputJsonValue,
          actorId: actor ?? null,
          actorName: actor ?? null,
          comment: "Partner-Customer relation updated",
        },
      });

      return relation;
    });

    return result;
  }

  // ── Step 3.5C — Three-Context CRM ─────────────────────────────────────

  /**
   * CRM tier for a partner: BASIC (Marketplace) or PRO (Storefront Pro).
   * Determined by: partner has an ACTIVE PartnerStorefront with entitlementStatus = ACTIVE.
   */
  async getCrmTier(partnerId: string): Promise<"BASIC" | "PRO"> {
    const storefront = await (this.prisma as any).partnerStorefront.findUnique({
      where: { partnerId },
      select: { status: true, entitlementStatus: true },
    });
    if (storefront?.status === "ACTIVE" && storefront?.entitlementStatus === "ACTIVE") {
      return "PRO";
    }
    return "BASIC";
  }

  /**
   * Extract partnerId from authenticated actor context.
   */
  private assertPartnerActor(actor?: { partnerId?: string | null }): string {
    if (!actor?.partnerId) {
      throw new ForbiddenException("Partner account required for partner CRM operations");
    }
    return actor.partnerId;
  }

  /**
   * Step 3.5C — Three-context customer list.
   * - BASIC: customers from marketplace orders (sellerPartnerId = partnerId)
   * - PRO: customers from PartnerCustomerRelation + marketplace orders
   * Server-scoped: actor.partnerId is the ONLY source of partner scope.
   */
  async listPartnerCustomers(
    partnerActor: { partnerId?: string | null },
    query: CustomerListQuery,
  ) {
    const partnerId = this.assertPartnerActor(partnerActor);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const tier = await this.getCrmTier(partnerId);

    if (tier === "BASIC") {
      // Marketplace Basic: customers from own marketplace orders
      const orderWhere: any = { sellerPartnerId: partnerId };
      if (query.search) {
        const s = query.search.toLowerCase();
        orderWhere.customer = {
          OR: [
            { email: { contains: s, mode: "insensitive" } },
            { firstName: { contains: s, mode: "insensitive" } },
            { lastName: { contains: s, mode: "insensitive" } },
            { companyName: { contains: s, mode: "insensitive" } },
            { code: { contains: s, mode: "insensitive" } },
          ],
        };
      }

      // Get distinct customer IDs from partner's orders
      const orderCustomers = await this.prisma.order.findMany({
        where: orderWhere,
        select: { customerId: true },
        distinct: ["customerId"],
      });
      const customerIds = orderCustomers
        .map((o) => o.customerId)
        .filter((id): id is string => id !== null);

      if (customerIds.length === 0) {
        return { items: [], total: 0, page, pageSize, tier };
      }

      const customerWhere: any = { id: { in: customerIds } };
      if (query.status) customerWhere.status = query.status;

      const [customers, total] = await Promise.all([
        this.prisma.customer.findMany({
          where: customerWhere,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.customer.count({ where: customerWhere }),
      ]);

      return { items: customers, total, page, pageSize, tier };
    }

    // Storefront Pro: customers from PartnerCustomerRelation
    const relationWhere: Prisma.PartnerCustomerRelationWhereInput = {
      partnerId,
      ...(query.status ? { status: query.status as EntityStatus } : {}),
    };

    const [relations, totalRelations] = await Promise.all([
      this.prisma.partnerCustomerRelation.findMany({
        where: relationWhere,
        include: {
          customer: {
            select: {
              id: true, code: true, type: true, firstName: true, lastName: true,
              companyName: true, email: true, phone: true, status: true, createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.partnerCustomerRelation.count({ where: relationWhere }),
    ]);

    let items = relations.map((r) => ({
      ...r.customer,
      _relation: { id: r.id, lifecycle: r.lifecycle, leadSource: r.leadSource, tags: r.tags, notes: r.notes, assignedTo: r.assignedTo },
    }));

    if (query.search) {
      const s = query.search.toLowerCase();
      items = items.filter((item) =>
        item.email.toLowerCase().includes(s) ||
        (item.firstName ?? '').toLowerCase().includes(s) ||
        (item.lastName ?? '').toLowerCase().includes(s) ||
        (item.companyName ?? '').toLowerCase().includes(s) ||
        item.code.toLowerCase().includes(s),
      );
    }

    return { items, total: totalRelations, page, pageSize, tier };
  }

  /**
   * Step 3.5C — Three-context customer detail.
   * - BASIC: customer identity + own marketplace orders/bookings/payments
   * - PRO: full Customer 360 with relation fields
   * Server-scoped: actor.partnerId is the ONLY source of partner scope.
   */
  async getPartnerCustomerDetail(
    customerId: string,
    partnerActor: { partnerId?: string | null },
  ) {
    const partnerId = this.assertPartnerActor(partnerActor);
    const tier = await this.getCrmTier(partnerId);

    // Verify access: Basic checks orders, Pro checks relation
    if (tier === "BASIC") {
      const orderCount = await this.prisma.order.count({
        where: { customerId, sellerPartnerId: partnerId },
      });
      if (orderCount === 0) throw new NotFoundError(`Customer ${customerId} not found in partner marketplace`);
    } else {
      const relation = await this.prisma.partnerCustomerRelation.findUnique({
        where: { partnerId_customerId: { partnerId, customerId } },
      });
      if (!relation) throw new NotFoundError(`Customer ${customerId} not found in partner CRM`);
    }

    // Get customer (basic identity)
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true, code: true, type: true, firstName: true, lastName: true,
        companyName: true, email: true, phone: true, status: true, createdAt: true,
      },
    });
    if (!customer) throw new NotFoundError(`Customer ${customerId} not found`);

    // Partner-scoped orders: only orders where sellerPartnerId = actor.partnerId
    const orders = await this.prisma.order.findMany({
      where: { customerId, sellerPartnerId: partnerId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, code: true, number: true, status: true, paymentStatus: true,
        amount: true, paidAmount: true, currency: true, createdAt: true,
      },
    });

    const orderIds = orders.map((o) => o.id);

    const [bookings, payments, totalOrders, totalBookings, totalPayments] = await Promise.all([
      orderIds.length > 0
        ? this.prisma.booking.findMany({
            where: { orderId: { in: orderIds } },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { id: true, code: true, status: true, amount: true, currency: true, createdAt: true },
          })
        : Promise.resolve([]),
      orderIds.length > 0
        ? this.prisma.payment.findMany({
            where: { orderId: { in: orderIds } },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { id: true, code: true, status: true, amount: true, currency: true, createdAt: true },
          })
        : Promise.resolve([]),
      this.prisma.order.count({ where: { customerId, sellerPartnerId: partnerId } }),
      orderIds.length > 0
        ? this.prisma.booking.count({ where: { orderId: { in: orderIds } } })
        : Promise.resolve(0),
      orderIds.length > 0
        ? this.prisma.payment.count({ where: { orderId: { in: orderIds } } })
        : Promise.resolve(0),
    ]);

    const result: any = {
      ...customer,
      orders, bookings, payments,
      summary: { totalOrders, totalBookings, totalPayments },
      _tier: tier,
    };

    // Pro-only: relation fields
    if (tier === "PRO") {
      const relation = await this.prisma.partnerCustomerRelation.findUnique({
        where: { partnerId_customerId: { partnerId, customerId } },
      });
      if (relation) {
        result._relation = {
          id: relation.id, lifecycle: relation.lifecycle, leadSource: relation.leadSource,
          tags: relation.tags, notes: relation.notes, assignedTo: relation.assignedTo,
        };
      }
    }

    return result;
  }

  /**
   * Step 3.5C — Storefront Pro direct customer intake.
   * GATED: only PRO tier can use direct intake.
   * Creates canonical Customer (if needed) + PartnerCustomerRelation in one transaction.
   * Server-scoped: actor.partnerId is the ONLY source of partner scope.
   */
  async intakePartnerCustomer(
    partnerActor: { partnerId?: string | null },
    input: {
      firstName?: string;
      lastName?: string;
      companyName?: string;
      email: string;
      phone?: string;
      leadSource?: string;
      lifecycle?: string;
      tags?: string[];
      notes?: string;
      assignedTo?: string;
      initialNote?: string;
    },
    actorUsername?: string,
  ) {
    const partnerId = this.assertPartnerActor(partnerActor);
    const tier = await this.getCrmTier(partnerId);
    if (tier !== "PRO") {
      throw new ForbiddenException("Direct customer intake requires Storefront Pro CRM entitlement");
    }

    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId }, select: { id: true } });
    if (!partner) throw new NotFoundError(`Partner ${partnerId} not found`);

    const email = normalizeEmail(input.email);

    return this.prisma.$transaction(async (tx) => {
      let customerId: string;
      let customerCreated = false;

      const existing = await tx.customer.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        customerId = existing.id;
      } else {
        const code = await this.ids.nextCode(tx, "CUS");
        const customer = await tx.customer.create({
          data: {
            code,
            type: input.companyName ? "COMPANY" : "PERSON",
            firstName: input.firstName ?? null,
            lastName: input.lastName ?? null,
            companyName: input.companyName ?? null,
            email,
            phone: input.phone ?? null,
            status: "ACTIVE",
            version: 1,
          },
          select: { id: true, code: true },
        });
        customerId = customer.id;
        customerCreated = true;

        await tx.customerHistory.create({
          data: {
            customerId: customer.id,
            action: "created",
            to: "ACTIVE",
            actorId: partnerId,
            actorName: actorUsername ?? null,
            comment: "Storefront Pro direct intake (Step 3.5C)",
          },
        });

        await this.eventBus.emit(tx, {
          aggregateType: "Customer",
          aggregateId: customer.id,
          eventType: DomainEvents.CustomerCreated,
          payload: {
            customerId: customer.id,
            code: customer.code,
            name: input.companyName ?? `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim(),
          } as CustomerEventPayload,
        });
      }

      const existingRelation = await tx.partnerCustomerRelation.findUnique({
        where: { partnerId_customerId: { partnerId, customerId } },
      });
      if (existingRelation) {
        throw new ConflictError(
          customerCreated
            ? `Customer created but already has relation with this partner`
            : `Customer already exists in partner CRM`,
        );
      }

      const relation = await tx.partnerCustomerRelation.create({
        data: {
          partnerId, customerId,
          leadSource: input.leadSource ?? "DIRECT",
          lifecycle: input.lifecycle ?? "LEAD",
          tags: input.tags ?? [],
          notes: input.notes ?? null,
          assignedTo: input.assignedTo ?? null,
        },
      });

      await tx.partnerCustomerRelationHistory.create({
        data: {
          relationId: relation.id,
          action: "created",
          to: "ACTIVE",
          actorId: partnerId,
          actorName: actorUsername ?? null,
          comment: `Storefront Pro direct intake (leadSource: ${input.leadSource ?? "DIRECT"})`,
        },
      });

      // Phase 3 Round 2D: optional initial OperationalNote (same transaction)
      const noteText = normalizeInitialNote(input.initialNote);
      let initialNote: any = null;
      if (noteText && customerCreated) {
        initialNote = await tx.operationalNote.create({
          data: {
            entityType: "Customer",
            entityId: customerId,
            text: noteText,
            visibility: "INTERNAL",
            authorUserId: null,
            authorName: actorUsername ?? null,
          },
        });
      }

      return { customerId, relationId: relation.id, customerCreated, tier, initialNote };
    });
  }

  /**
   * Step 3.5C — Storefront Pro relation update.
   * GATED: only PRO tier can update relation fields.
   * Server-scoped: actor.partnerId is the ONLY source of partner scope.
   */
  async updatePartnerRelation(
    relationId: string,
    partnerActor: { partnerId?: string | null },
    input: { status?: EntityStatus; lifecycle?: string; tags?: string[]; notes?: string; assignedTo?: string },
    actorUsername?: string,
  ) {
    const partnerId = this.assertPartnerActor(partnerActor);
    const tier = await this.getCrmTier(partnerId);
    if (tier !== "PRO") {
      throw new ForbiddenException("Relation management requires Storefront Pro CRM entitlement");
    }

    const existing = await this.prisma.partnerCustomerRelation.findUnique({ where: { id: relationId } });
    if (!existing) throw new NotFoundError(`Partner-Customer relation ${relationId} not found`);

    if (existing.partnerId !== partnerId) {
      throw new ForbiddenException(`Relation ${relationId} does not belong to partner ${partnerId}`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const relation = await tx.partnerCustomerRelation.update({
        where: { id: relationId },
        data: {
          status: input.status ?? existing.status,
          lifecycle: input.lifecycle ?? existing.lifecycle,
          tags: input.tags ?? existing.tags,
          notes: input.notes ?? existing.notes,
          assignedTo: input.assignedTo ?? existing.assignedTo,
          version: { increment: 1 },
        },
      });

      await tx.partnerCustomerRelationHistory.create({
        data: {
          relationId, action: "update",
          from: existing.status, to: relation.status,
          fields: input as Prisma.InputJsonValue,
          actorId: partnerId,
          actorName: actorUsername ?? null,
          comment: "Storefront Pro CRM relation updated (Step 3.5C)",
        },
      });

      return relation;
    });

    return result;
  }
}
