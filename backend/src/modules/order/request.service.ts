import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import type { RequestStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { ReferenceNumberService } from "../../shared/reference-number.service";
import { SecurityService } from "../../security/security.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents } from "../../eventbus/domain-events";
import { uniqueConstraintNames } from "../../shared/prisma-errors";

/** Default SLA: 24 hours for supplier response */
const DEFAULT_SUPPLIER_SLA_HOURS = 24;
/** Default customer TTL: 48 hours after supplier confirmation */
const DEFAULT_CUSTOMER_TTL_HOURS = 48;

interface Actor {
  id: string;
  username: string;
}

interface CreateRequestDto {
  customerId?: string;
  productId?: string;
  partnerId?: string;
  requestedServiceDate?: string;
  quantity?: number;
  displayedPrice?: number;
  displayedCurrency?: string;
}

interface ListRequestQuery {
  status?: string;
  customerId?: string;
  partnerId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class RequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly refNum: ReferenceNumberService,
    private readonly security: SecurityService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Create a new Request with shared commerceSequence.
   * Customer clicks [Book] → Request created → Supplier Response SLA starts.
   */
  async createRequest(dto: CreateRequestDto, actor: Actor): Promise<Record<string, unknown>> {
    const commerceSequence = await this.refNum.nextCommerceSequence(null as any);
    const referenceNumber = this.refNum.commerceRequestRef(commerceSequence);
    const code = await this.ids.nextCode(null as any, "REQ");

    const now = new Date();
    const supplierResponseDeadline = new Date(now.getTime() + DEFAULT_SUPPLIER_SLA_HOURS * 60 * 60 * 1000);

    const request = await this.prisma.request.create({
      data: {
        code,
        commerceSequence,
        referenceNumber,
        customerId: dto.customerId ?? null,
        productId: dto.productId ?? null,
        partnerId: dto.partnerId ?? null,
        status: "NEW",
        requestedServiceDate: dto.requestedServiceDate ? new Date(dto.requestedServiceDate) : null,
        quantity: dto.quantity ?? 1,
        displayedPrice: dto.displayedPrice != null ? dto.displayedPrice as any : null,
        displayedCurrency: dto.displayedCurrency ?? null,
        confirmedPrice: null,
        confirmedCurrency: null,
        supplierResponseDeadline,
        supplierRespondedAt: null,
        supplierDecision: null,
        supplierPriceProposal: null,
        supplierNote: null,
        customerActionDeadline: null,
        customerAcceptedAt: null,
        customerDecision: null,
        convertedOrderId: null,
        convertedAt: null,
        rejectedAt: null,
        rejectedBy: null,
        rejectionReason: null,
        version: 1,
      },
    });

    await this.prisma.requestHistory.create({
      data: {
        requestId: request.id,
        action: "created",
        to: "NEW",
        actorId: actor.id,
        actorName: actor.username,
        comment: "Заявка создана (Shared Commerce Sequence)",
      },
    });

    await this.security.audit(null as any, {
      userId: actor.id,
      username: actor.username,
      action: "request.created",
      resource: "Request",
      resourceId: request.id,
      details: { code: request.code, referenceNumber: request.referenceNumber, commerceSequence },
    });

    return this.requestDto(request);
  }

  /**
   * List Requests with server-side filtering, pagination, and search.
   */
  async listRequests(query: ListRequestQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const where: any = {
      ...(query.status ? { status: query.status as RequestStatus } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.partnerId ? { partnerId: query.partnerId } : {}),
      ...(query.search ? {
        OR: [
          { referenceNumber: { contains: query.search, mode: "insensitive" } },
          { code: { contains: query.search, mode: "insensitive" } },
          { commerceSequence: { contains: query.search, mode: "insensitive" } },
        ],
      } : {}),
      ...(query.dateFrom || query.dateTo ? {
        createdAt: {
          ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
          ...(query.dateTo ? { lt: new Date(query.dateTo) } : {}),
        },
      } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.request.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.request.count({ where }),
    ]);

    return {
      data: items.map((r) => this.requestDto(r)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get Request detail.
   */
  async getRequest(id: string): Promise<Record<string, unknown>> {
    const request = await this.prisma.request.findUnique({ where: { id } });
    if (!request) throw new NotFoundException(`Request ${id} not found`);
    return this.requestDto(request);
  }

  /**
   * Get Request by code (MKT-REQ-*).
   */
  async getRequestByCode(code: string): Promise<Record<string, unknown>> {
    const request = await this.prisma.request.findFirst({ where: { code } });
    if (!request) throw new NotFoundException(`Request ${code} not found`);
    return this.requestDto(request);
  }

  /**
   * Supplier action: confirm current price.
   */
  async confirmPrice(requestId: string, actor: Actor, note?: string): Promise<Record<string, unknown>> {
    return this.supplierAction(requestId, "CONFIRMED", "CONFIRMED", actor, note);
  }

  /**
   * Supplier action: propose new price.
   */
  async proposePrice(requestId: string, actor: Actor, newPrice: number, note?: string): Promise<Record<string, unknown>> {
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`Request ${requestId} not found`);
    if (request.status !== "CHECKING" && request.status !== "NEW") {
      throw new BadRequestException(`Cannot propose price in status ${request.status}`);
    }

    const now = new Date();
    const customerActionDeadline = new Date(now.getTime() + DEFAULT_CUSTOMER_TTL_HOURS * 60 * 60 * 1000);

    const updated = await this.prisma.request.update({
      where: { id: requestId },
      data: {
        status: "PRICE_CHANGED",
        supplierRespondedAt: now,
        supplierDecision: "PRICE_CHANGED",
        supplierPriceProposal: newPrice as any,
        supplierNote: note ?? null,
        customerActionDeadline,
        version: { increment: 1 },
      },
    });

    await this.prisma.requestHistory.create({
      data: {
        requestId,
        action: "supplier_proposed_price",
        from: request.status,
        to: "PRICE_CHANGED",
        actorId: actor.id,
        actorName: actor.username,
        comment: `Предложена новая цена: ${newPrice}. ${note ?? ""}`,
      },
    });

    return this.requestDto(updated);
  }

  /**
   * Supplier action: reject request.
   */
  async rejectRequest(requestId: string, actor: Actor, reason?: string): Promise<Record<string, unknown>> {
    return this.supplierAction(requestId, "REJECTED", "REJECTED", actor, reason);
  }

  /**
   * Supplier action: mark unavailable.
   */
  async markUnavailable(requestId: string, actor: Actor, reason?: string): Promise<Record<string, unknown>> {
    return this.supplierAction(requestId, "UNAVAILABLE", "UNAVAILABLE", actor, reason);
  }

  /**
   * Customer action: accept price change / confirm terms.
   */
  async customerAccept(requestId: string, actor: Actor): Promise<Record<string, unknown>> {
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`Request ${requestId} not found`);
    if (request.status !== "PRICE_CHANGED" && request.status !== "CONFIRMED") {
      throw new BadRequestException(`Cannot accept in status ${request.status}`);
    }
    if (request.customerActionDeadline && new Date() > request.customerActionDeadline) {
      throw new BadRequestException("Customer action deadline has expired");
    }

    const updated = await this.prisma.request.update({
      where: { id: requestId },
      data: {
        status: "CUSTOMER_ACCEPTED",
        customerAcceptedAt: new Date(),
        customerDecision: "ACCEPTED",
        confirmedPrice: request.supplierPriceProposal ?? request.displayedPrice,
        confirmedCurrency: request.displayedCurrency,
        version: { increment: 1 },
      },
    });

    await this.prisma.requestHistory.create({
      data: {
        requestId,
        action: "customer_accepted",
        from: request.status,
        to: "CUSTOMER_ACCEPTED",
        actorId: actor.id,
        actorName: actor.username,
        comment: "Клиент принял условия",
      },
    });

    return this.requestDto(updated);
  }

  /**
   * Customer action: decline price change.
   */
  async customerDecline(requestId: string, actor: Actor): Promise<Record<string, unknown>> {
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`Request ${requestId} not found`);

    const updated = await this.prisma.request.update({
      where: { id: requestId },
      data: {
        status: "CANCELLED_BY_CUSTOMER",
        customerDecision: "DECLINED",
        rejectedAt: new Date(),
        rejectedBy: "customer",
        rejectionReason: "Клиент отказался от новых условий",
        version: { increment: 1 },
      },
    });

    await this.prisma.requestHistory.create({
      data: {
        requestId,
        action: "customer_declined",
        from: request.status,
        to: "CANCELLED_BY_CUSTOMER",
        actorId: actor.id,
        actorName: actor.username,
        comment: "Клиент отклонил условия",
      },
    });

    return this.requestDto(updated);
  }

  /**
   * Internal: convert confirmed Request to Order.
   */
  async convertToOrder(requestId: string, orderId: string, actor: Actor): Promise<Record<string, unknown>> {
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`Request ${requestId} not found`);

    const updated = await this.prisma.request.update({
      where: { id: requestId },
      data: {
        status: "CONVERTED",
        convertedOrderId: orderId,
        convertedAt: new Date(),
        version: { increment: 1 },
      },
    });

    await this.prisma.requestHistory.create({
      data: {
        requestId,
        action: "converted",
        from: request.status,
        to: "CONVERTED",
        actorId: actor.id,
        actorName: actor.username,
        comment: `Заявка конвертирована в заказ ${orderId}`,
      },
    });

    return this.requestDto(updated);
  }

  /**
   * Get Request KPI counts by status.
   */
  async getRequestKpi(): Promise<Record<string, number>> {
    const counts = await this.prisma.request.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    const kpi: Record<string, number> = { total: 0 };
    for (const c of counts) {
      kpi[c.status.toLowerCase()] = c._count.status;
      kpi.total += c._count.status;
    }
    return kpi;
  }

  /**
   * Get Request history.
   */
  async getRequestHistory(requestId: string) {
    return this.prisma.requestHistory.findMany({
      where: { requestId },
      orderBy: { createdAt: "desc" },
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private async supplierAction(
    requestId: string,
    decision: string,
    newStatus: string,
    actor: Actor,
    note?: string,
  ): Promise<Record<string, unknown>> {
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`Request ${requestId} not found`);
    if (request.status !== "CHECKING" && request.status !== "NEW") {
      throw new BadRequestException(`Cannot perform supplier action in status ${request.status}`);
    }

    const now = new Date();
    const isTerminal = decision === "REJECTED" || decision === "UNAVAILABLE";

    const updateData: any = {
      status: newStatus,
      supplierRespondedAt: now,
      supplierDecision: decision,
      supplierNote: note ?? null,
      version: { increment: 1 },
    };

    if (isTerminal) {
      updateData.rejectedAt = now;
      updateData.rejectedBy = "supplier";
      updateData.rejectionReason = note ?? null;
    }

    const updated = await this.prisma.request.update({
      where: { id: requestId },
      data: updateData,
    });

    await this.prisma.requestHistory.create({
      data: {
        requestId,
        action: `supplier_${decision.toLowerCase()}`,
        from: request.status,
        to: newStatus,
        actorId: actor.id,
        actorName: actor.username,
        comment: note ?? `Поставщик: ${decision}`,
      },
    });

    return this.requestDto(updated);
  }

  private requestDto(r: any): Record<string, unknown> {
    return {
      id: r.id,
      code: r.code,
      commerceSequence: r.commerceSequence,
      referenceNumber: r.referenceNumber,
      customerId: r.customerId,
      productId: r.productId,
      partnerId: r.partnerId,
      status: r.status,
      requestedServiceDate: r.requestedServiceDate?.toISOString() ?? null,
      quantity: r.quantity,
      displayedPrice: r.displayedPrice?.toString() ?? null,
      displayedCurrency: r.displayedCurrency,
      confirmedPrice: r.confirmedPrice?.toString() ?? null,
      confirmedCurrency: r.confirmedCurrency,
      supplierResponseDeadline: r.supplierResponseDeadline?.toISOString() ?? null,
      supplierRespondedAt: r.supplierRespondedAt?.toISOString() ?? null,
      supplierDecision: r.supplierDecision,
      supplierPriceProposal: r.supplierPriceProposal?.toString() ?? null,
      supplierNote: r.supplierNote,
      customerActionDeadline: r.customerActionDeadline?.toISOString() ?? null,
      customerAcceptedAt: r.customerAcceptedAt?.toISOString() ?? null,
      customerDecision: r.customerDecision,
      convertedOrderId: r.convertedOrderId,
      convertedAt: r.convertedAt?.toISOString() ?? null,
      rejectedAt: r.rejectedAt?.toISOString() ?? null,
      rejectedBy: r.rejectedBy,
      rejectionReason: r.rejectionReason,
      createdAt: r.createdAt?.toISOString() ?? null,
      updatedAt: r.updatedAt?.toISOString() ?? null,
      version: r.version,
    };
  }
}
