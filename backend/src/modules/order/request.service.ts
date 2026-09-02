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
    const isExport = query.pageSize === 10000; // export requests all records
    const pageSize = isExport ? 10000 : Math.min(100, Math.max(1, query.pageSize ?? 20));

    // Build search: first resolve names/codes to IDs, then filter
    let searchOr: any[] | undefined;
    let searchCustomerIds: string[] | undefined;
    let searchProductIds: string[] | undefined;
    let searchPartnerIds: string[] | undefined;
    if (query.search) {
      const s = query.search;
      // Direct Request fields
      searchOr = [
        { referenceNumber: { contains: s, mode: "insensitive" } },
        { code: { contains: s, mode: "insensitive" } },
        { commerceSequence: { contains: s, mode: "insensitive" } },
      ];
      // Resolve customer/product/partner by name/code
      const [matchedCustomers, matchedProducts, matchedPartners] = await Promise.all([
        this.prisma.customer.findMany({ where: { OR: [
          { firstName: { contains: s, mode: "insensitive" } },
          { lastName: { contains: s, mode: "insensitive" } },
          { code: { contains: s, mode: "insensitive" } },
          { email: { contains: s, mode: "insensitive" } },
        ]}, select: { id: true } }),
        this.prisma.product.findMany({ where: { OR: [
          { title: { contains: s, mode: "insensitive" } },
          { code: { contains: s, mode: "insensitive" } },
        ]}, select: { id: true } }),
        this.prisma.partner.findMany({ where: { OR: [
          { name: { contains: s, mode: "insensitive" } },
          { code: { contains: s, mode: "insensitive" } },
        ]}, select: { id: true } }),
      ]);
      if (matchedCustomers.length) searchCustomerIds = matchedCustomers.map((c) => c.id).filter(Boolean) as string[];
      if (matchedProducts.length) searchProductIds = matchedProducts.map((p) => p.id).filter(Boolean) as string[];
      if (matchedPartners.length) searchPartnerIds = matchedPartners.map((p) => p.id).filter(Boolean) as string[];
    }

    // Combine search conditions: direct OR + resolved entity IDs
    const allSearchConditions = [...(searchOr ?? [])];
    if (searchCustomerIds?.length) allSearchConditions.push({ customerId: { in: searchCustomerIds } });
    if (searchProductIds?.length) allSearchConditions.push({ productId: { in: searchProductIds } });
    if (searchPartnerIds?.length) allSearchConditions.push({ partnerId: { in: searchPartnerIds } });

    const where: any = {
      ...(query.status ? { status: query.status as RequestStatus } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.partnerId ? { partnerId: query.partnerId } : {}),
      ...(allSearchConditions.length ? { OR: allSearchConditions } : {}),
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

    // Batch-fetch related entities for human-readable names
    const customerIds = [...new Set(items.map((r) => r.customerId).filter((id): id is string => !!id))];
    const productIds = [...new Set(items.map((r) => r.productId).filter((id): id is string => !!id))];
    const partnerIds = [...new Set(items.map((r) => r.partnerId).filter((id): id is string => !!id))];

    const [customers, products, partners] = await Promise.all([
      customerIds.length ? this.prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, firstName: true, lastName: true, code: true } }) : [],
      productIds.length ? this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, title: true, code: true } }) : [],
      partnerIds.length ? this.prisma.partner.findMany({ where: { id: { in: partnerIds } }, select: { id: true, name: true, code: true } }) : [],
    ]);

    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const productMap = new Map(products.map((p) => [p.id, p]));
    const partnerMap = new Map(partners.map((p) => [p.id, p]));

    return {
      data: items.map((r) => this.requestDto(r, customerMap, productMap, partnerMap)),
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

    // Fetch related entities
    const [customer, product, partner] = await Promise.all([
      request.customerId ? this.prisma.customer.findUnique({ where: { id: request.customerId }, select: { firstName: true, lastName: true, code: true, email: true, phone: true } }) : null,
      request.productId ? this.prisma.product.findUnique({ where: { id: request.productId }, select: { title: true, code: true, type: true } }) : null,
      request.partnerId ? this.prisma.partner.findUnique({ where: { id: request.partnerId }, select: { name: true, code: true, countryCode: true } }) : null,
    ]);

    const customerMap = customer ? new Map([[request.customerId!, customer]]) : new Map();
    const productMap = product ? new Map([[request.productId!, product]]) : new Map();
    const partnerMap = partner ? new Map([[request.partnerId!, partner]]) : new Map();
    const dto = this.requestDto(request, customerMap, productMap, partnerMap) as any;

    dto.customerEmail = customer?.email ?? null;
    dto.customerPhone = customer?.phone ?? null;
    dto.productType = product?.type ?? null;
    dto.partnerCountry = partner?.countryCode ?? null;

    // If converted, load the related Order → Booking → Payment chain
    if (request.convertedOrderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: request.convertedOrderId },
        select: { id: true, referenceNumber: true, status: true, amount: true, currency: true, createdAt: true },
      });
      if (order) {
        dto.convertedOrder = {
          id: order.id,
          referenceNumber: order.referenceNumber,
          status: order.status,
          amount: order.amount?.toString() ?? null,
          currency: order.currency,
          createdAt: order.createdAt?.toISOString() ?? null,
        };
        const booking = await this.prisma.booking.findFirst({
          where: { orderId: order.id },
          select: { id: true, referenceNumber: true, status: true, createdAt: true, serviceDate: true, completedAt: true },
        });
        if (booking) {
          dto.convertedBooking = {
            id: booking.id,
            referenceNumber: booking.referenceNumber,
            status: booking.status,
            createdAt: booking.createdAt?.toISOString() ?? null,
            serviceDate: booking.serviceDate?.toISOString() ?? null,
            completedAt: booking.completedAt?.toISOString() ?? null,
          };
        }
        const payments = await this.prisma.payment.findMany({
          where: { orderId: order.id },
          select: { id: true, referenceNumber: true, status: true, amount: true, currency: true, createdAt: true, paidAt: true },
          orderBy: { createdAt: "asc" },
        });
        dto.convertedPayments = payments.map((p) => ({
          id: p.id,
          referenceNumber: p.referenceNumber,
          status: p.status,
          amount: p.amount?.toString() ?? null,
          currency: p.currency,
          createdAt: p.createdAt?.toISOString() ?? null,
          paidAt: p.paidAt?.toISOString() ?? null,
        }));

        // Check for refund
        const refund = await this.prisma.refund.findFirst({
          where: { orderId: order.id },
          select: { id: true, referenceNumber: true, status: true, amount: true, currency: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        });
        if (refund) {
          dto.convertedRefund = {
            id: refund.id,
            referenceNumber: refund.referenceNumber,
            status: refund.status,
            amount: refund.amount?.toString() ?? null,
            currency: refund.currency,
            createdAt: refund.createdAt?.toISOString() ?? null,
          };
        }
      }
    }

    // ── Full temporal timeline ──
    dto.timeline = [
      { label: "Заявка создана", timestamp: request.createdAt?.toISOString() ?? null },
      { label: "SLA поставщика до", timestamp: request.supplierResponseDeadline?.toISOString() ?? null },
      { label: "Ответ поставщика", timestamp: request.supplierRespondedAt?.toISOString() ?? null },
      { label: "Клиент должен ответить до", timestamp: request.customerActionDeadline?.toISOString() ?? null },
      { label: "Клиент подтвердил", timestamp: request.customerAcceptedAt?.toISOString() ?? null },
      { label: "Конвертирована в заказ", timestamp: request.convertedAt?.toISOString() ?? null },
      { label: "Заказ создан", timestamp: dto.convertedOrder?.createdAt ?? null },
      { label: "Бронирование создано", timestamp: dto.convertedBooking?.createdAt ?? null },
      { label: "Оплата инициирована", timestamp: dto.convertedPayments?.[0]?.createdAt ?? null },
      { label: "Оплачено", timestamp: dto.convertedPayments?.find((p: any) => p.paidAt)?.paidAt ?? null },
      { label: "Дата услуги", timestamp: request.requestedServiceDate?.toISOString() ?? dto.convertedBooking?.serviceDate ?? null },
      { label: "Завершено", timestamp: dto.convertedBooking?.completedAt ?? null },
      { label: "Отменено/Отклонено/Timeout", timestamp: request.rejectedAt?.toISOString() ?? null },
      { label: "Возврат", timestamp: dto.convertedRefund?.createdAt ?? null },
    ];

    return dto;
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

  /**
   * Resolve order IDs to their reference numbers.
   */
  async resolveOrderReferences(orderIds: string[]): Promise<Map<string, string>> {
    if (!orderIds.length) return new Map();
    const uniqueIds = [...new Set(orderIds)];
    const orders = await this.prisma.order.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, referenceNumber: true },
    });
    return new Map(orders.map((o) => [o.id, o.referenceNumber]));
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

  private requestDto(r: any, customerMap?: Map<string, any>, productMap?: Map<string, any>, partnerMap?: Map<string, any>): Record<string, unknown> {
    const cust = customerMap?.get(r.customerId);
    const prod = productMap?.get(r.productId);
    const part = partnerMap?.get(r.partnerId);
    const customerName = cust ? `${cust.firstName ?? ""} ${cust.lastName ?? ""}`.trim() : null;
    const productName = prod?.title ?? null;
    const partnerName = part?.name ?? null;
    return {
      id: r.id,
      code: r.code,
      commerceSequence: r.commerceSequence,
      referenceNumber: r.referenceNumber,
      customerId: r.customerId,
      customerName,
      customerCode: cust?.code ?? null,
      productId: r.productId,
      productName,
      productCode: prod?.code ?? null,
      partnerId: r.partnerId,
      partnerName,
      partnerCode: part?.code ?? null,
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
