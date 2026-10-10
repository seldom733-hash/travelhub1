import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import type { RequestStatus, ProductType } from "../../generated/prisma/client";

/**
 * Narrow the Product shape that the availability projection reads so the type
 * of `buildRequestProjectionProductSnapshot(...)` is stable across the module.
 */
type RequestProjectionProductShape = {
  id: string;
  code: string;
  title: string;
  type: ProductType;
  travelerRequirements: Record<string, string> | null;
};


/**
 * UI-C6: server-authoritative Request action availability projection.
 *
 * Request semantics are actor-flavored (supplier actions vs customer actions),
 * so Request uses its own typed projection rather than the Order/Booking
 * string-array convention. Frontend must render only this projection.
 */
export interface RequestAvailableActions {
  confirmPrice: boolean;
  proposePrice: boolean;
  reject: boolean;
  unavailable: boolean;
  customerAccept: boolean;
  customerDecline: boolean;
  convert: boolean;
}

const REQUEST_EDIT_PERMISSION = "order.edit_noncritical";

/**
 * Request action availability = current status + existing service business gates
 * + actor permission. This is a read projection, not the only security gate.
 */
export function computeRequestAvailableActions(
  request: {
    status: RequestStatus;
    convertedOrderId: string | null;
    customerActionDeadline: Date | null;
    customerAcceptedAt: Date | null;
    pinnedRequirements: unknown;
    travelerCount: number | null;
    /** Two-stage §6: true = RequestTraveler заполнены и сходятся с travelerCount. */
    travelersReady?: boolean;
    productSnapshot: unknown;
    // Supplier Markup Phase 3 (design §8): convert-gate mirrors the Order
    // conversion money gate (order.service: confirmed ?? displayed > 0 + currency).
    confirmedPrice: unknown;
    confirmedCurrency: string | null;
    displayedPrice: unknown;
    displayedCurrency: string | null;
  },
  granted: readonly string[],
): RequestAvailableActions {
  const canEdit = granted.includes(REQUEST_EDIT_PERMISSION);
  const now = new Date();

  // customerAccept execution path enforces customerActionDeadline (if set);
  // customerDecline execution path does NOT. Projection mirrors that contract.
  const withinCustomerAcceptWindow =
    request.customerActionDeadline == null ||
    now <= request.customerActionDeadline;

  const hasD3AcceptSnapshot =
    request.customerAcceptedAt != null &&
    request.pinnedRequirements != null &&
    request.travelerCount != null &&
    request.productSnapshot != null;

  // Two-stage traveler model §6: готовность = состав туристов заполнен и
  // совпадает с travelerCount. Read-projection (execution гейт — авторитетен
  // в customerAccept/convertRequestToOrder). Не передано (unit-прогнозы) → true.
  const travelersReady = request.travelersReady ?? true;

  // Money gate order mirrors convertRequestToOrder (order.service:658-661):
  // accepted money = confirmed ?? displayed; currency likewise.
  const convertMoney = request.confirmedPrice ?? request.displayedPrice;
  const convertCurrency = request.confirmedCurrency ?? request.displayedCurrency;
  const hasAcceptedMoney =
    convertMoney != null &&
    convertCurrency != null &&
    Number(convertMoney) > 0 &&
    String(convertCurrency).trim().length > 0;

  return {
    confirmPrice: canEdit && (request.status === "NEW" || request.status === "CHECKING"),
    proposePrice: canEdit && (request.status === "NEW" || request.status === "CHECKING"),
    reject: canEdit && (request.status === "NEW" || request.status === "CHECKING"),
    unavailable: canEdit && (request.status === "NEW" || request.status === "CHECKING"),
    customerAccept:
      canEdit &&
      travelersReady &&
      withinCustomerAcceptWindow &&
      (request.status === "PRICE_CHANGED" || request.status === "CONFIRMED"),
    customerDecline: canEdit && (request.status === "PRICE_CHANGED" || request.status === "CONFIRMED"),
    // Stage 1 (Order → Request): convert-gate зеркалит execution (status
    // CUSTOMER_ACCEPTED + отсутствие конверсионного link: повторная
    // конвертация вернувшейся заявки блокируется 409 — один Order на
    // commerce chain). customerAccept/Decline без link-условия — execution
    // status-only (возврат не ломает supplier/customer цикл).
    // Phase 3: + деньги (design §8) — без валидных денег convert=false.
    convert:
      canEdit &&
      travelersReady &&
      hasD3AcceptSnapshot &&
      hasAcceptedMoney &&
      request.status === "CUSTOMER_ACCEPTED" &&
      request.convertedOrderId === null,
  };
}

