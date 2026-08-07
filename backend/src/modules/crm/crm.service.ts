import { Injectable } from "@nestjs/common";
import type { Prisma, CustomerType, EntityStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type CustomerEventPayload } from "../../eventbus/domain-events";
import { IdsService } from "../../shared/ids.service";
import { ConflictError, NotFoundError } from "../../shared/errors";

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

      const eventId = await this.eventBus.emit(tx, {
        aggregateType: "Customer",
        aggregateId: customer.id,
        eventType: DomainEvents.CustomerCreated,
        payload: {
          customerId: customer.id,
          code: customer.code,
          name: customer.companyName ?? `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim(),
          email: customer.email,
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
          email: customer.email,
          changedFields: Object.keys(input),
        } as CustomerEventPayload,
      });

      return { customer, eventId };
    });

    await this.eventBus.publishPending();
    return result;
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

  async createPartner(name: string, companyId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "PAR");
      return tx.partner.create({ data: { code, name, companyId: companyId ?? null, status: "ACTIVE" } });
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
}
