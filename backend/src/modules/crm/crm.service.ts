import { Injectable } from "@nestjs/common";
import type { Prisma, CustomerType, EntityStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type CustomerEventPayload, type PartnerEventPayload } from "../../eventbus/domain-events";
import { IdsService } from "../../shared/ids.service";
import { ConflictError, NotFoundError } from "../../shared/errors";
import { normalizeEmail } from "../../shared/field-validation";

export interface CreateCustomerInput {
  type?: CustomerType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email: string;
  phone?: string;
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
  page?: number;
  pageSize?: number;
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

      return { customer, eventId };
    });

    await this.eventBus.publishPending();
    return result;
  }

  async listCustomers(query: CustomerListQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.CustomerWhereInput = {
      ...(query.status ? { status: query.status as EntityStatus } : {}),
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

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
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

    const [items, total] = await Promise.all([
      this.prisma.partner.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.partner.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getPartner(id: string) {
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
    return partner;
  }

  // ── Customer Detail with related data (Step 3.5) ──────────────────────

  async getCustomerDetail(id: string) {
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
    const orders = await this.prisma.order.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, code: true, number: true, status: true, paymentStatus: true, amount: true, paidAmount: true, currency: true, createdAt: true },
    });

    // Get order IDs for cross-schema queries (no FK — ADR-0001)
    const orderIds = orders.map((o) => o.id);

    // Bookings and Payments reference orderId directly (no Prisma relation)
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
      this.prisma.order.count({ where: { customerId: id } }),
      orderIds.length > 0
        ? this.prisma.booking.count({ where: { orderId: { in: orderIds } } })
        : Promise.resolve(0),
      orderIds.length > 0
        ? this.prisma.payment.count({ where: { orderId: { in: orderIds } } })
        : Promise.resolve(0),
    ]);

    return {
      ...customer,
      orders,
      bookings,
      payments,
      summary: {
        totalOrders,
        totalBookings,
        totalPayments,
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
}