/**
 * Sync helper for the availability projection: mirrors the same Product data
 * shape that getRequest() reads so the projection has the same Db-read context
 * as the execution path.
 */
export function buildRequestProjectionProductSnapshot(product: RequestProjectionProductShape | null): {
  productId: string;
  productCode: string;
  productTitle: string;
  productType: string;
  travelerRequirements: Record<string, string> | null;
} | null {
  if (!product) return null;
  return {
    productId: product.id,
    productCode: product.code,
    productTitle: product.title,
    productType: product.type as string,
    travelerRequirements: product.travelerRequirements,
  };
}

import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { ReferenceNumberService } from "../../shared/reference-number.service";
import { SecurityService } from "../../security/security.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { ConflictError, ValidationDomainError } from "../../shared/errors";
import { getEffectiveTravelerRequirements } from "../catalog/traveler-requirements";
import { freezeForAcceptance, applyIndividualDiscount, validateForAcceptance, type CommercialSnapshot } from "../pricing/commercial-snapshot";
import { QuoteDiscountType } from "../../generated/prisma/enums";

/**
 * Helper used only by the availability projection so the projection mirrors the
 * existing execution authority shape used by getRequest().
 */
export function pinEffectiveTravelerRequirements(productType: string, travelerRequirements: Record<string, string> | null): ReturnType<typeof getEffectiveTravelerRequirements> {
  return getEffectiveTravelerRequirements(productType, travelerRequirements ?? null);
}

/**
 * Helper used only by the availability projection so the projection mirrors the
 * existing acceptance snapshot shape used by customerAccept()/convertRequestToOrder().
 */
export function hasD3AcceptSnapshot(request: {
  customerAcceptedAt: Date | null;
  pinnedRequirements: unknown;
  travelerCount: number | null;
  productSnapshot: unknown;
}): boolean {
  return (
    request.customerAcceptedAt != null &&
    request.pinnedRequirements != null &&
    request.travelerCount != null &&
    request.productSnapshot != null
  );
}


import {
  assertRequestTravelerPosition,
  computeRequestTravelersReadiness,
  normalizeRequestTravelerInput,
  type RequestTravelerInput,
} from "./request-travelers";

import { OrderService } from "./order.service";
import { Prisma } from "../../generated/prisma/client";
import { assertValidRequestSort, buildRequestOrderBy } from "./request-sort";
import { parseDateParam } from "../../shared/date-param";

/** Default SLA: 24 hours for supplier response */
const DEFAULT_SUPPLIER_SLA_HOURS = 24;
/** Default customer TTL: 48 hours after supplier confirmation */
const DEFAULT_CUSTOMER_TTL_HOURS = 48;

interface Actor {
  /** M4.5: null = system/guest-каналы (audit userId FK → null; history — nullable). */
  id: string | null;
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
  /**
   * Two-stage §4: состав Request-стадии (FIO + birthDate). Если указан без
   * travelerCount — размер партии выводится из длины массива.
   */
  travelers?: RequestTravelerInput[];
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
  sortBy?: string;
  sortDirection?: string;
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

