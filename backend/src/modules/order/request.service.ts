import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import type { RequestStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { ReferenceNumberService } from "../../shared/reference-number.service";
import { SecurityService } from "../../security/security.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { ConflictError, ValidationDomainError } from "../../shared/errors";
import { getEffectiveTravelerRequirements } from "../catalog/traveler-requirements";
import { OrderService } from "./order.service";
import { Prisma } from "../../generated/prisma/client";

/**
 * Validate date string for API boundary (422 on malformed input).
 * Returns a valid Date or throws BadRequestException.
 * Shared by list and KPI to ensure validation parity.
 */
function validateDateParam(value: string | undefined, paramName: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`${paramName} must be a valid date`);
  }
  return d;
}

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
  /** D3: явный размер партии (travelers/guests). NULL = legacy (не D3-convertible). */
  travelerCount?: number;
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
    private readonly orders: OrderService,
  ) {}

  /**
   * Create a new Request with shared commerceSequence.
   * Customer clicks [Book] → Request created → Supplier Response SLA starts.
   *
   * D3 (Request Flow): если указан productId — фиксируется productSnapshot
   * (идентичность продукта КАК ПОДАН; immutable). travelercount — явный размер
   * партии (travelers); NULL = legacy (конверсия потребует явного состава).
   */
  async createRequest(dto: CreateRequestDto, actor: Actor): Promise<Record<string, unknown>> {
    if (dto.travelerCount !== undefined) {
      if (!Number.isInteger(dto.travelerCount) || dto.travelerCount < 1) {
        throw new BadRequestException("travelerCount must be a positive integer");
      }
    }
    if (dto.quantity !== undefined && (!Number.isInteger(dto.quantity) || dto.quantity < 1)) {
      throw new BadRequestException("quantity must be a positive integer");
    }

    const commerceSequence = await this.refNum.nextCommerceSequence(null as any);
    const referenceNumber = this.refNum.commerceRequestRef(commerceSequence);
    const code = await this.ids.nextCode(null as any, "REQ");

    const now = new Date();
    const supplierResponseDeadline = new Date(now.getTime() + DEFAULT_SUPPLIER_SLA_HOURS * 60 * 60 * 1000);

    // D3: product identity snapshot при создании (продукт как подан).
    let productSnapshot: Record<string, unknown> | null = null;
    if (dto.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        select: { id: true, code: true, title: true, type: true },
      });
      if (product) {
        productSnapshot = {
          productId: product.id,
          productCode: product.code,
          productTitle: product.title,
          productType: product.type,
        };
      }
    }

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
        travelerCount: dto.travelerCount ?? null,
        productSnapshot: productSnapshot ? (productSnapshot as Prisma.InputJsonValue) : Prisma.JsonNull,
        displayedPrice: dto.displayedPrice != null ? dto.displayedPrice as any : null,
        displayedCurrency: dto.displayedCurrency ?? null,
        confirmedPrice: null,
        confirmedCurrency: null,
        pinnedRequirements: Prisma.JsonNull,
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
      details: { code: request.code, referenceNumber: request.referenceNumber, commerceSequence, travelerCount: dto.travelerCount ?? null },
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
          ...(query.dateFrom ? { gte: validateDateParam(query.dateFrom, "dateFrom") } : {}),
          ...(query.dateTo ? { lt: validateDateParam(query.dateTo, "dateTo") } : {}),
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
        select: {
          id: true, referenceNumber: true, status: true, amount: true,
          currency: true, createdAt: true,
          // D3 (Request Flow UI §14): derived traveler progress — без raw PII.
          travelerCount: true, travelerDataCompletedAt: true, finalConfirmedAt: true,
        },
      });
      if (order) {
        dto.convertedOrder = {
          id: order.id,
          referenceNumber: order.referenceNumber,
          status: order.status,
          amount: order.amount?.toString() ?? null,
          currency: order.currency,
          createdAt: order.createdAt?.toISOString() ?? null,
          // D3 §14: derived progress — сервер-вычислен, без инвенции enum-ов.
          travelerCount: order.travelerCount ?? null,
          travelerProgress: order.finalConfirmedAt
            ? "FINAL_CONFIRMED"
            : order.travelerDataCompletedAt
              ? "DATA_FILLED"
              : (order.travelerCount ?? 0) > 0
                ? "AWAITING_TRAVELERS"
                : null,
          finalConfirmedAt: order.finalConfirmedAt?.toISOString() ?? null,
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
   *
   * D3 (Request Flow §6/§7/§8) — acceptance boundary фиксирует В ОДНОЙ
   * транзакции:
   *   - customerAcceptedAt = РЕАЛЬНЫЙ acceptance instant (используется как
   *     Order.termsAcceptedAt при конвертации — §6 hard);
   *   - pinnedRequirements = effective traveler requirements, замороженные
   *     ЗДЕСЬ (Product policy на момент acceptance; позже mutable Product
   *     НЕ перечитывается — acceptance→pin race невозможен §7);
   *   - travelerCount = frozen party size (explicit travelerCount заявки;
   *     legacy NULL → quantity как единственное прежнее count-представление);
   *   - confirmedPrice/Currency = accepted commercial terms (заморожены).
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

    // D3 §7: pin effective requirements в acceptance boundary. Продукт читается
    // ТОЛЬКО здесь (одна транзакция с acceptance) — позже не перечитывается.
    const product = request.productId
      ? await this.prisma.product.findUnique({
          where: { id: request.productId },
          select: { id: true, code: true, title: true, type: true, travelerRequirements: true },
        })
      : null;
    if (!product) {
      throw new BadRequestException("Cannot accept: Request has no resolvable Product for pinned traveler requirements (D3 §7)");
    }
    const pinnedRequirements = getEffectiveTravelerRequirements(
      product.type as string,
      (product as unknown as { travelerRequirements: Record<string, string> | null }).travelerRequirements ?? null,
    );
    // D3 §8: frozen traveler count. Explicit travelerCount (party composition)
    // — canonical; legacy NULL → quantity (единственное прежнее представление,
    // DB default 1 = 1 гость). Замораживается явно на Request.
    const frozenTravelerCount = request.travelerCount ?? request.quantity;
    if (!Number.isInteger(frozenTravelerCount) || frozenTravelerCount < 1) {
      throw new BadRequestException("Cannot accept: traveler count must be a positive integer (D3 §8)");
    }
    const now = new Date();

    const updated = await this.prisma.request.update({
      where: { id: requestId },
      data: {
        status: "CUSTOMER_ACCEPTED",
        customerAcceptedAt: now,
        customerDecision: "ACCEPTED",
        confirmedPrice: request.supplierPriceProposal ?? request.displayedPrice,
        confirmedCurrency: request.displayedCurrency,
        pinnedRequirements: pinnedRequirements as Prisma.InputJsonValue,
        travelerCount: frozenTravelerCount,
        productSnapshot: {
          productId: product.id,
          productCode: product.code,
          productTitle: product.title,
          productType: product.type,
        } as Prisma.InputJsonValue,
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
        comment: `Клиент принял условия (D3: требования закреплены, состав заморожен: ${frozenTravelerCount} турист(ов))`,
      },
    });

    await this.security.audit(null as any, {
      userId: actor.id,
      username: actor.username,
      action: "request.customer_accepted",
      resource: "Request",
      resourceId: request.id,
      details: {
        code: request.code,
        from: request.status,
        to: "CUSTOMER_ACCEPTED",
        customerAcceptedAt: now.toISOString(),
        travelerCount: frozenTravelerCount,
        confirmedPrice: updated.confirmedPrice?.toString() ?? null,
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
   * Request → Order conversion (application adapter, F6 closure).
   *
   * Канонический контракт §12/§13: Request CONVERTED ↔ Order существует и
   * связан через convertedOrderId ↔ convertedAt IS NOT NULL.
   *
   * Идемпотентность (§10/§11): CAS-claim status CUSTOMER_ACCEPTED → CONVERTED
   * ПЕРВЫМ действием внутри транзакции — concurrent/double conversion даёт
   * ровно одного победителя; повторный вызов после коммита возвращает уже
   * связанный Order (idempotent, без дубля).
   *
   * Order создаётся через OrderService.createOrderFromRequest (canonical Order
   * primitives; frozen facts из Request — mutable Product НЕ читается).
   */
  async convertRequestToOrder(requestId: string, actor: Actor): Promise<Record<string, unknown>> {
    const existing = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!existing) throw new NotFoundException(`Request ${requestId} not found`);

    // Idempotent повторный вызов: заявка уже конвертирована → возвращаем связанный Order.
    if (existing.status === "CONVERTED" && existing.convertedOrderId) {
      const linkedOrder = await this.prisma.order.findUnique({
        where: { id: existing.convertedOrderId },
        select: { id: true, code: true, referenceNumber: true, status: true, createdAt: true },
      });
      if (linkedOrder) {
        const dto = this.requestDto(existing) as any;
        dto.convertedOrder = {
          id: linkedOrder.id,
          referenceNumber: linkedOrder.referenceNumber,
          status: linkedOrder.status,
          amount: null,
          currency: null,
          createdAt: linkedOrder.createdAt?.toISOString() ?? null,
        };
        dto.idempotent = true;
        return dto;
      }
    }

    // Гейт конверсии: только принятая заявка (валидные supplier/current terms).
    if (existing.status !== "CUSTOMER_ACCEPTED") {
      throw new ConflictException(
        `Cannot convert Request ${requestId} in status ${existing.status}; conversion requires CUSTOMER_ACCEPTED`,
      );
    }
    if (!existing.customerAcceptedAt || !existing.pinnedRequirements || !existing.travelerCount) {
      throw new ConflictException(
        `Request ${requestId} has no D3 acceptance snapshot (customerAcceptedAt/pinnedRequirements/travelerCount); conversion rejected`,
      );
    }

    const productSnapshot = (existing.productSnapshot ?? null) as unknown as {
      productId: string;
      productCode: string;
      productTitle: string;
      productType: string;
    } | null;
    if (!productSnapshot || !productSnapshot.productId) {
      throw new ConflictException(`Request ${requestId} has no product snapshot; conversion rejected`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // CAS-claim: CUSTOMER_ACCEPTED → CONVERTED (один победитель при гонке).
      const claim = await tx.request.updateMany({
        where: { id: requestId, status: "CUSTOMER_ACCEPTED" },
        data: { status: "CONVERTED", version: { increment: 1 } },
      });
      if (claim.count !== 1) {
        // Concurrent conversion уже прошёл (или невалидный переход) → честный
        // ответ без дубля Order: повторное чтение даёт CONVERTED+order.
        const fresh = await tx.request.findUnique({ where: { id: requestId } });
        if (fresh?.status === "CONVERTED" && fresh.convertedOrderId) {
          return { alreadyConverted: true, request: fresh };
        }
        throw new ConflictError(`Request ${requestId} was concurrently converted; retry`);
      }

      // Order graph через OrderService (canonical primitives, та же транзакция).
      const { order, eventId } = await this.orders.createOrderFromRequest(tx, {
        request: {
          id: existing.id,
          commerceSequence: existing.commerceSequence,
          customerId: existing.customerId,
          productId: existing.productId,
          productSnapshot,
          requestedServiceDate: existing.requestedServiceDate,
          quantity: existing.quantity,
          confirmedPrice: existing.confirmedPrice?.toString() ?? null,
          confirmedCurrency: existing.confirmedCurrency,
          displayedPrice: existing.displayedPrice?.toString() ?? null,
          displayedCurrency: existing.displayedCurrency,
          customerAcceptedAt: existing.customerAcceptedAt,
          pinnedRequirements: existing.pinnedRequirements as unknown as Record<string, string> | null,
          travelerCount: existing.travelerCount,
        },
        actor,
      });

      // Link: convertedOrderId/convertedAt = фактический Order root (FK/UUID;
      // никогда не из REQ-*/ORD-* строк §9). convertedAt = Order.createdAt
      // (≈ конверсионная транзакция; каноническая семантика §13 сохранена).
      const linked = await tx.request.update({
        where: { id: requestId },
        data: { convertedOrderId: order.id, convertedAt: order.createdAt },
        select: {
          id: true, code: true, status: true, convertedOrderId: true,
          convertedAt: true, referenceNumber: true, version: true,
        },
      });

      await tx.requestHistory.create({
        data: {
          requestId,
          action: "converted",
          from: "CUSTOMER_ACCEPTED",
          to: "CONVERTED",
          actorId: actor.id,
          actorName: actor.username,
          comment: `Заявка конвертирована в заказ ${order.referenceNumber}`,
        },
      });

      await this.security.audit(tx as any, {
        userId: actor.id,
        username: actor.username,
        action: "request.converted",
        resource: "Request",
        resourceId: requestId,
        details: {
          code: linked.code,
          from: "CUSTOMER_ACCEPTED",
          to: "CONVERTED",
          orderId: order.id,
          orderReferenceNumber: order.referenceNumber,
          commerceSequence: existing.commerceSequence,
          eventId,
        },
      });

      return { alreadyConverted: false, request: linked, order, orderCreatedEventId: eventId };
    });

    // Delivery OrderCreated — ПОСЛЕ коммита (паттерн canonical consumer;
    // failure → FAILED + retryable, не rollback).
    if (!result.alreadyConverted && result.orderCreatedEventId) {
      await this.eventBus.publishEvent(result.orderCreatedEventId).catch(() => undefined);
    }

    if (result.alreadyConverted) {
      const fresh = result.request as any;
      const orderRef = fresh.convertedOrderId
        ? await this.prisma.order.findUnique({
            where: { id: fresh.convertedOrderId },
            select: { id: true, referenceNumber: true, status: true, createdAt: true },
          })
        : null;
      const dto = this.requestDto(fresh) as any;
      if (orderRef) {
        dto.convertedOrder = {
          id: orderRef.id,
          referenceNumber: orderRef.referenceNumber,
          status: orderRef.status,
          amount: null,
          currency: null,
          createdAt: orderRef.createdAt?.toISOString() ?? null,
        };
      }
      dto.idempotent = true;
      return dto;
    }

    const order = result.order as unknown as { id: string; referenceNumber: string; createdAt: Date };
    const dto = this.requestDto(result.request as any) as any;
    dto.convertedOrder = {
      id: order.id,
      referenceNumber: order.referenceNumber,
      status: "NEW",
      amount: null,
      currency: null,
      createdAt: order.createdAt.toISOString(),
    };
    return dto;
  }

  /**
   * Get Request KPI counts by status.
   */
  async getRequestKpi(query?: { dateFrom?: string; dateTo?: string }): Promise<Record<string, number>> {
    // UI-C1.2F.1A: period-aware KPI. Uses the same createdAt [from, to)
    // boundary semantics as listRequests for scope parity with the future
    // shared Operations Center Header Period (global scope → KPI + table).
    const where: any = {};
    if (query?.dateFrom || query?.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: validateDateParam(query.dateFrom, "dateFrom") } : {}),
        ...(query.dateTo ? { lt: validateDateParam(query.dateTo, "dateTo") } : {}),
      };
    }

    const counts = await this.prisma.request.groupBy({
      by: ["status"],
      where,
      _count: { status: true },
    });

    // UI-C1.2F.1A R1: zero-fill all 12 canonical Request statuses so
    // every status is always present in the response (zero-count included).
    const ALL_STATUSES = [
      "NEW", "CHECKING", "SUPPLIER_TIMEOUT", "PRICE_CHANGED",
      "CUSTOMER_ACCEPTED", "CONFIRMED", "CONVERTED", "REJECTED",
      "UNAVAILABLE", "EXPIRED", "CUSTOMER_PAYMENT_TIMEOUT", "CANCELLED_BY_CUSTOMER",
    ] as const;
    const kpi: Record<string, number> = { total: 0 };
    for (const s of ALL_STATUSES) kpi[s.toLowerCase()] = 0;
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
      // D3: frozen party composition (travelerCount). NULL = legacy заявка.
      travelerCount: r.travelerCount ?? null,
      productSnapshot: r.productSnapshot ?? null,
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