    // Two-stage §4/§6: состав Request-стадии валидируется целиком при создании
    // (FIO + birthDate REQUIRED; count-несоответствие → 422, а не «тихая» правка).
    const requestTravelers =
      dto.travelers && dto.travelers.length > 0
        ? dto.travelers.map((t) => normalizeRequestTravelerInput(t ?? {}))
        : [];
    let travelerCount = dto.travelerCount ?? null;
    if (requestTravelers.length > 0) {
      if (travelerCount == null) {
        travelerCount = requestTravelers.length;
      } else if (travelerCount !== requestTravelers.length) {
        throw new BadRequestException(
          `travelerCount (${travelerCount}) must match travelers.length (${requestTravelers.length})`,
        );
      }
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
        travelerCount,
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

    // Two-stage §4: состав Request-стадии (FIO + birthDate) — позиции 1..N.
    if (requestTravelers.length > 0) {
      await this.prisma.requestTraveler.createMany({
        data: requestTravelers.map((t, index) => ({
          requestId: request.id,
          position: index + 1,
          firstName: t.firstName,
          lastName: t.lastName,
          birthDate: new Date(`${t.birthDate}T00:00:00.000Z`),
        })),
      });
    }

    await this.security.audit(null as any, {
      userId: actor.id,
      username: actor.username,
      action: "request.created",
      resource: "Request",
      resourceId: request.id,
      details: { code: request.code, referenceNumber: request.referenceNumber, commerceSequence, travelerCount },
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

    // UI-C1.2F.1G: canonical sort boundary validation (HTTP 400 on an explicitly
    // disallowed sortBy / malformed sortDirection) — same convention as dates.
    assertValidRequestSort(query.sortBy, query.sortDirection);
    // Validate both independently before any search read or Prisma where build.
    const dateFrom = parseDateParam(query.dateFrom, "dateFrom");
    const dateTo = parseDateParam(query.dateTo, "dateTo");

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
          ...(dateFrom ? { gte: dateFrom } : {}),
          ...(dateTo ? { lt: dateTo } : {}),
        },
      } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.request.findMany({
        where,
        orderBy: buildRequestOrderBy(query.sortBy, query.sortDirection),
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
  // ── Two-stage traveler model §4 — Request travelers CRUD ─────────────────

  /** Ожидаемый состав: явный travelerCount, иначе quantity (legacy). */
  private expectedTravelerCount(request: { travelerCount: number | null; quantity: number }): number {
    return request.travelerCount ?? request.quantity;
  }

  /** §4: редактирование состава запрещено после конвертации/отклонения. */
  private assertTravelersEditable(request: { id: string; status: string }): void {
    if (request.status === "CONVERTED") {
      throw new ConflictException(
        `Request ${request.id} travelers are immutable after conversion (status CONVERTED)`,
      );
    }
    if (request.status === "REJECTED") {
      throw new ConflictException(
        `Request ${request.id} travelers are immutable in status REJECTED`,
      );
    }
  }

  private async findRequestOrThrow(requestId: string) {
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`Request ${requestId} not found`);
    return request;
  }

  private requestTravelerDto(row: {
    id: string;
    requestId: string;
    position: number;
    firstName: string;
    lastName: string;
    birthDate: Date;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      requestId: row.requestId,
      position: row.position,
      firstName: row.firstName,
      lastName: row.lastName,
      birthDate: row.birthDate.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** §4: GET request travelers — список + server-authoritative readiness. */
  async getRequestTravelers(requestId: string): Promise<Record<string, unknown>> {
    const request = await this.findRequestOrThrow(requestId);
    const travelers = await this.prisma.requestTraveler.findMany({
      where: { requestId },
      orderBy: { position: "asc" },
    });
    const expected = this.expectedTravelerCount(request);
    return {
      requestId: request.id,
      referenceNumber: request.referenceNumber,
      status: request.status,
      travelerCount: expected,
      count: travelers.length,
      ready: computeRequestTravelersReadiness(travelers, expected),
      travelers: travelers.map((t) => this.requestTravelerDto(t)),
    };
  }

  private async recordTravelerHistory(
    requestId: string,
    action: string,
    comment: string,
    actor: Actor,
    request: { status: string },
  ): Promise<void> {
    await this.prisma.requestHistory.create({
      data: {
        requestId,
        action,
        from: request.status,
        to: request.status,
        actorId: actor.id,
        actorName: actor.username,
        comment,
      },
    });
  }

  /** §4: POST — создать туриста Request-стадии (FIO + birthDate). */
  async createRequestTraveler(
    requestId: string,
    input: RequestTravelerInput,
    actor: Actor,
  ): Promise<Record<string, unknown>> {
    const request = await this.findRequestOrThrow(requestId);
    this.assertTravelersEditable(request);

    const normalized = normalizeRequestTravelerInput(input);
    const expected = this.expectedTravelerCount(request);
    const existing = await this.prisma.requestTraveler.findMany({
      where: { requestId },
      orderBy: { position: "asc" },
    });
    if (existing.length >= expected) {
      throw new ValidationDomainError(
        `traveler count limit reached: travelerCount=${expected}, already added=${existing.length}`,
      );
    }
    const requestedPosition = assertRequestTravelerPosition(input.position, expected);
    const nextPosition =
      requestedPosition ?? existing.reduce((max, t) => Math.max(max, t.position), 0) + 1;

    let created: Awaited<ReturnType<PrismaService["requestTraveler"]["create"]>>;
    try {
      created = await this.prisma.requestTraveler.create({
        data: {
          requestId,
          position: nextPosition,
          firstName: normalized.firstName,
          lastName: normalized.lastName,
          birthDate: new Date(`${normalized.birthDate}T00:00:00.000Z`),
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        throw new ConflictException(
          `Request ${requestId}: position ${nextPosition} is already taken`,
        );
      }
      throw err;
    }

    await this.recordTravelerHistory(requestId,
      "traveler_added",
      `Добавлен турист ${created.position} (${normalized.lastName} ${normalized.firstName})`,
      actor,
      request,
    );
    return this.requestTravelerDto(created);
  }

  /** §4: PATCH — изменить туриста Request-стадии. */
  async updateRequestTraveler(
    requestId: string,
    travelerId: string,
    input: RequestTravelerInput,
    actor: Actor,
  ): Promise<Record<string, unknown>> {
    const request = await this.findRequestOrThrow(requestId);
    this.assertTravelersEditable(request);

    const existing = await this.prisma.requestTraveler.findFirst({
      where: { id: travelerId, requestId },
    });
    if (!existing) throw new NotFoundException(`RequestTraveler ${travelerId} not found`);

    const normalized = normalizeRequestTravelerInput({
      firstName: input.firstName !== undefined ? input.firstName : existing.firstName,
      lastName: input.lastName !== undefined ? input.lastName : existing.lastName,
      birthDate:
        input.birthDate !== undefined ? input.birthDate : existing.birthDate.toISOString().slice(0, 10),
    });
    const expected = this.expectedTravelerCount(request);
    const requestedPosition = assertRequestTravelerPosition(input.position, expected);

    let updated: Awaited<ReturnType<PrismaService["requestTraveler"]["update"]>>;
    try {
      updated = await this.prisma.requestTraveler.update({
        where: { id: travelerId },
        data: {
          firstName: normalized.firstName,
          lastName: normalized.lastName,
          birthDate: new Date(`${normalized.birthDate}T00:00:00.000Z`),
          ...(requestedPosition != null ? { position: requestedPosition } : {}),
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        throw new ConflictException(`Request ${requestId}: position ${requestedPosition} is already taken`);
      }
      throw err;
    }

    await this.recordTravelerHistory(requestId,
      "traveler_updated",
      `Изменён турист ${updated.position} (${updated.lastName} ${updated.firstName})`,
      actor,
      request,
    );
    return this.requestTravelerDto(updated);
  }

  /** §4: DELETE — убрать туриста (разрешено только до конвертации/отклонения). */
  async deleteRequestTraveler(requestId: string, travelerId: string, actor: Actor): Promise<Record<string, unknown>> {
    const request = await this.findRequestOrThrow(requestId);
    this.assertTravelersEditable(request);

    const existing = await this.prisma.requestTraveler.findFirst({
      where: { id: travelerId, requestId },
    });
    if (!existing) throw new NotFoundException(`RequestTraveler ${travelerId} not found`);

    await this.prisma.requestTraveler.delete({ where: { id: travelerId } });
    await this.recordTravelerHistory(requestId,
      "traveler_removed",
      `Удалён турист ${existing.position} (${existing.lastName} ${existing.firstName})`,
      actor,
      request,
    );
    return { id: existing.id, requestId, deleted: true };
  }

  /** §6: readiness-гейт для acceptance/conversion (execution authority). */
  private async assertTravelersReadyForCommercialStep(request: {
    id: string;
    travelerCount: number | null;
    quantity: number;
  }): Promise<void> {
    const travelers = await this.prisma.requestTraveler.findMany({
      where: { requestId: request.id },
      orderBy: { position: "asc" },
    });
    const expected = this.expectedTravelerCount(request);
    if (travelers.length !== expected) {
      throw new ValidationDomainError(
        `traveler count mismatch: travelerCount=${expected}, RequestTraveler=${travelers.length}; request is not ready`,
      );
    }
    if (!computeRequestTravelersReadiness(travelers, expected)) {
      throw new ValidationDomainError(
        "request travelers are incomplete: firstName/lastName/birthDate are required for every traveler",
      );
    }
  }

  async getRequest(id: string, grantedPermissions: readonly string[] = []): Promise<Record<string, unknown>> {
    const request = await this.prisma.request.findUnique({ where: { id } });
    if (!request) throw new NotFoundException(`Request ${id} not found`);

    // Fetch related entities
    const [customer, product, partner, requestTravelers] = await Promise.all([
      request.customerId ? this.prisma.customer.findUnique({ where: { id: request.customerId }, select: { firstName: true, lastName: true, code: true, email: true, phone: true } }) : null,
      request.productId ? this.prisma.product.findUnique({ where: { id: request.productId }, select: { title: true, code: true, type: true } }) : null,
      request.partnerId ? this.prisma.partner.findUnique({ where: { id: request.partnerId }, select: { name: true, code: true, countryCode: true } }) : null,
      // Two-stage §4: состав Request-стадии (FIO + birthDate) — только в detail,
      // не в list (PII не должен попадать в массовую выборку/export).
      this.prisma.requestTraveler.findMany({ where: { requestId: id }, orderBy: { position: "asc" } }),
    ]);

    const customerMap = customer ? new Map([[request.customerId!, customer]]) : new Map();
    const productMap = product ? new Map([[request.productId!, product]]) : new Map();
    const partnerMap = partner ? new Map([[request.partnerId!, partner]]) : new Map();
    const dto = this.requestDto(request, customerMap, productMap, partnerMap) as any;

    dto.customerEmail = customer?.email ?? null;
    dto.customerPhone = customer?.phone ?? null;
    dto.productType = product?.type ?? null;
    dto.partnerCountry = partner?.countryCode ?? null;

    // Two-stage §4/§6: server-authoritative состав + readiness. UI (и
    // availableActions ниже) читают ЭТОТ результат, а не считают сами.
    const expectedTravelers = this.expectedTravelerCount(request);
    dto.travelers = requestTravelers.map((t) => this.requestTravelerDto(t));
    dto.travelersExpected = expectedTravelers;
    dto.travelersReady = computeRequestTravelersReadiness(requestTravelers, expectedTravelers);

    // UI-C6: server-authoritative action availability projection.
    // Controller passes the actor's granted permissions explicitly.
    //
    // Hotel Identity Fix B (HOTEL_IDENTITY_AUDIT_REPORT §11 option C):
    // projection precedence — live Product snapshot when the Product exists,
    // otherwise the FROZEN Request.productSnapshot. A product-less Request
    // (productId = NULL, valid manual/live-sales case §12) must not lose the
    // convert action solely because the projection could not reconstruct a
    // snapshot from a NULL productId. Execution remains authoritative: the
    // conversion path reads the same frozen Request.productSnapshot
    // (convertRequestToOrder), so the projection no longer diverges from it.
    const projectionProductSnapshot =
      buildRequestProjectionProductSnapshot(
        product as RequestProjectionProductShape | null,
      ) ??
      ((request.productSnapshot ?? null) as {
        productId?: string;
        productCode?: string;
        productTitle?: string;
        productType?: string;
      } | null);
    dto.availableActions = computeRequestAvailableActions(
      {
        status: request.status,
        convertedOrderId: request.convertedOrderId,
        customerActionDeadline: request.customerActionDeadline,
        customerAcceptedAt: request.customerAcceptedAt,
        pinnedRequirements: request.pinnedRequirements,
        travelerCount: request.travelerCount ?? null,
        travelersReady: dto.travelersReady === true,
        productSnapshot: projectionProductSnapshot,
        confirmedPrice: request.confirmedPrice,
        confirmedCurrency: request.confirmedCurrency,
        displayedPrice: request.displayedPrice,
        displayedCurrency: request.displayedCurrency,
      },
      grantedPermissions,
    );

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
   * Supplier Markup Phase 4 §4.3 (Live Sales): server-authoritative
   * individual discount on a Request.
   *
   * RBAC: sales.discount.grant (controller). Money-математика — только
   * sales.money через applyIndividualDiscount (пересчёт из publicPrice/
   * discount, publicPrice/displayedPrice НЕ меняются) + validateForAcceptance
   * (floor customerFinalPrice >= supplierPrice → 422 "final price <
   * supplier price"). Скидка хранится ТОЛЬКО в Request.commercialSnapshot
   * (→ Order при конвертации); MarkupRule/Tariff/Storefront/
   * CommissionPolicy не трогаются.
   *
   * Замороженный snapshot (customerAcceptedAt) и конвертированная заявка —
   * reject. PRICE_CHANGED: acceptance-контракт (Phase 3 §13) отдаёт приоритет
   * supplierPriceProposal — скидка в snapshot была бы проигнорирована, поэтому
   * pending supplier proposal блокируется с явным сообщением.
   */
  async grantDiscount(
    requestId: string,
    input: { discountType: string; discountValue?: string | number | null },
    actor: Actor,
  ): Promise<Record<string, unknown>> {
    const allowedTypes = Object.values(QuoteDiscountType) as string[];
    if (!allowedTypes.includes(input.discountType)) {
      throw new ValidationDomainError(
        `invalid discountType: must be one of ${allowedTypes.join(", ")}`,
      );
    }
    const discountType = input.discountType as QuoteDiscountType;

    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`Request ${requestId} not found`);
    if (request.convertedOrderId) {
      throw new ValidationDomainError(
        `Request ${requestId} is already converted to Order ${request.convertedOrderId}: commercial snapshot is immutable`,
      );
    }
    if (!request.commercialSnapshot) {
      throw new ValidationDomainError(
        "request has no commercial snapshot: discount requires a priced request (missing supplier price)",
      );
    }
    const snapshot = request.commercialSnapshot as unknown as CommercialSnapshot;
    if (snapshot.customerAcceptedAt) {
      throw new ValidationDomainError(
        "commercial snapshot is frozen (customer already accepted): discount cannot be changed",
      );
    }
    const allowedStatuses: RequestStatus[] = ["NEW", "CHECKING", "CONFIRMED"];
    if (!allowedStatuses.includes(request.status)) {
      if (request.status === "PRICE_CHANGED") {
        throw new ValidationDomainError(
          "supplier price proposal pending: resolve the supplier proposal before granting a discount",
        );
      }
      throw new ValidationDomainError(
        `discount cannot be applied in status ${request.status}: allowed ${allowedStatuses.join(", ")}`,
      );
    }
    if (request.supplierPriceProposal != null) {
      throw new ValidationDomainError(
        "supplier price proposal pending: resolve the supplier proposal before granting a discount",
      );
    }

    const beforeFinal = snapshot.customerFinalPrice;
    // Server-authoritative: пересчёт из publicPrice/discount через
    // sales.money + полная acceptance-валидация (consistency + floor → 422).
    const updated = applyIndividualDiscount(snapshot, discountType, input.discountValue ?? null);
    validateForAcceptance(updated);

    const updatedRow = await this.prisma.request.update({
      where: { id: requestId },
      data: {
        commercialSnapshot: updated as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });

    await this.prisma.requestHistory.create({
      data: {
        requestId,
        action: "discount_granted",
        from: request.status,
        to: request.status,
        actorId: actor.id,
        actorName: actor.username,
        comment: `Индивидуальная скидка ${discountType}=${input.discountValue ?? 0}: final ${beforeFinal} → ${updated.customerFinalPrice} ${updated.customerCurrency} (discountAmount ${updated.discountAmount})`,
      },
    });

    await this.security.audit(null as any, {
      userId: actor.id,
      username: actor.username,
      action: "request.discount_granted",
      resource: "Request",
      resourceId: requestId,
      details: {
        discountType,
        discountValue: updated.discountValue,
        discountAmount: updated.discountAmount,
        customerFinalPrice: updated.customerFinalPrice,
        currency: updated.customerCurrency,
      },
    });

    return this.requestDto(updatedRow);
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

    // Two-stage §6 (execution authority): acceptance — коммерческий шаг, он
    // требует ПОЛНОГО состава Request-стадии (FIO + birthDate на каждого).
    // Readiness пересчитывается здесь же, а не берётся из клиента.
    await this.assertTravelersReadyForCommercialStep(request);

    // D3 §7: pin effective requirements в acceptance boundary. Продукт читается
    // ТОЛЬКО здесь (одна транзакция с acceptance) — позже не перечитывается.
    // Product-less запросы (публичные supplier-инквairi из create-request:
    // productId=null) — каталог-политика требований неприменима; их pin
    // (tour-offer) уже заморожен при создании и ЗДЕСЬ НЕ перезаписывается.
    const product = request.productId
      ? await this.prisma.product.findUnique({
          where: { id: request.productId },
          select: { id: true, code: true, title: true, type: true, travelerRequirements: true },
        })
      : null;
    if (request.productId && !product) {
      throw new BadRequestException(
        "Cannot accept: Request has no resolvable Product for pinned traveler requirements (D3 §7)",
      );
    }
    const pinnedRequirements = product
      ? getEffectiveTravelerRequirements(
          product.type as string,
          (product as unknown as { travelerRequirements: Record<string, string> | null }).travelerRequirements ?? null,
        )
      : null;
    // D3 §8: frozen traveler count. Explicit travelerCount (party composition)
    // — canonical; legacy NULL → quantity (единственное прежнее представление,
    // DB default 1 = 1 гость). Замораживается явно на Request.
    const frozenTravelerCount = request.travelerCount ?? request.quantity;
    if (!Number.isInteger(frozenTravelerCount) || frozenTravelerCount < 1) {
      throw new BadRequestException("Cannot accept: traveler count must be a positive integer (D3 §8)");
    }
    const now = new Date();

    // Supplier Markup Phase 3 (§13 / design §8): commercial-money gate —
    // acceptance never stores 0/missing money. Accepted money precedence:
    // supplier proposal (supplier-confirmed current money) ?? snapshot final
    // ?? displayed price (legacy requests without snapshot: money-gate only).
    const snapshot = (request.commercialSnapshot ?? null) as CommercialSnapshot | null;
    const acceptedMoney =
      request.supplierPriceProposal ?? (snapshot ? snapshot.customerFinalPrice : request.displayedPrice);
    const acceptedCurrency =
      request.supplierPriceProposal != null || !snapshot
        ? request.displayedCurrency
        : snapshot.customerCurrency;
    let frozenSnapshot: CommercialSnapshot | null = null;
    if (snapshot) {
      // Snapshot path: full §13 validation — ValidationDomainError (422) with
      // the canonical rejection phrases (missing/invalid/floor). Freezes the
      // snapshot at acceptance (Gate F basis).
      if (acceptedMoney == null) {
        throw new ValidationDomainError("invalid final price: missing accepted money");
      }
      if (!acceptedCurrency) {
        throw new ValidationDomainError("missing currency: accepted currency required");
      }
      frozenSnapshot = freezeForAcceptance(snapshot, acceptedMoney, acceptedCurrency, now);
    } else if (acceptedMoney == null || !(Number(acceptedMoney) > 0) || !acceptedCurrency) {
      // Legacy requests (no snapshot): money-gate only (design §8) — acceptance
      // never stores 0/missing money.
      throw new BadRequestException(
        "Cannot accept: request has no valid commercial money (accepted price/currency missing)",
      );
    }
    const updated = await this.prisma.request.update({
      where: { id: requestId },
      data: {
        status: "CUSTOMER_ACCEPTED",
        customerAcceptedAt: now,
        customerDecision: "ACCEPTED",
        confirmedPrice: acceptedMoney,
        confirmedCurrency: acceptedCurrency,
        ...(frozenSnapshot ? { commercialSnapshot: frozenSnapshot as unknown as Prisma.InputJsonValue } : {}),
        // Product-less: pin/snapshot НЕ трогаем (undefined = no-op) — сохраняем
        // замороженный при создании tour-pin и исходный (или null) snapshot.
        ...(product
          ? {
              pinnedRequirements: pinnedRequirements as Prisma.InputJsonValue,
              productSnapshot: {
                // Data-shape fix §6: identity refresh (product как принят сейчас)
                // НЕ должен затирать offer-facts, замороженные при создании
                // (productSnapshot.offer) — merge существующего snapshot,
                // identity-ключи перезаписываются как и раньше.
                ...((request.productSnapshot ?? {}) as Record<string, unknown>),
                productId: product.id,
                productCode: product.code,
                productTitle: product.title,
                productType: product.type,
              } as Prisma.InputJsonValue,
            }
          : {}),
        travelerCount: frozenTravelerCount,
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
   *
   * UI-C6: deterministic status validation. This endpoint must reject invalid
   * current Request statuses with a 4xx and perform no state/history mutation.
   * Valid source states are derived from existing Request flow evidence.
   */
  async customerDecline(requestId: string, actor: Actor): Promise<Record<string, unknown>> {
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`Request ${requestId} not found`);

    if (request.status !== "PRICE_CHANGED" && request.status !== "CONFIRMED") {
      throw new BadRequestException(
        `Cannot decline in status ${request.status}; customerDecline requires PRICE_CHANGED or CONFIRMED`,
      );
    }

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

    // Stage 1 (Order → Request): вернувшаяся заявка снова проходит supplier-
    // цикл и принимается клиентом (CUSTOMER_ACCEPTED + convertedOrderId = O1),
    // но ПОВТОРНАЯ конвертация запрещена явным 409: Order.referenceNumber =
    // MKT-ORD-{commerceSequence} @unique фиксирует инвариант «один Order на
    // commerce chain» — без этого гейта повторный convert падал бы P2002 (500).
    // Multi-order forward (новый Order поверх истории) — Booking→Order design pass.
    if (existing.convertedOrderId) {
      throw new ConflictException(
        `Request ${requestId} was already converted to order ${existing.convertedOrderId}; ` +
          `re-conversion is not supported (one Order per commerce sequence)`,
      );
    }

    // Гейт конверсии: только принятая заявка (валидные supplier/current terms).
    if (existing.status !== "CUSTOMER_ACCEPTED") {
      throw new ConflictException(
        `Cannot convert Request ${requestId} in status ${existing.status}; conversion requires CUSTOMER_ACCEPTED`,
      );
    }
    if (!existing.customerAcceptedAt || !existing.travelerCount) {
      throw new ConflictException(
        `Request ${requestId} has no D3 acceptance snapshot (customerAcceptedAt/travelerCount); conversion rejected`,
      );
    }

    // Two-stage §6/§10 (execution authority): конвертация копирует
    // RequestTraveler → OrderTraveler, поэтому состав обязан быть полным и
    // согласованным с travelerCount уже СЕЙЧАС (иначе §10-инвариант невозможен).
    await this.assertTravelersReadyForCommercialStep(existing);

    // Заявка без productId конвертируется в заказ без продуктовой привязки
    // (ограничение снято): productSnapshot может быть null → OrderItem получает
    // placeholder identity в OrderService.createOrderFromRequest.
    const productSnapshot = (existing.productSnapshot ?? null) as unknown as {
      productId: string;
      productCode: string;
      productTitle: string;
      productType: string;
    } | null;

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
          // Supplier Markup Phase 4 §4.6: verbatim propagation frozen
          // commercial snapshot → Order (immutable; MarkupRule change не
          // пересчитывает принятые деньги). Legacy без snapshot → null.
          commercialSnapshot: existing.commercialSnapshot as unknown as Record<string, unknown> | null,
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
    const dateFrom = parseDateParam(query?.dateFrom, "dateFrom");
    const dateTo = parseDateParam(query?.dateTo, "dateTo");
    const where: any = {};
    if (query?.dateFrom || query?.dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lt: dateTo } : {}),
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
    const pinned = (r.pinnedRequirements ?? null) as Record<string, any> | null;
    const snap = (r.productSnapshot ?? null) as Record<string, any> | null;
    const commercial = (r.commercialSnapshot ?? null) as Record<string, any> | null;
    // Data-shape fix §6: offer/search facts are frozen in productSnapshot.offer
    // (canonical location, producer-written at creation). `pinned` fallback
    // keeps LEGACY rows — до фикса producer писал offer-snapshot в
    // pinnedRequirements — рендерящимися идентично.
    const offer = (snap?.offer ?? null) as Record<string, any> | null;
    const pick = (key: string): unknown => offer?.[key] ?? pinned?.[key];
    const asNum = (v: unknown): number | null => (typeof v === "number" ? v : null);
    const asStr = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
    // «Услуга» cell must never be a dash for supplier-created requests: product
    // table title (when linked) → frozen productSnapshot → offer/pinned hotel name.
    const productName = prod?.title ?? snap?.productTitle ?? asStr(offer?.hotel) ?? asStr(pinned?.hotel) ?? null;
    const productCode = prod?.code ?? snap?.productCode ?? null;
    // «Услуга» type (тур / отель / авиабилет): frozen in the snapshots at
    // creation; raw supplier values («tours», «TOUR»…) normalized on the client.
    const serviceType = snap?.productType ?? snap?.type ?? (typeof commercial?.serviceType === "string" ? commercial.serviceType : null) ?? null;
    // «Поставщик» cell: supplier code pinned at creation (tour/flight requests),
    // commercial snapshot as fallback. partner* stays the B2B partner, separate.
    const supplierCode = pinned?.supplierCode ?? commercial?.supplierCode ?? offer?.supplierCode ?? snap?.supplierCode ?? null;
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
      productCode,
      serviceType,
      partnerId: r.partnerId,
      partnerName,
      partnerCode: part?.code ?? null,
      supplierCode,
      // Selected-service parameters (Phase 4 / data-shape fix §6): frozen at
      // creation — canonical location productSnapshot.offer, pinned = legacy rows.
      nights: asNum(pick("nights")),
      adults: asNum(pick("adults")),
      children: asNum(pick("children")),
      country: asStr(pick("country")),
      destination: asStr(pick("destination")),
      departureCity: asStr(pick("departureCity")),
      status: r.status,
      requestedServiceDate: r.requestedServiceDate?.toISOString() ?? null,
      quantity: r.quantity,
      // D3: frozen party composition (travelerCount). NULL = legacy заявка.
      travelerCount: r.travelerCount ?? null,
      productSnapshot: r.productSnapshot ?? null,
      displayedPrice: r.displayedPrice?.toString() ?? null,
      displayedCurrency: r.displayedCurrency,
      // Supplier Markup Phase 3 (§20): frozen commercial facts (null until the
      // pricing boundary writes it / legacy requests).
      commercialSnapshot: r.commercialSnapshot ?? null,
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
